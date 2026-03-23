import type {
  DesktopAppBridge,
  AgentHistoryPayload,
  AgentHistoryQuery,
  AgentProcessDetailPayload,
  AgentProcessesPayload,
} from "./desktopBridge";
import { GAL_MOCK_COPY } from "../copy/galAbstract";
import type { AgentDashboardPayload } from "../types/appData";

const MOCK_DELAY_MILLIS = 140;

interface MockProcessRecord {
  pid: number;
  processName: string;
  parentProcessName: string;
  txBytes: number;
  rxBytes: number;
  destinationCount: number;
  lastActiveDeltaSeconds: number;
  hasActiveAlert: boolean;
  activeConnections: Array<{
    sessionId: string;
    remoteHost: string;
    remotePort: number;
    direction: "Outbound" | "Inbound";
    protocol: "Tcp" | "Udp";
    currentTxRate: number;
    currentRxRate: number;
    lastSeenDeltaSeconds: number;
    state: "Established" | "Observed";
  }>;
  recentAlerts: string[];
}

const MOCK_PROCESSES: MockProcessRecord[] = [
  {
    pid: 1212,
    processName: "firefox",
    parentProcessName: "systemd",
    txBytes: 260 * 1024 * 1024,
    rxBytes: 1080 * 1024 * 1024,
    destinationCount: 6,
    lastActiveDeltaSeconds: 40,
    hasActiveAlert: false,
    activeConnections: [
      {
        sessionId: "1212-github-443",
        remoteHost: "github.com",
        remotePort: 443,
        direction: "Outbound",
        protocol: "Tcp",
        currentTxRate: 140 * 1024,
        currentRxRate: 320 * 1024,
        lastSeenDeltaSeconds: 3,
        state: "Established",
      },
      {
        sessionId: "1212-cdn-443",
        remoteHost: "cdn.example.net",
        remotePort: 443,
        direction: "Inbound",
        protocol: "Tcp",
        currentTxRate: 36 * 1024,
        currentRxRate: 4.8 * 1024 * 1024,
        lastSeenDeltaSeconds: 1,
        state: "Established",
      },
    ],
    recentAlerts: [],
  },
  {
    pid: 2199,
    processName: "syncthing",
    parentProcessName: "systemd",
    txBytes: 180 * 1024 * 1024,
    rxBytes: 232 * 1024 * 1024,
    destinationCount: 2,
    lastActiveDeltaSeconds: 2,
    hasActiveAlert: true,
    activeConnections: [
      {
        sessionId: "2199-lan-22000",
        remoteHost: "10.0.0.25",
        remotePort: 22000,
        direction: "Outbound",
        protocol: "Tcp",
        currentTxRate: 430 * 1024,
        currentRxRate: 430 * 1024,
        lastSeenDeltaSeconds: 1,
        state: "Established",
      },
    ],
    recentAlerts: [GAL_MOCK_COPY.bridge.recentAlertSyncthing],
  },
  {
    pid: 3377,
    processName: "code",
    parentProcessName: "systemd",
    txBytes: 24 * 1024 * 1024,
    rxBytes: 104 * 1024 * 1024,
    destinationCount: 4,
    lastActiveDeltaSeconds: 10,
    hasActiveAlert: false,
    activeConnections: [
      {
        sessionId: "3377-api-443",
        remoteHost: "api.github.com",
        remotePort: 443,
        direction: "Outbound",
        protocol: "Tcp",
        currentTxRate: 70 * 1024,
        currentRxRate: 120 * 1024,
        lastSeenDeltaSeconds: 10,
        state: "Observed",
      },
    ],
    recentAlerts: [GAL_MOCK_COPY.bridge.recentAlertCode],
  },
];

export function createMockDesktopBridge(): DesktopAppBridge {
  return {
    sourceLabel: GAL_MOCK_COPY.bridge.sourceLabel,
    bridgeKind: "mock",
    loadDashboardPayload: async () => {
      await wait();
      return buildDashboardPayload();
    },
    loadProcessesPayload: async () => {
      await wait();
      return buildProcessesPayload();
    },
    loadHistoryPayload: async (query?: AgentHistoryQuery) => {
      await wait();
      return buildHistoryPayload(query);
    },
    loadProcessDetailPayload: async (pid: number) => {
      await wait();
      return buildProcessDetailPayload(pid);
    },
  };
}

