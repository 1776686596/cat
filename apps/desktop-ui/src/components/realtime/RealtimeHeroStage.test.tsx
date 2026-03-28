import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { WidgetSceneView } from "../../data/widgetScene";
import type { DashboardRuntimeView, RealtimeSnapshotView } from "../../types/appData";
import RealtimeHeroStage from "./RealtimeHeroStage";

function createSnapshot(
  overrides: Partial<RealtimeSnapshotView> = {},
): RealtimeSnapshotView {
  return {
    cycleLabel: "第 7 回合",
    uploadRate: "512 KB/s",
    downloadRate: "3.2 MB/s",
    widgetState: "download_active",
    headline: "firefox 正在吃流量",
    captureMode: "proc_fallback",
    activeConnections: [
      {
        sessionId: "session-1",
        processName: "firefox",
        target: "cdn.example.net:443",
        localPortLabel: "本地端口 53124",
        direction: "下行",
        protocol: "TCP",
        uploadRate: "128 KB/s",
        uploadRateValue: 128 * 1024,
        downloadRate: "2.1 MB/s",
        downloadRateValue: 2.1 * 1024 * 1024,
        totalRate: "2.2 MB/s",
        totalRateValue: 2.2 * 1024 * 1024,
        lastSeenLabel: "刚刚",
      },
    ],
    ...overrides,
  };
}

function createRuntime(
  overrides: Partial<DashboardRuntimeView> = {},
): DashboardRuntimeView {
  return {
    isLoading: false,
    isRefreshing: false,
    isFallback: true,
    mode: "fallback",
    errorMessage: null,
    sourceLabel: "回退快照",
    lastUpdatedLabel: "刚刚",
    ...overrides,
  };
}

function createWidgetScene(
  overrides: Partial<WidgetSceneView> = {},
): WidgetSceneView {
  return {
    sceneId: "busy_download",
    mood: "curious",
    stateLabel: "下行热闹",
    title: "firefox 正在吃流量",
    line: "咦，firefox 又偷偷连出去了呢。",
    overlayLead: "firefox 现在最值得看。",
    guidance: "先看当前榜首连接，确认它在从哪里下载。",
    reasonTitle: "先看榜首连接",
    reasonDetail: "firefox 正在持续下载。",
    focusProcessName: "firefox",
    focusTarget: "cdn.example.net:443",
    focusRateLabel: "2.2 MB/s",
    ...overrides,
  };
}

describe("RealtimeHeroStage", () => {
  it("渲染主舞台角色台词、旁白、核心指标与下一步动作", () => {
    const html = renderToStaticMarkup(
      <RealtimeHeroStage
        snapshot={createSnapshot()}
        runtime={createRuntime()}
        widgetScene={createWidgetScene()}
        onRefresh={vi.fn(async () => undefined)}
      />,
    );

    expect(html).toContain("实时流向");
    expect(html).toContain("咦，firefox 又偷偷连出去了呢。");
    expect(html).toContain("先用回退链路看着");
    expect(html).toContain("先盯住 firefox");
    expect(html).toContain("上行");
    expect(html).toContain("下行");
    expect(html).toContain("当前榜首");
  });
});
