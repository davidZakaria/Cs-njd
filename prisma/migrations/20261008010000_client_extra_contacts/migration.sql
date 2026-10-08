-- Extra client phones and addresses (additive; legacy phone2/address2 preserved on Client)
CREATE TABLE "ClientPhone" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientPhone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientAddress" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientAddress_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientPhone_clientId_idx" ON "ClientPhone"("clientId");
CREATE INDEX "ClientPhone_phone_idx" ON "ClientPhone"("phone");
CREATE INDEX "ClientAddress_clientId_idx" ON "ClientAddress"("clientId");

ALTER TABLE "ClientPhone" ADD CONSTRAINT "ClientPhone_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientAddress" ADD CONSTRAINT "ClientAddress_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate legacy secondary phone/address into lists (skip empty / duplicate of primary)
INSERT INTO "ClientPhone" ("id", "clientId", "phone", "sortOrder", "createdAt")
SELECT
  'mig_phone_' || c."id",
  c."id",
  TRIM(c."phone2"),
  0,
  CURRENT_TIMESTAMP
FROM "Client" c
WHERE c."phone2" IS NOT NULL
  AND TRIM(c."phone2") <> ''
  AND TRIM(c."phone2") IS DISTINCT FROM COALESCE(TRIM(c."phone1"), '');

INSERT INTO "ClientAddress" ("id", "clientId", "address", "sortOrder", "createdAt")
SELECT
  'mig_addr_' || c."id",
  c."id",
  TRIM(c."address2"),
  0,
  CURRENT_TIMESTAMP
FROM "Client" c
WHERE c."address2" IS NOT NULL
  AND TRIM(c."address2") <> ''
  AND TRIM(c."address2") IS DISTINCT FROM COALESCE(TRIM(c."address1"), '');
