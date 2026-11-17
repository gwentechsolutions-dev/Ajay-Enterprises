import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";
import { createRentalAgreementSchema } from "@/lib/schemas/rental";
import { validationErrorResponse } from "@/lib/api-validation";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "rentals", "view");

    const searchParams = req.nextUrl.searchParams;
    const customerId = searchParams.get("customerId") || undefined;
    const customerSiteId = searchParams.get("customerSiteId") || undefined;
    const status = searchParams.get("status") || undefined;

    const agreements = await db.rentalAgreement.findMany({
      where: {
        customerId,
        customerSiteId,
        status,
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        customerSite: { select: { id: true, siteName: true, siteCode: true } },
        items: {
          include: {
            materialVariant: { select: { id: true, name: true, materialCode: true, uom: true } },
          },
        },
        _count: {
          select: { deposits: true, statements: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: agreements });
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
    const parsed = createRentalAgreementSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const input = parsed.data;
    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    const agreementNumber = input.agreementNumber || (await generateNextDocumentNumber("AGR"));

    const agreement = await db.$transaction(async (tx) => {
      const created = await tx.rentalAgreement.create({
        data: {
          agreementNumber,
          customerId: input.customerId,
          customerSiteId: input.customerSiteId,
          startDate: new Date(input.startDate),
          endDate: input.endDate ? new Date(input.endDate) : null,
          billingFrequency: input.billingFrequency,
          billingCycleDay: input.billingCycleDay,
          depositAmount: new Prisma.Decimal(input.depositAmount),
          depositStatus: input.depositStatus,
          paymentTerms: input.paymentTerms,
          specialTerms: input.specialTerms,
          notes: input.notes,
          status: "DRAFT",
          createdById: actor.id,
          items: {
            create: input.items.map((it) => ({
              materialVariantId: it.materialVariantId,
              agreedDailyRate: new Prisma.Decimal(it.agreedDailyRate),
              securityDepositRate: it.securityDepositRate ? new Prisma.Decimal(it.securityDepositRate) : null,
              remarks: it.remarks,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      await logAuditEvent({
        userId: actor.id,
        userName: actor.name,
        userRole: actor.role,
        ipAddress: actor.ipAddress,
        action: "CREATE",
        module: "RENTALS",
        entityType: "RentalAgreement",
        entityId: created.id,
        notes: `Created Rental Agreement ${agreementNumber} for site with ${input.items.length} rate terms`,
      });

      return created;
    });

    return NextResponse.json(
      { success: true, data: agreement, message: `Rental Agreement ${agreement.agreementNumber} created.` },
      { status: 201 }
    );
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

