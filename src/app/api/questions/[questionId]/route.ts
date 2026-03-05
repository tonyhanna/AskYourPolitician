import { db } from "@/db";
import { questions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const { questionId } = await params;

  const [question] = await db
    .select({ text: questions.text })
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);

  if (!question) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ text: question.text });
}
