import { useEffect, useState } from "react";

export type WidgetLayoutMode = "character-first" | "ranking-first";

const WIDGET_LAYOUT_MODE_STORAGE_KEY = "traffic-cat.widget-layout-mode";
const DEFAULT_WIDGET_LAYOUT_MODE: WidgetLayoutMode = "character-first";

export function useWidgetLayoutMode() {
  const [layoutMode, setLayoutModeState] = useState<WidgetLayoutMode>(() =>
    readWidgetLayoutMode(),
  );

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== WIDGET_LAYOUT_MODE_STORAGE_KEY) {
        return;
      }
      setLayoutModeState(normalizeWidgetLayoutMode(event.newValue));
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setLayoutMode = (next: WidgetLayoutMode) => {
    setLayoutModeState(next);
    writeWidgetLayoutMode(next);
  };

  return {
    layoutMode,
    setLayoutMode,
  };
}

export function readWidgetLayoutMode(): WidgetLayoutMode {
  if (typeof window === "undefined") {
    return DEFAULT_WIDGET_LAYOUT_MODE;
  }

  try {
    return normalizeWidgetLayoutMode(
      window.localStorage.getItem(WIDGET_LAYOUT_MODE_STORAGE_KEY),
    );
  } catch {
    return DEFAULT_WIDGET_LAYOUT_MODE;
  }
}

function writeWidgetLayoutMode(next: WidgetLayoutMode) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(WIDGET_LAYOUT_MODE_STORAGE_KEY, next);
  } catch {
    // Tauri WebView 受限时静默回退到内存态即可。
  }
}

function normalizeWidgetLayoutMode(
  value: string | null | undefined,
): WidgetLayoutMode {
  return value === "ranking-first"
    ? "ranking-first"
    : DEFAULT_WIDGET_LAYOUT_MODE;
}
