import { http } from './http.js';

export const authApi = {
  register: (body) => http.post('/auth/register', body).then((r) => r.data.user),
  login: (body) => http.post('/auth/login', body).then((r) => r.data.user),
  logout: () => http.post('/auth/logout').then((r) => r.data),
  me: () => http.get('/auth/me').then((r) => r.data.user),
  /** Your own name and profile fields. Returns the whole updated user. */
  updateMe: (body) => http.patch('/auth/me', body).then((r) => r.data.user),

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

  settings: () => http.get('/admin/settings').then((r) => r.data),
  updateSettings: (body) => http.patch('/admin/settings', body).then((r) => r.data),
  chatUsage: () => http.get('/admin/settings/chat-usage').then((r) => r.data.days),
  purgeChats: () => http.post('/admin/settings/chat-purge').then((r) => r.data),

  guides: () => http.get('/admin/guides').then((r) => r.data.guides),
  guide: (slug) => http.get(`/admin/guides/${slug}`).then((r) => r.data),
  saveGuide: (slug, body) => http.put(`/admin/guides/${slug}`, body).then((r) => r.data.guide),
  unlockGuide: (slug) => http.post(`/admin/guides/${slug}/unlock`).then((r) => r.data.guide),
};
