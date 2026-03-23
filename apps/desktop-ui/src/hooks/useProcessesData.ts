import {
  GAL_RUNTIME_COPY,
} from "../copy/galAbstract";
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
    bridgeMissingMessage: GAL_RUNTIME_COPY.bridgeMissingMessage,
    liveSourceLabel: GAL_RUNTIME_COPY.liveSourceLabel,
    fallbackSourceLabel: GAL_RUNTIME_COPY.fallbackSourceLabel,
    connectingSourceLabel: GAL_RUNTIME_COPY.connectingSourceLabel,
    initialSyncLabel: GAL_RUNTIME_COPY.processesInitialSyncLabel,
  });

  return {
    processes: data,
    runtime,
    refresh,
  };
}
