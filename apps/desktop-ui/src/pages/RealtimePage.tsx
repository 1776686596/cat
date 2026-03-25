import { buildAppUrl } from "../app/windowMode";
import MetricChip from "../components/common/MetricChip";
import SectionCard from "../components/common/SectionCard";
import SetupChecklist from "../components/common/SetupChecklist";
import TrafficWidgetCard from "../components/widget/TrafficWidgetCard";
import {
  GAL_ACTION_COPY,
  GAL_METRIC_LABELS,
  GAL_NOTICE_COPY,
  GAL_PAGE_COPY,
  getCaptureModeLabel,
  getRealtimeRuntimeLabel,
  getWidgetStateLabel,
} from "../copy/galAbstract";
import {
  WIDGET_CHARACTER_SCALE_MAX,
  WIDGET_CHARACTER_SCALE_MIN,
  WIDGET_CHARACTER_SCALE_STEP,
  WIDGET_OVERLAY_OPACITY_MAX,
  WIDGET_OVERLAY_OPACITY_MIN,
  WIDGET_OVERLAY_OPACITY_STEP,
  useWidgetCharacterPlacement,
} from "../hooks/useWidgetCharacterPlacement";
import { useWidgetLayoutMode } from "../hooks/useWidgetLayoutMode";
import type {
  DashboardRuntimeView,
  DiagnosticsSnapshotView,
  RealtimeSnapshotView,
} from "../types/appData";

interface RealtimePageProps {
  snapshot: RealtimeSnapshotView;
  diagnostics: DiagnosticsSnapshotView;
  runtime: DashboardRuntimeView;
  onRefresh: () => Promise<void>;
}

interface RealtimeFocusSignal {
  id: string;
  eyebrow: string;
  title: string;
  detail: string;
  tone: "normal" | "warn";
}

