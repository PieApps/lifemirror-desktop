use std::thread;
use std::time::Duration;
use std::sync::{Arc, Mutex};
use crate::db::{DbState, ActivityLog};
use chrono::Utc;

fn is_browser_app(app: &str) -> bool {
    let app_lower = app.to_lowercase();
    app_lower.contains("chrome") || 
    app_lower.contains("firefox") || 
    app_lower.contains("brave") || 
    app_lower.contains("safari") || 
    app_lower.contains("opera") || 
    app_lower.contains("chromium") || 
    app_lower.contains("edge")
}

fn extract_domain(url: &str) -> String {
    let without_protocol = if let Some(stripped) = url.strip_prefix("https://") {
        stripped
    } else if let Some(stripped) = url.strip_prefix("http://") {
        stripped
    } else {
        url
    };
    
    let end = without_protocol.find('/')
        .or_else(|| without_protocol.find('?'))
        .or_else(|| without_protocol.find(':'))
        .unwrap_or(without_protocol.len());
        
    let host = &without_protocol[..end];
    if let Some(stripped) = host.strip_prefix("www.") {
        stripped.to_string()
    } else {
        host.to_string()
    }
}

fn resolve_current_activity(db: &DbState) -> (String, String, Option<String>, Option<String>, String) {
    let (app, title) = get_active_window();
    if app.is_empty() && title.is_empty() {
        return (String::new(), String::new(), None, None, "OS".to_string());
    }
    
    if is_browser_app(&app) {
        let active_title = db.get_setting("active_tab_title").unwrap_or_default();
        let active_url = db.get_setting("active_tab_url").unwrap_or_default();
        let active_favicon = db.get_setting("active_tab_favicon").unwrap_or_default();
        
        let title_lower = title.to_lowercase();
        let active_title_lower = active_title.to_lowercase();
        
        if !active_url.is_empty() && (active_title.is_empty() || title_lower.contains(&active_title_lower) || active_title_lower.contains(&title_lower)) {
            return (
                app,
                active_title,
                Some(active_url),
                if active_favicon.is_empty() { None } else { Some(active_favicon) },
                "Browser".to_string()
            );
        }
    }
    
    (app, title, None, None, "OS".to_string())
}

