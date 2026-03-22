use std::collections::HashMap;
use std::fmt::{Display, Formatter};
use std::sync::{Arc, Mutex, RwLock};

use traffic_cat_capture::{CaptureCollector, CaptureError, ObservedFlow};
use traffic_cat_domain::{
    AgentHealthSnapshot, AlertKind, AlertRecord, AlertSeverity, AlertStatus, CaptureHealth,
    CaptureMode, FlowKey, FlowSession, HostnameSource, LiveConnection, PermissionHealth,
    ProcessDetailSnapshot, ProcessTrafficSummary, ResolvedTarget, ServiceHealth, StoreHealth,
    TrafficCounters, TrafficDirection, TrafficRate, UnixMillis, WidgetPetState,
};
use traffic_cat_ipc::{HistoryPage, HistoryQuery, RealtimeSnapshot};
use traffic_cat_settings::AgentSettings;
use traffic_cat_store::{
    AlertRecordRow, AppSettingRow, FlowSessionRow, PersistBatch, PersistStats, ProcessSnapshotRow,
    SqliteRepository, StoreRepository,
};

use crate::services::status::AgentStatus;
use crate::services::time::unix_millis_now;

unsafe extern "C" {
    fn geteuid() -> u32;
}

#[derive(Debug)]
pub enum RuntimeError {
    Capture(CaptureError),
    Store(traffic_cat_store::StoreError),
    LockPoisoned(&'static str),
}

impl Display for RuntimeError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Capture(err) => write!(f, "采集错误: {err}"),
            Self::Store(err) => write!(f, "存储错误: {err}"),
            Self::LockPoisoned(name) => write!(f, "锁已损坏: {name}"),
        }
    }
}

impl std::error::Error for RuntimeError {}

impl From<CaptureError> for RuntimeError {
    fn from(value: CaptureError) -> Self {
        Self::Capture(value)
    }
}

