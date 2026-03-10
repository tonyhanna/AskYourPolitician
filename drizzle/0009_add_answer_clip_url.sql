ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "answer_clip_url" varchar(2048);
ALTER TABLE "answer_history" ADD COLUMN IF NOT EXISTS "answer_clip_url" varchar(2048);
