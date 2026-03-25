import MetricChip from "../components/common/MetricChip";
import SectionCard from "../components/common/SectionCard";
import SetupChecklist from "../components/common/SetupChecklist";
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
  const setupNeedsAttention = snapshot.setupChecklist.some(
    (item) => item.status === "attention",
  );

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
                label={metricLabels.database}
                value={snapshot.platformLabel}
              />
              <MetricChip
                label={metricLabels.captureMode}
                value={snapshot.capabilityLabel}
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
          eyebrow={pageCopy.runtime.platformEyebrow}
          title={pageCopy.runtime.platformTitle}
          summary={pageCopy.runtime.platformSummary}
          badge={snapshot.supportLabel}
          badgeTone={snapshot.platform === "linux" ? "normal" : "warn"}
        >
          <div className="page-note page-note--soft">
            {snapshot.platformSummary}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow={pageCopy.runtime.capabilityEyebrow}
          title={pageCopy.runtime.capabilityTitle}
          summary={pageCopy.runtime.capabilitySummary}
          badge={snapshot.capabilityLabel}
          badgeTone={setupNeedsAttention ? "warn" : "normal"}
        >
          <div className="page-note page-note--soft">
            {snapshot.capabilitySummary}
          </div>
          <div className="list-block">
            <div className="list-item">
              <strong>{pageCopy.runtime.permissionLabel}</strong>
              <span>{snapshot.permissionSummary}</span>
            </div>
            <div className="list-item">
              <strong>{GAL_METRIC_LABELS.diagnostics.agent}</strong>
              <span>{getAgentStatusLabel(snapshot.agentStatus)}</span>
            </div>
            <div className="list-item">
              <strong>采集模式</strong>
              <span>
                {getCaptureModeLabel(snapshot.captureMode)} ·{" "}
                {snapshot.degradedReason ?? pageCopy.runtime.degradedFallback}
              </span>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="page-grid">
        <SectionCard
          eyebrow={pageCopy.runtime.nextEyebrow}
          title={pageCopy.runtime.nextTitle}
          summary={pageCopy.runtime.nextSummary}
        >
          <div className="page-note page-note--soft">
            {snapshot.recommendedAction}
          </div>
          <div className="list-block">
            <div className="list-item">
              <strong>{pageCopy.runtime.socketLabel}</strong>
              <span>{snapshot.socketPath}</span>
            </div>
            <div className="list-item">
              <strong>{pageCopy.runtime.databaseLabel}</strong>
              <span>
                {getDatabaseStatusLabel(snapshot.databaseStatus)} · {snapshot.databasePath}
              </span>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow={pageCopy.runtime.checklistEyebrow}
          title={pageCopy.runtime.checklistTitle}
          summary={pageCopy.runtime.checklistSummary}
        >
          <SetupChecklist items={snapshot.setupChecklist} />
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
