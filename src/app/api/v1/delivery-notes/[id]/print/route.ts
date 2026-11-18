import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateDocumentHTML } from "@/lib/pdf/generator";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    await requirePermission(session, "delivery_notes", "view");
    const { id } = await params;

    const dn = await db.deliveryNote.findUnique({
      where: { id },
      include: {
        customer: true,
        customerSite: true,
        sourceWarehouse: true,
        items: {
          include: { materialVariant: true },
        },
      },
    });

    if (!dn) {
      return new Response("Delivery Note not found", { status: 404 });
    }

    const html = await generateDocumentHTML({
      title: "Material Delivery Note (DN)",
      documentNumber: dn.dnNumber,
      documentDate: dn.deliveryDate,
      documentType: "DN",
      partyTitle: "Customer / Billed To",
      partyName: dn.customer.name,
      partyAddress: dn.customer.billingAddress,
      partyGstin: dn.customer.gstin || undefined,
      partyMobile: dn.customer.primaryMobile,
      secondaryPartyTitle: "Delivery Construction Site",
      secondaryPartyName: dn.customerSite.siteName,
      secondaryPartyAddress: dn.customerSite.fullAddress,
      transportDetails: {
        vehicleNumber: dn.vehicleNumber || undefined,
        driverName: dn.driverName || undefined,
        driverPhone: dn.driverPhone || undefined,
        eWayBillNumber: dn.eWayBillNumber || undefined,
        transportCharges: dn.transportCharges ? Number(dn.transportCharges) : undefined,
      },
      items: dn.items.map((it, idx) => ({
        sn: idx + 1,
        code: it.materialVariant.materialCode,
        name: it.materialVariant.name,
        size: it.materialVariant.size,
        quantity: it.quantity.toNumber(),
        uom: it.materialVariant.uom,
        condition: it.condition,
        remarks: `Pool: ${it.ownershipType}${it.remarks ? ` | ${it.remarks}` : ""}`,
      })),
      receiverDetails: {
        name: dn.receiverName || undefined,
        phone: dn.receiverPhone || undefined,
        designation: dn.receiverDesignation || undefined,
        signatureUrl: dn.receiverSignatureUrl || undefined,
      },
      notes: dn.notes || "Materials delivered in good condition for site centering work.",
    });

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error: any) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

