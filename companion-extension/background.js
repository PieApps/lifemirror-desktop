/**
 * LifeMirror Companion Extension - Service Worker
 * Privately tracks in-browser focus sessions, active dwell time, smart category tags,
 * and page descriptions entirely on-device (chrome.storage.local + optional native desktop sync).
 */

importScripts("domain-rules.js");

const HOST_NAME = "com.lifemirror.desktop";
const IDLE_THRESHOLD_SECONDS = 60;
const MAX_META_CACHE = 150;

let port = null;
let isNativeConnected = false;
let lastReportedPayload = null;
let lastVaultError = null;

// In-memory active session state
let currentSession = null;
let isUserIdle = false;
const metaCache = new Map(); // url -> description

// In-memory cache of domain exclusion rules
let excludedEntries = []; // array of { domain, include_subdomains, updated_at, removed }

async function loadExcludedEntries() {
  try {
    const data = await chrome.storage.local.get(["excluded_entries"]);
    if (Array.isArray(data.excluded_entries)) {
      excludedEntries = data.excluded_entries;
    }
  } catch (err) {
    console.error("[LifeMirror] Failed to load excluded_entries:", err);
  }
}

// In-memory profile identity (isolated per browser profile storage)
let profileId = null;
let profileLabel = "Default";
let browserName = "Chrome";

async function initProfileIdentity() {
  try {
    const data = await chrome.storage.local.get(["profile_id", "profile_label"]);
    if (data.profile_id) {
      profileId = data.profile_id;
    } else {
      profileId = `prof_${crypto.randomUUID().slice(0, 8)}`;
      await chrome.storage.local.set({ profile_id: profileId });
    }
    if (data.profile_label) {
      profileLabel = data.profile_label;
    } else {
      profileLabel = "Default";
    }

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
initProfileIdentity();

// Pending RPC manager for request-response over Native Messaging
const pendingNativeRpc = new Map();

function callNativeRpc(eventPayload, timeoutMs = 4000) {
  const nativePort = getNativePort();
  if (!nativePort) {
    return Promise.reject(new Error("Native host not connected"));
  }

  const requestId = crypto.randomUUID();
  eventPayload.requestId = requestId;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingNativeRpc.delete(requestId);
      reject(new Error("Native RPC timeout"));
    }, timeoutMs);

    pendingNativeRpc.set(requestId, { resolve, reject, timer });

    try {
      nativePort.postMessage(eventPayload);
    } catch (err) {
      clearTimeout(timer);
      pendingNativeRpc.delete(requestId);
      reject(err);
    }
  });
}

// Initial eager load
loadExcludedEntries();

function isDomainExcluded(hostname) {
  if (!hostname || !excludedEntries || excludedEntries.length === 0) return false;
  for (const entry of excludedEntries) {
    if (!entry.removed && LifeMirrorDomainRules.hostMatches(hostname, entry.domain, entry.include_subdomains !== false)) {
      return true;
    }
  }
  return false;
}

function mergeEntries(localList, incomingList) {
  const map = new Map();
  for (const item of localList) {
    map.set(item.domain, item);
  }

  for (const incoming of incomingList) {
    const existing = map.get(incoming.domain);
    if (!existing) {
      map.set(incoming.domain, incoming);
    } else {
      if (incoming.updated_at > existing.updated_at) {
        map.set(incoming.domain, incoming);
      } else if (incoming.updated_at === existing.updated_at) {
        // On tie, exclusion wins (removed: false wins)
        if (!incoming.removed) {
          map.set(incoming.domain, incoming);
        }
      }
    }
  }
  return Array.from(map.values());
}

