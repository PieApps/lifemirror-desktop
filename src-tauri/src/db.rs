use rusqlite::{functions::FunctionFlags, params, Connection, OpenFlags, Result};
use std::path::{Path, PathBuf};
use std::sync::{atomic::{AtomicI64, Ordering}, Arc, Mutex, RwLock};
use fs2::FileExt;
use crate::memory_engine::collector::NormalizedEvent;

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct ExclusionEntry {
    pub domain: String,
    pub include_subdomains: bool,
    pub updated_at: i64,
    pub removed: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct PurgePreview {
    pub sub_sessions_count: usize,
    pub activity_logs_count: usize,
    pub matching_hosts: Vec<String>,
    pub attached_notes_count: usize,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct PurgeReport {
    pub domain: String,
    pub sub_sessions_purged: usize,
    pub activity_logs_purged: usize,
    pub attached_notes_detached: usize,
    pub derived_rollups_purged: usize,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct MergeReport {
    pub newly_excluded: Vec<ExclusionEntry>,
    pub newly_unexcluded: Vec<String>,
    pub total_active: usize,
}

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
    #[serde(default)]
    pub profile_id: Option<String>,
    #[serde(default)]
    pub profile_label: Option<String>,
    #[serde(default)]
    pub browser_name: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TopSiteEntry {
    pub domain: String,
    pub icon_url: Option<String>,
    pub tag: Option<String>,
    pub total_seconds: i64,
    pub visit_count: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct DesktopTodaySummary {
    pub total_active_seconds: i64,
    pub context_switches: i64,
    pub domains_count: i64,
    pub hourly: Vec<i64>,
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

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
pub enum AiProviderMode {
    #[default]
    Local,
    Cloud,
    Off,
}

impl std::str::FromStr for AiProviderMode {
    type Err = std::convert::Infallible;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        Ok(match s.trim().to_lowercase().as_str() {
            "off" | "disabled" => Self::Off,
            "cloud" => Self::Cloud,
            _ => Self::Local,
        })
    }
}

impl std::fmt::Display for AiProviderMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Local => write!(f, "local"),
            Self::Cloud => write!(f, "cloud"),
            Self::Off => write!(f, "off"),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
pub enum AiProcessingMode {
    #[default]
    OnDemand,
    Continuous,
}

impl std::str::FromStr for AiProcessingMode {
    type Err = std::convert::Infallible;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        Ok(match s.trim().to_lowercase().as_str() {
            "continuous" => Self::Continuous,
            _ => Self::OnDemand,
        })
    }
}

impl std::fmt::Display for AiProcessingMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::OnDemand => write!(f, "on_demand"),
            Self::Continuous => write!(f, "continuous"),
        }
    }
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
    pub activities: Option<Vec<ActivityLog>>,
    pub sub_events: Option<Vec<SubSessionEvent>>,
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

pub const KEYRING_SERVICE: &str = "com.lifemirror.desktop";
pub const KEYRING_USER: &str = "database_encryption_key";
pub const LEGACY_DEFAULT_KEY: &str = "lifemirror_default_secure_vault_passphrase_256";

#[derive(Debug, thiserror::Error)]
pub enum VaultError {
    #[error("Database file not found: {0}")]
    VaultNotFound(String),

    #[error("Vault is locked: cannot unlock database with available credentials")]
    CannotUnlockDatabase,

    #[error("Vault is busy (exclusive lock held by migration or backup)")]
    VaultBusy,

    #[error("Database schema requires upgrade")]
    NeedsUpgrade,

    #[error("Anomalous missing database: DB file is missing, but credentials or backups exist. Refusing to create new vault.")]
    AnomalousMissingDb,

    #[error("Key store error: {0}")]
    KeyStore(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("SQLite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
}

pub type VaultResult<T> = std::result::Result<T, VaultError>;

pub trait KeyStore: Send + Sync {
    fn get_key(&self) -> VaultResult<String>;
    fn set_key(&self, key: &str) -> VaultResult<()>;
}

pub struct OsKeyStore {
    service: String,
    user: String,
}

impl OsKeyStore {
    pub fn new() -> Self {
        let env = crate::env::AppEnvironment::detect(None);
        Self::with_service(env.keyring_service())
    }

    pub fn with_service(service: &str) -> Self {
        Self {
            service: service.to_string(),
            user: KEYRING_USER.to_string(),
        }
    }
}

impl Default for OsKeyStore {
    fn default() -> Self {
        Self::new()
    }
}

impl KeyStore for OsKeyStore {
    fn get_key(&self) -> VaultResult<String> {
        let entry = keyring::Entry::new(&self.service, &self.user)
            .map_err(|e| {
                eprintln!("[vault][keyring] Entry::new failed: {e:?}");
                VaultError::KeyStore(format!("Failed to create keyring entry: {e:?}"))
            })?;
        match entry.get_password() {
            Ok(pass) => {
                let trimmed = pass.trim().to_string();
                if trimmed.is_empty() {
                    Err(VaultError::KeyStore("Keyring entry was empty".to_string()))
                } else {
                    Ok(trimmed)
                }
            }
            Err(keyring::Error::NoEntry) => {
                eprintln!("[vault][keyring] No entry found in OS keyring");
                Err(VaultError::KeyStore("No entry in keyring".to_string()))
            }
            Err(e) => {
                eprintln!("[vault][keyring] get_password error: {e:?}");
                Err(VaultError::KeyStore(format!("Keyring get_password failed: {e:?}")))
            }
        }
    }

    fn set_key(&self, key: &str) -> VaultResult<()> {
        let entry = keyring::Entry::new(&self.service, &self.user)
            .map_err(|e| {
                eprintln!("[vault][keyring] Entry::new failed during set: {e:?}");
                VaultError::KeyStore(format!("Failed to create keyring entry: {e:?}"))
            })?;
        entry.set_password(key).map_err(|e| {
            eprintln!("[vault][keyring] set_password error: {e:?}");
            VaultError::KeyStore(format!("Failed to set keyring password: {e:?}"))
        })
    }
}

pub struct MockKeyStore {
    key: std::sync::RwLock<Option<String>>,
}

impl MockKeyStore {
    pub fn new() -> Self {
        Self {
            key: std::sync::RwLock::new(None),
        }
    }

    pub fn with_key(initial_key: &str) -> Self {
        Self {
            key: std::sync::RwLock::new(Some(initial_key.to_string())),
        }
    }
}

impl KeyStore for MockKeyStore {
    fn get_key(&self) -> VaultResult<String> {
        match self.key.read().unwrap().as_ref() {
            Some(k) if !k.trim().is_empty() => Ok(k.trim().to_string()),
            _ => Err(VaultError::KeyStore("MockKeyStore: No key stored".to_string())),
        }
    }

    fn set_key(&self, key: &str) -> VaultResult<()> {
        *self.key.write().unwrap() = Some(key.to_string());
        Ok(())
    }
}

pub struct VaultLock {
    file: std::fs::File,
}

impl VaultLock {
    pub fn acquire_exclusive(db_dir: &Path) -> VaultResult<Self> {
        let _ = std::fs::create_dir_all(db_dir);
        let lock_path = db_dir.join(".vault.lock");
        let file = std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .open(&lock_path)?;
        FileExt::lock_exclusive(&file)?;
        Ok(Self { file })
    }

    pub fn try_shared(db_dir: &Path) -> VaultResult<Self> {
        let _ = std::fs::create_dir_all(db_dir);
        let lock_path = db_dir.join(".vault.lock");
        let file = std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .open(&lock_path)?;
        match FileExt::try_lock_shared(&file) {
            Ok(()) => Ok(Self { file }),
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => Err(VaultError::VaultBusy),
            Err(e) => Err(VaultError::Io(e)),
        }
    }
}

impl Drop for VaultLock {
    fn drop(&mut self) {
        let _ = FileExt::unlock(&self.file);
    }
}

fn generate_secure_key() -> String {
    use rand::RngCore;
    let mut key_bytes = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut key_bytes);
    key_bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

fn write_protected_key_file(path: &Path, key: &str) -> std::io::Result<()> {
    let parent = path.parent().unwrap_or(path);
    std::fs::create_dir_all(parent)?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(parent, std::fs::Permissions::from_mode(0o700));
    }

    let tmp_path = parent.join(format!(".vault_key.tmp.{}", uuid::Uuid::new_v4().simple()));
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        use std::io::Write;
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(&tmp_path)?;
        file.write_all(key.as_bytes())?;
        file.sync_all()?;
    }
    #[cfg(not(unix))]
    {
        use std::io::Write;
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&tmp_path)?;
        file.write_all(key.as_bytes())?;
        file.sync_all()?;
    }

    std::fs::rename(&tmp_path, path)?;

    #[cfg(unix)]
    {
        if let Ok(dir) = std::fs::File::open(parent) {
            let _ = dir.sync_all();
        }
    }

    Ok(())
}

fn collect_candidate_keys<K: KeyStore>(db_dir: &Path, key_store: &K) -> Vec<String> {
    let mut candidates = Vec::new();

    // 1. Explicit env override for debug builds only
    #[cfg(debug_assertions)]
    {
        if let Ok(env_key) = std::env::var("LIFEMIRROR_DB_KEY") {
            let trimmed = env_key.trim().to_string();
            if !trimmed.is_empty() {
                candidates.push(trimmed);
            }
        }
    }

    // 2. KeyStore (OS Keyring or Mock)
    if let Ok(key) = key_store.get_key() {
        let trimmed = key.trim().to_string();
        if !trimmed.is_empty() {
            candidates.push(trimmed);
        }
    }

    // 3. Mirror file .vault_key
    let key_file = db_dir.join(".vault_key");
    if let Ok(key) = std::fs::read_to_string(&key_file) {
        let trimmed = key.trim().to_string();
        if !trimmed.is_empty() && !candidates.contains(&trimmed) {
            candidates.push(trimmed);
        }
    }

    // 4. Pending rekey file .vault_key.next (in case of crash mid-rekey)
    let key_next_file = db_dir.join(".vault_key.next");
    if let Ok(key) = std::fs::read_to_string(&key_next_file) {
        let trimmed = key.trim().to_string();
        if !trimmed.is_empty() && !candidates.contains(&trimmed) {
            candidates.push(trimmed);
        }
    }

    // 5. Legacy default passphrase
    if !candidates.contains(&LEGACY_DEFAULT_KEY.to_string()) {
        candidates.push(LEGACY_DEFAULT_KEY.to_string());
    }

    candidates
}

