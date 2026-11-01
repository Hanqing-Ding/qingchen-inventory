# 青陈时尚 · 服装出入库系统 — 数据库设计说明

## 1. 设计目标

面向仓库与跟单日常作业的轻量库存系统：以「款号 + 颜色 + 尺码」为唯一库存单元，支持 SKU 档案、入库、补货发货、库存查询与流水追溯，并按角色控制改价/改档案权限。

技术：PostgreSQL（Supabase）+ Auth；应用层 Next.js。

---

## 2. 库存粒度

| 概念 | 说明 |
|------|------|
| 商品（`products`） | 款级档案：品牌、款号、品名、款式图、成分、类别、零售价 |
| SKU / 库存单元（`product_skus`） | **款号 + 颜色 + 尺码** 唯一；持有当前库存数量 |
| 库存变动 | 一切增减必须写 `stock_movements`，禁止直接改库存而不留流水 |

唯一约束：`(product_id, color, size)` 在 `product_skus` 上唯一；业务上等价于「同一款号下颜色+尺码不重复」。

---

## 3. 角色模型

| 角色代码 | 名称 | 权限 |
|----------|------|------|
| `admin` | 管理员 | 全权限：改档案、改价、入库、发货、看全部流水、导出 |
| `warehouse` | 仓管 | 搜 SKU、入库、发货、看库存与流水；**不可**改基础资料与价格 |
| `merchandiser` | 跟单 | 搜 SKU、发货、看库存与流水；**不可**改基础资料与价格 |

角色存在 `profiles.role`，与 `auth.users` 一对一。应用层按角色隐藏入口；RLS 在表级二次约束写权限。

---

## 4. 表结构

### 4.1 `profiles` — 用户资料

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | uuid | PK，FK → auth.users | 与 Auth 用户同 id |
| `display_name` | text | not null | 显示名 |
| `role` | text | not null，check | `admin` / `warehouse` / `merchandiser` |
| `created_at` | timestamptz | default now() | |
| `updated_at` | timestamptz | default now() | |

### 4.2 `shops` — 合作零售店铺（补货发货去向）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | uuid | PK | |
| `code` | text | unique not null | 店铺编码 |
| `name` | text | not null | 零售方/门店名称 |
| `contact_name` | text | | 对接人 |
| `phone` | text | | 联系电话 |
| `address` | text | | 收货/门店地址 |
| `remark` | text | | 合作说明等 |
| `is_active` | boolean | default true | 停用后发货列表默认不展示 |
| `created_at` | timestamptz | | |

发货单必选 `shop_id`，标明本单发给哪家合作店。仓管/跟单/管理员均可维护店铺档案。

### 4.3 `products` — 款级商品档案

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | uuid | PK | |
| `brand` | text | not null | 品牌 |
| `style_no` | text | unique not null | 款号（业务主键） |
| `name` | text | not null | 品名 |
| `image_url` | text | | 款式图（Supabase Storage） |
| `composition` | text | | 成分 |
| `category` | text | not null | 类别 |
| `retail_price` | numeric(12,2) | not null，≥0 | 零售价 |
| `barcode` | text | | **扫码扩展预留**（款级条码，可空） |
| `is_active` | boolean | default true | 软下架 |
| `created_by` | uuid | FK profiles | |
| `updated_by` | uuid | FK profiles | |
| `created_at` / `updated_at` | timestamptz | | |

索引：`style_no`（唯一）、`brand`、`category`、`(brand, category)`。

### 4.4 `product_skus` — 颜色尺码库存单元

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | uuid | PK | |
| `product_id` | uuid | FK products，not null | |
| `color` | text | not null | 颜色 |
| `size` | text | not null | 尺码 |
| `quantity` | integer | not null，default 0，≥0 | **当前库存** |
| `sku_barcode` | text | | **扫码扩展预留**（SKU 级条码） |
| `created_at` / `updated_at` | timestamptz | | |

唯一：`UNIQUE (product_id, color, size)`。  
索引：`product_id`；可选 `sku_barcode`（where not null）。

### 4.5 `inbound_orders` / `inbound_order_items` — 入库单

**inbound_orders**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | uuid | PK |
| `order_no` | text unique | 入库单号（触发器或应用生成） |
| `remark` | text | 备注 |
| `status` | text | `draft` / `submitted` |
| `created_by` | uuid | 操作人 |
| `submitted_at` | timestamptz | 提交时间 |
| `created_at` | timestamptz | |

**inbound_order_items**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | uuid | PK |
| `inbound_order_id` | uuid | FK |
| `product_sku_id` | uuid | FK |
| `quantity` | integer | >0 |

提交时：各 SKU `quantity += item.quantity`，并写 `stock_movements`（`movement_type = inbound`）。

### 4.5b `replenish_requests` / `replenish_request_items` — 每日补货需求

跟单与仓拣分工：跟单录入需求 → 仓拣可见 → 拣货完成后调用 `fulfill_replenish_request` 一键生成出库单并扣库存。

**replenish_requests**

| 字段 | 说明 |
|------|------|
| `request_no` | RQ+日期+序号 |
| `shop_id` | 发往合作店铺 |
| `request_date` | 需求日期 |
| `status` | `open` 待拣货 / `shipped` 已出库 / `cancelled` 作废 |
| `shipment_order_id` | 生成后的出库单 |

