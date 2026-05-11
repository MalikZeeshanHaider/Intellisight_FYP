-- CreateTable
CREATE TABLE "AccessRequests" (
    "Request_ID" SERIAL NOT NULL,
    "Admin_ID" INTEGER NOT NULL,
    "Permission_Key" TEXT NOT NULL,
    "Message" TEXT,
    "Status" TEXT NOT NULL DEFAULT 'pending',
    "ReviewNote" TEXT,
    "RequestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ReviewedAt" TIMESTAMP(3),
    "ReviewedBy" INTEGER,

    CONSTRAINT "AccessRequests_pkey" PRIMARY KEY ("Request_ID")
);

-- AddForeignKey
ALTER TABLE "AccessRequests" ADD CONSTRAINT "AccessRequests_Admin_ID_fkey" FOREIGN KEY ("Admin_ID") REFERENCES "Admin"("Admin_ID") ON DELETE CASCADE ON UPDATE CASCADE;
