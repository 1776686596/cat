import type {
  AgentDashboardPayload,
  DashboardData,
  DesktopPlatformId,
  SetupChecklistItemView,
} from "../types/appData";
import {
  buildEpisodeLabel,
  GAL_EPISODE_SCENES,
  GAL_MOCK_COPY,
} from "../copy/galAbstract";
import {
  formatRate,
  formatRelativeTime,
  humanizeDirection,
  humanizeProtocol,
} from "./formatters";

interface AgentHealthApiPayload {
  generated_at?: number;
  uds_path?: string;
  permissions?: {
    ready?: boolean;
    details?: string | null;
  };
  capture?: {
    mode?: string;
    state?: string;
    last_sample_at?: number | null;
    details?: string | null;
  };
  store?: {
    state?: string;
    database_path?: string;
  };
}

interface AgentStatusApiPayload {
  service_status?: string;
  capture_mode?: string;
  permission_status?: string;
  db_status?: string;
  degraded_reason?: string | null;
}

interface AgentLiveFlowItemPayload {
  session_id?: string;
  process_name?: string;
  remote_host?: string;
  remote_port?: number;
  local_port?: number;
  direction?: string;
  protocol?: string;
  current_tx_rate?: number;
  current_rx_rate?: number;
  last_seen_at?: number;
}

interface AgentLiveFlowsApiPayload {
  generated_at?: number;
  widget_state?: string;
  capture_mode?: string;
  upload_rate_bytes_per_sec?: number;
  download_rate_bytes_per_sec?: number;
  headline?: string | null;
  items?: AgentLiveFlowItemPayload[];
}

export interface DashboardPayloadResolution {
  data: DashboardData;
  generatedAt: number | null;
}

export function getDashboardData(payload?: AgentDashboardPayload): DashboardData {
  return resolveDashboardPayload(payload).data;
}

export function resolveDashboardPayload(
  payload?: AgentDashboardPayload,
): DashboardPayloadResolution {
  if (!payload) {
    return {
      data: getFallbackDashboardData(),
      generatedAt: null,
    };
  }

  const health = parseJson<AgentHealthApiPayload>(payload.healthJson);
  const status = parseJson<AgentStatusApiPayload>(payload.statusJson);
  const live = parseJson<AgentLiveFlowsApiPayload>(payload.liveJson);
  const platform = detectDesktopPlatform();
  const platformView = buildPlatformView(platform);
  const capabilityView = buildCapabilityView({
    agentStatus: status.service_status ?? "unknown",
    captureMode: status.capture_mode ?? health.capture?.mode ?? "unknown",
    databaseStatus: status.db_status ?? health.store?.state ?? "unknown",
    permissionReady: health.permissions?.ready ?? false,
  });

  return {
    generatedAt: live.generated_at ?? health.generated_at ?? null,
    data: {
      realtime: {
        cycleLabel: buildEpisodeLabel(5, GAL_EPISODE_SCENES.dashboardRealtimeLive),
        uploadRate: formatRate(live.upload_rate_bytes_per_sec ?? 0),
        downloadRate: formatRate(live.download_rate_bytes_per_sec ?? 0),
        widgetState: live.widget_state ?? "unknown",
        headline: live.headline ?? GAL_MOCK_COPY.dashboard.noHeadline,
        captureMode: live.capture_mode ?? health.capture?.mode ?? "unknown",
        activeConnections: (live.items ?? []).map((item) => ({
          sessionId: item.session_id ?? fallbackSessionId(item),
          processName: item.process_name ?? "unknown",
          target: formatTarget(item.remote_host, item.remote_port),
          localPortLabel: formatLocalPort(item.local_port),
          direction: humanizeDirection(item.direction),
          protocol: humanizeProtocol(item.protocol),
          uploadRate: formatRate(item.current_tx_rate ?? 0),
          uploadRateValue: item.current_tx_rate ?? 0,
          downloadRate: formatRate(item.current_rx_rate ?? 0),
          downloadRateValue: item.current_rx_rate ?? 0,
          totalRate: formatRate(
            (item.current_tx_rate ?? 0) + (item.current_rx_rate ?? 0),
          ),
          totalRateValue: (item.current_tx_rate ?? 0) + (item.current_rx_rate ?? 0),
          lastSeenLabel: formatRelativeTime(item.last_seen_at),
        })),
      },
      diagnostics: {
        cycleLabel: buildEpisodeLabel(
          5,
          GAL_EPISODE_SCENES.dashboardDiagnosticsLive,
        ),
        agentStatus: status.service_status ?? "unknown",
        captureMode: status.capture_mode ?? health.capture?.mode ?? "unknown",
        databaseStatus: status.db_status ?? health.store?.state ?? "unknown",
        degradedReason: status.degraded_reason ?? health.capture?.details ?? null,
        permissionSummary:
          health.permissions?.details ??
          GAL_MOCK_COPY.dashboard.fallbackPermissionDetail,
        socketPath: health.uds_path ?? "/run/traffic-cat/agentd.sock",
        databasePath:
          health.store?.database_path ?? "/var/lib/traffic-cat/traffic.db",
        platform,
        platformLabel: platformView.label,
        supportLabel: platformView.supportLabel,
        platformSummary: platformView.summary,
        capabilityLabel: capabilityView.label,
        capabilitySummary: capabilityView.summary,
        recommendedAction: capabilityView.recommendedAction,
        setupChecklist: capabilityView.checklist,
      },
    },
  };
}

