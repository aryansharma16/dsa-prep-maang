import { h, link, links, note, p, table, tip, ul, warn, wiki } from '../blocks.js';

/*
  The reference half of the track — tables, no prose to speak of.

  The numbers are bigocheatsheet.com's, which is itself the CLRS/Wikipedia
  consensus, plus the three language sections that site does not have and that
  are the ones actually reached for mid-problem: what a Java collection, an STL
  container and a JS built-in really cost.

  Θ for the average column and O for the worst is the source's convention and
  worth keeping — it is the one place in this track where the distinction from
  the Big-O topic shows up in a table rather than in a sentence.
*/
export const doc = {
  blocks: [
    p(
      'The tables, in one place. Nothing here is derived — it is the reference you check against after you have counted, and the set of numbers worth eventually knowing without checking.',
    ),
    note(
      'Two symbols, as on the source tables: `Θ` in the average column means the bound is tight — that *is* the growth. `O` in the worst column is a ceiling. Where a structure has a nasty worst case that essentially never happens, this is where you can see it.',
    ),

    h('How the shapes rank'),
    table(
      ['band', 'complexities', 'read it as'],
      [
        ['Excellent', '`O(1)`, `O(log n)`', 'the size of the input barely matters'],
        ['Good', '`O(n)`', 'you touch everything once'],
        ['Fair', '`O(n log n)`', 'the realistic target for most array problems'],
        ['Bad', '`O(n²)`', 'fine to 5,000, hopeless at 10⁵'],
        ['Horrible', '`O(2ⁿ)`, `O(n!)`', 'only ever intended when `n` is tiny'],
      ],
    ),

    h('Data structures — average case'),
    table(
      ['structure', 'access', 'search', 'insert', 'delete'],
      [
        ['Array', '`Θ(1)`', '`Θ(n)`', '`Θ(n)`', '`Θ(n)`'],
        ['Stack', '`Θ(n)`', '`Θ(n)`', '`Θ(1)`', '`Θ(1)`'],
        ['Queue', '`Θ(n)`', '`Θ(n)`', '`Θ(1)`', '`Θ(1)`'],
        ['Singly-linked list', '`Θ(n)`', '`Θ(n)`', '`Θ(1)`', '`Θ(1)`'],
        ['Doubly-linked list', '`Θ(n)`', '`Θ(n)`', '`Θ(1)`', '`Θ(1)`'],
        ['Hash table', '—', '`Θ(1)`', '`Θ(1)`', '`Θ(1)`'],
        ['Binary search tree', '`Θ(log n)`', '`Θ(log n)`', '`Θ(log n)`', '`Θ(log n)`'],
        ['AVL / Red-black tree', '`Θ(log n)`', '`Θ(log n)`', '`Θ(log n)`', '`Θ(log n)`'],
        ['B-tree', '`Θ(log n)`', '`Θ(log n)`', '`Θ(log n)`', '`Θ(log n)`'],
        ['Skip list', '`Θ(log n)`', '`Θ(log n)`', '`Θ(log n)`', '`Θ(log n)`'],
      ],
    ),

    h('Data structures — worst case'),
    table(
      ['structure', 'access', 'search', 'insert', 'delete', 'space'],
      [
        ['Array', '`O(1)`', '`O(n)`', '`O(n)`', '`O(n)`', '`O(n)`'],
        ['Stack', '`O(n)`', '`O(n)`', '`O(1)`', '`O(1)`', '`O(n)`'],
        ['Queue', '`O(n)`', '`O(n)`', '`O(1)`', '`O(1)`', '`O(n)`'],
        ['Singly-linked list', '`O(n)`', '`O(n)`', '`O(1)`', '`O(1)`', '`O(n)`'],
        ['Doubly-linked list', '`O(n)`', '`O(n)`', '`O(1)`', '`O(1)`', '`O(n)`'],
        ['Hash table', '—', '`O(n)`', '`O(n)`', '`O(n)`', '`O(n)`'],
        ['Binary search tree', '`O(n)`', '`O(n)`', '`O(n)`', '`O(n)`', '`O(n)`'],
        ['AVL / Red-black tree', '`O(log n)`', '`O(log n)`', '`O(log n)`', '`O(log n)`', '`O(n)`'],
        ['B-tree', '`O(log n)`', '`O(log n)`', '`O(log n)`', '`O(log n)`', '`O(n)`'],
        ['Skip list', '`O(n)`', '`O(n)`', '`O(n)`', '`O(n)`', '`O(n log n)`'],
      ],
    ),
    warn(
      'The two rows that carry the whole story. **A hash table is `O(1)` average and `O(n)` worst** — every key colliding into one bucket degenerates to a linked list. **A plain BST is `O(log n)` average and `O(n)` worst** — insert sorted data into one and it degenerates to a linked list too. Balanced trees exist to close that second gap, which is why `TreeMap` and `std::map` are `O(log n)` guaranteed, not average.',
    ),
    note(
      'Insert and delete on a linked list are `O(1)` **once you are holding the node**. Finding it first is the `O(n)` search. The tables split those two facts across two columns, and reading them as "insert into a linked list is O(1)" out of context is how people talk themselves into the wrong structure.',
    ),

    h('Sorting'),
    table(
      ['algorithm', 'best', 'average', 'worst', 'space', 'stable'],
      [
        ['Quicksort', '`Ω(n log n)`', '`Θ(n log n)`', '`O(n²)`', '`O(log n)`', 'no'],
        ['Merge sort', '`Ω(n log n)`', '`Θ(n log n)`', '`O(n log n)`', '`O(n)`', 'yes'],
        ['Timsort', '`Ω(n)`', '`Θ(n log n)`', '`O(n log n)`', '`O(n)`', 'yes'],
        ['Heapsort', '`Ω(n log n)`', '`Θ(n log n)`', '`O(n log n)`', '`O(1)`', 'no'],
        ['Insertion sort', '`Ω(n)`', '`Θ(n²)`', '`O(n²)`', '`O(1)`', 'yes'],
        ['Selection sort', '`Ω(n²)`', '`Θ(n²)`', '`O(n²)`', '`O(1)`', 'no'],
        ['Bubble sort', '`Ω(n)`', '`Θ(n²)`', '`O(n²)`', '`O(1)`', 'yes'],
        ['Shell sort', '`Ω(n log n)`', '`Θ(n(log n)²)`', '`O(n(log n)²)`', '`O(1)`', 'no'],
        ['Counting sort', '`Ω(n + k)`', '`Θ(n + k)`', '`O(n + k)`', '`O(k)`', 'yes'],
        ['Radix sort', '`Ω(nk)`', '`Θ(nk)`', '`O(nk)`', '`O(n + k)`', 'yes'],
        ['Bucket sort', '`Ω(n + k)`', '`Θ(n + k)`', '`O(n²)`', '`O(n)`', 'yes'],
      ],
    ),
    tip(
      '`O(n log n)` is a **proven floor** for any sort that works by comparing elements — you cannot beat it with a cleverer comparison sort. Counting, radix and bucket sort get under it only by not comparing: they use the values as array indices, which is why their cost mentions `k`, the size of the value range, and why they are useless when `k` is huge.',
    ),

    h('Java collections'),
    table(
      ['operation', 'cost', 'watch out'],
      [
        ['`ArrayList.get(i)` / `set(i, x)`', '`O(1)`', ''],
        ['`ArrayList.add(x)`', '`O(1)` amortised', 'the resize copy is `O(n)`'],
        ['`ArrayList.add(i, x)` / `remove(i)`', '`O(n)`', 'everything after `i` shifts'],
        ['`ArrayList.contains(x)` / `indexOf(x)`', '`O(n)`', 'the classic accidental `O(n²)`'],
        ['`LinkedList.get(i)`', '`O(n)`', 'it walks — never index a LinkedList in a loop'],
        ['`HashMap` / `HashSet` get, put, remove', '`O(1)` average', '`O(n)` worst; `O(log n)` since Java 8 when keys are `Comparable`'],
        ['`TreeMap` / `TreeSet` get, put, remove', '`O(log n)`', 'guaranteed — red-black tree'],
        ['`TreeMap.firstKey` / `ceilingKey` / `floorKey`', '`O(log n)`', 'the reason to pick it over a HashMap'],
        ['`ArrayDeque` push, pop, offer, poll', '`O(1)` amortised', 'the right stack and queue in Java'],
        ['`PriorityQueue.add` / `poll`', '`O(log n)`', '`peek` is `O(1)`, `contains` is `O(n)`'],
        ['`Arrays.sort(int[])`', '`O(n log n)` average', 'dual-pivot quicksort — `O(n²)` worst on adversarial input'],
        ['`Arrays.sort(T[])` / `Collections.sort`', '`O(n log n)`', 'Timsort — stable, `O(n)` memory'],
        ['`StringBuilder.append`', '`O(1)` amortised', 'use this, never `s += x` in a loop'],
        ['`String` `+` in a loop', '`O(n²)`', 'a new string each time'],
        ['`String.substring` / `toCharArray`', '`O(n)`', 'copies since Java 7u6'],
      ],
    ),

    h('C++ STL'),
    table(
      ['operation', 'cost', 'watch out'],
      [
        ['`vector` `[]`, `back`', '`O(1)`', ''],
        ['`vector::push_back`', '`O(1)` amortised', ''],
        ['`vector::insert` / `erase` (middle)', '`O(n)`', ''],
        ['`deque` `[]`, `push_front`, `push_back`', '`O(1)`', ''],
        ['`list::insert` / `erase` at an iterator', '`O(1)`', 'no random access at all'],
        ['`unordered_map` / `unordered_set`', '`O(1)` average, `O(n)` worst', 'hackable in contests — `map` is the safe fallback'],
        ['`map` / `set`', '`O(log n)`', 'red-black tree, ordered'],
        ['`map::lower_bound` / `upper_bound`', '`O(log n)`', 'ordered queries — the point of `map`'],
        ['`priority_queue` push / pop', '`O(log n)`', '`top` is `O(1)`'],
        ['`std::sort`', '`O(n log n)` worst', 'introsort — quicksort that falls back to heapsort'],
        ['`std::stable_sort`', '`O(n log n)`', 'needs `O(n)` memory'],
        ['`std::lower_bound` on a `vector`', '`O(log n)`', '`O(n)` on a `list` — it has to walk'],
        ['`std::find`, `count`', '`O(n)`', ''],
      ],
    ),

    h('JavaScript built-ins'),
    table(
      ['operation', 'cost', 'watch out'],
      [
        ['`arr[i]`, `arr.push`, `arr.pop`', '`O(1)`', '`push` is amortised'],
        ['`arr.shift` / `arr.unshift`', '`O(n)`', 'every element moves — the number one JS trap'],
        ['`arr.splice`', '`O(n)`', ''],
        ['`arr.includes` / `indexOf` / `find`', '`O(n)`', 'inside a loop this is `O(n²)`'],
        ['`arr.slice` / `concat` / `[...arr]`', '`O(n)`', 'a copy, every time'],
        ['`arr.sort()`', '`O(n log n)`', 'Timsort in V8; **compares as strings by default**'],
        ['`Map` / `Set` get, set, has, delete', '`O(1)` average', ''],
        ['`Object` property read/write', '`O(1)` average', 'deleting keys can deoptimise the shape'],
        ['`Object.keys` / `values` / `entries`', '`O(n)`', 'allocates an array'],
        ['`str[i]`, `str.length`', '`O(1)`', ''],
        ['`str.split` / `slice` / `concat`', '`O(n)`', ''],
        ['a heap', '—', 'there is no built-in one — write it or sort instead'],
      ],
    ),
    warn(
      '`[10, 9, 1].sort()` gives `[1, 10, 9]`. The default comparator stringifies. Always pass one for numbers: `arr.sort((a, b) => a - b)`.',
    ),

    h('Graph and tree algorithms'),
    table(
      ['algorithm', 'time', 'space'],
      [
        ['BFS / DFS', '`O(V + E)`', '`O(V)`'],
        ['Topological sort (Kahn)', '`O(V + E)`', '`O(V)`'],
        ['Dijkstra (binary heap)', '`O((V + E) log V)`', '`O(V)`'],
        ['Bellman–Ford', '`O(V · E)`', '`O(V)`'],
        ['Floyd–Warshall', '`O(V³)`', '`O(V²)`'],
        ['Union–Find (path compression + rank)', '`O(α(n))` ≈ `O(1)`', '`O(n)`'],
        ['Kruskal', '`O(E log E)`', '`O(V)`'],
        ['Prim (binary heap)', '`O(E log V)`', '`O(V)`'],
        ['Trie insert / search of a word of length `k`', '`O(k)`', '`O(n · k)` total'],
        ['Segment tree build / query / update', '`O(n)` / `O(log n)` / `O(log n)`', '`O(n)`'],
        ['Fenwick (BIT) query / update', '`O(log n)`', '`O(n)`'],
        ['Heapify an array', '`O(n)`', '`O(1)`'],
      ],
    ),
    note(
      'Heapify being `O(n)` and not `O(n log n)` surprises people, and it is a good interview answer to have ready: most nodes are near the bottom and sift down only a level or two, and the sum works out linear. Building a heap from an array is cheaper than `n` inserts.',
    ),

    h('The dozen worth knowing cold'),
    ul(
      'Array index — `O(1)`. Array search — `O(n)`.',
      'Hash map get/put — `O(1)` average, `O(n)` worst.',
      'Balanced tree / `TreeMap` / `std::map` — `O(log n)` guaranteed.',
      'Binary search — `O(log n)`, and only on sorted data.',
      'Comparison sort — `O(n log n)`, and that is a proven floor.',
      'Heap push/pop — `O(log n)`; peek — `O(1)`; heapify — `O(n)`.',
      'BFS / DFS — `O(V + E)` time, `O(V)` space.',
      'Dijkstra with a heap — `O((V + E) log V)`.',
      'Every pair — `O(n²)`. Every subset — `O(2ⁿ)`. Every ordering — `O(n!)`.',
      'Recursion depth is space: `O(log n)` balanced, `O(n)` skewed.',
      'A dynamic array append is `O(1)` amortised; a front insert is `O(n)`.',
      'String `+` in a loop is `O(n²)` — use a builder.',
    ),

    links(
      link('Big-O Cheat Sheet', 'https://www.bigocheatsheet.com/'),
      link('Time Complexity — USACO Guide', 'https://usaco.guide/bronze/time-comp'),
      wiki('Sorting_algorithm', 'Sorting algorithm'),
      wiki('Comparison_sort', 'Comparison sort — the n log n lower bound'),
    ),
  ],
};
