# LifeMirror AI Integration Architecture

This document details LifeMirror's AI architecture, supported inference providers, privacy boundaries, and security enforcement mechanisms.

LifeMirror is **private by default and local-first**. It allows users to run models entirely offline on their own hardware, or optionally connect an external cloud inference provider using their own API key (Bring Your Own Key - BYOK) with explicit disclosure and strict data boundaries.

---

## 1. Architecture Overview

All intelligence workloads (daily reflections, interactive chat, resume brief context, intention checking) route through the `InferenceProvider` abstraction defined in `src-tauri/src/inference/mod.rs`.

```mermaid
flowchart TD
    UI[Frontend / React UI] -->|Tauri IPC| CMD[Tauri Commands / Background Loops]
    CMD --> ROUTE[get_inference_provider]
    ROUTE -->|ai_provider = local| OLLAMA[OllamaProvider (src/inference/ollama.rs)]
    ROUTE -->|ai_provider = cloud| CLOUD[CloudProvider (src/inference/cloud.rs)]
    ROUTE -->|ai_provider = off| DORMANT[Dormant Provider (No-Op)]
    
    OLLAMA -->|Loopback HTTP| LOCAL_SRV[Local Ollama (localhost:11434)]
    CLOUD -->|HTTPS POST /v1/chat/completions| WAN[Groq / OpenAI / OpenRouter]
```

### The `InferenceProvider` Trait
```rust
pub trait InferenceProvider: Send + Sync {
    fn is_available(&self) -> Result<bool, Box<dyn std::error::Error>>;
    fn prompt(&self, prompt: &str) -> Result<String, Box<dyn std::error::Error>>;
    fn embed(&self, text: &str) -> Result<Vec<f32>, Box<dyn std::error::Error>>;
}
```

Dynamic dispatch is handled by `get_inference_provider(db: Arc<DbState>)`:
1. Queries `db.get_ai_provider_mode()` which returns the strongly-typed `AiProviderMode` enum (`Local`, `Cloud`, `Off`).
2. If `AiProviderMode::Off`, returns `DisabledProvider` (Zero-Sized Type), which returns `InferenceError::Disabled` with 0 heap allocation and 0 socket traffic.
3. If `AiProviderMode::Cloud`, verifies that `cloud_disclosure_accepted == "true"` and builds a `CloudProvider` using the encrypted `cloud_api_key`, `cloud_base_url`, and `cloud_model`.
4. If `AiProviderMode::Local`, returns `OllamaProvider` pointing to the configured `ollama_url`.

---

## 2. Supported Inference Providers

### A. Local AI: `OllamaProvider` (Default & Recommended)
* **Execution:** Connects over loopback HTTP to a locally running Ollama daemon (`http://localhost:11434`).
* **Privacy:** 100% on-device. Zero telemetry or timeline data leaves the host machine.
* **Cost:** Free forever.
* **Hardware Profile:** Requires ~2.0 GB–4.0 GB disk space per model. Recommended for systems with 16GB+ RAM and/or dedicated GPUs.
* **In-App Model Downloading:** Downloads models (`llama3.2`, `nomic-embed-text`) over Tauri IPC via `/api/pull` with native progress tracking.
* **Fail-Fast Circuit Breaker:** Health check (`/api/version`) probes with a 600ms timeout. If offline, the app immediately enters dormant mode without retry storms.

### B. Cloud AI: `CloudProvider` (Opt-In BYOK)
* **Execution:** Uses standard OpenAI-compatible `/v1/chat/completions` and `/v1/embeddings` specifications via pooled Rust `reqwest::Client` singletons.
* **Privacy:** Gated behind the **Privacy & Data Impact Review** modal requiring explicit user consent.
* **Hardware Profile:** 0 MB download size; runs instantly on any laptop or resource-constrained machine.
* **Supported Presets:**
  * **Groq Cloud:** High-speed inference with generous free-tier access (`llama-3.3-70b-versatile`).
  * **OpenAI:** Direct integration with `gpt-4o-mini` (pay-as-you-go).
  * **OpenRouter:** Access to multiple hosted models (`meta-llama/llama-3.3-70b-instruct:free`).
  * **Custom:** Any self-hosted or proxy endpoint implementing the OpenAI API standard.