function buildDashboardPayload(): AgentDashboardPayload {
  const now = Date.now();
  const liveItems = MOCK_PROCESSES.flatMap((process) =>
    process.activeConnections.map((connection) => ({
      session_id: connection.sessionId,
      process_name: process.processName,
      remote_host: connection.remoteHost,
      direction: connection.direction,
      protocol: connection.protocol,
      current_tx_rate: connection.currentTxRate,
      current_rx_rate: connection.currentRxRate,
      last_seen_at: now - connection.lastSeenDeltaSeconds * 1000,
    })),
  );

  return {
    healthJson: JSON.stringify({
      generated_at: now,
      uds_path: "/run/traffic-cat/agentd.sock",
      permissions: {
        ready: true,
        details: GAL_MOCK_COPY.bridge.permissionDetails,
      },
      capture: {
        mode: "proc_fallback",
        state: "degraded",
        last_sample_at: now - 1500,
        details: GAL_MOCK_COPY.bridge.captureDetails,
      },
      store: {
        state: "healthy",
        database_path: "/var/lib/traffic-cat/traffic.db.snapshot",
      },
    }),
    statusJson: JSON.stringify({
      service_status: "degraded",
      capture_mode: "proc_fallback",
      permission_status: "healthy",
      db_status: "healthy",
      degraded_reason: GAL_MOCK_COPY.bridge.degradedReason,
    }),
    liveJson: JSON.stringify({
      generated_at: now,
      widget_state: "Alerting",
      capture_mode: "proc_fallback",
      upload_rate_bytes_per_sec: 640 * 1024,
      download_rate_bytes_per_sec: 5.2 * 1024 * 1024,
      headline: GAL_MOCK_COPY.bridge.liveHeadline,
      items: liveItems,
    }),
    alertsJson: JSON.stringify({
      items: [
        {
          id: "mock-alert-syncthing",
          alert_type: "PersistentBackgroundTraffic",
          process_name: "syncthing",
          pid: 2199,
          remote_host: "10.0.0.25",
          created_at: now - 30_000,
          title: GAL_MOCK_COPY.bridge.alertBannerTitle,
          body: GAL_MOCK_COPY.bridge.recentAlertSyncthing,
        },
      ],
    }),
  };
}

function buildProcessesPayload(): AgentProcessesPayload {
  const now = Date.now();

  return {
    summariesJson: JSON.stringify({
      items: MOCK_PROCESSES.map((process) => ({
        pid: process.pid,
        process_name: process.processName,
        parent_process_name: process.parentProcessName,
        tx_bytes: process.txBytes,
        rx_bytes: process.rxBytes,
        destination_count: process.destinationCount,
        last_active_at: now - process.lastActiveDeltaSeconds * 1000,
        has_active_alert: process.hasActiveAlert,
      })),
    }),
    alertsJson: JSON.stringify({
      items: MOCK_PROCESSES.filter((process) => process.hasActiveAlert).map(
        (process) => ({
          pid: process.pid,
          process_name: process.processName,
          title: process.recentAlerts[0] ?? GAL_MOCK_COPY.bridge.recentAlertTitle,
        }),
      ),
    }),
  };
}

function buildHistoryPayload(query?: AgentHistoryQuery): AgentHistoryPayload {
  const now = Date.now();
  const items = MOCK_PROCESSES.flatMap((process) =>
    process.activeConnections.map((connection, index) => ({
      session_id: `${connection.sessionId}-history`,
      process_name: process.processName,
      pid: process.pid,
      remote_host: connection.remoteHost,
      remote_port: connection.remotePort,
      direction: connection.direction,
      protocol: connection.protocol,
      started_at: now - (process.lastActiveDeltaSeconds + 180 + index * 60) * 1000,
      ended_at:
        process.pid === 2199
          ? null
          : now - (process.lastActiveDeltaSeconds + 15 + index * 10) * 1000,
      tx_bytes: Math.round(process.txBytes / Math.max(1, process.activeConnections.length)),
      rx_bytes: Math.round(process.rxBytes / Math.max(1, process.activeConnections.length)),
    })),
  );

  const filtered = items.filter((item) => {
    if (query?.processName && !item.process_name?.includes(query.processName)) {
      return false;
    }
    if (query?.target && !item.remote_host?.includes(query.target)) {
      return false;
    }
    if (query?.port && item.remote_port !== query.port) {
      return false;
    }
    if (query?.direction && item.direction.toLowerCase() !== query.direction) {
      return false;
    }
    if (query?.startedAfter && (item.started_at ?? 0) < query.startedAfter) {
      return false;
    }
    if (query?.endedBefore) {
      const endedAt = item.ended_at ?? Number.MAX_SAFE_INTEGER;
      if (endedAt > query.endedBefore) {
        return false;
      }
    }
    if (!query?.includeLanTraffic && isLanTarget(item.remote_host)) {
      return false;
    }
    return true;
  });

  const offset = query?.offset ?? 0;
  const limit = query?.limit ?? 20;

  return {
    historyJson: JSON.stringify({
      items: filtered.slice(offset, offset + limit),
      total: filtered.length,
      limit,
      offset,
    }),
  };
}

function isLanTarget(target?: string): boolean {
  if (!target) {
    return false;
  }

  return (
    target.startsWith("10.") ||
    target.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(target)
  );
}

function buildProcessDetailPayload(pid: number): AgentProcessDetailPayload {
  const process = MOCK_PROCESSES.find((item) => item.pid === pid) ?? MOCK_PROCESSES[0];
  const now = Date.now();

  return {
    detailJson: JSON.stringify({
      pid: process.pid,
      process_name: process.processName,
      last_active_at: now - process.lastActiveDeltaSeconds * 1000,
      tx_bytes: process.txBytes,
      rx_bytes: process.rxBytes,
      active_connections: process.activeConnections.map((connection) => ({
        session_id: connection.sessionId,
        remote_host: connection.remoteHost,
        remote_port: connection.remotePort,
        direction: connection.direction,
        protocol: connection.protocol,
        current_tx_rate: connection.currentTxRate,
        current_rx_rate: connection.currentRxRate,
        last_seen_at: now - connection.lastSeenDeltaSeconds * 1000,
        state: connection.state,
      })),
      recent_alerts: process.recentAlerts,
    }),
  };
}

function wait() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, MOCK_DELAY_MILLIS);
  });
}
