// [DEPRECATED per PRD §4.3] - hidden 2026-05-12
// Branded student signup on tenant subdomain. Student-facing accounts are
// out of scope per PRD §2.3. Original implementation preserved in git history.

import { notFound } from "next/navigation";

export default function TenantRegisterPage() {
  notFound();
}
