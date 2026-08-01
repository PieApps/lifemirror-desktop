import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ActivityNode, MemoryNode, SubSessionEvent, DistractionEvent, DailySummary, HourlyMetric, ChatMessage } from "../types";

// ─── Date Helpers ───────────────────────────────────────────

export const getLocalDateString = (d: Date = new Date()) => {
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().split("T")[0];
};

export const getWeekRange = (dateStr: string) => {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0 = Sun, 1 = Mon ...
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - day);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  return {
    start: sunday.toISOString().split("T")[0],
    end: saturday.toISOString().split("T")[0],
  };
};

export const getMonthRange = (dateStr: string) => {
  const parts = dateStr.split("-");
  const year = parts[0];
  const month = parts[1];
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    start: `${year}-${month}-01`,
    end: `${year}-${month}-${String(lastDay).padStart(2, "0")}`,
  };
};

// ─── Hook ───────────────────────────────────────────────────

interface UseActivityDataOptions {
  trackingActive: boolean;
  isIncognito: boolean;
  setIsIncognito: (v: boolean) => void;
}

export function useActivityData({ trackingActive, isIncognito, setIsIncognito }: UseActivityDataOptions) {
  const [memoryNodes, setMemoryNodes] = useState<MemoryNode[]>([]);
  const [activities, setActivities] = useState<ActivityNode[]>([]);
  const [subSessionEvents, setSubSessionEvents] = useState<SubSessionEvent[]>([]);
  const [distractionEvents, setDistractionEvents] = useState<DistractionEvent[]>([]);
  const [activeActivity, setActiveActivity] = useState<ActivityNode | null>(null);

  // View state
  const [viewMode, setViewMode] = useState<"daily" | "weekly" | "monthly">("daily");
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString());
  const [weeklySummaries, setWeeklySummaries] = useState<DailySummary[]>([]);
  const [monthlySummaries, setMonthlySummaries] = useState<DailySummary[]>([]);
  const [heatmapData, setHeatmapData] = useState<HourlyMetric[]>([]);

  // Chat messages (stored here because they are date-scoped data)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Journal selection
  const [selectedActivity, setSelectedActivity] = useState<ActivityNode | MemoryNode | null>(null);

  // ─── Navigation ────────────────────────────────────────

  const getPeriodLabel = () => {
    const d = new Date(selectedDate);
    if (viewMode === "daily") {
      return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } else if (viewMode === "weekly") {
      const range = getWeekRange(selectedDate);
      const startD = new Date(range.start);
      const endD = new Date(range.end);
      return `${startD.toLocaleDateString([], { month: 'short', day: 'numeric' })} - ${endD.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else {
      return d.toLocaleDateString([], { month: 'long', year: 'numeric' });
    }
  };

  const handlePrevPeriod = () => {
    const d = new Date(selectedDate);
    if (viewMode === "daily") {
      d.setDate(d.getDate() - 1);
    } else if (viewMode === "weekly") {
      d.setDate(d.getDate() - 7);
    } else {
      d.setMonth(d.getMonth() - 1);
    }
    setSelectedDate(getLocalDateString(d));
  };

  const handleNextPeriod = () => {
    const d = new Date(selectedDate);
    const today = new Date();
    if (viewMode === "daily") {
      d.setDate(d.getDate() + 1);
    } else if (viewMode === "weekly") {
      d.setDate(d.getDate() + 7);
    } else {
      d.setMonth(d.getMonth() + 1);
    }
    if (d > today) {
      setSelectedDate(getLocalDateString(today));
    } else {
      setSelectedDate(getLocalDateString(d));
    }
  };

  const isNextDisabled = () => {
    const today = getLocalDateString();
    if (viewMode === "daily") {
      return selectedDate >= today;
    } else if (viewMode === "weekly") {
      const currentWeek = getWeekRange(today);
      const selectedWeek = getWeekRange(selectedDate);
      return selectedWeek.start >= currentWeek.start;
    } else {
      const [tYear, tMonth] = today.split("-");
      const [sYear, sMonth] = selectedDate.split("-");
      return sYear > tYear || (sYear === tYear && sMonth >= tMonth);
    }
  };

  // ─── Data Loading ──────────────────────────────────────

  const loadData = async () => {
    try {
      const todayStr = getLocalDateString();
      const currentActive = await invoke<ActivityNode | null>("get_current_activity");

      if (viewMode === "daily") {
        const dbActivities = await invoke<ActivityNode[]>("get_daily_activities", { date: selectedDate });
        const dbMemoryNodes = await invoke<MemoryNode[]>("get_memory_nodes_for_day", { date: selectedDate });
        let mergedActivities = [...dbActivities];
        
        const isToday = selectedDate === todayStr;
        if (isToday && currentActive && trackingActive && !isIncognito) {
          const isAlreadyLogged = dbActivities.some(node => node.start_time === currentActive.start_time);
          if (!isAlreadyLogged) {
            mergedActivities = [currentActive, ...dbActivities];
            setActiveActivity(currentActive);
          } else {
            setActiveActivity(null);
          }
        } else {
          setActiveActivity(null);
        }
        
        setActivities(mergedActivities);
        setMemoryNodes(dbMemoryNodes);
        try {
          const events = await invoke<SubSessionEvent[]>("get_sub_session_events_for_day", { date: selectedDate });
          setSubSessionEvents(events);
        } catch (err) {
          console.error("Failed to load sub session events:", err);
        }
        
        try {
          const dEvents = await invoke<DistractionEvent[]>("get_distraction_events_for_day", { date: selectedDate });
          setDistractionEvents(dEvents);
        } catch (err) {
          console.error("Failed to load distraction events:", err);
        }
      } else if (viewMode === "weekly") {
        const range = getWeekRange(selectedDate);
        const summaries = await invoke<DailySummary[]>("get_weekly_summary", { startDate: range.start, endDate: range.end });
        const heat = await invoke<HourlyMetric[]>("get_hourly_heatmap", { startDate: range.start, endDate: range.end });
        setWeeklySummaries(summaries);
        setHeatmapData(heat);
      } else if (viewMode === "monthly") {
        const range = getMonthRange(selectedDate);
        const summaries = await invoke<DailySummary[]>("get_monthly_summary", { startDate: range.start, endDate: range.end });
        setMonthlySummaries(summaries);
      }
      const incognitoState = await invoke<boolean>("is_incognito");
      setIsIncognito(incognitoState);

      if (!incognitoState) {
        try {
          const history = await invoke<ChatMessage[]>("get_chat_history", { date: selectedDate });
          setChatMessages(history);
        } catch (err) {
          console.error("Failed to load chat history:", err);
        }
      }
    } catch (e) {
      console.error("Failed to load Tauri DB data:", e);
    }
  };

  // Poll database records
  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      if (trackingActive && !isIncognito) {
        loadData();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [trackingActive, isIncognito, viewMode, selectedDate]);

  // Local active session ticking for smooth real-time visual updates
  useEffect(() => {
    const ticker = setInterval(() => {
      if (activeActivity && trackingActive && !isIncognito && selectedDate === getLocalDateString()) {
        const startMs = new Date(activeActivity.start_time).getTime();
        const elapsedSecs = Math.max(1, Math.floor((Date.now() - startMs) / 1000));
        
        setActivities(prev => prev.map(node => {
          if (node.start_time === activeActivity.start_time) {
            return { ...node, duration: elapsedSecs };
          }
          return node;
        }));
      }
    }, 1000);
    return () => clearInterval(ticker);
  }, [activeActivity, trackingActive, isIncognito, selectedDate]);

  // ─── Actions ───────────────────────────────────────────

  const handleDeleteLog = async (id: number) => {
    try {
      if (id < 0) {
        await invoke("delete_distraction_event", { id: Math.abs(id) });
      } else {
        await invoke("delete_activity_log", { id });
      }
      await loadData();
    } catch (e) {
      console.error("Failed to delete log:", e);
    }
  };

  const handleDeleteMemoryNode = async (id: number) => {
    try {
      await invoke("delete_memory_node", { id });
      await loadData();
    } catch (e) {
      console.error("Failed to delete memory node:", e);
    }
  };

  const handleSaveJournal = async (notes: string) => {
    try {
      await invoke("add_journal", { notes, activityId: selectedActivity?.id || null });
      await loadData();
    } catch (e) {
      console.error("Failed to save journal entry:", e);
    }
  };

  return {
    // Data
    memoryNodes,
    activities,
    subSessionEvents,
    distractionEvents,
    activeActivity,
    chatMessages,
    setChatMessages,
    weeklySummaries,
    monthlySummaries,
    heatmapData,

    // View
    viewMode,
    setViewMode,
    selectedDate,
    setSelectedDate,

    // Navigation
    getPeriodLabel,
    handlePrevPeriod,
    handleNextPeriod,
    isNextDisabled,

    // Journal
    selectedActivity,
    setSelectedActivity,
    handleSaveJournal,

    // Actions
    loadData,
    handleDeleteLog,
    handleDeleteMemoryNode,
  };
}
