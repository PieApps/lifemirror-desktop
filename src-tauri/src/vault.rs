use std::path::{Path, PathBuf};
use std::sync::Arc;
use serde::{Deserialize, Serialize};
use tauri::State;
use chrono::Datelike;
use crate::db::DbState;

pub const DEFAULT_VAULT_SETTING_KEY: &str = "vault_directory";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultFileItem {
    pub name: String,
    pub relative_path: String,
    pub category: String, // "projects", "topics", "sessions", "root"
    pub updated_at: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultStructure {
    pub vault_path: String,
    pub files: Vec<VaultFileItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMarkdownPayload {
    pub session_id: Option<i64>,
    pub title: String,
    pub start_time: String,
    pub duration_seconds: i64,
    pub app_name: String,
    pub category: String,
    pub activities: Vec<ActivitySummary>,
    pub sub_events: Vec<SubEventSummary>,
    pub ai_summary: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivitySummary {
    pub title: String,
    pub app_name: String,
    pub duration: i64,
    pub url: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubEventSummary {
    pub title: String,
    pub primary_uri: Option<String>,
    pub metadata: Option<String>,
    pub timestamp: String,
}

/// Resolves the default Vault directory across OSes.
pub fn get_default_vault_path() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        let base = std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("APPDATA"))
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("."));
        let docs = base.join("Documents");
        if docs.exists() {
            docs.join("LifeMirror Vault")
        } else {
            base.join("LifeMirror Vault")
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(home) = std::env::var("HOME") {
            let home_path = PathBuf::from(home);
            let docs = home_path.join("Documents");
            if docs.exists() {
                docs.join("LifeMirror Vault")
            } else {
                home_path.join("LifeMirror Vault")
            }
        } else {
            PathBuf::from("LifeMirror Vault")
        }
    }
}

/// Resolves the effective vault directory from the database setting or fallback.
pub fn resolve_vault_path(db: &DbState) -> PathBuf {
    if let Ok(custom_path) = db.get_setting(DEFAULT_VAULT_SETTING_KEY) {
        let trimmed = custom_path.trim();
        if !trimmed.is_empty() {
            let p = PathBuf::from(trimmed);
            if p.is_absolute() {
                return p;
            }
        }
    }
    get_default_vault_path()
}

/// Ensures default folders and starter files exist in the vault.
pub fn ensure_vault_initialized(vault_path: &Path) -> Result<(), String> {
    if let Err(e) = std::fs::create_dir_all(vault_path) {
        return Err(format!("Failed to create vault root: {e}"));
    }

    let subdirs = ["projects", "topics", "sessions", "periodic"];
    for sub in &subdirs {
        let d = vault_path.join(sub);
        if !d.exists() {
            let _ = std::fs::create_dir_all(&d);
        }
    }

    // Initialize index.md if absent
    let index_file = vault_path.join("index.md");
    if !index_file.exists() {
        let initial_index = r#"# LifeMirror Knowledge Vault Index

Welcome to your personal LifeMirror Knowledge Vault. This directory is automatically maintained as an interlinked, persistent second brain conforming to the Karpathy LLM Wiki pattern.

### 🚀 Projects
- [[projects/lifemirror-desktop]] — Desktop reflection and memory graph

### 💡 Topics & Learnings
- [[topics/getting-started]] — How your knowledge vault works

### 📅 Periodic Notes
- *Day, week, and month roll-up reviews appear here.*

### ⏱️ Recent Sessions
- *New session notes appear automatically as you work.*

### 📜 System Logs
- [[log]] — Chronological ledger of all work sessions and ingests
"#;
        let _ = std::fs::write(&index_file, initial_index);
    }

    // Initialize log.md if absent
    let log_file = vault_path.join("log.md");
    if !log_file.exists() {
        let now = chrono::Local::now().format("%Y-%m-%d %H:%M").to_string();
        let initial_log = format!(
            "# Vault Activity Log\n\n## [{}] init | LifeMirror Knowledge Vault initialized\n",
            now
        );
        let _ = std::fs::write(&log_file, initial_log);
    }

    Ok(())
}

/// Syncs projects from the database to projects/ in the vault without overwriting existing files.
pub fn sync_projects_to_vault(db: &DbState, vault_path: &Path) -> Result<usize, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, description, created_at FROM projects")
        .map_err(|e| e.to_string())?;

    let projects_dir = vault_path.join("projects");
    let _ = std::fs::create_dir_all(&projects_dir);

    let rows = stmt
        .query_map([], |row| {
            let id: i64 = row.get(0)?;
            let name: String = row.get(1)?;
            let description: Option<String> = row.get(2)?;
            let created_at: Option<String> = row.get(3)?;
            Ok((id, name, description, created_at))
        })
        .map_err(|e| e.to_string())?;

    let mut count = 0;
    let mut synced_slugs = Vec::new();
    for proj in rows.flatten() {
        let (id, name, description, created_at) = proj;
        let clean_name = name.trim().to_lowercase().replace(' ', "-");
        if clean_name.is_empty() {
            continue;
        }

        let linked_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM node_projects WHERE project_id = ?1",
                rusqlite::params![id],
                |r| r.get(0),
            )
            .unwrap_or(0);

        let file_path = projects_dir.join(format!("{clean_name}.md"));
        if !file_path.exists() {
            let desc_str = description.unwrap_or_else(|| "Active development project tracked by LifeMirror.".to_string());
            let created_str = created_at.unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string());

            let content = format!(
                "---\ntitle: \"{name}\"\ntype: project\nstatus: active\nlinked_sessions: {linked_count}\ncreated: \"{created_str}\"\n---\n\n# Project: {name}\n\n## 📌 Overview\n{desc_str}\n\n## 🕒 Activity Stats\n- **Linked Sessions**: {linked_count} sessions recorded across editors and tools.\n\n## 🔗 Connected Notes\n- [[index]] — Knowledge Vault Index\n- [[log]] — Master Activity Log\n"
            );

            let _ = std::fs::write(&file_path, content);
            count += 1;
        }
        synced_slugs.push((clean_name, name));
    }

    // Ensure synced projects are listed in index.md
    let index_file = vault_path.join("index.md");
    if index_file.exists() {
        if let Ok(mut idx_content) = std::fs::read_to_string(&index_file) {
            let mut modified = false;
            for (slug, orig_title) in synced_slugs {
                let link = format!("[[projects/{slug}]]");
                if !idx_content.contains(&link) {
                    if let Some(pos) = idx_content.find("## 📌 Projects") {
                        if let Some(nl) = idx_content[pos..].find('\n') {
                            let insert_pos = pos + nl + 1;
                            idx_content.insert_str(insert_pos, &format!("- {link} — {orig_title} project\n"));
                            modified = true;
                        }
                    }
                }
            }
            if modified {
                let _ = std::fs::write(&index_file, idx_content);
            }
        }
    }

    Ok(count)
}

