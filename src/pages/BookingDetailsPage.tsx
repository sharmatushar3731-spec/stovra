import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarPlus, CreditCard, Download, Edit3, XCircle } from 'lucide-react';
import { bookingsApi, extractApiError } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import type { Booking, InventoryItem, PaymentTransaction } from '../types';
import { DashboardShell } from '../components/layout/DashboardShell';
import { QRCodeDisplay } from '../components/common/QRCodeDisplay';
import { RazorpayCheckoutModal } from '../components/common/RazorpayCheckoutModal';
import { downloadBookingInvoiceHtml } from '../utils/invoicePdf';

export default function BookingDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { user, pushToast } = useAppStore();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [linkedItems, setLinkedItems] = useState<Partial<InventoryItem>[]>([]);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [showPayModal, setShowPayModal] = useState(false);
  const [extendCount, setExtendCount] = useState(1);
  const [extending, setExtending] = useState(false);
  const [modifying, setModifying] = useState(false);
  const [editCheckIn, setEditCheckIn] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data } = await bookingsApi.detail(id);
      setBooking(data.booking);
      setLinkedItems(data.linkedItems);
      setPayments(data.payments);
      setEditCheckIn(data.booking.checkInDate);
      setEditSummary(data.booking.inventorySummary);
    } catch (err) {
      pushToast('error', extractApiError(err, 'Could not load booking details.'));
    } finally {
      setLoading(false);
    }
  }, [id, pushToast]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleExtend = async () => {
    if (!booking) return;
    setExtending(true);
    try {
      const { data } = await bookingsApi.extend(booking.id, extendCount);
      setBooking(data.booking);
      pushToast('success', `Extended through ${data.booking.checkOutDate}.`);
    } catch (err) {
      pushToast('error', extractApiError(err));
    } finally {
      setExtending(false);
    }
  };

  const handleModify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking) return;
    setModifying(true);
    try {
      const { data } = await bookingsApi.modify(booking.id, {
        checkInDate: editCheckIn,
        inventorySummary: editSummary,
      });
      setBooking(data.booking);
      pushToast('success', 'Booking details updated.');
    } catch (err) {
      pushToast('error', extractApiError(err));
    } finally {
      setModifying(false);
    }
  };

  const handleCancel = async () => {
    if (!booking) return;
    try {
      const { data } = await bookingsApi.cancel(booking.id, cancelReason || 'Cancelled by customer');
      setBooking(data.booking);
      setShowCancelConfirm(false);
      pushToast('info', 'Booking cancelled and unit released.');
    } catch (err) {
      pushToast('error', extractApiError(err));
    }
  };

  const remainingDue = booking ? Math.max(0, booking.totalAmount - booking.paidAmount) : 0;
  const isEditable = booking && !['cancelled', 'completed'].includes(booking.bookingStatus);

  return (
    <DashboardShell title={booking?.bookingCode || 'Booking Details'} breadcrumb="STOVRA / My Bookings / Details">
      {loading ? (
        <div className="h-96 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] animate-pulse" />
      ) : !booking ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-10 text-center">
          <p className="text-base font-semibold">Booking not found.</p>
          <Link to="/bookings" className="mt-3 inline-block text-sm text-teal-600 hover:underline">Back to My Bookings</Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link to="/bookings" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-teal-600">
              <ArrowLeft className="w-4 h-4" />
              <span>All Bookings</span>
            </Link>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => downloadBookingInvoiceHtml(booking, user?.fullName || 'Customer', user?.email || '')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Download className="w-4 h-4" />
                <span>Download Invoice</span>
              </button>
              {remainingDue > 0 && isEditable && (
                <button
                  type="button"
                  onClick={() => setShowPayModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 px-4 py-2 text-xs font-semibold text-white"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Pay Balance ₹{remainingDue.toLocaleString('en-IN')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Overview + QR */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <p className="font-mono text-xs font-semibold text-teal-700 dark:text-teal-400">
                    {booking.bookingCode} · {booking.bookingStatus.toUpperCase()}
                  </p>
                  <h2 className="mt-1 font-display text-xl font-bold text-[#0B1F3A] dark:text-white">
                    {booking.facilityName}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">{booking.facilityAddress}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500">Total Amount</span>
                  <p className="text-xl font-bold font-mono tabular-nums text-[#0B1F3A] dark:text-white">
                    ₹{booking.totalAmount.toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs font-mono text-slate-500">
                    Paid ₹{booking.paidAmount.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-500">Unit</span>
                  <p className="font-mono font-semibold text-slate-900 dark:text-white mt-0.5">{booking.unitCode}</p>
                </div>
                <div>
                  <span className="text-slate-500">Dimensions</span>
                  <p className="font-mono text-slate-900 dark:text-white mt-0.5">{booking.unitDimensions}</p>
                </div>
                <div>
                  <span className="text-slate-500">Check-In</span>
                  <p className="font-mono text-slate-900 dark:text-white mt-0.5">{booking.checkInDate}</p>
                </div>
                <div>
                  <span className="text-slate-500">Check-Out</span>
                  <p className="font-mono text-slate-900 dark:text-white mt-0.5">{booking.checkOutDate}</p>
                </div>
              </div>

              {isEditable && (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="flex items-end gap-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                          Extend Duration ({booking.durationType})
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={24}
                          value={extendCount}
                          onChange={(e) => setExtendCount(Math.max(1, Number(e.target.value)))}
                          className="w-24 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-mono"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleExtend}
                        disabled={extending}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1F3A] dark:bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white"
                      >
                        <CalendarPlus className="w-4 h-4" />
                        <span>{extending ? 'Extending...' : 'Extend'}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowCancelConfirm(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 dark:border-rose-800 px-3.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Cancel Booking</span>
                    </button>
                  </div>

                  {showCancelConfirm && (
                    <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-4 space-y-3">
                      <p className="text-xs font-semibold text-rose-800 dark:text-rose-200">
                        Confirm booking cancellation? Paid amounts will be marked for refund automatically.
                      </p>
                      <input
                        type="text"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Optional cancellation reason"
                        className="w-full rounded-lg border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleCancel}
                          className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white"
                        >
                          Confirm Cancellation
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCancelConfirm(false)}
                          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-1.5 text-xs font-medium"
                        >
                          Keep Booking
                        </button>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleModify} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-3">
                    <p className="text-xs font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Modify Check-In Date or Inventory Manifest</span>
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="date"
                        value={editCheckIn}
                        onChange={(e) => setEditCheckIn(e.target.value)}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D1B2E] px-3 py-2 text-xs font-mono"
                      />
                      <input
                        type="text"
                        value={editSummary}
                        onChange={(e) => setEditSummary(e.target.value)}
                        placeholder="Inventory notes"
                        className="sm:col-span-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D1B2E] px-3 py-2 text-xs"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={modifying}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D1B2E] px-3.5 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {modifying ? 'Saving...' : 'Save Changes'}
                    </button>
                  </form>
                </div>
              )}
            </div>

            <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6 flex flex-col items-center justify-center text-center">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Unit Gate QR Pass</h3>
              <QRCodeDisplay value={booking.qrToken} label={booking.bookingCode} size={175} />
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Scan at the facility turnstile or inside the STOVRA QR Scanner to check in.
              </p>
            </div>
          </div>

          {/* Linked Inventory & Payments */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Stored Inventory Items ({linkedItems.length})</h3>
                <Link to={`/inventory/add?bookingId=${booking.id}`} className="text-xs font-semibold text-teal-600 hover:underline">
                  + Log Item
                </Link>
              </div>
              {linkedItems.length === 0 ? (
                <p className="text-sm text-slate-500">No individual items tagged to this unit yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {linkedItems.map((it) => (
                    <li key={it.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{it.name}</p>
                        <p className="text-slate-500">{it.category} · Qty {it.quantity}</p>
                      </div>
                      <span className="font-mono text-teal-700 dark:text-teal-400">{it.itemCode}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Payment Records ({payments.length})</h3>
              {payments.length === 0 ? (
                <p className="text-sm text-slate-500">No payments captured for this booking yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {payments.map((p) => (
                    <li key={p.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <p className="font-mono font-semibold text-slate-900 dark:text-white">{p.invoiceNumber}</p>
                        <p className="text-slate-500 uppercase">{p.method} · {p.status}</p>
                      </div>
                      <span className="font-mono font-semibold text-slate-900 dark:text-white">
                        ₹{p.amount.toLocaleString('en-IN')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {booking && (
        <RazorpayCheckoutModal
          isOpen={showPayModal}
          onClose={() => setShowPayModal(false)}
          bookingId={booking.id}
          bookingCode={booking.bookingCode}
          remainingAmount={remainingDue}
          allowAdvance={booking.paidAmount === 0}
          onPaymentSuccess={() => {
            setShowPayModal(false);
            pushToast('success', 'Payment verified and recorded.');
            loadDetail();
          }}
        />
      )}
    </DashboardShell>
  );
}
