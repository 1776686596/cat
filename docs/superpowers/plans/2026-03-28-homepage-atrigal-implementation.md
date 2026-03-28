# Traffic Cat 首页 AtriGal 化重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将首页重构成 `AtriGal` 风格的“主舞台 + 情报台”布局，压缩解释性文案，同时保持状态、热点和下一步动作一眼可扫。

**Architecture:** 保持现有 `useDashboardData -> RealtimePage -> widget scene` 数据链路不变，只重构前端 copy contract、shell 布局与 realtime 页面组合方式。新增两个轻量 React 组件承接主舞台与准备度摘要，并用原生 `<details>` 做渐进展开，避免引入新的状态管理。

**Tech Stack:** React 18, TypeScript, Vite, Vitest, react-dom/server, Tauri desktop shell

---

## 文件结构与职责

- Modify: `apps/desktop-ui/src/copy/galAbstract.ts`
  - 重写 shell / nav / realtime 首页文案
  - 补充首页主舞台需要的 `AtriGal` 台词和短状态句
- Create: `apps/desktop-ui/src/app/App.test.tsx`
  - 锁定 shell 副标题、导航旁白和全局 banner 的回归测试
- Create: `apps/desktop-ui/src/components/realtime/RealtimeHeroStage.tsx`
  - 封装首页主舞台的“角色 + 情报台”区域
- Create: `apps/desktop-ui/src/components/realtime/RealtimeHeroStage.test.tsx`
  - 锁定主舞台台词、状态短句和核心指标展示
- Create: `apps/desktop-ui/src/components/realtime/ReadinessSummaryCard.tsx`
  - 将准备度区压缩成摘要 + 可展开启动检查
- Create: `apps/desktop-ui/src/components/realtime/ReadinessSummaryCard.test.tsx`
  - 锁定摘要标题、推荐动作与 `<details>` 展开入口
- Modify: `apps/desktop-ui/src/pages/RealtimePage.tsx`
  - 改用新主舞台和准备度摘要，移除首屏重复解释块
- Create: `apps/desktop-ui/src/pages/RealtimePage.test.tsx`
  - 锁定新首页结构，并确保旧解释文案退出首屏
- Modify: `apps/desktop-ui/src/app/App.tsx`
  - 缩瘦侧边栏概览卡，并在 realtime 视图取消重复的全局 runtime banner
- Modify: `apps/desktop-ui/src/styles.css`
  - 新增主舞台、准备度摘要、压缩挂件预览的结构样式
- Modify: `apps/desktop-ui/src/themes/botanical-theme.css`
  - 为新结构补齐 Botanical 主题下的层级、字重和色彩映射

## Task 1: 锁定 Shell 文案合同

**Files:**
- Create: `apps/desktop-ui/src/app/App.test.tsx`
- Modify: `apps/desktop-ui/src/copy/galAbstract.ts`

- [ ] **Step 1: 先写 shell 回归测试**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DashboardData, DashboardRuntimeView } from "../types/appData";

const mockUseDashboardData = vi.fn();

vi.mock("../hooks/useDashboardData", () => ({
  useDashboardData: () => mockUseDashboardData(),
}));
vi.mock("../pages/RealtimePage", () => ({ default: () => "RealtimePage" }));
vi.mock("../pages/ProcessesPage", () => ({ default: () => "ProcessesPage" }));
vi.mock("../pages/ProcessDetailPage", () => ({ default: () => "ProcessDetailPage" }));
vi.mock("../pages/HistoryPage", () => ({ default: () => "HistoryPage" }));
vi.mock("../pages/DiagnosticsPage", () => ({ default: () => "DiagnosticsPage" }));

import App from "./App";

const dashboardData: DashboardData = {
  realtime: {
    cycleLabel: "第 3 回",
    uploadRate: "120 KB/s",
    downloadRate: "4.7 MB/s",
    widgetState: "download_active",
    headline: "firefox -> cdn.example.net:443",
    captureMode: "proc_fallback",
    activeConnections: [],
  },
  diagnostics: {
    cycleLabel: "第 3 回",
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
    recommendedAction: "先补权限，再确认速率可信度。",
    setupChecklist: [],
  },
};

