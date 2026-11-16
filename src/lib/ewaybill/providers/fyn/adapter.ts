/**
 * FYN Gateway Backup Provider Adapter
 * Wraps existing src/lib/integrations/fyn-ewaybill.ts without modifying or breaking it.
 */

import {
  EWayBillProvider,
  EwbProviderName,
  ConnectionTestResult,
  GenerateEwbRequest,
  GenerateEwbResponse,
  EwbDetailsResponse,
  UpdateVehicleRequest,
  UpdateVehicleResponse,
  CancelEwbRequest,
  CancelEwbResponse,
  AuditActor,
} from "../../types";
import {
  generateFYNWayBill,
  cancelFYNWayBill,
  FYNEWayBillRequest,
} from "@/lib/integrations/fyn-ewaybill";
import { getFynConfig } from "../../config";
import { db } from "@/lib/db";

export class FynProviderAdapter implements EWayBillProvider {
  readonly name: EwbProviderName = "FYN";

  async testConnection(): Promise<ConnectionTestResult> {
    const config = getFynConfig();
    const startTime = Date.now();

    if (config.isSandbox) {
      return {
        success: true,
        provider: "FYN",
        environment: "SANDBOX",
        latencyMs: Date.now() - startTime,
        message: "FYN Gateway Sandbox connection verified (Simulation active).",
      };
    }

    try {
      const res = await fetch(`${config.baseUrl}/health`, {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "X-Client-Id": config.clientId,
        },
      });
      const latencyMs = Date.now() - startTime;
      return {
        success: res.ok,
        provider: "FYN",
        environment: "PRODUCTION",
        latencyMs,
        message: res.ok ? `FYN Gateway connected in ${latencyMs}ms.` : `FYN Gateway responded with HTTP ${res.status}`,
      };
    } catch (err: any) {
      return {
        success: false,
        provider: "FYN",
        environment: "PRODUCTION",
        latencyMs: Date.now() - startTime,
        message: `FYN Gateway connection failed: ${err.message}`,
      };
    }
  }

  async generateEWayBill(req: GenerateEwbRequest, actor: AuditActor): Promise<GenerateEwbResponse> {
    // Map to FYNEWayBillRequest format expected by fyn-ewaybill.ts
    const fynReq: FYNEWayBillRequest = {
      documentType: req.documentType,
      documentId: req.documentId,
      documentNumber: req.documentNumber,
      documentDate: req.documentDate,
      fromGstin: req.fromGstin,
      fromPincode: req.fromPincode,
      toGstin: req.toGstin,
      toPincode: req.toPincode,
      vehicleNumber: req.vehicleNumber,
      distanceKm: req.distanceKm,
      totalValue: req.totalInvoiceValue,
      items: req.items.map((it) => ({
        materialName: it.materialName,
        hsnCode: it.hsnCode,
        quantity: it.quantity,
        uom: it.uom,
        taxableValue: it.taxableValue,
      })),
    };

    const res = await generateFYNWayBill(fynReq, actor);

    return {
      success: res.success,
      ewbNumber: res.ewbNumber,
      validUntil: res.validUntil,
      status: res.status === "ACTIVE" ? "ACTIVE" : "ERROR",
      provider: "FYN",
      environment: getFynConfig().isSandbox ? "SANDBOX" : "PRODUCTION",
      referenceId: res.fynReferenceId,
      message: res.message,
      rawResponse: res.rawResponse,
    };
  }

  async getEWayBillDetails(ewbNumber: string): Promise<EwbDetailsResponse> {
    const record = await db.eWayBill.findUnique({
      where: { ewbNumber },
    });

    if (!record) {
      return {
        success: false,
        ewbNumber,
        status: "ERROR",
        message: `E-Way Bill '${ewbNumber}' not found in database.`,
      };
    }

    return {
      success: true,
      ewbNumber,
      status: record.status as any,
      validUntil: record.validUntil || undefined,
      vehicleNumber: record.vehicleNumber || undefined,
      totalValue: record.distanceKm ? Number(record.distanceKm) : undefined,
      rawResponse: record.responsePayload,
    };
  }

  async updateVehicle(req: UpdateVehicleRequest, actor: AuditActor): Promise<UpdateVehicleResponse> {
    // Update local database record for FYN
    const existing = await db.eWayBill.findUnique({
      where: { ewbNumber: req.ewbNumber },
    });

    if (!existing) {
      throw new Error(`E-Way Bill '${req.ewbNumber}' not found.`);
    }

    const updated = await db.eWayBill.update({
      where: { id: existing.id },
      data: {
        vehicleNumber: req.newVehicleNumber,
      },
    });

    return {
      success: true,
      ewbNumber: req.ewbNumber,
      vehicleNumber: req.newVehicleNumber,
      updatedDate: new Date(),
      message: `Vehicle updated to ${req.newVehicleNumber} (FYN Provider).`,
    };
  }

  async cancelEWayBill(req: CancelEwbRequest, actor: AuditActor): Promise<CancelEwbResponse> {
    const reasonText = `Code ${req.cancelReasonCode}: ${req.cancelRemarks}`;
    const res = await cancelFYNWayBill(req.ewbNumber, reasonText, actor);

    return {
      success: res.success,
      ewbNumber: req.ewbNumber,
      cancelledAt: new Date(),
      message: res.message,
    };
  }
}
