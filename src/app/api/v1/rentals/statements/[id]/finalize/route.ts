import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    await requirePermission(session, "billing", "post");
    const { id } = await params;

    const statement = await db.rentalStatement.findUnique({
      where: { id },
      include: {
        customer: true,
        customerSite: true,
        rentalAgreement: true,
        siteSummaries: {
          include: { customerSite: true },
        },
        items: {
          include: {
            materialVariant: true,
            customerSite: true,
            dayDetails: true,
          },
        },
      },
    });

    if (!statement) {
      return NextResponse.json({ success: false, error: { message: "Rental Statement not found" } }, { status: 404 });
    }

    if (statement.status === "FINALIZED") {
      return NextResponse.json(
        { success: false, error: { message: "Statement is already FINALIZED and locked against modifications." } },
        { status: 400 }
      );
    }

    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    // Serialize frozen snapshot payload
    const snapshotPayload = {
      frozenAt: new Date().toISOString(),
      finalizedBy: { id: actor.id, name: actor.name, role: actor.role },
      statement: {
        statementNumber: statement.statementNumber,
        billingMode: statement.billingMode,
        periodStartDate: statement.periodStartDate,
        periodEndDate: statement.periodEndDate,
        totalRentalAmount: statement.totalRentalAmount,
        totalDamageCharges: statement.totalDamageCharges,
        totalMissingCharges: statement.totalMissingCharges,
        totalAdjustments: statement.totalAdjustments,
        netPayableAmount: statement.netPayableAmount,
        previousBalanceInformational: statement.previousBalanceInformational,
      },
      customer: {
        id: statement.customer.id,
        name: statement.customer.name,
        code: statement.customer.customerCode,
        gstin: statement.customer.gstin,
        billingAddress: statement.customer.billingAddress,
      },
      site: statement.customerSite
        ? {
            id: statement.customerSite.id,
            name: statement.customerSite.siteName,
            code: statement.customerSite.siteCode,
            address: statement.customerSite.fullAddress,
          }
        : null,
      siteSummaries: statement.siteSummaries.map((ss) => ({
        siteId: ss.customerSiteId,
        siteName: ss.customerSite.siteName,
        siteCode: ss.customerSite.siteCode,
        rentalAmount: ss.siteRentalAmount,
        damageCharges: ss.siteDamageCharges,
        missingCharges: ss.siteMissingCharges,
        totalAmount: ss.siteTotalAmount,
      })),
      items: statement.items.map((it) => ({
        materialName: it.materialVariant.name,
        materialCode: it.materialVariant.materialCode,
        uom: it.materialVariant.uom,
        ownershipType: it.ownershipType,
        openingHeldQty: it.openingHeldQty,
        newDeliveredQty: it.newDeliveredQty,
        returnedQty: it.returnedQty,
        damagedQty: it.damagedQty,
        missingQty: it.missingQty,
        closingHeldQty: it.closingHeldQty,
        billableDays: it.billableDays,
        dailyRate: it.applicableDailyRate,
        rentalAmount: it.rentalAmount,
        dayDetailsCount: it.dayDetails.length,
      })),
    };

    const finalized = await db.$transaction(async (tx) => {
      const res = await tx.rentalStatement.update({
        where: { id },
        data: {
          status: "FINALIZED",
          finalizedById: actor.id,
          finalizedAt: new Date(),
          snapshotPayload: snapshotPayload as any,
        },
      });

      await logAuditEvent({
        userId: actor.id,
        userName: actor.name,
        userRole: actor.role,
        ipAddress: actor.ipAddress,
        action: "POST",
        module: "RENTALS",
        entityType: "RentalStatement",
        entityId: id,
        notes: `FINALIZED and locked Rental Statement ${statement.statementNumber}. Snapshot frozen with ${statement.items.length} line items.`,
      });

      return res;
    });

    return NextResponse.json({
      success: true,
      data: finalized,
      message: `Rental Statement ${statement.statementNumber} is now FINALIZED and immutably locked.`,
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

