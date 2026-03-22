use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

use traffic_cat_domain::{ConnectionState, SocketEndpoint, TransportProtocol};

use crate::CaptureError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProcSocketEntry {
    pub protocol: TransportProtocol,
    pub local: SocketEndpoint,
    pub remote: SocketEndpoint,
    pub state: ConnectionState,
    pub tx_queue_bytes: u64,
    pub rx_queue_bytes: u64,
    pub inode: u64,
}

pub fn parse_proc_net_table(
    protocol: TransportProtocol,
    contents: &str,
) -> Result<Vec<ProcSocketEntry>, CaptureError> {
    let mut entries = Vec::new();

    for (index, line) in contents.lines().enumerate() {
        if index == 0 || line.trim().is_empty() {
            continue;
        }

        entries.push(parse_proc_net_line(protocol, line)?);
    }

    Ok(entries)
}

pub fn parse_proc_net_line(
    protocol: TransportProtocol,
    line: &str,
) -> Result<ProcSocketEntry, CaptureError> {
    let columns: Vec<&str> = line.split_whitespace().collect();
    if columns.len() < 10 {
        return Err(CaptureError::Parse(format!("proc net 行字段不足: {line}")));
    }

    let local = parse_socket_endpoint(columns[1])?;
    let remote = parse_socket_endpoint(columns[2])?;
    let state = parse_connection_state(columns[3]);
    let (tx_queue_bytes, rx_queue_bytes) = parse_queue_pair(columns[4])?;
    let inode = columns[9]
        .parse::<u64>()
        .map_err(|_| CaptureError::Parse(format!("inode 无法解析: {}", columns[9])))?;

    Ok(ProcSocketEntry {
        protocol,
        local,
        remote,
        state,
        tx_queue_bytes,
        rx_queue_bytes,
        inode,
    })
}

fn parse_queue_pair(raw: &str) -> Result<(u64, u64), CaptureError> {
    let (tx_hex, rx_hex) = raw
        .split_once(':')
        .ok_or_else(|| CaptureError::Parse(format!("队列格式非法: {raw}")))?;
    let tx_queue_bytes = u64::from_str_radix(tx_hex, 16)
        .map_err(|_| CaptureError::Parse(format!("发送队列无法解析: {raw}")))?;
    let rx_queue_bytes = u64::from_str_radix(rx_hex, 16)
        .map_err(|_| CaptureError::Parse(format!("接收队列无法解析: {raw}")))?;
    Ok((tx_queue_bytes, rx_queue_bytes))
}

fn parse_socket_endpoint(raw: &str) -> Result<SocketEndpoint, CaptureError> {
    let (ip_hex, port_hex) = raw
        .split_once(':')
        .ok_or_else(|| CaptureError::Parse(format!("地址端口格式非法: {raw}")))?;
    let port = u16::from_str_radix(port_hex, 16)
        .map_err(|_| CaptureError::Parse(format!("端口无法解析: {raw}")))?;

    Ok(SocketEndpoint {
        ip: parse_ip(ip_hex)?,
        port,
    })
}

fn parse_ip(raw: &str) -> Result<IpAddr, CaptureError> {
    match raw.len() {
        8 => {
            let bytes = hex_to_bytes(raw)?;
            Ok(IpAddr::V4(Ipv4Addr::new(
                bytes[3], bytes[2], bytes[1], bytes[0],
            )))
        }
        32 => {
            let raw_bytes = hex_to_bytes(raw)?;
            let mut bytes = [0u8; 16];
            for (index, chunk) in raw_bytes.chunks_exact(4).enumerate() {
                let base = index * 4;
                bytes[base] = chunk[3];
                bytes[base + 1] = chunk[2];
                bytes[base + 2] = chunk[1];
                bytes[base + 3] = chunk[0];
            }
            Ok(IpAddr::V6(Ipv6Addr::from(bytes)))
        }
        _ => Err(CaptureError::Parse(format!("IP 长度非法: {raw}"))),
    }
}

fn hex_to_bytes(raw: &str) -> Result<Vec<u8>, CaptureError> {
    let mut bytes = Vec::with_capacity(raw.len() / 2);
    let mut index = 0;

    while index < raw.len() {
        let value = u8::from_str_radix(&raw[index..index + 2], 16)
            .map_err(|_| CaptureError::Parse(format!("十六进制无法解析: {raw}")))?;
        bytes.push(value);
        index += 2;
    }

    Ok(bytes)
}

fn parse_connection_state(raw: &str) -> ConnectionState {
    match raw {
        "01" => ConnectionState::Established,
        "06" | "08" | "09" => ConnectionState::Closing,
        "07" => ConnectionState::Closed,
        _ => ConnectionState::Observed,
    }
}

#[cfg(test)]
mod tests {
    use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

    use super::*;

    #[test]
    fn parses_ipv4_proc_net_line() {
        let line = "  46: 0100007F:1F90 08080808:01BB 01 00000000:00000000 00:00000000 00000000 1000 0 34567 1 0000000000000000 20 4 28 10 -1";
        let entry = parse_proc_net_line(TransportProtocol::Tcp, line).unwrap();

        assert_eq!(entry.local.ip, IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)));
        assert_eq!(entry.remote.ip, IpAddr::V4(Ipv4Addr::new(8, 8, 8, 8)));
        assert_eq!(entry.remote.port, 443);
        assert_eq!(entry.state, ConnectionState::Established);
        assert_eq!(entry.tx_queue_bytes, 0);
        assert_eq!(entry.rx_queue_bytes, 0);
        assert_eq!(entry.inode, 34_567);
    }

    #[test]
    fn parses_ipv6_proc_net_line() {
        let line = "   0: 00000000000000000000000001000000:1770 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000 1000 0 42 1 0000000000000000 100 0 0 10 0";
        let entry = parse_proc_net_line(TransportProtocol::Tcp, line).unwrap();

        assert_eq!(entry.local.ip, IpAddr::V6(Ipv6Addr::LOCALHOST));
        assert_eq!(entry.local.port, 6000);
        assert_eq!(entry.tx_queue_bytes, 0);
        assert_eq!(entry.rx_queue_bytes, 0);
        assert_eq!(entry.inode, 42);
    }
}
