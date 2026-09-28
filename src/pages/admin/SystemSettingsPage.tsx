import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { store, SystemConfig, RolePermissionRule, DEFAULT_SYSTEM_CONFIG } from '../../services/store';
import { Profile, UserRole } from '../../types/database';
import { roundNumber } from '../../utils/format';
import { PublicDisplayConfigTab } from './PublicDisplayConfigTab';
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
  LogIn,
  Scale,
  Briefcase,
  Sparkles,
  Mail,
  Tv,
  SlidersHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  BellRing,
  FileText,
  Archive,
  BarChart3,
  GitCompare,
  CalendarRange,
  History,
  Database,
  Download,
  CheckSquare,
  Search,
} from 'lucide-react';

export const SystemSettingsPage: React.FC = () => {
  const [config, setConfig] = useState<SystemConfig>(store.getSystemConfig());
  const [currentUser, setCurrentUser] = useState<Profile>(store.getCurrentUser());
  const [users, setUsers] = useState<Profile[]>(store.getUsers());
  const units = store.getUnits();
  const [activeTab, setActiveTab] = useState<'ui' | 'navigation' | 'ai_template' | 'urge_templates' | 'permissions' | 'users' | 'public_display'>('ui');
  const [uiSubTab, setUiSubTab] = useState<'branding' | 'login' | 'theme' | 'rounding'>('branding');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [permSearchKeyword, setPermSearchKeyword] = useState('');
  const [selectedPermCategory, setSelectedPermCategory] = useState<string>('all');

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

  const handleToggleAllForRole = (roleIndex: number, enable: boolean) => {
    const updatedPermissions = [...config.rolePermissions];
    const role = updatedPermissions[roleIndex];
    const newPerms = { ...role.permissions };
    allPermissionsList.forEach((p) => {
      newPerms[p.key] = enable;
    });
    updatedPermissions[roleIndex] = {
      ...role,
      permissions: newPerms,
    };
    setConfig({
      ...config,
      rolePermissions: updatedPermissions,
    });
  };

  const handleResetRolePermissionsToDefault = (roleIndex?: number) => {
    if (typeof roleIndex === 'number') {
      const targetRole = config.rolePermissions[roleIndex];
      const defaultRole = DEFAULT_SYSTEM_CONFIG.rolePermissions.find((r) => r.role === targetRole.role);
      if (!defaultRole) return;
      const updatedPermissions = [...config.rolePermissions];
      updatedPermissions[roleIndex] = {
        ...targetRole,
        permissions: { ...defaultRole.permissions },
      };
      setConfig({
        ...config,
        rolePermissions: updatedPermissions,
      });
    } else {
      setConfig({
        ...config,
        rolePermissions: DEFAULT_SYSTEM_CONFIG.rolePermissions.map((r) => ({
          ...r,
          permissions: { ...r.permissions },
        })),
      });
    }
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

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsSaving(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('logos').getPublicUrl(filePath);
      setConfig({ ...config, logoUrl: data.publicUrl, logoType: 'custom_url' });
      setSaveMessage('Đã tải ảnh lên thành công!');
      setTimeout(() => setSaveMessage(null), 5000);
    } catch (err: any) {
      setErrorMessage('Lỗi khi tải ảnh: ' + err.message);
    } finally {
      setIsSaving(false);
    }
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
    { id: 'Scale', label: 'Cán cân công lý', icon: Scale },
    { id: 'Briefcase', label: 'Công vụ hành chính', icon: Briefcase },
  ];

  const loginBgThemes: Array<{
    id: NonNullable<SystemConfig['loginBgTheme']>;
    name: string;
    desc: string;
    gradientClass: string;
  }> = [
    {
      id: 'navy',
      name: 'Xanh Hải Quân (Navy Blue)',
      desc: 'Sang trọng, uy nghiêm, tiêu chuẩn công vụ',
      gradientClass: 'bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950',
    },
    {
      id: 'indigo',
      name: 'Xanh Chàm Hoàng Gia (Royal Indigo)',
      desc: 'Hiện đại, chuyên nghiệp, chiều sâu công nghệ',
      gradientClass: 'bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-900',
    },
    {
      id: 'blue',
      name: 'Xanh Lam Hành Chính (Classic Blue)',
      desc: 'Tươi sáng, năng động, thân thiện phục vụ nhân dân',
      gradientClass: 'bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900',
    },
    {
      id: 'emerald',
      name: 'Xanh Ngọc Công Vụ (Deep Emerald)',
      desc: 'Trang nhã, phát triển bền vững, tinh tế',
      gradientClass: 'bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-950',
    },
    {
      id: 'crimson',
      name: 'Đỏ Đô Hành Chính (Administrative Crimson)',
      desc: 'Trang nghiêm, truyền thống nhà nước',
      gradientClass: 'bg-gradient-to-br from-stone-950 via-red-950 to-rose-950',
    },
    {
      id: 'slate',
      name: 'Xám Thẫm Sang Trọng (Deep Slate)',
      desc: 'Tối giản, trung tính cao cấp',
      gradientClass: 'bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-900',
    },
    {
      id: 'dark',
      name: 'Đêm Đen Huyền Bí (Pure Dark)',
      desc: 'Độ tương phản cao, hiện đại',
      gradientClass: 'bg-gradient-to-br from-black via-zinc-950 to-slate-950',
    },
    {
      id: 'custom',
      name: 'Màu Tùy Chỉnh (Custom Hex Color)',
      desc: 'Nhập mã màu Hex theo nhận diện địa phương',
      gradientClass: 'bg-slate-800',
    },
  ];

  const loginFontFamilies: Array<{
    id: NonNullable<SystemConfig['loginFontFamily']>;
    name: string;
    sample: string;
    fontClass: string;
  }> = [
    {
      id: 'sans',
      name: 'Sans-serif Mặc định',
      sample: 'Aa Bb Cc 123 (Hệ thống)',
      fontClass: 'font-sans',
    },
    {
      id: 'be_vietnam_pro',
      name: 'Be Vietnam Pro',
      sample: 'Tiêu chuẩn Phông chữ Hành chính Quốc gia Việt Nam',
      fontClass: "font-['Be_Vietnam_Pro',sans-serif]",
    },
    {
      id: 'montserrat',
      name: 'Montserrat',
      sample: 'Hiện đại, Trang trọng, Đẳng cấp',
      fontClass: "font-['Montserrat',sans-serif]",
    },
    {
      id: 'roboto',
      name: 'Roboto',
      sample: 'Rõ ràng, Dễ đọc, Tiêu chuẩn Kỹ thuật',
      fontClass: "font-['Roboto',sans-serif]",
    },
    {
      id: 'inter',
      name: 'Inter',
      sample: 'Giao diện Tinh gọn, Số hóa',
      fontClass: "font-['Inter',sans-serif]",
    },
    {
      id: 'playfair',
      name: 'Playfair Display (Serif)',
      sample: 'Trang nghiêm, Quý phái, Văn bản Pháp quy',
      fontClass: "font-['Playfair_Display',serif]",
    },
    {
      id: 'merriweather',
      name: 'Merriweather (Serif)',
      sample: 'Đĩnh đạc, Dễ chịu, Báo chí',
      fontClass: "font-['Merriweather',serif]",
    },
  ];

  const permissionCategories: Array<{
    id: string;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    permissions: Array<{
      key: keyof RolePermissionRule['permissions'];
      title: string;
      desc: string;
    }>;
  }> = [
    {
      id: 'dashboard',
      title: '1. Tổng quan & Kiosk TV',
      icon: LayoutDashboard,
      color: 'text-blue-600 bg-blue-50 border-blue-200',
      permissions: [
        {
          key: 'view_dashboard',
          title: 'Xem Dashboard / Tổng quan',
          desc: 'Truy cập màn hình Tổng quan chỉ tiêu TTHC (tiếp nhận, giải quyết, đúng hạn TT01 & QĐ766)',
        },
        {
          key: 'view_public_dashboard',
          title: 'Xem Màn hình TV 55" Kiosk',
          desc: 'Truy cập giao diện Kiosk công khai trình chiếu số liệu thời gian thực',
        },
        {
          key: 'customize_dashboard_layout',
          title: 'Tùy biến Bố cục & Biểu đồ',
          desc: 'Sắp xếp, ẩn/hiện, thay đổi màu sắc, chú giải và ghi chú chân biểu đồ Dashboard',
        },
      ],
    },
    {
      id: 'dossier_urge',
      title: '2. Đôn đốc hồ sơ TTHC',
      icon: BellRing,
      color: 'text-amber-600 bg-amber-50 border-amber-200',
      permissions: [
        {
          key: 'view_dossier_urge',
          title: 'Xem Danh sách Hồ sơ đôn đốc',
          desc: 'Tra cứu danh sách hồ sơ quá hạn, sắp đến hạn theo từng đơn vị và lĩnh vực',
        },
        {
          key: 'manage_dossier_urge',
          title: 'Xử lý & Xuất phiếu đôn đốc',
          desc: 'Thực hiện đôn đốc, gửi cảnh báo, ghi chú tiến độ và xuất văn bản/phiếu đôn đốc',
        },
        {
          key: 'config_urge_templates',
          title: 'Cấu hình Mẫu văn bản đôn đốc',
          desc: 'Tùy chỉnh mẫu phiếu cảnh báo, thời hạn ngưỡng đôn đốc và quy chuẩn ban hành',
        },
      ],
    },
    {
      id: 'reports',
      title: '3. Cập nhật Báo cáo & Kho lưu trữ',
      icon: FileText,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      permissions: [
        {
          key: 'view_reports',
          title: 'Xem Danh sách & Chi tiết Kỳ Báo cáo',
          desc: 'Tra cứu danh sách các kỳ báo cáo thống kê tình hình TTHC đã tạo',
        },
        {
          key: 'create_reports',
          title: 'Khởi tạo Kỳ Báo cáo mới',
          desc: 'Tạo kỳ báo cáo thống kê mới (tháng, quý, năm, chuyên đề đột xuất)',
        },
        {
          key: 'edit_reports',
          title: 'Sửa số liệu & Nộp Báo cáo',
          desc: 'Chỉnh sửa, cập nhật số liệu chỉ tiêu và nộp kỳ báo cáo',
        },
        {
          key: 'delete_reports',
          title: 'Xóa Kỳ Báo cáo',
          desc: 'Quyền xóa bỏ kỳ báo cáo chưa khóa khỏi hệ thống',
        },
        {
          key: 'import_excel',
          title: 'Nhập Dữ liệu Báo cáo Excel',
          desc: 'Tải file Excel để trích xuất số liệu tự động, ánh xạ cột và kiểm tra hợp lệ',
        },
        {
          key: 'lock_snapshot',
          title: 'Khóa / Mở khóa Snapshot',
          desc: 'Quyền chốt sổ niêm phong báo cáo chính thức và tạo bản ghi snapshot bất biến',
        },
        {
          key: 'view_archive',
          title: 'Khai thác Kho lưu trữ',
          desc: 'Truy cập và tra cứu kho lưu trữ số liệu các kỳ báo cáo lịch sử',
        },
      ],
    },
    {
      id: 'analysis',
      title: '4. Phân tích chuyên sâu & Trợ lý AI',
      icon: BarChart3,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
      permissions: [
        {
          key: 'view_analysis_units',
          title: 'Phân tích theo Đơn vị giải quyết',
          desc: 'Xem chi tiết hiệu suất, tỷ lệ đúng hạn và xếp hạng theo từng đơn vị',
        },
        {
          key: 'view_analysis_fields',
          title: 'Phân tích theo Lĩnh vực TTHC',
          desc: 'Xem cơ cấu hồ sơ tiếp nhận, giải quyết và phân bổ chất lượng theo lĩnh vực',
        },
        {
          key: 'view_analysis_compare',
          title: 'Phân tích So sánh Biến động',
          desc: 'Đối chiếu xu hướng tăng giảm chỉ tiêu giữa các kỳ báo cáo khác nhau',
        },
        {
          key: 'use_ai_analysis',
          title: 'Sử dụng Trợ lý AI (Gemini)',
          desc: 'Tự động tạo nhận xét, phân tích số liệu thông minh và khuyến nghị điều hành',
        },
        {
          key: 'export_data',
          title: 'Xuất Dữ liệu & Báo cáo (Excel / PDF)',
          desc: 'Tải xuất dữ liệu phân tích ra file Excel, CSV, in ấn và xuất tài liệu PDF',
        },
      ],
    },
    {
      id: 'catalogs',
      title: '5. Kiểm soát TTHC & Danh mục quản trị',
      icon: FolderKanban,
      color: 'text-teal-600 bg-teal-50 border-teal-200',
      permissions: [
        {
          key: 'manage_procedures_control',
          title: 'Kiểm soát Thủ tục Hành chính (TTHC)',
          desc: 'Quản lý danh mục thủ tục hành chính, quy trình và lĩnh vực thuộc đơn vị',
        },
        {
          key: 'manage_catalogs',
          title: 'Quản lý Danh mục chung',
          desc: 'Quyền quản trị tổng quát toàn bộ các danh mục nghiệp vụ trong hệ thống',
        },
        {
          key: 'manage_units_catalog',
          title: 'Quản lý Danh mục Đơn vị giải quyết',
          desc: 'Thêm mới, sửa đổi, kích hoạt và sắp xếp thứ tự đơn vị tiếp nhận/giải quyết',
        },
        {
          key: 'manage_indicators_catalog',
          title: 'Quản lý Chỉ tiêu & Công thức tính',
          desc: 'Cấu hình mã chỉ tiêu, thứ tự và công thức tính toán QĐ 766 & TT 01',
        },
        {
          key: 'manage_period_types_catalog',
          title: 'Quản lý Loại kỳ báo cáo',
          desc: 'Thiết lập chu kỳ báo cáo (tháng, quý, năm) và hạn mức ngày nộp báo cáo',
        },
      ],
    },
    {
      id: 'system',
      title: '6. Hệ thống, Người dùng & Bảo mật',
      icon: ShieldCheck,
      color: 'text-rose-600 bg-rose-50 border-rose-200',
      permissions: [
        {
          key: 'manage_users',
          title: 'Quản trị Tài khoản & Phân quyền',
          desc: 'Thêm, sửa tài khoản, đổi mật khẩu, gán đơn vị trực thuộc và phân vai trò',
        },
        {
          key: 'manage_system_config',
          title: 'Thiết lập Tên, Logo, Menu & Giao diện',
          desc: 'Quyền cấu hình tên cơ quan, logo, bảng màu, sắp xếp menu và màn hình TV',
        },
        {
          key: 'view_audit_logs',
          title: 'Xem Nhật ký hệ thống (Audit Logs)',
          desc: 'Tra cứu lịch sử thao tác, dấu vết đăng nhập và biến động dữ liệu',
        },
        {
          key: 'manage_database_test',
          title: 'Kiểm thử & Quản trị CSDL Supabase',
          desc: 'Kiểm tra trạng thái kết nối và cấu trúc dữ liệu Supabase',
        },
      ],
    },
  ];

  const allPermissionsList = permissionCategories.flatMap((c) => c.permissions);

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
              Thiết lập Hệ thống & Giao diện
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
            onClick={handleSaveConfig}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors cursor-pointer"
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
          onClick={() => setActiveTab('ui')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'ui'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Palette className="w-4 h-4" />
          Giao diện
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
          Tên Menu và Tiêu đề Giao diện
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ai_template')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'ai_template'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Sparkles className="w-4 h-4 text-indigo-600" />
          Mẫu nhận xét AI
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('urge_templates')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'urge_templates'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Edit3 className="w-4 h-4 text-blue-600" />
          Mẫu Đôn đốc & Đề nghị
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

        <button
          type="button"
          onClick={() => setActiveTab('public_display')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'public_display'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Tv className="w-4 h-4 text-slate-600" />
          <span>Màn hình TV 55" (Kiosk)</span>
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-bold border border-slate-200">
            Trình chiếu
          </span>
        </button>
      </div>

      {/* TAB MÀN HÌNH TV 55" (KIOSK DISPLAY) */}
      {activeTab === 'public_display' && (
        <PublicDisplayConfigTab config={config} onChange={setConfig} />
      )}

      {/* TAB GIAO DIỆN (Bao gồm: Thương hiệu & Header, Giao diện Trang Đăng nhập, Màu sắc & Theme) */}
      {activeTab === 'ui' && (
        <div className="space-y-6">
          {/* Sub-tab Pill Selector */}
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/90 rounded-2xl w-fit border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setUiSubTab('branding')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                uiSubTab === 'branding'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              1. Thương hiệu và Header
            </button>

            <button
              type="button"
              onClick={() => setUiSubTab('login')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                uiSubTab === 'login'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <LogIn className="w-3.5 h-3.5 text-blue-600" />
              2. Giao diện Trang Đăng nhập
            </button>

            <button
              type="button"
              onClick={() => setUiSubTab('theme')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                uiSubTab === 'theme'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Palette className="w-3.5 h-3.5 text-blue-600" />
              3. Màu sắc và Giao diện
            </button>

            <button
              type="button"
              onClick={() => setUiSubTab('rounding')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                uiSubTab === 'rounding'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
              4. Làm tròn Số liệu Tỷ lệ (%)
            </button>
          </div>

          {/* SUBTAB 1: THƯƠNG HIỆU & HEADER */}
          {uiSubTab === 'branding' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
              <Building2 className="w-5 h-5 text-blue-600" />
              Thông tin Thương hiệu và Logo Hệ thống
            </h2>

            <div className="space-y-4">
              {/* Branding Customization Section */}
              <div className="space-y-5 bg-slate-50/80 p-4 rounded-xl border border-slate-200">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Palette className="w-4 h-4 text-blue-600" />
                  Tùy chỉnh Font chữ và Màu sắc Thương hiệu (Vùng khoanh đỏ Header)
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
                    Tải logo lên từ máy tính
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
                      Chọn file ảnh Logo (PNG, JPG, SVG):
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadLogo}
                      className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {config.logoUrl && (
                      <div className="mt-2 text-[10px] text-slate-500 truncate">
                        URL hiện tại: {config.logoUrl}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg border border-slate-800 space-y-4 h-fit">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-800 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-blue-400" />
              Xem trước Thương hiệu và Bố trí Giao diện
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

      {/* SUBTAB 2: THIẾT LẬP GIAO DIỆN TRANG ĐĂNG NHẬP */}
      {uiSubTab === 'login' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Controls Column */}
          <div className="xl:col-span-7 space-y-6">
            {/* Quick Actions / Sync Bar */}
            <div className="p-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 rounded-2xl border border-blue-200/80 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Đồng bộ Nhanh Thiết lập Thương hiệu</h4>
                  <p className="text-[11px] text-slate-500">Sao chép cấu hình tiêu đề, logo và màu sắc trong 1 chạm</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setConfig({
                      ...config,
                      loginSystemName: config.systemName,
                      loginSubTitle: config.subTitle,
                      loginLogoType: config.logoType === 'custom_url' ? 'custom_url' : 'icon',
                      loginLogoIcon: config.logoIcon || 'ShieldCheck',
                      loginLogoUrl: config.logoUrl || '',
                      loginLogoSize: 64,
                      loginLogoPosition: 'left',
                    });
                  }}
                  className="px-3 py-1.5 bg-white text-blue-700 hover:bg-blue-600 hover:text-white border border-blue-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  Đồng bộ từ Header
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setConfig({
                      ...config,
                      loginBgTheme: 'crimson',
                      loginLogoPosition: 'left',
                      loginLogoType: 'icon',
                      loginLogoIcon: 'ShieldCheck',
                      loginLogoSize: 64,
                      loginSystemNameColor: '#ffffff',
                      loginSystemNameFontSize: '24px',
                      loginSystemNameFontWeight: 'font-black',
                      loginSubTitleColor: '#fee2e2',
                      loginSubTitleFontSize: '14px',
                      loginSubTitleFontWeight: 'font-semibold',
                    });
                  }}
                  className="px-3 py-1.5 bg-rose-600 text-white hover:bg-rose-700 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Mẫu Đỏ Đô (Ảnh chuẩn)
                </button>
              </div>
            </div>

            {/* Section 1: Tên Hệ thống & Tiêu đề Trang Login */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Type className="w-4 h-4 text-blue-600" />
                  1. Tên Hệ thống và Tiêu đề Trang Đăng nhập
                </h2>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, loginSystemName: config.systemName })}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                >
                  Lấy theo Tên Header
                </button>
              </div>

              {/* Login System Name Input */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-800">
                  Nội dung Tên Hệ thống (Banner Đăng nhập)
                </label>
                <input
                  type="text"
                  value={config.loginSystemName ?? ''}
                  onChange={(e) => setConfig({ ...config, loginSystemName: e.target.value })}
                  placeholder={config.systemName || 'HỆ THỐNG TỔNG HỢP, ĐÁNH GIÁ TÌNH HÌNH TIẾP NHẬN, GIẢI QUYẾT THỦ TỤC HÀNH CHÍNH'}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              {/* Typography & Color controls for Title */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                {/* Text Color */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Màu chữ Tiêu đề:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={config.loginSystemNameColor || '#ffffff'}
                      onChange={(e) => setConfig({ ...config, loginSystemNameColor: e.target.value })}
                      className="w-8 h-8 rounded-lg cursor-pointer border border-slate-300 p-0.5 bg-white shrink-0"
                    />
                    <input
                      type="text"
                      value={config.loginSystemNameColor || '#ffffff'}
                      onChange={(e) => setConfig({ ...config, loginSystemNameColor: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 bg-white font-medium"
                    />
                  </div>
                </div>

                {/* Font Size */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Kích thước Font Tiêu đề:
                  </label>
                  <select
                    value={config.loginSystemNameFontSize || '24px'}
                    onChange={(e) => setConfig({ ...config, loginSystemNameFontSize: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-medium"
                  >
                    <option value="18px">18px (Vừa phải)</option>
                    <option value="20px">20px (Tiêu chuẩn)</option>
                    <option value="24px">24px (Nổi bật - Mặc định)</option>
                    <option value="28px">28px (Lớn sang trọng)</option>
                    <option value="32px">32px (Rất lớn)</option>
                    <option value="36px">36px (Cực đại)</option>
                  </select>
                </div>

                {/* Font Weight */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Độ đậm Font Tiêu đề:
                  </label>
                  <select
                    value={config.loginSystemNameFontWeight || 'font-black'}
                    onChange={(e) => setConfig({ ...config, loginSystemNameFontWeight: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-medium"
                  >
                    <option value="font-semibold">Semibold (Đậm vừa)</option>
                    <option value="font-bold">Bold (Đậm chuẩn)</option>
                    <option value="font-extrabold">Extrabold (Rất đậm)</option>
                    <option value="font-black">Black (Đậm tối đa - Chuẩn)</option>
                  </select>
                </div>
              </div>

              {/* Login Subtitle */}
              <div className="space-y-2 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-800">
                    Tên Đơn vị / Phụ đề Trang Đăng nhập
                  </label>
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, loginSubTitle: config.subTitle })}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                  >
                    Lấy theo Phụ đề Header
                  </button>
                </div>
                <input
                  type="text"
                  value={config.loginSubTitle ?? ''}
                  onChange={(e) => setConfig({ ...config, loginSubTitle: e.target.value })}
                  placeholder={config.subTitle || 'Trung tâm Phục vụ hành chính công xã Chân Mây - Lăng Cô'}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />

                {/* Typography & Color controls for Subtitle */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Màu chữ Phụ đề:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={config.loginSubTitleColor || '#dbeafe'}
                        onChange={(e) => setConfig({ ...config, loginSubTitleColor: e.target.value })}
                        className="w-8 h-8 rounded-lg cursor-pointer border border-slate-300 p-0.5 bg-white shrink-0"
                      />
                      <input
                        type="text"
                        value={config.loginSubTitleColor || '#dbeafe'}
                        onChange={(e) => setConfig({ ...config, loginSubTitleColor: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 bg-white font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Kích thước Font Phụ đề:
                    </label>
                    <select
                      value={config.loginSubTitleFontSize || '14px'}
                      onChange={(e) => setConfig({ ...config, loginSubTitleFontSize: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-medium"
                    >
                      <option value="12px">12px (Nhỏ gọn)</option>
                      <option value="13px">13px (Vừa)</option>
                      <option value="14px">14px (Tiêu chuẩn - Mặc định)</option>
                      <option value="16px">16px (Lớn rõ ràng)</option>
                      <option value="18px">18px (Rất lớn)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Độ đậm Font Phụ đề:
                    </label>
                    <select
                      value={config.loginSubTitleFontWeight || 'font-semibold'}
                      onChange={(e) => setConfig({ ...config, loginSubTitleFontWeight: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-medium"
                    >
                      <option value="font-normal">Regular (Bình thường)</option>
                      <option value="font-medium">Medium (Vừa)</option>
                      <option value="font-semibold">Semibold (Đậm vừa)</option>
                      <option value="font-bold">Bold (Đậm)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Logo Trang Login */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  2. Bổ sung Biểu tượng và Logo Trang Đăng nhập
                </h2>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={config.loginShowLogo !== false}
                    onChange={(e) => setConfig({ ...config, loginShowLogo: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-700">Hiển thị Logo</span>
                </label>
              </div>

              {config.loginShowLogo !== false && (
                <div className="space-y-4">
                  {/* Logo Source Mode */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      Phương thức hiển thị Logo:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, loginLogoType: 'system' })}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          (config.loginLogoType || 'system') === 'system'
                            ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20 text-blue-900'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-xs mb-1">
                          <Building2 className="w-3.5 h-3.5 text-blue-600" />
                          Logo Hệ thống
                        </div>
                        <p className="text-[10.5px] text-slate-500 leading-snug">
                          Đồng bộ theo cấu hình Logo đã thiết lập ở Header
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, loginLogoType: 'icon' })}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          config.loginLogoType === 'icon'
                            ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20 text-blue-900'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-xs mb-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                          Biểu tượng Preset
                        </div>
                        <p className="text-[10.5px] text-slate-500 leading-snug">
                          Chọn biểu trưng hành chính từ thư viện có sẵn
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, loginLogoType: 'custom_url' })}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          config.loginLogoType === 'custom_url'
                            ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20 text-blue-900'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-xs mb-1">
                          <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                          URL Ảnh tùy chỉnh
                        </div>
                        <p className="text-[10.5px] text-slate-500 leading-snug">
                          Nhập link ảnh Logo cơ quan địa phương (PNG, SVG, JPG)
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Internal Icon Selector when 'icon' */}
                  {config.loginLogoType === 'icon' && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                      <label className="block text-xs font-bold text-slate-700">
                        Chọn Biểu trưng Logo từ kho bên trong:
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {logoIcons.map((item) => {
                          const IconComp = item.icon;
                          const isSelected = (config.loginLogoIcon || 'ShieldCheck') === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setConfig({ ...config, loginLogoIcon: item.id })}
                              className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center ${
                                isSelected
                                  ? 'border-blue-600 bg-white ring-2 ring-blue-500/20 text-blue-700 shadow-xs'
                                  : 'border-slate-200 bg-white/70 hover:bg-white text-slate-700'
                              }`}
                            >
                              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                                <IconComp className="w-4 h-4" />
                              </div>
                              <span className="text-[11px] font-bold leading-tight line-clamp-1">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Custom URL Input */}
                  {config.loginLogoType === 'custom_url' && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <label className="block text-xs font-bold text-slate-700">
                        Đường dẫn URL ảnh Logo (HTTPS):
                      </label>
                      <input
                        type="text"
                        value={config.loginLogoUrl || ''}
                        onChange={(e) => setConfig({ ...config, loginLogoUrl: e.target.value })}
                        placeholder="https://example.com/logo-tinh-huyen-xa.png"
                        className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium"
                      />
                    </div>
                  )}

                  {/* Logo Size & Position Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">
                        Kích thước Khung Logo:
                      </label>
                      <div className="flex items-center gap-2 flex-wrap">
                        {[40, 48, 56, 64, 80, 96].map((sz) => (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => setConfig({ ...config, loginLogoSize: sz })}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                              (config.loginLogoSize || 64) === sz
                                ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {sz}px
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">
                        Vị trí đặt Logo:
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setConfig({ ...config, loginLogoPosition: 'left' })}
                          className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg border transition-all ${
                            config.loginLogoPosition === 'left'
                              ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold ring-2 ring-blue-500/20'
                              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          Bên cạnh Tiêu đề (Ngang)
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfig({ ...config, loginLogoPosition: 'top' })}
                          className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg border transition-all ${
                            (config.loginLogoPosition || 'top') === 'top'
                              ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold ring-2 ring-blue-500/20'
                              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          Phía trên Tiêu đề (Dọc)
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Thiết lập Font chữ */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Type className="w-4 h-4 text-blue-600" />
                  3. Thiết lập Phông chữ (Font Family)
                </h2>
                <span className="text-[11px] text-slate-500">Hỗ trợ đầy đủ tiếng Việt có dấu</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {loginFontFamilies.map((f) => {
                  const isSelected = (config.loginFontFamily || 'sans') === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setConfig({ ...config, loginFontFamily: f.id })}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-bold ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                          {f.name}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                      </div>
                      <p className={`text-xs ${f.fontClass} ${isSelected ? 'text-blue-700' : 'text-slate-500'} font-semibold truncate`}>
                        {f.sample}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 4: Thiết lập Màu nền & Gradient Banner */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-blue-600" />
                  4. Thiết lập Màu nền và Phong cách Banner (Background Theme)
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {loginBgThemes.map((t) => {
                  const isSelected = (config.loginBgTheme || 'navy') === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setConfig({ ...config, loginBgTheme: t.id })}
                      className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                        isSelected
                          ? 'border-slate-900 bg-slate-50 ring-2 ring-blue-500/40 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg ${t.gradientClass} shrink-0 border border-white/20 shadow-xs flex items-center justify-center text-white`}>
                        {isSelected && <Check className="w-4 h-4 drop-shadow-md" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 leading-tight">{t.name}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{t.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Custom Color Hex Picker if 'custom' is selected */}
              {config.loginBgTheme === 'custom' && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 pt-3">
                  <label className="block text-xs font-bold text-slate-800">
                    Mã màu nền tùy chỉnh (HEX):
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={config.loginCustomBgColor || '#0f172a'}
                      onChange={(e) => setConfig({ ...config, loginCustomBgColor: e.target.value })}
                      className="w-10 h-10 rounded-xl cursor-pointer border border-slate-300 p-1 bg-white shrink-0"
                    />
                    <input
                      type="text"
                      value={config.loginCustomBgColor || '#0f172a'}
                      onChange={(e) => setConfig({ ...config, loginCustomBgColor: e.target.value })}
                      placeholder="#0f172a"
                      className="w-full px-3.5 py-2.5 text-xs font-mono font-bold rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Real-time Preview Column */}
          <div className="xl:col-span-5 space-y-4">
            <div className="sticky top-20 bg-slate-900 text-white p-5 rounded-2xl shadow-xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Mô phỏng Giao diện Trang Đăng nhập Thực tế
                </h3>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold px-2 py-0.5 rounded-full">
                  Thời gian thực
                </span>
              </div>

              {/* Login Page Simulation Box */}
              <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-100 flex flex-col shadow-inner">
                {/* Left Banner Mini */}
                <div
                  className={`p-6 text-white relative overflow-hidden transition-all ${
                    config.loginBgTheme === 'custom'
                      ? ''
                      : config.loginBgTheme === 'indigo'
                      ? 'bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-900'
                      : config.loginBgTheme === 'blue'
                      ? 'bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900'
                      : config.loginBgTheme === 'emerald'
                      ? 'bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-950'
                      : config.loginBgTheme === 'crimson'
                      ? 'bg-gradient-to-br from-stone-950 via-red-950 to-rose-950'
                      : config.loginBgTheme === 'slate'
                      ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-900'
                      : config.loginBgTheme === 'dark'
                      ? 'bg-gradient-to-br from-black via-zinc-950 to-slate-950'
                      : 'bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950'
                  }`}
                  style={
                    config.loginBgTheme === 'custom' && config.loginCustomBgColor
                      ? { backgroundColor: config.loginCustomBgColor }
                      : undefined
                  }
                >
                  <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]"></div>

                  {/* Render simulated logo */}
                  {config.loginShowLogo !== false && (
                    <div className={`${(config.loginLogoPosition || 'top') === 'left' ? 'flex items-start gap-3.5' : 'space-y-3'}`}>
                      <div
                        className="rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 border border-white/20 shadow-md flex items-center justify-center shrink-0"
                        style={{
                          width: `${Math.min(60, config.loginLogoSize || 64)}px`,
                          height: `${Math.min(60, config.loginLogoSize || 64)}px`,
                        }}
                      >
                        {config.loginLogoType === 'custom_url' && config.loginLogoUrl ? (
                          <img src={config.loginLogoUrl} alt="Logo" className="w-full h-full object-contain" />
                        ) : config.loginLogoType === 'system' && config.logoType === 'custom_url' && config.logoUrl ? (
                          <img src={config.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                        ) : (
                          <ShieldCheck className="w-6 h-6 text-white" />
                        )}
                      </div>

                      <div className="space-y-1.5 min-w-0">
                        <h4
                          className={`uppercase leading-snug tracking-tight ${config.loginSystemNameFontWeight || 'font-black'} ${
                            config.loginFontFamily === 'be_vietnam_pro'
                              ? "font-['Be_Vietnam_Pro',sans-serif]"
                              : config.loginFontFamily === 'montserrat'
                              ? "font-['Montserrat',sans-serif]"
                              : config.loginFontFamily === 'roboto'
                              ? "font-['Roboto',sans-serif]"
                              : config.loginFontFamily === 'inter'
                              ? "font-['Inter',sans-serif]"
                              : config.loginFontFamily === 'playfair'
                              ? "font-['Playfair_Display',serif]"
                              : config.loginFontFamily === 'merriweather'
                              ? "font-['Merriweather',serif]"
                              : 'font-sans'
                          }`}
                          style={{
                            color: config.loginSystemNameColor || '#ffffff',
                            fontSize: config.loginSystemNameFontSize ? `clamp(13px, ${config.loginSystemNameFontSize}, 18px)` : '15px'
                          }}
                        >
                          {config.loginSystemName?.trim() || config.systemName || 'HỆ THỐNG TỔNG HỢP...'}
                        </h4>
                        <p
                          className={`leading-relaxed ${config.loginSubTitleFontWeight || 'font-semibold'}`}
                          style={{
                            color: config.loginSubTitleColor || 'rgba(219, 234, 254, 0.9)',
                            fontSize: config.loginSubTitleFontSize ? `clamp(10px, ${config.loginSubTitleFontSize}, 13px)` : '11px'
                          }}
                        >
                          {config.loginSubTitle?.trim() || config.subTitle || 'Trung tâm Phục vụ hành chính công...'}
                        </p>
                      </div>
                    </div>
                  )}

                  {config.loginShowLogo === false && (
                    <div className="space-y-1.5">
                      <h4
                        className={`uppercase leading-snug tracking-tight ${config.loginSystemNameFontWeight || 'font-black'} ${
                          config.loginFontFamily === 'be_vietnam_pro'
                            ? "font-['Be_Vietnam_Pro',sans-serif]"
                            : config.loginFontFamily === 'montserrat'
                            ? "font-['Montserrat',sans-serif]"
                            : config.loginFontFamily === 'roboto'
                            ? "font-['Roboto',sans-serif]"
                            : config.loginFontFamily === 'inter'
                            ? "font-['Inter',sans-serif]"
                            : config.loginFontFamily === 'playfair'
                            ? "font-['Playfair_Display',serif]"
                            : config.loginFontFamily === 'merriweather'
                            ? "font-['Merriweather',serif]"
                            : 'font-sans'
                        }`}
                        style={{
                          color: config.loginSystemNameColor || '#ffffff',
                          fontSize: config.loginSystemNameFontSize ? `clamp(13px, ${config.loginSystemNameFontSize}, 18px)` : '15px'
                        }}
                      >
                        {config.loginSystemName?.trim() || config.systemName || 'HỆ THỐNG TỔNG HỢP...'}
                      </h4>
                      <p
                        className={`leading-relaxed ${config.loginSubTitleFontWeight || 'font-semibold'}`}
                        style={{
                          color: config.loginSubTitleColor || 'rgba(219, 234, 254, 0.9)',
                          fontSize: config.loginSubTitleFontSize ? `clamp(10px, ${config.loginSubTitleFontSize}, 13px)` : '11px'
                        }}
                      >
                        {config.loginSubTitle?.trim() || config.subTitle || 'Trung tâm Phục vụ hành chính công...'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Form Mini Simulation (Cleaned - No placeholders, single Đăng nhập button, clean signature) */}
                <div className="p-4 bg-white text-slate-800 space-y-3">
                  <h5 className="text-xs font-bold text-slate-900">Đăng nhập Hệ thống</h5>
                  <div className="space-y-2">
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[11px] text-slate-400 font-medium">(Email công vụ)</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[11px] text-slate-400 font-medium">(Mật khẩu)</span>
                    </div>
                    <div className="py-2 bg-blue-600 text-white font-bold text-xs rounded-lg text-center flex items-center justify-center gap-1.5 shadow-xs">
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Đăng nhập</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex justify-end text-[10px] text-slate-400">
                    <span>@2026 Design by Lê Hồng Sơn</span>
                  </div>
                </div>
              </div>

              {/* Action notice */}
              <div className="p-3 bg-blue-950/60 border border-blue-800/50 rounded-xl text-xs text-blue-200 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>
                  Bấm nút <strong>"Lưu Thay đổi"</strong> ở góc trên để lưu cài đặt trang Đăng nhập vào cơ sở dữ liệu hệ thống.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: MÀU SẮC & GIAO DIỆN */}
      {uiSubTab === 'theme' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
              <Palette className="w-5 h-5 text-blue-600" />
              Màu sắc Chủ đạo và Theme Giao diện
            </h2>

            {/* Primary Accent Color */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                1. Tông màu Nút bấm và Điểm nhấn Chủ đạo (Primary Color)
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
                        <span>Menu và Icon</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: LÀM TRÒN SỐ LIỆU TỶ LỆ (%) */}
      {uiSubTab === 'rounding' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Cấu hình Thiết lập Làm tròn Tỷ lệ (%) Toàn Hệ thống
                  </h2>
                  <p className="text-xs text-slate-500">
                    Quy định số chữ số thập phân, phương pháp làm tròn và định dạng hiển thị % áp dụng đồng bộ cho tất cả báo cáo & bảng thống kê
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* 1. KÍCH THƯỚC CHỮ SỐ THẬP PHÂN */}
              <div className="space-y-3 bg-slate-50/80 p-4.5 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                  1. Số chữ số thập phân muốn hiển thị (Decimal Precision)
                </label>
                <p className="text-xs text-slate-500">
                  Chọn số chữ số sau dấu phẩy cho các con số % (Tỷ lệ đúng hạn, Tỷ lệ quá hạn, Tỷ lệ trực tuyến...).
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {[
                    { val: 0, label: '0 chữ số', eg: '98%' },
                    { val: 1, label: '1 chữ số', eg: '98,5%' },
                    { val: 2, label: '2 chữ số (Mặc định)', eg: '98,53%' },
                    { val: 3, label: '3 chữ số', eg: '98,526%' },
                    { val: 4, label: '4 chữ số', eg: '98,5264%' },
                  ].map((item) => {
                    const isSelected = (config.percentRoundingDecimals ?? 2) === item.val;
                    return (
                      <button
                        key={item.val}
                        type="button"
                        onClick={() => setConfig({ ...config, percentRoundingDecimals: item.val })}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/90 ring-2 ring-blue-500/20 text-blue-900 font-bold'
                            : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium'
                        }`}
                      >
                        <div className="text-xs font-bold">{item.label}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-1">VD: {item.eg}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. QUY TẮC LÀM TRÒN */}
              <div className="space-y-3 bg-slate-50/80 p-4.5 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                  2. Phương pháp làm tròn toán học (Rounding Method)
                </label>
                <p className="text-xs text-slate-500">
                  Quy định cách thức xử lý làm tròn các con số thập phân dư.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      id: 'half_up',
                      title: 'Làm tròn thông thường (Half Up)',
                      desc: 'Phần thập phân tiếp theo ≥ 0.5 làm tròn lên, < 0.5 làm tròn xuống (Tiêu chuẩn)',
                    },
                    {
                      id: 'floor',
                      title: 'Làm tròn xuống (Floor)',
                      desc: 'Luôn cắt bỏ các chữ số thập phân thừa mà không làm tăng hàng trước đó',
                    },
                    {
                      id: 'ceil',
                      title: 'Làm tròn lên (Ceil)',
                      desc: 'Luôn tăng hàng thập phân tiếp theo nếu có bất kỳ số dư lẻ nào',
                    },
                  ].map((m) => {
                    const isSelected = (config.percentRoundingMode || 'half_up') === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          setConfig({ ...config, percentRoundingMode: m.id as 'half_up' | 'floor' | 'ceil' })
                        }
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/90 ring-2 ring-blue-500/20 text-blue-900'
                            : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold flex items-center justify-between">
                            <span>{m.title}</span>
                            {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                          </div>
                          <p className="text-[11px] text-slate-500 leading-relaxed mt-1.5">{m.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. HIỂN THỊ SỐ 0 PHÍA SAU */}
              <div className="bg-slate-50/80 p-4.5 rounded-xl border border-slate-200 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    Giữ cố định số chữ số 0 thừa phía sau (Trailing Zeros)
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ví dụ khi chọn 2 chữ số thập phân: Nếu bật, giá trị tròn sẽ hiển thị <code className="bg-slate-200 px-1 rounded text-slate-800 font-mono">98,50%</code>; nếu tắt, sẽ rút gọn thành <code className="bg-slate-200 px-1 rounded text-slate-800 font-mono">98,5%</code>.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={config.percentRoundingTrailingZeros ?? true}
                    onChange={(e) =>
                      setConfig({ ...config, percentRoundingTrailingZeros: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* LIVE DEMO PREVIEW CARD */}
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white p-5 rounded-2xl shadow-md border border-slate-700">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-700/80 mb-4">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                  Minh họa Xem trước Thực tế
                </h3>
              </div>

              <p className="text-xs text-slate-300 mb-4">
                Xem ngay kết quả định dạng tỷ lệ % theo cấu hình làm tròn đang chọn:
              </p>

              <div className="space-y-2.5 font-sans">
                {[
                  { label: 'Tỷ lệ giải quyết Đúng hạn', raw: 98.5264 },
                  { label: 'Tỷ lệ Hồ sơ Quá hạn (QĐ 776)', raw: 3.14159 },
                  { label: 'Tỷ lệ Trực tuyến tròn 1/2', raw: 50.5 },
                  { label: 'Tỷ lệ Hoàn thành tuyệt đối', raw: 100 },
                  { label: 'Tỷ lệ Quá hạn khi không có lỗi', raw: 0 },
                ].map((sample) => {
                  const decimals = config.percentRoundingDecimals ?? 2;
                  const mode = config.percentRoundingMode || 'half_up';
                  const trailing = config.percentRoundingTrailingZeros ?? true;

                  let formatted = '-';
                  if (sample.raw === 100) formatted = '100%';
                  else if (sample.raw === 0) formatted = '0%';
                  else {
                    const r = roundNumber(sample.raw, decimals, mode);
                    const minD = trailing ? decimals : 0;
                    formatted = `${r.toLocaleString('vi-VN', {
                      minimumFractionDigits: minD,
                      maximumFractionDigits: decimals,
                    })}%`;
                  }

                  return (
                    <div key={sample.label} className="flex items-center justify-between p-2.5 bg-white/10 rounded-xl backdrop-blur-xs border border-white/10 text-xs">
                      <span className="text-slate-300">{sample.label}</span>
                      <span className="font-extrabold font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-500/30">
                        {formatted}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 p-3 rounded-xl bg-blue-900/40 border border-blue-500/30 text-[11px] text-blue-200 leading-relaxed">
                💡 <strong>Áp dụng:</strong> Thiết lập này tự động đồng bộ CSDL và áp dụng trực tiếp cho Bảng Chi tiết Số liệu, Dashboard Tổng quan, Bản in PDF, Xuất file Excel và Trợ lý AI.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )}

      {/* TAB 2: TÙY CHỈNH TÊN MENU & TIÊU ĐỀ GIAO DIỆN */}
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Menu Kiểm soát TTHC (Trực thuộc menu chính):</label>
                <input
                  type="text"
                  value={config.menuLabels.procedures_control || 'Kiểm soát TTHC'}
                  onChange={(e) => setConfig({ ...config, menuLabels: { ...config.menuLabels, procedures_control: e.target.value } })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tên Nhóm Danh mục Quản trị:</label>
                <input
                  type="text"
                  value={config.menuLabels.catalog_group || 'Danh mục quản trị'}
                  onChange={(e) => setConfig({ ...config, menuLabels: { ...config.menuLabels, catalog_group: e.target.value } })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Submenu Quản lý Loại kỳ báo cáo:</label>
                <input
                  type="text"
                  value={config.menuLabels.catalog_period_types || 'Loại kỳ báo cáo'}
                  onChange={(e) => setConfig({ ...config, menuLabels: { ...config.menuLabels, catalog_period_types: e.target.value } })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Submenu Quản lý Đơn vị:</label>
                <input
                  type="text"
                  value={config.menuLabels.catalog_units || 'Cơ quan, đơn vị'}
                  onChange={(e) => setConfig({ ...config, menuLabels: { ...config.menuLabels, catalog_units: e.target.value } })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Submenu Chỉ tiêu và Công thức:</label>
                <input
                  type="text"
                  value={config.menuLabels.catalog_indicators || 'Chỉ tiêu và Công thức'}
                  onChange={(e) => setConfig({ ...config, menuLabels: { ...config.menuLabels, catalog_indicators: e.target.value } })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Menu Thiết lập Hệ thống & Giao diện:</label>
                <input
                  type="text"
                  value={config.menuLabels.system_config || 'Thiết lập Hệ thống & Giao diện'}
                  onChange={(e) => setConfig({ ...config, menuLabels: { ...config.menuLabels, system_config: e.target.value } })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Menu Nhật ký hệ thống (Audit):</label>
                <input
                  type="text"
                  value={config.menuLabels.system_audit || 'Nhật ký hệ thống (Audit)'}
                  onChange={(e) => setConfig({ ...config, menuLabels: { ...config.menuLabels, system_audit: e.target.value } })}
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

          {/* Left Sidebar Behavior Settings */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
              <SlidersHorizontal className="w-5 h-5 text-indigo-600" />
              Tùy biến Hành vi Menu Trái (Sidebar Navigation)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Default Load State */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-800">Trạng thái Menu khi tải trang</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Chọn trạng thái hiển thị ban đầu của Menu trái khi người dùng truy cập hoặc tải lại trang.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, sidebarDefaultCollapsed: true })}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      config.sidebarDefaultCollapsed !== false
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <PanelLeftClose className="w-4 h-4" />
                    Thu nhỏ (Mặc định)
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, sidebarDefaultCollapsed: false })}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      config.sidebarDefaultCollapsed === false
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <PanelLeftOpen className="w-4 h-4" />
                    Mở rộng đầy đủ
                  </button>
                </div>
              </div>

              {/* Auto Hide / Hover Expand */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-800">Tự động ẩn & Mở rộng khi rê chuột</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Khi ở chế độ thu nhỏ, Menu sẽ tự động mở rộng khi rê chuột qua và tự động thu nhỏ lại khi rời chuột.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-medium text-slate-700">
                    {config.sidebarAutoHide !== false ? 'Đang BẬT tự động ẩn / mở rộng' : 'Đang TẮT (Chỉ ẩn khi bấm nút)'}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.sidebarAutoHide !== false}
                      onChange={(e) => setConfig({ ...config, sidebarAutoHide: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: MẪU BÁO CÁO NHẬN XÉT VÀ ĐÁNH GIÁ AI */}
      {activeTab === 'ai_template' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                Mẫu Nhận xét và Đánh giá AI (AI Analysis Exemplar Template)
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                AI sẽ học theo cấu trúc, văn phong và bố cục 4 phần của mẫu này khi sinh nhận xét tự động cho từng kỳ báo cáo, phân tích đơn vị và lĩnh vực.
              </p>
            </div>
          </div>

          {/* Variables guide */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-2">
            <div className="font-bold flex items-center gap-1.5 text-amber-950">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              Các tham số và trường số liệu AI sẽ tự động thay thế từ dữ liệu tính toán:
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-[11px] font-mono text-slate-700">
              <span className="bg-white/80 px-2 py-1 rounded border border-amber-200">[Tổng tiếp nhận]</span>
              <span className="bg-white/80 px-2 py-1 rounded border border-amber-200">[Số hồ sơ trực tuyến]</span>
              <span className="bg-white/80 px-2 py-1 rounded border border-amber-200">[Tỷ lệ trực tuyến]</span>
              <span className="bg-white/80 px-2 py-1 rounded border border-amber-200">[Số hồ sơ trực tiếp]</span>
              <span className="bg-white/80 px-2 py-1 rounded border border-amber-200">[Số hồ sơ kỳ trước]</span>
              <span className="bg-white/80 px-2 py-1 rounded border border-amber-200">[Tổng số đã giải quyết]</span>
              <span className="bg-white/80 px-2 py-1 rounded border border-amber-200">[Tỷ lệ hoàn thành]</span>
              <span className="bg-white/80 px-2 py-1 rounded border border-amber-200">[Số hồ sơ trước hạn]</span>
              <span className="bg-white/80 px-2 py-1 rounded border border-amber-200">[Số hồ sơ đúng hạn]</span>
              <span className="bg-white/80 px-2 py-1 rounded border border-amber-200">[Số hồ sơ quá hạn]</span>
              <span className="bg-white/80 px-2 py-1 rounded border border-amber-200">[Tỷ lệ đúng hạn]</span>
              <span className="bg-white/80 px-2 py-1 rounded border border-amber-200">[Tổng số đang giải quyết]</span>
              <span className="bg-white/80 px-2 py-1 rounded border border-amber-200">[Số hồ sơ trong hạn]</span>
              <span className="bg-white/80 px-2 py-1 rounded border border-amber-200">[Số hồ sơ quá hạn đang xử lý]</span>
            </div>
          </div>

          {/* Template text area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">
                Nội dung mẫu báo cáo chuẩn (Có thể chỉnh sửa theo nhu cầu cơ quan):
              </label>
              <span className="text-[11px] text-slate-400">
                Hỗ trợ định dạng văn bản Markdown chuẩn
              </span>
            </div>
            <textarea
              rows={18}
              value={config.aiAnalysisExemplarTemplate || DEFAULT_SYSTEM_CONFIG.aiAnalysisExemplarTemplate}
              onChange={(e) => setConfig({ ...config, aiAnalysisExemplarTemplate: e.target.value })}
              className="w-full font-mono text-xs p-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-900 text-slate-100 leading-relaxed"
              placeholder="Nhập mẫu nhận xét đánh giá AI..."
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-slate-500">
              * Sau khi điều chỉnh, vui lòng nhấn <strong className="text-slate-700">"Lưu toàn bộ thiết lập"</strong> ở góc trên để áp dụng vào toàn hệ thống.
            </div>
          </div>
        </div>
      )}

      {/* TAB: MẪU ĐÔN ĐỐC (SMS) & MẪU ĐỀ NGHỊ */}
      {activeTab === 'urge_templates' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="pb-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-blue-600" />
              Tùy chỉnh Mẫu Nội dung Đôn đốc (SMS Đôn đốc) & Mẫu Đề nghị
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Cấu hình các mẫu tin nhắn đôn đốc và nội dung đề nghị gửi đơn vị chủ trì. Hệ thống sẽ tự động thay thế các tham số tương ứng khi thực hiện đôn đốc.
            </p>
          </div>

          {/* Hướng dẫn biến số */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 space-y-2">
            <div className="font-bold flex items-center gap-1.5 text-blue-950">
              <AlertCircle className="w-4 h-4 text-blue-600" />
              Các tham số động có thể sử dụng trong mẫu tin nhắn:
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] font-mono text-slate-800">
              <span className="bg-white px-2 py-1 rounded border border-blue-200">{`{status_tag}`} : Trạng thái tiếp nhận</span>
              <span className="bg-white px-2 py-1 rounded border border-blue-200">{`{dossier_code}`} : Mã hồ sơ</span>
              <span className="bg-white px-2 py-1 rounded border border-blue-200">{`{citizen_name}`} : Tên công dân</span>
              <span className="bg-white px-2 py-1 rounded border border-blue-200">{`{phone}`} : Điện thoại</span>
              <span className="bg-white px-2 py-1 rounded border border-blue-200">{`{notes}`} : Ghi chú</span>
              <span className="bg-white px-2 py-1 rounded border border-blue-200">{`{procedure_name}`} : Tên thủ tục</span>
              <span className="bg-white px-2 py-1 rounded border border-blue-200">{`{received_date}`} : Ngày nhận</span>
              <span className="bg-white px-2 py-1 rounded border border-blue-200">{`{appointment_date}`} : Hạn trả</span>
              <span className="bg-white px-2 py-1 rounded border border-blue-200">{`{assigned_unit}`} : Đơn vị chủ trì</span>
              <span className="bg-white px-2 py-1 rounded border border-blue-200">{`{unit}`} : Đơn vị</span>
              <span className="bg-white px-2 py-1 rounded border border-blue-200">{`{reception_time}`} : Thời gian tiếp nhận</span>
            </div>
          </div>

          {/* 1. Mẫu nội dung SMS Đôn đốc */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              1. Mẫu nội dung SMS Đôn đốc (Tạo tự động sau khi đôn đốc):
            </label>
            <textarea
              rows={4}
              value={config.urgeContentTemplate ?? DEFAULT_SYSTEM_CONFIG.urgeContentTemplate}
              onChange={(e) => setConfig({ ...config, urgeContentTemplate: e.target.value })}
              className="w-full font-mono text-xs p-3.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 bg-slate-50 text-slate-900 leading-relaxed"
              placeholder="[BPTN&TKQ] Đôn đốc giải quyết hồ sơ {dossier_code} của {citizen_name}..."
            />
          </div>



          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-slate-500">
              * Sau khi điều chỉnh, vui lòng nhấn <strong className="text-slate-700">"Lưu toàn bộ thiết lập"</strong> ở góc trên để áp dụng vào toàn hệ thống.
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PHÂN QUYỀN NHÓM NGƯỜI DÙNG (RBAC MATRIX) */}
      {activeTab === 'permissions' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          {/* Header */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-5 h-5 text-blue-600" />
                Ma trận Phân quyền theo Nhóm Người dùng (RBAC Matrix)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cấu hình phân quyền chi tiết dựa trên toàn bộ 6 nhóm chức năng và Menu hệ thống ({allPermissionsList.length} quyền hạn)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleResetRolePermissionsToDefault()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-xl hover:bg-slate-200 transition-all cursor-pointer"
                title="Khôi phục phân quyền gốc cho tất cả các vai trò"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                Khôi phục chuẩn mặc định
              </button>
            </div>
          </div>

          {/* Search and Category Filter Toolbar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none text-xs">
              <button
                type="button"
                onClick={() => setSelectedPermCategory('all')}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedPermCategory === 'all'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                Tất cả nhóm ({allPermissionsList.length})
              </button>
              {permissionCategories.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedPermCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedPermCategory(cat.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{cat.title.split('. ')[1] || cat.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${isSelected ? 'bg-blue-800/60 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {cat.permissions.length}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm quyền thao tác..."
                value={permSearchKeyword}
                onChange={(e) => setPermSearchKeyword(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              {permSearchKeyword && (
                <button
                  type="button"
                  onClick={() => setPermSearchKeyword('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Matrix Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <th className="p-4 w-5/12">Danh mục Quyền theo Chức năng</th>
                  {config.rolePermissions.map((r, roleIdx) => (
                    <th key={r.role} className="p-4 text-center w-[14%]">
                      <div className="font-bold text-slate-900 text-xs truncate" title={r.roleName}>
                        {r.roleName.split(' (')[0]}
                      </div>
                      <div className="text-[10px] font-normal text-slate-500 tracking-normal capitalize">
                        Role: {r.role}
                      </div>

                      {/* Quick Bulk Toggle Actions per Role */}
                      <div className="flex items-center justify-center gap-1 mt-2">
                        <button
                          type="button"
                          onClick={() => handleToggleAllForRole(roleIdx, true)}
                          className="px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 cursor-pointer"
                          title="Bật tất cả quyền cho vai trò này"
                        >
                          Bật hết
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleAllForRole(roleIdx, false)}
                          className="px-1.5 py-0.5 text-[9px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 cursor-pointer"
                          title="Tắt tất cả quyền cho vai trò này"
                        >
                          Tắt hết
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResetRolePermissionsToDefault(roleIdx)}
                          className="p-0.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                          title="Khôi phục mặc định vai trò này"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {permissionCategories
                  .filter((cat) => selectedPermCategory === 'all' || selectedPermCategory === cat.id)
                  .map((cat) => {
                    const filteredPerms = cat.permissions.filter((p) => {
                      if (!permSearchKeyword) return true;
                      const kw = permSearchKeyword.toLowerCase();
                      return (
                        p.title.toLowerCase().includes(kw) ||
                        p.desc.toLowerCase().includes(kw) ||
                        p.key.toLowerCase().includes(kw)
                      );
                    });

                    if (filteredPerms.length === 0) return null;
                    const Icon = cat.icon;

                    return (
                      <React.Fragment key={cat.id}>
                        {/* Category Section Header Row */}
                        <tr className="bg-slate-100/90 font-bold border-y border-slate-200">
                          <td colSpan={1 + config.rolePermissions.length} className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className={`p-1.5 rounded-lg border text-xs ${cat.color}`}>
                                <Icon className="w-3.5 h-3.5" />
                              </span>
                              <span className="text-slate-900 font-bold tracking-tight text-xs uppercase">
                                {cat.title}
                              </span>
                              <span className="text-[11px] font-normal text-slate-500">
                                ({filteredPerms.length} quyền hạn)
                              </span>
                            </div>
                          </td>
                        </tr>

                        {/* Permission rows */}
                        {filteredPerms.map((perm) => (
                          <tr key={perm.key} className="hover:bg-blue-50/40 transition-colors">
                            <td className="p-3.5 pl-6">
                              <div className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></span>
                                <div>
                                  <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                                    <span>{perm.title}</span>
                                    <code className="text-[10px] font-normal text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                                      {perm.key}
                                    </code>
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5">{perm.desc}</div>
                                </div>
                              </div>
                            </td>

                            {config.rolePermissions.map((r, roleIdx) => {
                              const isChecked = !!r.permissions[perm.key];
                              return (
                                <td key={r.role} className="p-3.5 text-center align-middle">
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePermission(roleIdx, perm.key)}
                                    className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all cursor-pointer ${
                                      isChecked
                                        ? 'bg-emerald-500 text-white shadow-2xs hover:bg-emerald-600'
                                        : 'bg-slate-100 text-slate-300 hover:bg-slate-200 hover:text-slate-500'
                                    }`}
                                    title={`${isChecked ? 'Đang bật' : 'Đang tắt'} - Nhấn để đổi trạng thái`}
                                  >
                                    {isChecked ? <Check className="w-4 h-4 stroke-[3]" /> : <X className="w-3.5 h-3.5" />}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-slate-500">
              * Sau khi điều chỉnh phân quyền, vui lòng nhấn <strong className="text-slate-700">"Lưu toàn bộ thiết lập"</strong> ở góc trên bên phải để ghi nhận vào CSDL.
            </div>
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
                Danh sách Tài khoản Người dùng và Nhóm Quyền
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
                  <th className="p-3.5">Họ và Tên</th>
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
    </div>
  );
};
