import type { DashboardRuntimeMode } from "../types/appData";

export const GAL_NAV_ITEMS = [
  {
    key: "realtime",
    label: "实时流向",
    copy: "先逮住偷跑流量的家伙。",
  },
  {
    key: "processes",
    label: "进程聚合",
    copy: "这锅今天必须有人背。",
  },
  {
    key: "process-detail",
    label: "进程详情",
    copy: "锁死一个 PID 往死里看。",
  },
  {
    key: "history",
    label: "历史检索",
    copy: "翻旧账模式，启动。",
  },
  {
    key: "diagnostics",
    label: "诊断",
    copy: "寄了别慌，先查链路。",
  },
] as const;

export const GAL_SHELL_COPY = {
  title: "嘎啦 game 里不是这样的！",
  subtitle: "攻略失败，现实没有读档，但这锅总得查清。",
  cards: {
    focus: "当前番位",
    source: "情报源",
    sync: "刚抓到",
    selectedPid: "锁定目标",
  },
  selectedPidEmpty: "未锁定",
  noSelectedProcessHint: "想贴脸看详情？先去进程聚合挑个 PID。",
  lockedProcessTitle: "先去进程聚合锁个人",
  actions: {
    refreshIdle: "再抓一轮",
    refreshBusy: "重抓中...",
  },
  banners: {
    mock: {
      title: "当前是模拟档，先代餐一下。",
      message: "先看界面，数字别太入戏。",
    },
    live: {
      title: "这次不是代餐，是真家伙。",
      message: "dev bridge 已经把 agentd 接上了。",
    },
    fallback: {
      title: "桥接寄了，先拿回退档顶班。",
      message: "能看结构，别信数字。",
    },
  },
} as const;

