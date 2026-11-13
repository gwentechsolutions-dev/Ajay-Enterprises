-- Migration: 20261113000005_phase4_rental_management_billing
-- Description: Phase 4 Rental Agreement, Rental Batches, Daily Calculation Details, Monthly Statements, Damage Loss Assessments, Deposits & Site Closure Settlements
-- Operating Business: AJAY ENTERPRISES | Product: INVENTRA ERP

-- 1. Rental Agreement & Items
CREATE TABLE IF NOT EXISTS "RentalAgreement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agreementNumber" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "customerSiteId" UUID NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "billingFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "billingCycleDay" INTEGER NOT NULL DEFAULT 1,
    "depositAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "depositStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentTerms" TEXT,
    "specialTerms" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdById" UUID,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "attachments" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentalAgreement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RentalAgreementItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rentalAgreementId" UUID NOT NULL,
    "materialVariantId" UUID NOT NULL,
    "agreedDailyRate" DECIMAL(15,2) NOT NULL,
    "securityDepositRate" DECIMAL(15,2),
    "remarks" TEXT,

    CONSTRAINT "RentalAgreementItem_pkey" PRIMARY KEY ("id")
);

-- 2. Material Rental Tracking Batches & Return Allocations
CREATE TABLE IF NOT EXISTS "RentalBatch" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "batchNumber" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "customerSiteId" UUID NOT NULL,
    "materialVariantId" UUID NOT NULL,
    "ownershipType" TEXT NOT NULL DEFAULT 'OWNED',
    "deliveryNoteId" UUID NOT NULL,
    "deliveryNoteItemId" UUID NOT NULL,
    "deliveryDate" TIMESTAMP(3) NOT NULL,
    "includeDeliveryDate" BOOLEAN NOT NULL DEFAULT true,
    "deliveredQty" DECIMAL(12,3) NOT NULL,
    "returnedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "damagedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "missingQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "currentHeldQty" DECIMAL(12,3) NOT NULL,
    "applicableDailyRate" DECIMAL(15,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentalBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RentalReturnAllocation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rentalBatchId" UUID NOT NULL,
    "materialReturnNoteId" UUID NOT NULL,
    "materialReturnNoteItemId" UUID NOT NULL,
    "returnDate" TIMESTAMP(3) NOT NULL,
    "includeReturnDate" BOOLEAN NOT NULL DEFAULT false,
    "allocatedReturnedQty" DECIMAL(12,3) NOT NULL,
    "allocatedAcceptedQty" DECIMAL(12,3) NOT NULL,
    "allocatedDamagedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "allocatedMissingQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentalReturnAllocation_pkey" PRIMARY KEY ("id")
);

-- 3. Monthly Rental Statements & Day-by-Day Calculation Breakdowns
CREATE TABLE IF NOT EXISTS "RentalStatement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "statementNumber" TEXT NOT NULL,
    "billingMode" TEXT NOT NULL DEFAULT 'SITE_WISE',
    "customerId" UUID NOT NULL,
    "customerSiteId" UUID,
    "rentalAgreementId" UUID,
    "periodStartDate" TIMESTAMP(3) NOT NULL,
    "periodEndDate" TIMESTAMP(3) NOT NULL,
    "totalRentalAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalDamageCharges" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalMissingCharges" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalAdjustments" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "netPayableAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "previousBalanceInformational" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "calculatedAt" TIMESTAMP(3),
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "finalizedById" UUID,
    "finalizedAt" TIMESTAMP(3),
    "snapshotPayload" JSONB,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentalStatement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RentalStatementItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "statementId" UUID NOT NULL,
    "customerSiteId" UUID NOT NULL,
    "materialVariantId" UUID NOT NULL,
    "rentalBatchId" UUID,
    "ownershipType" TEXT NOT NULL DEFAULT 'OWNED',
    "openingHeldQty" DECIMAL(12,3) NOT NULL,
    "newDeliveredQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "returnedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "damagedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "missingQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "closingHeldQty" DECIMAL(12,3) NOT NULL,
    "billableDays" INTEGER NOT NULL,
    "applicableDailyRate" DECIMAL(15,2) NOT NULL,
    "rentalAmount" DECIMAL(15,2) NOT NULL,
    "remarks" TEXT,

    CONSTRAINT "RentalStatementItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RentalStatementDayDetail" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "statementItemId" UUID NOT NULL,
    "rentalBatchId" UUID,
    "calculationDate" TIMESTAMP(3) NOT NULL,
    "eligibleQuantity" DECIMAL(12,3) NOT NULL,
    "dailyRate" DECIMAL(15,2) NOT NULL,
    "dayAmount" DECIMAL(15,2) NOT NULL,
    "isDeliveryDay" BOOLEAN NOT NULL DEFAULT false,
    "isReturnDay" BOOLEAN NOT NULL DEFAULT false,
    "billed" BOOLEAN NOT NULL DEFAULT true,
    "explanation" TEXT,

    CONSTRAINT "RentalStatementDayDetail_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RentalStatementSiteSummary" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "statementId" UUID NOT NULL,
    "customerSiteId" UUID NOT NULL,
    "siteRentalAmount" DECIMAL(15,2) NOT NULL,
    "siteDamageCharges" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "siteMissingCharges" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "siteTotalAmount" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "RentalStatementSiteSummary_pkey" PRIMARY KEY ("id")
);

