-- CreateIndex
CREATE INDEX "Ticket_status_agentId_idx" ON "Ticket"("status", "agentId");

-- CreateIndex
CREATE INDEX "Ticket_status_updatedAt_idx" ON "Ticket"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Unit_projectId_idx" ON "Unit"("projectId");

-- CreateIndex
CREATE INDEX "Unit_unitCode_idx" ON "Unit"("unitCode");

-- CreateIndex
CREATE INDEX "Unit_clientId_idx" ON "Unit"("clientId");
