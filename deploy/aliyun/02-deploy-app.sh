#!/usr/bin/env bash
# 构建并发布 Next.js standalone 到 /opt/qingchen-inventory
# 用法：
#   export APP_SRC=/path/to/qingchen-inventory   # 默认：脚本上级的上级（仓库根）
#   sudo -E bash 02-deploy-app.sh
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "请使用 root 或 sudo 执行" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_SRC="${APP_SRC:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
APP_DIR="/opt/qingchen-inventory"
ENV_FILE="$APP_DIR/.env.production"
BUILD_USER="${BUILD_USER:-ubuntu}"

if [[ ! -f "$APP_SRC/package.json" ]]; then
  echo "找不到 package.json：$APP_SRC" >&2
  exit 1
fi

echo "==> 源码目录: $APP_SRC"
echo "==> 发布目录: $APP_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "==> 写入默认 .env.production（请按需改 Supabase）"
  install -d -o www-data -g www-data "$APP_DIR"
  cp "$SCRIPT_DIR/env.production.example" "$ENV_FILE"
  # 若源码有 .env.local，优先拷贝三个公开变量
  # 优先用仓库内已填好的 deploy/aliyun/env.production
  if [[ -f "$SCRIPT_DIR/env.production" ]]; then
    cp "$SCRIPT_DIR/env.production" "$ENV_FILE"
  elif [[ -f "$APP_SRC/.env.local" ]]; then
    # 兼容 NEXT_PUBLIC_* 与 SUPABASE_* 两种键名
    python3 - <<PY > "$ENV_FILE"
from pathlib import Path
raw = Path("$APP_SRC/.env.local").read_text()
vals = {}
for line in raw.splitlines():
    line=line.strip()
    if not line or line.startswith("#") or "=" not in line: continue
    k,v=line.split("=",1)
    vals[k.strip()] = v.strip().strip('"').strip("'")
url = vals.get("NEXT_PUBLIC_SUPABASE_URL") or vals.get("SUPABASE_URL") or ""
key = vals.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") or vals.get("SUPABASE_ANON_KEY") or ""
mock = vals.get("NEXT_PUBLIC_USE_MOCK_DATA") or "true"
print("NODE_ENV=production")
print("PORT=3000")
print("HOSTNAME=0.0.0.0")
print(f"NEXT_PUBLIC_SUPABASE_URL={url}")
print(f"NEXT_PUBLIC_SUPABASE_ANON_KEY={key}")
print(f"NEXT_PUBLIC_USE_MOCK_DATA={mock}")
PY
  fi
  chmod 600 "$ENV_FILE"
  chown www-data:www-data "$ENV_FILE"
  # 强制演示模式默认 true（可手动改）
  grep -q '^NEXT_PUBLIC_USE_MOCK_DATA=' "$ENV_FILE" || echo 'NEXT_PUBLIC_USE_MOCK_DATA=true' >> "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  chown www-data:www-data "$ENV_FILE"
fi

echo "==> 当前环境变量键："
grep -E '^[A-Z0-9_]+=' "$ENV_FILE" | cut -d= -f1 || true

echo "==> 安装依赖并构建（加载 .env.production 供 NEXT_PUBLIC_* 内联）"
cd "$APP_SRC"
set -a
# shellcheck disable=SC1090
source <(grep -E '^[A-Z0-9_]+=' "$ENV_FILE" | sed 's/\r$//')
set +a
npm ci
npm run build

if [[ ! -f "$APP_SRC/.next/standalone/server.js" ]]; then
  echo "构建失败：缺少 .next/standalone/server.js（请确认 next.config 含 output: 'standalone'）" >&2
  exit 1
fi

echo "==> 同步 standalone 产物"
rsync -a --delete \
  "$APP_SRC/.next/standalone/" "$APP_DIR/"
mkdir -p "$APP_DIR/.next"
rsync -a --delete "$APP_SRC/.next/static/" "$APP_DIR/.next/static/"
rsync -a --delete "$APP_SRC/public/" "$APP_DIR/public/"

# 保留 env
[[ -f "$ENV_FILE" ]] || cp "$SCRIPT_DIR/env.production.example" "$ENV_FILE"
chown -R www-data:www-data "$APP_DIR"
chmod 600 "$ENV_FILE"

echo "==> 安装 systemd 服务"
cp "$SCRIPT_DIR/systemd/qingchen-inventory.service" /etc/systemd/system/qingchen-inventory.service
systemctl daemon-reload
systemctl enable qingchen-inventory
systemctl restart qingchen-inventory
sleep 2
systemctl --no-pager --full status qingchen-inventory || true

echo "==> 健康检查"
curl -sI -o /dev/null -w "local_http %{http_code}\n" http://127.0.0.1:3000/login || true

echo "完成。继续执行：sudo bash $SCRIPT_DIR/03-setup-nginx.sh"
