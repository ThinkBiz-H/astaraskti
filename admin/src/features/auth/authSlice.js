import { createSlice } from '@reduxjs/toolkit';

const STORAGE_KEY = 'ass_admin_auth';
const loadPersisted = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
};
const persisted = loadPersisted();

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: persisted?.user || null,
    accessToken: persisted?.accessToken || null,
    isAuthenticated: Boolean(persisted?.accessToken),
  },
  reducers: {
    setCredentials: (state, action) => {
      state.user = action.payload.user ?? state.user;
      state.accessToken = action.payload.accessToken;
      state.isAuthenticated = Boolean(action.payload.accessToken);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: state.user, accessToken: state.accessToken }));
    },
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.isAuthenticated = false;
      localStorage.removeItem(STORAGE_KEY);
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
export const selectCurrentAdmin = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
