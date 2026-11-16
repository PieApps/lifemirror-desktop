/**
 * LifeMirror Companion Extension - Service Worker (ES Module)
 * Orchestrates native RPC, session tracking, Chrome lifecycle events,
 * and extension IPC messaging.
 */

import "./domain-rules.js";
import {
  HOST_NAME,
  getNativePort,
  callNativeRpc,
  reconnectNative,
  getNativeStatus,
  addNativeEventListener,
  forwardDeleteActivity,
  forwardSyncExcludedDomains
} from "./native-rpc.js";

import {
  initProfileIdentity,
  getProfileIdentity,
  updateProfileLabel,
  getCurrentSession,
  resetActiveSession,
  restoreActiveSession,
  restoreMetaCache,
  loadExcludedEntries,
  getExcludedDomainsList,
  addExcludedDomain,
  removeExcludedDomain,
  handleDesktopSyncExcludedDomains,
  pruneOldData,
  purgeLegacyDailyStorage,
  getTodayKey,
  updateCategoryTag,
  deleteSingleSession,
  clearLocalData,
  setPageMeta,
  extractHostname,
  isDomainExcluded,
  handleIdleChange,
  handleTabActivated,
  handleTabUpdated,
  handleWindowFocusChange
} from "./session-tracker.js";

// ── Service Worker Initialization ──────────────────────────────────────────
async function initServiceWorker() {
  await Promise.all([
    restoreActiveSession(),
    restoreMetaCache(),
    loadExcludedEntries(),
    initProfileIdentity()
  ]);
  // Eagerly connect to native host so SQLite sync is ready immediately
  try {
    getNativePort();
  } catch {}
}

initServiceWorker();

// Wire desktop event listeners
addNativeEventListener("tracking_state", (active) => {
  if (!active) {
    resetActiveSession();
  }
});
addNativeEventListener("sync_excluded_domains", handleDesktopSyncExcludedDomains);

// ── Chrome Event Listeners ──────────────────────────────────────────────────
chrome.idle.setDetectionInterval(60);
chrome.idle.onStateChanged.addListener(handleIdleChange);

chrome.tabs.onActivated.addListener(handleTabActivated);
chrome.tabs.onUpdated.addListener(handleTabUpdated);
chrome.windows.onFocusChanged.addListener(handleWindowFocusChange);

if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}

if (chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener(async (tab) => {
    if (chrome.sidePanel && chrome.sidePanel.open && tab && tab.windowId) {
      try {
        await chrome.sidePanel.open({ windowId: tab.windowId });
      } catch (err) {
        console.warn("Failed to open side panel on action click:", err);
      }
    }
  });
}

chrome.runtime.onStartup?.addListener(() => {
  pruneOldData();
  restoreActiveSession();
  restoreMetaCache();
  try {
    getNativePort();
  } catch {}
});

