#![allow(dead_code)]

use std::path::Path;

use tauri::{AppHandle, Manager, State};
use traffic_cat_domain::TrafficDirection;
use traffic_cat_ipc::HistoryQuery;

use crate::ipc::{BridgeResponse, DesktopBridge, UdsClientError};
use crate::settings::UiRuntimeConfig;
use crate::window;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ShellCommandSet {
    bridge: DesktopBridge,
}

pub const COMMAND_LOAD_DASHBOARD_PAYLOAD: &str = "bridge_load_dashboard_payload";
pub const COMMAND_LOAD_PROCESSES_PAYLOAD: &str = "bridge_load_processes_payload";
pub const COMMAND_LOAD_HISTORY_PAYLOAD: &str = "bridge_load_history_payload";
pub const COMMAND_LOAD_PROCESS_DETAIL_PAYLOAD: &str = "bridge_load_process_detail_payload";
pub const COMMAND_SHOW_MAIN_WINDOW: &str = "bridge_show_main_window";
pub const COMMAND_START_WIDGET_DRAGGING: &str = "bridge_start_widget_dragging";

impl Default for ShellCommandSet {
    fn default() -> Self {
        Self::from_runtime_config(UiRuntimeConfig::from_env())
    }
}

impl ShellCommandSet {
    pub fn new(bridge: DesktopBridge) -> Self {
        Self { bridge }
    }

    pub fn from_runtime_config(config: UiRuntimeConfig) -> Self {
        Self::new(DesktopBridge::new(
            config.socket_path(),
            config.request_timeout(),
        ))
    }

    pub fn socket_path(&self) -> &Path {
        self.bridge.socket_path()
    }

    pub fn fetch_health(&self) -> Result<BridgeResponse, UdsClientError> {
        self.bridge.health()
    }

    pub fn fetch_status(&self) -> Result<BridgeResponse, UdsClientError> {
        self.bridge.status()
    }

    pub fn fetch_live_flows(&self) -> Result<BridgeResponse, UdsClientError> {
        self.bridge.live_flows()
    }

    pub fn fetch_processes(&self) -> Result<BridgeResponse, UdsClientError> {
        self.bridge.processes()
    }

    pub fn fetch_history(
        &self,
        limit: usize,
        offset: usize,
    ) -> Result<BridgeResponse, UdsClientError> {
        self.bridge.history(limit, offset)
    }

    pub fn query_history(&self, query: &HistoryQuery) -> Result<BridgeResponse, UdsClientError> {
        self.bridge.query_history(query)
    }

    pub fn fetch_process_summary(
        &self,
        process_id: &str,
    ) -> Result<BridgeResponse, UdsClientError> {
        self.bridge.process_summary(process_id)
    }

    pub fn fetch_process_detail(&self, process_id: u32) -> Result<BridgeResponse, UdsClientError> {
        self.bridge.process_detail(process_id)
    }

    pub fn fetch_process_flows(&self, process_id: &str) -> Result<BridgeResponse, UdsClientError> {
        self.bridge.process_flows(process_id)
    }

    pub fn fetch_alerts(&self) -> Result<BridgeResponse, UdsClientError> {
        self.bridge.alerts()
    }

    pub fn mute_alerts_for_30_minutes(&self) -> Result<BridgeResponse, UdsClientError> {
        self.bridge.mute_alerts(30)
    }

    pub fn load_dashboard_payload(&self) -> Result<DashboardPayload, UdsClientError> {
        Ok(DashboardPayload {
            health_json: expect_success_body(self.fetch_health()?)?,
            status_json: expect_success_body(self.fetch_status()?)?,
            live_json: expect_success_body(self.fetch_live_flows()?)?,
            alerts_json: expect_success_body(self.fetch_alerts()?)?,
        })
    }

    pub fn load_processes_payload(&self) -> Result<ProcessesPayload, UdsClientError> {
        Ok(ProcessesPayload {
            summaries_json: expect_success_body(self.fetch_processes()?)?,
            alerts_json: expect_success_body(self.fetch_alerts()?)?,
        })
    }

