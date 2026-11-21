import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Boxes,
  CalendarCheck,
  CreditCard,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Moon,
  QrCode,
  Receipt,
  Settings,
  Sun,
  UserCircle2,
  X,
  PlusCircle,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { PWAInstallButton } from '../common/PWAInstallButton';

interface Props {
  title: string;
  breadcrumb: string;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/storage', label: 'Find Storage', icon: MapPin },
  { to: '/bookings', label: 'My Bookings', icon: CalendarCheck },
  { to: '/inventory', label: 'My Inventory', icon: Boxes },
  { to: '/qr-scanner', label: 'QR Scanner', icon: QrCode },
  { to: '/payments', label: 'Payments', icon: CreditCard },
  { to: '/transactions', label: 'Transactions', icon: Receipt },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/profile', label: 'My Profile', icon: UserCircle2 },
  { to: '/support', label: 'Support', icon: HelpCircle },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export const DashboardShell: React.FC<Props> = ({ title, breadcrumb, children }) => {
  const { user, theme, toggleTheme, logout } = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col justify-between bg-[#0B1F3A] text-slate-100 w-64">
      <div>
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
          <Link to="/" className="font-display text-xl font-bold tracking-tight text-white">
            STOVRA
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 text-slate-300 hover:text-white"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="px-3 py-4 space-y-1 overflow-y-auto max-h-[calc(100vh-190px)]">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-white/10 space-y-3">
        {user && (
          <div className="px-2">
            <p className="text-sm font-medium text-white truncate">{user.fullName}</p>
            <p className="text-xs text-slate-400 truncate">{user.email}</p>
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#07111E] text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block shrink-0 sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-slate-950/60" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 h-full">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0B1F3A]/95 px-4 sm:px-6 py-3 backdrop-blur-xs">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
              aria-label="Open navigation menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{breadcrumb}</p>
              <h1 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white truncate">{title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden sm:block">
              <PWAInstallButton />
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Link
              to="/book"
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Book Storage</span>
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-20 lg:pb-10">
          {children}
        </main>
      </div>
    </div>
  );
};
