/**
 * LeetCode's **SQL 50** study plan, as link-outs.
 *
 * ---------------------------------------------------------------------------
 * Why these are not authored locally like everything else in this folder.
 *
 * Every other file here contains problems the Lab wrote: its own schema, its own
 * rows, its own expected grid, all of it running in the browser. That is the
 * right shape for a teaching problem, and the wrong shape for one that already
 * exists on a judge.
 *
 * Re-typing LeetCode's tables so the same question can be graded a second time
 * buys nothing and costs three things. Their judge is stricter than ours — it
 * has the hidden cases, the ones our five hand-picked rows do not. Their page is
 * where the discussion, the editorial and the eight other approaches live. And a
 * submission there *counts*: it goes on the profile a reader is actually
 * building. A local re-implementation would be a worse copy of all three.
 *
 * So the rule the Lab follows: **if a problem lives on a platform, it links to
 * the platform.** What the Lab adds on top is the part LeetCode does not have —
 * which of the eight categories it belongs to, which Learn topic teaches the
 * idea behind it, and the same 3/7/21/60 revision ladder every other problem in
 * this app is on.
 * ---------------------------------------------------------------------------
 *
 * **The statements are ours.** One or two sentences saying what the question
 * asks, so the row is searchable, skimmable and honest about what you are
 * clicking into. They are not LeetCode's text, which is LeetCode's — and a
 * summary is more useful in a table anyway. Table and column names are quoted
 * where naming them is what makes the summary specific.
 *
 * ---------------------------------------------------------------------------
 * Five of the fifty are missing on purpose.
 *
 * The Lab authored these before the plan was imported, and the local versions
 * are better on-ramps than a link would be — they are the gentlest problems in
 * the bank and the ones a reader meets first:
 *
 *   1757  Recyclable and Low Fat Products  →  `recyclable-and-low-fat`  (select)
 *    584  Find Customer Referee            →  `not-referred-by`         (select)
 *    595  Big Countries                    →  `large-countries`         (select)
 *    196  Delete Duplicate Emails          →  `delete-duplicate-emails` (modify)
 *    176  Second Highest Salary            →  `second-highest-salary`   (sorting)
 *
 * Each of those five carries the LeetCode `source` as credit and a link to the
 * original, so all fifty of the plan's problems are reachable from the Lab —
 * forty-five by going there, five by solving them here first. `verify.js`
 * enforces the arrangement: it fails the seed if any LeetCode id appears twice,
 * so this list and those files cannot quietly drift into a duplicate.
 * ---------------------------------------------------------------------------
 *
 * `planOrder` is LeetCode's own numbering, 1–50, and the gaps in it are those
 * five. The Lab files each problem under its own category rather than the
 * plan's seven sections, because "Sorting and Grouping" holds problems that are
 * neither and the category rail has to mean something — but the plan's order is
 * kept so it can still be walked the way its author intended.
 */

/** Shared by every row here, and the reason the entries below are short. */
const lc = (planOrder, lcId, slug) => ({
  platform: 'leetcode',
  url: `https://leetcode.com/problems/${slug}/`,
  lcId,
  plan: 'top-sql-50',
  planOrder,
});

