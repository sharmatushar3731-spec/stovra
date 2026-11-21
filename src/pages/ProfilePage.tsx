import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, CheckCircle2, Plus, ShieldAlert, Trash2, User as UserIcon } from 'lucide-react';
import { authApi, extractApiError } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import type { SavedAddress } from '../types';
import { DashboardShell } from '../components/layout/DashboardShell';

export default function ProfilePage() {
  const { user, setUser, pushToast } = useAppStore();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [mobile, setMobile] = useState(user?.mobile || '');
  const [address, setAddress] = useState(user?.address || '');
  const [pincode, setPincode] = useState(user?.pincode || '');
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>(user?.savedAddresses || []);
  const [emergencyName, setEmergencyName] = useState(user?.emergencyContact?.name || '');
  const [emergencyRelation, setEmergencyRelation] = useState(user?.emergencyContact?.relation || '');
  const [emergencyPhone, setEmergencyPhone] = useState(user?.emergencyContact?.phone || '');
  const [saving, setSaving] = useState(false);

  const [newAddrLabel, setNewAddrLabel] = useState('Home');
  const [newAddrLine, setNewAddrLine] = useState('');
  const [newAddrPin, setNewAddrPin] = useState('');

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const { data } = await authApi.uploadAvatar(reader.result as string);
        setUser(data.user);
        pushToast('success', 'Profile photo updated.');
      } catch (err) {
        pushToast('error', extractApiError(err, 'Avatar upload failed.'));
      }
    };
    reader.readAsDataURL(file);
  };

  const addSavedAddress = () => {
    if (newAddrLine.trim().length < 4 || !/^\d{6}$/.test(newAddrPin.trim())) {
      pushToast('error', 'Enter an address line and valid 6-digit PIN code.');
      return;
    }
    setSavedAddresses((prev) => [
      ...prev,
      { id: String(Date.now()), label: newAddrLabel || 'Other', line: newAddrLine.trim(), pincode: newAddrPin.trim() },
    ]);
    setNewAddrLine('');
    setNewAddrPin('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await authApi.updateProfile({
        fullName,
        mobile,
        address,
        pincode,
        savedAddresses,
        emergencyContact: {
          name: emergencyName,
          relation: emergencyRelation,
          phone: emergencyPhone,
        },
      });
      setUser(data.user);
      pushToast('success', 'Profile saved.');
    } catch (err) {
      pushToast('error', extractApiError(err, 'Could not update profile.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardShell title="My Profile" breadcrumb="STOVRA / Account / Profile">
      <div className="max-w-4xl space-y-6">
        {/* Header Card */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 flex items-center justify-center shrink-0">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-7 h-7 text-slate-400" />
              )}
              <label
                className="absolute inset-0 bg-slate-950/40 opacity-0 hover:opacity-100 flex items-center justify-center text-white cursor-pointer transition-opacity"
                title="Upload profile photo"
              >
                <Camera className="w-4 h-4" />
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarUpload} className="hidden" />
              </label>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{user?.fullName}</h2>
              <p className="text-xs text-slate-500">{user?.email}</p>
              <div className="mt-1 flex items-center gap-2 text-xs">
                {user?.mobileVerified ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mobile Verified
                  </span>
                ) : (
                  <Link to="/verify-otp" className="inline-flex items-center gap-1 text-amber-600 font-medium hover:underline">
                    <ShieldAlert className="w-3.5 h-3.5" /> Verify Mobile OTP
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <p className="text-xs text-slate-500">Referral Code</p>
            <p className="font-mono text-sm font-bold text-teal-700 dark:text-teal-400">{user?.referralCode}</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Primary Info */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Personal Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Mobile Number</label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Primary Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Flat, Street, Locality, City"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">PIN Code</label>
                <input
                  type="text"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                  placeholder="560038"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-mono"
                />
              </div>
            </div>
          </div>

          {/* Saved Addresses */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Saved Pickup & Delivery Addresses</h3>
            {savedAddresses.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {savedAddresses.map((addr) => (
                  <div key={addr.id} className="flex items-start justify-between rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{addr.label} · {addr.pincode}</p>
                      <p className="text-slate-500 mt-0.5">{addr.line}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSavedAddresses((prev) => prev.filter((a) => a.id !== addr.id))}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2">
              <input
                type="text"
                value={newAddrLabel}
                onChange={(e) => setNewAddrLabel(e.target.value)}
                placeholder="Label (Home/Office)"
                className="sm:col-span-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={newAddrLine}
                onChange={(e) => setNewAddrLine(e.target.value)}
                placeholder="Full street address"
                className="sm:col-span-5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
              />
              <input
                type="text"
                maxLength={6}
                value={newAddrPin}
                onChange={(e) => setNewAddrPin(e.target.value.replace(/\D/g, ''))}
                placeholder="6-digit PIN"
                className="sm:col-span-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono"
              />
              <button
                type="button"
                onClick={addSavedAddress}
                className="sm:col-span-2 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Authorized Emergency Contact</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <input
                type="text"
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
                placeholder="Contact Name"
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm"
              />
              <input
                type="text"
                value={emergencyRelation}
                onChange={(e) => setEmergencyRelation(e.target.value)}
                placeholder="Relationship (e.g., Spouse, Sibling)"
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm"
              />
              <input
                type="tel"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                placeholder="Emergency Phone"
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[#0B1F3A] dark:bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
          >
            {saving ? 'Saving Changes...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </DashboardShell>
  );
}
