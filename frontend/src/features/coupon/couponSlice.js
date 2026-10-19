import { createSlice } from '@reduxjs/toolkit';

const STORAGE_KEY = 'ass_coupon';

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
  code: persisted?.code || null,
  discountAmount: persisted?.discountAmount || 0,
};

const couponSlice = createSlice({
  name: 'coupon',
  initialState,
  reducers: {
    setCoupon: (state, action) => {
      state.code = action.payload.code;
      state.discountAmount = action.payload.discountAmount || 0;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ code: state.code, discountAmount: state.discountAmount }));
    },
    clearCoupon: (state) => {
      state.code = null;
      state.discountAmount = 0;
      localStorage.removeItem(STORAGE_KEY);
    },
  },
});

export const { setCoupon, clearCoupon } = couponSlice.actions;
export default couponSlice.reducer;

export const selectAppliedCoupon = (state) => state.coupon;
