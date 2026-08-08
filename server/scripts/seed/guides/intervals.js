import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from './blocks.js';

export default {
  patternSlug: 'intervals',
  title: 'Intervals',
  summary: 'Sort by start, then decide overlap by comparing against the last kept interval.',
  blocks: [
    p(
      'Interval problems are small in number and highly stereotyped, which makes them worth learning as a set. You are given ranges — meetings, bookings, ranges of numbers — and asked to merge them, count conflicts, insert one, or find how many overlap at once. Almost every one of them starts the same way: sort, then make a single pass comparing each interval against the one you are currently holding.',
    ),
    p(
      'The one decision that matters is what to sort by, and it splits cleanly. Sort by start when you are merging or inserting, because you want to encounter overlapping ranges consecutively. Sort by end when you are choosing a maximum non-conflicting subset, because finishing earliest leaves the most room for what follows. Getting this backwards produces code that looks right and answers wrong.',
    ),
    p(
      'The other thing to settle before writing anything is whether endpoints are inclusive. Do [1,2] and [2,3] overlap? For meeting rooms they usually do not — one ends as the other begins. For merging number ranges they usually do. The problem statement decides it, and it is the difference between < and <= in exactly one comparison.',
    ),

    h('When to reach for it'),
    ul(
      'Merge overlapping ranges into the smallest set that covers the same ground.',
      'Insert a new interval into an already-sorted list.',
      'Count the maximum number of concurrent events — meeting rooms.',
      'Remove the fewest intervals to eliminate all overlaps.',
      'Find whether a person can attend every meeting.',
      'Calendar booking, resource allocation, or anything with start and end times.',
    ),

    h('The core idea'),
    p(
      'Merging. Sort by start, hold the current merged interval, and either extend it or close it out and start a new one. The extension takes the maximum of the two ends — a fully contained interval must not shrink the one holding it.',
    ),
    code(
      java(`
public int[][] merge(int[][] intervals) {
    Arrays.sort(intervals, Comparator.comparingInt(a -> a[0]));   // by START

    List<int[]> out = new ArrayList<>();
    int[] current = intervals[0];

    for (int i = 1; i < intervals.length; i++) {
        if (intervals[i][0] <= current[1]) {          // overlaps — absorb it
            current[1] = Math.max(current[1], intervals[i][1]);   // NOT just [i][1]
        } else {
            out.add(current);                          // disjoint — close it out
            current = intervals[i];
        }
    }
    out.add(current);                                  // the last one always ships
    return out.toArray(new int[0][]);
}
      `),
      cpp(`
vector<vector<int>> merge(vector<vector<int>>& intervals) {
    sort(intervals.begin(), intervals.end(),
         [](const auto& a, const auto& b) { return a[0] < b[0]; });

    vector<vector<int>> out;
    vector<int> current = intervals[0];

    for (size_t i = 1; i < intervals.size(); i++) {
        if (intervals[i][0] <= current[1]) {
            current[1] = max(current[1], intervals[i][1]);
        } else {
            out.push_back(current);
            current = intervals[i];
        }
    }
    out.push_back(current);
    return out;
}
      `),
    ),
    warn(
      'current[1] = intervals[i][1] instead of the max is the defining bug of this pattern. Given [1,10] followed by [2,3], it shrinks the merged range to [1,3] and silently loses coverage. Always take the maximum.',
    ),
    p(
      'Two intervals a and b overlap when a.start <= b.end and b.start <= a.end. Once they are sorted by start, the second half is automatic, so the test collapses to the single comparison above.',
    ),

    h('Variations'),
    p(
      'The sweep line — maximum concurrency. Instead of intervals, think in events: a start adds one to the running count, an end subtracts one. Sort every endpoint, sweep, and track the peak. Ends must be processed before starts at the same timestamp when touching intervals do not count as overlapping.',
    ),
    code(
      java(`
// Minimum meeting rooms = peak concurrency
public int minMeetingRooms(int[][] intervals) {
    int n = intervals.length;
    int[] starts = new int[n], ends = new int[n];
    for (int i = 0; i < n; i++) {
        starts[i] = intervals[i][0];
        ends[i]   = intervals[i][1];
    }
    Arrays.sort(starts);
    Arrays.sort(ends);

    int rooms = 0, best = 0, e = 0;
    for (int s = 0; s < n; s++) {
        while (e < n && ends[e] <= starts[s]) { rooms--; e++; }  // frees first
        rooms++;
        best = Math.max(best, rooms);
    }
    return best;
}
      `),
      cpp(`
int minMeetingRooms(vector<vector<int>>& intervals) {
    int n = intervals.size();
    vector<int> starts(n), ends(n);
    for (int i = 0; i < n; i++) { starts[i] = intervals[i][0]; ends[i] = intervals[i][1]; }
    sort(starts.begin(), starts.end());
    sort(ends.begin(), ends.end());

    int rooms = 0, best = 0, e = 0;
    for (int s = 0; s < n; s++) {
        while (e < n && ends[e] <= starts[s]) { rooms--; e++; }
        rooms++;
        best = max(best, rooms);
    }
    return best;
}
      `),
    ),
    p(
      'The same answer with a min-heap of end times, which some interviewers prefer because it generalises to "which room" rather than just "how many". The heap holds the end time of every room currently in use; the earliest-finishing one is the only candidate for reuse.',
    ),
    code(
      java(`
public int minMeetingRooms(int[][] intervals) {
    Arrays.sort(intervals, Comparator.comparingInt(a -> a[0]));
    PriorityQueue<Integer> endTimes = new PriorityQueue<>();      // min-heap

    for (int[] meeting : intervals) {
        // the earliest-ending room is free if it finished before this starts
        if (!endTimes.isEmpty() && endTimes.peek() <= meeting[0]) endTimes.poll();
        endTimes.offer(meeting[1]);
    }
    return endTimes.size();      // rooms never freed = rooms needed
}
      `),
    ),
    p(
      'Inserting into a sorted list. Three phases, no sort required: copy everything strictly before the new interval, absorb everything that overlaps it, then copy the rest.',
    ),
    code(
      java(`
public int[][] insert(int[][] intervals, int[] newInterval) {
    List<int[]> out = new ArrayList<>();
    int i = 0, n = intervals.length;

    while (i < n && intervals[i][1] < newInterval[0]) out.add(intervals[i++]);  // before

    while (i < n && intervals[i][0] <= newInterval[1]) {                        // overlapping
        newInterval[0] = Math.min(newInterval[0], intervals[i][0]);
        newInterval[1] = Math.max(newInterval[1], intervals[i][1]);
        i++;
    }
    out.add(newInterval);

    while (i < n) out.add(intervals[i++]);                                      // after
    return out.toArray(new int[0][]);
}
      `),
    ),
    p(
      'Removing the fewest overlaps. This is interval scheduling from the greedy pattern, and it is the case where you sort by end rather than start: keeping the earliest-finishing interval maximises what fits afterwards.',
    ),
    code(
      java(`
public int eraseOverlapIntervals(int[][] intervals) {
    Arrays.sort(intervals, Comparator.comparingInt(a -> a[1]));   // by END

    int kept = 0, lastEnd = Integer.MIN_VALUE;
    for (int[] interval : intervals) {
        if (interval[0] >= lastEnd) { kept++; lastEnd = interval[1]; }
    }
    return intervals.length - kept;
}
      `),
    ),

    h('Language toolkit'),
    table(
      ['Java', 'What it does', 'C++ equivalent'],
      [
        ['Arrays.sort(a, Comparator.comparingInt(x -> x[0]))', 'Sort intervals by start.', 'sort with a lambda on a[0]'],
        ['Comparator.comparingInt(x -> x[1])', 'Sort by end — for scheduling.', 'lambda on a[1]'],
        ['list.toArray(new int[0][])', 'List<int[]> back to int[][].', 'already a vector'],
        ['Math.max / Math.min', 'Extend or clamp a boundary.', 'max / min'],
        ['PriorityQueue<Integer>', 'Min-heap of end times.', 'priority_queue<int, vector<int>, greater<int>>'],
        ['Integer.MIN_VALUE', 'Sentinel for "nothing kept yet".', 'INT_MIN'],
        ['TreeMap<Integer,Integer>', 'Sweep with a sorted event map.', 'std::map<int,int>'],
      ],
    ),
    tip(
      'A TreeMap (or std::map) keyed by timestamp with +1 / −1 values is the most flexible sweep-line form: iterate the keys in order, keep a running sum, and the peak is your answer. It handles arbitrary event types without splitting into two arrays.',
    ),

    h('Complexity'),
    table(
      ['Operation', 'Time', 'Space', 'Note'],
      [
        ['Merge intervals', 'O(n log n)', 'O(n)', 'The sort dominates; O(n) for the output.'],
        ['Insert into a sorted list', 'O(n)', 'O(n)', 'No sort needed — already ordered.'],
        ['Meeting rooms (two arrays)', 'O(n log n)', 'O(n)', 'Two sorts, one sweep.'],
        ['Meeting rooms (heap)', 'O(n log n)', 'O(n)', 'Same bound, keeps room identity.'],
        ['Erase overlaps', 'O(n log n)', 'O(1)', 'Sort by end, one pass.'],
        ['Check any conflict', 'O(n log n)', 'O(1)', 'Sort, then compare adjacent pairs.'],
      ],
    ),

    h('Common mistakes'),
    ul(
      'Assigning the new end instead of the maximum when merging, losing coverage on nested intervals.',
      'Sorting by start when the problem needs end (scheduling), or vice versa (merging).',
      'Getting the inclusive/exclusive boundary wrong — whether [1,2] and [2,3] conflict changes < to <=.',
      'Forgetting to append the final held interval after the loop.',
      'Not handling an empty input before touching intervals[0].',
      'In the sweep, processing starts before ends at an equal timestamp, which overcounts rooms by one.',
      'Mutating the caller\'s array by sorting it in place without saying so.',
    ),

    tip(
      'Draw the intervals on a line before coding. Every case in this pattern — disjoint, touching, overlapping, nested — is obvious on paper and invisible in your head, and nested is the one people forget.',
    ),

    links(
      link('Java Arrays.sort — API reference', 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Arrays.html'),
      link('Java TreeMap — API reference', 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/TreeMap.html'),
    ),
  ],
};