/// Syncs recent memory nodes and activities from the database to sessions/ in the vault without overwriting existing files.
pub fn sync_recent_sessions_to_vault(db: &DbState, vault_path: &Path) -> Result<usize, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let sessions_dir = vault_path.join("sessions");
    let _ = std::fs::create_dir_all(&sessions_dir);

    let mut count = 0;

    // 1. Sync from memory_nodes (AI consolidated sessions)
    let mut stmt = conn
        .prepare(
            "SELECT id, title, summary, timestamp FROM memory_nodes 
             WHERE title IS NOT NULL AND title != '' 
             ORDER BY id DESC LIMIT 30",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let id: i64 = row.get(0)?;
            let title: String = row.get(1)?;
            let summary: Option<String> = row.get(2)?;
            let timestamp: String = row.get(3)?;
            Ok((id, title, summary, timestamp))
        })
        .map_err(|e| e.to_string())?;

    for item in rows.flatten() {
        let (id, title, summary, timestamp) = item;
        let date_part = timestamp.split('T').next().or_else(|| timestamp.split(' ').next()).unwrap_or("session").replace('-', "");
        let clean_slug = title.to_lowercase()
            .replace(|c: char| !c.is_alphanumeric(), "-")
            .trim_matches('-')
            .chars()
            .take(30)
            .collect::<String>();
        let filename = format!("{date_part}_session_{id}_{clean_slug}.md");
        let file_path = sessions_dir.join(&filename);

        if !file_path.exists() {
            let sum_text = summary.unwrap_or_else(|| "Session recorded by LifeMirror.".to_string());

            // Query linked activities from session_activities
            let mut acts_md = String::new();
            if let Ok(mut act_stmt) = conn.prepare(
                "SELECT a.app_name, a.window_title, a.duration, a.url 
                 FROM activity_logs a 
                 JOIN session_activities sa ON a.id = sa.raw_id 
                 WHERE sa.node_id = ?1 AND sa.source = 'os' 
                 ORDER BY a.start_time ASC"
            ) {
                if let Ok(act_rows) = act_stmt.query_map([id], |r| {
                    let app: String = r.get(0)?;
                    let w_title: String = r.get(1)?;
                    let dur: i64 = r.get(2)?;
                    let url: Option<String> = r.get(3)?;
                    Ok((app, w_title, dur, url))
                }) {
                    for act in act_rows.flatten() {
                        let (app, w_title, dur, url) = act;
                        let mins = (dur / 60).max(1);
                        if let Some(u) = url {
                            if !u.is_empty() {
                                acts_md.push_str(&format!("- **{}** ({}m): [{}]({})\n", app, mins, w_title, u));
                                continue;
                            }
                        }
                        acts_md.push_str(&format!("- **{}** ({}m): {}\n", app, mins, w_title));
                    }
                }
            }

            let acts_section = if acts_md.is_empty() {
                String::new()
            } else {
                format!("\n## ⏱️ Activity Breakdown\n{acts_md}")
            };

            let content = format!(
                "---\ntitle: \"{title}\"\ntype: session\nsession_id: {id}\ndate: \"{date_part}\"\ntimestamp: \"{timestamp}\"\n---\n\n# Session: {title}\n\n## 🧠 Reflection & Synthesis\n{sum_text}\n{acts_section}\n## 🔗 Connected Notes\n- [[index]] — Knowledge Vault Index\n- [[log]] — Master Activity Log\n"
            );
            let _ = std::fs::write(&file_path, content);
            count += 1;
        }
    }

    // 2. Fallback: if memory_nodes has produced 0 notes, populate from recent raw activity logs
    if count == 0 {
        if let Ok(mut raw_stmt) = conn.prepare(
            "SELECT id, app_name, window_title, duration, start_time, url 
             FROM activity_logs 
             ORDER BY id DESC LIMIT 20"
        ) {
            if let Ok(raw_rows) = raw_stmt.query_map([], |r| {
                let id: i64 = r.get(0)?;
                let app: String = r.get(1)?;
                let title: String = r.get(2)?;
                let dur: i64 = r.get(3)?;
                let start: String = r.get(4)?;
                let url: Option<String> = r.get(5)?;
                Ok((id, app, title, dur, start, url))
            }) {
                for item in raw_rows.flatten() {
                    let (id, app, title, dur, start, url) = item;
                    let date_part = start.split('T').next().or_else(|| start.split(' ').next()).unwrap_or("session").replace('-', "");
                    let clean_slug = app.to_lowercase().replace(|c: char| !c.is_alphanumeric(), "-");
                    let filename = format!("{date_part}_act_{id}_{clean_slug}.md");
                    let file_path = sessions_dir.join(&filename);

                    if !file_path.exists() {
                        let mins = (dur / 60).max(1);
                        let url_md = url.map(|u| format!("\n- URL: [{u}]({u})")).unwrap_or_default();
                        let content = format!(
                            "---\ntitle: \"{app}: {title}\"\ntype: session\nactivity_id: {id}\ndate: \"{date_part}\"\ntimestamp: \"{start}\"\nduration: \"{mins}m\"\n---\n\n# Session: {app} — {title}\n\n## ⏱️ Activity Breakdown\n- **Application**: {app}\n- **Duration**: {mins} minutes\n- **Window**: {title}{url_md}\n\n## 🔗 Connected Notes\n- [[index]] — Knowledge Vault Index\n- [[log]] — Master Activity Log\n"
                        );
                        let _ = std::fs::write(&file_path, content);
                        count += 1;
                    }
                }
            }
        }
    }

    Ok(count)
}

/// Sanitizes relative paths to prevent directory traversal attacks and rejects empty paths.
fn sanitize_relative_path(rel_path: &str) -> Result<PathBuf, String> {
    let trimmed = rel_path.trim();
    if trimmed.is_empty() {
        return Err("Relative path cannot be empty".to_string());
    }
    let path = Path::new(trimmed);
    let mut component_count = 0;
    for component in path.components() {
        match component {
            std::path::Component::Normal(_) => {
                component_count += 1;
            }
            _ => return Err("Invalid path component (path traversal detected)".to_string()),
        }
    }
    if component_count == 0 {
        return Err("Relative path must contain at least one normal component".to_string());
    }
    Ok(path.to_path_buf())
}

/// Resolves a relative path safely within the vault root, preventing traversal and symlink escapes.
fn resolve_safe_vault_path(vault_root: &Path, rel_path: &str) -> Result<PathBuf, String> {
    let safe_rel = sanitize_relative_path(rel_path)?;
    let target = vault_root.join(&safe_rel);

    // If target exists, verify canonical path stays inside canonical vault root
    if target.exists() {
        if let (Ok(can_target), Ok(can_root)) = (target.canonicalize(), vault_root.canonicalize()) {
            if !can_target.starts_with(&can_root) {
                return Err("Symlink traversal outside vault sandbox detected".to_string());
            }
        }
    } else if let Some(parent) = target.parent() {
        if parent.exists() {
            if let (Ok(can_parent), Ok(can_root)) = (parent.canonicalize(), vault_root.canonicalize()) {
                if !can_parent.starts_with(&can_root) {
                    return Err("Symlink traversal outside vault sandbox detected".to_string());
                }
            }
        }
    }
    Ok(target)
}

