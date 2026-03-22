use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use traffic_cat_domain::{
    AlertKind, AlertSeverity, CaptureMode, ConnectionState, HostnameSource, TrafficDirection,
    TransportProtocol,
};

use crate::migrations::{Migration, MIGRATIONS};
use crate::models::{
    AlertRecordRow, AppSettingRow, FlowEventRollupRow, FlowSessionRow, HistoryFilter, PersistBatch,
    ProcessSnapshotRow,
};
use crate::prune::{PrunePlan, PruneReport};
use crate::repository::{PersistStats, StoreError, StoreRepository};

pub const SQLITE_PRAGMAS: &[&str] = &[
    "PRAGMA journal_mode = WAL;",
    "PRAGMA synchronous = NORMAL;",
    "PRAGMA foreign_keys = ON;",
];

pub const SQLITE_STATEMENTS: &[&str] = &[
    "INSERT OR REPLACE INTO process_snapshot (id, pid, parent_pid, process_name, process_path, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?);",
    "INSERT OR REPLACE INTO flow_session (id, process_snapshot_id, protocol, direction, remote_host, host_source, remote_ip, remote_port, first_seen_at, last_seen_at, tx_bytes, rx_bytes, state, capture_mode, is_lan_traffic) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
    "INSERT INTO flow_event_rollup (id, flow_session_id, bucket_start_at, tx_bytes_delta, rx_bytes_delta) VALUES (?, ?, ?, ?, ?);",
    "INSERT OR REPLACE INTO alert_record (id, process_snapshot_id, alert_type, severity, title, body, created_at, dedupe_key, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);",
    "INSERT OR REPLACE INTO app_setting (key, value, updated_at) VALUES (?, ?, ?);",
];

const SNAPSHOT_EXTENSION: &str = "snapshot";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SqliteRuntimeConfig {
    pub database_path: PathBuf,
    pub busy_timeout_millis: u64,
    pub flush_interval_millis: u64,
}

impl Default for SqliteRuntimeConfig {
    fn default() -> Self {
        Self {
            database_path: PathBuf::from("/var/lib/traffic-cat/traffic.db"),
            busy_timeout_millis: 3_000,
            flush_interval_millis: 1_000,
        }
    }
}

#[derive(Debug, Clone)]
pub struct SqliteRepository {
    pub config: SqliteRuntimeConfig,
}

#[derive(Debug, Clone, Default)]
struct StoreSnapshot {
    process_snapshots: Vec<ProcessSnapshotRow>,
    flow_sessions: Vec<FlowSessionRow>,
    flow_rollups: Vec<FlowEventRollupRow>,
    alerts: Vec<AlertRecordRow>,
    settings: Vec<AppSettingRow>,
}

impl SqliteRepository {
    pub fn new(config: SqliteRuntimeConfig) -> Self {
        Self { config }
    }

    pub fn bootstrap_sql(&self) -> Vec<&'static str> {
        let mut sql = Vec::new();
        sql.extend(SQLITE_PRAGMAS.iter().copied());
        sql.extend(MIGRATIONS.iter().map(|migration| migration.sql));
        sql
    }

    pub fn snapshot_path(&self) -> PathBuf {
        self.config.database_path.with_extension(SNAPSHOT_EXTENSION)
    }

    fn load_snapshot(&self) -> Result<StoreSnapshot, StoreError> {
        let path = self.snapshot_path();
        if !path.exists() {
            return Ok(StoreSnapshot::default());
        }

        let contents = fs::read_to_string(&path)?;
        let mut snapshot = StoreSnapshot::default();
        for (line_no, line) in contents.lines().enumerate() {
            if line.trim().is_empty() {
                continue;
            }

            let fields = split_escaped_fields(line);
            let Some(prefix) = fields.first().map(String::as_str) else {
                continue;
            };

            match prefix {
                "PROCESS" => snapshot
                    .process_snapshots
                    .push(parse_process_row(&fields, line_no + 1)?),
                "FLOW" => snapshot
                    .flow_sessions
                    .push(parse_flow_row(&fields, line_no + 1)?),
                "ROLLUP" => snapshot
                    .flow_rollups
                    .push(parse_rollup_row(&fields, line_no + 1)?),
                "ALERT" => snapshot.alerts.push(parse_alert_row(&fields, line_no + 1)?),
                "SETTING" => snapshot
                    .settings
                    .push(parse_setting_row(&fields, line_no + 1)?),
                other => {
                    return Err(StoreError::Corrupted(format!(
                        "未知快照记录类型 {other}，行号 {}",
                        line_no + 1
                    )));
                }
            }
        }

        Ok(snapshot)
    }

    fn save_snapshot(&self, snapshot: &StoreSnapshot) -> Result<(), StoreError> {
        let path = self.snapshot_path();
        ensure_parent_dir(&path)?;

        let temp_path = unique_temp_path(&path);
        let mut file = fs::File::create(&temp_path)?;

        let mut lines = Vec::new();
        lines.extend(snapshot.process_snapshots.iter().map(serialize_process_row));
        lines.extend(snapshot.flow_sessions.iter().map(serialize_flow_row));
        lines.extend(snapshot.flow_rollups.iter().map(serialize_rollup_row));
        lines.extend(snapshot.alerts.iter().map(serialize_alert_row));
        lines.extend(snapshot.settings.iter().map(serialize_setting_row));

        for line in lines {
            file.write_all(line.as_bytes())?;
            file.write_all(b"\n")?;
        }
        file.flush()?;
        drop(file);

        fs::rename(temp_path, path)?;
        Ok(())
    }
}

