import type { AgentHistoryQuery } from "../bridge/desktopBridge";
import { getFallbackHistoryPage, resolveHistoryPayload } from "../data/history";
import { useBridgeResource } from "./useBridgeResource";

const DEFAULT_LIMIT = 20;

export function useHistoryData(query?: AgentHistoryQuery) {
  const effectiveQuery: AgentHistoryQuery = {
    processName: query?.processName,
    target: query?.target,
    port: query?.port,
    direction: query?.direction,
    startedAfter: query?.startedAfter,
    endedBefore: query?.endedBefore,
    limit: query?.limit ?? DEFAULT_LIMIT,
    offset: query?.offset ?? 0,
    includeLanTraffic: query?.includeLanTraffic ?? false,
  };

  const { data, runtime, refresh } = useBridgeResource({
    reloadKey: JSON.stringify(effectiveQuery),
    fallbackData: getFallbackHistoryPage,
    loadWithBridge: async (bridge) =>
      resolveHistoryPayload(await bridge.loadHistoryPayload(effectiveQuery)),
    bridgeMissingMessage: "桌面桥接尚未注入，当前展示历史页回退快照。",
    liveSourceLabel: "agentd 历史分页",
    fallbackSourceLabel: "前端回退快照",
    connectingSourceLabel: "正在连接 agentd",
    initialSyncLabel: "正在加载历史分页",
  });

  return {
    history: data,
    runtime,
    refresh,
  };
}
