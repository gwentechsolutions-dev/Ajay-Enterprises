/**
 * Official WhiteBooks / NIC E-Way Bill Error Codes & Categorization Dictionary
 * Source: Official E-Way Bill Preparation Tools & API Specification
 */

export interface ParsedEwbError {
  code?: string;
  category:
    | "AUTHENTICATION"
    | "AUTHORIZATION"
    | "INVALID_REQUEST"
    | "GSTIN_VALIDATION"
    | "HSN_VALIDATION"
    | "PAYLOAD_VALIDATION"
    | "STATUTORY_RESTRICTION"
    | "DUPLICATE_DOCUMENT"
    | "TOKEN_EXPIRED"
    | "PROVIDER_ERROR"
    | "NETWORK_TIMEOUT"
    | "UNKNOWN";
  message: string;
  isRetryable: boolean;
}

export const KNOWN_ERROR_CODES: Record<string, string> = {
  "100": "Invalid Json format or malformed request payload.",
  "101": "Invalid Username provided for E-Way Bill portal.",
  "102": "Invalid Password provided for E-Way Bill portal.",
  "103": "Invalid Client-ID in request header.",
  "104": "Client-ID is inactive or not authorized.",
  "105": "Invalid authentication token. Session could not be validated.",
  "106": "Authentication token expired. Please re-authenticate.",
  "107": "Authentication failed at GST Suvidha Provider gateway.",
  "108": "Invalid login credentials. Please verify your portal credentials.",
  "109": "Decryption of statutory payload data failed.",
  "110": "Invalid Client-ID or Client-Secret combination.",
  "111": "GSTIN is not registered to this GST Suvidha Provider.",
  "112": "IMEI or device identification mismatch.",
  "118": "E-Way Bill system is busy. Please try again after 5 minutes.",

  // 200 Series: Document & Supply Validation
  "201": "Invalid Supply Type. Must be 'O' (Outward) or 'I' (Inward).",
  "202": "Invalid Sub-supply Type for the specified transaction.",
  "203": "Sub-transaction type does not belong to the selected transaction type.",
  "204": "Invalid Document Type. Expected 'CHL', 'INV', 'BIL', or 'BOE'.",
  "205": "Document Type does not match transaction and sub-transaction rules.",
  "206": "Invalid Document Number. Permitted characters: alphanumeric, '/' and '-'.",
  "207": "Invalid Document Date. Format must strictly be DD/MM/YYYY.",
  "208": "Document Date cannot be in the future.",
  "210": "Duplicate Document Number. An active E-Way Bill already exists for this document.",

  // 300 Series: Consignor & Consignee
  "301": "Invalid Supplier (From) GSTIN format or inactive GSTIN.",
  "302": "Supplier state code does not match the first two digits of Supplier GSTIN.",
  "303": "Invalid Consignee (To) GSTIN format.",
  "304": "Consignee state code does not match Consignee GSTIN.",
  "305": "From Pincode is invalid or does not belong to the specified state.",
  "306": "To Pincode is invalid or does not belong to the destination state.",
  "311": "Transaction not allowed: Supplier GSTIN is blocked from e-Way Bill generation.",
  "312": "Transaction not allowed: Recipient GSTIN is blocked from e-Way Bill generation.",

  // 400 Series: Items, HSN, Tax
  "401": "ItemList cannot be empty. At least one line item is required.",
  "402": "Invalid HSN Code. Must be a valid 4, 6, or 8 digit tariff code.",
  "403": "Invalid Unit of Measurement (UOM). Please use valid GST unit code (e.g. NOS, SET, BND).",
  "404": "Total Invoice Value does not match sum of taxable value and taxes.",
  "405": "CGST and SGST rates are mandatory for intra-state supplies.",
  "406": "IGST rate is mandatory for inter-state supplies.",
  "407": "Tax calculation mismatch. Check tax amounts against rates.",

  // 500-600 Series: Vehicle & Part-B
  "501": "Invalid Vehicle Number format. Enter standard Indian RTO registration without spaces.",
  "502": "Transport Distance exceeds maximum permitted statutory limit (4000 KM).",
  "503": "Transport Mode is invalid. Use '1' for Road transport.",
  "601": "Vehicle update not allowed: E-Way Bill has expired.",
  "602": "Vehicle update not allowed: Consignment is already delivered or cancelled.",

  // 700 Series: Cancellation & Extension
  "701": "Cancellation not allowed: E-Way Bill validity has expired.",
  "702": "Cancellation time window (24 hours from generation) has elapsed.",
  "703": "E-Way Bill has already been verified in transit by tax officer; cannot be cancelled.",
  "704": "Invalid cancellation reason code.",
};

