import React, { useEffect, useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { store } from '../services/store';
import { Profile } from '../types/database';

export const AppLayout: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<Profile>(store.getCurrentUser());
  const [authChecked, setAuthChecked] = useState<boolean>(false);

  useEffect(() => {
    const syncUser = () => setCurrentUser(store.getCurrentUser());
    const unsubscribe = store.subscribe(syncUser);
    void store
      .loadAuthenticatedUser()
      .catch((error) => {
        console.warn('Auth session sync failed:', error);
      })
      .finally(() => {
        setAuthChecked(true);
      });
    syncUser();
    return unsubscribe;
  }, []);

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  const isAuthenticated = currentUser && currentUser.id !== 'guest' && currentUser.active === true;

  // While restoring session on first load
  if (!authChecked && (!currentUser || currentUser.id === 'guest')) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-semibold text-slate-300 tracking-wider">
            Đang xác thực hệ thống...
          </span>
        </div>
      </div>
    );
  }

  // If unauthenticated after checking, immediately route to the login screen
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      {/* Dynamic Collapsible Sidebar - Displayed for authenticated users */}
      <Sidebar currentUser={currentUser} isCollapsed={sidebarCollapsed} onToggle={toggleSidebar} />

      {/* Main Content Area - Maximized Full-Width Presentation */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          currentUser={currentUser}
          isSidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebar}
        />

        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 flex flex-col justify-between">
          <div className="w-full space-y-6 flex-1">
            <Outlet context={{ currentUser }} />
          </div>

          <footer className="w-full pt-6 pb-2 text-right">
            <p className="text-[11px] font-medium text-slate-400 select-none tracking-wide">
              @2026 Design by Lê Hồng Sơn
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
};
