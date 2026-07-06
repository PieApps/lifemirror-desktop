# LifeMirror: Core Capabilities & Use Cases

LifeMirror has evolved from a simple time-tracker into an **Autonomous Semantic Memory Graph**. By combining background OS-level telemetry with local AI (Ollama), it completely eliminates the need for manual time-sheeting and intelligently organizes your digital life into a searchable, interactive timeline.

Below is a comprehensive guide to what the application is now capable of, complete with concrete examples.

---

## 1. Autonomous Semantic Memory Generation
Instead of forcing you to review thousands of raw window focus events and browser tab switches, LifeMirror automatically clusters raw events into cohesive semantic blocks using local LLMs. 

**How it works:**
The background pipeline collects your OS window events and browser tab URLs. Every night (or during idle periods), the **Memory Engine** processes these logs. It identifies when you switched contexts, extracts the technologies and projects you were working on, and writes a human-readable summary.

**Example Use Case:**
- **Raw Data:** 142 tab switches between `github.com/pieapps`, `localhost:1420`, `VS Code - db.rs`, and `StackOverflow: Rust Sqlite JOIN`.
- **AI Semantic Output:** The timeline collapses these 142 events into a single beautiful block titled **"Backend Database Refactoring"**, tagged with `[Rust]`, `[SQLite]`, and `[Tauri]`.
- **Interaction:** If you click the block on your timeline, it expands an accordion to reveal the exact 142 raw activities hidden inside, proving its work.

## 2. Natural Language Semantic Search
Because every Semantic Memory block is embedded into a dense vector space using `nomic-embed-text`, you can search your history using concepts and ideas rather than exact keyword matches.

**Example Use Case:**
- **Query:** You search for *"When was I researching how to embed LLMs locally?"*
- **Result:** The system bypasses exact keyword matching and retrieves a Semantic Memory titled *"Investigating Local AI Models"*. 
- **Action:** Clicking the search result instantly jumps your timeline to that specific Tuesday three weeks ago, allowing you to see exactly which articles you read and what GitHub repos you had open that day.

## 3. The Distraction Shield (Active Intention)
LifeMirror doesn't just passively record; it actively helps you maintain flow state.

**How it works:**
At the top of the timeline, you can type an "Active Intention" (e.g., *"Writing the Q3 Marketing Plan"*). While this intention is active, the local AI continuously evaluates your real-time window switches against your stated goal.

**Example Use Case:**
- **Scenario:** You declare your intention: *"Fixing the React timeline bugs."*
- **Action:** Ten minutes later, you open Twitter/X.
- **Intervention:** The AI immediately flags this as a deviation from your intention. It records a `DistractionEvent` (deflecting the distraction) and updates the red "Distractions Deflected" badge on your UI, gently nudging you back to your IDE without breaking your privacy by sending data to the cloud.

## 4. Cryptographic Incognito Mode
Because LifeMirror operates entirely on your local machine, your privacy is paramount. 

**Example Use Case:**
- **Scenario:** You are about to check your personal banking or open a confidential client document.
- **Action:** You click the "Incognito" button in the header.
- **Result:** The database immediately halts all insertions. A visual lock overlay drops down over the timeline UI, explicitly confirming that nothing is being recorded. The app effectively "goes to sleep" until you explicitly disable Incognito Mode.

## 5. Automated Daily & Weekly Work Journals
LifeMirror eliminates the Friday afternoon scramble to remember what you worked on all week for your standup or timesheet.

**Example Use Case:**
- **Scenario:** Your manager asks for a status update on what you accomplished this week.
- **Action:** You open the LifeMirror timeline, switch to the "Weekly View", and click "Export Journal".
- **Result:** The AI aggregates all the Semantic Memory summaries for the week and formats them into a clean markdown document. It highlights that you spent 14 hours on Project A and 6 hours reviewing pull requests, entirely generated from background context.

## 6. Context-Aware AI Chat (Reflection)
The built-in AI assistant acts as a second brain that already knows everything you've done.

**Example Use Case:**
- **Scenario:** You open the AI Sidebar.
- **Action:** You ask: *"What was the exact terminal command I used to compile the Android build last Thursday?"*
- **Result:** The AI queries your memory graph, finds the exact Semantic Session from Thursday, extracts the raw terminal window logs associated with it, and hands you the command without you ever needing to grep your bash history.

---

### Summary
LifeMirror is now a fully functional, privacy-first, autonomous time-tracking engine. It handles the raw data collection, the AI semantic processing, the vector search, and the UI visualization—all while ensuring your data never leaves your local machine.
