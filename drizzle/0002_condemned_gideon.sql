ALTER TABLE "verification_tokens" DROP CONSTRAINT "verification_tokens_question_id_questions_id_fk";
--> statement-breakpoint
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;