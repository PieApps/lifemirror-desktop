let port = null;
const hostName = "com.lifemirror.desktop";

// Resilient native port connection
function getNativePort() {
  if (port) return port;
  
  try {
    port = chrome.runtime.connectNative(hostName);
    console.log("Connected to LifeMirror Native Messaging Host");
    
    port.onDisconnect.addListener(() => {
      console.log("Disconnected from Native Messaging Host: ", chrome.runtime.lastError?.message);
      port = null;
    });
  } catch (err) {
    console.error("Error connecting to native host:", err);
    port = null;
  }
  return port;
}

// Send tab info to the host
function reportTabActivity(tabId, changeInfo, tab) {
  // Only track once tab has loaded and is active
  if (!tab || !tab.active || (changeInfo && changeInfo.status !== "complete")) {
    return;
  }

  // Filter out internal browser pages
  if (tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) {
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
      console.log("Logged browser tab activity:", payload);
    } catch (e) {
      console.error("Failed to post browser activity:", e);
      port = null; // reset
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
