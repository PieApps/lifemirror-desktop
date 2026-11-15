use crate::db::DbState;
use std::sync::Arc;
use thiserror::Error;

pub mod ollama;
use ollama::OllamaProvider;

#[derive(Error, Debug)]
pub enum InferenceError {
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("JSON parsing error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Configuration error: {0}")]
    Config(String),
    #[error("API error: {0}")]
    Api(String),
    #[error("Model not found: {0}")]
    ModelNotFound(String),
}

/// Defines the operational purpose for the inference provider.
/// This allows the factory or trait methods to handle multi-model scenarios gracefully.
#[derive(Clone, Copy, Debug)]
pub enum ModelPurpose {
    TextGeneration,
    Embedding,
}

#[async_trait::async_trait]
pub trait InferenceProvider: Send + Sync {
    /// Generate a text response based on a prompt
    async fn prompt(&self, prompt: &str) -> Result<String, InferenceError>;
    
    /// Generate vector embeddings for a given text
    async fn embed(&self, text: &str) -> Result<(Vec<f32>, String, String), InferenceError>;
    
    /// Verify that the provider is properly configured and the required models are available
    async fn check_health(&self, purpose: ModelPurpose) -> Result<bool, InferenceError>;

    /// Fast circuit-breaker: checks if the local AI service is online and responding (sub-second timeout)
    async fn is_available(&self) -> bool;

    /// Pull/Download a model natively. Emits progress events over Tauri event system.
    async fn pull_model(&self, purpose: ModelPurpose, app_handle: tauri::AppHandle) -> Result<(), InferenceError>;
}

/// Factory function to retrieve the active InferenceProvider.
/// Currently defaults to Ollama. Designed to be completely unpluggable for future embedded backends.
pub fn get_inference_provider(db: Arc<DbState>) -> Box<dyn InferenceProvider> {
    // In Phase 3, this can read from db.get_setting("inference_provider") 
    // to dynamically return a LlamaCppProvider or other implementations.
    Box::new(OllamaProvider { db })
}

/// Validates that an AI URL strictly targets a local loopback interface (localhost, 127.0.0.1, ::1).
/// This prevents SSRF and WAN data exfiltration of sensitive desktop productivity logs.
pub fn validate_local_ai_url(raw_url: &str) -> Result<String, InferenceError> {
    let mut url_str = raw_url.trim().to_string();
    if url_str.is_empty() || url_str == "false" {
        url_str = "http://localhost:11434".to_string();
    }
    if url_str == "disabled" {
        return Err(InferenceError::Config("Local AI is disabled in settings.".into()));
    }

    let parsed = url::Url::parse(&url_str)
        .map_err(|e| InferenceError::Config(format!("Invalid AI URL format: {e}")))?;

    let scheme = parsed.scheme();
    if scheme != "http" && scheme != "https" {
        return Err(InferenceError::Config(format!(
            "Unsupported AI URL scheme '{scheme}'. Only http/https is permitted for local AI."
        )));
    }

    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err(InferenceError::Config(
            "AI URL must not contain embedded user credentials.".into(),
        ));
    }

    let host = parsed.host().ok_or_else(|| {
        InferenceError::Config("Missing host in AI URL.".into())
    })?;

    let is_local = match host {
        url::Host::Domain(d) => d.eq_ignore_ascii_case("localhost") || d.ends_with(".localhost"),
        url::Host::Ipv4(ip) => ip.is_loopback(),
        url::Host::Ipv6(ip) => ip.is_loopback(),
    };

    if !is_local {
        return Err(InferenceError::Config(format!(
            "Security violation: AI URL host '{host}' is not a local loopback address. \
             To protect user privacy, LifeMirror Desktop restricts AI inference to local loopback endpoints (localhost / 127.0.0.1 / ::1)."
        )));
    }

    let port = parsed.port_or_known_default().unwrap_or(11434);
    Ok(format!("{scheme}://{host}:{port}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_local_ai_url() {
        // Valid local URLs
        assert_eq!(validate_local_ai_url("").unwrap(), "http://localhost:11434");
        assert_eq!(validate_local_ai_url("false").unwrap(), "http://localhost:11434");
        assert_eq!(validate_local_ai_url("http://localhost:11434").unwrap(), "http://localhost:11434");
        assert_eq!(validate_local_ai_url("http://127.0.0.1:11434").unwrap(), "http://127.0.0.1:11434");
        assert_eq!(validate_local_ai_url("http://[::1]:11434").unwrap(), "http://[::1]:11434");
        assert_eq!(validate_local_ai_url("http://127.0.0.2:8000").unwrap(), "http://127.0.0.2:8000");

        // Disabled
        assert!(validate_local_ai_url("disabled").is_err());

        // Dangerous / external WAN URLs must be rejected
        assert!(validate_local_ai_url("http://evil-server.com:11434").is_err());
        assert!(validate_local_ai_url("https://api.openai.com").is_err());
        assert!(validate_local_ai_url("http://169.254.169.254/latest/meta-data").is_err());
        assert!(validate_local_ai_url("http://192.168.1.50:11434").is_err());
        assert!(validate_local_ai_url("ftp://localhost:11434").is_err());
        assert!(validate_local_ai_url("http://admin:secret@localhost:11434").is_err());
    }
}
