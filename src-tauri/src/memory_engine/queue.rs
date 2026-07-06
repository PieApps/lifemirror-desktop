use crate::db::DbState;
use crate::memory_engine::collector::Collector;
use crate::memory_engine::session_builder::SessionBuilder;
use crate::memory_engine::entity_extractor::EntityExtractor;
use crate::memory_engine::project_classifier::ProjectClassifier;
use crate::memory_engine::summarizer::Summarizer;
use crate::memory_engine::embedding_engine::EmbeddingEngine;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::sleep;

// Background state machine queue for memory node processing
// States: raw -> processed -> embedded -> summarized -> archived
pub struct MemoryQueue {
    db: Arc<DbState>,
}

impl MemoryQueue {
    pub fn new(db: Arc<DbState>) -> Self {
        Self { db }
    }

    pub fn start(&self) {
        let db_clone = self.db.clone();
        
        tauri::async_runtime::spawn(async move {
            let collector = Collector::new();
            let session_builder = SessionBuilder::new();
            let entity_extractor = EntityExtractor::new(db_clone.clone());
            let project_classifier = ProjectClassifier::new(db_clone.clone());
            let summarizer = Summarizer::new(db_clone.clone());
            let embedding_engine = EmbeddingEngine::new(db_clone.clone());

            loop {
                // 1. Ingest raw events into sessions
                if let Ok(raw_events) = collector.collect_all(&db_clone) {
                    let sessions = session_builder.build_sessions(raw_events);
                    if !sessions.is_empty() {
                        let _ = session_builder.persist_sessions(&db_clone, sessions);
                    }
                }

                // 2. Process 'raw' nodes (Entity Extractor)
                if let Ok(raw_nodes) = db_clone.get_nodes_by_status("raw", 10) {
                    for node in raw_nodes {
                        let _ = entity_extractor.process_node(node).await;
                    }
                }
                
                // 3. Classify and Summarize 'processed' nodes
                if let Ok(processed_nodes) = db_clone.get_nodes_by_status("processed", 10) {
                    for node in processed_nodes {
                        let classified = match project_classifier.classify_node(node).await {
                            Ok(n) => n,
                            Err(_) => continue,
                        };
                        let _ = summarizer.summarize_node(classified).await;
                    }
                }
                
                // 4. Embed 'summarized' nodes -> mark 'archived'
                if let Ok(summarized_nodes) = db_clone.get_nodes_by_status("summarized", 10) {
                    for node in summarized_nodes {
                        let _ = embedding_engine.embed_node(node).await;
                    }
                }

                sleep(Duration::from_secs(60)).await;
            }
        });
    }
}
