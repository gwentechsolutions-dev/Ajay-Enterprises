-- AlterTable
ALTER TABLE "DamageLossAssessment" ADD COLUMN     "directSiteTransferId" UUID;

-- AlterTable
ALTER TABLE "DirectSiteTransferNote" ADD COLUMN     "discrepancyResponsibleParty" TEXT DEFAULT 'UNDER_INVESTIGATION',
ADD COLUMN     "rejectedDisposition" TEXT DEFAULT 'RETURN_TO_WAREHOUSE';

-- AlterTable
ALTER TABLE "MaterialRepairJob" ADD COLUMN     "directSiteTransferId" UUID;

-- CreateIndex
CREATE INDEX "DamageLossAssessment_directSiteTransferId_idx" ON "DamageLossAssessment"("directSiteTransferId");

-- CreateIndex
CREATE INDEX "MaterialRepairJob_directSiteTransferId_idx" ON "MaterialRepairJob"("directSiteTransferId");

-- AddForeignKey
ALTER TABLE "DamageLossAssessment" ADD CONSTRAINT "DamageLossAssessment_directSiteTransferId_fkey" FOREIGN KEY ("directSiteTransferId") REFERENCES "DirectSiteTransferNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRepairJob" ADD CONSTRAINT "MaterialRepairJob_directSiteTransferId_fkey" FOREIGN KEY ("directSiteTransferId") REFERENCES "DirectSiteTransferNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
