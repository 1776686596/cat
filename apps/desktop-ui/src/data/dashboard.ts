import type { AgentDashboardPayload, DashboardData } from "../types/appData";
import {
  buildEpisodeLabel,
  GAL_EPISODE_SCENES,
  GAL_MOCK_COPY,
} from "../copy/galAbstract";
import {
  formatRate,
  formatRelativeTime,
  humanizeDirection,
  humanizeProtocol,
} from "./formatters";

interface AgentHealthApiPayload {
  generated_at?: number;
  uds_path?: string;
  permissions?: {
    ready?: boolean;
    details?: string | null;
  };
  capture?: {
    mode?: string;
    state?: string;
    last_sample_at?: number | null;
    details?: string | null;
  };
  store?: {
    state?: string;
    database_path?: string;
  };
}

interface AgentStatusApiPayload {
  service_status?: string;
  capture_mode?: string;
  permission_status?: string;
  db_status?: string;
  degraded_reason?: string | null;
}

interface AgentLiveFlowItemPayload {
  session_id?: string;
  process_name?: string;
  remote_host?: string;
  remote_port?: number;
  local_port?: number;
  direction?: string;
  protocol?: string;
  current_tx_rate?: number;
  current_rx_rate?: number;
  last_seen_at?: number;
}

interface AgentLiveFlowsApiPayload {
  generated_at?: number;
  widget_state?: string;
  capture_mode?: string;
  upload_rate_bytes_per_sec?: number;
  download_rate_bytes_per_sec?: number;
  headline?: string | null;
  items?: AgentLiveFlowItemPayload[];
}

export interface DashboardPayloadResolution {
  data: DashboardData;
  generatedAt: number | null;
}

export function getDashboardData(payload?: AgentDashboardPayload): DashboardData {
  return resolveDashboardPayload(payload).data;
}

export function resolveDashboardPayload(
  payload?: AgentDashboardPayload,
): DashboardPayloadResolution {
  if (!payload) {
    return {
      data: getFallbackDashboardData(),
      generatedAt: null,
    };
  }

  const health = parseJson<AgentHealthApiPayload>(payload.healthJson);
  const status = parseJson<AgentStatusApiPayload>(payload.statusJson);
  const live = parseJson<AgentLiveFlowsApiPayload>(payload.liveJson);

  return {
    generatedAt: live.generated_at ?? health.generated_at ?? null,
    data: {
      realtime: {
        cycleLabel: buildEpisodeLabel(5, GAL_EPISODE_SCENES.dashboardRealtimeLive),
        uploadRate: formatRate(live.upload_rate_bytes_per_sec ?? 0),
        downloadRate: formatRate(live.download_rate_bytes_per_sec ?? 0),
        widgetState: live.widget_state ?? "unknown",
        headline: live.headline ?? GAL_MOCK_COPY.dashboard.noHeadline,
        captureMode: live.capture_mode ?? health.capture?.mode ?? "unknown",
        activeConnections: (live.items ?? []).map((item) => ({
          sessionId: item.session_id ?? fallbackSessionId(item),
          processName: item.process_name ?? "unknown",
          target: formatTarget(item.remote_host, item.remote_port),
          localPortLabel: formatLocalPort(item.local_port),
          direction: humanizeDirection(item.direction),
          protocol: humanizeProtocol(item.protocol),
          uploadRate: formatRate(item.current_tx_rate ?? 0),
          uploadRateValue: item.current_tx_rate ?? 0,
          downloadRate: formatRate(item.current_rx_rate ?? 0),
          downloadRateValue: item.current_rx_rate ?? 0,
          totalRate: formatRate(
            (item.current_tx_rate ?? 0) + (item.current_rx_rate ?? 0),
          ),
          totalRateValue: (item.current_tx_rate ?? 0) + (item.current_rx_rate ?? 0),
          lastSeenLabel: formatRelativeTime(item.last_seen_at),
        })),
      },
      diagnostics: {
        cycleLabel: buildEpisodeLabel(
          5,
          GAL_EPISODE_SCENES.dashboardDiagnosticsLive,
        ),
        agentStatus: status.service_status ?? "unknown",
        captureMode: status.capture_mode ?? health.capture?.mode ?? "unknown",
        databaseStatus: status.db_status ?? health.store?.state ?? "unknown",
        degradedReason: status.degraded_reason ?? health.capture?.details ?? null,
        permissionSummary:
          health.permissions?.details ??
          GAL_MOCK_COPY.dashboard.fallbackPermissionDetail,
        socketPath: health.uds_path ?? "/run/traffic-cat/agentd.sock",
      },
    },
  };
}

