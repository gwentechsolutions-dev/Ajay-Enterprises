-- Migration 20261113000007: Phase 5 Invoicing, GST & Complete Accounting ERP
-- Operating Business: AJAY ENTERPRISES | Product: INVENTRA ERP

-- 1. Double-Entry Chart of Accounts
CREATE TABLE IF NOT EXISTS "ChartOfAccount" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "accountCode" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountCategory" TEXT NOT NULL,
    "accountSubcategory" TEXT NOT NULL,
    "parentAccountId" UUID,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "openingBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "openingBalanceType" TEXT NOT NULL DEFAULT 'DEBIT',
    "currentBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "isControlAccount" BOOLEAN NOT NULL DEFAULT false,
    "isSystemProtected" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "bankAccountId" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChartOfAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChartOfAccount_accountCode_key" ON "ChartOfAccount"("accountCode");
CREATE INDEX IF NOT EXISTS "ChartOfAccount_accountCategory_idx" ON "ChartOfAccount"("accountCategory");
CREATE INDEX IF NOT EXISTS "ChartOfAccount_accountSubcategory_idx" ON "ChartOfAccount"("accountSubcategory");
CREATE INDEX IF NOT EXISTS "ChartOfAccount_parentAccountId_idx" ON "ChartOfAccount"("parentAccountId");

-- 2. Accounting Periods & FY Locking
CREATE TABLE IF NOT EXISTS "AccountingPeriod" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fiscalYear" TEXT NOT NULL,
    "periodName" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedById" UUID,
    "lockedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AccountingPeriod_fiscalYear_periodName_key" ON "AccountingPeriod"("fiscalYear", "periodName");
CREATE INDEX IF NOT EXISTS "AccountingPeriod_fiscalYear_idx" ON "AccountingPeriod"("fiscalYear");
CREATE INDEX IF NOT EXISTS "AccountingPeriod_startDate_endDate_idx" ON "AccountingPeriod"("startDate", "endDate");
CREATE INDEX IF NOT EXISTS "AccountingPeriod_isLocked_idx" ON "AccountingPeriod"("isLocked");

-- 3. General Ledger Journal Entries
CREATE TABLE IF NOT EXISTS "JournalEntry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "journalNumber" TEXT NOT NULL,
    "journalType" TEXT NOT NULL DEFAULT 'GENERAL',
    "postingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accountingPeriodId" UUID,
    "fiscalYear" TEXT NOT NULL,
    "narration" TEXT NOT NULL,
    "referenceDocumentType" TEXT,
    "referenceDocumentId" TEXT,
    "referenceNumber" TEXT,
    "totalDebit" DECIMAL(15,2) NOT NULL,
    "totalCredit" DECIMAL(15,2) NOT NULL,
    "isBalanced" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "postedById" UUID,
    "postedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "reversedById" UUID,
    "reversedAt" TIMESTAMP(3),
    "reversalJournalId" UUID,
    "reversalReason" TEXT,
    "supportingDocUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "JournalEntry_journalNumber_key" ON "JournalEntry"("journalNumber");
CREATE INDEX IF NOT EXISTS "JournalEntry_journalType_idx" ON "JournalEntry"("journalType");
CREATE INDEX IF NOT EXISTS "JournalEntry_postingDate_idx" ON "JournalEntry"("postingDate");
CREATE INDEX IF NOT EXISTS "JournalEntry_fiscalYear_idx" ON "JournalEntry"("fiscalYear");
CREATE INDEX IF NOT EXISTS "JournalEntry_status_idx" ON "JournalEntry"("status");
CREATE INDEX IF NOT EXISTS "JournalEntry_refDoc_idx" ON "JournalEntry"("referenceDocumentType", "referenceDocumentId");

CREATE TABLE IF NOT EXISTS "JournalEntryLine" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "journalEntryId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "lineOrder" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "debitAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "creditAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "customerId" UUID,
    "customerSiteId" UUID,
    "supplierId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntryLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "JournalEntryLine_journalEntryId_idx" ON "JournalEntryLine"("journalEntryId");
