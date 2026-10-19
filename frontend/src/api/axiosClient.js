import axios from 'axios';
import { store } from '@/app/store';
import { setCredentials, logout } from '@/features/auth/authSlice';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

// `withCredentials: true` is required so the backend's httpOnly `refreshToken`
// cookie (set by POST /auth/otp/verify, /auth/login, etc.) is sent/received.
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

// Transient-failure retry (network drop, gateway timeout, etc). Only GET
// requests are retried — POST/PUT/DELETE could double-submit an order,
// payment, or mutation if the server actually received the first attempt.
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 600;
const isRetryableError = (error) => !error.response || error.response.status >= 500;

let isRefreshing = false;
let pendingQueue = [];

const resolveQueue = (error, token = null) => {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  pendingQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    // Never try to refresh for the refresh-token call itself, or for auth
    // endpoints where a 401 legitimately means "wrong credentials/OTP".
    const isAuthCall = originalRequest?.url?.includes('/auth/');

    // A guest (no access token ever issued) hitting a protected endpoint in
    // the background isn't a "session expired" situation — there was no
    // session. Forcing a hard redirect to /login here is what caused guests
    // to get bounced off pages like Product Detail from an unrelated
    // background call (e.g. view tracking). Only previously-authenticated
    // users go through the refresh-then-redirect flow below.
    const hadToken = Boolean(store.getState().auth.accessToken);

    if (originalRequest?.method?.toLowerCase() === 'get' && isRetryableError(error)) {
      const retryCount = originalRequest._retryCount || 0;
      if (retryCount < MAX_RETRIES) {
        originalRequest._retryCount = retryCount + 1;
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * (retryCount + 1)));
        return apiClient(originalRequest);
      }
    }

    if (status === 401 && !originalRequest._retry && !isAuthCall && hadToken) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(
          `${BASE_URL}/auth/refresh-token`,
          {},
          { withCredentials: true },
        );
        const newToken = data?.data?.accessToken;
        store.dispatch(setCredentials({ accessToken: newToken, user: store.getState().auth.user }));
        resolveQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        resolveQueue(refreshError, null);
        store.dispatch(logout());
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// Every backend response is wrapped { success, message, data, error }.
// This helper unwraps `data` so endpoint modules can `return unwrap(res)`.
export const unwrap = (res) => res.data?.data;
export const getErrorMessage = (err) =>
  err.response?.data?.message || err.message || 'Something went wrong. Please try again.';

export default apiClient;
