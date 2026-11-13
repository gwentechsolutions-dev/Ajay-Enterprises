import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    await requirePermission(session, "rentals", "approve");
    const { id } = await params;

    const agreement = await db.rentalAgreement.findUnique({
      where: { id },
    });

    if (!agreement) {
      return NextResponse.json({ success: false, error: { message: "Rental Agreement not found" } }, { status: 404 });
    }

    if (agreement.status === "ACTIVE") {
      return NextResponse.json({ success: false, error: { message: "Agreement is already active" } }, { status: 400 });
    }

    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    const updated = await db.$transaction(async (tx) => {
      const res = await tx.rentalAgreement.update({
        where: { id },
        data: {
          status: "ACTIVE",
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
        entityType: "RentalAgreement",
        entityId: id,
        notes: `Approved Rental Agreement ${agreement.agreementNumber}. Status is now ACTIVE.`,
      });

      return res;
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Rental Agreement ${agreement.agreementNumber} approved and activated.`,
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

