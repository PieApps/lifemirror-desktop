# Privacy Policy for LifeMirror Companion Tracker

Last updated: July 7, 2026

The LifeMirror Companion Tracker extension is designed to work securely with your local LifeMirror Desktop application. We prioritize your privacy and ensure that your data remains strictly on your device.

## What Data We Collect

The extension collects the following information locally:
- **Active Tab Information:** The URL (sanitized: query parameters and hash fragments stripped), sanitized page title, favicon URL, and timestamp of the web pages you actively visit.

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

Because all data is stored locally within the LifeMirror Desktop application (e.g., in a local SQLite database), you have complete control over it. You can delete your browsing history or clear your timeline directly from the LifeMirror Desktop app interface or by deleting its local database files. The extension itself does not store data persistently.

## Changes to This Policy

If our data practices change, we will update this Privacy Policy and notify users through an extension update or in-app notification. However, our core commitment to keeping your data local and private will not change.

## Contact

If you have any questions or concerns regarding this Privacy Policy:
- Official Website: https://pieapps.github.io/lifemirror-desktop.web/
- GitHub Repository: https://github.com/PieApps/lifemirror-desktop
- Support Email: vrpieapps@gmail.com