impl From<traffic_cat_store::StoreError> for RuntimeError {
    fn from(value: traffic_cat_store::StoreError) -> Self {
        Self::Store(value)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
struct AgentState {
    generated_at: UnixMillis,
    active_connections: HashMap<FlowKey, LiveConnection>,
    history_sessions: HashMap<String, FlowSession>,
    process_summaries: Vec<ProcessTrafficSummary>,
    alerts: Vec<AlertRecord>,
    mute_until_unix_millis: Option<UnixMillis>,
    last_persist_stats: PersistStats,
    health: AgentHealthSnapshot,
    widget_state: WidgetPetState,
}

#[derive(Clone)]
pub struct AgentRuntime {
    inner: Arc<AgentRuntimeInner>,
}

struct AgentRuntimeInner {
    settings: AgentSettings,
    collector: Mutex<Box<dyn CaptureCollector + Send>>,
    store: SqliteRepository,
    state: RwLock<AgentState>,
}

impl AgentRuntime {
    pub fn new(
        settings: AgentSettings,
        collector: Box<dyn CaptureCollector + Send>,
        store: SqliteRepository,
    ) -> Self {
        let initial_health =
            build_health_snapshot(&settings, CaptureMode::ProcFallback, None, None);
        let initial_state = AgentState {
            health: initial_health,
            ..AgentState::default()
        };

        Self {
            inner: Arc::new(AgentRuntimeInner {
                settings,
                collector: Mutex::new(collector),
                store,
                state: RwLock::new(initial_state),
            }),
        }
    }

    pub fn refresh_now(&self) -> Result<(), RuntimeError> {
        let observed_at = unix_millis_now();
        let (capture_mode, observed_flows) = {
            let mut collector = self
                .inner
                .collector
                .lock()
                .map_err(|_| RuntimeError::LockPoisoned("collector"))?;
            let mode = collector.mode();
            let flows = collector.collect(observed_at)?;
            (mode, flows)
        };

        let mut state = self
            .inner
            .state
            .write()
            .map_err(|_| RuntimeError::LockPoisoned("state"))?;

        let active_connections = merge_observed_flows(
            state.active_connections.clone(),
            observed_flows,
            observed_at,
        );
        let history_sessions =
            merge_history_sessions(state.history_sessions.clone(), active_connections.values());
        let alerts = build_alerts(
            &state.alerts,
            state.mute_until_unix_millis,
            active_connections.values(),
            observed_at,
        );
        let process_summaries =
            build_process_summaries(active_connections.values(), alerts.as_slice());
        let realtime_snapshot = build_realtime_snapshot(
            observed_at,
            capture_mode,
            alerts.as_slice(),
            &active_connections,
        );
        let persist_batch = build_persist_batch(
            &active_connections,
            &history_sessions,
            alerts.as_slice(),
            state.mute_until_unix_millis,
            observed_at,
        );
        let persist_stats = self.inner.store.apply_batch(&persist_batch)?;
        let health = build_health_snapshot(
            &self.inner.settings,
            capture_mode,
            Some(observed_at),
            Some(&persist_stats),
        );

        state.generated_at = observed_at;
        state.active_connections = active_connections;
        state.history_sessions = history_sessions;
        state.process_summaries = process_summaries;
        state.alerts = alerts;
        state.last_persist_stats = persist_stats;
        state.health = health;
        state.widget_state = realtime_snapshot.widget_state;

        Ok(())
    }

    pub fn realtime_snapshot(&self) -> RealtimeSnapshot {
        let state = self.inner.state.read().expect("state lock");
        build_realtime_snapshot(
            state.generated_at,
            state.health.capture.mode,
            &state.alerts,
            &state.active_connections,
        )
    }

    pub fn health_snapshot(&self) -> AgentHealthSnapshot {
        self.inner.state.read().expect("state lock").health.clone()
    }

    pub fn status(&self) -> AgentStatus {
        let state = self.inner.state.read().expect("state lock");
        AgentStatus {
            service_status: if !state.health.is_ready() {
                ServiceHealth::Unavailable
            } else if matches!(state.health.capture.mode, CaptureMode::ProcFallback) {
                ServiceHealth::Degraded
            } else {
                ServiceHealth::Healthy
            },
            capture_mode: state.health.capture.mode,
            permission_status: if state.health.permissions.ready {
                ServiceHealth::Healthy
            } else {
                ServiceHealth::Unavailable
            },
            db_status: state.health.store.state,
            degraded_reason: build_degraded_reason(&state.health),
        }
    }

    #[allow(dead_code)]
    pub fn active_connections(&self) -> Vec<LiveConnection> {
        let state = self.inner.state.read().expect("state lock");
        let mut items = state
            .active_connections
            .values()
            .cloned()
            .collect::<Vec<_>>();
        items.sort_by(|left, right| right.last_seen_at.cmp(&left.last_seen_at));
        items
    }

    #[allow(dead_code)]
    pub fn alerts(&self) -> Vec<AlertRecord> {
        self.inner.state.read().expect("state lock").alerts.clone()
    }

    pub fn recent_alerts(&self, limit: usize) -> Vec<AlertRecord> {
        let mut alerts = self.inner.state.read().expect("state lock").alerts.clone();
        alerts.sort_by(|left, right| right.last_triggered_at.cmp(&left.last_triggered_at));
        alerts.into_iter().take(limit).collect()
    }

    pub fn process_summaries(&self) -> Vec<ProcessTrafficSummary> {
        self.inner
            .state
            .read()
            .expect("state lock")
            .process_summaries
            .clone()
    }

    pub fn process_detail(&self, pid: u32) -> Option<ProcessDetailSnapshot> {
        let state = self.inner.state.read().expect("state lock");
        let summary = state
            .process_summaries
            .iter()
            .find(|item| item.process.pid == pid)?
            .clone();
        let mut active_connections = state
            .active_connections
            .values()
            .filter(|item| item.process.pid == pid)
            .cloned()
            .collect::<Vec<_>>();
        active_connections.sort_by(|left, right| {
            right
                .current_rate
                .total_bytes_per_sec()
                .cmp(&left.current_rate.total_bytes_per_sec())
                .then(right.last_seen_at.cmp(&left.last_seen_at))
        });
        let recent_sessions = active_connections
            .iter()
            .map(live_connection_to_session)
            .collect::<Vec<_>>();
        let recent_alerts = state
            .alerts
            .iter()
            .filter(|item| item.process.pid == pid)
            .cloned()
            .collect::<Vec<_>>();

        Some(ProcessDetailSnapshot {
            process: summary.process,
            cumulative_counters: summary.cumulative_counters,
            active_connections,
            recent_sessions,
            recent_alerts,
            last_active_at: Some(summary.last_active_at),
        })
    }

    pub fn history_page(&self, query: &HistoryQuery) -> HistoryPage {
        let state = self.inner.state.read().expect("state lock");
        let mut items = state
            .history_sessions
            .values()
            .filter(|item| matches_history_query(item, query))
            .cloned()
            .collect::<Vec<_>>();
        items.sort_by(|left, right| right.started_at.cmp(&left.started_at));
        let total = items.len();
        let limit = if query.limit == 0 { 100 } else { query.limit };
        let offset = query.offset.min(total);
        let paged = items
            .into_iter()
            .skip(offset)
            .take(limit)
            .collect::<Vec<_>>();

        HistoryPage {
            items: paged,
            total,
            limit,
            offset,
        }
    }

    pub fn mute_alerts(&self, minutes: u16) -> Result<UnixMillis, RuntimeError> {
        let mute_until = unix_millis_now().saturating_add(i64::from(minutes) * 60_000);
        let batch = PersistBatch {
            settings: vec![AppSettingRow {
                key: "alerts.mute_until".to_string(),
                value: mute_until.to_string(),
                updated_at: unix_millis_now(),
            }],
            ..PersistBatch::default()
        };
        let persist_stats = self.inner.store.apply_batch(&batch)?;

        let mut state = self
            .inner
            .state
            .write()
            .map_err(|_| RuntimeError::LockPoisoned("state"))?;
        state.mute_until_unix_millis = Some(mute_until);
        state.last_persist_stats = persist_stats;
        Ok(mute_until)
    }
}

fn merge_observed_flows(
    mut existing: HashMap<FlowKey, LiveConnection>,
    observed_flows: Vec<ObservedFlow>,
    observed_at: UnixMillis,
) -> HashMap<FlowKey, LiveConnection> {
    for observed in observed_flows {
        let key = observed.sample.key();
        let display_name = observed.sample.remote.ip.to_string();
        let target = ResolvedTarget {
            ip: observed.sample.remote.ip,
            display_name,
            source: HostnameSource::IpOnly,
        };
        let is_lan_traffic = is_lan_ip(observed.sample.remote.ip);
        let current_rate = observed_current_rate(&observed);
        let entry = existing.entry(key).or_insert_with(|| LiveConnection {
            key,
            process: observed.sample.process.clone(),
            target,
            connection_state: observed.connection_state,
            first_seen_at: observed.sample.observed_at,
            last_seen_at: observed.sample.observed_at,
            cumulative_counters: observed.sample.bytes_delta,
            current_rate,
            capture_mode: observed.sample.capture_mode,
            is_lan_traffic,
        });

        entry.process = observed.sample.process;
        entry.connection_state = observed.connection_state;
        entry.last_seen_at = observed.sample.observed_at;
        entry.capture_mode = observed.sample.capture_mode;
        entry.is_lan_traffic = is_lan_traffic;
        entry.current_rate = current_rate;
        entry
            .cumulative_counters
            .accumulate(observed.sample.bytes_delta);
    }

    let active_threshold = observed_at.saturating_sub(60_000);
    existing.retain(|_, item| item.last_seen_at >= active_threshold);
    existing
}

fn observed_current_rate(observed: &ObservedFlow) -> TrafficRate {
    observed.current_rate_estimate.unwrap_or(TrafficRate {
        tx_bytes_per_sec: observed.sample.bytes_delta.tx_bytes,
        rx_bytes_per_sec: observed.sample.bytes_delta.rx_bytes,
    })
}

fn build_process_summaries<'a>(
    connections: impl Iterator<Item = &'a LiveConnection>,
    alerts: &[AlertRecord],
) -> Vec<ProcessTrafficSummary> {
    let mut grouped = HashMap::<u32, ProcessTrafficSummary>::new();
    let alert_pids = alerts
        .iter()
        .map(|item| item.process.pid)
        .collect::<Vec<_>>();

    for connection in connections {
        let entry =
            grouped
                .entry(connection.process.pid)
                .or_insert_with(|| ProcessTrafficSummary {
                    process: connection.process.clone(),
                    cumulative_counters: TrafficCounters::default(),
                    destination_count: 0,
                    last_active_at: connection.last_seen_at,
                    has_active_alert: false,
                });

        entry
            .cumulative_counters
            .accumulate(connection.cumulative_counters);
        entry.destination_count += 1;
        entry.last_active_at = entry.last_active_at.max(connection.last_seen_at);
        entry.has_active_alert = alert_pids.contains(&connection.process.pid);
    }

    let mut values = grouped.into_values().collect::<Vec<_>>();
    values.sort_by(|left, right| right.last_active_at.cmp(&left.last_active_at));
    values
}

fn build_realtime_snapshot(
    generated_at: UnixMillis,
    capture_mode: CaptureMode,
    alerts: &[AlertRecord],
    active_connections: &HashMap<FlowKey, LiveConnection>,
) -> RealtimeSnapshot {
    let mut items = active_connections.values().cloned().collect::<Vec<_>>();
    items.sort_by(|left, right| {
        right
            .current_rate
            .total_bytes_per_sec()
            .cmp(&left.current_rate.total_bytes_per_sec())
            .then(right.last_seen_at.cmp(&left.last_seen_at))
    });

    let upload_rate_bytes_per_sec = items
        .iter()
        .map(|item| item.current_rate.tx_bytes_per_sec)
        .sum::<u64>();
    let download_rate_bytes_per_sec = items
        .iter()
        .map(|item| item.current_rate.rx_bytes_per_sec)
        .sum::<u64>();
    let widget_state = determine_widget_state(alerts, &items);
    let headline = items.first().map(LiveConnection::summary_line);

    RealtimeSnapshot {
        generated_at,
        widget_state,
        capture_mode,
        upload_rate_bytes_per_sec,
        download_rate_bytes_per_sec,
        headline,
        active_connections: items,
        recent_alert_count: alerts.len(),
        agent_available: true,
    }
}

fn determine_widget_state(alerts: &[AlertRecord], items: &[LiveConnection]) -> WidgetPetState {
    if !alerts.is_empty() {
        return WidgetPetState::Alerting;
    }
    if items.is_empty() {
        return WidgetPetState::Idle;
    }

    let outbound = items
        .iter()
        .any(|item| item.key.direction == TrafficDirection::Outbound);
    let inbound = items
        .iter()
        .any(|item| item.key.direction == TrafficDirection::Inbound);

    match (outbound, inbound) {
        (true, true) => WidgetPetState::BidirectionalActive,
        (true, false) => WidgetPetState::UploadActive,
        (false, true) => WidgetPetState::DownloadActive,
        (false, false) => WidgetPetState::Idle,
    }
}

fn build_health_snapshot(
    settings: &AgentSettings,
    capture_mode: CaptureMode,
    last_sample_at: Option<UnixMillis>,
    persist_stats: Option<&PersistStats>,
) -> AgentHealthSnapshot {
    let database_path = settings.paths.database_path.to_string_lossy().to_string();
    let permissions = build_permission_health(capture_mode);
    let capture_details = build_capture_details(capture_mode, permissions.ready);

    AgentHealthSnapshot {
        generated_at: unix_millis_now(),
        uds_path: settings.paths.socket_path.to_string_lossy().to_string(),
        permissions,
        capture: CaptureHealth {
            mode: capture_mode,
            state: match capture_mode {
                CaptureMode::Ebpf => ServiceHealth::Healthy,
                CaptureMode::ProcFallback => ServiceHealth::Degraded,
                CaptureMode::Unavailable => ServiceHealth::Unavailable,
            },
            last_sample_at,
            details: Some(capture_details),
        },
        store: StoreHealth {
            state: ServiceHealth::Healthy,
            database_path,
            pending_flush_items: persist_stats
                .map(|stats| {
                    stats.process_snapshots
                        + stats.flow_sessions
                        + stats.flow_rollups
                        + stats.alerts
                        + stats.settings
                })
                .unwrap_or(0),
            last_flush_at: last_sample_at,
            soft_limit_bytes: settings.storage.soft_limit_bytes,
        },
    }
}

fn build_permission_health(capture_mode: CaptureMode) -> PermissionHealth {
    let is_root = is_running_as_root();

    match capture_mode {
        CaptureMode::Ebpf if is_root => PermissionHealth {
            ready: true,
            details: Some("当前以特权模式运行，eBPF 采集链路可用。".to_string()),
        },
        CaptureMode::Ebpf => PermissionHealth {
            ready: false,
            details: Some(
                "当前不是 root，eBPF 采集通常需要 sudo 或预先授予 capability。".to_string(),
            ),
        },
        CaptureMode::ProcFallback if is_root => PermissionHealth {
            ready: true,
            details: Some(
                "当前以特权模式运行，/proc 回退采集可以读取 TCP_INFO 累计字节。".to_string(),
            ),
        },
        CaptureMode::ProcFallback => PermissionHealth {
            ready: false,
            details: Some(
                "当前以普通用户运行，/proc 回退模式通常无法稳定读取其他进程 TCP_INFO；连接能看到，但速率和累计字节可能长期为 0。请用 sudo 或 capability 方式启动。"
                    .to_string(),
            ),
        },
        CaptureMode::Unavailable => PermissionHealth {
            ready: false,
            details: Some("采集能力不可用，当前无法读取本机流量。".to_string()),
        },
    }
}

fn build_capture_details(capture_mode: CaptureMode, permissions_ready: bool) -> String {
    match capture_mode {
        CaptureMode::Ebpf => "eBPF 采集已启用".to_string(),
        CaptureMode::ProcFallback if permissions_ready => {
            "/proc 回退采集已启用，TCP 连接速率基于 TCP_INFO 累计字节差分估算".to_string()
        }
        CaptureMode::ProcFallback => {
            "/proc 回退采集已启用，但当前权限不足以稳定读取 TCP_INFO；实时速率和累计字节可能显示为 0。".to_string()
        }
        CaptureMode::Unavailable => "采集能力不可用".to_string(),
    }
}

fn is_running_as_root() -> bool {
    unsafe { geteuid() == 0 }
}

fn build_degraded_reason(health: &AgentHealthSnapshot) -> Option<String> {
    if health.permissions.ready && health.capture.state == ServiceHealth::Healthy {
        return None;
    }

    let capture_details = health.capture.details.clone().unwrap_or_default();
    Some(format!(
        "权限状态={}，采集状态={} {}",
        health.permissions.ready,
        matches!(health.capture.state, ServiceHealth::Healthy),
        capture_details
    ))
}

fn build_persist_batch(
    active_connections: &HashMap<FlowKey, LiveConnection>,
    history_sessions: &HashMap<String, FlowSession>,
    alerts: &[AlertRecord],
    mute_until_unix_millis: Option<UnixMillis>,
    observed_at: UnixMillis,
) -> PersistBatch {
    let mut process_snapshots = Vec::new();
    let mut seen_processes = HashMap::<u32, String>::new();

    for connection in active_connections.values() {
        let process_snapshot_id = seen_processes
            .entry(connection.process.pid)
            .or_insert_with(|| format!("proc-{}", connection.process.pid))
            .clone();

        if process_snapshots
            .iter()
            .all(|item: &ProcessSnapshotRow| item.id != process_snapshot_id)
        {
            process_snapshots.push(ProcessSnapshotRow {
                id: process_snapshot_id.clone(),
                pid: connection.process.pid,
                parent_pid: connection.process.parent_pid,
                process_name: connection.process.name.clone(),
                process_path: connection.process.executable_path.clone(),
                first_seen_at: connection.first_seen_at,
                last_seen_at: connection.last_seen_at,
            });
        }
    }

    let flow_sessions = history_sessions
        .values()
        .filter_map(|session| {
            let key = session.key?;
            let target = session.target.clone()?;
            Some(FlowSessionRow {
                id: session.session_id.clone(),
                process_snapshot_id: format!("proc-{}", session.process.pid),
                protocol: key.protocol,
                direction: key.direction,
                remote_host: Some(target.label().to_string()),
                host_source: target.source,
                remote_ip: target.ip.to_string(),
                remote_port: key.remote.port,
                first_seen_at: session.started_at,
                last_seen_at: session.ended_at.unwrap_or(session.started_at),
                tx_bytes: session.cumulative_counters.tx_bytes,
                rx_bytes: session.cumulative_counters.rx_bytes,
                state: session.final_state,
                capture_mode: session.capture_mode,
                is_lan_traffic: session.is_lan_traffic,
            })
        })
        .collect::<Vec<_>>();

    let alert_rows = alerts
        .iter()
        .map(|alert| AlertRecordRow {
            id: alert.id.clone(),
            process_snapshot_id: format!("proc-{}", alert.process.pid),
            alert_type: alert.kind,
            severity: alert.severity,
            title: alert.summary.clone(),
            body: alert.summary.clone(),
            created_at: alert.created_at,
            dedupe_key: alert.dedupe_key.clone(),
            status: format!("{:?}", alert.status),
        })
        .collect();

    let settings = mute_until_unix_millis
        .map(|mute_until| AppSettingRow {
            key: "alerts.mute_until".to_string(),
            value: mute_until.to_string(),
            updated_at: observed_at,
        })
        .into_iter()
        .collect();

    PersistBatch {
        process_snapshots,
        flow_sessions,
        flow_rollups: Vec::new(),
        alerts: alert_rows,
        settings,
    }
}

fn live_connection_to_session(connection: &LiveConnection) -> FlowSession {
    FlowSession {
        session_id: session_id_from_connection(connection),
        key: Some(connection.key),
        process: connection.process.clone(),
        target: Some(connection.target.clone()),
        started_at: connection.first_seen_at,
        ended_at: None,
        cumulative_counters: connection.cumulative_counters,
        final_state: connection.connection_state,
        capture_mode: connection.capture_mode,
        is_lan_traffic: connection.is_lan_traffic,
    }
}

fn merge_history_sessions<'a>(
    mut history_sessions: HashMap<String, FlowSession>,
    connections: impl Iterator<Item = &'a LiveConnection>,
) -> HashMap<String, FlowSession> {
    for connection in connections {
        let session_id = session_id_from_connection(connection);
        history_sessions
            .entry(session_id.clone())
            .and_modify(|session| {
                session.cumulative_counters = connection.cumulative_counters;
                session.ended_at = Some(connection.last_seen_at);
                session.final_state = connection.connection_state;
                session.target = Some(connection.target.clone());
            })
            .or_insert_with(|| FlowSession {
                session_id,
                key: Some(connection.key),
                process: connection.process.clone(),
                target: Some(connection.target.clone()),
                started_at: connection.first_seen_at,
                ended_at: Some(connection.last_seen_at),
                cumulative_counters: connection.cumulative_counters,
                final_state: connection.connection_state,
                capture_mode: connection.capture_mode,
                is_lan_traffic: connection.is_lan_traffic,
            });
    }

    history_sessions
}

