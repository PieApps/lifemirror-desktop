/**
 * LifeMirror Native Messaging RPC Client (ES Module)
 * Manages stdio connection, request-response RPCs, and state synchronization
 * with the LifeMirror Desktop Rust host (com.lifemirror.desktop).
 */

export const HOST_NAME = "com.lifemirror.desktop";
const RECONNECT_COOLDOWN_MS = 10000;

let port = null;
let isNativeConnected = false;
let isDesktopTrackingActive = true;
let lastReportedPayload = null;
let lastVaultError = null;
let lastConnectAttempt = 0;

const pendingNativeRpc = new Map(); // requestId -> { resolve, reject, timer }

// Event callbacks for background orchestration
const eventListeners = {
  sync_excluded_domains: [],
  tracking_state: []
};

export function addNativeEventListener(event, callback) {
  if (eventListeners[event]) {
    eventListeners[event].push(callback);
  }
}

export function getNativeStatus() {
  const currentPort = getNativePort();
  const connected = Boolean(isNativeConnected && currentPort !== null && !lastVaultError);
  return {
    connected,
    isNativeConnected,
    isDesktopTrackingActive,
    lastVaultError,
    lastReportedPayload,
    hostName: HOST_NAME
  };
}

export function setDesktopTrackingActive(active) {
  isDesktopTrackingActive = Boolean(active);
}

export function isDesktopTracking() {
  return isDesktopTrackingActive;
}

export function isConnected() {
  return Boolean(isNativeConnected && port !== null && !lastVaultError);
}

export function getLastReportedPayload() {
  return lastReportedPayload;
}

export function getNativePort(force = false) {
  if (port) return port;

  const now = Date.now();
  if (!force && (now - lastConnectAttempt < RECONNECT_COOLDOWN_MS)) {
    return null;
  }
  lastConnectAttempt = now;

  try {
    port = chrome.runtime.connectNative(HOST_NAME);

    port.onMessage.addListener((msg) => {
      if (msg && msg.requestId && pendingNativeRpc.has(msg.requestId)) {
        const { resolve, timer } = pendingNativeRpc.get(msg.requestId);
        clearTimeout(timer);
        pendingNativeRpc.delete(msg.requestId);
        if (msg.error) {
          lastVaultError = msg.error;
        } else {
          lastVaultError = null;
          isNativeConnected = true;
          chrome.action.setBadgeText({ text: "" });
          chrome.storage.local.set({ desktop_connected: true }).catch(() => {});
        }
        resolve(msg);
        return;
      }

      if (msg && msg.event === "tracking_state") {
        lastVaultError = null;
        isNativeConnected = true;
        chrome.storage.local.set({ desktop_connected: true }).catch(() => {});
        isDesktopTrackingActive = Boolean(msg.tracking_active);
        if (!isDesktopTrackingActive) {
          chrome.action.setBadgeText({ text: "PAUSE" });
          chrome.action.setBadgeBackgroundColor({ color: "#6b7280" });
        } else {
          chrome.action.setBadgeText({ text: "" });
        }
        eventListeners.tracking_state.forEach((cb) => {
          try { cb(isDesktopTrackingActive); } catch {}
        });
      }

      if (msg && msg.event === "sync_excluded_domains" && Array.isArray(msg.entries)) {
        lastVaultError = null;
        isNativeConnected = true;
        chrome.storage.local.set({ desktop_connected: true }).catch(() => {});
        eventListeners.sync_excluded_domains.forEach((cb) => {
          try { cb(msg.entries); } catch {}
        });
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

    try {
      port.postMessage({ event: "get_excluded_domains" });
    } catch {}

    callNativeRpc({ event: "get_desktop_status" }, 1500)
      .then((res) => {
        if (res && typeof res.tracking_active === "boolean") {
          lastVaultError = null;
          isNativeConnected = true;
          chrome.storage.local.set({ desktop_connected: true }).catch(() => {});
          isDesktopTrackingActive = res.tracking_active;
          if (!isDesktopTrackingActive) {
            chrome.action.setBadgeText({ text: "PAUSE" });
            chrome.action.setBadgeBackgroundColor({ color: "#6b7280" });
          } else {
            chrome.action.setBadgeText({ text: "" });
          }
        }
      })
      .catch(() => {});

    port.onDisconnect.addListener(() => {
      const err = chrome.runtime.lastError;
      if (err) {
        console.debug("[LifeMirror] Native messaging disconnected:", err.message);
      }

      for (const [requestId, { reject, timer }] of pendingNativeRpc.entries()) {
        clearTimeout(timer);
        reject(new Error(err?.message || "Native host disconnected"));
      }
      pendingNativeRpc.clear();

      isNativeConnected = false;
      isDesktopTrackingActive = true;
      port = null;
      chrome.storage.local.set({ desktop_connected: false }).catch(() => {});
      if (lastVaultError === null) {
        chrome.action.setBadgeText({ text: "" });
      }
    });
  } catch {
    port = null;
    isNativeConnected = false;
    chrome.storage.local.set({ desktop_connected: false }).catch(() => {});
  }
  return port;
}

export function callNativeRpc(eventPayload, timeoutMs = 4000) {
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

export async function reconnectNative() {
  if (port) {
    try { port.disconnect(); } catch {}
    port = null;
  }
  isNativeConnected = false;
  lastVaultError = null;
  chrome.action.setBadgeText({ text: "" });

  const nativePort = getNativePort(true);
  if (!nativePort) {
    return { connected: false, error: "Failed to establish native port" };
  }

  try {
    const res = await callNativeRpc({ event: "get_desktop_status" }, 2500);
    if (res && typeof res.tracking_active === "boolean") {
      isDesktopTrackingActive = res.tracking_active;
      isNativeConnected = true;
      lastVaultError = null;
      chrome.storage.local.set({ desktop_connected: true }).catch(() => {});
      if (!isDesktopTrackingActive) {
        chrome.action.setBadgeText({ text: "PAUSE" });
        chrome.action.setBadgeBackgroundColor({ color: "#6b7280" });
      } else {
        chrome.action.setBadgeText({ text: "" });
      }
      return {
        connected: true,
        trackingActive: isDesktopTrackingActive,
        vaultError: null
      };
    }
  } catch (err) {
    return {
      connected: false,
      vaultError: lastVaultError || "unreachable",
      error: err.message
    };
  }

  return {
    connected: Boolean(isNativeConnected && !lastVaultError),
    vaultError: lastVaultError,
    trackingActive: isDesktopTrackingActive
  };
}

export function forwardTabActivity(payload) {
  if (!isNativeConnected) return;
  const nativePort = getNativePort();
  if (nativePort) {
    try {
      nativePort.postMessage(payload);
      lastReportedPayload = payload;
    } catch {
      port = null;
      isNativeConnected = false;
      chrome.storage.local.set({ desktop_connected: false }).catch(() => {});
    }
  }
}

export function forwardDeleteActivity(url, title, profileId) {
  const nativePort = getNativePort();
  if (nativePort) {
    try {
      nativePort.postMessage({
        event: "delete_tab_activity",
        url: url || null,
        title: title || null,
        profileId: profileId || null
      });
    } catch {}
  }
}

export function forwardSyncExcludedDomains(entries) {
  const nativePort = getNativePort();
  if (nativePort) {
    try {
      nativePort.postMessage({
        event: "sync_excluded_domains",
        entries: entries
      });
    } catch {}
  }
}
