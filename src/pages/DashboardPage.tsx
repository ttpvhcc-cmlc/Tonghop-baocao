import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { store, Profile, sortReportsByPeriodEndDesc, DEFAULT_TABLE_HEADERS } from '../services/store';
import { dossierUrgeStore } from '../services/dossierUrgeStore';
import { formatNumber, formatPercent, formatRatePercent, getStatusBadge } from '../utils/format';
import { resolveLinhVuc } from '../utils/fieldResolver';
import {
  calcCompletionRate,
  calcOnTimeRate,
  calcLateRate,
  calcPendingLateRate,
  calcOverdueRateQD776,
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
  Save,
  LayoutGrid,
  Pencil,
  X,
  CheckCircle2,
  ArrowUpDown,
  Layers,
  Filter,
  Search,
  SlidersHorizontal,
  FolderKanban,
  Tv,
  Printer,
  BookOpen,
  Info,
  BellRing,
  Building2,
  PhoneCall,
  Users
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { DossierUrgeRecord } from '../types/dossierUrge';

interface ChartConfig {
  id: string;
  title: string;
  subtitle?: string;
  width: 'half' | 'full';
  order: number;
  visible: boolean;
  widthPercent?: number;
  height?: number;
  customOptions?: Record<string, any>;
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
    title: '2. Cơ cấu chất lượng giải quyết (TT 01 vs QĐ 766)',
    subtitle: 'So sánh cơ cấu chất lượng theo Thông tư 01 (Đã giải quyết) và Quyết định 766 (Toàn diện hệ thống)',
    width: 'half',
    widthPercent: 49,
    height: 420,
    order: 1,
    visible: true,
    customOptions: {
      viewMode: 'both',
      tt01Header: 'Thông tư 01/2018 (Đã giải quyết)',
      qd766Header: 'Quyết định 766 (Toàn diện hệ thống)',
      tt01EarlyName: 'Đã GQ trước hạn',
      tt01EarlyColor: '#10b981',
      tt01OnTimeName: 'Đã GQ đúng hạn',
      tt01OnTimeColor: '#0ea5e9',
      tt01LateName: 'Đã GQ quá hạn',
      tt01LateColor: '#f43f5e',
      qd766EarlyName: 'Đã GQ trước hạn',
      qd766EarlyColor: '#10b981',
      qd766OnTimeName: 'Đã GQ đúng hạn',
      qd766OnTimeColor: '#0ea5e9',
      qd766PendingInTermName: 'Đang GQ trong hạn',
      qd766PendingInTermColor: '#f59e0b',
      qd766OverdueName: 'Đã GQ quá hạn + Đang GQ trễ hạn',
      qd766OverdueColor: '#ef4444',
      chartNote: '',
    },
  },
  {
    id: 'ranking',
    title: '4. Xếp hạng hiệu năng giải quyết Đơn vị',
    subtitle: 'So sánh tổng khối lượng hồ sơ và tỷ lệ đúng hạn của từng đơn vị',
    width: 'half',
    widthPercent: 49,
    height: 420,
    order: 2,
    visible: true,
    customOptions: {
      tab1Label: 'Đối chiếu 2 cách tính',
      tab2Label: 'QĐ 766 (Toàn diện)',
      tab3Label: 'TT 01 (Đã giải quyết)',
      chartNote: '',
      compBarName: 'Đã giải quyết trước + đúng hạn (hồ sơ)',
      compBarColor: '#10b981',
      qd766BarName: 'Đã giải quyết đúng hạn theo cách tính của 766',
      qd766BarColor: '#3b82f6',
      onTimeLineName: 'Tỷ lệ đúng hạn TT 01 (%)',
      onTimeLineColor: '#e11d48',
      qd766LineName: 'Tỷ lệ theo QĐ 766 (%)',
      qd766LineColor: '#2563eb',
      qd766TabOnTimeBarName: 'Đạt chuẩn hạn theo QĐ 766',
      qd766TabOnTimeBarColor: '#2563eb',
      qd766TabOverdueBarName: 'Tổng quá hạn (Đã trễ + Đang trễ)',
      qd766TabOverdueBarColor: '#ef4444',
      qd766TabLineName: 'Tỷ lệ đúng hạn QĐ 766 (%)',
      qd766TabLineColor: '#2563eb',
      tt01TabOnTimeBarName: 'Đã giải quyết Đúng & Trước hạn',
      tt01TabOnTimeBarColor: '#10b981',
      tt01TabLateBarName: 'Đã giải quyết Quá hạn',
      tt01TabLateBarColor: '#f43f5e',
      tt01TabLineName: 'Tỷ lệ đúng hạn TT 01 (%)',
      tt01TabLineColor: '#059669',
      showCompBar: true,
      showQd766Bar: true,
      showOnTimeLine: true,
      showQd766Line: true,
      showRefLine: false,
      refLineValue: 95,
      refLineLabel: '',
      refLineColor: '#f43f5e',
      qd766CalcMode: 'standard',
    },
  },
  {
    id: 'thematic_pending',
    title: 'TỔNG HỢP TIẾN ĐỘ HỒ SƠ ĐANG GIẢI QUYẾT',
    subtitle: 'Phân bổ cơ cấu hồ sơ đang xử lý: Đang giải quyết Trong hạn và Đang giải quyết Quá hạn',
    width: 'full',
    widthPercent: 100,
    height: 480,
    order: 4,
    visible: true,
  },
  {
    id: 'thematic_received',
    title: 'TỔNG HỢP SỐ LƯỢNG HỒ SƠ ĐÃ TIẾP NHẬN',
    subtitle: 'Phân bổ cơ cấu hình thức tiếp nhận: Trực tuyến và Trực tiếp',
    width: 'full',
    widthPercent: 100,
    height: 480,
    order: 5,
    visible: true,
  },
  {
    id: 'thematic_completed',
    title: 'TỔNG HỢP SỐ LƯỢNG HỒ SƠ ĐÃ GIẢI QUYẾT',
    subtitle: 'Phân bổ cơ cấu kết quả xử lý: Đúng hạn và Trước hạn vs Trễ hạn (Quá hạn)',
    width: 'full',
    widthPercent: 100,
    height: 480,
    order: 6,
    visible: true,
  },
  {
    id: 'urge_statistics',
    title: '5. Thống kê tình hình Đôn đốc hồ sơ theo Đơn vị chủ trì',
    subtitle: 'Tổng hợp số lượng phiếu đôn đốc phát sinh trong khoảng thời gian của kỳ báo cáo được chọn',
    width: 'full',
    widthPercent: 100,
    height: 380,
    order: 7,
    visible: true,
  },
  {
    id: 'detailed_table',
    title: 'Chi tiết số liệu thống kê',
    subtitle: 'Thống kê chi tiết tình hình tiếp nhận và giải quyết hồ sơ thủ tục hành chính',
    width: 'full',
    widthPercent: 100,
    height: 480,
    order: 8,
    visible: true,
  },
];

export interface SubCardConfigItem {
  id: string;
  title: string;
  subtitle: string;
}

export interface KpiCardConfigItem {
  id: string; // 'received' | 'resolved' | 'pending' | 'qd766' | 'online'
  title: string;
  subtitle: string;
  visible: boolean;
  order: number;
  subCards?: SubCardConfigItem[];
}

const DEFAULT_KPI_CARDS: KpiCardConfigItem[] = [
  {
    id: 'received',
    title: 'Tổng tiếp nhận',
    subtitle: 'online + tt + trước',
    visible: true,
    order: 1,
    subCards: [
      { id: 'rec_online', title: 'Nộp trực tuyến', subtitle: 'online / tổng' },
      { id: 'rec_offline', title: 'Nộp trực tiếp', subtitle: 'trực tiếp / bưu chính' },
      { id: 'rec_carried', title: 'Từ kỳ trước', subtitle: 'chuyển sang' },
    ],
  },
  {
    id: 'resolved',
    title: 'Đã giải quyết',
    subtitle: 'sớm + đúng + trễ',
    visible: true,
    order: 2,
    subCards: [
      { id: 'comp_ontime', title: 'Đúng hạn', subtitle: 'trước hạn + đúng hạn' },
      { id: 'comp_late', title: 'Quá hạn', subtitle: 'trễ hạn' },
    ],
  },
  {
    id: 'pending',
    title: 'Đang giải quyết',
    subtitle: 'trong hạn + trễ hạn',
    visible: true,
    order: 3,
    subCards: [
      { id: 'pending_interm', title: 'Tồn trong hạn', subtitle: 'trong hạn' },
      { id: 'pending_late', title: 'Tồn quá hạn', subtitle: 'quá hạn' },
    ],
  },
  {
    id: 'qd766',
    title: 'THEO QĐ 766',
    subtitle: 'Đánh giá tỷ lệ đúng hạn QĐ 766',
    visible: true,
    order: 4,
    subCards: [
      { id: 'qd766_ontime_group', title: 'Đã giải quyết trước, đúng hạn + Đang giải quyết trong hạn', subtitle: 'sớm + đúng + tồn trong hạn' },
      { id: 'qd766_late_group', title: 'Đã giải quyết trễ hạn + Đang giải quyết quá hạn', subtitle: 'trễ + tồn quá hạn' },
    ],
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
      customOptions: {
        ...(def.customOptions || {}),
        ...(found.customOptions || {}),
      },
    };
  }).sort((a, b) => a.order - b.order);
};

