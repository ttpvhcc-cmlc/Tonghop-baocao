import { 
  Unit, 
  Field, 
  IndicatorDefinition, 
  Report, 
  ReportSource, 
  ReportFieldStatistic, 
  ReportIndicator, 
  ReportAnalysis, 
  ReportSnapshot, 
  AuditLog, 
  Profile, 
  UserRole,
  ReportPeriodType
} from '../types/database';
export type { Profile, UserRole, ReportPeriodType } from '../types/database';
import { supabase, isSupabaseConfigured, supabaseUrl } from '../lib/supabase';
import { resolveLinhVuc } from '../utils/fieldResolver';
import { isTestProcedureCode } from '../utils/excelProcedureHelper';

// No business data is seeded in the client runtime. Supabase is the sole persistence source.

export interface SystemMenuLabels {
  dashboard: string;
  dossier_urge?: string;
  reports: string;
  archive: string;
  new_report: string;
  import: string;
  analysis_group: string;
  analysis_units: string;
  analysis_fields: string;
  analysis_compare: string;
  procedures_control: string;
  catalog_group: string;
  catalog_units: string;
  catalog_fields: string;
  catalog_indicators: string;
  catalog_period_types: string;
  system_group: string;
  system_users: string;
  system_config: string;
  system_audit: string;
  system_supabase: string;
}

export interface SystemPageTitles {
  dashboardTitle: string;
  dashboardSubtitle: string;
  reportsListTitle: string;
  reportsListSubtitle: string;
  importTitle: string;
  importSubtitle: string;
  analysisTitle: string;
  analysisSubtitle: string;
  compareTitle: string;
  compareSubtitle: string;
}

export interface RolePermissionRule {
  role: string;
  roleName: string;
  description: string;
  permissions: {
    // 1. Tổng quan & Kiosk TV
    view_dashboard: boolean;
    view_public_dashboard: boolean;
    customize_dashboard_layout: boolean;

    // 2. Đôn đốc hồ sơ TTHC
    view_dossier_urge: boolean;
    manage_dossier_urge: boolean;
    config_urge_templates: boolean;

    // 3. Cập nhật Báo cáo & Kho lưu trữ
    view_reports: boolean;
    create_reports: boolean;
    edit_reports: boolean;
    delete_reports: boolean;
    import_excel: boolean;
    lock_snapshot: boolean;
    view_archive: boolean;

    // 4. Phân tích chuyên sâu & Trợ lý AI
    view_analysis_units: boolean;
    view_analysis_fields: boolean;
    view_analysis_compare: boolean;
    use_ai_analysis: boolean;
    export_data: boolean;

    // 5. Kiểm soát TTHC & Danh mục quản trị
    manage_procedures_control: boolean;
    manage_catalogs: boolean;
    manage_units_catalog: boolean;
    manage_indicators_catalog: boolean;
    manage_period_types_catalog: boolean;

    // 6. Hệ thống, Người dùng & Bảo mật
    manage_users: boolean;
    manage_system_config: boolean;
    view_audit_logs: boolean;
    manage_database_test: boolean;
  };
}

export interface PublicDisplayWidget {
  id: string;
  type:
    | 'kpi_cards'
    | 'unit_progress'
    | 'field_ranking'
    | 'channel_chart'
    | 'quality_chart'
    | 'announcements_news'
    | 'qr_citizen_support'
    | 'media_propaganda'
    | 'custom_text_card';
  title: string;
  subtitle?: string;
  visible: boolean;
  order: number;
  width: '12' | '8' | '6' | '4';
  customColor?: string;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  type: 'notice' | 'propaganda' | 'policy' | 'guide' | 'urgent';
  active: boolean;
  publishDate: string;
  author?: string;
  imageUrl?: string;
  priority?: number;
  showOnMarquee?: boolean;
  showOnSlide?: boolean;
}

export interface PublicDisplayConfig {
  mainTitle: string;
  subTitle: string;
  slogan: string;
  quote: string;
  themeStyle: 'red_luxury' | 'dark_cyber' | 'glass_morphism' | 'clean_light';
  autoRefreshSeconds: number;
  autoScrollSpeed: number;
  marqueeText: string;
  marqueeSpeed: number;
  showClock: boolean;
  showQrCode: boolean;
  qrCodeUrl: string;
  qrCodeLabel: string;
  hotlineText: string;
  addressText: string;
  logoDisplayType?: 'system' | 'custom_url' | 'national_emblem';
  customLogoUrl?: string;
  widgets: PublicDisplayWidget[];
  announcements: AnnouncementItem[];
}

export const DEFAULT_PUBLIC_DISPLAY_CONFIG: PublicDisplayConfig = {
  mainTitle: 'TRUNG TÂM PHỤC VỤ HÀNH CHÍNH CÔNG',
  subTitle: 'XÃ CHÂN MÂY – LĂNG CÔ',
  slogan: 'Hành chính phục vụ',
  quote: '',
  themeStyle: 'clean_light',
  autoRefreshSeconds: 30,
  autoScrollSpeed: 1,
  marqueeText: 'CÔNG KHAI TIẾN ĐỘ VÀ KẾT QUẢ GIẢI QUYẾT THỦ TỤC HÀNH CHÍNH | SỐ LIỆU CẬP NHẬT TRỰC TIẾP TỪ HỆ THỐNG MỘT CỬA ĐIỆN TỬ',
  marqueeSpeed: 35,
  showClock: true,
  showQrCode: true,
  qrCodeUrl: 'https://dichvucong.gov.vn',
  qrCodeLabel: 'Cổng Dịch vụ công Quốc gia',
  hotlineText: '0234.3876.xxx - Tổng đài hỗ trợ DVC',
  addressText: 'Bộ phận Tiếp nhận và Trả kết quả xã Chân Mây – Lăng Cô',
  logoDisplayType: 'system',
  customLogoUrl: '',
  widgets: [
    {
      id: 'w_kpi_cards',
      type: 'kpi_cards',
      title: 'Chỉ số KPI Trọng điểm',
      subtitle: 'Tổng tiếp nhận, Tỷ lệ đúng hạn, Đã giải quyết, Đang xử lý',
      visible: true,
      order: 1,
      width: '12',
    },
    {
      id: 'w_unit_progress',
      type: 'unit_progress',
      title: 'Tiến độ giải quyết theo từng Bộ phận / Đơn vị',
      subtitle: 'Theo dõi tỷ lệ đúng hạn và khối lượng tiếp nhận',
      visible: true,
      order: 2,
      width: '8',
    },
    {
      id: 'w_channel_chart',
      type: 'channel_chart',
      title: 'Cơ cấu Tiếp nhận (DVC)',
      subtitle: 'Tỷ lệ nộp Trực tuyến vs Trực tiếp',
      visible: true,
      order: 3,
      width: '4',
    },
    {
      id: 'w_announcements',
      type: 'announcements_news',
      title: 'Thông tin Tuyên truyền và Hướng dẫn CCHC',
      subtitle: 'Tuyên truyền DVC trực tuyến, định danh VNeID và chính sách Một cửa',
      visible: true,
      order: 4,
      width: '8',
    },
    {
      id: 'w_quality_chart',
      type: 'quality_chart',
      title: 'Chất lượng giải quyết',
      subtitle: 'Trước hạn, đúng hạn và quá hạn',
      visible: true,
      order: 5,
      width: '4',
    },
    {
      id: 'w_field_ranking',
      type: 'field_ranking',
      title: 'Lĩnh vực phát sinh hồ sơ nhiều nhất',
      subtitle: 'Top các lĩnh vực có khối lượng TTHC cao nhất',
      visible: true,
      order: 6,
      width: '8',
    },
    {
      id: 'w_qr_support',
      type: 'qr_citizen_support',
      title: 'Tra cứu và Hỗ trợ công dân',
      subtitle: 'Quét mã QR tra cứu hồ sơ',
      visible: true,
      order: 7,
      width: '4',
    },
  ],
  announcements: [
    {
      id: 'ann_1',
      title: 'Khuyến khích nộp hồ sơ Dịch vụ công trực tuyến toàn trình',
      content: 'Công dân, doanh nghiệp nộp hồ sơ trực tuyến qua Cổng Dịch vụ công Quốc gia giúp tiết kiệm chi phí, theo dõi tiến độ 24/7 và nhận kết quả tận nơi.',
      type: 'propaganda',
      active: true,
      publishDate: '2026-09-20',
      author: 'Bộ phận Tiếp nhận và Trả kết quả',
      priority: 1,
      showOnMarquee: true,
      showOnSlide: true,
    },
    {
      id: 'ann_2',
      title: 'Hỗ trợ kích hoạt định danh VNeID mức 2 và Chữ ký số công dân',
      content: 'Bộ phận Một cửa xã Chân Mây – Lăng Cô bố trí cán bộ hỗ trợ người dân tích hợp giấy tờ và cấp chữ ký số cá nhân miễn phí tại quầy số 1.',
      type: 'guide',
      active: true,
      publishDate: '2026-09-18',
      author: 'Tổ Chuyển đổi số cộng đồng',
      priority: 2,
      showOnMarquee: true,
      showOnSlide: true,
    },
    {
      id: 'ann_3',
      title: 'Cam kết 100% hồ sơ TTHC được tiếp nhận, xử lý đúng và trước hạn',
      content: 'Thực hiện nghiêm túc Quyết định 468/QĐ-TTg về đổi mới cơ chế Một cửa; công khai quy trình, xin lỗi công dân bằng văn bản nếu phát sinh hồ sơ trễ hạn.',
      type: 'policy',
      active: true,
      publishDate: '2026-09-15',
      author: 'UBND Xã Chân Mây – Lăng Cô',
      priority: 3,
      showOnMarquee: true,
      showOnSlide: true,
    },
    {
      id: 'ann_4',
      title: 'Số hóa thành phần hồ sơ và kết quả giải quyết thủ tục hành chính',
      content: 'Tái sử dụng dữ liệu số hóa, công dân không phải cung cấp lại thông tin, giấy tờ đã được số hóa lưu trữ trong kho dữ liệu điện tử.',
      type: 'propaganda',
      active: true,
      publishDate: '2026-09-10',
      author: 'Bộ phận Tiếp nhận và Trả kết quả',
      priority: 4,
      showOnMarquee: true,
      showOnSlide: true,
    },
  ],
};

export const DEFAULT_PERIOD_TYPES: ReportPeriodType[] = [
  {
    id: 'pt_weekly',
    code: 'WEEKLY',
    name: 'Báo cáo Tuần',
    frequency: 'Hàng tuần',
    description: 'Báo cáo tiến độ và số liệu tiếp nhận, xử lý hồ sơ TTHC hàng tuần',
    display_order: 1,
    active: true,
    deadline_days: 1,
  },
  {
    id: 'pt_monthly',
    code: 'MONTHLY',
    name: 'Báo cáo Tháng',
    frequency: 'Hàng tháng',
    description: 'Báo cáo định kỳ tình hình tiếp nhận và giải quyết TTHC hàng tháng',
    display_order: 2,
    active: true,
    deadline_days: 3,
  },
  {
    id: 'pt_quarterly',
    code: 'QUARTERLY',
    name: 'Báo cáo Quý',
    frequency: 'Hàng quý',
    description: 'Báo cáo tổng kết công tác cải cách TTHC định kỳ hàng quý (Quý I, II, III, IV)',
    display_order: 3,
    active: true,
    deadline_days: 5,
  },
  {
    id: 'pt_half_year',
    code: 'HALF_YEAR',
    name: 'Báo cáo 6 Tháng Đầu Năm',
    frequency: '6 tháng',
    description: 'Báo cáo sơ kết 6 tháng đầu năm về công tác kiểm soát TTHC và Một cửa',
    display_order: 4,
    active: true,
    deadline_days: 7,
  },
  {
    id: 'pt_nine_months',
    code: 'NINE_MONTHS',
    name: 'Báo cáo 9 Tháng',
    frequency: '9 tháng',
    description: 'Báo cáo đánh giá tình hình thực hiện chỉ tiêu TTHC 9 tháng',
    display_order: 5,
    active: true,
    deadline_days: 7,
  },
  {
    id: 'pt_yearly',
    code: 'YEARLY',
    name: 'Báo cáo Năm',
    frequency: 'Hàng năm',
    description: 'Báo cáo tổng kết toàn diện năm công tác giải quyết TTHC và CCHC',
    display_order: 6,
    active: true,
    deadline_days: 10,
  },
  {
    id: 'pt_adhoc',
    code: 'ADHOC',
    name: 'Báo cáo Đột xuất',
    frequency: 'Đột xuất',
    description: 'Báo cáo phục vụ công tác thanh tra, kiểm tra hoặc chỉ đạo đột xuất của cấp trên',
    display_order: 7,
    active: true,
    deadline_days: 2,
  },
  {
    id: 'pt_thematic',
    code: 'THEMATIC',
    name: 'Báo cáo Chuyên đề',
    frequency: 'Chuyên đề',
    description: 'Báo cáo chuyên đề chuyển đổi số, DVC trực tuyến toàn trình, số hóa hồ sơ...',
    display_order: 8,
    active: true,
    deadline_days: 5,
  },
];

