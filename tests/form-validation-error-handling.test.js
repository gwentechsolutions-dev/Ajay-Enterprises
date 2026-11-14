import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

// ==============================================================================
// INVENTRA – Form Validation Error Handling, Field Highlighting & Auto-Scroll
// ==============================================================================

// Pure mapping and formatting functions matching src/lib/forms/validation-mapper.ts
const FIELD_LABELS = {
  customerCode: "Customer ID",
  name: "Customer / Entity Name",
  customerType: "Customer Type",
  legalBusinessName: "Legal Business Name",
  primaryMobile: "Primary Mobile",
  alternateMobile: "Alternate Mobile",
  whatsappNumber: "WhatsApp Number",
  email: "Email Address",
  pan: "PAN",
  gstStatus: "GST Registration Status",
  gstin: "GSTIN",
  billingAddress: "Billing Address",
  state: "State",
  stateCode: "State Code",
  pinCode: "PIN Code",
  creditLimit: "Credit Limit",
  paymentTermsDays: "Payment Terms (Days)",
  openingBalance: "Opening Balance",
  siteCode: "Site Code",
  siteName: "Site Name",
  fullAddress: "Full Site Address",
};

function normalizeFieldPath(path) {
  if (typeof path === "string") return path;
  if (!Array.isArray(path) || path.length === 0) return "";

  return path.reduce((acc, segment, index) => {
    if (typeof segment === "number") {
      return `${acc}[${segment}]`;
    }
    if (index === 0) {
      return String(segment);
    }
    return `${acc}.${segment}`;
  }, "");
}

function camelToTitleCase(str) {
  const result = str
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .trim();
  return result.charAt(0).toUpperCase() + result.slice(1);
}

function formatFieldLabel(path) {
  if (!path) return "General";
  if (FIELD_LABELS[path]) return FIELD_LABELS[path];

  if (path.includes(".") || path.includes("[")) {
    const parts = path
      .replace(/\[(\d+)\]/g, ".$1")
      .split(".")
      .filter(Boolean);

    const formattedParts = parts.map((part) => {
      if (/^\d+$/.test(part)) return `Item #${Number(part) + 1}`;
      if (FIELD_LABELS[part]) return FIELD_LABELS[part];
      return camelToTitleCase(part);
    });

    return formattedParts.join(" › ");
  }

  return camelToTitleCase(path);
}

function parseApiValidationErrors(data) {
  const fieldErrors = {};
  let generalError = null;

  if (!data) {
    return { fieldErrors: {}, generalError: null, errorList: [], hasErrors: false };
  }

  const issues =
    data.error?.details ||
    data.details ||
    data.issues ||
    data.error?.issues ||
    (Array.isArray(data.errors) ? data.errors : null);

  if (Array.isArray(issues)) {
    for (const issue of issues) {
      if (typeof issue === "string") {
        if (!generalError) generalError = issue;
        continue;
      }

      const pathStr = normalizeFieldPath(issue.path || issue.field);
      const message = issue.message || issue.errorMessage || "Invalid value";

      if (pathStr) {
        fieldErrors[pathStr] = message;
        const leaf = pathStr.split(".").pop()?.replace(/\[\d+\]/, "");
        if (leaf && leaf !== pathStr && !fieldErrors[leaf]) {
          fieldErrors[leaf] = message;
        }
      } else {
        if (!generalError) generalError = message;
      }
    }
  }

  const dict = data.error?.fieldErrors || data.fieldErrors;
  if (dict && typeof dict === "object") {
    for (const [key, value] of Object.entries(dict)) {
      const message = Array.isArray(value) ? value[0] : String(value);
      if (message && !fieldErrors[key]) {
        fieldErrors[key] = message;
      }
    }
  }

  const topMessage =
    data.error?.message ||
    (typeof data.error === "string" ? data.error : null) ||
    data.message;

  if (topMessage && topMessage !== "Validation failed" && Object.keys(fieldErrors).length === 0) {
    generalError = topMessage;
  } else if (!generalError && Object.keys(fieldErrors).length === 0 && topMessage) {
    generalError = topMessage;
  }

  const errorList = [];
  const seenFields = new Set();

  for (const [field, message] of Object.entries(fieldErrors)) {
    if (seenFields.has(field)) continue;
    seenFields.add(field);

    errorList.push({
      field,
      message,
      label: formatFieldLabel(field),
    });
  }

  return {
    fieldErrors,
    generalError,
    errorList,
    hasErrors: errorList.length > 0 || !!generalError,
  };
}

