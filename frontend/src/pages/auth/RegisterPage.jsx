import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { authApi } from '@/api/endpoints/auth';
import { getErrorMessage } from '@/api/axiosClient';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState('form'); // 'form' | 'otp'
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');

  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const password = watch('password');

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      setMobile(data.mobile);
      setStep('otp');
      toast.success('OTP sent to your mobile number');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const verifyMutation = useMutation({
    mutationFn: authApi.verifyRegistrationOtp,
    onSuccess: () => {
      toast.success('Registration complete! Please log in.');
      navigate('/login');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const resendMutation = useMutation({
    mutationFn: authApi.resendRegistrationOtp,
    onSuccess: () => toast.success('OTP resent'),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (step === 'otp') {
    return (
      <div>
        <h1 className="mb-1 font-display text-2xl">Verify Your Mobile</h1>
        <p className="mb-6 text-sm text-night-900/60">Enter the 6-digit code sent to {mobile}</p>
        <form onSubmit={(e) => { e.preventDefault(); verifyMutation.mutate({ mobile, otp }); }} className="space-y-4">
          <input
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            maxLength={6}
            placeholder="Enter OTP"
            className="input-field text-center text-lg tracking-[0.5em]"
          />
          <button type="submit" disabled={verifyMutation.isPending} className="btn-primary w-full">
            {verifyMutation.isPending ? 'Verifying...' : 'Verify & Continue'}
          </button>
          <button type="button" onClick={() => resendMutation.mutate({ mobile })} className="w-full text-center text-sm text-gold-600">
            Resend OTP
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl">Create Account</h1>
      <p className="mb-6 text-sm text-night-900/60">Join us to book consultations and shop sacred products.</p>
      <form onSubmit={handleSubmit((vals) => registerMutation.mutate(vals))} className="space-y-4">
        <div>
          <label className="label-field">Full Name</label>
          <input {...register('name', { required: 'Name is required' })} className="input-field" />
          {errors.name && <p className="field-error">{errors.name.message}</p>}
        </div>
        <div>
          <label className="label-field">Email</label>
          <input type="email" {...register('email', { required: 'Email is required' })} className="input-field" />
          {errors.email && <p className="field-error">{errors.email.message}</p>}
        </div>
        <div>
          <label className="label-field">Phone Number</label>
          <input {...register('mobile', { required: 'Mobile number is required', minLength: 10, maxLength: 15 })} className="input-field" />
          {errors.mobile && <p className="field-error">Valid mobile number is required</p>}
        </div>
        <div>
          <label className="label-field">Password</label>
          <input type="password" {...register('password', { required: 'Password is required', minLength: 8 })} className="input-field" />
          {errors.password && <p className="field-error">Password must be at least 8 characters, with a letter and a number</p>}
        </div>
        <div>
          <label className="label-field">Confirm Password</label>
          <input
            type="password"
            {...register('confirmPassword', { validate: (v) => v === password || 'Passwords do not match' })}
            className="input-field"
          />
          {errors.confirmPassword && <p className="field-error">{errors.confirmPassword.message}</p>}
        </div>
        <button type="submit" disabled={registerMutation.isPending} className="btn-primary w-full">
          {registerMutation.isPending ? 'Creating account...' : 'Create Account'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-night-900/60">
        Already have an account? <Link to="/login" className="text-gold-600">Log in</Link>
      </p>
    </div>
  );
}
