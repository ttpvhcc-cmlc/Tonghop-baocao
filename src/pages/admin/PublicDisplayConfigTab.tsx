import React, { useState } from 'react';
import {
  SystemConfig,
  PublicDisplayConfig,
  PublicDisplayWidget,
  AnnouncementItem,
  DEFAULT_PUBLIC_DISPLAY_CONFIG,
} from '../../services/store';
import { OneStopLogo } from '../../components/OneStopLogo';
import {
  Tv,
  Layout,
  MoveUp,
  MoveDown,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  RotateCcw,
  Sparkles,
  QrCode,
  Megaphone,
  BellRing,
  HelpCircle,
  FileText,
  Clock,
  Palette,
  Columns,
  CheckCircle2,
} from 'lucide-react';

interface PublicDisplayConfigTabProps {
  config: SystemConfig;
  onChange: (updatedConfig: SystemConfig) => void;
}

export const PublicDisplayConfigTab: React.FC<PublicDisplayConfigTabProps> = ({ config, onChange }) => {
  const rawDisplay = config.publicDisplay || ({} as any);
  const defaultWidgets = DEFAULT_PUBLIC_DISPLAY_CONFIG.widgets;
  const existingWidgets = rawDisplay.widgets?.length ? rawDisplay.widgets : defaultWidgets;

  const mergedWidgets = [...existingWidgets];
  for (const defW of defaultWidgets) {
    if (!mergedWidgets.some((w) => w.id === defW.id || w.type === defW.type)) {
      mergedWidgets.push({ ...defW });
    }
  }

  const announcements =
    rawDisplay.announcements && rawDisplay.announcements.length > 0
      ? rawDisplay.announcements
      : DEFAULT_PUBLIC_DISPLAY_CONFIG.announcements;

  const displayConfig: PublicDisplayConfig = {
    ...DEFAULT_PUBLIC_DISPLAY_CONFIG,
    ...rawDisplay,
    widgets: mergedWidgets,
    announcements,
  };

  const [activeSubSection, setActiveSubSection] = useState<'layout' | 'announcements' | 'branding' | 'qr'>('layout');
  const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementItem | null>(null);
  const [isAnnModalOpen, setIsAnnModalOpen] = useState(false);

  const updateDisplayConfig = (partial: Partial<PublicDisplayConfig>) => {
    const updated: PublicDisplayConfig = {
      ...displayConfig,
      ...partial,
    };
    onChange({
      ...config,
      publicDisplay: updated,
    });
  };

  // --- Widget Management ---
  const handleToggleWidgetVisible = (widgetId: string) => {
    const updatedWidgets = displayConfig.widgets.map((w) =>
      w.id === widgetId ? { ...w, visible: !w.visible } : w
    );
    updateDisplayConfig({ widgets: updatedWidgets });
  };

  const handleUpdateWidget = (widgetId: string, updates: Partial<PublicDisplayWidget>) => {
    const updatedWidgets = displayConfig.widgets.map((w) =>
      w.id === widgetId ? { ...w, ...updates } : w
    );
    updateDisplayConfig({ widgets: updatedWidgets });
  };

  const handleMoveWidget = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= displayConfig.widgets.length) return;

    const list = [...displayConfig.widgets];
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    // update order numbers
    const updated = list.map((item, idx) => ({ ...item, order: idx + 1 }));
    updateDisplayConfig({ widgets: updated });
  };

  const handleResetWidgetLayout = () => {
    updateDisplayConfig({ widgets: [...DEFAULT_PUBLIC_DISPLAY_CONFIG.widgets] });
  };

  // --- Announcement Management ---
  const handleOpenCreateAnn = () => {
    setEditingAnnouncement({
      id: 'ann_' + Date.now(),
      title: '',
      content: '',
      type: 'propaganda',
      active: true,
      publishDate: new Date().toISOString().split('T')[0],
      author: 'Bộ phận Một cửa',
      priority: displayConfig.announcements.length + 1,
      showOnMarquee: true,
      showOnSlide: true,
    });
    setIsAnnModalOpen(true);
  };

  const handleOpenEditAnn = (ann: AnnouncementItem) => {
    setEditingAnnouncement({ ...ann });
    setIsAnnModalOpen(true);
  };

  const handleDeleteAnn = (annId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa nội dung thông báo / tuyên truyền này?')) return;
    const updated = displayConfig.announcements.filter((a) => a.id !== annId);
    updateDisplayConfig({ announcements: updated });
  };

  const handleSaveAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAnnouncement || !editingAnnouncement.title.trim()) return;

    let updatedList: AnnouncementItem[];
    const exists = displayConfig.announcements.some((a) => a.id === editingAnnouncement.id);
    if (exists) {
      updatedList = displayConfig.announcements.map((a) =>
        a.id === editingAnnouncement.id ? editingAnnouncement : a
      );
    } else {
      updatedList = [editingAnnouncement, ...displayConfig.announcements];
    }

    updateDisplayConfig({ announcements: updatedList });
    setIsAnnModalOpen(false);
    setEditingAnnouncement(null);
  };

  const themeOptions: Array<{ id: PublicDisplayConfig['themeStyle']; name: string; desc: string; previewClass: string }> = [
    {
      id: 'clean_light',
      name: 'Trắng Sáng Chuẩn Mực (Khuyên dùng)',
      desc: 'Nền sáng trang nhã, độ tương phản cao, dịu mắt và chuẩn công sở',
      previewClass: 'bg-slate-50 text-slate-800 border-slate-300',
    },
    {
      id: 'dark_cyber',
      name: 'Xanh Đen Kiosk Dịu Mắt (TV 55")',
      desc: 'Nền xanh Navy/Slate sâu không lóa mắt, hiển thị rõ nét từ xa',
      previewClass: 'bg-[#0B132B] text-sky-400 border-slate-700',
    },
    {
      id: 'red_luxury',
      name: 'Đỏ Đô Truyền Thống',
      desc: 'Nền đỏ mận trang nghiêm, thương hiệu Một cửa Quốc gia',
      previewClass: 'bg-[#3B0A0E] text-amber-300 border-red-900',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner & TV Preview Link */}
      <div className="bg-gradient-to-r from-red-900 via-rose-950 to-slate-900 rounded-2xl p-5 text-white shadow-sm border border-red-800/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
            <Tv className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold tracking-tight text-white">
                Thiết Kế Màn Hình Trình Chiếu TV 55" & Kiosk Công Khai
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-black border border-amber-400/40 uppercase">
                Live TV 4K/FHD
              </span>
            </div>
            <p className="text-xs text-rose-100/80 mt-1 max-w-2xl leading-relaxed">
              Tùy chỉnh biểu trưng Logo, tiêu đề đơn vị, sắp xếp kéo thả & thay đổi kích thước các khối thông tin, quản lý bản tin tuyên truyền và dòng chữ chạy cho màn hình đứng 55 inch công khai tại Bộ phận Một cửa.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0">
          <a
            href="/public/display"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-all shadow-md hover:scale-102 cursor-pointer w-full md:w-auto"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Mở Màn hình TV (/public/display)</span>
          </a>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveSubSection('layout')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors whitespace-nowrap ${
            activeSubSection === 'layout'
              ? 'bg-red-50 text-[#C4121A] border border-red-200'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layout className="w-4 h-4" />
          <span>Bố cục & Kích thước Khối Widget ({displayConfig.widgets.filter((w) => w.visible).length}/{displayConfig.widgets.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubSection('announcements')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors whitespace-nowrap ${
            activeSubSection === 'announcements'
              ? 'bg-red-50 text-[#C4121A] border border-red-200'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          <span>Đăng tải Thông báo & Tuyên truyền ({displayConfig.announcements.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubSection('branding')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors whitespace-nowrap ${
            activeSubSection === 'branding'
              ? 'bg-red-50 text-[#C4121A] border border-red-200'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Logo, Tiêu đề & Theme Màu</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubSection('qr')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors whitespace-nowrap ${
            activeSubSection === 'qr'
              ? 'bg-red-50 text-[#C4121A] border border-red-200'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>Mã QR & Chữ Chạy (Marquee)</span>
        </button>
      </div>

      {/* SUB-SECTION 1: WIDGET LAYOUT EDITOR */}
      {activeSubSection === 'layout' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Columns className="w-4 h-4 text-[#C4121A]" />
                Quản lý Danh sách Khối & Tùy chỉnh Kích thước (Grid 12 Cột)
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Thay đổi vị trí (Lên/Xuống), chỉnh sửa tên tiêu đề riêng từng khối, điều chỉnh độ rộng cột và ẩn/hiện theo nhu cầu trình chiếu của cơ quan.
              </p>
            </div>
          </div>

          {/* Widgets List */}
          <div className="space-y-3">
            {displayConfig.widgets.map((widget, index) => (
              <div
                key={widget.id}
                className={`p-4 rounded-2xl border transition-all duration-200 ${
                  widget.visible
                    ? 'bg-white border-slate-200 shadow-2xs hover:border-red-300'
                    : 'bg-slate-50/80 border-slate-200/60 opacity-60'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Reorder Controls + Name */}
                  <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                    {/* Order indicator & Reorder buttons */}
                    <div className="flex flex-col gap-1 items-center shrink-0">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMoveWidget(index, 'up')}
                        className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Di chuyển lên trên"
                      >
                        <MoveUp className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[11px] font-black text-slate-500 w-5 text-center">
                        #{index + 1}
                      </span>
                      <button
                        type="button"
                        disabled={index === displayConfig.widgets.length - 1}
                        onClick={() => handleMoveWidget(index, 'down')}
                        className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Di chuyển xuống dưới"
                      >
                        <MoveDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Widget Identity & Editable Title */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 uppercase tracking-wider">
                          Mã: {widget.id}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                          {widget.type === 'kpi_cards' && '4 Thẻ Chỉ số KPI Lớn'}
                          {widget.type === 'unit_progress' && 'Tiến độ Đơn vị / Phòng ban'}
                          {widget.type === 'channel_chart' && 'Biểu đồ Trực tuyến vs Trực tiếp'}
                          {widget.type === 'quality_chart' && 'Biểu đồ Chất lượng giải quyết'}
                          {widget.type === 'field_ranking' && 'Top Lĩnh vực phát sinh hồ sơ'}
                          {widget.type === 'announcements_news' && 'Bản tin Tuyên truyền & Thông báo'}
                          {widget.type === 'qr_citizen_support' && 'Quét mã QR & Hotline DVC'}
                          {widget.type === 'media_propaganda' && 'Áp phích / Banner Tuyên truyền'}
                          {widget.type === 'custom_text_card' && 'Khối Văn bản Tùy chỉnh'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                            Tiêu đề hiển thị trên TV:
                          </label>
                          <input
                            type="text"
                            value={widget.title}
                            onChange={(e) => handleUpdateWidget(widget.id, { title: e.target.value })}
                            className="w-full px-3 py-1.5 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-red-500 focus:outline-none"
                            placeholder="Nhập tiêu đề khối..."
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                            Mô tả phụ:
                          </label>
                          <input
                            type="text"
                            value={widget.subtitle || ''}
                            onChange={(e) => handleUpdateWidget(widget.id, { subtitle: e.target.value })}
                            className="w-full px-3 py-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-red-500 focus:outline-none"
                            placeholder="Nhập mô tả phụ..."
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Width Selector + Visibility Toggle */}
                  <div className="flex items-center gap-3 shrink-0 self-end lg:self-center border-t lg:border-t-0 pt-2 lg:pt-0 border-slate-100">
                    {/* Width selector */}
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-[10px] font-bold text-slate-500">Độ rộng màn hình:</span>
                      <select
                        value={widget.width}
                        onChange={(e) => handleUpdateWidget(widget.id, { width: e.target.value as any })}
                        className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-red-500 cursor-pointer"
                      >
                        <option value="12">Toàn màn hình (100% - 12/12)</option>
                        <option value="8">Rộng 2/3 (66.6% - 8/12)</option>
                        <option value="6">Rộng 1/2 (50% - 6/12)</option>
                        <option value="4">Rộng 1/3 (33.3% - 4/12)</option>
                      </select>
                    </div>

                    {/* Visibility Switch */}
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] font-bold text-slate-500">Trạng thái:</span>
                      <button
                        type="button"
                        onClick={() => handleToggleWidgetVisible(widget.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          widget.visible
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {widget.visible ? (
                          <>
                            <Eye className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Hiển thị</span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                            <span>Đã ẩn</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-SECTION 2: ANNOUNCEMENTS & PROPAGANDA MANAGEMENT */}
      {activeSubSection === 'announcements' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-rose-50/60 p-4 rounded-xl border border-rose-100">
            <div>
              <h3 className="text-xs font-bold text-rose-900 uppercase tracking-wider flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-[#C4121A]" />
                Quản lý Bản tin Thông báo, Tuyên truyền CCHC và Chuyển đổi số
              </h3>
              <p className="text-[11px] text-rose-800/80 mt-0.5">
                Các bản tin được phát luân phiên trên màn hình TV dưới dạng thẻ Slide thông tin và trích xuất vào dòng chữ chạy (Marquee) phục vụ người dân.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenCreateAnn}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#C4121A] hover:bg-red-700 rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Bản tin Mới</span>
            </button>
          </div>

          {/* Announcements Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayConfig.announcements.map((ann, idx) => (
              <div
                key={ann.id}
                className={`p-4 rounded-2xl border transition-all ${
                  ann.active
                    ? 'bg-white border-slate-200 shadow-2xs hover:border-red-300'
                    : 'bg-slate-50 border-slate-200/60 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                        ann.type === 'propaganda'
                          ? 'bg-amber-100 text-amber-800'
                          : ann.type === 'policy'
                          ? 'bg-blue-100 text-blue-800'
                          : ann.type === 'guide'
                          ? 'bg-emerald-100 text-emerald-800'
                          : ann.type === 'urgent'
                          ? 'bg-red-100 text-red-800 animate-pulse'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {ann.type === 'propaganda' && '📣 Tuyên truyền'}
                      {ann.type === 'policy' && '📜 Chính sách'}
                      {ann.type === 'guide' && '💡 Hướng dẫn'}
                      {ann.type === 'urgent' && '🚨 Khẩn cấp'}
                      {ann.type === 'notice' && '📌 Thông báo'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">{ann.publishDate}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditAnn(ann)}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      title="Chỉnh sửa"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAnn(ann.id)}
                      className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Xóa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h4 className="text-sm font-bold text-slate-900 mt-2 line-clamp-2">
                  {ann.title}
                </h4>
                <p className="text-xs text-slate-600 mt-1 line-clamp-3 leading-relaxed">
                  {ann.content}
                </p>

                <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                  <span className="font-medium truncate">Đơn vị: {ann.author || 'Một cửa'}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {ann.showOnMarquee && (
                      <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[9px] font-bold">
                        Chữ chạy
                      </span>
                    )}
                    {ann.showOnSlide && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 text-[9px] font-bold">
                        Slide TV
                      </span>
                    )}
                    <span
                      className={`font-bold ${
                        ann.active ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    >
                      {ann.active ? '● Đang bật' : '○ Tắt'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {displayConfig.announcements.length === 0 && (
            <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
              <Megaphone className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
              <p className="text-xs font-semibold text-slate-600">Chưa có bản tin tuyên truyền nào</p>
              <button
                type="button"
                onClick={handleOpenCreateAnn}
                className="mt-3 px-3 py-1.5 bg-[#C4121A] text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tạo bản tin đầu tiên</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* SUB-SECTION 3: BRANDING, LOGO & THEME */}
      {activeSubSection === 'branding' && (
        <div className="space-y-6">
          {/* Logo & Agency Titles */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Palette className="w-4 h-4 text-[#C4121A]" />
              Nhận diện Cơ quan và Tiêu đề Banner TV
            </h3>

            {/* Live Logo Preview Box */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Xem trước Khối Nhận diện (Logo và Tiêu đề):
                </span>
                <OneStopLogo
                  size={52}
                  customLogoUrl={
                    displayConfig.logoDisplayType === 'custom_url'
                      ? displayConfig.customLogoUrl || config.logoUrl
                      : displayConfig.logoDisplayType === 'system' && config.logoType === 'custom_url'
                      ? config.logoUrl
                      : undefined
                  }
                  mainTitle={displayConfig.mainTitle}
                  subTitle={displayConfig.subTitle}
                  slogan={displayConfig.slogan}
                />
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                <span className="text-[10px] font-bold text-slate-500">Nguồn Biểu trưng (Logo):</span>
                <select
                  value={displayConfig.logoDisplayType || 'system'}
                  onChange={(e) => updateDisplayConfig({ logoDisplayType: e.target.value as any })}
                  className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-red-500 cursor-pointer"
                >
                  <option value="system">Lấy từ Logo đã thiết lập trong Hệ thống</option>
                  <option value="national_emblem">Biểu trưng Một cửa Quốc gia (QĐ 468)</option>
                  <option value="custom_url">Nhập URL Ảnh Logo riêng cho TV</option>
                </select>
              </div>
            </div>

            {displayConfig.logoDisplayType === 'custom_url' && (
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Đường dẫn (URL) ảnh Logo riêng cho TV:
                </label>
                <input
                  type="text"
                  value={displayConfig.customLogoUrl || ''}
                  onChange={(e) => updateDisplayConfig({ customLogoUrl: e.target.value })}
                  placeholder="https://domain.com/logo-kiosk.png"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-red-500 focus:outline-none"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Tiêu đề chính (Dòng 1):
                </label>
                <input
                  type="text"
                  value={displayConfig.mainTitle}
                  onChange={(e) => updateDisplayConfig({ mainTitle: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-red-500 focus:outline-none"
                  placeholder="TRUNG TÂM PHỤC VỤ HÀNH CHÍNH CÔNG"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Tên địa phương / Đơn vị (Dòng 2):
                </label>
                <input
                  type="text"
                  value={displayConfig.subTitle}
                  onChange={(e) => updateDisplayConfig({ subTitle: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-red-500 focus:outline-none"
                  placeholder="XÃ CHÂN MÂY – LĂNG CÔ"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Khẩu hiệu thương hiệu (Slogan):
                </label>
                <input
                  type="text"
                  value={displayConfig.slogan}
                  onChange={(e) => updateDisplayConfig({ slogan: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-red-500 focus:outline-none"
                  placeholder="Hành chính phục vụ"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Phương châm hành động (Trích dẫn):
                </label>
                <input
                  type="text"
                  value={displayConfig.quote}
                  onChange={(e) => updateDisplayConfig({ quote: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-red-500 focus:outline-none"
                  placeholder="Lấy sự hài lòng của người dân, doanh nghiệp là thước đo..."
                />
              </div>
            </div>
          </div>

          {/* TV Theme Styles */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Palette className="w-4 h-4 text-[#C4121A]" />
              Chủ đề Màu sắc và Phong cách Màn hình TV
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {themeOptions.map((t) => (
                <div
                  key={t.id}
                  onClick={() => updateDisplayConfig({ themeStyle: t.id })}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                    displayConfig.themeStyle === t.id
                      ? 'border-[#C4121A] ring-2 ring-red-500/20 bg-red-50/30'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">{t.name}</span>
                    {displayConfig.themeStyle === t.id && (
                      <CheckCircle2 className="w-4 h-4 text-[#C4121A]" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">{t.desc}</p>
                  <div className={`mt-3 h-8 rounded-lg border flex items-center px-3 text-[11px] font-bold ${t.previewClass}`}>
                    Demo Kiosk 55"
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Operational Tuning */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#C4121A]" />
              Tham số Vận hành Màn hình TV (Auto-refresh & Scroll)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Tự động làm mới số liệu (giây):
                </label>
                <select
                  value={displayConfig.autoRefreshSeconds}
                  onChange={(e) => updateDisplayConfig({ autoRefreshSeconds: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-red-500 cursor-pointer"
                >
                  <option value={15}>15 giây (Rất nhanh)</option>
                  <option value={30}>30 giây (Khuyến nghị cho TV)</option>
                  <option value={60}>1 phút</option>
                  <option value={120}>2 phút</option>
                  <option value={300}>5 phút</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Tốc độ tự động cuộn (Auto-scroll):
                </label>
                <select
                  value={displayConfig.autoScrollSpeed}
                  onChange={(e) => updateDisplayConfig({ autoScrollSpeed: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-red-500 cursor-pointer"
                >
                  <option value={0}>Tắt tự động cuộn</option>
                  <option value={1}>Chậm và mượt (Khuyên dùng TV đứng 55")</option>
                  <option value={2}>Bình thường</option>
                  <option value={3}>Nhanh</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Đồng hồ thời gian thực:
                </label>
                <button
                  type="button"
                  onClick={() => updateDisplayConfig({ showClock: !displayConfig.showClock })}
                  className={`w-full px-3 py-2 text-xs font-bold rounded-lg border transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                    displayConfig.showClock
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{displayConfig.showClock ? 'Đang bật đồng hồ Live' : 'Đã tắt đồng hồ'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-SECTION 4: QR CODE & MARQUEE TICKER */}
      {activeSubSection === 'qr' && (
        <div className="space-y-6">
          {/* Marquee Ticker */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-[#C4121A]" />
              Dòng Chữ Chạy Dưới Cùng Màn Hình (Marquee Ticker)
            </h3>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Nội dung dòng chữ chạy liên tục:
              </label>
              <textarea
                rows={3}
                value={displayConfig.marqueeText}
                onChange={(e) => updateDisplayConfig({ marqueeText: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-red-500 focus:outline-none leading-relaxed"
                placeholder="Nhập thông điệp chữ chạy..."
              />
            </div>

            {/* Live Ticker Preview */}
            <div className="bg-gradient-to-r from-red-950 via-[#8A1515] to-red-950 text-amber-300 p-2.5 rounded-xl overflow-hidden text-xs font-bold flex items-center gap-3 border border-amber-500/30">
              <span className="px-2 py-0.5 rounded bg-amber-400 text-red-950 text-[10px] font-black uppercase shrink-0">
                Tin Live
              </span>
              <div className="truncate flex-1">
                {displayConfig.marqueeText}
              </div>
            </div>
          </div>

          {/* QR Code & Contact Support */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <QrCode className="w-4 h-4 text-[#C4121A]" />
              Mã QR Tra Cứu và Thông Tin Hỗ Trợ Công Dân
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Đường dẫn (URL) khi quét mã QR:
                </label>
                <input
                  type="text"
                  value={displayConfig.qrCodeUrl}
                  onChange={(e) => updateDisplayConfig({ qrCodeUrl: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-red-500 focus:outline-none"
                  placeholder="https://dichvucong.gov.vn"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Tên nhãn hiển thị dưới mã QR:
                </label>
                <input
                  type="text"
                  value={displayConfig.qrCodeLabel}
                  onChange={(e) => updateDisplayConfig({ qrCodeLabel: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-red-500 focus:outline-none"
                  placeholder="Cổng Dịch vụ công Quốc gia"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Hotline / Tổng đài hỗ trợ:
                </label>
                <input
                  type="text"
                  value={displayConfig.hotlineText}
                  onChange={(e) => updateDisplayConfig({ hotlineText: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-red-500 focus:outline-none"
                  placeholder="0234.3876.xxx"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Địa điểm tiếp nhận và Trả kết quả:
                </label>
                <input
                  type="text"
                  value={displayConfig.addressText}
                  onChange={(e) => updateDisplayConfig({ addressText: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-red-500 focus:outline-none"
                  placeholder="Bộ phận Tiếp nhận và Trả kết quả xã Chân Mây – Lăng Cô"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT ANNOUNCEMENT */}
      {isAnnModalOpen && editingAnnouncement && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-red-900 to-rose-950 text-white">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-amber-300" />
                <h3 className="font-bold text-sm">
                  {displayConfig.announcements.some((a) => a.id === editingAnnouncement.id)
                    ? 'Chỉnh sửa Bản tin Tuyên truyền'
                    : 'Thêm Bản tin Tuyên truyền Mới'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAnnModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAnnouncement} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Tiêu đề bản tin <span className="text-red-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  value={editingAnnouncement.title}
                  onChange={(e) =>
                    setEditingAnnouncement({ ...editingAnnouncement, title: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-red-500 focus:outline-none"
                  placeholder="Nhập tiêu đề tuyên truyền..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Thể loại:</label>
                  <select
                    value={editingAnnouncement.type}
                    onChange={(e) =>
                      setEditingAnnouncement({
                        ...editingAnnouncement,
                        type: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-red-500 cursor-pointer"
                  >
                    <option value="propaganda">📣 Tuyên truyền DVC</option>
                    <option value="policy">📜 Chính sách mới</option>
                    <option value="guide">💡 Hướng dẫn công dân</option>
                    <option value="urgent">🚨 Khẩn cấp</option>
                    <option value="notice">📌 Thông báo chung</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Ngày đăng:</label>
                  <input
                    type="date"
                    value={editingAnnouncement.publishDate}
                    onChange={(e) =>
                      setEditingAnnouncement({
                        ...editingAnnouncement,
                        publishDate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nội dung chi tiết <span className="text-red-500">*</span>:
                </label>
                <textarea
                  rows={4}
                  required
                  value={editingAnnouncement.content}
                  onChange={(e) =>
                    setEditingAnnouncement({ ...editingAnnouncement, content: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-red-500 focus:outline-none leading-relaxed"
                  placeholder="Nhập nội dung tuyên truyền hoặc hướng dẫn..."
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Đơn vị / Tác giả ban hành:
                </label>
                <input
                  type="text"
                  value={editingAnnouncement.author || ''}
                  onChange={(e) =>
                    setEditingAnnouncement({ ...editingAnnouncement, author: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-red-500"
                  placeholder="Ví dụ: Bộ phận Một cửa xã Chân Mây – Lăng Cô"
                />
              </div>

              {/* Display options */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={editingAnnouncement.active}
                    onChange={(e) =>
                      setEditingAnnouncement({
                        ...editingAnnouncement,
                        active: e.target.checked,
                      })
                    }
                    className="rounded text-red-600 focus:ring-red-500"
                  />
                  <span>Đang hoạt động</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={editingAnnouncement.showOnSlide ?? true}
                    onChange={(e) =>
                      setEditingAnnouncement({
                        ...editingAnnouncement,
                        showOnSlide: e.target.checked,
                      })
                    }
                    className="rounded text-red-600 focus:ring-red-500"
                  />
                  <span>Chiếu trên Slide TV</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={editingAnnouncement.showOnMarquee ?? true}
                    onChange={(e) =>
                      setEditingAnnouncement({
                        ...editingAnnouncement,
                        showOnMarquee: e.target.checked,
                      })
                    }
                    className="rounded text-red-600 focus:ring-red-500"
                  />
                  <span>Chèn vào Dòng chữ chạy</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAnnModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-[#C4121A] hover:bg-red-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Lưu Bản tin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
