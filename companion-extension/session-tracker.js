/**
 * LifeMirror Session & Dwell Time Tracker (ES Module)
 * On-device focus session tracking, idle detection, multi-signal semantic classification,
 * rolling local storage analytics, and domain exclusion management.
 */

import "./domain-rules.js";
import { forwardTabActivity, isDesktopTracking, isConnected } from "./native-rpc.js";

const IDLE_THRESHOLD_SECONDS = 60;
const MAX_META_CACHE = 150;
const DAILY_KEYS_STORE = "daily_keys_index";

// ── Profile Identity State ──────────────────────────────────────────────────
let profileId = null;
let profileLabel = "Default";
let browserName = "Chrome";

export async function initProfileIdentity() {
  try {
    const data = await chrome.storage.local.get(["profile_id", "profile_label"]);
    if (data.profile_id) {
      profileId = data.profile_id;
    } else {
      profileId = `prof_${crypto.randomUUID().slice(0, 8)}`;
      await chrome.storage.local.set({ profile_id: profileId });
    }
    profileLabel = data.profile_label || "Default";

    if (navigator.userAgentData && navigator.userAgentData.brands) {
      const brands = navigator.userAgentData.brands.map((b) => b.brand.toLowerCase());
      if (brands.some((b) => b.includes("brave"))) {
        browserName = "Brave";
      } else if (brands.some((b) => b.includes("edge"))) {
        browserName = "Edge";
      } else if (brands.some((b) => b.includes("chrome"))) {
        browserName = "Chrome";
      }
    } else {
      const ua = (navigator.userAgent || "").toLowerCase();
      if (ua.includes("edg/")) {
        browserName = "Edge";
      } else if (ua.includes("brave")) {
        browserName = "Brave";
      } else {
        browserName = "Chrome";
      }
    }
  } catch (err) {
    console.error("[LifeMirror] Profile identity init error:", err);
  }
}

export function getProfileIdentity() {
  return { profileId, profileLabel, browserName };
}

export async function updateProfileLabel(newLabel) {
  const clean = (newLabel || "Default").trim();
  profileLabel = clean;
  await chrome.storage.local.set({ profile_label: clean });
  return profileLabel;
}

// ── In-Memory Active Session & Metadata Cache ────────────────────────────────
let currentSession = null;
let isUserIdle = false;
const metaCache = new Map(); // url -> description

export function getCurrentSession() {
  return currentSession;
}

export function resetActiveSession() {
  currentSession = null;
  persistActiveSession(null);
}

export async function persistActiveSession(session) {
  try {
    if (chrome.storage?.session) {
      if (session) {
        await chrome.storage.session.set({ active_session: session });
      } else {
        await chrome.storage.session.remove("active_session");
      }
    }
  } catch (err) {
    console.warn("[LifeMirror] Failed to persist active session to session storage:", err);
  }
}

export async function restoreActiveSession() {
  try {
    if (chrome.storage?.session) {
      const res = await chrome.storage.session.get("active_session");
      if (res && res.active_session && !currentSession) {
        currentSession = res.active_session;
      }
    }
  } catch (err) {
    console.warn("[LifeMirror] Failed to restore active session from session storage:", err);
  }
}

export async function persistMetaCache() {
  try {
    if (chrome.storage?.session) {
      const entries = Array.from(metaCache.entries());
      await chrome.storage.session.set({ meta_cache: entries });
    }
  } catch (err) {
    console.warn("[LifeMirror] Failed to persist meta cache to session storage:", err);
  }
}

export async function restoreMetaCache() {
  try {
    if (chrome.storage?.session) {
      const res = await chrome.storage.session.get("meta_cache");
      if (Array.isArray(res && res.meta_cache)) {
        for (const [url, desc] of res.meta_cache) {
          if (!metaCache.has(url)) {
            metaCache.set(url, desc);
          }
        }
      }
    }
  } catch (err) {
    console.warn("[LifeMirror] Failed to restore meta cache from session storage:", err);
  }
}

