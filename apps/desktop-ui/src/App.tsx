import { useEffect, useState } from "react";

import DashboardApp from "./app/App";
import type { AppView } from "./app/navigation";
import {
  buildAppUrl,
  mergeAppLaunchContext,
  readAppLaunchContext,
} from "./app/windowMode";
import { resolveDesktopBridge } from "./bridge/desktopBridge";
import WidgetPage from "./pages/WidgetPage";

export default function App() {
  const [launchContext, setLaunchContext] = useState(() => readAppLaunchContext());

  useEffect(() => {
    document.documentElement.dataset.windowMode = launchContext.windowMode;
    document.body.dataset.windowMode = launchContext.windowMode;
    return () => {
      delete document.documentElement.dataset.windowMode;
      delete document.body.dataset.windowMode;
    };
  }, [launchContext.windowMode]);

  useEffect(() => {
    const syncLaunchContext = () => {
      setLaunchContext(readAppLaunchContext());
    };

    window.__TRAFFIC_CAT_SET_LAUNCH_CONTEXT__ = (next) => {
      window.__TRAFFIC_CAT_LAUNCH_CONTEXT__ = {
        ...(window.__TRAFFIC_CAT_LAUNCH_CONTEXT__ ?? {}),
        ...next,
      };
      setLaunchContext((current) => mergeAppLaunchContext(current, next));
    };

    window.addEventListener("popstate", syncLaunchContext);
    return () => {
      delete window.__TRAFFIC_CAT_SET_LAUNCH_CONTEXT__;
      window.removeEventListener("popstate", syncLaunchContext);
    };
  }, []);

  async function openDashboardWindow(view: Extract<AppView, "realtime" | "diagnostics">) {
    const bridge = resolveDesktopBridge();
    if (bridge?.bridgeKind === "native") {
      if (!bridge.showMainWindow) {
        console.warn("原生桌面桥接未提供 showMainWindow 命令。");
        return;
      }

      try {
        await bridge.showMainWindow({ view });
      } catch (error) {
        console.warn("打开主窗口失败：", error);
      }
      return;
    }

    window.history.replaceState(
      null,
      "",
      buildAppUrl({
        windowMode: "dashboard",
        initialView: view,
      }),
    );
    setLaunchContext(readAppLaunchContext());
  }

  if (launchContext.windowMode === "widget") {
    return <WidgetPage onOpenDashboard={openDashboardWindow} />;
  }

  return (
    <DashboardApp
      key={`dashboard-${launchContext.initialView}`}
      initialView={launchContext.initialView}
    />
  );
}
