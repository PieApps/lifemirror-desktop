use std::io::{self, Read};
use serde::{Deserialize, Serialize};
use crate::db::{extract_domain, SubSessionEvent, DbState};
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
    // Initialize DB connection for this process
    let db = Arc::new(DbState::new(db_path));
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
