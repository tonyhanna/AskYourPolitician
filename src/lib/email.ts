import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "hej@introkrati.dk";
const REPLY_TO = process.env.REPLY_TO_EMAIL || "hej@introkrati.dk";

const EMAIL_FOOTER = `
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px;" />
  <p style="color:#9ca3af;font-size:13px;line-height:1.5;">
    Introkrati er stadig under tidlig udvikling. Svar gerne denne email, hvis du har feedback, oplever fejl eller andet. Det vil være værdsat.
  </p>
`;

// ── Emails TO citizens (system / verification) ──

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
    from: `Introkrati <${FROM_EMAIL}>`,
    replyTo: REPLY_TO,
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
      ${EMAIL_FOOTER}
    `,
  });

  if (error) {
    console.error("Resend error:", error);
    throw new Error(`Kunne ikke sende email: ${error.message}`);
  }

  console.log("Email sent successfully:", data?.id);
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
    from: `Introkrati <${FROM_EMAIL}>`,
    replyTo: REPLY_TO,
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
      ${EMAIL_FOOTER}
    `,
  });

  if (error) {
    console.error("Resend error (suggestion verification):", error);
    throw new Error(`Kunne ikke sende email: ${error.message}`);
  }
}

// ── Emails TO politicians (from citizens) ──

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
    from: `Introkrati <${FROM_EMAIL}>`,
    replyTo: REPLY_TO,
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
      ${EMAIL_FOOTER}
    `,
  });

  if (error) {
    console.error("Resend error (goal reached):", error);
    throw new Error(`Kunne ikke sende email: ${error.message}`);
  }

  console.log("Goal reached email sent:", data?.id);
}

export async function sendDailyMissedSummaryEmail({
  to,
  politicianName,
  questions,
  dashboardUrl,
}: {
  to: string;
  politicianName: string;
  questions: { text: string; upvoteCount: number }[];
  dashboardUrl: string;
}) {
  const count = questions.length;
  const questionsHtml = questions
    .map(
      (q) =>
        `<blockquote style="border-left:4px solid #ef4444;padding-left:16px;color:#374151;margin-bottom:12px;">"${q.text}" <span style="color:#9ca3af;">(${q.upvoteCount} ${q.upvoteCount === 1 ? "upvote" : "upvotes"})</span></blockquote>`
    )
    .join("");

  const { error } = await resend.emails.send({
    from: `Introkrati <${FROM_EMAIL}>`,
    replyTo: REPLY_TO,
    to,
    subject: `${count} ${count === 1 ? "spørgsmål" : "spørgsmål"} venter stadig på dit svar`,
    html: `
      <h2>Hej ${politicianName},</h2>
      <p>Du har ${count} ${count === 1 ? "spørgsmål" : "spørgsmål"} hvor fristen er overskredet, og borgerne stadig venter på svar:</p>
      ${questionsHtml}
      <p>Det er aldrig for sent at svare — borgerne bliver notificeret, så snart du gør.</p>
      <a href="${dashboardUrl}"
         style="background:#ef4444;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:600;">
        Gå til dashboard og svar
      </a>
      ${EMAIL_FOOTER}
    `,
  });

  if (error) {
    console.error("Resend error (daily missed summary):", error);
    throw new Error(`Kunne ikke sende daglig opsummering: ${error.message}`);
  }
}

export async function sendDeadlineMissedEmail({
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
    from: `Introkrati <${FROM_EMAIL}>`,
    replyTo: REPLY_TO,
    to,
    subject: `${politicianName} nåede desværre ikke at svare i tide`,
    html: `
      <h2>Hej ${firstName},</h2>
      <p>${politicianName} fra ${partyName} nåede desværre ikke at besvare dette spørgsmål inden for fristen:</p>
      <blockquote style="border-left:4px solid #ef4444;padding-left:16px;color:#374151;">"${questionText}"</blockquote>
      <p>Der er dog stadig håb for en besvarelse — politikeren kan stadig vælge at svare på et senere tidspunkt, og du vil blive notificeret, hvis det sker.</p>
      ${EMAIL_FOOTER}
    `,
  });

  if (error) {
    console.error("Resend error (deadline missed):", error);
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
    from: `${citizenName} på Introkrati <${FROM_EMAIL}>`,
    replyTo: REPLY_TO,
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
      ${EMAIL_FOOTER}
    `,
  });

  if (error) {
    console.error("Resend error (new suggestion notification):", error);
  }
}

