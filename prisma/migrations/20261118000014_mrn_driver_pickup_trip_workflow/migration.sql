-- AlterTable MaterialReturnNote
ALTER TABLE "MaterialReturnNote" 
ADD COLUMN IF NOT EXISTS "vehicleTripId" UUID,
ADD COLUMN IF NOT EXISTS "preferredPickupDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "preferredPickupTime" TEXT,
ADD COLUMN IF NOT EXISTS "pickupInstructions" TEXT,
ADD COLUMN IF NOT EXISTS "siteArrivedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "siteArrivalGpsLat" DECIMAL(10,7),
ADD COLUMN IF NOT EXISTS "siteArrivalGpsLng" DECIMAL(10,7),
ADD COLUMN IF NOT EXISTS "siteArrivalAccuracy" DECIMAL(8,2),
ADD COLUMN IF NOT EXISTS "pickupCompletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "pickupOdometer" DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS "yardArrivedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "yardArrivalGpsLat" DECIMAL(10,7),
ADD COLUMN IF NOT EXISTS "yardArrivalGpsLng" DECIMAL(10,7),
ADD COLUMN IF NOT EXISTS "yardOdometer" DECIMAL(10,2);

-- AlterTable MaterialReturnNoteItem
ALTER TABLE "MaterialReturnNoteItem"
ADD COLUMN IF NOT EXISTS "expectedQty" DECIMAL(12,3),
ADD COLUMN IF NOT EXISTS "driverCollectedQty" DECIMAL(12,3),
ADD COLUMN IF NOT EXISTS "driverGoodQty" DECIMAL(12,3),
ADD COLUMN IF NOT EXISTS "driverDamagedQty" DECIMAL(12,3),
ADD COLUMN IF NOT EXISTS "driverMissingQty" DECIMAL(12,3),
ADD COLUMN IF NOT EXISTS "driverRemarks" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MaterialReturnNote_vehicleTripId_idx" ON "MaterialReturnNote"("vehicleTripId");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MaterialReturnNote_vehicleTripId_fkey'
  ) THEN
    ALTER TABLE "MaterialReturnNote" 
    ADD CONSTRAINT "MaterialReturnNote_vehicleTripId_fkey" 
    FOREIGN KEY ("vehicleTripId") REFERENCES "VehicleTrip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
