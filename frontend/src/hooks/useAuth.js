import { useDispatch, useSelector } from 'react-redux';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/endpoints/auth';
import { setCredentials, logout as logoutAction, selectCurrentUser, selectIsAuthenticated, selectIsAdmin } from '@/features/auth/authSlice';
import toast from 'react-hot-toast';

export const useAuth = () => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const user = useSelector(selectCurrentUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isAdmin = useSelector(selectIsAdmin);

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      dispatch(setCredentials({ user: data.user, accessToken: data.accessToken }));
      toast.success('Welcome back!');
    },
  });

  const otpLoginRequestMutation = useMutation({ mutationFn: authApi.requestLoginOtp });

  const otpLoginVerifyMutation = useMutation({
    mutationFn: authApi.verifyLoginOtp,
    onSuccess: (data) => {
      dispatch(setCredentials({ user: data.user, accessToken: data.accessToken }));
      toast.success('Logged in successfully!');
    },
  });

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      dispatch(logoutAction());
      queryClient.clear();
      toast.success('Logged out');
    },
  });

  return {
    user,
    isAuthenticated,
    isAdmin,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    requestOtp: otpLoginRequestMutation.mutateAsync,
    isRequestingOtp: otpLoginRequestMutation.isPending,
    verifyOtp: otpLoginVerifyMutation.mutateAsync,
    isVerifyingOtp: otpLoginVerifyMutation.isPending,
    logout: logoutMutation.mutateAsync,
  };
};
