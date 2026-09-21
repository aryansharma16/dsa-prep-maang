import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';
import { interviewLevel } from './shapes.js';

export const doc = {
  blocks: [
    p(
      'The discovery half of the food problem. Where Swiggy\'s hard part is logistics, this one is **read-heavy search over a geography** — "good biryani near me, open now, under ₹400" — at a read-to-write ratio of about a thousand to one.',
    ),

    flow(['Client', 'CDN', 'Search', 'Geo filter', 'Rank', 'Cached listing'], 'Discovery path'),
    diagram(
      `
   THE QUERY IS THREE QUERIES AT ONCE

   "biryani"          ──▶ inverted index     (text relevance)
   "near me"          ──▶ geo index          (spatial filter)
   "open, ₹₹, 4.0+"   ──▶ structured filters (facets)

                    all three must intersect
                              │
                              ▼
              ┌───────────────────────────────┐
              │  ONE engine that does all      │  Elasticsearch-class:
              │  three: text + geo + facets    │  geo_distance filter
              └───────────────┬───────────────┘   on an inverted index
                              ▼
                        ~200 candidates
                              │
                              ▼
                  rank: relevance · distance ·
                        rating · popularity ·
                        delivery time
                              │
                              ▼
                         top 20 ──▶ cache
`,
      'Why it is not a database query',
    ),

    h('The pieces'),
    table(
      ['Piece', 'What it does', 'Why it is there'],
      [
        ['**Search index**', 'Text, geo and facets in one engine', 'The three filters must intersect — separate systems cannot'],
        ['**Restaurant store**', 'The authoritative record', 'Source of truth; the index is derived from it'],
        ['**Reviews / ratings**', 'User-generated, moderated', 'Write-heavy relative to the rest, and abuse-prone'],
        ['**Menu service**', 'Items, prices, photos', 'Large payloads; CDN-cached per restaurant'],
        ['**Feed service**', 'The ranked home list per zone', 'Precomputed — see below'],
        ['**Media**', 'Photos of everything', 'Object storage plus CDN; the bulk of the bytes'],
      ],
    ),

    h('The hard part — geo search that is also text search'),
    p(
      'You cannot do this in two steps. Filtering by distance first gives you every restaurant in 5km and then a text search over thousands; searching text first gives you every biryani place in the country. **The index has to hold both**, which is why a search engine with a geo filter is the right tool rather than a database plus an index.',
    ),
    table(
      ['Approach', 'Problem'],
      [
        ['Database `WHERE` + `LIKE`', 'No relevance, no fuzzy matching, and a full scan'],
        ['Geo filter, then text search', 'Thousands of candidates to score in the application'],
        ['Text search, then geo filter', 'Most results are in another city and get thrown away'],
        ['**One index with a geo filter**', 'Correct, and it is what search engines are built for'],
      ],
    ),
    tip(
      'The index is **derived data**, rebuilt from the restaurant store. That framing answers most follow-up questions at once: it can be rebuilt after corruption, it can lag by seconds, and it can be sharded differently from the source of truth.',
    ),

    h('The feed is precomputed'),
    diagram(
      `
   city divided into ZONES (a few km across)

   ┌──────┬──────┬──────┐    for each zone, hourly:
   │ z-01 │ z-02 │ z-03 │      rank every serviceable restaurant
   ├──────┼──────┼──────┤      cache the top ~200
   │ z-04 │ z-05 │ z-06 │            │
   ├──────┼──────┼──────┤            ▼
   │ z-07 │ z-08 │ z-09 │    user opens app
   └──────┴──────┴──────┘      ──▶ resolve address to zone
                               ──▶ read the cached list
   a user is in ONE zone.      ──▶ light personalisation on top
   their neighbours share
   the same cached list.       instant, and one cache entry
                               serves thousands of users.
`,
      'Zone, not coordinate',
    ),
    p(
      'Personalising per exact coordinate would mean a unique result set per user and a cache hit rate of zero. Rounding location to a **zone** makes the listing shared, cacheable and instant — and nobody can tell the difference between "ranked for my address" and "ranked for my neighbourhood".',
    ),

    h('Reviews and ratings'),
    table(
      ['Concern', 'Approach'],
      [
        ['Rating aggregate', 'Precompute; do not `AVG()` over thousands of rows per page view'],
        ['Fake reviews', 'Anomaly detection on rate, device and account age; weight verified orders higher'],
        ['Moderation', 'Async pipeline — publish optimistically, take down on a flag'],
        ['Recency', 'A weighted average that decays old reviews; a restaurant changes chef'],
        ['Cold start', 'Show the count alongside the score — 4.8 from 3 reviews is not 4.8'],
      ],
    ),
    warn(
      'Ratings are an **adversarial** system, not a statistical one. Restaurants have a direct financial interest in the number, so the design needs fraud detection in the pipeline rather than a trigger that maintains an average.',
    ),

    h('Scale'),
    table(
      ['Dimension', 'Order of magnitude', 'What breaks first'],
      [
        ['Read:write ratio', '**~1000:1**', 'Nothing — this is the easy shape'],
        ['Search QPS', 'Tens of thousands', 'The index tier; replicate it'],
        ['Restaurants', '~1–2M listed', 'Index size, which is small by search standards'],
        ['Photos', 'Hundreds of millions', 'Storage and CDN cost — the biggest line item'],
        ['Reviews', 'Hundreds of millions', 'Moderation throughput, not storage'],
        ['Menu updates', 'Constant during service', 'Index freshness — seconds of lag is fine'],
      ],
    ),

    h('When traffic spikes'),
    table(
      ['Event', 'What happens'],
      [
        ['Lunch and dinner peaks', 'Predictable; the zone feeds are already warm'],
        ['A festival or a match night', 'Pre-scale; more zones get switched to "surge" or closed'],
        ['A restaurant goes viral', 'One hot cache key. Fine — it is a read'],
        ['Index rebuild', 'Build into a new index and swap the alias; never rebuild in place'],
      ],
    ),

    h('Failures'),
    table(
      ['What dies', 'Effect', 'Mitigation'],
      [
        ['Search index', 'No search', 'Replicas; fall back to the cached zone feed, which covers most sessions'],
        ['Ranking service', 'Worse ordering', 'Sort by distance and rating — a reasonable fallback'],
        ['Reviews service', 'No reviews shown', 'Cosmetic; listings still work'],
        ['Menu service', 'Cannot open a restaurant page', 'Serve the last cached menu with a staleness note'],
        ['Restaurant store', 'No updates propagate', 'The index keeps serving; it is derived data'],
      ],
    ),
    tip(
      'Almost every row degrades to "serve something slightly stale". That is the luxury of a **read-heavy discovery system** — nothing here is a financial transaction, so stale is nearly always better than an error.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Geo-aware discovery and reviews, at a ~1000:1 read ratio'],
      ['The hard part', 'Text relevance, distance and facets intersecting in one query'],
      ['Key decision', 'One search engine holding text + geo + facets; feeds precomputed per zone'],
      ['Trade-off', 'Zone-level ranking loses per-address precision and buys a high cache hit rate'],
      [
        '30-second answer',
        '"Read-heavy at about a thousand to one, so almost everything is cached. The query is the hard part — text relevance, a distance filter and facets must intersect, which means one search engine holding all three rather than a database plus an index. The home feed is precomputed per zone rather than per coordinate, so one cached list serves a neighbourhood. The index is derived data, so it can lag and be rebuilt, and ratings are precomputed with fraud detection."',
      ],
    ]),
    asked([
      ['How do you search by text and location together?', 'One index that supports both — a geo filter applied alongside the inverted index, not two systems intersected.'],
      ['Why precompute per zone?', 'Per-coordinate ranking has a zero cache hit rate. A zone is indistinguishable to the user and shared by thousands.'],
      ['How do you keep ratings honest?', 'Weight verified orders, decay old reviews, and run anomaly detection. It is an adversarial system.'],
      ['What if the search index is down?', 'Serve the cached zone feed. Most sessions never type a query anyway.'],
      ['How is this different from Swiggy?', 'Same domain, different hard part — this is discovery and search; that is logistics and assignment.'],
    ]),

    interviewLevel('Zomato'),
    links(
      wiki('Inverted_index', 'Inverted index'),
      wiki('Geographic_information_system', 'Geographic information system'),
    ),
  ],
};
