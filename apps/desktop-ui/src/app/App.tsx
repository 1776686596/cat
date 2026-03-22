import { useState } from "react";

import { NAV_ITEMS, type AppView } from "./navigation";
import { useDashboardData } from "../hooks/useDashboardData";
import DiagnosticsPage from "../pages/DiagnosticsPage";
import HistoryPage from "../pages/HistoryPage";
import ProcessDetailPage from "../pages/ProcessDetailPage";
import ProcessesPage from "../pages/ProcessesPage";
import RealtimePage from "../pages/RealtimePage";

const PAGE_TITLES: Record<AppView, string> = {
  realtime: "实时流向与挂件入口",
  processes: "进程聚合概览",
  "process-detail": "单进程时间线",
  history: "历史过滤与导出",
  diagnostics: "权限与连接诊断",
};

interface DashboardAppProps {
  initialView?: Extract<AppView, "realtime" | "processes" | "history" | "diagnostics">;
}

export default function App({
  initialView = "realtime",
}: DashboardAppProps) {
  const [activeView, setActiveView] = useState<AppView>(initialView);
  const [selectedProcessId, setSelectedProcessId] = useState<number | null>(null);
  const { dashboardData, runtime, refresh } = useDashboardData();
  const processDetailLocked = selectedProcessId === null;
  const inspectProcess = (pid: number) => {
    setSelectedProcessId(pid);
    setActiveView("process-detail");
  };

  let activePage = (
    <RealtimePage
      snapshot={dashboardData.realtime}
      runtime={runtime}
      onRefresh={refresh}
    />
  );
  switch (activeView) {
    case "realtime":
      activePage = (
        <RealtimePage
          snapshot={dashboardData.realtime}
          runtime={runtime}
          onRefresh={refresh}
        />
      );
      break;
    case "processes":
      activePage = (
        <ProcessesPage
          selectedProcessId={selectedProcessId}
          onInspectProcess={inspectProcess}
        />
      );
      break;
    case "process-detail":
      activePage = <ProcessDetailPage selectedProcessId={selectedProcessId} />;
      break;
    case "history":
      activePage = (
        <HistoryPage
          selectedProcessId={selectedProcessId}
          onInspectProcess={inspectProcess}
        />
      );
      break;
    case "diagnostics":
      activePage = (
        <DiagnosticsPage
          snapshot={dashboardData.diagnostics}
          runtime={runtime}
          onRefresh={refresh}
        />
      );
      break;
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="brand-block">
          <span className="brand-chip">traffic-cat</span>
          <h1>Linux 桌面后台流量观测器</h1>
          <p>
            第一个开发周期先把共享类型和 UI 主骨架打稳，后续接入
            agentd 时不再返工页面结构。
          </p>
        </div>

        <nav className="nav-list" aria-label="主导航">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={[
                "nav-button",
                activeView === item.key ? "is-active" : "",
                item.key === "process-detail" && processDetailLocked ? "is-disabled" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              type="button"
              onClick={() => setActiveView(item.key)}
              disabled={item.key === "process-detail" && processDetailLocked}
              title={
                item.key === "process-detail" && processDetailLocked
                  ? "先到进程聚合页选择一个 PID"
                  : undefined
              }
            >
              <span className="nav-label">{item.label}</span>
              <span className="nav-copy">{item.copy}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <p className="page-eyebrow">数据链路</p>
          <p className="section-summary">{runtime.sourceLabel}</p>
          <p className="sidebar-meta">{runtime.lastUpdatedLabel}</p>
          <button
            className="action-button"
            type="button"
            onClick={() => {
              void refresh();
            }}
            disabled={runtime.isRefreshing}
          >
            {runtime.isRefreshing ? "刷新中..." : "立即刷新"}
          </button>
          {runtime.errorMessage ? (
            <p className="sidebar-warning">{runtime.errorMessage}</p>
          ) : null}
          {selectedProcessId !== null ? (
            <p className="sidebar-meta">当前选中 PID {selectedProcessId}</p>
          ) : (
            <p className="sidebar-warning">
              进程详情页需要先在“进程聚合”里选择一个 PID。
            </p>
          )}

          <p className="page-eyebrow">当前焦点</p>
          <p className="section-summary">{PAGE_TITLES[activeView]}</p>
        </div>
      </aside>

      <div className="app-content">
        {renderRuntimeBanner(runtime)}
        {activePage}
      </div>
    </div>
  );
}

function renderRuntimeBanner(runtime: ReturnType<typeof useDashboardData>["runtime"]) {
  if (runtime.mode === "mock") {
    return (
      <section className="global-banner is-warn">
        <strong>当前展示的是模拟数据</strong>
        <span>
          你现在运行的是纯前端开发模式，顶部速率、进程和告警来自开发桥接快照，
          不代表本机实时网络流量。
        </span>
      </section>
    );
  }

  if (runtime.sourceLabel === "开发代理桥接") {
    return (
      <section className="global-banner is-live">
        <strong>当前通过开发代理读取真实数据</strong>
        <span>
          你现在虽然跑的是 `npm run dev`，但页面数据已经通过本地 dev bridge
          转发到 desktop-ui-shell，再由它读取 agentd。
        </span>
      </section>
    );
  }

  if (runtime.mode === "fallback") {
    return (
      <section className="global-banner is-error">
        <strong>当前已切回前端回退数据</strong>
        <span>
          桌面桥接尚未接通，或者最近一次请求失败。页面结构还能看，但数据不代表
          当前 agentd 的真实状态。
        </span>
      </section>
    );
  }

  return null;
}
