import apiClient, { unwrap } from '@/api/axiosClient';

export const authApi = {
  // Email + password registration (backend sends OTP over SMS to verify, see
  // controllers/auth.controller.js -> register). POST /auth/register
  register: (payload) => apiClient.post('/auth/register', payload).then(unwrap),

  // POST /auth/verify-otp  body: { mobile, otp }
  verifyRegistrationOtp: (payload) => apiClient.post('/auth/verify-otp', payload).then(unwrap),

  // POST /auth/resend-otp  body: { mobile }
  resendRegistrationOtp: (payload) => apiClient.post('/auth/resend-otp', payload).then(unwrap),

  // POST /auth/login  body: { email, password }
  login: (payload) => apiClient.post('/auth/login', payload).then(unwrap),

  // POST /auth/logout
  logout: () => apiClient.post('/auth/logout').then(unwrap),

  // GET /auth/me
  getMe: () => apiClient.get('/auth/me').then(unwrap),

  // ---- Forgot password (OTP-based, mobile) ----
  // POST /auth/forgot-password/mobile  body: { mobile }
  forgotPasswordRequestOtp: (payload) => apiClient.post('/auth/forgot-password/mobile', payload).then(unwrap),
  // POST /auth/forgot-password/verify-otp  body: { mobile, otp }
  forgotPasswordVerifyOtp: (payload) => apiClient.post('/auth/forgot-password/verify-otp', payload).then(unwrap),
  // POST /auth/reset-password/mobile  body: { mobile, otp, password }
  resetPasswordMobile: (payload) => apiClient.post('/auth/reset-password/mobile', payload).then(unwrap),

  // POST /auth/change-password  body: { currentPassword, newPassword }
  changePassword: (payload) => apiClient.post('/auth/change-password', payload).then(unwrap),

  // ---- Mobile-OTP-only login (used as an alternative/"Quick Login" option,
  // and as the guest-checkout verification step — see CheckoutPage.jsx) ----
  // POST /auth/otp/request  body: { mobile }
  requestLoginOtp: (payload) => apiClient.post('/auth/otp/request', payload).then(unwrap),
  // POST /auth/otp/verify  body: { mobile, otp, name?, email?, address?, saveAddress? }
  // The optional fields are only used to fill in a brand new (or still-
  // incomplete) account during guest checkout — see backend's mobileVerifyOtp.
  verifyLoginOtp: (payload) => apiClient.post('/auth/otp/verify', payload).then(unwrap),

  // POST /auth/check-mobile  body: { mobile } -> { exists }
  // Returns ONLY a boolean, deliberately — never profile data before OTP
  // proves ownership of the number (see backend/controllers/auth.controller.js).
  checkMobile: (payload) => apiClient.post('/auth/check-mobile', payload).then(unwrap),

  // GET /auth/sessions
  getSessions: () => apiClient.get('/auth/sessions').then(unwrap),
  // DELETE /auth/sessions/:id
  revokeSession: (id) => apiClient.delete(`/auth/sessions/${id}`).then(unwrap),
  // POST /auth/logout-all
  logoutAllDevices: () => apiClient.post('/auth/logout-all').then(unwrap),
};
