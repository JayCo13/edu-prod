#!/usr/bin/env node
/**
 * db-push — apply pending SQL migrations to the project's Supabase Postgres.
 *
 * Usage:   pnpm db:push           # apply everything not yet recorded
 *          pnpm db:push --dry     # list pending without applying
 *          pnpm db:push --force <name>   # force-apply one file (rerun, idempotent)
 *
 * Workflow:
 *   1. Reads SUPABASE_DB_URL (or DATABASE_URL) from backend/.env.local.
 *   2. Connects to Postgres over SSL.
 *   3. Ensures public._schema_migrations exists.
 *   4. Lists backend/supabase/migrations/*.sql in lexicographic order.
 *   5. Applies each file that isn't in _schema_migrations, wrapped in a
 *      transaction. Records the filename + sha256 on success.
 *
 * Why this exists: CLAUDE.md says "Run via Supabase Dashboard SQL Editor or
 * `supabase db push`". The Supabase CLI works but needs the project linked
 * (which needs a one-time `supabase login` + `supabase link`). This runner
 * uses only a DB URL — copy the "Transaction pooler" or "Session pooler"
 * URI from Supabase Dashboard → Settings → Database → Connection string.
 *
 * The user supplies SUPABASE_DB_URL exactly once in backend/.env.local. The
 * file is gitignored so the password stays local.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createHash } from "node:crypto";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const MIGRATIONS_DIR = join(REPO_ROOT, "backend/supabase/migrations");
const ENV_PATH = join(REPO_ROOT, "backend/.env.local");

// ── env loader (no dotenv dependency) ─────────────────────────────────────
function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const val = line
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    out[key] = val;
  }
  return out;
}

const env = { ...readEnvFile(ENV_PATH), ...process.env };
const dbUrl = env.SUPABASE_DB_URL || env.DATABASE_URL;

if (!dbUrl) {
  console.error(`
✗ Missing SUPABASE_DB_URL.

Add one line to backend/.env.local:
  SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@<pooler-host>:6543/postgres

Where to find it:
  Supabase Dashboard → Settings → Database → Connection string → "Transaction"
  (Mode = Transaction. The "URI" tab. Replace [YOUR-PASSWORD] with your DB password.)
`);
  process.exit(1);
}

// ── CLI flags ─────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flags = {
  dry: argv.includes("--dry") || argv.includes("--dry-run"),
  force: argv.includes("--force"),
};
const forceName = flags.force ? argv[argv.indexOf("--force") + 1] : null;
if (flags.force && !forceName) {
  console.error("--force requires a migration filename (e.g. 0020_*.sql)");
  process.exit(1);
}

// ── connect ────────────────────────────────────────────────────────────────
const sql = postgres(dbUrl, {
  ssl: "require",
  max: 1,
  idle_timeout: 5,
  prepare: false, // Supabase Transaction pooler doesn't support prepared statements.
});

async function main() {
  // Tracking table — minimal, additive. sha256 lets us detect a file edited
  // after applying (which is a bug — we never edit applied migrations).
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS public._schema_migrations (
      name        TEXT PRIMARY KEY,
      sha256      TEXT NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  if (files.length === 0) {
    console.log("No .sql files in backend/supabase/migrations/.");
    return;
  }

  const applied = new Map(
    (await sql`SELECT name, sha256 FROM public._schema_migrations`).map(
      (r) => [r.name, r.sha256],
    ),
  );

  // Drift check: any applied file whose checksum no longer matches its
  // contents is a red flag — surfaces before we silently skip a stale file.
  const drift = [];
  for (const name of applied.keys()) {
    const path = join(MIGRATIONS_DIR, name);
    if (!existsSync(path)) continue; // file deleted; tolerated
    const sha = createHash("sha256")
      .update(readFileSync(path))
      .digest("hex");
    if (sha !== applied.get(name)) drift.push(name);
  }
  if (drift.length > 0) {
    console.warn(
      `⚠ Applied migrations differ from disk: ${drift.join(", ")}`,
    );
    console.warn("   These were edited after being applied. Don't do that — write a new migration instead.");
  }

  const pending = forceName
    ? files.filter((f) => f === forceName)
    : files.filter((f) => !applied.has(f));

  if (forceName && pending.length === 0) {
    console.error(`✗ --force target not found: ${forceName}`);
    process.exit(1);
  }
  if (pending.length === 0) {
    console.log("✓ Up to date — no pending migrations.");
    return;
  }

  console.log(
    `${flags.dry ? "Would apply" : "Applying"} ${pending.length} migration(s):`,
  );
  for (const f of pending) console.log(`  - ${f}`);
  if (flags.dry) return;

  for (const name of pending) {
    const path = join(MIGRATIONS_DIR, name);
    const body = readFileSync(path, "utf8");
    const sha = createHash("sha256").update(body).digest("hex");
    process.stdout.write(`  ▸ ${name} … `);

    try {
      // Run the file body + the tracking insert in one transaction so a
      // partial-apply leaves the table empty and we can retry safely.
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        if (forceName) {
          await tx`
            INSERT INTO public._schema_migrations (name, sha256)
            VALUES (${name}, ${sha})
            ON CONFLICT (name) DO UPDATE
              SET sha256 = EXCLUDED.sha256, applied_at = NOW()
          `;
        } else {
          await tx`
            INSERT INTO public._schema_migrations (name, sha256)
            VALUES (${name}, ${sha})
          `;
        }
      });
      console.log("ok");
    } catch (err) {
      console.log("FAILED");
      console.error(`\n${err.message ?? err}\n`);
      process.exit(1);
    }
  }

  console.log(`\n✓ Applied ${pending.length} migration(s).`);
}

try {
  await main();
} finally {
  await sql.end({ timeout: 5 });
}
