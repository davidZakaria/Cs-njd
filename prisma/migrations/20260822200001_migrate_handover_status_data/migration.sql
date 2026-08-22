-- Migrate legacy handover statuses to new standardized values
-- Runs in a separate migration so new enum values are committed first (PostgreSQL 55P04).
UPDATE "ContractWorkflow" SET "handoverStatus" = 'DELIVERY_PROTOCOL' WHERE "handoverStatus" = 'DELIVERED';
UPDATE "ContractWorkflow" SET "handoverStatus" = 'DELIVERY_EXTENSION' WHERE "handoverStatus" = 'EXTENSION';
UPDATE "ContractWorkflow" SET "handoverStatus" = 'REFUSED_DELIVERY' WHERE "handoverStatus" = 'LEGAL_DISPUTE';
