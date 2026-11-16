/**
 * Statutory Idempotency & Database-Backed Concurrency Protection Engine
 * Suitable for multi-instance Vercel Serverless Environments
 * Operating Business: AJAY ENTERPRISES
 */

import { db } from "@/lib/db";
import {
  OperationStatus,
  EwbProviderName,
  EwbEnvironment,
  EwbOperationType,
  AuditActor,
} from "./types";
import { sanitizePayload, ewbLogger } from "./logger";

// In-process lock as local fast path (works alongside database-backed lock)
const activeLocks = new Map<string, number>();
const IN_PROCESS_LOCK_TIMEOUT_MS = 60_000;
const SERVERLESS_LOCK_WINDOW_MS = 90_000; // 90 seconds for serverless DB locks

export function generateIdempotencyKey(
  documentType: string,
  documentId: string,
  operationType: EwbOperationType
): string {
  return `EWB_${operationType}_${documentType}_${documentId}_${Date.now()}`;
}

/**
 * Fast-path in-memory lock (for current node process / unit test compatibility)
 */
export function acquireGenerationLock(documentId: string): boolean {
  const now = Date.now();
  const existingLockTime = activeLocks.get(documentId);

  if (existingLockTime && now - existingLockTime < IN_PROCESS_LOCK_TIMEOUT_MS) {
    ewbLogger.warn(`In-memory generation lock conflict for document ${documentId}`);
    return false;
  }

  activeLocks.set(documentId, now);
  return true;
}

/**
 * Releases the in-memory mutex
 */
export function releaseGenerationLock(documentId: string): void {
  activeLocks.delete(documentId);
}

/**
 * Checks if an active E-Way Bill already exists for the given document
 */
export async function findActiveEwbForDocument(
  documentType: "DELIVERY_NOTE" | "TRANSFER_NOTE",
  documentId: string
) {
  return db.eWayBill.findFirst({
    where: {
      documentType,
      documentId,
      status: "ACTIVE",
    },
    orderBy: { createdAt: "desc" },
  });
}

export interface DbLockResult {
  acquired: boolean;
  operationId?: string;
  reason?: "ALREADY_ACTIVE" | "IN_PROGRESS" | "RECONCILIATION_REQUIRED";
  existingEwb?: any;
  message?: string;
}

/**
 * Database-backed concurrency lock and statutory idempotency guard.
 * Coordinates across multiple Vercel serverless lambda instances.
 */
