import React from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';

export const PublicNavbar: React.FC = () => {
  const user = useAppStore((s) => s.user);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#07111E]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 py-3.5">
        {/* Zone 1: Single text element wordmark */}
        <Link
          to="/"
          className="font-display text-xl font-bold tracking-tight text-[#0B1F3A] dark:text-white whitespace-nowrap shrink-0"
        >
          STOVRA
        </Link>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300">
          <Link to="/storage" className="hover:text-[#0B1F3A] dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
            Find Storage
          </Link>
          <Link to="/faq" className="hover:text-[#0B1F3A] dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
            Space Calculator
          </Link>
          <Link to="/qr-scanner" className="hover:text-[#0B1F3A] dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
            QR Access
          </Link>
          <Link to="/support" className="hover:text-[#0B1F3A] dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
            Support
          </Link>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <Link
            to={user ? '/dashboard' : '/login'}
            className="rounded-lg bg-[#0B1F3A] dark:bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-[#143159] dark:hover:bg-teal-500 transition-colors whitespace-nowrap shrink-0"
          >
            {user ? 'Open Dashboard' : 'Sign In'}
          </Link>
        </div>
      </div>
    </header>
  );
};
