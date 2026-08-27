/**
 * The long-form CP guides, one module each.
 *
 * Twelve of the forty-nine patterns, and the choice is deliberate rather than a
 * stopping point: these are the Pupil-to-Specialist backbone, which is where
 * almost everybody stalls. Somebody at 1200 is not blocked on heavy-light
 * decomposition — they are blocked on not being sure their greedy is correct,
 * and on writing a binary search that terminates. Depth is worth more there than
 * coverage is anywhere else.
 *
 * The other thirty-seven ship with the structured `brief` on the pattern
 * document — invariant, when it fires, complexity, traps, and a reading list —
 * and can be promoted to a full guide later without a schema change.
 *
 * Separate files rather than one array, for the reason the roadmap's index
 * gives: a real guide runs to a couple of hundred lines and twelve of them in
 * one module would be unreviewable, both for a human editing prose and for a
 * diff.
 *
 * Listed in curriculum order for readability. The seeder does not care.
 */
import prefixSums from './prefix-sums-difference.js';
import twoPointers from './two-pointers-sliding.js';
import greedy from './greedy-exchange.js';
import binarySearch from './binary-search-answer.js';
import numberTheory from './number-theory-basics.js';
import modular from './modular-arithmetic.js';
import graphTraversal from './graph-traversal.js';
import dsu from './dsu.js';
import shortestPaths from './shortest-paths.js';
import dpLinear from './dp-linear.js';
import dpKnapsack from './dp-knapsack.js';
import fenwickSegment from './fenwick-segment.js';

export const cpGuideDocs = [
  prefixSums,
  twoPointers,
  greedy,
  binarySearch,
  numberTheory,
  modular,
  graphTraversal,
  dsu,
  shortestPaths,
  dpLinear,
  dpKnapsack,
  fenwickSegment,
];