    pub fn load_history_payload(
        &self,
        query: &HistoryQuery,
    ) -> Result<HistoryPayload, UdsClientError> {
        Ok(HistoryPayload {
            history_json: expect_success_body(self.query_history(query)?)?,
        })
    }

    pub fn load_process_detail_payload(
        &self,
        process_id: u32,
    ) -> Result<ProcessDetailPayload, UdsClientError> {
        Ok(ProcessDetailPayload {
            detail_json: expect_success_body(self.fetch_process_detail(process_id)?)?,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DashboardPayload {
    pub health_json: String,
    pub status_json: String,
    pub live_json: String,
    pub alerts_json: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProcessesPayload {
    pub summaries_json: String,
    pub alerts_json: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HistoryPayload {
    pub history_json: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProcessDetailPayload {
    pub detail_json: String,
}

pub fn run_cli(command_set: &ShellCommandSet, args: &[String]) -> Result<String, UdsClientError> {
    let Some(command) = args.first().map(String::as_str) else {
        return Err(UdsClientError::Parse("缺少命令名".to_string()));
    };

    match command {
        COMMAND_LOAD_DASHBOARD_PAYLOAD => command_set
            .load_dashboard_payload()
            .map(|payload| payload.to_json_string()),
        COMMAND_LOAD_PROCESSES_PAYLOAD => command_set
            .load_processes_payload()
            .map(|payload| payload.to_json_string()),
        COMMAND_LOAD_HISTORY_PAYLOAD => {
            let query = parse_history_cli_args(&args[1..])?;
            command_set
                .load_history_payload(&query)
                .map(|payload| payload.to_json_string())
        }
        COMMAND_LOAD_PROCESS_DETAIL_PAYLOAD => {
            let pid = parse_process_detail_cli_args(&args[1..])?;
            command_set
                .load_process_detail_payload(pid)
                .map(|payload| payload.to_json_string())
        }
        COMMAND_SHOW_MAIN_WINDOW => Ok("null".to_string()),
        COMMAND_START_WIDGET_DRAGGING => Ok("null".to_string()),
        other => Err(UdsClientError::Parse(format!("未知命令: {other}"))),
    }
}

fn expect_success_body(response: BridgeResponse) -> Result<String, UdsClientError> {
    if (200..300).contains(&response.response.status_code) {
        Ok(response.response.body)
    } else {
        Err(UdsClientError::Parse(format!(
            "接口 {} 返回非成功状态 {}",
            response.endpoint, response.response.status_code
        )))
    }
}

impl DashboardPayload {
    fn to_json_string(&self) -> String {
        format!(
            concat!(
                "{{",
                "\"healthJson\":{},",
                "\"statusJson\":{},",
                "\"liveJson\":{},",
                "\"alertsJson\":{}",
                "}}"
            ),
            json_string(&self.health_json),
            json_string(&self.status_json),
            json_string(&self.live_json),
            json_string(&self.alerts_json),
        )
    }
}

impl ProcessesPayload {
    fn to_json_string(&self) -> String {
        format!(
            concat!("{{", "\"summariesJson\":{},", "\"alertsJson\":{}", "}}"),
            json_string(&self.summaries_json),
            json_string(&self.alerts_json),
        )
    }
}

impl HistoryPayload {
    fn to_json_string(&self) -> String {
        format!("{{\"historyJson\":{}}}", json_string(&self.history_json))
    }
}

impl ProcessDetailPayload {
    fn to_json_string(&self) -> String {
        format!("{{\"detailJson\":{}}}", json_string(&self.detail_json))
    }
}

#[tauri::command]
pub fn bridge_load_dashboard_payload(
    command_set: State<'_, ShellCommandSet>,
) -> Result<String, String> {
    command_set
        .load_dashboard_payload()
        .map(|payload| payload.to_json_string())
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn bridge_load_processes_payload(
    command_set: State<'_, ShellCommandSet>,
) -> Result<String, String> {
    command_set
        .load_processes_payload()
        .map(|payload| payload.to_json_string())
        .map_err(|err| err.to_string())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn bridge_load_history_payload(
    process_name: Option<String>,
    target: Option<String>,
    port: Option<u16>,
    direction: Option<String>,
    started_after: Option<i64>,
    ended_before: Option<i64>,
    limit: Option<usize>,
    offset: Option<usize>,
    include_lan_traffic: Option<bool>,
    command_set: State<'_, ShellCommandSet>,
) -> Result<String, String> {
    let mut query = HistoryQuery::default();
    query.process_name = process_name;
    query.target = target;
    query.port = port;
    query.direction = parse_direction_input(direction.as_deref()).map_err(|err| err.to_string())?;
    query.started_after = started_after;
    query.ended_before = ended_before;
    query.limit = limit.unwrap_or(query.limit);
    query.offset = offset.unwrap_or(query.offset);
    query.include_lan_traffic = include_lan_traffic.unwrap_or(false);

    command_set
        .load_history_payload(&query)
        .map(|payload| payload.to_json_string())
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn bridge_load_process_detail_payload(
    pid: u32,
    command_set: State<'_, ShellCommandSet>,
) -> Result<String, String> {
    command_set
        .load_process_detail_payload(pid)
        .map(|payload| payload.to_json_string())
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn bridge_show_main_window(
    view: Option<String>,
    app: AppHandle,
    runtime_config: State<'_, UiRuntimeConfig>,
) -> Result<(), String> {
    window::show_or_create_dashboard(&app, &runtime_config, view.as_deref())
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn bridge_start_widget_dragging(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window(window::WIDGET_WINDOW_LABEL)
        .ok_or_else(|| "未找到挂件窗口".to_string())?;

    window.start_dragging().map_err(|err| err.to_string())
}

fn parse_history_cli_args(args: &[String]) -> Result<HistoryQuery, UdsClientError> {
    let mut query = HistoryQuery::default();
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--process-name" => {
                query.process_name = Some(next_cli_value(args, &mut index, "--process-name")?);
            }
            "--target" => {
                query.target = Some(next_cli_value(args, &mut index, "--target")?);
            }
            "--port" => {
                query.port = Some(
                    next_cli_value(args, &mut index, "--port")?
                        .parse::<u16>()
                        .map_err(|_| UdsClientError::Parse("port 必须是数字".to_string()))?,
                );
            }
            "--direction" => {
                query.direction = Some(
                    match next_cli_value(args, &mut index, "--direction")?.as_str() {
                        "outbound" => TrafficDirection::Outbound,
                        "inbound" => TrafficDirection::Inbound,
                        _ => {
                            return Err(UdsClientError::Parse(
                                "direction 必须是 outbound 或 inbound".to_string(),
                            ))
                        }
                    },
                );
            }
            "--started-after" => {
                query.started_after = Some(
                    next_cli_value(args, &mut index, "--started-after")?
                        .parse::<i64>()
                        .map_err(|_| {
                            UdsClientError::Parse("started-after 必须是数字".to_string())
                        })?,
                );
            }
            "--ended-before" => {
                query.ended_before = Some(
                    next_cli_value(args, &mut index, "--ended-before")?
                        .parse::<i64>()
                        .map_err(|_| {
                            UdsClientError::Parse("ended-before 必须是数字".to_string())
                        })?,
                );
            }
            "--limit" => {
                query.limit = next_cli_value(args, &mut index, "--limit")?
                    .parse::<usize>()
                    .map_err(|_| UdsClientError::Parse("limit 必须是数字".to_string()))?;
            }
            "--offset" => {
                query.offset = next_cli_value(args, &mut index, "--offset")?
                    .parse::<usize>()
                    .map_err(|_| UdsClientError::Parse("offset 必须是数字".to_string()))?;
            }
            "--include-lan-traffic" => {
                query.include_lan_traffic = true;
            }
            flag => {
                return Err(UdsClientError::Parse(format!("未知参数: {flag}")));
            }
        }
        index += 1;
    }

    Ok(query)
}

fn parse_process_detail_cli_args(args: &[String]) -> Result<u32, UdsClientError> {
    let mut index = 0;
    while index < args.len() {
        match args[index].as_str() {
            "--pid" => {
                return next_cli_value(args, &mut index, "--pid")?
                    .parse::<u32>()
                    .map_err(|_| UdsClientError::Parse("pid 必须是数字".to_string()));
            }
            flag => {
                return Err(UdsClientError::Parse(format!("未知参数: {flag}")));
            }
        }
    }

    Err(UdsClientError::Parse("缺少 --pid 参数".to_string()))
}

fn parse_direction_input(value: Option<&str>) -> Result<Option<TrafficDirection>, UdsClientError> {
    match value {
        Some("outbound") => Ok(Some(TrafficDirection::Outbound)),
        Some("inbound") => Ok(Some(TrafficDirection::Inbound)),
        Some(other) => Err(UdsClientError::Parse(format!(
            "direction 必须是 outbound 或 inbound，收到 {other}"
        ))),
        None => Ok(None),
    }
}

fn next_cli_value(
    args: &[String],
    index: &mut usize,
    flag: &str,
) -> Result<String, UdsClientError> {
    let next = args
        .get(*index + 1)
        .cloned()
        .ok_or_else(|| UdsClientError::Parse(format!("{flag} 缺少参数值")))?;
    *index += 1;
    Ok(next)
}

fn json_string(value: &str) -> String {
    format!("\"{}\"", escape_json(value))
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
            other => escaped.push(other),
        }
    }
    escaped
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::io::{Read, Write};
    use std::os::unix::net::UnixListener;
    use std::path::{Path, PathBuf};
    use std::thread;
    use std::time::Duration;
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::*;

    fn temp_socket_path() -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("traffic-cat-command-{suffix}.sock"))
    }

    fn ok_response(body: &str) -> String {
        format!(
            "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        )
    }

    fn error_response(status_code: u16, reason: &str, body: &str) -> String {
        format!(
            "HTTP/1.1 {status_code} {reason}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        )
    }

    fn request_path(request: &str) -> &str {
        request
            .lines()
            .next()
            .and_then(|line| line.split_whitespace().nth(1))
            .unwrap()
    }

    fn spawn_server(
        socket_path: &Path,
        expected_requests: usize,
        handler: impl Fn(&str) -> String + Send + 'static,
    ) -> thread::JoinHandle<()> {
        let listener = UnixListener::bind(socket_path).unwrap();
        thread::spawn(move || {
            for _ in 0..expected_requests {
                let (mut stream, _) = listener.accept().unwrap();
                let mut request = String::new();
                stream.read_to_string(&mut request).unwrap();
                let response = handler(&request);
                stream.write_all(response.as_bytes()).unwrap();
            }
        })
    }

    #[test]
    fn load_dashboard_payload_collects_all_successful_bodies() {
        let socket_path = temp_socket_path();
        let handle = spawn_server(&socket_path, 4, |request| match request_path(request) {
            "/health" => ok_response("{\"health\":true}"),
            "/status" => ok_response("{\"status\":\"healthy\"}"),
            "/flows/live" => ok_response("{\"items\":[]}"),
            "/alerts" => ok_response("{\"items\":[]}"),
            other => error_response(404, "Not Found", other),
        });

        let commands =
            ShellCommandSet::new(DesktopBridge::new(&socket_path, Duration::from_secs(1)));
        let payload = commands.load_dashboard_payload().unwrap();

        assert_eq!(payload.health_json, "{\"health\":true}");
        assert_eq!(payload.status_json, "{\"status\":\"healthy\"}");
        assert_eq!(payload.live_json, "{\"items\":[]}");
        assert_eq!(payload.alerts_json, "{\"items\":[]}");

        handle.join().unwrap();
        let _ = fs::remove_file(socket_path);
    }

    #[test]
    fn load_processes_and_history_payload_follow_expected_endpoints() {
        let socket_path = temp_socket_path();
        let handle = spawn_server(&socket_path, 3, |request| match request_path(request) {
            "/processes" => ok_response("{\"items\":[{\"pid\":7}]}"),
            "/alerts" => ok_response("{\"items\":[{\"id\":\"alert-1\"}]}"),
            "/flows/history?target=github&include_lan_traffic=true&limit=20&offset=5" => {
                ok_response("{\"items\":[],\"total\":0,\"limit\":20,\"offset\":5}")
            }
            other => error_response(404, "Not Found", other),
        });

        let commands =
            ShellCommandSet::new(DesktopBridge::new(&socket_path, Duration::from_secs(1)));
        let processes = commands.load_processes_payload().unwrap();
        let history = commands
            .load_history_payload(&HistoryQuery {
                target: Some("github".to_string()),
                include_lan_traffic: true,
                limit: 20,
                offset: 5,
                ..HistoryQuery::default()
            })
            .unwrap();

        assert_eq!(processes.summaries_json, "{\"items\":[{\"pid\":7}]}");
        assert_eq!(processes.alerts_json, "{\"items\":[{\"id\":\"alert-1\"}]}");
        assert_eq!(
            history.history_json,
            "{\"items\":[],\"total\":0,\"limit\":20,\"offset\":5}"
        );

        handle.join().unwrap();
        let _ = fs::remove_file(socket_path);
    }

    #[test]
    fn load_process_detail_payload_surfaces_http_errors() {
        let socket_path = temp_socket_path();
        let handle = spawn_server(&socket_path, 1, |_| {
            error_response(404, "Not Found", "{\"error\":\"missing\"}")
        });

        let commands =
            ShellCommandSet::new(DesktopBridge::new(&socket_path, Duration::from_secs(1)));
        let error = commands.load_process_detail_payload(42).unwrap_err();

        assert!(error.to_string().contains("返回非成功状态 404"));

        handle.join().unwrap();
        let _ = fs::remove_file(socket_path);
    }

    #[test]
    fn run_cli_formats_dashboard_payload_as_json_object() {
        let socket_path = temp_socket_path();
        let handle = spawn_server(&socket_path, 4, |request| match request_path(request) {
            "/health" => ok_response("{\"health\":true}"),
            "/status" => ok_response("{\"status\":\"healthy\"}"),
            "/flows/live" => ok_response("{\"items\":[]}"),
            "/alerts" => ok_response("{\"items\":[]}"),
            other => error_response(404, "Not Found", other),
        });

        let commands =
            ShellCommandSet::new(DesktopBridge::new(&socket_path, Duration::from_secs(1)));
        let output = run_cli(&commands, &[COMMAND_LOAD_DASHBOARD_PAYLOAD.to_string()]).unwrap();

        assert!(output.contains("\"healthJson\":\"{\\\"health\\\":true}\""));
        assert!(output.contains("\"alertsJson\":\"{\\\"items\\\":[]}\""));

        handle.join().unwrap();
        let _ = fs::remove_file(socket_path);
    }

    #[test]
    fn run_cli_parses_history_arguments() {
        let socket_path = temp_socket_path();
        let handle = spawn_server(&socket_path, 1, |request| {
            match request_path(request) {
            "/flows/history?process_name=firefox&port=443&direction=outbound&started_after=100&ended_before=200&include_lan_traffic=true&limit=20&offset=5" => {
                ok_response("{\"items\":[],\"total\":0,\"limit\":20,\"offset\":5}")
            }
            other => error_response(404, "Not Found", other),
        }
        });

        let commands =
            ShellCommandSet::new(DesktopBridge::new(&socket_path, Duration::from_secs(1)));
        let output = run_cli(
            &commands,
            &[
                COMMAND_LOAD_HISTORY_PAYLOAD.to_string(),
                "--process-name".to_string(),
                "firefox".to_string(),
                "--port".to_string(),
                "443".to_string(),
                "--direction".to_string(),
                "outbound".to_string(),
                "--started-after".to_string(),
                "100".to_string(),
                "--ended-before".to_string(),
                "200".to_string(),
                "--include-lan-traffic".to_string(),
                "--limit".to_string(),
                "20".to_string(),
                "--offset".to_string(),
                "5".to_string(),
            ],
        )
        .unwrap();

        assert!(output.contains("\"historyJson\":"));
        assert!(output.contains("\\\"limit\\\":20"));

        handle.join().unwrap();
        let _ = fs::remove_file(socket_path);
    }

    #[test]
    fn run_cli_accepts_show_main_window_as_noop_for_dev_bridge() {
        let commands = ShellCommandSet::new(DesktopBridge::new(
            "/tmp/not-used.sock",
            Duration::from_secs(1),
        ));

        let output = run_cli(&commands, &[COMMAND_SHOW_MAIN_WINDOW.to_string()]).unwrap();

        assert_eq!(output, "null");
    }
}
