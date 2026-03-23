import MetricChip from "../components/common/MetricChip";
import SectionCard from "../components/common/SectionCard";
import {
  GAL_ACTION_COPY,
  GAL_METRIC_LABELS,
  GAL_NOTICE_COPY,
  GAL_PAGE_COPY,
  getAgentStatusLabel,
  getCaptureModeLabel,
  getDatabaseStatusLabel,
} from "../copy/galAbstract";
import type {
  DashboardRuntimeView,
  DiagnosticsSnapshotView,
} from "../types/appData";

interface DiagnosticsPageProps {
  snapshot: DiagnosticsSnapshotView;
  runtime: DashboardRuntimeView;
  onRefresh: () => Promise<void>;
}

export default function DiagnosticsPage({
  snapshot,
  runtime,
  onRefresh,
}: DiagnosticsPageProps) {
  const notice = getDiagnosticsNotice(runtime);
  const metricLabels = GAL_METRIC_LABELS.diagnostics;
  const pageCopy = GAL_PAGE_COPY.diagnostics;

  return (
    <div className="app-main">
      <section className="app-panel">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">{snapshot.cycleLabel}</p>
            <h2>{pageCopy.title}</h2>
            <p className="page-copy">{pageCopy.lead}</p>
            <p className="page-copy">
              {GAL_PAGE_COPY.common.battleReport}：{runtime.sourceLabel} ·{" "}
              {runtime.lastUpdatedLabel}
            </p>
          </div>
          <div className="page-header-actions">
            <button
              className="action-button"
              type="button"
              onClick={() => {
                void onRefresh();
              }}
              disabled={runtime.isRefreshing}
            >
              {runtime.isRefreshing
                ? GAL_ACTION_COPY.diagnosticsRefresh.busy
                : GAL_ACTION_COPY.diagnosticsRefresh.idle}
            </button>
            <div className="metric-row">
              <MetricChip
                label={metricLabels.agent}
                value={getAgentStatusLabel(snapshot.agentStatus)}
              />
              <MetricChip
                label={metricLabels.captureMode}
                value={getCaptureModeLabel(snapshot.captureMode)}
              />
              <MetricChip
                label={metricLabels.database}
                value={getDatabaseStatusLabel(snapshot.databaseStatus)}
              />
            </div>
          </div>
        </header>

        {notice ? (
          <div
            className={`state-banner ${notice.tone === "error" ? "is-error" : ""}`.trim()}
          >
            <strong>{notice.title}</strong>
            <span>{notice.message}</span>
          </div>
        ) : null}
      </section>

      <div className="page-grid">
        <SectionCard
          eyebrow={pageCopy.runtime.connectionEyebrow}
          title={pageCopy.runtime.connectionTitle}
          summary={pageCopy.runtime.connectionSummary}
          badge={snapshot.socketPath}
          badgeTone="warn"
        >
          <div className="page-note">
            {snapshot.degradedReason ?? pageCopy.runtime.degradedFallback}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow={pageCopy.runtime.permissionEyebrow}
          title={pageCopy.runtime.permissionTitle}
          summary={pageCopy.runtime.permissionSummary}
        >
          <div className="list-item">
            <strong>{pageCopy.runtime.permissionLabel}</strong>
            <span>{snapshot.permissionSummary}</span>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function getDiagnosticsNotice(runtime: DashboardRuntimeView) {
  if (runtime.errorMessage) {
    return {
      tone: "error" as const,
      title: GAL_NOTICE_COPY.diagnostics.errorTitle,
      message: runtime.errorMessage,
    };
  }

  if (runtime.isLoading) {
    return {
      tone: "normal" as const,
      title: GAL_NOTICE_COPY.diagnostics.loadingTitle,
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

  return null;
}
