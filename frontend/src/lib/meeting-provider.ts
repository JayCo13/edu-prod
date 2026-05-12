/**
 * Meeting URL → provider detection.
 * Pure helper — used by both the editor (create modal) and the calendar list.
 *
 * BYOM model: the platform never creates the room. The teacher schedules in
 * their own Zoom/Meet/Teams/etc. account and pastes the link. We only detect
 * which provider it is so we can render a sensible badge + a "Schedule new"
 * launcher.
 */

export type ProviderId =
  | "zoom"
  | "meet"
  | "teams"
  | "jitsi"
  | "webex"
  | "whereby"
  | "skype"
  | "other";

export interface ProviderInfo {
  id: ProviderId;
  /** Vietnamese display label. */
  label: string;
  /** Brand-ish color. Used for the badge dot + ring. */
  color: string;
  /** URL of the provider's "schedule a new meeting" page. Null = no useful entry point. */
  scheduleUrl: string | null;
  /** Single-letter glyph for the provider chip. */
  glyph: string;
}

const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  zoom: {
    id: "zoom",
    label: "Zoom",
    color: "#2D8CFF",
    scheduleUrl: "https://zoom.us/meeting/schedule",
    glyph: "Z",
  },
  meet: {
    id: "meet",
    label: "Google Meet",
    color: "#00897B",
    scheduleUrl: "https://meet.google.com/new",
    glyph: "M",
  },
  teams: {
    id: "teams",
    label: "Microsoft Teams",
    color: "#5059C9",
    scheduleUrl: "https://teams.microsoft.com/_#/calendarv2",
    glyph: "T",
  },
  jitsi: {
    id: "jitsi",
    label: "Jitsi Meet",
    color: "#1A6FB4",
    scheduleUrl: "https://meet.jit.si",
    glyph: "J",
  },
  webex: {
    id: "webex",
    label: "Webex",
    color: "#00BCEB",
    scheduleUrl: "https://www.webex.com/start-now.html",
    glyph: "W",
  },
  whereby: {
    id: "whereby",
    label: "Whereby",
    color: "#3F75FF",
    scheduleUrl: "https://whereby.com/user",
    glyph: "W",
  },
  skype: {
    id: "skype",
    label: "Skype",
    color: "#00AFF0",
    scheduleUrl: "https://www.skype.com/en/free-conference-call/",
    glyph: "S",
  },
  other: {
    id: "other",
    label: "Phòng họp",
    color: "#64748b",
    scheduleUrl: null,
    glyph: "·",
  },
};

const HOST_RULES: Array<{ test: (h: string) => boolean; id: ProviderId }> = [
  { test: (h) => h === "zoom.us" || h.endsWith(".zoom.us"), id: "zoom" },
  { test: (h) => h === "meet.google.com", id: "meet" },
  {
    test: (h) =>
      h === "teams.microsoft.com" ||
      h === "teams.live.com" ||
      h.endsWith(".teams.microsoft.com"),
    id: "teams",
  },
  { test: (h) => h === "meet.jit.si" || h.endsWith(".jitsi.org"), id: "jitsi" },
  { test: (h) => h.endsWith(".webex.com") || h === "webex.com", id: "webex" },
  { test: (h) => h === "whereby.com" || h.endsWith(".whereby.com"), id: "whereby" },
  { test: (h) => h === "join.skype.com" || h.endsWith(".skype.com"), id: "skype" },
];

export function detectProvider(rawUrl: string | null | undefined): ProviderInfo {
  if (!rawUrl) return PROVIDERS.other;
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return PROVIDERS.other;
  }
  const host = url.hostname.toLowerCase();
  for (const rule of HOST_RULES) {
    if (rule.test(host)) return PROVIDERS[rule.id];
  }
  return PROVIDERS.other;
}

/**
 * Zoom URLs sometimes embed the passcode in `?pwd=...`. If present, return it
 * so the teacher doesn't have to copy it twice.
 */
export function extractZoomPassword(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl.trim());
    if (!url.hostname.endsWith("zoom.us")) return null;
    return url.searchParams.get("pwd");
  } catch {
    return null;
  }
}

export function listKnownProviders(): ProviderInfo[] {
  return [PROVIDERS.zoom, PROVIDERS.meet, PROVIDERS.teams, PROVIDERS.jitsi];
}

export function getProvider(id: ProviderId): ProviderInfo {
  return PROVIDERS[id] ?? PROVIDERS.other;
}