-- 4. Damage & Loss Assessments
CREATE TABLE IF NOT EXISTS "DamageLossAssessment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assessmentNumber" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "customerSiteId" UUID NOT NULL,
    "materialReturnNoteId" UUID,
    "materialVariantId" UUID NOT NULL,
    "statementId" UUID,
    "assessmentType" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "condition" TEXT NOT NULL DEFAULT 'DAMAGED',
    "assessmentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedChargeAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "remarks" TEXT,
    "photographs" JSONB,
    "assessedById" UUID,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DamageLossAssessment_pkey" PRIMARY KEY ("id")
);

-- 5. Rental Deposits
CREATE TABLE IF NOT EXISTS "RentalDepositTransaction" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "depositNumber" TEXT NOT NULL,
    "rentalAgreementId" UUID,
    "customerId" UUID NOT NULL,
    "customerSiteId" UUID NOT NULL,
    "transactionType" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "receiptDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referenceNumber" TEXT,
    "notes" TEXT,
    "refundEligibility" BOOLEAN NOT NULL DEFAULT false,
    "refundStatus" TEXT,
    "refundAmount" DECIMAL(15,2),
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentalDepositTransaction_pkey" PRIMARY KEY ("id")
);

-- 6. Customer Site Closure & Final Settlements
CREATE TABLE IF NOT EXISTS "SiteClosureSettlement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "settlementNumber" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "customerSiteId" UUID NOT NULL,
    "closureDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "outstandingHeldQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "unreturnedMaterialDetails" JSONB,
    "damageChargesTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "missingChargesTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "finalRentalTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "depositBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "netPayableOrRefundable" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "hasOutstandingStock" BOOLEAN NOT NULL DEFAULT false,
    "ownerApprovedException" BOOLEAN NOT NULL DEFAULT false,
    "exceptionApprovedById" UUID,
    "exceptionReason" TEXT,
    "customerAcknowledgement" JSONB,
    "remarks" TEXT,
    "createdById" UUID,
    "finalizedById" UUID,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteClosureSettlement_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "RentalAgreement_agreementNumber_key" ON "RentalAgreement"("agreementNumber");
CREATE INDEX IF NOT EXISTS "RentalAgreement_agreementNumber_idx" ON "RentalAgreement"("agreementNumber");
CREATE INDEX IF NOT EXISTS "RentalAgreement_customerId_idx" ON "RentalAgreement"("customerId");
CREATE INDEX IF NOT EXISTS "RentalAgreement_customerSiteId_idx" ON "RentalAgreement"("customerSiteId");
CREATE INDEX IF NOT EXISTS "RentalAgreement_status_idx" ON "RentalAgreement"("status");
CREATE INDEX IF NOT EXISTS "RentalAgreement_startDate_idx" ON "RentalAgreement"("startDate");

CREATE INDEX IF NOT EXISTS "RentalAgreementItem_rentalAgreementId_idx" ON "RentalAgreementItem"("rentalAgreementId");
CREATE INDEX IF NOT EXISTS "RentalAgreementItem_materialVariantId_idx" ON "RentalAgreementItem"("materialVariantId");

