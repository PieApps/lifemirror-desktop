/**
 * LifeMirror Side Panel Script
 * Renders real-time focus analytics, hourly rhythm, top domains, and page descriptions.
 * Incorporates Steve Krug's "Don't Make Me Think" 1-click revise tag workflow.
 */

const DEFAULT_FAVICON = "icons/icon16.png";

// DOM Elements
const modeBadge = document.getElementById("mode-badge");
const modeBadgeText = document.getElementById("mode-badge-text");
const totalTimeVal = document.getElementById("total-time-val");
const switchesVal = document.getElementById("switches-val");
const domainsCountVal = document.getElementById("domains-count-val");
const heatStrip = document.getElementById("heat-strip");
const topDomainsList = document.getElementById("top-domains-list");
const sessionsStream = document.getElementById("sessions-stream");
const desktopBridgeCard = document.getElementById("desktop-bridge-card");
const dataManagementCard = document.getElementById("data-management-card");
const clearDataBtn = document.getElementById("clear-data-btn");
const categoryFilters = document.getElementById("category-filters");
const revisePopover = document.getElementById("revise-popover");
const sessionSearchInput = document.getElementById("session-search-input");
const searchClearBtn = document.getElementById("search-clear-btn");
const sessionsCountBadge = document.getElementById("sessions-count-badge");
const streamDesktopLoader = document.getElementById("stream-desktop-loader");
const copySummaryBtn = document.getElementById("copy-summary-btn");
const dateLabel = document.getElementById("date-label");
const trackingPausedBanner = document.getElementById("tracking-paused-banner");
const connectionStatusBanner = document.getElementById("connection-status-banner");
const connectionBannerIcon = document.getElementById("connection-banner-icon");
const connectionBannerTitle = document.getElementById("connection-banner-title");
const connectionBannerDesc = document.getElementById("connection-banner-desc");
const connectionBannerAction = document.getElementById("connection-banner-action");
const btnReconnectDesktop = document.getElementById("btn-reconnect-desktop");
const reconnectBtnIcon = document.getElementById("reconnect-btn-icon");
const reconnectBtnLabel = document.getElementById("reconnect-btn-label");
const bridgeCardTitle = document.getElementById("bridge-card-title");
const bridgeCardDesc = document.getElementById("bridge-card-desc");

let _bannerTimer = null;
function showConnectionBanner(type, title, desc, showRetry = false) {
  if (!connectionStatusBanner) return;
  clearTimeout(_bannerTimer);
  connectionStatusBanner.className = `connection-banner banner-${type}`;
  if (connectionBannerTitle) connectionBannerTitle.textContent = title;
  if (connectionBannerDesc) connectionBannerDesc.textContent = desc;
  if (connectionBannerIcon) {
    connectionBannerIcon.textContent = type === "success" ? "✓" : (type === "warning" ? "🔒" : "⚡");
  }
  if (connectionBannerAction) {
    if (showRetry) {
      connectionBannerAction.classList.remove("hidden");
      connectionBannerAction.textContent = "Retry";
      connectionBannerAction.onclick = triggerReconnectDesktop;
    } else {
      connectionBannerAction.classList.add("hidden");
    }
  }
  connectionStatusBanner.classList.remove("hidden");
  if (type === "success") {
    _bannerTimer = setTimeout(() => {
      connectionStatusBanner.classList.add("hidden");
    }, 4000);
  }
}

async function triggerReconnectDesktop() {
  if (modeBadge) {
    modeBadge.className = "mode-badge mode-connecting clickable";
    modeBadge.title = "Connecting to LifeMirror Desktop...";
  }
  if (modeBadgeText) modeBadgeText.textContent = "Connecting...";
  if (reconnectBtnLabel) reconnectBtnLabel.textContent = "Connecting...";
  if (btnReconnectDesktop) btnReconnectDesktop.disabled = true;

  try {
    const res = await chrome.runtime.sendMessage({ action: "reconnect_native" });
    if (res && res.connected) {
      showConnectionBanner("success", "Connected to LifeMirror Desktop", "Full-system timeline and native vault are active.");
      await loadData();
    } else if (res && res.vaultError === "vault_locked") {
      showConnectionBanner("warning", "Desktop Vault Locked", "Open and unlock LifeMirror Desktop application, then click retry.", true);
      await loadData();
    } else {
      showConnectionBanner("warning", "Desktop Client Not Detected", "Could not connect to LifeMirror Desktop. Make sure the application is open and running.", true);
      await loadData();
    }
  } catch (err) {
    showConnectionBanner("warning", "Connection Failed", err.message || "Could not reach background worker.", true);
    await loadData();
  } finally {
    if (btnReconnectDesktop) btnReconnectDesktop.disabled = false;
  }
}

// Theme Elements
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const themeToggleIcon = document.getElementById("theme-toggle-icon");
const themeToggleText = document.getElementById("theme-toggle-text");
let currentTheme = "system"; // "system" | "light" | "dark"

// Real-time Active Tab Hero Elements (Merged from Popup)
const activeTabCard = document.querySelector(".active-tab-card");
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
const activeDomainTime = document.getElementById("active-domain-time");
const todaySwitchesPreview = document.getElementById("today-switches-preview");
let currentActiveDomain = "";

// About Drawer & Profile Elements (Merged from Popup)
const aboutDrawer = document.getElementById("about-drawer");
const aboutToggleBtn = document.getElementById("about-toggle-btn");
const closeAboutDrawerBtn = document.getElementById("close-about-drawer-btn");
const footerAboutBtn = document.getElementById("footer-about-btn");
const profileBrowserBadge = document.getElementById("profile-browser-badge");
const profileLabelInput = document.getElementById("profile-label-input");
const profileSaveBtn = document.getElementById("profile-save-btn");

// Profile & Stream Elements
const scopeProfileBtn = document.getElementById("scope-profile-btn");
const scopeProfileLabel = document.getElementById("scope-profile-label");
const scopeAllBtn = document.getElementById("scope-all-btn");
const liveTabPill = document.getElementById("live-tab-pill");
const streamSentinel = document.getElementById("stream-sentinel");
const loadMoreBtn = document.getElementById("load-more-btn");
const loadMoreText = document.getElementById("load-more-text");

let activeFilter = "all";
let searchQuery = "";
let reviseTargetDomain = null;
let currentAnalytics = null;

// Multi-Profile & Keyset Stream State
let activeProfileScope = "profile"; // "profile" | "all"
let myProfileId = null;
let myProfileLabel = "Current Profile";
let myBrowserName = "Chrome";
let nextCursor = null;
let isFetchingMore = false;
let loadedSessions = [];
let isConnectedToDesktop = false;
let lastDesktopTopSites = null;

// ── Instant Sync Placeholders on Both Tabs ────────────────────────────────────
function showSyncingPlaceholders(force = false) {
  if (topDomainsList && (force || !topDomainsList.children.length || topDomainsList.querySelector(".empty-state") || topDomainsList.querySelector(".stream-fetching-placeholder"))) {
    topDomainsList.innerHTML = `
      <div class="stream-fetching-placeholder">
        <div class="stream-spinner-lg"></div>
        <div class="stream-fetching-title">Syncing with Desktop App...</div>
        <p class="stream-fetching-sub">Fetching verified top sites from local SQLite vault</p>
      </div>
    `;
  }
  if (sessionsStream && (force || loadedSessions.length === 0 || sessionsStream.querySelector(".empty-state") || sessionsStream.querySelector(".stream-fetching-placeholder"))) {
    if (streamDesktopLoader) streamDesktopLoader.classList.remove("hidden");
    sessionsStream.innerHTML = `
      <div class="stream-fetching-placeholder">
        <div class="stream-spinner-lg"></div>
        <div class="stream-fetching-title">Syncing with Desktop App...</div>
        <p class="stream-fetching-sub">Fetching verified reflections from local SQLite vault</p>
      </div>
    `;
  }
}

