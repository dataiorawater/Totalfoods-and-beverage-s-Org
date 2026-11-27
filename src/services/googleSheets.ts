import { Order, OrderItem, FreebieItem, Route, StaffUser, Product, Customer, StoreCheckIn, Expense, DepositRecord, HiredVehicleTripRecord, VehicleMaintenanceRecord, FleetVehicle, DailyRouteSchedule, RouteScheduleHistoryEntry, RouteScheduleActionType, PartnerDepositVehicle, PartnerDepositDeduction, PartnerDepositWithdrawal, PartnerDepositStatus } from '../types';
import { normalizeThaiPhone, formatPhoneForGoogleSheets } from '../utils/phoneUtils';
import {
  OnlineOrderRawRow,
  OnlinePostalRouteMapping,
  buildOnlineRowDedupKey,
  getOnlineStatusLabelThai,
  parseOnlineStatusFromThai,
} from '../utils/onlineOrderCsv';

export const USERS_TAB_NAME = 'Users';
export const ORDERS_TAB_NAME = 'Orders';
export const PRODUCTS_TAB_NAME = 'Products';
export const CUSTOMERS_TAB_NAME = 'Customers';
export const ROUTES_TAB_NAME = 'routes';
export const CHECKIN_TAB_NAME = 'CheckIn';
export const EXPENSES_TAB_NAME = 'Expenses';
export const DEPOSITS_TAB_NAME = 'Deposits';
export const PARTNER_DEPOSIT_VEHICLES_TAB_NAME = 'PartnerDepositVehicles';
export const PARTNER_DEPOSIT_DEDUCTIONS_TAB_NAME = 'PartnerDepositDeductions';
export const PARTNER_DEPOSIT_WITHDRAWALS_TAB_NAME = 'PartnerDepositWithdrawals';
export const HIRED_VEHICLES_TAB_NAME = 'HiredVehicles';
export const MAINTENANCE_TAB_NAME = 'VehicleMaintenance';
export const FLEET_VEHICLES_TAB_NAME = 'FleetVehicles';
export const SYSTEM_CONFIG_TAB_NAME = 'SystemConfig';
export const ONLINE_DELIVERY_PLAN_TAB_NAME = 'OnlineDeliveryPlan';
export const ONLINE_POSTAL_ROUTES_TAB_NAME = 'OnlinePostalRoutes';
export const DAILY_ROUTE_SCHEDULES_TAB_NAME = 'DailyRouteSchedules';
export const ROUTE_SCHEDULE_HISTORY_TAB_NAME = 'RouteScheduleHistory';

export const PARTNER_DEPOSIT_VEHICLES_HEADERS = [
  'vehicleId',
  'licensePlate',
  'driverName',
  'phone',
  'startDate',
  'monthlyDeduction',
  'targetAmount',
  'status',
  'notes',
  'fleetVehicleId',
];

export const PARTNER_DEPOSIT_DEDUCTIONS_HEADERS = [
  'deductionId',
  'vehicleId',
  'monthYear',
  'date',
  'amount',
  'notes',
];

export const PARTNER_DEPOSIT_WITHDRAWALS_HEADERS = [
  'withdrawalId',
  'vehicleId',
  'date',
  'amount',
  'reason',
  'notes',
];

export const FLEET_VEHICLES_HEADERS = [
  'id',
  'plateNumber',
  'province',
  'ownershipType',
  'vehicleType',
  'brand',
  'model',
  'modelYear',
  'color',
  'fuelType',
  'status',
  'driverName',
  'driverPhone',
  'currentMileage',
  'taxExpiryDate',
  'taxCost',
  'prbCompany',
  'prbPolicyNumber',
  'prbExpiryDate',
  'prbCost',
  'insuranceCompany',
  'insuranceType',
  'insurancePolicyNumber',
  'insuranceExpiryDate',
  'insuranceCost',
  'photoUrls',
  'notes',
  'updatedAt',
];

export const DAILY_ROUTE_SCHEDULES_HEADERS = [
  'วันที่วิ่ง',
  'พนักงานขาย',
  'รหัสสายวิ่ง',
  'ชื่อสายวิ่ง',
  'ร้านนัดพิเศษนอกสาย',
  'หมายเหตุประจำวัน',
  'รหัสสายที่พนักงานเปลี่ยนเอง',
  'รหัสสายเดิมก่อนเปลี่ยน',
  'ผู้ตั้งค่าล่าสุด',
  'อัปเดตล่าสุด',
];

export const ROUTE_SCHEDULE_HISTORY_HEADERS = [
  'รหัสประวัติ',
  'วันเวลาที่ทำรายการ',
  'วันที่ของแผน',
  'ประเภทการแก้ไข',
  'ผู้ทำรายการ',
  'ตำแหน่ง',
  'สายวิ่งเดิม',
  'สายวิ่งใหม่',
  'หมายเหตุ',
];

export const ONLINE_DELIVERY_PLAN_HEADERS = [
  'วันที่จัดส่ง',
  'หมายเลขคำสั่งซื้อ',
  'แพลตฟอร์ม',
  'ชื่อผู้รับ',
  'เบอร์โทรศัพท์',
  'ที่อยู่รับสินค้า',
  'เมือง/เขต',
  'รหัสไปรษณีย์',
  'ชื่อสินค้า',
  'SKU',
  'จำนวน',
  'หมายเหตุผู้ซื้อ',
  'หมายเหตุผู้ขาย',
  'เวลาสั่งซื้อ',
  'สายรถจัดส่ง',
  'พนักงานขับรถ',
  'สถานะจัดส่ง',
  'อัปเดตล่าสุด',
];

export const ONLINE_POSTAL_ROUTES_HEADERS = [
  'รหัสไปรษณีย์',
  'สายรถจัดส่ง',
  'พนักงานขับรถประจำสาย',
  'หมายเหตุ',
  'อัปเดตล่าสุด',
];

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

export const LEGACY_DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbzfqWujgz3EhJJ4fJ6DEf6J6RibJvyp_b8QA2OwVAhN1WG4gVEr2OnrOXtqvJnJqMU9/exec';
export const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbzlUqmp9Qf4MT4t_m74j26IEU_wOMv3t41mVIJp3ZL8-4e4KqZgjOPE1rucgi6Feg/exec';

export const normalizeGasUrl = (url?: string): string => {
  const trimmed = String(url || '').trim();
  if (!trimmed || trimmed === LEGACY_DEFAULT_GAS_URL) {
    return DEFAULT_GAS_URL;
  }
  return trimmed;
};

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
  url = normalizeGasUrl(url);
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
        gasUrlToUse = normalizeGasUrl(parsed.gasUrl);
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
      headers: ['id', 'name', 'phone', 'address', 'routeName', 'mapsUrl', 'latitude', 'longitude', 'notes', 'updatedAt', 'photoUrls'],
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
        'routeStatus',
        'routeName',
        'scheduledRouteName',
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
    {
      name: DEPOSITS_TAB_NAME,
      headers: [
        'id',
        'depositNumber',
        'createdAt',
        'customerId',
        'customerName',
        'customerPhone',
        'customerAddress',
        'routeName',
        'itemType',
        'quantity',
        'unitPrice',
        'totalAmount',
        'refundedAmount',
        'deductedAmount',
        'status',
        'paymentMethod',
        'receivedBy',
        'refundedAt',
        'refundedBy',
        'refundReason',
        'notes',
        'slipPhotoUrl',
      ],
    },
    {
      name: HIRED_VEHICLES_TAB_NAME,
      headers: [
        'id',
        'date',
        'vehiclePlate',
        'vehicleType',
        'driverName',
        'driverPhone',
        'routeName',
        'tripNumber',
        'dropCount',
        'totalUnitsDelivered',
        'baseTripRate',
        'dropRate',
        'totalDropFee',
        'unitRate',
        'totalUnitFee',
        'fuelAllowance',
        'overtimeOrSpecialFee',
        'deductions',
        'deductionReason',
        'grossAmount',
        'taxWithholdingPercent',
        'taxWithholdingAmount',
        'netPayout',
        'payoutStatus',
        'paidAt',
        'paidBy',
        'paymentMethod',
        'paymentRef',
        'notes',
      ],
    },
    {
      name: MAINTENANCE_TAB_NAME,
      headers: [
        'id',
        'date',
        'vehiclePlate',
        'vehicleType',
        'driverName',
        'currentMileage',
        'serviceCategory',
        'title',
        'description',
        'serviceCenter',
        'invoiceNumber',
        'costParts',
        'costLabor',
        'costOther',
        'totalCost',
        'status',
        'nextServiceMileage',
        'nextServiceDate',
        'recordedBy',
        'notes',
        'receiptPhotoUrl',
      ],
    },
    {
      name: FLEET_VEHICLES_TAB_NAME,
      headers: FLEET_VEHICLES_HEADERS,
    },
    {
      name: SYSTEM_CONFIG_TAB_NAME,
      headers: ['key', 'value', 'updatedAt'],
    },
    {
      name: ONLINE_DELIVERY_PLAN_TAB_NAME,
      headers: ONLINE_DELIVERY_PLAN_HEADERS,
    },
    {
      name: ONLINE_POSTAL_ROUTES_TAB_NAME,
      headers: ONLINE_POSTAL_ROUTES_HEADERS,
    },
    {
      name: DAILY_ROUTE_SCHEDULES_TAB_NAME,
      headers: DAILY_ROUTE_SCHEDULES_HEADERS,
    },
    {
      name: ROUTE_SCHEDULE_HISTORY_TAB_NAME,
      headers: ROUTE_SCHEDULE_HISTORY_HEADERS,
    },
    {
      name: PARTNER_DEPOSIT_VEHICLES_TAB_NAME,
      headers: PARTNER_DEPOSIT_VEHICLES_HEADERS,
    },
    {
      name: PARTNER_DEPOSIT_DEDUCTIONS_TAB_NAME,
      headers: PARTNER_DEPOSIT_DEDUCTIONS_HEADERS,
    },
    {
      name: PARTNER_DEPOSIT_WITHDRAWALS_TAB_NAME,
      headers: PARTNER_DEPOSIT_WITHDRAWALS_HEADERS,
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

export interface SharedSystemConfig {
  gasUrl?: string;
  storePhotoFolderId?: string;
  checkInPhotoFolderId?: string;
  updatedAt?: string;
}

const isValidSharedGasUrl = (url?: string): boolean => {
  if (!url) return false;
  try {
    const parsed = new URL(url.trim());
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'script.google.com' || parsed.hostname === 'script.googleusercontent.com')
    );
  } catch {
    return false;
  }
};

const postGasWithUrl = async (gasUrl: string, payload: Record<string, any>): Promise<any> => {
  const res = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
    throw new Error('GAS_HTML_LOGIN_REQUIRED');
  }
  const json = JSON.parse(text);
  if (json?.error) {
    throw new Error(String(json.error));
  }
  return json;
};

const getCandidateGasUrls = (overrideUrl?: string): string[] => {
  const candidates: string[] = [];
  const normalizedOverride = overrideUrl ? normalizeGasUrl(overrideUrl) : '';
  if (isValidSharedGasUrl(normalizedOverride)) {
    candidates.push(normalizedOverride);
  }
  try {
    const savedConfig = localStorage.getItem('iora_sheets_config');
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      const normalizedSaved = parsed?.gasUrl ? normalizeGasUrl(parsed.gasUrl) : '';
      if (isValidSharedGasUrl(normalizedSaved) && !candidates.includes(normalizedSaved)) {
        candidates.push(normalizedSaved);
      }
    }
  } catch {
    // ignore storage errors
  }
  if (!candidates.includes(DEFAULT_GAS_URL)) {
    candidates.push(DEFAULT_GAS_URL);
  }
  return candidates;
};

