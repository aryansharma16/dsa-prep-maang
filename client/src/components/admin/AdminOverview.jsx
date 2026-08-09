import { useEffect, useState } from 'react';
import { errorMessage } from '../../api/http.js';
import { adminApi } from '../../api/index.js';
import { ROLE_LABEL } from '../../store/caps.js';
import { AuditRow } from './AuditRow.jsx';

/** What exists, and what happened lately. The panel's landing page. */
export function AdminOverview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi
      .overview()
      .then(setData)
      .catch((err) => setError(errorMessage(err, 'Could not load the overview')));
  }, []);

  if (error) return <div className="alert">{error}</div>;
  if (!data) return <div className="loading">Loading...</div>;

  const { users, content, recent } = data;

  return (
    <>
      <div className="tiles">
        <div className="tile">
          <span className="k">Accounts</span>
          <span className="v">{users.total}</span>
          <span className="sub">
            {Object.entries(users.byRole)
              .filter(([role]) => role !== 'user')
              .map(([role, n]) => `${n} ${ROLE_LABEL[role].toLowerCase()}`)
              .join(' · ') || 'all learners'}
          </span>
        </div>
        <div className="tile">
          <span className="k">Problems</span>
          <span className="v">{content.problems}</span>
          <span className="sub">
            {content.shared} shared · {content.custom} user-added
          </span>
        </div>
        <div className="tile">
          <span className="k">Guides</span>
          <span className="v">
            {content.guides}
            <span className="dim">/{content.patterns}</span>
          </span>
          <span className="sub">{content.guidesEdited} hand-edited</span>
        </div>
        <div className="tile">
          <span className="k">Edited content</span>
          <span className="v">{content.edited}</span>
          <span className="sub">problems the seed will not touch</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Recent activity</div>
        <div className="panel-body">
          {recent.length === 0 ? (
            <p className="hint">Nothing has been changed yet.</p>
          ) : (
            recent.map((entry) => <AuditRow key={entry._id} entry={entry} />)
          )}
        </div>
      </div>
    </>
  );
}
