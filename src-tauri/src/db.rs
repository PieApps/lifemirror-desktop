use rusqlite::{functions::FunctionFlags, params, Connection, Result};
use std::path::Path;
use std::sync::Mutex;
use crate::memory_engine::collector::NormalizedEvent;

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ActivityLog {
    pub id: Option<i64>,
    pub app_name: String,
    pub window_title: String,
    pub start_time: String,
    pub duration: i64,
    pub source: String,
    pub url: Option<String>,
    pub icon_url: Option<String>,
    pub domain_tag: Option<String>,
    pub notes: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct JournalEntry {
    pub id: Option<i64>,
    pub timestamp: String,
    pub notes: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DailySummary {
    pub date: String,
    pub app_name: String,
    pub source: String,
    pub total_duration: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct HourlyMetric {
    pub day_of_week: i32,
    pub hour: i32,
    pub total_duration: i64,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct ChatMessage {
    pub id: Option<i64>,
    pub date: String,
    pub role: String,
    pub content: String,
    pub timestamp: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct DistractionRule {
    pub id: i64,
    pub rule_type: String,
    pub value: String,
    pub is_active: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SubSessionEvent {
    pub id: Option<i64>,
    pub session_type: String,
    pub parent_app_name: Option<String>,
    pub title: String,
    pub primary_uri: Option<String>,
    pub icon_url: Option<String>,
    pub context_tag: Option<String>,
    pub metadata: Option<String>,
    pub timestamp: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DistractionEvent {
    pub id: Option<i64>,
    pub timestamp: String,
    pub app_name: String,
    pub window_title: String,
    pub interception_type: String,
    pub interception_reason: String,
    pub duration_blocked: i64,
    pub action_taken: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MemoryNode {
    pub id: Option<i64>,
    pub title: String,
    pub summary: Option<String>,
    pub node_type: String,
    pub importance_score: f64,
    pub confidence: f64,
    pub embedding_id: Option<i64>,
    pub status: String,
    pub timestamp: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Project {
    pub id: Option<i64>,
    pub name: String,
    pub description: Option<String>,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Repository {
    pub id: Option<i64>,
    pub path_or_url: String,
    pub name: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileEntity {
    pub id: Option<i64>,
    pub file_path: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Website {
    pub id: Option<i64>,
    pub domain: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Technology {
    pub id: Option<i64>,
    pub name: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MemoryEmbedding {
    pub id: Option<i64>,
    pub embedding_blob: Vec<u8>,
}

pub fn extract_domain(url: &str) -> String {
    let without_protocol = if let Some(stripped) = url.strip_prefix("https://") {
        stripped
    } else if let Some(stripped) = url.strip_prefix("http://") {
        stripped
    } else {
        url
    };

    let end = without_protocol
        .find('/')
        .or_else(|| without_protocol.find('?'))
        .or_else(|| without_protocol.find(':'))
        .unwrap_or(without_protocol.len());

    let host = &without_protocol[..end];
    if let Some(stripped) = host.strip_prefix("www.") {
        stripped.to_string()
    } else {
        host.to_string()
    }
}

pub struct DbState {
    pub conn: Mutex<Connection>,
}

impl DbState {
    pub fn new<P: AsRef<Path>>(db_path: P) -> Self {
        let path_ref = db_path.as_ref();
        let encryption_key = std::env::var("LIFEMIRROR_DB_KEY")
            .unwrap_or_else(|_| "lifemirror_default_secure_vault_passphrase_256".to_string());

        let conn = match Self::open_and_verify(path_ref, &encryption_key) {
            Ok(c) => c,
            Err(e) => {
                eprintln!(
                    "Database verification failed: {:?}. Backing up and resetting DB...",
                    e
                );
                if path_ref.exists() {
                    let mut backup_path = path_ref.to_path_buf();
                    backup_path.set_extension("db.bak");
                    let _ = std::fs::rename(path_ref, backup_path);
                }
                Self::open_and_verify(path_ref, &encryption_key)
                    .expect("Failed to create a fresh SQLite database after reset")
            }
        };

        let state = DbState {
            conn: Mutex::new(conn),
        };
        state.run_migrations().expect("Database migration failed");
        state
    }

    fn open_and_verify(db_path: &Path, encryption_key: &str) -> Result<Connection> {
        let conn = Connection::open(db_path)?;
        conn.pragma_update(None, "key", &encryption_key)?;
        conn.create_scalar_function(
            "extract_domain",
            1,
            FunctionFlags::SQLITE_UTF8 | FunctionFlags::SQLITE_DETERMINISTIC,
            |ctx| {
                let url: Option<String> = ctx.get(0)?;
                Ok(url.as_deref().map(extract_domain).unwrap_or_default())
            },
        )?;
        // Verify key by running a test query
        let _: u32 = conn.query_row("SELECT count(*) FROM sqlite_master;", [], |row| row.get(0))?;
        Ok(conn)
    }

    fn run_migrations(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        // Create activity_logs table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS activity_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                app_name TEXT NOT NULL,
                window_title TEXT NOT NULL,
                start_time TEXT NOT NULL,
                duration INTEGER NOT NULL,
                source TEXT NOT NULL,
                url TEXT,
                icon_url TEXT,
                domain_tag TEXT,
                notes TEXT,
                processed BOOLEAN NOT NULL DEFAULT 0
            );",
            [],
        )?;

        // Create journal_entries table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS journal_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                notes TEXT NOT NULL,
                processed BOOLEAN NOT NULL DEFAULT 0
            );",
            [],
        )?;

        // Create settings table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );",
            [],
        )?;

        // Create distraction_rules table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS distraction_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rule_type TEXT NOT NULL,
                value TEXT NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT 1
            );",
            [],
        )?;

        // Seed default distraction regex if table is empty
        let rule_count: i64 = conn
            .query_row("SELECT count(*) FROM distraction_rules;", [], |row| row.get(0))
            .unwrap_or(0);
        
        if rule_count == 0 {
            let _ = conn.execute(
                "INSERT INTO distraction_rules (rule_type, value, is_active) VALUES ('regex', '(?i).*(youtube|twitter|reddit|netflix).*', 1);",
                [],
            );
        }

        // Seed default incognito setting
        conn.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES ('incognito', 'false');",
            [],
        )?;

        // Seed default tracking state
        conn.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES ('tracking_active', 'true');",
            [],
        )?;

        // Indexes for performance
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_activity_logs_start_time ON activity_logs (start_time);",
            [],
        )?;

        // Create aggregated_daily_metrics table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS aggregated_daily_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                app_name TEXT NOT NULL,
                source TEXT NOT NULL,
                total_duration INTEGER NOT NULL,
                session_count INTEGER NOT NULL,
                UNIQUE(date, app_name)
            );",
            [],
        )?;

        // Create chat_history table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS chat_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp TEXT NOT NULL
            );",
            [],
        )?;

        // Index for chat history dates
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_chat_history_date ON chat_history (date);",
            [],
        )?;

        // Create distraction_events table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS distraction_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                app_name TEXT NOT NULL,
                window_title TEXT NOT NULL,
                interception_type TEXT NOT NULL,
                interception_reason TEXT NOT NULL,
                duration_blocked INTEGER DEFAULT 0,
                action_taken TEXT
            );",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS sub_session_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_type TEXT NOT NULL,
                parent_app_name TEXT,
                title TEXT NOT NULL,
                primary_uri TEXT,
                icon_url TEXT,
                context_tag TEXT,
                metadata TEXT,
                timestamp TEXT NOT NULL,
                processed BOOLEAN NOT NULL DEFAULT 0
            );",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_sub_session_events_timestamp ON sub_session_events (timestamp);",
            [],
        )?;

        // --- Memory Graph Schema ---
        conn.execute(
            "CREATE TABLE IF NOT EXISTS memory_nodes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                summary TEXT,
                node_type TEXT NOT NULL,
                importance_score REAL NOT NULL DEFAULT 0.0,
                confidence REAL NOT NULL DEFAULT 1.0,
                embedding_id INTEGER,
                status TEXT NOT NULL DEFAULT 'raw',
                timestamp TEXT NOT NULL
            );",
            [],
        )?;
        
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_memory_nodes_timestamp ON memory_nodes (timestamp);",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS memory_embeddings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                embedding_blob BLOB NOT NULL,
                provider TEXT NOT NULL,
                model_name TEXT NOT NULL,
                dimensions INTEGER NOT NULL
            );",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                created_at TEXT NOT NULL
            );",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS repositories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path_or_url TEXT NOT NULL UNIQUE,
                name TEXT
            );",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT NOT NULL UNIQUE
            );",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS websites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                domain TEXT NOT NULL UNIQUE
            );",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS technologies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE
            );",
            [],
        )?;

        // Edge tables
        conn.execute(
            "CREATE TABLE IF NOT EXISTS node_projects (
                node_id INTEGER NOT NULL,
                project_id INTEGER NOT NULL,
                confidence REAL NOT NULL DEFAULT 1.0,
                PRIMARY KEY (node_id, project_id)
            );",
            [],
        )?;
        
        conn.execute(
            "CREATE TABLE IF NOT EXISTS session_activities (
                node_id INTEGER NOT NULL,
                raw_id INTEGER NOT NULL,
                source TEXT NOT NULL,
                PRIMARY KEY (node_id, raw_id, source)
            );",
            [],
        )?;
        
        conn.execute(
            "CREATE TABLE IF NOT EXISTS node_entities (
                node_id INTEGER NOT NULL,
                entity_type TEXT NOT NULL,
                entity_id INTEGER NOT NULL,
                PRIMARY KEY (node_id, entity_type, entity_id)
            );",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS node_repositories (
                node_id INTEGER NOT NULL,
                repository_id INTEGER NOT NULL,
                PRIMARY KEY (node_id, repository_id)
            );",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS node_files (
                node_id INTEGER NOT NULL,
                file_id INTEGER NOT NULL,
                PRIMARY KEY (node_id, file_id)
            );",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS node_websites (
                node_id INTEGER NOT NULL,
                website_id INTEGER NOT NULL,
                PRIMARY KEY (node_id, website_id)
            );",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS node_technologies (
                node_id INTEGER NOT NULL,
                technology_id INTEGER NOT NULL,
                confidence REAL NOT NULL DEFAULT 1.0,
                PRIMARY KEY (node_id, technology_id)
            );",
            [],
        )?;

        Ok(())
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> Result<String> {
        let conn = self.conn.lock().unwrap();
        let val: Result<String> = conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |row| row.get(0),
        );
        Ok(val.unwrap_or_else(|_| "false".to_string()))
    }

    pub fn insert_activity_log(&self, log: &ActivityLog) -> Result<i64> {
        // Guardrail: check if tracking is active
        let tracking_active = self
            .get_setting("tracking_active")
            .unwrap_or_else(|_| "true".to_string())
            == "true";
        if !tracking_active {
            return Ok(0); // Ignore insertion silently
        }

        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO activity_logs (app_name, window_title, start_time, duration, source, url, icon_url, domain_tag)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                log.app_name,
                log.window_title,
                log.start_time,
                log.duration,
                log.source,
                log.url,
                log.icon_url,
                log.domain_tag
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn insert_journal_entry(&self, timestamp: &str, notes: &str) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO journal_entries (timestamp, notes) VALUES (?1, ?2)",
            params![timestamp, notes],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn update_activity_notes(&self, id: i64, notes: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE activity_logs SET notes = ?1 WHERE id = ?2",
            params![notes, id],
        )?;
        Ok(())
    }

    pub fn get_activity_logs(&self, limit: i64) -> Result<Vec<ActivityLog>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, app_name, window_title, start_time, duration, source, url, icon_url, domain_tag, notes
             FROM activity_logs
             ORDER BY start_time DESC
             LIMIT ?1",
        )?;
        let log_iter = stmt.query_map([limit], |row| {
            Ok(ActivityLog {
                id: Some(row.get(0)?),
                app_name: row.get(1)?,
                window_title: row.get(2)?,
                start_time: row.get(3)?,
                duration: row.get(4)?,
                source: row.get(5)?,
                url: row.get(6)?,
                icon_url: row.get(7)?,
                domain_tag: row.get(8)?,
                notes: row.get(9)?,
            })
        })?;

        let mut logs = Vec::new();
        for log in log_iter {
            logs.push(log?);
        }
        Ok(logs)
    }

    pub fn search_activities(&self, query_str: &str, limit: i64) -> Result<Vec<ActivityLog>> {
        let conn = self.conn.lock().unwrap();
        let search_pattern = format!("%{}%", query_str);
        
        let mut stmt = conn.prepare(
            "SELECT id, app_name, window_title, start_time, duration, source, url, icon_url, domain_tag, notes
             FROM activity_logs
             WHERE app_name LIKE ?1 OR window_title LIKE ?1 OR notes LIKE ?1
             ORDER BY start_time DESC
             LIMIT ?2",
        )?;
        
        let log_iter = stmt.query_map(params![search_pattern, limit], |row| {
            Ok(ActivityLog {
                id: Some(row.get(0)?),
                app_name: row.get(1)?,
                window_title: row.get(2)?,
                start_time: row.get(3)?,
                duration: row.get(4)?,
                source: row.get(5)?,
                url: row.get(6)?,
                icon_url: row.get(7)?,
                domain_tag: row.get(8)?,
                notes: row.get(9)?,
            })
        })?;

        let mut logs = Vec::new();
        for log in log_iter {
            logs.push(log?);
        }
        Ok(logs)
    }

    pub fn delete_activity_log(&self, id: i64) -> Result<()> {
        let mut conn = self.conn.lock().unwrap();
        let log_date: Option<String> = conn
            .query_row(
                "SELECT date(start_time, 'localtime') FROM activity_logs WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .ok();

        conn.execute("DELETE FROM activity_logs WHERE id = ?1", params![id])?;

        if let Some(date) = log_date {
            let today: String =
                conn.query_row("SELECT date('now', 'localtime')", [], |row| row.get(0))?;
            if date < today {
                let tx = conn.transaction()?;
                tx.execute(
                    "DELETE FROM aggregated_daily_metrics WHERE date = ?1",
                    params![date],
                )?;
                tx.execute(
                    "INSERT OR REPLACE INTO aggregated_daily_metrics (date, app_name, source, total_duration, session_count)
                     SELECT
                        date(start_time, 'localtime') as local_date,
                        CASE WHEN source = 'Browser' THEN extract_domain(url) ELSE app_name END as app_name,
                        source,
                        SUM(duration) as total_duration,
                        COUNT(*) as session_count
                     FROM activity_logs
                     WHERE date(start_time, 'localtime') = ?1
                     GROUP BY local_date, CASE WHEN source = 'Browser' THEN extract_domain(url) ELSE app_name END, source",
                    params![date],
                )?;
                tx.commit()?;
            }
        }

        Ok(())
    }

    pub fn get_journal_entries(&self, limit: i64) -> Result<Vec<JournalEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, timestamp, notes
             FROM journal_entries
             ORDER BY timestamp DESC
             LIMIT ?1",
        )?;
        let entry_iter = stmt.query_map([limit], |row| {
            Ok(JournalEntry {
                id: Some(row.get(0)?),
                timestamp: row.get(1)?,
                notes: row.get(2)?,
            })
        })?;

        let mut entries = Vec::new();
        for entry in entry_iter {
            entries.push(entry?);
        }
        Ok(entries)
    }

    pub fn get_journal_entries_for_day(&self, date: &str) -> Result<Vec<JournalEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, timestamp, notes
             FROM journal_entries
             WHERE date(timestamp, 'localtime') = ?1
             ORDER BY timestamp ASC",
        )?;
        let entry_iter = stmt.query_map([date], |row| {
            Ok(JournalEntry {
                id: Some(row.get(0)?),
                timestamp: row.get(1)?,
                notes: row.get(2)?,
            })
        })?;

        let mut entries = Vec::new();
        for entry in entry_iter {
            entries.push(entry?);
        }
        Ok(entries)
    }

    pub fn insert_memory_node(&self, node: &MemoryNode) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "INSERT INTO memory_nodes (title, summary, node_type, importance_score, confidence, embedding_id, status, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
        )?;
        let row_id = stmt.insert(params![
            node.title,
            node.summary,
            node.node_type,
            node.importance_score,
            node.confidence,
            node.embedding_id,
            node.status,
            node.timestamp
        ])?;
        Ok(row_id)
    }

    pub fn insert_memory_embedding(&self, blob: &[u8], provider: &str, model_name: &str, dimensions: i64) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "INSERT INTO memory_embeddings (embedding_blob, provider, model_name, dimensions)
             VALUES (?1, ?2, ?3, ?4)"
        )?;
        let row_id = stmt.insert(params![blob, provider, model_name, dimensions])?;
        Ok(row_id)
    }

    pub fn update_memory_node_embedding(&self, node_id: i64, embedding_id: i64, status: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "UPDATE memory_nodes 
             SET embedding_id = ?1, status = ?2 
             WHERE id = ?3"
        )?;
        stmt.execute(params![embedding_id, status, node_id])?;
        Ok(())
    }

    pub fn persist_built_sessions(&self, sessions: Vec<(MemoryNode, Vec<NormalizedEvent>)>) -> Result<()> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;

        {
            let mut insert_node = tx.prepare(
                "INSERT INTO memory_nodes (title, summary, node_type, importance_score, confidence, embedding_id, status, timestamp)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
            )?;
            let mut insert_activity = tx.prepare(
                "INSERT OR IGNORE INTO session_activities (node_id, raw_id, source) VALUES (?1, ?2, ?3)"
            )?;
            let mut mark_os = tx.prepare("UPDATE activity_logs SET processed = 1 WHERE id = ?1")?;
            let mut mark_browser = tx.prepare("UPDATE sub_session_events SET processed = 1 WHERE id = ?1")?;
            let mut mark_journal = tx.prepare("UPDATE journal_entries SET processed = 1 WHERE id = ?1")?;

            for (node, events) in sessions {
                let node_id = insert_node.insert(params![
                    node.title,
                    node.summary,
                    node.node_type,
                    node.importance_score,
                    node.confidence,
                    node.embedding_id,
                    node.status,
                    node.timestamp
                ])?;

                for event in events {
                    insert_activity.execute(params![node_id, event.raw_id, &event.source])?;
                    match event.source.as_str() {
                        "os" => { mark_os.execute([event.raw_id])?; },
                        "browser" => { mark_browser.execute([event.raw_id])?; },
                        "journal" => { mark_journal.execute([event.raw_id])?; },
                        _ => {}
                    }
                }
            }
        }
        
        tx.commit()?;
        Ok(())
    }

    pub fn get_session_events(&self, node_id: i64) -> Result<Vec<NormalizedEvent>> {
        let conn = self.conn.lock().unwrap();
        let mut events = Vec::new();

        // 1. Fetch OS events
        let mut os_stmt = conn.prepare(
            "SELECT a.id, a.start_time, a.duration, a.app_name, a.window_title 
             FROM activity_logs a
             JOIN session_activities sa ON sa.raw_id = a.id AND sa.source = 'os'
             WHERE sa.node_id = ?1"
        )?;
        let os_iter = os_stmt.query_map([node_id], |row| {
            Ok(NormalizedEvent {
                id: None,
                source: "os".to_string(),
                timestamp: row.get(1)?,
                duration: row.get(2)?,
                context: row.get(3)?,
                detail: row.get(4)?,
                raw_id: row.get(0)?,
            })
        })?;
        for e in os_iter { events.push(e?); }

        // 2. Fetch Browser events
        let mut browser_stmt = conn.prepare(
            "SELECT b.id, b.timestamp, b.parent_app_name, b.title, b.primary_uri
             FROM sub_session_events b
             JOIN session_activities sa ON sa.raw_id = b.id AND sa.source = 'browser'
             WHERE sa.node_id = ?1"
        )?;
        let browser_iter = browser_stmt.query_map([node_id], |row| {
            let parent_app: Option<String> = row.get(2)?;
            let uri: Option<String> = row.get(4)?;
            let context = format!("{} ({})", parent_app.unwrap_or_default(), uri.unwrap_or_default());
            
            Ok(NormalizedEvent {
                id: None,
                source: "browser".to_string(),
                timestamp: row.get(1)?,
                duration: 60,
                context,
                detail: row.get(3)?,
                raw_id: row.get(0)?,
            })
        })?;
        for e in browser_iter { events.push(e?); }

        // 3. Fetch Journal events
        let mut journal_stmt = conn.prepare(
            "SELECT j.id, j.timestamp, j.notes
             FROM journal_entries j
             JOIN session_activities sa ON sa.raw_id = j.id AND sa.source = 'journal'
             WHERE sa.node_id = ?1"
        )?;
        let journal_iter = journal_stmt.query_map([node_id], |row| {
            Ok(NormalizedEvent {
                id: None,
                source: "journal".to_string(),
                timestamp: row.get(1)?,
                duration: 0,
                context: "Journal Entry".to_string(),
                detail: row.get(2)?,
                raw_id: row.get(0)?,
            })
        })?;
        for e in journal_iter { events.push(e?); }

        // Sort chronologically
        events.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));
        Ok(events)
    }

    pub fn get_nodes_by_status(&self, status: &str, limit: i64) -> Result<Vec<MemoryNode>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, title, summary, node_type, importance_score, confidence, embedding_id, status, timestamp
             FROM memory_nodes
             WHERE status = ?1
             ORDER BY timestamp ASC
             LIMIT ?2"
        )?;
        
        let iter = stmt.query_map(params![status, limit], |row| {
            Ok(MemoryNode {
                id: Some(row.get(0)?),
                title: row.get(1)?,
                summary: row.get(2)?,
                node_type: row.get(3)?,
                importance_score: row.get(4)?,
                confidence: row.get(5)?,
                embedding_id: row.get(6)?,
                status: row.get(7)?,
                timestamp: row.get(8)?,
            })
        })?;

        let mut nodes = Vec::new();
        for n in iter {
            nodes.push(n?);
        }
        Ok(nodes)
    }

    pub fn run_daily_rollup(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO aggregated_daily_metrics (date, app_name, source, total_duration, session_count)
             SELECT
                date(start_time, 'localtime') as local_date,
                CASE WHEN source = 'Browser' THEN extract_domain(url) ELSE app_name END as app_name,
                source,
                SUM(duration) as total_duration,
                COUNT(*) as session_count
             FROM activity_logs
             WHERE date(start_time, 'localtime') < date('now', 'localtime')
             GROUP BY local_date, CASE WHEN source = 'Browser' THEN extract_domain(url) ELSE app_name END, source;",
            [],
        )?;
        Ok(())
    }

    pub fn get_aggregated_metrics_range(
        &self,
        start_date: &str,
        end_date: &str,
    ) -> Result<Vec<DailySummary>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT date, app_name, source, total_duration FROM aggregated_daily_metrics
             WHERE date >= ?1 AND date <= ?2
             UNION ALL
             SELECT
                date(start_time, 'localtime') as date,
                CASE WHEN source = 'Browser' THEN extract_domain(url) ELSE app_name END as app_name,
                source,
                SUM(duration) as total_duration
             FROM activity_logs
             WHERE date(start_time, 'localtime') = date('now', 'localtime')
               AND date(start_time, 'localtime') >= ?1
               AND date(start_time, 'localtime') <= ?2
             GROUP BY date, CASE WHEN source = 'Browser' THEN extract_domain(url) ELSE app_name END, source"
        )?;

        let rows_iter = stmt.query_map(params![start_date, end_date], |row| {
            Ok(DailySummary {
                date: row.get(0)?,
                app_name: row.get(1)?,
                source: row.get(2)?,
                total_duration: row.get(3)?,
            })
        })?;

        let mut summaries = Vec::new();
        for r in rows_iter {
            summaries.push(r?);
        }
        Ok(summaries)
    }

    pub fn get_hourly_heatmap_metrics(
        &self,
        start_date: &str,
        end_date: &str,
    ) -> Result<Vec<HourlyMetric>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT
                cast(strftime('%w', start_time, 'localtime') as integer) as day_of_week,
                cast(strftime('%H', start_time, 'localtime') as integer) as hour,
                SUM(duration) as total_duration
             FROM activity_logs
             WHERE date(start_time, 'localtime') >= ?1 AND date(start_time, 'localtime') <= ?2
             GROUP BY day_of_week, hour;",
        )?;

        let rows_iter = stmt.query_map(params![start_date, end_date], |row| {
            Ok(HourlyMetric {
                day_of_week: row.get(0)?,
                hour: row.get(1)?,
                total_duration: row.get(2)?,
            })
        })?;

        let mut metrics = Vec::new();
        for r in rows_iter {
            metrics.push(r?);
        }
        Ok(metrics)
    }

    pub fn get_raw_activities_for_day(&self, date: &str) -> Result<Vec<ActivityLog>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, app_name, window_title, start_time, duration, source, url, icon_url, domain_tag, notes
             FROM activity_logs
             WHERE date(start_time, 'localtime') = ?1
             ORDER BY start_time DESC;",
        )?;

        let log_iter = stmt.query_map([date], |row| {
            Ok(ActivityLog {
                id: Some(row.get(0)?),
                app_name: row.get(1)?,
                window_title: row.get(2)?,
                start_time: row.get(3)?,
                duration: row.get(4)?,
                source: row.get(5)?,
                url: row.get(6)?,
                icon_url: row.get(7)?,
                domain_tag: row.get(8)?,
                notes: row.get(9)?,
            })
        })?;

        let mut logs = Vec::new();
        for log in log_iter {
            logs.push(log?);
        }
        Ok(logs)
    }

    pub fn get_memory_nodes_for_day(&self, date: &str) -> Result<Vec<MemoryNode>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, title, summary, node_type, importance_score, confidence, embedding_id, status, timestamp
             FROM memory_nodes
             WHERE date(timestamp, 'localtime') = ?1
             ORDER BY timestamp DESC;",
        )?;

        let iter = stmt.query_map([date], |row| {
            Ok(MemoryNode {
                id: row.get(0)?,
                title: row.get(1)?,
                summary: row.get(2)?,
                node_type: row.get(3)?,
                importance_score: row.get(4)?,
                confidence: row.get(5)?,
                embedding_id: row.get(6)?,
                status: row.get(7)?,
                timestamp: row.get(8)?,
            })
        })?;

        let mut nodes = Vec::new();
        for node in iter {
            nodes.push(node?);
        }
        Ok(nodes)
    }

    pub fn get_activities_for_node(&self, node_id: i64) -> Result<Vec<ActivityLog>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT a.id, a.app_name, a.window_title, a.start_time, a.duration, a.source, a.url, a.icon_url, a.domain_tag, a.notes
             FROM activity_logs a
             JOIN session_activities sa ON a.id = sa.raw_id
             WHERE sa.node_id = ?1 AND sa.source = 'os'
             ORDER BY a.start_time ASC",
        )?;

        let iter = stmt.query_map([node_id], |row| {
            Ok(ActivityLog {
                id: Some(row.get(0)?),
                app_name: row.get(1)?,
                window_title: row.get(2)?,
                start_time: row.get(3)?,
                duration: row.get(4)?,
                source: row.get(5)?,
                url: row.get(6)?,
                icon_url: row.get(7)?,
                domain_tag: row.get(8)?,
                notes: row.get(9)?,
            })
        })?;

        let mut logs = Vec::new();
        for log in iter {
            logs.push(log?);
        }
        Ok(logs)
    }

    pub fn get_sub_events_for_node(&self, node_id: i64) -> Result<Vec<crate::db::SubSessionEvent>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT s.id, s.session_type, s.parent_app_name, s.title, s.primary_uri, s.icon_url, s.context_tag, s.metadata, s.timestamp
             FROM sub_session_events s
             JOIN session_activities sa ON s.id = sa.raw_id
             WHERE sa.node_id = ?1 AND sa.source = 'browser'
             ORDER BY s.timestamp ASC",
        )?;

        let iter = stmt.query_map([node_id], |row| {
            Ok(crate::db::SubSessionEvent {
                id: Some(row.get(0)?),
                session_type: row.get(1)?,
                parent_app_name: row.get(2)?,
                title: row.get(3)?,
                primary_uri: row.get(4)?,
                icon_url: row.get(5)?,
                context_tag: row.get(6)?,
                metadata: row.get(7)?,
                timestamp: row.get(8)?,
            })
        })?;

        let mut events = Vec::new();
        for ev in iter {
            events.push(ev?);
        }
        Ok(events)
    }

    pub fn search_memory_nodes(&self, query: &str, limit: i64) -> Result<Vec<MemoryNode>> {
        let conn = self.conn.lock().unwrap();
        let search_pattern = format!("%{}%", query);
        let mut stmt = conn.prepare(
            "SELECT id, title, summary, node_type, importance_score, confidence, embedding_id, status, timestamp
             FROM memory_nodes
             WHERE title LIKE ?1 OR summary LIKE ?1
             ORDER BY timestamp DESC
             LIMIT ?2;",
        )?;

        let iter = stmt.query_map(params![search_pattern, limit], |row| {
            Ok(MemoryNode {
                id: row.get(0)?,
                title: row.get(1)?,
                summary: row.get(2)?,
                node_type: row.get(3)?,
                importance_score: row.get(4)?,
                confidence: row.get(5)?,
                embedding_id: row.get(6)?,
                status: row.get(7)?,
                timestamp: row.get(8)?,
            })
        })?;

        let mut nodes = Vec::new();
        for node in iter {
            nodes.push(node?);
        }
        Ok(nodes)
    }

    pub fn get_all_embedded_nodes(&self) -> Result<Vec<(MemoryNode, Vec<f32>)>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT n.id, n.title, n.summary, n.node_type, n.importance_score, n.confidence, n.embedding_id, n.status, n.timestamp, e.embedding_blob
             FROM memory_nodes n
             JOIN memory_embeddings e ON n.embedding_id = e.id
             WHERE n.embedding_id IS NOT NULL",
        )?;

        let iter = stmt.query_map([], |row| {
            let blob: Vec<u8> = row.get(9)?;
            let mut vector = Vec::with_capacity(blob.len() / 4);
            for chunk in blob.chunks_exact(4) {
                let bytes: [u8; 4] = [chunk[0], chunk[1], chunk[2], chunk[3]];
                vector.push(f32::from_le_bytes(bytes));
            }

            let node = MemoryNode {
                id: row.get(0)?,
                title: row.get(1)?,
                summary: row.get(2)?,
                node_type: row.get(3)?,
                importance_score: row.get(4)?,
                confidence: row.get(5)?,
                embedding_id: row.get(6)?,
                status: row.get(7)?,
                timestamp: row.get(8)?,
            };
            
            Ok((node, vector))
        })?;

        let mut results = Vec::new();
        for res in iter {
            results.push(res?);
        }
        Ok(results)
    }

    pub fn get_chat_messages_for_day(&self, date: &str) -> Result<Vec<ChatMessage>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, date, role, content, timestamp
             FROM chat_history
             WHERE date = ?1
             ORDER BY timestamp ASC;",
        )?;

        let chat_iter = stmt.query_map([date], |row| {
            Ok(ChatMessage {
                id: Some(row.get(0)?),
                date: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                timestamp: row.get(4)?,
            })
        })?;

        let mut messages = Vec::new();
        for msg in chat_iter {
            messages.push(msg?);
        }
        Ok(messages)
    }

    pub fn insert_chat_message(&self, date: &str, role: &str, content: &str) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        let timestamp = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO chat_history (date, role, content, timestamp) VALUES (?1, ?2, ?3, ?4)",
            params![date, role, content, timestamp],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn clear_chat_messages_for_day(&self, date: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM chat_history WHERE date = ?1", params![date])?;
        Ok(())
    }

    pub fn insert_sub_session_event(&self, event: &SubSessionEvent) -> Result<i64> {
        let tracking_active = self
            .get_setting("tracking_active")
            .unwrap_or_else(|_| "true".to_string())
            == "true";
        if !tracking_active {
            return Ok(0);
        }

        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO sub_session_events (session_type, parent_app_name, title, primary_uri, icon_url, context_tag, metadata, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                event.session_type,
                event.parent_app_name,
                event.title,
                event.primary_uri,
                event.icon_url,
                event.context_tag,
                event.metadata,
                event.timestamp,
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn get_sub_session_events_for_day(&self, date: &str) -> Result<Vec<SubSessionEvent>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, session_type, parent_app_name, title, primary_uri, icon_url, context_tag, metadata, timestamp
             FROM sub_session_events
             WHERE datetime(timestamp, 'localtime') >= datetime(?1 || ' 00:00:00')
               AND datetime(timestamp, 'localtime') <= datetime(?1 || ' 23:59:59', '+10 minutes')
             ORDER BY timestamp ASC;",
        )?;

        let event_iter = stmt.query_map([date], |row| {
            Ok(SubSessionEvent {
                id: Some(row.get(0)?),
                session_type: row.get(1)?,
                parent_app_name: row.get(2)?,
                title: row.get(3)?,
                primary_uri: row.get(4)?,
                icon_url: row.get(5)?,
                context_tag: row.get(6)?,
                metadata: row.get(7)?,
                timestamp: row.get(8)?,
            })
        })?;

        let mut events = Vec::new();
        for event in event_iter {
            events.push(event?);
        }
        Ok(events)
    }

    pub fn get_distraction_rules(&self) -> Result<Vec<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT value FROM distraction_rules WHERE rule_type = 'regex' AND is_active = 1",
        )?;
        let rules = stmt
            .query_map([], |row| row.get(0))?
            .collect::<std::result::Result<Vec<String>, _>>()?;
        Ok(rules)
    }

    pub fn get_distraction_rules_list(&self) -> Result<Vec<DistractionRule>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, rule_type, value, is_active FROM distraction_rules")?;
        let rules = stmt
            .query_map([], |row| {
                Ok(DistractionRule {
                    id: row.get(0)?,
                    rule_type: row.get(1)?,
                    value: row.get(2)?,
                    is_active: row.get(3)?,
                })
            })?
            .collect::<std::result::Result<Vec<DistractionRule>, _>>()?;
        Ok(rules)
    }

    pub fn add_distraction_rule(&self, rule_type: &str, value: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO distraction_rules (rule_type, value, is_active) VALUES (?1, ?2, 1)",
            params![rule_type, value],
        )?;
        Ok(())
    }

    pub fn delete_distraction_rule(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM distraction_rules WHERE id = ?1", [id])?;
        Ok(())
    }

    pub fn insert_distraction_event(
        &self,
        timestamp: &str,
        app_name: &str,
        window_title: &str,
        interception_type: &str,
        interception_reason: &str,
    ) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO distraction_events (timestamp, app_name, window_title, interception_type, interception_reason, duration_blocked)
             VALUES (?1, ?2, ?3, ?4, ?5, 1)",
            params![timestamp, app_name, window_title, interception_type, interception_reason],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn update_distraction_duration(&self, id: i64, added_duration: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE distraction_events SET duration_blocked = duration_blocked + ?1 WHERE id = ?2",
            params![added_duration, id],
        )?;
        Ok(())
    }

    pub fn delete_distraction_event(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM distraction_events WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn get_distraction_events_for_day(&self, date: &str) -> Result<Vec<DistractionEvent>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, timestamp, app_name, window_title, interception_type, interception_reason, duration_blocked, action_taken
             FROM distraction_events
             WHERE date(timestamp) = ?1
             ORDER BY timestamp ASC",
        )?;

        let iter = stmt.query_map([date], |row| {
            Ok(DistractionEvent {
                id: Some(row.get(0)?),
                timestamp: row.get(1)?,
                app_name: row.get(2)?,
                window_title: row.get(3)?,
                interception_type: row.get(4)?,
                interception_reason: row.get(5)?,
                duration_blocked: row.get(6)?,
                action_taken: row.get(7)?,
            })
        })?;

        let mut events = Vec::new();
        for event in iter {
            events.push(event?);
        }
        Ok(events)
    }
}
