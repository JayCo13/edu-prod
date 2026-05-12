# `frontend/src/modules/`

Domain modules for the center-management product. One folder per bounded context, self-contained per [PRD §9.3](../../../PRD.md#93-folder-structure-suggested).

Each module owns its own components, hooks, server actions, and types. Cross-module imports go through a module's barrel/public exports — don't reach into a sibling module's internals.

## Module layout

```
modules/<name>/
  README.md           — purpose, status, PRD anchor, key entities, API
  actions/            — "use server" Server Actions (mutations)
  components/         — React components owned by this module
  hooks/              — React hooks
  schemas.ts          — Zod schemas
  types.ts            — TypeScript types (mirroring DB rows + DTOs)
```

Skip what you don't need — a small module may just have `actions.ts` + `types.ts`.

## Where existing code lives during the migration

Existing concerns live in `app/actions/`, `components/admin/`, `components/landing/`, etc. They keep working. As features get touched, migrate them into the matching module folder rather than extending the legacy locations. Don't do a bulk move — file-by-file as you go.

## Module index

| Module | Status | PRD |
|---|---|---|
| [centers](./centers/) | REFACTOR (rename from tenants) | §5.2 |
| [teachers](./teachers/) | EXPAND existing | §5.3 |
| [students](./students/) | BUILD | §5.4 |
| [classes](./classes/) | BUILD | §5.5 |
| [sessions](./sessions/) | REFACTOR live_sessions + EXPAND | §5.6 |
| [attendance](./attendance/) | BUILD | §5.7 |
| [payroll](./payroll/) | BUILD — **KILLER FEATURE** | §5.8 |
| [invoices](./invoices/) | BUILD (P1) | §5.9 |
| [reports](./reports/) | BUILD (P1) | §5.10 |

Auth + role-based access + tenant isolation primitives stay in `lib/supabase/` and the Edge middleware — they cut across modules. See [CLAUDE.md §7.1](../../../CLAUDE.md).
