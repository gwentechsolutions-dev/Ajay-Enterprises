-- DropForeignKey
ALTER TABLE "RentalBatch" DROP CONSTRAINT "RentalBatch_deliveryNoteId_fkey";

-- DropForeignKey
ALTER TABLE "RentalBatch" DROP CONSTRAINT "RentalBatch_deliveryNoteItemId_fkey";

-- DropForeignKey
ALTER TABLE "RentalReturnAllocation" DROP CONSTRAINT "RentalReturnAllocation_materialReturnNoteId_fkey";

-- DropForeignKey
ALTER TABLE "RentalReturnAllocation" DROP CONSTRAINT "RentalReturnAllocation_materialReturnNoteItemId_fkey";

-- AlterTable
ALTER TABLE "RentalBatch" ADD COLUMN     "directSiteTransferId" UUID,
ADD COLUMN     "directSiteTransferItemId" UUID,
ALTER COLUMN "deliveryNoteId" DROP NOT NULL,
ALTER COLUMN "deliveryNoteItemId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "RentalReturnAllocation" ADD COLUMN     "directSiteTransferId" UUID,
ADD COLUMN     "directSiteTransferItemId" UUID,
ALTER COLUMN "materialReturnNoteId" DROP NOT NULL,
ALTER COLUMN "materialReturnNoteItemId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "DirectSiteTransferNote" (
    "id" UUID NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "transferDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceCustomerId" UUID NOT NULL,
    "sourceCustomerSiteId" UUID NOT NULL,
    "destinationCustomerId" UUID NOT NULL,
    "destinationCustomerSiteId" UUID NOT NULL,
    "sourceRentalAgreementId" UUID,
    "destinationRentalAgreementId" UUID,
    "vehicleId" UUID,
    "driverId" UUID,
    "vehicleTripId" UUID,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "dispatchedAt" TIMESTAMP(3),
    "dispatchedById" UUID,
    "sourceRepName" TEXT,
    "sourceRepPhone" TEXT,
    "sourceRepDesignation" TEXT,
    "sourceRepSignatureUrl" TEXT,
    "sourceGpsLat" DECIMAL(10,7),
    "sourceGpsLng" DECIMAL(10,7),
    "sourcePhotoUrl" TEXT,
    "receivedAt" TIMESTAMP(3),
    "receivedById" UUID,
    "destRepName" TEXT,
    "destRepPhone" TEXT,
    "destRepDesignation" TEXT,
    "destRepSignatureUrl" TEXT,
    "destGpsLat" DECIMAL(10,7),
    "destGpsLng" DECIMAL(10,7),
    "destPhotoUrl" TEXT,
    "includeCutoffDate" BOOLEAN NOT NULL DEFAULT false,
    "transportCharges" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "discrepancyNotes" TEXT,
    "createdById" UUID,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectSiteTransferNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectSiteTransferItem" (
    "id" UUID NOT NULL,
    "transferId" UUID NOT NULL,
    "materialVariantId" UUID NOT NULL,
    "ownershipType" TEXT NOT NULL DEFAULT 'OWNED',
    "sourceRentalBatchId" UUID,
    "quantityDispatched" DECIMAL(12,3) NOT NULL,
    "quantityAccepted" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "quantityDamaged" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "quantityMissing" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "quantityRejected" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "agreedDailyRate" DECIMAL(15,2),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectSiteTransferItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DirectSiteTransferNote_transferNumber_key" ON "DirectSiteTransferNote"("transferNumber");

-- CreateIndex
CREATE INDEX "DirectSiteTransferNote_sourceCustomerId_idx" ON "DirectSiteTransferNote"("sourceCustomerId");

-- CreateIndex
CREATE INDEX "DirectSiteTransferNote_sourceCustomerSiteId_idx" ON "DirectSiteTransferNote"("sourceCustomerSiteId");

-- CreateIndex
CREATE INDEX "DirectSiteTransferNote_destinationCustomerId_idx" ON "DirectSiteTransferNote"("destinationCustomerId");

-- CreateIndex
CREATE INDEX "DirectSiteTransferNote_destinationCustomerSiteId_idx" ON "DirectSiteTransferNote"("destinationCustomerSiteId");

-- CreateIndex
CREATE INDEX "DirectSiteTransferNote_status_idx" ON "DirectSiteTransferNote"("status");

-- CreateIndex
CREATE INDEX "DirectSiteTransferNote_transferDate_idx" ON "DirectSiteTransferNote"("transferDate");

-- CreateIndex
CREATE INDEX "DirectSiteTransferItem_transferId_idx" ON "DirectSiteTransferItem"("transferId");

