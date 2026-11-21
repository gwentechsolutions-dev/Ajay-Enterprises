import crypto from "crypto";
import { crossCheckFuelAmount } from "./fuel-calculations";

// ==============================================================================
// INVENTRA: DEEPSEEK AI DOCUMENT & VISION SCANNING SERVICE
// Exact adaptation of proven UnblockNow DeepSeek Vision OCR for AJAY ENTERPRISES
//
// Key Security Rules:
// 1. API key lives ONLY on server. Never returned, logged, or exposed.
// 2. No raw image bytes or extracted PII logged.
// 3. Defensive typed coercion for all model outputs.
// 4. Human-in-the-loop review always required before persistence.
// ==============================================================================

const BASE_URL = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");
const MODEL = process.env.DEEPSEEK_VISION_MODEL || "deepseek-flash";
const TIMEOUT_MS = Number(process.env.DEEPSEEK_VISION_TIMEOUT_MS) || 45000;
const MAX_TOKENS = Number(process.env.DEEPSEEK_VISION_MAX_TOKENS) || 8000;
const THINKING_ENABLED = String(process.env.DEEPSEEK_VISION_THINKING_ENABLED || "false").toLowerCase() === "true";

export const SCAN_TYPES = [
  "fuel_receipt",
  "pump_meter",
  "odometer",
  "combined_fuel",
  "expense_bill",
] as const;

export type ScanType = (typeof SCAN_TYPES)[number];

export const EXPENSE_CATEGORIES = [
  "service",
  "repair",
  "insurance",
  "toll",
  "parking",
  "accessories",
  "other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const SCAN_STATUS = {
  SUCCESS: "success",
  PARTIAL: "partial",
  UNREADABLE: "unreadable",
  INVALID_IMAGE: "invalid_image",
} as const;

export type ScanStatus = (typeof SCAN_STATUS)[keyof typeof SCAN_STATUS];

export class VisionServiceError extends Error {
  code: string;
  userMessage: string;
  status: number;
  retryable: boolean;

  constructor(code: string, userMessage: string, { status = 502, retryable = false } = {}) {
    super(userMessage);
    this.name = "VisionServiceError";
    this.code = code;
    this.userMessage = userMessage;
    this.status = status;
    this.retryable = retryable;
  }
}

function getApiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key || !key.trim()) {
    throw new VisionServiceError(
      "NOT_CONFIGURED",
      "AI Scanning is temporarily unavailable. DeepSeek API key is not configured.",
      { status: 503 }
    );
  }
  return key.trim();
}

export function isVisionConfigured(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY.trim());
}

const ACCEPTS: Record<string, string> = {
  fuel_receipt: "a printed fuel receipt or bill from a petrol, diesel or CNG filling station",
  pump_meter: "a fuel dispenser display showing the volume/quantity, rate or total amount",
  odometer: "a vehicle instrument cluster or dashboard odometer display showing the vehicle's total distance",
  combined_fuel: "a set of photos including fuel receipt, fuel dispenser meter, and/or vehicle odometer",
  expense_bill: "a vehicle-related maintenance invoice, repair bill, insurance policy, or expense receipt",
};

const CATEGORY_ACCEPTS: Record<ExpenseCategory, string> = {
  service: "a vehicle service or workshop invoice or receipt for scheduled maintenance",
  repair: "a vehicle mechanical, electrical, body, or spare parts repair bill or workshop invoice",
  insurance: "a motor vehicle insurance policy document, certificate, renewal receipt, or premium schedule",
  toll: "a toll plaza receipt, slip, or FASTag transaction invoice",
  parking: "a parking receipt, ticket, or parking payment voucher",
  accessories: "a bill or invoice for vehicle accessories, tyres, battery, or hardware fitments",
  other: "any commercial document recording money spent on a company vehicle (permits, fitness, pollution, challan)",
};

