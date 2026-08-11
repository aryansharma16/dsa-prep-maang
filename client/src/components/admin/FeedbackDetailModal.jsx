import { useState } from 'react';
import { errorMessage } from '../../api/http.js';
import { adminApi } from '../../api/index.js';
import { useToast } from '../../store/ToastContext.jsx';
import { TYPE_LABEL, STATUS_OPTIONS } from '../feedback/vocab.js';
import { Dropdown } from '../ui/Dropdown.jsx';
import { Modal } from '../ui/Modal.jsx';
import { AvatarButton } from '../ui/PhotoPreview.jsx';
import { exact } from './time.js';

/**
 * One submission, and the two things staff can do to it.
 *
 * Takes the whole row rather than an id, so there is no second fetch — the list
 * response already carries the entire record. UserDetailModal fetches because it
 * needs study stats the list does not have; there is no equivalent here.
 *
 * Status and reply save together in one PATCH. They are changed in one sitting —
 * you read the thing, decide, and say why — and splitting them into two requests
 * would mean a status that moved while the sentence explaining it failed to.
 */
export function FeedbackDetailModal({ item, writable, onClose, onSaved }) {
  const { success, error } = useToast();

  const [status, setStatus] = useState(item.status);
  const [response, setResponse] = useState(item.response?.text || '');
  const [busy, setBusy] = useState(false);

  const dirty = status !== item.status || response !== (item.response?.text || '');

  const save = async () => {
    setBusy(true);
    try {
      const body = {};
      if (status !== item.status) body.status = status;
      // Sent even when empty — an empty string is how the reply gets cleared, and
      // the server tells that apart from an absent key.
      if (response !== (item.response?.text || '')) body.response = response;

      await adminApi.updateFeedback(item._id, body);
      success('Saved');
      onSaved();
      onClose();
    } catch (err) {
      error(errorMessage(err, 'Could not save that'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={writable ? 'Answer this' : 'Submission'} onClose={onClose} size="lg">
      <div className="modal-body">
        <div className="admin-person">
          <AvatarButton name={item.submitter.name} email={item.submitter.email} size={32} />
          <span>
            <b>{item.submitter.name || 'Deleted account'}</b>
            <span className="hint">{item.submitter.email}</span>
          </span>
        </div>

        <p className="hint">
          <span className="tag-mini">{TYPE_LABEL[item.type] || item.type}</span>
          {' Sent '}
          {exact(item.createdAt)}
          {item.path && (
            <>
              {' from '}
              <span className="mono">{item.path}</span>
            </>
          )}
        </p>

        <div className="fb-detail-msg">
          <b>{item.title}</b>
          <p>{item.message}</p>
        </div>

        <label className="field">
          <span>Status</span>
          <Dropdown
            value={status}
            onChange={setStatus}
            options={STATUS_OPTIONS}
            ariaLabel="Status"
            disabled={!writable}
          />
        </label>

        <label className="field">
          <span>Reply to them</span>
          <textarea
            rows={4}
            value={response}
            onChange={(e) => setResponse(e.target.value.slice(0, 2000))}
            placeholder="What you did about it, or why you are not going to."
            disabled={!writable}
          />
          <span className="field-hint">
            {writable
              ? 'They see this under their submission, signed with your name. Clearing it removes the reply.'
              : 'Read-only — you do not have permission to answer submissions.'}
          </span>
        </label>
      </div>

      <div className="modal-foot">
        <button type="button" className="btn ghost" onClick={onClose}>
          Close
        </button>
        {writable && (
          <button type="button" className="btn primary" onClick={save} disabled={!dirty || busy}>
            {busy ? 'Saving...' : 'Save'}
          </button>
        )}
      </div>
    </Modal>
  );
}