fn build_alerts<'a>(
    existing_alerts: &[AlertRecord],
    mute_until_unix_millis: Option<UnixMillis>,
    connections: impl Iterator<Item = &'a LiveConnection>,
    observed_at: UnixMillis,
) -> Vec<AlertRecord> {
    let mut alerts = existing_alerts.to_vec();
    let is_muted = mute_until_unix_millis
        .map(|mute_until| observed_at < mute_until)
        .unwrap_or(false);
    if is_muted {
        return alerts;
    }

    for connection in connections {
        if connection.is_lan_traffic {
            continue;
        }

        let dedupe_key = format!(
            "first_seen:{}:{}",
            connection.process.display_name(),
            connection.target.label()
        );
        if alerts.iter().any(|item| item.dedupe_key == dedupe_key) {
            continue;
        }

        alerts.push(AlertRecord {
            id: format!(
                "alert-{}-{}",
                connection.process.pid, connection.key.remote.port
            ),
            dedupe_key,
            kind: AlertKind::FirstSeenConnection,
            severity: AlertSeverity::Low,
            process: connection.process.clone(),
            target_label: Some(connection.target.label().to_string()),
            summary: format!(
                "首次发现 {} 连接 {}",
                connection.process.display_name(),
                connection.target.label()
            ),
            created_at: observed_at,
            last_triggered_at: observed_at,
            status: AlertStatus::Active,
        });
    }

    alerts.sort_by(|left, right| right.last_triggered_at.cmp(&left.last_triggered_at));
    alerts.truncate(100);
    alerts
}

