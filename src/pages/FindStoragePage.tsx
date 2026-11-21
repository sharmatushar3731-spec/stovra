import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Heart, LayoutGrid, Map as MapIcon, MapPin, Navigation, Search, Scale, Star, X } from 'lucide-react';
import { extractApiError, facilitiesApi } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import type { StorageFacility } from '../types';
import { PublicNavbar } from '../components/layout/PublicNavbar';
import { DashboardShell } from '../components/layout/DashboardShell';
import { ImageWithFallback } from '../components/common/ImageWithFallback';
import { FacilityMap } from '../components/common/FacilityMap';

export default function FindStoragePage() {
  const [searchParams] = useSearchParams();
  const { user, compareIds, toggleCompare, clearCompare, pushToast } = useAppStore();

  const [q, setQ] = useState(searchParams.get('q') || '');
  const [city, setCity] = useState('All');
  const [climateOnly, setClimateOnly] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(true);
  const [maxPrice, setMaxPrice] = useState(10000);
  const [sizeFilter, setSizeFilter] = useState<'all' | 'small' | 'medium' | 'large'>('all');
  const [sort, setSort] = useState('rating');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [facilities, setFacilities] = useState<StorageFacility[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [wishlistOnly, setWishlistOnly] = useState(false);

  const loadFacilities = useCallback(async () => {
    setLoading(true);
    try {
      const minSqft = sizeFilter === 'medium' ? 35 : sizeFilter === 'large' ? 100 : 0;
      const maxSqft = sizeFilter === 'small' ? 35 : sizeFilter === 'medium' ? 120 : 9999;

      const { data } = await facilitiesApi.list({
        q: q.trim() || undefined,
        city: city !== 'All' ? city : undefined,
        climate: climateOnly ? 'true' : undefined,
        availableOnly: availableOnly ? 'true' : undefined,
        maxPrice,
        minSqft,
        maxSqft,
        sort,
        lat: userCoords?.lat,
        lng: userCoords?.lng,
        wishlist: wishlistOnly ? 'true' : undefined,
      });
      setFacilities(data.facilities);
    } catch (err) {
      pushToast('error', extractApiError(err, 'Could not load storage facilities.'));
    } finally {
      setLoading(false);
    }
  }, [q, city, climateOnly, availableOnly, maxPrice, sizeFilter, sort, userCoords, wishlistOnly, pushToast]);

  useEffect(() => {
    loadFacilities();
  }, [loadFacilities]);

  const requestGps = useCallback(() => {
    if (!navigator.geolocation) {
      pushToast('error', 'Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setSort('distance');
        pushToast('success', 'Location detected! Sorted facilities by distance.');
      },
      () => {
        pushToast('info', 'Location permission denied. Filter by city or PIN code instead.');
      }
    );
  }, [pushToast]);

  useEffect(() => {
    if (searchParams.get('nearby') === '1') {
      requestGps();
    }
  }, [searchParams, requestGps]);

  const handleToggleWishlist = async (facilityId: string) => {
    if (!user) {
      pushToast('info', 'Sign in to save facilities to your wishlist.');
      return;
    }
    try {
      const { data } = await facilitiesApi.toggleWishlist(facilityId);
      setFacilities((prev) =>
        prev.map((f) => (f.id === facilityId ? { ...f, isWishlisted: data.wishlisted } : f))
      );
      pushToast('success', data.wishlisted ? 'Added to wishlist' : 'Removed from wishlist');
    } catch (err) {
      pushToast('error', extractApiError(err));
    }
  };

  const comparedFacilities = facilities.filter((f) => compareIds.includes(f.id));

  const content = (
    <div className="space-y-6">
      {/* Search & Filters Bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-5 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by city, locality, facility name, or 6-digit PIN code..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-4 py-2.5 text-sm"
            />
          </div>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            aria-label="Filter by city"
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm"
          >
            <option value="All">All Cities</option>
            <option value="Uttar Pradesh">Uttar Pradesh (All UP)</option>
            <option value="Agra">Agra</option>
            <option value="Bengaluru">Bengaluru</option>
            <option value="Delhi NCR">Delhi NCR</option>
            <option value="Lucknow">Lucknow</option>
            <option value="Meerut">Meerut</option>
            <option value="Mumbai">Mumbai</option>
            <option value="Noida">Noida</option>
            <option value="Pune">Pune</option>
          </select>
          <button
            type="button"
            onClick={requestGps}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Navigation className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>Use GPS</span>
          </button>
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-900 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                viewMode === 'list' ? 'bg-white dark:bg-[#0D1B2E] text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                viewMode === 'map' ? 'bg-white dark:bg-[#0D1B2E] text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Map</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900">
              {[
                { id: 'all', label: 'All Sizes' },
                { id: 'small', label: 'Lockers ≤35 sq.ft' },
                { id: 'medium', label: '1-2 BHK 35-120' },
                { id: 'large', label: 'Business 100+' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSizeFilter(s.id as typeof sizeFilter)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
                    sizeFilter === s.id
                      ? 'bg-white dark:bg-[#0D1B2E] text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={climateOnly}
                onChange={(e) => setClimateOnly(e.target.checked)}
                className="rounded border-slate-300 text-teal-600"
              />
              <span>Climate-controlled</span>
            </label>

            <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={availableOnly}
                onChange={(e) => setAvailableOnly(e.target.checked)}
                className="rounded border-slate-300 text-teal-600"
              />
              <span>Available units only</span>
            </label>

            {user && (
              <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wishlistOnly}
                  onChange={(e) => setWishlistOnly(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600"
                />
                <span>Saved wishlist</span>
              </label>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Max ₹{maxPrice.toLocaleString('en-IN')}/mo</span>
              <input
                type="range"
                min={2000}
                max={12000}
                step={500}
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-24 accent-teal-600"
              />
            </div>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort facilities"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
            >
              <option value="rating">Top Rated</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              {userCoords && <option value="distance">Nearest Distance</option>}
            </select>
          </div>
        </div>
      </div>

      {/* Compare Bar */}
      {compareIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/40 px-4 py-3 text-xs">
          <div className="flex items-center gap-2 font-medium text-teal-900 dark:text-teal-200">
            <Scale className="w-4 h-4" />
            <span>{compareIds.length} facility(ies) selected for comparison</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowCompareModal(true)}
              className="rounded-lg bg-teal-600 px-3 py-1.5 font-semibold text-white hover:bg-teal-700"
            >
              Compare Now
            </button>
            <button type="button" onClick={clearCompare} className="text-slate-600 dark:text-slate-300 hover:underline">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-96 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] animate-pulse" />
          ))}
        </div>
      ) : facilities.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-12 text-center space-y-3">
          <p className="text-base font-semibold text-slate-900 dark:text-white">No storage facilities match your filters</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Try clearing the PIN search or increasing the monthly price ceiling.</p>
          <button
            type="button"
            onClick={() => {
              setQ('');
              setCity('All');
              setClimateOnly(false);
              setMaxPrice(12000);
              setSizeFilter('all');
              setWishlistOnly(false);
            }}
            className="rounded-lg bg-[#0B1F3A] dark:bg-teal-600 px-4 py-2 text-xs font-semibold text-white"
          >
            Reset All Filters
          </button>
        </div>
      ) : viewMode === 'map' ? (
        <FacilityMap facilities={facilities} userCoords={userCoords} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {facilities.map((fac) => {
            const compared = compareIds.includes(fac.id);
            return (
              <div
                key={fac.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] overflow-hidden"
              >
                <div>
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <ImageWithFallback src={fac.imageUrl} alt={fac.name} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleToggleWishlist(fac.id)}
                      aria-label={fac.isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
                      className="absolute top-3 right-3 p-2 rounded-full bg-white/90 dark:bg-[#0B1F3A]/90 text-slate-700 dark:text-slate-200 hover:text-rose-600 transition-colors"
                    >
                      <Heart className={`w-4 h-4 ${fac.isWishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
                    </button>
                  </div>

                  <div className="p-5">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>
                        {fac.city} · {fac.pincode} · {fac.climateControlled ? 'Climate Vault' : 'Standard'}
                      </span>
                      <span className="inline-flex items-center gap-1 font-medium text-slate-800 dark:text-slate-200 font-mono">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        {fac.rating}
                      </span>
                    </div>

                    <Link to={`/storage/${fac.id}`} className="block mt-1.5 text-lg font-semibold text-slate-900 dark:text-white hover:text-teal-700 dark:hover:text-teal-400">
                      {fac.name}
                    </Link>

                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{fac.locality}</span>
                      {fac.distanceKm !== null && (
                        <span className="font-mono text-teal-700 dark:text-teal-400 ml-auto shrink-0">
                          {fac.distanceKm} km
                        </span>
                      )}
                    </p>

                    <div className="mt-3 text-xs text-slate-600 dark:text-slate-300 flex flex-wrap gap-x-3 gap-y-1">
                      <span>{fac.availableUnits} units open</span>
                      <span>·</span>
                      <span>{fac.minUnitSqft}–{fac.maxUnitSqft} sq.ft</span>
                      <span>·</span>
                      <span>{fac.operatingHours}</span>
                    </div>
                  </div>
                </div>

                <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] text-slate-500">From ₹{fac.baseDailyRate}/day</p>
                    <p className="text-base font-bold font-mono tabular-nums text-[#0B1F3A] dark:text-white">
                      ₹{fac.baseMonthlyRate.toLocaleString('en-IN')}/mo
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleCompare(fac.id)}
                      className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors ${
                        compared
                          ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {compared ? 'Comparing' : 'Compare'}
                    </button>
                    <Link
                      to={`/storage/${fac.id}`}
                      className="rounded-lg bg-[#0B1F3A] dark:bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white hover:opacity-95"
                    >
                      Details
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Compare Modal */}
      {showCompareModal && comparedFacilities.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Compare Storage Facilities</h3>
              <button type="button" onClick={() => setShowCompareModal(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3 pr-4 text-xs text-slate-500">Attribute</th>
                    {comparedFacilities.map((f) => (
                      <th key={f.id} className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{f.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  <tr>
                    <td className="py-3 pr-4 text-slate-500">Location</td>
                    {comparedFacilities.map((f) => <td key={f.id} className="py-3 px-4">{f.locality}, {f.city} ({f.pincode})</td>)}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 text-slate-500">Monthly Base Rate</td>
                    {comparedFacilities.map((f) => <td key={f.id} className="py-3 px-4 font-mono font-semibold">₹{f.baseMonthlyRate.toLocaleString('en-IN')}</td>)}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 text-slate-500">Daily / Weekly</td>
                    {comparedFacilities.map((f) => <td key={f.id} className="py-3 px-4 font-mono">₹{f.baseDailyRate}/d · ₹{f.baseWeeklyRate}/w</td>)}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 text-slate-500">Climate Control</td>
                    {comparedFacilities.map((f) => <td key={f.id} className="py-3 px-4">{f.climateControlled ? 'Yes (20–24°C)' : 'Standard Ambient'}</td>)}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 text-slate-500">Available Units</td>
                    {comparedFacilities.map((f) => <td key={f.id} className="py-3 px-4 font-mono">{f.availableUnits} / {f.totalUnits}</td>)}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 text-slate-500">Security</td>
                    {comparedFacilities.map((f) => <td key={f.id} className="py-3 px-4">{f.securityFeatures.slice(0, 3).join(', ')}</td>)}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4"></td>
                    {comparedFacilities.map((f) => (
                      <td key={f.id} className="py-3 px-4">
                        <Link
                          to={`/book/${f.id}`}
                          onClick={() => setShowCompareModal(false)}
                          className="inline-block rounded-lg bg-[#0B1F3A] dark:bg-teal-600 px-3 py-1.5 font-semibold text-white"
                        >
                          Book Unit
                        </Link>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (user) {
    return (
      <DashboardShell title="Find Storage" breadcrumb="STOVRA / Storage Discovery">
        {content}
      </DashboardShell>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#07111E] text-slate-900 dark:text-slate-100">
      <PublicNavbar />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1F3A] dark:text-white">
            Find Smart Storage Near You
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Compare verified facilities across Bengaluru, Mumbai, Delhi NCR, Pune, and Uttar Pradesh (Meerut, Agra, Noida, Lucknow).
          </p>
        </div>
        {content}
      </div>
    </div>
  );
}
