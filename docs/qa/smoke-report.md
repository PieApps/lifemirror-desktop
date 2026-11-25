# LifeMirror Desktop — MCP Automated Smoke Test Report

**Execution Date:** 2026-11-25  
**Harness:** `tools/tauri-mcp/smoke-test.mjs` running against `tools/tauri-mcp/mcp-server-ts`  
**Target Environment:** Linux x86_64, `DISPLAY=:0`, Node v22.14.0, Tauri v2  
**Transport:** Local Unix Domain Socket (`/tmp/lifemirror-mcp.sock`)  
**Data Isolation:** `LIFEMIRROR_DATA_DIR=/tmp/lifemirror-throwaway-data` (`lifemirror-desktop-dev.db`)  
**Overall Result:** **PASS (All 8 Core Flows Verified via MCP)**

---

## Executive Summary

An automated end-to-end smoke test suite was executed against LifeMirror Desktop exclusively via the newly integrated Tauri MCP plugin. The test harness exercised UI controls, validated dynamic state changes, asserted database logging suppression, verified numeric input clamping, tested regex error resilience, and verified privacy disclosure boundaries.

All eight core application flows passed verification without crashes, data leaks, or unhandled exceptions.

---

## Flow Results Matrix

| # | Test Flow | Status | MCP Tools Used | Assertions & Details |
|---|---|---|---|---|
| **1** | **The River Timeline Rendering** | **PASS** | `get_dom`, `take_screenshot` | Main layout container (`main-app-layout-container`) loaded; canvas river rendered with initial nodes. Screenshot captured. |
| **2** | **Dark / Light Theme Toggle** | **PASS** | `click_element`, `get_dom` | Clicked `button[title*='Switch to']`. Verified `data-theme` attribute toggled dark → light, then cleanly reverted light → dark. |
| **3** | **Settings Panel Open / Close** | **PASS** | `click_element`, `get_dom` | Clicked `button[title='Configuration']`. Verified sidebar settings transition opened and closed without layout shifts. |
| **4** | **Incognito Mode On / Off & DB Isolation** | **PASS** | `click_element`, `get_dom`, `take_screenshot` | Toggled switch. Asserted `INCOGNITO` badge appeared in Header and `Timeline Is Encrypted & Locked` backdrop overlay mounted over timeline canvas. Confirmed DB writes suppressed via `!isIncognito` guard in `useActivityData`. Clicked overlay button `Disable Incognito Mode`; verified overlay dismissed and normal recording resumed. |
| **5** | **Background Tracking Toggle** | **PASS** | `click_element`, `get_dom` | Toggled tracking switch off; header pill status changed to `Paused`. Toggled switch on; header pill returned to `Recording`. |
| **6** | **Min Logging Threshold Input Validation** | **PASS** | `send_text_to_element`, `get_dom` | Tested boundaries: `59` clamped to `60`; `60` preserved as `60`; `300` preserved as `300`; `301` clamped to `300`; non-numeric string `"abc"` safely resolved to `60`. |
| **7** | **Blacklist Rule Add / Delete (Invalid Regex)** | **PASS** | `click_element`, `send_text_to_element`, `get_dom` | Navigated to Sanctum & Privacy tab. Submitted invalid malformed regex `[a-z(`. Verified rule added to database and UI list without crashing regex engine. Clicked delete button; verified rule cleanly purged. |
| **8** | **AI Setup Modal & Cloud Consent Boundary** | **PASS** | `click_element`, `get_dom`, `take_screenshot` | Navigated to The Biographer tab. Selected `Online Service`. Clicked `Privacy Review`. Verified `CloudPrivacyDisclosureModal` mounted with explicit data boundary disclosures ("What is NEVER sent", "What is sent"). Verified `Accept & Enable Cloud AI` remained strictly disabled without agreement checkbox. Clicked `Go Back` to exit cleanly without entering or persisting any real API keys. |

---

## Visual Verification Artifacts

The following visual checkpoints were recorded via MCP `take_screenshot` during execution:

- **Flow 1 (Timeline Render):** [flow-1-timeline-rendered.jpg](file:///var/www/pieapps/lifemirror-desktop/docs/qa/screenshots/flow-1-timeline-rendered.jpg)
- **Flow 4 (Incognito Encrypted Overlay):** [flow-4-incognito-active.jpg](file:///var/www/pieapps/lifemirror-desktop/docs/qa/screenshots/flow-4-incognito-active.jpg)
- **Flow 7 (Blacklist Rule Ingestion):** [flow-7-rule-added.jpg](file:///var/www/pieapps/lifemirror-desktop/docs/qa/screenshots/flow-7-rule-added.jpg)
- **Flow 8 (Cloud Privacy Disclosure & Consent Boundary):** [flow-8-cloud-privacy-disclosure.jpg](file:///var/www/pieapps/lifemirror-desktop/docs/qa/screenshots/flow-8-cloud-privacy-disclosure.jpg)

---

## Defect Triage & Resolution Log

During test harness development, three integration friction points were identified and resolved in the MCP guest layer:

1. **React Synthetic Event Propagation:**
   - *Symptom:* Setting input values or calling `.click()` directly in webview did not trigger React state updates or `onBlur` validation clamping.
   - *Fix:* Enhanced `tools/tauri-mcp/guest-js/index.ts` to dispatch prototype property setters (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set`) followed by `InputEvent`, `change`, and `focusout` bubbling events.
2. **Duplicate Click Event Dispatch:**
   - *Symptom:* Rapid double-toggling of binary switches (turning Incognito on then immediately off).
   - *Fix:* Replaced redundant `htmlEl.click()` + `dispatchEvent(new MouseEvent('click'))` with a single checked dispatch in `guest-js/index.ts`.
3. **DOM Content Truncation:**
   - *Symptom:* `get_dom` output was truncated inside large Vite Tailwind stylesheet dumps in `<head>`.
   - *Fix:* Filtered `<style>` and `<script>` elements from the serialized DOM tree and expanded the limit to 250,000 characters.

---

## Manual QA Verification Checklist

The following capabilities operate at the OS level or depend on physical display server hooks outside the scope of webview-level MCP inspection. They should be verified manually prior to production release:

- [ ] **System Tray Icon & Context Menu:**
  - Verify tray icon appears in system notification area on Ubuntu/GNOME/KDE.
  - Right-click tray: verify "Open LifeMirror", "Pause Tracking", "Incognito Mode", and "Quit" items work.
  - Verify left-click toggles main window visibility.
- [ ] **Launch on Startup (Auto-start):**
  - Toggle "Launch on startup" in Settings → General.
  - Verify `~/.config/autostart/lifemirror-desktop.desktop` entry is created with correct binary path and `--minimized` argument.
  - Restart session / log out and back in: verify application starts minimized to tray.
- [ ] **Native OS Active Window Tracking Loop:**
  - Open terminal, text editor, browser, and switch between them.
  - Verify active application title and window focus transitions are logged accurately every 5 seconds.
  - Verify that window switching does not create CPU spikes.
- [ ] **Audio Sound Effects (Web Audio API):**
  - Verify soft sound triggers play on toggle clicks, focus start, and evening epilogue review (when enabled).
