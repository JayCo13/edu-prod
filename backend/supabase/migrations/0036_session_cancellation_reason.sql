-- 0036_session_cancellation_reason.sql
--
-- Phân loại lý do huỷ buổi — quyết định lương có chi cho GV hay không.
--
-- Trước đây: `is_cancelled = TRUE` luôn skip lương → gây tranh cãi khi
-- hủy do trung tâm (phòng hỏng, xếp sai). Bây giờ tách 4 loại:
--   • BY_TEACHER     → KHÔNG trả (GV chủ động hủy / nghỉ)
--   • BY_CENTER      → CÓ trả (lỗi từ phía trung tâm, GV vẫn nhận lương)
--   • BY_STUDENT     → config (mặc định KHÔNG trả)
--   • FORCE_MAJEURE  → config (mặc định CÓ trả — thiên tai, dịch bệnh)
--
-- Các buổi đã `is_cancelled=TRUE` từ trước backfill = BY_TEACHER
-- (giữ behavior cũ — skip pay).
--
-- Calculator policy: PRD §5.8 cập nhật. Audit log có `SESSION_PAID_DESPITE_CANCEL`
-- khi reason ≠ BY_TEACHER.

CREATE TYPE public.session_cancel_reason AS ENUM (
  'BY_TEACHER',
  'BY_CENTER',
  'BY_STUDENT',
  'FORCE_MAJEURE'
);

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS cancellation_reason public.session_cancel_reason;

-- Backfill: buổi đã huỷ trước đây → mặc định BY_TEACHER (giữ semantics cũ).
UPDATE public.live_sessions
SET cancellation_reason = 'BY_TEACHER'
WHERE is_cancelled = TRUE
  AND cancellation_reason IS NULL;

-- Constraint: chỉ buổi `is_cancelled=TRUE` mới có reason. Chuyển từ huỷ
-- về không-huỷ thì reason phải clear.
ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_reason_only_when_cancelled
    CHECK (
      (is_cancelled = TRUE AND cancellation_reason IS NOT NULL)
      OR (is_cancelled = FALSE AND cancellation_reason IS NULL)
    ) NOT VALID;

-- NOT VALID + VALIDATE separately để không break existing rows nếu có
-- mismatched data. Validate sau khi backfill xong.
ALTER TABLE public.live_sessions
  VALIDATE CONSTRAINT live_sessions_reason_only_when_cancelled;

CREATE INDEX IF NOT EXISTS idx_live_sessions_cancellation_reason
  ON public.live_sessions(cancellation_reason)
  WHERE is_cancelled = TRUE;

COMMENT ON COLUMN public.live_sessions.cancellation_reason IS
  'Khi is_cancelled=TRUE, lý do quyết định policy lương. BY_TEACHER không trả; BY_CENTER trả; STUDENT/FORCE_MAJEURE theo config trung tâm.';