// Pre-render Desktop Sync state immediately if previously connected (zero-delay feedback on open)
chrome.storage.local.get(["desktop_connected", "profile_id", "profile_label"]).then((res) => {
  if (res && res.desktop_connected) {
    isConnectedToDesktop = true;
    if (modeBadge) modeBadge.className = "mode-badge mode-desktop";
    if (modeBadgeText) modeBadgeText.textContent = "Desktop Sync Active";
    if (desktopBridgeCard) desktopBridgeCard.style.display = "none";
    if (dataManagementCard) dataManagementCard.classList.add("hidden");
    showSyncingPlaceholders();
  }
  if (res && res.profile_id) myProfileId = res.profile_id;
  if (res && res.profile_label) myProfileLabel = res.profile_label;
}).catch(() => {});

// ── Security: HTML Entity Escaping (Prevents Stored DOM XSS) ──────────────────
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Idempotent URL encoder: decodes first to avoid double-encoding already-encoded URLs
 * (chrome.tabs may return pre-encoded favicon/page URLs).
 */
function safeEncodeUrl(url) {
  try { return encodeURI(decodeURI(url)); } catch { return encodeURI(url); }
}

function formatDuration(seconds) {
  if (!seconds || seconds < 60) return `${seconds || 0}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return `${h}h ${remM}m`;
}

function formatTimestamp(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// ── Render Heat Strip (24 Hours) ──────────────────────────────────────────────
function renderHeatStrip(hourlyArray = []) {
  heatStrip.innerHTML = "";
  const maxVal = Math.max(...hourlyArray, 1);
  const currentHour = new Date().getHours();

  for (let i = 0; i < 24; i++) {
    const minutes = hourlyArray[i] || 0;
    const cell = document.createElement("div");
    cell.className = "heat-cell";

    if (minutes > 0) {
      const ratio = minutes / maxVal;
      if (ratio > 0.6) {
        cell.className += " active-high";
      } else if (ratio > 0.3) {
        cell.className += " active-mid";
      } else {
        cell.className += " active-low";
      }
    }

    const hourLabel = i === 0 ? "12am" : i < 12 ? `${i}am` : i === 12 ? "12pm" : `${i - 12}pm`;
    if (i === currentHour) {
      cell.classList.add("heat-now");
      cell.title = `${hourLabel}: ${minutes} mins focus (Current Hour)`;
    } else {
      cell.title = `${hourLabel}: ${minutes} mins focus`;
    }
    heatStrip.appendChild(cell);
  }
}

// ── Render Top Domains ────────────────────────────────────────────────────────
function renderTopDomains(domainsInput = {}) {
  let entries = [];
  if (Array.isArray(domainsInput)) {
    entries = domainsInput.map((e) => [
      e.domain,
      {
        seconds: e.total_seconds || (e.visit_count * 60) || 60,
        url: `https://${e.domain}`,
        title: e.domain,
        tag: e.tag || "🌐 Other",
        favIconUrl: e.icon_url || ""
      }
    ]);
  } else {
    entries = Object.entries(domainsInput || {});
  }

  if (entries.length === 0) {
    topDomainsList.innerHTML = `
      <div class="empty-state warm-empty-state">
        <div class="empty-emoji">🌱</div>
        <div class="empty-heading">No website activity yet</div>
        <p class="empty-text">As you browse, your most-visited websites and active dwell time will show up here.</p>
      </div>`;
    return;
  }

  // Sort by time descending
  entries.sort((a, b) => b[1].seconds - a[1].seconds);
  const totalSeconds = entries.reduce((acc, curr) => acc + curr[1].seconds, 0) || 1;

  const filtered = activeFilter === "all"
    ? entries
    : entries.filter(([, data]) => data.tag === activeFilter);

  if (filtered.length === 0) {
    topDomainsList.innerHTML = `
      <div class="empty-state warm-empty-state">
        <div class="empty-emoji">📂</div>
        <div class="empty-heading">No websites in ${escapeHtml(activeFilter)}</div>
        <p class="empty-text">Websites tagged under this category will show up here as you browse.</p>
      </div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  filtered.slice(0, 5).forEach(([dom, data]) => {
    const pct = Math.round((data.seconds / totalSeconds) * 100);
    const item = document.createElement("div");
    item.className = "domain-item";
    const safeDom = escapeHtml(dom);
    const safeFavicon = data.favIconUrl && /^https?:\/\//i.test(data.favIconUrl)
      ? escapeHtml(safeEncodeUrl(data.favIconUrl))
      : DEFAULT_FAVICON;
    const safeUrl = data.url && /^https?:\/\//i.test(data.url)
      ? escapeHtml(safeEncodeUrl(data.url))
      : `https://${safeDom}`;
    item.innerHTML = `
      <div class="domain-info">
        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="domain-name domain-link" title="Open ${safeDom}">
          <img class="domain-favicon" src="${safeFavicon}" alt="">
          <span>${safeDom}</span>
          <span class="link-arrow">↗</span>
        </a>
        <div class="domain-info-right">
          <span>${formatDuration(data.seconds)} (${pct}%)</span>
          <button class="btn-exclude-domain" data-domain="${safeDom}" title="Exclude ${safeDom} from tracking" aria-label="Exclude domain">🚫</button>
        </div>
      </div>
      <div class="domain-bar-bg">
        <div class="domain-bar-fill"></div>
      </div>
    `;

    const barFill = item.querySelector(".domain-bar-fill");
    if (barFill) {
      barFill.style.width = `${pct}%`;
    }

    const faviconImg = item.querySelector(".domain-favicon");
    if (faviconImg) {
      faviconImg.addEventListener("error", () => {
        faviconImg.src = DEFAULT_FAVICON;
      }, { once: true });
    }

    const excludeDomBtn = item.querySelector(".btn-exclude-domain");
    if (excludeDomBtn) {
      excludeDomBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openPurgeModal(dom, true);
      });
    }

    fragment.appendChild(item);
  });

  topDomainsList.replaceChildren(fragment);
}

