# Widget Scene v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为桌面挂件增加统一的前端场景层，让挂件、实时页解释卡片和 mock 演示模式围绕同一套“角色反应”数据工作。

**Architecture:** 新增纯函数 `widgetScene.ts` 负责把实时快照和运行时状态转换为 `WidgetSceneView`。挂件组件和实时页只消费 `scene`，不再自己推断网络状态；mock bridge 轮播 5 个演示场景，保证无权限时也能稳定展示产品气质。

**Tech Stack:** React 18、TypeScript、Vite、Vitest

---

## 文件职责图

- Create: `apps/desktop-ui/src/data/widgetScene.ts`
  - 统一场景派生层，输出 `WidgetSceneView`
- Create: `apps/desktop-ui/src/data/widgetScene.test.ts`
  - 场景派生纯函数测试
- Create: `apps/desktop-ui/src/components/widget/TrafficWidgetCard.test.tsx`
  - 挂件组件渲染测试，验证标题、台词、解释文案来自 `scene`
- Create: `apps/desktop-ui/src/pages/RealtimePage.test.tsx`
  - 实时页解释卡片渲染测试
- Create: `apps/desktop-ui/src/bridge/mockDesktopBridge.test.ts`
  - 演示轮播场景测试
- Modify: `apps/desktop-ui/src/copy/galAbstract.ts`
  - 新增场景文案常量 `GAL_WIDGET_SCENE_COPY`
- Modify: `apps/desktop-ui/src/components/widget/TrafficWidgetCard.tsx`
  - 改为消费统一 `scene`
- Modify: `apps/desktop-ui/src/pages/RealtimePage.tsx`
  - 新增“她刚才为什么这样”解释卡片
- Modify: `apps/desktop-ui/src/bridge/mockDesktopBridge.ts`
  - 轮播 5 幕 demo 数据

## 执行约束

- 不修改 Rust 后端协议
- 不新增页面路由
- 优先写纯函数和渲染测试，再做组件改造
- 每个任务结束都提交一次 Git

### Task 1: 新增统一场景层

**Files:**
- Create: `apps/desktop-ui/src/data/widgetScene.ts`
- Create: `apps/desktop-ui/src/data/widgetScene.test.ts`
- Modify: `apps/desktop-ui/src/copy/galAbstract.ts`

- [ ] **Step 1: 写 `widgetScene` 的失败测试**

