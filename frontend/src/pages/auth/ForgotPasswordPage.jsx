import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { authApi } from '@/api/endpoints/auth';
import { getErrorMessage } from '@/api/axiosClient';
import { CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState('mobile'); // mobile -> otp -> password -> success
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const requestOtpMutation = useMutation({
    mutationFn: authApi.forgotPasswordRequestOtp,
    onSuccess: () => setStep('otp'),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const verifyOtpMutation = useMutation({
    mutationFn: authApi.forgotPasswordVerifyOtp,
    onSuccess: () => setStep('password'),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const resetMutation = useMutation({
    mutationFn: authApi.resetPasswordMobile,
    onSuccess: () => setStep('success'),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (step === 'success') {
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto mb-4 text-gold-500" size={48} />
        <h1 className="mb-2 font-display text-2xl">Password Reset!</h1>
        <p className="mb-6 text-sm text-night-900/60">You can now log in with your new password.</p>
        <button onClick={() => navigate('/login')} className="btn-primary w-full">Go to Login</button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl">Reset Password</h1>
      <p className="mb-6 text-sm text-night-900/60">
        {step === 'mobile' && 'Enter your mobile number to receive a reset code.'}
        {step === 'otp' && `Enter the OTP sent to ${mobile}.`}
        {step === 'password' && 'Choose a new password.'}
      </p>

      {step === 'mobile' && (
        <div className="space-y-4">
          <input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="Mobile Number" className="input-field" />
          <button onClick={() => requestOtpMutation.mutate({ mobile })} disabled={requestOtpMutation.isPending} className="btn-primary w-full">
            {requestOtpMutation.isPending ? 'Sending...' : 'Send OTP'}
          </button>
        </div>
      )}

      {step === 'otp' && (
        <div className="space-y-4">
          <input value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} placeholder="OTP" className="input-field text-center tracking-[0.5em]" />
          <button onClick={() => verifyOtpMutation.mutate({ mobile, otp })} disabled={verifyOtpMutation.isPending} className="btn-primary w-full">
            {verifyOtpMutation.isPending ? 'Verifying...' : 'Verify OTP'}
          </button>
        </div>
      )}

      {step === 'password' && (
        <div className="space-y-4">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New Password" className="input-field" />
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm New Password" className="input-field" />
          {password && confirmPassword && password !== confirmPassword && <p className="field-error">Passwords do not match</p>}
          <button
            onClick={() => resetMutation.mutate({ mobile, otp, password })}
            disabled={resetMutation.isPending || !password || password !== confirmPassword}
            className="btn-primary w-full"
          >
            {resetMutation.isPending ? 'Resetting...' : 'Reset Password'}
          </button>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-night-900/60">
        Remembered it? <Link to="/login" className="text-gold-600">Back to Login</Link>
      </p>
    </div>
  );
}
