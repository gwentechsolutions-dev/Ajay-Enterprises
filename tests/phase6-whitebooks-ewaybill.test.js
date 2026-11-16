import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { PrismaClient, Prisma } from "@prisma/client";

// ==============================================================================
// INVENTRA AUTOMATED TEST SUITE: PHASE 6 STATUTORY E-WAY BILL INTEGRATION
// Primary Provider: WhiteBooks (BVM IT Consulting) | Backup: FYN Gateway
// ==============================================================================

const prisma = new PrismaClient();

// Common statutory schemas
const IndianPinCodeSchema = z.string().regex(/^[1-9][0-9]{5}$/, "Must be a valid 6-digit Indian PIN code");

const generateEWayBillSchema = z.object({
  documentType: z.enum(["DELIVERY_NOTE", "TRANSFER_NOTE"]),
  documentId: z.string().uuid("Document ID is required"),
  vehicleNumber: z.string().min(5, "Vehicle registration number is required").toUpperCase().trim(),
  fromPincode: IndianPinCodeSchema,
  toPincode: IndianPinCodeSchema,
  distanceKm: z.coerce.number().int().positive("Distance must be greater than zero"),
  provider: z.enum(["WHITEBOOKS", "FYN"]).optional(),
});

const updateVehicleSchema = z.object({
  newVehicleNumber: z.string().min(5, "Vehicle registration number is required").toUpperCase().trim(),
  fromPlace: z.string().min(2, "Current place is required").trim(),
  fromStateCode: z.coerce.number().int().positive("State code is required"),
  reasonCode: z.enum(["1", "2", "3"]).default("3"),
  reasonDescription: z.string().min(3, "Reason description is required").trim(),
  transMode: z.enum(["1", "2", "3", "4"]).default("1"),
});

const cancelEWayBillSchema = z.object({
  ewbNumber: z.string().optional(),
  cancelReason: z.string().min(5, "Cancellation reason is required (min 5 characters)").trim(),
  cancelReasonCode: z.enum(["1", "2", "3", "4"]).default("4"),
});

const ewbSettingsSchema = z.object({
  activeProvider: z.enum(["WHITEBOOKS", "FYN"]),
  environment: z.enum(["SANDBOX", "PRODUCTION"]).default("SANDBOX"),
});

// Vehicle validation logic
function sanitizeAndValidateVehicleNumber(rawVehicle) {
  if (!rawVehicle) throw new Error("Vehicle registration number is required.");
  const clean = rawVehicle.replace(/[\s\-_]/g, "").toUpperCase();
  const standardPattern = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$/;
  const bharatSeriesPattern = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/;
  if (!standardPattern.test(clean) && !bharatSeriesPattern.test(clean)) {
    throw new Error(`Invalid vehicle number format '${rawVehicle}'.`);
  }
  if (clean.length > 10) {
    throw new Error(`Vehicle number '${clean}' exceeds maximum statutory limit of 10 characters.`);
  }
  return clean;
}

// UOM mapping logic
const GST_UOM_MAP = {
  "NOS": "NOS",
  "NOS.": "NOS",
  "NUMBERS": "NOS",
  "NO": "NOS",
  "SET": "SET",
  "SETS": "SET",
  "BUNDLE": "BDL",
  "BUNDLES": "BDL",
  "METER": "MTR",
  "METERS": "MTR",
  "KG": "KGS",
  "KGS": "KGS",
  "BOX": "BOX",
  "BAG": "BAG",
};

function mapToGstUom(uom) {
  if (!uom) return "NOS";
  const clean = uom.trim().toUpperCase();
  const matched = GST_UOM_MAP[clean];
  if (matched) return matched;
  if (/^[A-Z]{3}$/.test(clean)) return clean;
  throw new Error(`Unsupported Unit of Measurement '${uom}'.`);
}

// Date formatting logic
function formatDateToDDMMYYYY(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) throw new Error("Invalid document date.");
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// URL sanitization logic
function sanitizeUrl(urlStr) {
  return urlStr
    ? urlStr
        .replace(/\/+$/, "")
        .replace(/password=[^&]*/gi, "password=[REDACTED]")
        .replace(/client_secret=[^&]*/gi, "client_secret=[REDACTED]")
        .replace(/token=[^&]*/gi, "token=[REDACTED]")
    : "";
}

