import type { DashboardRuntimeMode } from "../types/appData";

export const GAL_NAV_ITEMS = [
  {
    key: "realtime",
    label: "实时流向",
    copy: "把刚发生的联网动静先收拢住。",
  },
  {
    key: "processes",
    label: "进程聚合",
    copy: "从进程视角看谁最活跃、谁最异常。",
  },
  {
    key: "process-detail",
    label: "进程详情",
    copy: "放大单个进程的连接、历史和提醒。",
  },
  {
    key: "history",
    label: "历史检索",
    copy: "把过去发生过的联网记录重新翻出来。",
  },
  {
    key: "diagnostics",
    label: "诊断",
    copy: "检查平台支持、权限和守护进程状态。",
  },
] as const;

export const GAL_SHELL_COPY = {
  title: "Traffic Cat 守望席",
  subtitle: "把桌面上悄悄联网的动静，变成一眼就能看见的值守感。",
  cards: {
    focus: "当前区域",
    platform: "当前平台",
    capability: "观测能力",
    sync: "最近同步",
    selectedPid: "锁定进程",
  },
  selectedPidEmpty: "未锁定",
  noSelectedProcessHint: "想看单进程详情，先去进程聚合挑一个目标。",
  lockedProcessTitle: "先从进程聚合页选择一个进程",
  actions: {
    refreshIdle: "刷新状态",
    refreshBusy: "刷新中...",
  },
  banners: {
    mock: {
      title: "当前展示示意数据",
      message: "可以先体验界面与交互，联网数字暂不代表真实状态。",
    },
    live: {
      title: "已接入真实观测链路",
      message: "当前界面正在读取桌面守护进程的真实快照。",
    },
    fallback: {
      title: "当前处于回退观测",
      message: "基础动静仍然可见，但精度和覆盖面会低于完整采集。",
    },
  },
} as const;

