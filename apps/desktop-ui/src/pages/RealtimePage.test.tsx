import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { GAL_PAGE_COPY } from "../copy/galAbstract";
import { resolveWidgetScene } from "../data/widgetScene";
import type {
  DashboardRuntimeView,
  DiagnosticsSnapshotView,
  RealtimeSnapshotView,
} from "../types/appData";
import RealtimePage from "./RealtimePage";

const snapshot: RealtimeSnapshotView = {
  cycleLabel: "第 5 回 / 真实值守",
  uploadRate: "120 KB/s",
  downloadRate: "4.7 MB/s",
  widgetState: "download_active",
  headline: "firefox -> cdn.example.net:443",
  captureMode: "proc_fallback",
  activeConnections: [
    {
      sessionId: "firefox-cdn",
      processName: "firefox",
      target: "cdn.example.net:443",
      localPortLabel: "本地端口 53124",
      direction: "下行",
      protocol: "TCP",
      uploadRate: "120 KB/s",
      uploadRateValue: 120 * 1024,
      downloadRate: "4.7 MB/s",
      downloadRateValue: Math.round(4.7 * 1024 * 1024),
      totalRate: "4.8 MB/s",
      totalRateValue: Math.round(4.82 * 1024 * 1024),
      lastSeenLabel: "刚刚",
    },
  ],
};

const diagnostics: DiagnosticsSnapshotView = {
  cycleLabel: "第 5 回 / 真实自检",
  agentStatus: "degraded",
  captureMode: "proc_fallback",
  databaseStatus: "healthy",
  degradedReason: "缺少 capability",
  permissionSummary: "需要补权限",
  socketPath: "/run/traffic-cat/agentd.sock",
  databasePath: "/var/lib/traffic-cat/traffic.db",
  platform: "linux",
  platformLabel: "Linux",
  supportLabel: "首发平台",
  platformSummary: "Linux 端可以继续值守。",
  capabilityLabel: "回退观测",
  capabilitySummary: "现在先用 /proc 把大方向盯住。",
  recommendedAction: "先把 agentd 接上，再确认速率可信度。",
  setupChecklist: [
    {
      id: "permission",
      title: "补齐权限",
      detail: "给 agentd 增加 capability 或 sudo。",
      status: "attention",
    },
  ],
};

const runtime: DashboardRuntimeView = {
  isLoading: false,
  isRefreshing: false,
  isFallback: true,
  mode: "fallback",
  errorMessage: null,
  sourceLabel: "回退观测",
  lastUpdatedLabel: "刚同步",
};

describe("RealtimePage", () => {
  it("把首页收成主舞台、热点列表和准备度摘要", () => {
    const widgetScene = resolveWidgetScene(snapshot, runtime);
    const html = renderToStaticMarkup(
      <RealtimePage
        snapshot={snapshot}
        diagnostics={diagnostics}
        runtime={runtime}
        onRefresh={vi.fn(async () => undefined)}
      />,
    );

    expect(html).toContain(widgetScene.line);
    expect(html).toContain(GAL_PAGE_COPY.realtime.hotspot.title);
    expect(html).toContain("这台机器现在能看到多少");
    expect(html).toContain("展开启动检查");
    expect(html).not.toContain(GAL_PAGE_COPY.realtime.lead);
    expect(html).not.toContain(GAL_PAGE_COPY.realtime.setup.title);
    expect(html).not.toContain(GAL_PAGE_COPY.realtime.focus.title);
  });
});