pub fn start_window_tracker(
    db: Arc<DbState>,
    tracking_active: Arc<std::sync::atomic::AtomicBool>,
    active_activity: Arc<Mutex<Option<ActivityLog>>>,
) {
    thread::spawn(move || {
        let mut parent_app = String::new();
        let mut parent_title = String::new();
        let mut parent_start_time = Utc::now();
        let mut parent_duration = 0;
        let mut parent_source = "OS".to_string();
        let mut parent_url: Option<String> = None;
        let mut parent_icon_url: Option<String> = None;

        let mut temp_app = String::new();
        let mut temp_title = String::new();
        let mut temp_start_time = Utc::now();
        let mut temp_duration = 0;
        let mut temp_source = "OS".to_string();
        let mut temp_url: Option<String> = None;
        let mut temp_icon_url: Option<String> = None;

        loop {
            thread::sleep(Duration::from_secs(1));

            // Check if background tracking was toggled off (Atomic Cancellation)
            if !tracking_active.load(std::sync::atomic::Ordering::SeqCst) {
                if parent_duration > 0 {
                    if parent_duration >= 2 && !parent_app.is_empty() {
                        let log = ActivityLog {
                            id: None,
                            app_name: parent_app.clone(),
                            window_title: parent_title.clone(),
                            start_time: parent_start_time.to_rfc3339(),
                            duration: parent_duration,
                            source: parent_source.clone(),
                            url: parent_url.clone(),
                            icon_url: parent_icon_url.clone(),
                        };
                        let _ = db.insert_activity_log(&log);
                    }
                    parent_duration = 0;
                    parent_app.clear();
                    parent_title.clear();
                    parent_url = None;
                    parent_icon_url = None;
                }
                temp_duration = 0;
                temp_app.clear();
                temp_title.clear();
                temp_url = None;
                temp_icon_url = None;

                // Clear the shared active activity state
                {
                    let mut active_lock = active_activity.lock().unwrap();
                    *active_lock = None;
                }
                continue;
            }

            // Check if incognito mode is active; if so, clear active trace and skip DB writes
            let is_incognito = db.get_setting("incognito").unwrap_or_else(|_| "false".to_string()) == "true";
            if is_incognito {
                if parent_duration > 0 {
                    // Save active parent session if it was significant before incognito toggle
                    if parent_duration >= 2 && !parent_app.is_empty() {
                        let log = ActivityLog {
                            id: None,
                            app_name: parent_app.clone(),
                            window_title: parent_title.clone(),
                            start_time: parent_start_time.to_rfc3339(),
                            duration: parent_duration,
                            source: parent_source.clone(),
                            url: parent_url.clone(),
                            icon_url: parent_icon_url.clone(),
                        };
                        let _ = db.insert_activity_log(&log);
                    }
                    parent_duration = 0;
                    parent_app.clear();
                    parent_title.clear();
                    parent_url = None;
                    parent_icon_url = None;
                }
                temp_duration = 0;
                temp_app.clear();
                temp_title.clear();
                temp_url = None;
                temp_icon_url = None;

                // Clear the shared active activity state immediately (incognito security control)
                {
                    let mut active_lock = active_activity.lock().unwrap();
                    *active_lock = None;
                }
                continue;
            }

            let (app, title, url, icon_url, source) = resolve_current_activity(&db);
            if app.is_empty() && title.is_empty() {
                continue;
            }

            if parent_app.is_empty() {
                parent_app = app.clone();
                parent_title = title.clone();
                parent_url = url.clone();
                parent_icon_url = icon_url.clone();
                parent_source = source.clone();
                parent_start_time = Utc::now();
                parent_duration = 1;

                // Update the shared active activity state
                {
                    let mut active_lock = active_activity.lock().unwrap();
                    *active_lock = Some(ActivityLog {
                        id: None,
                        app_name: parent_app.clone(),
                        window_title: parent_title.clone(),
                        start_time: parent_start_time.to_rfc3339(),
                        duration: parent_duration,
                        source: parent_source.clone(),
                        url: parent_url.clone(),
                        icon_url: parent_icon_url.clone(),
                    });
                }
                continue;
            }

            // A focus change is detected if the app changes OR if the active tab URL changes for a browser
            let is_same_focus = app == parent_app 
                && (source != "Browser" 
                    || extract_domain(url.as_deref().unwrap_or("")) == extract_domain(parent_url.as_deref().unwrap_or("")));

            if is_same_focus {
                // If we returned to the parent focus, fold in any temporary session durations under 120 seconds
                if temp_duration > 0 {
                    if temp_duration < 120 {
                        parent_duration += temp_duration + 1;
                    } else {
                        parent_duration += 1;
                    }
                    temp_app.clear();
                    temp_title.clear();
                    temp_url = None;
                    temp_icon_url = None;
                    temp_duration = 0;
                } else {
                    parent_duration += 1;
                }
            } else {
                // We are in a different focus
                let is_same_temp = app == temp_app 
                    && (source != "Browser" 
                        || extract_domain(url.as_deref().unwrap_or("")) == extract_domain(temp_url.as_deref().unwrap_or("")));

                if is_same_temp {
                    temp_duration += 1;
                    if temp_duration >= 120 {
                        // The temporary focus matured into a major session (>= 2 minutes)!
                        // Save the old parent session
                        if parent_duration >= 2 && !parent_app.is_empty() {
                            let log = ActivityLog {
                                id: None,
                                app_name: parent_app.clone(),
                                window_title: parent_title.clone(),
                                start_time: parent_start_time.to_rfc3339(),
                                duration: parent_duration,
                                source: parent_source.clone(),
                                url: parent_url.clone(),
                                icon_url: parent_icon_url.clone(),
                            };
                            let _ = db.insert_activity_log(&log);
                        }
                        
                        // Promote the temp session to parent
                        parent_app = temp_app.clone();
                        parent_title = temp_title.clone();
                        parent_url = temp_url.clone();
                        parent_icon_url = temp_icon_url.clone();
                        parent_source = temp_source.clone();
                        parent_start_time = temp_start_time;
                        parent_duration = temp_duration;
                        
                        // Clear temp focus variables
                        temp_app.clear();
                        temp_title.clear();
                        temp_url = None;
                        temp_icon_url = None;
                        temp_duration = 0;
                    }
                } else {
                    // User switched to a new/different temporary focus!
                    // This means they did NOT return to the parent focus from the previous temp focus.
                    // Commit the previous parent session to DB immediately if it was significant.
                    if parent_duration >= 2 && !parent_app.is_empty() {
                        let log = ActivityLog {
                            id: None,
                            app_name: parent_app.clone(),
                            window_title: parent_title.clone(),
                            start_time: parent_start_time.to_rfc3339(),
                            duration: parent_duration,
                            source: parent_source.clone(),
                            url: parent_url.clone(),
                            icon_url: parent_icon_url.clone(),
                        };
                        let _ = db.insert_activity_log(&log);
                    }

                    // Promote the completed temporary focus to the new parent
                    if temp_duration > 0 && !temp_app.is_empty() {
                        parent_app = temp_app.clone();
                        parent_title = temp_title.clone();
                        parent_url = temp_url.clone();
                        parent_icon_url = temp_icon_url.clone();
                        parent_source = temp_source.clone();
                        parent_start_time = temp_start_time;
                        parent_duration = temp_duration;
                    } else {
                        parent_app.clear();
                        parent_duration = 0;
                    }
                    
                    // Initialize new temporary focus tracking
                    temp_app = app.clone();
                    temp_title = title.clone();
                    temp_url = url.clone();
                    temp_icon_url = icon_url.clone();
                    temp_source = source.clone();
                    temp_start_time = Utc::now();
                    temp_duration = 1;
                }
            }

            // Update the shared active activity state every second
            {
                let mut active_lock = active_activity.lock().unwrap();
                if parent_duration > 0 && !parent_app.is_empty() {
                    *active_lock = Some(ActivityLog {
                        id: None,
                        app_name: parent_app.clone(),
                        window_title: parent_title.clone(),
                        start_time: parent_start_time.to_rfc3339(),
                        duration: parent_duration,
                        source: parent_source.clone(),
                        url: parent_url.clone(),
                        icon_url: parent_icon_url.clone(),
                    });
                } else {
                    *active_lock = None;
                }
            }
        }
    });
}

