// Online order CSV & Excel parsing utilities
import { normalizeThaiPhone } from './phoneUtils';

export type OnlineDeliveryStatus = 'pending' | 'delivering' | 'completed' | 'cancelled';

export interface OnlinePostalRouteMapping {
  postalCode: string;
  routeName: string;
  driverName: string;
  notes: string;
  updatedAt?: string;
  sheetsRowIndex?: number;
}

export interface OnlineOrderRawRow {
  rowIndex: number;
  planDate?: string; // YYYY-MM-DD
  orderNumber: string;
  platform: string;
  recipientName: string;
  phone: string;
  rawPhone: string;
  address: string;
  city: string;
  buyerNote: string;
  sellerNote: string;
  orderTime: string;
  productName: string;
  sku: string;
  quantity: number;
  postalCode: string; // 5-digit zip or 'MASKED'
  rawPostalCode: string;
  isMasked: boolean;
  assignedRoute?: string;
  assignedDriver?: string;
  deliveryStatus?: OnlineDeliveryStatus;
  updatedAt?: string;
  sheetsRowIndex?: number;
  source?: 'sheets' | 'upload' | 'sample';
}

export interface OnlineOrderItem {
  productName: string;
  sku: string;
  quantity: number;
  sheetsRowIndex?: number;
}

export interface OnlineGroupedOrder {
  orderNumber: string;
  platform: string;
  recipientName: string;
  phone: string;
  address: string;
  city: string;
  buyerNote: string;
  sellerNote: string;
  orderTime: string;
  postalCode: string;
  rawPostalCode: string;
  isMasked: boolean;
  items: OnlineOrderItem[];
  totalQuantity: number;
  deliveryStatus: OnlineDeliveryStatus;
  sheetsRowIndices: number[];
  isSavedToSheets: boolean;
}

export function buildOnlineRowDedupKey(
  planDate: string,
  orderNumber: string,
  sku: string,
  productName: string
): string {
  return [
    String(planDate || '').trim(),
    String(orderNumber || '').trim().toUpperCase(),
    String(sku || '').trim().toUpperCase(),
    String(productName || '').trim().toLowerCase().slice(0, 60),
  ].join('|');
}

export function getOnlineStatusLabelThai(status?: OnlineDeliveryStatus | string): string {
  switch (status) {
    case 'delivering':
      return 'กำลังจัดส่ง';
    case 'completed':
      return 'จัดส่งสำเร็จ';
    case 'cancelled':
      return 'ยกเลิก';
    case 'pending':
    default:
      return 'รอจัดส่ง';
  }
}

export function parseOnlineStatusFromThai(raw?: string): OnlineDeliveryStatus {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'completed' || s.includes('สำเร็จ') || s.includes('เรียบร้อย')) return 'completed';
  if (s === 'delivering' || s === 'shipped' || s.includes('กำลังจัดส่ง')) return 'delivering';
  if (s === 'cancelled' || s.includes('ยกเลิก')) return 'cancelled';
  return 'pending';
}

export interface PostalCodeRouteGroup {
  postalCode: string; // 5-digit zip or 'MASKED'
  displayLabel: string;
  isMasked: boolean;
  districts: string[];
  orders: OnlineGroupedOrder[];
  rawRowCount: number;
  totalQuantity: number;
  platforms: Record<string, number>;
  skuSummary: Array<{ sku: string; productName: string; quantity: number }>;
  suggestedZone: string;
}

export const SAMPLE_ONLINE_CSV_PATH =
  '/assets/aistudio/Order-SKU-inprocess20260715090107415_8f963418.csv';

/**
 * Common Thai postal code area hints (Bangkok & Samut Prakan focus)
 * Used alongside district names parsed directly from the uploaded CSV.
 */
