# Chrome Web Store Listing — LifeMirror Companion Tracker

> Last Updated: 2026-07-07

## Store Listing

**Extension Name**
LifeMirror Companion Tracker

**Short Description**
Securely connects your web browsing activity to your local LifeMirror desktop app and leverages on-device AI.

**Detailed Description**
LifeMirror Companion Tracker is the secure bridge between your web browsing and your local LifeMirror desktop application.

Key features:
- Automatically tracks your active web tab to build your personal timeline in the LifeMirror Desktop app.
- 100% Local: Connects exclusively to the LifeMirror native desktop app installed on your machine.

How to use it:
1. Install the LifeMirror Desktop application.
2. Install this companion extension.
3. Browse the web normally. The extension will automatically sync your active tabs to your local LifeMirror timeline.

Privacy Note:
We take your privacy seriously. This extension DOES NOT send your browsing data to any cloud servers, remote databases, or third parties. All data is transmitted directly to your local LifeMirror Desktop application via secure Native Messaging.

Support:
For issues or feedback, please visit our GitHub repository or contact support.

**Category**
Productivity

**Single Purpose**
Syncs active browser tab activity to the local LifeMirror desktop app to build a personal timeline.

**Primary Language**
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon | 128×128 PNG | ✅ Ready | icon128.png |
| Screenshot 1 | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 2 | 1280×800 or 640×400 | ⬜ Not created | |
| Small Promo Tile | 440×280 | ⬜ Not created | |
| Marquee Promo Tile | 1400×560 | ⬜ Not created | |

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| tabs | permissions | Required to read the URL, title, and favicon of the active tab when the user switches tabs or navigates, in order to securely log this activity to their local LifeMirror timeline. |
| nativeMessaging | permissions | Required to establish a secure, local connection with the user's installed LifeMirror Desktop application to send tab activity. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** Yes

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|-----------|-----------|------------------------|---------|---------------------------|
| Personally identifiable info | No | No | | No |
| Health info | No | No | | No |
| Financial info | No | No | | No |
| Authentication info | No | No | | No |
| Personal communications | No | No | | No |
| Location | No | No | | No |
| Web history | Yes | No (Local App Only) | To build a personal timeline in the user's local LifeMirror app. | No |
| User activity | Yes | No (Local App Only) | To track when the user focuses or updates a tab. | No |
| Website content | No | No | | No |

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL**
https://github.com/your-username/lifemirror-desktop/blob/main/companion-extension/PRIVACY_POLICY.md (Update with your actual URL once hosted)

## Distribution

**Visibility**: Public
**Regions**: All regions
**Pricing**: Free

## Developer Info

**Publisher Name**
[Your Name/Organization]

**Contact Email**
[Your Email]

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0.0 | 2026-07-07 | Initial release. | Draft |

## Review Notes

### Known Issues / Limitations
- Native Messaging: The extension requires the LifeMirror Desktop native application to be installed. It securely pipes data to this local host without involving any network requests.
