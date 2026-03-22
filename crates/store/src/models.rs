use traffic_cat_domain::{
    AlertKind, AlertSeverity, CaptureMode, ConnectionState, HostnameSource, TrafficDirection,
    TransportProtocol, UnixMillis,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProcessSnapshotRow {
    pub id: String,
    pub pid: u32,
    pub parent_pid: Option<u32>,
    pub process_name: String,
    pub process_path: Option<String>,
    pub first_seen_at: UnixMillis,
    pub last_seen_at: UnixMillis,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FlowSessionRow {
    pub id: String,
    pub process_snapshot_id: String,
    pub protocol: TransportProtocol,
    pub direction: TrafficDirection,
    pub remote_host: Option<String>,
    pub host_source: HostnameSource,
    pub remote_ip: String,
    pub remote_port: u16,
    pub first_seen_at: UnixMillis,
    pub last_seen_at: UnixMillis,
    pub tx_bytes: u64,
    pub rx_bytes: u64,
    pub state: ConnectionState,
    pub capture_mode: CaptureMode,
    pub is_lan_traffic: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FlowEventRollupRow {
    pub id: String,
    pub flow_session_id: String,
    pub bucket_start_at: UnixMillis,
    pub tx_bytes_delta: u64,
    pub rx_bytes_delta: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AlertRecordRow {
    pub id: String,
    pub process_snapshot_id: String,
    pub alert_type: AlertKind,
    pub severity: AlertSeverity,
    pub title: String,
    pub body: String,
    pub created_at: UnixMillis,
    pub dedupe_key: String,
    pub status: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppSettingRow {
    pub key: String,
    pub value: String,
    pub updated_at: UnixMillis,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct HistoryFilter {
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

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct PersistBatch {
    pub process_snapshots: Vec<ProcessSnapshotRow>,
    pub flow_sessions: Vec<FlowSessionRow>,
    pub flow_rollups: Vec<FlowEventRollupRow>,
    pub alerts: Vec<AlertRecordRow>,
    pub settings: Vec<AppSettingRow>,
}

impl PersistBatch {
    pub fn is_empty(&self) -> bool {
        self.process_snapshots.is_empty()
            && self.flow_sessions.is_empty()
            && self.flow_rollups.is_empty()
            && self.alerts.is_empty()
            && self.settings.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn persist_batch_detects_empty_batches() {
        let empty = PersistBatch::default();
        assert!(empty.is_empty());

        let non_empty = PersistBatch {
            settings: vec![AppSettingRow {
                key: "ui.show_lan".to_string(),
                value: "false".to_string(),
                updated_at: 0,
            }],
            ..PersistBatch::default()
        };
        assert!(!non_empty.is_empty());
    }
}