impl Default for SqliteRepository {
    fn default() -> Self {
        Self::new(SqliteRuntimeConfig::default())
    }
}

impl StoreRepository for SqliteRepository {
    fn migrations(&self) -> &[Migration] {
        MIGRATIONS
    }

    fn apply_batch(&self, batch: &PersistBatch) -> Result<PersistStats, StoreError> {
        if batch.is_empty() {
            return Ok(PersistStats::default());
        }

        let mut snapshot = self.load_snapshot()?;

        for row in &batch.process_snapshots {
            upsert_by(
                &mut snapshot.process_snapshots,
                row.clone(),
                |left, right| left.id == right.id,
            );
        }
        for row in &batch.flow_sessions {
            upsert_by(&mut snapshot.flow_sessions, row.clone(), |left, right| {
                left.id == right.id
            });
        }
        for row in &batch.flow_rollups {
            upsert_by(&mut snapshot.flow_rollups, row.clone(), |left, right| {
                left.id == right.id
            });
        }
        for row in &batch.alerts {
            upsert_by(&mut snapshot.alerts, row.clone(), |left, right| {
                left.id == right.id
            });
        }
        for row in &batch.settings {
            upsert_by(&mut snapshot.settings, row.clone(), |left, right| {
                left.key == right.key
            });
        }

        self.save_snapshot(&snapshot)?;

        Ok(PersistStats {
            process_snapshots: batch.process_snapshots.len(),
            flow_sessions: batch.flow_sessions.len(),
            flow_rollups: batch.flow_rollups.len(),
            alerts: batch.alerts.len(),
            settings: batch.settings.len(),
        })
    }

    fn list_history(&self, filter: &HistoryFilter) -> Result<Vec<FlowSessionRow>, StoreError> {
        if filter.limit == 0 {
            return Err(StoreError::InvalidInput(
                "history limit 不能为 0".to_string(),
            ));
        }

        let snapshot = self.load_snapshot()?;
        let process_names = snapshot
            .process_snapshots
            .iter()
            .map(|row| (row.id.as_str(), row.process_name.as_str()))
            .collect::<std::collections::HashMap<_, _>>();

        let mut rows = snapshot
            .flow_sessions
            .into_iter()
            .filter(|row| matches_history_filter(row, filter, &process_names))
            .collect::<Vec<_>>();
        rows.sort_by(|left, right| right.last_seen_at.cmp(&left.last_seen_at));

        Ok(rows
            .into_iter()
            .skip(filter.offset)
            .take(filter.limit)
            .collect())
    }

    fn list_process_snapshots(&self) -> Result<Vec<ProcessSnapshotRow>, StoreError> {
        let mut rows = self.load_snapshot()?.process_snapshots;
        rows.sort_by(|left, right| right.last_seen_at.cmp(&left.last_seen_at));
        Ok(rows)
    }