fn matches_history_query(session: &FlowSession, query: &HistoryQuery) -> bool {
    if !query.include_lan_traffic && session.is_lan_traffic {
        return false;
    }
    if let Some(process_name) = query.process_name.as_deref() {
        if !session.process.display_name().contains(process_name) {
            return false;
        }
    }
    if let Some(target) = query.target.as_deref() {
        let session_target = session
            .target
            .as_ref()
            .map(|item| item.label())
            .unwrap_or_default();
        if !session_target.contains(target) {
            return false;
        }
    }
    if let Some(port) = query.port {
        if session.key.map(|item| item.remote.port) != Some(port) {
            return false;
        }
    }
    if let Some(direction) = query.direction {
        if session.key.map(|item| item.direction) != Some(direction) {
            return false;
        }
    }
    if let Some(started_after) = query.started_after {
        if session.started_at < started_after {
            return false;
        }
    }
    if let Some(ended_before) = query.ended_before {
        let ended_at = session.ended_at.unwrap_or(session.started_at);
        if ended_at > ended_before {
            return false;
        }
    }

    true
}

fn session_id_from_connection(connection: &LiveConnection) -> String {
    format!(
        "{}-{:?}-{:?}-{}-{}-{}-{}-{}",
        connection.process.pid,
        connection.key.protocol,
        connection.key.direction,
        connection.key.local.ip,
        connection.key.local.port,
        connection.key.remote.ip,
        connection.key.remote.port,
        connection.first_seen_at,
    )
}