export const fetchSharedSystemConfig = async (
  spreadsheetId: string,
  gasUrlOverride?: string
): Promise<SharedSystemConfig | null> => {
  if (!spreadsheetId) return null;
  const candidates = getCandidateGasUrls(gasUrlOverride);

  for (const url of candidates) {
    try {
      const res = await postGasWithUrl(url, {
        action: 'getData',
        spreadsheetId,
        sheet: SYSTEM_CONFIG_TAB_NAME,
      });
      const rows = Array.isArray(res?.values) ? res.values : [];
      if (rows.length <= 1) return null;

      const config: SharedSystemConfig = {};
      for (const row of rows.slice(1)) {
        const key = String(row?.[0] || '').trim();
        const value = String(row?.[1] || '').trim();
        const updatedAt = String(row?.[2] || '').trim();
        if (!key) continue;
        if (key === 'gasUrl' && isValidSharedGasUrl(value)) {
          config.gasUrl = value;
        } else if (key === 'storePhotoFolderId') {
          config.storePhotoFolderId = value;
        } else if (key === 'checkInPhotoFolderId') {
          config.checkInPhotoFolderId = value;
        }
        if (updatedAt && (!config.updatedAt || updatedAt > config.updatedAt)) {
          config.updatedAt = updatedAt;
        }
      }

      if (config.gasUrl || config.storePhotoFolderId || config.checkInPhotoFolderId) {
        return config;
      }
      return null;
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg.includes('Sheet not found')) {
        return null;
      }
      // Try next candidate URL (e.g. fallback to DEFAULT_GAS_URL)
    }
  }

  return null;
};

export const saveSharedSystemConfig = async (
  spreadsheetId: string,
  config: SharedSystemConfig,
  gasUrlOverride?: string
): Promise<boolean> => {
  if (!spreadsheetId) return false;
  const candidates = getCandidateGasUrls(gasUrlOverride || config.gasUrl);
  const nowIso = new Date().toISOString();

  const entries: Array<[string, string]> = [];
  if (isValidSharedGasUrl(config.gasUrl)) {
    entries.push(['gasUrl', config.gasUrl!.trim()]);
  }
  if (config.storePhotoFolderId !== undefined) {
    entries.push(['storePhotoFolderId', String(config.storePhotoFolderId || '').trim()]);
  }
  if (config.checkInPhotoFolderId !== undefined) {
    entries.push(['checkInPhotoFolderId', String(config.checkInPhotoFolderId || '').trim()]);
  }
  if (entries.length === 0) return false;

  for (const url of candidates) {
    try {
      await postGasWithUrl(url, {
        action: 'addSheet',
        spreadsheetId,
        sheet: SYSTEM_CONFIG_TAB_NAME,
      });

      const existingRes = await postGasWithUrl(url, {
        action: 'getData',
        spreadsheetId,
        sheet: SYSTEM_CONFIG_TAB_NAME,
      });

      const rows: any[][] = Array.isArray(existingRes?.values) ? existingRes.values : [];
      if (rows.length === 0) {
        await postGasWithUrl(url, {
          action: 'appendRow',
          spreadsheetId,
          sheet: SYSTEM_CONFIG_TAB_NAME,
          rowData: ['key', 'value', 'updatedAt'],
        });
      }

      const keyToRowIndex = new Map<string, number>();
      for (let i = 1; i < rows.length; i++) {
        const k = String(rows[i]?.[0] || '').trim();
        if (k) keyToRowIndex.set(k, i + 1);
      }

      for (const [key, value] of entries) {
        const existingRowIdx = keyToRowIndex.get(key);
        if (existingRowIdx) {
          await postGasWithUrl(url, {
            action: 'updateRow',
            spreadsheetId,
            sheet: SYSTEM_CONFIG_TAB_NAME,
            rowIndex: existingRowIdx,
            rowData: [key, value, nowIso],
          });
        } else {
          await postGasWithUrl(url, {
            action: 'appendRow',
            spreadsheetId,
            sheet: SYSTEM_CONFIG_TAB_NAME,
            rowData: [key, value, nowIso],
          });
        }
      }

      return true;
    } catch (err) {
      console.warn('[saveSharedSystemConfig] Attempt failed, trying fallback:', err);
    }
  }

  return false;
};


// USERS
export const fetchUsersFromSheets = async (id: string): Promise<StaffUser[]> => {
  const res = await gasRequest(id, 'getData', USERS_TAB_NAME);
  if (!res || !res.values || res.values.length <= 1) return [];
  const rows = res.values.slice(1);
  return rows.map((row: any, idx: number) => ({
    sheetsRowIndex: idx + 2,
    id: row[0] ? String(row[0]) : 'user-' + idx, name: String(row[1] || ''), email: String(row[2] || ''), role: String(row[3] || 'viewer'), phone: normalizeThaiPhone(row[4]), password: String(row[5] || ''), status: String(row[6] || 'active'), createdAt: String(row[7] || ''), lastLogin: String(row[8] || '')
  }));
};

export const saveUserToSheet = async (id: string, u: StaffUser) => {
  const rowData = [u.id || Date.now().toString(), u.name || '', u.email || '', u.role || 'viewer', formatPhoneForGoogleSheets(u.phone), u.password || '', u.status || 'active', u.createdAt || new Date().toISOString(), u.lastLogin || ''];
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
    notes: row[3] || '',
    visitDays: row[4] ? String(row[4]).split(',').map((s: string) => s.trim()).filter(Boolean) : []
  }));
};

export const saveRouteToSheet = async (id: string, r: Route) => {
  const visitDaysStr = Array.isArray(r.visitDays) ? r.visitDays.join(', ') : '';
  const rowData = [r.id || Date.now().toString(), r.name || '', r.salesrepName || '', r.notes || '', visitDaysStr];
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
const parsePhotoUrlsCell = (raw: unknown): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((u) => String(u || '').trim()).filter(Boolean).slice(0, 3);
  }
  const str = String(raw).trim();
  if (!str) return [];
  if (str.startsWith('[')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return parsed.map((u) => String(u || '').trim()).filter(Boolean).slice(0, 3);
      }
    } catch {
      // fall through to delimiter split
    }
  }
  return str
    .split(/[\n,|]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);
};

export const fetchCustomersFromSheet = async (id: string): Promise<Customer[]> => {
  const res = await gasRequest(id, 'getData', CUSTOMERS_TAB_NAME);
  if (!res || !res.values || res.values.length <= 1) return [];
  return res.values.slice(1).map((row: any, idx: number) => ({
    sheetsRowIndex: idx + 2,
    id: row[0] ? String(row[0]) : 'row-' + idx,
    name: row[1] || '',
    phone: normalizeThaiPhone(row[2]),
    address: row[3] || '',
    routeName: row[4] || '',
    mapsUrl: row[5] || '',
    latitude: parseFloat(row[6]) || undefined,
    longitude: parseFloat(row[7]) || undefined,
    notes: row[8] || '',
    updatedAt: row[9] || '',
    photoUrls: parsePhotoUrlsCell(row[10]),
  }));
};

export const saveCustomerToSheet = async (
  id: string,
  c: Customer,
  options?: { isNew?: boolean }
) => {
  const serializedPhotos =
    Array.isArray(c.photoUrls) && c.photoUrls.length > 0
      ? JSON.stringify(c.photoUrls.slice(0, 3))
      : '';
  const rowData = [
    c.id || Date.now().toString(), c.name || '', formatPhoneForGoogleSheets(c.phone), c.address || '', 
    c.routeName || '', c.mapsUrl || '', c.latitude || '', c.longitude || '', 
    c.notes || '', c.updatedAt || new Date().toISOString(), serializedPhotos
  ];

  // Fast path 1: New customer -> append directly without reading the entire Customers tab first
  if (options?.isNew) {
    await gasRequest(id, 'appendRow', CUSTOMERS_TAB_NAME, undefined, rowData);
    return;
  }

  // Fast path 2: Known sheetsRowIndex -> update row directly without reading the entire Customers tab
  const knownRowIndex = Number(c.sheetsRowIndex);
  if (Number.isInteger(knownRowIndex) && knownRowIndex >= 2) {
    await gasRequest(id, 'updateRow', CUSTOMERS_TAB_NAME, knownRowIndex, rowData);
    return;
  }

  // Fallback for editing records whose row index is not yet cached locally
  const existing = await fetchCustomersFromSheet(id);
  const found = existing.find(x => x.id === c.id);
  if (found && (found as any).sheetsRowIndex) {
    await gasRequest(id, 'updateRow', CUSTOMERS_TAB_NAME, (found as any).sheetsRowIndex, rowData);
  } else {
    await gasRequest(id, 'appendRow', CUSTOMERS_TAB_NAME, undefined, rowData);
  }
};

