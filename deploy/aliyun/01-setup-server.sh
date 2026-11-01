#!/usr/bin/env bash
# 阿里云轻量应用服务器 — 首次环境安装（Ubuntu 22.04 / 24.04）
# 用法：sudo bash 01-setup-server.sh
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "请使用 root 或 sudo 执行" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "==> 系统更新"
apt-get update -y
apt-get upgrade -y

echo "==> 基础包"
apt-get install -y curl ca-certificates gnupg git ufw nginx certbot python3-certbot-nginx

echo "==> Node.js 20.x (NodeSource)"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v
npm -v

echo "==> 应用目录"
install -d -o www-data -g www-data /opt/qingchen-inventory
install -d -o www-data -g www-data /var/www/certbot

echo "==> 防火墙（轻量控制台安全组也需放行 80/443）"
ufw allow OpenSSH || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
ufw --force enable || true
ufw status || true

echo "==> 完成。下一步："
echo "  1) 把项目代码放到 /opt/qingchen-inventory-src（或 git clone）"
echo "  2) sudo bash 02-deploy-app.sh"
echo "  3) sudo bash 03-setup-nginx.sh"
echo "  4) （有域名后）sudo bash 04-setup-https.sh your.domain.com you@email.com"