```ts
import { describe, expect, it } from "vitest";

import { resolveWidgetScene } from "./widgetScene";
import type {
  DashboardRuntimeView,
  RealtimeConnectionItem,
  RealtimeSnapshotView,
} from "../types/appData";

function createConnection(
  overrides: Partial<RealtimeConnectionItem> = {},
): RealtimeConnectionItem {
  return {
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
    ...overrides,
  };
}

function createSnapshot(
  overrides: Partial<RealtimeSnapshotView> = {},
): RealtimeSnapshotView {
  return {
    cycleLabel: "第 1 回 / 测试值守",
    uploadRate: "0 B/s",
    downloadRate: "0 B/s",
    widgetState: "idle",
    headline: "当前没有需要放大的活跃连接",
    captureMode: "ebpf",
    activeConnections: [],
    ...overrides,
  };
}

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
    lastUpdatedLabel: "刚同步",
    ...overrides,
  };
}

describe("resolveWidgetScene", () => {
  it("returns idle when there are no active connections", () => {
    const scene = resolveWidgetScene(createSnapshot(), createRuntime());
    expect(scene.sceneId).toBe("idle");
    expect(scene.stateLabel).toBe("安静值守");
    expect(scene.focusProcessName).toBeNull();
  });

  it("returns watching for low traffic active connections", () => {
    const scene = resolveWidgetScene(
      createSnapshot({
        activeConnections: [
          createConnection({
            uploadRate: "18 KB/s",
            uploadRateValue: 18 * 1024,
            downloadRate: "42 KB/s",
            downloadRateValue: 42 * 1024,
            totalRate: "60 KB/s",
            totalRateValue: 60 * 1024,
          }),
        ],
      }),
      createRuntime(),
    );

    expect(scene.sceneId).toBe("watching");
    expect(scene.reasonDetail).toContain("firefox");
  });

  it("returns busy_download when download dominates", () => {
    const scene = resolveWidgetScene(
      createSnapshot({
        activeConnections: [createConnection()],
      }),
      createRuntime(),
    );

    expect(scene.sceneId).toBe("busy_download");
    expect(scene.mood).toMatch(/happy|excited/);
  });

  it("returns busy_upload when upload dominates", () => {
    const scene = resolveWidgetScene(
      createSnapshot({
        activeConnections: [
          createConnection({
            direction: "上行",
            uploadRate: "2.3 MB/s",
            uploadRateValue: Math.round(2.3 * 1024 * 1024),
            downloadRate: "90 KB/s",
            downloadRateValue: 90 * 1024,
            totalRate: "2.4 MB/s",
            totalRateValue: Math.round(2.39 * 1024 * 1024),
          }),
        ],
      }),
      createRuntime(),
    );

    expect(scene.sceneId).toBe("busy_upload");
    expect(scene.reasonDetail).toContain("持续上传");
  });

  it("returns alert when runtime error exists", () => {
    const scene = resolveWidgetScene(
      createSnapshot({
        activeConnections: [createConnection()],
      }),
      createRuntime({
        errorMessage: "agentd 未连接",
      }),
    );

    expect(scene.sceneId).toBe("alert");
    expect(scene.reasonDetail).toContain("agentd 未连接");
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run:

```bash
cd apps/desktop-ui && npm test -- --run src/data/widgetScene.test.ts
```

Expected:

```text
FAIL  src/data/widgetScene.test.ts
Error: Failed to resolve import "./widgetScene"
```

- [ ] **Step 3: 新增场景文案常量并实现 `widgetScene.ts`**

在 `apps/desktop-ui/src/copy/galAbstract.ts` 追加：

```ts
export const GAL_WIDGET_SCENE_COPY = {
  idle: {
    stateLabel: "安静值守",
    reasonTitle: "现在没什么值得紧张的",
    lines: [
      "现在很安静呢。",
      "没有奇怪的动静。",
      "我先替你看着。",
      "今天暂时风平浪静。",
      "嗯，现在不用紧张。",
    ],
  },
  watching: {
    stateLabel: "正在盯梢",
    reasonTitle: "有点动静，我先看一眼",
    lines: [
      "有点动静，我看一眼。",
      "这个连接还在继续。",
      "先记下来，不急着下结论。",
      "嗯……它还在悄悄活动。",
      "现在有一点小动静。",
    ],
  },
  busy_download: {
    stateLabel: "下行热闹",
    reasonTitle: "这边一下子热闹起来了",
    lines: [
      "它正在拼命往回搬东西。",
      "这个目标今天很活跃哦。",
      "有人在往这边塞很多东西。",
      "这一条连接冲得很快。",
      "哇，这边一下子热闹起来了。",
    ],
  },
  busy_upload: {
    stateLabel: "上行活跃",
    reasonTitle: "它现在对外说得有点多",
    lines: [
      "等一下，它在往外发很多东西。",
      "这次是主动往外送呢。",
      "我先帮你盯紧这一条。",
      "这一波更像是在往外传。",
      "它现在对外说得有点多。",
    ],
  },
  alert: {
    stateLabel: "建议注意",
    reasonTitle: "这条连接值得看一眼",
    lines: [
      "这个家伙以前没见过。",
      "它已经偷偷连了很久了。",
      "这个动静不太像平时那样。",
      "等一下，这条我建议你看看。",
      "这次有点可疑，我先叫你一声。",
    ],
  },
} as const;
```

创建 `apps/desktop-ui/src/data/widgetScene.ts`：

```ts
import { GAL_NOTICE_COPY, GAL_WIDGET_SCENE_COPY } from "../copy/galAbstract";
import type {
  DashboardRuntimeView,
  RealtimeConnectionItem,
  RealtimeSnapshotView,
} from "../types/appData";

export type WidgetSceneId =
  | "idle"
  | "watching"
  | "busy_download"
  | "busy_upload"
  | "alert";

export type WidgetSceneMood =
  | "sleep"
  | "calm"
  | "curious"
  | "focus"
  | "happy"
  | "excited"
  | "alert"
  | "surprised"
  | "angry";

export interface WidgetSceneView {
  sceneId: WidgetSceneId;
  mood: WidgetSceneMood;
  stateLabel: string;
  title: string;
  line: string;
  overlayLead: string;
  guidance: string;
  reasonTitle: string;
  reasonDetail: string;
  focusProcessName: string | null;
  focusTarget: string | null;
  focusRateLabel: string | null;
}

const RATE_DOMINANCE_RATIO = 1.35;
const ACTIVE_RATE_THRESHOLD = 384 * 1024;

export function resolveWidgetScene(
  snapshot: RealtimeSnapshotView,
  runtime: DashboardRuntimeView,
): WidgetSceneView {
  const topConnection = getTopConnection(snapshot.activeConnections);
  const totalUpload = sumRate(snapshot.activeConnections, "uploadRateValue");
  const totalDownload = sumRate(snapshot.activeConnections, "downloadRateValue");
  const sceneId = deriveSceneId(snapshot, runtime, totalUpload, totalDownload);

  return {
    sceneId,
    mood: pickSceneMood(sceneId, topConnection),
    stateLabel: GAL_WIDGET_SCENE_COPY[sceneId].stateLabel,
    title: buildSceneTitle(sceneId, runtime, topConnection),
    line: pickSceneLine(sceneId, runtime, topConnection),
    overlayLead: buildOverlayLead(sceneId, snapshot.activeConnections.length, topConnection),
    guidance: buildGuidance(sceneId, snapshot, runtime),
    reasonTitle: buildReasonTitle(sceneId, runtime, topConnection),
    reasonDetail: buildReasonDetail(sceneId, snapshot, runtime, topConnection),
    focusProcessName: topConnection?.processName ?? null,
    focusTarget: topConnection?.target ?? null,
    focusRateLabel: topConnection?.totalRate ?? null,
  };
}

