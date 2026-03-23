import { GAL_NAV_ITEMS } from "../copy/galAbstract";

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

export const NAV_ITEMS: NavItem[] = [...GAL_NAV_ITEMS];
