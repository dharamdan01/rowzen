-- AlterTable
ALTER TABLE "ValidationRun" ALTER COLUMN "validRows" DROP NOT NULL,
ALTER COLUMN "invalidRows" DROP NOT NULL;