export function parseWhiteBooksError(errorPayload: any, httpStatus?: number): ParsedEwbError {
  if (!errorPayload) {
    if (httpStatus === 401 || httpStatus === 403) {
      return {
        category: "AUTHENTICATION",
        message: "Authentication failed. WhiteBooks credentials or IP address is rejected.",
        isRetryable: false,
      };
    }
    if (httpStatus === 404) {
      return {
        category: "INVALID_REQUEST",
        message: "WhiteBooks endpoint not found or requested resource does not exist.",
        isRetryable: false,
      };
    }
    if (httpStatus && httpStatus >= 500) {
      return {
        category: "PROVIDER_ERROR",
        message: `WhiteBooks GSP server error (HTTP ${httpStatus}). Please try again later.`,
        isRetryable: true,
      };
    }
    return {
      category: "UNKNOWN",
      message: "An unexpected error occurred during statutory E-Way Bill processing.",
      isRetryable: false,
    };
  }

  // Raw string error
  if (typeof errorPayload === "string") {
    const lower = errorPayload.toLowerCase();
    if (lower.includes("token expired") || lower.includes("invalid token")) {
      return { category: "TOKEN_EXPIRED", message: errorPayload, isRetryable: true };
    }
    if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("etimedout")) {
      return { category: "NETWORK_TIMEOUT", message: errorPayload, isRetryable: false };
    }
    return { category: "PROVIDER_ERROR", message: errorPayload, isRetryable: false };
  }

  // Extract error codes (e.g. { errorCodes: "105,206" } or { error_code: 105 } or { error: { message } })
  const rawCode =
    errorPayload.errorCodes ||
    errorPayload.errorCode ||
    errorPayload.error_code ||
    errorPayload.code ||
    (Array.isArray(errorPayload.errors) ? errorPayload.errors[0]?.code : undefined);

  const codeStr = rawCode ? String(rawCode).split(",")[0].trim() : undefined;
  const knownDesc = codeStr ? KNOWN_ERROR_CODES[codeStr] : undefined;

  const rawMessage =
    errorPayload.errorDescription ||
    errorPayload.errorMessage ||
    errorPayload.error_desc ||
    errorPayload.message ||
    errorPayload.error ||
    (Array.isArray(errorPayload.errors) ? errorPayload.errors[0]?.message : undefined);

  const message = knownDesc || (typeof rawMessage === "string" ? rawMessage : "Statutory provider rejected request.");

  if (codeStr === "105" || codeStr === "106") {
    return { code: codeStr, category: "TOKEN_EXPIRED", message, isRetryable: true };
  }
  if (codeStr === "101" || codeStr === "102" || codeStr === "107" || codeStr === "108" || codeStr === "110" || codeStr === "111") {
    return { code: codeStr, category: "AUTHENTICATION", message, isRetryable: false };
  }
  if (codeStr === "210") {
    return { code: codeStr, category: "DUPLICATE_DOCUMENT", message, isRetryable: false };
  }
  if (codeStr === "402") {
    return { code: codeStr, category: "HSN_VALIDATION", message, isRetryable: false };
  }
  if (codeStr === "301" || codeStr === "303") {
    return { code: codeStr, category: "GSTIN_VALIDATION", message, isRetryable: false };
  }
  if (codeStr && (codeStr.startsWith("2") || codeStr.startsWith("3") || codeStr.startsWith("4") || codeStr.startsWith("5"))) {
    return { code: codeStr, category: "PAYLOAD_VALIDATION", message, isRetryable: false };
  }
  if (codeStr && (codeStr.startsWith("6") || codeStr.startsWith("7"))) {
    return { code: codeStr, category: "STATUTORY_RESTRICTION", message, isRetryable: false };
  }

  return {
    code: codeStr,
    category: "PROVIDER_ERROR",
    message,
    isRetryable: false,
  };
}
