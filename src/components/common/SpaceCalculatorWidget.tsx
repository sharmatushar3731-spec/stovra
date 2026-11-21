import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calculator, Plus, Trash2, Sparkles, ArrowRight } from 'lucide-react';
import { aiApi, extractApiError } from '../../services/api';

interface CalcItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  lengthFt?: number;
  widthFt?: number;
  heightFt?: number;
}

const CATEGORIES = [
  'Furniture',
  'Electronics',
  'Documents',
  'Household goods',
  'Business inventory',
  'Clothing',
  'Other',
];

export const SpaceCalculatorWidget: React.FC<{ defaultCity?: string }> = ({ defaultCity = 'All' }) => {
  const [items, setItems] = useState<CalcItem[]>([
    { id: '1', name: '3-Seater Sofa', category: 'Furniture', quantity: 1, lengthFt: 7, widthFt: 3, heightFt: 3 },
    { id: '2', name: 'Medium Moving Cartons', category: 'Household goods', quantity: 8, lengthFt: 1.5, widthFt: 1.5, heightFt: 1.5 },
  ]);
  const [city, setCity] = useState(defaultCity);
  const [climateSensitive, setClimateSensitive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    engine: 'gemini' | 'rule_based';
    recommendedSqft: number;
    totalCubicFt: number;
    recommendedTier: string;
    packingGuidance: string;
    recommendedUnits: Array<{
      unitId: string;
      unitCode: string;
      sizeLabel: string;
      areaSqft: number;
      monthlyRate: number;
      facilityId: string;
      facilityName: string;
      city: string;
      locality: string;
      climateControlled: boolean;
    }>;
  } | null>(null);

  const [priceEstimate, setPriceEstimate] = useState<{
    sevenDays: { total: number };
    oneMonth: { total: number };
    threeMonths: { total: number };
    sixMonthsWithPromo: { total: number };
  } | null>(null);

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: String(Date.now()), name: '', category: 'Household goods', quantity: 1 },
    ]);
  };

  const updateItem = (id: string, patch: Partial<CalcItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanItems = items.filter((it) => it.name.trim().length > 0);
    if (cleanItems.length === 0) {
      setError('Enter at least one item name.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await aiApi.spaceCalculator({
        items: cleanItems.map(({ name, category, quantity, lengthFt, widthFt, heightFt }) => ({
          name,
          category,
          quantity: Number(quantity) || 1,
          lengthFt: lengthFt ? Number(lengthFt) : undefined,
          widthFt: widthFt ? Number(widthFt) : undefined,
          heightFt: heightFt ? Number(heightFt) : undefined,
        })),
        city,
        climateSensitive,
      });
      setResult(data);

      const estRes = await aiApi.priceEstimator({
        areaSqft: data.recommendedSqft,
        city,
        climateControlled: climateSensitive,
      });
      setPriceEstimate(estRes.data.estimates);
    } catch (err) {
      setError(extractApiError(err, 'Could not calculate space recommendation.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Calculator className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <span>Smart Space Calculator & Price Estimator</span>
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Add your items or dimensions to compute exact square footage and match live units.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            aria-label="Target city"
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-200"
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
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={climateSensitive}
              onChange={(e) => setClimateSensitive(e.target.checked)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <span>Climate control</span>
          </label>
        </div>
      </div>

      <form onSubmit={handleCalculate} className="mt-5 space-y-3">
        {items.map((item) => (
          <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
            <input
              type="text"
              value={item.name}
              onChange={(e) => updateItem(item.id, { name: e.target.value })}
              placeholder="Item name (e.g., Queen Bed, Archive Boxes)"
              className="col-span-12 sm:col-span-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            />
            <select
              value={item.category}
              onChange={(e) => updateItem(item.id, { category: e.target.value })}
              className="col-span-6 sm:col-span-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={200}
              value={item.quantity}
              onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) })}
              title="Quantity"
              className="col-span-3 sm:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100"
            />
            <input
              type="number"
              step="0.5"
              min={0.5}
              max={30}
              placeholder="L (ft)"
              value={item.lengthFt ?? ''}
              onChange={(e) => updateItem(item.id, { lengthFt: e.target.value ? Number(e.target.value) : undefined })}
              className="col-span-3 sm:col-span-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100"
            />
            <input
              type="number"
              step="0.5"
              min={0.5}
              max={30}
              placeholder="W (ft)"
              value={item.widthFt ?? ''}
              onChange={(e) => updateItem(item.id, { widthFt: e.target.value ? Number(e.target.value) : undefined })}
              className="col-span-3 sm:col-span-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              disabled={items.length <= 1}
              className="col-span-3 sm:col-span-1 flex items-center justify-center p-2 text-slate-400 hover:text-rose-600 disabled:opacity-30"
              aria-label="Remove item row"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Item</span>
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0B1F3A] dark:bg-teal-600 hover:opacity-95 disabled:opacity-60 px-5 py-2.5 text-sm font-medium text-white transition-opacity"
          >
            <Sparkles className="w-4 h-4" />
            <span>{loading ? 'Calculating...' : 'Calculate Required Space'}</span>
          </button>
        </div>
      </form>

      {result && (
        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Recommended Footprint</p>
              <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {result.recommendedSqft} sq.ft
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {result.totalCubicFt} cu.ft total volume
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4 md:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-teal-700 dark:text-teal-400">
                  Suggested Tier · {result.recommendedTier}
                </p>
                <span className="text-[11px] text-slate-400">
                  {result.engine === 'gemini' ? 'Gemini Space Advisor' : 'Volumetric Engine'}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {result.packingGuidance}
              </p>
            </div>
          </div>

          {priceEstimate && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: '7-Day Short Stay', value: priceEstimate.sevenDays.total },
                { label: '1 Month (incl. GST)', value: priceEstimate.oneMonth.total },
                { label: '3 Months (incl. GST)', value: priceEstimate.threeMonths.total },
                { label: '6 Months + STOVRA15', value: priceEstimate.sixMonthsWithPromo.total },
              ].map((est) => (
                <div key={est.label} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{est.label}</p>
                  <p className="mt-1 text-base font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
                    ₹{est.value.toLocaleString('en-IN')}
                  </p>
                </div>
              ))}
            </div>
          )}

          {result.recommendedUnits.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">
                Best Matching Available Units
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {result.recommendedUnits.map((u) => (
                  <Link
                    key={u.unitId}
                    to={`/book/${u.facilityId}?unitId=${u.unitId}`}
                    className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 hover:border-teal-500 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{u.facilityName}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {u.sizeLabel} · {u.city} · Unit {u.unitCode}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold font-mono tabular-nums text-teal-700 dark:text-teal-400">
                        ₹{u.monthlyRate.toLocaleString('en-IN')}/mo
                      </p>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        Book <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
