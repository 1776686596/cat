import {
  getFallbackProcessSummaries,
  resolveProcessesPayload,
} from "../data/processes";
import { useBridgeResource } from "./useBridgeResource";

export function useProcessesData() {
  const { data, runtime, refresh } = useBridgeResource({
    fallbackData: getFallbackProcessSummaries,
    loadWithBridge: async (bridge) =>
      resolveProcessesPayload(await bridge.loadProcessesPayload()),
    bridgeMissingMessage: "桌面桥接尚未注入，当前展示进程页回退快照。",
    liveSourceLabel: "agentd 进程聚合",
    fallbackSourceLabel: "前端回退快照",
    connectingSourceLabel: "正在连接 agentd",
    initialSyncLabel: "正在加载进程列表",
  });

  return {
    processes: data,
    runtime,
    refresh,
  };
}
