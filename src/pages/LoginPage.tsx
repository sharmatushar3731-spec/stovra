import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Info } from 'lucide-react';
import { authApi, extractApiError } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { PublicNavbar } from '../components/layout/PublicNavbar';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuthSession, pushToast } = useAppStore();
  const [showPwd, setShowPwd] = useState(false);
  const [serverError, setServerError] = useState('');
  const [googleEnabled, setGoogleEnabled] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from || '/dashboard';

  useEffect(() => {
    authApi
      .providers()
      .then((res) => setGoogleEnabled(res.data.googleEnabled))
      .catch(() => setGoogleEnabled(false));
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    setServerError('');
    try {
      const { data } = await authApi.login(values);
      setAuthSession(data.user, data.accessToken);
      pushToast('success', `Welcome back, ${data.user.fullName}`);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setServerError(extractApiError(err, 'Sign in failed.'));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#07111E] text-slate-900 dark:text-slate-100">
      <PublicNavbar />
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6 sm:p-8">
          <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">Customer Portal</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-[#0B1F3A] dark:text-white">
            Sign in to STOVRA
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Access your bookings, QR gate passes, and inventory ledger.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                {...register('email')}
                placeholder="you@example.in"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm"
              />
              {errors.email && <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Password</label>
                <Link to="/forgot-password" className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  {...register('password')}
                  placeholder="Enter your password"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 pr-10 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  aria-label="Toggle password visibility"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-rose-600">{errors.password.message}</p>}
            </div>

            {serverError && (
              <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 p-3 text-xs text-rose-700 dark:text-rose-300">
                {serverError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-[#0B1F3A] dark:bg-teal-600 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60 transition-opacity"
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-800">
            {googleEnabled ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                Google Sign-In is enabled on this server via OAuth credential verification.
              </p>
            ) : (
              <div className="flex items-start gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3 text-xs text-slate-600 dark:text-slate-400">
                <Info className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <span>
                  Google Sign-In activates automatically when <code className="font-mono">GOOGLE_CLIENT_ID</code> is configured in server environment secrets.
                </span>
              </div>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            New to STOVRA?{' '}
            <Link to="/register" className="font-semibold text-teal-700 dark:text-teal-400 hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
