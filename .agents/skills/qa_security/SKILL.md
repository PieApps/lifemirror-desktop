---
name: qa_security
description: "Expert skill for auditing offline flight performance, checking for telemetry leaks, and asserting incognito isolation security states."
---

# QA & Security Auditor Skill

Use this skill when validating compiled builds and asserting compliance with the privacy-first specifications.

> [!IMPORTANT]
> Always adhere to the project workflow guidelines specified in [docs/WORKFLOW.md](file:///var/www/pieapps/lifemirror-desktop/docs/WORKFLOW.md). Run pre-change builds, keep edits surgical, and run verification loops before concluding.

## Core Capabilities & Instructions

1. **Offline Assertions**:
   - The application must compile and operate fully offline with all networking hardware interfaces disabled.
   - Zero telemetry, metrics, or tracker logs may be routed to external WAN URLs.

2. **Incognito Assertions**:
   - Toggling Incognito Mode must immediately clear any active focus tracking duration buffers in memory.
   - Ensure that zero write transactions are executed on the SQLite database while incognito state is active.

3. **Port Exposure Audits**:
   - Assert that no local TCP/UDP network listening ports (like local WebSockets or HTTP bridges) are opened on localhost, with browser communications routing exclusively via sandboxed stdin/stdout Native Messaging streams.

4. **Build & Test Delegation**:
   - Skip running compiler builds (`npm run build`, `cargo check`). Focus on logical assertions, and rely on the specialist developer agents to verify baseline builds.
