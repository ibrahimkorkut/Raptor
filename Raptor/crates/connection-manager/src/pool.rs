use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::warn;

pub const DEFAULT_MAX_CONNECTIONS_PER_SERVER: usize = 8;
pub const HARD_MAX_CONNECTIONS: usize = 32;

/// Connection throttling manager tracking concurrent connections per host (MCN).
#[derive(Clone, Default)]
pub struct HostConnectionLimiter {
    active_counts: Arc<Mutex<HashMap<String, usize>>>,
}

impl HostConnectionLimiter {
    pub fn new() -> Self {
        Self {
            active_counts: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn can_acquire(&self, host: &str, limit: usize) -> bool {
        let counts = self.active_counts.lock().await;
        let current = counts.get(host).copied().unwrap_or(0);
        current < limit
    }

    pub async fn acquire(&self, host: &str) -> Option<ConnectionPermit> {
        let mut counts = self.active_counts.lock().await;
        let current = counts.entry(host.to_string()).or_insert(0);
        if *current < HARD_MAX_CONNECTIONS {
            *current += 1;
            Some(ConnectionPermit {
                host: host.to_string(),
                limiter: self.clone(),
            })
        } else {
            warn!("Host {} reached maximum connection limit ({})", host, HARD_MAX_CONNECTIONS);
            None
        }
    }

    async fn release(&self, host: &str) {
        let mut counts = self.active_counts.lock().await;
        if let Some(count) = counts.get_mut(host) {
            if *count > 0 {
                *count -= 1;
            }
        }
    }
}

pub struct ConnectionPermit {
    host: String,
    limiter: HostConnectionLimiter,
}

impl Drop for ConnectionPermit {
    fn drop(&mut self) {
        let host = self.host.clone();
        let limiter = self.limiter.clone();
        tokio::spawn(async move {
            limiter.release(&host).await;
        });
    }
}
