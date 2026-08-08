import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from './blocks.js';

export default {
  patternSlug: 'stack',
  title: 'Stack & Monotonic Stack',
  summary: 'When the answer depends on the most recent unresolved item, a stack is the data structure.',
  blocks: [
    p(
      'A stack answers one question well: what is the most recent thing I have not finished with? Brackets are the obvious case — a closing paren must match the innermost open one. But the same shape covers undo history, expression evaluation, and the iterative form of any recursion, because the call stack is a stack.',
    ),
    p(
      'The monotonic stack is the version that earns its place in interviews. You keep the stack sorted — always increasing or always decreasing — by popping everything that violates the order before pushing. That sounds like extra work, but each element is pushed once and popped at most once, so the whole scan is O(n) even though it looks nested. What you get for that is the "next greater element" family: for every position, the nearest item to its left or right that beats it, computed in one pass.',
    ),
    p(
      'The trick to recognising it: if the brute force is "for each element, scan outward until I find something bigger or smaller", it is a monotonic stack. The popping is what stops you rescanning.',
    ),

    h('When to reach for it'),
    ul(
      'Matching or nesting — brackets, tags, directory paths, nested expressions.',
      '"Next greater", "previous smaller", "days until warmer", "span of" — the monotonic family.',
      'Largest rectangle in a histogram, trapping rain water, and their many disguises.',
      'You are asked to convert a recursive traversal to an iterative one.',
      'Evaluating postfix, or converting infix to postfix.',
    ),

    h('The core idea'),
    p(
      'Bracket matching. Push openers, and on a closer check that the top is the matching partner. The two failure modes both matter: a mismatch mid-string, and a non-empty stack at the end meaning something was never closed.',
    ),
    code(
      java(`
public boolean isValid(String s) {
    Deque<Character> stack = new ArrayDeque<>();
    Map<Character, Character> pairs = Map.of(')', '(', ']', '[', '}', '{');

    for (char c : s.toCharArray()) {
        if (pairs.containsValue(c)) {
            stack.push(c);
        } else if (pairs.containsKey(c)) {
            // empty means a closer with nothing open
            if (stack.isEmpty() || stack.pop() != pairs.get(c)) return false;
        }
    }
    return stack.isEmpty();     // leftovers mean something never closed
}
      `),
      cpp(`
bool isValid(string s) {
    stack<char> st;
    unordered_map<char, char> pairs{{')', '('}, {']', '['}, {'}', '{'}};

    for (char c : s) {
        if (c == '(' || c == '[' || c == '{') {
            st.push(c);
        } else {
            if (st.empty() || st.top() != pairs[c]) return false;
            st.pop();
        }
    }
    return st.empty();
}
      `),
    ),
    warn(
      'In Java use ArrayDeque, not Stack. java.util.Stack extends Vector and synchronises every method, which is pure overhead. The ArrayDeque documentation says outright that it "is likely to be faster than Stack when used as a stack, and faster than LinkedList when used as a queue".',
    ),
    p(
      'The monotonic stack. Store indices rather than values — you almost always need the distance between positions, and you can always look the value up. Pop while the incoming element breaks the order; whatever gets popped has just found its answer.',
    ),
    code(
      java(`
// Daily temperatures: how many days until a warmer one
public int[] dailyTemperatures(int[] t) {
    int[] out = new int[t.length];
    Deque<Integer> stack = new ArrayDeque<>();     // indices, decreasing values

    for (int i = 0; i < t.length; i++) {
        // everything colder than today has just found its warmer day
        while (!stack.isEmpty() && t[i] > t[stack.peek()]) {
            int j = stack.pop();
            out[j] = i - j;
        }
        stack.push(i);
    }
    return out;    // anything left never warms up, and stays 0
}
      `),
      cpp(`
vector<int> dailyTemperatures(vector<int>& t) {
    vector<int> out(t.size(), 0);
    stack<int> st;                                  // indices

    for (int i = 0; i < (int)t.size(); i++) {
        while (!st.empty() && t[i] > t[st.top()]) {
            int j = st.top(); st.pop();
            out[j] = i - j;
        }
        st.push(i);
    }
    return out;
}
      `),
    ),

    h('Variations'),
    p(
      'Next greater element. Same skeleton, different bookkeeping — record the value that caused the pop rather than the distance. Anything still on the stack at the end has no next greater element.',
    ),
    code(
      java(`
public int[] nextGreater(int[] nums) {
    int[] out = new int[nums.length];
    Arrays.fill(out, -1);                       // default: nothing bigger
    Deque<Integer> stack = new ArrayDeque<>();

    for (int i = 0; i < nums.length; i++) {
        while (!stack.isEmpty() && nums[i] > nums[stack.peek()]) {
            out[stack.pop()] = nums[i];
        }
        stack.push(i);
    }
    return out;
}
      `),
    ),
    p(
      'Largest rectangle in a histogram. The hard one, and the payoff for understanding the pattern. A bar can extend left until something shorter blocks it, and right likewise — which is exactly what a popping monotonic stack tells you. The sentinel bar of height 0 at the end flushes the stack so you do not need a second loop.',
    ),
    code(
      java(`
public int largestRectangleArea(int[] heights) {
    Deque<Integer> stack = new ArrayDeque<>();   // increasing heights
    int best = 0;
    int n = heights.length;

    for (int i = 0; i <= n; i++) {
        int h = (i == n) ? 0 : heights[i];       // sentinel flushes the stack
        while (!stack.isEmpty() && h < heights[stack.peek()]) {
            int height = heights[stack.pop()];
            // left edge is whatever is now on top, exclusive
            int left = stack.isEmpty() ? -1 : stack.peek();
            int width = i - left - 1;
            best = Math.max(best, height * width);
        }
        stack.push(i);
    }
    return best;
}
      `),
      cpp(`
int largestRectangleArea(vector<int>& heights) {
    stack<int> st;
    int best = 0, n = heights.size();

    for (int i = 0; i <= n; i++) {
        int h = (i == n) ? 0 : heights[i];
        while (!st.empty() && h < heights[st.top()]) {
            int height = heights[st.top()]; st.pop();
            int left = st.empty() ? -1 : st.top();
            best = max(best, height * (i - left - 1));
        }
        st.push(i);
    }
    return best;
}
      `),
    ),
    p(
      'Two stacks for O(1) queries. Min-stack keeps a parallel stack of minima so getMin never scans. The same idea — an auxiliary stack carrying a running aggregate — solves a whole family of "constant-time extra query" designs.',
    ),
    code(
      java(`
class MinStack {
    private final Deque<Integer> main = new ArrayDeque<>();
    private final Deque<Integer> mins = new ArrayDeque<>();

    public void push(int x) {
        main.push(x);
        // push the running minimum, so mins.peek() is always valid
        mins.push(mins.isEmpty() ? x : Math.min(x, mins.peek()));
    }
    public void pop()      { main.pop(); mins.pop(); }
    public int  top()      { return main.peek(); }
    public int  getMin()   { return mins.peek(); }
}
      `),
    ),

    h('Language toolkit'),
    table(
      ['Java (ArrayDeque)', 'What it does', 'C++ equivalent'],
      [
        ['push(x)', 'Add to the top. Amortised O(1).', 'st.push(x)'],
        ['pop()', 'Remove and return the top. Throws if empty.', 'st.pop() — returns void!'],
        ['peek()', 'Look at the top without removing. Null if empty.', 'st.top() — UB if empty'],
        ['isEmpty()', 'Always check before pop/peek.', 'st.empty()'],
        ['size()', 'Element count.', 'st.size()'],
        ['addLast / pollFirst', 'Use it as a queue instead.', 'std::queue or deque'],
        ['Deque<Integer> d = new ArrayDeque<>()', 'The declaration to memorise.', 'stack<int> st;'],
      ],
    ),
    warn(
      'C++ stack::pop() returns void — read st.top() first, then pop(). Calling top() or pop() on an empty stack is undefined behaviour, not an exception. Java throws NoSuchElementException from pop() but returns null from peek(), so the two need different guards. And ArrayDeque prohibits null elements entirely.',
    ),

    h('Complexity'),
    table(
      ['Operation', 'Time', 'Space', 'Note'],
      [
        ['push / pop / peek', 'O(1)', '—', 'Amortised for ArrayDeque; occasional resize.'],
        ['Monotonic stack scan', 'O(n)', 'O(n)', 'Each index pushed once, popped at most once.'],
        ['Bracket matching', 'O(n)', 'O(n)', 'Stack depth is the nesting depth.'],
        ['Largest rectangle', 'O(n)', 'O(n)', 'Replaces an O(n²) pairwise scan.'],
        ['Min-stack getMin', 'O(1)', 'O(n)', 'Second stack is the price.'],
      ],
    ),
    p(
      'The O(n) claim for the monotonic scan is worth defending explicitly: the inner while loop can run many times on one iteration, but every iteration of it permanently removes an index that will never be pushed again. Total pops across the whole run is bounded by total pushes, which is n.',
    ),

    h('Common mistakes'),
    ul(
      'Using java.util.Stack out of habit. It is synchronised and iterates bottom-to-top, which surprises people.',
      'Calling pop() or peek() without an isEmpty() guard.',
      'Expecting C++ st.pop() to return the element. It returns void — read top() first.',
      'Pushing values when you need indices. Distances and widths need positions.',
      'Getting the strictness wrong: > versus >= in the pop condition decides how ties are handled, and it changes the answer for duplicates.',
      'Forgetting the sentinel in the histogram problem and leaving bars unprocessed on the stack.',
      'Assuming the stack empties by itself — always decide what leftovers mean.',
    ),

    tip(
      'When you write a monotonic stack, say what the stack holds and in what order: "indices, with strictly decreasing temperatures". Every pop condition follows from that sentence, and getting the sentence right is most of the problem.',
    ),

    links(
      link('Java ArrayDeque — API reference', 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayDeque.html'),
      link('LeetCode Explore — Queue & Stack', 'https://leetcode.com/explore/learn/card/queue-stack/'),
      link('C++ std::stack — reference', 'https://en.cppreference.com/w/cpp/container/stack'),
    ),
  ],
};
