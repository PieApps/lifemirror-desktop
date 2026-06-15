---
name: project_documenter
description: "Expert skill for compiling, auditing, and dynamically updating developer-centric and user-facing project documentation for LifeMirror Desktop."
---

# Project Documenter Skill

Use this skill to create, structure, and incrementally maintain system documentation as the codebase evolves.

> [!IMPORTANT]
> Always adhere to the project workflow guidelines specified in [docs/WORKFLOW.md](file:///var/www/pieapps/lifemirror-desktop/docs/WORKFLOW.md). Run pre-change builds, keep edits surgical, and run verification loops before concluding.

## Core Capabilities & Instructions

1. **Developer Documentation Rules (`DEVELOPER.md`)**:
   - Provide a clear architectural diagram (processes, databases, messaging loops).
   - Document standard input/output (stdin/stdout) specifications for the secure Browser Native Messaging channel.
   - Explain SQLCipher database page-level encryption setup, settings mappings, and migration flows.
   - Detail Linux focus tracking logic (handling Wayland Hyprland/Sway compositor APIs vs. X11 fallbacks).
   - Detail the React S-Curve coordinate geometry and timeline rendering calculations.

2. **User Documentation Rules (`USER.md`)**:
   - Explain application installation steps and local prerequisites.
   - Walk through linking the Chrome extension: registering the JSON host manifest (`com.lifemirror.desktop.json`) in browser config directories.
   - Guide users through starting and configuring the pluggable local AI reflection engine (Ollama commands and model pulls).
   - Clearly define the privacy guarantees of Incognito Mode.

3. **Incremental Documentation Updates**:
   - When files are added or modified, inspect code changes and update references in `DEVELOPER.md` to match.
   - Ensure file paths, crate features, and CLI parameters remain accurate.

4. **Build & Test Delegation**:
   - Skip running compiler builds (`npm run build`, `cargo check`). Focus strictly on compiling and formatting documentation.