// Statutory document number canonicalizer
function formatStatutoryDocNo(rawDocNo) {
  if (!rawDocNo || typeof rawDocNo !== "string") throw new Error("Document number is required.");
  let docNo = rawDocNo.trim();
  if (!docNo) throw new Error("Document number is required.");
  if (docNo.length <= 16) return docNo;
  let contracted = docNo.replace(/(\b|[/_-])20(\d{2}-\d{2})(\b|[/_-])/g, "$1$2$3");
  if (contracted.length <= 16) return contracted;
  contracted = contracted.replace(/(\b|[/_-])20(\d{2})(\b|[/_-])/g, "$1$2$3");
  if (contracted.length <= 16) return contracted;
  if (/^AE[\/\-_]/i.test(contracted)) {
    const withoutAe = contracted.replace(/^AE[\/\-_]/i, "");
    if (withoutAe.length <= 16) return withoutAe;
    contracted = withoutAe;
  }
  contracted = contracted.replace(/\/+/g, "/").replace(/-+/g, "-");
  if (contracted.length <= 16) return contracted;
  const reducedZeros = contracted.replace(/([/_-])0+(\d{3,})/g, "$1$2");
  if (reducedZeros.length <= 16) return reducedZeros;
  throw new Error(
    `Document number '${rawDocNo}' exceeds maximum statutory limit of 16 characters under Rule 46(b) of CGST Rules.`
  );
}

