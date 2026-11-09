# Privacy Policy for LifeMirror Companion Tracker

Last updated: November 9, 2026

The LifeMirror Companion Tracker extension is designed to work securely with your local LifeMirror Desktop application. We prioritize your privacy and ensure that your data remains strictly on your device.

## What Data We Collect

The extension collects the following information locally:
- **Active Tab Information:** The URL (sanitized: query parameters and hash fragments stripped), sanitized page title, favicon URL, and timestamp of the web pages you actively visit.
- **Page Meta Summaries:** High-level description snippets (`<meta name="description">` or Open Graph summaries, up to 160 characters) extracted at document idle to provide human-readable session context. The extension never inspects form inputs, passwords, or personal text.

*Note: The extension explicitly filters out internal browser pages and only tracks standard `http://` and `https://` URLs.*

## Excluded Domains & Privacy Protection

- **Domain Exclusion (Blacklist):** Users can permanently exclude sensitive domains (e.g. banking, healthcare, private intranets). Excluded sites are never recorded, summarized, or sent over native messaging.
- **Immediate Discard:** When an excluded site is visited, any in-flight active session is discarded immediately.
- **Historical Data Purge:** Adding an exclusion provides an option to permanently purge past visits and derived summaries from both browser storage and the LifeMirror Desktop vault.
- **URL & Search Query Sanitization:** URLs are stripped of query parameters and hash fragments by default to avoid logging tokens or private identifiers. Major search engine page titles are sanitized to prevent search query leakage.
- **Incognito Isolation:** Incognito tabs and private browsing windows are never tracked.

## How Data Is Stored and Transmitted

**All data stays on your device.** 

The extension uses Chrome's Native Messaging API to transmit your active tab information directly to the LifeMirror Desktop application installed on your local machine.

- **No Cloud Storage:** We do not store your data on any cloud servers, remote databases, or external infrastructure.
- **No Remote Transmission:** Your browsing history and tab activity never leave your computer.

## How Data Is Used

The collected data is used exclusively for the following purpose:
- To build and maintain your personal timeline within your local LifeMirror Desktop application.

## Third-Party Services

This extension does not use any third-party analytics, tracking, or cloud services.

## Data Sharing

We do not share, sell, or rent your data to any third parties. Your data remains completely private and confined to your local machine.

## Data Retention and Deletion

All data remains strictly on-device under your control:
- **Standalone Mode:** Browsing sessions are stored locally in browser storage (`chrome.storage.local`) with an automatic 48-hour rolling purge. Users can manually delete individual reflection cards, purge specific domains (and their historical records) via the Excluded Sites drawer, or wipe all stored history at any time using the 1-click "Clear All Stored Reflection Data" button in the Side Panel.
- **Desktop Companion Mode:** When connected to LifeMirror Desktop, sessions are streamed to your local encrypted SQLite vault on your computer. You can delete or manage this data directly within the LifeMirror Desktop app interface or by removing its local database file.

## Changes to This Policy

If our data practices change, we will update this Privacy Policy and notify users through an extension update or in-app notification. However, our core commitment to keeping your data local and private will not change.

## Contact

If you have any questions or concerns regarding this Privacy Policy:
- Official Website: https://pieapps.github.io/lifemirror-desktop.web/
- GitHub Repository: https://github.com/PieApps/lifemirror-desktop
- Support Email: vrpieapps@gmail.com