fn is_lan_ip(ip: std::net::IpAddr) -> bool {
    match ip {
        std::net::IpAddr::V4(value) => {
            value.is_private() || value.is_loopback() || value.is_link_local()
        }
        std::net::IpAddr::V6(value) => value.is_loopback() || value.is_unique_local(),
    }
}

#[cfg(test)]
mod tests {
    use std::net::{IpAddr, Ipv4Addr};
    use std::time::{SystemTime, UNIX_EPOCH};

    use traffic_cat_domain::{ConnectionState, ProcessRef, SocketEndpoint, TransportProtocol};
    use traffic_cat_store::{SqliteRepository, SqliteRuntimeConfig};

    use super::*;

    fn temp_repository() -> SqliteRepository {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        SqliteRepository::new(SqliteRuntimeConfig {
            database_path: std::env::temp_dir().join(format!("traffic-cat-agentd-{nanos}.db")),
            busy_timeout_millis: 1_000,
            flush_interval_millis: 1_000,
        })
    }

    struct FakeCollector {
        items: Vec<ObservedFlow>,
    }

    impl CaptureCollector for FakeCollector {
        fn mode(&self) -> CaptureMode {
            CaptureMode::ProcFallback
        }

        fn collect(&mut self, observed_at: UnixMillis) -> Result<Vec<ObservedFlow>, CaptureError> {
            let mut items = self.items.clone();
            for item in &mut items {
                item.sample.observed_at = observed_at;
            }
            Ok(items)
        }
    }

