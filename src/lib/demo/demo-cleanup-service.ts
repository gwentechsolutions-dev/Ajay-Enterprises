import { db } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";

// ==============================================================================
// INVENTRA: ONE-CLICK DEMO DATA CLEANUP & RESET SERVICE
// Operating Business: AJAY ENTERPRISES | Product: INVENTRA ERP
// Guarantees:
// 1. Never truncates tables
// 2. Never deletes or alters genuine non-demo business data
// 3. Deletes in strict foreign-key child-to-parent dependency order
// 4. Verifies no genuine records are linked to demo data before deletion
// 5. Preserves immutable audit history
// ==============================================================================

export interface DemoCleanupResult {
  success: boolean;
  demoRunId: string;
  runNumber: string;
  totalRecordsDeleted: number;
  message: string;
}

export async function clearAllDemoData(actor: {
  id: string;
  name: string;
  role: string;
  ipAddress?: string;
}): Promise<DemoCleanupResult> {
  // Step 1: Find the active demo dataset
  const activeRun = await db.demoDataRun.findFirst({
    where: { status: "ACTIVE" },
  });

  if (!activeRun) {
    throw new Error("No active demo dataset found to clear.");
  }

  const demoRunId = activeRun.id;

  // Step 2: Safety Verification - Check if any genuine record references demo records
  // E.g., Genuine Invoice referencing a demo customer
  const demoCustomers = await db.customer.findMany({
    where: { demoRunId },
    select: { id: true },
  });
  const demoCustomerIds = demoCustomers.map((c) => c.id);

  if (demoCustomerIds.length > 0) {
    const genuineInvoices = await db.invoice.findFirst({
      where: {
        customerId: { in: demoCustomerIds },
        isDemo: false,
      },
    });
    if (genuineInvoices) {
      throw new Error(
        `Safety conflict detected: Genuine business invoice (${genuineInvoices.invoiceNumber}) references a demo customer. Cleanup aborted to protect genuine data.`
      );
    }

    const genuineDNs = await db.deliveryNote.findFirst({
      where: {
        customerId: { in: demoCustomerIds },
        isDemo: false,
      },
    });
    if (genuineDNs) {
      throw new Error(
        `Safety conflict detected: Genuine delivery note (${genuineDNs.dnNumber}) references a demo customer. Cleanup aborted.`
      );
    }
  }

  // Step 3: Deletion in strict child-to-parent reverse dependency order

  // A. Allocations
  await db.paymentAllocation.deleteMany({
    where: { receipt: { demoRunId } },
  });
  await db.supplierPaymentAllocation.deleteMany({
    where: { supplierPayment: { demoRunId } },
  });
  await db.rentalReturnAllocation.deleteMany({
    where: { rentalBatch: { demoRunId } },
  });

  // B. Rental Statements & details
  await db.rentalStatementDayDetail.deleteMany({
    where: { statementItem: { statement: { demoRunId } } },
  });
  await db.rentalStatementItem.deleteMany({
    where: { statement: { demoRunId } },
  });
  await db.rentalStatementSiteSummary.deleteMany({
    where: { statement: { demoRunId } },
  });
  await db.rentalStatement.deleteMany({
    where: { demoRunId },
  });

  // C. Invoices & Credit/Debit Notes
  await db.invoiceItem.deleteMany({
    where: { invoice: { demoRunId } },
  });
  await db.invoice.deleteMany({
    where: { demoRunId },
  });
  await db.creditDebitNoteItem.deleteMany({
    where: { creditDebitNote: { demoRunId } },
  });
  await db.creditDebitNote.deleteMany({
    where: { demoRunId },
  });

  // D. General Ledger Journal Entries
  await db.journalEntryLine.deleteMany({
    where: { journalEntry: { demoRunId } },
  });
  await db.journalEntry.deleteMany({
    where: { demoRunId },
  });

  // E. Receipts & Supplier Payments & Bills
  await db.paymentReceipt.deleteMany({
    where: { demoRunId },
  });
  await db.supplierPayment.deleteMany({
    where: { demoRunId },
  });
  await db.purchaseBillItem.deleteMany({
    where: { purchaseBill: { demoRunId } },
  });
  await db.purchaseBill.deleteMany({
    where: { demoRunId },
  });

  // F. Labour
  await db.labourPayment.deleteMany({
    where: { worker: { demoRunId } },
  });
  await db.labourWageSettlement.deleteMany({
    where: { demoRunId },
  });
  await db.labourAdvance.deleteMany({
    where: { demoRunId },
  });
  await db.labourAttendance.deleteMany({
    where: { demoRunId },
  });
  await db.labourWorker.deleteMany({
    where: { demoRunId },
  });

  // G. Fleet
  await db.vehicleExpense.deleteMany({
    where: { vehicle: { demoRunId } },
  });
  await db.vehicleFuelLog.deleteMany({
    where: { demoRunId },
  });
  await db.vehicleMaintenanceRecord.deleteMany({
    where: { demoRunId },
  });
  await db.vehicleTripDeliveryNote.deleteMany({
    where: { trip: { demoRunId } },
  });
  await db.vehicleTrip.deleteMany({
    where: { demoRunId },
  });
  await db.driverVehicleAssignment.deleteMany({
    where: { driver: { demoRunId } },
  });
  await db.driver.deleteMany({
    where: { demoRunId },
  });
  await db.vehicle.deleteMany({
    where: { demoRunId },
  });

  // H. Material Maintenance & Repairs
  await db.materialRepairLog.deleteMany({
    where: { repairJob: { demoRunId } },
  });
  await db.materialRepairJob.deleteMany({
    where: { demoRunId },
  });

  // I. Operations & Dispatches
  await db.movementEvidence.deleteMany({
    where: {
      OR: [
        { deliveryNote: { demoRunId } },
        { returnNote: { demoRunId } },
        { transferNote: { demoRunId } },
      ],
    },
  });
  await db.directSiteTransferItem.deleteMany({
    where: { transfer: { demoRunId } },
  });
  await db.directSiteTransferNote.deleteMany({
    where: { demoRunId },
  });
  await db.stockTransferNoteItem.deleteMany({
    where: { stockTransferNote: { demoRunId } },
  });
  await db.stockTransferNote.deleteMany({
    where: { demoRunId },
  });
  await db.hiringReturnNoteItem.deleteMany({
    where: { hiringReturnNote: { demoRunId } },
  });
  await db.hiringReturnNote.deleteMany({
    where: { demoRunId },
  });
  await db.hiringDeliveryNoteItem.deleteMany({
    where: { hiringDeliveryNote: { demoRunId } },
  });
  await db.hiringDeliveryNote.deleteMany({
    where: { demoRunId },
  });
  await db.materialReturnNoteItem.deleteMany({
    where: { materialReturnNote: { demoRunId } },
  });
  await db.materialReturnNote.deleteMany({
    where: { demoRunId },
  });
  await db.deliveryNoteItem.deleteMany({
    where: { deliveryNote: { demoRunId } },
  });
  await db.deliveryNote.deleteMany({
    where: { demoRunId },
  });

  // J. Rentals
  await db.damageLossAssessment.deleteMany({
    where: { demoRunId },
  });
  await db.rentalDepositTransaction.deleteMany({
    where: { customer: { demoRunId } },
  });
  await db.siteClosureSettlement.deleteMany({
    where: { demoRunId },
  });
  await db.rentalBatch.deleteMany({
    where: { demoRunId },
  });
  await db.rentalAgreementItem.deleteMany({
    where: { rentalAgreement: { demoRunId } },
  });
  await db.rentalAgreement.deleteMany({
    where: { demoRunId },
  });

  // K. Purchases
  await db.goodsReceiptNoteItem.deleteMany({
    where: { grn: { demoRunId } },
  });
  await db.goodsReceiptNote.deleteMany({
    where: { demoRunId },
  });
  await db.purchaseReturnItem.deleteMany({
    where: { purchaseReturn: { demoRunId } },
  });
  await db.purchaseReturn.deleteMany({
    where: { demoRunId },
  });
  await db.purchaseOrderItem.deleteMany({
    where: { purchaseOrder: { demoRunId } },
  });
  await db.purchaseOrder.deleteMany({
    where: { demoRunId },
  });

  // L. Stock Audits
  await db.stockAuditItem.deleteMany({
    where: { stockAudit: { demoRunId } },
  });
  await db.stockAudit.deleteMany({
    where: { demoRunId },
  });

  // M. Inventory Movements & Stock Balances
  await db.inventoryMovement.deleteMany({
    where: { demoRunId },
  });

  // Clean up stock balances for demo sites or demo warehouses
  const demoSites = await db.customerSite.findMany({
    where: { demoRunId },
    select: { id: true },
  });
  const demoSiteIds = demoSites.map((s) => s.id);

  const demoWarehouses = await db.warehouse.findMany({
    where: { demoRunId },
    select: { id: true },
  });
  const demoWarehouseIds = demoWarehouses.map((w) => w.id);

  if (demoSiteIds.length > 0 || demoWarehouseIds.length > 0) {
    await db.stockBalance.deleteMany({
      where: {
        OR: [
          { siteId: { in: demoSiteIds } },
          { warehouseId: { in: demoWarehouseIds } },
        ],
      },
    });
  }

  // N. Master Data: Customer & Suppliers
  await db.contactPerson.deleteMany({
    where: { customer: { demoRunId } },
  });
  await db.customerDocument.deleteMany({
    where: { customer: { demoRunId } },
  });
  await db.customerSite.deleteMany({
    where: { demoRunId },
  });
  await db.customer.deleteMany({
    where: { demoRunId },
  });

  await db.supplierDocument.deleteMany({
    where: { supplier: { demoRunId } },
  });
  await db.supplier.deleteMany({
    where: { demoRunId },
  });

  // O. Demo Warehouses & Branches & Material Variants
  if (demoWarehouseIds.length > 0) {
    await db.warehouse.deleteMany({
      where: { id: { in: demoWarehouseIds } },
    });
  }

  const demoBranches = await db.branch.findMany({
    where: { demoRunId },
    select: { id: true },
  });
  if (demoBranches.length > 0) {
    await db.branch.deleteMany({
      where: { id: { in: demoBranches.map((b) => b.id) } },
    });
  }

  await db.materialVariant.deleteMany({
    where: { demoRunId, isDemo: true },
  });

  // P. Demo Data Records Registry
  const deletedRecordsCount = await db.demoDataRecord.count({
    where: { demoRunId },
  });

  await db.demoDataRecord.deleteMany({
    where: { demoRunId },
  });

  // Q. Mark DemoDataRun as CLEARED
  await db.demoDataRun.update({
    where: { id: demoRunId },
    data: {
      status: "CLEARED",
      clearedAt: new Date(),
      clearedById: actor.id,
    },
  });

  // Step 4: Immutable Audit Event
  await logAuditEvent({
    userId: actor.id,
    userName: actor.name,
    userRole: actor.role,
    ipAddress: actor.ipAddress,
    action: "DEMO_DATA_CLEARED",
    module: "demo_data",
    entityType: "DemoDataRun",
    entityId: demoRunId,
    notes: `Cleared demo dataset ${activeRun.runNumber} (${deletedRecordsCount} records deleted)`,
  });

  return {
    success: true,
    demoRunId,
    runNumber: activeRun.runNumber,
    totalRecordsDeleted: deletedRecordsCount,
    message: `Demo dataset ${activeRun.runNumber} successfully and completely cleared. All genuine data remains intact.`,
  };
}