CREATE INDEX IF NOT EXISTS "JournalEntryLine_accountId_idx" ON "JournalEntryLine"("accountId");
CREATE INDEX IF NOT EXISTS "JournalEntryLine_customerId_idx" ON "JournalEntryLine"("customerId");
CREATE INDEX IF NOT EXISTS "JournalEntryLine_customerSiteId_idx" ON "JournalEntryLine"("customerSiteId");
CREATE INDEX IF NOT EXISTS "JournalEntryLine_supplierId_idx" ON "JournalEntryLine"("supplierId");

-- 4. Sales & Rental Invoicing
CREATE TABLE IF NOT EXISTS "Invoice" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invoiceNumber" TEXT NOT NULL,
    "invoiceType" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "customerSiteId" UUID,
    "rentalStatementId" UUID,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "placeOfSupply" TEXT NOT NULL DEFAULT '33',
    "isInterState" BOOLEAN NOT NULL DEFAULT false,
    "customerGstin" TEXT,
    "customerPan" TEXT,
    "billingAddress" JSONB,
    "shippingAddress" JSONB,
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxableAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cgstAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalTaxAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "roundOff" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "outstandingAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "journalEntryId" UUID,
    "irn" TEXT,
    "signedQrCode" TEXT,
    "ackNumber" TEXT,
    "ackDate" TIMESTAMP(3),
    "eInvoiceStatus" TEXT NOT NULL DEFAULT 'NOT_APPLICABLE',
    "snapshotPayload" JSONB,
    "notes" TEXT,
    "termsAndConditions" TEXT,
    "createdById" UUID,
    "postedById" UUID,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE INDEX IF NOT EXISTS "Invoice_customerId_idx" ON "Invoice"("customerId");
CREATE INDEX IF NOT EXISTS "Invoice_customerSiteId_idx" ON "Invoice"("customerSiteId");
CREATE INDEX IF NOT EXISTS "Invoice_rentalStatementId_idx" ON "Invoice"("rentalStatementId");
CREATE INDEX IF NOT EXISTS "Invoice_invoiceDate_idx" ON "Invoice"("invoiceDate");
CREATE INDEX IF NOT EXISTS "Invoice_fiscalYear_idx" ON "Invoice"("fiscalYear");
CREATE INDEX IF NOT EXISTS "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX IF NOT EXISTS "Invoice_paymentStatus_idx" ON "Invoice"("paymentStatus");

CREATE TABLE IF NOT EXISTS "InvoiceItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invoiceId" UUID NOT NULL,
    "materialVariantId" UUID,
    "itemType" TEXT NOT NULL DEFAULT 'RENTAL',
    "itemDescription" TEXT NOT NULL,
    "hsnSacCode" TEXT NOT NULL DEFAULT '9973',
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "uom" TEXT NOT NULL DEFAULT 'Nos.',
    "unitRate" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxableValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "gstRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "cgstRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 9,
    "cgstAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sgstRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 9,
    "sgstAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "igstRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");
CREATE INDEX IF NOT EXISTS "InvoiceItem_materialVariantId_idx" ON "InvoiceItem"("materialVariantId");
CREATE INDEX IF NOT EXISTS "InvoiceItem_hsnSacCode_idx" ON "InvoiceItem"("hsnSacCode");

-- 5. Credit & Debit Notes
CREATE TABLE IF NOT EXISTS "CreditDebitNote" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "noteNumber" TEXT NOT NULL,
    "noteType" TEXT NOT NULL,
    "invoiceId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "noteDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fiscalYear" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "taxableAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cgstAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "journalEntryId" UUID,
    "snapshotPayload" JSONB,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditDebitNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CreditDebitNote_noteNumber_key" ON "CreditDebitNote"("noteNumber");
