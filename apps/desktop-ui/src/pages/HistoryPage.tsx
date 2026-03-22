import { useState } from "react";

import type { AgentHistoryQuery } from "../bridge/desktopBridge";
import MetricChip from "../components/common/MetricChip";
import SectionCard from "../components/common/SectionCard";
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

  return (
    <div className="app-main">
      <section className="app-panel">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">{history.cycleLabel}</p>
            <h2>历史检索</h2>
            <p className="page-copy">
              当前已经支持组合过滤与分页，带 PID 的记录还能直接跳到单进程详情页。
            </p>
            <p className="page-copy">
              数据来源：{runtime.sourceLabel} · {runtime.lastUpdatedLabel}
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
              {runtime.isRefreshing ? "刷新中..." : "刷新历史"}
            </button>
            <div className="metric-row">
              <MetricChip label="总会话" value={`${history.total}`} />
              <MetricChip label="本页条数" value={`${history.items.length}`} />
              <MetricChip
                label="分页"
                value={`${Math.floor(history.offset / Math.max(1, history.limit)) + 1}`}
              />
              <MetricChip
                label="已选 PID"
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
        eyebrow="过滤条件"
        title="最近历史会话"
        summary="支持进程名、目标、端口、方向、时间范围和局域网开关，翻页和导出时都会保留当前筛选条件。"
      >
        <form
          className="filters-grid"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(buildHistoryQuery(draft));
          }}
        >
          <label className="field-group">
            <span className="field-label">进程名</span>
            <input
              className="field-input"
              value={draft.processName}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  processName: event.target.value,
                }))
              }
              placeholder="firefox / syncthing"
            />
          </label>

          <label className="field-group">
            <span className="field-label">目标</span>
            <input
              className="field-input"
              value={draft.target}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  target: event.target.value,
                }))
              }
              placeholder="域名或 IP"
            />
          </label>

          <label className="field-group">
            <span className="field-label">端口</span>
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
              placeholder="443"
            />
          </label>

          <label className="field-group">
            <span className="field-label">方向</span>
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
              <option value="all">全部</option>
              <option value="outbound">上行</option>
              <option value="inbound">下行</option>
            </select>
          </label>

          <label className="field-group">
            <span className="field-label">开始时间</span>
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
            <span className="field-label">结束时间</span>
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
            <span className="field-label">每页条数</span>
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
            <span>包含局域网流量</span>
          </label>

          <div className="inline-actions">
            <button className="action-button" type="submit">
              应用筛选
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
              重置
            </button>
          </div>
        </form>

        <div className="pagination-row">
          <span className="table-subcopy">
            当前显示 {visibleStart}
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
              title="导出当前页筛选结果为 JSON"
            >
              导出 JSON
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
              title="导出当前页筛选结果为 CSV"
            >
              导出 CSV
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
              上一页
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
              下一页
            </button>
          </div>
        </div>
        <p className="table-subcopy">
          导出只包含当前页已加载的 {history.items.length} 条记录，文件里会保留当前筛选参数。
          {lastExportLabel ? ` 最近导出：${lastExportLabel}` : ""}
        </p>

        {history.items.length === 0 ? (
          <div className="page-note">
            当前没有历史会话，可能是 agentd 还未累计到可展示的数据。
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>进程</th>
                <th>目标</th>
                <th>方向</th>
                <th>协议</th>
                <th>时间</th>
                <th>累计流量</th>
                <th>操作</th>
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
                      {item.pid === null ? "PID 未知" : `PID ${item.pid}`}
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
                          ? "当前历史记录缺少 PID，暂时无法查看详情。"
                          : `查看 PID ${item.pid} 的详情`
                      }
                    >
                      {item.pid === null ? "PID 缺失" : "查看详情"}
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
      title: "历史桥接异常",
      message: runtime.errorMessage,
    };
  }

  if (runtime.isLoading) {
    return {
      tone: "normal" as const,
      title: "正在同步历史分页",
      message: "前端正在等待 agentd 返回历史会话列表。",
    };
  }

  if (runtime.mode === "mock") {
    return {
      tone: "normal" as const,
      title: "当前展示模拟历史",
      message: "历史结果来自开发桥接快照，筛选和分页链路可验证，但不代表真实会话。",
    };
  }

  if (runtime.isFallback) {
    return {
      tone: "normal" as const,
      title: "当前展示回退历史",
      message: "桥接未接管时，页面会展示本地示例会话结构。",
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
