import {
  GAL_RUNTIME_COPY,
} from "../copy/galAbstract";
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
    bridgeMissingMessage: GAL_RUNTIME_COPY.bridgeMissingMessage,
    liveSourceLabel: GAL_RUNTIME_COPY.liveSourceLabel,
    fallbackSourceLabel: GAL_RUNTIME_COPY.fallbackSourceLabel,
    connectingSourceLabel: GAL_RUNTIME_COPY.connectingSourceLabel,
    initialSyncLabel: GAL_RUNTIME_COPY.dashboardInitialSyncLabel,
    pollIntervalMillis: 1_000,
  });

  return {
    dashboardData: data,
    runtime,
    refresh,
  };
}
