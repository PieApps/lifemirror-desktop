import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "../companion-extension/domain-rules.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { normalizeDomain, hostMatches, sanitizeUrl, sanitizePageTitle } = globalThis.LifeMirrorDomainRules;

const vectorsPath = path.resolve(__dirname, "../shared/domain-rules-vectors.json");
const vectors = JSON.parse(fs.readFileSync(vectorsPath, "utf-8"));

console.log("🧪 Running domain rules vectors test in JavaScript...");

// 1. Normalization vectors
for (const v of vectors.normalization_vectors) {
  const res = normalizeDomain(v.input);
  if (v.valid) {
    if (!res.valid || res.domain !== v.expected) {
      console.error(`❌ Mismatch for input '${v.input}': expected ${v.expected}, got ${JSON.stringify(res)}`);
      process.exit(1);
    }
  } else {
    if (res.valid) {
      console.error(`❌ Expected error for '${v.input}', but got valid domain: ${res.domain}`);
      process.exit(1);
    }
  }
}
console.log(`✅ Passed ${vectors.normalization_vectors.length} normalization vectors`);

// 2. Matching vectors
for (const m of vectors.matching_vectors) {
  const matches = hostMatches(m.candidate_host, m.rule_domain, m.include_subdomains);
  if (matches !== m.expected_match) {
    console.error(`❌ Mismatch matching '${m.candidate_host}' against rule '${m.rule_domain}' (include_subdomains=${m.include_subdomains}): expected ${m.expected_match}, got ${matches}`);
    process.exit(1);
  }
}
console.log(`✅ Passed ${vectors.matching_vectors.length} matching vectors`);

// 3. URL Sanitization vectors
for (const u of vectors.url_sanitization_vectors) {
  const sanitized = sanitizeUrl(u.raw_url);
  if (sanitized !== u.expected_url) {
    console.error(`❌ Mismatch sanitizing URL '${u.raw_url}': expected ${u.expected_url}, got ${sanitized}`);
    process.exit(1);
  }
}
console.log(`✅ Passed ${vectors.url_sanitization_vectors.length} URL sanitization vectors`);

// 4. Search Engine vectors
for (const s of vectors.search_engine_vectors) {
  const title = sanitizePageTitle(s.host, s.raw_title);
  if (title !== s.expected_title) {
    console.error(`❌ Mismatch for search engine '${s.host}': expected ${s.expected_title}, got ${title}`);
    process.exit(1);
  }
}
console.log(`✅ Passed ${vectors.search_engine_vectors.length} search engine vectors`);

console.log("🎉 All shared domain rules vectors PASSED in JavaScript!");
