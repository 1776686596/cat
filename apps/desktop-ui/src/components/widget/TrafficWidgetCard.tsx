import type { CSSProperties } from "react";
import type {
  DashboardRuntimeView,
  RealtimeSnapshotView,
} from "../../types/appData";
import { resolveDesktopBridge } from "../../bridge/desktopBridge";

interface TrafficWidgetCardProps {
  snapshot: RealtimeSnapshotView;
  runtime: DashboardRuntimeView;
  mode?: "compact" | "panel";
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

type RankCatPose =
  | "sit"
  | "step-left"
  | "step-right"
  | "stretch"
  | "proud";

interface WidgetPalette {
  fur: string;
  innerEar: string;
  outline: string;
  eye: string;
  nose: string;
  accent: string;
  accentSoft: string;
  accentCool: string;
  shadow: string;
}

const RANK_CAT_POSES: RankCatPose[] = [
  "sit",
  "step-left",
  "step-right",
  "stretch",
  "proud",
];

export default function TrafficWidgetCard({
  snapshot,
  runtime,
  mode = "compact",
  primaryActionLabel,
  onPrimaryAction,
  primaryDisabled = false,
  onRefresh,
  refreshDisabled = false,
}: TrafficWidgetCardProps) {
  const tone = getWidgetTone(snapshot.widgetState, runtime);
  const recentConnections = snapshot.activeConnections.slice(0, 3);
  const guidance = getWidgetGuidance(snapshot, runtime, primaryActionLabel);
  const syncLabel = compressSyncLabel(runtime.lastUpdatedLabel);
  const captureLabel = humanizeCaptureMode(snapshot.captureMode);
  const showInlineList = mode === "compact";

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
    <section className={`traffic-widget traffic-widget--${mode} is-${tone}`}>
      <div className="traffic-widget__shell">
        {showInlineList ? (
          <button
            className="traffic-widget__drag-handle"
            type="button"
            onMouseDown={(event) => {
              if (event.button !== 0) {
                return;
              }
              void handleStartDragging();
            }}
            aria-label="拖动挂件"
            title="拖动挂件"
          >
            ⋮⋮
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
          <div className="traffic-widget__pet" aria-hidden="true">
            <TrafficCatGlyph tone={tone} />
          </div>

          <div className="traffic-widget__summary">
            <div className="traffic-widget__topline">
              <span className="traffic-widget__state-pill">
                {humanizeWidgetState(snapshot.widgetState)}
              </span>
              <span className="traffic-widget__meta">
                {captureLabel} · {syncLabel}
              </span>
            </div>

            <p className="traffic-widget__headline" title={snapshot.headline}>
              {snapshot.headline}
            </p>

            <div className="traffic-widget__stats">
              <span className="traffic-widget__stat is-upload">
                ↑ {snapshot.uploadRate}
              </span>
              <span className="traffic-widget__stat is-download">
                ↓ {snapshot.downloadRate}
              </span>
            </div>
          </div>
        </button>

        {!showInlineList && onRefresh ? (
          <button
            className="traffic-widget__refresh"
            type="button"
            onClick={onRefresh}
            disabled={refreshDisabled}
            aria-label="刷新挂件快照"
            title="刷新挂件快照"
          >
            ↻
          </button>
        ) : null}
      </div>

      <div className={`traffic-widget__details ${showInlineList ? "is-inline" : "is-panel"}`}>
        {!showInlineList ? (
          <div className="traffic-widget__popover-header">
            <p>{mode === "panel" ? "最近流量" : primaryActionLabel}</p>
            <span>{recentConnections.length} 条</span>
          </div>
        ) : null}

        {recentConnections.length === 0 ? (
          <p className="traffic-widget__empty">当前还没有活跃连接。</p>
        ) : (
          <div className="traffic-widget__list">
            {recentConnections.map((item, index) => (
              <div className="traffic-widget__list-item" key={item.sessionId}>
                <TrafficRankMarker rank={index} tone={tone} />
                <strong title={`${item.processName} -> ${item.target}`}>
                  {item.processName}
                </strong>
                <span className="traffic-widget__rate">{item.totalRate}</span>
              </div>
            ))}
          </div>
        )}

        {!showInlineList ? (
          <p className="traffic-widget__hint">{guidance}</p>
        ) : null}
      </div>
    </section>
  );
}

function TrafficRankMarker({
  rank,
  tone,
}: {
  rank: number;
  tone: WidgetTone;
}) {
  const palette = getWidgetPalette(tone);
  const style = {
    "--rank-cat-fur": palette.fur,
    "--rank-cat-ear": palette.innerEar,
    "--rank-cat-outline": palette.outline,
    "--rank-cat-eye": palette.eye,
    "--rank-cat-nose": palette.nose,
    "--rank-cat-shadow": palette.shadow,
    "--rank-cat-delay": `-${rank * 1.12}s`,
  } as CSSProperties;

  return (
    <div className="traffic-widget__rank-cluster">
      <span className="traffic-widget__rank">{rank + 1}</span>
      <span className="traffic-widget__rank-lane" aria-hidden="true">
        <span className="traffic-widget__rank-companion" style={style}>
          {RANK_CAT_POSES.map((pose) => (
            <TrafficRankCatPoseGlyph key={pose} pose={pose} />
          ))}
        </span>
      </span>
    </div>
  );
}

function TrafficRankCatPoseGlyph({ pose }: { pose: RankCatPose }) {
  return (
    <svg
      className={`traffic-widget__rank-pose traffic-widget__rank-pose--${pose}`}
      viewBox="0 0 52 28"
      role="presentation"
    >
      {renderRankCatPose(pose)}
      <ellipse
        cx="26"
        cy="25.4"
        rx="11.5"
        ry="2"
        fill="var(--rank-cat-shadow)"
        opacity="0.6"
      />
    </svg>
  );
}

function renderRankCatPose(pose: RankCatPose) {
  switch (pose) {
    case "sit":
      return (
        <>
          <path
            d="M31 16 C38 14 40 23 33 23"
            fill="none"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <ellipse
            cx="24"
            cy="18"
            rx="10.8"
            ry="6.8"
            fill="var(--rank-cat-fur)"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.6"
          />
          <circle
            cx="17"
            cy="11.8"
            r="5.2"
            fill="var(--rank-cat-fur)"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.6"
          />
          <path
            d="M12.8 8.8 L14.8 4.4 L17.2 8.5"
            fill="var(--rank-cat-fur)"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M17 8.6 L19.4 4.2 L21.4 8.2"
            fill="var(--rank-cat-fur)"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M14.5 8.7 Q15.8 7.4 16.9 8.4"
            fill="none"
            stroke="var(--rank-cat-ear)"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <path
            d="M18.2 8.4 Q19.3 7.2 20.2 8.1"
            fill="none"
            stroke="var(--rank-cat-ear)"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <circle cx="15.2" cy="11.6" r="0.95" fill="var(--rank-cat-eye)" />
          <circle cx="18.8" cy="11.6" r="0.95" fill="var(--rank-cat-eye)" />
          <circle cx="17" cy="14.1" r="0.8" fill="var(--rank-cat-nose)" />
          <path
            d="M15.6 15.5 Q17 16.4 18.4 15.5"
            fill="none"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
          <path
            d="M21 23.2 V25.2"
            fill="none"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M26.4 23.2 V25.3"
            fill="none"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      );
    case "step-left":
      return (
        <>
          <path
            d="M36 14 C44 10 45 19 39 20.8"
            fill="none"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <ellipse
            cx="28"
            cy="16.4"
            rx="11.6"
            ry="5.8"
            fill="var(--rank-cat-fur)"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.6"
          />
          <circle
            cx="15.2"
            cy="11.8"
            r="5.1"
            fill="var(--rank-cat-fur)"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.6"
          />
          <path
            d="M10.9 8.6 L12.8 4.2 L15.3 8.3"
            fill="var(--rank-cat-fur)"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M15.2 8.5 L17.8 4.3 L19.6 8.2"
            fill="var(--rank-cat-fur)"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="13.6" cy="11.5" r="0.95" fill="var(--rank-cat-eye)" />
          <circle cx="17.2" cy="11.5" r="0.95" fill="var(--rank-cat-eye)" />
          <circle cx="15.3" cy="13.8" r="0.8" fill="var(--rank-cat-nose)" />
          <path
            d="M14 15.1 Q15.3 16 16.6 15.1"
            fill="none"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
          <path
            d="M21.4 20.1 L18.2 24"
            fill="none"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M26.2 20.3 L24.4 24.1"
            fill="none"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M31.2 20.2 L33.5 24"
            fill="none"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M35.3 19.5 L40.4 22.1"
            fill="none"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </>
      );
    case "step-right":
      return (
        <>
          <path
            d="M35.6 14.3 C42.8 12.5 45 20.3 38.7 21.4"
            fill="none"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <ellipse
            cx="27.4"
            cy="16.3"
            rx="11.6"
            ry="5.8"
            fill="var(--rank-cat-fur)"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.6"
          />
          <circle
            cx="17"
            cy="11.3"
            r="5.1"
            fill="var(--rank-cat-fur)"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.6"
          />
          <path
            d="M12.9 8.4 L14.7 4.2 L17.3 8.1"
            fill="var(--rank-cat-fur)"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M17 8.2 L19.6 4.1 L21.5 8"
            fill="var(--rank-cat-fur)"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="15.3" cy="11.2" r="0.95" fill="var(--rank-cat-eye)" />
          <circle cx="18.8" cy="11.2" r="0.95" fill="var(--rank-cat-eye)" />
          <circle cx="17" cy="13.5" r="0.8" fill="var(--rank-cat-nose)" />
          <path
            d="M15.6 14.9 Q17 15.8 18.3 14.9"
            fill="none"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
          <path
            d="M21.2 20.3 L18.1 23.6"
            fill="none"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M26.4 20.2 L28.2 24.1"
            fill="none"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M31.1 20.2 L33.2 24"
            fill="none"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M35.4 19.8 L39.8 23.6"
            fill="none"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </>
      );
    case "stretch":
      return (
        <>
          <path
            d="M39.4 15.1 C45.8 12.8 48.1 20.8 42.8 22.1"
            fill="none"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M17.2 13.7 C22.2 11 32.8 10.6 39.5 14.4 C41.7 15.7 43 17.6 42.4 19.6 C41.8 21.7 39.3 22.8 36.6 22.8 H18.5 C15.5 22.8 13 20.8 13 18.5 C13 16.7 14.5 14.8 17.2 13.7 Z"
            fill="var(--rank-cat-fur)"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle
            cx="11.2"
            cy="17.1"
            r="4.9"
            fill="var(--rank-cat-fur)"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.6"
          />
          <path
            d="M7.4 14 L9 10.1 L11.4 13.5"
            fill="var(--rank-cat-fur)"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path
            d="M11.2 13.8 L13.7 10.2 L15 13.7"
            fill="var(--rank-cat-fur)"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <circle cx="9.8" cy="16.8" r="0.9" fill="var(--rank-cat-eye)" />
          <circle cx="13.1" cy="16.8" r="0.9" fill="var(--rank-cat-eye)" />
          <circle cx="11.4" cy="18.8" r="0.75" fill="var(--rank-cat-nose)" />
          <path
            d="M10.1 20 Q11.4 20.7 12.7 20"
            fill="none"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
          <path
            d="M19.8 22.1 L18.4 25"
            fill="none"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M24.8 22.1 L24.3 25.1"
            fill="none"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M33.8 22 L38.8 24.3"
            fill="none"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M37.2 21.8 L43 23"
            fill="none"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      );
    case "proud":
      return (
        <>
          <path
            d="M33.8 15.2 C40 11.1 43 17.4 39.4 19.8"
            fill="none"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
          <path
            d="M18.5 14.2 C21 10.8 26.7 9.8 31.4 12 C35.2 13.8 36.6 18.4 33.8 21.2 C31.8 23.2 28.3 23.7 24.8 22.7 C21.5 21.8 18.7 19.6 18 17 C17.6 16.1 17.8 15 18.5 14.2 Z"
            fill="var(--rank-cat-fur)"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle
            cx="17.2"
            cy="11.2"
            r="5"
            fill="var(--rank-cat-fur)"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.6"
          />
          <path
            d="M13.1 8.2 L15 4.1 L17.4 8"
            fill="var(--rank-cat-fur)"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M17.4 8 L20 4 L21.7 8"
            fill="var(--rank-cat-fur)"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="15.5" cy="11.2" r="0.95" fill="var(--rank-cat-eye)" />
          <circle cx="18.9" cy="11.2" r="0.95" fill="var(--rank-cat-eye)" />
          <circle cx="17.2" cy="13.5" r="0.8" fill="var(--rank-cat-nose)" />
          <path
            d="M15.8 14.9 Q17.2 15.6 18.5 14.9"
            fill="none"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
          <path
            d="M22.5 21.7 L21.6 24.8"
            fill="none"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M28.2 21.8 L30.5 24.5"
            fill="none"
            stroke="var(--rank-cat-outline)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      );
  }
}

function TrafficCatGlyph({ tone }: { tone: WidgetTone }) {
  const palette = getWidgetPalette(tone);

  return (
    <svg viewBox="0 0 84 84" role="img" aria-label="流量小猫图标">
      {renderSignal(tone, palette)}

      <path
        d="M26 29 L33 16 L39 31"
        fill={palette.fur}
        stroke={palette.outline}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M45 31 L51 16 L58 29"
        fill={palette.fur}
        stroke={palette.outline}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M25 31 C22 25 27 18 34 18 C38 18 40 20 42 24 C44 20 46 18 50 18 C57 18 62 25 59 31 C63 35 65 40 65 47 C65 58 55 65 42 65 C29 65 19 58 19 47 C19 40 21 35 25 31 Z"
        fill={palette.fur}
        stroke={palette.outline}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M57 52 C63 52 67 58 63 61 C60 63 55 61 53 57"
        fill="none"
        stroke={palette.outline}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M29 29 C31 26 33 24 35 24"
        fill="none"
        stroke={palette.innerEar}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M49 24 C51 24 53 26 55 29"
        fill="none"
        stroke={palette.innerEar}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="34" cy="43" r="3.2" fill={palette.eye} />
      <circle cx="50" cy="43" r="3.2" fill={palette.eye} />
      <circle cx="42" cy="48" r="2.2" fill={palette.nose} />
      <path
        d={getMouthPath(tone)}
        fill="none"
        stroke={palette.outline}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M31 50 L24 48"
        fill="none"
        stroke={palette.outline}
        strokeOpacity="0.45"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M53 50 L60 48"
        fill="none"
        stroke={palette.outline}
        strokeOpacity="0.45"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <ellipse
        cx="42"
        cy="69"
        rx="17"
        ry="4"
        fill={palette.shadow}
        opacity="0.55"
      />
    </svg>
  );
}

function renderSignal(tone: WidgetTone, palette: WidgetPalette) {
  if (tone === "alerting") {
    return (
      <>
        <circle cx="65" cy="22" r="8" fill={palette.accent} />
        <path
          d="M65 18 V24"
          fill="none"
          stroke="#fff9f5"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="65" cy="27" r="1.4" fill="#fff9f5" />
      </>
    );
  }

  if (tone === "download" || tone === "bidirectional") {
    return (
      <>
        <circle cx="12" cy="44" r="4.5" fill={palette.accentCool} opacity="0.28" />
        <circle cx="8" cy="44" r="2.2" fill={palette.accentCool} opacity="0.92" />
      </>
    );
  }

  if (tone === "upload") {
    return (
      <>
        <circle cx="72" cy="44" r="4.5" fill={palette.accent} opacity="0.28" />
        <circle cx="76" cy="44" r="2.2" fill={palette.accent} opacity="0.92" />
      </>
    );
  }

  return null;
}

function getWidgetGuidance(
  snapshot: RealtimeSnapshotView,
  runtime: DashboardRuntimeView,
  primaryActionLabel: string,
) {
  if (runtime.errorMessage) {
    return "桥接异常，优先检查诊断";
  }
  if (snapshot.captureMode === "proc_fallback") {
    return "当前处于回退采集";
  }
  return `${primaryActionLabel} · 悬停看最近流量`;
}

function humanizeWidgetState(widgetState: string) {
  switch (normalizeWidgetState(widgetState)) {
    case "idle":
      return "待机";
    case "download_active":
      return "下载中";
    case "upload_active":
      return "上传中";
    case "bidirectional_active":
      return "双向活跃";
    case "alerting":
      return "告警";
    default:
      return "未知";
  }
}

function humanizeCaptureMode(captureMode: string) {
  if (captureMode === "proc_fallback") {
    return "回退";
  }
  if (captureMode === "ebpf") {
    return "eBPF";
  }
  return captureMode;
}

function compressSyncLabel(label: string) {
  return label.replace("最近同步 ", "");
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

function getMouthPath(tone: WidgetTone) {
  if (tone === "alerting") {
    return "M37 53 Q42 57 47 53";
  }
  if (tone === "idle") {
    return "M37 52 Q42 49 47 52";
  }
  return "M37 52 Q42 55 47 52";
}

function getWidgetPalette(tone: WidgetTone): WidgetPalette {
  if (tone === "alerting") {
    return {
      fur: "#FFF6F1",
      innerEar: "#FFB7A4",
      outline: "#CDA895",
      eye: "#E57B53",
      nose: "#FF9066",
      accent: "#FF9066",
      accentSoft: "#FFD7CB",
      accentCool: "#B5DEFF",
      shadow: "rgba(255, 144, 102, 0.2)",
    };
  }

  if (tone === "download") {
    return {
      fur: "#FAF7F2",
      innerEar: "#EFD7CB",
      outline: "#C8B8AB",
      eye: "#8EBDEB",
      nose: "#FFB381",
      accent: "#FFB381",
      accentSoft: "#FFF0E6",
      accentCool: "#88C8FF",
      shadow: "rgba(136, 200, 255, 0.18)",
    };
  }

  if (tone === "upload" || tone === "bidirectional") {
    return {
      fur: "#FAF7F2",
      innerEar: "#EFD7CB",
      outline: "#C8B8AB",
      eye: "#F1A061",
      nose: "#FFB381",
      accent: "#FFB381",
      accentSoft: "#FFF0E6",
      accentCool: "#88C8FF",
      shadow: "rgba(255, 179, 129, 0.2)",
    };
  }

  if (tone === "idle") {
    return {
      fur: "#FAF7F2",
      innerEar: "#E5DDD5",
      outline: "#C8BEB5",
      eye: "#9A8E85",
      nose: "#D8C6B8",
      accent: "#FFB381",
      accentSoft: "#FFF4EA",
      accentCool: "#B5DEFF",
      shadow: "rgba(191, 176, 164, 0.18)",
    };
  }

  return {
    fur: "#FAF7F2",
    innerEar: "#E5DDD5",
    outline: "#C8BEB5",
    eye: "#9A8E85",
    nose: "#D8C6B8",
    accent: "#FFB381",
    accentSoft: "#FFF4EA",
    accentCool: "#B5DEFF",
    shadow: "rgba(191, 176, 164, 0.18)",
  };
}
