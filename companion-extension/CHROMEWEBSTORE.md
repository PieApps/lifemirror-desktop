# Chrome Web Store Listing — LifeMirror Desktop Companion

> Last Updated: 2026-11-10

---

## 1. Store Listing Tab

### Extension Name
LifeMirror Desktop

### Short Description / Package Summary (Max 132 characters)
Companion for LifeMirror Desktop. Privately reflects active browsing time, smart tags, and page summaries to your local timeline.

### Detailed Description (Plain Text / CWS Format)
LifeMirror Desktop Companion brings mindful, private productivity reflection directly to your browser and local desktop.

Built on Steve Krug's "Don't Make Me Think" usability principles, it provides instant clarity on where your time goes without requiring you to decipher cryptic URLs or configure cloud accounts.

KEY FEATURES
• Standalone Zero-Setup Reflection: Works immediately out of the box with zero external configuration. View your daily focus rhythm, top domains, and active browsing stream directly inside Chrome.
• Dedicated Chrome Side Panel: Keep your daily reflection open side-by-side as you work without interrupting your browsing flow.
• Domain Exclusion & Blacklisting: Excluded sites are never recorded. Permanently blacklist sensitive websites (banking, healthcare, private portals). Purge existing history in 1 click and sync bidirectionally with LifeMirror Desktop.
• URL & Search Query Sanitization: Strips query parameters and hash fragments (e.g. auth tokens, reset codes) from URLs by default. Sanitizes major search engine titles to prevent search query leakage.
• Automated Meta Descriptions: Extracts page summaries (<meta name="description">) so you immediately remember what you were reading without mental effort.
• Smart Auto-Tags & 1-Click Revise: Automatically categorizes sites into Development, Research & Docs, Media / Learning, Communications, and Leisure. Reclassify any site in 1 click with zero typing.
• Accurate Inactivity Tracking: Uses idle detection to automatically pause focus accumulation when you step away from your computer.
• 100% On-Device & Zero-Cloud: All browsing data is stored in your local browser storage with an automatic 48-hour rolling purge. Zero analytics, zero telemetry.
• Optional Desktop Sync: Connect LifeMirror Desktop anytime to unify your browser tabs with your IDE, terminal, and desktop applications into an encrypted offline timeline powered by local Ollama AI.

DUAL OPERATION MODES
1. Standalone Mode: Fully functional in-browser experience. View hourly focus rhythms, top domain progress bars, and recent sessions directly in the Chrome Side Panel or popup.
2. Desktop Companion Mode: When LifeMirror Desktop is running, streams enriched tab metadata directly to your encrypted on-device LifeMirror Desktop vault over a secure local channel.