CREATE UNIQUE INDEX IF NOT EXISTS "RentalBatch_batchNumber_key" ON "RentalBatch"("batchNumber");
CREATE INDEX IF NOT EXISTS "RentalBatch_customerId_idx" ON "RentalBatch"("customerId");
CREATE INDEX IF NOT EXISTS "RentalBatch_customerSiteId_idx" ON "RentalBatch"("customerSiteId");
CREATE INDEX IF NOT EXISTS "RentalBatch_materialVariantId_idx" ON "RentalBatch"("materialVariantId");
CREATE INDEX IF NOT EXISTS "RentalBatch_deliveryNoteId_idx" ON "RentalBatch"("deliveryNoteId");
CREATE INDEX IF NOT EXISTS "RentalBatch_ownershipType_idx" ON "RentalBatch"("ownershipType");
CREATE INDEX IF NOT EXISTS "RentalBatch_status_idx" ON "RentalBatch"("status");
CREATE INDEX IF NOT EXISTS "RentalBatch_deliveryDate_idx" ON "RentalBatch"("deliveryDate");

CREATE INDEX IF NOT EXISTS "RentalReturnAllocation_rentalBatchId_idx" ON "RentalReturnAllocation"("rentalBatchId");
CREATE INDEX IF NOT EXISTS "RentalReturnAllocation_materialReturnNoteId_idx" ON "RentalReturnAllocation"("materialReturnNoteId");
CREATE INDEX IF NOT EXISTS "RentalReturnAllocation_materialReturnNoteItemId_idx" ON "RentalReturnAllocation"("materialReturnNoteItemId");
CREATE INDEX IF NOT EXISTS "RentalReturnAllocation_returnDate_idx" ON "RentalReturnAllocation"("returnDate");

CREATE UNIQUE INDEX IF NOT EXISTS "RentalStatement_statementNumber_key" ON "RentalStatement"("statementNumber");
CREATE INDEX IF NOT EXISTS "RentalStatement_statementNumber_idx" ON "RentalStatement"("statementNumber");
CREATE INDEX IF NOT EXISTS "RentalStatement_customerId_idx" ON "RentalStatement"("customerId");
CREATE INDEX IF NOT EXISTS "RentalStatement_customerSiteId_idx" ON "RentalStatement"("customerSiteId");
CREATE INDEX IF NOT EXISTS "RentalStatement_periodStartDate_periodEndDate_idx" ON "RentalStatement"("periodStartDate", "periodEndDate");
CREATE INDEX IF NOT EXISTS "RentalStatement_status_idx" ON "RentalStatement"("status");

CREATE INDEX IF NOT EXISTS "RentalStatementItem_statementId_idx" ON "RentalStatementItem"("statementId");
CREATE INDEX IF NOT EXISTS "RentalStatementItem_customerSiteId_idx" ON "RentalStatementItem"("customerSiteId");
CREATE INDEX IF NOT EXISTS "RentalStatementItem_materialVariantId_idx" ON "RentalStatementItem"("materialVariantId");
CREATE INDEX IF NOT EXISTS "RentalStatementItem_rentalBatchId_idx" ON "RentalStatementItem"("rentalBatchId");

CREATE INDEX IF NOT EXISTS "RentalStatementDayDetail_statementItemId_idx" ON "RentalStatementDayDetail"("statementItemId");
CREATE INDEX IF NOT EXISTS "RentalStatementDayDetail_rentalBatchId_idx" ON "RentalStatementDayDetail"("rentalBatchId");
CREATE INDEX IF NOT EXISTS "RentalStatementDayDetail_calculationDate_idx" ON "RentalStatementDayDetail"("calculationDate");

CREATE INDEX IF NOT EXISTS "RentalStatementSiteSummary_statementId_idx" ON "RentalStatementSiteSummary"("statementId");
CREATE INDEX IF NOT EXISTS "RentalStatementSiteSummary_customerSiteId_idx" ON "RentalStatementSiteSummary"("customerSiteId");

