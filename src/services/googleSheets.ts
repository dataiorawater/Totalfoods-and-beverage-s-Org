import { Order, OrderItem, FreebieItem, Route, StaffUser, Product, Customer, StoreCheckIn, Expense } from '../types';

export const USERS_TAB_NAME = 'Users';
export const ORDERS_TAB_NAME = 'Orders';
export const PRODUCTS_TAB_NAME = 'Products';
export const CUSTOMERS_TAB_NAME = 'Customers';
export const ROUTES_TAB_NAME = 'routes';
export const CHECKIN_TAB_NAME = 'CheckIn';
export const EXPENSES_TAB_NAME = 'Expenses';

// หัวคอลัมภ์มาตรฐาน 18 คอลัมน์สำหรับฐานข้อมูลออเดอร์ ตรงกับโครงสร้างข้อมูล 100%
export const ORDER_HEADERS_CANONICAL = [
  'เลขที่ออเดอร์',
  'วันที่',
  'เวลา',
  'รหัสพนักงานขาย',
  'ชื่อพนักงานขาย',
  'ชื่อลูกค้า',
  'เบอร์ติดต่อ',
  'วันที่ต้องการให้ส่ง',
  'รายการสินค้า',
  'จำนวน',
  'ยอดรวมก่อนลด',
  'ส่วนลด',
  'ยอดเงินสุทธิ',
  'วิธีชำระเงิน',
  'หมายเหตุ',
  'พิกัดแผนที่',
  'สถานะ',
  'อัปเดตล่าสุด'
];

export const ORDER_HEADERS_ENGLISH = [
  'orderNumber',
  'date',
  'time',
  'salespersonId',
  'salespersonName',
  'customerName',
  'customerPhone',
  'requestedDeliveryDate',
  'itemName',
  'quantity',
  'totalAmount',
  'discount',
  'netAmount',
  'paymentMethod',
  'note',
  'mapsUrl',
  'status',
  'updatedAt'
];

const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbzfqWujgz3EhJJ4fJ6DEf6J6RibJvyp_b8QA2OwVAhN1WG4gVEr2OnrOXtqvJnJqMU9/exec';

export const testGasConnection = async (
  testUrl?: string
): Promise<{ success: boolean; message: string; isHtml?: boolean }> => {
  let url = testUrl;
  if (!url) {
    try {
      const savedConfig = localStorage.getItem('iora_sheets_config');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        url = parsed.gasUrl;
      }
    } catch (e) {}
  }
  if (!url) {
    url = DEFAULT_GAS_URL;
  }
  if (!url || !url.trim()) {
    return { success: false, message: 'ยังไม่ได้ระบุ Google Apps Script URL' };
  }
  try {
    const res = await fetch(url.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'ping' }),
    });
    const text = await res.text();
    if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
      return {
        success: false,
        isHtml: true,
        message:
          "GAS ส่งหน้าเว็บล็อกอิน (HTML) กลับมา: โปรดไปที่ Apps Script แล้วตั้งค่า 'Who has access' เป็น 'Anyone' (ทุกคน) แล้ว Deploy ใหม่",
      };
    }
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      return {
        success: false,
        message: 'การตอบกลับไม่ใช่ JSON (ตรวจพบข้อความ): ' + text.substring(0, 80),
      };
    }
    if (json.error && json.error !== 'Invalid action') {
      return { success: false, message: json.error };
    }
    return { success: true, message: 'เชื่อมต่อกับ Google Apps Script สำเร็จเรียบร้อย!' };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'ไม่สามารถติดต่อ Google Apps Script ได้ โปรดตรวจสอบ URL',
    };
  }
};

const gasRequest = async (spreadsheetId: string, action: string, sheet?: string, rowIndex?: number, rowData?: any[], extraPayload?: any) => {
  let gasUrlToUse = DEFAULT_GAS_URL;
  try {
    const savedConfig = localStorage.getItem('iora_sheets_config');
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      if (parsed.gasUrl) {
        gasUrlToUse = parsed.gasUrl;
      }
    }
  } catch (e) {
    // Ignore error reading from localStorage
  }
  const payload: any = { action, spreadsheetId, ...extraPayload };
  if (sheet) payload.sheet = sheet;
  if (rowIndex !== undefined) payload.rowIndex = rowIndex;
  if (rowData !== undefined) payload.rowData = rowData;
  
  try {
    const res = await fetch(gasUrlToUse, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      if (text.includes("<!DOCTYPE html>") || text.includes("<html")) {
         console.warn("[GAS Warning] Google Apps Script URL returned an HTML login page instead of JSON. Ensure 'Who has access' is set to 'Anyone'.");
         const htmlErr: any = new Error("GAS_HTML_LOGIN_REQUIRED");
         htmlErr.code = "GAS_HTML_LOGIN_REQUIRED";
         htmlErr.details = "ระบบตรวจพบการตั้งค่า GAS คืนค่าเป็นหน้าเว็บ (HTML)\nโปรดกลับไปตั้งค่า 'Who has access' (ผู้ที่มีสิทธิ์เข้าถึง) ใน Apps Script ให้เป็น 'Anyone' (ทุกคน) แล้ว Deploy ใหม่";
         throw htmlErr;
      }
      const jsonErr: any = new Error("GAS_INVALID_JSON");
      jsonErr.details = "การรับส่งข้อมูลผิดพลาด (ไม่ได้ส่งกลับเป็น JSON): " + text.substring(0, 100);
      throw jsonErr;
    }
    if (json.error) {
      throw new Error(json.error);
    }
    return json;
  } catch (err: any) {
    if (err.message !== "Invalid action" && err.message !== "GAS_HTML_LOGIN_REQUIRED") {
      console.warn("[GAS Notice]", err.message || err);
    }
    if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
      const fetchErr: any = new Error("GAS_FAILED_TO_FETCH");
      fetchErr.details = "Failed to fetch: ไม่สามารถเชื่อมต่อกับ Google Apps Script ได้ โปรดตรวจสอบ GAS URL ในเมนูตั้งค่า และตรวจให้แน่ใจว่าตอน Deploy ได้ตั้งค่า 'Who has access' เป็น 'Anyone' (ทุกคน)";
      throw fetchErr;
    }
    throw err;
  }
};

