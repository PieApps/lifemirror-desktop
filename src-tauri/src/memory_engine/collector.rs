use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NormalizedEvent {
    pub id: Option<i64>,
    pub source: String, // "os", "browser", "journal"
    pub timestamp: String,
    pub duration: i64,
    pub context: String, // e.g., app name, domain
    pub detail: String, // e.g., window title, URL, journal text
    pub raw_id: i64, // ID of the original event in its table
}

pub trait MemorySource {
    fn name(&self) -> &'static str;
    fn fetch_unprocessed_events(&self, db: &crate::db::DbState) -> Result<Vec<NormalizedEvent>, String>;
}

pub struct OsTrackerSource;
impl MemorySource for OsTrackerSource {
    fn name(&self) -> &'static str {
        "os"
    }

    fn fetch_unprocessed_events(&self, db: &crate::db::DbState) -> Result<Vec<NormalizedEvent>, String> {
        let conn = db.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, start_time, duration, app_name, window_title
             FROM activity_logs
             WHERE processed = 0
             ORDER BY start_time ASC",
        ).map_err(|e| e.to_string())?;
        
        let iter = stmt.query_map([], |row| {
            Ok(NormalizedEvent {
                id: None,
                source: "os".to_string(),
                timestamp: row.get(1)?,
                duration: row.get(2)?,
                context: row.get(3)?,
                detail: row.get(4)?,
                raw_id: row.get(0)?,
            })
        }).map_err(|e| e.to_string())?;

        let mut events = Vec::new();
        for event in iter {
            events.push(event.map_err(|e| e.to_string())?);
        }
        Ok(events)
    }
}

pub struct BrowserTrackerSource;
impl MemorySource for BrowserTrackerSource {
    fn name(&self) -> &'static str {
        "browser"
    }

    fn fetch_unprocessed_events(&self, db: &crate::db::DbState) -> Result<Vec<NormalizedEvent>, String> {
        let conn = db.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, timestamp, parent_app_name, title, primary_uri
             FROM sub_session_events
             WHERE processed = 0
             ORDER BY timestamp ASC",
        ).map_err(|e| e.to_string())?;
        
        let iter = stmt.query_map([], |row| {
            let parent_app: Option<String> = row.get(2)?;
            let uri: Option<String> = row.get(4)?;
            let context = format!("{} ({})", parent_app.unwrap_or_default(), uri.unwrap_or_default());

            Ok(NormalizedEvent {
                id: None,
                source: "browser".to_string(),
                timestamp: row.get(1)?,
                duration: 60, // Fixed block representation
                context,
                detail: row.get(3)?,
                raw_id: row.get(0)?,
            })
        }).map_err(|e| e.to_string())?;

        let mut events = Vec::new();
        for event in iter {
            events.push(event.map_err(|e| e.to_string())?);
        }
        Ok(events)
    }
}

pub struct JournalSource;
impl MemorySource for JournalSource {
    fn name(&self) -> &'static str {
        "journal"
    }

    fn fetch_unprocessed_events(&self, db: &crate::db::DbState) -> Result<Vec<NormalizedEvent>, String> {
        let conn = db.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, timestamp, notes
             FROM journal_entries
             WHERE processed = 0
             ORDER BY timestamp ASC",
        ).map_err(|e| e.to_string())?;
        
        let iter = stmt.query_map([], |row| {
            Ok(NormalizedEvent {
                id: None,
                source: "journal".to_string(),
                timestamp: row.get(1)?,
                duration: 0,
                context: "Journal Entry".to_string(),
                detail: row.get(2)?,
                raw_id: row.get(0)?,
            })
        }).map_err(|e| e.to_string())?;

        let mut events = Vec::new();
        for event in iter {
            events.push(event.map_err(|e| e.to_string())?);
        }
        Ok(events)
    }
}

pub struct Collector {
    sources: Vec<Box<dyn MemorySource + Send + Sync>>,
}

impl Collector {
    pub fn new() -> Self {
        Self {
            sources: vec![
                Box::new(OsTrackerSource),
                Box::new(BrowserTrackerSource),
                Box::new(JournalSource),
            ],
        }
    }

    pub fn collect_all(&self, db: &crate::db::DbState) -> Result<Vec<NormalizedEvent>, String> {
        let mut all_events = Vec::new();
        for source in &self.sources {
            if let Ok(events) = source.fetch_unprocessed_events(db) {
                all_events.extend(events);
            }
        }
        all_events.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));
        Ok(all_events)
    }
}