describe("1. Form Validation Error Mapping & Formatting", () => {
  it("should normalize array paths and indexed array paths", () => {
    assert.equal(normalizeFieldPath(["billingAddress", "pinCode"]), "billingAddress.pinCode");
    assert.equal(normalizeFieldPath(["items", 0, "quantity"]), "items[0].quantity");
    assert.equal(normalizeFieldPath("pan"), "pan");
  });

  it("should format Indian statutory fields with exact business labels", () => {
    assert.equal(formatFieldLabel("pan"), "PAN");
    assert.equal(formatFieldLabel("pinCode"), "PIN Code");
    assert.equal(formatFieldLabel("gstin"), "GSTIN");
    assert.equal(formatFieldLabel("primaryMobile"), "Primary Mobile");
    assert.equal(formatFieldLabel("billingAddress"), "Billing Address");
    assert.equal(formatFieldLabel("customerCode"), "Customer ID");
  });

  it("should format nested paths with hierarchy indicators", () => {
    assert.equal(formatFieldLabel("billingAddress.pinCode"), "Billing Address › PIN Code");
    assert.equal(formatFieldLabel("items[0].quantity"), "Items › Item #1 › Quantity");
  });
});

describe("2. Backend API Error Response Translation", () => {
  it("should extract both PAN and PIN code errors from INVENTRA API 422 response", () => {
    const apiErrorResponse = {
      success: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "Validation failed",
        details: [
          {
            code: "invalid_string",
            path: ["pan"],
            message: "Invalid PAN format (e.g. ABCDE1234F)",
          },
          {
            code: "invalid_string",
            path: ["pinCode"],
            message: "Invalid 6-digit Indian PIN Code (e.g. 560001)",
          },
        ],
      },
    };

    const result = parseApiValidationErrors(apiErrorResponse);

    assert.equal(result.hasErrors, true);
    assert.equal(result.fieldErrors.pan, "Invalid PAN format (e.g. ABCDE1234F)");
    assert.equal(result.fieldErrors.pinCode, "Invalid 6-digit Indian PIN Code (e.g. 560001)");
    assert.equal(result.errorList.length, 2);
    assert.equal(result.errorList[0].label, "PAN");
    assert.equal(result.errorList[0].message, "Invalid PAN format (e.g. ABCDE1234F)");
    assert.equal(result.errorList[1].label, "PIN Code");
    assert.equal(result.errorList[1].message, "Invalid 6-digit Indian PIN Code (e.g. 560001)");
  });

  it("should map nested paths and leaf names simultaneously for instant input matching", () => {
    const nestedApiResponse = {
      success: false,
      error: {
        code: "VALIDATION_FAILED",
        details: [
          {
            path: ["billingAddress", "pinCode"],
            message: "Invalid 6-digit Indian PIN Code (e.g. 560001)",
          },
        ],
      },
    };

    const result = parseApiValidationErrors(nestedApiResponse);

    assert.equal(result.fieldErrors["billingAddress.pinCode"], "Invalid 6-digit Indian PIN Code (e.g. 560001)");
    assert.equal(result.fieldErrors["pinCode"], "Invalid 6-digit Indian PIN Code (e.g. 560001)");
  });

  it("should handle general unmapped errors as generalError without dropping them", () => {
    const generalResponse = {
      success: false,
      error: {
        code: "DUPLICATE_CODE",
        message: "Customer code 'CUST-2026-0001' already exists.",
      },
    };

    const result = parseApiValidationErrors(generalResponse);

    assert.equal(result.hasErrors, true);
    assert.equal(result.generalError, "Customer code 'CUST-2026-0001' already exists.");
  });
});

describe("3. Client-Side Zod Pre-Flight Validation", () => {
  const customerFormSchema = z.object({
    name: z.string().min(2, "Customer or Company name is required"),
    primaryMobile: z.string().regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit Indian mobile number (e.g. 9876543210)"),
    pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format (e.g. ABCDE1234F)").optional().or(z.literal("")),
    pinCode: z.string().regex(/^[1-9][0-9]{5}$/, "Invalid 6-digit Indian PIN Code (e.g. 560001)").optional().or(z.literal("")),
  });

  it("should catch invalid PAN and PIN code before network submission", () => {
    const invalidForm = {
      name: "Prestige Projects",
      primaryMobile: "9845011223",
      pan: "INVALID",
      pinCode: "123",
    };

    const parseResult = customerFormSchema.safeParse(invalidForm);
    assert.equal(parseResult.success, false);

    const parsed = parseApiValidationErrors({ details: parseResult.error.issues });

    assert.equal(parsed.hasErrors, true);
    assert.equal(parsed.fieldErrors.pan, "Invalid PAN format (e.g. ABCDE1234F)");
    assert.equal(parsed.fieldErrors.pinCode, "Invalid 6-digit Indian PIN Code (e.g. 560001)");
  });

  it("should accept valid PAN and PIN code", () => {
    const validForm = {
      name: "Prestige Projects",
      primaryMobile: "9845011223",
      pan: "AABCP1234K",
      pinCode: "560001",
    };

    const parseResult = customerFormSchema.safeParse(validForm);
    assert.equal(parseResult.success, true);
  });
});