export const getStatusLabelThai = (status: any): string => {
  switch (status) {
    case 'pending': return 'รอดำเนินการ';
    case 'confirmed': return 'ยืนยันแล้ว';
    case 'delivering': return 'กำลังจัดส่ง'; // fallback
    case 'shipped': return 'กำลังจัดส่ง';
    case 'completed': return 'จัดส่งสำเร็จ'; // fallback
    case 'delivered': return 'จัดส่งสำเร็จ';
    case 'cancelled': return 'ยกเลิก';
    default: return 'รอดำเนินการ';
  }
};


export const fixAndAlignOrderHeaders = async (
  spreadsheetId: string,
  sheetName = ORDERS_TAB_NAME
): Promise<{ success: boolean; message: string }> => {
  try {
    // 1. ตรวจสอบ/สร้างแท็บชีต
    await gasRequest(spreadsheetId, 'addSheet', sheetName);

    // 2. ดึงข้อมูลชีตปัจจุบัน
    const res = await gasRequest(spreadsheetId, 'getData', sheetName);

    if (!res || !res.values || res.values.length === 0) {
      // แผ่นงานว่างเปล่า ให้สร้างแถวที่ 1 ด้วย 18 หัวคอลัมภ์มาตรฐาน
      await gasRequest(spreadsheetId, 'appendRow', sheetName, undefined, ORDER_HEADERS_CANONICAL);
      return {
        success: true,
        message: `สร้างและใส่หัวคอลัมภ์ทั้ง 18 คอลัมน์ในแท็บ "${sheetName}" เรียบร้อยแล้ว`,
      };
    } else {
      // มีข้อมูลอยู่แล้ว ให้ปรับปรุงแถวที่ 1 (Row 1) ให้เป็นหัวคอลัมภ์มาตรฐาน
      await gasRequest(spreadsheetId, 'updateRow', sheetName, 1, ORDER_HEADERS_CANONICAL);
      return {
        success: true,
        message: `ปรับปรุงหัวคอลัมภ์ทั้ง 18 คอลัมน์ในแถวที่ 1 ของแท็บ "${sheetName}" ให้ตรงกับข้อมูลที่บันทึกเรียบร้อยแล้ว`,
      };
    }
  } catch (err: any) {
    console.error('fixAndAlignOrderHeaders error:', err);
    throw new Error(`ไม่สามารถปรับปรุงหัวคอลัมภ์ได้: ${err.message || err}`);
  }
};

export const migrateOrderHeaders = async (id: string, sheetName = ORDERS_TAB_NAME) => {
  return await fixAndAlignOrderHeaders(id, sheetName);
};

export const migrateRouteHeaders = async (id: string) => {
  const res = await gasRequest(id, 'getData', ROUTES_TAB_NAME);
  if (!res || !res.values || res.values.length === 0) {
    await gasRequest(id, 'appendRow', ROUTES_TAB_NAME, undefined, ['id', 'name', 'salesrepName', 'notes']);
  } else {
    await gasRequest(id, 'updateRow', ROUTES_TAB_NAME, 1, ['id', 'name', 'salesrepName', 'notes']);
  }
};

export const ensureAllSheetsTabs = async (spreadsheetId: string, customOrderSheet = ORDERS_TAB_NAME) => {
  const tabs = [
    {
      name: USERS_TAB_NAME,
      headers: ['id', 'name', 'email', 'role', 'phone', 'password', 'status', 'createdAt', 'lastLogin'],
    },
    {
      name: customOrderSheet || ORDERS_TAB_NAME,
      headers: ORDER_HEADERS_CANONICAL,
    },
    {
      name: PRODUCTS_TAB_NAME,
      headers: ['id', 'name', 'sku', 'category', 'price', 'unit', 'stock', 'imageUrl'],
    },
    {
      name: CUSTOMERS_TAB_NAME,
      headers: ['id', 'name', 'phone', 'address', 'routeName', 'mapsUrl', 'latitude', 'longitude', 'notes', 'updatedAt'],
    },
    {
      name: ROUTES_TAB_NAME,
      headers: ['id', 'name', 'salesrepName', 'notes'],
    },
    {
      name: CHECKIN_TAB_NAME,
      headers: [
        'id',
        'createdAt',
        'timestampStr',
        'storeName',
        'customerPhone',
        'address',
        'salespersonName',
        'latitude',
        'longitude',
        'mapsUrl',
        'photoUrl',
        'notes',
        'distanceMeters',
      ],
    },
    {
      name: EXPENSES_TAB_NAME,
      headers: [
        'id',
        'createdAt',
        'date',
        'salespersonId',
        'salespersonName',
        'expenseType',
        'amount',
        'receiptUrl',
        'note',
        'status',
        'startMileage',
        'endMileage',
        'distance',
        'startMileagePhoto',
        'endMileagePhoto',
      ],
    },
  ];

  for (const tab of tabs) {
    try {
      await gasRequest(spreadsheetId, 'addSheet', tab.name);
      const res = await gasRequest(spreadsheetId, 'getData', tab.name);
      if (!res || !res.values || res.values.length === 0) {
        await gasRequest(spreadsheetId, 'appendRow', tab.name, undefined, tab.headers);
      } else if (tab.name === (customOrderSheet || ORDERS_TAB_NAME) || tab.name === ORDERS_TAB_NAME) {
        // ตรวจสอบว่าหัวคอลัมภ์เดิมไม่ตรงหรือไม่ เช่น เริ่มด้วย 'id' หรือมีคำว่า 'items' ก่อน total
        const row0 = res.values[0] || [];
        const firstCell = String(row0[0] || '').trim().toLowerCase();
        const secondCell = String(row0[1] || '').trim().toLowerCase();
        const sixthCell = String(row0[6] || '').trim().toLowerCase();
        
        // ถ้าแถวที่ 1 เป็นหัวคอลัมภ์แบบเก่า หรือไม่ตรงกับข้อมูล
        if (
          (firstCell === 'id' && (secondCell === 'ordernumber' || secondCell === 'order_number')) ||
          sixthCell === 'items'
        ) {
          console.info(`[GoogleSheets] Auto-repairing mismatched order headers in tab "${tab.name}"...`);
          await gasRequest(spreadsheetId, 'updateRow', tab.name, 1, tab.headers);
        }
      }
    } catch (e) {
      console.warn(`[ensureAllSheetsTabs] Warning for tab ${tab.name}:`, e);
    }
  }
};


