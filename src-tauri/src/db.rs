use rusqlite::{params, Connection, Result};
use std::path::Path;
use std::sync::Mutex;

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
                eprintln!("Database verification failed: {:?}. Backing up and resetting DB...", e);
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
                icon_url TEXT
            );",
            [],
        )?;

        // Ensure icon_url column is present for backward compatibility
        let _ = conn.execute("ALTER TABLE activity_logs ADD COLUMN icon_url TEXT;", []);

        // Create journal_entries table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS journal_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                notes TEXT NOT NULL
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
        let tracking_active = self.get_setting("tracking_active").unwrap_or_else(|_| "true".to_string()) == "true";
        if !tracking_active {
            return Ok(0); // Ignore insertion silently
        }

        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO activity_logs (app_name, window_title, start_time, duration, source, url, icon_url)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                log.app_name,
                log.window_title,
                log.start_time,
                log.duration,
                log.source,
                log.url,
                log.icon_url
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

    pub fn get_activity_logs(&self, limit: i64) -> Result<Vec<ActivityLog>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, app_name, window_title, start_time, duration, source, url, icon_url 
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
            })
        })?;

        let mut logs = Vec::new();
        for log in log_iter {
            logs.push(log?);
        }
        Ok(logs)
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

    pub fn run_daily_rollup(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO aggregated_daily_metrics (date, app_name, source, total_duration, session_count)
             SELECT 
                date(start_time, 'localtime') as local_date, 
                app_name, 
                source, 
                SUM(duration) as total_duration, 
                COUNT(*) as session_count
             FROM activity_logs
             WHERE date(start_time, 'localtime') < date('now', 'localtime')
             GROUP BY local_date, app_name, source;",
            [],
        )?;
        Ok(())
    }

    pub fn get_aggregated_metrics_range(&self, start_date: &str, end_date: &str) -> Result<Vec<DailySummary>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT date, app_name, source, total_duration FROM aggregated_daily_metrics 
             WHERE date >= ?1 AND date <= ?2
             UNION ALL
             SELECT 
                date(start_time, 'localtime') as date, 
                app_name, 
                source, 
                SUM(duration) as total_duration 
             FROM activity_logs 
             WHERE date(start_time, 'localtime') = date('now', 'localtime') 
               AND date(start_time, 'localtime') >= ?1 
               AND date(start_time, 'localtime') <= ?2
             GROUP BY date, app_name, source"
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

    pub fn get_hourly_heatmap_metrics(&self, start_date: &str, end_date: &str) -> Result<Vec<HourlyMetric>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT 
                cast(strftime('%w', start_time, 'localtime') as integer) as day_of_week,
                cast(strftime('%H', start_time, 'localtime') as integer) as hour,
                SUM(duration) as total_duration
             FROM activity_logs
             WHERE date(start_time, 'localtime') >= ?1 AND date(start_time, 'localtime') <= ?2
             GROUP BY day_of_week, hour;"
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
            "SELECT id, app_name, window_title, start_time, duration, source, url, icon_url
             FROM activity_logs
             WHERE date(start_time, 'localtime') = ?1
             ORDER BY start_time DESC;"
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
            })
        })?;

        let mut logs = Vec::new();
        for log in log_iter {
            logs.push(log?);
        }
        Ok(logs)
    }
}
