
export interface Route {
  id: string;
  name: string;
  salesrepName?: string;
  salespersonId?: string;
  visitDays?: string[]; // วันที่เข้าเยี่ยม เช่น ['จันทร์', 'พฤหัสบดี']
  notes?: string;
  color?: string; // รหัสสีแสดงในปฏิทิน
}

export interface DailyRouteSchedule {
  date: string; // 'YYYY-MM-DD'
  routeIds: string[]; // รายการรหัสสายที่วิ่งในวันนี้
  notes?: string; // บันทึกพิเศษประจำวัน
  assignedSales?: string; // เซลล์ที่รับผิดชอบเป็นพิเศษ
  additionalCustomerIds?: string[]; // ร้านค้าที่นัดพิเศษนอกสาย
  updatedAt?: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'delivering' | 'completed' | 'cancelled';

export interface OrderItem {
  id: string;
  productId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  unit?: string;
}

export interface FreebieItem {
  id: string;
  productId?: string;
  name: string;
  quantity: number;
  unit?: string;
  note?: string;
}

export interface CustomerLocation {
  address?: string;
  latitude?: number;
  longitude?: number;
  mapsUrl?: string;
}

export interface Customer {
  id?: string;
  name: string;
  phone: string;
  address: string;
  routeName?: string; // สายการเข้าเยี่ยม
  routeId?: string;
  salespersonName?: string;
  visitDays?: string[]; // วันที่เข้าเยี่ยม เช่น ['จันทร์', 'พฤหัสบดี']
  mapsUrl: string;
  latitude?: number;
  longitude?: number;
  updatedAt?: string;
  notes?: string;
  photoUrls?: string[]; // รูปถ่ายร้านค้าที่เก็บใน Google Drive (สูงสุด 3 รูป)
}

export interface Order {
  id: string;
  orderNumber: string;
  createdAt: string; // ISO string
  salespersonId: string;
  salespersonEmail?: string;
  salespersonName: string;
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
  freebies?: FreebieItem[]; // รายการของแถม
  totalAmount: number;
  discount?: number;
  netAmount: number;
  note?: string;
  requestedDeliveryDate?: string; // วันที่ต้องการสินค้า / กำหนดส่ง
  paymentMethod: 'cash' | 'transfer' | 'credit';
  location: CustomerLocation;
  status: OrderStatus;
  syncedToSheets: boolean;
  sheetsRowIndex?: number | number[];
  requireTaxInvoice?: boolean; // ติ๊กเลือกออกใบกำกับภาษี
  taxInvoiceDetails?: TaxInvoiceDetails;
  updatedAt?: string;
  deliveryDriverId?: string;
  deliveryDriverName?: string;
  deliveryVehicle?: string;
  deliverySequence?: number;
  deliveryProofPhoto?: string;
  deliveryProofNote?: string;
  deliveredAt?: string;
}

export interface TaxInvoiceDetails {
  companyName?: string;
  taxId?: string; // เลขประจำตัวผู้เสียภาษีอากร 13 หลัก
  branchType?: 'headquarters' | 'branch'; // สำนักงานใหญ่ หรือ สาขา
  branchNumber?: string; // เลขที่สาขา เช่น 00001
  address?: string;
  phone?: string;
  email?: string;
  note?: string;
}

export interface StoreCheckIn {
  id: string;
  createdAt: string; // ISO string
  timestampStr: string; // e.g. 14/09/2026, 14:30:00
  customerId?: string;
  customerName?: string;
  storeName: string;
  customerPhone?: string;
  address?: string;
  salespersonId: string;
  salespersonName: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  mapsUrl: string;
  photoUrl: string; // Base64 or URL
  notes?: string;
  distanceMeters?: number;
  syncedToSheets?: boolean;
}

export type StaffRole = 'admin' | 'manager' | 'sales' | 'delivery' | 'viewer';

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  phone?: string;
  avatar?: string;
  status?: 'active' | 'inactive';
  createdAt?: string;
  lastLogin?: string;
  password?: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  unit: string;
  stock?: number;
  imageUrl?: string;
}

export interface LineSettings {
  enabled: boolean;
  token: string; // Line Notify Token or Channel Access Token
  webhookUrl: string; // Optional webhook URL (Make / Zapier / Google Cloud Function / custom)
  notifyOnNewOrder: boolean;
  notifyOnStatusChange: boolean;
}

export interface SheetsConfig {
  spreadsheetId: string;
  spreadsheetName: string;
  sheetName: string;
  spreadsheetUrl: string;
  gasUrl?: string;
  storePhotoFolderId?: string;
  checkInPhotoFolderId?: string;
  lastSyncTime?: string;
  autoSync: boolean;
}

