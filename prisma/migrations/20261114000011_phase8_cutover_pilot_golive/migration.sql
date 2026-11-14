-- CreateTable
CREATE TABLE "OpeningStockBatch" (
    "id" UUID NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Initial Cutover Stock Entry',
    "cutoverDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "totalOwnedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "totalHiredQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "totalOwnedValuation" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "preparedById" UUID,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "postedById" UUID,
    "postedAt" TIMESTAMP(3),
    "supportingDocUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpeningStockBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpeningStockItem" (
    "id" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "materialVariantId" UUID NOT NULL,
    "ownershipType" TEXT NOT NULL DEFAULT 'OWNED',
    "locationType" TEXT NOT NULL DEFAULT 'WAREHOUSE',
    "warehouseId" UUID,
    "customerId" UUID,
    "customerSiteId" UUID,
    "quantity" DECIMAL(12,3) NOT NULL,
    "uom" TEXT NOT NULL DEFAULT 'Nos.',
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "unitCost" DECIMAL(15,2),
    "totalValuation" DECIMAL(15,2),
    "dailyRentalRate" DECIMAL(15,2),
    "inventoryMovementId" UUID,
    "rentalBatchId" UUID,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpeningStockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpeningBalanceBatch" (
    "id" UUID NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalDebit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalCredit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "difference" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "isBalanced" BOOLEAN NOT NULL DEFAULT false,
    "journalEntryId" UUID,
    "preparedById" UUID,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "postedById" UUID,
    "postedAt" TIMESTAMP(3),
    "notes" TEXT,
    "supportingDocUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpeningBalanceBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpeningBalanceItem" (
    "id" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "accountCode" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "partyType" TEXT,
    "customerId" UUID,
    "supplierId" UUID,
    "workerId" UUID,
    "partyName" TEXT,
    "referenceNumber" TEXT,
    "description" TEXT,
    "debitAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "creditAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpeningBalanceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CutoverMilestone" (
    "id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "hasDiscrepancies" BOOLEAN NOT NULL DEFAULT false,
    "discrepancyDetails" TEXT,
    "completedById" UUID,
    "completedAt" TIMESTAMP(3),
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CutoverMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PilotProgram" (
    "id" UUID NOT NULL,
    "pilotNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "targetEndDate" TIMESTAMP(3) NOT NULL,
    "actualEndDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "selectedWarehouses" TEXT,
    "selectedCustomers" TEXT,
    "selectedSites" TEXT,
    "metrics" TEXT,
    "exceptionsLog" TEXT,
    "completionReview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PilotProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffTrainingModule" (
    "id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "moduleCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "workflowChecklist" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "verifiedById" UUID,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffTrainingModule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpeningStockBatch_batchNumber_key" ON "OpeningStockBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "OpeningStockBatch_batchNumber_idx" ON "OpeningStockBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "OpeningStockBatch_status_idx" ON "OpeningStockBatch"("status");

-- CreateIndex
CREATE INDEX "OpeningStockBatch_cutoverDate_idx" ON "OpeningStockBatch"("cutoverDate");

-- CreateIndex
CREATE INDEX "OpeningStockItem_batchId_idx" ON "OpeningStockItem"("batchId");

-- CreateIndex
CREATE INDEX "OpeningStockItem_materialVariantId_idx" ON "OpeningStockItem"("materialVariantId");

-- CreateIndex
CREATE INDEX "OpeningStockItem_ownershipType_idx" ON "OpeningStockItem"("ownershipType");

-- CreateIndex
CREATE INDEX "OpeningStockItem_locationType_idx" ON "OpeningStockItem"("locationType");

-- CreateIndex
CREATE INDEX "OpeningStockItem_warehouseId_idx" ON "OpeningStockItem"("warehouseId");

-- CreateIndex
CREATE INDEX "OpeningStockItem_customerSiteId_idx" ON "OpeningStockItem"("customerSiteId");

-- CreateIndex
CREATE UNIQUE INDEX "OpeningStockItem_batchId_materialVariantId_ownershipType_lo_key" ON "OpeningStockItem"("batchId", "materialVariantId", "ownershipType", "locationType", "warehouseId", "customerSiteId");

-- CreateIndex
CREATE UNIQUE INDEX "OpeningBalanceBatch_batchNumber_key" ON "OpeningBalanceBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "OpeningBalanceBatch_batchNumber_idx" ON "OpeningBalanceBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "OpeningBalanceBatch_fiscalYear_idx" ON "OpeningBalanceBatch"("fiscalYear");

-- CreateIndex
CREATE INDEX "OpeningBalanceBatch_status_idx" ON "OpeningBalanceBatch"("status");

-- CreateIndex
CREATE INDEX "OpeningBalanceBatch_journalEntryId_idx" ON "OpeningBalanceBatch"("journalEntryId");

-- CreateIndex
CREATE INDEX "OpeningBalanceItem_batchId_idx" ON "OpeningBalanceItem"("batchId");

-- CreateIndex
CREATE INDEX "OpeningBalanceItem_accountId_idx" ON "OpeningBalanceItem"("accountId");

-- CreateIndex
CREATE INDEX "OpeningBalanceItem_customerId_idx" ON "OpeningBalanceItem"("customerId");

-- CreateIndex
CREATE INDEX "OpeningBalanceItem_supplierId_idx" ON "OpeningBalanceItem"("supplierId");

-- CreateIndex
CREATE INDEX "OpeningBalanceItem_workerId_idx" ON "OpeningBalanceItem"("workerId");

-- CreateIndex
CREATE UNIQUE INDEX "CutoverMilestone_code_key" ON "CutoverMilestone"("code");

-- CreateIndex
CREATE INDEX "CutoverMilestone_category_idx" ON "CutoverMilestone"("category");

-- CreateIndex
CREATE INDEX "CutoverMilestone_code_idx" ON "CutoverMilestone"("code");

-- CreateIndex
CREATE INDEX "CutoverMilestone_status_idx" ON "CutoverMilestone"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PilotProgram_pilotNumber_key" ON "PilotProgram"("pilotNumber");

-- CreateIndex
CREATE INDEX "PilotProgram_pilotNumber_idx" ON "PilotProgram"("pilotNumber");

-- CreateIndex
CREATE INDEX "PilotProgram_status_idx" ON "PilotProgram"("status");

-- CreateIndex
CREATE INDEX "PilotProgram_startDate_idx" ON "PilotProgram"("startDate");

-- CreateIndex
CREATE UNIQUE INDEX "StaffTrainingModule_moduleCode_key" ON "StaffTrainingModule"("moduleCode");

-- CreateIndex
CREATE INDEX "StaffTrainingModule_role_idx" ON "StaffTrainingModule"("role");

-- CreateIndex
CREATE INDEX "StaffTrainingModule_moduleCode_idx" ON "StaffTrainingModule"("moduleCode");

-- CreateIndex
CREATE INDEX "StaffTrainingModule_isCompleted_idx" ON "StaffTrainingModule"("isCompleted");

-- AddForeignKey
ALTER TABLE "OpeningStockItem" ADD CONSTRAINT "OpeningStockItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "OpeningStockBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningStockItem" ADD CONSTRAINT "OpeningStockItem_materialVariantId_fkey" FOREIGN KEY ("materialVariantId") REFERENCES "MaterialVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningStockItem" ADD CONSTRAINT "OpeningStockItem_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningStockItem" ADD CONSTRAINT "OpeningStockItem_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningStockItem" ADD CONSTRAINT "OpeningStockItem_customerSiteId_fkey" FOREIGN KEY ("customerSiteId") REFERENCES "CustomerSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningBalanceBatch" ADD CONSTRAINT "OpeningBalanceBatch_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningBalanceItem" ADD CONSTRAINT "OpeningBalanceItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "OpeningBalanceBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningBalanceItem" ADD CONSTRAINT "OpeningBalanceItem_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ChartOfAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningBalanceItem" ADD CONSTRAINT "OpeningBalanceItem_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningBalanceItem" ADD CONSTRAINT "OpeningBalanceItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningBalanceItem" ADD CONSTRAINT "OpeningBalanceItem_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "LabourWorker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