    fn apply_prune_plan(&self, plan: &PrunePlan) -> Result<PruneReport, StoreError> {
        if !plan.is_needed() {
            return Ok(PruneReport::default());
        }

        let path = self.snapshot_path();
        let before_bytes = fs::metadata(&path).map(|meta| meta.len()).unwrap_or(0);
        let mut snapshot = self.load_snapshot()?;
        let Some(delete_before) = plan.delete_before else {
            return Ok(PruneReport::default());
        };

        let flow_before = snapshot.flow_sessions.len();
        let rollup_before = snapshot.flow_rollups.len();
        let alert_before = snapshot.alerts.len();

        snapshot
            .flow_sessions
            .retain(|row| row.last_seen_at > delete_before);
        let active_session_ids = snapshot
            .flow_sessions
            .iter()
            .map(|row| row.id.clone())
            .collect::<Vec<_>>();
        snapshot.flow_rollups.retain(|row| {
            row.bucket_start_at > delete_before && active_session_ids.contains(&row.flow_session_id)
        });
        snapshot.alerts.retain(|row| row.created_at > delete_before);
        let active_process_ids = snapshot
            .flow_sessions
            .iter()
            .map(|row| row.process_snapshot_id.clone())
            .chain(
                snapshot
                    .alerts
                    .iter()
                    .map(|row| row.process_snapshot_id.clone()),
            )
            .collect::<Vec<_>>();
        snapshot
            .process_snapshots
            .retain(|row| active_process_ids.contains(&row.id));

        self.save_snapshot(&snapshot)?;
        let after_bytes = fs::metadata(&path).map(|meta| meta.len()).unwrap_or(0);

        Ok(PruneReport {
            deleted_flow_sessions: flow_before.saturating_sub(snapshot.flow_sessions.len()),
            deleted_rollups: rollup_before.saturating_sub(snapshot.flow_rollups.len()),
            deleted_alerts: alert_before.saturating_sub(snapshot.alerts.len()),
            reclaimed_bytes_estimate: before_bytes.saturating_sub(after_bytes),
        })
    }
}

fn ensure_parent_dir(path: &Path) -> Result<(), StoreError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    Ok(())
}

fn unique_temp_path(path: &Path) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let mut temp_path = path.to_path_buf();
    temp_path.set_extension(format!("{SNAPSHOT_EXTENSION}.{nanos}.tmp"));
    temp_path
}

fn upsert_by<T, F>(rows: &mut Vec<T>, new_row: T, matches: F)
where
    F: Fn(&T, &T) -> bool,
{
    if let Some(index) = rows.iter().position(|current| matches(current, &new_row)) {
        rows[index] = new_row;
    } else {
        rows.push(new_row);
    }
}

fn matches_history_filter(
    row: &FlowSessionRow,
    filter: &HistoryFilter,
    process_names: &std::collections::HashMap<&str, &str>,
) -> bool {
    if !filter.include_lan_traffic && row.is_lan_traffic {
        return false;
    }
    if let Some(process_name) = filter.process_name.as_deref() {
        let actual_name = process_names
            .get(row.process_snapshot_id.as_str())
            .copied()
            .unwrap_or_default();
        if !actual_name.contains(process_name) {
            return false;
        }
    }
    if let Some(target) = filter.target.as_deref() {
        let matched = row
            .remote_host
            .as_deref()
            .map(|value| value.contains(target))
            .unwrap_or(false)
            || row.remote_ip.contains(target);
        if !matched {
            return false;
        }
    }
    if let Some(port) = filter.port {
        if row.remote_port != port {
            return false;
        }
    }
    if let Some(direction) = filter.direction {
        if row.direction != direction {
            return false;
        }
    }
    if let Some(started_after) = filter.started_after {
        if row.first_seen_at < started_after {
            return false;
        }
    }
    if let Some(ended_before) = filter.ended_before {
        if row.last_seen_at > ended_before {
            return false;
        }
    }

    true
}

fn serialize_process_row(row: &ProcessSnapshotRow) -> String {
    join_fields(&[
        "PROCESS",
        &row.id,
        &row.pid.to_string(),
        &optional_u32_to_field(row.parent_pid),
        &row.process_name,
        &optional_string_to_field(row.process_path.as_deref()),
        &row.first_seen_at.to_string(),
        &row.last_seen_at.to_string(),
    ])
}

