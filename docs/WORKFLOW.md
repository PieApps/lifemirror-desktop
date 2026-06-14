# 🔄 LifeMirror Desktop: Future Change & Feature Workflow

This guide establishes the strict operational workflow that developers and AI coding agents (like Gemini or Cursor) **MUST** follow before, during, and after implementing any code modification, refactoring, or new feature in the LifeMirror Desktop repository.

---

## 📋 High-Level Workflow Lifecycle

```
┌────────────────────────────────┐
│   1. BEFORE: Pre-Flight Check  │
│   - Check baseline compilation │
│   - Design implementation plan │
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│  2. DURING: Surgical Execution │
│  - Karpathy Guidelines first   │
│  - Maintain local guardrails   │
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│   3. AFTER: Verification & Doc │
│  - Compile and test checks     │
│  - Manual smoke tests          │
│  - Walkthrough & docs update   │
└────────────────────────────────┘
```

---

## 🔍 Phase 1: Pre-Flight Checks (Before Making Changes)

Before writing any new code or modifying existing files, the editor or developer must establish a clean baseline and design a robust execution path.

### 1. Compile baseline state
Ensure the current working repository compiles without error. Do not inherit or build on pre-existing compile failures. 
* **Multi-Agent Pre-Flight Rule:** If running multiple specialist agents in parallel, the Orchestrator/PM agent runs the full baseline checks. Specialist agents must bypass redundant pre-flight compilations to prevent parallel file write locks on build artifacts.
* **Frontend check:**
  ```bash
  npm run build
  ```
* **Backend check:**
  ```bash
  cargo check --manifest-path src-tauri/Cargo.toml
  ```

### 2. Trace codebase dependencies
Before editing a module, analyze how data flows through it:
* **UI adjustments:** Check [App.tsx](file:///var/www/pieapps/lifemirror-desktop/src/App.tsx) and component props.
* **Database adjustments:** Inspect schema migrations in [db.rs](file:///var/www/pieapps/lifemirror-desktop/src-tauri/src/db.rs).
* **Process Sync:** If state or setting changes impact both GUI and browser tracker, confirm they synchronize via the SQLite `settings` table rather than global memory variables.

### 3. Create an Implementation Plan (For Major Changes)
If the feature is non-trivial, compile a design document (`implementation_plan.md`) describing:
* Architectural implications.
* Target files to modify.
* Any potential regressions or edge cases.

---

## 🛠️ Phase 2: Surgical Execution (During Changes)

When implementing the code modifications, prioritize surgical precision, simplicity, and project guardrails.

### 1. Adhere to Karpathy Guidelines
* **Surgical Edits:** Modify only code lines that directly solve the task. Do not reformat adjacent functions or clean up unrelated comments.
* **Simplicity First:** Avoid speculative abstractions. Use the minimal code required to satisfy the requirement.
* **Clean up Orphans:** If your change removes the usage of an import, variable, function, or library, delete it immediately.

### 2. Local-First & Privacy Guardrails
Any feature must respect the privacy-first nature of LifeMirror Desktop:
* **Zero Network Traffic:** Do not introduce outbound analytics, tracking endpoints, or external cloud requests.
* **Incognito Checks:** If writing to the database, always query the `settings` table first. If `incognito` is `"true"`, immediately skip the write transaction.
* **SQLCipher Encryption:** Direct SQLite connections must immediately apply `PRAGMA key` to keep page-level encryption intact.

---

## 🧪 Phase 3: Post-Flight & Verification (After Making Changes)

After completing the code modifications, execute compile checks, run tests, verify behaviors manually, and update documentation.

### 1. Delegated Verification Commands
To prevent duplicate execution and lock conflicts during parallel multi-agent sessions, build checks are strictly delegated:
* **Frontend/UI Web Agent:** Responsible only for React and Vite production builds.
  ```bash
  npm run build
  ```
* **Rust/Tauri Core Agent:** Responsible only for Rust checks and test runners.
  ```bash
  cargo check --manifest-path src-tauri/Cargo.toml
  cargo test --manifest-path src-tauri/Cargo.toml
  ```
* **Orchestrator / Conductor Agent:** Executes the final combined compilation loop (`npm run build && cargo check`) as a final integration test after all specialist tasks finish.

### 2. Manual Smoke Tests Checklist
Depending on what was changed, manually verify the following features:
* **Incognito Mode:** Toggle Incognito. Ensure the locked overlay renders and database insertions pause.
* **Window Poller:** Confirm active app focus duration continues to log correctly.
* **Browser Sync:** Load the browser extension unpacked folder, navigate tabs, and verify the Tauri backend receives standard input payloads.
* **AI Engine:** Check that idle AI reflections successfully trigger (via CLI or UI button) without cloud calls.

### 3. Documentation Sync
Update relevant files to describe the new functionality:
* Describe code design shifts in [docs/DEVELOPER.md](file:///var/www/pieapps/lifemirror-desktop/docs/DEVELOPER.md).
* Update user configurations guides in [docs/USER.md](file:///var/www/pieapps/lifemirror-desktop/docs/USER.md).
* Compile a [walkthrough.md](file:///home/raviousprime/.gemini/antigravity-ide/brain/b9918bba-69c4-4fb4-8c80-840e273eaa43/walkthrough.md) showing the changes and validation results.

---

## 📝 Reference Checklist Template

Developers and agents can copy the following markdown checklist into their task planner (`task.md`) to track progress:

```markdown
- [ ] **Phase 1: Pre-Flight Baseline**
  - [ ] Run `npm run build` and `cargo check` to ensure baseline compiles.
  - [ ] Trace dependencies of modified modules.
- [ ] **Phase 2: Surgical Modification**
  - [ ] Apply changes surgically (touch only required code).
  - [ ] Enforce Incognito checks and privacy guardrails.
  - [ ] Clean up orphan variables and unused imports.
- [ ] **Phase 3: Verification & Build**
  - [ ] Confirm `npm run build` runs successfully.
  - [ ] Confirm `cargo check` and `cargo test` run successfully.
  - [ ] Verify functionality manually (smoke tests).
  - [ ] Update documentation files (`docs/DEVELOPER.md`, `README.md`).
```
