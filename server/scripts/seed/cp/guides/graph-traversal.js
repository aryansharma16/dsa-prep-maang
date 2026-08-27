import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from '../../guides/blocks.js';

export default {
  patternSlug: 'graph-traversal',
  title: 'BFS & DFS on Graphs and Grids',
  summary:
    'Connected components, reachability, shortest paths on unweighted edges, cycle detection, bipartite checks — all one traversal with different bookkeeping.',
  blocks: [
    p(
      'BFS and DFS are the same algorithm with a different container: a queue makes it BFS, a stack (or recursion) makes it DFS. What separates them is the *order* in which vertices come out, and one property of that order does all the work — BFS visits vertices in non-decreasing distance from the source. That single fact is why BFS solves unweighted shortest paths and DFS does not, and it is worth being able to state before writing either.',
    ),
    p(
      'At this level the algorithms themselves are not the difficulty. The difficulty is recognising a graph when the statement does not mention one. A grid is a graph. A permutation is a graph, where `i → p[i]`. A set of "these two must differ" constraints is a graph. Once you see the vertices and the edges, the traversal is fifteen lines you have written before.',
    ),

    h('When to reach for it'),
    ul(
      'Connected components, reachability, "can we get from A to B".',
      'Minimum number of moves, where every move costs the same. That is BFS, exactly.',
      'A grid with walls, and movement to adjacent cells.',
      'Cycle detection, bipartiteness, 2-colouring.',
      'Anything where the state space is finite and moves are discrete — BFS over states, not over vertices.',
    ),
    warn(
      'Weighted edges mean Dijkstra, not BFS. The one exception is weights in {0, 1}, where a deque replaces the queue and it stays linear — see the shortest-paths guide.',
    ),

    h('Representation'),
    p(
      'Adjacency lists, always. An adjacency matrix on 2·10^5 vertices is 4·10^10 entries and will not allocate; on the sizes where it does fit, the list is still faster because traversal touches only the edges that exist.',
    ),
    code(
      java(`
// Read m undirected edges into adjacency lists. 1-indexed input.
List<Integer>[] adj = new List[n + 1];
for (int i = 1; i <= n; i++) adj[i] = new ArrayList<>();
for (int i = 0; i < m; i++) {
    int u = in.nextInt(), v = in.nextInt();
    adj[u].add(v);
    adj[v].add(u);              // both directions — undirected
}
      `),
      cpp(`
vector<vector<int>> adj(n + 1);
for (int i = 0; i < m; i++) {
    int u, v; cin >> u >> v;
    adj[u].push_back(v);
    adj[v].push_back(u);
}
      `),
    ),

    h('BFS'),
    p(
      'Mark visited when you *push*, not when you pop. Popping-time marking lets the same vertex enter the queue many times before it is first processed, which on a dense graph degrades to something much worse than linear.',
    ),
    code(
      java(`
// Shortest distance in edges from src. -1 means unreachable.
int[] bfs(List<Integer>[] adj, int n, int src) {
    int[] dist = new int[n + 1];
    Arrays.fill(dist, -1);
    ArrayDeque<Integer> q = new ArrayDeque<>();
    dist[src] = 0;
    q.add(src);
    while (!q.isEmpty()) {
        int u = q.poll();
        for (int v : adj[u]) {
            if (dist[v] != -1) continue;    // already seen — visited-on-push
            dist[v] = dist[u] + 1;
            q.add(v);
        }
    }
    return dist;
}
      `),
      cpp(`
vector<int> bfs(vector<vector<int>>& adj, int n, int src) {
    vector<int> dist(n + 1, -1);
    queue<int> q;
    dist[src] = 0;
    q.push(src);
    while (!q.empty()) {
        int u = q.front(); q.pop();
        for (int v : adj[u]) {
            if (dist[v] != -1) continue;
            dist[v] = dist[u] + 1;
            q.push(v);
        }
    }
    return dist;
}
      `),
    ),
    tip(
      'Multi-source BFS is the same code with several vertices pushed at distance 0 before the loop starts. "Distance to the nearest fire", "nearest exit from any cell" — one BFS, not one per source. Writing a loop of BFS runs is the standard way to turn a linear solution into a quadratic one.',
    ),

    h('DFS, and why iterative'),
    p(
      'Recursive DFS is shorter and is what you should write when the graph is shallow. On Codeforces it frequently is not: a path-shaped tree of 2·10^5 vertices is a recursion 200,000 frames deep, which overflows the default stack in both C++ and Java. That failure shows up as a runtime error on a large test with no other symptom.',
    ),
    code(
      java(`
// Iterative DFS. Safe at any depth.
void dfs(List<Integer>[] adj, int n, int src, boolean[] seen) {
    ArrayDeque<Integer> stack = new ArrayDeque<>();
    stack.push(src);
    seen[src] = true;
    while (!stack.isEmpty()) {
        int u = stack.pop();
        for (int v : adj[u]) {
            if (seen[v]) continue;
            seen[v] = true;
            stack.push(v);
        }
    }
}

// If you must recurse in Java, run it on a thread with a bigger stack:
//   new Thread(null, this::solve, "main", 1 << 26).start();
      `),
      cpp(`
void dfs(vector<vector<int>>& adj, int src, vector<char>& seen) {
    vector<int> stack{src};
    seen[src] = 1;
    while (!stack.empty()) {
        int u = stack.back(); stack.pop_back();
        for (int v : adj[u]) {
            if (seen[v]) continue;
            seen[v] = 1;
            stack.push_back(v);
        }
    }
}
      `),
    ),
    warn(
      'When post-order matters — subtree sizes, tree DP — an iterative DFS needs an explicit two-phase stack (push the vertex, push it again as a marker, process on the second visit). If you find yourself fighting that, recursion with a raised stack limit is the more readable answer.',
    ),

    h('Grids'),
    p(
      'Do not build an edge list for a grid. The neighbours of `(r, c)` are computable, so the traversal indexes the grid directly and the "graph" never exists in memory.',
    ),
    code(
      java(`
static final int[] DR = {-1, 1, 0, 0};
static final int[] DC = {0, 0, -1, 1};

int[][] bfsGrid(char[][] g, int sr, int sc) {
    int n = g.length, m = g[0].length;
    int[][] dist = new int[n][m];
    for (int[] row : dist) Arrays.fill(row, -1);
    ArrayDeque<int[]> q = new ArrayDeque<>();
    dist[sr][sc] = 0;
    q.add(new int[]{sr, sc});
    while (!q.isEmpty()) {
        int[] cur = q.poll();
        for (int d = 0; d < 4; d++) {
            int nr = cur[0] + DR[d], nc = cur[1] + DC[d];
            // Bounds BEFORE indexing — the other order is an exception.
            if (nr < 0 || nr >= n || nc < 0 || nc >= m) continue;
            if (g[nr][nc] == '#' || dist[nr][nc] != -1) continue;
            dist[nr][nc] = dist[cur[0]][cur[1]] + 1;
            q.add(new int[]{nr, nc});
        }
    }
    return dist;
}
      `),
      cpp(`
const int DR[] = {-1, 1, 0, 0};
const int DC[] = {0, 0, -1, 1};

vector<vector<int>> bfsGrid(vector<string>& g, int sr, int sc) {
    int n = g.size(), m = g[0].size();
    vector<vector<int>> dist(n, vector<int>(m, -1));
    queue<pair<int,int>> q;
    dist[sr][sc] = 0;
    q.push({sr, sc});
    while (!q.empty()) {
        auto [r, c] = q.front(); q.pop();
        for (int d = 0; d < 4; d++) {
            int nr = r + DR[d], nc = c + DC[d];
            if (nr < 0 || nr >= n || nc < 0 || nc >= m) continue;
            if (g[nr][nc] == '#' || dist[nr][nc] != -1) continue;
            dist[nr][nc] = dist[r][c] + 1;
            q.push({nr, nc});
        }
    }
    return dist;
}
      `),
    ),

    h('The bookkeeping variants'),
    p(
      'Every one of these is the traversal above with something extra recorded. That is the useful mental model — not five algorithms, but one with five ledgers.',
    ),
    table(
      ['Question', 'What to record'],
      [
        ['Connected components', 'A component id per vertex; loop over all vertices, traverse the unseen.'],
        ['Shortest path (unweighted)', 'BFS `dist[]`, plus a `parent[]` if the path itself is wanted.'],
        ['Is it bipartite?', 'A colour per vertex; conflict on an edge means no.'],
        ['Cycle in an undirected graph', 'An edge to a seen vertex that is not the parent.'],
        ['Cycle in a directed graph', 'Three colours — white / grey / black. A grey neighbour is a back edge.'],
        ['Subtree sizes', 'DFS post-order: `size[u] = 1 + sum of children`.'],
        ['Tree diameter', 'BFS from any vertex to find the farthest, then BFS from there.'],
      ],
    ),
    code(
      java(`
// Bipartite check — BFS with a colour instead of a distance.
boolean bipartite(List<Integer>[] adj, int n) {
    int[] colour = new int[n + 1];
    Arrays.fill(colour, -1);
    for (int s = 1; s <= n; s++) {
        if (colour[s] != -1) continue;              // every component
        colour[s] = 0;
        ArrayDeque<Integer> q = new ArrayDeque<>();
        q.add(s);
        while (!q.isEmpty()) {
            int u = q.poll();
            for (int v : adj[u]) {
                if (colour[v] == -1) { colour[v] = colour[u] ^ 1; q.add(v); }
                else if (colour[v] == colour[u]) return false;
            }
        }
    }
    return true;
}
      `),
      cpp(`
bool bipartite(vector<vector<int>>& adj, int n) {
    vector<int> colour(n + 1, -1);
    for (int s = 1; s <= n; s++) {
        if (colour[s] != -1) continue;
        colour[s] = 0;
        queue<int> q; q.push(s);
        while (!q.empty()) {
            int u = q.front(); q.pop();
            for (int v : adj[u]) {
                if (colour[v] == -1) { colour[v] = colour[u] ^ 1; q.push(v); }
                else if (colour[v] == colour[u]) return false;
            }
        }
    }
    return true;
}
      `),
    ),
    tip(
      'The outer loop over every vertex is what turns any single-source traversal into a whole-graph one. Forgetting it is the reason a solution works on connected test cases and fails the moment the graph has two components.',
    ),

    h('Common traps'),
    table(
      ['Symptom', 'Cause'],
      [
        ['Runtime error on a large test', 'Recursive DFS on a deep graph. Go iterative or raise the stack.'],
        ['TLE with a correct algorithm', 'Marking visited on pop rather than on push.'],
        ['Works on one component only', 'No outer loop over all vertices.'],
        ['Grid index out of bounds', 'Indexing before the bounds check.'],
        ['Wrong distances', 'DFS used for an unweighted shortest path. Use BFS.'],
        ['Undirected cycle falsely detected', 'Not excluding the edge back to the parent.'],
        ['Multi-source solution is quadratic', 'One BFS per source instead of all sources at distance 0.'],
        ['Missing half the edges', 'Only one `push_back` for an undirected edge.'],
      ],
    ),

    h('Complexity'),
    p(
      'O(V + E) time for both, and O(V) memory for the visited and distance arrays plus the frontier. On a grid that is O(rows × cols). The constant factor is dominated by how the adjacency is stored, which is why the list beats the matrix even where both fit.',
    ),

    links(
      link('Breadth-first search — cp-algorithms', 'https://cp-algorithms.com/graph/breadth-first-search.html'),
      link('Depth-first search — cp-algorithms', 'https://cp-algorithms.com/graph/depth-first-search.html'),
      link('Graph Traversal — USACO Guide', 'https://usaco.guide/silver/graph-traversal'),
    ),
  ],
};
