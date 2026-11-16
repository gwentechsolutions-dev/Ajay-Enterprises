/**
 * Statutory WhiteBooks NIC Payload Mapper
 * Operating Business: AJAY ENTERPRISES
 * Adheres strictly to Official E-Way Bill Preparation Tools & OpenAPI schema
 */

import { GenerateEwbRequest } from "../../types";
import { validateAndResolveHsnSac } from "@/lib/accounting/gst-engine";

/**
 * Statutory movement classification constants
 * Note: Subject to statutory review; marked PENDING GST ADVISOR CONFIRMATION
 */
export const STATUTORY_CLASSIFICATION = {
  RENTAL_DISPATCH: {
    docType: "CHL" as const,
    supplyType: "O" as const,
    subSupplyType: "8", // Others
    subSupplyDesc: "Centering Rental", // 16 chars (max 20)
    statutoryBasis: "Custody transfer under rental agreement (not a sale or job work); monthly rental billed separately.",
    status: "PENDING GST ADVISOR CONFIRMATION",
  },
  STOCK_TRANSFER: {
    docType: "CHL" as const,
    supplyType: "O" as const,
    subSupplyType: "5", // For Own Use
    subSupplyDesc: " ",
    statutoryBasis: "Inter-warehouse stock transfer between company-owned yards.",
    status: "PENDING GST ADVISOR CONFIRMATION",
  },
};

export interface WhiteBooksItemPayload {
  productName: string;
  productDesc: string;
  hsnCode: number;
  quantity: number;
  qtyUnit: string;
  taxableAmount: number;
  sgstRate: number;
  cgstRate: number;
  igstRate: number;
  cessRate: number;
}

export interface WhiteBooksGenEwbPayload {
  supplyType: "O" | "I";
  subSupplyType: string;
  subSupplyDesc?: string;
  docType: "CHL" | "INV" | "BIL" | "BOE" | "CNT" | "OTH";
  docNo: string;
  docDate: string; // DD/MM/YYYY
  fromGstin: string;
  fromTrdName: string;
  fromAddr1: string;
  fromAddr2: string;
  fromPlace: string;
  actFromStateCode: number;
  fromPincode: number;
  fromStateCode: number;
  toGstin: string;
  toTrdName: string;
  toAddr1: string;
  toAddr2: string;
  toPlace: string;
  toPincode: number;
  actToStateCode: number;
  toStateCode: number;
  transactionType: number; // 1: Regular
  totalValue: number;
  cgstValue: number;
  sgstValue: number;
  igstValue: number;
  cessValue: number;
  cessNonAdvolValue: number;
  totInvValue: number;
  transMode: string; // "1" = Road
  transDistance: string;
  vehicleNo: string;
  vehicleType: string; // "R" = Regular
  itemList: WhiteBooksItemPayload[];
}

/**
 * Maps UOM string to official 3-character GST unit codes
 */
export const GST_UOM_MAP: Record<string, string> = {
  "NOS": "NOS",
  "NOS.": "NOS",
  "NUMBERS": "NOS",
  "NO": "NOS",
  "SET": "SET",
  "SETS": "SET",
  "BUNDLE": "BDL",
  "BUNDLES": "BDL",
  "BDL": "BDL",
  "METER": "MTR",
  "METERS": "MTR",
  "MTR": "MTR",
  "KG": "KGS",
  "KGS": "KGS",
  "KILOGRAMS": "KGS",
  "BOX": "BOX",
  "BOXES": "BOX",
  "BAG": "BAG",
  "BAGS": "BAG",
  "TONNE": "TON",
  "TONS": "TON",
};

