-- Create admins table
CREATE TABLE IF NOT EXISTS "admins" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(255) NOT NULL UNIQUE,
  "name" varchar(255),
  "permissions" text NOT NULL DEFAULT '["all"]',
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create parties table
CREATE TABLE IF NOT EXISTS "parties" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "slug" varchar(255) NOT NULL UNIQUE,
  "logo_url" varchar(2048),
  "color" varchar(7),
  "color_light" varchar(7),
  "color_dark" varchar(7),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add party_id to politicians
ALTER TABLE "politicians" ADD COLUMN IF NOT EXISTS "party_id" uuid REFERENCES "parties"("id");

-- Migrate existing party data: create party records from unique party/partySlug combinations
-- and copy logo/colors from the first politician in each party
INSERT INTO "parties" ("name", "slug", "logo_url", "color", "color_light", "color_dark")
SELECT DISTINCT ON (p.party_slug) p.party, p.party_slug, p.party_logo_url, p.party_color, p.party_color_light, p.party_color_dark
FROM "politicians" p
ON CONFLICT ("slug") DO NOTHING;

-- Link existing politicians to their party
UPDATE "politicians" SET "party_id" = (
  SELECT "id" FROM "parties" WHERE "parties"."slug" = "politicians"."party_slug" LIMIT 1
) WHERE "party_id" IS NULL;

-- Drop old party columns from politicians
ALTER TABLE "politicians" DROP COLUMN IF EXISTS "party_logo_url";
ALTER TABLE "politicians" DROP COLUMN IF EXISTS "party_color";
ALTER TABLE "politicians" DROP COLUMN IF EXISTS "party_color_light";
ALTER TABLE "politicians" DROP COLUMN IF EXISTS "party_color_dark";

-- Seed admin user
INSERT INTO "admins" ("email", "name") VALUES ('th@firestarters.com', 'Tony Hanna')
ON CONFLICT ("email") DO NOTHING;
