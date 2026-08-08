import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from './blocks.js';

export default {
  patternSlug: 'trees',
  title: 'Binary Trees',
  summary: 'Decide what each node needs from its children, then let recursion do the walking.',
  blocks: [
    p(
      'Every binary tree problem is the same problem: define what a node should return to its parent, and trust the recursion to supply that value for the children. If you can finish the sentence "for this node, given the answer for the left subtree and the answer for the right subtree, the answer is …", you have written the solution. The recursive call is not something to trace through in your head — it is an assumption you are allowed to make.',
    ),
    p(
      'That is why these problems feel hard until suddenly they do not. People try to simulate the recursion mentally, three levels deep, and lose track. The discipline is the opposite: assume the calls work, write the combination step, then add the base case that stops it. Two lines of thought, in that order.',
    ),
    p(
      'The second axis is traversal order, and it matters more than it looks. Preorder handles the node before its children — good for copying or serialising. Inorder gives a BST in sorted order. Postorder handles children first — the only choice when the parent needs results from below, which is most "compute something about the subtree" problems. BFS by level is a different animal entirely and needs a queue.',
    ),

    h('When to reach for it'),
    ul(
      'Depth, height, diameter, balance — anything measured over subtrees.',
      'Path problems: root-to-leaf sums, maximum path sum, paths that satisfy a condition.',
      '"Level order", "by depth", "rightmost node of each row" — that is BFS with a queue.',
      'Structural questions: same tree, symmetric, subtree of another, invert.',
      'Lowest common ancestor, serialise/deserialise, building a tree from traversals.',
    ),

    h('The core idea'),
    p(
      'Return-value recursion. The shape below is the one to internalise — base case first, recurse into both children, combine. Maximum depth is the smallest possible example and everything else is a variation on it.',
    ),
    code(
      java(`
public int maxDepth(TreeNode root) {
    if (root == null) return 0;                    // base case: empty is depth 0
    int left  = maxDepth(root.left);               // assume this works
    int right = maxDepth(root.right);
    return 1 + Math.max(left, right);              // combine
}
      `),
      cpp(`
int maxDepth(TreeNode* root) {
    if (!root) return 0;
    int left  = maxDepth(root->left);
    int right = maxDepth(root->right);
    return 1 + max(left, right);
}
      `),
    ),
    p(
      'When the answer is not the same thing you return. Diameter is the classic trap: each node must return its height to its parent, but the answer you want is the longest path through any node. Two different quantities — so return one and accumulate the other in a field.',
    ),
    code(
      java(`
private int best = 0;

public int diameterOfBinaryTree(TreeNode root) {
    best = 0;
    height(root);
    return best;
}

// returns HEIGHT; updates the answer as a side effect
private int height(TreeNode node) {
    if (node == null) return 0;
    int l = height(node.left);
    int r = height(node.right);
    best = Math.max(best, l + r);      // path through this node, in edges
    return 1 + Math.max(l, r);         // what the parent needs
}
      `),
      cpp(`
int best = 0;

int height(TreeNode* node) {
    if (!node) return 0;
    int l = height(node->left);
    int r = height(node->right);
    best = max(best, l + r);
    return 1 + max(l, r);
}

int diameterOfBinaryTree(TreeNode* root) {
    best = 0;
    height(root);
    return best;
}
      `),
    ),
    tip(
      'Whenever the quantity you report upward differs from the quantity you are asked for, that is the signal to use a field (or a reference parameter) for the answer and let the return value carry the recursion. Trying to make one value do both jobs is where these solutions go wrong.',
    ),

    h('Variations'),
    p(
      'BFS by level. A queue, and the crucial detail is capturing the queue size before the inner loop — that snapshot is exactly one level, and it stops you draining nodes that were just enqueued.',
    ),
    code(
      java(`
public List<List<Integer>> levelOrder(TreeNode root) {
    List<List<Integer>> out = new ArrayList<>();
    if (root == null) return out;

    Deque<TreeNode> q = new ArrayDeque<>();
    q.add(root);

    while (!q.isEmpty()) {
        int levelSize = q.size();              // snapshot BEFORE adding children
        List<Integer> level = new ArrayList<>(levelSize);
        for (int i = 0; i < levelSize; i++) {
            TreeNode n = q.poll();
            level.add(n.val);
            if (n.left  != null) q.add(n.left);
            if (n.right != null) q.add(n.right);
        }
        out.add(level);
    }
    return out;
}
      `),
      cpp(`
vector<vector<int>> levelOrder(TreeNode* root) {
    vector<vector<int>> out;
    if (!root) return out;

    queue<TreeNode*> q;
    q.push(root);
    while (!q.empty()) {
        int levelSize = q.size();
        vector<int> level;
        for (int i = 0; i < levelSize; i++) {
            TreeNode* n = q.front(); q.pop();
            level.push_back(n->val);
            if (n->left)  q.push(n->left);
            if (n->right) q.push(n->right);
        }
        out.push_back(level);
    }
    return out;
}
      `),
    ),
    p(
      'Path tracking. When the answer is a path rather than a number, carry a list down and undo the append on the way out. That undo is the same choose/un-choose discipline as backtracking, and forgetting it leaks state into sibling branches.',
    ),
    code(
      java(`
public List<List<Integer>> pathSum(TreeNode root, int target) {
    List<List<Integer>> out = new ArrayList<>();
    walk(root, target, new ArrayList<>(), out);
    return out;
}

private void walk(TreeNode n, int remaining, List<Integer> path, List<List<Integer>> out) {
    if (n == null) return;

    path.add(n.val);                                   // choose
    if (n.left == null && n.right == null && remaining == n.val) {
        out.add(new ArrayList<>(path));                // copy! path keeps mutating
    } else {
        walk(n.left,  remaining - n.val, path, out);
        walk(n.right, remaining - n.val, path, out);
    }
    path.remove(path.size() - 1);                      // un-choose
}
      `),
    ),
    warn(
      'out.add(path) without the copy adds a reference to the one list you keep mutating — every entry in the result ends up identical, and usually empty. new ArrayList<>(path) is not optional.',
    ),
    p(
      'Lowest common ancestor. A beautiful use of return-value recursion: return the node if you find either target, and a node that receives non-null from both sides is the answer.',
    ),
    code(
      java(`
public TreeNode lca(TreeNode root, TreeNode p, TreeNode q) {
    if (root == null || root == p || root == q) return root;

    TreeNode left  = lca(root.left,  p, q);
    TreeNode right = lca(root.right, p, q);

    if (left != null && right != null) return root;   // split here — this is the LCA
    return left != null ? left : right;               // both targets are on one side
}
      `),
    ),
    p(
      'Iterative traversal, when recursion is banned or the tree is deep enough to blow the stack. Inorder with an explicit stack is the one worth knowing.',
    ),
    code(
      java(`
public List<Integer> inorderTraversal(TreeNode root) {
    List<Integer> out = new ArrayList<>();
    Deque<TreeNode> stack = new ArrayDeque<>();
    TreeNode curr = root;

    while (curr != null || !stack.isEmpty()) {
        while (curr != null) { stack.push(curr); curr = curr.left; }  // go left
        curr = stack.pop();
        out.add(curr.val);                                            // visit
        curr = curr.right;                                            // then right
    }
    return out;
}
      `),
    ),

    h('Language toolkit'),
    table(
      ['Java', 'What it does', 'C++ equivalent'],
      [
        ['Deque<TreeNode> q = new ArrayDeque<>()', 'BFS queue. Faster than LinkedList.', 'queue<TreeNode*> q'],
        ['q.add(x) / q.poll()', 'Enqueue / dequeue, null if empty.', 'q.push(x) / q.front(); q.pop()'],
        ['q.size()', 'Level width — snapshot it.', 'q.size()'],
        ['new ArrayList<>(path)', 'Defensive copy when recording a path.', 'vector<int>(path) — copies by default'],
        ['path.remove(path.size() - 1)', 'Un-choose on the way out.', 'path.pop_back()'],
        ['Integer.MIN_VALUE', 'Sentinel for max-path problems.', 'INT_MIN'],
        ['root == p', 'Node identity, the right test for LCA.', 'root == p'],
      ],
    ),

    h('Complexity'),
    table(
      ['Operation', 'Time', 'Space', 'Note'],
      [
        ['Any full traversal', 'O(n)', 'O(h)', 'h = height; the recursion stack.'],
        ['Balanced tree height', 'O(log n)', '—', 'Best-case stack depth.'],
        ['Degenerate (list-like) tree', 'O(n)', 'O(n)', 'Worst-case stack depth — the overflow risk.'],
        ['BFS level order', 'O(n)', 'O(w)', 'w = widest level, up to n/2 at the bottom.'],
        ['Path enumeration', 'O(n·h)', 'O(h)', 'Copying each found path costs its length.'],
        ['LCA', 'O(n)', 'O(h)', 'One pass, no parent pointers needed.'],
      ],
    ),
    p(
      'Quote the space as O(h) rather than O(log n) unless the tree is stated to be balanced. Interviewers ask about the skewed case specifically, and a tree of 10^5 nodes in a straight line will overflow the default JVM stack.',
    ),

    h('Common mistakes'),
    ul(
      'Missing or wrong base case. null must return the identity for whatever you are combining — 0 for depth, true for validity, null for a search.',
      'Adding the live path list to the results instead of a copy.',
      'Forgetting to un-choose after recursing, so state leaks between branches.',
      'Reading q.size() inside the BFS loop instead of snapshotting it, mixing levels together.',
      'Confusing height (edges below) with depth (edges above) — pick one definition and be consistent, because it shifts every answer by one.',
      'Assuming a leaf is any node with a null child. A leaf has both children null.',
      'Trying to return both the recursion value and the answer from one function when they are different quantities.',
    ),

    tip(
      'Say the recurrence out loud before writing: "maxDepth of a node is one plus the larger of its children\'s depths; an empty tree has depth zero." If you can say it, you can write it. If you cannot, more code will not help.',
    ),

    links(
      link('LeetCode Explore — Binary Tree', 'https://leetcode.com/explore/learn/card/data-structure-tree/'),
      link('Java ArrayDeque — API reference', 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayDeque.html'),
    ),
  ],
};
