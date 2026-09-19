# HỆ THỐNG TỔNG HỢP, PHÂN TÍCH TÌNH HÌNH TIẾP NHẬN, GIẢI QUYẾT THỦ TỤC HÀNH CHÍNH (TTHC)

Hệ thống quản lý, tổng hợp số liệu, phân tích tình hình tiếp nhận và giải quyết thủ tục hành chính, thay thế quy trình thống kê Excel thủ công bằng hệ thống cơ sở dữ liệu số hóa hoàn chỉnh.

---

## 1. Tính năng cốt lõi

1. **Quản lý kỳ báo cáo độc lập**:
   - Mỗi kỳ báo cáo (tuần, tháng, đột xuất) là một thực thể độc lập với mã báo cáo duy nhất.
   - Trạng thái vòng đời: `draft` -> `imported` -> `validated` -> `submitted` -> `approved` -> `locked` -> `archived`.
   - Báo cáo đã khóa (`locked`) lưu snapshot bất biến; thay đổi cấu hình/công thức sau đó không làm sai lệch số liệu lịch sử.

2. **Cơ cấu dữ liệu & Granularity**:
   - Cấp hạt nhân của dữ liệu nguồn: `REPORT` + `SOURCE` + `FIELD`.
   - Hỗ trợ nhiều nguồn trong cùng 1 báo cáo (VD: "Trên Hệ thống các Bộ", "Trên Hệ thống thành phố").
   - Mỗi Lĩnh vực thuộc đúng một Đơn vị (Văn phòng, Phòng Kinh tế, Phòng VHXH).
   - Dòng "TỔNG CỘNG" là kết quả tổng hợp tính toán, không lưu trữ như dòng dữ liệu gốc.

3. **Rule Engine & Thẩm định dữ liệu (Validation)**:
   - Tự động kiểm tra công thức cân bằng:
     * `received_total = received_online + received_offline + carried_forward`
     * `completed_total = completed_early + completed_on_time + completed_late`
     * `pending_total = pending_on_time + pending_late`
     * `balance = received_total - (completed_total + pending_total)`
   - Phát hiện chênh lệch giữa số tổng ghi trên file nguồn và tổng thành phần thực tế (ví dụ trường hợp chênh lệch 1 hồ sơ trên hệ thống thành phố).

4. **Trực quan hóa & Phân tích chuyên sâu**:
   - Dashboard tổng hợp KPI với 14 chỉ tiêu nghiệp vụ và biểu đồ đa chiều (Recharts).
   - Phân tích theo Đơn vị với tính năng Drill-down: Đơn vị -> Lĩnh vực -> Nguồn -> Dữ liệu.
   - Phân tích theo Lĩnh vực và So sánh nhiều kỳ (chênh lệch tuyệt đối, % tăng giảm).

5. **Trợ lý phân tích AI (Server-side Gemini)**:
   - Sử dụng mô hình `gemini-3.8-flash` gọi qua endpoint server-side an toàn (`/api/gemini/generate-analysis`).
   - AI chỉ đọc số liệu metrics đã tính toán chuẩn xác từ Rule Engine để sinh nhận xét, diễn giải chuyên môn; tuyệt đối không tự bịa số hay tính toán lại số liệu.

6. **Xuất báo cáo & Nhật ký kiểm toán**:
   - Xuất dữ liệu báo cáo sang Excel (`.xlsx`) và CSV chuẩn format hành chính Việt Nam.
   - Ghi nhận `audit_logs` mọi thao tác nghiệp vụ quan trọng.

---

## 2. Công nghệ sử dụng

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Recharts, React Router.
- **Backend**: Node.js Express server (`server.ts`) kết hợp Vite middleware, `@google/genai` server-side SDK.
- **Database / Storage**: Supabase PostgreSQL, Row Level Security (RLS), Supabase Auth.
- **Engine tính toán**: Safe rule engine (không dùng `eval()`).

---

## 3. Cấu hình biến môi trường

Khai báo trong file `.env`:
```env
# Gemini API Key (Server-side)
GEMINI_API_KEY="AIzaSy..."

# Supabase Credentials
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOi..."
```

---

## 4. Hướng dẫn cài đặt và khởi chạy

```bash
# Cài đặt dependencies
npm install

# Khởi chạy chế độ phát triển
npm run dev

# Build sản phẩm
npm run build

# Khởi chạy production server
npm start
```
