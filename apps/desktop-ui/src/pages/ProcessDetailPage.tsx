import MetricChip from "../components/common/MetricChip";
import SectionCard from "../components/common/SectionCard";
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

  return (
    <div className="app-main">
      <section className="app-panel">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">{detail.cycleLabel}</p>
            <h2>单进程详情</h2>
            <p className="page-copy">
              当前页面会根据上一个页面选中的 PID 拉取真实详情，没有选中时就提示回到进程页。
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
              disabled={runtime.isRefreshing || selectedProcessId === null}
            >
              {runtime.isRefreshing ? "刷新中..." : "刷新详情"}
            </button>
            <div className="metric-row">
              <MetricChip
                label="PID"
                value={detail.pid === null ? "-" : String(detail.pid)}
              />
              <MetricChip label="最近活跃" value={detail.lastActiveLabel} />
              <MetricChip label="累计流量" value={detail.totalTraffic} />
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
          eyebrow="基础信息"
          title="进程画像"
          summary="当前先承接 PID、进程名、最近活跃时间和累计流量。"
        >
          <div className="page-note">
            {detail.pid === null ? (
              "先到进程页选择一个 PID，这里再展示详情。"
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
          eyebrow="活跃连接"
          title="当前进程会话"
          summary="先展示当前活跃连接和速率，时间线事件下一周期再拆。"
          badge={
            detail.pid === null
              ? "等待选择"
              : `${detail.activeConnections.length} 条连接`
          }
          badgeTone={detail.pid === null ? "warn" : "normal"}
        >
          {detail.activeConnections.length === 0 ? (
            <div className="page-note">
              当前没有可展示的活跃连接，可能进程已进入空闲状态。
            </div>
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
        eyebrow="相关告警"
        title="最近触发记录"
        summary="优先展示最近告警摘要，避免进到详情页还要再跳诊断页。"
      >
        {detail.recentAlerts.length === 0 ? (
          <div className="page-note">当前没有相关告警。</div>
        ) : (
          <div className="list-block">
            {detail.recentAlerts.map((item) => (
              <div className="list-item" key={item}>
                <strong>最近告警</strong>
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
      title: "详情桥接异常",
      message: runtime.errorMessage,
    };
  }

  if (selectedProcessId === null) {
    return {
      tone: "normal" as const,
      title: "尚未选择进程",
      message: "回到进程聚合页点一条 PID，这里才会加载对应详情。",
    };
  }

  if (runtime.isLoading) {
    return {
      tone: "normal" as const,
      title: "正在同步详情",
      message: "前端正在等待 agentd 返回指定 PID 的详情。",
    };
  }

  if (runtime.mode === "mock") {
    return {
      tone: "normal" as const,
      title: "当前展示模拟详情",
      message: "你现在看到的是开发桥接生成的示例详情，不代表该 PID 的真实运行状态。",
    };
  }

  if (runtime.isFallback) {
    return {
      tone: "normal" as const,
      title: "当前展示回退详情",
      message: "桥接未接管时，页面会保留详情回退结构方便联调。",
    };
  }

  return null;
}