    #[test]
    fn runtime_refresh_builds_realtime_snapshot() {
        let observed = ObservedFlow {
            sample: traffic_cat_domain::FlowSample {
                process: ProcessRef {
                    pid: 7,
                    parent_pid: Some(1),
                    name: "curl".to_string(),
                    parent_name: Some("systemd".to_string()),
                    executable_path: None,
                },
                protocol: TransportProtocol::Tcp,
                direction: TrafficDirection::Outbound,
                local: SocketEndpoint {
                    ip: IpAddr::V4(Ipv4Addr::LOCALHOST),
                    port: 1234,
                },
                remote: SocketEndpoint {
                    ip: IpAddr::V4(Ipv4Addr::new(1, 1, 1, 1)),
                    port: 443,
                },
                bytes_delta: TrafficCounters {
                    tx_bytes: 32,
                    rx_bytes: 64,
                },
                observed_at: 1,
                capture_mode: CaptureMode::ProcFallback,
            },
            connection_state: ConnectionState::Established,
            source_inode: 77,
            current_rate_estimate: None,
        };

        let runtime = AgentRuntime::new(
            AgentSettings::default(),
            Box::new(FakeCollector {
                items: vec![observed],
            }),
            temp_repository(),
        );

        runtime.refresh_now().unwrap();
        let snapshot = runtime.realtime_snapshot();
        assert_eq!(snapshot.active_connections.len(), 1);
        assert_eq!(snapshot.headline.as_deref(), Some("curl -> 1.1.1.1"));
        assert_eq!(snapshot.widget_state, WidgetPetState::Alerting);
        assert_eq!(snapshot.recent_alert_count, 1);
    }

