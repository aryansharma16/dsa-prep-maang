import { http } from './http.js';

export const authApi = {
  /*
    These three return the whole session — `{ user, modules }` — rather than
    just the user, because which modules are on the side menu depends on who
    just signed in. Handing them back together is what stops the two being
    applied a render apart. The avatar and profile endpoints below still return
    a bare user: they cannot change either answer.
  */
  register: (body) => http.post('/auth/register', body).then((r) => r.data),
  login: (body) => http.post('/auth/login', body).then((r) => r.data),
  logout: () => http.post('/auth/logout').then((r) => r.data),
  me: () => http.get('/auth/me').then((r) => r.data),
  /** Your own name and profile fields. Returns the whole updated user. */
  updateMe: (body) => http.patch('/auth/me', body).then((r) => r.data.user),
  /** Out of five. Replaces any earlier rating — it is an opinion, not a vote. */
  rate: (stars) => http.put('/auth/me/rating', { stars }).then((r) => r.data.user),

  /**
   * Both return the whole updated user, so the caller replaces its copy rather
   * than patching a field into it and hoping the two stay in step.
   *
   * No Content-Type header: the browser has to set it itself, because only it
   * knows the multipart boundary it just generated.
   */
  uploadAvatar: (file, onProgress) => {
    const form = new FormData();
    form.append('avatar', file);
    return http
      .post('/auth/me/avatar', form, {
        onUploadProgress: (event) =>
          onProgress?.(event.total ? Math.round((event.loaded / event.total) * 100) : 0),
      })
      .then((r) => r.data.user);
  },
  removeAvatar: () => http.delete('/auth/me/avatar').then((r) => r.data.user),
};

export const problemsApi = {
  roadmap: (params) => http.get('/problems', { params }).then((r) => r.data),
  patterns: () => http.get('/patterns').then((r) => r.data.patterns),
  guide: (slug) => http.get(`/patterns/${slug}/guide`).then((r) => r.data),
  description: (slug) => http.get(`/problems/${slug}/description`).then((r) => r.data),
  lookup: (url) => http.post('/problems/lookup', { url }).then((r) => r.data),
  create: (body) => http.post('/problems', body).then((r) => r.data.problem),
  /** Your own additions only — the server refuses anyone else's. */
  update: (id, body) => http.patch(`/problems/${id}`, body).then((r) => r.data.problem),
  remove: (id) => http.delete(`/problems/${id}`).then((r) => r.data),
};

/**
 * The body of a review, with the optional halves left out when empty.
 *
 * Shared by all four queues because all four take the same shape, and because
 * sending `grade: undefined` or `recall: ''` is the sort of thing a zod enum
 * refuses for reasons that are then hard to see from the network tab.
 */
const reviewBody = ({ result, grade, confidence, recall } = {}) => ({
  result,
  ...(grade ? { grade } : {}),
  ...(confidence ? { confidence } : {}),
  // Test mode's line. Omitted entirely when there is none, so the plain queue's
  // request is byte-for-byte the one it always sent.
  ...(recall ? { recall } : {}),
});

export const progressApi = {
  patch: (problemId, body) => http.patch(`/progress/${problemId}`, body).then((r) => r.data.progress),
  attempt: (problemId, body) =>
    http.post(`/progress/${problemId}/attempt`, body).then((r) => r.data.progress),
  /*
    The whole log for one problem, with whole notes. The roadmap already carries
    the last few attempts with their notes truncated, which is what the table
    column draws — this is the version worth a request because you opened the
    dialog to read it.
  */
  attempts: (problemId) => http.get(`/progress/${problemId}/attempts`).then((r) => r.data),
  /*
    Addressed by the attempt's own id. It used to be the index, on the argument
    that an append-only array cannot move — which stopped being true the moment
    one could be deleted.
  */
  editAttempt: (problemId, attemptId, body) =>
    http.patch(`/progress/${problemId}/attempts/${attemptId}`, body).then((r) => r.data.progress),
  deleteAttempt: (problemId, attemptId) =>
    http.delete(`/progress/${problemId}/attempts/${attemptId}`).then((r) => r.data.progress),
  /** `{ items, upcoming }` — what is due, and the next thirty that are not. */
  revision: () => http.get('/progress/revision').then((r) => r.data),
  /*
    Working the queue.

    `{ result, grade, recall }`. `recalled` climbs the ladder by its grade,
    `missed` drops a rung and comes back tomorrow, `dismissed` only clears what
    was putting the row in front of you. Posted rather than patched because "I
    reviewed this" is an event, not a field — see the server for what the patch
    route could not do here.

    A body rather than positional arguments, since there are four things to say
    and three of them are optional.
  */
  review: (problemId, body) =>
    http.post(`/progress/${problemId}/review`, reviewBody(body)).then((r) => r.data.progress),
};