fn probe_candidate_keys(db_path: &Path, candidates: &[String]) -> VaultResult<String> {
    for candidate in candidates {
        let trimmed = candidate.trim();
        if trimmed.is_empty() {
            continue;
        }

        // Open read-only so trial never creates WAL/journal sidecars or replays hot journals
        let conn_res = Connection::open_with_flags(
            db_path,
            OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
        );

        let conn = match conn_res {
            Ok(c) => c,
            Err(e) => {
                eprintln!("[vault][probe] Could not open database file read-only: {e}");
                continue;
            }
        };

        if conn.pragma_update(None, "key", trimmed).is_ok() {
            if conn.query_row("SELECT count(*) FROM sqlite_master;", [], |r| r.get::<_, u32>(0)).is_ok() {
                return Ok(trimmed.to_string());
            }

            // Compatibility fallback for SQLCipher 3 databases
            if conn.pragma_update(None, "cipher_compatibility", 3).is_ok() {
                if conn.query_row("SELECT count(*) FROM sqlite_master;", [], |r| r.get::<_, u32>(0)).is_ok() {
                    return Ok(trimmed.to_string());
                }
            }
        }
    }

    Err(VaultError::CannotUnlockDatabase)
}

fn check_first_launch_guardrail<K: KeyStore>(db_dir: &Path, key_store: &K) -> VaultResult<()> {
    let key_file = db_dir.join(".vault_key");
    let key_next_file = db_dir.join(".vault_key.next");

    let has_keyring_key = key_store.get_key().is_ok();
    let has_mirror_key = key_file.exists() || key_next_file.exists();
    let has_backups = if let Ok(entries) = std::fs::read_dir(db_dir) {
        entries.filter_map(|e| e.ok()).any(|e| {
            let name = e.file_name();
            let s = name.to_string_lossy();
            s.starts_with("lifemirror-desktop.") && s.ends_with(".bak")
        })
    } else {
        false
    };

    if has_keyring_key || has_mirror_key || has_backups {
        eprintln!(
            "[vault][first_launch] Refusing to initialize fresh DB: DB missing but credentials or backups exist! (keyring: {has_keyring_key}, mirror: {has_mirror_key}, backups: {has_backups})"
        );
        return Err(VaultError::AnomalousMissingDb);
    }

    Ok(())
}

fn create_online_backup(
    src_conn: &Connection,
    current_key: &str,
    db_dir: &Path,
    tag: &str,
) -> VaultResult<PathBuf> {
    let now = chrono::Utc::now();
    let filename = format!(
        "lifemirror-desktop.{}.{}.bak",
        tag,
        now.format("%Y%m%d_%H%M%S_%3f")
    );
    let backup_path = db_dir.join(&filename);

    let dst_str = backup_path.to_str().unwrap().replace('\'', "''");
    let key_str = current_key.replace('\'', "''");

    src_conn.execute_batch(&format!(
        "ATTACH DATABASE '{dst_str}' AS backup KEY '{key_str}';\
         SELECT sqlcipher_export('backup');\
         DETACH DATABASE backup;"
    ))?;

    prune_old_backups(db_dir, tag, 5);
    Ok(backup_path)
}

fn prune_old_backups(db_dir: &Path, tag: &str, retain_count: usize) {
    let prefix = format!("lifemirror-desktop.{}.", tag);
    if let Ok(entries) = std::fs::read_dir(db_dir) {
        let mut matching_files: Vec<PathBuf> = entries
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| {
                if let Some(file_name) = p.file_name().and_then(|n| n.to_str()) {
                    file_name.starts_with(&prefix) && file_name.ends_with(".bak")
                } else {
                    false
                }
            })
            .collect();

        matching_files.sort_by(|a, b| b.file_name().cmp(&a.file_name()));

        if matching_files.len() > retain_count {
            for old_file in &matching_files[retain_count..] {
                let _ = std::fs::remove_file(old_file);
            }
        }
    }
}

fn atomic_staged_rekey<K: KeyStore>(
    db_path: &Path,
    old_key: &str,
    new_key: &str,
    key_store: &K,
) -> VaultResult<Connection> {
    let db_dir = db_path.parent().unwrap_or(db_path);
    let key_next_file = db_dir.join(".vault_key.next");
    let key_file = db_dir.join(".vault_key");

    // 1. Write pending key to .vault_key.next and read it back
    write_protected_key_file(&key_next_file, new_key)?;
    let read_back = std::fs::read_to_string(&key_next_file)?;
    if read_back.trim() != new_key {
        return Err(VaultError::KeyStore("Failed to verify .vault_key.next persistence".to_string()));
    }

    // 2. Open active connection with old key and create online backup
    let active_conn = DbState::open_and_verify(db_path, old_key)?;
    let _ = create_online_backup(&active_conn, old_key, db_dir, "prerekey")?;

    // 3. Create staged copy using sqlcipher_export with NEW key
    let staged_path = db_dir.join(format!(".vault.staged.{}.db", uuid::Uuid::new_v4().simple()));
    {
        let staged_str = staged_path.to_str().unwrap().replace('\'', "''");
        let new_key_str = new_key.replace('\'', "''");
        active_conn.execute_batch(&format!(
            "ATTACH DATABASE '{staged_str}' AS backup KEY '{new_key_str}';\
             SELECT sqlcipher_export('backup');\
             DETACH DATABASE backup;"
        ))?;
    }

    // 4. Verify staged copy independently with new key
    {
        let staged_conn = DbState::open_and_verify(&staged_path, new_key)?;
        let count: u32 = staged_conn.query_row("SELECT count(*) FROM sqlite_master;", [], |r| r.get(0))?;
        eprintln!("[vault][rekey] Staged rekey succeeded with {count} verified schema objects");
    }

    // 5. Checkpoint active connection, drop it, and clean up sidecars
    let _ = active_conn.pragma_update(None, "wal_checkpoint", "TRUNCATE");
    drop(active_conn);

    let _ = std::fs::remove_file(db_path.with_extension("db-wal"));
    let _ = std::fs::remove_file(db_path.with_extension("db-shm"));
    let _ = std::fs::remove_file(db_path.with_extension("db-journal"));

    // 6. Atomically swap staged copy over target db
    std::fs::rename(&staged_path, db_path)?;

    #[cfg(unix)]
    {
        if let Ok(f) = std::fs::File::open(db_path) {
            let _ = f.sync_all();
        }
        if let Ok(d) = std::fs::File::open(db_dir) {
            let _ = d.sync_all();
        }
    }

    // 7. Promote .vault_key.next to .vault_key
    std::fs::rename(&key_next_file, &key_file)?;

    // 8. Update key_store
    let _ = key_store.set_key(new_key);

    // 9. Open connection with new key
    DbState::open_and_verify(db_path, new_key)
}

pub struct DbState {
    pub conn: Mutex<Connection>,
    pub excluded_cache: Arc<RwLock<(i64, Vec<(String, bool)>)>>,
    pub excluded_version: Arc<AtomicI64>,
}

impl DbState {
    pub fn new<P: AsRef<Path>>(db_path: P) -> Self {
        let path_ref = db_path.as_ref();
        let store = OsKeyStore::new();
        Self::init_or_migrate(path_ref, &store).expect("Failed to initialize database vault")
    }

    pub fn new_with_key<P: AsRef<Path>>(db_path: P, key: &str) -> VaultResult<Self> {
        let path_ref = db_path.as_ref();
        let db_dir = path_ref.parent().unwrap_or(path_ref);
        let _lock = VaultLock::acquire_exclusive(db_dir)?;

        let key_file = db_dir.join(".vault_key");
        write_protected_key_file(&key_file, key)?;

        let conn = Self::open_and_verify(path_ref, key)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(path_ref, std::fs::Permissions::from_mode(0o600));
        }