    #[test]
    fn history_page_returns_recent_sessions() {
        let observed = ObservedFlow {
            sample: traffic_cat_domain::FlowSample {
                process: ProcessRef {
                    pid: 9,
                    parent_pid: Some(1),
                    name: "wget".to_string(),
                    parent_name: Some("systemd".to_string()),
                    executable_path: None,
                },
                protocol: TransportProtocol::Tcp,
                direction: TrafficDirection::Outbound,
                local: SocketEndpoint {
                    ip: IpAddr::V4(Ipv4Addr::LOCALHOST),
                    port: 4567,
                },
                remote: SocketEndpoint {
                    ip: IpAddr::V4(Ipv4Addr::new(8, 8, 4, 4)),
                    port: 80,
                },
                bytes_delta: TrafficCounters {
                    tx_bytes: 10,
                    rx_bytes: 20,
                },
                observed_at: 1,
                capture_mode: CaptureMode::ProcFallback,
            },
            connection_state: ConnectionState::Established,
            source_inode: 88,
            current_rate_estimate: None,
        };

        let runtime = AgentRuntime::new(
            AgentSettings::default(),
            Box::new(FakeCollector {
                items: vec![observed],
            }),
            temp_repository(),
        );

        runtime.refresh_now().unwrap();
        let page = runtime.history_page(&HistoryQuery::default());
        assert_eq!(page.total, 1);
        assert_eq!(page.items[0].process.pid, 9);
    }

