/**
 * LifeMirror Content Script
 * Extracts high-level page description (meta/og) for local-first reflection.
 * 100% on-device, strictly privacy-preserving (no forms, inputs, or sensitive tokens).
 */

(function () {
  // Incognito isolation is enforced by "incognito": "not_allowed" in manifest.json.
  // No code-level guard needed here — the content script is never injected in private windows.

  function getMetaDescription() {
    try {
      const selectors = [
        'meta[name="description"]',
        'meta[property="og:description"]',
        'meta[name="twitter:description"]',
        'meta[itemprop="description"]'
      ];

      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          const content = el.getAttribute("content");
          if (content && typeof content === "string") {
            const cleaned = content
              .replace(/[\x00-\x1F\x7F\u202A-\u202E\u2066-\u2069]/g, " ")
              .trim()
              .replace(/\s+/g, " ");
            if (cleaned.length > 0) {
              return cleaned.slice(0, 160);
            }
          }
        }
      }
    } catch {
      // Ignore DOM access issues
    }
    return null;
  }

  function sanitizeUrl(urlStr) {
    try {
      const u = new URL(urlStr);
      u.username = "";
      u.password = "";
      return `${u.protocol}//${u.host}${u.pathname}`;
    } catch {
      let clean = (urlStr || "").split("?")[0].split("#")[0];
      const slashIdx = clean.indexOf("://");
      const atIdx = clean.indexOf("@");
      if (slashIdx !== -1 && atIdx !== -1 && atIdx > slashIdx) {
        clean = clean.slice(0, slashIdx + 3) + clean.slice(atIdx + 1);
      }
      return clean;
    }
  }

  function reportMeta() {
    const desc = getMetaDescription();
    if (desc) {
      try {
        chrome.runtime.sendMessage({
          action: "page_meta",
          url: sanitizeUrl(window.location.href),
          description: desc
        });
      } catch {
        // Context might be invalidated on extension reload
      }
    }
  }

  // Report once document is ready
  if (document.readyState === "complete" || document.readyState === "interactive") {
    reportMeta();
  } else {
    window.addEventListener("DOMContentLoaded", reportMeta, { once: true });
  }

  // Allow background script to query directly if needed
  chrome.runtime.onMessage.addListener((req, _sender, sendResponse) => {
    if (req && req.action === "get_meta") {
      sendResponse({ description: getMetaDescription() });
    }
  });
})();