export const statsApi = {
  get: () => http.get('/stats').then((r) => r.data),
};

/**
 * Pro Coder — the competitive-programming ladder.
 *
 * A separate namespace from `problemsApi`/`progressApi` rather than a `source`
 * parameter on them, because it is a separate collection with a separate
 * visibility rule behind a separate module gate. The shapes rhyme deliberately:
 * anyone who has read the roadmap's calls can read these.
 *
 * `ladder` answers a flat list plus ordered tier and pattern metadata rather
 * than a pre-grouped tree — the page offers two groupings of the same rows, and
 * re-fetching on a toggle would make a client-side regroup feel like a page
 * load.
 */
export const cpApi = {
  ladder: () => http.get('/cp/ladder').then((r) => r.data),
  patterns: () => http.get('/cp/patterns').then((r) => r.data),
  /** 404 for a pattern with no long-form guide yet — an ordinary answer here. */
  guide: (slug) => http.get(`/cp/patterns/${slug}/guide`).then((r) => r.data.guide),
  stats: () => http.get('/cp/stats').then((r) => r.data),
  revision: () => http.get('/cp/revision').then((r) => r.data),

  create: (body) => http.post('/cp/problems', body).then((r) => r.data.problem),
  update: (id, body) => http.patch(`/cp/problems/${id}`, body).then((r) => r.data.problem),
  remove: (id) => http.delete(`/cp/problems/${id}`).then((r) => r.data),

  patch: (problemId, body) =>
    http.patch(`/cp/progress/${problemId}`, body).then((r) => r.data.progress),
  attempt: (problemId, body) =>
    http.post(`/cp/progress/${problemId}/attempt`, body).then((r) => r.data.progress),
  attempts: (problemId) => http.get(`/cp/progress/${problemId}/attempts`).then((r) => r.data),
  editAttempt: (problemId, attemptId, body) =>
    http.patch(`/cp/progress/${problemId}/attempts/${attemptId}`, body).then((r) => r.data.progress),
  deleteAttempt: (problemId, attemptId) =>
    http.delete(`/cp/progress/${problemId}/attempts/${attemptId}`).then((r) => r.data.progress),
  review: (problemId, body) =>
    http.post(`/cp/progress/${problemId}/review`, reviewBody(body)).then((r) => r.data.progress),

  /**
   * The linked Codeforces identity.
   *
   * `profile` answers `null` for an account that has never linked a handle,
   * which is an ordinary first answer rather than a missing resource — the same
   * contract `viewsApi.get` has.
   *
   * `setHandle('')` clears the link. `sync` is the expensive one: it pulls the
   * whole submission history from Codeforces, so the server holds it to one run
   * per account per ten minutes and answers 429 with a `retryAt` in between.
   */
  profile: () => http.get('/cp/profile').then((r) => r.data),
  setHandle: (handle) => http.put('/cp/profile/handle', { handle }).then((r) => r.data.profile),
  sync: () => http.post('/cp/profile/sync').then((r) => r.data),
  ratingHistory: () => http.get('/cp/profile/rating-history').then((r) => r.data.history),
};

/**
 * SQL Lab — the practice bank you actually run queries against.
 *
 * Its own namespace beside `cpApi` for the same reasons: a separate collection,
 * a separate visibility rule, a separate module gate. The shapes rhyme
 * deliberately, so anyone who has read the ladder's calls can read these.
 *
 * `bank` answers a flat list plus ordered category and difficulty metadata,
 * rather than a pre-grouped tree — the page offers two groupings of the same
 * rows and re-fetching on a toggle would make a client-side regroup feel like a
 * page load.
 *
 * `problem` is a second request on open, and that split is deliberate: the
 * expected result, the sample rows and the reference answer are the bulk of the
 * payload and are needed for exactly one problem at a time. Sending 120 of them
 * with the list would also hand over every answer before anybody had opened
 * anything.
 *
 * There is no `run` here, and there should never be one. Queries execute in the
 * reader's own browser; this API stores what happened.
 */