export default function RealtimePage({
  snapshot,
  diagnostics,
  runtime,
  onRefresh,
}: RealtimePageProps) {
  const notice = getRealtimeNotice(snapshot, runtime);
  const { layoutMode, setLayoutMode } = useWidgetLayoutMode();
  const {
    placement,
    setPlacement,
    updatePlacement,
    resetPlacement,
  } = useWidgetCharacterPlacement(layoutMode);
  const realtimeMetricLabels = GAL_METRIC_LABELS.realtime;
  const realtimePageCopy = GAL_PAGE_COPY.realtime;
  const setupNeedsAttention = diagnostics.setupChecklist.some(
    (item) => item.status === "attention",
  );
  const focusSignals = buildRealtimeFocusSignals(snapshot, diagnostics, runtime);
  const spotlightCards = [
    {
      label: realtimeMetricLabels.activeConnections,
      value: `${snapshot.activeConnections.length} 条`,
      detail:
        snapshot.activeConnections[0] === undefined
          ? realtimePageCopy.spotlight.noHotspot
          : `${snapshot.activeConnections[0].processName} ${realtimePageCopy.spotlight.liveDetailSuffix}`,
    },
    {
      label: realtimeMetricLabels.captureMode,
      value: getCaptureModeLabel(snapshot.captureMode),
      detail:
        snapshot.captureMode === "proc_fallback"
          ? realtimePageCopy.spotlight.fallbackCaptureDetail
          : realtimePageCopy.spotlight.liveCaptureDetail,
    },
    {
      label: realtimeMetricLabels.widgetState,
      value: getWidgetStateLabel(snapshot.widgetState),
      detail: `上行 ${snapshot.uploadRate} · 下行 ${snapshot.downloadRate}`,
    },
    {
      label: realtimeMetricLabels.syncState,
      value: getRealtimeRuntimeLabel(runtime.mode, {
        isLoading: runtime.isLoading,
        isRefreshing: runtime.isRefreshing,
        hasError: Boolean(runtime.errorMessage),
      }),
      detail: runtime.lastUpdatedLabel,
    },
  ];
  const openWidgetPreview = () => {
    if (typeof window === "undefined") {
      return;
    }

    window.open(
      buildAppUrl({
        windowMode: "widget",
        initialView: "realtime",
      }),
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <div className="app-main">
      <section className="app-panel app-panel--hero">
        <div className="realtime-hero">
          <div className="realtime-hero__copy">
            <p className="page-eyebrow">{snapshot.cycleLabel}</p>
            <h2>{realtimePageCopy.title}</h2>
            <p className="page-lead">{realtimePageCopy.lead}</p>
            <div className="page-copy-cluster">
              <p className="page-copy">
                {GAL_PAGE_COPY.common.battleReport}：{runtime.sourceLabel} ·{" "}
                {runtime.lastUpdatedLabel}
              </p>
            </div>
          </div>

          <div className="realtime-hero__aside">
            <div className="realtime-kpi-grid">
              {spotlightCards.map((item) => (
                <article className="realtime-kpi-card" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>

            <div className="page-header-actions page-header-actions--hero">
              <button
                className="action-button"
                type="button"
                onClick={() => {
                  void onRefresh();
                }}
                disabled={runtime.isRefreshing}
              >
                {runtime.isLoading
                  ? GAL_ACTION_COPY.realtimeRefresh.loading
                  : runtime.isRefreshing
                    ? GAL_ACTION_COPY.realtimeRefresh.busy
                    : GAL_ACTION_COPY.realtimeRefresh.idle}
              </button>

              <div className="metric-row">
                <MetricChip
                  label={realtimeMetricLabels.upload}
                  value={snapshot.uploadRate}
                />
                <MetricChip
                  label={realtimeMetricLabels.download}
                  value={snapshot.downloadRate}
                />
                <MetricChip
                  label={realtimeMetricLabels.state}
                  value={getWidgetStateLabel(snapshot.widgetState)}
                />
              </div>
            </div>
          </div>
        </div>

        {notice ? (
          <div
            className={`state-banner ${notice.tone === "error" ? "is-error" : ""}`.trim()}
          >
            <strong>{notice.title}</strong>
            <span>{notice.message}</span>
          </div>
        ) : null}
      </section>

      <div className="realtime-layout">
        <section className="widget-preview-section">
          <div className="widget-preview-copy">
            <p className="page-eyebrow">{realtimePageCopy.widgetPreviewEyebrow}</p>
            <h3>{realtimePageCopy.widgetPreviewTitle}</h3>
            <p className="section-summary">{realtimePageCopy.widgetPreviewSummary}</p>

            <div className="widget-preview-points">
              <div className="widget-preview-mode">
                <div className="widget-preview-mode__copy">
                  <strong>{realtimePageCopy.widgetModeTitle}</strong>
                  <span>{realtimePageCopy.widgetModeSummary}</span>
                </div>
                <div className="widget-preview-mode__switch" aria-label={realtimePageCopy.widgetModeTitle}>
                  <button
                    className={`widget-preview-mode__button ${layoutMode === "character-first" ? "is-active" : ""}`.trim()}
                    type="button"
                    onClick={() => {
                      setLayoutMode("character-first");
                    }}
                  >
                    {realtimePageCopy.widgetModeCharacterLabel}
                  </button>
                  <button
                    className={`widget-preview-mode__button ${layoutMode === "ranking-first" ? "is-active" : ""}`.trim()}
                    type="button"
                    onClick={() => {
                      setLayoutMode("ranking-first");
                    }}
                  >
                    {realtimePageCopy.widgetModeRankingLabel}
                  </button>
                </div>
              </div>

              <div className="widget-preview-editor">
                <div className="widget-preview-editor__copy">
                  <strong>{realtimePageCopy.widgetEditorTitle}</strong>
                  <span>{realtimePageCopy.widgetEditorSummary}</span>
                </div>

                <div className="widget-preview-editor__controls">
                  <label className="widget-preview-editor__slider">
                    <span>{realtimePageCopy.widgetEditorScaleLabel}</span>
                    <input
                      type="range"
                      min={WIDGET_CHARACTER_SCALE_MIN}
                      max={WIDGET_CHARACTER_SCALE_MAX}
                      step={WIDGET_CHARACTER_SCALE_STEP}
                      value={placement.scale}
                      onChange={(event) => {
                        updatePlacement({
                          scale: Number(event.currentTarget.value),
                        });
                      }}
                    />
                    <strong>{Math.round(placement.scale * 100)}%</strong>
                  </label>

                  <label className="widget-preview-editor__slider">
                    <span>{realtimePageCopy.widgetEditorOverlayOpacityLabel}</span>
                    <input
                      type="range"
                      min={WIDGET_OVERLAY_OPACITY_MIN}
                      max={WIDGET_OVERLAY_OPACITY_MAX}
                      step={WIDGET_OVERLAY_OPACITY_STEP}
                      value={placement.overlayOpacity}
                      onChange={(event) => {
                        updatePlacement({
                          overlayOpacity: Number(event.currentTarget.value),
                        });
                      }}
                    />
                    <strong>{Math.round(placement.overlayOpacity * 100)}%</strong>
                  </label>

                  <button
                    className="widget-preview-editor__reset"
                    type="button"
                    onClick={resetPlacement}
                  >
                    {realtimePageCopy.widgetEditorResetLabel}
                  </button>
                </div>

                <p className="widget-preview-editor__hint">
                  {realtimePageCopy.widgetEditorHint}
                </p>
              </div>

              <div className="widget-preview-point">
                <strong>{realtimePageCopy.widgetPoints.idleTitle}</strong>
                <span>{realtimePageCopy.widgetPoints.idleCopy}</span>
              </div>
              <div className="widget-preview-point">
                <strong>{realtimePageCopy.widgetPoints.hoverTitle}</strong>
                <span>{realtimePageCopy.widgetPoints.hoverCopy}</span>
              </div>
              <div className="widget-preview-point">
                <strong>{realtimePageCopy.widgetPoints.currentTitle}</strong>
                <span>
                  {realtimeMetricLabels.state} {getWidgetStateLabel(snapshot.widgetState)} ·{" "}
                  {realtimeMetricLabels.captureMode} {getCaptureModeLabel(snapshot.captureMode)}
                </span>
              </div>
            </div>
          </div>

          <TrafficWidgetCard
            snapshot={snapshot}
            runtime={runtime}
            mode="panel"
            layoutMode={layoutMode}
            characterPlacement={placement}
            editableCharacter
            onCharacterPlacementChange={setPlacement}
            primaryActionLabel={GAL_ACTION_COPY.realtimeOpenWidget}
            onPrimaryAction={openWidgetPreview}
            onRefresh={onRefresh}
            refreshDisabled={runtime.isRefreshing}
          />
        </section>

        <div className="page-grid">
          <SectionCard
            eyebrow={realtimePageCopy.setup.eyebrow}
            title={realtimePageCopy.setup.title}
            summary={realtimePageCopy.setup.summary}
            badge={diagnostics.supportLabel}
            badgeTone={setupNeedsAttention ? "warn" : "normal"}
          >
            <div className="support-summary">
              <div className="support-summary__item">
                <strong>{diagnostics.platformLabel}</strong>
                <span>{diagnostics.platformSummary}</span>
              </div>
              <div className="support-summary__item">
                <strong>{diagnostics.capabilityLabel}</strong>
                <span>{diagnostics.capabilitySummary}</span>
              </div>
            </div>

            <div className="page-note page-note--soft">
              {diagnostics.recommendedAction}
            </div>

            <SetupChecklist items={diagnostics.setupChecklist} />
          </SectionCard>

          <SectionCard
            eyebrow={realtimePageCopy.focus.eyebrow}
            title={realtimePageCopy.focus.title}
            summary={realtimePageCopy.focus.summary}
          >
            <div className="signal-grid">
              {focusSignals.map((item) => (
                <article
                  className={`signal-card ${item.tone === "warn" ? "is-warn" : ""}`.trim()}
                  key={item.id}
                >
                  <span>{item.eyebrow}</span>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          </SectionCard>
        </div>

        <SectionCard
          eyebrow={realtimePageCopy.hotspot.eyebrow}
          title={realtimePageCopy.hotspot.title}
          summary={realtimePageCopy.hotspot.summary}
          badge={`${snapshot.activeConnections.length} ${realtimePageCopy.hotspot.badgeSuffix}`}
        >
          {snapshot.activeConnections.length === 0 ? (
            <div className="page-note">{realtimePageCopy.hotspot.empty}</div>
          ) : (
            <div className="list-block">
              {snapshot.activeConnections.map((item) => (
                <div className="list-item" key={item.sessionId}>
                  <strong>
                    {item.processName} -&gt; {item.target}
                  </strong>
                  <span>
                    {item.direction} · {item.protocol} · 上 {item.uploadRate} · 下{" "}
                    {item.downloadRate} · 合计 {item.totalRate} ·{" "}
                    {item.localPortLabel} · {item.lastSeenLabel}
                    {snapshot.captureMode === "proc_fallback" &&
                    item.protocol === "UDP"
                      ? " · 数值有点演"
                      : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function getRealtimeNotice(
  snapshot: RealtimeSnapshotView,
  runtime: DashboardRuntimeView,
) {
  if (runtime.errorMessage) {
    return {
      tone: "error" as const,
      title: GAL_NOTICE_COPY.realtime.errorTitle,
      message: runtime.errorMessage,
    };
  }

  if (runtime.isLoading) {
    return {
      tone: "normal" as const,
      title: GAL_NOTICE_COPY.realtime.loadingTitle,
      message: GAL_NOTICE_COPY.common.wait,
    };
  }

  if (runtime.mode === "mock") {
    return {
      tone: "normal" as const,
      title: GAL_NOTICE_COPY.common.mockTitle,
      message: GAL_NOTICE_COPY.common.mockMessage,
    };
  }

  if (runtime.isFallback) {
    return {
      tone: "normal" as const,
      title: GAL_NOTICE_COPY.common.fallbackTitle,
      message: GAL_NOTICE_COPY.common.fallbackMessage,
    };
  }

  if (snapshot.captureMode === "proc_fallback" && isZeroThroughputSnapshot(snapshot)) {
    return {
      tone: "normal" as const,
      title: GAL_NOTICE_COPY.realtime.zeroRateTitle,
      message: GAL_NOTICE_COPY.realtime.zeroRateMessage,
    };
  }

  if (
    snapshot.captureMode === "proc_fallback" &&
    snapshot.activeConnections.some((item) => item.protocol === "UDP")
  ) {
    return {
      tone: "normal" as const,
      title: GAL_NOTICE_COPY.realtime.fallbackCaptureTitle,
      message: GAL_NOTICE_COPY.realtime.fallbackCaptureMessage,
    };
  }

  return null;
}

function isZeroThroughputSnapshot(snapshot: RealtimeSnapshotView) {
  return (
    snapshot.activeConnections.length > 0 &&
    snapshot.uploadRate === "0 B/s" &&
    snapshot.downloadRate === "0 B/s" &&
    snapshot.activeConnections.every((item) => item.totalRate === "0 B/s")
  );
}

function buildRealtimeFocusSignals(
  snapshot: RealtimeSnapshotView,
  diagnostics: DiagnosticsSnapshotView,
  runtime: DashboardRuntimeView,
): RealtimeFocusSignal[] {
  const topConnection = snapshot.activeConnections[0];
  const setupNeedsAttention = diagnostics.setupChecklist.some(
    (item) => item.status === "attention",
  );

  const trafficSignal = runtime.errorMessage
    ? {
        id: "runtime-error",
        eyebrow: "链路状态",
        title: "先把实时链路接回来",
        detail: runtime.errorMessage,
        tone: "warn" as const,
      }
    : topConnection
      ? {
          id: topConnection.sessionId,
          eyebrow: "当前榜首",
          title: `${topConnection.processName} 正在最前排`,
          detail: `${topConnection.target} · ${topConnection.totalRate} · ${topConnection.lastSeenLabel}`,
          tone: "normal" as const,
        }
      : {
          id: "no-traffic",
          eyebrow: "当前榜首",
          title: "桌面暂时很安静",
          detail: "现在没有活跃连接，挂件会继续在后台值守。",
          tone: "normal" as const,
        };

  return [
    trafficSignal,
    {
      id: "capability",
      eyebrow: "观测能力",
      title: diagnostics.capabilityLabel,
      detail: diagnostics.capabilitySummary,
      tone: setupNeedsAttention ? "warn" : "normal",
    },
    {
      id: "next-action",
      eyebrow: diagnostics.supportLabel,
      title: "下一步最值得补这里",
      detail: diagnostics.recommendedAction,
      tone:
        runtime.isFallback || snapshot.captureMode === "proc_fallback"
          ? "warn"
          : "normal",
    },
  ];
}
