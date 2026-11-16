/**
 * Master Statutory E-Way Bill Orchestrator Service
 * Operating Business: AJAY ENTERPRISES
 */

import { db } from "@/lib/db";
import {
  GenerateEwbRequest,
  GenerateEwbResponse,
  UpdateVehicleRequest,
  UpdateVehicleResponse,
  CancelEwbRequest,
  CancelEwbResponse,
  EwbDetailsResponse,
  AuditActor,
  EwbProviderName,
} from "./types";
import { getProvider, getProviderForEwbNumber } from "./factory";
import {
  acquireGenerationLock,
  releaseGenerationLock,
  findActiveEwbForDocument,
  generateIdempotencyKey,
  recordOperationStart,
  recordOperationFinish,
} from "./idempotency";
import { logEwbAuditEvent } from "./audit";
import { ewbLogger, sanitizePayload } from "./logger";

export class EWayBillService {
  /**
   * Generates a statutory E-Way Bill with idempotency and duplicate protection
   */
  async generateEWayBill(
    req: GenerateEwbRequest,
    actor: AuditActor,
    overrideProvider?: EwbProviderName
  ): Promise<GenerateEwbResponse> {
    const { documentType, documentId, documentNumber } = req;

    // 1. Concurrency Mutex Lock
    const lockAcquired = acquireGenerationLock(documentId);
    if (!lockAcquired) {
      throw new Error(
        `Another E-Way Bill generation operation is currently in progress for document '${documentNumber}'. Please wait.`
      );
    }

    try {
      // 2. Check for existing active E-Way Bill (Statutory Duplicate Guard)
      const existingActiveEwb = await findActiveEwbForDocument(documentType, documentId);
      if (existingActiveEwb) {
        throw new Error(
          `Document '${documentNumber}' already has an active E-Way Bill (${existingActiveEwb.ewbNumber}). Duplicate generation is blocked by statutory rules.`
        );
      }

      // 3. Resolve Provider
      const provider = getProvider(overrideProvider);
      const idempotencyKey = req.idempotencyKey || generateIdempotencyKey(documentType, documentId, "GENERATE");

      ewbLogger.info(`Starting E-Way Bill generation for ${documentType} ${documentNumber} via ${provider.name}`, {
        idempotencyKey,
        provider: provider.name,
      });

      // 4. Record Operation Start
      const opId = await recordOperationStart({
        documentType,
        documentId,
        provider: provider.name,
        environment: "SANDBOX",
        operationType: "GENERATE",
        idempotencyKey,
        requestPayload: req,
        actor,
      });

      // 5. Execute Provider API Call
      const result = await provider.generateEWayBill(req, actor);

      // 6. Handle Uncertain / Timeout Outcome
      if (result.status === "UNKNOWN" || result.requiresReconciliation) {
        await recordOperationFinish({
          operationId: opId,
          status: "UNKNOWN",
          errorMessage: result.message,
          responsePayload: result.rawResponse,
        });

        await logEwbAuditEvent({
          actor,
          action: "CREATE",
          entityId: documentId,
          operationType: "GENERATE",
          provider: provider.name,
          notes: `E-Way Bill generation for ${documentNumber} resulted in uncertain status. Reconciliation required.`,
        });

        return result;
      }

      // 7. Handle Provider Rejection
      if (!result.success || !result.ewbNumber) {
        await recordOperationFinish({
          operationId: opId,
          status: "FAILED",
          errorMessage: result.message,
          responsePayload: result.rawResponse,
        });

        return result;
      }

      // 8. Persist Statutory Record in Database
      const ewbRecord = await db.eWayBill.create({
        data: {
          ewbNumber: result.ewbNumber,
          documentType: req.documentType,
          documentId: req.documentId,
          deliveryNoteId: req.documentType === "DELIVERY_NOTE" ? req.documentId : null,
          transferNoteId: req.documentType === "TRANSFER_NOTE" ? req.documentId : null,
          validUntil: result.validUntil,
          vehicleNumber: req.vehicleNumber,
          fromPincode: req.fromPincode,
          toPincode: req.toPincode,
          distanceKm: req.distanceKm,
          status: "ACTIVE",
          provider: provider.name,
          environment: result.environment,
          providerReferenceId: result.referenceId,
          // Maintain FYN backward compatibility
          fynReferenceId: provider.name === "FYN" ? result.referenceId : null,
          requestPayload: sanitizePayload(req) as any,
          responsePayload: sanitizePayload(result.rawResponse) as any,
        },
      });

      // 9. Update Underlying Movement Document
      if (req.documentType === "DELIVERY_NOTE") {
        await db.deliveryNote.update({
          where: { id: req.documentId },
          data: { eWayBillNumber: result.ewbNumber },
        });
      } else if (req.documentType === "TRANSFER_NOTE") {
        await db.stockTransferNote.update({
          where: { id: req.documentId },
          data: { eWayBillNumber: result.ewbNumber },
        });
      }

      // 10. Complete Operation History & Audit Log
      await recordOperationFinish({
        operationId: opId,
        status: "SUCCESS",
        responsePayload: result.rawResponse,
        eWayBillId: ewbRecord.id,
      });

      await logEwbAuditEvent({
        actor,
        action: "CREATE",
        entityId: ewbRecord.id,
        operationType: "GENERATE",
        provider: provider.name,
        ewbNumber: result.ewbNumber,
        notes: `Generated E-Way Bill ${result.ewbNumber} for ${documentType} (${documentNumber}) via ${provider.name} (${result.environment})`,
        afterState: {
          ewbNumber: result.ewbNumber,
          status: "ACTIVE",
          validUntil: result.validUntil,
          vehicleNumber: req.vehicleNumber,
        },
      });

      return result;
    } finally {
      releaseGenerationLock(documentId);
    }
  }

