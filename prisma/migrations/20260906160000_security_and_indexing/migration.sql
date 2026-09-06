-- Spotlight search indexes Client.phone2; other spec indexes (Unit, Ticket, User.email) already exist.
CREATE INDEX "Client_phone2_idx" ON "Client"("phone2");