const liveRuntime: DashboardRuntimeView = {
  isLoading: false,
  isRefreshing: false,
  isFallback: false,
  mode: "live",
  errorMessage: null,
  sourceLabel: "真实观测",
  lastUpdatedLabel: "刚刚",
};

const fallbackRuntime: DashboardRuntimeView = {
  ...liveRuntime,
  isFallback: true,
  mode: "fallback",
};

describe("App shell", () => {
  beforeEach(() => {
    mockUseDashboardData.mockReturnValue({
      dashboardData,
      runtime: liveRuntime,
      refresh: vi.fn(async () => undefined),
    });
  });

  it("渲染更短的 AtriGal 副标题与导航旁白", () => {
    const html = renderToStaticMarkup(<App initialView="realtime" />);

    expect(html).toContain("她替你盯着桌面上的每一次外连。");
    expect(html).toContain("刚刚的动静，我都替你盯着");
    expect(html).toContain("这些目标最近都不太安分");
    expect(html).not.toContain("把桌面上悄悄联网的动静");
  });

  it("非实时页仍显示压缩后的 fallback banner", () => {
    mockUseDashboardData.mockReturnValue({
      dashboardData,
      runtime: fallbackRuntime,
      refresh: vi.fn(async () => undefined),
    });

    const html = renderToStaticMarkup(<App initialView="diagnostics" />);

    expect(html).toContain("先用回退链路看着");
    expect(html).toContain("细节还没看完整，但大方向不会跟丢。");
  });
});
```

- [ ] **Step 2: 运行测试，确认它先失败**

Run: `npm test -- src/app/App.test.tsx --run`

Expected: `FAIL`，因为 `App.test.tsx` 是新文件，且当前文案仍是旧版长说明句式。

- [ ] **Step 3: 只改首页壳层 copy contract，让测试变绿**

```ts
export const GAL_NAV_ITEMS = [
  {
    key: "realtime",
    label: "实时流向",
    copy: "刚刚的动静，我都替你盯着",
  },
  {
    key: "processes",
    label: "进程聚合",
    copy: "这些目标最近都不太安分",
  },
  {
    key: "process-detail",
    label: "进程详情",
    copy: "单独看看它到底在忙什么",
  },
  {
    key: "history",
    label: "历史检索",
    copy: "之前发生过的事，也能翻出来",
  },
  {
    key: "diagnostics",
    label: "诊断",
    copy: "让我看看还有哪里没接好",
  },
] as const;

