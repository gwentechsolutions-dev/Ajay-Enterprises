import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { updateRateSchema } from "@/lib/schemas/material";
import { logAuditEvent } from "@/lib/audit";
import { validationErrorResponse } from "@/lib/api-validation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "inventory", "edit");

    const { id } = await params;
    const body = await req.json();
    const parsed = updateRateSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const { rentalRate, reason, effectiveFrom } = parsed.data;
    const newRate = new Prisma.Decimal(rentalRate);

    const variant = await db.materialVariant.findUnique({
      where: { id },
      include: {
        rateHistory: { orderBy: { effectiveFrom: "desc" }, take: 1 },
      },
    });

    if (!variant) {
      return NextResponse.json(
        { success: false, error: { message: "Material variant not found" } },
        { status: 404 }
      );
    }

    const previousRate = variant.defaultRentalRate;
    const fromDate = effectiveFrom ? new Date(effectiveFrom) : new Date();

    const result = await db.$transaction(async (tx) => {
      // Close previous rate effectiveTo if open
      if (variant.rateHistory.length > 0 && !variant.rateHistory[0].effectiveTo) {
        await tx.materialRateHistory.update({
          where: { id: variant.rateHistory[0].id },
          data: { effectiveTo: fromDate },
        });
      }

      // Create new rate history entry
      const history = await tx.materialRateHistory.create({
        data: {
          materialVariantId: id,
          rentalRate: newRate,
          previousRate,
          effectiveFrom: fromDate,
          reason,
          changedById: session?.id || null,
        },
      });

      // Update variant default rate
      const updatedVariant = await tx.materialVariant.update({
        where: { id },
        data: { defaultRentalRate: newRate },
      });

      return { history, updatedVariant };
    });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "UPDATE",
      module: "INVENTORY",
      entityType: "MaterialRateHistory",
      entityId: result.history.id,
      beforeState: { rate: previousRate.toString() },
      afterState: { rate: newRate.toString(), reason },
      notes: `Updated rental rate for ${variant.materialCode} (${variant.name}) from ₹${previousRate.toString()} to ₹${newRate.toString()}/day. Reason: ${reason}`,
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: `Rental rate updated to ₹${newRate.toString()} successfully.`,
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

