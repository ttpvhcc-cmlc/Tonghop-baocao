import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { store } from '../services/store';
import { UserRole, Profile } from '../types/database';
import { generateSampleExcelBuffer } from '../features/import/excelParser';
import {
  Download,
  UserCheck,
  CheckCircle2,
  Database,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

interface HeaderProps {
  currentUser: Profile;
  onUserRoleChange: (newRole: UserRole) => void;
  onResetData: () => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onUserRoleChange,
  onResetData,
  isSidebarCollapsed,
  onToggleSidebar,
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  const handleDownloadSample = () => {
    try {
      const buffer = generateSampleExcelBuffer();
      const blob = new Blob([buffer as any], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Mau_TongHop_BaoCao_TTHC_2026.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (e) {
      console.error('Download sample error:', e);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return { label: 'Quản trị viên (Admin)', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'analyst':
        return { label: 'Chuyên viên phân tích', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'data_entry':
        return { label: 'Chuyên viên nhập liệu', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'viewer':
        return { label: 'Người xem (Chỉ đọc)', bg: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  const roleInfo = getRoleBadge(currentUser.role);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 sticky top-0 z-20 shadow-xs">
      {/* Title / Breadcrumb context with Sidebar Toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-2 -ml-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none flex items-center gap-1.5"
          title={isSidebarCollapsed ? 'Mở rộng menu bên trái' : 'Thu gọn menu để mở rộng không gian'}
          id="btn-header-toggle-sidebar"
        >
          {isSidebarCollapsed ? (
            <PanelLeftOpen className="w-5 h-5 text-blue-600" />
          ) : (
            <PanelLeftClose className="w-5 h-5 text-slate-600" />
          )}
        </button>

        <div className="flex flex-col">
          <span className="text-xs font-extrabold text-blue-600 uppercase tracking-wider">
            CƠ SỞ DỮ LIỆU THỐNG KÊ TTHC
          </span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5">
        {/* Supabase Status Link */}
        <Link
          to="/admin/supabase"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors shadow-xs"
          title="Xem trạng thái kết nối và kiểm thử Supabase Cloud"
        >
          <Database className="w-3.5 h-3.5 text-emerald-600" />
          <span className="hidden sm:inline">Supabase Cloud:</span>
          <span className="inline-flex items-center gap-1 text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Active
          </span>
        </Link>

        {/* Download Sample Excel */}
        <button
          type="button"
          onClick={handleDownloadSample}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors shadow-xs"
          title="Tải về file Excel mẫu có đầy đủ 2 nguồn và dữ liệu test chênh lệch"
        >
          {downloadSuccess ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-700">Đã tải file mẫu</span>
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" />
              <span>Tải Excel mẫu</span>
            </>
          )}
        </button>

        {/* User Badge - Clean without Admin subtitle */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowRoleMenu(!showRoleMenu)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium border rounded-xl transition-all ${roleInfo.bg}`}
            title="Nhấn để tùy chọn vai trò người dùng"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span className="font-bold text-slate-800">{currentUser.full_name}</span>
          </button>

          {showRoleMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-50 animate-in fade-in zoom-in-95">
              <div className="px-3 py-2 border-b border-slate-100 mb-1">
                <p className="text-xs font-semibold text-slate-800">Chuyển đổi vai trò kiểm thử</p>
                <p className="text-[11px] text-slate-500">Thử nghiệm các cấp độ phân quyền RLS</p>
              </div>

              {(['admin', 'analyst', 'data_entry', 'viewer'] as UserRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    onUserRoleChange(r);
                    setShowRoleMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors flex items-center justify-between ${
                    currentUser.role === r ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>
                    {r === 'admin' ? 'Quản trị viên (Toàn quyền)' :
                     r === 'analyst' ? 'Chuyên viên phân tích (Duyệt/Khóa)' :
                     r === 'data_entry' ? 'Chuyên viên nhập liệu (Tạo/Nhập)' :
                     'Người xem (Chỉ đọc số liệu)'}
                  </span>
                  {currentUser.role === r && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
