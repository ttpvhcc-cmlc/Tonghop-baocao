import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { store, Profile } from '../services/store';
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
  LayoutGrid,
  Pencil,
  X,
  CheckCircle2,
  ArrowUpDown,
  Layers,
  Filter,
  Search,
  SlidersHorizontal
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface ChartConfig {
  id: string;
  title: string;
  subtitle?: string;
  width: 'half' | 'full';
  order: number;
  visible: boolean;
  widthPercent?: number;
  height?: number;
}

const DEFAULT_CHARTS_LAYOUT: ChartConfig[] = [
  {
    id: 'trend',
    title: '1. Diễn biến khối lượng theo mốc chốt báo cáo',
    subtitle: 'Xu hướng tổng tiếp nhận, kết quả giải quyết và số lượng hồ sơ tồn đang xử lý',
    width: 'half',
    widthPercent: 49,
    height: 420,
    order: 0,
    visible: true,
  },
  {
    id: 'quality',
    title: '2. Cơ cấu chất lượng giải quyết (QĐ 766)',
    subtitle: 'Tỷ trọng Trước hạn, Đúng hạn và Quá hạn (Chỉ tiêu đúng hạn > 95%)',
    width: 'half',
    widthPercent: 49,
    height: 420,
    order: 1,
    visible: true,
  },
  {
    id: 'channels',
    title: '3. Cơ cấu kênh tiếp nhận Dịch vụ công',
    subtitle: 'Đo lường mức độ hồ sơ nộp trực tuyến',
    width: 'half',
    widthPercent: 49,
    height: 420,
    order: 2,
    visible: true,
  },
  {
    id: 'ranking',
    title: '4. Xếp hạng hiệu năng giải quyết Đơn vị',
    subtitle: 'So sánh tổng khối lượng hồ sơ và tỷ lệ đúng hạn của từng đơn vị',
    width: 'half',
    widthPercent: 49,
    height: 420,
    order: 3,
    visible: true,
  },
  {
    id: 'thematic_pending',
    title: 'TỔNG HỢP TIẾN ĐỘ HỒ SƠ ĐANG GIẢI QUYẾT',
    subtitle: 'Phân bổ cơ cấu hồ sơ đang xử lý: Đang giải quyết Trong hạn & Đang giải quyết Quá hạn',
    width: 'full',
    widthPercent: 100,
    height: 480,
    order: 4,
    visible: true,
  },
  {
    id: 'thematic_received',
    title: 'TỔNG HỢP SỐ LƯỢNG HỒ SƠ ĐÃ TIẾP NHẬN',
    subtitle: 'Phân bổ cơ cấu hình thức tiếp nhận: Trực tuyến & Trực tiếp',
    width: 'full',
    widthPercent: 100,
    height: 480,
    order: 5,
    visible: true,
  },
  {
    id: 'thematic_completed',
    title: 'TỔNG HỢP SỐ LƯỢNG HỒ SƠ ĐÃ GIẢI QUYẾT',
    subtitle: 'Phân bổ cơ cấu kết quả xử lý: Đúng hạn & Trước hạn vs Trễ hạn (Quá hạn)',
    width: 'full',
    widthPercent: 100,
    height: 480,
    order: 6,
    visible: true,
  },
  {
    id: 'detailed_table',
    title: 'Chi tiết số liệu thống kê',
    subtitle: 'Thống kê chi tiết tình hình tiếp nhận và giải quyết hồ sơ thủ tục hành chính',
    width: 'full',
    widthPercent: 100,
    height: 480,
    order: 7,
    visible: true,
  },
];

const mergeWithDefaultCharts = (savedCharts?: any[]): ChartConfig[] => {
  if (!Array.isArray(savedCharts) || savedCharts.length === 0) {
    return DEFAULT_CHARTS_LAYOUT;
  }
  return DEFAULT_CHARTS_LAYOUT.map((def) => {
    const found = savedCharts.find((s) => s.id === def.id);
    if (!found) return def;
    return {
      ...def,
      ...found,
      title: found.title || def.title,
      subtitle: found.subtitle !== undefined ? found.subtitle : def.subtitle,
      width: found.width || def.width,
      widthPercent: found.widthPercent ?? def.widthPercent,
      height: found.height ?? def.height,
      order: found.order ?? def.order,
      visible: found.visible !== undefined ? found.visible : def.visible,
    };
  }).sort((a, b) => a.order - b.order);
};

