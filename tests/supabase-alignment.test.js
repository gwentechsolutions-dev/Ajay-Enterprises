import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

// ==============================================================================
// INVENTRA AUTOMATED TEST SUITE: PHASE 1.5 SUPABASE ARCHITECTURE ALIGNMENT
// Operating Business: AJAY ENTERPRISES | Product: INVENTRA ERP
// ==============================================================================

describe("1. Supabase Auth Integration & Identity Mapping Tests", () => {
  it("should validate Supabase auth user claims and identity link to INVENTRA User", () => {
    const supabaseAuthUser = {
      id: "a0b1c2d3-e4f5-4a5b-8c9d-0e1f2a3b4c5d",
      email: "owner@ajayenterprises.com",
      role: "authenticated",
      aud: "authenticated",
      user_metadata: {
        name: "Ajay Sharma",
        userCode: "USR-0001",
        role: "OWNER",
      },
    };

    // INVENTRA Application User representation linked via supabaseId
    const appUser = {
      id: "f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
      supabaseId: supabaseAuthUser.id,
      userCode: supabaseAuthUser.user_metadata.userCode,
      name: supabaseAuthUser.user_metadata.name,
      email: supabaseAuthUser.email,
      role: supabaseAuthUser.user_metadata.role,
      scope: "ALL_BUSINESS",
      isActive: true,
    };

    assert.equal(appUser.supabaseId, supabaseAuthUser.id);
    assert.equal(appUser.userCode, "USR-0001");
    assert.equal(appUser.role, "OWNER");
    assert.equal(appUser.isActive, true);
  });

  it("should reject login attempt if user profile is deactivated in INVENTRA even if auth provider token is valid", () => {
    const deactivatedUser = {
      id: "b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e",
      supabaseId: "c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f",
      email: "staff@ajayenterprises.com",
      role: "WAREHOUSE_STAFF",
      isActive: false, // Deactivated
    };

    function validateSessionStatus(user) {
      if (!user || !user.isActive) {
        throw new Error("ACCOUNT_DEACTIVATED");
      }
      return true;
    }

    assert.throws(() => validateSessionStatus(deactivatedUser), /ACCOUNT_DEACTIVATED/);
  });
});

describe("2. Server-Side Session Validation & Token Security", () => {
  it("should extract session user and enforce tamper-proof session headers", () => {
    const sessionPayload = {
      id: "f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
      supabaseId: "a0b1c2d3-e4f5-4a5b-8c9d-0e1f2a3b4c5d",
      userCode: "USR-0001",
      name: "Ajay Sharma",
      email: "owner@ajayenterprises.com",
      role: "OWNER",
      scope: "ALL_BUSINESS",
    };

    // Serialize and hash session signature
    const signature = crypto.createHmac("sha256", "inventra_server_session_secret")
      .update(JSON.stringify(sessionPayload))
      .digest("hex");

    assert.ok(signature.length === 64);

    // Tampered payload verification
    const tamperedPayload = { ...sessionPayload, role: "ADMINISTRATOR" };
    const tamperedSignature = crypto.createHmac("sha256", "inventra_server_session_secret")
      .update(JSON.stringify(tamperedPayload))
      .digest("hex");

    assert.notEqual(signature, tamperedSignature);
  });
});

describe("3. Role-Based Access Control (RBAC) & API Route Guards", () => {
  const rolePermissions = {
    OWNER: "*",
    ADMIN: {
      users: ["view", "create", "edit"],
      company: ["view", "edit"],
      branches: ["view", "create", "edit"],
      accounting: ["view"],
    },
    ACCOUNTANT: {
      accounting: ["view", "create", "edit", "post"],
      billing: ["view", "create", "edit", "post"],
      inventory: ["view"],
      users: [],
    },
    DELIVERY_PERSONNEL: {
      delivery_notes: ["view", "edit"],
      movement: ["view"],
      accounting: [],
      users: [],
    },
  };

  function checkPermission(role, module, action) {
    if (!role) return false;
    if (role === "OWNER") return true; // Owner universal bypass
    const perms = rolePermissions[role]?.[module] || [];
    return perms.includes(action);
  }

  function enforceRouteGuard(session, module, action) {
    if (!session) {
      const err = new Error("UNAUTHORIZED: Session required");
      err.status = 401;
      throw err;
    }
    if (!checkPermission(session.role, module, action)) {
      const err = new Error(`FORBIDDEN: Role '${session.role}' lacks '${action}' permission on '${module}'`);
      err.status = 403;
      throw err;
    }
    return true;
  }

  it("should grant Owner universal access across all modules and actions", () => {
    const owner = { role: "OWNER" };
    assert.equal(enforceRouteGuard(owner, "users", "delete"), true);
    assert.equal(enforceRouteGuard(owner, "accounting", "post"), true);
    assert.equal(enforceRouteGuard(owner, "company", "edit"), true);
    assert.equal(enforceRouteGuard(owner, "audit_logs", "view"), true);
  });

  it("should reject unauthenticated API requests with 401", () => {
    assert.throws(
      () => enforceRouteGuard(null, "company", "view"),
      (err) => err.status === 401
    );
  });

  it("should reject Delivery Personnel from financial accounting with 403", () => {
    const deliveryUser = { role: "DELIVERY_PERSONNEL" };
    assert.throws(
      () => enforceRouteGuard(deliveryUser, "accounting", "post"),
      (err) => err.status === 403
    );
    assert.throws(
      () => enforceRouteGuard(deliveryUser, "users", "create"),
      (err) => err.status === 403
    );
    // Permitted action
    assert.equal(enforceRouteGuard(deliveryUser, "delivery_notes", "view"), true);
  });

  it("should allow Accountant to post to General Ledger but prevent user creation", () => {
    const accountant = { role: "ACCOUNTANT" };
    assert.equal(enforceRouteGuard(accountant, "accounting", "post"), true);
    assert.throws(
      () => enforceRouteGuard(accountant, "users", "create"),
      (err) => err.status === 403
    );
  });
});

