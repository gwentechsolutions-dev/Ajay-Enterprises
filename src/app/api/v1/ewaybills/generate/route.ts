import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateEWayBillSchema } from "@/lib/schemas/ewaybill";
import { generateFYNWayBill } from "@/lib/integrations/fyn-ewaybill";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "delivery_notes", "create");

    const body = await req.json();
    const parsed = generateEWayBillSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    let documentNumber = "";
    let documentDate = new Date();
    let toGstin: string | undefined = undefined;
    let totalValue = 0;
    const items: Array<{
      materialName: string;
      hsnCode?: string;
      quantity: number;
      uom: string;
      taxableValue: number;
    }> = [];

    const company = await db.companyProfile.findFirst();
    const fromGstin = company?.gstin || "29AABCA1234F1Z5";

    if (input.documentType === "DELIVERY_NOTE") {
      const dn = await db.deliveryNote.findUnique({
        where: { id: input.documentId },
        include: {
          customer: true,
          items: { include: { materialVariant: true } },
        },
      });

      if (!dn) {
        return NextResponse.json({ success: false, error: { message: "Delivery Note not found" } }, { status: 404 });
      }

      documentNumber = dn.dnNumber;
      documentDate = dn.deliveryDate;
      toGstin = dn.customer.gstin || undefined;

      for (const it of dn.items) {
        const qty = Number(it.quantity);
        const rate = Number(it.materialVariant.purchaseCost || 100);
        const val = qty * rate;
        totalValue += val;
        items.push({
          materialName: it.materialVariant.name,
          hsnCode: "7308",
          quantity: qty,
          uom: it.materialVariant.uom,
          taxableValue: val,
        });
      }
    } else {
      const stn = await db.stockTransferNote.findUnique({
        where: { id: input.documentId },
        include: {
          sourceWarehouse: true,
          destinationWarehouse: true,
          items: { include: { materialVariant: true } },
        },
      });

      if (!stn) {
        return NextResponse.json({ success: false, error: { message: "Stock Transfer Note not found" } }, { status: 404 });
      }

      documentNumber = stn.stnNumber;
      documentDate = stn.transferDate;
      toGstin = fromGstin; // Inter-warehouse transfer under same company GSTIN

      for (const it of stn.items) {
        const qty = Number(it.dispatchedQty);
        const rate = Number(it.materialVariant.purchaseCost || 100);
        const val = qty * rate;
        totalValue += val;
        items.push({
          materialName: it.materialVariant.name,
          hsnCode: "7308",
          quantity: qty,
          uom: it.materialVariant.uom,
          taxableValue: val,
        });
      }
    }

    const ewbResult = await generateFYNWayBill(
      {
        documentType: input.documentType,
        documentId: input.documentId,
        documentNumber,
        documentDate,
        fromGstin,
        fromPincode: input.fromPincode,
        toGstin,
        toPincode: input.toPincode,
        vehicleNumber: input.vehicleNumber,
        distanceKm: input.distanceKm,
        totalValue: Math.max(1, totalValue),
        items,
      },
      actor
    );

    return NextResponse.json({ success: true, data: ewbResult }, { status: 201 });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

