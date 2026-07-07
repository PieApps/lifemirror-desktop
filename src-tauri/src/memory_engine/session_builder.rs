use crate::db::{DbState, MemoryNode};
use crate::memory_engine::collector::NormalizedEvent;

// Groups raw events into cohesive sessions based on time and context
pub struct SessionBuilder;

impl SessionBuilder {
    pub fn new() -> Self {
        Self
    }

    /// Takes a list of normalized events and groups them into MemoryNodes (type='session')
    /// A session is bounded by time gaps (e.g., 5 minutes of inactivity) or major context switches.
    pub fn build_sessions(&self, events: Vec<NormalizedEvent>) -> Vec<(MemoryNode, Vec<NormalizedEvent>)> {
        let mut sessions = Vec::new();
        if events.is_empty() {
            return sessions;
        }

        let mut current_session_events = Vec::new();
        let mut session_start = events[0].timestamp.clone();
        let mut last_time = events[0].timestamp.clone();

        for event in events {
            // Determine if we should split the session
            // For now, use a simple heuristic: > 5 minutes gap splits a session
            let current_time = chrono::DateTime::parse_from_rfc3339(&event.timestamp).unwrap_or_default();
            let prev_time = chrono::DateTime::parse_from_rfc3339(&last_time).unwrap_or_default();
            
            let diff = current_time.signed_duration_since(prev_time).num_seconds();
            if diff > 300 && !current_session_events.is_empty() {
                // Finalize current session
                sessions.push((
                    self.create_memory_node(&session_start, &current_session_events),
                    current_session_events.clone()
                ));
                current_session_events.clear();
                session_start = event.timestamp.clone();
            }

            last_time = event.timestamp.clone();
            current_session_events.push(event);
        }

        // Finalize the last session
        if !current_session_events.is_empty() {
            sessions.push((
                self.create_memory_node(&session_start, &current_session_events),
                current_session_events
            ));
        }

        sessions
    }

    fn create_memory_node(&self, start_time: &str, events: &[NormalizedEvent]) -> MemoryNode {
        // Derive a temporary title from the most frequent context
        let title = if let Some(first) = events.first() {
            format!("Session involving {}", first.context)
        } else {
            "Unknown Session".to_string()
        };

        MemoryNode {
            id: None,
            title,
            summary: None,
            node_type: "session".to_string(),
            importance_score: 0.0,
            confidence: 1.0,
            embedding_id: None,
            status: "raw".to_string(), // Initial state for the Memory Queue
            timestamp: start_time.to_string(),
            activities: None,
            sub_events: None,
        }
    }

    /// Persists built sessions to the database and links them to raw activities
    pub fn persist_sessions(&self, db: &DbState, sessions: Vec<(MemoryNode, Vec<NormalizedEvent>)>) -> Result<(), String> {
        db.persist_built_sessions(sessions).map_err(|e| e.to_string())
    }
}
