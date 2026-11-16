import { Prisma } from "@prisma/client";
import { db } from "./db";

export const DOCUMENT_TYPES = [
  { id: "DN", label: "Delivery Note (DN)", defaultPrefix: "AE/DN/" },
  { id: "MRN", label: "Material Return Note (MRN)", defaultPrefix: "AE/MRN/" },
  { id: "STN", label: "Stock Transfer Note (STN)", defaultPrefix: "AE/STN/" },
  { id: "HDN", label: "Hiring Delivery Note (HDN)", defaultPrefix: "AE/HDN/" },
  { id: "HRN", label: "Hiring Return Note (HRN)", defaultPrefix: "AE/HRN/" },
  { id: "INV_RENTAL", label: "Monthly Rental Invoice", defaultPrefix: "AE/INV/" },
  { id: "SALES_INV", label: "Material Sales Invoice", defaultPrefix: "AE/INV-S/" },
  { id: "HIRING_INV", label: "Hiring Out Invoice", defaultPrefix: "AE/INV-H/" },
  { id: "SERVICE_INV", label: "Service / Repair Invoice", defaultPrefix: "AE/INV-SRV/" },
  { id: "QUOTATION", label: "Quotation / Estimate", defaultPrefix: "AE/QT/" },
  { id: "PROFORMA", label: "Proforma Invoice", defaultPrefix: "AE/PI/" },
  { id: "PO", label: "Purchase Order", defaultPrefix: "AE/PO/" },
  { id: "GRN", label: "Goods Receipt Note (GRN)", defaultPrefix: "AE/GRN/" },
  { id: "PR", label: "Purchase Return (PR)", defaultPrefix: "AE/PR/" },
  { id: "AGR", label: "Rental Agreement", defaultPrefix: "AE/AGR/" },
  { id: "STM", label: "Rental Statement", defaultPrefix: "AE/STM/" },
  { id: "DLA", label: "Damage & Loss Assessment", defaultPrefix: "AE/DLA/" },
  { id: "DEP", label: "Rental Deposit Receipt", defaultPrefix: "AE/DEP/" },
  { id: "SET", label: "Site Closure Settlement", defaultPrefix: "AE/SET/" },
  { id: "RB", label: "Rental Batch Reference", defaultPrefix: "RB-" },
  { id: "EWB", label: "E-Way Bill Reference", defaultPrefix: "EWB-" },
  { id: "PURCHASE_INV", label: "Purchase Invoice", defaultPrefix: "AE/PUR/" },
  { id: "CREDIT_NOTE", label: "Credit Note (CN)", defaultPrefix: "AE/CN/" },
  { id: "DEBIT_NOTE", label: "Debit Note (DN-ADJ)", defaultPrefix: "AE/DN-ADJ/" },
  { id: "RECEIPT", label: "Customer Payment Receipt", defaultPrefix: "AE/REC/" },
  { id: "PAYMENT_VOUCHER", label: "Supplier / Expense Payment Voucher", defaultPrefix: "AE/PAY/" },
  { id: "JOURNAL", label: "General Ledger Journal", defaultPrefix: "AE/JRN/" },
  { id: "MAT", label: "Material Variant Code", defaultPrefix: "MAT-" },
  { id: "CUST", label: "Customer ID", defaultPrefix: "CUST-" },
  { id: "SITE", label: "Customer Construction Site ID", defaultPrefix: "SITE-" },
  { id: "SUP", label: "Supplier ID", defaultPrefix: "SUP-" },
  { id: "MV", label: "Inventory Movement Reference", defaultPrefix: "MV-" },
  { id: "AUD", label: "Physical Stock Audit Reference", defaultPrefix: "AUD-" },
  { id: "TRIP", label: "Vehicle Trip", defaultPrefix: "AE/TRIP/" },
  { id: "FUEL", label: "Vehicle Fuel Log", defaultPrefix: "FUEL-" },
  { id: "VMR", label: "Vehicle Maintenance Record", defaultPrefix: "VMR-" },
  { id: "VEH_EXP", label: "Vehicle Expense Voucher", defaultPrefix: "AE/VEXP/" },
  { id: "DRV", label: "Driver Code", defaultPrefix: "DRV-" },
  { id: "WRK", label: "Labour Worker Code", defaultPrefix: "WRK-" },
  { id: "LAB_ADV", label: "Labour Advance Voucher", defaultPrefix: "AE/LADV/" },
  { id: "LAB_WAGE", label: "Labour Wage Settlement", defaultPrefix: "AE/LWAGE/" },
  { id: "LAB_PAY", label: "Labour Payment Voucher", defaultPrefix: "AE/LPAY/" },
  { id: "MAT_REP", label: "Material Repair Job", defaultPrefix: "AE/REP/" },
  { id: "DSTN", label: "Direct Site Transfer Note (DSTN)", defaultPrefix: "AE/DSTN/" },
  { id: "OSB", label: "Opening Stock Batch", defaultPrefix: "OSB-" },
  { id: "OBB", label: "Opening Balance Batch", defaultPrefix: "OBB-" },
  { id: "PILOT", label: "Pilot Program Reference", defaultPrefix: "PILOT-" },
] as const;

