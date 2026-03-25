export interface RealtimeConnectionItem {
  sessionId: string;
  processName: string;
  target: string;
  localPortLabel: string;
  direction: string;
  protocol: string;
  uploadRate: string;
  uploadRateValue: number;
  downloadRate: string;
  downloadRateValue: number;
  totalRate: string;
  totalRateValue: number;
  lastSeenLabel: string;
}

export interface RealtimeSnapshotView {
  cycleLabel: string;
  uploadRate: string;
  downloadRate: string;
  widgetState: string;
  headline: string;
  captureMode: string;
  activeConnections: RealtimeConnectionItem[];
}

export type DesktopPlatformId = "linux" | "windows" | "macos" | "unknown";

export type SetupChecklistStatus = "ready" | "attention" | "planned";

export interface SetupChecklistItemView {
  id: string;
  title: string;
  detail: string;
  status: SetupChecklistStatus;
}

export interface DiagnosticsSnapshotView {
  cycleLabel: string;
  agentStatus: string;
  captureMode: string;
  databaseStatus: string;
  degradedReason: string | null;
  permissionSummary: string;
  socketPath: string;
  databasePath: string;
  platform: DesktopPlatformId;
  platformLabel: string;
  supportLabel: string;
  platformSummary: string;
  capabilityLabel: string;
  capabilitySummary: string;
  recommendedAction: string;
  setupChecklist: SetupChecklistItemView[];
}

export interface DashboardData {
  realtime: RealtimeSnapshotView;
  diagnostics: DiagnosticsSnapshotView;
}

export interface ProcessSummaryItemView {
  pid: number;
  processName: string;
  parentProcessName: string | null;
  totalTraffic: string;
  destinationCount: number;
  lastActiveLabel: string;
  alertLabel: string;
  hasActiveAlert: boolean;
}

export interface ProcessSummariesView {
  cycleLabel: string;
  items: ProcessSummaryItemView[];
}

export interface HistorySessionItemView {
  sessionId: string;
  processName: string;
  pid: number | null;
  target: string;
  direction: string;
  protocol: string;
  timeLabel: string;
  traffic: string;
}

export interface HistoryPageView {
  cycleLabel: string;
  total: number;
  limit: number;
  offset: number;
  items: HistorySessionItemView[];
}

export interface ProcessDetailConnectionItemView {
  sessionId: string;
  target: string;
  localPortLabel: string;
  direction: string;
  protocol: string;
  state: string;
  uploadRate: string;
  downloadRate: string;
  totalRate: string;
  lastSeenLabel: string;
}

export interface ProcessDetailView {
  cycleLabel: string;
  pid: number | null;
  processName: string;
  lastActiveLabel: string;
  totalTraffic: string;
  recentAlerts: string[];
  activeConnections: ProcessDetailConnectionItemView[];
}

export type DashboardRuntimeMode =
  | "connecting"
  | "live"
  | "mock"
  | "fallback"
  | "disabled";

export interface DashboardRuntimeView {
  isLoading: boolean;
  isRefreshing: boolean;
  isFallback: boolean;
  mode: DashboardRuntimeMode;
  errorMessage: string | null;
  sourceLabel: string;
  lastUpdatedLabel: string;
}

export interface AgentDashboardPayload {
  healthJson: string;
  statusJson: string;
  liveJson: string;
  alertsJson?: string;
}
