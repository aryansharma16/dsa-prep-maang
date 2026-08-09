import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../../api/http.js';
import { adminApi } from '../../api/index.js';
import { useAuth } from '../../store/AuthContext.jsx';
import { can } from '../../store/caps.js';
import { useToast } from '../../store/ToastContext.jsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx';

/**
 * Chat settings, and the state of the providers behind them.
 *
 * Read is `settings:read`, which an admin has; every write here is
 * `settings:write`, which only the super admin has. The panel renders read-only
 * rather than hiding itself, so "why can't I change this" has a visible answer.
 */

const HEALTH_LABEL = {
  NO_CREDENTIAL: 'key rejected',
  NO_BALANCE: 'no credit on the account',
  NO_MODEL: 'model not found',
  QUOTA: 'out of requests for today',
  RATE_LIMIT: 'rate limited',
  TIMEOUT: 'timed out',
  NETWORK: 'unreachable',
  UPSTREAM: 'provider error',
};

export function AdminChat() {
  const { user: me } = useAuth();
  const { success, error } = useToast();

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [hours, setHours] = useState('');
  const [cap, setCap] = useState('');
  const [confirming, setConfirming] = useState(null);
  const [purging, setPurging] = useState(false);
  const [busy, setBusy] = useState(false);

  const writable = can(me, 'settings:write');

  const load = useCallback(() => {
    adminApi
      .settings()
      .then((d) => {
        setData(d);
        setHours(String(d.chat.retentionHours));
        setCap(String(d.chat.dailyMessageCap));
      })
      .catch((err) => setLoadError(errorMessage(err, 'Could not load the chat settings')));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (body, message) => {
    setBusy(true);
    try {
      const next = await adminApi.updateSettings(body);
      setData((prev) => ({ ...prev, ...next }));
      success(
        next.rescheduled
          ? `${message} — ${next.rescheduled.conversations} chats rescheduled`
          : message,
      );
    } catch (err) {
      error(errorMessage(err, 'Could not save that'));
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  const saveRetention = () => {
    const value = Number(hours);
    if (!Number.isInteger(value) || value < 1 || value > 720) {
      error('Retention must be a whole number of hours between 1 and 720.');
      return;
    }
    // Shortening deletes history that exists right now, so it is confirmed.
    // Lengthening only changes when things vanish later.
    if (value < data.chat.retentionHours) {
      setConfirming({ hours: value });
      return;
    }
    save({ retentionHours: value }, `Chats now kept for ${value}h`);
  };

  const toggleProvider = (id) => {
    const current = data.chat.providers;
    const next = current.includes(id) ? current.filter((p) => p !== id) : [...current, id];
    if (!next.length) {
      error('At least one provider has to stay enabled.');
      return;
    }
    save({ providers: next }, 'Provider list updated');
  };

  const move = (id, delta) => {
    const next = [...data.chat.providers];
    const at = next.indexOf(id);
    const to = at + delta;
    if (at === -1 || to < 0 || to >= next.length) return;
    [next[at], next[to]] = [next[to], next[at]];
    save({ providers: next }, 'Provider order updated');
  };

  const purge = async () => {
    setBusy(true);
    try {
      const result = await adminApi.purgeChats();
      success(`Deleted ${result.conversations} chats and ${result.messages} messages`);
      load();
    } catch (err) {
      error(errorMessage(err, 'Could not purge the chats'));
    } finally {
      setBusy(false);
      setPurging(false);
    }
  };

  if (loadError) return <div className="alert">{loadError}</div>;
  if (!data) return <div className="loading">Loading chat settings...</div>;

  const enabledProviders = data.chat.providers;

  return (
    <>
      {!writable && (
        <div className="alert">Read-only — only the super admin can change these.</div>
      )}

      <div className="panel">
        <div className="panel-head">
          <h3>Retention</h3>
          <span className="spacer" />
          <span className="hint mono">
            {data.stats.conversations} chats · {data.stats.messages} messages stored
          </span>
        </div>
        <div className="panel-body">
          <div className="chat-retention">
            <label className="field">
              <span>Hours kept after the last message</span>
              <input
                type="number"
                min="1"
                max="720"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                disabled={!writable || busy}
              />
            </label>
            {writable && (
              <button
                className="btn primary"
                onClick={saveRetention}
                disabled={busy || String(data.chat.retentionHours) === hours}
              >
                Save
              </button>
            )}
          </div>
          <p className="hint">
            Every conversation is deleted this many hours after its last message. Applies to chats
            that already exist too — shortening it brings their deletion forward.
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Providers</h3>
          <span className="spacer" />
          <span className="hint">Tried top to bottom until one answers</span>
        </div>
        <div className="panel-body">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Key</th>
                <th>State</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {[...data.providers]
                .sort((a, b) => {
                  const ai = enabledProviders.indexOf(a.id);
                  const bi = enabledProviders.indexOf(b.id);
                  return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                })
                .map((provider) => {
                  const order = enabledProviders.indexOf(provider.id);
                  return (
                    <tr key={provider.id} className={provider.enabled ? '' : 'row-off'}>
                      <td>
                        <b>
                          {order > -1 && <span className="chat-order mono">{order + 1}</span>}
                          {provider.label}
                        </b>
                        <span className="hint">{provider.models.map((m) => m.id).join(', ')}</span>
                      </td>
                      <td>
                        {provider.configured ? (
                          <span className="hint">set</span>
                        ) : (
                          <span className="hint mono">{provider.envKey}</span>
                        )}
                      </td>
                      <td>
                        {!provider.configured ? (
                          <span className="hint">no key</span>
                        ) : provider.health.ok ? (
                          <span className="hint">ready</span>
                        ) : (
                          <span className="hint" title={`Retried after ${provider.health.until}`}>
                            {HEALTH_LABEL[provider.health.kind] || provider.health.kind}
                          </span>
                        )}
                      </td>
                      <td className="row-acts">
                        {writable && (
                          <>
                            {order > 0 && (
                              <button
                                className="link-btn"
                                onClick={() => move(provider.id, -1)}
                                disabled={busy}
                              >
                                Up
                              </button>
                            )}
                            <button
                              className="link-btn"
                              onClick={() => toggleProvider(provider.id)}
                              disabled={busy || !provider.configured}
                              title={provider.configured ? undefined : `Set ${provider.envKey} first`}
                            >
                              {provider.enabled ? 'Disable' : 'Enable'}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Limits</h3>
        </div>
        <div className="panel-body">
          <div className="chat-retention">
            <label className="field">
              <span>Messages per person per day</span>
              <input
                type="number"
                min="1"
                max="1000"
                value={cap}
                onChange={(e) => setCap(e.target.value)}
                disabled={!writable || busy}
              />
            </label>
            {writable && (
              <button
                className="btn"
                onClick={() => save({ dailyMessageCap: Number(cap) }, `Daily cap set to ${cap}`)}
                disabled={busy || String(data.chat.dailyMessageCap) === cap}
              >
                Save
              </button>
            )}
          </div>
          <p className="hint">
            Counted in UTC days and kept separately from the chats themselves, so clearing history
            does not hand everyone a fresh allowance.
          </p>
        </div>
      </div>

      {writable && (
        <div className="panel">
          <div className="panel-head">
            <h3>Danger zone</h3>
          </div>
          <div className="panel-body">
            <div className="chat-retention">
              <div>
                <b>Delete all chat history now</b>
                <p className="hint">
                  Every conversation for every account, immediately, rather than waiting for
                  retention. Spend counters are kept.
                </p>
              </div>
              <span className="spacer" />
              <button className="btn danger" onClick={() => setPurging(true)} disabled={busy}>
                Purge
              </button>
            </div>
          </div>
        </div>
      )}

      {confirming && (
        <ConfirmDialog
          title="Shorten retention?"
          message={`Chats will be kept for ${confirming.hours}h instead of ${data.chat.retentionHours}h.`}
          detail={`This applies to the ${data.stats.conversations} conversations already stored — anything older than the new window is deleted on the next sweep.`}
          confirmLabel="Shorten"
          tone="danger"
          busy={busy}
          onConfirm={() => save({ retentionHours: confirming.hours }, `Chats now kept for ${confirming.hours}h`)}
          onCancel={() => setConfirming(null)}
        />
      )}

      {purging && (
        <ConfirmDialog
          title="Delete all chat history?"
          message={`This deletes ${data.stats.conversations} conversations and ${data.stats.messages} messages for every account.`}
          detail="It cannot be undone. Type delete to confirm."
          confirmText="delete"
          confirmLabel="Delete everything"
          tone="danger"
          busy={busy}
          onConfirm={purge}
          onCancel={() => setPurging(false)}
        />
      )}
    </>
  );
}
