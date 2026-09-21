import { asked, code, diagram, h, js, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Consistent hashing answers one question: **how do you add or remove a node without moving all the data?** With plain modulo hashing, changing the node count remaps almost every key. With consistent hashing, it remaps roughly `1/N` of them.',
    ),

    h('The problem'),
    diagram(
      `
   hash(key) % N

   N = 4                            N = 5  (one node added)
   ──────────────                   ──────────────────────
   k=100 ──▶ 100 % 4 = 0            k=100 ──▶ 100 % 5 = 0   same
   k=101 ──▶ 101 % 4 = 1            k=101 ──▶ 101 % 5 = 1   same
   k=102 ──▶ 102 % 4 = 2            k=102 ──▶ 102 % 5 = 2   same
   k=103 ──▶ 103 % 4 = 3            k=103 ──▶ 103 % 5 = 3   same
   k=104 ──▶ 104 % 4 = 0            k=104 ──▶ 104 % 5 = 4   MOVED
   k=105 ──▶ 105 % 4 = 1            k=105 ──▶ 105 % 5 = 0   MOVED
   ...

   in general: ~(N-1)/N of all keys move.
   going from 4 to 5 nodes relocates ~80% of the data.

   for a CACHE, that is a near-total miss storm.
   for a DATABASE, it is a migration.
`,
      'Why modulo is unusable for a changing cluster',
    ),

    h('The ring'),
    diagram(
      `
   hash nodes AND keys onto the same circle (0 .. 2³²-1).
   a key belongs to the FIRST node clockwise from it.

                      0
                      │
              k4 ●    │    ○ N1
                  ╲   │   ╱
           N3 ○    ╲  │  ╱     ● k1
                ╲   ╲ │ ╱     ╱
                 ╲   ╲│╱     ╱
   ──────────────────●●─────────────────
                    ╱ │ ╲
             k3 ●  ╱  │  ╲   ○ N2
                  ╱   │   ╲
                      │      ● k2

   k1 ──▶ N2   (first node clockwise)
   k2 ──▶ N3
   k3 ──▶ N1
   k4 ──▶ N1

   REMOVE N2:  only k1 moves, to N3.
               k2, k3, k4 are untouched.

   ADD N4 between N1 and N2: only the keys in that
               arc move. everything else stays put.
`,
      'Add or remove, and only one arc is affected',
    ),
    table(
      ['Operation', 'Modulo', 'Consistent hashing'],
      [
        ['Add a node', '~All keys move', '**~1/N keys move**'],
        ['Remove a node', '~All keys move', '**Only that node\'s keys move**'],
        ['Lookup cost', 'O(1)', 'O(log N) — a binary search over the ring'],
        ['Distribution', 'Perfectly even', 'Uneven without virtual nodes'],
      ],
    ),

    h('Virtual nodes'),
    p(
      'With one point per node, a ring of five nodes gives five arcs of wildly different sizes — one node can easily own 40% of the keyspace. **Virtual nodes fix this by placing each physical node at many points**, so the arcs average out.',
    ),
    diagram(
      `
   1 POINT PER NODE                 150 POINTS PER NODE

   N1 ████████████████████ 41%      N1 ███████ 20.4%
   N2 ██ 5%                         N2 ███████ 19.7%
   N3 ████████ 18%                  N3 ███████ 20.1%
   N4 ██████████ 24%                N4 ███████ 19.9%
   N5 █████ 12%                     N5 ███████ 19.9%

   random placement is LUMPY.        law of large numbers
   ✗ one node does 8x another        ✓ within a percent or two

   virtual nodes also let you WEIGHT:
     a machine with twice the RAM gets twice the points.
`,
      'Why ~100-200 points per node is standard',
    ),
    code(
      js(`
// The ring, in about fifteen lines.
class Ring {
  constructor(nodes, vnodes = 150) {
    this.vnodes = vnodes;
    this.ring = [];          // sorted [{ hash, node }]
    nodes.forEach((n) => this.add(n));
  }

  add(node) {
    for (let i = 0; i < this.vnodes; i += 1) {
      this.ring.push({ hash: hash(\`\${node}#\${i}\`), node });
    }
    this.ring.sort((a, b) => a.hash - b.hash);
  }

  remove(node) {
    this.ring = this.ring.filter((p) => p.node !== node);
  }

  // First point clockwise from the key, wrapping at the end.
  get(key) {
    const h = hash(key);
    let lo = 0;
    let hi = this.ring.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.ring[mid].hash < h) lo = mid + 1;
      else hi = mid;
    }
    return this.ring[this.ring[lo].hash < h ? 0 : lo].node;
  }
}
`),
    ),

    h('Where it is used'),
    table(
      ['System', 'What it partitions'],
      [
        ['**Memcached / Redis Cluster**', 'Keys across cache nodes — the original motivation'],
        ['**Cassandra, DynamoDB, Riak**', 'Rows across storage nodes, plus replica placement'],
        ['**CDNs**', 'Objects across edge servers within a POP'],
        ['**Load balancers**', 'Sticky routing that survives adding a backend'],
        ['**Sharded databases**', 'The shard map, when it is not a directory'],
      ],
    ),
    tip(
      'Replication falls out of the ring naturally: to keep three copies, store the key on the **next three distinct physical nodes clockwise**. That is exactly what Dynamo-style stores do, and it means replica placement needs no separate mechanism.',
    ),

    h('What it does not solve'),
    table(
      ['Problem', 'Why consistent hashing does not help'],
      [
        ['**A hot key**', 'One key is one point on the ring. It lands on one node regardless'],
        ['**Uneven key sizes**', 'Even key distribution is not even byte distribution'],
        ['**Data movement itself**', 'It minimises how much moves; the moving still has to happen'],
        ['**Range queries**', 'Hashing destroys ordering by design'],
      ],
    ),
    warn(
      'The first row catches people out. Consistent hashing gives you an even spread of **keys**, which does nothing for one key receiving a million requests a second. Hot keys need replication or a key suffix — a different problem with a different fix.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Mapping keys to nodes so that adding or removing one moves ~1/N of them'],
      ['Why it exists', 'Modulo hashing remaps nearly everything when the node count changes'],
      ['Use when', 'Distributed caches, leaderless stores, sticky routing — anywhere the cluster resizes'],
      ['Trade-off', 'Minimal reshuffling, at the cost of O(log N) lookup and needing virtual nodes to be fair'],
      [
        '30-second answer',
        '"With hash mod N, adding a node remaps almost every key — a total cache miss storm. Consistent hashing puts nodes and keys on the same circle and assigns each key to the first node clockwise, so adding or removing a node only affects one arc: about 1/N of keys. Each physical node is placed at 100-200 virtual points so the arcs are even and can be weighted. Replication comes free — the next N distinct nodes clockwise. It does not fix hot keys, though; that is a different problem."',
      ],
    ]),
    asked([
      ['Why not hash(key) % N?', 'Changing N remaps roughly (N-1)/N of all keys. Going from 4 nodes to 5 moves about 80% of the data.'],
      ['What do virtual nodes solve?', 'Uneven arc sizes. One point per node gives a lumpy distribution; 150 points averages it out.'],
      ['How much data moves when a node is added?', 'About 1/N of the keys — only the arc the new node takes over.'],
      ['How does replication work on a ring?', 'Store the key on the next N distinct physical nodes clockwise.'],
      ['Does it fix hot keys?', 'No. One key is one ring point. Hot keys need replication or a suffix.'],
    ]),

    links(
      wiki('Consistent_hashing', 'Consistent hashing'),
      wiki('Rendezvous_hashing', 'Rendezvous hashing'),
    ),
  ],
};
