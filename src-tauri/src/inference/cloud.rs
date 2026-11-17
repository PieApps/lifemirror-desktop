use super::{InferenceError, InferenceProvider, ModelPurpose};
use crate::db::DbState;
use serde_json::json;
use std::sync::{Arc, OnceLock};
use std::time::Duration;

static CLOUD_INFERENCE_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
static CLOUD_HEALTH_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn get_inference_client() -> &'static reqwest::Client {
    CLOUD_INFERENCE_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(45))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new())
    })
}

fn get_health_client() -> &'static reqwest::Client {
    CLOUD_HEALTH_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new())
    })
}

pub struct CloudProvider {
    pub db: Arc<DbState>,
}

impl CloudProvider {
    fn get_config(&self) -> Result<(String, String, String), InferenceError> {
        let disclosure = self.db.get_setting("cloud_disclosure_accepted").unwrap_or_default();
        if disclosure != "true" {
            return Err(InferenceError::Config(
                "Cloud AI privacy disclosure has not been accepted. Please review and accept in Settings.".into(),
            ));
        }

        let api_key = self.db.get_setting("cloud_api_key").unwrap_or_default();
        if api_key.trim().is_empty() {
            return Err(InferenceError::Config(
                "Cloud API key is missing. Please configure it in Settings.".into(),
            ));
        }

        let mut base_url = self.db.get_setting("cloud_base_url").unwrap_or_default();
        if base_url.trim().is_empty() {
            let provider = self.db.get_setting("cloud_provider").unwrap_or_default();
            base_url = match provider.as_str() {
                "gemini" => "https://generativelanguage.googleapis.com/v1beta/openai".to_string(),
                "groq" => "https://api.groq.com/openai/v1".to_string(),
                "openrouter" => "https://openrouter.ai/api/v1".to_string(),
                _ => "https://api.openai.com/v1".to_string(),
            };
        }

        let validated_url = super::validate_cloud_url(&base_url)?;

        let mut model = self.db.get_setting("cloud_model").unwrap_or_default();
        if model.trim().is_empty() {
            let provider = self.db.get_setting("cloud_provider").unwrap_or_default();
            model = match provider.as_str() {
                "gemini" => "gemini-2.5-flash".to_string(),
                "groq" => "llama-3.3-70b-versatile".to_string(),
                "openrouter" => "meta-llama/llama-3.3-70b-instruct:free".to_string(),
                _ => "gpt-4o-mini".to_string(),
            };
        }

        Ok((validated_url, api_key.trim().to_string(), model.trim().to_string()))
    }
}

#[async_trait::async_trait]
impl InferenceProvider for CloudProvider {
    async fn prompt(&self, prompt: &str) -> Result<String, InferenceError> {
        let (base_url, api_key, model) = self.get_config()?;
        let endpoint = if base_url.ends_with("/chat/completions") {
            base_url
        } else {
            format!("{base_url}/chat/completions")
        };

        let client = get_inference_client();

        let payload = json!({
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.7
        });

        let response = client
            .post(&endpoint)
            .header("Authorization", format!("Bearer {api_key}"))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            if status.as_u16() == 401 {
                return Err(InferenceError::Api(
                    "Invalid API key. Please check your Cloud API key in Settings.".into(),
                ));
            } else if status.as_u16() == 429 {
                return Err(InferenceError::Api(
                    "Cloud AI rate limit reached or quota exceeded. Please try again later or check your provider account.".into(),
                ));
            }
            return Err(InferenceError::Api(format!(
                "Cloud AI request failed ({status}): {error_text}"
            )));
        }

        let resp_json: serde_json::Value = response.json().await?;
        if let Some(content) = resp_json["choices"][0]["message"]["content"].as_str() {
            Ok(content.trim().to_string())
        } else {
            Err(InferenceError::Api("Received empty response from Cloud AI provider.".into()))
        }
    }

    async fn embed(&self, text: &str) -> Result<(Vec<f32>, String, String), InferenceError> {
        let (base_url, api_key, _) = self.get_config()?;
        let endpoint = if base_url.ends_with("/embeddings") {
            base_url
        } else if base_url.ends_with("/chat/completions") {
            base_url.replace("/chat/completions", "/embeddings")
        } else {
            format!("{base_url}/embeddings")
        };

        let provider = self.db.get_setting("cloud_provider").unwrap_or_default();
        let embed_model = self.db.get_setting("cloud_embed_model").unwrap_or_else(|_| {
            if provider == "gemini" {
                "text-embedding-004".to_string()
            } else {
                "text-embedding-3-small".to_string()
            }
        });
        let client = get_inference_client();

        let payload = json!({
            "model": embed_model,
            "input": text
        });

        let response = client
            .post(&endpoint)
            .header("Authorization", format!("Bearer {api_key}"))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await?;

        if !response.status().is_success() {
            let err_body = response.text().await.unwrap_or_default();
            return Err(InferenceError::Api(format!("Embedding request failed: {err_body}")));
        }

        let resp_json: serde_json::Value = response.json().await?;
        if let Some(vec_arr) = resp_json["data"][0]["embedding"].as_array() {
            let vec_f32: Vec<f32> = vec_arr.iter().filter_map(|v| v.as_f64().map(|f| f as f32)).collect();
            Ok((vec_f32, "cloud".to_string(), embed_model))
        } else {
            Err(InferenceError::Api("Failed to parse cloud embedding response.".into()))
        }
    }

    async fn check_health(&self, _purpose: ModelPurpose) -> Result<bool, InferenceError> {
        let (base_url, api_key, _) = self.get_config()?;
        let models_endpoint = if base_url.ends_with("/chat/completions") {
            base_url.replace("/chat/completions", "/models")
        } else {
            format!("{base_url}/models")
        };

        let client = get_health_client();

        let res = client
            .get(&models_endpoint)
            .header("Authorization", format!("Bearer {api_key}"))
            .send()
            .await;

        match res {
            Ok(resp) => Ok(resp.status().is_success()),
            Err(e) => Err(InferenceError::Network(e)),
        }
    }

    async fn is_available(&self) -> bool {
        let disclosure = self.db.get_setting("cloud_disclosure_accepted").unwrap_or_default();
        let api_key = self.db.get_setting("cloud_api_key").unwrap_or_default();
        disclosure == "true" && !api_key.trim().is_empty()
    }

    async fn pull_model(&self, _purpose: ModelPurpose, _app_handle: tauri::AppHandle) -> Result<(), InferenceError> {
        // Cloud models are managed remotely; no local download needed.
        Ok(())
    }
}