function deriveSceneId(
  snapshot: RealtimeSnapshotView,
  runtime: DashboardRuntimeView,
  totalUpload: number,
  totalDownload: number,
): WidgetSceneId {
  if (runtime.errorMessage || normalizeWidgetState(snapshot.widgetState) === "alerting") {
    return "alert";
  }

  if (snapshot.activeConnections.length === 0) {
    return "idle";
  }

  if (
    totalUpload >= totalDownload * RATE_DOMINANCE_RATIO &&
    totalUpload >= ACTIVE_RATE_THRESHOLD
  ) {
    return "busy_upload";
  }

  if (
    totalDownload >= totalUpload * RATE_DOMINANCE_RATIO &&
    totalDownload >= ACTIVE_RATE_THRESHOLD
  ) {
    return "busy_download";
  }

  return "watching";
}

function pickSceneMood(
  sceneId: WidgetSceneId,
  topConnection: RealtimeConnectionItem | undefined,
): WidgetSceneMood {
  switch (sceneId) {
    case "idle":
      return topConnection ? "calm" : "sleep";
    case "watching":
      return "curious";
    case "busy_download":
      return topConnection && topConnection.totalRateValue >= 8 * 1024 * 1024
        ? "excited"
        : "happy";
    case "busy_upload":
      return "focus";
    case "alert":
      return "alert";
  }
}

function buildSceneTitle(
  sceneId: WidgetSceneId,
  runtime: DashboardRuntimeView,
  topConnection: RealtimeConnectionItem | undefined,
) {
  if (sceneId === "alert" && (runtime.errorMessage || !topConnection)) {
    return "当前链路需要注意";
  }

  if (!topConnection) {
    return sceneId === "idle" ? "海面平静" : "正在值守";
  }

  switch (sceneId) {
    case "idle":
      return "海面平静";
    case "watching":
      return `${topConnection.processName} 引起注意`;
    case "busy_download":
      return `${topConnection.processName} 正在吃流量`;
    case "busy_upload":
      return `${topConnection.processName} 正在往外发`;
    case "alert":
      return "这条连接值得看一眼";
  }
}

function buildReasonTitle(
  sceneId: WidgetSceneId,
  runtime: DashboardRuntimeView,
  topConnection: RealtimeConnectionItem | undefined,
) {
  if (sceneId === "alert" && (runtime.errorMessage || !topConnection)) {
    return "当前链路需要注意";
  }

  return GAL_WIDGET_SCENE_COPY[sceneId].reasonTitle;
}

function buildReasonDetail(
  sceneId: WidgetSceneId,
  snapshot: RealtimeSnapshotView,
  runtime: DashboardRuntimeView,
  topConnection: RealtimeConnectionItem | undefined,
) {
  if (runtime.errorMessage) {
    return runtime.errorMessage;
  }

  if (sceneId === "alert" && !topConnection) {
    return "当前触发了提醒状态，但还没有榜首连接可展示。";
  }

  if (!topConnection) {
    return "当前没有明显活跃连接，挂件会继续在后台值守。";
  }

  switch (sceneId) {
    case "idle":
      return "现在没有明显热点连接。";
    case "watching":
      return `${topConnection.processName} 仍在连接 ${topConnection.target}。`;
    case "busy_download":
      return `${topConnection.processName} 正在从 ${topConnection.target} 持续下载。`;
    case "busy_upload":
      return `${topConnection.processName} 正在向 ${topConnection.target} 持续上传数据。`;
    case "alert":
      return snapshot.captureMode === "proc_fallback"
        ? `${topConnection.processName} 当前最显眼，建议先确认这条连接。`
        : `${topConnection.processName} 当前行为比平时更值得注意。`;
  }
}

function buildOverlayLead(
  sceneId: WidgetSceneId,
  connectionCount: number,
  topConnection: RealtimeConnectionItem | undefined,
) {
  if (sceneId === "alert" && (!topConnection || connectionCount === 0)) {
    return "当前处于提醒状态，建议立即打开主界面确认。";
  }

  if (!topConnection || connectionCount === 0) {
    return "这会儿还没人抢镜。";
  }

  switch (sceneId) {
    case "idle":
      return "现在没有明显热点。";
    case "watching":
      return `${connectionCount} 条连接里，${topConnection.processName} 最值得先看。`;
    case "busy_download":
      return `${topConnection.processName} 当前以下行流量为主。`;
    case "busy_upload":
      return `${topConnection.processName} 当前以上行流量为主。`;
    case "alert":
      return "这一波建议优先点进去确认。";
  }
}

