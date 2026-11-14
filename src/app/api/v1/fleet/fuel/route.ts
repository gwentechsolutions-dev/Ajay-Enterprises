import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber, getCurrentFiscalYear } from "@/lib/document-series";
import { postJournalEntry, getSystemAccount } from "@/lib/accounting/ledger";
import { logAuditEvent } from "@/lib/audit";
import { createVehicleFuelLogSchema } from "@/lib/schemas/fleet";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "fleet", "view");

    const { searchParams } = new URL(req.url);
    const vehicleId = searchParams.get("vehicleId") || undefined;

    const fuelLogs = await db.vehicleFuelLog.findMany({
      where: vehicleId ? { vehicleId } : undefined,
      include: {
        vehicle: { select: { id: true, vehicleNumber: true, make: true, model: true } },
        driver: { select: { id: true, name: true, driverCode: true } },
      },
      orderBy: { fuelDate: "desc" },
    });

    return NextResponse.json({ success: true, data: fuelLogs });
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
    const parsed = createVehicleFuelLogSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const qty = new Prisma.Decimal(input.quantityLitres);
    const rate = new Prisma.Decimal(input.pricePerUnit);
    const totalCost = qty.times(rate);
    const currentOdo = new Prisma.Decimal(input.odometerReading);

    const logNumber = await generateNextDocumentNumber("FUEL");

    const createdLog = await db.$transaction(async (tx) => {
      // Find previous fuel log for mileage calculation
      const lastLog = await tx.vehicleFuelLog.findFirst({
        where: { vehicleId: input.vehicleId },
        orderBy: { fuelDate: "desc" },
      });

      let distanceSinceLast: Prisma.Decimal | null = null;
      let mileageKmPerLitre: Prisma.Decimal | null = null;
      let costPerKm: Prisma.Decimal | null = null;

      if (lastLog && input.isFullTank && lastLog.isFullTank) {
        const prevOdo = new Prisma.Decimal(lastLog.odometerReading);
        if (currentOdo.gt(prevOdo)) {
          distanceSinceLast = currentOdo.minus(prevOdo);
          if (qty.gt(0)) {
            mileageKmPerLitre = distanceSinceLast.dividedBy(qty);
            costPerKm = totalCost.dividedBy(distanceSinceLast);
          }
        }
      }

      // Accounting Journal Entry (Account 5040 Vehicle Fuel & Maintenance)
      let journalId: string | null = null;
      if (input.postToAccounts) {
        const fuelExpenseAccount = await getSystemAccount("5040", tx);
        const paymentAccount = input.paidFromAccountId
          ? await tx.chartOfAccount.findUnique({ where: { id: input.paidFromAccountId } })
          : await getSystemAccount("1010", tx); // Default cash

        if (fuelExpenseAccount && paymentAccount) {
          const vehicle = await tx.vehicle.findUnique({ where: { id: input.vehicleId } });
          const journal = await postJournalEntry(
            {
              journalType: "PAYMENT",
              postingDate: input.fuelDate ? new Date(input.fuelDate) : new Date(),
              fiscalYear: getCurrentFiscalYear(),
              narration: `Fuel purchase for vehicle ${vehicle?.vehicleNumber || input.vehicleId} (${qty.toString()} L @ ₹${rate.toString()})`,
              referenceDocumentType: "FUEL_LOG",
              referenceDocumentId: logNumber,
              referenceNumber: logNumber,
              lines: [
                {
                  accountId: fuelExpenseAccount.id,
                  description: `Fuel purchase (${input.fuelType}) for ${vehicle?.vehicleNumber}`,
                  debitAmount: totalCost,
                  creditAmount: new Prisma.Decimal(0),
                },
                {
                  accountId: paymentAccount.id,
                  description: `Payment for fuel - ${vehicle?.vehicleNumber}`,
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

      const log = await tx.vehicleFuelLog.create({
        data: {
          logNumber,
          vehicleId: input.vehicleId,
          driverId: input.driverId || null,
          fuelDate: input.fuelDate ? new Date(input.fuelDate) : new Date(),
          fuelType: input.fuelType,
          fuelStation: input.fuelStation || null,
          quantityLitres: qty,
          pricePerUnit: rate,
          totalCost,
          odometerReading: currentOdo,
          isFullTank: input.isFullTank,
          distanceSinceLast,
          mileageKmPerLitre,
          costPerKm,
          receiptDocumentUrl: input.receiptDocumentUrl || null,
          remarks: input.remarks || null,
          journalEntryId: journalId,
        },
      });

      // Update vehicle's current odometer if new reading is higher
      const v = await tx.vehicle.findUnique({ where: { id: input.vehicleId } });
      if (v && currentOdo.gt(new Prisma.Decimal(v.currentOdometer))) {
        await tx.vehicle.update({
          where: { id: input.vehicleId },
          data: { currentOdometer: currentOdo },
        });
      }

      return log;
    });

    await logAuditEvent({
      userId: session!.id,
      userName: session!.name,
      userRole: session!.role,
      action: "CREATE",
      module: "fleet",
      entityType: "VehicleFuelLog",
      entityId: createdLog.id,
      afterState: createdLog,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true, data: createdLog, message: `Fuel log ${createdLog.logNumber} recorded.` }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

