import { env } from '../config/env.js';
import { BRAND_NAME } from '../config/brand.js';

/**
 * Every email this app sends, as `{ subject, text, html }` — pure functions, no
 * sending, so they can be rendered to a file and looked at.
 *
 * Drawn in the app's own dark theme — the same `--bg`, surface, text ramp and
 * amber accent the product uses (client/src/styles/tokens.css,
 * client/src/theme/accents.js) — so a message reads as Ember rather than as a
 * notification from a mail vendor. The colours are copied in as hex: email
 * clients support neither custom properties nor stylesheets reliably, so every
 * rule here is inline and every table is `role="presentation"`.
 *
 * What is deliberately absent, because it is what gets mail from a new sender
 * filed as spam: images, web fonts, tracking pixels, and more than one call to
 * action per message. The brand mark is a table cell with two letters in it.
 *
 * Every message also has a plain-text part written to be read on its own. It is
 * what a screen reader, a watch or a text-only client shows, and a missing one
 * is itself a spam signal.
 *
 * `escape` runs over everything a person typed. A name or a reason comes from a
 * stranger's form, and the owner's notification is exactly where a stored
 * `<img onerror>` would be aimed.
 */

/* -------------------------------------------------------------------------- */
/* theme                                                                       */
/* -------------------------------------------------------------------------- */

const C = {
  bg: '#0e1013', // --bg
  card: '#16181c', // --surface over --bg, flattened
  inset: '#1c1f24', // --surface-2 over the card
  line: '#262a30', // --border, flattened
  text: '#eef1f6', // --text
  text2: '#aab3c0', // --text-2
  text3: '#79828f', // --text-3
  accent: '#ffa116', // amber, dark theme
  onAccent: '#1a1a1a', // --accent-text
};

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";

/* -------------------------------------------------------------------------- */
/* pieces                                                                      */
/* -------------------------------------------------------------------------- */

export const escape = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Where a link in an email points: `APP_URL`, never a request header (a Host
 * header is the attacker's to choose, and a reset link built from it is a way to
 * mail somebody a token for a site that is not this one).
 */
export const appUrl = (path = '') => `${env.appUrl}${path}`;

const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';

/** A stranger's name in a subject line: one line, whatever they typed. */
const oneLine = (value) => String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim();

/** A plain-text body, where `null` is a line that does not apply and `''` is a blank one. */
const lines = (parts) => parts.filter((part) => part !== null).join('\n');

const p = (html, { muted = false, small = false } = {}) =>
  `<p style="margin:0 0 14px;font-family:${SANS};font-size:${small ? 13 : 15}px;line-height:1.6;color:${muted ? C.text3 : C.text2};">${html}</p>`;

const strong = (text) => `<strong style="color:${C.text};font-weight:600;">${escape(text)}</strong>`;

const link = (href, label) =>
  `<a href="${escape(href)}" style="color:${C.accent};text-decoration:none;font-weight:600;">${escape(label)}</a>`;

/**
 * The one call to action. A table cell carries the colour, because Outlook
 * ignores padding and background on a bare `<a>`, and the link fills the cell
 * so the whole button is clickable everywhere else.
 */
const button = (href, label) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px;">
    <tr>
      <td bgcolor="${C.accent}" style="border-radius:8px;background:${C.accent};">
        <a href="${escape(href)}" target="_blank" style="display:inline-block;padding:13px 24px;font-family:${SANS};font-size:15px;font-weight:600;line-height:1;color:${C.onAccent};text-decoration:none;border-radius:8px;">${escape(label)}</a>
      </td>
    </tr>
  </table>`;

/** For clients that strip the button, and for anyone who would rather see where it goes. */
const fallback = (href) =>
  p(
    `Button not working? Paste this into your browser:<br><a href="${escape(href)}" style="color:${C.text2};text-decoration:underline;word-break:break-all;font-family:${MONO};font-size:12px;">${escape(href)}</a>`,
    { muted: true, small: true },
  );

const divider = () =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;"><tr><td style="border-top:1px solid ${C.line};font-size:0;line-height:0;">&nbsp;</td></tr></table>`;

