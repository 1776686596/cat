#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum CaptureMode {
    Ebpf,
    #[default]
    ProcFallback,
    Unavailable,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum HostnameSource {
    DnsCache,
    TlsSni,
    #[default]
    IpOnly,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum TransportProtocol {
    #[default]
    Tcp,
    Udp,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum TrafficDirection {
    #[default]
    Outbound,
    Inbound,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum ConnectionState {
    #[default]
    Observed,
    Established,
    Closing,
    Closed,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum AlertKind {
    #[default]
    FirstSeenConnection,
    TrafficBurst,
    PersistentBackgroundTraffic,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum AlertSeverity {
    Low,
    #[default]
    Medium,
    High,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum WidgetPetState {
    #[default]
    Idle,
    DownloadActive,
    UploadActive,
    BidirectionalActive,
    Alerting,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum ServiceHealth {
    #[default]
    Healthy,
    Degraded,
    Unavailable,
}
