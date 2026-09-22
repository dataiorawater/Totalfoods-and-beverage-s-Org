
export interface Route {
  id: string;
  name: string;
  salesrepName?: string;
  notes?: string;
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
  routeName?: string; // NEW: สายการเข้าเยี่ยม
  mapsUrl: string;
  latitude?: number;
  longitude?: number;
  updatedAt?: string;
  notes?: string;
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
  updatedAt?: string;
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
