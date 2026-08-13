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

export const progressApi = {
  patch: (problemId, body) => http.patch(`/progress/${problemId}`, body).then((r) => r.data.progress),
  attempt: (problemId, body) =>
    http.post(`/progress/${problemId}/attempt`, body).then((r) => r.data.progress),
  revision: () => http.get('/progress/revision').then((r) => r.data),
};

export const statsApi = {
  get: () => http.get('/stats').then((r) => r.data),
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
 * Notes — the personal write-ups, and the only module here with a public half.
 *
 * `shared` and `browse` hit routes mounted above the server's auth gate, so they
 * work with no session at all. That is what makes a link sent to someone without
 * an account open, and it is why they are named apart from the rest rather than
 * being `get`/`list` with a flag: two different audiences, two different
 * guarantees, and nothing that silently falls back from one to the other.
 */
export const notesApi = {
  list: (params) => http.get('/notes', { params }).then((r) => r.data),
  tags: () => http.get('/notes/tags').then((r) => r.data.tags),
  get: (id) => http.get(`/notes/${id}`).then((r) => r.data),
  create: (body) => http.post('/notes', body).then((r) => r.data.note),
  update: (id, body) => http.patch(`/notes/${id}`, body).then((r) => r.data.note),
  remove: (id) => http.delete(`/notes/${id}`).then((r) => r.data),
  restore: (id) => http.post(`/notes/${id}/restore`).then((r) => r.data.note),
  purge: (id) => http.delete(`/notes/${id}/permanent`).then((r) => r.data),

  /**
   * No Content-Type header: the browser has to set it itself, because only it
   * knows the multipart boundary it just generated.
   *
   * Returns `{ assets, failed, total }` rather than throwing on a bad file —
   * nine good screenshots should not be lost to one rejected PDF.
   */
  upload: (id, files, onProgress) => {
    const form = new FormData();
    for (const file of files) form.append('files', file);
    return http
      .post(`/notes/${id}/assets`, form, {
        onUploadProgress: (event) =>
          onProgress?.(event.total ? Math.round((event.loaded / event.total) * 100) : 0),
      })
      .then((r) => r.data);
  },
  removeAsset: (id, fileId) => http.delete(`/notes/${id}/assets/${fileId}`).then((r) => r.data),

  /** Public. The feed of notes people chose to publish. */
  browse: (params) => http.get('/notes/public', { params }).then((r) => r.data),
  /** Public. One note by the share id in its link. */
  shared: (publicId) => http.get(`/notes/public/${publicId}`).then((r) => r.data.note),
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
