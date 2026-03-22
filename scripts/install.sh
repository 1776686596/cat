#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_NAME="traffic-cat-agentd.service"
SERVICE_TEMPLATE="$ROOT_DIR/packaging/systemd/$SERVICE_NAME"
SERVICE_PATH="/etc/systemd/system/$SERVICE_NAME"
INSTALL_BIN_PATH="/usr/local/bin/traffic-cat-agentd"
AGENTD_BUILD_PATH="$ROOT_DIR/target/release/agentd"
DESKTOP_UI_BUILD_PATH="$ROOT_DIR/target/release/desktop-ui-shell"
INSTALL_DESKTOP_UI_BIN_PATH="/usr/local/bin/traffic-cat-desktop-ui"
DESKTOP_UI_DIR="$ROOT_DIR/apps/desktop-ui"
AGENT_RUNTIME_DIR="/run/traffic-cat"
AGENT_SOCKET_PATH="$AGENT_RUNTIME_DIR/agentd.sock"
AGENT_DATA_DIR="/var/lib/traffic-cat"
AGENT_DB_PATH="$AGENT_DATA_DIR/traffic.db"
PROJECT_DEV_CACHE_DIR="$ROOT_DIR/.dev"
PROJECT_PRIVILEGED_CACHE_DIR="/tmp/traffic-cat-dev"
DESKTOP_AUTOSTART_TEMPLATE="$ROOT_DIR/packaging/desktop/traffic-cat.desktop"

TARGET_USER="${SUDO_USER:-${USER:-root}}"
TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6 | head -n 1 || true)"
if [[ -z "$TARGET_HOME" ]]; then
  TARGET_HOME="${HOME:-/root}"
fi
TARGET_GROUP="$(id -gn "$TARGET_USER" 2>/dev/null || echo "$TARGET_USER")"
USER_CONFIG_DIR="$TARGET_HOME/.config/traffic-cat"
USER_AUTOSTART_FILE="$TARGET_HOME/.config/autostart/traffic-cat.desktop"
USER_CACHE_DIR="$TARGET_HOME/.cache/traffic-cat"

log_section() {
  echo
  echo "** 🔧 $1 **"
  echo
}

log_info() {
  echo "• $1"
}

log_warn() {
  echo "⚠️ $1" >&2
}

die() {
  echo "❌ $1" >&2
  exit 1
}

as_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

require_root_session() {
  if [[ "$(id -u)" -ne 0 ]]; then
    sudo -v
  fi
}

has_command() {
  command -v "$1" >/dev/null 2>&1
}

usage() {
  cat <<EOF
用法:
  ./scripts/install.sh install
  ./scripts/install.sh uninstall
  ./scripts/install.sh uninstall --purge
  ./scripts/install.sh help

说明:
  install            安装或修复 agentd 与 desktop-ui
  uninstall          卸载服务和程序文件，默认保留数据库与用户配置
  uninstall --purge  额外删除数据库、UI 配置和项目缓存
  不带参数            进入交互菜单
EOF
}

kernel_supports_ebpf() {
  local kernel_base
  kernel_base="$(uname -r)"
  kernel_base="${kernel_base%%-*}"
  [[ "$(printf '%s\n' "$kernel_base" "5.8" | sort -V | head -n 1)" == "5.8" ]]
}

check_platform_requirements() {
  log_section "环境检查"

  [[ "$(uname -s)" == "Linux" ]] || die "当前只支持 Linux 桌面环境"
  has_command systemctl || die "未找到 systemctl，无法安装 systemd 服务"
  [[ -d /run/systemd/system ]] || die "当前系统未运行 systemd，无法继续安装"
  has_command cargo || die "未找到 cargo，无法从源码构建 agentd 与 desktop-ui"
  has_command npm || die "未找到 npm，无法构建 desktop-ui 前端资源"

  log_info "系统类型：$(uname -s)"
  log_info "内核版本：$(uname -r)"

  if kernel_supports_ebpf; then
    log_info "内核版本满足 eBPF 优先模式的基础要求"
  else
    log_warn "内核版本偏低，安装后可能长期停留在 proc 回退模式"
  fi

  if [[ -d /sys/fs/bpf ]]; then
    log_info "检测到 /sys/fs/bpf"
  else
    log_warn "未检测到 /sys/fs/bpf，eBPF 能力可能不可用"
  fi

  if has_command setcap; then
    log_info "检测到 setcap，可为二进制附加额外 capability"
  else
    log_warn "未检测到 setcap；当前安装将依赖 systemd 以 root 服务运行 agentd"
  fi
}

build_agentd() {
  log_section "构建 agentd"
  (
    cd "$ROOT_DIR"
    cargo build --release -p agentd
  )
  [[ -x "$AGENTD_BUILD_PATH" ]] || die "构建完成后未找到 $AGENTD_BUILD_PATH"
  log_info "构建输出：$AGENTD_BUILD_PATH"
}

