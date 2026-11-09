# LifeMirror Desktop Companion — Changelog

All notable changes to the LifeMirror Desktop Companion browser extension will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.4.0] — 2026-11-09

### Added
* **Domain Exclusion & Privacy Blacklist System (`domain-rules.js`, `background.js`)**:
  * Complete domain exclusion engine synchronizing between standalone extension storage and LifeMirror Desktop's encrypted SQLCipher database.
  * Hierarchical subdomain matching with user choice: "This site only" or "Include all subdomains".
  * Strict domain normalization: validates inputs with URL parser, strips protocol/port/path/query, lowercases, and rejects bare public suffixes (`.com`, `.co.uk`, `.org`) using an embedded public suffix check to prevent accidental over-blocking.
  * In-flight session abort: Immediately aborts active timers, discards pending Native Messaging frames, and wipes matching records from local 48-hour rolling storage when a domain is excluded.
  * Excluded domains are completely blocked from tracking—zero dwell time, zero page titles, zero URLs, and zero metadata are stored or forwarded over native messaging.
* **URL Sanitization & Search Query Title Masking**:
  * Strips URL query strings (`?token=...`, `?session=...`) and hash fragments (`#...`) before caching or streaming to eliminate sensitive query parameter leaks (OAuth tokens, session identifiers, reset tokens).
  * Automatically masks page titles for major search engines (Google, Bing, DuckDuckGo, Yahoo, Baidu, Yandex, Ecosia, Brave, Qwant, Startpage) to protect private search queries (e.g. `"symptoms of X - Google Search"` becomes `"Google Search"`).
* **Side Panel Excluded Sites Drawer (`sidepanel.html`, `sidepanel.js`, `sidepanel.css`)**:
  * Full-featured "Excluded Sites" slide-out drawer accessible from the side panel header.
  * Instant search and filter across blacklisted domains with real-time count badge.
  * One-click `🚫 Exclude Domain` button directly on every reflection card in the daily activity feed.
  * Interactive Purge Confirmation Modal providing two options:
    1. *Also delete existing history from LifeMirror (recommended)*: Cleans matching historical visits.
    2. *Only stop tracking from now on*: Keeps past timeline records and only blocks future tracking.
  * Reassuring privacy disclosure: clearly reminds users that Chrome's internal browsing history is not touched and that third-party SSO/payment redirects operate on separate domains.
* **Popup Quick-Exclusion Controls (`popup.html`, `popup.js`, `popup.css`)**:
  * Context-aware exclusion toggle button in the extension popup for the currently active browser tab.
  * Visual `"EXCLUDED"` badge with warning shield when visiting a blacklisted site.
* **Offline-Safe Bidirectional Native Sync**:
  * Real-time synchronization over Native Messaging (`sync_excluded_domains` and `get_excluded_domains`).
  * Tombstone-based Last-Writer-Wins (LWW) conflict resolution: exclusions take precedence on timestamp ties, and removals offline are never resurrected upon reconnection.
* **Journal Note Preservation Guarantee**:
  * Personal reflections and notes attached to purged sessions are never deleted; they are preserved as unattached entries in the LifeMirror Desktop vault.

---

## [1.3.0] — 2026-11-09

### Added
* **Multi-Signal Semantic URL & Title Classifier (`background.js`)**:
  * Replaced brittle domain-only matching with a 5-tier semantic heuristic:
    1. **User manual overrides** (`tag_overrides`)
    2. **URL Path semantic regex** (`/docs/`, `/api/`, `/guides/`, `/learn/`, `/tutorials/`, `/pull/`, `/issues/`, etc.)
    3. **Page Title keywords** (`Documentation`, `Docs`, `API Reference`, `Pull Request`, etc.)
    4. **Subdomain / TLD signals** (`docs.*`, `api.*`, `developer.*`, `.dev`, `.edu`)
    5. **Base platform fallbacks** (e.g. `youtube.com`, `slack.com`)
  * Accurately categorizes modern product documentation like `https://antigravity.google/docs/getting-started`, `stripe.com/docs`, and `supabase.com/docs` into `📚 Research & Docs` with zero manual configuration.
