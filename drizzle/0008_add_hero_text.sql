-- Add hero welcome text fields to politicians
ALTER TABLE "politicians" ADD COLUMN IF NOT EXISTS "hero_line_1" varchar(255);
ALTER TABLE "politicians" ADD COLUMN IF NOT EXISTS "hero_line_1_color" varchar(7);
ALTER TABLE "politicians" ADD COLUMN IF NOT EXISTS "hero_line_2" varchar(255);
ALTER TABLE "politicians" ADD COLUMN IF NOT EXISTS "hero_line_2_color" varchar(7);
