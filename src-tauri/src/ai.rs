use std::thread;
use std::time::Duration;
use std::sync::Arc;
use crate::db::DbState;
use chrono::{DateTime, Utc};

pub fn start_idle_ai_summarizer(db: Arc<DbState>) {
    thread::spawn(move || {
        loop {
            // Check idle state every 30 seconds
            thread::sleep(Duration::from_secs(30));

            // Check if incognito mode is active; if so, skip AI generation
            let is_incognito = db.get_setting("incognito").unwrap_or_else(|_| "false".to_string()) == "true";
            if is_incognito {
                continue;
            }

            // Retrieve the latest log to see when the last activity occurred
            if let Ok(logs) = db.get_activity_logs(1) {
                if logs.is_empty() {
                    continue;
                }
                
                let latest_log = &logs[0];
                if let Ok(last_time) = DateTime::parse_from_rfc3339(&latest_log.start_time) {
                    let last_time_utc = last_time.with_timezone(&Utc);
                    let elapsed = Utc::now().signed_duration_since(last_time_utc).num_seconds();

                    // Idle threshold: 10 minutes (600 seconds)
                    if elapsed >= 600 {
                        // Check if we need to generate a new summary
                        let last_summary_time_str = db.get_setting("last_ai_reflection_time").unwrap_or_default();
                        let need_summary = if last_summary_time_str.is_empty() {
                            true
                        } else if let Ok(last_sum_time) = DateTime::parse_from_rfc3339(&last_summary_time_str) {
                            let last_sum_utc = last_sum_time.with_timezone(&Utc);
                            // If there is new activity since the last summary
                            last_sum_utc < last_time_utc
                        } else {
                            true
                        };

                        if need_summary {
                            trigger_background_reflection(db.clone());
                        }
                    }
                }
            }
        }
    });
}

fn trigger_background_reflection(db: Arc<DbState>) {
    thread::spawn(move || {
        // Lower thread priority to the minimum (nice 19) on Linux
        #[cfg(target_os = "linux")]
        unsafe {
            libc::setpriority(libc::PRIO_PROCESS, 0, 19);
        }

        println!("[Background AI] System idle threshold exceeded. Generating daily reflection card at low priority...");

        // Retrieve latest 10 activities for context
        let logs = match db.get_activity_logs(10) {
            Ok(l) => l,
            Err(_) => return,
        };

        if logs.is_empty() {
            return;
        }

        let summary_text = logs.iter().map(|node| {
            format!("- App: {}, Window: {}, Duration: {}s", node.app_name, node.window_title, node.duration)
        }).collect::<Vec<String>>().join("\n");

        let prompt = format!(
            "You are a personal productivity coach. Below is a list of my recent desktop focus logs. Analyze them and provide a concise, beautiful 2-sentence summary/reflection highlighting my focus. Do not mention that you are compiling a list.\n\nActivity logs:\n{}\n\nResponse (Strictly max 2 sentences):",
            summary_text
        );

        let ollama_model = db.get_setting("ollama_model").unwrap_or_else(|_| "llama3.2".to_string());
        let ollama_url = db.get_setting("ollama_url").unwrap_or_else(|_| "http://localhost:11434".to_string());

        // Prepare JSON payload
        let payload = serde_json::json!({
            "model": ollama_model,
            "prompt": prompt,
            "stream": false
        });

        // Run local curl command to send request to local Ollama
        let output = std::process::Command::new("curl")
            .args([
                "-s",
                "-X", "POST",
                &format!("{}/api/generate", ollama_url),
                "-H", "Content-Type: application/json",
                "-d", &payload.to_string(),
            ])
            .output();

        match output {
            Ok(out) if out.status.success() => {
                if let Ok(response_json) = serde_json::from_slice::<serde_json::Value>(&out.stdout) {
                    if let Some(reflection) = response_json["response"].as_str() {
                        let now_str = Utc::now().to_rfc3339();
                        let _ = db.set_setting("last_ai_reflection", reflection);
                        let _ = db.set_setting("last_ai_reflection_time", &now_str);
                        println!("[Background AI] Successfully generated reflection card: \"{}\"", reflection);
                    }
                }
            }
            _ => {
                eprintln!("[Background AI] Failed to contact local Ollama instance via curl.");
            }
        }
    });
}