export default [
  /* ------------------------------------------------------------- 1. Select */

  {
    slug: 'lc-article-views-i',
    title: 'Article Views I',
    category: 'select',
    difficulty: 'Easy',
    mode: 'external',
    statement:
      'Find the authors who have viewed at least one of their own articles.\n\nReturn each id once, ascending — the duplicate ids are the whole exercise.',
    learnTopic: 'sql/distinct-and-aliases',
    source: lc(4, 1148, 'article-views-i'),
    topicTags: ['distinct', 'where', 'order-by'],
  },

  {
    slug: 'lc-invalid-tweets',
    title: 'Invalid Tweets',
    category: 'select',
    difficulty: 'Easy',
    mode: 'external',
    statement:
      'Return the ids of the tweets whose content is longer than 15 characters.\n\nA one-clause filter, on the length of a string rather than the string itself.',
    learnTopic: 'sql/where-and-operators',
    source: lc(5, 1683, 'invalid-tweets'),
    topicTags: ['where', 'string-length'],
  },

  {
    slug: 'lc-not-boring-movies',
    title: 'Not Boring Movies',
    category: 'select',
    difficulty: 'Easy',
    mode: 'external',
    statement:
      'Return the cinema records with an odd id whose description is not `boring`, highest rating first.\n\nTwo filters and an ordering; the odd id is a modulo, not a `LIKE`.',
    learnTopic: 'sql/where-and-operators',
    source: lc(15, 620, 'not-boring-movies'),
    topicTags: ['where', 'modulo', 'order-by'],
  },

  /* -------------------------------------------------------------- 2. Joins */

  {
    slug: 'lc-replace-employee-id',
    title: 'Replace Employee ID With The Unique Identifier',
    category: 'joins',
    difficulty: 'Easy',
    mode: 'external',
    statement:
      'Show every employee with their unique id, and `NULL` where they have not been given one.\n\nThe first `LEFT JOIN` problem: an inner join here silently loses the employees the question is asking about.',
    learnTopic: 'sql/left-and-right-join',
    source: lc(6, 1378, 'replace-employee-id-with-the-unique-identifier'),
    topicTags: ['left-join', 'null'],
  },

  {
    slug: 'lc-product-sales-analysis-i',
    title: 'Product Sales Analysis I',
    category: 'joins',
    difficulty: 'Easy',
    mode: 'external',
    statement:
      'Report the product name, year and price for every sale, by joining `Sales` to `Product` on the product id.\n\nA plain two-table inner join — the shape everything else in this category is built on.',
    learnTopic: 'sql/inner-join',
    source: lc(7, 1068, 'product-sales-analysis-i'),
    topicTags: ['inner-join'],
  },

  {
    slug: 'lc-customer-visited-no-transaction',
    title: 'Customer Who Visited but Did Not Make Any Transactions',
    category: 'joins',
    difficulty: 'Easy',
    mode: 'external',
    statement:
      'For each customer, count the visits that produced no transaction at all.\n\nAn anti-join and then a count of it — the rows you want are the ones that failed to match.',
    learnTopic: 'sql/left-and-right-join',
    source: lc(8, 1581, 'customer-who-visited-but-did-not-make-any-transactions'),
    topicTags: ['left-join', 'anti-join', 'group-by'],
  },

  {
    slug: 'lc-rising-temperature',
    title: 'Rising Temperature',
    category: 'joins',
    difficulty: 'Easy',
    mode: 'external',
    statement:
      'Find every day that was warmer than the day immediately before it.\n\nThe classic self-join on a date offset — and note that "the previous row" and "yesterday" are not the same thing when a day is missing.',
    learnTopic: 'sql/self-join',
    source: lc(9, 197, 'rising-temperature'),
    topicTags: ['self-join', 'dates'],
  },

  {
    slug: 'lc-average-time-of-process',
    title: 'Average Time of Process per Machine',
    category: 'joins',
    difficulty: 'Easy',
    mode: 'external',
    statement:
      'Each process writes a `start` row and an `end` row. Report the average time each machine takes, rounded to three decimals.\n\nThe two halves of one process live in the same table, so they have to be brought together before they can be subtracted.',
    learnTopic: 'sql/self-join',
    source: lc(10, 1661, 'average-time-of-process-per-machine'),
    topicTags: ['self-join', 'avg', 'round'],
  },

  {
    slug: 'lc-employee-bonus',
    title: 'Employee Bonus',
    category: 'joins',
    difficulty: 'Easy',
    mode: 'external',
    statement:
      'Report the employees whose bonus is under 1000 — including everyone with no bonus row at all.\n\nThe trap is the `WHERE`: a comparison against the missing side is `NULL`, not true, so the people you most want are the ones a naive filter drops.',
    learnTopic: 'sql/left-and-right-join',
    source: lc(11, 577, 'employee-bonus'),
    topicTags: ['left-join', 'null'],
  },

  {
    slug: 'lc-students-and-examinations',
    title: 'Students and Examinations',
    category: 'joins',
    difficulty: 'Easy',
    mode: 'external',
    statement:
      'For every student and every subject, count how many times that student sat that exam — zero included.\n\nThe only problem in the plan that genuinely needs a `CROSS JOIN`: the grid has to be built before it can be filled in.',
    learnTopic: 'sql/full-and-cross-join',
    source: lc(12, 1280, 'students-and-examinations'),
    topicTags: ['cross-join', 'left-join', 'group-by'],
  },

  {
    slug: 'lc-managers-with-five-reports',
    title: 'Managers with at Least 5 Direct Reports',
    category: 'joins',
    difficulty: 'Medium',
    mode: 'external',
    statement:
      'Name the managers who have five or more people reporting directly to them.\n\nOne table joined to itself on `reportsTo`, grouped, and then filtered on the count — which is a `HAVING`, not a `WHERE`.',
    learnTopic: 'sql/self-join',
    source: lc(13, 570, 'managers-with-at-least-5-direct-reports'),
    topicTags: ['self-join', 'group-by', 'having'],
  },

  {
    slug: 'lc-confirmation-rate',
    title: 'Confirmation Rate',
    category: 'joins',
    difficulty: 'Medium',
    mode: 'external',
    statement:
      'Report each user\'s confirmation rate — confirmed requests over all requests — rounded to two decimals, with `0.00` for users who never requested anything.\n\nThe average of a `CASE` is the idiom worth taking away: it turns "what fraction of these rows are X" into one expression.',
    learnTopic: 'sql/left-and-right-join',
    source: lc(14, 1934, 'confirmation-rate'),
    topicTags: ['left-join', 'case', 'avg', 'round'],
  },

  {
    slug: 'lc-employees-reporting-count',
    title: 'The Number of Employees Which Report to Each Employee',
    category: 'joins',
    difficulty: 'Easy',
    mode: 'external',
    statement:
      'For each manager, report how many people report to them and the average age of those people, rounded to the nearest whole number.\n\nA self-join with two aggregates over the reporting side, ordered by id.',
    learnTopic: 'sql/self-join',
    source: lc(30, 1731, 'the-number-of-employees-which-report-to-each-employee'),
    topicTags: ['self-join', 'group-by', 'round'],
  },

  /* ------------------------------------------------ 3. Aggregation & grouping */

  {
    slug: 'lc-average-selling-price',
    title: 'Average Selling Price',
    category: 'aggregation',
    difficulty: 'Easy',
    mode: 'external',
    statement:
      'Work out each product\'s average selling price, where the price depends on which date range the sale fell in.\n\nA weighted average — total revenue over total units, not the average of the per-row prices. Products that sold nothing still have to appear.',
    learnTopic: 'sql/aggregate-functions',
    source: lc(16, 1251, 'average-selling-price'),
    topicTags: ['join', 'weighted-average', 'round'],
  },

  {
    slug: 'lc-project-employees-i',
    title: 'Project Employees I',
    category: 'aggregation',
    difficulty: 'Easy',
    mode: 'external',
    statement:
      'Report the average experience, in years, of the employees on each project — rounded to two decimals.\n\nA join and a `GROUP BY`, and the first place the difference between rounding and truncating shows up.',
    learnTopic: 'sql/group-by-having',
    source: lc(17, 1075, 'project-employees-i'),
    topicTags: ['join', 'group-by', 'avg', 'round'],
  },

  {
    slug: 'lc-percentage-users-attended-contest',
    title: 'Percentage of Users Attended a Contest',
    category: 'aggregation',
    difficulty: 'Easy',
    mode: 'external',
    statement:
      'For each contest, what percentage of all registered users took part?\n\nThe denominator is a count of a *different* table, which is what makes this a scalar subquery rather than another aggregate.',
    learnTopic: 'sql/aggregate-functions',
    source: lc(18, 1633, 'percentage-of-users-attended-a-contest'),
    topicTags: ['group-by', 'scalar-subquery', 'percentage'],
  },

  {
    slug: 'lc-queries-quality-and-percentage',
    title: 'Queries Quality and Percentage',
    category: 'aggregation',
    difficulty: 'Easy',
    mode: 'external',
    statement:
      'Per query name, report the average of rating divided by position, and the percentage of results rated below 3.\n\nTwo aggregates in one pass — one an average of a ratio, the other an average of a condition.',
    learnTopic: 'sql/aggregate-functions',
    source: lc(19, 1211, 'queries-quality-and-percentage'),
    topicTags: ['group-by', 'avg', 'case', 'round'],
  },

  {
    slug: 'lc-monthly-transactions-i',
    title: 'Monthly Transactions I',
    category: 'aggregation',
    difficulty: 'Medium',
    mode: 'external',
    statement:
      'Per month and country, report the number of transactions and their total amount, alongside the same two numbers for the approved ones only.\n\nConditional aggregation: the "approved only" figures come from summing a `CASE`, not from a second query.',
    learnTopic: 'sql/group-by-having',
    source: lc(20, 1193, 'monthly-transactions-i'),
    topicTags: ['group-by', 'case', 'dates'],
  },

  {
    slug: 'lc-immediate-food-delivery-ii',
    title: 'Immediate Food Delivery II',
    category: 'aggregation',
    difficulty: 'Medium',
    mode: 'external',
    statement:
      'Of every customer\'s **first** order, what percentage were wanted immediately rather than scheduled?\n\nTwo steps that have to stay separate: find each customer\'s first order date, then measure only those rows.',
    learnTopic: 'sql/group-by-having',
    source: lc(21, 1174, 'immediate-food-delivery-ii'),
    topicTags: ['group-by', 'first-per-group', 'percentage'],
  },

  {
    slug: 'lc-game-play-analysis-iv',
    title: 'Game Play Analysis IV',
    category: 'aggregation',
    difficulty: 'Medium',
    mode: 'external',
    statement:
      'What fraction of players logged in again on the very next day after their first login?\n\nDay-one retention, and the denominator is every player — including the ones who never came back.',
    learnTopic: 'sql/group-by-having',
    source: lc(22, 550, 'game-play-analysis-iv'),
    topicTags: ['group-by', 'dates', 'retention'],
  },

  {
    slug: 'lc-unique-subjects-per-teacher',
    title: 'Number of Unique Subjects Taught by Each Teacher',
    category: 'aggregation',
    difficulty: 'Easy',
    mode: 'external',
    statement:
      'Count the distinct subjects each teacher teaches.\n\nThe same teacher and subject appear once per class, so `COUNT(*)` answers a different question from the one asked.',
    learnTopic: 'sql/aggregate-functions',
    source: lc(23, 2356, 'number-of-unique-subjects-taught-by-each-teacher'),
    topicTags: ['group-by', 'count-distinct'],
  },

  {
    slug: 'lc-user-activity-past-30-days-i',
    title: 'User Activity for the Past 30 Days I',
    category: 'aggregation',
    difficulty: 'Easy',
    mode: 'external',
    statement:
      'Count the distinct active users on each day of the 30-day window ending 2019-07-27.\n\nA date range and a distinct count; days with nobody on them are simply absent from the answer.',
    learnTopic: 'sql/group-by-having',
    source: lc(24, 1141, 'user-activity-for-the-past-30-days-i'),
    topicTags: ['group-by', 'count-distinct', 'dates'],
  },

  {
    slug: 'lc-classes-more-than-5-students',
    title: 'Classes More Than 5 Students',
    category: 'aggregation',
    difficulty: 'Easy',
    mode: 'external',
    statement:
      'List the classes with at least five students in them.\n\nThe smallest possible `HAVING` problem, and the one to reach for when explaining why `WHERE COUNT(*) >= 5` cannot work.',
    learnTopic: 'sql/group-by-having',
    source: lc(26, 596, 'classes-more-than-5-students'),
    topicTags: ['group-by', 'having'],
  },

  {
    slug: 'lc-find-followers-count',
    title: 'Find Followers Count',
    category: 'aggregation',
    difficulty: 'Easy',
    mode: 'external',
    statement:
      'Report how many followers each user has, ordered by user id.\n\nGroup, count, sort — and the users nobody follows do not appear, which is worth noticing rather than assuming.',
    learnTopic: 'sql/group-by-having',
    source: lc(27, 1729, 'find-followers-count'),
    topicTags: ['group-by', 'count', 'order-by'],
  },

  {
    slug: 'lc-biggest-single-number',
    title: 'Biggest Single Number',
    category: 'aggregation',
    difficulty: 'Easy',
    mode: 'external',
    statement:
      'Find the largest number that appears exactly once — and return `NULL`, not an empty result, when there is none.\n\nThe `NULL` requirement is the whole problem: it decides whether you can use `LIMIT` at all.',
    learnTopic: 'sql/group-by-having',
    source: lc(28, 619, 'biggest-single-number'),
    topicTags: ['group-by', 'having', 'null'],
  },

  {
    slug: 'lc-customers-who-bought-all-products',
    title: 'Customers Who Bought All Products',
    category: 'aggregation',
    difficulty: 'Medium',
    mode: 'external',
    statement:
      'Find the customers who have bought every product in the catalogue.\n\nRelational division, and the trick is to stop looking for a "for all" operator: count each customer\'s distinct products and compare it to the size of the catalogue.',
    learnTopic: 'sql/group-by-having',
    source: lc(29, 1045, 'customers-who-bought-all-products'),
    topicTags: ['group-by', 'having', 'relational-division'],
  },

  {
    slug: 'lc-count-salary-categories',
    title: 'Count Salary Categories',
    category: 'aggregation',
    difficulty: 'Medium',
    mode: 'external',
    statement:
      'Count the bank accounts in three income bands — low, average and high — and report a band with **zero** accounts as a `0` row rather than leaving it out.\n\nA `GROUP BY` cannot produce a group that has no rows, which is exactly why this is the interesting version of a counting problem.',
    learnTopic: 'sql/group-by-having',
    source: lc(36, 1907, 'count-salary-categories'),
    topicTags: ['case', 'union-all', 'empty-groups'],
  },

  /* --------------------------------------------- 4. Sorting & pagination */

  {
    slug: 'lc-product-sales-analysis-iii',
    title: 'Product Sales Analysis III',
    category: 'sorting',
    difficulty: 'Medium',
    mode: 'external',
    statement:
      'For every product, report the sales made in its **first** year on sale.\n\nA group-wise minimum, and a product can have several sales in that first year — so it is not "one row per product".',
    learnTopic: 'sql/order-and-limit',
    source: lc(25, 1070, 'product-sales-analysis-iii'),
    topicTags: ['first-per-group', 'subquery', 'min'],
  },

  /* ------------------------------------------------ 5. Subqueries & CTEs */

  {
    slug: 'lc-primary-department-for-each-employee',
    title: 'Primary Department for Each Employee',
    category: 'subqueries',
    difficulty: 'Easy',
    mode: 'external',
    statement:
      'Give each employee one department: the one flagged primary, or — if they belong to exactly one department — that one.\n\nTwo rules, one answer, and the second only applies where the first does not.',
    learnTopic: 'sql/subqueries',
    source: lc(31, 1789, 'primary-department-for-each-employee'),
    topicTags: ['subquery', 'group-by', 'union'],
  },

  {
    slug: 'lc-product-price-at-a-given-date',
    title: 'Product Price at a Given Date',
    category: 'subqueries',
    difficulty: 'Medium',
    mode: 'external',
    statement:
      'Report every product\'s price as it stood on 2019-08-16, given a log of price changes — and 10 for a product whose price has never changed.\n\nThe last change on or before a date, per product, with a default for the ones that have none.',
    learnTopic: 'sql/correlated-subqueries',
    source: lc(34, 1164, 'product-price-at-a-given-date'),
    topicTags: ['correlated-subquery', 'as-of', 'union'],
  },

  {
    slug: 'lc-employees-whose-manager-left',
    title: 'Employees Whose Manager Left the Company',
    category: 'subqueries',
    difficulty: 'Easy',
    mode: 'external',
    statement:
      'Find the employees paid under $30,000 whose manager is no longer in the table.\n\nA `NOT IN` over ids that are still present — and the manager column is nullable, which is the part that bites.',
    learnTopic: 'sql/exists-in-any-all',
    source: lc(37, 1978, 'employees-whose-manager-left-the-company'),
    topicTags: ['not-in', 'null', 'subquery'],
  },

  {
    slug: 'lc-movie-rating',
    title: 'Movie Rating',
    category: 'subqueries',
    difficulty: 'Medium',
    mode: 'external',
    statement:
      'Two answers in one result: the user who has rated the most movies, and the highest-average-rated movie of February 2020 — ties broken alphabetically in both cases.\n\nTwo unrelated queries stapled together with `UNION ALL`, which is the honest way to do it.',
    learnTopic: 'sql/subqueries',
    source: lc(39, 1341, 'movie-rating'),
    topicTags: ['union-all', 'group-by', 'ties'],
  },

  {
    slug: 'lc-friend-requests-ii',
    title: 'Friend Requests II: Who Has the Most Friends',
    category: 'subqueries',
    difficulty: 'Medium',
    mode: 'external',
    statement:
      'Find the person with the most friends, given a table of accepted requests.\n\nA friendship counts for both people, so the two id columns have to be stacked into one before anything can be counted.',
    learnTopic: 'sql/set-operations',
    source: lc(41, 602, 'friend-requests-ii-who-has-the-most-friends'),
    topicTags: ['union-all', 'group-by', 'order-by'],
  },

  {
    slug: 'lc-investments-in-2016',
    title: 'Investments in 2016',
    category: 'subqueries',
    difficulty: 'Medium',
    mode: 'external',
    statement:
      'Sum the 2016 investments of the policyholders who share a 2015 value with someone else **and** whose location is unique.\n\nTwo conditions pulling in opposite directions — one wants duplicates, the other wants the absence of them.',
    learnTopic: 'sql/subqueries',
    source: lc(42, 585, 'investments-in-2016'),
    topicTags: ['subquery', 'group-by', 'having'],
  },

  /* --------------------------------------------------- 6. Window functions */

  {
    slug: 'lc-consecutive-numbers',
    title: 'Consecutive Numbers',
    category: 'window',
    difficulty: 'Medium',
    mode: 'external',
    statement:
      'Find the numbers that appear three times in a row.\n\n`LAG` and `LEAD` make this three lines; the self-join version is worth writing once so you know why they exist.',
    learnTopic: 'sql/window-frames-lag-lead',
    source: lc(33, 180, 'consecutive-numbers'),
    topicTags: ['lag', 'lead', 'self-join'],
  },

  {
    slug: 'lc-last-person-to-fit-in-the-bus',
    title: 'Last Person to Fit in the Bus',
    category: 'window',
    difficulty: 'Medium',
    mode: 'external',
    statement:
      'People board in turn and the bus holds 1000kg. Name the last person who fits.\n\nA running total in boarding order, then the final row that is still under the limit.',
    learnTopic: 'sql/window-frames-lag-lead',
    source: lc(35, 1204, 'last-person-to-fit-in-the-bus'),
    topicTags: ['running-total', 'window-frame', 'order-by'],
  },

  {
    slug: 'lc-exchange-seats',
    title: 'Exchange Seats',
    category: 'window',
    difficulty: 'Medium',
    mode: 'external',
    statement:
      'Swap every pair of adjacent students. If the number of students is odd, the last one stays where they are.\n\nThe odd tail is the whole problem — a plain `id + 1` / `id - 1` swap moves the last student off the end of the list.',
    learnTopic: 'sql/window-frames-lag-lead',
    source: lc(38, 626, 'exchange-seats'),
    topicTags: ['case', 'lead', 'lag'],
  },

  {
    slug: 'lc-restaurant-growth',
    title: 'Restaurant Growth',
    category: 'window',
    difficulty: 'Medium',
    mode: 'external',
    statement:
      'Report the moving total and moving average of customer spend over every seven-day window, once the first full window exists.\n\nA rolling window over dates, and the first six days are deliberately not in the answer.',
    learnTopic: 'sql/window-frames-lag-lead',
    source: lc(40, 1321, 'restaurant-growth'),
    topicTags: ['moving-window', 'dates', 'round'],
  },

  {
    slug: 'lc-department-top-three-salaries',
    title: 'Department Top Three Salaries',
    category: 'window',
    difficulty: 'Hard',
    mode: 'external',
    statement:
      'List the employees earning one of the three highest **distinct** salaries in their department.\n\nThe only Hard in the plan, and the reason is the word distinct: `DENSE_RANK` gives it to you and `ROW_NUMBER` quietly does not.',
    learnTopic: 'sql/window-functions',
    source: lc(43, 185, 'department-top-three-salaries'),
    topicTags: ['dense-rank', 'partition-by', 'top-n-per-group'],
  },

  /* ------------------------------------------- 7. Strings, dates & logic */

  {
    slug: 'lc-triangle-judgement',
    title: 'Triangle Judgement',
    category: 'strings-dates',
    difficulty: 'Easy',
    mode: 'external',
    statement:
      'For each row of three side lengths, report `Yes` or `No` depending on whether they could form a triangle.\n\nA `CASE` over the triangle inequality — all three pairs, not just the two that look obvious.',
    learnTopic: 'sql/where-and-operators',
    source: lc(32, 610, 'triangle-judgement'),
    topicTags: ['case', 'boolean-logic'],
  },

  {
    slug: 'lc-fix-names-in-a-table',
    title: 'Fix Names in a Table',
    category: 'strings-dates',
    difficulty: 'Easy',
    mode: 'external',
    statement:
      'Normalise each name so that only its first letter is capitalised.\n\nString surgery: take the first character one way, the rest the other way, and glue them back together.',
    learnTopic: 'sql/data-types',
    source: lc(44, 1667, 'fix-names-in-a-table'),
    topicTags: ['upper', 'lower', 'substring', 'concat'],
  },

  {
    slug: 'lc-patients-with-a-condition',
    title: 'Patients With a Condition',
    category: 'strings-dates',
    difficulty: 'Easy',
    mode: 'external',
    statement:
      'Find the patients with a Type I diabetes code — a code beginning `DIAB1`, anywhere in a space-separated list.\n\nThe trap is `LIKE \'%DIAB1%\'`, which also matches `SADIAB100`. A code has to start a word to count.',
    learnTopic: 'sql/data-types',
    source: lc(45, 1527, 'patients-with-a-condition'),
    topicTags: ['like', 'prefix-match', 'strings'],
  },

  {
    slug: 'lc-group-sold-products-by-the-date',
    title: 'Group Sold Products By The Date',
    category: 'strings-dates',
    difficulty: 'Easy',
    mode: 'external',
    statement:
      'For each sell date, report how many distinct products sold and their names as one comma-separated, alphabetically sorted string.\n\nString aggregation — `GROUP_CONCAT` in MySQL, `STRING_AGG` almost everywhere else.',
    learnTopic: 'sql/aggregate-functions',
    source: lc(48, 1484, 'group-sold-products-by-the-date'),
    topicTags: ['group-concat', 'count-distinct', 'group-by'],
  },

  {
    slug: 'lc-list-products-ordered-in-a-period',
    title: 'List the Products Ordered in a Period',
    category: 'strings-dates',
    difficulty: 'Easy',
    mode: 'external',
    statement:
      'Report the products with 100 or more units ordered during February 2020.\n\nA month filter and a `HAVING` on the total — and how you write the date range decides whether the last day of the month is included.',
    learnTopic: 'sql/group-by-having',
    source: lc(49, 1327, 'list-the-products-ordered-in-a-period'),
    topicTags: ['join', 'dates', 'having'],
  },

  {
    slug: 'lc-find-users-with-valid-emails',
    title: 'Find Users With Valid E-Mails',
    category: 'strings-dates',
    difficulty: 'Easy',
    mode: 'external',
    statement:
      'Keep the users whose email is valid: a name starting with a letter, then letters, digits, underscores, dots or dashes, followed by `@leetcode.com`.\n\nThe plan\'s one regex problem, and a good demonstration of why anchoring the pattern at both ends matters.',
    learnTopic: 'sql/data-types',
    source: lc(50, 1517, 'find-users-with-valid-e-mails'),
    topicTags: ['regexp', 'validation', 'strings'],
  },
];
