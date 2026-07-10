import * as XLSX from "xlsx";
import Papa from "papaparse";

// 根据表头或列数推断 姓名/学号/班级 的列索引
function resolveColumns(header: string[], sample: string[]): { nameIdx: number; noIdx: number; classIdx: number } {
  const norm = (s: string) => String(s || "").trim().toLowerCase();
  const HEADER_KEYS = ["姓名", "学号", "班级", "name", "no", "class", "学生", "编号", "班"];
  const hasHeader = header.length > 0 && header.some((h) => HEADER_KEYS.includes(norm(h)));
  if (hasHeader) {
    const find = (keys: string[]) =>
      header.findIndex((h) => keys.includes(norm(h)));
    const nName = find(["姓名", "name", "学生"]);
    const nNo = find(["学号", "no", "编号"]);
    const nClass = find(["班级", "class", "班"]);
    return {
      nameIdx: nName >= 0 ? nName : 0,
      noIdx: nNo,
      classIdx: nClass,
    };
  }
  // 无表头：按列数 + 数值特征推断（学号通常为纯数字列）
  const len = (sample || []).length;
  if (len <= 1) return { nameIdx: 0, noIdx: -1, classIdx: -1 };

  const isNum = (v: string) => /^\d+$/.test(String(v ?? "").trim());
  const numericIdx = (sample || []).findIndex(isNum); // 学号所在列

  if (len === 2) {
    // 学号在首列 → 学号,姓名；否则默认 姓名,学号（与界面提示一致）
    if (numericIdx === 0) return { nameIdx: 1, noIdx: 0, classIdx: -1 };
    return { nameIdx: 0, noIdx: 1, classIdx: -1 };
  }
  // 3 列：常见顺序 姓名,学号,班级；按数字列定位学号，其余按位置分配
  if (numericIdx === 1) return { nameIdx: 0, noIdx: 1, classIdx: 2 }; // 姓名,学号,班级
  if (numericIdx === 2) return { nameIdx: 0, noIdx: 2, classIdx: 1 }; // 姓名,班级,学号
  if (numericIdx === 0) return { nameIdx: 1, noIdx: 0, classIdx: 2 }; // 学号,姓名,班级
  return { nameIdx: 0, noIdx: 1, classIdx: 2 }; // 默认 姓名,学号,班级
}

// Parse text/CSV/Excel to get student names (支持 学号、班级 列)
export function parseStudentList(text: string): { name: string; studentNo?: string; class?: string }[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const result = Papa.parse<string[]>(trimmed, { skipEmptyLines: true });
  const rows = result.data;
  if (rows.length === 0) return [];

  const first = rows[0].map((c) => String(c || "").trim());
  const HEADER_KEYS = ["姓名", "学号", "班级", "name", "no", "class", "学生", "编号", "班"];
  const hasHeader = first.some((h) => HEADER_KEYS.includes(h.toLowerCase()));
  const header = hasHeader ? first : [];
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const { nameIdx, noIdx, classIdx } = resolveColumns(header, first);

  return dataRows
    .map((row) => {
      const name = (row[nameIdx] ?? "").trim();
      if (!name) return null;
      return {
        name,
        studentNo: noIdx >= 0 ? (row[noIdx] ?? "").trim() || undefined : undefined,
        class: classIdx >= 0 ? (row[classIdx] ?? "").trim() || undefined : undefined,
      };
    })
    .filter(Boolean) as { name: string; studentNo?: string; class?: string }[];
}

export function parseExcelStudents(file: File): Promise<{ name: string; studentNo?: string; class?: string }[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
        const rawRows = (json as unknown[][])
          .filter((row) => row && row.length > 0)
          .map((row) => row.map((c) => String(c ?? "").trim()));
        if (rawRows.length === 0) {
          resolve([]);
          return;
        }
        const first = rawRows[0];
        const HEADER_KEYS = ["姓名", "学号", "班级", "name", "no", "class", "学生", "编号", "班"];
        const hasHeader = first.some((h) => HEADER_KEYS.includes(h.toLowerCase()));
        const header = hasHeader ? first : [];
        const dataRows = hasHeader ? rawRows.slice(1) : rawRows;
        const { nameIdx, noIdx, classIdx } = resolveColumns(header, first);

        const students = dataRows
          .map((row) => {
            const name = (row[nameIdx] ?? "").trim();
            if (!name) return null;
            return {
              name,
              studentNo: noIdx >= 0 ? (row[noIdx] ?? "").trim() || undefined : undefined,
              class: classIdx >= 0 ? (row[classIdx] ?? "").trim() || undefined : undefined,
            };
          })
          .filter(Boolean) as { name: string; studentNo?: string; class?: string }[];
        resolve(students);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function exportToExcel(
  sheets: { name: string; data: Record<string, unknown>[] }[],
  filename: string
) {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.data);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  XLSX.writeFile(wb, filename);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayStr(): string {
  return formatDate(new Date().toISOString());
}
