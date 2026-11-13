import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";
import { createRentalDepositSchema } from "@/lib/schemas/rental";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "rentals", "view");

    const searchParams = req.nextUrl.searchParams;
    const customerId = searchParams.get("customerId") || undefined;
    const customerSiteId = searchParams.get("customerSiteId") || undefined;
    const agreementId = searchParams.get("rentalAgreementId") || undefined;

    const deposits = await db.rentalDepositTransaction.findMany({
      where: {
        customerId,
        customerSiteId,
        rentalAgreementId: agreementId,
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        customerSite: { select: { id: true, siteName: true, siteCode: true } },
        rentalAgreement: { select: { id: true, agreementNumber: true } },
      },
      orderBy: { receiptDate: "desc" },
    });

    return NextResponse.json({ success: true, data: deposits });
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
    const parsed = createRentalDepositSchema.safeParse(body);
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

    const depositNumber = input.depositNumber || (await generateNextDocumentNumber("DEP"));

    const created = await db.$transaction(async (tx) => {
      const dep = await tx.rentalDepositTransaction.create({
        data: {
          depositNumber,
          rentalAgreementId: input.rentalAgreementId || null,
          customerId: input.customerId,
          customerSiteId: input.customerSiteId,
          transactionType: input.transactionType,
          amount: new Prisma.Decimal(input.amount),
          receiptDate: input.receiptDate ? new Date(input.receiptDate) : new Date(),
          referenceNumber: input.referenceNumber || null,
          notes: input.notes || null,
          refundEligibility: input.refundEligibility,
          refundAmount: input.refundAmount ? new Prisma.Decimal(input.refundAmount) : null,
          approvedById: actor.id,
          approvedAt: new Date(),
        },
        include: {
          customer: true,
          customerSite: true,
        },
      });

      // Update agreement depositStatus if linked
      if (input.rentalAgreementId && input.transactionType === "DEPOSIT_RECEIVED") {
        await tx.rentalAgreement.update({
          where: { id: input.rentalAgreementId },
          data: {
            depositStatus: "FULLY_PAID",
          },
        });
      }

      await logAuditEvent({
        userId: actor.id,
        userName: actor.name,
        userRole: actor.role,
        ipAddress: actor.ipAddress,
        action: "POST",
        module: "RENTALS",
        entityType: "RentalDepositTransaction",
        entityId: dep.id,
        notes: `Recorded deposit transaction ${depositNumber} (${input.transactionType}) for ₹${input.amount}`,
      });

      return dep;
    });

    return NextResponse.json(
      {
        success: true,
        data: created,
        message: `Rental Deposit Transaction ${created.depositNumber} recorded.`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

