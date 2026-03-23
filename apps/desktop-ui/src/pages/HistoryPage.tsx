import { useState } from "react";

import type { AgentHistoryQuery } from "../bridge/desktopBridge";
import MetricChip from "../components/common/MetricChip";
import SectionCard from "../components/common/SectionCard";
import {
  GAL_ACTION_COPY,
  GAL_METRIC_LABELS,
  GAL_NOTICE_COPY,
  GAL_PAGE_COPY,
  GAL_TABLE_HEADERS,
} from "../copy/galAbstract";
import { useHistoryData } from "../hooks/useHistoryData";
import type { DashboardRuntimeView, HistoryPageView } from "../types/appData";

interface HistoryFilterDraft {
  processName: string;
  target: string;
  port: string;
  direction: "all" | "outbound" | "inbound";
  startedAfter: string;
  endedBefore: string;
  limit: string;
  includeLanTraffic: boolean;
}

const DEFAULT_LIMIT = "20";

interface HistoryPageProps {
  selectedProcessId: number | null;
  onInspectProcess: (pid: number) => void;
}

export default function HistoryPage({
  selectedProcessId,
  onInspectProcess,
}: HistoryPageProps) {
  const [draft, setDraft] = useState<HistoryFilterDraft>({
    processName: "",
    target: "",
    port: "",
    direction: "all",
    startedAfter: "",
    endedBefore: "",
    limit: DEFAULT_LIMIT,
    includeLanTraffic: false,
  });
  const [query, setQuery] = useState<AgentHistoryQuery>({
    limit: Number(DEFAULT_LIMIT),
    offset: 0,
    includeLanTraffic: false,
  });
  const [lastExportLabel, setLastExportLabel] = useState<string | null>(null);
  const { history, runtime, refresh } = useHistoryData(query);
  const notice = getHistoryNotice(runtime);
  const hasPreviousPage = history.offset > 0;
  const hasNextPage = history.offset + history.items.length < history.total;
  const visibleStart = history.total === 0 ? 0 : history.offset + 1;
  const visibleEnd = history.offset + history.items.length;
  const canExport = history.items.length > 0;
  const metricLabels = GAL_METRIC_LABELS.history;
  const pageCopy = GAL_PAGE_COPY.history;
  const tableHeaders = GAL_TABLE_HEADERS.history;

  return (
    <div className="app-main">
      <section className="app-panel">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">{history.cycleLabel}</p>
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
                ? GAL_ACTION_COPY.historyRefresh.busy
                : GAL_ACTION_COPY.historyRefresh.idle}
            </button>
            <div className="metric-row">
              <MetricChip label={metricLabels.total} value={`${history.total}`} />
              <MetricChip
                label={metricLabels.pageSize}
                value={`${history.items.length}`}
              />
              <MetricChip
                label={metricLabels.page}
                value={`${Math.floor(history.offset / Math.max(1, history.limit)) + 1}`}
              />
              <MetricChip
                label={metricLabels.selectedPid}
                value={selectedProcessId === null ? "-" : String(selectedProcessId)}
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
        eyebrow={pageCopy.filters.eyebrow}
        title={pageCopy.filters.title}
        summary={pageCopy.filters.summary}
      >
        <form
          className="filters-grid"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(buildHistoryQuery(draft));
          }}
        >
          <label className="field-group">
            <span className="field-label">{pageCopy.filters.processName}</span>
            <input
              className="field-input"
              value={draft.processName}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  processName: event.target.value,
                }))
              }
              placeholder={pageCopy.filters.placeholders.processName}
            />
          </label>

          <label className="field-group">
            <span className="field-label">{pageCopy.filters.target}</span>
            <input
              className="field-input"
              value={draft.target}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  target: event.target.value,
                }))
              }
              placeholder={pageCopy.filters.placeholders.target}
            />
          </label>

          <label className="field-group">
            <span className="field-label">{pageCopy.filters.port}</span>
            <input
              className="field-input"
              inputMode="numeric"
              value={draft.port}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  port: event.target.value,
                }))
              }
              placeholder={pageCopy.filters.placeholders.port}
            />
          </label>

          <label className="field-group">
            <span className="field-label">{pageCopy.filters.direction}</span>
            <select
              className="field-input"
              value={draft.direction}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  direction: event.target.value as HistoryFilterDraft["direction"],
                }))
              }
            >
              <option value="all">{pageCopy.filters.directions.all}</option>
              <option value="outbound">{pageCopy.filters.directions.outbound}</option>
              <option value="inbound">{pageCopy.filters.directions.inbound}</option>
            </select>
          </label>

          <label className="field-group">
            <span className="field-label">{pageCopy.filters.startedAfter}</span>
            <input
              className="field-input"
              type="datetime-local"
              value={draft.startedAfter}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  startedAfter: event.target.value,
                }))
              }
            />
          </label>

          <label className="field-group">
            <span className="field-label">{pageCopy.filters.endedBefore}</span>
            <input
              className="field-input"
              type="datetime-local"
              value={draft.endedBefore}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  endedBefore: event.target.value,
                }))
              }
            />
          </label>

          <label className="field-group">
            <span className="field-label">{pageCopy.filters.limit}</span>
            <select
              className="field-input"
              value={draft.limit}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  limit: event.target.value,
                }))
              }
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={draft.includeLanTraffic}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  includeLanTraffic: event.target.checked,
                }))
              }
            />
            <span>{pageCopy.filters.includeLanTraffic}</span>
          </label>

          <div className="inline-actions">
            <button className="action-button" type="submit">
              {GAL_ACTION_COPY.historyApply}
            </button>
            <button
              className="table-action"
              type="button"
              onClick={() => {
                const resetDraft = createDefaultDraft();
                setDraft(resetDraft);
                setQuery(buildHistoryQuery(resetDraft));
              }}
            >
              {GAL_ACTION_COPY.historyReset}
            </button>
          </div>
        </form>

        <div className="pagination-row">
          <span className="table-subcopy">
            {pageCopy.page.visiblePrefix} {visibleStart}
            {" - "}
            {visibleEnd} / {history.total}
          </span>
          <div className="inline-actions">
            <button
              className="table-action"
              type="button"
              disabled={!canExport}
              onClick={() => {
                exportHistoryPage({
                  format: "json",
                  history,
                  query,
                  runtime,
                });
                setLastExportLabel(buildExportStatusLabel("JSON", history.items.length));
              }}
              title={pageCopy.page.exportJsonTitle}
            >
              {GAL_ACTION_COPY.historyExportJson}
            </button>
            <button
              className="table-action"
              type="button"
              disabled={!canExport}
              onClick={() => {
                exportHistoryPage({
                  format: "csv",
                  history,
                  query,
                  runtime,
                });
                setLastExportLabel(buildExportStatusLabel("CSV", history.items.length));
              }}
              title={pageCopy.page.exportCsvTitle}
            >
              {GAL_ACTION_COPY.historyExportCsv}
            </button>
            <button
              className="table-action"
              type="button"
              disabled={!hasPreviousPage}
              onClick={() => {
                setQuery((current) => ({
                  ...current,
                  offset: Math.max(0, (current.offset ?? 0) - (current.limit ?? 20)),
                }));
              }}
            >
              {GAL_ACTION_COPY.historyPrev}
            </button>
            <button
              className="table-action"
              type="button"
              disabled={!hasNextPage}
              onClick={() => {
                setQuery((current) => ({
                  ...current,
                  offset: (current.offset ?? 0) + (current.limit ?? 20),
                }));
              }}
            >
              {GAL_ACTION_COPY.historyNext}
            </button>
          </div>
        </div>
        <p className="table-subcopy">
          {pageCopy.page.exportHintPrefix} {history.items.length}{" "}
          {pageCopy.page.exportHintSuffix}
          {lastExportLabel ? ` ${pageCopy.page.exportRecentPrefix}${lastExportLabel}` : ""}
        </p>

        {history.items.length === 0 ? (
          <div className="page-note">{pageCopy.page.empty}</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{tableHeaders.process}</th>
                <th>{tableHeaders.target}</th>
                <th>{tableHeaders.direction}</th>
                <th>{tableHeaders.protocol}</th>
                <th>{tableHeaders.time}</th>
                <th>{tableHeaders.traffic}</th>
                <th>{tableHeaders.action}</th>
              </tr>
            </thead>
            <tbody>
              {history.items.map((item) => (
                <tr
                  key={item.sessionId}
                  className={
                    item.pid !== null && item.pid === selectedProcessId
                      ? "table-row-selected"
                      : ""
                  }
                >
                  <td>
                    {item.processName}
                    <br />
                    <span className="table-subcopy">
                      {item.pid === null ? pageCopy.page.pidUnknown : `PID ${item.pid}`}
                    </span>
                  </td>
                  <td>{item.target}</td>
                  <td>{item.direction}</td>
                  <td>{item.protocol}</td>
                  <td>{item.timeLabel}</td>
                  <td>{item.traffic}</td>
                  <td>
                    <button
                      className="table-action"
                      type="button"
                      onClick={() => {
                        if (item.pid !== null) {
                          onInspectProcess(item.pid);
                        }
                      }}
                      disabled={item.pid === null}
                      title={
                        item.pid === null
                          ? pageCopy.page.inspectMissingTitle
                          : `${pageCopy.page.inspectTitlePrefix} ${item.pid}`
                      }
                    >
                      {item.pid === null
                        ? GAL_ACTION_COPY.historyInspectMissing
                        : GAL_ACTION_COPY.historyInspect}
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

function getHistoryNotice(runtime: DashboardRuntimeView) {
  if (runtime.errorMessage) {
    return {
      tone: "error" as const,
      title: GAL_NOTICE_COPY.history.errorTitle,
      message: runtime.errorMessage,
    };
  }

  if (runtime.isLoading) {
    return {
      tone: "normal" as const,
      title: GAL_NOTICE_COPY.history.loadingTitle,
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

function createDefaultDraft(): HistoryFilterDraft {
  return {
    processName: "",
    target: "",
    port: "",
    direction: "all",
    startedAfter: "",
    endedBefore: "",
    limit: DEFAULT_LIMIT,
    includeLanTraffic: false,
  };
}

function buildHistoryQuery(draft: HistoryFilterDraft): AgentHistoryQuery {
  return {
    processName: emptyToUndefined(draft.processName),
    target: emptyToUndefined(draft.target),
    port: parseOptionalNumber(draft.port),
    direction: draft.direction === "all" ? undefined : draft.direction,
    startedAfter: parseDateTimeToMillis(draft.startedAfter),
    endedBefore: parseDateTimeToMillis(draft.endedBefore),
    limit: parseOptionalNumber(draft.limit) ?? Number(DEFAULT_LIMIT),
    offset: 0,
    includeLanTraffic: draft.includeLanTraffic,
  };
}

function emptyToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseOptionalNumber(value: string): number | undefined {
  if (value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseDateTimeToMillis(value: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : undefined;
}

function exportHistoryPage(options: {
  format: "json" | "csv";
  history: HistoryPageView;
  query: AgentHistoryQuery;
  runtime: DashboardRuntimeView;
}) {
  if (typeof window === "undefined" || options.history.items.length === 0) {
    return;
  }

  const timestamp = new Date();
  const fileBaseName = buildExportFileBaseName(timestamp);
  const download = document.createElement("a");
  let content = "";
  let mimeType = "application/json;charset=utf-8";
  let fileName = `${fileBaseName}.json`;

  if (options.format === "json") {
    content = JSON.stringify(buildHistoryJsonExport(options, timestamp), null, 2);
  } else {
    content = buildHistoryCsvExport(options.history);
    mimeType = "text/csv;charset=utf-8";
    fileName = `${fileBaseName}.csv`;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  download.href = url;
  download.download = fileName;
  download.click();
  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 0);
}

function buildHistoryJsonExport(
  options: {
    history: HistoryPageView;
    query: AgentHistoryQuery;
    runtime: DashboardRuntimeView;
  },
  timestamp: Date,
) {
  return {
    exported_at: timestamp.toISOString(),
    source_label: options.runtime.sourceLabel,
    runtime_mode: options.runtime.mode,
    filters: serializeHistoryQuery(options.query),
    page: {
      total: options.history.total,
      limit: options.history.limit,
      offset: options.history.offset,
      items_on_page: options.history.items.length,
    },
    items: options.history.items.map((item) => ({
      session_id: item.sessionId,
      process_name: item.processName,
      pid: item.pid,
      target: item.target,
      direction: item.direction,
      protocol: item.protocol,
      time_label: item.timeLabel,
      traffic: item.traffic,
    })),
  };
}

function buildHistoryCsvExport(history: HistoryPageView) {
  const header = [
    "session_id",
    "process_name",
    "pid",
    "target",
    "direction",
    "protocol",
    "time_label",
    "traffic",
  ];
  const lines = history.items.map((item) =>
    [
      item.sessionId,
      item.processName,
      item.pid === null ? "" : String(item.pid),
      item.target,
      item.direction,
      item.protocol,
      item.timeLabel,
      item.traffic,
    ]
      .map(escapeCsvCell)
      .join(","),
  );

  return [header.join(","), ...lines].join("\n");
}

function serializeHistoryQuery(query: AgentHistoryQuery) {
  return {
    process_name: query.processName ?? null,
    target: query.target ?? null,
    port: query.port ?? null,
    direction: query.direction ?? null,
    started_after: query.startedAfter ?? null,
    ended_before: query.endedBefore ?? null,
    limit: query.limit ?? null,
    offset: query.offset ?? null,
    include_lan_traffic: query.includeLanTraffic ?? false,
  };
}

function buildExportStatusLabel(format: "JSON" | "CSV", count: number) {
  return `${format} · ${count} 条 · ${formatClock(new Date())}`;
}

function buildExportFileBaseName(timestamp: Date) {
  const stamp = [
    timestamp.getFullYear(),
    String(timestamp.getMonth() + 1).padStart(2, "0"),
    String(timestamp.getDate()).padStart(2, "0"),
    "-",
    String(timestamp.getHours()).padStart(2, "0"),
    String(timestamp.getMinutes()).padStart(2, "0"),
    String(timestamp.getSeconds()).padStart(2, "0"),
  ].join("");

  return `traffic-cat-history-page-${stamp}`;
}

function formatClock(timestamp: Date) {
  return [
    String(timestamp.getHours()).padStart(2, "0"),
    String(timestamp.getMinutes()).padStart(2, "0"),
    String(timestamp.getSeconds()).padStart(2, "0"),
  ].join(":");
}

function escapeCsvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