/** Label/value rows in an inset box — the owner's summary of a request. */
const details = (rows) => {
  const shown = rows.filter(([, value]) => value);
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.inset}" style="margin:6px 0 4px;background:${C.inset};border:1px solid ${C.line};border-radius:10px;">
    ${shown
      .map(
        ([label, value], i) => `
    <tr>
      <td valign="top" style="width:92px;padding:11px 0 11px 16px;${i ? `border-top:1px solid ${C.line};` : ''}font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.text3};">${escape(label)}</td>
      <td valign="top" style="padding:10px 16px 10px 8px;${i ? `border-top:1px solid ${C.line};` : ''}font-family:${SANS};font-size:14px;line-height:1.5;color:${C.text};word-break:break-word;">${value}</td>
    </tr>`,
      )
      .join('')}
  </table>`;
};

/** A sentence somebody wrote, set apart from the template around it. */
const quote = (text) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 18px;">
    <tr>
      <td bgcolor="${C.inset}" style="background:${C.inset};border-left:3px solid ${C.accent};border-radius:6px;padding:12px 16px;font-family:${SANS};font-size:14px;line-height:1.6;color:${C.text};">${escape(text).replace(/\n/g, '<br>')}</td>
    </tr>
  </table>`;

/**
 * The page every message sits on: brand mark, one card, a footer that says why
 * this arrived.
 *
 * `preheader` is the grey line an inbox shows after the subject. Left out, the
 * client fills it with the first words it finds — the brand name, twice. The
 * run of zero-width characters after it stops the body leaking into that slot.
 */
function layout({ subject, preheader, kicker, heading, body, footer }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escape(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};" bgcolor="${C.bg}">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${escape(preheader)}${'&#8199;&#847;'.repeat(60)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background:${C.bg};">
  <tr>
    <td align="center" style="padding:40px 16px 48px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
          <td style="padding:0 2px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="28" height="28" align="center" valign="middle" bgcolor="${C.accent}" style="width:28px;height:28px;border-radius:6px;background:${C.accent};font-family:${MONO};font-size:12px;font-weight:700;color:${C.onAccent};">EM</td>
                <td style="padding-left:10px;font-family:${SANS};font-size:17px;font-weight:600;letter-spacing:-0.02em;color:${C.text};">${escape(BRAND_NAME)}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.line};border-top:3px solid ${C.accent};border-radius:12px;padding:32px 32px 26px;">
            <p style="margin:0 0 10px;font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${C.accent};">${escape(kicker)}</p>
            <h1 style="margin:0 0 18px;font-family:${SANS};font-size:23px;line-height:1.3;font-weight:650;letter-spacing:-0.02em;color:${C.text};">${escape(heading)}</h1>
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 4px 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.text3};">
            ${footer}<br>
            <span style="color:${C.text3};">${escape(BRAND_NAME)} · Interview preparation, pattern first</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

const textFooter = (line) => `\n—\n${line}\n${BRAND_NAME} · ${appUrl()}`;

/* -------------------------------------------------------------------------- */
/* the messages                                                                */
/* -------------------------------------------------------------------------- */

/** To the applicant, the moment their request is queued. */
export function requestReceived({ name }) {
  const subject = 'We got your request';
  const docs = appUrl('/docs');
  return {
    subject,
    text: [
      `Hi ${firstName(name)},`,
      '',
      `Your request for an account on ${BRAND_NAME} is with the owner. You will get another email when it is reviewed, usually within a day.`,
      '',
      'Your password is already set: once you are approved, sign in with the email and password you just chose.',
      '',
      `While you wait, here is what is inside: ${docs}`,
      textFooter('No account is created without approval. If you did not ask for this, ignore this email.'),
    ].join('\n'),
    html: layout({
      subject,
      preheader: 'Your request is with the owner. You will hear back within a day.',
      kicker: 'Request received',
      heading: `Thanks, ${firstName(name)}. You're in the queue.`,
      body: [
        p(`Your request for an account on ${strong(BRAND_NAME)} is with the owner. You'll get another email when it's reviewed, usually within a day.`),
        p('Your password is already set. Once you\'re approved, sign in with the email and password you just chose.'),
        button(docs, 'See what\'s inside'),
      ].join(''),
      footer: 'No account is created without approval. If you didn\'t ask for this, ignore this email.',
    }),
  };
}

