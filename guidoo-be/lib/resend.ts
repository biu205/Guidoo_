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

// Demo-only escape hatch: seeded teacher emails (e.g. *@example.tw) will
// always 403 against the unverified `onboarding@resend.dev` sender, since
// Resend can only deliver to the account's own signup address without a
// verified domain. Set DEMO_EMAIL_OVERRIDE in .env.local to redirect every
// outgoing notification to one real inbox (e.g. your Resend signup email)
// without touching seeded user data or login emails. Leave unset in
// production once a real domain is verified.
const DEMO_EMAIL_OVERRIDE = process.env.DEMO_EMAIL_OVERRIDE;

export async function notifyByEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const actualTo = DEMO_EMAIL_OVERRIDE || opts.to;
  const html = DEMO_EMAIL_OVERRIDE
    ? `<p><em>(demo override — originally addressed to ${opts.to})</em></p>${opts.html}`
    : opts.html;

  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: actualTo,
    subject: opts.subject,
    html,
  });
  if (error) {
    // Don't let a failed notification email break the parent-facing request —
    // the escalation row is already saved; log loudly so it's not silently lost.
    console.error("notifyByEmail failed:", error);
  } else {
    // Success is otherwise silent — log it so "no error" during testing can
    // be told apart from "notifyByEmail was never called at all" (e.g. no
    // teachers matched, or the LLM didn't escalate).
    console.log(
      `notifyByEmail sent: id=${data?.id} to=${actualTo}` +
        (DEMO_EMAIL_OVERRIDE ? ` (overridden from ${opts.to})` : "") +
        ` subject="${opts.subject}"`
    );
  }
}
