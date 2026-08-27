import mongoose from 'mongoose';

/**
 * The owner's prep plan, as it is actually being run.
 *
 * The *plan* is not in here. Its phases, weeks, sessions and reading list are
 * authored in the client bundle (`client/src/playbook/plan.js`) for the same
 * reason the Learn track's prose is: it is a document we write, identical for
 * every render, and nobody's data. Storing it would mean a migration every time
 * a sentence changes.
 *
 * What is here is the three things the document cannot know about itself:
 * when it started, what has been ticked off, and what was written in the
 * margin. Everything else the page shows — how many problems in a phase are
 * solved, which tier the ladder is up to, how far behind schedule the week is —
 * is derived at render time from the roadmap and ladder rows that already
 * exist. That is the whole point: a plan that has to be told what you have done
 * is a plan you stop updating in week three.
 *
 * One document per account, though there is exactly one account that can hold
 * one. Keyed by owner rather than a fixed key like `Setting`, because "the
 * owner" is an account id that changes with SUPER_ADMIN_EMAIL, and a fixed key
 * would silently hand the previous owner's plan to the next one.
 */

/*
  Ids come from the authored plan — `w07`, `sd-caching`, `mock-3`. The server
  never interprets them and deliberately cannot: what a tick means is the
  client's business, exactly as `UserView.filters` is. What it does do is bound
  them, because they arrive from a request.
*/
const MAX_TICKS = 2000;
const MAX_ID = 64;

const playbookSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      immutable: true,
    },

    /**
     * Day one. Null until the plan is actually started, and that null is
     * load-bearing — every "week N of 24" on the page is counted from here, so
     * defaulting it to the moment the document happened to be created would
     * quietly start the clock on a page view.
     */
    startedAt: { type: Date, default: null },

    /** The date being prepared for. Interviewing, not finishing the list. */
    targetDate: { type: Date, default: null },

    /**
     * Everything ticked, as a flat set of plan ids.
     *
     * Flat rather than nested under weeks and phases, because the shape of the
     * plan is the client's and a nested store would make this schema a second
     * copy of it — one that goes stale the first time a week is re-cut.
     */
    done: {
      type: [{ type: String, trim: true, maxlength: MAX_ID }],
      default: [],
      validate: {
        validator: (list) => list.length <= MAX_TICKS,
        message: `A plan cannot have more than ${MAX_TICKS} ticked items`,
      },
    },

    /**
     * What happened, per week — the retro line that makes a plan honest.
     *
     * A Map rather than an array of `{ key, text }`, so writing one week's note
     * is a `$set` on its own path and two weeks cannot race each other's edits.
     */
    notes: {
      type: Map,
      of: { type: String, maxlength: 4000 },
      default: () => new Map(),
    },
  },
  { timestamps: true },
);

export const Playbook = mongoose.model('Playbook', playbookSchema);