export function getFallbackDashboardData(): DashboardData {
  return {
    realtime: {
      cycleLabel: buildEpisodeLabel(
        5,
        GAL_EPISODE_SCENES.dashboardRealtimeFallback,
      ),
      uploadRate: "0 KB/s",
      downloadRate: "0 KB/s",
      widgetState: "idle",
      headline: GAL_MOCK_COPY.dashboard.fallbackHeadline,
      captureMode: "proc_fallback",
      activeConnections: [
        {
          sessionId: "demo-firefox-443",
          processName: "firefox",
          target: "cdn.example.net:443",
          localPortLabel: "本地端口 53124",
          direction: "下行",
          protocol: "TCP",
          uploadRate: "120 KB/s",
          uploadRateValue: 120 * 1024,
          downloadRate: "4.7 MB/s",
          downloadRateValue: Math.round(4.7 * 1024 * 1024),
          totalRate: "4.8 MB/s",
          totalRateValue: Math.round(4.82 * 1024 * 1024),
          lastSeenLabel: "刚刚",
        },
        {
          sessionId: "demo-syncthing-22000",
          processName: "syncthing",
          target: "10.0.0.25:22000",
          localPortLabel: "本地端口 22000",
          direction: "双向",
          protocol: "TCP",
          uploadRate: "410 KB/s",
          uploadRateValue: 410 * 1024,
          downloadRate: "450 KB/s",
          downloadRateValue: 450 * 1024,
          totalRate: "860 KB/s",
          totalRateValue: 860 * 1024,
          lastSeenLabel: "3 秒前",
        },
        {
          sessionId: "demo-code-443",
          processName: "code",
          target: "github.com:443",
          localPortLabel: "本地端口 49382",
          direction: "上行",
          protocol: "TCP",
          uploadRate: "186 KB/s",
          uploadRateValue: 186 * 1024,
          downloadRate: "4 KB/s",
          downloadRateValue: 4 * 1024,
          totalRate: "190 KB/s",
          totalRateValue: 190 * 1024,
          lastSeenLabel: "10 秒前",
        },
      ],
    },
    diagnostics: {
      cycleLabel: buildEpisodeLabel(
        5,
        GAL_EPISODE_SCENES.dashboardDiagnosticsFallback,
      ),
      agentStatus: "degraded",
      captureMode: "proc_fallback",
      databaseStatus: "healthy",
      degradedReason: GAL_MOCK_COPY.dashboard.fallbackDegradedReason,
      permissionSummary: GAL_MOCK_COPY.dashboard.fallbackPermissionSummary,
      socketPath: "/run/traffic-cat/agentd.sock",
    },
  };
}

function parseJson<T>(raw: string): T {
  return JSON.parse(raw) as T;
}

function fallbackSessionId(item: AgentLiveFlowItemPayload): string {
  return [
    item.process_name,
    item.protocol,
    item.remote_host,
    item.remote_port,
    item.local_port,
  ]
    .filter(Boolean)
    .join("-") || "unknown-session";
}

function formatTarget(host?: string, port?: number): string {
  if (host && port) {
    return `${host}:${port}`;
  }
  if (host) {
    return host;
  }
  return "unknown";
}

function formatLocalPort(port?: number): string {
  return port ? `本地端口 ${port}` : "本地端口未知";
}
