pub mod db;
pub mod tracker;
pub mod native_msg;
pub mod ai;

use std::sync::Arc;
use std::path::PathBuf;
use tauri::State;
use db::{DbState, ActivityLog, JournalEntry, DailySummary, HourlyMetric, ChatMessage};

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

#[tauri::command]
fn get_current_activity(
    active_activity: State<'_, Arc<std::sync::Mutex<Option<ActivityLog>>>>,
) -> Result<Option<ActivityLog>, String> {
    let active = active_activity.lock().unwrap();
    Ok(active.clone())
}

#[tauri::command]
fn get_daily_activities(state: State<'_, Arc<DbState>>, date: String) -> Result<Vec<ActivityLog>, String> {
    state.get_raw_activities_for_day(&date).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_weekly_summary(state: State<'_, Arc<DbState>>, start_date: String, end_date: String) -> Result<Vec<DailySummary>, String> {
    state.get_aggregated_metrics_range(&start_date, &end_date).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_monthly_summary(state: State<'_, Arc<DbState>>, start_date: String, end_date: String) -> Result<Vec<DailySummary>, String> {
    state.get_aggregated_metrics_range(&start_date, &end_date).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_hourly_heatmap(state: State<'_, Arc<DbState>>, start_date: String, end_date: String) -> Result<Vec<HourlyMetric>, String> {
    state.get_hourly_heatmap_metrics(&start_date, &end_date).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_chat_history(state: State<'_, Arc<DbState>>, date: String) -> Result<Vec<ChatMessage>, String> {
    state.get_chat_messages_for_day(&date).map_err(|e| e.to_string())
}

#[tauri::command]
fn add_chat_message(state: State<'_, Arc<DbState>>, date: String, role: String, content: String) -> Result<i64, String> {
    state.insert_chat_message(&date, &role, &content).map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_chat_history(state: State<'_, Arc<DbState>>, date: String) -> Result<(), String> {
    state.clear_chat_messages_for_day(&date).map_err(|e| e.to_string())
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

    // Run DB daily rollup on startup
    let db_rollup_clone = db_arc.clone();
    std::thread::spawn(move || {
        if let Err(e) = db_rollup_clone.run_daily_rollup() {
            eprintln!("Failed to run daily rollup: {:?}", e);
        }
    });

    // Load initial tracking state
    let initial_tracking = db_arc.get_setting("tracking_active").unwrap_or_else(|_| "true".to_string()) == "true";
    let tracking_active = Arc::new(std::sync::atomic::AtomicBool::new(initial_tracking));
    let active_activity = Arc::new(std::sync::Mutex::new(None));

    // Spawn OS window focus tracker background loop
    tracker::start_window_tracker(db_arc.clone(), tracking_active.clone(), active_activity.clone());

    // Spawn background idle state AI daily reflection builder
    ai::start_idle_ai_summarizer(db_arc.clone());

    // Build and run the Tauri app
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(db_arc)
        .manage(tracking_active)
        .manage(active_activity)
        .invoke_handler(tauri::generate_handler![
            get_activities,
            get_journals,
            add_journal,
            toggle_incognito,
            is_incognito,
            get_db_setting,
            set_db_setting,
            toggle_tracking,
            is_tracking_active,
            get_current_activity,
            get_daily_activities,
            get_weekly_summary,
            get_monthly_summary,
            get_hourly_heatmap,
            get_chat_history,
            add_chat_message,
            clear_chat_history
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
