import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, List, PlusCircle } from 'lucide-react';
import { bookingsApi, extractApiError } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import type { Booking } from '../types';
import { DashboardShell } from '../components/layout/DashboardShell';

export default function MyBookingsPage() {
  const pushToast = useAppStore((s) => s.pushToast);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bookingsApi
      .list()
      .then((res) => setBookings(res.data.bookings))
      .catch((err) => pushToast('error', extractApiError(err, 'Failed to load bookings.')))
      .finally(() => setLoading(false));
  }, [pushToast]);

  const filtered = bookings.filter((b) => statusFilter === 'all' || b.bookingStatus === statusFilter);

  return (
    <DashboardShell title="My Bookings" breadcrumb="STOVRA / Bookings">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900">
            {['all', 'pending', 'confirmed', 'active', 'cancelled'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                  statusFilter === s
                    ? 'bg-white dark:bg-[#0D1B2E] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setView('list')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
                  view === 'list' ? 'bg-white dark:bg-[#0D1B2E] text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>List</span>
              </button>
              <button
                type="button"
                onClick={() => setView('calendar')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
                  view === 'calendar' ? 'bg-white dark:bg-[#0D1B2E] text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Timeline</span>
              </button>
            </div>
            <Link
              to="/book"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1F3A] dark:bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>New Booking</span>
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="h-64 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] animate-pulse" />
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-12 text-center space-y-3">
            <p className="text-base font-semibold text-slate-900 dark:text-white">No bookings found</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Discover a verified STOVRA storage facility and reserve your space in minutes.
            </p>
            <Link
              to="/storage"
              className="inline-block rounded-lg bg-[#0B1F3A] dark:bg-teal-600 px-4 py-2 text-xs font-semibold text-white"
            >
              Browse Facilities
            </Link>
          </div>
        ) : view === 'calendar' ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Booking Schedule & Check-Out Windows</h3>
            <div className="space-y-3">
              {filtered.map((bk) => (
                <Link
                  key={bk.id}
                  to={`/bookings/${bk.id}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:border-teal-500 transition-colors"
                >
                  <div>
                    <p className="font-mono text-xs text-teal-700 dark:text-teal-400 font-semibold">
                      {bk.checkInDate} → {bk.checkOutDate} ({bk.durationCount} {bk.durationType})
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {bk.facilityName} · Unit {bk.unitCode}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-xs font-mono text-slate-500">{bk.bookingCode}</p>
                    <p className="text-xs capitalize font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                      {bk.bookingStatus} · {bk.paymentStatus.replace('_', ' ')}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filtered.map((bk) => (
              <div
                key={bk.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-5 flex flex-col justify-between gap-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs font-semibold text-teal-700 dark:text-teal-400">{bk.bookingCode}</p>
                    <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">{bk.facilityName}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Unit {bk.unitCode} · {bk.unitSizeLabel} · {bk.facilityCity}
                    </p>
                  </div>
                  <span className="text-xs font-semibold capitalize text-slate-700 dark:text-slate-300">
                    {bk.bookingStatus}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs border-y border-slate-100 dark:border-slate-800 py-3">
                  <div>
                    <span className="text-slate-500">Check-In</span>
                    <p className="font-mono text-slate-900 dark:text-white mt-0.5">{bk.checkInDate}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Check-Out</span>
                    <p className="font-mono text-slate-900 dark:text-white mt-0.5">{bk.checkOutDate}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500">Paid / Total</span>
                    <p className="font-mono font-semibold text-slate-900 dark:text-white mt-0.5">
                      ₹{bk.paidAmount.toLocaleString('en-IN')} / ₹{bk.totalAmount.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500 capitalize">
                    Payment: {bk.paymentStatus.replace('_', ' ')}
                  </span>
                  <Link
                    to={`/bookings/${bk.id}`}
                    className="rounded-lg bg-[#0B1F3A] dark:bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white hover:opacity-95"
                  >
                    Manage & QR Pass
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
