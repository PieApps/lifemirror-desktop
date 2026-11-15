use crate::db::{AiProcessingMode, AiProviderMode, DbState};
use crate::memory_engine::collector::Collector;
use crate::memory_engine::session_builder::SessionBuilder;
use crate::memory_engine::entity_extractor::EntityExtractor;
use crate::memory_engine::project_classifier::ProjectClassifier;
use crate::memory_engine::summarizer::Summarizer;
use crate::memory_engine::embedding_engine::EmbeddingEngine;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tokio::time::sleep;

static IS_SYNCING: AtomicBool = AtomicBool::new(false);

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

            let mut is_first_run = true;

            loop {
                // If running in continuous mode on startup, introduce a 3-minute grace period
                // to let the OS boot and background daemons stabilize before starting heavy inference.
                if is_first_run {
                    is_first_run = false;
                    if db_clone.get_ai_processing_mode() == AiProcessingMode::Continuous {
                        sleep(Duration::from_secs(180)).await;
                    }
                }

                // 1. Ingest raw events into sessions (Zero-cost pure SQLite & Rust grouping, always runs)
                if let Ok(raw_events) = collector.collect_all(&db_clone) {
                    let sessions = session_builder.build_sessions(raw_events);
                    if !sessions.is_empty() {
                        let _ = session_builder.persist_sessions(&db_clone, sessions);
                    }
                }

                // In On-Demand mode (default) or when AI is deactivated ("off"), heavy background
                // LLM forward passes (entity tags, summaries, vector embeddings) are completely paused.
                // Keeps fans silent and saves battery.
                if db_clone.get_ai_provider_mode() == AiProviderMode::Off {
                    sleep(Duration::from_secs(60)).await;
                    continue;
                }

                if db_clone.get_ai_processing_mode() == AiProcessingMode::OnDemand {
                    sleep(Duration::from_secs(60)).await;
                    continue;
                }

                // If continuous mode is active, check if Local AI is reachable before attempting processing.
                // Fail-fast circuit breaker: if offline, do not spam or hang on socket timeouts.
                let provider = crate::inference::get_inference_provider(db_clone.clone());
                if !provider.is_available().await {
                    sleep(Duration::from_secs(60)).await;
                    continue;
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

    /// Just-In-Time (JIT) helper to process unindexed sessions on-demand
    pub async fn process_pending_sessions(db: Arc<DbState>, limit: usize) -> Result<usize, String> {
        // Atomic test-and-set: if another sync is already in flight, exit immediately to prevent duplicate work
        if IS_SYNCING.compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire).is_err() {
            return Ok(0);
        }

        // RAII guard guarantees IS_SYNCING is reset to false on any return path or error
        struct SyncGuard;
        impl Drop for SyncGuard {
            fn drop(&mut self) {
                IS_SYNCING.store(false, Ordering::Release);
            }
        }
        let _guard = SyncGuard;

        if db.get_ai_provider_mode() == AiProviderMode::Off {
            return Err("AI is deactivated in Settings.".to_string());
        }

        let provider = crate::inference::get_inference_provider(db.clone());
        if !provider.is_available().await {
            return Err("Local AI model or Ollama server is offline".to_string());
        }

        let collector = Collector::new();
        let session_builder = SessionBuilder::new();
        let entity_extractor = EntityExtractor::new(db.clone());
        let project_classifier = ProjectClassifier::new(db.clone());
        let summarizer = Summarizer::new(db.clone());
        let embedding_engine = EmbeddingEngine::new(db.clone());

        // Ingest any latest raw events first
        if let Ok(raw_events) = collector.collect_all(&db) {
            let sessions = session_builder.build_sessions(raw_events);
            if !sessions.is_empty() {
                let _ = session_builder.persist_sessions(&db, sessions);
            }
        }

        let mut processed_count = 0;

        // Process raw nodes
        if let Ok(raw_nodes) = db.get_nodes_by_status("raw", limit as i64) {
            for node in raw_nodes {
                if entity_extractor.process_node(node).await.is_ok() {
                    processed_count += 1;
                }
            }
        }

        // Classify and Summarize
        if let Ok(processed_nodes) = db.get_nodes_by_status("processed", limit as i64) {
            for node in processed_nodes {
                if let Ok(classified) = project_classifier.classify_node(node).await {
                    let _ = summarizer.summarize_node(classified).await;
                }
            }
        }

        // Embed
        if let Ok(summarized_nodes) = db.get_nodes_by_status("summarized", limit as i64) {
            for node in summarized_nodes {
                let _ = embedding_engine.embed_node(node).await;
            }
        }

        Ok(processed_count)
    }
}
