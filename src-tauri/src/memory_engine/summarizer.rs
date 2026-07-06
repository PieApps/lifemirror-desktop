use crate::db::{DbState, MemoryNode};
use crate::ai_ipc::{SmartFallbackProvider, AIProvider};
use std::sync::Arc;
use rusqlite::params;

// Interacts with LLMs to generate text summaries for sessions and hierarchies
#[allow(dead_code)]
pub struct Summarizer {
    db: Arc<DbState>,
}

impl Summarizer {
    pub fn new(db: Arc<DbState>) -> Self {
        Self { db }
    }

    /// Takes a MemoryNode that has been processed by the entity extractor
    /// and uses the AI model to generate a cohesive summary of what the user was trying to achieve (intent)
    /// and what was actually done (outcome).
    pub async fn summarize_node(&self, mut node: MemoryNode) -> Result<MemoryNode, String> {
        let node_id = node.id.ok_or("Node has no ID")?;
        let events = self.db.get_session_events(node_id).map_err(|e| e.to_string())?;
        
        if events.is_empty() {
            node.status = "summarized".to_string();
            return Ok(node);
        }

        // 1. Build context string from events
        let context_str = events.iter().take(200).map(|e| format!("[{}] {}: {}", e.timestamp, e.context, e.detail)).collect::<Vec<_>>().join("\n");
        
        let prompt = format!(
            "You are an AI assistant summarizing a user's computer activity session.\n\
             Review the following timeline of window titles, URLs, and journal entries.\n\
             Write a short 2-3 sentence summary of what the user accomplished or focused on during this session.\n\
             Be concise, objective, and focus on the main intent.\n\n\
             Logs:\n{}",
             context_str
        );
        
        // 2. Call LLM
        let provider = SmartFallbackProvider::new(self.db.clone());
        let summary = match provider.prompt(&prompt).await {
            Ok(resp) => resp,
            Err(e) => {
                println!("[Summarizer] Failed to generate summary: {}", e);
                "Could not generate summary.".to_string()
            }
        };

        // 3. Update node and DB
        node.summary = Some(summary.clone());
        node.status = "summarized".to_string();
        
        let conn = self.db.conn.lock().unwrap();
        conn.execute(
            "UPDATE memory_nodes SET summary = ?1, status = ?2 WHERE id = ?3",
            params![summary, "summarized", node_id]
        ).unwrap_or(0);

        Ok(node)
    }
}