/** To the owner: somebody wants in, with enough on the page to decide. */
export function adminNewRequest(request) {
  const c = request.context || {};
  const where = [c.city, c.region, c.country].filter(Boolean).join(', ');
  const device = [c.device, [c.os, c.browser].filter(Boolean).join(' · ')].filter(Boolean).join(' — ');
  const review = appUrl('/admin/signups');
  const subject = `${oneLine(request.name)} requested access`;

  return {
    subject,
    text: lines([
      `${request.name} <${request.email}> asked for an account on ${BRAND_NAME}.`,
      '',
      `Mobile:  ${request.mobile}`,
      request.reason ? `Why:     ${request.reason}` : null,
      where ? `Where:   ${where}` : null,
      device ? `Device:  ${device}` : null,
      c.ip ? `IP:      ${c.ip}` : null,
      '',
      `Approve or decline: ${review}`,
      textFooter('You are getting this because you are the super admin.'),
    ]),
    html: layout({
      subject,
      preheader: [request.email, request.reason].filter(Boolean).join(' — '),
      kicker: 'New access request',
      heading: `${request.name} wants in`,
      body: [
        details([
          ['Email', `<a href="mailto:${escape(request.email)}" style="color:${C.text};text-decoration:none;">${escape(request.email)}</a>`],
          ['Mobile', `<a href="tel:${escape(String(request.mobile).replace(/[^\d+]/g, ''))}" style="color:${C.text};text-decoration:none;font-family:${MONO};font-size:13px;">${escape(request.mobile)}</a>`],
          ['Why', request.reason ? escape(request.reason) : ''],
          ['Where', escape(where)],
          ['Device', escape(device)],
          ['IP', c.ip ? `<span style="font-family:${MONO};font-size:13px;color:${C.text2};">${escape(c.ip)}</span>` : ''],
        ]),
        button(review, 'Review request'),
      ].join(''),
      footer: 'You\'re getting this because you are the super admin. Nothing happens until you approve.',
    }),
  };
}

/**
 * To the applicant: approved.
 *
 * No password in it — the app has only a hash, and a password in an email lives
 * in that inbox forever. The "forgot it?" link goes to the reset form with the
 * address filled in rather than carrying a reset token of its own: this email
 * may be read days later, and a token minted now would have expired by then.
 */
export function approved({ name, email }) {
  const login = appUrl('/login');
  const forgot = appUrl(`/forgot-password?email=${encodeURIComponent(email)}`);
  const subject = `You're approved — welcome to ${BRAND_NAME}`;

  return {
    subject,
    text: [
      `Hi ${firstName(name)},`,
      '',
      `Your ${BRAND_NAME} account is ready.`,
      '',
      `Sign in with ${email} and the password you chose when you asked for access:`,
      login,
      '',
      `Forgot the password? Set a new one: ${forgot}`,
      '',
      'Start on the roadmap. The first section, Arrays & Hashing, is already open.',
      textFooter(`You are getting this because you requested an account on ${BRAND_NAME}.`),
    ].join('\n'),
    html: layout({
      subject,
      preheader: 'Your account is ready. Sign in with the password you chose.',
      kicker: 'Approved',
      heading: `You're in, ${firstName(name)}.`,
      body: [
        p(`Your ${strong(BRAND_NAME)} account is ready. Sign in with ${strong(email)} and the password you chose when you asked for access.`),
        button(login, `Sign in to ${BRAND_NAME}`),
        p(`Forgot the password? ${link(forgot, 'Set a new one →')}`, { small: true }),
        divider(),
        p(`${strong('Where to start:')} the roadmap. The first section, Arrays & Hashing, is already open, and every pattern has a guide worth reading before its problems.`, { small: true }),
      ].join(''),
      footer: `You're getting this because you requested an account on ${escape(BRAND_NAME)}.`,
    }),
  };
}

