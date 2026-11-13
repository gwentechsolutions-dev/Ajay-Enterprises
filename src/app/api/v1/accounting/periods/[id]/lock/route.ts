import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    await requirePermission(session, "accounting", "approve");
    const { id } = await params;

    const body = await req.json();
    const { isLocked, notes } = body;

    const period = await db.accountingPeriod.findUnique({
      where: { id },
    });

    if (!period) {
      return NextResponse.json({ success: false, error: { message: "Period not found" } }, { status: 404 });
    }

    const updated = await db.accountingPeriod.update({
      where: { id },
      data: {
        isLocked: !!isLocked,
        lockedById: isLocked ? session!.id : null,
        lockedAt: isLocked ? new Date() : null,
        notes: notes || period.notes,
      },
    });

    await logAuditEvent({
      userId: session!.id,
      userName: session!.name,
      userRole: session!.role,
      action: isLocked ? "POST" : "EDIT",
      module: "ACCOUNTING",
      entityType: "AccountingPeriod",
      entityId: id,
      notes: `${isLocked ? "LOCKED" : "UNLOCKED"} accounting period '${period.periodName}' (${period.fiscalYear})`,
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Period ${period.periodName} has been ${isLocked ? "LOCKED" : "UNLOCKED"}.`,
    });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

