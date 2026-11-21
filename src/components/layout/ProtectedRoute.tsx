import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, sessionChecked } = useAppStore();
  const location = useLocation();

  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#07111E]">
        <div className="space-y-3 text-center">
          <div className="w-8 h-8 rounded-full border-2 border-teal-600 border-t-transparent animate-spin mx-auto" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Verifying your STOVRA session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
};
