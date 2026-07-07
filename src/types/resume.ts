export interface ResumeContextResponse {
  status: string;
  progress: number;
  branch: string;
  summary: string;
  next_task: string;
  confidence: number;
  blockers: string[];
  files: string[];
  documentation: string[];
  journal: string[];
  time_to_resume: string;
}
