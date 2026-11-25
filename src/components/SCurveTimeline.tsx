import React, { useState, useMemo, useEffect, useRef } from "react";
import { 
  Clock, Plus, 
  ShieldAlert, MessageSquare, ExternalLink, Sparkles
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";

import { MemoryNode } from "../types";
import AppIcon, { extractDomain } from './AppIcon';
import TimelineSidebar from './TimelineSidebar';
import { LiveTimer } from './LiveTimer';
import { formatDuration, calculateNonOverlappingDuration } from '../utils/formatDuration';
import { mapAppToCategory, CATEGORIES } from '../utils/categoryMapper';
import { sound } from '../utils/sound';

export const isBrowserApp = (appName?: string): boolean => {
  if (!appName) return false;
  const lower = appName.toLowerCase();
  return lower.includes("chrome") ||
         lower.includes("firefox") ||
         lower.includes("brave") ||
         lower.includes("safari") ||
         lower.includes("opera") ||
         lower.includes("edge") ||
         lower.includes("chromium") ||
         lower === "browser";
};

export function formatCleanTitle(
  rawTitle?: string,
  appName?: string,
  domainTag?: string,
  url?: string
): string {
  let title = (rawTitle || "").trim();

  // If title is generic like "Session involving ..." or ends with " session"
  if (!title || title.toLowerCase().includes("session involving") || title.toLowerCase().endsWith(" session")) {
    if (domainTag) return domainTag;
    if (url) {
      try {
        const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
        const host = parsed.hostname.replace(/^www\./, "");
        return host.charAt(0).toUpperCase() + host.slice(1);
      } catch {
        // fallback
      }
    }
  }

  // Remove URL wrapper in Chrome titles: Chrome (https://notebooklm.google.com/...)
  const chromeUrlMatch = title.match(/^Chrome\s*\((https?:\/\/[^\s\)]+)\)$/i);
  if (chromeUrlMatch) {
    try {
      const parsed = new URL(chromeUrlMatch[1]);
      const host = parsed.hostname.replace(/^www\./, "");
      return host.charAt(0).toUpperCase() + host.slice(1);
    } catch {
      title = chromeUrlMatch[1];
    }
  }

  // Strip generic browser/app prefixes & suffixes
  title = title
    .replace(/^(Google Chrome|Chrome|Mozilla Firefox|Firefox|Brave|Edge|Safari|Opera|Evince|Visual Studio Code|VS Code|Antigravity IDE|Antigravity)\s*[-–—:]\s*/i, "")
    .replace(/\s*[-–—:]\s*(Google Chrome|Chrome|Mozilla Firefox|Firefox|Brave|Edge|Safari|Opera|Visual Studio Code|VS Code|Antigravity IDE|Antigravity)$/i, "")
    .replace(/^Session involving\s+/i, "");

  // Strip trailing author / channel trailers (e.g. "| By Author", "| Channel Name")
  title = title.replace(/\s*\|\s*(By\s+.*|.*Channel.*)$/i, "");
  // Strip YouTube suffix
  title = title.replace(/\s*[-–—:]\s*YouTube$/i, "");
  // If multiple pipes exist (e.g. "Primary Title | Secondary Trailer | By ..."), keep the primary title
  if (title.includes(" | ")) {
    const parts = title.split(" | ").map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      title = parts[0];
    }
  }

  if (appName) {
    const escapedApp = appName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    title = title.replace(new RegExp(`\\s*[-–—:]\\s*${escapedApp}\\s*[-–—:]\\s*`, 'i'), ' - ');
  }

  // Strip editor dirty indicators (● or *)
  title = title.replace(/\s*[●*]\s*$/, "");

  if (!title.trim()) {
    if (domainTag) return domainTag;
    if (appName) return appName;
    return "Creative Flow";
  }

  return title.trim();
}