SUPPORTED TABS & BROWSING SCOPE
• Supported Tabs: Standard web URLs (http:// and https://) actively visited and focused by the user.
• Excluded Sites & Domains: Excluded sites are never recorded. Domains on your exclusion list (including subdomains) are ignored completely, discarded from memory, and never stored or sent.
• Ignored Pages: Internal browser configuration pages (chrome://*, chrome-extension://*, edge://*, about:blank, devtools://*), file system URLs (file://*), and non-web protocol pages are strictly ignored.
• Active-Only Focus: Only logs the currently focused tab in the active window; inactive background tabs and idle windows are never queried.

HOW TO USE
1. Install this extension from the Chrome Web Store.
2. Click the LifeMirror icon to view your active tab reflection and click "Open Side Panel Reflection" to view your daily stream.
3. Use the "Excluded Sites" drawer or the 🚫 icon on any reflection card to permanently blacklist sensitive websites.
4. (Optional) Download LifeMirror Desktop from https://pieapps.github.io/lifemirror-desktop.web/ for full-system offline reflection.

PRIVACY & ZERO-CLOUD MANDATE
We believe your browsing history belongs to you alone:
• Excluded Sites Are Never Recorded: Blacklisted domains are discarded in real time.
• Zero Remote Servers: No telemetry, no cloud synchronization, no third-party analytics.
• Direct Local Pipe: Data flows strictly between Chrome and the local LifeMirror desktop app via a secure on-device pipe.
• Full Data Ownership: All history is stored in your local encrypted SQLite database on your device, controllable and deletable at any time from the LifeMirror Desktop UI.

SUPPORT & LINKS
• Official Website: https://pieapps.github.io/lifemirror-desktop.web/
• GitHub Repository: https://github.com/PieApps/lifemirror-desktop
• Issue Tracker & Support: https://github.com/PieApps/lifemirror-desktop/issues
• Contact Email: vrpieapps@gmail.com
• YouTube: https://www.youtube.com/@pieapps
• X (Twitter): https://x.com/pieapps
• Facebook: https://www.facebook.com/vrpieapps

---

### Category
Productivity

### Single Purpose (For Developer Console / Review Team)
Privately visualizes active browsing focus rhythms and page summaries in a local side panel and syncs with the user's on-device LifeMirror timeline.

### Primary Language
English

---

## 2. Graphics & Assets Tab

| Asset | Dimensions | Status | Filename / Notes |
|-------|-----------|--------|------------------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `icons/icon128.png` |
| Small Icon | 16×16 PNG | ✅ Ready | `icons/icon16.png` |
| Medium Icon | 48×48 PNG | ✅ Ready | `icons/icon48.png` |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ Recommended | Persistent Chrome Side Panel showing 24h Hourly Focus Rhythm strip, Top Domains, and page reflections |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Recommended | Side Panel "Excluded Sites" slide-out drawer showing blacklist management and 1-click purge confirmation |
| Screenshot 3 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Recommended | Extension popup showing active tab reflection, smart tag revise popover, and quick-exclusion toggle |
| Screenshot 4 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Recommended | LifeMirror Desktop timeline displaying synced web tab cards alongside desktop app sessions |
| Small Promo Tile [OPTIONAL] | 440×280 | ⬜ Optional | Promo graphic with LifeMirror branding |
| Marquee Tile [OPTIONAL] | 1400×560 | ⬜ Optional | Wide banner graphic |

---

## 3. Privacy Tab

### Single Purpose Justification
LifeMirror Desktop Companion operates with a single, dedicated purpose: privately recording, categorizing, and visualizing active browser focus time and page summaries within a local side panel reflection dashboard, and piping that activity locally to the user's installed LifeMirror Desktop application to populate their private on-device timeline.

### Permissions Justification

| Permission | Type | Justification for Reviewer |
|------------|------|---------------------------|
| `tabs` | permissions | Required to read the URL, window title, and favicon of the actively focused web tab when navigating or switching tabs, allowing the user's local LifeMirror timeline and side panel to accurately reflect browsing sessions. |
| `nativeMessaging` | permissions | Required to establish a secure, local-only communication channel with the locally installed LifeMirror Desktop native messaging host (`com.lifemirror.desktop`) without transmitting data over the network. |
| `contextMenus` | permissions | Required to provide a quick right-click shortcut on the extension toolbar icon allowing users to launch the desktop app or web dashboard directly. |
| `storage` | permissions | Required to store rolling 48-hour local browsing sessions, user-configured domain exclusion lists (blacklist), custom category tag revisions, and daily focus statistics locally on-device (`chrome.storage.local`). Never synced to the cloud. |
| `sidePanel` | permissions | Required to render the persistent LifeMirror Companion Side Panel dashboard (`sidepanel.html`), displaying the user's 24-hour hourly focus rhythm, top domains breakdown, search filters, and real-time reflection feed alongside active browsing. |
| `idle` | permissions | Required to detect user inactivity (with a 60-second idle threshold via `chrome.idle`), automatically pausing active tab duration accumulation when the user steps away from their computer to eliminate inflated focus metrics. |
| `http://*/*` and `https://*/*` | content_scripts (host match) | Injected at `document_idle` (`content.js`) exclusively to extract standard high-level page summary metadata (`<meta name="description">` or Open Graph description tags up to 160 characters) on active pages. This gives users immediate, human-readable context for their browsing sessions without manual logging. It never inspects form inputs, passwords, or personal text, and strictly does not run in incognito tabs. |

### Data Usage Disclosures

**Does the extension collect user data?** Yes (Local only)

| Data Category | Collected? | Transmitted Off-Device? | Purpose | Shared with 3rd Parties? |
|---------------|------------|------------------------|---------|--------------------------|
| Personally identifiable info | No | No | N/A | No |
| Health info | No | No | N/A | No |
| Financial info | No | No | N/A | No |
| Authentication info | No | No | N/A | No |
| Personal communications | No | No | N/A | No |
| Location | No | No | N/A | No |
| Web history | **Yes** | **No** (Local only) | To populate personal focus rhythms in the local side panel dashboard and optional local LifeMirror Desktop timeline (with automatic 48-hour rolling purge and domain exclusion). | **No** |
| User activity | **Yes** | **No** (Local only) | To detect active tab navigation, window focus events, and user idle state locally to accurately measure focused browsing duration. | **No** |
| Website content | **Yes (Local only)** | **No** | To extract high-level page summary metadata (`<meta name="description">` or Open Graph description tags up to 160 characters) at document idle to show readable session context in local reflection cards. | **No** |

### Data Use Certifications
- [x] Data is NOT sold to third parties.
- [x] Data is NOT used or transferred for purposes unrelated to the item's core functionality.
- [x] Data is NOT used or transferred to determine creditworthiness or for lending purposes.

### Privacy Policy URL
https://pieapps.github.io/lifemirror-desktop.web/

*(Or direct repository document: https://github.com/PieApps/lifemirror-desktop/blob/main/companion-extension/PRIVACY_POLICY.md)*

---

## 4. Distribution Tab

- **Visibility**: Public
- **Regions**: All regions (Worldwide)
- **Pricing**: Free

---

## 5. Developer Info Tab

- **Publisher Name**: PieApps
- **Contact Email**: vrpieapps@gmail.com
- **Homepage URL**: https://pieapps.github.io/lifemirror-desktop.web/
- **Support URL**: https://github.com/PieApps/lifemirror-desktop/issues

---

## 6. Review Notes & Justification for Chrome Review Team

### Reviewer Instructions
1. **Dual Mode & Standalone Testing**: The extension can be tested immediately in standalone mode without installing any external desktop application. Clicking the toolbar icon allows viewing the active tab reflection or opening the dedicated Chrome Side Panel (`sidepanel.html`), which visualizes hourly focus rhythms, top domains, and recent reflection cards stored entirely on-device in `chrome.storage.local`.
2. **Local Desktop Companion Mode**: If the user has installed the LifeMirror Desktop application, the extension connects locally to the native messaging host `com.lifemirror.desktop`. If the host is not found, the extension gracefully continues operating in standalone mode.
3. **Zero Remote Network Transmission**: The extension makes zero outbound HTTP/HTTPS network requests. All tab events and analytics remain strictly on-device.
4. **Tab Scope & Privacy Filtering**: In `background.js`, internal browser pages (`chrome://`, `chrome-extension://`, etc.), incognito tabs, and user-blacklisted domains are strictly filtered out and never recorded.
5. **Content Script Scope**: `content.js` runs at `document_idle` on public pages (`http://*/*` and `https://*/*`) exclusively to read `<meta name="description">` or Open Graph tags (up to 160 characters) to show human-readable context in the side panel. It does not inspect form fields, passwords, or private data, and is disabled in incognito windows.

---

## 7. Version History

| Version | Date | Changes | Status |
|---|---|---|---|
| **1.4.0** | 2026-11-09 | Added full domain exclusion engine with subdomain matching, URL query/hash sanitization, search engine title masking, Side Panel Excluded Sites drawer with 1-click purge, popup exclusion toggle, and bidirectional native sync with tombstone LWW resolution. | Ready for Submission |
| **1.3.0** | 2026-11-09 | Added Chrome Side Panel dashboard with 24-hour Hourly Focus Rhythm heat-strip, Top Domains progress bars, multi-signal semantic URL/title classifier, 1-click standup summary export, micro-hop noise filter, and standalone on-device 48-hour rolling storage. | Archival |
| **1.2.1** | 2026-11-07 | Streamlined popup interface by removing redundant launch action bar in favor of context menu shortcuts and automatic background native sync. | Archival |
| **1.2.0** | 2026-11-06 | Added real-time native messaging vault state detection, toolbar badge alerts (`LOCK` / `BUSY`), and popup diagnostic statuses for locked or busy SQLite vault. | Archival |
| **1.1.0** | 2026-11-05 | Added interactive companion popup flyout, direct app launch CTA, real-time native connection badge, active tab sync preview, official website/resource links, social channels (YouTube, X, Facebook, GitHub), and context menu shortcut. | Archival |
| **1.0.1** | 2026-10-29 | Updated store listing copy, user-benefit package summary, and website links. | Archival |
| **1.0.0** | 2026-07-07 | Initial release. | Archival |
