use crate::db::{DbState, MemoryNode};
use crate::ai_ipc::{SmartFallbackProvider, AIProvider};
use std::sync::Arc;
use chrono::Utc;

// Generates the Automatic Work Journal and hierarchical summaries
#[allow(dead_code)]
pub struct ReflectionEngine {
    db: Arc<DbState>,
}

impl ReflectionEngine {
    pub fn new(db: Arc<DbState>) -> Self {
        Self { db }
    }

    /// Triggers an automatic daily rollup of all sessions for the day to generate a Daily Work Journal
    pub async fn generate_daily_journal(&self, date: &str) -> Result<MemoryNode, String> {
        // 1. Fetch all session nodes for the specified date
        let nodes = self.db.get_memory_nodes_for_day(date)
            .map_err(|e| format!("Failed to fetch memory nodes: {}", e))?;
        
        let sessions: Vec<&MemoryNode> = nodes.iter()
            .filter(|n| n.node_type == "session")
            .collect();

        // 2. Fetch all explicit journal entries for the specified date
        let manual_journals = self.db.get_journal_entries_for_day(date)
            .map_err(|e| format!("Failed to fetch journal entries: {}", e))?;

        if sessions.is_empty() && manual_journals.is_empty() {
            return Err("No sessions or journal entries found for this date to summarize.".to_string());
        }

        // 3. Prompt the LLM
        let mut prompt = String::from("You are an AI assistant generating a daily work journal. Using the following session summaries and journal entries, write a cohesive, professional 'Standup Update' style summary of what was accomplished today. Focus on the most important achievements.\n\n");
        
        if !sessions.is_empty() {
            prompt.push_str("## Sessions\n");
            for session in sessions {
                prompt.push_str(&format!("- {}: {}\n", session.title, session.summary.as_deref().unwrap_or("No summary")));
            }
            prompt.push_str("\n");
        }

        if !manual_journals.is_empty() {
            prompt.push_str("## Manual Journal Entries\n");
            for journal in manual_journals {
                prompt.push_str(&format!("- [{}] {}\n", journal.timestamp, journal.notes));
            }
            prompt.push_str("\n");
        }

        let provider = SmartFallbackProvider::new(self.db.clone());
        let llm_summary = provider.prompt(&prompt).await?;

        // 4. Create a new MemoryNode of type="daily_summary"
        let node = MemoryNode {
            id: None,
            title: format!("Work Journal for {}", date),
            summary: Some(llm_summary.trim().to_string()),
            node_type: "daily_summary".to_string(),
            importance_score: 0.9,
            confidence: 0.95,
            embedding_id: None,
            status: "summarized".to_string(), // Step 6: Mark as summarized for now until embeddings are wired
            timestamp: Utc::now().to_rfc3339(),
            activities: None,
            sub_events: None,
        };
        
        // 5. Insert into database
        let inserted_id = self.db.insert_memory_node(&node)
            .map_err(|e| format!("Failed to insert memory node: {}", e))?;
        
        let mut final_node = node.clone();
        final_node.id = Some(inserted_id);

        Ok(final_node)
    }
}
