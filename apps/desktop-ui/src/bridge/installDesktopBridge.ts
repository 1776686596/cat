import { resolveDevDesktopBridge } from "./devDesktopBridge";
import { createMockDesktopBridge } from "./mockDesktopBridge";
import { resolveDesktopBridge } from "./desktopBridge";
import { resolveNativeDesktopBridge } from "./nativeDesktopBridge";

export function installDesktopBridge() {
  if (typeof window === "undefined") {
    return;
  }

  const mode = readBridgeMode();
  if (mode === "off") {
    return;
  }

  if (resolveDesktopBridge()) {
    return;
  }

  if (mode !== "mock") {
    const nativeBridge = resolveNativeDesktopBridge();
    if (nativeBridge) {
      window.__TRAFFIC_CAT_DASHBOARD__ = nativeBridge;
      return;
    }

    const devBridge = resolveDevDesktopBridge();
    if (devBridge) {
      window.__TRAFFIC_CAT_DASHBOARD__ = devBridge;
      return;
    }
  }

  window.__TRAFFIC_CAT_DASHBOARD__ = createMockDesktopBridge();
}

function readBridgeMode(): "auto" | "off" | "mock" {
  const search = new URLSearchParams(window.location.search);
  const mode = search.get("bridge");
  if (mode === "off") {
    return "off";
  }
  if (mode === "mock") {
    return "mock";
  }
  return "auto";
}
