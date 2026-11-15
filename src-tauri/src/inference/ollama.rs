use super::{InferenceError, InferenceProvider, ModelPurpose};
use crate::db::DbState;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::{Arc, OnceLock};
use std::time::Duration;
use tauri::Emitter;
use futures_util::StreamExt;

static PROBE_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
static HEALTH_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
static INFERENCE_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn get_probe_client() -> &'static reqwest::Client {
    PROBE_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(Duration::from_millis(600))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new())
    })
}

fn get_health_client() -> &'static reqwest::Client {
    HEALTH_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new())
    })
}

fn get_inference_client() -> &'static reqwest::Client {
    INFERENCE_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new())
    })
}

pub struct OllamaProvider {
    pub db: Arc<DbState>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct PullProgress {
    status: String,
    digest: Option<String>,
    total: Option<u64>,
    completed: Option<u64>,
}

impl OllamaProvider {
    fn get_config(&self, purpose: ModelPurpose) -> Result<(String, String), InferenceError> {
        let ai_url = self.db.get_setting("ollama_url").unwrap_or_default();
        let validated_url = super::validate_local_ai_url(&ai_url)?;
            
        let ai_model = match purpose {
            ModelPurpose::TextGeneration => {
                let mut m = self.db.get_setting("ollama_model").unwrap_or_default();
                if m == "false" || m.is_empty() {
                    m = "llama3.2".to_string();
                }
                m
            },
            ModelPurpose::Embedding => {
                let mut m = self.db.get_setting("ollama_embedding_model").unwrap_or_default();
                if m == "false" || m.is_empty() {
                    m = "nomic-embed-text".to_string();
                }
                m
            },
        };

        if ai_model == "disabled" {
            return Err(InferenceError::Config("Local AI is disabled or configuration is incomplete.".into()));
        }

        Ok((validated_url, ai_model))
    }
}

#[async_trait::async_trait]
impl InferenceProvider for OllamaProvider {
    async fn is_available(&self) -> bool {
        let ai_url = self.db.get_setting("ollama_url").unwrap_or_default();
        let validated_url = match super::validate_local_ai_url(&ai_url) {
            Ok(u) => u,
            Err(_) => return false,
        };
        let client = get_probe_client();
        match client.get(format!("{}/api/version", validated_url)).send().await {
            Ok(resp) => resp.status().is_success(),
            Err(_) => false,
        }
    }

    async fn prompt(&self, prompt: &str) -> Result<String, InferenceError> {
        let (ai_url, ai_model) = self.get_config(ModelPurpose::TextGeneration)?;

        if !self.is_available().await {
            return Err(InferenceError::Api("Local AI server is not running or unreachable".into()));
        }

        let client = get_inference_client();
        let body = json!({
            "model": ai_model,
            "prompt": prompt,
            "stream": false
        });

        let res = client.post(format!("{}/api/generate", ai_url))
            .json(&body)
            .send()
            .await?;

        if !res.status().is_success() {
            let status = res.status();
            let text = res.text().await.unwrap_or_default();
            return Err(InferenceError::Api(format!("Status {}: {}", status, text)));
        }

        let json: serde_json::Value = res.json().await?;
        if let Some(resp) = json["response"].as_str() {
            Ok(resp.to_string())
        } else {
            Err(InferenceError::Api("Missing 'response' field in Local AI output.".into()))
        }
    }

    async fn embed(&self, text: &str) -> Result<(Vec<f32>, String, String), InferenceError> {
        let (ai_url, ai_model) = self.get_config(ModelPurpose::Embedding)?;

        if !self.is_available().await {
            return Err(InferenceError::Api("Local AI server is not running or unreachable".into()));
        }

        let client = get_inference_client();
        let body = json!({
            "model": ai_model,
            "prompt": text,
        });

        let res = client.post(format!("{}/api/embeddings", ai_url))
            .json(&body)
            .send()
            .await?;

        if !res.status().is_success() {
            let status = res.status();
            let err_text = res.text().await.unwrap_or_default();
            return Err(InferenceError::Api(format!("Status {}: {}", status, err_text)));
        }

        let json: serde_json::Value = res.json().await?;
        if let Some(embedding_array) = json["embedding"].as_array() {
            let mut vector = Vec::with_capacity(embedding_array.len());
            for v in embedding_array {
                if let Some(num) = v.as_f64() {
                    vector.push(num as f32);
                } else {
                    return Err(InferenceError::Api("Invalid number format in embeddings array".into()));
                }
            }
            Ok((vector, ai_model, "ollama".to_string()))
        } else {
            Err(InferenceError::Api("Missing 'embedding' field in output".into()))
        }
    }

    async fn check_health(&self, purpose: ModelPurpose) -> Result<bool, InferenceError> {
        let (ai_url, target_model) = match self.get_config(purpose) {
            Ok(cfg) => cfg,
            Err(_) => return Ok(false), // Disabled configuration is "unhealthy" but shouldn't crash
        };

        let client = get_health_client();
        let res = match client.get(format!("{}/api/tags", ai_url)).send().await {
            Ok(r) => r,
            Err(_) => return Ok(false),
        };

        if !res.status().is_success() {
            return Ok(false);
        }

        let json: serde_json::Value = res.json().await?;
        if let Some(models) = json["models"].as_array() {
            for m in models {
                if let Some(name) = m["name"].as_str() {
                    if name.starts_with(&target_model) {
                        return Ok(true);
                    }
                }
            }
        }
        
        Ok(false)
    }

    async fn pull_model(&self, purpose: ModelPurpose, app_handle: tauri::AppHandle) -> Result<(), InferenceError> {
        let (ai_url, ai_model) = self.get_config(purpose)?;
        
        let client = reqwest::Client::new();
        let body = json!({
            "name": ai_model
        });

        let res = client.post(format!("{}/api/pull", ai_url))
            .json(&body)
            .send()
            .await?;

        if !res.status().is_success() {
            let status = res.status();
            let err_text = res.text().await.unwrap_or_default();
            return Err(InferenceError::Api(format!("Status {}: {}", status, err_text)));
        }

        // Stream the response back to the frontend
        let mut stream = res.bytes_stream();

        while let Some(chunk) = stream.next().await {
            match chunk {
                Ok(bytes) => {
                    if let Ok(text) = std::str::from_utf8(&bytes) {
                        // Ollama streams NDJSON
                        for line in text.lines() {
                            if line.trim().is_empty() {
                                continue;
                            }
                            if let Ok(progress) = serde_json::from_str::<PullProgress>(line) {
                                // Emit to frontend
                                let _ = app_handle.emit("model-pull-progress", progress);
                            }
                        }
                    }
                },
                Err(e) => {
                    return Err(InferenceError::Network(e));
                }
            }
        }

        Ok(())
    }
}
