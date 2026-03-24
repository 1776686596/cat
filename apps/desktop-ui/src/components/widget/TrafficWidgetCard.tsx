import { useEffect, useRef, useState } from "react";
import atriAlertFront from "../../../../../Atri/亚托莉/Tachie/担心.png";
import atriAngryFront from "../../../../../Atri/亚托莉/Tachie/生气.png";
import atriCalmFront from "../../../../../Atri/亚托莉/Tachie/正常.png";
import atriCuriousFront from "../../../../../Atri/亚托莉/Tachie/好奇.png";
import atriExcitedFront from "../../../../../Atri/亚托莉/Tachie/兴奋.png";
import atriHappyFront from "../../../../../Atri/亚托莉/Tachie/高兴.png";
import atriRankingCalm from "../../../../../Atri/亚托莉/Tachie/侧身-正常.png";
import atriRankingExcited from "../../../../../Atri/亚托莉/Tachie/侧身-兴奋.png";
import atriRankingHappy from "../../../../../Atri/亚托莉/Tachie/侧身-高兴.png";
import atriSleepFront from "../../../../../Atri/亚托莉/Tachie/睡觉.png";
import atriSurprisedFront from "../../../../../Atri/亚托莉/Tachie/惊呆.png";
import atriWatchFront from "../../../../../Atri/亚托莉/Tachie/认真.png";

import type {
  DashboardRuntimeView,
  RealtimeConnectionItem,
  RealtimeSnapshotView,
} from "../../types/appData";
import { resolveDesktopBridge } from "../../bridge/desktopBridge";
import {
  GAL_ACTION_COPY,
  GAL_NOTICE_COPY,
  getCaptureModeLabel,
  getWidgetStateLabel,
} from "../../copy/galAbstract";
import type { WidgetLayoutMode } from "../../hooks/useWidgetLayoutMode";

interface TrafficWidgetCardProps {
  snapshot: RealtimeSnapshotView;
  runtime: DashboardRuntimeView;
  mode?: "compact" | "panel";
  layoutMode?: WidgetLayoutMode;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  primaryDisabled?: boolean;
  onRefresh?: () => void;
  refreshDisabled?: boolean;
}

type WidgetTone =
  | "idle"
  | "download"
  | "upload"
  | "bidirectional"
  | "alerting"
  | "unknown";

type AtriMood =
  | "calm"
  | "curious"
  | "focus"
  | "excited"
  | "confident"
  | "happy"
  | "alert"
  | "angry"
  | "sleep"
  | "surprised";

interface WidgetBubble {
  id: string;
  kicker: string;
  line: string;
  mood: AtriMood;
}

interface WidgetSignature {
  topSessionId: string | null;
  topProcessName: string | null;
  topTotalRateValue: number;
  tone: WidgetTone;
  hasError: boolean;
  isRefreshing: boolean;
  captureMode: string;
  connectionCount: number;
}

const ATRI_SPRITES = {
  calm: {
    "character-first": atriCalmFront,
    "ranking-first": atriRankingCalm,
  },
  curious: {
    "character-first": atriCuriousFront,
    "ranking-first": atriRankingCalm,
  },
  focus: {
    "character-first": atriWatchFront,
    "ranking-first": atriRankingCalm,
  },
  excited: {
    "character-first": atriExcitedFront,
    "ranking-first": atriRankingExcited,
  },
  confident: {
    "character-first": atriHappyFront,
    "ranking-first": atriRankingHappy,
  },
  happy: {
    "character-first": atriHappyFront,
    "ranking-first": atriRankingHappy,
  },
  alert: {
    "character-first": atriAlertFront,
    "ranking-first": atriAlertFront,
  },
  angry: {
    "character-first": atriAngryFront,
    "ranking-first": atriAngryFront,
  },
  sleep: {
    "character-first": atriSleepFront,
    "ranking-first": atriSleepFront,
  },
  surprised: {
    "character-first": atriSurprisedFront,
    "ranking-first": atriSurprisedFront,
  },
} as const;

const TRAFFIC_SPIKE_RATIO = 1.35;
const TRAFFIC_SPIKE_BYTES = 384 * 1024;

