use crate::db::{DbState, MemoryNode};
use crate::ai_ipc::OllamaProvider;
use std::sync::Arc;

// Batch generates embeddings via AI providers and stores them in SQLite
#[allow(dead_code)]
pub struct EmbeddingEngine {
    db: Arc<DbState>,
}

impl EmbeddingEngine {
    pub fn new(db: Arc<DbState>) -> Self {
        Self { db }
    }

    /// Generates an embedding for a summarized memory node and saves it to the `memory_embeddings` table.
    pub async fn embed_node(&self, mut node: MemoryNode) -> Result<MemoryNode, String> {
        // 1. Format the node's title, summary, and context into a single string for embedding
        let text_to_embed = format!(
            "Title: {}\nSummary: {}", 
            node.title, 
            node.summary.as_deref().unwrap_or("")
        );

        // 2. Call local AI (Ollama) to generate the vector
        let provider = OllamaProvider { db: self.db.clone() };
        let (vector, provider_name, model_name) = provider.embed(&text_to_embed).await?;
        let dimensions = vector.len() as i64;

        // 3. Serialize f32 vector to little-endian byte array
        let mut blob = Vec::with_capacity(vector.len() * 4);
        for v in vector {
            blob.extend_from_slice(&v.to_le_bytes());
        }

        // 4. Insert into `memory_embeddings`
        let embedding_id = self.db.insert_memory_embedding(&blob, &provider_name, &model_name, dimensions)
            .map_err(|e| e.to_string())?;

        // 5. Update node.embedding_id and status
        if let Some(node_id) = node.id {
            self.db.update_memory_node_embedding(node_id, embedding_id, "archived")
                .map_err(|e| e.to_string())?;
        }

        node.embedding_id = Some(embedding_id);
        node.status = "archived".to_string();
        
        Ok(node)
    }
}