* **High-Frequency Browsing Clarity & Noise Filtering**:
  * **Transparent Counter Badge**: Displays `Showing 25 recent • 100 hops today` with hover tooltip explaining that high-frequency visits and dwell times are fully tracked in Top Websites and Hourly Activity above.
  * **Micro-Hop Noise Filter (`background.js`)**: Fast skips (< 3 seconds) increment the Tab Hops counter and domain dwell totals without cluttering the Page Reflections feed with single-second junk cards.
  * **Fast Browsing Guidance Pill (`sidepanel.js`, `sidepanel.css`)**: Reassuring notice at the bottom of the feed explaining why older tabs are consolidated into Top Websites during rapid browsing bursts.
  * **Expanded Storage Buffer**: Expanded rolling session memory buffer from 25 to 50 items.
* **1-Click "Copy Standup Summary" (`sidepanel.html`, `sidepanel.js`)**:
  * One-click action button in side panel header copying a Markdown-formatted daily standup summary to the clipboard.
  * Formats total active focus time, sites visited, context switches, category breakdown, and key pages.
  * Instant feedback with temporary `✔ Copied!` indicator.
* **"NOW" Real-Time Indicator on Hourly Activity Strip (`sidepanel.js`, `sidepanel.css`)**:
  * Distinct cyan indicator pin and pulsing ring marking the user's current hour on the 24-hour activity strip.
* **Delete Single Card on Hover with Full Bidirectional Sync**:
  * Subtle hover delete button (`✕`) on individual reflection cards in the side panel.
  * Deducts duration from active daily totals and domain records in `chrome.storage.local`.
  * Emits native message `{ "event": "delete_tab_activity", "url", "title" }` to propagate deletion directly to the LifeMirror Desktop SQLCipher database (`sub_session_events`).
* **Warm Empty-State Guidance**:
  * Replaced blank placeholders with welcoming, privacy-reassuring empty states and helpful search/filter fallback messages.
* **Instant Live Search & Clickable Page Links**:
  * Multi-field real-time filter across page titles, domains, and meta descriptions.
  * All domain badges and page titles are direct, clickable links with external arrow indicators (`↗`).
* **Tab Fragmentation Guard & Consecutive Session Consolidation (`background.js`)**:
  * Eliminated fragmented short sessions on the same URL caused by multi-stage browser tab updates.
  * Automatic consolidation of consecutive sessions for identical pages.
* **Zero-Setup Standalone Mode (`chrome.storage.local`)**:
  * Extension operates completely out-of-the-box without requiring the LifeMirror Desktop app to be installed or running.
  * Encrypted on-device 48-hour rolling storage with automatic pruning of older activity.
  * Inactivity tracking powered by `chrome.idle` (60-second threshold) to eliminate idle duration inflation when stepping away.
* **Persistent Chrome Side Panel (`sidepanel.html`, `sidepanel.css`, `sidepanel.js`)**:
  * Dedicated full-height dashboard alongside active web browsing.
  * 24-hour **Hourly Focus Rhythm** heat-strip visualizing daily work velocity.
  * **Top Domains** breakdown with animated percentage progress bars.
  * Recent page reflection feed with page titles, active duration, and extracted meta descriptions.
* **Steve Krug "Don't Make Me Think" Usability Innovations**:
  * **Automated Meta Descriptions (`content.js`)**: Extracts `<meta name="description">` and Open Graph snippets so users immediately recognize what they were reading.
  * **Smart Auto-Tags**: Automatically classifies sites into `💻 Development`, `📚 Research & Docs`, `🎬 Media / Learning`, `💬 Communications`, and `☕ Break / Leisure`.
  * **1-Click Easy Revise Popover**: Instant category reclassification directly from the tag pill with zero typing required.
  * **Category Filter Chips**: 1-click filtering of daily browsing stream by intent.
* **Desktop App Native Messaging Sync (`src-tauri/src/native_msg.rs`, `TimelineSidebar.tsx`)**:
  * Enriched native messaging payload streaming page descriptions and category tags directly into the local SQLCipher vault (`sub_session_events.metadata`).
  * Display of page descriptions and category tags in the LifeMirror Desktop S-Curve Timeline details sidebar.
  * Enriched context fed into local Ollama AI reflection prompts for high-fidelity daily journaling.
* **Desktop Bridge & Growth Engine**:
  * Clean standalone status badge with non-intrusive card guiding users to install LifeMirror Desktop for OS/IDE reflection.

---

## [1.2.1] — 2026-11-07

### Changed
* **Streamlined Popup Interface (`popup.html`, `popup.css`, `popup.js`)**:
  * Removed redundant desktop app launcher buttons and ephemeral iframe protocol triggers from the extension popup in favor of context menu shortcuts and automatic background native sync.
  * Cleaned up unused launch bar CSS rules, button DOM elements, and launch cooldown state handling.

