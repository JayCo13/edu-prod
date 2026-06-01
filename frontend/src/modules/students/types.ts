// Types cho students module (CENTER).
// Dữ liệu live nằm trong public.* (Supabase). Module này chỉ chứa
// shape + constants.

export type StudentGender = "M" | "F" | "OTHER";

export const GENDER_LABEL: Record<StudentGender, string> = {
  M: "Nam",
  F: "Nữ",
  OTHER: "Khác",
};

export type EnrollmentStatus =
  | "ACTIVE"
  | "TRANSFERRED"
  | "WITHDRAWN"
  | "COMPLETED";

export const ENROLLMENT_STATUS_LABEL: Record<EnrollmentStatus, string> = {
  ACTIVE: "Đang học",
  TRANSFERRED: "Đã chuyển lớp",
  WITHDRAWN: "Đã nghỉ",
  COMPLETED: "Đã hoàn thành",
};

export type BillingCycle = "MONTHLY" | "PER_SESSION" | "ANNUAL" | "ONE_TIME";

export const BILLING_CYCLE_LABEL: Record<BillingCycle, string> = {
  MONTHLY: "Theo tháng",
  PER_SESSION: "Theo buổi",
  ANNUAL: "Theo năm",
  ONE_TIME: "Đóng 1 lần",
};

export type PaymentStatus =
  | "PENDING"
  | "PAID"
  | "PARTIAL"
  | "OVERDUE"
  | "CANCELLED";

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: "Chưa đến hạn",
  PAID: "Đã đóng",
  PARTIAL: "Đóng một phần",
  OVERDUE: "Quá hạn",
  CANCELLED: "Đã huỷ",
};

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "Có mặt",
  ABSENT: "Vắng",
  LATE: "Muộn",
  EXCUSED: "Vắng có phép",
};

// ── DB row shapes ─────────────────────────────────────────────────────
export interface StudentRow {
  id: string;
  tenant_id: string;
  student_code: string;
  display_name: string;
  dob: string | null; // YYYY-MM-DD
  gender: StudentGender | null;
  phone: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  address: string | null;
  note: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudentEnrollmentRow {
  id: string;
  tenant_id: string;
  student_id: string;
  class_id: string;
  enrolled_at: string;
  withdrawn_at: string | null;
  status: EnrollmentStatus;
  tuition_amount_vnd: number | null;
  billing_cycle: BillingCycle | null;
  payment_day: number | null;
  transferred_from_enrollment_id: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentPaymentRow {
  id: string;
  tenant_id: string;
  student_id: string;
  enrollment_id: string | null;
  amount_vnd: number;
  due_date: string;
  paid_amount_vnd: number;
  paid_date: string | null;
  status: PaymentStatus;
  payment_method: string | null;
  receipt_no: string | null;
  period_label: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentAttendanceRow {
  id: string;
  tenant_id: string;
  student_id: string;
  session_id: string;
  enrollment_id: string | null;
  status: AttendanceStatus;
  note: string | null;
  recorded_at: string;
  recorded_by: string | null;
}

// ── Computed shapes ───────────────────────────────────────────────────
export interface PaymentAlert {
  payment: StudentPaymentRow;
  student: Pick<StudentRow, "id" | "student_code" | "display_name" | "parent_phone">;
  class_name: string | null;
  remaining_vnd: number;
  days_until_due: number; // âm = quá hạn N ngày
}

// Bảng giảng dạy gom theo (student × class × month).
export interface MonthlyAttendanceStat {
  student_id: string;
  student_code: string;
  display_name: string;
  class_id: string;
  class_name: string;
  month: string; // YYYY-MM
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
  total_count: number;
}

// ── Excel import shape (sheet "Học sinh") ─────────────────────────────
// Cột chuẩn hoá để admin tải template, fill, upload lại.
export interface StudentImportRow {
  student_code?: string; // bỏ trống → auto gen
  display_name: string;
  dob?: string; // DD/MM/YYYY trong template
  gender?: "Nam" | "Nữ" | "Khác";
  phone?: string;
  parent_name?: string;
  parent_phone?: string;
  parent_email?: string;
  address?: string;
  note?: string;
}

export const STUDENT_IMPORT_HEADERS: Array<{
  key: keyof StudentImportRow;
  label: string;
  required: boolean;
  hint?: string;
}> = [
  { key: "student_code", label: "Mã HS", required: false, hint: "trống = tự sinh" },
  { key: "display_name", label: "Họ và tên", required: true },
  { key: "dob", label: "Ngày sinh", required: false, hint: "DD/MM/YYYY" },
  { key: "gender", label: "Giới tính", required: false, hint: "Nam/Nữ/Khác" },
  { key: "phone", label: "SĐT HS", required: false },
  { key: "parent_name", label: "Họ tên phụ huynh", required: false },
  { key: "parent_phone", label: "SĐT phụ huynh", required: false },
  { key: "parent_email", label: "Email phụ huynh", required: false },
  { key: "address", label: "Địa chỉ", required: false },
  { key: "note", label: "Ghi chú", required: false },
];

// Định danh nguồn lỗi import để UI render rõ.
export interface ImportError {
  row_index: number; // 0-indexed, không tính header
  field?: string;
  message: string;
}

export interface ImportResult {
  created: number;
  skipped: number; // trùng mã HS hoặc trùng tên+SĐT phụ huynh
  errors: ImportError[];
}
