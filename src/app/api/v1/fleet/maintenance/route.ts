import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber, getCurrentFiscalYear } from "@/lib/document-series";
import { postJournalEntry, getSystemAccount } from "@/lib/accounting/ledger";
import { logAuditEvent } from "@/lib/audit";
import { createVehicleMaintenanceSchema } from "@/lib/schemas/fleet";
import { validationErrorResponse } from "@/lib/api-validation";

// ==============================================================================
// INVENTRA: VEHICLE MAINTENANCE & WORKSHOP JOBS API
// ==============================================================================

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "fleet", "view");

    const { searchParams } = new URL(req.url);
    const vehicleId = searchParams.get("vehicleId") || undefined;
    const category = searchParams.get("category") || undefined;

    const records = await db.vehicleMaintenanceRecord.findMany({
      where: {
        ...(vehicleId ? { vehicleId } : {}),
        ...(category ? { serviceCategory: category } : {}),
      },
      include: {
        vehicle: { select: { id: true, vehicleNumber: true, make: true, model: true } },
      },
      orderBy: { serviceDate: "desc" },
    });

    return NextResponse.json({ success: true, data: records });
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
    await requirePermission(session, "fleet", "create");

    const body = await req.json();
    const parsed = createVehicleMaintenanceSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const input = parsed.data;
    const parts = new Prisma.Decimal(input.partsCost);
    const labour = new Prisma.Decimal(input.labourCost);
    const tax = new Prisma.Decimal(input.taxAmount);
    const totalCost = parts.plus(labour).plus(tax);
    const currentOdo = new Prisma.Decimal(input.odometerReading);
    const serviceDate = input.serviceDate ? new Date(input.serviceDate) : new Date();

    const recordNumber = await generateNextDocumentNumber("VMR");

    const record = await db.$transaction(async (tx) => {
      let journalId: string | null = null;

      // Double-entry General Ledger posting to Account 5035 (Vehicle Servicing & Maintenance)
      if (input.postToAccounts && totalCost.gt(0)) {
        const expenseAccount =
          (await getSystemAccount("5035", tx)) ||
          (await getSystemAccount("5030", tx)) ||
          (await getSystemAccount("5040", tx));

        const paymentAccount = input.paidFromAccountId
          ? await tx.chartOfAccount.findUnique({ where: { id: input.paidFromAccountId } })
          : input.paymentMode === "CASH"
          ? await getSystemAccount("1010", tx)
          : await getSystemAccount("1020", tx);

        if (expenseAccount && paymentAccount) {
          const vehicle = await tx.vehicle.findUnique({ where: { id: input.vehicleId } });
          const journal = await postJournalEntry(
            {
              journalType: "PAYMENT",
              postingDate: serviceDate,
              fiscalYear: getCurrentFiscalYear(),
              narration: `Vehicle Maintenance & Servicing for ${vehicle?.vehicleNumber || input.vehicleId} - ${input.serviceCategory} (${input.descriptionOfWork})`,
              referenceDocumentType: "VEHICLE_MAINTENANCE",
              referenceDocumentId: recordNumber,
              referenceNumber: recordNumber,
              lines: [
                {
                  accountId: expenseAccount.id,
                  description: `Maintenance (${input.serviceCategory}): ${input.descriptionOfWork}`,
                  debitAmount: totalCost,
                  creditAmount: new Prisma.Decimal(0),
                },
                {
                  accountId: paymentAccount.id,
                  description: `Payment for maintenance - ${vehicle?.vehicleNumber}`,
                  debitAmount: new Prisma.Decimal(0),
                  creditAmount: totalCost,
                },
              ],
            },
            {
              id: session!.id,
              name: session!.name,
              role: session!.role,
              ipAddress: req.headers.get("x-forwarded-for") || undefined,
            },
            tx
          );
          journalId = journal.id;
        }
      }

      const remarksParts = [input.remarks?.trim()];
      if (input.invoiceNumber) remarksParts.unshift(`Invoice: ${input.invoiceNumber.trim()}`);
      if (input.aiScanned) remarksParts.push("[AI Extracted & User Verified]");
      const combinedRemarks = remarksParts.filter(Boolean).join(" | ");

      const created = await tx.vehicleMaintenanceRecord.create({
        data: {
          recordNumber,
          vehicleId: input.vehicleId,
          serviceCategory: input.serviceCategory,
          serviceDate,
          odometerReading: currentOdo,
          serviceProvider: input.serviceProvider || null,
          descriptionOfWork: input.descriptionOfWork,
          partsCost: parts,
          labourCost: labour,
          taxAmount: tax,
          totalCost,
          invoiceDocumentUrl: input.invoiceDocumentUrl || null,
          nextServiceDate: input.nextServiceDate ? new Date(input.nextServiceDate) : null,
          nextServiceOdometer: input.nextServiceOdometer != null ? input.nextServiceOdometer : null,
          remarks: combinedRemarks || null,
          status: "COMPLETED",
          journalEntryId: journalId,
        },
      });

      // Update vehicle current odometer if higher
      const v = await tx.vehicle.findUnique({ where: { id: input.vehicleId } });
      if (v && currentOdo.gt(new Prisma.Decimal(v.currentOdometer))) {
        await tx.vehicle.update({
          where: { id: input.vehicleId },
          data: { currentOdometer: currentOdo },
        });
      }

      return created;
    });

    await logAuditEvent({
      userId: session!.id,
      userName: session!.name,
      userRole: session!.role,
      action: "CREATE",
      module: "fleet",
      entityType: "VehicleMaintenanceRecord",
      entityId: record.id,
      afterState: record,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json(
      {
        success: true,
        data: record,
        message: `Maintenance record ${record.recordNumber} recorded successfully.`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[FleetMaintenance POST Error]", error);
    const status = error.message?.startsWith("UNAUTHORIZED")
      ? 401
      : error.message?.startsWith("FORBIDDEN")
      ? 403
      : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
