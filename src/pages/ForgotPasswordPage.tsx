import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { authApi, extractApiError } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { PublicNavbar } from '../components/layout/PublicNavbar';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const pushToast = useAppStore((s) => s.pushToast);

  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [sandboxCode, setSandboxCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authApi.forgotPassword(email);
      if (data.delivery?.previewResetCode) {
        setSandboxCode(data.delivery.previewResetCode);
      }
      setStep('reset');
      pushToast('info', 'Reset code issued. Check below or your inbox.');
    } catch (err) {
      setError(extractApiError(err, 'Could not issue reset code.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword({ email, token, newPassword });
      pushToast('success', 'Password reset complete. Sign in with your new password.');
      navigate('/login');
    } catch (err) {
      setError(extractApiError(err, 'Reset failed.'));
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
            <KeyRound className="w-5 h-5" />
          </div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A] dark:text-white">
            {step === 'request' ? 'Forgot your password?' : 'Set a new password'}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {step === 'request'
              ? 'Enter your registered email to receive a 6-digit password reset code.'
              : `Enter the 6-digit reset code issued for ${email}.`}
          </p>

          {sandboxCode && step === 'reset' && (
            <div className="mt-4 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 p-3 text-xs text-teal-900 dark:text-teal-200">
              <strong>Sandbox Delivery Preview:</strong> SMS/Email provider keys are not configured, so your verified reset code is{' '}
              <span className="font-mono font-bold text-sm">{sandboxCode}</span>
            </div>
          )}

          {step === 'request' ? (
            <form onSubmit={handleRequestCode} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Registered Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.in"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm"
                />
              </div>
              {error && <p className="text-xs text-rose-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#0B1F3A] dark:bg-teal-600 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
              >
                {loading ? 'Sending...' : 'Send Reset Code'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">6-Digit Reset Code</label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="123456"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm font-mono tracking-widest"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm"
                />
              </div>
              {error && <p className="text-xs text-rose-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-700 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{loading ? 'Updating...' : 'Reset Password'}</span>
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            <Link to="/login" className="font-semibold text-teal-700 dark:text-teal-400 hover:underline">
              Back to Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
