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
    from: "Ask Your Politician <noreply@introkrati.dk>",
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
    from: "Ask Your Politician <noreply@introkrati.dk>",
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
    from: "Ask Your Politician <noreply@introkrati.dk>",
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

export async function sendSuggestionVerificationEmail({
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
  const { error } = await resend.emails.send({
    from: "Ask Your Politician <noreply@introkrati.dk>",
    to,
    subject: "Bekræft dit forslag til et spørgsmål",
    html: `
      <h2>Hej ${firstName},</h2>
      <p>Du har foreslået spørgsmålet:</p>
      <blockquote style="border-left:4px solid #2563eb;padding-left:16px;color:#374151;">"${questionText}"</blockquote>
      <p>Klik herunder for at bekræfte dit forslag:</p>
      <a href="${verificationUrl}"
         style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:600;">
        Bekræft forslag
      </a>
      <p style="margin-top:16px;color:#666;font-size:14px;">
        Linket udløber om 24 timer.
      </p>
    `,
  });

  if (error) {
    console.error("Resend error (suggestion verification):", error);
    throw new Error(`Kunne ikke sende email: ${error.message}`);
  }
}

export async function sendSuggestionReceivedEmail({
  to,
  firstName,
  politicianName,
  questionText,
}: {
  to: string;
  firstName: string;
  politicianName: string;
  questionText: string;
}) {
  const { error } = await resend.emails.send({
    from: "Ask Your Politician <noreply@introkrati.dk>",
    to,
    subject: "Tak for dit forslag!",
    html: `
      <h2>Hej ${firstName},</h2>
      <p>Tak fordi du foreslog et spørgsmål til ${politicianName}:</p>
      <blockquote style="border-left:4px solid #2563eb;padding-left:16px;color:#374151;">"${questionText}"</blockquote>
      <p>${politicianName} har modtaget dit forslag og vil tage stilling til det.</p>
    `,
  });

  if (error) {
    console.error("Resend error (suggestion received):", error);
  }
}

export async function sendSuggestionApprovedEmail({
  to,
  firstName,
  politicianName,
  questionText,
  questionUrl,
}: {
  to: string;
  firstName: string;
  politicianName: string;
  questionText: string;
  questionUrl: string;
}) {
  const { error } = await resend.emails.send({
    from: "Ask Your Politician <noreply@introkrati.dk>",
    to,
    subject: "Dit forslag er blevet godkendt!",
    html: `
      <h2>Hej ${firstName},</h2>
      <p>${politicianName} har godkendt dit forslag til et spørgsmål:</p>
      <blockquote style="border-left:4px solid #2563eb;padding-left:16px;color:#374151;">"${questionText}"</blockquote>
      <p>Dit spørgsmål er nu live! Del det med dine venner for at samle upvotes:</p>
      <a href="${questionUrl}"
         style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:600;">
        Se dit spørgsmål
      </a>
    `,
  });

  if (error) {
    console.error("Resend error (suggestion approved):", error);
  }
}

export async function sendSuggestionRejectedEmail({
  to,
  firstName,
  politicianName,
  questionText,
  reason,
  link,
}: {
  to: string;
  firstName: string;
  politicianName: string;
  questionText: string;
  reason: string;
  link?: string;
}) {
  const linkHtml = link
    ? `<p>Se det relevante spørgsmål her:</p>
       <a href="${link}"
          style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:600;">
         Se spørgsmål
       </a>`
    : "";

  const { error } = await resend.emails.send({
    from: "Ask Your Politician <noreply@introkrati.dk>",
    to,
    subject: "Opdatering om dit forslag",
    html: `
      <h2>Hej ${firstName},</h2>
      <p>Desværre har ${politicianName} valgt ikke at godkende dit forslag:</p>
      <blockquote style="border-left:4px solid #2563eb;padding-left:16px;color:#374151;">"${questionText}"</blockquote>
      <p><strong>Begrundelse:</strong> ${reason}</p>
      ${linkHtml}
      <p style="margin-top:16px;">Du er altid velkommen til at foreslå et nyt spørgsmål.</p>
    `,
  });

  if (error) {
    console.error("Resend error (suggestion rejected):", error);
  }
}

export async function sendNewSuggestionNotificationEmail({
  to,
  politicianName,
  citizenName,
  questionText,
  dashboardUrl,
}: {
  to: string;
  politicianName: string;
  citizenName: string;
  questionText: string;
  dashboardUrl: string;
}) {
  const { error } = await resend.emails.send({
    from: "Ask Your Politician <noreply@introkrati.dk>",
    to,
    subject: `Nyt forslag fra ${citizenName}`,
    html: `
      <h2>Hej ${politicianName},</h2>
      <p>${citizenName} har foreslået et spørgsmål:</p>
      <blockquote style="border-left:4px solid #2563eb;padding-left:16px;color:#374151;">"${questionText}"</blockquote>
      <p>Gå til dit dashboard for at godkende eller afvise forslaget:</p>
      <a href="${dashboardUrl}"
         style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:600;">
        Se forslag
      </a>
    `,
  });

  if (error) {
    console.error("Resend error (new suggestion notification):", error);
  }
}

export async function sendAnswerNotificationEmail({
  to,
  firstName,
  politicianName,
  partyName,
  questionText,
  answerUrl,
  isUpdate = false,
}: {
  to: string;
  firstName: string;
  politicianName: string;
  partyName: string;
  questionText: string;
  answerUrl: string;
  isUpdate?: boolean;
}) {
  const { error } = await resend.emails.send({
    from: "Ask Your Politician <noreply@introkrati.dk>",
    to,
    subject: isUpdate
      ? `${politicianName} fra ${partyName} har opdateret sit svar på dit spørgsmål!`
      : `${politicianName} fra ${partyName} har svaret på dit spørgsmål!`,
    html: `
      <h2>Hej ${firstName},</h2>
      <p>${politicianName} fra ${partyName} har ${isUpdate ? "opdateret sit svar på" : "svaret på"} spørgsmålet:</p>
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