#[tauri::command]
pub fn get_vault_directory(db: State<'_, Arc<DbState>>) -> Result<String, String> {
    let p = resolve_vault_path(&db);
    let _ = ensure_vault_initialized(&p);
    Ok(p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn set_vault_directory(db: State<'_, Arc<DbState>>, path: String) -> Result<String, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        let _ = db.set_setting(DEFAULT_VAULT_SETTING_KEY, "");
        let def = get_default_vault_path();
        let _ = ensure_vault_initialized(&def);
        return Ok(def.to_string_lossy().to_string());
    }

    let p = PathBuf::from(trimmed);
    ensure_vault_initialized(&p)?;
    db.set_setting(DEFAULT_VAULT_SETTING_KEY, trimmed)
        .map_err(|e| e.to_string())?;

    Ok(p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn sync_vault_all(db: State<'_, Arc<DbState>>) -> Result<usize, String> {
    let vault_path = resolve_vault_path(&db);
    ensure_vault_initialized(&vault_path)?;
    let p_count = sync_projects_to_vault(&db, &vault_path)?;
    let s_count = sync_recent_sessions_to_vault(&db, &vault_path)?;
    Ok(p_count + s_count)
}

#[tauri::command]
pub fn list_vault_files(db: State<'_, Arc<DbState>>) -> Result<VaultStructure, String> {
    let vault_path = resolve_vault_path(&db);
    ensure_vault_initialized(&vault_path)?;

    // Automatically sync projects and sessions from database if not already on disk
    let _ = sync_projects_to_vault(&db, &vault_path);
    let _ = sync_recent_sessions_to_vault(&db, &vault_path);

    let mut files = Vec::new();

    // Check root files (index.md, log.md, etc.)
    if let Ok(entries) = std::fs::read_dir(&vault_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
                if let Some(file_name) = path.file_name().and_then(|s| s.to_str()) {
                    let meta = entry.metadata().ok();
                    let updated_at = meta.as_ref().and_then(|m| m.modified().ok())
                        .map(|t| chrono::DateTime::<chrono::Local>::from(t).format("%Y-%m-%d %H:%M").to_string())
                        .unwrap_or_default();
                    let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);

                    files.push(VaultFileItem {
                        name: file_name.to_string(),
                        relative_path: file_name.to_string(),
                        category: "root".to_string(),
                        updated_at,
                        size,
                    });
                }
            }
        }
    }

    // Check categories: projects, topics, sessions, periodic
    for category in &["projects", "topics", "sessions", "periodic"] {
        let cat_dir = vault_path.join(category);
        if let Ok(entries) = std::fs::read_dir(&cat_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
                    if let Some(file_name) = path.file_name().and_then(|s| s.to_str()) {
                        let meta = entry.metadata().ok();
                        let updated_at = meta.as_ref().and_then(|m| m.modified().ok())
                            .map(|t| chrono::DateTime::<chrono::Local>::from(t).format("%Y-%m-%d %H:%M").to_string())
                            .unwrap_or_default();
                        let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);

                        files.push(VaultFileItem {
                            name: file_name.to_string(),
                            relative_path: format!("{category}/{file_name}"),
                            category: category.to_string(),
                            updated_at,
                            size,
                        });
                    }
                }
            }
        }
    }

    // Sort: root files first, then newest updated
    files.sort_by(|a, b| {
        if a.category == "root" && b.category != "root" {
            std::cmp::Ordering::Less
        } else if a.category != "root" && b.category == "root" {
            std::cmp::Ordering::Greater
        } else {
            b.updated_at.cmp(&a.updated_at)
        }
    });

    Ok(VaultStructure {
        vault_path: vault_path.to_string_lossy().to_string(),
        files,
    })
}

#[tauri::command]
pub fn read_vault_file(db: State<'_, Arc<DbState>>, relative_path: String) -> Result<String, String> {
    let vault_path = resolve_vault_path(&db);
    let full_path = resolve_safe_vault_path(&vault_path, &relative_path)?;

    if !full_path.exists() {
        return Err(format!("File does not exist: {relative_path}"));
    }

    std::fs::read_to_string(&full_path).map_err(|e| format!("Failed to read file: {e}"))
}

#[tauri::command]
pub fn write_vault_file(
    db: State<'_, Arc<DbState>>,
    relative_path: String,
    content: String,
) -> Result<(), String> {
    let vault_path = resolve_vault_path(&db);
    let full_path = resolve_safe_vault_path(&vault_path, &relative_path)?;

    if let Some(parent) = full_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    std::fs::write(&full_path, content).map_err(|e| format!("Failed to write file: {e}"))
}

/// Compiles a deterministic, structured Markdown session note from session data.
#[tauri::command]
pub fn compile_session_markdown(
    payload: SessionMarkdownPayload,
) -> Result<String, String> {
    let dur_mins = payload.duration_seconds / 60;
    let dur_formatted = if dur_mins == 0 {
        format!("{}s", payload.duration_seconds)
    } else {
        format!("{dur_mins}m")
    };

    let date_str = payload.start_time.split('T').next()
        .or_else(|| payload.start_time.split(' ').next())
        .unwrap_or("Unknown Date");

    let mut md = String::new();

    // 1. YAML Frontmatter
    md.push_str("---\n");
    md.push_str(&format!("title: \"{}\"\n", payload.title.replace('"', "\\\"")));
    md.push_str(&format!("date: \"{date_str}\"\n"));
    md.push_str(&format!("start_time: \"{}\"\n", payload.start_time));
    md.push_str(&format!("duration: \"{dur_formatted}\"\n"));
    md.push_str(&format!("app: \"{}\"\n", payload.app_name));
    md.push_str(&format!("category: \"{}\"\n", payload.category));
    md.push_str("type: session\n");
    md.push_str("---\n\n");

    // 2. Title & Overview
    md.push_str(&format!("# {}\n\n", payload.title));
    md.push_str(&format!("- **App / Context**: {}\n", payload.app_name));
    md.push_str(&format!("- **Duration**: {}\n", dur_formatted));
    md.push_str(&format!("- **Category**: {}\n", payload.category));
    md.push_str(&format!("- **Started**: {}\n\n", payload.start_time));

    // 3. User Reflection Notes (if recorded)
    if let Some(user_notes) = &payload.notes {
        if !user_notes.trim().is_empty() {
            md.push_str("## 💭 Personal Reflections\n\n");
            md.push_str(user_notes.trim());
            md.push_str("\n\n");
        }
    }

    // 4. AI Reflection / Summary
    md.push_str("## 🧠 Reflection & Synthesis\n\n");
    if let Some(summary) = &payload.ai_summary {
        if !summary.trim().is_empty() {
            md.push_str(summary.trim());
            md.push_str("\n\n");
        } else {
            md.push_str("*No AI reflection recorded yet for this session. Use the \"Enrich with AI\" button to synthesize key takeaways.*\n\n");
        }
    } else {
        md.push_str("*No AI reflection recorded yet for this session. Use the \"Enrich with AI\" button to synthesize key takeaways.*\n\n");
    }

    // 5. Chronological Breakdown
    md.push_str("## ⏱️ Timeline Journey\n\n");
    if payload.activities.is_empty() && payload.sub_events.is_empty() {
        md.push_str("*Single continuous session block.*\n\n");
    } else {
        if !payload.activities.is_empty() {
            for act in &payload.activities {
                let m = act.duration / 60;
                let d_str = if m > 0 { format!("{m}m") } else { format!("{}s", act.duration) };
                if let Some(url) = &act.url {
                    if !url.is_empty() {
                        md.push_str(&format!("- **{}** ({}): [{}]({})\n", act.app_name, d_str, act.title, url));
                    } else {
                        md.push_str(&format!("- **{}** ({}): {}\n", act.app_name, d_str, act.title));
                    }
                } else {
                    md.push_str(&format!("- **{}** ({}): {}\n", act.app_name, d_str, act.title));
                }
                if let Some(n) = &act.notes {
                    if !n.trim().is_empty() {
                        md.push_str(&format!("  > 💭 *Reflection: \"{}\"*\n", n.trim()));
                    }
                }
            }
            md.push_str("\n");
        }

        if !payload.sub_events.is_empty() {
            md.push_str("### Browser & Sub-Session Focus\n\n");
            for sub in &payload.sub_events {
                if let Some(uri) = &sub.primary_uri {
                    if !uri.is_empty() {
                        md.push_str(&format!("- [{}]({})\n", sub.title, uri));
                        if let Some(meta) = &sub.metadata {
                            if !meta.trim().is_empty() {
                                md.push_str(&format!("  > {}\n", meta.trim()));
                            }
                        }
                        continue;
                    }
                }
                md.push_str(&format!("- {}\n", sub.title));
            }
            md.push_str("\n");
        }
    }

    // 5. Connected Notes
    md.push_str("## 🔗 Connected Notes\n\n");
    md.push_str(&format!("- [[index]] — Knowledge Vault Index\n"));
    md.push_str(&format!("- [[log]] — Master Activity Log\n"));

    Ok(md)
}

