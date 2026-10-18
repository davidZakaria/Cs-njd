-- CreateEnum
CREATE TYPE "UnitClientRole" AS ENUM ('PRIMARY', 'CO_OWNER');

-- CreateTable
CREATE TABLE "UnitClient" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "role" "UnitClientRole" NOT NULL DEFAULT 'CO_OWNER',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnitClient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnitClient_unitId_clientId_key" ON "UnitClient"("unitId", "clientId");

-- CreateIndex
CREATE INDEX "UnitClient_unitId_idx" ON "UnitClient"("unitId");

-- CreateIndex
CREATE INDEX "UnitClient_clientId_idx" ON "UnitClient"("clientId");

-- CreateIndex
CREATE INDEX "UnitClient_role_idx" ON "UnitClient"("role");

-- AddForeignKey
ALTER TABLE "UnitClient" ADD CONSTRAINT "UnitClient_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitClient" ADD CONSTRAINT "UnitClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill PRIMARY links for units that already have a client
INSERT INTO "UnitClient" ("id", "unitId", "clientId", "role", "position", "createdAt")
SELECT
    'uc' || replace(gen_random_uuid()::text, '-', ''),
    u."id",
    u."clientId",
    'PRIMARY'::"UnitClientRole",
    0,
    NOW()
FROM "Unit" u
WHERE u."clientId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "UnitClient" uc
    WHERE uc."unitId" = u."id" AND uc."clientId" = u."clientId"
  );
