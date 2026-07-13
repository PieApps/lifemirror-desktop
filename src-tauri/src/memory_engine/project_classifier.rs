use crate::db::{DbState, MemoryNode};
use std::sync::Arc;
use rusqlite::params;

// Maps sessions to projects with a confidence score
#[allow(dead_code)]
pub struct ProjectClassifier {
    db: Arc<DbState>,
}

impl ProjectClassifier {
    pub fn new(db: Arc<DbState>) -> Self {
        Self { db }
    }

    pub async fn classify_node(&self, node: MemoryNode) -> Result<MemoryNode, String> {
        let node_id = node.id.ok_or("Node has no ID")?;
        
        let events = self.db.get_session_events(node_id).map_err(|e| e.to_string())?;
        println!("[ProjectClassifier] Processing node_id: {}, with {} events", node_id, events.len());
            
        let mut projects_found = Vec::new();

        for event in events {
            if event.source == "os" {
                let app = event.context.to_lowercase();
                println!("[ProjectClassifier] Checking OS event app: '{}', detail: '{}'", app, event.detail);

                let is_ide = app.contains("code") || app.contains("cursor") || app.contains("zed") || 
                             app.contains("idea") || app.contains("windsurf") || app.contains("studio") || 
                             app.contains("webstorm") || app.contains("pycharm") || app.contains("goland") || 
                             app.contains("rustrover") || app.contains("fleet") || app.contains("sublime") ||
                             app.contains("antigravity");

                if is_ide {
                    let detail = &event.detail;
                    let delimiter = if detail.contains(" — ") {
                        " — "
                    } else if detail.contains(" – ") {
                        " – "
                    } else {
                        " - "
                    };

                    let parts: Vec<&str> = detail.split(delimiter).collect();
                    println!("[ProjectClassifier] IDE Event detail: '{}', parts len: {}, delimiter: '{}'", detail, parts.len(), delimiter);
                    
                    if parts.len() >= 2 {
                        let project_str = if app.contains("idea") || app.contains("webstorm") || app.contains("pycharm") || 
                                             app.contains("goland") || app.contains("rustrover") || app.contains("fleet") || 
                                             app.contains("antigravity") {
                            parts[0].trim().to_string()
                        } else {
                            parts[parts.len() - 2].trim().to_string()
                        };
                        
                        if project_str.is_empty() || project_str.to_lowercase() == "src" || project_str.to_lowercase() == "lib" || project_str.to_lowercase() == "test" || project_str.to_lowercase() == "components" {
                            println!("[ProjectClassifier] Ignoring common folder name: '{}'", project_str);
                            continue;
                        }

                        if !projects_found.contains(&project_str) {
                            println!("[ProjectClassifier] Found valid project string: '{}'", project_str);
                            projects_found.push(project_str);
                        }
                    }
                }
            }
        }
        
        // 3. Upsert and link projects
        let conn = self.db.conn.lock().unwrap();
        println!("[ProjectClassifier] Projects found to upsert: {:?}", projects_found);
        for project in projects_found {
            if let Err(e) = conn.execute("INSERT OR IGNORE INTO projects (name, created_at) VALUES (?1, datetime('now'))", params![&project]) {
                println!("[ProjectClassifier] Error inserting project: {}", e);
            }
            
            let p_id: i64 = conn.query_row("SELECT id FROM projects WHERE name = ?1", params![&project], |row| row.get(0)).unwrap_or(0);
            println!("[ProjectClassifier] Project '{}' ID is {}", project, p_id);
            if p_id > 0 {
                if let Err(e) = conn.execute("INSERT OR IGNORE INTO node_projects (node_id, project_id, confidence) VALUES (?1, ?2, 0.9)", params![node_id, p_id]) {
                    println!("[ProjectClassifier] Error linking project to node: {}", e);
                } else {
                    println!("[ProjectClassifier] Successfully linked node {} to project {}", node_id, p_id);
                }
            }
        }

        Ok(node)
    }
}
