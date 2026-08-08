/**
 * Every pattern guide, one module each.
 *
 * Kept as separate files rather than one array: a deep guide runs to a couple
 * of hundred lines, and twenty-two of them in a single module would be
 * unreviewable — both for a human editing the prose and for a diff.
 *
 * Listed in curriculum order for readability. The seeder does not care, and the
 * roadmap orders patterns by `order` on the Pattern document.
 */
import arraysHashing from './arrays-hashing.js';
import twoPointers from './two-pointers.js';
import prefixSum from './prefix-sum.js';
import slidingWindow from './sliding-window.js';
import strings from './strings.js';
import binarySearch from './binary-search.js';
import stack from './stack.js';
import linkedList from './linked-list.js';
import trees from './trees.js';
import bst from './bst.js';
import heap from './heap.js';
import tries from './tries.js';
import backtracking from './backtracking.js';
import graphs from './graphs.js';
import advancedGraphs from './advanced-graphs.js';
import greedy from './greedy.js';
import intervals from './intervals.js';
import dp1d from './dp-1d.js';
import dp2d from './dp-2d.js';
import bitManipulation from './bit-manipulation.js';
import mathGeometry from './math-geometry.js';
import design from './design.js';

export const guideDocs = [
  arraysHashing,
  twoPointers,
  prefixSum,
  slidingWindow,
  strings,
  binarySearch,
  stack,
  linkedList,
  trees,
  bst,
  heap,
  tries,
  backtracking,
  graphs,
  advancedGraphs,
  greedy,
  intervals,
  dp1d,
  dp2d,
  bitManipulation,
  mathGeometry,
  design,
];
