import { Prisma } from "@prisma/client";
import { db } from "./db";

export interface LogAuditParams {
  userId?: string | null;
  userName?: string | null;
  userRole?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  action: string;
  module: string;
  entityType: string;
  entityId?: string | null;
  beforeState?: Record<string, any> | null;
  afterState?: Record<string, any> | null;
  correlationId?: string | null;
  notes?: string | null;
}

// Sanitize sensitive fields before persisting to audit log
function sanitizeState(obj: Record<string, any> | null | undefined): string | null {
  if (!obj) return null;
  const clone = { ...obj };

  const SENSITIVE_KEYS = [
    "password",
    "passwordHash",
    "newPassword",
    "currentPassword",
    "confirmPassword",
    "token",
    "resetToken",
    "secret",
    "setupSecret",
    "accountNumber", // Mask bank account number
  ];

  for (const key of Object.keys(clone)) {
    if (SENSITIVE_KEYS.includes(key)) {
      if (key === "accountNumber" && typeof clone[key] === "string" && clone[key].length > 4) {
        clone[key] = "••••••••" + clone[key].slice(-4);
      } else {
        clone[key] = "[REDACTED]";
      }
    } else if (typeof clone[key] === "object" && clone[key] !== null) {
      clone[key] = JSON.parse(sanitizeState(clone[key]) || "{}");
    }
  }

  return JSON.stringify(clone);
}

export async function logAuditEvent(
  params: LogAuditParams,
  externalTx?: Prisma.TransactionClient
): Promise<void> {
  try {
    const client = externalTx || db;
    await client.auditEvent.create({
      data: {
        userId: params.userId || null,
        userName: params.userName || null,
        userRole: params.userRole || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        action: params.action,
        module: params.module,
        entityType: params.entityType,
        entityId: params.entityId || null,
        beforeState: sanitizeState(params.beforeState),
        afterState: sanitizeState(params.afterState),
        correlationId: params.correlationId || null,
        notes: params.notes || null,
      },
    });
  } catch (error) {
    // Non-blocking catch to ensure main business transaction isn't broken by audit logging failure, but log to stderr
    console.error("Failed to write audit event:", error);
  }
}

