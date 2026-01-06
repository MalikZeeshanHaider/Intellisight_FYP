-- AlterTable
ALTER TABLE "Zone" ADD COLUMN     "Description" TEXT;

-- CreateTable
CREATE TABLE "PendingUsers" (
    "Pending_ID" SERIAL NOT NULL,
    "Name" TEXT NOT NULL,
    "Email" TEXT NOT NULL,
    "Password" TEXT NOT NULL,
    "VerificationToken" TEXT NOT NULL,
    "Status" TEXT NOT NULL DEFAULT 'PENDING',
    "RequestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ProcessedAt" TIMESTAMP(3),
    "ProcessedBy" INTEGER,
    "RejectionReason" TEXT,

    CONSTRAINT "PendingUsers_pkey" PRIMARY KEY ("Pending_ID")
);

-- CreateTable
CREATE TABLE "PasswordResets" (
    "Reset_ID" SERIAL NOT NULL,
    "Email" TEXT NOT NULL,
    "Token" TEXT NOT NULL,
    "ExpiresAt" TIMESTAMP(3) NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Used" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PasswordResets_pkey" PRIMARY KEY ("Reset_ID")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingUsers_Email_key" ON "PendingUsers"("Email");

-- CreateIndex
CREATE UNIQUE INDEX "PendingUsers_VerificationToken_key" ON "PendingUsers"("VerificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResets_Token_key" ON "PasswordResets"("Token");
