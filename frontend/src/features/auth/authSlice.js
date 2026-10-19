import { createSlice } from '@reduxjs/toolkit';

const STORAGE_KEY = 'ass_auth';

const loadPersisted = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const persisted = loadPersisted();

const initialState = {
  user: persisted?.user || null,
  accessToken: persisted?.accessToken || null,
  isAuthenticated: Boolean(persisted?.accessToken),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      state.user = action.payload.user ?? state.user;
      state.accessToken = action.payload.accessToken;
      state.isAuthenticated = Boolean(action.payload.accessToken);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: state.user, accessToken: state.accessToken }));
    },
    updateUser: (state, action) => {
      state.user = { ...state.user, ...action.payload };
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

export const { setCredentials, updateUser, logout } = authSlice.actions;
export default authSlice.reducer;

export const selectCurrentUser = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectIsAdmin = (state) => state.auth.user?.role === 'admin';
