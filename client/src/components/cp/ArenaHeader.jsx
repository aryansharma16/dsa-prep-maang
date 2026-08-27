import { useState } from 'react';
import { errorMessage } from '../../api/http.js';
import { useCP } from '../../store/CPContext.jsx';
import { useToast } from '../../store/ToastContext.jsx';
import { IconClose, IconExternal, IconRotate, IconSparkle } from '../ui/Icons.jsx';
import { ratingKey } from '../../theme/cfRating.js';

/**
 * The strip at the top of the ladder: who you are on Codeforces, where you are
 * on the ladder, and the seven rungs of it.
 *
 * This is the part that makes the module feel like a training environment
 * rather than a second problem list. It answers three questions in one glance —
 * what is my rating, which tier am I working, how far through it am I — and it
 * is the only place the linked handle can be set, synced or removed.
 */

/** "3 minutes ago" is more useful than a timestamp for a thing you just pressed. */
function ago(value) {
  if (!value) return 'never';
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function HandleForm({ initial, onSave, onCancel, busy }) {
  const [value, setValue] = useState(initial || '');
  return (
    <form
      className="cp-handle-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(value.trim());
      }}
    >
      <input
        className="cp-handle-input mono"
        placeholder="Codeforces handle"
        value={value}
        autoFocus
        maxLength={24}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit" className="btn primary" disabled={busy || !value.trim()}>
        {busy ? 'Checking…' : 'Link'}
      </button>
      <button type="button" className="btn" onClick={onCancel} disabled={busy}>
        Cancel
      </button>
    </form>
  );
}

export function ArenaHeader({ tiers, totals, activeTier, onJumpTier }) {
  const { profile, setHandle, sync, syncing } = useCP();
  const { toast, error: toastError } = useToast();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const linked = Boolean(profile?.handle);

  const save = async (handle) => {
    setBusy(true);
    try {
      await setHandle(handle);
      setEditing(false);
      toast(handle ? `Linked ${handle}` : 'Handle removed');
    } catch (err) {
      // The message is Codeforces' own — "User with handle x not found" — which
      // is more useful than anything we would write over it.
      toastError(errorMessage(err, 'Could not link that handle'));
    } finally {
      setBusy(false);
    }
  };

  const runSync = async () => {
    try {
      const result = await sync();
      toast(
        `${result.solvedOnPlatform} solved on Codeforces · ${result.onLadder} of them on this ladder`,
      );
    } catch (err) {
      toastError(errorMessage(err, 'Sync failed'));
    }
  };

  return (
    <header className="cp-arena">
      <div className="cp-arena-top">
        <div className="cp-brand">
          <span className="cp-brand-mark mono">/CP</span>
          <div>
            <h1>Pro Coder</h1>
            <p className="mono">COMPETITIVE PROGRAMMING · TRAINING ENVIRONMENT</p>
          </div>
        </div>

        <div className="cp-identity">
          {editing ? (
            <HandleForm
              initial={profile?.handle}
              busy={busy}
              onSave={save}
              onCancel={() => setEditing(false)}
            />
          ) : linked ? (
            <>
              <a
                className="cp-handle"
                href={`https://codeforces.com/profile/${profile.handle}`}
                target="_blank"
                rel="noreferrer"
                data-band={ratingKey(profile.rating)}
                title="Open the Codeforces profile"
              >
                {profile.handle}
                <IconExternal size={11} />
              </a>

              {/*
                An unrated account is a real state — a brand-new handle has no
                rating and Codeforces reports none. Saying so is better than
                rendering a zero.
              */}
              {profile.rating != null ? (
                <span className="cp-rating-block">
                  <span className="cp-rating mono" data-band={ratingKey(profile.rating)}>
                    {profile.rating}
                  </span>
                  <span className="cp-rank" data-band={ratingKey(profile.rating)}>
                    {profile.cfRank?.name}
                  </span>
                  {profile.maxRating > profile.rating && (
                    <span className="cp-max mono" title="Peak rating">
                      max {profile.maxRating}
                    </span>
                  )}
                </span>
              ) : (
                <span className="cp-rank dim">Unrated</span>
              )}

              <button
                className="toggle-chip"
                onClick={runSync}
                disabled={syncing}
                title="Pull your accepted submissions from Codeforces onto the ladder"
              >
                <IconRotate size={12} />
                {syncing ? 'Syncing…' : 'Sync'}
              </button>
              <button
                className="chip-clear"
                onClick={() => setEditing(true)}
                title="Change or remove the linked handle"
                aria-label="Change handle"
              >
                <IconClose size={12} />
              </button>
            </>
          ) : (
            <button className="toggle-chip on" onClick={() => setEditing(true)}>
              <IconSparkle size={12} />
              Link your Codeforces handle
            </button>
          )}
        </div>
      </div>

      {/* What the last sync learned, and what it means. Only once there is one —
          an empty line here on a fresh account is noise. */}
      {linked && profile.lastSyncAt && (
        <p className="cp-sync-line mono">
          synced {ago(profile.lastSyncAt)} · {profile.platformSolveCount} accepted on Codeforces ·{' '}
          {totals.onPlatform} of them on this ladder
          {profile.lastSyncError && (
            <span className="cp-sync-error"> · last error: {profile.lastSyncError}</span>
          )}
        </p>
      )}
      {!linked && (
        <p className="cp-sync-line mono dim">
          link a handle and the ladder marks everything you have already solved, and knows which
          problems are a stretch for your rating
        </p>
      )}

      {/*
        The rail. Seven rungs, each a button that scrolls to its tier — so it is
        a progress display and the primary navigation at the same time, which is
        what keeps the page usable at 800 rows.
      */}
      <div className="cp-rail" role="group" aria-label="Ladder tiers">
        {tiers.map((tier) => {
          const pct = tier.total ? Math.round((tier.solved / tier.total) * 100) : 0;
          return (
            <button
              key={tier.slug}
              className={`cp-rung ${activeTier === tier.slug ? 'here' : ''}`}
              data-tier={tier.slug}
              onClick={() => onJumpTier(tier.slug)}
              title={`${tier.label} · ${tier.min}${tier.max ? `–${tier.max}` : '+'} · ${tier.solved}/${tier.total} solved`}
            >
              <span className="cp-rung-label">{tier.label}</span>
              <span className="cp-rung-band mono">
                {tier.min}
                {tier.max ? `–${tier.max}` : '+'}
              </span>
              <span className="cp-rung-bar">
                <span style={{ width: `${pct}%` }} />
              </span>
              <span className="cp-rung-frac mono">
                {tier.solved}/{tier.total}
              </span>
              {/* Where the reader actually is, if we know. */}
              {activeTier === tier.slug && <span className="cp-rung-you">YOU</span>}
            </button>
          );
        })}
      </div>
    </header>
  );
}
