import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { authApi } from '@/api/endpoints/auth';
import { setCredentials } from '@/features/auth/authSlice';
import { getErrorMessage } from '@/api/axiosClient';
import { X, ShieldCheck } from 'lucide-react';

const RESEND_SECONDS = 60;

// Verifies mobile ownership and logs the customer in (auto-registering on
// first use) — this is what turns a guest into an authenticated account
// mid-checkout, right before order creation. See backend's
// controllers/auth.controller.js -> requestOtp / mobileVerifyOtp.
export default function OtpModal({ mobile, extraPayload, onVerified, onClose }) {
  const dispatch = useDispatch();
  const [digits, setDigits] = useState(Array(6).fill(''));
  const [sending, setSending] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const inputRefs = useRef([]);

  const sendOtp = useCallback(async () => {
    setSending(true);
    try {
      await authApi.requestLoginOtp({ mobile });
      setResendIn(RESEND_SECONDS);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  }, [mobile]);

  useEffect(() => {
    sendOtp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  const handleDigitChange = (index, value) => {
    const clean = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    if (clean && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    setDigits(Array.from({ length: 6 }, (_, i) => pasted[i] || ''));
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleVerify = async () => {
    const otp = digits.join('');
    if (otp.length !== 6) return toast.error('Enter the 6-digit code');

    setVerifying(true);
    try {
      const data = await authApi.verifyLoginOtp({ mobile, otp, ...extraPayload });
      dispatch(setCredentials({ user: data.user, accessToken: data.accessToken }));
      onVerified(data.user);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg">Verify Mobile Number</h2>
          <button onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <p className="mb-5 text-sm text-night-900/60">
          OTP sent to <strong>{mobile}</strong>
        </p>

        <div className="mb-5 flex justify-between gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (inputRefs.current[i] = el)}
              value={d}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={i === 0 ? handlePaste : undefined}
              inputMode="numeric"
              maxLength={1}
              className="h-12 w-11 rounded-sm border border-night-900/20 text-center text-lg focus:border-gold-500 focus:outline-none"
            />
          ))}
        </div>

        <button onClick={handleVerify} disabled={verifying || sending} className="btn-primary w-full">
          {verifying ? 'Verifying…' : 'Verify OTP'}
        </button>

        <div className="mt-4 text-center text-sm">
          {resendIn > 0 ? (
            <span className="text-night-900/40">Resend OTP in {resendIn}s</span>
          ) : (
            <button onClick={sendOtp} disabled={sending} className="text-gold-600 underline">
              {sending ? 'Sending…' : 'Resend OTP'}
            </button>
          )}
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-night-900/40">
          <ShieldCheck size={13} /> Your number is used only to secure this order
        </p>
      </div>
    </div>
  );
}