const POSTAL_ZONE_HINTS: Record<string, string> = {
  '10100': 'โซนพระนคร-ป้อมปราบ-สัมพันธวงศ์',
  '10110': 'โซนวัฒนา-คลองเตย',
  '10120': 'โซนยานนาวา-บางคอแหลม-สาทร',
  '10130': 'โซนพระประแดง (สมุทรปราการ)',
  '10140': 'โซนราษฎร์บูรณะ-ทุ่งครุ',
  '10150': 'โซนบางขุนเทียน-จอมทอง-บางบอน',
  '10160': 'โซนภาษีเจริญ-บางแค-หนองแขม',
  '10170': 'โซนตลิ่งชัน-ทวีวัฒนา',
  '10200': 'โซนพระนคร',
  '10210': 'โซนหลักสี่-ดอนเมือง',
  '10220': 'โซนบางเขน-สายไหม',
  '10230': 'โซนลาดพร้าว-คันนายาว-บึงกุ่ม',
  '10240': 'โซนบางกะปิ-บึงกุ่ม-สะพานสูง',
  '10250': 'โซนสวนหลวง-ประเวศ',
  '10260': 'โซนบางนา-พระโขนง',
  '10270': 'โซนเมืองสมุทรปราการ',
  '10280': 'โซนบางปู-เมืองสมุทรปราการ',
  '10290': 'โซนพระสมุทรเจดีย์',
  '10300': 'โซนดุสิต',
  '10310': 'โซนวังทองหลาง-ห้วยขวาง',
  '10320': 'โซนห้วยขวาง-ดินแดง',
  '10330': 'โซนปทุมวัน',
  '10400': 'โซนราชเทวี-พญาไท-ดินแดง',
  '10500': 'โซนบางรัก',
  '10510': 'โซนคลองสามวา-มีนบุรี',
  '10520': 'โซนลาดกระบัง',
  '10530': 'โซนหนองจอก',
  '10540': 'โซนบางพลี-บางเสาธง (สมุทรปราการ)',
  '10560': 'โซนบางบ่อ (สมุทรปราการ)',
  '10600': 'โซนธนบุรี-คลองสาน-บางกอกใหญ่',
  '10700': 'โซนบางกอกน้อย-บางพลัด',
  '10800': 'โซนบางซื่อ',
  '10900': 'โซนจตุจักร',
};

export function getSuggestedZoneForPostalCode(postalCode: string): string {
  if (postalCode === 'MASKED') return 'รอข้อมูลรหัสไปรษณีย์ (ปกปิด)';
  return POSTAL_ZONE_HINTS[postalCode] || `สายรหัสไปรษณีย์ ${postalCode}`;
}

/**
 * Decodes an ArrayBuffer from an uploaded CSV file, automatically detecting
 * UTF-8 (with or without BOM) vs Windows-874 / TIS-620 Thai encoding.
 */
export function decodeCsvBuffer(buffer: ArrayBuffer): { text: string; encoding: 'utf-8' | 'windows-874' } {
  const bytes = new Uint8Array(buffer);
  // Check UTF-8 BOM (EF BB BF)
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    const utf8Text = new TextDecoder('utf-8').decode(bytes.subarray(3));
    return { text: utf8Text, encoding: 'utf-8' };
  }

  const utf8Text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const replacementCount = (utf8Text.match(/\uFFFD/g) || []).length;

  // If UTF-8 produced replacement characters, decode with Windows-874 (TIS-620 Thai)
  if (replacementCount > 0) {
    try {
      const thaiText = new TextDecoder('windows-874').decode(bytes);
      return { text: thaiText, encoding: 'windows-874' };
    } catch {
      return { text: utf8Text, encoding: 'utf-8' };
    }
  }

  return { text: utf8Text, encoding: 'utf-8' };
}

/**
 * Standard RFC-4180 CSV parser supporting quoted fields, embedded commas, and newlines.
 */
