#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

PACKAGE_NAME="${PACKAGE_NAME:-traffic-cat}"
VERSION="${VERSION:-0.1.0}"
ARCH="${ARCH:-amd64}"
MAINTAINER="${MAINTAINER:-traffic}"
OUTPUT_DIR="${OUTPUT_DIR:-$ROOT_DIR/target/release/bundle/full-deb}"
AGENTD_BIN="${AGENTD_BIN:-$ROOT_DIR/target/release/agentd}"
DESKTOP_UI_BIN="${DESKTOP_UI_BIN:-$ROOT_DIR/target/release/desktop-ui-shell}"
SERVICE_FILE="${SERVICE_FILE:-$ROOT_DIR/packaging/systemd/traffic-cat-agentd.service}"
DESKTOP_FILE="${DESKTOP_FILE:-$ROOT_DIR/packaging/desktop/traffic-cat.desktop}"

require_file() {
  local path="$1"
  local label="$2"

  [[ -f "$path" ]] || {
    echo "缺少 $label：$path" >&2
    exit 1
  }
}

require_executable() {
  local path="$1"
  local label="$2"

  require_file "$path" "$label"
  [[ -x "$path" ]] || {
    echo "$label 不可执行：$path" >&2
    exit 1
  }
}

require_executable "$AGENTD_BIN" "agentd 二进制"
require_executable "$DESKTOP_UI_BIN" "desktop-ui 二进制"
require_file "$SERVICE_FILE" "systemd service"
require_file "$DESKTOP_FILE" "desktop entry"

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

package_root="$work_dir/${PACKAGE_NAME}_${VERSION}_${ARCH}"
control_dir="$package_root/DEBIAN"

install -d -m 0755 \
  "$control_dir" \
  "$package_root/etc/systemd/system" \
  "$package_root/usr/local/bin" \
  "$package_root/usr/share/applications"

install -m 0755 "$AGENTD_BIN" "$package_root/usr/local/bin/traffic-cat-agentd"
install -m 0755 "$DESKTOP_UI_BIN" "$package_root/usr/local/bin/traffic-cat-desktop-ui"
install -m 0644 "$SERVICE_FILE" "$package_root/etc/systemd/system/traffic-cat-agentd.service"
install -m 0644 "$DESKTOP_FILE" "$package_root/usr/share/applications/traffic-cat.desktop"

cat >"$control_dir/postinst" <<'SCRIPT'
#!/usr/bin/env bash
set -e

case "${1:-}" in
  configure)
    install -d -m 0755 /var/lib/traffic-cat /run/traffic-cat
    if command -v systemctl >/dev/null 2>&1; then
      systemctl daemon-reload || true
      systemctl enable --now traffic-cat-agentd.service || {
        echo "traffic-cat: 无法自动启动 traffic-cat-agentd.service，请运行 systemctl status traffic-cat-agentd.service 查看原因" >&2
      }
    fi
    ;;
esac

exit 0
SCRIPT

cat >"$control_dir/prerm" <<'SCRIPT'
#!/usr/bin/env bash
set -e

case "${1:-}" in
  remove|deconfigure|upgrade)
    if command -v systemctl >/dev/null 2>&1; then
      systemctl disable --now traffic-cat-agentd.service || true
    fi
    ;;
esac

exit 0
SCRIPT

cat >"$control_dir/postrm" <<'SCRIPT'
#!/usr/bin/env bash
set -e

case "${1:-}" in
  remove|purge|disappear)
    if command -v systemctl >/dev/null 2>&1; then
      systemctl daemon-reload || true
    fi
    ;;
esac

exit 0
SCRIPT

chmod 0755 "$control_dir/postinst" "$control_dir/prerm" "$control_dir/postrm"

installed_size="$(du -sk "$package_root" | awk '{print $1}')"
cat >"$control_dir/control" <<EOF
Package: $PACKAGE_NAME
Version: $VERSION
Section: utils
Priority: optional
Architecture: $ARCH
Maintainer: $MAINTAINER
Installed-Size: $installed_size
Depends: libwebkit2gtk-4.1-0, libgtk-3-0
Description: Traffic Cat desktop network monitor
 Traffic Cat installs the desktop UI and the traffic-cat-agentd system service.
EOF

install -d -m 0755 "$OUTPUT_DIR"
dpkg-deb --build "$package_root" "$OUTPUT_DIR/${PACKAGE_NAME}_${VERSION}_${ARCH}.deb"
