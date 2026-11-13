import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    await requirePermission(session, "billing", "approve");
    const { id } = await params;

    const statement = await db.rentalStatement.findUnique({
      where: { id },
    });

    if (!statement) {
      return NextResponse.json({ success: false, error: { message: "Rental Statement not found" } }, { status: 404 });
    }

    if (statement.status === "FINALIZED") {
      return NextResponse.json(
        { success: false, error: { message: "Statement is already finalized and locked." } },
        { status: 400 }
      );
    }

    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    const updated = await db.$transaction(async (tx) => {
      const res = await tx.rentalStatement.update({
        where: { id },
        data: {
          status: "APPROVED",
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
        entityType: "RentalStatement",
        entityId: id,
        notes: `Approved Rental Statement ${statement.statementNumber}. Status is now APPROVED.`,
      });

      return res;
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Rental Statement ${statement.statementNumber} approved.`,
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

