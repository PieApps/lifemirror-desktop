use std::io::{self, Read, Write};
use serde::{Deserialize, Serialize};
use crate::db::{extract_domain, DbState, OsKeyStore, SubSessionEvent, VaultError, VaultLock};
use chrono::Utc;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::mpsc;
use std::thread;

#[derive(Serialize, Deserialize, Debug, Clone)]
#[allow(non_snake_case)]
pub struct TabPayload {
    pub event: String,
    pub url: String,
    pub title: String,
    pub favIconUrl: Option<String>,
    pub timestamp: u64,
}

pub fn format_native_error_response(error_code: &str, message: &str) -> Vec<u8> {
    let resp = serde_json::json!({
        "error": error_code,
        "message": message,
    });
    let json_bytes = serde_json::to_vec(&resp).unwrap_or_default();
    let length = json_bytes.len() as u32;
    let mut out = Vec::with_capacity(4 + json_bytes.len());
    out.extend_from_slice(&length.to_ne_bytes());
    out.extend_from_slice(&json_bytes);
    out
}

pub fn send_native_error_response(error_code: &str, message: &str) {
    let bytes = format_native_error_response(error_code, message);
    let mut stdout = std::io::stdout().lock();
    let _ = stdout.write_all(&bytes);
    let _ = stdout.flush();
}

#[cfg(target_os = "linux")]
fn detect_parent_browser() -> String {
    let ppid = unsafe { libc::getppid() };
    if let Ok(comm) = std::fs::read_to_string(format!("/proc/{ppid}/comm")) {
        let comm_lower = comm.to_lowercase();
        if comm_lower.contains("brave") {
            return "Brave".to_string();
        } else if comm_lower.contains("edge") {
            return "Edge".to_string();
        } else if comm_lower.contains("chromium") {
            return "Chromium".to_string();
        } else if comm_lower.contains("chrome") {
            return "Chrome".to_string();
        }
    }
    if let Ok(cmdline) = std::fs::read_to_string(format!("/proc/{ppid}/cmdline")) {
        let cmd_lower = cmdline.to_lowercase();
        if cmd_lower.contains("brave") {
            return "Brave".to_string();
        } else if cmd_lower.contains("edge") {
            return "Edge".to_string();
        } else if cmd_lower.contains("chromium") {
            return "Chromium".to_string();
        } else if cmd_lower.contains("chrome") {
            return "Chrome".to_string();
        }
    }
    "Chrome".to_string()
}

#[cfg(not(target_os = "linux"))]
fn detect_parent_browser() -> String {
    "Chrome".to_string()
}

