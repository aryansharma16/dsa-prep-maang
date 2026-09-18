import { useState } from 'react';

import { Dropdown } from '../ui/Dropdown.jsx';
import { dateInputValue, dateFromInput, fromLpa, money, toLpa } from './time.js';
import { CURRENCY_OPTIONS } from './vocab.js';

/**
 * Money, and only once there is any.
 *
 * The panel does not exist until the card reaches Offer — the drawer decides
 * that, not this file — which is the visible half of a decision the schema also
 * makes: `comp` is `default: undefined`, so an application that never got this
 * far carries no compensation object at all rather than a row of zeroes. A
 * board where every card said "₹0" would be a board that had learned nothing.
 *
 * ---------------------------------------------------------------------------
 * Lakhs in, rupees out.
 *
 * Nobody in this market negotiates in rupees and nobody types 3200000, so INR
 * fields read and write LPA. The database stores whole rupees, because a
 * quantity that is sometimes lakhs and sometimes rupees is the one bug in this
 * module nobody would be able to debug from the number on the screen. The
 * conversion is `fromLpa` / `toLpa` in time.js and happens in exactly these two
 * places.
 * ---------------------------------------------------------------------------
 */

const FIELDS = [
  { key: 'expected', label: 'What you asked for' },
  { key: 'offered', label: 'What they offered', strong: true },
  { key: 'base', label: 'Base' },
  { key: 'bonus', label: 'Bonus' },
  { key: 'joiningBonus', label: 'Joining bonus' },
  { key: 'esop', label: 'Equity (per year)' },
];

export function OfferPanel({ comp, defaultCurrency = 'INR', onSave, busy }) {
  const currency = comp?.currency || defaultCurrency;
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(FIELDS.map((field) => [field.key, toLpa(comp?.[field.key], currency)])),
  );

  const unit = currency === 'INR' ? 'LPA' : currency;

  const commit = (key) => {
    const raw = draft[key];
    const next = raw === '' ? null : fromLpa(raw, currency);
    if (next === (comp?.[key] ?? null)) return;
    onSave({ [key]: next });
  };

  return (
    <section className="ap-offer-panel">
      <header className="ap-section-head">
        <h3>The offer</h3>
        <Dropdown
          ariaLabel="Currency"
          variant="inline"
          value={currency}
          options={CURRENCY_OPTIONS}
          onChange={(value) => onSave({ currency: value })}
        />
      </header>

      <div className="ap-offer-grid">
        {FIELDS.map((field) => (
          <label key={field.key} className={`field ${field.strong ? 'is-strong' : ''}`}>
            <span>
              {field.label} <em className="ap-unit">{unit}</em>
            </span>
            <input
              type="number"
              min={0}
              step="0.1"
              value={draft[field.key]}
              disabled={busy}
              onChange={(event) =>
                setDraft((current) => ({ ...current, [field.key]: event.target.value }))
              }
              onBlur={() => commit(field.key)}
            />
          </label>
        ))}
      </div>

      <div className="field-row">
        <label className="field">
          <span>Offered on</span>
          <input
            type="date"
            value={dateInputValue(comp?.receivedAt)}
            disabled={busy}
            onChange={(event) =>
              onSave({ receivedAt: dateFromInput(event.target.value) })
            }
          />
        </label>
        <label className="field">
          <span>Decide by</span>
          <input
            type="date"
            value={dateInputValue(comp?.decideBy)}
            disabled={busy}
            onChange={(event) => onSave({ decideBy: dateFromInput(event.target.value) })}
          />
          <span className="field-hint">This one shows up in the top bar.</span>
        </label>
      </div>

      {/*
        Free text beside the equity number, because an ESOP figure without the
        vesting schedule, the cliff and the strike price is not information —
        and none of those three is worth a column on a personal tracker.
      */}
      <label className="field">
        <span>About the equity</span>
        <input
          defaultValue={comp?.esopNote || ''}
          maxLength={500}
          placeholder="4-year vest, 1-year cliff, strike ₹120…"
          disabled={busy}
          onBlur={(event) =>
            event.target.value !== (comp?.esopNote || '') &&
            onSave({ esopNote: event.target.value })
          }
        />
      </label>

      <label className="field">
        <span>Notes</span>
        <textarea
          rows={3}
          defaultValue={comp?.notes || ''}
          maxLength={2000}
          placeholder="What you said, what they said, what is still open."
          disabled={busy}
          onBlur={(event) =>
            event.target.value !== (comp?.notes || '') && onSave({ notes: event.target.value })
          }
        />
      </label>

      {comp?.offered != null && comp?.expected != null && (
        <p className="ap-offer-gap ap-muted">
          {comp.offered >= comp.expected
            ? `At or above what you asked for (${money(comp.expected, currency)}).`
            : `${money(comp.expected - comp.offered, currency)} under what you asked for.`}
        </p>
      )}
    </section>
  );
}
