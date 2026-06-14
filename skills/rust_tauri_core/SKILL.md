---
name: rust_tauri_core
description: "Expert skill for developing Tauri 2.0 Rust backends, handling OS-level active window focus tracking loops, and parsing native browser messaging stdin frames."
---

# Rust Tauri Core Developer Skill

Use this skill when developing the native Rust layer of the LifeMirror Desktop application.

> [!IMPORTANT]
> Always adhere to the project workflow guidelines specified in [docs/WORKFLOW.md](file:///var/www/pieapps/lifemirror-desktop/docs/WORKFLOW.md). Run pre-change builds, keep edits surgical, and run verification loops before concluding.

## Core Capabilities & Instructions

1. **Native Messaging Stdin Reader (`native_msg.rs`)**:
   - Stdin reading must parse standard browser native messaging frame sizes (4-byte native endian length followed by UTF-8 JSON).
   - Read buffers surgically to prevent memory leaks and handle EOF (when the browser disconnects) cleanly without spinning.

2. **Active Window Focus Tracker (`tracker.rs`)**:
   - Polling must occur exactly every 1 second in a separate spawned OS thread.
   - For Linux targets, check the environment variable `XDG_SESSION_TYPE`.
   - If `XDG_SESSION_TYPE == "wayland"`, run shell commands targeting the active compositor tree (`hyprctl activewindow -j` or `swaymsg -t get_tree`) to parse focus.
   - If on X11 or Wayland checks fail, fall back to `active-win-pos-rs` API queries and command executors like `xdotool`.
   - Aggregate sessions: ignore focus swaps that last less than 2 seconds.

3. **Incognito State Isolation**:
   - The incognito boolean must be a thread-safe atomic (`AtomicBool`).
   - The tracking loop must evaluate the atomic state before sending insert instructions to the SQLite backend.

4. **Build & Test Delegation**:
   - Run `cargo check --manifest-path src-tauri/Cargo.toml` and `cargo test --manifest-path src-tauri/Cargo.toml` to verify backend changes.
   - Skip frontend builds (`npm run build`) to prevent parallel lock conditions.