        let state = DbState {
            conn: Mutex::new(conn),
            excluded_cache: Arc::new(RwLock::new((-1, Vec::new()))),
            excluded_version: Arc::new(AtomicI64::new(0)),
        };
        state.run_migrations().map_err(VaultError::Sqlite)?;
        state.sync_excluded_version_from_db();
        Ok(state)
    }

    pub fn open_existing<K: KeyStore>(db_path: &Path, key_store: &K) -> VaultResult<Self> {
        if !db_path.exists() {
            return Err(VaultError::VaultNotFound(db_path.display().to_string()));
        }

        let db_dir = db_path.parent().unwrap_or(db_path);
        let candidates = collect_candidate_keys(db_dir, key_store);
        let winning_key = probe_candidate_keys(db_path, &candidates)?;

        let conn = Self::open_and_verify(db_path, &winning_key)?;

        let table_count: u32 = conn.query_row(
            "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='activity_logs';",
            [],
            |r| r.get(0),
        )?;
        if table_count == 0 {
            return Err(VaultError::NeedsUpgrade);
        }

        let state = DbState {
            conn: Mutex::new(conn),
            excluded_cache: Arc::new(RwLock::new((-1, Vec::new()))),
            excluded_version: Arc::new(AtomicI64::new(0)),
        };
        state.sync_excluded_version_from_db();
        Ok(state)
    }

    pub fn init_or_migrate<K: KeyStore>(db_path: &Path, key_store: &K) -> VaultResult<Self> {
        let db_dir = db_path.parent().unwrap_or(db_path);
        let _lock = VaultLock::acquire_exclusive(db_dir)?;

        let key_file = db_dir.join(".vault_key");

        let conn = if !db_path.exists() {
            check_first_launch_guardrail(db_dir, key_store)?;

            let new_key = generate_secure_key();
            write_protected_key_file(&key_file, &new_key)?;
            let read_back = std::fs::read_to_string(&key_file)?;
            if read_back.trim() != new_key {
                return Err(VaultError::KeyStore("Failed to verify .vault_key write".to_string()));
            }

            let _ = key_store.set_key(&new_key);
            let conn = Self::open_and_verify(db_path, &new_key)?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let _ = std::fs::set_permissions(db_path, std::fs::Permissions::from_mode(0o600));
            }
            conn
        } else {
            let candidates = collect_candidate_keys(db_dir, key_store);
            let winning_key = probe_candidate_keys(db_path, &candidates)?;

            let (conn, active_key) = if winning_key == LEGACY_DEFAULT_KEY {
                eprintln!("[vault] Database is encrypted with legacy key. Initiating atomic staged rekey...");
                let new_key = generate_secure_key();
                let c = atomic_staged_rekey(db_path, &winning_key, &new_key, key_store)?;
                (c, new_key)
            } else {
                let _ = write_protected_key_file(&key_file, &winning_key);
                let _ = key_store.set_key(&winning_key);
                let c = Self::open_and_verify(db_path, &winning_key)?;
                (c, winning_key)
            };

            let _ = create_online_backup(&conn, &active_key, db_dir, "premigration");
            conn
        };

        let state = DbState {
            conn: Mutex::new(conn),
            excluded_cache: Arc::new(RwLock::new((-1, Vec::new()))),
            excluded_version: Arc::new(AtomicI64::new(0)),
        };
        state.run_migrations().map_err(VaultError::Sqlite)?;
        state.sync_excluded_version_from_db();
        Ok(state)
    }

    /// Safely archives the current locked database and any existing key mirrors
    /// under a timestamped name, and initializes a fresh vault with a new key.
    /// Under NO circumstances is any file deleted: everything is preserved in an archive.
    pub fn archive_and_start_fresh<K: KeyStore>(
        db_path: &Path,
        key_store: &K,
    ) -> VaultResult<Self> {
        let db_dir = db_path.parent().unwrap_or(db_path);
        let _lock = VaultLock::acquire_exclusive(db_dir)?;

        let now = chrono::Utc::now();
        let timestamp = now.format("%Y%m%d_%H%M%S").to_string();

        // 1. Move locked database to archive
        if db_path.exists() {
            let archive_db_path = db_dir.join(format!("lifemirror.archive.{}.db", timestamp));
            std::fs::rename(db_path, &archive_db_path)?;
            eprintln!(
                "[vault] Archived locked database to {}",
                archive_db_path.display()
            );

            // Clean up sidecars by archiving them too if present
            let wal = db_path.with_extension("db-wal");
            if wal.exists() {
                let _ = std::fs::rename(&wal, db_dir.join(format!("lifemirror.archive.{}.db-wal", timestamp)));
            }
            let shm = db_path.with_extension("db-shm");
            if shm.exists() {
                let _ = std::fs::rename(&shm, db_dir.join(format!("lifemirror.archive.{}.db-shm", timestamp)));
            }
        }

        // 2. Archive any existing .vault_key so it doesn't collide
        let key_file = db_dir.join(".vault_key");
        if key_file.exists() {
            let archive_key_path = db_dir.join(format!(".vault_key.archive.{}", timestamp));
            let _ = std::fs::rename(&key_file, archive_key_path);
        }
        let key_next_file = db_dir.join(".vault_key.next");
        if key_next_file.exists() {
            let archive_key_next_path = db_dir.join(format!(".vault_key.next.archive.{}", timestamp));
            let _ = std::fs::rename(&key_next_file, archive_key_next_path);
        }

        // 3. Generate a brand new 256-bit secure key
        let new_key = generate_secure_key();

        // 4. Write new key to .vault_key with mode 0600 and verify read-back
        write_protected_key_file(&key_file, &new_key)?;
        let read_back = std::fs::read_to_string(&key_file)?;
        if read_back.trim() != new_key {
            return Err(VaultError::KeyStore(
                "Failed to verify .vault_key write during fresh vault creation".to_string(),
            ));
        }

        // 5. Store new key in key_store (OS Keyring or Mock)
        let _ = key_store.set_key(&new_key);

        // 6. Open, verify, and run initial migrations on the fresh DB
        let conn = Self::open_and_verify(db_path, &new_key)?;
        let state = DbState {
            conn: Mutex::new(conn),
            excluded_cache: Arc::new(RwLock::new((-1, Vec::new()))),
            excluded_version: Arc::new(AtomicI64::new(0)),
        };
        state.run_migrations().map_err(VaultError::Sqlite)?;
        state.sync_excluded_version_from_db();

        eprintln!("[vault] Fresh vault initialized successfully with secure new key.");
        Ok(state)
    }

    fn open_and_verify(db_path: &Path, encryption_key: &str) -> VaultResult<Connection> {
        let conn = Connection::open(db_path)?;
        conn.pragma_update(None, "key", encryption_key)?;
        let _ = conn.pragma_update(None, "secure_delete", "ON");
        Self::register_custom_functions(&conn)?;
        let _: u32 = conn.query_row("SELECT count(*) FROM sqlite_master;", [], |row| row.get(0))?;
        Ok(conn)
    }

    fn register_custom_functions(conn: &Connection) -> rusqlite::Result<()> {
        conn.create_scalar_function(
            "extract_domain",
            1,
            FunctionFlags::SQLITE_UTF8 | FunctionFlags::SQLITE_DETERMINISTIC,
            |ctx| {
                let url: Option<String> = ctx.get(0)?;
                Ok(url.as_deref().map(extract_domain).unwrap_or_default())
            },
        )
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

        // Create excluded_domains table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS excluded_domains (
                domain TEXT PRIMARY KEY,
                include_subdomains BOOLEAN NOT NULL DEFAULT 1,
                updated_at INTEGER NOT NULL,
                removed INTEGER NOT NULL DEFAULT 0
            );",
            [],
        )?;

        // Seed default excluded_domains_version
        conn.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES ('excluded_domains_version', '0');",
            [],
        )?;

        // Seed default tracking state
        conn.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES ('tracking_active', 'true');",
            [],
        )?;

        // Seed default AI processing mode (on_demand by default to preserve battery and quiet fans)
        conn.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES ('ai_processing_mode', 'on_demand');",
            [],
        )?;

        // Seed one-time migration notification state for existing users
        conn.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES ('has_seen_on_demand_notice', 'false');",
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
                processed BOOLEAN NOT NULL DEFAULT 0,
                profile_id TEXT,
                profile_label TEXT,
                browser_name TEXT
            );",
            [],
        )?;
        let _ = conn.execute("ALTER TABLE sub_session_events ADD COLUMN profile_id TEXT;", []);
        let _ = conn.execute("ALTER TABLE sub_session_events ADD COLUMN profile_label TEXT;", []);
        let _ = conn.execute("ALTER TABLE sub_session_events ADD COLUMN browser_name TEXT;", []);

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_sub_session_events_timestamp ON sub_session_events (timestamp);",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_sub_session_events_profile_time ON sub_session_events (profile_id, timestamp);",
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

    pub fn get_ai_provider_mode(&self) -> AiProviderMode {
        self.get_setting("ai_provider")
            .unwrap_or_default()
            .parse()
            .unwrap_or(AiProviderMode::Local)
    }

    pub fn get_ai_processing_mode(&self) -> AiProcessingMode {
        self.get_setting("ai_processing_mode")
            .unwrap_or_default()
            .parse()
            .unwrap_or(AiProcessingMode::OnDemand)
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
            "INSERT INTO activity_logs (app_name, window_title, start_time, duration, source, url, icon_url, domain_tag, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                log.app_name,
                log.window_title,
                log.start_time,
                log.duration,
                log.source,
                log.url,
                log.icon_url,
                log.domain_tag,
                log.notes
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

    pub fn update_memory_node_summary(&self, node_id: i64, summary: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "UPDATE memory_nodes SET summary = ?1 WHERE id = ?2"
        )?;
        stmt.execute(params![summary, node_id])?;
        Ok(())
    }

    pub fn delete_memory_node(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        
        let mut stmt = conn.prepare("SELECT embedding_id FROM memory_nodes WHERE id = ?1")?;
        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            let embedding_id: Option<i64> = row.get(0)?;
            if let Some(emb_id) = embedding_id {
                conn.execute("DELETE FROM memory_embeddings WHERE id = ?1", params![emb_id])?;
            }
        }
        
        conn.execute("DELETE FROM memory_nodes WHERE id = ?1", params![id])?;
        
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
                activities: None,
                sub_events: None,
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
                id: Some(row.get(0)?),
                title: row.get(1)?,
                summary: row.get(2)?,
                node_type: row.get(3)?,
                importance_score: row.get(4)?,
                confidence: row.get(5)?,
                embedding_id: row.get(6)?,
                status: row.get(7)?,
                timestamp: row.get(8)?,
                activities: None,
                sub_events: None,
            })
        })?;

        let mut nodes = Vec::new();
        for node in iter {
            nodes.push(node?);
        }

        if nodes.is_empty() {
            return Ok(nodes);
        }

        let node_ids: Vec<i64> = nodes.iter().filter_map(|n| n.id).collect();
        if node_ids.is_empty() {
            return Ok(nodes);
        }

        // Batch fetch all activities for all nodes on this day in 1 query
        let placeholders = node_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let mut act_map: std::collections::HashMap<i64, Vec<ActivityLog>> = std::collections::HashMap::new();

        let act_sql = format!(
            "SELECT sa.node_id, a.id, a.app_name, a.window_title, a.start_time, a.duration, a.source, a.url, a.icon_url, a.domain_tag, a.notes
             FROM activity_logs a
             JOIN session_activities sa ON a.id = sa.raw_id
             WHERE sa.node_id IN ({}) AND sa.source = 'os'
             ORDER BY a.start_time ASC",
            placeholders
        );
        let mut act_stmt = conn.prepare(&act_sql)?;
        let act_params = rusqlite::params_from_iter(node_ids.iter());
        let act_iter = act_stmt.query_map(act_params, |row| {
            let node_id: i64 = row.get(0)?;
            let log = ActivityLog {
                id: Some(row.get(1)?),
                app_name: row.get(2)?,
                window_title: row.get(3)?,
                start_time: row.get(4)?,
                duration: row.get(5)?,
                source: row.get(6)?,
                url: row.get(7)?,
                icon_url: row.get(8)?,
                domain_tag: row.get(9)?,
                notes: row.get(10)?,
            };
            Ok((node_id, log))
        })?;

        for item in act_iter {
            let (node_id, log) = item?;
            act_map.entry(node_id).or_default().push(log);
        }

        // Batch fetch all sub_events for all nodes on this day in 1 query
        let mut sub_map: std::collections::HashMap<i64, Vec<SubSessionEvent>> = std::collections::HashMap::new();
        let sub_sql = format!(
            "SELECT sa.node_id, s.id, s.session_type, s.parent_app_name, s.title, s.primary_uri, s.icon_url, s.context_tag, s.metadata, s.timestamp, s.profile_id, s.profile_label, s.browser_name
             FROM sub_session_events s
             JOIN session_activities sa ON s.id = sa.raw_id
             WHERE sa.node_id IN ({}) AND sa.source = 'browser'
             ORDER BY s.timestamp ASC",
            placeholders
        );
        let mut sub_stmt = conn.prepare(&sub_sql)?;
        let sub_params = rusqlite::params_from_iter(node_ids.iter());
        let sub_iter = sub_stmt.query_map(sub_params, |row| {
            let node_id: i64 = row.get(0)?;
            let event = SubSessionEvent {
                id: Some(row.get(1)?),
                session_type: row.get(2)?,
                parent_app_name: row.get(3)?,
                title: row.get(4)?,
                primary_uri: row.get(5)?,
                icon_url: row.get(6)?,
                context_tag: row.get(7)?,
                metadata: row.get(8)?,
                timestamp: row.get(9)?,
                profile_id: row.get(10).ok(),
                profile_label: row.get(11).ok(),
                browser_name: row.get(12).ok(),
            };
            Ok((node_id, event))
        })?;

        for item in sub_iter {
            let (node_id, event) = item?;
            sub_map.entry(node_id).or_default().push(event);
        }

        for node in &mut nodes {
            if let Some(id) = node.id {
                node.activities = Some(act_map.remove(&id).unwrap_or_default());
                node.sub_events = Some(sub_map.remove(&id).unwrap_or_default());
            }
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
            "SELECT s.id, s.session_type, s.parent_app_name, s.title, s.primary_uri, s.icon_url, s.context_tag, s.metadata, s.timestamp, s.profile_id, s.profile_label, s.browser_name
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
                profile_id: row.get(9).ok(),
                profile_label: row.get(10).ok(),
                browser_name: row.get(11).ok(),
            })
        })?;

        let mut events = Vec::new();
        for ev in iter {
            events.push(ev?);
        }
        Ok(events)
    }

    pub fn search_memory_nodes(&self, query: &str, limit: i64) -> Result<Vec<MemoryNode>> {
        let mut tmp_nodes = Vec::new();
        {
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
                    activities: None,
                    sub_events: None,
                })
            })?;

            for node in iter {
                tmp_nodes.push(node?);
            }
        }

        let mut final_nodes = Vec::new();
        for mut node in tmp_nodes {
            if let Some(id) = node.id {
                node.activities = Some(self.get_activities_for_node(id).unwrap_or_default());
                node.sub_events = Some(self.get_sub_events_for_node(id).unwrap_or_default());
            }
            final_nodes.push(node);
        }

        Ok(final_nodes)
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
                activities: None,
                sub_events: None,
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
            "INSERT INTO sub_session_events (
                session_type, parent_app_name, title, primary_uri, icon_url,
                context_tag, metadata, timestamp, profile_id, profile_label, browser_name
             )
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                event.session_type,
                event.parent_app_name,
                event.title,
                event.primary_uri,
                event.icon_url,
                event.context_tag,
                event.metadata,
                event.timestamp,
                event.profile_id,
                event.profile_label,
                event.browser_name,
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn delete_sub_session_event(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM sub_session_events WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn delete_sub_session_event_scoped(&self, id: i64, profile_id: Option<&str>) -> Result<usize> {
        let conn = self.conn.lock().unwrap();
        if let Some(pid) = profile_id {
            if !pid.is_empty() {
                return Ok(conn.execute(
                    "DELETE FROM sub_session_events WHERE id = ?1 AND profile_id = ?2",
                    rusqlite::params![id, pid],
                )?);
            }
        }
        Ok(conn.execute("DELETE FROM sub_session_events WHERE id = ?1", rusqlite::params![id])?)
    }

    pub fn delete_sub_session_event_by_uri_or_title(&self, uri: Option<&str>, title: Option<&str>) -> Result<usize> {
        self.delete_sub_session_event_by_uri_or_title_scoped(uri, title, None)
    }

    pub fn delete_sub_session_event_by_uri_or_title_scoped(
        &self,
        uri: Option<&str>,
        title: Option<&str>,
        profile_id: Option<&str>,
    ) -> Result<usize> {
        let conn = self.conn.lock().unwrap();
        if let Some(u) = uri {
            if !u.is_empty() {
                let count = if let Some(pid) = profile_id {
                    conn.execute(
                        "DELETE FROM sub_session_events WHERE id = (
                            SELECT id FROM sub_session_events 
                            WHERE primary_uri = ?1 AND profile_id = ?2 
                            ORDER BY timestamp DESC LIMIT 1
                        )",
                        rusqlite::params![u, pid],
                    )?
                } else {
                    conn.execute(
                        "DELETE FROM sub_session_events WHERE id = (
                            SELECT id FROM sub_session_events 
                            WHERE primary_uri = ?1 
                            ORDER BY timestamp DESC LIMIT 1
                        )",
                        rusqlite::params![u],
                    )?
                };
                if count > 0 {
                    return Ok(count);
                }
            }
        }
        if let Some(t) = title {
            if !t.is_empty() {
                let count = if let Some(pid) = profile_id {
                    conn.execute(
                        "DELETE FROM sub_session_events WHERE id = (
                            SELECT id FROM sub_session_events 
                            WHERE title = ?1 AND profile_id = ?2 
                            ORDER BY timestamp DESC LIMIT 1
                        )",
                        rusqlite::params![t, pid],
                    )?
                } else {
                    conn.execute(
                        "DELETE FROM sub_session_events WHERE id = (
                            SELECT id FROM sub_session_events 
                            WHERE title = ?1 
                            ORDER BY timestamp DESC LIMIT 1
                        )",
                        rusqlite::params![t],
                    )?
                };
                if count > 0 {
                    return Ok(count);
                }
            }
        }
        Ok(0)
    }

    pub fn get_sub_session_events_for_day(&self, date: &str) -> Result<Vec<SubSessionEvent>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, session_type, parent_app_name, title, primary_uri, icon_url, context_tag, metadata, timestamp, profile_id, profile_label, browser_name
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
                profile_id: row.get(9).ok(),
                profile_label: row.get(10).ok(),
                browser_name: row.get(11).ok(),
            })
        })?;

        let mut events = Vec::new();
        for event in event_iter {
            events.push(event?);
        }
        Ok(events)
    }

    pub fn get_sub_session_events_cursor(
        &self,
        date: Option<&str>,
        profile_id: Option<&str>,
        cursor: Option<&str>,
        limit: usize,
    ) -> Result<(Vec<SubSessionEvent>, Option<String>)> {
        let conn = self.conn.lock().unwrap();
        let limit = limit.clamp(1, 100);

        let mut sql = String::from(
            "SELECT id, session_type, parent_app_name, title, primary_uri, icon_url, \
                    context_tag, metadata, timestamp, profile_id, profile_label, browser_name \
             FROM sub_session_events \
             WHERE 1=1"
        );
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(d) = date {
            if !d.is_empty() {
                sql.push_str(" AND datetime(timestamp, 'localtime') >= datetime(? || ' 00:00:00')");
                params.push(Box::new(d.to_string()));
                sql.push_str(" AND datetime(timestamp, 'localtime') <= datetime(? || ' 23:59:59', '+10 minutes')");
                params.push(Box::new(d.to_string()));
            }
        }

        if let Some(pid) = profile_id {
            if !pid.is_empty() {
                sql.push_str(" AND profile_id = ?");
                params.push(Box::new(pid.to_string()));
            }
        }

        if let Some(cur) = cursor {
            if !cur.is_empty() {
                sql.push_str(" AND timestamp < ?");
                params.push(Box::new(cur.to_string()));
            }
        }

        sql.push_str(" ORDER BY timestamp DESC LIMIT ?");
        params.push(Box::new((limit + 1) as i64));

        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        let mut stmt = conn.prepare(&sql)?;
        let mut rows = stmt.query(param_refs.as_slice())?;

        let mut events = Vec::new();
        while let Some(row) = rows.next()? {
            events.push(SubSessionEvent {
                id: Some(row.get(0)?),
                session_type: row.get(1)?,
                parent_app_name: row.get(2)?,
                title: row.get(3)?,
                primary_uri: row.get(4)?,
                icon_url: row.get(5)?,
                context_tag: row.get(6)?,
                metadata: row.get(7)?,
                timestamp: row.get(8)?,
                profile_id: row.get(9).ok(),
                profile_label: row.get(10).ok(),
                browser_name: row.get(11).ok(),
            });
        }

        let mut next_cursor = None;
        if events.len() > limit {
            events.truncate(limit);
            if let Some(last) = events.last() {
                next_cursor = Some(last.timestamp.clone());
            }
        }

        Ok((events, next_cursor))
    }

    pub fn get_top_sites_summary(
        &self,
        date: Option<&str>,
        profile_id: Option<&str>,
        limit: usize,
    ) -> Result<Vec<TopSiteEntry>> {
        let conn = self.conn.lock().unwrap();
        let limit = limit.clamp(1, 50);

        let mut sql = String::from(
            "SELECT COALESCE(context_tag, 'other') AS domain, \
                    icon_url, \
                    COUNT(*) AS visit_count \
             FROM sub_session_events \
             WHERE primary_uri IS NOT NULL AND primary_uri != ''"
        );
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(d) = date {
            if !d.is_empty() {
                sql.push_str(" AND datetime(timestamp, 'localtime') >= datetime(? || ' 00:00:00')");
                params.push(Box::new(d.to_string()));
                sql.push_str(" AND datetime(timestamp, 'localtime') <= datetime(? || ' 23:59:59', '+10 minutes')");
                params.push(Box::new(d.to_string()));
            }
        }

        if let Some(pid) = profile_id {
            if !pid.is_empty() {
                sql.push_str(" AND profile_id = ?");
                params.push(Box::new(pid.to_string()));
            }
        }

        sql.push_str(" GROUP BY domain ORDER BY visit_count DESC LIMIT ?");
        params.push(Box::new(limit as i64));

        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        let mut stmt = conn.prepare(&sql)?;
        let mut rows = stmt.query(param_refs.as_slice())?;

        let mut entries = Vec::new();
        while let Some(row) = rows.next()? {
            let domain: String = row.get(0)?;
            let icon_url: Option<String> = row.get(1)?;
            let count: i64 = row.get(2)?;
            let total_seconds = count * 60;
            entries.push(TopSiteEntry {
                domain,
                icon_url,
                tag: None,
                total_seconds,
                visit_count: count,
            });
        }

        Ok(entries)
    }

    pub fn get_active_profiles_for_day(&self, date: Option<&str>) -> Result<Vec<(String, String, String)>> {
        let conn = self.conn.lock().unwrap();
        let mut sql = String::from(
            "SELECT DISTINCT COALESCE(profile_id, 'default'), \
                             COALESCE(profile_label, 'Default Profile'), \
                             COALESCE(browser_name, parent_app_name, 'Browser') \
             FROM sub_session_events \
             WHERE profile_id IS NOT NULL"
        );
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
        if let Some(d) = date {
            if !d.is_empty() {
                sql.push_str(" AND datetime(timestamp, 'localtime') >= datetime(? || ' 00:00:00')");
                params.push(Box::new(d.to_string()));
            }
        }
        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        let mut stmt = conn.prepare(&sql)?;
        let mut rows = stmt.query(param_refs.as_slice())?;
        let mut out = Vec::new();
        while let Some(row) = rows.next()? {
            out.push((row.get(0)?, row.get(1)?, row.get(2)?));
        }
        Ok(out)
    }

    pub fn get_desktop_today_summary(
        &self,
        date: Option<&str>,
        profile_id: Option<&str>,
    ) -> Result<DesktopTodaySummary> {
        let conn = self.conn.lock().unwrap();

        let mut conditions = Vec::new();
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(d) = date {
            if !d.is_empty() {
                conditions.push("datetime(timestamp, 'localtime') >= datetime(? || ' 00:00:00')");
                params.push(Box::new(d.to_string()));
                conditions.push("datetime(timestamp, 'localtime') <= datetime(? || ' 23:59:59', '+10 minutes')");
                params.push(Box::new(d.to_string()));
            }
        } else {
            conditions.push("date(timestamp, 'localtime') = date('now', 'localtime')");
        }

        if let Some(pid) = profile_id {
            if !pid.is_empty() {
                conditions.push("profile_id = ?");
                params.push(Box::new(pid.to_string()));
            }
        }

        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        let count_sql = format!(
            "SELECT COUNT(*), COUNT(DISTINCT context_tag) FROM sub_session_events {}",
            where_clause
        );
        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        let mut stmt = conn.prepare(&count_sql)?;
        let (total_count, domains_count): (i64, i64) = stmt.query_row(param_refs.as_slice(), |row| {
            Ok((row.get(0)?, row.get(1)?))
        })?;

        let hourly_sql = format!(
            "SELECT CAST(strftime('%H', datetime(timestamp, 'localtime')) AS INTEGER) as hour, \
                    COUNT(*) as cnt \
             FROM sub_session_events \
             {} \
             GROUP BY hour",
            where_clause
        );
        let mut hourly_stmt = conn.prepare(&hourly_sql)?;
        let mut hourly_rows = hourly_stmt.query(param_refs.as_slice())?;
        let mut hourly = vec![0i64; 24];

        while let Some(row) = hourly_rows.next()? {
            let hour: Option<usize> = row.get(0)?;
            let cnt: i64 = row.get(1)?;
            if let Some(h) = hour {
                if h < 24 {
                    hourly[h] = cnt;
                }
            }
        }

        Ok(DesktopTodaySummary {
            total_active_seconds: total_count * 60,
            context_switches: total_count,
            domains_count,
            hourly,
        })
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

    // ── Domain Exclusion & Privacy Blacklist ───────────────────────────────────

    pub fn sync_excluded_version_from_db(&self) {
        if let Ok(conn) = self.conn.lock() {
            if let Ok(ver_str) = conn.query_row(
                "SELECT value FROM settings WHERE key = 'excluded_domains_version'",
                [],
                |r| r.get::<_, String>(0),
            ) {
                if let Ok(v) = ver_str.parse::<i64>() {
                    self.excluded_version.store(v, Ordering::SeqCst);
                }
            }
        }
    }

    pub fn bump_excluded_domains_version(&self) -> i64 {
        let next = self.excluded_version.fetch_add(1, Ordering::SeqCst) + 1;
        let _ = self.set_setting("excluded_domains_version", &next.to_string());
        next
    }

    pub fn get_excluded_entries(&self) -> Result<Vec<ExclusionEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT domain, include_subdomains, updated_at, removed FROM excluded_domains ORDER BY domain ASC",
        )?;
        let entries = stmt
            .query_map([], |row| {
                Ok(ExclusionEntry {
                    domain: row.get(0)?,
                    include_subdomains: row.get(1)?,
                    updated_at: row.get(2)?,
                    removed: row.get::<_, i64>(3)? != 0,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(entries)
    }

    pub fn get_excluded_domains(&self) -> Result<Vec<ExclusionEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT domain, include_subdomains, updated_at, removed FROM excluded_domains WHERE removed = 0 ORDER BY domain ASC",
        )?;
        let entries = stmt
            .query_map([], |row| {
                Ok(ExclusionEntry {
                    domain: row.get(0)?,
                    include_subdomains: row.get(1)?,
                    updated_at: row.get(2)?,
                    removed: false,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(entries)
    }

    pub fn is_domain_excluded(&self, candidate_host: &str) -> bool {
        let current_ver = self.excluded_version.load(Ordering::Relaxed);

        let needs_reload = {
            let read_guard = self.excluded_cache.read().unwrap();
            read_guard.0 != current_ver
        };

        if needs_reload {
            let entries = {
                let conn = self.conn.lock().unwrap();
                let _ = conn.execute(
                    "CREATE TABLE IF NOT EXISTS excluded_domains (
                        domain TEXT PRIMARY KEY,
                        include_subdomains BOOLEAN NOT NULL DEFAULT 1,
                        updated_at INTEGER NOT NULL,
                        removed INTEGER NOT NULL DEFAULT 0
                    );",
                    [],
                );
                let loaded = if let Ok(mut stmt) = conn.prepare(
                    "SELECT domain, include_subdomains FROM excluded_domains WHERE removed = 0",
                ) {
                    if let Ok(rows) = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, bool>(1)?))) {
                        rows.filter_map(|r| r.ok()).collect::<Vec<_>>()
                    } else {
                        Vec::new()
                    }
                } else {
                    Vec::new()
                };
                loaded
            };
            let mut write_guard = self.excluded_cache.write().unwrap();
            write_guard.0 = current_ver;
            write_guard.1 = entries;
        }

        let read_guard = self.excluded_cache.read().unwrap();
        for (rule, include_subs) in &read_guard.1 {
            if crate::domain_rules::host_matches(candidate_host, rule, *include_subs) {
                return true;
            }
        }
        false
    }

    pub fn preview_domain_purge(&self, domain: &str, include_subdomains: bool) -> Result<PurgePreview> {
        let norm_domain = crate::domain_rules::normalize_domain(domain)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let conn = self.conn.lock().unwrap();

        let mut matching_hosts = std::collections::BTreeSet::new();
        let mut sub_sessions_count = 0;

        let mut stmt = conn.prepare("SELECT id, primary_uri FROM sub_session_events")?;
        let rows = stmt.query_map([], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, Option<String>>(1)?)))?;
        for r in rows.flatten() {
            if let Some(uri) = r.1 {
                let host = extract_domain(&uri);
                if crate::domain_rules::host_matches(&host, &norm_domain, include_subdomains) {
                    sub_sessions_count += 1;
                    if !host.is_empty() {
                        matching_hosts.insert(host);
                    }
                }
            }
        }

        let mut activity_logs_count = 0;
        let mut attached_notes_count = 0;
        let mut stmt2 = conn.prepare("SELECT id, url, notes FROM activity_logs WHERE source = 'Browser'")?;
        let rows2 = stmt2.query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, Option<String>>(2)?,
            ))
        })?;
        for r in rows2.flatten() {
            if let Some(url) = r.1 {
                let host = extract_domain(&url);
                if crate::domain_rules::host_matches(&host, &norm_domain, include_subdomains) {
                    activity_logs_count += 1;
                    if let Some(note) = r.2 {
                        if !note.trim().is_empty() {
                            attached_notes_count += 1;
                        }
                    }
                    if !host.is_empty() {
                        matching_hosts.insert(host);
                    }
                }
            }
        }

        Ok(PurgePreview {
            sub_sessions_count,
            activity_logs_count,
            matching_hosts: matching_hosts.into_iter().collect(),
            attached_notes_count,
        })
    }

    pub fn purge_domain_data(&self, domain: &str, include_subdomains: bool) -> Result<PurgeReport> {
        let norm_domain = crate::domain_rules::normalize_domain(domain)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let conn = self.conn.lock().unwrap();

        // 1. Process activity_logs: detach notes into journal_entries, then delete matching
        let mut select_logs = conn.prepare("SELECT id, start_time, url, notes FROM activity_logs WHERE source = 'Browser'")?;
        let matching_logs: Vec<(i64, String, Option<String>)> = select_logs
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)))?
            .filter_map(|r| r.ok())
            .filter_map(|(id, start_time, url_opt, notes_opt): (i64, String, Option<String>, Option<String>)| {
                if let Some(ref url) = url_opt {
                    let host = extract_domain(url);
                    if crate::domain_rules::host_matches(&host, &norm_domain, include_subdomains) {
                        return Some((id, start_time, notes_opt));
                    }
                }
                None
            })
            .collect();

        let mut attached_notes_detached = 0;
        let mut activity_logs_purged = 0;
        for (id, start_time, notes_opt) in matching_logs {
            if let Some(notes) = notes_opt {
                let trimmed = notes.trim();
                if !trimmed.is_empty() {
                    let _ = conn.execute(
                        "INSERT INTO journal_entries (timestamp, notes) VALUES (?1, ?2)",
                        rusqlite::params![start_time, trimmed],
                    );
                    attached_notes_detached += 1;
                }
            }
            conn.execute("DELETE FROM activity_logs WHERE id = ?1", rusqlite::params![id])?;
            activity_logs_purged += 1;
        }

        // 2. Process sub_session_events: delete matching
        let mut select_subs = conn.prepare("SELECT id, primary_uri FROM sub_session_events")?;
        let matching_subs: Vec<i64> = select_subs
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
            .filter_map(|r| r.ok())
            .filter_map(|(id, uri_opt): (i64, Option<String>)| {
                if let Some(ref uri) = uri_opt {
                    let host = extract_domain(uri);
                    if crate::domain_rules::host_matches(&host, &norm_domain, include_subdomains) {
                        return Some(id);
                    }
                }
                None
            })
            .collect();

        let mut sub_sessions_purged = 0;
        for id in matching_subs {
            conn.execute("DELETE FROM sub_session_events WHERE id = ?1", rusqlite::params![id])?;
            sub_sessions_purged += 1;
        }

        // 3. Clear active_tab_url/title in settings if matching
        if let Ok(active_url) = conn.query_row("SELECT value FROM settings WHERE key = 'active_tab_url'", [], |r| r.get::<_, String>(0)) {
            let host = extract_domain(&active_url);
            if crate::domain_rules::host_matches(&host, &norm_domain, include_subdomains) {
                let _ = conn.execute("DELETE FROM settings WHERE key IN ('active_tab_url', 'active_tab_title', 'active_tab_favicon')", []);
            }
        }

        // 4. Physical zeroing via WAL checkpoint
        let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");

        Ok(PurgeReport {
            domain: norm_domain,
            sub_sessions_purged,
            activity_logs_purged,
            attached_notes_detached,
            derived_rollups_purged: 0,
        })
    }

    pub fn add_excluded_domain(&self, domain: &str, include_subdomains: bool, purge_history: bool) -> Result<PurgeReport> {
        let norm = crate::domain_rules::normalize_domain(domain)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let now = chrono::Utc::now().timestamp_millis();
        {
            let conn = self.conn.lock().unwrap();
            conn.execute(
                "INSERT INTO excluded_domains (domain, include_subdomains, updated_at, removed)
                 VALUES (?1, ?2, ?3, 0)
                 ON CONFLICT(domain) DO UPDATE SET include_subdomains = ?2, updated_at = ?3, removed = 0",
                rusqlite::params![norm, include_subdomains, now],
            )?;
        }
        self.bump_excluded_domains_version();

        if purge_history {
            self.purge_domain_data(&norm, include_subdomains)
        } else {
            Ok(PurgeReport {
                domain: norm,
                ..Default::default()
            })
        }
    }

    pub fn remove_excluded_domain(&self, domain: &str) -> Result<()> {
        let norm = crate::domain_rules::normalize_domain(domain)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let now = chrono::Utc::now().timestamp_millis();
        {
            let conn = self.conn.lock().unwrap();
            conn.execute(
                "UPDATE excluded_domains SET removed = 1, updated_at = ?1 WHERE domain = ?2",
                rusqlite::params![now, norm],
            )?;
        }
        self.bump_excluded_domains_version();
        Ok(())
    }

    pub fn merge_excluded_entries(&self, incoming: Vec<ExclusionEntry>) -> Result<MergeReport> {
        let mut newly_excluded = Vec::new();
        let mut newly_unexcluded = Vec::new();

        {
            let conn = self.conn.lock().unwrap();
            for entry in incoming {
                let norm = match crate::domain_rules::normalize_domain(&entry.domain) {
                    Ok(n) => n,
                    Err(_) => continue,
                };

                let existing: Option<(bool, i64, bool)> = conn
                    .query_row(
                        "SELECT include_subdomains, updated_at, removed FROM excluded_domains WHERE domain = ?1",
                        [&norm],
                        |r| Ok((r.get(0)?, r.get(1)?, r.get::<_, i64>(2)? != 0)),
                    )
                    .ok();

                if let Some((_ex_subs, ex_updated_at, ex_removed)) = existing {
                    if entry.updated_at > ex_updated_at {
                        // Incoming is newer
                        conn.execute(
                            "UPDATE excluded_domains SET include_subdomains = ?1, updated_at = ?2, removed = ?3 WHERE domain = ?4",
                            rusqlite::params![entry.include_subdomains, entry.updated_at, if entry.removed { 1 } else { 0 }, norm],
                        )?;
                        if ex_removed && !entry.removed {
                            newly_excluded.push(ExclusionEntry {
                                domain: norm.clone(),
                                include_subdomains: entry.include_subdomains,
                                updated_at: entry.updated_at,
                                removed: false,
                            });
                        } else if !ex_removed && entry.removed {
                            newly_unexcluded.push(norm.clone());
                        }
                    } else if entry.updated_at == ex_updated_at {
                        // On tie: exclusion wins (removed: false)
                        if ex_removed && !entry.removed {
                            conn.execute(
                                "UPDATE excluded_domains SET include_subdomains = ?1, removed = 0 WHERE domain = ?2",
                                rusqlite::params![entry.include_subdomains, norm],
                            )?;
                            newly_excluded.push(ExclusionEntry {
                                domain: norm.clone(),
                                include_subdomains: entry.include_subdomains,
                                updated_at: entry.updated_at,
                                removed: false,
                            });
                        }
                    }
                } else {
                    // New entry
                    conn.execute(
                        "INSERT INTO excluded_domains (domain, include_subdomains, updated_at, removed) VALUES (?1, ?2, ?3, ?4)",
                        rusqlite::params![norm, entry.include_subdomains, entry.updated_at, if entry.removed { 1 } else { 0 }],
                    )?;
                    if !entry.removed {
                        newly_excluded.push(ExclusionEntry {
                            domain: norm.clone(),
                            include_subdomains: entry.include_subdomains,
                            updated_at: entry.updated_at,
                            removed: false,
                        });
                    }
                }
            }
        }

        // Automatically purge history for any newly excluded domains
        for ex in &newly_excluded {
            let _ = self.purge_domain_data(&ex.domain, ex.include_subdomains);
        }

        self.bump_excluded_domains_version();

        let total_active: usize = {
            let conn = self.conn.lock().unwrap();
            conn.query_row("SELECT count(*) FROM excluded_domains WHERE removed = 0", [], |r| r.get(0)).unwrap_or(0)
        };

        Ok(MergeReport {
            newly_excluded,
            newly_unexcluded,
            total_active,
        })
    }

    pub fn get_unattached_journal_notes(&self) -> Result<Vec<JournalEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, timestamp, notes FROM journal_entries ORDER BY timestamp DESC")?;
        let entries = stmt
            .query_map([], |row| {
                Ok(JournalEntry {
                    id: row.get(0)?,
                    timestamp: row.get(1)?,
                    notes: row.get(2)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(entries)
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

    pub fn get_recent_active_project(&self) -> Result<Option<Project>> {
        let conn = self.conn.lock().unwrap();
        eprintln!("[DbState] get_recent_active_project query starting");
        let mut stmt = conn.prepare(
            "SELECT p.id, p.name, p.description, p.created_at 
             FROM projects p 
             JOIN node_projects np ON p.id = np.project_id 
             JOIN memory_nodes mn ON np.node_id = mn.id 
             ORDER BY mn.timestamp DESC 
             LIMIT 1"
        )?;
        
        let mut iter = stmt.query_map([], |row| {
            Ok(Project {
                id: Some(row.get(0)?),
                name: row.get(1)?,
                description: row.get(2)?,
                created_at: row.get(3)?,
            })
        })?;

        if let Some(res) = iter.next() {
            let p = res?;
            eprintln!("[DbState] get_recent_active_project returning project: {:?}", p);
            Ok(Some(p))
        } else {
            eprintln!("[DbState] get_recent_active_project returned None");
            Ok(None)
        }
    }

    pub fn get_recent_sessions_for_project(&self, project_id: i64, limit: i64) -> Result<Vec<MemoryNode>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT mn.id, mn.title, mn.summary, mn.node_type, mn.importance_score, mn.confidence, mn.embedding_id, mn.status, mn.timestamp 
             FROM memory_nodes mn 
             JOIN node_projects np ON mn.id = np.node_id 
             WHERE np.project_id = ?1 AND mn.node_type = 'session' 
             ORDER BY mn.timestamp DESC 
             LIMIT ?2"
        )?;
        
        let iter = stmt.query_map(params![project_id, limit], |row| {
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
                activities: None,
                sub_events: None,
            })
        })?;
        
        let mut nodes = Vec::new();
        for n in iter {
            nodes.push(n?);
        }
        Ok(nodes)
    }

    pub fn get_recent_files_for_project(&self, project_id: i64, limit: i64) -> Result<Vec<FileEntity>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT f.id, f.file_path 
             FROM files f 
             JOIN node_files nf ON f.id = nf.file_id 
             JOIN node_projects np ON nf.node_id = np.node_id 
             WHERE np.project_id = ?1 
             GROUP BY f.id 
             LIMIT ?2"
        )?;
        
        let iter = stmt.query_map(params![project_id, limit], |row| {
            Ok(FileEntity {
                id: Some(row.get(0)?),
                file_path: row.get(1)?,
            })
        })?;
        
        let mut files = Vec::new();
        for f in iter {
            files.push(f?);
        }
        Ok(files)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sqlcipher_export() {
        let temp_dir = std::env::temp_dir().join(format!("lifemirror_test_export_{}", uuid::Uuid::new_v4().simple()));
        let _ = std::fs::create_dir_all(&temp_dir);
        let src_path = temp_dir.join("src.db");
        let dst_path = temp_dir.join("dst.db");
        let key1 = "old_key_11111";
        let key2 = "new_key_22222";

        {
            let src_conn = Connection::open(&src_path).unwrap();
            src_conn.pragma_update(None, "key", key1).unwrap();
            src_conn.execute("CREATE TABLE t (id INTEGER PRIMARY KEY, msg TEXT);", []).unwrap();
            src_conn.execute("INSERT INTO t (msg) VALUES ('secret export data');", []).unwrap();

            let dst_str = dst_path.to_str().unwrap().replace('\'', "''");
            let key2_str = key2.replace('\'', "''");
            src_conn.execute_batch(&format!(
                "ATTACH DATABASE '{dst_str}' AS backup KEY '{key2_str}';\
                 SELECT sqlcipher_export('backup');\
                 DETACH DATABASE backup;"
            )).unwrap();
        }

        let dst_conn = Connection::open(&dst_path).unwrap();
        dst_conn.pragma_update(None, "key", key2).unwrap();
        let msg: String = dst_conn.query_row("SELECT msg FROM t WHERE id = 1;", [], |r| r.get(0)).unwrap();
        assert_eq!(msg, "secret export data");

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_byte_for_byte_immutability_on_failed_unlock() {
        let temp_dir = std::env::temp_dir().join(format!("lifemirror_test_immut_{}", uuid::Uuid::new_v4().simple()));
        let _ = std::fs::create_dir_all(&temp_dir);
        let db_path = temp_dir.join("protected.db");
        let valid_key = "very_secret_valid_vault_key_99999";

        // Create original DB
        {
            let conn = Connection::open(&db_path).unwrap();
            conn.pragma_update(None, "key", valid_key).unwrap();
            conn.execute("CREATE TABLE user_secrets (id INTEGER PRIMARY KEY, secret TEXT);", []).unwrap();
            conn.execute("INSERT INTO user_secrets (secret) VALUES ('critical private reflection');", []).unwrap();
        }

        let original_bytes = std::fs::read(&db_path).unwrap();
        assert!(!original_bytes.is_empty());

        // Attempt open_existing with wrong key
        let wrong_store = MockKeyStore::with_key("completely_wrong_key");
        let res_open = DbState::open_existing(&db_path, &wrong_store);
        assert!(matches!(res_open, Err(VaultError::CannotUnlockDatabase)));

        // Attempt init_or_migrate with wrong key
        let res_init = DbState::init_or_migrate(&db_path, &wrong_store);
        assert!(matches!(res_init, Err(VaultError::CannotUnlockDatabase)));

        // Verify byte-for-byte immutability: NO modification, NO rename, NO auto-reset!
        let after_bytes = std::fs::read(&db_path).unwrap();
        assert_eq!(original_bytes, after_bytes, "Database bytes MUST be 100% immutable on failed unlock");

        // Verify NO .bak file was created
        let bak_path = db_path.with_extension("db.bak");
        assert!(!bak_path.exists(), "Auto-reset .bak must NEVER be created");

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_first_launch_guardrail_anomalies() {
        let temp_dir = std::env::temp_dir().join(format!("lifemirror_test_guardrail_{}", uuid::Uuid::new_v4().simple()));
        let _ = std::fs::create_dir_all(&temp_dir);
        let db_path = temp_dir.join("missing.db");

        // Case A: DB missing, but keystore already has a key
        let store_with_key = MockKeyStore::with_key("existing_orphaned_key");
        let res_a = DbState::init_or_migrate(&db_path, &store_with_key);
        assert!(matches!(res_a, Err(VaultError::AnomalousMissingDb)));
        assert!(!db_path.exists(), "DB file must NOT be created when guardrail trips");
        assert_eq!(store_with_key.get_key().unwrap(), "existing_orphaned_key", "Existing key must NOT be overwritten");

        // Case B: DB missing, keystore empty, but backup file exists
        let empty_store = MockKeyStore::new();
        let fake_backup = temp_dir.join("lifemirror-desktop.premigration.20261105_120000_000.bak");
        std::fs::write(&fake_backup, b"fake backup content").unwrap();
        let res_b = DbState::init_or_migrate(&db_path, &empty_store);
        assert!(matches!(res_b, Err(VaultError::AnomalousMissingDb)));
        let _ = std::fs::remove_file(&fake_backup);

        // Case C: Genuine first launch (no DB, no key, no backups)
        let fresh_store = MockKeyStore::new();
        let res_c = DbState::init_or_migrate(&db_path, &fresh_store);
        assert!(res_c.is_ok(), "Genuine first launch should succeed");
        assert!(db_path.exists(), "DB file should be created");
        assert!(fresh_store.get_key().is_ok(), "Key should be saved in keystore");
        assert!(temp_dir.join(".vault_key").exists(), ".vault_key should be written");

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_archive_and_start_fresh() {
        let temp_dir = std::env::temp_dir().join(format!("lifemirror_test_archive_{}", uuid::Uuid::new_v4().simple()));
        let _ = std::fs::create_dir_all(&temp_dir);
        let db_path = temp_dir.join("current.db");
        let old_key = "original_user_secret_key_11111";

        // 1. Create a database with old_key and some data
        {
            let conn = Connection::open(&db_path).unwrap();
            conn.pragma_update(None, "key", old_key).unwrap();
            conn.execute("CREATE TABLE notes (id INTEGER PRIMARY KEY, content TEXT);", []).unwrap();
            conn.execute("INSERT INTO notes (content) VALUES ('precious reflection');", []).unwrap();
        }

        // 2. Mock store has wrong key -> init_or_migrate fails
        let wrong_store = MockKeyStore::with_key("wrong_key");
        assert!(matches!(
            DbState::init_or_migrate(&db_path, &wrong_store),
            Err(VaultError::CannotUnlockDatabase)
        ));

        // 3. User chooses archive_and_start_fresh
        let fresh_store = MockKeyStore::new();
        let fresh_db = DbState::archive_and_start_fresh(&db_path, &fresh_store).unwrap();
        drop(fresh_db);

        // 4. Assert fresh DB exists at db_path and has new key
        let new_key = fresh_store.get_key().unwrap();
        assert_ne!(new_key, old_key);
        let new_conn = Connection::open(&db_path).unwrap();
        new_conn.pragma_update(None, "key", &new_key).unwrap();
        let table_count: u32 = new_conn.query_row("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='activity_logs';", [], |r| r.get(0)).unwrap();
        assert!(table_count > 0, "Fresh DB must have schema initialized");

        // 5. Assert archived DB exists and old data is 100% preserved
        let archives: Vec<_> = std::fs::read_dir(&temp_dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| {
                let name = e.file_name().to_string_lossy().to_string();
                name.starts_with("lifemirror.archive.") && name.ends_with(".db")
            })
            .collect();
        assert_eq!(archives.len(), 1, "Exactly one archive DB should exist");
        let archived_path = &archives[0].path();
        let archive_conn = Connection::open(archived_path).unwrap();
        archive_conn.pragma_update(None, "key", old_key).unwrap();
        let note: String = archive_conn.query_row("SELECT content FROM notes WHERE id = 1;", [], |r| r.get(0)).unwrap();
        assert_eq!(note, "precious reflection", "Archived data must be 100% intact and preserved");

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_candidate_trial_fallback() {
        let temp_dir = std::env::temp_dir().join(format!("lifemirror_test_fallback_{}", uuid::Uuid::new_v4().simple()));
        let _ = std::fs::create_dir_all(&temp_dir);
        let db_path = temp_dir.join("fallback.db");
        let valid_key = "correct_vault_key_1234567890abcdef";

        // Create DB with valid_key
        {
            let conn = Connection::open(&db_path).unwrap();
            conn.pragma_update(None, "key", valid_key).unwrap();
            conn.execute("CREATE TABLE t (id INTEGER PRIMARY KEY);", []).unwrap();
        }

        // Put stale/invalid key in keystore
        let stale_store = MockKeyStore::with_key("stale_invalid_key");

        // Put valid key in .vault_key mirror
        write_protected_key_file(&temp_dir.join(".vault_key"), valid_key).unwrap();

        // init_or_migrate should probe, fail on keystore, fall through to .vault_key, succeed, and sync keystore
        let db = DbState::init_or_migrate(&db_path, &stale_store).unwrap();
        drop(db);

        assert_eq!(stale_store.get_key().unwrap(), valid_key, "Winning key should be synced to keystore");

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_pending_key_recovery() {
        let temp_dir = std::env::temp_dir().join(format!("lifemirror_test_pending_{}", uuid::Uuid::new_v4().simple()));
        let _ = std::fs::create_dir_all(&temp_dir);
        let db_path = temp_dir.join("pending.db");
        let new_key = "fresh_rekeyed_key_pending_987654";

        // Create DB with new_key
        {
            let conn = Connection::open(&db_path).unwrap();
            conn.pragma_update(None, "key", new_key).unwrap();
            conn.execute("CREATE TABLE t (id INTEGER PRIMARY KEY);", []).unwrap();
        }

        // Store is empty, .vault_key missing, but .vault_key.next has new_key (crash recovery scenario)
        let store = MockKeyStore::new();
        write_protected_key_file(&temp_dir.join(".vault_key.next"), new_key).unwrap();

        let db = DbState::init_or_migrate(&db_path, &store);
        assert!(db.is_ok(), "Should unlock using .vault_key.next candidate");
        assert_eq!(store.get_key().unwrap(), new_key);

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_online_backup_rolling_retention() {
        let temp_dir = std::env::temp_dir().join(format!("lifemirror_test_retention_{}", uuid::Uuid::new_v4().simple()));
        let _ = std::fs::create_dir_all(&temp_dir);
        let db_path = temp_dir.join("retention.db");
        let key = "backup_test_key_123";

        let conn = Connection::open(&db_path).unwrap();
        conn.pragma_update(None, "key", key).unwrap();
        conn.execute("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT);", []).unwrap();
        conn.execute("INSERT INTO t (v) VALUES ('data');", []).unwrap();

        // Create 7 backups
        for _ in 0..7 {
            create_online_backup(&conn, key, &temp_dir, "testretention").unwrap();
            std::thread::sleep(std::time::Duration::from_millis(15));
        }

        let backups: Vec<_> = std::fs::read_dir(&temp_dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| {
                let name = e.file_name().to_string_lossy().to_string();
                name.starts_with("lifemirror-desktop.testretention.") && name.ends_with(".bak")
            })
            .collect();

        assert_eq!(backups.len(), 5, "Retention must prune to exactly the newest 5 copies");

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_vault_lock_contention() {
        let temp_dir = std::env::temp_dir().join(format!("lifemirror_test_lock_{}", uuid::Uuid::new_v4().simple()));
        let _ = std::fs::create_dir_all(&temp_dir);

        // Exclusive lock
        let exclusive = VaultLock::acquire_exclusive(&temp_dir).unwrap();

        // Shared lock attempt while exclusive is held must return VaultBusy
        let shared_res = VaultLock::try_shared(&temp_dir);
        assert!(matches!(shared_res, Err(VaultError::VaultBusy)));

        // Release exclusive
        drop(exclusive);

        // Now shared lock should succeed
        let shared_res2 = VaultLock::try_shared(&temp_dir);
        assert!(shared_res2.is_ok());

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_legacy_key_migration() {
        let temp_dir = std::env::temp_dir().join(format!("lifemirror_test_{}", uuid::Uuid::new_v4().simple()));
        let _ = std::fs::create_dir_all(&temp_dir);
        let db_path = temp_dir.join("test_legacy.db");

        // 1. Create a database explicitly encrypted with the legacy default key
        {
            let conn = Connection::open(&db_path).unwrap();
            conn.pragma_update(None, "key", &LEGACY_DEFAULT_KEY).unwrap();
            conn.execute(
                "CREATE TABLE test_data (id INTEGER PRIMARY KEY, note TEXT);",
                [],
            ).unwrap();
            conn.execute(
                "INSERT INTO test_data (note) VALUES ('hello legacy user');",
                [],
            ).unwrap();
        }

        // 2. Open via init_or_migrate with MockKeyStore
        let mock_store = MockKeyStore::new();
        let migrated_db = DbState::init_or_migrate(&db_path, &mock_store).unwrap();

        // Verify data preserved
        {
            let conn = migrated_db.conn.lock().unwrap();
            let note: String = conn
                .query_row("SELECT note FROM test_data WHERE id = 1;", [], |row| row.get(0))
                .unwrap();
            assert_eq!(note, "hello legacy user");
        }
        drop(migrated_db);

        // Verify pre-rekey online backup was created
        let has_backup = std::fs::read_dir(&temp_dir).unwrap().filter_map(|e| e.ok()).any(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            name.starts_with("lifemirror-desktop.prerekey.") && name.ends_with(".bak")
        });
        assert!(has_backup, "Pre-rekey online backup should exist");

        // Verify opening with legacy key now fails
        let fail_conn = Connection::open(&db_path).unwrap();
        fail_conn.pragma_update(None, "key", &LEGACY_DEFAULT_KEY).unwrap();
        let fail_result: rusqlite::Result<String> = fail_conn.query_row("SELECT note FROM test_data WHERE id = 1;", [], |row| row.get(0));
        assert!(fail_result.is_err(), "Legacy key must no longer be able to read rekeyed database");

        // Verify opening with mock_store winning key succeeds
        let winning_key = mock_store.get_key().unwrap();
        let success_conn = Connection::open(&db_path).unwrap();
        success_conn.pragma_update(None, "key", &winning_key).unwrap();
        let verified_note: String = success_conn
            .query_row("SELECT note FROM test_data WHERE id = 1;", [], |row| row.get(0))
            .unwrap();
        assert_eq!(verified_note, "hello legacy user");

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_batch_get_memory_nodes_for_day() {
        let temp_dir = std::env::temp_dir().join(format!("lifemirror_test_{}", uuid::Uuid::new_v4().simple()));
        let _ = std::fs::create_dir_all(&temp_dir);
        let db_path = temp_dir.join("test_nodes.db");

        let mock_store = MockKeyStore::new();
        let db = DbState::init_or_migrate(&db_path, &mock_store).unwrap();
        let date_str = "2026-10-27";

        // Insert two memory nodes
        let node_id_1 = {
            let conn = db.conn.lock().unwrap();
            conn.execute(
                "INSERT INTO memory_nodes (title, summary, node_type, importance_score, confidence, status, timestamp)
                 VALUES ('Test Node 1', 'Summary 1', 'coding', 0.9, 0.95, 'active', '2026-10-27 10:00:00');",
                [],
            ).unwrap();
            conn.last_insert_rowid()
        };

        let node_id_2 = {
            let conn = db.conn.lock().unwrap();
            conn.execute(
                "INSERT INTO memory_nodes (title, summary, node_type, importance_score, confidence, status, timestamp)
                 VALUES ('Test Node 2', 'Summary 2', 'browsing', 0.7, 0.85, 'active', '2026-10-27 11:00:00');",
                [],
            ).unwrap();
            conn.last_insert_rowid()
        };

        // Insert activity log and link to node 1
        let act_id = {
            let conn = db.conn.lock().unwrap();
            conn.execute(
                "INSERT INTO activity_logs (app_name, window_title, start_time, duration, source)
                 VALUES ('VS Code', 'main.rs', '2026-10-27 10:00:00', 300, 'os');",
                [],
            ).unwrap();
            let aid = conn.last_insert_rowid();
            conn.execute(
                "INSERT INTO session_activities (node_id, raw_id, source) VALUES (?1, ?2, 'os');",
                params![node_id_1, aid],
            ).unwrap();
            aid
        };

        // Insert sub-event and link to node 2
        {
            let conn = db.conn.lock().unwrap();
            conn.execute(
                "INSERT INTO sub_session_events (session_type, parent_app_name, title, primary_uri, timestamp)
                 VALUES ('tab', 'Brave', 'Rust Docs', 'https://doc.rust-lang.org', '2026-10-27 11:00:00');",
                [],
            ).unwrap();
            let sid = conn.last_insert_rowid();
            conn.execute(
                "INSERT INTO session_activities (node_id, raw_id, source) VALUES (?1, ?2, 'browser');",
                params![node_id_2, sid],
            ).unwrap();
        }

        // Query memory nodes for day
        let nodes = db.get_memory_nodes_for_day(date_str).unwrap();
        assert_eq!(nodes.len(), 2);

        // Find node 1
        let n1 = nodes.iter().find(|n| n.id == Some(node_id_1)).unwrap();
        let acts = n1.activities.as_ref().unwrap();
        assert_eq!(acts.len(), 1);
        assert_eq!(acts[0].id, Some(act_id));
        assert_eq!(acts[0].app_name, "VS Code");

        // Find node 2
        let n2 = nodes.iter().find(|n| n.id == Some(node_id_2)).unwrap();
        let subs = n2.sub_events.as_ref().unwrap();
        assert_eq!(subs.len(), 1);
        assert_eq!(subs[0].title, "Rust Docs");

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_domain_exclusion_db_operations() {
        let temp_dir = std::env::temp_dir().join(format!("lifemirror_test_exclusion_{}", uuid::Uuid::new_v4().simple()));
        let _ = std::fs::create_dir_all(&temp_dir);
        let db_path = temp_dir.join("test.db");
        let db = DbState::new_with_key(&db_path, "test_pass_12345").unwrap();

        // 1. Add some initial activity logs and sub sessions
        let log1 = ActivityLog {
            id: None,
            app_name: "Google Chrome".to_string(),
            window_title: "Account Overview - Chase".to_string(),
            start_time: "2026-11-09T10:00:00Z".to_string(),
            duration: 120,
            source: "Browser".to_string(),
            url: Some("https://secure.chase.com/auth".to_string()),
            icon_url: None,
            domain_tag: Some("chase.com".to_string()),
            notes: Some("Monthly budget review note".to_string()),
        };
        db.insert_activity_log(&log1).unwrap();

        let sub1 = SubSessionEvent {
            id: None,
            session_type: "Browser".to_string(),
            parent_app_name: Some("Google Chrome".to_string()),
            title: "Chase Checking".to_string(),
            primary_uri: Some("https://secure.chase.com/checking".to_string()),
            icon_url: None,
            context_tag: Some("chase.com".to_string()),
            metadata: None,
            timestamp: "2026-11-09T10:01:00Z".to_string(),
            profile_id: None,
            profile_label: None,
            browser_name: None,
        };
        db.insert_sub_session_event(&sub1).unwrap();

        // 2. Preview purge
        let preview = db.preview_domain_purge("chase.com", true).unwrap();
        assert_eq!(preview.sub_sessions_count, 1);
        assert_eq!(preview.activity_logs_count, 1);
        assert_eq!(preview.attached_notes_count, 1);
        assert!(preview.matching_hosts.contains(&"secure.chase.com".to_string()));

        // 3. Add excluded domain with purge_history = true
        let report = db.add_excluded_domain("chase.com", true, true).unwrap();
        assert_eq!(report.sub_sessions_purged, 1);
        assert_eq!(report.activity_logs_purged, 1);
        assert_eq!(report.attached_notes_detached, 1);

        // 4. Verify notes were detached into journal_entries
        let unattached = db.get_unattached_journal_notes().unwrap();
        assert_eq!(unattached.len(), 1);
        assert_eq!(unattached[0].notes, "Monthly budget review note");

        // 5. Verify is_domain_excluded
        assert!(db.is_domain_excluded("chase.com"));
        assert!(db.is_domain_excluded("secure.chase.com"));
        assert!(!db.is_domain_excluded("other.com"));

        // 6. Test LWW merge and tombstones
        let now = chrono::Utc::now().timestamp_millis();
        let incoming = vec![
            ExclusionEntry {
                domain: "chase.com".to_string(),
                include_subdomains: true,
                updated_at: now + 1000,
                removed: true, // tombstone
            },
            ExclusionEntry {
                domain: "paypal.com".to_string(),
                include_subdomains: false,
                updated_at: now + 500,
                removed: false,
            },
        ];
        let merge_rep = db.merge_excluded_entries(incoming).unwrap();
        assert!(merge_rep.newly_unexcluded.contains(&"chase.com".to_string()));
        assert!(merge_rep.newly_excluded.iter().any(|e| e.domain == "paypal.com"));

        // Verify chase.com is now unexcluded
        assert!(!db.is_domain_excluded("chase.com"));
        // Verify paypal.com is now excluded
        assert!(db.is_domain_excluded("paypal.com"));
        // Verify paypal.com with include_subdomains = false doesn't match subdomains
        assert!(!db.is_domain_excluded("sandbox.paypal.com"));

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_sub_session_events_profile_isolation_and_cursor() {
        let temp_dir = std::env::temp_dir().join(format!("lifemirror_test_profile_{}", uuid::Uuid::new_v4()));
        let _ = std::fs::create_dir_all(&temp_dir);
        let db_path = temp_dir.join("test.db");

        let key_store = MockKeyStore::new();
        let db = DbState::init_or_migrate(&db_path, &key_store).unwrap();

        // 1. Insert 3 events for Work profile and 2 for Personal profile
        for i in 1..=3 {
            db.insert_sub_session_event(&SubSessionEvent {
                id: None,
                session_type: "Browser".to_string(),
                parent_app_name: Some("Google Chrome".to_string()),
                title: format!("Work Task {}", i),
                primary_uri: Some(format!("https://work.internal/task/{}", i)),
                icon_url: None,
                context_tag: Some("work.internal".to_string()),
                metadata: None,
                timestamp: format!("2026-11-10T10:0{}:00Z", i),
                profile_id: Some("prof_work".to_string()),
                profile_label: Some("Work".to_string()),
                browser_name: Some("Chrome".to_string()),
            }).unwrap();
        }

        for i in 1..=2 {
            db.insert_sub_session_event(&SubSessionEvent {
                id: None,
                session_type: "Browser".to_string(),
                parent_app_name: Some("Brave".to_string()),
                title: format!("Personal Video {}", i),
                primary_uri: Some(format!("https://youtube.com/watch?v={}", i)),
                icon_url: None,
                context_tag: Some("youtube.com".to_string()),
                metadata: None,
                timestamp: format!("2026-11-10T11:0{}:00Z", i),
                profile_id: Some("prof_personal".to_string()),
                profile_label: Some("Personal".to_string()),
                browser_name: Some("Brave".to_string()),
            }).unwrap();
        }

        // Test 1: Query Work profile only
        let (work_events, _) = db.get_sub_session_events_cursor(None, Some("prof_work"), None, 10).unwrap();
        assert_eq!(work_events.len(), 3);
        assert!(work_events.iter().all(|e| e.profile_id.as_deref() == Some("prof_work")));

        // Test 2: Query Personal profile only
        let (pers_events, _) = db.get_sub_session_events_cursor(None, Some("prof_personal"), None, 10).unwrap();
        assert_eq!(pers_events.len(), 2);
        assert!(pers_events.iter().all(|e| e.profile_id.as_deref() == Some("prof_personal")));

        // Test 3: Query All Profiles (profile_id = None)
        let (all_events, _) = db.get_sub_session_events_cursor(None, None, None, 10).unwrap();
        assert_eq!(all_events.len(), 5);

        // Test 4: Keyset pagination with cursor
        let (page1, cursor1) = db.get_sub_session_events_cursor(None, None, None, 2).unwrap();
        assert_eq!(page1.len(), 2);
        assert!(cursor1.is_some());

        let (page2, cursor2) = db.get_sub_session_events_cursor(None, None, cursor1.as_deref(), 2).unwrap();
        assert_eq!(page2.len(), 2);
        assert!(cursor2.is_some());
        // Verify no overlap between page 1 and page 2
        assert_ne!(page1[0].id, page2[0].id);
        assert_ne!(page1[1].id, page2[1].id);

        // Test 5: Top sites summary
        let top_sites = db.get_top_sites_summary(None, Some("prof_work"), 5).unwrap();
        assert_eq!(top_sites.len(), 1);
        assert_eq!(top_sites[0].domain, "work.internal");
        assert_eq!(top_sites[0].visit_count, 3);

        // Test 6: Scoped deletion
        let count = db.delete_sub_session_event_scoped(work_events[0].id.unwrap(), Some("prof_work")).unwrap();
        assert_eq!(count, 1);
        let (work_remaining, _) = db.get_sub_session_events_cursor(None, Some("prof_work"), None, 10).unwrap();
        assert_eq!(work_remaining.len(), 2);

        // Test 7: Desktop today summary
        let summary = db.get_desktop_today_summary(Some("2026-11-10"), Some("prof_work")).unwrap();
        assert_eq!(summary.context_switches, 2);
        assert_eq!(summary.total_active_seconds, 120);
        assert_eq!(summary.domains_count, 1);
        assert_eq!(summary.hourly.len(), 24);

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_ai_provider_and_processing_modes() {
        use std::str::FromStr;

        // Provider parsing & display
        assert_eq!(AiProviderMode::from_str("off").unwrap(), AiProviderMode::Off);
        assert_eq!(AiProviderMode::from_str("disabled").unwrap(), AiProviderMode::Off);
        assert_eq!(AiProviderMode::from_str("cloud").unwrap(), AiProviderMode::Cloud);
        assert_eq!(AiProviderMode::from_str("local").unwrap(), AiProviderMode::Local);
        assert_eq!(AiProviderMode::from_str("unknown").unwrap(), AiProviderMode::Local);
        assert_eq!(AiProviderMode::default(), AiProviderMode::Local);
        assert_eq!(AiProviderMode::Off.to_string(), "off");
        assert_eq!(AiProviderMode::Cloud.to_string(), "cloud");
        assert_eq!(AiProviderMode::Local.to_string(), "local");

        // Processing mode parsing & display
        assert_eq!(AiProcessingMode::from_str("continuous").unwrap(), AiProcessingMode::Continuous);
        assert_eq!(AiProcessingMode::from_str("on_demand").unwrap(), AiProcessingMode::OnDemand);
        assert_eq!(AiProcessingMode::from_str("").unwrap(), AiProcessingMode::OnDemand);
        assert_eq!(AiProcessingMode::default(), AiProcessingMode::OnDemand);
        assert_eq!(AiProcessingMode::Continuous.to_string(), "continuous");
        assert_eq!(AiProcessingMode::OnDemand.to_string(), "on_demand");

        // DbState integration
        let temp_dir = std::env::temp_dir().join(format!("lifemirror_test_modes_{}", uuid::Uuid::new_v4().simple()));
        let _ = std::fs::create_dir_all(&temp_dir);
        let db_path = temp_dir.join("test.db");

        let db = DbState::new_with_key(&db_path, "test_pass_12345").unwrap();
        // Defaults on initial db
        assert_eq!(db.get_ai_processing_mode(), AiProcessingMode::OnDemand);
        assert_eq!(db.get_ai_provider_mode(), AiProviderMode::Local);

        // Explicit set
        db.set_setting("ai_provider", "off").unwrap();
        assert_eq!(db.get_ai_provider_mode(), AiProviderMode::Off);

        db.set_setting("ai_provider", "cloud").unwrap();
        assert_eq!(db.get_ai_provider_mode(), AiProviderMode::Cloud);

        db.set_setting("ai_processing_mode", "continuous").unwrap();
        assert_eq!(db.get_ai_processing_mode(), AiProcessingMode::Continuous);

        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}