pub fn get_active_window() -> (String, String) {
    // 1. Attempt Wayland compositor check
    if std::env::var("XDG_SESSION_TYPE").unwrap_or_default() == "wayland" {
        // Hyprland focus check
        if let Ok(output) = std::process::Command::new("hyprctl")
            .args(["activewindow", "-j"])
            .output() 
        {
            if output.status.success() {
                if let Ok(json) = serde_json::from_slice::<serde_json::Value>(&output.stdout) {
                    let app = json["class"].as_str().unwrap_or("").to_string();
                    let title = json["title"].as_str().unwrap_or("").to_string();
                    if !app.is_empty() || !title.is_empty() {
                        return (app, title);
                    }
                }
            }
        }
        
        // Sway tree focus check (parses swaymsg tree for focused container)
        if let Ok(output) = std::process::Command::new("swaymsg")
            .args(["-t", "get_tree"])
            .output() 
        {
            if output.status.success() {
                if let Ok(json) = serde_json::from_slice::<serde_json::Value>(&output.stdout) {
                    if let Some((app, title)) = find_focused_node_in_sway_tree(&json) {
                        return (app, title);
                    }
                }
            }
        }
    }

    // 2. Default to active-win-pos-rs crate check (cross-platform / X11)
    match active_win_pos_rs::get_active_window() {
        Ok(win) => (win.app_name, win.title),
        Err(_) => {
            // X11 tools fallback (xdotool)
            if let Ok(output) = std::process::Command::new("xdotool")
                .args(["getwindowfocus", "getwindowname"])
                .output() 
            {
                if output.status.success() {
                    let title = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    let app = if let Ok(class_out) = std::process::Command::new("xdotool")
                        .args(["getwindowfocus", "getwindowclassname"])
                        .output() 
                    {
                        String::from_utf8_lossy(&class_out.stdout).trim().to_string()
                    } else {
                        "Unknown".to_string()
                    };
                    return (app, title);
                }
            }
            ("Idle".to_string(), "No active focus".to_string())
        }
    }
}

// DFS to find focused node in Sway tree JSON dump
fn find_focused_node_in_sway_tree(node: &serde_json::Value) -> Option<(String, String)> {
    if node["focused"].as_bool().unwrap_or(false) {
        let name = node["name"].as_str().unwrap_or("").to_string();
        let app = node["app_id"].as_str()
            .or_else(|| node["window_properties"]["class"].as_str())
            .unwrap_or("Sway Window")
            .to_string();
        return Some((app, name));
    }
    if let Some(nodes) = node["nodes"].as_array() {
        for n in nodes {
            if let Some(res) = find_focused_node_in_sway_tree(n) {
                return Some(res);
            }
        }
    }
    if let Some(nodes) = node["floating_nodes"].as_array() {
        for n in nodes {
            if let Some(res) = find_focused_node_in_sway_tree(n) {
                return Some(res);
            }
        }
    }
    None
}
