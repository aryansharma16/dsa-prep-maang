import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from '../../guides/blocks.js';

export default {
  patternSlug: 'dsu',
  title: 'Disjoint Set Union',
  summary:
    'Merge sets and ask whether two things are in the same one, both in near-constant time. The right answer to a surprising number of problems that look nothing like sets.',
  blocks: [
    p(
      'DSU — union-find — maintains a partition of `n` items into disjoint sets under two operations: merge two sets, and ask which set an item is in. Thirty lines of code, effectively O(1) per operation, and it solves connectivity problems that would otherwise need a BFS per query.',
    ),
    p(
      'The reason it earns a place this early in the ladder is not the data structure. It is that an unusual number of problems turn out to be DSU problems once you find the right thing to call an "item". Cells in a grid, positions in a permutation, the two endpoints of a constraint, a value and its negation — a great deal of 1500–1900 is recognising that a statement about something else is really a statement about connected components.',
    ),
    p(
      'The one thing DSU cannot do is deletion. There is no un-union. That limitation is worth holding onto because it is also a hint: a problem with edge deletions is very often the same problem processed in reverse, where deletions become insertions.',
    ),

    h('When to reach for it'),
    ul(
      '"Are these two connected?" with edges only ever being added.',
      'Counting connected components as things merge.',
      "Kruskal's algorithm for minimum spanning trees.",
      'Detecting a cycle in an undirected graph as you read the edges.',
      'Grouping equal or equivalent items — "a == b" constraints, then checking consistency.',
      'Grid flood-fill where the merges arrive in arbitrary order rather than from a traversal.',
    ),
    warn(
      'Edges being *removed* is the signal that plain DSU does not apply. Either process the queries offline in reverse — deletions become unions — or reach for a link-cut tree, which is a different and much larger piece of code.',
    ),

    h('The implementation'),
    p(
      'Both optimisations, always. Path compression alone is fast in practice but has an O(log n) worst case that problems are built to hit; union by size alone is O(log n) too. Together they give the inverse-Ackermann bound, which for any input that fits in memory is under five.',
    ),
    code(
      java(`
class DSU {
    private final int[] parent, size;
    private int components;

    DSU(int n) {
        parent = new int[n];
        size = new int[n];
        components = n;
        for (int i = 0; i < n; i++) { parent[i] = i; size[i] = 1; }
    }

    // Iterative: a recursive find blows the stack on a 2e5-long chain
    // before compression has had a chance to flatten it.
    int find(int x) {
        int root = x;
        while (parent[root] != root) root = parent[root];
        while (parent[x] != root) { int next = parent[x]; parent[x] = root; x = next; }
        return root;
    }

    // Returns false if they were already together — that is the cycle check.
    boolean union(int a, int b) {
        int ra = find(a), rb = find(b);
        if (ra == rb) return false;
        if (size[ra] < size[rb]) { int t = ra; ra = rb; rb = t; }  // smaller into larger
        parent[rb] = ra;
        size[ra] += size[rb];
        components--;
        return true;
    }

    boolean connected(int a, int b) { return find(a) == find(b); }
    int componentSize(int x)        { return size[find(x)]; }
    int componentCount()            { return components; }
}
      `),
      cpp(`
struct DSU {
    vector<int> parent, sz;
    int components;

    DSU(int n) : parent(n), sz(n, 1), components(n) {
        iota(parent.begin(), parent.end(), 0);
    }

    int find(int x) {
        int root = x;
        while (parent[root] != root) root = parent[root];
        while (parent[x] != root) { int nxt = parent[x]; parent[x] = root; x = nxt; }
        return root;
    }

    bool unite(int a, int b) {
        int ra = find(a), rb = find(b);
        if (ra == rb) return false;
        if (sz[ra] < sz[rb]) swap(ra, rb);
        parent[rb] = ra;
        sz[ra] += sz[rb];
        components--;
        return true;
    }

    bool connected(int a, int b) { return find(a) == find(b); }
    int componentSize(int x)     { return sz[find(x)]; }
};
      `),
    ),
    tip(
      '`union` returning a boolean is what makes the structure useful beyond connectivity. `false` means "already in the same set", which is simultaneously the cycle detection for an undirected graph and the "skip this edge" test in Kruskal.',
    ),

    h('Per-component data'),
    p(
      'Anything you want to know about a component — its size, its sum, its minimum, how many marked nodes it holds — lives on the *root* and is merged when two roots join. Storing it on the wrong node is the most common way to get a subtly wrong answer here.',
    ),
    code(
      java(`
// Component sum, alongside the usual arrays.
long[] sum;                                    // sum[find(x)] is the real value

boolean union(int a, int b) {
    int ra = find(a), rb = find(b);
    if (ra == rb) return false;
    if (size[ra] < size[rb]) { int t = ra; ra = rb; rb = t; }
    parent[rb] = ra;
    size[ra] += size[rb];
    sum[ra]  += sum[rb];                       // merge INTO the surviving root
    return true;
}

long componentSum(int x) { return sum[find(x)]; }   // always read through find
      `),
      cpp(`
vector<long long> sum;                          // sum[find(x)] is the real value

bool unite(int a, int b) {
    int ra = find(a), rb = find(b);
    if (ra == rb) return false;
    if (sz[ra] < sz[rb]) swap(ra, rb);
    parent[rb] = ra;
    sz[ra]  += sz[rb];
    sum[ra] += sum[rb];
    return true;
}

long long componentSum(int x) { return sum[find(x)]; }
      `),
    ),
    warn(
      'Always read aggregates through `find(x)`, never as `sum[x]`. After a merge, `sum[x]` for a non-root `x` is stale — it holds whatever that node\'s component held before it was absorbed. The code compiles, runs, and quietly returns an old number.',
    ),

    h('Offline, in reverse'),
    p(
      'The standard escape from "DSU cannot delete". If the problem removes edges over time and asks for connectivity after each removal, read all the queries first, start from the final graph, and process the removals backwards as additions.',
    ),
    code(
      java(`
// Queries remove edges; answer connectivity after each removal.
// Build the graph as it stands AFTER every removal, then add them back.
DSU dsu = new DSU(n);
for (int[] e : survivingEdges) dsu.union(e[0], e[1]);

long[] answers = new long[removals.size()];
for (int i = removals.size() - 1; i >= 0; i--) {
    answers[i] = dsu.componentCount();          // state before this removal
    int[] e = removals.get(i);
    dsu.union(e[0], e[1]);                      // undo it by adding it back
}
      `),
      cpp(`
DSU dsu(n);
for (auto& [u, v] : survivingEdges) dsu.unite(u, v);

vector<long long> answers(removals.size());
for (int i = (int)removals.size() - 1; i >= 0; i--) {
    answers[i] = dsu.components;
    auto [u, v] = removals[i];
    dsu.unite(u, v);
}
      `),
    ),
    tip(
      'The same reversal trick applies to "the grid fills up over time, when does it become connected" — process from the full grid backwards, or from empty forwards, whichever direction makes the operation an addition.',
    ),

    h('DSU on values'),
    p(
      'The items do not have to be vertices. A useful trick for constraint problems: give each variable two nodes, `x` and `¬x`, and union them according to the constraints. If `x` and `¬x` ever land in the same component, the constraints are contradictory. The same doubling handles "these two must be different" on bipartite-style problems.',
    ),
    code(
      java(`
// n variables, 2n nodes: i is "x_i is A", i + n is "x_i is B".
DSU dsu = new DSU(2 * n);

void same(int a, int b)      { dsu.union(a, b); dsu.union(a + n, b + n); }
void different(int a, int b) { dsu.union(a, b + n); dsu.union(a + n, b); }

boolean consistent(int n, DSU dsu) {
    for (int i = 0; i < n; i++) if (dsu.connected(i, i + n)) return false;
    return true;
}
      `),
      cpp(`
// n variables, 2n nodes: i is "x_i is A", i + n is "x_i is B".
DSU dsu(2 * n);

auto same      = [&](int a, int b) { dsu.unite(a, b); dsu.unite(a + n, b + n); };
auto different = [&](int a, int b) { dsu.unite(a, b + n); dsu.unite(a + n, b); };

bool consistent(int n, DSU& dsu) {
    for (int i = 0; i < n; i++) if (dsu.connected(i, i + n)) return false;
    return true;
}
      `),
    ),

    h('Common traps'),
    table(
      ['Symptom', 'Cause'],
      [
        ['Stack overflow', 'Recursive `find` on a long chain. Use the iterative version.'],
        ['TLE on a worst-case test', 'Only one of the two optimisations. Use both.'],
        ['Component data is wrong after merges', 'Read `sum[x]` instead of `sum[find(x)]`.'],
        ['Component count never changes', '`union` incrementing on the already-connected path.'],
        ['Cycle detection reports too many cycles', 'Counting each undirected edge twice.'],
        ['Wrong answer with deletions', 'DSU cannot delete. Process offline in reverse.'],
        ['Index out of bounds', '1-indexed input into a 0-indexed DSU. Size it n+1 and ignore 0.'],
      ],
    ),

    h('Complexity'),
    table(
      ['Version', 'Per operation'],
      [
        ['Neither optimisation', 'O(n) worst case'],
        ['Path compression only', 'O(log n) amortised'],
        ['Union by size only', 'O(log n) worst case'],
        ['Both', 'O(α(n)) amortised — under 5 for any real n'],
      ],
    ),
    p(
      'Memory is O(n): two integer arrays, plus one more per aggregate you track. Building a DSU over 10^6 nodes is entirely routine.',
    ),

    links(
      link('Disjoint Set Union — cp-algorithms', 'https://cp-algorithms.com/data_structures/disjoint_set_union.html'),
      link('Disjoint Set Union — USACO Guide', 'https://usaco.guide/gold/dsu'),
      link("Kruskal's with DSU — cp-algorithms", 'https://cp-algorithms.com/graph/mst_kruskal_with_dsu.html'),
    ),
  ],
};
