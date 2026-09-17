import { SignupRequest } from '../models/SignupRequest.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { hashPassword, isSuperAdminEmail, registerUser } from './auth.service.js';
import { mailAdminNewRequest, mailApproved, mailRejected, mailRequestReceived } from './mail.service.js';

/**
 * The approval queue: asking for an account, and the owner answering.
 *
 * Registration used to be `registerUser` and a cookie. It is now two steps with
 * a person in the middle, and the thing that makes that safe rather than merely
 * slower is that *nothing* in between is an account. A pending request cannot
 * sign in, cannot be promoted, cannot appear in the user list, and holds no
 * session — it is a row with a hash on it until somebody says yes.
 */

/* -------------------------------------------------------------------------- */
/* what we can tell about a request without asking                            */
/* -------------------------------------------------------------------------- */

/**
 * Desktop, mobile or tablet, plus browser and OS, from the user agent.
 *
 * Deliberately a dozen lines of regex rather than a dependency. A UA parser is
 * a library that ships a database of device strings and updates it forever; all
 * this needs to answer is "phone or laptop", and the honest failure — an empty
 * string next to the full UA, which is stored anyway — is fine for a field a
 * human glances at before clicking Approve.
 */
export function readUserAgent(ua = '') {
  const s = String(ua).slice(0, 400);
  if (!s) return {};

  const tablet = /\b(iPad|Tablet)\b/i.test(s) || (/Android/i.test(s) && !/Mobile/i.test(s));
  const mobile = /\b(Mobi|iPhone|iPod|Android.*Mobile|Windows Phone)\b/i.test(s);

  // Order matters: Edge and Opera both claim Chrome, Chrome claims Safari.
  const browser =
    /\bEdg\//.test(s) ? 'Edge'
    : /\bOPR\/|\bOpera\b/.test(s) ? 'Opera'
    : /\bChrome\//.test(s) ? 'Chrome'
    : /\bFirefox\//.test(s) ? 'Firefox'
    : /\bSafari\//.test(s) ? 'Safari'
    : '';

  const os =
    /\bWindows NT\b/.test(s) ? 'Windows'
    : /\b(iPhone|iPad|iPod|iOS)\b/.test(s) ? 'iOS'
    : /\bMac OS X\b/.test(s) ? 'macOS'
    : /\bAndroid\b/.test(s) ? 'Android'
    : /\bLinux\b/.test(s) ? 'Linux'
    : '';

  return { device: tablet ? 'tablet' : mobile ? 'mobile' : 'desktop', browser, os, userAgent: s };
}

/**
 * The address the request actually came from.
 *
 * `x-forwarded-for` is only read when Express says to trust it (`trust proxy`),
 * because behind no proxy it is a header a client sets to whatever it likes —
 * and an IP that a stranger chose is worse than no IP at all, since it is the
 * field the owner is about to make a judgement on.
 */
export function readIp(req) {
  return String(req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '').slice(0, 60);
}

/*
  Addresses no geolocation service can say anything about. Checked before the
  call rather than after, because in development every request is one of these
  and a lookup per signup that can only fail is a lookup not worth making.
*/
const PRIVATE_IP =
  /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|::1$|f[cd][0-9a-f]{2}:)/i;

/**
 * City and country for an address, best-effort, from a free service.
 *
 * ip-api.com needs no key and allows 45 requests a minute from one address,
 * which is far above what a signup form generates. It is wrapped in a timeout
 * and a catch that returns `{}` because this must never be the reason a signup
 * fails: the applicant is waiting on this request, and a geolocation service is
 * not something this app's availability should depend on.
 *
 * Their IP does leave the server to make this call. That is the trade for the
 * field, it is the only outbound call in the signup path, and it sends the
 * address and nothing else — no name, no email.
 */
