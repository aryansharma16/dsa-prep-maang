import { http } from './http.js';

export const authApi = {
  register: (body) => http.post('/auth/register', body).then((r) => r.data.user),
  login: (body) => http.post('/auth/login', body).then((r) => r.data.user),
  logout: () => http.post('/auth/logout').then((r) => r.data),
  me: () => http.get('/auth/me').then((r) => r.data.user),

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
