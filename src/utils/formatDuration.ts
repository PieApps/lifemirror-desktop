/**
 * Shared duration formatting utilities.
 *
 * Single source of truth — import this everywhere instead of defining local copies.
 * Two purposefully different precisions are exported:
 *
 *  - `formatDuration`     → concise, no seconds above 1 min  (analytics labels, charts)
 *  - `formatDurationFull` → full precision with seconds       (timeline sidebar events)
 */

/**
 * Concise format: "45s" | "3m" | "2h 30m"
 * Seconds are only shown when the value is under one minute.
 * Suitable for chart labels and summary metrics where space is tight.
 */
export function formatDuration(seconds: number): string {
  const s = Math.floor(Math.max(0, seconds));
  if (s < 60) return `${s}s`;
  const totalMins = Math.floor(s / 60);
  const hrs = Math.floor(totalMins / 60);
  const remainingMins = totalMins % 60;
  if (hrs > 0) {
    return remainingMins > 0 ? `${hrs}h ${remainingMins}m` : `${hrs}h`;
  }
  return `${totalMins}m`;
}

/**
 * Full-precision format: "45s" | "3m 12s" | "2h 30m"
 * Shows residual seconds in the 1-60 min range.
 * Suitable for per-event detail panels where exact values matter.
 */
export function formatDurationFull(seconds: number): string {
  const s = Math.round(Math.max(0, seconds));
  if (s < 60) return `${s}s`;
  const totalMins = Math.floor(s / 60);
  const secs = s % 60;
  const hrs = Math.floor(totalMins / 60);
  const remainingMins = totalMins % 60;
  if (hrs > 0) {
    return remainingMins > 0 ? `${hrs}h ${remainingMins}m` : `${hrs}h`;
  }
  return secs > 0 ? `${totalMins}m ${secs}s` : `${totalMins}m`;
}

/**
 * Parse a YYYY-MM-DD string into a local Date (avoids UTC midnight shift).
 * `new Date("2026-09-21")` parses as UTC and drifts one day in UTC+ timezones.
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}
