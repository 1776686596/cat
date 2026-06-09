#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUILD_SCRIPT="$ROOT_DIR/packaging/linux/build-deb.sh"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

mkdir -p "$tmp_dir/bin" "$tmp_dir/out"

cat >"$tmp_dir/bin/agentd" <<'BIN'
#!/usr/bin/env bash
echo fake agentd
BIN
chmod 0755 "$tmp_dir/bin/agentd"

cat >"$tmp_dir/bin/desktop-ui-shell" <<'BIN'
#!/usr/bin/env bash
echo fake desktop ui
BIN
chmod 0755 "$tmp_dir/bin/desktop-ui-shell"

VERSION=9.8.7 \
ARCH=amd64 \
OUTPUT_DIR="$tmp_dir/out" \
AGENTD_BIN="$tmp_dir/bin/agentd" \
DESKTOP_UI_BIN="$tmp_dir/bin/desktop-ui-shell" \
  "$BUILD_SCRIPT"

package_path="$tmp_dir/out/traffic-cat_9.8.7_amd64.deb"
[[ -f "$package_path" ]] || {
  echo "missing package: $package_path" >&2
  exit 1
}

contents_file="$tmp_dir/contents.txt"
dpkg-deb -c "$package_path" >"$contents_file"

assert_contains() {
  local expected="$1"
  if ! grep -Fq "$expected" "$contents_file"; then
    echo "package contents missing: $expected" >&2
    cat "$contents_file" >&2
    exit 1
  fi
}

assert_contains "usr/local/bin/traffic-cat-agentd"
assert_contains "usr/local/bin/traffic-cat-desktop-ui"
assert_contains "etc/systemd/system/traffic-cat-agentd.service"
assert_contains "usr/share/applications/traffic-cat.desktop"

control_dir="$tmp_dir/control"
dpkg-deb -e "$package_path" "$control_dir"

[[ -x "$control_dir/postinst" ]] || {
  echo "postinst is missing or not executable" >&2
  exit 1
}

[[ -x "$control_dir/prerm" ]] || {
  echo "prerm is missing or not executable" >&2
  exit 1
}

grep -Fq "systemctl enable --now traffic-cat-agentd.service" "$control_dir/postinst" || {
  echo "postinst does not enable agentd" >&2
  exit 1
}

grep -Fq "systemctl disable --now traffic-cat-agentd.service" "$control_dir/prerm" || {
  echo "prerm does not disable agentd" >&2
  exit 1
}