CREATE UNIQUE INDEX IF NOT EXISTS "DamageLossAssessment_assessmentNumber_key" ON "DamageLossAssessment"("assessmentNumber");
CREATE INDEX IF NOT EXISTS "DamageLossAssessment_assessmentNumber_idx" ON "DamageLossAssessment"("assessmentNumber");
CREATE INDEX IF NOT EXISTS "DamageLossAssessment_customerId_idx" ON "DamageLossAssessment"("customerId");
CREATE INDEX IF NOT EXISTS "DamageLossAssessment_customerSiteId_idx" ON "DamageLossAssessment"("customerSiteId");
CREATE INDEX IF NOT EXISTS "DamageLossAssessment_materialReturnNoteId_idx" ON "DamageLossAssessment"("materialReturnNoteId");
CREATE INDEX IF NOT EXISTS "DamageLossAssessment_materialVariantId_idx" ON "DamageLossAssessment"("materialVariantId");
CREATE INDEX IF NOT EXISTS "DamageLossAssessment_statementId_idx" ON "DamageLossAssessment"("statementId");
CREATE INDEX IF NOT EXISTS "DamageLossAssessment_status_idx" ON "DamageLossAssessment"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "RentalDepositTransaction_depositNumber_key" ON "RentalDepositTransaction"("depositNumber");
CREATE INDEX IF NOT EXISTS "RentalDepositTransaction_depositNumber_idx" ON "RentalDepositTransaction"("depositNumber");
CREATE INDEX IF NOT EXISTS "RentalDepositTransaction_customerId_idx" ON "RentalDepositTransaction"("customerId");
CREATE INDEX IF NOT EXISTS "RentalDepositTransaction_customerSiteId_idx" ON "RentalDepositTransaction"("customerSiteId");
CREATE INDEX IF NOT EXISTS "RentalDepositTransaction_rentalAgreementId_idx" ON "RentalDepositTransaction"("rentalAgreementId");
CREATE INDEX IF NOT EXISTS "RentalDepositTransaction_transactionType_idx" ON "RentalDepositTransaction"("transactionType");

CREATE UNIQUE INDEX IF NOT EXISTS "SiteClosureSettlement_settlementNumber_key" ON "SiteClosureSettlement"("settlementNumber");
CREATE INDEX IF NOT EXISTS "SiteClosureSettlement_settlementNumber_idx" ON "SiteClosureSettlement"("settlementNumber");
CREATE INDEX IF NOT EXISTS "SiteClosureSettlement_customerId_idx" ON "SiteClosureSettlement"("customerId");
CREATE INDEX IF NOT EXISTS "SiteClosureSettlement_customerSiteId_idx" ON "SiteClosureSettlement"("customerSiteId");
CREATE INDEX IF NOT EXISTS "SiteClosureSettlement_status_idx" ON "SiteClosureSettlement"("status");