export const GAL_SHELL_COPY = {
  title: "Traffic Cat 守望席",
  subtitle: "她替你盯着桌面上的每一次外连。",
  cards: {
    focus: "当前区域",
    platform: "当前平台",
    capability: "观测状态",
    sync: "最近同步",
    selectedPid: "锁定进程",
  },
  selectedPidEmpty: "未锁定",
  noSelectedProcessHint: "先去进程聚合挑一个目标吧。",
  lockedProcessTitle: "先从进程聚合页选择一个进程",
  actions: {
    refreshIdle: "刷新状态",
    refreshBusy: "刷新中...",
  },
  banners: {
    mock: {
      title: "现在先看演示",
      message: "这些动静是示意，但布局和反应都是真的。",
    },
    live: {
      title: "真实链路已经接上了",
      message: "刚刚的外连，我会继续替你盯着。",
    },
    fallback: {
      title: "先用回退链路看着",
      message: "细节还没看完整，但大方向不会跟丢。",
    },
  },
} as const;
```

- [ ] **Step 4: 再跑一次测试，确认 copy contract 已锁住**

Run: `npm test -- src/app/App.test.tsx --run`

Expected: `PASS`，并看到 `2 passed`。

- [ ] **Step 5: 提交这个文案合同基线**

```bash
git add apps/desktop-ui/src/app/App.test.tsx apps/desktop-ui/src/copy/galAbstract.ts
git commit -m "test: pin atrigal shell copy contract"
```

## Task 2: 提取首页主舞台组件

**Files:**
- Create: `apps/desktop-ui/src/components/realtime/RealtimeHeroStage.tsx`
- Create: `apps/desktop-ui/src/components/realtime/RealtimeHeroStage.test.tsx`
- Modify: `apps/desktop-ui/src/copy/galAbstract.ts`

- [ ] **Step 1: 先写主舞台测试，锁住台词、状态句和情报台**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import RealtimeHeroStage from "./RealtimeHeroStage";
import { resolveWidgetScene } from "../../data/widgetScene";
import type {
  DashboardRuntimeView,
  RealtimeSnapshotView,
} from "../../types/appData";

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

const runtime: DashboardRuntimeView = {
  isLoading: false,
  isRefreshing: false,
  isFallback: true,
  mode: "fallback",
  errorMessage: null,
  sourceLabel: "回退观测",
  lastUpdatedLabel: "刚同步",
};

describe("RealtimeHeroStage", () => {
  it("用 AtriGal 台词和情报卡渲染主舞台", () => {
    const html = renderToStaticMarkup(
      <RealtimeHeroStage
        snapshot={snapshot}
        runtime={runtime}
        widgetScene={resolveWidgetScene(snapshot, runtime)}
        onRefresh={vi.fn(async () => undefined)}
      />,
    );

    expect(html).toContain("咦，firefox 又偷偷连出去了呢。");
    expect(html).toContain("先用回退链路看着");
    expect(html).toContain("先盯住 firefox");
    expect(html).toContain("上行");
    expect(html).toContain("下行");
    expect(html).toContain("当前榜首");
  });
});
```

- [ ] **Step 2: 运行测试，确认它先失败**

Run: `npm test -- src/components/realtime/RealtimeHeroStage.test.tsx --run`

Expected: `FAIL`，因为 `RealtimeHeroStage.tsx` 还不存在。

- [ ] **Step 3: 先补 hero copy，再实现主舞台组件**

```ts
export const GAL_PAGE_COPY = {
  common: {
    battleReport: "当前观察",
  },
  realtime: {
    title: "实时流向",
    hero: {
      fallbackAside: "先用回退链路看着",
      liveAside: "真实链路已经接上了",
      mockAside: "先拿演示数据练练眼力吧",
      quietDialogue: "现在还算安静呢。",
      watchingDialogue: "咦，它又偷偷连出去了呢。",
      downloadDialogue: "发现新动静了，我已经记下来了。",
      uploadDialogue: "这个目标还没有交代清楚呢。",
      alertDialogue: "有一点可疑，不过别担心，我会继续看着。",
      nextActionPrefix: "先盯住",
      noFocusAction: "先等下一条动静",
    },
    hotspot: {
      eyebrow: "当前热点",
      title: "最吵的几条",
      summary: "先从她刚才盯上的那条开始。",
      badgeSuffix: "条活跃连接",
      empty: "现在还没有哪条连接值得我特别提醒。",
    },
  },
} as const;
```

