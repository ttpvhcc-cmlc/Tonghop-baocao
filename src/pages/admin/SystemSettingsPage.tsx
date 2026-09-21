import React, { useState, useEffect } from 'react';
import { store, SystemConfig, RolePermissionRule, DEFAULT_SYSTEM_CONFIG } from '../../services/store';
import { Profile, UserRole } from '../../types/database';
import {
  Settings,
  Palette,
  Layout,
  ShieldCheck,
  Building2,
  Landmark,
  FileSpreadsheet,
  Award,
  FolderKanban,
  Save,
  RotateCcw,
  CheckCircle2,
  Users,
  UserPlus,
  Lock,
  Menu,
  Type,
  Image as ImageIcon,
  Edit3,
  Sliders,
  Check,
  X,
  Plus,
  AlertCircle,
  UserCheck,
} from 'lucide-react';

export const SystemSettingsPage: React.FC = () => {
  const [config, setConfig] = useState<SystemConfig>(store.getSystemConfig());
  const [currentUser, setCurrentUser] = useState<Profile>(store.getCurrentUser());
  const [users, setUsers] = useState<Profile[]>(store.getUsers());
  const units = store.getUnits();
  const [activeTab, setActiveTab] = useState<'branding' | 'theme' | 'navigation' | 'permissions' | 'users'>('branding');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);

  // User edit state
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [userFormData, setUserFormData] = useState<{
    full_name: string;
    email: string;
    role: UserRole;
    unit_id: string;
    active: boolean;
    password?: string;
  }>({
    full_name: '',
    email: '',
    role: 'data_entry',
    unit_id: '',
    active: true,
    password: '',
  });
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);

  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setConfig(store.getSystemConfig());
      setCurrentUser(store.getCurrentUser());
      setUsers(store.getUsers());
    };
    return store.subscribe(refresh);
  }, []);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);
    try {
      const res = await store.saveSystemConfig(config);
      if (res.success) {
        setSaveMessage(res.message || 'Đã lưu cấu hình hệ thống thành công.');
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 5000);
      } else {
        setErrorMessage(res.message || 'Không thể lưu cấu hình vào Supabase.');
      }
    } catch (err: any) {
      setErrorMessage('Lỗi hệ thống: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetConfig = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);
    try {
      const res = await store.resetSystemConfig();
      setConfig(store.getSystemConfig());
      setResetModalOpen(false);
      if (res.success) {
        setSaveMessage(res.message || 'Đã khôi phục cài đặt mặc định.');
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 5000);
      } else {
        setErrorMessage(res.message || 'Không thể khôi phục cài đặt trên Supabase.');
      }
    } catch (err: any) {
      setErrorMessage('Lỗi hệ thống khi khôi phục: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePermission = (roleIndex: number, permKey: keyof RolePermissionRule['permissions']) => {
    const updatedPermissions = [...config.rolePermissions];
    updatedPermissions[roleIndex] = {
      ...updatedPermissions[roleIndex],
      permissions: {
        ...updatedPermissions[roleIndex].permissions,
        [permKey]: !updatedPermissions[roleIndex].permissions[permKey],
      },
    };
    setConfig({
      ...config,
      rolePermissions: updatedPermissions,
    });
  };

  const handleOpenCreateUser = () => {
    setEditingUser(null);
    setUserFormData({
      full_name: '',
      email: '',
      role: 'data_entry',
      unit_id: '',
      active: true,
      password: '',
    });
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (user: Profile) => {
    setEditingUser(user);
    setUserFormData({
      full_name: user.full_name,
      email: user.email || '',
      role: user.role,
      unit_id: user.unit_id || '',
      active: user.active,
      password: '',
    });
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await store.saveUser({
          id: editingUser.id,
          full_name: userFormData.full_name,
          email: userFormData.email,
          role: userFormData.role,
          unit_id: userFormData.unit_id,
          active: userFormData.active,
        });
      } else {
        await store.createUser({
          full_name: userFormData.full_name,
          email: userFormData.email,
          role: userFormData.role,
          unit_id: userFormData.unit_id,
          password: userFormData.password || undefined,
        });
      }
      setUsers(store.getUsers());
      setIsUserModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu người dùng');
    }
  };

  const colorThemes: Array<{ id: SystemConfig['themeColor']; name: string; bg: string; ring: string }> = [
    { id: 'blue', name: 'Xanh Lam (Blue)', bg: 'bg-blue-600', ring: 'ring-blue-500' },
    { id: 'indigo', name: 'Xanh Chàm (Indigo)', bg: 'bg-indigo-600', ring: 'ring-indigo-500' },
    { id: 'emerald', name: 'Xanh Ngọc (Emerald)', bg: 'bg-emerald-600', ring: 'ring-emerald-500' },
    { id: 'violet', name: 'Tím Hoa Cà (Violet)', bg: 'bg-violet-600', ring: 'ring-violet-500' },
    { id: 'rose', name: 'Hồng Đỏ (Rose)', bg: 'bg-rose-600', ring: 'ring-rose-500' },
    { id: 'amber', name: 'Hổ Phách (Amber)', bg: 'bg-amber-600', ring: 'ring-amber-500' },
    { id: 'teal', name: 'Xanh Teak (Teal)', bg: 'bg-teal-600', ring: 'ring-teal-500' },
    { id: 'slate', name: 'Xám Hiện Đại (Slate)', bg: 'bg-slate-700', ring: 'ring-slate-500' },
  ];

  const sidebarThemes: Array<{ id: SystemConfig['sidebarTheme']; name: string; bg: string; border: string }> = [
    { id: 'dark', name: 'Đêm Đen Tinh Tế (Dark)', bg: 'bg-slate-900 text-white', border: 'border-slate-800' },
    { id: 'slate', name: 'Xám Thẫm Sang Trọng (Slate)', bg: 'bg-slate-950 text-white', border: 'border-slate-800' },
    { id: 'navy', name: 'Xanh Hải Quân (Navy)', bg: 'bg-blue-950 text-white', border: 'border-blue-900' },
    { id: 'light', name: 'Trắng Sáng (Clean Light)', bg: 'bg-white text-slate-900', border: 'border-slate-200' },
  ];

  const logoIcons = [
    { id: 'ShieldCheck', label: 'Khiên bảo mật', icon: ShieldCheck },
    { id: 'Building2', label: 'Tòa nhà chính quyền', icon: Building2 },
    { id: 'Landmark', label: 'Biểu tượng cơ quan', icon: Landmark },
    { id: 'FileSpreadsheet', label: 'Báo cáo thống kê', icon: FileSpreadsheet },
    { id: 'Award', label: 'Huy hiệu thành tích', icon: Award },
    { id: 'FolderKanban', label: 'Quản lý thư mục', icon: FolderKanban },
  ];

  const permissionLabels: Array<{ key: keyof RolePermissionRule['permissions']; title: string; desc: string }> = [
    { key: 'view_dashboard', title: 'Xem Dashboard / Tổng quan', desc: 'Cho phép truy cập màn hình Tổng quan chỉ tiêu TTHC' },
    { key: 'view_reports', title: 'Xem Danh sách Kỳ Báo cáo', desc: 'Cho phép xem và tra cứu danh sách báo cáo' },
    { key: 'create_reports', title: 'Tạo Kỳ Báo cáo mới', desc: 'Cho phép khởi tạo kỳ báo cáo thống kê mới' },
    { key: 'edit_reports', title: 'Sửa & Nhập liệu Kỳ Báo cáo', desc: 'Cho phép chỉnh sửa số liệu và nộp báo cáo' },
    { key: 'delete_reports', title: 'Xóa Kỳ Báo cáo', desc: 'Cho phép xóa báo cáo khỏi hệ thống' },
    { key: 'import_excel', title: 'Nhập Dữ liệu Excel', desc: 'Cho phép tải file Excel để trích xuất số liệu tự động' },
    { key: 'lock_snapshot', title: 'Khóa / Mở khóa Snapshot', desc: 'Quyền chốt sổ niêm phong báo cáo chính thức' },
    { key: 'manage_catalogs', title: 'Quản lý Danh mục (Đơn vị, Lĩnh vực, Chỉ tiêu)', desc: 'Chỉnh sửa danh mục nghiệp vụ' },
    { key: 'manage_users', title: 'Quản lý Tài khoản Người dùng', desc: 'Thêm, sửa, kích hoạt tài khoản hệ thống' },
    { key: 'manage_system_config', title: 'Thiết lập Tên, Logo, Menu & Giao diện', desc: 'Quyền admin toàn diện cài đặt hệ thống' },
    { key: 'view_audit_logs', title: 'Xem Nhật ký hệ thống (Audit Logs)', desc: 'Tra cứu dấu vết thao tác của người dùng' },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Thiết lập Hệ thống
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Cấu hình Tên hệ thống, Logo, Màu sắc, Tên Menu, Tiêu đề màn hình, Quản trị Người dùng và Phân quyền Cán bộ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => setResetModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-xl transition-colors"
          >
            <RotateCcw className="w-4 h-4 text-slate-500" />
            Khôi phục mặc định
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveConfig}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors"
          >
            {isSaving ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSaving ? 'Đang lưu CSDL...' : 'Lưu tất cả thay đổi'}
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{saveMessage || 'Đã lưu thành công các thiết lập hệ thống! Giao diện và các menu đã được đồng bộ lên CSDL cho tất cả người dùng.'}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold rounded-2xl flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <a
            href="/admin/supabase"
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shrink-0 transition-colors"
          >
            Đến Quản trị Supabase
          </a>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('branding')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'branding'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Thương hiệu & Logo
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('theme')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'theme'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Palette className="w-4 h-4" />
          Màu sắc & Giao diện
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('navigation')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'navigation'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Menu className="w-4 h-4" />
          Tên Menu & Tiêu đề Giao diện
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('permissions')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'permissions'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Lock className="w-4 h-4" />
          Phân quyền Nhóm (RBAC Matrix)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'users'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          Quản lý Người dùng ({users.length})
        </button>
      </div>

      {/* TAB 1: THƯƠNG HIỆU & LOGO */}
      {activeTab === 'branding' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
              <Building2 className="w-5 h-5 text-blue-600" />
              Thông tin Thương hiệu & Logo Hệ thống
            </h2>

            <div className="space-y-4">
              {/* Branding Customization Section */}
              <div className="space-y-5 bg-slate-50/80 p-4 rounded-xl border border-slate-200">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Palette className="w-4 h-4 text-blue-600" />
                  Tùy chỉnh Font chữ & Màu sắc Thương hiệu (Vùng khoanh đỏ Header)
                </h3>

                {/* 1. System Name Config */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-800">
                    Tên Hệ thống
                  </label>
                  <input
                    type="text"
                    value={config.systemName}
                    onChange={(e) => setConfig({ ...config, systemName: e.target.value })}
                    placeholder="Ví dụ: HỆ THỐNG TỔNG HỢP ĐÁNH GIÁ TÌNH HÌNH TIẾP NHẬN, GIẢI QUYẾT THỦ TỤC HÀNH CHÍNH"
                    className="w-full px-3.5 py-2.5 text-sm font-semibold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    {/* System Name Color */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Màu chữ Tên Hệ thống:
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={config.systemNameColor || '#0f172a'}
                          onChange={(e) => setConfig({ ...config, systemNameColor: e.target.value })}
                          className="w-8 h-8 rounded-lg cursor-pointer border border-slate-300 p-0.5 bg-white shrink-0"
                        />
                        <input
                          type="text"
                          value={config.systemNameColor || '#0f172a'}
                          onChange={(e) => setConfig({ ...config, systemNameColor: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                    </div>

                    {/* System Name Font Size */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Kích thước Font chữ:
                      </label>
                      <select
                        value={config.systemNameFontSize || '15px'}
                        onChange={(e) => setConfig({ ...config, systemNameFontSize: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-medium"
                      >
                        <option value="13px">13px (Nhỏ vừa)</option>
                        <option value="14px">14px (Vừa tiêu chuẩn)</option>
                        <option value="15px">15px (Nổi bật - Mặc định)</option>
                        <option value="16px">16px (Lớn)</option>
                        <option value="18px">18px (Rất lớn)</option>
                        <option value="20px">20px (Đặc biệt lớn)</option>
                      </select>
                    </div>

                    {/* System Name Font Weight */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Độ đậm Font chữ:
                      </label>
                      <select
                        value={config.systemNameFontWeight || 'font-extrabold'}
                        onChange={(e) => setConfig({ ...config, systemNameFontWeight: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-medium"
                      >
                        <option value="font-semibold">Semibold (Đậm vừa)</option>
                        <option value="font-bold">Bold (Đậm chuẩn)</option>
                        <option value="font-extrabold">Extrabold (Rất đậm - Nổi bật)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. SubTitle Config */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <label className="block text-xs font-semibold text-slate-800">
                    Phụ đề / Cơ quan chủ quản (Dưới tên hệ thống)
                  </label>
                  <input
                    type="text"
                    value={config.subTitle}
                    onChange={(e) => setConfig({ ...config, subTitle: e.target.value })}
                    placeholder="Ví dụ: Trung tâm Phục vụ hành chính công xã Chân Mây - Lăng Cô"
                    className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* SubTitle Color */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Màu chữ Phụ đề:
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={config.subTitleColor || '#475569'}
                          onChange={(e) => setConfig({ ...config, subTitleColor: e.target.value })}
                          className="w-8 h-8 rounded-lg cursor-pointer border border-slate-300 p-0.5 bg-white shrink-0"
                        />
                        <input
                          type="text"
                          value={config.subTitleColor || '#475569'}
                          onChange={(e) => setConfig({ ...config, subTitleColor: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                    </div>

                    {/* SubTitle Font Size */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Kích thước Font Phụ đề:
                      </label>
                      <select
                        value={config.subTitleFontSize || '11px'}
                        onChange={(e) => setConfig({ ...config, subTitleFontSize: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-medium"
                      >
                        <option value="10px">10px (Nhỏ gọn)</option>
                        <option value="11px">11px (Mặc định chuẩn)</option>
                        <option value="12px">12px (Vừa)</option>
                        <option value="13px">13px (Lớn)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 3. Logo Size Config */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <label className="block text-xs font-semibold text-slate-800">
                    Kích thước Khung Logo (Đường kính):
                  </label>
                  <div className="flex items-center gap-3">
                    {[28, 32, 36, 40, 48, 56].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setConfig({ ...config, logoSize: size })}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                          (config.logoSize || 36) === size
                            ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {size}px
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Logo Selection */}
              <div className="pt-3 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Phương thức hiển thị Logo
                </label>

                <div className="flex items-center gap-4 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                    <input
                      type="radio"
                      name="logoType"
                      checked={config.logoType === 'icon'}
                      onChange={() => setConfig({ ...config, logoType: 'icon' })}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    Sử dụng Biểu tượng Preset
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                    <input
                      type="radio"
                      name="logoType"
                      checked={config.logoType === 'custom_url'}
                      onChange={() => setConfig({ ...config, logoType: 'custom_url' })}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    Nhập URL ảnh Logo tùy chỉnh
                  </label>
                </div>

                {config.logoType === 'icon' ? (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-2">
                      Chọn Biểu tượng Logo từ thư viện:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {logoIcons.map((item) => {
                        const IconComponent = item.icon;
                        const isSelected = config.logoIcon === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setConfig({ ...config, logoIcon: item.id })}
                            className={`p-3 rounded-xl border flex items-center gap-3 text-left transition-all ${
                              isSelected
                                ? 'border-blue-600 bg-blue-50/70 text-blue-700 ring-2 ring-blue-500/20'
                                : 'border-slate-200 hover:border-slate-300 text-slate-700'
                            }`}
                          >
                            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                              <IconComponent className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-semibold leading-snug">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Đường dẫn URL ảnh Logo (HTTPS):
                    </label>
                    <input
                      type="text"
                      value={config.logoUrl || ''}
                      onChange={(e) => setConfig({ ...config, logoUrl: e.target.value })}
                      placeholder="https://example.com/logo-ubnd.png"
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg border border-slate-800 space-y-4 h-fit">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-800 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-blue-400" />
              Xem trước Thương hiệu & Bố trí Giao diện
            </h3>

            {/* Header Preview */}
            <div className="p-3 bg-white text-slate-900 rounded-xl border border-slate-200 shadow-xs">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Xem trước Thanh Header Chính (Vùng khoanh đỏ):</p>
              <div className="flex items-center gap-2.5 p-2 bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                <div
                  className="rounded-lg bg-transparent flex items-center justify-center shrink-0 overflow-hidden"
                  style={{ width: `${config.logoSize || 36}px`, height: `${config.logoSize || 36}px` }}
                >
                  {config.logoType === 'custom_url' && config.logoUrl ? (
                    <img src={config.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <ShieldCheck className="w-5 h-5 text-blue-600" />
                  )}
                </div>
                <div className="min-w-0">
                  <h4
                    className={`truncate leading-tight ${config.systemNameFontWeight || 'font-extrabold'}`}
                    style={{
                      color: config.systemNameColor || '#0f172a',
                      fontSize: config.systemNameFontSize || '14px'
                    }}
                  >
                    {config.systemName || 'HỆ THỐNG'}
                  </h4>
                  <p
                    className="truncate mt-0.5 font-medium"
                    style={{
                      color: config.subTitleColor || '#475569',
                      fontSize: config.subTitleFontSize || '11px'
                    }}
                  >
                    {config.subTitle || 'TTPVHCC'}
                  </p>
                </div>
              </div>
            </div>

            {/* Sidebar Preview */}
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Xem trước Đầu Sidebar (Tài khoản User):</p>
              <div className="flex items-center gap-2.5 p-2 bg-slate-800/80 rounded-lg border border-slate-700/60">
                <div className="w-7 h-7 rounded-lg bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300 shrink-0">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate leading-tight">{currentUser.email || currentUser.full_name}</p>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">Quản trị viên (Admin)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MÀU SẮC & GIAO DIỆN */}
      {activeTab === 'theme' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
              <Palette className="w-5 h-5 text-blue-600" />
              Màu sắc Chủ đạo & Theme Giao diện
            </h2>

            {/* Primary Accent Color */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                1. Tông màu Nút bấm & Điểm nhấn Chủ đạo (Primary Color)
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {colorThemes.map((c) => {
                  const isSelected = config.themeColor === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setConfig({ ...config, themeColor: c.id })}
                      className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                        isSelected
                          ? `border-slate-900 bg-slate-50 ring-2 ${c.ring}`
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className={`w-6 h-6 rounded-full ${c.bg} shadow-xs shrink-0 flex items-center justify-center text-white`}>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </span>
                      <span className="text-xs font-semibold text-slate-800">{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sidebar Theme */}
            <div className="pt-4 border-t border-slate-100">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                2. Mẫu Nền Menu Bên trái (Sidebar Theme)
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {sidebarThemes.map((s) => {
                  const isSelected = config.sidebarTheme === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setConfig({ ...config, sidebarTheme: s.id })}
                      className={`p-4 rounded-2xl border flex flex-col justify-between h-28 transition-all ${s.bg} ${
                        isSelected ? 'ring-2 ring-blue-500 border-blue-500 shadow-md' : 'border-slate-300 opacity-90'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-bold">{s.name}</span>
                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                            ✓
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 opacity-60 text-[10px]">
                        <span className="w-2 h-2 rounded-full bg-current"></span>
                        <span>Menu & Icon</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TÙY CHỈNH TÊN MENU & TIÊU ĐỀ GIAO DIỆN */}
      {activeTab === 'navigation' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Menu Labels */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
              <Menu className="w-5 h-5 text-blue-600" />
              Đổi tên hiển thị các Menu trên Sidebar
            </h2>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Menu Tổng quan (Dashboard):</label>
                <input
                  type="text"
                  value={config.menuLabels.dashboard}
                  onChange={(e) => setConfig({ ...config, menuLabels: { ...config.menuLabels, dashboard: e.target.value } })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Menu Kỳ Báo cáo (Reports List):</label>
                <input
                  type="text"
                  value={config.menuLabels.reports}
                  onChange={(e) => setConfig({ ...config, menuLabels: { ...config.menuLabels, reports: e.target.value } })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Menu Kho lưu trữ (Archive):</label>
                <input
                  type="text"
                  value={config.menuLabels.archive}
                  onChange={(e) => setConfig({ ...config, menuLabels: { ...config.menuLabels, archive: e.target.value } })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Menu Tạo báo cáo mới:</label>
                <input
                  type="text"
                  value={config.menuLabels.new_report}
                  onChange={(e) => setConfig({ ...config, menuLabels: { ...config.menuLabels, new_report: e.target.value } })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Menu Nhập dữ liệu Excel:</label>
                <input
                  type="text"
                  value={config.menuLabels.import}
                  onChange={(e) => setConfig({ ...config, menuLabels: { ...config.menuLabels, import: e.target.value } })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tên Nhóm Phân tích (Group Title):</label>
                <input
                  type="text"
                  value={config.menuLabels.analysis_group}
                  onChange={(e) => setConfig({ ...config, menuLabels: { ...config.menuLabels, analysis_group: e.target.value } })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Submenu Phân tích Đơn vị:</label>
                <input
                  type="text"
                  value={config.menuLabels.analysis_units}
                  onChange={(e) => setConfig({ ...config, menuLabels: { ...config.menuLabels, analysis_units: e.target.value } })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Submenu Phân tích Lĩnh vực:</label>
                <input
                  type="text"
                  value={config.menuLabels.analysis_fields}
                  onChange={(e) => setConfig({ ...config, menuLabels: { ...config.menuLabels, analysis_fields: e.target.value } })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Submenu So sánh nhiều kỳ:</label>
                <input
                  type="text"
                  value={config.menuLabels.analysis_compare}
                  onChange={(e) => setConfig({ ...config, menuLabels: { ...config.menuLabels, analysis_compare: e.target.value } })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Page Titles */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
              <Type className="w-5 h-5 text-blue-600" />
              Đổi Tiêu đề các Giao diện / Màn hình chính
            </h2>

            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tiêu đề Màn hình Dashboard:</label>
                <input
                  type="text"
                  value={config.pageTitles.dashboardTitle}
                  onChange={(e) => setConfig({ ...config, pageTitles: { ...config.pageTitles, dashboardTitle: e.target.value } })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mô tả phụ Màn hình Dashboard:</label>
                <input
                  type="text"
                  value={config.pageTitles.dashboardSubtitle}
                  onChange={(e) => setConfig({ ...config, pageTitles: { ...config.pageTitles, dashboardSubtitle: e.target.value } })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tiêu đề Danh sách Kỳ báo cáo:</label>
                <input
                  type="text"
                  value={config.pageTitles.reportsListTitle}
                  onChange={(e) => setConfig({ ...config, pageTitles: { ...config.pageTitles, reportsListTitle: e.target.value } })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tiêu đề Màn hình Nhập Excel:</label>
                <input
                  type="text"
                  value={config.pageTitles.importTitle}
                  onChange={(e) => setConfig({ ...config, pageTitles: { ...config.pageTitles, importTitle: e.target.value } })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tiêu đề Màn hình So sánh Biến động:</label>
                <input
                  type="text"
                  value={config.pageTitles.compareTitle}
                  onChange={(e) => setConfig({ ...config, pageTitles: { ...config.pageTitles, compareTitle: e.target.value } })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PHÂN QUYỀN NHÓM NGƯỜI DÙNG (RBAC MATRIX) */}
      {activeTab === 'permissions' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-5 h-5 text-blue-600" />
                Ma trận Phân quyền theo Nhóm Người dùng (RBAC Matrix)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Bật/tắt các quyền thao tác cho từng nhóm vai trò trong toàn bộ ứng dụng
              </p>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <th className="p-4 w-2/5">Tên Quyền & Mức độ Quyền hạn</th>
                  {config.rolePermissions.map((r) => (
                    <th key={r.role} className="p-4 text-center w-1/5">
                      <div className="font-bold text-slate-900">{r.roleName}</div>
                      <div className="text-[10px] font-normal text-slate-500 tracking-normal capitalize">
                        Role: {r.role}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {permissionLabels.map((perm) => (
                  <tr key={perm.key} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-900 text-xs">{perm.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{perm.desc}</div>
                    </td>

                    {config.rolePermissions.map((r, roleIdx) => {
                      const isChecked = r.permissions[perm.key];
                      return (
                        <td key={r.role} className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleTogglePermission(roleIdx, perm.key)}
                            className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all ${
                              isChecked
                                ? 'bg-emerald-500 text-white shadow-2xs hover:bg-emerald-600'
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                            }`}
                          >
                            {isChecked ? <Check className="w-4 h-4 stroke-[3]" /> : <X className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: QUẢN LÝ NGƯỜI DÙNG */}
      {activeTab === 'users' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Danh sách Tài khoản Người dùng & Nhóm Quyền
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Chỉnh sửa thông tin tài khoản, gán đơn vị trực thuộc và phân nhóm vai trò
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={handleOpenCreateUser}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all cursor-pointer shadow-xs"
              >
                <UserPlus className="w-4 h-4" />
                Thêm tài khoản mới
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider">
                  <th className="p-3.5">Họ & Tên</th>
                  <th className="p-3.5">Email</th>
                  <th className="p-3.5">Nhóm Vai trò (Role)</th>
                  <th className="p-3.5">Đơn vị</th>
                  <th className="p-3.5 text-center">Trạng thái</th>
                  <th className="p-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const userUnit = units.find((un) => un.id === u.unit_id);
                  return (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="p-3.5 font-bold text-slate-900">{u.full_name}</td>
                      <td className="p-3.5 text-slate-600">{u.email || '—'}</td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-600">{userUnit ? userUnit.name : 'Toàn hệ thống'}</td>
                      <td className="p-3.5 text-center">
                        {u.active ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                            Hoạt động
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded-md">
                            Khóa
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenEditUser(u)}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Sửa
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Edit/Create User */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingUser ? 'Sửa thông tin Tài khoản' : 'Thêm mới Tài khoản Người dùng'}
              </h3>
              <button type="button" onClick={() => setIsUserModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Họ và Tên <span className="text-rose-500">*</span>:</label>
                <input
                  type="text"
                  required
                  value={userFormData.full_name}
                  onChange={(e) => setUserFormData({ ...userFormData, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email công vụ <span className="text-rose-500">*</span>:</label>
                <input
                  type="email"
                  required
                  disabled={!!editingUser}
                  placeholder="Viết liền không dấu, VD: canbo@domain.vn"
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                  className={`w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 ${
                    editingUser ? 'bg-slate-100 cursor-not-allowed opacity-75' : ''
                  }`}
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mật khẩu khởi tạo <span className="text-rose-500">*</span>:</label>
                  <input
                    type="password"
                    required
                    placeholder="Mật khẩu tối thiểu 6 ký tự..."
                    value={userFormData.password}
                    onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Cấp mật khẩu để cán bộ đăng nhập lần đầu.</p>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nhóm vai trò (Role) <span className="text-rose-500">*</span>:</label>
                <select
                  value={userFormData.role}
                  onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value as UserRole })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
                >
                  <option value="admin">Admin - Quản trị viên</option>
                  <option value="analyst">Analyst - Chuyên viên phân tích</option>
                  <option value="data_entry">Data Entry - Chuyên viên nhập liệu</option>
                  <option value="viewer">Viewer - Người xem (Chỉ đọc)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Đơn vị trực thuộc:</label>
                <select
                  value={userFormData.unit_id}
                  onChange={(e) => setUserFormData({ ...userFormData, unit_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
                >
                  <option value="">Toàn tỉnh / Không giới hạn</option>
                  {units.map((un) => (
                    <option key={un.id} value={un.id}>
                      {un.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="userActive"
                  checked={userFormData.active}
                  onChange={(e) => setUserFormData({ ...userFormData, active: e.target.checked })}
                  className="rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="userActive" className="font-semibold text-slate-700 cursor-pointer select-none">
                  Tài khoản đang Hoạt động (Active)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs cursor-pointer"
                >
                  {editingUser ? 'Lưu thay đổi' : 'Thêm tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Reset Confirmation */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Xác nhận khôi phục mặc định?</h3>
            <p className="text-xs text-slate-600">
              Hành động này sẽ đặt lại tất cả Tên hệ thống, Logo, Màu sắc, Tên Menu và Ma trận Phân quyền về giá trị chuẩn ban đầu của hệ thống.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleResetConfig}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs"
              >
                Đồng ý khôi phục
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