export default function TrafficWidgetCard({
  snapshot,
  runtime,
  mode = "compact",
  layoutMode = "character-first",
  primaryActionLabel,
  onPrimaryAction,
  primaryDisabled = false,
  onRefresh,
  refreshDisabled = false,
}: TrafficWidgetCardProps) {
  const tone = getWidgetTone(snapshot.widgetState, runtime);
  const rankedConnections = sortConnections(snapshot.activeConnections).slice(0, 3);
  const topConnection = rankedConnections[0];
  const bubble = useWidgetBubble(snapshot, runtime, tone, topConnection);
  const guidance = getWidgetGuidance(snapshot, runtime, primaryActionLabel);
  const syncLabel = formatSyncLabel(runtime.lastUpdatedLabel);
  const captureLabel = getCaptureModeLabel(snapshot.captureMode);
  const activeMood = bubble?.mood ?? getAtriMood(tone, topConnection);
  const atriSprite = ATRI_SPRITES[activeMood][layoutMode];
  const isCompact = mode === "compact";

  async function handleStartDragging() {
    const bridge = resolveDesktopBridge();
    if (bridge?.bridgeKind !== "native" || !bridge.startWidgetDragging) {
      return;
    }

    try {
      await bridge.startWidgetDragging();
    } catch (error) {
      console.warn("拖拽挂件失败：", error);
    }
  }

  return (
    <section
      className={`traffic-widget traffic-widget--${mode} is-${tone} is-${layoutMode}`}
    >
      <div className="traffic-widget__shell">
        {isCompact ? (
          <button
            className="traffic-widget__drag-handle"
            type="button"
            onMouseDown={(event) => {
              if (event.button !== 0) {
                return;
              }
              void handleStartDragging();
            }}
            aria-label={GAL_ACTION_COPY.widget.drag}
            title={GAL_ACTION_COPY.widget.drag}
          >
            拖动
          </button>
        ) : null}

        {!isCompact && onRefresh ? (
          <button
            className="traffic-widget__refresh"
            type="button"
            onClick={onRefresh}
            disabled={refreshDisabled}
            aria-label={GAL_ACTION_COPY.widget.refresh}
            title={GAL_ACTION_COPY.widget.refresh}
          >
            ↻
          </button>
        ) : null}

        <button
          className="traffic-widget__surface"
          type="button"
          onClick={onPrimaryAction}
          disabled={primaryDisabled}
          aria-label={primaryActionLabel}
          title={guidance}
        >
          <span className="traffic-widget__wash traffic-widget__wash--pearl" />
          <span className="traffic-widget__wash traffic-widget__wash--sea" />
          <span className="traffic-widget__wash traffic-widget__wash--sun" />
          <span className="traffic-widget__grain" />

          <div className="traffic-widget__masthead">
            <div className="traffic-widget__masthead-copy">
              <span className="traffic-widget__serial">
                {layoutMode === "character-first"
                  ? "Atri Scene"
                  : "Traffic Stage"}
              </span>
              <strong>{getSceneTitle(tone, topConnection)}</strong>
            </div>
            <span className="traffic-widget__state-pill">
              {getWidgetStateLabel(snapshot.widgetState)}
            </span>
          </div>

          {bubble ? (
            <div className="traffic-widget__bubble">
              <span>{bubble.kicker}</span>
              <p>{bubble.line}</p>
            </div>
          ) : null}

          <div className="traffic-widget__character">
            <img src={atriSprite} alt="" aria-hidden="true" />
          </div>

          <div className="traffic-widget__headline">
            <strong title={snapshot.headline}>{snapshot.headline}</strong>
            <span>
              {captureLabel} · {syncLabel}
            </span>
          </div>

          <div className="traffic-widget__overlay">
            <div className="traffic-widget__overlay-top">
              <div className="traffic-widget__overlay-copy">
                <span className="traffic-widget__overlay-eyebrow">
                  {layoutMode === "character-first" ? "流量排行" : "实时榜单"}
                </span>
                <p>{getOverlayLead(tone, topConnection, rankedConnections.length)}</p>
              </div>

              <div className="traffic-widget__stats" aria-hidden="true">
                <span className="traffic-widget__stat is-upload">
                  ↑ {snapshot.uploadRate}
                </span>
                <span className="traffic-widget__stat is-download">
                  ↓ {snapshot.downloadRate}
                </span>
              </div>
            </div>

            {rankedConnections.length === 0 ? (
              <p className="traffic-widget__empty">{GAL_ACTION_COPY.widget.empty}</p>
            ) : (
              <div className="traffic-widget__list">
                {rankedConnections.map((item, index) => (
                  <div className="traffic-widget__list-item" key={item.sessionId}>
                    <span className="traffic-widget__rank">{String(index + 1).padStart(2, "0")}</span>
                    <div className="traffic-widget__process">
                      <strong title={`${item.processName} -> ${item.target}`}>
                        {item.processName}
                      </strong>
                      <span title={item.target}>
                        {item.target} · {item.protocol}
                      </span>
                    </div>
                    <span className="traffic-widget__rate">{item.totalRate}</span>
                  </div>
                ))}
              </div>
            )}

            {!isCompact ? (
              <p className="traffic-widget__hint">{guidance}</p>
            ) : null}
          </div>
        </button>
      </div>
    </section>
  );
}

