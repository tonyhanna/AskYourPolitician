ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "answer_aspect_ratio" real;
ALTER TABLE "answer_history" ADD COLUMN IF NOT EXISTS "answer_aspect_ratio" real;
