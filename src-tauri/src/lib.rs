pub mod ai;
#[path = "inference/mod.rs"]
pub mod inference;
pub mod db;
pub mod native_msg;
pub mod providers;
pub mod tracker;
pub mod window_provider;
pub mod memory_engine;

use db::{ActivityLog, ChatMessage, DailySummary, DbState, HourlyMetric, JournalEntry};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::image::Image;
use tauri::menu::{CheckMenuItem, Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Emitter;
use tauri::Manager;
use tauri::State;
use tauri_plugin_autostart::MacosLauncher;

pub struct TrayMenuState {
    pub incognito_item: CheckMenuItem<tauri::Wry>,
    pub tracking_item: CheckMenuItem<tauri::Wry>,
}

fn update_tray_icon_by_state(app: &tauri::AppHandle) {
    if let Some(tray) = app.tray_by_id("main-tray") {
        let db = app.state::<Arc<DbState>>();
        let tracking_active = app.state::<Arc<std::sync::atomic::AtomicBool>>();

        let is_incog = db.get_setting("incognito").unwrap_or_default() == "true";
        let is_track = tracking_active.load(std::sync::atomic::Ordering::SeqCst);

        let icon_bytes = if is_incog {
            include_bytes!("../icons/32x32_incognito.png").as_ref()
        } else if !is_track {
            include_bytes!("../icons/32x32_paused.png").as_ref()
        } else {
            include_bytes!("../icons/32x32.png").as_ref()
        };

        if let Ok(img) = Image::from_bytes(icon_bytes) {
            let _ = tray.set_icon(Some(img));
        }
    }
}

/// Returns the home directory as a PathBuf, checking HOME then USERPROFILE.
fn get_home_dir() -> Option<PathBuf> {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .ok()
        .map(PathBuf::from)
}

/// Auto-installs the native messaging host manifest for Chrome, Brave, Chromium, Edge, etc.
/// Called on every GUI startup so users never have to run a manual script.
/// The manifest is written with the path of the currently running executable,
/// which keeps it correct across app updates or directory moves.
fn install_native_host_manifest() {
    let exe_path = match std::env::current_exe() {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[native-host] Could not determine exe path: {e}");
            return;
        }
    };

    let home = match get_home_dir() {
        Some(h) => h,
        None => {
            eprintln!("[native-host] HOME / USERPROFILE not set, cannot install manifest");
            return;
        }
    };

    // Both Chrome Web Store extension ID and local development extension ID
    let manifest = format!(
        r#"{{
  "name": "com.lifemirror.desktop",
  "description": "LifeMirror Desktop Native Messaging Bridge",
  "path": "{exe}",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://pblffjiaheggbamkjaojabdaemkflhmm/",
    "chrome-extension://hcpagmeofngagbmahpccoajilpndckab/"
  ]
}}
"#,
        exe = exe_path.display()
    );

    #[cfg(target_os = "linux")]
    let host_dirs = [
        home.join(".config/google-chrome/NativeMessagingHosts"),
        home.join(".config/google-chrome-beta/NativeMessagingHosts"),
        home.join(".config/google-chrome-unstable/NativeMessagingHosts"),
        home.join(".config/chromium/NativeMessagingHosts"),
        home.join(".config/BraveSoftware/Brave-Browser/NativeMessagingHosts"),
        home.join(".config/BraveSoftware/Brave-Browser-Beta/NativeMessagingHosts"),
        home.join(".config/BraveSoftware/Brave-Browser-Dev/NativeMessagingHosts"),
        home.join(".config/BraveSoftware/Brave-Browser-Nightly/NativeMessagingHosts"),
        home.join(".config/microsoft-edge/NativeMessagingHosts"),
        home.join(".config/microsoft-edge-beta/NativeMessagingHosts"),
        home.join(".config/microsoft-edge-dev/NativeMessagingHosts"),
        home.join(".config/vivaldi/NativeMessagingHosts"),
        home.join(".config/opera/NativeMessagingHosts"),
    ];

    #[cfg(target_os = "macos")]
    let host_dirs = [
        home.join("Library/Application Support/Google/Chrome/NativeMessagingHosts"),
        home.join("Library/Application Support/Chromium/NativeMessagingHosts"),
        home.join("Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts"),
        home.join("Library/Application Support/Microsoft Edge/NativeMessagingHosts"),
        home.join("Library/Application Support/Vivaldi/NativeMessagingHosts"),
        home.join("Library/Application Support/com.operasoftware.Opera/NativeMessagingHosts"),
    ];

    #[cfg(not(target_os = "windows"))]
    for dir in &host_dirs {
        // Only write if the browser config dir parent exists (browser is installed)
        let browser_config = dir.parent().unwrap_or(dir);
        if !browser_config.exists() {
            continue;
        }
        if let Err(e) = std::fs::create_dir_all(dir) {
            eprintln!("[native-host] Failed to create {}: {e}", dir.display());
            continue;
        }
        let manifest_path = dir.join("com.lifemirror.desktop.json");
        match std::fs::write(&manifest_path, &manifest) {
            Ok(_) => eprintln!("[native-host] Manifest installed: {}", manifest_path.display()),
            Err(e) => eprintln!("[native-host] Failed to write {}: {e}", manifest_path.display()),
        }
    }

    #[cfg(target_os = "windows")]
    {
        let win_dir = home.join("AppData/Local/LifeMirror/NativeMessagingHosts");
        if let Ok(_) = std::fs::create_dir_all(&win_dir) {
            let manifest_path = win_dir.join("com.lifemirror.desktop.json");
            if std::fs::write(&manifest_path, &manifest).is_ok() {
                let manifest_path_str = manifest_path.to_string_lossy().to_string();
                let reg_keys = [
                    r"Software\Google\Chrome\NativeMessagingHosts\com.lifemirror.desktop",
                    r"Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.lifemirror.desktop",
                    r"Software\Microsoft\Edge\NativeMessagingHosts\com.lifemirror.desktop",
                    r"Software\Chromium\NativeMessagingHosts\com.lifemirror.desktop",
                ];
                let hkcu = winreg::RegKey::predef(winreg::enums::HKEY_CURRENT_USER);
                for key_path in &reg_keys {
                    if let Ok((key, _)) = hkcu.create_subkey(key_path) {
                        let _ = key.set_value("", &manifest_path_str);
                    }
                }
            }
        }
    }
}

