# LifeMirror AI Integration

This document outlines the current state of AI integration in LifeMirror, the supported inference providers, and the future architectural roadmap for local AI capabilities.

## Current Status (Phase 2 Completed)

LifeMirror currently relies on a provider-agnostic `InferenceProvider` trait for all AI-driven workflows. By default, it connects to a local **Ollama** instance via native `reqwest` HTTP clients.

By removing the incomplete Gemini Nano (Chrome built-in AI) integration and replacing brittle shell `curl` commands with robust native Rust networking, the codebase provides a single, robust execution path. The inference layer is designed to be completely abstracted, allowing us to easily introduce embedded backends in the future.

### In-App Model Pulling
We now feature Native Model Downloading over Tauri IPC. Instead of instructing the user to run terminal commands, the UI calls `/api/pull` natively and renders a real-time progress bar.

### On-Demand Architecture & Thermal Optimization
To prevent fan noise, CPU overheating, and battery drain on laptops, LifeMirror decouples telemetry ingestion from model inference:
* **Passive Ingestion ($T=0$):** Window focus polling and browser tab synchronization run continuously from boot in pure Rust and SQLite with near-zero overhead (<0.01% CPU, ~15MB RAM).
* **On-Demand Execution (Default & Recommended):** In `"on_demand"` mode, all background LLM routines (the 60-second queue for semantic tagging, summarization, and vector embeddings, plus the 10-minute idle reflection loop) are suspended. Heavy matrix calculations run strictly when requested by the user.
* **Just-In-Time (JIT) Processing:** When the user clicks **Reflect with AI**, queries **Chat**, or requests a **Catch-up Resume brief**, the backend executes `sync_day_memories` to synthesize pending sessions for that day on-the-fly in 2–3 seconds.
* **Atomic De-Duplication Guard:** An RAII-scoped atomic compare-exchange (`static IS_SYNCING: AtomicBool`) prevents redundant concurrent forward passes if the user double-clicks reflection or chat triggers.
* **Fail-Fast Circuit Breaker & Connection Pooling:** `InferenceProvider::is_available()` executes a 600ms sub-second health probe using connection-pooled HTTP clients (`OnceLock<reqwest::Client>`). If Ollama is offline or unreachable (`ECONNREFUSED`), inference calls fail fast immediately without hanging on socket timeouts or spawning retry storms.
* **Boot-Time Dormancy:** In On-Demand mode, boot is 100% silent with zero localhost polling or missing-model alert banners. If Continuous mode is selected, a 180-second boot grace period lets OS startup services stabilize before any background cycles run.

### Why Ollama as the first provider?
- **Pros:** Mature and stable, excellent model compatibility, handles model management and quantization formats, easy API, cross-platform, large community.
- **Cons:** Requires a separate installation and runs as a background service. These are UX problems, which we mitigate via the Native Model Download UI.

## Future Roadmap

To eventually achieve a zero-install user experience without sacrificing privacy, we plan to transition to an embedded inference engine.

### Phase 3: Embedded llama.cpp
- Implement embedded `llama.cpp` using Rust bindings (`llama-cpp-rs`).
- Implement automatic downloading of GGUF models.
- Implement hardware auto-detection (CPU fallback, GPU acceleration).
- Provide settings for users to switch between the embedded engine and an external Ollama instance.

### Phase 4: Zero-Install Default
- Make embedded inference the default out-of-the-box experience.
- Retain Ollama as an advanced option for users who already have large models installed and running on their systems.

### Evaluated Alternatives
- **Candle:** While an excellent Rust ML framework, it currently lacks the maturity, community adoption, and broad inference support of `llama.cpp` for shipping an offline desktop LLM.
- **WebLLM:** Avoided due to Browser/WebGPU limitations, memory constraints, less predictable performance, and more difficult debugging compared to native Rust inference.
