import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  throw new Error("RESEND_API_KEY is not set — check .env.local.");
}

const resend = new Resend(apiKey);

// Without a verified domain, Resend only lets `onboarding@resend.dev` send to
// the address you signed up with — see SETUP.md §6. Swap FROM_ADDRESS once
// you verify a real domain.
const FROM_ADDRESS = "Guidoo <onboarding@resend.dev>";

export async function notifyByEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
  if (error) {
    // Don't let a failed notification email break the parent-facing request —
    // the escalation row is already saved; log loudly so it's not silently lost.
    console.error("notifyByEmail failed:", error);
  }
}
