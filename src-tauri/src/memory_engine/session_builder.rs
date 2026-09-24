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

        let mut current_session_events: Vec<NormalizedEvent> = Vec::new();
        let mut session_start = events[0].timestamp.clone();

        // Parse the first timestamp; skip the entire batch if it is unparseable.
        let first_start = match chrono::DateTime::parse_from_rfc3339(&events[0].timestamp) {
            Ok(t) => t,
            Err(e) => {
                eprintln!("session_builder: cannot parse first event timestamp '{}': {}", events[0].timestamp, e);
                return sessions;
            }
        };
        // Clamp duration to at least 1 s so zero-duration events still advance session_end.
        let first_duration = events[0].duration.max(1);
        let mut session_end = first_start + chrono::Duration::seconds(first_duration);

        for event in events {
            // Skip events whose timestamp cannot be parsed — defaulting to epoch would
            // create a ~50-year gap and incorrectly split all subsequent sessions.
            let current_time = match chrono::DateTime::parse_from_rfc3339(&event.timestamp) {
                Ok(t) => t,
                Err(e) => {
                    eprintln!("session_builder: skipping event with bad timestamp '{}': {}", event.timestamp, e);
                    continue;
                }
            };
            let event_duration = event.duration.max(1);
            let event_end = current_time + chrono::Duration::seconds(event_duration);

            // Check if there is a gap > 300s after the end of this session's activities.
            let gap = current_time.signed_duration_since(session_end).num_seconds();
            if gap > 300 && !current_session_events.is_empty() {
                // Finalize current session — drain() avoids a clone+clear pair.
                let drained: Vec<NormalizedEvent> = current_session_events.drain(..).collect();
                sessions.push((
                    self.create_memory_node(&session_start, &drained),
                    drained,
                ));
                session_start = event.timestamp.clone();
                session_end = event_end;
            } else if event_end > session_end {
                session_end = event_end;
            }

            current_session_events.push(event);
        }

        // Finalize the last session.
        if !current_session_events.is_empty() {
            sessions.push((
                self.create_memory_node(&session_start, &current_session_events),
                current_session_events,
            ));
        }

        sessions
    }

    fn create_memory_node(&self, start_time: &str, events: &[NormalizedEvent]) -> MemoryNode {
        // Derive a meaningful title from the dominant context
        let title = if events.is_empty() {
            "Unknown Session".to_string()
        } else {
            let mut durations = std::collections::HashMap::new();
            for ev in events {
                *durations.entry(ev.context.clone()).or_insert(0) += ev.duration;
            }
            let dominant_context = durations.into_iter()
                .max_by_key(|&(_, dur)| dur)
                .map(|(ctx, _)| ctx)
                .unwrap_or_else(|| events[0].context.clone());

            if dominant_context.starts_with("Chrome (") || dominant_context.starts_with("Browser (") {
                "Chrome Session".to_string()
            } else {
                format!("{} Session", dominant_context)
            }
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
