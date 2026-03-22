import type { DesktopAppBridge } from "./desktopBridge";
import { createInvokeDesktopBridge } from "./invokeDesktopBridge";

export function resolveNativeDesktopBridge(): DesktopAppBridge | null {
  if (typeof window === "undefined") {
    return null;
  }

  const invoke =
    window.__TRAFFIC_CAT_NATIVE_INVOKE__ ??
    window.__TAURI__?.core?.invoke ??
    window.__TAURI_INTERNALS__?.invoke;

  if (!invoke) {
    return null;
  }

  return createInvokeDesktopBridge(invoke, {
    sourceLabel: "原生桌面桥接",
    bridgeKind: "native",
  });
}
