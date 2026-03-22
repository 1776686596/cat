#![allow(dead_code)]

use std::fmt::{Display, Formatter};
use std::io::{Read, Write};
use std::os::unix::net::UnixStream;
use std::path::{Path, PathBuf};
use std::time::Duration;

#[derive(Debug)]
pub enum UdsClientError {
    Io(std::io::Error),
    Parse(String),
}

impl Display for UdsClientError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Io(err) => write!(f, "uds 客户端 io 错误: {err}"),
            Self::Parse(message) => write!(f, "uds 响应解析错误: {message}"),
        }
    }
}

impl std::error::Error for UdsClientError {}

impl From<std::io::Error> for UdsClientError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HttpMethod {
    Get,
    Post,
}

impl HttpMethod {
    fn as_str(self) -> &'static str {
        match self {
            Self::Get => "GET",
            Self::Post => "POST",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HttpRequest {
    pub method: HttpMethod,
    pub path: String,
    pub body: Option<String>,
    pub content_type: Option<String>,
}

impl HttpRequest {
    pub fn get(path: impl Into<String>) -> Self {
        Self {
            method: HttpMethod::Get,
            path: path.into(),
            body: None,
            content_type: None,
        }
    }

    pub fn post_json(path: impl Into<String>, body: impl Into<String>) -> Self {
        Self {
            method: HttpMethod::Post,
            path: path.into(),
            body: Some(body.into()),
            content_type: Some("application/json".to_string()),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HttpResponse {
    pub status_code: u16,
    pub reason_phrase: String,
    pub headers: Vec<(String, String)>,
    pub body: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AgentHttpClient {
    socket_path: PathBuf,
    timeout: Duration,
}

impl AgentHttpClient {
    pub fn new(socket_path: impl Into<PathBuf>, timeout: Duration) -> Self {
        Self {
            socket_path: socket_path.into(),
            timeout,
        }
    }

    pub fn socket_path(&self) -> &Path {
        &self.socket_path
    }

    pub fn send(&self, request: HttpRequest) -> Result<HttpResponse, UdsClientError> {
        let mut stream = UnixStream::connect(&self.socket_path)?;
        stream.set_read_timeout(Some(self.timeout))?;
        stream.set_write_timeout(Some(self.timeout))?;

        let payload = build_http_request(&request);
        stream.write_all(payload.as_bytes())?;
        stream.shutdown(std::net::Shutdown::Write)?;

        let mut response = String::new();
        stream.read_to_string(&mut response)?;
        parse_http_response(&response)
    }
}

fn build_http_request(request: &HttpRequest) -> String {
    let body = request.body.as_deref().unwrap_or("");
    let content_type = request
        .content_type
        .as_deref()
        .unwrap_or("application/json");

    let mut lines = vec![
        format!("{} {} HTTP/1.1", request.method.as_str(), request.path),
        "Host: localhost".to_string(),
        "Connection: close".to_string(),
    ];

    if !body.is_empty() {
        lines.push(format!("Content-Type: {content_type}"));
        lines.push(format!("Content-Length: {}", body.len()));
    }

    let mut payload = lines.join("\r\n");
    payload.push_str("\r\n\r\n");
    payload.push_str(body);
    payload
}

fn parse_http_response(raw: &str) -> Result<HttpResponse, UdsClientError> {
    let (head, body) = raw
        .split_once("\r\n\r\n")
        .ok_or_else(|| UdsClientError::Parse("缺少 HTTP 头部分隔符".to_string()))?;
    let mut lines = head.lines();
    let status_line = lines
        .next()
        .ok_or_else(|| UdsClientError::Parse("缺少状态行".to_string()))?;
    let mut status_parts = status_line.splitn(3, ' ');
    let _version = status_parts
        .next()
        .ok_or_else(|| UdsClientError::Parse("缺少协议版本".to_string()))?;
    let status_code = status_parts
        .next()
        .ok_or_else(|| UdsClientError::Parse("缺少状态码".to_string()))?
        .parse::<u16>()
        .map_err(|_| UdsClientError::Parse("状态码无法解析".to_string()))?;
    let reason_phrase = status_parts.next().unwrap_or("").to_string();

    let headers = lines
        .filter_map(|line| line.split_once(':'))
        .map(|(name, value)| (name.trim().to_string(), value.trim().to_string()))
        .collect();

    Ok(HttpResponse {
        status_code,
        reason_phrase,
        headers,
        body: body.to_string(),
    })
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::io::{Read, Write};
    use std::os::unix::net::UnixListener;
    use std::thread;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

    use super::*;

    fn temp_socket_path() -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("traffic-cat-shell-{suffix}.sock"))
    }

    #[test]
    fn uds_client_sends_http_request_and_reads_response() {
        let socket_path = temp_socket_path();
        let listener = UnixListener::bind(&socket_path).unwrap();

        let handle = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = String::new();
            stream.read_to_string(&mut request).unwrap();
            assert!(request.starts_with("GET /health HTTP/1.1"));

            let response = "HTTP/1.1 200 OK\r\nContent-Length: 11\r\n\r\n{\"ok\":true}";
            stream.write_all(response.as_bytes()).unwrap();
        });

        let client = AgentHttpClient::new(&socket_path, Duration::from_secs(1));
        let response = client.send(HttpRequest::get("/health")).unwrap();

        assert_eq!(response.status_code, 200);
        assert_eq!(response.body, "{\"ok\":true}");

        handle.join().unwrap();
        let _ = fs::remove_file(socket_path);
    }
}
