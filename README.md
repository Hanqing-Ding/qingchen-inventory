# 青陈时尚 · 服装出入库系统

Next.js (App Router) + Tailwind CSS + Supabase（Auth / Postgres / Storage）

## 本地启动

1. **准备 Supabase 项目**（Dashboard 新建）
2. 在 SQL Editor 执行本仓库 `supabase/schema.sql`（与 Project store 中的 `docs/supabase-schema.sql` 一致）
3. 在 Authentication 创建用户，并按 SQL 文件末尾说明把 `profiles.role` 设为 `admin` / `warehouse` / `merchandiser`
4. 配置环境变量：

```bash
cp .env.example .env.local
# 填写 NEXT_PUBLIC_SUPABASE_URL 与 NEXT_PUBLIC_SUPABASE_ANON_KEY
```

5. 安装依赖并启动：

```bash
npm install
npm run dev
```

浏览器打开 http://localhost:3000

## 功能一览

- 登录（Supabase Auth）
- 商品 SKU 档案：新增/编辑/按款号搜索、款式图上传（管理员可改档案与价格）
- 入库单：提交增加库存 + 流水
- 补货发货单：款号搜索带出颜色尺码，提交扣减库存（禁止负库存），可打印
- 库存总表：筛选 + Excel 导出
- 库存流水：查询 + Excel 导出
- 角色：管理员 / 仓管 / 跟单

## 设计说明

见 `supabase/database-design.md`。
