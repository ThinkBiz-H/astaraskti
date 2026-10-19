import apiClient, { unwrap } from '@/api/axiosClient';

export const authApi = {
  login: (payload) => apiClient.post('/auth/login', payload).then(unwrap), // email+password (admin accounts use this flow)
  logout: () => apiClient.post('/auth/logout').then(unwrap),
  getMe: () => apiClient.get('/auth/me').then(unwrap),
};
