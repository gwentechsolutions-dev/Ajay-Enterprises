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
      await requirePermission(session, "stock_transfers", "view");
    }

    const { id } = await params;
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "ajay-enterprises-gwen-tech.vercel.app";
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const origin = `${proto}://${host}`;

    const stn = await db.stockTransferNote.findFirst({
      where: {
        OR: [{ id }, { stnNumber: id }],
      },
      include: {
        sourceWarehouse: true,
        destinationWarehouse: true,
        items: {
          include: {
            materialVariant: true,
          },
        },
      },
    });

    if (!stn) {
      return new NextResponse("Stock Transfer Note not found", { status: 404 });
    }

    const html = await generateDocumentHTML({
      title: "STOCK TRANSFER NOTE (STN)",
      documentNumber: stn.stnNumber,
      documentDate: stn.transferDate,
      documentType: "STN",
      partyTitle: "SOURCE WAREHOUSE (DISPATCH)",
      partyName: stn.sourceWarehouse.name,
      partyAddress: `${stn.sourceWarehouse.addressLine1}, ${stn.sourceWarehouse.city}`,
      partyMobile: stn.sourceWarehouse.mobile || undefined,
      secondaryPartyTitle: "DESTINATION WAREHOUSE (RECEIVING)",
      secondaryPartyName: stn.destinationWarehouse.name,
      secondaryPartyAddress: `${stn.destinationWarehouse.addressLine1}, ${stn.destinationWarehouse.city}`,
      transportDetails: {
        vehicleNumber: stn.vehicleNumber || undefined,
        driverName: stn.driverName || undefined,
        driverPhone: stn.driverPhone || undefined,
      },
      items: stn.items.map((item, idx) => ({
        sn: idx + 1,
        code: item.materialVariant.materialCode,
        name: item.materialVariant.name,
        size: item.materialVariant.size || undefined,
        quantity: Number(item.dispatchedQty),
        uom: item.materialVariant.uom,
        condition: item.ownershipType,
        remarks: item.remarks || (stn.status === "RECEIVED" ? `Recv: ${item.receivedQty}, Dmg: ${item.damagedQty}, Short: ${item.shortageQty}` : undefined),
      })),
      notes: stn.notes || `Internal inter-yard transfer between ${stn.sourceWarehouse.name} and ${stn.destinationWarehouse.name}. Materials remain company property.`,
      origin,
      documentUrl: `${origin}/slips/stock-transfers/${stn.id}`,
    });

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Robots-Tag": "all, index, follow, max-image-preview:large",
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch (error: any) {
    return new NextResponse(`Error generating print view: ${error.message}`, { status: 500 });
  }
}