export const deleteCustomerFromSheet = async (
  spreadsheetId: string,
  customer: Pick<Customer, 'id' | 'name' | 'phone'>
): Promise<boolean> => {
  const existing = await fetchCustomersFromSheet(spreadsheetId);
  const targetId = String(customer.id || '').trim();
  const targetName = String(customer.name || '').trim().toLowerCase();
  const targetPhone = normalizeThaiPhone(customer.phone || '');

  let found = targetId
    ? existing.find((x) => String(x.id || '').trim() === targetId)
    : undefined;

  if (!found && targetName) {
    found = existing.find((x) => {
      const xName = String(x.name || '').trim().toLowerCase();
      if (xName !== targetName) return false;
      if (!targetPhone) return true;
      return normalizeThaiPhone(x.phone || '') === targetPhone;
    });
  }

  if (found && (found as any).sheetsRowIndex) {
    await gasRequest(spreadsheetId, 'deleteRow', CUSTOMERS_TAB_NAME, (found as any).sheetsRowIndex);
  }
  return true;
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
  const routeStatusLabel = c.routeStatus || (c.isOffRoute ? 'เช็คอินไม่ตรงสาย' : 'ตรงสาย');
  const rowData = [
    c.id,
    c.createdAt,
    c.timestampStr,
    c.storeName,
    formatPhoneForGoogleSheets(c.customerPhone),
    c.address || '',
    c.salespersonName,
    c.latitude,
    c.longitude,
    c.mapsUrl,
    c.photoUrl,
    c.notes || '',
    c.distanceMeters || '',
    routeStatusLabel,
    c.routeName || '',
    c.scheduledRouteName || '',
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
          customerPhone: normalizeThaiPhone(row[colCustPhone]),
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
        existing.order.customerPhone = normalizeThaiPhone(row[colCustPhone]);
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

  let noteWithTax = o.note || '';
  if (o.requireTaxInvoice) {
    const taxTag = `[ขอใบกำกับภาษี: ${o.taxInvoiceDetails?.companyName || o.customerName}${o.taxInvoiceDetails?.taxId ? ` TaxID:${o.taxInvoiceDetails.taxId}` : ''}${o.taxInvoiceDetails?.branchType === 'branch' ? ` สาขา:${o.taxInvoiceDetails.branchNumber || '-'}` : ''}]`;
    if (!noteWithTax.includes('ขอใบกำกับภาษี')) {
      noteWithTax = noteWithTax ? `${noteWithTax} ${taxTag}` : taxTag;
    }
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
      formatPhoneForGoogleSheets(o.customerPhone), // 6: เบอร์ติดต่อ
      o.requestedDeliveryDate || '', // 7: วันที่ต้องการให้ส่ง
      item.name, // 8: รายการสินค้า
      item.quantity, // 9: จำนวน
      o.totalAmount, // 10: ยอดรวมก่อนลด
      o.discount || 0, // 11: ส่วนลด
      o.netAmount, // 12: ยอดเงินสุทธิ
      pay, // 13: วิธีชำระเงิน
      noteWithTax, // 14: หมายเหตุ (รวมข้อมูลใบกำกับภาษี)
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
    phone: normalizeThaiPhone(row[4]),
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
    visitDays: row[4] ? String(row[4]).split(',').map((s: string) => s.trim()).filter(Boolean) : []
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
      phone: normalizeThaiPhone(row[2]),
      address: row[3] !== undefined && row[3] !== null ? String(row[3]) : '',
      routeName,
      mapsUrl,
      latitude: row[6] ? parseFloat(row[6]) : undefined,
      longitude: row[7] ? parseFloat(row[7]) : undefined,
      notes: row[8] !== undefined && row[8] !== null ? String(row[8]) : '',
      updatedAt: row[9] !== undefined && row[9] !== null ? String(row[9]) : '',
      photoUrls: parsePhotoUrlsCell(row[10]),
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

export const parseCheckIns = (values: any[]): import('../types').StoreCheckIn[] => {
  if (!values || values.length <= 1) return [];
  return values.slice(1).map((row: any) => {
    const notes = row[11] ? String(row[11]) : '';
    const routeStatus = row[13] ? String(row[13]).trim() : '';
    const isOffRoute =
      routeStatus.includes('ไม่ตรงสาย') || notes.includes('[เช็คอินไม่ตรงสาย]');
    return {
      id: row[0] ? String(row[0]) : '',
      createdAt: row[1] ? String(row[1]) : '',
      timestampStr: row[2] ? String(row[2]) : '',
      storeName: row[3] ? String(row[3]) : '',
      customerPhone: normalizeThaiPhone(row[4]),
      address: row[5] ? String(row[5]) : '',
      salespersonId: row[6] ? String(row[6]) : '',
      salespersonName: row[6] ? String(row[6]) : '',
      latitude: parseFloat(row[7]) || 0,
      longitude: parseFloat(row[8]) || 0,
      mapsUrl: row[9] ? String(row[9]) : '',
      photoUrl: row[10] ? String(row[10]) : '',
      notes,
      distanceMeters: row[12] ? parseInt(row[12]) : undefined,
      isOffRoute,
      routeStatus: routeStatus || (isOffRoute ? 'เช็คอินไม่ตรงสาย' : undefined),
      routeName: row[14] ? String(row[14]).trim() : undefined,
      scheduledRouteName: row[15] ? String(row[15]).trim() : undefined,
    };
  });
};

export const parseExpenses = (values: any[]): Expense[] => {
  if (!values || values.length <= 1) return [];
  return values.slice(1).map((row: any) => ({
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
  const checkinsVal = findSheetValues(CHECKIN_TAB_NAME, ['checkins', 'checkin', 'เช็คอิน', 'ประวัติเช็คอิน']);
  const expensesVal = findSheetValues(EXPENSES_TAB_NAME, ['expenses', 'expense', 'ค่าใช้จ่าย', 'บิลน้ำมัน']);
  const depositsVal = findSheetValues(DEPOSITS_TAB_NAME, ['deposits', 'deposit', 'เงินประกัน', 'มัดจำถัง', 'เงินมัดจำ']);
  const hiredVehiclesVal = findSheetValues(HIRED_VEHICLES_TAB_NAME, ['hiredvehicles', 'hired_vehicles', 'ค่าใช้จ่ายรถจ้าง', 'รถจ้าง', 'hired', 'ค่าจ้างรถ']);
  const maintenanceVal = findSheetValues(MAINTENANCE_TAB_NAME, ['vehiclemaintenance', 'maintenance', 'บำรุงรักษา', 'บันทึกบำรุงรักษา', 'ซ่อมบำรุง', 'ประวัติซ่อม']);
  const fleetVehiclesVal = findSheetValues(FLEET_VEHICLES_TAB_NAME, ['fleetvehicles', 'fleet_vehicles', 'vehicles', 'จัดการรถ', 'กองรถ', 'ทะเบียนรถ']);
  const dailySchedulesVal = findSheetValues(DAILY_ROUTE_SCHEDULES_TAB_NAME, ['dailyrouteschedules', 'daily_route_schedules', 'แผนการวิ่งรายวัน']);
  const routeHistoryVal = findSheetValues(ROUTE_SCHEDULE_HISTORY_TAB_NAME, ['routeschedulehistory', 'route_schedule_history', 'ประวัติตั้งค่าสาย']);
  const partnerDepositVehiclesVal = findSheetValues(PARTNER_DEPOSIT_VEHICLES_TAB_NAME, ['partnerdepositvehicles', 'partner_deposit_vehicles', 'เงินประกันรถร่วม']);
  const partnerDepositDeductionsVal = findSheetValues(PARTNER_DEPOSIT_DEDUCTIONS_TAB_NAME, ['partnerdepositdeductions', 'partner_deposit_deductions', 'deductions', 'ประวัติหักประกัน']);
  const partnerDepositWithdrawalsVal = findSheetValues(PARTNER_DEPOSIT_WITHDRAWALS_TAB_NAME, ['partnerdepositwithdrawals', 'partner_deposit_withdrawals', 'withdrawals', 'ประวัติเบิกประกัน']);

  if (ordersVal || usersVal || productsVal || customersVal || routesVal || checkinsVal || expensesVal || depositsVal || hiredVehiclesVal || maintenanceVal || fleetVehiclesVal || dailySchedulesVal || routeHistoryVal || partnerDepositVehiclesVal || partnerDepositDeductionsVal || partnerDepositWithdrawalsVal) {
    return {
      users: usersVal ? parseUsers(usersVal) : [],
      orders: ordersVal ? parseOrdersFromValues(ordersVal) : [],
      products: productsVal ? parseProducts(productsVal) : [],
      customers: customersVal ? parseCustomers(customersVal) : [],
      routes: routesVal ? parseRoutes(routesVal) : [],
      checkIns: checkinsVal ? parseCheckIns(checkinsVal) : null,
      expenses: expensesVal ? parseExpenses(expensesVal) : null,
      deposits: depositsVal ? parseDeposits(depositsVal) : null,
      hiredVehicles: hiredVehiclesVal ? parseHiredVehicleTrips(hiredVehiclesVal) : null,
      maintenanceRecords: maintenanceVal ? parseMaintenanceRecords(maintenanceVal) : null,
      fleetVehicles: fleetVehiclesVal ? parseFleetVehicles(fleetVehiclesVal) : null,
      dailySchedules: dailySchedulesVal ? parseDailyRouteSchedules(dailySchedulesVal) : null,
      routeScheduleHistory: routeHistoryVal ? parseRouteScheduleHistory(routeHistoryVal) : null,
      partnerDepositVehicles: partnerDepositVehiclesVal ? parsePartnerDepositVehicles(partnerDepositVehiclesVal) : null,
      partnerDepositDeductions: partnerDepositDeductionsVal ? parsePartnerDepositDeductions(partnerDepositDeductionsVal) : null,
      partnerDepositWithdrawals: partnerDepositWithdrawalsVal ? parsePartnerDepositWithdrawals(partnerDepositWithdrawalsVal) : null,
    };
  }
  return null;
};

export const parseDeposits = (values: any[]): DepositRecord[] => {
  if (!values || values.length <= 1) return [];
  return values.slice(1).map((row: any, idx: number) => {
    const rawStatus = String(row[14] || '').toLowerCase().trim();
    let status: 'active' | 'refunded' | 'forfeited' | 'partial_refunded' = 'active';
    if (rawStatus.includes('คืนบางส่วน') || rawStatus === 'partial_refunded') status = 'partial_refunded';
    else if (rawStatus.includes('คืนแล้ว') || rawStatus === 'refunded') status = 'refunded';
    else if (rawStatus.includes('ยึด') || rawStatus.includes('ชำรุด') || rawStatus === 'forfeited') status = 'forfeited';

    let pay: 'cash' | 'transfer' | 'credit' = 'cash';
    const rawPay = String(row[15] || '').toLowerCase();
    if (rawPay.includes('โอน')) pay = 'transfer';
    else if (rawPay.includes('เครดิต')) pay = 'credit';

    return {
      sheetsRowIndex: idx + 2,
      id: row[0] ? String(row[0]) : `dep-${idx + 1}`,
      depositNumber: row[1] ? String(row[1]) : `DEP-${String(idx + 1).padStart(4, '0')}`,
      createdAt: row[2] ? String(row[2]) : new Date().toISOString(),
      customerId: row[3] ? String(row[3]) : undefined,
      customerName: String(row[4] || ''),
      customerPhone: normalizeThaiPhone(row[5]),
      customerAddress: row[6] ? String(row[6]) : '',
      routeName: row[7] ? String(row[7]) : '',
      itemType: row[8] ? String(row[8]) : 'ถังน้ำ PC 18.9L',
      quantity: parseInt(row[9], 10) || 1,
      unitPrice: parseFloat(row[10]) || 0,
      totalAmount: parseFloat(row[11]) || 0,
      refundedAmount: row[12] ? parseFloat(row[12]) || 0 : 0,
      deductedAmount: row[13] ? parseFloat(row[13]) || 0 : 0,
      status,
      paymentMethod: pay,
      receivedBy: row[16] ? String(row[16]) : '',
      refundedAt: row[17] ? String(row[17]) : undefined,
      refundedBy: row[18] ? String(row[18]) : undefined,
      refundReason: row[19] ? String(row[19]) : undefined,
      notes: row[20] ? String(row[20]) : undefined,
      slipPhotoUrl: row[21] ? String(row[21]) : undefined,
      syncedToSheets: true,
    };
  });
};

export const fetchDepositsFromSheet = async (spreadsheetId: string): Promise<DepositRecord[]> => {
  const res = await gasRequest(spreadsheetId, 'getData', DEPOSITS_TAB_NAME);
  return parseDeposits(res?.values || []);
};

export const syncDepositToSheets = async (spreadsheetId: string, d: DepositRecord) => {
  const rowData = [
    d.id,
    d.depositNumber,
    d.createdAt,
    d.customerId || '',
    d.customerName || '',
    formatPhoneForGoogleSheets(d.customerPhone),
    d.customerAddress || '',
    d.routeName || '',
    d.itemType || '',
    d.quantity,
    d.unitPrice,
    d.totalAmount,
    d.refundedAmount || 0,
    d.deductedAmount || 0,
    d.status === 'refunded' ? 'คืนแล้ว' : d.status === 'forfeited' ? 'ยึด/หักชำรุด' : d.status === 'partial_refunded' ? 'คืนบางส่วน' : 'ถือครองเงินประกัน',
    d.paymentMethod === 'transfer' ? 'โอนเงิน' : d.paymentMethod === 'credit' ? 'เครดิต' : 'เงินสด',
    d.receivedBy || '',
    d.refundedAt || '',
    d.refundedBy || '',
    d.refundReason || '',
    d.notes || '',
    d.slipPhotoUrl || '',
  ];
  await gasRequest(spreadsheetId, 'appendRow', DEPOSITS_TAB_NAME, undefined, rowData);
};

export const updateDepositInSheet = async (spreadsheetId: string, d: DepositRecord) => {
  const rowData = [
    d.id,
    d.depositNumber,
    d.createdAt,
    d.customerId || '',
    d.customerName || '',
    formatPhoneForGoogleSheets(d.customerPhone),
    d.customerAddress || '',
    d.routeName || '',
    d.itemType || '',
    d.quantity,
    d.unitPrice,
    d.totalAmount,
    d.refundedAmount || 0,
    d.deductedAmount || 0,
    d.status === 'refunded' ? 'คืนแล้ว' : d.status === 'forfeited' ? 'ยึด/หักชำรุด' : d.status === 'partial_refunded' ? 'คืนบางส่วน' : 'ถือครองเงินประกัน',
    d.paymentMethod === 'transfer' ? 'โอนเงิน' : d.paymentMethod === 'credit' ? 'เครดิต' : 'เงินสด',
    d.receivedBy || '',
    d.refundedAt || '',
    d.refundedBy || '',
    d.refundReason || '',
    d.notes || '',
    d.slipPhotoUrl || '',
  ];
  if (d.sheetsRowIndex) {
    await gasRequest(spreadsheetId, 'updateRow', DEPOSITS_TAB_NAME, d.sheetsRowIndex, rowData);
  } else {
    // Find row by id
    const existing = await fetchDepositsFromSheet(spreadsheetId);
    const found = existing.find((x) => x.id === d.id);
    if (found && found.sheetsRowIndex) {
      await gasRequest(spreadsheetId, 'updateRow', DEPOSITS_TAB_NAME, found.sheetsRowIndex, rowData);
    } else {
      await gasRequest(spreadsheetId, 'appendRow', DEPOSITS_TAB_NAME, undefined, rowData);
    }
  }
};

export const fetchCheckInsFromSheet = async (spreadsheetId: string): Promise<import('../types').StoreCheckIn[]> => {
  const res = await gasRequest(spreadsheetId, 'getData', CHECKIN_TAB_NAME);
  return parseCheckIns(res?.values || []);
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
  return parseExpenses(res?.values || []);
};

// HIRED VEHICLES (ค่าใช้จ่ายรถจ้าง)
export const parseHiredVehicleTrips = (values: any[]): HiredVehicleTripRecord[] => {
  if (!values || values.length <= 1) return [];
  return values.slice(1).map((row: any, idx: number) => {
    const rawStatus = String(row[23] || '').toLowerCase().trim();
    const payoutStatus: 'pending' | 'paid' = rawStatus.includes('จ่ายแล้ว') || rawStatus === 'paid' ? 'paid' : 'pending';

    let payMethod: 'transfer' | 'cash' = 'transfer';
    const rawPay = String(row[26] || '').toLowerCase();
    if (rawPay.includes('สด') || rawPay === 'cash') payMethod = 'cash';

    return {
      sheetsRowIndex: idx + 2,
      id: row[0] ? String(row[0]) : `trip-${idx + 1}`,
      date: row[1] ? String(row[1]) : new Date().toISOString().slice(0, 10),
      vehiclePlate: row[2] ? String(row[2]) : '',
      vehicleType: row[3] ? String(row[3]) : 'รถร่วมบริการ',
      driverName: row[4] ? String(row[4]) : '',
      driverPhone: row[5] ? String(row[5]) : '',
      routeName: row[6] ? String(row[6]) : '',
      tripNumber: parseInt(row[7], 10) || 1,
      dropCount: parseInt(row[8], 10) || 0,
      totalUnitsDelivered: parseInt(row[9], 10) || 0,
      baseTripRate: parseFloat(row[10]) || 0,
      dropRate: parseFloat(row[11]) || 0,
      totalDropFee: parseFloat(row[12]) || 0,
      unitRate: parseFloat(row[13]) || 0,
      totalUnitFee: parseFloat(row[14]) || 0,
      fuelAllowance: parseFloat(row[15]) || 0,
      overtimeOrSpecialFee: parseFloat(row[16]) || 0,
      deductions: parseFloat(row[17]) || 0,
      deductionReason: row[18] ? String(row[18]) : '',
      grossAmount: parseFloat(row[19]) || 0,
      taxWithholdingPercent: parseFloat(row[20]) || 0,
      taxWithholdingAmount: parseFloat(row[21]) || 0,
      netPayout: parseFloat(row[22]) || 0,
      payoutStatus,
      paidAt: row[24] ? String(row[24]) : undefined,
      paidBy: row[25] ? String(row[25]) : undefined,
      paymentMethod: payMethod,
      paymentRef: row[27] ? String(row[27]) : '',
      notes: row[28] ? String(row[28]) : '',
      syncedToSheets: true,
    };
  });
};

export const fetchHiredVehicleTripsFromSheet = async (spreadsheetId: string): Promise<HiredVehicleTripRecord[]> => {
  const res = await gasRequest(spreadsheetId, 'getData', HIRED_VEHICLES_TAB_NAME);
  return parseHiredVehicleTrips(res?.values || []);
};

export const syncHiredVehicleTripToSheets = async (spreadsheetId: string, trip: HiredVehicleTripRecord) => {
  const rowData = [
    trip.id,
    trip.date,
    trip.vehiclePlate,
    trip.vehicleType || '',
    trip.driverName,
    trip.driverPhone || '',
    trip.routeName || '',
    trip.tripNumber || 1,
    trip.dropCount,
    trip.totalUnitsDelivered,
    trip.baseTripRate,
    trip.dropRate,
    trip.totalDropFee,
    trip.unitRate,
    trip.totalUnitFee,
    trip.fuelAllowance,
    trip.overtimeOrSpecialFee,
    trip.deductions,
    trip.deductionReason || '',
    trip.grossAmount,
    trip.taxWithholdingPercent,
    trip.taxWithholdingAmount,
    trip.netPayout,
    trip.payoutStatus === 'paid' ? 'จ่ายแล้ว' : 'รอทำจ่าย',
    trip.paidAt || '',
    trip.paidBy || '',
    trip.paymentMethod === 'cash' ? 'เงินสด' : 'โอนเงิน',
    trip.paymentRef || '',
    trip.notes || '',
  ];
  await gasRequest(spreadsheetId, 'appendRow', HIRED_VEHICLES_TAB_NAME, undefined, rowData);
};

export const updateHiredVehicleTripInSheet = async (spreadsheetId: string, trip: HiredVehicleTripRecord) => {
  const rowData = [
    trip.id,
    trip.date,
    trip.vehiclePlate,
    trip.vehicleType || '',
    trip.driverName,
    trip.driverPhone || '',
    trip.routeName || '',
    trip.tripNumber || 1,
    trip.dropCount,
    trip.totalUnitsDelivered,
    trip.baseTripRate,
    trip.dropRate,
    trip.totalDropFee,
    trip.unitRate,
    trip.totalUnitFee,
    trip.fuelAllowance,
    trip.overtimeOrSpecialFee,
    trip.deductions,
    trip.deductionReason || '',
    trip.grossAmount,
    trip.taxWithholdingPercent,
    trip.taxWithholdingAmount,
    trip.netPayout,
    trip.payoutStatus === 'paid' ? 'จ่ายแล้ว' : 'รอทำจ่าย',
    trip.paidAt || '',
    trip.paidBy || '',
    trip.paymentMethod === 'cash' ? 'เงินสด' : 'โอนเงิน',
    trip.paymentRef || '',
    trip.notes || '',
  ];
  if (trip.sheetsRowIndex) {
    await gasRequest(spreadsheetId, 'updateRow', HIRED_VEHICLES_TAB_NAME, trip.sheetsRowIndex, rowData);
  } else {
    const all = await fetchHiredVehicleTripsFromSheet(spreadsheetId);
    const found = all.find((t) => t.id === trip.id);
    if (found && found.sheetsRowIndex) {
      await gasRequest(spreadsheetId, 'updateRow', HIRED_VEHICLES_TAB_NAME, found.sheetsRowIndex, rowData);
    } else {
      await gasRequest(spreadsheetId, 'appendRow', HIRED_VEHICLES_TAB_NAME, undefined, rowData);
    }
  }
};

export const deleteHiredVehicleTripFromSheet = async (spreadsheetId: string, tripId: string) => {
  const all = await fetchHiredVehicleTripsFromSheet(spreadsheetId);
  const found = all.find((t) => t.id === tripId);
  if (found && found.sheetsRowIndex) {
    const emptyRow = new Array(29).fill('');
    await gasRequest(spreadsheetId, 'updateRow', HIRED_VEHICLES_TAB_NAME, found.sheetsRowIndex, emptyRow);
  }
};

// VEHICLE MAINTENANCE (บันทึกบำรุงรักษารถ)
export const parseMaintenanceRecords = (values: any[]): VehicleMaintenanceRecord[] => {
  if (!values || values.length <= 1) return [];
  return values.slice(1).map((row: any, idx: number) => {
    const rawStatus = String(row[15] || '').toLowerCase().trim();
    let status: 'completed' | 'in_progress' | 'scheduled' = 'completed';
    if (rawStatus.includes('กำลัง') || rawStatus.includes('progress')) {
      status = 'in_progress';
    } else if (rawStatus.includes('นัด') || rawStatus.includes('sched')) {
      status = 'scheduled';
    } else if (rawStatus.includes('เสร็จ') || rawStatus.includes('comp') || rawStatus.includes('สำเร็จ')) {
      status = 'completed';
    }

    const rawCat = String(row[6] || '').toLowerCase().trim();
    let serviceCategory: VehicleMaintenanceRecord['serviceCategory'] = 'periodic_service';
    if (rawCat.includes('oil') || rawCat.includes('น้ำมันเครื่อง')) serviceCategory = 'oil_change';
    else if (rawCat.includes('tire') || rawCat.includes('brake') || rawCat.includes('ยาง') || rawCat.includes('เบรก')) serviceCategory = 'tires_brakes';
    else if (rawCat.includes('batt') || rawCat.includes('ไฟ') || rawCat.includes('แบต')) serviceCategory = 'battery_electrical';
    else if (rawCat.includes('susp') || rawCat.includes('แหนบ') || rawCat.includes('ช่วงล่าง') || rawCat.includes('โช้ค')) serviceCategory = 'suspension_chassis';
    else if (rawCat.includes('cool') || rawCat.includes('air') || rawCat.includes('แอร์') || rawCat.includes('หม้อน้ำ')) serviceCategory = 'cooling_aircon';
    else if (rawCat.includes('emerg') || rawCat.includes('ฉุกเฉิน') || rawCat.includes('ยก')) serviceCategory = 'emergency_repair';
    else if (rawCat.includes('tax') || rawCat.includes('ตรอ') || rawCat.includes('ภาษี') || rawCat.includes('พ.ร.บ')) serviceCategory = 'inspection_tax';
    else if (rawCat.includes('other') || rawCat.includes('อื่น')) serviceCategory = 'other';
    else serviceCategory = 'periodic_service';

    const costParts = parseFloat(row[11]) || 0;
    const costLabor = parseFloat(row[12]) || 0;
    const costOther = parseFloat(row[13]) || 0;
    const totalCost = parseFloat(row[14]) || (costParts + costLabor + costOther);

    return {
      sheetsRowIndex: idx + 2,
      id: row[0] ? String(row[0]) : `mnt-${idx + 1}`,
      date: row[1] ? String(row[1]) : new Date().toISOString().slice(0, 10),
      vehiclePlate: String(row[2] || ''),
      vehicleType: row[3] ? String(row[3]) : undefined,
      driverName: row[4] ? String(row[4]) : undefined,
      currentMileage: parseFloat(row[5]) || 0,
      serviceCategory,
      title: String(row[7] || ''),
      description: row[8] ? String(row[8]) : undefined,
      serviceCenter: String(row[9] || ''),
      invoiceNumber: row[10] ? String(row[10]) : undefined,
      costParts,
      costLabor,
      costOther,
      totalCost,
      status,
      nextServiceMileage: row[16] ? parseFloat(row[16]) || undefined : undefined,
      nextServiceDate: row[17] ? String(row[17]) : undefined,
      recordedBy: row[18] ? String(row[18]) : 'เจ้าหน้าที่',
      notes: row[19] ? String(row[19]) : undefined,
      receiptPhotoUrl: row[20] ? String(row[20]) : undefined,
      syncedToSheets: true,
    };
  });
};

export const fetchMaintenanceFromSheet = async (spreadsheetId: string): Promise<VehicleMaintenanceRecord[]> => {
  const res = await gasRequest(spreadsheetId, 'getData', MAINTENANCE_TAB_NAME);
  return parseMaintenanceRecords(res?.values || []);
};

export const syncMaintenanceToSheets = async (spreadsheetId: string, mnt: VehicleMaintenanceRecord) => {
  const rowData = [
    mnt.id,
    mnt.date,
    mnt.vehiclePlate,
    mnt.vehicleType || '',
    mnt.driverName || '',
    mnt.currentMileage || 0,
    mnt.serviceCategory,
    mnt.title,
    mnt.description || '',
    mnt.serviceCenter || '',
    mnt.invoiceNumber || '',
    mnt.costParts || 0,
    mnt.costLabor || 0,
    mnt.costOther || 0,
    mnt.totalCost || 0,
    mnt.status === 'completed' ? 'เสร็จสิ้น' : mnt.status === 'in_progress' ? 'กำลังดำเนินการ' : 'นัดหมายล่วงหน้า',
    mnt.nextServiceMileage || '',
    mnt.nextServiceDate || '',
    mnt.recordedBy || '',
    mnt.notes || '',
    mnt.receiptPhotoUrl || '',
  ];
  if (mnt.sheetsRowIndex) {
    await gasRequest(spreadsheetId, 'updateRow', MAINTENANCE_TAB_NAME, mnt.sheetsRowIndex, rowData);
  } else {
    await gasRequest(spreadsheetId, 'appendRow', MAINTENANCE_TAB_NAME, undefined, rowData);
  }
};

export const updateMaintenanceInSheet = async (spreadsheetId: string, mnt: VehicleMaintenanceRecord) => {
  const rowData = [
    mnt.id,
    mnt.date,
    mnt.vehiclePlate,
    mnt.vehicleType || '',
    mnt.driverName || '',
    mnt.currentMileage || 0,
    mnt.serviceCategory,
    mnt.title,
    mnt.description || '',
    mnt.serviceCenter || '',
    mnt.invoiceNumber || '',
    mnt.costParts || 0,
    mnt.costLabor || 0,
    mnt.costOther || 0,
    mnt.totalCost || 0,
    mnt.status === 'completed' ? 'เสร็จสิ้น' : mnt.status === 'in_progress' ? 'กำลังดำเนินการ' : 'นัดหมายล่วงหน้า',
    mnt.nextServiceMileage || '',
    mnt.nextServiceDate || '',
    mnt.recordedBy || '',
    mnt.notes || '',
    mnt.receiptPhotoUrl || '',
  ];
  if (mnt.sheetsRowIndex) {
    await gasRequest(spreadsheetId, 'updateRow', MAINTENANCE_TAB_NAME, mnt.sheetsRowIndex, rowData);
  } else {
    const all = await fetchMaintenanceFromSheet(spreadsheetId);
    const found = all.find((m) => m.id === mnt.id);
    if (found && found.sheetsRowIndex) {
      await gasRequest(spreadsheetId, 'updateRow', MAINTENANCE_TAB_NAME, found.sheetsRowIndex, rowData);
    } else {
      await gasRequest(spreadsheetId, 'appendRow', MAINTENANCE_TAB_NAME, undefined, rowData);
    }
  }
};

export const deleteMaintenanceFromSheet = async (spreadsheetId: string, mntId: string) => {
  const all = await fetchMaintenanceFromSheet(spreadsheetId);
  const found = all.find((m) => m.id === mntId);
  if (found && found.sheetsRowIndex) {
    const emptyRow = new Array(22).fill('');
    await gasRequest(spreadsheetId, 'updateRow', MAINTENANCE_TAB_NAME, found.sheetsRowIndex, emptyRow);
  }
};

// =========================================================================
// FLEET VEHICLES MANAGEMENT (Google Sheets Tab: FleetVehicles)
// =========================================================================

const parseFleetPhotoUrlsCell = (raw: unknown): string[] => {
  if (!raw) return [];
  const str = String(raw).trim();
  if (!str) return [];
  if (str.startsWith('[')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return parsed.map((u) => String(u || '').trim()).filter(Boolean).slice(0, 6);
      }
    } catch {
      // fallback to split
    }
  }
  return str
    .split(/[\n,|]+/)
    .map((u) => u.trim())
    .filter(Boolean)
    .slice(0, 6);
};

export const parseFleetVehicles = (values: any[]): FleetVehicle[] => {
  if (!values || values.length <= 1) return [];
  const parsed: FleetVehicle[] = [];
  values.slice(1).forEach((row: any, idx: number) => {
    const id = row[0] ? String(row[0]).trim() : '';
    const plateNumber = row[1] ? String(row[1]).trim() : '';
    if (!id && !plateNumber) return;

    const rawOwnership = String(row[3] || '').toLowerCase().trim();
    const ownershipType: FleetVehicle['ownershipType'] =
      rawOwnership === 'hired' || rawOwnership.includes('ร่วม') || rawOwnership.includes('จ้าง')
        ? 'hired'
        : 'company';

    const rawStatus = String(row[10] || '').toLowerCase().trim();
    let status: FleetVehicle['status'] = 'active';
    if (rawStatus === 'maintenance' || rawStatus.includes('ซ่อม')) status = 'maintenance';
    else if (rawStatus === 'inactive' || rawStatus.includes('พัก') || rawStatus.includes('ปลด')) status = 'inactive';

    parsed.push({
      sheetsRowIndex: idx + 2,
      id: id || `VEH-${idx + 1}`,
      plateNumber: plateNumber || '-',
      province: row[2] ? String(row[2]).trim() : '',
      ownershipType,
      vehicleType: row[4] ? String(row[4]).trim() : 'กระบะตอนเดียวตู้ทึบ',
      brand: row[5] ? String(row[5]).trim() : '',
      model: row[6] ? String(row[6]).trim() : '',
      modelYear: row[7] ? String(row[7]).trim() : '',
      color: row[8] ? String(row[8]).trim() : '',
      fuelType: row[9] ? String(row[9]).trim() : 'ดีเซล',
      status,
      driverName: row[11] ? String(row[11]).trim() : '',
      driverPhone: normalizeThaiPhone(row[12]),
      currentMileage: row[13] !== undefined && row[13] !== '' && !isNaN(Number(row[13])) ? Number(row[13]) : undefined,
      taxExpiryDate: row[14] ? String(row[14]).trim().slice(0, 10) : '',
      taxCost: row[15] !== undefined && row[15] !== '' && !isNaN(Number(row[15])) ? Number(row[15]) : undefined,
      prbCompany: row[16] ? String(row[16]).trim() : '',
      prbPolicyNumber: row[17] ? String(row[17]).trim() : '',
      prbExpiryDate: row[18] ? String(row[18]).trim().slice(0, 10) : '',
      prbCost: row[19] !== undefined && row[19] !== '' && !isNaN(Number(row[19])) ? Number(row[19]) : undefined,
      insuranceCompany: row[20] ? String(row[20]).trim() : '',
      insuranceType: row[21] ? String(row[21]).trim() : '',
      insurancePolicyNumber: row[22] ? String(row[22]).trim() : '',
      insuranceExpiryDate: row[23] ? String(row[23]).trim().slice(0, 10) : '',
      insuranceCost: row[24] !== undefined && row[24] !== '' && !isNaN(Number(row[24])) ? Number(row[24]) : undefined,
      photoUrls: parseFleetPhotoUrlsCell(row[25]),
      notes: row[26] ? String(row[26]).trim() : '',
      updatedAt: row[27] ? String(row[27]).trim() : '',
      syncedToSheets: true,
    });
  });
  return parsed;
};

const serializeFleetVehicleRow = (v: FleetVehicle): any[] => [
  v.id,
  v.plateNumber,
  v.province || '',
  v.ownershipType === 'hired' ? 'รถร่วม' : 'รถบริษัท',
  v.vehicleType || '',
  v.brand || '',
  v.model || '',
  v.modelYear || '',
  v.color || '',
  v.fuelType || '',
  v.status === 'maintenance' ? 'อยู่ระหว่างซ่อม' : v.status === 'inactive' ? 'พักใช้งาน' : 'พร้อมใช้งาน',
  v.driverName || '',
  v.driverPhone ? formatPhoneForGoogleSheets(v.driverPhone) : '',
  v.currentMileage ?? '',
  v.taxExpiryDate || '',
  v.taxCost ?? '',
  v.prbCompany || '',
  v.prbPolicyNumber || '',
  v.prbExpiryDate || '',
  v.prbCost ?? '',
  v.insuranceCompany || '',
  v.insuranceType || '',
  v.insurancePolicyNumber || '',
  v.insuranceExpiryDate || '',
  v.insuranceCost ?? '',
  Array.isArray(v.photoUrls) && v.photoUrls.length > 0 ? v.photoUrls.join('\n') : '',
  v.notes || '',
  v.updatedAt || new Date().toISOString(),
];

export const fetchFleetVehiclesFromSheet = async (spreadsheetId: string): Promise<FleetVehicle[]> => {
  const res = await gasRequest(spreadsheetId, 'getData', FLEET_VEHICLES_TAB_NAME);
  return parseFleetVehicles(res?.values || []);
};

export const syncFleetVehicleToSheets = async (spreadsheetId: string, vehicle: FleetVehicle) => {
  const rowData = serializeFleetVehicleRow(vehicle);
  if (vehicle.sheetsRowIndex) {
    await gasRequest(spreadsheetId, 'updateRow', FLEET_VEHICLES_TAB_NAME, vehicle.sheetsRowIndex, rowData);
  } else {
    await gasRequest(spreadsheetId, 'appendRow', FLEET_VEHICLES_TAB_NAME, undefined, rowData);
  }
};

export const updateFleetVehicleInSheet = async (spreadsheetId: string, vehicle: FleetVehicle) => {
  const rowData = serializeFleetVehicleRow(vehicle);
  if (vehicle.sheetsRowIndex) {
    await gasRequest(spreadsheetId, 'updateRow', FLEET_VEHICLES_TAB_NAME, vehicle.sheetsRowIndex, rowData);
  } else {
    const all = await fetchFleetVehiclesFromSheet(spreadsheetId);
    const found = all.find((item) => item.id === vehicle.id || item.plateNumber === vehicle.plateNumber);
    if (found && found.sheetsRowIndex) {
      await gasRequest(spreadsheetId, 'updateRow', FLEET_VEHICLES_TAB_NAME, found.sheetsRowIndex, rowData);
    } else {
      await gasRequest(spreadsheetId, 'appendRow', FLEET_VEHICLES_TAB_NAME, undefined, rowData);
    }
  }
};

export const deleteFleetVehicleFromSheet = async (spreadsheetId: string, vehicleId: string) => {
  const all = await fetchFleetVehiclesFromSheet(spreadsheetId);
  const found = all.find((item) => item.id === vehicleId);
  if (found && found.sheetsRowIndex) {
    const emptyRow = new Array(FLEET_VEHICLES_HEADERS.length).fill('');
    await gasRequest(spreadsheetId, 'updateRow', FLEET_VEHICLES_TAB_NAME, found.sheetsRowIndex, emptyRow);
  }
};

// =========================================================================
// ONLINE DELIVERY PLAN & POSTAL CODE ROUTE MAPPING (Google Sheets)
// =========================================================================

const formatSheetsTextCell = (val?: string): string => {
  const s = String(val ?? '').trim();
  if (!s) return '';
  return s.startsWith("'") ? s : `'${s}`;
};

const normalizeSheetsPlanDate = (val: unknown): string => {
  const s = String(val ?? '').replace(/^'+/, '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    // Convert to Bangkok UTC+7 YYYY-MM-DD so Google Sheets Date cells don't shift by -1 day
    const bkk = new Date(parsed.getTime() + 7 * 60 * 60 * 1000);
    const y = bkk.getUTCFullYear();
    const m = String(bkk.getUTCMonth() + 1).padStart(2, '0');
    const d = String(bkk.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return s;
};

const normalizeSheetsPostalCode = (val: unknown): { postalCode: string; rawPostalCode: string; isMasked: boolean } => {
  const cleaned = String(val ?? '').replace(/^'+/, '').trim();
  const match = cleaned.match(/\b([1-9]\d{4})\b/);
  if (match) {
    return { postalCode: match[1], rawPostalCode: match[1], isMasked: false };
  }
  return { postalCode: 'MASKED', rawPostalCode: cleaned || '****', isMasked: true };
};

export const ensureOnlineLogisticsTabs = async (spreadsheetId: string): Promise<void> => {
  const tabs = [
    { name: ONLINE_DELIVERY_PLAN_TAB_NAME, headers: ONLINE_DELIVERY_PLAN_HEADERS },
    { name: ONLINE_POSTAL_ROUTES_TAB_NAME, headers: ONLINE_POSTAL_ROUTES_HEADERS },
  ];
  for (const tab of tabs) {
    try {
      await gasRequest(spreadsheetId, 'addSheet', tab.name);
      const res = await gasRequest(spreadsheetId, 'getData', tab.name);
      if (!res || !res.values || res.values.length === 0) {
        await gasRequest(spreadsheetId, 'appendRow', tab.name, undefined, tab.headers);
      }
    } catch (err) {
      console.warn(`[ensureOnlineLogisticsTabs] Warning for ${tab.name}:`, err);
    }
  }
};

export const fetchOnlineDeliveryPlanFromSheet = async (
  spreadsheetId: string
): Promise<OnlineOrderRawRow[]> => {
  try {
    const res = await gasRequest(spreadsheetId, 'getData', ONLINE_DELIVERY_PLAN_TAB_NAME);
    const values: any[][] = res?.values || [];
    if (values.length <= 1) return [];

    const rows: OnlineOrderRawRow[] = [];
    for (let i = 1; i < values.length; i++) {
      const r = values[i] || [];
      const orderNumber = String(r[1] ?? '').replace(/^'+/, '').trim();
      if (!orderNumber) continue;

      const planDate = normalizeSheetsPlanDate(r[0]);
      const rawPhone = String(r[4] ?? '').replace(/^'+/, '').trim();
      const phone = /^\*+$/.test(rawPhone) ? rawPhone : normalizeThaiPhone(rawPhone);
      const { postalCode, rawPostalCode, isMasked } = normalizeSheetsPostalCode(r[7]);

      rows.push({
        rowIndex: i,
        sheetsRowIndex: i + 1, // 1-based Google Sheets row number
        planDate,
        orderNumber,
        platform: String(r[2] ?? '').trim() || 'ออนไลน์',
        recipientName: String(r[3] ?? '').trim(),
        phone,
        rawPhone,
        address: String(r[5] ?? '').trim(),
        city: String(r[6] ?? '').trim(),
        postalCode,
        rawPostalCode,
        isMasked,
        productName: String(r[8] ?? '').trim(),
        sku: String(r[9] ?? '').replace(/^'+/, '').trim(),
        quantity: Math.max(1, parseInt(String(r[10] ?? '1').replace(/[^0-9]/g, ''), 10) || 1),
        buyerNote: String(r[11] ?? '').trim(),
        sellerNote: String(r[12] ?? '').trim(),
        orderTime: String(r[13] ?? '').replace(/^'+/, '').trim(),
        assignedRoute: String(r[14] ?? '').trim(),
        assignedDriver: String(r[15] ?? '').trim(),
        deliveryStatus: parseOnlineStatusFromThai(String(r[16] ?? '')),
        updatedAt: String(r[17] ?? '').trim(),
        source: 'sheets',
      });
    }
    return rows;
  } catch (err: any) {
    // If tab does not exist yet, return empty array gracefully
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('not found') || msg.includes('sheet')) {
      return [];
    }
    throw err;
  }
};

const buildOnlineDeliveryPlanRowValues = (
  planDate: string,
  row: OnlineOrderRawRow,
  assignedRoute: string,
  assignedDriver: string,
  updatedAt: string
): any[] => {
  const safePhone =
    !row.phone || /^\*+$/.test(row.phone)
      ? row.phone || ''
      : formatPhoneForGoogleSheets(row.phone);

  return [
    formatSheetsTextCell(planDate),
    formatSheetsTextCell(row.orderNumber),
    row.platform || 'ออนไลน์',
    row.recipientName || '',
    safePhone,
    row.address || '',
    row.city || '',
    formatSheetsTextCell(row.isMasked ? '****' : row.postalCode),
    row.productName || '',
    formatSheetsTextCell(row.sku),
    Number(row.quantity) || 1,
    row.buyerNote || '',
    row.sellerNote || '',
    formatSheetsTextCell(row.orderTime),
    assignedRoute || '',
    assignedDriver || '',
    getOnlineStatusLabelThai(row.deliveryStatus || 'pending'),
    updatedAt,
  ];
};

const appendRowsChunked = async (
  spreadsheetId: string,
  sheetName: string,
  rowsData: any[][],
  chunkSize = 80
) => {
  for (let i = 0; i < rowsData.length; i += chunkSize) {
    const chunk = rowsData.slice(i, i + chunkSize);
    try {
      await gasRequest(spreadsheetId, 'appendRows', sheetName, undefined, undefined, {
        rowsData: chunk,
      });
    } catch (err) {
      console.warn(`[${sheetName}] appendRows fallback to appendRow`, err);
      for (const row of chunk) {
        await gasRequest(spreadsheetId, 'appendRow', sheetName, undefined, row);
      }
    }
  }
};

const updateRowsChunked = async (
  spreadsheetId: string,
  sheetName: string,
  rowIndices: number[],
  rowsData: any[][],
  chunkSize = 50
) => {
  for (let i = 0; i < rowIndices.length; i += chunkSize) {
    const idxChunk = rowIndices.slice(i, i + chunkSize);
    const dataChunk = rowsData.slice(i, i + chunkSize);
    try {
      await gasRequest(spreadsheetId, 'updateRows', sheetName, undefined, undefined, {
        rowIndices: idxChunk,
        rowsData: dataChunk,
      });
    } catch (err) {
      console.warn(`[${sheetName}] updateRows fallback to updateRow`, err);
      for (let j = 0; j < idxChunk.length; j++) {
        await gasRequest(spreadsheetId, 'updateRow', sheetName, idxChunk[j], dataChunk[j]);
      }
    }
  }
};

export interface SaveOnlinePlanResult {
  addedCount: number;
  skippedDuplicateCount: number;
  skippedMaskedCount: number;
}

export const saveOnlineDeliveryPlanBatchToSheet = async (
  spreadsheetId: string,
  planDate: string,
  rows: OnlineOrderRawRow[],
  routeAssignments: Record<string, string>,
  driverAssignments: Record<string, string>,
  options: { skipMasked?: boolean } = {}
): Promise<SaveOnlinePlanResult> => {
  await ensureOnlineLogisticsTabs(spreadsheetId);

  // Read existing rows to prevent duplicates on same delivery date
  const existingRows = await fetchOnlineDeliveryPlanFromSheet(spreadsheetId);
  const existingKeySet = new Set<string>();
  for (const ex of existingRows) {
    existingKeySet.add(
      buildOnlineRowDedupKey(ex.planDate || '', ex.orderNumber, ex.sku, ex.productName)
    );
  }

  const nowStr = new Date().toLocaleString('th-TH');
  const toAppend: any[][] = [];
  let skippedDuplicateCount = 0;
  let skippedMaskedCount = 0;

  for (const row of rows) {
    if (options.skipMasked && row.isMasked) {
      skippedMaskedCount++;
      continue;
    }

    const dedupKey = buildOnlineRowDedupKey(planDate, row.orderNumber, row.sku, row.productName);
    if (existingKeySet.has(dedupKey)) {
      skippedDuplicateCount++;
      continue;
    }
    existingKeySet.add(dedupKey);

    const assignedRoute =
      routeAssignments[row.postalCode] ||
      row.assignedRoute ||
      (row.isMasked ? 'รอตรวจสอบรหัสไปรษณีย์' : `สายรหัส ${row.postalCode}`);
    const assignedDriver = driverAssignments[row.postalCode] ?? row.assignedDriver ?? '';

    toAppend.push(
      buildOnlineDeliveryPlanRowValues(planDate, row, assignedRoute, assignedDriver, nowStr)
    );
  }

  if (toAppend.length > 0) {
    await appendRowsChunked(spreadsheetId, ONLINE_DELIVERY_PLAN_TAB_NAME, toAppend);
  }

  return {
    addedCount: toAppend.length,
    skippedDuplicateCount,
    skippedMaskedCount,
  };
};

export const updateOnlinePlanRowsInSheet = async (
  spreadsheetId: string,
  updatedRows: OnlineOrderRawRow[]
): Promise<number> => {
  const targetRows = updatedRows.filter((r) => typeof r.sheetsRowIndex === 'number' && r.sheetsRowIndex >= 2);
  if (targetRows.length === 0) return 0;

  const nowStr = new Date().toLocaleString('th-TH');
  const rowIndices: number[] = [];
  const rowsData: any[][] = [];

  for (const row of targetRows) {
    rowIndices.push(row.sheetsRowIndex as number);
    rowsData.push(
      buildOnlineDeliveryPlanRowValues(
        row.planDate || '',
        row,
        row.assignedRoute || '',
        row.assignedDriver || '',
        nowStr
      )
    );
  }

  await updateRowsChunked(spreadsheetId, ONLINE_DELIVERY_PLAN_TAB_NAME, rowIndices, rowsData);
  return targetRows.length;
};

export const fetchOnlinePostalRoutesFromSheet = async (
  spreadsheetId: string
): Promise<OnlinePostalRouteMapping[]> => {
  try {
    const res = await gasRequest(spreadsheetId, 'getData', ONLINE_POSTAL_ROUTES_TAB_NAME);
    const values: any[][] = res?.values || [];
    if (values.length <= 1) return [];

    const result: OnlinePostalRouteMapping[] = [];
    for (let i = 1; i < values.length; i++) {
      const r = values[i] || [];
      const postalCode = String(r[0] ?? '').replace(/^'+/, '').trim();
      const routeName = String(r[1] ?? '').trim();
      if (!postalCode || !routeName) continue;

      result.push({
        postalCode,
        routeName,
        driverName: String(r[2] ?? '').trim(),
        notes: String(r[3] ?? '').trim(),
        updatedAt: String(r[4] ?? '').trim(),
        sheetsRowIndex: i + 1,
      });
    }
    return result;
  } catch (err: any) {
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('not found') || msg.includes('sheet')) {
      return [];
    }
    throw err;
  }
};

export const saveOnlinePostalRoutesBatchToSheet = async (
  spreadsheetId: string,
  mappings: Array<{ postalCode: string; routeName: string; driverName?: string; notes?: string }>
): Promise<number> => {
  const validMappings = mappings.filter(
    (m) => m.postalCode && m.postalCode !== 'MASKED' && m.routeName.trim() !== ''
  );
  if (validMappings.length === 0) return 0;

  await ensureOnlineLogisticsTabs(spreadsheetId);
  const existing = await fetchOnlinePostalRoutesFromSheet(spreadsheetId);
  const existingMap = new Map<string, OnlinePostalRouteMapping>();
  for (const item of existing) {
    existingMap.set(item.postalCode, item);
  }

  const nowStr = new Date().toLocaleString('th-TH');
  const updateIndices: number[] = [];
  const updateData: any[][] = [];
  const appendData: any[][] = [];

  for (const m of validMappings) {
    const prev = existingMap.get(m.postalCode);
    const nextDriver = m.driverName !== undefined ? m.driverName : prev?.driverName || '';
    const nextNotes = m.notes !== undefined ? m.notes : prev?.notes || '';
    const rowValues = [
      formatSheetsTextCell(m.postalCode),
      m.routeName.trim(),
      nextDriver.trim(),
      nextNotes.trim(),
      nowStr,
    ];

    if (prev && prev.sheetsRowIndex) {
      // Only update if something actually changed
      if (
        prev.routeName !== m.routeName.trim() ||
        prev.driverName !== nextDriver.trim() ||
        prev.notes !== nextNotes.trim()
      ) {
        updateIndices.push(prev.sheetsRowIndex);
        updateData.push(rowValues);
      }
    } else {
      appendData.push(rowValues);
      existingMap.set(m.postalCode, {
        postalCode: m.postalCode,
        routeName: m.routeName.trim(),
        driverName: nextDriver.trim(),
        notes: nextNotes.trim(),
        updatedAt: nowStr,
      });
    }
  }

  if (updateIndices.length > 0) {
    await updateRowsChunked(
      spreadsheetId,
      ONLINE_POSTAL_ROUTES_TAB_NAME,
      updateIndices,
      updateData
    );
  }
  if (appendData.length > 0) {
    await appendRowsChunked(spreadsheetId, ONLINE_POSTAL_ROUTES_TAB_NAME, appendData);
  }

  return updateIndices.length + appendData.length;
};

// =========================================================================
// DAILY ROUTE SCHEDULES & ROUTE SCHEDULE HISTORY (Google Sheets)
// =========================================================================

const splitCsvCellIds = (val: unknown): string[] => {
  const s = String(val ?? '').replace(/^'+/, '').trim();
  if (!s) return [];
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
};

export const getRouteScheduleActionLabelThai = (actionType: RouteScheduleActionType | string): string => {
  switch (actionType) {
    case 'set_daily':
      return 'ตั้งค่าแผนรายวัน';
    case 'update_daily':
      return 'แก้ไขแผนรายวัน';
    case 'batch_monthly':
      return 'สร้างแผนอัตโนมัติทั้งเดือน';
    case 'clear_monthly':
      return 'ล้างแผนปรับแต่งรายเดือน';
    case 'reset_default':
      return 'รีเซ็ตเป็นรอบปกติ';
    case 'sales_self_switch':
      return 'พนักงานเปลี่ยนสายเอง';
    default:
      return String(actionType || 'แก้ไขแผนวิ่งสาย');
  }
};

const parseRouteScheduleActionType = (raw: string): RouteScheduleActionType => {
  const s = String(raw || '').trim();
  if (s === 'sales_self_switch' || s.includes('เปลี่ยนสายเอง')) return 'sales_self_switch';
  if (s === 'batch_monthly' || s.includes('ทั้งเดือน')) return 'batch_monthly';
  if (s === 'clear_monthly' || s.includes('ล้างแผน')) return 'clear_monthly';
  if (s === 'reset_default' || s.includes('รีเซ็ต')) return 'reset_default';
  if (s === 'set_daily' || s.includes('ตั้งค่า')) return 'set_daily';
  return 'update_daily';
};

export const ensureRouteScheduleTabs = async (spreadsheetId: string): Promise<void> => {
  const tabs = [
    { name: DAILY_ROUTE_SCHEDULES_TAB_NAME, headers: DAILY_ROUTE_SCHEDULES_HEADERS },
    { name: ROUTE_SCHEDULE_HISTORY_TAB_NAME, headers: ROUTE_SCHEDULE_HISTORY_HEADERS },
  ];
  for (const tab of tabs) {
    try {
      await gasRequest(spreadsheetId, 'addSheet', tab.name);
      const res = await gasRequest(spreadsheetId, 'getData', tab.name);
      if (!res || !res.values || res.values.length === 0) {
        await gasRequest(spreadsheetId, 'appendRow', tab.name, undefined, tab.headers);
      }
    } catch (err) {
      console.warn(`[ensureRouteScheduleTabs] Warning for ${tab.name}:`, err);
    }
  }
};

export const parseDailyRouteSchedules = (values: any[]): Record<string, DailyRouteSchedule> => {
  const map: Record<string, DailyRouteSchedule> = {};
  if (!values || values.length <= 1) return map;

  for (let i = 1; i < values.length; i++) {
    const r = values[i] || [];
    const dateStr = normalizeSheetsPlanDate(r[0]);
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;

    const assignedSales = String(r[1] ?? '').trim();
    const routeIds = splitCsvCellIds(r[2]);
    const additionalCustomerIds = splitCsvCellIds(r[4]);
    const notes = String(r[5] ?? '').trim();
    const selfSwitchedRouteIds = splitCsvCellIds(r[6]);
    const plannedRouteIdsBeforeSwitch = splitCsvCellIds(r[7]);
    const updatedBy = String(r[8] ?? '').trim();
    const updatedAt = String(r[9] ?? '').trim();

    map[dateStr] = {
      date: dateStr,
      routeIds,
      assignedSales: assignedSales && assignedSales !== 'ALL' ? assignedSales : undefined,
      additionalCustomerIds: additionalCustomerIds.length > 0 ? additionalCustomerIds : undefined,
      notes: notes || undefined,
      selfSwitchedRouteIds: selfSwitchedRouteIds.length > 0 ? selfSwitchedRouteIds : undefined,
      plannedRouteIdsBeforeSwitch:
        plannedRouteIdsBeforeSwitch.length > 0 ? plannedRouteIdsBeforeSwitch : undefined,
      updatedBy: updatedBy || undefined,
      updatedAt: updatedAt || undefined,
    };
  }
  return map;
};

export const parseRouteScheduleHistory = (values: any[]): RouteScheduleHistoryEntry[] => {
  if (!values || values.length <= 1) return [];
  const list: RouteScheduleHistoryEntry[] = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i] || [];
    const id = String(r[0] ?? '').trim();
    const timestamp = String(r[1] ?? '').trim();
    if (!id && !timestamp) continue;
    list.push({
      id: id || `RSH-${i}`,
      timestamp,
      targetDate: normalizeSheetsPlanDate(r[2]),
      actionType: parseRouteScheduleActionType(String(r[3] ?? '')),
      changedBy: String(r[4] ?? '').trim() || 'ผู้ใช้งาน',
      changedByRole: String(r[5] ?? '').trim() || '',
      previousRouteIds: [],
      previousRouteNames: String(r[6] ?? '').trim() || '-',
      newRouteIds: [],
      newRouteNames: String(r[7] ?? '').trim() || '-',
      notes: String(r[8] ?? '').trim() || undefined,
    });
  }
  return list.reverse();
};

export const fetchDailyRouteSchedulesFromSheet = async (
  spreadsheetId: string
): Promise<Record<string, DailyRouteSchedule>> => {
  try {
    const res = await gasRequest(spreadsheetId, 'getData', DAILY_ROUTE_SCHEDULES_TAB_NAME);
    return parseDailyRouteSchedules(res?.values || []);
  } catch (err: any) {
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('not found') || msg.includes('sheet')) return {};
    throw err;
  }
};

export const fetchRouteScheduleHistoryFromSheet = async (
  spreadsheetId: string
): Promise<RouteScheduleHistoryEntry[]> => {
  try {
    const res = await gasRequest(spreadsheetId, 'getData', ROUTE_SCHEDULE_HISTORY_TAB_NAME);
    return parseRouteScheduleHistory(res?.values || []);
  } catch (err: any) {
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('not found') || msg.includes('sheet')) return [];
    throw err;
  }
};

const buildDailyScheduleRowValues = (
  schedule: DailyRouteSchedule,
  routes: Route[]
): any[] => {
  const routeNameMap = new Map<string, string>();
  routes.forEach((rt) => routeNameMap.set(rt.id, rt.name));
  const routeNamesStr = schedule.routeIds
    .map((id) => routeNameMap.get(id) || id)
    .join(', ');

  return [
    formatSheetsTextCell(schedule.date),
    schedule.assignedSales || 'ALL',
    formatSheetsTextCell(schedule.routeIds.join(',')),
    routeNamesStr || '-',
    formatSheetsTextCell((schedule.additionalCustomerIds || []).join(',')),
    schedule.notes || '',
    formatSheetsTextCell((schedule.selfSwitchedRouteIds || []).join(',')),
    formatSheetsTextCell((schedule.plannedRouteIdsBeforeSwitch || []).join(',')),
    schedule.updatedBy || '',
    schedule.updatedAt || new Date().toISOString(),
  ];
};

export const upsertDailyRouteScheduleToSheet = async (
  spreadsheetId: string,
  schedule: DailyRouteSchedule,
  routes: Route[]
): Promise<void> => {
  await ensureRouteScheduleTabs(spreadsheetId);
  const res = await gasRequest(spreadsheetId, 'getData', DAILY_ROUTE_SCHEDULES_TAB_NAME);
  const values: any[][] = res?.values || [];
  let foundRowIndex: number | null = null;
  for (let i = 1; i < values.length; i++) {
    const rowDate = normalizeSheetsPlanDate(values[i]?.[0]);
    if (rowDate === schedule.date) {
      foundRowIndex = i + 1;
      break;
    }
  }
  const rowData = buildDailyScheduleRowValues(schedule, routes);
  if (foundRowIndex) {
    await gasRequest(spreadsheetId, 'updateRow', DAILY_ROUTE_SCHEDULES_TAB_NAME, foundRowIndex, rowData);
  } else {
    await gasRequest(spreadsheetId, 'appendRow', DAILY_ROUTE_SCHEDULES_TAB_NAME, undefined, rowData);
  }
};

export const upsertBatchDailyRouteSchedulesToSheet = async (
  spreadsheetId: string,
  schedules: Record<string, DailyRouteSchedule>,
  routes: Route[],
  deletedDateStrings: string[] = []
): Promise<void> => {
  await ensureRouteScheduleTabs(spreadsheetId);
  const res = await gasRequest(spreadsheetId, 'getData', DAILY_ROUTE_SCHEDULES_TAB_NAME);
  const values: any[][] = res?.values || [];

  const existingRowIndexByDate = new Map<string, number>();
  for (let i = 1; i < values.length; i++) {
    const rowDate = normalizeSheetsPlanDate(values[i]?.[0]);
    if (rowDate) existingRowIndexByDate.set(rowDate, i + 1);
  }

  const updateIndices: number[] = [];
  const updateData: any[][] = [];
  const appendData: any[][] = [];

  for (const sched of Object.values(schedules)) {
    if (!sched?.date) continue;
    const rowData = buildDailyScheduleRowValues(sched, routes);
    const existingIdx = existingRowIndexByDate.get(sched.date);
    if (existingIdx) {
      updateIndices.push(existingIdx);
      updateData.push(rowData);
    } else {
      appendData.push(rowData);
    }
  }

  // Clear deleted dates by blanking their rows (safe for row indices)
  for (const delDate of deletedDateStrings) {
    const existingIdx = existingRowIndexByDate.get(delDate);
    if (existingIdx && !schedules[delDate]) {
      updateIndices.push(existingIdx);
      updateData.push(new Array(DAILY_ROUTE_SCHEDULES_HEADERS.length).fill(''));
    }
  }

  if (updateIndices.length > 0) {
    await updateRowsChunked(spreadsheetId, DAILY_ROUTE_SCHEDULES_TAB_NAME, updateIndices, updateData);
  }
  if (appendData.length > 0) {
    await appendRowsChunked(spreadsheetId, DAILY_ROUTE_SCHEDULES_TAB_NAME, appendData);
  }
};

export const deleteDailyRouteScheduleFromSheet = async (
  spreadsheetId: string,
  dateStr: string
): Promise<void> => {
  await ensureRouteScheduleTabs(spreadsheetId);
  const res = await gasRequest(spreadsheetId, 'getData', DAILY_ROUTE_SCHEDULES_TAB_NAME);
  const values: any[][] = res?.values || [];
  for (let i = 1; i < values.length; i++) {
    const rowDate = normalizeSheetsPlanDate(values[i]?.[0]);
    if (rowDate === dateStr) {
      await gasRequest(spreadsheetId, 'deleteRow', DAILY_ROUTE_SCHEDULES_TAB_NAME, i + 1);
      break;
    }
  }
};

export const appendRouteScheduleHistoryToSheet = async (
  spreadsheetId: string,
  entry: RouteScheduleHistoryEntry
): Promise<void> => {
  await ensureRouteScheduleTabs(spreadsheetId);
  const rowData = [
    entry.id,
    entry.timestamp,
    formatSheetsTextCell(entry.targetDate),
    getRouteScheduleActionLabelThai(entry.actionType),
    entry.changedBy,
    entry.changedByRole,
    entry.previousRouteNames || '-',
    entry.newRouteNames || '-',
    entry.notes || '',
  ];
  await gasRequest(spreadsheetId, 'appendRow', ROUTE_SCHEDULE_HISTORY_TAB_NAME, undefined, rowData);
};

// =========================================================================
// PARTNER VEHICLE SECURITY DEPOSIT (3 TABS IN MAIN GOOGLE SHEET)
// =========================================================================

const normalizePartnerDepositDateCell = (val: any): string => {
  if (!val) return '';
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const isoMatch = str.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoMatch) return isoMatch[1];
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return str;
};

const normalizePartnerDepositStatus = (raw: any): PartnerDepositStatus => {
  const s = String(raw || '').trim();
  if (s === 'ครบกำหนดหักแล้ว' || s === 'completed') return 'ครบกำหนดหักแล้ว';
  if (s === 'หยุดวิ่งงาน' || s === 'inactive' || s === 'stopped') return 'หยุดวิ่งงาน';
  return 'กำลังหักเงิน';
};

export const ensurePartnerDepositTabs = async (spreadsheetId: string): Promise<void> => {
  const tabs = [
    { name: PARTNER_DEPOSIT_VEHICLES_TAB_NAME, headers: PARTNER_DEPOSIT_VEHICLES_HEADERS },
    { name: PARTNER_DEPOSIT_DEDUCTIONS_TAB_NAME, headers: PARTNER_DEPOSIT_DEDUCTIONS_HEADERS },
    { name: PARTNER_DEPOSIT_WITHDRAWALS_TAB_NAME, headers: PARTNER_DEPOSIT_WITHDRAWALS_HEADERS },
  ];
  for (const tab of tabs) {
    try {
      await gasRequest(spreadsheetId, 'addSheet', tab.name);
      const res = await gasRequest(spreadsheetId, 'getData', tab.name);
      if (!res || !res.values || res.values.length === 0) {
        await gasRequest(spreadsheetId, 'appendRow', tab.name, undefined, tab.headers);
      }
    } catch (err) {
      console.warn(`[ensurePartnerDepositTabs] Warning for ${tab.name}:`, err);
    }
  }
};

export const parsePartnerDepositVehicles = (values: any[]): PartnerDepositVehicle[] => {
  if (!values || values.length <= 1) return [];
  const list: PartnerDepositVehicle[] = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i] || [];
    const vehicleId = String(row[0] ?? '').trim();
    const licensePlate = String(row[1] ?? '').trim();
    if (!vehicleId && !licensePlate) continue;
    list.push({
      vehicleId: vehicleId || `V${String(i).padStart(3, '0')}`,
      licensePlate,
      driverName: String(row[2] ?? '').trim(),
      phone: normalizeThaiPhone(String(row[3] ?? '').trim()),
      startDate: normalizePartnerDepositDateCell(row[4]),
      monthlyDeduction: Number(String(row[5] ?? '2500').replace(/,/g, '')) || 2500,
      targetAmount: Number(String(row[6] ?? '30000').replace(/,/g, '')) || 30000,
      status: normalizePartnerDepositStatus(row[7]),
      notes: String(row[8] ?? '').trim() || undefined,
      fleetVehicleId: String(row[9] ?? '').trim() || undefined,
      syncedToSheets: true,
      sheetsRowIndex: i + 1,
    });
  }
  return list;
};

const normalizePartnerMonthYearCell = (val: any): string => {
  if (!val) return '';
  const str = String(val).trim();
  if (/^\d{1,2}\/\d{4}$/.test(str)) return str;
  const isoMatch = str.match(/^(\d{4})-(\d{2})-\d{2}/);
  if (isoMatch) return `${isoMatch[2]}/${isoMatch[1]}`;
  if (str.includes('GMT') || /^[A-Z][a-z]{2}\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{4}/.test(str)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const bkk = new Date(d.getTime() + 7 * 60 * 60 * 1000);
      const m = String(bkk.getUTCMonth() + 1).padStart(2, '0');
      const y = bkk.getUTCFullYear();
      return `${m}/${y}`;
    }
  }
  return str;
};

export const parsePartnerDepositDeductions = (values: any[]): PartnerDepositDeduction[] => {
  if (!values || values.length <= 1) return [];
  const list: PartnerDepositDeduction[] = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i] || [];
    const deductionId = String(row[0] ?? '').trim();
    const vehicleId = String(row[1] ?? '').trim();
    if (!deductionId && !vehicleId) continue;
    list.push({
      deductionId: deductionId || `D${String(i).padStart(4, '0')}`,
      vehicleId,
      monthYear: normalizePartnerMonthYearCell(row[2]),
      date: normalizePartnerDepositDateCell(row[3]),
      amount: Number(String(row[4] ?? '0').replace(/,/g, '')) || 0,
      notes: String(row[5] ?? '').trim() || undefined,
      syncedToSheets: true,
      sheetsRowIndex: i + 1,
    });
  }
  return list;
};

export const parsePartnerDepositWithdrawals = (values: any[]): PartnerDepositWithdrawal[] => {
  if (!values || values.length <= 1) return [];
  const list: PartnerDepositWithdrawal[] = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i] || [];
    const withdrawalId = String(row[0] ?? '').trim();
    const vehicleId = String(row[1] ?? '').trim();
    if (!withdrawalId && !vehicleId) continue;
    list.push({
      withdrawalId: withdrawalId || `W${String(i).padStart(4, '0')}`,
      vehicleId,
      date: normalizePartnerDepositDateCell(row[2]),
      amount: Number(String(row[3] ?? '0').replace(/,/g, '')) || 0,
      reason: String(row[4] ?? '').trim(),
      notes: String(row[5] ?? '').trim() || undefined,
      syncedToSheets: true,
      sheetsRowIndex: i + 1,
    });
  }
  return list;
};

