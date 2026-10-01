import React, { useState, useEffect, useMemo } from 'react';
import { store, RolePermissionRule } from '../../services/store';
import { Profile, UserRole } from '../../types/database';
import {
  Users,
  Shield,
  Check,
  X,
  UserCheck,
  Edit2,
  Trash2,
  Mail,
  Building,
  UserPlus,
  User,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Filter,
  Eye,
  EyeOff
} from 'lucide-react';

export const UsersAdminPage: React.FC = () => {
  const [currentUser, setCurrentUser] = useState(store.getCurrentUser());
  const [users, setUsers] = useState(store.getUsers());
  const [userFilter, setUserFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const units = store.getUnits();

  useEffect(() => {
    const refresh = () => {
      setUsers(store.getUsers());
      setCurrentUser(store.getCurrentUser());
    };
    void store.syncWithSupabase().then(refresh).catch((error) => console.warn('Không thể tải hồ sơ người dùng từ Supabase:', error));
    return store.subscribe(refresh);
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [formData, setFormData] = useState<{
    full_name: string;
    username: string;
    role: UserRole;
    unit_id: string;
    active: boolean;
    password?: string;
  }>({
    full_name: '',
    username: '',
    role: 'data_entry',
    unit_id: '',
    active: true,
    password: '',
  });

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormData({
      full_name: '',
      username: '',
      role: 'data_entry',
      unit_id: '',
      active: true,
      password: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: Profile) => {
    setEditingUser(user);
    const uname = (user as any).username || (user.email ? user.email.split('@')[0] : '');
    setFormData({
      full_name: user.full_name,
      username: uname,
      role: user.role,
      unit_id: user.unit_id || '',
      active: user.active !== false,
      password: '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cleanUsername = formData.username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
      if (!cleanUsername) {
        alert('Vui lòng nhập tên tài khoản hợp lệ (chữ cái, số, dấu chấm).');
        return;
      }

      if (editingUser) {
        await store.saveUser({
          id: editingUser.id,
          full_name: formData.full_name,
          username: cleanUsername,
          role: formData.role,
          unit_id: formData.unit_id,
          active: formData.active,
          password: formData.password ? formData.password : undefined,
        });
        setToast({ type: 'success', text: `Đã cập nhật thông tin tài khoản "${formData.full_name}" thành công.` });
      } else {
        await store.createUser({
          full_name: formData.full_name,
          username: cleanUsername,
          role: formData.role,
          unit_id: formData.unit_id,
          password: formData.password || undefined,
        });
        setToast({ type: 'success', text: `Đã tạo mới tài khoản "${formData.full_name}" thành công.` });
      }
      setUsers(store.getUsers());
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu thông tin người dùng.');
    }
  };

  const handleDelete = async (user: Profile) => {
    if (user.id === currentUser.id) {
      alert('Không thể xóa / vô hiệu hóa tài khoản quản trị đang đăng nhập.');
      return;
    }
    const uname = (user as any).username || (user.email ? user.email.split('@')[0] : user.id);
    const confirmed = window.confirm(
      `Xác nhận xóa (vô hiệu hóa & ẩn) tài khoản:\n\n• Họ và tên: ${user.full_name}\n• Tên tài khoản: ${uname}\n\nTài khoản này sẽ không thể đăng nhập vào hệ thống nữa. Mọi dữ liệu liên quan (báo cáo, đôn đốc, nhật ký) vẫn được bảo toàn nguyên vẹn.`
    );

    if (confirmed) {
      try {
        await store.deactivateUser(user.id);
        setUsers(store.getUsers());
        setToast({
          type: 'success',
          text: `Đã xóa & ẩn tài khoản "${user.full_name}". Dữ liệu lịch sử liên quan vẫn được bảo toàn nguyên vẹn.`,
        });
      } catch (err: any) {
        alert(err.message || 'Lỗi khi vô hiệu hóa người dùng.');
      }
    }
  };

  const handleReactivate = async (user: Profile) => {
    try {
      await store.reactivateUser(user.id);
      setUsers(store.getUsers());
      setToast({
        type: 'success',
        text: `Đã khôi phục hoạt động cho tài khoản "${user.full_name}". Tài khoản có thể đăng nhập bình thường.`,
      });
    } catch (err: any) {
      alert(err.message || 'Lỗi khi kích hoạt lại người dùng.');
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const isActive = u.active !== false;
      if (userFilter === 'active') return isActive;
      if (userFilter === 'inactive') return !isActive;
      return true;
    });
  }, [users, userFilter]);

  const activeCount = useMemo(() => users.filter((u) => u.active !== false).length, [users]);
  const inactiveCount = useMemo(() => users.filter((u) => u.active === false).length, [users]);

  const rolesList: Array<{
    role: UserRole;
    title: string;
    description: string;
    badgeColor: string;
  }> = [
    {
      role: 'admin',
      title: 'Quản trị viên hệ thống (Admin)',
      description: 'Toàn quyền cấu hình hệ thống, logo, màu sắc, sắp xếp menu, kiểm soát TTHC, phân quyền RBAC, khóa Snapshot và xem Nhật ký Audit.',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    },
    {
      role: 'analyst',
      title: 'Chuyên viên Phân tích (Analyst)',
      description: 'Xem toàn bộ số liệu, phân tích chuyên sâu (đơn vị/lĩnh vực/so sánh), đôn đốc hồ sơ, sinh phân tích AI (Gemini), xuất báo cáo và nhập liệu.',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    },
    {
      role: 'data_entry',
      title: 'Chuyên viên Nhập liệu (Data Entry)',
      description: 'Khởi tạo kỳ báo cáo mới, tải file Excel, ánh xạ cột và lĩnh vực, tra cứu hồ sơ đôn đốc và nộp báo cáo. Không thể duyệt hoặc khóa kỳ.',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    {
      role: 'viewer',
      title: 'Người xem / Lãnh đạo (Viewer)',
      description: 'Tra cứu, theo dõi Dashboard tổng quan, Màn hình TV Kiosk, xem báo cáo, phân tích và xuất dữ liệu Excel/CSV (Chế độ chỉ đọc).',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
    },
  ];

  const functionalGroups: Array<{
    category: string;
    items: Array<{
      perm: keyof RolePermissionRule['permissions'];
      feature: string;
    }>;
  }> = [
    {
      category: '1. Tổng quan & Kiosk TV',
      items: [
        { perm: 'view_dashboard', feature: 'Xem Tổng quan Dashboard & Tỷ lệ đúng hạn TT01 / QĐ766' },
        { perm: 'view_public_dashboard', feature: 'Truy cập Màn hình TV 55" Kiosk công khai' },
        { perm: 'customize_dashboard_layout', feature: 'Tùy biến Bố cục, Màu sắc & Biểu đồ Dashboard' },
      ],
    },
    {
      category: '2. Đôn đốc hồ sơ TTHC',
      items: [
        { perm: 'view_dossier_urge', feature: 'Xem danh sách Hồ sơ đôn đốc (quá hạn, sắp đến hạn)' },
        { perm: 'manage_dossier_urge', feature: 'Xử lý đôn đốc, gửi cảnh báo & xuất phiếu đôn đốc' },
        { perm: 'config_urge_templates', feature: 'Cấu hình Mẫu văn bản đôn đốc & Quy chuẩn cảnh báo' },
      ],
    },
    {
      category: '3. Cập nhật Báo cáo & Kho lưu trữ',
      items: [
        { perm: 'view_reports', feature: 'Xem Danh sách & Chi tiết Kỳ Báo cáo' },
        { perm: 'create_reports', feature: 'Khởi tạo kỳ báo cáo thống kê mới' },
        { perm: 'edit_reports', feature: 'Sửa số liệu & Nộp kỳ báo cáo' },
        { perm: 'delete_reports', feature: 'Xóa kỳ báo cáo' },
        { perm: 'import_excel', feature: 'Nhập dữ liệu Excel & Thẩm định tự động' },
        { perm: 'lock_snapshot', feature: 'Khóa Báo cáo (Tạo Snapshot bất biến) & Mở khóa' },
        { perm: 'view_archive', feature: 'Khai thác & Tra cứu Kho lưu trữ số liệu' },
      ],
    },
    {
      category: '4. Phân tích chuyên sâu & Trợ lý AI',
      items: [
        { perm: 'view_analysis_units', feature: 'Phân tích chi tiết hiệu quả theo Đơn vị giải quyết' },
        { perm: 'view_analysis_fields', feature: 'Phân tích chi tiết theo Lĩnh vực TTHC' },
        { perm: 'view_analysis_compare', feature: 'Phân tích so sánh biến động chỉ tiêu qua các kỳ' },
        { perm: 'use_ai_analysis', feature: 'Tạo nhận xét & phân tích tự động bằng AI (Gemini)' },
        { perm: 'export_data', feature: 'Xuất dữ liệu ra file Excel và CSV' },
      ],
    },
    {
      category: '5. Kiểm soát TTHC & Danh mục quản trị',
      items: [
        { perm: 'manage_procedures_control', feature: 'Kiểm soát TTHC & Quy trình thủ tục đơn vị' },
        { perm: 'manage_catalogs', feature: 'Quản trị Danh mục tổng quát' },
        { perm: 'manage_units_catalog', feature: 'Quản lý Danh mục Đơn vị giải quyết TTHC' },
        { perm: 'manage_indicators_catalog', feature: 'Quản lý Danh mục Chỉ tiêu & Công thức tính' },
        { perm: 'manage_period_types_catalog', feature: 'Quản lý Danh mục Loại kỳ báo cáo' },
      ],
    },
    {
      category: '6. Hệ thống, Người dùng & Bảo mật',
      items: [
        { perm: 'manage_users', feature: 'Quản trị Tài khoản người dùng & Phân vai trò RBAC' },
        { perm: 'manage_system_config', feature: 'Thiết lập Tên, Logo, Thứ tự Menu & Giao diện TV' },
        { perm: 'view_audit_logs', feature: 'Xem Nhật ký hệ thống (Audit Logs)' },
        { perm: 'manage_database_test', feature: 'Kiểm thử & Quản trị CSDL Supabase' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Quản trị Người dùng và Phân quyền (RBAC / RLS)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Thiết lập tài khoản người dùng, vai trò bảo mật và kiểm soát truy cập phân tầng
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 border border-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Thêm tài khoản mới
          </button>
        </div>
      </div>

      {/* Toast Alert */}
      {toast && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs shadow-xs animate-in fade-in ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{toast.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Users CRUD Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Danh sách Tài khoản Người dùng ({filteredUsers.length})
            </h3>
            <span className="text-[11px] text-slate-500">
              (Đang đăng nhập: <strong className="text-blue-700 uppercase">{currentUser.role}</strong>)
            </span>
          </div>

          {/* Filter Tabs: Đang hoạt động / Đã vô hiệu hóa & ẩn / Tất cả */}
          <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setUserFilter('active')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                userFilter === 'active'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-emerald-600" />
              <span>Đang hoạt động ({activeCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setUserFilter('inactive')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                userFilter === 'inactive'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <EyeOff className="w-3.5 h-3.5 text-rose-500" />
              <span>Đã xóa / Ẩn ({inactiveCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setUserFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                userFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ({users.length})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Họ và tên cán bộ</th>
                <th className="p-3">Tên tài khoản</th>
                <th className="p-3">Đơn vị công tác</th>
                <th className="p-3">Vai trò phân quyền</th>
                <th className="p-3 text-center">Trạng thái</th>
                <th className="p-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-medium">Không có tài khoản người dùng nào phù hợp với bộ lọc.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const assignedUnit = units.find((un) => un.id === u.unit_id);
                  const roleMeta = rolesList.find((r) => r.role === u.role);
                  const isSelf = u.id === currentUser.id;
                  const usernameDisplay = (u as any).username || (u.email ? u.email.split('@')[0] : u.id);
                  const isActive = u.active !== false;

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        !isActive ? 'bg-slate-50/60 opacity-80' : ''
                      }`}
                    >
                      <td className="p-3 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className={!isActive ? 'line-through text-slate-500' : ''}>{u.full_name}</span>
                          {isSelf && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
                              Bạn
                            </span>
                          )}
                          {!isActive && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold">
                              Đã xóa / Ẩn
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-slate-700 font-mono font-medium">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className={!isActive ? 'text-slate-400' : ''}>{usernameDisplay}</span>
                        </div>
                      </td>
                      <td className="p-3 text-slate-600">
                        {assignedUnit ? (
                          <div className="flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-slate-400" />
                            <span>{assignedUnit.name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">Toàn cơ quan</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full border ${roleMeta?.badgeColor}`}>
                          {roleMeta?.title.split('(')[0].trim() || u.role}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isActive ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-slate-500 bg-slate-100 border border-slate-200'
                        }`}>
                          {isActive ? 'Hoạt động' : 'Đã vô hiệu hóa'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(u)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Sửa thông tin tài khoản"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {isActive && !isSelf && (
                            <button
                              type="button"
                              onClick={() => handleDelete(u)}
                              className="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors flex items-center gap-1"
                              title="Xóa & Vô hiệu hóa tài khoản (Ẩn khỏi hệ thống)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Xóa</span>
                            </button>
                          )}

                          {!isActive && (
                            <button
                              type="button"
                              onClick={() => handleReactivate(u)}
                              className="px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1"
                              title="Khôi phục quyền truy cập cho tài khoản"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Khôi phục</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permission Matrix */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Ma trận Phân quyền Chức năng & Nhóm quyền (RBAC / RLS Matrix)
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Danh mục quyền được phân nhóm chặt chẽ theo 6 cụm chức năng và cấu trúc Menu hệ thống
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3 w-5/12">Chức năng nghiệp vụ & Quyền hạn</th>
                <th className="p-3 text-center w-[14%]">Quản trị viên (Admin)</th>
                <th className="p-3 text-center w-[14%]">Chuyên viên Phân tích</th>
                <th className="p-3 text-center w-[14%]">Chuyên viên Nhập liệu</th>
                <th className="p-3 text-center w-[14%]">Người xem (Viewer)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {functionalGroups.map((group, groupIdx) => (
                <React.Fragment key={groupIdx}>
                  <tr className="bg-slate-50/90 font-bold border-y border-slate-200 text-slate-900">
                    <td colSpan={5} className="px-3.5 py-2 font-bold text-slate-800 text-xs">
                      {group.category}
                    </td>
                  </tr>
                  {group.items.map((item, idx) => {
                    const cfg = store.getSystemConfig();
                    const adminRule = cfg.rolePermissions.find((r) => r.role === 'admin');
                    const analystRule = cfg.rolePermissions.find((r) => r.role === 'analyst');
                    const dataEntryRule = cfg.rolePermissions.find((r) => r.role === 'data_entry');
                    const viewerRule = cfg.rolePermissions.find((r) => r.role === 'viewer');

                    const permKey = item.perm as keyof RolePermissionRule['permissions'];
                    const adminVal = adminRule?.permissions?.[permKey] ?? true;
                    const analystVal = analystRule?.permissions?.[permKey] ?? false;
                    const dataEntryVal = dataEntryRule?.permissions?.[permKey] ?? false;
                    const viewerVal = viewerRule?.permissions?.[permKey] ?? false;

                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 pl-6 font-medium text-slate-800">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                            <span>{item.feature}</span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          {adminVal ? (
                            <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                          ) : (
                            <X className="w-4 h-4 text-slate-300 mx-auto" />
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {analystVal ? (
                            <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                          ) : (
                            <X className="w-4 h-4 text-slate-300 mx-auto" />
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {dataEntryVal ? (
                            <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                          ) : (
                            <X className="w-4 h-4 text-slate-300 mx-auto" />
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {viewerVal ? (
                            <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                          ) : (
                            <X className="w-4 h-4 text-slate-300 mx-auto" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal CRUD User */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingUser ? 'Chỉnh sửa Tài khoản Người dùng' : 'Thêm Người dùng mới'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Họ và tên cán bộ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Nguyễn Văn An..."
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên tài khoản đăng nhập <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="ví dụ: ldhoan.cmlc"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().trim() })}
                  disabled={Boolean(editingUser)}
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 text-slate-900 disabled:opacity-60 disabled:bg-slate-100"
                />
                <p className="text-[10px] text-slate-400 mt-1">Tên tài khoản dùng để đăng nhập hệ thống (chữ thường, không dấu, không khoảng trắng).</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {editingUser ? 'Đổi mật khẩu mới (Để trống nếu không đổi)' : 'Mật khẩu đăng nhập'} <span className={editingUser ? 'text-slate-400 font-normal text-[10px]' : 'text-rose-500'}>{editingUser ? '' : '*'}</span>
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  placeholder={editingUser ? 'Nhập mật khẩu mới...' : 'Nhập ít nhất 6 ký tự...'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
                <p className="text-[10px] text-slate-400 mt-1">Mật khẩu tối thiểu 6 ký tự dùng để đăng nhập hệ thống.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Vai trò phân quyền (RBAC) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-medium text-slate-900"
                >
                  <option value="admin">Quản trị viên (Admin)</option>
                  <option value="analyst">Chuyên viên Phân tích (Analyst)</option>
                  <option value="data_entry">Chuyên viên Nhập liệu (Data Entry)</option>
                  <option value="viewer">Người xem / Lãnh đạo (Viewer)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Đơn vị trực thuộc
                </label>
                <select
                  value={formData.unit_id}
                  onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900"
                >
                  <option value="">-- Toàn cơ quan (Không cố định) --</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  Tài khoản đang hoạt động
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs"
                >
                  {editingUser ? 'Cập nhật' : 'Tạo tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
