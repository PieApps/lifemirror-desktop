export interface DocArticle {
  id: string;
  title: string;
  category: 'User' | 'Developer' | 'Setup' | 'Workflow';
  content: string;
}

export const DOCS_ARTICLES: DocArticle[] = [
  {
    id: 'user-guide',
    title: 'User Setup & Guide',
    category: 'User',
    content: `# 🖥️ LifeMirror Desktop: User Guide

LifeMirror Desktop turns your raw daily computer activity logs into a serpentine scrollable timeline, providing mindful daily summaries driven by a locally running AI model.

---

## 1. Installation

\`\`\`bash
# Clone the repository and install Node dependencies
npm install
npm run tauri dev
\`\`\`

---

## 2. Chrome Companion Extension Setup

Browser tab tracking uses Chrome's secure **Native Messaging API** (stdio pipes) instead of local network sockets.

1. Open Chrome and navigate to \`chrome://extensions/\`.
2. Enable **Developer Mode** (top right toggle).
3. Click **Load unpacked** and select \`companion-extension/\`.
4. Copy your extension ID and run \`npm run install-host\`.

---

## 3. Local AI Integration (Ollama)

LifeMirror's AI features run completely offline on your computer.

1. Download and run [Ollama](https://ollama.com).
2. Open LifeMirror **Settings** and set endpoint to \`http://localhost:11434\`.
3. Click **Download Model Native** to download \`llama3.2\` directly inside the app.
`
  },
  {
    id: 'developer-docs',
    title: 'Developer & Architecture Guide',
    category: 'Developer',
    content: `# 🛠️ LifeMirror Desktop: Technical Architecture

LifeMirror Desktop uses a local-first architecture combining Tauri 2.0 (Rust backend), React frontend, and SQLCipher database encryption.

---

## SQLCipher Encrypted Database Schema

\`\`\`sql
-- activity_logs table
CREATE TABLE activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_name TEXT NOT NULL,
  window_title TEXT NOT NULL,
  start_time TEXT NOT NULL,
  duration INTEGER NOT NULL,
  source TEXT NOT NULL,
  url TEXT,
  icon_url TEXT,
  domain_tag TEXT,
  notes TEXT
);
\`\`\`

---

## Serpentine S-Curve Bézier Calculus

Cubic Bézier curve segments sweep alternating left and right margins down the page:
$$y = (i + 0.5) \\times \\text{rowHeight}$$
$$x = (i \\pmod 2 == 0) ? \\text{width} \\times 0.875 : \\text{width} \\times 0.125$$
`
  },
  {
    id: 'ollama-setup',
    title: 'Ollama Model Management',
    category: 'Setup',
    content: `# 🤖 Local AI Configuration with Ollama

LifeMirror interfaces with local LLMs via Ollama's HTTP API.

1. **Endpoint**: \`http://localhost:11434/api/generate\`
2. **Model Recommendations**: \`llama3.2\`, \`mistral\`, \`phi3\`
3. **Zero Network Call Guarantee**: System prompts are assembled locally from SQLite metrics and sent exclusively to localhost.
`
  },
  {
    id: 'workflow-guide',
    title: 'Workflow & Security Guidelines',
    category: 'Workflow',
    content: `# 📋 Workflow & Verification Protocol

Before committing changes to LifeMirror Desktop, adhere to the strict verification rulebook:

1. **Incognito Rule**: If \`incognito\` setting is \`true\`, skip all database write transactions and clear shared active focus state immediately.
2. **Compilation**: Run \`npm run build\` and \`cargo check --manifest-path src-tauri/Cargo.toml\`.
`
  }
];