export function setPageMeta(cleanTabUrl, sanitizedDesc) {
  metaCache.set(cleanTabUrl, sanitizedDesc);
  if (metaCache.size > MAX_META_CACHE) {
    const firstKey = metaCache.keys().next().value;
    metaCache.delete(firstKey);
  }
  if (currentSession && currentSession.url === cleanTabUrl) {
    currentSession.description = sanitizedDesc;
    persistActiveSession(currentSession);
  }
  persistMetaCache();
}

// ── Domain Exclusion Rules Cache & Engine ─────────────────────────────────────
let excludedEntries = []; // array of { domain, include_subdomains, updated_at, removed }

export async function loadExcludedEntries() {
  try {
    const data = await chrome.storage.local.get(["excluded_entries"]);
    if (Array.isArray(data.excluded_entries)) {
      excludedEntries = data.excluded_entries;
    }
  } catch (err) {
    console.error("[LifeMirror] Failed to load excluded_entries:", err);
  }
}

export function getExcludedDomainsList() {
  return excludedEntries.filter((e) => !e.removed);
}

export function extractHostname(urlStr) {
  try {
    return new URL(urlStr).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function isDomainExcluded(hostname) {
  if (!hostname) return false;
  return excludedEntries.some((entry) => {
    if (entry.removed) return false;
    return globalThis.LifeMirrorDomainRules.hostMatches(
      hostname,
      entry.domain,
      entry.include_subdomains !== false
    );
  });
}

export function mergeEntries(existing, incoming) {
  const map = new Map();
  for (const item of existing) {
    if (item && item.domain) {
      map.set(item.domain, item);
    }
  }
  for (const item of incoming) {
    if (!item || !item.domain) continue;
    const prev = map.get(item.domain);
    if (!prev || (item.updated_at || 0) >= (prev.updated_at || 0)) {
      map.set(item.domain, item);
    }
  }
  return Array.from(map.values());
}

export async function purgeLocalDomainData(domain, includeSubdomains = true) {
  const cleanDomain = domain.toLowerCase();
  let purgedCount = 0;

  try {
    const allDailyKeys = await getDailyKeys();
    const data = await chrome.storage.local.get(allDailyKeys);
    const updates = {};

    for (const key of allDailyKeys) {
      const dayRecord = data[key];
      if (!dayRecord) continue;
      let dayModified = false;

      if (dayRecord.domains) {
        for (const dom of Object.keys(dayRecord.domains)) {
          if (globalThis.LifeMirrorDomainRules.hostMatches(dom, cleanDomain, includeSubdomains)) {
            const removedSecs = dayRecord.domains[dom].seconds || 0;
            dayRecord.totalActiveSeconds = Math.max(0, dayRecord.totalActiveSeconds - removedSecs);
            delete dayRecord.domains[dom];
            dayModified = true;
          }
        }
      }

      if (dayRecord.recentSessions) {
        const initialLen = dayRecord.recentSessions.length;
        dayRecord.recentSessions = dayRecord.recentSessions.filter((s) => {
          const match = globalThis.LifeMirrorDomainRules.hostMatches(s.domain, cleanDomain, includeSubdomains);
          if (match) purgedCount++;
          return !match;
        });
        if (dayRecord.recentSessions.length !== initialLen) {
          dayModified = true;
        }
      }

      if (dayModified) {
        updates[key] = dayRecord;
      }
    }

    if (Object.keys(updates).length > 0) {
      await chrome.storage.local.set(updates);
    }

    if (currentSession && globalThis.LifeMirrorDomainRules.hostMatches(currentSession.domain, cleanDomain, includeSubdomains)) {
      currentSession = null;
      await persistActiveSession(null);
    }
  } catch (err) {
    console.error("[LifeMirror] Purge local domain data error:", err);
  }

  return purgedCount;
}

export async function handleDesktopSyncExcludedDomains(desktopEntries) {
  if (!Array.isArray(desktopEntries)) return;
  const prevExcluded = new Set(
    excludedEntries.filter((e) => !e.removed).map((e) => e.domain)
  );
  const merged = mergeEntries(excludedEntries, desktopEntries);
  excludedEntries = merged;
  await chrome.storage.local.set({ excluded_entries: merged }).catch(console.error);

  for (const entry of merged) {
    if (!entry.removed && !prevExcluded.has(entry.domain)) {
      purgeLocalDomainData(entry.domain, entry.include_subdomains !== false).catch(console.error);
    }
  }
}

export async function addExcludedDomain(domain, includeSubdomains = false, purgeHistory = true) {
  const cleanDomain = domain.toLowerCase().trim();
  const entry = {
    domain: cleanDomain,
    include_subdomains: Boolean(includeSubdomains),
    updated_at: Date.now(),
    removed: false
  };

  const merged = mergeEntries(excludedEntries, [entry]);
  excludedEntries = merged;
  await chrome.storage.local.set({ excluded_entries: merged });

  let purgedCount = 0;
  if (purgeHistory) {
    purgedCount = await purgeLocalDomainData(cleanDomain, includeSubdomains);
  } else {
    if (currentSession && globalThis.LifeMirrorDomainRules.hostMatches(currentSession.domain, cleanDomain, includeSubdomains)) {
      currentSession = null;
      await persistActiveSession(null);
    }
  }

  return { entry, purgedCount };
}

export async function removeExcludedDomain(domain) {
  const cleanDomain = domain.toLowerCase().trim();
  const entry = {
    domain: cleanDomain,
    include_subdomains: false,
    updated_at: Date.now(),
    removed: true
  };

  const merged = mergeEntries(excludedEntries, [entry]);
  excludedEntries = merged;
  await chrome.storage.local.set({ excluded_entries: merged });
  return entry;
}

// ── Multi-Signal Semantic Classifier ──────────────────────────────────────────
const PATH_PATTERNS = [
  {
    regex: /\/(docs?|documentation|api|apis|reference|guides?|tutorials?|learn|manual|sdk|rfc|spec|specification|wiki|help|faq|knowledge-base|whitepaper)\b/i,
    category: "📚 Research & Docs"
  },
  {
    regex: /\/(pulls?|issues?|commits?|releases?|tree|blob|merge_requests?|branches|diff|actions|pipelines|repositories?)\b/i,
    category: "💻 Development"
  },
  {
    regex: /\/(watch|videos?|courses?|lessons?|lectures?|playlists?|podcast|track|livestream|webinar)\b/i,
    category: "🎬 Media / Learning"
  },
  {
    regex: /\/(mail|inbox|messages?|chat|conversations?|meet|teams?|call|webinar|threads?)\b/i,
    category: "💬 Communications"
  }
];

const TITLE_PATTERNS = [
  {
    regex: /\b(docs?|documentation|api reference|api docs|developer guide|user guide|getting started|cheatsheet|quickstart|specifications?|tutorial|tutorials|walkthrough|manual|release notes|whitepaper|changelog)\b/i,
    category: "📚 Research & Docs"
  },
  {
    regex: /\b(pull request|pull #\d+|pr #\d+|issue #\d+|commit [0-9a-f]{7,}|git repository|merge request|stack trace|build failure|pipeline #|console log)\b/i,
    category: "💻 Development"
  },
  {
    regex: /\b(watch |video |course:?|lesson \d+|lecture \d+|full tutorial|youtube|vimeo|stream)\b/i,
    category: "🎬 Media / Learning"
  },
  {
    regex: /\b(inbox|unread message|meeting with|zoom meeting|google meet|slack channel|direct message|teams call)\b/i,
    category: "💬 Communications"
  }
];

const BASE_DOMAIN_CATEGORIES = {
  "github.com": "💻 Development",
  "gitlab.com": "💻 Development",
  "bitbucket.org": "💻 Development",
  "localhost": "💻 Development",
  "127.0.0.1": "💻 Development",
  "codepen.io": "💻 Development",
  "replit.com": "💻 Development",
  "npmjs.com": "💻 Development",
  "crates.io": "💻 Development",
  "pypi.org": "💻 Development",
  "developer.chrome.com": "💻 Development",
  "developer.android.com": "💻 Development",
  "developer.apple.com": "💻 Development",
  "stackoverflow.com": "📚 Research & Docs",
  "stackexchange.com": "📚 Research & Docs",
  "developer.mozilla.org": "📚 Research & Docs",
  "v2.tauri.app": "📚 Research & Docs",
  "tauri.app": "📚 Research & Docs",
  "react.dev": "📚 Research & Docs",
  "rust-lang.org": "📚 Research & Docs",
  "docs.rs": "📚 Research & Docs",
  "python.org": "📚 Research & Docs",
  "wikipedia.org": "📚 Research & Docs",
  "arxiv.org": "📚 Research & Docs",
  "chatgpt.com": "📚 Research & Docs",
  "claude.ai": "📚 Research & Docs",
  "gemini.google.com": "📚 Research & Docs",
  "perplexity.ai": "📚 Research & Docs",
  "mail.google.com": "💬 Communications",
  "outlook.live.com": "💬 Communications",
  "slack.com": "💬 Communications",
  "discord.com": "💬 Communications",
  "teams.microsoft.com": "💬 Communications",
  "meet.google.com": "💬 Communications",
  "zoom.us": "💬 Communications",
  "web.whatsapp.com": "💬 Communications",
  "t.me": "💬 Communications",
  "youtube.com": "🎬 Media / Learning",
  "vimeo.com": "🎬 Media / Learning",
  "netflix.com": "🎬 Media / Learning",
  "spotify.com": "🎬 Media / Learning",
  "twitch.tv": "🎬 Media / Learning",
  "coursera.org": "🎬 Media / Learning",
  "udemy.com": "🎬 Media / Learning",
  "edx.org": "🎬 Media / Learning",
  "twitter.com": "📰 Feed & Updates",
  "x.com": "📰 Feed & Updates",
  "linkedin.com": "📰 Feed & Updates",
  "reddit.com": "📰 Feed & Updates",
  "news.ycombinator.com": "📰 Feed & Updates",
  "medium.com": "📰 Feed & Updates",
  "dev.to": "📰 Feed & Updates",
  "notion.so": "📝 Task & Writing",
  "linear.app": "📝 Task & Writing",
  "jira.atlassian.com": "📝 Task & Writing",
  "trello.com": "📝 Task & Writing",
  "docs.google.com": "📝 Task & Writing",
  "figma.com": "📝 Task & Writing",
  "miro.com": "📝 Task & Writing",
  "canva.com": "📝 Task & Writing"
};

export async function classifyTab(urlStr, titleStr, hostname) {
  if (hostname) {
    try {
      const res = await chrome.storage.local.get(["tag_overrides"]);
      if (res && res.tag_overrides && res.tag_overrides[hostname]) {
        return res.tag_overrides[hostname];
      }
    } catch {}
  }

  if (urlStr) {
    try {
      const parsed = new URL(urlStr);
      const path = parsed.pathname || "";
      for (const rule of PATH_PATTERNS) {
        if (rule.regex.test(path)) {
          return rule.category;
        }
      }
    } catch {}
  }

  if (titleStr) {
    for (const rule of TITLE_PATTERNS) {
      if (rule.regex.test(titleStr)) {
        return rule.category;
      }
    }
  }

  if (hostname) {
    if (/^(docs?|documentation|api|apis|learn|developer|wiki|help)\./i.test(hostname)) {
      return "📚 Research & Docs";
    }
    if (/^(dev|git|build|ci|code)\./i.test(hostname)) {
      return "💻 Development";
    }
    if (/^(mail|chat|meet|message)\./i.test(hostname)) {
      return "💬 Communications";
    }
    if (/^(video|tv|stream|watch)\./i.test(hostname)) {
      return "🎬 Media / Learning";
    }
    if (hostname.endsWith(".dev") || hostname.endsWith(".rs") || hostname === "localhost" || hostname === "127.0.0.1") {
      return "💻 Development";
    }
    if (hostname.endsWith(".edu")) {
      return "📚 Research & Docs";
    }
    if (BASE_DOMAIN_CATEGORIES[hostname]) {
      return BASE_DOMAIN_CATEGORIES[hostname];
    }
    for (const [dom, cat] of Object.entries(BASE_DOMAIN_CATEGORIES)) {
      if (hostname.endsWith(`.${dom}`)) {
        return cat;
      }
    }
  }

  return "🌐 Other";
}

// ── Daily Local Storage Rolling Window Engine ────────────────────────────────
export async function getDailyKeys() {
  try {
    const res = await chrome.storage.local.get(DAILY_KEYS_STORE);
    if (Array.isArray(res[DAILY_KEYS_STORE]) && res[DAILY_KEYS_STORE].length > 0) {
      return res[DAILY_KEYS_STORE];
    }
  } catch {}
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith("daily_"));
  if (keys.length > 0) {
    chrome.storage.local.set({ [DAILY_KEYS_STORE]: keys }).catch(() => {});
  }
  return keys;
}

export async function registerDailyKey(key) {
  try {
    const res = await chrome.storage.local.get(DAILY_KEYS_STORE);
    const keys = Array.isArray(res[DAILY_KEYS_STORE]) ? res[DAILY_KEYS_STORE] : [];
    if (!keys.includes(key)) {
      keys.push(key);
      await chrome.storage.local.set({ [DAILY_KEYS_STORE]: keys });
    }
  } catch {}
}

export async function removeDailyKeysFromIndex(keysToRemove) {
  if (keysToRemove.length === 0) return;
  try {
    const res = await chrome.storage.local.get(DAILY_KEYS_STORE);
    const keys = Array.isArray(res[DAILY_KEYS_STORE]) ? res[DAILY_KEYS_STORE] : [];
    const updated = keys.filter((k) => !keysToRemove.includes(k));
    await chrome.storage.local.set({ [DAILY_KEYS_STORE]: updated });
  } catch {}
}

export function getTodayKey(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `daily_${year}-${month}-${day}`;
}

export async function pruneOldData() {
  try {
    const allDailyKeys = await getDailyKeys();
    const now = Date.now();
    const TWO_DAYS_MS = 48 * 60 * 60 * 1000;
    const keysToRemove = [];

    for (const key of allDailyKeys) {
      if (key.startsWith("daily_")) {
        const dateStr = key.replace("daily_", "");
        const d = new Date(`${dateStr}T00:00:00`);
        if (!isNaN(d.getTime()) && now - d.getTime() > TWO_DAYS_MS) {
          keysToRemove.push(key);
        }
      }
    }

    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
      await removeDailyKeysFromIndex(keysToRemove);
    }
  } catch (err) {
    console.error("[LifeMirror] Storage prune error:", err);
  }
}

export async function purgeLegacyDailyStorage() {
  try {
    const allDailyKeys = await getDailyKeys();
    if (allDailyKeys.length > 0) {
      await chrome.storage.local.remove(allDailyKeys);
      await removeDailyKeysFromIndex(allDailyKeys);
    }
  } catch (err) {
    console.warn("[LifeMirror] Purge legacy daily storage error:", err);
  }
}

export async function recordCompletedSession(session, durationSeconds) {
  if (!session || durationSeconds < 2) return;
  if (isConnected()) return;

  const todayKey = getTodayKey();
  const hour = new Date().getHours();

  try {
    const data = await chrome.storage.local.get([todayKey]);
    const isNewDayRecord = !data[todayKey];
    const dayRecord = data[todayKey] || {
      totalActiveSeconds: 0,
      contextSwitches: 0,
      domains: {},
      hourly: new Array(24).fill(0),
      recentSessions: []
    };

    dayRecord.totalActiveSeconds += durationSeconds;
    dayRecord.hourly[hour] = (dayRecord.hourly[hour] || 0) + Math.round(durationSeconds / 60);

    const dom = session.domain || "other";
    const sessionUrl = session.url || `https://${dom}`;
    if (!dayRecord.domains[dom]) {
      dayRecord.domains[dom] = {
        seconds: 0,
        url: sessionUrl,
        title: session.title,
        description: session.description || "",
        tag: session.tag,
        favIconUrl: session.favIconUrl || ""
      };
    }
    dayRecord.domains[dom].seconds += durationSeconds;
    if (session.description) dayRecord.domains[dom].description = session.description;
    if (session.tag) dayRecord.domains[dom].tag = session.tag;
    if (session.url) dayRecord.domains[dom].url = session.url;

    const prev = dayRecord.recentSessions[0];
    if (prev && prev.domain === dom && prev.title === session.title) {
      prev.duration += durationSeconds;
      prev.timestamp = Date.now();
      if (session.url && !prev.url) prev.url = session.url;
      if (session.description && !prev.description) {
        prev.description = session.description;
      }
    } else {
      dayRecord.contextSwitches += 1;
      if (durationSeconds >= 3) {
        dayRecord.recentSessions.unshift({
          domain: dom,
          url: sessionUrl,
          title: session.title,
          description: session.description || "",
          tag: session.tag,
          favIconUrl: session.favIconUrl || "",
          duration: durationSeconds,
          timestamp: Date.now()
        });
        if (dayRecord.recentSessions.length > 50) {
          dayRecord.recentSessions.length = 50;
        }
      }
    }

    await chrome.storage.local.set({ [todayKey]: dayRecord });
    if (isNewDayRecord) {
      await registerDailyKey(todayKey);
    }
  } catch (err) {
    console.error("[LifeMirror] Error committing session to local storage:", err);
  }
}

export async function updateCategoryTag(domain, newCategory) {
  if (!domain || !newCategory) return;
  const todayKey = getTodayKey();
  const res = await chrome.storage.local.get(["tag_overrides", todayKey]);
  const overrides = res.tag_overrides || {};
  overrides[domain] = newCategory;

  const dayRecord = res[todayKey];
  if (dayRecord && dayRecord.domains && dayRecord.domains[domain]) {
    dayRecord.domains[domain].tag = newCategory;
  }
  if (dayRecord && dayRecord.recentSessions) {
    dayRecord.recentSessions.forEach((s) => {
      if (s.domain === domain) s.tag = newCategory;
    });
  }

  await chrome.storage.local.set({
    tag_overrides: overrides,
    ...(dayRecord ? { [todayKey]: dayRecord } : {})
  });

  if (currentSession && currentSession.domain === domain) {
    currentSession.tag = newCategory;
  }
}

export async function deleteSingleSession(domain, title, url) {
  const todayKey = getTodayKey();
  const res = await chrome.storage.local.get([todayKey]);
  const dayRecord = res[todayKey];
  if (dayRecord && dayRecord.recentSessions) {
    const index = dayRecord.recentSessions.findIndex(
      (s) => s.domain === domain && s.title === title
    );
    if (index !== -1) {
      const removed = dayRecord.recentSessions[index];
      dayRecord.recentSessions.splice(index, 1);
      dayRecord.totalActiveSeconds = Math.max(0, dayRecord.totalActiveSeconds - removed.duration);
      if (dayRecord.domains && dayRecord.domains[domain]) {
        dayRecord.domains[domain].seconds = Math.max(0, dayRecord.domains[domain].seconds - removed.duration);
        if (dayRecord.domains[domain].seconds === 0) {
          delete dayRecord.domains[domain];
        }
      }
      await chrome.storage.local.set({ [todayKey]: dayRecord });
    }
  }
}

export async function clearLocalData() {
  await chrome.storage.local.clear();
  metaCache.clear();
  await persistMetaCache();
  currentSession = null;
  await chrome.storage.local.set({ [DAILY_KEYS_STORE]: [] }).catch(() => {});
  await persistActiveSession(null);
}

// ── Tab Activity Tracking ────────────────────────────────────────────────────
let _sessionLock = Promise.resolve();

export function queueSessionActivity(tabId, changeInfo, tab) {
  _sessionLock = _sessionLock
    .then(() => reportTabActivity(tabId, changeInfo, tab))
    .catch(() => {});
}

export async function reportTabActivity(tabId, changeInfo, tab) {
  if (!currentSession) {
    await restoreActiveSession();
  }

  if (!tab || tab.incognito) {
    if (currentSession && !isUserIdle) {
      const dur = Math.round((Date.now() - currentSession.startTime) / 1000);
      await recordCompletedSession(currentSession, dur);
      currentSession = null;
      await persistActiveSession(null);
    }
    return;
  }

  const isReady = !changeInfo || changeInfo.status === "complete" || Boolean(changeInfo.favIconUrl);
  if (!tab.active || !isReady) return;

  const url = tab.url || "";
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    if (currentSession && !isUserIdle) {
      const dur = Math.round((Date.now() - currentSession.startTime) / 1000);
      await recordCompletedSession(currentSession, dur);
      currentSession = null;
      await persistActiveSession(null);
    }
    return;
  }

  const hostname = extractHostname(url);
  if (isDomainExcluded(hostname)) {
    currentSession = null;
    await persistActiveSession(null);
    return;
  }

  const cleanUrl = globalThis.LifeMirrorDomainRules.sanitizeUrl(url);
  const rawTitle = (tab.title || hostname || "Web Page")
    .replace(/[\x00-\x1F\x7F\u202A-\u202E\u2066-\u2069]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150);
  const sanitizedTitle = globalThis.LifeMirrorDomainRules.sanitizePageTitle(hostname, rawTitle);
  const category = await classifyTab(url, sanitizedTitle, hostname);
  const description = metaCache.get(url) || metaCache.get(cleanUrl) || null;

  if (isConnected() && !isDesktopTracking()) {
    if (currentSession) {
      currentSession = null;
      await persistActiveSession(null);
    }
    forwardTabActivity({
      event: "tab_activity",
      url: cleanUrl,
      title: sanitizedTitle,
      favIconUrl: tab.favIconUrl || "",
      description: description,
      tag: category,
      timestamp: Date.now(),
      profileId: profileId,
      profileLabel: profileLabel,
      browserName: browserName
    });
    return;
  }

  if (currentSession && currentSession.url === cleanUrl && !isUserIdle) {
    if (description && !currentSession.description) {
      currentSession.description = description;
      await persistActiveSession(currentSession);
    }
    return;
  }

  if (currentSession && !isUserIdle) {
    const elapsed = Math.round((Date.now() - currentSession.startTime) / 1000);
    await recordCompletedSession(currentSession, elapsed);
  }

  currentSession = {
    url: cleanUrl,
    domain: hostname,
    title: sanitizedTitle,
    description,
    tag: category,
    favIconUrl: tab.favIconUrl || "",
    profileId,
    profileLabel,
    browserName,
    startTime: Date.now()
  };
  await persistActiveSession(currentSession);

  forwardTabActivity({
    event: "tab_activity",
    url: cleanUrl,
    title: sanitizedTitle,
    favIconUrl: tab.favIconUrl || "",
    description: description,
    tag: category,
    timestamp: Date.now(),
    profileId: profileId,
    profileLabel: profileLabel,
    browserName: browserName
  });
}

