import React, { useState } from 'react';
import { Building2, CheckCircle2, CreditCard, Lock, ShieldCheck, Smartphone, Wallet, X, AlertTriangle } from 'lucide-react';
import { extractApiError, paymentsApi } from '../../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  bookingCode: string;
  remainingAmount: number;
  allowAdvance?: boolean;
  onPaymentSuccess: (result: { paymentId: string; invoiceNumber: string; paymentStatus: string }) => void;
}

type PayMethod = 'upi' | 'card' | 'netbanking' | 'wallet';

export const RazorpayCheckoutModal: React.FC<Props> = ({
  isOpen,
  onClose,
  bookingId,
  bookingCode,
  remainingAmount,
  allowAdvance = true,
  onPaymentSuccess,
}) => {
  const [paymentMode, setPaymentMode] = useState<'advance' | 'full'>('full');
  const [method, setMethod] = useState<PayMethod>('upi');
  const [upiId, setUpiId] = useState('customer@okaxis');
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');
  const [selectedWallet, setSelectedWallet] = useState('Paytm Wallet');
  const [cardLast4, setCardLast4] = useState('4242');
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const payableAmount =
    paymentMode === 'advance' && allowAdvance ? Math.max(500, Math.round(remainingAmount * 0.25)) : remainingAmount;

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setProcessing(true);

    try {
      const orderRes = await paymentsApi.createOrder({
        bookingId,
        paymentMode,
        method,
      });
      const order = orderRes.data.order;

      if (!order.sandboxAuth) {
        setError('Live Razorpay SDK checkout requires loading Razorpay script with configured production keys.');
        setProcessing(false);
        return;
      }

      const verifyRes = await paymentsApi.verify({
        orderId: order.orderId,
        razorpay_payment_id: order.sandboxAuth.razorpay_payment_id,
        razorpay_signature: order.sandboxAuth.razorpay_signature,
        simulateFailure,
      });

      onPaymentSuccess({
        paymentId: verifyRes.data.paymentId,
        invoiceNumber: verifyRes.data.invoiceNumber,
        paymentStatus: verifyRes.data.paymentStatus,
      });
    } catch (err) {
      setError(extractApiError(err, 'Payment could not be verified.'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between bg-[#0B1F3A] px-6 py-4 text-white">
          <div>
            <p className="text-xs text-teal-300 font-medium">Razorpay Test Mode Gateway</p>
            <h3 className="text-lg font-semibold">Complete Payment · {bookingCode}</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-300 hover:text-white" aria-label="Close payment modal">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handlePay} className="p-6 space-y-5">
          {allowAdvance && (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Payment Option</label>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-slate-100 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setPaymentMode('full')}
                  className={`py-2 px-3 rounded-md text-xs font-medium transition-colors ${
                    paymentMode === 'full'
                      ? 'bg-white dark:bg-[#0D1B2E] text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Full Payment (₹{remainingAmount.toLocaleString('en-IN')})
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode('advance')}
                  className={`py-2 px-3 rounded-md text-xs font-medium transition-colors ${
                    paymentMode === 'advance'
                      ? 'bg-white dark:bg-[#0D1B2E] text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  25% Advance (₹{Math.max(500, Math.round(remainingAmount * 0.25)).toLocaleString('en-IN')})
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Payment Method</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'upi', label: 'UPI', icon: Smartphone },
                { id: 'card', label: 'Card', icon: CreditCard },
                { id: 'netbanking', label: 'NetBanking', icon: Building2 },
                { id: 'wallet', label: 'Wallets', icon: Wallet },
              ].map((m) => {
                const Icon = m.icon;
                const active = method === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id as PayMethod)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border py-2.5 px-2 text-xs font-medium transition-colors ${
                      active
                        ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4">
            {method === 'upi' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">UPI ID / VPA</label>
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="yourname@okaxis"
                  required
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D1B2E] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  Supports GPay, PhonePe, Paytm, and BHIM UPI test verification.
                </p>
              </div>
            )}

            {method === 'card' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Tokenized Test Card (PCI-DSS safe — raw PAN/CVV never stored)</span>
                  <Lock className="w-3.5 h-3.5 text-teal-600" />
                </div>
                <select
                  value={cardLast4}
                  onChange={(e) => setCardLast4(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D1B2E] px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="4242">Visa Test Token •••• 4242</option>
                  <option value="5555">Mastercard Test Token •••• 5555</option>
                  <option value="6521">RuPay Test Token •••• 6521</option>
                </select>
              </div>
            )}

            {method === 'netbanking' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Select Indian Bank</label>
                <select
                  value={selectedBank}
                  onChange={(e) => setSelectedBank(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D1B2E] px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option>HDFC Bank</option>
                  <option>ICICI Bank</option>
                  <option>State Bank of India</option>
                  <option>Axis Bank</option>
                  <option>Kotak Mahindra Bank</option>
                </select>
              </div>
            )}

            {method === 'wallet' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Select Wallet</label>
                <select
                  value={selectedWallet}
                  onChange={(e) => setSelectedWallet(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D1B2E] px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option>Paytm Wallet</option>
                  <option>Amazon Pay</option>
                  <option>PhonePe Wallet</option>
                  <option>Freecharge</option>
                </select>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={simulateFailure}
              onChange={(e) => setSimulateFailure(e.target.checked)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <span>Simulate gateway decline (test failure screen)</span>
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 p-3 text-xs text-rose-700 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-4">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Payable Now</p>
              <p className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                ₹{payableAmount.toLocaleString('en-IN')}
              </p>
            </div>
            <button
              type="submit"
              disabled={processing}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{processing ? 'Verifying...' : `Pay ₹${payableAmount.toLocaleString('en-IN')}`}</span>
            </button>
          </div>

          <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
            <span>Server-side HMAC-SHA256 signature verification · GST Invoice generated automatically</span>
          </p>
        </form>
      </div>
    </div>
  );
};
