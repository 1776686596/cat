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
    bridgeMissingMessage: "桌面桥接尚未注入，当前展示进程详情回退快照。",
    liveSourceLabel: "agentd 进程详情",
    fallbackSourceLabel: "前端回退快照",
    connectingSourceLabel: "正在连接 agentd",
    initialSyncLabel: "正在加载详情",
    disabledSourceLabel: "等待选择进程",
    disabledSyncLabel: "未选择",
  });

  return {
    detail: data,
    runtime,
    refresh,
  };
}
