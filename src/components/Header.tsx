import React, { useState, useEffect } from 'react';
import { store, SystemConfig } from '../services/store';
import { Profile } from '../types/database';
import { supabase } from '../lib/supabase';
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
  KeyRound,
  Shield,
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

  // Login states for header dropdown form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Resend confirmation email states
  const [resendStatus, setResendStatus] = useState<'idle' | 'busy' | 'success' | 'error'>('idle');
  const [resendMessage, setResendMessage] = useState('');

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

  const handleResendEmail = async () => {
    if (!email.trim()) {
      setResendStatus('error');
      setResendMessage('Vui lòng điền Email trước khi gửi lại link xác thực.');
      return;
    }
    setResendStatus('busy');
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      });
      if (error) throw error;
      setResendStatus('success');
      setResendMessage('Đã gửi lại link xác thực thành công! Hãy kiểm tra hộp thư của bạn.');
    } catch (err: any) {
      setResendStatus('error');
      setResendMessage(err.message || 'Lỗi gửi lại link xác thực.');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setLoginError('Vui lòng điền Email và Mật khẩu.');
      return;
    }
    setLoginBusy(true);
    setLoginError(null);
    setResendStatus('idle');
    setResendMessage('');
    try {
      await store.signIn(email, password);
      setEmail('');
      setPassword('');
      setShowUserMenu(false);
    } catch (err: any) {
      setLoginError(err.message || 'Mật khẩu hoặc Email không chính xác.');
    } finally {
      setLoginBusy(false);
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

      {/* Right User Info Block (Light style matching overall header, displaying Officer Name) */}
      <div className="relative shrink-0">
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

        {/* User Dropdown Menu */}
        {showUserMenu && (
          <div className="absolute right-0 top-11 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-4.5 z-50 animate-fade-in text-slate-800 space-y-3">
            {activeUser.id === 'guest' ? (
              /* Login Form for Guest Users */
              <form onSubmit={handleLoginSubmit} className="space-y-3">
                <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <LogIn className="w-4 h-4 text-blue-600" />
                  <p className="text-xs font-extrabold text-slate-900">Đăng nhập Cán bộ</p>
                </div>
                
                {loginError && (
                  <div className="space-y-2">
                    <div className="p-2.5 bg-rose-50 border border-rose-100 text-[11px] text-rose-600 rounded-xl font-medium leading-relaxed">
                      {loginError.includes('Email not confirmed') ? (
                        <div>
                          <p className="font-bold text-rose-700 mb-1">⚠️ Chưa xác nhận Email</p>
                          <p className="text-[10px] text-slate-600 leading-normal mb-2">
                            Tài khoản đã tạo thành công nhưng Supabase Auth yêu cầu xác thực email trước khi đăng nhập.
                          </p>
                          <div className="p-2 bg-white/70 rounded-lg border border-rose-100 text-[9.5px] text-slate-700 space-y-1 mb-1">
                            <p><strong>👉 Cách 1 (Nên dùng):</strong> Vào <strong>Supabase Dashboard</strong> &gt; <strong>Auth</strong> &gt; <strong>Providers</strong> &gt; <strong>Email</strong> &gt; Tắt mục <strong>"Confirm email"</strong> để cho phép đăng nhập ngay.</p>
                            <p><strong>👉 Cách 2:</strong> Kiểm tra hộp thư của email cán bộ và nhấn vào link kích hoạt gửi từ Supabase.</p>
                          </div>
                        </div>
                      ) : (
                        loginError
                      )}
                    </div>

                    {loginError.includes('Email not confirmed') && (
                      <div className="space-y-1">
                        <button
                          type="button"
                          disabled={resendStatus === 'busy'}
                          onClick={handleResendEmail}
                          className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 text-slate-700 font-bold rounded-lg text-[10px] transition-colors border border-slate-200 cursor-pointer flex items-center justify-center gap-1"
                        >
                          {resendStatus === 'busy' ? 'Đang gửi lại...' : '📬 Gửi lại Link kích hoạt Email'}
                        </button>
                        {resendMessage && (
                          <p className={`text-[9.5px] font-bold text-center mt-1 px-1 leading-tight ${
                            resendStatus === 'success' ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {resendMessage}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Email công vụ</label>
                  <input
                    type="email"
                    required
                    placeholder="VD: canbo@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-950 focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Mật khẩu</label>
                  <input
                    type="password"
                    required
                    placeholder="Mật khẩu cán bộ"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-950 focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loginBusy}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-lg text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {loginBusy ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      Đang xác thực...
                    </>
                  ) : (
                    <>
                      <LogIn className="w-3.5 h-3.5" />
                      Đăng nhập
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* Authenticated User Actions */
              <>
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
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
