import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { bookingsApi, extractApiError, paymentsApi } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import type { PaymentTransaction } from '../types';
import { DashboardShell } from '../components/layout/DashboardShell';
import { downloadBookingInvoiceHtml } from '../utils/invoicePdf';

export default function TransactionHistoryPage() {
  const { user, pushToast } = useAppStore();
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    paymentsApi
      .history()
      .then((res) => setTransactions(res.data.transactions))
      .catch((err) => pushToast('error', extractApiError(err, 'Failed to fetch transaction history.')))
      .finally(() => setLoading(false));
  }, [pushToast]);

  const handleDownloadInvoice = async (bookingId: string) => {
    try {
      const { data } = await bookingsApi.detail(bookingId);
      downloadBookingInvoiceHtml(data.booking, user?.fullName || 'Customer', user?.email || '');
    } catch (err) {
      pushToast('error', extractApiError(err, 'Could not download invoice.'));
    }
  };

  return (
    <DashboardShell title="Transaction History" breadcrumb="STOVRA / Billing / Transactions">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Payment & Refund Ledger</h2>
          <Link to="/payments" className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline">
            Make a Payment
          </Link>
        </div>

        {loading ? (
          <div className="p-8 h-48 animate-pulse" />
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No transactions recorded yet. Completed and attempted payments will appear here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-xs text-slate-500">
                  <th className="py-3 px-4">Invoice / Order</th>
                  <th className="py-3 px-4">Booking</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="py-3.5 px-4">
                      <p className="font-mono font-semibold text-slate-900 dark:text-white">{t.invoiceNumber}</p>
                      <p className="font-mono text-[11px] text-slate-500">{t.orderId}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <Link to={`/bookings/${t.bookingId}`} className="font-mono font-semibold text-teal-700 dark:text-teal-400 hover:underline">
                        {t.bookingCode}
                      </Link>
                      <p className="text-slate-500">{t.facilityName} · {t.unitCode}</p>
                    </td>
                    <td className="py-3.5 px-4 uppercase font-medium">
                      {t.method} · {t.paymentMode}
                    </td>
                    <td className="py-3.5 px-4 capitalize">
                      <span className={t.status === 'captured' ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : t.status === 'refunded' ? 'text-amber-600 font-semibold' : 'text-rose-600'}>
                        {t.status}{t.refundStatus !== 'none' ? ` (${t.refundStatus})` : ''}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      ₹{t.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDownloadInvoice(t.bookingId)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