// ── Render Recent Page Reflections with Descriptions & Tags ───────────────────
function renderSessions(sessions = []) {
  if (!sessions || sessions.length === 0) {
    sessionsStream.innerHTML = `
      <div class="empty-state warm-empty-state">
        <div class="empty-emoji">✨</div>
        <div class="empty-heading">Ready when you are!</div>
        <p class="empty-text">Browse normally—your focus rhythm, top sites, and mindful page summaries will automatically reflect here 100% on-device.</p>
      </div>`;
    if (sessionsCountBadge) sessionsCountBadge.textContent = "0 items";
    return;
  }

  const query = searchQuery.trim().toLowerCase();
  const filtered = sessions.filter((s) => {
    const matchesCategory = activeFilter === "all" || s.tag === activeFilter;
    if (!matchesCategory) return false;
    if (!query) return true;
    const title = (s.title || "").toLowerCase();
    const domain = (s.domain || "").toLowerCase();
    const desc = (s.description || "").toLowerCase();
    return title.includes(query) || domain.includes(query) || desc.includes(query);
  });

  if (filtered.length === 0) {
    if (query) {
      sessionsStream.innerHTML = `
        <div class="empty-state warm-empty-state">
          <div class="empty-emoji">🔍</div>
          <div class="empty-heading">No reflections match "${escapeHtml(searchQuery)}"</div>
          <p class="empty-text">Try searching a different keyword or domain.</p>
        </div>`;
    } else {
      sessionsStream.innerHTML = `
        <div class="empty-state warm-empty-state">
          <div class="empty-emoji">📂</div>
          <div class="empty-heading">No reflections in ${escapeHtml(activeFilter)}</div>
          <p class="empty-text">Pages categorized under this topic will collect here automatically.</p>
        </div>`;
    }
    if (sessionsCountBadge) sessionsCountBadge.textContent = "0 items";
    return;
  }

  // Consolidate consecutive entries for the exact same page/article
  const consolidated = [];
  filtered.forEach((session) => {
    const prev = consolidated[consolidated.length - 1];
    if (prev && prev.domain === session.domain && prev.title === session.title) {
      prev.duration += session.duration;
      if (!prev.description && session.description) {
        prev.description = session.description;
      }
      if (!prev.url && session.url) {
        prev.url = session.url;
      }
    } else {
      consolidated.push({ ...session });
    }
  });

  if (sessionsCountBadge) {
    sessionsCountBadge.textContent = `${consolidated.length} item${consolidated.length === 1 ? "" : "s"}${nextCursor ? " • scroll for more" : ""}`;
  }

  const fragment = document.createDocumentFragment();
  consolidated.forEach((session) => {
    const item = document.createElement("div");
    item.className = "session-item";

    const hasDesc = Boolean(session.description && session.description.trim().length > 0);
    const tagLabel = session.tag || "🌐 Other";
    const safeTitle = escapeHtml(session.title || "Untitled Tab");
    const safeDomain = escapeHtml(session.domain || "---");
    const safeDesc = escapeHtml(session.description || "");
    const safeTag = escapeHtml(tagLabel);
    const safeFavicon = session.favIconUrl && /^https?:\/\//i.test(session.favIconUrl)
      ? escapeHtml(safeEncodeUrl(session.favIconUrl))
      : DEFAULT_FAVICON;
    const rawUrl = session.url || (session.domain ? `https://${session.domain}` : "");
    const safeUrl = /^https?:\/\//i.test(rawUrl)
      ? escapeHtml(safeEncodeUrl(rawUrl))
      : "#";
    const safeTime = formatTimestamp(session.timestamp);
    const originBadgeHtml = (activeProfileScope === "all" && (session.profile_label || session.browser_name))
      ? `<span class="origin-badge">${escapeHtml(session.browser_name || "Browser")} • ${escapeHtml(session.profile_label || "Default")}</span>`
      : "";

    item.innerHTML = `
      <div class="session-header">
        <div class="session-title-wrap">
          <img class="session-favicon" src="${safeFavicon}" alt="">
          <div class="session-body">
            <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="session-title-link" title="Open: ${safeTitle}">
              <span>${safeTitle}</span>
              <span class="link-arrow">↗</span>
            </a>
            <div class="session-meta">
              <a href="https://${safeDomain}" target="_blank" rel="noopener noreferrer" class="session-domain-link">${safeDomain}</a>
              ${safeTime ? `<span class="meta-dot">•</span><span class="session-time">${safeTime}</span>` : ""}
              <span class="meta-dot">•</span>
              <span class="session-duration">${formatDuration(session.duration || 60)}</span>
              ${originBadgeHtml}
            </div>
          </div>
        </div>
        <div class="session-card-actions">
          <button class="tag-chip-btn" data-domain="${safeDomain}" title="Click to revise category">
            <span>${safeTag}</span>
            <span class="tag-chip-arrow">▾</span>
          </button>
          <button class="btn-exclude-card" data-domain="${safeDomain}" title="Exclude domain from tracking" aria-label="Exclude domain">🚫</button>
          <button class="btn-delete-card" data-domain="${safeDomain}" data-title="${safeTitle}" data-url="${safeUrl}" title="Remove this reflection" aria-label="Remove reflection">✕</button>
        </div>
      </div>
      ${hasDesc ? `<div class="session-desc">"${safeDesc}"</div>` : ""}
    `;

    const faviconImg = item.querySelector(".session-favicon");
    if (faviconImg) {
      faviconImg.addEventListener("error", () => {
        faviconImg.src = DEFAULT_FAVICON;
      }, { once: true });
    }

    // Hook 1-click revise button
    const tagBtn = item.querySelector(".tag-chip-btn");
    tagBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openRevisePopover(e.currentTarget, session.domain);
    });

    // Hook 1-click exclude button
    const excludeBtn = item.querySelector(".btn-exclude-card");
    if (excludeBtn) {
      excludeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openPurgeModal(session.domain, true);
      });
    }

    // Hook 1-click delete button (reflects in desktop SQLite via native messaging)
    const delBtn = item.querySelector(".btn-delete-card");
    if (delBtn) {
      delBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        item.style.transition = "opacity 0.2s ease, transform 0.2s ease";
        item.style.opacity = "0.2";
        item.style.transform = "scale(0.97)";
        await chrome.runtime.sendMessage({
          action: "delete_single_session",
          domain: session.domain,
          title: session.title,
          url: session.url
        });
        loadData();
      });
    }

    fragment.appendChild(item);
  });

  sessionsStream.replaceChildren(fragment);

  // Update Keyset Sentinel & Load More button visibility
  if (nextCursor) {
    if (consolidated.length < 75) {
      if (streamSentinel) streamSentinel.style.display = "block";
      if (loadMoreBtn) loadMoreBtn.classList.add("hidden");
    } else {
      if (streamSentinel) streamSentinel.style.display = "none";
      if (loadMoreBtn) {
        loadMoreBtn.classList.remove("hidden");
        if (loadMoreText) loadMoreText.textContent = `↓ Load earlier activity • Showing ${consolidated.length} items`;
      }
    }
  } else {
    if (streamSentinel) streamSentinel.style.display = "none";
    if (loadMoreBtn) loadMoreBtn.classList.add("hidden");
  }

  // When high-frequency browsing occurred, convey why older tabs are rolled up
  const totalSwitches = (currentAnalytics && currentAnalytics.contextSwitches) || 0;
  if (totalSwitches > consolidated.length && !query && activeFilter === "all") {
    const summaryPill = document.createElement("div");
    summaryPill.className = "stream-summary-pill";
    summaryPill.innerHTML = `
      <span class="pill-icon">💡</span>
      <div class="pill-text">
        <strong>Fast browsing session (${totalSwitches} hops today)</strong>
        <span>To prevent feed overload, earlier tabs are neatly summarized in <em>Top Websites</em> and <em>Hourly Activity</em> above.</span>
      </div>
    `;
    sessionsStream.appendChild(summaryPill);
  }
}

// ── 1-Click Revise Popover ────────────────────────────────────────────────────
function openRevisePopover(targetBtn, domain) {
  reviseTargetDomain = domain;
  const rect = targetBtn.getBoundingClientRect();
  revisePopover.style.top = `${rect.bottom + 4}px`;
  revisePopover.style.left = `${Math.max(10, rect.left - 70)}px`;
  revisePopover.classList.remove("hidden");
}

document.querySelectorAll(".popover-opt").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const newTag = btn.getAttribute("data-tag");
    if (reviseTargetDomain && newTag) {
      await chrome.runtime.sendMessage({
        action: "update_tag",
        domain: reviseTargetDomain,
        newCategory: newTag
      });
      revisePopover.classList.add("hidden");
      loadData(); // Re-render smoothly
      updateActiveTabPreview();
    }
  });
});

document.addEventListener("click", (e) => {
  if (!revisePopover.contains(e.target)) {
    revisePopover.classList.add("hidden");
  }
});

// ── Category Filter Logic ─────────────────────────────────────────────────────
const categoryFiltersWrap = document.getElementById("category-filters-wrap");
const chipScrollLeft = document.getElementById("chip-scroll-left");
const chipScrollRight = document.getElementById("chip-scroll-right");

categoryFilters.querySelectorAll(".filter-chip").forEach((btn) => {
  btn.addEventListener("click", () => {
    categoryFilters.querySelectorAll(".filter-chip").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = btn.getAttribute("data-cat");
    if (lastDesktopTopSites) {
      renderTopDomains(lastDesktopTopSites);
    } else if (currentAnalytics) {
      renderTopDomains(currentAnalytics.domains);
    }
    renderSessions(loadedSessions.length > 0 ? loadedSessions : (currentAnalytics ? currentAnalytics.recentSessions : []));
  });
});

function updateFilterScrollButtons() {
  if (!categoryFilters) return;
  const scrollLeft = categoryFilters.scrollLeft;
  const maxScroll = categoryFilters.scrollWidth - categoryFilters.clientWidth;
  const canLeft = scrollLeft > 4;
  const canRight = scrollLeft < maxScroll - 4;

  if (categoryFiltersWrap) {
    categoryFiltersWrap.classList.toggle("can-scroll-left", canLeft);
    categoryFiltersWrap.classList.toggle("can-scroll-right", canRight);
  }
  if (chipScrollLeft) chipScrollLeft.classList.toggle("hidden", !canLeft);
  if (chipScrollRight) chipScrollRight.classList.toggle("hidden", !canRight);
}