-- CreateIndex
CREATE INDEX "DirectSiteTransferItem_materialVariantId_idx" ON "DirectSiteTransferItem"("materialVariantId");

-- CreateIndex
CREATE INDEX "DirectSiteTransferItem_sourceRentalBatchId_idx" ON "DirectSiteTransferItem"("sourceRentalBatchId");

-- CreateIndex
CREATE INDEX "DirectSiteTransferItem_ownershipType_idx" ON "DirectSiteTransferItem"("ownershipType");

-- CreateIndex
CREATE INDEX "RentalBatch_directSiteTransferId_idx" ON "RentalBatch"("directSiteTransferId");

-- CreateIndex
CREATE INDEX "RentalReturnAllocation_directSiteTransferId_idx" ON "RentalReturnAllocation"("directSiteTransferId");

-- AddForeignKey
ALTER TABLE "RentalBatch" ADD CONSTRAINT "RentalBatch_deliveryNoteId_fkey" FOREIGN KEY ("deliveryNoteId") REFERENCES "DeliveryNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalBatch" ADD CONSTRAINT "RentalBatch_deliveryNoteItemId_fkey" FOREIGN KEY ("deliveryNoteItemId") REFERENCES "DeliveryNoteItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalBatch" ADD CONSTRAINT "RentalBatch_directSiteTransferId_fkey" FOREIGN KEY ("directSiteTransferId") REFERENCES "DirectSiteTransferNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalBatch" ADD CONSTRAINT "RentalBatch_directSiteTransferItemId_fkey" FOREIGN KEY ("directSiteTransferItemId") REFERENCES "DirectSiteTransferItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalReturnAllocation" ADD CONSTRAINT "RentalReturnAllocation_materialReturnNoteId_fkey" FOREIGN KEY ("materialReturnNoteId") REFERENCES "MaterialReturnNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalReturnAllocation" ADD CONSTRAINT "RentalReturnAllocation_materialReturnNoteItemId_fkey" FOREIGN KEY ("materialReturnNoteItemId") REFERENCES "MaterialReturnNoteItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalReturnAllocation" ADD CONSTRAINT "RentalReturnAllocation_directSiteTransferId_fkey" FOREIGN KEY ("directSiteTransferId") REFERENCES "DirectSiteTransferNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalReturnAllocation" ADD CONSTRAINT "RentalReturnAllocation_directSiteTransferItemId_fkey" FOREIGN KEY ("directSiteTransferItemId") REFERENCES "DirectSiteTransferItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectSiteTransferNote" ADD CONSTRAINT "DirectSiteTransferNote_sourceCustomerId_fkey" FOREIGN KEY ("sourceCustomerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectSiteTransferNote" ADD CONSTRAINT "DirectSiteTransferNote_sourceCustomerSiteId_fkey" FOREIGN KEY ("sourceCustomerSiteId") REFERENCES "CustomerSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectSiteTransferNote" ADD CONSTRAINT "DirectSiteTransferNote_destinationCustomerId_fkey" FOREIGN KEY ("destinationCustomerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectSiteTransferNote" ADD CONSTRAINT "DirectSiteTransferNote_destinationCustomerSiteId_fkey" FOREIGN KEY ("destinationCustomerSiteId") REFERENCES "CustomerSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectSiteTransferNote" ADD CONSTRAINT "DirectSiteTransferNote_sourceRentalAgreementId_fkey" FOREIGN KEY ("sourceRentalAgreementId") REFERENCES "RentalAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectSiteTransferNote" ADD CONSTRAINT "DirectSiteTransferNote_destinationRentalAgreementId_fkey" FOREIGN KEY ("destinationRentalAgreementId") REFERENCES "RentalAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectSiteTransferNote" ADD CONSTRAINT "DirectSiteTransferNote_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectSiteTransferNote" ADD CONSTRAINT "DirectSiteTransferNote_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectSiteTransferNote" ADD CONSTRAINT "DirectSiteTransferNote_vehicleTripId_fkey" FOREIGN KEY ("vehicleTripId") REFERENCES "VehicleTrip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectSiteTransferItem" ADD CONSTRAINT "DirectSiteTransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "DirectSiteTransferNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectSiteTransferItem" ADD CONSTRAINT "DirectSiteTransferItem_materialVariantId_fkey" FOREIGN KEY ("materialVariantId") REFERENCES "MaterialVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectSiteTransferItem" ADD CONSTRAINT "DirectSiteTransferItem_sourceRentalBatchId_fkey" FOREIGN KEY ("sourceRentalBatchId") REFERENCES "RentalBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
