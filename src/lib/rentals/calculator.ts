import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { CalculateStatementInput } from "@/lib/schemas/rental";

export interface DayDetailCalculation {
  rentalBatchId: string;
  batchNumber: string;
  calculationDate: Date;
  dateStr: string;
  eligibleQuantity: Prisma.Decimal;
  dailyRate: Prisma.Decimal;
  dayAmount: Prisma.Decimal;
  isDeliveryDay: boolean;
  isReturnDay: boolean;
  explanation: string;
}

export interface StatementItemCalculation {
  customerSiteId: string;
  siteName: string;
  materialVariantId: string;
  materialName: string;
  materialCode: string;
  uom: string;
  rentalBatchId: string;
  batchNumber: string;
  ownershipType: string;
  openingHeldQty: Prisma.Decimal;
  newDeliveredQty: Prisma.Decimal;
  returnedQty: Prisma.Decimal;
  damagedQty: Prisma.Decimal;
  missingQty: Prisma.Decimal;
  closingHeldQty: Prisma.Decimal;
  billableDays: number;
  applicableDailyRate: Prisma.Decimal;
  rentalAmount: Prisma.Decimal;
  dayDetails: DayDetailCalculation[];
}

export interface SiteSummaryCalculation {
  customerSiteId: string;
  siteName: string;
  siteCode: string;
  rentalAmount: Prisma.Decimal;
  damageCharges: Prisma.Decimal;
  missingCharges: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  itemCount: number;
}

export interface CalculatedStatementResult {
  billingMode: "SITE_WISE" | "CONSOLIDATED";
  customerId: string;
  customerName: string;
  customerCode: string;
  customerSiteId: string | null;
  periodStartDate: string;
  periodEndDate: string;
  totalRentalAmount: Prisma.Decimal;
  totalDamageCharges: Prisma.Decimal;
  totalMissingCharges: Prisma.Decimal;
  totalAdjustments: Prisma.Decimal;
  netPayableAmount: Prisma.Decimal;
  previousBalanceInformational: Prisma.Decimal;
  items: StatementItemCalculation[];
  siteSummaries: SiteSummaryCalculation[];
  totalBillableDays: number;
}

/**
 * Normalizes a Date or date string to UTC midnight (YYYY-MM-DD 00:00:00Z)
 */
