use crate::db::DbState;
use std::sync::Arc;
use thiserror::Error;

pub mod ollama;
pub mod cloud;
use ollama::OllamaProvider;
use cloud::CloudProvider;

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
/// Checks the user's configured ai_provider setting:
/// - "cloud" -> CloudProvider (OpenAI-compatible)
/// - "local" (default) -> OllamaProvider
pub fn get_inference_provider(db: Arc<DbState>) -> Box<dyn InferenceProvider> {
    let provider_mode = db.get_setting("ai_provider").unwrap_or_else(|_| "local".to_string());
    if provider_mode == "cloud" {
        Box::new(CloudProvider { db })
    } else {
        Box::new(OllamaProvider { db })
    }
}

/// Validates that a cloud AI URL is a secure, valid endpoint.
/// Enforces HTTPS for non-loopback addresses to protect API keys and activity data in transit.
/// Defends against SSRF by rejecting cloud metadata endpoints (169.254.169.254) and internal subnets.
pub fn validate_cloud_url(raw_url: &str) -> Result<String, InferenceError> {
    let trimmed = raw_url.trim();
    if trimmed.is_empty() {
        return Err(InferenceError::Config("Cloud URL cannot be empty.".into()));
    }
    let parsed = url::Url::parse(trimmed)
        .map_err(|e| InferenceError::Config(format!("Invalid Cloud URL format: {e}")))?;

    let scheme = parsed.scheme();
    if scheme != "https" && scheme != "http" {
        return Err(InferenceError::Config(
            "Cloud URL scheme must be https (or http for local loopback testing).".into(),
        ));
    }

    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err(InferenceError::Config(
            "Cloud URL must not contain embedded user credentials.".into(),
        ));
    }

    let host = parsed.host().ok_or_else(|| {
        InferenceError::Config("Missing host in Cloud URL.".into())
    })?;

    let is_loopback = match host {
        url::Host::Domain(d) => d.eq_ignore_ascii_case("localhost") || d.ends_with(".localhost"),
        url::Host::Ipv4(ip) => ip.is_loopback(),
        url::Host::Ipv6(ip) => ip.is_loopback(),
    };

    // If not loopback, enforce HTTPS to protect credentials and data over WAN
    if !is_loopback && scheme != "https" {
        return Err(InferenceError::Config(
            "Security violation: Remote Cloud AI endpoints must use HTTPS to encrypt activity logs and API keys.".into(),
        ));
    }

    // Guard against SSRF to private/internal networks and cloud metadata services
    match host {
        url::Host::Ipv4(ip) => {
            let oct = ip.octets();
            let is_metadata = oct[0] == 169 && oct[1] == 254; // Link-local / AWS/GCP metadata
            let is_private = oct[0] == 10 
                || (oct[0] == 172 && (16..=31).contains(&oct[1])) 
                || (oct[0] == 192 && oct[1] == 168);
            let is_unspecified = ip.is_unspecified() || ip.is_broadcast();

            if is_metadata || is_unspecified {
                return Err(InferenceError::Config(
                    "Security violation: Cloud AI URL targets a restricted link-local or metadata address.".into(),
                ));
            }
            if is_private && !is_loopback {
                return Err(InferenceError::Config(
                    "Security violation: Cloud AI URL cannot target an internal private subnet.".into(),
                ));
            }
        }
        url::Host::Ipv6(ip) => {
            let seg = ip.segments();
            let is_link_local = (seg[0] & 0xffc0) == 0xfe80;
            let is_unique_local = (seg[0] & 0xfe00) == 0xfc00;
            if (is_link_local || is_unique_local) && !ip.is_loopback() {
                return Err(InferenceError::Config(
                    "Security violation: Cloud AI URL targets an internal IPv6 address.".into(),
                ));
            }
        }
        _ => {}
    }

    Ok(trimmed.trim_end_matches('/').to_string())
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

    #[test]
    fn test_validate_cloud_url() {
        // Valid HTTPS remote URLs
        assert_eq!(validate_cloud_url("https://api.openai.com/v1").unwrap(), "https://api.openai.com/v1");
        assert_eq!(validate_cloud_url("https://api.groq.com/openai/v1/").unwrap(), "https://api.groq.com/openai/v1");

        // Local loopback is permitted for local proxies
        assert_eq!(validate_cloud_url("http://localhost:8080/v1").unwrap(), "http://localhost:8080/v1");
        assert_eq!(validate_cloud_url("http://127.0.0.1:8080/v1").unwrap(), "http://127.0.0.1:8080/v1");

        // Plaintext HTTP on WAN must be rejected
        assert!(validate_cloud_url("http://api.openai.com/v1").is_err());
        assert!(validate_cloud_url("http://custom-proxy.internal:8080").is_err());

        // SSRF: Cloud metadata and internal private IPs must be rejected
        assert!(validate_cloud_url("http://169.254.169.254/latest/meta-data").is_err());
        assert!(validate_cloud_url("https://169.254.169.254/").is_err());
        assert!(validate_cloud_url("https://192.168.1.1/v1").is_err());
        assert!(validate_cloud_url("https://10.0.0.5/v1").is_err());

        // Invalid schemes & formats
        assert!(validate_cloud_url("").is_err());
        assert!(validate_cloud_url("ftp://api.openai.com").is_err());
        assert!(validate_cloud_url("https://admin:pass@api.openai.com").is_err());
        assert!(validate_cloud_url("not a url").is_err());
    }
}