/// Saves or updates a session markdown note in the vault and updates index.md and log.md.
#[tauri::command]
pub fn save_session_to_vault(
    db: State<'_, Arc<DbState>>,
    relative_filename: String,
    content: String,
    title: String,
) -> Result<String, String> {
    let vault_path = resolve_vault_path(&db);
    ensure_vault_initialized(&vault_path)?;

    // Ensure it is placed in sessions/ folder
    let clean_name = if relative_filename.starts_with("sessions/") {
        relative_filename
    } else {
        format!("sessions/{relative_filename}")
    };

    let safe_rel = sanitize_relative_path(&clean_name)?;
    let full_path = resolve_safe_vault_path(&vault_path, &clean_name)?;

    if let Some(parent) = full_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    std::fs::write(&full_path, &content).map_err(|e| format!("Failed to save session note: {e}"))?;

    // Append to log.md
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M").to_string();
    let log_file = vault_path.join("log.md");
    if log_file.exists() {
        if let Ok(mut log_text) = std::fs::read_to_string(&log_file) {
            let log_entry = format!("\n## [{}] Session | {}\n- Saved to: [[{}]]\n", now, title, safe_rel.to_string_lossy());
            log_text.push_str(&log_entry);
            let _ = std::fs::write(&log_file, log_text);
        }
    }

    Ok(clean_name)
}

/// Enriches a session with AI synthesis using the currently active inference provider (Ollama or Cloud).
#[tauri::command]
pub async fn enrich_session_note(
    state: State<'_, Arc<DbState>>,
    session_title: String,
    activities_summary: String,
) -> Result<String, String> {
    use crate::inference::get_inference_provider;
    let provider = get_inference_provider(state.inner().clone());
    let prompt = format!(
        "You are an expert engineering productivity synthesist. Analyze this work session: '{}'.\n\
        Activities breakdown:\n{}\n\n\
        Write a concise, 2-3 sentence technical synthesis of what was accomplished, what topics were researched, and any key takeaways. Be direct, factual, and insightful. Do not include conversational filler.",
        session_title, activities_summary
    );
    provider.prompt(&prompt).await.map_err(|e| e.to_string())
}

/// Format duration seconds into a human-friendly short string like "5h 24m" or "45m".
pub fn format_duration_short(seconds: i64) -> String {
    let hours = seconds / 3600;
    let mins = (seconds % 3600) / 60;
    if hours > 0 {
        format!("{}h {}m", hours, mins)
    } else {
        format!("{}m", mins.max(1))
    }
}

/// Helper to compute start/end dates, human title, and relative filename for periodic notes.
pub fn parse_period_bounds(period_type: &str, date_key: &str) -> (String, String, String, String) {
    let clean_date = date_key.trim();
    match period_type {
        "week" => {
            let d = chrono::NaiveDate::parse_from_str(clean_date, "%Y-%m-%d")
                .unwrap_or_else(|_| chrono::Local::now().date_naive());
            let days_from_monday = d.weekday().num_days_from_monday();
            let monday = d - chrono::Duration::days(days_from_monday as i64);
            let sunday = monday + chrono::Duration::days(6);
            let start = monday.format("%Y-%m-%d").to_string();
            let end = sunday.format("%Y-%m-%d").to_string();
            let iso_week = d.iso_week();
            let title = format!("Weekly Review — Week {:02} ({} – {})", iso_week.week(), monday.format("%b %-d"), sunday.format("%b %-d, %Y"));
            let filename = format!("periodic/weekly_{}-W{:02}.md", iso_week.year(), iso_week.week());
            (start, end, title, filename)
        }
        "month" => {
            let (year, month) = if clean_date.len() >= 7 && clean_date.contains('-') {
                let parts: Vec<&str> = clean_date.split('-').collect();
                let now = chrono::Local::now();
                let y = parts[0].parse::<i32>().unwrap_or_else(|_| now.year());
                let m = parts[1].parse::<u32>().unwrap_or_else(|_| now.month());
                let safe_y = if (1970..=2200).contains(&y) { y } else { now.year() };
                let safe_m = if (1..=12).contains(&m) { m } else { now.month() };
                (safe_y, safe_m)
            } else {
                let now = chrono::Local::now();
                (now.year(), now.month())
            };
            let start = format!("{year}-{month:02}-01");
            let next_m = if month == 12 { (year + 1, 1) } else { (year, month + 1) };
            let fallback_date = chrono::Local::now().date_naive();
            let first_next = chrono::NaiveDate::from_ymd_opt(next_m.0, next_m.1, 1)
                .unwrap_or_else(|| chrono::NaiveDate::from_ymd_opt(year, 12, 31).unwrap_or(fallback_date));
            let last_day = first_next - chrono::Duration::days(1);
            let end = last_day.format("%Y-%m-%d").to_string();
            let month_name = chrono::NaiveDate::from_ymd_opt(year, month, 1)
                .map(|d| d.format("%B %Y").to_string())
                .unwrap_or_else(|| format!("{year}-{month:02}"));
            let title = format!("Monthly Review — {month_name}");
            let filename = format!("periodic/monthly_{year}-{month:02}.md");
            (start, end, title, filename)
        }
        _ => { // default to "day"
            let d = chrono::NaiveDate::parse_from_str(clean_date, "%Y-%m-%d")
                .unwrap_or_else(|_| chrono::Local::now().date_naive());
            let day_str = d.format("%Y-%m-%d").to_string();
            let day_pretty = d.format("%A, %b %-d, %Y").to_string();
            let title = format!("Daily Review — {day_pretty}");
            let filename = format!("periodic/daily_{day_str}.md");
            (day_str.clone(), day_str, title, filename)
        }
    }
}

/// Helper to return all weeks touching a specific year/month.
pub fn get_weeks_for_month(year: i32, month: u32) -> Vec<(String, String, String, String)> {
    let mut weeks = Vec::new();
    let mut seen_weeks = std::collections::HashSet::new();

    let safe_month = if (1..=12).contains(&month) { month } else { chrono::Local::now().month() };
    let safe_year = if (1970..=2200).contains(&year) { year } else { chrono::Local::now().year() };

    let fallback_first = chrono::NaiveDate::from_ymd_opt(safe_year, safe_month, 1)
        .unwrap_or_else(|| chrono::Local::now().date_naive());
    let next_m = if safe_month == 12 { (safe_year + 1, 1) } else { (safe_year, safe_month + 1) };
    let first_next = chrono::NaiveDate::from_ymd_opt(next_m.0, next_m.1, 1)
        .unwrap_or_else(|| chrono::NaiveDate::from_ymd_opt(safe_year, 12, 31).unwrap_or(fallback_first));
    let last_day = first_next - chrono::Duration::days(1);

    let mut curr = fallback_first;
    while curr <= last_day {
        let iso_week = curr.iso_week();
        let week_key = (iso_week.year(), iso_week.week());
        if !seen_weeks.contains(&week_key) {
            seen_weeks.insert(week_key);

            let days_from_monday = curr.weekday().num_days_from_monday();
            let monday = curr - chrono::Duration::days(days_from_monday as i64);
            let sunday = monday + chrono::Duration::days(6);

            let week_file = format!("periodic/weekly_{}-W{:02}", iso_week.year(), iso_week.week());
            let week_label = format!("Week {:02} ({} – {})", iso_week.week(), monday.format("%b %-d"), sunday.format("%b %-d"));
            let start_str = monday.format("%Y-%m-%d").to_string();
            let end_str = sunday.format("%Y-%m-%d").to_string();

            weeks.push((week_file, week_label, start_str, end_str));
        }
        curr += chrono::Duration::days(1);
    }
    weeks
}

