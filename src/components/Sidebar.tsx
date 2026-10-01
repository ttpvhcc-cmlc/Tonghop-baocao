import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { store, SystemConfig } from '../services/store';
import { Profile } from '../types/database';
import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Building2,
  FolderKanban,
  GitCompare,
  SlidersHorizontal,
  History,
  ChevronDown,
  Database,
  Archive,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Tv,
  CalendarRange,
  BellRing,
  GripVertical,
  Check,
  FilePlus,
  UploadCloud,
  Users,
} from 'lucide-react';

interface SidebarProps {
  currentUser?: Profile;
  isCollapsed: boolean;
  onToggle: () => void;
}

const DEFAULT_MENU_ORDER = [
  'dashboard',
  'analysis_group',
  'dossier_urge',
  'update_report',
  'procedures_control',
  'public_dashboard',
  'catalog_group',
  'system_group',
];

export const Sidebar: React.FC<SidebarProps> = ({ currentUser: propCurrentUser, isCollapsed, onToggle }) => {
  const location = useLocation();
  const [config, setConfig] = useState<SystemConfig>(store.getSystemConfig());
  // Mặc định thu gọn menu "Cập nhật báo cáo" theo yêu cầu
  const [updateReportOpen, setUpdateReportOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  const [activeUser, setActiveUser] = useState<Profile>(propCurrentUser || store.getCurrentUser());

  // Menu order state
  const [menuOrder, setMenuOrder] = useState<string[]>(
    config.sidebarMenuOrder && config.sidebarMenuOrder.length > 0
      ? config.sidebarMenuOrder
      : DEFAULT_MENU_ORDER
  );

  const [draggedItemKey, setDraggedItemKey] = useState<string | null>(null);
  const [dragOverItemKey, setDragOverItemKey] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      const cfg = store.getSystemConfig();
      setConfig(cfg);
      setActiveUser(propCurrentUser || store.getCurrentUser());
      if (cfg.sidebarMenuOrder && cfg.sidebarMenuOrder.length > 0) {
        setMenuOrder(cfg.sidebarMenuOrder);
      }
    };
    refresh();
    return store.subscribe(refresh);
  }, [propCurrentUser]);

  const isAdmin = activeUser?.role === 'admin';

  // Permission flags based on user's role and RBAC settings
  const canViewDashboard = store.hasPermission('view_dashboard', activeUser);
  const canViewPublicDashboard = store.hasPermission('view_public_dashboard', activeUser);
  const canViewDossierUrge = store.hasPermission('view_dossier_urge', activeUser);
  const canViewReports = store.hasPermission('view_reports', activeUser);
  const canCreateReports = store.hasPermission('create_reports', activeUser);
  const canImportExcel = store.hasPermission('import_excel', activeUser);
  const canViewArchive = store.hasPermission('view_archive', activeUser);
  const canViewAnalysisUnits = store.hasPermission('view_analysis_units', activeUser);
  const canViewAnalysisFields = store.hasPermission('view_analysis_fields', activeUser);
  const canViewAnalysisCompare = store.hasPermission('view_analysis_compare', activeUser);
  const canManageProceduresControl = store.hasPermission('manage_procedures_control', activeUser);
  const canManageCatalogs = store.hasPermission('manage_catalogs', activeUser);
  const canManageUnitsCatalog = store.hasPermission('manage_units_catalog', activeUser) || canManageCatalogs;
  const canManageIndicatorsCatalog = store.hasPermission('manage_indicators_catalog', activeUser) || canManageCatalogs;
  const canManagePeriodTypesCatalog = store.hasPermission('manage_period_types_catalog', activeUser) || canManageCatalogs;
  const canManageUsers = store.hasPermission('manage_users', activeUser);
  const canManageSystemConfig = store.hasPermission('manage_system_config', activeUser);
  const canViewAuditLogs = store.hasPermission('view_audit_logs', activeUser);
  const canManageDatabaseTest = store.hasPermission('manage_database_test', activeUser) || canManageSystemConfig;

  // Helper to check if a menu item is enabled in SystemConfig.menuVisibility
  const isItemVisible = (key: string): boolean => {
    if (config.menuVisibility && config.menuVisibility[key] === false) {
      return false;
    }
    return true;
  };

  const showAnalysisGroup =
    isItemVisible('analysis_group') &&
    ((canViewAnalysisUnits && isItemVisible('analysis_units')) ||
      (canViewAnalysisFields && isItemVisible('analysis_fields')) ||
      (canViewAnalysisCompare && isItemVisible('analysis_compare')));

  const showCatalogGroup =
    isItemVisible('catalog_group') &&
    ((canManageUnitsCatalog && isItemVisible('catalog_units')) ||
      ((canManageProceduresControl || canManageCatalogs) && isItemVisible('catalog_fields')) ||
      (canManageIndicatorsCatalog && isItemVisible('catalog_indicators')) ||
      (canManagePeriodTypesCatalog && isItemVisible('catalog_period_types')));

  const showProceduresControl = isItemVisible('procedures_control') && (canManageProceduresControl || canManageCatalogs);
  const showSystemConfig = canManageSystemConfig || canManageUsers;
  const showSystemGroup =
    isItemVisible('system_group') &&
    ((showSystemConfig && isItemVisible('system_config')) ||
      (canManageUsers && isItemVisible('system_users')) ||
      (canViewAuditLogs && isItemVisible('system_audit')) ||
      (canManageDatabaseTest && isItemVisible('system_supabase')));

  const showUpdateReportGroup =
    isItemVisible('update_report') &&
    ((canViewReports && isItemVisible('reports')) ||
      (canCreateReports && isItemVisible('new_report')) ||
      (canImportExcel && isItemVisible('import')) ||
      ((canViewArchive || canViewReports) && isItemVisible('archive')));

  const isUpdateReportActive =
    location.pathname.startsWith('/reports') ||
    location.pathname.startsWith('/archive') ||
    location.pathname.startsWith('/import');
  const isAnalysisActive = location.pathname.startsWith('/analysis');
  const isCatalogActive =
    location.pathname.startsWith('/admin/units') ||
    location.pathname.startsWith('/admin/indicators') ||
    location.pathname.startsWith('/admin/period-types') ||
    location.pathname.startsWith('/admin/report-periods');

  // Drag & drop reorder handlers for Admin
  const handleDragStart = (e: React.DragEvent, key: string) => {
    if (!isAdmin) return;
    setDraggedItemKey(key);
    e.dataTransfer.setData('text/plain', key);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, key: string) => {
    if (!isAdmin) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverItemKey !== key) {
      setDragOverItemKey(key);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetKey: string) => {
    if (!isAdmin || !draggedItemKey || draggedItemKey === targetKey) {
      setDraggedItemKey(null);
      setDragOverItemKey(null);
      return;
    }
    e.preventDefault();

    const currentOrder = [...menuOrder];
    const fromIndex = currentOrder.indexOf(draggedItemKey);
    const toIndex = currentOrder.indexOf(targetKey);

    if (fromIndex !== -1 && toIndex !== -1) {
      currentOrder.splice(fromIndex, 1);
      currentOrder.splice(toIndex, 0, draggedItemKey);
      setMenuOrder(currentOrder);

      // Lưu ngay vào CSDL/store để áp dụng cho tất cả người dùng
      try {
        await store.saveSystemConfig({
          ...config,
          sidebarMenuOrder: currentOrder,
        });
        setSaveToast('Đã lưu và áp dụng thứ tự menu cho toàn hệ thống!');
        setTimeout(() => setSaveToast(null), 3000);
      } catch (err) {
        console.warn('Lỗi lưu thứ tự menu:', err);
      }
    }

    setDraggedItemKey(null);
    setDragOverItemKey(null);
  };

  const handleDragEnd = () => {
    setDraggedItemKey(null);
    setDragOverItemKey(null);
  };

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

  const isVisuallyCollapsed = isCollapsed;

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-xl transition-all ${
      isActive
        ? getActiveAccent(config.themeColor)
        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    }`;

  const subNavClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3 py-1.5 pl-8 text-xs font-medium rounded-lg transition-all ${
      isActive
        ? 'bg-blue-600/30 text-blue-300 font-semibold border-l-2 border-blue-400'
        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
    }`;

  const menu = config.menuLabels;

  // Render individual menu item block
  const renderMenuItem = (itemKey: string) => {
    switch (itemKey) {
      case 'dashboard':
        if (!canViewDashboard || !isItemVisible('dashboard')) return null;
        return (
          <NavLink to="/dashboard" className={navClass} id="nav-dashboard" title={menu.dashboard}>
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span className="flex-1 truncate">{menu.dashboard}</span>
          </NavLink>
        );

      case 'public_dashboard':
        if (!canViewPublicDashboard || !isItemVisible('public_dashboard')) return null;
        return (
          <NavLink
            to="/public-dashboard"
            className={navClass}
            id="nav-tv"
            title={menu.public_dashboard || 'Màn hình TV 55" (Kiosk công khai)'}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Tv className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="flex-1 truncate">{menu.public_dashboard || 'Màn hình TV 55"'}</span>
          </NavLink>
        );

      case 'dossier_urge':
        if (!canViewDossierUrge || !isItemVisible('dossier_urge')) return null;
        return (
          <NavLink
            to="/dossier-urge"
            className={navClass}
            id="nav-dossier-urge"
            title={menu.dossier_urge || 'Đôn đốc hồ sơ'}
          >
            <BellRing className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="flex-1 truncate">{menu.dossier_urge || 'Đôn đốc hồ sơ'}</span>
          </NavLink>
        );

      case 'update_report':
        if (!showUpdateReportGroup) return null;
        return (
          <div className="pt-0.5">
            <button
              type="button"
              onClick={() => setUpdateReportOpen(!updateReportOpen)}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-xl transition-colors cursor-pointer ${
                isUpdateReportActive ? 'text-blue-300 font-semibold' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="truncate">{menu.update_report || 'Cập nhật báo cáo'}</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                  updateReportOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {updateReportOpen && (
              <div className="mt-1 space-y-0.5">
                {canViewReports && isItemVisible('reports') && (
                  <NavLink to="/reports" className={subNavClass} title={menu.reports || 'Kỳ báo cáo'}>
                    <CalendarRange className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                    <span>{menu.reports || 'Kỳ báo cáo'}</span>
                  </NavLink>
                )}
                {canCreateReports && isItemVisible('new_report') && (
                  <NavLink to="/reports/new" className={subNavClass} title={menu.new_report || 'Tạo kỳ báo cáo'}>
                    <FilePlus className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    <span>{menu.new_report || 'Tạo kỳ báo cáo'}</span>
                  </NavLink>
                )}
                {canImportExcel && isItemVisible('import') && (
                  <NavLink to="/import" className={subNavClass} title={menu.import || 'Nhập từ Excel'}>
                    <UploadCloud className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                    <span>{menu.import || 'Nhập từ Excel'}</span>
                  </NavLink>
                )}
                {(canViewArchive || canViewReports) && isItemVisible('archive') && (
                  <NavLink to="/archive" className={subNavClass} title={menu.archive || 'Kho lưu trữ'}>
                    <Archive className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                    <span>{menu.archive || 'Kho lưu trữ'}</span>
                  </NavLink>
                )}
              </div>
            )}
          </div>
        );

      case 'analysis_group':
        if (!showAnalysisGroup) return null;
        return (
          <div className="pt-0.5">
            <button
              type="button"
              onClick={() => setAnalysisOpen(!analysisOpen)}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-xl transition-colors cursor-pointer ${
                isAnalysisActive ? 'text-blue-300' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <BarChart3 className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="truncate">{menu.analysis_group}</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                  analysisOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {analysisOpen && (
              <div className="mt-1 space-y-0.5">
                {canViewAnalysisUnits && isItemVisible('analysis_units') && (
                  <NavLink to="/analysis/units" className={subNavClass} title={menu.analysis_units}>
                    <Building2 className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                    <span>{menu.analysis_units}</span>
                  </NavLink>
                )}
                {canViewAnalysisFields && isItemVisible('analysis_fields') && (
                  <NavLink to="/analysis/fields" className={subNavClass} title={menu.analysis_fields}>
                    <FolderKanban className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
                    <span>{menu.analysis_fields}</span>
                  </NavLink>
                )}
                {canViewAnalysisCompare && isItemVisible('analysis_compare') && (
                  <NavLink to="/analysis/compare" className={subNavClass} title={menu.analysis_compare}>
                    <GitCompare className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                    <span>{menu.analysis_compare}</span>
                  </NavLink>
                )}
              </div>
            )}
          </div>
        );

      case 'procedures_control':
        if (!showProceduresControl) return null;
        return (
          <div className="pt-0.5">
            <NavLink
              to="/admin/fields"
              className={navClass}
              id="nav-procedures-control"
              title={menu.procedures_control || 'Kiểm soát TTHC'}
            >
              <FolderKanban className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="flex-1 truncate">{menu.procedures_control || 'Kiểm soát TTHC'}</span>
            </NavLink>
          </div>
        );

      case 'catalog_group':
        if (!showCatalogGroup) return null;
        return (
          <div className="pt-0.5">
            <button
              type="button"
              onClick={() => setCatalogOpen(!catalogOpen)}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-xl transition-colors cursor-pointer ${
                isCatalogActive ? 'text-amber-300' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <SlidersHorizontal className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="truncate">{menu.catalog_group || 'Danh mục quản trị'}</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                  catalogOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {catalogOpen && (
              <div className="mt-1 space-y-0.5">
                {canManageUnitsCatalog && isItemVisible('catalog_units') && (
                  <NavLink to="/admin/units" className={subNavClass} title={menu.catalog_units || 'Đơn vị giải quyết'}>
                    <Building2 className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                    <span>{menu.catalog_units || 'Đơn vị giải quyết'}</span>
                  </NavLink>
                )}
                {(canManageProceduresControl || canManageCatalogs) && isItemVisible('catalog_fields') && (
                  <NavLink to="/admin/fields" className={subNavClass} title={menu.catalog_fields || 'Lĩnh vực TTHC'}>
                    <FolderKanban className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    <span>{menu.catalog_fields || 'Lĩnh vực TTHC'}</span>
                  </NavLink>
                )}
                {canManageIndicatorsCatalog && isItemVisible('catalog_indicators') && (
                  <NavLink to="/admin/indicators" className={subNavClass} title={menu.catalog_indicators || 'Chỉ tiêu và Công thức'}>
                    <SlidersHorizontal className="w-3.5 h-3.5 shrink-0 text-teal-400" />
                    <span>{menu.catalog_indicators || 'Chỉ tiêu và Công thức'}</span>
                  </NavLink>
                )}
                {canManagePeriodTypesCatalog && isItemVisible('catalog_period_types') && (
                  <NavLink to="/admin/period-types" className={subNavClass} title={menu.catalog_period_types || 'Loại kỳ báo cáo'}>
                    <CalendarRange className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                    <span>{menu.catalog_period_types || 'Loại kỳ báo cáo'}</span>
                  </NavLink>
                )}
              </div>
            )}
          </div>
        );

      case 'system_group':
        if (!showSystemGroup) return null;
        return (
          <div className="pt-1.5 border-t border-slate-800/80">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 px-3 pt-1 pb-1">
              {menu.system_group || 'Hệ thống và Kiểm soát'}
            </div>
            {/* Cấu hình hệ thống */}
            {showSystemConfig && isItemVisible('system_config') && (
              <NavLink to="/admin/settings" className={navClass} id="nav-settings" title={menu.system_config || 'Thiết lập Hệ thống & Giao diện'}>
                <Settings className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="flex-1 truncate">{menu.system_config || 'Thiết lập Hệ thống & Giao diện'}</span>
              </NavLink>
            )}

            {/* Quản lý người dùng */}
            {canManageUsers && isItemVisible('system_users') && (
              <NavLink to="/admin/users" className={navClass} id="nav-users" title={menu.system_users || 'Quản lý người dùng'}>
                <Users className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="flex-1 truncate">{menu.system_users || 'Quản lý người dùng'}</span>
              </NavLink>
            )}

            {/* Nhật ký hệ thống */}
            {canViewAuditLogs && isItemVisible('system_audit') && (
              <NavLink to="/admin/audit-logs" className={navClass} id="nav-audit" title={menu.system_audit || 'Nhật ký hệ thống (Audit)'}>
                <History className="w-4 h-4 shrink-0 text-indigo-400" />
                <span className="flex-1 truncate">{menu.system_audit || 'Nhật ký hệ thống (Audit)'}</span>
              </NavLink>
            )}

            {/* Supabase Integration & Verification */}
            {canManageDatabaseTest && isItemVisible('system_supabase') && (
              <NavLink to="/admin/supabase" className={navClass} id="nav-supabase" title={menu.system_supabase || 'Kiểm thử Supabase'}>
                <Database className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="flex items-center justify-between flex-1 truncate">
                  <span className="truncate">{menu.system_supabase || 'Kiểm thử Supabase'}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1"></span>
                </div>
              </NavLink>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <aside
        className={`${
          isCollapsed ? 'w-0 border-r-0 opacity-0 pointer-events-none overflow-hidden hidden' : 'w-64 shadow-2xl opacity-100 border-r'
        } ${getThemeBg(
          config.sidebarTheme
        )} flex flex-col shrink-0 select-none transition-all duration-300 ease-in-out relative z-30`}
      >
        {/* Admin Drag Notice Toast */}
        {saveToast && (
          <div className="mx-2.5 mt-2 p-2 bg-emerald-600/90 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1.5 shadow-md animate-in fade-in">
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{saveToast}</span>
          </div>
        )}

        {/* Nav List with Admin Drag & Drop Ordering */}
        <nav className="flex-1 p-2.5 pt-3 space-y-1.5 overflow-y-auto overflow-x-hidden min-w-[256px]">
          {menuOrder.map((itemKey) => {
            const isDragging = draggedItemKey === itemKey;
            const isOver = dragOverItemKey === itemKey;

            return (
              <div
                key={itemKey}
                draggable={isAdmin}
                onDragStart={(e) => handleDragStart(e, itemKey)}
                onDragOver={(e) => handleDragOver(e, itemKey)}
                onDrop={(e) => handleDrop(e, itemKey)}
                onDragEnd={handleDragEnd}
                className={`relative group/drag transition-all rounded-xl ${
                  isDragging ? 'opacity-40 scale-95 border-2 border-dashed border-blue-400' : ''
                } ${
                  isOver && !isDragging
                    ? 'border-t-2 border-blue-400 pt-0.5'
                    : ''
                }`}
              >
                <div className="relative flex items-center">
                  <div className="flex-1 min-w-0">
                    {renderMenuItem(itemKey)}
                  </div>

                  {/* Grip handle visible to Admin on hover */}
                  {isAdmin && (
                    <div
                      className="opacity-0 group-hover/drag:opacity-70 hover:!opacity-100 cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-white shrink-0 absolute right-1 top-2.5 z-20"
                      title="Admin: Kéo thả để đổi thứ tự menu (áp dụng toàn hệ thống)"
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer Controls: Nút ẩn / hiện menu */}
        <div className="p-2.5 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between shrink-0">
          {!isVisuallyCollapsed ? (
            <>
              <span className="text-[11px] text-slate-400 font-medium pl-1.5">v2.5.0</span>
              <button
                type="button"
                onClick={onToggle}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/90 hover:bg-slate-700 rounded-xl transition-all cursor-pointer border border-slate-700/60 hover:border-slate-600 shadow-xs"
                title={isCollapsed ? "Ghim mở menu cố định" : "Thu gọn menu"}
                id="btn-sidebar-collapse"
              >
                <PanelLeftClose className="w-3.5 h-3.5 text-blue-400" />
                <span>Thu gọn menu</span>
              </button>
            </>
          ) : (
            <div className="w-full flex justify-center">
              <button
                type="button"
                onClick={onToggle}
                className="p-2 text-slate-300 hover:text-white bg-slate-800/90 hover:bg-slate-700 rounded-xl transition-all cursor-pointer border border-slate-700/60 hover:border-slate-600 shadow-xs"
                title="Mở rộng menu"
                id="btn-sidebar-collapse"
              >
                <PanelLeftOpen className="w-4 h-4 text-blue-400" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
