import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { DiagnosticsSnapshotView } from "../../types/appData";
import ReadinessSummaryCard from "./ReadinessSummaryCard";

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
  it("把准备度收成更短的状态句和 details 入口", () => {
    const html = renderToStaticMarkup(
      <ReadinessSummaryCard diagnostics={diagnostics} />,
    );

    expect(html).toContain("这台机器现在能看到多少");
    expect(html).toContain("还差一点，我帮你盯着。");
    expect(html).toContain("Linux 优先支持。");
    expect(html).toContain("先看大方向，细节再补。");
    expect(html).toContain("展开启动检查");
    expect(html).not.toContain("先把 agentd 接上，再确认速率可信度。");
    expect(html).not.toContain("Linux 端可以继续值守。");
    expect(html).not.toContain("现在先用 /proc 把大方向盯住。");
  });
});
