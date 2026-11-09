/**
 * LifeMirror Content Script
 * Extracts high-level page description (meta/og) for local-first reflection.
 * 100% on-device, strictly privacy-preserving (no forms, inputs, or sensitive tokens).
 */

(function () {
  // Strict Incognito Isolation: Never execute or extract in private browsing contexts
  if (chrome.extension && chrome.extension.inIncognitoContext) {
    return;
  }

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
            const cleaned = content.trim().replace(/\s+/g, " ");
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
      return `${u.protocol}//${u.host}${u.pathname}`;
    } catch {
      return (urlStr || "").split("?")[0].split("#")[0];
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