async function purgeLocalDomainData(domain, includeSubdomains = true) {
  try {
    const all = await chrome.storage.local.get(null);
    const updates = {};
    let purgedSessionsCount = 0;

    for (const [key, val] of Object.entries(all)) {
      if (!key.startsWith("daily_") || !val) continue;

      let modified = false;
      const dayRecord = { ...val };

      if (dayRecord.domains) {
        for (const dom of Object.keys(dayRecord.domains)) {
          if (LifeMirrorDomainRules.hostMatches(dom, domain, includeSubdomains)) {
            const purgedSeconds = dayRecord.domains[dom].seconds || 0;
            dayRecord.totalActiveSeconds = Math.max(0, dayRecord.totalActiveSeconds - purgedSeconds);
            delete dayRecord.domains[dom];
            modified = true;
          }
        }
      }

      if (Array.isArray(dayRecord.recentSessions)) {
        const originalLen = dayRecord.recentSessions.length;
        dayRecord.recentSessions = dayRecord.recentSessions.filter((s) => {
          return !LifeMirrorDomainRules.hostMatches(s.domain, domain, includeSubdomains);
        });
        if (dayRecord.recentSessions.length !== originalLen) {
          purgedSessionsCount += (originalLen - dayRecord.recentSessions.length);
          modified = true;
        }
      }

      if (modified) {
        updates[key] = dayRecord;
      }
    }

    if (Object.keys(updates).length > 0) {
      await chrome.storage.local.set(updates);
    }

    if (currentSession && LifeMirrorDomainRules.hostMatches(currentSession.domain, domain, includeSubdomains)) {
      currentSession = null;
    }

    return purgedSessionsCount;
  } catch (err) {
    console.error("[LifeMirror] Purge local domain data error:", err);
    return 0;
  }
}

// ── Multi-Signal Semantic Classifier ──────────────────────────────────────────

// Patterns for URL Paths (e.g. /docs/getting-started -> Research & Docs)
const PATH_PATTERNS = [
  // 📚 Research & Docs (documentation, apis, guides, manuals, specifications)
  {
    regex: /\/(docs?|documentation|api|apis|reference|guides?|tutorials?|learn|manual|sdk|rfc|spec|specification|wiki|help|faq|knowledge-base|whitepaper)\b/i,
    category: "📚 Research & Docs"
  },
  // 💻 Development (PRs, issues, commits, repositories, tree, blob, merge requests)
  {
    regex: /\/(pulls?|issues?|commits?|releases?|tree|blob|merge_requests?|branches|diff|actions|pipelines|repositories?)\b/i,
    category: "💻 Development"
  },
  // 🎬 Media / Learning (videos, courses, lessons, lectures, streams)
  {
    regex: /\/(watch|videos?|courses?|lessons?|lectures?|playlists?|podcast|track|livestream|webinar)\b/i,
    category: "🎬 Media / Learning"
  },
  // 💬 Communications (mail, inbox, chat, meet, channels)
  {
    regex: /\/(mail|inbox|messages?|chat|conversations?|meet|teams?|call|webinar|threads?)\b/i,
    category: "💬 Communications"
  }
];

