import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";
import { createRentalStatementSchema } from "@/lib/schemas/rental";
import { calculateRentalStatement } from "@/lib/rentals/calculator";
import { validationErrorResponse } from "@/lib/api-validation";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "billing", "view");

    const searchParams = req.nextUrl.searchParams;
    const customerId = searchParams.get("customerId") || undefined;
    const customerSiteId = searchParams.get("customerSiteId") || undefined;
    const billingMode = searchParams.get("billingMode") || undefined;
    const statusParam = searchParams.get("status");
    const status = statusParam
      ? statusParam.includes(",")
        ? { in: statusParam.split(",").map((s) => s.trim()) }
        : statusParam
      : undefined;

    const statements = await db.rentalStatement.findMany({
      where: {
        customerId,
        customerSiteId,
        billingMode,
        status,
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        customerSite: { select: { id: true, siteName: true, siteCode: true } },
        rentalAgreement: { select: { id: true, agreementNumber: true } },
        invoices: { select: { id: true, invoiceNumber: true, status: true } },
        _count: {
          select: { items: true, siteSummaries: true, invoices: true },
        },
      },
      orderBy: { periodStartDate: "desc" },
    });

    return NextResponse.json({ success: true, data: statements });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED")
      ? 401
      : error.message?.startsWith("FORBIDDEN")
      ? 403
      : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "billing", "create");

    const body = await req.json();
    const parsed = createRentalStatementSchema.safeParse(body);
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

    const startDate = new Date(input.periodStartDate);
    const endDate = new Date(input.periodEndDate);

    // Concurrency & Duplicate Billing Protection:
    // Build overlap condition preserving site-wise vs consolidated mutual exclusivity
    const overlapWhere =
      input.billingMode === "SITE_WISE" && input.customerSiteId
        ? {
            customerId: input.customerId,
            status: { in: ["APPROVED", "FINALIZED"] },
            periodStartDate: { lte: endDate },
            periodEndDate: { gte: startDate },
            OR: [
              { customerSiteId: input.customerSiteId },
              { customerSiteId: null, billingMode: "CONSOLIDATED" },
            ],
          }
        : {
            customerId: input.customerId,
            status: { in: ["APPROVED", "FINALIZED"] },
            periodStartDate: { lte: endDate },
            periodEndDate: { gte: startDate },
          };

    // Pre-check outside transaction for fast feedback
    const existingApproved = await db.rentalStatement.findFirst({
      where: overlapWhere,
    });

    if (existingApproved) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DUPLICATE_BILLING",
            message: `A statement (${existingApproved.statementNumber}) already covers the selected date range. Duplicate billing is prevented.`,
          },
        },
        { status: 409 }
      );
    }

    // Run deterministic calculation engine
    const calculation = await calculateRentalStatement(input);

    if (calculation.items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "No billable material movements or active rental batches found for the selected site(s) and period.",
          },
        },
        { status: 400 }
      );
    }

    const statementNumber = input.statementNumber || (await generateNextDocumentNumber("STM"));

    const created = await db.$transaction(async (tx) => {
      // 0. Database Transaction Advisory Lock: Serialize concurrent statement generation
      const lockKey = `rental_stmt_${input.customerId}_${input.billingMode === "SITE_WISE" ? input.customerSiteId : "CONSOLIDATED"}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      // 0b. Atomic Re-Check inside transaction lock to guarantee concurrency safety
      const inTxExisting = await tx.rentalStatement.findFirst({
        where: overlapWhere,
      });

      if (inTxExisting) {
        throw new Error(
          `DUPLICATE_BILLING: An active statement (${inTxExisting.statementNumber}) already exists for this period. Concurrent duplicate prevented.`
        );
      }

      // 1. Create Statement Header
      const stmt = await tx.rentalStatement.create({
        data: {
          statementNumber,
          billingMode: input.billingMode,
          customerId: input.customerId,
          customerSiteId: input.billingMode === "SITE_WISE" ? input.customerSiteId : null,
          rentalAgreementId: input.rentalAgreementId || null,
          periodStartDate: startDate,
          periodEndDate: endDate,
          totalRentalAmount: calculation.totalRentalAmount,
          totalDamageCharges: calculation.totalDamageCharges,
          totalMissingCharges: calculation.totalMissingCharges,
          totalAdjustments: calculation.totalAdjustments,
          netPayableAmount: calculation.netPayableAmount,
          previousBalanceInformational: calculation.previousBalanceInformational,
          status: "CALCULATED",
          calculatedAt: new Date(),
          remarks: input.remarks || null,
        },
      });

      // 2. Create Statement Items & Day Details
      for (const item of calculation.items) {
        const stmtItem = await tx.rentalStatementItem.create({
          data: {
            statementId: stmt.id,
            customerSiteId: item.customerSiteId,
            materialVariantId: item.materialVariantId,
            rentalBatchId: item.rentalBatchId,
            ownershipType: item.ownershipType,
            openingHeldQty: item.openingHeldQty,
            newDeliveredQty: item.newDeliveredQty,
            returnedQty: item.returnedQty,
            damagedQty: item.damagedQty,
            missingQty: item.missingQty,
            closingHeldQty: item.closingHeldQty,
            billableDays: item.billableDays,
            applicableDailyRate: item.applicableDailyRate,
            rentalAmount: item.rentalAmount,
            remarks: null,
          },
        });

        // Insert day details
        if (item.dayDetails.length > 0) {
          await tx.rentalStatementDayDetail.createMany({
            data: item.dayDetails.map((dd) => ({
              statementItemId: stmtItem.id,
              rentalBatchId: dd.rentalBatchId,
              calculationDate: dd.calculationDate,
              eligibleQuantity: dd.eligibleQuantity,
              dailyRate: dd.dailyRate,
              dayAmount: dd.dayAmount,
              isDeliveryDay: dd.isDeliveryDay,
              isReturnDay: dd.isReturnDay,
              billed: dd.dayAmount.gt(0),
              explanation: dd.explanation,
            })),
          });
        }
      }

      // 3. Create Site Summaries (if consolidated or multiple sites)
      if (calculation.siteSummaries.length > 0) {
        await tx.rentalStatementSiteSummary.createMany({
          data: calculation.siteSummaries.map((ss) => ({
            statementId: stmt.id,
            customerSiteId: ss.customerSiteId,
            siteRentalAmount: ss.rentalAmount,
            siteDamageCharges: ss.damageCharges,
            siteMissingCharges: ss.missingCharges,
            siteTotalAmount: ss.totalAmount,
          })),
        });
      }

      // 4. Audit Log
      await logAuditEvent({
        userId: actor.id,
        userName: actor.name,
        userRole: actor.role,
        ipAddress: actor.ipAddress,
        action: "CREATE",
        module: "RENTALS",
        entityType: "RentalStatement",
        entityId: stmt.id,
        notes: `Generated Rental Statement ${statementNumber} (${input.billingMode}). Net: ₹${calculation.netPayableAmount.toFixed(2)} with ${calculation.items.length} line items.`,
      });

      return stmt;
    });

    return NextResponse.json(
      {
        success: true,
        data: created,
        message: `Rental Statement ${created.statementNumber} generated successfully.`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (
      error.message?.includes("DUPLICATE_BILLING") ||
      error.code === "P2002" ||
      error.message?.includes("RentalStatement_unique_active_period")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DUPLICATE_BILLING",
            message:
              error.message ||
              "A rental statement already exists for this site and period. Duplicate billing is prevented.",
          },
        },
        { status: 409 }
      );
    }
    const status = error.message?.startsWith("UNAUTHORIZED")
      ? 401
      : error.message?.startsWith("FORBIDDEN")
      ? 403
      : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

