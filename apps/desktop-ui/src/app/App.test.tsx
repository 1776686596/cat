import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import type { DashboardData, DashboardRuntimeView } from "../types/appData";

const { mockUseDashboardData } = vi.hoisted(() => ({
  mockUseDashboardData: vi.fn(),
}));

vi.mock("../hooks/useDashboardData", () => ({
  useDashboardData: mockUseDashboardData,
}));

vi.mock("../pages/RealtimePage", () => ({
  default: () => <section>RealtimePage</section>,
}));

vi.mock("../pages/ProcessesPage", () => ({
  default: () => <section>ProcessesPage</section>,
}));

vi.mock("../pages/ProcessDetailPage", () => ({
  default: () => <section>ProcessDetailPage</section>,
}));

vi.mock("../pages/HistoryPage", () => ({
  default: () => <section>HistoryPage</section>,
}));

vi.mock("../pages/DiagnosticsPage", () => ({
  default: () => <section>DiagnosticsPage</section>,
}));

function createRuntime(
  overrides: Partial<DashboardRuntimeView> = {},
): DashboardRuntimeView {
  return {
    isLoading: false,
    isRefreshing: false,
    isFallback: false,
    mode: "live",
    errorMessage: null,
    sourceLabel: "真实观测",
    lastUpdatedLabel: "刚刚",
    ...overrides,
  };
}

function createDashboardData(): DashboardData {
  return {
    realtime: {
      cycleLabel: "测试周期",
      uploadRate: "0 KB/s",
      downloadRate: "0 KB/s",
      widgetState: "idle",
      headline: "测试标题",
      captureMode: "live",
      activeConnections: [],
    },
    diagnostics: {
      cycleLabel: "测试周期",
      agentStatus: "ready",
      captureMode: "live",
      databaseStatus: "healthy",
      degradedReason: null,
      permissionSummary: "已授权",
      socketPath: "/tmp/agentd.sock",
      databasePath: "/tmp/traffic.db",
      platform: "linux",
      platformLabel: "Linux",
      supportLabel: "Linux 首发平台",
      platformSummary: "测试平台摘要",
      capabilityLabel: "完整观测",
      capabilitySummary: "测试能力摘要",
      recommendedAction: "无需动作",
      setupChecklist: [],
    },
  };
}

function mockDashboardData(runtimeOverrides: Partial<DashboardRuntimeView>) {
  mockUseDashboardData.mockReturnValue({
    dashboardData: createDashboardData(),
    runtime: createRuntime(runtimeOverrides),
    refresh: vi.fn(async () => undefined),
  });
}

describe("App shell copy contract", () => {
  beforeEach(() => {
    mockUseDashboardData.mockReset();
  });

  it("realtime shell 渲染压缩后的副标题与导航旁白", () => {
    mockDashboardData({ mode: "live", isFallback: false });

    const html = renderToStaticMarkup(<App initialView="realtime" />);

    expect(html).toContain("她替你盯着桌面上的每一次外连。");
    expect(html).toContain("刚刚的动静，我都替你盯着。");
    expect(html).toContain("这些目标最近都不太安分。");
    expect(html).toContain("Linux · 完整观测");
    expect(html).not.toContain('class="global-banner');
    expect(html).not.toContain("先用回退链路看着");
    expect(html).not.toContain("细节还没看完整，但大方向不会跟丢。");
    expect(html).not.toContain("把桌面上悄悄联网的动静");
  });

  it("非 realtime 页在 fallback runtime 下仍显示压缩后的 fallback banner", () => {
    mockDashboardData({ mode: "fallback", isFallback: true });

    const html = renderToStaticMarkup(<App initialView="processes" />);

    expect(html).toContain("ProcessesPage");
    expect(html).not.toContain("RealtimePage");
    expect(html).toContain("先用回退链路看着");
    expect(html).toContain("细节还没看完整，但大方向不会跟丢。");
  });

  it("realtime 页不再叠加全局 runtime banner，侧边概览也缩成三条", () => {
    mockDashboardData({ mode: "fallback", isFallback: true });

    const html = renderToStaticMarkup(<App initialView="realtime" />);

    expect(html).not.toContain('class="global-banner');
    expect(html).toContain("当前区域");
    expect(html).toContain("观测能力");
    expect(html).toContain("最近同步");
    expect(html).not.toContain("当前平台");
  });
});