```tsx
import MetricChip from "../common/MetricChip";
import {
  GAL_ACTION_COPY,
  GAL_PAGE_COPY,
} from "../../copy/galAbstract";
import type { WidgetSceneView } from "../../data/widgetScene";
import type {
  DashboardRuntimeView,
  RealtimeSnapshotView,
} from "../../types/appData";

interface RealtimeHeroStageProps {
  snapshot: RealtimeSnapshotView;
  runtime: DashboardRuntimeView;
  widgetScene: WidgetSceneView;
  onRefresh: () => Promise<void>;
}

function pickDialogue(
  snapshot: RealtimeSnapshotView,
  widgetScene: WidgetSceneView,
) {
  const focus = snapshot.activeConnections[0];
  const heroCopy = GAL_PAGE_COPY.realtime.hero;

  if (!focus) {
    return heroCopy.quietDialogue;
  }

  switch (widgetScene.sceneId) {
    case "watching":
      return `咦，${focus.processName} 又偷偷连出去了呢。`;
    case "busy_download":
      return heroCopy.downloadDialogue;
    case "busy_upload":
      return heroCopy.uploadDialogue;
    case "alert":
      return heroCopy.alertDialogue;
    case "idle":
      return heroCopy.quietDialogue;
  }
}

function pickAside(runtime: DashboardRuntimeView) {
  const heroCopy = GAL_PAGE_COPY.realtime.hero;

  if (runtime.mode === "mock") {
    return heroCopy.mockAside;
  }
  if (runtime.mode === "live") {
    return heroCopy.liveAside;
  }
  return heroCopy.fallbackAside;
}

export default function RealtimeHeroStage({
  snapshot,
  runtime,
  widgetScene,
  onRefresh,
}: RealtimeHeroStageProps) {
  const focus = snapshot.activeConnections[0] ?? null;
  const heroCopy = GAL_PAGE_COPY.realtime.hero;

  return (
    <section className="app-panel app-panel--hero-stage">
      <div className="realtime-hero-stage">
        <div className="realtime-hero-stage__character">
          <p className="page-eyebrow">{snapshot.cycleLabel}</p>
          <h2>{GAL_PAGE_COPY.realtime.title}</h2>
          <p className="realtime-hero-stage__line">{pickDialogue(snapshot, widgetScene)}</p>
          <p className="realtime-hero-stage__aside">{pickAside(runtime)}</p>
        </div>

        <div className="realtime-hero-stage__intel">
          <div className="realtime-hero-stage__metrics">
            <MetricChip label="上行" value={snapshot.uploadRate} />
            <MetricChip label="下行" value={snapshot.downloadRate} />
            <MetricChip label="状态" value={widgetScene.stateLabel} />
          </div>

          <div className="realtime-hero-stage__facts">
            <article className="realtime-intel-card">
              <span>当前榜首</span>
              <strong>{focus ? focus.processName : "暂无目标"}</strong>
              <p>{focus ? focus.target : "她还没盯上谁。"}</p>
            </article>
            <article className="realtime-intel-card">
              <span>下一步</span>
              <strong>
                {focus
                  ? `${heroCopy.nextActionPrefix} ${focus.processName}`
                  : heroCopy.noFocusAction}
              </strong>
              <p>{widgetScene.guidance}</p>
            </article>
          </div>

          <button
            className="action-button"
            type="button"
            onClick={() => {
              void onRefresh();
            }}
            disabled={runtime.isRefreshing}
          >
            {runtime.isRefreshing
              ? GAL_ACTION_COPY.realtimeRefresh.busy
              : GAL_ACTION_COPY.realtimeRefresh.idle}
          </button>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: 再跑一次测试，确认主舞台可独立渲染**

Run: `npm test -- src/components/realtime/RealtimeHeroStage.test.tsx --run`

Expected: `PASS`，并看到 `1 passed`。

- [ ] **Step 5: 提交主舞台组件**

```bash
git add \
  apps/desktop-ui/src/copy/galAbstract.ts \
  apps/desktop-ui/src/components/realtime/RealtimeHeroStage.tsx \
  apps/desktop-ui/src/components/realtime/RealtimeHeroStage.test.tsx
