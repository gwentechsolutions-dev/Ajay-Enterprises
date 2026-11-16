import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    // Authorized if user can create or view material returns
    await requirePermission(session, "material_returns", "create");

    const searchParams = req.nextUrl.searchParams;
    const customerSiteId = searchParams.get("customerSiteId");
    const deliveryNoteId = searchParams.get("deliveryNoteId") || undefined;

    if (!customerSiteId) {
      return NextResponse.json(
        { success: false, error: { message: "customerSiteId is required" } },
        { status: 400 }
      );
    }

    // 1. Fetch site details
    const site = await db.customerSite.findUnique({
      where: { id: customerSiteId },
      include: {
        customer: {
          select: { id: true, name: true, customerCode: true },
        },
      },
    });

    if (!site) {
      return NextResponse.json(
        { success: false, error: { message: "Construction site not found" } },
        { status: 404 }
      );
    }

    // 2. Fetch active rental batches for this site with positive held quantity
    const activeBatches = await db.rentalBatch.findMany({
      where: {
        customerSiteId,
        currentHeldQty: { gt: 0 },
        status: "ACTIVE",
        ...(deliveryNoteId ? { deliveryNoteId } : {}),
      },
      include: {
        materialVariant: {
          select: {
            id: true,
            name: true,
            materialCode: true,
            uom: true,
            size: true,
          },
        },
        deliveryNote: {
          select: {
            id: true,
            dnNumber: true,
            deliveryDate: true,
          },
        },
      },
      orderBy: { deliveryDate: "asc" },
    });

    // 3. Fetch StockBalance for site
    const siteBalances = await db.stockBalance.findMany({
      where: {
        locationType: "CUSTOMER_SITE",
        siteId: customerSiteId,
        availableQty: { gt: 0 },
      },
      include: {
        materialVariant: {
          select: {
            id: true,
            name: true,
            materialCode: true,
            uom: true,
            size: true,
          },
        },
      },
    });

    // 4. Fetch dispatched delivery notes for this site (to populate reference dropdown)
    const siteDeliveryNotes = await db.deliveryNote.findMany({
      where: {
        customerSiteId,
        status: { in: ["DISPATCHED", "DELIVERED"] },
      },
      select: {
        id: true,
        dnNumber: true,
        deliveryDate: true,
        status: true,
        items: {
          select: {
            id: true,
            materialVariantId: true,
            quantity: true,
            materialVariant: {
              select: {
                id: true,
                name: true,
                materialCode: true,
                uom: true,
              },
            },
          },
        },
      },
      orderBy: { deliveryDate: "desc" },
    });

    // 5. Aggregate materials currently held at this site
    // Combine batches (which have daily rate and delivery note tracking) and balances
    const materialsMap = new Map<
      string,
      {
        materialVariantId: string;
        materialName: string;
        materialCode: string;
        size: string | null;
        uom: string;
        ownershipType: "OWNED" | "HIRED_IN";
        currentHeldQty: number;
        totalDeliveredQty: number;
        deliveryNotes: { id: string; dnNumber: string; deliveryDate: string }[];
      }
    >();

    // First populate from active rental batches
    for (const b of activeBatches) {
      const key = `${b.materialVariantId}_${b.ownershipType}`;
      const held = Number(b.currentHeldQty);
      const delivered = Number(b.deliveredQty);

      const existing = materialsMap.get(key);
      if (existing) {
        existing.currentHeldQty += held;
        existing.totalDeliveredQty += delivered;
        if (b.deliveryNote && !existing.deliveryNotes.some((dn) => dn.id === b.deliveryNote!.id)) {
          existing.deliveryNotes.push({
            id: b.deliveryNote.id,
            dnNumber: b.deliveryNote.dnNumber,
            deliveryDate: b.deliveryNote.deliveryDate.toISOString().split("T")[0],
          });
        }
      } else {
        materialsMap.set(key, {
          materialVariantId: b.materialVariantId,
          materialName: b.materialVariant.name,
          materialCode: b.materialVariant.materialCode,
          size: b.materialVariant.size || null,
          uom: b.materialVariant.uom,
          ownershipType: (b.ownershipType as "OWNED" | "HIRED_IN") || "OWNED",
          currentHeldQty: held,
          totalDeliveredQty: delivered,
          deliveryNotes: b.deliveryNote
            ? [
                {
                  id: b.deliveryNote.id,
                  dnNumber: b.deliveryNote.dnNumber,
                  deliveryDate: b.deliveryNote.deliveryDate.toISOString().split("T")[0],
                },
              ]
            : [],
        });
      }
    }

    // Complement with siteBalances if any variant in balance is not yet in batches
    for (const sb of siteBalances) {
      const key = `${sb.materialVariantId}_${sb.ownershipType}`;
      const avail = Number(sb.availableQty);
      if (!materialsMap.has(key) && avail > 0) {
        materialsMap.set(key, {
          materialVariantId: sb.materialVariantId,
          materialName: sb.materialVariant.name,
          materialCode: sb.materialVariant.materialCode,
          size: sb.materialVariant.size || null,
          uom: sb.materialVariant.uom,
          ownershipType: (sb.ownershipType as "OWNED" | "HIRED_IN") || "OWNED",
          currentHeldQty: avail,
          totalDeliveredQty: avail,
          deliveryNotes: [],
        });
      }
    }

    const materials = Array.from(materialsMap.values()).sort((a, b) =>
      a.materialName.localeCompare(b.materialName)
    );

    return NextResponse.json({
      success: true,
      data: {
        site: {
          id: site.id,
          siteName: site.siteName,
          siteCode: site.siteCode,
          customerId: site.customerId,
          customerName: site.customer.name,
        },
        materials,
        deliveryNotes: siteDeliveryNotes,
        totalMaterialsHeld: materials.length,
      },
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED")
      ? 401
      : error.message.startsWith("FORBIDDEN")
      ? 403
      : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
