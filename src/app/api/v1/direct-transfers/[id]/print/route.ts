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
      await requirePermission(session, "direct_transfers", "view");
    }

    const { id } = await params;
    const transfer = await db.directSiteTransferNote.findUnique({
      where: { id },
      include: {
        sourceCustomer: true,
        sourceCustomerSite: true,
        destinationCustomer: true,
        destinationCustomerSite: true,
        vehicle: true,
        driver: true,
        vehicleTrip: true,
        sourceMrn: true,
        destinationDn: true,
        godownMrn: true,
        items: {
          include: {
            materialVariant: true,
          },
        },
      },
    });

    if (!transfer) {
      return new NextResponse("Direct Site Transfer Note not found", { status: 404 });
    }

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "ajay-enterprises-gwen-tech.vercel.app";
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const origin = `${proto}://${host}`;

    const linkedDocSummary = [
      transfer.sourceMrn ? `Linked Source MRN: ${transfer.sourceMrn.mrnNumber}` : null,
      transfer.vehicleTrip ? `Linked Fleet Trip: ${transfer.vehicleTrip.tripNumber}` : null,
      transfer.destinationDn ? `Linked Destination DN: ${transfer.destinationDn.dnNumber}` : null,
      transfer.godownMrn ? `Linked Godown Return MRN: ${transfer.godownMrn.mrnNumber}` : null,
    ].filter(Boolean).join(" • ");

    const html = await generateDocumentHTML({
      title: "DIRECT SITE-TO-SITE TRANSFER NOTE (DSTN)",
      documentNumber: transfer.transferNumber,
      documentDate: transfer.transferDate,
      documentType: "DSTN",
      partyTitle: "SOURCE SITE (RELEASING CUSTODY)",
      partyName: `${transfer.sourceCustomer.name} (${transfer.sourceCustomer.customerCode})`,
      partyAddress: `${transfer.sourceCustomerSite.siteName}, ${transfer.sourceCustomerSite.fullAddress || "N/A"}`,
      partyGstin: transfer.sourceCustomer.gstin ? `GSTIN: ${transfer.sourceCustomer.gstin}` : `State: ${transfer.sourceCustomerSite.state || "Karnataka"} (${transfer.sourceCustomerSite.stateCode || "29"})`,
      partyMobile: transfer.sourceCustomerSite.siteInCharge ? `${transfer.sourceCustomerSite.siteInCharge} (${transfer.sourceCustomerSite.siteContactDetails || transfer.sourceCustomer.primaryMobile || "N/A"})` : transfer.sourceCustomer.primaryMobile || undefined,
      secondaryPartyTitle: "DESTINATION SITE (RECEIVING CUSTODY)",
      secondaryPartyName: `${transfer.destinationCustomer.name} (${transfer.destinationCustomer.customerCode})`,
      secondaryPartyAddress: `${transfer.destinationCustomerSite.siteName}, ${transfer.destinationCustomerSite.fullAddress || "N/A"}`,
      transportDetails: {
        vehicleNumber: transfer.vehicle?.vehicleNumber || undefined,
        driverName: transfer.driver?.name || undefined,
        driverPhone: transfer.driver?.mobileNumber || undefined,
        driverTripNumber: transfer.vehicleTrip?.tripNumber || undefined,
        transportCharges: transfer.transportCharges ? Number(transfer.transportCharges) : undefined,
      },
      customerHandoverDetails: {
        name: transfer.sourceRepName || transfer.sourceCustomerSite.siteInCharge || undefined,
        phone: transfer.sourceRepPhone || transfer.sourceCustomerSite.siteContactDetails || undefined,
        designation: transfer.sourceRepDesignation || "Site In-Charge",
        signatureUrl: transfer.sourceRepSignatureUrl || undefined,
        handoverAt: transfer.dispatchedAt || transfer.transferDate,
      },
      receiverDetails: {
        name: transfer.destRepName || transfer.destinationCustomerSite.siteInCharge || undefined,
        phone: transfer.destRepPhone || transfer.destinationCustomerSite.siteContactDetails || undefined,
        designation: transfer.destRepDesignation || "Site Engineer / Receiver",
        signatureUrl: transfer.destRepSignatureUrl || undefined,
        receivedAt: transfer.receivedAt || undefined,
        yardName: transfer.destinationCustomerSite.siteName,
      },
      items: transfer.items.map((item, idx) => {
        const qDispatched = Number(item.quantityDispatched);
        const qAccepted = item.quantityAccepted !== null && item.quantityAccepted !== undefined ? Number(item.quantityAccepted) : undefined;
        const qGodown = item.quantityGodownReturned ? Number(item.quantityGodownReturned) : 0;
        const qDamaged = item.quantityDamaged ? Number(item.quantityDamaged) : 0;
        const qMissing = item.quantityMissing ? Number(item.quantityMissing) : 0;

        let remarks = item.remarks || "";
        if (transfer.status === "COMPLETED" || transfer.status === "PARTIALLY_RECEIVED" || transfer.status === "GODOWN_RETURN_PENDING") {
          const parts = [];
          if (qAccepted !== undefined) parts.push(`Accepted: ${qAccepted}`);
          if (qGodown > 0) parts.push(`Godown Return: ${qGodown}`);
          if (qDamaged > 0) parts.push(`Damaged: ${qDamaged}`);
          if (qMissing > 0) parts.push(`Missing: ${qMissing}`);
          remarks = parts.join(", ") + ` ${item.materialVariant.uom}`;
        }

        return {
          sn: idx + 1,
          code: item.materialVariant.materialCode,
          name: item.materialVariant.name,
          size: item.materialVariant.size || "-",
          quantity: qDispatched,
          uom: item.materialVariant.uom,
          condition: item.ownershipType,
          rate: item.agreedDailyRate ? Number(item.agreedDailyRate) : undefined,
          remarks: remarks || undefined,
        };
      }),
      notes: `${linkedDocSummary ? linkedDocSummary + " • " : ""}${transfer.notes || `Official Direct Site-to-Site Custody Transfer Note under GST Rule 55 Delivery Challan standards. Material custody transferred directly from ${transfer.sourceCustomerSite.siteName} to ${transfer.destinationCustomerSite.siteName} without godown touchpoint. All equipment remains the exclusive property of AJAY ENTERPRISES.`}`,
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
