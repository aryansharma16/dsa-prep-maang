import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from './blocks.js';

export default {
  patternSlug: 'graphs',
  title: 'Graphs (BFS / DFS)',
  summary: 'Grids are graphs. BFS gives shortest unweighted paths, DFS gives connectivity.',
  blocks: [
    p(
      'A graph is nodes and edges, and the single most useful realisation in this pattern is that a grid is already one: each cell is a node, and its up/down/left/right neighbours are its edges. Once you see that, island counting, rotting oranges and maze shortest-path all stop being grid puzzles and become the same two traversals you already know.',
    ),
    p(
      'Those two traversals divide the work cleanly. BFS explores in rings of increasing distance, so the first time it reaches a node it has arrived by the shortest route — but only when every edge costs the same. DFS plunges down one path to the end before backing up, which makes it the natural fit for connectivity, cycle detection and anything about whole components. If the question says "fewest steps" or "minimum moves", that is BFS. If it says "how many groups" or "is it reachable", either works and DFS is usually shorter to write.',
    ),
    p(
      'Whichever you pick, the discipline that prevents almost every bug is the same: mark a node as visited at the moment you enqueue or first reach it, never when you dequeue it. Marking late lets the same node enter the queue several times, which in a dense grid turns a linear traversal into something quadratic.',
    ),

    h('When to reach for it'),
    ul(
      'A grid with regions to count, fill, or measure — islands, lakes, enclaves.',
      '"Shortest path", "minimum steps", "fewest moves" on an unweighted graph — BFS.',
      'Reachability, connected components, cycle detection — DFS.',
      'Several starting points spreading at once — multi-source BFS.',
      'Course prerequisites, dependency order, or anything phrased as "A must come before B".',
      'Cloning or comparing a graph structure.',
    ),

    h('The core idea'),
    p(
      'Building the graph. Most problems hand you an edge list and expect you to convert it to an adjacency list first. For an undirected graph, add both directions.',
    ),
    code(
      java(`
List<List<Integer>> adj = new ArrayList<>();
for (int i = 0; i < n; i++) adj.add(new ArrayList<>());
for (int[] e : edges) {
    adj.get(e[0]).add(e[1]);
    adj.get(e[1]).add(e[0]);      // drop this line for a directed graph
}
      `),
      cpp(`
vector<vector<int>> adj(n);
for (auto& e : edges) {
    adj[e[0]].push_back(e[1]);
    adj[e[1]].push_back(e[0]);    // drop for directed
}
      `),
    ),
    p(
      'BFS. A queue, a visited set, and the level-size snapshot when you need the distance. The direction array is worth writing once — four hard-coded recursive calls is where typos hide.',
    ),
    code(
      java(`
// Shortest path in a grid, in steps
private static final int[][] DIRS = {{1,0}, {-1,0}, {0,1}, {0,-1}};

public int shortestPath(int[][] grid) {
    int m = grid.length, n = grid[0].length;
    boolean[][] seen = new boolean[m][n];
    Deque<int[]> q = new ArrayDeque<>();

    q.add(new int[]{0, 0});
    seen[0][0] = true;                       // mark on ENQUEUE, not on dequeue
    int steps = 0;

    while (!q.isEmpty()) {
        int levelSize = q.size();            // one ring of the search
        for (int i = 0; i < levelSize; i++) {
            int[] cell = q.poll();
            int r = cell[0], c = cell[1];
            if (r == m - 1 && c == n - 1) return steps;

            for (int[] d : DIRS) {
                int nr = r + d[0], nc = c + d[1];
                if (nr < 0 || nc < 0 || nr >= m || nc >= n) continue;
                if (seen[nr][nc] || grid[nr][nc] == 1) continue;   // wall
                seen[nr][nc] = true;
                q.add(new int[]{nr, nc});
            }
        }
        steps++;
    }
    return -1;
}
      `),
      cpp(`
const int DIRS[4][2] = {{1,0}, {-1,0}, {0,1}, {0,-1}};

int shortestPath(vector<vector<int>>& grid) {
    int m = grid.size(), n = grid[0].size();
    vector<vector<bool>> seen(m, vector<bool>(n, false));
    queue<pair<int,int>> q;

    q.push({0, 0});
    seen[0][0] = true;
    int steps = 0;

    while (!q.empty()) {
        int levelSize = q.size();
        while (levelSize--) {
            auto [r, c] = q.front(); q.pop();
            if (r == m - 1 && c == n - 1) return steps;

            for (auto& d : DIRS) {
                int nr = r + d[0], nc = c + d[1];
                if (nr < 0 || nc < 0 || nr >= m || nc >= n) continue;
                if (seen[nr][nc] || grid[nr][nc] == 1) continue;
                seen[nr][nc] = true;
                q.push({nr, nc});
            }
        }
        steps++;
    }
    return -1;
}
      `),
    ),
    warn(
      'Marking visited on dequeue instead of enqueue is the classic BFS bug. A node with several neighbours gets pushed once per neighbour before it is ever processed, the queue balloons, and on a large grid the traversal degrades badly.',
    ),
    p(
      'DFS and flood fill. Counting islands is the archetype: scan for an unvisited land cell, then sink the entire component so it is never counted twice.',
    ),
    code(
      java(`
public int numIslands(char[][] grid) {
    int count = 0;
    for (int r = 0; r < grid.length; r++) {
        for (int c = 0; c < grid[0].length; c++) {
            if (grid[r][c] == '1') { count++; sink(grid, r, c); }
        }
    }
    return count;
}

private void sink(char[][] grid, int r, int c) {
    if (r < 0 || c < 0 || r >= grid.length || c >= grid[0].length) return;
    if (grid[r][c] != '1') return;

    grid[r][c] = '0';                    // mutating the grid IS the visited set
    sink(grid, r + 1, c);
    sink(grid, r - 1, c);
    sink(grid, r, c + 1);
    sink(grid, r, c - 1);
}
      `),
      cpp(`
void sink(vector<vector<char>>& grid, int r, int c) {
    if (r < 0 || c < 0 || r >= (int)grid.size() || c >= (int)grid[0].size()) return;
    if (grid[r][c] != '1') return;
    grid[r][c] = '0';
    sink(grid, r+1, c); sink(grid, r-1, c);
    sink(grid, r, c+1); sink(grid, r, c-1);
}
      `),
    ),
    tip(
      'Overwriting the input is the cheapest visited set there is — O(1) extra space instead of a whole boolean grid. Mention that you are mutating the caller\'s data, and offer to restore it or use a separate array if that matters.',
    ),

    h('Variations'),
    p(
      'Multi-source BFS. When several things spread simultaneously — rotting oranges, distance to the nearest gate, fire spreading — seed the queue with every source before the loop starts. The rings then expand from all of them at once, which is exactly the semantics you want and avoids running BFS once per source.',
    ),
    code(
      java(`
Deque<int[]> q = new ArrayDeque<>();
for (int r = 0; r < m; r++)
    for (int c = 0; c < n; c++)
        if (grid[r][c] == 2) { q.add(new int[]{r, c}); }   // every rotten orange

int minutes = 0;
while (!q.isEmpty() && fresh > 0) {
    int size = q.size();
    for (int i = 0; i < size; i++) { /* spread to fresh neighbours, fresh-- */ }
    minutes++;
}
return fresh == 0 ? minutes : -1;
      `),
    ),
    p(
      'Cycle detection in a directed graph. Two visited states are not enough — you need three. A node currently on the recursion stack means a cycle if you reach it again; a node fully finished is just a node you already explored.',
    ),
    code(
      java(`
// 0 = unvisited, 1 = on the current path, 2 = fully explored
private boolean hasCycle(List<List<Integer>> adj, int node, int[] state) {
    if (state[node] == 1) return true;       // back edge — cycle
    if (state[node] == 2) return false;      // already cleared

    state[node] = 1;                         // enter the path
    for (int next : adj.get(node)) {
        if (hasCycle(adj, next, state)) return true;
    }
    state[node] = 2;                         // leave the path
    return false;
}
      `),
    ),
    p(
      'Undirected cycle detection is different: you must not count the edge you arrived on as a cycle, so carry the parent and skip it.',
    ),
    code(
      java(`
private boolean dfs(List<List<Integer>> adj, int node, int parent, boolean[] seen) {
    seen[node] = true;
    for (int next : adj.get(node)) {
        if (next == parent) continue;             // the edge we came in on
        if (seen[next]) return true;              // any other seen node is a cycle
        if (dfs(adj, next, node, seen)) return true;
    }
    return false;
}
      `),
    ),

    h('Language toolkit'),
    table(
      ['Java', 'What it does', 'C++ equivalent'],
      [
        ['Deque<int[]> q = new ArrayDeque<>()', 'BFS queue of coordinates.', 'queue<pair<int,int>> q'],
        ['q.add(x) / q.poll()', 'Enqueue / dequeue.', 'q.push(x) / q.front(); q.pop()'],
        ['q.size()', 'Ring width — snapshot before the inner loop.', 'q.size()'],
        ['new boolean[m][n]', 'Visited grid, false-filled.', 'vector<vector<bool>>(m, vector<bool>(n))'],
        ['Set<String> seen', 'Visited set when nodes are not integers.', 'unordered_set<string>'],
        ['int[][] DIRS = {{1,0},{-1,0},{0,1},{0,-1}}', 'Four-neighbour offsets.', 'const int DIRS[4][2]'],
        ['List<List<Integer>> adj', 'Adjacency list.', 'vector<vector<int>> adj'],
        ['Map<Integer, List<Integer>>', 'Adjacency when node ids are sparse.', 'unordered_map<int, vector<int>>'],
      ],
    ),

    h('Complexity'),
    table(
      ['Operation', 'Time', 'Space', 'Note'],
      [
        ['BFS or DFS over a graph', 'O(V + E)', 'O(V)', 'Every node and edge touched once.'],
        ['BFS or DFS over an m×n grid', 'O(m·n)', 'O(m·n)', 'V = m·n, E ≈ 4·m·n.'],
        ['Counting islands', 'O(m·n)', 'O(m·n)', 'The outer scan does not add a factor.'],
        ['Multi-source BFS', 'O(m·n)', 'O(m·n)', 'Same cost as single-source.'],
        ['Recursive DFS depth', '—', 'O(V)', 'Stack overflow risk on a large grid.'],
        ['Building an adjacency list', 'O(V + E)', 'O(V + E)', 'Paid once.'],
      ],
    ),
    warn(
      'Recursive DFS on a 1000×1000 grid can be a million frames deep and will overflow the default JVM stack. If the grid is large, write BFS with an explicit queue, or an iterative DFS with an explicit stack.',
    ),

    h('Common mistakes'),
    ul(
      'Marking visited on dequeue rather than enqueue, letting duplicates pile up in the queue.',
      'Using DFS for a shortest-path question. DFS finds a path, not the shortest one.',
      'Forgetting the bounds check before indexing a neighbour.',
      'Adding only one direction when building an undirected adjacency list.',
      'Not carrying the parent in undirected cycle detection, so every edge looks like a cycle.',
      'Using a two-state visited flag for directed cycle detection, which cannot tell "on this path" from "already done".',
      'Recursing deep enough to overflow the stack on a large grid.',
      'Forgetting that BFS only gives shortest paths when all edges cost the same — weighted graphs need Dijkstra.',
    ),

    tip(
      'Before coding, name three things: what a node is, what an edge is, and what "visited" means. On a grid that is a cell, an adjacency, and a boolean array. Answering those turns most graph problems into the template.',
    ),

    links(
      link('LeetCode Explore — Graph', 'https://leetcode.com/explore/learn/card/graph/'),
      link('Java ArrayDeque — API reference', 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayDeque.html'),
    ),
  ],
};
