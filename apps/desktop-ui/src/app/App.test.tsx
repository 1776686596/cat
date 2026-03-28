import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { getFallbackDashboardData } from "../data/dashboard";
import type { DashboardRuntimeView } from "../types/appData";

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

function mockDashboardData(runtimeOverrides: Partial<DashboardRuntimeView>) {
  mockUseDashboardData.mockReturnValue({
    dashboardData: getFallbackDashboardData(),
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
    expect(html).toContain("刚刚的动静，我都替你盯着");
    expect(html).toContain("这些目标最近都不太安分");
    expect(html).not.toContain("把桌面上悄悄联网的动静");
  });

  it("非 realtime 页在 fallback runtime 下仍显示压缩后的 fallback banner", () => {
    mockDashboardData({ mode: "fallback", isFallback: true });

    const html = renderToStaticMarkup(<App initialView="processes" />);

    expect(html).toContain("先用回退链路看着");
    expect(html).toContain("细节还没看完整，但大方向不会跟丢。");
  });
});
