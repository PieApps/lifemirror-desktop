use crate::db::{extract_domain, ActivityLog, DbState, SubSessionEvent};
use chrono::Utc;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::Duration;

static ICON_CACHE: OnceLock<Mutex<HashMap<String, Option<String>>>> = OnceLock::new();

fn normalize_icon_key(value: &str) -> String {
    value
        .to_lowercase()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect()
}

fn desktop_entry_matches(contents: &str, app_key: &str, process_name: &str) -> bool {
    for line in contents.lines() {
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        if matches!(key, "Name" | "StartupWMClass" | "Exec") {
            let value_key = normalize_icon_key(value);
            if !app_key.is_empty() && value_key.contains(app_key) {
                return true;
            }
            if !process_name.is_empty() && value_key.contains(process_name) {
                return true;
            }
        }
    }
    false
}

fn extract_desktop_icon_name(contents: &str) -> Option<String> {
    contents.lines().find_map(|line| {
        line.strip_prefix("Icon=")
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
    })
}

fn icon_theme_dirs() -> Vec<PathBuf> {
    let mut dirs = vec![
        PathBuf::from("/usr/share/icons/hicolor"),
        PathBuf::from("/usr/share/icons/Adwaita"),
        PathBuf::from("/usr/share/icons"),
        PathBuf::from("/usr/share/pixmaps"),
    ];
    if let Ok(home) = std::env::var("HOME") {
        dirs.insert(0, PathBuf::from(home).join(".local/share/icons"));
    }
    dirs
}

fn resolve_icon_file(icon_name: &str) -> Option<String> {
    let icon_path = Path::new(icon_name);
    if icon_path.is_absolute() && icon_path.exists() {
        return Some(icon_name.to_string());
    }

    let candidates = [
        format!("{icon_name}.png"),
        format!("{icon_name}.svg"),
        format!("{icon_name}.xpm"),
        icon_name.to_string(),
    ];

    for root in icon_theme_dirs() {
        if !root.exists() {
            continue;
        }
        let mut stack = vec![root];
        while let Some(dir) = stack.pop() {
            let Ok(entries) = std::fs::read_dir(&dir) else {
                continue;
            };
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    stack.push(path);
                    continue;
                }
                if let Some(file_name) = path.file_name().and_then(|name| name.to_str()) {
                    if candidates
                        .iter()
                        .any(|candidate| file_name.eq_ignore_ascii_case(candidate))
                    {
                        return Some(path.to_string_lossy().to_string());
                    }
                }
            }
        }
    }

    None
}

fn resolve_app_icon(app: &str, process_path: Option<&Path>) -> Option<String> {
    let app_key = normalize_icon_key(app);
    let process_name = process_path
        .and_then(|path| path.file_stem())
        .and_then(|name| name.to_str())
        .map(normalize_icon_key)
        .unwrap_or_default();
    let cache_key = format!("{app_key}:{process_name}");
    let cache = ICON_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    if let Some(cached) = cache.lock().unwrap().get(&cache_key).cloned() {
        return cached;
    }

    let mut desktop_dirs = vec![PathBuf::from("/usr/share/applications")];
    if let Ok(home) = std::env::var("HOME") {
        desktop_dirs.insert(0, PathBuf::from(home).join(".local/share/applications"));
    }

    for dir in desktop_dirs {
        let Ok(entries) = std::fs::read_dir(dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|ext| ext.to_str()) != Some("desktop") {
                continue;
            }
            let Ok(contents) = std::fs::read_to_string(&path) else {
                continue;
            };
            let file_key = path
                .file_stem()
                .and_then(|name| name.to_str())
                .map(normalize_icon_key)
                .unwrap_or_default();
            let file_matches = (!app_key.is_empty() && file_key.contains(&app_key))
                || (!process_name.is_empty() && file_key.contains(&process_name));
            if file_matches || desktop_entry_matches(&contents, &app_key, &process_name) {
                if let Some(icon_name) = extract_desktop_icon_name(&contents) {
                    if let Some(icon_file) = resolve_icon_file(&icon_name) {
                        cache
                            .lock()
                            .unwrap()
                            .insert(cache_key, Some(icon_file.clone()));
                        return Some(icon_file);
                    }
                }
            }
        }
    }

    cache.lock().unwrap().insert(cache_key, None);
    None
}

