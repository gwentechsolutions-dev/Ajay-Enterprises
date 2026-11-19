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
        vehicleTrip: {
          include: {
            vehicle: true,
            driver: true,
          },
        },
        items: {
          include: {
            materialVariant: true,
          },
        },
        directTransfersAsSource: {
          include: {
            destinationCustomer: true,
            destinationCustomerSite: true,
          },
        },
      },
    });

    if (!mrn) {
      return new NextResponse("Material Return Note not found", { status: 404 });
    }

    const dstn = mrn.directTransfersAsSource?.[0];
    const isDirect = mrn.isDirectTransfer || Boolean(mrn.directSiteTransferId) || Boolean(dstn);

    const secondaryPartyTitle = isDirect
      ? "TRANSFER DESTINATION (DIRECT SITE DELIVERY)"
      : "RETURN SITE / RECEIVING YARD";

    const secondaryPartyName = isDirect && dstn
      ? `${mrn.customerSite.siteName} ➔ ${dstn.destinationCustomerSite.siteName} (${dstn.destinationCustomer.name})`
      : `${mrn.customerSite.siteName} ➔ ${mrn.receivingWarehouse.name}`;

    const secondaryPartyAddress = isDirect && dstn
      ? `Source: ${mrn.customerSite.fullAddress || "N/A"} | Destination: ${dstn.destinationCustomerSite.fullAddress || "N/A"}`
      : `Site: ${mrn.customerSite.fullAddress || "N/A"} | Yard: ${mrn.receivingWarehouse.addressLine1}, ${mrn.receivingWarehouse.city}`;

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
      secondaryPartyTitle,
      secondaryPartyName,
      secondaryPartyAddress,
      isDirectTransfer: isDirect,
      transportDetails: {
        vehicleNumber: mrn.vehicleTrip?.vehicle?.vehicleNumber || mrn.vehicleNumber || undefined,
        driverName: mrn.vehicleTrip?.driver?.name || mrn.driverName || undefined,
        driverPhone: mrn.vehicleTrip?.driver?.mobileNumber || mrn.driverPhone || undefined,
        driverTripNumber: mrn.vehicleTrip?.tripNumber || undefined,
      },
      receiverDetails: {
        name: mrn.receiverName || mrn.receivingWarehouse.contactPerson || undefined,
        phone: mrn.receiverPhone || mrn.receivingWarehouse.mobile || undefined,
        designation: mrn.receiverDesignation || "Yard In-Charge",
        signatureUrl: mrn.receiverSignatureUrl || undefined,
        receivedAt: mrn.receivedAt || mrn.returnDate,
        yardName: mrn.receivingWarehouse.name,
      },
      customerHandoverDetails: {
        name: mrn.customerRepresentativeName || mrn.customerSite.siteInCharge || undefined,
        phone: mrn.customerRepresentativePhone || mrn.customerSite.siteContactDetails || undefined,
        designation: mrn.customerRepresentativeDesignation || "Site Representative",
        signatureUrl: mrn.customerSignatureUrl || undefined,
        handoverAt: mrn.handoverAt || mrn.returnDate,
        customerAgreedDamage: mrn.customerAgreedDamage,
      },
      inspectionDetails: {
        status: (mrn.inspectionStatus as "PENDING" | "COMPLETED") || "COMPLETED",
        inspectorName: mrn.inspectorName || mrn.receiverName || undefined,
        inspectorDesignation: mrn.inspectorDesignation || mrn.receiverDesignation || "Quality Inspector",
        inspectedAt: mrn.inspectedAt || undefined,
        remarks: mrn.inspectionRemarks || undefined,
        customerAgreedDamage: mrn.customerAgreedDamage,
      },
      items: mrn.items.map((item, idx) => {
        const declared = Number(item.returnedQty);
        const accepted = Number(item.acceptedQty);
        const damaged = Number(item.damagedQty || 0);
        const missing = Number(item.missingQty || 0);
        const rejected = Number(item.rejectedQty || 0);
        const received =
          item.receivedQty !== null && item.receivedQty !== undefined
            ? Number(item.receivedQty)
            : accepted + damaged + rejected;

        return {
          sn: idx + 1,
          code: item.materialVariant.materialCode,
          name: item.materialVariant.name,
          size: item.materialVariant.size || undefined,
          quantity: accepted,
          declaredQty: declared,
          receivedQty: received,
          acceptedQty: accepted,
          damagedQty: damaged,
          missingQty: missing,
          rejectedQty: rejected,
          uom: item.materialVariant.uom,
          condition: item.condition,
          remarks: item.remarks || undefined,
          inspectionRemarks: item.inspectionRemarks || undefined,
        };
      }),
      notes:
        mrn.remarks ||
        (isDirect
          ? "Direct Site-to-Site Transfer source pickup document issued by AJAY ENTERPRISES under GST Rule 55 Delivery Challan standards. Material custody transferred directly to destination site without godown touchpoint."
          : `Physical return inspection conducted at ${mrn.receivingWarehouse.name}. Damaged and shortage items isolated in accordance with custody rules.`),
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