function useWidgetBubble(
  snapshot: RealtimeSnapshotView,
  runtime: DashboardRuntimeView,
  tone: WidgetTone,
  topConnection: RealtimeConnectionItem | undefined,
) {
  const [bubble, setBubble] = useState<WidgetBubble | null>(() =>
    buildAmbientBubble(snapshot, runtime, tone, topConnection),
  );
  const signatureRef = useRef<WidgetSignature | null>(null);

  useEffect(() => {
    const current: WidgetSignature = {
      topSessionId: topConnection?.sessionId ?? null,
      topProcessName: topConnection?.processName ?? null,
      topTotalRateValue: topConnection?.totalRateValue ?? 0,
      tone,
      hasError: Boolean(runtime.errorMessage),
      isRefreshing: runtime.isRefreshing,
      captureMode: snapshot.captureMode,
      connectionCount: snapshot.activeConnections.length,
    };

    const previous = signatureRef.current;
    signatureRef.current = current;

    if (!previous) {
      setBubble(buildAmbientBubble(snapshot, runtime, tone, topConnection));
      return;
    }

    const nextBubble = detectWidgetBubble(previous, current, topConnection);
    if (nextBubble) {
      setBubble(nextBubble);
    }
  }, [
    runtime.errorMessage,
    runtime.isRefreshing,
    snapshot.captureMode,
    snapshot.activeConnections.length,
    topConnection?.processName,
    topConnection?.sessionId,
    topConnection?.totalRateValue,
    tone,
  ]);

  useEffect(() => {
    if (!bubble) {
      return;
    }

    const timer = window.setTimeout(() => {
      setBubble(null);
    }, 5_200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [bubble?.id]);

  return bubble;
}

function detectWidgetBubble(
  previous: WidgetSignature,
  current: WidgetSignature,
  topConnection: RealtimeConnectionItem | undefined,
) {
  if (current.hasError && !previous.hasError) {
    return createBubble(
      "bridge-error",
      "Atri 警报",
      "桥接掉线了，先把链路救回来再继续看戏。",
      "alert",
    );
  }

  if (current.captureMode === "proc_fallback" && previous.captureMode !== "proc_fallback") {
    return createBubble(
      "fallback-mode",
      "Atri 小声说",
      "现在是回退档，数字能看，但别全信。",
      "curious",
    );
  }

  if (current.tone === "alerting" && previous.tone !== "alerting") {
    return createBubble(
      "alerting",
      "Atri 警报",
      "这波状态不像在演，最好点进去盯一眼。",
      "angry",
    );
  }

  if (current.topSessionId && previous.topSessionId && current.topSessionId !== previous.topSessionId) {
    return createBubble(
      `rank-shift-${current.topSessionId}`,
      "战况更新",
      `${topConnection?.processName ?? "这位"} 抢到第一名了，镜头已经切过去。`,
      "surprised",
    );
  }

  if (
    current.topSessionId &&
    current.topTotalRateValue > previous.topTotalRateValue * TRAFFIC_SPIKE_RATIO &&
    current.topTotalRateValue - previous.topTotalRateValue > TRAFFIC_SPIKE_BYTES
  ) {
    return createBubble(
      `traffic-rise-${current.topSessionId}-${current.topTotalRateValue}`,
      "Atri 盯梢中",
      `${topConnection?.processName ?? "它"} 突然上头了，这波流量有点抢戏。`,
      "excited",
    );
  }

  if (!previous.topSessionId && current.topSessionId) {
    return createBubble(
      `opening-${current.topSessionId}`,
      "Atri 出场",
      `${topConnection?.processName ?? "第一名"} 已经站上 C 位，我替你盯着。`,
      "happy",
    );
  }

  if (previous.connectionCount > 0 && current.connectionCount === 0) {
    return createBubble(
      "sea-calm",
      "Atri 旁白",
      "海面暂时平了，先让我装作若无其事。",
      "calm",
    );
  }

  if (current.isRefreshing && !previous.isRefreshing) {
    return createBubble(
      "refreshing",
      "Atri 倒数",
      "新一轮抓现行中，别让它们趁机溜了。",
      "focus",
    );
  }

  return null;
}

function buildAmbientBubble(
  snapshot: RealtimeSnapshotView,
  runtime: DashboardRuntimeView,
  tone: WidgetTone,
  topConnection: RealtimeConnectionItem | undefined,
) {
  if (runtime.errorMessage) {
    return createBubble(
      "ambient-error",
      "Atri 警报",
      "桥这会儿不通，先别急着相信眼前这点动静。",
      "alert",
    );
  }

  if (snapshot.captureMode === "proc_fallback") {
    return createBubble(
      "ambient-fallback",
      "Atri 备注",
      "现在走的是回退档，先当这份情报是预告片。",
      "curious",
    );
  }

  if (!topConnection) {
    return createBubble(
      "ambient-idle",
      "Atri 打盹",
      "今天的网路海面很安静，我先站着看看。",
      "sleep",
    );
  }

  if (tone === "alerting") {
    return createBubble(
      "ambient-alerting",
      "Atri 警报",
      `${topConnection.processName} 这会儿最显眼，先盯它。`,
      "alert",
    );
  }

  return createBubble(
    `ambient-${topConnection.sessionId}`,
    "Atri 盯梢中",
    `${topConnection.processName} 现在在榜首，我已经把镜头推过去了。`,
    "focus",
  );
}

function createBubble(
  id: string,
  kicker: string,
  line: string,
  mood: AtriMood,
): WidgetBubble {
  return { id, kicker, line, mood };
}

function sortConnections(connections: RealtimeConnectionItem[]) {
  return [...connections].sort((left, right) => right.totalRateValue - left.totalRateValue);
}

function getSceneTitle(
  tone: WidgetTone,
  topConnection: RealtimeConnectionItem | undefined,
) {
  if (!topConnection) {
    return "海面平静";
  }

  if (tone === "alerting") {
    return "异常在冒头";
  }

  return `${topConnection.processName} 占住镜头`;
}

function getOverlayLead(
  tone: WidgetTone,
  topConnection: RealtimeConnectionItem | undefined,
  connectionCount: number,
) {
  if (!topConnection || connectionCount === 0) {
    return "这会儿还没人抢镜";
  }

  if (tone === "alerting") {
    return "当前这波最好优先审它";
  }

  return `${connectionCount} 个热点里，${topConnection.processName} 站在最前面`;
}

function getAtriMood(
  tone: WidgetTone,
  topConnection: RealtimeConnectionItem | undefined,
): AtriMood {
  if (!topConnection) {
    return "sleep";
  }

  if (tone === "alerting") {
    return "alert";
  }

  if (topConnection.totalRateValue >= 8 * 1024 * 1024) {
    return "excited";
  }

  if (tone === "bidirectional") {
    return "confident";
  }

  if (tone === "upload" || tone === "download") {
    return "focus";
  }

  if (tone === "idle") {
    return "calm";
  }

  return "curious";
}

function getWidgetGuidance(
  snapshot: RealtimeSnapshotView,
  runtime: DashboardRuntimeView,
  primaryActionLabel: string,
) {
  if (runtime.errorMessage) {
    return GAL_NOTICE_COPY.widget.errorGuidance;
  }
  if (snapshot.captureMode === "proc_fallback") {
    return GAL_NOTICE_COPY.widget.fallbackGuidance;
  }
  return `${primaryActionLabel} · 悬停看这轮榜单。`;
}

function normalizeWidgetState(widgetState: string) {
  return widgetState.trim().toLowerCase();
}

function getWidgetTone(
  widgetState: string,
  runtime: DashboardRuntimeView,
): WidgetTone {
  if (runtime.errorMessage) {
    return "alerting";
  }

  switch (normalizeWidgetState(widgetState)) {
    case "idle":
      return "idle";
    case "download_active":
      return "download";
    case "upload_active":
      return "upload";
    case "bidirectional_active":
      return "bidirectional";
    case "alerting":
      return "alerting";
    default:
      return "unknown";
  }
}

function formatSyncLabel(lastUpdatedLabel: string) {
  const trimmed = lastUpdatedLabel.trim();
  return trimmed.length > 0 ? trimmed : "刚同步";
}
