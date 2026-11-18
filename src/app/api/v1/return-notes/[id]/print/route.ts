import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateDocumentHTML } from "@/lib/pdf/generator";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (session) {
      await requirePermission(session, "material_returns", "view");
    }

    const { id } = await params;
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "ajay-enterprises-gwen-tech.vercel.app";
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const origin = `${proto}://${host}`;
    const mrn = await db.materialReturnNote.findUnique({
      where: { id },
      include: {
        customer: true,
        customerSite: true,
        receivingWarehouse: true,
        items: {
          include: {
            materialVariant: true,
          },
        },
      },
    });

    if (!mrn) {
      return new NextResponse("Material Return Note not found", { status: 404 });
    }

    const html = await generateDocumentHTML({
      title: "MATERIAL RETURN NOTE (MRN)",
      documentNumber: mrn.mrnNumber,
      documentDate: mrn.returnDate,
      documentType: "MRN",
      partyTitle: "RETURNED BY (CUSTOMER)",
      partyName: mrn.customer.name,
      partyAddress: mrn.customer.billingAddress || undefined,
      partyGstin: mrn.customer.gstin || undefined,
      partyMobile: mrn.customer.primaryMobile || undefined,
      secondaryPartyTitle: "RETURN SITE / RECEIVING YARD",
      secondaryPartyName: `${mrn.customerSite.siteName} ➔ ${mrn.receivingWarehouse.name}`,
      secondaryPartyAddress: `Site: ${mrn.customerSite.fullAddress || "N/A"} | Yard: ${mrn.receivingWarehouse.addressLine1}, ${mrn.receivingWarehouse.city}`,
      transportDetails: {
        vehicleNumber: mrn.vehicleNumber || undefined,
        driverName: mrn.driverName || undefined,
        driverPhone: mrn.driverPhone || undefined,
      },
      receiverDetails: {
        name: mrn.receiverName || undefined,
        phone: mrn.receiverPhone || undefined,
        signatureUrl: mrn.receiverSignatureUrl || undefined,
      },
      items: mrn.items.map((item, idx) => ({
        sn: idx + 1,
        code: item.materialVariant.materialCode,
        name: item.materialVariant.name,
        size: item.materialVariant.size || undefined,
        quantity: Number(item.acceptedQty),
        uom: item.materialVariant.uom,
        condition: item.condition,
        remarks: item.remarks || (Number(item.damagedQty) > 0 ? `Damaged: ${item.damagedQty}, Missing: ${item.missingQty}` : undefined),
      })),
      notes: mrn.remarks || `Physical return inspection completed at ${mrn.receivingWarehouse.name}. Damaged/missing items isolated and registered for assessment.`,
      origin,
    });

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error: any) {
    return new NextResponse(`Error generating print view: ${error.message}`, { status: 500 });
  }
}

