import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility: cn
 * -----------
 * Merges Tailwind CSS classes intelligently.
 * Combines clsx (conditional classes) with tailwind-merge (deduplication).
 *
 * @example
 *   cn("px-4 py-2", isActive && "bg-primary", className)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
