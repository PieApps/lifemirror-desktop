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

*(All edge tables have a composite primary key on the two foreign keys).*

---

## 4. Raw Evidence & Legacy Tracking

These tables remain as the "raw material" ingested by the Memory Engine. They provide deterministic evidence used to build `memory_nodes`.

### `activity_logs`
Stores the raw, granular OS window and application tracking.
*(Columns: id, app_name, window_title, start_time, duration, source, url, icon_url, domain_tag, notes)*

### `sub_session_events`
Stores granular events like individual browser tab changes.
*(Columns: id, session_type, parent_app_name, title, primary_uri, icon_url, context_tag, metadata, timestamp)*

### `session_activities` (Edge)
Links a `memory_node` (type="session") to its constituent raw `activity_logs`.
| Column | Type | Description |
| :--- | :--- | :--- |
| `node_id` | `INTEGER` | FK to `memory_nodes` |
| `activity_id` | `INTEGER` | FK to `activity_logs` |

---

## 5. Other Legacy Tables
- `settings`: KV configuration.
- `chat_history`: Raw AI conversation logs.
- `distraction_rules` & `distraction_events`.
- `aggregated_daily_metrics`: Pre-calculated metrics.