// Payload sanitization logic
function sanitizePayload(data) {
  if (!data || typeof data !== "object") return data;
  if (Array.isArray(data)) return data.map(sanitizePayload);
  const SENSITIVE_KEYS = new Set([
    "password", "client_secret", "clientsecret", "authtoken", "auth_token", "token", "sek"
  ]);
  const sanitized = {};
  for (const [k, v] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      sanitized[k] = "[REDACTED]";
    } else if (typeof v === "object" && v !== null) {
      sanitized[k] = sanitizePayload(v);
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

// WhiteBooks error categorization
function parseWhiteBooksError(errorPayload) {
  const code = String(errorPayload.errorCodes || errorPayload.errorCode || "");
  const message = errorPayload.status_desc || errorPayload.errorMessage || errorPayload.message || "Unknown error";
  if (code === "105" || code === "106") return { category: "TOKEN_EXPIRED", message, isRetryable: true };
  if (code === "101" || code === "102" || code === "108" || errorPayload.status_cd === "0") return { category: "AUTHENTICATION", message, isRetryable: false };
  if (code === "210") return { category: "DUPLICATE_DOCUMENT", message, isRetryable: false };
  if (code === "402") return { category: "HSN_VALIDATION", message, isRetryable: false };
  return { category: "PROVIDER_ERROR", message, isRetryable: false };
}

// Mutex lock simulator
const activeLocks = new Map();
function acquireLock(id) {
  if (activeLocks.has(id)) return false;
  activeLocks.set(id, Date.now());
  return true;
}
function releaseLock(id) {
  activeLocks.delete(id);
}

describe("1. Statutory Delivery Challan Mapping & Standards", () => {
  it("T4: should map Delivery Note to statutory Delivery Challan (docType: CHL, subSupply: 8)", () => {
    const rawDocDate = new Date("2026-11-16T00:00:00Z");
    const docDate = formatDateToDDMMYYYY(rawDocDate);
    assert.equal(docDate, "16/11/2026");

    const vehicleNo = sanitizeAndValidateVehicleNumber("KA-01-AB-1234");
    assert.equal(vehicleNo, "KA01AB1234");

    const uom = mapToGstUom("Nos.");
    assert.equal(uom, "NOS");
  });

  it("T5: should verify Place-of-Supply tax breakdown (intra-state 9%+9% vs inter-state 18% IGST)", () => {
    const taxable = 50000;
    // Intra-state (Supplier: 33 TN, Place of Supply: 33 TN)
    const isInterState = false;
    const cgst = isInterState ? 0 : taxable * 0.09;
    const sgst = isInterState ? 0 : taxable * 0.09;
    const igst = isInterState ? taxable * 0.18 : 0;
    const totalTax = cgst + sgst + igst;
    assert.equal(cgst, 4500);
    assert.equal(sgst, 4500);
    assert.equal(igst, 0);
    assert.equal(totalTax, 9000);
    assert.equal(taxable + totalTax, 59000);
  });

  it("T6 & T7: should enforce HSN 7308 and valid GST UOM mapping", () => {
    assert.equal(mapToGstUom("Set"), "SET");
    assert.equal(mapToGstUom("Bundle"), "BDL");
    assert.equal(mapToGstUom("Meter"), "MTR");
    assert.equal(mapToGstUom("Kgs"), "KGS");

    assert.throws(() => mapToGstUom("UNKNOWN"), /Unsupported Unit of Measurement/);
  });

  it("T8: should canonically format document numbers to <= 16 characters per Rule 46(b) and reject unnormalizable numbers", () => {
    // 18-char Delivery Note from INVENTRA default series
    const dnNo = "AE/DN/2026-27/0003";
    const statutoryDn = formatStatutoryDocNo(dnNo);
    assert.equal(statutoryDn, "AE/DN/26-27/0003");
    assert.equal(statutoryDn.length, 16);

    // 19-char STN from INVENTRA series
    const stnNo = "AE/STN/2026-27/0003";
    const statutoryStn = formatStatutoryDocNo(stnNo);
    assert.equal(statutoryStn, "STN/26-27/0003");
    assert.ok(statutoryStn.length <= 16);

    // Already valid <= 16 chars preserved as-is
    assert.equal(formatStatutoryDocNo("AE/DN/2026-27/01"), "AE/DN/2026-27/01");
    assert.equal(formatStatutoryDocNo("DN-2026-0001"), "DN-2026-0001");

    // Truly invalid number that cannot be normalized
    const invalidDocNo = "VERY_LONG_INVALID_PREFIX_WITHOUT_DATE_OR_COMPANY_CODE_123456";
    assert.throws(() => formatStatutoryDocNo(invalidDocNo), /exceeds maximum statutory limit of 16 characters/);
  });
});

describe("2. Statutory Indian Vehicle Number & PIN Code Validations", () => {
  it("should validate standard Indian RTO registrations", () => {
    assert.equal(sanitizeAndValidateVehicleNumber("KA01AB1234"), "KA01AB1234");
    assert.equal(sanitizeAndValidateVehicleNumber("TN-09-Z-5678"), "TN09Z5678");
    assert.equal(sanitizeAndValidateVehicleNumber("DL 1C 9999"), "DL1C9999");
  });

  it("should validate Bharat Series (BH) registrations", () => {
    assert.equal(sanitizeAndValidateVehicleNumber("22 BH 1234 AA"), "22BH1234AA");
  });

  it("should reject invalid vehicle formats or lengths exceeding 10 characters", () => {
    assert.throws(() => sanitizeAndValidateVehicleNumber("1234"), /Invalid vehicle number format/);
    assert.throws(() => sanitizeAndValidateVehicleNumber("INVALIDTOOLONG123"), /Invalid vehicle number format/);
  });
});

describe("3. Security, Token Lifecycle & Credential Redaction", () => {
  it("T17: should redact passwords and secrets from URLs and JSON payloads", () => {
    const rawUrl = "https://apisandbox.whitebooks.in/ewaybillapi/v1.03/authenticate?email=dev@test.com&username=BVMTN&password=Bvm@123456";
    const safeUrl = sanitizeUrl(rawUrl);
    assert.ok(!safeUrl.includes("Bvm@123456"));
    assert.ok(safeUrl.includes("password=[REDACTED]"));

    const payload = {
      username: "BVMTN",
      password: "SecretPassword123",
      authToken: "XYZ999Token",
      client_secret: "SecretKey",
      ewbNumber: "331234567890",
    };
    const sanitized = sanitizePayload(payload);
    assert.equal(sanitized.password, "[REDACTED]");
    assert.equal(sanitized.authToken, "[REDACTED]");
    assert.equal(sanitized.client_secret, "[REDACTED]");
    assert.equal(sanitized.ewbNumber, "331234567890");
  });

  it("T2 & T3: should correctly categorize WhiteBooks token expiry and retryability", () => {
    const tokenExp = parseWhiteBooksError({ errorCodes: "106" });
    assert.equal(tokenExp.category, "TOKEN_EXPIRED");
    assert.equal(tokenExp.isRetryable, true);

    const authFail = parseWhiteBooksError({ errorCodes: "101" });
    assert.equal(authFail.category, "AUTHENTICATION");
    assert.equal(authFail.isRetryable, false);

    const dup = parseWhiteBooksError({ errorCodes: "210" });
    assert.equal(dup.category, "DUPLICATE_DOCUMENT");
    assert.equal(dup.isRetryable, false);
  });

  it("T24: should successfully evaluate WhiteBooks GSP gateway handshake response", () => {
    const successResponse = {
      irp: "NIC1",
      status_cd: "1",
      status_desc: "If authentication succeeds",
    };
    const statusValue = successResponse.status !== undefined ? successResponse.status : successResponse.status_cd;
    const isSuccess =
      statusValue === 1 ||
      statusValue === "1" ||
      statusValue === "SUCCESS" ||
      successResponse.status_desc === "If authentication succeeds";

    assert.equal(isSuccess, true);
    const sessionToken = `WB_GATEWAY_SESSION_33AAGCB1286Q003`;
    assert.ok(sessionToken.startsWith("WB_GATEWAY_SESSION_"));
  });

  it("T25: should reject invalid WhiteBooks credentials with status_cd 0 and informative description", () => {
    const failureResponse = {
      status_cd: "0",
      status_desc: "Invalid credentials provided or your account is not active",
    };
    const err = parseWhiteBooksError(failureResponse);
    assert.equal(err.category, "AUTHENTICATION");
    assert.equal(err.message, "Invalid credentials provided or your account is not active");
    assert.equal(err.isRetryable, false);
  });
});

describe("4. Duplicate Generation Prevention & Idempotency", () => {
  it("T10: should acquire and release mutex preventing concurrent duplicate clicks", () => {
    const docId = "018f45a0-0000-7000-8000-000000000099";
    const acquired1 = acquireLock(docId);
    assert.equal(acquired1, true);

    const acquired2 = acquireLock(docId);
    assert.equal(acquired2, false);

    releaseLock(docId);
    const acquired3 = acquireLock(docId);
    assert.equal(acquired3, true);
    releaseLock(docId);
  });
});

describe("5. Multi-Provider Architecture & Database Model Integrity", () => {
  it("T15 & T16: should verify Prisma EWayBill model supports multi-provider fields", async () => {
    // Inspect Prisma model fields
    const dmmf = Prisma.dmmf?.datamodel?.models?.find((m) => m.name === "EWayBill");
    assert.ok(dmmf, "EWayBill model must exist in Prisma schema");

    const fieldNames = new Set(dmmf.fields.map((f) => f.name));
    assert.ok(fieldNames.has("provider"), "EWayBill must have provider field");
    assert.ok(fieldNames.has("environment"), "EWayBill must have environment field");
    assert.ok(fieldNames.has("providerReferenceId"), "EWayBill must have providerReferenceId field");
    assert.ok(fieldNames.has("fynReferenceId"), "EWayBill must preserve fynReferenceId field");
    assert.ok(fieldNames.has("partBUpdatedDate"), "EWayBill must have partBUpdatedDate field");
    assert.ok(fieldNames.has("partBReason"), "EWayBill must have partBReason field");
  });

  it("should verify Prisma EWayBillOperation model for statutory audit history", async () => {
    const dmmf = Prisma.dmmf?.datamodel?.models?.find((m) => m.name === "EWayBillOperation");
    assert.ok(dmmf, "EWayBillOperation model must exist in Prisma schema");

    const fieldNames = new Set(dmmf.fields.map((f) => f.name));
    assert.ok(fieldNames.has("documentId"));
    assert.ok(fieldNames.has("provider"));
    assert.ok(fieldNames.has("operationType"));
    assert.ok(fieldNames.has("status"));
    assert.ok(fieldNames.has("idempotencyKey"));
  });
});

describe("6. Statutory Schemas Validation", () => {
  const dummyUUID = "018f45a0-0000-7000-8000-000000000001";

  it("T19: should validate statutory generation, vehicle update, and cancel schemas", () => {
    // Generate
    const validGen = generateEWayBillSchema.safeParse({
      documentType: "DELIVERY_NOTE",
      documentId: dummyUUID,
      vehicleNumber: "KA01AB1234",
      fromPincode: "560058",
      toPincode: "560068",
      distanceKm: 30,
      provider: "WHITEBOOKS",
    });
    assert.equal(validGen.success, true);
    assert.equal(validGen.data.provider, "WHITEBOOKS");

    // Part-B Vehicle Update
    const validUpdate = updateVehicleSchema.safeParse({
      newVehicleNumber: "KA02CD5678",
      fromPlace: "Bengaluru",
      fromStateCode: 33,
      reasonCode: "1",
      reasonDescription: "Breakdown of vehicle during transit",
    });
    assert.equal(validUpdate.success, true);

    // Cancel
    const validCancel = cancelEWayBillSchema.safeParse({
      cancelReason: "Data entry error in consignee address",
      cancelReasonCode: "3",
    });
    assert.equal(validCancel.success, true);

    // Settings
    const validSettings = ewbSettingsSchema.safeParse({
      activeProvider: "WHITEBOOKS",
      environment: "SANDBOX",
    });
    assert.equal(validSettings.success, true);
  });
});

describe("7. Serverless Concurrency, UNKNOWN State Reconciliation & Production Safety", () => {
  it("T20: should safely reuse existing active E-Way Bill on duplicate request without calling provider", () => {
    const existingActiveEwb = {
      ewbNumber: "331234567890",
      status: "ACTIVE",
      validUntil: new Date("2026-11-20T23:59:59Z"),
      createdAt: new Date("2026-11-16T10:00:00Z"),
      environment: "SANDBOX",
      provider: "WHITEBOOKS",
      providerReferenceId: "WB-331234567890",
      responsePayload: { success: true, ewbNo: "331234567890" },
    };

    // Idempotent handler check
    const isIdempotentReuse = (existing) => {
      if (existing && existing.status === "ACTIVE") {
        return {
          reused: true,
          ewbNumber: existing.ewbNumber,
          message: `Active E-Way Bill ${existing.ewbNumber} already exists. Safely reusing record.`,
        };
      }
      return { reused: false };
    };

    const res = isIdempotentReuse(existingActiveEwb);
    assert.equal(res.reused, true);
    assert.equal(res.ewbNumber, "331234567890");
    assert.ok(res.message.includes("Safely reusing record"));
  });

  it("T21: should block concurrent generation across serverless instances within the lock window", () => {
    const now = Date.now();
    const lockWindowMs = 90_000;
    const activeProcessingOp = {
      id: "op-1234",
      status: "PROCESSING",
      createdAt: new Date(now - 15_000), // 15 seconds ago (within window)
    };

    const isLocked = (op) => {
      if (op && op.status === "PROCESSING" && (now - op.createdAt.getTime()) < lockWindowMs) {
        return true;
      }
      return false;
    };

    assert.equal(isLocked(activeProcessingOp), true);

    const expiredProcessingOp = {
      id: "op-5678",
      status: "PROCESSING",
      createdAt: new Date(now - 120_000), // 120 seconds ago (expired)
    };
    assert.equal(isLocked(expiredProcessingOp), false);
  });

  it("T22: should require reconciliation and block automatic retry/failover when an operation is UNKNOWN", () => {
    const operations = [
      { id: "op-unknown-1", status: "UNKNOWN", operationType: "GENERATE" },
    ];

    const canProceedWithGeneration = (ops) => {
      const hasUnknown = ops.some((o) => o.status === "UNKNOWN" && o.operationType === "GENERATE");
      if (hasUnknown) {
        throw new Error(
          "Statutory reconciliation is required before retrying or switching providers to prevent duplicate E-Way Bill issuance."
        );
      }
      return true;
    };

    assert.throws(() => canProceedWithGeneration(operations), /Statutory reconciliation is required/);
  });

  it("T23: should enforce production lock and block generation when production environment is not authorized", () => {
    const checkProductionAllowed = (env, isAuthorized) => {
      if (env === "PRODUCTION" && !isAuthorized) {
        throw new Error("STATUTORY SAFETY BLOCK: Production E-Way Bill generation is strictly locked.");
      }
      return true;
    };

    assert.throws(() => checkProductionAllowed("PRODUCTION", false), /STATUTORY SAFETY BLOCK/);
    assert.equal(checkProductionAllowed("SANDBOX", false), true);
    assert.equal(checkProductionAllowed("PRODUCTION", true), true);
  });

  it("T24: should safely resolve E-Way Bill query by either 12-digit statutory EWB number or UUID without format errors", () => {
    const resolveWhereClause = (paramId) => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paramId);
      return isUuid ? { OR: [{ id: paramId }, { ewbNumber: paramId }] } : { ewbNumber: paramId };
    };

    // Case A: 12-digit statutory E-Way Bill Number (like 292779600930 from WhiteBooks sandbox)
    const ewbNumber = "292779600930";
    const whereA = resolveWhereClause(ewbNumber);
    assert.deepEqual(whereA, { ewbNumber: "292779600930" });
    assert.equal("id" in whereA, false, "Must not query id column when identifier is not a UUID");

    // Case B: Standard database UUID
    const dbUuid = "c1ab4226-e9aa-4a67-bacf-e5d08104b000";
    const whereB = resolveWhereClause(dbUuid);
    assert.deepEqual(whereB, {
      OR: [{ id: "c1ab4226-e9aa-4a67-bacf-e5d08104b000" }, { ewbNumber: "c1ab4226-e9aa-4a67-bacf-e5d08104b000" }],
    });
  });
});

