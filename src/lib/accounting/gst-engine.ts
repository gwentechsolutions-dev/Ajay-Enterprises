import { Prisma } from "@prisma/client";

// ==============================================================================
// INVENTRA: INDIAN GST CALCULATION ENGINE
// Operating Business: AJAY ENTERPRISES | Base State: Tamil Nadu (33)
// ==============================================================================

export const BUSINESS_STATE_CODE = "33"; // Tamil Nadu

export interface GstCalculationInput {
  taxableValue: number | Prisma.Decimal;
  gstRatePercent: number | Prisma.Decimal;
  placeOfSupply?: string; // State code (2 digits, e.g. "33", "29", "27")
  supplierStateCode?: string;
  isRcm?: boolean;
}

export interface GstCalculationResult {
  isInterState: boolean;
  taxableValue: Prisma.Decimal;
  gstRatePercent: Prisma.Decimal;
  cgstRatePercent: Prisma.Decimal;
  cgstAmount: Prisma.Decimal;
  sgstRatePercent: Prisma.Decimal;
  sgstAmount: Prisma.Decimal;
  igstRatePercent: Prisma.Decimal;
  igstAmount: Prisma.Decimal;
  totalTaxAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
}

/**
 * Calculates Indian GST breakdown (CGST+SGST vs IGST) with exact decimal precision.
 */
export function calculateGst(input: GstCalculationInput): GstCalculationResult {
  const taxable = new Prisma.Decimal(input.taxableValue);
  const rate = new Prisma.Decimal(input.gstRatePercent);
  const supplierState = (input.supplierStateCode || BUSINESS_STATE_CODE).trim();
  const pos = (input.placeOfSupply || BUSINESS_STATE_CODE).trim();

  // Intra-state when place of supply equals supplier state (e.g. 33 == 33)
  const isInterState = supplierState !== pos;

  if (isInterState) {
    // Inter-State: 100% IGST
    const igstRate = rate;
    const igstRaw = taxable.times(igstRate).dividedBy(100);
    const igstAmount = new Prisma.Decimal(igstRaw.toFixed(2));
    const totalTax = igstAmount;
    const total = taxable.plus(totalTax);

    return {
      isInterState: true,
      taxableValue: taxable,
      gstRatePercent: rate,
      cgstRatePercent: new Prisma.Decimal(0),
      cgstAmount: new Prisma.Decimal(0),
      sgstRatePercent: new Prisma.Decimal(0),
      sgstAmount: new Prisma.Decimal(0),
      igstRatePercent: igstRate,
      igstAmount,
      totalTaxAmount: totalTax,
      totalAmount: total,
    };
  } else {
    // Intra-State: 50% CGST + 50% SGST
    const halfRate = rate.dividedBy(2);
    const cgstRaw = taxable.times(halfRate).dividedBy(100);
    const sgstRaw = taxable.times(halfRate).dividedBy(100);
    const cgstAmount = new Prisma.Decimal(cgstRaw.toFixed(2));
    const sgstAmount = new Prisma.Decimal(sgstRaw.toFixed(2));
    const totalTax = cgstAmount.plus(sgstAmount);
    const total = taxable.plus(totalTax);

    return {
      isInterState: false,
      taxableValue: taxable,
      gstRatePercent: rate,
      cgstRatePercent: halfRate,
      cgstAmount,
      sgstRatePercent: halfRate,
      sgstAmount,
      igstRatePercent: new Prisma.Decimal(0),
      igstAmount: new Prisma.Decimal(0),
      totalTaxAmount: totalTax,
      totalAmount: total,
    };
  }
}

/**
 * Calculates exact rounding off to the nearest whole INR.
 */
export function calculateRoundOff(grandTotalRaw: Prisma.Decimal): {
  roundedTotal: Prisma.Decimal;
  roundOffAmount: Prisma.Decimal;
} {
  const roundedVal = grandTotalRaw.round();
  const diff = roundedVal.minus(grandTotalRaw);
  return {
    roundedTotal: roundedVal,
    roundOffAmount: new Prisma.Decimal(diff.toFixed(2)),
  };
}

/**
 * Validates format of Indian GSTIN (15 characters alphanumeric).
 * 2 state digits + 10 PAN chars + 1 entity code + 1 Z + 1 check character
 */
export function isValidGstin(gstin?: string | null): boolean {
  if (!gstin) return false;
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return regex.test(gstin.trim().toUpperCase());
}

/**
 * Extracts 2-digit state code from GSTIN.
 */
export function getStateCodeFromGstin(gstin?: string | null): string {
  if (!gstin || gstin.trim().length < 2) return BUSINESS_STATE_CODE;
  const code = gstin.trim().substring(0, 2);
  return /^\d{2}$/.test(code) ? code : BUSINESS_STATE_CODE;
}

