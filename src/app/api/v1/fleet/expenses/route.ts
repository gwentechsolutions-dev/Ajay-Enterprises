import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber, getCurrentFiscalYear } from "@/lib/document-series";
import { postJournalEntry, getSystemAccount } from "@/lib/accounting/ledger";
import { logAuditEvent } from "@/lib/audit";
import { createVehicleExpenseSchema } from "@/lib/schemas/fleet";
import { validationErrorResponse } from "@/lib/api-validation";

// ==============================================================================
// INVENTRA: GENERAL VEHICLE EXPENSE TRANSACTIONS API
// ==============================================================================

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "fleet", "view");

    const { searchParams } = new URL(req.url);
    const vehicleId = searchParams.get("vehicleId") || undefined;
    const category = searchParams.get("category") || undefined;

    const expenses = await db.vehicleExpense.findMany({
      where: {
        ...(vehicleId ? { vehicleId } : {}),
        ...(category ? { expenseCategory: category } : {}),
      },
      include: {
        vehicle: { select: { id: true, vehicleNumber: true, make: true, model: true } },
        supplier: { select: { id: true, name: true, supplierCode: true } },
      },
      orderBy: { expenseDate: "desc" },
    });

    return NextResponse.json({ success: true, data: expenses });
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
    const parsed = createVehicleExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const input = parsed.data;
    const amount = new Prisma.Decimal(input.amount);
    const tax = new Prisma.Decimal(input.taxAmount);
    const totalAmount = amount.plus(tax);
    const expenseDate = input.expenseDate ? new Date(input.expenseDate) : new Date();

    const expenseNumber = await generateNextDocumentNumber("VEH_EXP");

    const expense = await db.$transaction(async (tx) => {
      let journalId: string | null = null;

      // Check if linked to an existing maintenance record that already posted to accounts
      if (input.maintenanceRecordId) {
        const existingMaint = await tx.vehicleMaintenanceRecord.findUnique({
          where: { id: input.maintenanceRecordId },
          select: { journalEntryId: true },
        });
        if (existingMaint?.journalEntryId) {
          journalId = existingMaint.journalEntryId;
        }
      }

      // If no existing journal, post double-entry voucher
      if (!journalId) {
        // Map account: 5035 for servicing & maintenance, 5030 for general running/fleet
        const isMaintenanceCategory = [
          "REPAIR_MAINTENANCE",
          "VEHICLE_SERVICING",
          "MECHANICAL_REPAIR",
          "ELECTRICAL_REPAIR",
          "TYRES_BATTERIES",
          "SPARE_PARTS",
        ].includes(input.expenseCategory);

        const targetAccountCode = isMaintenanceCategory ? "5035" : "5030";
        const expenseAccount =
          (await getSystemAccount(targetAccountCode, tx)) ||
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
              postingDate: expenseDate,
              fiscalYear: getCurrentFiscalYear(),
              narration: `Vehicle Expense for ${vehicle?.vehicleNumber || input.vehicleId} (${input.expenseCategory}): ${input.description}`,
              referenceDocumentType: "VEHICLE_EXPENSE",
              referenceDocumentId: expenseNumber,
              referenceNumber: expenseNumber,
              lines: [
                {
                  accountId: expenseAccount.id,
                  description: `Vehicle Expense [${input.expenseCategory}] - ${input.description}`,
                  debitAmount: totalAmount,
                  creditAmount: new Prisma.Decimal(0),
                },
                {
                  accountId: paymentAccount.id,
                  description: `Payment for ${expenseNumber}`,
                  debitAmount: new Prisma.Decimal(0),
                  creditAmount: totalAmount,
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

      const descriptionText = input.aiScanned
        ? `${input.description} [AI Extracted & User Verified]`
        : input.description;

      const created = await tx.vehicleExpense.create({
        data: {
          expenseNumber,
          vehicleId: input.vehicleId,
          tripId: input.tripId || null,
          expenseCategory: input.expenseCategory,
          expenseDate,
          amount,
          taxAmount: tax,
          totalAmount,
          paymentMode: input.paymentMode,
          paymentReference: input.paymentReference || null,
          paidFromAccountId: input.paidFromAccountId || null,
          supplierId: input.supplierId || null,
          itcEligibility: input.itcEligibility,
          receiptDocumentUrl: input.receiptDocumentUrl || null,
          description: descriptionText,
          status: "POSTED",
          journalEntryId: journalId,
          postedById: session!.id,
          postedAt: new Date(),
        },
      });

      return created;
    });

    await logAuditEvent({
      userId: session!.id,
      userName: session!.name,
      userRole: session!.role,
      action: "CREATE",
      module: "fleet",
      entityType: "VehicleExpense",
      entityId: expense.id,
      afterState: expense,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json(
      {
        success: true,
        data: expense,
        message: `Vehicle expense ${expense.expenseNumber} recorded successfully.`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[FleetExpense POST Error]", error);
    const status = error.message?.startsWith("UNAUTHORIZED")
      ? 401
      : error.message?.startsWith("FORBIDDEN")
      ? 403
      : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