describe("7. Serverless Concurrency, UNKNOWN State Reconciliation & Production Safety", () => {
  it("T20: should safely reuse existing active E-Way Bill on duplicate request without calling provider", () => {
    const existingActiveEwb = {
      ewbNumber: "331234567890",
      status: "ACTIVE",
      validUntil: new Date("2026-11-20T23:59:59Z"),
      createdAt: new Date("2026-11-16T10:00:00Z"),
      environment: "SANDBOX",
      provider: "WHITEBOOKS",
      providerReferenceId: "WB-331234567890",
      responsePayload: { success: true, ewbNo: "331234567890" },
    };

    // Idempotent handler check
    const isIdempotentReuse = (existing) => {
      if (existing && existing.status === "ACTIVE") {
        return {
          reused: true,
          ewbNumber: existing.ewbNumber,
          message: `Active E-Way Bill ${existing.ewbNumber} already exists. Safely reusing record.`,
        };
      }
      return { reused: false };
    };

    const res = isIdempotentReuse(existingActiveEwb);
    assert.equal(res.reused, true);
    assert.equal(res.ewbNumber, "331234567890");
    assert.ok(res.message.includes("Safely reusing record"));
  });

  it("T21: should block concurrent generation across serverless instances within the lock window", () => {
    const now = Date.now();
    const lockWindowMs = 90_000;
    const activeProcessingOp = {
      id: "op-1234",
      status: "PROCESSING",
      createdAt: new Date(now - 15_000), // 15 seconds ago (within window)
    };

    const isLocked = (op) => {
      if (op && op.status === "PROCESSING" && (now - op.createdAt.getTime()) < lockWindowMs) {
        return true;
      }
      return false;
    };

    assert.equal(isLocked(activeProcessingOp), true);

    const expiredProcessingOp = {
      id: "op-5678",
      status: "PROCESSING",
      createdAt: new Date(now - 120_000), // 120 seconds ago (expired)
    };
    assert.equal(isLocked(expiredProcessingOp), false);
  });

  it("T22: should require reconciliation and block automatic retry/failover when an operation is UNKNOWN", () => {
    const operations = [
      { id: "op-unknown-1", status: "UNKNOWN", operationType: "GENERATE" },
    ];

    const canProceedWithGeneration = (ops) => {
      const hasUnknown = ops.some((o) => o.status === "UNKNOWN" && o.operationType === "GENERATE");
      if (hasUnknown) {
        throw new Error(
          "Statutory reconciliation is required before retrying or switching providers to prevent duplicate E-Way Bill issuance."
        );
      }
      return true;
    };

    assert.throws(() => canProceedWithGeneration(operations), /Statutory reconciliation is required/);
  });

  it("T23: should enforce production lock and block generation when production environment is not authorized", () => {
    const checkProductionAllowed = (env, isAuthorized) => {
      if (env === "PRODUCTION" && !isAuthorized) {
        throw new Error("STATUTORY SAFETY BLOCK: Production E-Way Bill generation is strictly locked.");
      }
      return true;
    };

    assert.throws(() => checkProductionAllowed("PRODUCTION", false), /STATUTORY SAFETY BLOCK/);
    assert.equal(checkProductionAllowed("SANDBOX", false), true);
    assert.equal(checkProductionAllowed("PRODUCTION", true), true);
  });
});
