import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { authApi, extractApiError } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { PublicNavbar } from '../components/layout/PublicNavbar';

const schema = z.object({
  fullName: z.string().min(2, 'Enter your full name'),
  email: z.string().email('Enter a valid email address'),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  referralCode: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const { setAuthSession, pushToast } = useAppStore();
  const [showPwd, setShowPwd] = useState(false);
  const [serverError, setServerError] = useState('');

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
      const { data } = await authApi.register(values);
      setAuthSession(data.user, data.accessToken, data.otpDelivery.previewOtp || null);
      pushToast('success', 'Account created! Verify your mobile number via OTP.');
      navigate('/verify-otp');
    } catch (err) {
      setServerError(extractApiError(err, 'Registration failed.'));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#07111E] text-slate-900 dark:text-slate-100">
      <PublicNavbar />
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6 sm:p-8">
          <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">New Customer Account</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-[#0B1F3A] dark:text-white">
            Create your STOVRA account
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Receive ₹500 storage credit upon registration (₹750 with a valid referral code).
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                {...register('fullName')}
                placeholder="Aarav Sharma"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm"
              />
              {errors.fullName && <p className="mt-1 text-xs text-rose-600">{errors.fullName.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                {...register('email')}
                placeholder="aarav@example.in"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm"
              />
              {errors.email && <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Mobile Number (+91)</label>
              <input
                type="tel"
                maxLength={10}
                {...register('mobile')}
                placeholder="9876543210"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm font-mono"
              />
              {errors.mobile && <p className="mt-1 text-xs text-rose-600">{errors.mobile.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  {...register('password')}
                  placeholder="Minimum 8 characters"
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

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Referral Code (Optional)
              </label>
              <input
                type="text"
                {...register('referralCode')}
                placeholder="e.g., STV9A4B2C"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm font-mono uppercase"
              />
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
              {isSubmitting ? 'Creating account...' : 'Create Account & Send OTP'}
            </button>
          </form>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            <span>Passwords hashed with bcrypt · JWT session protection</span>
          </p>

          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            Already registered?{' '}
            <Link to="/login" className="font-semibold text-teal-700 dark:text-teal-400 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
