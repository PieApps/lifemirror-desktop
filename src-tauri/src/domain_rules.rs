use psl::Psl;
use std::net::IpAddr;
use std::str::FromStr;
use thiserror::Error;
use url::Url;

#[derive(Error, Debug, PartialEq, Eq)]
pub enum DomainRuleError {
    #[error("Domain or URL cannot be empty")]
    EmptyInput,
    #[error("Invalid URL or domain format: {0}")]
    InvalidFormat(String),
    #[error("'{0}' is a bare public or multi-tenant hosting suffix and cannot be excluded")]
    PublicSuffix(String),
}

/// Normalizes any user input or URL into a bare hostname.
/// - Strips protocol, credentials, port, path, queries, and hash fragments
/// - Strips trailing dots and leading 'www.'
/// - Rejects bare ICANN TLDs (e.g. 'com', 'co.uk') and private multi-tenant suffixes (e.g. 'github.io', 'vercel.app')
/// - Allows IP addresses and 'localhost'
pub fn normalize_domain(input: &str) -> Result<String, DomainRuleError> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err(DomainRuleError::EmptyInput);
    }

    // Build URL with dummy scheme if not present so Url::parse can handle credentials/ports/paths
    let url_candidate = if trimmed.contains("://") {
        trimmed.to_string()
    } else {
        format!("http://{trimmed}")
    };

    let parsed = Url::parse(&url_candidate).map_err(|e| DomainRuleError::InvalidFormat(e.to_string()))?;
    let host_str = parsed.host_str().ok_or_else(|| DomainRuleError::InvalidFormat("Missing host".into()))?;

    let mut host = host_str.to_lowercase();

    // Strip trailing dots (e.g. "chase.com." -> "chase.com")
    while host.ends_with('.') {
        host.pop();
    }

    // Strip leading "www."
    if let Some(stripped) = host.strip_prefix("www.") {
        host = stripped.to_string();
    }

    if host.is_empty() {
        return Err(DomainRuleError::EmptyInput);
    }

    // Check if it's localhost or an IP address (IPv4 / IPv6)
    if host == "localhost" || IpAddr::from_str(&host).is_ok() {
        return Ok(host);
    }

    // Check if it's a bare public suffix (ICANN or private/multi-tenant)
    if let Some(suffix) = psl::List.suffix(host.as_bytes()) {
        if suffix.as_bytes().eq_ignore_ascii_case(host.as_bytes()) {
            return Err(DomainRuleError::PublicSuffix(host));
        }
    }

    // Additional safeguard for common multi-tenant hosting platforms if not in local PSL build
    const EXTRA_PRIVATE_SUFFIXES: &[&str] = &[
        "github.io",
        "vercel.app",
        "blogspot.com",
        "pages.dev",
        "netlify.app",
        "herokuapp.com",
        "gitlab.io",
    ];
    for extra in EXTRA_PRIVATE_SUFFIXES {
        if host.eq_ignore_ascii_case(extra) {
            return Err(DomainRuleError::PublicSuffix(host));
        }
    }

    // Must contain at least one dot unless it was localhost
    if !host.contains('.') {
        return Err(DomainRuleError::InvalidFormat("Domain must contain a valid TLD".into()));
    }

    Ok(host)
}

/// Checks whether candidate_host matches rule_domain according to the Shared Matching Spec.
/// - When include_subdomains is true:
///   host == domain || host.ends_with("." + domain)
/// - When include_subdomains is false:
///   host == domain
/// - IP addresses and localhost only match exactly
pub fn host_matches(candidate_host: &str, rule_domain: &str, include_subdomains: bool) -> bool {
    let cand = candidate_host.trim().to_lowercase();
    let cand = cand.strip_suffix('.').unwrap_or(&cand);
    let cand = cand.strip_prefix("www.").unwrap_or(cand);

    let rule = rule_domain.trim().to_lowercase();
    let rule = rule.strip_suffix('.').unwrap_or(&rule);
    let rule = rule.strip_prefix("www.").unwrap_or(rule);

    if cand == rule {
        return true;
    }

    if !include_subdomains {
        return false;
    }

    // IP addresses and localhost do not have hierarchical subdomains
    if rule == "localhost" || IpAddr::from_str(rule).is_ok() {
        return false;
    }

    cand.ends_with(&format!(".{rule}"))
}

