import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, MapPin, Navigation, QrCode, Search, ShieldCheck, Thermometer, Warehouse } from 'lucide-react';
import { facilitiesApi } from '../services/api';
import type { StorageFacility } from '../types';
import { PublicNavbar } from '../components/layout/PublicNavbar';
import { ImageWithFallback } from '../components/common/ImageWithFallback';
import { SpaceCalculatorWidget } from '../components/common/SpaceCalculatorWidget';
import { PWAInstallButton } from '../components/common/PWAInstallButton';

export default function LandingPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [facilities, setFacilities] = useState<StorageFacility[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    facilitiesApi
      .list()
      .then((res) => setFacilities(res.data.facilities.slice(0, 3)))
      .catch(() => setFacilities([]))
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(searchQuery.trim() ? `/storage?q=${encodeURIComponent(searchQuery.trim())}` : '/storage');
  };

  const handleNearby = () => {
    navigate('/storage?nearby=1');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#07111E] text-slate-900 dark:text-slate-100">
      <PublicNavbar />

      {/* Hero Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pt-10 pb-14 lg:pt-14 lg:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
            <p className="text-sm font-medium text-teal-700 dark:text-teal-400">
              STOVRA Smart Storage · Bengaluru · Mumbai · Delhi NCR · Uttar Pradesh · Pune
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-[54px] font-bold tracking-tight leading-[1.08] text-[#0B1F3A] dark:text-white text-balance">
              Your Space. Your Control.
            </h1>
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
              Book climate-controlled storage vaults in minutes, label every box with a verified QR code, and track your inventory across cities from one dashboard.
            </p>

            {/* Search & GPS Discovery Bar */}
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2.5 max-w-xl">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search city, locality, or 6-digit PIN code"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D1B2E] pl-10 pr-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B1F3A] dark:bg-teal-600 hover:bg-[#143159] dark:hover:bg-teal-500 px-5 py-3 text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0"
              >
                <span>Find Storage</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNearby}
                title="Use GPS to find nearby facilities"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D1B2E] px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                <Navigation className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>Near Me</span>
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <Link
                to="/register"
                className="text-sm font-semibold text-teal-700 dark:text-teal-400 hover:underline"
              >
                Create free account (₹500 storage credit)
              </Link>
              <PWAInstallButton />
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="h-full min-h-[300px] lg:min-h-[420px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
              <ImageWithFallback
                src="/src/assets/images/hero_stovra_facility_1795281960311.jpg"
                alt="STOVRA Bengaluru smart storage lobby and vault corridor"
                className="w-full h-full object-cover"
                fallbackTitle="STOVRA Flagship Hub"
              />
            </div>
          </div>
        </div>

        {/* 4-Column Proof Strip */}
        <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4 border-y border-slate-200 dark:border-slate-800 py-6">
          {[
            { metric: '10 Hubs', label: 'Active across 8 cities including UP' },
            { metric: '20–24°C', label: 'Dehumidified climate-controlled vaults' },
            { metric: 'HMAC-QR', label: 'Server-verified item & gate passes' },
            { metric: '₹115/day', label: 'Flexible daily, weekly & monthly plans' },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="font-display text-2xl font-bold font-mono tabular-nums text-[#0B1F3A] dark:text-white">
                {stat.metric}
              </p>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Storage Facilities (Real DB Data) */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#0B1F3A] dark:text-white">
              Verified Smart Storage Hubs
            </h2>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              Live unit availability, transparent GST pricing, and biometric access across India.
            </p>
          </div>
          <Link
            to="/storage"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 dark:text-teal-400 hover:underline"
          >
            <span>Browse all facilities</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-80 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {facilities.map((fac) => (
              <div
                key={fac.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] overflow-hidden hover:border-teal-500/60 transition-colors"
              >
                <div>
                  <div className="aspect-[4/3] overflow-hidden">
                    <ImageWithFallback
                      src={fac.imageUrl}
                      alt={fac.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-5">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {fac.city} · {fac.pincode} · {fac.climateControlled ? 'Climate Controlled' : 'Standard Bay'}
                    </p>
                    <h3 className="mt-1.5 text-lg font-semibold text-slate-900 dark:text-white">{fac.name}</h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{fac.locality}</span>
                    </p>
                  </div>
                </div>
                <div className="px-5 pb-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">From</span>
                    <p className="text-base font-bold font-mono tabular-nums text-[#0B1F3A] dark:text-white">
                      ₹{fac.baseMonthlyRate.toLocaleString('en-IN')}/mo
                    </p>
                  </div>
                  <Link
                    to={`/storage/${fac.id}`}
                    className="rounded-lg bg-[#0B1F3A] dark:bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:opacity-95"
                  >
                    View Units
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Capabilities Asymmetric Bento */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#0B1F3A] dark:text-white mb-8">
          Built for Families, Movers, and Growing Businesses
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6 sm:p-8 flex flex-col justify-between gap-6">
            <div>
              <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">01. QR-Verified Inventory Ledger</p>
              <h3 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                Every carton tracked from drop-off to retrieval
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                Tag furniture, electronics, documents, or D2C SKUs with cryptographically signed QR labels. Scan with any smartphone camera to log check-ins, check-outs, and unit transfers without guesswork.
              </p>
            </div>
            <div className="aspect-[16/9] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
              <ImageWithFallback
                src="/src/assets/images/stovra_qr_inspection_1795281960418.jpg"
                alt="Customer scanning STOVRA box QR label"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="flex-1 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6">
              <Thermometer className="w-6 h-6 text-teal-600 dark:text-teal-400 mb-3" />
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">02. Monsoon-Safe Vaults</p>
              <h3 className="mt-1.5 text-lg font-bold text-slate-900 dark:text-white">Active Humidity & Dust Control</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Elevated plinths, HEPA air filtration, and dehumidified suites protect wooden furniture, instruments, and apparel through coastal monsoons.
              </p>
            </div>
            <div className="flex-1 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6">
              <QrCode className="w-6 h-6 text-teal-600 dark:text-teal-400 mb-3" />
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">03. Instant Booking & GST Billing</p>
              <h3 className="mt-1.5 text-lg font-bold text-slate-900 dark:text-white">Zero Paperwork, Real-Time Availability</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Lock a unit online with 25% advance or full payment via UPI, cards, or net banking, and download GST-compliant invoices anytime.
              </p>
            </div>
            <div className="flex-1 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6">
              <ShieldCheck className="w-6 h-6 text-teal-600 dark:text-teal-400 mb-3" />
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">04. Dual-Factor Access Control</p>
              <h3 className="mt-1.5 text-lg font-bold text-slate-900 dark:text-white">24/7 CCTV & OTP-Verified Entry</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Only authenticated booking owners with verified QR signatures can unlock bay access or authorize item movements.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Space Calculator */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <SpaceCalculatorWidget />
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] mt-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 font-display text-lg font-bold text-[#0B1F3A] dark:text-white">
              <Warehouse className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <span>STOVRA</span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Your Space. Your Control. · STOVRA Smart Storage Technologies Pvt. Ltd.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-slate-600 dark:text-slate-300">
            <Link to="/storage" className="hover:text-teal-600">Find Storage</Link>
            <Link to="/faq" className="hover:text-teal-600">FAQs & Calculator</Link>
            <Link to="/support" className="hover:text-teal-600">Customer Support</Link>
            <a
              href="https://wa.me/919389426392?text=Hi%20STOVRA%20Support%2C%20I%20need%20assistance."
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-teal-600 font-mono tabular-nums"
            >
              WhatsApp: +91 93894 26392
            </a>
            <Link to="/login" className="hover:text-teal-600">Customer Login</Link>
            <Link to="/register" className="hover:text-teal-600">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