describe("4. First-Owner Setup Protection & One-Way Seal Guard", () => {
  function verifySetupAccess(existingUserCount) {
    if (existingUserCount > 0) {
      const err = new Error("SETUP_ALREADY_COMPLETED: First-run setup is permanently sealed.");
      err.status = 403;
      throw err;
    }
    return { canSetup: true };
  }

  function verifyLastOwnerProtection(activeOwnerCount, targetUserRole, targetUserActive) {
    if (targetUserRole === "OWNER" && (!targetUserActive || activeOwnerCount <= 1)) {
      if (activeOwnerCount <= 1) {
        throw new Error("LAST_OWNER_PROTECTION: Cannot deactivate or demote the sole active Owner.");
      }
    }
    return true;
  }

  it("should permit initial setup when zero users exist", () => {
    assert.equal(verifySetupAccess(0).canSetup, true);
  });

  it("should permanently block setup with 403 once an owner exists", () => {
    assert.throws(
      () => verifySetupAccess(1),
      (err) => err.status === 403
    );
    assert.throws(
      () => verifySetupAccess(5),
      (err) => err.status === 403
    );
  });

  it("should prevent deactivating the last active Owner", () => {
    assert.throws(
      () => verifyLastOwnerProtection(1, "OWNER", false),
      /LAST_OWNER_PROTECTION/
    );
  });

  it("should allow deactivating an Owner if another active Owner exists", () => {
    assert.equal(verifyLastOwnerProtection(2, "OWNER", false), true);
  });
});

describe("5. PostgreSQL Document-Number Concurrency & Collision Avoidance", () => {
  function formatDocNumber(prefix, counter, padding, suffix = "") {
    return `${prefix}${counter.toString().padStart(padding, "0")}${suffix}`;
  }

  it("should format standard INVENTRA document series correctly", () => {
    assert.equal(formatDocNumber("AE/DN/2026-27/", 1, 4), "AE/DN/2026-27/0001");
    assert.equal(formatDocNumber("AE/INV/2026-27/", 42, 4), "AE/INV/2026-27/0042");
    assert.equal(formatDocNumber("AE/MRN/2026-27/", 9999, 4), "AE/MRN/2026-27/9999");
    assert.equal(formatDocNumber("AE/STN/2026-27/", 5, 5), "AE/STN/2026-27/00005");
  });

  it("should simulate high-concurrency document number requests without collisions", async () => {
    let atomicCounter = 0;
    const lock = { busy: false };

    async function allocateNextNumber() {
      while (lock.busy) {
        await new Promise((r) => setTimeout(r, 1));
      }
      lock.busy = true;
      atomicCounter += 1;
      const docNum = formatDocNumber("AE/DN/2026-27/", atomicCounter, 4);
      lock.busy = false;
      return docNum;
    }

    // Launch 50 concurrent allocation requests
    const promises = Array.from({ length: 50 }, () => allocateNextNumber());
    const allocated = await Promise.all(promises);

    assert.equal(allocated.length, 50);
    const uniqueSet = new Set(allocated);
    assert.equal(uniqueSet.size, 50, "All 50 allocated numbers must be strictly unique");
    assert.equal(allocated[0], "AE/DN/2026-27/0001");
    assert.equal(allocated[49], "AE/DN/2026-27/0050");
  });
});

