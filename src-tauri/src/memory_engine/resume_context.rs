use std::sync::Arc;
use serde::{Deserialize, Serialize};
use crate::db::DbState;

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
        println!("[ResumeContext] generate_context called with project_id: {:?}", project_id);
        let project = match project_id {
            Some(_id) => {
                self.db.get_recent_active_project().map_err(|e| e.to_string())?
            },
            None => self.db.get_recent_active_project().map_err(|e| e.to_string())?,
        };

        if let Some(ref p) = project {
            println!("[ResumeContext] Found project: {:?}", p);
        } else {
            println!("[ResumeContext] No project found!");
        }

        let project = project.ok_or("No recent project found to resume.")?;
        let p_id = project.id.unwrap_or(0);

        let recent_sessions = self.db.get_recent_sessions_for_project(p_id, 3).unwrap_or_default();
        let recent_files = self.db.get_recent_files_for_project(p_id, 10).unwrap_or_default();
        let recent_journals = self.db.get_journal_entries(5).unwrap_or_default();

        println!("[ResumeContext] Found {} recent sessions, {} recent files, {} recent journals", recent_sessions.len(), recent_files.len(), recent_journals.len());

        let session_summaries: String = recent_sessions.iter().filter_map(|s| s.summary.clone()).collect::<Vec<_>>().join("\n\n");
        let file_paths: String = recent_files.iter().map(|f| f.file_path.clone()).collect::<Vec<_>>().join("\n");
        let journal_notes: String = recent_journals.iter().map(|j| format!("{}: {}", j.timestamp, j.notes)).collect::<Vec<_>>().join("\n");

        let prompt = format!(
            "You are an intelligent context restorer for a developer returning to their project after some time away.
Your goal is to build a highly accurate, actionable Resume Context briefing based on their recent activities, sessions, files, and notes.

Project Name: {}

Recent Session Summaries:
{}

Recently Touched Files:
{}

Recent Journal Notes:
{}

Based strictly on the above information, generate a structured JSON object representing their context.
Do NOT hallucinate information. If there are no blockers, return an empty array.
Your output MUST be a single valid JSON object with no comments, no markdown, and no extra text:
{{
  \"status\": \"A 1-2 sentence description of where they left off\",
  \"progress\": 75,
  \"branch\": \"feature-branch-name or main\",
  \"summary\": \"A short paragraph summarizing recent work\",
  \"next_task\": \"The single most important actionable next step\",
  \"confidence\": 95,
  \"blockers\": [],
  \"files\": [\"list of exactly the file paths they were working on\"],
  \"documentation\": [],
  \"journal\": [],
  \"time_to_resume\": \"3 minutes\"
}}
",
            project.name,
            session_summaries,
            file_paths,
            journal_notes
        );

        let provider = crate::inference::get_inference_provider(self.db.clone());
        match provider.prompt(&prompt).await {
            Ok(response_text) => {
                let clean_json = if let Some(start) = response_text.find('{') {
                    if let Some(end) = response_text.rfind('}') {
                        &response_text[start..=end]
                    } else {
                        &response_text
                    }
                } else {
                    &response_text
                };
                match serde_json::from_str::<ResumeContextResponse>(clean_json) {
                    Ok(parsed) => return Ok(parsed),
                    Err(e) => eprintln!("[ResumeContext] JSON parse failed: {}\nRaw response: {}", e, response_text),
                }
            }
            Err(e) => eprintln!("[ResumeContext] AI inference failed: {}. Using fallback.", e),
        }

        // Fallback rule-based context
        let mut fallback_files = Vec::new();
        for f in recent_files.iter().take(5) {
            fallback_files.push(f.file_path.clone());
        }

        let fallback_summary = if !recent_sessions.is_empty() {
            format!("Recent activities include: {}", recent_sessions.iter().map(|s| s.title.clone()).collect::<Vec<String>>().join(", "))
        } else {
            "No recent activity recorded for this project.".to_string()
        };

        Ok(ResumeContextResponse {
            status: "Resuming project (Offline / AI Disabled)".to_string(),
            progress: 50,
            branch: "main".to_string(),
            summary: fallback_summary,
            next_task: "Review your recent files to continue where you left off.".to_string(),
            confidence: 50,
            blockers: vec![],
            files: fallback_files,
            documentation: vec![],
            journal: recent_journals.iter().take(3).map(|j| j.notes.clone()).collect(),
            time_to_resume: "N/A".to_string(),
        })
    }
}