fn get_db_path() -> PathBuf {
    let mut path = if let Ok(data_home) = std::env::var("XDG_DATA_HOME") {
        PathBuf::from(data_home)
    } else if let Ok(home) = std::env::var("HOME") {
        let mut p = PathBuf::from(home);
        p.push(".local");
        p.push("share");
        p
    } else {
        PathBuf::from(".")
    };
    path.push("lifemirror-desktop");
    let _ = std::fs::create_dir_all(&path);
    path.push("lifemirror-desktop.db");
    path
}

#[tauri::command]
fn get_activities(state: State<'_, Arc<DbState>>, limit: i64) -> Result<Vec<ActivityLog>, String> {
    state.get_activity_logs(limit).map_err(|e| e.to_string())
}

#[tauri::command]
fn search_activities(state: State<'_, Arc<DbState>>, query: String, limit: i64) -> Result<Vec<ActivityLog>, String> {
    state.search_activities(&query, limit).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_journals(state: State<'_, Arc<DbState>>, limit: i64) -> Result<Vec<JournalEntry>, String> {
    state.get_journal_entries(limit).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_activity_log(db: State<'_, Arc<DbState>>, id: i64) -> Result<(), String> {
    db.delete_activity_log(id).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_distraction_event(db: State<'_, Arc<DbState>>, id: i64) -> Result<(), String> {
    db.delete_distraction_event(id).map_err(|e| e.to_string())
}

#[tauri::command]
fn add_journal(
    state: State<'_, Arc<DbState>>,
    notes: String,
    activity_id: Option<i64>,
) -> Result<i64, String> {
    let timestamp = chrono::Utc::now().to_rfc3339();
    if let Some(id) = activity_id {
        let _ = state.update_activity_notes(id, &notes);
    }
    state
        .insert_journal_entry(&timestamp, &notes)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_incognito(
    app: tauri::AppHandle,
    state: State<'_, Arc<DbState>>,
    tracking_active: State<'_, Arc<std::sync::atomic::AtomicBool>>,
    tray_state: State<'_, TrayMenuState>,
) -> Result<bool, String> {
    let current = state
        .get_setting("incognito")
        .unwrap_or_else(|_| "false".to_string())
        == "true";
    let new_incognito = !current;
    
    state
        .set_setting("incognito", if new_incognito { "true" } else { "false" })
        .map_err(|e| e.to_string())?;

    // Update tray checkbox
    let _ = tray_state.incognito_item.set_checked(new_incognito);

    // RADIO BEHAVIOR: If Incognito is turned ON, Tracking Active must turn OFF
    if new_incognito {
        state
            .set_setting("tracking_active", "false")
            .map_err(|e| e.to_string())?;
        tracking_active.store(false, std::sync::atomic::Ordering::SeqCst);
        let _ = tray_state.tracking_item.set_checked(false);
        let _ = app.emit("tracking-changed", false);
    }

    // Update tray icon
    update_tray_icon_by_state(&app);

    Ok(new_incognito)
}

#[tauri::command]
fn is_incognito(state: State<'_, Arc<DbState>>) -> Result<bool, String> {
    let current = state
        .get_setting("incognito")
        .unwrap_or_else(|_| "false".to_string())
        == "true";
    Ok(current)
}

#[tauri::command]
fn get_db_setting(state: State<'_, Arc<DbState>>, key: String) -> Result<String, String> {
    state.get_setting(&key).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_db_setting(
    state: State<'_, Arc<DbState>>,
    key: String,
    value: String,
) -> Result<(), String> {
    state.set_setting(&key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_tracking(
    app: tauri::AppHandle,
    state: State<'_, Arc<DbState>>,
    tracking_active: State<'_, Arc<std::sync::atomic::AtomicBool>>,
    tray_state: State<'_, TrayMenuState>,
) -> Result<bool, String> {
    let current = tracking_active.load(std::sync::atomic::Ordering::SeqCst);
    let new_tracking = !current;
    
    state
        .set_setting("tracking_active", if new_tracking { "true" } else { "false" })
        .map_err(|e| e.to_string())?;
    tracking_active.store(new_tracking, std::sync::atomic::Ordering::SeqCst);

    // Update tray checkbox
    let _ = tray_state.tracking_item.set_checked(new_tracking);

    // RADIO BEHAVIOR: If Tracking Active is turned ON, Incognito Mode must turn OFF
    if new_tracking {
        state
            .set_setting("incognito", "false")
            .map_err(|e| e.to_string())?;
        let _ = tray_state.incognito_item.set_checked(false);
        let _ = app.emit("incognito-changed", false);
    }

    // Update tray icon
    update_tray_icon_by_state(&app);

    Ok(new_tracking)
}

#[tauri::command]
fn is_tracking_active(
    tracking_active: State<'_, Arc<std::sync::atomic::AtomicBool>>,
) -> Result<bool, String> {
    Ok(tracking_active.load(std::sync::atomic::Ordering::SeqCst))
}

#[tauri::command]
fn get_current_activity(
    active_activity: State<'_, Arc<std::sync::Mutex<Option<ActivityLog>>>>,
) -> Result<Option<ActivityLog>, String> {
    let active = active_activity.lock().unwrap();
    Ok(active.clone())
}

#[tauri::command]
fn get_daily_activities(
    state: State<'_, Arc<DbState>>,
    date: String,
) -> Result<Vec<ActivityLog>, String> {
    state
        .get_raw_activities_for_day(&date)
        .map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
pub struct FrontendMemoryNode {
    #[serde(flatten)]
    pub node: db::MemoryNode,
    pub activities: Vec<db::ActivityLog>,
    pub sub_events: Vec<db::SubSessionEvent>,
}

#[tauri::command]
async fn update_memory_node_summary(
    id: i64,
    summary: String,
    state: tauri::State<'_, Arc<DbState>>,
) -> Result<(), String> {
    state
        .update_memory_node_summary(id, &summary)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_memory_node(
    id: i64,
    state: tauri::State<'_, Arc<DbState>>,
) -> Result<(), String> {
    state
        .inner()
        .delete_memory_node(id)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
#[allow(dead_code)]
fn get_memory_nodes_for_day(
    state: State<'_, Arc<DbState>>,
    date: String,
) -> Result<Vec<FrontendMemoryNode>, String> {
    let nodes = state.get_memory_nodes_for_day(&date).map_err(|e| e.to_string())?;
    let mut frontend_nodes = Vec::new();
    for node in nodes {
        let node_id = node.id.unwrap_or(0);
        let activities = state.get_activities_for_node(node_id).unwrap_or_default();
        let sub_events = state.get_sub_events_for_node(node_id).unwrap_or_default();
        frontend_nodes.push(FrontendMemoryNode { node, activities, sub_events });
    }
    Ok(frontend_nodes)
}

#[tauri::command]
#[allow(dead_code)]
async fn search_memory_nodes(
    state: State<'_, Arc<DbState>>,
    query: String,
    limit: i64,
) -> Result<Vec<FrontendMemoryNode>, String> {
    use crate::inference::get_inference_provider;
    use memory_engine::retriever::Retriever;
    let provider = get_inference_provider(state.inner().clone());
    match provider.embed(&query).await {
        Ok((query_vector, _, _)) => {
            let retriever = Retriever::new(state.inner().clone());
            match retriever.retrieve(&query_vector, limit as usize).await {
                Ok(scored_nodes) => {
                    let mut frontend_nodes = Vec::new();
                    for (node, _score) in scored_nodes {
                        let node_id = node.id.unwrap_or(0);
                        let activities = state.get_activities_for_node(node_id).unwrap_or_default();
                        let sub_events = state.get_sub_events_for_node(node_id).unwrap_or_default();
                        frontend_nodes.push(FrontendMemoryNode { node, activities, sub_events });
                    }
                    Ok(frontend_nodes)
                },
                Err(e) => {
                    println!("[search_memory_nodes] Semantic retrieval failed: {}. Falling back to SQL LIKE.", e);
                    let nodes = state.search_memory_nodes(&query, limit).map_err(|e| e.to_string())?;
                    let mut frontend_nodes = Vec::new();
                    for node in nodes {
                        let node_id = node.id.unwrap_or(0);
                        let activities = state.get_activities_for_node(node_id).unwrap_or_default();
                        let sub_events = state.get_sub_events_for_node(node_id).unwrap_or_default();
                        frontend_nodes.push(FrontendMemoryNode { node, activities, sub_events });
                    }
                    Ok(frontend_nodes)
                }
            }
        },
        Err(e) => {
            println!("[search_memory_nodes] Embedding failed: {}. Falling back to SQL LIKE.", e);
            let nodes = state.search_memory_nodes(&query, limit).map_err(|e| e.to_string())?;
            let mut frontend_nodes = Vec::new();
            for node in nodes {
                let node_id = node.id.unwrap_or(0);
                let activities = state.get_activities_for_node(node_id).unwrap_or_default();
                let sub_events = state.get_sub_events_for_node(node_id).unwrap_or_default();
                frontend_nodes.push(FrontendMemoryNode { node, activities, sub_events });
            }
            Ok(frontend_nodes)
        }
    }
}

#[tauri::command]
fn get_sub_session_events_for_day(db: State<'_, Arc<DbState>>, date: String) -> Result<Vec<db::SubSessionEvent>, String> {
    db.get_sub_session_events_for_day(&date).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_distraction_events_for_day(db: State<'_, Arc<DbState>>, date: String) -> Result<Vec<db::DistractionEvent>, String> {
    db.get_distraction_events_for_day(&date).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_distraction_rules_list(db: State<'_, Arc<DbState>>) -> Result<Vec<db::DistractionRule>, String> {
    db.get_distraction_rules_list().map_err(|e| e.to_string())
}

#[tauri::command]
fn add_distraction_rule(db: State<'_, Arc<DbState>>, rule_type: String, value: String) -> Result<(), String> {
    db.add_distraction_rule(&rule_type, &value).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_distraction_rule(db: State<'_, Arc<DbState>>, id: i64) -> Result<(), String> {
    db.delete_distraction_rule(id).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_weekly_summary(
    state: State<'_, Arc<DbState>>,
    start_date: String,
    end_date: String,
) -> Result<Vec<DailySummary>, String> {
    state
        .get_aggregated_metrics_range(&start_date, &end_date)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_monthly_summary(
    state: State<'_, Arc<DbState>>,
    start_date: String,
    end_date: String,
) -> Result<Vec<DailySummary>, String> {
    state
        .get_aggregated_metrics_range(&start_date, &end_date)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_hourly_heatmap(
    state: State<'_, Arc<DbState>>,
    start_date: String,
    end_date: String,
) -> Result<Vec<HourlyMetric>, String> {
    state
        .get_hourly_heatmap_metrics(&start_date, &end_date)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_chat_history(
    state: State<'_, Arc<DbState>>,
    date: String,
) -> Result<Vec<ChatMessage>, String> {
    state
        .get_chat_messages_for_day(&date)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn add_chat_message(
    state: State<'_, Arc<DbState>>,
    date: String,
    role: String,
    content: String,
) -> Result<i64, String> {
    state
        .insert_chat_message(&date, &role, &content)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_chat_history(state: State<'_, Arc<DbState>>, date: String) -> Result<(), String> {
    state
        .clear_chat_messages_for_day(&date)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn hide_toast(app: tauri::AppHandle) {
    if let Some(toast_win) = app.get_webview_window("toast") {
        let _ = toast_win.hide();
    }
}

#[tauri::command]
fn hide_overlay(app: tauri::AppHandle) {
    if let Some(overlay_win) = app.get_webview_window("overlay") {
        let _ = overlay_win.hide();
    }
}

#[tauri::command]
fn log_debug(msg: String) {
    println!("[Frontend Chat] {}", msg);
}

#[tauri::command]
fn show_main(app: tauri::AppHandle) {
    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.show();
        let _ = main_win.set_focus();
    }
}

/// Fixes the Windows autostart Registry entry written by auto-launch 0.5.0.
///
/// auto-launch writes the Run key value as an unquoted string:
///   C:\Users\John Smith\...\lifemirror-desktop.exe --hidden
/// Windows fails to parse this when the path contains spaces. This command
/// rewrites the value with the executable path properly quoted:
///   "C:\Users\John Smith\...\lifemirror-desktop.exe" --hidden
///
/// On non-Windows platforms this is a no-op that always succeeds.
#[tauri::command]
fn fix_autostart_registry_path() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::{HKEY_CURRENT_USER, KEY_READ, KEY_SET_VALUE};
        use winreg::RegKey;
        const AL_REGKEY: &str = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";
        const APP_NAME: &str = "lifemirror-desktop";

        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let run_key = hkcu
            .open_subkey_with_flags(AL_REGKEY, KEY_READ | KEY_SET_VALUE)
            .map_err(|e| e.to_string())?;

        let current: String = run_key.get_value(APP_NAME).map_err(|e| e.to_string())?;

        // Only rewrite if the path is not already quoted.
        if !current.starts_with('"') {
            // Locate the boundary between the .exe path and the trailing args.
            // auto-launch always appends args with a space, so we look for ".exe "
            // (case-insensitive) first, then fall back to the first " --" separator.
            let fixed = if let Some(exe_end) = current.to_lowercase().find(".exe") {
                let (path, rest) = current.split_at(exe_end + 4);
                if rest.is_empty() {
                    format!("\"{}\"", path)
                } else {
                    format!("\"{}\"{}", path, rest)
                }
            } else if let Some(idx) = current.find(" --") {
                let (path, args) = current.split_at(idx);
                format!("\"{}\"{}", path, args)
            } else {
                format!("\"{}\"", current)
            };
            run_key.set_value(APP_NAME, &fixed).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn generate_resume_context(
    state: State<'_, Arc<DbState>>,
    project_id: Option<i64>
) -> Result<memory_engine::resume_context::ResumeContextResponse, String> {
    let builder = memory_engine::resume_context::ResumeBuilder::new(state.inner().clone());
    builder.generate_context(project_id).await
}

fn setup_system_tray(app: &tauri::App) -> Result<TrayMenuState, tauri::Error> {
    let open_i = MenuItem::with_id(app, "open", "Open LifeMirror Desktop", true, None::<&str>)?;

    let db = app.state::<Arc<DbState>>();
    let is_incog = db.get_setting("incognito").unwrap_or_default() == "true";
    let incog_i = CheckMenuItem::with_id(
        app,
        "incognito",
        "Incognito Mode",
        true,
        is_incog,
        None::<&str>,
    )?;

    let tracking_active = app.state::<Arc<std::sync::atomic::AtomicBool>>();
    let is_track = tracking_active.load(std::sync::atomic::Ordering::SeqCst);
    let track_i = CheckMenuItem::with_id(
        app,
        "tracking",
        "Tracking Active",
        true,
        is_track,
        None::<&str>,
    )?;

    let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&open_i, &incog_i, &track_i, &quit_i])?;

    let default_icon_bytes = if is_incog {
        include_bytes!("../icons/32x32_incognito.png").as_ref()
    } else if !is_track {
        include_bytes!("../icons/32x32_paused.png").as_ref()
    } else {
        include_bytes!("../icons/32x32.png").as_ref()
    };

    let icon = Image::from_bytes(default_icon_bytes).unwrap();

    let _tray = TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .menu(&menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "incognito" => {
                let db = app.state::<Arc<DbState>>();
                let current = db.get_setting("incognito").unwrap_or_default() == "true";
                let new_incognito = !current;
                let _ = db.set_setting("incognito", if new_incognito { "true" } else { "false" });

                let tray_state = app.state::<TrayMenuState>();
                let _ = tray_state.incognito_item.set_checked(new_incognito);
                let _ = app.emit("incognito-changed", new_incognito);

                // RADIO BEHAVIOR: Turn off tracking if incognito is enabled
                if new_incognito {
                    let tracking_active = app.state::<Arc<std::sync::atomic::AtomicBool>>();
                    tracking_active.store(false, std::sync::atomic::Ordering::SeqCst);
                    let _ = db.set_setting("tracking_active", "false");
                    let _ = tray_state.tracking_item.set_checked(false);
                    let _ = app.emit("tracking-changed", false);
                }

                update_tray_icon_by_state(app);
            }
            "tracking" => {
                let tracking_active = app.state::<Arc<std::sync::atomic::AtomicBool>>();
                let current = tracking_active.load(std::sync::atomic::Ordering::SeqCst);
                let new_tracking = !current;
                tracking_active.store(new_tracking, std::sync::atomic::Ordering::SeqCst);

                let db = app.state::<Arc<DbState>>();
                let _ = db.set_setting("tracking_active", if new_tracking { "true" } else { "false" });

                let tray_state = app.state::<TrayMenuState>();
                let _ = tray_state.tracking_item.set_checked(new_tracking);
                let _ = app.emit("tracking-changed", new_tracking);

                // RADIO BEHAVIOR: Turn off incognito if tracking is enabled
                if new_tracking {
                    let _ = db.set_setting("incognito", "false");
                    let _ = tray_state.incognito_item.set_checked(false);
                    let _ = app.emit("incognito-changed", false);
                }

                update_tray_icon_by_state(app);
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| match event {
            TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } => {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            _ => {}
        })
        .build(app)?;

    Ok(TrayMenuState {
        incognito_item: incog_i,
        tracking_item: track_i,
    })
}

#[tauri::command]
async fn pull_ai_model(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<DbState>>,
    purpose: String,
) -> Result<(), String> {
    use crate::inference::{get_inference_provider, ModelPurpose};
    
    let model_purpose = match purpose.as_str() {
        "embedding" => ModelPurpose::Embedding,
        _ => ModelPurpose::TextGeneration,
    };

    let provider = get_inference_provider(state.inner().clone());
    provider.pull_model(model_purpose, app).await.map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args().collect();
    let db_path = get_db_path();

    // Route 1: Headless browser native messaging host execution mode
    if args.iter().any(|arg| arg.starts_with("chrome-extension://") || arg == "--native-host") {
        if let Err(e) = native_msg::run_native_host_loop(db_path) {
            eprintln!("Native messaging loop exited with error: {:?}", e);
        }
        return;
    }

    // Route 2: Graphical desktop application execution mode

    // Auto-install native messaging host manifest for Chrome/Chromium.
    // This runs silently on every launch so the manifest always reflects
    // the current binary path — no manual setup required for users.
    install_native_host_manifest();

    let db_state = DbState::new(db_path);
    let db_arc = Arc::new(db_state);

    // Run DB daily rollup on startup
    let db_rollup_clone = db_arc.clone();
    std::thread::spawn(move || {
        if let Err(e) = db_rollup_clone.run_daily_rollup() {
            eprintln!("Failed to run daily rollup: {:?}", e);
        }
    });

    // Temp Backfill: Reclassify all existing nodes to populate projects
    let db_backfill = db_arc.clone();
    tauri::async_runtime::spawn(async move {
        println!("[Backfill] Starting project classification backfill...");
        let classifier = memory_engine::project_classifier::ProjectClassifier::new(db_backfill.clone());
        
        // Scope the database lock strictly to avoid Send errors across the await boundary
        let nodes = {
            if let Ok(conn) = db_backfill.conn.lock() {
                let mut stmt = conn.prepare("SELECT id, title, summary, node_type, importance_score, confidence, embedding_id, status, timestamp FROM memory_nodes").unwrap();
                let iter = stmt.query_map([], |row| {
                    Ok(crate::db::MemoryNode {
                        id: Some(row.get(0)?),
                        title: row.get(1)?,
                        summary: row.get(2)?,
                        node_type: row.get(3)?,
                        importance_score: row.get(4)?,
                        confidence: row.get(5)?,
                        embedding_id: row.get(6)?,
                        status: row.get(7)?,
                        timestamp: row.get(8)?,
                        activities: None,
                        sub_events: None,
                    })
                }).unwrap();
                iter.filter_map(Result::ok).collect::<Vec<_>>()
            } else {
                Vec::new()
            }
        }; // conn and stmt are completely dropped here
        
        println!("[Backfill] Found {} nodes to reclassify", nodes.len());
        for node in nodes {
            let _ = classifier.classify_node(node).await;
        }
        println!("[Backfill] Project classification backfill complete.");
    });

    // Load initial configuration safely keeping radio logic intact
    let is_incognito_init = db_arc
        .get_setting("incognito")
        .unwrap_or_else(|_| "false".to_string())
        == "true";

    let initial_tracking = if is_incognito_init {
        false // If incognito is active, tracking cannot be active on launch
    } else {
        db_arc
            .get_setting("tracking_active")
            .unwrap_or_else(|_| "true".to_string())
            == "true"
    };
    
    let tracking_active = Arc::new(std::sync::atomic::AtomicBool::new(initial_tracking));
    let active_activity = Arc::new(std::sync::Mutex::new(None));



    // Spawn background idle state AI daily reflection builder
    ai::start_idle_ai_summarizer(db_arc.clone());
    
    // Spawn Memory Engine Background Queue
    crate::memory_engine::queue::MemoryQueue::new(db_arc.clone()).start();

    let db_arc_setup = db_arc.clone();

    // Build and run the Tauri app
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--hidden"])))
        .manage(db_arc.clone())
        .manage(tracking_active.clone())
        .manage(active_activity.clone())
        .setup(move |app| {
            // Setup system tray menu and states
            let tray_menu_state = setup_system_tray(app)?;
            app.manage(tray_menu_state);

            let app_handle = app.handle().clone();
            let db_for_setup = db_arc_setup.clone();
            tauri::async_runtime::spawn(async move {
                let provider = crate::inference::get_inference_provider(db_for_setup.clone());
                match provider.check_health(crate::inference::ModelPurpose::Embedding).await {
                    Ok(true) => {},
                    Ok(false) => {
                        let mut model = db_for_setup.get_setting("ollama_embedding_model").unwrap_or_default();
                        if model.is_empty() || model == "false" { model = "nomic-embed-text".to_string(); }
                        let _ = app_handle.emit("embedding-model-missing", serde_json::json!({
                            "model": model
                        }));
                    },
                    Err(e) => {
                        println!("[Startup] Failed to check Ollama embedding model: {}", e);
                    }
                }
            });

            let app_handle = app.handle().clone();
            // Spawn OS window focus tracker background loop
            tracker::start_window_tracker(
                db_arc.clone(),
                tracking_active.clone(),
                active_activity.clone(),
                app_handle,
            );

            // If the app was not launched with the --hidden flag (autostart boot), show it.
            let args: Vec<String> = std::env::args().collect();
            if !args.contains(&"--hidden".to_string()) {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                window.hide().unwrap();

                let app = window.app_handle();
                let db = app.state::<Arc<DbState>>();
                let has_shown = db.get_setting("has_shown_close_notification").unwrap_or_default() == "true";
                if !has_shown {
                    let _ = db.set_setting("has_shown_close_notification", "true");
                    #[cfg(target_os = "linux")]
                    {
                        let _ = std::process::Command::new("notify-send")
                            .args(["LifeMirror Desktop", "LifeMirror Desktop is still running in the background. You can quit from the system tray icon."])
                            .status();
                    }
                }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            log_debug,
            hide_overlay,
            get_activities,
            search_activities,
            get_journals,
            get_distraction_events_for_day,
            delete_activity_log,
            delete_distraction_event,
            add_journal,
            toggle_incognito,
            is_incognito,
            get_db_setting,
            set_db_setting,
            toggle_tracking,
            is_tracking_active,
            get_current_activity,
            get_daily_activities,
            get_memory_nodes_for_day,
            search_memory_nodes,
            update_memory_node_summary,
            delete_memory_node,
            get_weekly_summary,
            get_monthly_summary,
            get_hourly_heatmap,
            get_chat_history,
            add_chat_message,
            clear_chat_history,
            get_sub_session_events_for_day,
            get_distraction_rules_list,
            add_distraction_rule,
            delete_distraction_rule,
            hide_toast,
            show_main,
            fix_autostart_registry_path,
            generate_resume_context,
            ai::generate_chat_suggestions,
            pull_ai_model
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}