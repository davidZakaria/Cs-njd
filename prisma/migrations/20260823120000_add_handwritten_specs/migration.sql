-- Add ROOF unit type (APARTMENT, DUPLEX, PENTHOUSE already exist)
ALTER TYPE "UnitType" ADD VALUE IF NOT EXISTS 'ROOF';

-- Client: address fields from handwritten CS specs
ALTER TABLE "Client" ADD COLUMN "address1" TEXT;
ALTER TABLE "Client" ADD COLUMN "address2" TEXT;

-- Unit: delivery year & grace period
ALTER TABLE "Unit" ADD COLUMN "deliveryYear" TEXT;
ALTER TABLE "Unit" ADD COLUMN "gracePeriod" TEXT;

-- Finishing: current finishing status (موقف الوحده الحالي من التشطيب)
ALTER TABLE "Finishing" ADD COLUMN "currentFinishingStatus" TEXT;