// ── Emails TO citizens (from politician) ──

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
    from: `${politicianName} fra ${partyName} <${FROM_EMAIL}>`,
    replyTo: REPLY_TO,
    to,
    subject: `Dit spørgsmål har nået sit mål!`,
    html: `
      <h2>Hej ${firstName},</h2>
      <p>Spørgsmålet du upvotede har nået sit mål:</p>
      <blockquote style="border-left:4px solid #2563eb;padding-left:16px;color:#374151;">"${questionText}"</blockquote>
      <p>${politicianName} fra ${partyName} svarer inden for 24 timer.</p>
      ${EMAIL_FOOTER}
    `,
  });

  if (error) {
    console.error("Resend error (goal reached citizen):", error);
  }
}

export async function sendSuggestionReceivedEmail({
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
    from: `${politicianName} fra ${partyName} <${FROM_EMAIL}>`,
    replyTo: REPLY_TO,
    to,
    subject: "Tak for dit forslag!",
    html: `
      <h2>Hej ${firstName},</h2>
      <p>Tak fordi du foreslog et spørgsmål til ${politicianName}:</p>
      <blockquote style="border-left:4px solid #2563eb;padding-left:16px;color:#374151;">"${questionText}"</blockquote>
      <p>${politicianName} har modtaget dit forslag og vil tage stilling til det.</p>
      ${EMAIL_FOOTER}
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
  partyName,
  questionText,
  questionUrl,
  originalText,
  editReason,
}: {
  to: string;
  firstName: string;
  politicianName: string;
  partyName: string;
  questionText: string;
  questionUrl: string;
  originalText?: string;
  editReason?: string;
}) {
  const wasEdited = originalText && editReason;

  const editSection = wasEdited
    ? `
      <p style="color:#6b7280;font-size:14px;margin-top:16px;">Dit oprindelige forslag var:</p>
      <blockquote style="border-left:4px solid #d1d5db;padding-left:16px;color:#9ca3af;font-style:italic;">"${originalText}"</blockquote>
      <p style="color:#6b7280;font-size:14px;">${politicianName} har tilpasset spørgsmålet med følgende begrundelse:</p>
      <p style="color:#374151;font-size:14px;font-style:italic;">"${editReason}"</p>
    `
    : "";

  const { error } = await resend.emails.send({
    from: `${politicianName} fra ${partyName} <${FROM_EMAIL}>`,
    replyTo: REPLY_TO,
    to,
    subject: "Dit forslag er blevet godkendt!",
    html: `
      <h2>Hej ${firstName},</h2>
      <p>${politicianName} har godkendt dit forslag til et spørgsmål:</p>
      <blockquote style="border-left:4px solid #2563eb;padding-left:16px;color:#374151;">"${questionText}"</blockquote>
      ${editSection}
      <p>Dit spørgsmål er nu live! Del det med dine venner for at samle upvotes:</p>
      <a href="${questionUrl}"
         style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:600;">
        Se dit spørgsmål
      </a>
      ${EMAIL_FOOTER}
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
  partyName,
  questionText,
  reason,
  link,
}: {
  to: string;
  firstName: string;
  politicianName: string;
  partyName: string;
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
    from: `${politicianName} fra ${partyName} <${FROM_EMAIL}>`,
    replyTo: REPLY_TO,
    to,
    subject: "Opdatering om dit forslag",
    html: `
      <h2>Hej ${firstName},</h2>
      <p>Desværre har ${politicianName} valgt ikke at godkende dit forslag:</p>
      <blockquote style="border-left:4px solid #2563eb;padding-left:16px;color:#374151;">"${questionText}"</blockquote>
      <p><strong>Begrundelse:</strong> ${reason}</p>
      ${linkHtml}
      <p style="margin-top:16px;">Du er altid velkommen til at foreslå et nyt spørgsmål.</p>
      ${EMAIL_FOOTER}
    `,
  });

  if (error) {
    console.error("Resend error (suggestion rejected):", error);
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
    from: `${politicianName} fra ${partyName} <${FROM_EMAIL}>`,
    replyTo: REPLY_TO,
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
      ${EMAIL_FOOTER}
    `,
  });

  if (error) {
    console.error("Resend error (answer notification):", error);
  }
}