    #[test]
    fn runtime_refresh_prefers_rate_estimate_for_live_snapshot() {
        let observed = ObservedFlow {
            sample: traffic_cat_domain::FlowSample {
                process: ProcessRef {
                    pid: 17,
                    parent_pid: Some(1),
                    name: "firefox".to_string(),
                    parent_name: Some("systemd".to_string()),
                    executable_path: None,
                },
                protocol: TransportProtocol::Tcp,
                direction: TrafficDirection::Outbound,
                local: SocketEndpoint {
                    ip: IpAddr::V4(Ipv4Addr::LOCALHOST),
                    port: 7777,
                },
                remote: SocketEndpoint {
                    ip: IpAddr::V4(Ipv4Addr::new(9, 9, 9, 9)),
                    port: 443,
                },
                bytes_delta: TrafficCounters::default(),
                observed_at: 1,
                capture_mode: CaptureMode::ProcFallback,
            },
            connection_state: ConnectionState::Established,
            source_inode: 99,
            current_rate_estimate: Some(TrafficRate {
                tx_bytes_per_sec: 4 * 1024,
                rx_bytes_per_sec: 12 * 1024,
            }),
        };

        let runtime = AgentRuntime::new(
            AgentSettings::default(),
            Box::new(FakeCollector {
                items: vec![observed],
            }),
            temp_repository(),
        );

        runtime.refresh_now().unwrap();
        let snapshot = runtime.realtime_snapshot();

        assert_eq!(snapshot.upload_rate_bytes_per_sec, 4 * 1024);
        assert_eq!(snapshot.download_rate_bytes_per_sec, 12 * 1024);
        assert_eq!(
            snapshot.active_connections[0].current_rate,
            TrafficRate {
                tx_bytes_per_sec: 4 * 1024,
                rx_bytes_per_sec: 12 * 1024,
            }
        );
    }

    #[test]
    fn session_id_distinguishes_parallel_connections_by_local_port() {
        let base_connection = LiveConnection {
            key: FlowKey {
                pid: 42,
                protocol: TransportProtocol::Tcp,
                direction: TrafficDirection::Outbound,
                local: SocketEndpoint {
                    ip: IpAddr::V4(Ipv4Addr::LOCALHOST),
                    port: 41000,
                },
                remote: SocketEndpoint {
                    ip: IpAddr::V4(Ipv4Addr::new(1, 1, 1, 1)),
                    port: 443,
                },
            },
            process: ProcessRef {
                pid: 42,
                name: "curl".to_string(),
                ..ProcessRef::default()
            },
            target: ResolvedTarget {
                ip: IpAddr::V4(Ipv4Addr::new(1, 1, 1, 1)),
                display_name: "1.1.1.1".to_string(),
                source: HostnameSource::IpOnly,
            },
            connection_state: ConnectionState::Established,
            first_seen_at: 1_000,
            last_seen_at: 2_000,
            cumulative_counters: TrafficCounters::default(),
            current_rate: TrafficRate::default(),
            capture_mode: CaptureMode::ProcFallback,
            is_lan_traffic: false,
        };
        let mut sibling_connection = base_connection.clone();
        sibling_connection.key.local.port = 41001;

        assert_ne!(
            session_id_from_connection(&base_connection),
            session_id_from_connection(&sibling_connection)
        );
    }
}
