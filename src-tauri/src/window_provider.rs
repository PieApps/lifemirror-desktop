use std::path::PathBuf;
use std::process::Command;
use serde_json::Value;


pub struct WindowInfo {
    pub app_name: String,
    pub title: String,
    pub process_path: Option<PathBuf>,
}

pub trait WindowProvider: Send + Sync {
    fn get_active_window(&self) -> Option<WindowInfo>;
}

pub struct HyprlandProvider;
impl WindowProvider for HyprlandProvider {
    fn get_active_window(&self) -> Option<WindowInfo> {
        if let Ok(output) = Command::new("hyprctl").args(["activewindow", "-j"]).output() {
            if output.status.success() {
                if let Ok(json) = serde_json::from_slice::<Value>(&output.stdout) {
                    let app = json["class"].as_str().unwrap_or("").to_string();
                    let title = json["title"].as_str().unwrap_or("").to_string();
                    if !app.is_empty() || !title.is_empty() {
                        return Some(WindowInfo { app_name: app, title, process_path: None });
                    }
                }
            }
        }
        None
    }
}

pub struct SwayProvider;
impl WindowProvider for SwayProvider {
    fn get_active_window(&self) -> Option<WindowInfo> {
        if let Ok(output) = Command::new("swaymsg").args(["-t", "get_tree"]).output() {
            if output.status.success() {
                if let Ok(json) = serde_json::from_slice::<Value>(&output.stdout) {
                    if let Some((app, title)) = find_focused_node_in_sway_tree(&json) {
                        return Some(WindowInfo { app_name: app, title, process_path: None });
                    }
                }
            }
        }
        None
    }
}

// DFS to find focused node in Sway tree JSON dump
fn find_focused_node_in_sway_tree(node: &Value) -> Option<(String, String)> {
    if node["focused"].as_bool().unwrap_or(false) {
        let name = node["name"].as_str().unwrap_or("").to_string();
        let app = node["app_id"]
            .as_str()
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

pub struct FallbackProvider;
impl WindowProvider for FallbackProvider {
    fn get_active_window(&self) -> Option<WindowInfo> {
        match active_win_pos_rs::get_active_window() {
            Ok(win) => Some(WindowInfo {
                app_name: win.app_name,
                title: win.title,
                process_path: Some(PathBuf::from(win.process_path)),
            }),
            Err(_) => {
                // X11 tools fallback (xdotool)
                if let Ok(output) = Command::new("xdotool")
                    .args(["getwindowfocus", "getwindowname"])
                    .output()
                {
                    if output.status.success() {
                        let title = String::from_utf8_lossy(&output.stdout).trim().to_string();
                        let app = if let Ok(class_out) = Command::new("xdotool")
                            .args(["getwindowfocus", "getwindowclassname"])
                            .output()
                        {
                            String::from_utf8_lossy(&class_out.stdout)
                                .trim()
                                .to_string()
                        } else {
                            "Unknown".to_string()
                        };
                        return Some(WindowInfo {
                            app_name: app,
                            title,
                            process_path: None,
                        });
                    }
                }
                None
            }
        }
    }
}

pub fn detect_environment() -> Box<dyn WindowProvider> {
    #[cfg(target_os = "linux")]
    return detect_linux_environment();

    #[cfg(not(target_os = "linux"))]
    return Box::new(FallbackProvider);
}

#[cfg(target_os = "linux")]
fn detect_linux_environment() -> Box<dyn WindowProvider> {
    use crate::providers::linux::{KdeProvider, GnomeExtensionProvider};

    let session_type = std::env::var("XDG_SESSION_TYPE").unwrap_or_default().to_lowercase();
    let current_desktop = std::env::var("XDG_CURRENT_DESKTOP").unwrap_or_default().to_lowercase();

    if session_type == "wayland" {
        if current_desktop.contains("kde") || current_desktop.contains("plasma") {
            return Box::new(KdeProvider);
        } else if current_desktop.contains("gnome") || current_desktop.contains("ubuntu") {
            return Box::new(GnomeExtensionProvider);
        } else if current_desktop.contains("hyprland") {
            return Box::new(HyprlandProvider);
        } else if current_desktop.contains("sway") {
            return Box::new(SwayProvider);
        }
    }

    Box::new(FallbackProvider)
}
