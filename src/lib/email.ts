import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail({
  to,
  firstName,
  questionText,
  verificationUrl,
}: {
  to: string;
  firstName: string;
  questionText: string;
  verificationUrl: string;
}) {
  const { data, error } = await resend.emails.send({
    from: "Ask Your Politician <onboarding@resend.dev>",
    to,
    subject: "Bekræft din upvote",
    html: `
      <h2>Hej ${firstName},</h2>
      <p>Du har upvotet spørgsmålet:</p>
      <blockquote style="border-left:4px solid #2563eb;padding-left:16px;color:#374151;">"${questionText}"</blockquote>
      <p>Klik herunder for at bekræfte din upvote:</p>
      <a href="${verificationUrl}"
         style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:600;">
        Bekræft upvote
      </a>
      <p style="margin-top:16px;color:#666;font-size:14px;">
        Linket udløber om 24 timer.
      </p>
    `,
  });

  if (error) {
    console.error("Resend error:", error);
    throw new Error(`Kunne ikke sende email: ${error.message}`);
  }

  console.log("Email sent successfully:", data?.id);
}

export async function sendGoalReachedEmail({
  to,
  politicianName,
  questionText,
  upvoteCount,
  dashboardUrl,
}: {
  to: string;
  politicianName: string;
  questionText: string;
  upvoteCount: number;
  dashboardUrl: string;
}) {
  const { data, error } = await resend.emails.send({
    from: "Ask Your Politician <onboarding@resend.dev>",
    to,
    subject: `${upvoteCount} ${upvoteCount === 1 ? "borger" : "borgere"} vil have svar på dit spørgsmål!`,
    html: `
      <h2>Hej ${politicianName},</h2>
      <p>Dit spørgsmål har nået sit mål med ${upvoteCount} ${upvoteCount === 1 ? "upvote" : "upvotes"}:</p>
      <blockquote style="border-left:4px solid #2563eb;padding-left:16px;color:#374151;">"${questionText}"</blockquote>
      <p>Borgerne vil gerne have et svar inden for 24 timer.</p>
      <a href="${dashboardUrl}"
         style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:600;">
        Gå til dashboard
      </a>
    `,
  });

  if (error) {
    console.error("Resend error (goal reached):", error);
    throw new Error(`Kunne ikke sende email: ${error.message}`);
  }

  console.log("Goal reached email sent:", data?.id);
}

export async function sendGoalReachedCitizenEmail({
  to,
  firstName,
  politicianName,
  partyName,
  questionText,
}: {
  to: string;
  firstName: string;
  politicianName: string;
  partyName: string;
  questionText: string;
}) {
  const { error } = await resend.emails.send({
    from: "Ask Your Politician <onboarding@resend.dev>",
    to,
    subject: `Dit spørgsmål har nået sit mål!`,
    html: `
      <h2>Hej ${firstName},</h2>
      <p>Spørgsmålet du upvotede har nået sit mål:</p>
      <blockquote style="border-left:4px solid #2563eb;padding-left:16px;color:#374151;">"${questionText}"</blockquote>
      <p>${politicianName} fra ${partyName} svarer inden for 24 timer.</p>
    `,
  });

  if (error) {
    console.error("Resend error (goal reached citizen):", error);
  }
}

export async function sendAnswerNotificationEmail({
  to,
  firstName,
  politicianName,
  partyName,
  questionText,
  answerUrl,
}: {
  to: string;
  firstName: string;
  politicianName: string;
  partyName: string;
  questionText: string;
  answerUrl: string;
}) {
  const { error } = await resend.emails.send({
    from: "Ask Your Politician <onboarding@resend.dev>",
    to,
    subject: `${politicianName} fra ${partyName} har svaret på dit spørgsmål!`,
    html: `
      <h2>Hej ${firstName},</h2>
      <p>${politicianName} fra ${partyName} har svaret på spørgsmålet:</p>
      <blockquote style="border-left:4px solid #2563eb;padding-left:16px;color:#374151;">"${questionText}"</blockquote>
      <p>Se svaret her:</p>
      <a href="${answerUrl}"
         style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:600;">
        Se svar
      </a>
    `,
  });

  if (error) {
    console.error("Resend error (answer notification):", error);
  }
}
