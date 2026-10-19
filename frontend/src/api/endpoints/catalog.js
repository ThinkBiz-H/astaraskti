import apiClient, { unwrap } from '@/api/axiosClient';

export const productsApi = {
  // GET /products?keyword=&category=&brand=&page=&limit=&sort=
  list: (params) => apiClient.get('/products', { params }).then(unwrap),
  getBySlug: (slug) => apiClient.get(`/products/${slug}`).then(unwrap),
  getById: (id) => apiClient.get(`/products/id/${id}`).then(unwrap),
  featured: () => apiClient.get('/products/featured/list').then(unwrap),
  newArrivals: () => apiClient.get('/products/new-arrivals/list').then(unwrap),
  trending: () => apiClient.get('/products/trending/list').then(unwrap),
  bestSellers: () => apiClient.get('/products/bestsellers/list').then(unwrap),
  topRated: () => apiClient.get('/products/top-rated/list').then(unwrap),
  related: (id) => apiClient.get(`/products/${id}/related`).then(unwrap),
  recentlyViewed: () => apiClient.get('/products/me/recently-viewed').then(unwrap),
  trackView: (id) => apiClient.post(`/products/${id}/view`).then(unwrap),
  variants: (productId) => apiClient.get(`/products/${productId}/variants`).then(unwrap),

  // Reviews
  getReviews: (productId, params) => apiClient.get(`/products/${productId}/reviews`, { params }).then(unwrap),
  getRatingDistribution: (productId) =>
    apiClient.get(`/products/${productId}/reviews/rating-distribution`).then(unwrap),
  addReview: (productId, payload) => apiClient.post(`/products/${productId}/reviews`, payload).then(unwrap),
  editReview: (productId, reviewId, payload) =>
    apiClient.put(`/products/${productId}/reviews/${reviewId}`, payload).then(unwrap),
  deleteReview: (productId, reviewId) =>
    apiClient.delete(`/products/${productId}/reviews/${reviewId}`).then(unwrap),
};

export const categoriesApi = {
  // GET /categories?tree=true|&parent=root
  list: (params) => apiClient.get('/categories', { params }).then(unwrap),
  getBySlug: (slug) => apiClient.get(`/categories/${slug}`).then(unwrap),
  getAttributeTemplate: (id) => apiClient.get(`/categories/${id}/attribute-template`).then(unwrap),
};

export const brandsApi = {
  list: () => apiClient.get('/brands').then(unwrap),
  getBySlug: (slug) => apiClient.get(`/brands/${slug}`).then(unwrap),
};

export const unitsApi = {
  list: () => apiClient.get('/units').then(unwrap),
};
