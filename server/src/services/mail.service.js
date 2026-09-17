import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { BRAND_NAME } from '../config/brand.js';

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

/**
 * Text first, HTML second, and the text is written to be read.
 *
 * These go to people who did not ask for a newsletter, from a domain with no
 * sending reputation, through a mailbox that sends a dozen messages a week.
 * Plain sentences and one link get delivered; a table-based template with a
 * banner image is what a spam filter is looking for.
 *
 * `escape` exists because `name` and `reason` are typed by a stranger. Nothing
 * on a request is trusted — the HTML part is the one place their words are
 * interpolated into markup, and an unescaped `<img onerror>` in a name is a
 * stored payload aimed at whoever opens the notification.
 */
const escape = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const wrap = (body) =>
  `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#111">${body}</div>`;

const line = (label, value) =>
  value ? `<p style="margin:2px 0"><b>${escape(label)}:</b> ${escape(value)}</p>` : '';

/** Where a link in an email should point. Never a request header. */
const appUrl = (path = '') => `${env.clientUrl.replace(/\/+$/, '')}${path}`;

/** "We have it" — sent the moment a request is queued. */
export function mailRequestReceived(request) {
  return sendMail({
    to: request.email,
    subject: `${BRAND_NAME}: we got your request`,
    text: [
      `Hi ${request.name},`,
      '',
      `Your request for a ${BRAND_NAME} account is with the owner. You will get another email when it is reviewed — usually within a day.`,
      '',
      'Nothing to do until then. Your password is already set, so once you are approved you can sign in with it straight away.',
    ].join('\n'),
    html: wrap(
      `<p>Hi ${escape(request.name)},</p>
       <p>Your request for a ${escape(BRAND_NAME)} account is with the owner. You will get another email when it is reviewed — usually within a day.</p>
       <p>Nothing to do until then. Your password is already set, so once you are approved you can sign in with it straight away.</p>`,
    ),
  });
}

/** "Somebody wants in" — sent to the owner, with enough to decide on. */
export function mailAdminNewRequest(request) {
  const where = [request.context?.city, request.context?.country].filter(Boolean).join(', ');
  const device = [request.context?.device, request.context?.os, request.context?.browser]
    .filter(Boolean)
    .join(' · ');

  return sendMail({
    to: env.mail.adminTo,
    subject: `${BRAND_NAME}: access request from ${request.name}`,
    text: [
      `${request.name} <${request.email}> asked for an account.`,
      '',
      `Mobile: ${request.mobile}`,
      request.reason ? `Why: ${request.reason}` : '',
      where ? `Where: ${where}` : '',
      device ? `Device: ${device}` : '',
      request.context?.ip ? `IP: ${request.context.ip}` : '',
      '',
      `Approve or decline: ${appUrl('/admin/signups')}`,
    ]
      .filter(Boolean)
      .join('\n'),
    html: wrap(
      `<p><b>${escape(request.name)}</b> &lt;${escape(request.email)}&gt; asked for an account.</p>
       ${line('Mobile', request.mobile)}
       ${line('Why', request.reason)}
       ${line('Where', where)}
       ${line('Device', device)}
       ${line('IP', request.context?.ip)}
       <p style="margin-top:16px"><a href="${appUrl('/admin/signups')}">Approve or decline</a></p>`,
    ),
  });
}

/** "You're in." */
export function mailApproved(request) {
  return sendMail({
    to: request.email,
    subject: `${BRAND_NAME}: your account is ready`,
    text: [
      `Hi ${request.name},`,
      '',
      `You are approved. Sign in with this email and the password you chose: ${appUrl('/login')}`,
      '',
      'Start on the roadmap — the first section is already open.',
    ].join('\n'),
    html: wrap(
      `<p>Hi ${escape(request.name)},</p>
       <p>You are approved. Sign in with this email and the password you chose:</p>
       <p><a href="${appUrl('/login')}">${appUrl('/login')}</a></p>
       <p>Start on the roadmap — the first section is already open.</p>`,
    ),
  });
}

/**
 * "Not this time."
 *
 * Sent because the alternative is silence, and silence is answered by applying
 * again. The note is included only when the owner wrote one.
 */
export function mailRejected(request, note) {
  return sendMail({
    to: request.email,
    subject: `${BRAND_NAME}: about your request`,
    text: [
      `Hi ${request.name},`,
      '',
      `Your request for a ${BRAND_NAME} account was not approved.`,
      note ? `\n${note}` : '',
      '',
      'If you think that is a mistake, reply to this email.',
    ]
      .filter(Boolean)
      .join('\n'),
    html: wrap(
      `<p>Hi ${escape(request.name)},</p>
       <p>Your request for a ${escape(BRAND_NAME)} account was not approved.</p>
       ${note ? `<p>${escape(note)}</p>` : ''}
       <p>If you think that is a mistake, reply to this email.</p>`,
    ),
  });
}
