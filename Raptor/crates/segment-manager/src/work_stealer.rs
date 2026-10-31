use hyperdownload_shared::ByteRange;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

pub const MIN_BISECTION_CHUNK_SIZE: u64 = 512 * 1024; // 512 KB

#[derive(Debug)]
pub struct ActiveSegment {
    pub id: usize,
    pub start: u64,
    pub current: Arc<AtomicU64>,
    pub end: Arc<AtomicU64>,
}

impl ActiveSegment {
    pub fn new(id: usize, start: u64, end: u64) -> Self {
        Self {
            id,
            start,
            current: Arc::new(AtomicU64::new(start)),
            end: Arc::new(AtomicU64::new(end)),
        }
    }

    pub fn current_pos(&self) -> u64 {
        self.current.load(Ordering::Acquire)
    }

    pub fn end_pos(&self) -> u64 {
        self.end.load(Ordering::Acquire)
    }

    pub fn remaining(&self) -> u64 {
        let cur = self.current_pos();
        let end = self.end_pos();
        if end >= cur {
            end - cur + 1
        } else {
            0
        }
    }
}

pub struct WorkStealer;

impl WorkStealer {
    /// Inspects active segments and steals the upper half of the segment with the largest remaining byte delta.
    /// Returns Some((victim_segment_id, new_range)) if a viable split is found.
    pub fn try_steal_chunk(
        segments: &[ActiveSegment],
        min_split_size: u64,
    ) -> Option<(usize, ByteRange)> {
        let mut best_victim: Option<(usize, u64)> = None;

        for seg in segments {
            let rem = seg.remaining();
            if rem >= min_split_size * 2 {
                if let Some((_, max_rem)) = best_victim {
                    if rem > max_rem {
                        best_victim = Some((seg.id, rem));
                    }
                } else {
                    best_victim = Some((seg.id, rem));
                }
            }
        }

        if let Some((victim_id, rem)) = best_victim {
            if let Some(victim) = segments.iter().find(|s| s.id == victim_id) {
                let cur = victim.current_pos();
                let end = victim.end_pos();
                let mid = cur + (rem / 2);

                // Atomically truncate victim's end position
                victim.end.store(mid, Ordering::Release);

                let stolen_range = ByteRange::new(mid + 1, end);
                return Some((victim_id, stolen_range));
            }
        }

        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dynamic_work_stealing() {
        let segments = vec![
            ActiveSegment::new(0, 0, 100_000),             // 100 KB - too small to split
            ActiveSegment::new(1, 100_001, 10_000_000),     // ~9.9 MB - prime candidate
        ];

        let result = WorkStealer::try_steal_chunk(&segments, 512 * 1024);
        assert!(result.is_some());
        let (victim_id, new_range) = result.unwrap();
        assert_eq!(victim_id, 1);
        assert!(new_range.start > 100_001);
        assert_eq!(new_range.end, 10_000_000);
    }
}
