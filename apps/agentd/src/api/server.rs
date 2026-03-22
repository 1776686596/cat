use std::fs;
use std::io::{Read, Write};
use std::os::unix::fs::PermissionsExt;
use std::os::unix::net::{UnixListener, UnixStream};
use std::path::PathBuf;

use crate::runtime::AgentRuntime;
use crate::services::json::{
    render_ack, render_alerts, render_health_snapshot, render_history_page, render_live_flows,
    render_process_detail, render_process_summaries, render_status, JsonErrorPayload,
};
use traffic_cat_ipc::HistoryQuery;

pub struct AgentHttpServer {
    runtime: AgentRuntime,
    socket_path: PathBuf,
    listener: UnixListener,
}

impl AgentHttpServer {
    pub fn new(runtime: AgentRuntime, socket_path: PathBuf) -> Result<Self, std::io::Error> {
        if let Some(parent) = socket_path.parent() {
            fs::create_dir_all(parent)?;
        }
        if socket_path.exists() {
            let _ = fs::remove_file(&socket_path);
        }

        let listener = UnixListener::bind(&socket_path)?;
        fs::set_permissions(&socket_path, fs::Permissions::from_mode(0o666))?;
        Ok(Self {
            runtime,
            socket_path,
            listener,
        })
    }

    pub fn serve(&self) -> Result<(), std::io::Error> {
        for stream in self.listener.incoming() {
            match stream {
                Ok(stream) => {
                    if let Err(err) = self.handle_connection(stream) {
                        eprintln!("agentd API 连接处理失败: {err}");
                    }
                }
                Err(err) => {
                    eprintln!(
                        "agentd API socket 接收失败 {}: {err}",
                        self.socket_path.display()
                    );
                }
            }
        }

        Ok(())
    }

    fn handle_connection(&self, mut stream: UnixStream) -> Result<(), std::io::Error> {
        let mut request = String::new();
        stream.read_to_string(&mut request)?;
        let response = self.dispatch(&request);
        stream.write_all(response.as_bytes())?;
        Ok(())
    }

    fn dispatch(&self, request: &str) -> String {
        let Some((method, raw_path, body)) = parse_request(request) else {
            return http_response(
                400,
                "Bad Request",
                &render_error(JsonErrorPayload {
                    code: "invalid_request",
                    message: "无法解析 HTTP 请求",
                }),
            );
        };
        let (path, query) = split_path_and_query(&raw_path);

        match (method, path) {
            ("GET", "/health") => http_response(
                200,
                "OK",
                &render_health_snapshot(&self.runtime.health_snapshot()),
            ),
            ("GET", "/status") => http_response(200, "OK", &render_status(&self.runtime.status())),
            ("GET", "/flows/live") => http_response(
                200,
                "OK",
                &render_live_flows(&self.runtime.realtime_snapshot()),
            ),
            ("GET", "/flows/history") => {
                let history_query = parse_history_query(query);
                http_response(
                    200,
                    "OK",
                    &render_history_page(&self.runtime.history_page(&history_query)),
                )
            }
            ("GET", "/alerts") => {
                let limit = parse_query_pairs(query)
                    .get("limit")
                    .and_then(|value| value.parse::<usize>().ok())
                    .unwrap_or(20);
                http_response(
                    200,
                    "OK",
                    &render_alerts(&self.runtime.recent_alerts(limit)),
                )
            }
            ("GET", "/processes") => http_response(
                200,
                "OK",
                &render_process_summaries(&self.runtime.process_summaries()),
            ),
            ("POST", "/settings/mute-alerts") => {
                let minutes = parse_minutes(body).unwrap_or(30);
                match self.runtime.mute_alerts(minutes) {
                    Ok(mute_until) => http_response(
                        200,
                        "OK",
                        &render_ack(&format!("提醒已静音到 {mute_until}")),
                    ),
                    Err(err) => http_response(
                        500,
                        "Internal Server Error",
                        &render_error(JsonErrorPayload {
                            code: "store_error",
                            message: &err.to_string(),
                        }),
                    ),
                }
            }
            ("GET", _) if path.starts_with("/processes/") && path.ends_with("/summary") => {
                match parse_process_id(&path).and_then(|pid| self.runtime.process_detail(pid)) {
                    Some(detail) => http_response(200, "OK", &render_process_detail(&detail)),
                    None => http_response(
                        404,
                        "Not Found",
                        &render_error(JsonErrorPayload {
                            code: "not_found",
                            message: "进程不存在",
                        }),
                    ),
                }
            }
            ("GET", _) if path.starts_with("/processes/") && path.ends_with("/flows") => {
                match parse_process_id(&path).and_then(|pid| self.runtime.process_detail(pid)) {
                    Some(detail) => http_response(200, "OK", &render_process_detail(&detail)),
                    None => http_response(
                        404,
                        "Not Found",
                        &render_error(JsonErrorPayload {
                            code: "not_found",
                            message: "进程不存在",
                        }),
                    ),
                }
            }
            _ => http_response(
                404,
                "Not Found",
                &render_error(JsonErrorPayload {
                    code: "not_found",
                    message: "接口不存在",
                }),
            ),
        }
    }
}

