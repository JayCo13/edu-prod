"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Check, Download, FileSpreadsheet, X } from "lucide-react";
import ExcelJS from "exceljs";

import { importStudents } from "@/modules/students/actions";
import {
  STUDENT_IMPORT_HEADERS,
  type ImportResult,
  type StudentImportRow,
} from "@/modules/students/types";

interface Props {
  onClose: () => void;
  onDone: () => void;
}

export default function StudentImportModal({ onClose, onDone }: Props) {
  const [parsed, setParsed] = useState<StudentImportRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleFile(file: File) {
    setParseError(null);
    setParsed([]);
    setResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
      const ws = wb.worksheets[0];
      if (!ws) {
        setParseError("File Excel rỗng.");
        return;
      }

      // Đọc header row 1
      const headerCells: string[] = [];
      ws.getRow(1).eachCell((cell, col) => {
        headerCells[col - 1] = String(cell.value ?? "").trim();
      });

      // Map header → key. Accept cả label tiếng Việt và key tiếng Anh.
      const colMap = new Map<number, keyof StudentImportRow>();
      headerCells.forEach((h, idx) => {
        const found = STUDENT_IMPORT_HEADERS.find(
          (def) => def.label === h || def.key === (h as keyof StudentImportRow),
        );
        if (found) colMap.set(idx, found.key);
      });

      if (!Array.from(colMap.values()).includes("display_name")) {
        setParseError(`Không tìm thấy cột "Họ và tên". Tải template để dùng đúng định dạng.`);
        return;
      }

      const rows: StudentImportRow[] = [];
      const lastRow = ws.lastRow?.number ?? 1;
      for (let r = 2; r <= lastRow; r++) {
        const row = ws.getRow(r);
        const obj: Partial<StudentImportRow> = {};
        let hasAny = false;
        row.eachCell((cell, col) => {
          const key = colMap.get(col - 1);
          if (!key) return;
          const raw = cell.value;
          let val = "";
          if (raw == null) val = "";
          else if (raw instanceof Date) {
            val = formatDateExcel(raw);
          } else if (typeof raw === "object" && "text" in raw) {
            val = String((raw as { text: string }).text ?? "").trim();
          } else {
            val = String(raw).trim();
          }
          if (val) hasAny = true;
          (obj as Record<string, string>)[key] = val;
        });
        if (hasAny && obj.display_name) {
          rows.push(obj as StudentImportRow);
        }
      }

      if (rows.length === 0) {
        setParseError("Không có dòng hợp lệ — kiểm tra cột Họ và tên.");
        return;
      }
      setParsed(rows);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Lỗi đọc Excel.");
    }
  }

  function handleImport() {
    if (parsed.length === 0) return;
    startTransition(async () => {
      const r = await importStudents(parsed);
      if (r.success) setResult(r.data);
      else setParseError(r.error);
    });
  }

  async function downloadTemplate() {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Học sinh");
    ws.columns = STUDENT_IMPORT_HEADERS.map((h) => ({
      header: h.label,
      key: h.key,
      width: Math.max(h.label.length + 2, 18),
    }));
    // Hint row
    const hint: Record<string, string> = {};
    STUDENT_IMPORT_HEADERS.forEach((h) => {
      hint[h.key] = h.hint ?? "";
    });
    ws.addRow(hint);
    // Sample row
    ws.addRow({
      student_code: "",
      display_name: "Nguyễn Văn A",
      dob: "15/08/2010",
      gender: "Nam",
      phone: "",
      parent_name: "Nguyễn Văn B",
      parent_phone: "0901 234 567",
      parent_email: "phuhuynh@email.com",
      address: "123 đường Nguyễn Huệ, Q1, TP.HCM",
      note: "",
    });
    ws.getRow(1).font = { bold: true };
    ws.getRow(2).font = { italic: true, color: { argb: "FF888888" } };

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf as ArrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Template_Hoc_Sinh.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900">Import Excel học sinh</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 text-xs leading-relaxed text-indigo-900">
          File Excel cần các cột: <strong>Mã HS</strong> (trống = tự sinh),{" "}
          <strong>Họ và tên</strong> (bắt buộc), Ngày sinh (DD/MM/YYYY), Giới tính
          (Nam/Nữ/Khác), SĐT, Phụ huynh, SĐT phụ huynh, Email phụ huynh, Địa chỉ,
          Ghi chú.
          <div className="mt-2">
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex items-center gap-1 text-indigo-700 underline-offset-2 hover:underline"
            >
              <Download className="h-3.5 w-3.5" />
              Tải template mẫu
            </button>
          </div>
        </div>

        {!result && (
          <div className="mt-3">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/30 p-6 text-center hover:bg-slate-50">
              <FileSpreadsheet className="h-7 w-7 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">
                Chọn file .xlsx để upload
              </span>
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </label>
          </div>
        )}

        {parseError && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {parseError}
          </p>
        )}

        {parsed.length > 0 && !result && (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-slate-700">
              Sẵn sàng nhập <strong>{parsed.length}</strong> dòng. Hệ thống sẽ:
            </p>
            <ul className="ml-4 list-disc text-xs text-slate-600">
              <li>Tự sinh mã HS nếu cột Mã HS để trống</li>
              <li>Bỏ qua nếu mã HS đã tồn tại</li>
              <li>Bỏ qua nếu trùng (Họ tên + SĐT phụ huynh)</li>
              <li>Báo lỗi từng dòng nếu sai định dạng</li>
            </ul>
            <button
              type="button"
              onClick={handleImport}
              disabled={pending}
              className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Đang nhập…" : `Nhập ${parsed.length} học sinh`}
            </button>
          </div>
        )}

        {result && (
          <div className="mt-3 space-y-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <Check className="mr-1 inline h-4 w-4" />
              Đã nhập thành công <strong>{result.created}</strong> học sinh.
              {result.skipped > 0 && (
                <p className="mt-1 text-xs">
                  Bỏ qua <strong>{result.skipped}</strong> dòng (trùng dữ liệu).
                </p>
              )}
            </div>
            {result.errors.length > 0 && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                <p className="text-xs font-semibold text-rose-800">
                  Lỗi {result.errors.length} dòng:
                </p>
                <ul className="mt-1 max-h-40 overflow-y-auto text-xs text-rose-700">
                  {result.errors.slice(0, 50).map((e, i) => (
                    <li key={i}>
                      • Dòng {e.row_index + 2}: {e.message}
                    </li>
                  ))}
                  {result.errors.length > 50 && (
                    <li className="italic">…và {result.errors.length - 50} lỗi nữa</li>
                  )}
                </ul>
              </div>
            )}
            <button
              type="button"
              onClick={onDone}
              className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90"
            >
              Xong
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDateExcel(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}