CREATE INDEX IF NOT EXISTS "CreditDebitNote_noteType_idx" ON "CreditDebitNote"("noteType");
CREATE INDEX IF NOT EXISTS "CreditDebitNote_invoiceId_idx" ON "CreditDebitNote"("invoiceId");
CREATE INDEX IF NOT EXISTS "CreditDebitNote_customerId_idx" ON "CreditDebitNote"("customerId");
CREATE INDEX IF NOT EXISTS "CreditDebitNote_status_idx" ON "CreditDebitNote"("status");

CREATE TABLE IF NOT EXISTS "CreditDebitNoteItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "creditDebitNoteId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "hsnSacCode" TEXT NOT NULL DEFAULT '9973',
    "taxableValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "gstRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "cgstAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,

    CONSTRAINT "CreditDebitNoteItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CreditDebitNoteItem_creditDebitNoteId_idx" ON "CreditDebitNoteItem"("creditDebitNoteId");

-- 6. Purchase Bills & Supplier Invoicing
CREATE TABLE IF NOT EXISTS "PurchaseBill" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "billNumber" TEXT NOT NULL,
    "billType" TEXT NOT NULL DEFAULT 'MATERIAL_PURCHASE',
    "supplierId" UUID NOT NULL,
    "purchaseOrderId" UUID,
    "goodsReceiptNoteId" UUID,
    "supplierInvoiceNumber" TEXT NOT NULL,
    "supplierInvoiceDate" TIMESTAMP(3) NOT NULL,
    "billDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "supplierGstin" TEXT,
    "placeOfSupply" TEXT NOT NULL DEFAULT '33',
    "isInterState" BOOLEAN NOT NULL DEFAULT false,
    "itcEligibility" TEXT NOT NULL DEFAULT 'INPUT_GOODS',
    "taxableAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cgstAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalTaxAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tdsPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tdsAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "outstandingAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "journalEntryId" UUID,
    "supportingDocUrl" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseBill_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseBill_billNumber_key" ON "PurchaseBill"("billNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseBill_supplier_invoice_key" ON "PurchaseBill"("supplierId", "supplierInvoiceNumber");
CREATE INDEX IF NOT EXISTS "PurchaseBill_supplierId_idx" ON "PurchaseBill"("supplierId");
CREATE INDEX IF NOT EXISTS "PurchaseBill_purchaseOrderId_idx" ON "PurchaseBill"("purchaseOrderId");
CREATE INDEX IF NOT EXISTS "PurchaseBill_goodsReceiptNoteId_idx" ON "PurchaseBill"("goodsReceiptNoteId");
CREATE INDEX IF NOT EXISTS "PurchaseBill_status_idx" ON "PurchaseBill"("status");
CREATE INDEX IF NOT EXISTS "PurchaseBill_paymentStatus_idx" ON "PurchaseBill"("paymentStatus");

CREATE TABLE IF NOT EXISTS "PurchaseBillItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "purchaseBillId" UUID NOT NULL,
    "materialVariantId" UUID,
    "description" TEXT NOT NULL,
    "hsnSacCode" TEXT NOT NULL DEFAULT '7308',
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "uom" TEXT NOT NULL DEFAULT 'Nos.',
    "unitRate" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxableValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "gstRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "cgstAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseBillItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PurchaseBillItem_purchaseBillId_idx" ON "PurchaseBillItem"("purchaseBillId");
CREATE INDEX IF NOT EXISTS "PurchaseBillItem_materialVariantId_idx" ON "PurchaseBillItem"("materialVariantId");

-- 7. Customer Receipts & Payment Allocations
CREATE TABLE IF NOT EXISTS "PaymentReceipt" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "receiptNumber" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fiscalYear" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "depositAccountId" UUID NOT NULL,
    "amountReceived" DECIMAL(15,2) NOT NULL,
    "allocatedAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "unallocatedAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "transactionReference" TEXT,
    "bankName" TEXT,
    "chequeDate" TIMESTAMP(3),
    "chequeStatus" TEXT,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "journalEntryId" UUID,
    "supportingDocUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentReceipt_receiptNumber_key" ON "PaymentReceipt"("receiptNumber");
