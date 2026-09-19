import fs from 'fs';

const units = [
  { id: "u1000000-0000-0000-0000-000000000001", code: "VP", name: "Văn phòng", display_order: 1 },
  { id: "u1000000-0000-0000-0000-000000000002", code: "KT", name: "Phòng Kinh tế", display_order: 2 },
  { id: "u1000000-0000-0000-0000-000000000003", code: "VHXH", name: "Phòng VHXH", display_order: 3 }
];

const fields = [
  // VP
  { id: "f1000000-0000-0000-0000-000000000001", code: "CT", name: "Chứng thực", unit_id: units[0].id, unit_name: units[0].name, display_order: 1 },
  { id: "f1000000-0000-0000-0000-000000000002", code: "HT", name: "Hộ tịch", unit_id: units[0].id, unit_name: units[0].name, display_order: 2 },
  { id: "f1000000-0000-0000-0000-000000000003", code: "PLP", name: "Phí, lệ phí", unit_id: units[0].id, unit_name: units[0].name, display_order: 3 },
  // KT
  { id: "f1000000-0000-0000-0000-000000000004", code: "ATTP", name: "An toàn thực phẩm", unit_id: units[1].id, unit_name: units[1].name, display_order: 4 },
  { id: "f1000000-0000-0000-0000-000000000005", code: "HHDT", name: "Hàng hải và đường thủy nội địa", unit_id: units[1].id, unit_name: units[1].name, display_order: 5 },
  { id: "f1000000-0000-0000-0000-000000000006", code: "QH", name: "Quy hoạch đô thị và nông thôn", unit_id: units[1].id, unit_name: units[1].name, display_order: 6 },
  { id: "f1000000-0000-0000-0000-000000000007", code: "XD", name: "Hoạt động xây dựng", unit_id: units[1].id, unit_name: units[1].name, display_order: 7 },
  { id: "f1000000-0000-0000-0000-000000000008", code: "LTHH", name: "Lưu thông hàng hóa trong nước", unit_id: units[1].id, unit_name: units[1].name, display_order: 8 },
  { id: "f1000000-0000-0000-0000-000000000009", code: "DD", name: "Đất đai", unit_id: units[1].id, unit_name: units[1].name, display_order: 9 },
  { id: "f1000000-0000-0000-0000-000000000010", code: "TS", name: "Thủy sản", unit_id: units[1].id, unit_name: units[1].name, display_order: 10 },
  // VHXH
  { id: "f1000000-0000-0000-0000-000000000011", code: "BTXH", name: "Bảo trợ xã hội", unit_id: units[2].id, unit_name: units[2].name, display_order: 11 },
  { id: "f1000000-0000-0000-0000-000000000012", code: "GDMN", name: "Giáo dục mầm non", unit_id: units[2].id, unit_name: units[2].name, display_order: 12 },
  { id: "f1000000-0000-0000-0000-000000000013", code: "GDTH", name: "Giáo dục trung học", unit_id: units[2].id, unit_name: units[2].name, display_order: 13 },
  { id: "f1000000-0000-0000-0000-000000000014", code: "NCC", name: "Người có công", unit_id: units[2].id, unit_name: units[2].name, display_order: 14 },
  { id: "f1000000-0000-0000-0000-000000000015", code: "CS", name: "Chính sách", unit_id: units[2].id, unit_name: units[2].name, display_order: 15 }
];

const periods = [
  { id: "r1000000-0000-0000-0000-000000000001", code: "BC-2026-01", name: "Báo cáo TTHC Tháng 01/2026", type: "monthly", start: "2026-01-01", end: "2026-01-31", status: "approved" },
  { id: "r1000000-0000-0000-0000-000000000002", code: "BC-2026-02", name: "Báo cáo TTHC Tháng 02/2026", type: "monthly", start: "2026-02-01", end: "2026-02-28", status: "validated" }
];

const sourceNames = [
  "Trên Hệ thống các Bộ",
  "Trên Hệ thống thành phố"
];

let sql = `-- ====================================================================
-- SEED DATA: 002_seed.sql
-- 1. 3 Units: Văn phòng, Phòng Kinh tế, Phòng VHXH
-- 2. Demo field master data (Each field belongs to exactly ONE unit)
-- 3. 2 Source systems: Trên Hệ thống các Bộ, Trên Hệ thống thành phố
-- 4. 2 Demo reporting periods
-- 5. Mathematically valid demo statistics (Grain: REPORT + SOURCE + FIELD)
-- ====================================================================

-- 1. Insert 3 Units
INSERT INTO public.units (id, code, name, display_order, active) VALUES
` + units.map(u => `  ('${u.id}', '${u.code}', '${u.name}', ${u.display_order}, true)`).join(",\n") + `
ON CONFLICT (code) DO NOTHING;

-- 2. Insert Demo Fields Master Data
INSERT INTO public.fields (id, code, name, unit_id, display_order, active) VALUES
` + fields.map(f => `  ('${f.id}', '${f.code}', '${f.name}', '${f.unit_id}', ${f.display_order}, true)`).join(",\n") + `
ON CONFLICT (code) DO NOTHING;

-- 3. Insert 2 Reporting Periods
INSERT INTO public.reporting_periods (id, report_code, report_name, report_type, period_start, period_end, status, created_by) VALUES
` + periods.map(p => `  ('${p.id}', '${p.code}', '${p.name}', '${p.type}', '${p.start}', '${p.end}', '${p.status}', 'Hệ thống')`).join(",\n") + `
ON CONFLICT (report_code) DO NOTHING;

-- 4. Insert Sources (2 sources per reporting period)
`;