export const DashboardPage: React.FC = () => {
  // Live Supabase Database state
  const [loading, setLoading] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<Profile>(store.getCurrentUser());
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

  useEffect(() => {
    setCurrentUser(store.getCurrentUser());
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
    });
    return unsub;
  }, []);

  const isAuthenticated = currentUser.id !== 'guest' && currentUser.active === true;
  const canCreateReport = store.hasPermission('create_reports', currentUser);
  const canImportExcel = store.hasPermission('import_excel', currentUser);
  const canManageLayout = store.hasPermission('manage_system_config', currentUser);

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

  // Trend axis granularity ('month' | 'quarter' | 'year') and year selection state
  const [trendGranularity, setTrendGranularity] = useState<'month' | 'quarter' | 'year'>('month');
  const [selectedTrendYear, setSelectedTrendYear] = useState<number>(() => {
    return new Date().getFullYear();
  });
  const [trendHistoryLimit, setTrendHistoryLimit] = useState<number>(10);
  const [isSavingLayout, setIsSavingLayout] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Available Years for Trend Chart
  const availableTrendYears = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    liveReports.forEach((rep) => {
      const dateStr = rep.data_as_of || rep.period_end || rep.period_start || rep.created_at || '';
      if (dateStr) {
        const clean = dateStr.split('T')[0];
        const yr = new Date(clean).getFullYear() || parseInt(clean.split('-')[0], 10);
        if (yr && !isNaN(yr)) years.add(yr);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [liveReports]);

  // Distinct year ticks for multi-year view
  const yearTicks = useMemo(() => {
    const sorted = availableTrendYears.slice().sort((a, b) => a - b);
    if (sorted.length === 0) return [new Date().getFullYear()];
    if (sorted.length === 1) {
      return [sorted[0] - 1, sorted[0], sorted[0] + 1];
    }
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const all: number[] = [];
    for (let y = min; y <= max; y++) {
      all.push(y);
    }
    return all;
  }, [availableTrendYears]);

  // Series visibility toggle state for Trend chart (Diễn biến khối lượng theo mốc chốt báo cáo)
  type TrendSeriesKey = 'received' | 'pendingLate' | 'pending' | 'resolved' | 'resolvedLate';

  interface TrendSeriesItem {
    key: TrendSeriesKey;
    name: string;
    color: string;
    isArea: boolean;
    dash?: string;
    gradientId?: string;
  }

  const TREND_SERIES_LIST: TrendSeriesItem[] = [
    { key: 'received', name: 'Tổng tiếp nhận', color: '#3b82f6', isArea: true, gradientId: 'colorRec' },
    { key: 'pendingLate', name: 'Đang giải quyết quá hạn', color: '#ef4444', isArea: false, dash: '3 3' },
    { key: 'pending', name: 'Đang xử lý (Tồn)', color: '#f59e0b', isArea: false, dash: '4 4' },
    { key: 'resolved', name: 'Đã giải quyết', color: '#10b981', isArea: true, gradientId: 'colorSolv' },
    { key: 'resolvedLate', name: 'Đã giải quyết trễ hạn', color: '#b91c1c', isArea: false },
  ];

  const [trendSeriesVisibility, setTrendSeriesVisibility] = useState<Record<TrendSeriesKey, boolean>>({
    received: true,
    pendingLate: true,
    pending: true,
    resolved: true,
    resolvedLate: true,
  });

  const toggleTrendSeries = (key: TrendSeriesKey) => {
    setTrendSeriesVisibility(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const setAllTrendSeries = (visible: boolean) => {
    setTrendSeriesVisibility({
      received: visible,
      pendingLate: visible,
      pending: visible,
      resolved: visible,
      resolvedLate: visible,
    });
  };

  // State for Admin Editing Chart Header (Title & Subtitle/Caption)
  const [editingChartMeta, setEditingChartMeta] = useState<{
    id: string;
    title: string;
    subtitle: string;
  } | null>(null);

  // Detailed Table State: Sorting, Filtering, Grouping by Source
  const [tableSearchQuery, setTableSearchQuery] = useState<string>('');
  const [tableSourceFilter, setTableSourceFilter] = useState<string>('ALL');
  const [tableValidityFilter, setTableValidityFilter] = useState<'ALL' | 'VALID' | 'INVALID'>('ALL');
  const [tableOnlyWithData, setTableOnlyWithData] = useState<boolean>(false);
  const [tableGroupBySource, setTableGroupBySource] = useState<boolean>(false);
  const [tableSortKey, setTableSortKey] = useState<string>('received_total');
  const [tableSortDirection, setTableSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleTableSort = (key: string) => {
    if (tableSortKey === key) {
      setTableSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setTableSortKey(key);
      setTableSortDirection(key === 'field' || key === 'unit' || key === 'source' ? 'asc' : 'desc');
    }
  };

  const [isAdminLayoutMode, setIsAdminLayoutMode] = useState<boolean>(false);
  const [resizingChartId, setResizingChartId] = useState<string | null>(null);

  const [chartsLayout, setChartsLayout] = useState<ChartConfig[]>(DEFAULT_CHARTS_LAYOUT);

  const handleOpenEditModal = (chartId: string) => {
    const chart = chartsLayout.find(c => c.id === chartId);
    const def = DEFAULT_CHARTS_LAYOUT.find(c => c.id === chartId);
    setEditingChartMeta({
      id: chartId,
      title: chart?.title || def?.title || '',
      subtitle: chart?.subtitle !== undefined ? chart.subtitle : (def?.subtitle || ''),
    });
  };

  const handleSaveChartMeta = async () => {
    if (!editingChartMeta) return;
    const updatedLayout = chartsLayout.map(c => {
      if (c.id === editingChartMeta.id) {
        return {
          ...c,
          title: editingChartMeta.title.trim() || c.title,
          subtitle: editingChartMeta.subtitle.trim(),
        };
      }
      return c;
    });
    setChartsLayout(updatedLayout);
    setEditingChartMeta(null);

    // Automatically persist to system config so changes are saved immediately for all users
    try {
      const currentConfig = store.getSystemConfig();
      await store.saveSystemConfig({
        ...currentConfig,
        chartsLayout: updatedLayout,
      });
      setSaveStatus({ type: 'success', message: 'Đã cập nhật tiêu đề & chú thích biểu đồ thành công!' });
      setTimeout(() => setSaveStatus(null), 3500);
    } catch (e) {
      console.error('Failed to auto-save chart meta', e);
    }
  };

  const handleResetCurrentChartMeta = () => {
    if (!editingChartMeta) return;
    const def = DEFAULT_CHARTS_LAYOUT.find(c => c.id === editingChartMeta.id);
    if (def) {
      setEditingChartMeta({
        id: editingChartMeta.id,
        title: def.title,
        subtitle: def.subtitle || '',
      });
    }
  };

  const getChartTitle = (id: string, fallback: string) => {
    const chart = chartsLayout.find(c => c.id === id);
    return chart?.title || fallback;
  };

  const getChartSubtitle = (id: string, fallback: string, appendDimension?: boolean) => {
    const chart = chartsLayout.find(c => c.id === id);
    const base = chart?.subtitle !== undefined ? chart.subtitle : fallback;
    if (appendDimension) {
      const dimText = presentationDimension === 'unit' ? 'theo Đơn vị' : 'theo Lĩnh vực';
      if (!base.includes('theo Đơn vị') && !base.includes('theo Lĩnh vực')) {
        return `${base} (${dimText})`;
      }
    }
    return base;
  };

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
    setChartsLayout(DEFAULT_CHARTS_LAYOUT);
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
      setChartsLayout(mergeWithDefaultCharts(initialConfig.chartsLayout));
    }
    if (initialConfig.trendHistoryLimit) {
      setTrendHistoryLimit(initialConfig.trendHistoryLimit);
    }

    const unsub = store.subscribe(() => {
      loadData();

      // Also update layout if another user / tab modified system_config
      const currentConfig = store.getSystemConfig();
      if (currentConfig.chartsLayout && Array.isArray(currentConfig.chartsLayout) && currentConfig.chartsLayout.length > 0) {
        setChartsLayout(mergeWithDefaultCharts(currentConfig.chartsLayout));
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

  // Chart 1: Monthly/Quarterly/Yearly Volume Trend
  const monthlyTrendData = useMemo(() => {
    const targetReports = trendGranularity === 'year'
      ? liveReports
      : liveReports.filter((rep) => {
          const dateStr = rep.data_as_of || rep.period_end || rep.period_start || rep.created_at || '';
          if (!dateStr) return false;
          const clean = dateStr.split('T')[0];
          const parts = clean.split('-');
          let yr = parts.length === 3 ? parseInt(parts[0], 10) : new Date(clean).getFullYear();
          if (isNaN(yr) || yr === 1970) {
            yr = selectedTrendYear;
          }
          return yr === selectedTrendYear;
        });

    const processed = targetReports.map((rep) => {
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

      // Parse date for exact day and month
      const dateStr = rep.data_as_of || rep.period_end || rep.period_start || rep.created_at || '';
      let year = selectedTrendYear;
      let month = 1;
      let day = 1;
      let formattedDate = dateStr;

      if (dateStr) {
        const cleanDate = dateStr.split('T')[0];
        const parts = cleanDate.split('-');
        if (parts.length === 3) {
          year = parseInt(parts[0], 10) || selectedTrendYear;
          month = Math.max(1, Math.min(12, parseInt(parts[1], 10) || 1));
          day = Math.max(1, Math.min(31, parseInt(parts[2], 10) || 1));
          formattedDate = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
        } else {
          const parsedD = new Date(dateStr);
          if (!isNaN(parsedD.getTime())) {
            year = parsedD.getFullYear();
            month = parsedD.getMonth() + 1;
            day = parsedD.getDate();
            formattedDate = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
          }
        }
      }

      const daysInMonth = new Date(year, month, 0).getDate() || 30;
      
      let x = 1;
      if (trendGranularity === 'month') {
        // Continuous position: 1.0 (Jan 1) -> 12.99 (Dec 31)
        x = Math.round((month + (day - 1) / daysInMonth) * 1000) / 1000;
      } else if (trendGranularity === 'quarter') {
        // Continuous position: 1.0 (Q1) -> 4.99 (Q4)
        const quarter = Math.floor((month - 1) / 3) + 1;
        const monthInQuarter = (month - 1) % 3;
        x = Math.round((quarter + (monthInQuarter + (day - 1) / daysInMonth) / 3) * 1000) / 1000;
      } else {
        // Continuous position across years: e.g. 2026.70
        x = Math.round((year + (month - 1 + (day - 1) / daysInMonth) / 12) * 1000) / 1000;
      }

      return {
        code: rep.report_code,
        name: formattedDate || rep.report_name,
        formattedDate,
        reportName: rep.report_name,
        year,
        month,
        day,
        x,
        received: rec,
        resolved: comp,
        pending: pend,
        pendingLate: pendLate,
        resolvedLate: compLate,
        sortKey: new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`).getTime() || 0,
      };
    });

    // Sort chronologically
    processed.sort((a, b) => a.x - b.x);
    return processed;
  }, [liveReports, allPeriodStats, trendGranularity, selectedTrendYear, selectedUnitId, selectedSourceId, selectedFieldId, liveFields]);

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
      { name: 'Trực tuyến', value: totals.recOnline, color: '#3b82f6' },
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

  // Filtered presentation datasets ensuring only items with positive data are rendered
  const receivedPresentationData = useMemo(() => {
    const base = presentationDimension === 'unit' ? unitPresentationData : fieldPresentationData;
    return base
      .filter((item) => item.received_total > 0)
      .sort((a, b) => b.received_total - a.received_total);
  }, [presentationDimension, unitPresentationData, fieldPresentationData]);

  const pendingPresentationData = useMemo(() => {
    const base = presentationDimension === 'unit' ? unitPresentationData : fieldPresentationData;
    return base
      .filter((item) => item.pending_total > 0)
      .sort((a, b) => b.pending_total - a.pending_total);
  }, [presentationDimension, unitPresentationData, fieldPresentationData]);

  const completedPresentationData = useMemo(() => {
    const base = presentationDimension === 'unit' ? unitPresentationData : fieldPresentationData;
    return base
      .filter((item) => item.completed_total > 0)
      .sort((a, b) => b.completed_total - a.completed_total);
  }, [presentationDimension, unitPresentationData, fieldPresentationData]);

  // Processed Detailed Table Rows with Search, Filter, and Sort
  const processedTableRows = useMemo(() => {
    let list = filteredStats.map((row) => {
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
      const sourceName = liveSources.find((s) => s.id === row.source_id)?.source_name || 'Hệ thống';
      const unitName = row.unit_name_snapshot || row.unit_name || 'Đơn vị';

      return {
        ...row,
        displayName,
        sourceName,
        unitName,
        validation: val,
      };
    });

    // 1. Text Search Query (Field, Unit, Source)
    if (tableSearchQuery.trim()) {
      const q = tableSearchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.displayName.toLowerCase().includes(q) ||
          r.unitName.toLowerCase().includes(q) ||
          r.sourceName.toLowerCase().includes(q)
      );
    }

    // 2. Source Filter
    if (tableSourceFilter !== 'ALL') {
      list = list.filter((r) => r.source_id === tableSourceFilter);
    }

    // 3. Validity Filter
    if (tableValidityFilter === 'VALID') {
      list = list.filter((r) => r.validation.allPassed);
    } else if (tableValidityFilter === 'INVALID') {
      list = list.filter((r) => !r.validation.allPassed);
    }

    // 4. Only with data filter
    if (tableOnlyWithData) {
      list = list.filter((r) => r.received_total > 0 || r.completed_total > 0 || r.pending_total > 0 || r.carried_forward > 0);
    }

    // 5. Sorting
    list.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      switch (tableSortKey) {
        case 'field':
          valA = a.displayName;
          valB = b.displayName;
          break;
        case 'unit':
          valA = a.unitName;
          valB = b.unitName;
          break;
        case 'source':
          valA = a.sourceName;
          valB = b.sourceName;
          break;
        case 'received_total':
          valA = a.received_total;
          valB = b.received_total;
          break;
        case 'received_online':
          valA = a.received_online;
          valB = b.received_online;
          break;
        case 'carried_forward':
          valA = a.carried_forward;
          valB = b.carried_forward;
          break;
        case 'completed_total':
          valA = a.completed_total;
          valB = b.completed_total;
          break;
        case 'completed_on_time':
          valA = a.completed_early + a.completed_on_time;
          valB = b.completed_early + b.completed_on_time;
          break;
        case 'pending_total':
          valA = a.pending_total;
          valB = b.pending_total;
          break;
        case 'pending_late':
          valA = a.pending_late;
          valB = b.pending_late;
          break;
        case 'validity':
          valA = a.validation.allPassed ? 1 : 0;
          valB = b.validation.allPassed ? 1 : 0;
          break;
        default:
          valA = a.received_total;
          valB = b.received_total;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return tableSortDirection === 'asc'
          ? valA.localeCompare(valB, 'vi')
          : valB.localeCompare(valA, 'vi');
      }

      return tableSortDirection === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
    });

    return list;
  }, [filteredStats, liveFields, liveSources, tableSearchQuery, tableSourceFilter, tableValidityFilter, tableOnlyWithData, tableSortKey, tableSortDirection]);

  // Grouped rows when tableGroupBySource is enabled
  const groupedTableRows = useMemo(() => {
    if (!tableGroupBySource) return null;

    const groups: Record<string, {
      sourceId: string;
      sourceName: string;
      rows: typeof processedTableRows;
      totals: {
        received_total: number;
        received_online: number;
        received_offline: number;
        carried_forward: number;
        completed_total: number;
        completed_early: number;
        completed_on_time: number;
        completed_late: number;
        pending_total: number;
        pending_on_time: number;
        pending_late: number;
      };
    }> = {};

    processedTableRows.forEach((row) => {
      const sId = row.source_id || 'unknown';
      if (!groups[sId]) {
        groups[sId] = {
          sourceId: sId,
          sourceName: row.sourceName,
          rows: [],
          totals: {
            received_total: 0,
            received_online: 0,
            received_offline: 0,
            carried_forward: 0,
            completed_total: 0,
            completed_early: 0,
            completed_on_time: 0,
            completed_late: 0,
            pending_total: 0,
            pending_on_time: 0,
            pending_late: 0,
          },
        };
      }
      groups[sId].rows.push(row);
      groups[sId].totals.received_total += row.received_total;
      groups[sId].totals.received_online += row.received_online;
      groups[sId].totals.received_offline += row.received_offline;
      groups[sId].totals.carried_forward += row.carried_forward;
      groups[sId].totals.completed_total += row.completed_total;
      groups[sId].totals.completed_early += row.completed_early;
      groups[sId].totals.completed_on_time += row.completed_on_time;
      groups[sId].totals.completed_late += row.completed_late;
      groups[sId].totals.pending_total += row.pending_total;
      groups[sId].totals.pending_on_time += row.pending_on_time;
      groups[sId].totals.pending_late += row.pending_late;
    });

    return Object.values(groups);
  }, [tableGroupBySource, processedTableRows]);

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-700">Bộ lọc phân tích</span>
            {!isAuthenticated && (
              <span className="text-[11px] text-slate-500 font-medium">
                (Khách vãng lai: Tự do chọn kỳ báo cáo & các tiêu chí để xem trình diễn dữ liệu thật từ Supabase)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canManageLayout && isAuthenticated && (
              <>
                {isAdminLayoutMode && (
                  <>
                    {saveStatus && (
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-lg border ${
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
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50"
                      title="Lưu bố cục"
                    >
                      {isSavingLayout ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      Lưu bố cục
                    </button>
                    <button
                      onClick={resetLayout}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Mặc định
                    </button>
                  </>
                )}
                <button
                  onClick={() => setIsAdminLayoutMode(!isAdminLayoutMode)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                    isAdminLayoutMode
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                  title="Tùy biến bố cục biểu đồ"
                >
                  <Settings className={`w-3.5 h-3.5 ${isAdminLayoutMode ? 'animate-spin' : ''}`} />
                  {isAdminLayoutMode ? 'Thoát chế độ bố cục' : 'Chỉnh bố cục'}
                </button>
              </>
            )}
            <button
              onClick={() => loadData(selectedReportId)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Làm mới
            </button>
            {selectedReportId && isAuthenticated && (
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
                value={selectedReportId || (selectedReport?.id ?? '')}
                onChange={(e) => handleReportChange(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
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
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center space-y-4">
          <Database className="w-12 h-12 text-slate-400 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-slate-800">Chưa có dữ liệu Báo cáo từ Supabase</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xl mx-auto leading-relaxed">
              Hệ thống hoạt động theo nguyên tắc 100% dữ liệu thật từ Supabase. Nếu trong cơ sở dữ liệu đã có dữ liệu báo cáo nhưng khách chưa đăng nhập chưa nhìn thấy, vui lòng thực thi câu lệnh SQL trong file migration <code>007_allow_public_read_for_presentation.sql</code> trên Supabase SQL Editor để cấp quyền xem công khai (RLS SELECT) cho khách vãng lai.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {isAuthenticated ? (
              <>
                {canCreateReport && (
                  <Link
                    to="/reports"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    Tạo Kỳ báo cáo mới
                  </Link>
                )}
                {canImportExcel && (
                  <Link
                    to="/import"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    Nhập số liệu Excel
                  </Link>
                )}
              </>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs"
              >
                Đăng nhập quản trị viên
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Discrepancy Notification (if any) - Only visible to authenticated users */}
      {warnings.length > 0 && isAuthenticated && (
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

      {canManageLayout && isAdminLayoutMode && (
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
            // Detailed table is rendered as a standalone section below
            if (chart.id === 'detailed_table') return null;

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
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-sm font-bold text-slate-900">
                              {getChartTitle('trend', '1. Diễn biến khối lượng theo mốc chốt báo cáo')}
                            </h3>
                            {canManageLayout && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal('trend')}
                                className="inline-flex items-center justify-center p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer shrink-0"
                                title="Chỉnh sửa Tiêu đề & Chú thích biểu đồ"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {getChartSubtitle('trend', 'Xu hướng tổng tiếp nhận, kết quả giải quyết và số lượng hồ sơ tồn đang xử lý')}
                          </p>
                        </div>

                        {/* Top controls: Granularity (Tháng / Quý / Năm) and Year selector */}
                        <div className="flex items-center gap-2 shrink-0 z-10 self-start sm:self-center flex-wrap">
                          {/* Granularity Toggle: Tháng | Quý | Năm */}
                          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                            <button
                              type="button"
                              onClick={() => setTrendGranularity('month')}
                              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                                trendGranularity === 'month'
                                  ? 'bg-white text-blue-700 shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                              title="Hiển thị trục hoành 12 tháng"
                            >
                              Tháng
                            </button>
                            <button
                              type="button"
                              onClick={() => setTrendGranularity('quarter')}
                              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                                trendGranularity === 'quarter'
                                  ? 'bg-white text-blue-700 shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                              title="Hiển thị trục hoành 4 Quý (Quý I - Quý IV)"
                            >
                              Quý
                            </button>
                            <button
                              type="button"
                              onClick={() => setTrendGranularity('year')}
                              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                                trendGranularity === 'year'
                                  ? 'bg-white text-blue-700 shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                              title="Hiển thị trục hoành theo Năm"
                            >
                              Năm
                            </button>
                          </div>

                          {/* Year Selector placed to the right (only for Month / Quarter mode) */}
                          {trendGranularity !== 'year' && (
                            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 shadow-2xs">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Năm:</span>
                              <select
                                value={selectedTrendYear}
                                onChange={(e) => setSelectedTrendYear(Number(e.target.value))}
                                className="text-xs font-bold text-blue-700 bg-transparent border-0 focus:outline-none cursor-pointer py-0.5"
                              >
                                {availableTrendYears.map((yr) => (
                                  <option key={yr} value={yr}>
                                    {yr}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Main Chart Area */}
                      <div className="flex-1 min-h-0 w-full relative">
                        {monthlyTrendData.length === 0 ? (
                          <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center p-6 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                            <p className="text-xs font-semibold text-slate-600 mb-1">
                              {trendGranularity === 'year'
                                ? 'Chưa có dữ liệu báo cáo nào'
                                : `Chưa có kỳ báo cáo nào trong năm ${selectedTrendYear} theo bộ lọc hiện tại`}
                            </p>
                            <p className="text-[11px] text-slate-400 max-w-sm">
                              Hãy chọn năm khác có dữ liệu hoặc điều chỉnh lại bộ lọc Đơn vị / Lĩnh vực.
                            </p>
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={monthlyTrendData} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
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
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={true} />
                              
                              {trendGranularity === 'month' && (
                                <XAxis
                                  type="number"
                                  dataKey="x"
                                  domain={[1, 13]}
                                  ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]}
                                  tickFormatter={(v) => `Thg ${v}`}
                                  tick={{ fontSize: 11, fill: '#64748b' }}
                                  axisLine={{ stroke: '#cbd5e1' }}
                                  tickLine={{ stroke: '#cbd5e1' }}
                                />
                              )}
                              {trendGranularity === 'quarter' && (
                                <XAxis
                                  type="number"
                                  dataKey="x"
                                  domain={[1, 5]}
                                  ticks={[1, 2, 3, 4]}
                                  tickFormatter={(v) => `Quý ${v === 1 ? 'I' : v === 2 ? 'II' : v === 3 ? 'III' : 'IV'}`}
                                  tick={{ fontSize: 11, fill: '#64748b' }}
                                  axisLine={{ stroke: '#cbd5e1' }}
                                  tickLine={{ stroke: '#cbd5e1' }}
                                />
                              )}
                              {trendGranularity === 'year' && (
                                <XAxis
                                  type="number"
                                  dataKey="x"
                                  domain={[yearTicks[0], yearTicks[yearTicks.length - 1] + 1]}
                                  ticks={yearTicks}
                                  tickFormatter={(v) => `${v}`}
                                  tick={{ fontSize: 11, fill: '#64748b' }}
                                  axisLine={{ stroke: '#cbd5e1' }}
                                  tickLine={{ stroke: '#cbd5e1' }}
                                />
                              )}

                              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={{ stroke: '#cbd5e1' }} />
                              
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (!active || !payload || !payload.length) return null;
                                  const item = payload[0]?.payload;
                                  return (
                                    <div className="bg-white/95 backdrop-blur-xs border border-slate-200/90 shadow-lg rounded-lg px-2.5 py-1.5 text-[11px] min-w-[140px] pointer-events-none z-50">
                                      <div className="font-semibold text-slate-800 pb-1 mb-1 border-b border-slate-100 flex items-center justify-between gap-2">
                                        <span>{item?.formattedDate || item?.name || 'Mốc báo cáo'}</span>
                                        {item?.reportName && (
                                          <span className="text-[10px] font-normal text-slate-400 truncate max-w-[110px]" title={item.reportName}>
                                            {item.reportName}
                                          </span>
                                        )}
                                      </div>
                                      <div className="space-y-0.5">
                                        {payload.map((entry: any, i: number) => {
                                          if (entry.value === undefined || entry.value === null) return null;
                                          return (
                                            <div key={i} className="flex items-center justify-between gap-3">
                                              <div className="flex items-center gap-1.5 text-slate-600">
                                                <span
                                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                                  style={{ backgroundColor: entry.color || entry.stroke || entry.fill }}
                                                />
                                                <span className="text-[10px]">{entry.name}</span>
                                              </div>
                                              <span className="font-bold text-slate-900 text-[11px]">
                                                {formatNumber(Number(entry.value))}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                }}
                              />

                              <Legend
                                content={() => (
                                  <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 pt-2 select-none">
                                    {TREND_SERIES_LIST.map((series) => {
                                      const isVisible = trendSeriesVisibility[series.key];
                                      return (
                                        <button
                                          key={series.key}
                                          type="button"
                                          onClick={() => toggleTrendSeries(series.key)}
                                          className={`inline-flex items-center gap-1.5 text-[11px] font-medium transition-opacity cursor-pointer ${
                                            isVisible
                                              ? 'text-slate-700 hover:text-slate-900 opacity-100'
                                              : 'text-slate-400 line-through opacity-40'
                                          }`}
                                          title={isVisible ? `Nhấn để ẩn "${series.name}"` : `Nhấn để hiện "${series.name}"`}
                                        >
                                          <span
                                            className="inline-block w-2 h-2 rounded-full shrink-0"
                                            style={{ backgroundColor: series.color }}
                                          />
                                          <span>{series.name}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              />

                              {trendSeriesVisibility.received && (
                                <Area
                                  type="monotone"
                                  dataKey="received"
                                  name="Tổng tiếp nhận"
                                  stroke="#3b82f6"
                                  strokeWidth={2.5}
                                  fillOpacity={1}
                                  fill="url(#colorRec)"
                                  dot={{ r: 5, fill: '#3b82f6', stroke: '#ffffff', strokeWidth: 2 }}
                                  activeDot={{ r: 7, fill: '#1d4ed8', stroke: '#ffffff', strokeWidth: 2 }}
                                />
                              )}
                              {trendSeriesVisibility.resolved && (
                                <Area
                                  type="monotone"
                                  dataKey="resolved"
                                  name="Đã giải quyết"
                                  stroke="#10b981"
                                  strokeWidth={2.5}
                                  fillOpacity={1}
                                  fill="url(#colorSolv)"
                                  dot={{ r: 5, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                                  activeDot={{ r: 7, fill: '#047857', stroke: '#ffffff', strokeWidth: 2 }}
                                />
                              )}
                              {trendSeriesVisibility.pending && (
                                <Line
                                  type="monotone"
                                  dataKey="pending"
                                  name="Đang xử lý (Tồn)"
                                  stroke="#f59e0b"
                                  strokeWidth={2}
                                  strokeDasharray="4 4"
                                  dot={{ r: 4.5, fill: '#f59e0b', stroke: '#ffffff', strokeWidth: 2 }}
                                  activeDot={{ r: 6.5, fill: '#d97706', stroke: '#ffffff', strokeWidth: 2 }}
                                />
                              )}
                              {trendSeriesVisibility.pendingLate && (
                                <Line
                                  type="monotone"
                                  dataKey="pendingLate"
                                  name="Đang giải quyết quá hạn"
                                  stroke="#ef4444"
                                  strokeWidth={2.5}
                                  strokeDasharray="3 3"
                                  dot={{ r: 4.5, fill: '#ef4444', stroke: '#ffffff', strokeWidth: 2 }}
                                  activeDot={{ r: 6.5, fill: '#b91c1c', stroke: '#ffffff', strokeWidth: 2 }}
                                />
                              )}
                              {trendSeriesVisibility.resolvedLate && (
                                <Line
                                  type="monotone"
                                  dataKey="resolvedLate"
                                  name="Đã giải quyết trễ hạn"
                                  stroke="#b91c1c"
                                  strokeWidth={2.5}
                                  dot={{ r: 4.5, fill: '#b91c1c', stroke: '#ffffff', strokeWidth: 2 }}
                                  activeDot={{ r: 6.5, fill: '#7f1d1d', stroke: '#ffffff', strokeWidth: 2 }}
                                />
                              )}
                            </AreaChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </>
                  )}

                  {chart.id === 'quality' && (
                    <>
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-sm font-bold text-slate-900">
                              {getChartTitle('quality', '2. Cơ cấu chất lượng giải quyết (QĐ 766)')}
                            </h3>
                            {canManageLayout && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal('quality')}
                                className="inline-flex items-center justify-center p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer shrink-0"
                                title="Chỉnh sửa Tiêu đề & Chú thích biểu đồ"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {getChartSubtitle('quality', 'Tỷ trọng Trước hạn, Đúng hạn và Quá hạn (Chỉ tiêu đúng hạn > 95%)')}
                          </p>
                        </div>
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
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-sm font-bold text-slate-900">
                              {getChartTitle('channels', '3. Cơ cấu kênh tiếp nhận Dịch vụ công')}
                            </h3>
                            {canManageLayout && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal('channels')}
                                className="inline-flex items-center justify-center p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer shrink-0"
                                title="Chỉnh sửa Tiêu đề & Chú thích biểu đồ"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {getChartSubtitle('channels', 'Đo lường mức độ hồ sơ nộp trực tuyến')}
                          </p>
                        </div>
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
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-sm font-bold text-slate-900">
                              {getChartTitle('ranking', '4. Xếp hạng hiệu năng giải quyết Đơn vị')}
                            </h3>
                            {canManageLayout && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal('ranking')}
                                className="inline-flex items-center justify-center p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer shrink-0"
                                title="Chỉnh sửa Tiêu đề & Chú thích biểu đồ"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {getChartSubtitle('ranking', 'So sánh tổng khối lượng hồ sơ và tỷ lệ đúng hạn của từng đơn vị')}
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
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                              {getChartTitle('thematic_pending', 'TỔNG HỢP TIẾN ĐỘ HỒ SƠ ĐANG GIẢI QUYẾT')}
                            </h3>
                            {canManageLayout && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal('thematic_pending')}
                                className="inline-flex items-center justify-center p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer shrink-0"
                                title="Chỉnh sửa Tiêu đề & Chú thích biểu đồ"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {getChartSubtitle('thematic_pending', 'Phân bổ cơ cấu hồ sơ đang xử lý: Đang giải quyết Trong hạn & Đang giải quyết Quá hạn')} ({presentationDimension === 'unit' ? 'theo Đơn vị' : 'theo Lĩnh vực'})
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
                          <BarChart data={pendingPresentationData} margin={{ top: 25, right: 10, left: 10, bottom: 25 }}>
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
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                              {getChartTitle('thematic_received', 'TỔNG HỢP SỐ LƯỢNG HỒ SƠ ĐÃ TIẾP NHẬN')}
                            </h3>
                            {canManageLayout && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal('thematic_received')}
                                className="inline-flex items-center justify-center p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer shrink-0"
                                title="Chỉnh sửa Tiêu đề & Chú thích biểu đồ"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {getChartSubtitle('thematic_received', 'Phân bổ cơ cấu hình thức tiếp nhận: Trực tuyến & Trực tiếp')} ({presentationDimension === 'unit' ? 'theo Đơn vị' : 'theo Lĩnh vực'})
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
                          <BarChart data={receivedPresentationData} margin={{ top: 25, right: 10, left: 10, bottom: 25 }}>
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
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                              {getChartTitle('thematic_completed', 'TỔNG HỢP SỐ LƯỢNG HỒ SƠ ĐÃ GIẢI QUYẾT')}
                            </h3>
                            {canManageLayout && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal('thematic_completed')}
                                className="inline-flex items-center justify-center p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer shrink-0"
                                title="Chỉnh sửa Tiêu đề & Chú thích biểu đồ"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {getChartSubtitle('thematic_completed', 'Phân bổ cơ cấu kết quả xử lý: Đúng hạn & Trước hạn vs Trễ hạn (Quá hạn)')} ({presentationDimension === 'unit' ? 'theo Đơn vị' : 'theo Lĩnh vực'})
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
                          <BarChart data={completedPresentationData} margin={{ top: 25, right: 10, left: 10, bottom: 25 }}>
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

      {/* 5. DETAILED STATISTICAL GRAIN GRID (REPORT + SOURCE + FIELD) - Only for authenticated users */}
      {isAuthenticated && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs space-y-0">
          {/* Header with Title, Subtitle, and Admin Edit Button */}
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-slate-900">
                    {getChartTitle('detailed_table', 'Chi tiết số liệu thống kê')}
                  </h3>
                  {canManageLayout && (
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal('detailed_table')}
                      className="inline-flex items-center justify-center p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer shrink-0"
                      title="Chỉnh sửa Tiêu đề & Chú thích bảng số liệu"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {getChartSubtitle('detailed_table', 'Thống kê chi tiết tình hình tiếp nhận và giải quyết hồ sơ thủ tục hành chính')}
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                <span className="text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs">
                  Hiển thị: <strong className="text-blue-700">{processedTableRows.length}</strong> / {filteredStats.length} dòng
                </span>
              </div>
            </div>

            {/* Toolbar: Search, Group by Source, Filter by Source, Filter by Status */}
            <div className="mt-4 pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                {/* Search input */}
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={tableSearchQuery}
                    onChange={(e) => setTableSearchQuery(e.target.value)}
                    placeholder="Tìm theo lĩnh vực, đơn vị, nguồn..."
                    className="w-full pl-8 pr-8 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                  />
                  {tableSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setTableSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter by Source dropdown */}
                <div className="relative flex items-center">
                  <select
                    value={tableSourceFilter}
                    onChange={(e) => setTableSourceFilter(e.target.value)}
                    className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                  >
                    <option value="ALL">Tất cả Nguồn</option>
                    {liveSources.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.source_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter by Data Presence */}
                <button
                  type="button"
                  onClick={() => setTableOnlyWithData(!tableOnlyWithData)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                    tableOnlyWithData
                      ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Filter className="w-3 h-3" />
                  Chỉ dòng có số liệu
                </button>

                {/* Validity filter */}
                <div className="flex bg-slate-200/70 p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setTableValidityFilter('ALL')}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                      tableValidityFilter === 'ALL' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tất cả
                  </button>
                  <button
                    type="button"
                    onClick={() => setTableValidityFilter('VALID')}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                      tableValidityFilter === 'VALID' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Hợp lệ
                  </button>
                  <button
                    type="button"
                    onClick={() => setTableValidityFilter('INVALID')}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                      tableValidityFilter === 'INVALID' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Có lỗi
                  </button>
                </div>
              </div>

              {/* Group By Source Toggle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTableGroupBySource(!tableGroupBySource)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    tableGroupBySource
                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Nhóm theo Nguồn
                </button>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-bold text-[10px] select-none">
                <tr>
                  <th
                    onClick={() => handleTableSort('field')}
                    className="px-3.5 py-3 hover:bg-slate-100/80 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Lĩnh vực & Đơn vị</span>
                      {tableSortKey === 'field' ? (
                        tableSortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      )}
                    </div>
                  </th>

                  <th
                    onClick={() => handleTableSort('source')}
                    className="px-3.5 py-3 hover:bg-slate-100/80 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Nguồn</span>
                      {tableSortKey === 'source' ? (
                        tableSortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      )}
                    </div>
                  </th>

                  <th
                    onClick={() => handleTableSort('received_total')}
                    className="px-3.5 py-3 text-right hover:bg-slate-100/80 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Tiếp nhận (Tổng)</span>
                      {tableSortKey === 'received_total' ? (
                        tableSortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      )}
                    </div>
                  </th>

                  <th
                    onClick={() => handleTableSort('received_online')}
                    className="px-3.5 py-3 text-right hover:bg-slate-100/80 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Online / Trực tiếp</span>
                      {tableSortKey === 'received_online' ? (
                        tableSortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      )}
                    </div>
                  </th>

                  <th
                    onClick={() => handleTableSort('carried_forward')}
                    className="px-3.5 py-3 text-right hover:bg-slate-100/80 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Kỳ trước</span>
                      {tableSortKey === 'carried_forward' ? (
                        tableSortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      )}
                    </div>
                  </th>

                  <th
                    onClick={() => handleTableSort('completed_total')}
                    className="px-3.5 py-3 text-right hover:bg-slate-100/80 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Đã giải quyết</span>
                      {tableSortKey === 'completed_total' ? (
                        tableSortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      )}
                    </div>
                  </th>

                  <th
                    onClick={() => handleTableSort('completed_on_time')}
                    className="px-3.5 py-3 text-right hover:bg-slate-100/80 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Trước / Đúng / Trễ</span>
                      {tableSortKey === 'completed_on_time' ? (
                        tableSortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      )}
                    </div>
                  </th>

                  <th
                    onClick={() => handleTableSort('pending_total')}
                    className="px-3.5 py-3 text-right hover:bg-slate-100/80 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Đang giải quyết</span>
                      {tableSortKey === 'pending_total' ? (
                        tableSortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      )}
                    </div>
                  </th>

                  <th
                    onClick={() => handleTableSort('pending_late')}
                    className="px-3.5 py-3 text-right hover:bg-slate-100/80 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Trong hạn / Trễ</span>
                      {tableSortKey === 'pending_late' ? (
                        tableSortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      )}
                    </div>
                  </th>

                  <th
                    onClick={() => handleTableSort('validity')}
                    className="px-3.5 py-3 text-center hover:bg-slate-100/80 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Kiểm chứng</span>
                      {tableSortKey === 'validity' ? (
                        tableSortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      )}
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 font-medium">
                {/* Empty State */}
                {processedTableRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      <div className="max-w-xs mx-auto space-y-2">
                        <Filter className="w-8 h-8 text-slate-300 mx-auto" />
                        <div className="text-xs font-semibold text-slate-700">Không tìm thấy số liệu phù hợp</div>
                        <p className="text-[11px] text-slate-400">Hãy thử xóa bộ lọc tìm kiếm để xem toàn bộ danh sách</p>
                        <button
                          type="button"
                          onClick={() => {
                            setTableSearchQuery('');
                            setTableSourceFilter('ALL');
                            setTableValidityFilter('ALL');
                            setTableOnlyWithData(false);
                          }}
                          className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                        >
                          Xóa tất cả bộ lọc
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {/* When Group By Source is ENABLED */}
                {tableGroupBySource && groupedTableRows && groupedTableRows.map((group) => (
                  <React.Fragment key={group.sourceId}>
                    {/* Group Header Row */}
                    <tr className="bg-slate-100/90 border-y border-slate-200">
                      <td colSpan={10} className="px-3.5 py-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-600 text-white font-bold text-xs shadow-2xs">
                              <Layers className="w-3.5 h-3.5" />
                              Nguồn: {group.sourceName}
                            </span>
                            <span className="text-xs font-semibold text-slate-600">
                              ({group.rows.length} lĩnh vực)
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-700">
                            <span>
                              Tiếp nhận: <strong className="text-slate-900">{formatNumber(group.totals.received_total)}</strong>
                              <span className="text-blue-600 font-normal ml-1">(Online: {formatNumber(group.totals.received_online)})</span>
                            </span>
                            <span className="text-slate-300">|</span>
                            <span>
                              Đã GQ: <strong className="text-emerald-700">{formatNumber(group.totals.completed_total)}</strong>
                            </span>
                            <span className="text-slate-300">|</span>
                            <span>
                              Đang GQ: <strong className="text-indigo-700">{formatNumber(group.totals.pending_total)}</strong>
                              {group.totals.pending_late > 0 && (
                                <span className="text-rose-600 font-bold ml-1">
                                  (Quá hạn: {formatNumber(group.totals.pending_late)})
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Group Rows */}
                    {group.rows.map((row) => (
                      <tr key={row.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="px-3.5 py-2.5 pl-6">
                          <div className="font-bold text-slate-900 text-xs leading-snug">{row.displayName}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{row.unitName}</div>
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-600 font-medium">
                          {row.sourceName}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-bold text-slate-900">
                          {formatNumber(row.received_total)}
                        </td>
                        <td className="px-3.5 py-2.5 text-right text-blue-600 font-medium">
                          {formatNumber(row.received_online)} / {formatNumber(row.received_offline)}
                        </td>
                        <td className="px-3.5 py-2.5 text-right text-slate-500">
                          {formatNumber(row.carried_forward)}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-bold text-emerald-600">
                          {formatNumber(row.completed_total)}
                        </td>
                        <td className="px-3.5 py-2.5 text-right text-slate-600">
                          {formatNumber(row.completed_early)} / {formatNumber(row.completed_on_time)} / {row.completed_late > 0 ? (
                            <span className="text-rose-600 font-bold">{row.completed_late}</span>
                          ) : (
                            0
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-bold text-indigo-600">
                          {formatNumber(row.pending_total)}
                        </td>
                        <td className="px-3.5 py-2.5 text-right text-slate-600">
                          {formatNumber(row.pending_on_time)} / {row.pending_late > 0 ? (
                            <span className="text-rose-600 font-bold">{row.pending_late}</span>
                          ) : (
                            0
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-center">
                          {row.validation.allPassed ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                              <Check className="w-3 h-3 text-emerald-700" />
                              Hợp lệ
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded" title={row.validation.errorMessages.join('\n')}>
                              Lỗi
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}

                {/* When Group By Source is DISABLED (Flat list) */}
                {!tableGroupBySource && processedTableRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3.5 py-2.5">
                      <div className="font-bold text-slate-900 text-xs leading-snug">{row.displayName}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{row.unitName}</div>
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-600">
                      {row.sourceName}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-slate-900">
                      {formatNumber(row.received_total)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right text-blue-600">
                      {formatNumber(row.received_online)} / {formatNumber(row.received_offline)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right text-slate-500">
                      {formatNumber(row.carried_forward)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-emerald-600">
                      {formatNumber(row.completed_total)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right text-slate-600">
                      {formatNumber(row.completed_early)} / {formatNumber(row.completed_on_time)} / {row.completed_late > 0 ? (
                        <span className="text-rose-600 font-bold">{row.completed_late}</span>
                      ) : (
                        0
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-indigo-600">
                      {formatNumber(row.pending_total)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right text-slate-600">
                      {formatNumber(row.pending_on_time)} / {row.pending_late > 0 ? (
                        <span className="text-rose-600 font-bold">{row.pending_late}</span>
                      ) : (
                        0
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      {row.validation.allPassed ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                          <Check className="w-3 h-3 text-emerald-700" />
                          Hợp lệ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded" title={row.validation.errorMessages.join('\n')}>
                          Lỗi
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. MODAL CHỈNH SỬA TIÊU ĐỀ & CHÚ THÍCH BIỂU ĐỒ (DÀNH CHO QUẢN TRỊ VIÊN) */}
      {editingChartMeta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl shadow-2xs">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Chỉnh sửa Tiêu đề & Chú thích Biểu đồ
                  </h3>
                  <p className="text-xs text-slate-500">
                    Quản trị viên tùy biến nội dung hiển thị của biểu đồ trên báo cáo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingChartMeta(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tiêu đề biểu đồ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingChartMeta.title}
                  onChange={(e) => setEditingChartMeta({ ...editingChartMeta, title: e.target.value })}
                  placeholder="Nhập tiêu đề hiển thị cho biểu đồ..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Phần chú thích / Giải thích biểu đồ
                </label>
                <textarea
                  rows={3}
                  value={editingChartMeta.subtitle}
                  onChange={(e) => setEditingChartMeta({ ...editingChartMeta, subtitle: e.target.value })}
                  placeholder="Nhập mô tả, phần chú thích hoặc căn cứ pháp lý cho biểu đồ..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-normal text-slate-800 resize-none"
                />
              </div>

              <div className="bg-blue-50/80 border border-blue-200/70 rounded-xl p-3 text-xs text-blue-800 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  Thay đổi sẽ được áp dụng ngay lập tức và tự động lưu đồng bộ vào cấu hình hệ thống cho tất cả người dùng.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/70">
              <button
                type="button"
                onClick={handleResetCurrentChartMeta}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                title="Khôi phục tiêu đề và chú thích gốc của biểu đồ này"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Khôi phục mặc định
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingChartMeta(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveChartMeta}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
