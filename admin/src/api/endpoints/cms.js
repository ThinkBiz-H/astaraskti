import apiClient, { unwrap } from '@/api/axiosClient';

export const adminUsersApi = {
  list: (params) => apiClient.get('/admin/users', { params }).then(unwrap),
  getById: (id) => apiClient.get(`/admin/users/${id}`).then(unwrap),
  updateStatus: (id, isActive) => apiClient.patch(`/admin/users/${id}/status`, { isActive }).then(unwrap),
  updatePermissions: (id, permissions) => apiClient.patch(`/admin/users/${id}/permissions`, { permissions }).then(unwrap),
  remove: (id) => apiClient.delete(`/admin/users/${id}`).then(unwrap),
  permissionCatalog: () => apiClient.get('/admin/permissions').then(unwrap),
  auditLogs: (params) => apiClient.get('/admin/audit-logs', { params }).then(unwrap),
};

export const pagesApi = {
  list: (params) => apiClient.get('/admin/pages', { params }).then(unwrap),
  getById: (id) => apiClient.get(`/admin/pages/${id}`).then(unwrap),
  create: (formData) => apiClient.post('/admin/pages', formData).then(unwrap),
  update: (id, formData) => apiClient.put(`/admin/pages/${id}`, formData).then(unwrap),
  setStatus: (id, status) => apiClient.patch(`/admin/pages/${id}/status`, { status }).then(unwrap),
  remove: (id) => apiClient.delete(`/admin/pages/${id}`).then(unwrap),
};

// Home Sections — this backend's equivalent of "Banners" (a flexible,
// admin-ordered homepage block system). There is no separate dedicated
// "Banner" model distinct from this.
export const homeSectionsApi = {
  list: () => apiClient.get('/admin/home-sections').then(unwrap),
  create: (formData) => apiClient.post('/admin/home-sections', formData).then(unwrap),
  update: (id, formData) => apiClient.put(`/admin/home-sections/${id}`, formData).then(unwrap),
  reorder: (order) => apiClient.patch('/admin/home-sections/reorder', { order }).then(unwrap),
  remove: (id) => apiClient.delete(`/admin/home-sections/${id}`).then(unwrap),
};

export const faqsApi = {
  list: () => apiClient.get('/admin/faqs').then(unwrap),
  create: (payload) => apiClient.post('/admin/faqs', payload).then(unwrap),
  update: (id, payload) => apiClient.put(`/admin/faqs/${id}`, payload).then(unwrap),
  reorder: (order) => apiClient.patch('/admin/faqs/reorder', { order }).then(unwrap),
  remove: (id) => apiClient.delete(`/admin/faqs/${id}`).then(unwrap),
};

export const blogAdminApi = {
  list: (params) => apiClient.get('/admin/blogs', { params }).then(unwrap),
  getById: (id) => apiClient.get(`/admin/blogs/${id}`).then(unwrap),
  create: (formData) => apiClient.post('/admin/blogs', formData).then(unwrap),
  update: (id, formData) => apiClient.put(`/admin/blogs/${id}`, formData).then(unwrap),
  setStatus: (id, status) => apiClient.patch(`/admin/blogs/${id}/status`, { status }).then(unwrap),
  remove: (id) => apiClient.delete(`/admin/blogs/${id}`).then(unwrap),
  categories: () => apiClient.get('/blogs/categories').then(unwrap),
  createCategory: (payload) => apiClient.post('/admin/blog-categories', payload).then(unwrap),
  updateCategory: (id, payload) => apiClient.put(`/admin/blog-categories/${id}`, payload).then(unwrap),
  removeCategory: (id) => apiClient.delete(`/admin/blog-categories/${id}`).then(unwrap),
};

export const mediaApi = {
  folders: () => apiClient.get('/admin/media/folders').then(unwrap),
  createFolder: (payload) => apiClient.post('/admin/media/folders', payload).then(unwrap),
  list: (params) => apiClient.get('/admin/media', { params }).then(unwrap),
  upload: (formData) => apiClient.post('/admin/media/upload', formData).then(unwrap),
  remove: (id) => apiClient.delete(`/admin/media/${id}`).then(unwrap),
};

export const settingsAdminApi = {
  get: () => apiClient.get('/admin/settings').then(unwrap),
  update: (payload) => apiClient.put('/admin/settings', payload).then(unwrap),
  updateLogo: (formData) => apiClient.put('/admin/settings/logo', formData).then(unwrap),
  updateFavicon: (formData) => apiClient.put('/admin/settings/favicon', formData).then(unwrap),
  environmentStatus: () => apiClient.get('/admin/settings/environment-status').then(unwrap),
};

export const announcementsApi = {
  list: () => apiClient.get('/announcements', { params: { all: 'true' } }).then(unwrap),
  create: (payload) => apiClient.post('/announcements', payload).then(unwrap),
  update: (id, payload) => apiClient.put(`/announcements/${id}`, payload).then(unwrap),
  toggleStatus: (id) => apiClient.patch(`/announcements/${id}/status`).then(unwrap),
  remove: (id) => apiClient.delete(`/announcements/${id}`).then(unwrap),
};

export const testimonialsApi = {
  list: () => apiClient.get('/testimonials', { params: { all: 'true' } }).then(unwrap),
  create: (formData) => apiClient.post('/testimonials', formData).then(unwrap),
  update: (id, formData) => apiClient.put(`/testimonials/${id}`, formData).then(unwrap),
  toggleStatus: (id) => apiClient.patch(`/testimonials/${id}/status`).then(unwrap),
  remove: (id) => apiClient.delete(`/testimonials/${id}`).then(unwrap),
};

export const instagramFeedApi = {
  list: () => apiClient.get('/instagram-feed', { params: { all: 'true' } }).then(unwrap),
  create: (formData) => apiClient.post('/instagram-feed', formData).then(unwrap),
  update: (id, formData) => apiClient.put(`/instagram-feed/${id}`, formData).then(unwrap),
  remove: (id) => apiClient.delete(`/instagram-feed/${id}`).then(unwrap),
};

export const notificationsAdminApi = {
  templates: (params) => apiClient.get('/admin/notification-templates', { params }).then(unwrap),
  createTemplate: (payload) => apiClient.post('/admin/notification-templates', payload).then(unwrap),
  updateTemplate: (id, payload) => apiClient.put(`/admin/notification-templates/${id}`, payload).then(unwrap),
  removeTemplate: (id) => apiClient.delete(`/admin/notification-templates/${id}`).then(unwrap),
  broadcast: (payload) => apiClient.post('/admin/notifications/broadcast', payload).then(unwrap),

  campaigns: () => apiClient.get('/admin/notification-campaigns').then(unwrap),
  createCampaign: (formData) => apiClient.post('/admin/notification-campaigns', formData).then(unwrap),
  cancelCampaign: (id) => apiClient.delete(`/admin/notification-campaigns/${id}`).then(unwrap),

  jobs: (params) => apiClient.get('/admin/notification-jobs', { params }).then(unwrap),
  retryJob: (id) => apiClient.post(`/admin/notification-jobs/${id}/retry`).then(unwrap),
};

// TODO(backend): No Contact Enquiry or Newsletter Subscriber models/endpoints
// exist in the current backend. The spec's Admin Panel asks for both
// ("Contact Enquiries: View/Delete/Reply" and "Newsletter: Subscribers /
// Export CSV") — until the backend adds e.g. GET/DELETE /admin/enquiries and
// GET /admin/newsletter-subscribers (+ CSV export), the corresponding admin
// pages in this app show a "not available yet" state rather than fake data.
