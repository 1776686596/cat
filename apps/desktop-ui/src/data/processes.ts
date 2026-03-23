import type { AgentProcessesPayload } from "../bridge/desktopBridge";
import {
  buildEpisodeLabel,
  GAL_EPISODE_SCENES,
  getAlertBadgeLabel,
} from "../copy/galAbstract";
import type { ProcessSummariesView } from "../types/appData";
import { formatBytes, formatRelativeTime } from "./formatters";

interface AgentProcessSummaryItemPayload {
  pid?: number;
  process_name?: string;
  parent_process_name?: string | null;
  tx_bytes?: number;
  rx_bytes?: number;
  destination_count?: number;
  last_active_at?: number;
  has_active_alert?: boolean;
}

interface AgentProcessSummariesApiPayload {
  items?: AgentProcessSummaryItemPayload[];
}

export interface ProcessesPayloadResolution {
  data: ProcessSummariesView;
  generatedAt: number | null;
}

export function resolveProcessesPayload(
  payload?: AgentProcessesPayload,
): ProcessesPayloadResolution {
  if (!payload) {
    return {
      data: getFallbackProcessSummaries(),
      generatedAt: null,
    };
  }

  const summaries = parseJson<AgentProcessSummariesApiPayload>(payload.summariesJson);
  return {
    generatedAt: Date.now(),
    data: {
      cycleLabel: buildEpisodeLabel(6, GAL_EPISODE_SCENES.processesLive),
      items: (summaries.items ?? []).map((item) => ({
        pid: item.pid ?? 0,
        processName: item.process_name ?? "unknown",
        parentProcessName: item.parent_process_name ?? null,
        totalTraffic: formatBytes((item.tx_bytes ?? 0) + (item.rx_bytes ?? 0)),
        destinationCount: item.destination_count ?? 0,
        lastActiveLabel: formatRelativeTime(item.last_active_at),
        alertLabel: getAlertBadgeLabel(item.has_active_alert ?? false),
        hasActiveAlert: item.has_active_alert ?? false,
      })),
    },
  };
}

export function getFallbackProcessSummaries(): ProcessSummariesView {
  return {
    cycleLabel: buildEpisodeLabel(6, GAL_EPISODE_SCENES.processesFallback),
    items: [
      {
        pid: 1212,
        processName: "firefox",
        parentProcessName: "systemd",
        totalTraffic: "1.3 GB",
        destinationCount: 6,
        lastActiveLabel: "2 分钟前",
        alertLabel: getAlertBadgeLabel(false),
        hasActiveAlert: false,
      },
      {
        pid: 2199,
        processName: "syncthing",
        parentProcessName: "systemd",
        totalTraffic: "412 MB",
        destinationCount: 2,
        lastActiveLabel: "刚刚",
        alertLabel: getAlertBadgeLabel(true),
        hasActiveAlert: true,
      },
      {
        pid: 3377,
        processName: "code",
        parentProcessName: "systemd",
        totalTraffic: "128 MB",
        destinationCount: 4,
        lastActiveLabel: "10 秒前",
        alertLabel: getAlertBadgeLabel(false),
        hasActiveAlert: false,
      },
    ],
  };
}

function parseJson<T>(raw: string): T {
  return JSON.parse(raw) as T;
}
