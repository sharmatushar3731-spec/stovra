import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Navigation, ArrowRight } from 'lucide-react';
import type { StorageFacility } from '../../types';

interface Props {
  facilities: StorageFacility[];
  userCoords: { lat: number; lng: number } | null;
}

// Projects India lat/lng bounds cleanly onto a 1000x560 canvas
function projectCoords(lat: number, lng: number) {
  const minLat = 10.5;
  const maxLat = 30.8;
  const minLng = 70.0;
  const maxLng = 84.0;
  const x = ((lng - minLng) / (maxLng - minLng)) * 840 + 80;
  const y = 500 - ((lat - minLat) / (maxLat - minLat)) * 420;
  return {
    x: Math.max(40, Math.min(960, x)),
    y: Math.max(40, Math.min(520, y)),
  };
}

function getLabelPlacement(city: string, active: boolean) {
  const lower = city.toLowerCase();
  if (lower === 'meerut') {
    return { dx: 0, dy: active ? -24 : -19, textAnchor: 'middle' as const };
  }
  if (lower === 'delhi ncr') {
    return { dx: active ? -22 : -18, dy: 4, textAnchor: 'end' as const };
  }
  if (lower === 'noida') {
    return { dx: active ? 22 : 18, dy: 4, textAnchor: 'start' as const };
  }
  return { dx: 0, dy: active ? 32 : 27, textAnchor: 'middle' as const };
}

export const FacilityMap: React.FC<Props> = ({ facilities, userCoords }) => {
  const [selectedId, setSelectedId] = useState<string>(facilities[0]?.id || '');
  const selected = facilities.find((f) => f.id === selectedId) || facilities[0];

  const userPoint = userCoords ? projectCoords(userCoords.lat, userCoords.lng) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-4">
      <div className="lg:col-span-2 relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#081526] min-h-[380px]">
        <svg viewBox="0 0 1000 560" className="w-full h-full object-cover" role="img" aria-label="Interactive STOVRA India facility map">
          <defs>
            <pattern id="stovra-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="1000" height="560" fill="url(#stovra-grid)" className="text-slate-500 dark:text-slate-400" />

          {/* Subtle stylized India corridor outline */}
          <path
            d="M420,85 L540,75 L640,145 L745,195 L645,275 L555,390 L470,495 L410,435 L355,340 L310,245 L335,165 Z"
            fill="currentColor"
            fillOpacity="0.06"
            stroke="currentColor"
            strokeOpacity="0.22"
            strokeWidth="2"
            className="text-slate-700 dark:text-teal-400"
          />

          {/* City corridor arcs */}
          <path d="M 540 120 Q 430 245 360 315 T 490 435" fill="none" stroke="#14B8A6" strokeOpacity="0.25" strokeDasharray="6 6" strokeWidth="2" />
          <path d="M 540 120 Q 615 145 735 162" fill="none" stroke="#14B8A6" strokeOpacity="0.25" strokeDasharray="6 6" strokeWidth="2" />

          {userPoint && (
            <g transform={`translate(${userPoint.x}, ${userPoint.y})`}>
              <circle r="14" fill="#0D9488" fillOpacity="0.2" />
              <circle r="6" fill="#0D9488" stroke="#FFFFFF" strokeWidth="2" />
              <text y="-14" textAnchor="middle" className="text-[11px] font-semibold fill-teal-700 dark:fill-teal-300">
                Your Location
              </text>
            </g>
          )}

          {facilities.map((fac) => {
            const pt = projectCoords(fac.lat, fac.lng);
            const active = fac.id === selected?.id;
            const labelPos = getLabelPlacement(fac.city, active);
            return (
              <g
                key={fac.id}
                transform={`translate(${pt.x}, ${pt.y})`}
                onClick={() => setSelectedId(fac.id)}
                className="cursor-pointer"
              >
                <circle
                  r={active ? 18 : 13}
                  fill={active ? '#0D9488' : '#0B1F3A'}
                  stroke="#FFFFFF"
                  strokeWidth="2.5"
                />
                <text
                  y="4"
                  textAnchor="middle"
                  className="text-[10px] font-mono font-semibold fill-white pointer-events-none"
                >
                  {fac.availableUnits}
                </text>
                <text
                  x={labelPos.dx}
                  y={labelPos.dy}
                  textAnchor={labelPos.textAnchor}
                  className="text-[11px] font-semibold fill-slate-800 dark:fill-slate-200 pointer-events-none"
                >
                  {fac.city}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="absolute top-3 left-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-[#0B1F3A]/90 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 backdrop-blur-xs flex items-center gap-2">
          <Navigation className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <span>{facilities.length} active smart hubs · Click any pin to inspect</span>
        </div>
      </div>

      <div className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4">
        {selected ? (
          <>
            <div>
              <img
                src={selected.imageUrl}
                alt={selected.name}
                referrerPolicy="no-referrer"
                className="w-full h-40 object-cover rounded-lg mb-4"
              />
              <p className="text-xs text-teal-700 dark:text-teal-400 font-medium">
                {selected.city} · {selected.pincode}
              </p>
              <h4 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">{selected.name}</h4>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{selected.address}</span>
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs border-t border-slate-200 dark:border-slate-800 pt-3">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Monthly from</span>
                  <p className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white mt-0.5">
                    ₹{selected.baseMonthlyRate.toLocaleString('en-IN')}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Available units</span>
                  <p className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white mt-0.5">
                    {selected.availableUnits} / {selected.totalUnits}
                  </p>
                </div>
              </div>
              {selected.distanceKm !== null && (
                <p className="mt-2 text-xs font-mono text-teal-700 dark:text-teal-400">
                  {selected.distanceKm} km from your current GPS location
                </p>
              )}
            </div>

            <div className="mt-5 flex items-center gap-2">
              <Link
                to={`/storage/${selected.id}`}
                className="flex-1 text-center rounded-lg border border-slate-300 dark:border-slate-700 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800"
              >
                Inspect Units
              </Link>
              <Link
                to={`/book/${selected.id}`}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-[#0B1F3A] dark:bg-teal-600 py-2 text-xs font-medium text-white hover:opacity-95"
              >
                <span>Book</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">No facilities match your current filters.</p>
        )}
      </div>
    </div>
  );
};
