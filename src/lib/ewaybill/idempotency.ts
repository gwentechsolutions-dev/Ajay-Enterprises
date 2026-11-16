/**
 * Statutory Idempotency & Concurrency-Safe Generation Lock Engine
 */

import { db } from "@/lib/db";
import { OperationStatus, EwbProviderName, EwbEnvironment, EwbOperationType, AuditActor } from "./types";
import { sanitizePayload, ewbLogger } from "./logger";

// Active in-process locks to prevent concurrent clicks / double-submits
const activeLocks = new Map<string, number>();
const LOCK_TIMEOUT_MS = 60_000; // 60 seconds

export function generateIdempotencyKey(documentType: string, documentId: string, operationType: EwbOperationType): string {
  return `EWB_${operationType}_${documentType}_${documentId}_${Date.now()}`;
}

/**
 * Acquires a non-blocking in-memory mutex for statutory generation
 */
export function acquireGenerationLock(documentId: string): boolean {
  const now = Date.now();
  const existingLockTime = activeLocks.get(documentId);

  if (existingLockTime && now - existingLockTime < LOCK_TIMEOUT_MS) {
    ewbLogger.warn(`Generation lock conflict for document ${documentId}`);
    return false;
  }

  activeLocks.set(documentId, now);
  return true;
}

/**
 * Releases the in-memory mutex
 */
export function releaseGenerationLock(documentId: string) {
  activeLocks.delete(documentId);
}

/**
 * Checks if an active E-Way Bill already exists for the given document
 */
export async function findActiveEwbForDocument(documentType: "DELIVERY_NOTE" | "TRANSFER_NOTE", documentId: string) {
  return db.eWayBill.findFirst({
    where: {
      documentType,
      documentId,
      status: "ACTIVE",
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Records an E-Way Bill operation record (or updates it)
 */
export async function recordOperationStart(params: {
  documentType: "DELIVERY_NOTE" | "TRANSFER_NOTE";
  documentId: string;
  provider: EwbProviderName;
  environment: EwbEnvironment;
  operationType: EwbOperationType;
  idempotencyKey: string;
  requestPayload: any;
  actor?: AuditActor;
  eWayBillId?: string;
}): Promise<string | null> {
  try {
    // If EWayBillOperation table is available in Prisma schema
    if ("eWayBillOperation" in db) {
      const op = await (db as any).eWayBillOperation.create({
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
    }
  } catch (err: any) {
    ewbLogger.warn("Failed to create operation log record:", { message: err.message });
  }
  return null;
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
}) {
  if (!params.operationId) return;

  try {
    if ("eWayBillOperation" in db) {
      await (db as any).eWayBillOperation.update({
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
    }
  } catch (err: any) {
    ewbLogger.warn("Failed to update operation log record:", { message: err.message });
  }
}