// Patterns for Page Title & Headings (e.g. "Getting Started - Antigravity Docs")
const TITLE_PATTERNS = [
  // 📚 Research & Docs
  {
    regex: /\b(docs?|documentation|api reference|api docs|developer guide|user guide|getting started|cheatsheet|quickstart|specifications?|tutorial|tutorials|walkthrough|manual|release notes|whitepaper|changelog)\b/i,
    category: "📚 Research & Docs"
  },
  // 💻 Development
  {
    regex: /\b(pull request|pull #\d+|pr #\d+|issue #\d+|commit [0-9a-f]{7,}|git repository|merge request|stack trace|build failure|pipeline #|console log)\b/i,
    category: "💻 Development"
  },
  // 🎬 Media / Learning
  {
    regex: /\b(watch |video |course:?|lesson \d+|lecture \d+|full tutorial|youtube|vimeo|stream)\b/i,
    category: "🎬 Media / Learning"
  },
  // 💬 Communications
  {
    regex: /\b(inbox|unread message|meeting with|zoom meeting|google meet|slack channel|direct message|teams call)\b/i,
    category: "💬 Communications"
  }
];

// Base Domain Categories (fallback defaults when path/title are generic)
const BASE_DOMAIN_CATEGORIES = {
  // Development
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

  // Research & Docs
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

  // Media / Learning
  "youtube.com": "🎬 Media / Learning",
  "vimeo.com": "🎬 Media / Learning",
  "netflix.com": "🎬 Media / Learning",
  "twitch.tv": "🎬 Media / Learning",
  "coursera.org": "🎬 Media / Learning",
  "udemy.com": "🎬 Media / Learning",
  "spotify.com": "🎬 Media / Learning",

  // Communications
  "mail.google.com": "💬 Communications",
  "outlook.com": "💬 Communications",
  "slack.com": "💬 Communications",
  "discord.com": "💬 Communications",
  "teams.microsoft.com": "💬 Communications",
  "web.whatsapp.com": "💬 Communications",
  "zoom.us": "💬 Communications",
  "meet.google.com": "💬 Communications",

  // Break / Leisure
  "reddit.com": "☕ Break / Leisure",
  "twitter.com": "☕ Break / Leisure",
  "x.com": "☕ Break / Leisure",
  "facebook.com": "☕ Break / Leisure",
  "instagram.com": "☕ Break / Leisure",
  "tiktok.com": "☕ Break / Leisure",
  "amazon.com": "☕ Break / Leisure"
};

function extractHostname(urlStr) {
  try {
    return new URL(urlStr).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function stripQueryParams(urlStr) {
  try {
    const u = new URL(urlStr);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return urlStr;
  }
}

/**
 * Multi-Signal Semantic Classifier
 * Evaluates: 1. User manual override -> 2. URL Path regex -> 3. Page Title regex -> 4. Subdomains/TLDs -> 5. Domain fallbacks
 */
async function classifyTab(urlStr = "", titleStr = "", hostname = "") {
  if (!hostname && urlStr) {
    hostname = extractHostname(urlStr);
  }

  // 1. User manual override (Highest Priority: user explicitly chose a tag for this domain)
  try {
    const stored = await chrome.storage.local.get("tag_overrides");
    const overrides = stored.tag_overrides || {};
    if (hostname && overrides[hostname]) {
      return overrides[hostname];
    }
  } catch {
    // fallback gracefully
  }

  // 2. URL Path semantic signals (e.g. antigravity.google/docs/getting-started -> Research & Docs)
  if (urlStr) {
    try {
      const parsed = new URL(urlStr);
      const pathname = parsed.pathname;

      for (const rule of PATH_PATTERNS) {
        if (rule.regex.test(pathname)) {
          return rule.category;
        }
      }
    } catch {
      // ignore URL parsing errors
    }
  }

  // 3. Page Title semantic signals (e.g. "Getting Started - Antigravity Docs")
  if (titleStr) {
    for (const rule of TITLE_PATTERNS) {
      if (rule.regex.test(titleStr)) {
        return rule.category;
      }
    }
  }

  // 4. Subdomain signals (e.g. docs.stripe.com, api.slack.com, developer.mozilla.org)
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

    // TLD signals
    if (hostname.endsWith(".dev") || hostname.endsWith(".rs") || hostname === "localhost" || hostname === "127.0.0.1") {
      return "💻 Development";
    }
    if (hostname.endsWith(".edu")) {
      return "📚 Research & Docs";
    }

    // 5. Base Platform Exact or Subdomain matching
    if (BASE_DOMAIN_CATEGORIES[hostname]) {
      return BASE_DOMAIN_CATEGORIES[hostname];
    }
    for (const [dom, cat] of Object.entries(BASE_DOMAIN_CATEGORIES)) {
      if (hostname.endsWith(`.${dom}`)) {
        return cat;
      }
    }
  }

  // 6. Default Fallback
  return "🌐 Other";
}

// Backwards-compatible alias
async function getCategoryForDomain(hostname) {
  return classifyTab(null, null, hostname);
}

// ── Native Messaging Connection (Resilient) ──────────────────────────────────
function getNativePort() {
  if (port) return port;

  try {
    port = chrome.runtime.connectNative(HOST_NAME);
    isNativeConnected = true;

    port.onMessage.addListener((msg) => {
      if (msg && msg.requestId && pendingNativeRpc.has(msg.requestId)) {
        const { resolve, timer } = pendingNativeRpc.get(msg.requestId);
        clearTimeout(timer);
        pendingNativeRpc.delete(msg.requestId);
        resolve(msg);
        return;
      }

      if (msg && msg.event === "sync_excluded_domains" && Array.isArray(msg.entries)) {
        const prevExcluded = new Set(
          excludedEntries.filter(e => !e.removed).map(e => e.domain)
        );
        const merged = mergeEntries(excludedEntries, msg.entries);
        excludedEntries = merged;
        chrome.storage.local.set({ excluded_entries: merged }).catch(console.error);

        for (const entry of merged) {
          if (!entry.removed && !prevExcluded.has(entry.domain)) {
            purgeLocalDomainData(entry.domain, entry.include_subdomains !== false).catch(console.error);
          }
        }
      }
      if (msg && msg.error) {
        lastVaultError = msg.error;
        if (msg.error === "vault_locked") {
          chrome.action.setBadgeText({ text: "LOCK" });
          chrome.action.setBadgeBackgroundColor({ color: "#e11d48" });
        } else if (msg.error === "vault_busy") {
          chrome.action.setBadgeText({ text: "BUSY" });
          chrome.action.setBadgeBackgroundColor({ color: "#f59e0b" });
        }
      }
    });

    // Request current excluded domains from desktop host
    try {
      port.postMessage({ event: "get_excluded_domains" });
    } catch {}

    port.onDisconnect.addListener(() => {
      isNativeConnected = false;
      port = null;
      // In standalone mode, we do NOT set scary red badges
      chrome.action.setBadgeText({ text: "" });
    });
  } catch {
    port = null;
    isNativeConnected = false;
  }
  return port;
}

// ── Local Storage Daily Analytics Engine (48h Rolling Window) ──────────────────
function getTodayKey(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `daily_${year}-${month}-${day}`;
}

async function pruneOldData() {
  try {
    const all = await chrome.storage.local.get(null);
    const now = Date.now();
    const TWO_DAYS_MS = 48 * 60 * 60 * 1000;
    const keysToRemove = [];

    for (const key of Object.keys(all)) {
      if (key.startsWith("daily_")) {
        const dateStr = key.replace("daily_", "");
        const d = new Date(dateStr);
        if (!isNaN(d.getTime()) && now - d.getTime() > TWO_DAYS_MS) {
          keysToRemove.push(key);
        }
      }
    }

    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
    }
  } catch (err) {
    console.error("[LifeMirror] Storage prune error:", err);
  }
}

async function recordCompletedSession(session, durationSeconds) {
  // Ignore sub-second noise
  if (!session || durationSeconds < 2) return;

  const todayKey = getTodayKey();
  const hour = new Date().getHours();

  try {
    const data = await chrome.storage.local.get([todayKey]);
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

    // Consolidate consecutive sessions for the exact same page/article
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

      // Filter out micro-hops (<3s fast skipping) from cluttering the reflection cards feed.
      // High-frequency hops are still counted in contextSwitches, hourly velocity, and domain seconds.
      const isFirstSession = dayRecord.recentSessions.length === 0;
      if (durationSeconds >= 3 || isFirstSession) {
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
  } catch (err) {
    console.error("[LifeMirror] Error committing session to local storage:", err);
  }
}

// ── Tab Activity Handler ───────────────────────────────────────────────────────
async function reportTabActivity(tabId, changeInfo, tab) {
  // If tab is invalid or incognito, immediately pause & commit any active normal session and exit
  if (!tab || tab.incognito) {
    if (currentSession && !isUserIdle) {
      const dur = Math.round((Date.now() - currentSession.startTime) / 1000);
      recordCompletedSession(currentSession, dur);
      currentSession = null;
    }
    return;
  }

  const isReady = !changeInfo || changeInfo.status === "complete" || Boolean(changeInfo.favIconUrl);
  if (!tab.active || !isReady) return;

  const url = tab.url || "";
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    // End active session on excluded/internal pages
    if (currentSession && !isUserIdle) {
      const dur = Math.round((Date.now() - currentSession.startTime) / 1000);
      recordCompletedSession(currentSession, dur);
      currentSession = null;
    }
    return;
  }

  const hostname = extractHostname(url);

  // Check Domain Exclusion: Immediately discard in-flight session and halt tracking
  if (isDomainExcluded(hostname)) {
    currentSession = null;
    return;
  }

  const cleanUrl = LifeMirrorDomainRules.sanitizeUrl(url);
  const rawTitle = tab.title || hostname || "Web Page";
  const sanitizedTitle = LifeMirrorDomainRules.sanitizePageTitle(hostname, rawTitle);
  const category = await classifyTab(url, sanitizedTitle, hostname);
  const description = metaCache.get(url) || metaCache.get(cleanUrl) || null;

  // 1. Guard against duplicate sessions on the SAME tab and SAME URL
  if (currentSession && currentSession.tabId === tabId && currentSession.url === cleanUrl) {
    // Update title, favicon, or description if they became available without resetting duration
    if (tab.title && tab.title !== hostname) {
      currentSession.title = sanitizedTitle;
      // If current tag was "Other", re-evaluate now that the real page title has loaded
      if (currentSession.tag === "🌐 Other") {
        const upgradedCategory = await classifyTab(url, sanitizedTitle, hostname);
        if (upgradedCategory !== "🌐 Other") {
          currentSession.tag = upgradedCategory;
        }
      }
    }
    if (tab.favIconUrl) {
      currentSession.favIconUrl = tab.favIconUrl;
    }
    if (description && !currentSession.description) {
      currentSession.description = description;
    }
    return;
  }

  // 2. Commit previous session duration if switching to a DIFFERENT tab/page
  if (currentSession && !isUserIdle) {
    const elapsed = Math.round((Date.now() - currentSession.startTime) / 1000);
    recordCompletedSession(currentSession, elapsed);
  }

  // 3. Start new session
  currentSession = {
    tabId,
    url: cleanUrl,
    domain: hostname,
    title: sanitizedTitle,
    favIconUrl: tab.favIconUrl || "",
    description: description,
    tag: category,
    profileId,
    profileLabel,
    browserName,
    startTime: Date.now()
  };

  // 3. Forward enriched payload to Desktop App if connected
  const nativePort = getNativePort();
  if (nativePort) {
    const payload = {
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
    };
    try {
      nativePort.postMessage(payload);
      lastReportedPayload = payload;
    } catch {
      port = null;
      isNativeConnected = false;
    }
  }
}

// ── Idle Detection (>60s) ──────────────────────────────────────────────────────
chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);
chrome.idle.onStateChanged.addListener((state) => {
  if (state === "idle" || state === "locked") {
    if (currentSession && !isUserIdle) {
      const elapsed = Math.round((Date.now() - currentSession.startTime) / 1000);
      recordCompletedSession(currentSession, elapsed);
    }
    isUserIdle = true;
  } else if (state === "active") {
    isUserIdle = false;
    if (currentSession) {
      currentSession.startTime = Date.now();
    }
  }
});