function initCategoryFiltersScroll() {
  if (!categoryFilters) return;

  // 1. Mouse wheel horizontal scroll on hover
  categoryFilters.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaY) > 0 || Math.abs(e.deltaX) > 0) {
      e.preventDefault();
      categoryFilters.scrollLeft += (e.deltaY || e.deltaX);
      updateFilterScrollButtons();
    }
  }, { passive: false });

  // 2. Edge-hover auto scrolling
  let hoverScrollTimer = null;
  function startHoverScroll(speed) {
    if (hoverScrollTimer) return;
    hoverScrollTimer = setInterval(() => {
      if (!categoryFilters) return;
      categoryFilters.scrollLeft += speed;
      updateFilterScrollButtons();
    }, 16);
  }
  function stopHoverScroll() {
    if (hoverScrollTimer) {
      clearInterval(hoverScrollTimer);
      hoverScrollTimer = null;
    }
  }

  if (categoryFiltersWrap) {
    categoryFiltersWrap.addEventListener("mousemove", (e) => {
      const rect = categoryFiltersWrap.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const edgeThreshold = 36;
      const maxScroll = categoryFilters.scrollWidth - categoryFilters.clientWidth;

      if (x < edgeThreshold && categoryFilters.scrollLeft > 0) {
        const speed = -Math.max(2, Math.round((edgeThreshold - x) / 7));
        stopHoverScroll();
        startHoverScroll(speed);
      } else if (x > rect.width - edgeThreshold && categoryFilters.scrollLeft < maxScroll - 1) {
        const speed = Math.max(2, Math.round((x - (rect.width - edgeThreshold)) / 7));
        stopHoverScroll();
        startHoverScroll(speed);
      } else {
        stopHoverScroll();
      }
    });

    categoryFiltersWrap.addEventListener("mouseleave", stopHoverScroll);
  }

  // 3. Scroll buttons hover & click
  if (chipScrollLeft) {
    chipScrollLeft.addEventListener("mouseenter", () => startHoverScroll(-4));
    chipScrollLeft.addEventListener("mouseleave", stopHoverScroll);
    chipScrollLeft.addEventListener("click", () => {
      categoryFilters.scrollBy({ left: -110, behavior: "smooth" });
      setTimeout(updateFilterScrollButtons, 200);
    });
  }

  if (chipScrollRight) {
    chipScrollRight.addEventListener("mouseenter", () => startHoverScroll(4));
    chipScrollRight.addEventListener("mouseleave", stopHoverScroll);
    chipScrollRight.addEventListener("click", () => {
      categoryFilters.scrollBy({ left: 110, behavior: "smooth" });
      setTimeout(updateFilterScrollButtons, 200);
    });
  }

  categoryFilters.addEventListener("scroll", updateFilterScrollButtons, { passive: true });
  window.addEventListener("resize", updateFilterScrollButtons);

  setTimeout(updateFilterScrollButtons, 100);
}

// ── Instant Search Logic ──────────────────────────────────────────────────────
if (sessionSearchInput) {
  sessionSearchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value || "";
    if (searchClearBtn) {
      if (searchQuery.length > 0) {
        searchClearBtn.classList.remove("hidden");
      } else {
        searchClearBtn.classList.add("hidden");
      }
    }
    if (currentAnalytics) {
      renderSessions(currentAnalytics.recentSessions);
    }
  });
}

if (searchClearBtn) {
  searchClearBtn.addEventListener("click", () => {
    searchQuery = "";
    if (sessionSearchInput) {
      sessionSearchInput.value = "";
      sessionSearchInput.focus();
    }
    searchClearBtn.classList.add("hidden");
    if (currentAnalytics) {
      renderSessions(currentAnalytics.recentSessions);
    }
  });
}

// ── 1-Click Copy Standup Summary ──────────────────────────────────────────────
function generateStandupSummary(analytics) {
  const dateFormatted = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });

  if (!analytics || (!analytics.totalActiveSeconds && (!analytics.recentSessions || analytics.recentSessions.length === 0))) {
    return `### LifeMirror Focus Reflection – ${dateFormatted}\nNo browsing activity recorded today yet.`;
  }

  const totalStr = formatDuration(analytics.totalActiveSeconds || 0);
  const domainsCount = Object.keys(analytics.domains || {}).length;
  const switches = analytics.contextSwitches || 0;

  let text = `### LifeMirror Focus Reflection – ${dateFormatted}\n`;
  text += `**Total Focus Time**: ${totalStr} across ${domainsCount} site${domainsCount === 1 ? "" : "s"} (${switches} switches)\n\n`;

  // Aggregate category times
  const catTimes = {};
  if (analytics.domains) {
    Object.values(analytics.domains).forEach((d) => {
      const cat = d.tag || "🌐 Other";
      catTimes[cat] = (catTimes[cat] || 0) + (d.seconds || 0);
    });
  }

  const sortedCats = Object.entries(catTimes).sort((a, b) => b[1] - a[1]);
  if (sortedCats.length > 0) {
    text += `**Focus by Category**:\n`;
    sortedCats.forEach(([cat, sec]) => {
      text += `• ${cat}: ${formatDuration(sec)}\n`;
    });
    text += `\n`;
  }

  // Top pages/articles (de-duplicated)
  if (analytics.recentSessions && analytics.recentSessions.length > 0) {
    text += `**Key Pages & Workstreams**:\n`;
    const seenTitles = new Set();
    const keyPages = [];
    analytics.recentSessions.forEach((s) => {
      if (s.title && !seenTitles.has(s.title)) {
        seenTitles.add(s.title);
        keyPages.push(s);
      }
    });

    keyPages.slice(0, 8).forEach((p) => {
      const dom = p.domain ? ` (${p.domain})` : "";
      const dur = p.duration ? ` [${formatDuration(p.duration)}]` : "";
      text += `• ${p.title}${dom}${dur}\n`;
    });
  }

  return text.trim();
}

if (copySummaryBtn) {
  let isCopying = false;
  copySummaryBtn.addEventListener("click", async () => {
    if (isCopying) return;
    const summary = generateStandupSummary(currentAnalytics);
    try {
      isCopying = true;
      await navigator.clipboard.writeText(summary);
      const textEl = copySummaryBtn.querySelector("#copy-summary-text");
      if (textEl) textEl.textContent = "✔ Copied!";
      copySummaryBtn.classList.add("copied");
      setTimeout(() => {
        if (textEl) textEl.textContent = "Copy Standup Summary";
        copySummaryBtn.classList.remove("copied");
        isCopying = false;
      }, 2000);
    } catch (err) {
      console.warn("[LifeMirror] Copy summary error:", err);
      isCopying = false;
    }
  });
}

// ── Clear Local Browser Data ──────────────────────────────────────────────────
// Two-step confirm: avoids window.confirm() which is blocked in MV3 side panels on some builds.
let _clearDataConfirmTimer = null;
clearDataBtn.addEventListener("click", async () => {
  if (clearDataBtn.dataset.confirming === "true") {
    // Second click within 3s → execute clear
    clearTimeout(_clearDataConfirmTimer);
    clearDataBtn.dataset.confirming = "false";
    const span = clearDataBtn.querySelector("span");
    if (span) span.textContent = "Clear 48h Browser History";
    await chrome.runtime.sendMessage({ action: "clear_local_data" });
    loadData();
  } else {
    // First click → arm confirmation state
    clearDataBtn.dataset.confirming = "true";
    const span = clearDataBtn.querySelector("span");
    if (span) span.textContent = "⚠ Click Again to Confirm Clear";
    _clearDataConfirmTimer = setTimeout(() => {
      clearDataBtn.dataset.confirming = "false";
      const s = clearDataBtn.querySelector("span");
      if (s) s.textContent = "Clear 48h Browser History";
    }, 3000);
  }
});

let loadDataSeq = 0;