// USERS
export const fetchUsersFromSheets = async (id: string): Promise<StaffUser[]> => {
  const res = await gasRequest(id, 'getData', USERS_TAB_NAME);
  if (!res || !res.values || res.values.length <= 1) return [];
  const rows = res.values.slice(1);
  return rows.map((row: any, idx: number) => ({
    sheetsRowIndex: idx + 2,
    id: row[0] ? String(row[0]) : 'user-' + idx, name: String(row[1] || ''), email: String(row[2] || ''), role: String(row[3] || 'viewer'), phone: String(row[4] || ''), password: String(row[5] || ''), status: String(row[6] || 'active'), createdAt: String(row[7] || ''), lastLogin: String(row[8] || '')
  }));
};

export const saveUserToSheet = async (id: string, u: StaffUser) => {
  const rowData = [u.id || Date.now().toString(), u.name || '', u.email || '', u.role || 'viewer', u.phone || '', u.password || '', u.status || 'active', u.createdAt || new Date().toISOString(), u.lastLogin || ''];
  const existing = await fetchUsersFromSheets(id);
  const found = existing.find(x => x.id === u.id);
  if (found && (found as any).sheetsRowIndex) {
    await gasRequest(id, 'updateRow', USERS_TAB_NAME, (found as any).sheetsRowIndex, rowData);
  } else {
    await gasRequest(id, 'appendRow', USERS_TAB_NAME, undefined, rowData);
  }
};

export const recordUserLoginInSheet = async (id: string, email: string) => {
  const existing = await fetchUsersFromSheets(id);
  const u = existing.find(x => x.email === email);
  if (u) {
  u.lastLogin = new Date().toISOString();
  await saveUserToSheet(id, u);
  }
};

export const setUserPasswordInSheet = async (id: string, email: string, p: string): Promise<boolean> => {
  const existing = await fetchUsersFromSheets(id);
  const found = existing.find(x => x.email.trim().toLowerCase() === email.trim().toLowerCase());
  if (found) {
    found.password = p;
    await saveUserToSheet(id, found);
    return true;
  }
  return false;
};

// ROUTES
export const fetchRoutesFromSheet = async (id: string): Promise<Route[]> => {
  const res = await gasRequest(id, 'getData', ROUTES_TAB_NAME);
  if (!res || !res.values || res.values.length <= 1) return [];
  return res.values.slice(1).map((row: any, idx: number) => ({
    sheetsRowIndex: idx + 2,
    id: row[0] ? String(row[0]) : 'row-' + idx,
    name: row[1] || '',
    salesrepName: row[2] || '',
    notes: row[3] || ''
  }));
};

export const saveRouteToSheet = async (id: string, r: Route) => {
  const rowData = [r.id || Date.now().toString(), r.name || '', r.salesrepName || '', r.notes || ''];
  const existing = await fetchRoutesFromSheet(id);
  const found = existing.find(x => x.id === r.id);
  if (found && (found as any).sheetsRowIndex) {
    await gasRequest(id, 'updateRow', ROUTES_TAB_NAME, (found as any).sheetsRowIndex, rowData);
  } else {
    await gasRequest(id, 'appendRow', ROUTES_TAB_NAME, undefined, rowData);
  }
};

export const deleteRouteFromSheet = async (id: string, routeId: string) => {
  const existing = await fetchRoutesFromSheet(id);
  const found = existing.find(x => x.id === routeId);
  if (found && (found as any).sheetsRowIndex) {
    await gasRequest(id, 'deleteRow', ROUTES_TAB_NAME, (found as any).sheetsRowIndex);
  }
};

// CUSTOMERS
export const fetchCustomersFromSheet = async (id: string): Promise<Customer[]> => {
  const res = await gasRequest(id, 'getData', CUSTOMERS_TAB_NAME);
  if (!res || !res.values || res.values.length <= 1) return [];
  return res.values.slice(1).map((row: any, idx: number) => ({
    sheetsRowIndex: idx + 2,
    id: row[0] ? String(row[0]) : 'row-' + idx,
    name: row[1] || '',
    phone: row[2] || '',
    address: row[3] || '',
    routeName: row[4] || '',
    mapsUrl: row[5] || '',
    latitude: parseFloat(row[6]) || undefined,
    longitude: parseFloat(row[7]) || undefined,
    notes: row[8] || '',
    updatedAt: row[9] || ''
  }));
};

export const saveCustomerToSheet = async (id: string, c: Customer) => {
  const rowData = [
    c.id || Date.now().toString(), c.name || '', c.phone || '', c.address || '', 
    c.routeName || '', c.mapsUrl || '', c.latitude || '', c.longitude || '', 
    c.notes || '', c.updatedAt || new Date().toISOString()
  ];
  const existing = await fetchCustomersFromSheet(id);
  const found = existing.find(x => x.id === c.id);
  if (found && (found as any).sheetsRowIndex) {
    await gasRequest(id, 'updateRow', CUSTOMERS_TAB_NAME, (found as any).sheetsRowIndex, rowData);
  } else {
    await gasRequest(id, 'appendRow', CUSTOMERS_TAB_NAME, undefined, rowData);
  }
};

// PRODUCTS
export const fetchProductsFromSheet = async (id: string): Promise<Product[]> => {
  const res = await gasRequest(id, 'getData', PRODUCTS_TAB_NAME);
  if (!res || !res.values || res.values.length <= 1) return [];
  return res.values.slice(1).map((row: any, idx: number) => ({
    sheetsRowIndex: idx + 2,
    id: row[0] ? String(row[0]) : 'row-' + idx,
    name: row[1] || '',
    sku: row[2] || '',
    category: row[3] || '',
    price: parseFloat(row[4]) || 0,
    unit: row[5] || '',
    stock: parseInt(row[6]) || 0,
    imageUrl: row[7] || ''
  }));
};

// CHECKIN
export const syncCheckInToSheets = async (id: string, c: StoreCheckIn) => {
  const rowData = [
    c.id, c.createdAt, c.timestampStr, c.storeName, c.customerPhone || '', c.address || '', 
    c.salespersonName, c.latitude, c.longitude, c.mapsUrl, c.photoUrl, c.notes || '', c.distanceMeters || ''
  ];
  await gasRequest(id, 'appendRow', CHECKIN_TAB_NAME, undefined, rowData);
};

