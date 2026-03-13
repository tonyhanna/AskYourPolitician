ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "goal_reached_at" timestamp;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "reminder_email_sent" boolean NOT NULL DEFAULT false;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "deadline_missed" boolean NOT NULL DEFAULT false;