export function parseCsvMatrix(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    if (inQuotes) {
      if (ch === '"' && csvText[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(current);
        current = '';
      } else if (ch === '\r') {
        // ignore CR
      } else if (ch === '\n') {
        row.push(current);
        rows.push(row);
        row = [];
        current = '';
      } else {
        current += ch;
      }
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

function cleanStrayTrailingParen(val: string): string {
  const trimmed = val.trim();
  if (!trimmed) return '';
  if (trimmed.endsWith(')') && !trimmed.includes('(')) {
    return trimmed.slice(0, -1).trim();
  }
  const openCount = (trimmed.match(/\(/g) || []).length;
  const closeCount = (trimmed.match(/\)/g) || []).length;
  if (trimmed.endsWith(')') && closeCount === openCount + 1) {
    return trimmed.slice(0, -1).trim();
  }
  return trimmed;
}

function cleanOnlinePhone(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || /^\*+$/.test(trimmed)) return trimmed;
  // Convert patterns like "66909055613", "660644263562", "(+66)0819106401" to standard Thai 0-prefixed format
  let cleaned = trimmed.replace(/^\(\+?66\)\s*/, '0').replace(/^\+66\s*/, '0');
  const digitsOnly = cleaned.replace(/\D/g, '');
  if (digitsOnly.startsWith('660') && digitsOnly.length === 12) {
    return `0${digitsOnly.slice(3)}`;
  }
  if (digitsOnly.startsWith('66') && (digitsOnly.length === 11 || digitsOnly.length === 10)) {
    return `0${digitsOnly.slice(2)}`;
  }
  if (digitsOnly.startsWith('00') && digitsOnly.length === 11) {
    return digitsOnly.slice(1);
  }
  return normalizeThaiPhone(cleaned);
}

function extractPostalCode(rawZip: string, address: string): { postalCode: string; isMasked: boolean } {
  const cleanZip = rawZip.trim();
  const directMatch = cleanZip.match(/\b([1-9]\d{4})\b/);
  if (directMatch) {
    return { postalCode: directMatch[1], isMasked: false };
  }
  // Fallback: inspect shipping address for 5-digit Thai postal code
  const addrMatch = address.match(/\b([1-9]\d{4})\b(?!.*\b[1-9]\d{4}\b)/);
  if (addrMatch) {
    return { postalCode: addrMatch[1], isMasked: false };
  }
  return { postalCode: 'MASKED', isMasked: true };
}

export function parseOnlineOrdersFromMatrix(rawMatrix: unknown[][]): {
  headers: string[];
  rows: OnlineOrderRawRow[];
} {
  const matrix: string[][] = rawMatrix
    .map((row) =>
      Array.isArray(row) ? row.map((cell) => String(cell ?? '').trim()) : []
    )
    .filter((row) => row.some((cell) => cell !== ''));

  if (matrix.length <= 1) {
    return { headers: matrix[0] || [], rows: [] };
  }

  // Locate header row within the first 5 non-empty rows (handles Excel files with title banners)
  const headerKeywords = [
    'หมายเลขคำสั่งซื้อ',
    'เลขที่คำสั่งซื้อ',
    'order',
    'ชื่อผู้รับ',
    'รหัสไปรษณีย์',
    'postal',
    'zip',
    'sku',
    'แพลตฟอร์ม',
  ];
  let headerRowIdx = 0;
  for (let rIdx = 0; rIdx < Math.min(5, matrix.length - 1); rIdx++) {
    const rowLower = matrix[rIdx].map((c) => c.toLowerCase());
    const hits = headerKeywords.filter((kw) =>
      rowLower.some((cell) => cell.includes(kw.toLowerCase()))
    ).length;
    if (hits >= 2) {
      headerRowIdx = rIdx;
      break;
    }
  }

  const headers = matrix[headerRowIdx].map((h) => h.trim());
  const dataRows = matrix.slice(headerRowIdx + 1);

  const findCol = (keywords: string[], fallbackIdx: number): number => {
    const idx = headers.findIndex((h) => {
      const lower = h.toLowerCase();
      return keywords.some((kw) => lower.includes(kw.toLowerCase()));
    });
    return idx !== -1 ? idx : fallbackIdx;
  };

  const colOrderNo = findCol(['หมายเลขคำสั่งซื้อ', 'order', 'เลขที่คำสั่งซื้อ'], 0);
  const colPlatform = findCol(['แพลตฟอร์ม', 'platform', 'ช่องทาง'], 1);
  const colRecipient = findCol(['ชื่อผู้รับ', 'recipient', 'ชื่อลูกค้า'], 2);
  const colPhone = findCol(['เบอร์โทรศัพท์', 'เบอร์โทร', 'phone', 'tel'], 3);
  const colAddress = findCol(['ที่อยู่รับสินค้า', 'ที่อยู่', 'address'], 4);
  const colCity = findCol(['เมือง', 'เขต', 'อำเภอ', 'city', 'district'], 5);
  const colBuyerNote = findCol(['หมายเหตุผู้ซื้อ', 'buyer'], 6);
  const colSellerNote = findCol(['หมายเหตุผู้ขาย', 'seller'], 7);
  const colOrderTime = findCol(['เวลาสั่งซื้อ', 'วันที่สั่งซื้อ', 'time', 'date'], 8);
  const colProduct = findCol(['ชื่อสินค้า', 'product', 'รายการสินค้า'], 9);
  const colSku = findCol(['sku', 'รหัสสินค้า'], 10);
  const colQty = findCol(['จำนวน', 'qty', 'quantity'], 11);
  const colZip = findCol(['รหัสไปรษณีย์', 'postal', 'zip'], 12);

  const parsedRows: OnlineOrderRawRow[] = dataRows.map((cols, idx) => {
    const rawOrder = (cols[colOrderNo] || '').replace(/^'+/, '').trim();
    const rawPlatform = (cols[colPlatform] || '').trim() || 'ออนไลน์';
    const rawRecipient = cleanStrayTrailingParen(cols[colRecipient] || '');
    const rawPhone = (cols[colPhone] || '').replace(/^'+/, '').trim();
    const rawAddress = cleanStrayTrailingParen(cols[colAddress] || '');
    const rawCity = (cols[colCity] || '').trim();
    const rawBuyerNote = (cols[colBuyerNote] || '').trim();
    const rawSellerNote = (cols[colSellerNote] || '').trim();
    const rawOrderTime = (cols[colOrderTime] || '').replace(/^'+/, '').trim();
    const rawProduct = (cols[colProduct] || '').trim();
    const rawSku = (cols[colSku] || '').replace(/^'+/, '').trim();
    const qty = Math.max(1, parseInt((cols[colQty] || '1').replace(/[^0-9]/g, ''), 10) || 1);
    const rawPostalCode = (cols[colZip] || '').replace(/^'+/, '').trim();

    const { postalCode, isMasked } = extractPostalCode(rawPostalCode, rawAddress);

    return {
      rowIndex: idx + 1,
      orderNumber: rawOrder || `ONLINE-${idx + 1}`,
      platform: rawPlatform,
      recipientName: rawRecipient,
      phone: cleanOnlinePhone(rawPhone),
      rawPhone,
      address: rawAddress,
      city: rawCity,
      buyerNote: rawBuyerNote,
      sellerNote: rawSellerNote,
      orderTime: rawOrderTime,
      productName: rawProduct,
      sku: rawSku,
      quantity: qty,
      postalCode,
      rawPostalCode,
      isMasked,
    };
  });

  return { headers, rows: parsedRows };
}

export function parseOnlineOrdersFromCsv(csvText: string): {
  headers: string[];
  rows: OnlineOrderRawRow[];
} {
  const matrix = parseCsvMatrix(csvText);
  return parseOnlineOrdersFromMatrix(matrix);
}

/**
 * Unified parser supporting both Excel (.xlsx / .xls) and CSV (UTF-8 / Windows-874) files.
 */
export async function parseOnlineOrdersFromFileBuffer(
  buffer: ArrayBuffer,
  fileName: string
): Promise<{
  headers: string[];
  rows: OnlineOrderRawRow[];
  formatLabel: string;
}> {
  const lower = fileName.toLowerCase();
  const bytes = new Uint8Array(buffer);
  const isZipMagic = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  const isOleMagic = bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
  const isExcel = lower.endsWith('.xlsx') || lower.endsWith('.xls') || isZipMagic || isOleMagic;

  if (isExcel) {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'array' });
    let bestMatrix: unknown[][] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        raw: false,
        defval: '',
      });
      if (matrix.length > 1) {
        bestMatrix = matrix;
        break;
      }
      if (matrix.length > bestMatrix.length) {
        bestMatrix = matrix;
      }
    }

    const { headers, rows } = parseOnlineOrdersFromMatrix(bestMatrix);
    const extLabel = lower.endsWith('.xls') && !lower.endsWith('.xlsx') ? 'EXCEL (XLS)' : 'EXCEL (XLSX)';
    return { headers, rows, formatLabel: extLabel };
  }

  const { text, encoding } = decodeCsvBuffer(buffer);
  const { headers, rows } = parseOnlineOrdersFromCsv(text);
  return { headers, rows, formatLabel: `CSV (${encoding.toUpperCase()})` };
}

export function groupOnlineOrdersByPostalCode(rows: OnlineOrderRawRow[]): {
  groupedOrders: OnlineGroupedOrder[];
  postalGroups: PostalCodeRouteGroup[];
} {
  // 1. Merge multi-SKU rows under the same orderNumber
  const orderMap = new Map<string, OnlineGroupedOrder>();
  const rowCountByZip = new Map<string, number>();

  for (const row of rows) {
    rowCountByZip.set(row.postalCode, (rowCountByZip.get(row.postalCode) || 0) + 1);

    const existing = orderMap.get(row.orderNumber);
    if (!existing) {
      orderMap.set(row.orderNumber, {
        orderNumber: row.orderNumber,
        platform: row.platform,
        recipientName: row.recipientName,
        phone: row.phone,
        address: row.address,
        city: row.city,
        buyerNote: row.buyerNote,
        sellerNote: row.sellerNote,
        orderTime: row.orderTime,
        postalCode: row.postalCode,
        rawPostalCode: row.rawPostalCode,
        isMasked: row.isMasked,
        items: [
          {
            productName: row.productName,
            sku: row.sku,
            quantity: row.quantity,
            sheetsRowIndex: row.sheetsRowIndex,
          },
        ],
        totalQuantity: row.quantity,
        deliveryStatus: row.deliveryStatus || 'pending',
        sheetsRowIndices: row.sheetsRowIndex ? [row.sheetsRowIndex] : [],
        isSavedToSheets: Boolean(row.sheetsRowIndex),
      });
    } else {
      existing.items.push({
        productName: row.productName,
        sku: row.sku,
        quantity: row.quantity,
        sheetsRowIndex: row.sheetsRowIndex,
      });
      existing.totalQuantity += row.quantity;
      if (row.sheetsRowIndex) {
        existing.sheetsRowIndices.push(row.sheetsRowIndex);
        existing.isSavedToSheets = true;
      }
      if (row.deliveryStatus && existing.deliveryStatus === 'pending' && row.deliveryStatus !== 'pending') {
        existing.deliveryStatus = row.deliveryStatus;
      }
      if (existing.isMasked && !row.isMasked) {
        existing.postalCode = row.postalCode;
        existing.rawPostalCode = row.rawPostalCode;
        existing.isMasked = false;
      }
      if (!existing.buyerNote && row.buyerNote) existing.buyerNote = row.buyerNote;
      if (!existing.sellerNote && row.sellerNote) existing.sellerNote = row.sellerNote;
    }
  }

  const groupedOrders = Array.from(orderMap.values());

  // 2. Group orders by Postal Code
  const zipMap = new Map<string, OnlineGroupedOrder[]>();
  for (const ord of groupedOrders) {
    const list = zipMap.get(ord.postalCode) || [];
    list.push(ord);
    zipMap.set(ord.postalCode, list);
  }

  const postalGroups: PostalCodeRouteGroup[] = Array.from(zipMap.entries()).map(
    ([postalCode, orders]) => {
      const isMasked = postalCode === 'MASKED';
      const districtSet = new Set<string>();
      const platforms: Record<string, number> = {};
      const skuMap = new Map<string, { sku: string; productName: string; quantity: number }>();
      let totalQuantity = 0;

      for (const ord of orders) {
        if (ord.city && !/^\*+$/.test(ord.city)) {
          // Clean bilingual city label like "สายไหม/ Sai Mai" -> keep clean readable Thai
          const cleanCity = ord.city.split('/')[0].trim();
          if (cleanCity) districtSet.add(cleanCity);
        }
        platforms[ord.platform] = (platforms[ord.platform] || 0) + 1;
        totalQuantity += ord.totalQuantity;

        for (const item of ord.items) {
          const skuKey = item.sku || item.productName || 'UNKNOWN';
          const prev = skuMap.get(skuKey);
          if (prev) {
            prev.quantity += item.quantity;
          } else {
            skuMap.set(skuKey, {
              sku: item.sku || '-',
              productName: item.productName,
              quantity: item.quantity,
            });
          }
        }
      }

      const skuSummary = Array.from(skuMap.values()).sort((a, b) => b.quantity - a.quantity);

      return {
        postalCode,
        displayLabel: isMasked ? 'ยังไม่ระบุรหัสไปรษณีย์ (****)' : `สายรหัส ${postalCode}`,
        isMasked,
        districts: Array.from(districtSet),
        orders,
        rawRowCount: rowCountByZip.get(postalCode) || orders.length,
        totalQuantity,
        platforms,
        skuSummary,
        suggestedZone: getSuggestedZoneForPostalCode(postalCode),
      };
    }
  );

  // Sort: valid 5-digit postal codes first (by order count descending, then zip ascending); masked group at bottom
  postalGroups.sort((a, b) => {
    if (a.isMasked !== b.isMasked) return a.isMasked ? 1 : -1;
    if (b.orders.length !== a.orders.length) return b.orders.length - a.orders.length;
    return a.postalCode.localeCompare(b.postalCode);
  });

  return { groupedOrders, postalGroups };
}

/**
 * Exports rows with their assigned delivery route to UTF-8 BOM CSV (Excel-friendly Thai).
 */
export function buildExportOnlinePlanCsv(
  rows: OnlineOrderRawRow[],
  routeAssignments: Record<string, string>,
  driverAssignments: Record<string, string> = {}
): string {
  const escapeCell = (val: unknown) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const headers = [
    'วันที่จัดส่ง',
    'สายจัดส่ง (ตามรหัสไปรษณีย์)',
    'พนักงานขับรถ',
    'สถานะจัดส่ง',
    'รหัสไปรษณีย์',
    'หมายเลขคำสั่งซื้อ',
    'แพลตฟอร์ม',
    'ชื่อผู้รับ',
    'เบอร์โทรศัพท์',
    'ที่อยู่รับสินค้า',
    'เมือง/เขต',
    'หมายเหตุผู้ซื้อ',
    'หมายเหตุผู้ขาย',
    'เวลาสั่งซื้อ',
    'ชื่อสินค้า',
    'SKU',
    'จำนวน',
  ];

  const sortedRows = [...rows].sort((a, b) => {
    const routeA = routeAssignments[a.postalCode] || a.assignedRoute || (a.isMasked ? 'ZZZ-รอตรวจสอบ' : `สาย ${a.postalCode}`);
    const routeB = routeAssignments[b.postalCode] || b.assignedRoute || (b.isMasked ? 'ZZZ-รอตรวจสอบ' : `สาย ${b.postalCode}`);
    if (routeA !== routeB) return routeA.localeCompare(routeB, 'th');
    return a.postalCode.localeCompare(b.postalCode);
  });

  const lines = [
    headers.map(escapeCell).join(','),
    ...sortedRows.map((r) => {
      const assigned =
        routeAssignments[r.postalCode] ||
        r.assignedRoute ||
        (r.isMasked ? 'รอตรวจสอบรหัสไปรษณีย์' : `สาย ${r.postalCode}`);
      const driver = driverAssignments[r.postalCode] || r.assignedDriver || '';
      return [
        r.planDate || '',
        assigned,
        driver,
        getOnlineStatusLabelThai(r.deliveryStatus),
        r.isMasked ? '****' : r.postalCode,
        r.orderNumber,
        r.platform,
        r.recipientName,
        r.phone ? `'${r.phone}` : '',
        r.address,
        r.city,
        r.buyerNote,
        r.sellerNote,
        r.orderTime,
        r.productName,
        r.sku,
        r.quantity,
      ]
        .map(escapeCell)
        .join(',');
    }),
  ];

  return `\uFEFF${lines.join('\r\n')}`;
}