// ── Chrome Event Listeners ────────────────────────────────────────────────────
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (!chrome.runtime.lastError && tab) {
      reportTabActivity(activeInfo.tabId, null, tab);
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab) {
    reportTabActivity(tabId, changeInfo, tab);
  }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Window lost focus: pause active session
    if (currentSession && !isUserIdle) {
      const dur = Math.round((Date.now() - currentSession.startTime) / 1000);
      recordCompletedSession(currentSession, dur);
      currentSession = null;
    }
    return;
  }
  chrome.tabs.query({ active: true, windowId }, (tabs) => {
    if (tabs && tabs[0]) {
      reportTabActivity(tabs[0].id, null, tabs[0]);
    }
  });
});

// ── Extension IPC & Side Panel Setup ──────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  pruneOldData();
  // Ensure default action click opens popup
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  }
  // Setup context menu shortcuts for direct toolbar launch
  if (chrome.contextMenus) {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: "launch_lifemirror_desktop",
        title: "⚡ Open LifeMirror Desktop",
        contexts: ["action"]
      });
      chrome.contextMenus.create({
        id: "open_web_dashboard",
        title: "🌐 Open Web Dashboard",
        contexts: ["action"]
      });
    });
  }
});

if (chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === "launch_lifemirror_desktop" || info.menuItemId === "open_web_dashboard") {
      chrome.tabs.create({ url: "https://pieapps.github.io/lifemirror-desktop.web/" });
    }
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (sender.id && sender.id !== chrome.runtime.id) {
    return false;
  }

  // Strict Incognito Isolation: Reject any messages originating from incognito frames/tabs
  if (sender.tab && sender.tab.incognito) {
    return false;
  }

  // Receive meta description from content.js
  if (request.action === "page_meta") {
    if (request.url && request.description && typeof request.description === "string") {
      // Strip control chars and markdown markers to guard against prompt injection
      const sanitized = request.description
        .replace(/[\x00-\x1F\x7F]/g, " ")
        .replace(/[\[\]{}#*_`]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200);
      metaCache.set(request.url, sanitized);
      metaCache.set(stripQueryParams(request.url), sanitized);
      if (metaCache.size > MAX_META_CACHE) {
        const firstKey = metaCache.keys().next().value;
        metaCache.delete(firstKey);
      }
      if (currentSession && currentSession.url === stripQueryParams(request.url)) {
        currentSession.description = sanitized;
      }
    }
    return false;
  }

  // Query status for popup/side panel
  if (request.action === "get_status") {
    const nativePort = getNativePort();
    sendResponse({
      connected: isNativeConnected && nativePort !== null && !lastVaultError,
      vaultError: lastVaultError,
      lastEvent: lastReportedPayload,
      currentSession: currentSession ? {
        ...currentSession,
        currentDuration: Math.round((Date.now() - currentSession.startTime) / 1000)
      } : null,
      hostName: HOST_NAME
    });
    return true;
  }

  // Fetch today's aggregated analytics
  if (request.action === "get_today_analytics") {
    const todayKey = getTodayKey();
    chrome.storage.local.get([todayKey]).then((res) => {
      sendResponse(res[todayKey] || null);
    });
    return true;
  }

  // 1-Click Easy Revise: User overrides category tag
  if (request.action === "update_tag") {
    const { domain, newCategory } = request;
    if (domain && newCategory) {
      chrome.storage.local.get(["tag_overrides", getTodayKey()]).then(async (res) => {
        const overrides = res.tag_overrides || {};
        overrides[domain] = newCategory;

        const dayRecord = res[getTodayKey()];
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
          ...(dayRecord ? { [getTodayKey()]: dayRecord } : {})
        });

        if (currentSession && currentSession.domain === domain) {
          currentSession.tag = newCategory;
        }

        sendResponse({ success: true });
      });
      return true;
    }
  }

  // User deletes a single session card
  if (request.action === "delete_single_session") {
    const { domain, title, url } = request;
    const todayKey = getTodayKey();
    chrome.storage.local.get([todayKey]).then(async (res) => {
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
        }

        await chrome.storage.local.set({ [todayKey]: dayRecord });
      }

      // Propagate deletion to LifeMirror Desktop SQLite vault if connected
      const nativePort = getNativePort();
      if (nativePort) {
        try {
          nativePort.postMessage({
            event: "delete_tab_activity",
            url: url || null,
            title: title || null,
            profileId: profileId
          });
        } catch {
          // ignore if native port unreachable
        }
      }

      sendResponse({ success: true });
    });
    return true;
  }

  // Profile Identity: Get active profile metadata
  if (request.action === "get_profile_identity") {
    sendResponse({
      profileId,
      profileLabel,
      browserName
    });
    return true;
  }

  // Profile Identity: Update friendly label (e.g. "Work", "Personal")
  if (request.action === "update_profile_label") {
    const newLabel = (request.label || "Default").trim();
    profileLabel = newLabel;
    chrome.storage.local.set({ profile_label: newLabel }).then(() => {
      sendResponse({ success: true, profileLabel });
    });
    return true;
  }

  // Desktop RPC: Fetch keyset cursor sub-sessions
  if (request.action === "get_desktop_sub_sessions") {
    callNativeRpc({
      event: "get_sub_sessions",
      profileId: request.profileId,
      cursor: request.cursor || null,
      limit: request.limit || 25,
      date: request.date || null
    })
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ error: err.message, items: [], nextCursor: null }));
    return true;
  }

  // Desktop RPC: Fetch pre-aggregated top sites
  if (request.action === "get_desktop_top_sites") {
    callNativeRpc({
      event: "get_top_sites",
      profileId: request.profileId,
      limit: request.limit || 5,
      date: request.date || null
    })
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ error: err.message, entries: [] }));
    return true;
  }

  // Desktop RPC: Fetch all active profiles
  if (request.action === "get_available_profiles") {
    callNativeRpc({
      event: "get_available_profiles",
      date: request.date || null
    })
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ error: err.message, profiles: [] }));
    return true;
  }

  // User requests clearing local browser data
  if (request.action === "clear_local_data") {
    chrome.storage.local.clear().then(() => {
      metaCache.clear();
      sendResponse({ success: true });
    });
    return true;
  }

  // Domain Exclusion: Get list of active excluded domains
  if (request.action === "get_excluded_domains") {
    const activeList = excludedEntries.filter((e) => !e.removed);
    sendResponse({ excludedDomains: activeList });
    return true;
  }

  // Domain Exclusion: Preview purge counts in local extension storage
  if (request.action === "preview_domain_purge") {
    const { domain, includeSubdomains } = request;
    chrome.storage.local.get(null).then((all) => {
      let matchingSessions = 0;
      const matchingHosts = new Set();
      for (const [key, val] of Object.entries(all)) {
        if (!key.startsWith("daily_") || !val) continue;
        if (val.domains) {
          for (const d of Object.keys(val.domains)) {
            if (LifeMirrorDomainRules.hostMatches(d, domain, includeSubdomains !== false)) {
              matchingHosts.add(d);
            }
          }
        }
        if (Array.isArray(val.recentSessions)) {
          for (const s of val.recentSessions) {
            if (LifeMirrorDomainRules.hostMatches(s.domain, domain, includeSubdomains !== false)) {
              matchingSessions += 1;
              matchingHosts.add(s.domain);
            }
          }
        }
      }
      sendResponse({
        matchingSessions,
        matchingHosts: Array.from(matchingHosts)
      });
    });
    return true;
  }

  // Domain Exclusion: Add excluded domain with optional purge & native sync
  if (request.action === "add_excluded_domain") {
    const { domain, includeSubdomains = true, purgeHistory = true } = request;
    const norm = LifeMirrorDomainRules.normalizeDomain(domain);
    if (!norm.valid || !norm.domain) {
      sendResponse({ success: false, error: norm.error || "Invalid domain" });
      return true;
    }

    const cleanDomain = norm.domain;
    const entry = {
      domain: cleanDomain,
      include_subdomains: Boolean(includeSubdomains),
      updated_at: Date.now(),
      removed: false
    };

    (async () => {
      const merged = mergeEntries(excludedEntries, [entry]);
      excludedEntries = merged;
      await chrome.storage.local.set({ excluded_entries: merged });

      let purgedCount = 0;
      if (purgeHistory) {
        purgedCount = await purgeLocalDomainData(cleanDomain, includeSubdomains);
      } else {
        if (currentSession && LifeMirrorDomainRules.hostMatches(currentSession.domain, cleanDomain, includeSubdomains)) {
          currentSession = null;
        }
      }

      const nativePort = getNativePort();
      if (nativePort) {
        try {
          nativePort.postMessage({
            event: "sync_excluded_domains",
            entries: [entry]
          });
        } catch {
          // ignore if native port not connected
        }
      }

      sendResponse({
        success: true,
        domain: cleanDomain,
        purgedSessions: purgedCount
      });
    })();
    return true;
  }

  // Domain Exclusion: Remove excluded domain (creates tombstone & syncs)
  if (request.action === "remove_excluded_domain") {
    const { domain } = request;
    const cleanDomain = (domain || "").toLowerCase().trim();
    const entry = {
      domain: cleanDomain,
      include_subdomains: false,
      updated_at: Date.now(),
      removed: true
    };

    (async () => {
      const merged = mergeEntries(excludedEntries, [entry]);
      excludedEntries = merged;
      await chrome.storage.local.set({ excluded_entries: merged });

      const nativePort = getNativePort();
      if (nativePort) {
        try {
          nativePort.postMessage({
            event: "sync_excluded_domains",
            entries: [entry]
          });
        } catch {}
      }

      sendResponse({ success: true, domain: cleanDomain });
    })();
    return true;
  }
});