export const GAL_PAGE_COPY = {
  common: {
    battleReport: "当前观察",
  },
  realtime: {
    title: "实时流向",
    lead: "把现在最值得盯住的联网动静、挂件状态和部署准备度放到同一屏里。",
    widgetPreviewEyebrow: "挂件剧透",
    widgetPreviewTitle: "挂件预览",
    widgetPreviewSummary: "平时安静值守，一靠近就把榜首和提醒交出来。",
    widgetModeTitle: "挂件构图",
    widgetModeSummary: "默认让角色压场，想优先盯榜时再切成排行优先。",
    widgetModeCharacterLabel: "角色优先",
    widgetModeRankingLabel: "排行优先",
    widgetEditorTitle: "人物站位",
    widgetEditorSummary: "直接拖动右侧角色摆位，下面调尺寸和榜单层透明度，挂件页会同步记住。",
    widgetEditorScaleLabel: "人物尺寸",
    widgetEditorOverlayOpacityLabel: "排行面板透明度",
    widgetEditorResetLabel: "恢复默认",
    widgetEditorHint: "拖动角色调整位置，滚轮或滑杆微调大小，排行层也能单独调透明。",
    widgetPoints: {
      idleTitle: "默认态",
      idleCopy: "安静值守，不抢镜。",
      hoverTitle: "悬停态",
      hoverCopy: "靠近一点，就把最该看的连接交给你。",
      currentTitle: "当前快照",
    },
    setup: {
      eyebrow: "首装护航",
      title: "把平台、权限和采集准备度一次看清",
      summary: "先确认这台机器已经具备多少真实观测能力，再决定下一步补哪里。",
    },
    focus: {
      eyebrow: "当前重点",
      title: "现在最值得看的三件事",
      summary: "别一上来埋进表格，先把值守结论和下一步动作看清楚。",
    },
    spotlight: {
      noHotspot: "暂无热点",
      liveDetailSuffix: "正在占据前排",
      fallbackCaptureDetail: "当前先按轻量回退模式理解这批数据",
      liveCaptureDetail: "当前这轮数据来自真实观测链路",
    },
    hotspot: {
      eyebrow: "活跃连接",
      title: "当前热点流量",
      summary: "把现在最热的连接按连接级别摊开来看。",
      badgeSuffix: "条活跃连接",
      empty: "现在还没有值得盯住的活跃连接。",
    },
  },
  processes: {
    title: "按进程聚合",
    lead: "从进程维度看谁最活跃、谁最常去外网、谁带着提醒。",
    table: {
      eyebrow: "聚合列表",
      title: "进程流量总览",
      summary: "把需要放大的进程先筛出来，再进入详情页深看。",
      empty: "当前还没有形成可聚合的进程流量。",
      pidUnknown: "PID 未知",
    },
  },
  history: {
    title: "历史检索",
    lead: "回查过去发生过的连接、时间范围和流量规模。",
    filters: {
      eyebrow: "过滤条件",
      title: "最近历史会话",
      summary: "先收窄范围，再把有价值的旧记录导出来。",
      processName: "进程名",
      target: "目标地址",
      port: "目标端口",
      direction: "方向",
      startedAfter: "开始时间",
      endedBefore: "结束时间",
      limit: "每页数量",
      includeLanTraffic: "包含局域网流量",
      placeholders: {
        processName: "firefox / syncthing",
        target: "域名或 IP",
        port: "443",
      },
      directions: {
        all: "全部",
        outbound: "出站",
        inbound: "入站",
      },
    },
    page: {
      visiblePrefix: "当前显示",
      exportHintPrefix: "本页可导出",
      exportHintSuffix: "条记录。",
      exportRecentPrefix: "最近导出：",
      empty: "这页还没有命中任何历史记录。",
      pidUnknown: "PID 未知",
      exportJsonTitle: "把当前页导出成 JSON",
      exportCsvTitle: "把当前页导出成 CSV",
      inspectMissingTitle: "这条记录没有 PID，暂时无法跳详情。",
      inspectTitlePrefix: "查看 PID",
    },
  },
  processDetail: {
    title: "单进程详情",
    lead: "把单个进程的会话、历史和提醒放到一页里看清。",
    profile: {
      eyebrow: "基础信息",
      title: "进程画像",
      summary: "先确认这是谁、最近什么时候还在联网。",
      empty: "先去进程聚合选择一个进程，再回来查看详情。",
    },
    sessions: {
      eyebrow: "活跃连接",
      title: "当前进程会话",
      summary: "看它现在正在连谁、流量有多大、最近什么时候活跃。",
      emptyBadge: "等待目标",
      badgeSuffix: "条连接",
      empty: "当前这个进程没有活跃连接。",
    },
    alerts: {
      eyebrow: "相关提醒",
      title: "最近触发记录",
      summary: "把近期值得回看的告警记录单独拎出来。",
      empty: "最近没有命中新的提醒。",
      itemTitle: "提醒记录",
    },
  },
  diagnostics: {
    title: "诊断",
    lead: "把平台支持、权限状态、采集能力和下一步动作拆开看清楚。",
    runtime: {
      platformEyebrow: "平台支持",
      platformTitle: "当前平台与支持阶段",
      platformSummary: "先确认这台机器属于哪个平台，以及这条产品线现在支持到什么程度。",
      capabilityEyebrow: "观测能力",
      capabilityTitle: "当前能看到多少真实状态",
      capabilitySummary: "把守护进程、权限和采集模式合在一起判断，别只看单一指标。",
      nextEyebrow: "下一步",
      nextTitle: "优先补这一处",
      nextSummary: "先做最能提升真实观测能力的那一步，避免在噪音里打转。",
      checklistEyebrow: "启动检查",
      checklistTitle: "把值守链路逐项对齐",
      checklistSummary: "这四项都稳住后，挂件才适合长期常驻在桌面上。",
      degradedFallback: "当前还没拿到明确的降级原因，建议先检查链路和权限。",
      permissionLabel: "权限状态",
      socketLabel: "桌面桥接",
      databaseLabel: "历史存档",
    },
  },
  widget: {
    panelHeader: "最近动静",
    hoverSuffix: "悬停看最近热点",
  },
} as const;