export const sqlApi = {
  bank: () => http.get('/sql/bank').then((r) => r.data),
  stats: () => http.get('/sql/stats').then((r) => r.data),
  problem: (id) => http.get(`/sql/problems/${id}`).then((r) => r.data.problem),
  revision: () => http.get('/sql/revision').then((r) => r.data),

  patch: (problemId, body) =>
    http.patch(`/sql/progress/${problemId}`, body).then((r) => r.data.progress),

  /** The verified pass. Answers `firstSolve` so the workbench can say so. */
  solved: (problemId, query, ms) =>
    http.post(`/sql/progress/${problemId}/solved`, { query, ms }).then((r) => r.data.progress),

  attempt: (problemId, body) =>
    http.post(`/sql/progress/${problemId}/attempt`, body).then((r) => r.data.progress),
  attempts: (problemId) => http.get(`/sql/progress/${problemId}/attempts`).then((r) => r.data),
  editAttempt: (problemId, attemptId, body) =>
    http
      .patch(`/sql/progress/${problemId}/attempts/${attemptId}`, body)
      .then((r) => r.data.progress),
  deleteAttempt: (problemId, attemptId) =>
    http.delete(`/sql/progress/${problemId}/attempts/${attemptId}`).then((r) => r.data.progress),
  review: (problemId, body) =>
    http.post(`/sql/progress/${problemId}/review`, reviewBody(body)).then((r) => r.data.progress),
};

/**
 * How a screen is set up for you — today, the filters you left on it.
 *
 * Deliberately untyped in both directions: the server bounds the payload and
 * stores it without reading inside, so a module can add a filter without this
 * file, that file, or the database learning what it means. `scope` is the one
 * part it does check — see the server's config/viewScopes.js.
 *
 * `get` answers `null` for an account that has never saved this screen, which is
 * an ordinary first answer rather than a missing resource. `save` with an empty
 * bag is how you clear: it removes the row rather than storing "nothing on".
 */
export const viewsApi = {
  get: (scope) => http.get(`/views/${scope}`).then((r) => r.data.view),
  save: (scope, filters) => http.put(`/views/${scope}`, { filters }).then((r) => r.data.view),
  clear: (scope) => http.delete(`/views/${scope}`).then((r) => r.data.view),
};

/**
 * Learn — the reference itself, and what you have done with it.
 *
 * `catalogue` is the whole table of contents in one response: four tracks,
 * thirty-three sections and every topic's heading, about 20KB on the wire. One
 * request rather than one per track, because the hub needs all four for its
 * search and its meters, and a topic page needs its track's reading order before
 * it can draw a pager. It replaces four lazy chunks that were larger.
 *
 * `topic` is one topic's words, and it resolves a renamed slug rather than
 * 404ing on it — the response carries `canonical` when the URL should be
 * corrected.
 *
 * `mark` still sends the title. It no longer has to — there is a collection to
 * look one up in now — but `LearnProgress` snapshots it on purpose, so a row in
 * your revision queue still says what you scheduled even if the topic is renamed
 * underneath it.
 */
export const learnApi = {
  catalogue: () => http.get('/learn/catalogue').then((r) => r.data),
  topic: (track, topic) => http.get(`/learn/topics/${track}/${topic}`).then((r) => r.data),

  progress: () => http.get('/learn/progress').then((r) => r.data.topics),
  revision: () => http.get('/learn/revision').then((r) => r.data),

  /** The browsing fact. Never touches the revision ladder — see the server. */
  markRead: (track, topic, read) =>
    http.put(`/learn/progress/${track}/${topic}/read`, { read }).then((r) => r.data.topic),
  /** The one-time hand-over of the old localStorage map, in one request. */
  bulkRead: (keys) => http.put('/learn/progress/read', { keys }).then((r) => r.data),

  mark: (track, topic, body) =>
    http.put(`/learn/progress/${track}/${topic}`, body).then((r) => r.data.topic),
  review: (track, topic, body) =>
    http
      .post(`/learn/progress/${track}/${topic}/review`, reviewBody(body))
      .then((r) => r.data.topic),
};

/**
 * Practice — the pattern drill, and the mock beside it.
 *
 * A run is posted once, when you stop. There is deliberately no per-answer
 * endpoint: the drill answers at about three seconds each, and a request per
 * answer would be a write storm for a signal that only means anything summed up.
 */