export const fetchPartnerDepositDataFromSheet = async (
  spreadsheetId: string
): Promise<{
  vehicles: PartnerDepositVehicle[];
  deductions: PartnerDepositDeduction[];
  withdrawals: PartnerDepositWithdrawal[];
}> => {
  const safeGet = async (tabName: string) => {
    try {
      const res = await gasRequest(spreadsheetId, 'getData', tabName);
      return res?.values || [];
    } catch (err: any) {
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('not found') || msg.includes('sheet')) return [];
      throw err;
    }
  };

  const [vRows, dRows, wRows] = await Promise.all([
    safeGet(PARTNER_DEPOSIT_VEHICLES_TAB_NAME),
    safeGet(PARTNER_DEPOSIT_DEDUCTIONS_TAB_NAME),
    safeGet(PARTNER_DEPOSIT_WITHDRAWALS_TAB_NAME),
  ]);

  return {
    vehicles: parsePartnerDepositVehicles(vRows),
    deductions: parsePartnerDepositDeductions(dRows),
    withdrawals: parsePartnerDepositWithdrawals(wRows),
  };
};

const buildPartnerDepositVehicleRow = (v: PartnerDepositVehicle): any[] => [
  v.vehicleId,
  v.licensePlate,
  v.driverName,
  formatPhoneForGoogleSheets(v.phone),
  formatSheetsTextCell(v.startDate),
  Number(v.monthlyDeduction) || 0,
  Number(v.targetAmount) || 0,
  v.status,
  v.notes || '',
  v.fleetVehicleId || '',
];

