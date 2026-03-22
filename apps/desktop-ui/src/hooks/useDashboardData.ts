import {
  getFallbackDashboardData,
  resolveDashboardPayload,
} from "../data/dashboard";
import { useBridgeResource } from "./useBridgeResource";

export function useDashboardData() {
  const { data, runtime, refresh } = useBridgeResource({
    fallbackData: getFallbackDashboardData,
    loadWithBridge: async (bridge) =>
      resolveDashboardPayload(await bridge.loadDashboardPayload()),
    bridgeMissingMessage: "桌面桥接尚未注入，当前展示前端回退快照。",
    liveSourceLabel: "agentd 实时快照",
    fallbackSourceLabel: "前端回退快照",
    connectingSourceLabel: "正在连接 agentd",
    initialSyncLabel: "首屏加载中",
    pollIntervalMillis: 1_000,
  });

  return {
    dashboardData: data,
    runtime,
    refresh,
  };
}