/// Helper to return the 7 days of a week starting from a Monday date.
pub fn get_days_for_week(monday_str: &str) -> Vec<(String, String, String)> {
    let mut days = Vec::new();
    if let Ok(monday) = chrono::NaiveDate::parse_from_str(monday_str, "%Y-%m-%d") {
        for i in 0..7 {
            let day = monday + chrono::Duration::days(i);
            let day_str = day.format("%Y-%m-%d").to_string();
            let day_pretty = day.format("%A, %b %-d").to_string();
            let day_file = format!("periodic/daily_{day_str}");
            days.push((day_str, day_pretty, day_file));
        }
    }
    days
}

/// Helper to check if a session file stem starts with a date in [start_date, end_date].
pub fn matches_period_range(file_stem: &str, start_date: &str, end_date: &str) -> bool {
    let start_compact = start_date.replace('-', "");
    let end_compact = end_date.replace('-', "");

    if file_stem.len() >= 8 {
        let prefix = &file_stem[0..8];
        if prefix.chars().all(|c| c.is_ascii_digit()) {
            return prefix >= start_compact.as_str() && prefix <= end_compact.as_str();
        }
    }
    false
}

/// Helper to extract human-readable session labels from session note files.
pub fn get_curated_day_sessions(vault_path: &Path, date_str: &str) -> Vec<(String, String)> {
    let sessions_dir = vault_path.join("sessions");
    let mut sessions = Vec::new();

    if let Ok(entries) = std::fs::read_dir(&sessions_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    if matches_period_range(stem, date_str, date_str) {
                        let (label, dur_secs) = parse_session_file_label(&path, stem);
                        if dur_secs >= 120 || dur_secs == 0 {
                            sessions.push((stem.to_string(), label));
                        }
                    }
                }
            }
        }
    }

    sessions.sort_by(|a, b| a.0.cmp(&b.0));
    sessions
}

fn parse_session_file_label(path: &Path, stem: &str) -> (String, i64) {
    let mut title = String::new();
    let mut time_str = String::new();
    let mut dur_str = String::new();
    let mut dur_secs: i64 = 0;

    if let Ok(content) = std::fs::read_to_string(path) {
        for line in content.lines().take(20) {
            let trimmed = line.trim();
            if trimmed.starts_with("title:") {
                title = trimmed.trim_start_matches("title:").trim().trim_matches('"').to_string();
            } else if trimmed.starts_with("timestamp:") {
                let raw_ts = trimmed.trim_start_matches("timestamp:").trim().trim_matches('"');
                if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(raw_ts) {
                    time_str = dt.with_timezone(&chrono::Local).format("%I:%M %p").to_string();
                } else if raw_ts.len() >= 16 {
                    time_str = raw_ts[11..16].to_string();
                }
            } else if trimmed.starts_with("duration:") {
                dur_str = trimmed.trim_start_matches("duration:").trim().trim_matches('"').to_string();
            } else if trimmed.starts_with("duration_seconds:") {
                dur_secs = trimmed.trim_start_matches("duration_seconds:").trim().parse::<i64>().unwrap_or(0);
            }
        }
    }

    if title.is_empty() {
        let parts: Vec<&str> = stem.split('_').collect();
        let raw_name = parts.last().unwrap_or(&stem);
        title = raw_name.replace('-', " ")
            .split_whitespace()
            .map(|w| {
                let mut c = w.chars();
                match c.next() {
                    None => String::new(),
                    Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
                }
            })
            .collect::<Vec<_>>()
            .join(" ");
    }

    if time_str.is_empty() {
        let parts: Vec<&str> = stem.split('_').collect();
        if parts.len() >= 2 && parts[1].len() == 4 && parts[1].chars().all(|c| c.is_ascii_digit()) {
            time_str = format!("{}:{}", &parts[1][0..2], &parts[1][2..4]);
        }
    }

    let time_prefix = if !time_str.is_empty() { format!("{time_str} – ") } else { String::new() };
    let dur_suffix = if !dur_str.is_empty() {
        format!(" ({dur_str})")
    } else if dur_secs > 0 {
        format!(" ({})", format_duration_short(dur_secs))
    } else {
        String::new()
    };

    (format!("{time_prefix}{title}{dur_suffix}"), dur_secs)
}

