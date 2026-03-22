import type { AgentDashboardPayload } from "../types/appData";
import type {
  AgentHistoryPayload,
  AgentHistoryQuery,
  AgentProcessDetailPayload,
  AgentProcessesPayload,
  DesktopAppBridge,
} from "./desktopBridge";

export const COMMAND_LOAD_DASHBOARD = "bridge_load_dashboard_payload";
export const COMMAND_LOAD_PROCESSES = "bridge_load_processes_payload";
export const COMMAND_LOAD_HISTORY = "bridge_load_history_payload";
export const COMMAND_LOAD_PROCESS_DETAIL = "bridge_load_process_detail_payload";
export const COMMAND_SHOW_MAIN_WINDOW = "bridge_show_main_window";
export const COMMAND_START_WIDGET_DRAGGING = "bridge_start_widget_dragging";

type NativeInvoke = (
  command: string,
  payload?: Record<string, unknown>,
) => Promise<unknown>;

interface InvokeBridgeOptions {
  sourceLabel: string;
  bridgeKind: DesktopAppBridge["bridgeKind"];
}

export function createInvokeDesktopBridge(
  invoke: NativeInvoke,
  options: InvokeBridgeOptions,
): DesktopAppBridge {
  return {
    sourceLabel: options.sourceLabel,
    bridgeKind: options.bridgeKind,
    loadDashboardPayload: () =>
      invokePayload<AgentDashboardPayload>(invoke, COMMAND_LOAD_DASHBOARD),
    loadProcessesPayload: () =>
      invokePayload<AgentProcessesPayload>(invoke, COMMAND_LOAD_PROCESSES),
    loadHistoryPayload: (query?: AgentHistoryQuery) =>
      invokePayload<AgentHistoryPayload>(invoke, COMMAND_LOAD_HISTORY, {
        process_name: query?.processName,
        target: query?.target,
        port: query?.port,
        direction: query?.direction,
        started_after: query?.startedAfter,
        ended_before: query?.endedBefore,
        limit: query?.limit,
        offset: query?.offset,
        include_lan_traffic: query?.includeLanTraffic,
      }),
    loadProcessDetailPayload: (pid: number) =>
      invokePayload<AgentProcessDetailPayload>(invoke, COMMAND_LOAD_PROCESS_DETAIL, {
        pid,
      }),
    showMainWindow: async (options) => {
      await invoke(COMMAND_SHOW_MAIN_WINDOW, {
        view: options?.view ?? "realtime",
      });
    },
    startWidgetDragging: async () => {
      await invoke(COMMAND_START_WIDGET_DRAGGING);
    },
  };
}

async function invokePayload<T>(
  invoke: NativeInvoke,
  command: string,
  payload?: Record<string, unknown>,
): Promise<T> {
  const value = await invoke(command, payload);
  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }
  return value as T;
}
