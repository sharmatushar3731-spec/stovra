import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Download, Share2 } from 'lucide-react';
import { bookingsApi, extractApiError } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import type { Booking } from '../types';
import { DashboardShell } from '../components/layout/DashboardShell';
import { QRCodeDisplay } from '../components/common/QRCodeDisplay';
import { downloadBookingInvoiceHtml } from '../utils/invoicePdf';

export default function BookingConfirmationPage() {
  const { id } = useParams<{ id: string }>();
  const { user, pushToast } = useAppStore();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    bookingsApi
      .detail(id)
      .then((res) => setBooking(res.data.booking))
      .catch((err) => pushToast('error', extractApiError(err, 'Could not load booking confirmation.')))
      .finally(() => setLoading(false));
  }, [id, pushToast]);

  const handleShare = async () => {
    if (!booking) return;
    const text = `STOVRA Booking ${booking.bookingCode} at ${booking.facilityName} (Unit ${booking.unitCode}) · ${booking.checkInDate} to ${booking.checkOutDate}`;
    try {
      await navigator.clipboard.writeText(text);
      pushToast('success', 'Booking summary copied to clipboard.');
    } catch {
      pushToast('info', text);
    }
  };

  return (
    <DashboardShell title="Booking Confirmed" breadcrumb="STOVRA / Bookings / Confirmation">
      {loading ? (
        <div className="h-96 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] animate-pulse" />
      ) : !booking ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-10 text-center">
          <p className="text-base font-semibold">Booking not found.</p>
          <Link to="/bookings" className="mt-3 inline-block text-sm text-teal-600 hover:underline">Go to My Bookings</Link>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-mono text-teal-700 dark:text-teal-400 font-semibold">{booking.bookingCode}</p>
                <h2 className="font-display text-2xl font-bold text-[#0B1F3A] dark:text-white">
                  Storage Unit Reserved & Verified
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Present this QR gate pass at {booking.facilityName} to unlock Unit {booking.unitCode}.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="flex justify-center py-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <QRCodeDisplay value={booking.qrToken} label={booking.bookingCode} size={190} />
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs text-slate-500">Facility</span>
                <p className="font-semibold text-slate-900 dark:text-white">{booking.facilityName}</p>
                <p className="text-xs text-slate-500">{booking.facilityAddress}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <span className="text-xs text-slate-500">Unit</span>
                  <p className="font-mono font-semibold text-slate-900 dark:text-white">{booking.unitCode}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Size</span>
                  <p className="font-medium text-slate-900 dark:text-white">{booking.unitSizeLabel}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Check-In</span>
                  <p className="font-mono text-slate-900 dark:text-white">{booking.checkInDate}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Check-Out</span>
                  <p className="font-mono text-slate-900 dark:text-white">{booking.checkOutDate}</p>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between font-semibold">
                <span>Paid / Total</span>
                <span className="font-mono tabular-nums text-teal-700 dark:text-teal-400">
                  ₹{booking.paidAmount.toLocaleString('en-IN')} / ₹{booking.totalAmount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => downloadBookingInvoiceHtml(booking, user?.fullName || 'Customer', user?.email || '')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Download className="w-4 h-4" />
                <span>Download GST Invoice</span>
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Share2 className="w-4 h-4" />
                <span>Share Booking</span>
              </button>
            </div>

            <div className="flex gap-2.5">
              <Link
                to="/inventory/add"
                className="rounded-lg border border-teal-600 px-4 py-2 text-xs font-semibold text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/30"
              >
                Add Stored Items
              </Link>
              <Link
                to={`/bookings/${booking.id}`}
                className="rounded-lg bg-[#0B1F3A] dark:bg-teal-600 px-4 py-2 text-xs font-semibold text-white"
              >
                Manage Booking
              </Link>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