export const GAL_PAGE_COPY = {
  common: {
    battleReport: "本轮战报",
  },
  realtime: {
    title: "实时流向",
    lead: "谁在偷跑流量，一眼逮捕。",
    widgetPreviewEyebrow: "挂件剧透",
    widgetPreviewTitle: "挂件预览",
    widgetPreviewSummary: "平时装乖，一靠近就全招。",
    widgetModeTitle: "挂件构图",
    widgetModeSummary: "默认让亚托莉压场，想盯榜时再切成排行优先。",
    widgetModeCharacterLabel: "角色优先",
    widgetModeRankingLabel: "排行优先",
    widgetPoints: {
      idleTitle: "默认态",
      idleCopy: "先假装岁月静好。",
      hoverTitle: "悬停态",
      hoverCopy: "你一靠近，它就全盘托出。",
      currentTitle: "当前快照",
    },
    spotlight: {
      noHotspot: "暂无热点",
      liveDetailSuffix: "正在 C 位输出",
      fallbackCaptureDetail: "UDP / QUIC 可能偏低",
      liveCaptureDetail: "这轮数据不像在演我",
    },
    hotspot: {
      eyebrow: "活跃连接",
      title: "当前热点流量",
      summary: "这波是谁在 C 位输出。",
      badgeSuffix: "条活跃连接",
      empty: "风平浪静，暂时没人整活。",
    },
  },
  processes: {
    title: "按进程聚合",
    lead: "这锅谁背，今天必须查清。",
    table: {
      eyebrow: "聚合列表",
      title: "进程流量总览",
      summary: "该背锅的，一个都别想跑。",
      empty: "这会儿还没人跳脸。",
      pidUnknown: "PID 未知",
    },
  },
  history: {
    title: "历史检索",
    lead: "翻旧账模式启动，谁都别想装无事发生。",
    filters: {
      eyebrow: "过滤条件",
      title: "最近历史会话",
      summary: "旧账这种东西，翻起来要讲证据。",
      processName: "谁在整活",
      target: "去找谁",
      port: "哪路端口",
      direction: "往哪跑",
      startedAfter: "开演时间",
      endedBefore: "收工时间",
      limit: "每页几条",
      includeLanTraffic: "局域网也算",
      placeholders: {
        processName: "firefox / syncthing",
        target: "域名或 IP",
        port: "443",
      },
      directions: {
        all: "都算",
        outbound: "往外冲",
        inbound: "往回灌",
      },
    },
    page: {
      visiblePrefix: "当前显示",
      exportHintPrefix: "这次能打包带走",
      exportHintSuffix: "条记录。",
      exportRecentPrefix: "最近导出：",
      empty: "这页旧账还没翻到证据。",
      pidUnknown: "PID 未知",
      exportJsonTitle: "把这页记录打包成 JSON",
      exportCsvTitle: "把这页记录打包成 CSV",
      inspectMissingTitle: "这条记录没 PID，暂时贴不了脸。",
      inspectTitlePrefix: "贴脸看 PID",
    },
  },
  processDetail: {
    title: "单进程详情",
    lead: "锁死一个 PID，开始近距离拷打。",
    profile: {
      eyebrow: "基础信息",
      title: "进程画像",
      summary: "先确认这位到底是谁。",
      empty: "先去进程聚合挑个 PID，再回来贴脸看。",
    },
    sessions: {
      eyebrow: "活跃连接",
      title: "当前进程会话",
      summary: "看看它最近都在和谁眉来眼去。",
      emptyBadge: "等你锁人",
      badgeSuffix: "条连接",
      empty: "这会儿它装得还挺乖。",
    },
    alerts: {
      eyebrow: "相关告警",
      title: "最近触发记录",
      summary: "翻翻它最近又惹了什么事。",
      empty: "最近还算老实，暂时没惹事。",
      itemTitle: "红温记录",
    },
  },
  diagnostics: {
    title: "诊断",
    lead: "寄了别慌，先查桥接，再看权限。",
    runtime: {
      connectionEyebrow: "连接状态",
      connectionTitle: "UI 与 agentd",
      connectionSummary: "先看这条线是不是还活着。",
      permissionEyebrow: "权限与能力",
      permissionTitle: "采集前置条件",
      permissionSummary: "再看是不是权限在卡你。",
      degradedFallback: "当前还没报寄因，先当它在装死。",
      permissionLabel: "权限状态",
    },
  },
  widget: {
    panelHeader: "最近整活",
    hoverSuffix: "悬停看最近整活",
  },
} as const;

export const GAL_NOTICE_COPY = {
  common: {
    wait: "再等一下下。",
    mockTitle: "当前是模拟档",
    mockMessage: "代餐可以，别真情实感。",
    fallbackTitle: "当前是回退档",
    fallbackMessage: "桥接寄了，先拿占位数据撑场面。",
  },
  realtime: {
    errorTitle: "实时桥接寄了",
    loadingTitle: "正在抓现行",
    zeroRateTitle: "连接到了，速率还在装死",
    zeroRateMessage: "想看真速率，得给 agentd 上 sudo 或 capability。",
    fallbackCaptureTitle: "抓到 UDP / QUIC 了",
    fallbackCaptureMessage: "现在还是 /proc 回退模式，数值可能有点演。",
  },
  processes: {
    errorTitle: "进程桥接寄了",
    loadingTitle: "正在清点嫌疑人",
  },
  history: {
    errorTitle: "历史桥接寄了",
    loadingTitle: "正在翻旧账",
  },
  processDetail: {
    errorTitle: "详情桥接寄了",
    unselectedTitle: "还没锁定目标",
    unselectedMessage: "先去进程聚合页挑个 PID 再说。",
    loadingTitle: "正在近距离拷打",
  },
  diagnostics: {
    errorTitle: "诊断桥接寄了",
    loadingTitle: "正在抢救现场",
  },
  widget: {
    errorGuidance: "桥接寄了，先去抢救。",
    fallbackGuidance: "现在是回退档，数字可能在演。",
  },
} as const;

