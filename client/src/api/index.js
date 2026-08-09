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
 * The admin panel.
 *
 * Guides are read through `adminApi.guide`, not `problemsApi.guide`: the public
 * one goes through the module cache in useGuide, and the editor must never open
 * a stale copy or write an admin-shaped payload into it.
 */
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

  guides: () => http.get('/admin/guides').then((r) => r.data.guides),
  guide: (slug) => http.get(`/admin/guides/${slug}`).then((r) => r.data),
  saveGuide: (slug, body) => http.put(`/admin/guides/${slug}`, body).then((r) => r.data.guide),
  unlockGuide: (slug) => http.post(`/admin/guides/${slug}/unlock`).then((r) => r.data.guide),
};
