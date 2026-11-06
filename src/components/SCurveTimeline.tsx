import React, { useState, useMemo, useEffect } from "react";
import { 
  Clock, Plus, 
  Trash2, ShieldAlert, MessageSquare, ExternalLink
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";

import { MemoryNode } from "../types";
import AppIcon, { extractDomain } from './AppIcon';
import TimelineSidebar from './TimelineSidebar';
import { LiveTimer } from './LiveTimer';
import { formatDuration, calculateNonOverlappingDuration } from '../utils/formatDuration';
import { mapAppToCategory, CATEGORIES } from '../utils/categoryMapper';

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

  if (appName) {
    const escapedApp = appName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    title = title.replace(new RegExp(`\\s*[-–—:]\\s*${escapedApp}\\s*[-–—:]\\s*`, 'i'), ' - ');
  }

  // Strip editor dirty indicators (● or *)
  title = title.replace(/\s*[●*]\s*$/, "");

  if (!title.trim()) {
    if (domainTag) return domainTag;
    if (appName) return appName;
    return "Activity Session";
  }

  return title.trim();
}

export function getGroupedSessionTitle(node: TimelineNode): string {
  if (node.isShield) return "Distraction Shield";
  if (node.isMemoryNode && node.window_title && !node.window_title.toLowerCase().endsWith(" session") && !node.window_title.toLowerCase().startsWith("session involving")) {
    return formatCleanTitle(node.window_title, node.app_name, node.domain_tag, node.url);
  }

  if (node.originalActivities && node.originalActivities.length > 0) {
    let topAct = node.originalActivities[0];
    for (const act of node.originalActivities) {
      if (act.duration > topAct.duration) {
        topAct = act;
      }
    }
    const cleaned = formatCleanTitle(topAct.window_title, topAct.app_name, topAct.domain_tag, topAct.url);
    if (cleaned && cleaned !== topAct.app_name && !cleaned.toLowerCase().endsWith(" session")) {
      return cleaned;
    }
  }

  if (node.subEvents && node.subEvents.length > 0) {
    const topSub = node.subEvents[0];
    const cleaned = formatCleanTitle(topSub.title, topSub.parent_app_name || node.app_name, topSub.context_tag, topSub.primary_uri);
    if (cleaned) return cleaned;
  }

  return formatCleanTitle(node.window_title, node.app_name, node.domain_tag, node.url);
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
  onAddJournal: (activity: ActivityNode) => void;
  onDeleteLog: (id: number) => void;
  onDeleteMemoryNode?: (id: number) => void;
  activeNodeStartTime?: string;
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
}

// extractDomain moved to AppIcon.tsx

import { ConfirmModal } from './ConfirmModal';

