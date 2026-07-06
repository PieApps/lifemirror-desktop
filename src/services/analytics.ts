/**
 * Pure computation layer for productivity metrics.
 * No React, no side effects — just data in, numbers out.
 * Reusable across dashboard, reports, AI prompt generation, and exports.
 */

import type { ActivityNode, DistractionEvent } from "../types";
import { mapAppToCategory, CATEGORIES } from "../utils/categoryMapper";

// ─── Types ──────────────────────────────────────────────────

export interface ProductivityMetrics {
  /** Overall score 0–100 based on focus quality */
  score: number;
  /** Human-readable label for the score */
  scoreLabel: string;

  /** Total tracked active time in seconds */
  totalActiveTime: number;
  /** Time in focused work (non-browser, non-entertainment) in seconds */
  deepWorkTime: number;
  /** Time in browser/research in seconds */
  browsingTime: number;
  /** Total distraction time in seconds */
  distractionTime: number;
  /** Time in communication apps in seconds */
  communicationTime: number;

  /** Number of app transitions */
  contextSwitches: number;
  /** Number of contiguous blocks > 10 min in the same app */
  focusSessions: number;
  /** Duration of the longest uninterrupted same-app block in seconds */
  longestFocusBlock: number;
  /** App name of the longest focus block */
  longestFocusApp: string;

  /** Name of the most distracting app (by total blocked time) */
  biggestDistraction: string;
  /** Total time lost to the biggest distraction in seconds */
  biggestDistractionTime: number;

  /** Top apps sorted by duration descending */
  topApps: AppDuration[];

  /** Time range */
  firstActivityTime: string | null;
  lastActivityTime: string | null;
}

export interface AppDuration {
  appName: string;
  duration: number;
  category: string;
  color: string;
}

// ─── Helpers ────────────────────────────────────────────────

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) {
    const remainingMins = mins % 60;
    return remainingMins > 0 ? `${hrs}h ${remainingMins}m` : `${hrs}h`;
  }
  return `${mins}m`;
}

function getScoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Great";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Needs Focus";
}

// ─── Core Computation ───────────────────────────────────────

/**
 * Computes all productivity metrics from raw activity and distraction data.
 *
 * Score formula (focus-based, profession-agnostic):
 *   40% Focus Ratio      — uninterrupted work / total active time
 *   30% Context Switching — penalty after threshold (12 switches/hour)
 *   20% Distraction Time  — ratio of distraction to total time
 *   10% Intent Completion — reserved for future use (defaults to 1.0)
 */
