use governor::clock::DefaultClock;
use governor::state::direct::NotKeyed;
use governor::state::InMemoryState;
use governor::{Quota, RateLimiter};
use std::num::NonZeroU32;
use std::sync::{Arc, RwLock};

type DirectLimiter = RateLimiter<NotKeyed, InMemoryState, DefaultClock>;

/// Byte-rate limiter shared by every clone.
///
/// All clones point at the same inner cell, so calling [`set_bytes_per_sec`]
/// on any clone immediately re-limits every worker that holds a clone
/// (including workers that are already streaming).
#[derive(Clone)]
pub struct AsyncSpeedLimiter {
    limiter: Arc<RwLock<Option<Arc<DirectLimiter>>>>,
}

impl AsyncSpeedLimiter {
    pub fn unlimited() -> Self {
        Self {
            limiter: Arc::new(RwLock::new(None)),
        }
    }

    pub fn with_bytes_per_sec(bytes_per_sec: u64) -> Self {
        let s = Self::unlimited();
        s.set_bytes_per_sec(bytes_per_sec);
        s
    }

    /// Changes the limit for every clone. `0` removes the limit.
    pub fn set_bytes_per_sec(&self, bytes_per_sec: u64) {
        let new_limiter = if bytes_per_sec == 0 {
            None
        } else {
            let non_zero_bytes = NonZeroU32::new(bytes_per_sec.min(u32::MAX as u64) as u32)
                .unwrap_or_else(|| NonZeroU32::new(1024 * 1024).unwrap());
            Some(Arc::new(RateLimiter::direct(Quota::per_second(non_zero_bytes))))
        };
        if let Ok(mut guard) = self.limiter.write() {
            *guard = new_limiter;
        }
    }

    pub fn is_limited(&self) -> bool {
        self.limiter.read().map(|g| g.is_some()).unwrap_or(false)
    }

    pub async fn throttle(&self, bytes_to_consume: usize) {
        // Clone the Arc out so the lock is not held across the await.
        let current = self.limiter.read().ok().and_then(|g| g.clone());
        if let Some(limiter) = current {
            if let Ok(cells) = NonZeroU32::try_from(bytes_to_consume as u32) {
                let _ = limiter.until_n_ready(cells).await;
            }
        }
    }
}
