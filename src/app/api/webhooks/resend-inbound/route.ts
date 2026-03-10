import { Resend } from "resend";
import { Webhook } from "svix";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);
const FORWARD_TO = process.env.REPLY_TO_EMAIL || "hej@introkrati.dk";
const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

export async function POST(request: Request) {
  try {
    // Verify webhook signature
    if (!WEBHOOK_SECRET) {
      console.error("RESEND_WEBHOOK_SECRET is not set");
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const body = await request.text();
    const headers = {
      "svix-id": request.headers.get("svix-id") ?? "",
      "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
      "svix-signature": request.headers.get("svix-signature") ?? "",
    };

    const wh = new Webhook(WEBHOOK_SECRET);
    const payload = wh.verify(body, headers) as {
      type: string;
      data: { from: string; subject: string; text: string; html: string };
    };

    // Only handle inbound emails
    if (payload.type !== "email.received") {
      return NextResponse.json({ message: "Ignored" }, { status: 200 });
    }

    // Log full payload to debug field names
    console.log("Inbound email payload keys:", JSON.stringify(Object.keys(payload.data)));
    console.log("Inbound email payload:", JSON.stringify(payload.data).slice(0, 2000));

    const data = payload.data as Record<string, unknown>;
    const from = (data.from || data.sender || "") as string;
    const subject = (data.subject || "") as string;
    const html = (data.html || data.body || "") as string;
    const text = (data.text || data.plain_text || data.content || "") as string;

    // Forward the inbound email to admin
    await resend.emails.send({
      from: `Introkrati Indbakke <hej@introkrati.dk>`,
      to: FORWARD_TO,
      replyTo: from,
      subject: `[Indbakke] ${subject || "(intet emne)"}`,
      html: html || `<pre>${text || "(tom email)"}</pre>`,
    });

    return NextResponse.json({ message: "Forwarded" }, { status: 200 });
  } catch (error) {
    console.error("Inbound webhook error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 400 });
  }
}
