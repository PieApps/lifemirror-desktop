# Chrome Web Store Listing — LifeMirror Desktop Companion

> Last Updated: 2026-10-28

---

## 1. Store Listing Tab

### Extension Name
LifeMirror Desktop

### Short Description / Package Summary (Max 132 characters)
Companion extension for LifeMirror Desktop. Privately syncs active browser tabs to your personal on-device timeline.

### Detailed Description (Plain Text / CWS Format)
LifeMirror Desktop Companion securely connects your web browsing activity to your local LifeMirror Desktop timeline application.

LifeMirror Desktop is a private, zero-cloud desktop companion that helps you reflect on your digital day, work habits, and time spent across applications. This extension provides seamless active tab awareness to ensure your browsing context is faithfully captured on your local timeline.

KEY FEATURES
• Automatic Tab Sync: Safely detects your active web tab to build a comprehensive personal timeline in LifeMirror Desktop.
• 100% On-Device & Zero-Cloud: All tab data is sent directly to your local computer via Chrome Native Messaging. No data ever touches remote servers or cloud databases.
• Battery & Resource Efficient: Runs quietly as a Manifest V3 background service worker, waking only on tab navigation or focus change.
• Strict Protocol Filtering: Respects user privacy by only monitoring standard web traffic and ignoring internal browser or sensitive pages.

SUPPORTED TABS & BROWSING SCOPE
• Supported Tabs: Standard web URLs (http:// and https://) actively visited and focused by the user.
• Ignored & Excluded Pages: Internal browser configuration pages (chrome://*, chrome-extension://*, edge://*, about:blank, devtools://*), file system URLs (file://*), and non-web protocol pages are strictly ignored.
• Active-Only Focus: Only logs the currently focused tab in the active window; inactive background tabs and idle windows are never queried.

REQUIREMENTS
This companion extension requires the LifeMirror Desktop application installed on your machine to receive and record your timeline events.
• Download LifeMirror Desktop: https://pieapps.github.io/lifemirror-desktop.web/

HOW TO USE
1. Download and install the LifeMirror Desktop application from https://pieapps.github.io/lifemirror-desktop.web/
2. Install this LifeMirror Desktop extension from the Chrome Web Store.
3. Browse the web normally. The extension will automatically log your active web tabs directly into your local LifeMirror timeline.

PRIVACY & ZERO-CLOUD MANDATE
We believe your browsing history belongs to you alone:
• Zero Remote Servers: No telemetry, no cloud synchronization, no third-party analytics.
• Direct Local Pipe: Data flows strictly between Chrome and the local LifeMirror native host binary via Chrome's Native Messaging API.
• Full Data Ownership: All history is stored in your local encrypted SQLite database on your device, controllable and deletable at any time from the LifeMirror Desktop UI.

SUPPORT & LINKS
• Official Website: https://pieapps.github.io/lifemirror-desktop.web/
• GitHub Repository: https://github.com/PieApps/lifemirror-desktop
• Issue Tracker & Support: https://github.com/PieApps/lifemirror-desktop/issues
• Contact Email: vrpieapps@gmail.com

---

### Category
Productivity

### Single Purpose (For Developer Console / Review Team)
Securely syncs active browser tab activity directly to the local LifeMirror Desktop application to build a private, on-device personal timeline.

### Primary Language
English

---

## 2. Graphics & Assets Tab

| Asset | Dimensions | Status | Filename / Notes |
|-------|-----------|--------|------------------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `icon128.png` |
| Small Icon | 16×16 PNG | ✅ Ready | `icon16.png` |
| Medium Icon | 48×48 PNG | ✅ Ready | `icon48.png` |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ Recommended | LifeMirror Desktop timeline displaying synced web tab cards |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Recommended | Extension popup / status showing connected local native host |
| Small Promo Tile [OPTIONAL] | 440×280 | ⬜ Optional | Promo graphic with LifeMirror branding |
| Marquee Tile [OPTIONAL] | 1400×560 | ⬜ Optional | Wide banner graphic |

---

## 3. Privacy Tab

### Single Purpose Justification
LifeMirror Desktop Companion operates with a single, dedicated purpose: piping active browser tab metadata (URL, page title, favicon) via Chrome Native Messaging exclusively to the user's locally installed LifeMirror Desktop application to populate their local timeline.

### Permissions Justification

| Permission | Type | Justification for Reviewer |
|------------|------|---------------------------|
| `tabs` | permissions | Required to read the URL, window title, and favicon of the actively focused web tab when navigating or switching tabs, allowing the user's local LifeMirror timeline to accurately reflect browsing sessions. |
| `nativeMessaging` | permissions | Required to establish a secure, local-only communication channel with the locally installed LifeMirror Desktop native messaging host (`com.lifemirror.desktop`) without transmitting data over the network. |

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
| Web history | **Yes** | **No** (Local App Only) | To populate personal timeline in local LifeMirror Desktop app | **No** |
| User activity | **Yes** | **No** (Local App Only) | To detect active tab navigation & window focus events locally | **No** |
| Website content | No | No | N/A | No |

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
1. **Local Native Host Requirement**: This extension communicates exclusively with the native host `com.lifemirror.desktop` installed by the LifeMirror Desktop application on the user's local machine.
2. **Zero Network Transmission**: The extension makes zero outbound HTTP/HTTPS network requests. All tab events are routed solely through `chrome.runtime.connectNative`.
3. **Tab Scope**: In `background.js`, all internal pages (such as `chrome://` or extensions) are automatically filtered out. Only standard public web protocols (`http://` and `https://`) are reported when active.

---

## 7. Version History

| Version | Date | Changes | Status |
|---|---|---|---|
| **1.0.1** | 2026-10-29 | Updated store listing copy, user-benefit package summary, and website links. | Ready for Submission |
| **1.0.0** | 2026-07-07 | Initial release. | Draft |
