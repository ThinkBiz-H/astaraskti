import apiClient, { unwrap } from '@/api/axiosClient';

export const productsApi = {
  list: (params) => apiClient.get('/products', { params }).then(unwrap),
  getById: (id) => apiClient.get(`/products/id/${id}`).then(unwrap),
  create: (formData) => apiClient.post('/products', formData).then(unwrap),
  update: (id, formData) => apiClient.put(`/products/${id}`, formData).then(unwrap),
  removeImage: (id, publicId) => apiClient.delete(`/products/${id}/images/${encodeURIComponent(publicId)}`).then(unwrap),
  remove: (id) => apiClient.delete(`/products/${id}`).then(unwrap), // soft delete
  restore: (id) => apiClient.patch(`/products/${id}/restore`).then(unwrap),

  variants: (productId) => apiClient.get(`/products/${productId}/variants`).then(unwrap),
  createVariant: (productId, formData) =>
    apiClient.post(`/products/${productId}/variants`, formData).then(unwrap),
  updateVariant: (productId, variantId, formData) =>
    apiClient.put(`/products/${productId}/variants/${variantId}`, formData).then(unwrap),
  deleteVariant: (productId, variantId) => apiClient.delete(`/products/${productId}/variants/${variantId}`).then(unwrap),

  deleteReview: (productId, reviewId) => apiClient.delete(`/products/${productId}/reviews/${reviewId}`).then(unwrap),
};

export const categoriesApi = {
  list: (params) => apiClient.get('/categories', { params }).then(unwrap),
  create: (formData) => apiClient.post('/categories', formData).then(unwrap),
  update: (id, formData) => apiClient.put(`/categories/${id}`, formData).then(unwrap),
  remove: (id) => apiClient.delete(`/categories/${id}`).then(unwrap),
  attributeTemplate: (id) => apiClient.get(`/categories/${id}/attribute-template`).then(unwrap),
};

export const brandsApi = {
  list: () => apiClient.get('/brands').then(unwrap),
  create: (formData) => apiClient.post('/brands', formData).then(unwrap),
  update: (id, formData) => apiClient.put(`/brands/${id}`, formData).then(unwrap),
  remove: (id) => apiClient.delete(`/brands/${id}`).then(unwrap),
};

export const unitsApi = {
  list: () => apiClient.get('/units').then(unwrap),
  create: (payload) => apiClient.post('/units', payload).then(unwrap),
  update: (id, payload) => apiClient.put(`/units/${id}`, payload).then(unwrap),
  remove: (id) => apiClient.delete(`/units/${id}`).then(unwrap),
};

export const inventoryApi = {
  purchase: (payload) => apiClient.post('/inventory/purchase', payload).then(unwrap),
  adjust: (payload) => apiClient.post('/inventory/adjust', payload).then(unwrap),
  transfer: (payload) => apiClient.post('/inventory/transfer', payload).then(unwrap),
  lowStock: (params) => apiClient.get('/inventory/low-stock', { params }).then(unwrap),
  summary: (params) => apiClient.get('/inventory/summary', { params }).then(unwrap),
  movements: (params) => apiClient.get('/inventory/movements', { params }).then(unwrap),
  stockByProduct: (productId) => apiClient.get(`/inventory/stock/${productId}`).then(unwrap),
};

export const warehousesApi = {
  list: () => apiClient.get('/warehouses').then(unwrap),
  create: (payload) => apiClient.post('/warehouses', payload).then(unwrap),
  update: (id, payload) => apiClient.put(`/warehouses/${id}`, payload).then(unwrap),
  remove: (id) => apiClient.delete(`/warehouses/${id}`).then(unwrap),
};
