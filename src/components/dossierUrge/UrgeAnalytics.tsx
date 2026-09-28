import React, { useRef } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  BarChart3,
  Building2,
  User,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Clock,
  PhoneCall,
  UserCheck,
  FileSpreadsheet,
  Download,
  Printer,
  ChevronRight,
} from 'lucide-react';
import { DossierUrgeRecord } from '../../types/dossierUrge';
import { dossierUrgeStore } from '../../services/dossierUrgeStore';
import * as XLSX from 'xlsx';
import { exportElementToPDF } from '../../utils/pdfExport';

interface UrgeAnalyticsProps {
  filteredUrges: DossierUrgeRecord[];
  onSelectDossier: (dossierCode: string) => void;
  onPrintDossier: (record: DossierUrgeRecord) => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export const UrgeAnalytics: React.FC<UrgeAnalyticsProps> = ({
  filteredUrges,
  onSelectDossier,
  onPrintDossier,
}) => {
  const reportRef = useRef<HTMLDivElement>(null);

  // 1. KPI Stats
  const kpi = dossierUrgeStore.getKPIStats(filteredUrges);

  // 2. Tổng hợp theo Đơn vị chủ trì
  const unitSummary = dossierUrgeStore.getUnitSummary(filteredUrges);

  // 3. Tổng hợp theo Người thụ lý
  const processorSummary = dossierUrgeStore.getProcessorSummary(filteredUrges);

  // 4. Danh sách hồ sơ Đôn đốc nhiều lần (>= 2 lần)
  const multipleUrges = dossierUrgeStore.getMultipleUrgeDossiers(2, filteredUrges);

  // Dữ liệu biểu đồ đơn vị
  const unitChartData = unitSummary.slice(0, 6).map((u) => ({
    name: u.unitName.length > 20 ? u.unitName.slice(0, 20) + '...' : u.unitName,
    fullName: u.unitName,
    total: u.totalUrges,
    multiple: u.multipleUrgeCount,
    responded: u.respondedCount,
  }));

  // Dữ liệu biểu đồ Kênh
  const channelChartData = [
    { name: 'Trực tiếp tại quầy', value: kpi.directCount, color: '#3b82f6' },
    { name: 'Qua Điện thoại / Hotline', value: kpi.phoneCount, color: '#10b981' },
  ];

  // Xuất Excel Báo cáo tổng hợp
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Tổng hợp theo đơn vị
    const unitRows = unitSummary.map((u, i) => ({
      STT: i + 1,
      'Đơn vị chủ trì': u.unitName,
      'Tổng số lượt đôn đốc': u.totalUrges,
      'Số hồ sơ bị đôn đốc': u.dossierCount,
      'Số hồ sơ đôn đốc nhiều lần (≥ 2)': u.multipleUrgeCount,
      'Đã phản hồi': u.respondedCount,
      'Chưa phản hồi / Đang xử lý': u.pendingCount,
      'Tỷ lệ phản hồi (%)': `${u.responseRate}%`,
    }));
    const wsUnits = XLSX.utils.json_to_sheet(unitRows);
    XLSX.utils.book_append_sheet(wb, wsUnits, 'TongHop_Theo_DonVi');

    // Sheet 2: Tổng hợp theo người thụ lý
    const procRows = processorSummary.map((p, i) => ({
      STT: i + 1,
      'Cán bộ / Người thụ lý': p.processorName,
      'Đơn vị công tác': p.unitName,
      'Tổng lượt đôn đốc': p.totalUrges,
      'Số hồ sơ phụ trách': p.dossierCount,
      'Hồ sơ bị đôn đốc nhiều lần': p.multipleUrgeCount,
      'Chờ xử lý': p.pendingCount,
      'Đã có phản hồi': p.respondedCount,
    }));
    const wsProc = XLSX.utils.json_to_sheet(procRows);
    XLSX.utils.book_append_sheet(wb, wsProc, 'TongHop_NguoiThuLy');

    // Sheet 3: Danh sách hồ sơ đôn đốc nhiều lần
    const multiRows = multipleUrges.map((m, i) => ({
      STT: i + 1,
      'Mã hồ sơ': m.dossier_code,
      'Tên Công dân, tổ chức': m.citizen_name,
      'Thủ tục': m.procedure_name,
      'Đơn vị chủ trì': m.assigned_unit,
      'Người thụ lý': m.processor_name,
      'Số lần đôn đốc': m.maxUrgeCount,
      'Lần đôn đốc gần nhất': new Date(m.latest.created_at).toLocaleDateString('vi-VN'),
      'Kênh lần cuối': m.latest.channel === 'direct' ? 'Trực tiếp' : 'Điện thoại',
      'Trạng thái': m.latest.status,
    }));
    const wsMulti = XLSX.utils.json_to_sheet(multiRows);
    XLSX.utils.book_append_sheet(wb, wsMulti, 'HoSo_DonDoc_NhieuLan');

    XLSX.writeFile(wb, `Bao_Cao_Tong_Hop_Don_Doc_TTHC_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Xuất PDF Báo cáo tổng hợp
  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    try {
      await exportElementToPDF({
        element: reportRef.current,
        filename: `Bao_cao_tong_hop_don_doc_${new Date().toISOString().split('T')[0]}.pdf`,
        subtitle: 'Báo cáo tổng hợp tình hình đôn đốc hồ sơ TTHC - UBND Xã Chân Mây - Lăng Cô',
        orientation: 'portrait',
      });
    } catch (e) {
      console.error('PDF export failed:', e);
      window.print();
    }
  };

  return (
    <div className="space-y-6" ref={reportRef}>
      {/* Top Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Tổng hợp & Phân tích số liệu Đôn đốc hồ sơ
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Xuất Excel Tổng hợp
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Xuất Báo cáo PDF
          </button>
        </div>
      </div>

      {/* KPI Ribbons */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Tổng số lượt đôn đốc */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Tổng lượt đôn đốc</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {kpi.totalUrges}
            </span>
            <span className="text-xs text-slate-400">lượt tiếp nhận</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Trên tổng số <strong>{kpi.uniqueDossiers}</strong> hồ sơ TTHC
          </p>
        </div>

        {/* KPI 2: ĐÔN ĐỐC NHIỀU LẦN (ĐIỂM NÓNG CẦN CHẤN CHỈNH) */}
        <div className="bg-gradient-to-br from-amber-50 to-red-50 dark:from-amber-950/40 dark:to-red-950/40 rounded-2xl p-4 sm:p-5 border-2 border-amber-300 dark:border-amber-800 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-amber-800 dark:text-amber-200 text-xs font-bold">
            <span className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-red-500" />
              Đôn đốc nhiều lần (≥ 2 lần)
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-red-600 dark:text-red-400">
              {kpi.multipleUrgeDossiers}
            </span>
            <span className="text-xs font-bold text-red-700 dark:text-red-300">hồ sơ điểm nóng</span>
          </div>
          <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-1 font-medium">
            Công dân nhắc nhở nhiều lần do trễ hạn
          </p>
        </div>

        {/* KPI 3: Cơ cấu Kênh: Trực tiếp vs Điện thoại */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Kênh tiếp nhận</span>
            <PhoneCall className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="text-center">
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400 block">
                {kpi.directPercent}%
              </span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-blue-500" /> Trực tiếp ({kpi.directCount})
              </span>
            </div>
            <div className="w-[1px] h-8 bg-slate-200 dark:bg-slate-700"></div>
            <div className="text-center">
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 block">
                {kpi.phonePercent}%
              </span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <PhoneCall className="w-3 h-3 text-emerald-500" /> Điện thoại ({kpi.phoneCount})
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4: Kết quả giải quyết đôn đốc */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Tỷ lệ phản hồi & Hoàn tất</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {kpi.totalUrges > 0
                ? Math.round(((kpi.respondedCount + kpi.completedCount) / kpi.totalUrges) * 100)
                : 0}
              %
            </span>
            <span className="text-xs text-slate-400">đã xử lý</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Đã xong: <strong>{kpi.completedCount}</strong> | Đã phản hồi: <strong>{kpi.respondedCount}</strong>
          </p>
        </div>
      </div>

      {/* CHUYÊN ĐỀ 1: DANH SÁCH "HỒ SƠ ĐÔN ĐỐC (≥ 2 LẦN)" */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-amber-300 dark:border-amber-800 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-200 dark:border-amber-900/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">
                <Flame className="w-4 h-4" />
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">
                Danh sách hồ sơ đôn đốc (≥ 2 lần)
              </h3>
            </div>
          </div>

          <span className="px-3 py-1 rounded-full bg-red-600 text-white font-black text-xs self-start sm:self-auto shadow-xs">
            {multipleUrges.length} hồ sơ trọng điểm
          </span>
        </div>

        {multipleUrges.length === 0 ? (
          <div className="py-6 text-center text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Hiện không có hồ sơ nào bị đôn đốc nhiều lần trong kỳ báo cáo này.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-bold border-b border-amber-200 dark:border-amber-800">
                <tr>
                  <th className="py-3 px-3 text-center w-12">Số lần</th>
                  <th className="py-3 px-3">Mã hồ sơ</th>
                  <th className="py-3 px-3">Tên Công dân, tổ chức</th>
                  <th className="py-3 px-3">Thủ tục hành chính</th>
                  <th className="py-3 px-3">Đơn vị chủ trì</th>
                  <th className="py-3 px-3">Người thụ lý</th>
                  <th className="py-3 px-3 text-center">Lần cuối</th>
                  <th className="py-3 px-3 text-center">Trạng thái</th>
                  <th className="py-3 px-3 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {multipleUrges.map((item, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-amber-50/60 dark:hover:bg-amber-950/30 transition-colors bg-white dark:bg-slate-900"
                  >
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-black bg-red-600 text-white shadow-xs">
                        {item.maxUrgeCount} lần
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      {item.dossier_code}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white max-w-[150px] truncate" title={item.citizen_name}>
                      {item.citizen_name}
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300 max-w-[180px] truncate" title={item.procedure_name}>
                      {item.procedure_name}
                    </td>
                    <td className="py-3 px-3 text-slate-800 dark:text-slate-200 font-medium">
                      {item.assigned_unit}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      {item.processor_name}
                    </td>
                    <td className="py-3 px-3 text-center text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {new Date(item.latest.created_at).toLocaleDateString('vi-VN')} ({item.latest.channel === 'direct' ? 'Trực tiếp' : 'Điện thoại'})
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        {item.latest.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectDossier(item.dossier_code)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 hover:bg-blue-100 transition-colors cursor-pointer"
                        >
                          Xem lịch sử
                        </button>
                        <button
                          type="button"
                          onClick={() => onPrintDossier(item.latest)}
                          className="p-1 rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="In phiếu đôn đốc khẩn"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CHUYÊN ĐỀ 2: TỔNG HỢP THEO ĐƠN VỊ CHỦ TRÌ (BIỂU ĐỒ & BẢNG SỐ LIỆU) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Biểu đồ số lượng đôn đốc theo Đơn vị */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between">
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              Số lượt đôn đốc theo Đơn vị chủ trì
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">So sánh tổng lượt đôn đốc và số hồ sơ đôn đốc nhiều lần</p>
          </div>

          <div className="h-64 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={unitChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val: any, name: any) => [
                    val,
                    name === 'total'
                      ? 'Tổng lượt đôn đốc'
                      : name === 'multiple'
                      ? 'Đôn đốc nhiều lần (≥ 2)'
                      : 'Đã phản hồi',
                  ]}
                  labelFormatter={(idx, payload) => payload?.[0]?.payload?.fullName || idx}
                />
                <Legend
                  verticalAlign="top"
                  height={36}
                  formatter={(value) =>
                    value === 'total'
                      ? 'Tổng lượt đôn đốc'
                      : value === 'multiple'
                      ? 'Đôn đốc nhiều lần'
                      : 'Đã phản hồi'
                  }
                />
                <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="multiple" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Biểu đồ tròn cơ cấu Kênh liên hệ */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between">
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-emerald-600" />
              Cơ cấu Kênh công dân liên hệ (Trực tiếp vs Điện thoại)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Phân tích hành vi tiếp cận của người dân khi cần đôn đốc</p>
          </div>

          <div className="h-64 w-full mt-4 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={channelChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ percent }) => (percent !== undefined ? `${(percent * 100).toFixed(0)}%` : '')}
                >
                  {channelChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => [`${value} lượt`, 'Số lượng']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bảng chi tiết: Tổng hợp số liệu theo Đơn vị chủ trì */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            Bảng chi tiết số liệu đôn đốc theo Đơn vị chủ trì
          </h3>
          <span className="text-xs text-slate-400">Đơn vị có nhiều đôn đốc nhất xếp đầu</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">STT</th>
                <th className="py-2.5 px-3">Tên đơn vị chủ trì</th>
                <th className="py-2.5 px-3 text-center">Tổng lượt đôn đốc</th>
                <th className="py-2.5 px-3 text-center">Số hồ sơ</th>
                <th className="py-2.5 px-3 text-center text-red-600">Đôn đốc nhiều lần (≥ 2)</th>
                <th className="py-2.5 px-3 text-center">Đã phản hồi</th>
                <th className="py-2.5 px-3 text-center">Chờ xử lý</th>
                <th className="py-2.5 px-3 text-center">Tỷ lệ phản hồi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {unitSummary.map((u, i) => (
                <tr key={i} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-3 text-center text-slate-400 font-medium">{i + 1}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                    {u.unitName}
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-blue-600 dark:text-blue-400">
                    {u.totalUrges}
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-700 dark:text-slate-300">
                    {u.dossierCount}
                  </td>
                  <td className="py-2.5 px-3 text-center font-black text-red-600">
                    {u.multipleUrgeCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 font-bold">
                        {u.multipleUrgeCount}
                      </span>
                    ) : (
                      '0'
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center text-emerald-600 font-medium">
                    {u.respondedCount}
                  </td>
                  <td className="py-2.5 px-3 text-center text-amber-600 font-medium">
                    {u.pendingCount}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="font-bold text-slate-900 dark:text-white">{u.responseRate}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CHUYÊN ĐỀ 3: TỔNG HỢP THEO NGƯỜI THỤ LÝ (CÁN BỘ THỤ LÝ) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-600" />
              Tổng hợp số liệu đôn đốc theo Người thụ lý (Cán bộ thụ lý)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Theo dõi trách nhiệm cá nhân trong công tác tiếp nhận, thẩm định và trả kết quả TTHC
            </p>
          </div>
          <span className="text-xs text-slate-400">{processorSummary.length} cán bộ thụ lý</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">STT</th>
                <th className="py-2.5 px-3">Cán bộ thụ lý</th>
                <th className="py-2.5 px-3">Đơn vị công tác</th>
                <th className="py-2.5 px-3 text-center">Tổng lượt đôn đốc</th>
                <th className="py-2.5 px-3 text-center">Số hồ sơ phụ trách</th>
                <th className="py-2.5 px-3 text-center text-red-600">Đôn đốc nhiều lần</th>
                <th className="py-2.5 px-3 text-center">Đang xử lý / Chờ</th>
                <th className="py-2.5 px-3 text-center">Đã phản hồi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {processorSummary.map((p, i) => (
                <tr key={i} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-3 text-center text-slate-400 font-medium">{i + 1}</td>
                  <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {p.processorName}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 font-medium">
                    {p.unitName}
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-blue-600 dark:text-blue-400">
                    {p.totalUrges}
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-700 dark:text-slate-300">
                    {p.dossierCount}
                  </td>
                  <td className="py-2.5 px-3 text-center font-black text-red-600">
                    {p.multipleUrgeCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 font-bold">
                        {p.multipleUrgeCount} hồ sơ
                      </span>
                    ) : (
                      '0'
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center text-amber-600 font-medium">
                    {p.pendingCount}
                  </td>
                  <td className="py-2.5 px-3 text-center text-emerald-600 font-medium">
                    {p.respondedCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
