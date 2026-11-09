import { ActivityNode, SubSessionEvent, DistractionEvent } from "./components/SCurveTimeline";

// Re-export timeline types for convenience
export type { ActivityNode, SubSessionEvent, DistractionEvent };

export interface MemoryNode {
  id: number;
  title: string;
  summary?: string;
  node_type: string; // "session", "daily_summary", "project_summary", "document"
  importance_score: number;
  confidence: number;
  embedding_id?: number;
  status: string; // "raw", "processed", "summarized", "embedded", "archived"
  timestamp: string;
  activities?: ActivityNode[];
  sub_events?: SubSessionEvent[];
}

export interface DailySummary {
  date: string;
  app_name: string;
  source: string;
  total_duration: number;
}

export interface HourlyMetric {
  day_of_week: number;
  hour: number;
  total_duration: number;
}

export interface ChatMessage {
  id?: number;
  date: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

export interface ExclusionEntry {
  domain: string;
  include_subdomains: boolean;
  updated_at: number;
  removed: boolean;
}

export interface PurgePreview {
  sub_sessions_count: number;
  activity_logs_count: number;
  matching_hosts: string[];
  attached_notes_count: number;
}

export interface PurgeReport {
  domain: string;
  sub_sessions_purged: number;
  activity_logs_purged: number;
  attached_notes_detached: number;
  derived_rollups_purged: number;
}

export interface JournalEntry {
  id?: number;
  timestamp: string;
  notes: string;
}
