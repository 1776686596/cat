use crate::enums::{CaptureMode, ServiceHealth};
use crate::UnixMillis;

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct PermissionHealth {
    pub ready: bool,
    pub details: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct CaptureHealth {
    pub mode: CaptureMode,
    pub state: ServiceHealth,
    pub last_sample_at: Option<UnixMillis>,
    pub details: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct StoreHealth {
    pub state: ServiceHealth,
    pub database_path: String,
    pub pending_flush_items: usize,
    pub last_flush_at: Option<UnixMillis>,
    pub soft_limit_bytes: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct AgentHealthSnapshot {
    pub generated_at: UnixMillis,
    pub uds_path: String,
    pub permissions: PermissionHealth,
    pub capture: CaptureHealth,
    pub store: StoreHealth,
}

impl AgentHealthSnapshot {
    pub fn is_ready(&self) -> bool {
        self.permissions.ready
            && self.capture.state != ServiceHealth::Unavailable
            && self.store.state != ServiceHealth::Unavailable
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn health_snapshot_reports_ready_only_when_all_services_available() {
        let ready = AgentHealthSnapshot {
            permissions: PermissionHealth {
                ready: true,
                details: None,
            },
            capture: CaptureHealth {
                state: ServiceHealth::Healthy,
                ..CaptureHealth::default()
            },
            store: StoreHealth {
                state: ServiceHealth::Degraded,
                ..StoreHealth::default()
            },
            ..AgentHealthSnapshot::default()
        };

        let unavailable = AgentHealthSnapshot {
            store: StoreHealth {
                state: ServiceHealth::Unavailable,
                ..StoreHealth::default()
            },
            ..ready.clone()
        };

        assert!(ready.is_ready());
        assert!(!unavailable.is_ready());
    }
}