fn serialize_flow_row(row: &FlowSessionRow) -> String {
    join_fields(&[
        "FLOW",
        &row.id,
        &row.process_snapshot_id,
        protocol_to_str(row.protocol),
        direction_to_str(row.direction),
        &optional_string_to_field(row.remote_host.as_deref()),
        hostname_source_to_str(row.host_source),
        &row.remote_ip,
        &row.remote_port.to_string(),
        &row.first_seen_at.to_string(),
        &row.last_seen_at.to_string(),
        &row.tx_bytes.to_string(),
        &row.rx_bytes.to_string(),
        connection_state_to_str(row.state),
        capture_mode_to_str(row.capture_mode),
        bool_to_str(row.is_lan_traffic),
    ])
}

fn serialize_rollup_row(row: &FlowEventRollupRow) -> String {
    join_fields(&[
        "ROLLUP",
        &row.id,
        &row.flow_session_id,
        &row.bucket_start_at.to_string(),
        &row.tx_bytes_delta.to_string(),
        &row.rx_bytes_delta.to_string(),
    ])
}

fn serialize_alert_row(row: &AlertRecordRow) -> String {
    join_fields(&[
        "ALERT",
        &row.id,
        &row.process_snapshot_id,
        alert_kind_to_str(row.alert_type),
        alert_severity_to_str(row.severity),
        &row.title,
        &row.body,
        &row.created_at.to_string(),
        &row.dedupe_key,
        &row.status,
    ])
}

fn serialize_setting_row(row: &AppSettingRow) -> String {
    join_fields(&["SETTING", &row.key, &row.value, &row.updated_at.to_string()])
}

fn parse_process_row(fields: &[String], line_no: usize) -> Result<ProcessSnapshotRow, StoreError> {
    expect_len(fields, 8, line_no)?;
    Ok(ProcessSnapshotRow {
        id: fields[1].clone(),
        pid: parse_u32(&fields[2], line_no, "pid")?,
        parent_pid: parse_optional_u32(&fields[3], line_no, "parent_pid")?,
        process_name: fields[4].clone(),
        process_path: field_to_optional_string(&fields[5]),
        first_seen_at: parse_i64(&fields[6], line_no, "first_seen_at")?,
        last_seen_at: parse_i64(&fields[7], line_no, "last_seen_at")?,
    })
}

fn parse_flow_row(fields: &[String], line_no: usize) -> Result<FlowSessionRow, StoreError> {
    expect_len(fields, 16, line_no)?;
    Ok(FlowSessionRow {
        id: fields[1].clone(),
        process_snapshot_id: fields[2].clone(),
        protocol: parse_protocol(&fields[3], line_no)?,
        direction: parse_direction(&fields[4], line_no)?,
        remote_host: field_to_optional_string(&fields[5]),
        host_source: parse_hostname_source(&fields[6], line_no)?,
        remote_ip: fields[7].clone(),
        remote_port: parse_u16(&fields[8], line_no, "remote_port")?,
        first_seen_at: parse_i64(&fields[9], line_no, "first_seen_at")?,
        last_seen_at: parse_i64(&fields[10], line_no, "last_seen_at")?,
        tx_bytes: parse_u64(&fields[11], line_no, "tx_bytes")?,
        rx_bytes: parse_u64(&fields[12], line_no, "rx_bytes")?,
        state: parse_connection_state(&fields[13], line_no)?,
        capture_mode: parse_capture_mode(&fields[14], line_no)?,
        is_lan_traffic: parse_bool(&fields[15], line_no, "is_lan_traffic")?,
    })
}

fn parse_rollup_row(fields: &[String], line_no: usize) -> Result<FlowEventRollupRow, StoreError> {
    expect_len(fields, 6, line_no)?;
    Ok(FlowEventRollupRow {
        id: fields[1].clone(),
        flow_session_id: fields[2].clone(),
        bucket_start_at: parse_i64(&fields[3], line_no, "bucket_start_at")?,
        tx_bytes_delta: parse_u64(&fields[4], line_no, "tx_bytes_delta")?,
        rx_bytes_delta: parse_u64(&fields[5], line_no, "rx_bytes_delta")?,
    })
}

fn parse_alert_row(fields: &[String], line_no: usize) -> Result<AlertRecordRow, StoreError> {
    expect_len(fields, 10, line_no)?;
    Ok(AlertRecordRow {
        id: fields[1].clone(),
        process_snapshot_id: fields[2].clone(),
        alert_type: parse_alert_kind(&fields[3], line_no)?,
        severity: parse_alert_severity(&fields[4], line_no)?,
        title: fields[5].clone(),
        body: fields[6].clone(),
        created_at: parse_i64(&fields[7], line_no, "created_at")?,
        dedupe_key: fields[8].clone(),
        status: fields[9].clone(),
    })
}

