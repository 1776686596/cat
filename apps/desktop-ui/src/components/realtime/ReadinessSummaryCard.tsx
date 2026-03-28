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
  const summary = getReadinessSummary(needsAttention);
  const headline = getReadinessHeadline(diagnostics, needsAttention);
  const platformDetail = getPlatformDetail(diagnostics);
  const capabilityDetail = getCapabilityDetail(diagnostics, needsAttention);

  return (
    <SectionCard
      eyebrow="观测准备度"
      title="这台机器现在能看到多少"
      summary={summary}
      badge={diagnostics.capabilityLabel}
      badgeTone={needsAttention ? "warn" : "normal"}
    >
      <div className="readiness-summary">
        <p className="readiness-summary__headline">{headline}</p>

        <div className="readiness-summary__facts">
          <div className="readiness-summary__fact">
            <span>平台</span>
            <strong>{diagnostics.platformLabel}</strong>
            <p>{platformDetail}</p>
          </div>
          <div className="readiness-summary__fact">
            <span>观测能力</span>
            <strong>{diagnostics.capabilityLabel}</strong>
            <p>{capabilityDetail}</p>
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

function getReadinessSummary(needsAttention: boolean) {
  return needsAttention ? "还差一点，我帮你盯着。" : "已经接好了，放心看吧。";
}

function getReadinessHeadline(
  diagnostics: DiagnosticsSnapshotView,
  needsAttention: boolean,
) {
  if (needsAttention && diagnostics.captureMode === "proc_fallback") {
    return "先补授权，再看细节。";
  }

  if (needsAttention) {
    return "先把关键一步补上。";
  }

  if (diagnostics.captureMode === "live") {
    return "完整链路已经接上。";
  }

  return "现在先看基础动静。";
}

function getPlatformDetail(diagnostics: DiagnosticsSnapshotView) {
  switch (diagnostics.platform) {
    case "linux":
      return "Linux 优先支持。";
    case "windows":
      return "Windows 版本还在准备。";
    case "macos":
      return "macOS 版本还在准备。";
    case "unknown":
      return "当前平台还没认出来。";
  }
}

function getCapabilityDetail(
  diagnostics: DiagnosticsSnapshotView,
  needsAttention: boolean,
) {
  if (diagnostics.captureMode === "live" && !needsAttention) {
    return "真实链路已经接上。";
  }

  if (
    diagnostics.captureMode === "proc_fallback" ||
    diagnostics.capabilityLabel.includes("轻量") ||
    diagnostics.capabilityLabel.includes("回退")
  ) {
    return "先看大方向，细节再补。";
  }

  return "基础链路已经接上。";
}
