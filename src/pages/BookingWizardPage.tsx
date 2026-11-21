import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ImagePlus, ShieldCheck, Tag, Trash2 } from 'lucide-react';
import { bookingsApi, extractApiError, facilitiesApi } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import type { Booking, StorageFacility, StorageUnit } from '../types';
import { DashboardShell } from '../components/layout/DashboardShell';
import { RazorpayCheckoutModal } from '../components/common/RazorpayCheckoutModal';

export default function BookingWizardPage() {
  const { facilityId } = useParams<{ facilityId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const pushToast = useAppStore((s) => s.pushToast);

  const [facilities, setFacilities] = useState<StorageFacility[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState(facilityId || '');
  const [selectedUnitId, setSelectedUnitId] = useState(searchParams.get('unitId') || '');
  const [checkInDate, setCheckInDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [durationType, setDurationType] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [durationCount, setDurationCount] = useState(1);
  const [inventorySummary, setInventorySummary] = useState('');
  const [itemImages, setItemImages] = useState<string[]>([]);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState('');

  const [quote, setQuote] = useState<{
    available: boolean;
    checkOutDate: string;
    rate: number;
    subtotal: number;
    discountAmount: number;
    appliedPromo: string;
    promoError: string;
    gstAmount: number;
    totalAmount: number;
  } | null>(null);

  const [loadingFacilities, setLoadingFacilities] = useState(true);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdBooking, setCreatedBooking] = useState<Booking | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);

  useEffect(() => {
    facilitiesApi
      .list()
      .then((res) => {
        const list = res.data.facilities;
        setFacilities(list);
        const initFac = list.find((f) => f.id === facilityId) || list[0];
        if (initFac) {
          setSelectedFacilityId(initFac.id);
          const requestedUnit = searchParams.get('unitId');
          const validUnit = initFac.units.find((u) => u.id === requestedUnit && u.status === 'available')
            || initFac.units.find((u) => u.status === 'available');
          if (validUnit) setSelectedUnitId(validUnit.id);
        }
      })
      .catch((err) => pushToast('error', extractApiError(err, 'Could not load storage facilities.')))
      .finally(() => setLoadingFacilities(false));
  }, [facilityId, searchParams, pushToast]);

  const currentFacility = facilities.find((f) => f.id === selectedFacilityId);
  const currentUnit: StorageUnit | undefined = currentFacility?.units.find((u) => u.id === selectedUnitId);

  useEffect(() => {
    if (!selectedUnitId || !checkInDate) return;
    setQuoting(true);
    bookingsApi
      .quote({
        unitId: selectedUnitId,
        checkInDate,
        durationType,
        durationCount,
        promoCode: appliedPromo || undefined,
      })
      .then((res) => setQuote(res.data))
      .catch(() => setQuote(null))
      .finally(() => setQuoting(false));
  }, [selectedUnitId, checkInDate, durationType, durationCount, appliedPromo]);

  const handleFacilityChange = (nextFacId: string) => {
    setSelectedFacilityId(nextFacId);
    const fac = facilities.find((f) => f.id === nextFacId);
    const firstAvail = fac?.units.find((u) => u.status === 'available');
    setSelectedUnitId(firstAvail?.id || '');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      pushToast('error', 'Image must be smaller than 3 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const { data } = await bookingsApi.uploadImage(reader.result as string);
        setItemImages((prev) => [...prev, data.url]);
      } catch (err) {
        pushToast('error', extractApiError(err, 'Image upload failed.'));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyPromo = () => {
    setAppliedPromo(promoCode.trim().toUpperCase());
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFacilityId || !selectedUnitId) {
      pushToast('error', 'Please select a facility and storage unit.');
      return;
    }
    if (quote && !quote.available) {
      pushToast('error', 'This unit is already booked for the chosen dates.');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await bookingsApi.create({
        facilityId: selectedFacilityId,
        unitId: selectedUnitId,
        checkInDate,
        durationType,
        durationCount,
        inventorySummary,
        itemImages,
        promoCode: appliedPromo || undefined,
      });
      setCreatedBooking(data.booking);
      setShowPayModal(true);
      pushToast('success', `Booking ${data.booking.bookingCode} created. Complete payment to confirm.`);
    } catch (err) {
      pushToast('error', extractApiError(err, 'Could not create booking.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardShell title="Book Storage Unit" breadcrumb="STOVRA / Bookings / New Reservation">
      {loadingFacilities ? (
        <div className="h-96 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] animate-pulse" />
      ) : (
        <form onSubmit={handleConfirmBooking} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Steps Column */}
          <div className="lg:col-span-8 space-y-6">
            {/* Step 1 & 2: Facility & Unit */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6 space-y-5">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                01. Select Facility & Storage Unit
              </h2>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Storage Facility</label>
                <select
                  value={selectedFacilityId}
                  onChange={(e) => handleFacilityChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm"
                >
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} — {f.locality}, {f.city} ({f.availableUnits} open)
                    </option>
                  ))}
                </select>
              </div>

              {currentFacility && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Choose Unit Size</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {currentFacility.units.map((u) => {
                      const selected = u.id === selectedUnitId;
                      const unavailable = u.status !== 'available';
                      return (
                        <button
                          key={u.id}
                          type="button"
                          disabled={unavailable}
                          onClick={() => setSelectedUnitId(u.id)}
                          className={`text-left rounded-xl border p-3.5 transition-colors ${
                            unavailable
                              ? 'opacity-50 cursor-not-allowed border-slate-200 dark:border-slate-800'
                              : selected
                                ? 'border-teal-600 bg-teal-50/60 dark:bg-teal-950/40'
                                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-semibold text-teal-700 dark:text-teal-400">{u.unitCode}</span>
                            <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                              ₹{u.monthlyRate.toLocaleString('en-IN')}/mo
                            </span>
                          </div>
                          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{u.sizeLabel}</p>
                          <p className="mt-0.5 text-xs text-slate-500 font-mono">{u.dimensions} · {u.floorLevel}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Step 3 & 4: Check-in Date & Duration */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6 space-y-5">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                02. Check-In Date & Duration
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Check-In Date</label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().slice(0, 10)}
                    value={checkInDate}
                    onChange={(e) => setCheckInDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Billing Cycle</label>
                  <select
                    value={durationType}
                    onChange={(e) => setDurationType(e.target.value as 'daily' | 'weekly' | 'monthly')}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Duration ({durationType})
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={36}
                    value={durationCount}
                    onChange={(e) => setDurationCount(Math.max(1, Number(e.target.value)))}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm font-mono tabular-nums"
                  />
                </div>
              </div>
              {quote && (
                <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-4 py-3 text-xs">
                  <span className="text-slate-600 dark:text-slate-300">
                    Check-out Date: <strong className="font-mono text-slate-900 dark:text-white">{quote.checkOutDate}</strong>
                  </span>
                  <span className={`font-semibold ${quote.available ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                    {quote.available ? 'Unit Available' : 'Date Conflict — Choose Another Unit'}
                  </span>
                </div>
              )}
            </div>

            {/* Step 5 & 6: Inventory Info & Photos */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6 space-y-4">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                03. Inventory Manifest & Item Photos
              </h2>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  What will you store? (Helps intake crew prepare trolleys & shelving)
                </label>
                <textarea
                  rows={3}
                  value={inventorySummary}
                  onChange={(e) => setInventorySummary(e.target.value)}
                  placeholder="e.g., 1 teak dining table, 6 moving boxes (books & kitchenware), 2 office chairs"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                  Upload Item Images (Optional, max 3MB each)
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  {itemImages.map((url, idx) => (
                    <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                      <img src={url} alt={`Stored item ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setItemImages((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 rounded-full bg-slate-900/75 p-1 text-white"
                        aria-label="Remove image"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {itemImages.length < 6 && (
                    <label className="flex flex-col items-center justify-center w-20 h-20 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:border-teal-500 cursor-pointer">
                      <ImagePlus className="w-5 h-5" />
                      <span className="text-[10px] mt-1">Add Photo</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} className="hidden" />
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Summary & Promo & Checkout Column */}
          <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6 space-y-5 sticky top-20">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">04. Price Breakdown & Confirm</h2>

            {currentFacility && currentUnit && (
              <div className="text-xs space-y-1 pb-4 border-b border-slate-200 dark:border-slate-800">
                <p className="font-semibold text-sm text-slate-900 dark:text-white">{currentFacility.name}</p>
                <p className="text-slate-500">{currentUnit.sizeLabel} · Unit {currentUnit.unitCode}</p>
              </div>
            )}

            {/* Promo Code */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Promo Code (Try <span className="font-mono">STOVRA15</span> or <span className="font-mono">FIRST20</span>)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="STOVRA15"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-8 pr-3 py-2 text-xs font-mono uppercase"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleApplyPromo}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Apply
                </button>
              </div>
              {quote?.promoError && <p className="mt-1 text-xs text-rose-600">{quote.promoError}</p>}
              {quote?.appliedPromo && (
                <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{quote.appliedPromo} applied!</span>
                </p>
              )}
            </div>

            {quoting ? (
              <div className="h-28 bg-slate-100 dark:bg-slate-900 rounded-xl animate-pulse" />
            ) : quote && (
              <div className="space-y-2.5 text-sm border-t border-slate-200 dark:border-slate-800 pt-4">
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>Rental Subtotal ({durationCount} {durationType})</span>
                  <span className="font-mono tabular-nums">₹{quote.subtotal.toLocaleString('en-IN')}</span>
                </div>
                {quote.discountAmount > 0 && (
                  <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
                    <span>Promo Discount</span>
                    <span className="font-mono tabular-nums">-₹{quote.discountAmount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>GST (18%)</span>
                  <span className="font-mono tabular-nums">₹{quote.gstAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-[#0B1F3A] dark:text-white pt-2 border-t border-slate-200 dark:border-slate-800">
                  <span>Total Payable</span>
                  <span className="font-mono tabular-nums">₹{quote.totalAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !quote?.available}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B1F3A] dark:bg-teal-600 hover:opacity-95 disabled:opacity-50 py-3 text-sm font-semibold text-white transition-opacity"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{submitting ? 'Reserving Unit...' : 'Confirm & Proceed to Payment'}</span>
            </button>
          </div>
        </form>
      )}

      {createdBooking && (
        <RazorpayCheckoutModal
          isOpen={showPayModal}
          onClose={() => {
            setShowPayModal(false);
            navigate(`/bookings/${createdBooking.id}`);
          }}
          bookingId={createdBooking.id}
          bookingCode={createdBooking.bookingCode}
          remainingAmount={createdBooking.totalAmount - createdBooking.paidAmount}
          onPaymentSuccess={() => {
            setShowPayModal(false);
            pushToast('success', 'Payment verified! Your QR access pass is active.');
            navigate(`/booking-confirmation/${createdBooking.id}`);
          }}
        />
      )}
    </DashboardShell>
  );
}
