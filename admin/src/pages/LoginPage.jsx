import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { getErrorMessage } from '@/api/axiosClient';
import { Moon } from 'lucide-react';

export default function LoginPage() {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const { login, isLoggingIn } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (vals) => {
    try {
      await login(vals);
      navigate('/');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-night-950 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-center justify-center gap-2 font-display text-xl">
          <Moon className="text-gold-500" /> Admin Panel
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label-field">Email</label>
            <input type="email" {...register('email', { required: true })} className="input-field" />
            {errors.email && <p className="field-error">Email is required</p>}
          </div>
          <div>
            <label className="label-field">Password</label>
            <input type="password" {...register('password', { required: true })} className="input-field" />
            {errors.password && <p className="field-error">Password is required</p>}
          </div>
          <button type="submit" disabled={isLoggingIn} className="btn-primary w-full">
            {isLoggingIn ? 'Logging in...' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
}