/// Compiles a periodic review note (day, week, or month), saves it to periodic/, and returns its relative path.
#[tauri::command]
pub async fn compile_period_note(
    db: State<'_, Arc<DbState>>,
    period_type: String,
    date_key: String,
) -> Result<String, String> {
    let vault_path = resolve_vault_path(&db);
    ensure_vault_initialized(&vault_path)?;

    let periodic_dir = vault_path.join("periodic");
    let _ = std::fs::create_dir_all(&periodic_dir);

    let (start_date, end_date, period_title, filename) = parse_period_bounds(&period_type, &date_key);

    let (total_duration, app_breakdown, project_breakdown) = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;

        // 1. Fetch activities in date range
        let mut act_stmt = conn
            .prepare(
                "SELECT app_name, window_title, duration, start_time 
                 FROM activity_logs 
                 WHERE date(start_time, 'localtime') >= ?1 AND date(start_time, 'localtime') <= ?2 
                 ORDER BY start_time ASC",
            )
            .map_err(|e| e.to_string())?;

        let rows = act_stmt
            .query_map([&start_date, &end_date], |row| {
                let app: String = row.get(0)?;
                let title: String = row.get(1)?;
                let dur: i64 = row.get(2)?;
                let start: String = row.get(3)?;
                Ok((app, title, dur, start))
            })
            .map_err(|e| e.to_string())?;

        let mut total_dur: i64 = 0;
        let mut app_map: std::collections::HashMap<String, i64> = std::collections::HashMap::new();

        for item in rows.flatten() {
            let (app, _title, dur, _start) = item;
            total_dur += dur;
            *app_map.entry(app).or_insert(0) += dur;
        }

        // 2. Fetch projects in date range
        let mut proj_map: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
        if let Ok(mut p_stmt) = conn.prepare(
            "SELECT p.name, SUM(a.duration) 
             FROM projects p 
             JOIN node_projects np ON p.id = np.project_id 
             JOIN session_activities sa ON np.node_id = sa.node_id 
             JOIN activity_logs a ON sa.raw_id = a.id 
             WHERE sa.source = 'os' AND date(a.start_time, 'localtime') >= ?1 AND date(a.start_time, 'localtime') <= ?2 
             GROUP BY p.name",
        ) {
            if let Ok(p_rows) = p_stmt.query_map([&start_date, &end_date], |r| {
                let p_name: String = r.get(0)?;
                let p_dur: i64 = r.get(1)?;
                Ok((p_name, p_dur))
            }) {
                for item in p_rows.flatten() {
                    let (p_name, p_dur) = item;
                    proj_map.insert(p_name, p_dur);
                }
            }
        }

        (total_dur, app_map, proj_map)
    };

    let dur_display = format_duration_short(total_duration);

    let mut sorted_apps: Vec<(String, i64)> = app_breakdown.into_iter().collect();
    sorted_apps.sort_by(|a, b| b.1.cmp(&a.1));

    let mut sorted_projs: Vec<(String, i64)> = project_breakdown.into_iter().collect();
    sorted_projs.sort_by(|a, b| b.1.cmp(&a.1));

    // Determine 3-tier hierarchy content (Monthly -> Weeks, Weekly -> Days, Daily -> Sessions)
    let (breadcrumbs, breakdown_section, extra_fm_key, extra_fm_val) = match period_type.as_str() {
        "month" => {
            let (year, month) = if start_date.len() >= 7 && start_date.contains('-') {
                let parts: Vec<&str> = start_date.split('-').collect();
                (parts[0].parse::<i32>().unwrap_or(2026), parts[1].parse::<u32>().unwrap_or(11))
            } else {
                (2026, 11)
            };
            let weeks = get_weeks_for_month(year, month);
            let mut lines = Vec::new();
            if let Ok(conn) = db.conn.lock() {
                for (w_file, w_label, w_start, w_end) in &weeks {
                    let dur: i64 = conn.query_row(
                        "SELECT COALESCE(SUM(duration), 0) FROM activity_logs WHERE date(start_time, 'localtime') >= ?1 AND date(start_time, 'localtime') <= ?2",
                        rusqlite::params![w_start, w_end],
                        |r| r.get(0),
                    ).unwrap_or(0);

                    let top_proj: Option<String> = conn.query_row(
                        "SELECT p.name FROM projects p 
                         JOIN node_projects np ON p.id = np.project_id 
                         JOIN session_activities sa ON np.node_id = sa.node_id 
                         JOIN activity_logs a ON sa.raw_id = a.id 
                         WHERE sa.source = 'os' AND date(a.start_time, 'localtime') >= ?1 AND date(a.start_time, 'localtime') <= ?2 
                         GROUP BY p.name ORDER BY SUM(a.duration) DESC LIMIT 1",
                        rusqlite::params![w_start, w_end],
                        |r| r.get(0),
                    ).ok();

                    let time_str = format_duration_short(dur);
                    let clean_proj = top_proj.as_ref().map(|p| p.trim().to_lowercase().replace(' ', "-")).unwrap_or_default();
                    let proj_badge = top_proj.map(|p| format!(" • 🚀 [[projects/{clean_proj}|{p}]]")).unwrap_or_default();
                    lines.push(format!("- [[{w_file}|{w_label}]] — **{time_str}**{proj_badge}"));
                }
            }
            let weeks_count = weeks.len();
            let bc = "> [[index|🏠 Knowledge Vault Index]] > **Monthly Review**\n\n".to_string();
            let section = format!("## 📅 Weekly Reviews in this Month\n{}\n", lines.join("\n"));
            (bc, section, "weeks_count", weeks_count.to_string())
        }
        "week" => {
            let days = get_days_for_week(&start_date);
            let mut lines = Vec::new();
            let mut active_days_count = 0;
            if let Ok(conn) = db.conn.lock() {
                for (d_str, d_pretty, d_file) in &days {
                    let dur: i64 = conn.query_row(
                        "SELECT COALESCE(SUM(duration), 0) FROM activity_logs WHERE date(start_time, 'localtime') = ?1",
                        rusqlite::params![d_str],
                        |r| r.get(0),
                    ).unwrap_or(0);

                    let top_proj: Option<String> = conn.query_row(
                        "SELECT p.name FROM projects p 
                         JOIN node_projects np ON p.id = np.project_id 
                         JOIN session_activities sa ON np.node_id = sa.node_id 
                         JOIN activity_logs a ON sa.raw_id = a.id 
                         WHERE sa.source = 'os' AND date(a.start_time, 'localtime') = ?1 
                         GROUP BY p.name ORDER BY SUM(a.duration) DESC LIMIT 1",
                        rusqlite::params![d_str],
                        |r| r.get(0),
                    ).ok();

                    if dur > 0 {
                        active_days_count += 1;
                        let time_str = format_duration_short(dur);
                        let clean_proj = top_proj.as_ref().map(|p| p.trim().to_lowercase().replace(' ', "-")).unwrap_or_default();
                        let proj_badge = top_proj.map(|p| format!(" • 🚀 [[projects/{clean_proj}|{p}]]")).unwrap_or_default();
                        lines.push(format!("- [[{d_file}|{d_pretty}]] — **{time_str}**{proj_badge}"));
                    } else {
                        lines.push(format!("- **{d_pretty}** — *(Offline / Rest)*"));
                    }
                }
            }
            let parent_month = if start_date.len() >= 7 { &start_date[0..7] } else { "2026-11" };
            let bc = format!("> [[index|🏠 Knowledge Vault]] > [[periodic/monthly_{parent_month}|🗓️ Month Review]] > **Week Review**\n\n");
            let section = format!("## ☀️ Daily Reviews in this Week\n{}\n", lines.join("\n"));
            (bc, section, "active_days", active_days_count.to_string())
        }
        _ => { // "day"
            let sessions = get_curated_day_sessions(&vault_path, &start_date);
            let lines: Vec<String> = if sessions.is_empty() {
                vec!["- *(No major work sessions recorded today)*".to_string()]
            } else {
                sessions.iter().map(|(stem, label)| format!("- [[sessions/{stem}|{label}]]")).collect()
            };
            let sessions_count = sessions.len();

            let d = chrono::NaiveDate::parse_from_str(&start_date, "%Y-%m-%d").unwrap_or_else(|_| chrono::Local::now().date_naive());
            let iso_week = d.iso_week();
            let bc = format!("> [[index|🏠 Knowledge Vault]] > [[periodic/weekly_{}-W{:02}|📅 Week {:02} Review]] > **Day Review**\n\n", iso_week.year(), iso_week.week(), iso_week.week());
            let section = format!("## ⏱️ Major Work Sessions\n{}\n", lines.join("\n"));
            (bc, section, "sessions_count", sessions_count.to_string())
        }
    };

    // AI executive synthesis tailored by review level
    let top_apps_summary = sorted_apps.iter().take(3).map(|(app, dur)| format!("{} ({})", app, format_duration_short(*dur))).collect::<Vec<_>>().join(", ");
    let projects_summary = if sorted_projs.is_empty() {
        "General tasks and tooling".to_string()
    } else {
        sorted_projs.iter().take(3).map(|(p, dur)| format!("{} ({})", p, format_duration_short(*dur))).collect::<Vec<_>>().join(", ")
    };

    let prompt = format!(
        "You are an executive productivity intelligence assistant. Summarize this work review: '{}' ({} to {}).\n\
        Total active work time: {}.\n\
        Top applications used: {}.\n\
        Active projects: {}.\n\n\
        Write a concise, high-impact 2-3 sentence executive review highlighting accomplishments, technical focus areas, and momentum. Do not use conversational filler.",
        period_title, start_date, end_date, dur_display,
        if top_apps_summary.is_empty() { "None recorded" } else { &top_apps_summary },
        projects_summary
    );

    let provider = crate::inference::get_inference_provider(db.inner().clone());
    let ai_summary = provider.prompt(&prompt).await.unwrap_or_else(|_| {
        format!(
            "Recorded {} of active work across {} from {} to {}.",
            dur_display,
            if top_apps_summary.is_empty() { "applications" } else { &top_apps_summary },
            start_date, end_date
        )
    });

    // Build Distribution Table
    let mut distribution_table = String::from("| Tool / Project | Duration | Share |\n|---|---|---|\n");
    if sorted_projs.is_empty() && sorted_apps.is_empty() {
        distribution_table.push_str("| *(No activity recorded in this period)* | 0m | 0% |\n");
    } else {
        for (proj, dur) in &sorted_projs {
            let pct = if total_duration > 0 { (*dur as f64 / total_duration as f64 * 100.0).round() as i64 } else { 0 };
            let clean_slug = proj.trim().to_lowercase().replace(' ', "-");
            let time_str = format_duration_short(*dur);
            distribution_table.push_str(&format!("| [[projects/{clean_slug}\\|{proj}]] | {time_str} | {pct}% |\n"));
        }
        for (app, dur) in sorted_apps.iter().take(5) {
            let pct = if total_duration > 0 { (*dur as f64 / total_duration as f64 * 100.0).round() as i64 } else { 0 };
            let time_str = format_duration_short(*dur);
            distribution_table.push_str(&format!("| {app} | {time_str} | {pct}% |\n"));
        }
    }

    let top_proj_name = sorted_projs.first().map(|(p, _)| p.as_str()).unwrap_or("General");

    let content = format!(
        "---\ntitle: \"{period_title}\"\ntype: periodic\nperiod: {period_type}\nstart_date: \"{start_date}\"\nend_date: \"{end_date}\"\nactive_duration: \"{dur_display}\"\ntotal_seconds: {total_duration}\ntop_project: \"{top_proj_name}\"\n{extra_fm_key}: {extra_fm_val}\n---\n\n{breadcrumbs}# {period_title}\n\n## 🧠 Executive Synthesis\n{ai_summary}\n\n## 📊 Distribution & Projects\n{distribution_table}\n{breakdown_section}\n## 🔗 Connected Notes\n- [[index]] — Knowledge Vault Index\n- [[log]] — Master Activity Log\n"
    );

    let full_path = vault_path.join(&filename);
    std::fs::write(&full_path, &content).map_err(|e| format!("Failed to save periodic note: {e}"))?;

    // Update index.md with link under Periodic Notes
    let index_file = vault_path.join("index.md");
    if index_file.exists() {
        if let Ok(mut idx_content) = std::fs::read_to_string(&index_file) {
            let stem = Path::new(&filename).file_stem().and_then(|s| s.to_str()).unwrap_or("note");
            let link = format!("[[periodic/{stem}]]");
            if !idx_content.contains(&link) {
                if let Some(pos) = idx_content.find("### 📅 Periodic Notes") {
                    if let Some(nl) = idx_content[pos..].find('\n') {
                        let insert_pos = pos + nl + 1;
                        idx_content.insert_str(insert_pos, &format!("- {link} — {period_title}\n"));
                        let _ = std::fs::write(&index_file, idx_content);
                    }
                }
            }
        }
    }

    // Append to log.md
    let log_file = vault_path.join("log.md");
    if log_file.exists() {
        if let Ok(mut log_text) = std::fs::read_to_string(&log_file) {
            let now = chrono::Local::now().format("%Y-%m-%d %H:%M").to_string();
            let log_entry = format!("\n## [{}] Periodic | {}\n- Compiled to: [[{}]]\n", now, period_title, filename.trim_end_matches(".md"));
            log_text.push_str(&log_entry);
            let _ = std::fs::write(&log_file, log_text);
        }
    }

    Ok(filename)
}

