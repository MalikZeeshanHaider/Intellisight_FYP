-- Migration: add enrollment quality metadata columns to FaceEmbeddings
--
-- Run this once before using enrollment.py v2:
--
--   psql -U postgres -d FYP_Intellisight -f migration.sql
--
-- These columns are optional — enrollment.py v2 gracefully falls back to the
-- v1 INSERT if they are absent, but you will lose quality scoring and centroid
-- tracking until the migration is applied.

ALTER TABLE "FaceEmbeddings"
  ADD COLUMN IF NOT EXISTS "QualityScore"      FLOAT,
  ADD COLUMN IF NOT EXISTS "IsCentroid"        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "SourceImageIndex"  INT;

-- Optional index: speeds up fetching only non-centroid embeddings for a person
CREATE INDEX IF NOT EXISTS idx_faceembeddings_notcentroid
  ON "FaceEmbeddings" ("Student_ID", "Teacher_ID", "IsCentroid");

-- Backfill: mark existing rows as non-centroid (safe no-op; DEFAULT FALSE covers new rows)
UPDATE "FaceEmbeddings" SET "IsCentroid" = FALSE WHERE "IsCentroid" IS NULL;
