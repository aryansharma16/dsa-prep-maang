import mongoose from 'mongoose';
import { guideBlockSchema } from './schemas/guideBlock.js';

/**
 * One Learn topic — the words, and everything the catalogue needs to list it.
 *
 * The block vocabulary is `schemas/guideBlock.js`, reused verbatim and with no
 * additions. That is worth stating plainly because it is the reason this move
 * was cheap: all 5,495 blocks across the four tracks are already one of the nine
 * types that schema knows. `sig`, `cheat` and `asked` are a `table` with the
 * header row filled in; `data` and `result` are a `table` with `caption` and
 * `variant` set — and those two fields were added to that schema *for this
 * content*, before there was anywhere to put it. `lang` is a free-form string,
 * so `sh`, `sql`, `mysql` and `postgres` needed nothing at all.
 *
 * A separate collection from `LearnTrack`, for the reason `PatternGuide` gives
 * for not being a field on `Pattern`: the catalogue reads every topic's
 * metadata and none of their prose. Embedded, the Node track alone would be a
 * ~590KB document that every hub load pulls off disk to render a progress bar.
 *
 * ---------------------------------------------------------------------------
 * Identity is `{ track, slug }`, and `LearnProgress` still keys on the same
 * pair rather than a ref to `_id`.
 *
 * That looks like the timid choice now that there is finally a document to
 * point at, and it is not. A ref has to be backfilled, and the rows that cannot
 * be — the ones whose slug was renamed at some point — are exactly the rows the
 * ref was meant to protect. It fixes them by losing them.
 *
 * `slugHistory` is the version of that idea which works, and it is strictly
 * larger: the read endpoint resolves an old slug to its canonical one, so a
 * rename also stops breaking bookmarks, roadmap links and
 * `SqlProblem.learnTopic` — none of which a ref from `LearnProgress` would have
 * helped. Nothing is migrated, and the hot write path stays one query.
 * ---------------------------------------------------------------------------
 */
const learnTopicSchema = new mongoose.Schema(
  {
    track: { type: String, required: true, trim: true, maxlength: 64 },
    slug: { type: String, required: true, trim: true, maxlength: 128 },
    /** `LearnTrack.sections[].key`. Denormalised — see that model on why. */
    section: { type: String, required: true, maxlength: 64 },

    /**
     * Reading order within the track, 0-based and contiguous *across* sections.
     *
     * Derived from array position by the seeder and never authored, because it
     * is two guarantees in one number: this is the sequence prev/next walks and
     * the sequence the section headings group. The old `flatTopics` made them
     * agree by construction — it walked the same array the page rendered — and
     * this is what replaces that guarantee now the array is rows in a database.
     */
    order: { type: Number, required: true },

    /** A `draft` topic is seeded and invisible — the catalogue only lists live. */
    status: { type: String, enum: ['live', 'draft'], default: 'live' },

    title: { type: String, required: true, maxlength: 160 },
    summary: { type: String, default: '', maxlength: 400 },
    tags: { type: [String], default: [] },

    /**
     * What the Ask-AI buttons offer on this topic. Three at most — they are a
     * nudge past the blank composer, not a FAQ.
     */
    ask: { type: [String], default: [] },

    blocks: { type: [guideBlockSchema], default: [] },

    /* ---------------------------------------------------------------------
       Derived. Written only by `summarise()` in services/learn.content.js,
       which both the seeder and the admin save go through — one writer, so
       there is one place that can forget to recompute rather than two.
       --------------------------------------------------------------------- */

    /**
     * The prose, flattened, for searching the body of a topic rather than its
     * title.
     *
     * `select: false` because it is 866KB across the collection and no reader
     * wants it — the search that needs it asks for it by name. Code blocks are
     * excluded on purpose: a search that matches `const` and `SELECT` in most
     * of the corpus is not a search, it is a list of every topic.
     */
    plaintext: { type: String, default: '', select: false },
    wordCount: { type: Number, default: 0 },
    readingMinutes: { type: Number, default: 0 },

    /**
     * Where a topic sits in the curriculum this app is actually for.
     *
     * Slugs rather than refs, matching `SqlProblem.learnTopic`, and validated
     * at seed time the way `seed/guides.js` validates its pattern slugs. Only
     * one direction is stored — the reverse is
     * `LearnTopic.find({ 'related.patterns': slug })` on an indexed field, and
     * a second array would be a second thing to keep true.
     */
    related: {
      patterns: { type: [String], default: [] },
      problems: { type: [String], default: [] },
    },

    /** Slugs this topic used to answer to, oldest first. See the note above. */
    slugHistory: { type: [String], default: [] },

    /**
     * Bumped on every write. Two jobs, both small: it is the topic's ETag, and
     * it is what an editor would compare to notice it is saving over someone
     * else's copy.
     *
     * Deliberately *not* what busts the catalogue — a version per topic cannot
     * answer "has anything changed", and a global counter is a thing someone
     * forgets to bump. The catalogue uses `max(updatedAt)` and a document
     * count, which are both correct by construction.
     */
    version: { type: Number, default: 1 },

    editedAt: { type: Date, default: null },
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    seededAt: { type: Date, default: null },
  },
  { timestamps: true },
);

/** Identity. Every read, every upsert and the rename check rely on this. */
learnTopicSchema.index({ track: 1, slug: 1 }, { unique: true });
/** A track's list, in reading order — the catalogue's sort. */
learnTopicSchema.index({ track: 1, order: 1 });
/** The catalogue's ETag stamp: max(updatedAt) over live topics, index-only. */
learnTopicSchema.index({ status: 1, updatedAt: -1 });
/** Resolving a bookmark to a slug that has since been renamed. */
learnTopicSchema.index({ track: 1, slugHistory: 1 });
/** "Which topics teach this pattern" — the reverse of related.patterns. */
learnTopicSchema.index({ 'related.patterns': 1 });

export const LearnTopic = mongoose.model('LearnTopic', learnTopicSchema);