fn is_browser_app(app: &str) -> bool {
    let app_lower = app.to_lowercase();
    app_lower.contains("chrome")
        || app_lower.contains("firefox")
        || app_lower.contains("brave")
        || app_lower.contains("safari")
        || app_lower.contains("opera")
        || app_lower.contains("chromium")
        || app_lower.contains("edge")
}

fn is_editor_app(app: &str) -> bool {
    let app_lower = app.to_lowercase();
    app_lower.contains("code")
        || app_lower.contains("cursor")
        || app_lower.contains("intellij")
        || app_lower.contains("sublime")
        || app_lower.contains("zed")
        || app_lower.contains("studio")
        || app_lower.contains("eclipse")
        || app_lower.contains("webstorm")
        || app_lower.contains("pycharm")
        || app_lower.contains("rider")
        || app_lower.contains("clion")
}

fn parse_editor_title(title: &str) -> (String, String) {
    let mut parts: Vec<&str> = title.split(" - ").collect();
    if parts.len() == 1 {
        parts = title.split(" – ").collect();
    }
    if parts.len() == 1 {
        parts = title.split(" — ").collect();
    }

    if parts.len() >= 3 {
        (parts[0].trim().to_string(), parts[1].trim().to_string())
    } else if parts.len() == 2 {
        (parts[0].trim().to_string(), parts[1].trim().to_string())
    } else {
        (title.trim().to_string(), String::new())
    }
}

use crate::window_provider::WindowProvider;

fn resolve_current_activity(
    db: &DbState,
    provider: &dyn WindowProvider,
) -> (String, String, Option<String>, Option<String>, String) {
    let (app, title, app_icon) = match provider.get_active_window() {
        Some(info) => {
            let icon = resolve_app_icon(&info.app_name, info.process_path.as_deref());
            (info.app_name, info.title, icon)
        }
        None => (String::new(), String::new(), None)
    };
    
    if app.is_empty() && title.is_empty() {
        return (String::new(), String::new(), None, None, "OS".to_string());
    }

    if is_browser_app(&app) {
        let active_title = db.get_setting("active_tab_title").unwrap_or_default();
        let active_url = db.get_setting("active_tab_url").unwrap_or_default();
        let active_favicon = db.get_setting("active_tab_favicon").unwrap_or_default();

        let title_lower = title.to_lowercase();
        let active_title_lower = active_title.to_lowercase();

        if !active_url.is_empty()
            && (active_title.is_empty()
                || title_lower.contains(&active_title_lower)
                || active_title_lower.contains(&title_lower))
        {
            return (
                app,
                active_title,
                Some(active_url),
                if active_favicon.is_empty() {
                    None
                } else {
                    Some(active_favicon)
                },
                "Browser".to_string(),
            );
        }
    }

    if is_editor_app(&app) {
        let icon_url = app_icon.or_else(|| resolve_app_icon(&app, None));
        return (app, title, None, icon_url, "Editor".to_string());
    }

    let icon_url = app_icon.or_else(|| resolve_app_icon(&app, None));
    (app, title, None, icon_url, "OS".to_string())
}