export interface Expense {
  id: string;
  createdAt: string; // ISO string
  date: string; // YYYY-MM-DD
  salespersonId: string;
  salespersonName: string;
  expenseType: string; // ค่าน้ำมัน, ค่าทางด่วน, ฯลฯ
  amount: number;
  receiptUrl?: string; // Base64 or URL
  note?: string;
  status?: string;
  syncedToSheets?: boolean;
  startMileage?: number; // เลขไมล์ไป / เริ่มต้น (กม.)
  endMileage?: number; // เลขไมล์กลับ / สิ้นสุด (กม.)
  distance?: number; // ระยะทางที่เดินทาง (กม.) = endMileage - startMileage
  startMileagePhoto?: string; // รูปถ่ายหน้าปัดไมล์ไป
  endMileagePhoto?: string; // รูปถ่ายหน้าปัดไมล์กลับ
}

export type DepositStatus = 'active' | 'refunded' | 'forfeited' | 'partial_refunded';

export interface DepositRecord {
  id: string;
  depositNumber: string; // e.g. DEP-2026-0001
  createdAt: string; // ISO string
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  routeName?: string;
  itemType: string; // e.g. 'ถังน้ำ PC 18.9L', 'ตู้กดน้ำ', 'ลังบรรจุขวด'
  quantity: number; // จำนวนถัง/หน่วย
  unitPrice: number; // เงินประกันต่อหน่วย (บาท)
  totalAmount: number; // ยอดเงินประกันรวม (บาท)
  refundedAmount?: number; // ยอดเงินที่คืนแล้ว (บาท)
  deductedAmount?: number; // ยอดหักชำรุด/สูญหาย (บาท)
  status: DepositStatus; // 'active' | 'refunded' | 'forfeited' | 'partial_refunded'
  paymentMethod: 'cash' | 'transfer' | 'credit';
  slipPhotoUrl?: string; // รูปภาพสลิปหรือหลักฐาน
  receivedBy: string; // ชื่อผู้รับเงินประกัน
  receivedById?: string;
  refundedAt?: string; // วันที่คืนเงินประกัน
  refundedBy?: string; // ผู้ทำรายการคืน
  refundReason?: string; // หมายเหตุการคืน/หัก
  notes?: string;
  syncedToSheets?: boolean;
  sheetsRowIndex?: number;
}

export type PayoutStatus = 'pending' | 'paid';

export interface VehicleRateConfig {
  vehiclePlate: string;
  driverName?: string;
  driverPhone?: string;
  vehicleType?: string; // 'กระบะตอนเดียวตู้ทึบ', 'กระบะคอก', '4 ล้อใหญ่', 'รถร่วมบริการ'
  baseTripRate: number; // ค่าเที่ยวพื้นฐาน (บาท/เที่ยว) เช่น 700
  dropRate: number; // ค่าจุดส่ง (บาท/จุด) เช่น 25
  unitRate: number; // ค่าส่งตามหน่วย/ถัง (บาท/หน่วย) เช่น 3
  fuelAllowanceDefault: number; // ค่าน้ำมัน/เบี้ยเลี้ยงคงที่ (บาท) เช่น 200
  taxWithholdingPercent: number; // ภาษี ณ ที่จ่าย % เช่น 1 หรือ 3 หรือ 0
}

