import MetricChip from "../components/common/MetricChip";
import SectionCard from "../components/common/SectionCard";
import {
  GAL_ACTION_COPY,
  GAL_METRIC_LABELS,
  GAL_NOTICE_COPY,
  GAL_PAGE_COPY,
} from "../copy/galAbstract";
import { useProcessDetailData } from "../hooks/useProcessDetailData";
import type { DashboardRuntimeView } from "../types/appData";

interface ProcessDetailPageProps {
  selectedProcessId: number | null;
}

export default function ProcessDetailPage({
  selectedProcessId,
}: ProcessDetailPageProps) {
  const { detail, runtime, refresh } = useProcessDetailData(selectedProcessId);
  const notice = getProcessDetailNotice(runtime, selectedProcessId);
  const metricLabels = GAL_METRIC_LABELS.processDetail;
  const pageCopy = GAL_PAGE_COPY.processDetail;

  return (
    <div className="app-main">
      <section className="app-panel">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">{detail.cycleLabel}</p>
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
                void refresh();
              }}
              disabled={runtime.isRefreshing || selectedProcessId === null}
            >
              {runtime.isRefreshing
                ? GAL_ACTION_COPY.processDetailRefresh.busy
                : GAL_ACTION_COPY.processDetailRefresh.idle}
            </button>
            <div className="metric-row">
              <MetricChip
                label={metricLabels.pid}
                value={detail.pid === null ? "-" : String(detail.pid)}
              />
              <MetricChip
                label={metricLabels.lastActive}
                value={detail.lastActiveLabel}
              />
              <MetricChip
                label={metricLabels.totalTraffic}
                value={detail.totalTraffic}
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
          eyebrow={pageCopy.profile.eyebrow}
          title={pageCopy.profile.title}
          summary={pageCopy.profile.summary}
        >
          <div className="page-note">
            {detail.pid === null ? (
              pageCopy.profile.empty
            ) : (
              <>
                进程：<code>{detail.processName}</code>
                <br />
                PID：<code>{detail.pid}</code>
                <br />
                最近活跃：<code>{detail.lastActiveLabel}</code>
              </>
            )}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow={pageCopy.sessions.eyebrow}
          title={pageCopy.sessions.title}
          summary={pageCopy.sessions.summary}
          badge={
            detail.pid === null
              ? pageCopy.sessions.emptyBadge
              : `${detail.activeConnections.length} ${pageCopy.sessions.badgeSuffix}`
          }
          badgeTone={detail.pid === null ? "warn" : "normal"}
        >
          {detail.activeConnections.length === 0 ? (
            <div className="page-note">{pageCopy.sessions.empty}</div>
          ) : (
            <div className="list-block">
              {detail.activeConnections.map((item) => (
                <div className="list-item" key={item.sessionId}>
                  <strong>
                    {item.target} · {item.protocol} · {item.state}
                  </strong>
                  <span>
                    {item.direction} · 上 {item.uploadRate} · 下{" "}
                    {item.downloadRate} · 合计 {item.totalRate} ·{" "}
                    {item.localPortLabel} · {item.lastSeenLabel}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

        <SectionCard
        eyebrow={pageCopy.alerts.eyebrow}
        title={pageCopy.alerts.title}
        summary={pageCopy.alerts.summary}
      >
        {detail.recentAlerts.length === 0 ? (
          <div className="page-note">{pageCopy.alerts.empty}</div>
        ) : (
          <div className="list-block">
            {detail.recentAlerts.map((item) => (
              <div className="list-item" key={item}>
                <strong>{pageCopy.alerts.itemTitle}</strong>
                <span>{item}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function getProcessDetailNotice(
  runtime: DashboardRuntimeView,
  selectedProcessId: number | null,
) {
  if (runtime.errorMessage) {
    return {
      tone: "error" as const,
      title: GAL_NOTICE_COPY.processDetail.errorTitle,
      message: runtime.errorMessage,
    };
  }

  if (selectedProcessId === null) {
    return {
      tone: "normal" as const,
      title: GAL_NOTICE_COPY.processDetail.unselectedTitle,
      message: GAL_NOTICE_COPY.processDetail.unselectedMessage,
    };
  }

  if (runtime.isLoading) {
    return {
      tone: "normal" as const,
      title: GAL_NOTICE_COPY.processDetail.loadingTitle,
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
