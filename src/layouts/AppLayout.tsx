import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { store } from '../services/store';
import { Profile } from '../types/database';

export const AppLayout: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<Profile>(store.getCurrentUser());
  useEffect(() => {
    const syncUser = () => setCurrentUser(store.getCurrentUser());
    const unsubscribe = store.subscribe(syncUser);
    void store.loadAuthenticatedUser().catch((error) => {
      console.warn('Auth session sync failed:', error);
    });
    syncUser();
    return unsubscribe;
  }, []);

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      {/* Dynamic Collapsible Sidebar */}
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={toggleSidebar} />

      {/* Main Content Area - Maximized Full-Width Presentation */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          currentUser={currentUser}
          isSidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebar}
        />

        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6">
          <div className="w-full space-y-6">
            <Outlet context={{ currentUser }} />
          </div>
        </main>
      </div>
    </div>
  );
};
