import React, { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { store } from '../services/store';
import { formatNumber, formatPercent, formatDate, formatDateTime, getStatusBadge } from '../utils/format';
import { exportReportToExcel, exportReportToCSV } from '../services/exportService';
import { generateAIReportAnalysis } from '../services/aiService';
import { isReadWriteTestPassed } from '../services/dbInit';
import {
  calcCompletionRate,
  calcOnTimeRate,
  calcLateRate,
  calcOnlineRate,
  validateStatisticRow
} from '../features/analysis/formulas';
import {
  FileText,
  Calendar,
  Lock,
  Unlock,
  CheckCircle2,
  Send,
  Download,
  AlertTriangle,
  Sparkles,
  History,
  ArrowLeft,
  Edit3,
  Layers,
  Save,
  Check,
  XCircle,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Building2,
} from 'lucide-react';
import { ReportFieldStatistic } from '../types/database';
import { resolveLinhVuc } from '../utils/fieldResolver';

export const ReportDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUser = store.getCurrentUser();

  const [activeTab, setActiveTab] = useState<'stats' | 'analysis' | 'snapshots'>('stats');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [unitFilter, setUnitFilter] = useState('ALL');

  // Load report data
  const report = useMemo(() => id ? store.getReportById(id) : undefined, [id]);
  const [reportState, setReportState] = useState(report);
  const sources = useMemo(() => id ? store.getSourcesByReport(id) : [], [id]);
  const stats = useMemo(() => id ? store.getStatsByReport(id) : [], [id]);
  const snapshots = useMemo(() => id ? store.getSnapshots(id) : [], [id]);
  const analyses = useMemo(() => id ? store.getAnalyses(id) : [], [id]);

  // AI Analysis state
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [analysisTitle, setAnalysisTitle] = useState('Nhận xét, đánh giá tình hình giải quyết TTHC');
  const [analysisContent, setAnalysisContent] = useState(analyses[0]?.generated_text || analyses[0]?.content || '');
  const [aiSourceType, setAiSourceType] = useState<'gemini' | 'rule_engine' | 'manual'>((analyses[0]?.generated_by as any) || 'manual');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Selected snapshot for inspection
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);

  // Inline editing states
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [editingStats, setEditingStats] = useState<ReportFieldStatistic[]>([]);

  const handleStartEditingStats = () => {
    setIsEditingInline(true);
    setEditingStats(JSON.parse(JSON.stringify(stats))); // Deep copy
  };

  const handleCancelEditingStats = () => {
    if (window.confirm('Bạn có muốn HỦY BỎ toàn bộ các thay đổi số liệu chưa lưu?')) {
      setIsEditingInline(false);
      setEditingStats([]);
    }
  };

  const handleSaveEditingStats = () => {
    if (!reportState) return;
    try {
      store.updateReportStatsList(reportState.id, editingStats);
      setIsEditingInline(false);
      // Force refresh data
      const freshReport = store.getReportById(reportState.id);
      if (freshReport) setReportState(freshReport);
      setEditingStats([]);
      alert('Cập nhật số liệu thống kê trực tiếp thành công!');
    } catch (err: any) {
      alert(err.message || 'Lỗi khi cập nhật số liệu');
    }
  };

  const handleStatFieldChange = (statId: string, field: string, value: string) => {
    setEditingStats((prev) =>
      prev.map((s) => {
        if (s.id !== statId) return s;

        const updated = {
          ...s,
          [field]: field === 'notes' ? value : (Number(value) || 0),
        };

        // Recalculate totals according to strict formulas
        updated.received_total = updated.received_online + updated.received_offline + updated.carried_forward;
        updated.completed_total = updated.completed_early + updated.completed_on_time + updated.completed_late;
        updated.pending_total = updated.pending_on_time + updated.pending_late;

        // Run formulas validation
        const valResult = validateStatisticRow({
          received_total: updated.received_total,
          received_online: updated.received_online,
          received_offline: updated.received_offline,
          carried_forward: updated.carried_forward,
          completed_total: updated.completed_total,
          completed_early: updated.completed_early,
          completed_on_time: updated.completed_on_time,
          completed_late: updated.completed_late,
          pending_total: updated.pending_total,
          pending_on_time: updated.pending_on_time,
          pending_late: updated.pending_late,
        });

        updated.validation_status = valResult.isValid ? (valResult.hasWarning ? 'warning' : 'valid') : 'error';
        updated.validation_errors = valResult.errors;

        return updated;
      })
    );
  };

  if (!reportState) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <h3 className="text-base font-bold text-slate-800">Không tìm thấy báo cáo</h3>
        <p className="text-xs text-slate-500 mt-1">Báo cáo không tồn tại hoặc đã bị xóa.</p>
        <Link to="/reports" className="mt-4 inline-block text-xs font-semibold text-blue-600">
          ← Quay lại danh sách báo cáo
        </Link>
      </div>
    );
  }

  const isLocked = reportState.status === 'locked';
  const badge = getStatusBadge(reportState.status);

  // Filtered stats
  const filteredStats = stats.filter((s) => {
    if (sourceFilter !== 'ALL' && s.source_id !== sourceFilter) return false;
    if (unitFilter !== 'ALL' && s.unit_id !== unitFilter) return false;
    return true;
  });

  const displayedStats = useMemo(() => {
    const list = isEditingInline ? editingStats : stats;
    return list.filter((s) => {
      if (sourceFilter !== 'ALL' && s.source_id !== sourceFilter) return false;
      if (unitFilter !== 'ALL' && s.unit_id !== unitFilter) return false;
      return true;
    });
  }, [isEditingInline, editingStats, stats, sourceFilter, unitFilter]);

  // Collapsible state for source groups
  const [collapsedSources, setCollapsedSources] = useState<Record<string, boolean>>({});

  const toggleSourceCollapse = (sourceId: string) => {
    setCollapsedSources((prev) => ({
      ...prev,
      [sourceId]: !prev[sourceId],
    }));
  };

  const expandAllSources = () => setCollapsedSources({});

  const collapseAllSources = () => {
    const all: Record<string, boolean> = {};
    sources.forEach((src) => {
      all[src.id] = true;
    });
    setCollapsedSources(all);
  };

  const toRoman = (num: number): string => {
    const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    return romans[num] || String(num + 1);
  };

  // Group displayedStats by Source with automatic sorting (Hệ thống các Bộ -> Hệ thống thành phố)
  const groupedStats = useMemo(() => {
    const map = new Map<string, ReportFieldStatistic[]>();
    displayedStats.forEach((s) => {
      const list = map.get(s.source_id) || [];
      list.push(s);
      map.set(s.source_id, list);
    });

    const sourceKeys = Array.from(map.keys());
    sourceKeys.sort((a, b) => {
      const nameA = (sources.find((s) => s.id === a)?.source_name || a).toLowerCase();
      const nameB = (sources.find((s) => s.id === b)?.source_name || b).toLowerCase();
      if (nameA.includes('bộ') || nameA.includes('bo')) return -1;
      if (nameB.includes('bộ') || nameB.includes('bo')) return 1;
      return nameA.localeCompare(nameB);
    });

    return sourceKeys.map((srcId) => {
      const items = map.get(srcId) || [];
      const srcObj = sources.find((s) => s.id === srcId);
      const sourceName = srcObj?.source_name || (srcId.toLowerCase().includes('bo') ? 'Hệ thống các Bộ' : 'Hệ thống thành phố');

      let recTotal = 0, recOnline = 0, recOffline = 0, carried = 0;
      let compTotal = 0, compEarly = 0, compOnTime = 0, compLate = 0;
      let pendTotal = 0, pendOnTime = 0, pendLate = 0;

      items.forEach((s) => {
        recTotal += s.received_total;
        recOnline += s.received_online;
        recOffline += s.received_offline;
        carried += s.carried_forward;
        compTotal += s.completed_total;
        compEarly += s.completed_early;
        compOnTime += s.completed_on_time;
        compLate += s.completed_late;
        pendTotal += s.pending_total;
        pendOnTime += s.pending_on_time;
        pendLate += s.pending_late;
      });

      const onTimeRate = compTotal > 0
        ? (((compEarly + compOnTime) / compTotal) * 100).toFixed(1) + '%'
        : '100%';

      return {
        sourceId: srcId,
        sourceName,
        srcObj,
        items,
        subtotal: {
          recTotal,
          recOnline,
          recOffline,
          carried,
          compTotal,
          compEarly,
          compOnTime,
          compLate,
          pendTotal,
          pendOnTime,
          pendLate,
          onTimeRate,
        },
      };
    });
  }, [displayedStats, sources]);

  // Calculate totals
  const totalStats = useMemo(() => {
    let recTotal = 0;
    let recOnline = 0;
    let recOffline = 0;
    let carried = 0;
    let compTotal = 0;
    let compEarly = 0;
    let compOnTime = 0;
    let compLate = 0;
    let pendTotal = 0;
    let pendOnTime = 0;
    let pendLate = 0;

    displayedStats.forEach((s) => {
      recTotal += s.received_total;
      recOnline += s.received_online;
      recOffline += s.received_offline;
      carried += s.carried_forward;
      compTotal += s.completed_total;
      compEarly += s.completed_early;
      compOnTime += s.completed_on_time;
      compLate += s.completed_late;
      pendTotal += s.pending_total;
      pendOnTime += s.pending_on_time;
      pendLate += s.pending_late;
    });

    const completionRate = calcCompletionRate(compTotal, recTotal);
    const onTimeRate = calcOnTimeRate(compEarly, compOnTime, compTotal);
    const lateRate = calcLateRate(compLate, compTotal);
    const onlineRate = calcOnlineRate(recOnline, recOffline);

    return {
      recTotal,
      recOnline,
      recOffline,
      carried,
      compTotal,
      compEarly,
      compOnTime,
      compLate,
      pendTotal,
      pendOnTime,
      pendLate,
      completionRate,
      onTimeRate,
      lateRate,
      onlineRate,
    };
  }, [displayedStats]);

  // Unit breakdown for AI
  const unitBreakdown = useMemo(() => {
    const map: Record<string, { unitName: string; received: number; completed: number; late: number; onTimeRate: number; pending: number }> = {};
    stats.forEach((s) => {
      const uName = s.unit_name_snapshot || s.unit_name || 'Đơn vị';
      if (!map[uName]) {
        map[uName] = { unitName: uName, received: 0, completed: 0, late: 0, onTimeRate: 100, pending: 0 };
      }
      map[uName].received += s.received_total;
      map[uName].completed += s.completed_total;
      map[uName].late += s.completed_late;
      map[uName].pending += s.pending_total;
    });

    return Object.values(map).map((u) => ({
      ...u,
      onTimeRate: u.completed > 0 ? Number((((u.completed - u.late) / u.completed) * 100).toFixed(1)) : 100,
    }));
  }, [stats]);

  // Workflow actions
  const handleUpdateStatus = (newStatus: any) => {
    try {
      const updated = store.updateReportStatus(reportState.id, newStatus);
      setReportState(updated);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Generate AI Analysis
  const handleGenerateAI = async () => {
    if (!stats || stats.length === 0) {
      alert('Chưa có số liệu thống kê để phân tích. Vui lòng nhập số liệu hoặc tải dữ liệu excel trước.');
      return;
    }
    setIsGeneratingAI(true);
    try {
      const warnings = stats
        .filter((s) => s.validation_status === 'warning')
        .map((s) => `${s.field_name_snapshot} (${s.source_id}): ${s.validation_errors.map((e) => e.message).join(', ')}`);

      const result = await generateAIReportAnalysis({
        reportName: reportState.report_name,
        period: `${formatDate(reportState.period_start)} đến ${formatDate(reportState.period_end)}`,
        promptScope: 'Đánh giá toàn diện kết quả giải quyết TTHC, chỉ rõ điểm nghẽn và đề xuất chỉ đạo',
        metricsSummary: {
          totals: {
            received: totalStats.recTotal,
            online: totalStats.recOnline,
            offline: totalStats.recOffline,
            carried: totalStats.carried,
            completed: totalStats.compTotal,
            onTime: totalStats.compEarly + totalStats.compOnTime,
            late: totalStats.compLate,
            pending: totalStats.pendTotal,
            pendingOnTime: totalStats.pendOnTime,
            pendingLate: totalStats.pendLate,
            onTimeRate: totalStats.onTimeRate,
            onlineRate: totalStats.onlineRate,
            completionRate: totalStats.completionRate,
          },
          unitBreakdown,
          notableWarnings: warnings,
        },
      });

      setAnalysisContent(result.analysisText);
      setAiSourceType(result.generatedBy);
    } catch (err: any) {
      alert('Không thể tạo phân tích: ' + err.message);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Save Analysis
  const handleSaveAnalysis = () => {
    try {
      store.saveAnalysis({
        report_id: reportState.id,
        section: 'Nhận xét, đánh giá',
        content: analysisContent,
        scope_type: 'report',
        title: analysisTitle,
        generated_text: analysisContent,
        generated_by: aiSourceType,
        source_metrics: {
          received: totalStats.recTotal,
          completed: totalStats.compTotal,
          onTimeRate: totalStats.onTimeRate,
        },
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/reports')}
                className="text-slate-400 hover:text-slate-700"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                {reportState.report_code}: {reportState.report_name}
              </h2>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}>
                {badge.label}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2 ml-8">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(reportState.period_start)} – {formatDate(reportState.period_end)}
              </span>
              <span>•</span>
              <span>Chốt số liệu: {formatDateTime(reportState.data_as_of)}</span>
              <span>•</span>
              <span>Người tạo: {reportState.created_by}</span>
              {reportState.approved_by && (
                <>
                  <span>•</span>
                  <span className="text-emerald-700 font-medium">Duyệt bởi: {reportState.approved_by}</span>
                </>
              )}
            </div>
          </div>

          {/* Workflow Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => exportReportToExcel(reportState, stats)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Xuất Excel
            </button>

            {/* Workflow status transitions */}
            {!isLocked && (
              <>
                {reportState.status !== 'submitted' && reportState.status !== 'approved' && (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus('submitted')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" /> Trình duyệt
                  </button>
                )}

                {currentUser.role !== 'viewer' && currentUser.role !== 'data_entry' && reportState.status !== 'approved' && (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus('approved')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Phê duyệt
                  </button>
                )}

                {currentUser.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Khóa báo cáo sẽ lưu Snapshot bất biến và ngăn mọi thao tác sửa đổi. Xác nhận?')) {
                        handleUpdateStatus('locked');
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-xs"
                  >
                    <Lock className="w-3.5 h-3.5" /> Khóa Snapshot
                  </button>
                )}
              </>
            )}

            {isLocked && currentUser.role === 'admin' && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Mở khóa báo cáo để chỉnh sửa? Thao tác này sẽ được ghi vào Audit Log.')) {
                    handleUpdateStatus('approved');
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
              >
                <Unlock className="w-3.5 h-3.5" /> Mở khóa (Admin)
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mt-5 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setActiveTab('stats')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'stats'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Số liệu thống kê chi tiết ({stats.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analysis')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'analysis'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Phân tích & Nhận xét AI</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('snapshots')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'snapshots'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Lịch sử Snapshot ({snapshots.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: STATS TABLE */}
      {activeTab === 'stats' && (
        <div className="space-y-4">
          {/* Filters & Actions Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Lọc Nguồn:</span>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                disabled={isEditingInline}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 font-medium text-slate-700 disabled:opacity-60"
              >
                <option value="ALL">Tất cả nguồn ({groupedStats.length} nhóm)</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.source_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Lọc Đơn vị:</span>
              <select
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value)}
                disabled={isEditingInline}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 font-medium text-slate-700 disabled:opacity-60"
              >
                <option value="ALL">Tất cả đơn vị</option>
                {store.getUnits().map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Expand / Collapse All Quick Controls */}
            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
              <button
                type="button"
                onClick={expandAllSources}
                title="Mở rộng tất cả các nhóm nguồn"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
              >
                <ChevronsDown className="w-3.5 h-3.5 text-slate-600" />
                <span>Mở rộng tất cả</span>
              </button>
              <button
                type="button"
                onClick={collapseAllSources}
                title="Thu gọn tất cả các nhóm nguồn"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
              >
                <ChevronsUp className="w-3.5 h-3.5 text-slate-600" />
                <span>Thu gọn tất cả</span>
              </button>
            </div>

            {!isLocked && currentUser.role !== 'viewer' && (
              <div className="ml-auto flex items-center gap-2">
                {isEditingInline ? (
                  <>
                    <button
                      type="button"
                      onClick={handleCancelEditingStats}
                      className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEditingStats}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Lưu số liệu ({editingStats.length} dòng)</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleStartEditingStats}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors shadow-xs"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Sửa trực tiếp số liệu</span>
                    </button>

                    <Link
                      to="/import"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors shadow-xs"
                    >
                      + Nhập đè Excel mới
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Statistical Grid with Collapsible Source Groups */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto max-h-[700px]">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 z-20 border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="p-2.5 text-center w-12">STT</th>
                    <th className="p-2.5 min-w-[130px]">Đơn vị</th>
                    <th className="p-2.5 min-w-[180px]">Lĩnh vực giải quyết</th>
                    <th className="p-2.5 text-right bg-blue-50/50">Tổng TN (3)</th>
                    <th className="p-2.5 text-right">Trực tuyến (4)</th>
                    <th className="p-2.5 text-right">Trực tiếp (5)</th>
                    <th className="p-2.5 text-right">Kỳ trước (6)</th>
                    <th className="p-2.5 text-right bg-emerald-50/50">Tổng GQ (7)</th>
                    <th className="p-2.5 text-right">Trước hạn (8)</th>
                    <th className="p-2.5 text-right">Đúng hạn (9)</th>
                    <th className="p-2.5 text-right">Quá hạn (10)</th>
                    <th className="p-2.5 text-right bg-amber-50/50">Tổng Tồn (11)</th>
                    <th className="p-2.5 text-right">Trong hạn (12)</th>
                    <th className="p-2.5 text-right">Quá hạn (13)</th>
                    <th className="p-2.5 text-center">Đúng hạn %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {groupedStats.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="py-12 text-center text-slate-500 font-sans">
                        Chưa có số liệu thống kê cho báo cáo này. Vui lòng bấm <strong>+ Nhập đè Excel mới</strong> để tải lên dữ liệu.
                      </td>
                    </tr>
                  ) : (
                    groupedStats.map((group, groupIndex) => {
                      const isCollapsed = Boolean(collapsedSources[group.sourceId]);
                      const romanNum = toRoman(groupIndex);

                      return (
                        <React.Fragment key={group.sourceId}>
                          {/* GROUP HEADER ROW - Clickable to expand/collapse */}
                          <tr
                            onClick={() => toggleSourceCollapse(group.sourceId)}
                            className="bg-slate-800 text-white cursor-pointer hover:bg-slate-700 select-none transition-colors border-y-2 border-slate-700 sticky z-10"
                            style={{ top: '37px' }}
                          >
                            <td colSpan={15} className="py-2.5 px-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <span className="p-1 rounded bg-slate-700 text-amber-400">
                                    {isCollapsed ? (
                                      <ChevronRight className="w-4 h-4" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4" />
                                    )}
                                  </span>
                                  <span className="font-sans font-black tracking-wide text-xs uppercase text-amber-300">
                                    {romanNum}. {group.sourceName}
                                  </span>
                                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-200 border border-slate-600 font-sans font-medium">
                                    {group.items.length} lĩnh vực
                                  </span>
                                </div>

                                <div className="flex items-center gap-2.5 text-[11px] font-mono">
                                  <span className="text-blue-300">
                                    Tiếp nhận: <strong className="text-white font-bold">{formatNumber(group.subtotal.recTotal)}</strong>
                                  </span>
                                  <span className="text-slate-500">|</span>
                                  <span className="text-emerald-300">
                                    Đã GQ: <strong className="text-white font-bold">{formatNumber(group.subtotal.compTotal)}</strong>
                                  </span>
                                  <span className="text-slate-500">|</span>
                                  <span className="text-amber-300">
                                    Tồn: <strong className="text-white font-bold">{formatNumber(group.subtotal.pendTotal)}</strong>
                                  </span>
                                  <span className="text-slate-500">|</span>
                                  <span className="text-emerald-400 font-bold">
                                    Đúng hạn: {group.subtotal.onTimeRate}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-sans italic ml-1">
                                    {isCollapsed ? '(Nhấn để mở rộng ▼)' : '(Nhấn để thu gọn ▲)'}
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>

                          {/* STATISTICAL ROWS FOR THIS GROUP */}
                          {!isCollapsed &&
                            group.items.map((s, idx) => {
                              const resolvedSector = resolveLinhVuc(
                                s.field_name_snapshot || s.field_name || '',
                                s.field_id,
                                store.getFields()
                              );

                              const onTimeRate =
                                s.completed_total > 0
                                  ? (((s.completed_early + s.completed_on_time) / s.completed_total) * 100).toFixed(1) + '%'
                                  : '100%';
                              const hasWarn =
                                s.validation_status === 'warning' ||
                                s.validation_status === 'error' ||
                                (s.validation_errors && s.validation_errors.length > 0);

                              return (
                                <tr
                                  key={s.id}
                                  className={`hover:bg-slate-50 transition-colors ${hasWarn ? 'bg-amber-50/40' : ''}`}
                                >
                                  <td className="p-2.5 text-center text-slate-400 font-sans">{idx + 1}</td>
                                  <td className="p-2.5 font-sans font-semibold text-slate-700">
                                    {s.unit_name_snapshot || 'Chưa gán đơn vị'}
                                  </td>
                                  <td className="p-2.5 font-sans font-bold text-slate-900">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-slate-900">{resolvedSector}</span>
                                      {hasWarn && (
                                        <span title={s.validation_errors?.map((e: any) => e.message).join('\n')}>
                                          {s.validation_status === 'error' ? (
                                            <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 inline" />
                                          ) : (
                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 inline" />
                                          )}
                                        </span>
                                      )}
                                    </div>
                                    {isEditingInline ? (
                                      <input
                                        type="text"
                                        className="mt-1 w-full text-[10px] px-1.5 py-0.5 bg-white border border-slate-200 rounded font-sans focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                                        placeholder="Ghi chú dòng số liệu..."
                                        value={s.notes || ''}
                                        onChange={(e) => handleStatFieldChange(s.id, 'notes', e.target.value)}
                                      />
                                    ) : (
                                      s.notes && <span className="text-[10px] text-amber-700 block font-sans font-normal">{s.notes}</span>
                                    )}
                                  </td>

                                  {/* Metric Columns */}
                                  <td className="p-2.5 text-right font-bold text-slate-900 bg-blue-50/20">
                                    {formatNumber(s.received_total)}
                                  </td>

                                  <td className="p-2.5 text-right">
                                    {isEditingInline ? (
                                      <input
                                        type="number"
                                        min={0}
                                        className="w-14 bg-white border border-slate-200 focus:border-blue-500 rounded px-1 py-0.5 text-right font-mono text-xs focus:ring-1 focus:ring-blue-500"
                                        value={s.received_online}
                                        onChange={(e) => handleStatFieldChange(s.id, 'received_online', e.target.value)}
                                      />
                                    ) : (
                                      <span className="text-blue-600">{formatNumber(s.received_online)}</span>
                                    )}
                                  </td>

                                  <td className="p-2.5 text-right">
                                    {isEditingInline ? (
                                      <input
                                        type="number"
                                        min={0}
                                        className="w-14 bg-white border border-slate-200 focus:border-blue-500 rounded px-1 py-0.5 text-right font-mono text-xs focus:ring-1 focus:ring-blue-500"
                                        value={s.received_offline}
                                        onChange={(e) => handleStatFieldChange(s.id, 'received_offline', e.target.value)}
                                      />
                                    ) : (
                                      <span className="text-slate-600">{formatNumber(s.received_offline)}</span>
                                    )}
                                  </td>

                                  <td className="p-2.5 text-right">
                                    {isEditingInline ? (
                                      <input
                                        type="number"
                                        min={0}
                                        className="w-14 bg-white border border-slate-200 focus:border-blue-500 rounded px-1 py-0.5 text-right font-mono text-xs focus:ring-1 focus:ring-blue-500"
                                        value={s.carried_forward}
                                        onChange={(e) => handleStatFieldChange(s.id, 'carried_forward', e.target.value)}
                                      />
                                    ) : (
                                      <span className="text-amber-600">{formatNumber(s.carried_forward)}</span>
                                    )}
                                  </td>

                                  <td className="p-2.5 text-right font-bold text-emerald-700 bg-emerald-50/20">
                                    {formatNumber(s.completed_total)}
                                  </td>

                                  <td className="p-2.5 text-right">
                                    {isEditingInline ? (
                                      <input
                                        type="number"
                                        min={0}
                                        className="w-14 bg-white border border-slate-200 focus:border-blue-500 rounded px-1 py-0.5 text-right font-mono text-xs focus:ring-1 focus:ring-blue-500"
                                        value={s.completed_early}
                                        onChange={(e) => handleStatFieldChange(s.id, 'completed_early', e.target.value)}
                                      />
                                    ) : (
                                      <span className="text-slate-600">{formatNumber(s.completed_early)}</span>
                                    )}
                                  </td>

                                  <td className="p-2.5 text-right">
                                    {isEditingInline ? (
                                      <input
                                        type="number"
                                        min={0}
                                        className="w-14 bg-white border border-slate-200 focus:border-blue-500 rounded px-1 py-0.5 text-right font-mono text-xs focus:ring-1 focus:ring-blue-500"
                                        value={s.completed_on_time}
                                        onChange={(e) => handleStatFieldChange(s.id, 'completed_on_time', e.target.value)}
                                      />
                                    ) : (
                                      <span className="text-slate-600">{formatNumber(s.completed_on_time)}</span>
                                    )}
                                  </td>

                                  <td className="p-2.5 text-right">
                                    {isEditingInline ? (
                                      <input
                                        type="number"
                                        min={0}
                                        className="w-14 bg-white border border-slate-200 focus:border-blue-500 rounded px-1 py-0.5 text-right font-mono text-xs focus:ring-1 focus:ring-blue-500"
                                        value={s.completed_late}
                                        onChange={(e) => handleStatFieldChange(s.id, 'completed_late', e.target.value)}
                                      />
                                    ) : (
                                      <span className={s.completed_late > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}>
                                        {formatNumber(s.completed_late)}
                                      </span>
                                    )}
                                  </td>

                                  <td className="p-2.5 text-right font-bold text-amber-700 bg-amber-50/20">
                                    {formatNumber(s.pending_total)}
                                  </td>

                                  <td className="p-2.5 text-right">
                                    {isEditingInline ? (
                                      <input
                                        type="number"
                                        min={0}
                                        className="w-14 bg-white border border-slate-200 focus:border-blue-500 rounded px-1 py-0.5 text-right font-mono text-xs focus:ring-1 focus:ring-blue-500"
                                        value={s.pending_on_time}
                                        onChange={(e) => handleStatFieldChange(s.id, 'pending_on_time', e.target.value)}
                                      />
                                    ) : (
                                      <span className="text-slate-600">{formatNumber(s.pending_on_time)}</span>
                                    )}
                                  </td>

                                  <td className="p-2.5 text-right">
                                    {isEditingInline ? (
                                      <input
                                        type="number"
                                        min={0}
                                        className="w-14 bg-white border border-slate-200 focus:border-blue-500 rounded px-1 py-0.5 text-right font-mono text-xs focus:ring-1 focus:ring-blue-500"
                                        value={s.pending_late}
                                        onChange={(e) => handleStatFieldChange(s.id, 'pending_late', e.target.value)}
                                      />
                                    ) : (
                                      <span className={s.pending_late > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}>
                                        {formatNumber(s.pending_late)}
                                      </span>
                                    )}
                                  </td>

                                  <td className="p-2.5 text-center font-sans font-semibold text-emerald-700">
                                    {onTimeRate}
                                  </td>
                                </tr>
                              );
                            })}

                          {/* GROUP SUBTOTAL ROW */}
                          {!isCollapsed && (
                            <tr className="bg-slate-100 font-mono font-bold text-slate-800 border-b-2 border-slate-300">
                              <td className="p-2.5 text-center text-slate-500 font-sans">∑</td>
                              <td colSpan={2} className="p-2.5 font-sans font-bold text-slate-800 text-xs">
                                Cộng nhóm: {group.sourceName} ({group.items.length} lĩnh vực)
                              </td>
                              <td className="p-2.5 text-right text-blue-700 bg-blue-100/40">
                                {formatNumber(group.subtotal.recTotal)}
                              </td>
                              <td className="p-2.5 text-right text-slate-700">{formatNumber(group.subtotal.recOnline)}</td>
                              <td className="p-2.5 text-right text-slate-700">{formatNumber(group.subtotal.recOffline)}</td>
                              <td className="p-2.5 text-right text-amber-700">{formatNumber(group.subtotal.carried)}</td>
                              <td className="p-2.5 text-right text-emerald-700 bg-emerald-100/40">
                                {formatNumber(group.subtotal.compTotal)}
                              </td>
                              <td className="p-2.5 text-right text-slate-700">{formatNumber(group.subtotal.compEarly)}</td>
                              <td className="p-2.5 text-right text-slate-700">{formatNumber(group.subtotal.compOnTime)}</td>
                              <td className="p-2.5 text-right text-rose-700">{formatNumber(group.subtotal.compLate)}</td>
                              <td className="p-2.5 text-right text-amber-700 bg-amber-100/40">
                                {formatNumber(group.subtotal.pendTotal)}
                              </td>
                              <td className="p-2.5 text-right text-slate-700">{formatNumber(group.subtotal.pendOnTime)}</td>
                              <td className="p-2.5 text-right text-rose-700">{formatNumber(group.subtotal.pendLate)}</td>
                              <td className="p-2.5 text-center font-sans text-emerald-800 font-extrabold">
                                {group.subtotal.onTimeRate}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>

                {/* DÒNG TỔNG CỘNG TOÀN BỘ BÁO CÁO */}
                <tfoot className="bg-slate-900 text-white font-mono font-bold sticky bottom-0 z-20 border-t-2 border-slate-700">
                  <tr>
                    <td className="p-3 text-center">∑</td>
                    <td colSpan={2} className="p-3 font-sans font-black tracking-wide text-xs uppercase text-amber-300">
                      TỔNG CỘNG TOÀN BỘ BÁO CÁO ({displayedStats.length} LĨNH VỰC)
                    </td>
                    <td className="p-3 text-right text-blue-300 bg-blue-950/40">{formatNumber(totalStats.recTotal)}</td>
                    <td className="p-3 text-right text-blue-200">{formatNumber(totalStats.recOnline)}</td>
                    <td className="p-3 text-right text-slate-300">{formatNumber(totalStats.recOffline)}</td>
                    <td className="p-3 text-right text-amber-300">{formatNumber(totalStats.carried)}</td>

                    <td className="p-3 text-right text-emerald-300 bg-emerald-950/40">{formatNumber(totalStats.compTotal)}</td>
                    <td className="p-3 text-right text-slate-300">{formatNumber(totalStats.compEarly)}</td>
                    <td className="p-3 text-right text-slate-300">{formatNumber(totalStats.compOnTime)}</td>
                    <td className="p-3 text-right text-rose-300">{formatNumber(totalStats.compLate)}</td>

                    <td className="p-3 text-right text-amber-300 bg-amber-950/40">{formatNumber(totalStats.pendTotal)}</td>
                    <td className="p-3 text-right text-slate-300">{formatNumber(totalStats.pendOnTime)}</td>
                    <td className="p-3 text-right text-rose-300">{formatNumber(totalStats.pendLate)}</td>

                    <td className="p-3 text-center font-sans text-emerald-400 font-black">
                      {formatPercent(totalStats.onTimeRate)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AI ANALYSIS & EDIT */}
      {activeTab === 'analysis' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Metrics summary reference panel */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Dữ liệu Metrics tham chiếu (Database Source of Truth)
            </h3>
            <p className="text-xs text-slate-500">
              AI chỉ diễn giải dựa trên các con số đã được tính toán dưới đây, không tự phát sinh số:
            </p>

            <div className="space-y-2 text-xs divide-y divide-slate-100">
              <div className="flex justify-between pt-2">
                <span className="text-slate-600">Tổng tiếp nhận:</span>
                <span className="font-bold text-slate-900">{formatNumber(totalStats.recTotal)}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-600">Nộp trực tuyến:</span>
                <span className="font-bold text-blue-600">{formatNumber(totalStats.recOnline)} ({formatPercent(totalStats.onlineRate)})</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-600">Tổng đã giải quyết:</span>
                <span className="font-bold text-emerald-600">{formatNumber(totalStats.compTotal)} ({formatPercent(totalStats.completionRate)})</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-600">Tỷ lệ đúng hạn:</span>
                <span className="font-bold text-emerald-700">{formatPercent(totalStats.onTimeRate)}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-600">Số hồ sơ quá hạn:</span>
                <span className="font-bold text-rose-600">{formatNumber(totalStats.compLate)} ({formatPercent(totalStats.lateRate)})</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-600">Hồ sơ đang xử lý:</span>
                <span className="font-bold text-amber-600">{formatNumber(totalStats.pendTotal)}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleGenerateAI}
                disabled={isGeneratingAI || isLocked}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg shadow-sm transition-all disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isGeneratingAI ? 'Đang phân tích...' : 'Tạo nhận xét tự động AI'}</span>
              </button>
            </div>
          </div>

          {/* Editorial Area */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Dự thảo Nhận xét & Đánh giá Báo cáo
                </h3>
                <span className="text-[11px] text-slate-400">
                  Nguồn phân tích: {aiSourceType === 'gemini' ? 'Gemini AI (Server-side)' : aiSourceType === 'rule_engine' ? 'Rule Engine Phân tích' : 'Chuyên viên tự biên tập'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleSaveAnalysis}
                disabled={isLocked}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs disabled:opacity-50"
              >
                {saveSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>Đã lưu thành công</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Lưu nhận xét</span>
                  </>
                )}
              </button>
            </div>

            <input
              type="text"
              value={analysisTitle}
              onChange={(e) => setAnalysisTitle(e.target.value)}
              disabled={isLocked}
              className="w-full text-xs font-bold px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Tiêu đề phân tích..."
            />

            <textarea
              rows={14}
              value={analysisContent}
              onChange={(e) => {
                setAnalysisContent(e.target.value);
                setAiSourceType('manual');
              }}
              disabled={isLocked}
              placeholder="Nội dung đánh giá, nhận xét, chỉ ra điểm nghẽn và phương hướng chỉ đạo kỳ tới..."
              className="w-full text-xs leading-relaxed p-4 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
            />
          </div>
        </div>
      )}

      {/* TAB 3: SNAPSHOTS & AUDIT IMMUTABILITY */}
      {activeTab === 'snapshots' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900">
              Các phiên bản Snapshot đã đóng băng bất biến
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Khi báo cáo bị Khóa, một bản chụp toàn vẹn (Snapshot JSON) chứa đầy đủ metadata, danh sách nguồn và số liệu chi tiết được lưu lại vĩnh viễn.
            </p>

            <div className="mt-4 space-y-3">
              {snapshots.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Chưa có snapshot nào được tạo cho kỳ này.</p>
              ) : (
                snapshots.map((snap) => (
                  <div key={snap.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-bold font-mono">
                          Phiên bản v{snap.version_number}
                        </span>
                        <span className="text-xs font-bold text-slate-800">{snap.reason}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Khóa bởi: <span className="font-semibold">{snap.created_by}</span> lúc {formatDateTime(snap.created_at)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedSnapshotId(selectedSnapshotId === snap.id ? null : snap.id)}
                      className="px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200"
                    >
                      {selectedSnapshotId === snap.id ? 'Ẩn cấu trúc JSON' : 'Xem chi tiết Snapshot'}
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* JSON Viewer */}
            {selectedSnapshotId && (
              <div className="mt-4 p-4 bg-slate-900 text-emerald-400 rounded-xl text-[11px] font-mono overflow-auto max-h-96">
                <pre>{JSON.stringify(snapshots.find((s) => s.id === selectedSnapshotId)?.snapshot_json, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
