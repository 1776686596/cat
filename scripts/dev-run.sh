#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_DEV_ROOT="${TRAFFIC_CAT_DEV_ROOT:-$ROOT_DIR/.dev}"
DEFAULT_PRIVILEGED_DEV_ROOT="${TRAFFIC_CAT_PRIVILEGED_DEV_ROOT:-/tmp/traffic-cat-dev}"
AGENTD_BIN="$ROOT_DIR/target/debug/agentd"
DESKTOP_UI_SHELL_BIN="$ROOT_DIR/target/debug/desktop-ui-shell"
STARTER_PID=""
AGENTD_PID_FILE=""
AGENTD_LOG_FILE=""

configure_paths() {
  local mode="${1:-user}"
  local base_root="$DEFAULT_DEV_ROOT"
  if [[ "$mode" == "privileged" ]]; then
    base_root="$DEFAULT_PRIVILEGED_DEV_ROOT"
  fi

  SOCKET_PATH="${TRAFFIC_CAT_AGENT_SOCKET:-${TRAFFIC_CAT_AGENT_RUNTIME_DIR:-$base_root/run}/agentd.sock}"
  RUNTIME_DIR="${TRAFFIC_CAT_AGENT_RUNTIME_DIR:-$(dirname "$SOCKET_PATH")}"
  DATABASE_PATH="${TRAFFIC_CAT_AGENT_DATABASE_PATH:-$base_root/data/traffic.db}"
  DATABASE_DIR="$(dirname "$DATABASE_PATH")"

  mkdir -p "$RUNTIME_DIR" "$DATABASE_DIR"
}

export_agent_env() {
  export TRAFFIC_CAT_AGENT_RUNTIME_DIR="$RUNTIME_DIR"
  export TRAFFIC_CAT_AGENT_SOCKET="$SOCKET_PATH"
  export TRAFFIC_CAT_AGENT_SOCKET_PATH="$SOCKET_PATH"
  export TRAFFIC_CAT_AGENT_DATABASE_PATH="$DATABASE_PATH"
}

build_dev_binaries() {
  cd "$ROOT_DIR"
  cargo build -q -p agentd -p desktop-ui-shell
}

require_sudo() {
  if [[ "$(id -u)" -eq 0 ]]; then
    return
  fi
  sudo -v
}

wait_for_agentd_socket() {
  local attempt=0
  while [[ "$attempt" -lt 40 ]]; do
    if [[ -S "$SOCKET_PATH" ]]; then
      return 0
    fi
    sleep 0.25
    attempt=$((attempt + 1))
  done

  echo "agentd 没有在预期时间内创建 socket：$SOCKET_PATH" >&2
  if [[ -n "$AGENTD_LOG_FILE" && -f "$AGENTD_LOG_FILE" ]]; then
    echo "最近日志：" >&2
    tail -n 40 "$AGENTD_LOG_FILE" >&2 || true
  fi
  return 1
}

stop_privileged_agentd() {
  if [[ -n "$AGENTD_PID_FILE" && -f "$AGENTD_PID_FILE" ]]; then
    local agentd_pid
    agentd_pid="$(cat "$AGENTD_PID_FILE" 2>/dev/null || true)"
    if [[ -n "$agentd_pid" ]]; then
      if [[ "$(id -u)" -eq 0 ]]; then
        kill "$agentd_pid" 2>/dev/null || true
      else
        sudo kill "$agentd_pid" 2>/dev/null || true
      fi
    fi
    rm -f "$AGENTD_PID_FILE"
  fi

  if [[ -n "$STARTER_PID" ]]; then
    wait "$STARTER_PID" 2>/dev/null || true
  fi
}

usage() {
  cat <<EOF
用法:
  ./scripts/dev-run.sh env
  ./scripts/dev-run.sh env-root
  ./scripts/dev-run.sh agentd
  ./scripts/dev-run.sh agentd-root
  ./scripts/dev-run.sh ui
  ./scripts/dev-run.sh ui-desktop
  ./scripts/dev-run.sh all
  ./scripts/dev-run.sh all-mixed
  ./scripts/dev-run.sh all-desktop
  ./scripts/dev-run.sh all-desktop-mixed

当前普通用户开发环境:
  TRAFFIC_CAT_AGENT_RUNTIME_DIR=${TRAFFIC_CAT_AGENT_RUNTIME_DIR:-$DEFAULT_DEV_ROOT/run}
  TRAFFIC_CAT_AGENT_SOCKET=${TRAFFIC_CAT_AGENT_SOCKET:-$DEFAULT_DEV_ROOT/run/agentd.sock}
  TRAFFIC_CAT_AGENT_DATABASE_PATH=${TRAFFIC_CAT_AGENT_DATABASE_PATH:-$DEFAULT_DEV_ROOT/data/traffic.db}

当前混合提权开发环境:
  TRAFFIC_CAT_AGENT_RUNTIME_DIR=${TRAFFIC_CAT_AGENT_RUNTIME_DIR:-$DEFAULT_PRIVILEGED_DEV_ROOT/run}
  TRAFFIC_CAT_AGENT_SOCKET=${TRAFFIC_CAT_AGENT_SOCKET:-$DEFAULT_PRIVILEGED_DEV_ROOT/run/agentd.sock}
  TRAFFIC_CAT_AGENT_DATABASE_PATH=${TRAFFIC_CAT_AGENT_DATABASE_PATH:-$DEFAULT_PRIVILEGED_DEV_ROOT/data/traffic.db}

说明:
  all              = agentd 和浏览器 UI 都按普通用户启动，只适合骨架联调
  all-mixed        = 只给 agentd 提权，浏览器 UI 保持普通用户，适合看真实速率
  ui-desktop       = 构建前端静态资源并启动真正的桌面壳
  all-desktop      = agentd 和桌面壳都按普通用户启动
  all-desktop-mixed= 只给 agentd 提权，再启动真正的桌面壳
  agentd-root = 单独以特权模式启动 agentd
EOF
}

