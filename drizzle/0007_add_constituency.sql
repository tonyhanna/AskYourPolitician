-- Add constituency (kreds) field to politicians
ALTER TABLE "politicians" ADD COLUMN IF NOT EXISTS "constituency" varchar(255);
