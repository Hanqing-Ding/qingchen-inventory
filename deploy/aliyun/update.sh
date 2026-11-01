#!/usr/bin/env bash
# 代码更新后重新构建发布（不改 Nginx / 证书）
# 用法：sudo -E APP_SRC=/path/to/repo bash update.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec bash "$SCRIPT_DIR/02-deploy-app.sh"