function normalizeDate(dateInput: Date | string): Date {
  const d = typeof dateInput === "string" ? new Date(dateInput) : new Date(dateInput);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

/**
 * Formats a Date to YYYY-MM-DD
 */
function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

/**
 * Generates an array of daily dates between start and end inclusive
 */
function getDaysInRange(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const curr = new Date(start.getTime());
  while (curr.getTime() <= end.getTime()) {
    days.push(new Date(curr.getTime()));
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return days;
}

/**
 * Core Deterministic Daily Rental Calculation Engine
 */
export async function calculateRentalStatement(
  input: CalculateStatementInput
): Promise<CalculatedStatementResult> {
  const startDate = normalizeDate(input.periodStartDate);
  const endDate = normalizeDate(input.periodEndDate);

  if (startDate > endDate) {
    throw new Error("Period start date cannot be after period end date.");
  }

  // Fetch Customer
  const customer = await db.customer.findUnique({
    where: { id: input.customerId },
    select: { id: true, name: true, customerCode: true },
  });
  if (!customer) {
    throw new Error(`Customer '${input.customerId}' not found.`);
  }

  // Determine target customer sites
  let targetSiteIds: string[] = [];
  if (input.billingMode === "SITE_WISE") {
    if (!input.customerSiteId) {
      throw new Error("customerSiteId is required for SITE_WISE billing mode.");
    }
    targetSiteIds = [input.customerSiteId];
  } else {
    // CONSOLIDATED mode: query all active sites for customer or use specified site IDs
    if (input.customerSiteIds && input.customerSiteIds.length > 0) {
      targetSiteIds = input.customerSiteIds;
    } else {
      const sites = await db.customerSite.findMany({
        where: { customerId: input.customerId },
        select: { id: true },
      });
      targetSiteIds = sites.map((s) => s.id);
    }
  }

  if (targetSiteIds.length === 0) {
    throw new Error("No eligible customer sites found for billing calculation.");
  }

  // Query batches for all target sites
  const batches = await db.rentalBatch.findMany({
    where: {
      customerId: input.customerId,
      customerSiteId: { in: targetSiteIds },
      // Include any batch delivered on or before the period end date
      deliveryDate: { lte: new Date(endDate.getTime() + 86400000) },
    },
    include: {
      materialVariant: {
        select: { id: true, name: true, materialCode: true, uom: true },
      },
      customerSite: {
        select: { id: true, siteName: true, siteCode: true },
      },
      returnAllocations: {
        include: {
          materialReturnNote: {
            select: { mrnNumber: true },
          },
        },
      },
    },
    orderBy: [{ customerSiteId: "asc" }, { deliveryDate: "asc" }],
  });

  const periodDays = getDaysInRange(startDate, endDate);
  const dayBeforeStart = new Date(startDate.getTime() - 86400000);

  const calculatedItems: StatementItemCalculation[] = [];
  let aggregateRentalTotal = new Prisma.Decimal(0);

  for (const batch of batches) {
    const bDelivDate = normalizeDate(batch.deliveryDate);
    const deliveredQty = new Prisma.Decimal(batch.deliveredQty);
    const rate = new Prisma.Decimal(batch.applicableDailyRate);

    // Compute opening held qty on the day immediately prior to periodStartDate
    let openingHeld = new Prisma.Decimal(0);
    if (bDelivDate.getTime() <= dayBeforeStart.getTime()) {
      let returnsPrior = new Prisma.Decimal(0);
      for (const alloc of batch.returnAllocations) {
        const retDate = normalizeDate(alloc.returnDate);
        if (retDate.getTime() < dayBeforeStart.getTime()) {
          returnsPrior = returnsPrior.plus(alloc.allocatedReturnedQty);
        } else if (retDate.getTime() === dayBeforeStart.getTime()) {
          // If includeReturnDate is FALSE, the return took effect on returnDate itself
          if (!alloc.includeReturnDate) {
            returnsPrior = returnsPrior.plus(alloc.allocatedReturnedQty);
          }
        }
      }
      openingHeld = deliveredQty.minus(returnsPrior);
      if (openingHeld.lt(0)) openingHeld = new Prisma.Decimal(0);
    }

    // New deliveries during this period
    let newDelivered = new Prisma.Decimal(0);
    if (bDelivDate >= startDate && bDelivDate <= endDate) {
      newDelivered = deliveredQty;
    }

    // Returns during this period
    let periodReturns = new Prisma.Decimal(0);
    let periodDamaged = new Prisma.Decimal(0);
    let periodMissing = new Prisma.Decimal(0);

    for (const alloc of batch.returnAllocations) {
      const retDate = normalizeDate(alloc.returnDate);
      if (retDate >= startDate && retDate <= endDate) {
        periodReturns = periodReturns.plus(alloc.allocatedReturnedQty);
        periodDamaged = periodDamaged.plus(alloc.allocatedDamagedQty);
        periodMissing = periodMissing.plus(alloc.allocatedMissingQty);
      }
    }

    // Calculate day-by-day detail
    const dayDetails: DayDetailCalculation[] = [];
    let batchRentalAmount = new Prisma.Decimal(0);
    let billableDaysCount = 0;

    for (const day of periodDays) {
      const dayTime = day.getTime();

      // Check if delivered yet
      if (dayTime < bDelivDate.getTime()) {
        continue; // batch did not exist yet
      }

      // Check Delivery Date inclusion rule
      if (dayTime === bDelivDate.getTime() && !batch.includeDeliveryDate) {
        // Delivery date excluded: 0 units billed on delivery date
        dayDetails.push({
          rentalBatchId: batch.id,
          batchNumber: batch.batchNumber,
          calculationDate: day,
          dateStr: formatDate(day),
          eligibleQuantity: new Prisma.Decimal(0),
          dailyRate: rate,
          dayAmount: new Prisma.Decimal(0),
          isDeliveryDay: true,
          isReturnDay: false,
          explanation: `Delivery date excluded by policy (includeDeliveryDate = false)`,
        });
        continue;
      }

      // Calculate effective returns on this day
      let effectiveReturns = new Prisma.Decimal(0);
      let isDayOfReturn = false;

      for (const alloc of batch.returnAllocations) {
        const retTime = normalizeDate(alloc.returnDate).getTime();

        if (dayTime > retTime) {
          // Return occurred prior to today -> always reduces quantity today
          effectiveReturns = effectiveReturns.plus(alloc.allocatedReturnedQty);
        } else if (dayTime === retTime) {
          isDayOfReturn = true;
          // Return happened today
          if (!alloc.includeReturnDate) {
            // Return date is NOT billable: return takes effect immediately today
            effectiveReturns = effectiveReturns.plus(alloc.allocatedReturnedQty);
          }
          // If includeReturnDate is TRUE, returned units are STILL billable today,
          // so they do not reduce quantity today!
        }
      }

      let eligible = deliveredQty.minus(effectiveReturns);
      if (eligible.lt(0)) eligible = new Prisma.Decimal(0);

      const dayAmount = eligible.times(rate);

      if (eligible.gt(0)) {
        billableDaysCount++;
        batchRentalAmount = batchRentalAmount.plus(dayAmount);
      }

      dayDetails.push({
        rentalBatchId: batch.id,
        batchNumber: batch.batchNumber,
        calculationDate: day,
        dateStr: formatDate(day),
        eligibleQuantity: eligible,
        dailyRate: rate,
        dayAmount,
        isDeliveryDay: dayTime === bDelivDate.getTime(),
        isReturnDay: isDayOfReturn,
        explanation: `${eligible.toString()} ${batch.materialVariant.uom} × ₹${rate.toFixed(2)} = ₹${dayAmount.toFixed(2)}`,
      });
    }

    // Closing held quantity at end of period
    let totalReturnsUpToEnd = new Prisma.Decimal(0);
    for (const alloc of batch.returnAllocations) {
      const retDate = normalizeDate(alloc.returnDate);
      if (retDate <= endDate) {
        totalReturnsUpToEnd = totalReturnsUpToEnd.plus(alloc.allocatedReturnedQty);
      }
    }
    let closingHeld = deliveredQty.minus(totalReturnsUpToEnd);
    if (closingHeld.lt(0)) closingHeld = new Prisma.Decimal(0);

    // Only include in statement if there were billable days, opening held, or new deliveries
    if (billableDaysCount > 0 || openingHeld.gt(0) || newDelivered.gt(0)) {
      calculatedItems.push({
        customerSiteId: batch.customerSiteId,
        siteName: batch.customerSite.siteName,
        materialVariantId: batch.materialVariantId,
        materialName: batch.materialVariant.name,
        materialCode: batch.materialVariant.materialCode,
        uom: batch.materialVariant.uom,
        rentalBatchId: batch.id,
        batchNumber: batch.batchNumber,
        ownershipType: batch.ownershipType,
        openingHeldQty: openingHeld,
        newDeliveredQty: newDelivered,
        returnedQty: periodReturns,
        damagedQty: periodDamaged,
        missingQty: periodMissing,
        closingHeldQty: closingHeld,
        billableDays: billableDaysCount,
        applicableDailyRate: rate,
        rentalAmount: batchRentalAmount,
        dayDetails,
      });

      aggregateRentalTotal = aggregateRentalTotal.plus(batchRentalAmount);
    }
  }

  // Damage & Missing Assessments for target sites
  let totalDamageCharges = new Prisma.Decimal(0);
  let totalMissingCharges = new Prisma.Decimal(0);

  const assessments = await db.damageLossAssessment.findMany({
    where: {
      customerId: input.customerId,
      customerSiteId: { in: targetSiteIds },
      assessmentDate: {
        gte: startDate,
        lte: new Date(endDate.getTime() + 86400000),
      },
      status: "APPROVED",
    },
  });

  if (input.includeDamageCharges) {
    for (const a of assessments) {
      if (a.assessmentType === "DAMAGED_REPAIRABLE" || a.assessmentType === "DAMAGED_SCRAP") {
        totalDamageCharges = totalDamageCharges.plus(a.approvedChargeAmount);
      }
    }
  }

  if (input.includeMissingCharges) {
    for (const a of assessments) {
      if (a.assessmentType === "MISSING") {
        totalMissingCharges = totalMissingCharges.plus(a.approvedChargeAmount);
      }
    }
  }

  const adjustments = new Prisma.Decimal(input.adjustments || 0);
  const prevBal = new Prisma.Decimal(input.previousBalanceInformational || 0);
  const netPayable = aggregateRentalTotal
    .plus(totalDamageCharges)
    .plus(totalMissingCharges)
    .plus(adjustments);

  // Group by site for siteSummaries
  const siteMap = new Map<string, SiteSummaryCalculation>();

  for (const item of calculatedItems) {
    const s = siteMap.get(item.customerSiteId) || {
      customerSiteId: item.customerSiteId,
      siteName: item.siteName,
      siteCode: "",
      rentalAmount: new Prisma.Decimal(0),
      damageCharges: new Prisma.Decimal(0),
      missingCharges: new Prisma.Decimal(0),
      totalAmount: new Prisma.Decimal(0),
      itemCount: 0,
    };

    s.rentalAmount = s.rentalAmount.plus(item.rentalAmount);
    s.itemCount++;
    siteMap.set(item.customerSiteId, s);
  }

  // Distribute damages/missing per site if applicable
  for (const a of assessments) {
    const s = siteMap.get(a.customerSiteId);
    if (s) {
      if (a.assessmentType === "MISSING") {
        s.missingCharges = s.missingCharges.plus(a.approvedChargeAmount);
      } else {
        s.damageCharges = s.damageCharges.plus(a.approvedChargeAmount);
      }
    }
  }

  const siteSummaries: SiteSummaryCalculation[] = [];
  for (const s of siteMap.values()) {
    s.totalAmount = s.rentalAmount.plus(s.damageCharges).plus(s.missingCharges);
    siteSummaries.push(s);
  }

  return {
    billingMode: input.billingMode,
    customerId: input.customerId,
    customerName: customer.name,
    customerCode: customer.customerCode,
    customerSiteId: input.billingMode === "SITE_WISE" ? input.customerSiteId || null : null,
    periodStartDate: formatDate(startDate),
    periodEndDate: formatDate(endDate),
    totalRentalAmount: aggregateRentalTotal,
    totalDamageCharges,
    totalMissingCharges,
    totalAdjustments: adjustments,
    netPayableAmount: netPayable,
    previousBalanceInformational: prevBal,
    items: calculatedItems,
    siteSummaries,
    totalBillableDays: calculatedItems.reduce((acc, it) => acc + it.billableDays, 0),
  };
}

