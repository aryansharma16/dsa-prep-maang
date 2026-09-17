import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import * as templates from './mail.templates.js';

/**
 * Outgoing mail: two backends, one `sendMail`, and the rule that it can never
 * break the request that asked for it.
 *
 * Every message this app sends is a *notification about* something that has
 * already happened — a request is in the queue, an account now exists. The
 * database write is the fact; the mail is a courtesy. So a dead SMTP host, a
 * revoked API key or a mailbox over quota must not turn an approval into a 500
 * after the account was created, which is why `sendMail` resolves `false`
 * instead of throwing and every caller ignores the result.
 *
 * Which backend runs is decided by which credential is present, not by a switch
 * that has to be kept in step with the credentials — see `env.mail`. SendGrid
 * wins when both are set, because a host that blocks outbound SMTP is exactly
 * the deployment that configured both.
 *
 * Unconfigured is a first-class state, not an error: with neither credential,
 * each message is logged instead, so a developer running this locally sees
 * exactly what would have gone out.
 */

/* -------------------------------------------------------------------------- */
/* backends                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * SendGrid's v3 API. Plain `fetch` rather than `@sendgrid/mail`.
 *
 * The official SDK is a wrapper around this one POST, and a dependency that can
 * send mail is a dependency with the API key in scope — not worth taking on for
 * a request body this small.
 *
 * A refusal here is worth reading, so the body is logged on a non-2xx. The two
 * that actually happen are settings problems in SendGrid that no amount of
 * staring at this code will explain, so they are translated into the fix rather
 * than logged as SendGrid's JSON — see `explainRefusal`.
 */
async function sendViaSendGrid({ to, subject, text, html }) {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.sendgrid.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: parseFrom(env.mail.from),
      subject,
      content: [
        // Order matters to the spec: the plain-text part must come first, and
        // clients show the last part they can render.
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html },
      ],
      /*
        Off, per message, whatever the account's defaults say — and SendGrid's
        defaults are on. Measured against a real inbox: with click tracking
        every link, plain-text part included, was rewritten through
        `…ct.sendgrid.net/ls/click`, and open tracking appended a pixel.

        For these messages that is not analytics, it is a leak. A reset link
        is a password-equivalent token, and click tracking routes it through a
        third party's redirect and logs; the "paste this into your browser"
        fallback would show a tracking URL instead of this site. Rewritten
        links and tracking pixels on mail from a new sender are also two of
        the signals spam filters weigh. Nothing here needs to know who opened
        what.
      */
      tracking_settings: {
        click_tracking: { enable: false, enable_text: false },
        open_tracking: { enable: false },
        subscription_tracking: { enable: false },
      },
    }),
    // A signup should not hang on a mail API having a bad afternoon.
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(explainRefusal(response.status, detail));
  }
  return true;
}

/**
 * SendGrid's refusal, as the thing to go and do about it.
 *
 * 403 "verified Sender Identity" is the one every new account hits first: the
 * From address has to be verified in SendGrid before anything sends, and the
 * raw message does not say where. 401 is a key that was revoked or mistyped —
 * the usual state of a deployment right after a key was rotated in SendGrid but
 * not in the environment. Anything else is passed through, trimmed.
 */
function explainRefusal(status, detail) {
  const from = parseFrom(env.mail.from).email;

  if (status === 403 && /verified Sender Identity/i.test(detail)) {
    return (
      `SendGrid 403: MAIL_FROM "${from}" is not a verified sender. ` +
      'Verify it at https://app.sendgrid.com/settings/sender_auth/senders — ' +
      'the next send works once it is, no restart needed.'
    );
  }
  if (status === 401) {
    return 'SendGrid 401: SENDGRID_API_KEY was rejected — revoked, mistyped, or rotated without updating .env.';
  }
  return `SendGrid ${status}: ${detail.slice(0, 300)}`;
}

/**
 * `"Ember <you@example.com>"` → `{ name, email }`, which is the only shape
 * SendGrid's `from` accepts. A bare address passes through unnamed.
 */
function parseFrom(value) {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(String(value || ''));
  return match ? { name: match[1].replace(/^"|"$/g, ''), email: match[2] } : { email: String(value || '').trim() };
}

let transport;

/** Every message "sent" under NODE_ENV=test. Always empty otherwise. */
export const outbox = [];

/** Built once, lazily — `createTransport` opens no socket, `sendMail` does. */
function getTransport() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
      // A signup should not hang on a mail server that has stopped answering.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return transport;
}

/**
 * Sends one message. Resolves true if it left this process, false otherwise.
 *
 * Never rejects. A caller that awaited this and had to handle a failure would
 * be deciding what to do about a courtesy, and the only honest answer — carry
 * on — is what happens here instead.
 */
export async function sendMail({ to, subject, text, html }) {
  if (!to) return false;

  /*
    Tests never send, whatever credentials happen to be in the environment, and
    the end-to-end suite reads this to follow a reset link the way a person
    would. Only under NODE_ENV=test: a reset link in a list in memory anywhere
    else is a token somebody can find.
  */
  if (env.nodeEnv === 'test') {
    outbox.push({ to, subject, text, html });
    return true;
  }

  if (!env.sendgrid.configured && !env.smtp.configured) {
    console.log(`[mail] not configured — would have sent "${subject}" to ${to}`);
    return false;
  }

  try {
    if (env.sendgrid.configured) await sendViaSendGrid({ to, subject, text, html });
    else await getTransport().sendMail({ from: env.mail.from, to, subject, text, html });
    return true;
  } catch (error) {
    // Logged, not thrown: see the note at the top of this file.
    console.error(`[mail] failed to send "${subject}" to ${to}:`, error.message);
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* the messages                                                               */
/* -------------------------------------------------------------------------- */

/*
  What each one says and looks like lives in mail.templates.js. These only
  decide who it goes to, so a template can be rendered and looked at without
  anything being sent.
*/

/** To the applicant, the moment their request is queued. */
export const mailRequestReceived = (request) =>
  sendMail({ to: request.email, ...templates.requestReceived(request) });

/** To the owner: somebody wants in. */
export const mailAdminNewRequest = (request) =>
  sendMail({ to: env.mail.adminTo, ...templates.adminNewRequest(request) });

/** To the applicant: approved. */
export const mailApproved = (request) =>
  sendMail({ to: request.email, ...templates.approved(request) });

/**
 * To the applicant: declined.
 *
 * Sent because the alternative is silence, and silence is answered by applying
 * again. The note is included only when the owner wrote one.
 */
export const mailRejected = (request, note) =>
  sendMail({ to: request.email, ...templates.rejected(request, note) });

/**
 * A reset link. The token is only ever in this email and in the user's address
 * bar — the database holds its hash.
 */
export const mailPasswordReset = (user, token, minutes) =>
  sendMail({
    to: user.email,
    ...templates.passwordReset(
      user,
      templates.appUrl(`/reset-password?token=${encodeURIComponent(token)}`),
      minutes,
    ),
  });

/** The receipt after a reset, sent to the account's own address either way. */
export const mailPasswordChanged = (user) =>
  sendMail({ to: user.email, ...templates.passwordChanged(user) });
