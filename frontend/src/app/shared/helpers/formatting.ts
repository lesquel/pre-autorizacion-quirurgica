/**
 * Pure formatting helpers — locale es-AR (Argentina, voseo).
 * No external dependencies (only Intl from stdlib). No domain coupling.
 */

const LOCALE = 'es-AR';

/**
 * Formats an ISO timestamp to a human-readable Spanish (es-AR) string.
 * Example: "15 ago 2024, 14:32".
 */
export function formatTs(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat(LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * Returns a relative time string in Spanish rioplatense.
 * Examples: "ahora", "hace 2 min", "hace 3 hs", "ayer", "hace 5 días",
 *           "hace 2 semanas", "hace 3 meses", "hace 1 año".
 *
 * Tone: casual but readable — uses "hs" (rioplatense) for hours and
 * "ayer" as a special case for 1 day instead of "hace 1 día".
 */
export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(ms / 1000);

  if (seconds < 10) {
    return 'ahora';
  }
  if (seconds < 60) {
    return `hace ${seconds} s`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `hace ${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `hace ${hours} hs`;
  }

  const days = Math.floor(hours / 24);
  if (days === 1) {
    return 'ayer';
  }
  if (days < 7) {
    return `hace ${days} días`;
  }

  const weeks = Math.floor(days / 7);
  if (weeks < 5) {
    return weeks === 1 ? 'hace 1 semana' : `hace ${weeks} semanas`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return months === 1 ? 'hace 1 mes' : `hace ${months} meses`;
  }

  const years = Math.floor(days / 365);
  return years === 1 ? 'hace 1 año' : `hace ${years} años`;
}

/**
 * Formats a numeric amount as currency using es-AR locale.
 * Defaults to USD; supply `currency` for ARS, EUR, etc.
 */
export function formatCurrency(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
  }).format(value);
}

/**
 * Formats a duration in milliseconds.
 *  < 1000ms        → "456ms"
 *  < 60000ms       → "2.3s"  (one decimal)
 *  >= 60000ms      → "1m 30s"
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

/**
 * Formats a 0..1 value as a percentage string.
 * Example: formatPercent(0.943) -> "94%", formatPercent(0.943, 1) -> "94.3%".
 */
export function formatPercent(value: number, decimals: number = 0): string {
  return `${(value * 100).toFixed(decimals)}%`;
}
