use traffic_cat_domain::UnixMillis;

const MILLIS_PER_DAY: i64 = 24 * 60 * 60 * 1_000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DatabaseStats {
    pub now: UnixMillis,
    pub file_size_bytes: u64,
    pub oldest_flow_started_at: Option<UnixMillis>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PruneReason {
    RetentionExceeded,
    SizeExceeded,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct PrunePlan {
    pub reasons: Vec<PruneReason>,
    pub delete_before: Option<UnixMillis>,
    pub target_size_bytes: Option<u64>,
}

impl PrunePlan {
    pub fn is_needed(&self) -> bool {
        !self.reasons.is_empty()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct PruneReport {
    pub deleted_flow_sessions: usize,
    pub deleted_rollups: usize,
    pub deleted_alerts: usize,
    pub reclaimed_bytes_estimate: u64,
}

pub fn build_prune_plan(
    stats: &DatabaseStats,
    retention_days: u16,
    soft_limit_bytes: u64,
) -> PrunePlan {
    let mut plan = PrunePlan::default();

    if let Some(oldest_started_at) = stats.oldest_flow_started_at {
        let retention_threshold = stats
            .now
            .saturating_sub(i64::from(retention_days) * MILLIS_PER_DAY);
        if oldest_started_at < retention_threshold {
            plan.reasons.push(PruneReason::RetentionExceeded);
            plan.delete_before = Some(retention_threshold);
        }
    }

    if stats.file_size_bytes > soft_limit_bytes {
        plan.reasons.push(PruneReason::SizeExceeded);
        plan.target_size_bytes = Some(soft_limit_bytes);
        if plan.delete_before.is_none() {
            plan.delete_before = stats.oldest_flow_started_at;
        }
    }

    plan
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prune_plan_marks_retention_and_size_triggers() {
        let stats = DatabaseStats {
            now: 31 * MILLIS_PER_DAY,
            file_size_bytes: 600,
            oldest_flow_started_at: Some(0),
        };

        let plan = build_prune_plan(&stats, 30, 512);
        assert!(plan.reasons.contains(&PruneReason::RetentionExceeded));
        assert!(plan.reasons.contains(&PruneReason::SizeExceeded));
        assert!(plan.is_needed());
    }
}
