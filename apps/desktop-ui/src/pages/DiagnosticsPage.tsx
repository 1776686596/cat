import MetricChip from "../components/common/MetricChip";
import SectionCard from "../components/common/SectionCard";
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

  return (
    <div className="app-main">
      <section className="app-panel">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">{snapshot.cycleLabel}</p>
            <h2>诊断页</h2>
            <p className="page-copy">
              守护进程离线、权限不足、采集回退都会优先落到这里。
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
                void onRefresh();
              }}
              disabled={runtime.isRefreshing}
            >
              {runtime.isRefreshing ? "刷新中..." : "重试连接"}
            </button>
            <div className="metric-row">
              <MetricChip label="agentd" value={snapshot.agentStatus} />
              <MetricChip label="采集模式" value={snapshot.captureMode} />
              <MetricChip label="数据库" value={snapshot.databaseStatus} />
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
          eyebrow="连接状态"
          title="UI 与 agentd"
          summary="后续会展示 UDS 连接结果、最近成功通信时间和错误原因。"
          badge={snapshot.socketPath}
          badgeTone="warn"
        >
          <div className="page-note">
            {snapshot.degradedReason ?? "当前未报告降级原因。"}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="权限与能力"
          title="采集前置条件"
          summary="这里会明确提示 sudo / capability 缺失，而不是伪造空数据。"
        >
          <div className="list-item">
            <strong>不可用时要说清楚</strong>
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
      title: "诊断桥接异常",
      message: runtime.errorMessage,
    };
  }

  if (runtime.isLoading) {
    return {
      tone: "normal" as const,
      title: "正在探测 agentd",
      message: "前端正在等待桥接层返回健康检查与状态快照。",
    };
  }

  if (runtime.mode === "mock") {
    return {
      tone: "normal" as const,
      title: "当前展示模拟诊断",
      message: "当前诊断信息来自开发桥接快照，只用于验证页面承接，不代表真实宿主状态。",
    };
  }

  if (runtime.isFallback) {
    return {
      tone: "normal" as const,
      title: "当前展示回退诊断",
      message: "真实桥接未接管前，页面使用兜底状态提示接入缺口。",
    };
  }

  return null;
}