export const GAL_NOTICE_COPY = {
  common: {
    wait: "再等一会，正在拉最新状态。",
    mockTitle: "当前展示示意数据",
    mockMessage: "可以先体验界面和交互，数字暂不代表真实联网状态。",
    fallbackTitle: "当前处于回退观测",
    fallbackMessage: "基础连接仍然可见，但精度和覆盖面会低于完整采集。",
  },
  realtime: {
    errorTitle: "实时链路异常",
    loadingTitle: "正在同步实时快照",
    zeroRateTitle: "连接已经出现，但速率还没拿到",
    zeroRateMessage: "想看到可信的实时速率，需要给 agentd 补 sudo 或 capability。",
    fallbackCaptureTitle: "当前为回退采集",
    fallbackCaptureMessage: "现在仍以 /proc 方案值守，UDP / QUIC 的表现可能偏保守。",
  },
  processes: {
    errorTitle: "进程列表加载失败",
    loadingTitle: "正在同步进程列表",
  },
  history: {
    errorTitle: "历史检索加载失败",
    loadingTitle: "正在同步历史记录",
  },
  processDetail: {
    errorTitle: "进程详情加载失败",
    unselectedTitle: "还没有选中进程",
    unselectedMessage: "先去进程聚合页选一个进程，再回来查看详情。",
    loadingTitle: "正在同步进程详情",
  },
  diagnostics: {
    errorTitle: "诊断状态加载失败",
    loadingTitle: "正在重新检测",
  },
  widget: {
    errorGuidance: "链路异常，先打开诊断页补齐连接。",
    fallbackGuidance: "当前处于回退观测，先看趋势，再补完整授权。",
  },
} as const;

export const GAL_WIDGET_SCENE_COPY = {
  idle: {
    stateLabel: "安静值守",
    reasonTitle: "现在没什么值得紧张的",
    lines: [
      "现在很安静呢。",
      "没有奇怪的动静。",
      "我先替你看着。",
      "今天暂时风平浪静。",
      "嗯，现在不用紧张。",
    ],
  },
  watching: {
    stateLabel: "正在盯梢",
    reasonTitle: "有点动静，我先看一眼",
    lines: [
      "有点动静，我看一眼。",
      "这个连接还在继续。",
      "先记下来，不急着下结论。",
      "嗯……它还在悄悄活动。",
      "现在有一点小动静。",
    ],
  },
  busy_download: {
    stateLabel: "下行热闹",
    reasonTitle: "这边一下子热闹起来了",
    lines: [
      "它正在拼命往回搬东西。",
      "这个目标今天很活跃哦。",
      "有人在往这边塞很多东西。",
      "这一条连接冲得很快。",
      "哇，这边一下子热闹起来了。",
    ],
  },
  busy_upload: {
    stateLabel: "上行活跃",
    reasonTitle: "它现在对外说得有点多",
    lines: [
      "等一下，它在往外发很多东西。",
      "这次是主动往外送呢。",
      "我先帮你盯紧这一条。",
      "这一波更像是在往外传。",
      "它现在对外说得有点多。",
    ],
  },
  alert: {
    stateLabel: "建议注意",
    reasonTitle: "这条连接值得看一眼",
    lines: [
      "这个家伙以前没见过。",
      "它已经偷偷连了很久了。",
      "这个动静不太像平时那样。",
      "等一下，这条我建议你看看。",
      "这次有点可疑，我先叫你一声。",
    ],
  },
} as const;