export function SCurveTimeline({ 
  memoryNodes,
  activities, 
  subSessionEvents,
  distractionEvents,
  onAddJournal, 
  onDeleteLog,
  onDeleteMemoryNode,
  activeNodeStartTime
}: SCurveTimelineProps) {
  const rowHeight = 200;
  const width = 800;
  const colXs = [130, 400, 670];
  const colPercentages = ['16.25%', '50%', '83.75%'];

  const [selectedNode, setSelectedNode] = useState<TimelineNode | null>(null);
  const [_isHovering, setIsHovering] = useState<number | null>(null);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void, onCancel: () => void}>({
    isOpen: false, title: '', message: '', onConfirm: () => {}, onCancel: () => {}
  });

  // Group consecutive browser/editor usages together
  const processedNodes = useMemo(() => {
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
            displayTitle = domain ? `${domain.charAt(0).toUpperCase() + domain.slice(1)} Session` : `${dominantAppName} Session`;
          } else {
            displayTitle = `${dominantAppName} Session`;
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
        const isBrowser = activity.source.toLowerCase() === "browser" || isBrowserApp(activity.app_name);
        const isEditor = activity.source.toLowerCase() === "editor";
        const isGroupable = isBrowser || isEditor;
        const actStartMs = new Date(activity.start_time).getTime();
        const actEndMs = actStartMs + activity.duration * 1000;

        if (isGroupable) {
          const gapSeconds = currentGroup && !currentGroup.isShield
            ? (actStartMs - currentGroupEndMs) / 1000
            : 0;

          if (currentGroup && !currentGroup.isShield && currentGroup.app_name === activity.app_name && gapSeconds < 1800) {
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
              window_title: `${activity.app_name} Session`,
              start_time: activity.start_time,
              end_time: new Date(actEndMs).toISOString(),
              duration: activity.duration,
              total_duration: activity.duration,
              source: isBrowser ? "Browser" : "Editor",
              notes: activity.notes,
              originalActivities: [activity],
              subEvents: [],
            };
          }
        } else {
          if (currentGroup) {
            nodes.push(currentGroup);
            currentGroup = null;
            currentGroupEndMs = 0;
          }
          nodes.push({
            isGroupedSession: false,
            id: activity.id,
            app_name: activity.app_name,
            window_title: activity.window_title,
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
          });
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
        node.window_title = "Working Session";
      }
    });

    return nodes;
  }, [memoryNodes, activities, subSessionEvents, distractionEvents]);

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
      <div className="flex-1 relative w-full h-full overflow-y-auto py-10 px-4 select-none flex justify-center">
        {processedNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[340px] px-6 py-12 text-center">
            <div className="glass-card rounded-3xl p-8 max-w-sm w-full mx-auto">
              <div className="w-14 h-14 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-5">
                <Clock className="w-7 h-7 text-violet-400" />
              </div>
              <h3 className="text-base font-bold text-[var(--text-color)] mb-1">Just use your computer.</h3>
              <p className="text-sm text-[var(--text-muted)] mb-6">
                LifeMirror records your activity automatically — no "Start" button needed.
              </p>
              <div className="space-y-3 text-left">
                {[
                  { icon: "🟢", label: "Tracking is active", sub: "Your OS windows are being watched." },
                  { icon: "⏱️", label: "Stay in a window for 60 s", sub: "Short switches are filtered to reduce noise." },
                  { 
                    icon: "🌐", 
                    label: "Browser tabs are tracked too", 
                    sub: "Install companion extension (Chrome, Brave, Edge, Arc, Opera, Vivaldi).",
                    link: "https://chromewebstore.google.com/detail/lifemirror-desktop/pblffjiaheggbamkjaojabdaemkflhmm" 
                  },
                ].map(({ icon, label, sub, link }) => (
                  <div 
                    key={label} 
                    className={`flex items-start gap-3 p-2 rounded-xl transition-colors ${
                      link ? "hover:bg-violet-500/10 cursor-pointer group border border-transparent hover:border-violet-500/20" : ""
                    }`}
                    onClick={() => { if (link) openUrl(link); }}
                    title={link ? "Click to install extension from Chrome Web Store" : undefined}
                  >
                    <span className="text-base mt-0.5 shrink-0">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-xs font-semibold text-[var(--text-color)] ${link ? "group-hover:text-violet-400" : ""}`}>{label}</p>
                        {link && <ExternalLink className="w-3 h-3 text-violet-400 opacity-60 group-hover:opacity-100 transition-opacity" />}
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)]">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="relative w-full max-w-4xl" style={{ height: `${totalHeight}px` }}>
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

              return (
                <React.Fragment key={node.id || index}>
                  <div
                    className={`absolute z-20 w-9 h-9 rounded-full border-2 bg-[var(--timeline-anchor-bg)] flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform duration-300 hover:scale-125 ${
                      node.isShield ? 'border-red-500' : 'border-violet-500'
                    }`}
                    style={{ left: colPercentages[col], top: `${nodeY}px` }}
                    onClick={() => setSelectedNode(node)}
                    onMouseEnter={() => setIsHovering(index)}
                    onMouseLeave={() => setIsHovering(null)}
                  >
                    {node.isShield ? (
                      <ShieldAlert className="w-5 h-5 text-red-500" />
                    ) : (
                      <AppIcon 
                        appName={String(node.app_name)} 
                        url={node.url || (node.originalActivities[0] && node.originalActivities[0].url)} 
                        iconUrl={node.icon_url || (node.originalActivities[0] && node.originalActivities[0].icon_url)} 
                        domainTag={node.domain_tag || (node.originalActivities[0] && node.originalActivities[0].domain_tag)}
                        source={node.source} 
                        className="w-5 h-5" 
                        showBadge={true}
                      />
                    )}
                  </div>

                  {/* NOW badge — shown on the live active node */}
                  {isNodeActive && (
                    <div
                      className="absolute z-30 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                      style={{ left: colPercentages[col], top: `${nodeY + 10}px`, transform: 'translateX(-50%)' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_4px_rgba(52,211,153,0.6)]" />
                      <span className="text-[9px] font-bold tracking-wider">LIVE</span>
                    </div>
                  )}

                  <div
                    className={`absolute group glass-card rounded-xl p-3.5 shadow-xl text-left z-10 transition-all duration-300 ${
                      node.isGroupedSession ? 'cursor-pointer hover:border-violet-500/50' : ''
                    }`}
                    style={{
                      left: colPercentages[col],
                      top: `${nodeY + 22}px`,
                      transform: 'translateX(-50%)',
                      width: '28%',
                      minWidth: '160px',
                      maxWidth: '260px',
                      minHeight: '100px'
                    }}
                    onClick={(e) => {
                      if (node.isGroupedSession || node.isMemoryNode) {
                        const target = e.target as HTMLElement;
                        if (!target.closest('button') && !target.closest('a')) {
                          setSelectedNode(node);
                        }
                      }
                    }}
                  >
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
                    {/* Visual stack effect for grouped boxes (single blurred top layer, solid translucent stack layers) */}
                    {node.isGroupedSession && (node.originalActivities.length + node.subEvents.length > 1 || (node.distractionEvents && node.distractionEvents.length > 1)) && (
                      <>
                        <div className="absolute inset-0 bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] transform translate-x-1 translate-y-1.5 -z-10 opacity-60 pointer-events-none shadow-sm transition-transform duration-300 group-hover:translate-x-1.5 group-hover:translate-y-2"></div>
                        {(node.originalActivities.length + node.subEvents.length > 2 || (node.distractionEvents && node.distractionEvents.length > 2)) && (
                          <div className="absolute inset-0 bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] transform translate-x-2 translate-y-3 -z-20 opacity-30 pointer-events-none shadow-sm transition-transform duration-300 group-hover:translate-x-3 group-hover:translate-y-4"></div>
                        )}
                      </>
                    )}
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <div className="flex items-center gap-1 overflow-hidden max-w-[130px]">
                        {node.isShield ? (
                          <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
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
                            ? (node.distractionEvents && node.distractionEvents.length > 1 ? `${node.distractionEvents.length} Blocked` : 'Distraction Blocked')
                            : node.isGroupedSession 
                              ? (() => {
                                  const subCount = node.subEvents.length;
                                  const uncoveredActCount = node.originalActivities.filter(act => {
                                    const aS = new Date(act.start_time).getTime();
                                    const aE = aS + act.duration * 1000;
                                    return !node.subEvents.some(s => {
                                      const sT = new Date(s.timestamp).getTime();
                                      return sT >= aS - 5000 && sT <= aE + 5000;
                                    });
                                  }).length;
                                  const count = subCount > 0 ? (subCount + uncoveredActCount) : node.originalActivities.length;
                                  return `${count} item${count === 1 ? '' : 's'}`;
                                })()
                              : (node.domain_tag || (node.url ? node.url.split('/')[0] : '')) || node.app_name
                          }
                        </span>
                      </div>
                      <div className="flex items-center text-[10px] text-[var(--text-muted)] gap-0.5 shrink-0" title={`Active: ${formatDuration(node.duration)}${node.total_duration && node.total_duration > node.duration ? ` • Total: ${formatDuration(node.total_duration)}` : ''}`}>
                        <Clock className="w-2.5 h-2.5 text-violet-400" />
                        <LiveTimer
                          startTime={node.start_time}
                          activeStartTime={activeNodeStartTime}
                          initialDuration={node.duration}
                          isActive={isNodeActive}
                        />
                        {node.isGroupedSession && node.total_duration && node.total_duration > node.duration && (
                          <span className="text-[9px] text-[var(--text-muted)] opacity-70 font-mono ml-0.5" title={`Total session span: ${formatDuration(node.total_duration)}`}>
                            /{formatDuration(node.total_duration)}
                          </span>
                        )}
                      </div>
                    </div>

                    <h4 className={`text-xs font-semibold line-clamp-2 mb-1 flex-1 ${node.isShield ? 'text-red-400' : 'text-[var(--text-color)]'}`} title={getGroupedSessionTitle(node)}>
                      {getGroupedSessionTitle(node)}
                    </h4>

                    {node.notes && (
                      <div className="mt-1 pt-1 border-t border-[var(--border-color)] text-[10px] text-violet-600 dark:text-violet-300 font-medium italic flex items-center gap-1.5 truncate" title={node.notes}>
                        <MessageSquare className="w-3 h-3 text-violet-500 shrink-0" />
                        <span className="truncate">{node.notes}</span>
                      </div>
                    )}


                    <div className="flex items-center justify-between mt-auto pt-1.5 border-t border-[var(--border-color)]">
                      <span
                        className="text-[9px] text-[var(--text-muted)] font-mono"
                        title={node.end_time && node.end_time !== node.start_time ? `Span: ${getFormatTime(node.start_time)} – ${getFormatTime(node.end_time)}` : undefined}
                      >
                        {node.isGroupedSession && node.end_time && node.end_time !== node.start_time
                          ? `${getFormatTime(node.start_time)} - ${getFormatTime(node.end_time)}${node.total_duration && node.total_duration > node.duration ? ` (${formatDuration(node.total_duration)})` : ''}`
                          : getFormatTime(node.start_time)}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (node.isShield) {
                              setConfirmModal({
                                isOpen: true,
                                title: "Delete Distractions",
                                message: "Delete all blocked distractions in this group?",
                                onConfirm: () => {
                                  node.distractionEvents?.forEach(ev => {
                                    onDeleteLog(-ev.id);
                                  });
                                },
                                onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
                              });
                            } else if (node.isGroupedSession) {
                              setConfirmModal({
                                isOpen: true,
                                title: "Delete Session",
                                message: "Delete this session and all its sub-events?",
                                onConfirm: () => {
                                  node.originalActivities.forEach(act => {
                                    if (act.id) onDeleteLog(act.id);
                                  });
                                  if (node.isMemoryNode && onDeleteMemoryNode && node.id) {
                                    onDeleteMemoryNode(node.id);
                                  }
                                },
                                onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
                              });
                            } else {
                              if (node.id) {
                                setConfirmModal({
                                  isOpen: true,
                                  title: "Delete Event",
                                  message: "Delete this event?",
                                  onConfirm: () => onDeleteLog(node.id),
                                  onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
                                });
                              }
                            }
                          }}
                          disabled={!node.id}
                          className="p-1 rounded text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 disabled:opacity-50 transition-colors cursor-pointer"
                          title="Delete log"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {!node.isShield && !node.isMemoryNode && (
                          <button
                            onClick={() => {
                              onAddJournal(node.originalActivities[0] || (node as any));
                            }}
                            className="p-1 rounded text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 transition-colors cursor-pointer"
                            title={node.notes ? "Edit Note" : "Reflect"}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(node.isGroupedSession || node.isMemoryNode) && (
                          <button
                            onClick={() => setSelectedNode(node)}
                            className="text-[9px] font-medium text-violet-500 hover:text-violet-400 transition-colors px-1 cursor-pointer"
                          >
                            Details →
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

      <TimelineSidebar 
        node={selectedNode} 
        onClose={() => setSelectedNode(null)}
        onDeleteLog={onDeleteLog}
      />
      <ConfirmModal {...confirmModal} />
    </div>
  );
}