-- Foreign Key Constraints (Safe DO blocks)
DO $$ BEGIN
    ALTER TABLE "RentalAgreement" ADD CONSTRAINT "RentalAgreement_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RentalAgreement" ADD CONSTRAINT "RentalAgreement_customerSiteId_fkey" FOREIGN KEY ("customerSiteId") REFERENCES "CustomerSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RentalAgreementItem" ADD CONSTRAINT "RentalAgreementItem_rentalAgreementId_fkey" FOREIGN KEY ("rentalAgreementId") REFERENCES "RentalAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RentalAgreementItem" ADD CONSTRAINT "RentalAgreementItem_materialVariantId_fkey" FOREIGN KEY ("materialVariantId") REFERENCES "MaterialVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RentalBatch" ADD CONSTRAINT "RentalBatch_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RentalBatch" ADD CONSTRAINT "RentalBatch_customerSiteId_fkey" FOREIGN KEY ("customerSiteId") REFERENCES "CustomerSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RentalBatch" ADD CONSTRAINT "RentalBatch_materialVariantId_fkey" FOREIGN KEY ("materialVariantId") REFERENCES "MaterialVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RentalBatch" ADD CONSTRAINT "RentalBatch_deliveryNoteId_fkey" FOREIGN KEY ("deliveryNoteId") REFERENCES "DeliveryNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RentalBatch" ADD CONSTRAINT "RentalBatch_deliveryNoteItemId_fkey" FOREIGN KEY ("deliveryNoteItemId") REFERENCES "DeliveryNoteItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RentalReturnAllocation" ADD CONSTRAINT "RentalReturnAllocation_rentalBatchId_fkey" FOREIGN KEY ("rentalBatchId") REFERENCES "RentalBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RentalReturnAllocation" ADD CONSTRAINT "RentalReturnAllocation_materialReturnNoteId_fkey" FOREIGN KEY ("materialReturnNoteId") REFERENCES "MaterialReturnNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RentalReturnAllocation" ADD CONSTRAINT "RentalReturnAllocation_materialReturnNoteItemId_fkey" FOREIGN KEY ("materialReturnNoteItemId") REFERENCES "MaterialReturnNoteItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RentalStatement" ADD CONSTRAINT "RentalStatement_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RentalStatement" ADD CONSTRAINT "RentalStatement_customerSiteId_fkey" FOREIGN KEY ("customerSiteId") REFERENCES "CustomerSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RentalStatement" ADD CONSTRAINT "RentalStatement_rentalAgreementId_fkey" FOREIGN KEY ("rentalAgreementId") REFERENCES "RentalAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RentalStatementItem" ADD CONSTRAINT "RentalStatementItem_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "RentalStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RentalStatementItem" ADD CONSTRAINT "RentalStatementItem_customerSiteId_fkey" FOREIGN KEY ("customerSiteId") REFERENCES "CustomerSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RentalStatementItem" ADD CONSTRAINT "RentalStatementItem_materialVariantId_fkey" FOREIGN KEY ("materialVariantId") REFERENCES "MaterialVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RentalStatementItem" ADD CONSTRAINT "RentalStatementItem_rentalBatchId_fkey" FOREIGN KEY ("rentalBatchId") REFERENCES "RentalBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RentalStatementDayDetail" ADD CONSTRAINT "RentalStatementDayDetail_statementItemId_fkey" FOREIGN KEY ("statementItemId") REFERENCES "RentalStatementItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RentalStatementDayDetail" ADD CONSTRAINT "RentalStatementDayDetail_rentalBatchId_fkey" FOREIGN KEY ("rentalBatchId") REFERENCES "RentalBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RentalStatementSiteSummary" ADD CONSTRAINT "RentalStatementSiteSummary_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "RentalStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RentalStatementSiteSummary" ADD CONSTRAINT "RentalStatementSiteSummary_customerSiteId_fkey" FOREIGN KEY ("customerSiteId") REFERENCES "CustomerSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "DamageLossAssessment" ADD CONSTRAINT "DamageLossAssessment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "DamageLossAssessment" ADD CONSTRAINT "DamageLossAssessment_customerSiteId_fkey" FOREIGN KEY ("customerSiteId") REFERENCES "CustomerSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "DamageLossAssessment" ADD CONSTRAINT "DamageLossAssessment_materialReturnNoteId_fkey" FOREIGN KEY ("materialReturnNoteId") REFERENCES "MaterialReturnNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "DamageLossAssessment" ADD CONSTRAINT "DamageLossAssessment_materialVariantId_fkey" FOREIGN KEY ("materialVariantId") REFERENCES "MaterialVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "DamageLossAssessment" ADD CONSTRAINT "DamageLossAssessment_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "RentalStatement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RentalDepositTransaction" ADD CONSTRAINT "RentalDepositTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RentalDepositTransaction" ADD CONSTRAINT "RentalDepositTransaction_customerSiteId_fkey" FOREIGN KEY ("customerSiteId") REFERENCES "CustomerSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RentalDepositTransaction" ADD CONSTRAINT "RentalDepositTransaction_rentalAgreementId_fkey" FOREIGN KEY ("rentalAgreementId") REFERENCES "RentalAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "SiteClosureSettlement" ADD CONSTRAINT "SiteClosureSettlement_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "SiteClosureSettlement" ADD CONSTRAINT "SiteClosureSettlement_customerSiteId_fkey" FOREIGN KEY ("customerSiteId") REFERENCES "CustomerSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enable Row Level Security (RLS) on all Phase 4 tables
ALTER TABLE "RentalAgreement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RentalAgreementItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RentalBatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RentalReturnAllocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RentalStatement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RentalStatementItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RentalStatementDayDetail" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RentalStatementSiteSummary" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DamageLossAssessment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RentalDepositTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SiteClosureSettlement" ENABLE ROW LEVEL SECURITY;