export async function acquireDatabaseGenerationLock(params: {
  documentType: "DELIVERY_NOTE" | "TRANSFER_NOTE";
  documentId: string;
  documentNumber: string;
  provider: EwbProviderName;
  environment: EwbEnvironment;
  idempotencyKey: string;
  requestPayload: any;
  actor?: AuditActor;
}): Promise<DbLockResult> {
  const { documentType, documentId, documentNumber, provider, environment, idempotencyKey, requestPayload, actor } = params;

  // 1. Check for existing ACTIVE E-Way Bill (Statutory Duplicate Guard)
  const existingActiveEwb = await findActiveEwbForDocument(documentType, documentId);
  if (existingActiveEwb) {
    ewbLogger.info(
      `Active E-Way Bill ${existingActiveEwb.ewbNumber} already exists for ${documentType} ${documentNumber}. Safely reusing record.`
    );
    return {
      acquired: false,
      reason: "ALREADY_ACTIVE",
      existingEwb: existingActiveEwb,
      message: `Document '${documentNumber}' already has an active E-Way Bill (${existingActiveEwb.ewbNumber}). Duplicate generation is blocked by statutory rules.`,
    };
  }

  // 2. Check for UNKNOWN / Ambiguous operations requiring reconciliation
  const pendingUnknownOp = await db.eWayBillOperation.findFirst({
    where: {
      documentId,
      operationType: "GENERATE",
      status: "UNKNOWN",
    },
    orderBy: { createdAt: "desc" },
  });

  if (pendingUnknownOp) {
    const msg = `A previous statutory generation attempt for document '${documentNumber}' resulted in an UNKNOWN/Timeout state (Operation ID: ${pendingUnknownOp.id}). Statutory reconciliation is required before retrying or switching providers to prevent duplicate E-Way Bill issuance.`;
    ewbLogger.warn(msg);
    return {
      acquired: false,
      reason: "RECONCILIATION_REQUIRED",
      operationId: pendingUnknownOp.id,
      message: msg,
    };
  }

  // 3. Check for concurrent in-flight operations across any Vercel serverless instance
  const lockThreshold = new Date(Date.now() - SERVERLESS_LOCK_WINDOW_MS);

  const activeProcessingOp = await db.eWayBillOperation.findFirst({
    where: {
      documentId,
      operationType: "GENERATE",
      status: "PROCESSING",
      createdAt: { gte: lockThreshold },
    },
    orderBy: { createdAt: "desc" },
  });

  if (activeProcessingOp) {
    const msg = `Another statutory generation operation for document '${documentNumber}' is currently processing (started at ${activeProcessingOp.createdAt.toISOString()}). Concurrent operations are blocked across all serverless instances.`;
    ewbLogger.warn(msg);
    return {
      acquired: false,
      reason: "IN_PROGRESS",
      operationId: activeProcessingOp.id,
      message: msg,
    };
  }

  // 4. Stale operation cleanup: If an operation has been PROCESSING for > 90s, mark it UNKNOWN
  const staleOps = await db.eWayBillOperation.findMany({
    where: {
      documentId,
      operationType: "GENERATE",
      status: "PROCESSING",
      createdAt: { lt: lockThreshold },
    },
  });

  if (staleOps.length > 0) {
    await db.eWayBillOperation.updateMany({
      where: {
        documentId,
        operationType: "GENERATE",
        status: "PROCESSING",
        createdAt: { lt: lockThreshold },
      },
      data: {
        status: "UNKNOWN",
        errorMessage:
          "Operation timed out without completion in previous serverless invocation; marked UNKNOWN for statutory reconciliation.",
        completedAt: new Date(),
      },
    });

    const msg = `Document '${documentNumber}' had an unconfirmed generation attempt that exceeded the execution window. It has been marked UNKNOWN and requires statutory verification before retrying.`;
    ewbLogger.warn(msg);
    return {
      acquired: false,
      reason: "RECONCILIATION_REQUIRED",
      operationId: staleOps[0].id,
      message: msg,
    };
  }

  // 5. Atomically acquire lock by creating the PROCESSING operation record
  try {
    const op = await db.eWayBillOperation.create({
      data: {
        documentType,
        documentId,
        provider,
        environment,
        operationType: "GENERATE",
        idempotencyKey,
        status: "PROCESSING",
        requestPayload: sanitizePayload(requestPayload) as any,
        initiatedById: actor?.id,
        initiatedByName: actor?.name,
      },
    });

    acquireGenerationLock(documentId); // Fast path local lock
    return {
      acquired: true,
      operationId: op.id,
    };
  } catch (err: any) {
    ewbLogger.error("Failed to acquire database generation lock:", err);
    throw new Error(`Failed to acquire statutory generation lock: ${err.message}`);
  }
}

/**
 * Completes an operation record with status and sanitized response
 */
export async function recordOperationFinish(params: {
  operationId?: string | null;
  status: OperationStatus;
  responsePayload?: any;
  errorCode?: string;
  errorMessage?: string;
  eWayBillId?: string;
}): Promise<void> {
  if (!params.operationId) return;

  try {
    await db.eWayBillOperation.update({
      where: { id: params.operationId },
      data: {
        status: params.status,
        responsePayload: params.responsePayload ? sanitizePayload(params.responsePayload) : undefined,
        errorCode: params.errorCode,
        errorMessage: params.errorMessage,
        completedAt: new Date(),
        ...(params.eWayBillId ? { eWayBillId: params.eWayBillId } : {}),
      },
    });
  } catch (err: any) {
    ewbLogger.warn("Failed to update operation log record:", { message: err.message });
  }
}

