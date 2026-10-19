import axios from 'axios';
import { store } from '@/app/store';
import { setCredentials, logout } from '@/features/auth/authSlice';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

// No default Content-Type header here: axios sets `application/json` for
// plain object payloads automatically, but a forced default would make it
// silently JSON-stringify FormData uploads (stripping the file) instead of
// sending proper multipart/form-data with the correct boundary.
export const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let queue = [];
const resolveQueue = (err, token = null) => {
  queue.forEach(({ resolve, reject }) => (err ? reject(err) : resolve(token)));
  queue = [];
};

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const isAuthCall = originalRequest?.url?.includes('/auth/');

    if (status === 401 && !originalRequest._retry && !isAuthCall) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => queue.push({ resolve, reject })).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh-token`, {}, { withCredentials: true });
        const newToken = data?.data?.accessToken;
        store.dispatch(setCredentials({ accessToken: newToken, user: store.getState().auth.user }));
        resolveQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        resolveQueue(refreshErr, null);
        store.dispatch(logout());
        window.location.href = '/login';
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

export const unwrap = (res) => res.data?.data;
export const getErrorMessage = (err) => err.response?.data?.message || err.message || 'Something went wrong.';

export default apiClient;
