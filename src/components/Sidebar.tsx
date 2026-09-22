import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { store, SystemConfig } from '../services/store';
import { Profile, UserRole } from '../types/database';
import { supabase } from '../lib/supabase';
import {
  LayoutDashboard,
  FileText,
  FilePlus,
  UploadCloud,
  BarChart3,
  Building2,
  FolderKanban,
  GitCompare,
  SlidersHorizontal,
  Users,
  History,
  ChevronDown,
  Database,
  Archive,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  UserCheck,
} from 'lucide-react';

interface SidebarProps {
  currentUser?: Profile;
  isCollapsed: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentUser: propCurrentUser, isCollapsed, onToggle }) => {
  const location = useLocation();
  const [config, setConfig] = useState<SystemConfig>(store.getSystemConfig());
  const [analysisOpen, setAnalysisOpen] = useState(true);
  const [catalogOpen, setCatalogOpen] = useState(true);
  const [showAuthMenu, setShowAuthMenu] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeUser, setActiveUser] = useState<Profile>(propCurrentUser || store.getCurrentUser());

  useEffect(() => {
    const refresh = () => {
      setConfig(store.getSystemConfig());
      setActiveUser(propCurrentUser || store.getCurrentUser());
    };
    refresh();
    return store.subscribe(refresh);
  }, [propCurrentUser]);

  // Permission flags based on user's role and RBAC settings
  const canViewDashboard = store.hasPermission('view_dashboard', activeUser);
  const canViewReports = store.hasPermission('view_reports', activeUser);
  const canCreateReport = store.hasPermission('create_reports', activeUser);
  const canImportExcel = store.hasPermission('import_excel', activeUser);
  const canManageCatalogs = store.hasPermission('manage_catalogs', activeUser);
  const canManageUsers = store.hasPermission('manage_users', activeUser);
  const canManageSystemConfig = store.hasPermission('manage_system_config', activeUser);
  const canViewAuditLogs = store.hasPermission('view_audit_logs', activeUser);

  const showCatalogGroup = canManageCatalogs;
  const showSystemConfig = canManageSystemConfig || canManageUsers;
  const showSystemGroup = showSystemConfig || canViewAuditLogs;

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return { label: 'Quản trị viên (Admin)', bg: 'bg-rose-500/20 text-rose-300 border-rose-500/30' };
      case 'analyst':
        return { label: 'Chuyên viên phân tích', bg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' };
      case 'data_entry':
        return { label: 'Chuyên viên nhập liệu', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
      case 'viewer':
      default:
        return { label: 'Người xem (Chỉ đọc)', bg: 'bg-slate-700 text-slate-300 border-slate-600' };
    }
  };

  const roleInfo = getRoleBadge(activeUser.role);
  const isAuthenticated = activeUser.id !== 'guest' && activeUser.active === true;

  const isAnalysisActive = location.pathname.startsWith('/analysis');
  const isCatalogActive =
    location.pathname.startsWith('/admin/units') ||
    location.pathname.startsWith('/admin/fields') ||
    location.pathname.startsWith('/admin/indicators');

  const getThemeBg = (sidebarTheme: string) => {
    switch (sidebarTheme) {
      case 'slate':
        return 'bg-slate-950 text-slate-100 border-slate-800';
      case 'navy':
        return 'bg-slate-900 text-slate-100 border-slate-800';
      case 'light':
        return 'bg-slate-900 text-slate-100 border-slate-800';
      case 'dark':
      default:
        return 'bg-slate-900 text-slate-100 border-slate-800';
    }
  };

  const getActiveAccent = (color: string) => {
    switch (color) {
      case 'indigo':
        return 'bg-indigo-600 text-white shadow-xs';
      case 'emerald':
        return 'bg-emerald-600 text-white shadow-xs';
      case 'violet':
        return 'bg-violet-600 text-white shadow-xs';
      case 'rose':
        return 'bg-rose-600 text-white shadow-xs';
      case 'amber':
        return 'bg-amber-600 text-white shadow-xs';
      case 'teal':
        return 'bg-teal-600 text-white shadow-xs';
      case 'slate':
        return 'bg-slate-700 text-white shadow-xs';
      case 'blue':
      default:
        return 'bg-blue-600 text-white shadow-xs';
    }
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center ${
      isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'
    } text-sm font-medium rounded-xl transition-all ${
      isActive
        ? getActiveAccent(config.themeColor)
        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    }`;

  const subNavClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center ${
      isCollapsed ? 'justify-center px-2 py-2' : 'gap-2.5 px-3 py-1.5 pl-8'
    } text-xs font-medium rounded-lg transition-all ${
      isActive
        ? 'bg-blue-600/30 text-blue-300 font-semibold border-l-2 border-blue-400'
        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
    }`;

  const menu = config.menuLabels;

  return (
    <aside
      className={`${
        isCollapsed ? 'w-16' : 'w-64'
      } ${getThemeBg(
        config.sidebarTheme
      )} flex flex-col shrink-0 border-r select-none transition-all duration-300 ease-in-out relative z-30`}
    >
      {/* Top Header Bar with NGHIỆP VỤ THỐNG KÊ Title & Collapse Toggle */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between shrink-0 h-14">
        {!isCollapsed && (
          <span className="text-[11px] font-extrabold text-blue-400 uppercase tracking-wider pl-1">
            NGHIỆP VỤ THỐNG KÊ
          </span>
        )}
        <button
          type="button"
          onClick={onToggle}
          className={`p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none shrink-0 ${
            isCollapsed ? 'mx-auto' : ''
          }`}
          title={isCollapsed ? "Mở rộng menu" : "Thu gọn menu"}
          id="btn-sidebar-collapse"
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-5 h-5 text-blue-400" />
          ) : (
            <PanelLeftClose className="w-4 h-4 text-slate-400" />
          )}
        </button>
      </div>

      {/* Nav List */}
      <nav className="flex-1 p-2.5 space-y-1.5 overflow-y-auto overflow-x-hidden">

        {/* 1. Tổng quan */}
        {canViewDashboard && (
          <NavLink to="/dashboard" className={navClass} id="nav-dashboard" title={menu.dashboard}>
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>{menu.dashboard}</span>}
          </NavLink>
        )}

        {/* 2. Báo cáo */}
        {canViewReports && (
          <NavLink to="/reports" className={navClass} id="nav-reports" title={menu.reports}>
            <FileText className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>{menu.reports}</span>}
          </NavLink>
        )}

        {/* Kho lưu trữ */}
        {canViewReports && (
          <NavLink to="/archive" className={navClass} id="nav-archive" title={menu.archive}>
            <Archive className="w-4 h-4 text-amber-400 shrink-0" />
            {!isCollapsed && <span>{menu.archive}</span>}
          </NavLink>
        )}

        {/* 3. Tạo báo cáo */}
        {canCreateReport && (
          <NavLink to="/reports/new" className={navClass} id="nav-reports-new" title={menu.new_report}>
            <FilePlus className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>{menu.new_report}</span>}
          </NavLink>
        )}

        {/* 4. Dữ liệu nhập */}
        {canImportExcel && (
          <NavLink to="/import" className={navClass} id="nav-import" title={menu.import}>
            <UploadCloud className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>{menu.import}</span>}
          </NavLink>
        )}

        {/* Divider / Group: Phân tích */}
        {(canViewDashboard || canViewReports) && (
          <div className="pt-2">
            {!isCollapsed ? (
              <button
                type="button"
                onClick={() => setAnalysisOpen(!analysisOpen)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-xl transition-colors ${
                  isAnalysisActive ? 'text-blue-300' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>{menu.analysis_group}</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    analysisOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
            ) : (
              <div className="border-t border-slate-800 my-1 pt-1" />
            )}

            {(analysisOpen || isCollapsed) && (
              <div className={`mt-1 space-y-0.5 ${isCollapsed ? 'space-y-1' : ''}`}>
                <NavLink to="/analysis/units" className={subNavClass} title={menu.analysis_units}>
                  <Building2 className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                  {!isCollapsed && <span>{menu.analysis_units}</span>}
                </NavLink>
                <NavLink to="/analysis/fields" className={subNavClass} title={menu.analysis_fields}>
                  <FolderKanban className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
                  {!isCollapsed && <span>{menu.analysis_fields}</span>}
                </NavLink>
                <NavLink to="/analysis/compare" className={subNavClass} title={menu.analysis_compare}>
                  <GitCompare className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                  {!isCollapsed && <span>{menu.analysis_compare}</span>}
                </NavLink>
              </div>
            )}
          </div>
        )}

        {/* Divider / Group: Danh mục */}
        {showCatalogGroup && (
          <div className="pt-2">
            {!isCollapsed ? (
              <button
                type="button"
                onClick={() => setCatalogOpen(!catalogOpen)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-xl transition-colors ${
                  isCatalogActive ? 'text-amber-300' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <SlidersHorizontal className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{menu.catalog_group}</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    catalogOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
            ) : (
              <div className="border-t border-slate-800 my-1 pt-1" />
            )}

            {(catalogOpen || isCollapsed) && (
              <div className={`mt-1 space-y-0.5 ${isCollapsed ? 'space-y-1' : ''}`}>
                <NavLink to="/admin/units" className={subNavClass} title={menu.catalog_units}>
                  <Building2 className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  {!isCollapsed && <span>{menu.catalog_units}</span>}
                </NavLink>
                <NavLink to="/admin/fields" className={subNavClass} title={menu.catalog_fields}>
                  <FolderKanban className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                  {!isCollapsed && <span>{menu.catalog_fields}</span>}
                </NavLink>
                <NavLink to="/admin/indicators" className={subNavClass} title={menu.catalog_indicators}>
                  <SlidersHorizontal className="w-3.5 h-3.5 shrink-0 text-teal-400" />
                  {!isCollapsed && <span>{menu.catalog_indicators}</span>}
                </NavLink>
              </div>
            )}
          </div>
        )}

        {/* Group: Hệ thống */}
        {showSystemGroup && (
          <div className="pt-2 border-t border-slate-800">
            {!isCollapsed && (
              <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 px-3 pt-2 pb-1">
                {menu.system_group}
              </div>
            )}
            {/* Cấu hình hệ thống */}
            {showSystemConfig && (
              <NavLink to="/admin/settings" className={navClass} id="nav-settings" title={menu.system_config || 'Thiết lập Hệ thống'}>
                <Settings className="w-4 h-4 text-amber-400 shrink-0" />
                {!isCollapsed && <span>{menu.system_config || 'Thiết lập Hệ thống'}</span>}
              </NavLink>
            )}

            {/* Nhật ký hệ thống */}
            {canViewAuditLogs && (
              <NavLink to="/admin/audit-logs" className={navClass} id="nav-audit" title={menu.system_audit}>
                <History className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>{menu.system_audit}</span>}
              </NavLink>
            )}

            {/* Supabase Integration & Verification */}
            {canManageSystemConfig && (
              <NavLink to="/admin/supabase" className={navClass} id="nav-supabase" title={menu.system_supabase}>
                <Database className="w-4 h-4 text-emerald-400 shrink-0" />
                {!isCollapsed && (
                  <div className="flex items-center justify-between flex-1">
                    <span>{menu.system_supabase}</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  </div>
                )}
              </NavLink>
            )}
          </div>
        )}
      </nav>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
        {!isCollapsed ? (
          <>
            <span className="text-[11px] text-slate-400">v2.5.0</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Online
            </span>
          </>
        ) : (
          <div className="w-full flex justify-center" title="Hệ thống Online (v2.5.0)">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </div>
        )}
      </div>
    </aside>
  );
};

