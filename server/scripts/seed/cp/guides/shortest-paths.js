import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from '../../guides/blocks.js';

export default {
  patternSlug: 'shortest-paths',
  title: 'Shortest Paths',
  summary:
    'Dijkstra for non-negative weights, 0-1 BFS for weights in {0,1}, Bellman–Ford for negatives, Floyd–Warshall for all pairs. Picking correctly is most of the work.',
  blocks: [
    p(
      'There are four shortest-path algorithms worth carrying, and the interesting decision is which one the problem is asking for. That decision is made almost entirely by the edge weights: all equal means BFS, all in {0,1} means a deque, all non-negative means Dijkstra, any negative means Bellman–Ford, and "every pair" with a small vertex count means Floyd–Warshall.',
    ),
    p(
      "Dijkstra's correctness rests on one claim: when a vertex is popped from the priority queue, its distance is final. That holds because every remaining path to it must go through something already at least as far away, and edges only add non-negative amounts. A single negative edge breaks that argument — and Dijkstra does not detect the breakage, it simply returns wrong numbers.",
    ),
    p(
      'The other half of this pattern is modelling. A great many problems are shortest paths over a state space that is not the vertex set — (vertex, fuel remaining), (cell, keys held), (position, parity of moves). The algorithm never changes; only what you call a node does.',
    ),

    h('Choosing'),
    table(
      ['Weights', 'Algorithm', 'Complexity'],
      [
        ['All equal', 'BFS', 'O(V + E)'],
        ['All 0 or 1', '0-1 BFS with a deque', 'O(V + E)'],
        ['Non-negative', 'Dijkstra with a heap', 'O(E log V)'],
        ['Any negative, need detection', 'Bellman–Ford', 'O(V·E)'],
        ['All pairs, V ≤ ~500', 'Floyd–Warshall', 'O(V^3)'],
        ['All pairs, sparse, non-negative', 'Dijkstra from every source', 'O(V·E log V)'],
      ],
    ),

    h('Dijkstra'),
    p(
      'The lazy version — push duplicates, skip stale entries on pop. It is shorter than a decrease-key implementation, and the `if (d > dist[u]) continue;` line is what keeps it correct and fast.',
    ),
    code(
      java(`
// adj[u] holds int[]{v, weight}. Returns distances from src; Long.MAX_VALUE if unreachable.
long[] dijkstra(List<int[]>[] adj, int n, int src) {
    final long INF = Long.MAX_VALUE / 4;      // divisible headroom: INF + w must not wrap
    long[] dist = new long[n + 1];
    Arrays.fill(dist, INF);
    dist[src] = 0;

    // (distance, vertex), ordered by distance.
    PriorityQueue<long[]> pq = new PriorityQueue<>((x, y) -> Long.compare(x[0], y[0]));
    pq.add(new long[]{0, src});

    while (!pq.isEmpty()) {
        long[] top = pq.poll();
        long d = top[0];
        int u = (int) top[1];
        if (d > dist[u]) continue;            // stale entry — this is the whole trick
        for (int[] e : adj[u]) {
            int v = e[0];
            long nd = d + e[1];
            if (nd < dist[v]) { dist[v] = nd; pq.add(new long[]{nd, v}); }
        }
    }
    return dist;
}
      `),
      cpp(`
vector<long long> dijkstra(vector<vector<pair<int,int>>>& adj, int n, int src) {
    const long long INF = LLONG_MAX / 4;
    vector<long long> dist(n + 1, INF);
    dist[src] = 0;

    priority_queue<pair<long long,int>, vector<pair<long long,int>>,
                   greater<>> pq;             // min-heap
    pq.push({0, src});

    while (!pq.empty()) {
        auto [d, u] = pq.top(); pq.pop();
        if (d > dist[u]) continue;
        for (auto [v, w] : adj[u]) {
            long long nd = d + w;
            if (nd < dist[v]) { dist[v] = nd; pq.push({nd, v}); }
        }
    }
    return dist;
}
      `),
    ),
    warn(
      'Two things kill Dijkstra submissions. Without `if (d > dist[u]) continue;` the queue re-expands settled vertices and the complexity degrades badly. And an `INF` of `LLONG_MAX` overflows the instant you compute `d + w` on an unreachable vertex — use `LLONG_MAX / 4`, or skip unreachable vertices explicitly.',
    ),
    warn(
      'A negative edge anywhere means Dijkstra is the wrong algorithm. It will not crash and it will not warn you; it will return numbers that are too large, for the vertices reachable through the negative edge.',
    ),

    h('0-1 BFS'),
    p(
      'When every weight is 0 or 1, the priority queue is unnecessary. A deque suffices: a zero-weight edge puts the vertex at the front, a one-weight edge at the back. The deque stays sorted by distance for free, and the whole thing is linear.',
    ),
    code(
      java(`
// Weights are 0 or 1 only.
int[] zeroOneBfs(List<int[]>[] adj, int n, int src) {
    final int INF = Integer.MAX_VALUE / 2;
    int[] dist = new int[n + 1];
    Arrays.fill(dist, INF);
    dist[src] = 0;

    ArrayDeque<Integer> dq = new ArrayDeque<>();
    dq.addFirst(src);
    while (!dq.isEmpty()) {
        int u = dq.pollFirst();
        for (int[] e : adj[u]) {
            int v = e[0], w = e[1];
            if (dist[u] + w >= dist[v]) continue;
            dist[v] = dist[u] + w;
            if (w == 0) dq.addFirst(v);       // free move — front
            else        dq.addLast(v);        // costs one — back
        }
    }
    return dist;
}
      `),
      cpp(`
vector<int> zeroOneBfs(vector<vector<pair<int,int>>>& adj, int n, int src) {
    const int INF = INT_MAX / 2;
    vector<int> dist(n + 1, INF);
    dist[src] = 0;

    deque<int> dq;
    dq.push_front(src);
    while (!dq.empty()) {
        int u = dq.front(); dq.pop_front();
        for (auto [v, w] : adj[u]) {
            if (dist[u] + w >= dist[v]) continue;
            dist[v] = dist[u] + w;
            if (w == 0) dq.push_front(v);
            else        dq.push_back(v);
        }
    }
    return dist;
}
      `),
    ),
    tip(
      'The classic disguise: a grid where moving in your current direction is free and turning costs one, or where breaking a wall costs one and walking is free. "Minimum number of X" over a grid with two move costs is 0-1 BFS almost every time.',
    ),

    h('State-augmented graphs'),
    p(
      'The modelling half. If the cost depends on something beyond which vertex you are at, that something joins the node identity. Nothing about Dijkstra changes — the graph is just bigger.',
    ),
    code(
      java(`
// Shortest path where you may skip the cost of up to K edges.
// Node is (vertex, skips used). Same Dijkstra, wider state.
long[][] dist = new long[n + 1][K + 1];
for (long[] row : dist) Arrays.fill(row, INF);
dist[src][0] = 0;

PriorityQueue<long[]> pq = new PriorityQueue<>((x, y) -> Long.compare(x[0], y[0]));
pq.add(new long[]{0, src, 0});
while (!pq.isEmpty()) {
    long[] top = pq.poll();
    long d = top[0]; int u = (int) top[1], used = (int) top[2];
    if (d > dist[u][used]) continue;
    for (int[] e : adj[u]) {
        int v = e[0], w = e[1];
        if (d + w < dist[v][used]) {                       // pay for it
            dist[v][used] = d + w;
            pq.add(new long[]{d + w, v, used});
        }
        if (used < K && d < dist[v][used + 1]) {           // skip it
            dist[v][used + 1] = d;
            pq.add(new long[]{d, v, used + 1});
        }
    }
}
      `),
      cpp(`
vector<vector<long long>> dist(n + 1, vector<long long>(K + 1, INF));
dist[src][0] = 0;

priority_queue<array<long long,3>, vector<array<long long,3>>, greater<>> pq;
pq.push({0, src, 0});
while (!pq.empty()) {
    auto [d, u64, used64] = pq.top(); pq.pop();
    int u = u64, used = used64;
    if (d > dist[u][used]) continue;
    for (auto [v, w] : adj[u]) {
        if (d + w < dist[v][used]) {
            dist[v][used] = d + w;
            pq.push({d + w, v, (long long)used});
        }
        if (used < K && d < dist[v][used + 1]) {
            dist[v][used + 1] = d;
            pq.push({d, v, (long long)used + 1});
        }
    }
}
      `),
    ),
    tip(
      'The state multiplier is what to watch in the constraints. `V · K` nodes and `E · K` edges, so K ≤ 10 with V = 10^5 is a million nodes and fine; K ≤ 10^5 is not, and means the intended solution is something else.',
    ),

    h('Bellman–Ford and Floyd–Warshall'),
    p(
      'Bellman–Ford relaxes every edge `V − 1` times. A relaxation still possible on the `V`-th pass proves a negative cycle, which is usually what the problem is really asking about.',
    ),
    code(
      java(`
// Returns null if a negative cycle is reachable from src.
long[] bellmanFord(int[][] edges, int n, int src) {
    long[] dist = new long[n + 1];
    Arrays.fill(dist, INF);
    dist[src] = 0;
    for (int pass = 1; pass < n; pass++)
        for (int[] e : edges)
            if (dist[e[0]] < INF && dist[e[0]] + e[2] < dist[e[1]])
                dist[e[1]] = dist[e[0]] + e[2];

    for (int[] e : edges)                     // one extra pass: still improving?
        if (dist[e[0]] < INF && dist[e[0]] + e[2] < dist[e[1]]) return null;
    return dist;
}
      `),
      cpp(`
// Returns false if a negative cycle is reachable from src.
bool bellmanFord(vector<array<int,3>>& edges, int n, int src, vector<long long>& dist) {
    dist.assign(n + 1, INF);
    dist[src] = 0;
    for (int pass = 1; pass < n; pass++)
        for (auto& [u, v, w] : edges)
            if (dist[u] < INF && dist[u] + w < dist[v]) dist[v] = dist[u] + w;

    for (auto& [u, v, w] : edges)
        if (dist[u] < INF && dist[u] + w < dist[v]) return false;
    return true;
}
      `),
    ),
    p(
      'Floyd–Warshall is three nested loops, and the order is not negotiable: `k` — the intermediate vertex — must be the outermost. Any other order computes something that is not the shortest path and looks almost right.',
    ),
    code(
      java(`
// d[i][j] initialised to the edge weight, 0 on the diagonal, INF otherwise.
for (int k = 1; k <= n; k++)                  // k OUTERMOST. Not negotiable.
    for (int i = 1; i <= n; i++)
        for (int j = 1; j <= n; j++)
            if (d[i][k] < INF && d[k][j] < INF && d[i][k] + d[k][j] < d[i][j])
                d[i][j] = d[i][k] + d[k][j];
      `),
      cpp(`
for (int k = 1; k <= n; k++)
    for (int i = 1; i <= n; i++)
        for (int j = 1; j <= n; j++)
            if (d[i][k] < INF && d[k][j] < INF && d[i][k] + d[k][j] < d[i][j])
                d[i][j] = d[i][k] + d[k][j];
      `),
    ),
    warn(
      'The `< INF` guards are not defensive style. Without them, two unreachable pairs add to `2 * INF`, which overflows or — worse — becomes a smaller number than INF and gets written back as a real distance.',
    ),

    h('Common traps'),
    table(
      ['Symptom', 'Cause'],
      [
        ['Distances too large', 'Negative edge with Dijkstra. Use Bellman–Ford.'],
        ['TLE on a dense graph', 'Missing `if (d > dist[u]) continue;`.'],
        ['Overflow / garbage distances', '`INF` too close to the type maximum, or missing `< INF` guards.'],
        ['Floyd gives wrong answers', '`k` is not the outermost loop.'],
        ['Wrong on unweighted graphs', 'Dijkstra where BFS was intended — correct but slower, and sometimes TLE.'],
        ['Path cannot be reconstructed', 'No `parent[]` recorded during relaxation.'],
        ['0-1 BFS wrong', 'Pushing to the wrong end, or not re-checking `dist` before pushing.'],
      ],
    ),

    h('Complexity'),
    p(
      'Dijkstra with a binary heap is O(E log V), which for E = 2·10^5 is entirely routine. Bellman–Ford is O(V·E) and only viable on small graphs or when negative-cycle detection is the actual question. Floyd–Warshall is O(V^3) with an `int` matrix of V^2 — at V = 500 that is 1.25·10^8 operations and a megabyte, which is fine in C++ and tight in Java.',
    ),

    links(
      link('Dijkstra — cp-algorithms', 'https://cp-algorithms.com/graph/dijkstra.html'),
      link('0-1 BFS — cp-algorithms', 'https://cp-algorithms.com/graph/01_bfs.html'),
      link('Bellman–Ford — cp-algorithms', 'https://cp-algorithms.com/graph/bellman_ford.html'),
      link('Shortest Paths — USACO Guide', 'https://usaco.guide/gold/shortest-paths'),
    ),
  ],
};
