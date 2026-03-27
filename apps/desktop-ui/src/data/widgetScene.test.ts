import { describe, expect, it } from "vitest";
import type {
  DashboardRuntimeView,
  RealtimeConnectionItem,
  RealtimeSnapshotView,
} from "../types/appData";
import { GAL_NOTICE_COPY, GAL_WIDGET_SCENE_COPY } from "../copy/galAbstract";
import { resolveWidgetScene } from "./widgetScene";

function createConnection(
  overrides: Partial<RealtimeConnectionItem> = {},
): RealtimeConnectionItem {
  return {
    sessionId: "session-1",
    processName: "firefox",
    target: "cdn.example.net:443",
    localPortLabel: "本地端口 53124",
    direction: "下行",
    protocol: "TCP",
    uploadRate: "64 KB/s",
    uploadRateValue: 64 * 1024,
    downloadRate: "128 KB/s",
    downloadRateValue: 128 * 1024,
    totalRate: "192 KB/s",
    totalRateValue: 192 * 1024,
    lastSeenLabel: "刚刚",
    ...overrides,
  };
}

function createSnapshot(
  overrides: Partial<RealtimeSnapshotView> = {},
): RealtimeSnapshotView {
  return {
    cycleLabel: "第 1 回合",
    uploadRate: "0 KB/s",
    downloadRate: "0 KB/s",
    widgetState: "idle",
    headline: "暂无热点",
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
    lastUpdatedLabel: "刚刚",
    ...overrides,
  };
}

describe("resolveWidgetScene", () => {
  it("无活跃连接时返回 idle", () => {
    const scene = resolveWidgetScene(createSnapshot(), createRuntime());
    expect(scene.sceneId).toBe("idle");
    expect(scene.stateLabel).toBe("安静值守");
  });

  it("低流量活跃连接时返回 watching", () => {
    const scene = resolveWidgetScene(
      createSnapshot({
        activeConnections: [
          createConnection({
            processName: "firefox",
            uploadRateValue: 48 * 1024,
            downloadRateValue: 72 * 1024,
            totalRateValue: 120 * 1024,
          }),
        ],
      }),
      createRuntime(),
    );

    expect(scene.sceneId).toBe("watching");
    expect(scene.reasonDetail).toContain("firefox");
    expect(scene.title).toBe("firefox 引起注意");
    expect(scene.reasonDetail).toBe("firefox 仍在连接 cdn.example.net:443。");
    expect(scene.overlayLead).toBe("1 条连接里，firefox 最值得先看。");
  });

  it("下载主导时返回 busy_download", () => {
    const scene = resolveWidgetScene(
      createSnapshot({
        activeConnections: [
          createConnection({
            uploadRateValue: 180 * 1024,
            downloadRateValue: 900 * 1024,
            totalRateValue: 1080 * 1024,
          }),
        ],
      }),
      createRuntime(),
    );

    expect(scene.sceneId).toBe("busy_download");
    expect(scene.mood).toMatch(/happy|excited/);
  });

  it("上传主导时返回 busy_upload", () => {
    const scene = resolveWidgetScene(
      createSnapshot({
        activeConnections: [
          createConnection({
            processName: "syncthing",
            uploadRateValue: 1024 * 1024,
            downloadRateValue: 120 * 1024,
            totalRateValue: Math.round(1.14 * 1024 * 1024),
          }),
        ],
      }),
      createRuntime(),
    );

    expect(scene.sceneId).toBe("busy_upload");
    expect(scene.reasonDetail).toContain("持续上传");
  });

  it("runtime error 时返回 alert", () => {
    const scene = resolveWidgetScene(
      createSnapshot({
        widgetState: "idle",
        activeConnections: [createConnection()],
      }),
      createRuntime({
        errorMessage: "agentd 未连接",
      }),
    );

    expect(scene.sceneId).toBe("alert");
    expect(scene.reasonDetail).toContain("agentd 未连接");
    expect(scene.reasonDetail).toBe("agentd 未连接");
    expect(scene.reasonTitle).not.toBe(GAL_WIDGET_SCENE_COPY.alert.reasonTitle);
    expect(GAL_WIDGET_SCENE_COPY.alert.lines).not.toContain(scene.line);
  });

  it("同一 sessionId 下台词保持稳定，不受周期或更新时间影响", () => {
    const connection = createConnection({
      sessionId: "stable-session-id",
      processName: "syncthing",
      target: "10.0.0.25:22000",
      uploadRateValue: 128 * 1024,
      downloadRateValue: 128 * 1024,
      totalRateValue: 256 * 1024,
    });

    const sceneA = resolveWidgetScene(
      createSnapshot({
        cycleLabel: "第 1 回合",
        activeConnections: [connection],
      }),
      createRuntime({
        lastUpdatedLabel: "刚刚",
      }),
    );

    const sceneB = resolveWidgetScene(
      createSnapshot({
        cycleLabel: "第 9 回合",
        activeConnections: [connection],
      }),
      createRuntime({
        lastUpdatedLabel: "2 分钟前",
      }),
    );

    expect(sceneA.sceneId).toBe("watching");
    expect(sceneB.sceneId).toBe("watching");
    expect(sceneA.line).toBe(sceneB.line);
  });

  it("widgetState=alerting 且无连接时保持 alert 语义，不退回中性文案", () => {
    const scene = resolveWidgetScene(
      createSnapshot({
        widgetState: "alerting",
        activeConnections: [],
      }),
      createRuntime(),
    );

    expect(scene.sceneId).toBe("alert");
    expect(scene.title).not.toBe("正在值守");
    expect(scene.reasonDetail).not.toContain(
      "当前没有明显活跃连接，挂件会继续在后台值守。",
    );
    expect(scene.overlayLead).not.toBe("这会儿还没人抢镜。");
    expect(scene.reasonTitle).not.toBe(GAL_WIDGET_SCENE_COPY.alert.reasonTitle);
    expect(GAL_WIDGET_SCENE_COPY.alert.lines).not.toContain(scene.line);
  });

  it("proc_fallback 模式下 guidance 复用 fallbackGuidance", () => {
    const scene = resolveWidgetScene(
      createSnapshot({
        captureMode: "proc_fallback",
        activeConnections: [createConnection()],
      }),
      createRuntime(),
    );

    expect(scene.guidance).toBe(GAL_NOTICE_COPY.widget.fallbackGuidance);
  });
});