export function getFallbackDashboardData(): DashboardData {
  const platform = detectDesktopPlatform();
  const platformView = buildPlatformView(platform);
  const capabilityView = buildCapabilityView({
    agentStatus: "degraded",
    captureMode: "proc_fallback",
    databaseStatus: "healthy",
    permissionReady: false,
  });

  return {
    realtime: {
      cycleLabel: buildEpisodeLabel(
        5,
        GAL_EPISODE_SCENES.dashboardRealtimeFallback,
      ),
      uploadRate: "0 KB/s",
      downloadRate: "0 KB/s",
      widgetState: "idle",
      headline: GAL_MOCK_COPY.dashboard.fallbackHeadline,
      captureMode: "proc_fallback",
      activeConnections: [
        {
          sessionId: "demo-firefox-443",
          processName: "firefox",
          target: "cdn.example.net:443",
          localPortLabel: "本地端口 53124",
          direction: "下行",
          protocol: "TCP",
          uploadRate: "120 KB/s",
          uploadRateValue: 120 * 1024,
          downloadRate: "4.7 MB/s",
          downloadRateValue: Math.round(4.7 * 1024 * 1024),
          totalRate: "4.8 MB/s",
          totalRateValue: Math.round(4.82 * 1024 * 1024),
          lastSeenLabel: "刚刚",
        },
        {
          sessionId: "demo-syncthing-22000",
          processName: "syncthing",
          target: "10.0.0.25:22000",
          localPortLabel: "本地端口 22000",
          direction: "双向",
          protocol: "TCP",
          uploadRate: "410 KB/s",
          uploadRateValue: 410 * 1024,
          downloadRate: "450 KB/s",
          downloadRateValue: 450 * 1024,
          totalRate: "860 KB/s",
          totalRateValue: 860 * 1024,
          lastSeenLabel: "3 秒前",
        },
        {
          sessionId: "demo-code-443",
          processName: "code",
          target: "github.com:443",
          localPortLabel: "本地端口 49382",
          direction: "上行",
          protocol: "TCP",
          uploadRate: "186 KB/s",
          uploadRateValue: 186 * 1024,
          downloadRate: "4 KB/s",
          downloadRateValue: 4 * 1024,
          totalRate: "190 KB/s",
          totalRateValue: 190 * 1024,
          lastSeenLabel: "10 秒前",
        },
      ],
    },
    diagnostics: {
      cycleLabel: buildEpisodeLabel(
        5,
        GAL_EPISODE_SCENES.dashboardDiagnosticsFallback,
      ),
      agentStatus: "degraded",
      captureMode: "proc_fallback",
      databaseStatus: "healthy",
      degradedReason: GAL_MOCK_COPY.dashboard.fallbackDegradedReason,
      permissionSummary: GAL_MOCK_COPY.dashboard.fallbackPermissionSummary,
      socketPath: "/run/traffic-cat/agentd.sock",
      databasePath: "/var/lib/traffic-cat/traffic.db.snapshot",
      platform,
      platformLabel: platformView.label,
      supportLabel: platformView.supportLabel,
      platformSummary: platformView.summary,
      capabilityLabel: capabilityView.label,
      capabilitySummary: capabilityView.summary,
      recommendedAction: capabilityView.recommendedAction,
      setupChecklist: capabilityView.checklist,
    },
  };
}

function parseJson<T>(raw: string): T {
  return JSON.parse(raw) as T;
}

function fallbackSessionId(item: AgentLiveFlowItemPayload): string {
  return [
    item.process_name,
    item.protocol,
    item.remote_host,
    item.remote_port,
    item.local_port,
  ]
    .filter(Boolean)
    .join("-") || "unknown-session";
}

function formatTarget(host?: string, port?: number): string {
  if (host && port) {
    return `${host}:${port}`;
  }
  if (host) {
    return host;
  }
  return "unknown";
}

function formatLocalPort(port?: number): string {
  return port ? `本地端口 ${port}` : "本地端口未知";
}