const mergeWithDefaultKpiCards = (savedKpis?: any[]): KpiCardConfigItem[] => {
  if (!Array.isArray(savedKpis) || savedKpis.length === 0) {
    return DEFAULT_KPI_CARDS;
  }
  return DEFAULT_KPI_CARDS.map((def) => {
    const found = savedKpis.find((s) => s.id === def.id);
    if (!found) return def;
    return {
      ...def,
      ...found,
      title: found.title || def.title,
      subtitle: found.subtitle !== undefined ? found.subtitle : def.subtitle,
      order: found.order ?? def.order,
      visible: found.visible !== undefined ? found.visible : def.visible,
      subCards: def.subCards ? def.subCards.map((defSub) => {
        const foundSub = found.subCards?.find((s: any) =>
          s.id === defSub.id ||
          (defSub.id === 'comp_ontime' && (s.id === 'ontime_rate' || s.title?.includes('Đúng hạn'))) ||
          (defSub.id === 'comp_late' && (s.id === 'overdue_rate' || s.title?.includes('Quá hạn')))
        );
        if (!foundSub) return defSub;
        let title = foundSub.title || defSub.title;
        if (title === 'TL Đúng hạn') title = 'Đúng hạn';
        if (title === 'TL Quá hạn') title = 'Quá hạn';
        return {
          ...defSub,
          ...foundSub,
          title,
          subtitle: foundSub.subtitle !== undefined ? foundSub.subtitle : defSub.subtitle,
        };
      }) : (found.subCards || def.subCards)
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

  const [urges, setUrges] = useState<DossierUrgeRecord[]>([]);

  useEffect(() => {
    const loadUrges = () => {
      setUrges(dossierUrgeStore.getUrges());
    };
    loadUrges();
    return dossierUrgeStore.subscribe(loadUrges);
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
  const [chartViewType, setChartViewType] = useState<'count' | 'percent'>('count');

  // Trend axis granularity ('month' | 'quarter' | 'year') and year selection state
  const [trendGranularity, setTrendGranularity] = useState<'month' | 'quarter' | 'year'>('month');
  const [trendMetricMode, setTrendMetricMode] = useState<'count' | 'rate'>('count');
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
  type TrendSeriesKey = 'received' | 'resolved' | 'resolvedLate' | 'pending' | 'pendingLate';

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
    { key: 'resolved', name: 'Đã giải quyết', color: '#10b981', isArea: true, gradientId: 'colorSolv' },
    { key: 'resolvedLate', name: 'Đã giải quyết trễ hạn', color: '#b91c1c', isArea: false },
    { key: 'pending', name: 'Đang giải quyết', color: '#f59e0b', isArea: false, dash: '4 4' },
    { key: 'pendingLate', name: 'Đang giải quyết quá hạn', color: '#ef4444', isArea: false, dash: '3 3' },
  ];

  const [trendSeriesVisibility, setTrendSeriesVisibility] = useState<Record<TrendSeriesKey, boolean>>({
    received: false,
    resolved: false,
    resolvedLate: true,
    pending: true,
    pendingLate: true,
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
      resolved: visible,
      resolvedLate: visible,
      pending: visible,
      pendingLate: visible,
    });
  };

  // State for Admin Editing Chart Header (Title & Subtitle/Caption, Colors & Series Labels)
  const [editingChartMeta, setEditingChartMeta] = useState<{
    id: string;
    title: string;
    subtitle: string;
    customOptions?: Record<string, any>;
  } | null>(null);

  // Detailed Table State: Sorting, Filtering, Grouping (field | source)
  const [tableSearchQuery, setTableSearchQuery] = useState<string>('');
  const [tableSourceFilter, setTableSourceFilter] = useState<string>('ALL');
  const [tableValidityFilter, setTableValidityFilter] = useState<'ALL' | 'VALID' | 'INVALID'>('ALL');
  const [tableGroupingMode, setTableGroupingMode] = useState<'none' | 'field' | 'source'>('field');
  const [tableRateMode, setTableRateMode] = useState<'overdue' | 'ontime'>('overdue');
  const [tableSortKey, setTableSortKey] = useState<string>('received_total');
  const [tableSortDirection, setTableSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleTableSort = (key: string) => {
    if (tableSortKey === key) {
      setTableSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setTableSortKey(key);
      setTableSortDirection(key === 'field' || key === 'unit' ? 'asc' : 'desc');
    }
  };

  const [isAdminLayoutMode, setIsAdminLayoutMode] = useState<boolean>(false);
  const [resizingChartId, setResizingChartId] = useState<string | null>(null);

  // Chế độ trình diễn xếp hạng đơn vị: 'comparison' (Đối chiếu 2 cách tính), 'qd766' (Toàn diện QĐ 766), 'tt01' (Chỉ Đã giải quyết)
  const [rankingViewMode, setRankingViewMode] = useState<'comparison' | 'qd766' | 'tt01'>('comparison');
  // Modal giải thích chuyên sâu bản chất & công thức 2 cách tính (TT 01 vs QĐ 766)
  const [showMethodologyModal, setShowMethodologyModal] = useState<boolean>(false);

  const [chartsLayout, setChartsLayout] = useState<ChartConfig[]>(DEFAULT_CHARTS_LAYOUT);
  const [kpiCards, setKpiCards] = useState<KpiCardConfigItem[]>(DEFAULT_KPI_CARDS);
  const [editingKpiId, setEditingKpiId] = useState<string | null>(null);
  const [editKpiTitle, setEditKpiTitle] = useState('');
  const [editKpiSubtitle, setEditKpiSubtitle] = useState('');
  const [editSubCards, setEditSubCards] = useState<SubCardConfigItem[]>([]);

  // Detailed Table Headers Configuration (Admin editable)
  const [tableHeaders, setTableHeaders] = useState<Record<string, string>>(() => {
    const cfg = store.getSystemConfig();
    return { ...DEFAULT_TABLE_HEADERS, ...(cfg.tableHeadersConfig || {}) };
  });
  const [isEditingTableHeadersModal, setIsEditingTableHeadersModal] = useState<boolean>(false);
  const [draftTableHeaders, setDraftTableHeaders] = useState<Record<string, string>>({});

  const handleSaveTableHeaders = async (newHeaders: Record<string, string>) => {
    setTableHeaders(newHeaders);
    setIsEditingTableHeadersModal(false);
    try {
      const currentConfig = store.getSystemConfig();
      await store.saveSystemConfig({
        ...currentConfig,
        tableHeadersConfig: newHeaders,
      });
      setSaveStatus({ type: 'success', message: 'Đã lưu cấu hình tiêu đề các cột bảng thành công!' });
      setTimeout(() => setSaveStatus(null), 3500);
    } catch (err: any) {
      console.error('Failed to save table headers', err);
    }
  };

  const handleKpiDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
  };

  const handleKpiDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetId) return;

    const sorted = [...kpiCards].sort((a, b) => a.order - b.order);
    const sourceIdx = sorted.findIndex(c => c.id === sourceId);
    const targetIdx = sorted.findIndex(c => c.id === targetId);

    if (sourceIdx !== -1 && targetIdx !== -1) {
      const [moved] = sorted.splice(sourceIdx, 1);
      sorted.splice(targetIdx, 0, moved);
      sorted.forEach((c, i) => { c.order = i + 1; });
      setKpiCards(sorted);
    }
  };

  const moveKpiCard = (id: string, direction: 'up' | 'down') => {
    const sorted = [...kpiCards].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(c => c.id === id);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;

    const temp = sorted[idx].order;
    sorted[idx].order = sorted[targetIdx].order;
    sorted[targetIdx].order = temp;

    sorted.sort((a, b) => a.order - b.order).forEach((c, i) => { c.order = i + 1; });
    setKpiCards(sorted);
  };

  const toggleKpiVisibility = (id: string) => {
    setKpiCards(prev => prev.map(c => c.id === id ? { ...c, visible: !c.visible } : c));
  };

  const saveKpiEdit = (id: string) => {
    setKpiCards(prev => prev.map(c => {
      if (c.id === id) {
        return {
          ...c,
          title: editKpiTitle,
          subtitle: editKpiSubtitle,
          subCards: editSubCards.length > 0 ? editSubCards : c.subCards
        };
      }
      return c;
    }));
    setEditingKpiId(null);
  };

  const renderKpiAdminToolbar = (card: KpiCardConfigItem) => (
    <div className="absolute top-2 right-2 flex items-center bg-white/95 backdrop-blur-xs border border-slate-200 px-1.5 py-0.5 rounded-lg shadow-sm gap-1 z-10">
      <button onClick={() => moveKpiCard(card.id, 'up')} className="p-0.5 text-slate-500 hover:text-slate-800 cursor-pointer" title="Di chuyển trước"><ArrowUp className="w-3 h-3" /></button>
      <button onClick={() => moveKpiCard(card.id, 'down')} className="p-0.5 text-slate-500 hover:text-slate-800 cursor-pointer" title="Di chuyển sau"><ArrowDown className="w-3 h-3" /></button>
      <button onClick={() => {
        setEditingKpiId(card.id);
        setEditKpiTitle(card.title);
        setEditKpiSubtitle(card.subtitle);
        const defCard = DEFAULT_KPI_CARDS.find(d => d.id === card.id);
        const activeSubCards = (card.subCards && card.subCards.length > 0) ? card.subCards : (defCard?.subCards || []);
        setEditSubCards(JSON.parse(JSON.stringify(activeSubCards)));
      }} className="p-0.5 text-blue-600 hover:text-blue-800 cursor-pointer" title="Tùy chỉnh tiêu đề và chú thích"><Pencil className="w-3 h-3" /></button>
      <button onClick={() => toggleKpiVisibility(card.id)} className={`p-0.5 cursor-pointer ${card.visible ? 'text-blue-600' : 'text-rose-500'}`} title={card.visible ? 'Ẩn' : 'Hiện'}>
        {card.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
      </button>
    </div>
  );

  const handleOpenEditModal = (chartId: string) => {
    const chart = chartsLayout.find(c => c.id === chartId);
    const def = DEFAULT_CHARTS_LAYOUT.find(c => c.id === chartId);
    setEditingChartMeta({
      id: chartId,
      title: chart?.title || def?.title || '',
      subtitle: chart?.subtitle !== undefined ? chart.subtitle : (def?.subtitle || ''),
      customOptions: {
        ...(def?.customOptions || {}),
        ...(chart?.customOptions || {}),
      },
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
          customOptions: editingChartMeta.customOptions || c.customOptions || {},
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
      setSaveStatus({ type: 'success', message: 'Đã cập nhật tiêu đề, chú giải và màu sắc biểu đồ thành công!' });
      setTimeout(() => setSaveStatus(null), 3500);
    } catch (e) {
      console.error('Failed to auto-save chart meta', e);
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

  // Custom Leader Line ("Râu" chỉ dẫn chú thích) for Pie/Donut Charts
  const renderPieLeaderLine = (props: any) => {
    const { cx, cy, midAngle, outerRadius, percent, value, name, payload, fill } = props;
    if (!value || value === 0 || (percent !== undefined && percent < 0.005)) return null;

    const RADIAN = Math.PI / 180;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    
    // Starting anchor on donut outer boundary
    const sx = cx + (outerRadius + 2) * cos;
    const sy = cy + (outerRadius + 2) * sin;
    
    // Elbow point
    const mx = cx + (outerRadius + 8) * cos;
    const my = cy + (outerRadius + 8) * sin;
    
    // Horizontal shelf extension (compact to never overflow SVG container)
    const isRight = cos >= 0;
    const ex = mx + (isRight ? 8 : -8);
    const ey = my;
    const textAnchor = isRight ? 'start' : 'end';

    const labelColor = payload?.color || fill || '#1e293b';
    const pctStr = percent !== undefined ? `${(percent * 100).toFixed(1)}%` : '';

    // Shortened, neat name on the leader line so it never clips off screen
    let labelText = name;
    if (name.includes('trước hạn')) labelText = 'Trước hạn';
    else if (name.includes('đúng hạn') && !name.includes('trước')) labelText = 'Đúng hạn';
    else if (name.includes('quá hạn') || name.includes('trễ')) labelText = 'Quá hạn';
    else if (name.includes('trong hạn')) labelText = 'Trong hạn';

    return (
      <g className="select-none pointer-events-none">
        {/* Điểm neo tròn ở vành biểu đồ */}
        <circle cx={sx} cy={sy} r={2} fill={labelColor} />
        {/* Râu chỉ thị đường gập khúc (Leader Line) */}
        <path
          d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
          stroke={labelColor}
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.9}
        />
        {/* Chú thích Tên gọn & Tỷ lệ % - Sử dụng màu chuẩn của lát bánh */}
        <text
          x={ex + (isRight ? 3 : -3)}
          y={ey}
          textAnchor={textAnchor}
          dominantBaseline="central"
          fill={labelColor}
          style={{ fontSize: '10px', fontWeight: 700 }}
        >
          {labelText}: {pctStr}
        </text>
      </g>
    );
  };

  // Custom Horizontal Legend for Quality Charts with exact left-to-right priority and matching font colors
  const renderQualityLegend = (data: Array<{ name: string; value: number; color: string }>) => {
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1 pt-2 pb-0.5 select-none">
        {data.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1.5 shrink-0">
            <span
              className="w-2.5 h-2.5 rounded-xs shrink-0 shadow-2xs"
              style={{ backgroundColor: item.color }}
            />
            <span
              className="text-[11px] font-bold tracking-tight"
              style={{ color: item.color }}
            >
              {item.name} <span className="font-extrabold">({formatNumber(item.value)})</span>
            </span>
          </div>
        ))}
      </div>
    );
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

  const saveLayoutToAllUsers = async () => {
    setIsSavingLayout(true);
    setSaveStatus(null);
    try {
      const currentConfig = store.getSystemConfig();
      const updatedConfig = {
        ...currentConfig,
        chartsLayout: chartsLayout,
        kpiCardsLayout: kpiCards,
        trendHistoryLimit: trendHistoryLimit,
      };
      
      const res = await store.saveSystemConfig(updatedConfig);
      if (res.success) {
        setSaveStatus({ type: 'success', message: 'Đã áp dụng và đồng bộ bố cục thành công!' });
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

      const sortedReps = sortReportsByPeriodEndDesc(res.reports);
      setLiveReports(sortedReps);
      setLiveUnits(res.units);
      setLiveFields(res.fields);

      setLiveSources(res.sources);
      setLiveStats(res.statistics);
      setAllPeriodStats(res.allPeriodStatistics || []);

      if (!selectedReportId && res.currentReport) {
        setSelectedReportId(res.currentReport.id);
      } else if (!selectedReportId && sortedReps.length > 0) {
        setSelectedReportId(sortedReps[0].id);
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
    if (initialConfig.kpiCardsLayout && Array.isArray(initialConfig.kpiCardsLayout) && initialConfig.kpiCardsLayout.length > 0) {
      setKpiCards(mergeWithDefaultKpiCards(initialConfig.kpiCardsLayout));
    }
    if (initialConfig.trendHistoryLimit) {
      setTrendHistoryLimit(initialConfig.trendHistoryLimit);
    }
    if (initialConfig.tableHeadersConfig) {
      setTableHeaders({ ...DEFAULT_TABLE_HEADERS, ...initialConfig.tableHeadersConfig });
    }

    const unsub = store.subscribe(() => {
      loadData();

      // Also update layout if another user / tab modified system_config
      const currentConfig = store.getSystemConfig();
      if (currentConfig.chartsLayout && Array.isArray(currentConfig.chartsLayout) && currentConfig.chartsLayout.length > 0) {
        setChartsLayout(mergeWithDefaultCharts(currentConfig.chartsLayout));
      }
      if (currentConfig.kpiCardsLayout && Array.isArray(currentConfig.kpiCardsLayout) && currentConfig.kpiCardsLayout.length > 0) {
        setKpiCards(mergeWithDefaultKpiCards(currentConfig.kpiCardsLayout));
      }
      if (currentConfig.trendHistoryLimit) {
        setTrendHistoryLimit(currentConfig.trendHistoryLimit);
      }
      if (currentConfig.tableHeadersConfig) {
        setTableHeaders({ ...DEFAULT_TABLE_HEADERS, ...currentConfig.tableHeadersConfig });
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
    const pendingRate = recTotal > 0 ? Number(((pendTotal / recTotal) * 100).toFixed(1)) : 0;
    const pendingLateRate = calcPendingLateRate(pendLate, pendTotal);
    const qd776OverdueRate = calcOverdueRateQD776(compLate, pendLate, recTotal);
    const pendingOnTimeRate = calcPendingRate(pendOnTime, pendTotal);
    const qd766OnTimeRate = recTotal > 0 ? Number((((compEarly + compOnTime + pendOnTime) / recTotal) * 100).toFixed(2)) : 100;

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
      pendInTerm: pendOnTime,
      onlineRate,
      completionRate,
      onTimeRate,
      overdueRate,
      pendingRate,
      pendingLateRate,
      qd776OverdueRate,
      pendingOnTimeRate,
      qd766OnTimeRate,
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

      const recRate = rec > 0 ? 100 : 0;
      const compRate = rec > 0 ? Math.round((comp / rec) * 1000) / 10 : 0;
      const compLateRate = comp > 0 ? Math.round((compLate / comp) * 1000) / 10 : (rec > 0 ? Math.round((compLate / rec) * 1000) / 10 : 0);
      const pendRate = rec > 0 ? Math.round((pend / rec) * 1000) / 10 : 0;
      const pendLateRate = pend > 0 ? Math.round((pendLate / pend) * 1000) / 10 : (rec > 0 ? Math.round((pendLate / rec) * 1000) / 10 : 0);

      return {
        code: rep.report_code,
        name: formattedDate || rep.report_name,
        formattedDate,
        reportName: rep.report_name,
        year,
        month,
        day,
        x,
        received: trendMetricMode === 'rate' ? recRate : rec,
        resolved: trendMetricMode === 'rate' ? compRate : comp,
        pending: trendMetricMode === 'rate' ? pendRate : pend,
        pendingLate: trendMetricMode === 'rate' ? pendLateRate : pendLate,
        resolvedLate: trendMetricMode === 'rate' ? compLateRate : compLate,
        rawReceived: rec,
        rawResolved: comp,
        rawPending: pend,
        rawPendingLate: pendLate,
        rawResolvedLate: compLate,
        sortKey: new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`).getTime() || 0,
      };
    });

    // Sort chronologically
    processed.sort((a, b) => a.x - b.x);
    return processed;
  }, [liveReports, allPeriodStats, trendGranularity, trendMetricMode, selectedTrendYear, selectedUnitId, selectedSourceId, selectedFieldId, liveFields]);

  // Chart 2: Quality & Resolution distribution (TT 01 vs QĐ 766)
  const qualityChartConfig = useMemo(() => {
    return chartsLayout.find((c) => c.id === 'quality');
  }, [chartsLayout]);

  const qualityOptions = useMemo(() => {
    const defaultOpts = {
      viewMode: 'both',
      tt01Header: 'Thông tư 01/2018 (Đã giải quyết)',
      qd766Header: 'Quyết định 766 (Toàn diện hệ thống)',
      tt01EarlyName: 'Đã GQ trước hạn',
      tt01EarlyColor: '#10b981',
      tt01OnTimeName: 'Đã GQ đúng hạn',
      tt01OnTimeColor: '#0ea5e9',
      tt01LateName: 'Đã GQ quá hạn',
      tt01LateColor: '#f43f5e',
      qd766EarlyName: 'Đã GQ trước hạn',
      qd766EarlyColor: '#10b981',
      qd766OnTimeName: 'Đã GQ đúng hạn',
      qd766OnTimeColor: '#0ea5e9',
      qd766PendingInTermName: 'Đang GQ trong hạn',
      qd766PendingInTermColor: '#f59e0b',
      qd766OverdueName: 'Đã GQ quá hạn + Đang GQ trễ hạn',
      qd766OverdueColor: '#ef4444',
      chartNote: '',
    };
    return {
      ...defaultOpts,
      ...(qualityChartConfig?.customOptions || {}),
    };
  }, [qualityChartConfig]);

  // Resolution distribution TT 01 (Đã giải quyết) - Sắp xếp theo thứ tự: Trước hạn -> Đúng hạn -> Quá hạn
  const qualityTt01Data = useMemo(() => {
    return [
      { name: qualityOptions.tt01EarlyName || 'Đã GQ trước hạn', value: totals.compEarly, color: qualityOptions.tt01EarlyColor || '#10b981' },
      { name: qualityOptions.tt01OnTimeName || 'Đã GQ đúng hạn', value: totals.compOnTime, color: qualityOptions.tt01OnTimeColor || '#0ea5e9' },
      { name: qualityOptions.tt01LateName || 'Đã GQ quá hạn', value: totals.compLate, color: qualityOptions.tt01LateColor || '#f43f5e' },
    ];
  }, [totals, qualityOptions]);

  // Resolution distribution QĐ 766 (Toàn diện hệ thống trên Tổng tiếp nhận) - Tách thành: Trước hạn -> Đúng hạn -> Đang trong hạn -> Quá hạn
  const qualityQd766Data = useMemo(() => {
    return [
      { name: qualityOptions.qd766EarlyName || 'Đã GQ trước hạn', value: totals.compEarly, color: qualityOptions.qd766EarlyColor || '#10b981' },
      { name: qualityOptions.qd766OnTimeName || 'Đã GQ đúng hạn', value: totals.compOnTime, color: qualityOptions.qd766OnTimeColor || '#0ea5e9' },
      { name: qualityOptions.qd766PendingInTermName || 'Đang GQ trong hạn', value: totals.pendOnTime, color: qualityOptions.qd766PendingInTermColor || '#f59e0b' },
      { name: qualityOptions.qd766OverdueName || 'Đã GQ quá hạn + Đang GQ trễ hạn', value: totals.compLate + totals.pendLate, color: qualityOptions.qd766OverdueColor || '#ef4444' },
    ];
  }, [totals, qualityOptions]);

  const resolutionDistributionData = qualityTt01Data;

  // Chart 3: Channel mix (online vs in person)
  const channelMixData = useMemo(() => {
    return [
      { name: 'Trực tuyến', value: totals.recOnline, color: '#3b82f6' },
      { name: 'Trực tiếp / Một cửa', value: totals.recOffline, color: '#f59e0b' },
    ];
  }, [totals]);

  // Chart 4: Unit performance ranking
  const rankingChartConfig = useMemo(() => {
    return chartsLayout.find((c) => c.id === 'ranking');
  }, [chartsLayout]);

  const rankingOptions = useMemo(() => {
    const defaultOpts = {
      tab1Label: 'Đối chiếu 2 cách tính',
      tab2Label: 'QĐ 766 (Toàn diện)',
      tab3Label: 'TT 01 (Đã giải quyết)',
      chartNote: '',
      compBarName: 'Đã giải quyết trước + đúng hạn (hồ sơ)',
      compBarColor: '#10b981',
      qd766BarName: 'Đã giải quyết đúng hạn theo cách tính của 766',
      qd766BarColor: '#3b82f6',
      onTimeLineName: 'Tỷ lệ đúng hạn TT 01 (%)',
      onTimeLineColor: '#e11d48',
      qd766LineName: 'Tỷ lệ theo QĐ 766 (%)',
      qd766LineColor: '#2563eb',
      qd766TabOnTimeBarName: 'Đạt chuẩn hạn theo QĐ 766',
      qd766TabOnTimeBarColor: '#2563eb',
      qd766TabOverdueBarName: 'Tổng quá hạn (Đã trễ + Đang trễ)',
      qd766TabOverdueBarColor: '#ef4444',
      qd766TabLineName: 'Tỷ lệ đúng hạn QĐ 766 (%)',
      qd766TabLineColor: '#2563eb',
      tt01TabOnTimeBarName: 'Đã giải quyết Đúng & Trước hạn',
      tt01TabOnTimeBarColor: '#10b981',
      tt01TabLateBarName: 'Đã giải quyết Quá hạn',
      tt01TabLateBarColor: '#f43f5e',
      tt01TabLineName: 'Tỷ lệ đúng hạn TT 01 (%)',
      tt01TabLineColor: '#059669',
      showCompBar: true,
      showQd766Bar: true,
      showOnTimeLine: true,
      showQd766Line: true,
      showRefLine: false,
      refLineValue: 95,
      refLineLabel: '',
      refLineColor: '#f43f5e',
      qd766CalcMode: 'standard',
    };
    return {
      ...defaultOpts,
      ...(rankingChartConfig?.customOptions || {}),
    };
  }, [rankingChartConfig]);

  const unitRankingData = useMemo(() => {
    const map: Record<
      string,
      {
        unitName: string;
        rec: number;
        comp: number;
        pend: number;
        onTime: number;
        compEarly: number;
        compOnTime: number;
        compLate: number;
        pendOnTime: number;
        pendLate: number;
        qd766OnTime: number;
        totalOverdue: number;
        onTimeRate: number;
        qd766Rate: number;
        compRate: number;
      }
    > = {};

    liveUnits.forEach((u) => {
      map[u.id] = {
        unitName: u.name,
        rec: 0,
        comp: 0,
        pend: 0,
        onTime: 0,
        compEarly: 0,
        compOnTime: 0,
        compLate: 0,
        pendOnTime: 0,
        pendLate: 0,
        qd766OnTime: 0,
        totalOverdue: 0,
        onTimeRate: 100,
        qd766Rate: 100,
        compRate: 0,
      };
    });

    liveStats.forEach((s) => {
      if (!map[s.unit_id]) {
        map[s.unit_id] = {
          unitName: s.unit_name_snapshot || s.unit_name || 'Đơn vị',
          rec: 0,
          comp: 0,
          pend: 0,
          onTime: 0,
          compEarly: 0,
          compOnTime: 0,
          compLate: 0,
          pendOnTime: 0,
          pendLate: 0,
          qd766OnTime: 0,
          totalOverdue: 0,
          onTimeRate: 100,
          qd766Rate: 100,
          compRate: 0,
        };
      }
      map[s.unit_id].rec += s.received_total;
      map[s.unit_id].comp += s.completed_total;
      map[s.unit_id].pend += s.pending_total;
      map[s.unit_id].onTime += s.completed_early + s.completed_on_time;
      map[s.unit_id].compEarly += s.completed_early;
      map[s.unit_id].compOnTime += s.completed_on_time;
      map[s.unit_id].compLate += s.completed_late;
      map[s.unit_id].pendOnTime += s.pending_on_time;
      map[s.unit_id].pendLate += s.pending_late;
    });

    const isStandard = rankingOptions.qd766CalcMode !== 'resolved_only';

    return Object.values(map)
      .filter((item) => item.rec > 0 || item.comp > 0 || item.pend > 0)
      .map((item) => {
        const qd766OnTime = isStandard
          ? item.compEarly + item.compOnTime + item.pendOnTime
          : item.compEarly + item.compOnTime;
        const totalOverdue = item.compLate + item.pendLate;
        const qd766Rate = item.rec > 0 ? Number(((qd766OnTime / item.rec) * 100).toFixed(1)) : 100;
        const onTimeRate = item.comp > 0 ? Number(((item.onTime / item.comp) * 100).toFixed(1)) : 100;
        const compRate = item.rec > 0 ? Number(((item.comp / item.rec) * 100).toFixed(1)) : 0;
        return {
          ...item,
          qd766OnTime,
          totalOverdue,
          qd766Rate,
          onTimeRate,
          compRate,
        };
      })
      .sort((a, b) => {
        if (rankingViewMode === 'tt01') {
          return b.onTimeRate - a.onTimeRate || b.comp - a.comp;
        }
        return b.qd766Rate - a.qd766Rate || b.onTimeRate - a.onTimeRate;
      });
  }, [liveUnits, liveStats, rankingOptions, rankingViewMode]);

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
      .sort((a, b) => b.received_total - a.received_total)
      .map((item) => {
        const total = item.received_total || 1;
        const online_pct = Math.round((item.received_online / total) * 1000) / 10;
        const offline_pct = Math.round((item.received_offline / total) * 1000) / 10;
        return {
          ...item,
          online_pct,
          offline_pct,
          online_chart_val: chartViewType === 'percent' ? online_pct : item.received_online,
          offline_chart_val: chartViewType === 'percent' ? offline_pct : item.received_offline,
          total_chart_val: chartViewType === 'percent' ? 100 : item.received_total,
        };
      });
  }, [presentationDimension, unitPresentationData, fieldPresentationData, chartViewType]);

  const pendingPresentationData = useMemo(() => {
    const base = presentationDimension === 'unit' ? unitPresentationData : fieldPresentationData;
    return base
      .filter((item) => item.pending_total > 0)
      .sort((a, b) => b.pending_total - a.pending_total)
      .map((item) => {
        const total = item.pending_total || 1;
        const on_time_pct = Math.round((item.pending_on_time / total) * 1000) / 10;
        const late_pct = Math.round((item.pending_late / total) * 1000) / 10;
        return {
          ...item,
          on_time_pct,
          late_pct,
          on_time_chart_val: chartViewType === 'percent' ? on_time_pct : item.pending_on_time,
          late_chart_val: chartViewType === 'percent' ? late_pct : item.pending_late,
          total_chart_val: chartViewType === 'percent' ? 100 : item.pending_total,
        };
      });
  }, [presentationDimension, unitPresentationData, fieldPresentationData, chartViewType]);

  const completedPresentationData = useMemo(() => {
    const base = presentationDimension === 'unit' ? unitPresentationData : fieldPresentationData;
    return base
      .filter((item) => item.completed_total > 0)
      .sort((a, b) => b.completed_total - a.completed_total)
      .map((item) => {
        const total = item.completed_total || 1;
        const on_time_pct = Math.round((item.completed_on_time_and_early / total) * 1000) / 10;
        const late_pct = Math.round((item.completed_late / total) * 1000) / 10;
        return {
          ...item,
          on_time_pct,
          late_pct,
          on_time_chart_val: chartViewType === 'percent' ? on_time_pct : item.completed_on_time_and_early,
          late_chart_val: chartViewType === 'percent' ? late_pct : item.completed_late,
          total_chart_val: chartViewType === 'percent' ? 100 : item.completed_total,
        };
      });
  }, [presentationDimension, unitPresentationData, fieldPresentationData, chartViewType]);

  const urgeSummaryStats = useMemo(() => {
    const allUrges = dossierUrgeStore.getUrges();
    if (!selectedReport) {
      return {
        totalUrges: 0,
        directCount: 0,
        phoneCount: 0,
        directPercent: 0,
        phonePercent: 0,
        pendingCount: 0,
        completedCount: 0,
        totalMoreThan2Count: 0,
        unitList: [] as Array<{
          unitName: string;
          total: number;
          direct: number;
          phone: number;
          moreThan2Count: number;
          pending: number;
          completed: number;
          percentOfTotal: number;
        }>,
      };
    }

    const parseReceptionDate = (dateStr?: string, fallbackIso?: string): Date => {
      if (dateStr) {
        const clean = dateStr.trim();
        const parts = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
        if (parts) {
          const day = parseInt(parts[1], 10);
          const month = parseInt(parts[2], 10) - 1;
          let year = parseInt(parts[3], 10);
          if (year < 100) year += 2000;
          
          let hour = 12; // default midday to avoid timezone edge cases
          let min = 0;
          const timeParts = clean.match(/\s+(\d{1,2}):(\d{1,2})/);
          if (timeParts) {
            hour = parseInt(timeParts[1], 10);
            min = parseInt(timeParts[2], 10);
          }
          return new Date(year, month, day, hour, min);
        }
      }
      return fallbackIso ? new Date(fallbackIso) : new Date();
    };

    const getLocalDateOnly = (dateInput: string | Date): Date => {
      const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      if (typeof dateInput === 'string') {
        const parts = dateInput.split('T')[0].split('-');
        if (parts.length === 3) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const day = parseInt(parts[2], 10);
          return new Date(year, month, day, 12, 0, 0);
        }
      }
      return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
    };

    const startStr = selectedReport.period_start ? selectedReport.period_start.split('T')[0] : '';
    const endStr = selectedReport.period_end ? selectedReport.period_end.split('T')[0] : '';
    
    let periodUrges: DossierUrgeRecord[] = [];

    if (startStr && endStr) {
      const startTime = getLocalDateOnly(selectedReport.period_start).getTime() - 12 * 60 * 60 * 1000; // 00:00 local
      const endTime = getLocalDateOnly(selectedReport.period_end).getTime() + 12 * 60 * 60 * 1000; // 24:00 local
      periodUrges = allUrges.filter(u => {
        const uDate = parseReceptionDate(u.reception_time, u.created_at);
        const uTime = getLocalDateOnly(uDate).getTime();
        return uTime >= startTime && uTime <= endTime;
      });
    } else {
      const dateStr = selectedReport.period_end || selectedReport.period_start || selectedReport.created_at || '';
      if (dateStr) {
        const repDate = getLocalDateOnly(dateStr);
        const repMonth = repDate.getMonth();
        const repYear = repDate.getFullYear();
        periodUrges = allUrges.filter(u => {
          const uDate = parseReceptionDate(u.reception_time, u.created_at);
          return uDate.getMonth() === repMonth && uDate.getFullYear() === repYear;
        });
      }
    }

    const totalUrges = periodUrges.length;
    let directCount = 0;
    let phoneCount = 0;
    let pendingCount = 0;
    let completedCount = 0;

    periodUrges.forEach(u => {
      if (u.channel === 'phone') {
        phoneCount++;
      } else {
        directCount++;
      }
      if (u.status === 'completed' || u.status === 'responded') {
        completedCount++;
      } else {
        pendingCount++;
      }
    });

    const directPercent = totalUrges > 0 ? Math.round((directCount / totalUrges) * 100) : 0;
    const phonePercent = totalUrges > 0 ? 100 - directPercent : 0;

    const uniqueUnits = Array.from(new Set([
      ...liveUnits.map(u => u.name),
      ...periodUrges.map(u => u.assigned_unit)
    ])).filter(Boolean);

    const unitList = uniqueUnits.map(unitName => {
      const unitUrges = periodUrges.filter(u => u.assigned_unit === unitName);
      const uDirect = unitUrges.filter(u => u.channel !== 'phone').length;
      const uPhone = unitUrges.filter(u => u.channel === 'phone').length;
      const total = unitUrges.length;
      const percentOfTotal = totalUrges > 0 ? Math.round((total / totalUrges) * 100) : 0;

      // Group by dossier_code to find dossiers urged > 2 times
      const dossierGroups = new Map<string, DossierUrgeRecord[]>();
      unitUrges.forEach(u => {
        const code = u.dossier_code || u.id;
        if (!dossierGroups.has(code)) dossierGroups.set(code, []);
        dossierGroups.get(code)!.push(u);
      });

      let moreThan2Count = 0;
      dossierGroups.forEach(records => {
        const maxUrgeCount = Math.max(...records.map(r => r.urge_count || 1), records.length);
        if (maxUrgeCount > 2) {
          moreThan2Count++;
        }
      });

      const uPending = unitUrges.filter(u => u.status !== 'completed' && u.status !== 'responded').length;
      const uCompleted = total - uPending;

      return {
        unitName,
        total,
        direct: uDirect,
        phone: uPhone,
        moreThan2Count,
        pending: uPending,
        completed: uCompleted,
        percentOfTotal,
      };
    }).filter(d => d.total > 0).sort((a, b) => b.total - a.total);

    const totalMoreThan2Count = unitList.reduce((acc, u) => acc + u.moreThan2Count, 0);

    return {
      totalUrges,
      directCount,
      phoneCount,
      directPercent,
      phonePercent,
      pendingCount,
      completedCount,
      totalMoreThan2Count,
      unitList,
    };
  }, [selectedReport, liveUnits, urges]);

  const urgeChartData = useMemo(() => {
    return urgeSummaryStats.unitList.map(u => ({
      unitName: u.unitName,
      'Tổng số đôn đốc': u.total,
      'Đã hoàn thành/phản hồi': u.completed,
      'Đang đôn đốc/chưa phản hồi': u.pending,
    }));
  }, [urgeSummaryStats]);

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

    // 4. Sorting
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
        case 'received_total':
          valA = a.received_total;
          valB = b.received_total;
          break;
        case 'received_online':
          valA = a.received_online;
          valB = b.received_online;
          break;
        case 'received_offline':
          valA = a.received_offline;
          valB = b.received_offline;
          break;
        case 'carried_forward':
          valA = a.carried_forward;
          valB = b.carried_forward;
          break;
        case 'completed_total':
          valA = a.completed_total;
          valB = b.completed_total;
          break;
        case 'completed_early':
          valA = a.completed_early;
          valB = b.completed_early;
          break;
        case 'completed_on_time':
          valA = a.completed_on_time;
          valB = b.completed_on_time;
          break;
        case 'completed_late':
          valA = a.completed_late;
          valB = b.completed_late;
          break;
        case 'comp_late_rate':
          valA = a.completed_total > 0 ? a.completed_late / a.completed_total : 0;
          valB = b.completed_total > 0 ? b.completed_late / b.completed_total : 0;
          break;
        case 'pending_total':
          valA = a.pending_total;
          valB = b.pending_total;
          break;
        case 'pending_on_time':
          valA = a.pending_on_time;
          valB = b.pending_on_time;
          break;
        case 'pending_late':
          valA = a.pending_late;
          valB = b.pending_late;
          break;
        case 'pend_late_rate':
          valA = a.pending_total > 0 ? a.pending_late / a.pending_total : 0;
          valB = b.pending_total > 0 ? b.pending_late / b.pending_total : 0;
          break;
        case 'on_time_rate':
        case 'qd776_rate':
          valA = a.received_total > 0 ? (a.completed_late + a.pending_late) / a.received_total : 0;
          valB = b.received_total > 0 ? (b.completed_late + b.pending_late) / b.received_total : 0;
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
  }, [filteredStats, liveFields, liveSources, tableSearchQuery, tableSourceFilter, tableValidityFilter, tableSortKey, tableSortDirection]);

  // Grand totals across all processed table rows (Dòng tổng cộng bên dưới tiêu đề bảng)
  const tableGrandTotals = useMemo(() => {
    const t = {
      count: processedTableRows.length,
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
    };
    processedTableRows.forEach((r) => {
      t.received_total += r.received_total || 0;
      t.received_online += r.received_online || 0;
      t.received_offline += r.received_offline || 0;
      t.carried_forward += r.carried_forward || 0;
      t.completed_total += r.completed_total || 0;
      t.completed_early += r.completed_early || 0;
      t.completed_on_time += r.completed_on_time || 0;
      t.completed_late += r.completed_late || 0;
      t.pending_total += r.pending_total || 0;
      t.pending_on_time += r.pending_on_time || 0;
      t.pending_late += r.pending_late || 0;
    });
    const onTimeRate = t.completed_total > 0
      ? ((t.completed_early + t.completed_on_time) / t.completed_total) * 100
      : 100;
    const compLateRate = t.completed_total > 0
      ? (t.completed_late / t.completed_total) * 100
      : 0;
    const pendLateRate = t.pending_total > 0
      ? (t.pending_late / t.pending_total) * 100
      : 0;
    const qd776Rate = t.received_total > 0
      ? ((t.completed_late + t.pending_late) / t.received_total) * 100
      : 0;
    return { ...t, onTimeRate, compLateRate, pendLateRate, qd776Rate };
  }, [processedTableRows]);

  // Grouped rows when tableGroupingMode === 'field'
  const groupedByFieldRows = useMemo(() => {
    if (tableGroupingMode !== 'field') return null;

    const groups: Record<string, {
      fieldKey: string;
      fieldName: string;
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
      const fKey = row.displayName || 'Khác';
      if (!groups[fKey]) {
        groups[fKey] = {
          fieldKey: fKey,
          fieldName: fKey,
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
      groups[fKey].rows.push(row);
      groups[fKey].totals.received_total += row.received_total || 0;
      groups[fKey].totals.received_online += row.received_online || 0;
      groups[fKey].totals.received_offline += row.received_offline || 0;
      groups[fKey].totals.carried_forward += row.carried_forward || 0;
      groups[fKey].totals.completed_total += row.completed_total || 0;
      groups[fKey].totals.completed_early += row.completed_early || 0;
      groups[fKey].totals.completed_on_time += row.completed_on_time || 0;
      groups[fKey].totals.completed_late += row.completed_late || 0;
      groups[fKey].totals.pending_total += row.pending_total || 0;
      groups[fKey].totals.pending_on_time += row.pending_on_time || 0;
      groups[fKey].totals.pending_late += row.pending_late || 0;
    });

    const list = Object.values(groups);
    // Sort according to current sortKey
    list.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;
      switch (tableSortKey) {
        case 'field':
          valA = a.fieldName;
          valB = b.fieldName;
          break;
        case 'unit': {
          valA = Array.from(new Set(a.rows.map(r => r.unitName).filter(Boolean))).join(', ');
          valB = Array.from(new Set(b.rows.map(r => r.unitName).filter(Boolean))).join(', ');
          break;
        }
        case 'received_total':
          valA = a.totals.received_total;
          valB = b.totals.received_total;
          break;
        case 'received_online':
          valA = a.totals.received_online;
          valB = b.totals.received_online;
          break;
        case 'received_offline':
          valA = a.totals.received_offline;
          valB = b.totals.received_offline;
          break;
        case 'carried_forward':
          valA = a.totals.carried_forward;
          valB = b.totals.carried_forward;
          break;
        case 'completed_total':
          valA = a.totals.completed_total;
          valB = b.totals.completed_total;
          break;
        case 'completed_early':
          valA = a.totals.completed_early;
          valB = b.totals.completed_early;
          break;
        case 'completed_on_time':
          valA = a.totals.completed_on_time;
          valB = b.totals.completed_on_time;
          break;
        case 'completed_late':
          valA = a.totals.completed_late;
          valB = b.totals.completed_late;
          break;
        case 'comp_late_rate':
          valA = a.totals.completed_total > 0 ? a.totals.completed_late / a.totals.completed_total : 0;
          valB = b.totals.completed_total > 0 ? b.totals.completed_late / b.totals.completed_total : 0;
          break;
        case 'pending_total':
          valA = a.totals.pending_total;
          valB = b.totals.pending_total;
          break;
        case 'pending_on_time':
          valA = a.totals.pending_on_time;
          valB = b.totals.pending_on_time;
          break;
        case 'pending_late':
          valA = a.totals.pending_late;
          valB = b.totals.pending_late;
          break;
        case 'pend_late_rate':
          valA = a.totals.pending_total > 0 ? a.totals.pending_late / a.totals.pending_total : 0;
          valB = b.totals.pending_total > 0 ? b.totals.pending_late / b.totals.pending_total : 0;
          break;
        case 'on_time_rate':
        case 'qd776_rate': {
          valA = a.totals.received_total > 0 ? (a.totals.completed_late + a.totals.pending_late) / a.totals.received_total : 0;
          valB = b.totals.received_total > 0 ? (b.totals.completed_late + b.totals.pending_late) / b.totals.received_total : 0;
          break;
        }
        case 'validity':
          valA = a.rows.every(r => r.validation?.allPassed) ? 1 : 0;
          valB = b.rows.every(r => r.validation?.allPassed) ? 1 : 0;
          break;
        default:
          valA = a.totals.received_total;
          valB = b.totals.received_total;
      }
      if (typeof valA === 'string' && typeof valB === 'string') {
        return tableSortDirection === 'asc' ? valA.localeCompare(valB, 'vi') : valB.localeCompare(valA, 'vi');
      }
      return tableSortDirection === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
    });

    return list;
  }, [tableGroupingMode, processedTableRows, tableSortKey, tableSortDirection]);

  // Grouped rows when tableGroupingMode === 'source'
  const groupedBySourceRows = useMemo(() => {
    if (tableGroupingMode !== 'source') return null;

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
      groups[sId].totals.received_total += row.received_total || 0;
      groups[sId].totals.received_online += row.received_online || 0;
      groups[sId].totals.received_offline += row.received_offline || 0;
      groups[sId].totals.carried_forward += row.carried_forward || 0;
      groups[sId].totals.completed_total += row.completed_total || 0;
      groups[sId].totals.completed_early += row.completed_early || 0;
      groups[sId].totals.completed_on_time += row.completed_on_time || 0;
      groups[sId].totals.completed_late += row.completed_late || 0;
      groups[sId].totals.pending_total += row.pending_total || 0;
      groups[sId].totals.pending_on_time += row.pending_on_time || 0;
      groups[sId].totals.pending_late += row.pending_late || 0;
    });

    return Object.values(groups);
  }, [tableGroupingMode, processedTableRows]);

  const CustomRankingTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0]?.payload;
    if (!data) return null;

    return (
      <div className="bg-slate-900/95 text-white backdrop-blur-md border border-slate-700/80 px-3 py-2 rounded-xl shadow-2xl text-[11px] min-w-[250px] max-w-sm pointer-events-none z-50">
        <div className="font-bold text-white border-b border-slate-700/80 pb-1 mb-1.5 flex items-center justify-between gap-2">
          <span className="truncate">{data.unitName}</span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded shrink-0">
            Tổng nhận: {formatNumber(data.rec)}
          </span>
        </div>

        {/* 2 dòng so sánh cốt lõi tinh gọn */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-emerald-300 gap-2">
            <span className="flex items-center gap-1.5 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
              <span className="text-slate-300">TT 01 (Trước + Đúng hạn):</span>
            </span>
            <span className="font-bold shrink-0">
              {formatNumber(data.onTime)}/{formatNumber(data.comp)} ({data.onTimeRate}%)
            </span>
          </div>

          <div className="flex items-center justify-between text-blue-300 gap-2">
            <span className="flex items-center gap-1.5 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0"></span>
              <span className="text-slate-300">QĐ 766 (Đạt chuẩn hạn):</span>
            </span>
            <span className="font-bold shrink-0">
              {formatNumber(data.qd766OnTime)}/{formatNumber(data.rec)} ({data.qd766Rate}%)
            </span>
          </div>

          {data.totalOverdue > 0 && (
            <div className="flex items-center justify-between text-rose-300 text-[10px] pt-1 border-t border-slate-800 gap-2">
              <span className="text-slate-400">• Quá hạn (Đã trễ: {formatNumber(data.compLate)}, Đang trễ: {formatNumber(data.pendLate)}):</span>
              <span className="font-bold text-rose-400 shrink-0">-{formatNumber(data.totalOverdue)}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderStatCell = (
    val: number | undefined | null,
    colorClass?: string,
    isBold: boolean = false
  ) => {
    if (val === undefined || val === null || val === 0) {
      return <span className="text-slate-400 font-sans font-normal text-xs">-</span>;
    }
    return (
      <span className={`${isBold ? 'font-black text-sm' : 'font-semibold text-sm'} ${colorClass || 'text-slate-800'}`}>
        {formatNumber(val)}
      </span>
    );
  };

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
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-4 shadow-xs">
        <div className="flex flex-col 2xl:flex-row 2xl:items-end justify-between gap-3.5">
          {/* Global Filter Bar (4 Filter Controls) */}
          {liveReports.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1 min-w-0">
              {/* Filter 1: Kỳ Báo Cáo */}
              <div>
                <label className="block text-xs sm:text-[13px] font-bold text-slate-800 mb-1 tracking-tight">
                  Kỳ báo cáo
                </label>
                <select
                  value={selectedReportId || (selectedReport?.id ?? '')}
                  onChange={(e) => handleReportChange(e.target.value)}
                  className="w-full text-xs sm:text-sm font-bold text-slate-900 bg-slate-50 hover:bg-white border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs transition-colors"
                >
                  {liveReports.map((r) => (
                    <option key={r.id} value={r.id} className="font-semibold text-slate-900 py-1">
                      {r.report_code} - {r.report_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter 2: Nguồn dữ liệu */}
              <div>
                <label className="block text-xs sm:text-[13px] font-bold text-slate-800 mb-1 tracking-tight">
                  Nguồn dữ liệu
                </label>
                <select
                  value={selectedSourceId}
                  onChange={(e) => setSelectedSourceId(e.target.value)}
                  className="w-full text-xs sm:text-sm font-bold text-slate-900 bg-slate-50 hover:bg-white border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs transition-colors"
                >
                  <option value="ALL" className="font-semibold text-slate-900">Tất cả nguồn dữ liệu</option>
                  {liveSources.map((s) => (
                    <option key={s.id} value={s.id} className="font-semibold text-slate-900 py-1">
                      {s.source_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter 3: Đơn vị giải quyết */}
              <div>
                <label className="block text-xs sm:text-[13px] font-bold text-slate-800 mb-1 tracking-tight">
                  Đơn vị giải quyết
                </label>
                <select
                  value={selectedUnitId}
                  onChange={(e) => setSelectedUnitId(e.target.value)}
                  className="w-full text-xs sm:text-sm font-bold text-slate-900 bg-slate-50 hover:bg-white border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs transition-colors"
                >
                  <option value="ALL" className="font-semibold text-slate-900">Tất cả đơn vị</option>
                  {liveUnits.map((u) => (
                    <option key={u.id} value={u.id} className="font-semibold text-slate-900 py-1">
                      {u.name} ({u.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter 4: Lĩnh vực */}
              <div>
                <label className="block text-xs sm:text-[13px] font-bold text-slate-800 mb-1 tracking-tight">
                  Lĩnh vực TTHC
                </label>
                <select
                  value={selectedFieldId}
                  onChange={(e) => setSelectedFieldId(e.target.value)}
                  className="w-full text-xs sm:text-sm font-bold text-slate-900 bg-slate-50 hover:bg-white border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs transition-colors"
                >
                  <option value="ALL" className="font-semibold text-slate-900">Tất cả lĩnh vực ({sectorOptions.length})</option>
                  {sectorOptions.map((sec) => (
                    <option key={sec} value={sec} className="font-semibold text-slate-900 py-1">
                      {sec}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="py-2 text-xs text-slate-500">
              Chưa có kỳ báo cáo nào trong cơ sở dữ liệu Supabase.
            </div>
          )}

          {/* Action Buttons Toolbar */}
          <div className="flex items-center gap-2 flex-wrap shrink-0 pb-0.5">
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
                      className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                      title="Lưu bố cục"
                    >
                      {isSavingLayout ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Lưu bố cục
                    </button>
                  </>
                )}
                <button
                  onClick={() => setIsAdminLayoutMode(!isAdminLayoutMode)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer shadow-2xs ${
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
            <Link
              to="/public-dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#C4121A] bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-all shadow-2xs hover:shadow-xs group"
              title="Mở giao diện trình chiếu trên TV 55 inch / Kiosk công khai (Không cần đăng nhập)"
            >
              <Tv className="w-3.5 h-3.5 text-[#C4121A] group-hover:scale-110 transition-transform" />
              <span>Màn hình TV 55"</span>
            </Link>

            <button
              onClick={() => loadData(selectedReportId)}
              className="px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
              Làm mới
            </button>
            {selectedReportId && isAuthenticated && (
              <Link
                to={`/reports/${selectedReportId}`}
                className="px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors shadow-2xs inline-flex items-center gap-1"
              >
                Xem chi tiết kỳ báo cáo này →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Empty State Banner if no reports */}
      {liveReports.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center space-y-4">
          <Database className="w-12 h-12 text-slate-400 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-slate-800">Chưa có dữ liệu kỳ báo cáo</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xl mx-auto leading-relaxed">
              Vui lòng tạo kỳ báo cáo mới hoặc nhập số liệu Excel để bắt đầu theo dõi và phân tích số liệu.
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

      {/* 3. Core KPI Summary Cards Grid */}
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {kpiCards
            .sort((a, b) => a.order - b.order)
            .map((card) => {
              if (!card.visible && !isAdminLayoutMode) return null;

              if (card.id === 'received') {
                const subRec0 = card.subCards?.[0] || { title: 'Nộp trực tuyến', subtitle: 'online / tổng' };
                const subRec1 = card.subCards?.[1] || { title: 'Nộp trực tiếp', subtitle: 'trực tiếp / bưu chính' };
                const subRec2 = card.subCards?.[2] || { title: 'Từ kỳ trước', subtitle: 'chuyển sang' };

                return (
                  <div
                    key="received"
                    draggable={isAdminLayoutMode}
                    onDragStart={(e) => handleKpiDragStart(e, 'received')}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleKpiDrop(e, 'received')}
                    className={`bg-white rounded-xl border p-4 shadow-xs flex flex-col justify-between relative col-span-1 sm:col-span-2 lg:col-span-3 ${
                      isAdminLayoutMode ? 'border-blue-300 cursor-grab active:cursor-grabbing hover:shadow-md' : 'border-slate-200'
                    } ${!card.visible ? 'opacity-40 border-dashed bg-slate-50' : ''}`}
                  >
                    {isAdminLayoutMode && renderKpiAdminToolbar(card)}
                    <div className="flex flex-col justify-between h-full gap-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {card.title}
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                          {formatNumber(totals.recTotal)}
                        </div>
                        <div className="text-xs text-blue-600 mt-0.5 font-medium">
                          {card.subtitle}
                        </div>
                      </div>

                      {/* 3 Sub-cards inside received */}
                      <div className="grid grid-cols-3 gap-1.5 pt-2.5 border-t border-slate-100">
                        <div className="bg-blue-50/70 p-2 rounded-xl text-center flex flex-col justify-center border border-blue-100/60 shadow-2xs">
                          <div className="text-[10px] text-blue-800 font-bold truncate" title={subRec0.title}>{subRec0.title}</div>
                          <div className="text-xs font-black text-blue-700 mt-1">
                            {formatNumber(totals.recOnline)} <span className="text-[10px] font-normal">({formatPercent(totals.onlineRate)})</span>
                          </div>
                        </div>

                        <div className="bg-slate-50 p-2 rounded-xl text-center flex flex-col justify-center shadow-2xs border border-slate-200/60">
                          <div className="text-[10px] text-slate-600 font-semibold truncate" title={subRec1.title}>{subRec1.title}</div>
                          <div className="text-xs font-black text-slate-900 mt-1">
                            {formatNumber(totals.recOffline)}
                          </div>
                        </div>

                        <div className="bg-slate-50 p-2 rounded-xl text-center flex flex-col justify-center shadow-2xs border border-slate-200/60">
                          <div className="text-[10px] text-slate-600 font-semibold truncate" title={subRec2.title}>{subRec2.title}</div>
                          <div className="text-xs font-black text-slate-900 mt-1">
                            {formatNumber(totals.carried)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              if (card.id === 'resolved') {
                const subRes0 = card.subCards?.find((s) => s.id === 'comp_ontime' || s.id === 'ontime_rate') ||
                  (card.subCards?.length === 2 ? card.subCards[0] : card.subCards?.[1]) ||
                  { title: 'Đúng hạn', subtitle: 'trước hạn + đúng hạn' };
                const subRes1 = card.subCards?.find((s) => s.id === 'comp_late' || s.id === 'overdue_rate') ||
                  (card.subCards?.length === 2 ? card.subCards[1] : card.subCards?.[2]) ||
                  { title: 'Quá hạn', subtitle: 'trễ hạn' };

                const subRes0Title = subRes0.title === 'TL Đúng hạn' ? 'Đúng hạn' : (subRes0.title || 'Đúng hạn');
                const subRes1Title = subRes1.title === 'TL Quá hạn' ? 'Quá hạn' : (subRes1.title || 'Quá hạn');

                const resolvedOnTimeCount = totals.compEarly + totals.compOnTime;
                const resolvedLateCount = totals.compLate;

                return (
                  <div
                    key="resolved"
                    draggable={isAdminLayoutMode}
                    onDragStart={(e) => handleKpiDragStart(e, 'resolved')}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleKpiDrop(e, 'resolved')}
                    className={`bg-white rounded-xl border p-4 shadow-xs flex flex-col justify-between relative col-span-1 sm:col-span-2 lg:col-span-3 ${
                      isAdminLayoutMode ? 'border-blue-300 cursor-grab active:cursor-grabbing hover:shadow-md' : 'border-slate-200'
                    } ${!card.visible ? 'opacity-40 border-dashed bg-slate-50' : ''}`}
                  >
                    {isAdminLayoutMode && renderKpiAdminToolbar(card)}
                    <div className="flex flex-col justify-between h-full gap-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {card.title}
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-emerald-600 mt-1 flex items-baseline gap-1.5 flex-wrap">
                          <span>{formatNumber(totals.compTotal)}</span>
                          <span className="text-lg font-bold text-emerald-600/90">
                            ({formatPercent(totals.completionRate)})
                          </span>
                        </div>
                        <div className="text-xs text-emerald-600 mt-0.5 font-medium">
                          {card.subtitle}
                        </div>
                      </div>

                      {/* 2 Thẻ con: Đúng hạn & Quá hạn giống như thẻ ĐANG GIẢI QUYẾT */}
                      <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-slate-100">
                        <div className="bg-emerald-50/70 p-2 rounded-xl text-center flex flex-col justify-center border border-emerald-100/60 shadow-2xs">
                          <div className="text-[10px] text-emerald-800 font-bold truncate" title={subRes0Title}>
                            {subRes0Title}
                          </div>
                          <div className="text-xs font-black text-emerald-700 mt-1">
                            {formatNumber(resolvedOnTimeCount)} <span className="text-[10px] font-normal">({formatPercent(totals.onTimeRate)})</span>
                          </div>
                        </div>

                        <div className={`p-2 rounded-xl text-center flex flex-col justify-center shadow-2xs ${resolvedLateCount > 0 ? 'bg-rose-50/70 border border-rose-100/60' : 'bg-slate-50 border border-slate-200/60'}`}>
                          <div className={`text-[10px] font-bold truncate ${resolvedLateCount > 0 ? 'text-rose-800' : 'text-slate-600'}`} title={subRes1Title}>
                            {subRes1Title}
                          </div>
                          <div className={`text-xs font-black mt-1 ${resolvedLateCount > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                            {formatNumber(resolvedLateCount)} <span className="text-[10px] font-normal">({formatPercent(totals.overdueRate)})</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              if (card.id === 'pending') {
                const subPend0 = card.subCards?.[0] || { title: 'Tồn trong hạn', subtitle: 'trong hạn' };
                const subPend1 = card.subCards?.[1] || { title: 'Tồn quá hạn', subtitle: 'quá hạn' };

                return (
                  <div
                    key="pending"
                    draggable={isAdminLayoutMode}
                    onDragStart={(e) => handleKpiDragStart(e, 'pending')}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleKpiDrop(e, 'pending')}
                    className={`bg-white rounded-xl border p-4 shadow-xs flex flex-col justify-between relative col-span-1 sm:col-span-2 lg:col-span-3 ${
                      isAdminLayoutMode ? 'border-blue-300 cursor-grab active:cursor-grabbing hover:shadow-md' : 'border-slate-200'
                    } ${!card.visible ? 'opacity-40 border-dashed bg-slate-50' : ''}`}
                  >
                    {isAdminLayoutMode && renderKpiAdminToolbar(card)}
                    <div className="flex flex-col justify-between h-full gap-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {card.title}
                        </div>
                        <div className="text-2xl font-black text-indigo-600 mt-1 flex items-baseline gap-1.5 flex-wrap">
                          <span>{formatNumber(totals.pendTotal)}</span>
                          <span className="text-base font-bold text-indigo-600/90">
                            ({formatPercent(totals.pendingRate)})
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                          {card.subtitle}
                        </div>
                      </div>

                      {/* Tồn trong hạn & Tồn quá hạn sub-blocks */}
                      <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-slate-100">
                        <div className="bg-teal-50/70 p-2 rounded-xl text-center flex flex-col justify-center border border-teal-100/60 shadow-2xs">
                          <div className="text-[10px] text-teal-800 font-bold truncate" title={subPend0.title}>{subPend0.title}</div>
                          <div className="text-xs font-black text-teal-700 mt-1">
                            {formatNumber(totals.pendInTerm)} <span className="text-[9px] font-normal">({formatPercent(totals.pendingOnTimeRate)})</span>
                          </div>
                        </div>

                        <div className={`p-2 rounded-xl text-center flex flex-col justify-center shadow-2xs ${totals.pendLate > 0 ? 'bg-rose-50/70 border border-rose-100/60' : 'bg-slate-50 border border-slate-200/60'}`}>
                          <div className={`text-[10px] font-bold truncate ${totals.pendLate > 0 ? 'text-rose-800' : 'text-slate-600'}`} title={subPend1.title}>{subPend1.title}</div>
                          <div className={`text-xs font-black mt-1 ${totals.pendLate > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                            {formatNumber(totals.pendLate)} <span className="text-[9px] font-normal">({formatPercent(totals.pendingLateRate)})</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              if (card.id === 'qd766') {
                const subQd0 = card.subCards?.[0] || { title: 'Đã giải quyết trước, đúng hạn + Đang giải quyết trong hạn', subtitle: 'sớm + đúng + tồn trong hạn' };
                const subQd1 = card.subCards?.[1] || { title: 'Đã giải quyết trễ hạn + Đang giải quyết quá hạn', subtitle: 'trễ + tồn quá hạn' };

                const qd766OntimeSum = totals.compEarly + totals.compOnTime + totals.pendOnTime;
                const qd766LateSum = totals.compLate + totals.pendLate;

                return (
                  <div
                    key="qd766"
                    draggable={isAdminLayoutMode}
                    onDragStart={(e) => handleKpiDragStart(e, 'qd766')}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleKpiDrop(e, 'qd766')}
                    className={`bg-white rounded-xl border p-4 shadow-xs flex flex-col justify-between relative col-span-1 sm:col-span-2 lg:col-span-3 ${
                      isAdminLayoutMode ? 'border-blue-300 cursor-grab active:cursor-grabbing hover:shadow-md' : 'border-slate-200'
                    } ${!card.visible ? 'opacity-40 border-dashed bg-slate-50' : ''}`}
                  >
                    {isAdminLayoutMode && renderKpiAdminToolbar(card)}
                    <div className="flex flex-col justify-between h-full gap-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {card.title}
                        </div>
                        <div className="text-2xl font-black text-emerald-600 mt-1">
                          {formatPercent(totals.qd766OnTimeRate)}
                        </div>
                        <div className="text-[11px] text-emerald-600 mt-0.5 font-medium">
                          {card.subtitle}
                        </div>
                      </div>

                      {/* 2 Sub-groups for QD 766 */}
                      <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-slate-100">
                        <div className="bg-emerald-50/70 p-2 rounded-xl text-center flex flex-col justify-center border border-emerald-100/60 shadow-2xs">
                          <div className="text-[10px] text-emerald-800 font-bold truncate" title={subQd0.title}>{subQd0.title}</div>
                          <div className="text-xs font-black text-emerald-700 mt-1">
                            {formatNumber(qd766OntimeSum)}
                          </div>
                        </div>

                        <div className={`p-2 rounded-xl text-center flex flex-col justify-center shadow-2xs ${qd766LateSum > 0 ? 'bg-rose-50/70 border border-rose-100/60' : 'bg-slate-50 border border-slate-200/60'}`}>
                          <div className={`text-[10px] font-bold truncate ${qd766LateSum > 0 ? 'text-rose-800' : 'text-slate-600'}`} title={subQd1.title}>{subQd1.title}</div>
                          <div className={`text-xs font-black mt-1 ${qd766LateSum > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                            {formatNumber(qd766LateSum)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }





              return null;
            })}
        </div>
      </div>

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
                      title="Kéo góc này để đổi cả chiều rộng và cao"
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

                        {/* Top controls: View mode (Số lượng / Tỷ lệ), Granularity (Tháng / Quý / Năm) and Year selector */}
                        <div className="flex items-center gap-2 shrink-0 z-10 self-start sm:self-center flex-wrap">
                          {/* Mode Toggle: Số lượng | Tỷ lệ (%) */}
                          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                            <button
                              type="button"
                              onClick={() => setTrendMetricMode('count')}
                              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                                trendMetricMode === 'count'
                                  ? 'bg-white text-blue-700 shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                              title="Hiển thị theo Số lượng hồ sơ"
                            >
                              Số lượng
                            </button>
                            <button
                              type="button"
                              onClick={() => setTrendMetricMode('rate')}
                              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                                trendMetricMode === 'rate'
                                  ? 'bg-white text-blue-700 shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                              title="Hiển thị theo Tỷ lệ phần trăm (%)"
                            >
                              Tỷ lệ (%)
                            </button>
                          </div>

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
                          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={200}>
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

                              <YAxis
                                tick={{ fontSize: 11, fill: '#64748b' }}
                                axisLine={{ stroke: '#cbd5e1' }}
                                tickLine={{ stroke: '#cbd5e1' }}
                                unit={trendMetricMode === 'rate' ? '%' : ''}
                                domain={trendMetricMode === 'rate' ? [0, 100] : ['auto', 'auto']}
                              />
                              
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
                                                {trendMetricMode === 'rate' ? `${entry.value}%` : formatNumber(Number(entry.value))}
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
                                      const displayName = trendMetricMode === 'rate' ? `${series.name} (%)` : series.name;
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
                                          title={isVisible ? `Nhấn để ẩn "${displayName}"` : `Nhấn để hiện "${displayName}"`}
                                        >
                                          <span
                                            className="inline-block w-2 h-2 rounded-full shrink-0"
                                            style={{ backgroundColor: series.color }}
                                          />
                                          <span>{displayName}</span>
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
                                  name={trendMetricMode === 'rate' ? 'Tổng tiếp nhận (%)' : 'Tổng tiếp nhận'}
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
                                  name={trendMetricMode === 'rate' ? 'Tỷ lệ đã giải quyết (%)' : 'Đã giải quyết'}
                                  stroke="#10b981"
                                  strokeWidth={2.5}
                                  fillOpacity={1}
                                  fill="url(#colorSolv)"
                                  dot={{ r: 5, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                                  activeDot={{ r: 7, fill: '#047857', stroke: '#ffffff', strokeWidth: 2 }}
                                />
                              )}
                              {trendSeriesVisibility.resolvedLate && (
                                <Line
                                  type="monotone"
                                  dataKey="resolvedLate"
                                  name={trendMetricMode === 'rate' ? 'Tỷ lệ giải quyết trễ hạn (%)' : 'Đã giải quyết trễ hạn'}
                                  stroke="#b91c1c"
                                  strokeWidth={2.5}
                                  dot={{ r: 4.5, fill: '#b91c1c', stroke: '#ffffff', strokeWidth: 2 }}
                                  activeDot={{ r: 6.5, fill: '#7f1d1d', stroke: '#ffffff', strokeWidth: 2 }}
                                />
                              )}
                              {trendSeriesVisibility.pending && (
                                <Line
                                  type="monotone"
                                  dataKey="pending"
                                  name={trendMetricMode === 'rate' ? 'Tỷ lệ đang giải quyết (%)' : 'Đang giải quyết'}
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
                                  name={trendMetricMode === 'rate' ? 'Tỷ lệ đang quá hạn (%)' : 'Đang giải quyết quá hạn'}
                                  stroke="#ef4444"
                                  strokeWidth={2.5}
                                  strokeDasharray="3 3"
                                  dot={{ r: 4.5, fill: '#ef4444', stroke: '#ffffff', strokeWidth: 2 }}
                                  activeDot={{ r: 6.5, fill: '#b91c1c', stroke: '#ffffff', strokeWidth: 2 }}
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
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-slate-900">
                              {getChartTitle('quality', '2. Cơ cấu chất lượng giải quyết (TT 01 vs QĐ 766)')}
                            </h3>
                            {canManageLayout && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal('quality')}
                                className="inline-flex items-center justify-center p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer shrink-0"
                                title="Chỉnh sửa Tiêu đề, Chú giải & Màu sắc biểu đồ"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {getChartSubtitle('quality', 'So sánh cơ cấu chất lượng theo Thông tư 01 (Đã giải quyết) và Quyết định 766 (Toàn diện hệ thống)')}
                          </p>
                        </div>
                      </div>

                      {/* Main Chart Presentation: Side by Side TT 01 & QĐ 766 */}
                      <div className="flex-1 min-h-0 w-full grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                        {/* 1. KHỐI BÊN TRÁI: THÔNG TƯ 01/2018 (ĐÃ GIẢI QUYẾT) */}
                        <div className="flex flex-col bg-slate-50/50 rounded-xl border border-slate-200/80 p-3 shadow-2xs">
                          <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-slate-200/70">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                            <h4 className="text-xs font-bold text-slate-800 truncate" title={qualityOptions.tt01Header || 'Thông tư 01/2018 (Đã giải quyết)'}>
                              {qualityOptions.tt01Header || 'Thông tư 01/2018 (Đã giải quyết)'}
                            </h4>
                          </div>

                          <div className="flex-1 min-h-[270px] w-full relative flex flex-col items-center justify-center">
                            {totals.compTotal > 0 ? (
                              <>
                                <ResponsiveContainer width="100%" height={215} minWidth={100} minHeight={190}>
                                  <PieChart margin={{ top: 8, right: 12, bottom: 8, left: 12 }}>
                                    <Pie
                                      data={qualityTt01Data}
                                      cx="50%"
                                      cy="50%"
                                      innerRadius="48%"
                                      outerRadius="68%"
                                      paddingAngle={3.5}
                                      dataKey="value"
                                      label={renderPieLeaderLine}
                                      labelLine={false}
                                    >
                                      {qualityTt01Data.map((entry, index) => (
                                        <Cell key={`cell-tt01-${index}`} fill={entry.color} />
                                      ))}
                                    </Pie>
                                    <Tooltip
                                      formatter={(val: any, name: any) => [
                                        `${formatNumber(Number(val))} hồ sơ (${totals.compTotal > 0 ? ((Number(val) / totals.compTotal) * 100).toFixed(1) : 0}%)`,
                                        name
                                      ]}
                                    />
                                  </PieChart>
                                </ResponsiveContainer>
                                {renderQualityLegend(qualityTt01Data)}
                              </>
                            ) : (
                              <p className="text-xs text-slate-400">Chưa có dữ liệu giải quyết trong kỳ</p>
                            )}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-7">
                              <div className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">{formatPercent(totals.onTimeRate)}</div>
                            </div>
                          </div>
                        </div>

                        {/* 2. KHỐI BÊN PHẢI: QUYẾT ĐỊNH 766/QĐ-TTg (TOÀN DIỆN HỆ THỐNG) */}
                        <div className="flex flex-col bg-slate-50/50 rounded-xl border border-slate-200/80 p-3 shadow-2xs">
                          <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-slate-200/70">
                            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
                            <h4 className="text-xs font-bold text-slate-800 truncate" title={qualityOptions.qd766Header || 'Quyết định 766/QĐ-TTg (Toàn diện hệ thống)'}>
                              {qualityOptions.qd766Header || 'Quyết định 766 (Toàn diện hệ thống)'}
                            </h4>
                          </div>

                          <div className="flex-1 min-h-[270px] w-full relative flex flex-col items-center justify-center">
                            {totals.recTotal > 0 ? (
                              <>
                                <ResponsiveContainer width="100%" height={215} minWidth={100} minHeight={190}>
                                  <PieChart margin={{ top: 8, right: 12, bottom: 8, left: 12 }}>
                                    <Pie
                                      data={qualityQd766Data}
                                      cx="50%"
                                      cy="50%"
                                      innerRadius="48%"
                                      outerRadius="68%"
                                      paddingAngle={3.5}
                                      dataKey="value"
                                      label={renderPieLeaderLine}
                                      labelLine={false}
                                    >
                                      {qualityQd766Data.map((entry, index) => (
                                        <Cell key={`cell-qd766-${index}`} fill={entry.color} />
                                      ))}
                                    </Pie>
                                    <Tooltip
                                      formatter={(val: any, name: any) => [
                                        `${formatNumber(Number(val))} hồ sơ (${totals.recTotal > 0 ? ((Number(val) / totals.recTotal) * 100).toFixed(1) : 0}%)`,
                                        name
                                      ]}
                                    />
                                  </PieChart>
                                </ResponsiveContainer>
                                {renderQualityLegend(qualityQd766Data)}
                              </>
                            ) : (
                              <p className="text-xs text-slate-400">Chưa có dữ liệu tiếp nhận trong kỳ</p>
                            )}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-7">
                              <div className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">{formatPercent(totals.qd766OnTimeRate)}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Ghi chú chú thích chân biểu đồ nếu có */}
                      {qualityOptions.chartNote && (
                        <div className="mt-3 p-2 bg-blue-50/70 border border-blue-200/80 rounded-lg text-[11px] text-blue-900 flex items-start gap-1.5">
                          <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                          <span>{qualityOptions.chartNote}</span>
                        </div>
                      )}
                    </>
                  )}

                  {chart.id === 'ranking' && (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-slate-900">
                              {getChartTitle('ranking', '4. Xếp hạng hiệu năng giải quyết Đơn vị')}
                            </h3>
                            {canManageLayout && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal('ranking')}
                                className="inline-flex items-center justify-center p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer shrink-0"
                                title="Chỉnh sửa Tiêu đề, Chú giải & Màu sắc biểu đồ"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {getChartSubtitle('ranking', 'So sánh tổng khối lượng hồ sơ và tỷ lệ đúng hạn của từng đơn vị')}
                          </p>
                        </div>
                      </div>

                      <div className="flex-1 min-h-0 w-full relative">
                        <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={200}>
                          <BarChart data={unitRankingData} margin={{ top: 35, right: 20, left: 10, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="unitName" tick={{ fontSize: 11 }} />
                            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                            <YAxis yAxisId="right" orientation="right" domain={['auto', 100]} unit="%" tick={{ fontSize: 11 }} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />

                            {/* Reference Line chỉ hiển thị khi admin chủ động BẬT; nếu tắt hoàn toàn không vẽ */}
                            {rankingOptions.showRefLine && (
                              <ReferenceLine
                                yAxisId="right"
                                y={rankingOptions.refLineValue ?? 95}
                                stroke={rankingOptions.refLineColor || '#f43f5e'}
                                strokeDasharray="3 3"
                                label={rankingOptions.refLineLabel ? {
                                  value: rankingOptions.refLineLabel,
                                  fill: rankingOptions.refLineColor || '#f43f5e',
                                  fontSize: 10,
                                  position: 'insideTopRight',
                                } : undefined}
                              />
                            )}

                            {/* 1. CHẾ ĐỘ ĐỐI CHIẾU 2 CÁCH TÍNH (MẶC ĐỊNH) */}
                            {rankingViewMode === 'comparison' && (
                              <>
                                {rankingOptions.showCompBar !== false && (
                                  <Bar
                                    yAxisId="left"
                                    dataKey="onTime"
                                    name={rankingOptions.compBarName || 'Đã giải quyết trước + đúng hạn (hồ sơ)'}
                                    fill={rankingOptions.compBarColor || '#10b981'}
                                    radius={[4, 4, 0, 0]}
                                  >
                                    <LabelList
                                      dataKey="onTime"
                                      position="top"
                                      style={{ fontSize: 10, fill: rankingOptions.compBarColor || '#059669', fontWeight: 600 }}
                                      formatter={(v: any) => (v > 0 ? formatNumber(Number(v)) : '')}
                                    />
                                  </Bar>
                                )}
                                {rankingOptions.showQd766Bar !== false && (
                                  <Bar
                                    yAxisId="left"
                                    dataKey="qd766OnTime"
                                    name={rankingOptions.qd766BarName || 'Đã giải quyết đúng hạn theo cách tính của 766'}
                                    fill={rankingOptions.qd766BarColor || '#3b82f6'}
                                    radius={[4, 4, 0, 0]}
                                  >
                                    <LabelList
                                      dataKey="qd766OnTime"
                                      position="top"
                                      style={{ fontSize: 10, fill: rankingOptions.qd766BarColor || '#2563eb', fontWeight: 600 }}
                                      formatter={(v: any) => (v > 0 ? formatNumber(Number(v)) : '')}
                                    />
                                  </Bar>
                                )}
                                {rankingOptions.showOnTimeLine !== false && (
                                  <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="onTimeRate"
                                    name={rankingOptions.onTimeLineName || 'Tỷ lệ đúng hạn TT 01 (%)'}
                                    stroke={rankingOptions.onTimeLineColor || '#e11d48'}
                                    strokeWidth={2.5}
                                    dot={{ r: 4, fill: rankingOptions.onTimeLineColor || '#e11d48' }}
                                    activeDot={{ r: 6 }}
                                  >
                                    <LabelList
                                      dataKey="onTimeRate"
                                      position="top"
                                      offset={8}
                                      style={{ fontSize: 10, fill: rankingOptions.onTimeLineColor || '#e11d48', fontWeight: 700 }}
                                      formatter={(v: any) => (v !== undefined && v !== null && v !== '' ? `${v}%` : '')}
                                    />
                                  </Line>
                                )}
                                {rankingOptions.showQd766Line !== false && (
                                  <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="qd766Rate"
                                    name={rankingOptions.qd766LineName || 'Tỷ lệ theo QĐ 766 (%)'}
                                    stroke={rankingOptions.qd766LineColor || '#2563eb'}
                                    strokeWidth={2.5}
                                    strokeDasharray="4 4"
                                    dot={{ r: 4, fill: rankingOptions.qd766LineColor || '#2563eb' }}
                                    activeDot={{ r: 6 }}
                                  >
                                    <LabelList
                                      dataKey="qd766Rate"
                                      position="bottom"
                                      offset={8}
                                      style={{ fontSize: 10, fill: rankingOptions.qd766LineColor || '#2563eb', fontWeight: 700 }}
                                      formatter={(v: any) => (v !== undefined && v !== null && v !== '' ? `${v}%` : '')}
                                    />
                                  </Line>
                                )}
                              </>
                            )}

                            {/* 2. CHẾ ĐỘ TOÀN DIỆN THEO QĐ 766 */}
                            {rankingViewMode === 'qd766' && (
                              <>
                                <Bar
                                  yAxisId="left"
                                  dataKey="qd766OnTime"
                                  name={rankingOptions.qd766TabOnTimeBarName || 'Đạt chuẩn hạn theo QĐ 766'}
                                  fill={rankingOptions.qd766TabOnTimeBarColor || '#2563eb'}
                                  radius={[4, 4, 0, 0]}
                                >
                                  <LabelList
                                    dataKey="qd766OnTime"
                                    position="top"
                                    style={{ fontSize: 10, fill: rankingOptions.qd766TabOnTimeBarColor || '#1d4ed8', fontWeight: 600 }}
                                    formatter={(v: any) => (v > 0 ? formatNumber(Number(v)) : '')}
                                  />
                                </Bar>
                                <Bar
                                  yAxisId="left"
                                  dataKey="totalOverdue"
                                  name={rankingOptions.qd766TabOverdueBarName || 'Tổng quá hạn (Đã trễ + Đang trễ)'}
                                  fill={rankingOptions.qd766TabOverdueBarColor || '#ef4444'}
                                  radius={[4, 4, 0, 0]}
                                >
                                  <LabelList
                                    dataKey="totalOverdue"
                                    position="top"
                                    style={{ fontSize: 10, fill: rankingOptions.qd766TabOverdueBarColor || '#b91c1c', fontWeight: 600 }}
                                    formatter={(v: any) => (v > 0 ? formatNumber(Number(v)) : '')}
                                  />
                                </Bar>
                                <Line
                                  yAxisId="right"
                                  type="monotone"
                                  dataKey="qd766Rate"
                                  name={rankingOptions.qd766TabLineName || 'Tỷ lệ đúng hạn QĐ 766 (%)'}
                                  stroke={rankingOptions.qd766TabLineColor || '#2563eb'}
                                  strokeWidth={3}
                                  dot={{ r: 4, fill: rankingOptions.qd766TabLineColor || '#2563eb' }}
                                  activeDot={{ r: 6 }}
                                >
                                  <LabelList
                                    dataKey="qd766Rate"
                                    position="top"
                                    offset={8}
                                    style={{ fontSize: 10, fill: rankingOptions.qd766TabLineColor || '#2563eb', fontWeight: 700 }}
                                    formatter={(v: any) => (v !== undefined && v !== null && v !== '' ? `${v}%` : '')}
                                  />
                                </Line>
                              </>
                            )}

                            {/* 3. CHẾ ĐỘ KẾT QUẢ ĐÃ GIẢI QUYẾT THEO TT 01 */}
                            {rankingViewMode === 'tt01' && (
                              <>
                                <Bar
                                  yAxisId="left"
                                  dataKey="onTime"
                                  name={rankingOptions.tt01TabOnTimeBarName || 'Đã giải quyết Đúng & Trước hạn'}
                                  fill={rankingOptions.tt01TabOnTimeBarColor || '#10b981'}
                                  radius={[4, 4, 0, 0]}
                                >
                                  <LabelList
                                    dataKey="onTime"
                                    position="top"
                                    style={{ fontSize: 10, fill: rankingOptions.tt01TabOnTimeBarColor || '#047857', fontWeight: 600 }}
                                    formatter={(v: any) => (v > 0 ? formatNumber(Number(v)) : '')}
                                  />
                                </Bar>
                                <Bar
                                  yAxisId="left"
                                  dataKey="compLate"
                                  name={rankingOptions.tt01TabLateBarName || 'Đã giải quyết Quá hạn'}
                                  fill={rankingOptions.tt01TabLateBarColor || '#f43f5e'}
                                  radius={[4, 4, 0, 0]}
                                >
                                  <LabelList
                                    dataKey="compLate"
                                    position="top"
                                    style={{ fontSize: 10, fill: rankingOptions.tt01TabLateBarColor || '#be123c', fontWeight: 600 }}
                                    formatter={(v: any) => (v > 0 ? formatNumber(Number(v)) : '')}
                                  />
                                </Bar>
                                <Line
                                  yAxisId="right"
                                  type="monotone"
                                  dataKey="onTimeRate"
                                  name={rankingOptions.tt01TabLineName || 'Tỷ lệ đúng hạn TT 01 (%)'}
                                  stroke={rankingOptions.tt01TabLineColor || '#059669'}
                                  strokeWidth={3}
                                  dot={{ r: 4, fill: rankingOptions.tt01TabLineColor || '#059669' }}
                                  activeDot={{ r: 6 }}
                                >
                                  <LabelList
                                    dataKey="onTimeRate"
                                    position="top"
                                    offset={8}
                                    style={{ fontSize: 10, fill: rankingOptions.tt01TabLineColor || '#059669', fontWeight: 700 }}
                                    formatter={(v: any) => (v !== undefined && v !== null && v !== '' ? `${v}%` : '')}
                                  />
                                </Line>
                              </>
                            )}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Ghi chú / Chú thích bổ sung chân biểu đồ nếu có cấu hình */}
                      {rankingOptions.chartNote && (
                        <div className="mt-2 text-[11px] text-slate-600 bg-slate-50/90 p-2.5 rounded-lg border border-slate-200/80 leading-relaxed">
                          <span className="font-bold text-slate-700">📌 Chú thích: </span>
                          {rankingOptions.chartNote}
                        </div>
                      )}
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
                            {getChartSubtitle('thematic_pending', 'Phân bổ cơ cấu hồ sơ đang xử lý: Đang giải quyết Trong hạn và Đang giải quyết Quá hạn')} ({presentationDimension === 'unit' ? 'theo Đơn vị' : 'theo Lĩnh vực'})
                          </p>
                        </div>
                        
                        {/* Selector toggles: View by Count vs Percent AND Dimension */}
                        <div className="flex items-center gap-1.5 self-start sm:self-center shrink-0 z-10">
                          <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200">
                            <button
                              type="button"
                              onClick={() => setChartViewType('count')}
                              className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded transition-all cursor-pointer ${
                                chartViewType === 'count' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-700'
                              }`}
                            >
                              Số lượng
                            </button>
                            <button
                              type="button"
                              onClick={() => setChartViewType('percent')}
                              className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded transition-all cursor-pointer ${
                                chartViewType === 'percent' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-700'
                              }`}
                            >
                              Tỷ lệ (%)
                            </button>
                          </div>

                          <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200">
                            <button
                              type="button"
                              onClick={() => setPresentationDimension('unit')}
                              className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded transition-all cursor-pointer ${
                                presentationDimension === 'unit' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-700'
                              }`}
                            >
                              Đơn vị
                            </button>
                            <button
                              type="button"
                              onClick={() => setPresentationDimension('field')}
                              className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded transition-all cursor-pointer ${
                                presentationDimension === 'field' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-700'
                              }`}
                            >
                              Lĩnh vực
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex-1 min-h-0 w-full relative">
                        <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={200}>
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
                            <YAxis
                              tick={{ fontSize: 10, fill: '#475569' }}
                              unit={chartViewType === 'percent' ? '%' : ''}
                              domain={chartViewType === 'percent' ? [0, 100] : ['auto', 'auto']}
                            />
                            <Tooltip
                              formatter={(val, name) => [
                                chartViewType === 'percent' ? `${val}%` : formatNumber(Number(val)),
                                name
                              ]}
                              contentStyle={{ fontSize: 12, borderRadius: 8 }}
                            />
                            <Legend verticalAlign="top" height={36} iconType="square" iconSize={12} wrapperStyle={{ fontSize: 11, fontWeight: 'bold' }} />
                            
                            <Bar
                              dataKey={chartViewType === 'percent' ? 'on_time_pct' : 'pending_on_time'}
                              stackId="pending_stack"
                              name={chartViewType === 'percent' ? 'Đang giải quyết Trong hạn (%)' : 'Đang giải quyết Trong hạn'}
                              fill="#3b82f6"
                            >
                              <LabelList
                                dataKey={chartViewType === 'percent' ? 'on_time_pct' : 'pending_on_time'}
                                position="center"
                                style={{ fill: '#ffffff', fontSize: 9, fontWeight: 'bold' }}
                                formatter={(val: any) => val > 0 ? (chartViewType === 'percent' ? `${val}%` : formatNumber(val)) : ''}
                              />
                            </Bar>
                            <Bar
                              dataKey={chartViewType === 'percent' ? 'late_pct' : 'pending_late'}
                              stackId="pending_stack"
                              name={chartViewType === 'percent' ? 'Đang giải quyết quá hạn (%)' : 'Đang giải quyết quá hạn'}
                              fill="#ef4444"
                            >
                              <LabelList
                                dataKey={chartViewType === 'percent' ? 'late_pct' : 'pending_late'}
                                position="center"
                                style={{ fill: '#ffffff', fontSize: 9, fontWeight: 'bold' }}
                                formatter={(val: any) => val > 0 ? (chartViewType === 'percent' ? `${val}%` : formatNumber(val)) : ''}
                              />
                              <LabelList
                                dataKey={chartViewType === 'percent' ? 'total_chart_val' : 'pending_total'}
                                position="top"
                                style={{ fill: '#1e293b', fontSize: 11, fontWeight: 'bold' }}
                                formatter={(val: any) => val > 0 ? (chartViewType === 'percent' ? '100%' : formatNumber(val)) : ''}
                              />
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
                            {getChartSubtitle('thematic_received', 'Phân bổ cơ cấu hình thức tiếp nhận: Trực tuyến và Trực tiếp')} ({presentationDimension === 'unit' ? 'theo Đơn vị' : 'theo Lĩnh vực'})
                          </p>
                        </div>
                        
                        {/* Selector toggles: View by Count vs Percent AND Dimension */}
                        <div className="flex items-center gap-1.5 self-start sm:self-center shrink-0 z-10">
                          <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200">
                            <button
                              type="button"
                              onClick={() => setChartViewType('count')}
                              className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded transition-all cursor-pointer ${
                                chartViewType === 'count' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-700'
                              }`}
                            >
                              Số lượng
                            </button>
                            <button
                              type="button"
                              onClick={() => setChartViewType('percent')}
                              className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded transition-all cursor-pointer ${
                                chartViewType === 'percent' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-700'
                              }`}
                            >
                              Tỷ lệ (%)
                            </button>
                          </div>

                          <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200">
                            <button
                              type="button"
                              onClick={() => setPresentationDimension('unit')}
                              className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded transition-all cursor-pointer ${
                                presentationDimension === 'unit' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-700'
                              }`}
                            >
                              Đơn vị
                            </button>
                            <button
                              type="button"
                              onClick={() => setPresentationDimension('field')}
                              className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded transition-all cursor-pointer ${
                                presentationDimension === 'field' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-700'
                              }`}
                            >
                              Lĩnh vực
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex-1 min-h-0 w-full relative">
                        <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={200}>
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
                            <YAxis
                              tick={{ fontSize: 10, fill: '#475569' }}
                              unit={chartViewType === 'percent' ? '%' : ''}
                              domain={chartViewType === 'percent' ? [0, 100] : ['auto', 'auto']}
                            />
                            <Tooltip
                              formatter={(val, name) => [
                                chartViewType === 'percent' ? `${val}%` : formatNumber(Number(val)),
                                name
                              ]}
                              contentStyle={{ fontSize: 12, borderRadius: 8 }}
                            />
                            <Legend verticalAlign="top" height={36} iconType="square" iconSize={12} wrapperStyle={{ fontSize: 11, fontWeight: 'bold' }} />
                            
                            <Bar
                              dataKey={chartViewType === 'percent' ? 'online_pct' : 'received_online'}
                              stackId="received_stack"
                              name={chartViewType === 'percent' ? 'Trực tuyến (%)' : 'Trực tuyến'}
                              fill="#60a5fa"
                            >
                              <LabelList
                                dataKey={chartViewType === 'percent' ? 'online_pct' : 'received_online'}
                                position="center"
                                style={{ fill: '#ffffff', fontSize: 9, fontWeight: 'bold' }}
                                formatter={(val: any) => val > 0 ? (chartViewType === 'percent' ? `${val}%` : formatNumber(val)) : ''}
                              />
                            </Bar>
                            <Bar
                              dataKey={chartViewType === 'percent' ? 'offline_pct' : 'received_offline'}
                              stackId="received_stack"
                              name={chartViewType === 'percent' ? 'Trực tiếp (%)' : 'Trực tiếp'}
                              fill="#8b1a1a"
                            >
                              <LabelList
                                dataKey={chartViewType === 'percent' ? 'offline_pct' : 'received_offline'}
                                position="center"
                                style={{ fill: '#ffffff', fontSize: 9, fontWeight: 'bold' }}
                                formatter={(val: any) => val > 0 ? (chartViewType === 'percent' ? `${val}%` : formatNumber(val)) : ''}
                              />
                              <LabelList
                                dataKey={chartViewType === 'percent' ? 'total_chart_val' : 'received_total'}
                                position="top"
                                style={{ fill: '#1e293b', fontSize: 11, fontWeight: 'bold' }}
                                formatter={(val: any) => val > 0 ? (chartViewType === 'percent' ? '100%' : formatNumber(val)) : ''}
                              />
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
                            {getChartSubtitle('thematic_completed', 'Phân bổ cơ cấu kết quả xử lý: Đúng hạn và Trước hạn vs Trễ hạn (Quá hạn)')} ({presentationDimension === 'unit' ? 'theo Đơn vị' : 'theo Lĩnh vực'})
                          </p>
                        </div>
                        
                        {/* Selector toggles: View by Count vs Percent AND Dimension */}
                        <div className="flex items-center gap-1.5 self-start sm:self-center shrink-0 z-10">
                          <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200">
                            <button
                              type="button"
                              onClick={() => setChartViewType('count')}
                              className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded transition-all cursor-pointer ${
                                chartViewType === 'count' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-700'
                              }`}
                            >
                              Số lượng
                            </button>
                            <button
                              type="button"
                              onClick={() => setChartViewType('percent')}
                              className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded transition-all cursor-pointer ${
                                chartViewType === 'percent' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-700'
                              }`}
                            >
                              Tỷ lệ (%)
                            </button>
                          </div>

                          <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200">
                            <button
                              type="button"
                              onClick={() => setPresentationDimension('unit')}
                              className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded transition-all cursor-pointer ${
                                presentationDimension === 'unit' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-700'
                              }`}
                            >
                              Đơn vị
                            </button>
                            <button
                              type="button"
                              onClick={() => setPresentationDimension('field')}
                              className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded transition-all cursor-pointer ${
                                presentationDimension === 'field' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-700'
                              }`}
                            >
                              Lĩnh vực
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex-1 min-h-0 w-full relative">
                        <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={200}>
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
                            <YAxis
                              tick={{ fontSize: 10, fill: '#475569' }}
                              unit={chartViewType === 'percent' ? '%' : ''}
                              domain={chartViewType === 'percent' ? [0, 100] : ['auto', 'auto']}
                            />
                            <Tooltip
                              formatter={(val, name) => [
                                chartViewType === 'percent' ? `${val}%` : formatNumber(Number(val)),
                                name
                              ]}
                              contentStyle={{ fontSize: 12, borderRadius: 8 }}
                            />
                            <Legend verticalAlign="top" height={36} iconType="square" iconSize={12} wrapperStyle={{ fontSize: 11, fontWeight: 'bold' }} />
                            
                            <Bar
                              dataKey={chartViewType === 'percent' ? 'on_time_pct' : 'completed_on_time_and_early'}
                              stackId="completed_stack"
                              name={chartViewType === 'percent' ? 'Đúng hạn & Trước hạn (%)' : 'Đúng hạn & Trước hạn'}
                              fill="#10b981"
                            >
                              <LabelList
                                dataKey={chartViewType === 'percent' ? 'on_time_pct' : 'completed_on_time_and_early'}
                                position="center"
                                style={{ fill: '#ffffff', fontSize: 9, fontWeight: 'bold' }}
                                formatter={(val: any) => val > 0 ? (chartViewType === 'percent' ? `${val}%` : formatNumber(val)) : ''}
                              />
                            </Bar>
                            <Bar
                              dataKey={chartViewType === 'percent' ? 'late_pct' : 'completed_late'}
                              stackId="completed_stack"
                              name={chartViewType === 'percent' ? 'Trễ hạn (%)' : 'Trễ hạn'}
                              fill="#ef4444"
                            >
                              <LabelList
                                dataKey={chartViewType === 'percent' ? 'late_pct' : 'completed_late'}
                                position="center"
                                style={{ fill: '#ffffff', fontSize: 9, fontWeight: 'bold' }}
                                formatter={(val: any) => val > 0 ? (chartViewType === 'percent' ? `${val}%` : formatNumber(val)) : ''}
                              />
                              <LabelList
                                dataKey={chartViewType === 'percent' ? 'total_chart_val' : 'completed_total'}
                                position="top"
                                style={{ fill: '#1e293b', fontSize: 11, fontWeight: 'bold' }}
                                formatter={(val: any) => val > 0 ? (chartViewType === 'percent' ? '100%' : formatNumber(val)) : ''}
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}

                  {chart.id === 'urge_statistics' && (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-slate-100 pb-3">
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                              <BellRing className="w-4 h-4 text-amber-500 shrink-0" />
                              <span>{getChartTitle('urge_statistics', '5. Thống kê tình hình Đôn đốc hồ sơ theo Đơn vị chủ trì')}</span>
                            </h3>
                            {canManageLayout && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal('urge_statistics')}
                                className="inline-flex items-center justify-center p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer shrink-0"
                                title="Chỉnh sửa Tiêu đề & Chú thích biểu đồ"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {getChartSubtitle('urge_statistics', 'Tổng hợp số lượng phiếu đôn đốc phát sinh trong khoảng thời gian của kỳ báo cáo được chọn')}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex-1 min-h-0 w-full flex flex-col justify-between">
                        {urgeSummaryStats.totalUrges === 0 ? (
                          <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-6 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                            <p className="text-xs font-semibold text-slate-600 mb-1">
                              Chưa có số liệu đôn đốc phát sinh trong kỳ báo cáo đang chọn
                            </p>
                            <p className="text-[11px] text-slate-400 max-w-sm">
                              Dữ liệu sẽ được tự động đồng bộ khi cán bộ Một cửa thực hiện lập và phát hành các phiếu đôn đốc hồ sơ TTHC quá hạn.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4 text-slate-800">
                            {/* Khối Chỉ số Tổng quan dạng text chuyên nghiệp */}
                            <div className="p-3.5 bg-slate-50/90 rounded-xl border border-slate-200/90 space-y-2">
                              {/* 1. Tổng số lượt đôn đốc */}
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                                  <BellRing className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  <span>Tổng số lượt đôn đốc:</span>
                                </span>
                                <span className="font-extrabold text-slate-900 font-mono text-base">
                                  {formatNumber(urgeSummaryStats.totalUrges)}{' '}
                                  <span className="text-xs font-semibold text-slate-500">lượt</span>
                                </span>
                              </div>

                              {/* 2. Đến trực tiếp vs Qua điện thoại */}
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 border-t border-slate-200/70 text-xs text-slate-600">
                                <div className="flex items-center gap-1.5">
                                  <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                  <span className="text-slate-500">Đến trực tiếp: </span>
                                  <strong className="text-slate-900 font-mono font-bold">
                                    {formatNumber(urgeSummaryStats.directCount)}
                                  </strong>{' '}
                                  <span className="text-slate-400">lượt ({urgeSummaryStats.directPercent}%)</span>
                                </div>
                                <span className="text-slate-300 hidden sm:inline">•</span>
                                <div className="flex items-center gap-1.5">
                                  <PhoneCall className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                  <span className="text-slate-500">Qua điện thoại: </span>
                                  <strong className="text-slate-900 font-mono font-bold">
                                    {formatNumber(urgeSummaryStats.phoneCount)}
                                  </strong>{' '}
                                  <span className="text-slate-400">lượt ({urgeSummaryStats.phonePercent}%)</span>
                                </div>
                                {urgeSummaryStats.totalMoreThan2Count > 0 && (
                                  <>
                                    <span className="text-slate-300 hidden sm:inline">•</span>
                                    <div className="flex items-center gap-1.5">
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                      <span className="text-amber-800 font-medium">Hồ sơ đôn đốc &gt; 2 lần: </span>
                                      <strong className="text-amber-950 font-mono font-bold">
                                        {formatNumber(urgeSummaryStats.totalMoreThan2Count)}
                                      </strong>{' '}
                                      <span className="text-amber-700/80">hồ sơ</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* 3. Số lượng theo đơn vị */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wide px-0.5">
                                <span className="flex items-center gap-1.5">
                                  <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                  <span>Số lượng theo đơn vị</span>
                                </span>
                                <span className="text-slate-400 font-normal lowercase">
                                  ({urgeSummaryStats.unitList.length} đơn vị)
                                </span>
                              </div>

                              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                {urgeSummaryStats.unitList.map((unit) => (
                                  <div
                                    key={unit.unitName}
                                    className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-blue-300 transition-all space-y-1.5"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                        <span className="font-bold text-slate-900 text-xs truncate">
                                          {unit.unitName}
                                        </span>
                                      </div>
                                      <span className="shrink-0 font-mono text-xs font-bold text-slate-900">
                                        {formatNumber(unit.total)}{' '}
                                        <span className="text-[11px] font-normal text-slate-500">lượt</span>
                                      </span>
                                    </div>

                                    {/* Chi tiết: Đến trực tiếp, Qua điện thoại & Hồ sơ đôn đốc > 2 lần */}
                                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] pt-1.5 border-t border-slate-100 text-slate-600">
                                      <div className="flex items-center gap-3">
                                        <span className="inline-flex items-center gap-1">
                                          <Users className="w-3 h-3 text-blue-600 shrink-0" />
                                          <span>Đến trực tiếp: <strong className="text-slate-800 font-mono font-medium">{formatNumber(unit.direct)}</strong></span>
                                        </span>
                                        <span className="text-slate-300">•</span>
                                        <span className="inline-flex items-center gap-1">
                                          <PhoneCall className="w-3 h-3 text-indigo-600 shrink-0" />
                                          <span>Qua điện thoại: <strong className="text-slate-800 font-mono font-medium">{formatNumber(unit.phone)}</strong></span>
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-amber-800 font-medium inline-flex items-center gap-1">
                                          <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                                          <span>Hồ sơ đôn đốc &gt; 2 lần: <strong className="font-mono font-bold text-amber-900">{unit.moreThan2Count}</strong></span>
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
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
          {/* Header with Title, Report Period Badge, and Admin Edit Button */}
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 shrink-0">
                  <h3 className="text-base font-bold text-slate-900 uppercase tracking-tight">
                    {getChartTitle('detailed_table', 'BẢNG CHI TIẾT SỐ LIỆU')}
                  </h3>
                  {canManageLayout && (
                    <button
                      type="button"
                      onClick={() => {
                        setDraftTableHeaders({ ...DEFAULT_TABLE_HEADERS, ...tableHeaders });
                        setIsEditingTableHeadersModal(true);
                      }}
                      className="inline-flex items-center justify-center p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer shrink-0"
                      title="Tùy biến tiêu đề bảng và tất cả các cột header"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Dòng Tên của kỳ báo cáo theo kỳ đã chọn ở trên kèm ngày Chốt số liệu - NẰM CÙNG HÀNG */}
                <span className="font-semibold text-blue-900 bg-blue-50/90 border border-blue-200/90 px-3 py-1 rounded-lg inline-flex items-center gap-2 shadow-2xs text-xs">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  <span>Kỳ báo cáo: <strong className="text-blue-950 font-bold">{selectedReport ? (selectedReport.report_name || selectedReport.report_code) : 'Chưa chọn kỳ báo cáo'}</strong></span>
                  {(() => {
                    const rawDate = selectedReport?.data_as_of || selectedReport?.period_end || selectedReport?.created_at || '';
                    if (!rawDate) return null;
                    let formatted = '';
                    const clean = rawDate.split('T')[0];
                    const parts = clean.split('-');
                    if (parts.length === 3) {
                      formatted = `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
                    } else {
                      const d = new Date(rawDate);
                      if (!isNaN(d.getTime())) {
                        formatted = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                      }
                    }
                    if (!formatted) return null;
                    return (
                      <>
                        <span className="text-blue-300 font-normal">|</span>
                        <span className="text-blue-900 font-medium">
                          Ngày chốt số liệu: <strong className="text-blue-950 font-bold">{formatted}</strong>
                        </span>
                      </>
                    );
                  })()}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
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
              </div>

              {/* Grouping Mode Toggles & Rate View Toggle */}
              <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setTableGroupingMode('field')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    tableGroupingMode === 'field'
                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                  title="Gộp nhóm các dòng số liệu theo từng Lĩnh vực TTHC"
                >
                  <FolderKanban className="w-3.5 h-3.5" />
                  Nhóm theo Lĩnh vực
                </button>

                <button
                  type="button"
                  onClick={() => setTableGroupingMode('source')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    tableGroupingMode === 'source'
                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                  title="Gộp nhóm các dòng số liệu theo từng Nguồn tiếp nhận"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Nhóm theo Nguồn
                </button>

                <button
                  type="button"
                  onClick={() => setTableRateMode((prev) => (prev === 'overdue' ? 'ontime' : 'overdue'))}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    tableRateMode === 'ontime'
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                      : 'bg-amber-600 border-amber-600 text-white shadow-xs'
                  }`}
                  title={tableRateMode === 'overdue' ? 'Chuyển sang hiển thị % Đúng hạn' : 'Chuyển sang hiển thị % Quá hạn'}
                >
                  {tableRateMode === 'overdue' ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      <span>Xem % Đúng hạn</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 text-white" />
                      <span>Xem % Quá hạn</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 border-collapse">
              {/* TIÊU ĐỀ BẢNG CHUẨN ĐA TẦNG HÀNH CHÍNH NHÀ NƯỚC */}
              <thead className="bg-slate-50 text-slate-700 select-none border-b-2 border-slate-300 font-sans text-xs">
                {/* TẦNG 1: CÁC KHỐI CHỨC NĂNG CHÍNH */}
                <tr className="border-b border-slate-300">
                  <th
                    rowSpan={3}
                    className="py-1 px-2 text-center w-10 bg-slate-100 text-slate-900 border-r border-slate-300 font-bold align-middle"
                  >
                    {tableHeaders.stt || 'STT'}
                  </th>

                  {/* Cột 1: LĨNH VỰC */}
                  <th
                    rowSpan={3}
                    onClick={() => handleTableSort('field')}
                    className="py-1 px-2.5 min-w-[200px] bg-slate-100 text-slate-900 border-r border-slate-300 cursor-pointer hover:bg-slate-200 transition-colors text-left align-middle"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold">{tableHeaders.field || 'Lĩnh vực'}</span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        {tableSortKey === 'field' ? (tableSortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </div>
                  </th>

                  {/* Cột 2: ĐƠN VỊ THỰC HIỆN (ĐÃ TÁCH RIÊNG) */}
                  <th
                    rowSpan={3}
                    onClick={() => handleTableSort('unit')}
                    className="py-1 px-2.5 min-w-[150px] bg-slate-100 text-slate-900 border-r border-slate-300 cursor-pointer hover:bg-slate-200 transition-colors text-left align-middle"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold">{tableHeaders.unit || 'Đơn vị thực hiện'}</span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        {tableSortKey === 'unit' ? (tableSortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </div>
                  </th>

                  {/* Khối 1: TIẾP NHẬN */}
                  <th
                    colSpan={4}
                    className="py-1 px-2 text-center bg-[#D1E7DD] text-[#0F5132] font-bold uppercase tracking-wide border-r border-b border-[#BADBCC]"
                  >
                    {tableHeaders.received_group || 'SỐ HỒ SƠ TIẾP NHẬN'}
                  </th>

                  {/* Khối 2: ĐÃ GIẢI QUYẾT */}
                  <th
                    colSpan={5}
                    className="py-1 px-2 text-center bg-[#FFF3CD] text-[#664D03] font-bold uppercase tracking-wide border-r border-b border-[#FFECB5]"
                  >
                    {tableHeaders.resolved_group || 'SỐ LƯỢNG HỒ SƠ ĐÃ GIẢI QUYẾT'}
                  </th>

                  {/* Khối 3: ĐANG GIẢI QUYẾT */}
                  <th
                    colSpan={4}
                    className="py-1 px-2 text-center bg-[#CFE2FF] text-[#084298] font-bold uppercase tracking-wide border-r border-b border-[#B6D4FE]"
                  >
                    {tableHeaders.pending_group || 'SỐ LƯỢNG HỒ SƠ ĐANG GIẢI QUYẾT'}
                  </th>

                  {/* Cột % Quá hạn / % Đúng hạn (theo QĐ 776) */}
                  <th
                    rowSpan={3}
                    onClick={() => handleTableSort('qd776_rate')}
                    className="py-1 px-2 text-right min-w-[90px] bg-slate-100 text-slate-800 border-r border-slate-300 cursor-pointer hover:bg-slate-200 transition-colors align-middle"
                  >
                    <div className="flex flex-col items-end justify-center gap-0.5">
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-[11px] leading-tight">
                          {tableRateMode === 'ontime'
                            ? (tableHeaders.qd776_rate_ontime || '% Đúng hạn')
                            : (tableHeaders.qd776_rate_overdue || '% Quá hạn')}
                        </span>
                        <span className="text-[10px] text-slate-500 font-normal">
                          {tableSortKey === 'qd776_rate' || tableSortKey === 'on_time_rate' ? (tableSortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-semibold">{tableHeaders.qd776_label || '(QĐ 776)'}</span>
                    </div>
                  </th>
                </tr>

                {/* TẦNG 2: PHÂN BỐ CHI TIẾT */}
                <tr className="border-b border-slate-300">
                  {/* Dưới TIẾP NHẬN */}
                  <th
                    rowSpan={2}
                    onClick={() => handleTableSort('received_total')}
                    className="py-1 px-2 text-right bg-[#E8F4EC] text-[#0F5132] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#D1E7DD] transition-colors align-middle"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>{tableHeaders.received_total || 'Tổng số'}</span>
                      <span className="text-[10px] text-[#0F5132]/60 font-normal">
                        {tableSortKey === 'received_total' ? (tableSortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </div>
                  </th>
                  <th
                    colSpan={2}
                    className="py-0.5 px-2 text-center bg-[#E8F4EC] text-[#0F5132] font-bold border-r border-b border-[#BADBCC]"
                  >
                    {tableHeaders.received_in_period || 'Trong kỳ'}
                  </th>
                  <th
                    rowSpan={2}
                    onClick={() => handleTableSort('carried_forward')}
                    className="py-1 px-2 text-right bg-[#E8F4EC] text-[#0F5132] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#D1E7DD] transition-colors align-middle"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>{tableHeaders.received_carried || 'Từ kỳ trước'}</span>
                      <span className="text-[10px] text-[#0F5132]/60 font-normal">
                        {tableSortKey === 'carried_forward' ? (tableSortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </div>
                  </th>

                  {/* Dưới ĐÃ GIẢI QUYẾT */}
                  <th
                    rowSpan={2}
                    onClick={() => handleTableSort('completed_total')}
                    className="py-1 px-2 text-right bg-[#FFF9E6] text-[#664D03] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#FFF3CD] transition-colors align-middle"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>{tableHeaders.resolved_total || 'Tổng số'}</span>
                      <span className="text-[10px] text-[#664D03]/60 font-normal">
                        {tableSortKey === 'completed_total' ? (tableSortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </div>
                  </th>
                  <th
                    rowSpan={2}
                    onClick={() => handleTableSort('completed_early')}
                    className="py-1 px-2 text-right bg-[#FFF9E6] text-[#664D03] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#FFF3CD] transition-colors align-middle"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>{tableHeaders.resolved_early || 'Trước hạn'}</span>
                      <span className="text-[10px] text-[#664D03]/60 font-normal">
                        {tableSortKey === 'completed_early' ? (tableSortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </div>
                  </th>
                  <th
                    rowSpan={2}
                    onClick={() => handleTableSort('completed_on_time')}
                    className="py-1 px-2 text-right bg-[#FFF9E6] text-[#664D03] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#FFF3CD] transition-colors align-middle"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>{tableHeaders.resolved_ontime || 'Đúng hạn'}</span>
                      <span className="text-[10px] text-[#664D03]/60 font-normal">
                        {tableSortKey === 'completed_on_time' ? (tableSortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </div>
                  </th>
                  <th
                    rowSpan={2}
                    onClick={() => handleTableSort('completed_late')}
                    className="py-1 px-2 text-right bg-[#FFF9E6] text-[#664D03] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#FFF3CD] transition-colors align-middle"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>{tableHeaders.resolved_late || 'Quá hạn'}</span>
                      <span className="text-[10px] text-[#664D03]/60 font-normal">
                        {tableSortKey === 'completed_late' ? (tableSortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </div>
                  </th>
                  <th
                    rowSpan={2}
                    onClick={() => handleTableSort('comp_late_rate')}
                    className="py-1 px-2 text-right bg-[#FFF9E6] text-[#854D0E] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#FFF3CD] transition-colors align-middle min-w-[70px]"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>
                        {tableRateMode === 'ontime'
                          ? (tableHeaders.resolved_rate_ontime || '% Đúng hạn')
                          : (tableHeaders.resolved_rate_overdue || '% Quá hạn')}
                      </span>
                      <span className="text-[10px] text-[#854D0E]/60 font-normal">
                        {tableSortKey === 'comp_late_rate' ? (tableSortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </div>
                  </th>

                  {/* Dưới ĐANG GIẢI QUYẾT */}
                  <th
                    rowSpan={2}
                    onClick={() => handleTableSort('pending_total')}
                    className="py-1 px-2 text-right bg-[#E7F1FF] text-[#084298] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#CFE2FF] transition-colors align-middle"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>{tableHeaders.pending_total || 'Tổng số'}</span>
                      <span className="text-[10px] text-[#084298]/60 font-normal">
                        {tableSortKey === 'pending_total' ? (tableSortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </div>
                  </th>
                  <th
                    rowSpan={2}
                    onClick={() => handleTableSort('pending_on_time')}
                    className="py-1 px-2 text-right bg-[#E7F1FF] text-[#084298] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#CFE2FF] transition-colors align-middle"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>{tableHeaders.pending_ontime || 'Trong hạn'}</span>
                      <span className="text-[10px] text-[#084298]/60 font-normal">
                        {tableSortKey === 'pending_on_time' ? (tableSortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </div>
                  </th>
                  <th
                    rowSpan={2}
                    onClick={() => handleTableSort('pending_late')}
                    className="py-1 px-2 text-right bg-[#E7F1FF] text-[#084298] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#CFE2FF] transition-colors align-middle"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>{tableHeaders.pending_late || 'Quá hạn'}</span>
                      <span className="text-[10px] text-[#084298]/60 font-normal">
                        {tableSortKey === 'pending_late' ? (tableSortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </div>
                  </th>
                  <th
                    rowSpan={2}
                    onClick={() => handleTableSort('pend_late_rate')}
                    className="py-1 px-2 text-right bg-[#E7F1FF] text-[#075985] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#CFE2FF] transition-colors align-middle min-w-[70px]"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>
                        {tableRateMode === 'ontime'
                          ? (tableHeaders.pending_rate_ontime || '% Trong hạn')
                          : (tableHeaders.pending_rate_overdue || '% Quá hạn')}
                      </span>
                      <span className="text-[10px] text-[#075985]/60 font-normal">
                        {tableSortKey === 'pend_late_rate' ? (tableSortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </div>
                  </th>
                </tr>

                {/* TẦNG 3: TRONG KỲ (TRỰC TUYẾN & TRỰC TIẾP / BƯU CHÍNH) */}
                <tr className="border-b border-slate-300">
                  <th
                    onClick={() => handleTableSort('received_online')}
                    className="py-0.5 px-2 text-right bg-[#F1F9F4] text-[#0F5132] font-semibold border-r border-slate-300 cursor-pointer hover:bg-[#D1E7DD] transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>{tableHeaders.received_online || 'Trực tuyến'}</span>
                      <span className="text-[10px] text-[#0F5132]/60 font-normal">
                        {tableSortKey === 'received_online' ? (tableSortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleTableSort('received_offline')}
                    className="py-0.5 px-2 text-right bg-[#F1F9F4] text-[#0F5132] font-semibold border-r border-slate-300 cursor-pointer hover:bg-[#D1E7DD] transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>{tableHeaders.received_offline || 'Trực tiếp / BC'}</span>
                      <span className="text-[10px] text-[#0F5132]/60 font-normal">
                        {tableSortKey === 'received_offline' ? (tableSortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 font-mono text-sm">
                {/* Empty State */}
                {processedTableRows.length === 0 && (
                  <tr>
                    <td colSpan={17} className="py-10 text-center text-slate-400 font-sans">
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
                          }}
                          className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                        >
                          Xóa tất cả bộ lọc
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {/* DÒNG TỔNG CỘNG BÊN DƯỚI TIÊU ĐỀ BẢNG (GRAND TOTALS ROW) */}
                {processedTableRows.length > 0 && (
                  <tr className="bg-amber-100/90 hover:bg-amber-100 font-bold text-slate-900 border-b-2 border-amber-300 text-sm shadow-2xs">
                    <td className="py-1 px-2 text-center bg-amber-200/70 border-r border-amber-300 font-black text-slate-800">
                      —
                    </td>
                    <td className="py-1 px-2 bg-amber-200/70 border-r border-amber-300 font-black text-amber-950 uppercase tracking-wider font-sans text-xs">
                      TỔNG CỘNG
                    </td>
                    <td className="py-1 px-2 bg-amber-200/70 border-r border-amber-300 font-bold text-amber-900 font-sans text-xs">
                      <span className="inline-block bg-amber-300/80 text-amber-950 font-semibold px-2 py-0.5 rounded text-[11px]">
                        {tableGroupingMode === 'field' && groupedByFieldRows
                          ? `${groupedByFieldRows.length} lĩnh vực`
                          : `${tableGrandTotals.count} dòng`}
                      </span>
                    </td>
                    <td className="py-1 px-2 text-right font-black border-r border-amber-300 text-blue-900">
                      {renderStatCell(tableGrandTotals.received_total, 'text-blue-900', true)}
                    </td>
                    <td className="py-1 px-2 text-right font-black border-r border-amber-300 text-blue-900">
                      {renderStatCell(tableGrandTotals.received_online, 'text-blue-900', true)}
                    </td>
                    <td className="py-1 px-2 text-right font-black border-r border-amber-300 text-blue-900">
                      {renderStatCell(tableGrandTotals.received_offline, 'text-blue-900', true)}
                    </td>
                    <td className="py-1 px-2 text-right font-black border-r border-amber-300 text-blue-900">
                      {renderStatCell(tableGrandTotals.carried_forward, 'text-blue-900', true)}
                    </td>
                    <td className="py-1 px-2 text-right font-black border-r border-amber-300 text-blue-900">
                      {renderStatCell(tableGrandTotals.completed_total, 'text-blue-900', true)}
                    </td>
                    <td className="py-1 px-2 text-right font-black border-r border-amber-300 text-emerald-800">
                      {renderStatCell(tableGrandTotals.completed_early, 'text-emerald-800', true)}
                    </td>
                    <td className="py-1 px-2 text-right font-black border-r border-amber-300 text-emerald-800">
                      {renderStatCell(tableGrandTotals.completed_on_time, 'text-emerald-800', true)}
                    </td>
                    <td className="py-1 px-2 text-right font-black border-r border-amber-300">
                      {tableGrandTotals.completed_late > 0 ? (
                        <span className="text-red-700 font-black text-sm">{formatNumber(tableGrandTotals.completed_late)}</span>
                      ) : (
                        <span className="text-slate-400 font-sans font-normal text-xs">-</span>
                      )}
                    </td>
                    <td className="py-1 px-2 text-right font-black border-r border-amber-300 font-sans text-sm">
                      <span className={tableRateMode === 'ontime' ? 'text-emerald-800 font-black' : (tableGrandTotals.completed_late > 0 ? 'text-red-700 font-black' : 'text-blue-900 font-black')}>
                        {tableRateMode === 'ontime'
                          ? formatRatePercent(tableGrandTotals.completed_total > 0 ? ((tableGrandTotals.completed_early + tableGrandTotals.completed_on_time) / tableGrandTotals.completed_total) * 100 : null)
                          : formatRatePercent(tableGrandTotals.compLateRate)}
                      </span>
                    </td>
                    <td className="py-1 px-2 text-right font-black border-r border-amber-300 text-blue-900">
                      {renderStatCell(tableGrandTotals.pending_total, 'text-blue-900', true)}
                    </td>
                    <td className="py-1 px-2 text-right font-black border-r border-amber-300 text-blue-900">
                      {renderStatCell(tableGrandTotals.pending_on_time, 'text-blue-900', true)}
                    </td>
                    <td className="py-1 px-2 text-right font-black border-r border-amber-300">
                      {tableGrandTotals.pending_late > 0 ? (
                        <span className="text-red-700 font-black text-sm">{formatNumber(tableGrandTotals.pending_late)}</span>
                      ) : (
                        <span className="text-slate-400 font-sans font-normal text-xs">-</span>
                      )}
                    </td>
                    <td className="py-1 px-2 text-right font-black border-r border-amber-300 font-sans text-sm">
                      <span className={tableRateMode === 'ontime' ? 'text-blue-900 font-black' : (tableGrandTotals.pending_late > 0 ? 'text-red-700 font-black' : 'text-blue-900 font-black')}>
                        {tableRateMode === 'ontime'
                          ? formatRatePercent(tableGrandTotals.pending_total > 0 ? (tableGrandTotals.pending_on_time / tableGrandTotals.pending_total) * 100 : null)
                          : formatRatePercent(tableGrandTotals.pendLateRate)}
                      </span>
                    </td>
                    <td className="py-1 px-2 text-right font-black border-r border-amber-300 font-sans text-sm">
                      <span className={tableRateMode === 'ontime' ? 'text-blue-900 font-black' : (tableGrandTotals.qd776Rate > 0 ? 'text-red-700 font-black' : 'text-blue-900 font-black')}>
                        {tableRateMode === 'ontime'
                          ? formatRatePercent(tableGrandTotals.received_total > 0 ? (((tableGrandTotals.completed_early + tableGrandTotals.completed_on_time) + tableGrandTotals.pending_on_time) / tableGrandTotals.received_total) * 100 : null)
                          : formatRatePercent(tableGrandTotals.qd776Rate)}
                      </span>
                    </td>
                  </tr>
                )}

                {/* 1. KHI CHỌN NHÓM THEO LĨNH VỰC */}
                {tableGroupingMode === 'field' && groupedByFieldRows && groupedByFieldRows.map((group, groupIdx) => {
                  const compLateRate = group.totals.completed_total > 0
                    ? (group.totals.completed_late / group.totals.completed_total) * 100
                    : null;
                  const pendLateRate = group.totals.pending_total > 0
                    ? (group.totals.pending_late / group.totals.pending_total) * 100
                    : null;
                  const qd776Rate = group.totals.received_total > 0
                    ? ((group.totals.completed_late + group.totals.pending_late) / group.totals.received_total) * 100
                    : null;
                  const unitNames = Array.from(new Set(group.rows.map(r => r.unitName).filter(Boolean)));

                  return (
                    <tr key={group.fieldKey} className="hover:brightness-95 transition-colors border-b border-slate-200">
                      <td className="py-1 px-2 text-center text-blue-900 font-sans border-r border-slate-200 font-medium text-xs">
                        {groupIdx + 1}
                      </td>
                      <td className="py-1 px-2.5 text-blue-900 font-sans border-r border-slate-200">
                        <div className="font-bold text-blue-950 text-xs">
                          {group.fieldName}
                        </div>
                      </td>
                      <td className="py-1 px-2 text-slate-700 font-sans border-r border-slate-200">
                        {unitNames.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {unitNames.map(u => (
                              <span key={u} className="inline-block px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 text-[10px] font-sans border border-blue-200/70 font-medium">
                                {u}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs font-sans">—</span>
                        )}
                      </td>
                      <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#EAF5EE]/80">
                        {renderStatCell(group.totals.received_total, 'text-blue-900', true)}
                      </td>
                      <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#F1F8F4]/80">
                        {renderStatCell(group.totals.received_online, 'text-blue-900')}
                      </td>
                      <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#F1F8F4]/80">
                        {renderStatCell(group.totals.received_offline, 'text-blue-900')}
                      </td>
                      <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#EAF5EE]/80">
                        {renderStatCell(group.totals.carried_forward, 'text-blue-900')}
                      </td>
                      <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#FEF6DC]/80">
                        {renderStatCell(group.totals.completed_total, 'text-blue-900', true)}
                      </td>
                      <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#FFFBF0]/80">
                        {renderStatCell(group.totals.completed_early, 'text-emerald-800')}
                      </td>
                      <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#FFFBF0]/80">
                        {renderStatCell(group.totals.completed_on_time, 'text-emerald-800')}
                      </td>
                      <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#FFFBF0]/80">
                        {group.totals.completed_late > 0 ? (
                          <span className="text-red-700 font-bold text-sm">{formatNumber(group.totals.completed_late)}</span>
                        ) : (
                          <span className="text-slate-400 font-sans font-normal text-xs">-</span>
                        )}
                      </td>
                      <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#FFFBF0]/80 font-sans text-sm">
                        <span className={tableRateMode === 'ontime' ? 'text-emerald-800 font-bold' : (group.totals.completed_late > 0 ? 'text-red-700 font-bold' : 'text-blue-900 font-medium')}>
                          {tableRateMode === 'ontime'
                            ? formatRatePercent(group.totals.completed_total > 0 ? ((group.totals.completed_early + group.totals.completed_on_time) / group.totals.completed_total) * 100 : null)
                            : formatRatePercent(compLateRate)}
                        </span>
                      </td>
                      <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#E7F1FF]/80">
                        {renderStatCell(group.totals.pending_total, 'text-blue-900', true)}
                      </td>
                      <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#F2F7FF]/80">
                        {renderStatCell(group.totals.pending_on_time, 'text-blue-900')}
                      </td>
                      <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#F2F7FF]/80">
                        {group.totals.pending_late > 0 ? (
                          <span className="text-red-700 font-bold text-sm">{formatNumber(group.totals.pending_late)}</span>
                        ) : (
                          <span className="text-slate-400 font-sans font-normal text-xs">-</span>
                        )}
                      </td>
                      <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#F2F7FF]/80 font-sans text-sm">
                        <span className={tableRateMode === 'ontime' ? 'text-blue-900 font-bold' : (group.totals.pending_late > 0 ? 'text-red-700 font-bold' : 'text-blue-900 font-medium')}>
                          {tableRateMode === 'ontime'
                            ? formatRatePercent(group.totals.pending_total > 0 ? (group.totals.pending_on_time / group.totals.pending_total) * 100 : null)
                            : formatRatePercent(pendLateRate)}
                        </span>
                      </td>
                      <td className="py-1 px-2 text-right text-blue-900 font-sans text-sm bg-slate-50/50">
                        <span className={tableRateMode === 'ontime' ? 'text-blue-900 font-bold' : ((qd776Rate ?? 0) > 0 ? 'text-red-700 font-bold' : 'text-blue-900 font-medium')}>
                          {tableRateMode === 'ontime'
                            ? formatRatePercent(group.totals.received_total > 0 ? (((group.totals.completed_early + group.totals.completed_on_time) + group.totals.pending_on_time) / group.totals.received_total) * 100 : null)
                            : formatRatePercent(qd776Rate)}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {/* 2. KHI CHỌN NHÓM THEO NGUỒN */}
                {tableGroupingMode === 'source' && groupedBySourceRows && groupedBySourceRows.map((group, groupIdx) => {
                  const compLateRate = group.totals.completed_total > 0
                    ? (group.totals.completed_late / group.totals.completed_total) * 100
                    : null;
                  const pendLateRate = group.totals.pending_total > 0
                    ? (group.totals.pending_late / group.totals.pending_total) * 100
                    : null;
                  const qd776Rate = group.totals.received_total > 0
                    ? ((group.totals.completed_late + group.totals.pending_late) / group.totals.received_total) * 100
                    : null;

                  return (
                    <React.Fragment key={group.sourceId}>
                      {/* Tiêu đề nhóm Nguồn chuẩn hành chính */}
                      <tr className="bg-slate-200 text-blue-900 font-sans font-bold border-y border-slate-300 hover:bg-slate-200/90 transition-colors">
                        <td className="py-1 px-2 text-center bg-slate-300 text-blue-900 font-bold border-r border-slate-300 text-xs">
                          {groupIdx + 1}
                        </td>
                        <td colSpan={2} className="py-1 px-2.5 text-blue-900 border-r border-slate-300">
                          <div className="flex items-center gap-2">
                            <Layers className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                            <span className="uppercase text-xs tracking-wide font-bold">{group.sourceName}</span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                              {group.rows.length} lĩnh vực
                            </span>
                          </div>
                        </td>
                        <td className="py-1 px-2 text-right font-bold text-blue-900 border-r border-slate-300">
                          {renderStatCell(group.totals.received_total, 'text-blue-900', true)}
                        </td>
                        <td className="py-1 px-2 text-right font-bold text-blue-900 border-r border-slate-300">
                          {renderStatCell(group.totals.received_online, 'text-blue-900', true)}
                        </td>
                        <td className="py-1 px-2 text-right font-bold text-blue-900 border-r border-slate-300">
                          {renderStatCell(group.totals.received_offline, 'text-blue-900', true)}
                        </td>
                        <td className="py-1 px-2 text-right font-bold text-blue-900 border-r border-slate-300">
                          {renderStatCell(group.totals.carried_forward, 'text-blue-900', true)}
                        </td>
                        <td className="py-1 px-2 text-right font-bold text-blue-900 border-r border-slate-300">
                          {renderStatCell(group.totals.completed_total, 'text-blue-900', true)}
                        </td>
                        <td className="py-1 px-2 text-right font-bold text-emerald-800 border-r border-slate-300">
                          {renderStatCell(group.totals.completed_early, 'text-emerald-800', true)}
                        </td>
                        <td className="py-1 px-2 text-right font-bold text-emerald-800 border-r border-slate-300">
                          {renderStatCell(group.totals.completed_on_time, 'text-emerald-800', true)}
                        </td>
                        <td className="py-1 px-2 text-right border-r border-slate-300 font-bold">
                          {group.totals.completed_late > 0 ? (
                            <span className="text-red-700 font-bold text-sm">{formatNumber(group.totals.completed_late)}</span>
                          ) : (
                            <span className="text-slate-400 font-sans font-normal text-xs">-</span>
                          )}
                        </td>
                        <td className="py-1 px-2 text-right border-r border-slate-300 font-sans font-bold text-sm">
                          <span className={tableRateMode === 'ontime' ? 'text-emerald-800 font-bold' : (group.totals.completed_late > 0 ? 'text-red-700 font-bold' : 'text-blue-900 font-bold')}>
                            {tableRateMode === 'ontime'
                              ? formatRatePercent(group.totals.completed_total > 0 ? ((group.totals.completed_early + group.totals.completed_on_time) / group.totals.completed_total) * 100 : null)
                              : formatRatePercent(compLateRate)}
                          </span>
                        </td>
                        <td className="py-1 px-2 text-right font-bold text-blue-900 border-r border-slate-300">
                          {renderStatCell(group.totals.pending_total, 'text-blue-900', true)}
                        </td>
                        <td className="py-1 px-2 text-right font-bold text-blue-900 border-r border-slate-300">
                          {renderStatCell(group.totals.pending_on_time, 'text-blue-900', true)}
                        </td>
                        <td className="py-1 px-2 text-right border-r border-slate-300 font-bold">
                          {group.totals.pending_late > 0 ? (
                            <span className="text-red-700 font-bold text-sm">{formatNumber(group.totals.pending_late)}</span>
                          ) : (
                            <span className="text-slate-400 font-sans font-normal text-xs">-</span>
                          )}
                        </td>
                        <td className="py-1 px-2 text-right border-r border-slate-300 font-sans font-bold text-sm">
                          <span className={tableRateMode === 'ontime' ? 'text-blue-900 font-bold' : (group.totals.pending_late > 0 ? 'text-red-700 font-bold' : 'text-blue-900 font-bold')}>
                            {tableRateMode === 'ontime'
                              ? formatRatePercent(group.totals.pending_total > 0 ? (group.totals.pending_on_time / group.totals.pending_total) * 100 : null)
                              : formatRatePercent(pendLateRate)}
                          </span>
                        </td>
                        <td className="py-1 px-2 text-right text-blue-900 font-sans font-bold text-sm">
                          <span className={tableRateMode === 'ontime' ? 'text-blue-900 font-bold' : ((qd776Rate ?? 0) > 0 ? 'text-red-700 font-bold' : 'text-blue-900 font-bold')}>
                            {tableRateMode === 'ontime'
                              ? formatRatePercent(group.totals.received_total > 0 ? (((group.totals.completed_early + group.totals.completed_on_time) + group.totals.pending_on_time) / group.totals.received_total) * 100 : null)
                              : formatRatePercent(qd776Rate)}
                          </span>
                        </td>
                      </tr>

                      {/* Các dòng con trong nhóm Nguồn */}
                      {group.rows.map((row, rowIdx) => {
                        const rowCompLateRate = row.completed_total > 0
                          ? (row.completed_late / row.completed_total) * 100
                          : null;
                        const rowPendLateRate = row.pending_total > 0
                          ? (row.pending_late / row.pending_total) * 100
                          : null;
                        const rowQD776Rate = row.received_total > 0
                          ? ((row.completed_late + row.pending_late) / row.received_total) * 100
                          : null;

                        return (
                          <tr key={row.id} className="hover:brightness-95 transition-colors border-b border-slate-200">
                            <td className="py-1 px-2 text-center text-blue-900 font-sans border-r border-slate-200 text-xs">
                              {groupIdx + 1}.{rowIdx + 1}
                            </td>
                            <td className="py-1 px-2.5 text-blue-900 font-sans border-r border-slate-200">
                              <div className="font-semibold text-blue-950 text-xs">
                                {row.displayName}
                              </div>
                            </td>
                            <td className="py-1 px-2 text-slate-600 font-sans border-r border-slate-200 text-xs">
                              {row.unitName ? (
                                <span className="inline-block px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 text-[10px] font-sans border border-blue-200/70 font-medium">
                                  {row.unitName}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs font-sans">—</span>
                              )}
                            </td>
                            <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#EAF5EE]/80">
                              {renderStatCell(row.received_total, 'text-blue-900', true)}
                            </td>
                            <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#F1F8F4]/80">
                              {renderStatCell(row.received_online, 'text-blue-900')}
                            </td>
                            <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#F1F8F4]/80">
                              {renderStatCell(row.received_offline, 'text-blue-900')}
                            </td>
                            <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#EAF5EE]/80">
                              {renderStatCell(row.carried_forward, 'text-blue-900')}
                            </td>
                            <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#FEF6DC]/80">
                              {renderStatCell(row.completed_total, 'text-blue-900', true)}
                            </td>
                            <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#FFFBF0]/80">
                              {renderStatCell(row.completed_early, 'text-emerald-800')}
                            </td>
                            <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#FFFBF0]/80">
                              {renderStatCell(row.completed_on_time, 'text-emerald-800')}
                            </td>
                            <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#FFFBF0]/80">
                              {row.completed_late > 0 ? (
                                <span className="text-red-700 font-bold text-sm">{formatNumber(row.completed_late)}</span>
                              ) : (
                                <span className="text-slate-400 font-sans font-normal text-xs">-</span>
                              )}
                            </td>
                            <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#FFFBF0]/80 font-sans text-sm">
                              <span className={tableRateMode === 'ontime' ? 'text-emerald-800 font-semibold' : (row.completed_late > 0 ? 'text-red-700 font-semibold' : 'text-blue-900 font-normal')}>
                                {tableRateMode === 'ontime'
                                  ? formatRatePercent(row.completed_total > 0 ? ((row.completed_early + row.completed_on_time) / row.completed_total) * 100 : null)
                                  : formatRatePercent(rowCompLateRate)}
                              </span>
                            </td>
                            <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#E7F1FF]/80">
                              {renderStatCell(row.pending_total, 'text-blue-900', true)}
                            </td>
                            <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#F2F7FF]/80">
                              {renderStatCell(row.pending_on_time, 'text-blue-900')}
                            </td>
                            <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#F2F7FF]/80">
                              {row.pending_late > 0 ? (
                                <span className="text-red-700 font-bold text-sm">{formatNumber(row.pending_late)}</span>
                              ) : (
                                <span className="text-slate-400 font-sans font-normal text-xs">-</span>
                              )}
                            </td>
                            <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#F2F7FF]/80 font-sans text-sm">
                              <span className={tableRateMode === 'ontime' ? 'text-blue-900 font-semibold' : (row.pending_late > 0 ? 'text-red-700 font-semibold' : 'text-blue-900 font-normal')}>
                                {tableRateMode === 'ontime'
                                  ? formatRatePercent(row.pending_total > 0 ? (row.pending_on_time / row.pending_total) * 100 : null)
                                  : formatRatePercent(rowPendLateRate)}
                              </span>
                            </td>
                            <td className="py-1 px-2 text-right text-blue-900 font-sans text-sm bg-slate-50/50">
                              <span className={tableRateMode === 'ontime' ? 'text-blue-900 font-semibold' : ((rowQD776Rate ?? 0) > 0 ? 'text-red-700 font-semibold' : 'text-blue-900 font-normal')}>
                                {tableRateMode === 'ontime'
                                  ? formatRatePercent(row.received_total > 0 ? (((row.completed_early + row.completed_on_time) + row.pending_on_time) / row.received_total) * 100 : null)
                                  : formatRatePercent(rowQD776Rate)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}

                {/* 3. KHI XEM DANH SÁCH CHI TIẾT (KHÔNG NHÓM) */}
                {tableGroupingMode === 'none' && processedTableRows.map((row, index) => {
                  const rowCompLateRate = row.completed_total > 0
                    ? (row.completed_late / row.completed_total) * 100
                    : null;
                  const rowPendLateRate = row.pending_total > 0
                    ? (row.pending_late / row.pending_total) * 100
                    : null;
                  const rowQD776Rate = row.received_total > 0
                    ? ((row.completed_late + row.pending_late) / row.received_total) * 100
                    : null;

                  return (
                    <tr key={row.id} className="hover:brightness-95 transition-colors border-b border-slate-200">
                      <td className="py-1 px-2 text-center text-blue-900 font-sans border-r border-slate-200 text-xs">
                        {index + 1}
                      </td>
                      <td className="py-1 px-2.5 text-blue-900 font-sans border-r border-slate-200">
                        <div className="font-semibold text-blue-950 text-xs">
                          {row.displayName}
                        </div>
                      </td>
                      <td className="py-1 px-2 text-slate-600 font-sans border-r border-slate-200 text-xs">
                        {row.unitName ? (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 text-[10px] font-sans border border-blue-200/70 font-medium">
                            {row.unitName}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs font-sans">—</span>
                        )}
                      </td>
                      <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#EAF5EE]/80">
                        {renderStatCell(row.received_total, 'text-blue-900', true)}
                      </td>
                      <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#F1F8F4]/80">
                        {renderStatCell(row.received_online, 'text-blue-900')}
                      </td>
                      <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#F1F8F4]/80">
                        {renderStatCell(row.received_offline, 'text-blue-900')}
                      </td>
                      <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#EAF5EE]/80">
                        {renderStatCell(row.carried_forward, 'text-blue-900')}
                      </td>
                      <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#FEF6DC]/80">
                        {renderStatCell(row.completed_total, 'text-blue-900', true)}
                      </td>
                      <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#FFFBF0]/80">
                        {renderStatCell(row.completed_early, 'text-emerald-800')}
                      </td>
                      <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#FFFBF0]/80">
                        {renderStatCell(row.completed_on_time, 'text-emerald-800')}
                      </td>
                      <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#FFFBF0]/80">
                        {row.completed_late > 0 ? (
                          <span className="text-red-700 font-bold text-sm">{formatNumber(row.completed_late)}</span>
                        ) : (
                          <span className="text-slate-400 font-sans font-normal text-xs">-</span>
                        )}
                      </td>
                      <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#FFFBF0]/80 font-sans text-sm">
                        <span className={tableRateMode === 'ontime' ? 'text-emerald-800 font-semibold' : (row.completed_late > 0 ? 'text-red-700 font-semibold' : 'text-blue-900 font-normal')}>
                          {tableRateMode === 'ontime'
                            ? formatRatePercent(row.completed_total > 0 ? ((row.completed_early + row.completed_on_time) / row.completed_total) * 100 : null)
                            : formatRatePercent(rowCompLateRate)}
                        </span>
                      </td>
                      <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#E7F1FF]/80">
                        {renderStatCell(row.pending_total, 'text-blue-900', true)}
                      </td>
                      <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#F2F7FF]/80">
                        {renderStatCell(row.pending_on_time, 'text-blue-900')}
                      </td>
                      <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#F2F7FF]/80">
                        {row.pending_late > 0 ? (
                          <span className="text-red-700 font-bold text-sm">{formatNumber(row.pending_late)}</span>
                        ) : (
                          <span className="text-slate-400 font-sans font-normal text-xs">-</span>
                        )}
                      </td>
                      <td className="py-1 px-2 text-right border-r border-slate-200 bg-[#F2F7FF]/80 font-sans text-sm">
                        <span className={tableRateMode === 'ontime' ? 'text-blue-900 font-semibold' : (row.pending_late > 0 ? 'text-red-700 font-semibold' : 'text-blue-900 font-normal')}>
                          {tableRateMode === 'ontime'
                            ? formatRatePercent(row.pending_total > 0 ? (row.pending_on_time / row.pending_total) * 100 : null)
                            : formatRatePercent(rowPendLateRate)}
                        </span>
                      </td>
                      <td className="py-1 px-2 text-right text-blue-900 font-sans text-sm bg-slate-50/50">
                        <span className={tableRateMode === 'ontime' ? 'text-blue-900 font-semibold' : ((rowQD776Rate ?? 0) > 0 ? 'text-red-700 font-semibold' : 'text-blue-900 font-normal')}>
                          {tableRateMode === 'ontime'
                            ? formatRatePercent(row.received_total > 0 ? (((row.completed_early + row.completed_on_time) + row.pending_on_time) / row.received_total) * 100 : null)
                            : formatRatePercent(rowQD776Rate)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. MODAL CHỈNH SỬA TIÊU ĐỀ & CHÚ THÍCH BIỂU ĐỒ (DÀNH CHO QUẢN TRỊ VIÊN) */}
      {editingChartMeta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl shadow-2xs">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Chỉnh sửa Biểu đồ & Chú giải
                  </h3>
                  <p className="text-xs text-slate-500">
                    Quản trị viên tùy biến tiêu đề, nội dung chú giải, màu sắc các đường, cột
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
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
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
                  rows={2}
                  value={editingChartMeta.subtitle}
                  onChange={(e) => setEditingChartMeta({ ...editingChartMeta, subtitle: e.target.value })}
                  placeholder="Nhập mô tả, phần chú thích hoặc căn cứ pháp lý cho biểu đồ..."
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-normal text-slate-800 resize-none"
                />
              </div>

              {/* TÙY CHỈNH CHÚ GIẢI, MÀU SẮC CHO BIỂU ĐỒ CƠ CẤU CHẤT LƯỢNG (QUALITY: TT 01 VS QĐ 766) */}
              {editingChartMeta.id === 'quality' && (
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                      Tùy chỉnh Nhãn, Chú giải & Màu sắc (TT 01 & QĐ 766)
                    </h4>
                  </div>

                  {/* 1. Tiêu đề khối TT 01 và QĐ 766 */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                      1. Tiêu đề khối đối chiếu bên trái (TT 01) và bên phải (QĐ 766)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3 rounded-lg border border-slate-200/80">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Tiêu đề khối TT 01 (Bên trái)
                        </label>
                        <input
                          type="text"
                          value={editingChartMeta.customOptions?.tt01Header ?? 'Thông tư 01/2018 (Đã giải quyết)'}
                          onChange={(e) => setEditingChartMeta({
                            ...editingChartMeta,
                            customOptions: { ...editingChartMeta.customOptions, tt01Header: e.target.value }
                          })}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Tiêu đề khối QĐ 766 (Bên phải)
                        </label>
                        <input
                          type="text"
                          value={editingChartMeta.customOptions?.qd766Header ?? 'Quyết định 766 (Toàn diện hệ thống)'}
                          onChange={(e) => setEditingChartMeta({
                            ...editingChartMeta,
                            customOptions: { ...editingChartMeta.customOptions, qd766Header: e.target.value }
                          })}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. Cấu hình chú giải & màu sắc Thông tư 01 */}
                  <div className="p-3.5 bg-emerald-50/40 border border-emerald-200 rounded-xl space-y-3">
                    <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                      2. Cấu hình Màu sắc & Nhãn: Thông tư 01/2018 (Bên trái)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-white p-2.5 rounded-lg border border-emerald-200/80">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Đã GQ trước hạn</label>
                        <input
                          type="text"
                          value={editingChartMeta.customOptions?.tt01EarlyName ?? 'Đã GQ trước hạn'}
                          onChange={(e) => setEditingChartMeta({
                            ...editingChartMeta,
                            customOptions: { ...editingChartMeta.customOptions, tt01EarlyName: e.target.value }
                          })}
                          className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded mb-1.5"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={editingChartMeta.customOptions?.tt01EarlyColor ?? '#10b981'}
                            onChange={(e) => setEditingChartMeta({
                              ...editingChartMeta,
                              customOptions: { ...editingChartMeta.customOptions, tt01EarlyColor: e.target.value }
                            })}
                            className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0.5"
                          />
                          <span className="text-[10px] font-mono text-slate-500">{editingChartMeta.customOptions?.tt01EarlyColor ?? '#10b981'}</span>
                        </div>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-emerald-200/80">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Đã GQ đúng hạn</label>
                        <input
                          type="text"
                          value={editingChartMeta.customOptions?.tt01OnTimeName ?? 'Đã GQ đúng hạn'}
                          onChange={(e) => setEditingChartMeta({
                            ...editingChartMeta,
                            customOptions: { ...editingChartMeta.customOptions, tt01OnTimeName: e.target.value }
                          })}
                          className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded mb-1.5"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={editingChartMeta.customOptions?.tt01OnTimeColor ?? '#0ea5e9'}
                            onChange={(e) => setEditingChartMeta({
                              ...editingChartMeta,
                              customOptions: { ...editingChartMeta.customOptions, tt01OnTimeColor: e.target.value }
                            })}
                            className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0.5"
                          />
                          <span className="text-[10px] font-mono text-slate-500">{editingChartMeta.customOptions?.tt01OnTimeColor ?? '#0ea5e9'}</span>
                        </div>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-emerald-200/80">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Đã GQ quá hạn</label>
                        <input
                          type="text"
                          value={editingChartMeta.customOptions?.tt01LateName ?? 'Đã GQ quá hạn'}
                          onChange={(e) => setEditingChartMeta({
                            ...editingChartMeta,
                            customOptions: { ...editingChartMeta.customOptions, tt01LateName: e.target.value }
                          })}
                          className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded mb-1.5"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={editingChartMeta.customOptions?.tt01LateColor ?? '#f43f5e'}
                            onChange={(e) => setEditingChartMeta({
                              ...editingChartMeta,
                              customOptions: { ...editingChartMeta.customOptions, tt01LateColor: e.target.value }
                            })}
                            className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0.5"
                          />
                          <span className="text-[10px] font-mono text-slate-500">{editingChartMeta.customOptions?.tt01LateColor ?? '#f43f5e'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Cấu hình chú giải & màu sắc Quyết định 766 */}
                  <div className="p-3.5 bg-blue-50/40 border border-blue-200 rounded-xl space-y-3">
                    <div className="text-[11px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                      3. Cấu hình Màu sắc & Nhãn: Quyết định 766/QĐ-TTg (Bên phải)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="bg-white p-2.5 rounded-lg border border-blue-200/80">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Đã GQ trước hạn</label>
                        <input
                          type="text"
                          value={editingChartMeta.customOptions?.qd766EarlyName ?? 'Đã GQ trước hạn'}
                          onChange={(e) => setEditingChartMeta({
                            ...editingChartMeta,
                            customOptions: { ...editingChartMeta.customOptions, qd766EarlyName: e.target.value }
                          })}
                          className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded mb-1.5"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={editingChartMeta.customOptions?.qd766EarlyColor ?? '#10b981'}
                            onChange={(e) => setEditingChartMeta({
                              ...editingChartMeta,
                              customOptions: { ...editingChartMeta.customOptions, qd766EarlyColor: e.target.value }
                            })}
                            className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0.5"
                          />
                          <span className="text-[10px] font-mono text-slate-500">{editingChartMeta.customOptions?.qd766EarlyColor ?? '#10b981'}</span>
                        </div>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-blue-200/80">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Đã GQ đúng hạn</label>
                        <input
                          type="text"
                          value={editingChartMeta.customOptions?.qd766OnTimeName ?? 'Đã GQ đúng hạn'}
                          onChange={(e) => setEditingChartMeta({
                            ...editingChartMeta,
                            customOptions: { ...editingChartMeta.customOptions, qd766OnTimeName: e.target.value }
                          })}
                          className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded mb-1.5"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={editingChartMeta.customOptions?.qd766OnTimeColor ?? '#0ea5e9'}
                            onChange={(e) => setEditingChartMeta({
                              ...editingChartMeta,
                              customOptions: { ...editingChartMeta.customOptions, qd766OnTimeColor: e.target.value }
                            })}
                            className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0.5"
                          />
                          <span className="text-[10px] font-mono text-slate-500">{editingChartMeta.customOptions?.qd766OnTimeColor ?? '#0ea5e9'}</span>
                        </div>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-blue-200/80">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Đang GQ trong hạn</label>
                        <input
                          type="text"
                          value={editingChartMeta.customOptions?.qd766PendingInTermName ?? 'Đang GQ trong hạn'}
                          onChange={(e) => setEditingChartMeta({
                            ...editingChartMeta,
                            customOptions: { ...editingChartMeta.customOptions, qd766PendingInTermName: e.target.value }
                          })}
                          className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded mb-1.5"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={editingChartMeta.customOptions?.qd766PendingInTermColor ?? '#f59e0b'}
                            onChange={(e) => setEditingChartMeta({
                              ...editingChartMeta,
                              customOptions: { ...editingChartMeta.customOptions, qd766PendingInTermColor: e.target.value }
                            })}
                            className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0.5"
                          />
                          <span className="text-[10px] font-mono text-slate-500">{editingChartMeta.customOptions?.qd766PendingInTermColor ?? '#f59e0b'}</span>
                        </div>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-blue-200/80">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Đã GQ quá hạn + Đang trễ</label>
                        <input
                          type="text"
                          value={editingChartMeta.customOptions?.qd766OverdueName ?? 'Đã GQ quá hạn + Đang GQ trễ hạn'}
                          onChange={(e) => setEditingChartMeta({
                            ...editingChartMeta,
                            customOptions: { ...editingChartMeta.customOptions, qd766OverdueName: e.target.value }
                          })}
                          className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded mb-1.5"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={editingChartMeta.customOptions?.qd766OverdueColor ?? '#ef4444'}
                            onChange={(e) => setEditingChartMeta({
                              ...editingChartMeta,
                              customOptions: { ...editingChartMeta.customOptions, qd766OverdueColor: e.target.value }
                            })}
                            className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0.5"
                          />
                          <span className="text-[10px] font-mono text-slate-500">{editingChartMeta.customOptions?.qd766OverdueColor ?? '#ef4444'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 4. Ghi chú chân biểu đồ */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                      4. Ghi chú / Căn cứ bổ sung chân biểu đồ (Tùy chọn)
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200/80">
                      <textarea
                        rows={2}
                        value={editingChartMeta.customOptions?.chartNote ?? ''}
                        onChange={(e) => setEditingChartMeta({
                          ...editingChartMeta,
                          customOptions: { ...editingChartMeta.customOptions, chartNote: e.target.value }
                        })}
                        placeholder="Nhập ghi chú hoặc căn cứ hiển thị ở chân biểu đồ..."
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-800 resize-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TÙY CHỈNH CHÚ GIẢI, MÀU SẮC CHO BIỂU ĐỒ HIỆU NĂNG ĐƠN VỊ (RANKING) */}
              {editingChartMeta.id === 'ranking' && (
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                      Tùy chỉnh Nội dung Các Tab, Chú giải & Màu sắc
                    </h4>
                  </div>

                  {/* 1. Tùy chỉnh Tên hiển thị của 3 Tab */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                      1. Tên hiển thị các Tab trên biểu đồ
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3 rounded-lg border border-slate-200/80">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Tên Tab 1 (Đối chiếu)
                        </label>
                        <input
                          type="text"
                          value={editingChartMeta.customOptions?.tab1Label ?? 'Đối chiếu 2 cách tính'}
                          onChange={(e) => setEditingChartMeta({
                            ...editingChartMeta,
                            customOptions: { ...editingChartMeta.customOptions, tab1Label: e.target.value }
                          })}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Tên Tab 2 (QĐ 766)
                        </label>
                        <input
                          type="text"
                          value={editingChartMeta.customOptions?.tab2Label ?? 'QĐ 766 (Toàn diện)'}
                          onChange={(e) => setEditingChartMeta({
                            ...editingChartMeta,
                            customOptions: { ...editingChartMeta.customOptions, tab2Label: e.target.value }
                          })}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Tên Tab 3 (TT 01)
                        </label>
                        <input
                          type="text"
                          value={editingChartMeta.customOptions?.tab3Label ?? 'TT 01 (Đã giải quyết)'}
                          onChange={(e) => setEditingChartMeta({
                            ...editingChartMeta,
                            customOptions: { ...editingChartMeta.customOptions, tab3Label: e.target.value }
                          })}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. Ghi chú / Chú thích bổ sung chân biểu đồ */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                      2. Ghi chú / Chú thích bổ sung chân biểu đồ (Tùy chọn)
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200/80">
                      <textarea
                        rows={2}
                        value={editingChartMeta.customOptions?.chartNote ?? ''}
                        onChange={(e) => setEditingChartMeta({
                          ...editingChartMeta,
                          customOptions: { ...editingChartMeta.customOptions, chartNote: e.target.value }
                        })}
                        placeholder="Nhập ghi chú hoặc căn cứ hiển thị ở chân biểu đồ (để trống nếu không muốn hiển thị)..."
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-800 resize-none"
                      />
                    </div>
                  </div>

                  {/* 3. Cấu hình Chú giải & Màu sắc Tab 1: Đối chiếu 2 cách tính */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                      3. Cấu hình Chú giải & Màu sắc: Tab Đối chiếu 2 cách tính
                    </div>

                    {/* Cột 1 */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                          <input
                            type="checkbox"
                            checked={editingChartMeta.customOptions?.showCompBar !== false}
                            onChange={(e) => setEditingChartMeta({
                              ...editingChartMeta,
                              customOptions: { ...editingChartMeta.customOptions, showCompBar: e.target.checked }
                            })}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                          />
                          <span>Hiển thị Cột 1 (Đã giải quyết trước + đúng hạn)</span>
                        </label>
                      </div>
                      {editingChartMeta.customOptions?.showCompBar !== false && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center pt-1">
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Tên chú giải Cột 1 (Trước + Đúng hạn)
                            </label>
                            <input
                              type="text"
                              value={editingChartMeta.customOptions?.compBarName ?? 'Đã giải quyết trước + đúng hạn (hồ sơ)'}
                              onChange={(e) => setEditingChartMeta({
                                ...editingChartMeta,
                                customOptions: { ...editingChartMeta.customOptions, compBarName: e.target.value }
                              })}
                              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-800"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Màu cột 1</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={editingChartMeta.customOptions?.compBarColor ?? '#10b981'}
                                onChange={(e) => setEditingChartMeta({
                                  ...editingChartMeta,
                                  customOptions: { ...editingChartMeta.customOptions, compBarColor: e.target.value }
                                })}
                                className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0.5"
                              />
                              <span className="text-xs font-mono font-medium text-slate-700">
                                {editingChartMeta.customOptions?.compBarColor ?? '#10b981'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Cột 2 */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                          <input
                            type="checkbox"
                            checked={editingChartMeta.customOptions?.showQd766Bar !== false}
                            onChange={(e) => setEditingChartMeta({
                              ...editingChartMeta,
                              customOptions: { ...editingChartMeta.customOptions, showQd766Bar: e.target.checked }
                            })}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                          />
                          <span>Hiển thị Cột 2 (Đúng hạn theo QĐ 766)</span>
                        </label>
                      </div>

                      {editingChartMeta.customOptions?.showQd766Bar !== false && (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center pt-1">
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Tên chú giải Cột 2
                              </label>
                              <input
                                type="text"
                                value={editingChartMeta.customOptions?.qd766BarName ?? 'Đã giải quyết đúng hạn theo cách tính của 766'}
                                onChange={(e) => setEditingChartMeta({
                                  ...editingChartMeta,
                                  customOptions: { ...editingChartMeta.customOptions, qd766BarName: e.target.value }
                                })}
                                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-800"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Màu cột 2</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={editingChartMeta.customOptions?.qd766BarColor ?? '#3b82f6'}
                                  onChange={(e) => setEditingChartMeta({
                                    ...editingChartMeta,
                                    customOptions: { ...editingChartMeta.customOptions, qd766BarColor: e.target.value }
                                  })}
                                  className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0.5"
                                />
                                <span className="text-xs font-mono font-medium text-slate-700">
                                  {editingChartMeta.customOptions?.qd766BarColor ?? '#3b82f6'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Công thức tính */}
                          <div className="pt-2 border-t border-slate-100">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                              Cách tính số lượng cột 766:
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              <label className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                                (editingChartMeta.customOptions?.qd766CalcMode ?? 'standard') === 'standard'
                                  ? 'bg-blue-50/70 border-blue-300 text-blue-900 font-medium'
                                  : 'bg-white border-slate-200 text-slate-600'
                              }`}>
                                <input
                                  type="radio"
                                  name="qd766CalcMode"
                                  checked={(editingChartMeta.customOptions?.qd766CalcMode ?? 'standard') === 'standard'}
                                  onChange={() => setEditingChartMeta({
                                    ...editingChartMeta,
                                    customOptions: { ...editingChartMeta.customOptions, qd766CalcMode: 'standard' }
                                  })}
                                  className="mt-0.5"
                                />
                                <div>
                                  <span className="font-semibold">Chuẩn QĐ 766</span>
                                  <span className="block text-[10px] text-slate-500">Trước hạn, đúng hạn + Tồn trong hạn</span>
                                </div>
                              </label>

                              <label className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                                editingChartMeta.customOptions?.qd766CalcMode === 'resolved_only'
                                  ? 'bg-blue-50/70 border-blue-300 text-blue-900 font-medium'
                                  : 'bg-white border-slate-200 text-slate-600'
                              }`}>
                                <input
                                  type="radio"
                                  name="qd766CalcMode"
                                  checked={editingChartMeta.customOptions?.qd766CalcMode === 'resolved_only'}
                                  onChange={() => setEditingChartMeta({
                                    ...editingChartMeta,
                                    customOptions: { ...editingChartMeta.customOptions, qd766CalcMode: 'resolved_only' }
                                  })}
                                  className="mt-0.5"
                                />
                                <div>
                                  <span className="font-semibold">Chỉ hồ sơ đã giải quyết</span>
                                  <span className="block text-[10px] text-slate-500">Trước hạn + Đúng hạn (Không cộng tồn)</span>
                                </div>
                              </label>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Đường 1 (TT 01) */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                          <input
                            type="checkbox"
                            checked={editingChartMeta.customOptions?.showOnTimeLine !== false}
                            onChange={(e) => setEditingChartMeta({
                              ...editingChartMeta,
                              customOptions: { ...editingChartMeta.customOptions, showOnTimeLine: e.target.checked }
                            })}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                          />
                          <span>Hiển thị Đường 1 (Tỷ lệ đúng hạn TT 01)</span>
                        </label>
                      </div>
                      {editingChartMeta.customOptions?.showOnTimeLine !== false && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center pt-1">
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Tên chú giải Đường 1
                            </label>
                            <input
                              type="text"
                              value={editingChartMeta.customOptions?.onTimeLineName ?? 'Tỷ lệ đúng hạn TT 01 (%)'}
                              onChange={(e) => setEditingChartMeta({
                                ...editingChartMeta,
                                customOptions: { ...editingChartMeta.customOptions, onTimeLineName: e.target.value }
                              })}
                              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-800"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Màu đường 1</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={editingChartMeta.customOptions?.onTimeLineColor ?? '#e11d48'}
                                onChange={(e) => setEditingChartMeta({
                                  ...editingChartMeta,
                                  customOptions: { ...editingChartMeta.customOptions, onTimeLineColor: e.target.value }
                                })}
                                className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0.5"
                              />
                              <span className="text-xs font-mono font-medium text-slate-700">
                                {editingChartMeta.customOptions?.onTimeLineColor ?? '#e11d48'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Đường 2 (QĐ 766) */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                          <input
                            type="checkbox"
                            checked={editingChartMeta.customOptions?.showQd766Line !== false}
                            onChange={(e) => setEditingChartMeta({
                              ...editingChartMeta,
                              customOptions: { ...editingChartMeta.customOptions, showQd766Line: e.target.checked }
                            })}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                          />
                          <span>Hiển thị Đường 2 (Tỷ lệ theo QĐ 766)</span>
                        </label>
                      </div>
                      {editingChartMeta.customOptions?.showQd766Line !== false && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center pt-1">
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Tên chú giải Đường 2 (QĐ 766)
                            </label>
                            <input
                              type="text"
                              value={editingChartMeta.customOptions?.qd766LineName ?? 'Tỷ lệ theo QĐ 766 (%)'}
                              onChange={(e) => setEditingChartMeta({
                                ...editingChartMeta,
                                customOptions: { ...editingChartMeta.customOptions, qd766LineName: e.target.value }
                              })}
                              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-800"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Màu đường 2</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={editingChartMeta.customOptions?.qd766LineColor ?? '#2563eb'}
                                onChange={(e) => setEditingChartMeta({
                                  ...editingChartMeta,
                                  customOptions: { ...editingChartMeta.customOptions, qd766LineColor: e.target.value }
                                })}
                                className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0.5"
                              />
                              <span className="text-xs font-mono font-medium text-slate-700">
                                {editingChartMeta.customOptions?.qd766LineColor ?? '#2563eb'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 4. Cấu hình Chú giải & Màu sắc Tab 2: QĐ 766 (Toàn diện) */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                      4. Cấu hình Chú giải & Màu sắc: Tab QĐ 766 (Toàn diện)
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3 rounded-lg border border-slate-200/80 items-center">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Tên chú giải Cột Đạt chuẩn hạn
                        </label>
                        <input
                          type="text"
                          value={editingChartMeta.customOptions?.qd766TabOnTimeBarName ?? 'Đạt chuẩn hạn theo QĐ 766'}
                          onChange={(e) => setEditingChartMeta({
                            ...editingChartMeta,
                            customOptions: { ...editingChartMeta.customOptions, qd766TabOnTimeBarName: e.target.value }
                          })}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Màu cột Đạt hạn</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={editingChartMeta.customOptions?.qd766TabOnTimeBarColor ?? '#2563eb'}
                            onChange={(e) => setEditingChartMeta({
                              ...editingChartMeta,
                              customOptions: { ...editingChartMeta.customOptions, qd766TabOnTimeBarColor: e.target.value }
                            })}
                            className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0.5"
                          />
                          <span className="text-xs font-mono font-medium text-slate-700">
                            {editingChartMeta.customOptions?.qd766TabOnTimeBarColor ?? '#2563eb'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3 rounded-lg border border-slate-200/80 items-center">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Tên chú giải Cột Quá hạn
                        </label>
                        <input
                          type="text"
                          value={editingChartMeta.customOptions?.qd766TabOverdueBarName ?? 'Tổng quá hạn (Đã trễ + Đang trễ)'}
                          onChange={(e) => setEditingChartMeta({
                            ...editingChartMeta,
                            customOptions: { ...editingChartMeta.customOptions, qd766TabOverdueBarName: e.target.value }
                          })}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Màu cột Quá hạn</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={editingChartMeta.customOptions?.qd766TabOverdueBarColor ?? '#ef4444'}
                            onChange={(e) => setEditingChartMeta({
                              ...editingChartMeta,
                              customOptions: { ...editingChartMeta.customOptions, qd766TabOverdueBarColor: e.target.value }
                            })}
                            className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0.5"
                          />
                          <span className="text-xs font-mono font-medium text-slate-700">
                            {editingChartMeta.customOptions?.qd766TabOverdueBarColor ?? '#ef4444'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3 rounded-lg border border-slate-200/80 items-center">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Tên chú giải Đường Tỷ lệ đúng hạn QĐ 766
                        </label>
                        <input
                          type="text"
                          value={editingChartMeta.customOptions?.qd766TabLineName ?? 'Tỷ lệ đúng hạn QĐ 766 (%)'}
                          onChange={(e) => setEditingChartMeta({
                            ...editingChartMeta,
                            customOptions: { ...editingChartMeta.customOptions, qd766TabLineName: e.target.value }
                          })}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Màu đường Tỷ lệ</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={editingChartMeta.customOptions?.qd766TabLineColor ?? '#2563eb'}
                            onChange={(e) => setEditingChartMeta({
                              ...editingChartMeta,
                              customOptions: { ...editingChartMeta.customOptions, qd766TabLineColor: e.target.value }
                            })}
                            className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0.5"
                          />
                          <span className="text-xs font-mono font-medium text-slate-700">
                            {editingChartMeta.customOptions?.qd766TabLineColor ?? '#2563eb'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 5. Cấu hình Chú giải & Màu sắc Tab 3: TT 01 (Đã giải quyết) */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                      5. Cấu hình Chú giải & Màu sắc: Tab TT 01 (Đã giải quyết)
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3 rounded-lg border border-slate-200/80 items-center">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Tên chú giải Cột Đúng & Trước hạn
                        </label>
                        <input
                          type="text"
                          value={editingChartMeta.customOptions?.tt01TabOnTimeBarName ?? 'Đã giải quyết Đúng & Trước hạn'}
                          onChange={(e) => setEditingChartMeta({
                            ...editingChartMeta,
                            customOptions: { ...editingChartMeta.customOptions, tt01TabOnTimeBarName: e.target.value }
                          })}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Màu cột Đúng hạn</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={editingChartMeta.customOptions?.tt01TabOnTimeBarColor ?? '#10b981'}
                            onChange={(e) => setEditingChartMeta({
                              ...editingChartMeta,
                              customOptions: { ...editingChartMeta.customOptions, tt01TabOnTimeBarColor: e.target.value }
                            })}
                            className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0.5"
                          />
                          <span className="text-xs font-mono font-medium text-slate-700">
                            {editingChartMeta.customOptions?.tt01TabOnTimeBarColor ?? '#10b981'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3 rounded-lg border border-slate-200/80 items-center">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Tên chú giải Cột Quá hạn
                        </label>
                        <input
                          type="text"
                          value={editingChartMeta.customOptions?.tt01TabLateBarName ?? 'Đã giải quyết Quá hạn'}
                          onChange={(e) => setEditingChartMeta({
                            ...editingChartMeta,
                            customOptions: { ...editingChartMeta.customOptions, tt01TabLateBarName: e.target.value }
                          })}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Màu cột Quá hạn</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={editingChartMeta.customOptions?.tt01TabLateBarColor ?? '#f43f5e'}
                            onChange={(e) => setEditingChartMeta({
                              ...editingChartMeta,
                              customOptions: { ...editingChartMeta.customOptions, tt01TabLateBarColor: e.target.value }
                            })}
                            className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0.5"
                          />
                          <span className="text-xs font-mono font-medium text-slate-700">
                            {editingChartMeta.customOptions?.tt01TabLateBarColor ?? '#f43f5e'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3 rounded-lg border border-slate-200/80 items-center">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Tên chú giải Đường Tỷ lệ đúng hạn TT 01
                        </label>
                        <input
                          type="text"
                          value={editingChartMeta.customOptions?.tt01TabLineName ?? 'Tỷ lệ đúng hạn TT 01 (%)'}
                          onChange={(e) => setEditingChartMeta({
                            ...editingChartMeta,
                            customOptions: { ...editingChartMeta.customOptions, tt01TabLineName: e.target.value }
                          })}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Màu đường Tỷ lệ</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={editingChartMeta.customOptions?.tt01TabLineColor ?? '#059669'}
                            onChange={(e) => setEditingChartMeta({
                              ...editingChartMeta,
                              customOptions: { ...editingChartMeta.customOptions, tt01TabLineColor: e.target.value }
                            })}
                            className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0.5"
                          />
                          <span className="text-xs font-mono font-medium text-slate-700">
                            {editingChartMeta.customOptions?.tt01TabLineColor ?? '#059669'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 6. Đường chuẩn mục tiêu */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                        6. Đường chuẩn mục tiêu (Reference Line)
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={editingChartMeta.customOptions?.showRefLine === true}
                          onChange={(e) => setEditingChartMeta({
                            ...editingChartMeta,
                            customOptions: { ...editingChartMeta.customOptions, showRefLine: e.target.checked }
                          })}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                        />
                        <span>Hiển thị đường chuẩn</span>
                      </label>
                    </div>

                    {editingChartMeta.customOptions?.showRefLine && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center bg-white p-2.5 rounded-lg border border-slate-200/80 animate-fade-in">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Nhãn hiển thị (Để trống nếu không muốn hiện chữ)
                          </label>
                          <input
                            type="text"
                            value={editingChartMeta.customOptions?.refLineLabel ?? ''}
                            onChange={(e) => setEditingChartMeta({
                              ...editingChartMeta,
                              customOptions: { ...editingChartMeta.customOptions, refLineLabel: e.target.value }
                            })}
                            placeholder="Nhập nhãn hoặc để trống..."
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Mức chuẩn (%)</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={editingChartMeta.customOptions?.refLineValue ?? 95}
                            onChange={(e) => setEditingChartMeta({
                              ...editingChartMeta,
                              customOptions: { ...editingChartMeta.customOptions, refLineValue: Number(e.target.value) }
                            })}
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Màu đường</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={editingChartMeta.customOptions?.refLineColor ?? '#f43f5e'}
                              onChange={(e) => setEditingChartMeta({
                                ...editingChartMeta,
                                customOptions: { ...editingChartMeta.customOptions, refLineColor: e.target.value }
                              })}
                              className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0.5"
                            />
                            <span className="text-xs font-mono font-medium text-slate-700">
                              {editingChartMeta.customOptions?.refLineColor ?? '#f43f5e'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-blue-50/80 border border-blue-200/70 rounded-xl p-3 text-xs text-blue-800 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  Thay đổi sẽ được áp dụng ngay lập tức và tự động lưu đồng bộ vào cấu hình hệ thống cho tất cả người dùng.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/70">
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
      )}

      {/* MODAL GIẢI THÍCH CHUYÊN SÂU BẢN CHẤT 2 CÁCH TÍNH (TT 01/2018 VS QĐ 766/QĐ-TTg) */}
      {showMethodologyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50/80 via-slate-50 to-emerald-50/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Bản chất & Phương pháp tính toán: TT 01/2018 vs QĐ 766/QĐ-TTg
                  </h3>
                  <p className="text-xs text-slate-500">
                    So sánh đối chiếu khoa học giữa cách tính truyền thống và bộ chỉ số Cổng Dịch vụ công Quốc gia
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMethodologyModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
              {/* Bảng so sánh trực diện */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  1. Bảng đối chiếu 6 chiều phân tích bản chất
                </h4>
                <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="p-3 font-bold text-slate-700 w-1/4">Tiêu chí phân tích</th>
                        <th className="p-3 font-bold text-emerald-800 bg-emerald-50/70 w-[37.5%] border-l border-r border-slate-200">
                          Thông tư 01/2018/TT-VPCP (Truyền thống)
                        </th>
                        <th className="p-3 font-bold text-blue-900 bg-blue-50/70 w-[37.5%]">
                          Quyết định 766/QĐ-TTg (Thủ tướng Chính phủ)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="p-3 font-semibold text-slate-700 bg-slate-50/30">1. Triết lý đánh giá</td>
                        <td className="p-3 text-slate-700 bg-emerald-50/20 border-l border-r border-slate-200">
                          Đo lường <b>kết quả đầu ra</b> của những việc đã hoàn thành xong trong kỳ báo cáo.
                        </td>
                        <td className="p-3 text-slate-700 bg-blue-50/20">
                          Đánh giá <b>toàn diện trách nhiệm công vụ</b> trên toàn bộ khối lượng tiếp nhận cần giải quyết.
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-slate-700 bg-slate-50/30">2. Mẫu số (Tập khảo sát)</td>
                        <td className="p-3 text-slate-800 font-medium bg-emerald-50/20 border-l border-r border-slate-200">
                          <b>Tổng số hồ sơ ĐÃ GIẢI QUYẾT</b><br />
                          <code className="text-[11px] text-emerald-800 font-mono">compTotal = Trước hạn + Đúng hạn + Trễ hạn</code>
                        </td>
                        <td className="p-3 text-slate-800 font-medium bg-blue-50/20">
                          <b>TỔNG SỐ HỒ SƠ TIẾP NHẬN</b><br />
                          <code className="text-[11px] text-blue-800 font-mono">recTotal = Tiếp nhận mới + Kỳ trước chuyển qua</code>
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-slate-700 bg-slate-50/30">3. Tiêu chí Đúng hạn (Tử số)</td>
                        <td className="p-3 text-slate-700 bg-emerald-50/20 border-l border-r border-slate-200">
                          Hồ sơ giải quyết Trước hạn + Đúng hạn<br />
                          <code className="text-[11px] text-emerald-800 font-mono">compEarly + compOnTime</code>
                        </td>
                        <td className="p-3 text-slate-700 bg-blue-50/20">
                          Hồ sơ giải quyết đúng hạn + <b>Hồ sơ đang xử lý còn trong hạn</b><br />
                          <code className="text-[11px] text-blue-800 font-mono">(compEarly + compOnTime) + pendOnTime</code>
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-slate-700 bg-slate-50/30">4. Hồ sơ chậm trễ (Điểm trừ)</td>
                        <td className="p-3 text-slate-700 bg-emerald-50/20 border-l border-r border-slate-200">
                          Chỉ tính hồ sơ đã trả kết quả trễ hạn (<code className="text-red-700 font-mono">compLate</code>).
                        </td>
                        <td className="p-3 text-slate-700 bg-blue-50/20">
                          Tính cả hồ sơ đã trả trễ hạn <b>VÀ hồ sơ đang thụ lý bị quá hạn</b> (<code className="text-red-700 font-mono">compLate + pendLate</code>).
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-slate-700 bg-slate-50/30">5. Kẽ hở / Rủi ro số liệu</td>
                        <td className="p-3 text-slate-700 bg-emerald-50/20 border-l border-r border-slate-200">
                          <span className="text-amber-800 font-medium">Dễ bị "làm đẹp số liệu"</span>: Nếu đơn vị có hồ sơ quá hạn nhưng "om" lại không trả kết quả thì tỷ lệ vẫn đạt 100%!
                        </td>
                        <td className="p-3 text-slate-700 bg-blue-50/20">
                          <span className="text-emerald-800 font-medium">Chống om hồ sơ triệt để</span>: Ngay khi hồ sơ đang thụ lý bị quá hạn, hệ thống trừ điểm ngay lập tức.
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-slate-700 bg-slate-50/30">6. Công thức tỷ lệ (%)</td>
                        <td className="p-3 bg-emerald-50/20 border-l border-r border-slate-200">
                          <div className="p-2 bg-white rounded border border-emerald-200 font-mono text-[11px] text-emerald-900 font-bold">
                            Tỷ lệ Đúng hạn = (Trước hạn + Đúng hạn) / Tổng đã giải quyết * 100%
                          </div>
                        </td>
                        <td className="p-3 bg-blue-50/20">
                          <div className="p-2 bg-white rounded border border-blue-200 font-mono text-[11px] text-blue-900 font-bold">
                            Tỷ lệ QĐ 766 = [ (Trước hạn + Đúng hạn) + Đang xử lý trong hạn ] / Tổng tiếp nhận * 100%
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tình huống thực tế minh họa */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  2. Ví dụ so sánh thực tiễn (Casestudy)
                </h4>
                <div className="text-xs text-slate-700 leading-relaxed space-y-1.5">
                  <p>
                    Giả sử một Đơn vị tiếp nhận <b>100 hồ sơ</b>. Trong kỳ:
                  </p>
                  <ul className="list-disc pl-5 space-y-0.5 text-slate-600">
                    <li>Đã giải quyết <b>20 hồ sơ</b>: 19 hồ sơ đúng hạn, 1 hồ sơ trễ hạn.</li>
                    <li>Đang giải quyết <b>80 hồ sơ</b>: 70 hồ sơ còn trong hạn, <b>10 hồ sơ đã bị quá hạn</b>.</li>
                  </ul>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="p-3 bg-white border border-emerald-200 rounded-lg shadow-2xs">
                      <div className="font-bold text-emerald-900 mb-1">Cách tính TT 01/2018:</div>
                      <div className="text-sm font-mono text-emerald-700 font-black">
                        19 / 20 = 95.0%
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Chỉ tính trên 20 hồ sơ đã trả kết quả. Bỏ qua hoàn toàn 10 hồ sơ đang ngâm quá hạn!
                      </div>
                    </div>
                    <div className="p-3 bg-white border border-blue-200 rounded-lg shadow-2xs">
                      <div className="font-bold text-blue-900 mb-1">Cách tính Quyết định 766:</div>
                      <div className="text-sm font-mono text-blue-700 font-black">
                        (19 + 70) / 100 = 89.0%
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Tính trên toàn bộ 100 hồ sơ; trừ thẳng 11 hồ sơ trễ hạn (1 đã trễ + 10 đang trễ).
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end px-6 py-3.5 border-t border-slate-100 bg-slate-50 shrink-0">
              <button
                type="button"
                onClick={() => setShowMethodologyModal(false)}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit KPI Card Modal */}
      {editingKpiId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                  <Pencil className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900">Tùy chỉnh Thẻ KPI Trọng điểm</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingKpiId(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tiêu đề thẻ KPI <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editKpiTitle}
                  onChange={(e) => setEditKpiTitle(e.target.value)}
                  placeholder="Nhập tiêu đề thẻ..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Chú thích / Công thức gợi nhớ
                </label>
                <input
                  type="text"
                  value={editKpiSubtitle}
                  onChange={(e) => setEditKpiSubtitle(e.target.value)}
                  placeholder="Nhập chú thích hoặc công thức..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-normal text-slate-800"
                />
              </div>

              {editSubCards.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-slate-100 max-h-60 overflow-y-auto pr-1">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Tùy chỉnh các thẻ con bên trong:
                  </div>
                  {editSubCards.map((sc, index) => (
                    <div key={sc.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="text-[11px] font-bold text-blue-600">Thẻ con #{index + 1} ({sc.id})</div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Tiêu đề thẻ con</label>
                        <input
                          type="text"
                          value={sc.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditSubCards(prev => prev.map(s => s.id === sc.id ? { ...s, title: val } : s));
                          }}
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Chú thích thẻ con</label>
                        <input
                          type="text"
                          value={sc.subtitle}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditSubCards(prev => prev.map(s => s.id === sc.id ? { ...s, subtitle: val } : s));
                          }}
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-normal text-slate-800"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/70">
              <button
                type="button"
                onClick={() => setEditingKpiId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => saveKpiEdit(editingKpiId)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Table Headers Modal (Admin only) */}
      {isEditingTableHeadersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl shadow-2xs">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Tùy biến Tiêu đề các Cột Header Bảng Chi tiết
                  </h3>
                  <p className="text-xs text-slate-500">
                    Quản trị viên tùy chỉnh tên hiển thị của các khối và từng cột trong Bảng chi tiết số liệu
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingTableHeadersModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Nhóm 1: Cột định danh & đánh giá chung */}
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <FolderKanban className="w-3.5 h-3.5 text-blue-600" />
                  1. Cột định danh và Đánh giá tổng hợp
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cột STT</label>
                    <input
                      type="text"
                      value={draftTableHeaders.stt ?? ''}
                      onChange={(e) => setDraftTableHeaders({ ...draftTableHeaders, stt: e.target.value })}
                      placeholder="STT"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cột Lĩnh vực</label>
                    <input
                      type="text"
                      value={draftTableHeaders.field ?? ''}
                      onChange={(e) => setDraftTableHeaders({ ...draftTableHeaders, field: e.target.value })}
                      placeholder="Lĩnh vực"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cột Đơn vị thực hiện</label>
                    <input
                      type="text"
                      value={draftTableHeaders.unit ?? ''}
                      onChange={(e) => setDraftTableHeaders({ ...draftTableHeaders, unit: e.target.value })}
                      placeholder="Đơn vị thực hiện"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nhãn QĐ 776 / QĐ 766</label>
                    <input
                      type="text"
                      value={draftTableHeaders.qd776_label ?? ''}
                      onChange={(e) => setDraftTableHeaders({ ...draftTableHeaders, qd776_label: e.target.value })}
                      placeholder="(QĐ 776)"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Tiêu đề Tỷ lệ Đúng hạn QĐ 776</label>
                    <input
                      type="text"
                      value={draftTableHeaders.qd776_rate_ontime ?? ''}
                      onChange={(e) => setDraftTableHeaders({ ...draftTableHeaders, qd776_rate_ontime: e.target.value })}
                      placeholder="% Đúng hạn"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Tiêu đề Tỷ lệ Quá hạn QĐ 776</label>
                    <input
                      type="text"
                      value={draftTableHeaders.qd776_rate_overdue ?? ''}
                      onChange={(e) => setDraftTableHeaders({ ...draftTableHeaders, qd776_rate_overdue: e.target.value })}
                      placeholder="% Quá hạn"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                </div>
              </div>

              {/* Nhóm 2: Khối TIẾP NHẬN */}
              <div className="bg-[#F1F9F4]/70 p-4 rounded-xl border border-[#BADBCC] space-y-3">
                <h4 className="text-xs font-bold text-[#0F5132] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                  2. Khối Số hồ sơ tiếp nhận
                </h4>
                <div>
                  <label className="block text-[11px] font-semibold text-[#0F5132] mb-1">Tiêu đề Khối tiếp nhận</label>
                  <input
                    type="text"
                    value={draftTableHeaders.received_group ?? ''}
                    onChange={(e) => setDraftTableHeaders({ ...draftTableHeaders, received_group: e.target.value })}
                    placeholder="SỐ HỒ SƠ TIẾP NHẬN"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-[#BADBCC] rounded-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cột Tổng số</label>
                    <input
                      type="text"
                      value={draftTableHeaders.received_total ?? ''}
                      onChange={(e) => setDraftTableHeaders({ ...draftTableHeaders, received_total: e.target.value })}
                      placeholder="Tổng số"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cột Trong kỳ</label>
                    <input
                      type="text"
                      value={draftTableHeaders.received_in_period ?? ''}
                      onChange={(e) => setDraftTableHeaders({ ...draftTableHeaders, received_in_period: e.target.value })}
                      placeholder="Trong kỳ"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cột Trực tuyến</label>
                    <input
                      type="text"
                      value={draftTableHeaders.received_online ?? ''}
                      onChange={(e) => setDraftTableHeaders({ ...draftTableHeaders, received_online: e.target.value })}
                      placeholder="Trực tuyến"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cột Trực tiếp / BC</label>
                    <input
                      type="text"
                      value={draftTableHeaders.received_offline ?? ''}
                      onChange={(e) => setDraftTableHeaders({ ...draftTableHeaders, received_offline: e.target.value })}
                      placeholder="Trực tiếp / BC"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cột Từ kỳ trước</label>
                    <input
                      type="text"
                      value={draftTableHeaders.received_carried ?? ''}
                      onChange={(e) => setDraftTableHeaders({ ...draftTableHeaders, received_carried: e.target.value })}
                      placeholder="Từ kỳ trước"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    />
                  </div>
                </div>
              </div>

              {/* Nhóm 3: Khối ĐÃ GIẢI QUYẾT */}
              <div className="bg-[#FFF9E6]/70 p-4 rounded-xl border border-[#FFECB5] space-y-3">
                <h4 className="text-xs font-bold text-[#664D03] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  3. Khối Số lượng hồ sơ đã giải quyết
                </h4>
                <div>
                  <label className="block text-[11px] font-semibold text-[#664D03] mb-1">Tiêu đề Khối đã giải quyết</label>
                  <input
                    type="text"
                    value={draftTableHeaders.resolved_group ?? ''}
                    onChange={(e) => setDraftTableHeaders({ ...draftTableHeaders, resolved_group: e.target.value })}
                    placeholder="SỐ LƯỢNG HỒ SƠ ĐÃ GIẢI QUYẾT"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-[#FFECB5] rounded-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cột Tổng số</label>
                    <input
                      type="text"
                      value={draftTableHeaders.resolved_total ?? ''}
                      onChange={(e) => setDraftTableHeaders({ ...draftTableHeaders, resolved_total: e.target.value })}
                      placeholder="Tổng số"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cột Trước hạn</label>
                    <input
                      type="text"
                      value={draftTableHeaders.resolved_early ?? ''}
                      onChange={(e) => setDraftTableHeaders({ ...draftTableHeaders, resolved_early: e.target.value })}
                      placeholder="Trước hạn"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cột Đúng hạn</label>
                    <input
                      type="text"
                      value={draftTableHeaders.resolved_ontime ?? ''}
                      onChange={(e) => setDraftTableHeaders({ ...draftTableHeaders, resolved_ontime: e.target.value })}
                      placeholder="Đúng hạn"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cột Quá hạn</label>
                    <input
                      type="text"
                      value={draftTableHeaders.resolved_late ?? ''}
                      onChange={(e) => setDraftTableHeaders({ ...draftTableHeaders, resolved_late: e.target.value })}
                      placeholder="Quá hạn"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cột Tỷ lệ khi xem % Đúng hạn</label>
                    <input
                      type="text"
                      value={draftTableHeaders.resolved_rate_ontime ?? ''}
                      onChange={(e) => setDraftTableHeaders({ ...draftTableHeaders, resolved_rate_ontime: e.target.value })}
                      placeholder="% Đúng hạn"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cột Tỷ lệ khi xem % Quá hạn</label>
                    <input
                      type="text"
                      value={draftTableHeaders.resolved_rate_overdue ?? ''}
                      onChange={(e) => setDraftTableHeaders({ ...draftTableHeaders, resolved_rate_overdue: e.target.value })}
                      placeholder="% Quá hạn"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                    />
                  </div>
                </div>
              </div>

              {/* Nhóm 4: Khối ĐANG GIẢI QUYẾT */}
              <div className="bg-[#E7F1FF]/70 p-4 rounded-xl border border-[#B6D4FE] space-y-3">
                <h4 className="text-xs font-bold text-[#084298] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                  4. Khối Số lượng hồ sơ đang giải quyết
                </h4>
                <div>
                  <label className="block text-[11px] font-semibold text-[#084298] mb-1">Tiêu đề Khối đang giải quyết</label>
                  <input
                    type="text"
                    value={draftTableHeaders.pending_group ?? ''}
                    onChange={(e) => setDraftTableHeaders({ ...draftTableHeaders, pending_group: e.target.value })}
                    placeholder="SỐ LƯỢNG HỒ SƠ ĐANG GIẢI QUYẾT"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-[#B6D4FE] rounded-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cột Tổng số</label>
                    <input
                      type="text"
                      value={draftTableHeaders.pending_total ?? ''}
                      onChange={(e) => setDraftTableHeaders({ ...draftTableHeaders, pending_total: e.target.value })}
                      placeholder="Tổng số"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cột Trong hạn</label>
                    <input
                      type="text"
                      value={draftTableHeaders.pending_ontime ?? ''}
                      onChange={(e) => setDraftTableHeaders({ ...draftTableHeaders, pending_ontime: e.target.value })}
                      placeholder="Trong hạn"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cột Quá hạn</label>
                    <input
                      type="text"
                      value={draftTableHeaders.pending_late ?? ''}
                      onChange={(e) => setDraftTableHeaders({ ...draftTableHeaders, pending_late: e.target.value })}
                      placeholder="Quá hạn"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cột Tỷ lệ khi xem % Trong hạn</label>
                    <input
                      type="text"
                      value={draftTableHeaders.pending_rate_ontime ?? ''}
                      onChange={(e) => setDraftTableHeaders({ ...draftTableHeaders, pending_rate_ontime: e.target.value })}
                      placeholder="% Trong hạn"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cột Tỷ lệ khi xem % Quá hạn</label>
                    <input
                      type="text"
                      value={draftTableHeaders.pending_rate_overdue ?? ''}
                      onChange={(e) => setDraftTableHeaders({ ...draftTableHeaders, pending_rate_overdue: e.target.value })}
                      placeholder="% Quá hạn"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-blue-50/80 border border-blue-200/70 rounded-xl p-3 text-xs text-blue-800 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  Tiêu đề các cột sau khi lưu sẽ được cập nhật ngay lập tức và đồng bộ cho tất cả người dùng trong hệ thống.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end px-6 py-4 border-t border-slate-100 bg-slate-50/70 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingTableHeadersModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveTableHeaders(draftTableHeaders)}
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
