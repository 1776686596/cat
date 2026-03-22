import type { AgentDashboardPayload } from "../types/appData";
import type { AppView } from "../app/navigation";

export interface AgentProcessesPayload {
  summariesJson: string;
  alertsJson?: string;
}

export interface AgentHistoryQuery {
  processName?: string;
  target?: string;
  port?: number;
  direction?: "outbound" | "inbound";
  startedAfter?: number;
  endedBefore?: number;
  limit?: number;
  offset?: number;
  includeLanTraffic?: boolean;
}

export interface AgentHistoryPayload {
  historyJson: string;
}

export interface AgentProcessDetailPayload {
  detailJson: string;
}

export interface ShowMainWindowOptions {
  view?: Extract<AppView, "realtime" | "processes" | "history" | "diagnostics">;
}

export interface DesktopAppBridge {
  sourceLabel?: string;
  bridgeKind?: "native" | "mock" | "external" | "dev";
  loadDashboardPayload: () => Promise<AgentDashboardPayload>;
  loadProcessesPayload: () => Promise<AgentProcessesPayload>;
  loadHistoryPayload: (query?: AgentHistoryQuery) => Promise<AgentHistoryPayload>;
  loadProcessDetailPayload: (pid: number) => Promise<AgentProcessDetailPayload>;
  showMainWindow?: (options?: ShowMainWindowOptions) => Promise<void>;
  startWidgetDragging?: () => Promise<void>;
}

declare global {
  interface Window {
    __TRAFFIC_CAT_DASHBOARD__?: DesktopAppBridge;
    __TRAFFIC_CAT_NATIVE_INVOKE__?: (
      command: string,
      payload?: Record<string, unknown>,
    ) => Promise<unknown>;
    __TAURI__?: {
      core?: {
        invoke?: (
          command: string,
          payload?: Record<string, unknown>,
        ) => Promise<unknown>;
      };
    };
    __TAURI_INTERNALS__?: {
      invoke?: (
        command: string,
        payload?: Record<string, unknown>,
      ) => Promise<unknown>;
    };
  }
}

export function resolveDesktopBridge(): DesktopAppBridge | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.__TRAFFIC_CAT_DASHBOARD__ ?? null;
}