export const GAL_EPISODE_SCENES = {
  dashboardRealtimeLive: "真实值守",
  dashboardRealtimeFallback: "回退值守",
  dashboardDiagnosticsLive: "真实自检",
  dashboardDiagnosticsFallback: "回退自检",
  processesLive: "真实清单",
  processesFallback: "回退清单",
  historyLive: "真实回查",
  historyFallback: "回退回查",
  processDetailLive: "真实详情",
  processDetailFallback: "回退详情",
  processDetailDisabled: "等待选择进程",
} as const;

export const GAL_MOCK_COPY = {
  dashboard: {
    noHeadline: "当前还没有需要放大的活跃连接",
    fallbackHeadline: "agentd 还没接上线，先用回退观测占位",
    fallbackDegradedReason: "当前走 /proc 回退模式，精度和覆盖面会低于完整采集。",
    fallbackPermissionSummary: "目录和基础权限可用，但采集仍处于回退观测阶段。",
    fallbackPermissionDetail: "真实权限体检还没接进来，先把这份示意报告当成占位信息。",
  },
  processDetail: {
    fallbackAlertSyncthing: "后台持续通信时间较长，建议进一步确认用途。",
    fallbackAlertCurl: "第一次连到 1.1.1.1，建议记录这次外连。",
  },
  bridge: {
    sourceLabel: "开发桥接快照",
    permissionDetails: "当前处于开发桥接模式，使用模拟快照验证页面与状态流。",
    captureDetails: "当前展示开发桥接快照，后续会切到真实 agentd UDS 通道。",
    degradedReason: "当前仍是开发桥接模式，真实桌面命令注入尚未接入。",
    liveHeadline: "syncthing -> 10.0.0.25",
    recentAlertTitle: "最近提醒",
    recentAlertSyncthing: "后台持续通信时间偏长，建议确认是否符合预期。",
    recentAlertCode: "第一次连到 api.github.com，建议记录这次新外连。",
    alertBannerTitle: "后台同步仍在继续",
  },
} as const;

export const GAL_METRIC_LABELS = {
  realtime: {
    upload: "上行速率",
    download: "下行速率",
    state: "挂件状态",
    activeConnections: "活跃连接",
    captureMode: "采集模式",
    widgetState: "值守状态",
    syncState: "当前状态",
  },
  processes: {
    processCount: "进程数量",
    selectedPid: "锁定进程",
    source: "数据来源",
  },
  history: {
    total: "总记录数",
    pageSize: "本页数量",
    page: "当前页",
    selectedPid: "锁定进程",
  },
  processDetail: {
    pid: "当前 PID",
    lastActive: "最近活跃",
    totalTraffic: "累计流量",
  },
  diagnostics: {
    agent: "守护进程",
    captureMode: "观测能力",
    database: "当前平台",
  },
} as const;

export const GAL_TABLE_HEADERS = {
  processes: {
    process: "进程",
    traffic: "累计流量",
    destinations: "目标数量",
    lastActive: "最近活跃",
    alert: "提醒状态",
    action: "操作",
  },
  history: {
    process: "进程",
    target: "目标地址",
    direction: "方向",
    protocol: "协议",
    time: "时间",
    traffic: "累计流量",
    action: "操作",
  },
} as const;

export const GAL_ACTION_COPY = {
  dashboardRefresh: {
    idle: "刷新状态",
    busy: "刷新中...",
  },
  realtimeRefresh: {
    loading: "拉取快照中...",
    busy: "刷新中...",
    idle: "刷新快照",
  },
  realtimeOpenWidget: "单独打开挂件",
  processesRefresh: {
    idle: "刷新列表",
    busy: "刷新中...",
  },
  processInspect: "查看详情",
  historyRefresh: {
    idle: "刷新记录",
    busy: "刷新中...",
  },
  historyApply: "应用筛选",
  historyReset: "恢复默认",
  historyExportJson: "导出 JSON",
  historyExportCsv: "导出 CSV",
  historyPrev: "上一页",
  historyNext: "下一页",
  historyInspect: "查看详情",
  historyInspectMissing: "暂无详情",
  processDetailRefresh: {
    idle: "刷新详情",
    busy: "刷新中...",
  },
  diagnosticsRefresh: {
    idle: "重新检测",
    busy: "检测中...",
  },
  widget: {
    drag: "拖拽挂件",
    adjustCharacter: "拖动角色调整站位",
    resizeCharacter: "滚轮调整角色大小",
    refresh: "刷新快照",
    hoverLabel: "流量排行",
    empty: "当前还没有活跃连接。",
    openDashboard: "打开观察室",
    openDiagnostics: "前往诊断",
    opening: "打开中...",
    resetPlacement: "恢复默认站位",
  },
} as const;