**流程函数**：`create_replenish_request`、`add_replenish_item`、`fulfill_replenish_request`、`cancel_replenish_request`。

### 4.6 `shipment_orders` / `shipment_order_items` — 出库单（可由补货需求一键生成）

**shipment_orders**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | uuid | PK |
| `order_no` | text unique | 发货单号（可打印） |
| `shop_id` | uuid | FK shops（多店铺） |
| `remark` | text | |
| `status` | text | `draft` / `submitted` |
| `created_by` | uuid | |
| `submitted_at` | timestamptz | |
| `created_at` | timestamptz | |

**shipment_order_items**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | uuid | PK |
| `shipment_order_id` | uuid | FK |
| `product_sku_id` | uuid | FK |
| `quantity` | integer | >0 |

提交时：校验库存充足，`quantity -= item.quantity`（禁止负库存），写 `stock_movements`（`movement_type = shipment`，`ref_no = order_no`）。

### 4.7 `stock_movements` — 库存变动流水

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | uuid | PK |
| `product_sku_id` | uuid | FK |
| `movement_type` | text | `inbound` / `shipment` / `adjust`（库存总表手工改数 / 盘点） |
| `quantity_delta` | integer | 入库为正、发货为负 |
| `quantity_after` | integer | 变动后库存快照 |
| `ref_no` | text | 关联单号（发货单号/入库单号） |
| `shop_id` | uuid | 可空；发货时填店铺 |
| `operator_id` | uuid | 操作人 |
| `remark` | text | |
| `created_at` | timestamptz | 变动时间 |

索引：`created_at desc`、`ref_no`、`product_sku_id`、`shop_id`、`operator_id`。

查询展示需 join：`product_skus` → `products`（款号、品牌等）、`shops`、`profiles`。

### 4.8 库存总表手工调整

UI 在「库存」栏支持直接改数或 ±1。调用 `adjust_inventory(p_sku_id, p_quantity, p_remark)`：设为目标库存，禁止负数，写入 `movement_type = adjust`。

### 4.9 商品档案 Excel 导入

管理员可上传 `.xlsx` 批量建档。列：图片、品牌、款号、品名、类别、颜色、尺码、零售价、成分、条码、初始库存。支持单元格嵌入图片（按行绑定到该款）。同一款号多行表示多色多码；已存在的颜色/尺码不覆盖库存。

### 4.10 `stocktake_orders`（盘点扩展预留）

预留表结构：盘点单头 + 明细（账面数、实盘数、差异），提交后写 `movement_type = adjust`。

---

## 5. 约束与业务规则

1. **负库存禁止**：发货提交与手工调整均不可使库存 < 0。
2. **流水必写**：入库 / 出库 / 手工调整与流水同事务。
3. **改价/改档案/Excel 导入**：仅 `admin`（RLS + 应用层双重校验）。
4. **单号**：`IN`/`SH` + `YYYYMMDD` + 序号（函数生成）。
5. **软删除**：商品用 `is_active`，不物理删已有流水的 SKU。

---

## 6. 索引策略（摘要）

- `products(style_no)` UNIQUE；`products(brand)`；`products(category)`
- `product_skus(product_id, color, size)` UNIQUE
- `stock_movements(created_at DESC)`；`stock_movements(ref_no)`
- `inbound_orders(order_no)` / `shipment_orders(order_no)` UNIQUE
- 可选：`products` / `product_skus` 的 barcode 部分索引（扫码扩展）

---

## 7. RLS 思路

- 开启所有业务表 RLS。
- 已登录用户可读业务数据（库存/流水对仓管与跟单可见）。
- `products` / `product_skus` 的 INSERT/UPDATE/DELETE：仅 `admin`（仓管可入库导致的库存 UPDATE 通过 **SECURITY DEFINER** 函数完成，避免仓管直接改档案）。
- 入库/发货单：`warehouse`、`merchandiser`、`admin` 可建单与提交；提交逻辑走 DB 函数保证原子性与负库存校验。
- `profiles.role`：普通用户不可改自己的 role；仅 service role / 管理员策略可改。

辅助函数：`public.current_user_role()` 读取当前用户角色。

---

## 8. Storage

Bucket：`product-images`（公开读或签名 URL）。  
路径建议：`{product_id}/{timestamp}.{ext}`。  
上传：已登录用户；删除/覆盖：admin。

---

## 9. 扩展预留清单

| 扩展 | Schema 预留 |
|------|-------------|
| 扫码 | `products.barcode`、`product_skus.sku_barcode` |
| 多店铺 | `shops` 表；发货单/流水 `shop_id` |
| 盘点 | `stocktake_*` 表；`movement_type = adjust` |

---

## 10. 种子数据建议

- 默认店铺：`DEFAULT` / 默认店
- 管理员：在 Supabase Auth 创建用户后，向 `profiles` 写入 `role = admin`
- 可选：演示款与 SKU（由应用或 SQL 注释说明，避免污染生产）

详细 DDL、触发器、RLS 与函数见同目录 `supabase-schema.sql`。
