# 四表对齐说明

线上 Supabase 仅使用：

| 表 | 用途 |
|----|------|
| `clothing_styles` | 款式档案（款号、品名、类别、供应商/品牌、封面图） |
| `skus` | 颜色尺码库存单元，库存字段 `current_stock` |
| `stock_in` | 入库记录 |
| `stock_out` | 出库记录 |

## 字段映射（UI → 库）

| UI | 库 |
|----|----|
| Product | clothing_styles |
| brand | supplier |
| image_url | cover_img |
| composition | remark |
| ProductSku.quantity | skus.current_stock |
| ProductSku.product_id | skus.style_id |
| retail_price | skus.sell_price |
| 入库流水 | stock_in |
| 出库流水 | stock_out（`order_no` 聚合为出库单） |

## 出入库规则

1. **入库**：插入 `stock_in`，同时 `skus.current_stock += quantity`
2. **出库**：插入 `stock_out`，同时 `skus.current_stock -= quantity`（禁止负库存）

请在 Supabase SQL Editor 执行：

`supabase/migrations/006_four_tables_stock_rpcs.sql`

安装 `quick_inbound` / `submit_stock_out` / `adjust_inventory`。
应用层在 RPC 未部署时会自动回退为直写四表。

## SKU 软归档

执行：

`supabase/migrations/007_skus_deleted_at.sql`

为 `skus` 增加 `deleted_at`。库存总表默认过滤已归档；有出入库流水的批量删除改为写 `deleted_at`，无流水才物理删除。不改三个 RPC。

## 合作店铺

执行：

`supabase/migrations/008_shops_and_stock_out_shop_id.sql`

新建 `shops`（`shop_code` 主键），并为 `stock_out` 增加 `shop_id`（不改 RPC）。下属门店发货地址取父店，备注带【来源门店：名称】。
