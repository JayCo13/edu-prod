"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Brush,
  Check,
  CheckSquare,
  Copy,
  Download,
  LayoutGrid,
  Loader2,
  Maximize2,
  Minus,
  Plus,
  Printer,
  QrCode,
  Redo2,
  Sparkles,
  Square,
  Table,
  Trash2,
  Undo2,
  X,
  ZoomIn,
} from "lucide-react";

import QRCode from "qrcode";

import {
  exportTkbToExcel,
  downloadBlob,
} from "@/modules/timetable/excel-export";
import { getPublicTkbToken } from "@/modules/timetable/actions";
import TimetableTabs from "@/app/(admin)/dashboard/timetable/_components/TimetableTabs";

import type { TenantTeacherRow } from "@/types/database";
import type {
  ClassRow,
  DayOfWeek,
  PeriodRow,
  SubjectRow,
  SubjectTeacherRow,
  TimetableSlotRow,
} from "@/modules/timetable/types";
import { DAY_LABELS } from "@/modules/timetable/types";
import {
  bulkDeleteSlots,
  bulkUpsertSlots,
  copyClassSchedule,
  deleteSlot,
  upsertSlot,
} from "@/modules/timetable/slot-actions";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface Props {
  classes: ClassRow[];
  subjects: SubjectRow[];
  periods: PeriodRow[];
  teachers: TenantTeacherRow[];
  initialSlots: TimetableSlotRow[];
  subjectTeachers: SubjectTeacherRow[];
  centerName: string;
}

const DAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 7];

// ─── CONVENTION (read before touching this constant) ───────────────────
//
// The DB column `timetable_slots.day_of_week` is ISO 8601:
//   1=Mon … 6=Sat, 7=Sun. Vietnamese display label is `day + 1` ("Thứ 2"
//   through "Thứ 7"), with day=7 = "Chủ nhật" (not used in schools).
//
// VN_SCHOOL_DAYS is the list of day_of_week VALUES we iterate (not labels).
// The cell modal stores the iteration value verbatim into day_of_week, so
// **every entry here must be a valid ISO day**. Earlier bug: using
// [2,3,4,5,6,7] saved slots one day off (Thứ 7 click → day=7/Sunday).
//
// If you change this list, also update PublicTkbView, TkbPdfDocument, and
// excel-export.ts to match.
const VN_SCHOOL_DAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6];

/** Display label for the THỨ column: ISO day 1 → "2" (Thứ 2), 6 → "7". */
function dayLabel(day: number): number {
  return day + 1;
}

/** Compute the current Vietnamese academic year + semester from the system
 *  date. School year flips in August (Aug-Dec → year=cur-next, HK=1; Jan-Jul
 *  → year=prev-cur, HK=2). */
function currentAcademic(): { year: string; semester: 1 | 2 } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0=Jan
  if (m >= 7) {
    // Aug-Dec → HK1 of (y / y+1)
    return { year: `${y}-${y + 1}`, semester: 1 };
  }
  return { year: `${y - 1}-${y}`, semester: 2 };
}

/** Best-effort teacher abbreviation for the column header / cell: last
 *  word of the display name. "Nguyễn Văn Nga" → "Nga". Admins can edit
 *  the teacher's display_name to control this. */
function teacherAbbrev(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  return parts[parts.length - 1] || displayName;
}

function hhmm(t: string): string {
  return t.slice(0, 5);
}

function slotKey(classId: string, day: number, periodId: string): string {
  return `${classId}|${day}|${periodId}`;
}

function teacherSlotKey(teacherId: string, day: number, periodId: string): string {
  return `${teacherId}|${day}|${periodId}`;
}

interface CellTarget {
  classId: string;
  day: DayOfWeek;
  periodId: string;
  existing?: TimetableSlotRow;
}

// Shared input class for the filter row — full-width inside its grid column.
const FILTER_INPUT =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm outline-none transition-colors focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100";

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

