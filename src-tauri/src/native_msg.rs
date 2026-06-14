use std::io::{self, Read};
use serde::{Deserialize, Serialize};
use crate::db::{DbState, ActivityLog};
use chrono::Utc;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TabPayload {
    pub event: String,
    pub url: String,
    pub title: String,
    pub timestamp: u64,
}

// Check if the application was started in native host mode and process stdin events
pub fn run_native_host_loop(db_path: PathBuf) -> io::Result<()> {
    // Initialize DB connection for this process
    let db = DbState::new(db_path);
    
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
            // Check if incognito mode is active via SQLite settings table
            let is_incognito = db.get_setting("incognito").unwrap_or_else(|_| "false".to_string()) == "true";
            
            if !is_incognito {
                let log = ActivityLog {
                    id: None,
                    app_name: "Chrome".to_string(),
                    window_title: payload.title,
                    start_time: Utc::now().to_rfc3339(),
                    duration: 1, // Will be aggregated in database queries
                    source: "Browser".to_string(),
                    url: Some(payload.url),
                };
                
                // Insert tab activity log
                if let Err(e) = db.insert_activity_log(&log) {
                    eprintln!("Failed to insert browser log: {:?}", e);
                }
            }
        }
    }
    Ok(())
}