export function computeMetrics(
  activities: ActivityNode[],
  distractionEvents: DistractionEvent[],
  activeIntention?: string,
): ProductivityMetrics {
  const empty: ProductivityMetrics = {
    score: 0,
    scoreLabel: "No Data",
    totalActiveTime: 0,
    deepWorkTime: 0,
    browsingTime: 0,
    distractionTime: 0,
    communicationTime: 0,
    contextSwitches: 0,
    focusSessions: 0,
    longestFocusBlock: 0,
    longestFocusApp: "",
    biggestDistraction: "",
    biggestDistractionTime: 0,
    topApps: [],
    firstActivityTime: null,
    lastActivityTime: null,
  };

  if (activities.length === 0) return empty;

  // ── Aggregate by app ──────────────────────────────────
  const appDurations: Record<string, number> = {};
  let totalActiveTime = 0;
  let deepWorkTime = 0;
  let browsingTime = 0;
  let communicationTime = 0;
  let entertainmentTime = 0;

  for (const node of activities) {
    const dur = node.duration;
    totalActiveTime += dur;
    appDurations[node.app_name] = (appDurations[node.app_name] || 0) + dur;

    const category = mapAppToCategory(node.app_name, node.window_title, node.url || "");
    switch (category) {
      case "development":
        deepWorkTime += dur;
        break;
      case "browser":
        browsingTime += dur;
        break;
      case "communication":
        communicationTime += dur;
        break;
      case "entertainment":
        entertainmentTime += dur;
        break;
      default:
        // "other" counts as general work
        deepWorkTime += dur;
        break;
    }
  }

  // ── Top apps ──────────────────────────────────────────
  const topApps: AppDuration[] = Object.entries(appDurations)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([appName, duration]) => {
      const category = mapAppToCategory(appName);
      return {
        appName,
        duration,
        category,
        color: CATEGORIES[category]?.color || "#6b7280",
      };
    });

  // ── Context switches ─────────────────────────────────
  // Sort by start_time ascending
  const sorted = [...activities].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );
  let contextSwitches = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].app_name !== sorted[i - 1].app_name) {
      contextSwitches++;
    }
  }

  // ── Focus sessions & longest block ────────────────────
  // A focus session = contiguous block of same app > 10 min (600s)
  let focusSessions = 0;
  let longestFocusBlock = 0;
  let longestFocusApp = "";
  let currentBlockDuration = 0;
  let currentBlockApp = "";

  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].app_name === currentBlockApp) {
      currentBlockDuration += sorted[i].duration;
    } else {
      // End previous block
      if (currentBlockDuration > 600) {
        focusSessions++;
      }
      if (currentBlockDuration > longestFocusBlock) {
        longestFocusBlock = currentBlockDuration;
        longestFocusApp = currentBlockApp;
      }
      // Start new block
      currentBlockApp = sorted[i].app_name;
      currentBlockDuration = sorted[i].duration;
    }
  }
  // Handle last block
  if (currentBlockDuration > 600) {
    focusSessions++;
  }
  if (currentBlockDuration > longestFocusBlock) {
    longestFocusBlock = currentBlockDuration;
    longestFocusApp = currentBlockApp;
  }

  // ── Distraction metrics ───────────────────────────────
  let totalDistractionTime = 0;
  const distractionByApp: Record<string, number> = {};
  for (const evt of distractionEvents) {
    totalDistractionTime += evt.duration_blocked;
    distractionByApp[evt.app_name] = (distractionByApp[evt.app_name] || 0) + evt.duration_blocked;
  }

  let biggestDistraction = "";
  let biggestDistractionTime = 0;
  for (const [app, dur] of Object.entries(distractionByApp)) {
    if (dur > biggestDistractionTime) {
      biggestDistraction = app;
      biggestDistractionTime = dur;
    }
  }

  // Also count entertainment time as distraction for scoring
  const effectiveDistractionTime = totalDistractionTime + entertainmentTime;

  // ── Time range ────────────────────────────────────────
  const firstActivityTime = sorted.length > 0 ? sorted[0].start_time : null;
  const lastActivityTime = sorted.length > 0 ? sorted[sorted.length - 1].start_time : null;

  // ── Score Calculation ─────────────────────────────────
  // 40% Focus Ratio
  const focusTime = deepWorkTime + browsingTime + communicationTime; // non-entertainment work
  const focusRatio = totalActiveTime > 0 ? focusTime / totalActiveTime : 0;
  const focusScore = Math.min(1, focusRatio) * 40;

  // 30% Context Switching penalty
  // Baseline: 12 switches per hour is normal. Beyond that, penalize.
  const activeHours = Math.max(0.5, totalActiveTime / 3600);
  const switchesPerHour = contextSwitches / activeHours;
  const switchPenalty = Math.max(0, (switchesPerHour - 12) / 30); // normalized 0–1
  const switchScore = Math.max(0, 1 - switchPenalty) * 30;

  // 20% Distraction Time ratio
  const distractionRatio = totalActiveTime > 0 ? effectiveDistractionTime / totalActiveTime : 0;
  const distractionScore = Math.max(0, 1 - distractionRatio) * 20;

  // 10% Intent Completion (placeholder — defaults to full credit)
  const intentScore = activeIntention ? 7 : 10; // slight bonus for setting an intention

  const rawScore = focusScore + switchScore + distractionScore + intentScore;
  const score = Math.round(Math.min(100, Math.max(0, rawScore)));

  return {
    score,
    scoreLabel: getScoreLabel(score),
    totalActiveTime,
    deepWorkTime,
    browsingTime,
    distractionTime: effectiveDistractionTime,
    communicationTime,
    contextSwitches,
    focusSessions,
    longestFocusBlock,
    longestFocusApp,
    biggestDistraction,
    biggestDistractionTime,
    topApps,
    firstActivityTime,
    lastActivityTime,
  };
}
