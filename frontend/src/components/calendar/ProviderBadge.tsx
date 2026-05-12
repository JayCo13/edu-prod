import type { ProviderInfo } from "@/lib/meeting-provider";

interface ProviderBadgeProps {
  provider: ProviderInfo;
  size?: "sm" | "md";
}

export function ProviderBadge({ provider, size = "md" }: ProviderBadgeProps) {
  const isSm = size === "sm";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border bg-white font-mono font-semibold uppercase tracking-wide ${
        isSm
          ? "px-1.5 py-0.5 text-[9.5px]"
          : "px-2 py-0.5 text-[10.5px]"
      }`}
      style={{ borderColor: `${provider.color}40`, color: provider.color }}
    >
      <span
        className={`grid place-items-center rounded-sm font-bold text-white ${
          isSm ? "h-3 w-3 text-[8px]" : "h-3.5 w-3.5 text-[8.5px]"
        }`}
        style={{ background: provider.color }}
        aria-hidden
      >
        {provider.glyph}
      </span>
      {provider.label}
    </span>
  );
}
