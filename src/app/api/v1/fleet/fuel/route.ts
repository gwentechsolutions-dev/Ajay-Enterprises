import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber, getCurrentFiscalYear } from "@/lib/document-series";
import { postJournalEntry, getSystemAccount } from "@/lib/accounting/ledger";
import { logAuditEvent } from "@/lib/audit";
import { createVehicleFuelLogSchema } from "@/lib/schemas/fleet";
import { validationErrorResponse } from "@/lib/api-validation";
import {
  validateOdometerProgression,
  checkDuplicateFuelReceipt,
  crossCheckFuelAmount,
  MIN_PLAUSIBLE_KM_PER_LITRE,
  MAX_PLAUSIBLE_KM_PER_LITRE,
} from "@/lib/fleet/fuel-calculations";

// ==============================================================================
// INVENTRA: FLEET FUEL MANAGEMENT API
// ==============================================================================

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "fleet", "view");

    const { searchParams } = new URL(req.url);
    const vehicleId = searchParams.get("vehicleId") || undefined;
    const startDate = searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : undefined;
    const endDate = searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : undefined;

    const fuelLogs = await db.vehicleFuelLog.findMany({
      where: {
        ...(vehicleId ? { vehicleId } : {}),
        ...(startDate || endDate
          ? {
              fuelDate: {
                ...(startDate ? { gte: startDate } : {}),
                ...(endDate ? { lte: endDate } : {}),
              },
            }
          : {}),
      },
      include: {
        vehicle: { select: { id: true, vehicleNumber: true, make: true, model: true, fuelType: true } },
        driver: { select: { id: true, name: true, driverCode: true } },
      },
      orderBy: { fuelDate: "desc" },
    });

    return NextResponse.json({ success: true, data: fuelLogs });
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
    const parsed = createVehicleFuelLogSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const input = parsed.data;
    const qty = new Prisma.Decimal(input.quantityLitres);
    const rate = new Prisma.Decimal(input.pricePerUnit);
    const totalCost = qty.times(rate);
    const currentOdoNum = Number(input.odometerReading);
    const fuelDate = input.fuelDate ? new Date(input.fuelDate) : new Date();

    // 1. Chronological Odometer Validation
    const odoValidation = await validateOdometerProgression({
      vehicleId: input.vehicleId,
      currentOdometer: currentOdoNum,
      entryDate: fuelDate,
      allowOdometerReset: input.allowOdometerReset,
    });

    if (!odoValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: odoValidation.errors.join(" "),
            code: "ODOMETER_REGRESSION",
            requiresResetConfirmation: true,
          },
        },
        { status: 422 }
      );
    }

    // 2. Duplicate Receipt Detection
    const duplicateCheck = await checkDuplicateFuelReceipt({
      vehicleId: input.vehicleId,
      receiptNumber: input.receiptNumber,
      totalCost: Number(totalCost),
      fuelDate,
    });

    if (duplicateCheck.isDuplicate) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: duplicateCheck.reason || "Possible duplicate fuel receipt detected.",
            code: "POSSIBLE_DUPLICATE",
            duplicateLogNumber: duplicateCheck.duplicateLogNumber,
            duplicateDate: duplicateCheck.duplicateDate,
          },
        },
        { status: 409 }
      );
    }

    const warnings: string[] = [...odoValidation.warnings];

    // 3. Amount cross check
    const amountCheck = crossCheckFuelAmount({
      quantity: Number(qty),
      pricePerUnit: Number(rate),
      totalAmount: Number(totalCost),
    });
    if (!amountCheck.consistent) {
      warnings.push(
        `Quantity × Rate (₹${amountCheck.expectedAmount}) differs slightly from total amount.`
      );
    }

    const logNumber = await generateNextDocumentNumber("FUEL");

    const createdLog = await db.$transaction(async (tx) => {
      // Find latest previous fuel log before this entry date
      const lastLog = await tx.vehicleFuelLog.findFirst({
        where: {
          vehicleId: input.vehicleId,
          fuelDate: { lte: fuelDate },
        },
        orderBy: { fuelDate: "desc" },
      });

      let distanceSinceLast: Prisma.Decimal | null = null;
      let mileageKmPerLitre: Prisma.Decimal | null = null;
      let costPerKm: Prisma.Decimal | null = null;

      if (lastLog) {
        const prevOdo = new Prisma.Decimal(lastLog.odometerReading);
        const currOdo = new Prisma.Decimal(currentOdoNum);

        if (currOdo.gt(prevOdo)) {
          distanceSinceLast = currOdo.minus(prevOdo);

          // Mileage is calculated between full-tank fills
          if (qty.gt(0)) {
            mileageKmPerLitre = distanceSinceLast.dividedBy(qty);
            costPerKm = totalCost.dividedBy(distanceSinceLast);

            const mVal = Number(mileageKmPerLitre);
            if (mVal < MIN_PLAUSIBLE_KM_PER_LITRE || mVal > MAX_PLAUSIBLE_KM_PER_LITRE) {
              warnings.push(
                `Calculated mileage (${mVal.toFixed(1)} km/L) is unusually ${mVal < MIN_PLAUSIBLE_KM_PER_LITRE ? "low" : "high"}. Please confirm fuel quantity and odometer readings.`
              );
            }
          }
        }
      }

      // Accounting Journal Entry (Account 5030 - Transport & Vehicle Fuel Costs)
      let journalId: string | null = null;
      if (input.postToAccounts) {
        const fuelExpenseAccount =
          (await getSystemAccount("5030", tx)) ||
          (await getSystemAccount("5040", tx));

        const paymentAccount = input.paidFromAccountId
          ? await tx.chartOfAccount.findUnique({ where: { id: input.paidFromAccountId } })
          : input.paymentMode === "CASH"
          ? await getSystemAccount("1010", tx)
          : await getSystemAccount("1020", tx);

        if (fuelExpenseAccount && paymentAccount) {
          const vehicle = await tx.vehicle.findUnique({ where: { id: input.vehicleId } });
          const journal = await postJournalEntry(
            {
              journalType: "PAYMENT",
              postingDate: fuelDate,
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

      // Format remarks with receipt number and AI metadata
      const remarksParts = [input.remarks?.trim()];
      if (input.receiptNumber) {
        remarksParts.unshift(`Receipt: ${input.receiptNumber.trim()}`);
      }
      if (input.aiScanned) {
        remarksParts.push("[AI Extracted & User Verified]");
      }
      const combinedRemarks = remarksParts.filter(Boolean).join(" | ");

      // Primary document URL (receipt > meter > odometer)
      const primaryDocUrl =
        input.receiptDocumentUrl || input.meterDocumentUrl || input.odometerDocumentUrl || null;

      const log = await tx.vehicleFuelLog.create({
        data: {
          logNumber,
          vehicleId: input.vehicleId,
          driverId: input.driverId || null,
          fuelDate,
          fuelType: input.fuelType,
          fuelStation: input.fuelStation || null,
          quantityLitres: qty,
          pricePerUnit: rate,
          totalCost,
          odometerReading: new Prisma.Decimal(currentOdoNum),
          isFullTank: input.isFullTank,
          distanceSinceLast,
          mileageKmPerLitre,
          costPerKm,
          receiptDocumentUrl: primaryDocUrl,
          remarks: combinedRemarks || null,
          journalEntryId: journalId,
        },
      });

      // Update vehicle's current odometer if new reading is higher
      const v = await tx.vehicle.findUnique({ where: { id: input.vehicleId } });
      if (v && new Prisma.Decimal(currentOdoNum).gt(new Prisma.Decimal(v.currentOdometer))) {
        await tx.vehicle.update({
          where: { id: input.vehicleId },
          data: { currentOdometer: new Prisma.Decimal(currentOdoNum) },
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

    return NextResponse.json(
      {
        success: true,
        data: createdLog,
        warnings,
        message: `Fuel log ${createdLog.logNumber} recorded successfully.`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[FleetFuel POST Error]", error);
    const status = error.message?.startsWith("UNAUTHORIZED")
      ? 401
      : error.message?.startsWith("FORBIDDEN")
      ? 403
      : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
