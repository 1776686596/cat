use traffic_cat_domain::{
    AgentHealthSnapshot, AlertRecord, CaptureMode, HostnameSource, LiveConnection,
    ProcessDetailSnapshot, ProcessTrafficSummary, ServiceHealth,
};
use traffic_cat_ipc::{HistoryPage, RealtimeSnapshot};

use crate::services::status::AgentStatus;

pub struct JsonErrorPayload<'a> {
    pub code: &'a str,
    pub message: &'a str,
}

pub fn render_ack(message: &str) -> String {
    format!("{{\"ok\":true,\"message\":{}}}", json_string(message))
}

pub fn render_health_snapshot(snapshot: &AgentHealthSnapshot) -> String {
    format!(
        concat!(
            "{{",
            "\"generated_at\":{},",
            "\"uds_path\":{},",
            "\"permissions\":{{\"ready\":{},\"details\":{}}},",
            "\"capture\":{{\"mode\":{},\"state\":{},\"last_sample_at\":{},\"details\":{}}},",
            "\"store\":{{\"state\":{},\"database_path\":{},\"pending_flush_items\":{},\"last_flush_at\":{},\"soft_limit_bytes\":{}}}",
            "}}"
        ),
        snapshot.generated_at,
        json_string(&snapshot.uds_path),
        snapshot.permissions.ready,
        optional_string(snapshot.permissions.details.as_deref()),
        capture_mode_json(snapshot.capture.mode),
        service_health_json(snapshot.capture.state),
        optional_number(snapshot.capture.last_sample_at),
        optional_string(snapshot.capture.details.as_deref()),
        service_health_json(snapshot.store.state),
        json_string(&snapshot.store.database_path),
        snapshot.store.pending_flush_items,
        optional_number(snapshot.store.last_flush_at),
        snapshot.store.soft_limit_bytes,
    )
}

pub fn render_status(status: &AgentStatus) -> String {
    format!(
        concat!(
            "{{",
            "\"service_status\":{},",
            "\"capture_mode\":{},",
            "\"permission_status\":{},",
            "\"db_status\":{},",
            "\"degraded_reason\":{}",
            "}}"
        ),
        service_health_json(status.service_status),
        capture_mode_json(status.capture_mode),
        service_health_json(status.permission_status),
        service_health_json(status.db_status),
        optional_string(status.degraded_reason.as_deref()),
    )
}

pub fn render_live_flows(snapshot: &RealtimeSnapshot) -> String {
    let items = snapshot
        .active_connections
        .iter()
        .map(render_live_connection)
        .collect::<Vec<_>>()
        .join(",");

    format!(
        concat!(
            "{{",
            "\"generated_at\":{},",
            "\"widget_state\":{},",
            "\"capture_mode\":{},",
            "\"upload_rate_bytes_per_sec\":{},",
            "\"download_rate_bytes_per_sec\":{},",
            "\"headline\":{},",
            "\"recent_alert_count\":{},",
            "\"agent_available\":{},",
            "\"items\":[{}]",
            "}}"
        ),
        snapshot.generated_at,
        json_string(&format!("{:?}", snapshot.widget_state)),
        capture_mode_json(snapshot.capture_mode),
        snapshot.upload_rate_bytes_per_sec,
        snapshot.download_rate_bytes_per_sec,
        optional_string(snapshot.headline.as_deref()),
        snapshot.recent_alert_count,
        snapshot.agent_available,
        items,
    )
}

pub fn render_history_page(page: &HistoryPage) -> String {
    let items = page
        .items
        .iter()
        .map(|item| {
            let (remote_host, remote_port, direction, protocol) = item
                .key
                .map(|key| {
                    (
                        item.target
                            .as_ref()
                            .map(|target| target.label().to_string())
                            .unwrap_or_else(|| key.remote.ip.to_string()),
                        key.remote.port,
                        format!("{:?}", key.direction),
                        format!("{:?}", key.protocol),
                    )
                })
                .unwrap_or_else(|| {
                    (
                        item.target
                            .as_ref()
                            .map(|target| target.label().to_string())
                            .unwrap_or_else(|| "unknown".to_string()),
                        0,
                        "Observed".to_string(),
                        "Tcp".to_string(),
                    )
                });

            format!(
                concat!(
                    "{{",
                    "\"session_id\":{},",
                    "\"process_name\":{},",
                    "\"pid\":{},",
                    "\"remote_host\":{},",
                    "\"remote_port\":{},",
                    "\"direction\":{},",
                    "\"protocol\":{},",
                    "\"started_at\":{},",
                    "\"ended_at\":{},",
                    "\"tx_bytes\":{},",
                    "\"rx_bytes\":{}",
                    "}}"
                ),
                json_string(&item.session_id),
                json_string(item.process.display_name()),
                item.process.pid,
                json_string(&remote_host),
                remote_port,
                json_string(&direction),
                json_string(&protocol),
                item.started_at,
                optional_number(item.ended_at),
                item.cumulative_counters.tx_bytes,
                item.cumulative_counters.rx_bytes,
            )
        })
        .collect::<Vec<_>>()
        .join(",");

    format!(
        "{{\"items\":[{}],\"total\":{},\"limit\":{},\"offset\":{}}}",
        items, page.total, page.limit, page.offset
    )
}

pub fn render_alerts(alerts: &[AlertRecord]) -> String {
    let items = alerts
        .iter()
        .map(|item| {
            format!(
                concat!(
                    "{{",
                    "\"id\":{},",
                    "\"alert_type\":{},",
                    "\"process_name\":{},",
                    "\"pid\":{},",
                    "\"remote_host\":{},",
                    "\"created_at\":{},",
                    "\"title\":{},",
                    "\"body\":{}",
                    "}}"
                ),
                json_string(&item.id),
                json_string(&format!("{:?}", item.kind)),
                json_string(item.process.display_name()),
                item.process.pid,
                optional_string(item.target_label.as_deref()),
                item.created_at,
                json_string(&item.summary),
                json_string(&item.summary),
            )
        })
        .collect::<Vec<_>>()
        .join(",");
    format!("{{\"items\":[{}]}}", items)
}

