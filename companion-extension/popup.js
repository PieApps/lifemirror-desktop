/**
 * LifeMirror Desktop Companion Extension Popup
 * Communicates with the background service worker and provides direct app launching,
 * connection status checks, active tab preview, official resources, and social links.
 */

const WEB_DASHBOARD_URL = "https://pieapps.github.io/lifemirror-desktop.web/";
const APP_PROTOCOL_URL = "lifemirror://open";
const DEFAULT_FAVICON = "icons/icon16.png";

// DOM Elements
const connectionBadge = document.getElementById("connection-badge");
const connectionText = document.getElementById("connection-text");
const btnLaunchApp = document.getElementById("btn-launch-app");
const btnOpenWeb = document.getElementById("btn-open-web");
const launchFeedback = document.getElementById("launch-feedback");

const activeTabFavicon = document.getElementById("active-tab-favicon");
const activeTabTitle = document.getElementById("active-tab-title");
const activeTabDomain = document.getElementById("active-tab-domain");
const tabStatusPill = document.getElementById("tab-status-pill");

// ── Security & Link Handling ──────────────────────────────────────────────────
function initExternalLinks() {
  const externalLinks = document.querySelectorAll(".external-link");
  externalLinks.forEach((link) => {
    link.addEventListener("click", async (e) => {
      e.preventDefault();
      const url = link.getAttribute("href");
      if (!url) return;

      // Restrict allowed external protocols for safety
      if (url.startsWith("https://") || url.startsWith("http://")) {
        await chrome.tabs.create({ url });
      } else if (url.startsWith("mailto:")) {
        window.location.href = url;
      }
    });
  });
}

// ── Direct App Launch Handler with Debounce / Cooldown ────────────────────────
let isLaunching = false;

function initAppLauncher() {
  // Graceful fallback for broken or unreachable tab favicons
  activeTabFavicon.onerror = () => {
    activeTabFavicon.onerror = null;
    activeTabFavicon.src = DEFAULT_FAVICON;
  };

  btnLaunchApp.addEventListener("click", async (e) => {
    e.preventDefault();
    if (isLaunching) return;

    isLaunching = true;
    btnLaunchApp.setAttribute("aria-busy", "true");
    btnLaunchApp.style.opacity = "0.75";
    showLaunchFeedback("Launching LifeMirror Desktop...");

    // 1. Trigger protocol scheme via clean ephemeral iframe
    try {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = APP_PROTOCOL_URL;
      document.body.appendChild(iframe);
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.remove();
        }
      }, 1000);
    } catch {
      // Ignore protocol registration warnings
    }

    // 2. Notify background service worker to ping native host
    try {
      await chrome.runtime.sendMessage({ action: "ping_native" });
    } catch {
      // Service worker may be waking up
    }

    // 3. Reset button cooldown after 1.8 seconds
    setTimeout(() => {
      hideLaunchFeedback();
      btnLaunchApp.removeAttribute("aria-busy");
      btnLaunchApp.style.opacity = "1";
      isLaunching = false;
    }, 1800);
  });

  btnOpenWeb.addEventListener("click", async (e) => {
    e.preventDefault();
    await chrome.tabs.create({ url: WEB_DASHBOARD_URL });
  });
}

function showLaunchFeedback(msg) {
  launchFeedback.textContent = msg;
  launchFeedback.classList.remove("hidden");
}

function hideLaunchFeedback() {
  launchFeedback.classList.add("hidden");
}

// ── Active Tab Detection ──────────────────────────────────────────────────────
async function updateActiveTabPreview() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      activeTabTitle.textContent = "No active tab detected";
      activeTabDomain.textContent = "---";
      tabStatusPill.textContent = "Idle";
      tabStatusPill.className = "pill pill-ignored";
      activeTabFavicon.src = DEFAULT_FAVICON;
      return;
    }

    const urlStr = tab.url || "";
    const isWebPage = urlStr.startsWith("http://") || urlStr.startsWith("https://");

    if (isWebPage) {
      activeTabTitle.textContent = tab.title || "Untitled Tab";
      try {
        const parsed = new URL(urlStr);
        activeTabDomain.textContent = parsed.hostname;
      } catch {
        activeTabDomain.textContent = urlStr;
      }

      if (tab.favIconUrl) {
        activeTabFavicon.src = tab.favIconUrl;
      } else {
        activeTabFavicon.src = DEFAULT_FAVICON;
      }

      tabStatusPill.textContent = "Syncing";
      tabStatusPill.className = "pill pill-syncing";
    } else {
      activeTabTitle.textContent = tab.title || "Internal / System Page";
      activeTabDomain.textContent = urlStr.split("/")[0] || "Excluded Protocol";
      activeTabFavicon.src = DEFAULT_FAVICON;
      tabStatusPill.textContent = "Excluded";
      tabStatusPill.className = "pill pill-ignored";
    }
  } catch (err) {
    console.error("Error inspecting active tab:", err);
  }
}

// ── Native Host Status ────────────────────────────────────────────────────────
async function checkNativeHostStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: "get_status" });
    if (response && response.vaultError) {
      if (response.vaultError === "vault_locked") {
        setConnectionStatus(false, "Vault Locked (Open Desktop App)");
      } else if (response.vaultError === "vault_busy") {
        setConnectionStatus(false, "Vault Busy (Updating DB...)");
      } else {
        setConnectionStatus(false, `Vault Error (${response.vaultError})`);
      }
    } else if (response && response.connected) {
      setConnectionStatus(true, "Desktop Connected");
    } else {
      setConnectionStatus(false, "Desktop Offline");
    }
  } catch {
    // Service worker may be asleep or unreachable
    setConnectionStatus(false, "Desktop Offline");
  }
}

function setConnectionStatus(isConnected, label) {
  connectionBadge.className = `status-badge ${isConnected ? "connected" : "disconnected"}`;
  connectionText.textContent = label;
}

// ── Initialization ────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  initExternalLinks();
  initAppLauncher();
  await updateActiveTabPreview();
  await checkNativeHostStatus();
});
