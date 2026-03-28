import { buildAppUrl } from "../app/windowMode";
import RealtimeHeroStage from "../components/realtime/RealtimeHeroStage";
import ReadinessSummaryCard from "../components/realtime/ReadinessSummaryCard";
import SectionCard from "../components/common/SectionCard";
import TrafficWidgetCard from "../components/widget/TrafficWidgetCard";
import {
  GAL_ACTION_COPY,
  GAL_PAGE_COPY,
  getCaptureModeLabel,
} from "../copy/galAbstract";
import { resolveWidgetScene } from "../data/widgetScene";
import { useWidgetCharacterPlacement } from "../hooks/useWidgetCharacterPlacement";
import { useWidgetLayoutMode } from "../hooks/useWidgetLayoutMode";
import type {
  DashboardRuntimeView,
  DiagnosticsSnapshotView,
  RealtimeSnapshotView,
} from "../types/appData";

interface RealtimePageProps {
  snapshot: RealtimeSnapshotView;
  diagnostics: DiagnosticsSnapshotView;
  runtime: DashboardRuntimeView;
  onRefresh: () => Promise<void>;
}

export default function RealtimePage({
  snapshot,
  diagnostics,
  runtime,
  onRefresh,
}: RealtimePageProps) {
  const widgetScene = resolveWidgetScene(snapshot, runtime);
  const { layoutMode, setLayoutMode } = useWidgetLayoutMode();
  const { placement, setPlacement } = useWidgetCharacterPlacement(layoutMode);
  const realtimePageCopy = GAL_PAGE_COPY.realtime;
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
          eyebrow={realtimePageCopy.hotspot.eyebrow}
          title={realtimePageCopy.hotspot.title}
          summary={realtimePageCopy.hotspot.summary}
          badge={`${snapshot.activeConnections.length} ${realtimePageCopy.hotspot.badgeSuffix}`}
        >
          {snapshot.activeConnections.length === 0 ? (
            <div className="page-note">{realtimePageCopy.hotspot.empty}</div>
          ) : (
            <div className="list-block">
              {snapshot.activeConnections.map((item) => (
                <div className="list-item" key={item.sessionId}>
                  <strong>
                    {item.processName} -&gt; {item.target}
                  </strong>
                  <span>
                    {item.direction} · {item.protocol} · 上 {item.uploadRate} · 下{" "}
                    {item.downloadRate} · 合计 {item.totalRate} ·{" "}
                    {item.localPortLabel} · {item.lastSeenLabel}
                    {snapshot.captureMode === "proc_fallback" &&
                    item.protocol === "UDP"
                      ? " · 数值有点演"
                      : ""}
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
          <p className="page-eyebrow">{realtimePageCopy.widgetPreviewTitle}</p>
          <h3>她会怎么守着你</h3>
          <p className="section-summary">摆位和比例还在，解释的话就先收起来。</p>

          <div className="widget-preview-mode">
            <div className="widget-preview-mode__copy">
              <strong>{realtimePageCopy.widgetModeTitle}</strong>
              <span>{realtimePageCopy.widgetModeSummary}</span>
            </div>
            <div
              className="widget-preview-mode__switch"
              aria-label={realtimePageCopy.widgetModeTitle}
            >
              <button
                className={`widget-preview-mode__button ${layoutMode === "character-first" ? "is-active" : ""}`.trim()}
                type="button"
                onClick={() => {
                  setLayoutMode("character-first");
                }}
              >
                {realtimePageCopy.widgetModeCharacterLabel}
              </button>
              <button
                className={`widget-preview-mode__button ${layoutMode === "ranking-first" ? "is-active" : ""}`.trim()}
                type="button"
                onClick={() => {
                  setLayoutMode("ranking-first");
                }}
              >
                {realtimePageCopy.widgetModeRankingLabel}
              </button>
            </div>
          </div>
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
