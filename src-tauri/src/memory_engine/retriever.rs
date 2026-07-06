use crate::db::{DbState, MemoryNode};
use std::sync::Arc;
use chrono::{DateTime, Utc};

// RAG implementation querying the embedding store, scoring results by similarity + importance + recency
#[allow(dead_code)]
pub struct Retriever {
    db: Arc<DbState>,
}

impl Retriever {
    pub fn new(db: Arc<DbState>) -> Self {
        Self { db }
    }

    /// Queries the Memory Graph using a weighted RAG scoring formula:
    /// Final Score = 0.45 Similarity + 0.25 Importance + 0.20 Recency + 0.10 User Activity
    pub async fn retrieve(&self, query_embedding: &[f32], limit: usize) -> Result<Vec<(MemoryNode, f32)>, String> {
        let now = Utc::now();
        
        // 1. Fetch ALL embedded nodes
        let nodes_with_vectors = self.db.get_all_embedded_nodes()
            .map_err(|e| format!("Failed to fetch embedded nodes: {}", e))?;
            
        let mut scored_nodes: Vec<(MemoryNode, f32)> = nodes_with_vectors.into_iter().map(|(node, vector)| {
            // Similarity Score (Cosine similarity of embeddings) [0.0 - 1.0]
            let mut dot_product = 0.0_f32;
            let mut norm_a = 0.0_f32;
            let mut norm_b = 0.0_f32;
            
            for (a, b) in query_embedding.iter().zip(vector.iter()) {
                dot_product += a * b;
                norm_a += a * a;
                norm_b += b * b;
            }
            
            let similarity_score = if norm_a > 0.0 && norm_b > 0.0 {
                let cos_sim = dot_product / (norm_a.sqrt() * norm_b.sqrt());
                // Normalize cosine similarity from [-1, 1] to [0, 1]
                (cos_sim + 1.0) / 2.0
            } else {
                0.0
            };
            
            // Importance Score (Pre-calculated by AI on scale 0.0 - 1.0)
            let importance_score = node.importance_score as f32;
            
            // Recency Score (Decay function based on age)
            let node_time = DateTime::parse_from_rfc3339(&node.timestamp).unwrap_or_default().with_timezone(&Utc);
            let age_days = (now - node_time).num_days() as f32;
            let recency_score = (1.0 / (1.0 + (age_days / 7.0))).clamp(0.0, 1.0); // Half-life of 7 days
            
            // User Activity Score (Interaction frequency)
            let user_activity_score = 0.5_f32; // TODO: Query interactions
            
            // Final Weighted Score
            let final_score = 
                (0.45_f32 * similarity_score) + 
                (0.25_f32 * importance_score) + 
                (0.20_f32 * recency_score) + 
                (0.10_f32 * user_activity_score);
                
            (node, final_score)
        }).collect();
        
        // Sort descending by final score
        scored_nodes.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        
        scored_nodes.truncate(limit);
        Ok(scored_nodes)
    }
}
