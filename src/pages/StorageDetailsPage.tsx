import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, Heart, MapPin, Shield, Star, Thermometer } from 'lucide-react';
import { extractApiError, facilitiesApi } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import type { FacilityReview, StorageFacility } from '../types';
import { PublicNavbar } from '../components/layout/PublicNavbar';
import { DashboardShell } from '../components/layout/DashboardShell';
import { ImageWithFallback } from '../components/common/ImageWithFallback';

export default function StorageDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { user, pushToast } = useAppStore();

  const [facility, setFacility] = useState<StorageFacility | null>(null);
  const [reviews, setReviews] = useState<FacilityReview[]>([]);
  const [activePhoto, setActivePhoto] = useState('');
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    facilitiesApi
      .detail(id)
      .then((res) => {
        setFacility(res.data.facility);
        setReviews(res.data.reviews);
        setActivePhoto(res.data.facility.imageUrl);
      })
      .catch((err) => pushToast('error', extractApiError(err, 'Facility not found.')))
      .finally(() => setLoading(false));
  }, [id, pushToast]);

  const handleToggleWishlist = async () => {
    if (!facility) return;
    if (!user) {
      pushToast('info', 'Please sign in to save facilities.');
      return;
    }
    try {
      const { data } = await facilitiesApi.toggleWishlist(facility.id);
      setFacility({ ...facility, isWishlisted: data.wishlisted });
    } catch (err) {
      pushToast('error', extractApiError(err));
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facility) return;
    setSubmittingReview(true);
    try {
      const { data } = await facilitiesApi.submitReview(facility.id, { rating, comment });
      setReviews((prev) => [data.review, ...prev]);
      setComment('');
      pushToast('success', 'Thank you! Your review has been published.');
    } catch (err) {
      pushToast('error', extractApiError(err, 'Could not submit review.'));
    } finally {
      setSubmittingReview(false);
    }
  };

  const body = loading ? (
    <div className="space-y-6">
      <div className="h-80 rounded-2xl bg-white dark:bg-[#0D1B2E] animate-pulse border border-slate-200 dark:border-slate-800" />
      <div className="h-64 rounded-2xl bg-white dark:bg-[#0D1B2E] animate-pulse border border-slate-200 dark:border-slate-800" />
    </div>
  ) : !facility ? (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-10 text-center">
      <p className="text-base font-semibold">Storage facility not found.</p>
      <Link to="/storage" className="mt-3 inline-block text-sm font-semibold text-teal-600 hover:underline">
        Back to all facilities
      </Link>
    </div>
  ) : (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link to="/storage" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-teal-600">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Discovery</span>
        </Link>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleToggleWishlist}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Heart className={`w-4 h-4 ${facility.isWishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
            <span>{facility.isWishlisted ? 'Saved' : 'Save Facility'}</span>
          </button>
          <Link
            to={`/book/${facility.id}`}
            className="rounded-lg bg-[#0B1F3A] dark:bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:opacity-95"
          >
            Book a Unit Here
          </Link>
        </div>
      </div>

      {/* Gallery + Summary Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 space-y-3">
          <div className="aspect-[16/10] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <ImageWithFallback src={activePhoto || facility.imageUrl} alt={facility.name} className="w-full h-full object-cover" />
          </div>
          {facility.gallery.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {facility.gallery.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActivePhoto(img)}
                  className={`w-24 h-16 rounded-lg overflow-hidden border-2 shrink-0 ${
                    activePhoto === img ? 'border-teal-600' : 'border-transparent opacity-75 hover:opacity-100'
                  }`}
                >
                  <ImageWithFallback src={img} alt={`${facility.name} view ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{facility.city} · {facility.pincode}</span>
              <span className="inline-flex items-center gap-1 font-mono font-semibold text-slate-900 dark:text-white">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                {facility.rating} ({facility.reviewCount} reviews)
              </span>
            </div>
            <h1 className="font-display text-2xl font-bold text-[#0B1F3A] dark:text-white">{facility.name}</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{facility.description}</p>

            <div className="space-y-2 pt-2 text-xs text-slate-600 dark:text-slate-300">
              <p className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <span>{facility.address}</span>
              </p>
              <p className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-teal-600 shrink-0" />
                <span>{facility.operatingHours}</span>
              </p>
              <p className="flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-teal-600 shrink-0" />
                <span>{facility.climateControlled ? 'Climate-controlled (20–24°C, <50% RH)' : 'Ambient ventilated bays'}</span>
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500">Units starting at</span>
              <p className="text-xl font-bold font-mono tabular-nums text-[#0B1F3A] dark:text-white">
                ₹{facility.baseMonthlyRate.toLocaleString('en-IN')}/mo
              </p>
            </div>
            <span className="text-xs font-mono font-medium text-teal-700 dark:text-teal-400">
              {facility.availableUnits} of {facility.totalUnits} available
            </span>
          </div>
        </div>
      </div>

      {/* Unit Matrix */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Available Storage Units</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                <th className="py-2.5">Unit</th>
                <th className="py-2.5">Size & Dimensions</th>
                <th className="py-2.5">Best For</th>
                <th className="py-2.5 text-right">Daily</th>
                <th className="py-2.5 text-right">Weekly</th>
                <th className="py-2.5 text-right">Monthly</th>
                <th className="py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {facility.units.map((u) => (
                <tr key={u.id}>
                  <td className="py-3.5 pr-4 font-mono text-xs font-semibold text-slate-900 dark:text-white">
                    {u.unitCode}
                    <span className="block text-[11px] font-sans font-normal text-slate-500">{u.floorLevel}</span>
                  </td>
                  <td className="py-3.5 pr-4">
                    <p className="font-medium text-slate-900 dark:text-white">{u.sizeLabel}</p>
                    <p className="text-xs font-mono text-slate-500">{u.dimensions}</p>
                  </td>
                  <td className="py-3.5 pr-4 text-xs text-slate-600 dark:text-slate-300">{u.storageType}</td>
                  <td className="py-3.5 px-2 text-right font-mono tabular-nums text-xs">₹{u.dailyRate}</td>
                  <td className="py-3.5 px-2 text-right font-mono tabular-nums text-xs">₹{u.weeklyRate}</td>
                  <td className="py-3.5 px-2 text-right font-mono tabular-nums text-sm font-semibold text-[#0B1F3A] dark:text-white">
                    ₹{u.monthlyRate.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3.5 pl-4 text-right">
                    {u.status === 'available' ? (
                      <Link
                        to={`/book/${facility.id}?unitId=${u.id}`}
                        className="inline-block rounded-lg bg-teal-600 hover:bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white"
                      >
                        Select
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400 capitalize">{u.status}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Amenities & Security */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Facility Amenities</h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm text-slate-600 dark:text-slate-300">
            {facility.amenities.map((a) => (
              <li key={a} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Security Infrastructure</h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm text-slate-600 dark:text-slate-300">
            {facility.securityFeatures.map((s) => (
              <li key={s} className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-teal-600 shrink-0" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Reviews */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6 space-y-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
          Customer Reviews ({reviews.length})
        </h3>

        {user && (
          <form onSubmit={handleReviewSubmit} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Leave a review</span>
              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D1B2E] px-2.5 py-1 text-xs"
              >
                <option value={5}>5 Stars — Excellent</option>
                <option value={4}>4 Stars — Very Good</option>
                <option value={3}>3 Stars — Average</option>
                <option value={2}>2 Stars — Below Par</option>
                <option value={1}>1 Star — Poor</option>
              </select>
            </div>
            <textarea
              rows={2}
              required
              minLength={8}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your experience with unit cleanliness, staff, or QR gate access..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D1B2E] px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={submittingReview}
              className="rounded-lg bg-[#0B1F3A] dark:bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:opacity-95 disabled:opacity-60"
            >
              {submittingReview ? 'Publishing...' : 'Publish Review'}
            </button>
          </form>
        )}

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {reviews.map((r) => (
            <div key={r.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-900 dark:text-white">
                  {r.userName} {r.verifiedBooking ? '· Verified Customer' : ''}
                </span>
                <span className="font-mono text-amber-500">{'★'.repeat(r.rating)}</span>
              </div>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{r.comment}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (user) {
    return (
      <DashboardShell title={facility?.name || 'Facility Details'} breadcrumb="STOVRA / Storage Discovery / Details">
        {body}
      </DashboardShell>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#07111E] text-slate-900 dark:text-slate-100">
      <PublicNavbar />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">{body}</div>
    </div>
  );
}