export const GAL_EPISODE_SCENES = {
  dashboardRealtimeLive: "真档接线",
  dashboardRealtimeFallback: "回退顶班",
  dashboardDiagnosticsLive: "真档自检",
  dashboardDiagnosticsFallback: "回退自检",
  processesLive: "真档点名",
  processesFallback: "回退点名",
  historyLive: "真档翻账",
  historyFallback: "回退翻账",
  processDetailLive: "真档贴脸",
  processDetailFallback: "回退贴脸",
  processDetailDisabled: "还没锁人",
} as const;

export const GAL_MOCK_COPY = {
  dashboard: {
    noHeadline: "这会儿还没人整活",
    fallbackHeadline: "agentd 还没上桌，先别急",
    fallbackDegradedReason: "现在走 /proc 回退档，精度确实有点演。",
    fallbackPermissionSummary: "权限和目录都还行，只是现在走回退档。",
    fallbackPermissionDetail: "真体检还没接进来，先看这份代餐报告。",
  },
  processDetail: {
    fallbackAlertSyncthing: "它挂后台挂太久了，建议盯一眼。",
    fallbackAlertCurl: "第一次连到 1.1.1.1，先记进小本本。",
  },
  bridge: {
    sourceLabel: "开发桥接快照",
    permissionDetails: "开发桥接模式，当前使用模拟快照验证页面承接链路。",
    captureDetails: "当前展示开发桥接快照，后续切到真实 agentd UDS 通道。",
    degradedReason: "当前为开发桥接模式，尚未切到真实桌面命令注入。",
    liveHeadline: "syncthing -> 10.0.0.25",
    recentAlertTitle: "最近它有点红",
    recentAlertSyncthing: "这货后台连太久了，建议盯一眼。",
    recentAlertCode: "第一次连到 api.github.com，先记进小本本。",
    alertBannerTitle: "后台同步还没收工",
  },
} as const;

export const GAL_METRIC_LABELS = {
  realtime: {
    upload: "往外冲",
    download: "往回灌",
    state: "当前戏份",
    activeConnections: "在场人数",
    captureMode: "抓法",
    widgetState: "挂件戏份",
    syncState: "当前档位",
  },
  processes: {
    processCount: "在场人数",
    selectedPid: "锁定目标",
    source: "情报源",
  },
  history: {
    total: "旧账总数",
    pageSize: "本页战果",
    page: "翻到第几页",
    selectedPid: "锁定目标",
  },
  processDetail: {
    pid: "锁定目标",
    lastActive: "刚整过",
    totalTraffic: "总消耗",
  },
  diagnostics: {
    agent: "守护哥",
    captureMode: "抓法",
    database: "存档库",
  },
} as const;

export const GAL_TABLE_HEADERS = {
  processes: {
    process: "谁在整活",
    traffic: "总消耗",
    destinations: "去找几家",
    lastActive: "刚整过",
    alert: "红温没",
    action: "怎么处置",
  },
  history: {
    process: "谁在整活",
    target: "去找谁",
    direction: "怎么跑",
    protocol: "哪路协议",
    time: "啥时候整的",
    traffic: "总消耗",
    action: "怎么处置",
  },
} as const;

export const GAL_ACTION_COPY = {
  dashboardRefresh: {
    idle: "再抓一轮",
    busy: "重抓中...",
  },
  realtimeRefresh: {
    loading: "抓现行中...",
    busy: "重抓中...",
    idle: "再抓一轮",
  },
  realtimeOpenWidget: "单开看猫",
  processesRefresh: {
    idle: "再点一轮",
    busy: "点名中...",
  },
  processInspect: "贴脸看",
  historyRefresh: {
    idle: "再翻一轮",
    busy: "翻账中...",
  },
  historyApply: "开始翻账",
  historyReset: "清空重开",
  historyExportJson: "打包 JSON",
  historyExportCsv: "打包 CSV",
  historyPrev: "往前翻",
  historyNext: "继续翻",
  historyInspect: "贴脸看",
  historyInspectMissing: "没法贴脸",
  processDetailRefresh: {
    idle: "再审一轮",
    busy: "拷打中...",
  },
  diagnosticsRefresh: {
    idle: "再救一下",
    busy: "抢救中...",
  },
  widget: {
    drag: "拖拽挂件",
    refresh: "再抓一轮",
    hoverLabel: "流量排行",
    empty: "这会儿还没人整活。",
    openDashboard: "回主场",
    openDiagnostics: "进去抢救",
    opening: "开门中...",
  },
} as const;

