import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";
import { createDamageLossSchema } from "@/lib/schemas/rental";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "rentals", "view");

    const searchParams = req.nextUrl.searchParams;
    const customerId = searchParams.get("customerId") || undefined;
    const customerSiteId = searchParams.get("customerSiteId") || undefined;
    const status = searchParams.get("status") || undefined;

    const assessments = await db.damageLossAssessment.findMany({
      where: {
        customerId,
        customerSiteId,
        status,
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        customerSite: { select: { id: true, siteName: true, siteCode: true } },
        materialVariant: { select: { id: true, name: true, materialCode: true, uom: true } },
        materialReturnNote: { select: { id: true, mrnNumber: true, returnDate: true } },
      },
      orderBy: { assessmentDate: "desc" },
    });

    return NextResponse.json({ success: true, data: assessments });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "rentals", "create");

    const body = await req.json();
    const parsed = createDamageLossSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_FAILED",
            message: "Validation failed",
            details: parsed.error.issues,
          },
        },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    const assessmentNumber = input.assessmentNumber || (await generateNextDocumentNumber("DLA"));

    const created = await db.$transaction(async (tx) => {
      const dla = await tx.damageLossAssessment.create({
        data: {
          assessmentNumber,
          customerId: input.customerId,
          customerSiteId: input.customerSiteId,
          materialReturnNoteId: input.materialReturnNoteId || null,
          materialVariantId: input.materialVariantId,
          assessmentType: input.assessmentType,
          quantity: new Prisma.Decimal(input.quantity),
          condition: input.condition,
          assessmentDate: input.assessmentDate ? new Date(input.assessmentDate) : new Date(),
          approvedChargeAmount: new Prisma.Decimal(input.approvedChargeAmount),
          status: "PENDING_APPROVAL",
          remarks: input.remarks || null,
          photographs: input.photographs ? (input.photographs as any) : null,
          assessedById: actor.id,
        },
        include: {
          customer: true,
          customerSite: true,
          materialVariant: true,
        },
      });

      await logAuditEvent({
        userId: actor.id,
        userName: actor.name,
        userRole: actor.role,
        ipAddress: actor.ipAddress,
        action: "CREATE",
        module: "RENTALS",
        entityType: "DamageLossAssessment",
        entityId: dla.id,
        notes: `Recorded Damage/Loss Assessment ${assessmentNumber} (${input.assessmentType}) for ${input.quantity} units. Proposed charge: ₹${input.approvedChargeAmount}`,
      });

      return dla;
    });

    return NextResponse.json(
      {
        success: true,
        data: created,
        message: `Damage/Loss Assessment ${created.assessmentNumber} recorded.`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

