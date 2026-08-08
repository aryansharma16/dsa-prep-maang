import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from './blocks.js';

export default {
  patternSlug: 'backtracking',
  title: 'Backtracking',
  summary: 'Choose, recurse, un-choose. The un-choose is the part people forget.',
  blocks: [
    p(
      'Backtracking is exhaustive search with an eraser. You build a candidate answer one decision at a time; when a decision leads nowhere, you undo it and try the next one. The recursion tree is the space of all possible answers, and the algorithm is a depth-first walk of it that abandons branches as soon as they are provably hopeless.',
    ),
    p(
      'The three-line skeleton never changes. Make a choice. Recurse with that choice in place. Undo the choice. That third line is what separates backtracking from ordinary recursion, and leaving it out is the defining bug of the pattern — the state leaks sideways into sibling branches and the output fills with combinations you never intended.',
    ),
    p(
      'What distinguishes a good solution from a slow one is pruning. Plain enumeration of every subset is 2^n and there is no avoiding it if the answer really is every subset. But most problems let you cut branches early — the sum already exceeds the target, this queen is already attacked, this digit already appears in the row. Every cut removes an entire subtree, and that is where the real speed comes from.',
    ),

    h('When to reach for it'),
    ul(
      '"All possible", "every combination", "enumerate", "generate" — the answer is a list of answers.',
      'Subsets, permutations, combinations, partitions.',
      'Constraint puzzles: N-Queens, Sudoku, word squares.',
      'Grid path search where cells cannot be reused on the current path.',
      'Small n with an exponential answer space — typically n up to about 20.',
    ),
    warn(
      'If the problem asks for a count or an optimum rather than the list itself, backtracking is usually the wrong tool — that is dynamic programming, and enumerating exponentially many candidates to take a maximum will time out.',
    ),

    h('The core idea'),
    p(
      'Subsets shows the skeleton at its cleanest. At each index there are exactly two decisions: include this element or do not. The start parameter is what stops you generating the same subset in different orders.',
    ),
    code(
      java(`
public List<List<Integer>> subsets(int[] nums) {
    List<List<Integer>> out = new ArrayList<>();
    backtrack(nums, 0, new ArrayList<>(), out);
    return out;
}

private void backtrack(int[] nums, int start, List<Integer> path, List<List<Integer>> out) {
    out.add(new ArrayList<>(path));          // every node is a valid subset — copy it

    for (int i = start; i < nums.length; i++) {
        path.add(nums[i]);                   // 1. choose
        backtrack(nums, i + 1, path, out);   // 2. recurse, never looking back
        path.remove(path.size() - 1);        // 3. un-choose
    }
}
      `),
      cpp(`
void backtrack(vector<int>& nums, int start, vector<int>& path, vector<vector<int>>& out) {
    out.push_back(path);                     // copies by value

    for (int i = start; i < (int)nums.size(); i++) {
        path.push_back(nums[i]);             // choose
        backtrack(nums, i + 1, path, out);   // recurse
        path.pop_back();                     // un-choose
    }
}

vector<vector<int>> subsets(vector<int>& nums) {
    vector<vector<int>> out;
    vector<int> path;
    backtrack(nums, 0, path, out);
    return out;
}
      `),
    ),
    warn(
      'out.add(path) in Java stores a reference to the single list you keep mutating — every entry ends up identical and empty. new ArrayList<>(path) is mandatory. C++ push_back copies by value, so it is safe there, which is a genuine difference between the two.',
    ),
    p(
      'Permutations need a different bookkeeping device. Order matters, so there is no start index — every unused element is a candidate at every position, and a used[] array tracks which are already in the path.',
    ),
    code(
      java(`
public List<List<Integer>> permute(int[] nums) {
    List<List<Integer>> out = new ArrayList<>();
    backtrack(nums, new boolean[nums.length], new ArrayList<>(), out);
    return out;
}

private void backtrack(int[] nums, boolean[] used, List<Integer> path, List<List<Integer>> out) {
    if (path.size() == nums.length) {          // only complete paths count
        out.add(new ArrayList<>(path));
        return;
    }
    for (int i = 0; i < nums.length; i++) {
        if (used[i]) continue;
        used[i] = true;  path.add(nums[i]);        // choose
        backtrack(nums, used, path, out);          // recurse
        used[i] = false; path.remove(path.size() - 1);   // un-choose BOTH
    }
}
      `),
    ),
    tip(
      'Notice where the result is recorded. Subsets record at every node because every prefix is an answer. Permutations record only at the leaves because a partial permutation is not a permutation. Deciding which of those two you have is the first question to answer.',
    ),

    h('Variations'),
    p(
      'Duplicates in the input. Sort first, then skip an element when it equals its predecessor and that predecessor was not used on this path. Without the second condition you also skip legitimate repeats inside a single combination.',
    ),
    code(
      java(`
Arrays.sort(nums);
...
for (int i = start; i < nums.length; i++) {
    // skip a duplicate only when it is a sibling choice, not a nested one
    if (i > start && nums[i] == nums[i - 1]) continue;
    path.add(nums[i]);
    backtrack(nums, i + 1, path, out);
    path.remove(path.size() - 1);
}
      `),
      cpp(`
sort(nums.begin(), nums.end());
...
for (int i = start; i < (int)nums.size(); i++) {
    if (i > start && nums[i] == nums[i - 1]) continue;
    path.push_back(nums[i]);
    backtrack(nums, i + 1, path, out);
    path.pop_back();
}
      `),
    ),
    p(
      'Reuse allowed. Combination Sum lets you pick the same number repeatedly, which is a one-character change: recurse with i instead of i + 1. The pruning — bail once the remaining target goes negative, and break on a sorted array once the candidate exceeds it — is what keeps it fast.',
    ),
    code(
      java(`
private void backtrack(int[] candidates, int start, int remain,
                       List<Integer> path, List<List<Integer>> out) {
    if (remain == 0) { out.add(new ArrayList<>(path)); return; }

    for (int i = start; i < candidates.length; i++) {
        if (candidates[i] > remain) break;     // sorted: everything after is worse
        path.add(candidates[i]);
        backtrack(candidates, i, remain - candidates[i], path, out);   // i, not i+1
        path.remove(path.size() - 1);
    }
}
      `),
    ),
    p(
      'Constraint pruning — N-Queens. The whole algorithm is the validity check. Tracking attacked columns and diagonals in sets makes that check O(1); the two diagonals are identified by row + col and row − col, which are constant along each.',
    ),
    code(
      java(`
private void place(int row, int n, Set<Integer> cols, Set<Integer> diag, Set<Integer> anti,
                   List<Integer> board, List<List<String>> out) {
    if (row == n) { out.add(render(board, n)); return; }

    for (int col = 0; col < n; col++) {
        int d = row - col, a = row + col;           // constant along each diagonal
        if (cols.contains(col) || diag.contains(d) || anti.contains(a)) continue;

        cols.add(col); diag.add(d); anti.add(a); board.add(col);       // choose
        place(row + 1, n, cols, diag, anti, board, out);               // recurse
        cols.remove(col); diag.remove(d); anti.remove(a);              // un-choose
        board.remove(board.size() - 1);
    }
}
      `),
    ),
    p(
      'Grid DFS with restore. Mark the cell, recurse into the neighbours, then unmark. The unmark is what makes it backtracking rather than flood fill — a cell blocked on this path must be free again for a different path.',
    ),
    code(
      java(`
private boolean dfs(char[][] board, int r, int c, String word, int i) {
    if (i == word.length()) return true;
    if (r < 0 || c < 0 || r >= board.length || c >= board[0].length) return false;
    if (board[r][c] != word.charAt(i)) return false;

    char saved = board[r][c];
    board[r][c] = '#';                                  // choose
    boolean found = dfs(board, r + 1, c, word, i + 1)
                 || dfs(board, r - 1, c, word, i + 1)
                 || dfs(board, r, c + 1, word, i + 1)
                 || dfs(board, r, c - 1, word, i + 1);
    board[r][c] = saved;                                // un-choose
    return found;
}
      `),
    ),

    h('Language toolkit'),
    table(
      ['Java', 'What it does', 'C++ equivalent'],
      [
        ['new ArrayList<>(path)', 'Snapshot — required before storing.', 'push_back(path) copies already'],
        ['path.remove(path.size() - 1)', 'Un-choose.', 'path.pop_back()'],
        ['new boolean[n]', 'used[] tracker, false-filled.', 'vector<bool> used(n, false)'],
        ['Arrays.sort(nums)', 'Precondition for duplicate skipping.', 'sort(v.begin(), v.end())'],
        ['Set<Integer>', 'O(1) constraint checks.', 'unordered_set<int>'],
        ['String.join("", chars)', 'Render a path to a string.', 'string(path.begin(), path.end())'],
        ['StringBuilder + setLength', 'Cheap append/undo for string paths.', 's += c; s.pop_back();'],
      ],
    ),
    tip(
      'For string-building backtracking, a StringBuilder with sb.setLength(sb.length() - 1) as the un-choose avoids allocating a new string at every node. In C++ the equivalent pair is s += c and s.pop_back().',
    ),

    h('Complexity'),
    table(
      ['Problem', 'Time', 'Space', 'Note'],
      [
        ['Subsets', 'O(n · 2^n)', 'O(n)', '2^n subsets, each costing O(n) to copy.'],
        ['Permutations', 'O(n · n!)', 'O(n)', 'n! leaves, O(n) to copy each.'],
        ['Combination sum', 'O(n^(t/m))', 'O(t/m)', 't = target, m = smallest candidate.'],
        ['N-Queens', 'O(n!)', 'O(n)', 'Pruning cuts the constant enormously.'],
        ['Word search on a grid', 'O(m·n·4^L)', 'O(L)', 'L = word length.'],
        ['Recursion depth', '—', 'O(depth)', 'Excluding the output, which can dominate.'],
      ],
    ),
    p(
      'Quote the output size separately from the working space. Subsets uses O(n) working memory but produces O(n · 2^n) of output, and interviewers often want to hear that distinction made explicitly.',
    ),

    h('Common mistakes'),
    ul(
      'Forgetting to un-choose, so state leaks into sibling branches.',
      'Storing the live path instead of a copy in Java — every result ends up the same object.',
      'Un-doing only part of the state. If you set used[i] and appended to path, undo both.',
      'Using i + 1 when reuse is allowed, or i when it is not. One character, completely different problem.',
      'Skipping duplicates with i > 0 instead of i > start, which drops valid combinations.',
      'Forgetting to sort before duplicate-skipping — the check only works on adjacent equals.',
      'Recording the answer at every node when only complete paths are valid, or only at leaves when every prefix counts.',
      'No pruning at all. Correct but exponential where a two-line check would have made it fast.',
    ),

    links(
      link('LeetCode Explore — Recursion II (Backtracking)', 'https://leetcode.com/explore/learn/card/recursion-ii/'),
      link('Java ArrayList — API reference', 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayList.html'),
    ),
  ],
};
