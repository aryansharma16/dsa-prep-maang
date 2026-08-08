import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from './blocks.js';

export default {
  patternSlug: 'heap',
  title: 'Heap / Priority Queue',
  summary: 'When you only ever need the best-so-far, a heap beats sorting everything.',
  blocks: [
    p(
      'Sorting an array gives you every element in order. A heap gives you only the smallest — or largest — and that is usually all the question wanted. Building a heap and pulling the top k items costs O(n + k log n); sorting to get the same k costs O(n log n). When k is small and n is large, that difference is the whole answer.',
    ),
    p(
      'The real leverage comes from streaming. A heap does not need the input up front. Keep a heap of size k while data arrives, evict the worst whenever it overflows, and you have the top k of an unbounded stream in O(k) memory. No amount of sorting can do that, because sorting needs the whole array.',
    ),
    p(
      'The one counter-intuitive move — and it comes up constantly — is that to keep the k largest elements you use a min-heap, not a max-heap. The heap holds your current winners, and the thing you need cheap access to is the weakest of them, because that is the one a new arrival has to beat. Get this backwards and the solution inverts.',
    ),

    h('When to reach for it'),
    ul(
      '"Top K", "K largest", "K closest", "K most frequent" — anything with a K in it.',
      'A running median, or any statistic that needs both ends of a distribution.',
      'Merging k sorted lists or arrays.',
      'Scheduling: always process the task with the earliest deadline, the cheapest cost, the nearest point.',
      "Dijkstra's and Prim's, where the heap is the engine of the algorithm.",
      'The data arrives as a stream and you cannot hold or sort all of it.',
    ),

    h('The core idea'),
    p(
      'Java and C++ default to opposite ends, and this is the single most common source of confusion. Java\'s PriorityQueue documentation says "the head of this queue is the least element" — a min-heap. C++\'s priority_queue defaults to std::less, which puts the largest element on top — a max-heap. Whichever language you use, get the inversion right before writing anything else.',
    ),
    code(
      java(`
// Java: min-heap by default
PriorityQueue<Integer> minHeap = new PriorityQueue<>();

// max-heap needs an explicit comparator
PriorityQueue<Integer> maxHeap = new PriorityQueue<>(Comparator.reverseOrder());

minHeap.offer(5); minHeap.offer(1); minHeap.offer(3);
minHeap.peek();   // 1  — smallest, O(1)
minHeap.poll();   // 1  — removes it, O(log n)
      `),
      cpp(`
// C++: max-heap by default (Compare = std::less)
priority_queue<int> maxHeap;

// min-heap needs the comparator spelled out
priority_queue<int, vector<int>, greater<int>> minHeap;

maxHeap.push(5); maxHeap.push(1); maxHeap.push(3);
maxHeap.top();   // 5  — largest, O(1)
maxHeap.pop();   // removes it, O(log n) — returns void
      `),
    ),
    p(
      'Top K with a bounded heap. Keep exactly k elements. When a new one arrives, push it and evict the smallest — the heap never grows past k, so memory is O(k) regardless of input size.',
    ),
    code(
      java(`
// K largest elements, O(n log k) time, O(k) space
public int[] topK(int[] nums, int k) {
    PriorityQueue<Integer> heap = new PriorityQueue<>();   // MIN-heap of the winners
    for (int n : nums) {
        heap.offer(n);
        if (heap.size() > k) heap.poll();    // evict the weakest survivor
    }
    int[] out = new int[k];
    for (int i = 0; i < k; i++) out[i] = heap.poll();
    return out;
}
      `),
      cpp(`
vector<int> topK(vector<int>& nums, int k) {
    priority_queue<int, vector<int>, greater<int>> heap;   // MIN-heap
    for (int n : nums) {
        heap.push(n);
        if ((int)heap.size() > k) heap.pop();
    }
    vector<int> out;
    while (!heap.empty()) { out.push_back(heap.top()); heap.pop(); }
    return out;
}
      `),
    ),
    tip(
      'If k is close to n, just sort — O(n log n) beats O(n log k) in constant factors once k stops being small, and it is less code to get wrong. The heap wins when k is genuinely small or the input is a stream.',
    ),

    h('Variations'),
    p(
      'Custom ordering. Most real problems heap something richer than an int. In Java pass a Comparator; in C++ pass a comparator type, and note the sense is inverted — the comparator answers "does a come before b in priority", so returning a > b gives you a min-heap.',
    ),
    code(
      java(`
// K closest points to the origin — max-heap on distance, evict the farthest
PriorityQueue<int[]> heap = new PriorityQueue<>(
    (a, b) -> (b[0]*b[0] + b[1]*b[1]) - (a[0]*a[0] + a[1]*a[1])
);
for (int[] p : points) {
    heap.offer(p);
    if (heap.size() > k) heap.poll();   // drops the farthest
}

// Comparator.comparingInt is clearer when the key is simple
PriorityQueue<int[]> byFreq = new PriorityQueue<>(Comparator.comparingInt(a -> a[1]));
      `),
      cpp(`
// Lambda comparator — note decltype in the type
auto farther = [](const vector<int>& a, const vector<int>& b) {
    return a[0]*a[0] + a[1]*a[1] < b[0]*b[0] + b[1]*b[1];   // '<' => max-heap
};
priority_queue<vector<int>, vector<vector<int>>, decltype(farther)> heap(farther);

// pairs work out of the box, ordered by .first then .second
priority_queue<pair<int,int>, vector<pair<int,int>>, greater<>> minByFirst;
      `),
    ),
    p(
      'Two heaps for a running median. A max-heap holds the lower half, a min-heap the upper half. Keep the sizes within one of each other and the median is either the top of the larger heap or the average of both tops.',
    ),
    code(
      java(`
class MedianFinder {
    // lower half, largest on top
    private final PriorityQueue<Integer> lo = new PriorityQueue<>(Comparator.reverseOrder());
    // upper half, smallest on top
    private final PriorityQueue<Integer> hi = new PriorityQueue<>();

    public void addNum(int num) {
        lo.offer(num);
        hi.offer(lo.poll());                    // funnel through to keep order
        if (hi.size() > lo.size()) lo.offer(hi.poll());   // rebalance
    }

    public double findMedian() {
        return lo.size() > hi.size() ? lo.peek() : (lo.peek() + hi.peek()) / 2.0;
    }
}
      `),
    ),
    p(
      'Merging k sorted lists. Hold one element from each list — the current heads — and repeatedly take the smallest, pushing that list\'s successor. The heap never exceeds k entries.',
    ),
    code(
      java(`
public ListNode mergeKLists(ListNode[] lists) {
    PriorityQueue<ListNode> heap = new PriorityQueue<>(Comparator.comparingInt(n -> n.val));
    for (ListNode l : lists) if (l != null) heap.offer(l);

    ListNode dummy = new ListNode(0), tail = dummy;
    while (!heap.isEmpty()) {
        ListNode n = heap.poll();
        tail.next = n; tail = n;
        if (n.next != null) heap.offer(n.next);   // refill from the same list
    }
    return dummy.next;
}
      `),
    ),
    p(
      'Lazy deletion. Neither language lets you remove an arbitrary element cheaply — Java\'s remove(Object) is O(n), and C++ has no such method at all. The standard workaround is to leave stale entries in and skip them when they surface.',
    ),
    code(
      java(`
// Push updated entries and discard outdated ones on the way out
while (!heap.isEmpty() && isStale(heap.peek())) heap.poll();
      `),
    ),

    h('Language toolkit'),
    table(
      ['Java (PriorityQueue)', 'What it does', 'C++ (priority_queue)'],
      [
        ['new PriorityQueue<>()', 'Min-heap. Head is the least element.', 'priority_queue<int> — MAX-heap'],
        ['new PriorityQueue<>(Comparator.reverseOrder())', 'Max-heap.', 'priority_queue<int> (default)'],
        ['—', 'Min-heap.', 'priority_queue<int, vector<int>, greater<int>>'],
        ['offer(x) / add(x)', 'Insert, O(log n).', 'push(x)'],
        ['poll()', 'Remove and return the head. null if empty.', 'pop() — void; read top() first'],
        ['peek()', 'Head without removing, O(1). null if empty.', 'top() — UB if empty'],
        ['size() / isEmpty()', 'Count / emptiness.', 'size() / empty()'],
        ['new PriorityQueue<>(collection)', 'Heapify, O(n) — beats n inserts.', 'priority_queue(v.begin(), v.end())'],
        ['Comparator.comparingInt(f)', 'Order by an extracted key.', 'lambda + decltype'],
        ['remove(Object)', 'Arbitrary removal, O(n). Avoid.', 'no equivalent — use lazy deletion'],
      ],
    ),
    warn(
      'A PriorityQueue is not sorted, and iterating it does not give you sorted order — the documentation says the iterator is "not guaranteed to traverse the elements in any particular order". Only repeated poll() gives order. Printing a heap to debug it will mislead you. Neither Java nor C++ permits null elements.',
    ),

    h('Complexity'),
    table(
      ['Operation', 'Time', 'Note'],
      [
        ['peek / top', 'O(1)', 'Just reads the root.'],
        ['offer / push', 'O(log n)', 'Sift up.'],
        ['poll / pop', 'O(log n)', 'Sift down.'],
        ['Build from a collection', 'O(n)', 'Heapify beats n separate inserts.'],
        ['Top K over n items', 'O(n log k)', 'Heap bounded at k. Space O(k).'],
        ['Sort instead', 'O(n log n)', 'What you are beating when k is small.'],
        ['remove(Object) / contains', 'O(n)', 'Linear scan — the reason for lazy deletion.'],
        ['Merge k sorted lists', 'O(N log k)', 'N total elements across all lists.'],
      ],
    ),

    h('Common mistakes'),
    ul(
      'Using a max-heap for "k largest". You want a min-heap holding the winners, so the weakest is cheap to evict.',
      'Assuming your language\'s default. Java is a min-heap, C++ is a max-heap.',
      'Inverting the C++ comparator. Passing greater<int> gives a min-heap — the comparator describes ordering, not priority.',
      'Reading C++ top() after pop(). pop() returns void; read first, then pop.',
      'Iterating a heap and expecting sorted order.',
      'Calling remove(Object) in a loop and turning an O(n log n) algorithm into O(n²).',
      'Using subtraction in a Java comparator over large ints — (a - b) overflows. Use Integer.compare(a, b).',
      'Forgetting that offering all n elements then polling k is O(n log n), which throws away the benefit of a bounded heap.',
    ),

    links(
      link('Java PriorityQueue — API reference', 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/PriorityQueue.html'),
      link('C++ std::priority_queue — reference', 'https://en.cppreference.com/w/cpp/container/priority_queue'),
      link('LeetCode Explore — Heap', 'https://leetcode.com/explore/learn/card/heap/'),
    ),
  ],
};
