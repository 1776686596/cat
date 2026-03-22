use std::collections::HashMap;
use std::ffi::{c_int, c_long, c_void};
use std::fs;
use std::io;
use std::os::fd::{AsRawFd, FromRawFd, OwnedFd};
use std::path::PathBuf;
use std::sync::Arc;

use traffic_cat_domain::{
    CaptureMode, FlowKey, FlowSample, ProcessRef, SocketEndpoint, TrafficCounters,
    TrafficDirection, TrafficRate, TransportProtocol, UnixMillis,
};

use crate::parser::fd_link::parse_socket_inode;
use crate::parser::proc_net::{parse_proc_net_table, ProcSocketEntry};
use crate::{CaptureCollector, CaptureError, ObservedFlow};

const SOL_TCP: c_int = 6;
const TCP_INFO: c_int = 11;
const TCP_INFO_BUFFER_LEN: usize = 256;
const TCP_INFO_BYTES_ACKED_OFFSET: usize = 120;
const TCP_INFO_BYTES_RECEIVED_OFFSET: usize = 128;

#[cfg(any(target_arch = "x86_64", target_arch = "aarch64"))]
const SYS_PIDFD_OPEN: c_long = 434;
#[cfg(any(target_arch = "x86_64", target_arch = "aarch64"))]
const SYS_PIDFD_GETFD: c_long = 438;

#[cfg(not(any(target_arch = "x86_64", target_arch = "aarch64")))]
compile_error!("ProcfsCollector 当前仅为 x86_64/aarch64 Linux 定义了 pidfd syscall 编号");

