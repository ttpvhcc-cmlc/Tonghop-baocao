import * as XLSX from 'xlsx';
import { Report, ReportFieldStatistic } from '../types/database';
import { store } from './store';
import { resolveLinhVuc } from '../utils/fieldResolver';

export function exportReportToExcel(report: Report, stats: ReportFieldStatistic[]): void {
  const wb = XLSX.utils.book_new();
  const sources = store.getSourcesByReport(report.id);
  const fields = store.getFields();

  const titleRow = [`BÁO CÁO TỔNG HỢP TIẾP NHẬN VÀ GIẢI QUYẾT TTHC - ${report.report_name.toUpperCase()}`];
  const infoRow1 = [`Mã báo cáo: ${report.report_code}`, `Kỳ báo cáo: ${report.period_start} đến ${report.period_end}`, `Trạng thái: ${report.status.toUpperCase()}`];
  const infoRow2 = [`Ngày chốt số liệu: ${new Date(report.data_as_of).toLocaleDateString('vi-VN')}`, `Người lập: ${report.created_by}`, `Người duyệt: ${report.approved_by || 'Chưa duyệt'}`];

  const headers = [
    'STT',
    'Nguồn dữ liệu',
    'Đơn vị giải quyết',
    'Lĩnh vực giải quyết',
    'Tổng tiếp nhận (3)',
    'Trực tuyến (4)',
    'Trực tiếp (5)',
    'Từ kỳ trước (6)',
    'Tổng đã giải quyết (7)',
    'Trước hạn (8)',
    'Đúng hạn (9)',
    'Quá hạn (10)',
    'Tổng đang giải quyết (11)',
    'Trong hạn (12)',
    'Quá hạn (13)',
    'Tỷ lệ đúng hạn (%)',
    'Tỷ lệ trực tuyến (%)',
    'Ghi chú',
  ];

  const rows: any[][] = [
    titleRow,
    infoRow1,
    infoRow2,
    [],
    headers,
  ];

  let sumRecTotal = 0;
  let sumRecOnline = 0;
  let sumRecOffline = 0;
  let sumCarried = 0;
  let sumCompTotal = 0;
  let sumCompEarly = 0;
  let sumCompOnTime = 0;
  let sumCompLate = 0;
  let sumPendTotal = 0;
  let sumPendOnTime = 0;
  let sumPendLate = 0;

  stats.forEach((s, idx) => {
    sumRecTotal += s.received_total;
    sumRecOnline += s.received_online;
    sumRecOffline += s.received_offline;
    sumCarried += s.carried_forward;

    sumCompTotal += s.completed_total;
    sumCompEarly += s.completed_early;
    sumCompOnTime += s.completed_on_time;
    sumCompLate += s.completed_late;

    sumPendTotal += s.pending_total;
    sumPendOnTime += s.pending_on_time;
    sumPendLate += s.pending_late;

    const srcObj = sources.find((src) => src.id === s.source_id);
    const sourceName = srcObj?.source_name || s.source_id;
    const linhVuc = resolveLinhVuc(s.field_name_snapshot || s.field_name || '', s.field_id, fields);

    const onTimeRate = s.completed_total > 0
      ? (((s.completed_early + s.completed_on_time) / s.completed_total) * 100).toFixed(1) + '%'
      : '100%';

    const onlineRate = (s.received_online + s.received_offline) > 0
      ? ((s.received_online / (s.received_online + s.received_offline)) * 100).toFixed(1) + '%'
      : '0%';

    rows.push([
      idx + 1,
      sourceName,
      s.unit_name_snapshot,
      linhVuc,
      s.received_total,
      s.received_online,
      s.received_offline,
      s.carried_forward,
      s.completed_total,
      s.completed_early,
      s.completed_on_time,
      s.completed_late,
      s.pending_total,
      s.pending_on_time,
      s.pending_late,
      onTimeRate,
      onlineRate,
      s.notes || '',
    ]);
  });

  // Calculate overall dynamic total row (KHÔNG PHẢI RAW ROW!)
  const totalOnTimeRate = sumCompTotal > 0
    ? (((sumCompEarly + sumCompOnTime) / sumCompTotal) * 100).toFixed(1) + '%'
    : '100%';

  const totalOnlineRate = (sumRecOnline + sumRecOffline) > 0
    ? ((sumRecOnline / (sumRecOnline + sumRecOffline)) * 100).toFixed(1) + '%'
    : '0%';

  rows.push([]);
  rows.push([
    '',
    'TỔNG CỘNG',
    'Toàn đơn vị',
    'Toàn bộ lĩnh vực',
    sumRecTotal,
    sumRecOnline,
    sumRecOffline,
    sumCarried,
    sumCompTotal,
    sumCompEarly,
    sumCompOnTime,
    sumCompLate,
    sumPendTotal,
    sumPendOnTime,
    sumPendLate,
    totalOnTimeRate,
    totalOnlineRate,
    'Số liệu tổng hợp tự động từ hệ thống',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'BAOCAO_TTHC');

  XLSX.writeFile(wb, `${report.report_code}_Xuat_BaoCao.xlsx`);
}

export function exportReportToCSV(report: Report, stats: ReportFieldStatistic[]): void {
  const headers = [
    'STT',
    'Đơn vị',
    'Lĩnh vực',
    'Tổng tiếp nhận',
    'Trực tuyến',
    'Trực tiếp',
    'Từ kỳ trước',
    'Tổng đã giải quyết',
    'Trước hạn',
    'Đúng hạn',
    'Quá hạn',
    'Tổng đang giải quyết',
    'Trong hạn',
    'Quá hạn',
  ];

  const lines: string[] = [];
  lines.push(`"BÁO CÁO TTHC - ${report.report_code} - ${report.report_name}"`);
  lines.push(headers.join(','));

  stats.forEach((s, idx) => {
    lines.push([
      idx + 1,
      `"${s.unit_name_snapshot}"`,
      `"${s.field_name_snapshot}"`,
      s.received_total,
      s.received_online,
      s.received_offline,
      s.carried_forward,
      s.completed_total,
      s.completed_early,
      s.completed_on_time,
      s.completed_late,
      s.pending_total,
      s.pending_on_time,
      s.pending_late,
    ].join(','));
  });

  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${report.report_code}_SoLieu.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
