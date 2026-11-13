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

    const deposit = await db.rentalDepositTransaction.findUnique({
      where: { id },
    });

    if (!deposit) {
      return NextResponse.json({ success: false, error: { message: "Deposit record not found" } }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const refundAmount = body.refundAmount !== undefined ? new Prisma.Decimal(body.refundAmount) : deposit.amount;

    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    const updated = await db.$transaction(async (tx) => {
      const res = await tx.rentalDepositTransaction.update({
        where: { id },
        data: {
          refundEligibility: true,
          refundStatus: "APPROVED",
          refundAmount,
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
        entityType: "RentalDepositTransaction",
        entityId: id,
        notes: `Approved deposit refund of ₹${refundAmount.toFixed(2)} on deposit receipt ${deposit.depositNumber}`,
      });

      return res;
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Deposit refund of ₹${refundAmount.toFixed(2)} approved.`,
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

