export type AppView =
  | "realtime"
  | "processes"
  | "process-detail"
  | "history"
  | "diagnostics";

export interface NavItem {
  key: AppView;
  label: string;
  copy: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    key: "realtime",
    label: "实时流向",
    copy: "观察当前最活跃的外连与速率。",
  },
  {
    key: "processes",
    label: "进程聚合",
    copy: "汇总每个进程的累计流量与目标数量。",
  },
  {
    key: "process-detail",
    label: "进程详情",
    copy: "预留进程时间线、目标列表和告警记录。",
  },
  {
    key: "history",
    label: "历史检索",
    copy: "预留多条件过滤和导出入口。",
  },
  {
    key: "diagnostics",
    label: "诊断页",
    copy: "展示 agentd 连接、权限和回退模式状态。",
  },
];
