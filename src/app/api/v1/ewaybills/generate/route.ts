import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateEWayBillSchema } from "@/lib/schemas/ewaybill";
import { ewayBillService } from "@/lib/ewaybill/service";
import { calculateGst } from "@/lib/accounting/gst-engine";
import { GenerateEwbRequest, EwbItemInput } from "@/lib/ewaybill/types";
import { getSystemEwbConfig } from "@/lib/ewaybill/config";

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

    const company = await db.companyProfile.findFirst();
    const ewbConfig = getSystemEwbConfig();
    const isSandbox = ewbConfig.whitebooks.environment === "SANDBOX";

    // In sandbox, use test GSTIN if company GSTIN is not sandbox-whitelisted
    const defaultConsignorGstin = isSandbox
      ? ewbConfig.whitebooks.gstin || "33AAGCB1286Q003"
      : company?.gstin || "33AAGCB1286Q003";

    let requestPayload: GenerateEwbRequest;

    if (input.documentType === "DELIVERY_NOTE") {
      const dn = await db.deliveryNote.findUnique({
        where: { id: input.documentId },
        include: {
          customer: true,
          customerSite: true,
          sourceWarehouse: true,
          items: { include: { materialVariant: true } },
        },
      });

      if (!dn) {
        return NextResponse.json({ success: false, error: { message: "Delivery Note not found" } }, { status: 404 });
      }

      if (dn.items.length === 0) {
        return NextResponse.json(
          { success: false, error: { message: "Delivery Note contains no material line items." } },
          { status: 422 }
        );
      }

      const fromStateCode = parseInt(company?.gstStateCode || "33", 10) || 33;
      const toStateCode = parseInt(dn.customerSite?.stateCode || company?.gstStateCode || "33", 10) || 33;
      const supplierStateStr = String(fromStateCode).padStart(2, "0");
      const placeOfSupplyStr = String(toStateCode).padStart(2, "0");

      let totalTaxableValue = 0;
      let totalCgst = 0;
      let totalSgst = 0;
      let totalIgst = 0;

      const items: EwbItemInput[] = [];

      for (const it of dn.items) {
        const qty = Number(it.quantity);
        // Statutory movement valuation: Replacement value or purchase cost, or contract day-rate baseline
        const unitValuation = Number(it.materialVariant.replacementValue || it.materialVariant.purchaseCost || 100);
        const lineTaxable = Number((qty * unitValuation).toFixed(2));

        // Use INVENTRA GST engine for accurate tax breakdown
        const gstResult = calculateGst({
          taxableValue: lineTaxable,
          gstRatePercent: 18,
          supplierStateCode: supplierStateStr,
          placeOfSupply: placeOfSupplyStr,
        });

        totalTaxableValue += lineTaxable;
        totalCgst += Number(gstResult.cgstAmount);
        totalSgst += Number(gstResult.sgstAmount);
        totalIgst += Number(gstResult.igstAmount);

        items.push({
          materialName: it.materialVariant.name,
          description: `${it.materialVariant.name} (${it.materialVariant.size})`,
          hsnCode: "7308", // Centering and scaffolding equipment
          quantity: qty,
          uom: it.materialVariant.uom || "Nos.",
          taxableValue: lineTaxable,
          cgstRate: Number(gstResult.cgstRatePercent),
          sgstRate: Number(gstResult.sgstRatePercent),
          igstRate: Number(gstResult.igstRatePercent),
          cessRate: 0,
        });
      }

      const totalInvoiceValue = Number((totalTaxableValue + totalCgst + totalSgst + totalIgst).toFixed(2));

      requestPayload = {
        documentType: "DELIVERY_NOTE",
        documentId: dn.id,
        documentNumber: dn.dnNumber,
        documentDate: dn.deliveryDate,
        fromGstin: defaultConsignorGstin,
        fromTradeName: "AJAY ENTERPRISES",
        fromAddress1: dn.sourceWarehouse.addressLine1 || "Peenya Industrial Area",
        fromAddress2: dn.sourceWarehouse.addressLine2 || "",
        fromPlace: dn.sourceWarehouse.city || "Bengaluru",
        fromPincode: input.fromPincode || dn.sourceWarehouse.pinCode || "560058",
        fromStateCode,
        toGstin: dn.customer.gstin || "URP",
        toTradeName: dn.customer.name || "Site Receiver",
        toAddress1: dn.customerSite.fullAddress || "Customer Construction Site",
        toAddress2: "",
        toPlace: dn.customerSite.city || "Bengaluru",
        toPincode: input.toPincode || dn.customerSite.pinCode || "560068",
        toStateCode,
        vehicleNumber: input.vehicleNumber,
        distanceKm: input.distanceKm,
        transMode: "1",
        docType: "CHL",
        subSupplyType: "8", // Others
        subSupplyDesc: "Centering Rental",
        totalTaxableValue,
        cgstValue: totalCgst,
        sgstValue: totalSgst,
        igstValue: totalIgst,
        cessValue: 0,
        totalInvoiceValue,
        items,
      };
    } else {
      // Stock Transfer Note
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

      if (stn.items.length === 0) {
        return NextResponse.json(
          { success: false, error: { message: "Stock Transfer Note contains no items." } },
          { status: 422 }
        );
      }

      const fromStateCode = parseInt(company?.gstStateCode || "33", 10) || 33;
      const toStateCode = parseInt(company?.gstStateCode || "33", 10) || 33;
      const supplierStateStr = String(fromStateCode).padStart(2, "0");
      const placeOfSupplyStr = String(toStateCode).padStart(2, "0");

      let totalTaxableValue = 0;
      let totalCgst = 0;
      let totalSgst = 0;
      let totalIgst = 0;

      const items: EwbItemInput[] = [];

      for (const it of stn.items) {
        const qty = Number(it.dispatchedQty);
        const unitValuation = Number(it.materialVariant.replacementValue || it.materialVariant.purchaseCost || 100);
        const lineTaxable = Number((qty * unitValuation).toFixed(2));

        const gstResult = calculateGst({
          taxableValue: lineTaxable,
          gstRatePercent: 18,
          supplierStateCode: supplierStateStr,
          placeOfSupply: placeOfSupplyStr,
        });

        totalTaxableValue += lineTaxable;
        totalCgst += Number(gstResult.cgstAmount);
        totalSgst += Number(gstResult.sgstAmount);
        totalIgst += Number(gstResult.igstAmount);

        items.push({
          materialName: it.materialVariant.name,
          description: `${it.materialVariant.name} (${it.materialVariant.size})`,
          hsnCode: "7308",
          quantity: qty,
          uom: it.materialVariant.uom || "Nos.",
          taxableValue: lineTaxable,
          cgstRate: Number(gstResult.cgstRatePercent),
          sgstRate: Number(gstResult.sgstRatePercent),
          igstRate: Number(gstResult.igstRatePercent),
          cessRate: 0,
        });
      }

      const totalInvoiceValue = Number((totalTaxableValue + totalCgst + totalSgst + totalIgst).toFixed(2));

      requestPayload = {
        documentType: "TRANSFER_NOTE",
        documentId: stn.id,
        documentNumber: stn.stnNumber,
        documentDate: stn.transferDate,
        fromGstin: defaultConsignorGstin,
        fromTradeName: "AJAY ENTERPRISES",
        fromAddress1: stn.sourceWarehouse.addressLine1 || "Primary Yard",
        fromAddress2: stn.sourceWarehouse.addressLine2 || "",
        fromPlace: stn.sourceWarehouse.city || "Bengaluru",
        fromPincode: input.fromPincode || stn.sourceWarehouse.pinCode || "560058",
        fromStateCode,
        toGstin: defaultConsignorGstin, // Inter-warehouse transfer under same company GSTIN
        toTradeName: "AJAY ENTERPRISES",
        toAddress1: stn.destinationWarehouse.addressLine1 || "Secondary Yard",
        toAddress2: stn.destinationWarehouse.addressLine2 || "",
        toPlace: stn.destinationWarehouse.city || "Bengaluru",
        toPincode: input.toPincode || stn.destinationWarehouse.pinCode || "560068",
        toStateCode,
        vehicleNumber: input.vehicleNumber,
        distanceKm: input.distanceKm,
        transMode: "1",
        docType: "CHL",
        subSupplyType: "5", // For own use
        totalTaxableValue,
        cgstValue: totalCgst,
        sgstValue: totalSgst,
        igstValue: totalIgst,
        cessValue: 0,
        totalInvoiceValue,
        items,
      };
    }

    // Execute statutory generation via EWayBillService
    const result = await ewayBillService.generateEWayBill(
      requestPayload,
      actor,
      input.provider
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: result.message,
            requiresReconciliation: result.requiresReconciliation,
          },
          data: result,
        },
        { status: result.requiresReconciliation ? 202 : 400 }
      );
    }

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