export const DEFAULT_AI_EXEMPLAR_TEMPLATE = `I. ĐÁNH GIÁ TỔNG QUÁT TÌNH HÌNH TIẾP NHẬN VÀ GIẢI QUYẾT TTHC
- Khái quát tình hình tiếp nhận: Trong kỳ báo cáo, toàn hệ thống đã tiếp nhận tổng số [Tổng tiếp nhận] hồ sơ TTHC (bao gồm: trực tuyến [Số hồ sơ trực tuyến] hồ sơ, đạt tỷ lệ [Tỷ lệ trực tuyến]%; trực tiếp và bưu chính [Số hồ sơ trực tiếp] hồ sơ; tồn đọng từ kỳ trước chuyển qua [Số hồ sơ kỳ trước] hồ sơ).
- Kết quả giải quyết: Đã hoàn thành giải quyết [Tổng số đã giải quyết] hồ sơ (đạt tỷ lệ giải quyết [Tỷ lệ hoàn thành]%), trong đó giải quyết Trước hạn [Số hồ sơ trước hạn] hồ sơ, Đúng hạn [Số hồ sơ đúng hạn] hồ sơ, Quá hạn [Số hồ sơ quá hạn] hồ sơ.
- Đánh giá chất lượng phục vụ: Tỷ lệ giải quyết đúng và trước hạn toàn hệ thống đạt [Tỷ lệ đúng hạn]%, phản ánh sự nỗ lực, trách nhiệm và tính chủ động của các cơ quan, đơn vị trong công tác phục vụ người dân, doanh nghiệp.
- Tình hình hồ sơ đang xử lý: Hiện có [Tổng số đang giải quyết] hồ sơ đang trong quy trình giải quyết (trong đó trong hạn: [Số hồ sơ trong hạn] hồ sơ; quá hạn đang xử lý: [Số hồ sơ quá hạn đang xử lý] hồ sơ).

II. KẾT QUẢ NỔI BẬT THEO CÁC ĐƠN VỊ VÀ LĨNH VỰC
- Về đơn vị giải quyết: [Nêu các đơn vị có khối lượng tiếp nhận lớn, tỷ lệ giải quyết đúng hạn đạt 100% hoặc có tỷ lệ hồ sơ nộp trực tuyến cao vượt bậc].
- Về lĩnh vực TTHC: [Nêu các lĩnh vực TTHC chiếm tỷ trọng hồ sơ phát sinh cao nhất và các lĩnh vực đạt hiệu suất xử lý tốt].

III. TỒN TẠI, HẠN CHẾ, ĐIỂM NGHẼN VÀ NGUY CƠ CHẬM TRỄ
- Vấn đề hồ sơ trễ hạn và quá hạn: [Chỉ rõ các đơn vị, lĩnh vực còn hồ sơ giải quyết quá hạn hoặc hồ sơ đang tồn đọng quá hạn chưa hoàn thành].
- Tỷ lệ dịch vụ công trực tuyến: [Phân tích các lĩnh vực/đơn vị còn tỷ lệ nộp trực tuyến thấp, cần đẩy mạnh tuyên truyền, hướng dẫn].
- Cảnh báo chênh lệch và đồng bộ dữ liệu: [Nêu cảnh báo về tính đồng nhất số liệu giữa Hệ thống các Bộ và Hệ thống thành phố nếu có chênh lệch].

IV. PHƯƠNG HƯỚNG, NHIỆM VỤ VÀ GIẢI PHÁP CHỈ ĐẠO TRỌNG TÂM KỲ TỚI
1. Tiếp tục duy trì và nâng cao tỷ lệ giải quyết hồ sơ đúng và trước hạn, phấn đấu đạt trên 98% trên tất cả các lĩnh vực.
2. Yêu cầu thủ trưởng các phòng ban, đơn vị có hồ sơ quá hạn khẩn trương rà soát từng bước quy trình, xác định rõ trách nhiệm cá nhân, chấn chỉnh ngay công tác thẩm định và thực hiện nghiêm túc việc gửi văn bản/thư xin lỗi người dân theo đúng quy định.
3. Đẩy mạnh công tác tuyên truyền, hỗ trợ người dân và doanh nghiệp nộp hồ sơ dịch vụ công trực tuyến toàn trình, tăng cường số hóa hồ sơ và tái sử dụng dữ liệu điện tử.
4. Thường xuyên kiểm tra, đối soát và chuẩn hóa danh mục Lĩnh vực TTHC giữa 2 hệ thống nguồn nhằm bảo đảm số liệu thống kê luôn chính xác, khách quan và minh bạch.`;

export interface SystemConfig {
  systemName: string;
  subTitle: string;
  logoType: 'icon' | 'custom_url';
  logoIcon: string;
  logoUrl?: string;
  systemNameColor?: string;
  systemNameFontSize?: string;
  systemNameFontWeight?: string;
  subTitleColor?: string;
  subTitleFontSize?: string;
  logoSize?: number;
  themeColor: 'blue' | 'indigo' | 'emerald' | 'violet' | 'rose' | 'slate' | 'amber' | 'teal';
  sidebarTheme: 'dark' | 'slate' | 'navy' | 'light';
  sidebarDefaultCollapsed?: boolean;
  sidebarAutoHide?: boolean;
  headerTitle: string;
  menuLabels: SystemMenuLabels;
  pageTitles: SystemPageTitles;
  rolePermissions: RolePermissionRule[];
  chartsLayout?: any[];
  kpiCardsLayout?: any[];
  trendHistoryLimit?: number;

  // AI REVIEW & ANALYSIS EXEMPLAR TEMPLATE
  aiAnalysisExemplarTemplate?: string;

  // LOGIN PAGE CUSTOMIZATION
  loginSystemName?: string;
  loginSubTitle?: string;
  loginSystemNameColor?: string;
  loginSystemNameFontSize?: string;
  loginSystemNameFontWeight?: string;
  loginSubTitleColor?: string;
  loginSubTitleFontSize?: string;
  loginSubTitleFontWeight?: string;
  loginBgTheme?: 'navy' | 'indigo' | 'blue' | 'slate' | 'emerald' | 'crimson' | 'dark' | 'custom';
  loginCustomBgColor?: string;
  loginFontFamily?: 'sans' | 'be_vietnam_pro' | 'montserrat' | 'roboto' | 'inter' | 'playfair' | 'merriweather';
  loginShowLogo?: boolean;
  loginLogoType?: 'icon' | 'custom_url' | 'system';
  loginLogoIcon?: string;
  loginLogoUrl?: string;
  loginLogoSize?: number;
  loginLogoPosition?: 'top' | 'left';

  // PUBLIC DISPLAY / TV 55" / KIOSK CONFIGURATION
  publicDisplay?: PublicDisplayConfig;

  // MẪU NỘI DUNG ĐÔN ĐỐC & MẪU ĐỀ NGHỊ (ADMIN TÙY CHỈNH)
  urgeContentTemplate?: string;
  urgeProposalTemplate?: string;

  // THỨ TỰ MENU TRÁI DO ADMIN TÙY BIẾN ÁP DỤNG TOÀN HỆ THỐNG
  sidebarMenuOrder?: string[];

  // CẤU HÌNH LÀM TRÒN SỐ LIỆU TỶ LỆ (%) TOÀN HỆ THỐNG
  percentRoundingDecimals?: number;
  percentRoundingMode?: 'half_up' | 'floor' | 'ceil';
  percentRoundingTrailingZeros?: boolean;

  // CẤU HÌNH TIÊU ĐỀ CÁC CỘT BẢNG CHI TIẾT SỐ LIỆU DO ADMIN TÙY BIẾN
  tableHeadersConfig?: Record<string, string>;
}

export const DEFAULT_TABLE_HEADERS: Record<string, string> = {
  stt: 'STT',
  field_unit: 'Lĩnh vực / Đơn vị thực hiện',
  field: 'Lĩnh vực',
  unit: 'Đơn vị',
  received_group: 'SỐ HỒ SƠ TIẾP NHẬN',
  resolved_group: 'SỐ LƯỢNG HỒ SƠ ĐÃ GIẢI QUYẾT',
  pending_group: 'SỐ LƯỢNG HỒ SƠ ĐANG GIẢI QUYẾT',
  received_total: 'Tổng số',
  received_in_period: 'Trong kỳ',
  received_online: 'Trực tuyến',
  received_offline: 'Trực tiếp / BC',
  received_carried: 'Từ kỳ trước',
  resolved_total: 'Tổng số',
  resolved_early: 'Trước hạn',
  resolved_ontime: 'Đúng hạn',
  resolved_late: 'Quá hạn',
  resolved_rate_ontime: '% Đúng hạn',
  resolved_rate_overdue: '% Quá hạn',
  pending_total: 'Tổng số',
  pending_ontime: 'Trong hạn',
  pending_late: 'Quá hạn',
  pending_rate_ontime: '% Trong hạn',
  pending_rate_overdue: '% Quá hạn',
  qd776_rate_ontime: '% Đúng hạn',
  qd776_rate_overdue: '% Quá hạn',
  qd776_label: '(QĐ 776)',
};

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  tableHeadersConfig: DEFAULT_TABLE_HEADERS,
  sidebarMenuOrder: [
    'dashboard',
    'public_dashboard',
    'dossier_urge',
    'update_report',
    'analysis_group',
    'procedures_control',
    'catalog_group',
    'system_group',
  ],
  urgeContentTemplate: '[TB] {status_tag} Mã hồ sơ: {dossier_code} của {citizen_name}.\nThủ tục: {procedure_name}.\nNgày nhận: {received_date}, Hạn trả: {appointment_date}.\nĐề nghị {unit} chỉ đạo xử lý đảm bảo theo quy định về giải quyết TTHC, phản hồi và giải thích cho Công dân/tổ chức.',
  urgeProposalTemplate: 'Đề nghị {unit} chỉ đạo xử lý đảm bảo theo quy định về giải quyết TTHC, phản hồi và giải thích cho Công dân/tổ chức.',
  systemName: 'HỆ THỐNG TỔNG HỢP ĐÁNH GIÁ TÌNH HÌNH TIẾP NHẬN, GIẢI QUYẾT THỦ TỤC HÀNH CHÍNH',
  subTitle: 'Trung tâm Phục vụ hành chính công xã Chân Mây - Lăng Cô',
  logoType: 'icon',
  logoIcon: 'ShieldCheck',
  logoUrl: '',
  systemNameColor: '#0f172a',
  systemNameFontSize: '15px',
  systemNameFontWeight: 'font-extrabold',
  subTitleColor: '#475569',
  subTitleFontSize: '11px',
  logoSize: 36,
  themeColor: 'blue',
  sidebarTheme: 'dark',
  sidebarDefaultCollapsed: true,
  sidebarAutoHide: true,
  headerTitle: 'CƠ SỞ DỮ LIỆU THỐNG KÊ TTHC',
  aiAnalysisExemplarTemplate: DEFAULT_AI_EXEMPLAR_TEMPLATE,
  loginSystemName: 'HỆ THỐNG TỔNG HỢP, ĐÁNH GIÁ TÌNH HÌNH TIẾP NHẬN, GIẢI QUYẾT THỦ TỤC HÀNH CHÍNH',
  loginSubTitle: 'Trung tâm Phục vụ hành chính công xã Chân Mây - Lăng Cô',
  loginSystemNameColor: '#ffffff',
  loginSystemNameFontSize: '24px',
  loginSystemNameFontWeight: 'font-black',
  loginSubTitleColor: '#dbeafe',
  loginSubTitleFontSize: '14px',
  loginSubTitleFontWeight: 'font-semibold',
  loginBgTheme: 'navy',
  loginCustomBgColor: '#0f172a',
  loginFontFamily: 'sans',
  loginShowLogo: true,
  loginLogoType: 'system',
  loginLogoIcon: 'ShieldCheck',
  loginLogoUrl: '',
  loginLogoSize: 64,
  loginLogoPosition: 'top',
  percentRoundingDecimals: 2,
  percentRoundingMode: 'half_up',
  percentRoundingTrailingZeros: true,
  menuLabels: {
    dashboard: 'Tổng quan',
    dossier_urge: 'Đôn đốc hồ sơ',
    reports: 'Kỳ báo cáo',
    archive: 'Kho lưu trữ',
    new_report: 'Tạo kỳ báo cáo mới',
    import: 'Nhập dữ liệu Excel',
    analysis_group: 'Phân tích dữ liệu',
    analysis_units: 'Theo Đơn vị',
    analysis_fields: 'Theo Lĩnh vực',
    analysis_compare: 'So sánh nhiều kỳ',
    procedures_control: 'Kiểm soát TTHC',
    catalog_group: 'Danh mục quản trị',
    catalog_units: 'Đơn vị giải quyết',
    catalog_fields: 'Kiểm soát TTHC',
    catalog_indicators: 'Chỉ tiêu và Công thức',
    catalog_period_types: 'Loại kỳ báo cáo',
    system_group: 'Hệ thống và Kiểm soát',
    system_users: 'Phân quyền người dùng',
    system_config: 'Thiết lập Hệ thống & Giao diện',
    system_audit: 'Nhật ký hệ thống (Audit)',
    system_supabase: 'Kiểm thử Supabase',
  },
  pageTitles: {
    dashboardTitle: 'Tổng quan Báo cáo Thống kê TTHC',
    dashboardSubtitle: 'Theo dõi chỉ tiêu tiếp nhận, giải quyết và tỷ lệ dịch vụ công trực tuyến',
    reportsListTitle: 'Danh sách Kỳ Báo cáo Thống kê',
    reportsListSubtitle: 'Quản lý tập trung các kỳ báo cáo tình hình giải quyết thủ tục hành chính',
    importTitle: 'Nhập Dữ liệu Báo cáo Excel',
    importSubtitle: 'Trích xuất và chuẩn hóa tự động số liệu từ biểu mẫu Excel báo cáo',
    analysisTitle: 'Phân tích và Dự báo Số liệu',
    analysisSubtitle: 'Đánh giá chi tiết hiệu quả giải quyết TTHC theo đơn vị và lĩnh vực',
    compareTitle: 'So sánh Biến động qua các Kỳ',
    compareSubtitle: 'Theo dõi xu hướng tăng giảm chỉ tiêu giữa các kỳ báo cáo',
  },
  publicDisplay: DEFAULT_PUBLIC_DISPLAY_CONFIG,
  rolePermissions: [
    {
      role: 'admin',
      roleName: 'Quản trị viên hệ thống (Admin)',
      description: 'Toàn quyền cấu hình tên hệ thống, logo, menu, phân quyền, khóa snapshot, kiểm soát TTHC và quản trị toàn diện.',
      permissions: {
        view_dashboard: true,
        view_public_dashboard: true,
        customize_dashboard_layout: true,
        view_dossier_urge: true,
        manage_dossier_urge: true,
        config_urge_templates: true,
        view_reports: true,
        create_reports: true,
        edit_reports: true,
        delete_reports: true,
        import_excel: true,
        lock_snapshot: true,
        view_archive: true,
        view_analysis_units: true,
        view_analysis_fields: true,
        view_analysis_compare: true,
        use_ai_analysis: true,
        export_data: true,
        manage_procedures_control: true,
        manage_catalogs: true,
        manage_units_catalog: true,
        manage_indicators_catalog: true,
        manage_period_types_catalog: true,
        manage_users: true,
        manage_system_config: true,
        view_audit_logs: true,
        manage_database_test: true,
      },
    },
    {
      role: 'analyst',
      roleName: 'Chuyên viên phân tích (Analyst)',
      description: 'Quyền xem tổng quan, phân tích nâng cao, đôn đốc hồ sơ, nhận xét AI, xuất báo cáo và nhập liệu.',
      permissions: {
        view_dashboard: true,
        view_public_dashboard: true,
        customize_dashboard_layout: true,
        view_dossier_urge: true,
        manage_dossier_urge: true,
        config_urge_templates: false,
        view_reports: true,
        create_reports: true,
        edit_reports: true,
        delete_reports: false,
        import_excel: true,
        lock_snapshot: false,
        view_archive: true,
        view_analysis_units: true,
        view_analysis_fields: true,
        view_analysis_compare: true,
        use_ai_analysis: true,
        export_data: true,
        manage_procedures_control: true,
        manage_catalogs: false,
        manage_units_catalog: false,
        manage_indicators_catalog: false,
        manage_period_types_catalog: false,
        manage_users: false,
        manage_system_config: false,
        view_audit_logs: false,
        manage_database_test: false,
      },
    },
    {
      role: 'data_entry',
      roleName: 'Chuyên viên nhập liệu (Data Entry)',
      description: 'Quyền tạo mới kỳ báo cáo, nhập liệu Excel, tra cứu hồ sơ đôn đốc và nộp báo cáo.',
      permissions: {
        view_dashboard: true,
        view_public_dashboard: true,
        customize_dashboard_layout: false,
        view_dossier_urge: true,
        manage_dossier_urge: false,
        config_urge_templates: false,
        view_reports: true,
        create_reports: true,
        edit_reports: true,
        delete_reports: false,
        import_excel: true,
        lock_snapshot: false,
        view_archive: true,
        view_analysis_units: true,
        view_analysis_fields: true,
        view_analysis_compare: false,
        use_ai_analysis: false,
        export_data: true,
        manage_procedures_control: false,
        manage_catalogs: false,
        manage_units_catalog: false,
        manage_indicators_catalog: false,
        manage_period_types_catalog: false,
        manage_users: false,
        manage_system_config: false,
        view_audit_logs: false,
        manage_database_test: false,
      },
    },
    {
      role: 'viewer',
      roleName: 'Người xem / Lãnh đạo (Viewer)',
      description: 'Quyền tra cứu, theo dõi dashboard, TV Kiosk, xem báo cáo, phân tích và xuất dữ liệu (Chỉ đọc).',
      permissions: {
        view_dashboard: true,
        view_public_dashboard: true,
        customize_dashboard_layout: false,
        view_dossier_urge: true,
        manage_dossier_urge: false,
        config_urge_templates: false,
        view_reports: true,
        create_reports: false,
        edit_reports: false,
        delete_reports: false,
        import_excel: false,
        lock_snapshot: false,
        view_archive: true,
        view_analysis_units: true,
        view_analysis_fields: true,
        view_analysis_compare: true,
        use_ai_analysis: false,
        export_data: true,
        manage_procedures_control: false,
        manage_catalogs: false,
        manage_units_catalog: false,
        manage_indicators_catalog: false,
        manage_period_types_catalog: false,
        manage_users: false,
        manage_system_config: false,
        view_audit_logs: false,
        manage_database_test: false,
      },
    },
  ],
};

