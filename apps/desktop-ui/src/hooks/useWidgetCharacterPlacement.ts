import { useEffect, useRef, useState } from "react";

import type { WidgetLayoutMode } from "./useWidgetLayoutMode";

export interface WidgetCharacterPlacement {
  offsetX: number;
  offsetY: number;
  scale: number;
  overlayOpacity: number;
}

interface WidgetCharacterPlacementStore {
  "character-first": WidgetCharacterPlacement;
  "ranking-first": WidgetCharacterPlacement;
}

export const DEFAULT_WIDGET_CHARACTER_PLACEMENT: WidgetCharacterPlacement = {
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  overlayOpacity: 1,
};

export const WIDGET_CHARACTER_SCALE_MIN = 0.72;
export const WIDGET_CHARACTER_SCALE_MAX = 1.34;
export const WIDGET_CHARACTER_SCALE_STEP = 0.02;
export const WIDGET_OVERLAY_OPACITY_MIN = 0.42;
export const WIDGET_OVERLAY_OPACITY_MAX = 1;
export const WIDGET_OVERLAY_OPACITY_STEP = 0.02;

const WIDGET_CHARACTER_OFFSET_X_MIN = -120;
const WIDGET_CHARACTER_OFFSET_X_MAX = 120;
const WIDGET_CHARACTER_OFFSET_Y_MIN = -96;
const WIDGET_CHARACTER_OFFSET_Y_MAX = 96;
const WIDGET_CHARACTER_PLACEMENT_STORAGE_KEY =
  "traffic-cat.widget-character-placement";
const WIDGET_CHARACTER_PLACEMENT_PERSIST_DELAY_MS = 160;

const DEFAULT_WIDGET_CHARACTER_PLACEMENT_STORE: WidgetCharacterPlacementStore = {
  "character-first": DEFAULT_WIDGET_CHARACTER_PLACEMENT,
  "ranking-first": DEFAULT_WIDGET_CHARACTER_PLACEMENT,
};

export function useWidgetCharacterPlacement(layoutMode: WidgetLayoutMode) {
  const [store, setStore] = useState<WidgetCharacterPlacementStore>(() =>
    readWidgetCharacterPlacementStore(),
  );
  const pendingPersistRef = useRef(false);
  const latestStoreRef = useRef(store);

  useEffect(() => {
    latestStoreRef.current = store;
  }, [store]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== WIDGET_CHARACTER_PLACEMENT_STORAGE_KEY) {
        return;
      }
      setStore(normalizeWidgetCharacterPlacementStore(event.newValue));
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (!pendingPersistRef.current) {
        return;
      }

      writeWidgetCharacterPlacementStore(latestStoreRef.current);
      pendingPersistRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!pendingPersistRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      writeWidgetCharacterPlacementStore(store);
      pendingPersistRef.current = false;
    }, WIDGET_CHARACTER_PLACEMENT_PERSIST_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [store]);

  const placement = store[layoutMode];

  const setPlacement = (next: WidgetCharacterPlacement) => {
    const normalized = normalizeWidgetCharacterPlacement(next);
    pendingPersistRef.current = true;
    setStore((current) => {
      return {
        ...current,
        [layoutMode]: normalized,
      };
    });
  };

  const updatePlacement = (patch: Partial<WidgetCharacterPlacement>) => {
    setPlacement({
      ...placement,
      ...patch,
    });
  };

  const resetPlacement = () => {
    setPlacement(DEFAULT_WIDGET_CHARACTER_PLACEMENT);
  };

  return {
    placement,
    setPlacement,
    updatePlacement,
    resetPlacement,
  };
}

export function clampWidgetCharacterScale(value: number) {
  return clampNumber(
    value,
    WIDGET_CHARACTER_SCALE_MIN,
    WIDGET_CHARACTER_SCALE_MAX,
  );
}

export function clampWidgetOverlayOpacity(value: number) {
  return clampNumber(
    value,
    WIDGET_OVERLAY_OPACITY_MIN,
    WIDGET_OVERLAY_OPACITY_MAX,
  );
}

function readWidgetCharacterPlacementStore(): WidgetCharacterPlacementStore {
  if (typeof window === "undefined") {
    return DEFAULT_WIDGET_CHARACTER_PLACEMENT_STORE;
  }

  try {
    return normalizeWidgetCharacterPlacementStore(
      window.localStorage.getItem(WIDGET_CHARACTER_PLACEMENT_STORAGE_KEY),
    );
  } catch {
    return DEFAULT_WIDGET_CHARACTER_PLACEMENT_STORE;
  }
}

function writeWidgetCharacterPlacementStore(store: WidgetCharacterPlacementStore) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      WIDGET_CHARACTER_PLACEMENT_STORAGE_KEY,
      JSON.stringify(store),
    );
  } catch {
    // WebView 存储受限时，退回到当前内存态即可。
  }
}

function normalizeWidgetCharacterPlacementStore(
  value: string | null | undefined,
): WidgetCharacterPlacementStore {
  if (!value) {
    return DEFAULT_WIDGET_CHARACTER_PLACEMENT_STORE;
  }

  try {
    const parsed = JSON.parse(value) as Partial<WidgetCharacterPlacementStore>;
    return {
      "character-first": normalizeWidgetCharacterPlacement(
        parsed["character-first"],
      ),
      "ranking-first": normalizeWidgetCharacterPlacement(parsed["ranking-first"]),
    };
  } catch {
    return DEFAULT_WIDGET_CHARACTER_PLACEMENT_STORE;
  }
}

function normalizeWidgetCharacterPlacement(
  value?: Partial<WidgetCharacterPlacement> | null,
): WidgetCharacterPlacement {
  return {
    offsetX: clampNumber(
      readFiniteNumber(value?.offsetX, DEFAULT_WIDGET_CHARACTER_PLACEMENT.offsetX),
      WIDGET_CHARACTER_OFFSET_X_MIN,
      WIDGET_CHARACTER_OFFSET_X_MAX,
    ),
    offsetY: clampNumber(
      readFiniteNumber(value?.offsetY, DEFAULT_WIDGET_CHARACTER_PLACEMENT.offsetY),
      WIDGET_CHARACTER_OFFSET_Y_MIN,
      WIDGET_CHARACTER_OFFSET_Y_MAX,
    ),
    scale: clampWidgetCharacterScale(
      readFiniteNumber(value?.scale, DEFAULT_WIDGET_CHARACTER_PLACEMENT.scale),
    ),
    overlayOpacity: clampWidgetOverlayOpacity(
      readFiniteNumber(
        value?.overlayOpacity,
        DEFAULT_WIDGET_CHARACTER_PLACEMENT.overlayOpacity,
      ),
    ),
  };
}

function readFiniteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