function buildGuidance(
  sceneId: WidgetSceneId,
  snapshot: RealtimeSnapshotView,
  runtime: DashboardRuntimeView,
) {
  if (runtime.errorMessage) {
    return GAL_NOTICE_COPY.widget.errorGuidance;
  }

  if (snapshot.captureMode === "proc_fallback") {
    return GAL_NOTICE_COPY.widget.fallbackGuidance;
  }

  switch (sceneId) {
    case "idle":
      return "继续值守，有动静我会先提醒你。";
    case "watching":
      return "先看热点流量第一条，确认它在连谁。";
    case "busy_download":
      return "先看当前榜首连接，确认它在从哪里下载。";
    case "busy_upload":
      return "先看当前榜首连接，确认它在往哪里发送。";
    case "alert":
      return "建议立即点开主界面，先看当前榜首连接。";
  }
}

function pickSceneLine(
  sceneId: WidgetSceneId,
  runtime: DashboardRuntimeView,
  topConnection: RealtimeConnectionItem | undefined,
) {
  if (sceneId === "alert" && (runtime.errorMessage || !topConnection)) {
    return "我先提醒你看一眼。";
  }

  const lines = GAL_WIDGET_SCENE_COPY[sceneId].lines;
  const seed = topConnection?.sessionId ?? sceneId;
  return lines[stableIndex(seed, lines.length)];
}

function stableIndex(seed: string, size: number) {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  }
  return hash % size;
}

function getTopConnection(items: RealtimeConnectionItem[]) {
  return [...items].sort((left, right) => right.totalRateValue - left.totalRateValue)[0];
}

function sumRate(
  items: RealtimeConnectionItem[],
  key: "uploadRateValue" | "downloadRateValue",
) {
  return items.reduce((sum, item) => sum + item[key], 0);
}

function normalizeWidgetState(widgetState: string) {
  return widgetState.trim().toLowerCase();
}
```

- [ ] **Step 4: 运行测试，确认 `widgetScene` 通过**

Run:

```bash
cd apps/desktop-ui && npm test -- --run src/data/widgetScene.test.ts
```

Expected:

```text
✓ src/data/widgetScene.test.ts
5 passed
```

- [ ] **Step 5: 提交任务 1**

```bash
git add apps/desktop-ui/src/copy/galAbstract.ts \
  apps/desktop-ui/src/data/widgetScene.ts \
  apps/desktop-ui/src/data/widgetScene.test.ts
git commit -m "feat: add widget scene resolver"
```

### Task 2: 重构挂件组件消费统一场景

**Files:**
- Modify: `apps/desktop-ui/src/components/widget/TrafficWidgetCard.tsx`
- Create: `apps/desktop-ui/src/components/widget/TrafficWidgetCard.test.tsx`

- [ ] **Step 1: 写挂件渲染失败测试**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import TrafficWidgetCard from "./TrafficWidgetCard";
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
  captureMode: "ebpf",
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
  isFallback: false,
  mode: "live",
  errorMessage: null,
  sourceLabel: "真实观测",
  lastUpdatedLabel: "刚同步",
};

describe("TrafficWidgetCard", () => {
  it("renders scene title, line and reason from widget scene", () => {
    const html = renderToStaticMarkup(
      <TrafficWidgetCard
        snapshot={snapshot}
        runtime={runtime}
        mode="panel"
        primaryActionLabel="打开观察室"
        onPrimaryAction={vi.fn()}
      />,
    );

    expect(html).toContain("下行热闹");
    expect(html).toContain("这边一下子热闹起来了");
    expect(html).toContain("持续下载");
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run:

```bash
cd apps/desktop-ui && npm test -- --run src/components/widget/TrafficWidgetCard.test.tsx
```

Expected:

```text
FAIL  src/components/widget/TrafficWidgetCard.test.tsx
Expected substring: "下行热闹"
```

- [ ] **Step 3: 重构挂件组件，改为消费 `scene`**

在 `apps/desktop-ui/src/components/widget/TrafficWidgetCard.tsx` 增加 import：

```ts
import {
  resolveWidgetScene,
  type WidgetSceneId,
  type WidgetSceneMood,
  type WidgetSceneView,
} from "../../data/widgetScene";
```

把组件顶部的核心状态改成：

```ts
const rankedConnections = sortConnections(snapshot.activeConnections).slice(0, 3);
const topConnection = rankedConnections[0];
const scene = resolveWidgetScene(snapshot, runtime);
const bubble = useWidgetBubble(scene, topConnection, runtime);
const atriSprite = ATRI_SPRITES[scene.mood][layoutMode];
const toneClass = getSceneToneClass(scene.sceneId);
```

把标题、状态标签、气泡、headline、overlay 和 hint 统一改成 `scene`：

```tsx
<section
  className={`traffic-widget traffic-widget--${mode} is-${toneClass} is-${layoutMode}`}
  style={widgetStyle}
>
```

```tsx
<div className="traffic-widget__masthead-copy">
  <span className="traffic-widget__serial">
    {layoutMode === "character-first" ? "Watch Scene" : "Traffic Stage"}
  </span>
  <strong>{scene.title}</strong>
