import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from './blocks.js';

export default {
  patternSlug: 'tries',
  title: 'Tries',
  summary:
    'Share prefixes across strings to make lookup depend on word length, not dictionary size.',
  blocks: [
    p(
      'A hash set can tell you whether "apple" is in the dictionary. It cannot tell you whether anything in the dictionary starts with "app" — for that you would have to check every entry. A trie fixes exactly that. It stores strings as paths through a tree, one character per edge, so every word sharing a prefix shares the path for it. Walking "a", "p", "p" lands you at a node whose entire subtree is the set of words with that prefix.',
    ),
    p(
      'The consequence is that lookup costs O(length of the word), completely independent of how many words are stored. A trie with ten words and a trie with ten million answer a five-character query in the same five steps. That is the trade: you spend a lot of memory on nodes to make the dictionary size irrelevant.',
    ),
    p(
      'The other reason tries earn their place is that they combine with search. Doing a DFS over a grid while simultaneously walking a trie lets you prune the moment the current path stops being a prefix of any word — which turns an intractable word-search into something that finishes.',
    ),

    h('When to reach for it'),
    ul(
      'Autocomplete, prefix search, "words starting with", or a search-suggestions system.',
      'You will run many queries against one fixed dictionary — build cost amortises.',
      'Wildcard matching where "." can be any character, which needs branching a hash map cannot do.',
      'Word Search II — a grid DFS that must prune against a whole word list.',
      'Maximum XOR of two numbers, using a bitwise trie over the binary representation.',
      'Longest common prefix across many strings.',
    ),
    warn(
      'If you only ever ask "is this exact word present", a HashSet is smaller, faster and three lines long. A trie is only worth it when prefixes matter.',
    ),

    h('The core idea'),
    p(
      'A node holds an array of children — one slot per possible character — plus a flag marking whether a word ends here. That flag is essential and separate from having children: "app" can be a word while "appl" is only a waypoint.',
    ),
    code(
      java(`
class Trie {
    private static class Node {
        Node[] next = new Node[26];     // fixed alphabet: a-z
        boolean isWord = false;         // a word ENDS here (not just passes through)
    }
    private final Node root = new Node();

    public void insert(String word) {
        Node curr = root;
        for (char c : word.toCharArray()) {
            int i = c - 'a';
            if (curr.next[i] == null) curr.next[i] = new Node();
            curr = curr.next[i];
        }
        curr.isWord = true;
    }

    public boolean search(String word) {
        Node n = walk(word);
        return n != null && n.isWord;       // must be a terminal, not a waypoint
    }

    public boolean startsWith(String prefix) {
        return walk(prefix) != null;        // existence of the path is enough
    }

    private Node walk(String s) {
        Node curr = root;
        for (char c : s.toCharArray()) {
            curr = curr.next[c - 'a'];
            if (curr == null) return null;
        }
        return curr;
    }
}
      `),
      cpp(`
class Trie {
    struct Node {
        Node* next[26] = {};       // value-initialised to nullptr
        bool isWord = false;
    };
    Node* root = new Node();

    Node* walk(const string& s) {
        Node* curr = root;
        for (char c : s) {
            curr = curr->next[c - 'a'];
            if (!curr) return nullptr;
        }
        return curr;
    }

public:
    void insert(const string& word) {
        Node* curr = root;
        for (char c : word) {
            int i = c - 'a';
            if (!curr->next[i]) curr->next[i] = new Node();
            curr = curr->next[i];
        }
        curr->isWord = true;
    }
    bool search(const string& word)    { Node* n = walk(word); return n && n->isWord; }
    bool startsWith(const string& pre) { return walk(pre) != nullptr; }
};
      `),
    ),
    tip(
      'The array-of-26 layout is fastest but wastes 26 pointers per node even for a node with one child. Swap it for a HashMap<Character, Node> when the alphabet is large or unknown — the code is otherwise identical, and memory drops sharply on sparse dictionaries.',
    ),

    h('Variations'),
    p(
      'Wildcard search. Once a "." can match anything, lookup stops being a walk and becomes a search: at a wildcard you must try every child. This is where the trie beats every flat structure, because the branching happens over a shared prefix rather than the whole dictionary.',
    ),
    code(
      java(`
public boolean search(String word) {
    return dfs(word, 0, root);
}

private boolean dfs(String word, int i, Node node) {
    if (node == null) return false;
    if (i == word.length()) return node.isWord;

    char c = word.charAt(i);
    if (c == '.') {
        for (Node child : node.next) {                 // try every branch
            if (dfs(word, i + 1, child)) return true;
        }
        return false;
    }
    return dfs(word, i + 1, node.next[c - 'a']);
}
      `),
      cpp(`
bool dfs(const string& word, int i, Node* node) {
    if (!node) return false;
    if (i == (int)word.size()) return node->isWord;

    char c = word[i];
    if (c == '.') {
        for (Node* child : node->next) {
            if (dfs(word, i + 1, child)) return true;
        }
        return false;
    }
    return dfs(word, i + 1, node->next[c - 'a']);
}
      `),
    ),
    p(
      'Trie plus grid DFS — Word Search II. Build a trie of the target words, then walk the board carrying a trie pointer. The instant the current cell has no matching child, the whole branch dies. Storing the finished word on the terminal node saves rebuilding strings, and nulling it out after a hit de-duplicates results for free.',
    ),
    code(
      java(`
private void dfs(char[][] board, int r, int c, Node node, List<String> out) {
    if (r < 0 || c < 0 || r >= board.length || c >= board[0].length) return;

    char ch = board[r][c];
    if (ch == '#') return;                       // already on the current path
    Node next = node.next[ch - 'a'];
    if (next == null) return;                    // prune: no word has this prefix

    if (next.word != null) {
        out.add(next.word);
        next.word = null;                        // found once is enough
    }

    board[r][c] = '#';                           // mark visited
    dfs(board, r + 1, c, next, out);
    dfs(board, r - 1, c, next, out);
    dfs(board, r, c + 1, next, out);
    dfs(board, r, c - 1, next, out);
    board[r][c] = ch;                            // restore on the way out
}
      `),
    ),
    p(
      'Bitwise trie. Treat a 32-bit integer as a 32-character string over the alphabet {0, 1}. To maximise a XOR against a set of numbers, walk from the high bit and greedily take the opposite branch whenever it exists — each opposite bit contributes its full place value.',
    ),
    code(
      java(`
// Maximum XOR of a query against everything inserted
public int maxXor(int num) {
    Node curr = root;
    int best = 0;
    for (int b = 31; b >= 0; b--) {
        int bit = (num >> b) & 1;
        int want = 1 - bit;                       // opposite bit maximises XOR
        if (curr.next[want] != null) {
            best |= (1 << b);
            curr = curr.next[want];
        } else {
            curr = curr.next[bit];                // forced to match
        }
    }
    return best;
}
      `),
    ),

    h('Language toolkit'),
    table(
      ['Java', 'What it does', 'C++ equivalent'],
      [
        ['Node[] next = new Node[26]', 'Children, null-filled by the JVM.', 'Node* next[26] = {};'],
        ['new HashMap<Character, Node>()', 'Sparse alternative for big alphabets.', 'unordered_map<char, Node*>'],
        ['c - \'a\'', 'Character to index 0..25.', "c - 'a'"],
        ['boolean isWord', 'Terminal marker, distinct from having children.', 'bool isWord'],
        ['String word on the node', 'Avoids rebuilding the string at a hit.', 'string word'],
        ['for (Node child : node.next)', 'Iterate all branches for a wildcard.', 'for (Node* c : node->next)'],
        ['—', 'Nodes are garbage collected.', 'delete recursively, or use unique_ptr'],
      ],
    ),
    warn(
      'In C++ a hand-rolled trie leaks unless you free it. Either write a recursive destructor or store children as std::unique_ptr<Node> so the tree tears itself down. In an interview, say which one you would do — nobody minds you skipping it, but they notice if you never mention it.',
    ),

    h('Complexity'),
    table(
      ['Operation', 'Time', 'Space', 'Note'],
      [
        ['Insert a word of length L', 'O(L)', 'O(L) new nodes worst case', 'Shared prefixes cost nothing extra.'],
        ['Search / startsWith', 'O(L)', 'O(1)', 'Independent of dictionary size.'],
        ['Build over n words', 'O(n·L)', 'O(n·L·A) worst case', 'A = alphabet size, 26 pointers per node.'],
        ['Wildcard search', 'O(A^d · L)', 'O(L)', 'd = number of dots; branching is the cost.'],
        ['HashSet exact lookup', 'O(L) to hash', 'O(n·L)', 'Cheaper — use it when prefixes do not matter.'],
      ],
    ),
    p(
      'The memory line is the honest weakness. Every node in the array layout carries 26 pointers whether or not it uses them — on a 64-bit JVM that is over 200 bytes per node before the object header. A map-backed node is slower per step but can be an order of magnitude smaller on sparse data.',
    ),

    h('Common mistakes'),
    ul(
      'Treating "the path exists" as "the word exists". Check isWord for search, only path existence for startsWith.',
      'Forgetting to mark isWord at the end of insert, so nothing is ever found.',
      'Indexing next[c - \'a\'] on input that is not lowercase a-z. Check the constraints.',
      'In grid DFS, restoring the visited marker on some return paths but not all — restore once, after all four recursions.',
      'Not nulling the stored word after a hit, producing duplicates in the output.',
      'Building a trie for a single membership query. That is a HashSet.',
      'Leaking every node in C++ by never freeing the tree.',
    ),

    tip(
      'A trie node means "the set of words with this prefix". Every method is a sentence about that set: insert extends it, search asks whether the prefix is itself a word, startsWith asks whether the set is non-empty.',
    ),

    links(
      link('LeetCode Explore — Trie', 'https://leetcode.com/explore/learn/card/trie/'),
      link('Java HashMap — API reference', 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/HashMap.html'),
    ),
  ],
};
