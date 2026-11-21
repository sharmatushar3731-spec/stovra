import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ImagePlus, LifeBuoy, Mail, MessageCircle, PhoneCall, Send } from 'lucide-react';
import { extractApiError, supportApi } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import type { SupportTicket } from '../types';
import { PublicNavbar } from '../components/layout/PublicNavbar';
import { DashboardShell } from '../components/layout/DashboardShell';

export default function SupportPage() {
  const { user, pushToast } = useAppStore();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [category, setCategory] = useState('Booking Issue');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    supportApi
      .tickets()
      .then((res) => setTickets(res.data.tickets))
      .catch(() => setTickets([]));
  }, [user]);

  const handleUploadScreenshot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const { data } = await supportApi.uploadScreenshot(reader.result as string);
        setScreenshotUrl(data.url);
        pushToast('success', 'Screenshot attached.');
      } catch (err) {
        pushToast('error', extractApiError(err, 'Screenshot upload failed.'));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      pushToast('info', 'Please sign in to submit a tracked support ticket.');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await supportApi.createTicket({
        category,
        subject,
        description,
        screenshotUrl,
      });
      setTickets((prev) => [data.ticket, ...prev]);
      setSubject('');
      setDescription('');
      setScreenshotUrl('');
      pushToast('success', `Ticket ${data.ticket.ticketCode} submitted.`);
    } catch (err) {
      pushToast('error', extractApiError(err, 'Could not submit ticket.'));
    } finally {
      setSubmitting(false);
    }
  };

  const content = (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <a
          href={`https://wa.me/919389426392?text=${encodeURIComponent('Hi STOVRA Support, I need assistance with my storage account.')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/70 dark:bg-emerald-950/30 p-5 flex flex-col justify-between hover:border-emerald-500 transition-colors"
        >
          <div>
            <div className="flex items-center justify-between">
              <MessageCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mb-2" />
              <ArrowUpRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Direct WhatsApp Support</p>
            <p className="text-xs font-mono tabular-nums text-emerald-800 dark:text-emerald-300 mt-1">+91 93894 26392</p>
          </div>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 group-hover:underline">
            Chat on WhatsApp
          </span>
        </a>
        <a
          href="tel:+919389426392"
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-5 hover:border-teal-500/60 transition-colors block"
        >
          <PhoneCall className="w-5 h-5 text-teal-600 mb-2" />
          <p className="text-sm font-semibold text-slate-900 dark:text-white">24/7 Operations Desk</p>
          <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-1">+91 93894 26392</p>
        </a>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-5">
          <Mail className="w-5 h-5 text-teal-600 mb-2" />
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Priority Email Support</p>
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1">care@stovra.in</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-5 flex flex-col justify-between">
          <div>
            <LifeBuoy className="w-5 h-5 text-teal-600 mb-2" />
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Self-Service Knowledge Base</p>
          </div>
          <Link to="/faq" className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline mt-2">
            Browse FAQs & Space Calculator
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form onSubmit={handleSubmit} className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Create Support Ticket or Feedback</h2>
          {!user && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs">
              <Link to="/login" className="font-semibold underline">Sign in</Link> to submit and track tickets in your account.
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Issue Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm"
            >
              <option>Booking Issue</option>
              <option>Payment & Refund</option>
              <option>QR & Gate Access</option>
              <option>Inventory & Damage</option>
              <option>Feedback & Complaint</option>
              <option>Account & Profile</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Subject</label>
            <input
              type="text"
              required
              minLength={4}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of your request"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Description</label>
            <textarea
              rows={4}
              required
              minLength={12}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Include booking ID, unit code, or details..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-medium cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
              <ImagePlus className="w-4 h-4 text-teal-600" />
              <span>{screenshotUrl ? 'Screenshot Attached' : 'Attach Screenshot'}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUploadScreenshot} className="hidden" />
            </label>

            <button
              type="submit"
              disabled={submitting || !user}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1F3A] dark:bg-teal-600 px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? 'Submitting...' : 'Submit Ticket'}</span>
            </button>
          </div>
        </form>

        <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Your Ticket History</h2>
          {tickets.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">No support tickets logged yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 space-y-3">
              {tickets.map((t) => (
                <div key={t.id} className="pt-3 first:pt-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold text-teal-700 dark:text-teal-400">{t.ticketCode}</span>
                    <span className="capitalize font-medium text-slate-600 dark:text-slate-300">{t.status.replace('_', ' ')}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{t.subject}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{t.category} · {new Date(t.createdAt).toLocaleDateString('en-IN')}</p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{t.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (user) {
    return (
      <DashboardShell title="Customer Support" breadcrumb="STOVRA / Help & Support">
        {content}
      </DashboardShell>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#07111E] text-slate-900 dark:text-slate-100">
      <PublicNavbar />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1F3A] dark:text-white mb-6">
          STOVRA Customer Support
        </h1>
        {content}
      </div>
    </div>
  );
}
