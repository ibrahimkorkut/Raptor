use hyperdownload_shared::DownloadId;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadQueue {
    pub id: String,
    pub name: String,
    pub max_active_downloads: usize,
    pub items: VecDeque<DownloadId>,
}

impl DownloadQueue {
    pub fn new(id: &str, name: &str, max_active: usize) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            max_active_downloads: max_active,
            items: VecDeque::new(),
        }
    }
}

#[derive(Clone)]
pub struct QueueManager {
    queues: Arc<Mutex<Vec<DownloadQueue>>>,
}

impl QueueManager {
    pub fn new() -> Self {
        let main_queue = DownloadQueue::new("main", "Main Download Queue", 2);
        let sync_queue = DownloadQueue::new("sync", "Synchronization Queue", 1);

        Self {
            queues: Arc::new(Mutex::new(vec![main_queue, sync_queue])),
        }
    }

    pub async fn add_to_queue(&self, queue_id: &str, item_id: DownloadId) -> bool {
        let mut qs = self.queues.lock().await;
        if let Some(q) = qs.iter_mut().find(|q| q.id == queue_id) {
            q.items.push_back(item_id);
            true
        } else {
            false
        }
    }
}

impl Default for QueueManager {
    fn default() -> Self {
        Self::new()
    }
}