export interface ParsedItemEntry {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  subtotal: number;
  isFreebie: boolean;
  note?: string;
}

/**
 * Robust item & freebie parser that handles single items, multiline strings,
 * semicolon/comma lists, embedded JSON, and quantity/unit suffixes like "(10 แพ็ค)".
 */
export const parseRawItemsCell = (
  rawVal: any,
  defaultQty: number = 1,
  rowTotalAmount: number = 0
): ParsedItemEntry[] => {
  if (rawVal === undefined || rawVal === null) return [];
  const rawStr = String(rawVal).trim();
  if (!rawStr || rawStr === '-' || rawStr === 'ไม่มี' || rawStr === 'null') return [];

  // 1. Check if JSON array: e.g. [{"name":"น้ำดื่ม 600ml","quantity":10,...}]
  if (rawStr.startsWith('[') && rawStr.endsWith(']')) {
    try {
      const parsed = JSON.parse(rawStr);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: any) => {
          const name = String(item.name || item.productName || item.title || '').trim();
          const isFreebie =
            Boolean(item.isFreebie) ||
            name.startsWith('[แถมฟรี]') ||
            name.startsWith('(แถมฟรี)') ||
            name.startsWith('[แถม]') ||
            name.startsWith('(แถม)') ||
            name.toLowerCase().includes('แถมฟรี');
          const cleanName = name.replace(/^(\[แถมฟรี\]|\(แถมฟรี\)|\[แถม\]|\(แถม\)|แถมฟรี:\s*)/i, '').trim();
          const quantity = Number(item.quantity || item.qty || 1) || 1;
          const unit = item.unit || 'ชิ้น';
          const unitPrice = Number(item.unitPrice || item.price || 0) || 0;
          const subtotal = Number(item.subtotal || 0) || (unitPrice > 0 ? unitPrice * quantity : 0);
          return {
            name: cleanName || name || 'สินค้า',
            quantity,
            unit,
            unitPrice,
            subtotal,
            isFreebie,
            note: item.note,
          };
        });
      }
    } catch {
      // not JSON, continue
    }
  }

  // 2. Split lines if multiline or semicolon-separated
  const lines = rawStr
    .split(/\r?\n|;/)
    .map((l) => l.trim())
    .filter(Boolean);

  const results: ParsedItemEntry[] = [];

  for (const line of lines) {
    let text = line.trim();
    if (!text || text === '-') continue;

    // Check if freebie
    const isFreebie =
      text.startsWith('[แถมฟรี]') ||
      text.startsWith('(แถมฟรี)') ||
      text.startsWith('[แถม]') ||
      text.startsWith('(แถม)') ||
      text.startsWith('แถมฟรี:') ||
      text.startsWith('ของแถม:') ||
      text.endsWith('(แถมฟรี)') ||
      text.endsWith('[แถมฟรี]') ||
      text.endsWith('(แถม)') ||
      text.toLowerCase().includes('แถมฟรี');

    // Strip freebie tags and bullet numbers (e.g. "1. ", "2) ", "- ")
    let clean = text
      .replace(/^(\[แถมฟรี\]|\(แถมฟรี\)|\[แถม\]|\(แถม\)|แถมฟรี:\s*|ของแถม:\s*)/i, '')
      .replace(/(\(แถมฟรี\)|\[แถมฟรี\]|\(แถม\))$/i, '')
      .replace(/^[\d]+[\.\)]\s*/, '')
      .replace(/^[-•*]\s*/, '')
      .trim();

    // Try to extract quantity and unit from string e.g. "น้ำดื่ม 600ml x 10" or "น้ำดื่ม 600ml (10 แพ็ค)" or "น้ำดื่ม 600ml 10 แพ็ค"
    let parsedQty = defaultQty > 0 ? defaultQty : 1;
    let parsedUnit = 'ชิ้น';

    // Pattern 1: (x10) or x10 or x 10
    const xMatch = clean.match(/[xX*]\s*(\d+)\s*(แพ็ค|ขวด|ถัง|ลัง|กล่อง|ชิ้น|โหล)?$/);
    if (xMatch) {
      parsedQty = parseInt(xMatch[1], 10) || parsedQty;
      if (xMatch[2]) parsedUnit = xMatch[2];
      clean = clean.replace(/[xX*]\s*(\d+)\s*(แพ็ค|ขวด|ถัง|ลัง|กล่อง|ชิ้น|โหล)?$/, '').trim();
    } else {
      // Pattern 2: (10 แพ็ค) or (10)
      const bracketMatch = clean.match(/\((\d+)\s*(แพ็ค|ขวด|ถัง|ลัง|กล่อง|ชิ้น|โหล)?\)$/);
      if (bracketMatch) {
        parsedQty = parseInt(bracketMatch[1], 10) || parsedQty;
        if (bracketMatch[2]) parsedUnit = bracketMatch[2];
        clean = clean.replace(/\((\d+)\s*(แพ็ค|ขวด|ถัง|ลัง|กล่อง|ชิ้น|โหล)?\)$/, '').trim();
      } else {
        // Pattern 3: Ending with "จำนวน 10 แพ็ค" or "10 แพ็ค"
        const endQtyMatch = clean.match(/(?:จำนวน\s*)?(\d+)\s+(แพ็ค|ขวด|ถัง|ลัง|กล่อง|ชิ้น|โหล)$/);
        if (endQtyMatch) {
          parsedQty = parseInt(endQtyMatch[1], 10) || parsedQty;
          parsedUnit = endQtyMatch[2];
          clean = clean.replace(/(?:จำนวน\s*)?(\d+)\s+(แพ็ค|ขวด|ถัง|ลัง|กล่อง|ชิ้น|โหล)$/, '').trim();
        }
      }
    }

    // Clean any trailing comma or bracket
    clean = clean.replace(/[,;]+$/, '').trim();

    results.push({
      name: clean || text,
      quantity: parsedQty,
      unit: parsedUnit,
      unitPrice: 0,
      subtotal: 0,
      isFreebie,
    });
  }

  // If single non-freebie item and rowTotalAmount > 0, set its initial subtotal and unitPrice
  if (results.length === 1 && !results[0].isFreebie && rowTotalAmount > 0) {
    results[0].subtotal = rowTotalAmount;
    results[0].unitPrice =
      results[0].quantity > 0 ? Math.round((rowTotalAmount / results[0].quantity) * 100) / 100 : rowTotalAmount;
  }

  return results;
};

