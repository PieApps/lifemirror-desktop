# LifeMirror Database Schema

## Overview
LifeMirror uses a local SQLite database, encrypted using SQLCipher. Below is the documentation of all the tables in the database along with example records to illustrate the schema.

## Tables

### 1. `activity_logs`
Stores the main activity tracking logs for applications and focused windows.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER PRIMARY KEY` | Auto-incrementing primary key |
| `app_name` | `TEXT` | Name of the application (e.g., "Google Chrome", "VS Code") |
| `window_title` | `TEXT` | Title of the active window |
| `start_time` | `TEXT` | ISO 8601 timestamp of when the activity started |
| `duration` | `INTEGER` | Duration of the activity in seconds |
| `source` | `TEXT` | Source of the event, usually "Window" or "Browser" |
| `url` | `TEXT` | Optional. URL if the activity is a browser tab |
| `icon_url` | `TEXT` | Optional. URL to the favicon or application icon |
| `domain_tag` | `TEXT` | Optional. Extracted domain name (e.g., "github.com") |
| `notes` | `TEXT` | Optional. Any user or system notes attached to this log |

**Example Record:**
```json
{
  "id": 105,
  "app_name": "Google Chrome",
  "window_title": "GitHub - pieapps/lifemirror",
  "start_time": "2026-07-06T10:00:00Z",
  "duration": 340,
  "source": "Browser",
  "url": "https://github.com/pieapps/lifemirror",
  "icon_url": "https://github.com/favicon.ico",
  "domain_tag": "github.com",
  "notes": null
}
```

---

### 2. `sub_session_events`
Stores granular events such as individual browser tab changes or sub-window focuses that might occur within a larger activity log session.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER PRIMARY KEY` | Auto-incrementing primary key |
| `session_type` | `TEXT` | Type of sub-session (e.g., "Browser") |
| `parent_app_name` | `TEXT` | Application owning the sub-session |
| `title` | `TEXT` | Tab or sub-window title |
| `primary_uri` | `TEXT` | URL or main identifier for the sub-session |
| `icon_url` | `TEXT` | Favicon or icon URL |
| `context_tag` | `TEXT` | Extracted domain or context tag |
| `metadata` | `TEXT` | JSON string of extra data |
| `timestamp` | `TEXT` | ISO 8601 timestamp |

**Example Record:**
```json
{
  "id": 42,
  "session_type": "Browser",
  "parent_app_name": "Brave Browser",
  "title": "Stack Overflow - Rust Error E0277",
  "primary_uri": "https://stackoverflow.com/questions/...",
  "icon_url": "https://stackoverflow.com/favicon.ico",
  "context_tag": "stackoverflow.com",
  "metadata": "{\"active\": true, \"tab_id\": 12}",
  "timestamp": "2026-07-06T10:05:00Z"
}
```

---

### 3. `aggregated_daily_metrics`
Stores pre-calculated daily metric rollups per application to optimize dashboard querying.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER PRIMARY KEY` | Auto-incrementing primary key |
| `date` | `TEXT` | Date string in `YYYY-MM-DD` format |
| `app_name` | `TEXT` | Application name |
| `source` | `TEXT` | Source type (e.g., "Window") |
| `total_duration` | `INTEGER` | Total aggregated duration in seconds for the day |
| `session_count` | `INTEGER` | Number of distinct sessions for this app on this date |

*(Note: `date` and `app_name` have a `UNIQUE` constraint)*

**Example Record:**
```json
{
  "id": 7,
  "date": "2026-07-06",
  "app_name": "VS Code",
  "source": "Window",
  "total_duration": 14400,
  "session_count": 5
}
```

---

### 4. `chat_history`
Stores the history of interactions with the local AI assistant.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER PRIMARY KEY` | Auto-incrementing primary key |
| `date` | `TEXT` | Date string for quick querying |
| `role` | `TEXT` | "user" or "assistant" |
| `content` | `TEXT` | Markdown text of the message content |
| `timestamp` | `TEXT` | ISO 8601 timestamp |

**Example Record:**
```json
{
  "id": 12,
  "date": "2026-07-06",
  "role": "user",
  "content": "What did I spend most of my time on today?",
  "timestamp": "2026-07-06T18:00:00Z"
}
```

---

### 5. `journal_entries`
Stores user's manual journal or reflection notes.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER PRIMARY KEY` | Auto-incrementing primary key |
| `timestamp` | `TEXT` | ISO 8601 timestamp |
| `notes` | `TEXT` | Content of the journal entry |

**Example Record:**
```json
{
  "id": 3,
  "timestamp": "2026-07-06T12:00:00Z",
  "notes": "Had a very productive morning working on the Rust backend."
}
```

---

### 6. `distraction_rules`
Stores rules for defining and blocking/warning about distractions.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER PRIMARY KEY` | Auto-incrementing primary key |
| `rule_type` | `TEXT` | Type of rule (e.g., "regex") |
| `value` | `TEXT` | The pattern or match value |
| `is_active` | `BOOLEAN` | 1 (true) if the rule is enabled, 0 (false) if disabled |

**Example Record:**
```json
{
  "id": 1,
  "rule_type": "regex",
  "value": "(?i).*(youtube|twitter|reddit|netflix).*",
  "is_active": true
}
```

---

### 7. `distraction_events`
Logs events when a distraction rule is triggered (e.g., user tried to visit a blocked site).

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER PRIMARY KEY` | Auto-incrementing primary key |
| `timestamp` | `TEXT` | ISO 8601 timestamp |
| `app_name` | `TEXT` | Application where the distraction occurred |
| `window_title` | `TEXT` | Title of the distracting window/tab |
| `interception_type` | `TEXT` | e.g., "block" or "warn" |
| `interception_reason` | `TEXT` | Explanation of why it was intercepted |
| `duration_blocked` | `INTEGER` | Time in seconds spent on the block screen (default 0) |
| `action_taken` | `TEXT` | Optional. User's reaction (e.g., "bypassed", "closed") |

**Example Record:**
```json
{
  "id": 8,
  "timestamp": "2026-07-06T14:30:00Z",
  "app_name": "Google Chrome",
  "window_title": "YouTube",
  "interception_type": "block",
  "interception_reason": "Matched regex: youtube",
  "duration_blocked": 15,
  "action_taken": "closed"
}
```

---

### 8. `settings`
A simple key-value store for application configuration and state.

| Column | Type | Description |
| :--- | :--- | :--- |
| `key` | `TEXT PRIMARY KEY` | Unique string key |
| `value` | `TEXT` | String value |

**Example Records:**
```json
[
  { "key": "incognito", "value": "false" },
  { "key": "tracking_active", "value": "true" },
  { "key": "migration_tab_events_done", "value": "true" }
]
```
