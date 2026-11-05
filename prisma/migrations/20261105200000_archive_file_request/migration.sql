-- Archive file request workflow (CS → Operations)
CREATE TYPE "ArchiveFileRequestPriority" AS ENUM ('NORMAL', 'URGENT');
CREATE TYPE "ArchiveFileKind" AS ENUM ('CONTRACT', 'NATIONAL_ID', 'ANNEX', 'RECEIPT', 'OTHER');
CREATE TYPE "ArchiveFileItemStatus" AS ENUM ('PENDING', 'FULFILLED_UPLOAD', 'NOT_FOUND');

ALTER TYPE "UnitRequestType" ADD VALUE 'ARCHIVE_FILE_REQUEST';

ALTER TABLE "UnitRequest" ADD COLUMN "archiveFilePriority" "ArchiveFileRequestPriority";

CREATE TABLE "ArchiveFileRequestItem" (
    "id" TEXT NOT NULL,
    "unitRequestId" TEXT NOT NULL,
    "fileKind" "ArchiveFileKind" NOT NULL,
    "status" "ArchiveFileItemStatus" NOT NULL DEFAULT 'PENDING',
    "notFoundNote" TEXT,
    "resultAttachmentId" TEXT,
    "fulfilledAt" TIMESTAMP(3),
    "fulfilledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchiveFileRequestItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OperationsArchiveFileRequestRead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "unitRequestId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationsArchiveFileRequestRead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ArchiveFileRequestItem_resultAttachmentId_key" ON "ArchiveFileRequestItem"("resultAttachmentId");
CREATE INDEX "ArchiveFileRequestItem_unitRequestId_idx" ON "ArchiveFileRequestItem"("unitRequestId");
CREATE UNIQUE INDEX "OperationsArchiveFileRequestRead_userId_unitRequestId_key" ON "OperationsArchiveFileRequestRead"("userId", "unitRequestId");
CREATE INDEX "OperationsArchiveFileRequestRead_userId_idx" ON "OperationsArchiveFileRequestRead"("userId");

ALTER TABLE "ArchiveFileRequestItem" ADD CONSTRAINT "ArchiveFileRequestItem_unitRequestId_fkey" FOREIGN KEY ("unitRequestId") REFERENCES "UnitRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArchiveFileRequestItem" ADD CONSTRAINT "ArchiveFileRequestItem_resultAttachmentId_fkey" FOREIGN KEY ("resultAttachmentId") REFERENCES "RequestAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ArchiveFileRequestItem" ADD CONSTRAINT "ArchiveFileRequestItem_fulfilledById_fkey" FOREIGN KEY ("fulfilledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OperationsArchiveFileRequestRead" ADD CONSTRAINT "OperationsArchiveFileRequestRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OperationsArchiveFileRequestRead" ADD CONSTRAINT "OperationsArchiveFileRequestRead_unitRequestId_fkey" FOREIGN KEY ("unitRequestId") REFERENCES "UnitRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "UnitRequest_type_status_archiveFilePriority_idx" ON "UnitRequest"("type", "status", "archiveFilePriority");
