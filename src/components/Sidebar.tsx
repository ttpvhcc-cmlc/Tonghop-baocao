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
  Archive
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const [analysisOpen, setAnalysisOpen] = React.useState(true);
  const [catalogOpen, setCatalogOpen] = React.useState(true);

  const isAnalysisActive = location.pathname.startsWith('/analysis');
  const isCatalogActive = location.pathname.startsWith('/admin/units') || 
                          location.pathname.startsWith('/admin/fields') || 
                          location.pathname.startsWith('/admin/indicators');

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
      isActive
        ? 'bg-blue-700 text-white shadow-xs'
        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    }`;

  const subNavClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-1.5 pl-8 text-xs font-medium rounded-md transition-colors ${
      isActive
        ? 'bg-blue-600/30 text-blue-300 font-semibold border-l-2 border-blue-400'
        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
    }`;

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col shrink-0 border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white line-clamp-1 leading-snug">
              HỆ THỐNG BÁO CÁO TTHC
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">
              Văn phòng UBND / Trung tâm HCC
            </p>
          </div>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 px-3 pt-2 pb-1">
          Nghiệp vụ thống kê
        </div>

        {/* 1. Tổng quan */}
        <NavLink to="/dashboard" className={navClass} id="nav-dashboard">
          <LayoutDashboard className="w-4 h-4" />
          <span>Tổng quan</span>
        </NavLink>

        {/* 2. Báo cáo */}
        <NavLink to="/reports" className={navClass} id="nav-reports">
          <FileText className="w-4 h-4" />
          <span>Kỳ báo cáo</span>
        </NavLink>

        {/* Kho lưu trữ lịch sử */}
        <NavLink to="/archive" className={navClass} id="nav-archive">
          <Archive className="w-4 h-4 text-amber-400" />
          <span>Kho lưu trữ lịch sử</span>
        </NavLink>

        {/* 3. Tạo báo cáo */}
        <NavLink to="/reports/new" className={navClass} id="nav-reports-new">
          <FilePlus className="w-4 h-4" />
          <span>Tạo kỳ báo cáo mới</span>
        </NavLink>

        {/* 4. Dữ liệu nhập */}
        <NavLink to="/import" className={navClass} id="nav-import">
          <UploadCloud className="w-4 h-4" />
          <span>Nhập dữ liệu Excel</span>
        </NavLink>

        <div className="pt-2">
          {/* 5. Phân tích */}
          <button
            type="button"
            onClick={() => setAnalysisOpen(!analysisOpen)}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              isAnalysisActive ? 'text-blue-300' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              <span>Phân tích dữ liệu</span>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform ${
                analysisOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {analysisOpen && (
            <div className="mt-1 space-y-0.5">
              <NavLink to="/analysis/units" className={subNavClass}>
                <Building2 className="w-3.5 h-3.5" />
                <span>Theo Đơn vị</span>
              </NavLink>
              <NavLink to="/analysis/fields" className={subNavClass}>
                <FolderKanban className="w-3.5 h-3.5" />
                <span>Theo Lĩnh vực</span>
              </NavLink>
              <NavLink to="/analysis/compare" className={subNavClass}>
                <GitCompare className="w-3.5 h-3.5" />
                <span>So sánh nhiều kỳ</span>
              </NavLink>
            </div>
          )}
        </div>

        <div className="pt-2">
          {/* 6. Danh mục */}
          <button
            type="button"
            onClick={() => setCatalogOpen(!catalogOpen)}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              isCatalogActive ? 'text-amber-300' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <SlidersHorizontal className="w-4 h-4 text-amber-400" />
              <span>Danh mục quản trị</span>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform ${
                catalogOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {catalogOpen && (
            <div className="mt-1 space-y-0.5">
              <NavLink to="/admin/units" className={subNavClass}>
                <span>Đơn vị giải quyết</span>
              </NavLink>
              <NavLink to="/admin/fields" className={subNavClass}>
                <span>Lĩnh vực & Mapping</span>
              </NavLink>
              <NavLink to="/admin/indicators" className={subNavClass}>
                <span>Chỉ tiêu & Công thức</span>
              </NavLink>
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-slate-800">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 px-3 pt-2 pb-1">
            Hệ thống & Kiểm soát
          </div>
          {/* 7. Người dùng */}
          <NavLink to="/admin/users" className={navClass} id="nav-users">
            <Users className="w-4 h-4" />
            <span>Phân quyền người dùng</span>
          </NavLink>

          {/* 8. Nhật ký hệ thống */}
          <NavLink to="/admin/audit-logs" className={navClass} id="nav-audit">
            <History className="w-4 h-4" />
            <span>Nhật ký hệ thống (Audit)</span>
          </NavLink>

          {/* 9. Supabase Integration & Verification */}
          <NavLink to="/admin/supabase" className={navClass} id="nav-supabase">
            <Database className="w-4 h-4 text-emerald-400" />
            <div className="flex items-center justify-between flex-1">
              <span>Kiểm thử Supabase</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            </div>
          </NavLink>
        </div>
      </nav>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/50">
        <div className="text-[11px] text-slate-400 flex items-center justify-between">
          <span>Phiên bản v2.5.0</span>
          <span className="inline-flex items-center gap-1 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Online
          </span>
        </div>
      </div>
    </aside>
  );
};
