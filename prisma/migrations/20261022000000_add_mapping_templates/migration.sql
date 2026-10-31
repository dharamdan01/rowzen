-- Mapping templates contain schema configuration only, not uploaded CSV rows.
CREATE TABLE "MappingTemplate" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "configuration" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MappingTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MappingTemplate_projectId_name_key" ON "MappingTemplate"("projectId", "name");
CREATE INDEX "MappingTemplate_projectId_idx" ON "MappingTemplate"("projectId");
ALTER TABLE "MappingTemplate" ADD CONSTRAINT "MappingTemplate_projectId_fkey"
 FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
