use traffic_cat_domain::{
    AgentHealthSnapshot, AlertRecord, CaptureMode, FlowSession, LiveConnection,
    ProcessDetailSnapshot, ProcessTrafficSummary, UnixMillis, WidgetPetState,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AgentResponse {
    Pong,
    Ack(Ack),
    RealtimeSnapshot(RealtimeSnapshot),
    ProcessSummaries(Vec<ProcessTrafficSummary>),
    ProcessDetail(Option<ProcessDetailSnapshot>),
    HistoryPage(HistoryPage),
    RecentAlerts(Vec<AlertRecord>),
    Health(AgentHealthSnapshot),
    Error(ApiError),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Ack {
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RealtimeSnapshot {
    pub generated_at: UnixMillis,
    pub widget_state: WidgetPetState,
    pub capture_mode: CaptureMode,
    pub upload_rate_bytes_per_sec: u64,
    pub download_rate_bytes_per_sec: u64,
    pub headline: Option<String>,
    pub active_connections: Vec<LiveConnection>,
    pub recent_alert_count: usize,
    pub agent_available: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HistoryPage {
    pub items: Vec<FlowSession>,
    pub total: usize,
    pub limit: usize,
    pub offset: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ApiError {
    pub code: ErrorCode,
    pub message: String,
    pub retryable: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ErrorCode {
    InvalidRequest,
    NotFound,
    PermissionDenied,
    AgentUnavailable,
    Internal,
}
