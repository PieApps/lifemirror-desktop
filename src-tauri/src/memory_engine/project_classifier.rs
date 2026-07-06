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
        
        let conn = self.db.conn.lock().unwrap();
        
        // 1. Fetch file paths associated with node
        let mut stmt = conn.prepare(
            "SELECT f.file_path FROM files f 
             JOIN node_entities ne ON ne.entity_id = f.id 
             WHERE ne.node_id = ?1 AND ne.entity_type = 'file'"
        ).map_err(|e| e.to_string())?;
        
        let files: Vec<String> = stmt.query_map([node_id], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(Result::ok)
            .collect();
            
        let mut projects_found = Vec::new();

        // 2. Deterministic mapping: Extract project name from file path (e.g. parent directory)
        for file_path in files {
            let path = std::path::Path::new(&file_path);
            if let Some(parent) = path.parent() {
                if let Some(project_name) = parent.file_name() {
                    let project_str = project_name.to_string_lossy().to_string();
                    if !projects_found.contains(&project_str) {
                        projects_found.push(project_str);
                    }
                }
            }
        }
        
        // 3. Upsert and link projects
        for project in projects_found {
            // Ignore generic folder names
            if project == "src" || project == "lib" || project == "test" { continue; }
            
            conn.execute("INSERT OR IGNORE INTO projects (name, created_at) VALUES (?1, datetime('now'))", params![&project]).unwrap_or(0);
            let p_id: i64 = conn.query_row("SELECT id FROM projects WHERE name = ?1", params![&project], |row| row.get(0)).unwrap_or(0);
            if p_id > 0 {
                conn.execute("INSERT OR IGNORE INTO node_projects (node_id, project_id, confidence) VALUES (?1, ?2, 0.9)", params![node_id, p_id]).unwrap_or(0);
            }
        }

        Ok(node)
    }
}