// ORDERS
export const parseOrdersFromValues = (values: any[]): Order[] => {
  if (!values || values.length <= 1) return [];

  // Inspect headers in row 0
  const headerRow = values[0] || [];
  const headerStrings = headerRow.map((h: any) => String(h || '').trim().toLowerCase());

  // Robust helper to find column index by keywords (exact match preferred over substring)
  const findCol = (keywords: string[], defaultIdx: number, excludeKeywords: string[] = []): number => {
    const cleanKeywords = keywords.map((k) => k.trim().toLowerCase());
    const cleanExcludes = excludeKeywords.map((e) => e.trim().toLowerCase());

    // Pass 1: Exact match
    for (const k of cleanKeywords) {
      const idx = headerStrings.findIndex((h: string) => {
        if (cleanExcludes.some((e) => h.includes(e))) return false;
        return h === k;
      });
      if (idx !== -1) return idx;
    }

    // Pass 2: Header contains keyword
    for (const k of cleanKeywords) {
      const idx = headerStrings.findIndex((h: string) => {
        if (cleanExcludes.some((e) => h.includes(e))) return false;
        return h.includes(k);
      });
      if (idx !== -1) return idx;
    }

    return defaultIdx;
  };

  const colOrderNumber = findCol(['เลขที่ออเดอร์', 'ordernumber', 'order_number', 'เลขที่', 'id'], 0);
  const colDate = findCol(['วันที่', 'date', 'createddate'], 1, ['ส่ง', 'delivery']);
  const colTime = findCol(['เวลา', 'time', 'createdtime'], 2);
  const colSalesId = findCol(['รหัสพนักงานขาย', 'salespersonid', 'sales_id', 'รหัสเซลล์'], 3);
  const colSalesName = findCol(['ชื่อพนักงานขาย', 'salespersonname', 'sales_name', 'ชื่อเซลล์', 'เซลล์'], 4);
  const colCustName = findCol(['ชื่อลูกค้า', 'customername', 'customer_name', 'ลูกค้า'], 5);
  const colCustPhone = findCol(['เบอร์ติดต่อ', 'customerphone', 'phone', 'tel', 'เบอร์โทร', 'โทร'], 6);
  const colDeliveryDate = findCol(
    ['วันที่ต้องการให้ส่ง', 'วันที่ต้องการส่ง', 'วันที่นัดส่ง', 'requesteddeliverydate', 'deliverydate', 'นัดส่ง'],
    7
  );
  // Avoid 'รหัสสินค้า', 'ราคาสินค้า', 'ประเภทสินค้า' when looking for item name
  const colItemName = findCol(
    ['รายการสินค้า', 'itemname', 'item_name', 'ชื่อสินค้า', 'สินค้า', 'items', 'product'],
    8,
    ['รหัส', 'ราคา', 'ประเภท', 'หมวด', 'หน่วย']
  );
  const colQuantity = findCol(['จำนวน', 'quantity', 'qty'], 9);
  const colTotal = findCol(['ยอดรวมก่อนลด', 'totalamount', 'total_amount', 'ยอดรวม', 'รวมก่อนลด'], 10, ['สุทธิ', 'net']);
  const colDiscount = findCol(['ส่วนลด', 'discount'], 11);
  const colNet = findCol(['ยอดเงินสุทธิ', 'netamount', 'net_amount', 'ยอดสุทธิ', 'สุทธิ'], 12);
  const colPayment = findCol(['วิธีชำระเงิน', 'paymentmethod', 'payment_method', 'การชำระเงิน', 'วิธีชำระ'], 13);
  const colNote = findCol(['หมายเหตุ', 'note', 'notes', 'remark'], 14);
  const colMaps = findCol(['พิกัดแผนที่', 'mapsurl', 'maps_url', 'แผนที่', 'พิกัด', 'โลเคชั่น'], 15);
  const colStatus = findCol(['สถานะ', 'status'], 16);
  const colUpdated = findCol(['อัปเดตล่าสุด', 'updatedat', 'updated_at', 'อัปเดต'], 17);

  // Group rows by orderNumber
  const ordersMap = new Map<string, { order: Order; sheetRows: number[] }>();
  let lastOrderNumber: string | null = null;

  const dataRows = values.slice(1);
  dataRows.forEach((row: any, idx: number) => {
    const rawOrderNum = row[colOrderNumber];
    const trimmedOrderNum =
      rawOrderNum !== undefined && rawOrderNum !== null ? String(rawOrderNum).trim() : '';

    const rawItemName = String(row[colItemName] || '').trim();
    const rawCustName = String(row[colCustName] || '').trim();

    // Contiguous row grouping: If order number is blank but item is present and follows an existing order
    let orderNumber = trimmedOrderNum;
    if (!orderNumber) {
      if (lastOrderNumber && ordersMap.has(lastOrderNumber) && rawItemName && rawItemName !== '-') {
        orderNumber = lastOrderNumber;
      } else {
        orderNumber = `ROW-${idx + 2}`;
      }
    }
    lastOrderNumber = orderNumber;

    const rawQty = parseInt(row[colQuantity], 10) || 1;
    const rowTotal = parseFloat(row[colTotal]) || 0;

    let pay = 'cash';
    const rawPay = String(row[colPayment] || '');
    if (rawPay.includes('โอน')) pay = 'transfer';
    else if (rawPay.includes('เครดิต')) pay = 'credit';

    let st = 'pending';
    const rawStatus = String(row[colStatus] || '');
    if (rawStatus === 'รอดำเนินการ' || rawStatus === 'รอจัดส่ง') st = 'pending';
    else if (rawStatus === 'ยืนยันแล้ว') st = 'confirmed';
    else if (rawStatus === 'กำลังจัดส่ง') st = 'delivering';
    else if (rawStatus === 'จัดส่งสำเร็จ') st = 'completed';
    else if (rawStatus === 'ยกเลิก') st = 'cancelled';

    // Robust Date & Time parsing into ISO format (YYYY-MM-DDTHH:mm:ss)
    const rawDate = String(row[colDate] || '').trim();
    const rawTime = String(row[colTime] || '').trim();

    let isoDate = '';
    if (rawDate.includes('/')) {
      const parts = rawDate.split('/');
      const d = parseInt(parts[0], 10) || 1;
      const m = parseInt(parts[1], 10) || 1;
      let y = parseInt(parts[2], 10) || new Date().getFullYear();
      if (y > 2400) y -= 543;
      isoDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    } else if (rawDate.includes('-')) {
      const datePartOnly = rawDate.split('T')[0].trim();
      const parts = datePartOnly.split('-');
      if (parts[0].length === 4) {
        let y = parseInt(parts[0], 10);
        if (y > 2400) y -= 543;
        isoDate = `${y}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else if (parts[2]?.length === 4) {
        let y = parseInt(parts[2], 10);
        if (y > 2400) y -= 543;
        isoDate = `${y}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      } else {
        isoDate = datePartOnly;
      }
    } else if (rawDate) {
      isoDate = rawDate;
    } else {
      isoDate = new Date().toISOString().split('T')[0];
    }

    let isoTime = '00:00:00';
    if (rawTime) {
      const tParts = rawTime.split(':');
      const hh = String(parseInt(tParts[0], 10) || 0).padStart(2, '0');
      const mm = String(parseInt(tParts[1], 10) || 0).padStart(2, '0');
      const ss = String(parseInt(tParts[2], 10) || 0).padStart(2, '0');
      isoTime = `${hh}:${mm}:${ss}`;
    } else if (rawDate.includes('T') && rawDate.split('T')[1]) {
      isoTime = rawDate.split('T')[1];
    }

    const createdAt = `${isoDate}T${isoTime}`;

    // Handle Location & Maps URL vs Physical Address
    const rawMapsVal = String(row[colMaps] || '').trim();
    let locationObj: { address?: string; mapsUrl?: string } = {};
    if (rawMapsVal) {
      const isHttp =
        rawMapsVal.startsWith('http://') ||
        rawMapsVal.startsWith('https://') ||
        rawMapsVal.startsWith('maps.app.goo.gl');
      if (isHttp) {
        locationObj = { mapsUrl: rawMapsVal };
      } else {
        locationObj = {
          address: rawMapsVal,
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rawMapsVal)}`,
        };
      }
    }

    const rowIdx = idx + 2;

    // Parse items & freebies from raw item cell (supports single item, multiline, semicolon-separated, JSON, and unit tags)
    const parsedEntries = parseRawItemsCell(rawItemName, rawQty, rowTotal);

    if (!ordersMap.has(orderNumber)) {
      const items: OrderItem[] = [];
      const freebies: FreebieItem[] = [];

      parsedEntries.forEach((entry, entryIdx) => {
        if (entry.isFreebie) {
          freebies.push({
            id: `${orderNumber}-freebie-${entryIdx}`,
            name: entry.name,
            quantity: entry.quantity,
            unit: entry.unit || 'ชิ้น',
            note: entry.note,
          });
        } else if (entry.name && entry.name !== '-') {
          items.push({
            id: `${orderNumber}-item-${entryIdx}`,
            name: entry.name,
            quantity: entry.quantity,
            unitPrice: entry.unitPrice || 0,
            subtotal: entry.subtotal || 0,
            unit: entry.unit || 'ชิ้น',
          });
        }
      });

      ordersMap.set(orderNumber, {
        sheetRows: [rowIdx],
        order: {
          sheetsRowIndex: rowIdx,
          id: orderNumber,
          orderNumber,
          createdAt,
          salespersonId: String(row[colSalesId] || ''),
          salespersonName: String(row[colSalesName] || ''),
          customerName: rawCustName,
          customerPhone: String(row[colCustPhone] || ''),
          requestedDeliveryDate: String(row[colDeliveryDate] || ''),
          items,
          freebies,
          totalAmount: parseFloat(row[colTotal]) || 0,
          discount: parseFloat(row[colDiscount]) || 0,
          netAmount: parseFloat(row[colNet]) || 0,
          paymentMethod: pay as any,
          note: String(row[colNote] || ''),
          location: locationObj,
          status: st as any,
          updatedAt: String(row[colUpdated] || ''),
          syncedToSheets: true,
        },
      });
    } else {
      // Existing order with multiple item rows
      const existing = ordersMap.get(orderNumber)!;
      existing.sheetRows.push(rowIdx);
      (existing.order as any).sheetsRowIndex = existing.sheetRows;

      // Update missing order metadata if subsequent row has it
      if (!existing.order.customerName && rawCustName) {
        existing.order.customerName = rawCustName;
      }
      if (!existing.order.customerPhone && row[colCustPhone]) {
        existing.order.customerPhone = String(row[colCustPhone]);
      }
      if (!existing.order.totalAmount && rowTotal) {
        existing.order.totalAmount = rowTotal;
      }

      parsedEntries.forEach((entry) => {
        if (entry.isFreebie) {
          existing.order.freebies = existing.order.freebies || [];
          existing.order.freebies.push({
            id: `${orderNumber}-freebie-${existing.order.freebies.length}`,
            name: entry.name,
            quantity: entry.quantity,
            unit: entry.unit || 'ชิ้น',
            note: entry.note,
          });
        } else if (entry.name && entry.name !== '-') {
          existing.order.items.push({
            id: `${orderNumber}-item-${existing.order.items.length}`,
            name: entry.name,
            quantity: entry.quantity,
            unitPrice: entry.unitPrice || 0,
            subtotal: entry.subtotal || 0,
            unit: entry.unit || 'ชิ้น',
          });
        }
      });
    }
  });

  return Array.from(ordersMap.values()).map((e) => e.order);
};

export const parseOrders = (values: any[]): Order[] => {
  return parseOrdersFromValues(values);
};

export const fetchOrdersFromSheet = async (config: any): Promise<Order[]> => {
  const targetSheet = config?.sheetName || ORDERS_TAB_NAME;
  let res = await gasRequest(config.spreadsheetId, 'getData', targetSheet);
  if (!res || !res.values || res.values.length <= 1) {
    if (targetSheet !== ORDERS_TAB_NAME) {
      res = await gasRequest(config.spreadsheetId, 'getData', ORDERS_TAB_NAME);
    }
  }
  if (!res || !res.values || res.values.length <= 1) return [];
  return parseOrdersFromValues(res.values);
};

const buildOrderRowsData = (o: Order) => {
  const dateObj = new Date(o.createdAt);
  const dateStr = dateObj.toISOString().split('T')[0];
  const timeStr = dateObj.toISOString().split('T')[1].substring(0, 5);

  let pay = 'เงินสด';
  if (o.paymentMethod === 'transfer') pay = 'โอนเงิน';
  if (o.paymentMethod === 'credit') pay = 'เครดิต';

  let st = 'รอดำเนินการ';
  if (o.status === 'pending') st = 'รอจัดส่ง';
  if ((o.status as string) === 'confirmed') st = 'ยืนยันแล้ว';
  if (o.status === 'delivering') st = 'กำลังจัดส่ง';
  if (o.status === 'completed') st = 'จัดส่งสำเร็จ';
  if (o.status === 'cancelled') st = 'ยกเลิก';

  const allItems = [];
  for (const item of o.items) {
    allItems.push({ name: item.name, quantity: item.quantity, type: 'product' });
  }
  if (o.freebies && o.freebies.length > 0) {
    for (const freebie of o.freebies) {
      allItems.push({ name: '[แถมฟรี] ' + freebie.name, quantity: freebie.quantity, type: 'freebie' });
    }
  }

  if (allItems.length === 0) {
    allItems.push({ name: '-', quantity: 0, type: 'none' });
  }

  const rows = [];
  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    rows.push([
      o.orderNumber, // 0: เลขที่ออเดอร์
      dateStr, // 1: วันที่
      timeStr, // 2: เวลา
      o.salespersonId, // 3: รหัสพนักงานขาย
      o.salespersonName, // 4: ชื่อพนักงานขาย
      o.customerName, // 5: ชื่อลูกค้า
      o.customerPhone || '', // 6: เบอร์ติดต่อ
      o.requestedDeliveryDate || '', // 7: วันที่ต้องการให้ส่ง
      item.name, // 8: รายการสินค้า
      item.quantity, // 9: จำนวน
      o.totalAmount, // 10: ยอดรวมก่อนลด
      o.discount || 0, // 11: ส่วนลด
      o.netAmount, // 12: ยอดเงินสุทธิ
      pay, // 13: วิธีชำระเงิน
      o.note || '', // 14: หมายเหตุ
      o.location?.mapsUrl || '', // 15: พิกัดแผนที่
      st, // 16: สถานะ
      o.updatedAt || new Date().toISOString(), // 17: อัปเดตล่าสุด
    ]);
  }
  return rows;
};

export const appendOrderToSheet = async (config: any, o: Order) => {
  const targetSheet = config?.sheetName || ORDERS_TAB_NAME;
  const rowsData = buildOrderRowsData(o);
  try {
    // Try appendRows first
    await gasRequest(config.spreadsheetId, 'appendRows', targetSheet, undefined, undefined, { rowsData });
  } catch (err: any) {
    console.warn('Backend may not support appendRows, falling back to appendRow', err);
    // Fallback: append one by one
    for (const row of rowsData) {
      await gasRequest(config.spreadsheetId, 'appendRow', targetSheet, undefined, row);
    }
  }
};

export const updateOrderInSheet = async (config: any, o: Order): Promise<boolean> => {
  const targetSheet = config?.sheetName || ORDERS_TAB_NAME;
  o.updatedAt = new Date().toISOString();
  const rowsData = buildOrderRowsData(o);
  if (o.sheetsRowIndex) {
    const rowIndices = Array.isArray(o.sheetsRowIndex) ? o.sheetsRowIndex : [o.sheetsRowIndex];
    try {
      await gasRequest(config.spreadsheetId, 'updateRows', targetSheet, undefined, undefined, {
        rowIndices,
        rowsData,
      });
      return true;
    } catch (err: any) {
      console.warn('Backend may not support updateRows, falling back to manual sequence', err);
      // Fallback: manual update/append/delete sequence
      const maxLen = Math.max(rowIndices.length, rowsData.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < rowIndices.length && i < rowsData.length) {
          await gasRequest(config.spreadsheetId, 'updateRow', targetSheet, rowIndices[i], rowsData[i]);
        } else if (i < rowsData.length) {
          await gasRequest(config.spreadsheetId, 'appendRow', targetSheet, undefined, rowsData[i]);
        } else if (i < rowIndices.length) {
          await gasRequest(config.spreadsheetId, 'deleteRow', targetSheet, rowIndices[i]);
        }
      }
      return true;
    }
  }
  return false;
};

export const updateOrderStatusInSheet = async (config: any, o: Order, newStatus: string) => {
  o.status = newStatus as any;
  await updateOrderInSheet(config, o);
};

// --- OPTIMIZATION: BATCH FETCH ---
export const parseUsers = (values: any[]): StaffUser[] => {
  if (!values || values.length <= 1) return [];
  return values.slice(1).map((row: any, idx: number) => ({
    sheetsRowIndex: idx + 2,
    id: row[0] ? String(row[0]) : 'user-' + idx,
    name: String(row[1] || ''),
    email: String(row[2] || ''),
    role: (row[3] || 'sales') as import('../types').StaffRole,
    phone: String(row[4] || ''),
    password: String(row[5] || ''),
    status: (row[6] || 'active') as 'active' | 'inactive',
    createdAt: String(row[7] || ''),
    lastLogin: String(row[8] || ''),
  }));
};

export const parseRoutes = (values: any[]): Route[] => {
  if (!values || values.length <= 1) return [];
  return values.slice(1).map((row: any, idx: number) => ({
    sheetsRowIndex: idx + 2,
    id: row[0] ? String(row[0]) : 'row-' + idx,
    name: String(row[1] || ''),
    salesrepName: String(row[2] || ''),
    notes: String(row[3] || ''),
  }));
};

export const parseCustomers = (values: any[]): Customer[] => {
  if (!values || values.length <= 1) return [];
  return values.slice(1).map((row: any, idx: number) => {
    let routeName = String(row[4] || '');
    let mapsUrl = String(row[5] || '');
    // Auto-swap if mapsUrl was saved in routeName position
    if (routeName.startsWith('http') && !mapsUrl.startsWith('http')) {
      const temp = routeName;
      routeName = mapsUrl;
      mapsUrl = temp;
    }
    return {
      sheetsRowIndex: idx + 2,
      id: row[0] !== undefined && row[0] !== null ? String(row[0]) : 'row-' + idx,
      name: row[1] !== undefined && row[1] !== null ? String(row[1]) : '',
      phone: row[2] !== undefined && row[2] !== null ? String(row[2]) : '',
      address: row[3] !== undefined && row[3] !== null ? String(row[3]) : '',
      routeName,
      mapsUrl,
      latitude: row[6] ? parseFloat(row[6]) : undefined,
      longitude: row[7] ? parseFloat(row[7]) : undefined,
      notes: row[8] !== undefined && row[8] !== null ? String(row[8]) : '',
      updatedAt: row[9] !== undefined && row[9] !== null ? String(row[9]) : '',
    };
  });
};

export const parseProducts = (values: any[]): Product[] => {
  if (!values || values.length <= 1) return [];
  return values.slice(1).map((row: any, idx: number) => ({
    sheetsRowIndex: idx + 2,
    id: row[0] ? String(row[0]) : 'row-' + idx,
    name: row[1] || '',
    sku: row[2] || '',
    category: row[3] || '',
    price: parseFloat(row[4]) || 0,
    unit: row[5] || '',
    stock: parseInt(row[6]) || 0,
    imageUrl: row[7] || '',
  }));
};

export const fetchAllDataBulk = async (spreadsheetId: string, customOrderSheet?: string) => {
  const res = await gasRequest(spreadsheetId, 'getAllData');
  if (!res) return null;

  // Case-insensitive / alias finder for sheet tabs
  const findSheetValues = (name: string, alts: string[] = []): any[] | null => {
    if (res[name] && res[name].values) return res[name].values;
    const lowerKeys = Object.keys(res);
    for (const alt of [name, ...alts]) {
      const match = lowerKeys.find((k) => k.trim().toLowerCase() === alt.trim().toLowerCase());
      if (match && res[match]?.values) return res[match].values;
    }
    return null;
  };

  const usersVal = findSheetValues(USERS_TAB_NAME, ['users', 'ผู้ใช้งาน', 'พนักงาน']);
  const ordersVal = findSheetValues(customOrderSheet || ORDERS_TAB_NAME, [
    ORDERS_TAB_NAME,
    'Orders',
    'orders',
    'รายการออเดอร์',
    'รายการออเดอร์ (Orders)',
    'ออเดอร์',
  ]);
  const productsVal = findSheetValues(PRODUCTS_TAB_NAME, ['products', 'สินค้า', 'รายการสินค้า']);
  const customersVal = findSheetValues(CUSTOMERS_TAB_NAME, ['customers', 'ลูกค้า', 'รายชื่อลูกค้า']);
  const routesVal = findSheetValues(ROUTES_TAB_NAME, ['routes', 'Route', 'สายวิ่ง', 'สายส่ง']);

  if (ordersVal || usersVal || productsVal || customersVal || routesVal) {
    return {
      users: usersVal ? parseUsers(usersVal) : [],
      orders: ordersVal ? parseOrdersFromValues(ordersVal) : [],
      products: productsVal ? parseProducts(productsVal) : [],
      customers: customersVal ? parseCustomers(customersVal) : [],
      routes: routesVal ? parseRoutes(routesVal) : [],
    };
  }
  return null;
};

export const fetchCheckInsFromSheet = async (spreadsheetId: string): Promise<import('../types').StoreCheckIn[]> => {
  const res = await gasRequest(spreadsheetId, 'getData', CHECKIN_TAB_NAME);
  if (!res || !res.values || res.values.length <= 1) return [];
  
  return res.values.slice(1).map((row: any) => ({
    id: row[0] ? String(row[0]) : '',
    createdAt: row[1] ? String(row[1]) : '',
    timestampStr: row[2] ? String(row[2]) : '',
    storeName: row[3] ? String(row[3]) : '',
    customerPhone: row[4] !== undefined && row[4] !== null ? String(row[4]) : '',
    address: row[5] ? String(row[5]) : '',
    salespersonName: row[6] ? String(row[6]) : '',
    latitude: parseFloat(row[7]) || 0,
    longitude: parseFloat(row[8]) || 0,
    mapsUrl: row[9] ? String(row[9]) : '',
    photoUrl: row[10] ? String(row[10]) : '',
    notes: row[11] ? String(row[11]) : '',
    distanceMeters: row[12] ? parseInt(row[12]) : undefined,
  }));
};

// EXPENSES
export const syncExpenseToSheets = async (id: string, e: Expense) => {
  const rowData = [
    e.id,
    e.createdAt,
    e.date,
    e.salespersonId,
    e.salespersonName,
    e.expenseType,
    e.amount,
    e.receiptUrl || '',
    e.note || '',
    e.status || '',
    e.startMileage !== undefined && e.startMileage !== null ? e.startMileage : '',
    e.endMileage !== undefined && e.endMileage !== null ? e.endMileage : '',
    e.distance !== undefined && e.distance !== null ? e.distance : '',
    e.startMileagePhoto || '',
    e.endMileagePhoto || '',
  ];
  await gasRequest(id, 'appendRow', EXPENSES_TAB_NAME, undefined, rowData);
};

export const fetchExpensesFromSheet = async (spreadsheetId: string): Promise<Expense[]> => {
  const res = await gasRequest(spreadsheetId, 'getData', EXPENSES_TAB_NAME);
  if (!res || !res.values || res.values.length <= 1) return [];
  
  return res.values.slice(1).map((row: any) => ({
    id: row[0] ? String(row[0]) : '',
    createdAt: row[1] || '',
    date: row[2] || '',
    salespersonId: row[3] || '',
    salespersonName: row[4] || '',
    expenseType: row[5] || '',
    amount: parseFloat(row[6]) || 0,
    receiptUrl: row[7] || '',
    note: row[8] || '',
    status: row[9] || '',
    startMileage: row[10] !== undefined && row[10] !== '' && !isNaN(Number(row[10])) ? Number(row[10]) : undefined,
    endMileage: row[11] !== undefined && row[11] !== '' && !isNaN(Number(row[11])) ? Number(row[11]) : undefined,
    distance: row[12] !== undefined && row[12] !== '' && !isNaN(Number(row[12])) ? Number(row[12]) : undefined,
    startMileagePhoto: row[13] || '',
    endMileagePhoto: row[14] || '',
  }));
};
