/**
 * Calendar export helpers (Google Calendar URL + ICS file).
 * Used by the student-facing live session card so learners can drop the
 * meeting URL straight into their personal calendar.
 */

export interface CalendarEvent {
  /** Stable identifier — used as the ICS UID and helps calendar apps de-dupe. */
  uid: string;
  title: string;
  /** ISO timestamp string (UTC or with offset — JS Date handles both). */
  startIso: string;
  /** Duration in minutes. */
  durationMinutes: number;
  /** Free-form description. The meeting URL is appended automatically. */
  description?: string;
  /** Meeting URL — used as LOCATION + URL fields. */
  meetingUrl: string;
}

function toUtcStamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}` +
    `${pad(date.getUTCMonth() + 1)}` +
    `${pad(date.getUTCDate())}T` +
    `${pad(date.getUTCHours())}` +
    `${pad(date.getUTCMinutes())}` +
    `${pad(date.getUTCSeconds())}Z`
  );
}

function endDate(event: CalendarEvent): Date {
  const start = new Date(event.startIso);
  return new Date(start.getTime() + event.durationMinutes * 60_000);
}

function joinedDescription(event: CalendarEvent): string {
  const parts = [event.description?.trim(), `Link: ${event.meetingUrl}`].filter(
    (p): p is string => Boolean(p && p.length > 0),
  );
  return parts.join("\n\n");
}

export function buildGoogleCalendarUrl(event: CalendarEvent): string {
  const start = new Date(event.startIso);
  const end = endDate(event);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toUtcStamp(start)}/${toUtcStamp(end)}`,
    details: joinedDescription(event),
    location: event.meetingUrl,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// ICS escaping per RFC 5545: backslash, comma, semicolon, and newlines.
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function buildVeventLines(event: CalendarEvent, stampUtc: string): string[] {
  const start = new Date(event.startIso);
  const end = endDate(event);
  return [
    "BEGIN:VEVENT",
    `UID:${event.uid}@ticoclass`,
    `DTSTAMP:${stampUtc}`,
    `DTSTART:${toUtcStamp(start)}`,
    `DTEND:${toUtcStamp(end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(joinedDescription(event))}`,
    `LOCATION:${escapeIcsText(event.meetingUrl)}`,
    `URL:${event.meetingUrl}`,
    "END:VEVENT",
  ];
}

function wrapVcalendar(veventBlocks: string[][]): string {
  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ticoclass//live-session//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  return [...header, ...veventBlocks.flat(), "END:VCALENDAR"].join("\r\n");
}

export function buildIcsContent(event: CalendarEvent): string {
  return wrapVcalendar([buildVeventLines(event, toUtcStamp(new Date()))]);
}

export function buildIcsBulkContent(events: CalendarEvent[]): string {
  const stamp = toUtcStamp(new Date());
  return wrapVcalendar(events.map((e) => buildVeventLines(e, stamp)));
}

function triggerDownload(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/** Trigger a browser download of a single-event .ics file. Client-only. */
export function downloadIcsFile(event: CalendarEvent, filename?: string): void {
  triggerDownload(
    buildIcsContent(event),
    filename ?? `${event.title || "buoi-hoc"}.ics`,
  );
}

/** Trigger a browser download of a multi-event .ics file. Client-only. */
export function downloadIcsBulk(
  events: CalendarEvent[],
  filename: string,
): void {
  triggerDownload(buildIcsBulkContent(events), filename);
}
