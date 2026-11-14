import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber, getCurrentFiscalYear } from "@/lib/document-series";
import { postJournalEntry, getSystemAccount } from "@/lib/accounting/ledger";
import { logAuditEvent } from "@/lib/audit";
import { createVehicleMaintenanceSchema } from "@/lib/schemas/fleet";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "fleet", "view");

    const { searchParams } = new URL(req.url);
    const vehicleId = searchParams.get("vehicleId") || undefined;

    const records = await db.vehicleMaintenanceRecord.findMany({
      where: vehicleId ? { vehicleId } : undefined,
      include: {
        vehicle: { select: { id: true, vehicleNumber: true, make: true, model: true } },
      },
      orderBy: { serviceDate: "desc" },
    });

    return NextResponse.json({ success: true, data: records });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
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
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const parts = new Prisma.Decimal(input.partsCost);
    const labour = new Prisma.Decimal(input.labourCost);
    const tax = new Prisma.Decimal(input.taxAmount);
    const totalCost = parts.plus(labour).plus(tax);
    const currentOdo = new Prisma.Decimal(input.odometerReading);

    const recordNumber = await generateNextDocumentNumber("VMR");

    const record = await db.$transaction(async (tx) => {
      let journalId: string | null = null;
      if (input.postToAccounts && totalCost.gt(0)) {
        const expenseAccount = await getSystemAccount("5040", tx);
        const paymentAccount = input.paidFromAccountId
          ? await tx.chartOfAccount.findUnique({ where: { id: input.paidFromAccountId } })
          : await getSystemAccount("1020", tx); // Default bank

        if (expenseAccount && paymentAccount) {
          const vehicle = await tx.vehicle.findUnique({ where: { id: input.vehicleId } });
          const journal = await postJournalEntry(
            {
              journalType: "PAYMENT",
              postingDate: input.serviceDate ? new Date(input.serviceDate) : new Date(),
              fiscalYear: getCurrentFiscalYear(),
              narration: `Vehicle Maintenance & Servicing for ${vehicle?.vehicleNumber || input.vehicleId} - ${input.serviceCategory}`,
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
            { id: session!.id, name: session!.name, role: session!.role, ipAddress: req.headers.get("x-forwarded-for") || undefined },
            tx
          );
          journalId = journal.id;
        }
      }

      const created = await tx.vehicleMaintenanceRecord.create({
        data: {
          recordNumber,
          vehicleId: input.vehicleId,
          serviceCategory: input.serviceCategory,
          serviceDate: input.serviceDate ? new Date(input.serviceDate) : new Date(),
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
          remarks: input.remarks || null,
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

    return NextResponse.json({ success: true, data: record, message: `Maintenance record ${record.recordNumber} saved.` }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

