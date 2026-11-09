/**
 * LifeMirror Domain Rules & Matching Engine
 * Shared matching spec implementation for LifeMirror Desktop UI.
 * Mirrors companion-extension/domain-rules.js and src-tauri/src/domain_rules.rs.
 */

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

function isIpAddress(host: string): boolean {
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
    return host.split(".").every(num => {
      const n = parseInt(num, 10);
      return n >= 0 && n <= 255;
    });
  }
  return host.includes(":") && !host.includes(".");
}

export interface NormalizeResult {
  valid: boolean;
  domain?: string;
  error?: string;
}

export function normalizeDomain(input: string): NormalizeResult {
  if (!input || typeof input !== "string") {
    return { valid: false, error: "Domain or URL cannot be empty" };
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return { valid: false, error: "Domain or URL cannot be empty" };
  }

  let hostCandidate = trimmed;
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

  while (host.endsWith(".")) {
    host = host.slice(0, -1);
  }

  if (host.startsWith("www.")) {
    host = host.slice(4);
  }

  if (!host) {
    return { valid: false, error: "Domain cannot be empty" };
  }

  if (host === "localhost" || isIpAddress(host)) {
    return { valid: true, domain: host };
  }

  if (BARE_SUFFIXES.has(host)) {
    return { valid: false, error: `'${host}' is a bare public or multi-tenant hosting suffix and cannot be excluded` };
  }

  if (!host.includes(".")) {
    return { valid: false, error: "Domain must contain a valid TLD" };
  }

  return { valid: true, domain: host };
}

export function hostMatches(candidateHost: string, ruleDomain: string, includeSubdomains: boolean = true): boolean {
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

  if (rule === "localhost" || isIpAddress(rule)) {
    return false;
  }

  return cand.endsWith(`.${rule}`);
}

export function sanitizeUrl(rawUrl: string): string {
  if (!rawUrl) return "";
  try {
    const parsed = new URL(rawUrl);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    let clean = rawUrl;
    const qIdx = clean.indexOf("?");
    if (qIdx !== -1) clean = clean.slice(0, qIdx);
    const hIdx = clean.indexOf("#");
    if (hIdx !== -1) clean = clean.slice(0, hIdx);
    return clean;
  }
}