// ── Main Data Loading & Sync ──────────────────────────────────────────────────
async function loadData() {
  const currentSeq = ++loadDataSeq;
  try {
    // 0. Update friendly date label (compact to fit sidepanel header cleanly)
    if (dateLabel) {
      const dateFormatted = new Date().toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short"
      });
      dateLabel.textContent = dateFormatted;
      dateLabel.title = `Focus activity for ${dateFormatted}`;
    }

    // 1. Concurrently fetch profile identity, status, and local analytics (zero waterfall)
    const [prof, status, analytics] = await Promise.all([
      chrome.runtime.sendMessage({ action: "get_profile_identity" }).catch(() => null),
      chrome.runtime.sendMessage({ action: "get_status" }).catch(() => null),
      chrome.runtime.sendMessage({ action: "get_today_analytics" }).catch(() => null)
    ]);

    if (currentSeq !== loadDataSeq) return; // Stale sequence guard

    if (prof) {
      myProfileId = prof.profileId;
      myProfileLabel = prof.profileLabel || "Default";
      myBrowserName = prof.browserName || "Chrome";
      if (scopeProfileLabel) {
        scopeProfileLabel.textContent = `${myProfileLabel} (${myBrowserName})`;
      }
    }

    isConnectedToDesktop = Boolean(status && status.connected);
    const isTrackingActive = status ? status.trackingActive !== false : true;
    const vaultError = status ? status.vaultError : null;

    if (isConnectedToDesktop) {
      if (!isTrackingActive) {
        modeBadge.className = "mode-badge mode-paused clickable";
        modeBadgeText.textContent = "Tracking Paused";
        modeBadge.title = "Desktop tracking is paused in LifeMirror Desktop (Click to refresh)";
        if (trackingPausedBanner) trackingPausedBanner.classList.remove("hidden");
      } else {
        modeBadge.className = "mode-badge mode-desktop clickable";
        modeBadgeText.textContent = "Desktop Sync Active";
        modeBadge.title = "Connected to LifeMirror Desktop (Click to refresh)";
        if (trackingPausedBanner) trackingPausedBanner.classList.add("hidden");
      }
      if (desktopBridgeCard) desktopBridgeCard.style.display = "none";
      if (dataManagementCard) dataManagementCard.classList.add("hidden");
    } else if (vaultError === "vault_locked") {
      modeBadge.className = "mode-badge mode-locked clickable";
      modeBadgeText.textContent = "Vault Locked";
      modeBadge.title = "LifeMirror Desktop vault is locked. Click to reconnect after unlocking.";
      if (trackingPausedBanner) trackingPausedBanner.classList.add("hidden");
      if (desktopBridgeCard) {
        desktopBridgeCard.style.display = "flex";
        if (bridgeCardTitle) bridgeCardTitle.textContent = "LifeMirror Vault is Locked";
        if (bridgeCardDesc) bridgeCardDesc.textContent = "LifeMirror Desktop is running, but the database is locked. Open the desktop app to unlock, then click retry.";
        if (reconnectBtnLabel) reconnectBtnLabel.textContent = "Retry Connection";
      }
      if (dataManagementCard) dataManagementCard.classList.remove("hidden");
    } else {
      modeBadge.className = "mode-badge mode-standalone clickable";
      modeBadgeText.textContent = "Standalone Active";
      modeBadge.title = "Click to connect to LifeMirror Desktop client";
      if (trackingPausedBanner) trackingPausedBanner.classList.add("hidden");
      if (desktopBridgeCard) {
        desktopBridgeCard.style.display = "flex";
        if (bridgeCardTitle) bridgeCardTitle.textContent = "Connect to Desktop Client";
        if (bridgeCardDesc) bridgeCardDesc.textContent = "Running LifeMirror Desktop? Connect to sync your active browser dwell time with your encrypted offline vault.";
        if (reconnectBtnLabel) reconnectBtnLabel.textContent = "Connect to Desktop Client";
      }
      if (dataManagementCard) dataManagementCard.classList.remove("hidden");
    }

    if (!isConnectedToDesktop) {
      currentAnalytics = analytics || {
        totalActiveSeconds: 0,
        contextSwitches: 0,
        domains: {},
        hourly: new Array(24).fill(0),
        recentSessions: []
      };

      totalTimeVal.textContent = formatDuration(currentAnalytics.totalActiveSeconds);
      switchesVal.textContent = String(currentAnalytics.contextSwitches || 0);
      domainsCountVal.textContent = String(Object.keys(currentAnalytics.domains || {}).length);
      renderHeatStrip(currentAnalytics.hourly);
    }

    // 2. Hydrate Top Sites and Stream in Parallel
    const targetProfileId = activeProfileScope === "profile" ? myProfileId : null;

    if (isConnectedToDesktop) {
      // Immediately reflect syncing state on both tabs while querying desktop SQLite vault
      showSyncingPlaceholders();

      const summaryPromise = chrome.runtime.sendMessage({
        action: "get_desktop_summary",
        profileId: targetProfileId
      }).then((summaryRes) => {
        if (currentSeq !== loadDataSeq || !summaryRes || summaryRes.error) return;
        totalTimeVal.textContent = formatDuration(summaryRes.totalActiveSeconds || 0);
        switchesVal.textContent = String(summaryRes.contextSwitches || 0);
        domainsCountVal.textContent = String(summaryRes.domainsCount || 0);
        renderHeatStrip(summaryRes.hourly || new Array(24).fill(0));
        currentAnalytics = {
          totalActiveSeconds: summaryRes.totalActiveSeconds || 0,
          contextSwitches: summaryRes.contextSwitches || 0,
          domains: currentAnalytics ? currentAnalytics.domains : {},
          hourly: summaryRes.hourly || new Array(24).fill(0),
          recentSessions: loadedSessions
        };
      }).catch(() => {});

      const topSitesPromise = chrome.runtime.sendMessage({
        action: "get_desktop_top_sites",
        profileId: targetProfileId,
        limit: 5
      }).then((topRes) => {
        if (currentSeq !== loadDataSeq) return;
        if (topRes && Array.isArray(topRes.entries) && topRes.entries.length > 0) {
          lastDesktopTopSites = topRes.entries;
          renderTopDomains(topRes.entries);
          if (currentAnalytics) {
            const mappedDomains = {};
            topRes.entries.forEach((e) => {
              mappedDomains[e.domain] = {
                seconds: e.total_seconds || (e.visit_count * 60) || 60,
                tag: e.tag || "🌐 Other",
                title: e.domain,
                url: `https://${e.domain}`
              };
            });
            currentAnalytics.domains = mappedDomains;
          }
        } else {
          lastDesktopTopSites = null;
          renderTopDomains(currentAnalytics.domains);
        }
      }).catch(() => {
        if (currentSeq !== loadDataSeq) return;
        lastDesktopTopSites = null;
        renderTopDomains(currentAnalytics.domains);
      });

      const sessionsPromise = chrome.runtime.sendMessage({
        action: "get_desktop_sub_sessions",
        profileId: targetProfileId,
        cursor: null,
        limit: 25
      }).then((sessRes) => {
        if (currentSeq !== loadDataSeq) return;
        if (sessRes && Array.isArray(sessRes.items) && sessRes.items.length > 0) {
          loadedSessions = sessRes.items.map((ev) => {
            let domain = ev.context_tag;
            if (!domain && ev.primary_uri) {
              try { domain = new URL(ev.primary_uri).hostname.replace(/^www\./, ""); } catch {}
            }
            return {
              domain: domain || "other",
              url: ev.primary_uri,
              title: ev.title,
              description: ev.metadata,
              tag: ev.context_tag,
              favIconUrl: ev.icon_url,
              timestamp: ev.timestamp,
              duration: 60,
              profile_label: ev.profile_label,
              browser_name: ev.browser_name
            };
          });
          nextCursor = sessRes.nextCursor;
          renderSessions(loadedSessions);
        } else {
          loadedSessions = currentAnalytics.recentSessions;
          nextCursor = null;
          renderSessions(loadedSessions);
        }
      }).catch(() => {
        if (currentSeq !== loadDataSeq) return;
        loadedSessions = currentAnalytics.recentSessions;
        nextCursor = null;
        renderSessions(loadedSessions);
      }).finally(() => {
        if (currentSeq === loadDataSeq && streamDesktopLoader) {
          streamDesktopLoader.classList.add("hidden");
        }
      });

      await Promise.all([summaryPromise, topSitesPromise, sessionsPromise]);
    } else {
      // Offline / Standalone mode fallback
      if (streamDesktopLoader) streamDesktopLoader.classList.add("hidden");
      lastDesktopTopSites = null;
      renderTopDomains(currentAnalytics.domains);
      loadedSessions = currentAnalytics.recentSessions;
      nextCursor = null;
      renderSessions(loadedSessions);
    }

    // 3. Keep active tab hero preview synchronized
    await updateActiveTabPreview();
  } catch (err) {
    console.warn("[LifeMirror SidePanel] Refresh warning:", err);
  }
}

