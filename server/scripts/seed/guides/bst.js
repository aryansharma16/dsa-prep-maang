import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from './blocks.js';

export default {
  patternSlug: 'bst',
  title: 'Binary Search Trees',
  summary: 'Inorder traversal of a BST is sorted — that single fact solves most BST problems.',
  blocks: [
    p(
      'A binary search tree adds one rule to a binary tree: everything in the left subtree is smaller than the node, everything in the right subtree is larger. That rule buys you two things. Searching becomes binary search — compare, then discard half the tree. And an inorder traversal visits the values in sorted order, which is the single most useful fact in this pattern.',
    ),
    p(
      'Most BST problems are really "do a sorted-array operation without building the sorted array". K-th smallest is the k-th step of an inorder walk. Validation is checking the walk is increasing. Finding a pair that sums to a target is two pointers over that walk. When you get stuck, ask what you would do with the sorted array, then work out how to do it during traversal.',
    ),
    p(
      'The catch is that all of this depends on the tree being balanced. A BST built from already-sorted input degenerates into a linked list, and every O(log n) claim becomes O(n). Real libraries — TreeMap in Java, std::map in C++ — use red-black trees that rebalance on insert, which is why they give guarantees a hand-rolled BST cannot.',
    ),

    h('When to reach for it'),
    ul(
      'The problem says the tree is a BST — that is a strong hint the ordering is the point.',
      'K-th smallest or largest, or a rank query.',
      'Validate a BST, or find the two nodes that were swapped to break it.',
      'Range queries: sum or count of values between low and high.',
      'Insert, delete, or find the closest value to a target.',
      'You need a sorted structure with O(log n) insert and lookup — that is TreeMap / std::map.',
    ),

    h('The core idea'),
    p(
      'Search by pruning. At each node the comparison tells you which half cannot contain the answer, so you never look at it. This is binary search with pointers instead of indices.',
    ),
    code(
      java(`
public TreeNode searchBST(TreeNode root, int val) {
    while (root != null && root.val != val) {
        root = val < root.val ? root.left : root.right;   // discard half
    }
    return root;
}
      `),
      cpp(`
TreeNode* searchBST(TreeNode* root, int val) {
    while (root && root->val != val) {
        root = val < root->val ? root->left : root->right;
    }
    return root;
}
      `),
    ),
    p(
      'Inorder is sorted. Left, node, right. Every "sorted" question about a BST reduces to running this walk and doing the obvious thing at the visit step.',
    ),
    code(
      java(`
// k-th smallest — stop as soon as you have counted k nodes
public int kthSmallest(TreeNode root, int k) {
    Deque<TreeNode> stack = new ArrayDeque<>();
    TreeNode curr = root;

    while (curr != null || !stack.isEmpty()) {
        while (curr != null) { stack.push(curr); curr = curr.left; }
        curr = stack.pop();
        if (--k == 0) return curr.val;        // early exit — no full traversal
        curr = curr.right;
    }
    return -1;
}
      `),
      cpp(`
int kthSmallest(TreeNode* root, int k) {
    stack<TreeNode*> st;
    TreeNode* curr = root;
    while (curr || !st.empty()) {
        while (curr) { st.push(curr); curr = curr->left; }
        curr = st.top(); st.pop();
        if (--k == 0) return curr->val;
        curr = curr->right;
    }
    return -1;
}
      `),
    ),
    tip(
      'The iterative inorder is worth preferring over the recursive one here precisely because you can stop early. A recursive walk has to unwind the whole stack or throw to get out.',
    ),

    h('Variations'),
    p(
      'Validation with range pruning. The common wrong answer checks only node against its immediate children, which passes trees that are not BSTs. The correct check carries a permitted (low, high) interval down and narrows it at each step.',
    ),
    code(
      java(`
public boolean isValidBST(TreeNode root) {
    return valid(root, null, null);      // Long/null bounds dodge the MIN/MAX trap
}

private boolean valid(TreeNode n, Integer low, Integer high) {
    if (n == null) return true;
    if (low  != null && n.val <= low)  return false;
    if (high != null && n.val >= high) return false;
    return valid(n.left, low, n.val)          // right bound tightens
        && valid(n.right, n.val, high);       // left bound tightens
}
      `),
      cpp(`
bool valid(TreeNode* n, long long low, long long high) {
    if (!n) return true;
    if (n->val <= low || n->val >= high) return false;
    return valid(n->left, low, n->val) && valid(n->right, n->val, high);
}
bool isValidBST(TreeNode* root) {
    return valid(root, LLONG_MIN, LLONG_MAX);
}
      `),
    ),
    warn(
      'Using Integer.MIN_VALUE and Integer.MAX_VALUE as the initial bounds fails when a node actually holds those values — a real LeetCode test case. Use null sentinels in Java, or widen to long long in C++.',
    ),
    p(
      'LCA in a BST. Cheaper than the general tree version: you do not need to search both sides. Walk down while both targets are on the same side; the first node that sits between them is the answer.',
    ),
    code(
      java(`
public TreeNode lca(TreeNode root, TreeNode p, TreeNode q) {
    while (root != null) {
        if (p.val < root.val && q.val < root.val)      root = root.left;
        else if (p.val > root.val && q.val > root.val) root = root.right;
        else return root;        // the split point
    }
    return null;
}
      `),
    ),
    p(
      'Deletion — the one genuinely fiddly operation. Three cases: no children, one child, two children. With two, replace the value with the inorder successor (the smallest node in the right subtree) and then delete that successor, which by construction has at most one child.',
    ),
    code(
      java(`
public TreeNode deleteNode(TreeNode root, int key) {
    if (root == null) return null;

    if (key < root.val)      root.left  = deleteNode(root.left, key);
    else if (key > root.val) root.right = deleteNode(root.right, key);
    else {
        if (root.left == null)  return root.right;   // 0 or 1 child
        if (root.right == null) return root.left;

        TreeNode succ = root.right;                  // smallest on the right
        while (succ.left != null) succ = succ.left;
        root.val = succ.val;                         // copy the value up
        root.right = deleteNode(root.right, succ.val);  // delete the duplicate
    }
    return root;
}
      `),
    ),
    p(
      'Range sum with pruning. Do not traverse the whole tree — the ordering lets you skip entire subtrees that cannot contain values in range.',
    ),
    code(
      java(`
public int rangeSumBST(TreeNode root, int low, int high) {
    if (root == null) return 0;
    if (root.val < low)  return rangeSumBST(root.right, low, high);  // skip left
    if (root.val > high) return rangeSumBST(root.left,  low, high);  // skip right
    return root.val
         + rangeSumBST(root.left,  low, high)
         + rangeSumBST(root.right, low, high);
}
      `),
    ),

    h('Language toolkit'),
    p('When the interview allows a library structure, these are the BSTs you already have.'),
    table(
      ['Java (TreeMap / TreeSet)', 'What it does', 'C++ equivalent'],
      [
        ['map.firstKey() / lastKey()', 'Smallest / largest key.', '*m.begin() / *m.rbegin()'],
        ['map.ceilingKey(k)', 'Smallest key >= k.', 'm.lower_bound(k)'],
        ['map.higherKey(k)', 'Smallest key > k.', 'm.upper_bound(k)'],
        ['map.floorKey(k)', 'Largest key <= k.', 'prev(m.upper_bound(k))'],
        ['map.lowerKey(k)', 'Largest key < k.', 'prev(m.lower_bound(k))'],
        ['map.subMap(a, b)', 'A view of the keys in [a, b).', 'lower_bound .. lower_bound'],
        ['map.headMap / tailMap', 'Everything below / above a key.', 'begin..lower_bound, etc.'],
        ['TreeSet<Integer>', 'Sorted set with the same navigation.', 'std::set<int>'],
        ['new TreeMap<>(cmp)', 'Custom ordering.', 'std::map<K,V,Cmp>'],
      ],
    ),
    p(
      'Note the naming: Java\'s ceiling/floor are inclusive and higher/lower are strict, while C++ gives you lower_bound (>=) and upper_bound (>) and expects you to build the rest from those. Mixing them up is a silent off-by-one.',
    ),

    h('Complexity'),
    table(
      ['Operation', 'Balanced', 'Degenerate', 'Note'],
      [
        ['Search / insert / delete', 'O(log n)', 'O(n)', 'A plain BST has no rebalancing.'],
        ['Inorder traversal', 'O(n)', 'O(n)', 'Sorted output.'],
        ['K-th smallest (walk)', 'O(h + k)', 'O(n)', 'Early exit once k nodes are seen.'],
        ['Validate', 'O(n)', 'O(n)', 'Every node must be checked.'],
        ['Range sum with pruning', 'O(h + m)', 'O(n)', 'm = nodes in range.'],
        ['TreeMap / std::map ops', 'O(log n)', 'O(log n)', 'Red-black tree — guaranteed.'],
      ],
    ),

    h('Common mistakes'),
    ul(
      'Validating against immediate children only. A node deep in the left subtree can still be larger than the root, and the naive check misses it.',
      'Using Integer.MIN_VALUE / MAX_VALUE as validation bounds, which breaks on nodes holding those exact values.',
      'Assuming O(log n). Say "O(h), which is O(log n) only if the tree is balanced" — interviewers listen for that.',
      'Getting duplicates wrong. Decide whether equal values live left or right, or are disallowed, and be consistent — validation with <= versus < depends on it.',
      'In deletion, copying the predecessor when your code then deletes from the right subtree, or vice versa. Pick successor-from-the-right and stay with it.',
      'Traversing the whole tree for a range query instead of pruning.',
      'Confusing ceiling with higher (or lower_bound with upper_bound) — one is inclusive, one is not.',
    ),

    links(
      link('Java TreeMap — API reference', 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/TreeMap.html'),
      link('LeetCode Explore — Binary Search Tree', 'https://leetcode.com/explore/learn/card/introduction-to-data-structure-binary-search-tree/'),
      link('C++ std::map — reference', 'https://en.cppreference.com/w/cpp/container/map'),
    ),
  ],
};