export const GAL_RUNTIME_COPY = {
  bridgeMissingMessage: "桥还没来，先看回退档。",
  liveSourceLabel: "真档在线",
  fallbackSourceLabel: "回退档顶班",
  connectingSourceLabel: "连线中",
  dashboardInitialSyncLabel: "抓现行中",
  processesInitialSyncLabel: "点名中",
  historyInitialSyncLabel: "翻账中",
  processDetailInitialSyncLabel: "拷打中",
  processDetailDisabledSourceLabel: "还没锁人",
  processDetailDisabledSyncLabel: "还没开审",
  disconnectedSyncLabel: "线没接上",
  fallbackSyncLabel: "已切回回退档",
  disabledSyncLabel: "还没开局",
  unknownError: "寄因不明",
} as const;

export function getRuntimeModeLabel(mode: DashboardRuntimeMode) {
  switch (mode) {
    case "live":
      return "真档在线";
    case "mock":
      return "模拟档";
    case "fallback":
      return "回退档";
    case "connecting":
      return "连线中";
    case "disabled":
      return "还没开局";
  }
}

export function getRealtimeRuntimeLabel(mode: DashboardRuntimeMode, options?: {
  isLoading?: boolean;
  isRefreshing?: boolean;
  hasError?: boolean;
}) {
  if (options?.isRefreshing) {
    return "重抓中";
  }
  if (options?.isLoading) {
    return "抓现行中";
  }
  if (options?.hasError) {
    return "桥寄了";
  }
  return getRuntimeModeLabel(mode);
}

export function getCaptureModeLabel(mode: string) {
  switch (mode) {
    case "proc_fallback":
      return "回退档";
    case "ebpf":
      return "eBPF";
    case "unknown":
      return "谜之模式";
    default:
      return mode;
  }
}

export function getWidgetStateLabel(state: string) {
  switch (state.trim().toLowerCase()) {
    case "idle":
      return "装乖";
    case "download":
    case "download_active":
      return "下行暴走";
    case "upload":
    case "upload_active":
      return "上行暴走";
    case "bidirectional":
    case "bidirectional_active":
      return "双向开冲";
    case "alerting":
      return "红温警报";
    case "unknown":
      return "看不懂";
    default:
      return state;
  }
}

export function getAlertBadgeLabel(hasAlert: boolean) {
  return hasAlert ? "红了" : "还行";
}

export function getAgentStatusLabel(status: string) {
  switch (status.trim().toLowerCase()) {
    case "healthy":
    case "running":
    case "online":
      return "在线";
    case "degraded":
      return "半红温";
    case "offline":
    case "unreachable":
    case "disconnected":
      return "掉线";
    case "unknown":
      return "看不懂";
    default:
      return status;
  }
}

export function getDatabaseStatusLabel(status: string) {
  switch (status.trim().toLowerCase()) {
    case "healthy":
      return "存档稳";
    case "degraded":
      return "有点抖";
    case "offline":
    case "unreachable":
      return "掉线";
    case "unknown":
      return "看不懂";
    default:
      return status;
  }
}

export function getConnectionStateLabel(state: string) {
  switch (state.trim().toLowerCase()) {
    case "established":
      return "已接上";
    case "observed":
      return "路过一脚";
    case "unknown":
      return "看不懂";
    default:
      return state;
  }
}

export function buildEpisodeLabel(round: number, scene: string) {
  return `第 ${round} 回 / ${scene}`;
}

export function formatSyncLabel(timeLabel: string) {
  return timeLabel.replace("刚抓到 ", "");
}