---

## 3. Privacy Boundaries & Security Enforcement

When a user opts into Cloud AI, strict defense-in-depth protections are enforced:

### 1. Pre-Inference Data Sanitization (Context Scrubbing)
Before any activity data is bundled into prompt rollups (`compileContextRollup` in `src/hooks/useLocalAI.ts` and background jobs in `src-tauri/src/ai.rs`):
* **Incognito Sessions:** All events tagged `is_incognito: true` are discarded immediately.
* **Domain Exclusion List:** All events matching domains or subdomains on the user's blacklist are stripped.
* **Never Transmitted:** Keystrokes, passwords, clipboard contents, screen captures, raw SQLite database files, and operating system credentials are fundamentally never captured or sent.

### 2. Live Real-Data Payload Preview
Rather than presenting generic boilerplate, the consent dialog queries the user's actual top 3 recent activity sessions via the `get_recent_preview_payload` IPC command. Users see the exact JSON structure and window titles before deciding to save their API key.

### 3. Server-Side Request Forgery (SSRF) Prevention
To protect local and intranet services from malicious or misconfigured cloud endpoints, `src-tauri/src/inference/mod.rs` enforces `validate_cloud_url`:
* **HTTPS Enforcement:** WAN endpoints must strictly use `https://`. Unencrypted `http://` is rejected.
* **Cloud Metadata Protection:** Link-local and cloud instance metadata addresses (`169.254.169.254`, IPv6 `fe80::/10`) are unconditionally blocked.
* **Private Subnet Defense:** Private RFC 1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), broadcast, and unspecified addresses are rejected for cloud inference.
* Loopback IPs (`127.0.0.1`, `::1`) are permitted exclusively when testing against local proxies.

### 4. Background Cost Suppression
To prevent accidental billable API consumption while users are away from their keyboard:
* The 10-minute idle summarizer (`start_idle_ai_summarizer` in `src-tauri/src/ai.rs`) inspects the active `ai_provider`.
* If set to `"cloud"` or `"off"`, background idle summarization is suspended. Cloud inference only runs during active, user-initiated actions (*Reflect with AI* or *Chat*).

### 5. Encrypted Key Storage & 1-Click Revocation
* API keys are stored encrypted at rest inside the SQLCipher database.
* The Settings panel features a **1-click Key Revocation** button that invokes `clear_cloud_ai_key`, immediately deleting the key from disk and reverting the application to offline mode.

### 6. Provenance Badging
Every generated reflection card is tagged with its source engine (e.g. `[Local: llama3.2]` or `[Cloud: Groq llama-3.3-70b-versatile]`), providing ongoing transparency about where data was processed.

---

## 4. On-Demand vs. Continuous Processing Modes

To ensure quiet, fanless operation and preserve laptop battery life:
* **On-Demand Mode (Default & Recommended):** All background model inference (idle reflections, automated entity extraction, vector indexing) is paused. Intelligence activates strictly when the user clicks *Reflect with AI*, queries *Chat*, or opens a *Resume* brief.
* **Continuous Background Mode:** Memory queues pre-index nodes every 60 seconds and compute idle summaries every 10 minutes. Intended for desktop workstations with dedicated GPUs. When Cloud AI is active, continuous idle loops remain dormant to prevent API costs.

---

## 5. Future Roadmap

* **Embedded GGUF (`llama.cpp`):** Future phases will incorporate embedded native Rust bindings (`llama-cpp-rs`) to provide a zero-install on-device LLM out of the box without requiring external daemons.
* **Hybrid Embeddings:** Compute vector embeddings locally while optionally using cloud LLMs for generation.
