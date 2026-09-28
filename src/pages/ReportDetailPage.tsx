import React, { useState, useMemo, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { store, Profile } from '../services/store';
import { formatNumber, formatPercent, formatRatePercent, formatDate, formatDateTime, getStatusBadge } from '../utils/format';
import { exportReportToExcel, exportReportToCSV } from '../services/exportService';
import { generateAIReportAnalysis } from '../services/aiService';
import { dossierUrgeStore, getSortTimestamp } from '../services/dossierUrgeStore';
import { DossierUrgeRecord } from '../types/dossierUrge';
import {
  calcCompletionRate,
  calcOnTimeRate,
  calcLateRate,
  calcPendingLateRate,
  calcOverdueRateQD776,
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
  TrendingUp,
  TrendingDown,
  Minus,
  Bell,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  ShieldCheck,
  BarChart3,
  RefreshCw,
  FileCheck,
  Zap,
} from 'lucide-react';
import { ReportFieldStatistic } from '../types/database';
import { resolveLinhVuc } from '../utils/fieldResolver';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import { exportElementToPDF } from '../utils/pdfExport';

export const ReportDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<Profile>(store.getCurrentUser());

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

  // Reference Metrics sub-tab selection: 'core' | 'comparison' | 'urges'
  const [metricsSectionTab, setMetricsSectionTab] = useState<'core' | 'comparison' | 'urges'>('core');

  // Selected snapshot for inspection
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [, forceRefresh] = useState(0);
  useEffect(() => {
    if (!id) return;
    const refresh = () => {
      setCurrentUser(store.getCurrentUser());
      forceRefresh((v) => v + 1);
    };
    const unsubscribe = store.subscribe(refresh);
    void Promise.all([
      store.fetchReportById(id),
      store.fetchStatsByReport(id),
    ]).catch((error) => alert(error.message || 'Không thể tải báo cáo từ Supabase.'));
    return unsubscribe;
  }, [id]);


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

  const handleSaveEditingStats = async () => {
    if (!reportState) return;
    try {
      await store.updateReportStatsList(reportState.id, editingStats);
      await store.recalculateAndPersistReportIndicators(reportState.id);
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

  const availableUnitOptions = useMemo(() => {
    const list: string[] = ['Phòng Kinh tế', 'Phòng Văn hóa - Xã hội', 'Văn phòng'];
    const set = new Set<string>(list);

    store.getUnits().forEach((u) => {
      if (u.name && u.name.trim()) set.add(u.name.trim());
    });

    stats.forEach((s) => {
      const uName = s.unit_name_snapshot || s.unit_name;
      if (uName && uName.trim() && uName !== 'Chưa gán đơn vị') {
        set.add(uName.trim());
      }
    });

    return Array.from(set);
  }, [stats]);

  const renderStatCell = (
    val: number | undefined | null,
    colorClass?: string,
    isBold: boolean = false
  ) => {
    if (val === undefined || val === null || val === 0) {
      return <span className="text-slate-400 font-sans font-normal">-</span>;
    }
    return (
      <span className={`${isBold ? 'font-bold' : 'font-medium'} ${colorClass || 'text-slate-800'}`}>
        {formatNumber(val)}
      </span>
    );
  };

  const handleStatFieldChange = (statId: string, field: string, value: string) => {
    setEditingStats((prev) =>
      prev.map((s) => {
        if (s.id !== statId) return s;

        const isStringField = field === 'notes' || field === 'unit_name_snapshot' || field === 'unit_name' || field === 'unit_id';
        const updated: any = {
          ...s,
          [field]: isStringField ? value : (Number(value) || 0),
        };

        if (field === 'unit_name_snapshot') {
          updated.unit_name = value;
          const matchedUnit = store.getUnits().find((u) => u.name === value || u.id === value);
          if (matchedUnit) {
            updated.unit_id = matchedUnit.id;
          }
        }

        // Recalculate totals according to strict formulas
        updated.received_total = (Number(updated.received_online) || 0) + (Number(updated.received_offline) || 0) + (Number(updated.carried_forward) || 0);
        updated.completed_total = (Number(updated.completed_early) || 0) + (Number(updated.completed_on_time) || 0) + (Number(updated.completed_late) || 0);
        updated.pending_total = (Number(updated.pending_on_time) || 0) + (Number(updated.pending_late) || 0);

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

  const [sortKey, setSortKey] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'desc') setSortDirection('asc');
      else {
        setSortKey('');
        setSortDirection('desc');
      }
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
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
      const rawItems = map.get(srcId) || [];
      const srcObj = sources.find((s) => s.id === srcId);
      const sourceName = srcObj?.source_name || (srcId.toLowerCase().includes('bo') ? 'Hệ thống các Bộ' : 'Hệ thống thành phố');

      const items = [...rawItems].sort((a, b) => {
        if (!sortKey) return 0;
        let valA: any = 0;
        let valB: any = 0;
        switch (sortKey) {
          case 'field':
            valA = (a.field_name_snapshot || a.field_name || '').toLowerCase();
            valB = (b.field_name_snapshot || b.field_name || '').toLowerCase();
            break;
          case 'unit':
            valA = (a.unit_name_snapshot || a.unit_name || '').toLowerCase();
            valB = (b.unit_name_snapshot || b.unit_name || '').toLowerCase();
            break;
          case 'rec_total': valA = a.received_total; valB = b.received_total; break;
          case 'rec_online': valA = a.received_online; valB = b.received_online; break;
          case 'rec_offline': valA = a.received_offline; valB = b.received_offline; break;
          case 'carried': valA = a.carried_forward; valB = b.carried_forward; break;
          case 'comp_total': valA = a.completed_total; valB = b.completed_total; break;
          case 'comp_early': valA = a.completed_early; valB = b.completed_early; break;
          case 'comp_on_time': valA = a.completed_on_time; valB = b.completed_on_time; break;
          case 'comp_late': valA = a.completed_late; valB = b.completed_late; break;
          case 'comp_late_rate':
            valA = a.completed_total > 0 ? a.completed_late / a.completed_total : 0;
            valB = b.completed_total > 0 ? b.completed_late / b.completed_total : 0;
            break;
          case 'pend_total': valA = a.pending_total; valB = b.pending_total; break;
          case 'pend_on_time': valA = a.pending_on_time; valB = b.pending_on_time; break;
          case 'pend_late': valA = a.pending_late; valB = b.pending_late; break;
          case 'pend_late_rate':
            valA = a.pending_total > 0 ? a.pending_late / a.pending_total : 0;
            valB = b.pending_total > 0 ? b.pending_late / b.pending_total : 0;
            break;
          case 'qd776_rate':
          case 'on_time_rate':
            valA = a.received_total > 0 ? (a.completed_late + a.pending_late) / a.received_total : 0;
            valB = b.received_total > 0 ? (b.completed_late + b.pending_late) / b.received_total : 0;
            break;
          default:
            return 0;
        }
        if (typeof valA === 'string') {
          return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      });

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

      const compLateRate = formatRatePercent(compTotal > 0 ? (compLate / compTotal) * 100 : 0);
      const pendLateRate = formatRatePercent(pendTotal > 0 ? (pendLate / pendTotal) * 100 : 0);
      const qd776OverdueRate = formatRatePercent(recTotal > 0 ? ((compLate + pendLate) / recTotal) * 100 : 0);

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
          compLateRate,
          pendTotal,
          pendOnTime,
          pendLate,
          pendLateRate,
          qd776OverdueRate,
          onTimeRate,
        },
      };
    });
  }, [displayedStats, sources, sortKey, sortDirection]);

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
    const pendingLateRate = calcPendingLateRate(pendLate, pendTotal);
    const qd776OverdueRate = calcOverdueRateQD776(compLate, pendLate, recTotal);
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
      pendingLateRate,
      qd776OverdueRate,
      onlineRate,
    };
  }, [displayedStats]);

  // Unit breakdown for AI
  const unitBreakdown = useMemo(() => {
    const map: Record<string, { unitName: string; received: number; online: number; offline: number; completed: number; aheadOfTime: number; onTime: number; late: number; onTimeRate: number; onlineRate: number; pending: number; pendingLate: number }> = {};
    stats.forEach((s) => {
      const uName = s.unit_name_snapshot || s.unit_name || 'Đơn vị';
      if (!map[uName]) {
        map[uName] = { unitName: uName, received: 0, online: 0, offline: 0, completed: 0, aheadOfTime: 0, onTime: 0, late: 0, onTimeRate: 100, onlineRate: 0, pending: 0, pendingLate: 0 };
      }
      map[uName].received += s.received_total || 0;
      map[uName].online += s.received_online || s.online || 0;
      map[uName].offline += s.received_offline || s.in_person || 0;
      map[uName].completed += s.completed_total || s.resolved_total || 0;
      map[uName].aheadOfTime += s.completed_early || s.early || 0;
      map[uName].onTime += s.completed_on_time || s.on_time || 0;
      map[uName].late += s.completed_late || s.late || 0;
      map[uName].pending += s.pending_total || 0;
      map[uName].pendingLate += s.pending_late || s.overdue || 0;
    });

    return Object.values(map).map((u) => ({
      ...u,
      onTimeRate: u.completed > 0 ? Number((((u.completed - u.late) / u.completed) * 100).toFixed(1)) : 100,
      onlineRate: u.received > 0 ? Number(((u.online / u.received) * 100).toFixed(1)) : 0,
    }));
  }, [stats]);

  // Field / Sector breakdown for AI
  const fieldBreakdown = useMemo(() => {
    const map: Record<string, { fieldName: string; received: number; online: number; completed: number; late: number; onTimeRate: number; onlineRate: number }> = {};
    stats.forEach((s) => {
      const fName = s.field_name_snapshot || s.field_name || 'Lĩnh vực';
      if (!map[fName]) {
        map[fName] = { fieldName: fName, received: 0, online: 0, completed: 0, late: 0, onTimeRate: 100, onlineRate: 0 };
      }
      map[fName].received += s.received_total || 0;
      map[fName].online += s.received_online || 0;
      map[fName].completed += s.completed_total || 0;
      map[fName].late += s.completed_late || 0;
    });

    return Object.values(map).map((f) => ({
      ...f,
      onTimeRate: f.completed > 0 ? Number((((f.completed - f.late) / f.completed) * 100).toFixed(1)) : 100,
      onlineRate: f.received > 0 ? Number(((f.online / f.received) * 100).toFixed(1)) : 0,
    }));
  }, [stats]);

  // Previous reports for comparison
  const allReports = useMemo(() => store.getReports(), [id, reportState]);
  const availablePreviousReports = useMemo(() => {
    if (!reportState) return [];
    return allReports
      .filter((r) => r.id !== reportState.id)
      .sort((a, b) => new Date(b.period_start || b.created_at).getTime() - new Date(a.period_start || a.created_at).getTime());
  }, [allReports, reportState]);

  // Auto-detect best previous period report (same type with earlier start date, or latest previous)
  const defaultPrevReportId = useMemo(() => {
    if (!reportState || availablePreviousReports.length === 0) return '';
    const currentStart = new Date(reportState.period_start).getTime();
    const sameTypePrior = availablePreviousReports.find(
      (r) => r.report_type === reportState.report_type && new Date(r.period_start).getTime() < currentStart
    );
    if (sameTypePrior) return sameTypePrior.id;
    const anyPrior = availablePreviousReports.find((r) => new Date(r.period_start).getTime() < currentStart);
    return anyPrior ? anyPrior.id : availablePreviousReports[0].id;
  }, [reportState, availablePreviousReports]);

  const [selectedPrevReportId, setSelectedPrevReportId] = useState<string>('');

  useEffect(() => {
    if (defaultPrevReportId && !selectedPrevReportId) {
      setSelectedPrevReportId(defaultPrevReportId);
    }
  }, [defaultPrevReportId]);

  const previousReport = useMemo(() => {
    return selectedPrevReportId ? store.getReportById(selectedPrevReportId) : undefined;
  }, [selectedPrevReportId]);

  const previousStats = useMemo(() => {
    return selectedPrevReportId ? store.getStatsByReport(selectedPrevReportId) : [];
  }, [selectedPrevReportId]);

  // Previous period aggregated statistics
  const prevTotals = useMemo(() => {
    if (!previousReport || previousStats.length === 0) {
      return null;
    }
    let recTotal = 0, recOnline = 0, recOffline = 0, carried = 0;
    let compTotal = 0, compEarly = 0, compOnTime = 0, compLate = 0;
    let pendTotal = 0, pendOnTime = 0, pendLate = 0;

    previousStats.forEach((s) => {
      recTotal += s.received_total || 0;
      recOnline += s.received_online || 0;
      recOffline += s.received_offline || 0;
      carried += s.carried_forward || 0;
      compTotal += s.completed_total || 0;
      compEarly += s.completed_early || 0;
      compOnTime += s.completed_on_time || 0;
      compLate += s.completed_late || 0;
      pendTotal += s.pending_total || 0;
      pendOnTime += s.pending_on_time || 0;
      pendLate += s.pending_late || 0;
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
  }, [previousReport, previousStats]);

  // Comparison deltas and assessment
  const comparisonData = useMemo(() => {
    if (!prevTotals) return null;

    const deltaRec = totalStats.recTotal - prevTotals.recTotal;
    const deltaRecPct = prevTotals.recTotal > 0 ? (deltaRec / prevTotals.recTotal) * 100 : 0;
    const deltaOnlineRate = Number((totalStats.onlineRate - prevTotals.onlineRate).toFixed(1));
    const deltaOnTimeRate = Number((totalStats.onTimeRate - prevTotals.onTimeRate).toFixed(1));
    const deltaLate = totalStats.compLate - prevTotals.compLate;
    const deltaPending = totalStats.pendTotal - prevTotals.pendTotal;
    const deltaCompletionRate = Number((totalStats.completionRate - prevTotals.completionRate).toFixed(1));

    // Synthesis assessment narrative
    const assessments: string[] = [];
    if (deltaRec > 0) assessments.push(`Khối lượng tiếp nhận tăng +${deltaRec.toLocaleString('vi-VN')} (${deltaRecPct > 0 ? '+' : ''}${deltaRecPct.toFixed(1)}%)`);
    else if (deltaRec < 0) assessments.push(`Khối lượng tiếp nhận giảm ${Math.abs(deltaRec).toLocaleString('vi-VN')} (${deltaRecPct.toFixed(1)}%)`);

    if (deltaOnlineRate > 0) assessments.push(`Tỷ lệ nộp trực tuyến có bước tiến tích cực (+${deltaOnlineRate} điểm %)`);
    else if (deltaOnlineRate < 0) assessments.push(`Tỷ lệ trực tuyến giảm ${Math.abs(deltaOnlineRate)} điểm %`);

    if (deltaOnTimeRate > 0) assessments.push(`Chất lượng đúng hẹn cải thiện (+${deltaOnTimeRate} điểm %)`);
    else if (deltaOnTimeRate < 0) assessments.push(`Tỷ lệ đúng hạn giảm ${Math.abs(deltaOnTimeRate)} điểm %`);

    if (deltaLate < 0) assessments.push(`Số hồ sơ quá hạn giảm ${Math.abs(deltaLate)} hồ sơ (chuyển biến tốt)`);
    else if (deltaLate > 0) assessments.push(`Hồ sơ quá hạn tăng thêm ${deltaLate} hồ sơ (cần đôn đốc)`);

    return {
      deltaRec,
      deltaRecPct,
      deltaOnlineRate,
      deltaOnTimeRate,
      deltaLate,
      deltaPending,
      deltaCompletionRate,
      assessmentSummary: assessments.join('; ') || 'Các chỉ số tiếp tục duy trì ổn định so với kỳ trước.',
    };
  }, [totalStats, prevTotals]);

  // Dossier Urges state & metrics for this reporting period
  const [allUrges, setAllUrges] = useState(dossierUrgeStore.getRecords());
  useEffect(() => {
    const unsub = dossierUrgeStore.subscribe(() => {
      setAllUrges(dossierUrgeStore.getRecords());
    });
    return unsub;
  }, []);

  const urgePeriodStats = useMemo(() => {
    if (!reportState) {
      return {
        totalUrges: 0,
        uniqueUrgedDossiers: 0,
        multipleUrges: 0,
        resolvedUrges: 0,
        inProgressUrges: 0,
        pendingUrges: 0,
        urgeResolutionRate: 100,
        topUnits: [],
        topProcessors: [],
        records: [],
      };
    }

    const pStart = reportState.period_start ? new Date(reportState.period_start + 'T00:00:00').getTime() : 0;
    const pEnd = reportState.period_end ? new Date(reportState.period_end + 'T23:59:59').getTime() : Infinity;

    // Filter records within period window
    let matches = allUrges.filter((r: DossierUrgeRecord) => {
      const t = getSortTimestamp(r);
      return (!pStart || t >= pStart) && (!pEnd || t <= pEnd);
    });

    // If no exact timestamp matches inside date range but records exist in system, include current active records
    if (matches.length === 0 && allUrges.length > 0) {
      matches = allUrges;
    }

    const totalUrges = matches.length;
    const uniqueDossiersSet = new Set(matches.map((u: DossierUrgeRecord) => u.dossier_code));
    const multipleUrgesSet = new Set(matches.filter((u: DossierUrgeRecord) => u.urge_count >= 2).map((u: DossierUrgeRecord) => u.dossier_code));
    const resolvedUrges = matches.filter((u: DossierUrgeRecord) => u.status === 'completed').length;
    const inProgressUrges = matches.filter((u: DossierUrgeRecord) => u.status === 'in_progress').length;
    const pendingUrges = matches.filter((u: DossierUrgeRecord) => u.status === 'pending' || u.status === 'responded').length;
    const urgeResolutionRate = totalUrges > 0 ? (resolvedUrges / totalUrges) * 100 : 100;

    // Units map
    const uMap: Record<string, number> = {};
    matches.forEach((u: DossierUrgeRecord) => {
      if (u.assigned_unit) {
        uMap[u.assigned_unit] = (uMap[u.assigned_unit] || 0) + 1;
      }
    });
    const topUnits = Object.entries(uMap)
      .map(([unitName, count]) => ({ unitName, count }))
      .sort((a, b) => b.count - a.count);

    // Processors map
    const pMap: Record<string, number> = {};
    matches.forEach((u: DossierUrgeRecord) => {
      if (u.processor_name) {
        pMap[u.processor_name] = (pMap[u.processor_name] || 0) + 1;
      }
    });
    const topProcessors = Object.entries(pMap)
      .map(([processorName, count]) => ({ processorName, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalUrges,
      uniqueUrgedDossiers: uniqueDossiersSet.size,
      multipleUrges: multipleUrgesSet.size,
      resolvedUrges,
      inProgressUrges,
      pendingUrges,
      urgeResolutionRate,
      topUnits,
      topProcessors,
      records: matches,
    };
  }, [reportState, allUrges]);

  // Workflow actions
  const handleUpdateStatus = async (newStatus: any) => {
    try {
      const updated = await store.updateReportStatus(reportState.id, newStatus);
      setReportState(updated);
    } catch (err: any) {
      alert(getFriendlyErrorMessage(err, 'Không thể cập nhật trạng thái báo cáo.'));
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

      const currentConfig = store.getSystemConfig();

      const result = await generateAIReportAnalysis({
        reportName: reportState.report_name,
        period: `${formatDate(reportState.period_start)} đến ${formatDate(reportState.period_end)}`,
        promptScope: 'Đánh giá toàn diện kết quả giải quyết TTHC, phân tích so sánh với kỳ trước, đánh giá công tác đôn đốc hồ sơ, phân tích chi tiết đơn vị và lĩnh vực, chỉ rõ điểm nghẽn và đề xuất nhiệm vụ trọng tâm',
        exemplarTemplate: currentConfig.aiAnalysisExemplarTemplate,
        metricsSummary: {
          totals: {
            received: totalStats.recTotal,
            online: totalStats.recOnline,
            offline: totalStats.recOffline,
            carried: totalStats.carried,
            completed: totalStats.compTotal,
            aheadOfTime: totalStats.compEarly,
            onTime: totalStats.compOnTime,
            late: totalStats.compLate,
            pending: totalStats.pendTotal,
            pendingOnTime: totalStats.pendOnTime,
            pendingLate: totalStats.pendLate,
            onTimeRate: totalStats.onTimeRate,
            lateRate: totalStats.lateRate,
            pendingLateRate: totalStats.pendingLateRate,
            qd776OverdueRate: totalStats.qd776OverdueRate,
            onlineRate: totalStats.onlineRate,
            completionRate: totalStats.completionRate,
          },
          previousPeriodSummary: prevTotals && previousReport ? {
            reportId: previousReport.id,
            reportName: previousReport.report_name,
            period: `${formatDate(previousReport.period_start)} - ${formatDate(previousReport.period_end)}`,
            received: prevTotals.recTotal,
            completed: prevTotals.compTotal,
            online: prevTotals.recOnline,
            late: prevTotals.compLate,
            pending: prevTotals.pendTotal,
            onTimeRate: prevTotals.onTimeRate,
            onlineRate: prevTotals.onlineRate,
            completionRate: prevTotals.completionRate,
            deltaReceived: comparisonData?.deltaRec,
            deltaReceivedPercent: comparisonData?.deltaRecPct,
            deltaOnTimeRate: comparisonData?.deltaOnTimeRate,
            deltaOnlineRate: comparisonData?.deltaOnlineRate,
            deltaLate: comparisonData?.deltaLate,
            deltaPending: comparisonData?.deltaPending,
            comparisonAssessment: comparisonData?.assessmentSummary,
          } : undefined,
          urgeSummary: {
            totalUrges: urgePeriodStats.totalUrges,
            uniqueUrgedDossiers: urgePeriodStats.uniqueUrgedDossiers,
            multipleUrges: urgePeriodStats.multipleUrges,
            resolvedUrges: urgePeriodStats.resolvedUrges,
            inProgressUrges: urgePeriodStats.inProgressUrges,
            pendingUrges: urgePeriodStats.pendingUrges,
            urgeResolutionRate: urgePeriodStats.urgeResolutionRate,
            topUrgedUnits: urgePeriodStats.topUnits,
            topUrgedProcessors: urgePeriodStats.topProcessors,
          },
          unitBreakdown,
          fieldBreakdown,
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
  const handleSaveAnalysis = async () => {
    try {
      await store.saveAnalysis({
        report_id: reportState.id,
        section: 'Nhận xét, đánh giá',
        content: analysisContent,
        scope_type: 'overview',
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
              onClick={() => {
                void exportElementToPDF({
                  filename: `BaoCao_ChiTiet_${reportState.report_code}_${new Date().toISOString().split('T')[0]}.pdf`,
                  title: `BÁO CÁO TỔNG HỢP TIẾP NHẬN VÀ GIẢI QUYẾT TTHC - ${reportState.report_name}`,
                  subtitle: `Mã BC: ${reportState.report_code} | Kỳ: ${reportState.period_start} đến ${reportState.period_end}`,
                });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors shadow-2xs cursor-pointer"
              title="Xuất chi tiết báo cáo và bảng số liệu ra file PDF (A4)"
            >
              <Download className="w-3.5 h-3.5 text-rose-600" /> Xuất PDF
            </button>

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
                {store.hasPermission('edit_reports', currentUser) && reportState.status !== 'submitted' && reportState.status !== 'approved' && (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus('submitted')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" /> Trình duyệt
                  </button>
                )}

                {currentUser.role !== 'viewer' && currentUser.role !== 'data_entry' && store.hasPermission('edit_reports', currentUser) && reportState.status !== 'approved' && (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus('approved')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Phê duyệt
                  </button>
                )}

                {store.hasPermission('lock_snapshot', currentUser) && (
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

            {isLocked && store.hasPermission('lock_snapshot', currentUser) && (
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
            <span>Phân tích và Nhận xét AI</span>
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

            {!isLocked && (store.hasPermission('edit_reports', currentUser) || store.hasPermission('import_excel', currentUser)) && (
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
                    {store.hasPermission('edit_reports', currentUser) && (
                      <button
                        type="button"
                        onClick={handleStartEditingStats}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors shadow-xs"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Sửa trực tiếp số liệu</span>
                      </button>
                    )}

                    {store.hasPermission('import_excel', currentUser) && (
                      <Link
                        to="/import"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors shadow-xs"
                      >
                        + Nhập đè Excel mới
                      </Link>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Statistical Grid with Collapsible Source Groups */}
          <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[700px]">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="text-slate-800 font-semibold sticky top-0 z-20 border-b border-slate-300 text-[11px] select-none">
                  {/* TẦNG 1: NHÓM CHÍNH */}
                  <tr className="border-b border-slate-300">
                    <th
                      rowSpan={3}
                      onClick={() => handleSort('index')}
                      className="p-2.5 text-center w-12 bg-slate-100 text-slate-900 border-r border-slate-300 font-bold align-middle cursor-pointer hover:bg-slate-200 transition-colors"
                    >
                      <div className="flex items-center justify-center gap-0.5">
                        <span className="font-bold">STT</span>
                        <span className="text-[10px] text-slate-500 font-normal">
                          {sortKey === 'index' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </div>
                    </th>
                    <th
                      rowSpan={3}
                      onClick={() => handleSort('field')}
                      className="p-2.5 min-w-[200px] bg-slate-100 text-slate-900 border-r border-slate-300 cursor-pointer hover:bg-slate-200 transition-colors text-left align-middle"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold">Lĩnh vực</span>
                        <span className="text-[10px] text-slate-500 font-normal">
                          {sortKey === 'field' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </div>
                    </th>
                    <th
                      rowSpan={3}
                      onClick={() => !isEditingInline && handleSort('unit')}
                      className={`p-2.5 min-w-[150px] ${
                        isEditingInline ? 'bg-amber-50 text-amber-900 border-amber-300' : 'bg-slate-100 text-slate-900 border-slate-300 cursor-pointer hover:bg-slate-200'
                      } border-r transition-colors text-left align-middle`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1">
                          <span className="font-bold">Đơn vị</span>
                          {isEditingInline && (
                            <span className="text-[10px] font-normal text-amber-700 bg-amber-100 px-1 py-0.5 rounded">
                              sửa được
                            </span>
                          )}
                        </div>
                        {!isEditingInline && (
                          <span className="text-[10px] text-slate-500 font-normal">
                            {sortKey === 'unit' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                          </span>
                        )}
                      </div>
                    </th>
                    {/* Nhóm 1: TIẾP NHẬN */}
                    <th
                      colSpan={4}
                      className="py-1.5 px-3 text-center bg-[#D1E7DD] text-[#0F5132] font-bold uppercase tracking-wide border-r border-b border-[#BADBCC]"
                    >
                      SỐ HỒ SƠ TIẾP NHẬN
                    </th>
                    {/* Nhóm 2: ĐÃ GIẢI QUYẾT */}
                    <th
                      colSpan={5}
                      className="py-1.5 px-3 text-center bg-[#FFF3CD] text-[#664D03] font-bold uppercase tracking-wide border-r border-b border-[#FFECB5]"
                    >
                      SỐ LƯỢNG HỒ SƠ ĐÃ GIẢI QUYẾT
                    </th>
                    {/* Nhóm 3: ĐANG GIẢI QUYẾT */}
                    <th
                      colSpan={4}
                      className="py-1.5 px-3 text-center bg-[#CFE2FF] text-[#084298] font-bold uppercase tracking-wide border-r border-b border-[#B6D4FE]"
                    >
                      SỐ LƯỢNG HỒ SƠ ĐANG GIẢI QUYẾT
                    </th>
                    {/* Cột % Quá hạn (theo QĐ 776) */}
                    <th
                      rowSpan={3}
                      onClick={() => handleSort('qd776_rate')}
                      className="p-2.5 text-right min-w-[100px] bg-slate-100 text-slate-800 border-r border-slate-300 cursor-pointer hover:bg-slate-200 transition-colors align-middle"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span className="font-bold">% Quá hạn (theo QĐ 776)</span>
                        <span className="text-[10px] text-slate-500 font-normal">
                          {sortKey === 'qd776_rate' || sortKey === 'on_time_rate' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </div>
                    </th>
                  </tr>

                  {/* TẦNG 2: PHÂN LOẠI CHI TIẾT */}
                  <tr className="border-b border-slate-300">
                    {/* Dưới TIẾP NHẬN */}
                    <th
                      rowSpan={2}
                      onClick={() => handleSort('rec_total')}
                      className="p-2 text-right bg-[#E8F4EC] text-[#0F5132] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#D1E7DD] transition-colors align-middle"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Tổng số</span>
                        <span className="text-[10px] text-[#0F5132]/60 font-normal">
                          {sortKey === 'rec_total' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </div>
                    </th>
                    <th
                      colSpan={2}
                      className="py-1 px-2 text-center bg-[#E8F4EC] text-[#0F5132] font-bold border-r border-b border-[#BADBCC]"
                    >
                      Trong kỳ
                    </th>
                    <th
                      rowSpan={2}
                      onClick={() => handleSort('carried')}
                      className="p-2 text-right bg-[#E8F4EC] text-[#0F5132] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#D1E7DD] transition-colors align-middle"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Từ kỳ trước</span>
                        <span className="text-[10px] text-[#0F5132]/60 font-normal">
                          {sortKey === 'carried' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </div>
                    </th>

                    {/* Dưới ĐÃ GIẢI QUYẾT */}
                    <th
                      rowSpan={2}
                      onClick={() => handleSort('comp_total')}
                      className="p-2 text-right bg-[#FFF9E6] text-[#664D03] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#FFF3CD] transition-colors align-middle"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Tổng số</span>
                        <span className="text-[10px] text-[#664D03]/60 font-normal">
                          {sortKey === 'comp_total' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </div>
                    </th>
                    <th
                      rowSpan={2}
                      onClick={() => handleSort('comp_early')}
                      className="p-2 text-right bg-[#FFF9E6] text-[#664D03] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#FFF3CD] transition-colors align-middle"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Trước hạn</span>
                        <span className="text-[10px] text-[#664D03]/60 font-normal">
                          {sortKey === 'comp_early' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </div>
                    </th>
                    <th
                      rowSpan={2}
                      onClick={() => handleSort('comp_on_time')}
                      className="p-2 text-right bg-[#FFF9E6] text-[#664D03] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#FFF3CD] transition-colors align-middle"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Đúng hạn</span>
                        <span className="text-[10px] text-[#664D03]/60 font-normal">
                          {sortKey === 'comp_on_time' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </div>
                    </th>
                    <th
                      rowSpan={2}
                      onClick={() => handleSort('comp_late')}
                      className="p-2 text-right bg-[#FFF9E6] text-[#664D03] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#FFF3CD] transition-colors align-middle"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Quá hạn</span>
                        <span className="text-[10px] text-[#664D03]/60 font-normal">
                          {sortKey === 'comp_late' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </div>
                    </th>
                    <th
                      rowSpan={2}
                      onClick={() => handleSort('comp_late_rate')}
                      className="p-2 text-right bg-[#FFF9E6] text-[#664D03] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#FFF3CD] transition-colors align-middle"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>% Quá hạn</span>
                        <span className="text-[10px] text-[#664D03]/60 font-normal">
                          {sortKey === 'comp_late_rate' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </div>
                    </th>

                    {/* Dưới ĐANG GIẢI QUYẾT */}
                    <th
                      rowSpan={2}
                      onClick={() => handleSort('pend_total')}
                      className="p-2 text-right bg-[#E7F1FF] text-[#084298] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#CFE2FF] transition-colors align-middle"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Tổng số</span>
                        <span className="text-[10px] text-[#084298]/60 font-normal">
                          {sortKey === 'pend_total' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </div>
                    </th>
                    <th
                      rowSpan={2}
                      onClick={() => handleSort('pend_on_time')}
                      className="p-2 text-right bg-[#E7F1FF] text-[#084298] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#CFE2FF] transition-colors align-middle"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Trong hạn</span>
                        <span className="text-[10px] text-[#084298]/60 font-normal">
                          {sortKey === 'pend_on_time' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </div>
                    </th>
                    <th
                      rowSpan={2}
                      onClick={() => handleSort('pend_late')}
                      className="p-2 text-right bg-[#E7F1FF] text-[#084298] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#CFE2FF] transition-colors align-middle"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Quá hạn</span>
                        <span className="text-[10px] text-[#084298]/60 font-normal">
                          {sortKey === 'pend_late' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </div>
                    </th>
                    <th
                      rowSpan={2}
                      onClick={() => handleSort('pend_late_rate')}
                      className="p-2 text-right bg-[#E7F1FF] text-[#084298] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#CFE2FF] transition-colors align-middle"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>% Quá hạn</span>
                        <span className="text-[10px] text-[#084298]/60 font-normal">
                          {sortKey === 'pend_late_rate' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </div>
                    </th>
                  </tr>

                  {/* TẦNG 3: TRONG KỲ (TRỰC TUYẾN & TRỰC TIẾP / BƯU CHÍNH) */}
                  <tr className="border-b border-slate-300">
                    <th
                      onClick={() => handleSort('rec_online')}
                      className="p-1.5 text-right bg-[#F1F9F4] text-[#0F5132] font-semibold border-r border-slate-300 cursor-pointer hover:bg-[#D1E7DD] transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Trực tuyến</span>
                        <span className="text-[10px] text-[#0F5132]/60 font-normal">
                          {sortKey === 'rec_online' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('rec_offline')}
                      className="p-1.5 text-right bg-[#F1F9F4] text-[#0F5132] font-semibold border-r border-slate-300 cursor-pointer hover:bg-[#D1E7DD] transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Trực tiếp / BC</span>
                        <span className="text-[10px] text-[#0F5132]/60 font-normal">
                          {sortKey === 'rec_offline' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-xs">
                  {/* DÒNG TỔNG CỘNG BÊN DƯỚI TIÊU ĐỀ BẢNG (GRAND TOTALS ROW) */}
                  {displayedStats.length > 0 && (
                    <tr className="bg-amber-100/90 hover:bg-amber-100 font-bold text-slate-900 border-b-2 border-amber-300 text-xs shadow-2xs">
                      <td className="p-2 text-center bg-amber-200/70 border-r border-amber-300 font-black text-slate-800">
                        —
                      </td>
                      <td colSpan={2} className="p-2 bg-amber-200/70 border-r border-amber-300 font-black text-amber-950 uppercase tracking-wider font-sans">
                        <div className="flex items-center justify-between">
                          <span>TỔNG CỘNG</span>
                          <span className="text-[10px] font-semibold text-amber-900 normal-case bg-amber-300/70 px-2 py-0.5 rounded">
                            {displayedStats.length} lĩnh vực
                          </span>
                        </div>
                      </td>
                      <td className="p-2 text-right font-black border-r border-amber-300 text-slate-950">
                        {renderStatCell(totalStats.recTotal, 'text-slate-950', true)}
                      </td>
                      <td className="p-2 text-right font-black border-r border-amber-300 text-emerald-800">
                        {renderStatCell(totalStats.recOnline, 'text-emerald-800', true)}
                      </td>
                      <td className="p-2 text-right font-black border-r border-amber-300 text-emerald-800">
                        {renderStatCell(totalStats.recOffline, 'text-emerald-800', true)}
                      </td>
                      <td className="p-2 text-right font-black border-r border-amber-300 text-slate-800">
                        {renderStatCell(totalStats.carried, 'text-slate-800', true)}
                      </td>
                      <td className="p-2 text-right font-black border-r border-amber-300 text-amber-950">
                        {renderStatCell(totalStats.compTotal, 'text-amber-950', true)}
                      </td>
                      <td className="p-2 text-right font-black border-r border-amber-300 text-amber-950">
                        {renderStatCell(totalStats.compEarly, 'text-amber-950', true)}
                      </td>
                      <td className="p-2 text-right font-black border-r border-amber-300 text-amber-950">
                        {renderStatCell(totalStats.compOnTime, 'text-amber-950', true)}
                      </td>
                      <td className="p-2 text-right font-black border-r border-amber-300">
                        {totalStats.compLate > 0 ? (
                          <span className="text-rose-700 font-black">{formatNumber(totalStats.compLate)}</span>
                        ) : (
                          <span className="text-slate-500 font-sans font-normal">-</span>
                        )}
                      </td>
                      <td className="p-2 text-right font-normal border-r border-amber-300 font-sans">
                        <span className={totalStats.compLate > 0 ? 'text-rose-700 font-normal' : 'text-slate-500 font-normal'}>
                          {formatRatePercent(totalStats.lateRate)}
                        </span>
                      </td>
                      <td className="p-2 text-right font-black border-r border-amber-300 text-blue-950">
                        {renderStatCell(totalStats.pendTotal, 'text-blue-950', true)}
                      </td>
                      <td className="p-2 text-right font-black border-r border-amber-300 text-blue-950">
                        {renderStatCell(totalStats.pendOnTime, 'text-blue-950', true)}
                      </td>
                      <td className="p-2 text-right font-black border-r border-amber-300">
                        {totalStats.pendLate > 0 ? (
                          <span className="text-rose-700 font-black">{formatNumber(totalStats.pendLate)}</span>
                        ) : (
                          <span className="text-slate-500 font-sans font-normal">-</span>
                        )}
                      </td>
                      <td className="p-2 text-right font-normal border-r border-amber-300 font-sans">
                        <span className={totalStats.pendLate > 0 ? 'text-rose-700 font-normal' : 'text-slate-500 font-normal'}>
                          {formatRatePercent(totalStats.pendingLateRate)}
                        </span>
                      </td>
                      <td className="p-2 text-right font-normal border-r border-amber-300 font-sans">
                        <span className={(totalStats.compLate + totalStats.pendLate) > 0 ? 'text-rose-800 font-normal' : 'text-slate-800 font-normal'}>
                          {formatRatePercent(totalStats.qd776OverdueRate)}
                        </span>
                      </td>
                    </tr>
                  )}

                  {groupedStats.length === 0 ? (
                    <tr>
                      <td colSpan={17} className="py-12 text-center text-slate-500 font-sans">
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
                            className="bg-slate-100/90 text-slate-800 cursor-pointer hover:bg-slate-200/90 select-none transition-colors border-y border-slate-300 sticky z-10 shadow-2xs"
                            style={{ top: '64px' }}
                          >
                            <td colSpan={17} className="py-2 px-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="p-1 rounded bg-white text-blue-700 border border-slate-300 shadow-2xs">
                                    {isCollapsed ? (
                                      <ChevronRight className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    )}
                                  </span>
                                  <Layers className="w-4 h-4 text-blue-600 shrink-0" />
                                  <span className="font-sans font-bold tracking-wide text-xs uppercase text-slate-800">
                                    {romanNum}. {group.sourceName}
                                  </span>
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-sans font-medium">
                                    {group.items.length} lĩnh vực
                                  </span>
                                </div>

                                <div className="flex items-center gap-2.5 text-[11px] font-sans text-slate-600">
                                  <span>
                                    Tiếp nhận: <strong className="text-emerald-800 font-bold font-mono">{formatNumber(group.subtotal.recTotal)}</strong>
                                  </span>
                                  <span className="text-slate-300">|</span>
                                  <span>
                                    Đã GQ: <strong className="text-amber-800 font-bold font-mono">{formatNumber(group.subtotal.compTotal)}</strong>
                                  </span>
                                  <span className="text-slate-300">|</span>
                                  <span>
                                    Đang GQ: <strong className="text-blue-800 font-bold font-mono">{formatNumber(group.subtotal.pendTotal)}</strong>
                                  </span>
                                  <span className="text-slate-300">|</span>
                                  <span>
                                    % Quá hạn (QĐ 776): <strong className={group.subtotal.qd776OverdueRate !== '-' ? 'text-rose-800 font-bold font-mono' : 'text-emerald-800 font-bold font-mono'}>{group.subtotal.qd776OverdueRate}</strong>
                                  </span>
                                  <span className="text-[10px] text-slate-400 italic ml-1">
                                    {isCollapsed ? '(Nhấn để mở rộng ▼)' : '(Nhấn để thu gọn ▲)'}
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>

                          {/* STATISTICAL ROWS FOR THIS GROUP */}
                          {!isCollapsed &&
                            group.items.map((s, idx) => {
                              const allFields = store.getFields();
                              const resolvedSector = resolveLinhVuc(
                                s.field_name_snapshot || s.field_name || '',
                                s.field_id,
                                allFields
                              );
                              const rawSnap = (s.field_name_snapshot || s.field_name || '').trim();
                              const isLongProcedure =
                                rawSnap.length > 50 ||
                                rawSnap.includes('di sản') ||
                                rawSnap.includes('giám sát') ||
                                rawSnap.includes('hỏa táng') ||
                                rawSnap.includes('quyền sử dụng đất');
                              const displayName =
                                !isLongProcedure && rawSnap
                                  ? rawSnap
                                  : resolvedSector !== 'Chưa phân loại'
                                  ? resolvedSector
                                  : rawSnap || 'Lĩnh vực TTHC';

                              const compLatePct = formatRatePercent(s.completed_total > 0 ? (s.completed_late / s.completed_total) * 100 : 0);
                              const pendLatePct = formatRatePercent(s.pending_total > 0 ? (s.pending_late / s.pending_total) * 100 : 0);
                              const qd776Pct = formatRatePercent(s.received_total > 0 ? (((s.completed_late || 0) + (s.pending_late || 0)) / s.received_total) * 100 : 0);

                              const hasWarn =
                                s.validation_status === 'warning' ||
                                s.validation_status === 'error' ||
                                (s.validation_errors && s.validation_errors.length > 0);

                              return (
                                <tr
                                  key={s.id}
                                  className={`hover:brightness-95 transition-colors border-b border-slate-200 ${
                                    hasWarn ? 'bg-amber-50/40' : 'bg-white'
                                  }`}
                                >
                                  {/* 1. STT */}
                                  <td className="p-2 text-center text-slate-500 font-sans border-r border-slate-200 font-medium">
                                    {idx + 1}
                                  </td>

                                  {/* 2. Lĩnh vực */}
                                  <td className="p-2 font-sans font-semibold text-slate-900 border-r border-slate-200">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-slate-900 text-xs font-semibold">{displayName}</span>
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

                                  {/* 3. Đơn vị */}
                                  <td className="p-2 font-sans border-r border-slate-200">
                                    {isEditingInline ? (
                                      <select
                                        className="w-full text-xs bg-white border border-blue-400 focus:border-blue-600 rounded px-1.5 py-1 font-sans font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs"
                                        value={s.unit_name_snapshot || s.unit_name || 'Chưa gán đơn vị'}
                                        onChange={(e) => handleStatFieldChange(s.id, 'unit_name_snapshot', e.target.value)}
                                      >
                                        <option value="Chưa gán đơn vị">-- Chọn đơn vị --</option>
                                        {availableUnitOptions.map((unitName) => (
                                          <option key={unitName} value={unitName}>
                                            {unitName}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-sans">
                                        {s.unit_name_snapshot || s.unit_name || 'Chưa gán đơn vị'}
                                      </span>
                                    )}
                                  </td>

                                  {/* 4. TN: Tổng số */}
                                  <td className="p-2 text-right border-r border-slate-200 bg-[#EAF5EE]/80">
                                    {renderStatCell(s.received_total, 'text-slate-900', true)}
                                  </td>

                                  {/* 5. TN: Trực tuyến */}
                                  <td className="p-2 text-right border-r border-slate-200 bg-[#F1F8F4]/80">
                                    {isEditingInline ? (
                                      <input
                                        type="number"
                                        min={0}
                                        className="w-14 bg-white border border-slate-200 focus:border-blue-500 rounded px-1 py-0.5 text-right font-mono text-xs focus:ring-1 focus:ring-blue-500"
                                        value={s.received_online}
                                        onChange={(e) => handleStatFieldChange(s.id, 'received_online', e.target.value)}
                                      />
                                    ) : (
                                      renderStatCell(s.received_online, 'text-emerald-700')
                                    )}
                                  </td>

                                  {/* 6. TN: Trực tiếp / Bưu chính */}
                                  <td className="p-2 text-right border-r border-slate-200 bg-[#F1F8F4]/80">
                                    {isEditingInline ? (
                                      <input
                                        type="number"
                                        min={0}
                                        className="w-14 bg-white border border-slate-200 focus:border-blue-500 rounded px-1 py-0.5 text-right font-mono text-xs focus:ring-1 focus:ring-blue-500"
                                        value={s.received_offline}
                                        onChange={(e) => handleStatFieldChange(s.id, 'received_offline', e.target.value)}
                                      />
                                    ) : (
                                      renderStatCell(s.received_offline, 'text-emerald-700')
                                    )}
                                  </td>

                                  {/* 7. TN: Từ kỳ trước */}
                                  <td className="p-2 text-right border-r border-slate-200 bg-[#EAF5EE]/80">
                                    {isEditingInline ? (
                                      <input
                                        type="number"
                                        min={0}
                                        className="w-14 bg-white border border-slate-200 focus:border-blue-500 rounded px-1 py-0.5 text-right font-mono text-xs focus:ring-1 focus:ring-blue-500"
                                        value={s.carried_forward}
                                        onChange={(e) => handleStatFieldChange(s.id, 'carried_forward', e.target.value)}
                                      />
                                    ) : (
                                      renderStatCell(s.carried_forward, 'text-slate-600')
                                    )}
                                  </td>

                                  {/* 8. GQ: Tổng số */}
                                  <td className="p-2 text-right border-r border-slate-200 bg-[#FEF6DC]/80">
                                    {renderStatCell(s.completed_total, 'text-amber-900', true)}
                                  </td>

                                  {/* 9. GQ: Trước hạn */}
                                  <td className="p-2 text-right border-r border-slate-200 bg-[#FFFBF0]/80">
                                    {isEditingInline ? (
                                      <input
                                        type="number"
                                        min={0}
                                        className="w-14 bg-white border border-slate-200 focus:border-blue-500 rounded px-1 py-0.5 text-right font-mono text-xs focus:ring-1 focus:ring-blue-500"
                                        value={s.completed_early}
                                        onChange={(e) => handleStatFieldChange(s.id, 'completed_early', e.target.value)}
                                      />
                                    ) : (
                                      renderStatCell(s.completed_early, 'text-slate-700')
                                    )}
                                  </td>

                                  {/* 10. GQ: Đúng hạn */}
                                  <td className="p-2 text-right border-r border-slate-200 bg-[#FFFBF0]/80">
                                    {isEditingInline ? (
                                      <input
                                        type="number"
                                        min={0}
                                        className="w-14 bg-white border border-slate-200 focus:border-blue-500 rounded px-1 py-0.5 text-right font-mono text-xs focus:ring-1 focus:ring-blue-500"
                                        value={s.completed_on_time}
                                        onChange={(e) => handleStatFieldChange(s.id, 'completed_on_time', e.target.value)}
                                      />
                                    ) : (
                                      renderStatCell(s.completed_on_time, 'text-slate-700')
                                    )}
                                  </td>

                                  {/* 11. GQ: Quá hạn */}
                                  <td className="p-2 text-right border-r border-slate-200 bg-[#FFFBF0]/80">
                                    {isEditingInline ? (
                                      <input
                                        type="number"
                                        min={0}
                                        className="w-14 bg-white border border-slate-200 focus:border-blue-500 rounded px-1 py-0.5 text-right font-mono text-xs focus:ring-1 focus:ring-blue-500"
                                        value={s.completed_late}
                                        onChange={(e) => handleStatFieldChange(s.id, 'completed_late', e.target.value)}
                                      />
                                    ) : s.completed_late > 0 ? (
                                      <span className="text-rose-600 font-bold">{formatNumber(s.completed_late)}</span>
                                    ) : (
                                      <span className="text-slate-400 font-sans font-normal">-</span>
                                    )}
                                  </td>

                                  {/* 12. GQ: % Quá hạn */}
                                  <td className="p-2 text-right border-r border-slate-200 bg-[#FEF6DC]/60 font-sans font-normal">
                                    <span className={s.completed_late > 0 ? 'text-rose-700 font-normal' : 'text-slate-600 font-normal'}>
                                      {compLatePct}
                                    </span>
                                  </td>

                                  {/* 13. ĐANG GQ: Tổng số */}
                                  <td className="p-2 text-right border-r border-slate-200 bg-[#E7F1FF]/80">
                                    {renderStatCell(s.pending_total, 'text-blue-900', true)}
                                  </td>

                                  {/* 14. ĐANG GQ: Trong hạn */}
                                  <td className="p-2 text-right border-r border-slate-200 bg-[#F2F7FF]/80">
                                    {isEditingInline ? (
                                      <input
                                        type="number"
                                        min={0}
                                        className="w-14 bg-white border border-slate-200 focus:border-blue-500 rounded px-1 py-0.5 text-right font-mono text-xs focus:ring-1 focus:ring-blue-500"
                                        value={s.pending_on_time}
                                        onChange={(e) => handleStatFieldChange(s.id, 'pending_on_time', e.target.value)}
                                      />
                                    ) : (
                                      renderStatCell(s.pending_on_time, 'text-slate-700')
                                    )}
                                  </td>

                                  {/* 15. ĐANG GQ: Quá hạn */}
                                  <td className="p-2 text-right border-r border-slate-200 bg-[#F2F7FF]/80">
                                    {isEditingInline ? (
                                      <input
                                        type="number"
                                        min={0}
                                        className="w-14 bg-white border border-slate-200 focus:border-blue-500 rounded px-1 py-0.5 text-right font-mono text-xs focus:ring-1 focus:ring-blue-500"
                                        value={s.pending_late}
                                        onChange={(e) => handleStatFieldChange(s.id, 'pending_late', e.target.value)}
                                      />
                                    ) : s.pending_late > 0 ? (
                                      <span className="text-rose-600 font-bold">{formatNumber(s.pending_late)}</span>
                                    ) : (
                                      <span className="text-slate-400 font-sans font-normal">-</span>
                                    )}
                                  </td>

                                  {/* 16. ĐANG GQ: % Quá hạn */}
                                  <td className="p-2 text-right border-r border-slate-200 bg-[#E7F1FF]/60 font-sans font-normal">
                                    <span className={s.pending_late > 0 ? 'text-rose-700 font-normal' : 'text-slate-600 font-normal'}>
                                      {pendLatePct}
                                    </span>
                                  </td>

                                  {/* 17. % Quá hạn (theo QĐ 776) */}
                                  <td className="p-2 text-right text-slate-800 font-sans border-r border-slate-200 font-normal bg-slate-50/50">
                                    <span className={(s.completed_late + s.pending_late) > 0 ? 'text-rose-800 font-normal' : 'text-slate-800 font-normal'}>
                                      {qd776Pct}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}

                          {/* GROUP SUBTOTAL ROW */}
                          {!isCollapsed && (
                            <tr className="bg-slate-100 font-mono font-bold text-slate-800 border-b-2 border-slate-300">
                              <td className="p-2 text-center text-slate-500 font-sans border-r border-slate-300">∑</td>
                              <td colSpan={2} className="p-2 font-sans font-bold text-slate-800 text-xs border-r border-slate-300">
                                Cộng nhóm: {group.sourceName} ({group.items.length} lĩnh vực)
                              </td>
                              <td className="p-2 text-right text-slate-900 border-r border-slate-300 bg-[#EAF5EE]">
                                {renderStatCell(group.subtotal.recTotal, 'text-slate-900', true)}
                              </td>
                              <td className="p-2 text-right text-emerald-700 border-r border-slate-300 bg-[#F1F8F4]">
                                {renderStatCell(group.subtotal.recOnline, 'text-emerald-700', true)}
                              </td>
                              <td className="p-2 text-right text-emerald-700 border-r border-slate-300 bg-[#F1F8F4]">
                                {renderStatCell(group.subtotal.recOffline, 'text-emerald-700', true)}
                              </td>
                              <td className="p-2 text-right text-slate-700 border-r border-slate-300 bg-[#EAF5EE]">
                                {renderStatCell(group.subtotal.carried, 'text-slate-700')}
                              </td>
                              <td className="p-2 text-right text-amber-900 border-r border-slate-300 bg-[#FEF6DC]">
                                {renderStatCell(group.subtotal.compTotal, 'text-amber-900', true)}
                              </td>
                              <td className="p-2 text-right text-slate-800 border-r border-slate-300 bg-[#FFFBF0]">
                                {renderStatCell(group.subtotal.compEarly, 'text-slate-800')}
                              </td>
                              <td className="p-2 text-right text-slate-800 border-r border-slate-300 bg-[#FFFBF0]">
                                {renderStatCell(group.subtotal.compOnTime, 'text-slate-800')}
                              </td>
                              <td className="p-2 text-right border-r border-slate-300 bg-[#FFFBF0]">
                                {group.subtotal.compLate > 0 ? (
                                  <span className="text-rose-700 font-bold">{formatNumber(group.subtotal.compLate)}</span>
                                ) : (
                                  <span className="text-slate-500 font-sans font-normal">-</span>
                                )}
                              </td>
                              <td className="p-2 text-right font-sans font-normal border-r border-slate-300 bg-[#FEF6DC]">
                                <span className={group.subtotal.compLate > 0 ? 'text-rose-700 font-normal' : 'text-slate-600 font-normal'}>
                                  {group.subtotal.compLateRate}
                                </span>
                              </td>
                              <td className="p-2 text-right text-blue-900 border-r border-slate-300 bg-[#E7F1FF]">
                                {renderStatCell(group.subtotal.pendTotal, 'text-blue-900', true)}
                              </td>
                              <td className="p-2 text-right text-slate-800 border-r border-slate-300 bg-[#F2F7FF]">
                                {renderStatCell(group.subtotal.pendOnTime, 'text-slate-800')}
                              </td>
                              <td className="p-2 text-right border-r border-slate-300 bg-[#F2F7FF]">
                                {group.subtotal.pendLate > 0 ? (
                                  <span className="text-rose-700 font-bold">{formatNumber(group.subtotal.pendLate)}</span>
                                ) : (
                                  <span className="text-slate-500 font-sans font-normal">-</span>
                                )}
                              </td>
                              <td className="p-2 text-right font-sans font-normal border-r border-slate-300 bg-[#E7F1FF]">
                                <span className={group.subtotal.pendLate > 0 ? 'text-rose-700 font-normal' : 'text-slate-600 font-normal'}>
                                  {group.subtotal.pendLateRate}
                                </span>
                              </td>
                              <td className="p-2 text-right font-sans font-normal border-r border-slate-300 bg-slate-100">
                                <span className={group.subtotal.qd776OverdueRate !== '-' ? 'text-rose-800 font-normal' : 'text-slate-800 font-normal'}>
                                  {group.subtotal.qd776OverdueRate}
                                </span>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
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
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  <span>Dữ liệu Metrics tham chiếu</span>
                </h3>
                <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-semibold border border-blue-200">
                  Database Source
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                AI chỉ diễn giải dựa trên các con số đã được tính toán dưới đây, không tự phát sinh số:
              </p>
            </div>

            {/* Segmented Sub-navigation */}
            <div className="flex p-1 bg-slate-100 rounded-lg text-xs font-medium border border-slate-200">
              <button
                type="button"
                onClick={() => setMetricsSectionTab('core')}
                className={`flex-1 py-1 px-2 rounded-md transition-all text-center flex items-center justify-center gap-1 text-[11px] ${
                  metricsSectionTab === 'core'
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Chỉ tiêu kỳ này</span>
              </button>
              <button
                type="button"
                onClick={() => setMetricsSectionTab('comparison')}
                className={`flex-1 py-1 px-2 rounded-md transition-all text-center flex items-center justify-center gap-1 text-[11px] ${
                  metricsSectionTab === 'comparison'
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>So với kỳ trước</span>
                {comparisonData && (
                  <span className={`w-1.5 h-1.5 rounded-full ${comparisonData.deltaOnTimeRate >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                )}
              </button>
              <button
                type="button"
                onClick={() => setMetricsSectionTab('urges')}
                className={`flex-1 py-1 px-2 rounded-md transition-all text-center flex items-center justify-center gap-1 text-[11px] ${
                  metricsSectionTab === 'urges'
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Đôn đốc hồ sơ</span>
                {urgePeriodStats.totalUrges > 0 && (
                  <span className="px-1.5 py-0.2 text-[9px] bg-red-100 text-red-700 font-bold rounded-full">
                    {urgePeriodStats.totalUrges}
                  </span>
                )}
              </button>
            </div>

            {/* SECTION 1: CORE REPORT METRICS */}
            {metricsSectionTab === 'core' && (
              <div className="space-y-3">
                <div className="space-y-2 text-xs divide-y divide-slate-100">
                  <div className="flex justify-between items-center pt-1.5">
                    <span className="text-slate-600 font-medium">Tổng tiếp nhận:</span>
                    <span className="font-bold text-slate-900">{formatNumber(totalStats.recTotal)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1.5 pl-2 text-[11px] text-slate-500">
                    <span>- Trực tuyến:</span>
                    <span className="font-semibold text-blue-600">{formatNumber(totalStats.recOnline)} ({formatPercent(totalStats.onlineRate)})</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 pl-2 text-[11px] text-slate-500">
                    <span>- Trực tiếp & bưu chính:</span>
                    <span className="font-medium text-slate-700">{formatNumber(totalStats.recOffline)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 pl-2 text-[11px] text-slate-500">
                    <span>- Từ kỳ trước chuyển qua:</span>
                    <span className="font-medium text-slate-700">{formatNumber(totalStats.carried)}</span>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-slate-600 font-medium">Tổng đã giải quyết:</span>
                    <span className="font-bold text-emerald-600">{formatNumber(totalStats.compTotal)} ({formatPercent(totalStats.completionRate)})</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 pl-2 text-[11px] text-slate-500">
                    <span>- Trước hạn:</span>
                    <span className="font-semibold text-emerald-700">{formatNumber(totalStats.compEarly)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 pl-2 text-[11px] text-slate-500">
                    <span>- Đúng hạn:</span>
                    <span className="font-medium text-slate-700">{formatNumber(totalStats.compOnTime)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 pl-2 text-[11px] text-slate-500">
                    <span>- Quá hạn:</span>
                    <span className={`font-semibold ${totalStats.compLate > 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                      {formatNumber(totalStats.compLate)} ({formatPercent(totalStats.lateRate)})
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-slate-600 font-medium">Tỷ lệ đúng và trước hạn:</span>
                    <span className="font-bold text-emerald-700">{formatPercent(totalStats.onTimeRate)}</span>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-slate-600 font-medium">Tỷ lệ quá hạn (QĐ 776):</span>
                    <span className={`font-semibold ${totalStats.qd776OverdueRate > 0 ? 'text-rose-700' : 'text-slate-700'}`}>
                      {formatPercent(totalStats.qd776OverdueRate)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-slate-600 font-medium">Hồ sơ đang xử lý:</span>
                    <span className="font-bold text-amber-600">{formatNumber(totalStats.pendTotal)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 pl-2 text-[11px] text-slate-500">
                    <span>- Trong hạn:</span>
                    <span className="font-medium text-slate-700">{formatNumber(totalStats.pendOnTime)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 pl-2 text-[11px] text-slate-500">
                    <span>- Quá hạn dở dang:</span>
                    <span className={`font-semibold ${totalStats.pendLate > 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                      {formatNumber(totalStats.pendLate)} ({formatPercent(totalStats.pendingLateRate)})
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 2: COMPARISON WITH PREVIOUS PERIOD */}
            {metricsSectionTab === 'comparison' && (
              <div className="space-y-3">
                {/* Selector for comparison report */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Chọn kỳ báo cáo so sánh:
                  </label>
                  {availablePreviousReports.length > 0 ? (
                    <select
                      value={selectedPrevReportId}
                      onChange={(e) => setSelectedPrevReportId(e.target.value)}
                      className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {availablePreviousReports.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.report_code}: {r.report_name} ({formatDate(r.period_start)} - {formatDate(r.period_end)})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-xs text-slate-400 italic p-2 bg-slate-50 rounded border border-slate-100">
                      Chưa có kỳ báo cáo nào khác trong hệ thống để đối chiếu.
                    </div>
                  )}
                </div>

                {prevTotals && comparisonData ? (
                  <div className="space-y-2.5">
                    <div className="rounded-lg border border-slate-200 overflow-hidden text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200">
                          <tr>
                            <th className="p-1.5 pl-2">Chỉ tiêu</th>
                            <th className="p-1.5 text-right">Kỳ trước</th>
                            <th className="p-1.5 text-right">Kỳ này</th>
                            <th className="p-1.5 pr-2 text-right">Chênh lệch (Δ)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[11px]">
                          <tr>
                            <td className="p-1.5 pl-2 text-slate-700 font-medium">Tiếp nhận</td>
                            <td className="p-1.5 text-right text-slate-600">{formatNumber(prevTotals.recTotal)}</td>
                            <td className="p-1.5 text-right font-bold text-slate-900">{formatNumber(totalStats.recTotal)}</td>
                            <td className="p-1.5 pr-2 text-right font-bold">
                              <span className={`inline-flex items-center gap-0.5 ${comparisonData.deltaRec >= 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                                {comparisonData.deltaRec > 0 ? '+' : ''}{formatNumber(comparisonData.deltaRec)}
                              </span>
                            </td>
                          </tr>

                          <tr>
                            <td className="p-1.5 pl-2 text-slate-700 font-medium">Trực tuyến</td>
                            <td className="p-1.5 text-right text-slate-600">{formatPercent(prevTotals.onlineRate)}</td>
                            <td className="p-1.5 text-right font-bold text-blue-600">{formatPercent(totalStats.onlineRate)}</td>
                            <td className="p-1.5 pr-2 text-right font-bold">
                              <span className={`inline-flex items-center gap-0.5 ${comparisonData.deltaOnlineRate >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {comparisonData.deltaOnlineRate > 0 ? '+' : ''}{comparisonData.deltaOnlineRate}%
                              </span>
                            </td>
                          </tr>

                          <tr>
                            <td className="p-1.5 pl-2 text-slate-700 font-medium">Đúng hạn</td>
                            <td className="p-1.5 text-right text-slate-600">{formatPercent(prevTotals.onTimeRate)}</td>
                            <td className="p-1.5 text-right font-bold text-emerald-700">{formatPercent(totalStats.onTimeRate)}</td>
                            <td className="p-1.5 pr-2 text-right font-bold">
                              <span className={`inline-flex items-center gap-0.5 ${comparisonData.deltaOnTimeRate >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {comparisonData.deltaOnTimeRate > 0 ? '+' : ''}{comparisonData.deltaOnTimeRate}%
                              </span>
                            </td>
                          </tr>

                          <tr>
                            <td className="p-1.5 pl-2 text-slate-700 font-medium">Quá hạn</td>
                            <td className="p-1.5 text-right text-slate-600">{formatNumber(prevTotals.compLate)}</td>
                            <td className="p-1.5 text-right font-bold text-rose-600">{formatNumber(totalStats.compLate)}</td>
                            <td className="p-1.5 pr-2 text-right font-bold">
                              <span className={`inline-flex items-center gap-0.5 ${comparisonData.deltaLate <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {comparisonData.deltaLate > 0 ? '+' : ''}{comparisonData.deltaLate} hs
                              </span>
                            </td>
                          </tr>

                          <tr>
                            <td className="p-1.5 pl-2 text-slate-700 font-medium">Đang xử lý</td>
                            <td className="p-1.5 text-right text-slate-600">{formatNumber(prevTotals.pendTotal)}</td>
                            <td className="p-1.5 text-right font-bold text-amber-600">{formatNumber(totalStats.pendTotal)}</td>
                            <td className="p-1.5 pr-2 text-right font-medium text-slate-600">
                              {comparisonData.deltaPending > 0 ? '+' : ''}{comparisonData.deltaPending} hs
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Synthesis assessment card */}
                    <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded-lg">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-900 mb-1">
                        <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                        <span>Đánh giá so với kỳ trước:</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-blue-800">
                        {comparisonData.assessmentSummary}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 py-3 text-center">
                    Vui lòng chọn một kỳ báo cáo để hiển thị so sánh.
                  </div>
                )}
              </div>
            )}

            {/* SECTION 3: DOSSIER URGES IN REPORTING PERIOD */}
            {metricsSectionTab === 'urges' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Tổng lượt đôn đốc:</span>
                    <span className="text-base font-bold text-blue-700">
                      {formatNumber(urgePeriodStats.totalUrges)} <span className="text-[10px] font-normal text-slate-500">lượt</span>
                    </span>
                  </div>

                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Số hồ sơ bị đôn đốc:</span>
                    <span className="text-base font-bold text-slate-800">
                      {formatNumber(urgePeriodStats.uniqueUrgedDossiers)} <span className="text-[10px] font-normal text-slate-500">hồ sơ</span>
                    </span>
                  </div>

                  <div className={`p-2 rounded-lg border ${urgePeriodStats.multipleUrges > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                    <span className={`text-[10px] block ${urgePeriodStats.multipleUrges > 0 ? 'text-rose-700 font-medium' : 'text-slate-500'}`}>
                      Đôn đốc nhiều lần (≥ 2):
                    </span>
                    <span className={`text-base font-bold ${urgePeriodStats.multipleUrges > 0 ? 'text-rose-700' : 'text-slate-800'}`}>
                      {formatNumber(urgePeriodStats.multipleUrges)} <span className="text-[10px] font-normal text-slate-500">hồ sơ</span>
                    </span>
                  </div>

                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Tỷ lệ xử lý xong:</span>
                    <span className="text-base font-bold text-emerald-600">
                      {formatPercent(urgePeriodStats.urgeResolutionRate)}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs divide-y divide-slate-100">
                  <div className="flex justify-between items-center pt-1 text-[11px]">
                    <span className="text-slate-600">- Đã hoàn tất xử lý:</span>
                    <span className="font-semibold text-emerald-600">{urgePeriodStats.resolvedUrges} lượt</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 text-[11px]">
                    <span className="text-slate-600">- Đang đôn đốc / xử lý:</span>
                    <span className="font-semibold text-blue-600">{urgePeriodStats.inProgressUrges} lượt</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 text-[11px]">
                    <span className="text-slate-600">- Chờ phản hồi:</span>
                    <span className="font-semibold text-amber-600">{urgePeriodStats.pendingUrges} lượt</span>
                  </div>
                </div>

                {urgePeriodStats.topUnits.length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                      Đơn vị phát sinh đôn đốc nhiều nhất:
                    </span>
                    <div className="space-y-1">
                      {urgePeriodStats.topUnits.slice(0, 3).map((u, i) => (
                        <div key={i} className="flex justify-between items-center text-[11px] px-2 py-1 bg-slate-50 rounded border border-slate-100">
                          <span className="text-slate-700 truncate">{u.unitName}</span>
                          <span className="font-bold text-rose-700">{u.count} lượt</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-1 text-center">
                  <Link
                    to="/dossier-urge"
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1 hover:underline"
                  >
                    <span>Xem danh sách quản lý đôn đốc chi tiết</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 space-y-2">
              <button
                type="button"
                onClick={handleGenerateAI}
                disabled={isGeneratingAI || isLocked}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg shadow-sm transition-all disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isGeneratingAI ? 'Đang tổng hợp & phân tích...' : 'Tạo nhận xét tự động AI (Kèm So sánh & Đôn đốc)'}</span>
              </button>
              <p className="text-[10px] text-slate-400 text-center">
                AI sẽ tổng hợp toàn bộ các chỉ tiêu, so sánh tăng/giảm với kỳ trước và giám sát đôn đốc hồ sơ.
              </p>
            </div>
          </div>

          {/* Editorial Area */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Dự thảo Nhận xét và Đánh giá Báo cáo
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
