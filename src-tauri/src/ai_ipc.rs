use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{oneshot, Mutex};
use interprocess::local_socket::tokio::Stream as LocalSocketStream;
use interprocess::local_socket::traits::tokio::Listener as _;
use interprocess::local_socket::{prelude::*, GenericFilePath, GenericNamespaced, ListenerOptions, Name};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use std::io;
use crate::db::DbState;
use once_cell::sync::Lazy;
use uuid::Uuid;

// --- IPC Protocol Types ---

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AiIpcRequest {
    pub version: u32,
    pub r#type: String, // "ai_request"
    pub id: String,
    pub provider: String,
    pub token: Option<String>,
    pub prompt: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AiIpcResponse {
    pub version: u32,
    pub r#type: String, // "ai_response" or "ai_error"
    pub id: String,
    pub text: Option<String>,
    pub error: Option<String>,
}

// --- Provider Trait ---

#[async_trait::async_trait]
pub trait AIProvider: Send + Sync {
    async fn prompt(&self, prompt: &str) -> Result<String, String>;
}

// --- IPC Server (Tauri GUI side) ---

type PendingRequests = Arc<Mutex<HashMap<String, oneshot::Sender<Result<String, String>>>>>;

pub struct IpcServer {
    pending_requests: PendingRequests,
    active_stream: Arc<Mutex<Option<tokio::sync::mpsc::Sender<String>>>>,
}

impl IpcServer {
    pub fn new() -> Self {
        Self {
            pending_requests: Arc::new(Mutex::new(HashMap::new())),
            active_stream: Arc::new(Mutex::new(None)),
        }
    }

    pub fn get_socket_name() -> io::Result<Name<'static>> {
        if GenericNamespaced::is_supported() {
            "lifemirror_ipc.sock".to_ns_name::<GenericNamespaced>()
        } else {
            "/tmp/lifemirror_ipc.sock".to_fs_name::<GenericFilePath>()
        }
    }

    pub async fn start(&self) -> io::Result<()> {
        let name = Self::get_socket_name()?;
        
        #[cfg(unix)]
        let _ = std::fs::remove_file("/tmp/lifemirror_ipc.sock");

        let listener = match ListenerOptions::new().name(name.clone()).create_tokio() {
            Ok(l) => l,
            Err(e) => {
                eprintln!("[IPC Server] Failed to bind to {:?}: {}", name, e);
                return Err(e);
            }
        };

        println!("[IPC Server] Listening on {:?}", name);

        let active_stream = self.active_stream.clone();
        let pending = self.pending_requests.clone();

        tokio::spawn(async move {
            loop {
                match listener.accept().await {
                    Ok(stream) => {
                        println!("[IPC Server] Native host connected.");
                        Self::handle_connection(stream, active_stream.clone(), pending.clone()).await;
                    }
                    Err(e) => {
                        eprintln!("[IPC Server] Accept error: {}", e);
                    }
                }
            }
        });

        Ok(())
    }

    async fn handle_connection(
        stream: LocalSocketStream,
        active_stream: Arc<Mutex<Option<tokio::sync::mpsc::Sender<String>>>>,
        pending: PendingRequests,
    ) {
        let (reader, mut writer) = tokio::io::split(stream);
        let mut reader = BufReader::new(reader);

        // We replace any old connection, ensuring exactly one active connection.
        let (tx, mut rx) = tokio::sync::mpsc::channel::<String>(100);
        *active_stream.lock().await = Some(tx);

        tokio::spawn(async move {
            while let Some(msg) = rx.recv().await {
                let msg_with_newline = format!("{}\n", msg);
                if writer.write_all(msg_with_newline.as_bytes()).await.is_err() {
                    break;
                }
            }
        });

        tokio::spawn(async move {
            let mut line = String::new();
            while let Ok(bytes_read) = reader.read_line(&mut line).await {
                if bytes_read == 0 {
                    break;
                }
                
                if let Ok(response) = serde_json::from_str::<AiIpcResponse>(&line) {
                    let mut lock = pending.lock().await;
                    if let Some(sender) = lock.remove(&response.id) {
                        if response.r#type == "ai_error" {
                            let _ = sender.send(Err(response.error.unwrap_or_else(|| "Unknown error".to_string())));
                        } else {
                            let _ = sender.send(Ok(response.text.unwrap_or_default()));
                        }
                    }
                }
                line.clear();
            }
            println!("[IPC Server] Native host disconnected.");
            // Only clear the active stream if it hasn't been replaced by a new connection
            let mut lock = active_stream.lock().await;
            *lock = None;
        });
    }

    pub async fn send_request(&self, provider: &str, prompt: &str) -> Result<String, String> {
        let stream_tx = {
            let lock = self.active_stream.lock().await;
            match lock.as_ref() {
                Some(tx) => tx.clone(),
                None => return Err("Native host is not connected.".to_string()),
            }
        };

        let id = Uuid::new_v4().to_string();
        let request = AiIpcRequest {
            version: 1,
            r#type: "ai_request".to_string(),
            id: id.clone(),
            provider: provider.to_string(),
            token: None,
            prompt: prompt.to_string(),
        };

        let json = serde_json::to_string(&request).unwrap();
        
        let (tx, rx) = oneshot::channel();
        self.pending_requests.lock().await.insert(id.clone(), tx);

        if stream_tx.send(json).await.is_err() {
            self.pending_requests.lock().await.remove(&id);
            return Err("Failed to send request to IPC stream.".to_string());
        }

        // Wait for response with a 10-second timeout as requested by user
        match tokio::time::timeout(std::time::Duration::from_secs(10), rx).await {
            Ok(Ok(res)) => res,
            Ok(Err(_)) => Err("Request was cancelled.".to_string()),
            Err(_) => {
                self.pending_requests.lock().await.remove(&id);
                Err("Request timed out after 10 seconds.".to_string())
            }
        }
    }
}

pub static IPC_SERVER: Lazy<IpcServer> = Lazy::new(IpcServer::new);

// --- Gemini Nano Provider ---

pub struct GeminiNanoProvider;

#[async_trait::async_trait]
impl AIProvider for GeminiNanoProvider {
    async fn prompt(&self, prompt: &str) -> Result<String, String> {
        IPC_SERVER.send_request("gemini_nano", prompt).await
    }
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

// --- Provider Selection Logic ---

pub struct SmartFallbackProvider {
    pub db: Arc<DbState>,
}

impl SmartFallbackProvider {
    pub fn new(db: Arc<DbState>) -> Self {
        Self { db }
    }
}

#[async_trait::async_trait]
impl AIProvider for SmartFallbackProvider {
    async fn prompt(&self, prompt: &str) -> Result<String, String> {
        let gemini = GeminiNanoProvider;
        match gemini.prompt(prompt).await {
            Ok(response) => Ok(response),
            Err(e) => {
                println!("[SmartProvider] Gemini failed ({}). Falling back to Ollama.", e);
                let ollama = OllamaProvider { db: self.db.clone() };
                ollama.prompt(prompt).await
            }
        }
    }
}
