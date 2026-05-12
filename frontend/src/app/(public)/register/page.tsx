// [DEPRECATED per PRD §4.3] - hidden 2026-05-12
// Teacher self-signup is out of scope. PRD §3.5: teachers join via center
// invite only. Center-owner signup will land in Phase 3 (new wizard).
// Original implementation preserved in git history.

import { notFound } from "next/navigation";

export default function RegisterPage() {
  notFound();
}
