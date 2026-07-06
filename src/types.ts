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