build_desktop_ui() {
  log_section "构建 desktop-ui"

  if [[ ! -x "$DESKTOP_UI_DIR/node_modules/.bin/tauri" ]]; then
    log_info "首次构建桌面端，先安装前端依赖"
    npm --prefix "$DESKTOP_UI_DIR" ci
  fi

  npm --prefix "$DESKTOP_UI_DIR" run tauri:build

  [[ -x "$DESKTOP_UI_BUILD_PATH" ]] || die "构建完成后未找到 $DESKTOP_UI_BUILD_PATH"
  log_info "构建输出：$DESKTOP_UI_BUILD_PATH"
}

stop_service_if_present() {
  if [[ -f "$SERVICE_PATH" ]] || as_root systemctl is-active --quiet "$SERVICE_NAME"; then
    as_root systemctl disable --now "$SERVICE_NAME" >/dev/null 2>&1 || true
    as_root systemctl stop "$SERVICE_NAME" >/dev/null 2>&1 || true
    log_info "已停止旧服务（如存在）"
  fi
}

install_agent_binary() {
  log_section "安装 agentd"
  as_root install -d -m 0755 /usr/local/bin "$AGENT_DATA_DIR" "$AGENT_RUNTIME_DIR"
  as_root install -m 0755 "$AGENTD_BUILD_PATH" "$INSTALL_BIN_PATH"
  log_info "已安装到 $INSTALL_BIN_PATH"

  if has_command setcap; then
    if as_root setcap cap_net_admin,cap_net_raw+ep "$INSTALL_BIN_PATH"; then
      log_info "已为二进制附加 cap_net_admin,cap_net_raw"
    else
      log_warn "setcap 配置失败，后续将继续依赖 root systemd 服务运行"
    fi
  fi
}

install_desktop_ui_binary() {
  log_section "安装 desktop-ui"
  as_root install -d -m 0755 /usr/local/bin
  as_root install -m 0755 "$DESKTOP_UI_BUILD_PATH" "$INSTALL_DESKTOP_UI_BIN_PATH"
  log_info "已安装到 $INSTALL_DESKTOP_UI_BIN_PATH"
}

install_service_unit() {
  log_section "注册 systemd 服务"
  [[ -f "$SERVICE_TEMPLATE" ]] || die "缺少 service 模板：$SERVICE_TEMPLATE"
  as_root install -m 0644 "$SERVICE_TEMPLATE" "$SERVICE_PATH"
  as_root systemctl daemon-reload
  log_info "已写入 $SERVICE_PATH"
}

install_autostart() {
  log_section "桌面端自启动"
  [[ -f "$DESKTOP_AUTOSTART_TEMPLATE" ]] || die "未找到桌面模板：$DESKTOP_AUTOSTART_TEMPLATE"

  as_root install -d -m 0755 -o "$TARGET_USER" -g "$TARGET_GROUP" "$(dirname "$USER_AUTOSTART_FILE")"
  as_root install -m 0644 -o "$TARGET_USER" -g "$TARGET_GROUP" \
    "$DESKTOP_AUTOSTART_TEMPLATE" "$USER_AUTOSTART_FILE"
  log_info "已写入自启动项 $USER_AUTOSTART_FILE"
}

wait_for_socket() {
  local attempt=0
  while [[ "$attempt" -lt 40 ]]; do
    if [[ -S "$AGENT_SOCKET_PATH" ]]; then
      return 0
    fi
    sleep 0.25
    attempt=$((attempt + 1))
  done

  return 1
}

probe_agent_socket() {
  local socket_path="$1"

  if [[ "$(id -u)" -eq 0 && "$TARGET_USER" != "root" ]]; then
    sudo -u "$TARGET_USER" -- python3 - "$socket_path" <<'PY'
import socket
import sys

sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
sock.settimeout(3)
sock.connect(sys.argv[1])
sock.sendall(b"GET /health HTTP/1.1\r\nHost: localhost\r\n\r\n")
sock.shutdown(socket.SHUT_WR)
response = sock.recv(4096)
sock.close()

if b"200 OK" not in response:
    raise SystemExit(1)
PY
    return
  fi

  python3 - "$socket_path" <<'PY'
import socket
import sys

sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
sock.settimeout(3)
sock.connect(sys.argv[1])
sock.sendall(b"GET /health HTTP/1.1\r\nHost: localhost\r\n\r\n")
sock.shutdown(socket.SHUT_WR)
response = sock.recv(4096)
sock.close()

if b"200 OK" not in response:
    raise SystemExit(1)
PY
}