chrome.runtime.onInstalled.addListener(() => {
  pruneOldData();
  try {
    getNativePort();
  } catch {}

  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }

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

// ── Extension IPC & Action Dispatcher ───────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (sender.id && sender.id !== chrome.runtime.id) {
    return false;
  }

  // Strict Incognito Isolation: Reject any messages originating from incognito frames/tabs
  if (sender.tab && sender.tab.incognito) {
    return false;
  }

  const extensionOrigin = chrome.runtime.getURL("");
  const isInternalExtension = Boolean(
    sender.id === chrome.runtime.id &&
    sender.url &&
    sender.url.startsWith(extensionOrigin)
  );

  // Cross-Boundary IPC Isolation
  if (!isInternalExtension && request.action !== "page_meta") {
    console.warn("[LifeMirror Security] Rejected unauthorized cross-boundary message:", request.action, "from", sender.url);
    sendResponse({ error: "Unauthorized" });
    return false;
  }

  // Receive meta description from content.js
  if (request.action === "page_meta") {
    if (!sender.tab || !sender.tab.url || sender.frameId !== 0) {
      return false;
    }
    const tabUrl = sender.tab.url;
    if (!tabUrl.startsWith("http://") && !tabUrl.startsWith("https://")) {
      return false;
    }
    const cleanTabUrl = globalThis.LifeMirrorDomainRules.sanitizeUrl(tabUrl);
    const tabHostname = extractHostname(tabUrl);
    if (isDomainExcluded(tabHostname)) {
      return false;
    }
    if (request.description && typeof request.description === "string") {
      const sanitized = request.description
        .replace(/[\x00-\x1F\x7F\u202A-\u202E\u2066-\u2069]/g, " ")
        .replace(/[\[\]{}#*_`]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200);
      if (sanitized.length > 0) {
        setPageMeta(cleanTabUrl, sanitized);
      }
    }
    return false;
  }

  // Query status for side panel
  if (request.action === "get_status") {
    (async () => {
      const status = getNativeStatus();
      const currentSession = getCurrentSession();

      if (status.isNativeConnected && !status.lastVaultError) {
        try {
          const res = await callNativeRpc({ event: "get_desktop_status" }, 1500);
          if (res && typeof res.tracking_active === "boolean") {
            status.isDesktopTrackingActive = res.tracking_active;
            status.connected = true;
          }
        } catch {}
      }

      sendResponse({
        connected: status.connected,
        trackingActive: status.isDesktopTrackingActive,
        vaultError: status.lastVaultError,
        lastEvent: status.lastReportedPayload,
        currentSession: currentSession ? {
          ...currentSession,
          currentDuration: Math.round((Date.now() - currentSession.startTime) / 1000)
        } : null,
        hostName: status.hostName
      });
    })();
    return true;
  }

  // Manual Reconnect Request from Side Panel UI
  if (request.action === "reconnect_native") {
    reconnectNative()
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ connected: false, error: err.message }));
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
    updateCategoryTag(request.domain, request.newCategory).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  // User deletes a single session card
  if (request.action === "delete_single_session") {
    const { domain, title, url } = request;
    const { profileId } = getProfileIdentity();
    deleteSingleSession(domain, title, url).then(() => {
      forwardDeleteActivity(url, title, profileId);
      sendResponse({ success: true });
    });
    return true;
  }

  // User requests clearing local browser data
  if (request.action === "clear_local_data") {
    clearLocalData().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  // Profile Identity: Get active profile metadata
  if (request.action === "get_profile_identity") {
    sendResponse(getProfileIdentity());
    return true;
  }

  // Profile Identity: Update friendly label
  if (request.action === "update_profile_label") {
    updateProfileLabel(request.label).then((profileLabel) => {
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

  // Desktop RPC: Fetch today's summary metrics
  if (request.action === "get_desktop_summary") {
    callNativeRpc({
      event: "get_desktop_summary",
      profileId: request.profileId || null,
      date: request.date || null
    })
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({
        error: err.message,
        totalTime: 0,
        switches: 0,
        hourly: new Array(24).fill(0),
        domainsCount: 0
      }));
    return true;
  }

  // Domain Exclusion: Get list of active excluded domains
  if (request.action === "get_excluded_domains") {
    sendResponse({ entries: getExcludedDomainsList() });
    return true;
  }

  // Domain Exclusion: Add excluded domain
  if (request.action === "add_excluded_domain") {
    addExcludedDomain(request.domain, request.includeSubdomains, request.purgeHistory).then(({ entry, purgedCount }) => {
      forwardSyncExcludedDomains([entry]);
      sendResponse({
        success: true,
        domain: entry.domain,
        purgedSessions: purgedCount
      });
    });
    return true;
  }

  // Domain Exclusion: Remove excluded domain
  if (request.action === "remove_excluded_domain") {
    removeExcludedDomain(request.domain).then((entry) => {
      forwardSyncExcludedDomains([entry]);
      sendResponse({ success: true, domain: entry.domain });
    });
    return true;
  }
});
