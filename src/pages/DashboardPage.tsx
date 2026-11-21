import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Boxes, CalendarClock, CreditCard, PlusCircle, QrCode, ShieldAlert } from 'lucide-react';
import { dashboardApi, extractApiError } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import type { DashboardResponse } from '../types';
import { DashboardShell } from '../components/layout/DashboardShell';

export default function DashboardPage() {
  const user = useAppStore((s) => s.user);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    dashboardApi
      .get()
      .then((res) => setData(res.data))
      .catch((err) => setError(extractApiError(err, 'Failed to load dashboard metrics.')))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardShell title="Dashboard" breadcrumb="STOVRA / Overview">
      <div className="space-y-6">
        {/* Welcome & Quick Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6">
          <div>
            <p className="text-xs font-medium text-teal-700 dark:text-teal-400">Your Space. Your Control.</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-[#0B1F3A] dark:text-white">
              Welcome, {user?.fullName || 'Customer'}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {data
                ? `Managing ${data.stats.totalSqftBooked} sq.ft across ${data.stats.activeBookings} active storage unit(s).`
                : 'Loading your real-time storage summary...'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link
              to="/qr-scanner"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <QrCode className="w-4 h-4 text-teal-600" />
              <span>Scan QR</span>
            </Link>
            <Link
              to="/inventory/add"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Boxes className="w-4 h-4 text-teal-600" />
              <span>Log Item</span>
            </Link>
            <Link
              to="/storage"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1F3A] dark:bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:opacity-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Quick Book Unit</span>
            </Link>
          </div>
        </div>

        {/* Mobile Verification Banner */}
        {data && !data.stats.mobileVerified && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-5 py-3.5 text-sm text-amber-900 dark:text-amber-100">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Mobile OTP verification is pending. Verify your number to activate QR gate entry.</span>
            </div>
            <Link to="/verify-otp" className="text-xs font-semibold underline shrink-0">
              Verify Now
            </Link>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* 4-Column KPI Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-28 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] animate-pulse" />
            ))}
          </div>
        ) : data && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-5">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Bookings</p>
                <p className="mt-2 text-3xl font-bold font-mono tabular-nums text-[#0B1F3A] dark:text-white">
                  {data.stats.activeBookings}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  {data.stats.upcomingBookings} upcoming check-in(s)
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-5">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Stored Items Count</p>
                <p className="mt-2 text-3xl font-bold font-mono tabular-nums text-[#0B1F3A] dark:text-white">
                  {data.stats.storedItemsCount}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  Across {data.stats.uniqueItemEntries} QR entries
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-5">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Available Storage Credit</p>
                <p className="mt-2 text-3xl font-bold font-mono tabular-nums text-teal-700 dark:text-teal-400">
                  ₹{data.stats.availableStorageBalance.toLocaleString('en-IN')}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Referral code: <span className="font-mono">{user?.referralCode}</span>
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-5">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Declared Inventory Value</p>
                <p className="mt-2 text-3xl font-bold font-mono tabular-nums text-[#0B1F3A] dark:text-white">
                  ₹{data.stats.insuredEstimatedValue.toLocaleString('en-IN')}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  {data.stats.unreadNotifications} unread alert(s)
                </p>
              </div>
            </div>

            {/* Expiry Predictions */}
            {data.expiryPredictions.length > 0 && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200 mb-3">
                  <CalendarClock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Expiry Prediction & Renewal Reminders</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data.expiryPredictions.map((pred) => (
                    <Link
                      key={pred.bookingId}
                      to={`/bookings/${pred.bookingId}`}
                      className="flex items-center justify-between rounded-lg border border-amber-200 dark:border-amber-800/70 bg-white dark:bg-[#0D1B2E] p-3.5 hover:border-teal-500 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {pred.facilityName} · {pred.bookingCode}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Ends {pred.checkOutDate} · {pred.daysRemaining} day(s) remaining
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Extend
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Main 2-Column Content */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Recent Bookings */}
              <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">Recent Bookings</h3>
                  <Link to="/bookings" className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline">
                    View all
                  </Link>
                </div>
                {data.bookings.length === 0 ? (
                  <div className="py-10 text-center space-y-3">
                    <p className="text-sm text-slate-500 dark:text-slate-400">You have no storage bookings yet.</p>
                    <Link
                      to="/storage"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1F3A] dark:bg-teal-600 px-4 py-2 text-xs font-semibold text-white"
                    >
                      <span>Find a Storage Facility</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                          <th className="py-2.5 font-medium">Booking</th>
                          <th className="py-2.5 font-medium">Facility / Unit</th>
                          <th className="py-2.5 font-medium">Dates</th>
                          <th className="py-2.5 font-medium text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                        {data.bookings.map((bk) => (
                          <tr key={bk.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-3 pr-3">
                              <Link to={`/bookings/${bk.id}`} className="font-mono text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline">
                                {bk.bookingCode}
                              </Link>
                              <p className="text-[11px] text-slate-500 capitalize mt-0.5">{bk.bookingStatus} · {bk.paymentStatus.replace('_', ' ')}</p>
                            </td>
                            <td className="py-3 pr-3">
                              <p className="text-xs font-medium text-slate-900 dark:text-white">{bk.facilityName}</p>
                              <p className="text-[11px] text-slate-500">Unit {bk.unitCode} · {bk.areaSqft} sq.ft</p>
                            </td>
                            <td className="py-3 pr-3 font-mono tabular-nums text-xs text-slate-600 dark:text-slate-300">
                              {bk.checkInDate} → {bk.checkOutDate}
                            </td>
                            <td className="py-3 text-right font-mono tabular-nums text-xs font-semibold text-slate-900 dark:text-white">
                              ₹{bk.totalAmount.toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Recent Activities & Notifications */}
              <div className="lg:col-span-5 space-y-6">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">Recent Inventory Activity</h3>
                    <Link to="/inventory" className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline">
                      Inventory
                    </Link>
                  </div>
                  {data.recentActivities.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
                      No item check-in or QR scan events recorded yet.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {data.recentActivities.map((act) => (
                        <li key={act.id} className="flex items-start justify-between gap-3 text-xs border-b border-slate-100 dark:border-slate-800/70 pb-2.5 last:border-0 last:pb-0">
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">
                              {act.itemName} <span className="font-mono text-slate-500">({act.itemCode})</span>
                            </p>
                            <p className="text-slate-500 dark:text-slate-400 capitalize mt-0.5">
                              {act.action.replace('_', ' ')} · {act.locationNote}
                            </p>
                          </div>
                          <span className="font-mono text-[11px] text-slate-400 shrink-0">
                            {new Date(act.timestamp).toLocaleDateString('en-IN')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-teal-600" />
                      <span>Payment History</span>
                    </h3>
                    <Link to="/transactions" className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline">
                      Ledger
                    </Link>
                  </div>
                  {data.paymentHistory.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 py-2">
                      No transactions yet.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {data.paymentHistory.map((pay) => (
                        <li key={pay.id} className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800/70 pb-2.5 last:border-0 last:pb-0">
                          <div>
                            <p className="font-mono font-medium text-slate-900 dark:text-white">{pay.invoiceNumber}</p>
                            <p className="text-slate-500 uppercase mt-0.5">{pay.method} · {pay.status}</p>
                          </div>
                          <p className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                            ₹{pay.amount.toLocaleString('en-IN')}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* Notifications Feed */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Latest Notifications</h3>
                <Link to="/notifications" className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline">
                  All Notifications
                </Link>
              </div>
              {data.notifications.length === 0 ? (
                <p className="text-sm text-slate-500">You&apos;re all caught up.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.notifications.map((n) => (
                    <Link
                      key={n.id}
                      to={n.link || '/notifications'}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:border-teal-500 transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="capitalize font-medium text-teal-700 dark:text-teal-400">{n.type}</span>
                        <span>{new Date(n.createdAt).toLocaleDateString('en-IN')}</span>
                      </div>
                      <p className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-white">{n.title}</p>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{n.message}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
