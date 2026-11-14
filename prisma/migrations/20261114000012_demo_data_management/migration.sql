-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CreditDebitNote" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CustomerSite" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "DamageLossAssessment" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "DeliveryNote" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "DirectSiteTransferNote" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "GoodsReceiptNote" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "HiringDeliveryNote" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "HiringReturnNote" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "InventoryMovement" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "LabourAdvance" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "LabourAttendance" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "LabourWageSettlement" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "LabourWorker" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MaterialRepairJob" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MaterialReturnNote" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MaterialVariant" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PaymentReceipt" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PurchaseBill" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PurchaseReturn" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RentalAgreement" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RentalBatch" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RentalStatement" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SiteClosureSettlement" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StockAudit" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StockTransferNote" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SupplierPayment" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "VehicleFuelLog" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "VehicleMaintenanceRecord" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "VehicleTrip" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Warehouse" ADD COLUMN     "demoRunId" UUID,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DemoDataRun" (
    "id" UUID NOT NULL,
    "runNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "moduleCounts" TEXT,
    "metadata" TEXT,
    "generatedById" UUID,
    "clearedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clearedAt" TIMESTAMP(3),

    CONSTRAINT "DemoDataRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoDataRecord" (
    "id" UUID NOT NULL,
    "demoRunId" UUID NOT NULL,
    "tableName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "recordCode" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoDataRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DemoDataRun_runNumber_key" ON "DemoDataRun"("runNumber");

-- CreateIndex
CREATE INDEX "DemoDataRun_status_idx" ON "DemoDataRun"("status");

-- CreateIndex
CREATE INDEX "DemoDataRun_createdAt_idx" ON "DemoDataRun"("createdAt");

-- CreateIndex
CREATE INDEX "DemoDataRun_runNumber_idx" ON "DemoDataRun"("runNumber");

-- CreateIndex
CREATE INDEX "DemoDataRecord_demoRunId_idx" ON "DemoDataRecord"("demoRunId");

-- CreateIndex
CREATE INDEX "DemoDataRecord_tableName_idx" ON "DemoDataRecord"("tableName");

-- CreateIndex
CREATE UNIQUE INDEX "DemoDataRecord_tableName_recordId_key" ON "DemoDataRecord"("tableName", "recordId");

-- AddForeignKey
ALTER TABLE "DemoDataRun" ADD CONSTRAINT "DemoDataRun_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemoDataRun" ADD CONSTRAINT "DemoDataRun_clearedById_fkey" FOREIGN KEY ("clearedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemoDataRecord" ADD CONSTRAINT "DemoDataRecord_demoRunId_fkey" FOREIGN KEY ("demoRunId") REFERENCES "DemoDataRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
