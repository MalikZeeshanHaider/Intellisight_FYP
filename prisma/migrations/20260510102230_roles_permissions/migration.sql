-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "Role_ID" INTEGER;

-- CreateTable
CREATE TABLE "Role" (
    "Role_ID" SERIAL NOT NULL,
    "Name" TEXT NOT NULL,
    "Description" TEXT,
    "IsSystem" BOOLEAN NOT NULL DEFAULT false,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("Role_ID")
);

-- CreateTable
CREATE TABLE "Permission" (
    "Permission_ID" SERIAL NOT NULL,
    "Name" TEXT NOT NULL,
    "Key" TEXT NOT NULL,
    "Category" TEXT NOT NULL,
    "Description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("Permission_ID")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "RolePermission_ID" SERIAL NOT NULL,
    "Role_ID" INTEGER NOT NULL,
    "Permission_ID" INTEGER NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("RolePermission_ID")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_Name_key" ON "Role"("Name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_Name_key" ON "Permission"("Name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_Key_key" ON "Permission"("Key");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_Role_ID_Permission_ID_key" ON "RolePermission"("Role_ID", "Permission_ID");

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_Role_ID_fkey" FOREIGN KEY ("Role_ID") REFERENCES "Role"("Role_ID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_Role_ID_fkey" FOREIGN KEY ("Role_ID") REFERENCES "Role"("Role_ID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_Permission_ID_fkey" FOREIGN KEY ("Permission_ID") REFERENCES "Permission"("Permission_ID") ON DELETE CASCADE ON UPDATE CASCADE;