// Converts kebab-case, snake_case, or dot.case to Title Case words
export function formatProjectName(raw: string): string {
  const cleaned = raw.replace(/[-_.]+/g, ' ').trim();
  if (!cleaned) return raw;
  return cleaned
    .split(' ')
    .filter(Boolean)
    .map(word => {
      // Preserve uppercase for common tech acronyms
      if (/^(api|ui|cli|pr|db|os|ai|sql|rust|tauri|ts|js|css|svg|sdk)$/i.test(word)) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

// Extract project or repository context from window titles, URLs, and paths
export function detectProjectContext(
  activities: ActivityNode[] = [],
  subEvents: SubSessionEvent[] = []
): string | null {
  for (const act of activities) {
    const raw = act.window_title || '';
    
    // Check VS Code pattern: "file.ext - projectName - Visual Studio Code" or "projectName - Visual Studio Code"
    const ideMatch = raw.match(/[-–—]\s*([a-zA-Z0-9_\-\.]+)\s*[-–—]\s*(?:Visual Studio Code|VS Code|Cursor|Antigravity|VSCodium)/i) ||
                     raw.match(/^([a-zA-Z0-9_\-\.]+)\s*[-–—]\s*(?:Visual Studio Code|VS Code|Cursor|Antigravity)/i);
    if (ideMatch && ideMatch[1] && !/^(src|components|hooks|utils|assets|pages|tests|app|dist|target)$/i.test(ideMatch[1])) {
      return formatProjectName(ideMatch[1]);
    }

    // Check GitHub / GitLab URLs: github.com/owner/repo
    if (act.url) {
      const gitMatch = act.url.match(/github\.com\/[^\/]+\/([a-zA-Z0-9_\-\.]+)/i) ||
                       act.url.match(/gitlab\.com\/[^\/]+\/([a-zA-Z0-9_\-\.]+)/i);
      if (gitMatch && gitMatch[1]) {
        return formatProjectName(gitMatch[1]);
      }
    }

    // Check terminal paths: e.g. "~/lifemirror-desktop" or "/var/www/pieapps/lifemirror-desktop"
    const pathMatch = raw.match(/(?:\/|~[\/\w\.-]*\/)([a-zA-Z0-9_\-\.]{3,30})(?:\s|:|$)/);
    if (pathMatch && pathMatch[1] && !/^(var|www|home|usr|bin|etc|tmp|dev|node_modules|dist|target)$/i.test(pathMatch[1])) {
      return formatProjectName(pathMatch[1]);
    }
  }

  for (const sub of subEvents) {
    if (sub.primary_uri) {
      const gitMatch = sub.primary_uri.match(/github\.com\/[^\/]+\/([a-zA-Z0-9_\-\.]+)/i);
      if (gitMatch && gitMatch[1]) {
        return formatProjectName(gitMatch[1]);
      }
    }
    if (sub.context_tag && sub.context_tag.length > 2 && !/^(chrome|browser|editor|window)$/i.test(sub.context_tag)) {
      return formatProjectName(sub.context_tag);
    }
  }

  return null;
}

export function extractUniqueTools(
  activities: ActivityNode[] = [],
  dominantAppName: string,
  dominantIcon?: string,
  dominantUrl?: string,
  dominantTag?: string,
  dominantSource: string = "App"
): TimelineNodeTool[] {
  if (activities.length === 0) {
    return [{
      app_name: dominantAppName,
      icon_url: dominantIcon,
      url: dominantUrl,
      domain_tag: dominantTag,
      source: dominantSource,
      duration: 0,
    }];
  }

  const toolMap = new Map<string, TimelineNodeTool>();

  for (const act of activities) {
    const key = (act.app_name || "App").toLowerCase();
    const existing = toolMap.get(key);
    if (existing) {
      existing.duration += act.duration;
      if (!existing.icon_url && act.icon_url) existing.icon_url = act.icon_url;
      if (!existing.url && act.url) existing.url = act.url;
      if (!existing.domain_tag && act.domain_tag) existing.domain_tag = act.domain_tag;
    } else {
      toolMap.set(key, {
        app_name: act.app_name,
        icon_url: act.icon_url,
        url: act.url,
        domain_tag: act.domain_tag,
        source: act.source,
        duration: act.duration,
      });
    }
  }

  return Array.from(toolMap.values()).sort((a, b) => b.duration - a.duration);
}

export function getGroupedSessionTitle(node: TimelineNode): string {
  if (node.isShield) return "Shielded Flow";
  
  if (node.isMemoryNode && node.window_title && 
      !node.window_title.toLowerCase().endsWith(" session") && 
      !node.window_title.toLowerCase().startsWith("session involving") &&
      !node.window_title.toLowerCase().includes("working session")) {
    return formatCleanTitle(node.window_title, node.app_name, node.domain_tag, node.url);
  }

  const activities = node.originalActivities || [];
  const subEvents = node.subEvents || [];
  const projectContext = node.dominantProject || detectProjectContext(activities, subEvents);

  if (activities.length > 0) {
    if (activities.length === 1) {
      const single = activities[0];
      const cleaned = formatCleanTitle(single.window_title, single.app_name, single.domain_tag, single.url);
      if (cleaned && cleaned !== single.app_name && !cleaned.toLowerCase().endsWith(" session") && cleaned !== "Creative Flow") {
        return projectContext && !cleaned.toLowerCase().includes(projectContext.toLowerCase())
          ? `${projectContext} · ${cleaned}`
          : cleaned;
      }
    } else {
      // Multi-activity episode synthesis:
      // Sort activities by duration descending
      const sortedByDur = [...activities].sort((a, b) => b.duration - a.duration);
      const cleanedTitles = sortedByDur
        .map(a => formatCleanTitle(a.window_title, a.app_name, a.domain_tag, a.url))
        .filter((t): t is string => 
          !!t && 
          t !== node.app_name && 
          !t.toLowerCase().endsWith(" session") && 
          t !== "Creative Flow" &&
          t !== "Working Session"
        );
      
      const uniqueTitles = Array.from(new Set(cleanedTitles));

      if (uniqueTitles.length >= 2) {
        if (projectContext) {
          const topTask = uniqueTitles[0];
          const cleanTop = topTask.toLowerCase().startsWith(projectContext.toLowerCase())
            ? topTask
            : `${projectContext} · ${topTask}`;
          return cleanTop;
        }
        return `${uniqueTitles[0]} & ${uniqueTitles[1]}`;
      } else if (uniqueTitles.length === 1) {
        return projectContext && !uniqueTitles[0].toLowerCase().includes(projectContext.toLowerCase())
          ? `${projectContext} · ${uniqueTitles[0]}`
          : uniqueTitles[0];
      }
    }
  }

  if (subEvents.length > 0) {
    const topSub = subEvents[0];
    const cleaned = formatCleanTitle(topSub.title, topSub.parent_app_name || node.app_name, topSub.context_tag, topSub.primary_uri);
    if (cleaned && cleaned !== "Creative Flow" && cleaned !== "Working Session") {
      return projectContext && !cleaned.toLowerCase().includes(projectContext.toLowerCase())
        ? `${projectContext} · ${cleaned}`
        : cleaned;
    }
  }

  if (projectContext) {
    return `${projectContext} Flow`;
  }

  const baseCleaned = formatCleanTitle(node.window_title, node.app_name, node.domain_tag, node.url);
  if (baseCleaned && baseCleaned !== "Working Session" && !baseCleaned.toLowerCase().endsWith(" session")) {
    return baseCleaned;
  }
  return `${node.app_name || "Focused"} Flow`;
}


export interface ActivityNode {
  id: number;
  app_name: string;
  window_title: string;
  start_time: string;
  duration: number;
  source: string;
  url?: string;
  icon_url?: string;
  domain_tag?: string;
  notes?: string;
}

export interface DistractionEvent {
  id: number;
  timestamp: string;
  app_name: string;
  window_title: string;
  interception_type: string;
  interception_reason: string;
  duration_blocked: number;
  action_taken?: string;
}

export interface SubSessionEvent {
  id: number;
  session_type: string;
  parent_app_name?: string;
  title: string;
  primary_uri?: string;
  icon_url?: string;
  context_tag?: string;
  metadata?: string;
  timestamp: string;
}

interface SCurveTimelineProps {
  memoryNodes?: MemoryNode[];
  activities: ActivityNode[];
  subSessionEvents: SubSessionEvent[];
  distractionEvents: DistractionEvent[];
  onAddJournal: (activity: any) => void;
  onDeleteLog: (id: number) => void;
  onDeleteMemoryNode?: (id: number) => void;
  activeNodeStartTime?: string;
  isGrouped?: boolean;
  onToggleGrouped?: (grouped: boolean) => void;
  onResumeClick?: () => void;
}

export interface TimelineNodeTool {
  app_name: string;
  icon_url?: string;
  url?: string;
  domain_tag?: string;
  source: string;
  duration: number;
}

export interface TimelineNode {
  isGroupedSession: boolean;
  id: number;
  app_name: string;
  window_title: string;
  start_time: string;
  end_time?: string;
  duration: number;
  total_duration?: number;
  source: string;
  url?: string;
  icon_url?: string;
  domain_tag?: string;
  notes?: string;
  originalActivities: ActivityNode[];
  subEvents: SubSessionEvent[];
  isShield?: boolean;
  distractionEvent?: DistractionEvent;
  distractionEvents?: DistractionEvent[];
  isMemoryNode?: boolean;
  memoryData?: MemoryNode;
  tools?: TimelineNodeTool[];
  dominantProject?: string;
}

// extractDomain moved to AppIcon.tsx

export function SCurveTimeline({ 
  memoryNodes,
  activities, 
  subSessionEvents,
  distractionEvents,
  onAddJournal, 
  onDeleteLog,
  onDeleteMemoryNode,
  activeNodeStartTime,
  isGrouped = true,
  onToggleGrouped,
  onResumeClick,
}: SCurveTimelineProps) {
  const rowHeight = 200;
  const width = 800;

  const timelineScrollContainerRef = useRef<HTMLDivElement>(null);
  const [containerInnerWidth, setContainerInnerWidth] = useState<number>(800);

  useEffect(() => {
    const el = timelineScrollContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) {
          setContainerInnerWidth(Math.round(w));
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { colPercentages, colXs, cardWidthStyle } = useMemo(() => {
    // If container is spacious (>= 750px):
    if (containerInnerWidth >= 750) {
      return {
        colPercentages: ['16.25%', '50%', '83.75%'],
        colXs: [130, 400, 670],
        cardWidthStyle: {
          width: '28%',
          minWidth: '160px',
          maxWidth: '260px',
          minHeight: '100px'
        }
      };
    }
    // If container is medium (560px - 749px):
    if (containerInnerWidth >= 560) {
      // Pull side columns inward so cards don't clip against edges
      const sidePct = 21;
      return {
        colPercentages: [`${sidePct}%`, '50%', `${100 - sidePct}%`],
        colXs: [800 * (sidePct / 100), 400, 800 * ((100 - sidePct) / 100)],
        cardWidthStyle: {
          width: '27%',
          minWidth: '145px',
          maxWidth: '210px',
          minHeight: '90px'
        }
      };
    }
    // If container is compact (< 560px):
    const sidePct = 23.5;
    return {
      colPercentages: [`${sidePct}%`, '50%', `${100 - sidePct}%`],
      colXs: [800 * (sidePct / 100), 400, 800 * ((100 - sidePct) / 100)],
      cardWidthStyle: {
        width: '26%',
        minWidth: '130px',
        maxWidth: '175px',
        minHeight: '85px'
      }
    };
  }, [containerInnerWidth]);

  const [selectedNode, setSelectedNode] = useState<TimelineNode | null>(null);
  const [_isHovering, setIsHovering] = useState<number | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);

  // Group consecutive browser/editor usages together or show unbundled moments
  const processedNodes = useMemo(() => {
    // If ungrouped / Moments mode is explicitly requested by user:
    if (isGrouped === false) {
      const unbundled: TimelineNode[] = [];
      const allEvents = [
        ...activities.map(a => ({ type: 'activity', time: new Date(a.start_time).getTime(), data: a as ActivityNode })),
        ...distractionEvents.map(d => ({ type: 'distraction', time: new Date(d.timestamp).getTime(), data: d as DistractionEvent }))
      ].sort((a, b) => a.time - b.time);

      allEvents.forEach(ev => {
        if (ev.type === 'activity') {
          const act = ev.data as ActivityNode;
          const actStartMs = new Date(act.start_time).getTime();
          const actEndMs = actStartMs + act.duration * 1000;
          unbundled.push({
            isGroupedSession: false,
            id: act.id,
            app_name: act.app_name,
            window_title: formatCleanTitle(act.window_title, act.app_name, act.domain_tag, act.url),
            start_time: act.start_time,
            end_time: new Date(actEndMs).toISOString(),
            duration: act.duration,
            total_duration: act.duration,
            source: act.source,
            url: act.url,
            icon_url: act.icon_url,
            domain_tag: act.domain_tag,
            notes: act.notes,
            originalActivities: [act],
            subEvents: subSessionEvents.filter(s => {
              const t = new Date(s.timestamp).getTime();
              return t >= actStartMs - 5000 && t <= actEndMs + 5000;
            }),
          });
        } else {
          const dEvent = ev.data as DistractionEvent;
          unbundled.push({
            isGroupedSession: false,
            id: -dEvent.id,
            app_name: "Shielded Flow",
            window_title: "Distraction Blocked",
            start_time: dEvent.timestamp,
            end_time: new Date(new Date(dEvent.timestamp).getTime() + (dEvent.duration_blocked || 0) * 1000).toISOString(),
            duration: dEvent.duration_blocked,
            source: "Shield",
            originalActivities: [],
            subEvents: [],
            isShield: true,
            distractionEvent: dEvent,
            distractionEvents: [dEvent],
          });
        }
      });
      return unbundled;
    }

    // 1. HYBRID APPROACH: If we have Semantic Memory Nodes, display them!
    if (memoryNodes && memoryNodes.length > 0) {
      const initialNodes: TimelineNode[] = memoryNodes.map(mn => {
        let dominantAppName = mn.node_type === 'session' ? 'Semantic Session' : (mn.node_type || 'Memory');
        let dominantIcon = undefined;
        let dominantUrl = undefined;
        let dominantSource = 'AI Memory';
        
        let calculatedDuration = calculateNonOverlappingDuration(mn.activities || []);

        if (mn.activities && mn.activities.length > 0) {
           const durations: Record<string, number> = {};
           mn.activities.forEach(a => {
             durations[a.app_name] = (durations[a.app_name] || 0) + a.duration;
           });
           let maxApp = mn.activities[0].app_name;
           let maxDur = 0;
           for (const [app, dur] of Object.entries(durations)) {
             if (dur > maxDur) { maxDur = dur; maxApp = app; }
           }
           const dominant = mn.activities.find(a => a.app_name === maxApp) || mn.activities[0];
           dominantAppName = dominant.app_name;
           dominantIcon = dominant.icon_url;
           dominantUrl = dominant.url;
           dominantSource = dominant.source;
        } else if (mn.sub_events && mn.sub_events.length > 0) {
           // Fallback: extract app name, icon, and url from sub_events if no direct OS log is linked
           const dominant = mn.sub_events.find(s => s.icon_url) || mn.sub_events[0];
           dominantAppName = dominant.parent_app_name || 'Chrome';
           dominantIcon = dominant.icon_url;
           dominantUrl = dominant.primary_uri;
           dominantSource = dominant.session_type || 'Browser';
           if (calculatedDuration === 0) {
             if (mn.sub_events.length > 1) {
               const subTimes = mn.sub_events.map(s => new Date(s.timestamp).getTime());
               const span = Math.round((Math.max(...subTimes) - Math.min(...subTimes)) / 1000);
               calculatedDuration = Math.max(60, Math.min(span, mn.sub_events.length * 60));
             } else {
               calculatedDuration = 60;
             }
           }
        }

        let displayTitle = mn.title;
        if (displayTitle.startsWith("Session involving ") || displayTitle.endsWith(" Session") || displayTitle.startsWith("Chrome (http")) {
          if (dominantUrl) {
            const domain = extractDomain(dominantUrl);
            displayTitle = domain ? `${domain.charAt(0).toUpperCase() + domain.slice(1)} Flow` : `${dominantAppName} Flow`;
          } else {
            displayTitle = `${dominantAppName} Flow`;
          }
        }

        const actStarts = (mn.activities || []).map(a => new Date(a.start_time).getTime());
        const actEnds = (mn.activities || []).map(a => new Date(a.start_time).getTime() + a.duration * 1000);
        const subTimes = (mn.sub_events || []).map(s => new Date(s.timestamp).getTime());
        const mnTime = new Date(mn.timestamp).getTime();
        const startMs = actStarts.length > 0 ? Math.min(...actStarts) : (subTimes.length > 0 ? Math.min(...subTimes, mnTime) : mnTime);
        const endMs = actEnds.length > 0 ? Math.max(...actEnds) : (subTimes.length > 0 ? Math.max(...subTimes, startMs + calculatedDuration * 1000) : startMs + calculatedDuration * 1000);
        const spanSeconds = Math.max(0, Math.round((endMs - startMs) / 1000));
        const totalDur = Math.max(calculatedDuration, spanSeconds);

        return {
          isGroupedSession: true,
          id: mn.id ?? Math.abs(String(mn.timestamp).split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0)),
          app_name: dominantAppName,
          window_title: displayTitle,
          start_time: new Date(startMs).toISOString(),
          end_time: new Date(endMs).toISOString(),
          duration: Math.min(calculatedDuration, totalDur > 0 ? totalDur : calculatedDuration),
          total_duration: totalDur,
          source: dominantSource,
          url: dominantUrl,
          icon_url: dominantIcon,
          notes: mn.summary,
          originalActivities: mn.activities ? [...mn.activities] : [],
          subEvents: mn.sub_events ? [...mn.sub_events] : [],
          isMemoryNode: true,
          memoryData: mn
        };
      });

      initialNodes.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

      const groupedNodes: TimelineNode[] = [];
      let currentGroup: TimelineNode | null = null;
      let currentGroupEndMs = 0;

      initialNodes.forEach(node => {
         const nodeStartMs = new Date(node.start_time).getTime();
         const nodeEndMs = node.end_time ? new Date(node.end_time).getTime() : (nodeStartMs + node.duration * 1000);

         if (!currentGroup) {
           currentGroup = structuredClone(node);
           currentGroupEndMs = nodeEndMs;
         } else {
           const gap = (nodeStartMs - currentGroupEndMs) / 1000;

           const appA = (currentGroup.app_name || "").toLowerCase();
           const appB = (node.app_name || "").toLowerCase();
           const bothBrowsers = isBrowserApp(appA) && isBrowserApp(appB);
           const sameApp = appA === appB || bothBrowsers;

           const titleA = getGroupedSessionTitle(currentGroup);
           const titleB = getGroupedSessionTitle(node);
           const sameTitle = !!(titleA && titleB && titleA.toLowerCase() === titleB.toLowerCase());

           const domainA = (currentGroup.url ? extractDomain(currentGroup.url) : "") || currentGroup.domain_tag || "";
           const domainB = (node.url ? extractDomain(node.url) : "") || node.domain_tag || "";
           const sameDomain = !!(domainA && domainB && domainA.toLowerCase() === domainB.toLowerCase());

           // Merge rules (all require the sessions to be within the window):
           // 1. Same cleaned title — 30 min window (strong signal)
           // 2. Same browser domain — 30 min window (strong signal)
           // 3. Same app alone — 5 min window only (weak signal; avoids collapsing
           //    separate VS Code / Slack sessions that are merely close in time)
           const strongMatch = sameTitle || (bothBrowsers && sameDomain);
           const shouldMerge = (strongMatch && gap < 1800) || (sameApp && !strongMatch && gap < 300);

           if (shouldMerge) {
             // De-duplicate activities by id
             const existingActIds = new Set(currentGroup.originalActivities.map(a => a.id));
             for (const act of node.originalActivities) {
               if (act.id == null || !existingActIds.has(act.id)) {
                 currentGroup.originalActivities.push(act);
                 if (act.id != null) existingActIds.add(act.id);
               }
             }

             // De-duplicate sub-events by id
             const existingSubIds = new Set(currentGroup.subEvents.map(s => s.id));
             for (const sub of node.subEvents) {
               if (sub.id == null || !existingSubIds.has(sub.id)) {
                 currentGroup.subEvents.push(sub);
                 if (sub.id != null) existingSubIds.add(sub.id);
               }
             }

             currentGroupEndMs = Math.max(currentGroupEndMs, nodeEndMs);
             currentGroup.end_time = new Date(currentGroupEndMs).toISOString();

             const groupSpanSeconds = Math.max(0, Math.round((currentGroupEndMs - new Date(currentGroup.start_time).getTime()) / 1000));

             // Active duration: non-overlapping activity time, strictly bounded by the physical session span
             if (currentGroup.originalActivities.length > 0) {
               currentGroup.duration = Math.min(calculateNonOverlappingDuration(currentGroup.originalActivities), groupSpanSeconds);
             } else {
               if (nodeStartMs >= currentGroupEndMs) {
                 currentGroup.duration += node.duration;
               } else if (nodeEndMs > currentGroupEndMs) {
                 currentGroup.duration += Math.round((nodeEndMs - currentGroupEndMs) / 1000);
               }
               currentGroup.duration = Math.min(currentGroup.duration, groupSpanSeconds);
             }

             currentGroup.total_duration = Math.max(currentGroup.duration, groupSpanSeconds);

             // Prefer the most descriptive app name, icon, and URL
             if (currentGroup.app_name === 'Semantic Session' || !currentGroup.icon_url) {
               if (node.app_name !== 'Semantic Session') currentGroup.app_name = node.app_name;
               if (node.icon_url) currentGroup.icon_url = node.icon_url;
               if (node.url) currentGroup.url = node.url;
               if (node.source !== 'AI Memory') currentGroup.source = node.source;
             }

             // Merge AI summary notes without duplicating identical lines
             if (node.notes) {
               if (!currentGroup.notes) {
                 currentGroup.notes = node.notes;
               } else if (!currentGroup.notes.includes(node.notes) && !node.notes.includes(currentGroup.notes)) {
                 currentGroup.notes = `${currentGroup.notes}\n\n---\n\n${node.notes}`;
               }
             }
           } else {
             groupedNodes.push(currentGroup);
             currentGroup = structuredClone(node);
             currentGroupEndMs = nodeEndMs;
           }
         }
      });
      if (currentGroup) groupedNodes.push(currentGroup);

      const finalNodes: TimelineNode[] = [];
      let currentDistractionGroup: TimelineNode | null = null;

      const allEvents = [
        ...groupedNodes.map(n => ({ type: 'memory', time: new Date(n.start_time).getTime(), data: n })),
        ...distractionEvents.map(d => ({ type: 'distraction', time: new Date(d.timestamp).getTime(), data: d as DistractionEvent }))
      ].sort((a, b) => a.time - b.time);

      allEvents.forEach(ev => {
        if (ev.type === 'memory') {
          if (currentDistractionGroup) {
            finalNodes.push(currentDistractionGroup);
            currentDistractionGroup = null;
          }
          finalNodes.push(ev.data as TimelineNode);
        } else {
          const dEvent = ev.data as DistractionEvent;
          const dEventStartMs = new Date(dEvent.timestamp).getTime();
          const dEventEndMs = dEventStartMs + (dEvent.duration_blocked || 0) * 1000;

          if (currentDistractionGroup) {
            const lastGroupEndMs = currentDistractionGroup.end_time
              ? new Date(currentDistractionGroup.end_time).getTime()
              : new Date(currentDistractionGroup.distractionEvents![currentDistractionGroup.distractionEvents!.length - 1].timestamp).getTime();
            const gapSeconds = (dEventStartMs - lastGroupEndMs) / 1000;
            
            if (gapSeconds < 1800) {
              currentDistractionGroup.distractionEvents!.push(dEvent);
              currentDistractionGroup.duration += dEvent.duration_blocked;
              currentDistractionGroup.end_time = new Date(Math.max(lastGroupEndMs, dEventEndMs)).toISOString();
            } else {
              finalNodes.push(currentDistractionGroup);
              currentDistractionGroup = {
                isGroupedSession: true,
                id: -dEvent.id,
                app_name: "Distraction Shield",
                window_title: "Distractions Blocked",
                start_time: dEvent.timestamp,
                end_time: new Date(dEventEndMs).toISOString(),
                duration: dEvent.duration_blocked,
                source: "Shield",
                originalActivities: [],
                subEvents: [],
                isShield: true,
                distractionEvent: dEvent,
                distractionEvents: [dEvent]
              };
            }
          } else {
            currentDistractionGroup = {
              isGroupedSession: true,
              id: -dEvent.id,
              app_name: "Distraction Shield",
              window_title: "Distractions Blocked",
              start_time: dEvent.timestamp,
              end_time: new Date(dEventEndMs).toISOString(),
              duration: dEvent.duration_blocked,
              source: "Shield",
              originalActivities: [],
              subEvents: [],
              isShield: true,
              distractionEvent: dEvent,
              distractionEvents: [dEvent]
            };
          }
        }
      });
      
      if (currentDistractionGroup) {
        finalNodes.push(currentDistractionGroup);
      }

      finalNodes.forEach(node => {
        if (!node.isShield) {
          node.dominantProject = detectProjectContext(node.originalActivities, node.subEvents) || undefined;
          node.tools = extractUniqueTools(node.originalActivities, node.app_name, node.icon_url, node.url, node.domain_tag, node.source);
          node.window_title = getGroupedSessionTitle(node);
        }
      });

      return finalNodes;
    }


    const nodes: TimelineNode[] = [];
    let currentGroup: TimelineNode | null = null;
    let currentGroupEndMs = 0;

    const allEvents = [
      ...activities.map(a => ({ type: 'activity', time: new Date(a.start_time).getTime(), data: a as ActivityNode })),
      ...distractionEvents.map(d => ({ type: 'distraction', time: new Date(d.timestamp).getTime(), data: d as DistractionEvent }))
    ].sort((a, b) => a.time - b.time);

    allEvents.forEach((ev) => {
      if (ev.type === 'activity') {
        const activity = ev.data as ActivityNode;
        const actStartMs = new Date(activity.start_time).getTime();
        const actEndMs = actStartMs + activity.duration * 1000;

        const gapSeconds = currentGroup && !currentGroup.isShield
          ? (actStartMs - currentGroupEndMs) / 1000
          : 0;

        // An Episode is a continuous flow session across all creative tools.
        // As long as the pause between activities is < 900s (15 minutes) and not interrupted by a shield,
        // it belongs to the same unified episode.
        if (currentGroup && !currentGroup.isShield && gapSeconds < 900) {
          currentGroup.originalActivities.push(activity);
          currentGroupEndMs = Math.max(currentGroupEndMs, actEndMs);
          currentGroup.end_time = new Date(currentGroupEndMs).toISOString();

          const groupSpan = Math.max(0, Math.round((currentGroupEndMs - new Date(currentGroup.start_time).getTime()) / 1000));
          currentGroup.duration = Math.min(calculateNonOverlappingDuration(currentGroup.originalActivities), groupSpan);
          currentGroup.total_duration = Math.max(currentGroup.duration, groupSpan);

          if (activity.notes) {
            currentGroup.notes = currentGroup.notes
              ? `${currentGroup.notes} | ${activity.notes}`
              : activity.notes;
          }
        } else {
          if (currentGroup) nodes.push(currentGroup);
          
          currentGroupEndMs = actEndMs;
          currentGroup = {
            isGroupedSession: true,
            id: activity.id,
            app_name: activity.app_name,
            window_title: formatCleanTitle(activity.window_title, activity.app_name, activity.domain_tag, activity.url) || `${activity.app_name} Flow`,
            start_time: activity.start_time,
            end_time: new Date(actEndMs).toISOString(),
            duration: activity.duration,
            total_duration: activity.duration,
            source: activity.source,
            url: activity.url,
            icon_url: activity.icon_url,
            domain_tag: activity.domain_tag,
            notes: activity.notes,
            originalActivities: [activity],
            subEvents: [],
          };
        }
      } else {
        const dEvent = ev.data as DistractionEvent;
        const dEventStartMs = new Date(dEvent.timestamp).getTime();
        const dEventEndMs = dEventStartMs + (dEvent.duration_blocked || 0) * 1000;
        const gapSeconds = currentGroup && currentGroup.isShield
          ? (dEventStartMs - currentGroupEndMs) / 1000
          : 0;

        if (currentGroup && currentGroup.isShield && gapSeconds < 1800) {
          currentGroup.distractionEvents!.push(dEvent);
          currentGroup.duration += dEvent.duration_blocked;
          currentGroupEndMs = Math.max(currentGroupEndMs, dEventEndMs);
          currentGroup.end_time = new Date(currentGroupEndMs).toISOString();
        } else {
          if (currentGroup) {
            nodes.push(currentGroup);
          }
          currentGroupEndMs = dEventEndMs;
          currentGroup = {
            isGroupedSession: true,
            id: -dEvent.id,
            app_name: "Distraction Shield",
            window_title: "Distractions Blocked",
            start_time: dEvent.timestamp,
            end_time: new Date(dEventEndMs).toISOString(),
            duration: dEvent.duration_blocked,
            source: "Shield",
            originalActivities: [],
            subEvents: [],
            isShield: true,
            distractionEvent: dEvent,
            distractionEvents: [dEvent]
          };
        }
      }
    });

    if (currentGroup) {
      nodes.push(currentGroup);
    }

    nodes.forEach((node) => {
      if (node.isGroupedSession) {
        const groupStart = new Date(node.start_time).getTime();
        const groupEnd = node.end_time
          ? new Date(node.end_time).getTime()
          : Math.max(
              groupStart + node.duration * 1000,
              ...node.originalActivities.map(a => new Date(a.start_time).getTime() + a.duration * 1000)
            );
        
        const matched = subSessionEvents.filter((event) => {
          if (event.session_type !== node.source) return false;
          if (node.source === "Editor" && event.parent_app_name !== node.app_name) return false;
          
          const eventTime = new Date(event.timestamp).getTime();
          return eventTime >= groupStart - 5000 && eventTime <= groupEnd + 5000;
        });

        if (node.subEvents.length === 0) {
          node.subEvents = matched;
        } else {
          const existingIds = new Set(node.subEvents.map(s => s.id));
          matched.forEach(s => {
            if (!existingIds.has(s.id)) {
              node.subEvents.push(s);
            }
          });
        }
      }
    });

    nodes.forEach(node => {
      if (node.isGroupedSession && !node.isShield && !node.isMemoryNode && node.originalActivities.length > 0) {
        const durations: Record<string, number> = {};
        node.originalActivities.forEach(a => {
          durations[a.app_name] = (durations[a.app_name] || 0) + a.duration;
        });
        
        let maxApp = node.originalActivities[0].app_name;
        let maxDur = 0;
        for (const [app, dur] of Object.entries(durations)) {
          if (dur > maxDur) {
            maxDur = dur;
            maxApp = app;
          }
        }
        
        const dominant = node.originalActivities.find(a => a.app_name === maxApp) || node.originalActivities[0];
        node.app_name = dominant.app_name;
        node.icon_url = dominant.icon_url;
        node.source = dominant.source;
        node.url = dominant.url;
        node.domain_tag = dominant.domain_tag;

        node.dominantProject = detectProjectContext(node.originalActivities, node.subEvents) || undefined;
        node.tools = extractUniqueTools(node.originalActivities, dominant.app_name, dominant.icon_url, dominant.url, dominant.domain_tag, dominant.source);
        node.window_title = getGroupedSessionTitle(node);
      }
    });

    if (nodes.length === 0 && isDemoMode) {
      const now = new Date();
      const demoNodes: TimelineNode[] = [
        {
          id: 999901,
          app_name: "Figma",
          window_title: "Designing System Architecture & River Vectors",
          start_time: new Date(now.getTime() - 7200000).toISOString(),
          end_time: new Date(now.getTime() - 4500000).toISOString(),
          duration: 2700,
          total_duration: 2700,
          isGroupedSession: true,
          originalActivities: [],
          subEvents: [],
          dominantProject: "LifeMirror Studio",
          source: "App",
          tools: [{ app_name: "Figma", source: "App", duration: 2700 }],
        },
        {
          id: 999902,
          app_name: "Cursor",
          window_title: "Crafting Rust Audio Solfeggio Synthesizer",
          start_time: new Date(now.getTime() - 4200000).toISOString(),
          end_time: new Date(now.getTime() - 1200000).toISOString(),
          duration: 3000,
          total_duration: 3000,
          isGroupedSession: true,
          originalActivities: [],
          subEvents: [],
          dominantProject: "LifeMirror Desktop",
          source: "App",
          tools: [{ app_name: "Cursor", source: "App", duration: 3000 }],
        },
        {
          id: 999903,
          app_name: "Google Chrome",
          window_title: "Researching Native WebKitGTK Date Navigation",
          start_time: new Date(now.getTime() - 900000).toISOString(),
          end_time: now.toISOString(),
          duration: 900,
          total_duration: 900,
          isGroupedSession: true,
          originalActivities: [],
          subEvents: [],
          dominantProject: "WebKit Research",
          source: "Browser",
          tools: [{ app_name: "Google Chrome", source: "Browser", duration: 900 }],
        },
      ];
      return demoNodes;
    }

    return nodes;
  }, [memoryNodes, activities, subSessionEvents, distractionEvents, isDemoMode]);

  // Sync selectedNode when processedNodes updates to recalculate time/durations
  useEffect(() => {
    if (selectedNode) {
      const updatedNode = processedNodes.find(n => n.id === selectedNode.id);
      if (updatedNode) {
        setSelectedNode(updatedNode);
      } else {
        setSelectedNode(null);
      }
    }
  }, [processedNodes]);

  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const cardRefs = useRef<Map<number | string, HTMLDivElement>>(new Map());

  // Keyboard River Instrument Navigation (J/K/Arrows to glide, Space to inspect, R to reflect)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (processedNodes.length === 0) return;

      if (e.key.toLowerCase() === 'j' || e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = prev === null ? 0 : Math.min(processedNodes.length - 1, prev + 1);
          sound.playTactileTick();
          const targetNode = processedNodes[next];
          if (targetNode) {
            cardRefs.current.get(targetNode.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (selectedNode) {
              setSelectedNode(targetNode);
            }
          }
          return next;
        });
      } else if (e.key.toLowerCase() === 'k' || e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = prev === null ? processedNodes.length - 1 : Math.max(0, prev - 1);
          sound.playTactileTick();
          const targetNode = processedNodes[next];
          if (targetNode) {
            cardRefs.current.get(targetNode.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (selectedNode) {
              setSelectedNode(targetNode);
            }
          }
          return next;
        });
      } else if (e.key === ' ' || e.key === 'Enter') {
        if (focusedIndex !== null && processedNodes[focusedIndex]) {
          e.preventDefault();
          const targetNode = processedNodes[focusedIndex];
          setSelectedNode(prev => (prev?.id === targetNode.id ? null : targetNode));
        }
      } else if (e.key.toLowerCase() === 'r') {
        if (focusedIndex !== null && processedNodes[focusedIndex]) {
          e.preventDefault();
          onAddJournal(processedNodes[focusedIndex]);
        }
      } else if (e.key === 'Escape') {
        if (selectedNode) {
          e.preventDefault();
          setSelectedNode(null);
        } else if (focusedIndex !== null) {
          e.preventDefault();
          setFocusedIndex(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [processedNodes, focusedIndex, selectedNode, onAddJournal]);

  const getBaseNodeCoords = (index: number) => {
    const r = Math.floor(index / 3);
    const isRowEven = r % 2 === 0;
    const col = isRowEven ? (index % 3) : (2 - (index % 3));
    const x = colXs[col];
    const y = r * rowHeight + 80;
    return { x, y, r, isRowEven, col };
  };

  const getNodeCoords = (index: number) => {
    return getBaseNodeCoords(index);
  };

  const generatePath = () => {
    if (processedNodes.length === 0) return `M ${width / 2} 50 L ${width / 2} 400`;
    if (processedNodes.length === 1) return `M ${colXs[0]} 80 L ${colXs[0]} 80`;
    
    let d = `M ${colXs[0]} 80`; 
    const coords = processedNodes.map((_, i) => getNodeCoords(i));
    
    for (let i = 0; i < coords.length - 1; i++) {
      const curr = coords[i];
      const next = coords[i + 1];
      
      if (curr.r === next.r) {
        d += ` L ${next.x} ${next.y}`;
      } else {
        const isRightTurn = curr.isRowEven;
        const cpX1 = isRightTurn ? width - 20 : 20;
        const cpX2 = isRightTurn ? width - 20 : 20;
        d += ` C ${cpX1} ${curr.y}, ${cpX2} ${next.y}, ${next.x} ${next.y}`;
      }
    }
    return d;
  };

  const getFormatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return "00:00";
    }
  };

  const totalHeight = processedNodes.length === 0 ? 400 : Math.ceil(processedNodes.length / 3) * rowHeight + 100;

  return (
    <div className="relative w-full h-full flex">
      <div 
        ref={timelineScrollContainerRef}
        className="flex-1 relative w-full h-full overflow-y-auto py-10 px-4 select-none flex justify-center"
      >
        {processedNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[360px] px-6 py-12 text-center">
            <div className="glass-card rounded-3xl p-8 max-w-md w-full mx-auto border border-violet-500/20 shadow-2xl backdrop-blur-xl">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600/20 to-fuchsia-600/10 border border-violet-500/30 flex items-center justify-center mx-auto mb-5 shadow-[0_0_25px_rgba(139,92,246,0.2)]">
                <Clock className="w-8 h-8 text-violet-400 animate-pulse" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-color)] mb-2 tracking-tight">Your day is a clean river.</h3>
              <p className="text-xs text-[var(--text-muted)] mb-4 leading-relaxed max-w-xs mx-auto">
                Work, explore, and create. LifeMirror quietly preserves the rhythm of your flow.
              </p>

              {/* Interactive Demo Ignition */}
              <div className="flex flex-col gap-2 mb-5">
                <button
                  type="button"
                  onClick={() => {
                    sound.playFocusIgnite();
                    setIsDemoMode(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-violet-500/20 transition-all cursor-pointer transform active:scale-98"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Experience Interactive River (Demo)</span>
                </button>
              </div>

              <div className="space-y-2.5 text-left">
                {[
                  { 
                    icon: "🔒", 
                    label: "100% Offline & Private", 
                    sub: "Your thoughts and creative work never leave this machine." 
                  },
                  { 
                    icon: "🌊", 
                    label: "Passive & Unobtrusive", 
                    sub: "No start buttons or timers. Meaningful focus sessions emerge naturally." 
                  },
                  { 
                    icon: "🌐", 
                    label: "Web & Desktop Harmony", 
                    sub: "Companion extension bridges browser tabs with native apps.",
                    link: "https://chromewebstore.google.com/detail/lifemirror-desktop/pblffjiaheggbamkjaojabdaemkflhmm" 
                  },
                ].map(({ icon, label, sub, link }) => (
                  <div 
                    key={label} 
                    className={`flex items-start gap-3 p-2.5 rounded-xl transition-all ${
                      link ? "hover:bg-violet-500/10 cursor-pointer group border border-transparent hover:border-violet-500/20" : "bg-black/5 dark:bg-white/5"
                    }`}
                    onClick={() => { if (link) openUrl(link); }}
                    title={link ? "Click to install companion extension from Chrome Web Store" : undefined}
                  >
                    <span className="text-base mt-0.5 shrink-0">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-xs font-semibold text-[var(--text-color)] ${link ? "group-hover:text-violet-400" : ""}`}>{label}</p>
                        {link && <ExternalLink className="w-3 h-3 text-violet-400 opacity-60 group-hover:opacity-100 transition-opacity" />}
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] leading-tight mt-0.5">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="relative w-full max-w-4xl" style={{ height: `${totalHeight}px` }}>
            {/* Interactive Demo Mode Banner */}
            {isDemoMode && (
              <div className="sticky top-2 z-40 flex items-center justify-between gap-3 px-4 py-2 mb-4 rounded-2xl bg-zinc-950/90 border border-violet-500/50 text-xs shadow-2xl backdrop-blur-xl animate-in fade-in">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="font-semibold text-white">Interactive Demo River</span>
                  <span className="text-[11px] text-zinc-400 hidden sm:inline">· Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 font-mono text-[10px] text-violet-300">J</kbd>/<kbd className="px-1.5 py-0.5 rounded bg-zinc-800 font-mono text-[10px] text-violet-300">K</kbd> to glide</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setIsDemoMode(false);
                  }}
                  className="px-2.5 py-1 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-[10px] cursor-pointer transition-colors"
                >
                  Exit Demo
                </button>
              </div>
            )}

            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${width} ${totalHeight}`} preserveAspectRatio="none" fill="none">
              <path d={generatePath()} stroke="var(--timeline-bg-path)" strokeWidth="4" strokeLinecap="round" />
              <path d={generatePath()} stroke="url(#timeline-grad)" strokeWidth="4" strokeLinecap="round" className="timeline-glow opacity-80" />
              <defs>
                <linearGradient id="timeline-grad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#c084fc" /><stop offset="50%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
              </defs>
            </svg>

            {processedNodes.map((node, index) => {
              const { y: nodeY, col } = getNodeCoords(index);
              const isNodeActive = Boolean(
                activeNodeStartTime && (
                  node.start_time === activeNodeStartTime ||
                  node.originalActivities?.some(a => a.start_time === activeNodeStartTime)
                )
              );
              const isCardActive = focusedIndex === index || (selectedNode != null && selectedNode.id === node.id);

              // Volumetric sizing & aura based on deep work duration
              const durationSecs = node.duration || 0;
              const isEpicSession = durationSecs >= 3600; // >= 1 hour
              const isDeepSession = durationSecs >= 1800; // >= 30 mins
              const anchorSize = isEpicSession ? "w-11 h-11" : isDeepSession ? "w-10 h-10" : "w-9 h-9";
              const anchorAura = isEpicSession
                ? "shadow-[0_0_24px_rgba(139,92,246,0.5)] ring-2 ring-violet-400/50 border-violet-400"
                : isDeepSession
                ? "shadow-[0_0_16px_rgba(139,92,246,0.35)] ring-1 ring-violet-500/30 border-violet-500"
                : node.isShield
                ? "border-amber-500/70"
                : "border-violet-500/80";

              return (
                <React.Fragment key={node.id || index}>
                  <div
                    className={`absolute z-20 ${anchorSize} rounded-full border-2 bg-[var(--timeline-anchor-bg)] flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300 hover:scale-125 ${
                      isCardActive
                        ? 'scale-125 !border-violet-500 dark:!border-violet-400 ring-4 ring-violet-500/50 dark:ring-violet-400/60 shadow-[0_0_24px_rgba(139,92,246,0.9)] z-30'
                        : anchorAura
                    }`}
                    style={{ left: colPercentages[col], top: `${nodeY}px` }}
                    onClick={() => {
                      setSelectedNode(node);
                      setFocusedIndex(index);
                    }}
                    onMouseEnter={() => setIsHovering(index)}
                    onMouseLeave={() => setIsHovering(null)}
                  >
                    {isNodeActive && (
                      <>
                        <div className="absolute -inset-3.5 rounded-full bg-emerald-500/20 animate-ping pointer-events-none" />
                        <div className="absolute -inset-2 rounded-full bg-violet-400/25 blur-md pointer-events-none animate-pulse" />
                        <div className="absolute -inset-1 rounded-full bg-emerald-400/35 animate-ping pointer-events-none" />
                        <div className="absolute inset-0 rounded-full border-2 border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.7)] pointer-events-none" />
                      </>
                    )}
                    {node.isShield ? (
                      <ShieldAlert className="w-5 h-5 text-amber-500" />
                    ) : (
                      <AppIcon 
                        appName={String(node.app_name)} 
                        url={node.url || (node.originalActivities[0] && node.originalActivities[0].url)} 
                        iconUrl={node.icon_url || (node.originalActivities[0] && node.originalActivities[0].icon_url)} 
                        domainTag={node.domain_tag || (node.originalActivities[0] && node.originalActivities[0].domain_tag)}
                        source={node.source} 
                        className={isEpicSession ? "w-6 h-6" : "w-5 h-5"} 
                        showBadge={true}
                      />
                    )}
                  </div>

                  {/* The Estuary of Time: Living "Now" Spring & Context Resume */}
                  {isNodeActive && (
                    <div
                      className="absolute z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 backdrop-blur-md shadow-[0_0_15px_rgba(52,211,153,0.3)] transition-all animate-in fade-in"
                      style={{ left: colPercentages[col], top: `${nodeY + 14}px`, transform: 'translateX(-50%)' }}
                    >
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                      </span>
                      <span className="text-[9px] font-bold tracking-wider font-mono">
                        FLOWING{node.duration && node.duration >= 60 ? ` · ${Math.round(node.duration / 60)}m` : ""}
                      </span>
                      {onResumeClick && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onResumeClick();
                          }}
                          className="ml-0.5 flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-200 hover:text-white bg-emerald-600/40 hover:bg-emerald-500 rounded-md transition-colors cursor-pointer"
                          title="Resume Flow context where you left off"
                        >
                          <Sparkles className="w-2.5 h-2.5 text-emerald-300" />
                          <span>Resume</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Organic connector stem from river anchor to memory island */}
                  <div
                    className={`absolute z-0 transition-all duration-300 pointer-events-none transform -translate-x-1/2 ${
                      isCardActive
                        ? "w-1 bg-gradient-to-b from-violet-500 to-violet-400 opacity-100 shadow-[0_0_8px_rgba(139,92,246,0.8)]"
                        : "w-0.5 bg-gradient-to-b from-violet-500/50 to-violet-500/15 opacity-70"
                    }`}
                    style={{
                      left: colPercentages[col],
                      top: `${nodeY + 12}px`,
                      height: '11px',
                    }}
                  />

                  <div
                    ref={(el) => {
                      if (el) cardRefs.current.set(node.id, el);
                      else cardRefs.current.delete(node.id);
                    }}
                    className={`absolute group glass-card rounded-xl p-3.5 shadow-xl text-left transition-all duration-300 ${
                      isCardActive
                        ? '!border-violet-500 dark:!border-violet-400 !ring-2 !ring-violet-500/80 dark:!ring-violet-400/90 !shadow-[0_0_30px_rgba(139,92,246,0.45)] scale-[1.03] -translate-y-1.5 z-30 bg-violet-50/90 dark:bg-violet-950/45'
                        : `z-10 ${isEpicSession ? 'border-violet-500/40 shadow-violet-500/10' : isDeepSession ? 'border-violet-500/25' : ''}`
                    } ${
                      node.isGroupedSession 
                        ? 'cursor-pointer hover:border-violet-500/60 hover:-translate-y-1.5 hover:shadow-[0_16px_36px_rgba(139,92,246,0.18)]' 
                        : 'hover:border-violet-500/40'
                    }`}
                    style={{
                      left: colPercentages[col],
                      top: `${nodeY + 22}px`,
                      transform: 'translateX(-50%)',
                      ...cardWidthStyle
                    }}
                    onClick={(e) => {
                      setFocusedIndex(index);
                      if (node.isGroupedSession || node.isMemoryNode) {
                        const target = e.target as HTMLElement;
                        if (!target.closest('button') && !target.closest('a')) {
                          setSelectedNode(node);
                        }
                      }
                    }}
                  >
                    {/* Subtle specular top sheen on hover */}
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/0 to-transparent group-hover:via-white/30 dark:group-hover:via-white/20 transition-all duration-300 pointer-events-none rounded-t-xl" />

                    {/* Category color pip — top-right corner */}
                    {!node.isShield && (() => {
                      const cat = mapAppToCategory(
                        node.app_name,
                        node.window_title,
                        node.url || (node.originalActivities[0]?.url ?? "")
                      );
                      const catInfo = CATEGORIES[cat];
                      return (
                        <span
                          className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: catInfo.color }}
                          title={catInfo.name}
                        />
                      );
                    })()}
                    {/* Visual stack effect for grouped boxes — bidirectional tactile bloom on hover */}
                    {node.isGroupedSession && (node.originalActivities.length + node.subEvents.length > 1 || (node.distractionEvents && node.distractionEvents.length > 1)) && (
                      <>
                        <div className="absolute inset-0 bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] transform translate-x-0.5 translate-y-1 -z-10 opacity-70 pointer-events-none shadow-sm origin-top transition-all duration-300 group-hover:-translate-x-2 group-hover:translate-y-1.5 group-hover:-rotate-2 group-hover:border-violet-500/30" />
                        {(node.originalActivities.length + node.subEvents.length > 2 || (node.distractionEvents && node.distractionEvents.length > 2)) && (
                          <div className="absolute inset-0 bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] transform translate-x-1.5 translate-y-2 -z-20 opacity-40 pointer-events-none shadow-sm origin-top transition-all duration-300 group-hover:translate-x-2.5 group-hover:translate-y-2 group-hover:rotate-3 group-hover:border-violet-500/20" />
                        )}
                      </>
                    )}
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <div className="flex items-center gap-1 overflow-hidden max-w-[150px]">
                        {node.isShield ? (
                          <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
                        ) : node.tools && node.tools.length > 1 ? (
                          <div 
                            className="flex items-center -space-x-1.5 overflow-hidden p-0.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 shrink-0"
                            title={node.tools.map(t => `${t.app_name} (${formatDuration(t.duration)})`).join(", ")}
                          >
                            {node.tools.slice(0, 3).map((t, idx) => (
                              <div key={idx} className="relative z-10 w-4 h-4 rounded-full bg-[var(--card-bg)] shadow-xs flex items-center justify-center overflow-hidden border border-white/20 dark:border-zinc-800">
                                <AppIcon 
                                  appName={t.app_name} 
                                  iconUrl={t.icon_url} 
                                  url={t.url} 
                                  source={t.source} 
                                  className="w-3.5 h-3.5" 
                                  showBadge={false} 
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <AppIcon 
                            appName={String(node.app_name)} 
                            url={node.url || (node.originalActivities[0] && node.originalActivities[0].url)} 
                            iconUrl={node.icon_url || (node.originalActivities[0] && node.originalActivities[0].icon_url)} 
                            domainTag={node.domain_tag || (node.originalActivities[0] && node.originalActivities[0].domain_tag)}
                            source={node.source} 
                            className="w-4 h-4 shrink-0" 
                            showBadge={true}
                          />
                        )}
                        
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full truncate ${
                          node.isShield
                            ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/30'
                            : 'bg-black/5 dark:bg-white/10 text-[var(--text-color)] border border-black/10 dark:border-white/10'
                        }`}>
                          {node.isShield
                            ? (node.distractionEvents && node.distractionEvents.length > 1 ? `${node.distractionEvents.length} Blocked` : 'Shielded')
                            : (node.dominantProject || 
                               node.domain_tag || 
                               (node.url ? extractDomain(node.url) : '') || 
                               node.originalActivities[0]?.domain_tag || 
                               (node.originalActivities[0]?.url ? extractDomain(node.originalActivities[0].url) : '') || 
                               node.app_name)
                          }
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        {isCardActive && (
                          <span className="text-[8px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-violet-600 text-white shadow-xs animate-in fade-in">
                            Selected
                          </span>
                        )}
                        {isEpicSession && (
                          <span className="text-[8px] font-bold tracking-wider uppercase px-1 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            Epic
                          </span>
                        )}
                        {isDeepSession && !isEpicSession && (
                          <span className="text-[8px] font-bold tracking-wider uppercase px-1 py-0.2 rounded bg-violet-500/15 text-violet-300 border border-violet-500/30">
                            Flow
                          </span>
                        )}
                        <div className="flex items-center text-[10px] text-[var(--text-muted)] gap-1 font-mono" title={`Active: ${formatDuration(node.duration)}${node.total_duration && formatDuration(node.total_duration) !== formatDuration(node.duration) ? ` • Total span: ${formatDuration(node.total_duration)}` : ''}`}>
                          <Clock className="w-2.5 h-2.5 text-violet-400" />
                          <LiveTimer
                            startTime={node.start_time}
                            activeStartTime={activeNodeStartTime}
                            initialDuration={node.duration}
                            isActive={isNodeActive}
                          />
                        </div>
                      </div>
                    </div>

                    <h4 className={`text-xs font-bold leading-snug line-clamp-2 mb-1 flex-1 tracking-tight ${node.isShield ? 'text-red-400' : 'text-[var(--text-color)] group-hover:text-violet-400 transition-colors'}`} title={getGroupedSessionTitle(node)}>
                      {getGroupedSessionTitle(node)}
                    </h4>

                    {/* Symphony indicator showing touchpoints and tool count */}
                    {node.isGroupedSession && (node.originalActivities.length > 1 || (node.tools && node.tools.length > 1)) && (
                      <div className="flex items-center gap-1.5 my-1 text-[9px] text-[var(--text-muted)] font-mono">
                        <span>{node.originalActivities.length} touchpoints</span>
                        {node.tools && node.tools.length > 1 && (
                          <>
                            <span>•</span>
                            <span className="text-violet-400 font-semibold">{node.tools.length} tools</span>
                          </>
                        )}
                      </div>
                    )}

                    {node.notes && (
                      <div className="mt-1 pt-1 border-t border-[var(--border-color)] text-[10px] text-violet-600 dark:text-violet-300 font-medium italic flex items-center gap-1.5 truncate" title={node.notes}>
                        <MessageSquare className="w-3 h-3 text-violet-500 shrink-0" />
                        <span className="truncate">{node.notes}</span>
                      </div>
                    )}


                    <div className="flex items-center justify-between mt-auto pt-1.5 border-t border-[var(--border-color)]">
                      <span
                        className="text-[9px] text-[var(--text-muted)] font-mono truncate"
                        title={node.end_time && node.end_time !== node.start_time ? `Span: ${getFormatTime(node.start_time)} – ${getFormatTime(node.end_time)}${node.total_duration ? ` (${formatDuration(node.total_duration)} total)` : ''}` : undefined}
                      >
                        {node.isGroupedSession && node.end_time && node.end_time !== node.start_time
                          ? `${getFormatTime(node.start_time)} – ${getFormatTime(node.end_time)}${node.total_duration && node.total_duration > node.duration ? ` • ${Math.round((node.duration / node.total_duration) * 100)}% purity` : ''}`
                          : getFormatTime(node.start_time)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {!node.isShield && !node.isMemoryNode && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddJournal(node);
                            }}
                            className="p-1 rounded text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 transition-colors cursor-pointer"
                            title={node.notes ? "Edit Note" : "Reflect"}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Keyboard Instrument Shortcuts HUD pinned to viewport bottom */}
      {processedNodes.length > 0 && (
        <div className="absolute bottom-4 inset-x-0 flex items-center justify-center pointer-events-none z-30 pb-1">
          <div className="pointer-events-auto flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)]/90 backdrop-blur-md shadow-lg text-[10px] text-[var(--text-muted)] font-mono transition-opacity opacity-75 hover:opacity-100">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold text-[var(--text-color)]">J</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold text-[var(--text-color)]">K</kbd>
              <span>Navigate</span>
            </span>
            <span className="opacity-30">•</span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold text-[var(--text-color)]">Space</kbd>
              <span>Inspect</span>
            </span>
            <span className="opacity-30">•</span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold text-[var(--text-color)]">R</kbd>
              <span>Reflect</span>
            </span>
          </div>
        </div>
      )}

      <TimelineSidebar 
        node={selectedNode} 
        onClose={() => setSelectedNode(null)}
        onDeleteLog={onDeleteLog}
        onDeleteMemoryNode={onDeleteMemoryNode}
        onUngroup={onToggleGrouped ? () => { onToggleGrouped(false); setSelectedNode(null); } : undefined}
      />
    </div>
  );
}