print_env() {
  configure_paths "${1:-user}"
  export_agent_env
  cat <<EOF
当前开发环境:
  TRAFFIC_CAT_AGENT_RUNTIME_DIR=$TRAFFIC_CAT_AGENT_RUNTIME_DIR
  TRAFFIC_CAT_AGENT_SOCKET=$TRAFFIC_CAT_AGENT_SOCKET
  TRAFFIC_CAT_AGENT_DATABASE_PATH=$TRAFFIC_CAT_AGENT_DATABASE_PATH
EOF
}

run_agentd() {
  configure_paths "user"
  export_agent_env
  build_dev_binaries
  cd "$ROOT_DIR"
  "$AGENTD_BIN"
}

run_agentd_root() {
  configure_paths "privileged"
  export_agent_env
  build_dev_binaries

  if [[ "$(id -u)" -eq 0 ]]; then
    "$AGENTD_BIN"
    return
  fi

  require_sudo
  sudo env \
    TRAFFIC_CAT_AGENT_RUNTIME_DIR="$TRAFFIC_CAT_AGENT_RUNTIME_DIR" \
    TRAFFIC_CAT_AGENT_SOCKET="$TRAFFIC_CAT_AGENT_SOCKET" \
    TRAFFIC_CAT_AGENT_SOCKET_PATH="$TRAFFIC_CAT_AGENT_SOCKET_PATH" \
    TRAFFIC_CAT_AGENT_DATABASE_PATH="$TRAFFIC_CAT_AGENT_DATABASE_PATH" \
    "$AGENTD_BIN"
}

start_privileged_agentd_background() {
  configure_paths "privileged"
  export_agent_env
  build_dev_binaries
  require_sudo

  AGENTD_PID_FILE="$DEFAULT_PRIVILEGED_DEV_ROOT/agentd.pid"
  AGENTD_LOG_FILE="$DEFAULT_PRIVILEGED_DEV_ROOT/agentd.log"
  mkdir -p "$(dirname "$AGENTD_PID_FILE")" "$(dirname "$AGENTD_LOG_FILE")"
  rm -f "$AGENTD_PID_FILE"

  if [[ "$(id -u)" -eq 0 ]]; then
    sh -c 'echo $$ > "$1"; exec "$2" >>"$3" 2>&1' sh \
      "$AGENTD_PID_FILE" "$AGENTD_BIN" "$AGENTD_LOG_FILE" &
  else
    sudo env \
      TRAFFIC_CAT_AGENT_RUNTIME_DIR="$TRAFFIC_CAT_AGENT_RUNTIME_DIR" \
      TRAFFIC_CAT_AGENT_SOCKET="$TRAFFIC_CAT_AGENT_SOCKET" \
      TRAFFIC_CAT_AGENT_SOCKET_PATH="$TRAFFIC_CAT_AGENT_SOCKET_PATH" \
      TRAFFIC_CAT_AGENT_DATABASE_PATH="$TRAFFIC_CAT_AGENT_DATABASE_PATH" \
      sh -c 'echo $$ > "$1"; exec "$2" >>"$3" 2>&1' sh \
      "$AGENTD_PID_FILE" "$AGENTD_BIN" "$AGENTD_LOG_FILE" &
  fi

  STARTER_PID="$!"
  wait_for_agentd_socket
}

run_ui() {
  local mode="${1:-user}"
  configure_paths "$mode"
  export_agent_env
  build_dev_binaries
  cd "$ROOT_DIR/apps/desktop-ui"
  npm run dev
}

run_ui_desktop() {
  local mode="${1:-user}"
  configure_paths "$mode"
  export_agent_env
  build_dev_binaries

  cd "$ROOT_DIR/apps/desktop-ui"
  npm run build

  cd "$ROOT_DIR"
  "$DESKTOP_UI_SHELL_BIN"
}

run_all() {
  configure_paths "user"
  export_agent_env
  build_dev_binaries

  "$AGENTD_BIN" &
  local agentd_pid=$!
  trap 'kill "$agentd_pid" 2>/dev/null || true' EXIT INT TERM

  run_ui "user"
}

run_all_mixed() {
  start_privileged_agentd_background
  trap 'stop_privileged_agentd' EXIT INT TERM
  run_ui "privileged"
}

run_all_desktop() {
  configure_paths "user"
  export_agent_env
  build_dev_binaries

  "$AGENTD_BIN" &
  local agentd_pid=$!
  trap 'kill "$agentd_pid" 2>/dev/null || true' EXIT INT TERM

  run_ui_desktop "user"
}

run_all_desktop_mixed() {
  start_privileged_agentd_background
  trap 'stop_privileged_agentd' EXIT INT TERM
  run_ui_desktop "privileged"
}

case "${1:-env}" in
  env)
    print_env "user"
    ;;
  env-root)
    print_env "privileged"
    ;;
  agentd)
    run_agentd
    ;;
  agentd-root)
    run_agentd_root
    ;;
  ui)
    run_ui "user"
    ;;
  ui-desktop)
    run_ui_desktop "user"
    ;;
  all)
    run_all
    ;;
  all-mixed)
    run_all_mixed
    ;;
  all-desktop)
    run_all_desktop
    ;;
  all-desktop-mixed)
    run_all_desktop_mixed
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    usage
    exit 1
    ;;
esac
