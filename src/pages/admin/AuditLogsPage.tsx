import React, { useState, useMemo, useEffect } from 'react';
import { store } from '../../services/store';
import { formatDateTime } from '../../utils/format';
import { History, Search, Filter, ShieldCheck, ChevronDown, ChevronRight, Database, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState(store.getAuditLogs());
  const [isCleaning, setIsCleaning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void store.fetchAuditLogs().then(setLogs).catch((error) => {
      console.warn('Audit log load error:', error);
    });
  }, []);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const handleCleanNonReportLogs = async () => {
    if (!window.confirm('Xác nhận dọn dẹp các nhật ký hệ thống không liên quan đến nghiệp vụ báo cáo để tối ưu dung lượng lưu trữ CSDL?')) {
      return;
    }
    setIsCleaning(true);
    try {
      const res = await store.cleanupNonReportAuditLogs();
      const updated = await store.fetchAuditLogs();
      setLogs(updated);
      setNotice(`Đã dọn dẹp thành công ${res.deletedCount} bản ghi nhật ký hệ thống ngoài báo cáo.`);
      setTimeout(() => setNotice(null), 5000);
    } catch (e: any) {
      alert(e.message || 'Lỗi khi dọn dẹp nhật ký.');
    } finally {
      setIsCleaning(false);
    }
  };

  const uniqueActions = useMemo(() => {
    return Array.from(new Set(logs.map((l) => l.action)));
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (actionFilter !== 'ALL' && l.action !== actionFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          l.action.toLowerCase().includes(q) ||
          l.user_id.toLowerCase().includes(q) ||
          l.entity_type.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [logs, search, actionFilter]);

  const getActionBadge = (action: string) => {
    if (action.includes('LOCK')) return 'bg-rose-50 text-rose-700 border-rose-200';
    if (action.includes('APPROVE')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (action.includes('IMPORT')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (action.includes('CREATE')) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Nhật ký Nghiệp vụ Báo cáo (Audit)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Theo dõi vết thao tác: Tạo kỳ, nhập liệu Excel, duyệt số liệu, khóa snapshot và giải trình nghiệp vụ
          </p>
        </div>

        <button
          type="button"
          disabled={isCleaning}
          onClick={handleCleanNonReportLogs}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer shadow-xs disabled:opacity-50"
          title="Xóa bớt nhật ký hệ thống ngoài báo cáo để tiết kiệm lưu trữ CSDL"
        >
          <Database className="w-3.5 h-3.5 text-rose-600" />
          <span>{isCleaning ? 'Đang dọn dẹp...' : 'Dọn dẹp nhật ký ngoài báo cáo'}</span>
        </button>
      </div>

      {/* POLICY NOTICE: CHỈ LƯU THAO TÁC NGHIỆP VỤ BÁO CÁO */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3 text-xs text-blue-900 shadow-xs">
        <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold text-blue-950">
            Chính sách lưu trữ tối ưu CSDL: Chỉ ghi nhận nhật ký thao tác nghiệp vụ báo cáo
          </span>
          <p className="text-blue-800 text-[11px] leading-relaxed">
            Hệ thống đã tự động lọc bỏ các thao tác chung (đăng nhập, tải trang, đổi giao diện, cấu hình danh mục phụ) và chỉ tập trung lưu lại lịch sử thay đổi của các biểu mẫu số liệu, tạo kỳ báo cáo, nhập file Excel, phê duyệt và khóa sổ dữ liệu.
          </p>
        </div>
      </div>

      {notice && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 flex items-center gap-2 text-xs text-emerald-900 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Tìm kiếm người thực hiện, thao tác báo cáo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="w-full sm:w-auto">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full sm:w-auto text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-700"
          >
            <option value="ALL">Tất cả thao tác báo cáo ({logs.length})</option>
            {uniqueActions.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3 w-10"></th>
                <th className="p-3">Thời gian ghi nhận</th>
                <th className="p-3">Người thực hiện</th>
                <th className="p-3">Hành động</th>
                <th className="p-3">Đối tượng tác động</th>
                <th className="p-3">ID Bản ghi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;

                return (
                  <React.Fragment key={log.id}>
                    <tr
                      onClick={() => hasMetadata && setExpandedLogId(isExpanded ? null : log.id)}
                      className={`hover:bg-slate-50 transition-colors ${
                        hasMetadata ? 'cursor-pointer' : ''
                      }`}
                    >
                      <td className="p-3 text-center text-slate-400">
                        {hasMetadata && (
                          isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                        )}
                      </td>
                      <td className="p-3 text-slate-600 whitespace-nowrap">
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="p-3 font-semibold text-slate-900">
                        {log.user_id}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border ${getActionBadge(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-600">
                        {log.entity_type}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-400">
                        {log.entity_id}
                      </td>
                    </tr>

                    {/* Expanded Metadata JSON */}
                    {isExpanded && hasMetadata && (
                      <tr className="bg-slate-900/95 text-emerald-400">
                        <td colSpan={6} className="p-4 font-mono text-[11px] overflow-auto">
                          <span className="text-slate-400 block font-sans mb-1 text-[10px] uppercase">
                            Chi tiết Metadata Audit:
                          </span>
                          <pre className="whitespace-pre-wrap">{JSON.stringify(log.metadata, null, 2)}</pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
