import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { defineConfig, loadEnv, type Plugin } from "vite";

const execFileAsync = promisify(execFile);
const APP_ROOT = fileURLToPath(new URL(".", import.meta.url));
const WORKSPACE_ROOT = resolve(APP_ROOT, "../..");
const DESKTOP_UI_SHELL_PATH = resolve(
  WORKSPACE_ROOT,
  "target/debug/desktop-ui-shell",
);
const DEV_BRIDGE_ROUTE = "/__traffic_cat_bridge__/invoke";
const COMMAND_LOAD_DASHBOARD = "bridge_load_dashboard_payload";
const COMMAND_LOAD_PROCESSES = "bridge_load_processes_payload";
const COMMAND_LOAD_HISTORY = "bridge_load_history_payload";
const COMMAND_LOAD_PROCESS_DETAIL = "bridge_load_process_detail_payload";
const COMMAND_SHOW_MAIN_WINDOW = "bridge_show_main_window";
const ENV_AGENT_SOCKET_PATH = "TRAFFIC_CAT_AGENT_SOCKET";
const ENV_AGENT_SOCKET_PATH_LEGACY = "TRAFFIC_CAT_AGENT_SOCKET_PATH";
const ENV_REQUEST_TIMEOUT_MILLIS = "TRAFFIC_CAT_AGENT_TIMEOUT_MILLIS";

let shellBinaryPromise: Promise<string> | null = null;

export default defineConfig(({ mode }) => {
  const loadedEnv = loadEnv(mode, APP_ROOT, "");
  const shellExecEnv = buildShellExecEnv(loadedEnv);

  return {
    plugins: [trafficCatDevBridgePlugin(shellExecEnv)],
  };
});

function trafficCatDevBridgePlugin(shellExecEnv: NodeJS.ProcessEnv): Plugin {
  return {
    name: "traffic-cat-dev-bridge",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== DEV_BRIDGE_ROUTE || req.method !== "POST") {
          next();
          return;
        }

        try {
          const rawBody = await readRequestBody(req);
          const input = parseBridgeInvokeInput(rawBody);
          const payload = await invokeDesktopUiShell(input, shellExecEnv);
          writeJson(res, 200, payload);
        } catch (error) {
          writeJson(res, 500, {
            error: formatBridgeError(error, shellExecEnv),
          });
        }
      });
    },
  };
}

async function invokeDesktopUiShell(
  input: BridgeInvokeInput,
  shellExecEnv: NodeJS.ProcessEnv,
) {
  const binaryPath = await ensureDesktopUiShell();
  const args = [input.command, ...buildCliArgs(input.command, input.payload)];
  const { stdout } = await execFileAsync(binaryPath, args, {
    cwd: WORKSPACE_ROOT,
    timeout: 10_000,
    maxBuffer: 1024 * 1024 * 4,
    env: shellExecEnv,
  });
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return JSON.parse(trimmed) as unknown;
}

async function ensureDesktopUiShell() {
  if (!shellBinaryPromise) {
    shellBinaryPromise = ensureDesktopUiShellInner().catch((error) => {
      shellBinaryPromise = null;
      throw error;
    });
  }

  return shellBinaryPromise;
}

async function ensureDesktopUiShellInner() {
  try {
    await access(DESKTOP_UI_SHELL_PATH, fsConstants.X_OK);
    return DESKTOP_UI_SHELL_PATH;
  } catch {
    await execFileAsync(
      "cargo",
      ["build", "-q", "-p", "desktop-ui-shell"],
      {
        cwd: WORKSPACE_ROOT,
        timeout: 60_000,
        maxBuffer: 1024 * 1024 * 4,
      },
    );
    await access(DESKTOP_UI_SHELL_PATH, fsConstants.X_OK);
    return DESKTOP_UI_SHELL_PATH;
  }
}

async function readRequestBody(
  req: Parameters<NonNullable<Plugin["configureServer"]>>[0]["middlewares"]["use"] extends (
    ...args: infer T
  ) => unknown
    ? T[0]
    : never,
) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseBridgeInvokeInput(rawBody: string): BridgeInvokeInput {
  const parsed = JSON.parse(rawBody) as Partial<BridgeInvokeInput> | null;
  if (!parsed || typeof parsed.command !== "string") {
    throw new Error("开发代理缺少 command 参数");
  }

  return {
    command: parsed.command,
    payload:
      parsed.payload && typeof parsed.payload === "object" ? parsed.payload : {},
  };
}