const FIELD_NOTES: Record<string, string> = {
  date: 'date: the transaction/invoice date as YYYY-MM-DD, only if clear, else null',
  time: 'time: HH:MM in 24-hour format',
  vendor: 'vendor: the filling station name, workshop, or merchant printed on the document',
  invoiceNumber: 'invoiceNumber: the bill, receipt, or invoice number',
  fuelType: 'fuelType: one of PETROL, DIESEL, CNG, ELECTRIC — read from product name (MS/SPEED/POWER is PETROL; HSD/TURBOJET/XTRA MILE is DIESEL). Default to null if unstated',
  quantity: 'quantity: the quantity of fuel dispensed as a number (litres, kg, or kWh)',
  quantityUnit: 'quantityUnit: "L", "kg" or "kWh"',
  ratePerUnit: 'ratePerUnit: price per unit (rupees per litre or kg)',
  totalAmount: 'totalAmount: the total amount payable in Indian Rupees',
  taxAmount: 'taxAmount: total GST (CGST + SGST or IGST) if printed separately',
  odometerKm: 'odometerKm: total vehicle odometer reading in whole kilometres (ignore trip meters like TRIP A/B)',
  vehicleRegistration: 'vehicleRegistration: registration number of the vehicle if printed',
  paymentMethod: 'paymentMethod: CASH, UPI, CARD, FASTAG, NETBANKING, CHEQUE or OTHER',
  description: 'description: short summary of items/services billed, up to 15 words',
  category: 'category: one of service, repair, insurance, toll, parking, accessories, other',
  policyNumber: 'policyNumber: the insurance policy or certificate number',
  policyExpiryDate: 'policyExpiryDate: the insurance expiry/renewal date as YYYY-MM-DD',
};

function responseContract(fields: string[], includeOrigins: boolean = false) {
  const example: Record<string, any> = {
    match: "yes",
    readable: "full",
    fields: Object.fromEntries(fields.map((f) => [f, null])),
    fieldConfidence: { [fields[0]]: 0.9 },
  };

  if (includeOrigins) {
    example.fieldOrigins = { [fields[0]]: "receipt" };
  }

  return `Reply with one json object in exactly this shape and nothing else:
${JSON.stringify(example, null, 2)}

Rules:
- match: "yes" if the image is really what was asked for, "no" only if it clearly is not (a selfie, random document, landscape, food), "unsure" when you cannot tell.
- readable: "full" if you read all printed key fields, "partial" if some were legible, "none" if nothing could be deciphered.
- If match is "no", set every field to null.
- fields: only the keys shown above. Never invent a value. Anything unreadable, obscured or absent is null.
- Numbers must be plain numbers: no currency symbols (₹, Rs), no commas, no units.
- Do not calculate, convert or derive anything not printed on the document.
- fieldConfidence: numeric value 0.0 to 1.0 for each field read.
${includeOrigins ? '- fieldOrigins: for each field read, record which image provided the value ("receipt", "pump_meter", or "odometer").' : ""}
- Do not include conversational markdown, explanations, or prose outside the JSON.`;
}

function buildPrompt(scanType: ScanType, category?: ExpenseCategory | null, hasMultipleImages: boolean = false) {
  const isExpense = scanType === "expense_bill";
  const accepts = isExpense && category && CATEGORY_ACCEPTS[category]
    ? CATEGORY_ACCEPTS[category]
    : ACCEPTS[scanType];

  let fields: string[] = [];

  if (scanType === "fuel_receipt") {
    fields = [
      "date", "time", "vendor", "invoiceNumber", "fuelType", "quantity",
      "quantityUnit", "ratePerUnit", "totalAmount", "taxAmount", "odometerKm",
      "vehicleRegistration", "paymentMethod"
    ];
  } else if (scanType === "pump_meter") {
    fields = ["quantity", "quantityUnit", "ratePerUnit", "totalAmount"];
  } else if (scanType === "odometer") {
    fields = ["odometerKm"];
  } else if (scanType === "combined_fuel") {
    fields = [
      "date", "time", "vendor", "invoiceNumber", "fuelType", "quantity",
      "quantityUnit", "ratePerUnit", "totalAmount", "taxAmount", "odometerKm",
      "vehicleRegistration", "paymentMethod"
    ];
  } else {
    // expense_bill
    fields = [
      "date", "vendor", "invoiceNumber", "totalAmount", "taxAmount",
      "description", "odometerKm", "vehicleRegistration", "paymentMethod",
      "policyNumber", "policyExpiryDate", "category"
    ];
  }

  const lines = [
    `This request provides ${hasMultipleImages ? "multiple images" : "an image"} uploaded as ${accepts} in India.`,
  ];

  if (scanType === "odometer" || scanType === "combined_fuel") {
    lines.push(
      "For odometer readings: Return the TOTAL cumulative vehicle distance in kilometres.",
      "Do NOT return a trip meter reading (e.g. TRIP A, TRIP B, ODO 1). Trip meters typically have a decimal point and much smaller values."
    );
  }

  lines.push("", "Extract these target fields:", ...fields.map((f) => `- ${FIELD_NOTES[f] || f}`).filter(Boolean));
  lines.push("", responseContract(fields, hasMultipleImages || scanType === "combined_fuel"));

  return lines.join("\n");
}