export const appendPartnerDepositVehicleToSheet = async (
  spreadsheetId: string,
  vehicle: PartnerDepositVehicle
): Promise<void> => {
  await ensurePartnerDepositTabs(spreadsheetId);
  await gasRequest(
    spreadsheetId,
    'appendRow',
    PARTNER_DEPOSIT_VEHICLES_TAB_NAME,
    undefined,
    buildPartnerDepositVehicleRow(vehicle)
  );
};

export const updatePartnerDepositVehicleInSheet = async (
  spreadsheetId: string,
  vehicle: PartnerDepositVehicle
): Promise<void> => {
  await ensurePartnerDepositTabs(spreadsheetId);
  const rowData = buildPartnerDepositVehicleRow(vehicle);
  const res = await gasRequest(spreadsheetId, 'getData', PARTNER_DEPOSIT_VEHICLES_TAB_NAME);
  const rows: any[][] = res?.values || [];
  let foundRowIndex: number | null = null;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i]?.[0] ?? '').trim() === vehicle.vehicleId) {
      foundRowIndex = i + 1;
      break;
    }
  }
  if (foundRowIndex) {
    await gasRequest(spreadsheetId, 'updateRow', PARTNER_DEPOSIT_VEHICLES_TAB_NAME, foundRowIndex, rowData);
  } else {
    await gasRequest(spreadsheetId, 'appendRow', PARTNER_DEPOSIT_VEHICLES_TAB_NAME, undefined, rowData);
  }
};