fn parse_setting_row(fields: &[String], line_no: usize) -> Result<AppSettingRow, StoreError> {
    expect_len(fields, 4, line_no)?;
    Ok(AppSettingRow {
        key: fields[1].clone(),
        value: fields[2].clone(),
        updated_at: parse_i64(&fields[3], line_no, "updated_at")?,
    })
}

fn expect_len(fields: &[String], expected: usize, line_no: usize) -> Result<(), StoreError> {
    if fields.len() == expected {
        Ok(())
    } else {
        Err(StoreError::Corrupted(format!(
            "第 {line_no} 行字段数量错误，期望 {expected} 实际 {}",
            fields.len()
        )))
    }
}

fn split_escaped_fields(line: &str) -> Vec<String> {
    let mut fields = Vec::new();
    let mut current = String::new();
    let mut escaping = false;

    for ch in line.chars() {
        if escaping {
            match ch {
                't' => current.push('\t'),
                'n' => current.push('\n'),
                'r' => current.push('\r'),
                '\\' => current.push('\\'),
                other => current.push(other),
            }
            escaping = false;
            continue;
        }

        match ch {
            '\\' => escaping = true,
            '\t' => {
                fields.push(current);
                current = String::new();
            }
            other => current.push(other),
        }
    }
    fields.push(current);
    fields
}

fn join_fields(fields: &[&str]) -> String {
    fields
        .iter()
        .map(|field| escape_field(field))
        .collect::<Vec<_>>()
        .join("\t")
}

fn escape_field(field: &str) -> String {
    let mut escaped = String::with_capacity(field.len());
    for ch in field.chars() {
        match ch {
            '\\' => escaped.push_str("\\\\"),
            '\t' => escaped.push_str("\\t"),
            '\n' => escaped.push_str("\\n"),
            '\r' => escaped.push_str("\\r"),
            other => escaped.push(other),
        }
    }
    escaped
}

fn optional_string_to_field(value: Option<&str>) -> String {
    value.unwrap_or("").to_string()
}

fn field_to_optional_string(value: &str) -> Option<String> {
    if value.is_empty() {
        None
    } else {
        Some(value.to_string())
    }
}

fn optional_u32_to_field(value: Option<u32>) -> String {
    value.map(|item| item.to_string()).unwrap_or_default()
}

fn bool_to_str(value: bool) -> &'static str {
    if value {
        "1"
    } else {
        "0"
    }
}

fn parse_bool(value: &str, line_no: usize, field: &str) -> Result<bool, StoreError> {
    match value {
        "1" => Ok(true),
        "0" => Ok(false),
        _ => Err(StoreError::Corrupted(format!(
            "第 {line_no} 行字段 {field} 无法解析为布尔值: {value}"
        ))),
    }
}

fn parse_u16(value: &str, line_no: usize, field: &str) -> Result<u16, StoreError> {
    value.parse::<u16>().map_err(|_| {
        StoreError::Corrupted(format!(
            "第 {line_no} 行字段 {field} 无法解析为 u16: {value}"
        ))
    })
}

fn parse_u32(value: &str, line_no: usize, field: &str) -> Result<u32, StoreError> {
    value.parse::<u32>().map_err(|_| {
        StoreError::Corrupted(format!(
            "第 {line_no} 行字段 {field} 无法解析为 u32: {value}"
        ))
    })
}

fn parse_optional_u32(value: &str, line_no: usize, field: &str) -> Result<Option<u32>, StoreError> {
    if value.is_empty() {
        return Ok(None);
    }
    parse_u32(value, line_no, field).map(Some)
}

fn parse_u64(value: &str, line_no: usize, field: &str) -> Result<u64, StoreError> {
    value.parse::<u64>().map_err(|_| {
        StoreError::Corrupted(format!(
            "第 {line_no} 行字段 {field} 无法解析为 u64: {value}"
        ))
    })
}

fn parse_i64(value: &str, line_no: usize, field: &str) -> Result<i64, StoreError> {
    value.parse::<i64>().map_err(|_| {
        StoreError::Corrupted(format!(
            "第 {line_no} 行字段 {field} 无法解析为 i64: {value}"
        ))
    })
}

