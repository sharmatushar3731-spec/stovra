import React, { useState } from 'react';
import { Moon, ShieldAlert, Sun } from 'lucide-react';
import { authApi, extractApiError } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { DashboardShell } from '../components/layout/DashboardShell';
import { PWAInstallButton } from '../components/common/PWAInstallButton';

export default function SettingsPage() {
  const { user, setUser, theme, setTheme, pushToast } = useAppStore();

  const [prefs, setPrefs] = useState(
    user?.notificationPrefs || {
      booking: true,
      payment: true,
      expiry: true,
      inventory: true,
      promotional: false,
    }
  );
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);

  const handleSavePrefs = async () => {
    setSavingPrefs(true);
    try {
      const { data } = await authApi.updateNotificationPrefs(prefs);
      setUser(data.user);
      pushToast('success', 'Notification preferences saved.');
    } catch (err) {
      pushToast('error', extractApiError(err));
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangingPwd(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      pushToast('success', 'Password changed successfully.');
    } catch (err) {
      pushToast('error', extractApiError(err, 'Password change failed.'));
    } finally {
      setChangingPwd(false);
    }
  };

  const handleDeleteRequest = async () => {
    try {
      const { data } = await authApi.requestDeletion();
      setUser(data.user);
      pushToast('info', 'Account deletion request logged.');
    } catch (err) {
      pushToast('error', extractApiError(err));
    }
  };

  return (
    <DashboardShell title="Settings" breadcrumb="STOVRA / Account / Settings">
      <div className="max-w-3xl space-y-6">
        {/* Appearance & PWA */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Appearance & App Installation</h2>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium ${
                  theme === 'light' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-400'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Light Mode</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium ${
                  theme === 'dark' ? 'bg-[#0D1B2E] text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Dark Mode</span>
              </button>
            </div>
            <PWAInstallButton variant="full" />
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Notification Preferences</h2>
          <div className="space-y-3 text-sm">
            {[
              { key: 'booking', label: 'Booking confirmations & modifications' },
              { key: 'payment', label: 'Payment receipts & refund updates' },
              { key: 'expiry', label: 'Storage expiry & extension reminders' },
              { key: 'inventory', label: 'QR scan & inventory movement alerts' },
              { key: 'promotional', label: 'Promo codes & seasonal storage offers' },
            ].map((item) => (
              <label key={item.key} className="flex items-center justify-between cursor-pointer py-1">
                <span className="text-slate-700 dark:text-slate-300">{item.label}</span>
                <input
                  type="checkbox"
                  checked={prefs[item.key as keyof typeof prefs]}
                  onChange={(e) => setPrefs((p) => ({ ...p, [item.key]: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-teal-600"
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={handleSavePrefs}
            disabled={savingPrefs}
            className="rounded-lg bg-[#0B1F3A] dark:bg-teal-600 px-4 py-2 text-xs font-semibold text-white"
          >
            {savingPrefs ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>

        {/* Password Change */}
        <form onSubmit={handleChangePassword} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Change Password</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm"
            />
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 8 chars)"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={changingPwd}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            {changingPwd ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        {/* Account Deletion */}
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-[#0D1B2E] p-6 space-y-3">
          <h2 className="text-base font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            <span>Account Deletion Request</span>
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Accounts with active or confirmed bookings cannot be deleted until all stored items are retrieved and bookings are settled.
          </p>
          {user?.deletionRequestedAt ? (
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              Deletion request submitted on {new Date(user.deletionRequestedAt).toLocaleDateString('en-IN')}.
            </p>
          ) : (
            <button
              type="button"
              onClick={handleDeleteRequest}
              className="rounded-lg border border-rose-300 dark:border-rose-800 px-4 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              Request Account Deletion
            </button>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