CREATE INDEX IF NOT EXISTS "PaymentReceipt_customerId_idx" ON "PaymentReceipt"("customerId");
CREATE INDEX IF NOT EXISTS "PaymentReceipt_paymentDate_idx" ON "PaymentReceipt"("paymentDate");
CREATE INDEX IF NOT EXISTS "PaymentReceipt_status_idx" ON "PaymentReceipt"("status");

CREATE TABLE IF NOT EXISTS "PaymentAllocation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "receiptId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "allocatedAmount" DECIMAL(15,2) NOT NULL,
    "allocationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PaymentAllocation_receiptId_idx" ON "PaymentAllocation"("receiptId");
CREATE INDEX IF NOT EXISTS "PaymentAllocation_invoiceId_idx" ON "PaymentAllocation"("invoiceId");

-- 8. Supplier Payments & Bill Settlements
CREATE TABLE IF NOT EXISTS "SupplierPayment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "paymentNumber" TEXT NOT NULL,
    "supplierId" UUID NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fiscalYear" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "disbursingAccountId" UUID NOT NULL,
    "amountPaid" DECIMAL(15,2) NOT NULL,
    "allocatedAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "unallocatedAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "transactionReference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "journalEntryId" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupplierPayment_paymentNumber_key" ON "SupplierPayment"("paymentNumber");
CREATE INDEX IF NOT EXISTS "SupplierPayment_supplierId_idx" ON "SupplierPayment"("supplierId");
CREATE INDEX IF NOT EXISTS "SupplierPayment_paymentDate_idx" ON "SupplierPayment"("paymentDate");
CREATE INDEX IF NOT EXISTS "SupplierPayment_status_idx" ON "SupplierPayment"("status");

CREATE TABLE IF NOT EXISTS "SupplierPaymentAllocation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplierPaymentId" UUID NOT NULL,
    "purchaseBillId" UUID NOT NULL,
    "allocatedAmount" DECIMAL(15,2) NOT NULL,
    "allocationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPaymentAllocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SupplierPaymentAllocation_supplierPaymentId_idx" ON "SupplierPaymentAllocation"("supplierPaymentId");
CREATE INDEX IF NOT EXISTS "SupplierPaymentAllocation_purchaseBillId_idx" ON "SupplierPaymentAllocation"("purchaseBillId");

-- 9. Bank & Cash Transactions / Contra Vouchers
CREATE TABLE IF NOT EXISTS "BankTransaction" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "transactionNumber" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "accountId" UUID NOT NULL,
    "counterpartyAccountId" UUID,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(15,2) NOT NULL,
    "referenceNumber" TEXT,
    "description" TEXT NOT NULL,
    "isReconciled" BOOLEAN NOT NULL DEFAULT false,
    "reconciledDate" TIMESTAMP(3),
    "statementReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BankTransaction_transactionNumber_key" ON "BankTransaction"("transactionNumber");
CREATE INDEX IF NOT EXISTS "BankTransaction_accountId_idx" ON "BankTransaction"("accountId");
CREATE INDEX IF NOT EXISTS "BankTransaction_transactionType_idx" ON "BankTransaction"("transactionType");
CREATE INDEX IF NOT EXISTS "BankTransaction_transactionDate_idx" ON "BankTransaction"("transactionDate");
CREATE INDEX IF NOT EXISTS "BankTransaction_isReconciled_idx" ON "BankTransaction"("isReconciled");

-- 10. Financial Year Closing
CREATE TABLE IF NOT EXISTS "FinancialYearClosing" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fiscalYear" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "closedById" UUID,
    "retainedEarningsTransferred" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "closingJournalId" UUID,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialYearClosing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FinancialYearClosing_fiscalYear_key" ON "FinancialYearClosing"("fiscalYear");

