import mongoose from 'mongoose';

/**
 * One Learn track — Complexity, React, Node.js, SQL — and its table of contents.
 *
 * Sections are embedded rather than given a collection. There are 33 of them in
 * total, at most 13 on a track, four scalars each, and nothing will ever ask for
 * a section without the track around it. That is the shape this app already
 * embeds elsewhere (`CPPattern.brief`, `SqlProblem.source`).
 *
 * `key` is a plain string and not a subdoc `_id`, which is the one thing worth
 * being careful about here: the seeder rewrites this array wholesale on every
 * run, so a generated id would be a *new* id each time — a pointer that looks
 * stable and moves. `LearnTopic.section` joins on the key.
 *
 * ---------------------------------------------------------------------------
 * What is not here, and cannot be.
 *
 * `Icon`. The client registry carried a React component per track, and there is
 * no encoding of a component that survives a fetch. The database stores nothing
 * for it; `client/src/learn/tracks.js` keeps a slug → component map and resolves
 * it on arrival, the same trick `store/modules.js` plays for the side menu.
 * ---------------------------------------------------------------------------
 */

const sectionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true, maxlength: 64 },
    title: { type: String, required: true, maxlength: 120 },
    blurb: { type: String, default: '', maxlength: 400 },
    /** Reading order. Derived from array position by the seeder, never authored. */
    order: { type: Number, required: true },
  },
  { _id: false },
);

const learnTrackSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true, maxlength: 64 },
    name: { type: String, required: true, maxlength: 60 },

    /**
     * A name out of the palette in tokens.css — `violet`, `sky`, `green`,
     * `amber` — and never a colour value. The pages hand it to `data-hue` and
     * one word resolves the ambient wash, the icon tile, the meters and the
     * side rail; storing `#a78bfa` here would mean the light theme could not
     * re-step it through the block that re-steps every other hue in the app.
     */
    hue: { type: String, default: 'violet', maxlength: 24 },

    /**
     * The card's icon, as a *name* — `clock`, `layers`, `globe`, `table`.
     *
     * The registry used to hold a React component here, which is the one field
     * of a track that no JSON response can carry. So the database stores the
     * name and `client/src/learn/tracks.js` maps it back to a component on
     * arrival, the same trick `store/modules.js` plays for the side menu.
     *
     * Storing it at all — rather than having the client key its icon map on the
     * track slug — is what lets a fifth track added here show up with the right
     * icon and no deploy. An unknown name resolves to a generic icon rather
     * than crashing the hub; see `trackIcon`.
     */
    icon: { type: String, default: '', maxlength: 32 },

    /**
     * `soon` tracks are listed on purpose rather than hidden — a hub showing
     * what is coming reads as a plan, one showing a single item reads as
     * abandoned. It is the only thing that decides whether a card is a link.
     */
    status: { type: String, enum: ['live', 'soon'], default: 'live' },
    order: { type: Number, required: true },

    /*
      Two strings, both in use, and neither derivable from the other: `blurb` is
      what the hub card says, `summary` is what the track page's hero says. They
      came from two different files and they are written for two different
      moments — one is an advertisement, the other is an introduction.
    */
    blurb: { type: String, default: '', maxlength: 600 },
    summary: { type: String, default: '', maxlength: 800 },

    sections: { type: [sectionSchema], default: [] },

    /** Same contract as PatternGuide.editedAt — the seeder leaves edits alone. */
    editedAt: { type: Date, default: null },
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    seededAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const LearnTrack = mongoose.model('LearnTrack', learnTrackSchema);
