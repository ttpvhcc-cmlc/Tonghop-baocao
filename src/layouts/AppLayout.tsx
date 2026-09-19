import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { store } from '../services/store';
import { UserRole, Profile } from '../types/database';

export const AppLayout: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<Profile>(store.getCurrentUser());

  const handleRoleChange = (role: UserRole) => {
    const updated = store.switchUserRole(role);
    setCurrentUser(updated);
  };

  const handleResetData = () => {
    store.resetToFactoryDemo();
    setCurrentUser(store.getCurrentUser());
    window.location.reload();
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      {/* Fixed Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          currentUser={currentUser}
          onUserRoleChange={handleRoleChange}
          onResetData={handleResetData}
        />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <Outlet context={{ currentUser }} />
          </div>
        </main>
      </div>
    </div>
  );
};