export type DocumentTypeId = (typeof DOCUMENT_TYPES)[number]["id"];

/**
 * Returns Indian Financial Year string for a given date (default 1 April to 31 March)
 * e.g. Nov 2026 -> "2026-27", Jan 2027 -> "2026-27", Apr 2027 -> "2027-28"
 */
export function getCurrentFiscalYear(date: Date = new Date()): string {
  const month = date.getMonth(); // 0-11 (Jan=0, Apr=3)
  const fullYear = date.getFullYear();

  if (month >= 3) {
    // April (3) to December (11)
    const nextYearShort = (fullYear + 1).toString().slice(-2);
    return `${fullYear}-${nextYearShort}`;
  } else {
    // January (0) to March (2)
    const currentYearShort = fullYear.toString().slice(-2);
    return `${fullYear - 1}-${currentYearShort}`;
  }
}

/**
 * Formats a document number from series metadata
 */
export function formatDocumentNumber(
  prefix: string,
  counter: number,
  padding: number = 4,
  suffix: string = ""
): string {
  const padded = counter.toString().padStart(padding, "0");
  return `${prefix}${padded}${suffix}`;
}

/**
 * Atomic concurrency-safe generator for sequential document numbers
 */
export async function generateNextDocumentNumber(
  documentType: DocumentTypeId | string,
  fiscalYear: string = getCurrentFiscalYear(),
  externalTx?: Prisma.TransactionClient
): Promise<string> {
  const runner = async (tx: Prisma.TransactionClient) => {
    let series = await tx.documentSeries.findUnique({
      where: {
        documentType_fiscalYear: {
          documentType,
          fiscalYear,
        },
      },
    });

    if (!series) {
      // Find default prefix
      const def = DOCUMENT_TYPES.find((d) => d.id === documentType);
      // For statutory documents (DN, STN, Invoices), use compact fiscal year (e.g. 26-27)
      // to ensure total formatted document number remains strictly within Rule 46(b) 16-character limit.
      const shortFy = fiscalYear.includes("-") ? fiscalYear.slice(-5) : fiscalYear;
      const prefix = def ? `${def.defaultPrefix}${shortFy}/` : `AE/${documentType}/${shortFy}/`;

      series = await tx.documentSeries.create({
        data: {
          documentType,
          fiscalYear,
          prefix,
          currentCounter: 0,
          padding: 4,
          suffix: "",
          isActive: true,
        },
      });
    }

    if (!series.isActive) {
      throw new Error(`Document series for '${documentType}' (${fiscalYear}) is inactive.`);
    }

    const nextCounter = series.currentCounter + 1;

    await tx.documentSeries.update({
      where: { id: series.id },
      data: { currentCounter: nextCounter },
    });

    return formatDocumentNumber(series.prefix, nextCounter, series.padding, series.suffix || "");
  };

  if (externalTx) {
    return await runner(externalTx);
  }
  return await db.$transaction(runner, { maxWait: 15000, timeout: 30000 });
}

