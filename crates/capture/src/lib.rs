pub mod fallback;
pub mod parser;

use std::fmt::{Display, Formatter};
use std::io;

use traffic_cat_domain::{CaptureMode, ConnectionState, FlowSample, TrafficRate};

#[derive(Debug)]
pub enum CaptureError {
    Io(io::Error),
    Parse(String),
}

impl Display for CaptureError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Io(err) => write!(f, "io 错误: {err}"),
            Self::Parse(message) => write!(f, "解析错误: {message}"),
        }
    }
}

impl std::error::Error for CaptureError {}

impl From<io::Error> for CaptureError {
    fn from(value: io::Error) -> Self {
        Self::Io(value)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ObservedFlow {
    pub sample: FlowSample,
    pub connection_state: ConnectionState,
    pub source_inode: u64,
    pub current_rate_estimate: Option<TrafficRate>,
}

pub trait CaptureCollector {
    fn mode(&self) -> CaptureMode;

    fn collect(
        &mut self,
        observed_at: traffic_cat_domain::UnixMillis,
    ) -> Result<Vec<ObservedFlow>, CaptureError>;
}
