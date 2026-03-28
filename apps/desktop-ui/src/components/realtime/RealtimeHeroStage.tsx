import MetricChip from "../common/MetricChip";
import {
  GAL_ACTION_COPY,
  GAL_METRIC_LABELS,
  GAL_PAGE_COPY,
  getWidgetStateLabel,
} from "../../copy/galAbstract";
import type { WidgetSceneView } from "../../data/widgetScene";
import type {
  DashboardRuntimeView,
  RealtimeConnectionItem,
  RealtimeSnapshotView,
} from "../../types/appData";

interface RealtimeHeroStageProps {
  snapshot: RealtimeSnapshotView;
  runtime: DashboardRuntimeView;
  widgetScene: WidgetSceneView;
  onRefresh: () => Promise<void>;
}

export default function RealtimeHeroStage({
  snapshot,
  runtime,
  widgetScene,
  onRefresh,
}: RealtimeHeroStageProps) {
  const heroCopy = GAL_PAGE_COPY.realtime.hero;
  const topConnection = pickTopConnection(snapshot.activeConnections);
  const runtimeAside = getRuntimeAside(runtime);
  const line = buildHeroLine(widgetScene, topConnection);
  const nextStep = buildNextStep(widgetScene, topConnection);

  return (
    <div className="realtime-hero">
      <div className="realtime-hero__copy">
        <p className="page-eyebrow">{snapshot.cycleLabel}</p>
        <h2>{heroCopy.title}</h2>
        <p className="page-copy">{line}</p>
        <p className="page-copy">{runtimeAside}</p>

        <div className="metric-row">
          <MetricChip
            label={GAL_METRIC_LABELS.realtime.upload}
            value={snapshot.uploadRate}
          />
          <MetricChip
            label={GAL_METRIC_LABELS.realtime.download}
            value={snapshot.downloadRate}
          />
          <MetricChip
            label={GAL_METRIC_LABELS.realtime.state}
            value={getWidgetStateLabel(snapshot.widgetState)}
          />
        </div>
      </div>

      <div className="realtime-hero__aside">
        <article className="realtime-kpi-card">
          <span>{heroCopy.topEyebrow}</span>
          <strong>{topConnection?.processName ?? "暂无热点"}</strong>
          <p>
            {topConnection
              ? `${topConnection.target} · ${topConnection.totalRate}`
              : "现在还没有活跃连接。"}
          </p>
        </article>

        <article className="realtime-kpi-card">
          <span>{heroCopy.nextEyebrow}</span>
          <strong>{nextStep}</strong>
          <p>{widgetScene.guidance}</p>
        </article>

        <div className="page-header-actions page-header-actions--hero">
          <button
            className="action-button"
            type="button"
            onClick={() => {
              void onRefresh();
            }}
            disabled={runtime.isRefreshing}
          >
            {runtime.isLoading
              ? GAL_ACTION_COPY.realtimeRefresh.loading
              : runtime.isRefreshing
                ? GAL_ACTION_COPY.realtimeRefresh.busy
                : GAL_ACTION_COPY.realtimeRefresh.idle}
          </button>
        </div>
      </div>
    </div>
  );
}

function getRuntimeAside(runtime: DashboardRuntimeView) {
  const runtimeAsideCopy = GAL_PAGE_COPY.realtime.hero.runtimeAside;

  if (runtime.mode === "mock") {
    return runtimeAsideCopy.mock;
  }

  if (runtime.mode === "live" && !runtime.isFallback) {
    return runtimeAsideCopy.live;
  }

  if (runtime.mode === "fallback" || runtime.isFallback) {
    return runtimeAsideCopy.fallback;
  }

  return runtimeAsideCopy.connecting;
}

function buildHeroLine(
  widgetScene: WidgetSceneView,
  topConnection: RealtimeConnectionItem | null,
) {
  if (widgetScene.line.trim().length > 0) {
    return widgetScene.line;
  }

  if (topConnection) {
    return `咦，${topConnection.processName} 又偷偷连出去了呢。`;
  }

  return "现在先静静值守着，有动静我会先叫你。";
}

function buildNextStep(
  widgetScene: WidgetSceneView,
  topConnection: RealtimeConnectionItem | null,
) {
  if (topConnection) {
    return `先盯住 ${topConnection.processName}`;
  }

  if (widgetScene.focusProcessName) {
    return `先盯住 ${widgetScene.focusProcessName}`;
  }

  return GAL_PAGE_COPY.realtime.hero.nextFallback;
}

function pickTopConnection(
  connections: RealtimeConnectionItem[],
): RealtimeConnectionItem | null {
  if (connections.length === 0) {
    return null;
  }

  let topConnection = connections[0];
  for (let index = 1; index < connections.length; index += 1) {
    const current = connections[index];
    if (current.totalRateValue > topConnection.totalRateValue) {
      topConnection = current;
      continue;
    }

    if (
      current.totalRateValue === topConnection.totalRateValue &&
      current.sessionId.localeCompare(topConnection.sessionId) < 0
    ) {
      topConnection = current;
    }
  }

  return topConnection;
}