---

## [1.2.0] — 2026-11-06

### Added
* **Native Vault State Detection & Live Badge Indicators**:
  * Real-time listener on the native messaging port (`background.js`) to capture SQLite vault status events from LifeMirror Desktop.
  * Dynamic browser toolbar action badges reflecting database states:
    * **`LOCK`** badge (rose red `#e11d48`) when the desktop encrypted vault is locked.
    * **`BUSY`** badge (amber `#f59e0b`) during active database writes or inter-process locks.
    * Automatic badge clearing upon manual reconnection attempts (`ping_native`).
* **Enhanced Flyout Status Diagnostics (`popup.js`)**:
  * Actionable feedback in the companion popup status badge:
    * `"Vault Locked (Open Desktop App)"` when the local database requires user unlocking.
    * `"Vault Busy (Updating DB...)"` during background timeline write locks.
    * Detailed diagnostic reporting for any unexpected vault errors.
  * Extended `get_status` and `ping_native` message responses with `vaultError` state.

---

## [1.1.0] — 2026-11-05

### Added
* **Interactive Cyber-Zen Popup Flyout (`popup.html`, `popup.css`, `popup.js`)**:
  * Modern dark-mode aesthetic styled to match the LifeMirror Desktop application.
  * Live pulse badge indicating connectivity status to the local Native Messaging host (`com.lifemirror.desktop`).
  * Live Active Tab Preview showing current page title, domain name, favicon, and syncing state.
  * User Acknowledgment card highlighting the 100% On-Device & Zero-Cloud mandate and excluded internal protocols.
* **Direct Desktop App Launcher**:
  * 1-Click **"Open LifeMirror App"** button inside the popup invoking the `lifemirror://open` protocol deep-link with debounced cooldown.
  * Direct secondary button to open the web dashboard (`https://pieapps.github.io/lifemirror-desktop.web/`).
* **Toolbar Context Menu (`contextMenus`)**:
  * Right-click shortcut directly on the browser extension icon: **"⚡ Open LifeMirror Desktop"** and **"🌐 Open Web Dashboard"**.
* **Official Resources & Documentation Grid**:
  * Direct links to Official Website, Documentation & Setup Guide, Issue Tracker / Support, and Privacy Policy.
* **Official Social & Community Channels**:
  * Integrated branded tiles for **YouTube** (`@pieapps`), **X / Twitter** (`@pieapps`), **Facebook** (`vrpieapps`), and **GitHub** (`PieApps/lifemirror-desktop`).

### Security & Hardening
* **Strict Manifest V3 CSP Compliance**: Zero inline scripts, zero `eval`, decoupled HTML/CSS/JS.
* **DOM-based XSS Mitigation**: All dynamic strings (tab titles, URLs, hostnames) render strictly via `textContent`.
* **Sender Origin Verification**: Background message listener verifies `sender.id === chrome.runtime.id` to guard against cross-extension spoofing.
* **Protocol Whitelisting**: External link handler explicitly permits only `https:`, `http:`, and `mailto:` schemes.
* **Context Menu Idempotency**: Context menu recreation wrapped in `chrome.contextMenus.removeAll()` to eliminate duplicate ID errors on reload.

### Accessibility (a11y)
* Full WCAG 2.1 AA keyboard support with high-contrast `:focus-visible` outline rings.
* Vestibular motion protection: added `@media (prefers-reduced-motion: reduce)` disabling looping pulse animations.
* Screen reader optimization: `aria-hidden="true"` on decorative icons, `aria-label` attributes on interactive tiles, and `role="status"` / `aria-live="polite"` on dynamic status indicators.
* Broken favicon fallback: automatic fallback to `icons/icon16.png` if an external favicon 404s.

---

## [1.0.1] — 2026-10-29

### Changed
* Updated Chrome Web Store listing copy, user-benefit package summary, and website links.
* Refined native host connection retry logging and disconnect warning handlers.

---

## [1.0.0] — 2026-07-07

### Added
* Initial release of the companion extension.
* Background service worker (`background.js`) capturing active web tabs.
* Chrome Native Messaging bridge (`com.lifemirror.desktop`) transmitting tab events to local SQLite database.
* Tab filtering ignoring internal browser pages (`chrome://*`, `chrome-extension://*`, `about:blank`).

