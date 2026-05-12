// [DEPRECATED per PRD §4.3] - hidden 2026-05-12
// Tenant public storefront (teacher's PublicProfile). The teacher-storefront
// model is out of scope per PRD §1.4; subdomain strategy itself is open per
// PRD §12 question 5. Original implementation preserved in git history.

import { notFound } from "next/navigation";

export default function TenantProfilePage() {
  notFound();
}