export const deletePartnerDepositVehicleFromSheet = async (
  spreadsheetId: string,
  vehicleId: string
): Promise<void> => {
  const deleteMatchingRows = async (tabName: string, colIndex: number) => {
    try {
      const res = await gasRequest(spreadsheetId, 'getData', tabName);
      const rows: any[][] = res?.values || [];
      const indicesToDelete: number[] = [];
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i]?.[colIndex] ?? '').trim() === vehicleId) {
          indicesToDelete.push(i + 1);
        }
      }
      // Delete from bottom to top so row numbers don't shift
      for (let k = indicesToDelete.length - 1; k >= 0; k--) {
        await gasRequest(spreadsheetId, 'deleteRow', tabName, indicesToDelete[k]);
      }
    } catch (err) {
      console.warn(`[deletePartnerDepositVehicleFromSheet] Warning deleting from ${tabName}:`, err);
    }
  };

  await deleteMatchingRows(PARTNER_DEPOSIT_VEHICLES_TAB_NAME, 0);
  await deleteMatchingRows(PARTNER_DEPOSIT_DEDUCTIONS_TAB_NAME, 1);
  await deleteMatchingRows(PARTNER_DEPOSIT_WITHDRAWALS_TAB_NAME, 1);
};

export const appendPartnerDepositDeductionToSheet = async (
  spreadsheetId: string,
  deduction: PartnerDepositDeduction
): Promise<void> => {
  await ensurePartnerDepositTabs(spreadsheetId);
  const rowData = [
    deduction.deductionId,
    deduction.vehicleId,
    formatSheetsTextCell(deduction.monthYear),
    formatSheetsTextCell(deduction.date),
    Number(deduction.amount) || 0,
    deduction.notes || '',
  ];
  await gasRequest(spreadsheetId, 'appendRow', PARTNER_DEPOSIT_DEDUCTIONS_TAB_NAME, undefined, rowData);
};

