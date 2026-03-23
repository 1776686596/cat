import type { AgentHistoryQuery } from "../bridge/desktopBridge";
import { GAL_RUNTIME_COPY } from "../copy/galAbstract";
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
    bridgeMissingMessage: GAL_RUNTIME_COPY.bridgeMissingMessage,
    liveSourceLabel: GAL_RUNTIME_COPY.liveSourceLabel,
    fallbackSourceLabel: GAL_RUNTIME_COPY.fallbackSourceLabel,
    connectingSourceLabel: GAL_RUNTIME_COPY.connectingSourceLabel,
    initialSyncLabel: GAL_RUNTIME_COPY.historyInitialSyncLabel,
  });

  return {
    history: data,
    runtime,
    refresh,
  };
}