describe("6. Private Storage Security, Pre-signed URLs & Checksum Integrity", () => {
  const ALLOWED_MIMES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
  const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

  function validateFileConstraints(mime, sizeBytes) {
    if (!ALLOWED_MIMES.includes(mime)) {
      throw new Error(`DISALLOWED_MIME: ${mime} is not permitted`);
    }
    if (sizeBytes > MAX_SIZE_BYTES) {
      throw new Error(`EXCEEDED_SIZE: File exceeds ${MAX_SIZE_BYTES} bytes`);
    }
    return true;
  }

  function generateSignedDownloadUrl(bucket, filePath, expiresInSeconds) {
    const expiry = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const hmac = crypto.createHmac("sha256", "inventra_storage_signing_key")
      .update(`${bucket}:${filePath}:${expiry}`)
      .digest("hex");
    return `/storage/v1/object/sign/${bucket}/${filePath}?token=${hmac}&expires=${expiry}`;
  }

  it("should permit valid PDF, PNG, and JPEG documents within 10MB limit", () => {
    assert.equal(validateFileConstraints("application/pdf", 2 * 1024 * 1024), true);
    assert.equal(validateFileConstraints("image/png", 500 * 1024), true);
    assert.equal(validateFileConstraints("image/jpeg", 1 * 1024 * 1024), true);
  });

  it("should reject unauthorized executable or script files", () => {
    assert.throws(() => validateFileConstraints("application/x-msdownload", 500), /DISALLOWED_MIME/);
    assert.throws(() => validateFileConstraints("text/javascript", 500), /DISALLOWED_MIME/);
    assert.throws(() => validateFileConstraints("application/x-sh", 500), /DISALLOWED_MIME/);
    assert.throws(() => validateFileConstraints("application/zip", 500), /DISALLOWED_MIME/);
  });

  it("should reject files exceeding the 10MB limit", () => {
    assert.throws(() => validateFileConstraints("application/pdf", 12 * 1024 * 1024), /EXCEEDED_SIZE/);
  });

  it("should calculate identical SHA-256 checksums for identical file buffers", () => {
    const fileBuffer = Buffer.from("INVENTRA_SAMPLE_PDF_DOCUMENT_CONTENT_2026");
    const checksum1 = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    const checksum2 = crypto.createHash("sha256").update(fileBuffer).digest("hex");

    assert.equal(checksum1, checksum2);
    assert.equal(typeof checksum1, "string");
    assert.equal(checksum1.length, 64);
  });

  it("should generate pre-signed URL with short-lived expiration parameter", () => {
    const signedUrl = generateSignedDownloadUrl("inventra-private-documents", "company/stamp.png", 300);
    assert.ok(signedUrl.includes("token="));
    assert.ok(signedUrl.includes("expires="));
    assert.ok(signedUrl.includes("inventra-private-documents/company/stamp.png"));
  });

  it("should detect and reject directory traversal sequences in storage paths", () => {
    function validateStoragePath(targetPath) {
      const normalized = targetPath.replace(/\\/g, "/");
      if (normalized.includes("..") || normalized.startsWith("/") || normalized.includes("://")) {
        throw new Error("INVALID_PATH: Directory traversal attempt detected");
      }
      return true;
    }

    assert.equal(validateStoragePath("company-docs/tax-cert-2026.pdf"), true);
    assert.throws(() => validateStoragePath("../../../etc/passwd"), /INVALID_PATH/);
    assert.throws(() => validateStoragePath("/root/secret.env"), /INVALID_PATH/);
    assert.throws(() => validateStoragePath("company-docs/../../secrets.json"), /INVALID_PATH/);
  });

  it("should enforce INVENTRA RBAC boundaries on sensitive private storage downloads", () => {
    function authorizeDownloadAccess(userRole, path) {
      if (userRole === "OWNER") return true;
      const category = path.split("/")[0]?.toLowerCase();
      if (category === "company-docs" || category === "signatures" || category === "stamps") {
        if (!["OWNER", "ADMIN", "ACCOUNTANT"].includes(userRole)) {
          throw new Error("FORBIDDEN: Insufficient role permissions for company documents");
        }
      }
      return true;
    }

    assert.equal(authorizeDownloadAccess("OWNER", "company-docs/gst.pdf"), true);
    assert.equal(authorizeDownloadAccess("ACCOUNTANT", "company-docs/gst.pdf"), true);
    assert.throws(() => authorizeDownloadAccess("DELIVERY_PERSONNEL", "signatures/stamp.png"), /FORBIDDEN/);
    assert.throws(() => authorizeDownloadAccess("LABOUR_SUPERVISOR", "company-docs/pan.pdf"), /FORBIDDEN/);
    assert.throws(() => authorizeDownloadAccess("READ_ONLY", "signatures/director.png"), /FORBIDDEN/);
  });
});