</div>
<span className="traffic-widget__state-pill">{scene.stateLabel}</span>
```

```tsx
{bubble ? (
  <div className="traffic-widget__bubble">
    <span>{bubble.kicker}</span>
    <p>{bubble.line}</p>
  </div>
) : (
  <div className="traffic-widget__bubble">
    <span>{scene.reasonTitle}</span>
    <p>{scene.line}</p>
  </div>
)}
```

```tsx
<div className="traffic-widget__headline">
  <strong title={scene.reasonDetail}>{scene.reasonTitle}</strong>
  <span>{scene.reasonDetail}</span>
</div>
```

```tsx
<div className="traffic-widget__overlay-copy">
  <span className="traffic-widget__overlay-eyebrow">
    {layoutMode === "character-first" ? "流量排行" : "实时榜单"}
  </span>
  <p>{scene.overlayLead}</p>
</div>

{!isCompact ? (
  <p className="traffic-widget__hint">{scene.guidance}</p>
) : null}
```

把 `useWidgetBubble` 签名改成：

```ts
function useWidgetBubble(
  scene: WidgetSceneView,
  topConnection: RealtimeConnectionItem | undefined,
  runtime: DashboardRuntimeView,
) {
  const [bubble, setBubble] = useState<WidgetBubble | null>(null);
  const signatureRef = useRef<{
    sceneId: WidgetSceneId;
    focusKey: string | null;
    hasError: boolean;
  } | null>(null);

  useEffect(() => {
    const current = {
      sceneId: scene.sceneId,
      focusKey: topConnection
        ? `${topConnection.processName}-${topConnection.target}`
        : null,
      hasError: Boolean(runtime.errorMessage),
    };

    const previous = signatureRef.current;
    signatureRef.current = current;

    if (!previous) {
      return;
    }

    if (current.hasError && !previous.hasError) {
      setBubble(createBubble("runtime-error", "守望姬警报", scene.line, "alert"));
      return;
    }

    if (current.sceneId !== previous.sceneId) {
      setBubble(
        createBubble(
          `scene-${current.sceneId}`,
          scene.reasonTitle,
          scene.line,
          scene.mood as WidgetSceneMood,
        ),
      );
      return;
    }

    if (current.focusKey && current.focusKey !== previous.focusKey) {
      setBubble(createBubble(`focus-${current.focusKey}`, "目标切换", scene.line, scene.mood));
    }
  }, [scene, topConnection, runtime.errorMessage]);

  useEffect(() => {
    if (!bubble) {
      return;
    }

    const timer = window.setTimeout(() => {
      setBubble(null);
    }, 5_200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [bubble?.id]);

  return bubble;
}
```

新增兼容样式映射：

```ts
function getSceneToneClass(sceneId: WidgetSceneId) {
  switch (sceneId) {
    case "idle":
      return "idle";
    case "watching":
      return "idle";
    case "busy_download":
      return "download";
    case "busy_upload":
      return "upload";
    case "alert":
      return "alerting";
  }
}
```

- [ ] **Step 4: 运行挂件测试和场景测试**

Run:

```bash
cd apps/desktop-ui && npm test -- --run \
  src/data/widgetScene.test.ts \
  src/components/widget/TrafficWidgetCard.test.tsx
```

Expected:

```text
✓ src/data/widgetScene.test.ts
✓ src/components/widget/TrafficWidgetCard.test.tsx
2 files passed
```

- [ ] **Step 5: 提交任务 2**

```bash
git add apps/desktop-ui/src/components/widget/TrafficWidgetCard.tsx \
  apps/desktop-ui/src/components/widget/TrafficWidgetCard.test.tsx
git commit -m "feat: drive widget card from scene view"
```

### Task 3: 在实时页增加解释闭环

**Files:**
- Modify: `apps/desktop-ui/src/pages/RealtimePage.tsx`
- Create: `apps/desktop-ui/src/pages/RealtimePage.test.tsx`

- [ ] **Step 1: 写实时页解释卡片失败测试**

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
  captureMode: "ebpf",
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
  agentStatus: "healthy",
  captureMode: "ebpf",
  databaseStatus: "healthy",
  degradedReason: null,
  permissionSummary: "权限正常",
  socketPath: "/run/traffic-cat/agentd.sock",
  databasePath: "/var/lib/traffic-cat/traffic.db",
  platform: "linux",
  platformLabel: "Linux",
  supportLabel: "首发平台",
  platformSummary: "当前平台支持正常。",
  capabilityLabel: "真实观测",
  capabilitySummary: "当前界面正在读取真实快照。",
  recommendedAction: "先看当前榜首连接。",
  setupChecklist: [],
};

const runtime: DashboardRuntimeView = {
  isLoading: false,
  isRefreshing: false,
  isFallback: false,
  mode: "live",
  errorMessage: null,
  sourceLabel: "真实观测",
  lastUpdatedLabel: "刚同步",
};

describe("RealtimePage", () => {
  it("renders the widget explanation card", () => {
    const html = renderToStaticMarkup(
      <RealtimePage
        snapshot={snapshot}
        diagnostics={diagnostics}
        runtime={runtime}
        onRefresh={vi.fn(async () => undefined)}
      />,
    );

    expect(html).toContain("她刚才为什么这样");
    expect(html).toContain("firefox");
    expect(html).toContain("持续下载");
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run:

```bash
cd apps/desktop-ui && npm test -- --run src/pages/RealtimePage.test.tsx
```

Expected:

```text
FAIL  src/pages/RealtimePage.test.tsx
Expected substring: "她刚才为什么这样"
```

- [ ] **Step 3: 在实时页新增解释卡片**

在 `apps/desktop-ui/src/pages/RealtimePage.tsx` 增加 import：

```ts
import { resolveWidgetScene } from "../data/widgetScene";
```

在组件顶部新增：

```ts
const widgetScene = resolveWidgetScene(snapshot, runtime);
```

在挂件预览区域之后插入解释卡片：

```tsx
<SectionCard
  eyebrow="挂件解释"
  title="她刚才为什么这样"
  summary="把角色当前反应、触发原因和下一步动作放在同一块里看清。"
>
  <div className="signal-grid">
    <article className="signal-card">
      <span>当前状态</span>
      <strong>{widgetScene.stateLabel}</strong>
      <p>{widgetScene.line}</p>
    </article>

    <article className="signal-card">
      <span>{widgetScene.reasonTitle}</span>
      <strong>{widgetScene.focusProcessName ?? "当前没有重点对象"}</strong>
      <p>{widgetScene.reasonDetail}</p>
    </article>

    <article className="signal-card">
      <span>建议动作</span>
      <strong>先看热点流量第一条</strong>
      <p>{widgetScene.guidance}</p>
    </article>
  </div>
</SectionCard>
```

- [ ] **Step 4: 运行页面渲染测试**

Run:

```bash
cd apps/desktop-ui && npm test -- --run \
  src/data/widgetScene.test.ts \
  src/components/widget/TrafficWidgetCard.test.tsx \
  src/pages/RealtimePage.test.tsx
```

Expected:

```text
✓ src/data/widgetScene.test.ts
✓ src/components/widget/TrafficWidgetCard.test.tsx
✓ src/pages/RealtimePage.test.tsx
3 files passed
```

- [ ] **Step 5: 提交任务 3**

```bash
git add apps/desktop-ui/src/pages/RealtimePage.tsx \
  apps/desktop-ui/src/pages/RealtimePage.test.tsx
git commit -m "feat: explain widget reactions on realtime page"
```

### Task 4: 为 mock bridge 增加 5 幕轮播 demo

**Files:**
- Modify: `apps/desktop-ui/src/bridge/mockDesktopBridge.ts`
- Create: `apps/desktop-ui/src/bridge/mockDesktopBridge.test.ts`

- [ ] **Step 1: 写 demo 轮播失败测试**

```ts
import { describe, expect, it } from "vitest";

import {
  buildDashboardPayloadForDemo,
  getDemoSceneId,
} from "./mockDesktopBridge";

describe("mock desktop bridge demo scenes", () => {
  it("rotates through five demo scenes", () => {
    expect(getDemoSceneId(0)).toBe("idle");
    expect(getDemoSceneId(4_000)).toBe("watching");
    expect(getDemoSceneId(8_000)).toBe("busy_download");
    expect(getDemoSceneId(12_000)).toBe("busy_upload");
    expect(getDemoSceneId(16_000)).toBe("alert");
  });

  it("builds an alert payload for the alert scene", () => {
    const payload = buildDashboardPayloadForDemo(16_000);
    const live = JSON.parse(payload.liveJson) as {
      widget_state: string;
      items: Array<{ process_name: string }>;
    };

    expect(live.widget_state).toBe("alerting");
    expect(live.items[0]?.process_name).toBe("syncthing");
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run:

```bash
cd apps/desktop-ui && npm test -- --run src/bridge/mockDesktopBridge.test.ts
```

Expected:

```text
FAIL  src/bridge/mockDesktopBridge.test.ts
Error: No matching export "getDemoSceneId"
```

- [ ] **Step 3: 导出演示函数并按时间片轮播 5 幕**

在 `apps/desktop-ui/src/bridge/mockDesktopBridge.ts` 顶部新增：

```ts
type DemoSceneId =
  | "idle"
  | "watching"
  | "busy_download"
  | "busy_upload"
  | "alert";

const DEMO_SCENE_DURATION_MS = 4_000;
```

新增导出函数：

```ts
export function getDemoSceneId(now: number): DemoSceneId {
  const index = Math.floor(now / DEMO_SCENE_DURATION_MS) % 5;
  return ["idle", "watching", "busy_download", "busy_upload", "alert"][index] as DemoSceneId;
}
```

新增基于时间的 payload 构造器：

```ts
export function buildDashboardPayloadForDemo(now: number): AgentDashboardPayload {
  const sceneId = getDemoSceneId(now);
  const scene = DEMO_SCENES[sceneId];

  return {
    healthJson: JSON.stringify(scene.health(now)),
    statusJson: JSON.stringify(scene.status),
    liveJson: JSON.stringify(scene.live(now)),
    alertsJson: JSON.stringify(scene.alerts(now)),
  };
}
```

把原来的 `buildDashboardPayload()` 改成：

```ts
function buildDashboardPayload(): AgentDashboardPayload {
  return buildDashboardPayloadForDemo(Date.now());
}
```

定义 5 幕 demo 场景：

```ts
const DEMO_SCENES = {
  idle: {
    status: {
      service_status: "healthy",
      capture_mode: "ebpf",
      permission_status: "healthy",
      db_status: "healthy",
      degraded_reason: null,
    },
    health: (now: number) => ({
      generated_at: now,
      uds_path: "/run/traffic-cat/agentd.sock",
      permissions: {
        ready: true,
        details: GAL_MOCK_COPY.bridge.permissionDetails,
      },
      capture: {
        mode: "ebpf",
        state: "healthy",
        last_sample_at: now - 500,
        details: GAL_MOCK_COPY.bridge.captureDetails,
      },
      store: {
        state: "healthy",
        database_path: "/var/lib/traffic-cat/traffic.db.snapshot",
      },
    }),
    live: (now: number) => ({
      generated_at: now,
      widget_state: "idle",
      capture_mode: "ebpf",
      upload_rate_bytes_per_sec: 0,
      download_rate_bytes_per_sec: 0,
      headline: "现在很安静",
      items: [],
    }),
    alerts: () => ({ items: [] }),
  },
  watching: {
    status: {
      service_status: "healthy",
      capture_mode: "ebpf",
      permission_status: "healthy",
      db_status: "healthy",
      degraded_reason: null,
    },
    health: (now: number) => ({
      generated_at: now,
      uds_path: "/run/traffic-cat/agentd.sock",
      permissions: {
        ready: true,
        details: GAL_MOCK_COPY.bridge.permissionDetails,
      },
      capture: {
        mode: "ebpf",
        state: "healthy",
        last_sample_at: now - 500,
        details: GAL_MOCK_COPY.bridge.captureDetails,
      },
      store: {
        state: "healthy",
        database_path: "/var/lib/traffic-cat/traffic.db.snapshot",
      },
    }),
    live: (now: number) => ({
      generated_at: now,
      widget_state: "idle",
      capture_mode: "ebpf",
      upload_rate_bytes_per_sec: 18 * 1024,
      download_rate_bytes_per_sec: 42 * 1024,
      headline: "code -> api.github.com:443",
      items: [
        {
          session_id: "code-api-443",
          process_name: "code",
          remote_host: "api.github.com",
          direction: "Outbound",
          protocol: "Tcp",
          current_tx_rate: 18 * 1024,
          current_rx_rate: 42 * 1024,
          last_seen_at: now - 1_000,
        },
      ],
    }),
    alerts: () => ({ items: [] }),
  },
  busy_download: {
    status: {
      service_status: "healthy",
      capture_mode: "ebpf",
      permission_status: "healthy",
      db_status: "healthy",
      degraded_reason: null,
    },
    health: (now: number) => ({
      generated_at: now,
      uds_path: "/run/traffic-cat/agentd.sock",
      permissions: {
        ready: true,
        details: GAL_MOCK_COPY.bridge.permissionDetails,
      },
      capture: {
        mode: "ebpf",
        state: "healthy",
        last_sample_at: now - 500,
        details: GAL_MOCK_COPY.bridge.captureDetails,
      },
      store: {
        state: "healthy",
        database_path: "/var/lib/traffic-cat/traffic.db.snapshot",
      },
    }),
    live: (now: number) => ({
      generated_at: now,
      widget_state: "download_active",
      capture_mode: "ebpf",
      upload_rate_bytes_per_sec: 120 * 1024,
      download_rate_bytes_per_sec: Math.round(4.7 * 1024 * 1024),
      headline: "firefox -> cdn.example.net:443",
      items: [
        {
          session_id: "firefox-cdn-443",
          process_name: "firefox",
          remote_host: "cdn.example.net",
          direction: "Inbound",
          protocol: "Tcp",
          current_tx_rate: 120 * 1024,
          current_rx_rate: Math.round(4.7 * 1024 * 1024),
          last_seen_at: now - 1_000,
        },
      ],
    }),
    alerts: () => ({ items: [] }),
  },
  busy_upload: {
    status: {
      service_status: "healthy",
      capture_mode: "ebpf",
      permission_status: "healthy",
      db_status: "healthy",
      degraded_reason: null,
    },
    health: (now: number) => ({
      generated_at: now,
      uds_path: "/run/traffic-cat/agentd.sock",
      permissions: {
        ready: true,
        details: GAL_MOCK_COPY.bridge.permissionDetails,
      },
      capture: {
        mode: "ebpf",
        state: "healthy",
        last_sample_at: now - 500,
        details: GAL_MOCK_COPY.bridge.captureDetails,
      },
      store: {
        state: "healthy",
        database_path: "/var/lib/traffic-cat/traffic.db.snapshot",
      },
    }),
    live: (now: number) => ({
      generated_at: now,
      widget_state: "upload_active",
      capture_mode: "ebpf",
      upload_rate_bytes_per_sec: Math.round(2.3 * 1024 * 1024),
      download_rate_bytes_per_sec: 90 * 1024,
      headline: "syncthing -> 10.0.0.25:22000",
      items: [
        {
          session_id: "syncthing-lan-22000",
          process_name: "syncthing",
          remote_host: "10.0.0.25",
          direction: "Outbound",
          protocol: "Tcp",
          current_tx_rate: Math.round(2.3 * 1024 * 1024),
          current_rx_rate: 90 * 1024,
          last_seen_at: now - 1_000,
        },
      ],
    }),
    alerts: () => ({ items: [] }),
  },
  alert: {
    status: {
      service_status: "degraded",
      capture_mode: "proc_fallback",
      permission_status: "healthy",
      db_status: "healthy",
      degraded_reason: GAL_MOCK_COPY.bridge.degradedReason,
    },
    health: (now: number) => ({
      generated_at: now,
      uds_path: "/run/traffic-cat/agentd.sock",
      permissions: {
        ready: true,
        details: GAL_MOCK_COPY.bridge.permissionDetails,
      },
      capture: {
        mode: "proc_fallback",
        state: "degraded",
        last_sample_at: now - 500,
        details: GAL_MOCK_COPY.bridge.captureDetails,
      },
      store: {
        state: "healthy",
        database_path: "/var/lib/traffic-cat/traffic.db.snapshot",
      },
    }),
    live: (now: number) => ({
      generated_at: now,
      widget_state: "alerting",
      capture_mode: "proc_fallback",
      upload_rate_bytes_per_sec: 640 * 1024,
      download_rate_bytes_per_sec: Math.round(5.2 * 1024 * 1024),
      headline: "syncthing -> 10.0.0.25:22000",
      items: [
        {
          session_id: "syncthing-alert-22000",
          process_name: "syncthing",
          remote_host: "10.0.0.25",
          direction: "Outbound",
          protocol: "Tcp",
          current_tx_rate: 640 * 1024,
          current_rx_rate: Math.round(5.2 * 1024 * 1024),
          last_seen_at: now - 1_000,
        },
      ],
    }),
    alerts: (now: number) => ({
      items: [
        {
          id: "mock-alert-syncthing",
          alert_type: "PersistentBackgroundTraffic",
          process_name: "syncthing",
          pid: 2199,
          remote_host: "10.0.0.25",
          created_at: now - 30_000,
          title: GAL_MOCK_COPY.bridge.alertBannerTitle,
          body: GAL_MOCK_COPY.bridge.recentAlertSyncthing,
        },
      ],
    }),
  },
} as const;
```

- [ ] **Step 4: 运行 mock bridge 测试**

Run:

```bash
cd apps/desktop-ui && npm test -- --run src/bridge/mockDesktopBridge.test.ts
```

Expected:

```text
✓ src/bridge/mockDesktopBridge.test.ts
2 passed
```

- [ ] **Step 5: 提交任务 4**

```bash
git add apps/desktop-ui/src/bridge/mockDesktopBridge.ts \
  apps/desktop-ui/src/bridge/mockDesktopBridge.test.ts
git commit -m "feat: rotate widget demo scenes in mock bridge"
```

### Task 5: 全量验证与收尾

**Files:**
- Verify only: `apps/desktop-ui/src/**/*`

- [ ] **Step 1: 运行前端全部测试**

Run:

```bash
cd apps/desktop-ui && npm test -- --run
```

Expected:

```text
PASS  src/data/widgetScene.test.ts
PASS  src/components/widget/TrafficWidgetCard.test.tsx
PASS  src/pages/RealtimePage.test.tsx
PASS  src/bridge/mockDesktopBridge.test.ts
```

- [ ] **Step 2: 运行类型检查**

Run:

```bash
cd apps/desktop-ui && npm run typecheck
```

Expected:

```text
TypeScript 检查通过，命令退出码为 0，终端中不出现 error TS
```

- [ ] **Step 3: 运行构建**

Run:

```bash
cd apps/desktop-ui && npm run build
```

Expected:

```text
出现 "vite v5" 和 "built in" 两行，命令退出码为 0，终端中不出现 error
```

- [ ] **Step 4: 手工冒烟检查**

在浏览器或 Tauri 壳内依次确认：

```text
1. idle 场景下挂件显示“安静值守”类文案
2. download_active 时挂件标题、台词和解释文案同步切到下行热闹
3. 上传场景时 guidance 提示“先看当前榜首连接，确认它在往哪里发送”
4. RealtimePage 上出现“她刚才为什么这样”卡片
5. mock 模式约每 4 秒切到下一幕
```

- [ ] **Step 5: 提交最终集成**

```bash
git add apps/desktop-ui/src
git commit -m "feat: add widget scene v0.1 flow"
```
