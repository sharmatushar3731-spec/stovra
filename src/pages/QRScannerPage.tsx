import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, CheckCircle2, LogIn, LogOut, QrCode, ShieldAlert } from 'lucide-react';
import { extractApiError, qrApi } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import type { InventoryLog } from '../types';
import { DashboardShell } from '../components/layout/DashboardShell';

export default function QRScannerPage() {
  const pushToast = useAppStore((s) => s.pushToast);
  const [manualCode, setManualCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    authorized: boolean;
    entityType: 'item' | 'booking';
    entity: Record<string, unknown>;
    logs: InventoryLog[];
  } | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);

  const verifyToken = async (token: string, action: 'verify' | 'check_in' | 'check_out' = 'verify') => {
    setError('');
    setVerifying(true);
    try {
      const { data } = await qrApi.verify(token.trim(), action);
      setResult(data);
      setManualCode(token.trim());
      if (action !== 'verify') {
        pushToast('success', `Recorded ${action.replace('_', ' ')} successfully.`);
      }
    } catch (err) {
      setResult(null);
      setError(extractApiError(err, 'QR verification failed.'));
    } finally {
      setVerifying(false);
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        // ignore stop errors
      }
      scannerRef.current = null;
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    setError('');
    try {
      const instance = new Html5Qrcode('stovra-qr-reader');
      scannerRef.current = instance;
      setCameraActive(true);
      await instance.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 230, height: 230 } },
        (decodedText) => {
          stopCamera();
          verifyToken(decodedText, 'verify');
        },
        () => {
          // ignore per-frame scan miss
        }
      );
    } catch {
      setCameraActive(false);
      setError('Camera permission denied or no camera device detected. Use manual QR token verification below.');
    }
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => undefined);
      }
    };
  }, []);

  return (
    <DashboardShell title="QR Scanner & Verification" breadcrumb="STOVRA / Security / QR Verify">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Scanner & Manual Input */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Device Camera Scanner</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Every scan validates cryptographic HMAC signatures & account ownership on the server.
              </p>
            </div>
            {cameraActive ? (
              <button
                type="button"
                onClick={stopCamera}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white"
              >
                <CameraOff className="w-4 h-4" />
                <span>Stop Camera</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={startCamera}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1F3A] dark:bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white"
              >
                <Camera className="w-4 h-4" />
                <span>Start Camera</span>
              </button>
            )}
          </div>

          <div
            id="stovra-qr-reader"
            className="w-full min-h-[240px] rounded-xl overflow-hidden border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-center"
          >
            {!cameraActive && (
              <div className="text-center p-6 text-slate-400">
                <QrCode className="w-10 h-10 mx-auto mb-2 text-teal-600/70" />
                <p className="text-xs">Click &quot;Start Camera&quot; to scan an item or booking QR sticker</p>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              verifyToken(manualCode, 'verify');
            }}
            className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3"
          >
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Or Enter QR Token / Item Code / Booking Code
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="e.g. STV-IT-... or ITM-A1B2C3 or STV-2026-..."
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-mono"
              />
              <button
                type="submit"
                disabled={verifying}
                className="rounded-lg bg-teal-600 hover:bg-teal-700 px-4 py-2 text-xs font-semibold text-white"
              >
                {verifying ? 'Checking...' : 'Verify'}
              </button>
            </div>
          </form>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-3.5 text-xs text-rose-700 dark:text-rose-300">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Verification Output */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6">
          {!result ? (
            <div className="py-16 text-center space-y-2">
              <QrCode className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Awaiting QR Verification</p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Scan a printed STOVRA sticker or paste an item/booking code to verify access authorization and log movements.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center gap-2.5 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-semibold">
                  Authorized {result.entityType === 'item' ? 'Inventory Item' : 'Storage Unit Pass'}
                </span>
              </div>

              {result.entityType === 'item' ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-2 text-xs">
                    <p className="text-base font-bold text-slate-900 dark:text-white">{String(result.entity.name)}</p>
                    <p className="font-mono text-teal-700 dark:text-teal-400">{String(result.entity.itemCode)}</p>
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <span>Category: <strong>{String(result.entity.category)}</strong></span>
                      <span>Qty: <strong className="font-mono">{String(result.entity.quantity)}</strong></span>
                      <span>Facility: <strong>{String(result.entity.facilityName)}</strong></span>
                      <span>Unit: <strong className="font-mono">{String(result.entity.unitCode)}</strong></span>
                      <span>Status: <strong className="capitalize">{String(result.entity.movementStatus).replace('_', ' ')}</strong></span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => verifyToken(String(result.entity.qrToken), 'check_in')}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 py-2.5 text-xs font-semibold text-white"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Check In to Storage</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => verifyToken(String(result.entity.qrToken), 'check_out')}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0B1F3A] dark:bg-slate-700 hover:opacity-95 py-2.5 text-xs font-semibold text-white"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Check Out Item</span>
                    </button>
                  </div>

                  {result.logs.length > 0 && (
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                      <p className="text-xs font-semibold text-slate-500 mb-2">Recent Scan Trail</p>
                      <ul className="space-y-2 text-xs">
                        {result.logs.map((l) => (
                          <li key={l.id} className="flex justify-between">
                            <span className="capitalize font-medium">{l.action.replace('_', ' ')} · {l.locationNote}</span>
                            <span className="font-mono text-slate-400">{new Date(l.timestamp).toLocaleString('en-IN')}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-2 text-xs">
                    <p className="text-base font-bold text-slate-900 dark:text-white">{String(result.entity.facilityName)}</p>
                    <p className="font-mono text-teal-700 dark:text-teal-400">{String(result.entity.bookingCode)} · Unit {String(result.entity.unitCode)}</p>
                    <p>Period: <span className="font-mono">{String(result.entity.checkInDate)} → {String(result.entity.checkOutDate)}</span></p>
                    <p>Status: <strong className="capitalize">{String(result.entity.bookingStatus)}</strong></p>
                  </div>

                  <button
                    type="button"
                    onClick={() => verifyToken(String(result.entity.qrToken), 'check_in')}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 py-2.5 text-xs font-semibold text-white"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Activate Unit Check-In</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
