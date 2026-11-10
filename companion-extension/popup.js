/**
 * LifeMirror Desktop Companion Extension Popup
 * Features:
 * - Direct 1-click trigger to open Chrome's Side Panel
 * - Active page reflection with meta description & 1-click tag revise
 * - Quick focus duration glance & context switches
 * - Resilient Desktop App bridge with graceful Standalone Mode status
 */

const DEFAULT_FAVICON = "icons/icon16.png";

// DOM Elements
const connectionBadge = document.getElementById("connection-badge");
const connectionText = document.getElementById("connection-text");

const activeTabFavicon = document.getElementById("active-tab-favicon");
const activeTabLink = document.getElementById("active-tab-link");
const activeTabTitle = document.getElementById("active-tab-title");
const activeTabDomain = document.getElementById("active-tab-domain");
const activeTabDesc = document.getElementById("active-tab-desc");
const activeTabTagBtn = document.getElementById("active-tab-tag-btn");
const activeTabTagText = document.getElementById("active-tab-tag-text");

const tabExclusionWrap = document.getElementById("tab-exclusion-wrap");
const btnExcludeActiveTab = document.getElementById("btn-exclude-active-tab");
const tabExcludedBadge = document.getElementById("tab-excluded-badge");
const btnUnexcludeActiveTab = document.getElementById("btn-unexclude-active-tab");

const openSidepanelBtn = document.getElementById("open-sidepanel-btn");
const todayTotalTime = document.getElementById("today-total-time");
const todaySwitches = document.getElementById("today-switches");
const popupBridgeCard = document.getElementById("popup-bridge-card");
const revisePopover = document.getElementById("revise-popover");

let currentActiveDomain = "";