async function fetchMoreSessions() {
  if (isFetchingMore || !nextCursor || !isConnectedToDesktop) return;
  isFetchingMore = true;
  if (loadMoreText) loadMoreText.textContent = "Loading earlier activity from Desktop...";
  if (streamDesktopLoader) streamDesktopLoader.classList.remove("hidden");

  try {
    const targetProfileId = activeProfileScope === "profile" ? myProfileId : null;
    const sessRes = await chrome.runtime.sendMessage({
      action: "get_desktop_sub_sessions",
      profileId: targetProfileId,
      cursor: nextCursor,
      limit: 25
    });

    if (sessRes && Array.isArray(sessRes.items) && sessRes.items.length > 0) {
      const more = sessRes.items.map((ev) => {
        let domain = ev.context_tag;
        if (!domain && ev.primary_uri) {
          try { domain = new URL(ev.primary_uri).hostname.replace(/^www\./, ""); } catch {}
        }
        return {
          domain: domain || "other",
          url: ev.primary_uri,
          title: ev.title,
          description: ev.metadata,
          tag: ev.context_tag,
          favIconUrl: ev.icon_url,
          timestamp: ev.timestamp,
          duration: 60,
          profile_label: ev.profile_label,
          browser_name: ev.browser_name
        };
      });
      loadedSessions = loadedSessions.concat(more);
      nextCursor = sessRes.nextCursor;
      renderSessions(loadedSessions);
    } else {
      nextCursor = null;
      if (loadMoreBtn) loadMoreBtn.classList.add("hidden");
    }
  } catch (err) {
    console.warn("Failed to fetch more sessions:", err);
  } finally {
    isFetchingMore = false;
    if (loadMoreText) loadMoreText.textContent = "↓ Load earlier activity";
    if (streamDesktopLoader) streamDesktopLoader.classList.add("hidden");
  }
}

// ── Scope & Stream Controls ───────────────────────────────────────────────────
if (scopeProfileBtn && scopeAllBtn) {
  scopeProfileBtn.addEventListener("click", () => {
    if (activeProfileScope === "profile") return;
    activeProfileScope = "profile";
    scopeProfileBtn.classList.add("active");
    scopeAllBtn.classList.remove("active");
    nextCursor = null;
    loadedSessions = [];
    if (isConnectedToDesktop) showSyncingPlaceholders(true);
    loadData();
  });

  scopeAllBtn.addEventListener("click", () => {
    if (activeProfileScope === "all") return;
    activeProfileScope = "all";
    scopeAllBtn.classList.add("active");
    scopeProfileBtn.classList.remove("active");
    nextCursor = null;
    loadedSessions = [];
    if (isConnectedToDesktop) showSyncingPlaceholders(true);
    loadData();
  });
}

if (loadMoreBtn) {
  loadMoreBtn.addEventListener("click", () => {
    fetchMoreSessions();
  });
}

let streamObserver = null;
function initStreamObserver() {
  if (!streamSentinel) return;
  if (streamObserver) streamObserver.disconnect();

  streamObserver = new IntersectionObserver((entries) => {
    const entry = entries[0];
    if (entry.isIntersecting && nextCursor && !isFetchingMore && loadedSessions.length < 75) {
      fetchMoreSessions();
    }
  }, { rootMargin: "150px" });

  streamObserver.observe(streamSentinel);
}
initStreamObserver();

if (liveTabPill) {
  liveTabPill.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    liveTabPill.classList.add("hidden");
    loadData();
  });
}

// Event-driven real-time refresh (0 polling overhead)
loadData();

// Auto-refresh when local storage updates (tab switches, sessions logged)
// Debounced to prevent feedback loop: every tab switch writes storage → triggers onChanged → loadData
let _storageRefreshTimer = null;
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  // If ONLY desktop_connected changed, don't trigger a full loadData query storm
  const keys = Object.keys(changes);
  if (keys.length === 1 && keys[0] === "desktop_connected") {
    return;
  }
  clearTimeout(_storageRefreshTimer);
  _storageRefreshTimer = setTimeout(() => {
    const isAtTop = (window.scrollY || document.documentElement.scrollTop || 0) < 30;
    if (isAtTop) {
      loadData();
    } else {
      // User is scrolled down reading past history: zero layout shift!
      if (liveTabPill) liveTabPill.classList.remove("hidden");
    }
  }, 300);
});

// Refresh when user returns to window/tab
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    loadData();
    loadExcludedDomainsList();
  }
});
window.addEventListener("focus", () => {
  loadData();
  loadExcludedDomainsList();
});

// ── Excluded Domains Drawer & Purge Modal Logic ────────────────────────────────
let activePendingDomain = "";
let activePendingIncludeSubdomains = true;

const excludedDrawer = document.getElementById("excluded-drawer");
const excludedToggleBtn = document.getElementById("excluded-domains-toggle-btn");
const closeDrawerBtn = document.getElementById("close-drawer-btn");
const drawerAddForm = document.getElementById("drawer-add-form");
const drawerDomainInput = document.getElementById("drawer-domain-input");
const drawerIncludeSubdomains = document.getElementById("drawer-include-subdomains");
const drawerError = document.getElementById("drawer-error");
const drawerExcludedList = document.getElementById("drawer-excluded-list");

const purgeModal = document.getElementById("purge-modal");
const purgeModalDomainBadge = document.getElementById("purge-modal-domain-badge");
const purgeModalPreview = document.getElementById("purge-modal-preview");
const cancelPurgeBtn = document.getElementById("cancel-purge-btn");
const confirmPurgeBtn = document.getElementById("confirm-purge-btn");

async function loadExcludedDomainsList() {
  if (!drawerExcludedList) return;
  try {
    const res = await chrome.runtime.sendMessage({ action: "get_excluded_domains" });
    const list = (res && res.excludedDomains) || [];
    if (list.length === 0) {
      drawerExcludedList.innerHTML = `<span class="drawer-empty-hint">No domains excluded yet.</span>`;
      return;
    }
    drawerExcludedList.innerHTML = "";
    list.forEach((item) => {
      const el = document.createElement("div");
      el.className = "drawer-item";
      el.innerHTML = `
        <div>
          <span class="drawer-item-domain">${escapeHtml(item.domain)}</span>
          <span class="drawer-item-badge">${item.include_subdomains !== false ? "*.subdomains" : "exact"}</span>
        </div>
        <button class="btn-remove-drawer-item" data-domain="${escapeHtml(item.domain)}" title="Unexclude">✕</button>
      `;
      el.querySelector(".btn-remove-drawer-item").addEventListener("click", async () => {
        await chrome.runtime.sendMessage({ action: "remove_excluded_domain", domain: item.domain });
        loadExcludedDomainsList();
      });
      drawerExcludedList.appendChild(el);
    });
  } catch (err) {
    console.error("Failed to load excluded domains list:", err);
  }
}

if (excludedToggleBtn) {
  excludedToggleBtn.addEventListener("click", () => {
    switchTab("tab-settings");
    loadExcludedDomainsList();
    if (drawerDomainInput) drawerDomainInput.focus();
  });
}

if (closeDrawerBtn && excludedDrawer) {
  closeDrawerBtn.addEventListener("click", () => {
    excludedDrawer.classList.add("hidden");
  });
}

if (drawerAddForm) {
  drawerAddForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (drawerError) drawerError.classList.add("hidden");
    const raw = drawerDomainInput.value.trim();
    if (!raw) return;

    const norm = LifeMirrorDomainRules.normalizeDomain(raw);
    if (!norm.valid || !norm.domain) {
      if (drawerError) {
        drawerError.textContent = norm.error || "Invalid domain";
        drawerError.classList.remove("hidden");
      }
      return;
    }

    openPurgeModal(norm.domain, drawerIncludeSubdomains ? drawerIncludeSubdomains.checked : true);
  });
}

