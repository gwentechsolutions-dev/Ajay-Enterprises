-- AlterTable
ALTER TABLE "MaterialReturnNote" ADD COLUMN "customerRepresentativeName" TEXT,
ADD COLUMN "customerRepresentativeDesignation" TEXT,
ADD COLUMN "customerRepresentativePhone" TEXT,
ADD COLUMN "customerSignatureUrl" TEXT,
ADD COLUMN "handoverAt" TIMESTAMP(3),
ADD COLUMN "customerAgreedDamage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "receiverDesignation" TEXT,
ADD COLUMN "receivedAt" TIMESTAMP(3),
ADD COLUMN "companyStampUrl" TEXT,
ADD COLUMN "inspectionStatus" TEXT NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN "inspectedById" UUID,
ADD COLUMN "inspectorName" TEXT,
ADD COLUMN "inspectorDesignation" TEXT,
ADD COLUMN "inspectedAt" TIMESTAMP(3),
ADD COLUMN "inspectionRemarks" TEXT;

-- AlterTable
ALTER TABLE "MaterialReturnNoteItem" ADD COLUMN "receivedQty" DECIMAL(12,3),
ADD COLUMN "rejectedQty" DECIMAL(12,3) DEFAULT 0,
ADD COLUMN "inspectionRemarks" TEXT;
