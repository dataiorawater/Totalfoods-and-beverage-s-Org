// Shared Thai date parsing and formatting utilities used across views

export const THAI_SHORT_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
] as const;

/**
 * Robust date parser supporting ISO strings, DD/MM/YYYY, YYYY-MM-DD,
 * Buddhist Era years (25xx), and optional time components.
 */
export function parseDateRobust(dateStr: string): Date {
  if (!dateStr) return new Date();
  const trimmed = String(dateStr).trim();

  // Try standard ISO parsing if it has a clean format
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime()) && trimmed.includes('-') && !trimmed.includes('/')) {
    if (parsed.getFullYear() > 2400) {
      parsed.setFullYear(parsed.getFullYear() - 543);
    }
    return parsed;
  }

  // Handle DD/MM/YYYY or DD-MM-YYYY with optional time
  const normalized = trimmed.replace('T', ' ');
  const parts = normalized.split(' ');
  const datePart = parts[0] || '';
  const timePart = parts[1] || '00:00:00';

  if (datePart.includes('/') || datePart.includes('-')) {
    const separator = datePart.includes('/') ? '/' : '-';
    const dParts = datePart.split(separator);
    let day = 1;
    let month = 1;
    let year = new Date().getFullYear();

    if (dParts.length === 3) {
      if (dParts[0].length === 4) {
        year = parseInt(dParts[0], 10) || year;
        month = parseInt(dParts[1], 10) || 1;
        day = parseInt(dParts[2], 10) || 1;
      } else {
        day = parseInt(dParts[0], 10) || 1;
        month = parseInt(dParts[1], 10) || 1;
        year = parseInt(dParts[2], 10) || year;
      }
    }

    if (year > 2400) year -= 543;

    const tParts = timePart.split(':');
    const hour = parseInt(tParts[0] || '0', 10);
    const min = parseInt(tParts[1] || '0', 10);
    const sec = parseInt(tParts[2] || '0', 10);

    const result = new Date(year, month - 1, day, hour, min, sec);
    if (!isNaN(result.getTime())) {
      return result;
    }
  }

  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Formats a date string into Thai short date with optional time (e.g. "26 พ.ย. 2569 เวลา 14:30 น.").
 */
export function formatThaiDateTime(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const d = parseDateRobust(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);

    const day = d.getDate();
    const month = THAI_SHORT_MONTHS[d.getMonth()];
    const year = d.getFullYear() + 543;
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    const hasTime = dateStr.includes(':') || dateStr.includes('T');
    if (hasTime && (d.getHours() > 0 || d.getMinutes() > 0)) {
      return `${day} ${month} ${year} เวลา ${hours}:${minutes} น.`;
    }
    return `${day} ${month} ${year}`;
  } catch {
    return String(dateStr);
  }
}

/**
 * Formats a date string into concise Thai date (e.g. "26 พ.ย. 69" or "26 พ.ย. 2569").
 */
export function formatThaiDateShort(
  dateStr?: string,
  options: { showYear?: boolean; shortYear?: boolean } = {}
): string {
  const { showYear = true, shortYear = false } = options;
  if (!dateStr) return '-';
  try {
    const d = parseDateRobust(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate();
    const month = THAI_SHORT_MONTHS[d.getMonth()];
    if (!showYear) return `${day} ${month}`;
    const beYear = d.getFullYear() + 543;
    const yearLabel = shortYear ? String(beYear).slice(-2) : String(beYear);
    return `${day} ${month} ${yearLabel}`;
  } catch {
    return dateStr;
  }
}