export const practiceApi = {
  saveDrillRun: (body) => http.post('/practice/drill-runs', body).then((r) => r.data.run),
  saveMockRun: (body) => http.post('/practice/mock-runs', body).then((r) => r.data.run),
  stats: () => http.get('/practice/stats').then((r) => r.data),
};

/**
 * The owner's prep plan — the state half of it.
 *
 * The plan itself is authored in `playbook/plan.js` and never leaves the
 * bundle, so this endpoint carries only what the document cannot know about
 * itself: the start date, the ticks, and the retro notes. Every write is a
 * PATCH of one thing — one date, one tick, one note — and answers with the
 * whole plan, so a caller never reassembles what the server decided.
 *
 * 404s for every account but the owner's. That is the module gate, not an
 * error: see server/src/middleware/requireModule.js.
 */
export const playbookApi = {
  get: () => http.get('/playbook').then((r) => r.data.plan),
  patch: (body) => http.patch('/playbook', body).then((r) => r.data.plan),
};

/**
 * One line, chosen server-side from what you have actually done.
 *
 * `line` is null when nothing matches — a deployment that has not been seeded,
 * or a surface nobody has written for — and the caller renders nothing rather
 * than an empty strip.
 */
export const motivationApi = {
  get: (surface) => http.get('/motivation', { params: { surface } }).then((r) => r.data.line),
  /** The signed-out page. Public, so this works with no session. */
  login: () => http.get('/motivation/login').then((r) => r.data.line),
};

/**
 * What the people using this have to say about it.
 *
 * `mine` returns your own submissions and nothing else — the server filters by
 * the session rather than by a parameter, so there is no shape of this request
 * that reads somebody else's. Everything staff needs is on `adminApi` below,
 * behind `feedback:read`, which is what keeps the two audiences off a single
 * route that would have to remember which one is asking.
 */
export const feedbackApi = {
  mine: (params) => http.get('/feedback', { params }).then((r) => r.data),
  create: (body) => http.post('/feedback', body).then((r) => r.data),
};

/**
 * The admin panel.
 *
 * Guides are read through `adminApi.guide`, not `problemsApi.guide`: the public
 * one goes through the module cache in useGuide, and the editor must never open
 * a stale copy or write an admin-shaped payload into it.
 */
/**
 * Everything except the reply itself. The stream is raw fetch — see api/stream.js
 * for why, and for the auth-refresh story an interceptor cannot cover.
 */
export const chatApi = {
  config: () => http.get('/chat/config').then((r) => r.data),
  conversations: () => http.get('/chat/conversations', { params: { limit: 50 } }).then((r) => r.data.conversations),
  conversation: (id) => http.get(`/chat/conversations/${id}`).then((r) => r.data),
  rename: (id, title) => http.patch(`/chat/conversations/${id}`, { title }).then((r) => r.data.conversation),
  remove: (id) => http.delete(`/chat/conversations/${id}`).then((r) => r.data),
  clear: () => http.delete('/chat/conversations').then((r) => r.data),
  stop: (conversationId) => http.post('/chat/stop', { conversationId }).then((r) => r.data),
};

/**
 * The task board.
 *
 * Almost every mutation resolves to the whole updated task rather than to `ok`.
 * A task is small and the page holds it in one array, so returning it means the
 * caller replaces its copy instead of patching a field in and hoping the two
 * stay in step — the argument `authApi.updateMe` already makes about the user.
 *
 * The timer calls are the exception: they also carry the server's `now`, which
 * is what the elapsed counter is measured against. See TasksContext.
 */
/**
 * System Design — projects, their folder trees, and boards.
 *
 * Tree writes return `{ node, treeRev }` or similar, unwrapped no further: the
 * explorer uses `treeRev` to notice that another tab changed the tree.
 *
 * `commit` is the board save. It is called by the autosave queue in
 * design/sync/, never directly by a component — the queue owns ordering,
 * retries and batch ids, and a second caller would break all three.
 */
