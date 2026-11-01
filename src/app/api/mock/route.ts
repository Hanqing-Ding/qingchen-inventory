import { NextResponse } from "next/server";
import { isMockPreview } from "@/lib/mock/mode";
import {
  mockAdjustInventory,
  mockCancelReplenish,
  mockCreateRepair,
  mockCreateReplenish,
  mockCreateShareLink,
  mockDisablePortalLink,
  mockDisableShareLink,
  mockEnableShareLink,
  mockFulfillReplenish,
  mockGeneratePortalLink,
  mockGetPortalCatalog,
  mockGetPublicShareCatalog,
  mockImportProducts,
  mockListShareLinks,
  mockLogPortalAccess,
  mockLookupStyleImage,
  mockManualShipment,
  mockPortalSubmitReplenish,
  mockPortalSubmitRepair,
  mockQuickInbound,
  mockRepairComplete,
  mockRepairReceive,
  mockRepairScrap,
  mockRepairShip,
  mockRepairStart,
  mockSaveProduct,
  mockSaveShop,
  mockSearchSkus,
  mockBatchArchiveShops,
  mockBatchDeleteOrArchiveSkus,
  mockBatchRestoreShops,
  mockBatchRestoreSkus,
  mockSetStoreVisible,
  mockUpdateProductImages,
  resetMockDb,
  type ProductImportLine,
  type RepairLineInput,
} from "@/lib/mock/store";
import type { ExternalShareType, ProductWithSkus, Shop } from "@/types/database";

/** 开发预览 Mock 写接口；生产不可用 */
export async function POST(request: Request) {
  if (!isMockPreview()) {
    return NextResponse.json({ error: "Mock 仅开发预览可用" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { action } = body as { action: string };

    switch (action) {
      case "quickInbound":
        return NextResponse.json(
          mockQuickInbound({
            style_no: body.style_no,
            color: body.color,
            size: body.size,
            quantity: Number(body.quantity),
          }),
        );
      case "adjustInventory":
        return NextResponse.json(
          mockAdjustInventory({
            sku_id: String(body.sku_id),
            quantity: body.quantity != null ? Number(body.quantity) : undefined,
            delta: body.delta != null ? Number(body.delta) : undefined,
            remark: body.remark ?? null,
          }),
        );
      case "importProducts":
        return NextResponse.json(
          mockImportProducts(body.lines as ProductImportLine[]),
        );
      case "saveShop":
        return NextResponse.json(
          mockSaveShop(body.shop as Partial<Shop> & { code: string; name: string }, body.id),
        );
      case "saveProduct":
        return NextResponse.json(
          mockSaveProduct(body.product as ProductWithSkus, Boolean(body.isNew)),
        );
      case "updateProductImages":
        return NextResponse.json(
          mockUpdateProductImages(
            String(body.productId),
            (body.image_urls as string[]) ?? [],
            (body.white_bg_url as string | null | undefined) ?? undefined,
          ),
        );
      case "createReplenish":
        return NextResponse.json(
          mockCreateReplenish({
            shop_id: body.shop_id,
            request_date: body.request_date,
            remark: body.remark,
            lines: body.lines,
          }),
        );
      case "fulfillReplenish":
        return NextResponse.json(mockFulfillReplenish(body.requestId));
      case "cancelReplenish":
        return NextResponse.json(mockCancelReplenish(body.requestId));
      case "generatePortalLink":
        return NextResponse.json(mockGeneratePortalLink(body.shopId));
      case "disablePortalLink":
        return NextResponse.json(mockDisablePortalLink(body.shopId));
      case "logPortalAccess":
        return NextResponse.json(mockLogPortalAccess(String(body.token ?? "")));
      case "getPortalCatalog":
        return NextResponse.json(mockGetPortalCatalog(body.token));
      case "setStoreVisible":
        return NextResponse.json(
          mockSetStoreVisible(
            (body.productIds as string[]) ?? [],
            Boolean(body.visible),
          ),
        );
      case "batchDeleteOrArchiveSkus":
        return NextResponse.json(
          mockBatchDeleteOrArchiveSkus(
            (body.items as {
              sku_id: string;
              style_no: string;
              color: string;
              size: string;
            }[]) ?? [],
          ),
        );
      case "batchRestoreSkus":
        return NextResponse.json(
          mockBatchRestoreSkus((body.skuIds as string[]) ?? []),
        );
      case "batchArchiveShops":
        return NextResponse.json(
          mockBatchArchiveShops((body.shopCodes as string[]) ?? []),
        );
      case "batchRestoreShops":
        return NextResponse.json(
          mockBatchRestoreShops((body.shopCodes as string[]) ?? []),
        );
      case "listShareLinks":
        return NextResponse.json(
          mockListShareLinks(body.type as ExternalShareType | undefined),
        );
      case "createShareLink":
        return NextResponse.json(
          mockCreateShareLink({
            type: body.type as ExternalShareType,
            title: String(body.title ?? ""),
            product_ids: (body.product_ids as string[]) ?? [],
            watermark: body.watermark ?? null,
          }),
        );
      case "disableShareLink":
        return NextResponse.json(mockDisableShareLink(String(body.id)));
      case "enableShareLink":
        return NextResponse.json(mockEnableShareLink(String(body.id)));
      case "getPublicShareCatalog":
        return NextResponse.json(mockGetPublicShareCatalog(String(body.token)));
      case "lookupStyleImage":
        return NextResponse.json(mockLookupStyleImage(String(body.style_no ?? "")));
      case "searchSkus":
        return NextResponse.json(mockSearchSkus(String(body.style_no ?? "")));
      case "manualShipment":
        return NextResponse.json(
          mockManualShipment({
            shop_id: body.shop_id,
            remark: body.remark,
            lines: body.lines,
          }),
        );
      case "portalSubmitReplenish":
        return NextResponse.json(
          mockPortalSubmitReplenish(
            body.token,
            body.lines as { sku_id: string; quantity: number }[],
            body.remark,
          ),
        );
      case "portalSubmitRepair":
        return NextResponse.json(
          mockPortalSubmitRepair(
            body.token,
            body.lines as {
              sku_id: string;
              quantity: number;
              defect_reasons: string[];
              defect_note?: string | null;
            }[],
            body.remark,
          ),
        );
      case "createRepair":
        return NextResponse.json(
          mockCreateRepair({
            shop_id: body.shop_id,
            remark: body.remark,
            source: body.source ?? "manual",
            lines: body.lines as RepairLineInput[],
          }),
        );
      case "repairReceive":
        return NextResponse.json(mockRepairReceive(String(body.repairId)));
      case "repairStart":
        return NextResponse.json(mockRepairStart(String(body.repairId)));
      case "repairComplete":
        return NextResponse.json(mockRepairComplete(String(body.repairId)));
      case "repairShip":
        return NextResponse.json(mockRepairShip(String(body.repairId)));
      case "repairScrap":
        return NextResponse.json(
          mockRepairScrap(String(body.repairId), body.remark ?? null),
        );
      case "reset":
        return NextResponse.json(resetMockDb());
      default:
        return NextResponse.json({ error: `未知 action: ${action}` }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "错误";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
