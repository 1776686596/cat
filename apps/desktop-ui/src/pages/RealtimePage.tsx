import { buildAppUrl } from "../app/windowMode";
import MetricChip from "../components/common/MetricChip";
import SectionCard from "../components/common/SectionCard";
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
import type {
  DashboardRuntimeView,
  RealtimeSnapshotView,
} from "../types/appData";

interface RealtimePageProps {
  snapshot: RealtimeSnapshotView;
  runtime: DashboardRuntimeView;
  onRefresh: () => Promise<void>;
}

export default function RealtimePage({
  snapshot,
  runtime,
  onRefresh,
}: RealtimePageProps) {
  const notice = getRealtimeNotice(snapshot, runtime);
  const realtimeMetricLabels = GAL_METRIC_LABELS.realtime;
  const realtimePageCopy = GAL_PAGE_COPY.realtime;
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
            primaryActionLabel={GAL_ACTION_COPY.realtimeOpenWidget}
            onPrimaryAction={openWidgetPreview}
            onRefresh={onRefresh}
            refreshDisabled={runtime.isRefreshing}
          />
        </section>

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
