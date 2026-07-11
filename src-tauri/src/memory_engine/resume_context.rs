use std::sync::Arc;
use serde::{Deserialize, Serialize};
use crate::db::DbState;
use crate::inference::get_inference_provider;

#[derive(Serialize, Deserialize, Debug)]
pub struct ResumeContextResponse {
    pub status: String,
    pub progress: u8,
    pub branch: String,
    pub summary: String,
    pub next_task: String,
    pub confidence: u8,
    pub blockers: Vec<String>,
    pub files: Vec<String>,
    pub documentation: Vec<String>,
    pub journal: Vec<String>,
    pub time_to_resume: String,
}

pub struct ResumeBuilder {
    db: Arc<DbState>,
}

impl ResumeBuilder {
    pub fn new(db: Arc<DbState>) -> Self {
        Self { db }
    }

    pub async fn generate_context(&self, project_id: Option<i64>) -> Result<ResumeContextResponse, String> {
        let project = match project_id {
            Some(_id) => {
                self.db.get_recent_active_project().map_err(|e| e.to_string())?
            },
            None => self.db.get_recent_active_project().map_err(|e| e.to_string())?,
        };

        let project = project.ok_or("No recent project found to resume.")?;
        let p_id = project.id.unwrap_or(0);

        let recent_sessions = self.db.get_recent_sessions_for_project(p_id, 3).unwrap_or_default();
        let recent_files = self.db.get_recent_files_for_project(p_id, 10).unwrap_or_default();
        let recent_journals = self.db.get_journal_entries(5).unwrap_or_default();

        let session_summaries: String = recent_sessions.iter().filter_map(|s| s.summary.clone()).collect::<Vec<_>>().join("\n\n");
        let file_paths: String = recent_files.iter().map(|f| f.file_path.clone()).collect::<Vec<_>>().join("\n");
        let journal_notes: String = recent_journals.iter().map(|j| format!("{}: {}", j.timestamp, j.notes)).collect::<Vec<_>>().join("\n");

        let prompt = format!(
            "You are an intelligent context restorer for a developer returning to their project after some time away.
Your goal is to build a highly accurate, actionable 'Resume Context' briefing based on their recent activities, sessions, files, and notes.

Project Name: {}

Recent Session Summaries:
{}

Recently Touched Files:
{}

Recent Journal Notes:
{}

Based strictly on the above information, generate a structured JSON object representing their context.
Do NOT hallucinate information. If there are no blockers, return an empty array.
Your output MUST be valid JSON matching this schema:
{{
  \"status\": \"A 1-2 sentence description of where they left off\",
  \"progress\": 75, // integer 0-100
  \"branch\": \"feature-branch-name or 'main'\",
  \"summary\": \"A short bulleted list or paragraph summarizing recent work\",
  \"next_task\": \"The single most important actionable next step\",
  \"confidence\": 95, // integer 0-100 representing how confident you are in the next_task
  \"blockers\": [\"list\", \"of\", \"blockers\"],
  \"files\": [\"list of exactly the file paths they were working on\"],
  \"documentation\": [\"list of documentation or websites they might need\"],
  \"journal\": [\"relevant short notes from their journal\"],
  \"time_to_resume\": \"Estimated time to get back in flow, e.g., '3 minutes'\"
}}
",
            project.name,
            session_summaries,
            file_paths,
            journal_notes
        );

        let provider = get_inference_provider(self.db.clone());
        let response_text = provider.prompt(&prompt).await.map_err(|e| e.to_string())?;

        let json_start = response_text.find('{').unwrap_or(0);
        let json_end = response_text.rfind('}').unwrap_or_else(|| response_text.len().saturating_sub(1)) + 1;
        
        if json_start < json_end {
            let json_str = &response_text[json_start..json_end];
            let parsed: ResumeContextResponse = serde_json::from_str(json_str)
                .map_err(|e| format!("Failed to parse LLM JSON response: {}", e))?;
            return Ok(parsed);
        }

        Err("Failed to extract valid JSON from LLM response".to_string())
    }
}
