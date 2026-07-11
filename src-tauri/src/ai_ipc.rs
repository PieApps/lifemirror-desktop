use crate::db::DbState;
use std::sync::Arc;

// --- Provider Trait ---

#[async_trait::async_trait]
pub trait AIProvider: Send + Sync {
    async fn prompt(&self, prompt: &str) -> Result<String, String>;
}

// --- Ollama Provider ---

pub struct OllamaProvider {
    pub db: Arc<DbState>,
}

#[async_trait::async_trait]
impl AIProvider for OllamaProvider {
    async fn prompt(&self, prompt: &str) -> Result<String, String> {
        let mut ollama_model = self.db.get_setting("ollama_model").unwrap_or_default();
        if ollama_model.is_empty() || ollama_model == "false" { ollama_model = "llama3.2".to_string(); }

        let mut ollama_url = self.db.get_setting("ollama_url").unwrap_or_default();
        if ollama_url.is_empty() || ollama_url == "false" { ollama_url = "http://localhost:11434".to_string(); }

        if ollama_model == "disabled" || ollama_url == "disabled" {
            return Err("Ollama is disabled in settings.".to_string());
        }

        let payload = serde_json::json!({
            "model": ollama_model,
            "prompt": prompt,
            "stream": false
        });

        let output = tokio::process::Command::new("curl")
            .args([
                "-s",
                "-X", "POST",
                &format!("{}/api/generate", ollama_url),
                "-H", "Content-Type: application/json",
                "-d", &payload.to_string(),
            ])
            .output()
            .await
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            return Err(format!("Curl failed with status: {}", output.status));
        }

        if let Ok(response_json) = serde_json::from_slice::<serde_json::Value>(&output.stdout) {
            if let Some(text) = response_json["response"].as_str() {
                return Ok(text.to_string());
            }
        }
        
        Err("Failed to parse Ollama JSON response.".to_string())
    }
}

impl OllamaProvider {
    pub async fn check_embedding_model_installed(&self) -> Result<bool, String> {
        let mut ollama_url = self.db.get_setting("ollama_url").unwrap_or_default();
        if ollama_url.is_empty() || ollama_url == "false" { ollama_url = "http://localhost:11434".to_string(); }

        let mut embed_model = self.db.get_setting("ollama_embedding_model").unwrap_or_default();
        if embed_model.is_empty() || embed_model == "false" { embed_model = "nomic-embed-text".to_string(); }

        let output = tokio::process::Command::new("curl")
            .args(["-s", &format!("{}/api/tags", ollama_url)])
            .output()
            .await
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            return Err("Failed to reach Ollama tags API".to_string());
        }

        if let Ok(json) = serde_json::from_slice::<serde_json::Value>(&output.stdout) {
            if let Some(models) = json["models"].as_array() {
                for m in models {
                    if let Some(name) = m["name"].as_str() {
                        if name.starts_with(&embed_model) {
                            return Ok(true);
                        }
                    }
                }
            }
        }
        Ok(false)
    }

    pub async fn embed(&self, text: &str) -> Result<(Vec<f32>, String, String), String> {
        let mut ollama_url = self.db.get_setting("ollama_url").unwrap_or_default();
        if ollama_url.is_empty() || ollama_url == "false" { ollama_url = "http://localhost:11434".to_string(); }

        let mut embed_model = self.db.get_setting("ollama_embedding_model").unwrap_or_default();
        if embed_model.is_empty() || embed_model == "false" { embed_model = "nomic-embed-text".to_string(); }

        let payload = serde_json::json!({
            "model": embed_model,
            "prompt": text
        });

        let output = tokio::process::Command::new("curl")
            .args([
                "-s",
                "-X", "POST",
                &format!("{}/api/embeddings", ollama_url),
                "-H", "Content-Type: application/json",
                "-d", &payload.to_string(),
            ])
            .output()
            .await
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            return Err(format!("Curl failed with status: {}", output.status));
        }

        if let Ok(response_json) = serde_json::from_slice::<serde_json::Value>(&output.stdout) {
            if let Some(embedding) = response_json["embedding"].as_array() {
                let vec_f32: Vec<f32> = embedding.iter()
                    .filter_map(|v| v.as_f64().map(|f| f as f32))
                    .collect();
                return Ok((vec_f32, "ollama".to_string(), embed_model));
            }
        }
        
        Err("Failed to parse Ollama embeddings response.".to_string())
    }
}
