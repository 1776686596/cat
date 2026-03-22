use traffic_cat_domain::TrafficDirection;
use traffic_cat_domain::UnixMillis;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AgentRequest {
    Ping,
    GetRealtimeSnapshot,
    ListProcessSummaries,
    GetProcessDetail(ProcessDetailQuery),
    QueryHistory(HistoryQuery),
    GetRecentAlerts { limit: usize },
    GetHealthSnapshot,
    PauseAlerts(PauseAlertsRequest),
    SetLanTrafficVisibility(LanTrafficVisibilityRequest),
    OpenEventStream(SubscriptionRequest),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProcessDetailQuery {
    pub pid: u32,
    pub include_closed_sessions: bool,
    pub recent_limit: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HistoryQuery {
    pub process_name: Option<String>,
    pub target: Option<String>,
    pub port: Option<u16>,
    pub direction: Option<TrafficDirection>,
    pub started_after: Option<UnixMillis>,
    pub ended_before: Option<UnixMillis>,
    pub include_lan_traffic: bool,
    pub limit: usize,
    pub offset: usize,
}

impl Default for HistoryQuery {
    fn default() -> Self {
        Self {
            process_name: None,
            target: None,
            port: None,
            direction: None,
            started_after: None,
            ended_before: None,
            include_lan_traffic: false,
            limit: 100,
            offset: 0,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PauseAlertsRequest {
    pub minutes: u16,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LanTrafficVisibilityRequest {
    pub visible: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubscriptionRequest {
    pub topics: Vec<SubscriptionTopic>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SubscriptionTopic {
    Realtime,
    Alerts,
    Health,
}
