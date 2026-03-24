import { useState } from "react";

import type { AppView } from "../app/navigation";
import TrafficWidgetCard from "../components/widget/TrafficWidgetCard";
import { GAL_ACTION_COPY } from "../copy/galAbstract";
import { useDashboardData } from "../hooks/useDashboardData";
import { useWidgetLayoutMode } from "../hooks/useWidgetLayoutMode";
import type { DiagnosticsSnapshotView } from "../types/appData";

interface WidgetPageProps {
  onOpenDashboard: (view: Extract<AppView, "realtime" | "diagnostics">) => Promise<void>;
}

export default function WidgetPage({ onOpenDashboard }: WidgetPageProps) {
  const [isOpening, setIsOpening] = useState(false);
  const { dashboardData, runtime, refresh } = useDashboardData();
  const { layoutMode } = useWidgetLayoutMode();
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
        layoutMode={layoutMode}
        primaryActionLabel={
          isOpening
            ? GAL_ACTION_COPY.widget.opening
            : targetView === "diagnostics"
              ? GAL_ACTION_COPY.widget.openDiagnostics
              : GAL_ACTION_COPY.widget.openDashboard
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
