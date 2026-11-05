let port = null;
let isNativeConnected = false;
let lastReportedPayload = null;
const hostName = "com.lifemirror.desktop";

// Resilient native port connection
function getNativePort() {
  if (port) return port;
  
  try {
    port = chrome.runtime.connectNative(hostName);
    isNativeConnected = true;
    console.log("Connecting to LifeMirror Desktop Native Messaging Host...");
    
    port.onDisconnect.addListener(() => {
      isNativeConnected = false;
      const errMsg = chrome.runtime.lastError?.message;
      console.warn("Disconnected from Native Messaging Host: ", errMsg);
      if (errMsg?.includes("Specified native messaging host not found")) {
        console.warn("[LifeMirror] Host manifest not registered or invalid. Ensure LifeMirror Desktop is running.");
      }
      port = null;
    });
  } catch (err) {
    console.error("Error connecting to native host:", err);
    port = null;
    isNativeConnected = false;
  }
  return port;
}

// Send tab info to the host
function reportTabActivity(tabId, changeInfo, tab) {
  // Track loaded tabs, plus later favicon-only updates Chrome emits after load.
  const isReadyUpdate = !changeInfo || changeInfo.status === "complete" || Boolean(changeInfo.favIconUrl);
  if (!tab || !tab.active || !isReadyUpdate) {
    return;
  }

  // Filter out internal browser pages (only track standard http/https web pages)
  if (!tab.url || (!tab.url.startsWith("http://") && !tab.url.startsWith("https://"))) {
    return;
  }

  const nativePort = getNativePort();
  if (nativePort) {
    const payload = {
      event: "tab_activity",
      url: tab.url,
      title: tab.title || "Untitled Tab",
      favIconUrl: tab.favIconUrl || "",
      timestamp: Date.now()
    };
    try {
      nativePort.postMessage(payload);
      lastReportedPayload = payload;
      console.log("Logged browser tab activity:", payload);
    } catch (e) {
      console.error("Failed to post browser activity:", e);
      port = null; // reset
      isNativeConnected = false;
    }
  }
}

// Hook tab events
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    reportTabActivity(activeInfo.tabId, null, tab);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  reportTabActivity(tabId, changeInfo, tab);
});

// Hook window focus events to sync active tab of the newly focused window
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    return;
  }
  chrome.tabs.query({ active: true, windowId: windowId }, (tabs) => {
    if (tabs && tabs[0]) {
      reportTabActivity(tabs[0].id, null, tabs[0]);
    }
  });
});

// ── Extension Popup & App Bridge ──────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Security guard: Ensure messages originate strictly from this extension
  if (sender.id && sender.id !== chrome.runtime.id) {
    console.warn("[LifeMirror] Blocked message from untrusted sender:", sender.id);
    return false;
  }

  if (request.action === "get_status") {
    const nativePort = getNativePort();
    sendResponse({
      connected: isNativeConnected && nativePort !== null,
      lastEvent: lastReportedPayload,
      hostName: hostName
    });
    return true;
  }

  if (request.action === "ping_native") {
    port = null;
    const nativePort = getNativePort();
    sendResponse({
      connected: isNativeConnected && nativePort !== null
    });
    return true;
  }
});

// ── Context Menus for Direct Toolbar Launch ───────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  // Purge any stale context menu items before recreating to avoid duplicate ID errors
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
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "launch_lifemirror_desktop" || info.menuItemId === "open_web_dashboard") {
    chrome.tabs.create({ url: "https://pieapps.github.io/lifemirror-desktop.web/" });
  }
});