pub fn render_process_summaries(items: &[ProcessTrafficSummary]) -> String {
    let items = items
        .iter()
        .map(|item| {
            format!(
                concat!(
                    "{{",
                    "\"pid\":{},",
                    "\"process_name\":{},",
                    "\"parent_pid\":{},",
                    "\"parent_process_name\":{},",
                    "\"tx_bytes\":{},",
                    "\"rx_bytes\":{},",
                    "\"destination_count\":{},",
                    "\"last_active_at\":{},",
                    "\"has_active_alert\":{}",
                    "}}"
                ),
                item.process.pid,
                json_string(item.process.display_name()),
                optional_u32(item.process.parent_pid),
                optional_string(item.process.parent_name.as_deref()),
                item.cumulative_counters.tx_bytes,
                item.cumulative_counters.rx_bytes,
                item.destination_count,
                item.last_active_at,
                item.has_active_alert,
            )
        })
        .collect::<Vec<_>>()
        .join(",");
    format!("{{\"items\":[{}]}}", items)
}

pub fn render_process_detail(detail: &ProcessDetailSnapshot) -> String {
    let active_connections = detail
        .active_connections
        .iter()
        .map(render_live_connection)
        .collect::<Vec<_>>()
        .join(",");
    let alerts = detail
        .recent_alerts
        .iter()
        .map(|item| json_string(&item.summary))
        .collect::<Vec<_>>()
        .join(",");

    format!(
        concat!(
            "{{",
            "\"pid\":{},",
            "\"process_name\":{},",
            "\"last_active_at\":{},",
            "\"tx_bytes\":{},",
            "\"rx_bytes\":{},",
            "\"active_connections\":[{}],",
            "\"recent_alerts\":[{}]",
            "}}"
        ),
        detail.process.pid,
        json_string(detail.process.display_name()),
        optional_number(detail.last_active_at),
        detail.cumulative_counters.tx_bytes,
        detail.cumulative_counters.rx_bytes,
        active_connections,
        alerts,
    )
}

fn render_live_connection(item: &LiveConnection) -> String {
    format!(
        concat!(
            "{{",
            "\"session_id\":{},",
            "\"process_name\":{},",
            "\"pid\":{},",
            "\"parent_process_name\":{},",
            "\"direction\":{},",
            "\"remote_host\":{},",
            "\"remote_port\":{},",
            "\"local_port\":{},",
            "\"protocol\":{},",
            "\"current_tx_rate\":{},",
            "\"current_rx_rate\":{},",
            "\"first_seen_at\":{},",
            "\"last_seen_at\":{},",
            "\"state\":{},",
            "\"host_source\":{}",
            "}}"
        ),
        json_string(&format!(
            "{}-{:?}-{:?}-{}-{}-{}-{}-{}",
            item.process.pid,
            item.key.protocol,
            item.key.direction,
            item.key.local.ip,
            item.key.local.port,
            item.key.remote.ip,
            item.key.remote.port,
            item.first_seen_at
        )),
        json_string(item.process.display_name()),
        item.process.pid,
        optional_string(item.process.parent_name.as_deref()),
        json_string(&format!("{:?}", item.key.direction)),
        json_string(item.target.label()),
        item.key.remote.port,
        item.key.local.port,
        json_string(&format!("{:?}", item.key.protocol)),
        item.current_rate.tx_bytes_per_sec,
        item.current_rate.rx_bytes_per_sec,
        item.first_seen_at,
        item.last_seen_at,
        json_string(&format!("{:?}", item.connection_state)),
        hostname_source_json(item.target.source),
    )
}

fn json_string(value: &str) -> String {
    format!("\"{}\"", escape_json(value))
}

fn optional_string(value: Option<&str>) -> String {
    value.map(json_string).unwrap_or_else(|| "null".to_string())
}

fn optional_number(value: Option<i64>) -> String {
    value
        .map(|item| item.to_string())
        .unwrap_or_else(|| "null".to_string())
}

fn optional_u32(value: Option<u32>) -> String {
    value
        .map(|item| item.to_string())
        .unwrap_or_else(|| "null".to_string())
}

fn service_health_json(value: ServiceHealth) -> String {
    json_string(match value {
        ServiceHealth::Healthy => "healthy",
        ServiceHealth::Degraded => "degraded",
        ServiceHealth::Unavailable => "unavailable",
    })
}

fn capture_mode_json(value: CaptureMode) -> String {
    json_string(match value {
        CaptureMode::Ebpf => "ebpf",
        CaptureMode::ProcFallback => "proc_fallback",
        CaptureMode::Unavailable => "unavailable",
    })
}

fn hostname_source_json(value: HostnameSource) -> String {
    json_string(match value {
        HostnameSource::DnsCache => "dns_cache",
        HostnameSource::TlsSni => "tls_sni",
        HostnameSource::IpOnly => "ip_only",
    })
}

fn escape_json(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());
    for ch in value.chars() {
        match ch {
            '"' => escaped.push_str("\\\""),
            '\\' => escaped.push_str("\\\\"),
            '\n' => escaped.push_str("\\n"),
            '\r' => escaped.push_str("\\r"),
            '\t' => escaped.push_str("\\t"),
            _ => escaped.push(ch),
        }
    }
    escaped
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn json_escape_handles_quotes_and_newlines() {
        assert_eq!(escape_json("a\"b\n"), "a\\\"b\\n");
    }
}