function buildCliArgs(command: string, payload: Record<string, unknown>) {
  switch (command) {
    case COMMAND_LOAD_DASHBOARD:
    case COMMAND_LOAD_PROCESSES:
    case COMMAND_SHOW_MAIN_WINDOW:
      return [];
    case COMMAND_LOAD_HISTORY:
      return buildHistoryCliArgs(payload);
    case COMMAND_LOAD_PROCESS_DETAIL:
      return buildProcessDetailCliArgs(payload);
    default:
      throw new Error(`开发代理收到未知命令: ${command}`);
  }
}

function buildHistoryCliArgs(payload: Record<string, unknown>) {
  const args: string[] = [];
  pushStringArg(args, "--process-name", readString(payload, "process_name"));
  pushStringArg(args, "--target", readString(payload, "target"));
  pushNumberArg(args, "--port", readNumber(payload, "port"));
  pushStringArg(args, "--direction", readDirection(payload));
  pushNumberArg(args, "--started-after", readNumber(payload, "started_after"));
  pushNumberArg(args, "--ended-before", readNumber(payload, "ended_before"));
  pushNumberArg(args, "--limit", readNumber(payload, "limit"));
  pushNumberArg(args, "--offset", readNumber(payload, "offset"));

  if (payload.include_lan_traffic === true) {
    args.push("--include-lan-traffic");
  }

  return args;
}

function buildProcessDetailCliArgs(payload: Record<string, unknown>) {
  const pid = readNumber(payload, "pid");
  if (pid === undefined) {
    throw new Error("开发代理缺少 pid 参数");
  }
  return ["--pid", String(pid)];
}

function pushStringArg(args: string[], flag: string, value: string | undefined) {
  if (value !== undefined) {
    args.push(flag, value);
  }
}

function pushNumberArg(args: string[], flag: string, value: number | undefined) {
  if (value !== undefined) {
    args.push(flag, String(value));
  }
}

function readString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readNumber(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.trunc(value);
}

function readDirection(payload: Record<string, unknown>) {
  const value = payload.direction;
  if (value === "outbound" || value === "inbound") {
    return value;
  }
  return undefined;
}

function writeJson(res: Parameters<NonNullable<Plugin["configureServer"]>>[0]["middlewares"]["use"] extends (
  ...args: infer T
) => unknown
  ? T[1]
  : never,
statusCode: number, body: unknown) {
  const encoded = JSON.stringify(body);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(encoded);
}

function normalizeError(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "开发代理桥接失败";
}

function formatBridgeError(error: unknown, shellExecEnv: NodeJS.ProcessEnv) {
  const socketPath =
    shellExecEnv[ENV_AGENT_SOCKET_PATH] ??
    shellExecEnv[ENV_AGENT_SOCKET_PATH_LEGACY] ??
    "/run/traffic-cat/agentd.sock";
  return `${normalizeError(error)}（当前 socket: ${socketPath}）`;
}

function buildShellExecEnv(loadedEnv: Record<string, string>): NodeJS.ProcessEnv {
  const execEnv: NodeJS.ProcessEnv = {
    ...process.env,
  };

  const socketPath =
    loadedEnv[ENV_AGENT_SOCKET_PATH] ??
    loadedEnv[ENV_AGENT_SOCKET_PATH_LEGACY] ??
    process.env[ENV_AGENT_SOCKET_PATH] ??
    process.env[ENV_AGENT_SOCKET_PATH_LEGACY];
  if (socketPath) {
    execEnv[ENV_AGENT_SOCKET_PATH] = socketPath;
    execEnv[ENV_AGENT_SOCKET_PATH_LEGACY] = socketPath;
  }

  const requestTimeoutMillis =
    loadedEnv[ENV_REQUEST_TIMEOUT_MILLIS] ??
    process.env[ENV_REQUEST_TIMEOUT_MILLIS];
  if (requestTimeoutMillis) {
    execEnv[ENV_REQUEST_TIMEOUT_MILLIS] = requestTimeoutMillis;
  }

  return execEnv;
}

interface BridgeInvokeInput {
  command: string;
  payload: Record<string, unknown>;
}
