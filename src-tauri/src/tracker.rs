use std::thread;
use std::time::Duration;
use std::sync::Arc;
use crate::db::{DbState, ActivityLog};
use chrono::Utc;
pub fn start_window_tracker(db: Arc<DbState>) {
    thread::spawn(move || {
        let mut parent_app = String::new();
        let mut parent_title = String::new();
        let mut parent_start_time = Utc::now();
        let mut parent_duration = 0;

        let mut temp_app = String::new();
        let mut temp_title = String::new();
        let mut temp_start_time = Utc::now();
        let mut temp_duration = 0;

        loop {
            thread::sleep(Duration::from_secs(1));

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
                            source: "OS".to_string(),
                            url: None,
                        };
                        let _ = db.insert_activity_log(&log);
                    }
                    parent_duration = 0;
                    parent_app.clear();
                    parent_title.clear();
                }
                temp_duration = 0;
                temp_app.clear();
                temp_title.clear();
                continue;
            }

            let (app, title) = get_active_window();
            if app.is_empty() && title.is_empty() {
                continue;
            }

            if parent_app.is_empty() {
                parent_app = app.clone();
                parent_title = title.clone();
                parent_start_time = Utc::now();
                parent_duration = 1;
                continue;
            }

            if app == parent_app {
                // If we returned to the parent app, fold in any temporary session durations under 120 seconds
                if temp_duration > 0 {
                    if temp_duration < 120 {
                        parent_duration += temp_duration + 1;
                    } else {
                        parent_duration += 1;
                    }
                    temp_app.clear();
                    temp_title.clear();
                    temp_duration = 0;
                } else {
                    parent_duration += 1;
                }
            } else {
                // We are in a different app focus
                if app == temp_app {
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
                                source: "OS".to_string(),
                                url: None,
                            };
                            let _ = db.insert_activity_log(&log);
                        }
                        
                        // Promote the temp session to parent
                        parent_app = temp_app.clone();
                        parent_title = temp_title.clone();
                        parent_start_time = temp_start_time;
                        parent_duration = temp_duration;
                        
                        // Clear temp focus variables
                        temp_app.clear();
                        temp_title.clear();
                        temp_duration = 0;
                    }
                } else {
                    // User switched to a new/different temporary app focus!
                    // Merge the previous temporary focus into the parent if it was < 120 seconds
                    if temp_duration > 0 && temp_duration < 120 {
                        parent_duration += temp_duration;
                    }
                    
                    // Initialize new temporary focus tracking
                    temp_app = app.clone();
                    temp_title = title.clone();
                    temp_start_time = Utc::now();
                    temp_duration = 1;
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