/** To the applicant: declined, with the owner's sentence if there is one. */
export function rejected({ name }, note) {
  const subject = 'About your request';
  return {
    subject,
    text: lines([
      `Hi ${firstName(name)},`,
      '',
      `Your request for an account on ${BRAND_NAME} was not approved this time.`,
      '',
      note ? `"${note}"` : null,
      note ? '' : null,
      'If you think that is a mistake, reply to this email.',
      textFooter(`You are getting this because you requested an account on ${BRAND_NAME}.`),
    ]),
    html: layout({
      subject,
      preheader: 'Your request was not approved this time.',
      kicker: 'Request update',
      heading: 'Not this time',
      body: [
        p(`Hi ${escape(firstName(name))}, your request for an account on ${strong(BRAND_NAME)} wasn't approved this time.`),
        note ? quote(note) : '',
        p('If you think that\'s a mistake, just reply to this email.'),
      ].join(''),
      footer: `You're getting this because you requested an account on ${escape(BRAND_NAME)}.`,
    }),
  };
}

/** A reset link. `minutes` is how long it works, said in the email so nobody has to guess. */
export function passwordReset({ name, email }, url, minutes) {
  const subject = `Reset your ${BRAND_NAME} password`;
  return {
    subject,
    text: [
      `Hi ${firstName(name)},`,
      '',
      `Someone asked to reset the password for ${email}. If that was you, choose a new one here:`,
      url,
      '',
      `The link works once and expires in ${minutes} minutes.`,
      textFooter('Did not ask for this? Ignore this email. Your password stays the same.'),
    ].join('\n'),
    html: layout({
      subject,
      preheader: `This link works once and expires in ${minutes} minutes.`,
      kicker: 'Password reset',
      heading: 'Choose a new password',
      body: [
        p(`Someone asked to reset the password for ${strong(email)}. If that was you, set a new one below.`),
        button(url, 'Set a new password'),
        p(`The link works once and expires in ${strong(`${minutes} minutes`)}.`, { small: true }),
        divider(),
        fallback(url),
      ].join(''),
      footer: 'Didn\'t ask for this? Ignore this email. Your password stays the same, and the link expires on its own.',
    }),
  };
}

/** A receipt, and for someone who did not do this, the alarm. */
export function passwordChanged({ name, email }) {
  const login = appUrl('/login');
  const forgot = appUrl(`/forgot-password?email=${encodeURIComponent(email)}`);
  const subject = `Your ${BRAND_NAME} password was changed`;
  return {
    subject,
    text: [
      `Hi ${firstName(name)},`,
      '',
      `The password for ${email} was just changed, and every device signed in to your account has been signed out.`,
      '',
      `Sign in with the new password: ${login}`,
      '',
      `Wasn't you? Reset it again now: ${forgot} — and reply to this email.`,
      textFooter(`You are getting this because the password on your ${BRAND_NAME} account changed.`),
    ].join('\n'),
    html: layout({
      subject,
      preheader: 'Every device was signed out. Sign in with your new password.',
      kicker: 'Security',
      heading: 'Your password was changed',
      body: [
        p(`The password for ${strong(email)} was just changed, and every device signed in to your account has been signed out.`),
        button(login, 'Sign in'),
        divider(),
        p(`${strong('Wasn\'t you?')} ${link(forgot, 'Reset it again now →')} and reply to this email, so we can look into it.`, { small: true }),
      ].join(''),
      footer: `You're getting this because the password on your ${escape(BRAND_NAME)} account changed.`,
    }),
  };
}
