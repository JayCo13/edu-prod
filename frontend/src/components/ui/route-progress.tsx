"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Top-of-viewport indeterminate progress bar that animates whenever the
// route changes. Renders nothing once the page settles (animation ends).
//
// We listen for pathname / query changes (Next App Router navigation) and
// flash the bar for ~600ms. This gives the user instant visual feedback
// during the gap between a click and the new page's Suspense boundary
// resolving.
//
// Pure CSS + state — no NProgress dep, no setInterval. The bar starts
// hidden, the route-change effect kicks in `visible=true`, the bar's
// transition (width: 0% → 90%) runs while React renders the new page,
// and the cleanup completes it to 100% then fades out.
export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const firstRender = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    // Reset, then animate up in a microtask so the browser sees the
    // 0 → 80 transition (not just the final value).
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(true);
    setProgress(0);
    requestAnimationFrame(() => setProgress(80));
    // Finish + fade out after a short hold. 600ms covers most server
    // fetches; for slower navigations the 80% hold still feels alive.
    timeoutRef.current = setTimeout(() => {
      setProgress(100);
      timeoutRef.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 200);
    }, 600);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [pathname, searchParams]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 200ms ease" }}
    >
      <div
        className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"
        style={{
          width: `${progress}%`,
          transition: "width 400ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
    </div>
  );
}
