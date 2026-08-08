import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from './blocks.js';

export default {
  patternSlug: 'advanced-graphs',
  title: 'Advanced Graphs',
  summary:
    'Weighted paths, cycle detection and grouping — Dijkstra, topological sort and union-find.',
  blocks: [
    p(
      'Plain BFS and DFS answer "can I get there" and "how many steps". Once edges carry weights, or the question is about ordering rather than reachability, you need three more tools. They are worth learning as a set because interviewers pick from exactly this menu: union-find for grouping, topological sort for ordering, Dijkstra for cheapest paths.',
    ),
    p(
      'Union-find is the odd one out — it is not a traversal at all, it is a data structure that answers "are these two in the same group" in near-constant time while you merge groups on the fly. Whenever the problem is really about equivalence classes — connected components, redundant edges, accounts that belong to the same person — it beats a traversal because it handles edges arriving one at a time.',
    ),
    p(
      'Topological sort is DFS with the finishing order recorded, or BFS over in-degrees. It exists to answer "in what order can I do these tasks given the dependencies", and it doubles as a cycle detector: a directed graph has a valid topological order if and only if it is acyclic.',
    ),
    p(
      'Dijkstra is BFS with a priority queue instead of a plain one. The queue always hands you the closest unfinished node, which is what makes the greedy choice safe — and also why negative edges break it, since a later cheap edge could undercut a decision already made.',
    ),

    h('When to reach for it'),
    ul(
      '"Cheapest", "minimum cost", "shortest time" with weighted edges — Dijkstra.',
      'Course schedules, build order, task dependencies — topological sort.',
      '"Are these connected", "number of provinces", "redundant connection" — union-find.',
      'Connect all nodes at minimum total cost — minimum spanning tree.',
      'Edges arrive incrementally and you must answer connectivity between them.',
      'Detecting a cycle in a directed graph as a by-product of ordering.',
    ),

    h('The core idea'),
    p(
      'Union-find with both optimisations. Path compression flattens the tree during find; union by rank keeps it shallow. Together they give an amortised cost that is effectively constant — the inverse Ackermann function, which is under 5 for any input that fits in memory.',
    ),
    code(
      java(`
class DSU {
    private final int[] parent, rank;
    private int components;

    DSU(int n) {
        parent = new int[n];
        rank = new int[n];
        components = n;
        for (int i = 0; i < n; i++) parent[i] = i;   // everyone is their own root
    }

    int find(int x) {
        if (parent[x] != x) parent[x] = find(parent[x]);   // path compression
        return parent[x];
    }

    boolean union(int a, int b) {
        int ra = find(a), rb = find(b);
        if (ra == rb) return false;              // already together — a redundant edge

        if (rank[ra] < rank[rb]) { int t = ra; ra = rb; rb = t; }
        parent[rb] = ra;                          // attach the shallower to the deeper
        if (rank[ra] == rank[rb]) rank[ra]++;
        components--;
        return true;
    }

    int count() { return components; }
}
      `),
      cpp(`
struct DSU {
    vector<int> parent, rank_;
    int components;

    DSU(int n) : parent(n), rank_(n, 0), components(n) {
        iota(parent.begin(), parent.end(), 0);
    }

    int find(int x) {
        if (parent[x] != x) parent[x] = find(parent[x]);
        return parent[x];
    }

    bool unite(int a, int b) {
        int ra = find(a), rb = find(b);
        if (ra == rb) return false;
        if (rank_[ra] < rank_[rb]) swap(ra, rb);
        parent[rb] = ra;
        if (rank_[ra] == rank_[rb]) rank_[ra]++;
        components--;
        return true;
    }
};
      `),
    ),
    tip(
      'union returning false is the whole answer to several problems. In "redundant connection", the first edge whose union fails is the one that closes a cycle. In Kruskal\'s, a failed union means the edge would create a cycle and must be skipped.',
    ),
    p(
      'Topological sort, BFS flavour (Kahn\'s algorithm). Count how many prerequisites each node has, start from the ones with none, and decrement as you remove nodes. If you cannot place every node, the leftovers form a cycle.',
    ),
    code(
      java(`
public int[] topoSort(int n, int[][] prerequisites) {
    List<List<Integer>> adj = new ArrayList<>();
    for (int i = 0; i < n; i++) adj.add(new ArrayList<>());
    int[] indegree = new int[n];

    for (int[] p : prerequisites) {          // p[1] must come before p[0]
        adj.get(p[1]).add(p[0]);
        indegree[p[0]]++;
    }

    Deque<Integer> q = new ArrayDeque<>();
    for (int i = 0; i < n; i++) if (indegree[i] == 0) q.add(i);

    int[] order = new int[n];
    int placed = 0;
    while (!q.isEmpty()) {
        int node = q.poll();
        order[placed++] = node;
        for (int next : adj.get(node)) {
            if (--indegree[next] == 0) q.add(next);   // all prerequisites met
        }
    }
    return placed == n ? order : new int[0];   // short means a cycle
}
      `),
      cpp(`
vector<int> topoSort(int n, vector<vector<int>>& prerequisites) {
    vector<vector<int>> adj(n);
    vector<int> indegree(n, 0);
    for (auto& p : prerequisites) {
        adj[p[1]].push_back(p[0]);
        indegree[p[0]]++;
    }

    queue<int> q;
    for (int i = 0; i < n; i++) if (indegree[i] == 0) q.push(i);

    vector<int> order;
    while (!q.empty()) {
        int node = q.front(); q.pop();
        order.push_back(node);
        for (int next : adj[node]) if (--indegree[next] == 0) q.push(next);
    }
    return (int)order.size() == n ? order : vector<int>{};
}
      `),
    ),
    p(
      "Dijkstra. A min-heap of (distance, node). Pop the closest unfinished node, relax its edges, and skip any entry whose recorded distance is already stale — that lazy-deletion check is what lets you avoid a decrease-key operation the standard heaps do not offer.",
    ),
    code(
      java(`
public int[] dijkstra(int n, List<int[]>[] adj, int src) {
    int[] dist = new int[n];
    Arrays.fill(dist, Integer.MAX_VALUE);
    dist[src] = 0;

    // (distance, node), ordered by distance
    PriorityQueue<int[]> pq = new PriorityQueue<>(Comparator.comparingInt(a -> a[0]));
    pq.offer(new int[]{0, src});

    while (!pq.isEmpty()) {
        int[] top = pq.poll();
        int d = top[0], node = top[1];
        if (d > dist[node]) continue;              // stale entry — lazy deletion

        for (int[] edge : adj[node]) {             // edge = {neighbour, weight}
            int nd = d + edge[1];
            if (nd < dist[edge[0]]) {
                dist[edge[0]] = nd;
                pq.offer(new int[]{nd, edge[0]});
            }
        }
    }
    return dist;
}
      `),
      cpp(`
vector<int> dijkstra(int n, vector<vector<pair<int,int>>>& adj, int src) {
    vector<int> dist(n, INT_MAX);
    dist[src] = 0;

    priority_queue<pair<int,int>, vector<pair<int,int>>, greater<>> pq;  // MIN-heap
    pq.push({0, src});

    while (!pq.empty()) {
        auto [d, node] = pq.top(); pq.pop();
        if (d > dist[node]) continue;

        for (auto& [next, w] : adj[node]) {
            if (d + w < dist[next]) {
                dist[next] = d + w;
                pq.push({dist[next], next});
            }
        }
    }
    return dist;
}
      `),
    ),
    warn(
      'Dijkstra is wrong on graphs with negative edge weights — the greedy "closest node is final" assumption fails. Use Bellman-Ford (O(V·E), and it detects negative cycles) when weights can be negative.',
    ),

    h('Variations'),
    p(
      "Minimum spanning tree. Kruskal's is union-find plus a sort: take edges cheapest-first and keep the ones that join two different components. Prim's is Dijkstra's skeleton with the heap keyed on edge weight rather than accumulated distance.",
    ),
    code(
      java(`
// Kruskal's — connect everything for the least total cost
public int minimumCost(int n, int[][] edges) {
    Arrays.sort(edges, Comparator.comparingInt(e -> e[2]));   // by weight
    DSU dsu = new DSU(n);
    int total = 0, used = 0;

    for (int[] e : edges) {
        if (dsu.union(e[0], e[1])) {      // false means it would form a cycle
            total += e[2];
            if (++used == n - 1) break;   // a tree on n nodes has n-1 edges
        }
    }
    return used == n - 1 ? total : -1;    // -1: the graph is disconnected
}
      `),
    ),
    p(
      'Topological sort, DFS flavour. Push a node onto the output after all its descendants are finished, then reverse. Shorter than Kahn\'s, but it needs the three-state visited array to detect cycles.',
    ),
    code(
      java(`
private boolean dfs(int node, List<List<Integer>> adj, int[] state, Deque<Integer> out) {
    if (state[node] == 1) return false;      // on the current path — cycle
    if (state[node] == 2) return true;       // already finished

    state[node] = 1;
    for (int next : adj.get(node)) if (!dfs(next, adj, state, out)) return false;
    state[node] = 2;
    out.push(node);                          // finished: goes in front of its descendants
    return true;
}
      `),
    ),

    h('Language toolkit'),
    table(
      ['Java', 'What it does', 'C++ equivalent'],
      [
        ['PriorityQueue<int[]>(Comparator.comparingInt(a -> a[0]))', 'Min-heap by distance.', 'priority_queue<pair<int,int>, vector<...>, greater<>>'],
        ['Arrays.fill(dist, Integer.MAX_VALUE)', 'Unreached sentinel.', 'vector<int> dist(n, INT_MAX)'],
        ['for (int i = 0; i < n; i++) parent[i] = i', 'DSU init.', 'iota(parent.begin(), parent.end(), 0)'],
        ['Arrays.sort(edges, cmp)', 'Sort edges by weight for Kruskal.', 'sort(edges.begin(), edges.end(), cmp)'],
        ['int[] indegree = new int[n]', 'Prerequisite counts for Kahn.', 'vector<int> indegree(n, 0)'],
        ['Deque<Integer> stack', 'DFS topological output.', 'vector<int> then reverse'],
        ['Integer.compare(a, b)', 'Overflow-safe comparator.', 'a < b'],
      ],
    ),
    warn(
      'Do not write a Java comparator as (a, b) -> a[0] - b[0] when the values can be large — the subtraction overflows and the ordering silently breaks. Comparator.comparingInt or Integer.compare are safe.',
    ),

    h('Complexity'),
    table(
      ['Algorithm', 'Time', 'Space', 'Note'],
      [
        ['Union-find (both optimisations)', 'O(α(n)) amortised', 'O(n)', 'α < 5 in practice — effectively O(1).'],
        ['Union-find (no optimisations)', 'O(n) per op', 'O(n)', 'Degenerates into a linked list.'],
        ['Topological sort', 'O(V + E)', 'O(V)', 'Both flavours.'],
        ['Dijkstra with a binary heap', 'O((V + E) log V)', 'O(V)', 'The standard answer.'],
        ["Kruskal's MST", 'O(E log E)', 'O(V)', 'The sort dominates.'],
        ["Prim's MST with a heap", 'O(E log V)', 'O(V)', 'Better on dense graphs.'],
        ['Bellman-Ford', 'O(V·E)', 'O(V)', 'Handles negative weights.'],
      ],
    ),

    h('Common mistakes'),
    ul(
      'Writing find without path compression, so the trees stay deep and every operation is O(n).',
      'Forgetting that union should return whether anything merged — that boolean is the answer to several problems.',
      'Running Dijkstra on negative weights. It gives a wrong answer, not an error.',
      'Omitting the stale-entry check (d > dist[node]) in Dijkstra, which still terminates but does far more work.',
      'Using a max-heap for Dijkstra. Java defaults to a min-heap; C++ defaults to a max-heap and needs greater<>.',
      'Building the topological edge in the wrong direction. "a depends on b" means the edge runs b → a.',
      'Forgetting that an incomplete topological order means a cycle — check the count before returning.',
      'Using a two-state visited flag for DFS cycle detection in a directed graph.',
    ),

    tip(
      'Ask two questions to pick the tool. Are the edges weighted? If yes and they are non-negative, Dijkstra. If no, is the question about order (topological sort) or about grouping (union-find)? Almost everything in this pattern falls out of those two.',
    ),

    links(
      link('LeetCode Explore — Graph', 'https://leetcode.com/explore/learn/card/graph/'),
      link('Java PriorityQueue — API reference', 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/PriorityQueue.html'),
    ),
  ],
};