function parseModelJson(content: string): any {
  if (!content || !content.trim()) {
    throw new VisionServiceError(
      "EMPTY_RESPONSE",
      "No readable response was received from the vision scanner. Please try again or enter details manually.",
      { status: 422 }
    );
  }

  const stripped = content.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();

  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(stripped.slice(start, end + 1));
      } catch {
        // Fall through
      }
    }
    throw new VisionServiceError(
      "INVALID_JSON",
      "Could not decipher the scanner response. Please upload a clearer photo or enter values manually.",
      { status: 422 }
    );
  }
}

function coercePositiveNumber(val: any, max = 10000000): number | null {
  if (val == null || val === "") return null;
  const cleaned = String(val).replace(/[^\d.-]/g, "");
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num <= 0 || num > max) return null;
  return Math.round(num * 100) / 100;
}

function coerceString(val: any, maxLen = 200): string | null {
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  if (!trimmed || /^(null|n\/a|none|unknown|-)$/i.test(trimmed)) return null;
  return trimmed.slice(0, maxLen);
}

function coerceConfidence(val: any): number {
  if (val == null) return 0.8;
  const num = Number(val);
  if (!Number.isFinite(num)) return 0.8;
  return Math.min(1.0, Math.max(0.0, Math.round(num * 100) / 100));
}

