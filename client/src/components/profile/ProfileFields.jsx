import { TagInput } from '../ui/TagInput.jsx';

/**
 * Every optional profile field, as one form.
 *
 * Used by both the profile page's own edit dialog and the admin panel's user
 * modal — the same fields in the same order, so the two can never drift into
 * disagreeing about what a profile contains.
 *
 * `value` is the profile object, `onChange` takes a patch.
 */
const BIO_MAX = 1200;

export function ProfileFields({ value, onChange, disabled = false }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const field = (key) => value?.[key] ?? '';

  const bio = field('bio');
  // Only once it is close. A counter sitting under every empty field is noise;
  // one that appears as you approach the limit is a warning.
  const bioLeft = BIO_MAX - bio.length;

  return (
    <>
      <label className="field">
        <span>Bio</span>
        <textarea
          rows={4}
          maxLength={BIO_MAX}
          value={bio}
          disabled={disabled}
          placeholder="A line or two about you."
          onChange={(e) => set({ bio: e.target.value })}
        />
        {bioLeft < 200 && (
          <span className={`field-hint ${bioLeft < 40 ? 'warn' : ''}`}>
            {bioLeft} characters left
          </span>
        )}
      </label>

      <div className="field-row">
        <label className="field" style={{ flex: 2 }}>
          <span>College</span>
          <input
            value={field('college')}
            disabled={disabled}
            onChange={(e) => set({ college: e.target.value })}
          />
        </label>
        <label className="field" style={{ flex: 1 }}>
          <span>Graduation year</span>
          <input
            type="number"
            value={value?.gradYear ?? ''}
            disabled={disabled}
            placeholder="2026"
            onChange={(e) =>
              // Empty means "not set", which the schema stores as null — an
              // empty string would fail the number validator.
              set({ gradYear: e.target.value === '' ? null : Number(e.target.value) })
            }
          />
        </label>
      </div>

      <div className="field-row">
        <label className="field" style={{ flex: 1 }}>
          <span>Location</span>
          <input
            value={field('location')}
            disabled={disabled}
            placeholder="Jalandhar, Punjab"
            onChange={(e) => set({ location: e.target.value })}
          />
        </label>
        <label className="field" style={{ flex: 1 }}>
          <span>Target role</span>
          <input
            value={field('targetRole')}
            disabled={disabled}
            placeholder="Backend Engineer"
            onChange={(e) => set({ targetRole: e.target.value })}
          />
        </label>
      </div>

      <div className="field-row">
        <label className="field" style={{ flex: 1 }}>
          <span>GitHub</span>
          <input
            value={field('github')}
            disabled={disabled}
            placeholder="https://github.com/you"
            onChange={(e) => set({ github: e.target.value })}
          />
        </label>
        <label className="field" style={{ flex: 1 }}>
          <span>LinkedIn</span>
          <input
            value={field('linkedin')}
            disabled={disabled}
            placeholder="https://linkedin.com/in/you"
            onChange={(e) => set({ linkedin: e.target.value })}
          />
        </label>
      </div>

      <div className="field-row">
        <label className="field" style={{ flex: 1 }}>
          <span>LeetCode</span>
          <input
            value={field('leetcode')}
            disabled={disabled}
            placeholder="https://leetcode.com/u/you"
            onChange={(e) => set({ leetcode: e.target.value })}
          />
        </label>
        <label className="field" style={{ flex: 1 }}>
          <span>Website</span>
          <input
            value={field('website')}
            disabled={disabled}
            placeholder="https://yoursite.com"
            onChange={(e) => set({ website: e.target.value })}
          />
        </label>
      </div>

      {/* A div, not a label — .field > span would turn TagInput's chips into
          blocks and break their remove buttons. */}
      <div className="field">
        <span>Target companies</span>
        <TagInput
          value={value?.targetCompanies || []}
          onChange={(targetCompanies) => !disabled && set({ targetCompanies })}
          placeholder="Google, Atlassian, Microsoft..."
        />
      </div>
    </>
  );
}
