import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightLeft, History, PlusCircle, QrCode, Search, Trash2, X } from 'lucide-react';
import { bookingsApi, extractApiError, inventoryApi } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import type { Booking, InventoryItem, InventoryLog } from '../types';
import { DashboardShell } from '../components/layout/DashboardShell';
import { QRCodeDisplay } from '../components/common/QRCodeDisplay';

const CATEGORIES = [
  'All',
  'Furniture',
  'Electronics',
  'Documents',
  'Household goods',
  'Business inventory',
  'Clothing',
  'Other',
];

export default function MyInventoryPage() {
  const pushToast = useAppStore((s) => s.pushToast);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(true);

  const [qrItem, setQrItem] = useState<InventoryItem | null>(null);
  const [moveItem, setMoveItem] = useState<InventoryItem | null>(null);
  const [targetBookingId, setTargetBookingId] = useState('');
  const [logsItem, setLogsItem] = useState<InventoryItem | null>(null);
  const [logs, setLogs] = useState<InventoryLog[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, bkRes] = await Promise.all([
        inventoryApi.list({ q: q || undefined, category: category !== 'All' ? category : undefined }),
        bookingsApi.list(),
      ]);
      setItems(invRes.data.items);
      setBookings(bkRes.data.bookings.filter((b) => ['pending', 'confirmed', 'active'].includes(b.bookingStatus)));
    } catch (err) {
      pushToast('error', extractApiError(err, 'Failed to load inventory.'));
    } finally {
      setLoading(false);
    }
  }, [q, category, pushToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (item: InventoryItem) => {
    try {
      await inventoryApi.remove(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      pushToast('success', `${item.name} removed from inventory.`);
    } catch (err) {
      pushToast('error', extractApiError(err));
    }
  };

  const handleMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveItem || !targetBookingId) return;
    try {
      const { data } = await inventoryApi.move(moveItem.id, targetBookingId);
      setItems((prev) => prev.map((i) => (i.id === data.item.id ? data.item : i)));
      setMoveItem(null);
      pushToast('success', `Moved ${data.item.name} to ${data.item.facilityName}.`);
    } catch (err) {
      pushToast('error', extractApiError(err));
    }
  };

  const openLogs = async (item: InventoryItem) => {
    setLogsItem(item);
    try {
      const { data } = await inventoryApi.logs(item.id);
      setLogs(data.logs);
    } catch (err) {
      pushToast('error', extractApiError(err));
    }
  };

  return (
    <DashboardShell title="My Inventory" breadcrumb="STOVRA / Smart Inventory">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search items by name, item ID, or facility..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D1B2E] pl-10 pr-4 py-2.5 text-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/qr-scanner"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <QrCode className="w-4 h-4 text-teal-600" />
              <span>Scan Item QR</span>
            </Link>
            <Link
              to="/inventory/add"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1F3A] dark:bg-teal-600 px-4 py-2 text-xs font-semibold text-white"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Stored Item</span>
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                category === c
                  ? 'bg-[#0B1F3A] dark:bg-teal-600 text-white'
                  : 'bg-white dark:bg-[#0D1B2E] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="h-64 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] animate-pulse" />
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-12 text-center space-y-3">
            <p className="text-base font-semibold text-slate-900 dark:text-white">No inventory items logged</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Add items to generate unique QR tracking stickers and insured valuation records.
            </p>
            <Link
              to="/inventory/add"
              className="inline-block rounded-lg bg-[#0B1F3A] dark:bg-teal-600 px-4 py-2 text-xs font-semibold text-white"
            >
              Log First Item
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-xs text-slate-500">
                    <th className="py-3 px-4">Item & ID</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Storage Location</th>
                    <th className="py-3 px-4 text-right">Qty</th>
                    <th className="py-3 px-4 text-right">Est. Value</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {item.images[0] && (
                            <img src={item.images[0]} alt={item.name} className="w-10 h-10 rounded-lg object-cover shrink-0 border border-slate-200 dark:border-slate-700" />
                          )}
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">{item.name}</p>
                            <p className="font-mono text-xs text-teal-700 dark:text-teal-400">{item.itemCode}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300">{item.category}</td>
                      <td className="py-3.5 px-4 text-xs">
                        <p className="font-medium text-slate-900 dark:text-white">{item.facilityName}</p>
                        <p className="text-slate-500 font-mono">{item.unitCode ? `Unit ${item.unitCode}` : 'Personal'}</p>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs">{item.quantity}</td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs font-semibold">
                        ₹{item.estimatedValue.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 text-xs capitalize">
                        <span className={item.movementStatus === 'in_storage' ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-amber-600 font-medium'}>
                          {item.movementStatus.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setQrItem(item)}
                            title="Show QR Pass"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <QrCode className="w-3.5 h-3.5 text-teal-600" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openLogs(item)}
                            title="Check-in/out History"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMoveItem(item);
                              setTargetBookingId(bookings[0]?.id || '');
                            }}
                            title="Move to another unit"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            title="Delete item"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* QR Modal */}
      {qrItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6 text-center">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">{qrItem.name}</h3>
              <button type="button" onClick={() => setQrItem(null)}><X className="w-4 h-4" /></button>
            </div>
            <QRCodeDisplay value={qrItem.qrToken} label={qrItem.itemCode} size={180} />
          </div>
        </div>
      )}

      {/* Move Unit Modal */}
      {moveItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4">
          <form onSubmit={handleMove} className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Move {moveItem.name}</h3>
              <button type="button" onClick={() => setMoveItem(null)}><X className="w-4 h-4" /></button>
            </div>
            {bookings.length === 0 ? (
              <p className="text-sm text-slate-500">You have no active or confirmed bookings to move this item to.</p>
            ) : (
              <>
                <select
                  value={targetBookingId}
                  onChange={(e) => setTargetBookingId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                >
                  {bookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.facilityName} · Unit {b.unitCode} ({b.bookingCode})
                    </option>
                  ))}
                </select>
                <button type="submit" className="w-full rounded-lg bg-[#0B1F3A] dark:bg-teal-600 py-2 text-sm font-semibold text-white">
                  Confirm Transfer
                </button>
              </>
            )}
          </form>
        </div>
      )}

      {/* Audit Logs Modal */}
      {logsItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Movement History · {logsItem.itemCode}</h3>
              <button type="button" onClick={() => setLogsItem(null)}><X className="w-4 h-4" /></button>
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-xs max-h-72 overflow-y-auto">
              {logs.map((l) => (
                <li key={l.id} className="py-2.5 flex justify-between gap-2">
                  <div>
                    <p className="font-semibold capitalize">{l.action.replace('_', ' ')}</p>
                    <p className="text-slate-500">{l.locationNote}</p>
                  </div>
                  <span className="font-mono text-slate-400">{new Date(l.timestamp).toLocaleString('en-IN')}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
