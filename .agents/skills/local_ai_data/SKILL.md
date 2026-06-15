---
name: local_ai_data
description: "Expert skill for designing encrypted SQLCipher database schemas, running migrations, and formatting local completion prompts for Ollama."
---

# Local AI & Data Engineer Skill

Use this skill when implementing database storage schemas and reflection prompting templates.

> [!IMPORTANT]
> Always adhere to the project workflow guidelines specified in [docs/WORKFLOW.md](file:///var/www/pieapps/lifemirror-desktop/docs/WORKFLOW.md). Run pre-change builds, keep edits surgical, and run verification loops before concluding.

## Core Capabilities & Instructions

1. **SQLCipher Local Hardening**:
   - Enforce page-level encryption on the SQLite database from day one.
   - Run `PRAGMA key = 'passphrase';` immediately following connection open.
   - Create indices on timestamps to optimize recursive dashboard polling queries.

2. **Schema Integrity**:
   - Maintain strict relational layouts for activity events and journal notes.
   - Guard insertions: ensure all database modules cleanly return errors to Tauri command hooks rather than panicking.

3. **Mindfulness Prompts**:
   - Structure text completion requests to local models (like `llama3.2`) to synthesize micro-focus changes into concise, 2-sentence summaries.

4. **Build & Test Delegation**:
   - Skip running compiler checks (`npm run build`, `cargo check`). Let the specialized UI and Tauri Core agents handle incremental verification builds.
