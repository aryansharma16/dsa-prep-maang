import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from './blocks.js';

export default {
  patternSlug: 'design',
  title: 'Design',
  summary: 'Compose the primitives you already know to hit a target complexity per operation.',
  blocks: [
    p(
      'Design problems do not ask you to invent an algorithm. They give you a set of operations — get, put, insert, remove, getRandom — and a required complexity for each, usually O(1), and ask you to build something that meets it. The answer is always a combination of two data structures you already know, chosen so that each one covers the other\'s weakness.',
    ),
    p(
      'That is the entire method. Write down every operation with its required cost. For each, ask which structure gives you that cost. A hash map gives O(1) lookup by key but no ordering. A doubly linked list gives O(1) insertion and removal at a known position but no lookup. An array gives O(1) random access but O(n) removal from the middle. None of them does everything, so you keep two and maintain the invariant that links them.',
    ),
    p(
      'The reason interviewers like these is that the difficulty is not cleverness, it is bookkeeping — every operation has to update both structures consistently, and forgetting one path leaves a stale entry that surfaces much later. Getting that right under time pressure is exactly the skill they are testing.',
    ),

    h('When to reach for it'),
    ul(
      'The problem statement is a class with methods rather than a single function.',
      'Explicit per-operation complexity requirements, usually "all operations in O(1)".',
      'LRU or LFU cache, a randomised set, a hit counter, a rate limiter.',
      'Implement one structure using another — a queue from two stacks, a stack from two queues.',
      'An iterator, a tokeniser, or anything with hasNext / next semantics.',
      'Serialise and deserialise a structure.',
    ),

    h('The core idea'),
    p(
      'Hash map plus doubly linked list — the LRU cache, and the canonical example of the whole pattern. The map gives O(1) lookup from key to node; the list gives O(1) reordering because you already hold the node and its neighbours. Dummy head and tail nodes remove every null check from the splice operations.',
    ),
    code(
      java(`
class LRUCache {
    private static class Node {
        int key, value;
        Node prev, next;
        Node(int k, int v) { key = k; value = v; }
    }

    private final Map<Integer, Node> map = new HashMap<>();
    private final Node head = new Node(0, 0);   // dummy: most recent side
    private final Node tail = new Node(0, 0);   // dummy: least recent side
    private final int capacity;

    LRUCache(int capacity) {
        this.capacity = capacity;
        head.next = tail;
        tail.prev = head;                        // empty list, no nulls anywhere
    }

    public int get(int key) {
        Node node = map.get(key);
        if (node == null) return -1;
        moveToFront(node);                       // touching it makes it recent
        return node.value;
    }

    public void put(int key, int value) {
        Node existing = map.get(key);
        if (existing != null) {
            existing.value = value;
            moveToFront(existing);
            return;
        }
        if (map.size() == capacity) {
            Node lru = tail.prev;                // the node just before the tail
            remove(lru);
            map.remove(lru.key);                 // BOTH structures — this is the bug
        }
        Node node = new Node(key, value);
        map.put(key, node);
        addFirst(node);
    }

    private void remove(Node n) {                // O(1): we already hold the node
        n.prev.next = n.next;
        n.next.prev = n.prev;
    }
    private void addFirst(Node n) {
        n.next = head.next;
        n.prev = head;
        head.next.prev = n;
        head.next = n;
    }
    private void moveToFront(Node n) { remove(n); addFirst(n); }
}
      `),
      cpp(`
class LRUCache {
    struct Node {
        int key, value;
        Node *prev = nullptr, *next = nullptr;
        Node(int k, int v) : key(k), value(v) {}
    };

    unordered_map<int, Node*> map;
    Node* head = new Node(0, 0);
    Node* tail = new Node(0, 0);
    int capacity;

    void remove(Node* n) { n->prev->next = n->next; n->next->prev = n->prev; }
    void addFirst(Node* n) {
        n->next = head->next; n->prev = head;
        head->next->prev = n; head->next = n;
    }

public:
    LRUCache(int cap) : capacity(cap) { head->next = tail; tail->prev = head; }

    int get(int key) {
        auto it = map.find(key);
        if (it == map.end()) return -1;
        remove(it->second); addFirst(it->second);
        return it->second->value;
    }

    void put(int key, int value) {
        auto it = map.find(key);
        if (it != map.end()) {
            it->second->value = value;
            remove(it->second); addFirst(it->second);
            return;
        }
        if ((int)map.size() == capacity) {
            Node* lru = tail->prev;
            remove(lru);
            map.erase(lru->key);
            delete lru;                     // C++ owns its memory
        }
        Node* node = new Node(key, value);
        map[key] = node;
        addFirst(node);
    }
};
      `),
    ),
    warn(
      'Evicting from the list but forgetting map.remove(lru.key) is the defining bug of this problem. The cache appears to work, then a later get returns a node that is no longer in the list, and the corruption surfaces far from its cause. Every operation must update both structures.',
    ),
    tip(
      'Java has LinkedHashMap with access-order mode, which is an LRU cache in about five lines. Mention that you know it, then write the two-structure version — the interviewer is asking for the mechanism, not the library.',
    ),

    h('Variations'),
    p(
      'Array plus index map — O(1) insert, remove and random pick. The trick for O(1) removal from the middle of an array is to swap the doomed element with the last one and shrink, which keeps the array dense so a random index is always valid.',
    ),
    code(
      java(`
class RandomizedSet {
    private final List<Integer> values = new ArrayList<>();
    private final Map<Integer, Integer> index = new HashMap<>();   // value -> position
    private final Random random = new Random();

    public boolean insert(int val) {
        if (index.containsKey(val)) return false;
        index.put(val, values.size());
        values.add(val);
        return true;
    }

    public boolean remove(int val) {
        Integer pos = index.get(val);
        if (pos == null) return false;

        int last = values.get(values.size() - 1);
        values.set(pos, last);          // move the last element into the hole
        index.put(last, pos);           // and fix its recorded position
        values.remove(values.size() - 1);
        index.remove(val);
        return true;
    }

    public int getRandom() {
        return values.get(random.nextInt(values.size()));   // dense: any index works
    }
}
      `),
      cpp(`
class RandomizedSet {
    vector<int> values;
    unordered_map<int, int> index;
public:
    bool insert(int val) {
        if (index.count(val)) return false;
        index[val] = values.size();
        values.push_back(val);
        return true;
    }
    bool remove(int val) {
        auto it = index.find(val);
        if (it == index.end()) return false;
        int pos = it->second, last = values.back();
        values[pos] = last;
        index[last] = pos;
        values.pop_back();
        index.erase(it);
        return true;
    }
    int getRandom() { return values[rand() % values.size()]; }
};
      `),
    ),
    p(
      'Two stacks making a queue. Push onto the inbox; pop from the outbox, refilling it from the inbox only when it is empty. Each element moves between the stacks exactly once, so the amortised cost is O(1) even though a single pop can be O(n).',
    ),
    code(
      java(`
class MyQueue {
    private final Deque<Integer> in  = new ArrayDeque<>();
    private final Deque<Integer> out = new ArrayDeque<>();

    public void push(int x) { in.push(x); }

    public int pop() {
        shift();
        return out.pop();
    }
    public int peek() {
        shift();
        return out.peek();
    }

    // Only refill when out is empty — refilling early breaks the ordering
    private void shift() {
        if (out.isEmpty()) {
            while (!in.isEmpty()) out.push(in.pop());
        }
    }
}
      `),
    ),
    p(
      'Heap plus lazy deletion. Neither language lets you remove an arbitrary element from a priority queue cheaply, so instead of deleting you mark and skip. Anything stale that reaches the top is discarded on the way out.',
    ),
    code(
      java(`
// Discard entries that have been superseded
private void purge() {
    while (!heap.isEmpty() && isStale(heap.peek())) heap.poll();
}
public int top() { purge(); return heap.peek(); }
      `),
    ),
    p(
      'A queue as a sliding time window. Hit counters and rate limiters are a queue of timestamps with everything older than the window evicted from the front — no arithmetic, just eviction.',
    ),
    code(
      java(`
class HitCounter {
    private final Deque<Integer> hits = new ArrayDeque<>();

    public void hit(int timestamp) { hits.addLast(timestamp); }

    public int getHits(int timestamp) {
        while (!hits.isEmpty() && hits.peekFirst() <= timestamp - 300) {
            hits.pollFirst();      // outside the 5-minute window
        }
        return hits.size();
    }
}
      `),
    ),

    h('Language toolkit'),
    table(
      ['Java', 'What it does', 'C++ equivalent'],
      [
        ['HashMap<K, Node>', 'O(1) key to node.', 'unordered_map<K, Node*>'],
        ['LinkedHashMap(cap, 0.75f, true)', 'Access-order map — LRU for free.', 'no equivalent — build it'],
        ['ArrayDeque', 'Stack and queue in one class.', 'std::stack / std::queue / std::deque'],
        ['ArrayList + index map', 'O(1) insert, remove, random.', 'vector + unordered_map'],
        ['Random.nextInt(n)', 'Uniform index in [0, n).', 'rand() % n / uniform_int_distribution'],
        ['TreeMap', 'Ordered keys with O(log n) navigation.', 'std::map'],
        ['PriorityQueue', 'Best-so-far with lazy deletion.', 'std::priority_queue'],
        ['dummy head/tail nodes', 'Removes every null check.', 'same idea'],
      ],
    ),
    warn(
      'In C++ every node you new must eventually be deleted, including the dummies and anything evicted. In an interview, say where the deletes go even if you do not write them all — leaking an entire cache is a real answer to "what happens as this runs".',
    ),

    h('Complexity'),
    table(
      ['Design', 'Operations', 'Space', 'Note'],
      [
        ['LRU cache', 'O(1) get and put', 'O(capacity)', 'Map + doubly linked list.'],
        ['LFU cache', 'O(1) get and put', 'O(capacity)', 'Two maps + a min-frequency counter.'],
        ['Randomised set', 'O(1) all three', 'O(n)', 'Swap-with-last keeps the array dense.'],
        ['Queue from two stacks', 'O(1) amortised', 'O(n)', 'A single pop can be O(n).'],
        ['Min-stack', 'O(1) getMin', 'O(n)', 'A parallel stack of minima.'],
        ['Hit counter', 'O(1) amortised', 'O(hits in window)', 'Each timestamp evicted once.'],
        ['Heap with lazy deletion', 'O(log n) amortised', 'O(n)', 'Stale entries pay for themselves.'],
      ],
    ),
    p(
      'Amortised is the right word for several of these, and it is worth saying explicitly. In the two-stack queue one dequeue can move n elements, but each element is moved between stacks exactly once across its whole lifetime, so the average is constant.',
    ),

    h('Common mistakes'),
    ul(
      'Updating one structure and not the other — the stale-entry bug that defines this pattern.',
      'Omitting the dummy head and tail, then handling four null cases in every splice.',
      'Refilling the outbox stack while it still has elements, which reverses the queue order.',
      'Removing from the middle of an ArrayList with remove(index), which is O(n). Swap with the last element instead.',
      'Forgetting that put on an existing key must refresh recency, not just overwrite the value.',
      'Leaving the capacity check after the insert, so the cache briefly exceeds its limit.',
      'Reaching for a TreeMap when the requirement is O(1). O(log n) is not O(1), and interviewers do check.',
      'Leaking nodes in C++ on eviction.',
    ),

    tip(
      'Write the operation table before any code: each method, its required complexity, and the structure that provides it. The design falls out of that table, and so does the list of invariants you have to maintain.',
    ),

    links(
      link('Java LinkedHashMap — API reference', 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/LinkedHashMap.html'),
      link('Java ArrayDeque — API reference', 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayDeque.html'),
      link('LeetCode Explore — Queue & Stack', 'https://leetcode.com/explore/learn/card/queue-stack/'),
    ),
  ],
};
