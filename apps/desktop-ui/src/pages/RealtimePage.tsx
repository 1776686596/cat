import { buildAppUrl } from "../app/windowMode";
import MetricChip from "../components/common/MetricChip";
import SectionCard from "../components/common/SectionCard";
import TrafficWidgetCard from "../components/widget/TrafficWidgetCard";
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
      <section className="app-panel">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">{snapshot.cycleLabel}</p>
            <h2>实时流向</h2>
            <p className="page-copy">
              当前页面会优先读取桌面桥接数据；如果你只是单独启动前端开发服务，
              这里展示的就是模拟快照。
            </p>
            <p className="page-copy">
              如果当前采集模式是 <code>proc_fallback</code>，顶部速率会优先按
              TCP_INFO 累计字节差分估算 TCP 连接；QUIC/UDP 暂时没有同等级别的
              内核累计字节，因此仍不等同于 eBPF 精度。
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
              {runtime.isLoading
                ? "首屏加载中..."
                : runtime.isRefreshing
                  ? "刷新中..."
                  : "刷新快照"}
            </button>
            <div className="metric-row">
              <MetricChip label="上行" value={snapshot.uploadRate} />
              <MetricChip label="下行" value={snapshot.downloadRate} />
              <MetricChip label="主状态" value={snapshot.widgetState} />
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

      <div className="realtime-layout">
        <section className="widget-preview-section">
          <div className="widget-preview-copy">
            <p className="page-eyebrow">挂件预览</p>
            <h3>右下角的小猫，现在更像一个轻盈的桌面挂件</h3>
            <p className="section-summary">
              默认只保留状态、上/下行和一条摘要；悬停时再展开最近 3
              条活跃流量，避免把角落挂件做成一张缩水监控卡片。
            </p>

            <div className="widget-preview-points">
              <div className="widget-preview-point">
                <strong>默认态</strong>
                <span>固定单行摘要，目标地址空间不足时直接裁剪，不换行。</span>
              </div>
              <div className="widget-preview-point">
                <strong>悬停态</strong>
                <span>展开最重要的 3 条实时流量，只保留进程、目标和速率。</span>
              </div>
              <div className="widget-preview-point">
                <strong>当前快照</strong>
                <span>
                  主状态 {snapshot.widgetState} · 采集模式 {snapshot.captureMode}
                </span>
              </div>
            </div>
          </div>

          <TrafficWidgetCard
            snapshot={snapshot}
            runtime={runtime}
            mode="panel"
            primaryActionLabel="新窗口预览挂件"
            onPrimaryAction={openWidgetPreview}
            onRefresh={onRefresh}
            refreshDisabled={runtime.isRefreshing}
          />
        </section>

        <SectionCard
          eyebrow="活跃连接"
          title="当前热点流量"
          summary="顶部上下行汇总全部活跃连接；下面逐条拆开展示上行、下行和合计速率，便于对账。"
          badge={`${snapshot.activeConnections.length} 条活跃连接`}
        >
          {snapshot.activeConnections.length === 0 ? (
            <div className="page-note">
              当前没有可展示的活跃连接，等待下一次成功同步。
            </div>
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
                      ? " · 速率覆盖受限"
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
      title: "实时桥接异常",
      message: runtime.errorMessage,
    };
  }

  if (runtime.isLoading) {
    return {
      tone: "normal" as const,
      title: "正在同步首屏快照",
      message: "前端正在等待 agentd 首次返回实时数据。",
    };
  }

  if (runtime.mode === "mock") {
    return {
      tone: "normal" as const,
      title: "当前展示模拟快照",
      message: "你现在运行的是前端开发模式，实时列表和顶部速率都来自 mock bridge。",
    };
  }

  if (runtime.isFallback) {
    return {
      tone: "normal" as const,
      title: "当前展示回退快照",
      message: "真实桥接尚未接管，页面使用本地兜底数据保持结构稳定。",
    };
  }

  if (snapshot.captureMode === "proc_fallback" && isZeroThroughputSnapshot(snapshot)) {
    return {
      tone: "normal" as const,
      title: "当前只拿到了连接，没拿到字节计数",
      message:
        "你现在看到的是 /proc 回退采集结果。普通用户运行时，很多进程的 TCP_INFO 无法读取，所以连接列表能出来，但顶部速率、连接速率和进程累计流量可能长期是 0。要验证真实速率，请用 sudo 或带 capability 的方式运行 agentd。",
    };
  }

  if (
    snapshot.captureMode === "proc_fallback" &&
    snapshot.activeConnections.some((item) => item.protocol === "UDP")
  ) {
    return {
      tone: "normal" as const,
      title: "检测到 UDP 活跃连接",
      message:
        "当前仍处于 /proc 回退采集，UDP/QUIC 缺少 TCP_INFO 这类累计字节；顶部总速率可能偏低，直播和 HTTP/3 场景最明显。",
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
