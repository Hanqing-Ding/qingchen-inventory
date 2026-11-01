#!/usr/bin/env bash
# Let's Encrypt HTTPS（certbot + nginx）
# 用法：sudo bash 04-setup-https.sh <域名> <邮箱>
# 前置：域名 A 记录已指向本机公网 IP；80 端口可达
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "请使用 root 或 sudo 执行" >&2
  exit 1
fi

DOMAIN="${1:-}"
EMAIL="${2:-}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
  echo "用法：sudo bash 04-setup-https.sh inventory.example.com you@example.com" >&2
  exit 1
fi

install -d -o www-data -g www-data /var/www/certbot

# 确保 HTTP server_name 正确，便于校验
HTTP_CONF="/etc/nginx/sites-available/qingchen-inventory"
if [[ -f "$HTTP_CONF" ]]; then
  sed -i "s/server_name .*/server_name $DOMAIN;/" "$HTTP_CONF" || true
  nginx -t && systemctl reload nginx
fi

echo "==> 申请证书：$DOMAIN"
certbot certonly --webroot -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --non-interactive \
  --keep-until-expiring

echo "==> 安装 HTTPS Nginx 配置"
HTTPS_SRC="$SCRIPT_DIR/nginx/qingchen-inventory.https.conf"
HTTPS_DST="/etc/nginx/sites-available/qingchen-inventory"
sed "s/YOUR_DOMAIN/$DOMAIN/g" "$HTTPS_SRC" > "$HTTPS_DST"
ln -sfn "$HTTPS_DST" /etc/nginx/sites-enabled/qingchen-inventory

nginx -t
systemctl reload nginx

# 自动续期（Ubuntu certbot 自带 timer）
systemctl enable certbot.timer || true
systemctl start certbot.timer || true

echo "HTTPS 完成：https://${DOMAIN}/"
echo "证书续期测试：certbot renew --dry-run"
