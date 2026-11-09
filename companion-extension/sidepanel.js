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
const clearDataBtn = document.getElementById("clear-data-btn");
const categoryFilters = document.getElementById("category-filters");
const revisePopover = document.getElementById("revise-popover");
const sessionSearchInput = document.getElementById("session-search-input");
const searchClearBtn = document.getElementById("search-clear-btn");
const sessionsCountBadge = document.getElementById("sessions-count-badge");
const copySummaryBtn = document.getElementById("copy-summary-btn");
const dateLabel = document.getElementById("date-label");

let activeFilter = "all";
let searchQuery = "";
let reviseTargetDomain = null;
let currentAnalytics = null;

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
function renderTopDomains(domainsObj = {}) {
  const entries = Object.entries(domainsObj);
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

  topDomainsList.innerHTML = "";
  filtered.slice(0, 5).forEach(([dom, data]) => {
    const pct = Math.round((data.seconds / totalSeconds) * 100);
    const item = document.createElement("div");
    item.className = "domain-item";
    const safeDom = escapeHtml(dom);
    const safeFavicon = data.favIconUrl && /^https?:\/\//i.test(data.favIconUrl)
      ? escapeHtml(encodeURI(data.favIconUrl))
      : DEFAULT_FAVICON;
    const safeUrl = data.url && /^https?:\/\//i.test(data.url)
      ? escapeHtml(encodeURI(data.url))
      : `https://${safeDom}`;
    item.innerHTML = `
      <div class="domain-info">
        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="domain-name domain-link" title="Open ${safeDom}">
          <img class="domain-favicon" src="${safeFavicon}" alt="">
          <span>${safeDom}</span>
          <span class="link-arrow">↗</span>
        </a>
        <span>${formatDuration(data.seconds)} (${pct}%)</span>
      </div>
      <div class="domain-bar-bg">
        <div class="domain-bar-fill" style="width: ${pct}%"></div>
      </div>
    `;

    const faviconImg = item.querySelector(".domain-favicon");
    if (faviconImg) {
      faviconImg.addEventListener("error", () => {
        faviconImg.src = DEFAULT_FAVICON;
      }, { once: true });
    }

    topDomainsList.appendChild(item);
  });
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

  const totalSwitches = (currentAnalytics && currentAnalytics.contextSwitches) || 0;
  const visibleCount = Math.min(consolidated.length, 25);

  if (sessionsCountBadge) {
    if (totalSwitches > consolidated.length) {
      sessionsCountBadge.textContent = `Showing ${visibleCount} recent • ${totalSwitches} hops today`;
      sessionsCountBadge.title = `Your ${visibleCount} most recent active pages. All ${totalSwitches} tab hops and domain dwell times are tracked in Top Websites & Hourly Activity above.`;
    } else {
      sessionsCountBadge.textContent = `${consolidated.length} item${consolidated.length === 1 ? "" : "s"}`;
      sessionsCountBadge.title = "";
    }
  }

  sessionsStream.innerHTML = "";
  consolidated.slice(0, 25).forEach((session) => {
    const item = document.createElement("div");
    item.className = "session-item";

    const hasDesc = Boolean(session.description && session.description.trim().length > 0);
    const tagLabel = session.tag || "🌐 Other";
    const safeTitle = escapeHtml(session.title || "Untitled Tab");
    const safeDomain = escapeHtml(session.domain || "---");
    const safeDesc = escapeHtml(session.description || "");
    const safeTag = escapeHtml(tagLabel);
    const safeFavicon = session.favIconUrl && /^https?:\/\//i.test(session.favIconUrl)
      ? escapeHtml(encodeURI(session.favIconUrl))
      : DEFAULT_FAVICON;
    const rawUrl = session.url || (session.domain ? `https://${session.domain}` : "");
    const safeUrl = /^https?:\/\//i.test(rawUrl)
      ? escapeHtml(encodeURI(rawUrl))
      : "#";
    const safeTime = formatTimestamp(session.timestamp);

    item.innerHTML = `
      <div class="session-header">
        <div class="session-title-wrap">
          <img class="session-favicon" src="${safeFavicon}" alt="">
          <div style="min-width: 0;">
            <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="session-title-link" title="Open: ${safeTitle}">
              <span>${safeTitle}</span>
              <span class="link-arrow">↗</span>
            </a>
            <div class="session-meta">
              <a href="https://${safeDomain}" target="_blank" rel="noopener noreferrer" class="session-domain-link">${safeDomain}</a>
              ${safeTime ? `<span class="meta-dot">•</span><span class="session-time">${safeTime}</span>` : ""}
              <span class="meta-dot">•</span>
              <span class="session-duration">${formatDuration(session.duration)}</span>
            </div>
          </div>
        </div>
        <div class="session-card-actions">
          <button class="tag-chip-btn" data-domain="${safeDomain}" title="Click to revise category">
            <span>${safeTag}</span>
            <span style="opacity: 0.6; font-size: 8px;">▾</span>
          </button>
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

    sessionsStream.appendChild(item);
  });

  // When high-frequency browsing occurred, convey why older tabs are rolled up
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
    }
  });
});

document.addEventListener("click", (e) => {
  if (!revisePopover.contains(e.target)) {
    revisePopover.classList.add("hidden");
  }
});

// ── Category Filter Logic ─────────────────────────────────────────────────────
categoryFilters.querySelectorAll(".filter-chip").forEach((btn) => {
  btn.addEventListener("click", () => {
    categoryFilters.querySelectorAll(".filter-chip").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = btn.getAttribute("data-cat");
    if (currentAnalytics) {
      renderTopDomains(currentAnalytics.domains);
      renderSessions(currentAnalytics.recentSessions);
    }
  });
});

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
  copySummaryBtn.addEventListener("click", async () => {
    const summary = generateStandupSummary(currentAnalytics);
    try {
      await navigator.clipboard.writeText(summary);
      const originalHtml = copySummaryBtn.innerHTML;
      copySummaryBtn.innerHTML = `<span>✔ Copied!</span>`;
      copySummaryBtn.classList.add("copied");
      setTimeout(() => {
        copySummaryBtn.innerHTML = originalHtml;
        copySummaryBtn.classList.remove("copied");
      }, 2000);
    } catch (err) {
      console.warn("[LifeMirror] Copy summary error:", err);
    }
  });
}

// ── Clear Local Browser Data ──────────────────────────────────────────────────
clearDataBtn.addEventListener("click", async () => {
  if (confirm("Clear local 48-hour browsing reflection history?")) {
    await chrome.runtime.sendMessage({ action: "clear_local_data" });
    loadData();
  }
});

// ── Main Data Loading & Sync ──────────────────────────────────────────────────
async function loadData() {
  try {
    // 0. Update friendly date label
    if (dateLabel) {
      const dateFormatted = new Date().toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric"
      });
      dateLabel.textContent = `${dateFormatted} • Today's In-Browser Stream`;
    }

    // 1. Check desktop connection status
    const status = await chrome.runtime.sendMessage({ action: "get_status" });
    if (status && status.connected) {
      modeBadge.className = "mode-badge mode-desktop";
      modeBadgeText.textContent = "Desktop Sync Active";
      if (desktopBridgeCard) desktopBridgeCard.style.display = "none";
    } else {
      modeBadge.className = "mode-badge mode-standalone";
      modeBadgeText.textContent = "Standalone Active";
      if (desktopBridgeCard) desktopBridgeCard.style.display = "flex";
    }

    // 2. Fetch today's analytics
    const analytics = await chrome.runtime.sendMessage({ action: "get_today_analytics" });
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
    renderTopDomains(currentAnalytics.domains);
    renderSessions(currentAnalytics.recentSessions);
  } catch (err) {
    console.warn("[LifeMirror SidePanel] Refresh warning:", err);
  }
}

// Event-driven real-time refresh (0 polling overhead)
loadData();

// Auto-refresh when local storage updates (tab switches, sessions logged)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local") {
    loadData();
  }
});

// Refresh when user returns to window/tab
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    loadData();
  }
});
window.addEventListener("focus", loadData);

