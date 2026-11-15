# LifeMirror Database Schema (Memory Graph)

## Overview
LifeMirror uses a local SQLite database, encrypted using SQLCipher. 
The architecture has transitioned from a raw event tracker to a **Semantic Memory Graph**. Instead of primarily querying activity logs, the application interacts with `memory_nodes`, which represent cohesive work sessions, daily summaries, or journal entries. 

These memory nodes are relationally linked to projects, files, repositories, and technologies to form a searchable knowledge graph.

---

## 1. Core Abstraction: Memory Nodes

### `memory_nodes`
The central hub of the memory system. Every semantic memory (a session, a journal entry, a daily summary) is a node.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER PRIMARY KEY` | Unique node identifier |
| `title` | `TEXT` | Short description (e.g., "Implemented OAuth") |
| `summary` | `TEXT` | Detailed LLM summary or journal content |
| `node_type` | `TEXT` | "session", "daily_summary", "journal" |
| `importance_score` | `REAL` | 0-100 scale representing node significance |
| `confidence` | `REAL` | 0.0-1.0 AI confidence score |
| `embedding_id` | `INTEGER` | Foreign key to `memory_embeddings` |
| `status` | `TEXT` | Pipeline state: "raw", "processed", "embedded", "summarized", "archived" |
| `timestamp` | `TEXT` | ISO 8601 creation/occurrence time |

### `memory_embeddings`
Stores the dense vector representations of memory nodes for similarity search.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER PRIMARY KEY` | Auto-incrementing ID |
| `embedding_blob` | `BLOB` | Raw bytes of the `Vec<f32>` embedding |

---

## 2. Graph Entities

These tables represent the concrete nouns that memory nodes interact with.

### `projects`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER PRIMARY KEY` | Auto-incrementing ID |
| `name` | `TEXT UNIQUE` | Name of the project |
| `description` | `TEXT` | Optional description |
| `created_at` | `TEXT` | ISO 8601 timestamp |

### `repositories`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER PRIMARY KEY` | Auto-incrementing ID |
| `path_or_url` | `TEXT UNIQUE` | Local path or remote URL |
| `name` | `TEXT` | Extracted repo name |

### `files`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER PRIMARY KEY` | Auto-incrementing ID |
| `file_path` | `TEXT UNIQUE` | Absolute path or relative to a repo |

### `websites`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER PRIMARY KEY` | Auto-incrementing ID |
| `domain` | `TEXT UNIQUE` | e.g., "github.com", "stackoverflow.com" |

### `technologies` (Entities)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER PRIMARY KEY` | Auto-incrementing ID |
| `name` | `TEXT UNIQUE` | e.g., "Rust", "SQLite", "OAuth" |

---

## 3. Knowledge Graph Edges (Relationships)

These tables link `memory_nodes` to specific entities, establishing the relational graph.

### `node_projects`
| Column | Type | Description |
| :--- | :--- | :--- |
| `node_id` | `INTEGER` | FK to `memory_nodes` |
| `project_id` | `INTEGER` | FK to `projects` |
| `confidence` | `REAL` | AI confidence that this node relates to the project |

### `node_repositories`
| Column | Type | Description |
| :--- | :--- | :--- |
| `node_id` | `INTEGER` | FK to `memory_nodes` |
| `repository_id` | `INTEGER` | FK to `repositories` |

### `node_files`
| Column | Type | Description |
| :--- | :--- | :--- |
| `node_id` | `INTEGER` | FK to `memory_nodes` |
| `file_id` | `INTEGER` | FK to `files` |

### `node_websites`
| Column | Type | Description |
| :--- | :--- | :--- |
| `node_id` | `INTEGER` | FK to `memory_nodes` |
| `website_id` | `INTEGER` | FK to `websites` |

### `node_technologies`
| Column | Type | Description |
| :--- | :--- | :--- |
| `node_id` | `INTEGER` | FK to `memory_nodes` |
| `technology_id` | `INTEGER` | FK to `technologies` |
| `confidence` | `REAL` | AI confidence |

### `node_entities`
Generic edge table linking memory nodes to entities (projects, files, repositories, etc.) dynamically.
| Column | Type | Description |
| :--- | :--- | :--- |
| `node_id` | `INTEGER` | FK to `memory_nodes` |
| `entity_type` | `TEXT` | The type of entity |
| `entity_id` | `INTEGER` | FK to the specific entity table |

*(All edge tables have a composite primary key on their foreign keys).*

