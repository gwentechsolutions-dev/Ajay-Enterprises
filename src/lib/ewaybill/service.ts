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
import { getSystemEwbConfig } from "./config";
import {
  acquireDatabaseGenerationLock,
  releaseGenerationLock,
  generateIdempotencyKey,
  recordOperationFinish,
} from "./idempotency";
import { logEwbAuditEvent } from "./audit";
import { ewbLogger, sanitizePayload } from "./logger";

export class EWayBillService {
  /**
   * Generates a statutory E-Way Bill with database-backed idempotency and duplicate protection
   */
  async generateEWayBill(
    req: GenerateEwbRequest,
    actor: AuditActor,
    overrideProvider?: EwbProviderName
  ): Promise<GenerateEwbResponse> {
    const { documentType, documentId, documentNumber } = req;
    const provider = getProvider(overrideProvider);
    const systemConfig = getSystemEwbConfig();
    const envUpper = systemConfig.whitebooks.environment;
    const idempotencyKey = req.idempotencyKey || generateIdempotencyKey(documentType, documentId, "GENERATE");

    // 1. Acquire Database-Backed Concurrency Lock (coordinates across all Vercel serverless instances)
    const lockResult = await acquireDatabaseGenerationLock({
      documentType,
      documentId,
      documentNumber,
      provider: provider.name,
      environment: envUpper,
      idempotencyKey,
      requestPayload: req,
      actor,
    });

    if (!lockResult.acquired) {
      // Safe reuse if already active (prevents duplicate statutory submission)
      if (lockResult.reason === "ALREADY_ACTIVE" && lockResult.existingEwb) {
        const ewb = lockResult.existingEwb;
        return {
          success: true,
          ewbNumber: ewb.ewbNumber,
          status: "ACTIVE",
          validUntil: ewb.validUntil || undefined,
          ewbDate: ewb.createdAt,
          environment: ewb.environment as any,
          provider: ewb.provider as any,
          referenceId: ewb.providerReferenceId || ewb.fynReferenceId || undefined,
          message: lockResult.message || `Active E-Way Bill ${ewb.ewbNumber} already exists for ${documentNumber}. Safely reusing record.`,
          rawResponse: ewb.responsePayload,
        };
      }

      // Blocked due to IN_PROGRESS or RECONCILIATION_REQUIRED
      throw new Error(lockResult.message || `Cannot generate E-Way Bill for ${documentNumber}.`);
    }

    const opId = lockResult.operationId;

    ewbLogger.info(`Starting E-Way Bill generation for ${documentType} ${documentNumber} via ${provider.name}`, {
      idempotencyKey,
      provider: provider.name,
      operationId: opId,
    });

    try {
      // 2. Execute Provider API Call
      let result: GenerateEwbResponse;
      try {
        result = await provider.generateEWayBill(req, actor);
      } catch (callErr: any) {
        // Categorize timeout / ambiguous response
        const isTimeout =
          callErr.name === "AbortError" ||
          callErr.message?.toLowerCase().includes("timeout") ||
          callErr.message?.toLowerCase().includes("aborted") ||
          callErr.parsed?.category === "NETWORK_TIMEOUT";

        if (isTimeout) {
          // Statutory guard: network timed out AFTER request was sent
          // Must be marked UNKNOWN and NEVER auto-failover to FYN
          await recordOperationFinish({
            operationId: opId,
            status: "UNKNOWN",
            errorMessage: `Statutory request timed out after submission to ${provider.name}. Outcome is UNKNOWN; reconciliation required.`,
            responsePayload: { error: callErr.message },
          });

          await logEwbAuditEvent({
            actor,
            action: "CREATE",
            entityId: documentId,
            operationType: "GENERATE",
            provider: provider.name,
            notes: `E-Way Bill generation for ${documentNumber} timed out. Marked UNKNOWN for statutory reconciliation.`,
          });

          return {
            success: false,
            status: "UNKNOWN",
            requiresReconciliation: true,
            environment: envUpper,
            provider: provider.name,
            message: `Generation request timed out after submission to ${provider.name}. Marked UNKNOWN to prevent duplicate issuance. Please verify with tax portal before retrying.`,
            rawResponse: { error: callErr.message },
          };
        }

        // Definitive local or pre-submission error
        await recordOperationFinish({
          operationId: opId,
          status: "FAILED",
          errorMessage: callErr.message,
          errorCode: callErr.parsed?.code || callErr.code,
          responsePayload: { error: callErr.message },
        });

        throw callErr;
      }

      // 3. Handle Uncertain / Timeout Outcome from Provider
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

      // 4. Handle Provider Validation Rejection
      if (!result.success || !result.ewbNumber) {
        await recordOperationFinish({
          operationId: opId,
          status: "FAILED",
          errorMessage: result.message,
          errorCode: result.errorCode,
          responsePayload: result.rawResponse,
        });

        return result;
      }

      // 5. Persist Statutory Record in Database
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

      // 6. Update Underlying Movement Document
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

      // 7. Complete Operation History & Audit Log
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