export interface HiredVehicleTripRecord {
  id: string;
  date: string; // YYYY-MM-DD
  vehiclePlate: string; // e.g. 1ฒศ-8899 (กระบะตู้ทึบ 1)
  vehicleType?: string;
  driverName: string;
  driverPhone?: string;
  routeName?: string;
  tripNumber?: number; // เที่ยวที่ 1, เที่ยวที่ 2
  orderIds?: string[];
  orderNumbers?: string[];
  customerNames?: string[];
  dropCount: number; // จำนวนจุดส่ง
  totalUnitsDelivered: number; // จำนวนถัง/แพ็คที่ส่ง
  baseTripRate: number; // ค่าเที่ยวพื้นฐาน (บาท)
  dropRate: number; // อัตราต่อจุด (บาท)
  totalDropFee: number; // รวมค่าจุดส่ง (บาท) = dropCount * dropRate
  unitRate: number; // อัตราต่อหน่วย/ถัง (บาท)
  totalUnitFee: number; // รวมค่าส่งตามยอดถัง (บาท) = totalUnitsDelivered * unitRate
  fuelAllowance: number; // ค่าน้ำมัน/เบี้ยเลี้ยง (บาท)
  overtimeOrSpecialFee: number; // ค่าล่วงเวลา/ค่าเที่ยวพิเศษ (บาท)
  deductions: number; // หักค่าปรับ/สินค้าชำรุด/มัดจำ (บาท)
  deductionReason?: string;
  grossAmount: number; // ยอดรวมก่อนหักภาษี (บาท)
  taxWithholdingPercent: number; // ภาษี ณ ที่จ่าย % (เช่น 1% หรือ 3%)
  taxWithholdingAmount: number; // ยอดหักภาษี (บาท)
  netPayout: number; // ยอดจ่ายสุทธิ (บาท)
  payoutStatus: PayoutStatus; // 'pending' | 'paid'
  paidAt?: string; // วันที่ทำจ่าย
  paidBy?: string; // ผู้ทำรายการจ่าย
  paymentMethod?: 'transfer' | 'cash';
  paymentRef?: string; // เลขที่อ้างอิงโอนเงิน
  notes?: string;
  isCustomManual?: boolean; // บันทึกรอบวิ่งพิเศษ
  syncedToSheets?: boolean;
  sheetsRowIndex?: number;
}

export type MaintenanceCategory =
  | 'periodic_service'      // เช็คระยะตามรอบ (เช่น 10,000 / 20,000 / 50,000 กม.)
  | 'oil_change'            // เปลี่ยนถ่ายน้ำมันเครื่อง & ไส้กรอง
  | 'tires_brakes'          // ยางรถยนต์ & ระบบเบรก
  | 'battery_electrical'    // แบตเตอรี่ & ระบบไฟ
  | 'suspension_chassis'    // ช่วงล่าง / แหนบรับน้ำหนัก / โช้ค
  | 'cooling_aircon'        // ระบบระบายความร้อน & แอร์
  | 'emergency_repair'      // ซ่อมแซมฉุกเฉิน / ซ่อมเครื่องยนต์
  | 'inspection_tax'        // ตรวจ ตรอ. & ต่อภาษี/พ.ร.บ./ประกัน
  | 'other';                // อื่นๆ

export type MaintenanceStatus = 'completed' | 'in_progress' | 'scheduled';

export interface MaintenancePartItem {
  name: string;        // ชื่อรายการ/อะไหล่
  quantity: number;    // จำนวน
  unitPrice: number;   // ราคาต่อหน่วย (บาท)
  totalPrice: number;  // ราคารวม (บาท)
}

export interface VehicleMaintenanceRecord {
  id: string;                      // รหัสเอกสาร เช่น MNT-2026-0001
  date: string;                    // วันที่ทำรายการ (YYYY-MM-DD)
  vehiclePlate: string;            // ทะเบียนรถ เช่น 1ฒศ-8899
  vehicleType?: string;            // ประเภทรถ เช่น กระบะตู้ทึบ, กระบะคอก
  driverName?: string;             // ผู้รับผิดชอบรถ / คนขับ
  currentMileage: number;          // เลขไมล์ปัจจุบัน (กม.)
  serviceCategory: MaintenanceCategory;
  title: string;                   // ชื่องานบำรุงรักษา
  description?: string;            // รายละเอียดงานซ่อม/อาการ
  serviceCenter: string;           // ศูนย์บริการ / อู่ซ่อม
  invoiceNumber?: string;          // เลขที่ใบเสร็จ/ใบแจ้งหนี้
  costParts: number;               // ค่าอะไหล่ (บาท)
  costLabor: number;               // ค่าแรง (บาท)
  costOther?: number;              // ค่าใช้จ่ายอื่นๆ (บาท)
  totalCost: number;               // รวมทั้งสิ้น (บาท)
  status: MaintenanceStatus;       // 'completed' | 'in_progress' | 'scheduled'
  nextServiceMileage?: number;     // เลขไมล์นัดหมายครั้งต่อไป (กม.)
  nextServiceDate?: string;        // วันที่นัดหมายรอบถัดไป (YYYY-MM-DD)
  partsList?: MaintenancePartItem[]; // รายการอะไหล่ที่เปลี่ยน
  receiptPhotoUrl?: string;        // รูปภาพใบเสร็จ / รูปอะไหล่
  recordedBy: string;              // ผู้บันทึกข้อมูล
  recordedById?: string;
  notes?: string;                  // หมายเหตุเพิ่มเติม
  syncedToSheets?: boolean;
  sheetsRowIndex?: number;
}