unsafe extern "C" {
    fn syscall(number: c_long, ...) -> c_long;
    fn getsockopt(
        socket: c_int,
        level: c_int,
        optname: c_int,
        optval: *mut c_void,
        optlen: *mut u32,
    ) -> c_int;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProcfsPaths {
    pub proc_root: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct CounterSnapshot {
    counters: TrafficCounters,
    observed_at: UnixMillis,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct SocketOwner {
    process: ProcessRef,
    fd: i32,
}

trait SocketCounterProbe: std::fmt::Debug + Send + Sync {
    fn read_socket_counters(
        &self,
        pid: u32,
        fd: i32,
        protocol: TransportProtocol,
    ) -> Option<TrafficCounters>;
}

#[derive(Debug, Clone, Default)]
struct TcpInfoCounterProbe;

impl SocketCounterProbe for TcpInfoCounterProbe {
    fn read_socket_counters(
        &self,
        pid: u32,
        fd: i32,
        protocol: TransportProtocol,
    ) -> Option<TrafficCounters> {
        if protocol != TransportProtocol::Tcp {
            return None;
        }

        let pidfd = pidfd_open(pid).ok()?;
        let duplicated_fd = pidfd_getfd(&pidfd, fd).ok()?;
        read_tcp_socket_counters(&duplicated_fd).ok()
    }
}

impl Default for ProcfsPaths {
    fn default() -> Self {
        Self {
            proc_root: PathBuf::from("/proc"),
        }
    }
}

#[derive(Debug, Clone)]
pub struct ProcfsCollector {
    pub paths: ProcfsPaths,
    previous_counters: HashMap<FlowKey, CounterSnapshot>,
    counter_probe: Arc<dyn SocketCounterProbe>,
}

impl ProcfsCollector {
    pub fn new(paths: ProcfsPaths) -> Self {
        Self::with_probe(paths, Arc::new(TcpInfoCounterProbe))
    }

    fn with_probe(paths: ProcfsPaths, counter_probe: Arc<dyn SocketCounterProbe>) -> Self {
        Self {
            paths,
            previous_counters: HashMap::new(),
            counter_probe,
        }
    }

    fn read_table(
        &self,
        relative_path: &str,
        protocol: TransportProtocol,
    ) -> Result<Vec<ProcSocketEntry>, CaptureError> {
        let path = self.paths.proc_root.join(relative_path);
        if !path.exists() {
            return Ok(Vec::new());
        }

        let contents = fs::read_to_string(path)?;
        parse_proc_net_table(protocol, &contents)
    }

    fn build_inode_process_map(&self) -> HashMap<u64, SocketOwner> {
        let mut map = HashMap::new();

        let Ok(entries) = fs::read_dir(&self.paths.proc_root) else {
            return map;
        };

        for entry in entries.flatten() {
            let file_name = entry.file_name();
            let file_name = file_name.to_string_lossy();
            let Ok(pid) = file_name.parse::<u32>() else {
                continue;
            };

            if let Some(process) = self.read_process_ref(pid) {
                for (inode, fd) in self.read_socket_owners(pid) {
                    map.entry(inode).or_insert_with(|| SocketOwner {
                        process: process.clone(),
                        fd,
                    });
                }
            }
        }

        map
    }

    fn read_socket_owners(&self, pid: u32) -> Vec<(u64, i32)> {
        let fd_dir = self.paths.proc_root.join(pid.to_string()).join("fd");
        let Ok(entries) = fs::read_dir(fd_dir) else {
            return Vec::new();
        };

        entries
            .flatten()
            .filter_map(|entry| {
                let fd = entry.file_name().to_string_lossy().parse::<i32>().ok()?;
                let link_target = fs::read_link(entry.path()).ok()?;
                let inode = parse_socket_inode(&link_target.to_string_lossy())?;
                Some((inode, fd))
            })
            .collect()
    }

    fn read_process_ref(&self, pid: u32) -> Option<ProcessRef> {
        let process_dir = self.paths.proc_root.join(pid.to_string());
        let name = fs::read_to_string(process_dir.join("comm")).ok()?;
        let stat = fs::read_to_string(process_dir.join("stat")).ok()?;
        let parent_pid = parse_parent_pid(&stat);
        let parent_name = parent_pid.and_then(|ppid| self.read_process_name(ppid));
        let executable_path = fs::read_link(process_dir.join("exe"))
            .ok()
            .map(|path| path.to_string_lossy().to_string());

        Some(ProcessRef {
            pid,
            parent_pid,
            name: name.trim().to_string(),
            parent_name,
            executable_path,
        })
    }

    fn read_process_name(&self, pid: u32) -> Option<String> {
        fs::read_to_string(self.paths.proc_root.join(pid.to_string()).join("comm"))
            .ok()
            .map(|value| value.trim().to_string())
    }

    fn should_emit(entry: &ProcSocketEntry) -> bool {
        !is_unspecified_endpoint(&entry.remote) && entry.remote.port != 0
    }

    fn make_observed_flow(
        process: ProcessRef,
        entry: ProcSocketEntry,
        observed_at: UnixMillis,
        bytes_delta: TrafficCounters,
        current_rate_estimate: Option<TrafficRate>,
    ) -> ObservedFlow {
        ObservedFlow {
            sample: FlowSample {
                process,
                protocol: entry.protocol,
                direction: TrafficDirection::Outbound,
                local: entry.local,
                remote: entry.remote,
                bytes_delta,
                observed_at,
                capture_mode: CaptureMode::ProcFallback,
            },
            connection_state: entry.state,
            source_inode: entry.inode,
            current_rate_estimate,
        }
    }

    fn build_flow_key(process: &ProcessRef, entry: &ProcSocketEntry) -> FlowKey {
        FlowKey {
            pid: process.pid,
            protocol: entry.protocol,
            direction: TrafficDirection::Outbound,
            local: entry.local,
            remote: entry.remote,
        }
    }

    fn build_observed_metrics(
        previous: Option<&CounterSnapshot>,
        current_counters: TrafficCounters,
        observed_at: UnixMillis,
    ) -> (TrafficCounters, Option<TrafficRate>) {
        let Some(previous) = previous else {
            return (TrafficCounters::default(), None);
        };

        let elapsed_millis = observed_at.saturating_sub(previous.observed_at);
        let elapsed_millis = u64::try_from(elapsed_millis)
            .ok()
            .filter(|value| *value > 0);
        let bytes_delta = TrafficCounters {
            tx_bytes: current_counters
                .tx_bytes
                .saturating_sub(previous.counters.tx_bytes),
            rx_bytes: current_counters
                .rx_bytes
                .saturating_sub(previous.counters.rx_bytes),
        };

        let current_rate_estimate = elapsed_millis.map(|elapsed| TrafficRate {
            tx_bytes_per_sec: bytes_delta.tx_bytes.saturating_mul(1_000) / elapsed,
            rx_bytes_per_sec: bytes_delta.rx_bytes.saturating_mul(1_000) / elapsed,
        });

        (bytes_delta, current_rate_estimate)
    }
}

impl Default for ProcfsCollector {
    fn default() -> Self {
        Self::new(ProcfsPaths::default())
    }
}

impl CaptureCollector for ProcfsCollector {
    fn mode(&self) -> CaptureMode {
        CaptureMode::ProcFallback
    }

    fn collect(&mut self, observed_at: UnixMillis) -> Result<Vec<ObservedFlow>, CaptureError> {
        let mut entries = Vec::new();
        entries.extend(self.read_table("net/tcp", TransportProtocol::Tcp)?);
        entries.extend(self.read_table("net/tcp6", TransportProtocol::Tcp)?);
        entries.extend(self.read_table("net/udp", TransportProtocol::Udp)?);
        entries.extend(self.read_table("net/udp6", TransportProtocol::Udp)?);

        let inode_process_map = self.build_inode_process_map();
        let mut observed = Vec::new();
        let mut next_counters = HashMap::new();

        for entry in entries {
            if !Self::should_emit(&entry) {
                continue;
            }

            let Some(owner) = inode_process_map.get(&entry.inode).cloned() else {
                continue;
            };
            let key = Self::build_flow_key(&owner.process, &entry);
            let current_counters = self
                .counter_probe
                .read_socket_counters(owner.process.pid, owner.fd, entry.protocol)
                .unwrap_or_default();
            let (bytes_delta, current_rate_estimate) = Self::build_observed_metrics(
                self.previous_counters.get(&key),
                current_counters,
                observed_at,
            );
            next_counters.insert(
                key,
                CounterSnapshot {
                    counters: current_counters,
                    observed_at,
                },
            );
            observed.push(Self::make_observed_flow(
                owner.process,
                entry,
                observed_at,
                bytes_delta,
                current_rate_estimate,
            ));
        }

        self.previous_counters = next_counters;
        Ok(observed)
    }
}

fn pidfd_open(pid: u32) -> io::Result<OwnedFd> {
    let raw_fd = unsafe { syscall(SYS_PIDFD_OPEN, pid as c_int, 0) as c_int };
    if raw_fd < 0 {
        return Err(io::Error::last_os_error());
    }

    Ok(unsafe { OwnedFd::from_raw_fd(raw_fd) })
}

fn pidfd_getfd(pidfd: &OwnedFd, target_fd: i32) -> io::Result<OwnedFd> {
    let duplicated_fd =
        unsafe { syscall(SYS_PIDFD_GETFD, pidfd.as_raw_fd(), target_fd as c_int, 0) as c_int };
    if duplicated_fd < 0 {
        return Err(io::Error::last_os_error());
    }

    Ok(unsafe { OwnedFd::from_raw_fd(duplicated_fd) })
}

fn read_tcp_socket_counters(socket_fd: &OwnedFd) -> io::Result<TrafficCounters> {
    let mut buffer = [0u8; TCP_INFO_BUFFER_LEN];
    let mut buffer_len = buffer.len() as u32;
    let result = unsafe {
        getsockopt(
            socket_fd.as_raw_fd(),
            SOL_TCP,
            TCP_INFO,
            buffer.as_mut_ptr().cast::<c_void>(),
            &mut buffer_len,
        )
    };
    if result != 0 {
        return Err(io::Error::last_os_error());
    }

    let tx_bytes = read_u64_ne(&buffer, buffer_len as usize, TCP_INFO_BYTES_ACKED_OFFSET)
        .ok_or_else(|| io::Error::new(io::ErrorKind::UnexpectedEof, "tcp_info 缺少 bytes_acked"))?;
    let rx_bytes = read_u64_ne(&buffer, buffer_len as usize, TCP_INFO_BYTES_RECEIVED_OFFSET)
        .ok_or_else(|| {
            io::Error::new(io::ErrorKind::UnexpectedEof, "tcp_info 缺少 bytes_received")
        })?;

    Ok(TrafficCounters { tx_bytes, rx_bytes })
}

fn read_u64_ne(buffer: &[u8], available_len: usize, offset: usize) -> Option<u64> {
    let end = offset.checked_add(std::mem::size_of::<u64>())?;
    if available_len < end || buffer.len() < end {
        return None;
    }

    let mut raw = [0u8; 8];
    raw.copy_from_slice(&buffer[offset..end]);
    Some(u64::from_ne_bytes(raw))
}

fn is_unspecified_endpoint(endpoint: &SocketEndpoint) -> bool {
    endpoint.ip.is_unspecified()
}

fn parse_parent_pid(stat_contents: &str) -> Option<u32> {
    let end = stat_contents.rfind(')')?;
    let tail = stat_contents.get(end + 1..)?.trim();
    let mut parts = tail.split_whitespace();
    let _state = parts.next()?;
    let ppid = parts.next()?;
    ppid.parse::<u32>().ok()
}

#[cfg(test)]
mod tests {
    use std::fs::{self, File};
    use std::io::Write;
    use std::net::{Ipv4Addr, TcpListener, TcpStream};
    use std::os::fd::AsRawFd;
    use std::os::unix::fs::symlink;
    use std::path::{Path, PathBuf};
    use std::sync::Mutex;
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::*;

    #[derive(Debug, Default)]
    struct FakeCounterProbe {
        values: Mutex<HashMap<(u32, i32, TransportProtocol), TrafficCounters>>,
    }

    impl FakeCounterProbe {
        fn set(&self, pid: u32, fd: i32, protocol: TransportProtocol, counters: TrafficCounters) {
            self.values
                .lock()
                .unwrap()
                .insert((pid, fd, protocol), counters);
        }
    }

    impl SocketCounterProbe for FakeCounterProbe {
        fn read_socket_counters(
            &self,
            pid: u32,
            fd: i32,
            protocol: TransportProtocol,
        ) -> Option<TrafficCounters> {
            self.values
                .lock()
                .unwrap()
                .get(&(pid, fd, protocol))
                .copied()
        }
    }

    fn temp_proc_root() -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("traffic-cat-procfs-{suffix}"));
        fs::create_dir_all(&path).unwrap();
        path
    }

    fn write_tcp_table(root: &Path) {
        let mut tcp = File::create(root.join("net/tcp")).unwrap();
        writeln!(
            tcp,
            "  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode"
        )
        .unwrap();
        writeln!(
            tcp,
            "  46: 0100007F:1F90 08080808:01BB 01 00000000:00000000 00:00000000 00000000 1000 0 34567 1 0000000000000000 20 4 28 10 -1"
        )
        .unwrap();
    }

    #[test]
    fn procfs_collector_maps_socket_inode_to_process() {
        let root = temp_proc_root();
        fs::create_dir_all(root.join("net")).unwrap();
        fs::create_dir_all(root.join("1234/fd")).unwrap();
        fs::create_dir_all(root.join("4321")).unwrap();

        write_tcp_table(&root);

        fs::write(root.join("1234/comm"), "curl\n").unwrap();
        fs::write(root.join("1234/stat"), "1234 (curl) S 4321 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0\n").unwrap();
        fs::write(root.join("4321/comm"), "bash\n").unwrap();
        symlink("socket:[34567]", root.join("1234/fd/5")).unwrap();

        let probe = Arc::new(FakeCounterProbe::default());
        let mut collector = ProcfsCollector::with_probe(
            ProcfsPaths {
                proc_root: root.clone(),
            },
            probe,
        );
        let observed = collector.collect(10).unwrap();

        assert_eq!(observed.len(), 1);
        assert_eq!(observed[0].sample.process.name, "curl");
        assert_eq!(
            observed[0].sample.process.parent_name.as_deref(),
            Some("bash")
        );
        assert_eq!(observed[0].source_inode, 34_567);
        assert_eq!(observed[0].sample.bytes_delta, TrafficCounters::default());
        assert_eq!(observed[0].current_rate_estimate, None);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn procfs_collector_uses_cumulative_counter_delta() {
        let root = temp_proc_root();
        fs::create_dir_all(root.join("net")).unwrap();
        fs::create_dir_all(root.join("1234/fd")).unwrap();
        fs::create_dir_all(root.join("4321")).unwrap();

        write_tcp_table(&root);

        fs::write(root.join("1234/comm"), "curl\n").unwrap();
        fs::write(root.join("1234/stat"), "1234 (curl) S 4321 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0\n").unwrap();
        fs::write(root.join("4321/comm"), "bash\n").unwrap();
        symlink("socket:[34567]", root.join("1234/fd/5")).unwrap();

        let probe = Arc::new(FakeCounterProbe::default());
        probe.set(
            1234,
            5,
            TransportProtocol::Tcp,
            TrafficCounters {
                tx_bytes: 1024,
                rx_bytes: 2048,
            },
        );

        let mut collector = ProcfsCollector::with_probe(
            ProcfsPaths {
                proc_root: root.clone(),
            },
            probe.clone(),
        );

        let first = collector.collect(1_000).unwrap();
        assert_eq!(first[0].sample.bytes_delta, TrafficCounters::default());
        assert_eq!(first[0].current_rate_estimate, None);

        probe.set(
            1234,
            5,
            TransportProtocol::Tcp,
            TrafficCounters {
                tx_bytes: 4096,
                rx_bytes: 8192,
            },
        );
        let second = collector.collect(2_000).unwrap();
        assert_eq!(
            second[0].sample.bytes_delta,
            TrafficCounters {
                tx_bytes: 3072,
                rx_bytes: 6144,
            }
        );
        assert_eq!(
            second[0].current_rate_estimate,
            Some(TrafficRate {
                tx_bytes_per_sec: 3072,
                rx_bytes_per_sec: 6144,
            })
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn tcp_info_counter_probe_reads_live_socket_counters() {
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        let mut client = TcpStream::connect((Ipv4Addr::LOCALHOST, port)).unwrap();
        let (mut server, _) = listener.accept().unwrap();
        server
            .set_read_timeout(Some(std::time::Duration::from_secs(1)))
            .unwrap();

        let probe = TcpInfoCounterProbe;
        let before = probe
            .read_socket_counters(
                std::process::id(),
                client.as_raw_fd(),
                TransportProtocol::Tcp,
            )
            .unwrap();

        let payload = vec![b'x'; 64 * 1024];
        client.write_all(&payload).unwrap();
        let mut buffer = vec![0u8; payload.len()];
        let _ = std::io::Read::read(&mut server, &mut buffer).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(50));

        let after = probe
            .read_socket_counters(
                std::process::id(),
                client.as_raw_fd(),
                TransportProtocol::Tcp,
            )
            .unwrap();

        assert!(after.tx_bytes > before.tx_bytes);
        assert!(after.tx_bytes >= payload.len() as u64);
        assert_eq!(after.rx_bytes, before.rx_bytes);
    }
}