-- 11. GST & HSN/SAC Master Data
CREATE TABLE IF NOT EXISTS "TaxRateMaster" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "taxName" TEXT NOT NULL,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "cgstPercent" DECIMAL(5,2) NOT NULL,
    "sgstPercent" DECIMAL(5,2) NOT NULL,
    "igstPercent" DECIMAL(5,2) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxRateMaster_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TaxRateMaster_taxName_key" ON "TaxRateMaster"("taxName");

CREATE TABLE IF NOT EXISTS "HsnSacMaster" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "defaultGstRate" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "category" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HsnSacMaster_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HsnSacMaster_code_key" ON "HsnSacMaster"("code");

-- Foreign Key Constraints
ALTER TABLE "ChartOfAccount" ADD CONSTRAINT "ChartOfAccount_parentAccountId_fkey" FOREIGN KEY ("parentAccountId") REFERENCES "ChartOfAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_accountingPeriodId_fkey" FOREIGN KEY ("accountingPeriodId") REFERENCES "AccountingPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JournalEntryLine" ADD CONSTRAINT "JournalEntryLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JournalEntryLine" ADD CONSTRAINT "JournalEntryLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ChartOfAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalEntryLine" ADD CONSTRAINT "JournalEntryLine_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JournalEntryLine" ADD CONSTRAINT "JournalEntryLine_customerSiteId_fkey" FOREIGN KEY ("customerSiteId") REFERENCES "CustomerSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JournalEntryLine" ADD CONSTRAINT "JournalEntryLine_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerSiteId_fkey" FOREIGN KEY ("customerSiteId") REFERENCES "CustomerSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_rentalStatementId_fkey" FOREIGN KEY ("rentalStatementId") REFERENCES "RentalStatement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_materialVariantId_fkey" FOREIGN KEY ("materialVariantId") REFERENCES "MaterialVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CreditDebitNote" ADD CONSTRAINT "CreditDebitNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditDebitNote" ADD CONSTRAINT "CreditDebitNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditDebitNote" ADD CONSTRAINT "CreditDebitNote_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CreditDebitNoteItem" ADD CONSTRAINT "CreditDebitNoteItem_creditDebitNoteId_fkey" FOREIGN KEY ("creditDebitNoteId") REFERENCES "CreditDebitNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PurchaseBill" ADD CONSTRAINT "PurchaseBill_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseBill" ADD CONSTRAINT "PurchaseBill_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseBill" ADD CONSTRAINT "PurchaseBill_goodsReceiptNoteId_fkey" FOREIGN KEY ("goodsReceiptNoteId") REFERENCES "GoodsReceiptNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseBill" ADD CONSTRAINT "PurchaseBill_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseBillItem" ADD CONSTRAINT "PurchaseBillItem_purchaseBillId_fkey" FOREIGN KEY ("purchaseBillId") REFERENCES "PurchaseBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseBillItem" ADD CONSTRAINT "PurchaseBillItem_materialVariantId_fkey" FOREIGN KEY ("materialVariantId") REFERENCES "MaterialVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_depositAccountId_fkey" FOREIGN KEY ("depositAccountId") REFERENCES "ChartOfAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "PaymentReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_disbursingAccountId_fkey" FOREIGN KEY ("disbursingAccountId") REFERENCES "ChartOfAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierPaymentAllocation" ADD CONSTRAINT "SupplierPaymentAllocation_supplierPaymentId_fkey" FOREIGN KEY ("supplierPaymentId") REFERENCES "SupplierPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierPaymentAllocation" ADD CONSTRAINT "SupplierPaymentAllocation_purchaseBillId_fkey" FOREIGN KEY ("purchaseBillId") REFERENCES "PurchaseBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ChartOfAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

