ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "answer_duration" real;
ALTER TABLE "answer_history" ADD COLUMN IF NOT EXISTS "answer_duration" real;
