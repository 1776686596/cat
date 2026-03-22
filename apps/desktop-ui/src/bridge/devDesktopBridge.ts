import type { DesktopAppBridge } from "./desktopBridge";
import { createInvokeDesktopBridge } from "./invokeDesktopBridge";

const DEV_BRIDGE_ENDPOINT = "/__traffic_cat_bridge__/invoke";

export function resolveDevDesktopBridge(): DesktopAppBridge | null {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return null;
  }

  return createInvokeDesktopBridge(
    async (command, payload) => {
      const response = await fetch(DEV_BRIDGE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          command,
          payload,
        }),
      });

      const text = await response.text();
      const body = text.trim().length === 0 ? null : JSON.parse(text);
      if (!response.ok) {
        throw new Error(readBridgeError(body));
      }
      return body;
    },
    {
      sourceLabel: "开发代理桥接",
      bridgeKind: "dev",
    },
  );
}

function readBridgeError(body: unknown): string {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string" &&
    body.error.trim().length > 0
  ) {
    return body.error;
  }

  return "开发代理桥接请求失败";
}
