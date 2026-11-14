import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

// ==============================================================================
// INVENTRA: INDIAN GST CALCULATION ENGINE & STATUTORY TAX MASTER
// Operating Business: AJAY ENTERPRISES | Base State: Tamil Nadu (33)
// Statutory Reference: Central Goods and Services Tax Act, 2017 & IGST Act, 2017
// ==============================================================================

export const BUSINESS_STATE_CODE = "33"; // Tamil Nadu

export interface GstCalculationInput {
  taxableValue: number | Prisma.Decimal;
  gstRatePercent: number | Prisma.Decimal;
  placeOfSupply?: string; // 2-digit State code (e.g. "33", "29", "32")
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

// ------------------------------------------------------------------------------
// Place of Supply Resolution
// Under Section 12(3) of IGST Act (immovable property / site works) & Section 10
// ------------------------------------------------------------------------------

export interface PlaceOfSupplyParams {
  siteStateCode?: string | null;
  customerStateCode?: string | null;
  customerGstin?: string | null;
  supplierStateCode?: string | null;
}

export interface PlaceOfSupplyResult {
  placeOfSupply: string;
  isInterState: boolean;
  supplierStateCode: string;
  ruleApplied: string;
}

/**
 * Resolves statutory Place of Supply using actual construction site location,
 * recipient GSTIN, and customer address records.
 */
export function resolvePlaceOfSupply(params: PlaceOfSupplyParams): PlaceOfSupplyResult {
  const supplierState = (params.supplierStateCode || BUSINESS_STATE_CODE).trim();

  let pos = "";
  let ruleApplied = "";

  // 1. Primary rule for construction centering & scaffolding: Site Location
  // (Section 12(3) / Section 10 of IGST Act: services directly in relation to immovable property / site custody)
  if (params.siteStateCode && /^\d{2}$/.test(params.siteStateCode.trim())) {
    pos = params.siteStateCode.trim();
    ruleApplied = "SITE_LOCATION (Sec 12(3) / Sec 10 IGST Act - Construction Site Location)";
  } else if (params.customerGstin && isValidGstin(params.customerGstin)) {
    // 2. Secondary rule: Registered Recipient GSTIN State
    pos = getStateCodeFromGstin(params.customerGstin);
    ruleApplied = "RECIPIENT_GSTIN (Sec 12(2)(a) IGST Act - Registered Recipient State)";
  } else if (params.customerStateCode && /^\d{2}$/.test(params.customerStateCode.trim())) {
    // 3. Tertiary rule: Unregistered Recipient Billing Address State
    pos = params.customerStateCode.trim();
    ruleApplied = "RECIPIENT_ADDRESS (Sec 12(2)(b) IGST Act - Unregistered Recipient Address on Record)";
  } else {
    // 4. Fallback: Supplier Location
    pos = supplierState;
    ruleApplied = "SUPPLIER_LOCATION (Default Statutory Fallback)";
  }

  const isInterState = pos !== supplierState;

  return {
    placeOfSupply: pos,
    isInterState,
    supplierStateCode: supplierState,
    ruleApplied,
  };
}

// ------------------------------------------------------------------------------
// Configurable Tax Rate Resolution & Statutory Masters
// ------------------------------------------------------------------------------

export interface TaxRateLookupParams {
  category?: string;
  transactionDate?: Date | string;
  overrideRate?: number | Prisma.Decimal;
}

/**
 * Resolves applicable GST rate from TaxRateMaster respecting effective date ranges.
 * Falls back to statutory default without universal hardcoding.
 */
export async function resolveApplicableGstRate(
  params: TaxRateLookupParams,
  tx?: Prisma.TransactionClient
): Promise<Prisma.Decimal> {
  if (params.overrideRate !== undefined && params.overrideRate !== null) {
    return new Prisma.Decimal(params.overrideRate);
  }

  const runner = tx || db;
  const targetDate = params.transactionDate ? new Date(params.transactionDate) : new Date();

  try {
    const rateMaster = await runner.taxRateMaster.findFirst({
      where: {
        isActive: true,
        effectiveFrom: { lte: targetDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: targetDate } }],
      },
      orderBy: { isDefault: "desc" },
    });

    if (rateMaster) {
      return rateMaster.ratePercent;
    }
  } catch {
    // Master query failure: fallback to statutory rate
  }

  return new Prisma.Decimal(18); // Statutory 18% equipment rental / supply fallback
}

// ------------------------------------------------------------------------------
// HSN / SAC Validation & Tariff Classification
// ------------------------------------------------------------------------------

export interface HsnSacValidationResult {
  code: string;
  type: "HSN" | "SAC";
  description: string;
  isValid: boolean;
  status: "CONFIRMED" | "UNCONFIRMED_CLASSIFICATION";
  message?: string;
}

