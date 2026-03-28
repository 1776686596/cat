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
  const heroFocus = buildHeroFocus(widgetScene, topConnection);
  const runtimeAside = getRuntimeAside(runtime);
  const line = buildHeroLine(widgetScene, heroFocus);
  const nextStep = buildNextStep(heroFocus);
  const topDetail = buildTopDetail(heroFocus);

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
          <strong>{heroFocus?.processName || heroCopy.topEmptyTitle}</strong>
          <p>{topDetail ?? heroCopy.topEmptyDetail}</p>
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

  if (runtime.mode === "disabled") {
    return runtimeAsideCopy.disabled;
  }

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
  heroFocus: HeroFocus | null,
) {
  const heroCopy = GAL_PAGE_COPY.realtime.hero;

  if (widgetScene.line.trim().length > 0) {
    return widgetScene.line;
  }

  if (heroFocus?.processName) {
    return heroCopy.lineWithProcessTemplate.replace(
      "{processName}",
      heroFocus.processName,
    );
  }

  return heroCopy.lineEmpty;
}

function buildNextStep(heroFocus: HeroFocus | null) {
  if (heroFocus?.processName) {
    return `先盯住 ${heroFocus.processName}`;
  }

  return GAL_PAGE_COPY.realtime.hero.nextFallback;
}

type HeroFocus = {
  processName: string;
  target: string;
  totalRate: string;
};

function buildHeroFocus(
  widgetScene: WidgetSceneView,
  topConnection: RealtimeConnectionItem | null,
): HeroFocus | null {
  const sceneProcessName = normalizeSceneField(widgetScene.focusProcessName);
  const sceneTarget = normalizeSceneField(widgetScene.focusTarget);
  const sceneRate = normalizeSceneField(widgetScene.focusRateLabel);

  if (
    sceneProcessName.length > 0 ||
    sceneTarget.length > 0 ||
    sceneRate.length > 0
  ) {
    return {
      processName:
        sceneProcessName.length > 0
          ? sceneProcessName
          : topConnection?.processName ?? "",
      target: sceneTarget.length > 0 ? sceneTarget : topConnection?.target ?? "",
      totalRate: sceneRate.length > 0 ? sceneRate : topConnection?.totalRate ?? "",
    };
  }

  if (!topConnection) {
    return null;
  }

  return {
    processName: topConnection.processName,
    target: topConnection.target,
    totalRate: topConnection.totalRate,
  };
}

function normalizeSceneField(value: string | null) {
  return value?.trim() ?? "";
}

function buildTopDetail(heroFocus: HeroFocus | null) {
  if (!heroFocus) {
    return null;
  }

  const detailParts = [heroFocus.target, heroFocus.totalRate].filter(
    (part) => part.length > 0,
  );

  if (detailParts.length === 0) {
    return null;
  }

  return detailParts.join(" · ");
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
