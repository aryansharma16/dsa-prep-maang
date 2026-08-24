import { Link } from 'react-router-dom';
import { StatusChip } from '../ui/StatusChip.jsx';

function Row({ label, state, chip, children }) {
  return (
    <div className="health-row">
      <span className="health-label">{label}</span>
      <StatusChip state={state}>{chip}</StatusChip>
      <span className="health-note">{children}</span>
    </div>
  );
}

/**
 * Whether this deployment is actually wired up.
 *
 * Six rows, each saying what is true and what follows from it. Not a chart —
 * six booleans are a list, and the only thing worth encoding is which row to look
 * at first.
 *
 * Every row carries a word beside its dot. A colour on its own is unreadable to
 * anyone who cannot separate the two greens, and it is unreadable to everyone in
 * a screenshot pasted into a chat with "is this bad?" underneath it.
 */
export function SystemHealth({ health }) {
  const { chat, providers, ai, uploads, modules } = health;

  const providerState = () => {
    if (!providers.enabled) return 'bad';
    if (providers.ready < providers.enabled) return 'warn';
    return 'ok';
  };

  return (
    <div className="panel">
      <div className="panel-head">System</div>
      <div className="panel-body">
        <Row
          label="AI providers"
          state={providerState()}
          chip={
            providers.enabled
              ? `${providers.ready}/${providers.enabled} ready`
              : 'none configured'
          }
        >
          {providers.down.length > 0
            ? `${providers.down.map((p) => p.label).join(', ')} cooling down after a failure`
            : providers.missing.length > 0
              ? `Turned on with no key: ${providers.missing.map((p) => p.envKey).join(', ')}`
              : providers.enabled
                ? 'Every enabled provider is answering'
                : 'Chat cannot answer anyone until one is keyed and enabled'}
        </Row>

        <Row
          label="Chat"
          state={chat.enabled ? 'ok' : 'off'}
          chip={chat.enabled ? 'on' : 'off'}
        >
          {chat.enabled
            ? `History kept ${chat.retentionHours}h · ${chat.dailyMessageCap} messages a day each`
            : 'Turned off in settings, not broken'}
        </Row>

        <Row
          label="Motivation AI"
          state={ai.configured ? 'ok' : 'off'}
          chip={ai.configured ? 'keyed' : 'no key'}
        >
          {ai.configured
            ? 'The drafting tool in Motivation will work'
            : 'Set GEMINI_API_KEY to draft lines with AI'}
        </Row>

        <Row
          label="Uploads"
          state={uploads.configured ? 'ok' : 'off'}
          chip={uploads.configured ? 'configured' : 'no store'}
        >
          {uploads.configured
            ? 'Profile pictures will save'
            : 'Profile pictures will fail until a store is configured'}
        </Row>

        <Row
          label="Modules"
          state={modules.hidden.length ? 'warn' : 'ok'}
          chip={
            modules.hidden.length
              ? `${modules.hidden.length} hidden`
              : `all ${modules.total} live`
          }
        >
          {modules.hidden.length ? (
            <>
              Hidden from everyone but you: {modules.hidden.join(', ')} ·{' '}
              <Link to="/admin/modules">change</Link>
            </>
          ) : (
            'Every module is on the side menu'
          )}
        </Row>
      </div>
    </div>
  );
}
