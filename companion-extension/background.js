/**
 * LifeMirror Companion Extension - Service Worker
 * Privately tracks in-browser focus sessions, active dwell time, smart category tags,
 * and page descriptions entirely on-device (chrome.storage.local + optional native desktop sync).
 */

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
  const cleanUrl = stripQueryParams(url);
  const title = tab.title || hostname || "Web Page";
  const category = await classifyTab(url, title, hostname);
  const description = metaCache.get(url) || metaCache.get(cleanUrl) || null;

  // 1. Guard against duplicate sessions on the SAME tab and SAME URL
  if (currentSession && currentSession.tabId === tabId && currentSession.url === cleanUrl) {
    // Update title, favicon, or description if they became available without resetting duration
    if (tab.title && tab.title !== hostname) {
      currentSession.title = tab.title;
      // If current tag was "Other", re-evaluate now that the real page title has loaded
      if (currentSession.tag === "🌐 Other") {
        const upgradedCategory = await classifyTab(url, tab.title, hostname);
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
    title: tab.title || hostname || "Web Page",
    favIconUrl: tab.favIconUrl || "",
    description: description,
    tag: category,
    startTime: Date.now()
  };

  // 3. Forward enriched payload to Desktop App if connected
  const nativePort = getNativePort();
  if (nativePort) {
    const payload = {
      event: "tab_activity",
      url: cleanUrl,
      title: tab.title || hostname || "Untitled Tab",
      favIconUrl: tab.favIconUrl || "",
      description: description,
      tag: category,
      timestamp: Date.now()
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
});

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
            title: title || null
          });
        } catch {
          // ignore if native port unreachable
        }
      }

      sendResponse({ success: true });
    });
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
});