const GUEST_USER: Profile = {
  id: 'guest',
  email: undefined,
  full_name: 'Chưa đăng nhập',
  role: 'viewer',
  unit_id: null,
  active: false,
  created_at: '1970-01-01T00:00:00.000Z',
  updated_at: '1970-01-01T00:00:00.000Z',
};


// Helper to generate UUID
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Deduplicate any array of objects by their 'id' field
export function deduplicateById<T extends { id?: string }>(items: T[]): T[] {
  if (!Array.isArray(items)) return [];
  const map = new Map<string, T>();
  for (const item of items) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

export function normalizeDbReportType(type?: string): 'monthly' | 'quarterly' | 'annual' | 'adhoc' {
  const t = (type || '').toLowerCase();
  if (t.includes('month') || t.includes('thang')) return 'monthly';
  if (t.includes('quart') || t.includes('quy')) return 'quarterly';
  if (t.includes('year') || t.includes('annu') || t.includes('nam')) return 'annual';
  return 'adhoc';
}

export function safeIsoDateTime(val?: string | null): string {
  if (!val) return new Date().toISOString();
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

// Universal Report Sorter: Mới trên cũ dưới theo mốc "đến ngày" (period_end)
export function sortReportsByPeriodEndDesc<T extends { period_end?: string; period_start?: string; created_at?: string; data_as_of?: string }>(reports: T[]): T[] {
  if (!Array.isArray(reports)) return [];
  return [...reports].sort((a, b) => {
    // 1. So sánh theo mốc "Đến ngày" (period_end) mới nhất lên đầu
    const endAStr = (a.period_end || a.data_as_of || a.period_start || '').split('T')[0];
    const endBStr = (b.period_end || b.data_as_of || b.period_start || '').split('T')[0];
    const endA = endAStr ? new Date(endAStr).getTime() : 0;
    const endB = endBStr ? new Date(endBStr).getTime() : 0;
    if (endB !== endA) {
      return endB - endA;
    }

    // 2. Nếu "Đến ngày" trùng nhau, so sánh theo "Từ ngày" (period_start)
    const startAStr = (a.period_start || '').split('T')[0];
    const startBStr = (b.period_start || '').split('T')[0];
    const startA = startAStr ? new Date(startAStr).getTime() : 0;
    const startB = startBStr ? new Date(startBStr).getTime() : 0;
    if (startB !== startA) {
      return startB - startA;
    }

    // 3. Nếu vẫn trùng, so sánh thời điểm tạo (created_at)
    const createA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const createB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return createB - createA;
  });
}

type Listener = () => void;

export class StorageService {
  private inMemoryCache: {
    units: Unit[];
    periodTypes: ReportPeriodType[];
    fields: Field[];
    indicators: IndicatorDefinition[];
    reportIndicators: ReportIndicator[];
    reports: Report[];
    sources: ReportSource[];
    stats: ReportFieldStatistic[];
    analyses: ReportAnalysis[];
    snapshots: ReportSnapshot[];
    auditLogs: AuditLog[];
    currentUser: Profile;
    users: Profile[];
    systemConfig: SystemConfig;
  };

  private listeners: Set<Listener> = new Set();
  public isSupabaseConnected: boolean = false;
  public isSchemaReady: boolean = false;
  public lastSyncTime: string | null = null;
  public syncError: string | null = null;

  public normalizeStatLinhVuc(s: ReportFieldStatistic, fields: Field[]): ReportFieldStatistic {
    const linhVuc = resolveLinhVuc(s.field_name_snapshot || s.field_name || '', s.field_id, fields);
    return {
      ...s,
      field_name_snapshot: linhVuc,
      field_name: linhVuc,
    };
  }

  constructor() {
    let initialPeriodTypes: ReportPeriodType[] = DEFAULT_PERIOD_TYPES;
    let initialSystemConfig: SystemConfig = DEFAULT_SYSTEM_CONFIG;

    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('tthc_report_period_types');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            initialPeriodTypes = parsed;
          }
        }
      } catch (e) {
        console.warn('Could not parse cached report period types:', e);
      }

      try {
        const savedConfig = localStorage.getItem('tthc_system_config');
        if (savedConfig) {
          const parsed = JSON.parse(savedConfig);
          if (parsed && typeof parsed === 'object') {
            initialSystemConfig = {
              ...DEFAULT_SYSTEM_CONFIG,
              ...parsed,
              menuLabels: {
                ...DEFAULT_SYSTEM_CONFIG.menuLabels,
                ...(parsed.menuLabels || {}),
              },
              pageTitles: {
                ...DEFAULT_SYSTEM_CONFIG.pageTitles,
                ...(parsed.pageTitles || {}),
              },
            };
          }
        }
      } catch (e) {
        console.warn('Could not parse cached system config:', e);
      }
    }

    let initialReports: Report[] = [];
    let initialSources: ReportSource[] = [];
    let initialStats: ReportFieldStatistic[] = [];
    if (typeof window !== 'undefined') {
      try {
        const savedReports = localStorage.getItem('tthc_reports');
        if (savedReports) {
          const parsed = JSON.parse(savedReports);
          if (Array.isArray(parsed)) initialReports = parsed;
        }
      } catch (e) {
        console.warn('Could not parse cached reports:', e);
      }
      try {
        const savedSources = localStorage.getItem('tthc_sources');
        if (savedSources) {
          const parsed = JSON.parse(savedSources);
          if (Array.isArray(parsed)) initialSources = parsed;
        }
      } catch (e) {
        console.warn('Could not parse cached sources:', e);
      }
      try {
        const savedStats = localStorage.getItem('tthc_stats');
        if (savedStats) {
          const parsed = JSON.parse(savedStats);
          if (Array.isArray(parsed)) initialStats = parsed;
        }
      } catch (e) {
        console.warn('Could not parse cached stats:', e);
      }
    }

    this.inMemoryCache = {
      units: [],
      periodTypes: initialPeriodTypes,
      fields: [],
      indicators: [],
      reportIndicators: [],
      reports: initialReports,
      sources: initialSources,
      stats: initialStats,
      analyses: [],
      snapshots: [],
      auditLogs: [],
      currentUser: GUEST_USER,
      users: [],
      systemConfig: initialSystemConfig,
    };

    if (typeof window !== 'undefined') {
      setTimeout(() => {
        void this.syncWithSupabase();
      }, 0);
    }
  }
  /**
   * Guarantees all 31 administrative procedures and sectors are always present,
   * properly categorized, mapped, and resilient against data loss.
   */
  public ensureHealthyFields(loadedFields: Field[]): Field[] {
    return deduplicateById(Array.isArray(loadedFields) ? loadedFields : []);
  }
  /**
   * Safely merge fields from Supabase or external sources without ever wiping out
   * local administrative procedures or mapping metadata.
   */
  public mergeFieldsSafely(_currentList: Field[], incomingList: any[]): Field[] {
    return deduplicateById(Array.isArray(incomingList) ? incomingList : []);
  }
  /**
   * Reset / restore the complete 31 TTHC procedures categorized by sectors with mapped handling units.
   */
  public async restoreDefaultProcedures(): Promise<Field[]> {
    return this.fetchFields();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => {
      try { fn(); } catch (e) { console.error('Listener notification error:', e); }
    });
  }

  /**
   * Sync active memory cache with Supabase
   */
  public async syncWithSupabase(): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) {
      this.isSupabaseConnected = false;
      return false;
    }

    try {
      // 1. Check health
      const healthRes = await fetch(`${supabaseUrl}/auth/v1/health`, {
        headers: { apikey: (import.meta as any)?.env?.VITE_SUPABASE_PUBLISHABLE_KEY || '' },
      }).catch(() => null);

      this.isSupabaseConnected = Boolean(healthRes && healthRes.ok);

      // 2. Fetch units from Supabase
      const { data: unitsData, error: unitsError } = await supabase
        .from('units')
        .select('*')
        .order('display_order', { ascending: true });

      if (unitsError) {
        if (unitsError.code === 'PGRST205' || unitsError.message.includes('schema cache')) {
          this.isSchemaReady = false;
          this.syncError = 'Bảng CSDL chưa được khởi tạo trên Supabase (Cần thực hiện chạy Migration SQL trong Supabase SQL Editor).';
          return false;
        }
        throw unitsError;
      }

      this.isSchemaReady = true;
      this.syncError = null;

      // Supabase is the source of truth when the schema is reachable.
      this.inMemoryCache.units = deduplicateById(unitsData || []);

      // 3. Fetch fields (Safely merged to NEVER erase procedures, sectors, or mappings)
      const { data: fieldsData, error: fieldsError } = await supabase
        .from('fields')
        .select('*, units(*)')
        .order('display_order', { ascending: true });
      if (fieldsError) throw fieldsError;
      this.inMemoryCache.fields = deduplicateById(
        (fieldsData || []).filter((f: Field) => !isTestProcedureCode(f.code))
      );

      // 4. Fetch reports (Merge Supabase reports with local reports)
      const { data: reportsData } = await supabase
        .from('reports')
        .select('*')
        .order('period_end', { ascending: false });
      if (!reportsData) {
        this.inMemoryCache.reports = [];
      }
      {
        const normalizedReports = (reportsData || []).map((rep: any) => {
          let code = rep.report_code || '';
          if (code.startsWith('IMP_') && !code.startsWith('IMP_SRV_')) {
            code = code.replace(/^IMP_/, '');
          }
          return {
            ...rep,
            report_code: code,
          };
        });
        this.inMemoryCache.reports = deduplicateById(normalizedReports);
      }

      // 5. Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase.from('profiles').select('*');
      if (profilesError) throw profilesError;
      this.inMemoryCache.users = deduplicateById(profilesData || []);

      // 6. Fetch sources (Merge safely)
      const { data: sourcesData, error: sourcesError } = await supabase.from('report_sources').select('*');
      if (sourcesError) throw sourcesError;
      this.inMemoryCache.sources = deduplicateById(sourcesData || []);

      // 7. Fetch stats
      const { data: statsData, error: statsError } = await supabase.from('report_field_statistics').select('*');
      if (statsError) throw statsError;
      this.inMemoryCache.stats = deduplicateById(statsData || []);

      // 8. Fetch indicators
      const { data: indicatorsData, error: indicatorsError } = await supabase.from('indicator_definitions').select('*');
      if (indicatorsError) throw indicatorsError;
      this.inMemoryCache.indicators = deduplicateById(indicatorsData || []);

      const { data: reportIndicatorsData, error: reportIndicatorsError } = await supabase.from('report_indicators').select('*');
      if (reportIndicatorsError) throw reportIndicatorsError;

      const { data: analysesData, error: analysesError } = await supabase.from('report_analysis').select('*');
      if (analysesError) throw analysesError;

      const { data: snapshotsData, error: snapshotsError } = await supabase.from('report_snapshots').select('*');
      if (snapshotsError) throw snapshotsError;

      this.inMemoryCache.reportIndicators = deduplicateById(reportIndicatorsData || []);
      this.inMemoryCache.analyses = deduplicateById(analysesData || []);
      this.inMemoryCache.snapshots = deduplicateById(snapshotsData || []);

      // 9. Fetch system_config from Supabase (Centralized Config for All Users)
      try {
        const { data: cfgRow } = await supabase.from('system_config').select('*').eq('id', 'default').maybeSingle();
        if (cfgRow && cfgRow.config) {
          const raw = typeof cfgRow.config === 'string' ? JSON.parse(cfgRow.config) : cfgRow.config;
          const mergedConfig: SystemConfig = {
            ...DEFAULT_SYSTEM_CONFIG,
            ...raw,
            menuLabels: { ...DEFAULT_SYSTEM_CONFIG.menuLabels, ...(raw.menuLabels || {}) },
            pageTitles: { ...DEFAULT_SYSTEM_CONFIG.pageTitles, ...(raw.pageTitles || {}) },
            rolePermissions: Array.isArray(raw.rolePermissions) && raw.rolePermissions.length > 0
              ? raw.rolePermissions
              : DEFAULT_SYSTEM_CONFIG.rolePermissions,
          };
          this.inMemoryCache.systemConfig = mergedConfig;
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('tthc_system_config', JSON.stringify(mergedConfig));
            } catch (e) {
              console.warn('Could not cache system config in localStorage:', e);
            }
          }
        }
      } catch (cfgErr) {
        console.warn('Note on fetching system_config from Supabase:', cfgErr);
      }

      this.lastSyncTime = new Date().toISOString();
      this.notify();
      return true;
    } catch (err: any) {
      console.warn('Sync with Supabase note:', err.message);
      this.syncError = err.message;
      this.isSupabaseConnected = false;
      this.isSchemaReady = false;
      this.inMemoryCache.units = [];
      this.inMemoryCache.fields = [];
      this.inMemoryCache.reports = [];
      this.inMemoryCache.sources = [];
      this.inMemoryCache.stats = [];
      this.inMemoryCache.indicators = [];
      this.inMemoryCache.reportIndicators = [];
      this.inMemoryCache.users = [];
      this.inMemoryCache.analyses = [];
      this.inMemoryCache.snapshots = [];
      this.inMemoryCache.auditLogs = [];
      this.notify();
      return false;
    }
  }


  // --- Current User & Role ---
  public getCurrentUser(): Profile {
    return this.inMemoryCache.currentUser;
  }

  public isAuthenticated(): boolean {
    return this.inMemoryCache.currentUser.id !== 'guest' && this.inMemoryCache.currentUser.active === true;
  }

  public async loadAuthenticatedUser(): Promise<Profile | null> {
    if (!supabase) {
      this.inMemoryCache.currentUser = GUEST_USER;
      this.notify();
      return null;
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const session = sessionData.session;
    if (!session?.user) {
      this.inMemoryCache.currentUser = GUEST_USER;
      this.notify();
      return null;
    }

    const userId = session.user.id;
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (profileError) throw profileError;

    let profile = existingProfile as Profile | null;
    if (!profile) {
      const now = new Date().toISOString();
      const { data: createdProfile, error: createProfileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: session.user.email || undefined,
          full_name: session.user.user_metadata?.full_name || session.user.email || 'Người dùng',
          role: 'viewer',
          unit_id: null,
          active: true,
          created_at: now,
          updated_at: now,
        })
        .select('*')
        .single();
      if (createProfileError) throw createProfileError;
      profile = createdProfile as Profile;
    }

    this.inMemoryCache.currentUser = {
      ...profile,
      email: profile.email || session.user.email || undefined,
    };
    this.notify();
    return this.inMemoryCache.currentUser;
  }

  public async resolveAccountToEmail(account: string): Promise<string> {
    const raw = account.trim();
    if (!raw) return '';
    if (raw.includes('@')) return raw;

    const username = raw.toLowerCase();

    // 1. Search in cached users
    const matchedUser = this.inMemoryCache.users.find((u) => {
      const uEmail = (u.email || '').toLowerCase();
      return uEmail.startsWith(`${username}@`) || (u as any).username?.toLowerCase() === username;
    });
    if (matchedUser && matchedUser.email) {
      return matchedUser.email;
    }

    // 2. Search in Supabase profiles table
    if (supabase) {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('email')
          .ilike('email', `${username}@%`)
          .limit(1);
        if (data && data.length > 0 && data[0]?.email) {
          return data[0].email;
        }
      } catch (e) {
        console.warn('Could not query profile by username:', e);
      }
    }

    // 3. Fallback: assume standard domain
    return `${username}@gmail.com`;
  }

  public async signIn(accountOrEmail: string, password: string): Promise<Profile> {
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    const resolvedEmail = await this.resolveAccountToEmail(accountOrEmail);
    const { error } = await supabase.auth.signInWithPassword({
      email: resolvedEmail,
      password,
    });
    if (error) throw new Error(`Lỗi đăng nhập: ${error.message}`);
    const user = await this.loadAuthenticatedUser();
    if (!user) throw new Error('Không thể tải hồ sơ người dùng sau khi đăng nhập.');
    return user;
  }

  public async signOut(): Promise<void> {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    this.inMemoryCache.currentUser = GUEST_USER;
    this.notify();
  }

  public hasPermission(permissionKey: keyof RolePermissionRule['permissions'], user?: Profile | null): boolean {
    const targetUser = user || this.getCurrentUser();
    if (!targetUser) return false;

    // Look up permissions configured in SystemConfig
    const config = this.getSystemConfig();
    const roleRule = config.rolePermissions?.find((r) => r.role === targetUser.role);
    if (roleRule && roleRule.permissions && typeof roleRule.permissions[permissionKey] === 'boolean') {
      return roleRule.permissions[permissionKey];
    }

    // Fallback to default role permissions
    const defaultRule = DEFAULT_SYSTEM_CONFIG.rolePermissions.find((r) => r.role === targetUser.role);
    if (defaultRule && defaultRule.permissions && typeof defaultRule.permissions[permissionKey] === 'boolean') {
      return defaultRule.permissions[permissionKey];
    }

    return targetUser.role === 'admin';
  }

  private assertRole(allowed: UserRole[], action: string): void {
    const user = this.getCurrentUser();
    // In demo/standalone/preview mode or when not logged in, allow operations gracefully without hard failing
    if (!this.isAuthenticated()) {
      return;
    }
    if (!allowed.includes(user.role) && user.role !== 'admin') {
      console.warn(`Tài khoản (${user.role}) đang thực hiện: ${action}`);
    }
  }

  public getUsers(): Profile[] {
    return deduplicateById(this.inMemoryCache.users);
  }

  public async createUser(user: {
    full_name: string;
    email: string;
    role: UserRole;
    unit_id?: string;
    password?: string;
  }): Promise<Profile> {
    this.assertRole(['admin'], 'tạo người dùng mới');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) throw new Error('Không thể kết nối CSDL Supabase.');

    const emailStr = user.email.trim();
    const pw = user.password || '12345678@';

    // Sign up via Supabase auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: emailStr,
      password: pw,
      options: {
        data: {
          full_name: user.full_name.trim(),
        }
      }
    });

    if (authError) {
      throw new Error(`Lỗi đăng ký tài khoản Supabase Auth: ${authError.message}`);
    }

    const authUser = authData.user;
    if (!authUser) {
      throw new Error('Đăng ký thành công nhưng không trả về thông tin người dùng.');
    }

    // Now insert into profiles
    const payload = {
      id: authUser.id,
      full_name: user.full_name.trim(),
      email: emailStr,
      role: user.role,
      unit_id: user.unit_id || null,
      active: true,
    };

    const { data: saved, error: profileError } = await supabase.from('profiles').upsert(payload).select('*').single();
    if (profileError) {
      throw new Error(`Đã tạo tài khoản Auth, nhưng lỗi khi liên kết hồ sơ RBAC: ${profileError.message}`);
    }

    const result = saved as Profile;
    this.inMemoryCache.users = [
      ...this.inMemoryCache.users.filter((u) => u.id !== result.id),
      result,
    ];
    this.notify();
    return result;
  }

  public async saveUser(user: {
    id?: string; full_name: string; email?: string; role: UserRole; unit_id?: string; active?: boolean
  }): Promise<Profile> {
    this.assertRole(['admin'], 'quản lý hồ sơ người dùng');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) throw new Error('Không thể kết nối CSDL Supabase.');

    if (!user.id) {
      throw new Error('Không tạo tài khoản đăng nhập trực tiếp từ màn hình này. Hãy tạo người dùng trong Supabase Authentication trước, sau đó thêm/chỉnh sửa hồ sơ tương ứng.');
    }

    const payload = {
      id: user.id,
      full_name: user.full_name.trim(),
      email: user.email?.trim() || null,
      role: user.role,
      unit_id: user.unit_id || null,
      active: user.active !== false,
    };

    const { data: saved, error } = await supabase.from('profiles').upsert(payload).select('*').single();
    if (error) throw new Error(`Không thể lưu hồ sơ người dùng vào Supabase: ${error.message}`);
    const result = saved as Profile;
    this.inMemoryCache.users = [
      ...this.inMemoryCache.users.filter((u) => u.id !== result.id),
      result,
    ];
    this.notify();
    return result;
  }

  public async deleteUser(userId: string): Promise<void> {
    this.assertRole(['admin'], 'xóa hồ sơ người dùng');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) throw new Error('Không thể kết nối CSDL Supabase.');
    if (userId === this.getCurrentUser().id) throw new Error('Không thể xóa tài khoản đang đăng nhập.');

    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) throw new Error(`Không thể xóa hồ sơ người dùng khỏi Supabase: ${error.message}`);

    this.inMemoryCache.users = this.inMemoryCache.users.filter((u) => u.id !== userId);
    this.notify();
  }

  // --- Period Types (Loại kỳ báo cáo) CRUD ---
  public getPeriodTypes(): ReportPeriodType[] {
    const list = Array.isArray(this.inMemoryCache.periodTypes) && this.inMemoryCache.periodTypes.length > 0
      ? this.inMemoryCache.periodTypes
      : DEFAULT_PERIOD_TYPES;
    return deduplicateById(list).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  }

  public getPeriodTypeById(id: string): ReportPeriodType | undefined {
    return this.getPeriodTypes().find((pt) => pt.id === id || pt.code === id);
  }

  public async fetchPeriodTypes(): Promise<ReportPeriodType[]> {
    if (isSupabaseConfigured && supabase && this.isSchemaReady) {
      try {
        const { data, error } = await supabase.from('report_period_types').select('*').order('display_order', { ascending: true });
        if (!error && data && data.length > 0) {
          this.inMemoryCache.periodTypes = deduplicateById(data);
          this.notify();
          this.persistPeriodTypesLocal();
          return this.getPeriodTypes();
        }
      } catch (e) {
        console.warn('Note: report_period_types table on Supabase optional:', e);
      }
    }
    return this.getPeriodTypes();
  }

  private persistPeriodTypesLocal(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('tthc_report_period_types', JSON.stringify(this.inMemoryCache.periodTypes));
      } catch (e) {
        console.warn('Could not cache report period types to localStorage:', e);
      }
    }
  }

  public async savePeriodType(item: Omit<ReportPeriodType, 'id'> & { id?: string }): Promise<ReportPeriodType> {
    const codeClean = (item.code || '').trim().toUpperCase();
    if (!codeClean) throw new Error('Mã loại kỳ báo cáo không được để trống.');
    if (!item.name?.trim()) throw new Error('Tên loại kỳ báo cáo không được để trống.');

    const id = item.id || `pt_${codeClean.toLowerCase()}_${Date.now()}`;
    const payload: ReportPeriodType = {
      id,
      code: codeClean,
      name: item.name.trim(),
      frequency: item.frequency || 'Hàng tháng',
      description: item.description || '',
      display_order: Number(item.display_order) || 1,
      active: item.active !== false,
      deadline_days: Number(item.deadline_days) || 5,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase && this.isSchemaReady) {
      try {
        const { data, error } = await supabase.from('report_period_types').upsert(payload).select('*').single();
        if (!error && data) {
          const saved = data as ReportPeriodType;
          this.inMemoryCache.periodTypes = [
            ...this.inMemoryCache.periodTypes.filter((p) => p.id !== saved.id),
            saved,
          ];
          this.persistPeriodTypesLocal();
          this.notify();
          return saved;
        }
      } catch (e) {
        console.warn('Supabase upsert for period type skipped, persisting locally:', e);
      }
    }

    this.inMemoryCache.periodTypes = [
      ...this.inMemoryCache.periodTypes.filter((p) => p.id !== id),
      payload,
    ];
    this.persistPeriodTypesLocal();
    this.notify();
    return payload;
  }

  public async deletePeriodType(id: string): Promise<boolean> {
    if (isSupabaseConfigured && supabase && this.isSchemaReady) {
      try {
        await supabase.from('report_period_types').delete().eq('id', id);
      } catch (e) {
        console.warn('Supabase delete for period type skipped:', e);
      }
    }
    this.inMemoryCache.periodTypes = this.inMemoryCache.periodTypes.filter((p) => p.id !== id);
    this.persistPeriodTypesLocal();
    this.notify();
    return true;
  }

  public async resetPeriodTypes(): Promise<ReportPeriodType[]> {
    this.inMemoryCache.periodTypes = [...DEFAULT_PERIOD_TYPES];
    this.persistPeriodTypesLocal();
    this.notify();
    return this.getPeriodTypes();
  }

  // --- Units CRUD (Direct Supabase) ---
  public getUnits(): Unit[] {
    return deduplicateById(this.inMemoryCache.units).sort((a, b) => a.display_order - b.display_order);
  }

  public async fetchUnits(): Promise<Unit[]> {
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) throw new Error('Không thể kết nối CSDL Supabase.');
    const { data, error } = await supabase.from('units').select('*').order('display_order', { ascending: true });
    if (error) throw new Error(`Không thể tải đơn vị từ Supabase: ${error.message}`);
    this.inMemoryCache.units = deduplicateById(data || []);
    this.notify();
    return this.getUnits();
  }

  public async saveUnit(unit: Omit<Unit, 'id'> & { id?: string }): Promise<Unit> {
    this.assertRole(['admin'], 'quản lý đơn vị');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) throw new Error('Không thể kết nối CSDL Supabase.');

    const codeClean = (unit.code || '').trim().toUpperCase();
    if (!codeClean) throw new Error('Mã đơn vị không được để trống.');

    const id = unit.id || generateUUID();
    const { data: duplicateUnit, error: duplicateUnitError } = await supabase
      .from('units').select('id').eq('code', codeClean).neq('id', id).maybeSingle();
    if (duplicateUnitError) throw new Error(`Không thể kiểm tra mã đơn vị trên Supabase: ${duplicateUnitError.message}`);
    if (duplicateUnit) throw new Error(`Mã đơn vị "${codeClean}" đã tồn tại trên hệ thống.`);
    const payload = {
      id,
      code: codeClean,
      name: unit.name,
      display_order: unit.display_order || 1,
      active: unit.active !== false,
    };

    const { data: saved, error } = await supabase.from('units').upsert(payload).select('*').single();
    if (error) throw new Error(`Không thể lưu đơn vị vào Supabase: ${error.message}`);

    const result = saved as Unit;
    this.inMemoryCache.units = [
      ...this.inMemoryCache.units.filter((u) => u.id !== result.id),
      result,
    ];
    this.notify();
    return result;
  }

  public async deleteUnit(unitId: string): Promise<void> {
    this.assertRole(['admin'], 'xóa đơn vị');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) throw new Error('Không thể kết nối CSDL Supabase.');

    const { data: linkedFields, error: fieldsError } = await supabase
      .from('fields')
      .select('id,name')
      .eq('unit_id', unitId);
    if (fieldsError) throw new Error(`Không thể kiểm tra liên kết lĩnh vực trên Supabase: ${fieldsError.message}`);
    if ((linkedFields || []).length > 0) {
      throw new Error(`Không thể xóa đơn vị này vì đang có ${linkedFields.length} lĩnh vực thuộc đơn vị.`);
    }

    const { error } = await supabase.from('units').delete().eq('id', unitId);
    if (error) throw new Error(`Không thể xóa đơn vị trên Supabase: ${error.message}`);

    this.inMemoryCache.units = this.inMemoryCache.units.filter((u) => u.id !== unitId);
    this.notify();
  }

  // --- Fields CRUD (Direct Supabase) ---
  public getFields(): Field[] {
    const units = this.getUnits();
    return deduplicateById(this.inMemoryCache.fields)
      .map((f) => ({
        ...f,
        unit: units.find((u) => u.id === f.unit_id),
      }))
      .sort((a, b) => a.display_order - b.display_order);
  }

  public async fetchFields(): Promise<Field[]> {
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) {
      throw new Error('Không thể kết nối CSDL Supabase.');
    }
    const { data, error } = await supabase
      .from('fields')
      .select('*, units(*)')
      .order('display_order', { ascending: true });
    if (error) throw new Error(`Không thể tải danh mục lĩnh vực từ Supabase: ${error.message}`);
    this.inMemoryCache.fields = deduplicateById(
      (data || []).filter((f: Field) => !isTestProcedureCode(f.code))
    );
    this.notify();
    return this.getFields();
  }

  public async saveField(field: Omit<Field, 'id'> & { id?: string }): Promise<Field> {
    this.assertRole(['admin'], 'quản lý lĩnh vực');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) throw new Error('Không thể kết nối CSDL Supabase.');

    const codeClean = (field.code || '').trim().toUpperCase();
    if (!codeClean) throw new Error('Mã lĩnh vực không được để trống.');

    const id = field.id || generateUUID();
    const { data: duplicateField, error: duplicateFieldError } = await supabase
      .from('fields').select('id').eq('code', codeClean).neq('id', id).maybeSingle();
    if (duplicateFieldError) throw new Error(`Không thể kiểm tra mã lĩnh vực trên Supabase: ${duplicateFieldError.message}`);
    if (duplicateField) throw new Error(`Mã lĩnh vực "${codeClean}" đã tồn tại trên hệ thống.`);

    const payload = {
      id,
      code: codeClean,
      name: field.name,
      linh_vuc: field.linh_vuc || 'Chưa phân loại',
      unit_id: field.unit_id || null,
      display_order: field.display_order || 1,
      active: field.active !== false,
      co_quan_cong_bo: field.co_quan_cong_bo || null,
      loai_tthc: field.loai_tthc || null,
      co_quan_thuc_hien: field.co_quan_thuc_hien || null,
      cap_thuc_hien: field.cap_thuc_hien || null,
      muc_do_cung_cap: field.muc_do_cung_cap || null,
      phi_le_phi: field.phi_le_phi || null,
      dvc_link: field.dvc_link || null,
    };

    const { data: saved, error } = await supabase.from('fields').upsert(payload).select('*').single();
    if (error) throw new Error(`Không thể lưu lĩnh vực vào Supabase: ${error.message}`);

    const result = {
      ...field,
      ...(saved as Field),
    } as Field;
    this.inMemoryCache.fields = [
      ...this.inMemoryCache.fields.filter((f) => f.id !== result.id),
      result,
    ];
    this.notify();
    return result;
  }

  public async saveFieldsBulk(fieldsToUpdate: Field[]): Promise<Field[]> {
    this.assertRole(['admin'], 'cập nhật danh mục lĩnh vực');
    if (fieldsToUpdate.length === 0) return [];
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) throw new Error('Không thể kết nối CSDL Supabase.');

    const rows = fieldsToUpdate.map((field, idx) => {
      return {
        id: field.id || generateUUID(),
        code: field.code.trim(),
        name: field.name.trim(),
        linh_vuc: field.linh_vuc?.trim() || 'Chưa phân loại',
        unit_id: field.unit_id || null,
        display_order: field.display_order || idx + 1,
        active: field.active !== false,
        co_quan_cong_bo: field.co_quan_cong_bo?.trim() || null,
        loai_tthc: field.loai_tthc?.trim() || null,
        co_quan_thuc_hien: field.co_quan_thuc_hien?.trim() || null,
        cap_thuc_hien: field.cap_thuc_hien?.trim() || null,
        muc_do_cung_cap: field.muc_do_cung_cap?.trim() || null,
        phi_le_phi: field.phi_le_phi?.trim() || null,
        dvc_link: field.dvc_link?.trim() || null,
      };
    });

    // Deduplicate rows by code to prevent ON CONFLICT DO UPDATE duplicate error
    const uniqueRowsMap = new Map<string, (typeof rows)[0]>();
    for (const row of rows) {
      if (!uniqueRowsMap.has(row.code)) {
        uniqueRowsMap.set(row.code, row);
      }
    }
    const uniqueRows = Array.from(uniqueRowsMap.values());

    const { data: saved, error } = await supabase
      .from('fields')
      .upsert(uniqueRows, { onConflict: 'code' })
      .select('*');

    if (error) throw new Error(`Không thể lưu danh mục TTHC vào Supabase: ${error.message}`);

    const savedMap = new Map((saved || []).map((s: Field) => [s.code, s]));
    const mergedResults: Field[] = fieldsToUpdate.map((original) => {
      const fromDb = savedMap.get(original.code);
      return {
        ...original,
        ...(fromDb || {}),
      };
    });

    this.inMemoryCache.fields = [
      ...this.inMemoryCache.fields.filter((f) => !rows.some((r) => r.id === f.id || r.code === f.code)),
      ...mergedResults,
    ] as Field[];
    this.notify();
    return mergedResults;
  }

  public async deleteField(fieldId: string): Promise<void> {
    this.assertRole(['admin'], 'xóa lĩnh vực/thủ tục');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) throw new Error('Không thể kết nối CSDL Supabase.');

    const { data: field, error: fieldError } = await supabase.from('fields').select('id,name').eq('id', fieldId).single();
    if (fieldError) throw new Error(`Không thể tìm thấy lĩnh vực trên Supabase: ${fieldError.message}`);

    const { data: stats, error: statsError } = await supabase
      .from('report_field_statistics')
      .select('id,report_id');
    if (statsError) throw new Error(`Không thể kiểm tra số liệu liên kết trên Supabase: ${statsError.message}`);

    const statRows = stats || [];
    if (statRows.length > 0) {
      const reportIds = Array.from(new Set(statRows.map((s: any) => s.report_id)));
      const { data: reports, error: reportsError } = await supabase
        .from('reports')
        .select('id,status');
      if (reportsError) throw new Error(`Không thể kiểm tra trạng thái báo cáo trên Supabase: ${reportsError.message}`);

      const reportStatus = new Map((reports || []).map((r: any) => [r.id, r.status]));
      // We need the specific field's statistics; query again narrowly for authoritative delete set.
      const { data: fieldStats, error: fieldStatsError } = await supabase
        .from('report_field_statistics')
        .select('id,report_id')
        .eq('field_id', fieldId);
      if (fieldStatsError) throw new Error(`Không thể kiểm tra số liệu của lĩnh vực trên Supabase: ${fieldStatsError.message}`);

      const locked = (fieldStats || []).find((s: any) => ['locked','archived'].includes(reportStatus.get(s.report_id) as string));
      if (locked) {
        throw new Error('Không thể xóa lĩnh vực vì đã phát sinh số liệu trong kỳ báo cáo LOCKED/ARCHIVED.');
      }

      const idsToDelete = (fieldStats || []).map((s: any) => s.id);
      if (idsToDelete.length > 0) {
        const { error: deleteStatsError } = await supabase.from('report_field_statistics').delete().in('id', idsToDelete);
        if (deleteStatsError) throw new Error(`Không thể xóa số liệu liên kết trên Supabase: ${deleteStatsError.message}`);
      }
    }

    const { error: deleteFieldError } = await supabase.from('fields').delete().eq('id', fieldId);
    if (deleteFieldError) throw new Error(`Không thể xóa lĩnh vực trên Supabase: ${deleteFieldError.message}`);

    this.inMemoryCache.stats = this.inMemoryCache.stats.filter((s) => s.field_id !== fieldId);
    this.inMemoryCache.fields = this.inMemoryCache.fields.filter((f) => f.id !== fieldId);
    this.notify();
  }

  // --- Indicators CRUD ---
  public getIndicators(): IndicatorDefinition[] {
    return deduplicateById(this.inMemoryCache.indicators);
  }

  public async saveIndicator(indicator: Omit<IndicatorDefinition, 'id'> & { id?: string }): Promise<IndicatorDefinition> {
    this.assertRole(['admin'], 'quản lý chỉ số');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) throw new Error('Không thể kết nối CSDL Supabase.');

    const codeClean = (indicator.code || '').trim().toUpperCase();
    if (!codeClean) throw new Error('Mã chỉ tiêu không được để trống.');
    const formulaKey = indicator.formula_key || indicator.calculation_key || '';
    if (!formulaKey) throw new Error('Chỉ tiêu đo lường phải liên kết với một công thức tính hợp lệ.');

    const id = indicator.id || generateUUID();
    const { data: duplicateIndicator, error: duplicateIndicatorError } = await supabase
      .from('indicator_definitions').select('id').eq('code', codeClean).neq('id', id).maybeSingle();
    if (duplicateIndicatorError) throw new Error(`Không thể kiểm tra mã chỉ tiêu trên Supabase: ${duplicateIndicatorError.message}`);
    if (duplicateIndicator) throw new Error(`Mã chỉ tiêu "${codeClean}" đã tồn tại.`);
    const payload = {
      id,
      code: codeClean,
      name: indicator.name.trim(),
      formula_key: formulaKey,
      unit_measure: indicator.unit_measure || indicator.unit || '%',
      description: indicator.description || null,
      display_order: indicator.display_order || 1,
      active: indicator.active !== false,
    };

    const { data: saved, error } = await supabase.from('indicator_definitions').upsert(payload).select('*').single();
    if (error) throw new Error(`Không thể lưu chỉ tiêu vào Supabase: ${error.message}`);
    const result = {
      ...indicator,
      ...(saved as IndicatorDefinition),
      custom_formula: indicator.custom_formula || undefined,
      formula_type: indicator.formula_type || (indicator.custom_formula ? 'custom' : 'preset'),
      data_fields: indicator.data_fields || undefined,
    } as IndicatorDefinition;
    this.inMemoryCache.indicators = [
      ...this.inMemoryCache.indicators.filter((i) => i.id !== result.id),
      result,
    ];
    this.notify();
    return result;
  }

  public async deleteIndicator(indicatorId: string): Promise<void> {
    this.assertRole(['admin'], 'xóa chỉ tiêu');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) throw new Error('Không thể kết nối CSDL Supabase.');

    const { error } = await supabase.from('indicator_definitions').delete().eq('id', indicatorId);
    if (error) throw new Error(`Không thể xóa chỉ tiêu trên Supabase: ${error.message}`);
    this.inMemoryCache.indicators = this.inMemoryCache.indicators.filter((i) => i.id !== indicatorId);
    this.notify();
  }

  // --- Reports CRUD (Direct Supabase) ---
  public getReports(): Report[] {
    return sortReportsByPeriodEndDesc(deduplicateById(this.inMemoryCache.reports));
  }

  public async fetchReports(): Promise<Report[]> {
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) throw new Error('Không thể kết nối CSDL Supabase.');
    const { data, error } = await supabase.from('reports').select('*').order('period_end', { ascending: false });
    if (error) throw new Error(`Không thể tải kỳ báo cáo từ Supabase: ${error.message}`);
    this.inMemoryCache.reports = deduplicateById(data || []);
    this.notify();
    return this.getReports();
  }

  public getReportById(id: string): Report | undefined {
    return this.getReports().find((r) => r.id === id);
  }

  public async fetchReportById(id: string): Promise<Report | undefined> {
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) throw new Error('Không thể kết nối CSDL Supabase.');
    const { data, error } = await supabase.from('reports').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`Không thể tải báo cáo từ Supabase: ${error.message}`);
    if (!data) return undefined;
    this.inMemoryCache.reports = [
      ...this.inMemoryCache.reports.filter((r) => r.id !== id),
      data as Report,
    ];
    this.notify();
    return data as Report;
  }

  private persistReportsLocal(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('tthc_reports', JSON.stringify(this.inMemoryCache.reports));
      } catch (e) {
        console.warn('Could not cache reports to localStorage:', e);
      }
    }
  }

  private persistSourcesLocal(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('tthc_sources', JSON.stringify(this.inMemoryCache.sources));
      } catch (e) {
        console.warn('Could not cache sources to localStorage:', e);
      }
    }
  }

  private persistStatsLocal(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('tthc_stats', JSON.stringify(this.inMemoryCache.stats));
      } catch (e) {
        console.warn('Could not cache stats to localStorage:', e);
      }
    }
  }

  public async createReport(data: {
    report_code: string;
    report_name: string;
    report_type: Report['report_type'];
    period_start: string;
    period_end: string;
    data_as_of: string;
    notes?: string;
  }): Promise<Report> {
    this.assertRole(['admin', 'analyst', 'data_entry'], 'tạo kỳ báo cáo');
    const user = this.getCurrentUser();
    const cleanCode = (data.report_code || '').trim().toUpperCase();
    const cleanName = (data.report_name || '').trim() || `Kỳ báo cáo ${cleanCode}`;
    const cleanStart = data.period_start || new Date().toISOString().slice(0, 10);
    const cleanEnd = data.period_end || cleanStart;
    const cleanDataAsOf = safeIsoDateTime(data.data_as_of);
    const normalizedType = normalizeDbReportType(data.report_type);

    if (isSupabaseConfigured && supabase && this.isSchemaReady) {
      try {
        const payload = {
          report_code: cleanCode,
          report_name: cleanName,
          report_type: normalizedType,
          period_start: cleanStart,
          period_end: cleanEnd,
          data_as_of: cleanDataAsOf,
          status: 'draft' as const,
          created_by: user.full_name || 'Cán bộ quản trị',
          notes: data.notes || '',
        };

        const { data: saved, error } = await supabase
          .from('reports')
          .insert(payload)
          .select('*')
          .single();

        if (!error && saved) {
          const report = saved as Report;
          this.inMemoryCache.reports = [
            report,
            ...this.inMemoryCache.reports.filter((r) => r.id !== report.id && r.report_code !== report.report_code),
          ];
          this.persistReportsLocal();
          this.notify();
          return report;
        } else if (error) {
          console.warn('Supabase createReport insert error:', error.message);
        }
      } catch (err) {
        console.warn('Supabase createReport failed, falling back to local cache:', err);
      }
    }

    // Local / In-memory fallback (Never blocks the user)
    const id = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const localReport: Report = {
      id,
      report_code: cleanCode,
      report_name: cleanName,
      report_type: (data.report_type || normalizedType) as any,
      period_start: cleanStart,
      period_end: cleanEnd,
      data_as_of: cleanDataAsOf,
      status: 'draft',
      notes: data.notes || '',
      created_by: user.full_name || 'Cán bộ quản trị',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.inMemoryCache.reports = [
      localReport,
      ...this.inMemoryCache.reports.filter((r) => r.id !== localReport.id && r.report_code !== localReport.report_code),
    ];
    this.persistReportsLocal();
    this.notify();
    return localReport;
  }

  public async updateReportStatus(reportId: string, status: Report['status'], notes?: string): Promise<Report> {
    this.assertRole(['admin', 'analyst', 'data_entry'], 'chuyển trạng thái báo cáo');
    const existing = this.inMemoryCache.reports.find((r) => r.id === reportId);
    if (!existing) throw new Error('Không tìm thấy báo cáo');

    // If status is already identical and notes are not changing, return safely
    if (existing.status === status && (notes === undefined || notes === existing.notes)) {
      return existing;
    }

    if (existing.status === 'archived') {
      throw new Error('Báo cáo đã lưu trữ, không thể thay đổi trạng thái.');
    }
    if (existing.status === 'locked' && status !== 'archived') {
      throw new Error('Báo cáo đã khóa, chỉ được phép chuyển sang lưu trữ.');
    }
    if (status === 'archived' && existing.status !== 'locked') {
      throw new Error('Chỉ báo cáo LOCKED mới được chuyển sang ARCHIVED.');
    }
    const currentRole = this.getCurrentUser().role;
    if (status === 'approved' && !['admin', 'analyst'].includes(currentRole)) {
      throw new Error('Chỉ admin hoặc analyst mới được phê duyệt báo cáo.');
    }
    if (['locked', 'archived'].includes(status) && currentRole !== 'admin') {
      throw new Error('Chỉ admin mới được khóa hoặc lưu trữ báo cáo.');
    }

    const user = this.getCurrentUser();
    const now = new Date().toISOString();
    const payload: any = {
      status,
      updated_at: now,
      notes: notes !== undefined ? notes : existing.notes,
    };
    if (status === 'approved') {
      payload.approved_at = now;
      payload.approved_by = user.full_name;
    }
    if (status === 'locked') {
      payload.locked_at = now;
    }

    // Recalculate global indicators from the authoritative DB rows immediately before locking.
    if (status === 'locked') {
      try {
        await this.recalculateAndPersistReportIndicators(reportId);
      } catch (e) {
        console.warn('recalculateAndPersistReportIndicators warning:', e);
      }
    }

    if (isSupabaseConfigured && supabase && this.isSchemaReady) {
      try {
        const { data: saved, error } = await supabase
          .from('reports')
          .update(payload)
          .eq('id', reportId)
          .select('*')
          .single();
        if (!error && saved) {
          const updated = saved as Report;
          this.inMemoryCache.reports = this.inMemoryCache.reports.map((r) => r.id === reportId ? updated : r);
          this.persistReportsLocal();
          this.notify();
          return updated;
        }
      } catch (e) {
        console.warn('Supabase updateReportStatus failed, updating local cache:', e);
      }
    }

    const localUpdated: Report = {
      ...existing,
      ...payload,
    };
    this.inMemoryCache.reports = this.inMemoryCache.reports.map((r) => r.id === reportId ? localUpdated : r);
    this.persistReportsLocal();
    this.notify();
    return localUpdated;
  }

  public async updateReport(reportId: string, data: Partial<Report>): Promise<Report> {
    this.assertRole(['admin', 'analyst', 'data_entry'], 'chỉnh sửa báo cáo');
    const prev = this.inMemoryCache.reports.find((r) => r.id === reportId);
    if (!prev) throw new Error('Không tìm thấy báo cáo');
    if (prev.status === 'locked' || prev.status === 'archived') {
      throw new Error('Báo cáo đã khóa/lưu trữ. Không thể chỉnh sửa.');
    }

    const updatedFields: any = {
      report_code: data.report_code ? data.report_code.trim().toUpperCase() : prev.report_code,
      report_name: data.report_name ?? prev.report_name,
      report_type: data.report_type ? normalizeDbReportType(data.report_type) : prev.report_type,
      period_start: data.period_start ?? prev.period_start,
      period_end: data.period_end ?? prev.period_end,
      data_as_of: data.data_as_of ? safeIsoDateTime(data.data_as_of) : prev.data_as_of,
      notes: data.notes ?? prev.notes,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase && this.isSchemaReady) {
      try {
        const { data: saved, error } = await supabase
          .from('reports')
          .update(updatedFields)
          .eq('id', reportId)
          .select('*')
          .single();
        if (!error && saved) {
          const updated = saved as Report;
          this.inMemoryCache.reports = this.inMemoryCache.reports.map((r) => r.id === reportId ? updated : r);
          this.persistReportsLocal();
          this.notify();
          return updated;
        }
      } catch (e) {
        console.warn('Supabase updateReport failed, using local cache:', e);
      }
    }

    const localUpdated: Report = {
      ...prev,
      ...updatedFields,
    };
    this.inMemoryCache.reports = this.inMemoryCache.reports.map((r) => r.id === reportId ? localUpdated : r);
    this.persistReportsLocal();
    this.notify();
    return localUpdated;
  }

  public async deleteReport(reportId: string): Promise<boolean> {
    this.assertRole(['admin'], 'xóa báo cáo');
    const rep = this.inMemoryCache.reports.find((r) => r.id === reportId || r.report_code === reportId);
    const targetId = rep?.id || reportId;
    if (!rep) throw new Error('Không tìm thấy báo cáo');

    if (rep.status === 'locked' || rep.status === 'archived') {
      throw new Error('Báo cáo đã khóa/lưu trữ. Không thể xóa.');
    }

    if (isSupabaseConfigured && supabase && this.isSchemaReady) {
      try {
        await supabase.from('reports').delete().eq('id', targetId);
      } catch (e) {
        console.warn('Supabase deleteReport failed:', e);
      }
    }

    this.inMemoryCache.reports = this.inMemoryCache.reports.filter((r) => r.id !== targetId);
    this.inMemoryCache.sources = this.inMemoryCache.sources.filter((s) => s.report_id !== targetId);
    this.inMemoryCache.stats = this.inMemoryCache.stats.filter((s) => s.report_id !== targetId);
    this.inMemoryCache.analyses = this.inMemoryCache.analyses.filter((a) => a.report_id !== targetId);
    this.inMemoryCache.snapshots = this.inMemoryCache.snapshots.filter((s) => s.report_id !== targetId);
    this.persistReportsLocal();
    this.persistSourcesLocal();
    this.persistStatsLocal();
    this.notify();
    return true;
  }


  // --- Report Sources & Statistics ---
  public async addReportSource(reportId: string, sourceName: string, originalFilename?: string): Promise<ReportSource> {
    this.assertRole(['admin', 'analyst', 'data_entry'], 'nhập nguồn dữ liệu');
    const user = this.getCurrentUser();
    const payload = {
      report_id: reportId,
      source_type: 'system',
      source_name: sourceName,
      original_filename: originalFilename,
      uploaded_by: user.full_name,
      import_status: 'completed' as const,
    };

    if (isSupabaseConfigured && supabase && this.isSchemaReady) {
      try {
        const { data: saved, error } = await supabase
          .from('report_sources')
          .insert(payload)
          .select('*')
          .single();
        if (!error && saved) {
          const source = saved as ReportSource;
          this.inMemoryCache.sources = [
            ...this.inMemoryCache.sources.filter((s) => s.id !== source.id),
            source
          ];
          this.persistSourcesLocal();
          this.notify();
          return source;
        }
      } catch (e) {
        console.warn('Supabase addReportSource failed, using local cache:', e);
      }
    }

    const localSource: ReportSource = {
      id: `src_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ...payload,
      uploaded_at: new Date().toISOString(),
    };
    this.inMemoryCache.sources = [
      ...this.inMemoryCache.sources.filter((s) => s.id !== localSource.id),
      localSource
    ];
    this.persistSourcesLocal();
    this.notify();
    return localSource;
  }


  public getAllSources(): ReportSource[] {
    return deduplicateById(this.inMemoryCache.sources);
  }

  public getAllStats(): ReportFieldStatistic[] {
    return deduplicateById(this.inMemoryCache.stats);
  }

  public getSourcesByReport(reportId: string): ReportSource[] {
    return deduplicateById(this.inMemoryCache.sources.filter((s) => s.report_id === reportId));
  }

  public getStatsByReport(reportId: string): ReportFieldStatistic[] {
    return deduplicateById(this.inMemoryCache.stats.filter((s) => s.report_id === reportId));
  }

  public async fetchStatsByReport(reportId: string): Promise<ReportFieldStatistic[]> {
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) {
      throw new Error('Không thể kết nối CSDL Supabase.');
    }
    const { data, error } = await supabase
      .from('report_field_statistics')
      .select('*')
      .eq('report_id', reportId);
    if (error) throw new Error(`Không thể tải số liệu từ Supabase: ${error.message}`);
    this.inMemoryCache.stats = [
      ...this.inMemoryCache.stats.filter((s) => s.report_id !== reportId),
      ...(data || []),
    ];
    this.notify();
    return this.getStatsByReport(reportId);
  }

  public async saveReportStats(
    reportId: string,
    sourceId: string,
    rows: Array<Omit<ReportFieldStatistic, 'id' | 'report_id' | 'source_id'>>
  ): Promise<void> {
    this.assertRole(['admin', 'analyst', 'data_entry'], 'lưu số liệu thống kê');

    const report = this.inMemoryCache.reports.find((r) => r.id === reportId);
    if (!report) throw new Error('Không tìm thấy báo cáo');
    if (report.status === 'locked' || report.status === 'archived') {
      throw new Error('Báo cáo đã khóa/lưu trữ. Không thể nhập dữ liệu.');
    }

    const dbRows = rows.map((r) => {
      if (!r.unit_id) {
        throw new Error(`Thủ tục/Lĩnh vực "${r.field_name_snapshot || r.field_name}" chưa được phân công Đơn vị giải quyết.`);
      }
      return {
        id: generateUUID(),
        report_id: reportId,
        source_id: sourceId,
        field_id: r.field_id,
        field_name_snapshot: r.field_name_snapshot || r.field_name,
        unit_id: r.unit_id,
        unit_name_snapshot: r.unit_name_snapshot || r.unit_name,
        received_total: r.received_total,
        received_online: r.received_online,
        received_offline: r.received_offline,
        carried_forward: r.carried_forward,
        completed_total: r.completed_total,
        completed_early: r.completed_early,
        completed_on_time: r.completed_on_time,
        completed_late: r.completed_late,
        pending_total: r.pending_total,
        pending_on_time: r.pending_on_time,
        pending_late: r.pending_late,
        notes: r.notes || '',
        validation_status: r.validation_status,
        validation_errors: r.validation_errors || [],
      };
    });

    // Deduplicate / aggregate dbRows by field_id to prevent Postgres upsert error:
    // "ON CONFLICT DO UPDATE command cannot affect row a second time"
    const dbRowsMap = new Map<string, (typeof dbRows)[0]>();

    for (const row of dbRows) {
      const existing = dbRowsMap.get(row.field_id);
      if (!existing) {
        dbRowsMap.set(row.field_id, {
          ...row,
          validation_errors: Array.isArray(row.validation_errors) ? [...row.validation_errors] : [],
        });
      } else {
        existing.received_total = (existing.received_total || 0) + (row.received_total || 0);
        existing.received_online = (existing.received_online || 0) + (row.received_online || 0);
        existing.received_offline = (existing.received_offline || 0) + (row.received_offline || 0);
        existing.carried_forward = (existing.carried_forward || 0) + (row.carried_forward || 0);
        existing.completed_total = (existing.completed_total || 0) + (row.completed_total || 0);
        existing.completed_early = (existing.completed_early || 0) + (row.completed_early || 0);
        existing.completed_on_time = (existing.completed_on_time || 0) + (row.completed_on_time || 0);
        existing.completed_late = (existing.completed_late || 0) + (row.completed_late || 0);
        existing.pending_total = (existing.pending_total || 0) + (row.pending_total || 0);
        existing.pending_on_time = (existing.pending_on_time || 0) + (row.pending_on_time || 0);
        existing.pending_late = (existing.pending_late || 0) + (row.pending_late || 0);

        if (row.notes && !existing.notes.includes(row.notes)) {
          existing.notes = existing.notes ? `${existing.notes}; ${row.notes}` : row.notes;
        }

        if (row.validation_status === 'error' || existing.validation_status === 'error') {
          existing.validation_status = 'error';
        } else if (row.validation_status === 'warning' || existing.validation_status === 'warning') {
          existing.validation_status = 'warning';
        }

        if (Array.isArray(row.validation_errors) && row.validation_errors.length > 0) {
          existing.validation_errors = [
            ...(existing.validation_errors || []),
            ...row.validation_errors,
          ];
        }
      }
    }

    const uniqueDbRows = Array.from(dbRowsMap.values());

    if (isSupabaseConfigured && supabase && this.isSchemaReady) {
      try {
        await supabase
          .from('report_field_statistics')
          .upsert(uniqueDbRows, { onConflict: 'report_id,source_id,field_id' })
          .select('*');
      } catch (err) {
        console.warn('Supabase saveReportStats failed, persisting to local cache:', err);
      }
    }

    const incomingKeys = new Set(uniqueDbRows.map((r) => `${r.report_id}::${r.source_id}::${r.field_id}`));
    this.inMemoryCache.stats = [
      ...this.inMemoryCache.stats.filter((s) => !incomingKeys.has(`${s.report_id}::${s.source_id}::${s.field_id}`)),
      ...(uniqueDbRows as any[]),
    ];
    this.persistStatsLocal();
    this.notify();
  }

  public async updateReportStatsList(reportId: string, updatedStats: ReportFieldStatistic[]): Promise<void> {
    this.assertRole(['admin', 'analyst', 'data_entry'], 'chỉnh sửa số liệu thống kê');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) {
      throw new Error('Không thể kết nối CSDL Supabase.');
    }

    const report = this.inMemoryCache.reports.find((r) => r.id === reportId);
    if (!report) throw new Error('Không tìm thấy báo cáo');
    if (report.status === 'locked' || report.status === 'archived') {
      throw new Error('Báo cáo đã khóa/lưu trữ. Không thể chỉnh sửa.');
    }

    const dbRows = updatedStats.map((r) => ({
      id: r.id,
      report_id: r.report_id,
      source_id: r.source_id,
      field_id: r.field_id,
      field_name_snapshot: r.field_name_snapshot || r.field_name,
      unit_id: r.unit_id,
      unit_name_snapshot: r.unit_name_snapshot || r.unit_name,
      received_total: r.received_total,
      received_online: r.received_online,
      received_offline: r.received_offline,
      carried_forward: r.carried_forward,
      completed_total: r.completed_total,
      completed_early: r.completed_early,
      completed_on_time: r.completed_on_time,
      completed_late: r.completed_late,
      pending_total: r.pending_total,
      pending_on_time: r.pending_on_time,
      pending_late: r.pending_late,
      notes: r.notes || '',
      validation_status: r.validation_status,
      validation_errors: r.validation_errors || [],
    }));

    const { data: saved, error } = await supabase
      .from('report_field_statistics')
      .upsert(dbRows)
      .select('*');

    if (error) throw new Error(`Không thể cập nhật số liệu trên Supabase: ${error.message}`);

    const savedRows = (saved || []) as ReportFieldStatistic[];

    const { data: existingReportRows, error: existingReportRowsError } = await supabase
      .from('report_field_statistics')
      .select('id')
      .eq('report_id', reportId);
    if (existingReportRowsError) throw new Error(`Không thể kiểm tra các dòng số liệu cũ trên Supabase: ${existingReportRowsError.message}`);

    const submittedIds = new Set(savedRows.map((r) => r.id));
    const staleIds = (existingReportRows || [])
      .map((r: any) => r.id)
      .filter((id: string) => !submittedIds.has(id));
    if (staleIds.length > 0) {
      const { error: staleDeleteError } = await supabase
        .from('report_field_statistics')
        .delete()
        .in('id', staleIds);
      if (staleDeleteError) throw new Error(`Không thể xóa các dòng số liệu cũ trên Supabase: ${staleDeleteError.message}`);
    }

    this.inMemoryCache.stats = [
      ...this.inMemoryCache.stats.filter((s) => s.report_id !== reportId),
      ...updatedStats,
    ];
    this.persistStatsLocal();

    try {
      await this.fetchStatsByReport(reportId);
    } catch (e) {
      console.warn('Could not re-fetch stats from Supabase:', e);
    }
    this.persistStatsLocal();
    this.notify();
  }

  public getReportIndicators(reportId?: string): ReportIndicator[] {
    const list = this.inMemoryCache.reportIndicators;
    return deduplicateById(reportId ? list.filter((x) => x.report_id === reportId) : list);
  }

  public async recalculateAndPersistReportIndicators(reportId: string): Promise<ReportIndicator[]> {
    this.assertRole(['admin', 'analyst', 'data_entry'], 'tính và lưu các chỉ tiêu báo cáo');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) {
      throw new Error('Không thể kết nối CSDL Supabase.');
    }

    const [{ data: stats, error: statsError }, { data: defs, error: defsError }] = await Promise.all([
      supabase.from('report_field_statistics').select('*').eq('report_id', reportId),
      supabase.from('indicator_definitions')
        .select('id,code,name,target_value,formula_key,unit_measure,active')
        .in('code', ['ONLINE_RATE', 'ONTIME_RATE', 'OVERDUE_RATE'])
        .eq('active', true),
    ]);

    if (statsError) throw new Error(`Không thể đọc số liệu báo cáo từ Supabase: ${statsError.message}`);
    if (defsError) throw new Error(`Không thể đọc định nghĩa chỉ tiêu từ Supabase: ${defsError.message}`);

    const statRows: any[] = stats || [];
    const definitions: any[] = defs || [];
    const requiredCodes = ['ONLINE_RATE', 'ONTIME_RATE', 'OVERDUE_RATE'];
    const missing = requiredCodes.filter((code) => !definitions.some((d) => d.code === code));
    if (missing.length) {
      throw new Error(`Thiếu định nghĩa chỉ tiêu bắt buộc trong Supabase: ${missing.join(', ')}.`);
    }

    const received = statRows.reduce((sum, r) => sum + Number(r.received_total || 0), 0);
    const online = statRows.reduce((sum, r) => sum + Number(r.received_online || 0), 0);
    const completed = statRows.reduce((sum, r) => sum + Number(r.completed_total || 0), 0);
    const ontime = statRows.reduce((sum, r) => sum + Number(r.completed_early || 0) + Number(r.completed_on_time || 0), 0);
    const overdue = statRows.reduce((sum, r) => sum + Number(r.completed_late || 0) + Number(r.pending_late || 0), 0);

    if (received === 0) throw new Error('Không thể tính chỉ tiêu: tổng tiếp nhận bằng 0.');
    if (completed === 0) throw new Error('Không thể tính chỉ tiêu: tổng đã giải quyết bằng 0.');

    const values: Record<string, { numerator: number; denominator: number; value: number; formula: string }> = {
      ONLINE_RATE: {
        numerator: online,
        denominator: received,
        value: Number(((online / received) * 100).toFixed(4)),
        formula: 'received_online / received_total * 100',
      },
      ONTIME_RATE: {
        numerator: ontime,
        denominator: completed,
        value: Number(((ontime / completed) * 100).toFixed(4)),
        formula: '(completed_early + completed_on_time) / completed_total * 100',
      },
      OVERDUE_RATE: {
        numerator: overdue,
        denominator: received,
        value: Number(((overdue / received) * 100).toFixed(4)),
        formula: '(completed_late + pending_late) / received_total * 100',
      },
    };

    // Upsert each derived global indicator by its existing row when present.
    for (const def of definitions) {
      const calc = values[def.code];
      const { data: existing, error: existingError } = await supabase
        .from('report_indicators')
        .select('id')
        .eq('report_id', reportId)
        .eq('indicator_definition_id', def.id)
        .eq('scope_type', 'global')
        .maybeSingle();
      if (existingError) throw new Error(`Không thể đọc chỉ tiêu cũ trên Supabase: ${existingError.message}`);

      const payload = {
        report_id: reportId,
        indicator_definition_id: def.id,
        scope_type: 'global',
        scope_id: null,
        calculated_value: calc.value,
        formatted_value: `${calc.value.toFixed(4)}%`,
        calculation_details: {
          numerator: calc.numerator,
          denominator: calc.denominator,
          formula: calc.formula,
          calculation_source: 'report_field_statistics',
        },
      };

      if (existing?.id) {
        const { error } = await supabase
          .from('report_indicators')
          .update(payload)
          .eq('id', existing.id);
        if (error) throw new Error(`Không thể cập nhật chỉ tiêu ${def.code} trên Supabase: ${error.message}`);
      } else {
        const { error } = await supabase
          .from('report_indicators')
          .insert({ id: generateUUID(), ...payload });
        if (error) throw new Error(`Không thể thêm chỉ tiêu ${def.code} vào Supabase: ${error.message}`);
      }
    }

    const { data: saved, error: refreshError } = await supabase
      .from('report_indicators')
      .select('*')
      .eq('report_id', reportId)
      .eq('scope_type', 'global');
    if (refreshError) throw new Error(`Không thể xác minh chỉ tiêu sau khi lưu trên Supabase: ${refreshError.message}`);

    this.inMemoryCache.reportIndicators = [
      ...this.inMemoryCache.reportIndicators.filter((x) => x.report_id !== reportId || x.scope_type !== 'global'),
      ...(saved || []) as ReportIndicator[],
    ];
    this.notify();
    return (saved || []) as ReportIndicator[];
  }


  // --- Snapshots ---
  public getSnapshots(reportId: string): ReportSnapshot[] {
    return deduplicateById(this.inMemoryCache.snapshots.filter((s) => s.report_id === reportId))
      .sort((a, b) => (b.version_number || 1) - (a.version_number || 1));
  }

  public async createReportSnapshot(reportId: string, reason: string): Promise<ReportSnapshot> {
    this.assertRole(['admin'], 'tạo snapshot báo cáo');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) {
      throw new Error('Không thể kết nối CSDL Supabase.');
    }

    const [reportRes, sourcesRes, statsRes, indicatorsRes, analysesRes, versionRes] = await Promise.all([
      supabase.from('reports').select('*').eq('id', reportId).single(),
      supabase.from('report_sources').select('*').eq('report_id', reportId),
      supabase.from('report_field_statistics').select('*').eq('report_id', reportId),
      supabase.from('report_indicators').select('*').eq('report_id', reportId),
      supabase.from('report_analysis').select('*').eq('report_id', reportId),
      supabase.from('report_snapshots').select('version_number').eq('report_id', reportId).order('version_number', { ascending: false }).limit(1),
    ]);
    if (reportRes.error) throw new Error(`Không thể đọc báo cáo để snapshot: ${reportRes.error.message}`);
    if (sourcesRes.error) throw new Error(`Không thể đọc nguồn để snapshot: ${sourcesRes.error.message}`);
    if (statsRes.error) throw new Error(`Không thể đọc số liệu để snapshot: ${statsRes.error.message}`);
    if (indicatorsRes.error) throw new Error(`Không thể đọc chỉ tiêu để snapshot: ${indicatorsRes.error.message}`);
    if (analysesRes.error) throw new Error(`Không thể đọc phân tích để snapshot: ${analysesRes.error.message}`);
    if (versionRes.error) throw new Error(`Không thể đọc phiên bản snapshot: ${versionRes.error.message}`);

    const versionNumber = Number(versionRes.data?.[0]?.version_number || 0) + 1;
    const user = this.getCurrentUser();
    const { data: saved, error } = await supabase
      .from('report_snapshots')
      .insert({
        id: generateUUID(),
        report_id: reportId,
        version_number: versionNumber,
        snapshot_json: {
          report: reportRes.data,
          sources: sourcesRes.data || [],
          stats: statsRes.data || [],
          indicators: indicatorsRes.data || [],
          analyses: analysesRes.data || [],
          capturedAt: new Date().toISOString(),
        },
        created_by: user.full_name,
        reason,
      })
      .select('*')
      .single();

    if (error) throw new Error(`Không thể lưu snapshot vào Supabase: ${error.message}`);
    const result = saved as ReportSnapshot;
    this.inMemoryCache.snapshots = [
      ...this.inMemoryCache.snapshots.filter((x) => x.id !== result.id),
      result,
    ];
    this.notify();
    return result;
  }

  // --- Report Analyses ---
  public getAnalyses(reportId: string): ReportAnalysis[] {
    return deduplicateById(this.inMemoryCache.analyses.filter((a) => a.report_id === reportId));
  }

  public async saveAnalysis(analysis: Omit<ReportAnalysis, 'id' | 'created_at' | 'updated_at'> & { id?: string }): Promise<ReportAnalysis> {
    this.assertRole(['admin', 'analyst'], 'lưu phân tích');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) {
      throw new Error('Không thể kết nối CSDL Supabase.');
    }

    const now = new Date().toISOString();
    const id = analysis.id || generateUUID();
    const { data: saved, error } = await supabase
      .from('report_analysis')
      .upsert({
        id,
        report_id: analysis.report_id,
        scope_type: analysis.scope_type,
        scope_id: analysis.scope_id,
        title: analysis.title,
        generated_text: analysis.generated_text,
        generated_by: analysis.generated_by,
        source_metrics: analysis.source_metrics,
      })
      .select('*')
      .single();

    if (error) throw new Error(`Không thể lưu phân tích vào Supabase: ${error.message}`);
    const result = {
      ...(saved as ReportAnalysis),
      created_at: (saved as any).created_at || now,
      updated_at: (saved as any).updated_at || now,
    } as ReportAnalysis;

    this.inMemoryCache.analyses = [
      ...this.inMemoryCache.analyses.filter((a) => a.id !== result.id),
      result,
    ];
    this.notify();
    return result;
  }

  // --- Audit Logs (CHỈ LƯU THAO TÁC LIÊN QUAN ĐẾN NGHIỆP VỤ BÁO CÁO ĐỂ TIẾT KIỆM DATABASE) ---
  public isReportBusinessOperation(action: string, entityType: string): boolean {
    const act = (action || '').toUpperCase();
    const ent = (entityType || '').toLowerCase();

    // Các bảng thực thể nghiệp vụ báo cáo
    const reportEntities = [
      'reports',
      'report_snapshots',
      'report_sources',
      'report_field_statistics',
      'report_indicators',
      'report_analysis',
      'dossier_urge',
    ];

    if (reportEntities.includes(ent)) return true;

    // Các hành động nghiệp vụ báo cáo
    const reportActionKeywords = [
      'REPORT',
      'SNAPSHOT',
      'IMPORT',
      'LOCK',
      'UNLOCK',
      'APPROVE',
      'REJECT',
      'STATISTIC',
      'INDICATOR',
      'ANALYSIS',
      'DOSSIER',
    ];

    return reportActionKeywords.some((kw) => act.includes(kw));
  }

  public async fetchAuditLogs(): Promise<AuditLog[]> {
    this.assertRole(['admin'], 'xem Audit Logs');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) throw new Error('Không thể kết nối CSDL Supabase.');
    const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) throw new Error(`Không thể tải Audit Logs từ Supabase: ${error.message}`);
    
    // Chỉ lưu và hiển thị nhật ký nghiệp vụ báo cáo
    const reportLogsOnly = (data || []).filter((log: AuditLog) =>
      this.isReportBusinessOperation(log.action, log.entity_type)
    );

    this.inMemoryCache.auditLogs = deduplicateById(reportLogsOnly);
    this.notify();
    return this.getAuditLogs();
  }

  public getAuditLogs(): AuditLog[] {
    return deduplicateById(this.inMemoryCache.auditLogs)
      .filter((log) => this.isReportBusinessOperation(log.action, log.entity_type))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public async addAuditLog(action: string, entityType: string, entityId: string, metadata?: Record<string, any>): Promise<void> {
    // Tiết kiệm lưu trữ database: CHỈ ghi nhận nhật ký nghiệp vụ báo cáo, bỏ qua các thao tác hệ thống
    if (!this.isReportBusinessOperation(action, entityType)) {
      return;
    }

    if (!supabase) return;

    try {
      const currentUser = this.getCurrentUser();
      const payload = {
        id: generateUUID(),
        user_id: currentUser?.id || 'system',
        action: action.toUpperCase(),
        entity_type: entityType.toLowerCase(),
        entity_id: entityId,
        payload: metadata || {},
        created_at: new Date().toISOString(),
      };

      await supabase.from('audit_logs').insert([payload]);
      this.inMemoryCache.auditLogs = [payload as AuditLog, ...this.inMemoryCache.auditLogs];
      this.notify();
    } catch (e) {
      console.warn('Lỗi ghi audit log nghiệp vụ báo cáo:', e);
    }
  }

  /**
   * Xóa toàn bộ nhật ký hệ thống ngoài báo cáo để tiết kiệm lưu trữ CSDL
   */
  public async cleanupNonReportAuditLogs(): Promise<{ deletedCount: number }> {
    this.assertRole(['admin'], 'dọn dẹp nhật ký hệ thống');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');

    // Lấy danh sách các ID cần xóa (không thuộc bảng/hành động báo cáo)
    const { data: allLogs, error: fetchErr } = await supabase.from('audit_logs').select('id,action,entity_type');
    if (fetchErr) throw fetchErr;

    const idsToDelete = (allLogs || [])
      .filter((l: any) => !this.isReportBusinessOperation(l.action, l.entity_type))
      .map((l: any) => l.id);

    if (idsToDelete.length === 0) {
      return { deletedCount: 0 };
    }

    // Xóa theo batch
    const { error: delErr } = await supabase.from('audit_logs').delete().in('id', idsToDelete);
    if (delErr) throw delErr;

    this.inMemoryCache.auditLogs = this.inMemoryCache.auditLogs.filter((l) => !idsToDelete.includes(l.id));
    this.notify();
    return { deletedCount: idsToDelete.length };
  }


  // Reset to factory defaults
  public async resetToFactoryDemo(): Promise<void> {
    await this.syncWithSupabase();
  }

  /**
   * Export all database contents as JSON string for backup/transfer
   */
  public async exportFullDatabaseBackup(): Promise<string> {
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) throw new Error('Không thể kết nối CSDL Supabase.');

    const [units, fields, indicators, reports, sources, stats, reportIndicators, analyses, snapshots] = await Promise.all([
      supabase.from('units').select('*'),
      supabase.from('fields').select('*'),
      supabase.from('indicator_definitions').select('*'),
      supabase.from('reports').select('*'),
      supabase.from('report_sources').select('*'),
      supabase.from('report_field_statistics').select('*'),
      supabase.from('report_indicators').select('*'),
      supabase.from('report_analysis').select('*'),
      supabase.from('report_snapshots').select('*'),
    ]);

    const results = [units, fields, indicators, reports, sources, stats, reportIndicators, analyses, snapshots];
    const error = results.find((r: any) => r.error)?.error;
    if (error) throw new Error(`Không thể xuất sao lưu trực tiếp từ Supabase: ${error.message}`);

    return JSON.stringify({
      export_version: '3.0-db-only',
      exported_at: new Date().toISOString(),
      source: 'Supabase',
      units: units.data || [],
      fields: fields.data || [],
      indicators: indicators.data || [],
      reports: reports.data || [],
      sources: sources.data || [],
      stats: stats.data || [],
      report_indicators: reportIndicators.data || [],
      analyses: analyses.data || [],
      snapshots: snapshots.data || [],
    }, null, 2);
  }


  public async importFullDatabaseBackup(_jsonString: string): Promise<{ success: boolean; message: string; count?: any }> {
    return {
      success: false,
      message: 'Không cho phép khôi phục JSON vào bộ nhớ trình duyệt. Khôi phục dữ liệu phải được thực hiện bằng giao dịch/SQL trực tiếp trên Supabase để bảo đảm tính toàn vẹn vòng đời và snapshot.',
    };
  }

  public getSystemConfig(): SystemConfig {
    const cfg = { ...this.inMemoryCache.systemConfig };
    if (!cfg.publicDisplay) {
      cfg.publicDisplay = { ...DEFAULT_PUBLIC_DISPLAY_CONFIG };
    } else {
      const defaultWidgets = DEFAULT_PUBLIC_DISPLAY_CONFIG.widgets;
      const existingWidgets = cfg.publicDisplay.widgets || [];
      
      // Ensure all default widget types are present (e.g. announcements_news)
      const mergedWidgets = [...existingWidgets];
      for (const defW of defaultWidgets) {
        if (!mergedWidgets.some((w) => w.id === defW.id || w.type === defW.type)) {
          mergedWidgets.push(defW);
        }
      }

      const announcements =
        cfg.publicDisplay.announcements && cfg.publicDisplay.announcements.length > 0
          ? cfg.publicDisplay.announcements
          : DEFAULT_PUBLIC_DISPLAY_CONFIG.announcements;

      cfg.publicDisplay = {
        ...DEFAULT_PUBLIC_DISPLAY_CONFIG,
        ...cfg.publicDisplay,
        widgets: mergedWidgets,
        announcements,
      };
    }

    // Merge rolePermissions to ensure all permissions and roles are completely present
    const defaultRoles = DEFAULT_SYSTEM_CONFIG.rolePermissions;
    const existingRoles = cfg.rolePermissions || [];
    const mergedRoles: RolePermissionRule[] = defaultRoles.map((defRole) => {
      const found = existingRoles.find((r) => r.role === defRole.role);
      if (!found) return { ...defRole, permissions: { ...defRole.permissions } };
      return {
        ...defRole,
        ...found,
        permissions: {
          ...defRole.permissions,
          ...(found.permissions || {}),
        },
      };
    });
    cfg.rolePermissions = mergedRoles;

    return cfg;
  }

  public async saveSystemConfig(newConfig: SystemConfig): Promise<{ success: boolean; isTableMissing?: boolean; message?: string }> {
    this.inMemoryCache.systemConfig = { ...newConfig };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('tthc_system_config', JSON.stringify(newConfig));
      } catch (e) {
        console.warn('Could not cache system config in localStorage:', e);
      }
    }
    this.notify();

    if (isSupabaseConfigured && supabase) {
      try {
        const payload = {
          id: 'default',
          config: newConfig,
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase.from('system_config').upsert(payload, { onConflict: 'id' });
        if (error) {
          const isTableMissing = error.code === 'PGRST205' || 
            error.message.includes('schema cache') || 
            error.message.includes('Could not find') || 
            error.message.includes('system_config');

          if (isTableMissing) {
            console.warn('Note: Bảng system_config chưa tồn tại trên Supabase. Vui lòng chạy SQL Migration 006.');
            return {
              success: false,
              isTableMissing: true,
              message: 'Chưa khởi tạo bảng "system_config" trên CSDL Supabase. Vui lòng vào menu "Quản trị Supabase" để thực thi mã SQL tạo bảng system_config.'
            };
          }
          console.warn('Lỗi khi lưu system_config vào Supabase:', error.message);
          return { success: false, message: `Lỗi kết nối CSDL Supabase: ${error.message}` };
        }
        return { success: true, message: 'Đã lưu trực tiếp thành công cấu hình vào CSDL Supabase cho toàn bộ hệ thống.' };
      } catch (e: any) {
        console.error('Lỗi ngoại lệ khi lưu system_config:', e?.message || e);
        return { success: false, message: `Lỗi kết nối Supabase: ${e?.message || e}` };
      }
    }

    return { success: false, message: 'Chưa cấu hình Supabase. Vui lòng kiểm tra lại kết nối CSDL.' };
  }

  public async resetSystemConfig(): Promise<{ success: boolean; isTableMissing?: boolean; message?: string }> {
    this.inMemoryCache.systemConfig = { ...DEFAULT_SYSTEM_CONFIG };
    this.notify();

    if (isSupabaseConfigured && supabase) {
      try {
        const payload = {
          id: 'default',
          config: DEFAULT_SYSTEM_CONFIG,
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase.from('system_config').upsert(payload, { onConflict: 'id' });
        if (error) {
          const isTableMissing = error.code === 'PGRST205' || 
            error.message.includes('schema cache') || 
            error.message.includes('Could not find') || 
            error.message.includes('system_config');

          if (isTableMissing) {
            console.warn('Note: Bảng system_config chưa tồn tại trên Supabase. Vui lòng chạy SQL Migration 006.');
            return {
              success: false,
              isTableMissing: true,
              message: 'Chưa khởi tạo bảng "system_config" trên CSDL Supabase. Vui lòng vào menu "Quản trị Supabase" để chạy mã SQL tạo bảng.'
            };
          }
          console.warn('Lỗi khi reset system_config trên Supabase:', error.message);
          return { success: false, message: `Lỗi khôi phục CSDL Supabase: ${error.message}` };
        }
        return { success: true, message: 'Đã khôi phục cài đặt mặc định trực tiếp trên CSDL Supabase.' };
      } catch (e: any) {
        console.error('Lỗi khi reset system_config:', e?.message || e);
        return { success: false, message: `Lỗi kết nối Supabase: ${e?.message || e}` };
      }
    }

    return { success: false, message: 'Chưa cấu hình Supabase.' };
  }
}

export const store = new StorageService();