  /**
   * Updates Part-B vehicle details on an existing E-Way Bill
   */
  async updateVehicle(req: UpdateVehicleRequest, actor: AuditActor): Promise<UpdateVehicleResponse> {
    const existing = await db.eWayBill.findUnique({
      where: { ewbNumber: req.ewbNumber },
    });

    if (!existing) {
      throw new Error(`E-Way Bill '${req.ewbNumber}' not found in database.`);
    }

    if (existing.status !== "ACTIVE") {
      throw new Error(`Cannot update vehicle: E-Way Bill '${req.ewbNumber}' is ${existing.status}.`);
    }

    // Always use the original provider associated with this E-Way Bill
    const provider = await getProviderForEwbNumber(req.ewbNumber);

    ewbLogger.info(`Updating vehicle for EWB ${req.ewbNumber} via ${provider.name}`);
    const result = await provider.updateVehicle(req, actor);

    // Update database record
    await db.eWayBill.update({
      where: { id: existing.id },
      data: {
        vehicleNumber: result.vehicleNumber,
        partBUpdatedDate: result.updatedDate,
        partBReason: req.reasonDescription,
        ...(result.validUntil ? { validUntil: result.validUntil } : {}),
      },
    });

    // Audit Event
    await logEwbAuditEvent({
      actor,
      action: "UPDATE",
      entityId: existing.id,
      operationType: "UPDATE_VEHICLE",
      provider: provider.name,
      ewbNumber: req.ewbNumber,
      beforeState: { vehicleNumber: existing.vehicleNumber },
      afterState: { vehicleNumber: result.vehicleNumber, partBUpdatedDate: result.updatedDate },
      notes: `Updated Part-B vehicle to ${result.vehicleNumber} on EWB ${req.ewbNumber} via ${provider.name}. Reason: ${req.reasonDescription}`,
    });

    return result;
  }

  /**
   * Cancels an active E-Way Bill
   */
  async cancelEWayBill(req: CancelEwbRequest, actor: AuditActor): Promise<CancelEwbResponse> {
    const existing = await db.eWayBill.findUnique({
      where: { ewbNumber: req.ewbNumber },
    });

    if (!existing) {
      throw new Error(`E-Way Bill '${req.ewbNumber}' not found in database.`);
    }

    if (existing.status === "CANCELLED") {
      throw new Error(`E-Way Bill '${req.ewbNumber}' is already cancelled.`);
    }

    // Always use the provider originally associated with this record
    const provider = await getProviderForEwbNumber(req.ewbNumber);

    ewbLogger.info(`Cancelling EWB ${req.ewbNumber} via ${provider.name}`);
    const result = await provider.cancelEWayBill(req, actor);

    const cancelReasonText = `[Reason Code ${req.cancelReasonCode}] ${req.cancelRemarks}`;

    // Update database record
    await db.eWayBill.update({
      where: { id: existing.id },
      data: {
        status: "CANCELLED",
        cancelReason: cancelReasonText,
        cancelledAt: result.cancelledAt,
      },
    });

    // Update Delivery Note / STN if linked
    if (existing.deliveryNoteId) {
      await db.deliveryNote.update({
        where: { id: existing.deliveryNoteId },
        data: { eWayBillNumber: null },
      });
    } else if (existing.transferNoteId) {
      await db.stockTransferNote.update({
        where: { id: existing.transferNoteId },
        data: { eWayBillNumber: null },
      });
    }

    // Audit Event
    await logEwbAuditEvent({
      actor,
      action: "CANCEL",
      entityId: existing.id,
      operationType: "CANCEL",
      provider: provider.name,
      ewbNumber: req.ewbNumber,
      beforeState: { status: "ACTIVE" },
      afterState: { status: "CANCELLED", cancelReason: cancelReasonText },
      notes: `Cancelled E-Way Bill ${req.ewbNumber} via ${provider.name}. Reason: ${cancelReasonText}`,
    });

    return result;
  }

  /**
   * Retrieves E-Way Bill details
   */
  async getEWayBillDetails(ewbNumber: string): Promise<EwbDetailsResponse> {
    const provider = await getProviderForEwbNumber(ewbNumber);
    return provider.getEWayBillDetails(ewbNumber);
  }
}

export const ewayBillService = new EWayBillService();
