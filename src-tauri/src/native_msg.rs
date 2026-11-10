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
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub tag: Option<String>,
    pub timestamp: u64,
    #[serde(default)]
    pub profileId: Option<String>,
    #[serde(default)]
    pub profileLabel: Option<String>,
    #[serde(default)]
    pub browserName: Option<String>,
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

pub fn send_native_json<T: Serialize>(payload: &T) {
    if let Ok(json_bytes) = serde_json::to_vec(payload) {
        let length = json_bytes.len() as u32;
        let mut stdout = std::io::stdout().lock();
        let _ = stdout.write_all(&length.to_ne_bytes());
        let _ = stdout.write_all(&json_bytes);
        let _ = stdout.flush();
    }
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
enum NativeHostMsg {
    Tab(TabPayload),
    Delete { url: Option<String>, title: Option<String>, profile_id: Option<String> },
    SyncExcludedDomains { entries: Vec<crate::db::ExclusionEntry> },
    GetExcludedDomains,
    GetSubSessions { request_id: String, date: Option<String>, profile_id: Option<String>, cursor: Option<String>, limit: usize },
    GetTopSites { request_id: String, date: Option<String>, profile_id: Option<String>, limit: usize },
    GetAvailableProfiles { request_id: String, date: Option<String> },
}

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
    let (tx, rx) = mpsc::channel::<NativeHostMsg>();
    
    // Spawn consumer thread
    let db_clone = db.clone();
    let parent_browser_clone = parent_browser.clone();
    let consumer_handle = thread::spawn(move || {
        let mut prev_event: Option<SubSessionEvent> = None;
        let mut prev_time: Option<chrono::DateTime<Utc>> = None;

        while let Ok(msg) = rx.recv() {
            let now = Utc::now();
            let is_incognito = db_clone.get_setting("incognito").unwrap_or_else(|_| "false".to_string()) == "true";
            let min_sub_session_duration = db_clone
                .get_setting("min_sub_session_duration")
                .unwrap_or_else(|_| "60".to_string())
                .parse::<i64>()
                .unwrap_or(60);

            match msg {
                NativeHostMsg::SyncExcludedDomains { entries } => {
                    let _ = db_clone.merge_excluded_entries(entries);
                    if let Ok(full_list) = db_clone.get_excluded_entries() {
                        let resp = serde_json::json!({
                            "event": "sync_excluded_domains",
                            "entries": full_list
                        });
                        send_native_json(&resp);
                    }
                }
                NativeHostMsg::GetExcludedDomains => {
                    if let Ok(full_list) = db_clone.get_excluded_entries() {
                        let resp = serde_json::json!({
                            "event": "sync_excluded_domains",
                            "entries": full_list
                        });
                        send_native_json(&resp);
                    }
                }
                NativeHostMsg::Delete { url, title, profile_id } => {
                    let _ = db_clone.delete_sub_session_event_by_uri_or_title_scoped(url.as_deref(), title.as_deref(), profile_id.as_deref());
                }
                NativeHostMsg::GetSubSessions { request_id, date, profile_id, cursor, limit } => {
                    let date_ref = date.as_deref();
                    let profile_ref = profile_id.as_deref();
                    let cursor_ref = cursor.as_deref();
                    match db_clone.get_sub_session_events_cursor(date_ref, profile_ref, cursor_ref, limit) {
                        Ok((events, next_cursor)) => {
                            let resp = serde_json::json!({
                                "event": "sub_sessions_response",
                                "requestId": request_id,
                                "items": events,
                                "nextCursor": next_cursor,
                            });
                            send_native_json(&resp);
                        }
                        Err(e) => {
                            let resp = serde_json::json!({
                                "event": "sub_sessions_response",
                                "requestId": request_id,
                                "error": e.to_string(),
                                "items": [],
                                "nextCursor": null,
                            });
                            send_native_json(&resp);
                        }
                    }
                }
                NativeHostMsg::GetTopSites { request_id, date, profile_id, limit } => {
                    let date_ref = date.as_deref();
                    let profile_ref = profile_id.as_deref();
                    match db_clone.get_top_sites_summary(date_ref, profile_ref, limit) {
                        Ok(entries) => {
                            let resp = serde_json::json!({
                                "event": "top_sites_response",
                                "requestId": request_id,
                                "entries": entries,
                            });
                            send_native_json(&resp);
                        }
                        Err(e) => {
                            let resp = serde_json::json!({
                                "event": "top_sites_response",
                                "requestId": request_id,
                                "error": e.to_string(),
                                "entries": [],
                            });
                            send_native_json(&resp);
                        }
                    }
                }
                NativeHostMsg::GetAvailableProfiles { request_id, date } => {
                    let date_ref = date.as_deref();
                    match db_clone.get_active_profiles_for_day(date_ref) {
                        Ok(profiles) => {
                            let list: Vec<serde_json::Value> = profiles.into_iter().map(|(pid, label, browser)| {
                                serde_json::json!({
                                    "profileId": pid,
                                    "profileLabel": label,
                                    "browserName": browser,
                                })
                            }).collect();
                            let resp = serde_json::json!({
                                "event": "available_profiles_response",
                                "requestId": request_id,
                                "profiles": list,
                            });
                            send_native_json(&resp);
                        }
                        Err(e) => {
                            let resp = serde_json::json!({
                                "event": "available_profiles_response",
                                "requestId": request_id,
                                "error": e.to_string(),
                                "profiles": [],
                            });
                            send_native_json(&resp);
                        }
                    }
                }
                NativeHostMsg::Tab(payload) => {
                    let domain = extract_domain(&payload.url);
                    if is_incognito || db_clone.is_domain_excluded(&domain) {
                        if let Some(prev) = prev_event.take() {
                            let duration = (now - prev_time.unwrap()).num_seconds();
                            if duration >= min_sub_session_duration {
                                let _ = db_clone.insert_sub_session_event(&prev);
                            }
                        }
                        if db_clone.is_domain_excluded(&domain) {
                            let _ = db_clone.set_setting("active_tab_url", "");
                            let _ = db_clone.set_setting("active_tab_title", "");
                            let _ = db_clone.set_setting("active_tab_favicon", "");
                            prev_event = None;
                            prev_time = None;
                        }
                        continue;
                    }
                    
                    // Sanitize URL (strip query parameters and hash fragments)
                    let sanitized_url = crate::domain_rules::sanitize_url(&payload.url);
                    // Sanitize title for search engines so query terms do not leak
                    let sanitized_title = crate::domain_rules::sanitize_page_title(&domain, &payload.title);

                    let _ = db_clone.set_setting("active_tab_url", &sanitized_url);
                    let _ = db_clone.set_setting("active_tab_title", &sanitized_title);
                    let _ = db_clone.set_setting("active_tab_favicon", &payload.favIconUrl.clone().unwrap_or_default());
                    let domain_tag = extract_domain(&sanitized_url);
                    
                    let event = SubSessionEvent {
                        session_type: "Browser".to_string(),
                        parent_app_name: payload.browserName.clone().or_else(|| Some(parent_browser_clone.clone())),
                        title: sanitized_title,
                        primary_uri: Some(sanitized_url),
                        icon_url: payload.favIconUrl,
                        context_tag: payload.tag.or_else(|| if domain_tag.is_empty() { None } else { Some(domain_tag) }),
                        metadata: payload.description.map(|d| {
                            let cleaned: String = d.chars()
                                .filter(|c| !c.is_control() || *c == ' ')
                                .collect();
                            if cleaned.chars().count() > 300 {
                                cleaned.chars().take(300).collect()
                            } else {
                                cleaned
                            }
                        }),
                        timestamp: now.to_rfc3339(),
                        id: None,
                        profile_id: payload.profileId.clone(),
                        profile_label: payload.profileLabel.clone(),
                        browser_name: payload.browserName.clone().or_else(|| Some(parent_browser_clone.clone())),
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
            }
        }

        // Output the final event without duration check, as connection is closing
        if let Some(prev) = prev_event.take() {
            if let Err(e) = db_clone.insert_sub_session_event(&prev) {
                eprintln!("Failed to insert final sub session event: {:?}", e);
            }
        }
    });

    const MAX_NATIVE_MSG_SIZE: usize = 10 * 1024 * 1024; // 10 MB limit
    let mut length_buffer = [0u8; 4];
    let mut stdin = io::stdin();

    while stdin.read_exact(&mut length_buffer).is_ok() {
        let message_length = u32::from_ne_bytes(length_buffer) as usize;
        if message_length == 0 {
            continue;
        }
        if message_length > MAX_NATIVE_MSG_SIZE {
            eprintln!("[native-host] Frame length {} exceeds maximum allowed limit", message_length);
            break;
        }
        
        let mut text_buffer = vec![0u8; message_length];
        if stdin.read_exact(&mut text_buffer).is_err() {
            break;
        }

        if let Ok(payload) = serde_json::from_slice::<serde_json::Value>(&text_buffer) {
            if let Some(event_type) = payload.get("event").and_then(|v| v.as_str()) {
                if event_type == "tab_activity" {
                    if let Ok(tab_payload) = serde_json::from_value::<TabPayload>(payload) {
                        let _ = tx.send(NativeHostMsg::Tab(tab_payload));
                    }
                } else if event_type == "delete_tab_activity" {
                    let url = payload.get("url").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let title = payload.get("title").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let profile_id = payload.get("profileId").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let _ = tx.send(NativeHostMsg::Delete { url, title, profile_id });
                } else if event_type == "get_sub_sessions" {
                    let request_id = payload.get("requestId").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let date = payload.get("date").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let profile_id = payload.get("profileId").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let cursor = payload.get("cursor").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let limit = payload.get("limit").and_then(|v| v.as_u64()).unwrap_or(25) as usize;
                    let _ = tx.send(NativeHostMsg::GetSubSessions { request_id, date, profile_id, cursor, limit });
                } else if event_type == "get_top_sites" {
                    let request_id = payload.get("requestId").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let date = payload.get("date").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let profile_id = payload.get("profileId").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let limit = payload.get("limit").and_then(|v| v.as_u64()).unwrap_or(5) as usize;
                    let _ = tx.send(NativeHostMsg::GetTopSites { request_id, date, profile_id, limit });
                } else if event_type == "get_available_profiles" {
                    let request_id = payload.get("requestId").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let date = payload.get("date").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let _ = tx.send(NativeHostMsg::GetAvailableProfiles { request_id, date });
                } else if event_type == "sync_excluded_domains" {
                    if let Some(entries_val) = payload.get("entries") {
                        if let Ok(entries) = serde_json::from_value::<Vec<crate::db::ExclusionEntry>>(entries_val.clone()) {
                            let _ = tx.send(NativeHostMsg::SyncExcludedDomains { entries });
                        }
                    }
                } else if event_type == "get_excluded_domains" {
                    let _ = tx.send(NativeHostMsg::GetExcludedDomains);
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
