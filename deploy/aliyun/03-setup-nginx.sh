#!/usr/bin/env bash
# 安装 Nginx 反向代理（HTTP）
# 用法：sudo bash 03-setup-nginx.sh [域名]
# 无域名时可先用 IP 访问；有域名时传入 server_name
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "请使用 root 或 sudo 执行" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DOMAIN="${1:-_}"
SRC="$SCRIPT_DIR/nginx/qingchen-inventory.conf"
DST="/etc/nginx/sites-available/qingchen-inventory"

echo "==> 写入 Nginx 配置（server_name=$DOMAIN）"
sed "s/server_name _;/server_name $DOMAIN;/" "$SRC" > "$DST"

ln -sfn "$DST" /etc/nginx/sites-enabled/qingchen-inventory
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable nginx
systemctl reload nginx

PUBLIC_IP="$(curl -fsSL https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
echo "HTTP 已启用。"
echo "  本机：http://127.0.0.1/"
echo "  公网：http://${PUBLIC_IP}/"
if [[ "$DOMAIN" != "_" ]]; then
  echo "  域名：http://${DOMAIN}/ （请先把 DNS A 记录指到本机）"
  echo "申请 HTTPS：sudo bash $SCRIPT_DIR/04-setup-https.sh $DOMAIN you@email.com"
fi
