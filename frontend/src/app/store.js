import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/authSlice';
import uiReducer from '@/features/ui/uiSlice';
import couponReducer from '@/features/coupon/couponSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    coupon: couponReducer,
  },
});