fn protocol_to_str(value: TransportProtocol) -> &'static str {
    match value {
        TransportProtocol::Tcp => "tcp",
        TransportProtocol::Udp => "udp",
    }
}

fn parse_protocol(value: &str, line_no: usize) -> Result<TransportProtocol, StoreError> {
    match value {
        "tcp" => Ok(TransportProtocol::Tcp),
        "udp" => Ok(TransportProtocol::Udp),
        _ => Err(StoreError::Corrupted(format!(
            "第 {line_no} 行 protocol 非法: {value}"
        ))),
    }
}

fn direction_to_str(value: TrafficDirection) -> &'static str {
    match value {
        TrafficDirection::Outbound => "outbound",
        TrafficDirection::Inbound => "inbound",
    }
}

fn parse_direction(value: &str, line_no: usize) -> Result<TrafficDirection, StoreError> {
    match value {
        "outbound" => Ok(TrafficDirection::Outbound),
        "inbound" => Ok(TrafficDirection::Inbound),
        _ => Err(StoreError::Corrupted(format!(
            "第 {line_no} 行 direction 非法: {value}"
        ))),
    }
}

fn hostname_source_to_str(value: HostnameSource) -> &'static str {
    match value {
        HostnameSource::DnsCache => "dns_cache",
        HostnameSource::TlsSni => "tls_sni",
        HostnameSource::IpOnly => "ip_only",
    }
}

fn parse_hostname_source(value: &str, line_no: usize) -> Result<HostnameSource, StoreError> {
    match value {
        "dns_cache" => Ok(HostnameSource::DnsCache),
        "tls_sni" => Ok(HostnameSource::TlsSni),
        "ip_only" => Ok(HostnameSource::IpOnly),
        _ => Err(StoreError::Corrupted(format!(
            "第 {line_no} 行 host_source 非法: {value}"
        ))),
    }
}

fn connection_state_to_str(value: ConnectionState) -> &'static str {
    match value {
        ConnectionState::Observed => "observed",
        ConnectionState::Established => "established",
        ConnectionState::Closing => "closing",
        ConnectionState::Closed => "closed",
        ConnectionState::Unknown => "unknown",
    }
}

fn parse_connection_state(value: &str, line_no: usize) -> Result<ConnectionState, StoreError> {
    match value {
        "observed" => Ok(ConnectionState::Observed),
        "established" => Ok(ConnectionState::Established),
        "closing" => Ok(ConnectionState::Closing),
        "closed" => Ok(ConnectionState::Closed),
        "unknown" => Ok(ConnectionState::Unknown),
        _ => Err(StoreError::Corrupted(format!(
            "第 {line_no} 行 connection_state 非法: {value}"
        ))),
    }
}

fn capture_mode_to_str(value: CaptureMode) -> &'static str {
    match value {
        CaptureMode::Ebpf => "ebpf",
        CaptureMode::ProcFallback => "proc_fallback",
        CaptureMode::Unavailable => "unavailable",
    }
}

fn parse_capture_mode(value: &str, line_no: usize) -> Result<CaptureMode, StoreError> {
    match value {
        "ebpf" => Ok(CaptureMode::Ebpf),
        "proc_fallback" => Ok(CaptureMode::ProcFallback),
        "unavailable" => Ok(CaptureMode::Unavailable),
        _ => Err(StoreError::Corrupted(format!(
            "第 {line_no} 行 capture_mode 非法: {value}"
        ))),
    }
}

fn alert_kind_to_str(value: AlertKind) -> &'static str {
    match value {
        AlertKind::FirstSeenConnection => "first_seen_connection",
        AlertKind::TrafficBurst => "traffic_burst",
        AlertKind::PersistentBackgroundTraffic => "persistent_background_traffic",
    }
}

fn parse_alert_kind(value: &str, line_no: usize) -> Result<AlertKind, StoreError> {
    match value {
        "first_seen_connection" => Ok(AlertKind::FirstSeenConnection),
        "traffic_burst" => Ok(AlertKind::TrafficBurst),
        "persistent_background_traffic" => Ok(AlertKind::PersistentBackgroundTraffic),
        _ => Err(StoreError::Corrupted(format!(
            "第 {line_no} 行 alert_kind 非法: {value}"
        ))),
    }
}