health_check() {
  log_section "健康检查"

  as_root systemctl enable --now "$SERVICE_NAME"
  as_root systemctl is-active --quiet "$SERVICE_NAME" || die "systemd 服务未进入 active 状态"
  log_info "systemd 状态：active"

  wait_for_socket || die "agentd 已启动，但未发现 socket：$AGENT_SOCKET_PATH"
  log_info "socket 已就绪：$AGENT_SOCKET_PATH"

  if has_command python3; then
    if probe_agent_socket "$AGENT_SOCKET_PATH"; then
      log_info "普通用户 socket 连通性检查通过"
    else
      log_warn "普通用户无法直接访问 agentd socket，请检查服务日志和 socket 权限"
    fi
  else
    log_warn "未检测到 python3，跳过主动 UDS 探测，仅保留 service/socket 健康检查"
  fi

  log_info "数据库路径：$AGENT_DB_PATH"
}

install_command() {
  require_root_session
  check_platform_requirements
  build_agentd
  build_desktop_ui
  stop_service_if_present
  install_agent_binary
  install_desktop_ui_binary
  install_service_unit
  install_autostart
  health_check

  log_section "安装完成"
  log_info "agentd 已通过 systemd 安装完成"
  log_info "desktop-ui 已安装，并会在用户登录后自动启动"
}

remove_service_unit() {
  if [[ -f "$SERVICE_PATH" ]]; then
    as_root rm -f "$SERVICE_PATH"
    log_info "已删除 $SERVICE_PATH"
  fi

  as_root systemctl daemon-reload
}

uninstall_command() {
  local purge="${1:-false}"

  require_root_session
  log_section "卸载程序"

  stop_service_if_present

  if [[ -f "$INSTALL_BIN_PATH" ]]; then
    as_root rm -f "$INSTALL_BIN_PATH"
    log_info "已删除 $INSTALL_BIN_PATH"
  fi

  if [[ -f "$INSTALL_DESKTOP_UI_BIN_PATH" ]]; then
    as_root rm -f "$INSTALL_DESKTOP_UI_BIN_PATH"
    log_info "已删除 $INSTALL_DESKTOP_UI_BIN_PATH"
  fi

  remove_service_unit

  if [[ -d "$AGENT_RUNTIME_DIR" ]]; then
    as_root rm -rf "$AGENT_RUNTIME_DIR"
    log_info "已删除运行目录 $AGENT_RUNTIME_DIR"
  fi

  if [[ -f "$USER_AUTOSTART_FILE" ]]; then
    as_root rm -f "$USER_AUTOSTART_FILE"
    log_info "已删除自启动项 $USER_AUTOSTART_FILE"
  fi

  if [[ "$purge" == "true" ]]; then
    log_section "执行 purge 清理"

    if [[ -d "$AGENT_DATA_DIR" ]]; then
      as_root rm -rf "$AGENT_DATA_DIR"
      log_info "已删除数据库目录 $AGENT_DATA_DIR"
    fi

    if [[ -d "$USER_CONFIG_DIR" ]]; then
      as_root rm -rf "$USER_CONFIG_DIR"
      log_info "已删除 UI 配置目录 $USER_CONFIG_DIR"
    fi

    if [[ -d "$USER_CACHE_DIR" ]]; then
      as_root rm -rf "$USER_CACHE_DIR"
      log_info "已删除用户缓存目录 $USER_CACHE_DIR"
    fi

    if [[ -d "$PROJECT_DEV_CACHE_DIR" ]]; then
      as_root rm -rf "$PROJECT_DEV_CACHE_DIR"
      log_info "已删除项目开发缓存 $PROJECT_DEV_CACHE_DIR"
    fi

    if [[ -d "$PROJECT_PRIVILEGED_CACHE_DIR" ]]; then
      as_root rm -rf "$PROJECT_PRIVILEGED_CACHE_DIR"
      log_info "已删除特权开发缓存 $PROJECT_PRIVILEGED_CACHE_DIR"
    fi
  else
    log_info "默认保留数据库目录：$AGENT_DATA_DIR"
    log_info "默认保留 UI 配置目录：$USER_CONFIG_DIR"
  fi

  log_section "卸载完成"
}

interactive_menu() {
  echo
  echo "请选择要执行的操作："
  echo "  1. 安装"
  echo "  2. 卸载"
  echo "  3. 修复或重装"
  echo
  read -r -p "输入编号: " choice

  case "$choice" in
    1)
      install_command
      ;;
    2)
      uninstall_command false
      ;;
    3)
      install_command
      ;;
    *)
      die "无效选项：$choice"
      ;;
  esac
}

case "${1:-interactive}" in
  install)
    install_command
    ;;
  uninstall)
    case "${2:-}" in
      "")
        uninstall_command false
        ;;
      --purge)
        uninstall_command true
        ;;
      *)
        usage
        exit 1
        ;;
    esac
    ;;
  help|-h|--help)
    usage
    ;;
  interactive)
    interactive_menu
    ;;
  *)
    usage
    exit 1
    ;;
esac