export const designApi = {
  projects: (params) => http.get('/design/projects', { params }).then((r) => r.data.projects),
  createProject: (body) => http.post('/design/projects', body).then((r) => r.data),
  project: (id) => http.get(`/design/projects/${id}`).then((r) => r.data),
  updateProject: (id, body) => http.patch(`/design/projects/${id}`, body).then((r) => r.data.project),
  removeProject: (id) => http.delete(`/design/projects/${id}`).then((r) => r.data),
  restoreProject: (id) => http.post(`/design/projects/${id}/restore`).then((r) => r.data.project),
  purgeProject: (id) => http.delete(`/design/projects/${id}/permanent`).then((r) => r.data),

  createNode: (projectId, body) => http.post(`/design/projects/${projectId}/nodes`, body).then((r) => r.data),
  renameNode: (id, name) => http.patch(`/design/nodes/${id}`, { name }).then((r) => r.data),
  /** `after` undefined appends, null puts it first, an id puts it after that sibling. */
  moveNode: (id, body) => http.post(`/design/nodes/${id}/move`, body).then((r) => r.data),
  duplicateNode: (id, body = {}) => http.post(`/design/nodes/${id}/duplicate`, body).then((r) => r.data),
  removeNode: (id) => http.delete(`/design/nodes/${id}`).then((r) => r.data),
  restoreNode: (id) => http.post(`/design/nodes/${id}/restore`).then((r) => r.data),
  purgeNode: (id) => http.delete(`/design/nodes/${id}/permanent`).then((r) => r.data),

  board: (id) => http.get(`/design/boards/${id}`).then((r) => r.data),
  changes: (id, since) => http.get(`/design/boards/${id}/changes`, { params: { since } }).then((r) => r.data),
  commit: (id, batch, config) => http.post(`/design/boards/${id}/ops`, batch, config).then((r) => r.data),

  trash: () => http.get('/design/trash').then((r) => r.data),
  recent: (limit = 8) => http.get('/design/recent', { params: { limit } }).then((r) => r.data.boards),
};

export const tasksApi = {
  /** Board and tasks together — one request paints the page. */
  board: () => http.get('/tasks').then((r) => r.data),
  get: (id) => http.get(`/tasks/${id}`).then((r) => r.data.task),
  create: (body) => http.post('/tasks', body).then((r) => r.data.task),
  update: (id, body) => http.patch(`/tasks/${id}`, body).then((r) => r.data.task),
  remove: (id) => http.delete(`/tasks/${id}`).then((r) => r.data),
  restore: (id) => http.post(`/tasks/${id}/restore`).then((r) => r.data.task),

  /**
   * A drag. `ids` is the destination column in full, in the order it was drawn,
   * so within-column and cross-column moves are one call.
   */
  move: (body) => http.post('/tasks/move', body).then((r) => r.data.task),

  addStatus: (body) => http.post('/tasks/board/statuses', body).then((r) => r.data),
  updateStatus: (statusId, body) =>
    http.patch(`/tasks/board/statuses/${statusId}`, body).then((r) => r.data),
  removeStatus: (statusId, moveTo) =>
    http
      .delete(`/tasks/board/statuses/${statusId}`, { params: moveTo ? { moveTo } : {} })
      .then((r) => r.data),
  reorderStatuses: (ids) => http.put('/tasks/board/statuses', { ids }).then((r) => r.data.board),

  addSubtask: (id, title) => http.post(`/tasks/${id}/subtasks`, { title }).then((r) => r.data.task),
  updateSubtask: (id, subtaskId, body) =>
    http.patch(`/tasks/${id}/subtasks/${subtaskId}`, body).then((r) => r.data.task),
  removeSubtask: (id, subtaskId) =>
    http.delete(`/tasks/${id}/subtasks/${subtaskId}`).then((r) => r.data.task),

  /** Ids only — the server reads the titles off the roadmap. */
  addQuestions: (id, problemIds) =>
    http.post(`/tasks/${id}/questions`, { problemIds }).then((r) => r.data.task),
  removeQuestion: (id, problemId) =>
    http.delete(`/tasks/${id}/questions/${problemId}`).then((r) => r.data.task),

  timerStart: (id) => http.post(`/tasks/${id}/timer/start`).then((r) => r.data),
  timerStop: (id) => http.post(`/tasks/${id}/timer/stop`).then((r) => r.data),
  timer: () => http.get('/tasks/timer').then((r) => r.data),

  addSession: (id, minutes) =>
    http.post(`/tasks/${id}/sessions`, { minutes }).then((r) => r.data.task),
  removeSession: (id, sessionId) =>
    http.delete(`/tasks/${id}/sessions/${sessionId}`).then((r) => r.data.task),

  /**
   * No Content-Type header: the browser has to set it itself, because only it
   * knows the multipart boundary it just generated.
   *
   * Resolves to `{ attachments, failed, total, task }` — `failed` names what to
   * retry, so nine good screenshots are not lost to one rejected file.
   */
  upload: (id, files, onProgress) => {
    const form = new FormData();
    for (const file of files) form.append('files', file);
    return http
      .post(`/tasks/${id}/attachments`, form, {
        onUploadProgress: (event) =>
          onProgress?.(event.total ? Math.round((event.loaded / event.total) * 100) : 0),
      })
      .then((r) => r.data);
  },
  removeAttachment: (id, fileId) =>
    http.delete(`/tasks/${id}/attachments/${fileId}`).then((r) => r.data.task),
};

