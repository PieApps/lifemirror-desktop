/**
 * LifeMirror Domain Rules & Matching Engine
 * Shared matching spec implementation for Chrome Extension & React UI.
 * Verifiable against shared/domain-rules-vectors.json.
 */

// Common ICANN TLDs, ccTLDs, and multi-tenant hosting platforms to reject as bare rules
const BARE_SUFFIXES = new Set([
  // Generic TLDs
  "com", "org", "net", "edu", "gov", "mil", "int", "io", "ai", "co", "app", "dev", "me", "info", "biz",
  // Common multi-part ccTLDs
  "co.uk", "org.uk", "gov.uk", "ac.uk", "co.in", "net.in", "org.in", "gen.in",
  "com.au", "net.au", "org.au", "edu.au", "gov.au",
  "co.jp", "ne.jp", "or.jp", "ac.jp", "go.jp",
  "co.nz", "net.nz", "org.nz", "govt.nz",
  "com.br", "net.br", "org.br", "gov.br",
  "com.cn", "net.cn", "org.cn", "gov.cn",
  "com.de", "co.za", "co.kr", "com.mx", "com.sg", "com.hk", "com.tw",
  // Private / Multi-tenant hosting domains (reject bare roots to avoid collateral blocking)
  "github.io", "vercel.app", "blogspot.com", "pages.dev", "netlify.app", "herokuapp.com", "gitlab.io", "web.app", "firebaseapp.com"
]);

function isIpAddress(host) {
  // IPv4 regex
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
    return host.split(".").every(num => {
      const n = parseInt(num, 10);
      return n >= 0 && n <= 255;
    });
  }
  // IPv6 check
  return host.includes(":") && !host.includes(".");
}

/**
 * Normalizes user input or a raw URL into a clean bare hostname.
 * @param {string} input 
 * @returns {{ valid: boolean, domain?: string, error?: string }}
 */
function normalizeDomain(input) {
  if (!input || typeof input !== "string") {
    return { valid: false, error: "Domain or URL cannot be empty" };
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return { valid: false, error: "Domain or URL cannot be empty" };
  }

  let hostCandidate = trimmed;
  // If not containing scheme, prepend dummy http:// to let URL parser handle credentials/ports/paths
  const urlCandidate = trimmed.includes("://") ? trimmed : `http://${trimmed}`;

  try {
    const parsed = new URL(urlCandidate);
    hostCandidate = parsed.hostname;
  } catch {
    return { valid: false, error: `Invalid domain format: ${trimmed}` };
  }

  if (!hostCandidate) {
    return { valid: false, error: "Missing hostname" };
  }

  let host = hostCandidate.toLowerCase();

  // Strip trailing dots
  while (host.endsWith(".")) {
    host = host.slice(0, -1);
  }

  // Strip leading www.
  if (host.startsWith("www.")) {
    host = host.slice(4);
  }

  if (!host) {
    return { valid: false, error: "Domain cannot be empty" };
  }

  // Allow localhost and IP addresses
  if (host === "localhost" || isIpAddress(host)) {
    return { valid: true, domain: host };
  }

  // Check bare public/private suffix
  if (BARE_SUFFIXES.has(host)) {
    return { valid: false, error: `'${host}' is a bare public or multi-tenant hosting suffix and cannot be excluded` };
  }

  // Must contain at least one dot
  if (!host.includes(".")) {
    return { valid: false, error: "Domain must contain a valid TLD" };
  }

  return { valid: true, domain: host };
}

/**
 * Checks whether candidateHost matches ruleDomain.
 * @param {string} candidateHost 
 * @param {string} ruleDomain 
 * @param {boolean} [includeSubdomains=true] 
 * @returns {boolean}
 */
function hostMatches(candidateHost, ruleDomain, includeSubdomains = true) {
  if (!candidateHost || !ruleDomain) return false;

  let cand = candidateHost.trim().toLowerCase();
  while (cand.endsWith(".")) cand = cand.slice(0, -1);
  if (cand.startsWith("www.")) cand = cand.slice(4);

  let rule = ruleDomain.trim().toLowerCase();
  while (rule.endsWith(".")) rule = rule.slice(0, -1);
  if (rule.startsWith("www.")) rule = rule.slice(4);

  if (cand === rule) {
    return true;
  }

  if (!includeSubdomains) {
    return false;
  }

  // IP addresses and localhost do not have subdomains
  if (rule === "localhost" || isIpAddress(rule)) {
    return false;
  }

  return cand.endsWith(`.${rule}`);
}

/**
 * Strips query parameters and hash fragments from a URL.
 * @param {string} rawUrl 
 * @returns {string}
 */
function sanitizeUrl(rawUrl) {
  if (!rawUrl) return "";
  try {
    const parsed = new URL(rawUrl);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    // Fallback: manual truncation
    let clean = rawUrl;
    const qIdx = clean.indexOf("?");
    if (qIdx !== -1) clean = clean.slice(0, qIdx);
    const hIdx = clean.indexOf("#");
    if (hIdx !== -1) clean = clean.slice(0, hIdx);
    return clean;
  }
}

/**
 * Sanitizes page titles for search engines to prevent query terms from leaking.
 * @param {string} host 
 * @param {string} rawTitle 
 * @returns {string}
 */
function sanitizePageTitle(host, rawTitle) {
  if (!host) return rawTitle || "";
  let h = host.toLowerCase();
  if (h.startsWith("www.")) h = h.slice(4);

  if (h === "google.com" || h.startsWith("google.")) {
    return "Google Search";
  }
  if (h === "duckduckgo.com") {
    return "DuckDuckGo Search";
  }
  if (h === "bing.com" || h.startsWith("bing.")) {
    return "Bing Search";
  }
  if (h === "search.yahoo.com" || h === "yahoo.com") {
    return "Yahoo Search";
  }
  if (h === "baidu.com" || h.startsWith("baidu.")) {
    return "Baidu Search";
  }
  if (h === "ecosia.org") {
    return "Ecosia Search";
  }
  if (h === "yandex.com" || h === "yandex.ru") {
    return "Yandex Search";
  }

  return rawTitle || "";
}

// Export for ES modules, CommonJS, and Browser window
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    normalizeDomain,
    hostMatches,
    sanitizeUrl,
    sanitizePageTitle,
    BARE_SUFFIXES
  };
}

if (typeof globalThis !== "undefined") {
  globalThis.LifeMirrorDomainRules = {
    normalizeDomain,
    hostMatches,
    sanitizeUrl,
    sanitizePageTitle,
    BARE_SUFFIXES
  };
}

