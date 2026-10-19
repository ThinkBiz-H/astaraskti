import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { getErrorMessage } from '@/api/axiosClient';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoggingIn, requestOtp, isRequestingOtp, verifyOtp, isVerifyingOtp } = useAuth();
  const [mode, setMode] = useState('password'); // 'password' | 'otp'
  const [otpStep, setOtpStep] = useState('request');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm();

  const redirectTo = location.state?.from?.pathname || '/account';

  const onPasswordLogin = async (vals) => {
    try {
      await login({ email: vals.email, password: vals.password });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const onRequestOtp = async () => {
    try {
      await requestOtp({ mobile });
      setOtpStep('verify');
      toast.success('OTP sent');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const onVerifyOtp = async () => {
    try {
      await verifyOtp({ mobile, otp });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl">Welcome Back</h1>
      <p className="mb-6 text-sm text-night-900/60">Log in to continue your journey.</p>

      <div className="mb-6 flex rounded-sm border border-night-900/15 text-sm">
        <button onClick={() => setMode('password')} className={`flex-1 py-2 ${mode === 'password' ? 'bg-maroon-700 text-ivory' : ''}`}>Email &amp; Password</button>
        <button onClick={() => setMode('otp')} className={`flex-1 py-2 ${mode === 'otp' ? 'bg-maroon-700 text-ivory' : ''}`}>Mobile OTP</button>
      </div>

      {mode === 'password' ? (
        <form onSubmit={handleSubmit(onPasswordLogin)} className="space-y-4">
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
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" {...register('rememberMe')} /> Remember Me
            </label>
            <Link to="/forgot-password" className="text-gold-600">Forgot Password?</Link>
          </div>
          <button type="submit" disabled={isLoggingIn} className="btn-primary w-full">{isLoggingIn ? 'Logging in...' : 'Log In'}</button>
        </form>
      ) : otpStep === 'request' ? (
        <div className="space-y-4">
          <div>
            <label className="label-field">Mobile Number</label>
            <input value={mobile} onChange={(e) => setMobile(e.target.value)} className="input-field" placeholder="10-digit mobile number" />
          </div>
          <button onClick={onRequestOtp} disabled={isRequestingOtp} className="btn-primary w-full">
            {isRequestingOtp ? 'Sending OTP...' : 'Send OTP'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-night-900/60">Enter the OTP sent to {mobile}</p>
          <input value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} className="input-field text-center tracking-[0.5em]" />
          <button onClick={onVerifyOtp} disabled={isVerifyingOtp} className="btn-primary w-full">
            {isVerifyingOtp ? 'Verifying...' : 'Verify & Log In'}
          </button>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-night-900/60">
        New here? <Link to="/register" className="text-gold-600">Create an account</Link>
      </p>
    </div>
  );
}