export function mapToGstUom(uom?: string): string {
  if (!uom) return "NOS";
  const clean = uom.trim().toUpperCase();
  const matched = GST_UOM_MAP[clean];
  if (matched) return matched;

  // If already exactly 3 uppercase letters, accept as valid unit
  if (/^[A-Z]{3}$/.test(clean)) {
    return clean;
  }

  throw new Error(
    `Unsupported Unit of Measurement '${uom}'. Statutory rules require a valid GST UOM code (e.g. NOS, SET, BDL, MTR, KGS).`
  );
}

/**
 * Validates and formats standard Indian vehicle registration
 * Standard format: 2-letter state code + 1-2 digits RTO + 1-3 letters + 1-4 digits
 * Example: KA01AB1234 or TN09Z1234
 */
export function sanitizeAndValidateVehicleNumber(rawVehicle: string): string {
  if (!rawVehicle) {
    throw new Error("Vehicle registration number is required for statutory E-Way Bill generation.");
  }

  const clean = rawVehicle.replace(/[\s\-_]/g, "").toUpperCase();

  // Validate format
  const standardPattern = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$/;
  const bharatSeriesPattern = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/;

  if (!standardPattern.test(clean) && !bharatSeriesPattern.test(clean)) {
    throw new Error(
      `Invalid vehicle number format '${rawVehicle}'. Expected standard Indian registration (e.g. KA-01-AB-1234 or 22-BH-1234-AA).`
    );
  }

  if (clean.length > 10) {
    throw new Error(
      `Vehicle number '${clean}' exceeds maximum statutory limit of 10 characters.`
    );
  }

  return clean;
}

/**
 * Strictly formats a Date to DD/MM/YYYY
 */
export function formatDateToDDMMYYYY(date: Date | string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    throw new Error("Invalid document date provided for E-Way Bill.");
  }
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Maps INVENTRA GenerateEwbRequest into WhiteBooks statutory payload
 */
