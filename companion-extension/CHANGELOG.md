# LifeMirror Desktop Companion — Changelog

All notable changes to the LifeMirror Desktop Companion browser extension will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

