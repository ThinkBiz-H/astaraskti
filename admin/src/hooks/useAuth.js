import { useDispatch, useSelector } from 'react-redux';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/endpoints/auth';
import { setCredentials, logout as logoutAction, selectCurrentAdmin, selectIsAuthenticated } from '@/features/auth/authSlice';
import toast from 'react-hot-toast';

export const useAuth = () => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const user = useSelector(selectCurrentAdmin);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const loginMutation = useMutation({
    mutationFn: async (payload) => {
      const data = await authApi.login(payload);
      if (data.user?.role !== 'admin') {
        throw new Error('This account does not have admin access.');
      }
      return data;
    },
    onSuccess: (data) => {
      dispatch(setCredentials({ user: data.user, accessToken: data.accessToken }));
      toast.success('Welcome back!');
    },
  });

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      dispatch(logoutAction());
      queryClient.clear();
    },
  });

  return {
    user,
    isAuthenticated,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    logout: logoutMutation.mutateAsync,
  };
};