/// Moves a vault note to .trash/ and cleanly removes references to it from index.md and log.md.
#[tauri::command]
pub fn delete_vault_file(db: State<'_, Arc<DbState>>, relative_path: String) -> Result<(), String> {
    let vault_path = resolve_vault_path(&db);
    let target_path = resolve_safe_vault_path(&vault_path, &relative_path)?;

    if !target_path.exists() {
        return Err(format!("File '{}' does not exist in vault", relative_path));
    }

    // Do not allow deleting index.md or log.md directly, or empty root
    let file_name = target_path.file_name().and_then(|s| s.to_str()).unwrap_or_default();
    if file_name == "index.md" || file_name == "log.md" || file_name.is_empty() {
        return Err("Cannot delete core system notes or vault root".to_string());
    }

    let trash_dir = vault_path.join(".trash");
    let _ = std::fs::create_dir_all(&trash_dir);

    let mut dest_path = trash_dir.join(file_name);
    if dest_path.exists() {
        let ts = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
        let stem = Path::new(file_name).file_stem().and_then(|s| s.to_str()).unwrap_or("note");
        let ext = Path::new(file_name).extension().and_then(|s| s.to_str()).unwrap_or("md");
        dest_path = trash_dir.join(format!("{}_{}.{}", stem, ts, ext));
    }

    std::fs::rename(&target_path, &dest_path).map_err(|e| format!("Failed to move file to .trash: {e}"))?;

    // Reference scrubbing from index.md and log.md (handles both exact and aliased links)
    scrub_references_from_file(&vault_path.join("index.md"), &relative_path);
    scrub_references_from_file(&vault_path.join("log.md"), &relative_path);

    Ok(())
}

fn scrub_references_from_file(file_path: &Path, rel_path: &str) {
    if !file_path.exists() {
        return;
    }
    if let Ok(content) = std::fs::read_to_string(file_path) {
        let clean_target = rel_path.trim_end_matches(".md");
        let bare_name = if let Some(slash_idx) = clean_target.rfind('/') {
            &clean_target[slash_idx + 1..]
        } else {
            clean_target
        };

        let target_exact = format!("[[{clean_target}]]");
        let target_alias = format!("[[{clean_target}|");
        let target_alias_esc = format!("[[{clean_target}\\|");

        let bare_exact = format!("[[{bare_name}]]");
        let bare_alias = format!("[[{bare_name}|");
        let bare_alias_esc = format!("[[{bare_name}\\|");

        let mut lines = Vec::new();
        let mut changed = false;
        for line in content.lines() {
            if line.contains(&target_exact)
                || line.contains(&target_alias)
                || line.contains(&target_alias_esc)
                || line.contains(&bare_exact)
                || line.contains(&bare_alias)
                || line.contains(&bare_alias_esc)
            {
                changed = true;
                continue;
            }
            lines.push(line);
        }

        if changed {
            let new_content = lines.join("\n") + "\n";
            let _ = std::fs::write(file_path, new_content);
        }
    }
}

