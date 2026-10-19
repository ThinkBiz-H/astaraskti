import apiClient, { unwrap } from "@/api/axiosClient";

export const userApi = {
  getProfile: () => apiClient.get("/users/profile").then(unwrap),
  updateProfile: (payload) =>
    apiClient.put("/users/profile", payload).then(unwrap),
  uploadProfileImage: (formData) =>
    apiClient.post("/users/profile/image", formData).then(unwrap),
  deleteAccount: () => apiClient.delete("/users/account").then(unwrap),

  getAddresses: () => apiClient.get("/users/address").then(unwrap),
  addAddress: (payload) =>
    apiClient.post("/users/address", payload).then(unwrap),
  updateAddress: (id, payload) =>
    apiClient.put(`/users/address/${id}`, payload).then(unwrap),
  deleteAddress: (id) => apiClient.delete(`/users/address/${id}`).then(unwrap),
};

export const notificationsApi = {
  list: (params) => apiClient.get("/notifications", { params }).then(unwrap),
  markRead: (id) => apiClient.patch(`/notifications/${id}/read`).then(unwrap),
  markAllRead: () => apiClient.patch("/notifications/read-all").then(unwrap),
  remove: (id) => apiClient.delete(`/notifications/${id}`).then(unwrap),
  clearAll: () => apiClient.delete("/notifications").then(unwrap),
  registerPushToken: (token) =>
    apiClient.post("/notifications/push-token", { token }).then(unwrap),
};

export const announcementsApi = {
  list: () => apiClient.get("/announcements").then(unwrap),
};

export const cmsApi = {
  getPages: () => apiClient.get("/pages").then(unwrap),
  getPageBySlug: (slug) => apiClient.get(`/pages/${slug}`).then(unwrap),
  getHomeSections: () => apiClient.get("/home-sections").then(unwrap),
  getFaqs: (params) => apiClient.get("/faqs", { params }).then(unwrap),
  getSettings: () => apiClient.get("/settings").then(unwrap),
};

export const testimonialsApi = {
  list: () => apiClient.get("/testimonials").then(unwrap),
};

export const instagramFeedApi = {
  list: () => apiClient.get("/instagram-feed").then(unwrap),
};

export const blogApi = {
  list: (params) => apiClient.get("/blogs", { params }).then(unwrap),
  getBySlug: (slug) => apiClient.get(`/blogs/${slug}`).then(unwrap),
  categories: () => apiClient.get("/blogs/categories").then(unwrap),
};

export const contactApi = {
  submitEnquiry: (payload) => apiClient.post("/contact", payload).then(unwrap), // { name, email, mobile, subject, message }
};

export const newsletterApi = {
  subscribe: (payload) =>
    apiClient.post("/newsletter/subscribe", payload).then(unwrap), // { email, name? }
  unsubscribe: (token) =>
    apiClient.post(`/newsletter/unsubscribe/${token}`).then(unwrap),
};
