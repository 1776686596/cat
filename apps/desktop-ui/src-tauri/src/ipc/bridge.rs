#![allow(dead_code)]

use std::path::Path;
use std::time::Duration;

use traffic_cat_ipc::{HistoryQuery, DEFAULT_SOCKET_PATH};

use super::client::{AgentHttpClient, HttpRequest, HttpResponse, UdsClientError};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BridgeResponse {
    pub endpoint: String,
    pub response: HttpResponse,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DesktopBridge {
    client: AgentHttpClient,
}

impl Default for DesktopBridge {
    fn default() -> Self {
        Self::new(DEFAULT_SOCKET_PATH, Duration::from_secs(2))
    }
}

impl DesktopBridge {
    pub fn new(socket_path: impl AsRef<Path>, timeout: Duration) -> Self {
        Self {
            client: AgentHttpClient::new(socket_path.as_ref().to_path_buf(), timeout),
        }
    }

    pub fn socket_path(&self) -> &Path {
        self.client.socket_path()
    }

    pub fn health(&self) -> Result<BridgeResponse, UdsClientError> {
        self.call("/health")
    }

    pub fn status(&self) -> Result<BridgeResponse, UdsClientError> {
        self.call("/status")
    }

    pub fn live_flows(&self) -> Result<BridgeResponse, UdsClientError> {
        self.call("/flows/live")
    }

    pub fn history(&self, limit: usize, offset: usize) -> Result<BridgeResponse, UdsClientError> {
        self.query_history(&HistoryQuery {
            limit,
            offset,
            ..HistoryQuery::default()
        })
    }

    pub fn query_history(&self, query: &HistoryQuery) -> Result<BridgeResponse, UdsClientError> {
        self.call_owned(build_history_endpoint(query))
    }

    pub fn processes(&self) -> Result<BridgeResponse, UdsClientError> {
        self.call("/processes")
    }

    pub fn process_summary(&self, process_id: &str) -> Result<BridgeResponse, UdsClientError> {
        self.call_owned(format!("/processes/{process_id}/summary"))
    }

    pub fn process_detail(&self, process_id: u32) -> Result<BridgeResponse, UdsClientError> {
        self.call_owned(format!("/processes/{process_id}/summary"))
    }

    pub fn process_flows(&self, process_id: &str) -> Result<BridgeResponse, UdsClientError> {
        self.call_owned(format!("/processes/{process_id}/flows"))
    }

    pub fn alerts(&self) -> Result<BridgeResponse, UdsClientError> {
        self.call("/alerts")
    }

    pub fn mute_alerts(&self, minutes: u16) -> Result<BridgeResponse, UdsClientError> {
        let endpoint = "/settings/mute-alerts";
        let request = HttpRequest::post_json(endpoint, format!("{{\"minutes\":{minutes}}}"));
        let response = self.client.send(request)?;
        Ok(BridgeResponse {
            endpoint: endpoint.to_string(),
            response,
        })
    }

    fn call(&self, endpoint: &'static str) -> Result<BridgeResponse, UdsClientError> {
        let response = self.client.send(HttpRequest::get(endpoint))?;
        Ok(BridgeResponse {
            endpoint: endpoint.to_string(),
            response,
        })
    }

    fn call_owned(&self, endpoint: String) -> Result<BridgeResponse, UdsClientError> {
        let response = self.client.send(HttpRequest::get(endpoint.as_str()))?;
        Ok(BridgeResponse { endpoint, response })
    }
}

fn build_history_endpoint(query: &HistoryQuery) -> String {
    let mut pairs = Vec::new();

    if let Some(process_name) = query.process_name.as_deref() {
        pairs.push(format!("process_name={process_name}"));
    }
    if let Some(target) = query.target.as_deref() {
        pairs.push(format!("target={target}"));
    }
    if let Some(port) = query.port {
        pairs.push(format!("port={port}"));
    }
    if let Some(direction) = query.direction {
        let value = format!("{direction:?}").to_lowercase();
        pairs.push(format!("direction={value}"));
    }
    if let Some(started_after) = query.started_after {
        pairs.push(format!("started_after={started_after}"));
    }
    if let Some(ended_before) = query.ended_before {
        pairs.push(format!("ended_before={ended_before}"));
    }

    pairs.push(format!(
        "include_lan_traffic={}",
        if query.include_lan_traffic {
            "true"
        } else {
            "false"
        }
    ));
    pairs.push(format!("limit={}", query.limit));
    pairs.push(format!("offset={}", query.offset));

    format!("/flows/history?{}", pairs.join("&"))
}
