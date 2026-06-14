pub mod db;
pub mod tracker;
pub mod native_msg;
pub mod ai;

use std::sync::Arc;
use std::path::PathBuf;
use tauri::State;
use db::{DbState, ActivityLog, JournalEntry};

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
    path.push("lifemirror");
    let _ = std::fs::create_dir_all(&path);
    path.push("lifemirror.db");
    path
}

#[tauri::command]
fn get_activities(state: State<'_, Arc<DbState>>, limit: i64) -> Result<Vec<ActivityLog>, String> {
    state.get_activity_logs(limit).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_journals(state: State<'_, Arc<DbState>>, limit: i64) -> Result<Vec<JournalEntry>, String> {
    state.get_journal_entries(limit).map_err(|e| e.to_string())
}

#[tauri::command]
fn add_journal(state: State<'_, Arc<DbState>>, notes: String) -> Result<i64, String> {
    let timestamp = chrono::Utc::now().to_rfc3339();
    state.insert_journal_entry(&timestamp, &notes).map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_incognito(state: State<'_, Arc<DbState>>) -> Result<bool, String> {
    let current = state.get_setting("incognito").unwrap_or_else(|_| "false".to_string()) == "true";
    let new_state = !current;
    state.set_setting("incognito", if new_state { "true" } else { "false" }).map_err(|e| e.to_string())?;
    Ok(new_state)
}

#[tauri::command]
fn is_incognito(state: State<'_, Arc<DbState>>) -> Result<bool, String> {
    let current = state.get_setting("incognito").unwrap_or_else(|_| "false".to_string()) == "true";
    Ok(current)
}

#[tauri::command]
fn get_db_setting(state: State<'_, Arc<DbState>>, key: String) -> Result<String, String> {
    state.get_setting(&key).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_db_setting(state: State<'_, Arc<DbState>>, key: String, value: String) -> Result<(), String> {
    state.set_setting(&key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_tracking(
    state: State<'_, Arc<DbState>>,
    tracking_active: State<'_, Arc<std::sync::atomic::AtomicBool>>,
) -> Result<bool, String> {
    let current = tracking_active.load(std::sync::atomic::Ordering::SeqCst);
    let new_state = !current;
    state.set_setting("tracking_active", if new_state { "true" } else { "false" }).map_err(|e| e.to_string())?;
    tracking_active.store(new_state, std::sync::atomic::Ordering::SeqCst);
    Ok(new_state)
}

#[tauri::command]
fn is_tracking_active(
    tracking_active: State<'_, Arc<std::sync::atomic::AtomicBool>>,
) -> Result<bool, String> {
    Ok(tracking_active.load(std::sync::atomic::Ordering::SeqCst))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args().collect();
    let db_path = get_db_path();

    // Route 1: Headless browser native messaging host execution mode
    if args.len() > 1 && (args[1].starts_with("chrome-extension://") || args[1] == "--native-host") {
        if let Err(e) = native_msg::run_native_host_loop(db_path) {
            eprintln!("Native messaging loop exited with error: {:?}", e);
        }
        return;
    }

    // Route 2: Graphical desktop application execution mode
    let db_state = DbState::new(db_path);
    let db_arc = Arc::new(db_state);
    
    // Load initial tracking state
    let initial_tracking = db_arc.get_setting("tracking_active").unwrap_or_else(|_| "true".to_string()) == "true";
    let tracking_active = Arc::new(std::sync::atomic::AtomicBool::new(initial_tracking));

    // Spawn OS window focus tracker background loop
    tracker::start_window_tracker(db_arc.clone(), tracking_active.clone());

    // Spawn background idle state AI daily reflection builder
    ai::start_idle_ai_summarizer(db_arc.clone());

    // Build and run the Tauri app
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(db_arc)
        .manage(tracking_active)
        .invoke_handler(tauri::generate_handler![
            get_activities,
            get_journals,
            add_journal,
            toggle_incognito,
            is_incognito,
            get_db_setting,
            set_db_setting,
            toggle_tracking,
            is_tracking_active
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