/// Moves all existing notes in projects/, topics/, sessions/, and periodic/ to .trash/vault_archive_<timestamp>/
/// and restores clean baseline index.md and log.md files.
/// The encrypted SQLite tracking database is 100% untouched.
#[tauri::command]
pub fn clear_and_archive_vault(db: State<'_, Arc<DbState>>) -> Result<String, String> {
    let vault_path = resolve_vault_path(&db);
    ensure_vault_initialized(&vault_path)?;

    let now_str = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    let archive_dir_name = format!("vault_archive_{now_str}");
    let archive_path = vault_path.join(".trash").join(&archive_dir_name);
    std::fs::create_dir_all(&archive_path).map_err(|e| format!("Failed to create archive directory: {e}"))?;

    for cat in &["projects", "topics", "sessions", "periodic"] {
        let cat_path = vault_path.join(cat);
        if cat_path.exists() {
            let dest_cat = archive_path.join(cat);
            let _ = std::fs::rename(&cat_path, &dest_cat);
            let _ = std::fs::create_dir_all(&cat_path);
        }
    }

    // Reset index.md to clean baseline
    let index_file = vault_path.join("index.md");
    let baseline_index = r#"# LifeMirror Knowledge Vault Index

Welcome to your personal LifeMirror Knowledge Vault. This directory is automatically maintained as an interlinked, persistent second brain conforming to the Karpathy LLM Wiki pattern.

### 🚀 Projects
- *Active projects will appear here as you work.*

### 💡 Topics & Learnings
- [[topics/getting-started]] — How your knowledge vault works

### 📅 Periodic Notes
- *Day, week, and month roll-up reviews appear here.*

### ⏱️ Recent Sessions
- *New session notes appear automatically as you work.*

### 📜 System Logs
- [[log]] — Chronological ledger of all work sessions and ingests
"#;
    let _ = std::fs::write(&index_file, baseline_index);

    // Reset log.md to clean baseline
    let log_file = vault_path.join("log.md");
    let log_now = chrono::Local::now().format("%Y-%m-%d %H:%M").to_string();
    let baseline_log = format!(
        "# Vault Activity Log\n\n## [{}] reset | Vault archived to .trash/{} and re-initialized\n",
        log_now, archive_dir_name
    );
    let _ = std::fs::write(&log_file, baseline_log);

    Ok(format!(".trash/{}", archive_dir_name))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_relative_path() {
        assert!(sanitize_relative_path("projects/lifemirror.md").is_ok());
        assert!(sanitize_relative_path("sessions/2026-11-16_0445_coding.md").is_ok());
        assert!(sanitize_relative_path("index.md").is_ok());

        assert!(sanitize_relative_path("").is_err());
        assert!(sanitize_relative_path("   ").is_err());
        assert!(sanitize_relative_path("../secret.txt").is_err());
        assert!(sanitize_relative_path("/etc/passwd").is_err());
        assert!(sanitize_relative_path("projects/../../etc/passwd").is_err());
    }

    #[test]
    fn test_compile_session_markdown() {
        let payload = SessionMarkdownPayload {
            session_id: Some(42),
            title: "Development Session".to_string(),
            start_time: "2026-11-16T04:45:00Z".to_string(),
            duration_seconds: 3600,
            app_name: "Antigravity IDE".to_string(),
            category: "💻 Development".to_string(),
            activities: vec![
                ActivitySummary {
                    title: "Editing background.js".to_string(),
                    app_name: "Antigravity IDE".to_string(),
                    duration: 1800,
                    url: None,
                    notes: None,
                },
                ActivitySummary {
                    title: "Web Store Package Info".to_string(),
                    app_name: "Google-chrome".to_string(),
                    duration: 1800,
                    url: Some("https://chrome.google.com/webstore".to_string()),
                    notes: None,
                },
            ],
            sub_events: vec![],
            ai_summary: Some("Refactored native host communication.".to_string()),
            notes: None,
        };

        let md = compile_session_markdown(payload).unwrap();
        assert!(md.contains("title: \"Development Session\""));
        assert!(md.contains("duration: \"60m\""));
        assert!(md.contains("## 🧠 Reflection & Synthesis"));
        assert!(md.contains("Refactored native host communication."));
        assert!(md.contains("## ⏱️ Timeline Journey"));
        assert!(md.contains("[Web Store Package Info](https://chrome.google.com/webstore)"));
    }

    #[test]
    fn test_ensure_vault_initialized() {
        let temp_dir = std::env::temp_dir().join(format!("lm_vault_test_{}", uuid::Uuid::new_v4().simple()));
        let res = ensure_vault_initialized(&temp_dir);
        assert!(res.is_ok());
        assert!(temp_dir.join("index.md").exists());
        assert!(temp_dir.join("log.md").exists());
        assert!(temp_dir.join("projects").is_dir());
        assert!(temp_dir.join("topics").is_dir());
        assert!(temp_dir.join("sessions").is_dir());
        assert!(temp_dir.join("periodic").is_dir());
        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_parse_period_bounds() {
        let (s_day, e_day, title_day, file_day) = parse_period_bounds("day", "2026-11-16");
        assert_eq!(s_day, "2026-11-16");
        assert_eq!(e_day, "2026-11-16");
        assert!(title_day.contains("Daily Review"));
        assert_eq!(file_day, "periodic/daily_2026-11-16.md");

        let (s_week, e_week, title_week, file_week) = parse_period_bounds("week", "2026-11-16");
        assert_eq!(s_day, s_week); // Monday 2026-11-16
        assert_eq!(e_week, "2026-11-22"); // Sunday
        assert!(title_week.contains("Weekly Review"));
        assert!(file_week.starts_with("periodic/weekly_2026-W"));

        let (s_month, e_month, title_month, file_month) = parse_period_bounds("month", "2026-11-16");
        assert_eq!(s_month, "2026-11-01");
        assert_eq!(e_month, "2026-11-30");
        assert!(title_month.contains("November 2026"));
        assert_eq!(file_month, "periodic/monthly_2026-11.md");
    }

    #[test]
    fn test_matches_period_range() {
        assert!(matches_period_range("20261116_session_1_test", "2026-11-16", "2026-11-16"));
        assert!(matches_period_range("20261118_session_2_test", "2026-11-16", "2026-11-22"));
        assert!(!matches_period_range("20261125_session_3_test", "2026-11-16", "2026-11-22"));
    }

    #[test]
    fn test_scrub_references_from_file() {
        let temp_dir = std::env::temp_dir().join(format!("lm_scrub_test_{}", uuid::Uuid::new_v4().simple()));
        let _ = std::fs::create_dir_all(&temp_dir);
        let index_file = temp_dir.join("index.md");
        let initial_content = "# Index\n\n- [[projects/lifemirror-desktop|LifeMirror Desktop]]\n- [[sessions/session_1_test]]\n- [[periodic/weekly_2026-W47\\|Week 47]]\n- [[log]]\n";
        let _ = std::fs::write(&index_file, initial_content);

        scrub_references_from_file(&index_file, "sessions/session_1_test.md");
        scrub_references_from_file(&index_file, "projects/lifemirror-desktop.md");
        scrub_references_from_file(&index_file, "periodic/weekly_2026-W47.md");

        let updated = std::fs::read_to_string(&index_file).unwrap();
        assert!(!updated.contains("session_1_test"));
        assert!(!updated.contains("lifemirror-desktop"));
        assert!(!updated.contains("weekly_2026-W47"));
        assert!(updated.contains("[[log]]"));
        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_get_weeks_for_month() {
        let weeks = get_weeks_for_month(2026, 11);
        assert!(!weeks.is_empty());
        // November 2026 spans weeks 45 through 49
        assert!(weeks.len() >= 4);
        assert!(weeks[0].0.starts_with("periodic/weekly_2026-W"));
        assert!(weeks[0].1.contains("Week"));

        // Out-of-bounds month/year must not panic
        let invalid_weeks = get_weeks_for_month(2026, 99);
        assert!(!invalid_weeks.is_empty());
        let zero_month_weeks = get_weeks_for_month(2026, 0);
        assert!(!zero_month_weeks.is_empty());
    }

    #[test]
    fn test_get_days_for_week() {
        let days = get_days_for_week("2026-11-16");
        assert_eq!(days.len(), 7);
        assert_eq!(days[0].0, "2026-11-16");
        assert_eq!(days[6].0, "2026-11-22");
        assert_eq!(days[0].2, "periodic/daily_2026-11-16");
    }
}

