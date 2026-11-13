import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    await requirePermission(session, "rentals", "approve");
    const { id } = await params;

    const assessment = await db.damageLossAssessment.findUnique({
      where: { id },
    });

    if (!assessment) {
      return NextResponse.json({ success: false, error: { message: "Assessment not found" } }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const finalAmount = body.approvedChargeAmount !== undefined
      ? new Prisma.Decimal(body.approvedChargeAmount)
      : assessment.approvedChargeAmount;

    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    const updated = await db.$transaction(async (tx) => {
      const res = await tx.damageLossAssessment.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedChargeAmount: finalAmount,
          approvedById: actor.id,
          approvedAt: new Date(),
        },
      });

      await logAuditEvent({
        userId: actor.id,
        userName: actor.name,
        userRole: actor.role,
        ipAddress: actor.ipAddress,
        action: "APPROVE",
        module: "RENTALS",
        entityType: "DamageLossAssessment",
        entityId: id,
        notes: `Approved Damage/Loss Assessment ${assessment.assessmentNumber} with final charge amount ₹${finalAmount.toFixed(2)}`,
      });

      return res;
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Damage/Loss Assessment ${assessment.assessmentNumber} approved.`,
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

