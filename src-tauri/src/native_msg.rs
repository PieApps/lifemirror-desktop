use std::io::{self, Read};
use serde::{Deserialize, Serialize};
use crate::db::{extract_domain, BrowserTabEvent, DbState};
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

// Check if the application was started in native host mode and process stdin events
pub fn run_native_host_loop(db_path: PathBuf) -> io::Result<()> {
    // Initialize DB connection for this process
    let db = Arc::new(DbState::new(db_path));
    
    // Create FIFO queue channel
    let (tx, rx) = mpsc::channel::<TabPayload>();
    
    // Spawn consumer thread
    let db_clone = db.clone();
    let consumer_handle = thread::spawn(move || {
        while let Ok(payload) = rx.recv() {
            // Check if incognito mode is active via SQLite settings table
            let is_incognito = db_clone.get_setting("incognito").unwrap_or_else(|_| "false".to_string()) == "true";
            
            if !is_incognito {
                // Update local settings with active tab info
                let _ = db_clone.set_setting("active_tab_url", &payload.url);
                let _ = db_clone.set_setting("active_tab_title", &payload.title);
                let _ = db_clone.set_setting("active_tab_favicon", &payload.favIconUrl.clone().unwrap_or_default());
                let domain_tag = extract_domain(&payload.url);
                
                let event = BrowserTabEvent {
                    id: None,
                    url: payload.url,
                    title: payload.title,
                    favicon_url: payload.favIconUrl,
                    domain: if domain_tag.is_empty() { None } else { Some(domain_tag) },
                    timestamp: Utc::now().to_rfc3339(),
                    browser_name: Some("Chrome".to_string()),
                };
                
                // Insert tab activity event to browser_tab_events
                if let Err(e) = db_clone.insert_browser_tab_event(&event) {
                    eprintln!("Failed to insert browser tab event: {:?}", e);
                }
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

        if let Ok(payload) = serde_json::from_slice::<TabPayload>(&text_buffer) {
            let _ = tx.send(payload);
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
