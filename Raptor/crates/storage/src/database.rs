fn clean_persisted_name(name: &str) -> String {
    if name.contains('�') {
        name.replace("G�REV", "GÖREV")
            .replace("D�KKAN", "DÜKKAN")
            .replace('�', "")
    } else {
        name.to_string()
    }
}
use hyperdownload_shared::{
    DownloadError, DownloadId, DownloadMetadata, DownloadStatus, DownloadTaskInfo,
    PersistedSegment, Result,
};
use rusqlite::{params, Connection};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tracing::info;
use uuid::Uuid;

pub struct StateDatabase {
    conn: Arc<Mutex<Connection>>,
}

impl StateDatabase {
    pub fn open(db_path: &Path) -> Result<Self> {
        info!("Opening state database at {:?}", db_path);
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| DownloadError::Io(e.to_string()))?;
        }

        let conn = Connection::open(db_path).map_err(|e| DownloadError::Internal(e.to_string()))?;

        // Enable WAL mode for high concurrent throughput and crash resilience
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             PRAGMA foreign_keys = ON;",
        )
        .map_err(|e| DownloadError::Internal(e.to_string()))?;

        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        db.init_schema()?;
        Ok(db)
    }

    pub fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory().map_err(|e| DownloadError::Internal(e.to_string()))?;
        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        db.init_schema()?;
        Ok(db)
    }

    fn init_schema(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS downloads (
                id TEXT PRIMARY KEY,
                url TEXT NOT NULL,
                file_name TEXT NOT NULL,
                destination_path TEXT NOT NULL,
                total_bytes INTEGER,
                downloaded_bytes INTEGER DEFAULT 0,
                status TEXT NOT NULL,
                category TEXT DEFAULT 'General',
                queue_id TEXT,
                etag TEXT,
                last_modified TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS segments (
                download_id TEXT NOT NULL,
                worker_id INTEGER NOT NULL,
                start_byte INTEGER NOT NULL,
                current_byte INTEGER NOT NULL,
                end_byte INTEGER NOT NULL,
                PRIMARY KEY (download_id, worker_id),
                FOREIGN KEY (download_id) REFERENCES downloads(id) ON DELETE CASCADE
            );",
        )
        .map_err(|e| DownloadError::Internal(e.to_string()))?;
        Ok(())
    }

    pub fn insert_task(&self, task: &DownloadTaskInfo, meta: &DownloadMetadata) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let status_str = match &task.status {
            DownloadStatus::Queued => "Queued",
            DownloadStatus::Probing => "Probing",
            DownloadStatus::Allocating => "Allocating",
            DownloadStatus::Downloading => "Downloading",
            DownloadStatus::Paused => "Paused",
            DownloadStatus::Completed => "Completed",
            DownloadStatus::Failed(e) => e.as_str(),
        };

        conn.execute(
            "INSERT INTO downloads (id, url, file_name, destination_path, total_bytes, downloaded_bytes, status, category, queue_id, etag, last_modified)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
             ON CONFLICT(id) DO UPDATE SET
                downloaded_bytes = excluded.downloaded_bytes,
                status = excluded.status",
            params![
                task.id.to_string(),
                task.url,
                task.file_name,
                task.destination_path.to_string_lossy(),
                task.total_bytes,
                task.downloaded_bytes,
                status_str,
                task.category,
                task.queue_id,
                meta.etag,
                meta.last_modified
            ],
        )
        .map_err(|e| DownloadError::Internal(e.to_string()))?;
        Ok(())
    }

    pub fn update_progress(&self, id: &DownloadId, downloaded: u64, status: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE downloads SET downloaded_bytes = ?1, status = ?2 WHERE id = ?3",
            params![downloaded, status, id.to_string()],
        )
        .map_err(|e| DownloadError::Internal(e.to_string()))?;
        Ok(())
    }

    pub fn update_task_completed(
        &self,
        id: &DownloadId,
        file_name: &str,
        destination_path: &std::path::Path,
        total_bytes: u64,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE downloads SET file_name = ?1, destination_path = ?2, total_bytes = ?3, downloaded_bytes = ?3, status = 'Completed' WHERE id = ?4",
            params![file_name, destination_path.to_string_lossy(), total_bytes, id.to_string()],
        )
        .map_err(|e| DownloadError::Internal(e.to_string()))?;
        Ok(())
    }

    pub fn save_segments(&self, download_id: &DownloadId, segments: &[PersistedSegment]) -> Result<()> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction().map_err(|e| DownloadError::Internal(e.to_string()))?;

        tx.execute("DELETE FROM segments WHERE download_id = ?1", params![download_id.to_string()])
            .map_err(|e| DownloadError::Internal(e.to_string()))?;

        for seg in segments {
            tx.execute(
                "INSERT INTO segments (download_id, worker_id, start_byte, current_byte, end_byte)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    download_id.to_string(),
                    seg.worker_id as i64,
                    seg.start_byte as i64,
                    seg.current_byte as i64,
                    seg.end_byte as i64
                ],
            )
            .map_err(|e| DownloadError::Internal(e.to_string()))?;
        }

        tx.commit().map_err(|e| DownloadError::Internal(e.to_string()))?;
        Ok(())
    }

    pub fn get_segments(&self, download_id: &DownloadId) -> Result<Vec<PersistedSegment>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT worker_id, start_byte, current_byte, end_byte FROM segments WHERE download_id = ?1 ORDER BY worker_id ASC")
            .map_err(|e| DownloadError::Internal(e.to_string()))?;

        let rows = stmt
            .query_map(params![download_id.to_string()], |row| {
                Ok(PersistedSegment {
                    worker_id: row.get::<_, i64>(0)? as usize,
                    start_byte: row.get::<_, i64>(1)? as u64,
                    current_byte: row.get::<_, i64>(2)? as u64,
                    end_byte: row.get::<_, i64>(3)? as u64,
                })
            })
            .map_err(|e| DownloadError::Internal(e.to_string()))?;

        let mut segments = Vec::new();
        for row in rows {
            segments.push(row.map_err(|e| DownloadError::Internal(e.to_string()))?);
        }
        Ok(segments)
    }

    pub fn get_task(&self, id: &DownloadId) -> Result<Option<DownloadTaskInfo>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT id, url, file_name, destination_path, total_bytes, downloaded_bytes, status, category, queue_id FROM downloads WHERE id = ?1")
            .map_err(|e| DownloadError::Internal(e.to_string()))?;

        let mut rows = stmt
            .query_map(params![id.to_string()], |row| {
                let id_str: String = row.get(0)?;
                let status_str: String = row.get(6)?;
                let dest_str: String = row.get(3)?;

                let parsed_id = Uuid::parse_str(&id_str)
                    .map(DownloadId)
                    .unwrap_or_else(|_| *id);

                let status = match status_str.as_str() {
                    "Queued" => DownloadStatus::Queued,
                    "Allocating" => DownloadStatus::Allocating,
                    "Downloading" => DownloadStatus::Downloading,
                    "Paused" => DownloadStatus::Paused,
                    "Completed" => DownloadStatus::Completed,
                    other => DownloadStatus::Failed(other.to_string()),
                };

                Ok(DownloadTaskInfo {
                    id: parsed_id,
                    url: row.get(1)?,
                    file_name: clean_persisted_name(&row.get::<_, String>(2)?),
                    destination_path: PathBuf::from(dest_str),
                    total_bytes: row.get(4)?,
                    downloaded_bytes: row.get::<_, i64>(5)? as u64,
                    status,
                    active_connections: 0,
                    current_speed_bps: 0,
                    eta_seconds: None,
                    category: row.get(7)?,
                    queue_id: row.get(8)?,
                })
            })
            .map_err(|e| DownloadError::Internal(e.to_string()))?;

        if let Some(first) = rows.next() {
            let task = first.map_err(|e| DownloadError::Internal(e.to_string()))?;
            Ok(Some(task))
        } else {
            Ok(None)
        }
    }

    pub fn get_task_metadata(&self, id: &DownloadId) -> Result<Option<(Option<String>, Option<String>)>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT etag, last_modified FROM downloads WHERE id = ?1")
            .map_err(|e| DownloadError::Internal(e.to_string()))?;

        let mut rows = stmt
            .query_map(params![id.to_string()], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .map_err(|e| DownloadError::Internal(e.to_string()))?;

        if let Some(first) = rows.next() {
            let meta = first.map_err(|e| DownloadError::Internal(e.to_string()))?;
            Ok(Some(meta))
        } else {
            Ok(None)
        }
    }

    pub fn list_tasks(&self) -> Result<Vec<DownloadTaskInfo>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT id, url, file_name, destination_path, total_bytes, downloaded_bytes, status, category, queue_id FROM downloads ORDER BY created_at DESC")
            .map_err(|e| DownloadError::Internal(e.to_string()))?;

        let rows = stmt
            .query_map([], |row| {
                let id_str: String = row.get(0)?;
                let status_str: String = row.get(6)?;
                let dest_str: String = row.get(3)?;

                let parsed_id = Uuid::parse_str(&id_str)
                    .map(DownloadId)
                    .unwrap_or_else(|_| DownloadId::new());

                let status = match status_str.as_str() {
                    "Queued" => DownloadStatus::Queued,
                    "Allocating" => DownloadStatus::Allocating,
                    "Downloading" => DownloadStatus::Downloading,
                    "Paused" => DownloadStatus::Paused,
                    "Completed" => DownloadStatus::Completed,
                    other => DownloadStatus::Failed(other.to_string()),
                };

                Ok(DownloadTaskInfo {
                    id: parsed_id,
                    url: row.get(1)?,
                    file_name: clean_persisted_name(&row.get::<_, String>(2)?),
                    destination_path: PathBuf::from(dest_str),
                    total_bytes: row.get(4)?,
                    downloaded_bytes: row.get::<_, i64>(5)? as u64,
                    status,
                    active_connections: 0,
                    current_speed_bps: 0,
                    eta_seconds: None,
                    category: row.get(7)?,
                    queue_id: row.get(8)?,
                })
            })
            .map_err(|e| DownloadError::Internal(e.to_string()))?;

        let mut tasks = Vec::new();
        for row in rows {
            tasks.push(row.map_err(|e| DownloadError::Internal(e.to_string()))?);
        }
        Ok(tasks)
    }

    pub fn delete_task(&self, id: &DownloadId) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM downloads WHERE id = ?1", params![id.to_string()])
            .map_err(|e| DownloadError::Internal(e.to_string()))?;
        Ok(())
    }

    pub fn get_download_count(&self) -> Result<usize> {
        let conn = self.conn.lock().unwrap();
        let count: usize = conn
            .query_row("SELECT COUNT(*) FROM downloads", [], |row| row.get(0))
            .map_err(|e| DownloadError::Internal(e.to_string()))?;
        Ok(count)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use hyperdownload_shared::{DownloadId, DownloadMetadata, DownloadStatus, DownloadTaskInfo};
    use std::path::PathBuf;

    #[test]
    fn test_sqlite_state_persistence_and_segments() {
        let db = StateDatabase::open_in_memory().expect("Failed to open in-memory database");
        assert_eq!(db.get_download_count().unwrap(), 0);

        let id = DownloadId::new();
        let task = DownloadTaskInfo {
            id,
            url: "https://example.com/test.zip".to_string(),
            destination_path: PathBuf::from("C:\\Downloads\\test.zip"),
            file_name: "test.zip".to_string(),
            total_bytes: Some(1048576),
            downloaded_bytes: 0,
            status: DownloadStatus::Downloading,
            active_connections: 4,
            current_speed_bps: 500000,
            eta_seconds: Some(2),
            category: "Compressed".to_string(),
            queue_id: None,
        };

        let meta = DownloadMetadata {
            url: task.url.clone(),
            final_url: Some(task.url.clone()),
            file_name: task.file_name.clone(),
            content_length: task.total_bytes,
            accept_ranges: true,
            etag: Some("\"xyz\"".to_string()),
            last_modified: None,
            content_type: Some("application/zip".to_string()),
        };

        db.insert_task(&task, &meta).expect("Failed to insert task");
        assert_eq!(db.get_download_count().unwrap(), 1);

        // Test segment saving & loading
        let segs = vec![
            PersistedSegment {
                worker_id: 0,
                start_byte: 0,
                current_byte: 250000,
                end_byte: 500000,
            },
            PersistedSegment {
                worker_id: 1,
                start_byte: 500001,
                current_byte: 750000,
                end_byte: 1048575,
            },
        ];

        db.save_segments(&id, &segs).expect("Failed to save segments");
        let loaded_segs = db.get_segments(&id).expect("Failed to get segments");
        assert_eq!(loaded_segs.len(), 2);
        assert_eq!(loaded_segs[0].current_byte, 250000);

        // Test retrieval
        let loaded_task = db.get_task(&id).expect("Failed to load task").expect("Task not found");
        assert_eq!(loaded_task.file_name, "test.zip");

        db.update_progress(&id, 1048576, "Completed").expect("Failed to update progress");
        let tasks = db.list_tasks().expect("Failed to list tasks");
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].status, DownloadStatus::Completed);
    }
}