export async function handleIdleChange(state) {
  if (state === "idle" || state === "locked") {
    if (!currentSession) await restoreActiveSession();
    if (currentSession && !isUserIdle) {
      const elapsed = Math.round((Date.now() - currentSession.startTime) / 1000);
      await recordCompletedSession(currentSession, elapsed);
    }
    isUserIdle = true;
  } else if (state === "active") {
    isUserIdle = false;
    if (!currentSession) await restoreActiveSession();
    if (currentSession) {
      currentSession.startTime = Date.now();
      await persistActiveSession(currentSession);
    }
  }
}

export function handleTabActivated(activeInfo) {
  try {
    chrome.tabs.get(activeInfo.tabId).then((tab) => {
      if (tab) {
        queueSessionActivity(activeInfo.tabId, null, tab);
      }
    }).catch(() => {});
  } catch {}
}

export function handleTabUpdated(tabId, changeInfo, tab) {
  if (tab) {
    queueSessionActivity(tabId, changeInfo, tab);
  }
}

export async function handleWindowFocusChange(windowId) {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    if (!currentSession) await restoreActiveSession();
    if (currentSession && !isUserIdle) {
      const dur = Math.round((Date.now() - currentSession.startTime) / 1000);
      await recordCompletedSession(currentSession, dur);
      currentSession = null;
      await persistActiveSession(null);
    }
    return;
  }
  try {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab) {
      queueSessionActivity(tab.id, null, tab);
    }
  } catch {}
}