function formatDuration(seconds) {
  if (!seconds || seconds < 60) return `${seconds || 0}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return `${h}h ${remM}m`;
}

// Graceful fallback for broken favicons
activeTabFavicon.onerror = () => {
  activeTabFavicon.onerror = null;
  activeTabFavicon.src = DEFAULT_FAVICON;
};

// ── Link Handling ─────────────────────────────────────────────────────────────
function initExternalLinks() {
  const externalLinks = document.querySelectorAll(".external-link");
  externalLinks.forEach((link) => {
    link.addEventListener("click", async (e) => {
      e.preventDefault();
      const url = link.getAttribute("href");
      if (!url) return;
      if (url.startsWith("https://") || url.startsWith("http://")) {
        await chrome.tabs.create({ url });
      } else if (url.startsWith("mailto:")) {
        window.location.href = url;
      }
    });
  });
}

// ── Open Side Panel Action ────────────────────────────────────────────────────
if (openSidepanelBtn) {
  openSidepanelBtn.addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (chrome.sidePanel && chrome.sidePanel.open && tab) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
        window.close(); // Close popup once side panel is triggered
      }
    } catch (err) {
      console.warn("Failed to open side panel:", err);
    }
  });
}

// ── Active Tab & Metadata Reflection ──────────────────────────────────────────
async function updateActiveTabPreview() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      activeTabTitle.textContent = "No active tab detected";
      activeTabDomain.textContent = "---";
      activeTabFavicon.src = DEFAULT_FAVICON;
      if (activeTabDesc) activeTabDesc.classList.add("hidden");
      return;
    }

    if (tab.incognito) {
      activeTabTitle.textContent = "Incognito Tab (Private)";
      activeTabDomain.textContent = "Tracking Paused";
      if (activeTabLink) activeTabLink.removeAttribute("href");
      activeTabFavicon.src = DEFAULT_FAVICON;
      currentActiveDomain = "";
      if (activeTabDesc) activeTabDesc.classList.add("hidden");
      activeTabTagText.textContent = "Incognito";
      return;
    }

    const urlStr = tab.url || "";
    const isWebPage = urlStr.startsWith("http://") || urlStr.startsWith("https://");

    if (isWebPage) {
      activeTabTitle.textContent = tab.title || "Untitled Tab";
      if (activeTabLink) {
        activeTabLink.href = urlStr;
      }
      try {
        const parsed = new URL(urlStr);
        currentActiveDomain = parsed.hostname.replace(/^www\./, "");
        activeTabDomain.textContent = currentActiveDomain;
      } catch {
        currentActiveDomain = urlStr;
        activeTabDomain.textContent = urlStr;
      }

      if (tab.favIconUrl) {
        activeTabFavicon.src = tab.favIconUrl;
      } else {
        activeTabFavicon.src = DEFAULT_FAVICON;
      }

      // Fetch active session & meta description from background service worker
      const status = await chrome.runtime.sendMessage({ action: "get_status" });
      if (status && status.currentSession) {
        if (status.currentSession.description) {
          activeTabDesc.textContent = `"${status.currentSession.description}"`;
          activeTabDesc.classList.remove("hidden");
        } else {
          activeTabDesc.classList.add("hidden");
        }

        if (status.currentSession.tag) {
          activeTabTagText.textContent = status.currentSession.tag;
        }
      }

      // Check if current domain is excluded
      let isExcluded = false;
      try {
        const exclRes = await chrome.runtime.sendMessage({ action: "get_excluded_domains" });
        const list = (exclRes && exclRes.excludedDomains) || [];
        for (const entry of list) {
          if (!entry.removed && LifeMirrorDomainRules.hostMatches(currentActiveDomain, entry.domain, entry.include_subdomains !== false)) {
            isExcluded = true;
            break;
          }
        }
      } catch {}

      if (tabExclusionWrap) {
        tabExclusionWrap.classList.remove("hidden");
        if (isExcluded) {
          tabExcludedBadge?.classList.remove("hidden");
          btnExcludeActiveTab?.classList.add("hidden");
          activeTabTagText.textContent = "🚫 Excluded";
        } else {
          tabExcludedBadge?.classList.add("hidden");
          btnExcludeActiveTab?.classList.remove("hidden");
        }
      }
    } else {
      activeTabTitle.textContent = tab.title || "Internal / System Page";
      activeTabDomain.textContent = urlStr.split("/")[0] || "Excluded Protocol";
      if (activeTabLink) activeTabLink.removeAttribute("href");
      activeTabFavicon.src = DEFAULT_FAVICON;
      currentActiveDomain = "";
      if (activeTabDesc) activeTabDesc.classList.add("hidden");
      if (tabExclusionWrap) tabExclusionWrap.classList.add("hidden");
      activeTabTagText.textContent = "Excluded";
    }

    // Fetch Today's Analytics Glance
    const analytics = await chrome.runtime.sendMessage({ action: "get_today_analytics" });
    if (analytics) {
      todayTotalTime.textContent = formatDuration(analytics.totalActiveSeconds);
      todaySwitches.textContent = String(analytics.contextSwitches || 0);
    }
  } catch (err) {
    console.error("Error inspecting active tab:", err);
  }
}

// ── 1-Click Revise Popover in Popup ────────────────────────────────────────────
if (activeTabTagBtn && revisePopover) {
  activeTabTagBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!currentActiveDomain) return;
    const rect = activeTabTagBtn.getBoundingClientRect();
    revisePopover.style.top = `${rect.bottom + 4}px`;
    revisePopover.style.left = `${Math.max(10, rect.left - 60)}px`;
    revisePopover.classList.remove("hidden");
  });

  document.querySelectorAll(".popover-opt").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const newTag = btn.getAttribute("data-tag");
      if (currentActiveDomain && newTag) {
        activeTabTagText.textContent = newTag;
        await chrome.runtime.sendMessage({
          action: "update_tag",
          domain: currentActiveDomain,
          newCategory: newTag
        });
        revisePopover.classList.add("hidden");
      }
    });
  });

  document.addEventListener("click", (e) => {
    if (!revisePopover.contains(e.target)) {
      revisePopover.classList.add("hidden");
    }
  });
}

// ── Native Host Status Check ──────────────────────────────────────────────────
async function checkNativeHostStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: "get_status" });
    if (response && response.vaultError) {
      if (response.vaultError === "vault_locked") {
        setConnectionStatus(false, "Vault Locked", "locked");
      } else if (response.vaultError === "vault_busy") {
        setConnectionStatus(false, "Vault Busy", "busy");
      } else {
        setConnectionStatus(false, `Error: ${response.vaultError}`, "disconnected");
      }
      if (popupBridgeCard) popupBridgeCard.classList.remove("hidden");
    } else if (response && response.connected) {
      setConnectionStatus(true, "Desktop Connected", "connected");
      if (popupBridgeCard) popupBridgeCard.classList.add("hidden");
    } else {
      // Graceful standalone mode
      setConnectionStatus(false, "Standalone Active", "standalone");
      if (popupBridgeCard) popupBridgeCard.classList.remove("hidden");
    }
  } catch {
    setConnectionStatus(false, "Standalone Active", "standalone");
    if (popupBridgeCard) popupBridgeCard.classList.remove("hidden");
  }
}

function setConnectionStatus(isConnected, label, stateClass = "disconnected") {
  connectionBadge.className = `status-badge ${stateClass}`;
  connectionText.textContent = label;
}

// ── Excluded Domains Buttons ─────────────────────────────────────────────────
if (btnExcludeActiveTab) {
  btnExcludeActiveTab.addEventListener("click", async () => {
    if (!currentActiveDomain) return;
    btnExcludeActiveTab.disabled = true;
    try {
      await chrome.runtime.sendMessage({
        action: "add_excluded_domain",
        domain: currentActiveDomain,
        includeSubdomains: true,
        purgeHistory: true
      });
      await updateActiveTabPreview();
    } catch (err) {
      console.error("Failed to exclude domain:", err);
    } finally {
      btnExcludeActiveTab.disabled = false;
    }
  });
}

if (btnUnexcludeActiveTab) {
  btnUnexcludeActiveTab.addEventListener("click", async () => {
    if (!currentActiveDomain) return;
    btnUnexcludeActiveTab.disabled = true;
    try {
      await chrome.runtime.sendMessage({
        action: "remove_excluded_domain",
        domain: currentActiveDomain
      });
      await updateActiveTabPreview();
    } catch (err) {
      console.error("Failed to unexclude domain:", err);
    } finally {
      btnUnexcludeActiveTab.disabled = false;
    }
  });
}

// ── Profile Identity Handling ────────────────────────────────────────────────
const profileBrowserBadge = document.getElementById("profile-browser-badge");
const profileLabelInput = document.getElementById("profile-label-input");
const profileSaveBtn = document.getElementById("profile-save-btn");

async function loadProfileIdentity() {
  try {
    const res = await chrome.runtime.sendMessage({ action: "get_profile_identity" });
    if (res) {
      if (profileBrowserBadge) profileBrowserBadge.textContent = res.browserName || "Browser";
      if (profileLabelInput) profileLabelInput.value = res.profileLabel || "Default";
    }
  } catch (err) {
    console.warn("Failed to load profile identity:", err);
  }
}

if (profileSaveBtn && profileLabelInput) {
  profileSaveBtn.addEventListener("click", async () => {
    const newLabel = profileLabelInput.value.trim() || "Default";
    profileSaveBtn.disabled = true;
    try {
      await chrome.runtime.sendMessage({ action: "update_profile_label", label: newLabel });
      profileSaveBtn.textContent = "✓ Saved";
      setTimeout(() => {
        profileSaveBtn.textContent = "Save";
        profileSaveBtn.disabled = false;
      }, 1500);
    } catch {
      profileSaveBtn.disabled = false;
    }
  });
}

// ── Initialization ────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  initExternalLinks();
  await updateActiveTabPreview();
  await checkNativeHostStatus();
  await loadProfileIdentity();
});
