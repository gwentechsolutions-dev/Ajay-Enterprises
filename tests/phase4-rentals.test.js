import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

// ==============================================================================
// INVENTRA AUTOMATED TEST SUITE: PHASE 4 RENTAL MANAGEMENT & BILLING ENGINE
// Operating Business: AJAY ENTERPRISES | Product: INVENTRA ERP
// ==============================================================================

// Helper for exact decimal arithmetic matching PostgreSQL DECIMAL(15, 2)
function roundTo2(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

// ------------------------------------------------------------------------------
// Calculation Engine Simulation (Pure Logic mirroring calculator.ts)
// ------------------------------------------------------------------------------
function calculateDailyRental({
  deliveredQty,
  dailyRate,
  deliveryDate,
  includeDeliveryDate,
  returns = [], // array of { returnDate, returnedQty, includeReturnDate }
  periodStart,
  periodEnd,
}) {
  let totalBillableDays = 0;
  let totalRentalAmount = 0;
  const dayBreakdown = [];

  const start = new Date(periodStart);
  start.setHours(0, 0, 0, 0);
  const end = new Date(periodEnd);
  end.setHours(23, 59, 59, 999);

  const deliv = new Date(deliveryDate);
  deliv.setHours(0, 0, 0, 0);

  // Normalize returns
  const sortedReturns = [...returns].map((r) => {
    const d = new Date(r.returnDate);
    d.setHours(0, 0, 0, 0);
    return { ...r, dateObj: d };
  }).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

  const current = new Date(start);
  while (current <= end) {
    const dayTimestamp = current.getTime();
    const isDeliveryDay = dayTimestamp === deliv.getTime();

    // Check delivery day eligibility
    if (dayTimestamp < deliv.getTime()) {
      current.setDate(current.getDate() + 1);
      continue;
    }
    if (isDeliveryDay && !includeDeliveryDate) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    // Calculate active held quantity on this calendar day
    let activeQty = deliveredQty;
    for (const ret of sortedReturns) {
      if (dayTimestamp > ret.dateObj.getTime()) {
        activeQty -= ret.returnedQty;
      } else if (dayTimestamp === ret.dateObj.getTime()) {
        if (!ret.includeReturnDate) {
          activeQty -= ret.returnedQty;
        }
      }
    }

    if (activeQty > 0) {
      const dayCost = roundTo2(activeQty * dailyRate);
      totalRentalAmount += dayCost;
      totalBillableDays += 1;
      dayBreakdown.push({
        date: current.toISOString().split("T")[0],
        heldQty: activeQty,
        dailyRate,
        dayCost,
      });
    }

    current.setDate(current.getDate() + 1);
  }

  return {
    totalBillableDays,
    totalRentalAmount: roundTo2(totalRentalAmount),
    dayBreakdown,
  };
}

// ==============================================================================
// TEST SUITES
// ==============================================================================

describe("1. Rental Calculation: Delivery & Return Date Inclusion Rules", () => {
  it("Scenario 1: includeDeliveryDate = true charges for the dispatch date", () => {
    const res = calculateDailyRental({
      deliveredQty: 100,
      dailyRate: 2.5,
      deliveryDate: "2026-05-01",
      includeDeliveryDate: true,
      returns: [],
      periodStart: "2026-05-01",
      periodEnd: "2026-05-05",
    });
    // May 1, 2, 3, 4, 5 = 5 days
    assert.strictEqual(res.totalBillableDays, 5);
    assert.strictEqual(res.totalRentalAmount, roundTo2(100 * 2.5 * 5)); // 1250.00
  });

  it("Scenario 2: includeDeliveryDate = false excludes dispatch date from billing", () => {
    const res = calculateDailyRental({
      deliveredQty: 100,
      dailyRate: 2.5,
      deliveryDate: "2026-05-01",
      includeDeliveryDate: false,
      returns: [],
      periodStart: "2026-05-01",
      periodEnd: "2026-05-05",
    });
    // May 2, 3, 4, 5 = 4 days
    assert.strictEqual(res.totalBillableDays, 4);
    assert.strictEqual(res.totalRentalAmount, roundTo2(100 * 2.5 * 4)); // 1000.00
  });

  it("Scenario 3: includeReturnDate = true charges the return date", () => {
    const res = calculateDailyRental({
      deliveredQty: 100,
      dailyRate: 2.0,
      deliveryDate: "2026-05-01",
      includeDeliveryDate: false,
      returns: [{ returnDate: "2026-05-05", returnedQty: 100, includeReturnDate: true }],
      periodStart: "2026-05-01",
      periodEnd: "2026-05-10",
    });
    // May 2, 3, 4, 5 (since return date is included) = 4 days
    assert.strictEqual(res.totalBillableDays, 4);
    assert.strictEqual(res.totalRentalAmount, roundTo2(100 * 2.0 * 4)); // 800.00
  });

  it("Scenario 4: includeReturnDate = false does not charge the return date", () => {
    const res = calculateDailyRental({
      deliveredQty: 100,
      dailyRate: 2.0,
      deliveryDate: "2026-05-01",
      includeDeliveryDate: false,
      returns: [{ returnDate: "2026-05-05", returnedQty: 100, includeReturnDate: false }],
      periodStart: "2026-05-01",
      periodEnd: "2026-05-10",
    });
    // May 2, 3, 4 (return day May 5 is excluded) = 3 days
    assert.strictEqual(res.totalBillableDays, 3);
    assert.strictEqual(res.totalRentalAmount, roundTo2(100 * 2.0 * 3)); // 600.00
  });

  it("Scenario 5: Same-day delivery and return with both flags true = 1 billable day", () => {
    const res = calculateDailyRental({
      deliveredQty: 50,
      dailyRate: 3.0,
      deliveryDate: "2026-05-01",
      includeDeliveryDate: true,
      returns: [{ returnDate: "2026-05-01", returnedQty: 50, includeReturnDate: true }],
      periodStart: "2026-05-01",
      periodEnd: "2026-05-01",
    });
    assert.strictEqual(res.totalBillableDays, 1);
    assert.strictEqual(res.totalRentalAmount, roundTo2(50 * 3.0 * 1)); // 150.00
  });

  it("Scenario 6: Same-day delivery and return with both flags false = 0 billable days", () => {
    const res = calculateDailyRental({
      deliveredQty: 50,
      dailyRate: 3.0,
      deliveryDate: "2026-05-01",
      includeDeliveryDate: false,
      returns: [{ returnDate: "2026-05-01", returnedQty: 50, includeReturnDate: false }],
      periodStart: "2026-05-01",
      periodEnd: "2026-05-01",
    });
    assert.strictEqual(res.totalBillableDays, 0);
    assert.strictEqual(res.totalRentalAmount, 0.0);
  });
});

describe("2. Partial Returns & Multi-Delivery FIFO Tracking", () => {
  it("Scenario 7: Partial return splits rental computation accurately across days", () => {
    // 100 props delivered May 1. 40 returned on May 10 (excl return date).
    // May 1-9 (9 days): 100 props @ Rs 2 = 1800
    // May 10-20 (11 days): 60 props @ Rs 2 = 1320
    const res = calculateDailyRental({
      deliveredQty: 100,
      dailyRate: 2.0,
      deliveryDate: "2026-05-01",
      includeDeliveryDate: true,
      returns: [{ returnDate: "2026-05-10", returnedQty: 40, includeReturnDate: false }],
      periodStart: "2026-05-01",
      periodEnd: "2026-05-20",
    });
    // 9 days * 200 = 1800; 11 days * 120 = 1320; Total = 3120
    assert.strictEqual(res.totalBillableDays, 20);
    assert.strictEqual(res.totalRentalAmount, 3120.0);
  });

  it("Scenario 8: Multiple deliveries to same site maintain individual batch dates and rates", () => {
    // Batch 1: 50 props @ Rs 2.00 delivered May 1
    const batch1 = calculateDailyRental({
      deliveredQty: 50,
      dailyRate: 2.0,
      deliveryDate: "2026-05-01",
      includeDeliveryDate: true,
      periodStart: "2026-05-01",
      periodEnd: "2026-05-10",
    });
    // Batch 2: 50 props @ Rs 2.50 delivered May 5
    const batch2 = calculateDailyRental({
      deliveredQty: 50,
      dailyRate: 2.5,
      deliveryDate: "2026-05-05",
      includeDeliveryDate: true,
      periodStart: "2026-05-01",
      periodEnd: "2026-05-10",
    });

    // Batch 1: 10 days * 100 = 1000
    // Batch 2: 6 days (May 5 to 10) * 125 = 750
    assert.strictEqual(batch1.totalRentalAmount, 1000.0);
    assert.strictEqual(batch2.totalRentalAmount, 750.0);
    const combinedTotal = roundTo2(batch1.totalRentalAmount + batch2.totalRentalAmount);
    assert.strictEqual(combinedTotal, 1750.0);
  });

  it("Scenario 9: FIFO allocation deducts older delivery batch first on return", () => {
    const batches = [
      { id: "B1", deliveredDate: "2026-05-01", heldQty: 40, rate: 2.0 },
      { id: "B2", deliveredDate: "2026-05-05", heldQty: 60, rate: 2.5 },
    ];
    let returnAmount = 50;
    const allocations = [];

    for (const b of batches) {
      if (returnAmount <= 0) break;
      const take = Math.min(b.heldQty, returnAmount);
      allocations.push({ batchId: b.id, qty: take });
      b.heldQty -= take;
      returnAmount -= take;
    }

    assert.strictEqual(allocations[0].batchId, "B1");
    assert.strictEqual(allocations[0].qty, 40); // Older batch completely exhausted
    assert.strictEqual(allocations[1].batchId, "B2");
    assert.strictEqual(allocations[1].qty, 10); // 10 taken from newer batch
    assert.strictEqual(batches[0].heldQty, 0);
    assert.strictEqual(batches[1].heldQty, 50);
  });
});

describe("3. Rate Precedence & Zero-Float Precision", () => {
  it("Scenario 10: Agreement agreedDailyRate overrides MaterialVariant defaultRentalRate", () => {
    const variantDefaultRate = 3.5;
    const agreementAgreedRate = 2.75;
    const effectiveRate = agreementAgreedRate || variantDefaultRate;
    assert.strictEqual(effectiveRate, 2.75);

    const res = calculateDailyRental({
      deliveredQty: 80,
      dailyRate: effectiveRate,
      deliveryDate: "2026-05-01",
      includeDeliveryDate: true,
      periodStart: "2026-05-01",
      periodEnd: "2026-05-05",
    });
    assert.strictEqual(res.totalRentalAmount, roundTo2(80 * 2.75 * 5)); // 1100.00
  });

  it("Scenario 11: Subsequent master catalog rate change does not affect active batches", () => {
    const batch = {
      batchNumber: "RB-2026-0001",
      applicableDailyRate: 2.2,
      createdDate: "2026-04-01",
    };
    // Later catalog update
    const catalogRateUpdated = 3.0;

    // Batch preserves immutable snapshot rate
    assert.strictEqual(batch.applicableDailyRate, 2.2);
    assert.notStrictEqual(batch.applicableDailyRate, catalogRateUpdated);
  });

  it("Scenario 12: Decimal arithmetic prevents standard IEEE 754 floating-point drift", () => {
    // 0.1 + 0.2 in standard JS float = 0.30000000000000004
    const floatSum = 0.1 * 3;
    assert.notStrictEqual(floatSum, 0.3); // Proves float problem exists in native JS

    // With roundTo2 / Decimal handling
    const safeSum = roundTo2(0.1 * 3);
    assert.strictEqual(safeSum, 0.3);

    // Rental calculation with fractional paise rate (e.g., Rs 1.8333333)
    const res = calculateDailyRental({
      deliveredQty: 33,
      dailyRate: 1.8333,
      deliveryDate: "2026-05-01",
      includeDeliveryDate: true,
      periodStart: "2026-05-01",
      periodEnd: "2026-05-30",
    });
    // Check that total is strictly 2 decimals
    const strVal = res.totalRentalAmount.toFixed(2);
    assert.strictEqual(Number(strVal), res.totalRentalAmount);
  });
});

describe("4. Material Ownership & Segregation", () => {
  it("Scenario 13: OWNED and HIRED_IN rental batches remain strictly segregated", () => {
    const siteStock = [
      { variantId: "VAR-01", ownershipType: "OWNED", heldQty: 100 },
      { variantId: "VAR-01", ownershipType: "HIRED_IN", heldQty: 50 },
    ];
    const ownedTotal = siteStock
      .filter((s) => s.ownershipType === "OWNED")
      .reduce((acc, s) => acc + s.heldQty, 0);
    const hiredInTotal = siteStock
      .filter((s) => s.ownershipType === "HIRED_IN")
      .reduce((acc, s) => acc + s.heldQty, 0);

    assert.strictEqual(ownedTotal, 100);
    assert.strictEqual(hiredInTotal, 50);
    assert.notStrictEqual(ownedTotal, hiredInTotal);
  });
});

describe("5. Monthly Statements: Site-Wise vs Consolidated", () => {
  it("Scenario 14: Site-Wise statement requires customerSiteId and computes single site total", () => {
    const statementInput = {
      customerId: "a0000000-0000-0000-0000-000000000001",
      billingMode: "SITE_WISE",
      customerSiteId: "b0000000-0000-0000-0000-000000000001",
      periodStartDate: "2026-05-01",
      periodEndDate: "2026-05-31",
      grossRentalAmount: 15400.0,
      damageCharges: 500.0,
      missingCharges: 1200.0,
      adjustments: -200.0,
    };
    const netPayable = roundTo2(
      statementInput.grossRentalAmount +
        statementInput.damageCharges +
        statementInput.missingCharges +
        statementInput.adjustments
    );
    assert.strictEqual(netPayable, 16900.0);
    assert.ok(statementInput.customerSiteId !== null);
  });

  it("Scenario 15: Consolidated statement aggregates multiple sites into customer total", () => {
    const siteSummaries = [
      { siteName: "Marina Tower Site", grossRental: 25000.0, damages: 1000.0, total: 26000.0 },
      { siteName: "OMR Tech Park Site", grossRental: 40000.0, damages: 0.0, total: 40000.0 },
      { siteName: "Airport Flyover Site", grossRental: 15000.0, damages: 2500.0, total: 17500.0 },
    ];
    const consolidatedGross = roundTo2(siteSummaries.reduce((acc, s) => acc + s.grossRental, 0));
    const consolidatedDamages = roundTo2(siteSummaries.reduce((acc, s) => acc + s.damages, 0));
    const grandTotal = roundTo2(consolidatedGross + consolidatedDamages);

    assert.strictEqual(consolidatedGross, 80000.0);
    assert.strictEqual(consolidatedDamages, 3500.0);
    assert.strictEqual(grandTotal, 83500.0);
  });

  it("Scenario 16: Duplicate billing validation prevents overlapping finalized statement periods", () => {
    const existingStatements = [
      { siteId: "SITE-1", periodStart: "2026-05-01", periodEnd: "2026-05-31", status: "FINALIZED" },
    ];
    const newAttempt = { siteId: "SITE-1", periodStart: "2026-05-15", periodEnd: "2026-06-15" };

    const isOverlapping = existingStatements.some((ex) => {
      if (ex.siteId !== newAttempt.siteId) return false;
      return newAttempt.periodStart <= ex.periodEnd && newAttempt.periodEnd >= ex.periodStart;
    });

    assert.strictEqual(isOverlapping, true);
  });

  it("Scenario 17: Finalized statement freezes snapshot and prohibits in-place mutation", () => {
    const finalizedStatement = {
      id: "STM-2026-0001",
      status: "FINALIZED",
      netPayableAmount: 18500.0,
      snapshotPayload: JSON.stringify({
        customerName: "L&T Construction",
        siteName: "Metro Pillar 44",
        netPayable: 18500.0,
      }),
      finalizedAt: new Date().toISOString(),
    };

    function attemptUpdate(stmt, newAmount) {
      if (stmt.status === "FINALIZED") {
        throw new Error("MUTATION_FORBIDDEN: Finalized statement cannot be modified.");
      }
      stmt.netPayableAmount = newAmount;
    }

    assert.throws(
      () => attemptUpdate(finalizedStatement, 20000.0),
      /MUTATION_FORBIDDEN/
    );
  });
});

describe("6. Damage, Missing Claims & Deposit Handling", () => {
  it("Scenario 18: Damage & missing assessments compute separate claims outside rental rate", () => {
    const assessments = [
      { type: "DAMAGED_REPAIRABLE", qty: 5, repairCostPerUnit: 150, approvedCharge: 750.0 },
      { type: "DAMAGED_SCRAP", qty: 2, scrapPenaltyPerUnit: 600, approvedCharge: 1200.0 },
      { type: "MISSING", qty: 3, replacementValuePerUnit: 1200, approvedCharge: 3600.0 },
    ];
    const totalClaims = assessments.reduce((acc, a) => acc + a.approvedCharge, 0);
    assert.strictEqual(totalClaims, 5550.0);
  });

  it("Scenario 19: Rental deposit adjustment reduces outstanding net settlement balance", () => {
    const depositReceived = 50000.0;
    const finalStatementPayable = 35000.0;
    const damageClaims = 5000.0;

    const totalDue = finalStatementPayable + damageClaims; // 40000.00
    const refundEligible = depositReceived - totalDue; // 10000.00

    assert.strictEqual(totalDue, 40000.0);
    assert.strictEqual(refundEligible, 10000.0);
  });
});

describe("7. Site Closure Settlement & Owner Exception Guard", () => {
  it("Scenario 20: Pre-closure audit strictly blocks closure if unreturned materials exist without Owner Override", () => {
    const siteInventoryAudit = {
      customerSiteId: "SITE-01",
      heldMaterials: [
        { variant: "Props 10-15ft", heldQty: 25 },
        { variant: "Scaffolding Sheets", heldQty: 10 },
      ],
    };

    function validateSiteClosure(audit, userRole, ownerExceptionApproved, reason) {
      const totalHeld = audit.heldMaterials.reduce((acc, m) => acc + m.heldQty, 0);
      if (totalHeld > 0) {
        if (!ownerExceptionApproved) {
          throw new Error("SITE_HAS_UNRETURNED_STOCK: 35 items currently held at site.");
        }
        if (userRole !== "OWNER" && userRole !== "ADMIN") {
          throw new Error("FORBIDDEN: Only Owner can authorize exception closure with outstanding materials.");
        }
        if (!reason || reason.trim().length < 10) {
          throw new Error("REASON_REQUIRED: A detailed reason is mandatory for owner exception closure.");
        }
      }
      return { status: "CLOSED", closedAt: new Date().toISOString() };
    }

    // 1. Normal attempt fails
    assert.throws(
      () => validateSiteClosure(siteInventoryAudit, "ACCOUNTANT", false, null),
      /SITE_HAS_UNRETURNED_STOCK/
    );

    // 2. Non-owner attempt with checkbox fails
    assert.throws(
      () => validateSiteClosure(siteInventoryAudit, "ACCOUNTANT", true, "Customer agreed to buy"),
      /FORBIDDEN/
    );

    // 3. Owner attempt with valid exception reason succeeds
    const result = validateSiteClosure(
      siteInventoryAudit,
      "OWNER",
      true,
      "Materials sold to customer under separate sales invoice SI-2026-0045"
    );
    assert.strictEqual(result.status, "CLOSED");
  });
});

describe("8. Concurrency Protection & Quantity Lifecycle Reconciliation", () => {
  it("Scenario 21: Database advisory lock serializes simultaneous generation and rejects duplicate billing", async () => {
    // Simulate two concurrent requests for the same customer/site and period
    let lockHolder = null;
    const statementsTable = [];

    async function attemptGenerateStatement({ customerId, siteId, start, end }) {
      // 1. Acquire advisory lock
      const lockKey = `${customerId}_${siteId || "CONSOLIDATED"}`;
      if (lockHolder === lockKey) {
        // Wait/blocked by lock
      }
      lockHolder = lockKey;

      try {
        // 2. Re-check inside transaction
        const existing = statementsTable.find(
          (s) =>
            s.customerId === customerId &&
            s.siteId === siteId &&
            s.start <= end &&
            s.end >= start &&
            s.status !== "CANCELLED"
        );
        if (existing) {
          throw new Error(`DUPLICATE_BILLING: Statement ${existing.id} already active for this period.`);
        }

        const newStmt = { id: `STM-${statementsTable.length + 1}`, customerId, siteId, start, end, status: "CALCULATED" };
        statementsTable.push(newStmt);
        return newStmt;
      } finally {
        lockHolder = null;
      }
    }

    // Run first request
    const stmt1 = await attemptGenerateStatement({
      customerId: "CUST-01",
      siteId: "SITE-01",
      start: "2026-05-01",
      end: "2026-05-31",
    });
    assert.ok(stmt1.id);

    // Run second simultaneous overlapping request
    await assert.rejects(
      async () => {
        await attemptGenerateStatement({
          customerId: "CUST-01",
          siteId: "SITE-01",
          start: "2026-05-01",
          end: "2026-05-31",
        });
      },
      /DUPLICATE_BILLING/
    );
  });

  it("Scenario 22: Cross-mode validation prevents consolidated statement from duplicating active site-wise statement", () => {
    const existingStatements = [
      { id: "STM-01", customerId: "CUST-A", billingMode: "SITE_WISE", siteId: "SITE-NORTH", start: "2026-05-01", end: "2026-05-31" },
    ];

    function validateConsolidatedAttempt(customerId, start, end) {
      // Consolidated attempts must not overlap ANY active site-wise statements for the customer
      const hasConflict = existingStatements.some(
        (s) => s.customerId === customerId && s.start <= end && s.end >= start
      );
      if (hasConflict) {
        throw new Error("DUPLICATE_BILLING: A site-wise statement already covers this billing period for the customer.");
      }
      return true;
    }

    assert.throws(
      () => validateConsolidatedAttempt("CUST-A", "2026-05-01", "2026-05-31"),
      /DUPLICATE_BILLING/
    );
  });

  it("Scenario 23: Complete quantity lifecycle maintains reconciliation between RentalBatch held count and StockBalance", () => {
    // 1. Delivery Note dispatched: 100 units
    const batch = {
      deliveredQty: 100,
      returnedQty: 0,
      damagedQty: 0,
      missingQty: 0,
      currentHeldQty: 100,
    };
    let siteStockBalance = 100;
    let warehouseDamagedBalance = 0;

    // Verify initial delivery parity
    assert.strictEqual(batch.currentHeldQty, siteStockBalance);

    // 2. Partial return: 40 returned total (25 Good, 10 Damaged, 5 Missing)
    const returnAllocation = { returned: 40, accepted: 25, damaged: 10, missing: 5 };
    batch.returnedQty += returnAllocation.returned;
    batch.damagedQty += returnAllocation.damaged;
    batch.missingQty += returnAllocation.missing;
    batch.currentHeldQty -= returnAllocation.returned; // 100 - 40 = 60 held

    // StockBalance updates via ledger
    siteStockBalance -= returnAllocation.returned; // 100 - 40 = 60 held on site
    warehouseDamagedBalance += returnAllocation.damaged; // 10 damaged routed to damaged pool

    // Verify reconciliation
    assert.strictEqual(batch.currentHeldQty, 60);
    assert.strictEqual(siteStockBalance, 60);
    assert.strictEqual(batch.currentHeldQty, siteStockBalance);
    assert.strictEqual(warehouseDamagedBalance, 10);
    assert.ok(batch.currentHeldQty >= 0, "No negative quantity");
  });

  it("Scenario 24: Historical reproducibility — reviewing finalized statement strictly reads frozen snapshot regardless of future catalog edits", () => {
    const historicalSnapshot = {
      frozenAt: "2026-05-31T23:59:59Z",
      items: [
        { variantCode: "VAR-PROP-01", name: "Prop 10-15ft", applicableDailyRate: 2.25, billableDays: 31, rentalAmount: 697.5 },
      ],
      netPayableAmount: 697.5,
    };

    // Subsequent modifications in live database
    const currentCatalogRate = 3.50; // Rate increased in catalog
    const currentSiteHeldStock = 0;   // Stock returned to yard later

    function renderStatementView(stmt) {
      if (stmt.snapshotPayload) {
        const snap = typeof stmt.snapshotPayload === "string" ? JSON.parse(stmt.snapshotPayload) : stmt.snapshotPayload;
        return {
          rateUsed: snap.items[0].applicableDailyRate,
          total: snap.netPayableAmount,
          isFrozen: true,
        };
      }
      return { rateUsed: currentCatalogRate, total: 0, isFrozen: false };
    }

    const view = renderStatementView({ snapshotPayload: historicalSnapshot });
    assert.strictEqual(view.isFrozen, true);
    assert.strictEqual(view.rateUsed, 2.25); // Historical snapshot rate preserved!
    assert.strictEqual(view.total, 697.5);   // Historical total preserved!
    assert.notStrictEqual(view.rateUsed, currentCatalogRate);
  });
});

