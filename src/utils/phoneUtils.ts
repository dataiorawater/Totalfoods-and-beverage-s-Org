/**
 * Utilities for handling Thai phone numbers reliably across Google Sheets and mobile `tel:` dialing.
 *
 * Why this exists:
 * - Google Sheets treats pure digit strings like "0812345678" as Numbers and strips the leading "0" ("812345678").
 * - Prefixing with a single quote (`'0812345678`) forces Google Sheets to store the cell as Plain Text,
 *   preserving the leading zero without displaying the apostrophe in the sheet.
 * - On read, `normalizeThaiPhone` strips any leftover apostrophe and automatically restores missing leading "0"
 *   for legacy rows (9-digit Thai mobiles starting with 6/8/9, and 8-digit Thai landlines starting with 2/3/4/5/7).
 * - For calling, `toTelHref` extracts a clean dialable `tel:` URI so iOS and Android dialers work reliably.
 */

const normalizeSinglePhoneSegment = (segment: string): string => {
  const trimmed = segment.trim().replace(/^'+/, '').trim();
  if (!trimmed) return '';

  // Only auto-restore leading zero when the segment looks like a bare phone number
  // (digits with optional spaces, hyphens, dots, or parentheses — no letters/notes)
  if (/^[\d\s\-().]+$/.test(trimmed)) {
    const digits = trimmed.replace(/\D/g, '');
    // Thai mobile number whose leading 0 was stripped by Google Sheets (e.g. 812345678 -> 0812345678)
    if (digits.length === 9 && /^[689]/.test(digits)) {
      return `0${trimmed}`;
    }
    // Thai landline number whose leading 0 was stripped by Google Sheets (e.g. 21234567 -> 021234567)
    if (digits.length === 8 && /^[23457]/.test(digits)) {
      return `0${trimmed}`;
    }
  }

  // Handle patterns like "812345678 (เจ๊หมวย)" where the leading numeric token had its 0 stripped
  const leadingNumMatch = trimmed.match(/^([\d\-().]+)(\s+.+)$/);
  if (leadingNumMatch) {
    const [, numPart, rest] = leadingNumMatch;
    const digits = numPart.replace(/\D/g, '');
    if (
      (digits.length === 9 && /^[689]/.test(digits)) ||
      (digits.length === 8 && /^[23457]/.test(digits))
    ) {
      return `0${numPart}${rest}`;
    }
  }

  return trimmed;
};

/**
 * Normalizes a phone value read from Google Sheets, localStorage, or user input.
 * - Strips accidental leading apostrophes (`'`).
 * - Automatically restores missing leading `0` on Thai mobile (9->10 digits) and landline (8->9 digits) numbers.
 * - Preserves multiple numbers separated by `,`, `/`, or `;`.
 */
export const normalizeThaiPhone = (raw: unknown): string => {
  if (raw === null || raw === undefined) return '';
  const str = String(raw).trim().replace(/^'+/, '').trim();
  if (!str) return '';
  const lower = str.toLowerCase();
  if (lower === 'null' || lower === 'undefined') return '';

  // Support multiple phone numbers separated by comma, slash, or semicolon
  if (/[,/;]/.test(str)) {
    const parts = str.split(/([,/;]+)/);
    return parts
      .map((part) => {
        if (/^[,/;]+$/.test(part)) {
          return part.trim() === '/' ? ' / ' : `${part.trim()} `;
        }
        return normalizeSinglePhoneSegment(part);
      })
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return normalizeSinglePhoneSegment(str);
};

/**
 * Formats a phone number for safe storage in Google Sheets via Apps Script (`appendRow` / `updateRow`).
 * Prefixing with `'` forces Google Sheets to store the cell as Plain Text so the leading `0` is never dropped.
 */
export const formatPhoneForGoogleSheets = (raw: unknown): string => {
  const normalized = normalizeThaiPhone(raw);
  if (!normalized) return '';
  return `'${normalized}`;
};

/**
 * Converts a phone string (even with dashes, spaces, Thai notes, or multiple numbers)
 * into a clean, dialable `tel:` URI for mobile devices.
 * Returns empty string if no dialable phone number exists.
 */
export const toTelHref = (raw: unknown): string => {
  const normalized = normalizeThaiPhone(raw);
  if (!normalized) return '';

  // If multiple numbers exist (e.g. "081-234-5678, 089-999-8888"), pick the first dialable number
  const segments = normalized.split(/[,/;\n]+/).map((s) => s.trim()).filter(Boolean);
  for (const seg of segments) {
    const hasPlus = seg.startsWith('+');
    // Prefer the first contiguous phone-like sequence (ignores trailing extension or notes)
    const primaryMatch = seg.match(/^\+?[\d\s\-().]+/);
    const candidate = primaryMatch ? primaryMatch[0] : seg;
    let digits = candidate.replace(/\D/g, '');
    if (digits.length < 3) continue;

    if (!hasPlus) {
      if (digits.length === 9 && /^[689]/.test(digits)) {
        digits = `0${digits}`;
      } else if (digits.length === 8 && /^[23457]/.test(digits)) {
        digits = `0${digits}`;
      }
    }

    return `tel:${hasPlus ? '+' : ''}${digits}`;
  }

  return '';
};
