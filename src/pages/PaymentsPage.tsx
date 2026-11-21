import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, ShieldCheck, Tag } from 'lucide-react';
import { bookingsApi, extractApiError, paymentsApi } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import type { Booking } from '../types';
import { DashboardShell } from '../components/layout/DashboardShell';
import { RazorpayCheckoutModal } from '../components/common/RazorpayCheckoutModal';

export default function PaymentsPage() {
  const { user, pushToast } = useAppStore();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [gatewayMode, setGatewayMode] = useState('razorpay_test_sandbox');
  const [loading, setLoading] = useState(true);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [bkRes, cfgRes] = await Promise.all([bookingsApi.list(), paymentsApi.config()]);
      setBookings(bkRes.data.bookings);
      setGatewayMode(cfgRes.data.mode);
    } catch (err) {
      pushToast('error', extractApiError(err, 'Failed to load payment dues.'));
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const dueBookings = bookings.filter(
    (b) => b.bookingStatus !== 'cancelled' && b.totalAmount - b.paidAmount > 0
  );

  return (
    <DashboardShell title="Payments & Credits" breadcrumb="STOVRA / Billing / Payments">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-5">
            <p className="text-xs text-slate-500">Outstanding Dues</p>
            <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#0B1F3A] dark:text-white">
              ₹{dueBookings.reduce((sum, b) => sum + (b.totalAmount - b.paidAmount), 0).toLocaleString('en-IN')}
            </p>
            <p className="mt-1 text-xs text-slate-500">{dueBookings.length} booking(s) awaiting payment</p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-5">
            <p className="text-xs text-slate-500">STOVRA Credit Balance</p>
            <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-teal-700 dark:text-teal-400">
              ₹{(user?.walletBalance || 0).toLocaleString('en-IN')}
            </p>
            <p className="mt-1 text-xs text-slate-500">Referral Code: <span className="font-mono">{user?.referralCode}</span></p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-5">
            <p className="text-xs text-slate-500">Payment Gateway</p>
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <span>{gatewayMode === 'razorpay_configured' ? 'Razorpay Live/Test Keys Active' : 'Razorpay Test Sandbox Mode'}</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">UPI · Cards · NetBanking · Wallets</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Pending & Partial Payments</h2>
            <Link to="/transactions" className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline">
              View Transaction History
            </Link>
          </div>

          {loading ? (
            <div className="h-36 rounded-xl bg-slate-100 dark:bg-slate-900 animate-pulse" />
          ) : dueBookings.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">No pending payments due</p>
              <p className="text-xs text-slate-500">All your active reservations are settled.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {dueBookings.map((b) => {
                const due = b.totalAmount - b.paidAmount;
                return (
                  <div key={b.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs font-semibold text-teal-700 dark:text-teal-400">{b.bookingCode}</p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                        {b.facilityName} · Unit {b.unitCode}
                      </p>
                      <p className="text-xs text-slate-500">
                        Paid ₹{b.paidAmount.toLocaleString('en-IN')} of ₹{b.totalAmount.toLocaleString('en-IN')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveBooking(b)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0B1F3A] dark:bg-teal-600 px-4 py-2 text-xs font-semibold text-white"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Pay ₹{due.toLocaleString('en-IN')}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <Tag className="w-4 h-4 text-teal-600" />
            <span>Active STOVRA Promo Codes</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {[
              { code: 'STOVRA15', desc: '15% off up to ₹1,500 on bookings above ₹1,500' },
              { code: 'FIRST20', desc: '20% off up to ₹2,000 for bookings above ₹2,000' },
              { code: 'MONSOON10', desc: '10% off up to ₹1,000 on storage units' },
            ].map((p) => (
              <div key={p.code} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                <p className="font-mono text-sm font-bold text-teal-700 dark:text-teal-400">{p.code}</p>
                <p className="mt-1 text-slate-600 dark:text-slate-400">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {activeBooking && (
        <RazorpayCheckoutModal
          isOpen={true}
          onClose={() => setActiveBooking(null)}
          bookingId={activeBooking.id}
          bookingCode={activeBooking.bookingCode}
          remainingAmount={activeBooking.totalAmount - activeBooking.paidAmount}
          allowAdvance={activeBooking.paidAmount === 0}
          onPaymentSuccess={() => {
            setActiveBooking(null);
            pushToast('success', 'Payment verified and recorded.');
            loadData();
          }}
        />
      )}
    </DashboardShell>
  );
}
