import { IconClock, IconFlag, IconUser } from '../ui/Icons.jsx';
import { CompanyMark } from './CompanyMark.jsx';
import { ago, money, roundWhen, since } from './time.js';
import {
  applyMethodLabel,
  columnIsMixed,
  isOneClick,
  nextRound,
  outcomeHue,
  outcomeLabel,
  outcomeSettled,
  roundTypeLabel,
  sourceLabel,
  stageHue,
  stageLabel,
} from './vocab.js';

/**
 * One application, as the board draws it.
 *
 * The card answers one question — *what, if anything, does this need from me* —
 * and everything on it is chosen against that. The company and role identify
 * it; the next round or the staleness says whether it is waiting on you; the
 * source and the referral mark are the two facts you want when scanning for
 * patterns rather than for tasks. Everything else is a click away in the
 * drawer, which is the whole reason the board read drops the question bodies.
 *
 * `data-hue` sits on the article and nothing below it names a colour — the
 * stage chip, the edge and the outcome dot all read `--hue` from here. One
 * attribute recolours the card in both themes, which is the same arrangement
 * `StatusColumn` uses and the reason hues are names rather than values.
 */
export function ApplicationCard({ app, dragging, dragProps, onOpen }) {
  const next = nextRound(app.rounds);
  /* The latest round that has happened — settled, or sat and still waiting on
     them. "HR call · Waiting to hear" is the most useful thing a quiet card can
     say, and it is exactly the round a stricter "settled only" would hide. */
  const last = [...(app.rounds || [])]
    .reverse()
    .find((round) => outcomeSettled(round.outcome) || round.outcome === 'awaiting');

  /*
    Only where the lane holds more than one stage. A "Applied" chip under the
    Applied header would be a label repeating the column it sits in; a
    "Ghosted" chip under Closed is the only thing telling you which of four
    endings this was.
  */
  const showStage = columnIsMixed(app.column);

  return (
    <article
      className={`ap-card ${dragging ? 'is-dragging' : ''} ${app.stale ? 'is-stale' : ''}`}
      data-hue={stageHue(app.stage)}
      {...dragProps}
    >
      {/*
        The whole card opens the drawer, so the button is the card rather than
        something inside it — a 280px target with a 60px hit area is a card
        people think is broken.
      */}
      <button type="button" className="ap-card-open" onClick={onOpen}>
        <span className="sr-only">Open {app.company}</span>
      </button>

      <header className="ap-card-head">
        <CompanyMark company={app.company} slug={app.logoSlug} />
        <span className="ap-card-name">
          <strong>{app.company}</strong>
          {app.role && <span className="ap-card-role">{app.role}</span>}
        </span>
        {app.priority === 'high' && (
          <span className="ap-card-flag" title="High priority">
            <IconFlag size={11} />
          </span>
        )}
      </header>

      {(app.team || app.level || app.location) && (
        <p className="ap-card-where">
          {[app.level, app.team, app.location].filter(Boolean).join(' · ')}
        </p>
      )}

      <div className="ap-card-chips">
        {showStage && (
          <span className="ap-chip ap-chip-stage" data-hue={stageHue(app.stage)}>
            {stageLabel(app.stage)}
          </span>
        )}

        <span className="ap-chip ap-chip-quiet">{sourceLabel(app.source)}</span>

        {/*
          Only the one-click methods get a chip, and that asymmetry is the
          point: applying properly is the baseline and needs no label, while a
          board with nine Easy Applies on it is a board telling you something.
        */}
        {isOneClick(app.applyMethod) && (
          <span className="ap-chip ap-chip-thin" title={applyMethodLabel(app.applyMethod)}>
            {applyMethodLabel(app.applyMethod)}
          </span>
        )}

        {/*
          The referral mark is a fact about how you got in rather than where you
          found the job, which is exactly why it is a separate mark and not a
          value in the source chip beside it. See the vocabulary.
        */}
        {app.referred && (
          <span
            className="ap-chip ap-chip-ref"
            title={
              app.referrer?.name
                ? `Referred by ${app.referrer.name}${app.referrer.title ? `, ${app.referrer.title}` : ''}`
                : 'Referred'
            }
          >
            <IconUser size={10} />
            {app.referrer?.name?.split(' ')[0] || 'Referred'}
          </span>
        )}

        {app.roundCount > 0 && (
          <span className="ap-chip ap-chip-quiet">
            {app.roundCount} {app.roundCount === 1 ? 'round' : 'rounds'}
          </span>
        )}
      </div>

      <footer className="ap-card-foot">
        {next ? (
          <span className="ap-next" title={roundTypeLabel(next.type)}>
            <IconClock size={11} />
            {roundTypeLabel(next.type)} · {roundWhen(next.scheduledAt)}
          </span>
        ) : app.comp?.offered != null ? (
          <span className="ap-next ap-offer">{money(app.comp.offered, app.comp.currency)}</span>
        ) : last ? (
          <span className="ap-last" data-hue={outcomeHue(last.outcome)}>
            <i className="ap-dot" aria-hidden="true" />
            {roundTypeLabel(last.type)} · {outcomeLabel(last.outcome)}
          </span>
        ) : (
          <span className="ap-last ap-quiet">
            {app.appliedAt ? `Applied ${ago(app.appliedAt)}` : 'Not applied yet'}
          </span>
        )}

        {/*
          Staleness is a badge and never a move — nothing in this module
          relocates a card you did not drag. The number comes from the server,
          which compared against its own clock, so two browsers on different
          system times agree about which cards are dead.
        */}
        {app.stale && (
          <span className="ap-stale" title={`No activity for ${app.idleDays} days`}>
            quiet for {since(app.lastActivityAt)}
          </span>
        )}
      </footer>
    </article>
  );
}
