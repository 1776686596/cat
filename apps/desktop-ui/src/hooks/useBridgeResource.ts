import { startTransition, useEffect, useRef, useState } from "react";

import {
  resolveDesktopBridge,
  type DesktopAppBridge,
} from "../bridge/desktopBridge";
import { GAL_RUNTIME_COPY } from "../copy/galAbstract";
import type { DashboardRuntimeView } from "../types/appData";

const DEFAULT_POLL_INTERVAL_MILLIS = 5_000;

interface BridgeResourceResolution<T> {
  data: T;
  generatedAt: number | null;
  sourceLabel?: string;
}

interface BridgeResourceState<T> {
  data: T;
  runtime: DashboardRuntimeView;
}

interface BridgeResourceOptions<T> {
  enabled?: boolean;
  reloadKey?: string | number | null;
  fallbackData: () => T;
  disabledData?: () => T;
  loadWithBridge: (bridge: DesktopAppBridge) => Promise<BridgeResourceResolution<T>>;
  bridgeMissingMessage: string;
  liveSourceLabel: string;
  fallbackSourceLabel: string;
  connectingSourceLabel: string;
  initialSyncLabel: string;
  disabledSourceLabel?: string;
  disabledSyncLabel?: string;
  pollIntervalMillis?: number;
}

type LoadReason = "initial" | "manual" | "poll";

export function useBridgeResource<T>(options: BridgeResourceOptions<T>) {
  const requestIdRef = useRef(0);
  const [state, setState] = useState<BridgeResourceState<T>>(() =>
    buildInitialState(options),
  );

  async function load(reason: LoadReason) {
    if (options.enabled === false) {
      startTransition(() => {
        setState(buildDisabledState(options));
      });
      return;
    }

    const requestId = ++requestIdRef.current;
    const bridge = resolveDesktopBridge();

    if (!bridge) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      startTransition(() => {
        setState({
          data: options.fallbackData(),
          runtime: {
            isLoading: false,
            isRefreshing: false,
            isFallback: true,
            mode: "fallback",
            errorMessage: options.bridgeMissingMessage,
            sourceLabel: options.fallbackSourceLabel,
            lastUpdatedLabel: GAL_RUNTIME_COPY.disconnectedSyncLabel,
          },
        });
      });
      return;
    }

    setState((current) => ({
      ...current,
      runtime: {
        ...current.runtime,
        isLoading:
          reason === "initial" &&
          current.runtime.lastUpdatedLabel === options.initialSyncLabel,
        isRefreshing: reason !== "initial" || !current.runtime.isLoading,
        errorMessage: null,
        sourceLabel: current.runtime.isFallback
          ? options.connectingSourceLabel
          : current.runtime.sourceLabel,
      },
    }));

    try {
      const resolution = await options.loadWithBridge(bridge);
      if (requestId !== requestIdRef.current) {
        return;
      }

      startTransition(() => {
        const runtimeMode = bridge.bridgeKind === "mock" ? "mock" : "live";
        setState({
          data: resolution.data,
          runtime: {
            isLoading: false,
            isRefreshing: false,
            isFallback: false,
            mode: runtimeMode,
            errorMessage: null,
            sourceLabel:
              resolution.sourceLabel ??
              bridge.sourceLabel ??
              options.liveSourceLabel,
            lastUpdatedLabel: formatSyncLabel(
              resolution.generatedAt ?? Date.now(),
            ),
          },
        });
      });
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      startTransition(() => {
        setState({
          data: options.fallbackData(),
          runtime: {
            isLoading: false,
            isRefreshing: false,
            isFallback: true,
            mode: "fallback",
            errorMessage: `抓快照翻车：${normalizeError(error)}`,
            sourceLabel: options.fallbackSourceLabel,
            lastUpdatedLabel: GAL_RUNTIME_COPY.fallbackSyncLabel,
          },
        });
      });
    }
  }

  useEffect(() => {
    requestIdRef.current += 1;

    if (options.enabled === false) {
      startTransition(() => {
        setState(buildDisabledState(options));
      });
      return;
    }

    startTransition(() => {
      setState(buildLoadingState(options));
    });
    void load("initial");

    const timer = window.setInterval(() => {
      void load("poll");
    }, options.pollIntervalMillis ?? DEFAULT_POLL_INTERVAL_MILLIS);

    return () => {
      requestIdRef.current += 1;
      window.clearInterval(timer);
    };
  }, [options.enabled, options.reloadKey]);

  return {
    data: state.data,
    runtime: state.runtime,
    refresh: () => load("manual"),
  };
}

function buildInitialState<T>(
  options: BridgeResourceOptions<T>,
): BridgeResourceState<T> {
  if (options.enabled === false) {
    return buildDisabledState(options);
  }
  return buildLoadingState(options);
}

function buildLoadingState<T>(
  options: BridgeResourceOptions<T>,
): BridgeResourceState<T> {
  return {
    data: options.fallbackData(),
    runtime: {
      isLoading: true,
      isRefreshing: false,
      isFallback: true,
      mode: "connecting",
      errorMessage: null,
      sourceLabel: options.connectingSourceLabel,
      lastUpdatedLabel: options.initialSyncLabel,
    },
  };
}

function buildDisabledState<T>(
  options: BridgeResourceOptions<T>,
): BridgeResourceState<T> {
  return {
    data: options.disabledData ? options.disabledData() : options.fallbackData(),
    runtime: {
      isLoading: false,
      isRefreshing: false,
      isFallback: true,
      mode: "disabled",
      errorMessage: null,
      sourceLabel: options.disabledSourceLabel ?? options.fallbackSourceLabel,
      lastUpdatedLabel:
        options.disabledSyncLabel ?? GAL_RUNTIME_COPY.disabledSyncLabel,
    },
  };
}

function normalizeError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return GAL_RUNTIME_COPY.unknownError;
}

function formatSyncLabel(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `刚抓到 ${hours}:${minutes}:${seconds}`;
}