const sources = [];
periods.forEach((p, pIdx) => {
  sourceNames.forEach((sName, sIdx) => {
    const sId = `s1000000-0000-0000-${pIdx + 1}000-00000000000${sIdx + 1}`;
    sources.push({ id: sId, report_id: p.id, source_name: sName });
  });
});

sql += `INSERT INTO public.report_sources (id, report_id, source_type, source_name, original_filename, import_status) VALUES
` + sources.map(s => `  ('${s.id}', '${s.report_id}', 'system', '${s.source_name}', 'du_lieu_${s.source_name === "Trên Hệ thống các Bộ" ? "cac_bo" : "thanh_pho"}.xlsx', 'completed')`).join(",\n") + `
ON CONFLICT (id) DO NOTHING;

-- 5. Insert Mathematically Valid Demo Statistics
-- Statistical grain: REPORT + SOURCE + FIELD
INSERT INTO public.report_statistics (
  id, report_id, source_id, field_id, field_code, field_name_snapshot,
  unit_id, unit_name_snapshot,
  received_total, received_online, received_offline, carried_forward,
  completed_total, completed_early, completed_on_time, completed_late,
  pending_total, pending_on_time, pending_late,
  validation_status
) VALUES
`;

const statRows = [];
let rowNum = 1;

periods.forEach((p, pIdx) => {
  const periodSources = sources.filter(s => s.report_id === p.id);
  periodSources.forEach((s, sIdx) => {
    fields.forEach((f, fIdx) => {
      const baseSeed = (pIdx + 1) * 37 + (sIdx + 1) * 19 + (fIdx + 1) * 7;
      
      const received_online = 25 + (baseSeed % 40);
      const received_offline = 5 + (baseSeed % 12);
      const carried_forward = (baseSeed % 4 === 0) ? 3 : 0;
      const received_total = received_online + received_offline + carried_forward;
      
      const pending_late = (baseSeed % 8 === 0) ? 1 : 0;
      const pending_on_time = 2 + (baseSeed % 5);
      const pending_total = pending_on_time + pending_late;
      
      const completed_total = received_total - pending_total;
      const completed_late = (baseSeed % 6 === 0) ? 1 : 0;
      const completed_early = Math.floor(completed_total * 0.55);
      const completed_on_time = completed_total - completed_early - completed_late;
      
      // Strict mathematical assertion
      if (received_total !== received_online + received_offline + carried_forward) {
        throw new Error(`Formula 1 failed at row ${rowNum}`);
      }
      if (completed_total !== completed_early + completed_on_time + completed_late) {
        throw new Error(`Formula 2 failed at row ${rowNum}`);
      }
      if (pending_total !== pending_on_time + pending_late) {
        throw new Error(`Formula 3 failed at row ${rowNum}`);
      }
      if (received_total !== completed_total + pending_total) {
        throw new Error(`Formula 4 failed at row ${rowNum}`);
      }
      
      const hexId = ("000000000000" + rowNum.toString(16)).slice(-12);
      const statId = `d1000000-0000-0000-0000-${hexId}`;
      rowNum++;
      
      statRows.push(`  ('${statId}', '${p.id}', '${s.id}', '${f.id}', '${f.code}', '${f.name}', '${f.unit_id}', '${f.unit_name}', ${received_total}, ${received_online}, ${received_offline}, ${carried_forward}, ${completed_total}, ${completed_early}, ${completed_on_time}, ${completed_late}, ${pending_total}, ${pending_on_time}, ${pending_late}, 'valid')`);
    });
  });
});

sql += statRows.join(",\n") + `
ON CONFLICT (report_id, source_id, field_id) DO UPDATE SET
  received_total = EXCLUDED.received_total,
  received_online = EXCLUDED.received_online,
  received_offline = EXCLUDED.received_offline,
  carried_forward = EXCLUDED.carried_forward,
  completed_total = EXCLUDED.completed_total,
  completed_early = EXCLUDED.completed_early,
  completed_on_time = EXCLUDED.completed_on_time,
  completed_late = EXCLUDED.completed_late,
  pending_total = EXCLUDED.pending_total,
  pending_on_time = EXCLUDED.pending_on_time,
  pending_late = EXCLUDED.pending_late,
  validation_status = 'valid';
`;

fs.writeFileSync("supabase/seed.sql", sql);
console.log(`Successfully generated supabase/seed.sql with ${statRows.length} mathematically validated records.`);