export default function EditorClient({
  classes,
  subjects,
  periods,
  teachers,
  initialSlots,
  subjectTeachers,
  centerName,
}: Props) {
  const router = useRouter();
  const confirm = useConfirm();

  const [slots, setSlots] = useState(initialSlots);
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id ?? "");
  const [activeCell, setActiveCell] = useState<CellTarget | null>(null);

  // View mode — "grade" matches the printed Vietnamese school TKB layout
  // (all classes in a grade × Day × Period). Default to it because that's
  // how teachers normally arrange schedules. "class" keeps the per-class
  // editor view for detailed work on a single class.
  const [viewMode, setViewMode] = useState<"grade" | "class">("grade");
  const gradesInUse = useMemo(() => {
    const set = new Set<number>();
    for (const c of classes) {
      if (c.grade_level != null) set.add(c.grade_level);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [classes]);
  const [selectedGrade, setSelectedGrade] = useState<number>(
    gradesInUse[0] ?? 10,
  );
  const [selectedShift, setSelectedShift] = useState<"SANG" | "CHIEU">("SANG");
  // TKB version number — printed on header (e.g., "THỜI KHOÁ BIỂU SỐ 11").
  // Stored client-side for now; future: persist on tenant settings.
  const [tkbNumber, setTkbNumber] = useState<number>(1);
  const academic = currentAcademic();
  const [yearLabel, setYearLabel] = useState<string>(academic.year);
  const [semester, setSemester] = useState<1 | 2>(academic.semester);

  // Indexes for fast lookup.
  const slotByCell = useMemo(() => {
    const map = new Map<string, TimetableSlotRow>();
    for (const s of slots) {
      map.set(slotKey(s.class_id, s.day_of_week, s.period_id), s);
    }
    return map;
  }, [slots]);

  const slotByTeacher = useMemo(() => {
    const map = new Map<string, TimetableSlotRow>();
    for (const s of slots) {
      if (s.teacher_id) {
        map.set(teacherSlotKey(s.teacher_id, s.day_of_week, s.period_id), s);
      }
    }
    return map;
  }, [slots]);

  const subjectById = useMemo(
    () => new Map(subjects.map((s) => [s.id, s])),
    [subjects],
  );
  const teacherById = useMemo(
    () => new Map(teachers.map((t) => [t.id, t])),
    [teachers],
  );
  const classById = useMemo(
    () => new Map(classes.map((c) => [c.id, c])),
    [classes],
  );
  // subject_id → Set<teacher_id> for the qualified-teachers split in the
  // cell modal's dropdown.
  const qualifiedTeachersBySubject = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const link of subjectTeachers) {
      const s = map.get(link.subject_id) ?? new Set<string>();
      s.add(link.teacher_id);
      map.set(link.subject_id, s);
    }
    return map;
  }, [subjectTeachers]);

  // Group periods by shift for the row stacking.
  const periodsByShift = useMemo(() => {
    return {
      SANG: periods.filter((p) => p.shift === "SANG"),
      CHIEU: periods.filter((p) => p.shift === "CHIEU"),
    };
  }, [periods]);

  const classesInSelectedGrade = useMemo(
    () =>
      classes
        .filter((c) => c.grade_level === selectedGrade)
        .sort((a, b) =>
          a.name.localeCompare(b.name, "vi", { numeric: true }),
        ),
    [classes, selectedGrade],
  );

  // ── Interaction modes (Brush + Multi-select) ───────────────────────────
  // "normal"  → click opens CellModal (default)
  // "brush"   → click upserts the cell with the brush subject + teacher
  // "select"  → click toggles the cell in the selection set (no modal)
  // Modes are mutually exclusive. Esc returns to normal.
  type InteractionMode = "normal" | "brush" | "select";
  const [mode, setMode] = useState<InteractionMode>("normal");
  const [brushSubjectId, setBrushSubjectId] = useState<string>("");
  const [brushTeacherId, setBrushTeacherId] = useState<string>("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // ── Undo / Redo ─────────────────────────────────────────────────────────
  // Every mutation (cell save/delete, brush paint, bulk upsert, copy-class)
  // pushes a Snapshot onto undoStack and clears redoStack. Cmd+Z applies
  // the inverse and moves it to redoStack; Cmd+Shift+Z reverses.
  type Snapshot = {
    label: string;
    // Pre-state of all slots affected by this action. Reapplying = upsert
    // these rows; reversing = delete-then-reinsert.
    before: TimetableSlotRow[];
    // Post-state — slots in their state AFTER the action. For pure-delete
    // actions, `after` is empty.
    after: TimetableSlotRow[];
  };
  const [undoStack, setUndoStack] = useState<Snapshot[]>([]);
  const [redoStack, setRedoStack] = useState<Snapshot[]>([]);

  function pushHistory(snap: Snapshot) {
    setUndoStack((s) => [...s.slice(-29), snap]); // cap depth at 30
    setRedoStack([]);
  }

  // Apply snapshot's `target` state on both client + server. If a slot in
  // `target` already exists in DB → upsert; if a slot is in `revert` but
  // NOT in `target` → delete.
  async function applySnapshot(target: TimetableSlotRow[], revert: TimetableSlotRow[]) {
    const targetById = new Map(target.map((s) => [s.id, s]));
    const toDelete = revert
      .filter((s) => !targetById.has(s.id))
      .map((s) => s.id);
    if (toDelete.length > 0) {
      await bulkDeleteSlots(toDelete);
    }
    if (target.length > 0) {
      const payload = target.map((s) => ({
        class_id: s.class_id,
        day_of_week: s.day_of_week,
        period_id: s.period_id,
        subject_id: s.subject_id,
        teacher_id: s.teacher_id,
      }));
      await bulkUpsertSlots({ slots: payload });
    }
    // Reflect locally.
    setSlots((prev) => {
      const map = new Map(prev.map((s) => [s.id, s]));
      for (const id of toDelete) map.delete(id);
      for (const s of target) map.set(s.id, s);
      return Array.from(map.values());
    });
  }

  async function handleUndo() {
    const snap = undoStack[undoStack.length - 1];
    if (!snap) return;
    await applySnapshot(snap.before, snap.after);
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((s) => [...s, snap]);
    toast.success(`Hoàn tác: ${snap.label}`);
  }
  async function handleRedo() {
    const snap = redoStack[redoStack.length - 1];
    if (!snap) return;
    await applySnapshot(snap.after, snap.before);
    setRedoStack((s) => s.slice(0, -1));
    setUndoStack((s) => [...s, snap]);
    toast.success(`Làm lại: ${snap.label}`);
  }

  // Global keyboard shortcuts.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ignore typing in inputs / contenteditable.
      const t = e.target as HTMLElement | null;
      if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
      if (t?.isContentEditable) return;
      const meta = e.metaKey || e.ctrlKey;
      if (e.key === "Escape") {
        setMode("normal");
        setSelectedKeys(new Set());
        return;
      }
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      // Letter shortcuts (no meta): b = brush, s = select, n = normal.
      if (!meta && !e.shiftKey && !e.altKey) {
        if (e.key === "b") setMode((m) => (m === "brush" ? "normal" : "brush"));
        else if (e.key === "s") setMode((m) => (m === "select" ? "normal" : "select"));
        else if (e.key === "n") setMode("normal");
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undoStack, redoStack]);

  // ── Copy class → class ──────────────────────────────────────────────────
  const [copyModalOpen, setCopyModalOpen] = useState(false);

  // ── Room mode (fullscreen scheduling) ──────────────────────────────────
  // Hides app chrome (sidebar, navbar, section header, tabs) so the admin
  // can focus on scheduling, and shows BOTH Sáng + Chiều stacked for easier
  // cross-shift placement. Zoom buttons let you fit more on screen.
  const [roomMode, setRoomMode] = useState(false);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    if (roomMode) {
      document.body.dataset.tkbRoom = "true";
    } else {
      delete document.body.dataset.tkbRoom;
    }
    return () => {
      delete document.body.dataset.tkbRoom;
    };
  }, [roomMode]);
  // Zoom keyboard: Cmd/Ctrl + plus/minus/0
  useEffect(() => {
    if (!roomMode) return;
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)));
      } else if (e.key === "-") {
        e.preventDefault();
        setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)));
      } else if (e.key === "0") {
        e.preventDefault();
        setZoom(1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [roomMode]);

  // Wrap setActiveCell so that brush/select modes intercept the click and
  // bypass the modal. Returns true if the click was handled inline.
  async function handleCellClick(target: CellTarget) {
    if (mode === "select") {
      const k = slotKey(target.classId, target.day, target.periodId);
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        if (next.has(k)) next.delete(k);
        else next.add(k);
        return next;
      });
      return;
    }
    if (mode === "brush") {
      if (!brushSubjectId) {
        toast.error("Chọn môn cho Brush trước khi click.");
        return;
      }
      // Upsert at the clicked cell with brush subject + teacher.
      const before = target.existing ? [target.existing] : [];
      const r = await upsertSlot({
        class_id: target.classId,
        day_of_week: target.day,
        period_id: target.periodId,
        subject_id: brushSubjectId,
        teacher_id: brushTeacherId || null,
      });
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      const saved = r.data as TimetableSlotRow;
      setSlots((prev) => {
        const i = prev.findIndex(
          (s) =>
            s.class_id === saved.class_id &&
            s.day_of_week === saved.day_of_week &&
            s.period_id === saved.period_id,
        );
        if (i >= 0) {
          const next = [...prev];
          next[i] = saved;
          return next;
        }
        return [...prev, saved];
      });
      pushHistory({ label: "Brush paint", before, after: [saved] });
      return;
    }
    setActiveCell(target);
  }

  // ── Multi-select bulk actions ───────────────────────────────────────────
  const selectedSlotsArr = useMemo(() => {
    const out: TimetableSlotRow[] = [];
    for (const k of selectedKeys) {
      const [cid, dStr, pid] = k.split("|");
      const slot = slotByCell.get(slotKey(cid, parseInt(dStr, 10), pid));
      if (slot) out.push(slot);
    }
    return out;
  }, [selectedKeys, slotByCell]);

  async function handleBulkDeleteSelected() {
    if (selectedSlotsArr.length === 0) return;
    const ok = await confirm({
      title: `Xoá ${selectedSlotsArr.length} slot đã chọn?`,
      variant: "danger",
      confirmLabel: "Xoá",
      description: "Hành động này có thể hoàn tác bằng Cmd+Z.",
    });
    if (!ok) return;
    const before = [...selectedSlotsArr];
    const r = await bulkDeleteSlots(before.map((s) => s.id));
    if (!r.success) {
      toast.error(r.error);
      return;
    }
    const deletedIds = new Set(before.map((s) => s.id));
    setSlots((prev) => prev.filter((s) => !deletedIds.has(s.id)));
    pushHistory({ label: `Xoá ${before.length} slot`, before, after: [] });
    setSelectedKeys(new Set());
    toast.success(`Đã xoá ${r.data?.deleted ?? before.length} slot.`);
  }

  async function handleBulkAssign(subjectId: string, teacherId: string | null) {
    if (selectedKeys.size === 0) return;
    const payload = Array.from(selectedKeys).map((k) => {
      const [class_id, dStr, period_id] = k.split("|");
      return {
        class_id,
        day_of_week: parseInt(dStr, 10),
        period_id,
        subject_id: subjectId,
        teacher_id: teacherId,
      };
    });
    const before = payload
      .map((p) => slotByCell.get(slotKey(p.class_id, p.day_of_week, p.period_id)))
      .filter((s): s is TimetableSlotRow => !!s);
    const r = await bulkUpsertSlots({ slots: payload });
    if (!r.success) {
      toast.error(r.error);
      return;
    }
    const upserted = r.data?.upserted ?? [];
    setSlots((prev) => {
      const map = new Map(prev.map((s) => [s.id, s]));
      for (const s of upserted) map.set(s.id, s);
      return Array.from(map.values());
    });
    pushHistory({
      label: `Gán hàng loạt ${upserted.length} ô`,
      before,
      after: upserted,
    });
    setSelectedKeys(new Set());
    const errs = r.data?.errors?.length ?? 0;
    toast.success(
      errs > 0
        ? `Đã gán ${upserted.length} ô · ${errs} lỗi (trùng GV)`
        : `Đã gán ${upserted.length} ô.`,
    );
  }

  // ── Excel export ────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);
  async function runExcelExport() {
    setExporting(true);
    try {
      // Pass ALL periods — the exporter splits Sáng/Chiều into separate
      // worksheets in the same workbook so users always get a complete file.
      const blob = await exportTkbToExcel({
        centerName,
        yearLabel,
        semester,
        tkbNumber,
        grade: selectedGrade,
        classes: classesInSelectedGrade,
        periods,
        slots,
        subjects,
        teachers,
        effectiveDate: new Date(),
      });
      const fname = `TKB_Khoi${selectedGrade}_So${tkbNumber}.xlsx`;
      downloadBlob(blob, fname);
      toast.success("Đã xuất file Excel (Sáng + Chiều).");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Lỗi không xác định.";
      toast.error(`Xuất Excel thất bại: ${msg}`);
    } finally {
      setExporting(false);
    }
  }
  async function handleExportExcel() {
    const ok = await confirm({
      title: `Tải Excel · Khối ${selectedGrade}?`,
      confirmLabel: "Tải xuống",
      description: "File chứa cả Buổi sáng + Buổi chiều.",
    });
    if (ok) runExcelExport();
  }
  const [pdfDownloading, setPdfDownloading] = useState(false);
  async function handleDownloadPdf() {
    const ok = await confirm({
      title: `Tải PDF · Khối ${selectedGrade}?`,
      confirmLabel: "Tải xuống",
      description: "File PDF chứa cả Buổi sáng + Buổi chiều.",
    });
    if (!ok) return;
    setPdfDownloading(true);
    try {
      // Lazy-import the React-PDF document to keep the editor's main
      // bundle slim. React-PDF + the bundled fonts adds ~500KB.
      const { renderTkbPdfBlob } = await import(
        "@/modules/timetable/TkbPdfDocument"
      );
      const blob = await renderTkbPdfBlob({
        centerName,
        yearLabel,
        semester,
        tkbNumber,
        grade: selectedGrade,
        classes: classesInSelectedGrade,
        periods,
        slots,
        subjects,
        teachers,
        effectiveDate: new Date(),
      });
      downloadBlob(blob, `TKB_Khoi${selectedGrade}_So${tkbNumber}.pdf`);
      toast.success("Đã tạo file PDF (Sáng + Chiều).");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Lỗi không xác định.";
      toast.error(`Tạo PDF thất bại: ${msg}`);
    } finally {
      setPdfDownloading(false);
    }
  }
  async function handleOpenQr() {
    const ok = await confirm({
      title: `Tạo QR · Khối ${selectedGrade}?`,
      confirmLabel: "Tạo QR",
      description: "Học sinh / phụ huynh quét xem TKB không cần đăng nhập.",
    });
    if (ok) setQrOpen(true);
  }

  // ── QR share ────────────────────────────────────────────────────────────
  // Pre-fetch the tenant's public_tkb_token on mount so the QR modal can
  // generate the code instantly when opened (no network round-trip).
  const [qrOpen, setQrOpen] = useState(false);
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getPublicTkbToken().then((r) => {
      if (cancelled) return;
      if (r.success && r.data) setPublicToken(r.data.token);
      else setTokenError(r.error || "Không lấy được token chia sẻ.");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (classes.length === 0) {
    return <p className="text-sm text-slate-500">Chưa có lớp nào.</p>;
  }

  // Build the room-mode JSX as an early-return so the normal editor view
  // below stays untouched. Reuses the same handlers / state, just with a
  // different chrome layout (slim header + dual-shift body + zoom).
  if (roomMode) {
    return (
      <RoomLayout
        title={`Phòng xếp TKB · Khối ${selectedGrade}`}
        zoom={zoom}
        setZoom={setZoom}
        onExit={() => setRoomMode(false)}
        gradesInUse={gradesInUse}
        selectedGrade={selectedGrade}
        setSelectedGrade={setSelectedGrade}
        mode={mode}
        setMode={setMode}
        brushSubjectId={brushSubjectId}
        setBrushSubjectId={setBrushSubjectId}
        brushTeacherId={brushTeacherId}
        setBrushTeacherId={setBrushTeacherId}
        subjects={subjects}
        teachers={teachers}
        selectedKeys={selectedKeys}
        clearSelection={() => setSelectedKeys(new Set())}
        onBulkDelete={handleBulkDeleteSelected}
        onBulkAssign={handleBulkAssign}
        onOpenCopy={() => setCopyModalOpen(true)}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
      >
        {/* Both shifts stacked. Each PerGradeView fetches the correct
            periods array via filter. Zoom is applied via CSS transform on
            the outer wrapper. */}
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            width: `${100 / zoom}%`,
          }}
          className="space-y-4"
        >
          {periodsByShift.SANG.length > 0 && (
            <PerGradeView
              centerName={centerName}
              yearLabel={yearLabel}
              semester={semester}
              tkbNumber={tkbNumber}
              shift="SANG"
              grade={selectedGrade}
              classes={classesInSelectedGrade}
              periods={periodsByShift.SANG}
              slotByCell={slotByCell}
              subjectById={subjectById}
              teacherById={teacherById}
              onSelectCell={handleCellClick}
              mode={mode}
              selectedKeys={selectedKeys}
            />
          )}
          {periodsByShift.CHIEU.length > 0 && (
            <PerGradeView
              centerName={centerName}
              yearLabel={yearLabel}
              semester={semester}
              tkbNumber={tkbNumber}
              shift="CHIEU"
              grade={selectedGrade}
              classes={classesInSelectedGrade}
              periods={periodsByShift.CHIEU}
              slotByCell={slotByCell}
              subjectById={subjectById}
              teacherById={teacherById}
              onSelectCell={handleCellClick}
              mode={mode}
              selectedKeys={selectedKeys}
            />
          )}
        </div>

        {/* Reuse the same Cell + Copy modals inside the room. */}
        <AnimatePresence>
          {activeCell && (
            <CellModal
              cell={activeCell}
              classes={classes}
              subjects={subjects}
              teachers={teachers}
              periods={periods}
              slotByTeacher={slotByTeacher}
              classById={classById}
              qualifiedTeachersBySubject={qualifiedTeachersBySubject}
              onClose={() => setActiveCell(null)}
              onSaved={(saved) => {
                const before = activeCell?.existing
                  ? [activeCell.existing]
                  : [];
                setSlots((prev) => {
                  const i = prev.findIndex(
                    (s) =>
                      s.class_id === saved.class_id &&
                      s.day_of_week === saved.day_of_week &&
                      s.period_id === saved.period_id,
                  );
                  if (i >= 0) {
                    const next = [...prev];
                    next[i] = saved;
                    return next;
                  }
                  return [...prev, saved];
                });
                pushHistory({
                  label: before.length ? "Sửa slot" : "Tạo slot",
                  before,
                  after: [saved],
                });
                setActiveCell(null);
              }}
              onDeleted={(id) => {
                const before = slots.filter((s) => s.id === id);
                setSlots((prev) => prev.filter((s) => s.id !== id));
                if (before.length > 0)
                  pushHistory({ label: "Xoá slot", before, after: [] });
                setActiveCell(null);
              }}
              onConfirm={confirm}
            />
          )}
        </AnimatePresence>

        <CopyClassModal
          open={copyModalOpen}
          onClose={() => setCopyModalOpen(false)}
          classes={classes}
          currentGrade={selectedGrade}
          onDone={({ inserted, removedIds }) => {
            if (inserted.length > 0 || removedIds.length > 0) {
              const removedSet = new Set(removedIds);
              const before = slots.filter((s) => removedSet.has(s.id));
              setSlots((prev) => {
                const map = new Map(prev.map((s) => [s.id, s]));
                for (const id of removedIds) map.delete(id);
                for (const s of inserted) map.set(s.id, s);
                return Array.from(map.values());
              });
              pushHistory({
                label: `Copy lớp · +${inserted.length}`,
                before,
                after: inserted,
              });
            }
            setCopyModalOpen(false);
          }}
        />
      </RoomLayout>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar — print:hidden so the toolbar doesn't show on the printed
          TKB sheet. */}
      {/* Section header + export buttons on the same row. The parent
          timetable layout suppresses its own header on /editor so this
          one stands alone. On mobile the title stacks above the export
          buttons; sm+ shows them side-by-side. */}
      <div className="flex flex-col gap-4 print:hidden sm:flex-row sm:items-start sm:justify-between">
        <header className="min-w-0">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Thời khoá biểu mẫu
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Sắp xếp thời khoá biểu
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Định nghĩa Lớp · Môn · Khung tiết, rồi gán vào grid thời khoá
            biểu để in và (sau này) tự tạo buổi học cho cả kỳ.
          </p>
        </header>

        {/* Export buttons — each opens a confirm dialog before firing. */}
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2 sm:mt-1">
          {viewMode === "grade" && (
            <>
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={exporting}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
                title="Tải file Excel (.xlsx) chứa TKB Khối hiện tại"
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Tải Excel
              </button>
              <button
                type="button"
                onClick={handleOpenQr}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                title="Tạo mã QR cho học sinh xem TKB"
              >
                <QrCode className="h-4 w-4" />
                QR học sinh
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={pdfDownloading}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            title="Tải file PDF chứa TKB Khối hiện tại"
          >
            {pdfDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            Tải PDF
          </button>
        </div>
      </div>

      {/* Section navigation tabs — moved below the header so the export
          buttons can sit alongside the title above. */}
      <div className="print:hidden">
        <TimetableTabs />
      </div>

      {/* Filter toolbar — expanded sizing now that exports moved out.
          Each control flexes to fill its column for a balanced layout. */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 print:hidden">
        {/* View mode toggle — full-width segmented control on mobile, inline on sm+ */}
        <div className="mb-3 flex justify-start">
          <div className="inline-flex items-center gap-0.5 rounded-lg bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("grade")}
              className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold transition-colors ${
                viewMode === "grade"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              Theo khối
            </button>
            <button
              type="button"
              onClick={() => setViewMode("class")}
              className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold transition-colors ${
                viewMode === "class"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Table className="h-4 w-4" />
              Theo lớp
            </button>
          </div>
        </div>

        {viewMode === "grade" ? (
          // Grid responsive: 2 cols mobile, 5 cols sm+ — each filter
          // expands to fill its column so the row looks balanced.
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
            <FilterField label="Khối">
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(parseInt(e.target.value, 10))}
                className={FILTER_INPUT}
              >
                {(gradesInUse.length > 0
                  ? gradesInUse
                  : [10, 11, 12]
                ).map((g) => (
                  <option key={g} value={g}>
                    Khối {g}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Buổi">
              <select
                value={selectedShift}
                onChange={(e) =>
                  setSelectedShift(e.target.value as "SANG" | "CHIEU")
                }
                className={FILTER_INPUT}
              >
                <option value="SANG">Buổi sáng</option>
                <option value="CHIEU">Buổi chiều</option>
              </select>
            </FilterField>
            <FilterField label="TKB số">
              <input
                type="number"
                min={1}
                max={999}
                value={tkbNumber}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (Number.isFinite(v) && v > 0) setTkbNumber(v);
                }}
                placeholder="1"
                className={`${FILTER_INPUT} font-mono tabular-nums`}
                title="Số hiệu TKB (in trên đầu trang)"
              />
            </FilterField>
            <FilterField label="Năm học">
              <input
                type="text"
                value={yearLabel}
                onChange={(e) => setYearLabel(e.target.value)}
                placeholder="2026-2027"
                className={`${FILTER_INPUT} font-mono tabular-nums`}
              />
            </FilterField>
            <FilterField label="Học kỳ">
              <select
                value={semester}
                onChange={(e) =>
                  setSemester(parseInt(e.target.value, 10) as 1 | 2)
                }
                className={FILTER_INPUT}
              >
                <option value={1}>Học kỳ 1</option>
                <option value={2}>Học kỳ 2</option>
              </select>
            </FilterField>
          </div>
        ) : (
          <FilterField label="Lớp">
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className={FILTER_INPUT}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.grade_level ? ` · Khối ${c.grade_level}` : ""}
                </option>
              ))}
            </select>
          </FilterField>
        )}
      </div>

      {/* Action toolbar — Brush, Select, Copy, Undo, Redo. Only shown in
          "Theo khối" mode where the per-grade grid lives. */}
      {viewMode === "grade" && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 print:hidden">
          <div className="inline-flex items-center gap-0.5 rounded-lg bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => setMode("normal")}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                mode === "normal"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              title="Chế độ thường (click mở modal) · N"
            >
              <Square className="h-3.5 w-3.5" />
              Thường
            </button>
            <button
              type="button"
              onClick={() => setMode(mode === "brush" ? "normal" : "brush")}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                mode === "brush"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              title="Brush mode — chọn môn rồi click ô để gán nhanh · B"
            >
              <Brush className="h-3.5 w-3.5" />
              Brush
            </button>
            <button
              type="button"
              onClick={() => setMode(mode === "select" ? "normal" : "select")}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                mode === "select"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              title="Chế độ chọn nhiều ô · S"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              Chọn ô
            </button>
          </div>

          <button
            type="button"
            onClick={() => setCopyModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            title="Copy TKB từ 1 lớp sang lớp khác"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy lớp
          </button>

          <button
            type="button"
            onClick={() => setRoomMode(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            title="Mở phòng xếp TKB — ẩn sidebar/navbar, hiện cả Sáng + Chiều"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Phòng xếp TKB
          </button>

          <div className="ml-auto inline-flex items-center gap-0.5 rounded-lg bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-white hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Hoàn tác · ⌘Z"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Hoàn tác
              {undoStack.length > 0 && (
                <span className="font-mono text-[10px] tabular-nums text-slate-400">
                  {undoStack.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-white hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Làm lại · ⌘⇧Z"
            >
              <Redo2 className="h-3.5 w-3.5" />
              Làm lại
            </button>
          </div>
        </div>
      )}

      {/* Brush picker — appears when Brush mode is active. */}
      {mode === "brush" && viewMode === "grade" && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-2 print:hidden">
          <span className="inline-flex items-center gap-1 px-2 font-mono text-[10.5px] font-semibold uppercase tracking-wide text-indigo-700">
            <Brush className="h-3 w-3" /> Brush
          </span>
          <select
            value={brushSubjectId}
            onChange={(e) => setBrushSubjectId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">— Chọn môn —</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.short_code} · {s.name}
              </option>
            ))}
          </select>
          <select
            value={brushTeacherId}
            onChange={(e) => setBrushTeacherId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">— Không gán GV —</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.display_name}
              </option>
            ))}
          </select>
          <p className="ml-auto text-[11.5px] text-indigo-900">
            Click vào ô để gán môn nhanh. Nhấn <kbd className="rounded bg-white px-1 font-mono text-[10px]">Esc</kbd> để thoát.
          </p>
        </div>
      )}

      {/* Multi-select action bar — appears when Select mode active + ≥1 chọn. */}
      {mode === "select" && viewMode === "grade" && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-2 print:hidden">
          <span className="inline-flex items-center gap-1 px-2 font-mono text-[10.5px] font-semibold uppercase tracking-wide text-indigo-700">
            <CheckSquare className="h-3 w-3" /> Chọn nhiều
          </span>
          <span className="text-xs font-semibold text-slate-900">
            Đã chọn{" "}
            <span className="font-mono tabular-nums">{selectedKeys.size}</span>{" "}
            ô
          </span>
          {selectedKeys.size > 0 && (
            <>
              <button
                type="button"
                onClick={() => setSelectedKeys(new Set())}
                className="text-xs font-medium text-slate-500 hover:text-slate-900"
              >
                Bỏ chọn
              </button>
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleBulkDeleteSelected}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Xoá đã chọn
                </button>
                <BulkAssignPicker
                  subjects={subjects}
                  teachers={teachers}
                  onApply={handleBulkAssign}
                />
              </div>
            </>
          )}
          <p className="basis-full text-[11.5px] text-indigo-900">
            Click ô để toggle. Nhấn <kbd className="rounded bg-white px-1 font-mono text-[10px]">Esc</kbd> để thoát.
          </p>
        </div>
      )}

      {viewMode === "grade" ? (
        // Single on-screen editor view — PDF export is handled by
        // @react-pdf/renderer directly, no print container needed.
        <PerGradeView
          centerName={centerName}
          yearLabel={yearLabel}
          semester={semester}
          tkbNumber={tkbNumber}
          shift={selectedShift}
          grade={selectedGrade}
          classes={classesInSelectedGrade}
          periods={periodsByShift[selectedShift]}
          slotByCell={slotByCell}
          subjectById={subjectById}
          teacherById={teacherById}
          onSelectCell={handleCellClick}
          mode={mode}
          selectedKeys={selectedKeys}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse">
              <thead>
                <tr className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="w-20 border-b border-r border-slate-200 px-2 py-2 text-center">
                    Tiết
                  </th>
                  <th className="w-24 border-b border-r border-slate-200 px-2 py-2 text-center">
                    Giờ
                  </th>
                  {DAYS.map((d) => (
                    <th
                      key={d}
                      className="border-b border-r border-slate-200 px-2 py-2 text-center last:border-r-0"
                    >
                      {DAY_LABELS[d]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <ShiftSection
                  label="Buổi sáng"
                  periods={periodsByShift.SANG}
                  slotByCell={slotByCell}
                  selectedClassId={selectedClassId}
                  subjectById={subjectById}
                  teacherById={teacherById}
                  onSelectCell={handleCellClick}
                />
                {periodsByShift.CHIEU.length > 0 && (
                  <ShiftSection
                    label="Buổi chiều"
                    periods={periodsByShift.CHIEU}
                    slotByCell={slotByCell}
                    selectedClassId={selectedClassId}
                    subjectById={subjectById}
                    teacherById={teacherById}
                    onSelectCell={handleCellClick}
                  />
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>
        {activeCell && (
          <CellModal
            cell={activeCell}
            classes={classes}
            subjects={subjects}
            teachers={teachers}
            periods={periods}
            slotByTeacher={slotByTeacher}
            classById={classById}
            qualifiedTeachersBySubject={qualifiedTeachersBySubject}
            onClose={() => setActiveCell(null)}
            onSaved={(saved) => {
              const before = activeCell?.existing
                ? [activeCell.existing]
                : [];
              setSlots((prev) => {
                const i = prev.findIndex(
                  (s) =>
                    s.class_id === saved.class_id &&
                    s.day_of_week === saved.day_of_week &&
                    s.period_id === saved.period_id,
                );
                if (i >= 0) {
                  const next = [...prev];
                  next[i] = saved;
                  return next;
                }
                return [...prev, saved];
              });
              pushHistory({
                label: before.length ? "Sửa slot" : "Tạo slot",
                before,
                after: [saved],
              });
              setActiveCell(null);
              router.refresh();
            }}
            onDeleted={(id) => {
              const before = slots.filter((s) => s.id === id);
              setSlots((prev) => prev.filter((s) => s.id !== id));
              if (before.length > 0)
                pushHistory({ label: "Xoá slot", before, after: [] });
              setActiveCell(null);
              router.refresh();
            }}
            onConfirm={confirm}
          />
        )}
      </AnimatePresence>

      {/* QR share modal — receives the pre-fetched token so the code
          appears instantly when opened. Renders a scannable QR pointing
          to /tkb/[token]/[grade] (which shows BOTH Sáng + Chiều). */}
      <QrShareModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        grade={selectedGrade}
        centerName={centerName}
        token={publicToken}
        tokenError={tokenError}
      />

      {/* Copy class → class modal */}
      <CopyClassModal
        open={copyModalOpen}
        onClose={() => setCopyModalOpen(false)}
        classes={classes}
        currentGrade={selectedGrade}
        onDone={({ inserted, removedIds }) => {
          // Merge fresh rows into local state so the grid updates without
          // waiting for a full router.refresh round-trip.
          if (inserted.length > 0 || removedIds.length > 0) {
            const removedSet = new Set(removedIds);
            // Capture `before` for undo BEFORE we mutate state.
            const before = slots.filter((s) => removedSet.has(s.id));
            setSlots((prev) => {
              const map = new Map(prev.map((s) => [s.id, s]));
              for (const id of removedIds) map.delete(id);
              for (const s of inserted) map.set(s.id, s);
              return Array.from(map.values());
            });
            pushHistory({
              label: `Copy lớp · +${inserted.length}`,
              before,
              after: inserted,
            });
          }
          setCopyModalOpen(false);
          // Background refresh so server-derived data (revalidatePath cache)
          // stays in sync, but the UI already reflects the new slots.
          router.refresh();
        }}
      />
    </div>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────

function ShiftSection({
  label,
  periods,
  slotByCell,
  selectedClassId,
  subjectById,
  teacherById,
  onSelectCell,
}: {
  label: string;
  periods: PeriodRow[];
  slotByCell: Map<string, TimetableSlotRow>;
  selectedClassId: string;
  subjectById: Map<string, SubjectRow>;
  teacherById: Map<string, TenantTeacherRow>;
  onSelectCell: (c: CellTarget) => void;
}) {
  if (periods.length === 0) return null;
  return (
    <>
      <tr>
        <td
          colSpan={9}
          className="border-b border-t border-slate-200 bg-slate-100/70 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500"
        >
          {label}
        </td>
      </tr>
      {periods.map((p) => (
        <tr key={p.id}>
          <td className="border-b border-r border-slate-200 px-2 py-1 text-center align-middle">
            <div className="font-mono text-sm font-bold text-slate-700">
              T{p.period_number}
            </div>
          </td>
          <td className="border-b border-r border-slate-200 px-2 py-1 text-center align-middle">
            <div className="font-mono text-[11px] tabular-nums leading-tight text-slate-500">
              {hhmm(p.start_time)}
              <br />
              {hhmm(p.end_time)}
            </div>
          </td>
          {DAYS.map((d) => {
            const slot = slotByCell.get(
              slotKey(selectedClassId, d, p.id),
            );
            const subject = slot ? subjectById.get(slot.subject_id) : null;
            const teacher = slot?.teacher_id
              ? teacherById.get(slot.teacher_id)
              : null;
            const tint = subject ? `${subject.color}1F` : undefined;
            return (
              <td
                key={d}
                className="h-20 border-b border-r border-slate-200 p-0 text-center last:border-r-0"
              >
                <button
                  type="button"
                  onClick={() =>
                    onSelectCell({
                      classId: selectedClassId,
                      day: d,
                      periodId: p.id,
                      existing: slot,
                    })
                  }
                  className={`group flex h-full w-full flex-col items-center justify-center gap-0.5 px-1 py-1 text-center transition-colors ${
                    slot
                      ? "hover:brightness-95"
                      : "hover:bg-indigo-50/60"
                  }`}
                  style={tint ? { background: tint } : undefined}
                  title={
                    slot && subject
                      ? `${subject.name}${teacher ? ` · ${teacher.display_name}` : ""}`
                      : "Bấm để gán môn + giáo viên"
                  }
                >
                  {slot && subject ? (
                    <>
                      <span
                        className="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-white"
                        style={{ background: subject.color }}
                      >
                        {subject.short_code}
                      </span>
                      <span className="line-clamp-1 text-[11px] font-semibold text-slate-900">
                        {subject.name}
                      </span>
                      {teacher && (
                        <span className="line-clamp-1 font-mono text-[9px] uppercase tracking-wide text-slate-500">
                          {teacher.display_name}
                        </span>
                      )}
                    </>
                  ) : (
                    <Plus className="h-4 w-4 text-slate-300 transition-colors group-hover:text-indigo-500" />
                  )}
                </button>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

// ── Cell modal ─────────────────────────────────────────────────────

function CellModal({
  cell,
  classes,
  subjects,
  teachers,
  periods,
  slotByTeacher,
  classById,
  qualifiedTeachersBySubject,
  onClose,
  onSaved,
  onDeleted,
  onConfirm,
}: {
  cell: CellTarget;
  classes: ClassRow[];
  subjects: SubjectRow[];
  teachers: TenantTeacherRow[];
  periods: PeriodRow[];
  slotByTeacher: Map<string, TimetableSlotRow>;
  classById: Map<string, ClassRow>;
  qualifiedTeachersBySubject: Map<string, Set<string>>;
  onClose: () => void;
  onSaved: (row: TimetableSlotRow) => void;
  onDeleted: (id: string) => void;
  onConfirm: ReturnType<typeof useConfirm>;
}) {
  const existing = cell.existing;
  const klass = classById.get(cell.classId);
  const homeroomTeacherId = klass?.homeroom_teacher_id ?? null;

  const [subjectId, setSubjectId] = useState(existing?.subject_id ?? "");
  // Smart default for teacher: when the user picks a subject on an empty
  // cell, suggest the class's homeroom teacher IF they're in the qualified
  // set for that subject. They can still pick anyone else.
  const initialTeacherId = (() => {
    if (existing?.teacher_id) return existing.teacher_id;
    if (
      existing == null &&
      subjectId &&
      homeroomTeacherId &&
      qualifiedTeachersBySubject.get(subjectId)?.has(homeroomTeacherId)
    ) {
      return homeroomTeacherId;
    }
    return "";
  })();
  const [teacherId, setTeacherId] = useState<string>(initialTeacherId);
  const [note, setNote] = useState(existing?.note ?? "");
  const [pending, setPending] = useState(false);

  const period = periods.find((p) => p.id === cell.periodId);
  const className = klass?.name ?? "—";

  // Qualified set for the currently-selected subject (empty if no subject).
  const qualifiedSet = subjectId
    ? (qualifiedTeachersBySubject.get(subjectId) ?? new Set<string>())
    : new Set<string>();
  const qualifiedTeachers = teachers.filter((t) => qualifiedSet.has(t.id));
  const otherTeachers = teachers.filter((t) => !qualifiedSet.has(t.id));

  // When user changes subject on an empty cell, auto-pick the best teacher:
  //   1. Homeroom teacher (GVCN) if they're qualified for this subject.
  //   2. Else first qualified teacher (subject_teachers link).
  //   3. Else leave empty so user picks manually.
  // Doesn't override if the cell already has a teacher assigned.
  function handleSubjectChange(next: string) {
    setSubjectId(next);
    if (existing || teacherId) return;
    const q = qualifiedTeachersBySubject.get(next);
    if (!q) return;
    if (homeroomTeacherId && q.has(homeroomTeacherId)) {
      setTeacherId(homeroomTeacherId);
      return;
    }
    // Fall back to first qualified teacher (order from `teachers` prop).
    const first = teachers.find((t) => q.has(t.id));
    if (first) setTeacherId(first.id);
  }

  // Pre-submit conflict check for the chosen teacher (excluding the same class).
  const conflict = useMemo(() => {
    if (!teacherId) return null;
    const found = slotByTeacher.get(
      teacherSlotKey(teacherId, cell.day, cell.periodId),
    );
    if (!found) return null;
    if (found.class_id === cell.classId) return null;
    const c = classById.get(found.class_id);
    return c?.name ?? "lớp khác";
  }, [teacherId, slotByTeacher, cell, classById]);

  async function handleSave() {
    if (!subjectId) {
      toast.error("Vui lòng chọn môn học.");
      return;
    }
    setPending(true);
    try {
      const r = await upsertSlot({
        class_id: cell.classId,
        day_of_week: cell.day,
        period_id: cell.periodId,
        subject_id: subjectId,
        teacher_id: teacherId || null,
        note: note.trim(),
      });
      if (r.success && r.data) {
        toast.success("Đã lưu.");
        onSaved(r.data);
      } else if (!r.success) {
        toast.error(r.error);
      }
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    if (!existing) return;
    const ok = await onConfirm({
      title: "Xoá ô này?",
      variant: "danger",
      confirmLabel: "Xoá",
      description: "Slot này sẽ trở về trống. Có thể gán lại bất cứ lúc nào.",
    });
    if (!ok) return;
    setPending(true);
    try {
      const r = await deleteSlot(existing.id);
      if (r.success) {
        toast.success("Đã xoá.");
        onDeleted(existing.id);
      } else {
        toast.error(r.error);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={() => !pending && onClose()}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 10 }}
        transition={{ type: "spring", damping: 25, stiffness: 350 }}
        className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
              {existing ? "Sửa ô" : "Gán môn cho ô"}
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-slate-900">
              {className} · {DAY_LABELS[cell.day]} · T
              {period?.period_number ?? "?"}
            </h2>
            {period && (
              <p className="mt-0.5 font-mono text-xs tabular-nums text-slate-500">
                {hhmm(period.start_time)} – {hhmm(period.end_time)} ·{" "}
                {period.shift === "SANG" ? "Sáng" : "Chiều"}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {/* Subject */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Môn học *
            </label>
            <select
              value={subjectId}
              onChange={(e) => handleSubjectChange(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">— Chọn môn —</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.short_code})
                </option>
              ))}
            </select>
          </div>

          {/* Teacher — qualified first (optgroup), then others. Smart-default
              to the class's homeroom when they're qualified for the subject. */}
          <div>
            <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-600">
              <span>Giáo viên</span>
              <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                (tuỳ chọn — có thể gán sau)
              </span>
            </label>
            <select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className={`w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 ${
                conflict
                  ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                  : "border-slate-200 focus:border-indigo-300 focus:ring-indigo-100"
              }`}
            >
              <option value="">— Chưa phân công —</option>
              {qualifiedTeachers.length > 0 && (
                <optgroup label="Giáo viên bộ môn">
                  {qualifiedTeachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.display_name}
                      {t.id === homeroomTeacherId ? " · GVCN" : ""}
                      {t.is_admin ? " · quản trị" : ""}
                    </option>
                  ))}
                </optgroup>
              )}
              {otherTeachers.length > 0 && (
                <optgroup
                  label={
                    qualifiedTeachers.length > 0
                      ? "Giáo viên khác"
                      : "Tất cả giáo viên"
                  }
                >
                  {otherTeachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.display_name}
                      {t.id === homeroomTeacherId ? " · GVCN" : ""}
                      {t.is_admin ? " · quản trị" : ""}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {subjectId && qualifiedTeachers.length === 0 && (
              <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
                Môn này chưa có giáo viên bộ môn nào. Có thể chọn bất kỳ giáo
                viên hoặc{" "}
                <a
                  href="/dashboard/timetable/subjects"
                  className="font-semibold text-indigo-600 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-700"
                >
                  cấu hình tại đây →
                </a>
              </p>
            )}
            {homeroomTeacherId &&
              teacherId === homeroomTeacherId &&
              !existing && (
                <p className="mt-1.5 inline-flex items-start gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/60 px-2.5 py-1.5 text-[11px] leading-snug text-indigo-800">
                  <Sparkles className="mt-0.5 h-3 w-3 flex-shrink-0" />
                  Tự động chọn giáo viên chủ nhiệm của lớp{" "}
                  <strong>{className}</strong>. Có thể đổi sang người khác.
                </p>
              )}
            {conflict && (
              <p className="mt-1.5 inline-flex items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] leading-snug text-rose-800">
                <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                Giáo viên này đang dạy lớp <strong>{conflict}</strong> vào
                tiết này. Hệ thống sẽ từ chối lưu.
              </p>
            )}
          </div>

          {/* Note */}
          <div>
            <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-600">
              <span>Ghi chú</span>
              <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                {note.length}/500
              </span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Phòng học, lưu ý cho giáo viên…"
              className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {existing && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-[11px] leading-snug text-slate-500">
              <Sparkles className="mr-1 inline h-3 w-3 text-indigo-500" />
              Ô đang có nội dung. Lưu để cập nhật, hoặc bấm{" "}
              <strong>Xoá ô</strong> để về trống.
            </div>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center justify-between gap-2 border-t border-slate-100 bg-white px-6 py-3">
          {existing ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Xoá ô
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              Huỷ
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={pending || !subjectId}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                "Lưu"
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── PerGradeView ──────────────────────────────────────────────────────────
//
// Vietnamese-school printed TKB layout — one shift (Sáng/Chiều) of one
// grade (e.g., Khối 12 with classes 12A1..12A10):
//
//   ┌─ Header ───────────────────────────────────────────────────────────┐
//   │ Trường ABC                  THỜI KHOÁ BIỂU SỐ N                    │
//   │ Năm học 2026-2027                       BUỔI SÁNG                  │
//   │ Học kỳ 2                                                            │
//   ├─ Grid ─────────────────────────────────────────────────────────────┤
//   │ THỨ │ TIẾT │ 12A1 (Nga) │ 12A2 (Nhung) │ ... │ 12A10 (Thuý) │     │
//   │  2  │  1   │ Chào cờ    │ Chào cờ      │ ... │ Chào cờ      │     │
//   │  2  │  2   │ Văn - Nga  │ ...          │     │              │     │
//   │  …  │  …   │ …          │ …            │ …   │ …            │     │
//   │  7  │  5   │ Sinh hoạt  │ Sinh hoạt    │ ... │ Sinh hoạt    │     │
//   └────────────────────────────────────────────────────────────────────┘
//
// Click any cell → opens the existing CellModal for that class/day/period.
// Print uses the standard browser print dialog (window.print) with a
// dedicated print CSS section in globals to keep only the .tkb-print area.
function PerGradeView({
  centerName,
  yearLabel,
  semester,
  tkbNumber,
  shift,
  grade,
  classes,
  periods,
  slotByCell,
  subjectById,
  teacherById,
  onSelectCell,
  mode = "normal",
  selectedKeys,
}: {
  centerName: string;
  yearLabel: string;
  semester: 1 | 2;
  tkbNumber: number;
  shift: "SANG" | "CHIEU";
  grade: number;
  classes: ClassRow[];
  periods: PeriodRow[];
  slotByCell: Map<string, TimetableSlotRow>;
  subjectById: Map<string, SubjectRow>;
  teacherById: Map<string, TenantTeacherRow>;
  onSelectCell: (target: CellTarget) => void;
  mode?: "normal" | "brush" | "select";
  selectedKeys?: Set<string>;
}) {
  const lastPeriodNumber = periods[periods.length - 1]?.period_number ?? 5;

  if (classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
        <AlertTriangle className="h-7 w-7 text-amber-400" />
        <p className="text-sm font-semibold text-slate-700">
          Khối {grade} chưa có lớp nào.
        </p>
        <p className="max-w-md text-xs text-slate-500">
          Vào tab &quot;Lớp&quot; để tạo lớp cho khối này trước khi xếp TKB.
        </p>
      </div>
    );
  }
  if (periods.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
        <AlertTriangle className="h-7 w-7 text-amber-400" />
        <p className="text-sm font-semibold text-slate-700">
          Buổi {shift === "SANG" ? "sáng" : "chiều"} chưa có khung tiết nào.
        </p>
        <p className="max-w-md text-xs text-slate-500">
          Vào tab &quot;Khung tiết&quot; để định nghĩa các tiết cho buổi này.
        </p>
      </div>
    );
  }

  return (
    <div className="tkb-print overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* Printed header — mirrors the canonical THPT TKB sheet layout. */}
      <header className="grid grid-cols-[1fr_2fr_1fr] gap-2 border-b-2 border-slate-900 px-4 py-3 print:border-black">
        <div className="text-[12.5px] leading-tight">
          <p className="font-semibold text-slate-900">{centerName}</p>
          <p className="text-slate-700">Năm học {yearLabel}</p>
          <p className="text-slate-700">Học kỳ {semester}</p>
        </div>
        <div className="text-center">
          <h1 className="font-display text-[22px] font-bold tracking-tight text-slate-900">
            THỜI KHOÁ BIỂU SỐ {tkbNumber}
          </h1>
          <p className="mt-0.5 text-[14px] font-bold uppercase tracking-wider text-slate-900">
            Buổi {shift === "SANG" ? "Sáng" : "Chiều"}
          </p>
          <p className="mt-0.5 font-mono text-[10.5px] tracking-wide text-slate-500">
            Khối {grade} · {classes.length} lớp
          </p>
        </div>
        <div /> {/* right column intentionally empty for symmetry */}
      </header>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-slate-50">
              <th className="w-10 border border-slate-300 px-1 py-1 text-center font-semibold uppercase tracking-wider text-slate-700 print:border-black">
                Thứ
              </th>
              <th className="w-10 border border-slate-300 px-1 py-1 text-center font-semibold uppercase tracking-wider text-slate-700 print:border-black">
                Tiết
              </th>
              {classes.map((c) => {
                const hr = c.homeroom_teacher_id
                  ? teacherById.get(c.homeroom_teacher_id)
                  : null;
                return (
                  <th
                    key={c.id}
                    className="border border-slate-300 px-1 py-1 text-center font-semibold text-slate-900 print:border-black"
                  >
                    <div className="font-bold">{c.name}</div>
                    <div className="text-[12px] font-bold text-slate-800">
                      ({hr ? teacherAbbrev(hr.display_name) : "—"})
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          {VN_SCHOOL_DAYS.map((day) => (
            // One <tbody> per day so the print CSS can keep each day's
            // rows together while allowing page breaks between days. This
            // is what lets all 6 days actually print without clipping
            // (1 shift ≈ 2-3 pages at readable font size).
            <tbody key={day}>
              {periods.map((p, pi) => {
                // Chào cờ: Monday (day=2) period 1 — special school-wide
                // event, shown as plain label in each class cell.
                // ISO day_of_week: 1=Mon ("Thứ 2"), 6=Sat ("Thứ 7"). Chào
                // cờ is Mon-period-1; Sinh hoạt is Sat last-period.
                const isFlagRaising = day === 1 && p.period_number === 1;
                const isHomeroom =
                  day === 6 && p.period_number === lastPeriodNumber;
                return (
                  <tr
                    key={`${day}-${p.id}`}
                    className={
                      pi === periods.length - 1
                        ? "border-b-2 border-slate-400 print:border-black"
                        : ""
                    }
                  >
                    {pi === 0 && (
                      <td
                        rowSpan={periods.length}
                        className="border border-slate-300 bg-slate-50 text-center align-middle font-display text-[18px] font-bold text-slate-900 print:border-black"
                      >
                        {dayLabel(day)}
                      </td>
                    )}
                    <td className="border border-slate-300 bg-slate-50/60 px-1 py-1 text-center font-mono tabular-nums text-slate-700 print:border-black">
                      {p.period_number}
                    </td>
                    {classes.map((c) => {
                      const slot = slotByCell.get(slotKey(c.id, day, p.id));
                      const subject = slot
                        ? subjectById.get(slot.subject_id)
                        : null;
                      const teacher = slot?.teacher_id
                        ? teacherById.get(slot.teacher_id)
                        : null;

                      let display: React.ReactNode = null;
                      let isSpecial = false;
                      if (slot && subject) {
                        display = (
                          <>
                            <span>{subject.short_code || subject.name}</span>
                            {teacher && (
                              <>
                                <span className="text-slate-400"> - </span>
                                <span>
                                  {teacherAbbrev(teacher.display_name)}
                                </span>
                              </>
                            )}
                          </>
                        );
                      } else if (isFlagRaising) {
                        display = (
                          <span className="italic text-slate-500">Chào cờ</span>
                        );
                        isSpecial = true;
                      } else if (isHomeroom) {
                        display = (
                          <span className="italic text-slate-500">
                            Sinh hoạt
                          </span>
                        );
                        isSpecial = true;
                      }

                      const cellKey = `${c.id}|${day}|${p.id}`;
                      const isSelected =
                        mode === "select" && !!selectedKeys?.has(cellKey);
                      return (
                        <td
                          key={c.id}
                          onClick={() =>
                            onSelectCell({
                              classId: c.id,
                              day,
                              periodId: p.id,
                              existing: slot,
                            })
                          }
                          className={`cursor-pointer border px-1 py-1 text-center text-[10.5px] leading-tight transition-colors print:cursor-default print:border-black ${
                            isSelected
                              ? "border-indigo-500 bg-indigo-100 text-slate-900 ring-1 ring-indigo-500"
                              : slot
                                ? "border-slate-300 bg-white text-slate-900 hover:bg-indigo-50/60"
                                : isSpecial
                                  ? "border-slate-300 bg-amber-50/40 hover:bg-amber-50"
                                  : "border-slate-300 bg-white text-slate-400 hover:bg-slate-50"
                          }`}
                          title={
                            slot && subject
                              ? `${subject.name}${teacher ? ` · ${teacher.display_name}` : ""}`
                              : "Click để gán"
                          }
                        >
                          {display ?? (
                            <span className="text-slate-300">·</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>

      {/* Footer note — visible on print only as a small legend. */}
      <p className="border-t border-slate-200 bg-slate-50/60 px-4 py-2 text-[10px] text-slate-500 print:bg-white">
        Chú thích: Cell hiển thị &quot;Môn - GV&quot; (mã môn + tên giáo
        viên). Ô trống = chưa xếp. Chào cờ / Sinh hoạt là sự kiện chung của
        trường.
      </p>
    </div>
  );
}

// ── QrShareModal ─────────────────────────────────────────────────────────
//
// Builds the public TKB URL using the tenant's `public_tkb_token`
// (migration 0033) — fetched eagerly by the parent — plus the selected
// grade. The public page shows BOTH Sáng + Chiều so a single QR per grade
// covers the student's full day. `qrcode` is imported eagerly at the top
// of the file so generation is synchronous when opened (no dynamic-import
// stall).
function QrShareModal({
  open,
  onClose,
  grade,
  centerName,
  token,
  tokenError,
}: {
  open: boolean;
  onClose: () => void;
  grade: number;
  centerName: string;
  token: string | null;
  tokenError: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Build the absolute URL once we have token + window.
  const publicUrl = useMemo(() => {
    if (!token || typeof window === "undefined") return null;
    return `${window.location.origin}/tkb/${token}/${grade}`;
  }, [token, grade]);

  // Surface token-load errors from the parent.
  useEffect(() => {
    if (!open) return;
    setError(tokenError);
  }, [open, tokenError]);

  // Generate QR whenever the URL changes (grade switch) AND the modal is
  // open. Error correction "L" is fastest and is enough for a URL this
  // short. Direct `import QRCode from "qrcode"` at module top so this is
  // synchronous — no dynamic-import wait.
  useEffect(() => {
    if (!open || !publicUrl) return;
    let cancelled = false;
    QRCode.toDataURL(publicUrl, {
      width: 256,
      margin: 1,
      color: { dark: "#0F172A", light: "#FFFFFF" },
      errorCorrectionLevel: "L",
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Lỗi QR";
        setError(msg);
      });
    return () => {
      cancelled = true;
    };
  }, [open, publicUrl]);

  async function handleCopy() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Older browsers: noop. The URL is still visible to the user.
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="relative flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-shrink-0 items-start justify-between rounded-t-2xl border-b border-slate-100 px-5 py-3.5">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  QR cho học sinh
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Khối {grade} · Sáng + Chiều
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body — scroll internally if the viewport is short (mobile
                landscape, small laptops) instead of overflowing the page. */}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {error ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {error}
                </div>
              ) : (
                <>
                  <div className="flex justify-center">
                    {qrDataUrl ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={qrDataUrl}
                          alt="QR code TKB"
                          className="h-48 w-48 sm:h-56 sm:w-56"
                        />
                      </div>
                    ) : (
                      <div className="grid h-48 w-48 place-items-center rounded-2xl border border-dashed border-slate-200 sm:h-56 sm:w-56">
                        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                      </div>
                    )}
                  </div>

                  {publicUrl && (
                    <div>
                      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-slate-500">
                        Đường dẫn
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={publicUrl}
                          readOnly
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-700 outline-none"
                          onClick={(e) =>
                            (e.target as HTMLInputElement).select()
                          }
                        />
                        <button
                          type="button"
                          onClick={handleCopy}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                          title="Sao chép link"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          {copied ? "Đã chép" : "Chép"}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl bg-slate-50/70 px-3 py-2 text-[11.5px] leading-snug text-slate-600">
                    Học sinh / phụ huynh quét QR là xem được TKB. Trang
                    hiển thị đầy đủ{" "}
                    <span className="font-semibold">
                      sáng + chiều
                    </span>{" "}
                    khối <span className="font-semibold">{grade}</span>.
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-shrink-0 justify-end gap-2 rounded-b-2xl border-t border-slate-100 bg-slate-50/60 px-5 py-2.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!qrDataUrl) return;
                  const a = document.createElement("a");
                  a.href = qrDataUrl;
                  a.download = `QR_TKB_Khoi${grade}.png`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
                disabled={!qrDataUrl}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Tải QR
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── BulkAssignPicker ───────────────────────────────────────────────────
// Inline mini-popover that lets the user pick a subject + (optional)
// teacher then "Apply" to every selected cell. Lives next to the Trash
// button in the multi-select action bar.
function BulkAssignPicker({
  subjects,
  teachers,
  onApply,
}: {
  subjects: SubjectRow[];
  teachers: TenantTeacherRow[];
  onApply: (subjectId: string, teacherId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
      >
        <Brush className="h-3.5 w-3.5" />
        Gán môn cho ô đã chọn
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-slate-400">
            Môn (bắt buộc)
          </p>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">— Chọn môn —</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.short_code} · {s.name}
              </option>
            ))}
          </select>
          <p className="mb-2 mt-3 font-mono text-[10px] uppercase tracking-wide text-slate-400">
            Giáo viên (tuỳ chọn)
          </p>
          <select
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">— Không gán GV —</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.display_name}
              </option>
            ))}
          </select>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
            >
              Huỷ
            </button>
            <button
              type="button"
              onClick={() => {
                if (!subjectId) return;
                onApply(subjectId, teacherId || null);
                setOpen(false);
              }}
              disabled={!subjectId}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Check className="mr-1 inline h-3 w-3" /> Áp dụng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── RoomLayout ─────────────────────────────────────────────────────────
//
// Fullscreen "scheduling room" for the editor. Combines:
//   • slim top toolbar with the essentials (grade selector, mode toggle,
//     copy, undo/redo, zoom controls, exit)
//   • scrollable body that hosts both Sáng + Chiều stacked vertically
//     (the children passed in)
//   • zoom slider applied to body content via CSS transform: scale()
//
// Surrounding chrome (sidebar, navbar, section header, tabs) is hidden via
// the `body[data-tkb-room="true"]` CSS rules in globals.css.
function RoomLayout({
  title,
  zoom,
  setZoom,
  onExit,
  gradesInUse,
  selectedGrade,
  setSelectedGrade,
  mode,
  setMode,
  brushSubjectId,
  setBrushSubjectId,
  brushTeacherId,
  setBrushTeacherId,
  subjects,
  teachers,
  selectedKeys,
  clearSelection,
  onBulkDelete,
  onBulkAssign,
  onOpenCopy,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  children,
}: {
  title: string;
  zoom: number;
  setZoom: (z: number) => void;
  onExit: () => void;
  gradesInUse: number[];
  selectedGrade: number;
  setSelectedGrade: (g: number) => void;
  mode: "normal" | "brush" | "select";
  setMode: (m: "normal" | "brush" | "select") => void;
  brushSubjectId: string;
  setBrushSubjectId: (id: string) => void;
  brushTeacherId: string;
  setBrushTeacherId: (id: string) => void;
  subjects: SubjectRow[];
  teachers: TenantTeacherRow[];
  selectedKeys: Set<string>;
  clearSelection: () => void;
  onBulkDelete: () => void;
  onBulkAssign: (subjectId: string, teacherId: string | null) => void;
  onOpenCopy: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  children: React.ReactNode;
}) {
  const zoomPct = Math.round(zoom * 100);
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-50">
      {/* ── Slim top toolbar ─────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 shadow-sm">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 font-mono text-[10.5px] font-bold uppercase tracking-wide text-indigo-700">
          <Maximize2 className="h-3 w-3" />
          {title}
        </span>

        {/* Grade */}
        <select
          value={selectedGrade}
          onChange={(e) => setSelectedGrade(parseInt(e.target.value, 10))}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900 shadow-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
        >
          {(gradesInUse.length > 0 ? gradesInUse : [10, 11, 12]).map((g) => (
            <option key={g} value={g}>
              Khối {g}
            </option>
          ))}
        </select>

        {/* Mode segmented */}
        <div className="inline-flex items-center gap-0.5 rounded-lg bg-slate-50 p-0.5">
          <button
            type="button"
            onClick={() => setMode("normal")}
            className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
              mode === "normal"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
            title="Thường · N"
          >
            <Square className="inline h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === "brush" ? "normal" : "brush")}
            className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
              mode === "brush"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
            title="Brush · B"
          >
            <Brush className="inline h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === "select" ? "normal" : "select")}
            className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
              mode === "select"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
            title="Chọn ô · S"
          >
            <CheckSquare className="inline h-3 w-3" />
          </button>
        </div>

        {/* Copy */}
        <button
          type="button"
          onClick={onOpenCopy}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          title="Copy TKB lớp → lớp"
        >
          <Copy className="h-3 w-3" />
          Copy
        </button>

        {/* Undo / Redo */}
        <div className="inline-flex items-center gap-0.5 rounded-lg bg-slate-50 p-0.5">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="rounded-md p-1.5 text-slate-600 transition-colors hover:bg-white hover:text-slate-900 disabled:opacity-30"
            title="Hoàn tác · ⌘Z"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="rounded-md p-1.5 text-slate-600 transition-colors hover:bg-white hover:text-slate-900 disabled:opacity-30"
            title="Làm lại · ⌘⇧Z"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Zoom */}
        <div className="inline-flex items-center gap-0.5 rounded-lg bg-slate-50 p-0.5">
          <button
            type="button"
            onClick={() => setZoom(Math.max(0.5, +(zoom - 0.1).toFixed(2)))}
            disabled={zoom <= 0.5}
            className="rounded-md p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-30"
            title="Thu nhỏ · ⌘-"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="rounded-md px-2 py-1 font-mono text-xs font-bold tabular-nums text-slate-700 transition-colors hover:bg-white hover:text-slate-900"
            title="Reset zoom · ⌘0"
          >
            {zoomPct}%
          </button>
          <button
            type="button"
            onClick={() => setZoom(Math.min(2, +(zoom + 0.1).toFixed(2)))}
            disabled={zoom >= 2}
            className="rounded-md p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-30"
            title="Phóng to · ⌘+"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Exit */}
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          title="Thoát phòng"
        >
          <X className="h-3.5 w-3.5" />
          Thoát
        </button>
      </div>

      {/* Brush picker — appears below toolbar when active. */}
      {mode === "brush" && (
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-indigo-200 bg-indigo-50/60 px-3 py-2">
          <span className="inline-flex items-center gap-1 px-2 font-mono text-[10.5px] font-semibold uppercase tracking-wide text-indigo-700">
            <Brush className="h-3 w-3" /> Brush
          </span>
          <select
            value={brushSubjectId}
            onChange={(e) => setBrushSubjectId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">— Chọn môn —</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.short_code} · {s.name}
              </option>
            ))}
          </select>
          <select
            value={brushTeacherId}
            onChange={(e) => setBrushTeacherId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">— Không gán GV —</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.display_name}
              </option>
            ))}
          </select>
          <p className="ml-auto text-[11.5px] text-indigo-900">
            Click ô để gán nhanh. <kbd className="rounded bg-white px-1 font-mono text-[10px]">Esc</kbd> để thoát.
          </p>
        </div>
      )}

      {/* Select action bar — appears below toolbar when in select mode. */}
      {mode === "select" && (
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-indigo-200 bg-indigo-50/60 px-3 py-2">
          <span className="inline-flex items-center gap-1 px-2 font-mono text-[10.5px] font-semibold uppercase tracking-wide text-indigo-700">
            <CheckSquare className="h-3 w-3" /> Chọn nhiều
          </span>
          <span className="text-xs font-semibold text-slate-900">
            Đã chọn{" "}
            <span className="font-mono tabular-nums">{selectedKeys.size}</span>{" "}
            ô
          </span>
          {selectedKeys.size > 0 && (
            <>
              <button
                type="button"
                onClick={clearSelection}
                className="text-xs font-medium text-slate-500 hover:text-slate-900"
              >
                Bỏ chọn
              </button>
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={onBulkDelete}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Xoá đã chọn
                </button>
                <BulkAssignPicker
                  subjects={subjects}
                  teachers={teachers}
                  onApply={onBulkAssign}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Scrollable body ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto bg-slate-100 p-3 sm:p-4">
        {children}
      </div>
    </div>
  );
}

// ── CopyClassModal ─────────────────────────────────────────────────────
// Copy TKB from one class to one or more destination classes (typically
// the rest of the same grade). Optional toggles: keep teacher_id, overwrite
// existing cells.
function CopyClassModal({
  open,
  onClose,
  classes,
  currentGrade,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  classes: ClassRow[];
  currentGrade: number;
  onDone: (result: {
    inserted: TimetableSlotRow[];
    removedIds: string[];
  }) => void;
}) {
  const [srcId, setSrcId] = useState<string>("");
  const [destIds, setDestIds] = useState<Set<string>>(new Set());
  const [keepTeacher, setKeepTeacher] = useState(true);
  const [overwrite, setOverwrite] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSrcId("");
    setDestIds(new Set());
    setKeepTeacher(true);
    setOverwrite(false);
  }, [open]);

  const sameGradeClasses = useMemo(
    () =>
      classes
        .filter((c) => c.grade_level === currentGrade)
        .sort((a, b) =>
          a.name.localeCompare(b.name, "vi", { numeric: true }),
        ),
    [classes, currentGrade],
  );
  const destChoices = sameGradeClasses.filter((c) => c.id !== srcId);

  async function handleCopy() {
    if (!srcId) {
      toast.error("Chọn lớp nguồn.");
      return;
    }
    if (destIds.size === 0) {
      toast.error("Chọn ít nhất 1 lớp đích.");
      return;
    }
    setPending(true);
    const r = await copyClassSchedule({
      src_class_id: srcId,
      dest_class_ids: Array.from(destIds),
      keep_teacher: keepTeacher,
      overwrite,
    });
    setPending(false);
    if (!r.success) {
      toast.error(r.error);
      return;
    }
    const {
      totalCopied,
      totalSkipped,
      totalOverwritten,
      inserted,
      removedIds,
    } = r.data!;
    toast.success(
      `Copy: ${totalCopied} · Bỏ qua: ${totalSkipped} · Ghi đè: ${totalOverwritten}`,
    );
    onDone({ inserted, removedIds });
  }

  function toggleDest(id: string) {
    setDestIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm print:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between rounded-t-2xl border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Copy TKB từ lớp → lớp khác
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Trong cùng Khối {currentGrade}.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <div>
                <p className="mb-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                  Lớp nguồn
                </p>
                <select
                  value={srcId}
                  onChange={(e) => setSrcId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">— Chọn lớp —</option>
                  {sameGradeClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="font-mono text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                    Lớp đích · đã chọn {destIds.size}
                  </p>
                  <div className="flex gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() =>
                        setDestIds(new Set(destChoices.map((c) => c.id)))
                      }
                      className="font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      Chọn tất cả
                    </button>
                    <button
                      type="button"
                      onClick={() => setDestIds(new Set())}
                      className="font-medium text-slate-500 hover:text-slate-700"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-slate-200 bg-slate-50/40 p-2">
                  {destChoices.length === 0 ? (
                    <p className="col-span-3 px-2 py-1 text-[11.5px] text-slate-500">
                      Khối {currentGrade} chưa có lớp khác để copy sang.
                    </p>
                  ) : (
                    destChoices.map((c) => {
                      const checked = destIds.has(c.id);
                      return (
                        <label
                          key={c.id}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-[12.5px] transition-colors ${
                            checked
                              ? "border-indigo-500 bg-indigo-50 text-slate-900"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleDest(c.id)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
                          />
                          <span className="font-mono font-semibold">
                            {c.name}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-start gap-2.5 rounded-xl bg-slate-50/70 px-3 py-2 text-[12.5px]">
                  <input
                    type="checkbox"
                    checked={keepTeacher}
                    onChange={(e) => setKeepTeacher(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
                  />
                  <span className="flex-1 leading-tight">
                    <span className="font-semibold text-slate-900">
                      Giữ giáo viên
                    </span>
                    <span className="block text-slate-500">
                      Nếu trùng giờ với lớp khác, slot sẽ chuyển sang &quot;không
                      gán GV&quot; để giữ được môn.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2.5 rounded-xl bg-slate-50/70 px-3 py-2 text-[12.5px]">
                  <input
                    type="checkbox"
                    checked={overwrite}
                    onChange={(e) => setOverwrite(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-200"
                  />
                  <span className="flex-1 leading-tight">
                    <span className="font-semibold text-slate-900">
                      Ghi đè ô đã có
                    </span>
                    <span className="block text-slate-500">
                      Tắt = bỏ qua, giữ nguyên cell đã có ở lớp đích.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 rounded-b-2xl border-t border-slate-100 bg-slate-50/60 px-5 py-3">
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
              >
                Huỷ
              </button>
              <button
                type="button"
                onClick={handleCopy}
                disabled={pending || !srcId || destIds.size === 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Đang copy...
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" /> Copy {destIds.size} lớp
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