fn parse_request(request: &str) -> Option<(&str, String, &str)> {
    let (head, body) = request.split_once("\r\n\r\n")?;
    let request_line = head.lines().next()?;
    let mut parts = request_line.split_whitespace();
    let method = parts.next()?;
    let path = parts.next()?.to_string();
    Some((method, path, body))
}

fn split_path_and_query(path: &str) -> (&str, Option<&str>) {
    match path.split_once('?') {
        Some((clean_path, query)) => (clean_path, Some(query)),
        None => (path, None),
    }
}

fn parse_query_pairs(query: Option<&str>) -> std::collections::HashMap<String, String> {
    let mut pairs = std::collections::HashMap::new();
    let Some(query) = query else {
        return pairs;
    };

    for pair in query.split('&') {
        if pair.is_empty() {
            continue;
        }

        let (key, value) = match pair.split_once('=') {
            Some(parts) => parts,
            None => (pair, ""),
        };
        pairs.insert(key.to_string(), value.to_string());
    }

    pairs
}

fn parse_history_query(query: Option<&str>) -> HistoryQuery {
    let pairs = parse_query_pairs(query);
    HistoryQuery {
        process_name: pairs
            .get("process_name")
            .cloned()
            .filter(|value| !value.is_empty()),
        target: pairs
            .get("target")
            .cloned()
            .filter(|value| !value.is_empty()),
        port: pairs
            .get("port")
            .and_then(|value| value.parse::<u16>().ok()),
        direction: pairs
            .get("direction")
            .and_then(|value| match value.as_str() {
                "outbound" => Some(traffic_cat_domain::TrafficDirection::Outbound),
                "inbound" => Some(traffic_cat_domain::TrafficDirection::Inbound),
                _ => None,
            }),
        started_after: pairs
            .get("started_after")
            .and_then(|value| value.parse::<i64>().ok()),
        ended_before: pairs
            .get("ended_before")
            .and_then(|value| value.parse::<i64>().ok()),
        include_lan_traffic: pairs
            .get("include_lan_traffic")
            .map(|value| value == "true")
            .unwrap_or(false),
        limit: pairs
            .get("limit")
            .and_then(|value| value.parse::<usize>().ok())
            .unwrap_or(100),
        offset: pairs
            .get("offset")
            .and_then(|value| value.parse::<usize>().ok())
            .unwrap_or(0),
    }
}

fn http_response(status_code: u16, reason: &str, body: &str) -> String {
    format!(
        "HTTP/1.1 {status_code} {reason}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    )
}

fn parse_minutes(body: &str) -> Option<u16> {
    let marker = "\"minutes\":";
    let index = body.find(marker)?;
    let digits = body[index + marker.len()..]
        .chars()
        .skip_while(|char| char.is_whitespace())
        .take_while(|char| char.is_ascii_digit())
        .collect::<String>();
    digits.parse::<u16>().ok()
}

fn parse_process_id(path: &str) -> Option<u32> {
    path.trim_start_matches("/processes/")
        .split('/')
        .next()?
        .parse::<u32>()
        .ok()
}

fn render_error(payload: JsonErrorPayload<'_>) -> String {
    format!(
        "{{\"error\":{{\"code\":\"{}\",\"message\":\"{}\"}}}}",
        payload.code, payload.message
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_minutes_from_json_body() {
        assert_eq!(parse_minutes("{\"minutes\":30}"), Some(30));
        assert_eq!(parse_minutes("{}"), None);
    }

    #[test]
    fn parse_process_id_from_route() {
        assert_eq!(parse_process_id("/processes/42/summary"), Some(42));
        assert_eq!(parse_process_id("/processes/demo/summary"), None);
    }

    #[test]
    fn parse_history_query_from_query_string() {
        let query = parse_history_query(Some(
            "process_name=firefox&target=github&limit=20&offset=5&include_lan_traffic=true",
        ));

        assert_eq!(query.process_name.as_deref(), Some("firefox"));
        assert_eq!(query.target.as_deref(), Some("github"));
        assert_eq!(query.limit, 20);
        assert_eq!(query.offset, 5);
        assert!(query.include_lan_traffic);
    }
}