pub fn start_window_tracker(
    db: Arc<DbState>,
    tracking_active: Arc<std::sync::atomic::AtomicBool>,
    active_activity: Arc<Mutex<Option<ActivityLog>>>,
    app_handle: tauri::AppHandle,
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

        let mut editor_sub_title = String::new();
        let mut editor_sub_start_time = Utc::now();
        let mut editor_sub_duration = 0;

        let mut compiled_rules: Vec<(String, regex::Regex)> = Vec::new();
        let mut last_rule_check = std::time::Instant::now() - Duration::from_secs(10);

        let mut current_distraction_app = String::new();
        let mut current_distraction_title = String::new();
        let mut current_distraction_id: Option<i64> = None;

        let llm_cache: Arc<std::sync::Mutex<std::collections::HashMap<String, bool>>> = Arc::new(std::sync::Mutex::new(std::collections::HashMap::new()));
        let pending_evaluations: Arc<std::sync::Mutex<std::collections::HashSet<String>>> = Arc::new(std::sync::Mutex::new(std::collections::HashSet::new()));
        let has_shown_fullscreen = Arc::new(std::sync::Mutex::new(false));

        let db_ref = db.clone();
        let flush_editor_event = |duration: i64, title: &str, start_time: chrono::DateTime<Utc>, parent_app: &str, icon_url: Option<String>, min_dur: i64| {
            if duration >= min_dur && !title.is_empty() {
                let (primary_uri, context_tag) = parse_editor_title(title);
                let _ = db_ref.insert_sub_session_event(&SubSessionEvent {
                    id: None,
                    session_type: "Editor".to_string(),
                    parent_app_name: Some(parent_app.to_string()),
                    title: title.to_string(),
                    primary_uri: Some(primary_uri),
                    icon_url,
                    context_tag: if context_tag.is_empty() { None } else { Some(context_tag) },
                    metadata: None,
                    timestamp: start_time.to_rfc3339(),
                });
            }
        };

        let provider = crate::window_provider::detect_environment();

        loop {
            thread::sleep(Duration::from_secs(1));

            let mut min_log_duration = db
                .get_setting("min_log_duration")
                .unwrap_or_else(|_| "60".to_string())
                .parse::<i64>()
                .unwrap_or(60);
            if min_log_duration < 60 {
                min_log_duration = 60;
            }

            let min_sub_session_duration = db
                .get_setting("min_sub_session_duration")
                .unwrap_or_else(|_| "60".to_string())
                .parse::<i64>()
                .unwrap_or(60);

            // Check if background tracking was toggled off (Atomic Cancellation)
            if !tracking_active.load(std::sync::atomic::Ordering::SeqCst) {
                if parent_duration > 0 {
                    if parent_duration >= min_log_duration && !parent_app.is_empty() {
                        let log = ActivityLog {
                            id: None,
                            app_name: parent_app.clone(),
                            window_title: parent_title.clone(),
                            start_time: parent_start_time.to_rfc3339(),
                            duration: parent_duration,
                            source: parent_source.clone(),
                            url: parent_url.clone(),
                            icon_url: parent_icon_url.clone(),
                            domain_tag: if parent_source == "Browser" {
                                parent_url.as_deref().map(extract_domain).filter(|d| !d.is_empty())
                            } else {
                                None
                            },
                            notes: None,
                        };
                        let _ = db.insert_activity_log(&log);
                    }
                    if parent_source == "Editor" {
                        flush_editor_event(editor_sub_duration, &editor_sub_title, editor_sub_start_time, &parent_app, parent_icon_url.clone(), min_sub_session_duration);
                        editor_sub_duration = 0;
                        editor_sub_title.clear();
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
            let is_incognito = db
                .get_setting("incognito")
                .unwrap_or_else(|_| "false".to_string())
                == "true";
            if is_incognito {
                if parent_duration > 0 {
                    // Save active parent session if it was significant before incognito toggle
                    if parent_duration >= min_log_duration && !parent_app.is_empty() {
                        let log = ActivityLog {
                            id: None,
                            app_name: parent_app.clone(),
                            window_title: parent_title.clone(),
                            start_time: parent_start_time.to_rfc3339(),
                            duration: parent_duration,
                            source: parent_source.clone(),
                            url: parent_url.clone(),
                            icon_url: parent_icon_url.clone(),
                            domain_tag: if parent_source == "Browser" {
                                parent_url.as_deref().map(extract_domain).filter(|d| !d.is_empty())
                            } else {
                                None
                            },
                            notes: None,
                        };
                        let _ = db.insert_activity_log(&log);
                    }
                    if parent_source == "Editor" {
                        flush_editor_event(editor_sub_duration, &editor_sub_title, editor_sub_start_time, &parent_app, parent_icon_url.clone(), min_sub_session_duration);
                        editor_sub_duration = 0;
                        editor_sub_title.clear();
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

            let (app, title, url, icon_url, source) = resolve_current_activity(&db, provider.as_ref());
            if app.is_empty() && title.is_empty() {
                continue;
            }
            
            use tauri::{Manager, Emitter};

            // Distraction evaluation
            let mut is_distracted = false;
            let mut distraction_type: Option<String> = None;
            let mut distraction_reason: Option<String> = None;
            
            let intention = db.get_setting("active_intention").unwrap_or_else(|_| "false".to_string());
            let is_focus_mode_active = intention != "false" && !intention.is_empty();

            if is_focus_mode_active {
                if last_rule_check.elapsed() > Duration::from_secs(5) {
                    let rules = db.get_distraction_rules().unwrap_or_default();
                    compiled_rules.clear();
                    for r in rules {
                        if let Ok(re) = regex::Regex::new(&r) {
                            compiled_rules.push((r, re));
                        }
                    }
                    last_rule_check = std::time::Instant::now();
                }

                for (r, re) in &compiled_rules {
                    if re.is_match(&title) {
                        is_distracted = true;
                        distraction_type = Some("REGEX_RULE".to_string());
                        distraction_reason = Some(r.clone());
                        break;
                    }
                }

                if !is_distracted {
                    let cache_key = format!("{}::{}", title, intention);
                    let mut cached_result = None;
                    {
                        let cache = llm_cache.lock().unwrap();
                        if let Some(&res) = cache.get(&cache_key) {
                            cached_result = Some(res);
                        }
                    }

                    if let Some(res) = cached_result {
                        is_distracted = res;
                        if res {
                            distraction_type = Some("LLM_EVALUATION".to_string());
                            distraction_reason = Some(intention.clone());
                        }
                    } else {
                        let mut pending = pending_evaluations.lock().unwrap();
                        if !pending.contains(&cache_key) {
                            pending.insert(cache_key.clone());
                            
                            let llm_cache_clone = llm_cache.clone();
                            let pending_clone = pending_evaluations.clone();
                            let title_clone = title.clone();
                            let ollama_url = db.get_setting("ollama_url").unwrap_or_else(|_| "http://localhost:11434".to_string());
                            let ollama_model = db.get_setting("ollama_model").unwrap_or_else(|_| "llama3.2".to_string());
                            
                            std::thread::spawn(move || {
                                let prompt = format!(
                                    "You are an active distraction monitor. The user's current deep work intention is: \"{}\". They are currently looking at a window titled: \"{}\". Is this window a distraction from their goal? Reply with exactly YES or NO.",
                                    intention, title_clone
                                );
                                
                                let payload = serde_json::json!({
                                    "model": ollama_model,
                                    "prompt": prompt,
                                    "stream": false
                                });
                                
                                let output = std::process::Command::new("curl")
                                    .args([
                                        "-s",
                                        "-X", "POST",
                                        &format!("{}/api/generate", ollama_url),
                                        "-H", "Content-Type: application/json",
                                        "-d", &payload.to_string(),
                                    ])
                                    .output();
                                
                                let mut result_distracted = false;
                                if let Ok(out) = output {
                                    if out.status.success() {
                                        if let Ok(response_json) = serde_json::from_slice::<serde_json::Value>(&out.stdout) {
                                            if let Some(response) = response_json["response"].as_str() {
                                                if response.to_uppercase().contains("YES") {
                                                    result_distracted = true;
                                                }
                                            }
                                        }
                                    }
                                }
                                
                                {
                                    let mut cache = llm_cache_clone.lock().unwrap();
                                    cache.insert(cache_key.clone(), result_distracted);
                                }
                                {
                                    let mut pending_lock = pending_clone.lock().unwrap();
                                    pending_lock.remove(&cache_key);
                                }
                                
                                if result_distracted {
                                    // The main synchronous loop will handle window visibility and logic 
                                    // on the next 1-second tick when it reads the updated cache.
                                }
                            });
                        }
                    }
                }
            }

            if is_distracted {
                if app == current_distraction_app && title == current_distraction_title {
                    if let Some(id) = current_distraction_id {
                        let _ = db_ref.update_distraction_duration(id, 1);
                    }
                } else {
                    if let (Some(dtype), Some(dreason)) = (distraction_type, distraction_reason) {
                        let now_str = Utc::now().to_rfc3339();
                        if let Ok(id) = db_ref.insert_distraction_event(
                            &now_str,
                            &app,
                            &title,
                            &dtype,
                            &dreason
                        ) {
                            current_distraction_id = Some(id);
                            current_distraction_app = app.clone();
                            current_distraction_title = title.clone();
                        }
                    }
                }
                
                let mut should_show_overlay = false;
                {
                    let mut has_shown = has_shown_fullscreen.lock().unwrap();
                    if !*has_shown {
                        should_show_overlay = true;
                        *has_shown = true;
                    }
                }
                
                if should_show_overlay {
                    if let Some(overlay_win) = app_handle.get_webview_window("overlay") {
                        let _ = overlay_win.hide();
                        let _ = overlay_win.show();
                        let _ = overlay_win.set_focus();
                    }
                    if let Some(toast_win) = app_handle.get_webview_window("toast") {
                        let _ = toast_win.hide();
                    }
                    let _ = app_handle.emit("distraction-detected", &title);
                } else {
                    let is_overlay_visible = app_handle.get_webview_window("overlay")
                        .map(|w| w.is_visible().unwrap_or(false))
                        .unwrap_or(false);
                        
                    if !is_overlay_visible {
                        if let Some(toast_win) = app_handle.get_webview_window("toast") {
                            if !toast_win.is_visible().unwrap_or(false) {
                                // Get primary monitor
                                if let Ok(Some(monitor)) = toast_win.primary_monitor() {
                                    let size = monitor.size();
                                    let toast_size = toast_win.outer_size().unwrap_or(tauri::PhysicalSize::new(380, 140));
                                    
                                    // Calculate bottom right position with 24px padding
                                    let x = (size.width.saturating_sub(toast_size.width)).saturating_sub(24);
                                    let y = (size.height.saturating_sub(toast_size.height)).saturating_sub(24);
                                    
                                    let _ = toast_win.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(x as i32, y as i32)));
                                }
                                let _ = toast_win.show();
                            }
                            
                            #[derive(serde::Serialize, Clone)]
                            struct DistractionPayload {
                                title: String,
                                duration: i64,
                            }
                            let _ = app_handle.emit("distraction-tick", DistractionPayload {
                                title: title.clone(),
                                duration: parent_duration,
                            });
                        }
                    }
                }
            } else {
                current_distraction_app.clear();
                current_distraction_title.clear();
                current_distraction_id = None;

                if is_focus_mode_active {
                    let mut has_shown = has_shown_fullscreen.lock().unwrap();
                    *has_shown = false;
                    
                    if let Some(overlay_win) = app_handle.get_webview_window("overlay") {
                        if overlay_win.is_visible().unwrap_or(false) {
                            let _ = overlay_win.hide();
                        }
                    }
                    if let Some(toast_win) = app_handle.get_webview_window("toast") {
                        if toast_win.is_visible().unwrap_or(false) {
                            let _ = toast_win.hide();
                        }
                    }
                }
            }

            if parent_app.is_empty() {
                parent_app = app.clone();
                parent_title = title.clone();
                parent_url = url.clone();
                parent_icon_url = icon_url.clone();
                parent_source = source.clone();
                parent_start_time = Utc::now();
                parent_duration = 1;

                if parent_source == "Editor" {
                    editor_sub_title = title.clone();
                    editor_sub_start_time = Utc::now();
                    editor_sub_duration = 1;
                }

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
                        domain_tag: if parent_source == "Browser" {
                            parent_url.as_deref().map(extract_domain).filter(|d| !d.is_empty())
                        } else {
                            None
                        },
                        notes: None,
                    });
                }
                continue;
            }

            // A focus change is detected if the app changes OR if the active tab URL changes for a browser
            let is_same_focus = app == parent_app
                && (source != "Browser"
                    || extract_domain(url.as_deref().unwrap_or(""))
                        == extract_domain(parent_url.as_deref().unwrap_or("")));

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

                if parent_source == "Editor" {
                    if title == editor_sub_title {
                        editor_sub_duration += 1;
                    } else {
                        flush_editor_event(editor_sub_duration, &editor_sub_title, editor_sub_start_time, &parent_app, parent_icon_url.clone(), min_sub_session_duration);
                        editor_sub_title = title.clone();
                        editor_sub_start_time = Utc::now();
                        editor_sub_duration = 1;
                    }
                }
            } else {
                // We are in a different focus
                let is_same_temp = app == temp_app
                    && (source != "Browser"
                        || extract_domain(url.as_deref().unwrap_or(""))
                            == extract_domain(temp_url.as_deref().unwrap_or("")));

                if is_same_temp {
                    temp_duration += 1;
                    if temp_duration >= 120 {
                        // The temporary focus matured into a major session (>= 2 minutes)!
                        // Save the old parent session
                        if parent_duration >= min_log_duration && !parent_app.is_empty() {
                            let log = ActivityLog {
                                id: None,
                                app_name: parent_app.clone(),
                                window_title: parent_title.clone(),
                                start_time: parent_start_time.to_rfc3339(),
                                duration: parent_duration,
                                source: parent_source.clone(),
                                url: parent_url.clone(),
                                icon_url: parent_icon_url.clone(),
                                domain_tag: if parent_source == "Browser" {
                                    parent_url.as_deref().map(extract_domain).filter(|d| !d.is_empty())
                                } else {
                                    None
                                },
                                notes: None,
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

                        if parent_source == "Editor" {
                            editor_sub_title = title.clone();
                            editor_sub_start_time = Utc::now();
                            editor_sub_duration = 1;
                        }

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
                    if parent_duration >= min_log_duration && !parent_app.is_empty() {
                        let log = ActivityLog {
                            id: None,
                            app_name: parent_app.clone(),
                            window_title: parent_title.clone(),
                            start_time: parent_start_time.to_rfc3339(),
                            duration: parent_duration,
                            source: parent_source.clone(),
                            url: parent_url.clone(),
                            icon_url: parent_icon_url.clone(),
                            domain_tag: if parent_source == "Browser" {
                                parent_url.as_deref().map(extract_domain).filter(|d| !d.is_empty())
                            } else {
                                None
                            },
                            notes: None,
                        };
                        let _ = db.insert_activity_log(&log);
                    }
                    
                    if parent_source == "Editor" {
                        flush_editor_event(editor_sub_duration, &editor_sub_title, editor_sub_start_time, &parent_app, parent_icon_url.clone(), min_sub_session_duration);
                        editor_sub_duration = 0;
                        editor_sub_title.clear();
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

                    if parent_source == "Editor" {
                        editor_sub_title = title.clone();
                        editor_sub_start_time = Utc::now();
                        editor_sub_duration = temp_duration; // Inherit temp duration if we just promoted it, wait, if we promote it, temp_duration was spent in THIS title!
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
                        domain_tag: if parent_source == "Browser" {
                            parent_url.as_deref().map(extract_domain).filter(|d| !d.is_empty())
                        } else {
                            None
                        },
                        notes: None,
                    });
                } else {
                    *active_lock = None;
                }
            }
        }
    });
}


