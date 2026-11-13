import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "inventory", "view");

    const reportType = req.nextUrl.searchParams.get("type") || "variant_summary";
    const warehouseId = req.nextUrl.searchParams.get("warehouseId");
    const customerId = req.nextUrl.searchParams.get("customerId");
    const siteId = req.nextUrl.searchParams.get("siteId");

    let reportData: any = [];

    switch (reportType) {
      // 1. Material Category / Type Summary
      case "material_summary": {
        const types = await db.materialType.findMany({
          include: {
            category: true,
            variants: {
              include: { stockBalances: true },
            },
          },
        });

        reportData = types.map((t) => {
          let totalQty = 0;
          let availableQty = 0;
          for (const v of t.variants) {
            for (const b of v.stockBalances) {
              totalQty += Number(b.totalQty);
              availableQty += Number(b.availableQty);
            }
          }
          return {
            category: t.category.name,
            materialType: t.name,
            typeCode: t.typeCode,
            variantCount: t.variants.length,
            availableQty,
            totalQty,
          };
        });
        break;
      }

      // 2. Variant-wise stock summary
      case "variant_summary": {
        const variants = await db.materialVariant.findMany({
          include: {
            materialType: { include: { category: true } },
            stockBalances: true,
          },
          orderBy: { materialCode: "asc" },
        });

        reportData = variants.map((v) => {
          let warehouseAvailable = 0;
          let onSiteQty = 0;
          let damagedQty = 0;
          let total = 0;

          for (const b of v.stockBalances) {
            total += Number(b.totalQty);
            if (b.locationType === "WAREHOUSE") {
              warehouseAvailable += Number(b.availableQty);
              damagedQty += Number(b.damagedQty);
            } else if (b.locationType === "CUSTOMER_SITE") {
              onSiteQty += Number(b.availableQty);
            }
          }

          return {
            id: v.id,
            materialCode: v.materialCode,
            name: v.name,
            size: v.size,
            category: v.materialType.category.name,
            type: v.materialType.name,
            uom: v.uom,
            rentalRate: Number(v.defaultRentalRate),
            warehouseAvailable,
            onSiteQty,
            damagedQty,
            totalStock: total,
            minimumStock: Number(v.minimumStock),
          };
        });
        break;
      }

      // 3. Warehouse-wise stock
      case "warehouse_stock": {
        reportData = await db.stockBalance.findMany({
          where: {
            locationType: "WAREHOUSE",
            ...(warehouseId ? { warehouseId } : {}),
          },
          include: {
            warehouse: true,
            materialVariant: { include: { materialType: true } },
          },
          orderBy: { warehouse: { warehouseCode: "asc" } },
        });
        break;
      }

      // 4. Customer-wise stock & 5. Site-wise stock
      case "customer_stock":
      case "site_stock": {
        reportData = await db.stockBalance.findMany({
          where: {
            locationType: "CUSTOMER_SITE",
            ...(siteId ? { siteId } : {}),
            ...(customerId ? { site: { customerId } } : {}),
          },
          include: {
            site: { include: { customer: true } },
            materialVariant: { include: { materialType: true } },
          },
          orderBy: { site: { siteName: "asc" } },
        });
        break;
      }

      // 6. Ownership-wise stock
      case "ownership_stock": {
        const balances = await db.stockBalance.findMany({
          include: {
            materialVariant: true,
            warehouse: true,
            site: { include: { customer: true } },
          },
        });
        reportData = balances;
        break;
      }

      // 7. Damaged material report
      case "damaged_report": {
        reportData = await db.stockBalance.findMany({
          where: {
            damagedQty: { gt: 0 },
          },
          include: {
            warehouse: true,
            materialVariant: { include: { materialType: true } },
          },
        });
        break;
      }

      // 8. Missing material report
      case "missing_report": {
        reportData = await db.stockBalance.findMany({
          where: {
            missingQty: { gt: 0 },
          },
          include: {
            warehouse: true,
            materialVariant: true,
          },
        });
        break;
      }

      // 9. In-transit report
      case "in_transit_report": {
        reportData = await db.stockBalance.findMany({
          where: {
            locationType: "IN_TRANSIT",
          },
          include: {
            materialVariant: true,
          },
        });
        break;
      }

      // 10. Low-stock report
      case "low_stock_report": {
        const variants = await db.materialVariant.findMany({
          where: {
            minimumStock: { gt: 0 },
            isActive: true,
          },
          include: {
            materialType: true,
            stockBalances: { where: { locationType: "WAREHOUSE" } },
          },
        });

        reportData = variants
          .map((v) => {
            const current = v.stockBalances.reduce((acc, b) => acc + Number(b.availableQty), 0);
            const min = Number(v.minimumStock);
            return {
              id: v.id,
              materialCode: v.materialCode,
              name: v.name,
              size: v.size,
              currentStock: current,
              minimumStock: min,
              shortfall: Math.max(0, min - current),
              isLow: current <= min,
            };
          })
          .filter((v) => v.isLow);
        break;
      }

      // 11. Stock movement history
      case "movement_history": {
        reportData = await db.inventoryMovement.findMany({
          include: {
            materialVariant: true,
            sourceWarehouse: true,
            destinationWarehouse: true,
            sourceSite: true,
            destinationSite: true,
            customer: true,
            responsibleUser: true,
          },
          orderBy: { movementDate: "desc" },
          take: 100,
        });
        break;
      }

      // 12. Material valuation report
      case "valuation_report": {
        const variants = await db.materialVariant.findMany({
          include: {
            materialType: { include: { category: true } },
            stockBalances: true,
          },
        });

        reportData = variants.map((v) => {
          const totalQty = v.stockBalances.reduce((acc, b) => acc + Number(b.totalQty), 0);
          const cost = v.purchaseCost ? Number(v.purchaseCost) : null;
          const repl = v.replacementValue ? Number(v.replacementValue) : null;

          return {
            materialCode: v.materialCode,
            name: v.name,
            size: v.size,
            category: v.materialType.category.name,
            totalQty,
            uom: v.uom,
            purchaseCost: cost,
            replacementValue: repl,
            totalPurchaseValuation: cost !== null ? totalQty * cost : null,
            totalReplacementValuation: repl !== null ? totalQty * repl : null,
            hasCostData: cost !== null && cost > 0,
          };
        });
        break;
      }

      default:
        reportData = [];
    }

    return NextResponse.json({
      success: true,
      data: { reportType, reportData },
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
