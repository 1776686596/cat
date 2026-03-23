import {
  GAL_RUNTIME_COPY,
} from "../copy/galAbstract";
import {
  getEmptyProcessDetail,
  getFallbackProcessDetail,
  resolveProcessDetailPayload,
} from "../data/processDetail";
import { useBridgeResource } from "./useBridgeResource";

export function useProcessDetailData(selectedProcessId: number | null) {
  const { data, runtime, refresh } = useBridgeResource({
    enabled: selectedProcessId !== null,
    reloadKey: selectedProcessId ?? "none",
    fallbackData: () => getFallbackProcessDetail(selectedProcessId),
    disabledData: getEmptyProcessDetail,
    loadWithBridge: async (bridge) =>
      resolveProcessDetailPayload(
        selectedProcessId ?? 0,
        await bridge.loadProcessDetailPayload(selectedProcessId ?? 0),
      ),
    bridgeMissingMessage: GAL_RUNTIME_COPY.bridgeMissingMessage,
    liveSourceLabel: GAL_RUNTIME_COPY.liveSourceLabel,
    fallbackSourceLabel: GAL_RUNTIME_COPY.fallbackSourceLabel,
    connectingSourceLabel: GAL_RUNTIME_COPY.connectingSourceLabel,
    initialSyncLabel: GAL_RUNTIME_COPY.processDetailInitialSyncLabel,
    disabledSourceLabel: GAL_RUNTIME_COPY.processDetailDisabledSourceLabel,
    disabledSyncLabel: GAL_RUNTIME_COPY.processDetailDisabledSyncLabel,
  });

  return {
    detail: data,
    runtime,
    refresh,
  };
}
