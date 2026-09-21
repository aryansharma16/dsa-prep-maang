import { asked, h, links, p, quick, table, tip, tradeoff, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Every major trade-off in one line, and the dozen mistakes that actually cost people the round. **There are no free choices in system design** — an answer that lists only the upside of something is the answer that gets pushed on.',
    ),

    h('Data'),
    tradeoff([
      ['**SQL**', 'Joins, transactions, constraints, one obvious query language', 'Harder to scale writes past one primary'],
      ['**NoSQL**', 'Horizontal writes, flexible schema, predictable at scale', 'No joins, no cross-document transactions, you own consistency'],
      ['**Normalised**', 'One copy of the truth, cheap and safe writes', 'Reads become joins, and joins do not shard'],
      ['**Denormalised**', 'A read is one lookup', 'Every write fans out; data can disagree with itself'],
      ['**Strong consistency**', 'Never a wrong answer', 'Latency, and unavailability during a partition'],
      ['**Eventual consistency**', 'Stays up, stays fast, scales', 'Users can read stale data, and you must design for it'],
      ['**Sharding**', 'Writes and volume scale out', 'No cross-shard joins, hotspots, resharding is a project'],
      ['**Read replicas**', 'Cheap read capacity, easy to add', 'Replica lag; zero help for writes'],
    ]),

    h('Caching'),
    tradeoff([
      ['**Cache-aside**', 'Simple, cache failure is survivable', 'First request is always slow; two paths to keep in step'],
      ['**Write-through**', 'Cache is never stale', 'Every write costs two writes'],
      ['**Write-behind**', 'Fast writes, batched to the store', 'A crash loses writes that were acknowledged'],
      ['**Long TTL**', 'Higher hit rate, less load', 'More stale reads'],
      ['**Short TTL**', 'Fresher data', 'More misses, more origin load, stampede risk'],
      ['**CDN**', 'Bytes never reach you; the user is closer', 'Purging is slow; personalised content cannot be cached'],
    ]),

    h('Communication'),
    tradeoff([
      ['**Synchronous**', 'Simple, immediate answer, easy to debug', 'Caller waits; a failure downstream is a failure upstream'],
      ['**Asynchronous**', 'Absorbs spikes, decouples failure, scales', 'Eventual results, duplicates, and a backlog to operate'],
      ['**REST**', 'Universal, cacheable, debuggable with curl', 'Chatty, over-fetches, no schema by default'],
      ['**gRPC**', 'Fast, typed, streaming, small on the wire', 'Not browser-native, harder to inspect'],
      ['**GraphQL**', 'One round trip, the client asks for what it needs', 'Caching is hard, and one query can be very expensive'],
      ['**WebSockets**', 'True bidirectional push, low per-message cost', 'Stateful connections, harder to scale and to load balance'],
      ['**Polling**', 'Trivial, works everywhere, stateless', 'Wasted requests, or latency — pick one'],
    ]),

    h('Services'),
    tradeoff([
      ['**Monolith**', 'One deploy, real transactions, easy to debug', 'Teams block each other; everything scales together'],
      ['**Microservices**', 'Independent deploys and scaling, clear ownership', 'Network failure, distributed transactions, much harder to trace'],
      ['**Orchestration**', 'The flow is written down in one place', 'A central component that everything depends on'],
      ['**Choreography**', 'No coordinator, services stay decoupled', 'Nobody knows the whole flow; debugging is archaeology'],
      ['**Retries**', 'Transient failures disappear', 'Duplicate work, and a retry storm makes an outage worse'],
      ['**Circuit breaker**', 'A failing dependency stops taking you down', 'Requests fail fast that might have succeeded'],
    ]),

    h('Scale and cost'),
    tradeoff([
      ['**Vertical scaling**', 'No code changes, no distributed anything', 'A hard ceiling, and one machine to lose'],
      ['**Horizontal scaling**', 'No ceiling, redundancy comes with it', 'State has to go somewhere; coordination costs'],
      ['**Autoscaling**', 'Pay for what you use', 'Too slow for a sharp spike; thrashes if tuned badly'],
      ['**Pre-scaling**', 'Survives a known spike', 'You pay for the peak all the time'],
      ['**Multi-region**', 'Survives a region loss, users are closer', 'Doubles cost, and forces you to solve replication'],
      ['**Single region**', 'Simple, cheap, consistent', 'One outage away from total downtime'],
    ]),

    h('AI systems'),
    tradeoff([
      ['**Batch inference**', 'Cheap, high GPU utilisation, predictable', 'Predictions are stale; no answer for unseen input'],
      ['**Real-time inference**', 'Always fresh, handles anything', 'Expensive, latency-sensitive, hard to autoscale'],
      ['**Bigger model**', 'Better answers', 'More latency, more cost per request, less concurrency'],
      ['**RAG**', 'Fresh knowledge without retraining, citable', 'Retrieval quality becomes the ceiling on answer quality'],
      ['**Fine-tuning**', 'Learns tone and format, shorter prompts', 'Retraining to update facts; no citations'],
      ['**Semantic cache**', 'Big cost and latency savings', 'Two questions that look similar may need different answers'],
    ]),

    h('The mistakes that actually cost the round'),
    table(
      ['#', 'Mistake', 'Do instead'],
      [
        ['1', 'Drawing before asking anything', 'Five minutes of requirements. Every time.'],
        ['2', 'Designing all of Twitter', 'Cut the scope out loud and get agreement'],
        ['3', 'Opening with Kafka, Kubernetes and sharding', 'Start simple; add each piece when something forces it'],
        ['4', 'Estimating, then never using the number', 'Say what it implies: "10:1 read-heavy, so this is a caching problem"'],
        ['5', 'Naming a technology you cannot explain', 'Say what it does for you here, or do not name it'],
        ['6', 'Silence while thinking', 'Narrate. The reasoning is the deliverable'],
        ['7', 'Only listing benefits', 'Every choice gets a cost attached, unprompted'],
        ['8', 'Breadth with no depth', 'Stop drawing at minute 30 and go three levels into one thing'],
        ['9', 'Ignoring a hint', 'When the interviewer asks about X twice, X is the round'],
        ['10', 'Hand-waving the hard part', 'Name it as hard, then take a position anyway'],
        ['11', 'No failure story', 'Say what happens when each component dies'],
        ['12', 'Never mentioning monitoring', 'One sentence: what you would alert on'],
        ['13', 'Arguing when pushed back on', 'Consider it genuinely. Changing your mind for a good reason scores well'],
        ['14', 'Running out of time mid-sentence', 'Watch the clock; leave five minutes to wrap up'],
      ],
    ),
    warn(
      'Number 9 is the one that quietly ends interviews. If you are asked about the same component twice, the interviewer is not curious — they are **giving you the answer to the question they wanted to ask**, and moving on is refusing it.',
    ),

    h('Sentences that score'),
    table(
      ['Instead of', 'Say'],
      [
        ['"I would use Kafka."', '"I would put a queue here so a spike does not reach the database. Kafka if we need replay, SQS if we do not."'],
        ['"Add a cache."', '"This read is 10:1 and tolerates 30 seconds of staleness, so it caches well."'],
        ['"It scales."', '"It scales to about 50,000 QPS on this shape; past that the fan-out worker goes first."'],
        ['"Use microservices."', '"I would keep this a monolith. Two teams and one deploy a day — splitting buys nothing yet."'],
        ['"Strong consistency."', '"Balances need strong consistency. Timelines do not, and that is where the scale comes from."'],
      ],
    ),
    tip(
      'The pattern in all five: **a number or a condition attached to the choice.** That is the entire difference between sounding like someone who has read about this and someone who has done it.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'The trade-offs in one line each, and the common failure modes'],
      ['Why it matters', 'Being pushed on a choice is the round; having the cost ready is the answer'],
      ['Use when', 'Revising the night before, and whenever asked "why that one?"'],
      ['Trade-off', 'Condensed enough to skim, so none of it is the full argument'],
      [
        '30-second answer',
        '"There are no free choices. SQL trades write scale for joins and transactions; caching trades freshness for load; async trades immediacy for absorbing spikes; microservices trade simplicity for independent deploys. The failure mode is naming the upside and not the cost — so I try to state both before being asked."',
      ],
    ]),
    asked([
      ['Why did you choose that?', 'Name the requirement it satisfies and the cost it carries. Never just the benefit.'],
      ['What would you do differently at 10x?', 'Have one answer ready per component. It is asked almost every round.'],
      ['What is the weakest part of this design?', 'Answer honestly. Deflecting scores worse than the weakness does.'],
      ['Is there a simpler design?', 'Usually yes, and saying so is not a concession — it is the judgement being tested.'],
      ['What is the biggest interview mistake?', 'Designing before understanding the requirements.'],
    ]),

    links(wiki('Trade-off', 'Trade-off'), wiki('CAP_theorem', 'CAP theorem')),
  ],
};