git commit -m "feat: add realtime hero stage"
```

## Task 3: 用摘要卡重组 RealtimePage

**Files:**
- Create: `apps/desktop-ui/src/components/realtime/ReadinessSummaryCard.tsx`
- Create: `apps/desktop-ui/src/components/realtime/ReadinessSummaryCard.test.tsx`
- Create: `apps/desktop-ui/src/pages/RealtimePage.test.tsx`
- Modify: `apps/desktop-ui/src/pages/RealtimePage.tsx`

- [ ] **Step 1: 先写准备度摘要卡和页面重排测试**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ReadinessSummaryCard from "./ReadinessSummaryCard";
import type { DiagnosticsSnapshotView } from "../../types/appData";

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

describe("ReadinessSummaryCard", () => {
  it("把准备度收成摘要 + details 入口", () => {
    const html = renderToStaticMarkup(
      <ReadinessSummaryCard diagnostics={diagnostics} />,
    );

    expect(html).toContain("这台机器现在能看到多少");
    expect(html).toContain("先把 agentd 接上，再确认速率可信度。");
    expect(html).toContain("展开启动检查");
  });
});
```

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import RealtimePage from "./RealtimePage";
import type {
  DashboardRuntimeView,
  DiagnosticsSnapshotView,
  RealtimeSnapshotView,
} from "../types/appData";

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
    const html = renderToStaticMarkup(
      <RealtimePage
        snapshot={snapshot}
        diagnostics={diagnostics}
        runtime={runtime}
        onRefresh={vi.fn(async () => undefined)}
      />,
    );

    expect(html).toContain("咦，firefox 又偷偷连出去了呢。");
    expect(html).toContain("最吵的几条");
    expect(html).toContain("这台机器现在能看到多少");
    expect(html).toContain("展开启动检查");
    expect(html).not.toContain("把现在最值得盯住的联网动静");
    expect(html).not.toContain("她刚才为什么这样");
  });
});
```

- [ ] **Step 2: 运行测试，确认页面重排需求先失败**

Run: `npm test -- src/components/realtime/ReadinessSummaryCard.test.tsx src/pages/RealtimePage.test.tsx --run`

Expected: `FAIL`，因为 `ReadinessSummaryCard.tsx` 和新的 `RealtimePage` 结构都还不存在。

- [ ] **Step 3: 先实现准备度摘要卡，再重排页面**

```tsx
import SectionCard from "../common/SectionCard";
import SetupChecklist from "../common/SetupChecklist";
import type { DiagnosticsSnapshotView } from "../../types/appData";

interface ReadinessSummaryCardProps {
  diagnostics: DiagnosticsSnapshotView;
}

export default function ReadinessSummaryCard({
  diagnostics,
}: ReadinessSummaryCardProps) {
  const needsAttention = diagnostics.setupChecklist.some(
    (item) => item.status === "attention",
  );

  return (
    <SectionCard
      eyebrow="观测准备度"
      title="这台机器现在能看到多少"
      summary="有些地方已经接好了，剩下的我帮你标出来。"
      badge={diagnostics.capabilityLabel}
      badgeTone={needsAttention ? "warn" : "normal"}
    >
      <div className="readiness-summary">
        <p className="readiness-summary__headline">{diagnostics.recommendedAction}</p>

        <div className="readiness-summary__facts">
          <div className="readiness-summary__fact">
            <span>平台</span>
            <strong>{diagnostics.platformLabel}</strong>
            <p>{diagnostics.platformSummary}</p>
          </div>
          <div className="readiness-summary__fact">
            <span>观测能力</span>
            <strong>{diagnostics.capabilityLabel}</strong>
            <p>{diagnostics.capabilitySummary}</p>
          </div>
        </div>

        <details className="readiness-summary__details">
          <summary>展开启动检查</summary>
          <SetupChecklist items={diagnostics.setupChecklist} />
        </details>
      </div>
    </SectionCard>
  );
}
```

```tsx
import ReadinessSummaryCard from "../components/realtime/ReadinessSummaryCard";
import RealtimeHeroStage from "../components/realtime/RealtimeHeroStage";
import { buildAppUrl } from "../app/windowMode";
import SectionCard from "../components/common/SectionCard";
import TrafficWidgetCard from "../components/widget/TrafficWidgetCard";
import { GAL_ACTION_COPY, GAL_PAGE_COPY } from "../copy/galAbstract";
import { resolveWidgetScene } from "../data/widgetScene";
import { useWidgetCharacterPlacement } from "../hooks/useWidgetCharacterPlacement";
import { useWidgetLayoutMode } from "../hooks/useWidgetLayoutMode";

