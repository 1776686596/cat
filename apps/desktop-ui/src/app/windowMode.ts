import type { AppView } from "./navigation";

export type AppWindowMode = "dashboard" | "widget";
export type AppLaunchView = Extract<
  AppView,
  "realtime" | "processes" | "history" | "diagnostics"
>;

export interface AppLaunchContext {
  windowMode: AppWindowMode;
  initialView: AppLaunchView;
}

const SUPPORTED_VIEWS = new Set<AppView>([
  "realtime",
  "processes",
  "history",
  "diagnostics",
]);

declare global {
  interface Window {
    __TRAFFIC_CAT_LAUNCH_CONTEXT__?: Partial<AppLaunchContext>;
    __TRAFFIC_CAT_SET_LAUNCH_CONTEXT__?: (
      next: Partial<AppLaunchContext>,
    ) => void;
  }
}

export function readAppLaunchContext(
  location: Location = window.location,
): AppLaunchContext {
  const injectedContext = normalizeLaunchContextPatch(
    window.__TRAFFIC_CAT_LAUNCH_CONTEXT__,
  );
  const search = new URLSearchParams(location.search);
  const explicitWindowMode = normalizeWindowMode(search.get("window"));
  const explicitView = normalizeView(search.get("view"));

  return {
    windowMode:
      injectedContext.windowMode ??
      explicitWindowMode ??
      inferWindowModeFromRoute(location.pathname, location.hash) ??
      "dashboard",
    initialView:
      injectedContext.initialView ??
      explicitView ??
      inferViewFromRoute(location.pathname, location.hash) ??
      "realtime",
  };
}

export function buildAppUrl(context: AppLaunchContext): string {
  const search = new URLSearchParams(window.location.search);
  search.set("window", context.windowMode);
  search.set("view", context.initialView);
  return `${window.location.pathname}?${search.toString()}${window.location.hash}`;
}

export function mergeAppLaunchContext(
  current: AppLaunchContext,
  next?: Partial<AppLaunchContext>,
): AppLaunchContext {
  const patch = normalizeLaunchContextPatch(next);
  return {
    windowMode: patch.windowMode ?? current.windowMode,
    initialView: patch.initialView ?? current.initialView,
  };
}

function normalizeWindowMode(value: string | null): AppWindowMode | null {
  if (value === "widget") {
    return "widget";
  }
  if (value === "dashboard" || value === "main") {
    return "dashboard";
  }
  return null;
}

function normalizeView(value: string | null): AppLaunchContext["initialView"] | null {
  if (value && SUPPORTED_VIEWS.has(value as AppView)) {
    return value as AppLaunchView;
  }
  return null;
}

function normalizeLaunchContextPatch(
  value?: Partial<AppLaunchContext>,
): Partial<AppLaunchContext> {
  if (!value) {
    return {};
  }

  return {
    windowMode: normalizeWindowMode(value.windowMode ?? null) ?? undefined,
    initialView: normalizeView(value.initialView ?? null) ?? undefined,
  };
}

function inferWindowModeFromRoute(
  pathname: string,
  hash: string,
): AppWindowMode | null {
  const route = `${pathname}${hash}`.toLowerCase();
  if (route.includes("/widget") || route.includes("#widget")) {
    return "widget";
  }
  return null;
}

function inferViewFromRoute(pathname: string, hash: string): AppView | null {
  const route = `${pathname}${hash}`.toLowerCase();
  if (route.includes("/diagnostics") || route.includes("#diagnostics")) {
    return "diagnostics";
  }
  if (route.includes("/history") || route.includes("#history")) {
    return "history";
  }
  if (route.includes("/processes") || route.includes("#processes")) {
    return "processes";
  }
  if (route.includes("/realtime") || route.includes("#realtime")) {
    return "realtime";
  }
  return null;
}
