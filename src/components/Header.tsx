import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { store, SystemConfig } from '../services/store';
import { Profile } from '../types/database';
import {
  Building2,
  Landmark,
  FileSpreadsheet,
  Award,
  FolderKanban,
  ShieldCheck,
  UserCheck,
  ChevronDown,
  LogOut,
  User,
  LogIn,
} from 'lucide-react';

interface HeaderProps {
  currentUser: Profile;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser: propUser,
}) => {
  const [config, setConfig] = useState<SystemConfig>(store.getSystemConfig());
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeUser, setActiveUser] = useState<Profile>(propUser || store.getCurrentUser());

  useEffect(() => {
    const refresh = () => {
      setConfig(store.getSystemConfig());
      setActiveUser(store.getCurrentUser());
    };
    return store.subscribe(refresh);
  }, []);

  const getOfficerDisplayName = (user: Profile) => {
    if (user?.id === 'guest') {
      return 'Chưa đăng nhập';
    }
    if (user?.full_name && user.full_name !== 'Người dùng' && !user.full_name.includes('@')) {
      return user.full_name;
    }
    if (user?.email && user.email.includes('ttpvhcc')) {
      return 'Cán bộ TTPVHCC';
    }
    return user?.full_name || 'Cán bộ TTPVHCC';
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Quản trị viên (Admin)';
      case 'analyst':
        return 'Chuyên viên phân tích';
      case 'data_entry':
        return 'Chuyên viên nhập liệu';
      case 'viewer':
      default:
        return 'Người xem (Viewer)';
    }
  };

  const renderLogoIcon = () => {
    const iconSizeClass = (config.logoSize || 36) > 40 ? "w-7 h-7 text-blue-600" : "w-5 h-5 text-blue-600";
    if (config.logoType === 'custom_url' && config.logoUrl) {
      return (
        <img
          src={config.logoUrl}
          alt="Logo"
          className="w-full h-full object-contain"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      );
    }
    switch (config.logoIcon) {
      case 'Building2':
        return <Building2 className={iconSizeClass} />;
      case 'Landmark':
        return <Landmark className={iconSizeClass} />;
      case 'FileSpreadsheet':
        return <FileSpreadsheet className={iconSizeClass} />;
      case 'Award':
        return <Award className={iconSizeClass} />;
      case 'FolderKanban':
        return <FolderKanban className={iconSizeClass} />;
      case 'ShieldCheck':
      default:
        return <ShieldCheck className={iconSizeClass} />;
    }
  };

  const logoPx = config.logoSize || 36;
  const officerNameDisplay = getOfficerDisplayName(activeUser);

  return (
    <header className="min-h-[64px] py-2 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 sticky top-0 z-20 shadow-xs">
      {/* Left Customizable Branding */}
      <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="rounded-xl bg-transparent flex items-center justify-center shrink-0 overflow-hidden transition-all"
            style={{ width: `${logoPx}px`, height: `${logoPx}px` }}
          >
            {renderLogoIcon()}
          </div>
          <div className="flex flex-col min-w-0">
            <span
              className={`truncate leading-snug tracking-tight ${config.systemNameFontWeight || 'font-extrabold'}`}
              style={{
                color: config.systemNameColor || '#0f172a',
                fontSize: config.systemNameFontSize || '15px'
              }}
            >
              {config.systemName || 'HỆ THỐNG TỔNG HỢP ĐÁNH GIÁ TÌNH HÌNH TIẾP NHẬN, GIẢI QUYẾT THỦ TỤC HÀNH CHÍNH'}
            </span>
            <span
              className="truncate font-medium mt-0.5"
              style={{
                color: config.subTitleColor || '#475569',
                fontSize: config.subTitleFontSize || '11px'
              }}
            >
              {config.subTitle || 'Trung tâm Phục vụ hành chính công xã Chân Mây - Lăng Cô'}
            </span>
          </div>
        </div>
      </div>

      {/* Right User Info Block / Login Button */}
      <div className="relative shrink-0">
        {activeUser.id === 'guest' ? (
          <Link
            to="/login"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-xs hover:shadow-sm cursor-pointer"
            title="Đến trang Đăng nhập Cán bộ"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Đăng nhập</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-800 transition-all border border-slate-200/90 shadow-2xs cursor-pointer"
            title={`Tài khoản cán bộ: ${activeUser.email || activeUser.full_name}`}
          >
            <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold text-slate-800 tracking-tight truncate max-w-[180px]">
              {officerNameDisplay}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          </button>
        )}

        {/* Authenticated User Dropdown Menu */}
        {showUserMenu && activeUser.id !== 'guest' && (
          <div className="absolute right-0 top-11 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-4.5 z-50 animate-fade-in text-slate-800 space-y-3">
            <div className="pb-2 border-b border-slate-100">
              <p className="text-xs font-extrabold text-slate-900 truncate">{officerNameDisplay}</p>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">{activeUser.email}</p>
              <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 rounded-lg">
                {getRoleLabel(activeUser.role)}
              </span>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  await store.signOut();
                  setShowUserMenu(false);
                } catch (e) {
                  console.error(e);
                }
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Đăng xuất
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
