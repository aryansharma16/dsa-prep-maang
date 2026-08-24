import { useEffect, useState } from 'react';
import { errorMessage } from '../../api/http.js';
import { adminApi } from '../../api/index.js';
import { useAuth } from '../../store/AuthContext.jsx';
import { can } from '../../store/caps.js';
import { useToast } from '../../store/ToastContext.jsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx';

/**
 * Which side-menu modules have shipped.
 *
 * Hiding one is how an unfinished feature stays in the app while it is being
 * built: it keeps working for the super admin and stops existing for everyone
 * else — nav item gone, route gone, API answering 404. The alternative is a
 * long-lived branch or a half-built page that learners can find.
 *
 * Read is `settings:read`, so an admin can see that Tasks is missing on purpose
 * rather than broken. Every write is `module:write`, which only the super admin
 * holds; the panel renders read-only for everyone else rather than hiding
 * itself, the same way AdminChat does.
 */
export function AdminModules() {
  const { user: me, refreshSession } = useAuth();
  const { success, error } = useToast();

  const [modules, setModules] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(false);

  const writable = can(me, 'module:write');

  useEffect(() => {
    adminApi
      .modules()
      .then(setModules)
      .catch((err) => setLoadError(errorMessage(err, 'Could not load the modules')));
  }, []);

  const apply = async (module, hidden) => {
    setBusy(true);
    try {
      setModules(await adminApi.setModuleHidden(module.key, hidden));
      /*
        The super admin is looking at their own side menu while they change it.
        Re-reading the session moves the Dev badge on and off the nav item in
        the same breath as the toast, so the panel and the menu can never
        disagree about what just happened.
      */
      await refreshSession();
      success(
        hidden
          ? `${module.label} is now yours only`
          : `${module.label} is live for everyone`,
      );
    } catch (err) {
      error(errorMessage(err, 'Could not change that'));
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  if (loadError) return <div className="alert">{loadError}</div>;
  if (!modules) return <div className="loading">Loading modules...</div>;

  return (
    <>
      {!writable && (
        <div className="alert">Read-only — only the super admin can change these.</div>
      )}

      <div className="panel">
        <div className="panel-head">
          <h3>Side menu</h3>
          <span className="spacer" />
          <span className="hint">{modules.filter((m) => m.hidden).length} in development</span>
        </div>
        <div className="panel-body">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Module</th>
                <th>Route</th>
                <th>Who can see it</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {modules.map((module) => (
                <tr key={module.key} className={module.hidden ? 'row-off' : ''}>
                  <td>
                    <b>{module.label}</b>
                  </td>
                  <td>
                    <span className="hint mono">{module.path}</span>
                  </td>
                  <td>
                    {module.hidden ? (
                      <>
                        <span className="dev-pill">Dev</span>
                        <span className="hint"> Super admin only</span>
                      </>
                    ) : (
                      <span className="hint">Everyone</span>
                    )}
                  </td>
                  <td className="row-acts">
                    {writable && (
                      <button
                        className="link-btn"
                        disabled={busy}
                        onClick={() =>
                          module.hidden ? apply(module, false) : setConfirming(module)
                        }
                      >
                        {module.hidden ? 'Release' : 'Hide'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="hint">
            Hiding a module removes it from the side menu, makes its route behave like one that
            does not exist, and turns off the API behind it — for everyone except you. Releasing it
            puts it back. The roadmap is not listed because it is where every redirect lands.
          </p>
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          title={`Hide ${confirming.label}?`}
          message={`${confirming.label} disappears from the side menu for every account except yours.`}
          detail="Anything already saved is kept and comes back untouched when you release it."
          confirmLabel="Hide it"
          busy={busy}
          onConfirm={() => apply(confirming, true)}
          onCancel={() => setConfirming(null)}
        />
      )}
    </>
  );
}
