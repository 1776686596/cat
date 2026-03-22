import type { AgentHistoryPayload } from "../bridge/desktopBridge";
import type { HistoryPageView } from "../types/appData";
import {
  formatBytes,
  formatRelativeTime,
  humanizeDirection,
  humanizeProtocol,
} from "./formatters";

interface AgentHistoryItemPayload {
  session_id?: string;
  process_name?: string;
  pid?: number;
  remote_host?: string;
  remote_port?: number;
  direction?: string;
  protocol?: string;
  started_at?: number;
  ended_at?: number | null;
  tx_bytes?: number;
  rx_bytes?: number;
}

interface AgentHistoryApiPayload {
  items?: AgentHistoryItemPayload[];
  total?: number;
  limit?: number;
  offset?: number;
}

export interface HistoryPayloadResolution {
  data: HistoryPageView;
  generatedAt: number | null;
}

export function resolveHistoryPayload(
  payload?: AgentHistoryPayload,
): HistoryPayloadResolution {
  if (!payload) {
    return {
      data: getFallbackHistoryPage(),
      generatedAt: null,
    };
  }

  const history = parseJson<AgentHistoryApiPayload>(payload.historyJson);
  return {
    generatedAt: Date.now(),
    data: {
      cycleLabel: "周期六 / 历史桥接承接",
      total: history.total ?? 0,
      limit: history.limit ?? 0,
      offset: history.offset ?? 0,
      items: (history.items ?? []).map((item) => ({
        sessionId: item.session_id ?? buildFallbackSessionId(item),
        processName: item.process_name ?? "unknown",
        pid: item.pid ?? null,
        target: formatTarget(item.remote_host, item.remote_port),
        direction: humanizeDirection(item.direction),
        protocol: humanizeProtocol(item.protocol),
        timeLabel: formatHistoryTime(item.started_at, item.ended_at),
        traffic: formatBytes((item.tx_bytes ?? 0) + (item.rx_bytes ?? 0)),
      })),
    },
  };
}

export function getFallbackHistoryPage(): HistoryPageView {
  return {
    cycleLabel: "周期六 / 历史回退快照",
    total: 3,
    limit: 20,
    offset: 0,
    items: [
      {
        sessionId: "history-firefox-443",
        processName: "firefox",
        pid: 1212,
        target: "github.com:443",
        direction: "上行",
        protocol: "TCP",
        timeLabel: "2 分钟前结束",
        traffic: "184 MB",
      },
      {
        sessionId: "history-syncthing-22000",
        processName: "syncthing",
        pid: 2199,
        target: "10.0.0.25:22000",
        direction: "双向",
        protocol: "TCP",
        timeLabel: "刚刚活跃",
        traffic: "68 MB",
      },
      {
        sessionId: "history-code-443",
        processName: "code",
        pid: 3377,
        target: "api.github.com:443",
        direction: "上行",
        protocol: "TCP",
        timeLabel: "10 分钟前结束",
        traffic: "12 MB",
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

function formatHistoryTime(
  startedAt?: number,
  endedAt?: number | null,
): string {
  if (endedAt) {
    return `${formatRelativeTime(endedAt)}结束`;
  }
  return `${formatRelativeTime(startedAt)}活跃`;
}

function buildFallbackSessionId(item: AgentHistoryItemPayload): string {
  return [item.process_name, item.remote_host, item.remote_port]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .join("-") || "history-session";
}

function parseJson<T>(raw: string): T {
  return JSON.parse(raw) as T;
}
