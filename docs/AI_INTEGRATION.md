# LifeMirror AI Integration

This document outlines the current state of AI integration in LifeMirror, the supported inference providers, and the future architectural roadmap for local AI capabilities.

## Current Status (Phase 2 Completed)

LifeMirror currently relies on a provider-agnostic `InferenceProvider` trait for all AI-driven workflows. By default, it connects to a local **Ollama** instance via native `reqwest` HTTP clients.

By removing the incomplete Gemini Nano (Chrome built-in AI) integration and replacing brittle shell `curl` commands with robust native Rust networking, the codebase provides a single, robust execution path. The inference layer is designed to be completely abstracted, allowing us to easily introduce embedded backends in the future.

### In-App Model Pulling
We now feature Native Model Downloading over Tauri IPC. Instead of instructing the user to run terminal commands, the UI calls `/api/pull` natively and renders a real-time progress bar.

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