/// Strips query parameters and hash fragments from a URL.
/// Returns only scheme, host, port (if non-standard), and pathname.
pub fn sanitize_url(raw_url: &str) -> String {
    if let Ok(mut parsed) = Url::parse(raw_url) {
        parsed.set_query(None);
        parsed.set_fragment(None);
        let _ = parsed.set_username("");
        let _ = parsed.set_password(None);
        parsed.to_string()
    } else {
        // Fallback: strip after '?' and '#' manually if not a valid full URL
        let mut clean = raw_url;
        if let Some((base, _)) = clean.split_once('?') {
            clean = base;
        }
        if let Some((base, _)) = clean.split_once('#') {
            clean = base;
        }
        clean.to_string()
    }
}

/// Sanitizes page titles for search engines to prevent query terms from leaking.
pub fn sanitize_page_title(host: &str, raw_title: &str) -> String {
    let h = host.to_lowercase();
    let h = h.strip_prefix("www.").unwrap_or(&h);

    if h == "google.com" || h.starts_with("google.") {
        return "Google Search".to_string();
    }
    if h == "duckduckgo.com" {
        return "DuckDuckGo Search".to_string();
    }
    if h == "bing.com" || h.starts_with("bing.") {
        return "Bing Search".to_string();
    }
    if h == "search.yahoo.com" || h == "yahoo.com" {
        return "Yahoo Search".to_string();
    }
    if h == "baidu.com" || h.starts_with("baidu.") {
        return "Baidu Search".to_string();
    }
    if h == "ecosia.org" {
        return "Ecosia Search".to_string();
    }
    if h == "yandex.com" || h == "yandex.ru" {
        return "Yandex Search".to_string();
    }
    if h == "search.brave.com" || h == "brave.com" {
        return "Brave Search".to_string();
    }
    if h == "startpage.com" || h.ends_with(".startpage.com") {
        return "Startpage Search".to_string();
    }
    if h == "kagi.com" {
        return "Kagi Search".to_string();
    }
    if h == "qwant.com" || h.ends_with(".qwant.com") {
        return "Qwant Search".to_string();
    }

    raw_title.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;
    use std::fs;
    use std::path::PathBuf;

    #[derive(Deserialize)]
    struct NormalizationVector {
        input: String,
        expected: Option<String>,
        valid: bool,
    }

    #[derive(Deserialize)]
    struct MatchingVector {
        rule_domain: String,
        include_subdomains: bool,
        candidate_host: String,
        expected_match: bool,
    }

    #[derive(Deserialize)]
    struct UrlSanitizationVector {
        raw_url: String,
        expected_url: String,
    }

    #[derive(Deserialize)]
    struct SearchEngineVector {
        host: String,
        raw_title: String,
        expected_title: String,
    }

    #[derive(Deserialize)]
    struct TestVectors {
        normalization_vectors: Vec<NormalizationVector>,
        matching_vectors: Vec<MatchingVector>,
        url_sanitization_vectors: Vec<UrlSanitizationVector>,
        search_engine_vectors: Vec<SearchEngineVector>,
    }

    #[test]
    fn test_domain_rules_vectors() {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let vectors_path = manifest_dir.parent().unwrap().join("shared/domain-rules-vectors.json");
        let content = fs::read_to_string(&vectors_path).expect("Failed to read shared test vectors");
        let vectors: TestVectors = serde_json::from_str(&content).expect("Failed to parse test vectors");

        // 1. Test normalization vectors
        for v in vectors.normalization_vectors {
            let res = normalize_domain(&v.input);
            if v.valid {
                assert!(res.is_ok(), "Expected valid for '{}', got error: {:?}", v.input, res.err());
                assert_eq!(res.unwrap(), v.expected.unwrap(), "Mismatch for input '{}'", v.input);
            } else {
                assert!(res.is_err(), "Expected error for invalid input '{}', got {:?}", v.input, res.ok());
            }
        }

        // 2. Test matching vectors
        for m in vectors.matching_vectors {
            let matches = host_matches(&m.candidate_host, &m.rule_domain, m.include_subdomains);
            assert_eq!(
                matches, m.expected_match,
                "Mismatch matching candidate '{}' with rule '{}' (subdomains={})",
                m.candidate_host, m.rule_domain, m.include_subdomains
            );
        }

        // 3. Test URL sanitization vectors
        for u in vectors.url_sanitization_vectors {
            let sanitized = sanitize_url(&u.raw_url);
            assert_eq!(sanitized, u.expected_url, "Mismatch sanitizing URL '{}'", u.raw_url);
        }

        // 4. Test search engine title vectors
        for s in vectors.search_engine_vectors {
            let title = sanitize_page_title(&s.host, &s.raw_title);
            assert_eq!(title, s.expected_title, "Mismatch for search engine '{}'", s.host);
        }
    }
}