async function openPurgeModal(domain, includeSubdomains = true) {
  activePendingDomain = domain;
  activePendingIncludeSubdomains = includeSubdomains;

  if (purgeModalDomainBadge) {
    purgeModalDomainBadge.textContent = includeSubdomains
      ? `All subdomains (*.${domain})`
      : `Exact site (${domain}) only`;
  }

  if (purgeModalPreview) {
    purgeModalPreview.innerHTML = `Scanning local history...`;
  }

  if (purgeModal) {
    purgeModal.classList.remove("hidden");
  }

  try {
    const preview = await chrome.runtime.sendMessage({
      action: "preview_domain_purge",
      domain,
      includeSubdomains
    });
    if (purgeModalPreview) {
      const count = Math.max(0, parseInt((preview && preview.matchingSessions) || 0, 10));
      const hosts = Array.isArray(preview && preview.matchingHosts) ? preview.matchingHosts : [];

      // Build preview DOM safely (no innerHTML interpolation with dynamic data)
      purgeModalPreview.innerHTML = "";
      const heading = document.createElement("strong");
      heading.textContent = "Existing History Found:";
      purgeModalPreview.appendChild(heading);
      purgeModalPreview.appendChild(document.createElement("br"));
      purgeModalPreview.appendChild(
        document.createTextNode(`• ${count} visit(s) in local browser stream.`)
      );
      if (hosts.length > 0) {
        purgeModalPreview.appendChild(document.createElement("br"));
        const hostsSpan = document.createElement("span");
        hostsSpan.appendChild(document.createTextNode("• Matching hosts: "));
        const code = document.createElement("code");
        code.style.fontSize = "10px";
        code.textContent = hosts.join(", ");
        hostsSpan.appendChild(code);
        purgeModalPreview.appendChild(hostsSpan);
      }
    }
  } catch (err) {
    if (purgeModalPreview) {
      purgeModalPreview.textContent = "Ready to exclude domain.";
    }
  }
}

if (cancelPurgeBtn && purgeModal) {
  cancelPurgeBtn.addEventListener("click", () => {
    purgeModal.classList.add("hidden");
    activePendingDomain = "";
  });
}

if (confirmPurgeBtn) {
  confirmPurgeBtn.addEventListener("click", async () => {
    if (!activePendingDomain) return;
    const choice = document.querySelector('input[name="ext_purge_choice"]:checked')?.value || "purge";
    const purgeHistory = choice === "purge";

    confirmPurgeBtn.disabled = true;
    confirmPurgeBtn.textContent = "Excluding...";

    try {
      await chrome.runtime.sendMessage({
        action: "add_excluded_domain",
        domain: activePendingDomain,
        includeSubdomains: activePendingIncludeSubdomains,
        purgeHistory
      });

      if (drawerDomainInput) drawerDomainInput.value = "";
      if (purgeModal) purgeModal.classList.add("hidden");
      loadData();
      loadExcludedDomainsList();
      updateActiveTabPreview();
    } catch (err) {
      console.error("Failed to exclude domain:", err);
    } finally {
      confirmPurgeBtn.disabled = false;
      confirmPurgeBtn.textContent = "Exclude Domain";
      activePendingDomain = "";
    }
  });
}

// Dismiss modals/drawers on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (purgeModal && !purgeModal.classList.contains("hidden")) {
      purgeModal.classList.add("hidden");
      activePendingDomain = "";
    } else if (excludedDrawer && !excludedDrawer.classList.contains("hidden")) {
      excludedDrawer.classList.add("hidden");
    } else if (aboutDrawer && !aboutDrawer.classList.contains("hidden")) {
      aboutDrawer.classList.add("hidden");
    }
  }
});

// ── Responsive Tab Navigation (Insights, Reflect, Settings) ───────────────
function switchTab(targetTabId, options = {}) {
  const tabs = document.querySelectorAll(".nav-tab");
  const panels = document.querySelectorAll(".tab-panel");

  tabs.forEach((tab) => {
    const isTarget = tab.id === targetTabId;
    tab.classList.toggle("active", isTarget);
    tab.setAttribute("aria-selected", isTarget ? "true" : "false");
    tab.setAttribute("tabindex", isTarget ? "0" : "-1");
    if (isTarget && options.focus) {
      tab.focus();
    }
  });

  panels.forEach((panel) => {
    const isTarget = panel.getAttribute("aria-labelledby") === targetTabId;
    if (isTarget) {
      panel.removeAttribute("hidden");
      panel.classList.add("active");
    } else {
      panel.setAttribute("hidden", "");
      panel.classList.remove("active");
    }
  });

  // Track active tab within active browsing session, defaulting to tab-insights on fresh launches
  if (chrome.storage?.session) {
    chrome.storage.session.set({ active_tab: targetTabId }).catch(() => {});
  } else {
    try { sessionStorage.setItem("active_tab", targetTabId); } catch {}
  }

  if (targetTabId === "tab-settings") {
    loadExcludedDomainsList();
    loadProfileIdentity();
  }
}

function initNavTabs() {
  const tabs = Array.from(document.querySelectorAll(".nav-tab"));
  if (tabs.length === 0) return;

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      switchTab(tab.id);
    });

    tab.addEventListener("keydown", (e) => {
      let nextIndex = index;
      if (e.key === "ArrowRight") {
        nextIndex = (index + 1) % tabs.length;
        e.preventDefault();
      } else if (e.key === "ArrowLeft") {
        nextIndex = (index - 1 + tabs.length) % tabs.length;
        e.preventDefault();
      } else if (e.key === "Home") {
        nextIndex = 0;
        e.preventDefault();
      } else if (e.key === "End") {
        nextIndex = tabs.length - 1;
        e.preventDefault();
      } else {
        return;
      }
      switchTab(tabs[nextIndex].id, { focus: true });
    });
  });

  // Clear legacy stored active_tab so Insights defaults as the 1st tab
  chrome.storage?.local?.remove?.(["active_tab"]).catch(() => {});

  const restoreSessionTab = (tabId) => {
    if (tabId && document.getElementById(tabId)) {
      switchTab(tabId);
    } else {
      switchTab("tab-insights");
    }
  };

  if (chrome.storage?.session) {
    chrome.storage.session.get(["active_tab"]).then((res) => {
      restoreSessionTab(res ? res.active_tab : null);
    }).catch(() => switchTab("tab-insights"));
  } else {
    try {
      restoreSessionTab(sessionStorage.getItem("active_tab"));
    } catch {
      switchTab("tab-insights");
    }
  }
}

// ── Theme Management (Adaptive to Browser / System, with 1-click toggle) ─────
async function initTheme() {
  try {
    const res = await chrome.storage.local.get(["theme_preference"]);
    currentTheme = res.theme_preference || "system";
    applyTheme(currentTheme);
  } catch {
    applyTheme("system");
  }

  // React to OS/Browser color-scheme changes if in system mode (Modern Web Guidance)
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", () => {
    if (currentTheme === "system") {
      applyTheme("system");
    }
  });

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      // Cycle: system (auto) -> light -> dark -> system
      if (currentTheme === "system") {
        currentTheme = "light";
      } else if (currentTheme === "light") {
        currentTheme = "dark";
      } else {
        currentTheme = "system";
      }
      chrome.storage.local.set({ theme_preference: currentTheme });
      applyTheme(currentTheme);
    });
  }

  // Synchronize Settings tab theme buttons
  document.querySelectorAll(".theme-choice-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const selected = btn.getAttribute("data-theme-val");
      if (selected && ["system", "light", "dark"].includes(selected)) {
        currentTheme = selected;
        chrome.storage.local.set({ theme_preference: currentTheme });
        applyTheme(currentTheme);
      }
    });
  });
}

function applyTheme(theme) {
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
    if (themeToggleIcon) themeToggleIcon.textContent = "☀️";
    if (themeToggleText) themeToggleText.textContent = "Light";
    if (themeToggleBtn) themeToggleBtn.title = "Theme: Light (click to cycle)";
  } else if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    if (themeToggleIcon) themeToggleIcon.textContent = "🌙";
    if (themeToggleText) themeToggleText.textContent = "Dark";
    if (themeToggleBtn) themeToggleBtn.title = "Theme: Dark (click to cycle)";
  } else {
    document.documentElement.removeAttribute("data-theme");
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (themeToggleIcon) themeToggleIcon.textContent = isDark ? "🌙" : "☀️";
    if (themeToggleText) themeToggleText.textContent = "Auto";
    if (themeToggleBtn) themeToggleBtn.title = `Theme: Auto (${isDark ? "Dark" : "Light"} system scheme, click to cycle)`;
  }

  // Update active state on Settings tab theme buttons
  document.querySelectorAll(".theme-choice-btn").forEach((btn) => {
    const val = btn.getAttribute("data-theme-val");
    btn.classList.toggle("active", val === theme);
  });
}

