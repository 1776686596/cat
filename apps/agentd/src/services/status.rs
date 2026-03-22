use traffic_cat_domain::{CaptureMode, ServiceHealth};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AgentStatus {
    pub service_status: ServiceHealth,
    pub capture_mode: CaptureMode,
    pub permission_status: ServiceHealth,
    pub db_status: ServiceHealth,
    pub degraded_reason: Option<String>,
}