fn alert_severity_to_str(value: AlertSeverity) -> &'static str {
    match value {
        AlertSeverity::Low => "low",
        AlertSeverity::Medium => "medium",
        AlertSeverity::High => "high",
    }
}

fn parse_alert_severity(value: &str, line_no: usize) -> Result<AlertSeverity, StoreError> {
    match value {
        "low" => Ok(AlertSeverity::Low),
        "medium" => Ok(AlertSeverity::Medium),
        "high" => Ok(AlertSeverity::High),
        _ => Err(StoreError::Corrupted(format!(
            "第 {line_no} 行 alert_severity 非法: {value}"
        ))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_repository() -> SqliteRepository {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        SqliteRepository::new(SqliteRuntimeConfig {
            database_path: std::env::temp_dir().join(format!("traffic-cat-store-{nanos}.db")),
            busy_timeout_millis: 1_000,
            flush_interval_millis: 1_000,
        })
    }

    fn sample_process() -> ProcessSnapshotRow {
        ProcessSnapshotRow {
            id: "proc-42".to_string(),
            pid: 42,
            parent_pid: Some(1),
            process_name: "curl".to_string(),
            process_path: Some("/usr/bin/curl".to_string()),
            first_seen_at: 100,
            last_seen_at: 200,
        }
    }

    fn sample_flow() -> FlowSessionRow {
        FlowSessionRow {
            id: "flow-1".to_string(),
            process_snapshot_id: "proc-42".to_string(),
            protocol: TransportProtocol::Tcp,
            direction: TrafficDirection::Outbound,
            remote_host: Some("example.com".to_string()),
            host_source: HostnameSource::IpOnly,
            remote_ip: "1.1.1.1".to_string(),
            remote_port: 443,
            first_seen_at: 100,
            last_seen_at: 200,
            tx_bytes: 10,
            rx_bytes: 20,
            state: ConnectionState::Established,
            capture_mode: CaptureMode::ProcFallback,
            is_lan_traffic: false,
        }
    }

    #[test]
    fn bootstrap_sql_includes_pragmas_and_migrations() {
        let repo = SqliteRepository::default();
        let sql = repo.bootstrap_sql();

        assert!(sql
            .iter()
            .any(|statement| statement.contains("PRAGMA journal_mode")));
        assert!(sql
            .iter()
            .any(|statement| statement.contains("process_snapshot")));
    }

    #[test]
    fn apply_batch_persists_snapshot_to_disk() {
        let repo = temp_repository();
        let batch = PersistBatch {
            process_snapshots: vec![sample_process()],
            flow_sessions: vec![sample_flow()],
            settings: vec![AppSettingRow {
                key: "mute_alerts".to_string(),
                value: "false".to_string(),
                updated_at: 0,
            }],
            ..PersistBatch::default()
        };

        let stats = repo.apply_batch(&batch).unwrap();
        assert_eq!(stats.settings, 1);
        assert!(repo.snapshot_path().exists());

        let history = repo
            .list_history(&HistoryFilter {
                limit: 10,
                ..HistoryFilter::default()
            })
            .unwrap();
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].remote_port, 443);
    }

    #[test]
    fn prune_plan_removes_old_rows_from_snapshot() {
        let repo = temp_repository();
        let batch = PersistBatch {
            process_snapshots: vec![sample_process()],
            flow_sessions: vec![sample_flow()],
            alerts: vec![AlertRecordRow {
                id: "alert-1".to_string(),
                process_snapshot_id: "proc-42".to_string(),
                alert_type: AlertKind::FirstSeenConnection,
                severity: AlertSeverity::Low,
                title: "t".to_string(),
                body: "b".to_string(),
                created_at: 150,
                dedupe_key: "k".to_string(),
                status: "Active".to_string(),
            }],
            ..PersistBatch::default()
        };
        repo.apply_batch(&batch).unwrap();

        let report = repo
            .apply_prune_plan(&PrunePlan {
                reasons: vec![crate::prune::PruneReason::RetentionExceeded],
                delete_before: Some(200),
                target_size_bytes: None,
            })
            .unwrap();

        assert_eq!(report.deleted_alerts, 1);
        assert_eq!(report.deleted_flow_sessions, 1);
        assert!(repo
            .list_history(&HistoryFilter {
                limit: 10,
                ..HistoryFilter::default()
            })
            .unwrap()
            .is_empty());
    }
}