export default function RealtimePage({
  snapshot,
  diagnostics,
  runtime,
  onRefresh,
}: RealtimePageProps) {
  const widgetScene = resolveWidgetScene(snapshot, runtime);
  const { layoutMode, setLayoutMode } = useWidgetLayoutMode();
  const {
    placement,
    setPlacement,
  } = useWidgetCharacterPlacement(layoutMode);
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
    <div className="app-main app-main--realtime">
      <RealtimeHeroStage
        snapshot={snapshot}
        runtime={runtime}
        widgetScene={widgetScene}
        onRefresh={onRefresh}
      />

      <div className="realtime-main-grid">
        <SectionCard
          eyebrow={GAL_PAGE_COPY.realtime.hotspot.eyebrow}
          title={GAL_PAGE_COPY.realtime.hotspot.title}
          summary={GAL_PAGE_COPY.realtime.hotspot.summary}
          badge={`${snapshot.activeConnections.length} ${GAL_PAGE_COPY.realtime.hotspot.badgeSuffix}`}
        >
          {snapshot.activeConnections.length === 0 ? (
            <div className="page-note">{GAL_PAGE_COPY.realtime.hotspot.empty}</div>
          ) : (
            <div className="list-block">
              {snapshot.activeConnections.map((item) => (
                <div className="list-item" key={item.sessionId}>
                  <strong>
                    {item.processName} -&gt; {item.target}
                  </strong>
                  <span>
                    {item.direction} · {item.protocol} · 上 {item.uploadRate} · 下{" "}
                    {item.downloadRate} · {item.lastSeenLabel}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <ReadinessSummaryCard diagnostics={diagnostics} />
      </div>

      <section className="widget-preview-section widget-preview-section--compact">
        <div className="widget-preview-copy">
          <p className="page-eyebrow">挂件预览</p>
          <h3>她会怎么守着你</h3>
          <p className="section-summary">摆位和比例还在，解释的话就先收起来。</p>
        </div>

        <TrafficWidgetCard
          snapshot={snapshot}
          runtime={runtime}
          mode="panel"
          layoutMode={layoutMode}
          characterPlacement={placement}
          editableCharacter
          onCharacterPlacementChange={setPlacement}
          primaryActionLabel={GAL_ACTION_COPY.realtimeOpenWidget}
          onPrimaryAction={openWidgetPreview}
          onRefresh={onRefresh}
          refreshDisabled={runtime.isRefreshing}
        />
      </section>
    </div>
  );
}
```

- [ ] **Step 4: 再跑一次测试，确认首页结构已经换成三段式**

Run: `npm test -- src/components/realtime/ReadinessSummaryCard.test.tsx src/pages/RealtimePage.test.tsx --run`

Expected: `PASS`，并看到 `2 passed`。

- [ ] **Step 5: 提交页面重组**

```bash
git add \
  apps/desktop-ui/src/components/realtime/ReadinessSummaryCard.tsx \
  apps/desktop-ui/src/components/realtime/ReadinessSummaryCard.test.tsx \
  apps/desktop-ui/src/pages/RealtimePage.tsx \
  apps/desktop-ui/src/pages/RealtimePage.test.tsx
git commit -m "feat: restructure realtime homepage"
```

## Task 4: 缩瘦 Sidebar 并补齐样式

**Files:**
- Modify: `apps/desktop-ui/src/app/App.tsx`
- Modify: `apps/desktop-ui/src/app/App.test.tsx`
- Modify: `apps/desktop-ui/src/styles.css`
- Modify: `apps/desktop-ui/src/themes/botanical-theme.css`

- [ ] **Step 1: 先补一个 shell 布局回归测试**

```tsx
it("实时页不再叠加全局 runtime banner，侧边概览也缩成三条", () => {
  mockUseDashboardData.mockReturnValue({
    dashboardData,
    runtime: fallbackRuntime,
    refresh: vi.fn(async () => undefined),
  });

  const html = renderToStaticMarkup(<App initialView="realtime" />);

  expect(html).not.toContain('class="global-banner');
  expect(html).toContain("当前区域");
  expect(html).toContain("观测状态");
  expect(html).toContain("最近同步");
  expect(html).not.toContain("当前平台");
});
```

- [ ] **Step 2: 跑测试，确认 shell 布局需求先失败**

Run: `npm test -- src/app/App.test.tsx --run`

Expected: `FAIL`，因为 realtime 视图现在还会叠加全局 banner，侧边概览也还是四张卡。

- [ ] **Step 3: 改 App 布局，并补齐结构样式**

```tsx
const sidebarFacts = [
  {
    label: GAL_SHELL_COPY.cards.focus,
    value: PAGE_TITLES[activeView],
  },
  {
    label: GAL_SHELL_COPY.cards.capability,
    value: `${dashboardData.diagnostics.platformLabel} · ${dashboardData.diagnostics.capabilityLabel}`,
  },
  {
    label: GAL_SHELL_COPY.cards.sync,
    value: runtime.lastUpdatedLabel,
  },
];

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
        {sidebarFacts.map((item) => (
          <div className="sidebar-overview-card" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
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
      {activeView === "realtime" ? null : renderRuntimeBanner(runtime)}
      {activePage}
    </div>
  </div>
);
```

```css
.app-shell {
  grid-template-columns: minmax(248px, 288px) minmax(0, 1fr);
  gap: clamp(18px, 2.4vw, 32px);
}

.sidebar-overview {
  display: grid;
  gap: 10px;
}

.nav-copy {
  font-size: 12px;
  line-height: 1.4;
}

.app-main--realtime {
  display: grid;
  gap: 18px;
}

.app-panel--hero-stage {
  padding: 24px;
}

.realtime-hero-stage {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
  gap: 20px;
  align-items: stretch;
}

.realtime-hero-stage__line {
  margin: 10px 0 8px;
  font-size: clamp(1.6rem, 2.4vw, 2.4rem);
  line-height: 1.12;
}

.realtime-hero-stage__aside {
  margin: 0;
  font-size: 0.95rem;
}

.realtime-main-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
  gap: 18px;
}

.realtime-hero-stage__facts,
.readiness-summary__facts {
  display: grid;
  gap: 12px;
}

.realtime-intel-card,
.readiness-summary__fact {
  padding: 14px 16px;
  border-radius: 20px;
}

.readiness-summary__headline {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.5;
}

.readiness-summary__details > summary {
  cursor: pointer;
  list-style: none;
  font-weight: 600;
}

.widget-preview-section--compact {
  align-items: start;
}

@media (max-width: 1100px) {
  .app-shell {
    grid-template-columns: 1fr;
  }

  .realtime-hero-stage,
  .realtime-main-grid {
    grid-template-columns: 1fr;
  }
}
```

```css
.brand-block h1,
.realtime-hero-stage__line,
.realtime-intel-card strong {
  font-family: var(--botanical-font-display);
  color: var(--botanical-fg);
}

.realtime-hero-stage__aside,
.readiness-summary__headline,
.nav-copy,
.global-banner span {
  color: var(--botanical-fg-soft);
}

.realtime-intel-card,
.readiness-summary__fact {
  border: 1px solid rgba(230, 226, 218, 0.9);
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.94),
    rgba(242, 240, 235, 0.74)
  );
  box-shadow: var(--botanical-shadow-sm);
}

.readiness-summary__details > summary {
  color: var(--botanical-primary-deep);
}
```

- [ ] **Step 4: 跑完整验证**

Run: `npm test -- --run`
Expected: `PASS`，并看到新增的 shell / hero / readiness / realtime 页面测试全部通过。

Run: `npm run typecheck`
Expected: 退出码为 `0`，无 TypeScript 错误。

Run: `npm run build`
Expected: `vite build` 成功结束，无样式或类型报错。

- [ ] **Step 5: 提交最终版首页重构**

```bash
git add \
  apps/desktop-ui/src/app/App.tsx \
  apps/desktop-ui/src/app/App.test.tsx \
  apps/desktop-ui/src/styles.css \
  apps/desktop-ui/src/themes/botanical-theme.css
git commit -m "feat: finish atrigal homepage redesign"
```
