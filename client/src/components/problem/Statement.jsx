import { useState } from 'react';
import { errorMessage } from '../../api/http.js';
import { problemsApi } from '../../api/index.js';

/**
 * LeetCode returns the statement as HTML, so it has to be injected rather than
 * rendered as text — code blocks and constraint lists are unreadable otherwise.
 * It comes from a third-party API, so strip anything executable first.
 */
function sanitize(html) {
  return String(html)
    .replace(/<\s*(script|style|iframe|object|embed|link)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|link)\b[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
}

export function Statement({ slug, source }) {
  const [html, setHtml] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Problems that aren't on LeetCode have no statement to fetch.
  if (source !== 'leetcode') return null;

  const toggle = async () => {
    if (open) return setOpen(false);
    setOpen(true);
    if (html !== null || loading) return;

    setLoading(true);
    try {
      const data = await problemsApi.description(slug);
      setHtml(data.descriptionHtml || '');
      setError(data.descriptionHtml ? '' : 'LeetCode did not return a statement for this one.');
    } catch (err) {
      setError(errorMessage(err, 'Could not load the statement'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="statement">
      <button className="link-btn" onClick={toggle}>
        {open ? 'Hide statement' : 'Show statement'}
      </button>

      {open && (
        <div className="statement-body">
          {loading && <p className="hint">Loading from LeetCode...</p>}
          {!loading && error && <p className="hint">{error}</p>}
          {!loading && !error && html && (
            // eslint-disable-next-line react/no-danger -- sanitized above
            <div dangerouslySetInnerHTML={{ __html: sanitize(html) }} />
          )}
        </div>
      )}
    </div>
  );
}
