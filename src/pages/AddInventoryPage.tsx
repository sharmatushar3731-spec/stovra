import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ImagePlus, Sparkles, Trash2 } from 'lucide-react';
import { aiApi, bookingsApi, extractApiError, inventoryApi } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import type { Booking } from '../types';
import { DashboardShell } from '../components/layout/DashboardShell';

const schema = z.object({
  name: z.string().min(2, 'Enter item name'),
  category: z.enum(['Furniture', 'Electronics', 'Documents', 'Household goods', 'Business inventory', 'Clothing', 'Other']),
  description: z.string().max(500).optional(),
  quantity: z.number().int().min(1).max(1000),
  estimatedValue: z.number().min(0).max(100000000),
  dimensions: z.string().max(80).optional(),
  bookingId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function AddInventoryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pushToast = useAppStore((s) => s.pushToast);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [aiTip, setAiTip] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: 'Household goods',
      quantity: 1,
      estimatedValue: 5000,
      bookingId: searchParams.get('bookingId') || '',
    },
  });

  useEffect(() => {
    bookingsApi
      .list()
      .then((res) => {
        setBookings(res.data.bookings.filter((b) => ['pending', 'confirmed', 'active'].includes(b.bookingStatus)));
      })
      .catch(() => setBookings([]));
  }, []);

  const handleAiAssist = async () => {
    const itemName = watch('name');
    if (!itemName || itemName.trim().length < 2) {
      pushToast('info', 'Enter an item name first for the AI Inventory Assistant.');
      return;
    }
    setAiLoading(true);
    try {
      const { data } = await aiApi.inventoryAssistant({
        itemName,
        description: watch('description'),
      });
      setValue('category', data.suggestedCategory as FormValues['category']);
      setAiTip(`${data.packingTip}${data.needsClimateControl ? ' (Climate-controlled vault recommended.)' : ''}`);
      pushToast('success', `Categorized as ${data.suggestedCategory}`);
    } catch (err) {
      pushToast('error', extractApiError(err));
    } finally {
      setAiLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const { data } = await inventoryApi.uploadImage(reader.result as string);
        setImages((prev) => [...prev, data.url]);
      } catch (err) {
        pushToast('error', extractApiError(err, 'Image upload failed.'));
      }
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (values: FormValues) => {
    try {
      await inventoryApi.create({
        ...values,
        bookingId: values.bookingId || null,
        images,
      });
      pushToast('success', 'Item logged with unique QR code!');
      navigate('/inventory');
    } catch (err) {
      pushToast('error', extractApiError(err, 'Failed to save item.'));
    }
  };

  return (
    <DashboardShell title="Add Inventory Item" breadcrumb="STOVRA / Smart Inventory / Add Item">
      <div className="max-w-2xl mx-auto space-y-6">
        <Link to="/inventory" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-teal-600">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to My Inventory</span>
        </Link>

        <form onSubmit={handleSubmit(onSubmit)} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1B2E] p-6 sm:p-8 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Item Details & QR Registration</h2>
            <button
              type="button"
              onClick={handleAiAssist}
              disabled={aiLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-teal-500/40 bg-teal-50 dark:bg-teal-950/40 px-3 py-1.5 text-xs font-semibold text-teal-800 dark:text-teal-300"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{aiLoading ? 'Analyzing...' : 'AI Categorize & Packing Tip'}</span>
            </button>
          </div>

          {aiTip && (
            <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/30 p-3.5 text-xs text-teal-900 dark:text-teal-200">
              <strong>AI Packing Recommendation:</strong> {aiTip}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Item Name</label>
              <input
                type="text"
                {...register('name')}
                placeholder="e.g., Dell 27-inch Studio Monitor Box"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm"
              />
              {errors.name && <p className="mt-1 text-xs text-rose-600">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
              <select
                {...register('category')}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm"
              >
                <option value="Furniture">Furniture</option>
                <option value="Electronics">Electronics</option>
                <option value="Documents">Documents</option>
                <option value="Household goods">Household goods</option>
                <option value="Business inventory">Business inventory</option>
                <option value="Clothing">Clothing</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Assigned Booking / Unit</label>
              <select
                {...register('bookingId')}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm"
              >
                <option value="">Personal / Assign Later</option>
                {bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.facilityName} · Unit {b.unitCode} ({b.bookingCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Quantity</label>
              <input
                type="number"
                min={1}
                {...register('quantity', { valueAsNumber: true })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Estimated Value (₹ INR)</label>
              <input
                type="number"
                min={0}
                {...register('estimatedValue', { valueAsNumber: true })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Dimensions (Optional)</label>
              <input
                type="text"
                {...register('dimensions')}
                placeholder="e.g., 24 x 18 x 16 inches"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Description / Packing Notes</label>
              <textarea
                rows={3}
                {...register('description')}
                placeholder="Contents, serial numbers, fragile handling notes..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">Photos</label>
              <div className="flex flex-wrap gap-3">
                {images.map((url, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                    <img src={url} alt={`Item preview ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 rounded-full bg-slate-900/75 p-1 text-white"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {images.length < 4 && (
                  <label className="flex flex-col items-center justify-center w-20 h-20 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:border-teal-500 cursor-pointer">
                    <ImagePlus className="w-5 h-5" />
                    <span className="text-[10px] mt-1">Upload</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} className="hidden" />
                  </label>
                )}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-[#0B1F3A] dark:bg-teal-600 py-3 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
          >
            {isSubmitting ? 'Generating QR & Saving...' : 'Save Item & Generate QR Label'}
          </button>
        </form>
      </div>
    </DashboardShell>
  );
}
