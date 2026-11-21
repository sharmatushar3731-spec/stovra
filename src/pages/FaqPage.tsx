import React, { useEffect, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { supportApi } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import type { FAQItem } from '../types';
import { PublicNavbar } from '../components/layout/PublicNavbar';
import { DashboardShell } from '../components/layout/DashboardShell';
import { SpaceCalculatorWidget } from '../components/common/SpaceCalculatorWidget';

export default function FaqPage() {
  const user = useAppStore((s) => s.user);
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string>('faq-1');

  useEffect(() => {
    supportApi.faqs().then((res) => setFaqs(res.data.faqs)).catch(() => setFaqs([]));
  }, []);

  const filtered = faqs.filter(
    (f) =>
      !query.trim() ||
      f.question.toLowerCase().includes(query.toLowerCase()) ||
      f.answer.toLowerCase().includes(query.toLowerCase()) ||
      f.category.toLowerCase().includes(query.toLowerCase())
  );

  const content = (
    <div className="space-y-8">
      <SpaceCalculatorWidget />

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Frequently Asked Questions</h2>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search FAQs..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-xs"
            />
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {filtered.map((f) => {
            const open = openId === f.id;
            return (
              <div key={f.id} className="py-3.5">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? '' : f.id)}
                  className="flex w-full items-center justify-between gap-4 text-left"
                >
                  <div>
                    <span className="text-[11px] font-medium text-teal-700 dark:text-teal-400">{f.category}</span>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">{f.question}</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && (
                  <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{f.answer}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (user) {
    return (
      <DashboardShell title="FAQs & Smart Space Calculator" breadcrumb="STOVRA / Tools & FAQs">
        {content}
      </DashboardShell>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#07111E] text-slate-900 dark:text-slate-100">
      <PublicNavbar />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1F3A] dark:text-white mb-6">
          Space Calculator, Price Estimator & FAQs
        </h1>
        {content}
      </div>
    </div>
  );
}