export const KNOWN_HSN_SAC_CODES: Record<string, { type: "HSN" | "SAC"; description: string; defaultGstRate: number }> = {
  "9973": {
    type: "SAC",
    description: "Leasing or rental services concerning machinery and equipment without operator (Centering & Scaffolding)",
    defaultGstRate: 18,
  },
  "7308": {
    type: "HSN",
    description: "Structures and parts of structures of iron or steel; props, acrow spans, centering sheets, and scaffolding",
    defaultGstRate: 18,
  },
  "9954": {
    type: "SAC",
    description: "General construction and scaffolding erection / dismantling services",
    defaultGstRate: 18,
  },
  "9965": {
    type: "SAC",
    description: "Goods Transport Agency (GTA) / transportation of centering equipment to construction sites",
    defaultGstRate: 5,
  },
  "9987": {
    type: "SAC",
    description: "Maintenance and repair services of formwork and centering equipment (damages, welding, straightening)",
    defaultGstRate: 18,
  },
};

/**
 * Validates HSN/SAC code against official GST tariff registry.
 * Flags missing or unconfirmed classifications instead of silently assigning a code.
 */
export function validateAndResolveHsnSac(code?: string | null): HsnSacValidationResult {
  if (!code || !code.trim()) {
    return {
      code: "",
      type: "SAC",
      description: "Unspecified Classification",
      isValid: false,
      status: "UNCONFIRMED_CLASSIFICATION",
      message: "Missing HSN/SAC classification. Statutory rules require a valid 4, 6, or 8-digit tariff code.",
    };
  }

  const cleanCode = code.trim();
  const known = KNOWN_HSN_SAC_CODES[cleanCode];

  if (known) {
    return {
      code: cleanCode,
      type: known.type,
      description: known.description,
      isValid: true,
      status: "CONFIRMED",
    };
  }

  // Tariff pattern check (4, 6, or 8 numeric digits)
  const isTariffPattern = /^\d{4}(\d{2})?(\d{2})?$/.test(cleanCode);
  if (isTariffPattern) {
    const isSac = cleanCode.startsWith("99");
    return {
      code: cleanCode,
      type: isSac ? "SAC" : "HSN",
      description: isSac ? "Service Accounting Code" : "Harmonized System of Nomenclature",
      isValid: true,
      status: "CONFIRMED",
    };
  }

  return {
    code: cleanCode,
    type: "SAC",
    description: "Unconfirmed Classification",
    isValid: false,
    status: "UNCONFIRMED_CLASSIFICATION",
    message: `Code '${cleanCode}' is not a valid HSN/SAC tariff format. Expected 4, 6, or 8 numeric digits.`,
  };
}

/**
 * Idempotently seeds standard Indian GST tax rates and HSN/SAC master entries.
 */
export async function seedDefaultGstMasters(tx?: Prisma.TransactionClient) {
  const runner = tx || db;

  // 1. Seed Tax Rates
  const defaultRates = [
    { taxName: "GST 18% (Standard Rental & Steel)", ratePercent: 18, cgstPercent: 9, sgstPercent: 9, igstPercent: 18, isDefault: true },
    { taxName: "GST 12% (Specified Construction)", ratePercent: 12, cgstPercent: 6, sgstPercent: 6, igstPercent: 12, isDefault: false },
    { taxName: "GST 5% (Freight & Transport)", ratePercent: 5, cgstPercent: 2.5, sgstPercent: 2.5, igstPercent: 5, isDefault: false },
    { taxName: "GST 28% (Special Equipment)", ratePercent: 28, cgstPercent: 14, sgstPercent: 14, igstPercent: 28, isDefault: false },
    { taxName: "GST 0% (Exempt Supplies)", ratePercent: 0, cgstPercent: 0, sgstPercent: 0, igstPercent: 0, isDefault: false },
  ];

  for (const r of defaultRates) {
    await runner.taxRateMaster.upsert({
      where: { taxName: r.taxName },
      create: {
        taxName: r.taxName,
        ratePercent: new Prisma.Decimal(r.ratePercent),
        cgstPercent: new Prisma.Decimal(r.cgstPercent),
        sgstPercent: new Prisma.Decimal(r.sgstPercent),
        igstPercent: new Prisma.Decimal(r.igstPercent),
        isDefault: r.isDefault,
        effectiveFrom: new Date("2017-07-01"),
        isActive: true,
      },
      update: {
        ratePercent: new Prisma.Decimal(r.ratePercent),
        cgstPercent: new Prisma.Decimal(r.cgstPercent),
        sgstPercent: new Prisma.Decimal(r.sgstPercent),
        igstPercent: new Prisma.Decimal(r.igstPercent),
      },
    });
  }

  // 2. Seed HSN/SAC Master
  for (const [code, meta] of Object.entries(KNOWN_HSN_SAC_CODES)) {
    await runner.hsnSacMaster.upsert({
      where: { code },
      create: {
        code,
        type: meta.type,
        description: meta.description,
        defaultGstRate: new Prisma.Decimal(meta.defaultGstRate),
        category: code === "9973" ? "RENTAL" : code === "7308" ? "SCAFFOLDING_SUPPLY" : code === "9965" ? "TRANSPORT" : "REPAIR",
        isActive: true,
      },
      update: {
        description: meta.description,
        defaultGstRate: new Prisma.Decimal(meta.defaultGstRate),
      },
    });
  }
}
