use crate::db::{DbState, MemoryNode};
use crate::ai_ipc::{SmartFallbackProvider, AIProvider};
use std::sync::Arc;
use rusqlite::params;

// Deterministically extracts metadata (repos, folders, URLs, domains) and uses LLM for tags
pub struct EntityExtractor {
    db: Arc<DbState>,
}

impl EntityExtractor {
    pub fn new(db: Arc<DbState>) -> Self {
        Self { db }
    }

    /// Processes a raw MemoryNode, extracts entities from its constituent events,
    /// and links them in the database. Updates status to 'processed'.
    pub async fn process_node(&self, mut node: MemoryNode) -> Result<MemoryNode, String> {
        let node_id = node.id.ok_or("Node has no ID")?;
        let events = self.db.get_session_events(node_id).map_err(|e| e.to_string())?;

        let mut domains = Vec::new();
        let mut files = Vec::new();

        let domain_regex = regex::Regex::new(r"https?://([^/]+)").unwrap();
        
        for event in &events {
            if event.source == "browser" {
                if let Some(caps) = domain_regex.captures(&event.context) {
                    if let Some(domain) = caps.get(1) {
                        let domain_str = domain.as_str().to_string();
                        if !domains.contains(&domain_str) {
                            domains.push(domain_str);
                        }
                    }
                }
            } else if event.source == "os" {
                let app = event.context.to_lowercase();
                if app.contains("code") || app.contains("cursor") || app.contains("zed") || app.contains("idea") {
                    // Very rudimentary file path extraction from window title
                    let parts: Vec<&str> = event.detail.split(" - ").collect();
                    if let Some(file_part) = parts.first() {
                        let file_str = file_part.to_string();
                        if !files.contains(&file_str) {
                            files.push(file_str);
                        }
                    }
                }
            }
        }

        // Upsert domains and files (in a block to drop the lock before awaiting)
        {
            let conn = self.db.conn.lock().unwrap();
            for domain in domains {
                conn.execute("INSERT OR IGNORE INTO websites (domain) VALUES (?1)", params![&domain]).unwrap_or(0);
                let id: i64 = conn.query_row("SELECT id FROM websites WHERE domain = ?1", params![&domain], |row| row.get(0)).unwrap_or(0);
                if id > 0 {
                    conn.execute("INSERT OR IGNORE INTO node_entities (node_id, entity_type, entity_id) VALUES (?1, 'website', ?2)", params![node_id, id]).unwrap_or(0);
                }
            }

            for file in files {
                conn.execute("INSERT OR IGNORE INTO files (file_path) VALUES (?1)", params![&file]).unwrap_or(0);
                let id: i64 = conn.query_row("SELECT id FROM files WHERE file_path = ?1", params![&file], |row| row.get(0)).unwrap_or(0);
                if id > 0 {
                    conn.execute("INSERT OR IGNORE INTO node_entities (node_id, entity_type, entity_id) VALUES (?1, 'file', ?2)", params![node_id, id]).unwrap_or(0);
                }
            }
        }
        
        // AI Tags
        let context_str = events.iter().take(50).map(|e| format!("{} in {}", e.detail, e.context)).collect::<Vec<_>>().join("\n");
        let prompt = format!("Given the following user activity log, extract 3-5 comma-separated semantic tags (technologies, topics, or intent) that describe what the user is doing. ONLY output the comma-separated list, nothing else.\n\nLogs:\n{}", context_str);
        
        let provider = SmartFallbackProvider::new(self.db.clone());
        if let Ok(tags_resp) = provider.prompt(&prompt).await {
            let conn = self.db.conn.lock().unwrap();
            let tags: Vec<&str> = tags_resp.split(',').map(|s| s.trim()).collect();
            for tag in tags {
                if tag.is_empty() { continue; }
                conn.execute("INSERT OR IGNORE INTO technologies (name) VALUES (?1)", params![tag]).unwrap_or(0);
                let id: i64 = conn.query_row("SELECT id FROM technologies WHERE name = ?1", params![tag], |row| row.get(0)).unwrap_or(0);
                if id > 0 {
                    conn.execute("INSERT OR IGNORE INTO node_entities (node_id, entity_type, entity_id) VALUES (?1, 'technology', ?2)", params![node_id, id]).unwrap_or(0);
                }
            }
        }

        {
            let conn = self.db.conn.lock().unwrap();
            conn.execute("UPDATE memory_nodes SET status = 'processed' WHERE id = ?1", params![node_id]).unwrap_or(0);
        }

        node.status = "processed".to_string();
        Ok(node)
    }
}
