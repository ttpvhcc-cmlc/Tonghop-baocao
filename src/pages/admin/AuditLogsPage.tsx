import React, { useState, useMemo, useEffect } from 'react';
import { store } from '../../services/store';
import { formatDateTime } from '../../utils/format';
import { History, Search, Filter, ShieldCheck, ChevronDown, ChevronRight } from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState(store.getAuditLogs());

  useEffect(() => {
    void store.fetchAuditLogs().then(setLogs).catch((error) => {
      console.warn('Audit log load error:', error);
    });
  }, []);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

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
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center gap-2">
          <History className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Nhật ký Hệ thống (Audit Logs & Vết truy vết)
          </h2>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Theo dõi minh bạch toàn bộ thao tác nhập liệu, thay đổi trạng thái, khóa báo cáo và phân quyền
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Tìm kiếm người thực hiện, hành động..."
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
            <option value="ALL">Tất cả hành động ({logs.length})</option>
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
