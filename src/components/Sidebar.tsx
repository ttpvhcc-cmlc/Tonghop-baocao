import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  ShieldCheck,
  ChevronDown,
  Database,
  Archive,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const location = useLocation();
  const [analysisOpen, setAnalysisOpen] = React.useState(true);
  const [catalogOpen, setCatalogOpen] = React.useState(true);

  const isAnalysisActive = location.pathname.startsWith('/analysis');
  const isCatalogActive =
    location.pathname.startsWith('/admin/units') ||
    location.pathname.startsWith('/admin/fields') ||
    location.pathname.startsWith('/admin/indicators');

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center ${
      isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'
    } text-sm font-medium rounded-xl transition-all ${
      isActive
        ? 'bg-blue-600 text-white shadow-sm'
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

  return (
    <aside
      className={`${
        isCollapsed ? 'w-16' : 'w-64'
      } bg-slate-900 text-slate-100 flex flex-col shrink-0 border-r border-slate-800 select-none transition-all duration-300 ease-in-out relative z-30`}
    >
      {/* Brand Header */}
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between min-h-[64px]">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0 transition-opacity duration-200">
              <h1 className="text-sm font-bold tracking-tight text-white truncate leading-snug">
                HỆ THỐNG BÁO CÁO
              </h1>
              <p className="text-[10px] text-slate-400 font-medium truncate">
                Văn phòng UBND / TT HCC
              </p>
            </div>
          )}
        </div>

        {/* Toggle Button in Header */}
        <button
          type="button"
          onClick={onToggle}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none"
          title={isCollapsed ? 'Mở rộng menu bên trái' : 'Thu gọn menu để tăng diện tích hiển thị dữ liệu'}
          id="btn-sidebar-collapse"
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-4 h-4 text-blue-400" />
          ) : (
            <PanelLeftClose className="w-4 h-4 text-slate-400" />
          )}
        </button>
      </div>

      {/* Nav List */}
      <nav className="flex-1 p-2.5 space-y-1.5 overflow-y-auto overflow-x-hidden">
        {!isCollapsed && (
          <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 px-3 pt-2 pb-1">
            Nghiệp vụ thống kê
          </div>
        )}

        {/* 1. Tổng quan */}
        <NavLink to="/dashboard" className={navClass} id="nav-dashboard" title="Tổng quan">
          <LayoutDashboard className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Tổng quan</span>}
        </NavLink>

        {/* 2. Báo cáo */}
        <NavLink to="/reports" className={navClass} id="nav-reports" title="Kỳ báo cáo">
          <FileText className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Kỳ báo cáo</span>}
        </NavLink>

        {/* Kho lưu trữ */}
        <NavLink to="/archive" className={navClass} id="nav-archive" title="Kho lưu trữ">
          <Archive className="w-4 h-4 text-amber-400 shrink-0" />
          {!isCollapsed && <span>Kho lưu trữ</span>}
        </NavLink>

        {/* 3. Tạo báo cáo */}
        <NavLink to="/reports/new" className={navClass} id="nav-reports-new" title="Tạo kỳ báo cáo mới">
          <FilePlus className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Tạo kỳ báo cáo mới</span>}
        </NavLink>

        {/* 4. Dữ liệu nhập */}
        <NavLink to="/import" className={navClass} id="nav-import" title="Nhập dữ liệu Excel">
          <UploadCloud className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Nhập dữ liệu Excel</span>}
        </NavLink>

        {/* Divider / Group: Phân tích */}
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
                <span>Phân tích dữ liệu</span>
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
              <NavLink to="/analysis/units" className={subNavClass} title="Phân tích: Theo Đơn vị">
                <Building2 className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                {!isCollapsed && <span>Theo Đơn vị</span>}
              </NavLink>
              <NavLink to="/analysis/fields" className={subNavClass} title="Phân tích: Theo Lĩnh vực">
                <FolderKanban className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
                {!isCollapsed && <span>Theo Lĩnh vực</span>}
              </NavLink>
              <NavLink to="/analysis/compare" className={subNavClass} title="Phân tích: So sánh nhiều kỳ">
                <GitCompare className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                {!isCollapsed && <span>So sánh nhiều kỳ</span>}
              </NavLink>
            </div>
          )}
        </div>

        {/* Divider / Group: Danh mục */}
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
                <span>Danh mục quản trị</span>
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
              <NavLink to="/admin/units" className={subNavClass} title="Danh mục: Đơn vị giải quyết">
                <Building2 className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                {!isCollapsed && <span>Đơn vị giải quyết</span>}
              </NavLink>
              <NavLink to="/admin/fields" className={subNavClass} title="Danh mục: Lĩnh vực & Mapping">
                <FolderKanban className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                {!isCollapsed && <span>Lĩnh vực & Mapping</span>}
              </NavLink>
              <NavLink to="/admin/indicators" className={subNavClass} title="Danh mục: Chỉ tiêu & Công thức">
                <SlidersHorizontal className="w-3.5 h-3.5 shrink-0 text-teal-400" />
                {!isCollapsed && <span>Chỉ tiêu & Công thức</span>}
              </NavLink>
            </div>
          )}
        </div>

        {/* Group: Hệ thống */}
        <div className="pt-2 border-t border-slate-800">
          {!isCollapsed && (
            <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 px-3 pt-2 pb-1">
              Hệ thống & Kiểm soát
            </div>
          )}
          {/* 7. Người dùng */}
          <NavLink to="/admin/users" className={navClass} id="nav-users" title="Phân quyền người dùng">
            <Users className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Phân quyền người dùng</span>}
          </NavLink>

          {/* 8. Nhật ký hệ thống */}
          <NavLink to="/admin/audit-logs" className={navClass} id="nav-audit" title="Nhật ký hệ thống (Audit)">
            <History className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Nhật ký hệ thống (Audit)</span>}
          </NavLink>

          {/* 9. Supabase Integration & Verification */}
          <NavLink to="/admin/supabase" className={navClass} id="nav-supabase" title="Kiểm thử Supabase">
            <Database className="w-4 h-4 text-emerald-400 shrink-0" />
            {!isCollapsed && (
              <div className="flex items-center justify-between flex-1">
                <span>Kiểm thử Supabase</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              </div>
            )}
          </NavLink>
        </div>
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
