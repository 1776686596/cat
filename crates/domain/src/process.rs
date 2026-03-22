use crate::alert::AlertRecord;
use crate::flow::{FlowSession, LiveConnection, TrafficCounters};
use crate::UnixMillis;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Default)]
pub struct ProcessRef {
    pub pid: u32,
    pub parent_pid: Option<u32>,
    pub name: String,
    pub parent_name: Option<String>,
    pub executable_path: Option<String>,
}

impl ProcessRef {
    pub fn display_name(&self) -> &str {
        if self.name.is_empty() {
            "unknown"
        } else {
            self.name.as_str()
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct ProcessTrafficSummary {
    pub process: ProcessRef,
    pub cumulative_counters: TrafficCounters,
    pub destination_count: usize,
    pub last_active_at: UnixMillis,
    pub has_active_alert: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct ProcessDetailSnapshot {
    pub process: ProcessRef,
    pub cumulative_counters: TrafficCounters,
    pub active_connections: Vec<LiveConnection>,
    pub recent_sessions: Vec<FlowSession>,
    pub recent_alerts: Vec<AlertRecord>,
    pub last_active_at: Option<UnixMillis>,
}