function normalizeDate(val: any): string | null {
  if (!val) return null;
  const raw = String(val).trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (isoMatch) return isoMatch[0];

  const slashMatch = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(raw);
  if (slashMatch) {
    const p1 = Number(slashMatch[1]);
    const p2 = Number(slashMatch[2]);
    const y = slashMatch[3].length === 2 ? 2000 + Number(slashMatch[3]) : Number(slashMatch[3]);
    // If p1 > 12, then DD/MM/YYYY
    if (p1 > 12 && p2 <= 12) {
      return `${y}-${String(p2).padStart(2, "0")}-${String(p1).padStart(2, "0")}`;
    }
    // If p2 > 12, then MM/DD/YYYY
    if (p2 > 12 && p1 <= 12) {
      return `${y}-${String(p1).padStart(2, "0")}-${String(p2).padStart(2, "0")}`;
    }
    // Ambiguous default in India is DD/MM/YYYY
    return `${y}-${String(p2).padStart(2, "0")}-${String(p1).padStart(2, "0")}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

export interface ExtractedScanData {
  documentType: ScanType;
  status: ScanStatus;
  reasonCode: string | null;
  fields: {
    date: string | null;
    time: string | null;
    vendor: string | null;
    invoiceNumber: string | null;
    fuelType: string | null;
    quantity: number | null;
    quantityUnit: string | null;
    ratePerUnit: number | null;
    totalAmount: number | null;
    taxAmount: number | null;
    odometerKm: number | null;
    vehicleRegistration: string | null;
    paymentMethod: string | null;
    description: string | null;
    category: string | null;
    policyNumber: string | null;
    policyExpiryDate: string | null;
  };
  fieldConfidence: Record<string, number>;
  fieldOrigins: Record<string, string>;
  missingFields: string[];
  warnings: string[];
  checks: Array<{ code: string; message: string; details?: any }>;
  requiresReview: boolean;
}

export function normalizeExtractionResult(
  raw: any,
  scanType: ScanType,
  category?: ExpenseCategory | null
): ExtractedScanData {
  const rawFields = raw?.fields && typeof raw.fields === "object" ? raw.fields : {};
  const rawConfidence = raw?.fieldConfidence && typeof raw.fieldConfidence === "object" ? raw.fieldConfidence : {};
  const rawOrigins = raw?.fieldOrigins && typeof raw.fieldOrigins === "object" ? raw.fieldOrigins : {};

  const match = ["yes", "no", "unsure"].includes(raw?.match) ? raw.match : "unsure";
  const readable = ["full", "partial", "none"].includes(raw?.readable) ? raw.readable : "partial";

  const warnings: string[] = [];
  const checks: Array<{ code: string; message: string; details?: any }> = [];

  const date = normalizeDate(rawFields.date);
  const time = coerceString(rawFields.time, 10);
  const vendor = coerceString(rawFields.vendor, 120);
  const invoiceNumber = coerceString(rawFields.invoiceNumber, 50);

  let fuelType = coerceString(rawFields.fuelType, 30)?.toUpperCase() || null;
  if (fuelType) {
    if (fuelType.includes("DIESEL") || fuelType.includes("HSD")) fuelType = "DIESEL";
    else if (fuelType.includes("PETROL") || fuelType.includes("MS") || fuelType.includes("POWER")) fuelType = "PETROL";
    else if (fuelType.includes("CNG")) fuelType = "CNG";
    else if (fuelType.includes("ELEC")) fuelType = "ELECTRIC";
  }

  const quantity = coercePositiveNumber(rawFields.quantity, 1000);
  const ratePerUnit = coercePositiveNumber(rawFields.ratePerUnit, 500);
  const totalAmount = coercePositiveNumber(rawFields.totalAmount, 10000000);
  const taxAmount = coercePositiveNumber(rawFields.taxAmount, 1000000);
  const odometerKm = coercePositiveNumber(rawFields.odometerKm, 2000000);

  const vehicleRegistration = coerceString(rawFields.vehicleRegistration, 25);
  const paymentMethod = coerceString(rawFields.paymentMethod, 30);
  const description = coerceString(rawFields.description, 250);
  const policyNumber = coerceString(rawFields.policyNumber, 50);
  const policyExpiryDate = normalizeDate(rawFields.policyExpiryDate);

  let quantityUnit = coerceString(rawFields.quantityUnit, 10) || "L";
  if (fuelType === "CNG") quantityUnit = "kg";
  if (fuelType === "ELECTRIC") quantityUnit = "kWh";

  // Check arithmetic
  if (quantity != null && ratePerUnit != null && totalAmount != null) {
    const crossCheck = crossCheckFuelAmount({ quantity, pricePerUnit: ratePerUnit, totalAmount });
    if (!crossCheck.consistent) {
      warnings.push(
        `Amount mismatch: Quantity (${quantity} ${quantityUnit}) × Rate (₹${ratePerUnit}) = ₹${crossCheck.expectedAmount}, but total printed is ₹${totalAmount}.`
      );
      checks.push({
        code: "AMOUNT_MISMATCH",
        message: "Calculated product differs from total amount printed.",
        details: crossCheck,
      });
    }
  }

  // Determine field confidence
  const fieldConfidence: Record<string, number> = {};
  const fields = {
    date,
    time,
    vendor,
    invoiceNumber,
    fuelType,
    quantity,
    quantityUnit,
    ratePerUnit,
    totalAmount,
    taxAmount,
    odometerKm,
    vehicleRegistration,
    paymentMethod,
    description,
    category: category || coerceString(rawFields.category, 30) || (scanType === "fuel_receipt" ? "fuel" : null),
    policyNumber,
    policyExpiryDate,
  };

  for (const [key, val] of Object.entries(fields)) {
    if (val !== null && val !== undefined) {
      fieldConfidence[key] = coerceConfidence(rawConfidence[key]);
    }
  }

  // Determine missing expected fields
  const missingFields: string[] = [];
  if (scanType === "fuel_receipt") {
    if (!date) missingFields.push("date");
    if (quantity == null) missingFields.push("quantity");
    if (ratePerUnit == null) missingFields.push("ratePerUnit");
    if (totalAmount == null) missingFields.push("totalAmount");
  } else if (scanType === "pump_meter") {
    if (quantity == null) missingFields.push("quantity");
    if (totalAmount == null) missingFields.push("totalAmount");
  } else if (scanType === "odometer") {
    if (odometerKm == null) missingFields.push("odometerKm");
  } else if (scanType === "combined_fuel") {
    if (totalAmount == null) missingFields.push("totalAmount");
    if (quantity == null) missingFields.push("quantity");
    if (odometerKm == null) missingFields.push("odometerKm");
  } else if (scanType === "expense_bill") {
    if (!date) missingFields.push("date");
    if (totalAmount == null) missingFields.push("totalAmount");
  }

  // Derive status
  let status: ScanStatus = SCAN_STATUS.SUCCESS;
  if (match === "no") {
    status = SCAN_STATUS.INVALID_IMAGE;
  } else if (readable === "none" || Object.keys(fieldConfidence).length === 0) {
    status = SCAN_STATUS.UNREADABLE;
  } else if (missingFields.length > 0) {
    status = SCAN_STATUS.PARTIAL;
  }

  // If invalid image, blank out fields
  if (status === SCAN_STATUS.INVALID_IMAGE) {
    for (const key of Object.keys(fields) as Array<keyof typeof fields>) {
      (fields as any)[key] = null;
    }
    for (const key of Object.keys(fieldConfidence)) {
      delete fieldConfidence[key];
    }
  }

  return {
    documentType: scanType,
    status,
    reasonCode:
      status === SCAN_STATUS.INVALID_IMAGE
        ? "WRONG_IMAGE"
        : status === SCAN_STATUS.UNREADABLE
        ? "NO_VALUES_READ"
        : null,
    fields,
    fieldConfidence,
    fieldOrigins: rawOrigins,
    missingFields,
    warnings,
    checks,
    requiresReview: true,
  };
}

export interface ScanImageInput {
  buffer: Buffer;
  mimeType: string;
  label?: string; // e.g. "receipt", "pump_meter", "odometer"
}

/**
 * Executes a DeepSeek Vision OCR scan over one or multiple images with retry and timeout protection.
 */
export async function scanDocumentsWithDeepSeek(params: {
  images: ScanImageInput[];
  scanType: ScanType;
  category?: ExpenseCategory | null;
  vehicleContext?: { vehicleNumber: string; fuelType?: string; category?: string } | null;
}): Promise<ExtractedScanData> {
  const { images, scanType, category = null, vehicleContext = null } = params;

  if (images.length === 0) {
    throw new VisionServiceError("INVALID_FILE", "Please provide at least one image to scan.", { status: 400 });
  }

  const apiKey = getApiKey();
  const promptText = buildPrompt(scanType, category, images.length > 1);

  let vehicleContextPrompt = "";
  if (vehicleContext) {
    vehicleContextPrompt = `\nTarget Company Vehicle Context: Registration ${vehicleContext.vehicleNumber}, Type: ${vehicleContext.category || "Commercial Fleet"}, Configured Fuel: ${vehicleContext.fuelType || "DIESEL"}.`;
  }

  const imageParts: Array<{ type: "text" | "image_url"; text?: string; image_url?: { url: string; detail: string } }> = [];

  images.forEach((img, idx) => {
    if (images.length > 1) {
      imageParts.push({
        type: "text",
        text: `Image ${idx + 1} of ${images.length}${img.label ? ` (${img.label})` : ""}:`,
      });
    }
    imageParts.push({
      type: "image_url",
      image_url: {
        url: `data:${img.mimeType};base64,${img.buffer.toString("base64")}`,
        detail: "original",
      },
    });
  });

  const requestBody: any = {
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are an expert AI data extractor for Indian commercial fleet receipts, fuel pump displays, odometers, and workshop bills. You extract clean, verified values and reply strictly in JSON format without extra commentary.",
      },
      {
        role: "user",
        content: [{ type: "text", text: promptText + vehicleContextPrompt }, ...imageParts],
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: MAX_TOKENS,
  };

  if (!THINKING_ENABLED) {
    requestBody.thinking = { type: "disabled" };
  }

  let lastError: any = null;
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        // If DeepSeek model rejected the thinking parameter, retry once without it
        if ((response.status === 400 || response.status === 422) && requestBody.thinking && /thinking/i.test(errorText)) {
          delete requestBody.thinking;
          continue;
        }

        if (response.status === 429) {
          throw new VisionServiceError(
            "RATE_LIMITED",
            "AI scanning service is currently busy. Please wait a moment or enter values manually.",
            { status: 429, retryable: true }
          );
        }
        if (response.status === 401 || response.status === 403) {
          throw new VisionServiceError("AUTH", "AI scanning authentication failed.", { status: 503 });
        }
        if (response.status >= 500) {
          throw new VisionServiceError(
            "UPSTREAM_ERROR",
            "DeepSeek AI provider returned a server error. You can continue manually.",
            { status: 503, retryable: true }
          );
        }

        throw new VisionServiceError("SCAN_FAILED", "Document scan could not be processed.", { status: response.status });
      }

      const json = await response.json();
      const content = json?.choices?.[0]?.message?.content || "";
      const parsed = parseModelJson(content);

      return normalizeExtractionResult(parsed, scanType, category);
    } catch (err: any) {
      clearTimeout(timeout);
      lastError = err;

      if (err.name === "AbortError") {
        throw new VisionServiceError("TIMEOUT", "Scanning took too long to respond. You can enter values manually.", {
          status: 504,
        });
      }

      if (err instanceof VisionServiceError && !err.retryable) {
        throw err;
      }

      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 600 * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError || new VisionServiceError("UNKNOWN", "Scanning failed after retry attempts.", { status: 500 });
}
