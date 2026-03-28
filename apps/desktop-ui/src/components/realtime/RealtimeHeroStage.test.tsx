import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { GAL_ACTION_COPY, GAL_PAGE_COPY } from "../../copy/galAbstract";
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
  it("渲染 fallback 旁白、核心指标与下一步动作", () => {
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

  it("在 live 模式显示实时旁白", () => {
    const html = renderToStaticMarkup(
      <RealtimeHeroStage
        snapshot={createSnapshot()}
        runtime={createRuntime({
          mode: "live",
          isFallback: false,
        })}
        widgetScene={createWidgetScene()}
        onRefresh={vi.fn(async () => undefined)}
      />,
    );

    expect(html).toContain(GAL_PAGE_COPY.realtime.hero.runtimeAside.live);
  });

  it("在 disabled 模式显示未启用旁白", () => {
    const html = renderToStaticMarkup(
      <RealtimeHeroStage
        snapshot={createSnapshot()}
        runtime={createRuntime({
          mode: "disabled",
          isFallback: false,
        })}
        widgetScene={createWidgetScene()}
        onRefresh={vi.fn(async () => undefined)}
      />,
    );

    expect(html).toContain(GAL_PAGE_COPY.realtime.hero.runtimeAside.disabled);
  });

  it("当 scene.line 为空且有连接时，使用榜首兜底台词", () => {
    const html = renderToStaticMarkup(
      <RealtimeHeroStage
        snapshot={createSnapshot()}
        runtime={createRuntime()}
        widgetScene={createWidgetScene({ line: "" })}
        onRefresh={vi.fn(async () => undefined)}
      />,
    );

    expect(html).toContain("咦，firefox 又偷偷连出去了呢。");
  });

  it("当 scene.line 为空且无连接时，使用空态兜底文案", () => {
    const html = renderToStaticMarkup(
      <RealtimeHeroStage
        snapshot={createSnapshot({ activeConnections: [] })}
        runtime={createRuntime()}
        widgetScene={createWidgetScene({
          line: "",
          focusProcessName: "",
          focusTarget: "",
          focusRateLabel: "",
        })}
        onRefresh={vi.fn(async () => undefined)}
      />,
    );

    expect(html).toContain(GAL_PAGE_COPY.realtime.hero.lineEmpty);
    expect(html).toContain(GAL_PAGE_COPY.realtime.hero.topEmptyTitle);
    expect(html).toContain(GAL_PAGE_COPY.realtime.hero.topEmptyDetail);
  });

  it("刷新中时按钮进入 busy 状态并禁用", () => {
    const html = renderToStaticMarkup(
      <RealtimeHeroStage
        snapshot={createSnapshot()}
        runtime={createRuntime({
          isRefreshing: true,
          isLoading: false,
        })}
        widgetScene={createWidgetScene()}
        onRefresh={vi.fn(async () => undefined)}
      />,
    );

    expect(html).toContain(GAL_ACTION_COPY.realtimeRefresh.busy);
    expect(html).toContain("disabled");
  });

  it("榜首与下一步优先使用 scene focus，而不是 activeConnections 重判", () => {
    const html = renderToStaticMarkup(
      <RealtimeHeroStage
        snapshot={createSnapshot({
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
        })}
        runtime={createRuntime()}
        widgetScene={createWidgetScene({
          focusProcessName: "steam",
          focusTarget: "store.steamstatic.com:443",
          focusRateLabel: "6.5 MB/s",
          line: "",
        })}
        onRefresh={vi.fn(async () => undefined)}
      />,
    );

    expect(html).toContain("先盯住 steam");
    expect(html).toContain("store.steamstatic.com:443 · 6.5 MB/s");
    expect(html).not.toContain("先盯住 firefox");
  });
});