function detectDesktopPlatform(): DesktopPlatformId {
  if (typeof navigator === "undefined") {
    return "unknown";
  }

  const fingerprint = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
  if (fingerprint.includes("mac")) {
    return "macos";
  }
  if (fingerprint.includes("win")) {
    return "windows";
  }
  if (fingerprint.includes("linux") || fingerprint.includes("x11")) {
    return "linux";
  }
  return "unknown";
}

function buildPlatformView(platform: DesktopPlatformId) {
  switch (platform) {
    case "linux":
      return {
        label: "Linux",
        supportLabel: "Linux 首发平台",
        summary:
          "当前版本的采集、挂件和诊断链路优先在 Linux 落地，界面结构已经按跨平台桌面产品收拢。",
      };
    case "windows":
      return {
        label: "Windows",
        supportLabel: "Windows 规划中",
        summary:
          "产品叙事、挂件交互和诊断路径会保持一致，Windows 采集链路将在后续阶段补齐。",
      };
    case "macos":
      return {
        label: "macOS",
        supportLabel: "macOS 规划中",
        summary:
          "主界面与挂件体验会沿用同一套品牌语言，macOS 的系统授权与采集实现后续接入。",
      };
    case "unknown":
      return {
        label: "未知平台",
        supportLabel: "平台识别中",
        summary:
          "当前还没拿到明确的平台指纹，界面先按跨平台产品的公共层展示。",
      };
  }
}

function buildCapabilityView(input: {
  agentStatus: string;
  captureMode: string;
  databaseStatus: string;
  permissionReady: boolean;
}) {
  const agentReachable = !["offline", "unreachable", "disconnected"].includes(
    input.agentStatus.trim().toLowerCase(),
  );
  const databaseHealthy = input.databaseStatus.trim().toLowerCase() === "healthy";
  const captureMode = input.captureMode.trim().toLowerCase();

  let label = "能力识别中";
  let summary = "守护进程、权限和采集模式还在确认，先用诊断页把状态补齐。";
  let recommendedAction = "先确认桌面桥接、系统权限和 agentd 是否已经全部到位。";

  if (!agentReachable) {
    label = "等待主守护接线";
    summary = "UI 还没有拿到稳定的守护进程状态，挂件目前只能做示意展示。";
    recommendedAction = "先把 agentd 与桌面桥接接起来，再开始看真实联网动静。";
  } else if (captureMode === "ebpf") {
    label = "完整观测";
    summary = "当前已经具备高精度实时观测能力，适合把挂件常驻在桌面角落。";
    recommendedAction = "现在可以直接盯实时流向和告警，把历史检索当回查入口使用。";
  } else if (captureMode === "proc_fallback") {
    label = "轻量观测";
    summary = "当前使用回退模式，基础流向能看，但速率精度和覆盖面会比完整采集低。";
    recommendedAction = input.permissionReady
      ? "已经可以开始使用；若想补齐更准的速率与协议覆盖，再升级到完整采集。"
      : "先用回退模式盯住主要动静，随后补系统授权，把真实速率和归因补齐。";
  } else if (!input.permissionReady) {
    label = "等待本地授权";
    summary = "界面已经就位，但系统能力还没补齐，暂时拿不到可信的联网快照。";
    recommendedAction = "优先处理系统授权或 capability 配置，再回来查看实时流向。";
  }

  if (!databaseHealthy) {
    recommendedAction = "先恢复本地存档库，避免历史检索和导出结果出现断层。";
  }

  const checklist: SetupChecklistItemView[] = [
    {
      id: "agent",
      title: "守护进程接线",
      detail: agentReachable ? "UI 已经能拿到守护进程状态。" : "当前还没形成稳定连接。",
      status: agentReachable ? "ready" : "attention",
    },
    {
      id: "permission",
      title: "系统权限",
      detail: input.permissionReady
        ? "已经具备当前采集链路需要的本地授权。"
        : "仍需补 sudo 或 capability，才能拉起更完整的观测。",
      status: input.permissionReady ? "ready" : "attention",
    },
    {
      id: "capture",
      title: "采集模式",
      detail:
        captureMode === "ebpf"
          ? "正在使用完整实时采集。"
          : captureMode === "proc_fallback"
            ? "先以回退模式值守，基础连接仍可看。"
            : "采集模式尚未识别，先继续诊断。",
      status:
        captureMode === "ebpf"
          ? "ready"
          : captureMode === "proc_fallback"
            ? "attention"
            : "planned",
    },
    {
      id: "history-store",
      title: "历史存档",
      detail: databaseHealthy
        ? "历史检索与导出路径可用。"
        : "存档库状态不稳，建议先修复后再依赖历史数据。",
      status: databaseHealthy ? "ready" : "attention",
    },
  ];

  return {
    label,
    summary,
    recommendedAction,
    checklist,
  };
}
