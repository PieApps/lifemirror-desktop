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

    /// Pull/Download a model natively. Emits progress events over Tauri event system.
    async fn pull_model(&self, purpose: ModelPurpose, app_handle: tauri::AppHandle) -> Result<(), InferenceError>;
}

/// Factory function to retrieve the active InferenceProvider.
/// Currently defaults to Ollama. Designed to be completely unpluggable for future embedded backends.
pub fn get_inference_provider(db: Arc<DbState>) -> Box<dyn InferenceProvider> {
    Box::new(OllamaProvider { db })
}