// Check if the application was started in native host mode and process stdin events
pub fn run_native_host_loop(db_path: PathBuf) -> io::Result<()> {
    let db_dir = db_path.parent().unwrap_or(&db_path);

    // 1. Acquire shared read/append lock
    let _lock = match VaultLock::try_shared(db_dir) {
        Ok(l) => l,
        Err(VaultError::VaultBusy) => {
            
            eprintln!("[native-host] Vault is busy (migration/backup in progress)");
            send_native_error_response(
                "vault_busy",
                "LifeMirror vault is busy (migration or backup in progress). Please wait.",
            );
            return Ok(());
        }
        Err(e) => {
            eprintln!("[native-host] Failed to acquire lock: {e}");
            send_native_error_response("vault_error", &format!("Lock error: {e}"));
            return Ok(());
        }
    };

    // 2. Open existing database read-only/append mode (no migrations, no rekeying, no file creation)
    let key_store = OsKeyStore::new();
    let db = match DbState::open_existing(&db_path, &key_store) {
        Ok(state) => Arc::new(state),
        Err(VaultError::CannotUnlockDatabase) => {
            eprintln!("[native-host] Cannot unlock database with available credentials");
            send_native_error_response(
                "vault_locked",
                "LifeMirror vault is locked. Please open the desktop application.",
            );
            return Ok(());
        }
        Err(VaultError::VaultNotFound(_)) => {
            eprintln!("[native-host] Database file does not exist yet");
            send_native_error_response(
                "vault_missing",
                "LifeMirror database not found. Please open the desktop application.",
            );
            return Ok(());
        }
        Err(VaultError::NeedsUpgrade) => {
            eprintln!("[native-host] Database requires migration by the desktop application");
            send_native_error_response(
                "vault_needs_upgrade",
                "LifeMirror database requires upgrade. Please open the desktop application.",
            );
            return Ok(());
        }
        Err(e) => {
            eprintln!("[native-host] Database open error: {e}");
            send_native_error_response("vault_error", &format!("Database error: {e}"));
            return Ok(());
        }
    };
    let parent_browser = detect_parent_browser();
    // Create FIFO queue channel for database writes
    let (tx, rx) = mpsc::channel::<TabPayload>();
    
    // Spawn consumer thread
    let db_clone = db.clone();
    let parent_browser_clone = parent_browser.clone();
    let consumer_handle = thread::spawn(move || {
        let mut prev_event: Option<SubSessionEvent> = None;
        let mut prev_time: Option<chrono::DateTime<Utc>> = None;

        while let Ok(payload) = rx.recv() {
            let is_incognito = db_clone.get_setting("incognito").unwrap_or_else(|_| "false".to_string()) == "true";
            let now = Utc::now();
            let min_sub_session_duration = db_clone
                .get_setting("min_sub_session_duration")
                .unwrap_or_else(|_| "60".to_string())
                .parse::<i64>()
                .unwrap_or(60);
            
            if is_incognito {
                if let Some(prev) = prev_event.take() {
                    let duration = (now - prev_time.unwrap()).num_seconds();
                    if duration >= min_sub_session_duration {
                        let _ = db_clone.insert_sub_session_event(&prev);
                    }
                }
                continue;
            }
            
            // Not incognito
            let _ = db_clone.set_setting("active_tab_url", &payload.url);
            let _ = db_clone.set_setting("active_tab_title", &payload.title);
            let _ = db_clone.set_setting("active_tab_favicon", &payload.favIconUrl.clone().unwrap_or_default());
            let domain_tag = extract_domain(&payload.url);
            
            let event = SubSessionEvent {
                id: None,
                session_type: "Browser".to_string(),
                parent_app_name: Some(parent_browser_clone.clone()),
                title: payload.title,
                primary_uri: Some(payload.url),
                icon_url: payload.favIconUrl,
                context_tag: if domain_tag.is_empty() { None } else { Some(domain_tag) },
                metadata: None,
                timestamp: now.to_rfc3339(),
            };

            // Process previous event
            if let Some(prev) = prev_event.take() {
                let duration = (now - prev_time.unwrap()).num_seconds();
                if duration >= min_sub_session_duration {
                    if let Err(e) = db_clone.insert_sub_session_event(&prev) {
                        eprintln!("Failed to insert sub session event: {:?}", e);
                    }
                }
            }
            
            prev_event = Some(event);
            prev_time = Some(now);
        }

        // Output the final event without duration check, as connection is closing
        if let Some(prev) = prev_event.take() {
            if let Err(e) = db_clone.insert_sub_session_event(&prev) {
                eprintln!("Failed to insert final sub session event: {:?}", e);
            }
        }
    });

    let mut length_buffer = [0u8; 4];
    let mut stdin = io::stdin();

    while stdin.read_exact(&mut length_buffer).is_ok() {
        let message_length = u32::from_ne_bytes(length_buffer) as usize;
        if message_length == 0 {
            continue;
        }
        
        let mut text_buffer = vec![0u8; message_length];
        if stdin.read_exact(&mut text_buffer).is_err() {
            break;
        }

        if let Ok(payload) = serde_json::from_slice::<serde_json::Value>(&text_buffer) {
            if let Some(event_type) = payload.get("event").and_then(|v| v.as_str()) {
                if event_type == "tab_activity" {
                    if let Ok(tab_payload) = serde_json::from_value::<TabPayload>(payload) {
                        let _ = tx.send(tab_payload);
                    }
                }
            }
        }
    }

    // Drop the sender so receiver loops terminate naturally
    drop(tx);

    // Wait for the consumer thread to finish writing all queued events
    if let Err(e) = consumer_handle.join() {
        eprintln!("Consumer thread panicked on shutdown: {:?}", e);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_native_error_response() {
        let bytes = format_native_error_response("vault_locked", "Test locked message");
        assert!(bytes.len() > 4);
        let len_bytes: [u8; 4] = bytes[0..4].try_into().unwrap();
        let payload_len = u32::from_ne_bytes(len_bytes) as usize;
        assert_eq!(bytes.len() - 4, payload_len);

        let parsed: serde_json::Value = serde_json::from_slice(&bytes[4..]).unwrap();
        assert_eq!(parsed["error"], "vault_locked");
        assert_eq!(parsed["message"], "Test locked message");
    }
}
