import { GAL_NOTICE_COPY, GAL_WIDGET_SCENE_COPY } from "../copy/galAbstract";
import type {
  DashboardRuntimeView,
  RealtimeConnectionItem,
  RealtimeSnapshotView,
} from "../types/appData";

const RATE_DOMINANCE_RATIO = 1.35;
const ACTIVE_RATE_THRESHOLD = 384 * 1024;
const HIGH_ACTIVITY_RATE_THRESHOLD = 8 * 1024 * 1024;

export type WidgetSceneId =
  | "idle"
  | "watching"
  | "busy_download"
  | "busy_upload"
  | "alert";

export type WidgetSceneMood =
  | "sleep"
  | "calm"
  | "curious"
  | "focus"
  | "happy"
  | "excited"
  | "alert"
  | "surprised"
  | "angry";

type NormalizedWidgetState =
  | "idle"
  | "download_active"
  | "upload_active"
  | "bidirectional_active"
  | "alerting"
  | "unknown";

export interface WidgetSceneView {
  sceneId: WidgetSceneId;
  mood: WidgetSceneMood;
  stateLabel: string;
  title: string;
  line: string;
  overlayLead: string;
  guidance: string;
  reasonTitle: string;
  reasonDetail: string;
  focusProcessName: string | null;
  focusTarget: string | null;
  focusRateLabel: string | null;
}

export function resolveWidgetScene(
  snapshot: RealtimeSnapshotView,
  runtime: DashboardRuntimeView,
): WidgetSceneView {
  const normalizedState = normalizeWidgetState(snapshot.widgetState);
  const topConnection = getTopConnection(snapshot.activeConnections);
  const sceneId = resolveSceneId(snapshot, runtime, normalizedState);
  const sceneCopy = GAL_WIDGET_SCENE_COPY[sceneId];

  return {
    sceneId,
    mood: pickSceneMood(sceneId, topConnection),
    stateLabel: sceneCopy.stateLabel,
    title: buildSceneTitle(sceneId, topConnection),
    line: pickSceneLine(sceneId, snapshot, runtime, topConnection),
    overlayLead: buildOverlayLead(sceneId, topConnection),
    guidance: buildGuidance(sceneId, snapshot, runtime),
    reasonTitle: sceneCopy.reasonTitle,
    reasonDetail: buildReasonDetail(sceneId, runtime, topConnection, normalizedState),
    focusProcessName: topConnection?.processName ?? null,
    focusTarget: topConnection?.target ?? null,
    focusRateLabel: topConnection?.totalRate ?? null,
  };
}

function resolveSceneId(
  snapshot: RealtimeSnapshotView,
  runtime: DashboardRuntimeView,
  normalizedState: NormalizedWidgetState,
): WidgetSceneId {
  if (runtime.errorMessage || normalizedState === "alerting") {
    return "alert";
  }

  if (snapshot.activeConnections.length === 0) {
    return "idle";
  }

  const uploadRate = sumRate(snapshot.activeConnections, "uploadRateValue");
  const downloadRate = sumRate(snapshot.activeConnections, "downloadRateValue");

  const uploadDominant =
    uploadRate >= ACTIVE_RATE_THRESHOLD &&
    uploadRate >= downloadRate * RATE_DOMINANCE_RATIO;
  if (uploadDominant) {
    return "busy_upload";
  }

  const downloadDominant =
    downloadRate >= ACTIVE_RATE_THRESHOLD &&
    downloadRate >= uploadRate * RATE_DOMINANCE_RATIO;
  if (downloadDominant) {
    return "busy_download";
  }

  return "watching";
}

function pickSceneMood(
  sceneId: WidgetSceneId,
  topConnection: RealtimeConnectionItem | null,
): WidgetSceneMood {
  switch (sceneId) {
    case "idle":
      return "sleep";
    case "watching":
      return "curious";
    case "busy_download":
      return topConnection &&
        topConnection.totalRateValue >= HIGH_ACTIVITY_RATE_THRESHOLD
        ? "excited"
        : "happy";
    case "busy_upload":
      return "focus";
    case "alert":
      return "alert";
  }
}

function buildSceneTitle(
  sceneId: WidgetSceneId,
  topConnection: RealtimeConnectionItem | null,
): string {
  if (!topConnection) {
    return GAL_WIDGET_SCENE_COPY[sceneId].reasonTitle;
  }

  switch (sceneId) {
    case "idle":
      return "当前暂无热点连接";
    case "watching":
      return `${topConnection.processName} 正在保持连接`;
    case "busy_download":
      return `${topConnection.processName} 正在快速下载`;
    case "busy_upload":
      return `${topConnection.processName} 正在持续上传`;
    case "alert":
      return `${topConnection.processName} 触发提醒`;
  }
}

