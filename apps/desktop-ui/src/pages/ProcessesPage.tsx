import MetricChip from "../components/common/MetricChip";
import SectionCard from "../components/common/SectionCard";
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

  return (
    <div className="app-main">
      <section className="app-panel">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">{processes.cycleLabel}</p>
            <h2>按进程聚合</h2>
            <p className="page-copy">
              当前页面已经接到进程聚合桥接，点击“查看详情”会把选中的
              PID 带到详情页。
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
              {runtime.isRefreshing ? "刷新中..." : "刷新列表"}
            </button>
            <div className="metric-row">
              <MetricChip label="进程数" value={`${processes.items.length}`} />
              <MetricChip
                label="已选 PID"
                value={selectedProcessId === null ? "-" : String(selectedProcessId)}
              />
              <MetricChip
                label="数据源"
                value={getRuntimeModeLabel(runtime)}
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
        eyebrow="聚合列表"
        title="进程流量总览"
        summary="累计流量、目标数量、最近活跃时间和告警标记都会在这里展示。"
      >
        {processes.items.length === 0 ? (
          <div className="page-note">
            当前没有可展示的进程聚合结果，等待下一次成功同步。
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>进程</th>
                <th>累计流量</th>
                <th>目标数量</th>
                <th>最近活跃</th>
                <th>提醒标记</th>
                <th>操作</th>
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
                    <span className="table-subcopy">PID {item.pid}</span>
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
                      查看详情
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
      title: "进程桥接异常",
      message: runtime.errorMessage,
    };
  }

  if (runtime.isLoading) {
    return {
      tone: "normal" as const,
      title: "正在同步进程聚合",
      message: "前端正在等待 agentd 返回最新进程统计。",
    };
  }

  if (runtime.mode === "mock") {
    return {
      tone: "normal" as const,
      title: "当前展示模拟聚合",
      message: "当前列表来自开发桥接快照，适合联调页面，不代表真实进程流量。",
    };
  }

  if (runtime.isFallback) {
    return {
      tone: "normal" as const,
      title: "当前展示回退聚合",
      message: "桥接未接管时，页面会保留回退进程列表方便继续联调。",
    };
  }

  return null;
}

function getRuntimeModeLabel(runtime: DashboardRuntimeView) {
  switch (runtime.mode) {
    case "live":
      return "agentd";
    case "mock":
      return "模拟";
    case "fallback":
      return "回退";
    case "connecting":
      return "连接中";
    case "disabled":
      return "未启用";
  }
}
