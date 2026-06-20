pub mod ai;
pub mod db;
pub mod native_msg;
pub mod tracker;
pub mod window_provider;

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

/// Returns the home directory as a PathBuf, checking XDG_HOME then HOME.
fn get_home_dir() -> Option<PathBuf> {
    std::env::var("HOME").ok().map(PathBuf::from)
}

/// Auto-installs the native messaging host manifest for Chrome and Chromium.
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
            eprintln!("[native-host] HOME not set, cannot install manifest");
            return;
        }
    };

    // The extension ID is fixed once published to the Chrome Web Store.
    // During development this matches the unpacked extension ID.
    let allowed_origin = "chrome-extension://hcpagmeofngagbmahpccoajilpndckab/";

    let manifest = format!(
        r#"{{
  "name": "com.lifemirror.desktop",
  "description": "LifeMirror Native Messaging Bridge",
  "path": "{exe}",
  "type": "stdio",
  "allowed_origins": [
    "{origin}"
  ]
}}
"#,
        exe = exe_path.display(),
        origin = allowed_origin
    );

    // Install for Google Chrome and Chromium
    let host_dirs = [
        home.join(".config/google-chrome/NativeMessagingHosts"),
        home.join(".config/chromium/NativeMessagingHosts"),
    ];

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
fn delete_activity_log(state: State<'_, Arc<DbState>>, id: i64) -> Result<(), String> {
    state.delete_activity_log(id).map_err(|e| e.to_string())
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

fn setup_system_tray(app: &tauri::App) -> Result<TrayMenuState, tauri::Error> {
    let open_i = MenuItem::with_id(app, "open", "Open LifeMirror", true, None::<&str>)?;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args().collect();
    let db_path = get_db_path();

    // Route 1: Headless browser native messaging host execution mode
    if args.len() > 1 && (args[1].starts_with("chrome-extension://") || args[1] == "--native-host")
    {
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

    // Build and run the Tauri app
    tauri::Builder::default()
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
                            .args(["LifeMirror", "LifeMirror is still running in the background. You can quit from the system tray icon."])
                            .status();
                    }
                }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            get_activities,
            get_journals,
            get_distraction_events_for_day,
            delete_activity_log,
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
            clear_chat_history,
            get_sub_session_events_for_day,
            get_distraction_rules_list,
            add_distraction_rule,
            delete_distraction_rule
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}