function buildReasonDetail(
  sceneId: WidgetSceneId,
  runtime: DashboardRuntimeView,
  topConnection: RealtimeConnectionItem | null,
  normalizedState: NormalizedWidgetState,
): string {
  if (runtime.errorMessage) {
    return `agentd 未连接：${runtime.errorMessage}`;
  }

  switch (sceneId) {
    case "idle":
      return "当前没有活跃连接，继续值守。";
    case "watching":
      return topConnection
        ? `${topConnection.processName} 仍在保持连接（${topConnection.totalRate}），先继续观察。`
        : "有连接动静，但还不构成主导流量。";
    case "busy_download":
      return topConnection
        ? `${topConnection.processName} 的下行速率更高（${topConnection.downloadRate}），建议先确认下载来源。`
        : "下行流量占优，建议先看连接来源。";
    case "busy_upload":
      return topConnection
        ? `${topConnection.processName} 正在持续上传（${topConnection.uploadRate}），建议先确认发送目标。`
        : "上行流量占优，建议先看发送目标。";
    case "alert":
      if (normalizedState === "alerting" && topConnection) {
        return `${topConnection.processName} 已进入提醒状态，建议立即查看。`;
      }
      return "检测到提醒状态，建议立即查看当前榜首连接。";
  }
}

function buildOverlayLead(
  sceneId: WidgetSceneId,
  topConnection: RealtimeConnectionItem | null,
): string {
  if (!topConnection) {
    return sceneId === "idle" ? "暂无热点连接" : "等待连接细节";
  }

  switch (sceneId) {
    case "idle":
      return "暂无热点连接";
    case "watching":
      return `观察中：${topConnection.processName} → ${topConnection.target}`;
    case "busy_download":
      return `下载热点：${topConnection.processName} → ${topConnection.target}`;
    case "busy_upload":
      return `上传热点：${topConnection.processName} → ${topConnection.target}`;
    case "alert":
      return `提醒连接：${topConnection.processName} → ${topConnection.target}`;
  }
}

function buildGuidance(
  sceneId: WidgetSceneId,
  snapshot: RealtimeSnapshotView,
  runtime: DashboardRuntimeView,
): string {
  if (runtime.errorMessage) {
    return GAL_NOTICE_COPY.widget.errorGuidance;
  }

  if (snapshot.captureMode === "proc_fallback") {
    return GAL_NOTICE_COPY.widget.fallbackGuidance;
  }

  switch (sceneId) {
    case "idle":
      return "继续值守，有动静我会先提醒你。";
    case "watching":
      return "先看热点流量第一条，确认它在连谁。";
    case "busy_download":
      return "先看当前榜首连接，确认它在从哪里下载。";
    case "busy_upload":
      return "先看当前榜首连接，确认它在往哪里发送。";
    case "alert":
      return "建议立即点开主界面，先看当前榜首连接。";
  }
}

function pickSceneLine(
  sceneId: WidgetSceneId,
  snapshot: RealtimeSnapshotView,
  runtime: DashboardRuntimeView,
  topConnection: RealtimeConnectionItem | null,
): string {
  const lines = GAL_WIDGET_SCENE_COPY[sceneId].lines;
  const index = stableIndex(
    [
      sceneId,
      snapshot.cycleLabel,
      runtime.lastUpdatedLabel,
      topConnection?.sessionId ?? "no-session",
      topConnection?.processName ?? "no-process",
      topConnection?.target ?? "no-target",
    ].join("|"),
    lines.length,
  );
  return lines[index];
}

function stableIndex(seed: string, size: number): number {
  if (size <= 0) {
    return 0;
  }

  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash % size;
}

function getTopConnection(
  connections: RealtimeConnectionItem[],
): RealtimeConnectionItem | null {
  if (connections.length === 0) {
    return null;
  }

  let topConnection = connections[0];
  for (let index = 1; index < connections.length; index += 1) {
    const current = connections[index];
    if (current.totalRateValue > topConnection.totalRateValue) {
      topConnection = current;
      continue;
    }
    if (
      current.totalRateValue === topConnection.totalRateValue &&
      current.sessionId.localeCompare(topConnection.sessionId) < 0
    ) {
      topConnection = current;
    }
  }

  return topConnection;
}

function sumRate(
  connections: RealtimeConnectionItem[],
  field: "uploadRateValue" | "downloadRateValue",
): number {
  return connections.reduce((total, connection) => {
    const rate = connection[field];
    return total + (rate > 0 ? rate : 0);
  }, 0);
}

function normalizeWidgetState(widgetState: string): NormalizedWidgetState {
  const normalized = widgetState.trim().toLowerCase();

  switch (normalized) {
    case "idle":
      return "idle";
    case "download":
    case "download_active":
      return "download_active";
    case "upload":
    case "upload_active":
      return "upload_active";
    case "bidirectional":
    case "bidirectional_active":
      return "bidirectional_active";
    case "alerting":
      return "alerting";
    default:
      return "unknown";
  }
}
