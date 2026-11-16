/**
 * Statutory Audit Trail Logger for E-Way Bill Operations
 */

import { logAuditEvent } from "@/lib/audit";
import { AuditActor, EwbOperationType, EwbProviderName } from "./types";
import { sanitizePayload } from "./logger";

export async function logEwbAuditEvent(params: {
  actor?: AuditActor;
  action: "CREATE" | "UPDATE" | "CANCEL" | "VERIFY";
  entityId: string;
  operationType: EwbOperationType;
  provider: EwbProviderName;
  ewbNumber?: string;
  notes: string;
  beforeState?: any;
  afterState?: any;
}) {
  try {
    await logAuditEvent({
      userId: params.actor?.id,
      userName: params.actor?.name || "System EWB Engine",
      userRole: params.actor?.role || "SYSTEM",
      ipAddress: params.actor?.ipAddress,
      action: params.action,
      module: "MOVEMENTS",
      entityType: "EWayBill",
      entityId: params.entityId,
      beforeState: params.beforeState ? sanitizePayload(params.beforeState) : undefined,
      afterState: params.afterState ? sanitizePayload(params.afterState) : undefined,
      notes: `[EWB ${params.provider}] ${params.notes}`,
    });
  } catch (err: any) {
    // Non-blocking for statutory logging resilience
    console.error("[logEwbAuditEvent] Failed to persist audit event:", err.message);
  }
}
