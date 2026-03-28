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
        <p className="readiness-summary__headline">
          {diagnostics.recommendedAction}
        </p>

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
