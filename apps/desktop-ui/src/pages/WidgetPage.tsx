import { useState } from "react";

import type { AppView } from "../app/navigation";
import TrafficWidgetCard from "../components/widget/TrafficWidgetCard";
import { useDashboardData } from "../hooks/useDashboardData";
import type { DiagnosticsSnapshotView } from "../types/appData";

interface WidgetPageProps {
  onOpenDashboard: (view: Extract<AppView, "realtime" | "diagnostics">) => Promise<void>;
}

export default function WidgetPage({ onOpenDashboard }: WidgetPageProps) {
  const [isOpening, setIsOpening] = useState(false);
  const { dashboardData, runtime, refresh } = useDashboardData();
  const { realtime, diagnostics } = dashboardData;
  const openDiagnostics = shouldOpenDiagnostics(runtime.errorMessage, diagnostics);
  const targetView = openDiagnostics ? "diagnostics" : "realtime";

  async function handleOpenDashboard() {
    setIsOpening(true);
    try {
      await onOpenDashboard(targetView);
    } finally {
      setIsOpening(false);
    }
  }

  return (
    <div className="widget-view">
      <TrafficWidgetCard
        snapshot={realtime}
        runtime={runtime}
        primaryActionLabel={
          isOpening
            ? "打开中..."
            : targetView === "diagnostics"
              ? "进入诊断"
              : "打开主界面"
        }
        onPrimaryAction={() => {
          void handleOpenDashboard();
        }}
        primaryDisabled={isOpening}
        onRefresh={() => {
          void refresh();
        }}
        refreshDisabled={runtime.isRefreshing}
      />
    </div>
  );
}

function shouldOpenDiagnostics(
  runtimeError: string | null,
  diagnostics: DiagnosticsSnapshotView,
) {
  if (runtimeError) {
    return true;
  }

  const agentStatus = diagnostics.agentStatus.toLowerCase();
  return ["offline", "unreachable", "disconnected"].includes(agentStatus);
}
