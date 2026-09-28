import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  store,
  SystemConfig,
  PublicDisplayConfig,
  AnnouncementItem,
  DEFAULT_PUBLIC_DISPLAY_CONFIG,
} from '../services/store';
import { OneStopLogo } from '../components/OneStopLogo';
import { formatNumber, formatPercent, formatDate } from '../utils/format';
import { resolveLinhVuc } from '../utils/fieldResolver';
import {
  calcCompletionRate,
  calcOnTimeRate,
  calcLateRate,
  calcPendingLateRate,
  calcOverdueRateQD776,
  calcOnlineRate,
} from '../features/analysis/formulas';
import { fetchLiveDashboardData } from '../services/dashboardService';
import type { ReportingPeriod, ReportStatistic, Unit, Field } from '../types/database';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import {
  Maximize,
  Minimize,
  RefreshCw,
  Clock,
  CheckCircle2,
  FileText,
  Building2,
  Globe,
  QrCode,
  Radio,
  Play,
  Pause,
  ChevronDown,
  Settings,
  PhoneCall,
  MapPin,
  TrendingUp,
  Award,
  Megaphone,
  BellRing,
  HelpCircle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';

// Compact QR Code SVG
const SimpleQrCodeSvg: React.FC<{ value: string; size?: number; isDark?: boolean }> = ({
  size = 84,
  isDark = false,
}) => (
  <div
    className={`p-2 rounded-xl border flex flex-col items-center justify-center shrink-0 transition-all duration-300 ${
      isDark
        ? 'bg-slate-900 border-slate-700 shadow-sm'
        : 'bg-white border-slate-200 shadow-xs'
    }`}
  >
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill={isDark ? '#0F172A' : '#FFFFFF'} rx="6" />
      {/* Corner 1 */}
      <rect x="10" y="10" width="24" height="24" rx="3" fill={isDark ? '#38BDF8' : '#C4121A'} />
      <rect x="14" y="14" width="16" height="16" rx="2" fill={isDark ? '#0F172A' : '#FFFFFF'} />
      <rect x="18" y="18" width="8" height="8" rx="1" fill={isDark ? '#38BDF8' : '#C4121A'} />

      {/* Corner 2 */}
      <rect x="66" y="10" width="24" height="24" rx="3" fill={isDark ? '#38BDF8' : '#C4121A'} />
      <rect x="70" y="14" width="16" height="16" rx="2" fill={isDark ? '#0F172A' : '#FFFFFF'} />
      <rect x="74" y="18" width="8" height="8" rx="1" fill={isDark ? '#38BDF8' : '#C4121A'} />

      {/* Corner 3 */}
      <rect x="10" y="66" width="24" height="24" rx="3" fill={isDark ? '#38BDF8' : '#C4121A'} />
      <rect x="14" y="70" width="16" height="16" rx="2" fill={isDark ? '#0F172A' : '#FFFFFF'} />
      <rect x="18" y="74" width="8" height="8" rx="1" fill={isDark ? '#38BDF8' : '#C4121A'} />

      {/* Matrix data dots */}
      <rect x="42" y="12" width="6" height="6" rx="1" fill={isDark ? '#94A3B8' : '#475569'} />
      <rect x="52" y="12" width="6" height="6" rx="1" fill={isDark ? '#94A3B8' : '#475569'} />
      <rect x="42" y="24" width="6" height="6" rx="1" fill={isDark ? '#94A3B8' : '#475569'} />
      <rect x="52" y="24" width="6" height="6" rx="1" fill={isDark ? '#94A3B8' : '#475569'} />
      <rect x="42" y="36" width="16" height="6" rx="1" fill={isDark ? '#38BDF8' : '#C4121A'} />

      <rect x="12" y="44" width="6" height="6" rx="1" fill={isDark ? '#94A3B8' : '#475569'} />
      <rect x="24" y="44" width="6" height="6" rx="1" fill={isDark ? '#94A3B8' : '#475569'} />
      <rect x="12" y="54" width="18" height="6" rx="1" fill={isDark ? '#94A3B8' : '#475569'} />

      <rect x="44" y="50" width="8" height="8" rx="2" fill={isDark ? '#38BDF8' : '#C4121A'} />
      <rect x="58" y="50" width="14" height="6" rx="1" fill={isDark ? '#94A3B8' : '#475569'} />
      <rect x="44" y="64" width="16" height="6" rx="1" fill={isDark ? '#94A3B8' : '#475569'} />
      <rect x="68" y="66" width="22" height="22" rx="3" fill={isDark ? '#38BDF8' : '#2563EB'} />
      <rect x="74" y="72" width="10" height="10" rx="1" fill={isDark ? '#0F172A' : '#FFFFFF'} />
      <rect x="44" y="78" width="14" height="10" rx="1" fill={isDark ? '#94A3B8' : '#475569'} />
    </svg>
  </div>
);

export const PublicDashboard: React.FC = () => {
  const [sysConfig, setSysConfig] = useState<SystemConfig>(store.getSystemConfig());
  const currentUser = store.getCurrentUser();
  const isAdmin = currentUser.role === 'admin';

  // Live Data State
  const [periods, setPeriods] = useState<ReportingPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [stats, setStats] = useState<ReportStatistic[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Carousel & Controls
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isAutoScroll, setIsAutoScroll] = useState<boolean>(false);
  const [activeAnnIndex, setActiveAnnIndex] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef<any>(null);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setSysConfig(store.getSystemConfig());
    });
    return unsub;
  }, []);

  const displayConfig: PublicDisplayConfig = useMemo(() => {
    const rawDisplay = sysConfig.publicDisplay || ({} as any);
    const defaultWidgets = DEFAULT_PUBLIC_DISPLAY_CONFIG.widgets;
    const existingWidgets = rawDisplay.widgets?.length ? rawDisplay.widgets : defaultWidgets;

    // Ensure all default widget types are present, especially announcements_news
    const mergedWidgets = [...existingWidgets];
    for (const defW of defaultWidgets) {
      const found = mergedWidgets.find((w) => w.id === defW.id || w.type === defW.type);
      if (!found) {
        mergedWidgets.push({ ...defW, visible: true });
      } else if (found.type === 'announcements_news') {
        // Ensure announcements widget is visible
        found.visible = true;
      }
    }

    const announcements =
      rawDisplay.announcements && rawDisplay.announcements.length > 0
        ? rawDisplay.announcements
        : DEFAULT_PUBLIC_DISPLAY_CONFIG.announcements;

    return {
      ...DEFAULT_PUBLIC_DISPLAY_CONFIG,
      ...rawDisplay,
      widgets: mergedWidgets,
      announcements,
    };
  }, [sysConfig]);

  // Active Announcements for Display (fallback to all announcements if none marked active)
  const activeAnnouncements = useMemo(() => {
    const list = displayConfig.announcements || [];
    const activeOnly = list.filter((a) => a.active);
    return activeOnly.length > 0 ? activeOnly : list.length > 0 ? list : DEFAULT_PUBLIC_DISPLAY_CONFIG.announcements;
  }, [displayConfig.announcements]);

  // Auto-rotate announcement slides every 7 seconds
  useEffect(() => {
    if (activeAnnouncements.length <= 1) return;
    const interval = setInterval(() => {
      setActiveAnnIndex((prev) => (prev + 1) % activeAnnouncements.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [activeAnnouncements.length]);

  // Real-time Clock (1s)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Live Data
  const loadData = useCallback(async (periodId?: string) => {
    try {
      setIsLoading(true);
      const data = await fetchLiveDashboardData(periodId);
      setPeriods(data.reports || []);
      setSelectedPeriodId(data.currentReport?.id || data.reports[0]?.id || '');
      setStats(data.statistics || []);
      setUnits(data.units || []);
      setFields(data.fields || []);
    } catch (err) {
      console.error('Lỗi khi tải số liệu công khai cho TV:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto Refresh Interval
  useEffect(() => {
    const refreshSec = displayConfig.autoRefreshSeconds || 30;
    const interval = setInterval(() => {
      loadData(selectedPeriodId);
    }, refreshSec * 1000);
    return () => clearInterval(interval);
  }, [selectedPeriodId, loadData, displayConfig.autoRefreshSeconds]);

  // Auto-scroll loop
  useEffect(() => {
    if (!isAutoScroll) {
      if (scrollTimerRef.current) clearInterval(scrollTimerRef.current);
      return;
    }

    let direction = 1;
    scrollTimerRef.current = setInterval(() => {
      const el = containerRef.current;
      if (!el) return;

      const maxScroll = el.scrollHeight - el.clientHeight;
      if (maxScroll <= 0) return;

      const step = displayConfig.autoScrollSpeed || 1;
      if (el.scrollTop >= maxScroll - 5) {
        direction = -1;
      } else if (el.scrollTop <= 5) {
        direction = 1;
      }

      el.scrollBy({ top: direction * step * 2, behavior: 'smooth' });
    }, 100);

    return () => {
      if (scrollTimerRef.current) clearInterval(scrollTimerRef.current);
    };
  }, [isAutoScroll, displayConfig.autoScrollSpeed]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn(`Fullscreen error: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  // --- Aggregate Stats Calculations ---
  const totals = useMemo(() => {
    return stats.reduce(
      (acc, curr) => {
        const rOnline = Number(curr.received_online || 0);
        const rOffline = Number(curr.received_offline || 0);
        const rForward = Number(curr.carried_forward || 0);
        const rTotal = curr.received_total ? Number(curr.received_total) : rOnline + rOffline + rForward;

        const cEarly = Number(curr.completed_early || 0);
        const cOnTime = Number(curr.completed_on_time || 0);
        const cLate = Number(curr.completed_late || 0);
        const cTotal = curr.completed_total ? Number(curr.completed_total) : cEarly + cOnTime + cLate;

        const pInTerm = Number(curr.pending_on_time || 0);
        const pLate = Number(curr.pending_late || 0);
        const pTotal = curr.pending_total ? Number(curr.pending_total) : pInTerm + pLate;

        acc.received_online += rOnline;
        acc.received_offline += rOffline;
        acc.received_total += rTotal;
        acc.received_from_prev += rForward;
        acc.received_new += rOnline + rOffline;

        acc.completed_early += cEarly;
        acc.completed_on_time += cOnTime;
        acc.completed_late += cLate;
        acc.completed_total += cTotal;

        acc.pending_in_term += pInTerm;
        acc.pending_overdue += pLate;
        acc.pending_total += pTotal;

        return acc;
      },
      {
        received_online: 0,
        received_offline: 0,
        received_total: 0,
        received_from_prev: 0,
        received_new: 0,
        completed_early: 0,
        completed_on_time: 0,
        completed_late: 0,
        completed_total: 0,
        pending_in_term: 0,
        pending_overdue: 0,
        pending_total: 0,
      }
    );
  }, [stats]);

  // KPIs
  const onTimeRate = calcOnTimeRate(totals.completed_early, totals.completed_on_time, totals.completed_total);
  const onlineRate = calcOnlineRate(totals.received_online, totals.received_offline);
  const completionRate = calcCompletionRate(totals.completed_total, totals.received_total);

  // Unit Stats
  const unitStats = useMemo(() => {
    return units
      .map((u) => {
        const uStats = stats.filter((s) => s.unit_id === u.id);
        const uReceived = uStats.reduce((sum, s) => {
          const rTotal = s.received_total ? Number(s.received_total) : Number(s.received_online || 0) + Number(s.received_offline || 0) + Number(s.carried_forward || 0);
          return sum + rTotal;
        }, 0);
        const uEarly = uStats.reduce((sum, s) => sum + Number(s.completed_early || 0), 0);
        const uOnTime = uStats.reduce((sum, s) => sum + Number(s.completed_on_time || 0), 0);
        const uLate = uStats.reduce((sum, s) => sum + Number(s.completed_late || 0), 0);
        const uCompleted = uEarly + uOnTime + uLate;
        const uPendingIn = uStats.reduce((sum, s) => sum + Number(s.pending_on_time || 0), 0);
        const uPendingLate = uStats.reduce((sum, s) => sum + Number(s.pending_late || 0), 0);
        const uOnTimeRate = uCompleted > 0 ? ((uEarly + uOnTime) / uCompleted) * 100 : 100;

        return {
          id: u.id,
          name: u.name,
          received: uReceived,
          completed: uCompleted,
          early: uEarly,
          onTime: uOnTime,
          late: uLate,
          pendingIn: uPendingIn,
          pendingLate: uPendingLate,
          onTimeRate: uOnTimeRate,
        };
      })
      .filter((u) => u.received > 0 || u.completed > 0)
      .sort((a, b) => b.received - a.received);
  }, [units, stats]);

  // Top Fields
  const topFields = useMemo(() => {
    const map = new Map<string, { name: string; received: number; online: number; completed: number; onTime: number }>();
    stats.forEach((s) => {
      const fName = resolveLinhVuc(s.field_id, s.field_name, fields);
      const existing = map.get(fName) || { name: fName, received: 0, online: 0, completed: 0, onTime: 0 };
      const rTotal = s.received_total ? Number(s.received_total) : Number(s.received_online || 0) + Number(s.received_offline || 0) + Number(s.carried_forward || 0);
      existing.received += rTotal;
      existing.online += Number(s.received_online || 0);
      const completed = Number(s.completed_early || 0) + Number(s.completed_on_time || 0) + Number(s.completed_late || 0);
      existing.completed += completed;
      existing.onTime += Number(s.completed_early || 0) + Number(s.completed_on_time || 0);
      map.set(fName, existing);
    });

    return Array.from(map.values())
      .sort((a, b) => b.received - a.received)
      .slice(0, 6);
  }, [stats, fields]);

  // Channel Breakdown
  const channelData = useMemo(() => {
    return [
      { name: 'DVC Trực tuyến', value: totals.received_online, color: '#2563EB' },
      { name: 'Trực tiếp / Một cửa', value: totals.received_offline, color: '#D97706' },
      { name: 'Kỳ trước chuyển qua', value: totals.received_from_prev, color: '#64748B' },
    ].filter((d) => d.value > 0);
  }, [totals]);

  // Quality Breakdown
  const qualityData = useMemo(() => {
    return [
      { name: 'Trước hạn', value: totals.completed_early, color: '#16A34A' },
      { name: 'Đúng hạn', value: totals.completed_on_time, color: '#2563EB' },
      { name: 'Quá hạn', value: totals.completed_late, color: '#DC2626' },
    ].filter((d) => d.value > 0);
  }, [totals]);

  const timeString = currentTime.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const dateString = currentTime.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  // Harmonious theme styling
  const theme = displayConfig.themeStyle || 'clean_light';

  const themeClasses = useMemo(() => {
    if (theme === 'dark_cyber' || theme === 'glass_morphism') {
      return {
        isDark: true,
        bg: 'bg-[#0B132B] text-slate-100',
        headerBg: 'bg-[#1C2541] border-b border-slate-700/80 shadow-md',
        cardBg: 'bg-[#1C2541] border border-slate-700/70 shadow-md',
        titleText: 'text-white',
        accentText: 'text-sky-400',
        subText: 'text-slate-400',
        kpiCardBg: 'bg-[#1C2541] border border-slate-700/80',
        footerBg: 'bg-[#0F172A] border-t border-slate-800 text-slate-300',
      };
    }
    if (theme === 'red_luxury') {
      return {
        isDark: true,
        bg: 'bg-[#2D0609] text-white',
        headerBg: 'bg-[#40080C] border-b border-red-900/60 shadow-md',
        cardBg: 'bg-[#3B0A0E] border border-red-900/50 shadow-md',
        titleText: 'text-amber-300',
        accentText: 'text-amber-400',
        subText: 'text-rose-200/70',
        kpiCardBg: 'bg-[#450B10] border border-red-900/60',
        footerBg: 'bg-[#230406] border-t border-red-950 text-rose-100',
      };
    }
    // Default: Clean Light Standard (Crisp, High Contrast, Professional)
    return {
      isDark: false,
      bg: 'bg-[#F4F6F9] text-slate-800',
      headerBg: 'bg-white border-b border-slate-200 shadow-xs',
      cardBg: 'bg-white border border-slate-200/90 shadow-xs',
      titleText: 'text-slate-900',
      accentText: 'text-[#C4121A]',
      subText: 'text-slate-500',
      kpiCardBg: 'bg-white border border-slate-200 shadow-xs',
      footerBg: 'bg-slate-900 border-t border-slate-800 text-slate-200',
    };
  }, [theme]);

  // Helper for col-span with smooth CSS transitions
  const getColSpanClass = (width: string) => {
    switch (width) {
      case '12':
        return 'col-span-12';
      case '8':
        return 'col-span-12 lg:col-span-8';
      case '6':
        return 'col-span-12 lg:col-span-6';
      case '4':
        return 'col-span-12 lg:col-span-4';
      default:
        return 'col-span-12 lg:col-span-6';
    }
  };

  const sortedWidgets = useMemo(() => {
    return [...displayConfig.widgets]
      .filter((w) => w.visible)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [displayConfig.widgets]);

  // Running marquee combined text
  const fullMarqueeText = useMemo(() => {
    const customText = displayConfig.marqueeText?.trim() || '';
    const activeMarqueeAnns = activeAnnouncements
      .filter((a) => a.showOnMarquee)
      .map((a) => `★ ${a.title.toUpperCase()}: ${a.content}`);

    if (activeMarqueeAnns.length > 0) {
      return [customText, ...activeMarqueeAnns].filter(Boolean).join('   |   ');
    }
    return customText;
  }, [displayConfig.marqueeText, activeAnnouncements]);

  return (
    <div
      ref={containerRef}
      className={`min-h-screen w-full flex flex-col transition-colors duration-300 select-none overflow-x-hidden ${themeClasses.bg}`}
      style={{ fontFamily: "'Be Vietnam Pro', 'Inter', sans-serif" }}
    >
      {/* 1. TOP HEADER */}
      <header className={`sticky top-0 z-40 px-5 py-3 transition-all duration-300 ${themeClasses.headerBg}`}>
        <div className="max-w-[1920px] mx-auto flex items-center justify-between gap-4">
          {/* Logo & Agency Title */}
          <div className="flex items-center gap-3.5 min-w-0">
            <OneStopLogo
              size={50}
              customLogoUrl={
                displayConfig.logoDisplayType === 'custom_url'
                  ? displayConfig.customLogoUrl || sysConfig.logoUrl
                  : displayConfig.logoDisplayType === 'system' && sysConfig.logoType === 'custom_url'
                  ? sysConfig.logoUrl
                  : undefined
              }
              mainTitle={displayConfig.mainTitle}
              subTitle={displayConfig.subTitle}
              slogan={displayConfig.slogan}
              isDark={themeClasses.isDark}
            />
          </div>

          {/* Right: Live Clock, Period Filter & Action Controls */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Real-time Clock */}
            {displayConfig.showClock && (
              <div
                className={`flex flex-col items-end px-3 py-1.5 rounded-lg border text-right transition-all duration-300 ${
                  themeClasses.isDark
                    ? 'bg-black/30 border-slate-700/70 text-slate-200'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 text-base sm:text-lg font-extrabold tracking-wider tabular-nums">
                  <Clock className={`w-4 h-4 ${themeClasses.isDark ? 'text-sky-400' : 'text-blue-600'}`} />
                  <span className={themeClasses.isDark ? 'text-white' : 'text-slate-900'}>{timeString}</span>
                </div>
                <div className="text-[11px] font-medium text-slate-500 capitalize">
                  {dateString}
                </div>
              </div>
            )}

            {/* Reporting Period Selector */}
            {periods.length > 1 && (
              <div className="relative">
                <select
                  value={selectedPeriodId}
                  onChange={(e) => {
                    setSelectedPeriodId(e.target.value);
                    loadData(e.target.value);
                  }}
                  className={`pl-3 pr-8 py-2 text-xs font-bold rounded-lg border appearance-none cursor-pointer focus:outline-none focus:ring-2 transition-all duration-200 ${
                    themeClasses.isDark
                      ? 'bg-slate-800 border-slate-700 text-white focus:ring-sky-500'
                      : 'bg-white border-slate-300 text-slate-800 focus:ring-blue-600'
                  }`}
                >
                  {periods.map((p) => (
                    <option key={p.id} value={p.id} className={themeClasses.isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                      {(p as any).report_name || (p as any).title || (p as any).period_name || 'Kỳ báo cáo'} ({formatDate((p as any).period_start || (p as any).start_date || '')} - {formatDate((p as any).period_end || (p as any).end_date || '')})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}

            {/* Toolbar Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => loadData(selectedPeriodId)}
                className={`p-2 rounded-lg border transition-all duration-200 cursor-pointer ${
                  themeClasses.isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 shadow-2xs'
                }`}
                title="Làm mới số liệu"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => setIsAutoScroll(!isAutoScroll)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 flex items-center gap-1 cursor-pointer ${
                  isAutoScroll
                    ? 'bg-blue-600 text-white border-blue-600'
                    : themeClasses.isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 shadow-2xs'
                }`}
                title="Tự động cuộn trang"
              >
                {isAutoScroll ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Cuộn</span>
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                className={`p-2 rounded-lg border transition-all duration-200 cursor-pointer ${
                  themeClasses.isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 shadow-2xs'
                }`}
                title="Toàn màn hình (F11)"
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>

              {isAdmin && (
                <Link
                  to="/admin/settings"
                  className={`p-2 rounded-lg border transition-all duration-200 cursor-pointer ${
                    themeClasses.isDark
                      ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 shadow-2xs'
                  }`}
                  title="Cài đặt hệ thống"
                >
                  <Settings className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 2. MAIN CONTENT GRID (Smooth CSS Transitions for all widgets) */}
      <main className="flex-1 max-w-[1920px] w-full mx-auto p-4 sm:p-5 space-y-5">
        <div className="grid grid-cols-12 gap-4 transition-all duration-500 ease-in-out">
          {sortedWidgets.map((widget) => {
            const colSpan = getColSpanClass(widget.width);

            // 1. KPI Cards Widget
            if (widget.type === 'kpi_cards') {
              return (
                <div
                  key={widget.id}
                  className={`${colSpan} space-y-3 transition-all duration-500 ease-in-out transform`}
                >
                  {widget.title && (
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-4 rounded-full bg-blue-600" />
                        <h2 className={`text-sm font-bold uppercase tracking-wide ${themeClasses.titleText}`}>
                          {widget.title}
                        </h2>
                      </div>
                      {widget.subtitle && (
                        <span className={`text-xs ${themeClasses.subText}`}>
                          {widget.subtitle}
                        </span>
                      )}
                    </div>
                  )}

                  {/* 4 Clean Metric Cards with Smooth Transitions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {/* Card 1: Tổng tiếp nhận */}
                    <div className={`p-4 rounded-xl ${themeClasses.kpiCardBg} flex flex-col justify-between transition-all duration-300 hover:shadow-md`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <span className={`text-xs font-semibold ${themeClasses.subText} uppercase tracking-wide`}>
                            Tổng Tiếp Nhận
                          </span>
                          <div className={`text-3xl sm:text-4xl font-black tracking-tight mt-1 tabular-nums ${themeClasses.titleText}`}>
                            {formatNumber(totals.received_total)}
                          </div>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900/50 transition-transform duration-300 group-hover:scale-105">
                          <FileText className="w-5 h-5" />
                        </div>
                      </div>

                      <div className={`grid grid-cols-2 gap-2 mt-3.5 pt-2.5 border-t text-xs ${themeClasses.isDark ? 'border-slate-700/60' : 'border-slate-100'}`}>
                        <div className={`p-2 rounded-lg transition-colors ${themeClasses.isDark ? 'bg-slate-800/60' : 'bg-slate-50'}`}>
                          <div className="text-[10px] text-slate-500 font-medium">Trực tuyến DVC</div>
                          <div className="font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                            {formatNumber(totals.received_online)} ({formatPercent(onlineRate)})
                          </div>
                        </div>
                        <div className={`p-2 rounded-lg transition-colors ${themeClasses.isDark ? 'bg-slate-800/60' : 'bg-slate-50'}`}>
                          <div className="text-[10px] text-slate-500 font-medium">Trực tiếp / Chuyển qua</div>
                          <div className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                            {formatNumber(totals.received_offline + totals.received_from_prev)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Tỷ lệ Đúng và Trước hạn */}
                    <div className={`p-4 rounded-xl ${themeClasses.kpiCardBg} flex flex-col justify-between transition-all duration-300 hover:shadow-md`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <span className={`text-xs font-semibold ${themeClasses.subText} uppercase tracking-wide`}>
                            Tỷ Lệ Đúng và Trước Hạn
                          </span>
                          <div className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight mt-1 tabular-nums flex items-baseline gap-1.5">
                            <span>{formatPercent(onTimeRate)}</span>
                            {onTimeRate >= 95 && (
                              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                Đạt chuẩn
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-900/50">
                          <Award className="w-5 h-5" />
                        </div>
                      </div>

                      <div className={`mt-3.5 pt-2.5 border-t text-xs ${themeClasses.isDark ? 'border-slate-700/60' : 'border-slate-100'}`}>
                        <div className="flex items-center justify-between mb-1 text-[11px] font-medium text-slate-500">
                          <span>Chỉ tiêu QĐ 468/QĐ-TTg:</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">≥ 95.0%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-700 ease-out"
                            style={{ width: `${Math.min(100, Math.max(0, onTimeRate))}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Card 3: Đã Giải Quyết */}
                    <div className={`p-4 rounded-xl ${themeClasses.kpiCardBg} flex flex-col justify-between transition-all duration-300 hover:shadow-md`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <span className={`text-xs font-semibold ${themeClasses.subText} uppercase tracking-wide`}>
                            Đã Giải Quyết
                          </span>
                          <div className={`text-3xl sm:text-4xl font-black tracking-tight mt-1 tabular-nums ${themeClasses.titleText}`}>
                            {formatNumber(totals.completed_total)}
                          </div>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400 flex items-center justify-center shrink-0 border border-teal-100 dark:border-teal-900/50">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                      </div>

                      <div className={`grid grid-cols-3 gap-1 mt-3.5 pt-2.5 border-t text-xs text-center ${themeClasses.isDark ? 'border-slate-700/60' : 'border-slate-100'}`}>
                        <div className={`p-1 rounded transition-colors ${themeClasses.isDark ? 'bg-slate-800/60' : 'bg-slate-50'}`}>
                          <div className="text-[9px] text-slate-500">Trước hạn</div>
                          <div className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {formatNumber(totals.completed_early)}
                          </div>
                        </div>
                        <div className={`p-1 rounded transition-colors ${themeClasses.isDark ? 'bg-slate-800/60' : 'bg-slate-50'}`}>
                          <div className="text-[9px] text-slate-500">Đúng hạn</div>
                          <div className="font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                            {formatNumber(totals.completed_on_time)}
                          </div>
                        </div>
                        <div className={`p-1 rounded transition-colors ${themeClasses.isDark ? 'bg-slate-800/60' : 'bg-slate-50'}`}>
                          <div className="text-[9px] text-slate-500">Quá hạn</div>
                          <div className="font-bold text-red-600 dark:text-red-400 tabular-nums">
                            {formatNumber(totals.completed_late)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card 4: Đang Giải Quyết */}
                    <div className={`p-4 rounded-xl ${themeClasses.kpiCardBg} flex flex-col justify-between transition-all duration-300 hover:shadow-md`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <span className={`text-xs font-semibold ${themeClasses.subText} uppercase tracking-wide`}>
                            Đang Giải Quyết
                          </span>
                          <div className={`text-3xl sm:text-4xl font-black tracking-tight mt-1 tabular-nums ${themeClasses.titleText}`}>
                            {formatNumber(totals.pending_total)}
                          </div>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-100 dark:border-amber-900/50">
                          <Clock className="w-5 h-5" />
                        </div>
                      </div>

                      <div className={`grid grid-cols-2 gap-2 mt-3.5 pt-2.5 border-t text-xs ${themeClasses.isDark ? 'border-slate-700/60' : 'border-slate-100'}`}>
                        <div className={`p-2 rounded-lg transition-colors ${themeClasses.isDark ? 'bg-slate-800/60' : 'bg-slate-50'}`}>
                          <div className="text-[10px] text-slate-500 font-medium">Trong hạn</div>
                          <div className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {formatNumber(totals.pending_in_term)}
                          </div>
                        </div>
                        <div className={`p-2 rounded-lg transition-colors ${themeClasses.isDark ? 'bg-slate-800/60' : 'bg-slate-50'}`}>
                          <div className="text-[10px] text-slate-500 font-medium">Quá hạn</div>
                          <div className={`font-bold tabular-nums ${totals.pending_overdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500'}`}>
                            {formatNumber(totals.pending_overdue)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // 2. Unit Progress Widget
            if (widget.type === 'unit_progress') {
              return (
                <div
                  key={widget.id}
                  className={`${colSpan} ${themeClasses.cardBg} p-4 sm:p-5 rounded-xl space-y-3 transition-all duration-500 ease-in-out transform hover:shadow-md`}
                >
                  <div className={`flex items-center justify-between pb-2.5 border-b ${themeClasses.isDark ? 'border-slate-700/60' : 'border-slate-100'}`}>
                    <div className="flex items-center gap-2">
                      <Building2 className={`w-4 h-4 ${themeClasses.isDark ? 'text-sky-400' : 'text-blue-600'}`} />
                      <h3 className={`text-sm font-bold uppercase tracking-wide ${themeClasses.titleText}`}>
                        {widget.title}
                      </h3>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium transition-colors ${themeClasses.isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                      {unitStats.length} Đơn vị
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                    {unitStats.map((u, i) => (
                      <div
                        key={u.id}
                        className={`p-2.5 rounded-lg border space-y-1.5 transition-all duration-300 ${
                          themeClasses.isDark
                            ? 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/70'
                            : 'bg-slate-50/60 border-slate-200/60 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold flex items-center justify-center shrink-0">
                              {i + 1}
                            </span>
                            <span className={`font-bold truncate ${themeClasses.titleText}`}>{u.name}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className={`text-[11px] ${themeClasses.subText}`}>
                              Tiếp nhận: <strong className={themeClasses.titleText}>{formatNumber(u.received)}</strong>
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[11px] font-bold transition-colors ${
                                u.onTimeRate >= 95
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                              }`}
                            >
                              Đúng hạn: {formatPercent(u.onTimeRate)}
                            </span>
                          </div>
                        </div>

                        <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              u.onTimeRate >= 95 ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, u.onTimeRate))}%` }}
                          />
                        </div>
                      </div>
                    ))}

                    {unitStats.length === 0 && (
                      <div className="text-center py-6 text-xs text-slate-400">
                        Chưa có dữ liệu thống kê theo đơn vị
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // 3. Channel Breakdown Chart
            if (widget.type === 'channel_chart') {
              return (
                <div
                  key={widget.id}
                  className={`${colSpan} ${themeClasses.cardBg} p-4 sm:p-5 rounded-xl space-y-3 transition-all duration-500 ease-in-out transform hover:shadow-md`}
                >
                  <div className={`flex items-center justify-between pb-2 border-b ${themeClasses.isDark ? 'border-slate-700/60' : 'border-slate-100'}`}>
                    <div className="flex items-center gap-2">
                      <Globe className={`w-4 h-4 ${themeClasses.isDark ? 'text-sky-400' : 'text-blue-600'}`} />
                      <h3 className={`text-xs sm:text-sm font-bold uppercase tracking-wide ${themeClasses.titleText}`}>
                        {widget.title}
                      </h3>
                    </div>
                  </div>

                  <div className="h-[170px] w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={channelData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={42}
                          outerRadius={68}
                          paddingAngle={3}
                        >
                          {channelData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any) => [`${formatNumber(Number(value))} hồ sơ`, 'Số lượng']}
                          contentStyle={{
                            backgroundColor: themeClasses.isDark ? '#0F172A' : '#FFFFFF',
                            borderColor: themeClasses.isDark ? '#334155' : '#E2E8F0',
                            borderRadius: '8px',
                            color: themeClasses.isDark ? '#FFF' : '#0F172A',
                            fontSize: '11px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-1 text-xs">
                    {channelData.map((c) => (
                      <div
                        key={c.name}
                        className={`flex items-center justify-between p-1.5 rounded transition-colors ${
                          themeClasses.isDark ? 'bg-slate-800/40' : 'bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                          <span className={`text-[11px] font-medium ${themeClasses.titleText}`}>{c.name}</span>
                        </div>
                        <span className={`font-bold tabular-nums text-[11px] ${themeClasses.titleText}`}>
                          {formatNumber(c.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            // 4. Propaganda / Announcement News Widget (Clean, Professional & Highly Visible)
            if (widget.type === 'announcements_news') {
              const currentAnn = activeAnnouncements[activeAnnIndex] || activeAnnouncements[0];

              const getBadgeColor = (type: AnnouncementItem['type']) => {
                switch (type) {
                  case 'propaganda':
                    return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800';
                  case 'guide':
                    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
                  case 'policy':
                    return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
                  case 'urgent':
                    return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800';
                  default:
                    return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800';
                }
              };

              const getBadgeLabel = (type: AnnouncementItem['type']) => {
                switch (type) {
                  case 'propaganda':
                    return 'Tuyên truyền CCHC';
                  case 'guide':
                    return 'Hướng dẫn công dân';
                  case 'policy':
                    return 'Chính sách Một cửa';
                  case 'urgent':
                    return 'Thông báo khẩn';
                  default:
                    return 'Thông báo chung';
                }
              };

              return (
                <div
                  key={widget.id}
                  className={`${colSpan} ${themeClasses.cardBg} p-4 sm:p-5 rounded-xl flex flex-col justify-between space-y-3 transition-all duration-500 ease-in-out transform hover:shadow-md`}
                >
                  <div className={`flex items-center justify-between pb-2.5 border-b ${themeClasses.isDark ? 'border-slate-700/60' : 'border-slate-100'}`}>
                    <div className="flex items-center gap-2">
                      <Megaphone className={`w-4 h-4 ${themeClasses.isDark ? 'text-sky-400' : 'text-blue-600'}`} />
                      <h3 className={`text-sm font-bold uppercase tracking-wide ${themeClasses.titleText}`}>
                        {widget.title}
                      </h3>
                    </div>

                    {activeAnnouncements.length > 1 && (
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[11px] font-medium ${themeClasses.subText}`}>
                          {activeAnnIndex + 1}/{activeAnnouncements.length}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveAnnIndex(
                                (prev) => (prev - 1 + activeAnnouncements.length) % activeAnnouncements.length
                              )
                            }
                            className={`p-1 rounded border transition-colors cursor-pointer ${
                              themeClasses.isDark
                                ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300'
                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                            }`}
                            title="Bản tin trước"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveAnnIndex((prev) => (prev + 1) % activeAnnouncements.length)
                            }
                            className={`p-1 rounded border transition-colors cursor-pointer ${
                              themeClasses.isDark
                                ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300'
                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                            }`}
                            title="Bản tin tiếp"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {currentAnn ? (
                    <div className="space-y-3 flex-1 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-wider ${getBadgeColor(
                              currentAnn.type
                            )}`}
                          >
                            {getBadgeLabel(currentAnn.type)}
                          </span>
                          {currentAnn.publishDate && (
                            <span className={`text-[11px] ${themeClasses.subText}`}>
                              {formatDate(currentAnn.publishDate)}
                            </span>
                          )}
                          {currentAnn.author && (
                            <span className={`text-[11px] ${themeClasses.subText}`}>
                              • {currentAnn.author}
                            </span>
                          )}
                        </div>

                        <h4
                          className={`text-sm sm:text-base font-bold leading-snug transition-colors ${themeClasses.titleText}`}
                        >
                          {currentAnn.title}
                        </h4>

                        <p
                          className={`text-xs sm:text-sm leading-relaxed ${
                            themeClasses.isDark ? 'text-slate-300' : 'text-slate-600'
                          }`}
                        >
                          {currentAnn.content}
                        </p>
                      </div>

                      {/* Carousel Indicator Dots */}
                      {activeAnnouncements.length > 1 && (
                        <div className="flex items-center justify-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                          {activeAnnouncements.map((_, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setActiveAnnIndex(idx)}
                              className={`h-1.5 rounded-full transition-all duration-300 ${
                                idx === activeAnnIndex
                                  ? 'w-6 bg-blue-600 dark:bg-sky-400'
                                  : 'w-2 bg-slate-300 dark:bg-slate-700'
                              }`}
                              title={`Xem bản tin ${idx + 1}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-xs text-slate-400">
                      Chưa có bản tin tuyên truyền hoặc thông báo nào được kích hoạt
                    </div>
                  )}
                </div>
              );
            }

            // 5. Quality Breakdown Chart
            if (widget.type === 'quality_chart') {
              return (
                <div
                  key={widget.id}
                  className={`${colSpan} ${themeClasses.cardBg} p-4 sm:p-5 rounded-xl space-y-3 transition-all duration-500 ease-in-out transform hover:shadow-md`}
                >
                  <div className={`flex items-center justify-between pb-2 border-b ${themeClasses.isDark ? 'border-slate-700/60' : 'border-slate-100'}`}>
                    <div className="flex items-center gap-2">
                      <Award className={`w-4 h-4 ${themeClasses.isDark ? 'text-sky-400' : 'text-blue-600'}`} />
                      <h3 className={`text-xs sm:text-sm font-bold uppercase tracking-wide ${themeClasses.titleText}`}>
                        {widget.title}
                      </h3>
                    </div>
                  </div>

                  <div className="h-[170px] w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={qualityData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={42}
                          outerRadius={68}
                          paddingAngle={3}
                        >
                          {qualityData.map((entry, index) => (
                            <Cell key={`cell-q-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any) => [`${formatNumber(Number(value))} hồ sơ`, 'Số lượng']}
                          contentStyle={{
                            backgroundColor: themeClasses.isDark ? '#0F172A' : '#FFFFFF',
                            borderColor: themeClasses.isDark ? '#334155' : '#E2E8F0',
                            borderRadius: '8px',
                            color: themeClasses.isDark ? '#FFF' : '#0F172A',
                            fontSize: '11px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-1 text-xs">
                    {qualityData.map((q) => (
                      <div
                        key={q.name}
                        className={`flex items-center justify-between p-1.5 rounded transition-colors ${
                          themeClasses.isDark ? 'bg-slate-800/40' : 'bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: q.color }} />
                          <span className={`text-[11px] font-medium ${themeClasses.titleText}`}>{q.name}</span>
                        </div>
                        <span className={`font-bold tabular-nums text-[11px] ${themeClasses.titleText}`}>
                          {formatNumber(q.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            // 6. Field Ranking Widget
            if (widget.type === 'field_ranking') {
              return (
                <div
                  key={widget.id}
                  className={`${colSpan} ${themeClasses.cardBg} p-4 sm:p-5 rounded-xl space-y-3 transition-all duration-500 ease-in-out transform hover:shadow-md`}
                >
                  <div className={`flex items-center justify-between pb-2.5 border-b ${themeClasses.isDark ? 'border-slate-700/60' : 'border-slate-100'}`}>
                    <div className="flex items-center gap-2">
                      <TrendingUp className={`w-4 h-4 ${themeClasses.isDark ? 'text-sky-400' : 'text-blue-600'}`} />
                      <h3 className={`text-sm font-bold uppercase tracking-wide ${themeClasses.titleText}`}>
                        {widget.title}
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {topFields.map((f, i) => (
                      <div
                        key={f.name}
                        className={`p-2.5 rounded-lg border flex items-center justify-between gap-2.5 transition-all duration-300 ${
                          themeClasses.isDark
                            ? 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/70'
                            : 'bg-slate-50/60 border-slate-200/60 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <h4 className={`text-xs font-bold truncate ${themeClasses.titleText}`} title={f.name}>
                              {f.name}
                            </h4>
                            <span className={`text-[10px] ${themeClasses.subText}`}>
                              Trực tuyến: {formatNumber(f.online)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-xs font-black tabular-nums ${themeClasses.titleText}`}>
                            {formatNumber(f.received)}
                          </div>
                          <span className="text-[9px] text-slate-400 uppercase">Hồ sơ</span>
                        </div>
                      </div>
                    ))}

                    {topFields.length === 0 && (
                      <div className="col-span-2 text-center py-6 text-xs text-slate-400">
                        Chưa có dữ liệu thống kê lĩnh vực
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // 7. QR Code & Citizen Support Widget
            if (widget.type === 'qr_citizen_support') {
              return (
                <div
                  key={widget.id}
                  className={`${colSpan} ${themeClasses.cardBg} p-4 sm:p-5 rounded-xl flex flex-col justify-between space-y-3 transition-all duration-500 ease-in-out transform hover:shadow-md`}
                >
                  <div className={`flex items-center gap-2 pb-2 border-b ${themeClasses.isDark ? 'border-slate-700/60' : 'border-slate-100'}`}>
                    <QrCode className={`w-4 h-4 ${themeClasses.isDark ? 'text-sky-400' : 'text-blue-600'}`} />
                    <h3 className={`text-xs sm:text-sm font-bold uppercase tracking-wide ${themeClasses.titleText}`}>
                      {widget.title}
                    </h3>
                  </div>

                  <div className="flex flex-row items-center gap-3">
                    <SimpleQrCodeSvg value={displayConfig.qrCodeUrl} size={76} isDark={themeClasses.isDark} />

                    <div className="space-y-1.5 text-xs">
                      <div className={`font-bold leading-tight ${themeClasses.titleText}`}>
                        {displayConfig.qrCodeLabel || 'Cổng Dịch vụ công Quốc gia'}
                      </div>
                      <p className={`text-[11px] leading-snug ${themeClasses.subText}`}>
                        Quét mã QR để tra cứu tiến độ hồ sơ hoặc nộp hồ sơ DVC trực tuyến.
                      </p>

                      {displayConfig.hotlineText && (
                        <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          <PhoneCall className="w-3 h-3" />
                          <span>{displayConfig.hotlineText}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {displayConfig.addressText && (
                    <div className={`pt-2 border-t flex items-center gap-1.5 text-[10px] ${themeClasses.isDark ? 'border-slate-700/60 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{displayConfig.addressText}</span>
                    </div>
                  )}
                </div>
              );
            }

            return null;
          })}
        </div>
      </main>

      {/* 3. BOTTOM MARQUEE TICKER (Smooth running banner) */}
      <footer className={`sticky bottom-0 z-40 py-2 px-4 shadow-sm overflow-hidden flex items-center gap-3 transition-all duration-300 ${themeClasses.footerBg}`}>
        <div className="px-2 py-0.5 rounded bg-blue-600 text-white text-[11px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1">
          <Radio className="w-3 h-3 animate-pulse" />
          <span>Thông Báo</span>
        </div>

        <div className="flex-1 overflow-hidden whitespace-nowrap">
          <div
            className="animate-marquee inline-block text-xs font-medium tracking-wide"
            style={{ animationDuration: `${displayConfig.marqueeSpeed || 35}s` }}
          >
            {fullMarqueeText}
          </div>
        </div>
      </footer>
    </div>
  );
};
