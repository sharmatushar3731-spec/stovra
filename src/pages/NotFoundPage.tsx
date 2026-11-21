import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PublicNavbar } from '../components/layout/PublicNavbar';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#07111E] text-slate-900 dark:text-slate-100">
      <PublicNavbar />
      <div className="mx-auto max-w-lg px-4 py-24 text-center space-y-4">
        <p className="font-mono text-sm font-semibold text-teal-600">404</p>
        <h1 className="font-display text-3xl font-bold text-[#0B1F3A] dark:text-white">
          Page not found
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          The storage route or booking resource you requested could not be found.
        </p>
        <div className="pt-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg bg-[#0B1F3A] dark:bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
