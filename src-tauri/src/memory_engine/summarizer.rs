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
             Write a short 2-3 sentence summary of what the user accomplished.\n\
             Also assign an 'Importance' score from 0.0 to 1.0 (how significant this session is) and a 'Confidence' score from 0.0 to 1.0.\n\
             Provide your output EXACTLY in this format:\n\
             Summary: <text>\n\
             Importance: <float>\n\
             Confidence: <float>\n\n\
             Logs:\n{}",
             context_str
        );
        
        // 2. Call LLM
        let provider = SmartFallbackProvider::new(self.db.clone());
        let (summary, importance, confidence) = match provider.prompt(&prompt).await {
            Ok(resp) => {
                let mut s = "Could not generate summary.".to_string();
                let mut imp = 0.5;
                let mut conf = 0.8;
                for line in resp.lines() {
                    if line.starts_with("Summary:") {
                        s = line.trim_start_matches("Summary:").trim().to_string();
                    } else if line.starts_with("Importance:") {
                        if let Ok(v) = line.trim_start_matches("Importance:").trim().parse::<f64>() {
                            imp = v;
                        }
                    } else if line.starts_with("Confidence:") {
                        if let Ok(v) = line.trim_start_matches("Confidence:").trim().parse::<f64>() {
                            conf = v;
                        }
                    }
                }
                (s, imp, conf)
            },
            Err(e) => {
                println!("[Summarizer] Failed to generate summary: {}", e);
                ("Could not generate summary.".to_string(), 0.0, 1.0)
            }
        };

        // 3. Update node and DB
        node.summary = Some(summary.clone());
        node.importance_score = importance;
        node.confidence = confidence;
        node.status = "summarized".to_string();
        
        let conn = self.db.conn.lock().unwrap();
        conn.execute(
            "UPDATE memory_nodes SET summary = ?1, importance_score = ?2, confidence = ?3, status = ?4 WHERE id = ?5",
            params![summary, importance, confidence, "summarized", node_id]
        ).unwrap_or(0);

        Ok(node)
    }
}
