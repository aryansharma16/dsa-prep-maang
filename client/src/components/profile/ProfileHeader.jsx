import { ROLE_LABEL } from '../../store/caps.js';
import { IconExternal } from '../ui/Icons.jsx';
import { AvatarUpload } from './AvatarUpload.jsx';

/**
 * The identity block, across the top of the profile.
 *
 * Full width because of what it holds: a bio is a paragraph, and a paragraph in
 * a 296px rail wraps ten times and reads like a column of confetti. The links
 * have the same problem — a URL has no good break point, so in a narrow card it
 * either overflows or gets ellipsised down to nothing useful.
 */

/** Accepts a bare handle, a protocol-less host, or a full URL. */
const hrefFor = (kind, value) => {
  const raw = String(value || '').trim().replace(/\/+$/, '');
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.includes('/') || raw.includes('.')) return `https://${raw}`;
  const handle = raw.replace(/^@/, '');
  if (kind === 'github') return `https://github.com/${handle}`;
  if (kind === 'linkedin') return `https://linkedin.com/in/${handle}`;
  if (kind === 'leetcode') return `https://leetcode.com/u/${handle}`;
  return `https://${handle}`;
};

/**
 * The shortest thing that still identifies the link.
 *
 * For a profile link that is the handle — the host is already named by the
 * label beside it, so repeating "www.linkedin.com/in/" spends the whole row on
 * text the reader does not need. A personal site keeps its host, because that
 * *is* the identifying part.
 */
const labelFor = (kind, value) => {
  const raw = String(value || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '');
  if (!raw) return '';
  if (kind === 'website') return raw;
  const parts = raw.split('/').filter(Boolean);
  return (parts[parts.length - 1] || raw).replace(/^@/, '');
};

const LINKS = [
  ['github', 'GitHub'],
  ['linkedin', 'LinkedIn'],
  ['leetcode', 'LeetCode'],
  ['website', 'Website'],
];

export function ProfileHeader({ user, onEdit }) {
  const profile = user?.profile || {};
  const links = LINKS.filter(([key]) => profile[key]);
  const companies = profile.targetCompanies || [];

  // College and graduation year are one fact, not two — "LPU '23" is how
  // anyone would actually say it.
  const school = [profile.college, profile.gradYear && `’${String(profile.gradYear).slice(-2)}`]
    .filter(Boolean)
    .join(' ');

  const meta = [profile.targetRole, school, profile.location].filter(Boolean);

  return (
    <div className="panel profile-header">
      <div className="panel-body">
        <div className="ph-top">
          <AvatarUpload size={84}>
            <h1>
              {user?.name}
              {user?.role && user.role !== 'user' && (
                <span className={`role-pill ${user.role}`}>{ROLE_LABEL[user.role]}</span>
              )}
            </h1>
            <p className="hint">{user?.email}</p>
          </AvatarUpload>

          <button type="button" className="btn" onClick={onEdit}>
            Edit profile
          </button>
        </div>

        {meta.length > 0 && (
          <p className="ph-meta">
            {meta.map((item, i) => (
              <span key={item}>
                {i > 0 && <span className="sep">·</span>}
                {item}
              </span>
            ))}
          </p>
        )}

        {profile.bio && <p className="ph-bio">{profile.bio}</p>}

        {(links.length > 0 || companies.length > 0) && (
          <div className="ph-foot">
            {links.length > 0 && (
              <div className="ph-links">
                {links.map(([key, label]) => (
                  <a
                    key={key}
                    className="ph-link"
                    href={hrefFor(key, profile[key])}
                    target="_blank"
                    rel="noreferrer"
                    title={profile[key]}
                  >
                    <span className="k">{label}</span>
                    <span className="v">{labelFor(key, profile[key])}</span>
                    <IconExternal size={10} />
                  </a>
                ))}
              </div>
            )}

            {companies.length > 0 && (
              <div className="ph-targets">
                <span className="k">Targeting</span>
                {companies.map((c) => (
                  <span className="topic-chip" key={c}>
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {!profile.bio && meta.length === 0 && links.length === 0 && (
          <p className="hint ph-empty">
            Add a bio, your links and the companies you are aiming at — this page is the one
            place they all live.
          </p>
        )}
      </div>
    </div>
  );
}