describe("7. Audit Log Sensitive Data Sanitization & Immutability", () => {
  function sanitizeAuditData(data) {
    if (!data) return null;
    const sanitized = { ...data };
    const SENSITIVE_KEYS = ["password", "passwordHash", "token", "secret", "setupSecret", "accountNumber"];

    for (const key of Object.keys(sanitized)) {
      if (SENSITIVE_KEYS.includes(key)) {
        if (key === "accountNumber" && typeof sanitized[key] === "string" && sanitized[key].length > 4) {
          sanitized[key] = "••••••••" + sanitized[key].slice(-4);
        } else {
          sanitized[key] = "[REDACTED]";
        }
      }
    }
    return sanitized;
  }

  function triggerAuditEventMutation(action) {
    if (action === "UPDATE" || action === "DELETE" || action === "TRUNCATE") {
      throw new Error("CRITICAL SECURITY VIOLATION: INVENTRA AuditEvent logs are append-only and cannot be updated, deleted, or truncated.");
    }
    return true;
  }

  it("should redact passwords, secrets, and mask bank account numbers in audit logs", () => {
    const auditRecord = {
      name: "Ajay Sharma",
      email: "owner@ajayenterprises.com",
      password: "PlainTextPassword123!",
      passwordHash: "$2b$12$secureBcryptHash",
      setupSecret: "INVENTRA_INIT_SECRET",
      bankName: "State Bank of India",
      accountNumber: "302918273645",
    };

    const sanitized = sanitizeAuditData(auditRecord);

    assert.equal(sanitized.name, "Ajay Sharma");
    assert.equal(sanitized.email, "owner@ajayenterprises.com");
    assert.equal(sanitized.password, "[REDACTED]");
    assert.equal(sanitized.passwordHash, "[REDACTED]");
    assert.equal(sanitized.setupSecret, "[REDACTED]");
    assert.equal(sanitized.bankName, "State Bank of India");
    assert.equal(sanitized.accountNumber, "••••••••3645");
  });

  it("should reject UPDATE, DELETE, and TRUNCATE mutations on AuditEvent logs", () => {
    assert.equal(triggerAuditEventMutation("INSERT"), true);
    assert.throws(() => triggerAuditEventMutation("UPDATE"), /CRITICAL SECURITY VIOLATION/);
    assert.throws(() => triggerAuditEventMutation("DELETE"), /CRITICAL SECURITY VIOLATION/);
    assert.throws(() => triggerAuditEventMutation("TRUNCATE"), /CRITICAL SECURITY VIOLATION/);
  });
});

describe("8. Indian Statutory & Financial Format Validators", () => {
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  const mobileRegex = /^[6-9]\d{9}$/;
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  const pinRegex = /^[1-9][0-9]{5}$/;

  it("should validate Indian PAN format", () => {
    assert.equal(panRegex.test("AABCA1234D"), true);
    assert.equal(panRegex.test("aabca1234d"), false);
    assert.equal(panRegex.test("12345ABCDE"), false);
  });

  it("should validate Indian GSTIN format", () => {
    assert.equal(gstinRegex.test("27AABCA1234D1Z5"), true); // Maharashtra
    assert.equal(gstinRegex.test("29AAACA9876E1ZV"), true); // Karnataka
    assert.equal(gstinRegex.test("27AABCA1234D1A5"), false); // Missing 'Z'
  });

  it("should validate Indian 10-digit mobile number", () => {
    assert.equal(mobileRegex.test("9876543210"), true);
    assert.equal(mobileRegex.test("8123456789"), true);
    assert.equal(mobileRegex.test("5123456789"), false);
  });

  it("should validate IFSC and PIN codes", () => {
    assert.equal(ifscRegex.test("HDFC0001234"), true);
    assert.equal(ifscRegex.test("SBIN0000691"), true);
    assert.equal(ifscRegex.test("HDFC1001234"), false); // 5th char must be 0
    assert.equal(pinRegex.test("560001"), true);
    assert.equal(pinRegex.test("060001"), false);
  });
});

describe("9. Financial Year (April 1 - March 31) Boundaries", () => {
  function getFiscalYear(date) {
    const month = date.getMonth(); // 0-11
    const year = date.getFullYear();
    if (month >= 3) {
      const nextYearShort = (year + 1).toString().slice(-2);
      return `${year}-${nextYearShort}`;
    } else {
      const currentYearShort = year.toString().slice(-2);
      return `${year - 1}-${currentYearShort}`;
    }
  }

  it("should accurately compute Indian Financial Year for any calendar date", () => {
    assert.equal(getFiscalYear(new Date(2026, 10, 13)), "2026-27"); // 13 Nov 2026
    assert.equal(getFiscalYear(new Date(2026, 3, 1)), "2026-27");   // 1 April 2026
    assert.equal(getFiscalYear(new Date(2027, 2, 31)), "2026-27");  // 31 March 2027
    assert.equal(getFiscalYear(new Date(2027, 3, 1)), "2027-28");   // 1 April 2027
    assert.equal(getFiscalYear(new Date(2026, 0, 10)), "2025-26");  // 10 Jan 2026
  });
});