export const GAL_RUNTIME_COPY = {
  bridgeMissingMessage: "桌面桥接暂时不可用，先用回退快照兜底。",
  liveSourceLabel: "真实观测",
  fallbackSourceLabel: "回退快照",
  connectingSourceLabel: "连接中",
  dashboardInitialSyncLabel: "同步中",
  processesInitialSyncLabel: "同步中",
  historyInitialSyncLabel: "同步中",
  processDetailInitialSyncLabel: "同步中",
  processDetailDisabledSourceLabel: "等待选择进程",
  processDetailDisabledSyncLabel: "尚未进入详情",
  disconnectedSyncLabel: "未接入真实链路",
  fallbackSyncLabel: "已切到回退观测",
  disabledSyncLabel: "当前未启用",
  unknownError: "未知错误",
} as const;

export function getRuntimeModeLabel(mode: DashboardRuntimeMode) {
  switch (mode) {
    case "live":
      return "真实观测";
    case "mock":
      return "示意模式";
    case "fallback":
      return "回退观测";
    case "connecting":
      return "连接中";
    case "disabled":
      return "未启用";
  }
}

export function getRealtimeRuntimeLabel(mode: DashboardRuntimeMode, options?: {
  isLoading?: boolean;
  isRefreshing?: boolean;
  hasError?: boolean;
}) {
  if (options?.isRefreshing) {
    return "刷新中";
  }
  if (options?.isLoading) {
    return "同步中";
  }
  if (options?.hasError) {
    return "链路异常";
  }
  return getRuntimeModeLabel(mode);
}

export function getCaptureModeLabel(mode: string) {
  switch (mode) {
    case "proc_fallback":
      return "回退采集";
    case "ebpf":
      return "eBPF";
    case "unknown":
      return "识别中";
    default:
      return mode;
  }
}

export function getWidgetStateLabel(state: string) {
  switch (state.trim().toLowerCase()) {
    case "idle":
      return "安静值守";
    case "download":
    case "download_active":
      return "下行活跃";
    case "upload":
    case "upload_active":
      return "上行活跃";
    case "bidirectional":
    case "bidirectional_active":
      return "双向忙碌";
    case "alerting":
      return "提醒触发";
    case "unknown":
      return "识别中";
    default:
      return state;
  }
}

export function getAlertBadgeLabel(hasAlert: boolean) {
  return hasAlert ? "需关注" : "稳定";
}

export function getAgentStatusLabel(status: string) {
  switch (status.trim().toLowerCase()) {
    case "healthy":
    case "running":
    case "online":
      return "在线";
    case "degraded":
      return "降级运行";
    case "offline":
    case "unreachable":
    case "disconnected":
      return "未连接";
    case "unknown":
      return "识别中";
    default:
      return status;
  }
}

export function getDatabaseStatusLabel(status: string) {
  switch (status.trim().toLowerCase()) {
    case "healthy":
      return "正常";
    case "degraded":
      return "需关注";
    case "offline":
    case "unreachable":
      return "不可用";
    case "unknown":
      return "识别中";
    default:
      return status;
  }
}

export function getConnectionStateLabel(state: string) {
  switch (state.trim().toLowerCase()) {
    case "established":
      return "已建立";
    case "observed":
      return "已观测";
    case "unknown":
      return "识别中";
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