// ── Active Tab Live Hero & Inspection (Merged from Popup) ────────────────────
if (activeTabFavicon) {
  activeTabFavicon.onerror = () => {
    activeTabFavicon.onerror = null;
    activeTabFavicon.src = DEFAULT_FAVICON;
  };
}

async function updateActiveTabPreview() {
  if (!activeTabTitle || !activeTabDomain) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      activeTabTitle.textContent = "No active tab detected";
      activeTabDomain.textContent = "---";
      if (activeTabFavicon) activeTabFavicon.src = DEFAULT_FAVICON;
      if (activeTabDesc) activeTabDesc.classList.add("hidden");
      if (tabExclusionWrap) tabExclusionWrap.classList.add("hidden");
      currentActiveDomain = "";
      return;
    }

    if (tab.incognito) {
      activeTabTitle.textContent = "Incognito Tab (Private)";
      activeTabDomain.textContent = "Tracking Paused";
      if (activeTabLink) activeTabLink.removeAttribute("href");
      if (activeTabFavicon) activeTabFavicon.src = DEFAULT_FAVICON;
      if (activeTabDesc) activeTabDesc.classList.add("hidden");
      if (tabExclusionWrap) tabExclusionWrap.classList.add("hidden");
      if (activeTabTagText) activeTabTagText.textContent = "Incognito";
      currentActiveDomain = "";
      return;
    }

    const urlStr = tab.url || "";
    const isWebPage = urlStr.startsWith("http://") || urlStr.startsWith("https://");

    if (isWebPage) {
      activeTabTitle.textContent = tab.title || "Untitled Tab";
      if (activeTabLink) {
        // SEC: Validate protocol before assigning to href to block javascript: URIs
        if (/^https?:\/\//i.test(urlStr)) {
          activeTabLink.href = urlStr;
        } else {
          activeTabLink.removeAttribute("href");
        }
      }
      try {
        const parsed = new URL(urlStr);
        currentActiveDomain = parsed.hostname.replace(/^www\./, "");
        activeTabDomain.textContent = currentActiveDomain;
      } catch {
        currentActiveDomain = urlStr;
        activeTabDomain.textContent = urlStr;
      }

      if (activeTabFavicon) {
        activeTabFavicon.src = tab.favIconUrl || DEFAULT_FAVICON;
      }

      // Check current session from background
      const status = await chrome.runtime.sendMessage({ action: "get_status" });
      if (status && status.connected && status.trackingActive === false) {
        if (activeTabTagText) activeTabTagText.textContent = "⏸ Paused";
        activeTabDomain.textContent = `${currentActiveDomain} (Tracking Paused)`;
        if (activeTabDesc) activeTabDesc.classList.add("hidden");
      } else if (status && status.currentSession) {
        if (status.currentSession.description) {
          activeTabDesc.textContent = `"${status.currentSession.description}"`;
          activeTabDesc.classList.remove("hidden");
        } else {
          activeTabDesc.classList.add("hidden");
        }

        if (status.currentSession.tag && activeTabTagText) {
          activeTabTagText.textContent = status.currentSession.tag;
        }
      }

      // Check domain exclusion status
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
          if (activeTabTagText) activeTabTagText.textContent = "🚫 Excluded";
        } else {
          tabExcludedBadge?.classList.add("hidden");
          btnExcludeActiveTab?.classList.remove("hidden");
        }
      }

      // Update Domain focus time & switches from analytics
      if (currentAnalytics && currentActiveDomain) {
        const domStats = currentAnalytics.domains && currentAnalytics.domains[currentActiveDomain];
        const domSeconds = (domStats && domStats.total_duration_secs) || 0;
        if (activeDomainTime) activeDomainTime.textContent = formatDuration(domSeconds);
        if (todaySwitchesPreview) todaySwitchesPreview.textContent = String(currentAnalytics.contextSwitches || 0);
      }
    } else {
      activeTabTitle.textContent = tab.title || "Internal / System Page";
      activeTabDomain.textContent = urlStr.split("/")[0] || "Excluded Protocol";
      if (activeTabLink) activeTabLink.removeAttribute("href");
      if (activeTabFavicon) activeTabFavicon.src = DEFAULT_FAVICON;
      if (activeTabDesc) activeTabDesc.classList.add("hidden");
      if (tabExclusionWrap) tabExclusionWrap.classList.add("hidden");
      if (activeTabTagText) activeTabTagText.textContent = "Excluded";
      currentActiveDomain = "";
    }
  } catch (err) {
    console.warn("[LifeMirror] Active tab inspection warning:", err);
  }
}

// 1-Click Revise on Active Tab
if (activeTabTagBtn) {
  activeTabTagBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!currentActiveDomain) return;
    openRevisePopover(activeTabTagBtn, currentActiveDomain);
  });
}

// 1-Click Exclude Domain from Active Tab
if (btnExcludeActiveTab) {
  btnExcludeActiveTab.addEventListener("click", () => {
    if (!currentActiveDomain) return;
    openPurgeModal(currentActiveDomain, true);
  });
}

// 1-Click Unexclude Domain from Active Tab
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
      loadExcludedDomainsList();
      loadData();
    } catch (err) {
      console.error("Failed to unexclude domain:", err);
    } finally {
      btnUnexcludeActiveTab.disabled = false;
    }
  });
}

// Real-time tab listeners: update active tab hero without lag
chrome.tabs?.onActivated?.addListener(() => {
  updateActiveTabPreview();
});

chrome.tabs?.onUpdated?.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete" || changeInfo.title || changeInfo.url) {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([currentTab]) => {
      if (currentTab && currentTab.id === tabId) {
        updateActiveTabPreview();
      }
    });
  }
});

// ── About & Resources Drawer & Profile Setup ──────────────────────────────────
async function loadProfileIdentity() {
  try {
    const res = await chrome.runtime.sendMessage({ action: "get_profile_identity" });
    if (res) {
      if (profileBrowserBadge) profileBrowserBadge.textContent = res.browserName || "Browser";
      if (profileLabelInput) profileLabelInput.value = res.profileLabel || "Default";
      myProfileLabel = res.profileLabel || "Default";
      if (scopeProfileLabel) {
        scopeProfileLabel.textContent = `${myProfileLabel} (${res.browserName || "Chrome"})`;
      }
    }
  } catch (err) {
    console.warn("Failed to load profile identity:", err);
  }
}

function toggleAboutDrawer() {
  switchTab("tab-settings");
}

if (aboutToggleBtn) aboutToggleBtn.addEventListener("click", toggleAboutDrawer);
if (closeAboutDrawerBtn) closeAboutDrawerBtn.addEventListener("click", () => switchTab("tab-insights"));
if (footerAboutBtn) footerAboutBtn.addEventListener("click", toggleAboutDrawer);

if (profileSaveBtn && profileLabelInput) {
  profileSaveBtn.addEventListener("click", async () => {
    const newLabel = profileLabelInput.value.trim() || "Default";
    profileSaveBtn.disabled = true;
    try {
      await chrome.runtime.sendMessage({ action: "update_profile_label", label: newLabel });
      myProfileLabel = newLabel;
      if (scopeProfileLabel) {
        scopeProfileLabel.textContent = `${newLabel} (${myBrowserName})`;
      }
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

// ── External Link Handling ────────────────────────────────────────────────────
function initExternalLinks() {
  document.querySelectorAll(".external-link").forEach((link) => {
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

// ── Reconnection Controls ───────────────────────────────────────────────────
if (modeBadge) {
  modeBadge.addEventListener("click", () => {
    triggerReconnectDesktop();
  });
}
if (btnReconnectDesktop) {
  btnReconnectDesktop.addEventListener("click", () => {
    triggerReconnectDesktop();
  });
}

// ── Initialize App ────────────────────────────────────────────────────────────
initNavTabs();
initTheme();
initExternalLinks();
initCategoryFiltersScroll();
loadProfileIdentity();
loadExcludedDomainsList();
updateActiveTabPreview();