export function mapInventraToWhiteBooksPayload(req: GenerateEwbRequest): WhiteBooksGenEwbPayload {
  // 1. Validate Document Number
  const cleanDocNo = req.documentNumber.trim();
  if (!cleanDocNo) {
    throw new Error("Document number is required.");
  }
  if (cleanDocNo.length > 16) {
    throw new Error(
      `Document number '${cleanDocNo}' exceeds maximum statutory limit of 16 characters. Statutory rules disallow silent truncation.`
    );
  }
  // NIC allowed characters: alphanumeric with / and -
  if (!/^[A-Za-z0-9\/\-]+$/.test(cleanDocNo)) {
    throw new Error(
      `Document number '${cleanDocNo}' contains invalid characters. Only alphanumeric, '/' and '-' are permitted.`
    );
  }

  // 2. Format Document Date
  const docDate = formatDateToDDMMYYYY(req.documentDate);

  // 3. Validate Vehicle Number
  const vehicleNo = sanitizeAndValidateVehicleNumber(req.vehicleNumber);

  // 4. Validate Distance
  const distance = Math.round(req.distanceKm);
  if (distance <= 0 || distance > 4000) {
    throw new Error(`Transport distance (${distance} KM) must be between 1 and 4000 KM.`);
  }

  // 5. Document & Supply Type
  // Delivery Note: CHL (Delivery Challan), subSupplyType: 8 (Others with desc) or 4 (Job Work)
  // Stock Transfer: CHL, subSupplyType: 5 (For own use)
  const isStockTransfer = req.documentType === "TRANSFER_NOTE";
  const docType = req.docType || "CHL";
  const supplyType = req.supplyType || "O";
  const subSupplyType = req.subSupplyType || (isStockTransfer ? STATUTORY_CLASSIFICATION.STOCK_TRANSFER.subSupplyType : STATUTORY_CLASSIFICATION.RENTAL_DISPATCH.subSupplyType);
  const subSupplyDesc = subSupplyType === "8" ? (req.subSupplyDesc || STATUTORY_CLASSIFICATION.RENTAL_DISPATCH.subSupplyDesc).slice(0, 20) : " ";

  // 6. Validate GSTINs
  const fromGstin = req.fromGstin.trim().toUpperCase();
  const toGstin = (req.toGstin && req.toGstin.trim() !== "") ? req.toGstin.trim().toUpperCase() : "URP";

  // 7. Validate Pincodes
  const fromPincode = Number(req.fromPincode);
  const toPincode = Number(req.toPincode);
  if (isNaN(fromPincode) || String(fromPincode).length !== 6) {
    throw new Error(`Invalid source pincode '${req.fromPincode}'. Must be a 6-digit numeric PIN code.`);
  }
  if (isNaN(toPincode) || String(toPincode).length !== 6) {
    throw new Error(`Invalid destination pincode '${req.toPincode}'. Must be a 6-digit numeric PIN code.`);
  }

  // 8. Map & Validate Items
  if (!req.items || req.items.length === 0) {
    throw new Error("At least one line item is required to generate an E-Way Bill.");
  }

  const itemList: WhiteBooksItemPayload[] = req.items.map((item, index) => {
    // Validate HSN code
    const hsnResolution = validateAndResolveHsnSac(item.hsnCode);
    if (!hsnResolution.isValid) {
      throw new Error(`Line ${index + 1} (${item.materialName}): ${hsnResolution.message}`);
    }
    const numericHsn = parseInt(hsnResolution.code, 10);
    if (isNaN(numericHsn)) {
      throw new Error(`Line ${index + 1}: HSN code '${item.hsnCode}' could not be converted to numeric tariff.`);
    }

    const qtyUnit = mapToGstUom(item.uom);
    const taxableAmount = Number(item.taxableValue.toFixed(2));

    return {
      productName: item.materialName.slice(0, 100),
      productDesc: (item.description || `${item.materialName} Centering Equipment`).slice(0, 100),
      hsnCode: numericHsn,
      quantity: Number(item.quantity),
      qtyUnit,
      taxableAmount,
      cgstRate: Number((item.cgstRate || 0).toFixed(3)),
      sgstRate: Number((item.sgstRate || 0).toFixed(3)),
      igstRate: Number((item.igstRate || 0).toFixed(3)),
      cessRate: Number((item.cessRate || 0).toFixed(3)),
    };
  });

  // 9. Financial Reconciliations
  const totalValue = Number(req.totalTaxableValue.toFixed(2));
  const cgstValue = Number(req.cgstValue.toFixed(2));
  const sgstValue = Number(req.sgstValue.toFixed(2));
  const igstValue = Number(req.igstValue.toFixed(2));
  const cessValue = Number((req.cessValue || 0).toFixed(2));
  const totInvValue = Number(req.totalInvoiceValue.toFixed(2));

  return {
    supplyType,
    subSupplyType,
    subSupplyDesc,
    docType,
    docNo: cleanDocNo,
    docDate,
    fromGstin,
    fromTrdName: req.fromTradeName.slice(0, 100),
    fromAddr1: req.fromAddress1.slice(0, 120),
    fromAddr2: (req.fromAddress2 || "").slice(0, 120),
    fromPlace: req.fromPlace.slice(0, 50),
    actFromStateCode: req.fromStateCode,
    fromPincode,
    fromStateCode: req.fromStateCode,
    toGstin,
    toTrdName: req.toTradeName.slice(0, 100),
    toAddr1: req.toAddress1.slice(0, 120),
    toAddr2: (req.toAddress2 || "").slice(0, 120),
    toPlace: req.toPlace.slice(0, 50),
    toPincode,
    actToStateCode: req.toStateCode,
    toStateCode: req.toStateCode,
    transactionType: 1, // Regular
    totalValue,
    cgstValue,
    sgstValue,
    igstValue,
    cessValue,
    cessNonAdvolValue: 0,
    totInvValue,
    transMode: req.transMode || "1",
    transDistance: String(distance),
    vehicleNo,
    vehicleType: req.vehicleType || "R",
    itemList,
  };
}