---

## 4. Raw Evidence & Legacy Tracking

These tables remain as the "raw material" ingested by the Memory Engine. They provide deterministic evidence used to build `memory_nodes`.

### `journal_entries`
Stores raw user-submitted journal entries before they are processed into `memory_nodes`.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER PRIMARY KEY` | Auto-incrementing ID |
| `timestamp` | `TEXT` | ISO 8601 creation time |
| `notes` | `TEXT` | The actual journal text |
| `processed` | `BOOLEAN` | Whether it has been turned into a memory node |

### `activity_logs`
Stores the raw, granular OS window and application tracking.
*(Columns: id, app_name, window_title, start_time, duration, source, url, icon_url, domain_tag, notes)*

### `sub_session_events`
Stores granular events like individual browser tab changes.
*(Columns: id, session_type, parent_app_name, title, primary_uri, icon_url, context_tag, metadata, timestamp)*

### `session_activities` (Edge)
Links a `memory_node` (type="session") to its constituent raw events (like `activity_logs` or `sub_session_events`).
| Column | Type | Description |
| :--- | :--- | :--- |
| `node_id` | `INTEGER` | FK to `memory_nodes` |
| `raw_id` | `INTEGER` | FK to the source table's ID |
| `source` | `TEXT` | Indicates the source table (e.g., "activity", "sub_session") |

---

## 5. System & Configuration Tables

### `settings`
Persistent key-value configuration store shared across the desktop GUI and headless browser native messaging processes.

| Key | Default | Description |
| :--- | :--- | :--- |
| `ai_provider` | `'local'` | Active intelligence backend: `'local'`, `'cloud'`, or `'off'` |
| `ai_processing_mode` | `'on_demand'` | `'on_demand'` (default, quiet fans & battery saver) or `'continuous'` |
| `has_seen_on_demand_notice` | `'false'` | One-time migration notice banner state for existing users |
| `has_completed_ai_setup` | `'false'` | Deferred setup state flag for the AI onboarding dialog |
| `tracking_active` | `'true'` | Global activity tracking state |
| `incognito` | `'false'` | Incognito privacy lock mode |
| `ollama_url` | `'http://localhost:11434'` | Local loopback endpoint for local AI models |
| `ollama_model` | `'llama3.2'` | Local text completion model |
| `ollama_embedding_model` | `'nomic-embed-text'` | Local vector embedding model |
| `cloud_provider` | `'groq'` | Configured cloud preset: `'groq'`, `'openai'`, `'openrouter'`, `'custom'` |
| `cloud_api_key` | `''` | User-supplied API key, encrypted at rest in SQLCipher |
| `cloud_base_url` | `'https://api.groq.com/openai/v1'` | Validated HTTPS endpoint for OpenAI-compatible completions |
| `cloud_model` | `'llama-3.3-70b-versatile'` | Cloud completion model identifier |
| `cloud_disclosure_accepted` | `'false'` | Explicit user acceptance flag for the cloud privacy and data boundary disclosure |
| `min_log_duration` | `'60'` | Minimum seconds an app must be focused to be recorded |
| `min_sub_session_duration` | `'60'` | Minimum seconds a browser tab must be focused to be recorded |
| `excluded_domains_version` | `'0'` | Atomic synchronization clock for excluded domain cache invalidation |

> [!NOTE]
> In the Rust backend (`src-tauri/src/db.rs`), `ai_provider` and `ai_processing_mode` are mapped to strongly-typed enums (`AiProviderMode` and `AiProcessingMode`) via `DbState::get_ai_provider_mode()` and `DbState::get_ai_processing_mode()`. They implement `FromStr` and `Display` to guarantee safe compile-time checked fallbacks and prevent stringly-typed configuration bugs.

### `chat_history`
Stores multi-turn conversational history with the local AI keyed by date.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER PRIMARY KEY` | Auto-incrementing ID |
| `date` | `TEXT NOT NULL` | Target date (`YYYY-MM-DD`) |
| `role` | `TEXT NOT NULL` | `'user'`, `'assistant'`, or `'system'` |
| `content` | `TEXT NOT NULL` | Raw message content |
| `timestamp` | `TEXT NOT NULL` | ISO 8601 message timestamp |

### `distraction_rules` & `distraction_events`
Stores regex rules and deflected distraction events for Active Interdiction.

### `aggregated_daily_metrics`
Stores daily rolled-up activity summaries for fast analytics querying.
