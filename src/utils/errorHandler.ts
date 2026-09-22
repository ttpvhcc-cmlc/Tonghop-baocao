/**
 * Chuyển đổi các thông báo lỗi kỹ thuật (Database, Supabase, Network, Trigger)
 * thành thông điệp tiếng Việt thân thiện, dễ hiểu cho người dùng nghiệp vụ.
 */

export function getFriendlyErrorMessage(
  err: unknown,
  fallbackMessage: string = 'Đã có lỗi xảy ra trong quá trình xử lý. Vui lòng thử lại.'
): string {
  if (!err) return fallbackMessage;

  const rawMessage =
    typeof err === 'string'
      ? err
      : (err as any)?.message || (err as any)?.error_description || String(err);

  const lower = rawMessage.toLowerCase();

  // 1. Lỗi vòng đời báo cáo (Report Lifecycle & Status Transitions)
  if (
    lower.includes('chuyển đổi trạng thái không hợp lệ') ||
    lower.includes('vòng đời bắt buộc') ||
    lower.includes('lifecycle')
  ) {
    if (lower.includes('validated') && lower.includes('imported')) {
      return 'Kỳ báo cáo này đã được thẩm định số liệu trước đó. Hệ thống sẽ cập nhật bổ sung số liệu mà không làm thay đổi tiến trình xử lý.';
    }
    if (lower.includes('submitted') || lower.includes('approved')) {
      return 'Kỳ báo cáo này đã được gửi duyệt hoặc phê duyệt chính thức. Bạn không thể nhập đè số liệu trực tiếp. Vui lòng tạo một kỳ báo cáo mới hoặc liên hệ cấp quản lý để mở lại.';
    }
    return 'Quy trình xử lý của kỳ báo cáo này không cho phép thực hiện thao tác trên. Vui lòng chọn một kỳ báo cáo ở trạng thái Dự thảo hoặc Tạo kỳ mới.';
  }

  // 2. Lỗi báo cáo đã bị Khóa sổ / Đóng băng / Lưu trữ
  if (
    lower.includes('locked') ||
    lower.includes('đã khóa') ||
    lower.includes('archived') ||
    lower.includes('lưu trữ') ||
    lower.includes('bất biến') ||
    lower.includes('đóng băng')
  ) {
    return 'Kỳ báo cáo này đã được Khóa sổ (chốt số liệu) hoặc Lưu trữ. Để bảo toàn số liệu lịch sử, không thể chỉnh sửa hay nhập đè. Vui lòng tạo kỳ mới.';
  }

  // 3. Lỗi xác thực và quyền truy cập (RBAC / Auth)
  if (
    lower.includes('permission denied') ||
    lower.includes('không có quyền') ||
    lower.includes('chỉ admin') ||
    lower.includes('chỉ lãnh đạo') ||
    lower.includes('quyền truy cập')
  ) {
    return 'Tài khoản của bạn không có đủ quyền hạn để thực hiện thao tác này. Vui lòng liên hệ Quản trị viên để được cấp quyền.';
  }

  if (
    lower.includes('jwt') ||
    lower.includes('session') ||
    lower.includes('not authenticated') ||
    lower.includes('hết hạn')
  ) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục làm việc.';
  }

  // 4. Lỗi trùng lặp dữ liệu (Unique constraint / Duplicate)
  if (
    lower.includes('duplicate key') ||
    lower.includes('đã tồn tại') ||
    lower.includes('unique constraint') ||
    lower.includes('mã lĩnh vực') ||
    lower.includes('mã chỉ tiêu') ||
    lower.includes('mã báo cáo')
  ) {
    return 'Mã định danh hoặc thông tin này đã tồn tại trong hệ thống. Vui lòng kiểm tra và sử dụng mã khác.';
  }

  // 5. Lỗi kết nối mạng & máy chủ CSDL
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('không thể kết nối csdl') ||
    lower.includes('supabase chưa được cấu hình')
  ) {
    return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại đường truyền mạng Internet và thử lại sau giây lát.';
  }

  // 6. Lỗi cấu trúc / Ràng buộc dữ liệu (Foreign key / Missing catalog)
  if (
    lower.includes('public.fields') ||
    lower.includes('public.units') ||
    lower.includes('không tồn tại trong danh mục')
  ) {
    return 'Thông tin Lĩnh vực hoặc Đơn vị trong file không khớp với danh mục hiện hành. Vui lòng kiểm tra lại ánh xạ ở bảng thẩm định.';
  }

  // 7. Lỗi chưa chọn / chưa có dữ liệu hợp lệ
  if (lower.includes('chưa có dữ liệu excel') || lower.includes('chưa được ánh xạ')) {
    return rawMessage;
  }

  // Loại bỏ các đoạn tiền tố kỹ thuật nếu có
  let cleaned = rawMessage
    .replace(/^error:\s*/i, '')
    .replace(/^không thể cập nhật trạng thái trên supabase:\s*/i, '')
    .replace(/^lỗi:\s*/i, '')
    .trim();

  // Nếu câu thông báo ngắn và thuần Việt thì giữ lại, ngược lại cung cấp thông báo rõ ràng
  if (cleaned.length > 0 && !cleaned.includes('PostgresError') && !cleaned.includes('schema')) {
    return cleaned;
  }

  return fallbackMessage;
}
