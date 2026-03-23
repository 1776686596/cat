import MetricChip from "../components/common/MetricChip";
import SectionCard from "../components/common/SectionCard";
import {
  GAL_ACTION_COPY,
  GAL_METRIC_LABELS,
  GAL_NOTICE_COPY,
  GAL_PAGE_COPY,
  GAL_TABLE_HEADERS,
  getRuntimeModeLabel,
} from "../copy/galAbstract";
import { useProcessesData } from "../hooks/useProcessesData";
import type { DashboardRuntimeView } from "../types/appData";

interface ProcessesPageProps {
  selectedProcessId: number | null;
  onInspectProcess: (pid: number) => void;
}

export default function ProcessesPage({
  selectedProcessId,
  onInspectProcess,
}: ProcessesPageProps) {
  const { processes, runtime, refresh } = useProcessesData();
  const notice = getProcessesNotice(runtime);
  const metricLabels = GAL_METRIC_LABELS.processes;
  const pageCopy = GAL_PAGE_COPY.processes;
  const tableHeaders = GAL_TABLE_HEADERS.processes;

  return (
    <div className="app-main">
      <section className="app-panel">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">{processes.cycleLabel}</p>
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
              disabled={runtime.isRefreshing}
            >
              {runtime.isRefreshing
                ? GAL_ACTION_COPY.processesRefresh.busy
                : GAL_ACTION_COPY.processesRefresh.idle}
            </button>
            <div className="metric-row">
              <MetricChip
                label={metricLabels.processCount}
                value={`${processes.items.length}`}
              />
              <MetricChip
                label={metricLabels.selectedPid}
                value={selectedProcessId === null ? "-" : String(selectedProcessId)}
              />
              <MetricChip
                label={metricLabels.source}
                value={getRuntimeModeLabel(runtime.mode)}
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

      <SectionCard
        eyebrow={pageCopy.table.eyebrow}
        title={pageCopy.table.title}
        summary={pageCopy.table.summary}
      >
        {processes.items.length === 0 ? (
          <div className="page-note">{pageCopy.table.empty}</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{tableHeaders.process}</th>
                <th>{tableHeaders.traffic}</th>
                <th>{tableHeaders.destinations}</th>
                <th>{tableHeaders.lastActive}</th>
                <th>{tableHeaders.alert}</th>
                <th>{tableHeaders.action}</th>
              </tr>
            </thead>
            <tbody>
              {processes.items.map((item) => (
                <tr
                  key={item.pid}
                  className={item.pid === selectedProcessId ? "table-row-selected" : ""}
                >
                  <td>
                    {item.processName}
                    <br />
                    <span className="table-subcopy">{`PID ${item.pid}`}</span>
                  </td>
                  <td>{item.totalTraffic}</td>
                  <td>{item.destinationCount}</td>
                  <td>{item.lastActiveLabel}</td>
                  <td>{item.alertLabel}</td>
                  <td>
                    <button
                      className="table-action"
                      type="button"
                      onClick={() => onInspectProcess(item.pid)}
                    >
                      {GAL_ACTION_COPY.processInspect}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}

function getProcessesNotice(runtime: DashboardRuntimeView) {
  if (runtime.errorMessage) {
    return {
      tone: "error" as const,
      title: GAL_NOTICE_COPY.processes.errorTitle,
      message: runtime.errorMessage,
    };
  }

  if (runtime.isLoading) {
    return {
      tone: "normal" as const,
      title: GAL_NOTICE_COPY.processes.loadingTitle,
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