/**
 * Reconciles an UNKNOWN statutory operation
 */
export async function reconcileUnknownOperation(params: {
  operationId: string;
  resolution: "CONFIRM_FAILED" | "CONFIRM_GENERATED";
  ewbNumber?: string;
  notes: string;
  actor: AuditActor;
}): Promise<{ success: boolean; message: string }> {
  const op = await db.eWayBillOperation.findUnique({
    where: { id: params.operationId },
  });

  if (!op) {
    throw new Error(`Operation record '${params.operationId}' not found.`);
  }

  if (op.status !== "UNKNOWN") {
    throw new Error(`Operation '${params.operationId}' has status '${op.status}'. Only UNKNOWN operations can be reconciled.`);
  }

  if (params.resolution === "CONFIRM_FAILED") {
    await db.eWayBillOperation.update({
      where: { id: params.operationId },
      data: {
        status: "FAILED",
        errorMessage: `Reconciled by ${params.actor.name}: Confirmed not generated on portal. ${params.notes}`,
        completedAt: new Date(),
      },
    });

    return {
      success: true,
      message: `Operation ${params.operationId} reconciled as FAILED. The document is now unlocked for retry.`,
    };
  }

  if (params.resolution === "CONFIRM_GENERATED") {
    if (!params.ewbNumber) {
      throw new Error("E-Way Bill Number is required to reconcile as CONFIRM_GENERATED.");
    }

    // Link or create E-Way Bill record
    let ewb = await db.eWayBill.findUnique({
      where: { ewbNumber: params.ewbNumber },
    });

    if (!ewb) {
      ewb = await db.eWayBill.create({
        data: {
          ewbNumber: params.ewbNumber,
          documentType: op.documentType,
          documentId: op.documentId,
          deliveryNoteId: op.documentType === "DELIVERY_NOTE" ? op.documentId : null,
          transferNoteId: op.documentType === "TRANSFER_NOTE" ? op.documentId : null,
          status: "ACTIVE",
          provider: op.provider,
          environment: op.environment as any,
          requestPayload: op.requestPayload as any,
          responsePayload: { reconciled: true, notes: params.notes } as any,
        },
      });

      if (op.documentType === "DELIVERY_NOTE") {
        await db.deliveryNote.update({
          where: { id: op.documentId },
          data: { eWayBillNumber: params.ewbNumber },
        });
      } else if (op.documentType === "TRANSFER_NOTE") {
        await db.stockTransferNote.update({
          where: { id: op.documentId },
          data: { eWayBillNumber: params.ewbNumber },
        });
      }
    }

    await db.eWayBillOperation.update({
      where: { id: params.operationId },
      data: {
        status: "SUCCESS",
        eWayBillId: ewb.id,
        errorMessage: `Reconciled by ${params.actor.name}: Confirmed generated as ${params.ewbNumber}. ${params.notes}`,
        completedAt: new Date(),
      },
    });

    return {
      success: true,
      message: `Operation ${params.operationId} reconciled as SUCCESS with EWB ${params.ewbNumber}.`,
    };
  }

  throw new Error(`Invalid reconciliation resolution: ${params.resolution}`);
}

// Backward-compatible alias for recordOperationStart
export async function recordOperationStart(params: any): Promise<string | null> {
  try {
    const op = await db.eWayBillOperation.create({
      data: {
        documentType: params.documentType,
        documentId: params.documentId,
        provider: params.provider,
        environment: params.environment,
        operationType: params.operationType,
        idempotencyKey: params.idempotencyKey,
        status: "PROCESSING",
        requestPayload: sanitizePayload(params.requestPayload),
        initiatedById: params.actor?.id,
        initiatedByName: params.actor?.name,
        eWayBillId: params.eWayBillId,
      },
    });
    return op.id;
  } catch (err: any) {
    ewbLogger.warn("Failed to create operation log record:", { message: err.message });
    return null;
  }
}
