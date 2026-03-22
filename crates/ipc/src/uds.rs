pub const IPC_PROTOCOL_VERSION: u16 = 1;
pub const DEFAULT_SOCKET_PATH: &str = "/run/traffic-cat/agentd.sock";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MessageEnvelope<T> {
    pub version: u16,
    pub request_id: String,
    pub payload: T,
}

impl<T> MessageEnvelope<T> {
    pub fn new(request_id: impl Into<String>, payload: T) -> Self {
        Self {
            version: IPC_PROTOCOL_VERSION,
            request_id: request_id.into(),
            payload,
        }
    }
}