export const deletePartnerDepositDeductionFromSheet = async (
  spreadsheetId: string,
  deductionId: string
): Promise<void> => {
  const res = await gasRequest(spreadsheetId, 'getData', PARTNER_DEPOSIT_DEDUCTIONS_TAB_NAME);
  const rows: any[][] = res?.values || [];
  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i]?.[0] ?? '').trim() === deductionId) {
      await gasRequest(spreadsheetId, 'deleteRow', PARTNER_DEPOSIT_DEDUCTIONS_TAB_NAME, i + 1);
      break;
    }
  }
};

export const appendPartnerDepositWithdrawalToSheet = async (
  spreadsheetId: string,
  withdrawal: PartnerDepositWithdrawal
): Promise<void> => {
  await ensurePartnerDepositTabs(spreadsheetId);
  const rowData = [
    withdrawal.withdrawalId,
    withdrawal.vehicleId,
    formatSheetsTextCell(withdrawal.date),
    Number(withdrawal.amount) || 0,
    withdrawal.reason || '',
    withdrawal.notes || '',
  ];
  await gasRequest(spreadsheetId, 'appendRow', PARTNER_DEPOSIT_WITHDRAWALS_TAB_NAME, undefined, rowData);
};

export const deletePartnerDepositWithdrawalFromSheet = async (
  spreadsheetId: string,
  withdrawalId: string
): Promise<void> => {
  const res = await gasRequest(spreadsheetId, 'getData', PARTNER_DEPOSIT_WITHDRAWALS_TAB_NAME);
  const rows: any[][] = res?.values || [];
  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i]?.[0] ?? '').trim() === withdrawalId) {
      await gasRequest(spreadsheetId, 'deleteRow', PARTNER_DEPOSIT_WITHDRAWALS_TAB_NAME, i + 1);
      break;
    }
  }
};