export const adminApi = {
  overview: () => http.get('/admin/overview').then((r) => r.data),
  audit: (params) => http.get('/admin/audit', { params }).then((r) => r.data),

  users: (params) => http.get('/admin/users', { params }).then((r) => r.data),
  user: (id) => http.get(`/admin/users/${id}`).then((r) => r.data),
  createUser: (body) => http.post('/admin/users', body).then((r) => r.data.user),
  updateUser: (id, body) => http.patch(`/admin/users/${id}`, body).then((r) => r.data.user),
  setRole: (id, role) => http.patch(`/admin/users/${id}/role`, { role }).then((r) => r.data.user),
  setPassword: (id, password) =>
    http.post(`/admin/users/${id}/password`, { password }).then((r) => r.data),
  revokeSessions: (id) => http.post(`/admin/users/${id}/revoke`).then((r) => r.data),
  removeUserAvatar: (id) => http.delete(`/admin/users/${id}/avatar`).then((r) => r.data.user),
  deleteUser: (id) => http.delete(`/admin/users/${id}`).then((r) => r.data),

  problems: (params) => http.get('/admin/problems', { params }).then((r) => r.data),
  problem: (id) => http.get(`/admin/problems/${id}`).then((r) => r.data),
  createProblem: (body) => http.post('/admin/problems', body).then((r) => r.data.problem),
  updateProblem: (id, body) =>
    http.patch(`/admin/problems/${id}`, body).then((r) => r.data.problem),
  deleteProblem: (id) => http.delete(`/admin/problems/${id}`).then((r) => r.data),

  patterns: () => http.get('/admin/patterns').then((r) => r.data.patterns),
  updatePattern: (slug, body) =>
    http.patch(`/admin/patterns/${slug}`, body).then((r) => r.data.pattern),

  motivation: (params) => http.get('/admin/motivation', { params }).then((r) => r.data),
  motivationPreview: () => http.get('/admin/motivation/preview').then((r) => r.data),
  createMotivation: (body) => http.post('/admin/motivation', body).then((r) => r.data.line),
  updateMotivation: (id, body) =>
    http.patch(`/admin/motivation/${id}`, body).then((r) => r.data.line),
  deleteMotivation: (id) => http.delete(`/admin/motivation/${id}`).then((r) => r.data),
  /** Candidates only — nothing is written until the admin picks. */
  draftMotivation: (body) => http.post('/admin/motivation/draft', body).then((r) => r.data.drafts),

  feedback: (params) => http.get('/admin/feedback', { params }).then((r) => r.data),
  /**
   * Status and the reply in one write. The panel edits both in one dialog and
   * saves once, and two endpoints would mean a half-applied change whenever the
   * second one failed.
   */
  updateFeedback: (id, body) =>
    http.patch(`/admin/feedback/${id}`, body).then((r) => r.data.submission),

  settings: () => http.get('/admin/settings').then((r) => r.data),
  updateSettings: (body) => http.patch('/admin/settings', body).then((r) => r.data),
  chatUsage: () => http.get('/admin/settings/chat-usage').then((r) => r.data.days),
  purgeChats: () => http.post('/admin/settings/chat-purge').then((r) => r.data),

  /** Both return the whole module list, so the panel never patches one row. */
  modules: () => http.get('/admin/modules').then((r) => r.data.modules),
  setModuleHidden: (key, hidden) =>
    http.patch('/admin/modules', { key, hidden }).then((r) => r.data.modules),

  guides: () => http.get('/admin/guides').then((r) => r.data.guides),
  guide: (slug) => http.get(`/admin/guides/${slug}`).then((r) => r.data),
  saveGuide: (slug, body) => http.put(`/admin/guides/${slug}`, body).then((r) => r.data.guide),
  unlockGuide: (slug) => http.post(`/admin/guides/${slug}/unlock`).then((r) => r.data.guide),
};
