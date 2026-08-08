import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from './blocks.js';

export default {
  patternSlug: 'linked-list',
  title: 'Linked List',
  summary: 'Pointer surgery. A dummy head and a slow/fast pair solve most of these.',
  blocks: [
    p(
      'Linked list problems are not conceptually hard. You always know what the answer should look like — reverse it, remove that node, merge these two. The difficulty is entirely mechanical: you are rewiring pointers in place, and if you overwrite one before you have saved what it pointed at, the rest of the list is gone. There is no undo.',
    ),
    p(
      'Two habits remove most of the pain. The first is a dummy head: allocate a throwaway node in front of the real list so that deleting or inserting at position zero is the same code as everywhere else. Every special case for "what if it is the first node" disappears. The second is drawing the pointers before typing — three boxes and three arrows on paper, then transcribe. People who skip this step write the reversal loop backwards roughly half the time.',
    ),
    p(
      'The other half of the pattern is the fast/slow pair. Two pointers moving at different speeds through one pass give you the middle, the k-th from the end, and cycle detection, all in O(1) space. They come up constantly.',
    ),

    h('When to reach for it'),
    ul(
      'You are asked to reverse, merge, partition, or reorder a list in place.',
      'The problem forbids extra space, so you cannot dump the list into an array.',
      'You need the middle, the k-th from the end, or a cycle — single-pass, two pointers.',
      'The head itself might be removed or replaced, which is the signal for a dummy node.',
      'Merging k sorted lists — combine this with a heap.',
    ),
    tip(
      'If the problem allows O(n) space and does not require in-place work, dumping the nodes into an ArrayList and indexing them is a legitimate answer, and sometimes the clearer one. Say so out loud, then offer the O(1) version.',
    ),

    h('The core idea'),
    p(
      'Reversal. Three pointers, and the order of the four lines inside the loop is the whole problem. Save the next node before you overwrite the link, or you cannot continue.',
    ),
    code(
      java(`
public ListNode reverseList(ListNode head) {
    ListNode prev = null, curr = head;
    while (curr != null) {
        ListNode next = curr.next;   // 1. save, before we destroy the link
        curr.next = prev;            // 2. flip
        prev = curr;                 // 3. advance prev
        curr = next;                 // 4. advance curr
    }
    return prev;                     // curr is null; prev is the new head
}
      `),
      cpp(`
ListNode* reverseList(ListNode* head) {
    ListNode* prev = nullptr;
    ListNode* curr = head;
    while (curr) {
        ListNode* next = curr->next;
        curr->next = prev;
        prev = curr;
        curr = next;
    }
    return prev;
}
      `),
    ),
    p(
      'Return prev, not head. By the end head points at the node that is now last, and its next is null — returning it gives you a one-element list. This is the most common linked-list bug there is.',
    ),
    p(
      'The dummy head. Whenever the head might change, build the answer behind a dummy and return dummy.next. Removing the n-th node from the end shows why: without the dummy, deleting the head needs its own branch.',
    ),
    code(
      java(`
public ListNode removeNthFromEnd(ListNode head, int n) {
    ListNode dummy = new ListNode(0, head);      // survives head deletion
    ListNode fast = dummy, slow = dummy;

    for (int i = 0; i <= n; i++) fast = fast.next;   // open a gap of n+1

    while (fast != null) {                        // walk both to the end
        fast = fast.next;
        slow = slow.next;
    }
    slow.next = slow.next.next;                   // slow sits just before the target
    return dummy.next;
}
      `),
      cpp(`
ListNode* removeNthFromEnd(ListNode* head, int n) {
    ListNode dummy(0, head);
    ListNode* fast = &dummy;
    ListNode* slow = &dummy;

    for (int i = 0; i <= n; i++) fast = fast->next;
    while (fast) { fast = fast->next; slow = slow->next; }

    ListNode* doomed = slow->next;
    slow->next = doomed->next;
    delete doomed;              // C++ owns its memory — Java does not need this
    return dummy.next;
}
      `),
    ),

    h('Variations'),
    p(
      'Merging two sorted lists. A dummy plus a tail pointer, and the loop is almost prose. At the end, one list still has nodes — attach the whole remainder in one line rather than looping.',
    ),
    code(
      java(`
public ListNode mergeTwoLists(ListNode a, ListNode b) {
    ListNode dummy = new ListNode(0), tail = dummy;
    while (a != null && b != null) {
        if (a.val <= b.val) { tail.next = a; a = a.next; }
        else                { tail.next = b; b = b.next; }
        tail = tail.next;
    }
    tail.next = (a != null) ? a : b;   // one is exhausted; splice the rest
    return dummy.next;
}
      `),
      cpp(`
ListNode* mergeTwoLists(ListNode* a, ListNode* b) {
    ListNode dummy(0);
    ListNode* tail = &dummy;
    while (a && b) {
        if (a->val <= b->val) { tail->next = a; a = a->next; }
        else                  { tail->next = b; b = b->next; }
        tail = tail->next;
    }
    tail->next = a ? a : b;
    return dummy.next;
}
      `),
    ),
    p(
      'Cycle detection and the entry point. Floyd\'s algorithm. Once the pointers meet, resetting one to the head and advancing both one step at a time lands them together exactly at the start of the loop — a consequence of the distances involved, and worth stating rather than deriving under time pressure.',
    ),
    code(
      java(`
public ListNode detectCycle(ListNode head) {
    ListNode slow = head, fast = head;
    while (fast != null && fast.next != null) {
        slow = slow.next;
        fast = fast.next.next;
        if (slow == fast) {                 // meeting point, not the entry
            ListNode p = head;
            while (p != slow) { p = p.next; slow = slow.next; }
            return p;                       // this is the cycle entry
        }
    }
    return null;
}
      `),
    ),
    p(
      'Reorder list — the three-step composite. Find the middle, reverse the second half, then weave. It is worth practising because it is three primitives you already know, and interviewers like it for exactly that reason.',
    ),
    code(
      java(`
public void reorderList(ListNode head) {
    // 1. middle
    ListNode slow = head, fast = head;
    while (fast.next != null && fast.next.next != null) {
        slow = slow.next; fast = fast.next.next;
    }
    // 2. reverse the second half, and cut it loose
    ListNode second = reverseList(slow.next);
    slow.next = null;
    // 3. weave
    ListNode first = head;
    while (second != null) {
        ListNode n1 = first.next, n2 = second.next;
        first.next = second;
        second.next = n1;
        first = n1; second = n2;
    }
}
      `),
    ),

    h('Language toolkit'),
    table(
      ['Java', 'What it does', 'C++ equivalent'],
      [
        ['ListNode dummy = new ListNode(0, head)', 'Sentinel in front of the list.', 'ListNode dummy(0, head)'],
        ['node.next', 'Follow the link.', 'node->next'],
        ['a == b', 'Node identity — what you want for cycles.', 'a == b (pointer compare)'],
        ['a.equals(b)', 'Almost never what you want on nodes.', '*a == *b if operator== exists'],
        ['null', 'End of list.', 'nullptr'],
        ['garbage collected', 'Detached nodes just go away.', 'delete node — you own it'],
        ['java.util.LinkedList', 'The library list — rarely used in these problems.', 'std::list / std::forward_list'],
      ],
    ),
    warn(
      'In C++ you own the memory. Removing a node without delete leaks it, and deleting a node you still hold a pointer to gives you a dangling pointer. Java\'s garbage collector hides this entire class of bug, which is why C++ solutions to the same problem are a few lines longer.',
    ),

    h('Complexity'),
    table(
      ['Operation', 'Time', 'Space', 'Note'],
      [
        ['Reverse in place', 'O(n)', 'O(1)', 'Recursive version costs O(n) stack.'],
        ['Find the middle', 'O(n)', 'O(1)', 'One pass with fast/slow.'],
        ['Cycle detection (Floyd)', 'O(n)', 'O(1)', 'Beats a hash set on space.'],
        ['Cycle detection (hash set)', 'O(n)', 'O(n)', 'Easier to explain; worse space.'],
        ['Merge two sorted lists', 'O(n + m)', 'O(1)', 'Iterative. Recursion costs stack.'],
        ['Merge k sorted lists', 'O(N log k)', 'O(k)', 'Heap of the k current heads.'],
        ['Index into a list', 'O(n)', 'O(1)', 'No random access — this is the whole trade-off.'],
      ],
    ),

    h('Common mistakes'),
    ul(
      'Returning head instead of prev after reversing. head is the tail by then.',
      'Overwriting curr.next before saving it, orphaning the rest of the list.',
      'Skipping the dummy node and then discovering the head case needs its own branch.',
      'Checking fast.next before fast, dereferencing null on even-length lists.',
      'Using .equals() where you meant reference identity. Cycle detection needs ==.',
      'Forgetting to cut the list with slow.next = null after splitting, leaving a cycle behind.',
      'Leaking memory in C++ by unlinking without deleting.',
      'Losing track of how many steps the gap should be — off-by-one on k-th-from-end is why the loop above runs i <= n, not i < n.',
    ),

    tip(
      'Draw three consecutive nodes and the pointers you are about to change, then number the assignments in the order that keeps every node reachable. Transcribe that. It takes thirty seconds and removes almost every bug in this pattern.',
    ),

    links(
      link('LeetCode Explore — Linked List', 'https://leetcode.com/explore/learn/card/linked-list/'),
      link('Java LinkedList — API reference', 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/LinkedList.html'),
    ),
  ],
};
