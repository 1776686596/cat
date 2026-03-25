import { useState } from "react";

import { NAV_ITEMS, type AppView } from "./navigation";
import {
  GAL_SHELL_COPY,
  getRuntimeModeLabel,
} from "../copy/galAbstract";
import { useDashboardData } from "../hooks/useDashboardData";
import DiagnosticsPage from "../pages/DiagnosticsPage";
import HistoryPage from "../pages/HistoryPage";
import ProcessDetailPage from "../pages/ProcessDetailPage";
import ProcessesPage from "../pages/ProcessesPage";
import RealtimePage from "../pages/RealtimePage";

const PAGE_TITLES = NAV_ITEMS.reduce<Record<AppView, string>>(
  (titles, item) => {
    titles[item.key] = item.label;
    return titles;
  },
  {} as Record<AppView, string>,
);

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
  const runtimeTone = getRuntimeTone(runtime.mode);
  const inspectProcess = (pid: number) => {
    setSelectedProcessId(pid);
    setActiveView("process-detail");
  };

  let activePage = (
    <RealtimePage
      snapshot={dashboardData.realtime}
      diagnostics={dashboardData.diagnostics}
      runtime={runtime}
      onRefresh={refresh}
    />
  );
  switch (activeView) {
    case "realtime":
      activePage = (
        <RealtimePage
          snapshot={dashboardData.realtime}
          diagnostics={dashboardData.diagnostics}
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
          <div className="brand-row">
            <span className="brand-chip">traffic-cat</span>
            <span className={`runtime-pill is-${runtimeTone}`.trim()}>
              {getRuntimeModeLabel(runtime.mode)}
            </span>
          </div>
          <h1>{GAL_SHELL_COPY.title}</h1>
          <p>{GAL_SHELL_COPY.subtitle}</p>
        </div>

        <div className="sidebar-overview">
          <div className="sidebar-overview-card">
            <span>{GAL_SHELL_COPY.cards.focus}</span>
            <strong>{PAGE_TITLES[activeView]}</strong>
          </div>
          <div className="sidebar-overview-card">
            <span>{GAL_SHELL_COPY.cards.platform}</span>
            <strong>{dashboardData.diagnostics.platformLabel}</strong>
          </div>
          <div className="sidebar-overview-card">
            <span>{GAL_SHELL_COPY.cards.capability}</span>
            <strong>{dashboardData.diagnostics.capabilityLabel}</strong>
          </div>
          <div className="sidebar-overview-card">
            <span>{GAL_SHELL_COPY.cards.sync}</span>
            <strong>{runtime.lastUpdatedLabel}</strong>
          </div>
        </div>

        <nav className="nav-list" aria-label="主导航">
          {NAV_ITEMS.map((item, index) => (
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
                  ? GAL_SHELL_COPY.lockedProcessTitle
                  : undefined
              }
            >
              <span className="nav-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="nav-body">
                <span className="nav-label">{item.label}</span>
                <span className="nav-copy">{item.copy}</span>
              </span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <p className="sidebar-meta">{PAGE_TITLES[activeView]}</p>
          <button
            className="action-button"
            type="button"
            onClick={() => {
              void refresh();
            }}
            disabled={runtime.isRefreshing}
          >
            {runtime.isRefreshing
              ? GAL_SHELL_COPY.actions.refreshBusy
              : GAL_SHELL_COPY.actions.refreshIdle}
          </button>
          {runtime.errorMessage ? (
            <p className="sidebar-warning">{runtime.errorMessage}</p>
          ) : null}
          {selectedProcessId !== null ? (
            <p className="sidebar-meta">
              {GAL_SHELL_COPY.cards.selectedPid} PID {selectedProcessId}
            </p>
          ) : (
            <p className="sidebar-warning">{GAL_SHELL_COPY.noSelectedProcessHint}</p>
          )}
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
        <strong>{GAL_SHELL_COPY.banners.mock.title}</strong>
        <span>{GAL_SHELL_COPY.banners.mock.message}</span>
      </section>
    );
  }

  if (runtime.mode === "live") {
    return (
      <section className="global-banner is-live">
        <strong>{GAL_SHELL_COPY.banners.live.title}</strong>
        <span>{GAL_SHELL_COPY.banners.live.message}</span>
      </section>
    );
  }

  if (runtime.mode === "fallback") {
    return (
      <section className="global-banner is-error">
        <strong>{GAL_SHELL_COPY.banners.fallback.title}</strong>
        <span>{GAL_SHELL_COPY.banners.fallback.message}</span>
      </section>
    );
  }

  return null;
}

function getRuntimeTone(mode: ReturnType<typeof useDashboardData>["runtime"]["mode"]) {
  switch (mode) {
    case "live":
      return "live";
    case "mock":
      return "mock";
    case "fallback":
      return "fallback";
    case "connecting":
      return "connecting";
    case "disabled":
      return "disabled";
  }
}
