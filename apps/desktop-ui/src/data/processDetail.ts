import type { AgentProcessDetailPayload } from "../bridge/desktopBridge";
import {
  buildEpisodeLabel,
  GAL_EPISODE_SCENES,
  GAL_MOCK_COPY,
  GAL_NOTICE_COPY,
  getConnectionStateLabel,
} from "../copy/galAbstract";
import type { ProcessDetailView } from "../types/appData";
import {
  formatBytes,
  formatRate,
  formatRelativeTime,
  humanizeDirection,
  humanizeProtocol,
} from "./formatters";

interface AgentProcessConnectionPayload {
  session_id?: string;
  remote_host?: string;
  remote_port?: number;
  local_port?: number;
  direction?: string;
  protocol?: string;
  current_tx_rate?: number;
  current_rx_rate?: number;
  last_seen_at?: number;
  state?: string;
}

interface AgentProcessDetailApiPayload {
  pid?: number;
  process_name?: string;
  last_active_at?: number | null;
  tx_bytes?: number;
  rx_bytes?: number;
  active_connections?: AgentProcessConnectionPayload[];
  recent_alerts?: string[];
}

export interface ProcessDetailPayloadResolution {
  data: ProcessDetailView;
  generatedAt: number | null;
}

export function resolveProcessDetailPayload(
  pid: number,
  payload?: AgentProcessDetailPayload,
): ProcessDetailPayloadResolution {
  if (!payload) {
    return {
      data: getFallbackProcessDetail(pid),
      generatedAt: null,
    };
  }

  const detail = parseJson<AgentProcessDetailApiPayload>(payload.detailJson);
  return {
    generatedAt: Date.now(),
    data: {
      cycleLabel: buildEpisodeLabel(6, GAL_EPISODE_SCENES.processDetailLive),
      pid: detail.pid ?? pid,
      processName: detail.process_name ?? `pid ${pid}`,
      lastActiveLabel: formatRelativeTime(detail.last_active_at),
      totalTraffic: formatBytes((detail.tx_bytes ?? 0) + (detail.rx_bytes ?? 0)),
      recentAlerts: detail.recent_alerts ?? [],
      activeConnections: (detail.active_connections ?? []).map((item) => ({
        sessionId: item.session_id ?? buildConnectionId(pid, item),
        target: formatTarget(item.remote_host, item.remote_port),
        localPortLabel: formatLocalPort(item.local_port),
        direction: humanizeDirection(item.direction),
        protocol: humanizeProtocol(item.protocol),
        state: getConnectionStateLabel(item.state?.toLowerCase() ?? "unknown"),
        uploadRate: formatRate(item.current_tx_rate ?? 0),
        downloadRate: formatRate(item.current_rx_rate ?? 0),
        totalRate: formatRate(
          (item.current_tx_rate ?? 0) + (item.current_rx_rate ?? 0),
        ),
        lastSeenLabel: formatRelativeTime(item.last_seen_at),
      })),
    },
  };
}

export function getEmptyProcessDetail(): ProcessDetailView {
  return {
    cycleLabel: buildEpisodeLabel(6, GAL_EPISODE_SCENES.processDetailDisabled),
    pid: null,
    processName: GAL_NOTICE_COPY.processDetail.unselectedTitle,
    lastActiveLabel: "-",
    totalTraffic: "0 B",
    recentAlerts: [],
    activeConnections: [],
  };
}

export function getFallbackProcessDetail(pid: number | null): ProcessDetailView {
  if (pid === null) {
    return getEmptyProcessDetail();
  }

  return {
    cycleLabel: buildEpisodeLabel(6, GAL_EPISODE_SCENES.processDetailFallback),
    pid,
    processName: pid === 2199 ? "syncthing" : "curl",
    lastActiveLabel: "刚刚",
    totalTraffic: pid === 2199 ? "412 MB" : "96 KB",
    recentAlerts:
      pid === 2199
        ? [GAL_MOCK_COPY.processDetail.fallbackAlertSyncthing]
        : [GAL_MOCK_COPY.processDetail.fallbackAlertCurl],
    activeConnections: [
      {
        sessionId: `${pid}-demo-primary`,
        target: pid === 2199 ? "10.0.0.25:22000" : "1.1.1.1:443",
        localPortLabel: pid === 2199 ? "本地端口 22000" : "本地端口 49152",
        direction: pid === 2199 ? "双向" : "上行",
        protocol: "TCP",
        state: getConnectionStateLabel("established"),
        uploadRate: pid === 2199 ? "410 KB/s" : "92 KB/s",
        downloadRate: pid === 2199 ? "450 KB/s" : "4 KB/s",
        totalRate: pid === 2199 ? "860 KB/s" : "96 KB/s",
        lastSeenLabel: "刚刚",
      },
    ],
  };
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

function buildConnectionId(
  pid: number,
  item: AgentProcessConnectionPayload,
): string {
  return [pid, item.remote_host, item.remote_port, item.local_port]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .join("-") || `process-${pid}-connection`;
}

function parseJson<T>(raw: string): T {
  return JSON.parse(raw) as T;
}

function formatLocalPort(port?: number): string {
  return port ? `本地端口 ${port}` : "本地端口未知";
}
