import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { store } from '../services/store';
import { formatNumber, formatPercent, getStatusBadge } from '../utils/format';
import { resolveLinhVuc } from '../utils/fieldResolver';
import {
  calcCompletionRate,
  calcOnTimeRate,
  calcLateRate,
  calcOnlineRate,
  calcPendingRate
} from '../features/analysis/formulas';
import {
  fetchLiveDashboardData,
  validateRowFormulas
} from '../services/dashboardService';
import type { ReportingPeriod, ReportSource, ReportStatistic, Unit, Field } from '../types/database';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  ReferenceLine,
  LabelList
} from 'recharts';
import {
  AlertTriangle,
  Database,
  RefreshCw,
  Check,
  Plus,
  FileSpreadsheet,
  Move,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Settings,
  RotateCcw,
  Save,
  LayoutGrid
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  // Live Supabase Database state
  const [loading, setLoading] = useState<boolean>(true);
  const [dbStatus, setDbStatus] = useState<{
    configured: boolean;
    connected: boolean;
    schemaReady: boolean;
    errorMessage: string | null;
  }>({
    configured: true,
    connected: false,
    schemaReady: false,
    errorMessage: null,
  });

  const [liveReports, setLiveReports] = useState<ReportingPeriod[]>([]);
  const [liveSources, setLiveSources] = useState<ReportSource[]>([]);
  const [liveStats, setLiveStats] = useState<ReportStatistic[]>([]);
  const [allPeriodStats, setAllPeriodStats] = useState<ReportStatistic[]>([]);
  const [liveUnits, setLiveUnits] = useState<Unit[]>([]);
  const [liveFields, setLiveFields] = useState<Field[]>([]);

  // Filter state
  const [selectedReportId, setSelectedReportId] = useState<string>('');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('ALL');
  const [selectedSourceId, setSelectedSourceId] = useState<string>('ALL');
  const [selectedFieldId, setSelectedFieldId] = useState<string>('ALL');
  const [presentationDimension, setPresentationDimension] = useState<'unit' | 'field'>('unit');

  // Trend history limit selection state
  const [trendHistoryLimit, setTrendHistoryLimit] = useState<number>(10);
  const [isSavingLayout, setIsSavingLayout] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Chart Layout state (Support drag-and-drop, mouse edge/corner resize, hide/show, reorder)
  interface ChartConfig {
    id: string;
    title: string;
    width: 'half' | 'full';
    order: number;
    visible: boolean;
    widthPercent?: number;
    height?: number;
  }

  const [isAdminLayoutMode, setIsAdminLayoutMode] = useState<boolean>(false);
  const [resizingChartId, setResizingChartId] = useState<string | null>(null);

  const [chartsLayout, setChartsLayout] = useState<ChartConfig[]>([
    { id: 'trend', title: '1. Diễn biến khối lượng theo mốc chốt báo cáo', width: 'half', widthPercent: 49, height: 420, order: 0, visible: true },
    { id: 'quality', title: '2. Cơ cấu chất lượng giải quyết (QĐ 766)', width: 'half', widthPercent: 49, height: 420, order: 1, visible: true },
    { id: 'channels', title: '3. Cơ cấu kênh tiếp nhận Dịch vụ công', width: 'half', widthPercent: 49, height: 420, order: 2, visible: true },
    { id: 'ranking', title: '4. Xếp hạng hiệu năng giải quyết Đơn vị', width: 'half', widthPercent: 49, height: 420, order: 3, visible: true },
    { id: 'thematic_pending', title: '5. Chuyên đề: Tiến độ hồ sơ Đang giải quyết', width: 'full', widthPercent: 100, height: 480, order: 4, visible: true },
    { id: 'thematic_received', title: '6. Chuyên đề: Số lượng hồ sơ Đã tiếp nhận', width: 'full', widthPercent: 100, height: 480, order: 5, visible: true },
    { id: 'thematic_completed', title: '7. Chuyên đề: Số lượng hồ sơ Đã giải quyết', width: 'full', widthPercent: 100, height: 480, order: 6, visible: true },
  ]);

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId === targetId) return;

    const dragIndex = chartsLayout.findIndex((c) => c.id === draggedId);
    const targetIndex = chartsLayout.findIndex((c) => c.id === targetId);

    if (dragIndex !== -1 && targetIndex !== -1) {
      const updated = [...chartsLayout];
      const [draggedItem] = updated.splice(dragIndex, 1);
      updated.splice(targetIndex, 0, draggedItem);
      
      const reordered = updated.map((item, idx) => ({ ...item, order: idx }));
      setChartsLayout(reordered);
    }
  };

  const moveChart = (id: string, direction: 'up' | 'down') => {
    const idx = chartsLayout.findIndex((c) => c.id === id);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === chartsLayout.length - 1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const updated = [...chartsLayout];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;

    const reordered = updated.map((item, idx) => ({ ...item, order: idx }));
    setChartsLayout(reordered);
  };

  const resizeChart = (id: string, width: 'half' | 'full') => {
    setChartsLayout(prev =>
      prev.map((c) => (c.id === id ? { ...c, width, widthPercent: width === 'full' ? 100 : 49 } : c))
    );
  };

  const toggleChartVisibility = (id: string) => {
    setChartsLayout(prev =>
      prev.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c))
    );
  };

  const resetLayout = () => {
    setChartsLayout([
      { id: 'trend', title: '1. Diễn biến khối lượng theo mốc chốt báo cáo', width: 'half', widthPercent: 49, height: 420, order: 0, visible: true },
      { id: 'quality', title: '2. Cơ cấu chất lượng giải quyết (QĐ 766)', width: 'half', widthPercent: 49, height: 420, order: 1, visible: true },
      { id: 'channels', title: '3. Cơ cấu kênh tiếp nhận Dịch vụ công', width: 'half', widthPercent: 49, height: 420, order: 2, visible: true },
      { id: 'ranking', title: '4. Xếp hạng hiệu năng giải quyết Đơn vị', width: 'half', widthPercent: 49, height: 420, order: 3, visible: true },
      { id: 'thematic_pending', title: '5. Chuyên đề: Tiến độ hồ sơ Đang giải quyết', width: 'full', widthPercent: 100, height: 480, order: 4, visible: true },
      { id: 'thematic_received', title: '6. Chuyên đề: Số lượng hồ sơ Đã tiếp nhận', width: 'full', widthPercent: 100, height: 480, order: 5, visible: true },
      { id: 'thematic_completed', title: '7. Chuyên đề: Số lượng hồ sơ Đã giải quyết', width: 'full', widthPercent: 100, height: 480, order: 6, visible: true },
    ]);
  };

  const saveLayoutToAllUsers = async () => {
    setIsSavingLayout(true);
    setSaveStatus(null);
    try {
      const currentConfig = store.getSystemConfig();
      const updatedConfig = {
        ...currentConfig,
        chartsLayout: chartsLayout,
        trendHistoryLimit: trendHistoryLimit,
      };
      
      const res = await store.saveSystemConfig(updatedConfig);
      if (res.success) {
        setSaveStatus({ type: 'success', message: 'Đã áp dụng & đồng bộ bố cục thành công!' });
        setTimeout(() => setSaveStatus(null), 4000);
      } else {
        setSaveStatus({ type: 'error', message: res.message || 'Lỗi khi lưu bố cục.' });
      }
    } catch (err: any) {
      setSaveStatus({ type: 'error', message: err.message || 'Lỗi kết nối CSDL.' });
    } finally {
      setIsSavingLayout(false);
    }
  };

  const resizeRef = useRef<{
    id: string;
    startWidthPercent: number;
    startHeight: number;
    startX: number;
    startY: number;
    containerWidth: number;
  } | null>(null);

  const startResize = (e: React.MouseEvent, id: string, direction: 'horizontal' | 'vertical' | 'both') => {
    e.preventDefault();
    e.stopPropagation();

    const chart = chartsLayout.find(c => c.id === id);
    if (!chart) return;

    const cardEl = document.getElementById(`chart-card-${id}`);
    const containerEl = cardEl?.parentElement;
    if (!cardEl || !containerEl) return;

    const currentWidthPx = cardEl.getBoundingClientRect().width;
    const containerWidthPx = containerEl.getBoundingClientRect().width || 1200;

    setResizingChartId(id);
    resizeRef.current = {
      id,
      startWidthPercent: chart.widthPercent || (chart.width === 'full' ? 100 : 49),
      startHeight: chart.height || 420,
      startX: e.clientX,
      startY: e.clientY,
      containerWidth: containerWidthPx,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizeRef.current) return;
      const ref = resizeRef.current;
      
      let newPercent = ref.startWidthPercent;
      let newHeight = ref.startHeight;

      if (direction === 'horizontal' || direction === 'both') {
        const deltaX = moveEvent.clientX - ref.startX;
        const deltaPercent = (deltaX / ref.containerWidth) * 100;
        newPercent = Math.max(20, Math.min(100, ref.startWidthPercent + deltaPercent));
      }

      if (direction === 'vertical' || direction === 'both') {
        const deltaY = moveEvent.clientY - ref.startY;
        newHeight = Math.max(250, Math.min(800, ref.startHeight + deltaY));
      }

      setChartsLayout(prev =>
        prev.map(c => {
          if (c.id === ref.id) {
            return {
              ...c,
              widthPercent: Math.round(newPercent),
              height: Math.round(newHeight),
              width: newPercent > 75 ? 'full' : 'half'
            };
          }
          return c;
        })
      );
    };

    const handleMouseUp = () => {
      setResizingChartId(null);
      resizeRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Load live data from Supabase
  const loadData = useCallback(async (reportId?: string) => {
    setLoading(true);
    try {
      const targetId = reportId || selectedReportId;
      const res = await fetchLiveDashboardData(targetId);
      setDbStatus({
        configured: res.configured,
        connected: res.connected,
        schemaReady: res.schemaReady,
        errorMessage: res.errorMessage,
      });

      setLiveReports(res.reports);
      setLiveUnits(res.units);
      setLiveFields(res.fields);

      setLiveSources(res.sources);
      setLiveStats(res.statistics);
      setAllPeriodStats(res.allPeriodStatistics || []);

      if (!selectedReportId && res.currentReport) {
        setSelectedReportId(res.currentReport.id);
      }
    } catch (err: any) {
      setDbStatus((prev) => ({ ...prev, connected: false, schemaReady: false, errorMessage: err.message }));
      setLiveReports([]);
      setLiveUnits([]);
      setLiveFields([]);
      setLiveSources([]);
      setLiveStats([]);
      setAllPeriodStats([]);
    } finally {
      setLoading(false);
    }
  }, [selectedReportId]);

  useEffect(() => {
    loadData();

    // Sync initial configuration from centralized store
    const initialConfig = store.getSystemConfig();
    if (initialConfig.chartsLayout && Array.isArray(initialConfig.chartsLayout) && initialConfig.chartsLayout.length > 0) {
      setChartsLayout(initialConfig.chartsLayout);
    }
    if (initialConfig.trendHistoryLimit) {
      setTrendHistoryLimit(initialConfig.trendHistoryLimit);
    }

    const unsub = store.subscribe(() => {
      loadData();

      // Also update layout if another user / tab modified system_config
      const currentConfig = store.getSystemConfig();
      if (currentConfig.chartsLayout && Array.isArray(currentConfig.chartsLayout) && currentConfig.chartsLayout.length > 0) {
        setChartsLayout(currentConfig.chartsLayout);
      }
      if (currentConfig.trendHistoryLimit) {
        setTrendHistoryLimit(currentConfig.trendHistoryLimit);
      }
    });
    return () => unsub();
  }, []);

  // When selectedReportId changes, reload specific report data
  const handleReportChange = (newReportId: string) => {
    setSelectedReportId(newReportId);
    loadData(newReportId);
  };

  // Selected Report Details
  const selectedReport = useMemo(() => {
    return liveReports.find((r) => r.id === selectedReportId) || liveReports[0] || null;
  }, [liveReports, selectedReportId]);

  // Unique sectors for Lĩnh vực TTHC dropdown
  const sectorOptions = useMemo(() => {
    const set = new Set<string>();
    liveFields.forEach((f) => {
      const sec = (f.linh_vuc || '').trim();
      if (sec && sec !== 'Chưa phân loại') set.add(sec);
    });
    liveStats.forEach((s) => {
      const sec = resolveLinhVuc(s.field_name_snapshot || s.field_name || '', s.field_id, liveFields);
      if (sec && sec !== 'Chưa phân loại') set.add(sec);
      const raw = (s.field_name_snapshot || s.field_name || '').trim();
      if (raw && raw.length <= 50 && !raw.includes('di sản') && !raw.includes('giám sát') && !raw.includes('hỏa táng')) {
        set.add(raw);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [liveFields, liveStats]);

  // Filtered stats based on active dropdowns
  const filteredStats = useMemo(() => {
    return liveStats.filter((s) => {
      if (selectedUnitId !== 'ALL' && s.unit_id !== selectedUnitId) return false;
      if (selectedSourceId !== 'ALL' && s.source_id !== selectedSourceId) return false;
      if (selectedFieldId !== 'ALL') {
        const sec = resolveLinhVuc(s.field_name_snapshot || s.field_name || '', s.field_id, liveFields);
        const raw = (s.field_name_snapshot || s.field_name || '').trim();
        if (sec !== selectedFieldId && raw !== selectedFieldId && s.field_id !== selectedFieldId) return false;
      }
      return true;
    });
  }, [liveStats, selectedUnitId, selectedSourceId, selectedFieldId, liveFields]);

  // Aggregated 8 KPIs
  const totals = useMemo(() => {
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

    filteredStats.forEach((s) => {
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

    // 8 Core KPIs
    const onlineRate = calcOnlineRate(recOnline, recOffline);
    const completionRate = calcCompletionRate(compTotal, recTotal);
    const onTimeRate = calcOnTimeRate(compEarly, compOnTime, compTotal);
    const overdueRate = calcLateRate(compLate, compTotal);
    const pendingOnTimeRate = calcPendingRate(pendOnTime, pendTotal);

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
      onlineRate,
      completionRate,
      onTimeRate,
      overdueRate,
      pendingOnTimeRate,
    };
  }, [filteredStats]);

  // Discrepancy Warnings
  const warnings = useMemo(() => {
    return filteredStats.filter((s) => {
      const v = validateRowFormulas(s);
      return !v.allPassed || s.validation_status === 'warning' || (s.validation_errors && s.validation_errors.length > 0);
    });
  }, [filteredStats]);

  // Chart 1: Monthly Volume Trend (multi-period)
  const monthlyTrendData = useMemo(() => {
    const rawTrends = [...liveReports]
      .slice(0, trendHistoryLimit)
      .map((rep) => {
        const repStats = allPeriodStats.filter((s) => s.report_id === rep.id);
        
        // Apply the same filters as the rest of the dashboard
        const filteredRepStats = repStats.filter((s) => {
          if (selectedUnitId !== 'ALL' && s.unit_id !== selectedUnitId) return false;
          if (selectedSourceId !== 'ALL' && s.source_id !== selectedSourceId) return false;
          if (selectedFieldId !== 'ALL') {
            const sec = resolveLinhVuc(s.field_name_snapshot || s.field_name || '', s.field_id, liveFields);
            const raw = (s.field_name_snapshot || s.field_name || '').trim();
            if (sec !== selectedFieldId && raw !== selectedFieldId && s.field_id !== selectedFieldId) return false;
          }
          return true;
        });

        const rec = filteredRepStats.reduce((acc, curr) => acc + curr.received_total, 0);
        const comp = filteredRepStats.reduce((acc, curr) => acc + curr.completed_total, 0);
        const pend = filteredRepStats.reduce((acc, curr) => acc + curr.pending_total, 0);
        const pendLate = filteredRepStats.reduce((acc, curr) => acc + (curr.pending_late || 0), 0);
        const compLate = filteredRepStats.reduce((acc, curr) => acc + (curr.completed_late || 0), 0);

        // Date chốt báo cáo: data_as_of -> period_end -> period_start
        const dateStr = rep.data_as_of || rep.period_end || rep.period_start || '';
        let closingDateFormatted = dateStr;
        let sortKey = 0;
        if (dateStr) {
          const cleanDate = dateStr.split('T')[0];
          const parts = cleanDate.split('-');
          if (parts.length === 3) {
            closingDateFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
            sortKey = new Date(`${parts[0]}-${parts[1]}-${parts[2]}T00:00:00`).getTime() || 0;
          } else {
            sortKey = new Date(dateStr).getTime() || 0;
          }
        }

        return {
          code: rep.report_code,
          name: closingDateFormatted || rep.report_name,
          reportName: rep.report_name,
          received: rec,
          resolved: comp,
          pending: pend,
          pendingLate: pendLate,
          resolvedLate: compLate,
          sortKey,
        };
      });

    // Sort chronologically in ascending order
    rawTrends.sort((a, b) => a.sortKey - b.sortKey);

    return rawTrends;
  }, [liveReports, allPeriodStats, trendHistoryLimit, selectedUnitId, selectedSourceId, selectedFieldId, liveFields]);

  // Chart 2: Resolution distribution (early / on time / late)
  const resolutionDistributionData = useMemo(() => {
    return [
      { name: 'Trước hạn', value: totals.compEarly, color: '#10b981' },
      { name: 'Đúng hạn', value: totals.compOnTime, color: '#0ea5e9' },
      { name: 'Quá hạn', value: totals.compLate, color: '#f43f5e' },
    ];
  }, [totals]);

  // Chart 3: Channel mix (online vs in person)
  const channelMixData = useMemo(() => {
    return [
      { name: 'Trực tuyến (Online)', value: totals.recOnline, color: '#3b82f6' },
      { name: 'Trực tiếp / Một cửa', value: totals.recOffline, color: '#f59e0b' },
    ];
  }, [totals]);

  // Chart 4: Unit performance ranking
  const unitRankingData = useMemo(() => {
    const map: Record<string, { unitName: string; rec: number; comp: number; pend: number; onTime: number; onTimeRate: number }> = {};
    liveUnits.forEach((u) => {
      map[u.id] = { unitName: u.name, rec: 0, comp: 0, pend: 0, onTime: 0, onTimeRate: 100 };
    });

    liveStats.forEach((s) => {
      if (!map[s.unit_id]) {
        map[s.unit_id] = { unitName: s.unit_name_snapshot || s.unit_name || 'Đơn vị', rec: 0, comp: 0, pend: 0, onTime: 0, onTimeRate: 100 };
      }
      map[s.unit_id].rec += s.received_total;
      map[s.unit_id].comp += s.completed_total;
      map[s.unit_id].pend += s.pending_total;
      map[s.unit_id].onTime += s.completed_early + s.completed_on_time;
    });

    return Object.values(map)
      .map((item) => ({
        ...item,
        onTimeRate: item.comp > 0 ? Number(((item.onTime / item.comp) * 100).toFixed(1)) : 100,
        compRate: item.rec > 0 ? Number(((item.comp / item.rec) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.onTimeRate - a.onTimeRate);
  }, [liveUnits, liveStats]);

  // Aggregate presentation data grouped by Unit
  const unitPresentationData = useMemo(() => {
    const map: Record<string, {
      displayName: string;
      pending_on_time: number;
      pending_late: number;
      pending_total: number;
      received_online: number;
      received_offline: number;
      received_total: number;
      completed_on_time_and_early: number;
      completed_late: number;
      completed_total: number;
    }> = {};

    liveUnits.forEach((u) => {
      map[u.id] = {
        displayName: u.name,
        pending_on_time: 0,
        pending_late: 0,
        pending_total: 0,
        received_online: 0,
        received_offline: 0,
        received_total: 0,
        completed_on_time_and_early: 0,
        completed_late: 0,
        completed_total: 0,
      };
    });

    liveStats.forEach((s) => {
      const uId = s.unit_id;
      if (!map[uId]) {
        map[uId] = {
          displayName: s.unit_name_snapshot || s.unit_name || 'Đơn vị',
          pending_on_time: 0,
          pending_late: 0,
          pending_total: 0,
          received_online: 0,
          received_offline: 0,
          received_total: 0,
          completed_on_time_and_early: 0,
          completed_late: 0,
          completed_total: 0,
        };
      }
      map[uId].pending_on_time += s.pending_on_time;
      map[uId].pending_late += s.pending_late;
      map[uId].pending_total += s.pending_total;
      map[uId].received_online += s.received_online;
      map[uId].received_offline += s.received_offline;
      map[uId].received_total += s.received_total;
      map[uId].completed_on_time_and_early += (s.completed_early + s.completed_on_time);
      map[uId].completed_late += s.completed_late;
      map[uId].completed_total += s.completed_total;
    });

    return Object.values(map)
      .filter((item) => item.received_total > 0 || item.pending_total > 0 || item.completed_total > 0)
      .sort((a, b) => b.received_total - a.received_total);
  }, [liveUnits, liveStats]);

  // Aggregate presentation data grouped by Field (Lĩnh vực)
  const fieldPresentationData = useMemo(() => {
    const map: Record<string, {
      displayName: string;
      pending_on_time: number;
      pending_late: number;
      pending_total: number;
      received_online: number;
      received_offline: number;
      received_total: number;
      completed_on_time_and_early: number;
      completed_late: number;
      completed_total: number;
    }> = {};

    liveStats.forEach((s) => {
      const sectorName = resolveLinhVuc(s.field_name_snapshot || s.field_name || '', s.field_id, liveFields);
      const rawSnap = (s.field_name_snapshot || s.field_name || '').trim();
      
      const isLongProcedure =
        rawSnap.length > 50 ||
        rawSnap.includes('di sản') ||
        rawSnap.includes('giám sát') ||
        rawSnap.includes('hỏa táng') ||
        rawSnap.includes('quyền sử dụng đất');

      const displayName = !isLongProcedure && rawSnap
        ? rawSnap
        : sectorName !== 'Chưa phân loại'
        ? sectorName
        : rawSnap || 'Lĩnh vực khác';

      if (!map[displayName]) {
        map[displayName] = {
          displayName,
          pending_on_time: 0,
          pending_late: 0,
          pending_total: 0,
          received_online: 0,
          received_offline: 0,
          received_total: 0,
          completed_on_time_and_early: 0,
          completed_late: 0,
          completed_total: 0,
        };
      }
      map[displayName].pending_on_time += s.pending_on_time;
      map[displayName].pending_late += s.pending_late;
      map[displayName].pending_total += s.pending_total;
      map[displayName].received_online += s.received_online;
      map[displayName].received_offline += s.received_offline;
      map[displayName].received_total += s.received_total;
      map[displayName].completed_on_time_and_early += (s.completed_early + s.completed_on_time);
      map[displayName].completed_late += s.completed_late;
      map[displayName].completed_total += s.completed_total;
    });

    return Object.values(map)
      .filter((item) => item.received_total > 0 || item.pending_total > 0 || item.completed_total > 0)
      .sort((a, b) => b.received_total - a.received_total);
  }, [liveStats, liveFields]);

  // Switch between Unit or Field based on user tab selection
  const presentationData = useMemo(() => {
    return presentationDimension === 'unit' ? unitPresentationData : fieldPresentationData;
  }, [presentationDimension, unitPresentationData, fieldPresentationData]);

  const reportBadge = selectedReport ? getStatusBadge(selectedReport.status) : null;

  if (loading && liveReports.length === 0) {
    return (
      <div className="py-24 text-center space-y-3">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
        <div className="text-sm font-bold text-slate-800">Đang tải dữ liệu từ CSDL Supabase...</div>
      </div>
    );
  }

  return (
    <div className="space-y-5 w-full">
      {/* Top Controls & Global Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData(selectedReportId)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Làm mới
            </button>
            {selectedReportId && (
              <Link
                to={`/reports/${selectedReportId}`}
                className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                Xem chi tiết kỳ báo cáo này →
              </Link>
            )}
          </div>
        </div>

        {/* Global Filter Bar */}
        {liveReports.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3">
            {/* Filter 1: Kỳ Báo Cáo */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Kỳ báo cáo
              </label>
              <select
                value={selectedReportId}
                onChange={(e) => handleReportChange(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {liveReports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.report_code} - {r.report_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter 2: Nguồn dữ liệu */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Nguồn dữ liệu
              </label>
              <select
                value={selectedSourceId}
                onChange={(e) => setSelectedSourceId(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Tất cả nguồn dữ liệu</option>
                {liveSources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.source_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter 3: Đơn vị giải quyết */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Đơn vị giải quyết
              </label>
              <select
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Tất cả đơn vị</option>
                {liveUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter 4: Lĩnh vực */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Lĩnh vực TTHC
              </label>
              <select
                value={selectedFieldId}
                onChange={(e) => setSelectedFieldId(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Tất cả lĩnh vực ({sectorOptions.length})</option>
                {sectorOptions.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-500">
            Chưa có kỳ báo cáo nào trong cơ sở dữ liệu Supabase.
          </div>
        )}
      </div>

      {/* Empty State Banner if no reports */}
      {liveReports.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center space-y-4">
          <Database className="w-12 h-12 text-slate-400 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-slate-800">Cơ sở dữ liệu chưa có Báo cáo</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Hệ thống hoạt động theo kiến trúc DB-only 100% và không tự động sinh dữ liệu ảo. Hãy tạo kỳ báo cáo đầu tiên hoặc nạp dữ liệu từ Excel để bắt đầu phân tích.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <Link
              to="/reports"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Tạo Kỳ báo cáo mới
            </Link>
            <Link
              to="/import"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Nhập số liệu Excel
            </Link>
          </div>
        </div>
      )}

      {/* Discrepancy Notification (if any) */}
      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-bold text-amber-900">
              Phát hiện {warnings.length} bản ghi có cảnh báo chênh lệch dữ liệu (Audit Discrepancy)
            </h4>
            <p className="text-xs text-amber-700 mt-0.5">
              Hệ thống tự động phát hiện số liệu giữa nguồn ghi nhận và tổng thành phần thực tế có sai số (cần rà soát đối soát).
            </p>
            <div className="mt-2 space-y-1">
              {warnings.slice(0, 3).map((w) => (
                <div key={w.id} className="text-xs text-amber-800 bg-white/70 px-2.5 py-1 rounded-md border border-amber-200">
                  <span className="font-semibold">{w.field_name_snapshot}</span> ({w.unit_name_snapshot}):{' '}
                  {w.validation_errors?.map((e) => e.message).join(' | ') || 'Kiểm tra công thức thành phần'}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. 8 Core KPI Cards Grid */}
      <div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {/* KPI 1: Total received */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Tổng tiếp nhận
            </div>
            <div className="text-xl font-black text-slate-900 mt-1">
              {formatNumber(totals.recTotal)}
            </div>
            <div className="text-[10px] text-blue-600 mt-1 font-medium">
              online + tt + trước
            </div>
          </div>

          {/* KPI 2: Total resolved */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Đã giải quyết
            </div>
            <div className="text-xl font-black text-emerald-600 mt-1">
              {formatNumber(totals.compTotal)}
            </div>
            <div className="text-[10px] text-emerald-600 mt-1 font-medium">
              sớm + đúng + trễ
            </div>
          </div>

          {/* KPI 3: Total pending */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Đang giải quyết
            </div>
            <div className="text-xl font-black text-indigo-600 mt-1">
              {formatNumber(totals.pendTotal)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-medium">
              trong hạn + trễ hạn
            </div>
          </div>

          {/* KPI 4: Online submission rate */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Tỷ lệ nộp Online
            </div>
            <div className="text-xl font-black text-blue-600 mt-1">
              {formatPercent(totals.onlineRate)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-medium">
              online / (online + tt)
            </div>
          </div>

          {/* KPI 5: Completion rate */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Tỷ lệ giải quyết
            </div>
            <div className="text-xl font-black text-slate-900 mt-1">
              {formatPercent(totals.completionRate)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-medium">
              resolved / received
            </div>
          </div>

          {/* KPI 6: On-time completion rate */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Tỷ lệ đúng hạn
            </div>
            <div className="text-xl font-black text-emerald-600 mt-1">
              {formatPercent(totals.onTimeRate)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-medium">
              (sớm + đúng) / tổng
            </div>
          </div>

          {/* KPI 7: Overdue rate */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Tỷ lệ quá hạn
            </div>
            <div className={`text-xl font-black mt-1 ${totals.overdueRate > 2 ? 'text-rose-600' : 'text-slate-700'}`}>
              {formatPercent(totals.overdueRate)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-medium">
              quá hạn / resolved
            </div>
          </div>

          {/* KPI 8: Pending on-time rate */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Tồn trong hạn
            </div>
            <div className="text-xl font-black text-teal-600 mt-1">
              {formatPercent(totals.pendingOnTimeRate)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-medium">
              trong hạn / pending
            </div>
          </div>
        </div>
      </div>

      {/* 2.5 DASHBOARD LAYOUT BUILDER CONTROLS */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900">
              Cá nhân hóa Giao diện & Bố cục Báo cáo
            </h3>
            <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">
              Thay đổi vị trí (kéo thả hoặc bấm nút di chuyển) và cỡ cột 50% / 100% của từng biểu đồ lập tức
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
          {isAdminLayoutMode && (
            <>
              {saveStatus && (
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                  saveStatus.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  {saveStatus.message}
                </span>
              )}
              <button
                onClick={saveLayoutToAllUsers}
                disabled={isSavingLayout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 border border-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50"
                title="Lưu bố cục hiện tại cho toàn bộ người dùng trong hệ thống"
              >
                {isSavingLayout ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Lưu cho tất cả người dùng
              </button>
              <button
                onClick={resetLayout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Khôi phục mặc định
              </button>
            </>
          )}
          <button
            onClick={() => setIsAdminLayoutMode(!isAdminLayoutMode)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg border transition-all shadow-xs ${
              isAdminLayoutMode
                ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Settings className={`w-4 h-4 ${isAdminLayoutMode ? 'animate-spin' : ''}`} />
            {isAdminLayoutMode ? 'Thoát Chế độ Bố cục' : 'Tùy biến Bố cục (Admin)'}
          </button>
        </div>
      </div>

      {isAdminLayoutMode && (
        <div className="bg-blue-50/50 border border-blue-200/60 rounded-xl p-4 text-xs text-blue-800 space-y-2 shadow-inner">
          <div className="font-bold flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            Hướng dẫn thiết lập bố cục:
          </div>
          <ul className="list-disc pl-4 space-y-1 font-medium">
            <li><strong>Sắp xếp thứ tự</strong>: Kéo thẻ biểu đồ này thả lên thẻ khác để hoán đổi vị trí, hoặc dùng cụm nút mũi tên lên/xuống ở góc mỗi thẻ.</li>
            <li><strong>Thay đổi kích thước (Resize)</strong>: Di chuột đến cạnh phải, cạnh dưới, hoặc góc dưới-phải của thẻ biểu đồ để kéo dãn kích thước (chiều rộng / chiều cao) trực quan theo ý muốn.</li>
            <li><strong>Ẩn/Hiện biểu đồ</strong>: Nhấp vào biểu tượng con mắt để ẩn bớt biểu đồ khỏi màn hình chính (biểu đồ ẩn sẽ xuất hiện mờ ở dưới cùng để bạn dễ dàng bật lại).</li>
          </ul>
        </div>
      )}

      {/* 4. DYNAMIC CUSTOMIZABLE CHARTS GRID */}
      <div className="flex flex-wrap gap-6 items-stretch w-full">
        {chartsLayout
          .sort((a, b) => a.order - b.order)
          .map((chart, index) => {
            // If hidden and not in layout mode, don't render it at all
            if (!chart.visible && !isAdminLayoutMode) return null;

            return (
              <div
                key={chart.id}
                id={`chart-card-${chart.id}`}
                draggable={isAdminLayoutMode && resizingChartId !== chart.id}
                onDragStart={(e) => handleDragStart(e, chart.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, chart.id)}
                style={{
                  width: typeof window !== 'undefined' && window.innerWidth < 1024
                    ? '100%'
                    : `calc(${chart.widthPercent || (chart.width === 'full' ? 100 : 49)}% - ${
                        (chart.widthPercent || (chart.width === 'full' ? 100 : 49)) === 100 ? 0 : 12
                      }px)`,
                  height: `${chart.height || 420}px`,
                  minWidth: '280px',
                }}
                className={`flex flex-col justify-between transition-all duration-200 relative p-5 rounded-xl border ${
                  !chart.visible ? 'opacity-40 border-dashed border-slate-300 bg-slate-50' : 'opacity-100 bg-white'
                } ${
                  isAdminLayoutMode ? 'hover:shadow-md cursor-grab active:cursor-grabbing border-blue-300/80 shadow-xs' : 'border-slate-200 shadow-xs'
                }`}
              >
                {/* Admin configuration header overlay */}
                {isAdminLayoutMode && (
                  <div className="absolute top-3 right-3 flex items-center bg-white/95 backdrop-blur-xs border border-slate-200 px-2 py-1 rounded-lg shadow-sm gap-2 z-10 animate-fade-in">
                    <span className="text-[10px] font-bold text-slate-400 select-none flex items-center gap-1 mr-1">
                      <Move className="w-3 h-3 text-blue-500" />
                      Kéo/Thả
                    </span>

                    {/* Move Up / Move Down Button fallbacks */}
                    <button
                      onClick={() => moveChart(chart.id, 'up')}
                      disabled={index === 0}
                      className="p-0.5 text-slate-500 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                      title="Di chuyển trước"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => moveChart(chart.id, 'down')}
                      disabled={index === chartsLayout.length - 1}
                      className="p-0.5 text-slate-500 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                      title="Di chuyển sau"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>

                    {/* Visibility Toggle */}
                    <button
                      onClick={() => toggleChartVisibility(chart.id)}
                      className={`p-0.5 cursor-pointer ${chart.visible ? 'text-blue-600 hover:text-blue-800' : 'text-rose-500 hover:text-rose-700'}`}
                      title={chart.visible ? 'Ẩn biểu đồ' : 'Hiển thị biểu đồ'}
                    >
                      {chart.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}

                {/* Mouse drag handles for interactive resize */}
                {isAdminLayoutMode && (
                  <>
                    {/* Right edge drag handle for width resize */}
                    <div
                      onMouseDown={(e) => startResize(e, chart.id, 'horizontal')}
                      className="absolute top-0 right-0 w-2.5 h-full cursor-col-resize hover:bg-blue-400/30 active:bg-blue-500/50 transition-all z-20"
                      title="Kéo cạnh này để thay đổi chiều rộng"
                    />
                    {/* Bottom edge drag handle for height resize */}
                    <div
                      onMouseDown={(e) => startResize(e, chart.id, 'vertical')}
                      className="absolute bottom-0 left-0 w-full h-2.5 cursor-row-resize hover:bg-blue-400/30 active:bg-blue-500/50 transition-all z-20"
                      title="Kéo cạnh này để thay đổi chiều cao"
                    />
                    {/* Bottom-right corner drag handle for both */}
                    <div
                      onMouseDown={(e) => startResize(e, chart.id, 'both')}
                      className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize hover:bg-blue-400/40 active:bg-blue-500/60 transition-all z-30 flex items-end justify-end p-0.5"
                      title="Kéo góc này để đổi cả chiều rộng & cao"
                    >
                      <div className="w-2.5 h-2.5 border-r-2 border-b-2 border-slate-400 rounded-br-xs" />
                    </div>
                  </>
                )}

                {/* MAIN CHART CARD CONTENT */}
                <div className="flex-1 flex flex-col justify-between h-full w-full min-h-0">
                  {chart.id === 'trend' && (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 pr-16">
                            1. Diễn biến khối lượng theo mốc chốt báo cáo
                          </h3>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Xu hướng tổng tiếp nhận, kết quả giải quyết và số lượng hồ sơ tồn đang xử lý
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 z-10">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Số mốc hiển thị:</span>
                          <select
                            value={trendHistoryLimit}
                            onChange={(e) => setTrendHistoryLimit(Number(e.target.value))}
                            className="text-[11px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                          >
                            <option value={5}>5 mốc gần nhất</option>
                            <option value={10}>10 mốc gần nhất (Mặc định)</option>
                            <option value={15}>15 mốc gần nhất</option>
                            <option value={20}>20 mốc gần nhất</option>
                            <option value={30}>30 mốc gần nhất</option>
                            <option value={999}>Tất cả mốc báo cáo</option>
                          </select>
                          {!isAdminLayoutMode && (
                            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md hidden md:inline">
                              Xu hướng thời gian
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-h-0 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="colorSolv" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip
                              formatter={(val) => formatNumber(Number(val))}
                              labelFormatter={(label, items) => {
                                const repName = items && items[0]?.payload?.reportName;
                                return `Ngày chốt số liệu: ${label}${repName ? ` (${repName})` : ''}`;
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Area type="monotone" dataKey="received" name="Tổng tiếp nhận" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRec)" />
                            <Area type="monotone" dataKey="resolved" name="Đã giải quyết" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSolv)" />
                            <Line type="monotone" dataKey="pending" name="Đang xử lý (Tồn)" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 4 }} />
                            <Line type="monotone" dataKey="pendingLate" name="Đang giải quyết quá hạn" stroke="#ef4444" strokeWidth={2.5} strokeDasharray="3 3" dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="resolvedLate" name="Đã giải quyết trễ hạn" stroke="#b91c1c" strokeWidth={2.5} dot={{ r: 3 }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}

                  {chart.id === 'quality' && (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 pr-16">
                            2. Cơ cấu chất lượng giải quyết (QĐ 766)
                          </h3>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Tỷ trọng Trước hạn, Đúng hạn và Quá hạn (Chỉ tiêu đúng hạn &gt; 95%)
                          </p>
                        </div>
                        {!isAdminLayoutMode && (
                          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md shrink-0">
                            Đúng hạn: {formatPercent(totals.onTimeRate)}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-h-0 w-full relative flex items-center justify-center">
                        {totals.compTotal > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={resolutionDistributionData}
                                cx="50%"
                                cy="50%"
                                innerRadius="55%"
                                outerRadius="80%"
                                paddingAngle={4}
                                dataKey="value"
                              >
                                {resolutionDistributionData.map((entry, index) => (
                                  <Cell key={`cell-res-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(val) => formatNumber(Number(val))} />
                              <Legend wrapperStyle={{ fontSize: 12 }} />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <p className="text-xs text-slate-400">Chưa có dữ liệu giải quyết trong kỳ</p>
                        )}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                          <div className="text-2xl font-black text-slate-800">{formatPercent(totals.onTimeRate)}</div>
                          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Đúng hạn</div>
                        </div>
                      </div>
                    </>
                  )}

                  {chart.id === 'channels' && (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 pr-16">
                            3. Cơ cấu kênh tiếp nhận Dịch vụ công
                          </h3>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Đo lường mức độ số hóa hồ sơ công dân nộp Trực tuyến (Online)
                          </p>
                        </div>
                        {!isAdminLayoutMode && (
                          <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md shrink-0">
                            Số hóa: {formatPercent(totals.onlineRate)}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-h-0 w-full relative flex items-center justify-center">
                        {totals.recOnline + totals.recOffline > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={channelMixData}
                                cx="50%"
                                cy="50%"
                                innerRadius="55%"
                                outerRadius="80%"
                                paddingAngle={4}
                                dataKey="value"
                              >
                                {channelMixData.map((entry, index) => (
                                  <Cell key={`cell-chan-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(val) => formatNumber(Number(val))} />
                              <Legend wrapperStyle={{ fontSize: 12 }} />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <p className="text-xs text-slate-400">Chưa có dữ liệu kênh phát sinh mới</p>
                        )}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                          <div className="text-2xl font-black text-slate-800">{formatPercent(totals.onlineRate)}</div>
                          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Trực tuyến</div>
                        </div>
                      </div>
                    </>
                  )}

                  {chart.id === 'ranking' && (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 pr-16">
                            4. Xếp hạng hiệu năng giải quyết Đơn vị
                          </h3>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            So sánh tổng khối lượng hồ sơ và tỷ lệ đúng hạn của từng đơn vị
                          </p>
                        </div>
                        {!isAdminLayoutMode && (
                          <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-md shrink-0">
                            Chuẩn 95% Đúng hạn
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-h-0 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={unitRankingData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="unitName" tick={{ fontSize: 11 }} />
                            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                            <YAxis yAxisId="right" orientation="right" domain={[80, 100]} unit="%" tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(val, name) => name === 'Tỷ lệ đúng hạn (%)' ? `${val}%` : formatNumber(Number(val))} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <ReferenceLine yAxisId="right" y={95} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: 'Mục tiêu 95%', fill: '#f43f5e', fontSize: 10, position: 'insideTopRight' }} />
                            <Bar yAxisId="left" dataKey="comp" name="Đã giải quyết (hồ sơ)" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Line yAxisId="right" type="monotone" dataKey="onTimeRate" name="Tỷ lệ đúng hạn (%)" stroke="#e11d48" strokeWidth={2.5} dot={{ r: 4 }} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}

                  {chart.id === 'thematic_pending' && (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-slate-100 pb-3">
                        <div>
                          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider pr-16">
                            TỔNG HỢP TIẾN ĐỘ HỒ SƠ ĐANG GIẢI QUYẾT
                          </h3>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Phân bổ cơ cấu hồ sơ đang xử lý: Đang giải quyết Trong hạn &amp; Đang giải quyết Quá hạn ({presentationDimension === 'unit' ? 'theo Đơn vị' : 'theo Lĩnh vực'})
                          </p>
                        </div>
                        
                        {/* Selector toggle */}
                        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 self-start shrink-0 z-10">
                          <button
                            onClick={() => setPresentationDimension('unit')}
                            className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                              presentationDimension === 'unit' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            Theo Đơn vị
                          </button>
                          <button
                            onClick={() => setPresentationDimension('field')}
                            className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                              presentationDimension === 'field' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            Theo Lĩnh vực
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex-1 min-h-0 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={presentationData} margin={{ top: 25, right: 10, left: 10, bottom: 25 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis
                              dataKey="displayName"
                              tick={{ fontSize: 9, fill: '#475569', fontWeight: 500 }}
                              angle={-45}
                              textAnchor="end"
                              height={80}
                              interval={chart.widthPercent && chart.widthPercent < 65 ? 'preserveStartEnd' : 0}
                            />
                            <YAxis tick={{ fontSize: 10, fill: '#475569' }} />
                            <Tooltip formatter={(val, name) => [formatNumber(Number(val)), name]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                            <Legend verticalAlign="top" height={36} iconType="square" iconSize={12} wrapperStyle={{ fontSize: 11, fontWeight: 'bold' }} />
                            
                            <Bar dataKey="pending_on_time" stackId="pending_stack" name="Đang giải quyết Trong hạn" fill="#3b82f6">
                              <LabelList dataKey="pending_on_time" position="center" style={{ fill: '#ffffff', fontSize: 9, fontWeight: 'bold' }} formatter={(val: any) => val > 0 ? formatNumber(val) : ''} />
                            </Bar>
                            <Bar dataKey="pending_late" stackId="pending_stack" name="Đang giải quyết quá hạn" fill="#ef4444">
                              <LabelList dataKey="pending_late" position="center" style={{ fill: '#ffffff', fontSize: 9, fontWeight: 'bold' }} formatter={(val: any) => val > 0 ? formatNumber(val) : ''} />
                              <LabelList dataKey="pending_total" position="top" style={{ fill: '#1e293b', fontSize: 11, fontWeight: 'bold' }} formatter={(val: any) => val > 0 ? formatNumber(val) : ''} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}

                  {chart.id === 'thematic_received' && (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-slate-100 pb-3">
                        <div>
                          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider pr-16">
                            TỔNG HỢP SỐ LƯỢNG HỒ SƠ ĐÃ TIẾP NHẬN
                          </h3>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Phân bổ cơ cấu hình thức tiếp nhận: Trực tuyến &amp; Trực tiếp ({presentationDimension === 'unit' ? 'theo Đơn vị' : 'theo Lĩnh vực'})
                          </p>
                        </div>
                        
                        {/* Selector toggle */}
                        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 self-start shrink-0 z-10">
                          <button
                            onClick={() => setPresentationDimension('unit')}
                            className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                              presentationDimension === 'unit' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            Theo Đơn vị
                          </button>
                          <button
                            onClick={() => setPresentationDimension('field')}
                            className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                              presentationDimension === 'field' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            Theo Lĩnh vực
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex-1 min-h-0 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={presentationData} margin={{ top: 25, right: 10, left: 10, bottom: 25 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis
                              dataKey="displayName"
                              tick={{ fontSize: 9, fill: '#475569', fontWeight: 500 }}
                              angle={-45}
                              textAnchor="end"
                              height={80}
                              interval={chart.widthPercent && chart.widthPercent < 65 ? 'preserveStartEnd' : 0}
                            />
                            <YAxis tick={{ fontSize: 10, fill: '#475569' }} />
                            <Tooltip formatter={(val, name) => [formatNumber(Number(val)), name]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                            <Legend verticalAlign="top" height={36} iconType="square" iconSize={12} wrapperStyle={{ fontSize: 11, fontWeight: 'bold' }} />
                            
                            <Bar dataKey="received_online" stackId="received_stack" name="Trực tuyến" fill="#60a5fa">
                              <LabelList dataKey="received_online" position="center" style={{ fill: '#ffffff', fontSize: 9, fontWeight: 'bold' }} formatter={(val: any) => val > 0 ? formatNumber(val) : ''} />
                            </Bar>
                            <Bar dataKey="received_offline" stackId="received_stack" name="Trực tiếp" fill="#8b1a1a">
                              <LabelList dataKey="received_offline" position="center" style={{ fill: '#ffffff', fontSize: 9, fontWeight: 'bold' }} formatter={(val: any) => val > 0 ? formatNumber(val) : ''} />
                              <LabelList dataKey="received_total" position="top" style={{ fill: '#1e293b', fontSize: 11, fontWeight: 'bold' }} formatter={(val: any) => val > 0 ? formatNumber(val) : ''} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}

                  {chart.id === 'thematic_completed' && (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-slate-100 pb-3">
                        <div>
                          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider pr-16">
                            TỔNG HỢP SỐ LƯỢNG HỒ SƠ ĐÃ GIẢI QUYẾT
                          </h3>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Phân bổ cơ cấu kết quả xử lý: Đúng hạn &amp; Trước hạn vs Trễ hạn (Quá hạn) ({presentationDimension === 'unit' ? 'theo Đơn vị' : 'theo Lĩnh vực'})
                          </p>
                        </div>
                        
                        {/* Selector toggle */}
                        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 self-start shrink-0 z-10">
                          <button
                            onClick={() => setPresentationDimension('unit')}
                            className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                              presentationDimension === 'unit' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            Theo Đơn vị
                          </button>
                          <button
                            onClick={() => setPresentationDimension('field')}
                            className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                              presentationDimension === 'field' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            Theo Lĩnh vực
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex-1 min-h-0 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={presentationData} margin={{ top: 25, right: 10, left: 10, bottom: 25 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis
                              dataKey="displayName"
                              tick={{ fontSize: 9, fill: '#475569', fontWeight: 500 }}
                              angle={-45}
                              textAnchor="end"
                              height={80}
                              interval={chart.widthPercent && chart.widthPercent < 65 ? 'preserveStartEnd' : 0}
                            />
                            <YAxis tick={{ fontSize: 10, fill: '#475569' }} />
                            <Tooltip formatter={(val, name) => [formatNumber(Number(val)), name]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                            <Legend verticalAlign="top" height={36} iconType="square" iconSize={12} wrapperStyle={{ fontSize: 11, fontWeight: 'bold' }} />
                            
                            <Bar dataKey="completed_on_time_and_early" stackId="completed_stack" name="Đúng hạn &amp; Trước hạn" fill="#10b981">
                              <LabelList dataKey="completed_on_time_and_early" position="center" style={{ fill: '#ffffff', fontSize: 9, fontWeight: 'bold' }} formatter={(val: any) => val > 0 ? formatNumber(val) : ''} />
                            </Bar>
                            <Bar dataKey="completed_late" stackId="completed_stack" name="Trễ hạn" fill="#ef4444">
                              <LabelList dataKey="completed_late" position="center" style={{ fill: '#ffffff', fontSize: 9, fontWeight: 'bold' }} formatter={(val: any) => val > 0 ? formatNumber(val) : ''} />
                              <LabelList dataKey="completed_total" position="top" style={{ fill: '#1e293b', fontSize: 11, fontWeight: 'bold' }} formatter={(val: any) => val > 0 ? formatNumber(val) : ''} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
      </div>

      {/* 5. DETAILED STATISTICAL GRAIN GRID (REPORT + SOURCE + FIELD) */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Chi tiết số liệu thống kê hạt nhân (Grain: REPORT + SOURCE + FIELD)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Mỗi dòng thể hiện đầy đủ 4 công thức toán học được kiểm chứng tự động. Đơn vị được map tự động từ danh mục Lĩnh vực.
            </p>
          </div>
          <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-md">
            Tổng cộng: {filteredStats.length} dòng
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold text-[10px]">
              <tr>
                <th className="px-3 py-2.5">Lĩnh vực & Đơn vị</th>
                <th className="px-3 py-2.5">Nguồn</th>
                <th className="px-3 py-2.5 text-right">Tiếp nhận (Tổng)</th>
                <th className="px-3 py-2.5 text-right">Online / Trực tiếp</th>
                <th className="px-3 py-2.5 text-right">Kỳ trước</th>
                <th className="px-3 py-2.5 text-right">Đã giải quyết</th>
                <th className="px-3 py-2.5 text-right">Trước / Đúng / Trễ</th>
                <th className="px-3 py-2.5 text-right">Đang giải quyết</th>
                <th className="px-3 py-2.5 text-right">Trong hạn / Trễ</th>
                <th className="px-3 py-2.5 text-center">Kiểm chứng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredStats.map((row) => {
                const val = validateRowFormulas(row);
                const sectorName = resolveLinhVuc(
                  row.field_name_snapshot || row.field_name || '',
                  row.field_id,
                  liveFields
                );
                const rawSnap = (row.field_name_snapshot || row.field_name || '').trim();
                const isLongProcedure =
                  rawSnap.length > 50 ||
                  rawSnap.includes('di sản') ||
                  rawSnap.includes('giám sát') ||
                  rawSnap.includes('hỏa táng') ||
                  rawSnap.includes('quyền sử dụng đất');
                const displayName =
                  !isLongProcedure && rawSnap
                    ? rawSnap
                    : sectorName !== 'Chưa phân loại'
                    ? sectorName
                    : rawSnap || 'Lĩnh vực TTHC';

                return (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-slate-900 text-xs leading-snug">{displayName}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{row.unit_name_snapshot || 'Đơn vị'}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {liveSources.find((s) => s.id === row.source_id)?.source_name || 'Hệ thống'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                      {formatNumber(row.received_total)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-blue-600">
                      {formatNumber(row.received_online)} / {formatNumber(row.received_offline)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-500">
                      {formatNumber(row.carried_forward)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-emerald-600">
                      {formatNumber(row.completed_total)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-600">
                      {formatNumber(row.completed_early)} / {formatNumber(row.completed_on_time)} / {row.completed_late > 0 ? (
                        <span className="text-rose-600 font-bold">{row.completed_late}</span>
                      ) : (
                        0
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-indigo-600">
                      {formatNumber(row.pending_total)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-600">
                      {formatNumber(row.pending_on_time)} / {row.pending_late > 0 ? (
                        <span className="text-rose-600 font-bold">{row.pending_late}</span>
                      ) : (
                        0
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {val.allPassed ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                          <Check className="w-3 h-3 text-emerald-700" />
                          Hợp lệ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded" title={val.errorMessages.join('\n')}>
                          Lỗi
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
