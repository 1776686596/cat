use std::net::IpAddr;

use crate::enums::{
    CaptureMode, ConnectionState, HostnameSource, TrafficDirection, TransportProtocol,
};
use crate::process::ProcessRef;
use crate::UnixMillis;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct SocketEndpoint {
    pub ip: IpAddr,
    pub port: u16,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ResolvedTarget {
    pub ip: IpAddr,
    pub display_name: String,
    pub source: HostnameSource,
}

impl ResolvedTarget {
    pub fn label(&self) -> &str {
        if self.display_name.is_empty() {
            "unknown-target"
        } else {
            self.display_name.as_str()
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct FlowKey {
    pub pid: u32,
    pub protocol: TransportProtocol,
    pub direction: TrafficDirection,
    pub local: SocketEndpoint,
    pub remote: SocketEndpoint,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub struct TrafficCounters {
    pub tx_bytes: u64,
    pub rx_bytes: u64,
}

impl TrafficCounters {
    pub fn total_bytes(&self) -> u64 {
        self.tx_bytes.saturating_add(self.rx_bytes)
    }

    pub fn accumulate(&mut self, delta: Self) {
        self.tx_bytes = self.tx_bytes.saturating_add(delta.tx_bytes);
        self.rx_bytes = self.rx_bytes.saturating_add(delta.rx_bytes);
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub struct TrafficRate {
    pub tx_bytes_per_sec: u64,
    pub rx_bytes_per_sec: u64,
}

impl TrafficRate {
    pub fn total_bytes_per_sec(&self) -> u64 {
        self.tx_bytes_per_sec.saturating_add(self.rx_bytes_per_sec)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FlowSample {
    pub process: ProcessRef,
    pub protocol: TransportProtocol,
    pub direction: TrafficDirection,
    pub local: SocketEndpoint,
    pub remote: SocketEndpoint,
    pub bytes_delta: TrafficCounters,
    pub observed_at: UnixMillis,
    pub capture_mode: CaptureMode,
}

impl FlowSample {
    pub fn key(&self) -> FlowKey {
        FlowKey {
            pid: self.process.pid,
            protocol: self.protocol,
            direction: self.direction,
            local: self.local,
            remote: self.remote,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LiveConnection {
    pub key: FlowKey,
    pub process: ProcessRef,
    pub target: ResolvedTarget,
    pub connection_state: ConnectionState,
    pub first_seen_at: UnixMillis,
    pub last_seen_at: UnixMillis,
    pub cumulative_counters: TrafficCounters,
    pub current_rate: TrafficRate,
    pub capture_mode: CaptureMode,
    pub is_lan_traffic: bool,
}

impl LiveConnection {
    pub fn summary_line(&self) -> String {
        format!("{} -> {}", self.process.display_name(), self.target.label())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct FlowSession {
    pub session_id: String,
    pub key: Option<FlowKey>,
    pub process: ProcessRef,
    pub target: Option<ResolvedTarget>,
    pub started_at: UnixMillis,
    pub ended_at: Option<UnixMillis>,
    pub cumulative_counters: TrafficCounters,
    pub final_state: ConnectionState,
    pub capture_mode: CaptureMode,
    pub is_lan_traffic: bool,
}

#[cfg(test)]
mod tests {
    use std::net::{IpAddr, Ipv4Addr};

    use super::*;

    #[test]
    fn traffic_counters_accumulate_with_saturation() {
        let mut counters = TrafficCounters {
            tx_bytes: u64::MAX - 1,
            rx_bytes: 10,
        };

        counters.accumulate(TrafficCounters {
            tx_bytes: 20,
            rx_bytes: 5,
        });

        assert_eq!(counters.tx_bytes, u64::MAX);
        assert_eq!(counters.rx_bytes, 15);
    }

    #[test]
    fn flow_sample_generates_key_from_endpoints_and_process() {
        let sample = FlowSample {
            process: ProcessRef {
                pid: 42,
                name: "curl".to_string(),
                ..ProcessRef::default()
            },
            protocol: TransportProtocol::Tcp,
            direction: TrafficDirection::Outbound,
            local: SocketEndpoint {
                ip: IpAddr::V4(Ipv4Addr::LOCALHOST),
                port: 12345,
            },
            remote: SocketEndpoint {
                ip: IpAddr::V4(Ipv4Addr::new(1, 1, 1, 1)),
                port: 443,
            },
            bytes_delta: TrafficCounters::default(),
            observed_at: 100,
            capture_mode: CaptureMode::ProcFallback,
        };

        let key = sample.key();
        assert_eq!(key.pid, 42);
        assert_eq!(key.remote.port, 443);
        assert_eq!(key.local.port, 12345);
    }
}
