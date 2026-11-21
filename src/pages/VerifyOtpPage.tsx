import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, RefreshCw, Smartphone } from 'lucide-react';
import { authApi, extractApiError } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { PublicNavbar } from '../components/layout/PublicNavbar';

export default function VerifyOtpPage() {
  const navigate = useNavigate();
  const { user, setUser, pendingSandboxOtp, clearSandboxOtp, pushToast } = useAppStore();
  const [otp, setOtp] = useState('');
  const [sandboxPreview, setSandboxPreview] = useState<string | null>(pendingSandboxOtp);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleSendOtp = async () => {
    setError('');
    try {
      const { data } = await authApi.sendOtp();
      if (data.delivery.previewOtp) {
        setSandboxPreview(data.delivery.previewOtp);
      }
      setCooldown(30);
      pushToast('info', `OTP sent to ${data.delivery.maskedMobile}`);
    } catch (err) {
      setError(extractApiError(err, 'Could not send OTP.'));
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authApi.verifyOtp(otp.trim());
      setUser(data.user);
      clearSandboxOtp();
      pushToast('success', 'Mobile number verified! Gate access unlocked.');
      navigate('/dashboard');
    } catch (err) {
      setError(extractApiError(err, 'Invalid OTP code.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#07111E] text-slate-900 dark:text-slate-100">
      <PublicNavbar />
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6 sm:p-8">
          <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center text-teal-600 dark:text-teal-400 mb-4">
            <Smartphone className="w-5 h-5" />
          </div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A] dark:text-white">
            Verify Mobile Number
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Verify {user?.mobile ? `+91 ${user.mobile}` : 'your mobile number'} to enable biometric & QR gate access at STOVRA facilities.
          </p>

          {user?.mobileVerified && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Your mobile number is already verified.</span>
            </div>
          )}

          {sandboxPreview && (
            <div className="mt-4 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 p-3 text-xs text-teal-900 dark:text-teal-200">
              <strong>Sandbox SMS Preview:</strong> No external SMS API key configured. Your server-generated OTP is{' '}
              <span className="font-mono font-bold text-sm">{sandboxPreview}</span>
            </div>
          )}

          <form onSubmit={handleVerify} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">6-Digit OTP</label>
              <input
                type="text"
                maxLength={6}
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 6-digit code"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-center text-lg font-mono tracking-[0.35em]"
              />
            </div>

            {error && <p className="text-xs text-rose-600">{error}</p>}

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full rounded-lg bg-[#0B1F3A] dark:bg-teal-600 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify Mobile OTP'}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={cooldown > 0}
              className="inline-flex items-center gap-1.5 font-medium text-teal-700 dark:text-teal-400 disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{cooldown > 0 ? `Resend in ${cooldown}s` : 'Send / Resend OTP'}</span>
            </button>
            <Link to="/dashboard" className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
              Skip for now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
