# 阿里云轻量应用服务器部署指南

青陈时尚 · 服装出入库（Next.js）— **不依赖 Vercel / Zeabur / Render**。  
目标环境：阿里云轻量应用服务器（推荐 **Ubuntu 22.04 / 24.04**，2 核 2G 起）。

对接 Supabase，默认环境变量：

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key |
| `NEXT_PUBLIC_USE_MOCK_DATA` | 设为 `true` 使用内存假数据演示 |

单据：**出库单 / 入库单 / 返修单** 支持浏览器打印与「另存为 PDF」（打印对话框选择 PDF 打印机）。

---

## 目录说明

```
deploy/aliyun/
  01-setup-server.sh      # 装 Node 20、Nginx、Certbot、防火墙
  02-deploy-app.sh        # npm ci + build standalone → /opt/qingchen-inventory
  03-setup-nginx.sh       # HTTP 反向代理
  04-setup-https.sh       # Let's Encrypt HTTPS
  update.sh               # 代码更新快捷入口
  env.production.example
  nginx/
  systemd/
```

---

## 一、控制台准备

1. 购买/打开轻量实例，镜像选 **Ubuntu 22.04+**。
2. **防火墙 / 安全组**放行：`22`、`80`、`443`。
3. （可选）域名解析：A 记录 → 服务器公网 IP。
4. SSH 登录：`ssh root@你的公网IP`（或轻量「远程连接」）。

---

## 二、上传代码

任选一种：

```bash
# A) git（推荐）
cd /opt
git clone https://github.com/Hanqing-Ding/qingchen-Fashion.git qingchen-inventory-src
# 若私有仓，改用带 token 的 URL 或 scp

# B) 本机打包上传
# 在开发机：tar czf app.tgz --exclude=node_modules --exclude=.next .
# scp app.tgz root@IP:/opt/
# 服务器：mkdir -p /opt/qingchen-inventory-src && tar xzf app.tgz -C /opt/qingchen-inventory-src
```

确保仓库根目录含 `package.json` 与 `deploy/aliyun/`。

---

## 三、一键执行（按顺序）

```bash
cd /opt/qingchen-inventory-src/deploy/aliyun
chmod +x *.sh

# 1) 系统依赖
sudo bash 01-setup-server.sh

# 2) 配置环境变量后构建发布
# 若仓库里已有 deploy/aliyun/env.production（已填 Supabase），构建脚本会自动拷贝
# 否则：
#   sudo mkdir -p /opt/qingchen-inventory
#   sudo cp env.production.example /opt/qingchen-inventory/.env.production
#   sudo nano /opt/qingchen-inventory/.env.production

sudo -E APP_SRC=/opt/qingchen-inventory-src bash 02-deploy-app.sh

# 3) Nginx（可先用 IP）
sudo bash 03-setup-nginx.sh
# 有域名：
# sudo bash 03-setup-nginx.sh inventory.你的域名.com

# 4) HTTPS（域名 DNS 已生效后）
sudo bash 04-setup-https.sh inventory.你的域名.com 你的邮箱@example.com
```

完成后访问：

- 仅 IP：`http://公网IP/`
- 域名 HTTPS：`https://inventory.你的域名.com/`

登录页 `/login`；Mock 模式下免真实 Supabase 账号也可进后台（`USE_MOCK_DATA=true`）。

---

## 四、常用运维

```bash
# 看服务
sudo systemctl status qingchen-inventory
sudo journalctl -u qingchen-inventory -f

# 改环境变量后必须重建（NEXT_PUBLIC_* 在 build 时内联）
sudo nano /opt/qingchen-inventory/.env.production
cd /opt/qingchen-inventory-src && sudo git pull   # 若用 git
sudo -E APP_SRC=/opt/qingchen-inventory-src bash /opt/qingchen-inventory-src/deploy/aliyun/update.sh

# Nginx
sudo nginx -t && sudo systemctl reload nginx
```

---

## 五、单据打印 / PDF

| 单据 | 入口 |
|------|------|
| 出库单 | 出库列表 → 打印；或补货拣货成功后跳转 |
| 入库单 | 快捷入库成功后弹层；或「打印本批入库单」 |
| 返修单 | 返修详情 → 发出并打印 |

操作：**打印单据** 或 **导出 PDF**（打印对话框 → 打印机选「另存为 PDF」）。模板已按 A4 适配，隐藏导航与按钮。

---

## 六、架构简述

```
浏览器 → Nginx:80/443 → 127.0.0.1:3000 (Next.js standalone, systemd)
                              ↓（USE_MOCK_DATA=false 时）
                         Supabase API
```

---

## 七、故障排查

| 现象 | 处理 |
|------|------|
| 502 Bad Gateway | `systemctl status qingchen-inventory`；确认 3000 在听 |
| 构建 OOM | 轻量升配，或加 swap：`fallocate -l 2G /swap && mkswap /swap && swapon /swap` |
| HTTPS 申请失败 | 确认 DNS A 记录、安全组 80 开放、`server_name` 为域名 |
| 改了 Supabase 变量不生效 | `NEXT_PUBLIC_*` 需重新 `02-deploy-app.sh` 构建 |
