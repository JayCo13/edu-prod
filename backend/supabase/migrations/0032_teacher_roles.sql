-- 0032_teacher_roles.sql
--
-- Teacher role / position system per tenant. Vietnamese schools and centers
-- have a clear org structure (Hiệu trưởng, Phó hiệu trưởng, Tổ trưởng, Giáo
-- viên...) that admins need to label staff with for reports, payroll
-- differentiation, and permission rules later on.
--
-- Roles are tenant-scoped: each center/school manages its own list. We don't
-- ship a hardcoded enum because every tenant's org chart differs (centers
-- have "Trưởng bộ môn", schools have "Tổng phụ trách Đội", etc.) — admins
-- seed the defaults they want via a server action and add custom rows.

CREATE TABLE IF NOT EXISTS public.teacher_roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    name        TEXT NOT NULL,                 -- "Hiệu trưởng", "Giáo viên"
    short_code  TEXT NOT NULL DEFAULT '',      -- optional badge label "HT"
    color       TEXT NOT NULL DEFAULT '#64748B', -- slate-500 default
    sort_order  SMALLINT NOT NULL DEFAULT 100, -- lower = higher in lists

    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT teacher_roles_name_not_blank CHECK (length(btrim(name)) > 0),
    CONSTRAINT teacher_roles_unique_name_per_tenant
        UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_teacher_roles_tenant_sort
    ON public.teacher_roles(tenant_id, sort_order, name);

-- Auto-touch updated_at on row mutation. Reuses the trigger function the
-- existing tables share (set_updated_at) if it exists, else creates it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    CREATE FUNCTION public.set_updated_at() RETURNS trigger AS $body$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $body$ LANGUAGE plpgsql;
  END IF;
END$$;

DROP TRIGGER IF EXISTS trg_teacher_roles_updated_at ON public.teacher_roles;
CREATE TRIGGER trg_teacher_roles_updated_at
    BEFORE UPDATE ON public.teacher_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- ── tenant_teachers.role_id ──────────────────────────────────────────────
-- SET NULL on role delete (the teacher record stays; just unlabeled).

ALTER TABLE public.tenant_teachers
    ADD COLUMN IF NOT EXISTS role_id UUID
        REFERENCES public.teacher_roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_teachers_role
    ON public.tenant_teachers(role_id) WHERE role_id IS NOT NULL;

COMMENT ON COLUMN public.tenant_teachers.role_id IS
  'Position/title at this tenant (Hiệu trưởng, Giáo viên, ...). FK → teacher_roles. NULL = unlabeled.';

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Read: any member of the tenant. Write: tenant owner OR is_admin teacher slot.

ALTER TABLE public.teacher_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS teacher_roles_select ON public.teacher_roles;
CREATE POLICY teacher_roles_select ON public.teacher_roles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = teacher_roles.tenant_id
              AND t.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.tenant_teachers tt
            WHERE tt.tenant_id = teacher_roles.tenant_id
              AND tt.profile_id = auth.uid()
              AND tt.is_active = TRUE
        )
    );

DROP POLICY IF EXISTS teacher_roles_write ON public.teacher_roles;
CREATE POLICY teacher_roles_write ON public.teacher_roles
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = teacher_roles.tenant_id
              AND t.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.tenant_teachers tt
            WHERE tt.tenant_id = teacher_roles.tenant_id
              AND tt.profile_id = auth.uid()
              AND tt.is_admin = TRUE
              AND tt.is_active = TRUE
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = teacher_roles.tenant_id
              AND t.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.tenant_teachers tt
            WHERE tt.tenant_id = teacher_roles.tenant_id
              AND tt.profile_id = auth.uid()
              AND tt.is_admin = TRUE
              AND tt.is_active = TRUE
        )
    );
