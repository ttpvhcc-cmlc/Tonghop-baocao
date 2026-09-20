import React, { useState, useEffect } from 'react';
import { store } from '../../services/store';
import { Profile, UserRole } from '../../types/database';
import { Users, Shield, Check, X, UserCheck, Edit2, Trash2, Mail, Building } from 'lucide-react';

export const UsersAdminPage: React.FC = () => {
  const [currentUser, setCurrentUser] = useState(store.getCurrentUser());
  const [users, setUsers] = useState(store.getUsers());
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
    email: string;
    role: UserRole;
    unit_id: string;
    active: boolean;
  }>({
    full_name: '',
    email: '',
    role: 'data_entry',
    unit_id: '',
    active: true,
  });

  const handleSwitch = (_role: UserRole) => {
    alert('Vai trò được quản lý trực tiếp trong Supabase profiles. Không còn chuyển vai trò giả lập trên trình duyệt.');
  };

  const handleOpenCreate = () => {
    alert('Tài khoản đăng nhập phải được tạo trước tại Supabase Authentication. Màn hình này chỉ quản lý hồ sơ và quyền RBAC.');
  };

  const handleOpenEdit = (user: Profile) => {
    setEditingUser(user);
    setFormData({
      full_name: user.full_name,
      email: user.email || '',
      role: user.role,
      unit_id: user.unit_id || '',
      active: user.active,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await store.saveUser({
        id: editingUser?.id,
        ...formData,
      });
      setUsers(store.getUsers());
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu thông tin người dùng.');
    }
  };

  const handleDelete = async (user: Profile) => {
    if (user.id === currentUser.id) {
      alert('Không thể vô hiệu hóa tài khoản đang đăng nhập.');
      return;
    }
    if (window.confirm(`Vô hiệu hóa hồ sơ "${user.full_name}" (${user.email})?`)) {
      try {
        await store.saveUser({
          id: user.id,
          full_name: user.full_name,
          email: user.email || '',
          role: user.role,
          unit_id: user.unit_id || '',
          active: false,
        });
        setUsers(store.getUsers());
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const rolesList: Array<{
    role: UserRole;
    title: string;
    description: string;
    badgeColor: string;
  }> = [
    {
      role: 'admin',
      title: 'Quản trị viên hệ thống (Admin)',
      description: 'Toàn quyền cấu hình danh mục Đơn vị, Lĩnh vực, Chỉ tiêu; Khóa Snapshot báo cáo; Mở khóa kỳ; Xem toàn bộ Audit Logs.',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    },
    {
      role: 'analyst',
      title: 'Chuyên viên Phân tích (Analyst)',
      description: 'Xem toàn bộ số liệu, phê duyệt báo cáo, sinh phân tích nhận xét AI (Gemini), điều chỉnh báo cáo trước khi trình lãnh đạo.',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    },
    {
      role: 'data_entry',
      title: 'Chuyên viên Nhập liệu (Data Entry)',
      description: 'Khởi tạo kỳ báo cáo mới, tải file Excel, ánh xạ cột và lĩnh vực, trình duyệt số liệu. Không thể duyệt hoặc khóa kỳ.',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    {
      role: 'viewer',
      title: 'Người xem / Lãnh đạo (Viewer)',
      description: 'Chỉ đọc toàn bộ Dashboard và Báo cáo, xem biểu đồ, xuất file Excel/CSV báo cáo phục vụ hội nghị.',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
    },
  ];

  const permissionsMatrix = [
    { feature: 'Xem Tổng quan Dashboard & Báo cáo', admin: true, analyst: true, data_entry: true, viewer: true },
    { feature: 'Xuất file Excel & CSV', admin: true, analyst: true, data_entry: true, viewer: true },
    { feature: 'Khởi tạo kỳ báo cáo mới', admin: true, analyst: true, data_entry: true, viewer: false },
    { feature: 'Nhập dữ liệu Excel & Thẩm định', admin: true, analyst: true, data_entry: true, viewer: false },
    { feature: 'Trình duyệt báo cáo', admin: true, analyst: true, data_entry: true, viewer: false },
    { feature: 'Phê duyệt báo cáo', admin: true, analyst: true, data_entry: false, viewer: false },
    { feature: 'Tạo nhận xét tự động bằng AI', admin: true, analyst: true, data_entry: false, viewer: false },
    { feature: 'Khóa Báo cáo (Tạo Snapshot bất biến)', admin: true, analyst: false, data_entry: false, viewer: false },
    { feature: 'Quản trị Danh mục Đơn vị & Lĩnh vực', admin: true, analyst: false, data_entry: false, viewer: false },
    { feature: 'Xem Nhật ký hệ thống (Audit Logs)', admin: true, analyst: false, data_entry: false, viewer: false },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Quản trị Người dùng & Phân quyền (RBAC / RLS)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Thiết lập tài khoản người dùng, vai trò bảo mật và kiểm soát truy cập phân tầng
          </p>
        </div>

        <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          Tạo tài khoản đăng nhập tại Supabase Authentication; tại đây chỉ quản lý hồ sơ/RBAC.
        </div>
      </div>

      {/* Users CRUD Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Danh sách Tài khoản & Cán bộ chuyên trách ({users.length})
          </h3>
          <span className="text-[11px] text-slate-500">
            Đang đăng nhập với vai: <strong className="text-blue-700 uppercase">{currentUser.role}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Họ và tên cán bộ</th>
                <th className="p-3">Email công vụ</th>
                <th className="p-3">Đơn vị công tác</th>
                <th className="p-3">Vai trò phân quyền</th>
                <th className="p-3 text-center">Trạng thái</th>
                <th className="p-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const assignedUnit = units.find((un) => un.id === u.unit_id);
                const roleMeta = rolesList.find((r) => r.role === u.role);
                const isSelf = u.id === currentUser.id;

                return (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <span>{u.full_name}</span>
                        {isSelf && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
                            Bạn
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-slate-600 font-mono">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{u.email}</span>
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
                        u.active ? 'text-emerald-700 bg-emerald-50' : 'text-slate-500 bg-slate-100'
                      }`}>
                        {u.active ? 'Hoạt động' : 'Khóa'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(u)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded"
                          title="Sửa tài khoản"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => handleDelete(u)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded"
                            title="Vô hiệu hóa tài khoản"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Test Bench */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 mb-2">
          Mô phỏng Vai trò Phiên làm việc (Role Simulation)
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Nhấp vào vai trò bên dưới để chuyển đổi ngay lập tức phiên làm việc nhằm kiểm thử luồng thao tác:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {rolesList.map((item) => {
            const isCurrent = currentUser.role === item.role;
            return (
              <div
                key={item.role}
                onClick={() => handleSwitch(item.role)}
                className={`border rounded-xl p-4 cursor-pointer transition-all ${
                  isCurrent
                    ? 'border-blue-600 bg-blue-50/40 shadow-xs ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.badgeColor}`}>
                    {item.role.toUpperCase()}
                  </span>
                  {isCurrent && <UserCheck className="w-4 h-4 text-blue-600" />}
                </div>
                <h4 className="text-xs font-bold text-slate-900">{item.title}</h4>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-3">{item.description}</p>
                <button
                  type="button"
                  className={`mt-3 w-full py-1 text-[11px] font-bold rounded-md transition-colors ${
                    isCurrent
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {isCurrent ? 'Đang kích hoạt' : 'Chuyển sang vai này'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Permission Matrix */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Ma trận Phân quyền Chức năng (RBAC / RLS Matrix)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Tính năng & Thao tác nghiệp vụ</th>
                <th className="p-3 text-center">Quản trị viên (Admin)</th>
                <th className="p-3 text-center">Chuyên viên Phân tích</th>
                <th className="p-3 text-center">Chuyên viên Nhập liệu</th>
                <th className="p-3 text-center">Người xem (Viewer)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {permissionsMatrix.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-medium text-slate-800">{row.feature}</td>
                  <td className="p-3 text-center">
                    {row.admin ? (
                      <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-slate-300 mx-auto" />
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {row.analyst ? (
                      <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-slate-300 mx-auto" />
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {row.data_entry ? (
                      <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-slate-300 mx-auto" />
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {row.viewer ? (
                      <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-slate-300 mx-auto" />
                    )}
                  </td>
                </tr>
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
                  Email công vụ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="an.nv@gov.vn"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
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