export async function lookupLocation(ip) {
  if (!ip || PRIVATE_IP.test(ip)) return {};

  try {
    const response = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city`,
      { signal: AbortSignal.timeout(2500) },
    );
    if (!response.ok) return {};

    const data = await response.json();
    if (data?.status !== 'success') return {};

    return { city: data.city || '', region: data.regionName || '', country: data.country || '' };
  } catch {
    // Down, rate-limited, blocked outbound, slow — all the same answer here.
    return {};
  }
}

/* -------------------------------------------------------------------------- */
/* the queue                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Files a request, or creates the owner's account outright.
 *
 * The pinned super admin is the one address that cannot wait for approval,
 * because on a fresh deployment there is nobody to approve it — the queue would
 * have one row in it and no way to reach the panel that shows the row. So the
 * address in SUPER_ADMIN_EMAIL registers the old way and signs straight in.
 * That is not a hole: the address is set in the environment by whoever owns the
 * box, and `assertEmailNotReserved` already stops anything else claiming it.
 *
 * Returns `{ user }` for that one case and `{ request }` for everyone else, and
 * the caller branches on which — rather than this returning a flag, because the
 * two outcomes have genuinely different responses (a session, or a 202).
 */
export async function requestAccess({ email, password, name, mobile, reason }, req) {
  const taken = await User.findOne({ email }).select('_id');
  if (taken) throw ApiError.conflict('An account with that email already exists', 'EMAIL_TAKEN');

  if (isSuperAdminEmail(email)) {
    const user = await registerUser({ email, password, name });
    return { user };
  }

  /*
    Checked before the insert as well as by the partial unique index, so the
    common case gets the sentence rather than a duplicate-key error. The index
    is what actually holds under two simultaneous submissions; this is what
    makes the answer readable.
  */
  const pending = await SignupRequest.findOne({ email, status: 'pending' }).select('_id');
  if (pending) {
    throw ApiError.conflict(
      'A request for that email is already waiting to be reviewed',
      'REQUEST_PENDING',
    );
  }

  const ip = readIp(req);
  const context = { ip, ...readUserAgent(req.get?.('user-agent')), ...(await lookupLocation(ip)) };

  const request = await SignupRequest.create({
    email,
    name,
    mobile,
    reason: reason || '',
    passwordHash: await hashPassword(password),
    context,
  });

  /*
    Not awaited. Two SMTP round trips are seconds the applicant would spend
    watching a spinner for something that has already been saved, and a mail
    server having a bad afternoon must not turn a filed request into a failed
    one. `sendMail` never rejects, so there is no unhandled rejection to catch.
  */
  mailRequestReceived(request);
  mailAdminNewRequest(request);

  return { request };
}

/**
 * Turns a pending request into an account.
 *
 * The hash moves across rather than being re-derived: it is the password the
 * applicant chose and already proved they can type, and nothing here has the
 * plain text to hash again. `registerUser` is deliberately not reused for the
 * same reason — it takes a password, and this has none.
 *
 * Idempotent by status rather than by catching the duplicate-key error: two
 * clicks on Approve is the ordinary way this races itself.
 */
export async function approveRequest(id, actor) {
  const request = await SignupRequest.findById(id).select('+passwordHash');
  if (!request) throw ApiError.notFound('Request not found', 'NO_REQUEST');
  if (request.status !== 'pending') {
    throw ApiError.conflict(`That request was already ${request.status}`, 'ALREADY_DECIDED');
  }

  const taken = await User.findOne({ email: request.email }).select('_id');
  if (taken) throw ApiError.conflict('An account with that email already exists', 'EMAIL_TAKEN');

  const user = await User.create({
    email: request.email,
    passwordHash: request.passwordHash,
    name: request.name,
  });

  const decision = {
    status: 'approved',
    user: user._id,
    decidedAt: new Date(),
    decidedBy: actor?._id ?? null,
    decidedByName: actor?.name || actor?.email || '',
  };

  /*
    Written with `updateOne` rather than by mutating and saving, for the
    `$unset`: the hash is the account's now, and a copy of it left on a decided
    row is a second place a password lives for no reason anybody could name
    later. `save()` cannot express that cleanly on a required, `select: false`
    path — the document would have to be loaded with it, un-set, and have
    validation turned off to get past `required`.
  */
  await SignupRequest.updateOne(
    { _id: request._id },
    { $set: decision, $unset: { passwordHash: '' } },
  );
  Object.assign(request, decision);

  mailApproved(request);

  return { request, user };
}

/** Refuses a pending request, with an optional sentence the applicant gets. */
export async function rejectRequest(id, note, actor) {
  const request = await SignupRequest.findById(id);
  if (!request) throw ApiError.notFound('Request not found', 'NO_REQUEST');
  if (request.status !== 'pending') {
    throw ApiError.conflict(`That request was already ${request.status}`, 'ALREADY_DECIDED');
  }

  const decision = {
    status: 'rejected',
    note: note || '',
    decidedAt: new Date(),
    decidedBy: actor?._id ?? null,
    decidedByName: actor?.name || actor?.email || '',
  };

  // The hash goes for the same reason as on approval, and the partial unique
  // index lets the address apply again once this row is no longer pending.
  await SignupRequest.updateOne(
    { _id: request._id },
    { $set: decision, $unset: { passwordHash: '' } },
  );
  Object.assign(request, decision);

  mailRejected(request, decision.note);

  return request;
}
