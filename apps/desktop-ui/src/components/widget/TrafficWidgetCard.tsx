import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
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
import {
  clampWidgetCharacterScale,
  DEFAULT_WIDGET_CHARACTER_PLACEMENT,
  type WidgetCharacterPlacement,
} from "../../hooks/useWidgetCharacterPlacement";

interface TrafficWidgetCardProps {
  snapshot: RealtimeSnapshotView;
  runtime: DashboardRuntimeView;
  mode?: "compact" | "panel";
  layoutMode?: WidgetLayoutMode;
  characterPlacement?: WidgetCharacterPlacement;
  editableCharacter?: boolean;
  onCharacterPlacementChange?: (next: WidgetCharacterPlacement) => void;
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
const CHARACTER_DRAG_DISTANCE_THRESHOLD = 6;

export default function TrafficWidgetCard({
  snapshot,
  runtime,
  mode = "compact",
  layoutMode = "character-first",
  characterPlacement = DEFAULT_WIDGET_CHARACTER_PLACEMENT,
  editableCharacter = false,
  onCharacterPlacementChange,
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
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startPlacement: WidgetCharacterPlacement;
  } | null>(null);
  const suppressCharacterClickRef = useRef(false);
  const [isCharacterDragging, setIsCharacterDragging] = useState(false);
  const widgetStyle = {
    "--widget-character-user-x": `${characterPlacement.offsetX}px`,
    "--widget-character-user-y": `${characterPlacement.offsetY}px`,
    "--widget-character-user-scale": characterPlacement.scale,
    "--widget-overlay-user-opacity": characterPlacement.overlayOpacity,
  } as CSSProperties;

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

  function handleCharacterPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!editableCharacter || !onCharacterPlacementChange) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPlacement: characterPlacement,
    };
    suppressCharacterClickRef.current = false;
    setIsCharacterDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleCharacterPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!editableCharacter || !onCharacterPlacementChange) {
      return;
    }

    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const offsetX = event.clientX - dragState.startX;
    const offsetY = event.clientY - dragState.startY;
    if (
      Math.hypot(offsetX, offsetY) >= CHARACTER_DRAG_DISTANCE_THRESHOLD
    ) {
      suppressCharacterClickRef.current = true;
    }
    onCharacterPlacementChange({
      ...dragState.startPlacement,
      offsetX: dragState.startPlacement.offsetX + offsetX,
      offsetY: dragState.startPlacement.offsetY + offsetY,
    });
  }

  function handleCharacterPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    dragStateRef.current = null;
    setIsCharacterDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleCharacterWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (!editableCharacter || !onCharacterPlacementChange) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const delta = event.deltaY < 0 ? 0.04 : -0.04;
    onCharacterPlacementChange({
      ...characterPlacement,
      scale: clampWidgetCharacterScale(characterPlacement.scale + delta),
    });
  }

  return (
    <section
      className={`traffic-widget traffic-widget--${mode} is-${tone} is-${layoutMode}`}
      style={widgetStyle}
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
                  ? "Watch Scene"
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

          <div
            className={[
              "traffic-widget__character",
              editableCharacter ? "is-editable" : "",
              isCharacterDragging ? "is-dragging" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClickCapture={(event) => {
              if (!editableCharacter) {
                return;
              }
              suppressCharacterClickRef.current = false;
              event.preventDefault();
              event.stopPropagation();
            }}
            onPointerDown={handleCharacterPointerDown}
            onPointerMove={handleCharacterPointerMove}
            onPointerUp={handleCharacterPointerUp}
            onPointerCancel={handleCharacterPointerUp}
            onWheel={handleCharacterWheel}
            aria-label={
              editableCharacter
                ? `${GAL_ACTION_COPY.widget.adjustCharacter}，${GAL_ACTION_COPY.widget.resizeCharacter}`
                : undefined
            }
            title={
              editableCharacter
                ? `${GAL_ACTION_COPY.widget.adjustCharacter}，${GAL_ACTION_COPY.widget.resizeCharacter}`
                : undefined
            }
          >
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
      "守望姬警报",
      "桥接掉线了，先把链路接回来，再继续看实时动静。",
      "alert",
    );
  }

  if (current.captureMode === "proc_fallback" && previous.captureMode !== "proc_fallback") {
    return createBubble(
      "fallback-mode",
      "守望姬提示",
      "当前是回退观测，趋势能看，但别把细节当成满精度。",
      "curious",
    );
  }

  if (current.tone === "alerting" && previous.tone !== "alerting") {
    return createBubble(
      "alerting",
      "守望姬警报",
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
      "守望姬盯梢中",
      `${topConnection?.processName ?? "它"} 的流量突然抬头了，这一波值得优先看。`,
      "excited",
    );
  }

  if (!previous.topSessionId && current.topSessionId) {
    return createBubble(
      `opening-${current.topSessionId}`,
      "守望姬出场",
      `${topConnection?.processName ?? "第一名"} 已经站到榜首，我先替你盯着。`,
      "happy",
    );
  }

  if (previous.connectionCount > 0 && current.connectionCount === 0) {
    return createBubble(
      "sea-calm",
      "守望姬旁白",
      "海面暂时平了，先让我装作若无其事。",
      "calm",
    );
  }

  if (current.isRefreshing && !previous.isRefreshing) {
    return createBubble(
      "refreshing",
      "守望姬倒数",
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
      "守望姬警报",
      "桥这会儿不通，先别急着相信眼前这点动静。",
      "alert",
    );
  }

  if (snapshot.captureMode === "proc_fallback") {
    return createBubble(
      "ambient-fallback",
      "守望姬备注",
      "现在走的是回退观测，先把这份情报当作趋势预览。",
      "curious",
    );
  }

  if (!topConnection) {
    return createBubble(
      "ambient-idle",
      "守望姬打盹",
      "今天的网路海面很安静，我先站着看看。",
      "sleep",
    );
  }

  if (tone === "alerting") {
    return createBubble(
      "ambient-alerting",
      "守望姬警报",
      `${topConnection.processName} 这会儿最显眼，先盯它。`,
      "alert",
    );
  }

  return createBubble(
    `ambient-${topConnection.sessionId}`,
    "守望姬盯梢中",
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
