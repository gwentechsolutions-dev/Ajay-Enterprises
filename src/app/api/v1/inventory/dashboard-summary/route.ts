import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export async function GET() {
  try {
    const session = await getSession();
    await requirePermission(session, "inventory", "view");

    // Aggregate all active stock balances
    const balances = await db.stockBalance.findMany({
      include: {
        materialVariant: {
          select: {
            purchaseCost: true,
            replacementValue: true,
            minimumStock: true,
            name: true,
            uom: true,
          },
        },
      },
    });

    let totalOwnedQty = new Prisma.Decimal(0);
    let totalHiredInQty = new Prisma.Decimal(0);
    let availableInWarehouseQty = new Prisma.Decimal(0);
    let withCustomersQty = new Prisma.Decimal(0);
    let inTransitQty = new Prisma.Decimal(0);
    let damagedQty = new Prisma.Decimal(0);
    let missingQty = new Prisma.Decimal(0);
    let maintenanceQty = new Prisma.Decimal(0);

    let totalPurchaseValuation = new Prisma.Decimal(0);
    let totalReplacementValuation = new Prisma.Decimal(0);
    let itemsWithMissingValuation = 0;

    for (const b of balances) {
      const tot = b.totalQty;
      if (b.ownershipType === "OWNED") {
        totalOwnedQty = totalOwnedQty.plus(tot);
      } else {
        totalHiredInQty = totalHiredInQty.plus(tot);
      }

      if (b.locationType === "WAREHOUSE") {
        availableInWarehouseQty = availableInWarehouseQty.plus(b.availableQty);
        damagedQty = damagedQty.plus(b.damagedQty);
        maintenanceQty = maintenanceQty.plus(b.maintenanceQty);
        missingQty = missingQty.plus(b.missingQty);
      } else if (b.locationType === "CUSTOMER_SITE") {
        withCustomersQty = withCustomersQty.plus(b.availableQty);
      } else if (b.locationType === "IN_TRANSIT") {
        inTransitQty = inTransitQty.plus(tot);
      }

      // Valuations (Prompt 9: Do not calculate financial valuations using zero or missing values as if valid costs)
      const cost = b.materialVariant.purchaseCost;
      const repl = b.materialVariant.replacementValue;

      if (cost && cost.gt(0)) {
        totalPurchaseValuation = totalPurchaseValuation.plus(tot.mul(cost));
      } else {
        itemsWithMissingValuation++;
      }

      if (repl && repl.gt(0)) {
        totalReplacementValuation = totalReplacementValuation.plus(tot.mul(repl));
      }
    }

    // Counts for overview
    const totalVariantsCount = await db.materialVariant.count({ where: { isActive: true } });
    const totalCustomersCount = await db.customer.count({ where: { isActive: true } });
    const activeSitesCount = await db.customerSite.count({ where: { status: "ACTIVE" } });
    const totalWarehousesCount = await db.warehouse.count({ where: { isActive: true } });

    return NextResponse.json({
      success: true,
      data: {
        totalOwnedQty: totalOwnedQty.toNumber(),
        totalHiredInQty: totalHiredInQty.toNumber(),
        availableInWarehouseQty: availableInWarehouseQty.toNumber(),
        withCustomersQty: withCustomersQty.toNumber(),
        inTransitQty: inTransitQty.toNumber(),
        damagedQty: damagedQty.toNumber(),
        missingQty: missingQty.toNumber(),
        maintenanceQty: maintenanceQty.toNumber(),
        totalPurchaseValuation: totalPurchaseValuation.toNumber(),
        totalReplacementValuation: totalReplacementValuation.toNumber(),
        itemsWithMissingValuation,
        totalVariantsCount,
        totalCustomersCount,
        activeSitesCount,
        totalWarehousesCount,
      },
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

