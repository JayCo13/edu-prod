interface PortraitProps {
  initials: string;
  square?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Portrait({ initials, square = false, size = "lg" }: PortraitProps) {
  const dim =
    size === "sm"
      ? "h-20 w-20 text-[36px]"
      : size === "md"
        ? "h-28 w-28 text-[44px]"
        : "h-36 w-36 text-[56px]";
  const wrapperCls = square
    ? "relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-100 via-rose-100 to-amber-100"
    : `relative ${dim} overflow-hidden rounded-full bg-gradient-to-br from-indigo-100 via-rose-100 to-amber-100`;
  const patternId = `pp-${initials}-${square ? "sq" : "r"}`;

  return (
    <div className={wrapperCls}>
      <svg
        className="absolute inset-0 h-full w-full opacity-40"
        viewBox="0 0 200 250"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <defs>
          <pattern
            id={patternId}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="0.7" fill="rgb(15 23 42 / 0.25)" />
          </pattern>
        </defs>
        <rect width="200" height="250" fill={`url(#${patternId})`} />
      </svg>
      <span
        className={`font-display absolute inset-0 grid place-items-center font-black tracking-tight text-slate-900/70 ${
          square ? "text-[120px]" : ""
        }`}
      >
        {initials}
      </span>
    </div>
  );
}
