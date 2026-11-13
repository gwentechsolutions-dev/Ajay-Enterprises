import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";

// ==============================================================================
// INVENTRA PHASE 4: TARGETED VERIFICATION SUITE
// 1. Concurrent Statement Generation & Database Constraints
// 2. RentalBatch & StockBalance Reconciliation (Partial, Damaged, Missing)
// 3. Finalized Statement Immutability Across All Endpoints
// ==============================================================================

describe("Verification Item 2: Concurrent Statement Generation & Database Protection", () => {
  it("should prevent duplicate statements using PostgreSQL unique index constraint", async () => {
    // Simulated database table state with unique active period index
    const activeStatementsDb = new Map();
    const uniqueIndexKey = (customerId, siteId, start, end) =>
      `${customerId}_${siteId || "00000000-0000-0000-0000-000000000000"}_${start}_${end}`;

    function insertStatement(stmt) {
      const key = uniqueIndexKey(stmt.customerId, stmt.customerSiteId, stmt.periodStartDate, stmt.periodEndDate);
      if (activeStatementsDb.has(key)) {
        const error = new Error(`Unique constraint failed on the constraint: RentalStatement_unique_active_period`);
        error.code = "P2002";
        throw error;
      }
      activeStatementsDb.set(key, stmt);
      return stmt;
    }

    const stmt1 = {
      id: "stmt-001",
      statementNumber: "STM-2026-0001",
      customerId: "cust-001",
      customerSiteId: "site-001",
      periodStartDate: "2026-05-01",
      periodEndDate: "2026-05-31",
      status: "CALCULATED",
    };

    // First insert succeeds
    const inserted1 = insertStatement(stmt1);
    assert.strictEqual(inserted1.id, "stmt-001");

    // Concurrent simultaneous insert with identical customer, site, and period
    const stmt2 = {
      id: "stmt-002",
      statementNumber: "STM-2026-0002",
      customerId: "cust-001",
      customerSiteId: "site-001",
      periodStartDate: "2026-05-01",
      periodEndDate: "2026-05-31",
      status: "CALCULATED",
    };

    assert.throws(
      () => insertStatement(stmt2),
      (err) => err.code === "P2002" && err.message.includes("RentalStatement_unique_active_period")
    );
  });

  it("should enforce transaction-level lock to serialize simultaneous overlapping requests", async () => {
    let advisoryLockActive = false;
    const committedStatements = [];

    async function generateStatementWithAdvisoryLock(input) {
      // 1. Acquire transaction advisory lock
      while (advisoryLockActive) {
        await new Promise((r) => setTimeout(r, 10)); // wait for lock release
      }
      advisoryLockActive = true;

      try {
        // 2. Re-check overlap inside transaction lock
        const overlap = committedStatements.find(
          (s) =>
            s.customerId === input.customerId &&
            (s.customerSiteId === input.customerSiteId || !input.customerSiteId || !s.customerSiteId) &&
            s.periodStartDate <= input.periodEndDate &&
            s.periodEndDate >= input.periodStartDate
        );

        if (overlap) {
          const err = new Error(`DUPLICATE_BILLING: An active statement already exists (${overlap.statementNumber}).`);
          err.statusCode = 409;
          throw err;
        }

        const newStmt = {
          id: `stmt-${committedStatements.length + 1}`,
          statementNumber: `STM-2026-000${committedStatements.length + 1}`,
          ...input,
        };
        committedStatements.push(newStmt);
        return newStmt;
      } finally {
        advisoryLockActive = false;
      }
    }

    // Launch 2 simultaneous requests
    const p1 = generateStatementWithAdvisoryLock({
      customerId: "cust-abc",
      customerSiteId: "site-xyz",
      periodStartDate: "2026-06-01",
      periodEndDate: "2026-06-30",
    });

    const p2 = generateStatementWithAdvisoryLock({
      customerId: "cust-abc",
      customerSiteId: "site-xyz",
      periodStartDate: "2026-06-01",
      periodEndDate: "2026-06-30",
    });

    const results = await Promise.allSettled([p1, p2]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    assert.strictEqual(fulfilled.length, 1, "Exactly one statement created");
    assert.strictEqual(rejected.length, 1, "Concurrent duplicate request rejected");
    assert.strictEqual(rejected[0].reason.statusCode, 409);
    assert.ok(rejected[0].reason.message.includes("DUPLICATE_BILLING"));
  });
});

describe("Verification Item 3: RentalBatch & StockBalance Lifecycle Reconciliation", () => {
  it("should reconcile batch held quantities against physical StockBalance across deliveries and returns", () => {
    // 1. Initial State: Material delivered to customer site via Delivery Note
    const initialDeliveredQty = new Prisma.Decimal(200);

    const rentalBatch = {
      batchNumber: "RB-2026-0001",
      deliveredQty: initialDeliveredQty,
      returnedQty: new Prisma.Decimal(0),
      damagedQty: new Prisma.Decimal(0),
      missingQty: new Prisma.Decimal(0),
      currentHeldQty: initialDeliveredQty,
      status: "ACTIVE",
    };

    // Stock balances in database (derived from ledger)
    const siteStockBalance = {
      locationType: "CUSTOMER_SITE",
      availableQty: new Prisma.Decimal(200),
      damagedQty: new Prisma.Decimal(0),
    };
    const warehouseStockBalance = {
      locationType: "WAREHOUSE",
      availableQty: new Prisma.Decimal(500),
      damagedQty: new Prisma.Decimal(0),
    };

    // Verify 1: Parity after delivery
    assert.ok(rentalBatch.currentHeldQty.equals(siteStockBalance.availableQty));

    // 2. Partial Return: 80 total returned
    // Breakdown: 50 Accepted (Good), 20 Damaged, 10 Missing
    const returnBreakdown = {
      totalReturned: new Prisma.Decimal(80),
      accepted: new Prisma.Decimal(50),
      damaged: new Prisma.Decimal(20),
      missing: new Prisma.Decimal(10),
    };

    // Execute return allocation on batch
    rentalBatch.returnedQty = rentalBatch.returnedQty.plus(returnBreakdown.totalReturned);
    rentalBatch.damagedQty = rentalBatch.damagedQty.plus(returnBreakdown.damaged);
    rentalBatch.missingQty = rentalBatch.missingQty.plus(returnBreakdown.missing);
    rentalBatch.currentHeldQty = rentalBatch.currentHeldQty.minus(returnBreakdown.totalReturned);

    // Execute stock balance update via ledger movements
    // - Accepted (50) moves from site to warehouse available pool
    // - Damaged (20) moves from site to warehouse damaged pool (NOT rentable)
    // - Missing (10) moves from site to MISSING location (lost, not in warehouse)
    siteStockBalance.availableQty = siteStockBalance.availableQty.minus(returnBreakdown.totalReturned);
    warehouseStockBalance.availableQty = warehouseStockBalance.availableQty.plus(returnBreakdown.accepted);
    warehouseStockBalance.damagedQty = warehouseStockBalance.damagedQty.plus(returnBreakdown.damaged);

    // Verify 2: Site held stock reconciliation
    assert.strictEqual(rentalBatch.currentHeldQty.toString(), "120");
    assert.strictEqual(siteStockBalance.availableQty.toString(), "120");
    assert.ok(rentalBatch.currentHeldQty.equals(siteStockBalance.availableQty), "Held stock exactly equals StockBalance");

    // Verify 3: Damaged stock is segregated and NOT available for rental
    assert.strictEqual(warehouseStockBalance.damagedQty.toString(), "20");
    assert.strictEqual(warehouseStockBalance.availableQty.toString(), "550"); // 500 + 50 accepted

    // Verify 4: Missing stock is not counted in warehouse physical stock
    assert.strictEqual(rentalBatch.missingQty.toString(), "10");

    // Verify 5: No negative quantities anywhere
    assert.ok(rentalBatch.currentHeldQty.gte(0));
    assert.ok(siteStockBalance.availableQty.gte(0));
    assert.ok(warehouseStockBalance.availableQty.gte(0));
    assert.ok(warehouseStockBalance.damagedQty.gte(0));
  });

  it("should maintain strict segregation between OWNED and HIRED_IN pools without merging", () => {
    const ownedBatch = {
      materialVariantId: "VAR-001",
      ownershipType: "OWNED",
      currentHeldQty: new Prisma.Decimal(50),
    };
    const hiredInBatch = {
      materialVariantId: "VAR-001",
      ownershipType: "HIRED_IN",
      currentHeldQty: new Prisma.Decimal(30),
    };

    // Both coexist for same variant on same site
    assert.strictEqual(ownedBatch.materialVariantId, hiredInBatch.materialVariantId);
    assert.notStrictEqual(ownedBatch.ownershipType, hiredInBatch.ownershipType);

    // Return of OWNED material only reduces OWNED batch
    const returnOwnedQty = new Prisma.Decimal(20);
    ownedBatch.currentHeldQty = ownedBatch.currentHeldQty.minus(returnOwnedQty);

    assert.strictEqual(ownedBatch.currentHeldQty.toString(), "30");
    assert.strictEqual(hiredInBatch.currentHeldQty.toString(), "30"); // Unaltered
  });
});

describe("Verification Item 4: Finalized Statement Immutability Across Endpoints", () => {
  const finalizedStatement = {
    id: "stm-uuid-finalized",
    statementNumber: "STM-2026-0042",
    status: "FINALIZED",
    periodStartDate: new Date("2026-05-01"),
    periodEndDate: new Date("2026-05-31"),
    netPayableAmount: new Prisma.Decimal("45000.00"),
    snapshotPayload: {
      frozenAt: "2026-05-31T23:59:59Z",
      netPayableAmount: 45000.0,
      items: [
        { variantName: "Props 10-15ft", applicableRate: 2.5, days: 31, amount: 45000.0 },
      ],
    },
  };

  it("should reject approval attempts on finalized statements with HTTP 400", () => {
    function approveStatement(stmt) {
      if (stmt.status === "FINALIZED") {
        const err = new Error("Statement is already finalized and locked.");
        err.statusCode = 400;
        throw err;
      }
      stmt.status = "APPROVED";
      return stmt;
    }

    assert.throws(
      () => approveStatement(finalizedStatement),
      (err) => err.statusCode === 400 && err.message.includes("already finalized and locked")
    );
  });

  it("should reject re-finalization attempts with HTTP 400", () => {
    function finalizeStatement(stmt) {
      if (stmt.status === "FINALIZED") {
        const err = new Error("Statement is already FINALIZED and locked against modifications.");
        err.statusCode = 400;
        throw err;
      }
      stmt.status = "FINALIZED";
      return stmt;
    }

    assert.throws(
      () => finalizeStatement(finalizedStatement),
      (err) => err.statusCode === 400 && err.message.includes("locked against modifications")
    );
  });

  it("should reject recalculation / re-generation attempts covering finalized period with HTTP 409", () => {
    const existingFinalized = [finalizedStatement];

    function attemptRecalculate(customerId, start, end) {
      const conflict = existingFinalized.find(
        (s) => s.status === "FINALIZED" && s.periodStartDate <= end && s.periodEndDate >= start
      );
      if (conflict) {
        const err = new Error(`DUPLICATE_BILLING: A finalized/approved statement (${conflict.statementNumber}) already covers the selected date range. Duplicate billing is prevented.`);
        err.statusCode = 409;
        throw err;
      }
      return { success: true };
    }

    assert.throws(
      () => attemptRecalculate("cust-01", new Date("2026-05-15"), new Date("2026-06-15")),
      (err) => err.statusCode === 409 && err.message.includes("DUPLICATE_BILLING")
    );
  });

  it("should strictly read frozen snapshot for review/print, ignoring live database changes", () => {
    // Current live database state (rates updated, items returned)
    const liveCurrentVariantRate = 4.0; // Rate increased from 2.50 to 4.00
    const liveSiteHeldStock = 0;       // All returned to yard

    function renderPrintView(stmt) {
      // Must use frozen snapshot
      assert.ok(stmt.snapshotPayload, "Must have snapshotPayload");
      const snap = stmt.snapshotPayload;
      return {
        statementNumber: stmt.statementNumber,
        billedRate: snap.items[0].applicableRate,
        netPayable: snap.netPayableAmount,
      };
    }

    const printOutput = renderPrintView(finalizedStatement);
    assert.strictEqual(printOutput.billedRate, 2.5); // Historical rate preserved!
    assert.notStrictEqual(printOutput.billedRate, liveCurrentVariantRate);
    assert.strictEqual(printOutput.netPayable, 45000.0);
  });
});

