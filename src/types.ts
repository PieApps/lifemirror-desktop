import { ActivityNode, SubSessionEvent, DistractionEvent } from "./components/SCurveTimeline";

// Re-export timeline types for convenience
export type { ActivityNode, SubSessionEvent, DistractionEvent };

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
