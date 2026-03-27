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
    line: pickSceneLine(sceneId, topConnection),
    overlayLead: buildOverlayLead(
      sceneId,
      topConnection,
      snapshot.activeConnections.length,
    ),
    guidance: buildGuidance(sceneId, snapshot, runtime),
    reasonTitle: sceneCopy.reasonTitle,
    reasonDetail: buildReasonDetail(sceneId, snapshot, runtime, topConnection),
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
    if (sceneId === "alert") {
      return "这条连接值得看一眼";
    }
    return sceneId === "idle" ? "海面平静" : "正在值守";
  }

  switch (sceneId) {
    case "idle":
      return "海面平静";
    case "watching":
      return `${topConnection.processName} 引起注意`;
    case "busy_download":
      return `${topConnection.processName} 正在吃流量`;
    case "busy_upload":
      return `${topConnection.processName} 正在往外发`;
    case "alert":
      return "这条连接值得看一眼";
  }
}

function buildReasonDetail(
  sceneId: WidgetSceneId,
  snapshot: RealtimeSnapshotView,
  runtime: DashboardRuntimeView,
  topConnection: RealtimeConnectionItem | null,
): string {
  if (runtime.errorMessage) {
    return runtime.errorMessage;
  }

  if (sceneId === "alert" && !topConnection) {
    return "当前触发了提醒状态，但还没有榜首连接可展示。";
  }

  if (!topConnection) {
    return "当前没有明显活跃连接，挂件会继续在后台值守。";
  }

  switch (sceneId) {
    case "idle":
      return "现在没有明显热点连接。";
    case "watching":
      return `${topConnection.processName} 仍在连接 ${topConnection.target}。`;
    case "busy_download":
      return `${topConnection.processName} 正在从 ${topConnection.target} 持续下载。`;
    case "busy_upload":
      return `${topConnection.processName} 正在向 ${topConnection.target} 持续上传数据。`;
    case "alert":
      if (snapshot.captureMode === "proc_fallback") {
        return `${topConnection.processName} 当前最显眼，建议先确认这条连接。`;
      }
      return `${topConnection.processName} 当前行为比平时更值得注意。`;
  }
}

function buildOverlayLead(
  sceneId: WidgetSceneId,
  topConnection: RealtimeConnectionItem | null,
  connectionCount: number,
): string {
  if (!topConnection || connectionCount === 0) {
    if (sceneId === "alert") {
      return "当前处于提醒状态，建议立即打开主界面确认。";
    }
    return "这会儿还没人抢镜。";
  }

  switch (sceneId) {
    case "idle":
      return "现在没有明显热点。";
    case "watching":
      return `${connectionCount} 条连接里，${topConnection.processName} 最值得先看。`;
    case "busy_download":
      return `${topConnection.processName} 当前以下行流量为主。`;
    case "busy_upload":
      return `${topConnection.processName} 当前以上行流量为主。`;
    case "alert":
      return "这一波建议优先点进去确认。";
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
  topConnection: RealtimeConnectionItem | null,
): string {
  const lines = GAL_WIDGET_SCENE_COPY[sceneId].lines;
  const index = stableIndex(topConnection?.sessionId ?? sceneId, lines.length);
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
