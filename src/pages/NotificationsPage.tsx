import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { extractApiError, notificationsApi } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import type { AppNotification } from '../types';
import { DashboardShell } from '../components/layout/DashboardShell';

export default function NotificationsPage() {
  const pushToast = useAppStore((s) => s.pushToast);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await notificationsApi.list();
      setItems(data.notifications);
    } catch (err) {
      pushToast('error', extractApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markRead = async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    } catch {
      // ignore
    }
  };

  const markAll = async () => {
    try {
      await notificationsApi.markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
      pushToast('success', 'All notifications marked as read.');
    } catch (err) {
      pushToast('error', extractApiError(err));
    }
  };

  const filtered = items.filter((n) => filter === 'all' || n.type === filter);

  return (
    <DashboardShell title="Notifications" breadcrumb="STOVRA / Alerts">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900">
            {['all', 'booking', 'payment', 'expiry', 'inventory', 'extension'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${
                  filter === t ? 'bg-white dark:bg-[#0D1B2E] text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={markAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <CheckCheck className="w-4 h-4 text-teal-600" />
            <span>Mark All Read</span>
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? (
            <div className="p-8 h-48 animate-pulse" />
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <Bell className="w-7 h-7 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold">No notifications in this category</p>
            </div>
          ) : (
            filtered.map((n) => (
              <div
                key={n.id}
                onClick={() => !n.readAt && markRead(n.id)}
                className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                  !n.readAt ? 'bg-teal-50/40 dark:bg-teal-950/20' : ''
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="capitalize font-semibold text-teal-700 dark:text-teal-400">{n.type}</span>
                    <span>·</span>
                    <span className="font-mono">{new Date(n.createdAt).toLocaleString('en-IN')}</span>
                    {!n.readAt && <span className="font-semibold text-teal-600">· Unread</span>}
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{n.title}</p>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{n.message}</p>
                </div>
                {n.link && (
                  <Link
                    to={n.link}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0 self-start sm:self-center"
                  >
                    Open
                  </Link>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
