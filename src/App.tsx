import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import {
  Order,
  OrderStatus,
  StaffUser,
  Product,
  Customer,
  SheetsConfig,
  LineSettings,
  StoreCheckIn,
  Route,
  Expense,
  DepositRecord,
  HiredVehicleTripRecord,
  VehicleMaintenanceRecord,
  FleetVehicle,
  DailyRouteSchedule,
  RouteScheduleHistoryEntry,
  RouteScheduleActionType,
  PartnerDepositVehicle,
  PartnerDepositDeduction,
  PartnerDepositWithdrawal,
  PartnerDepositStatus,
} from './types';
import {
  INITIAL_ORDERS,
  INITIAL_STAFF_USERS,
  INITIAL_PRODUCTS,
  INITIAL_CUSTOMERS,
  DEFAULT_SHEETS_CONFIG,
  DEFAULT_LINE_SETTINGS,
  INITIAL_HIRED_VEHICLES,
  INITIAL_MAINTENANCE_RECORDS,
  INITIAL_FLEET_VEHICLES,
  INITIAL_ROUTES,
} from './data/mockData';
import { formatNowUtcPlus7Iso, getThaiDayFromDate, doesRouteRunOnDay } from './utils/callPlanUtils';
import { normalizeThaiPhone } from './utils/phoneUtils';
import { parseDateRobust, formatThaiDateTime } from './utils/dateUtils';
import { getRoleShortLabel } from './utils/roleUtils';
import { getVehicleComplianceAlerts, EXPIRY_WARNING_DAYS } from './utils/fleetUtils';

import {
  appendOrderToSheet,
  updateOrderInSheet,
  fetchOrdersFromSheet,
  fetchRoutesFromSheet,
  saveRouteToSheet,
  deleteRouteFromSheet,
  updateOrderStatusInSheet,
  ensureAllSheetsTabs,
  migrateOrderHeaders,
  migrateRouteHeaders,
  fetchAllDataBulk,
  fetchUsersFromSheets,
  saveUserToSheet,
  recordUserLoginInSheet,
  fetchProductsFromSheet,
  fetchCustomersFromSheet,
  saveCustomerToSheet,
  deleteCustomerFromSheet,
  setUserPasswordInSheet,
  syncCheckInToSheets,
  fetchCheckInsFromSheet,
  syncExpenseToSheets,
  fetchExpensesFromSheet,
  fetchDepositsFromSheet,
  syncHiredVehicleTripToSheets,
  updateHiredVehicleTripInSheet,
  fetchHiredVehicleTripsFromSheet,
  syncMaintenanceToSheets,
  updateMaintenanceInSheet,
  deleteMaintenanceFromSheet,
  fetchMaintenanceFromSheet,
  syncFleetVehicleToSheets,
  updateFleetVehicleInSheet,
  deleteFleetVehicleFromSheet,
  fetchFleetVehiclesFromSheet,
  DEFAULT_GAS_URL,
  LEGACY_DEFAULT_GAS_URL,
  fetchSharedSystemConfig,
  saveSharedSystemConfig,
  fetchDailyRouteSchedulesFromSheet,
  fetchRouteScheduleHistoryFromSheet,
  upsertDailyRouteScheduleToSheet,
  upsertBatchDailyRouteSchedulesToSheet,
  deleteDailyRouteScheduleFromSheet,
  appendRouteScheduleHistoryToSheet,
  fetchPartnerDepositDataFromSheet,
  deletePartnerDepositHistoryForVehicleFromSheet,
  appendPartnerDepositDeductionToSheet,
  deletePartnerDepositDeductionFromSheet,
  appendPartnerDepositWithdrawalToSheet,
  deletePartnerDepositWithdrawalFromSheet,
} from './services/googleSheets';
import { logoutGoogle } from './services/auth';
import { sendLineNotification } from './services/lineNotify';
import { playNotificationChime } from './utils/audio';
import { extractCustomerCoords } from './utils/geoUtils';
import {
  getDriveImageDisplayUrl,
  resolveStorePhotoUrl,
  resolveCheckInPhotoUrl,
} from './services/googleDrive';

// Eager Core Components (always needed on initial load)
import { Navbar } from './components/Navbar';
import { TotalEmblem } from './components/TotalLogo';
import { LoginScreen } from './components/LoginScreen';
import { ConfirmModal } from './components/ConfirmModal';

// Resilient lazy loader: retries once on transient network/Vite dep re-opt error,
// and reloads the page once (guarded by sessionStorage) if a stale chunk hash fails to load.
const lazyWithRetry = <T extends React.ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  chunkName: string
) =>
  lazy(async () => {
    try {
      const mod = await importer();
      try {
        sessionStorage.removeItem(`iora_chunk_retry_${chunkName}`);
      } catch {
        // ignore storage errors
      }
      return mod;
    } catch (firstErr) {
      await new Promise((r) => setTimeout(r, 350));
      try {
        return await importer();
      } catch (secondErr) {
        const key = `iora_chunk_retry_${chunkName}`;
        let alreadyRetried = false;
        try {
          alreadyRetried = sessionStorage.getItem(key) === '1';
          if (!alreadyRetried) sessionStorage.setItem(key, '1');
        } catch {
          // ignore storage errors
        }
        if (!alreadyRetried && typeof window !== 'undefined') {
          window.location.reload();
          return new Promise<{ default: T }>(() => {});
        }
        throw secondErr;
      }
    }
  });

// Lazy-Loaded Views & Modals (code-split into separate chunks)
const OrderList = lazyWithRetry(() => import('./components/OrderList').then((m) => ({ default: m.OrderList })), 'OrderList');
const DashboardView = lazyWithRetry(() => import('./components/DashboardView').then((m) => ({ default: m.DashboardView })), 'DashboardView');
const CustomerManagementView = lazyWithRetry(() => import('./components/CustomerManagementView').then((m) => ({ default: m.CustomerManagementView })), 'CustomerManagementView');
const StoreCheckInView = lazyWithRetry(() => import('./components/StoreCheckInView').then((m) => ({ default: m.StoreCheckInView })), 'StoreCheckInView');
const ExpenseManagementView = lazyWithRetry(() => import('./components/ExpenseManagementView').then((m) => ({ default: m.ExpenseManagementView })), 'ExpenseManagementView');
const NewCustomerModal = lazyWithRetry(() => import('./components/NewCustomerModal').then((m) => ({ default: m.NewCustomerModal })), 'NewCustomerModal');
const RouteManagementView = lazyWithRetry(() => import('./components/RouteManagementView').then((m) => ({ default: m.RouteManagementView })), 'RouteManagementView');
const OrderFormModal = lazyWithRetry(() => import('./components/OrderFormModal').then((m) => ({ default: m.OrderFormModal })), 'OrderFormModal');
const OrderDetailModal = lazyWithRetry(() => import('./components/OrderDetailModal').then((m) => ({ default: m.OrderDetailModal })), 'OrderDetailModal');
const ExportReportView = lazyWithRetry(() => import('./components/ExportReportView').then((m) => ({ default: m.ExportReportView })), 'ExportReportView');
const SettingsModal = lazyWithRetry(() => import('./components/SettingsModal').then((m) => ({ default: m.SettingsModal })), 'SettingsModal');
const RoleSwitcherModal = lazyWithRetry(() => import('./components/RoleSwitcherModal').then((m) => ({ default: m.RoleSwitcherModal })), 'RoleSwitcherModal');
const UserManagementView = lazyWithRetry(() => import('./components/UserManagementView').then((m) => ({ default: m.UserManagementView })), 'UserManagementView');
const LogisticsDashboardView = lazyWithRetry(() => import('./components/LogisticsDashboardView').then((m) => ({ default: m.LogisticsDashboardView })), 'LogisticsDashboardView');
const LogisticsManagementView = lazyWithRetry(() => import('./components/LogisticsManagementView').then((m) => ({ default: m.LogisticsManagementView })), 'LogisticsManagementView');
const DepositManagementView = lazyWithRetry(() => import('./components/DepositManagementView').then((m) => ({ default: m.DepositManagementView })), 'DepositManagementView');
const HiredVehicleExpensesView = lazyWithRetry(() => import('./components/HiredVehicleExpensesView').then((m) => ({ default: m.HiredVehicleExpensesView })), 'HiredVehicleExpensesView');
const FleetManagementView = lazyWithRetry(() => import('./components/FleetManagementView').then((m) => ({ default: m.FleetManagementView })), 'FleetManagementView');
const VehicleMaintenanceView = lazyWithRetry(() => import('./components/VehicleMaintenanceView').then((m) => ({ default: m.VehicleMaintenanceView })), 'VehicleMaintenanceView');

import {
  CheckCircle2,
  AlertCircle,
  X,
  ChevronDown,
  MapPin,
  Phone,
  Store,
  Loader2,
  RefreshCw,
} from 'lucide-react';

// Re-export shared date utilities for backwards compatibility with any child modules
export { parseDateRobust, formatThaiDateTime };

type PendingSyncJob =
  | {
      jobId: string;
      kind: 'customer';
      label: string;
      isNew: boolean;
      payload: Customer;
      status: 'pending' | 'syncing' | 'failed';
      error?: string;
      createdAt: number;
    }
  | {
      jobId: string;
      kind: 'checkin';
      label: string;
      payload: StoreCheckIn;
      status: 'pending' | 'syncing' | 'failed';
      error?: string;
      createdAt: number;
    };

const PENDING_SYNC_QUEUE_KEY = 'iora_pending_sync_queue';

type AppTab =
  | 'orders'
  | 'dashboard'
  | 'customers'
  | 'checkin'
  | 'expenses'
  | 'users'
  | 'routes'
  | 'export'
  | 'new_order'
  | 'logistics_dashboard'
  | 'logistics'
  | 'deposits'
  | 'hired_vehicles'
  | 'fleet_vehicles'
  | 'maintenance';

const SALES_ALLOWED_TABS: ReadonlyArray<AppTab> = [
  'customers',
  'checkin',
  'orders',
  'expenses',
  'dashboard',
  'new_order',
];

const DELIVERY_ALLOWED_TABS: ReadonlyArray<AppTab> = [
  'logistics_dashboard',
  'logistics',
  'deposits',
  'hired_vehicles',
  'fleet_vehicles',
  'maintenance',
];

// Lightweight fallback shown briefly while a lazy tab chunk loads
const ViewLoadingFallback: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
    <div className="w-11 h-11 rounded-2xl bg-[#F1F5F9] border border-slate-200 flex items-center justify-center shadow-2xs">
      <Loader2 className="w-5 h-5 text-[#1D4ED8] animate-spin" />
    </div>
    <p className="text-xs font-semibold text-slate-500">กำลังโหลดหน้าจอ...</p>
  </div>
);

// Safe immediate write to localStorage
function safeSave(key: string, value: unknown) {
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch (e) {
    console.warn(`[Storage] Safe save skipped for ${key}:`, e);
  }
}

// Debounced & idle-scheduled localStorage writer to prevent main-thread jank on large collections
const pendingStorageWrites = new Map<string, unknown>();
const pendingStorageTimers = new Map<string, ReturnType<typeof setTimeout>>();

function flushStorageKey(key: string) {
  const timer = pendingStorageTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    pendingStorageTimers.delete(key);
  }
  if (pendingStorageWrites.has(key)) {
    const val = pendingStorageWrites.get(key);
    pendingStorageWrites.delete(key);
    safeSave(key, val);
  }
}

function flushAllPendingStorageWrites() {
  for (const key of Array.from(pendingStorageWrites.keys())) {
    flushStorageKey(key);
  }
}

function scheduleStorageSave(key: string, value: unknown, delayMs = 350) {
  pendingStorageWrites.set(key, value);
  const existing = pendingStorageTimers.get(key);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    pendingStorageTimers.delete(key);
    const performWrite = () => {
      if (pendingStorageWrites.has(key)) {
        const latest = pendingStorageWrites.get(key);
        pendingStorageWrites.delete(key);
        safeSave(key, latest);
      }
    };
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number })
        .requestIdleCallback(performWrite, { timeout: 1000 });
    } else {
      performWrite();
    }
  }, delayMs);

  pendingStorageTimers.set(key, timer);
}



export function sanitizeOrderData(orderList: Order[]): Order[] {
  if (!Array.isArray(orderList)) return [];
  return orderList.map((o: Order) => ({
    ...o,
    id: String(o.id || ''),
    orderNumber: o.orderNumber !== undefined && o.orderNumber !== null ? String(o.orderNumber) : '',
    createdAt: String(o.createdAt || ''),
    salespersonId: String(o.salespersonId || ''),
    salespersonName: String(o.salespersonName || ''),
    customerName: String(o.customerName || ''),
    customerPhone: normalizeThaiPhone(o.customerPhone),
    requestedDeliveryDate: String(o.requestedDeliveryDate || ''),
    note: String(o.note || ''),
    totalAmount: typeof o.totalAmount === 'number' && !isNaN(o.totalAmount) ? o.totalAmount : parseFloat(String(o.totalAmount || 0)) || 0,
    discount: typeof o.discount === 'number' && !isNaN(o.discount) ? o.discount : parseFloat(String(o.discount || 0)) || 0,
    netAmount: typeof o.netAmount === 'number' && !isNaN(o.netAmount) ? o.netAmount : parseFloat(String(o.netAmount || 0)) || 0,
    items: Array.isArray(o.items)
      ? o.items.map((it: any) => ({
          ...it,
          quantity: Number(it.quantity) || 0,
          unitPrice: typeof it.unitPrice === 'number' && !isNaN(it.unitPrice) ? it.unitPrice : parseFloat(String(it.unitPrice || it.price || 0)) || 0,
          subtotal: typeof it.subtotal === 'number' && !isNaN(it.subtotal) ? it.subtotal : parseFloat(String(it.subtotal || 0)) || 0,
          unit: it.unit || 'ชิ้น',
        }))
      : [],
    freebies: Array.isArray(o.freebies) ? o.freebies : [],
    location: o.location ? {
      address: String(o.location.address || ''),
      latitude: typeof o.location.latitude === 'number' ? o.location.latitude : undefined,
      longitude: typeof o.location.longitude === 'number' ? o.location.longitude : undefined,
      mapsUrl: String(o.location.mapsUrl || ''),
    } : { mapsUrl: '' },
  }));
}

export function sanitizeCustomerData(customerList: Customer[]): Customer[] {
  if (!Array.isArray(customerList)) return [];
  return customerList.map((c: Customer) => ({
    ...c,
    id: String(c.id || ''),
    name: String(c.name || ''),
    phone: normalizeThaiPhone(c.phone),
    address: String(c.address || ''),
    mapsUrl: String(c.mapsUrl || ''),
    routeName: String(c.routeName || ''),
    updatedAt: String(c.updatedAt || ''),
    photoUrls: Array.isArray(c.photoUrls)
      ? c.photoUrls.map((u) => String(u || '').trim()).filter(Boolean).slice(0, 3)
      : [],
  }));
}

export default function App() {
  // 1. Core State (initialized with empty mock data, removing any previous cached mock data)
  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('iora_orders');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Filter out mock orders (e.g. ord-101..105, or demo customers)
          const nonMock = parsed.filter(
            (o: Order) =>
              !['ord-101', 'ord-102', 'ord-103', 'ord-104', 'ord-105'].includes(o.id) &&
              !o.customerName?.includes('คอฟฟี่คอร์เนอร์') &&
              !o.customerName?.includes('สยามซอฟต์') &&
              !o.customerName?.includes('ลัดดาวัลย์') &&
              !o.customerName?.includes('สไมล์พลัส') &&
              !o.customerName?.includes('ชาบูหม้อไฟทอง')
          );
          return sanitizeOrderData(nonMock);
        }
      } catch (e) {
        console.error('Error parsing saved orders:', e);
      }
    }
    return INITIAL_ORDERS;
  });

  const [staffList, setStaffList] = useState<StaffUser[]>(() => {
    const saved = localStorage.getItem('iora_staff_list');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const mockEmails = [
            'somchai.sales@iorawater.com',
            'naphaporn.sales@iorawater.com',
            'surachai.manager@iorawater.com',
            'wichai.delivery@iorawater.com',
            'auditor.view@iorawater.com',
          ];
          const nonMock = parsed.filter(
            (u: StaffUser) => !mockEmails.includes(u.email?.toLowerCase())
          );
          if (nonMock.length > 0) return nonMock;
        }
      } catch (e) {}
    }
    return INITIAL_STAFF_USERS;
  });

  const [currentUser, setCurrentUser] = useState<StaffUser>(() => {
    const saved = localStorage.getItem('iora_current_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const mockEmails = [
          'somchai.sales@iorawater.com',
          'naphaporn.sales@iorawater.com',
          'surachai.manager@iorawater.com',
          'wichai.delivery@iorawater.com',
          'auditor.view@iorawater.com',
        ];
        if (parsed && !mockEmails.includes(parsed.email?.toLowerCase())) {
          return parsed;
        }
      } catch (e) {}
    }
    return INITIAL_STAFF_USERS[0];
  });

  // Login Session state (defaults to true if user was already logged in)
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    const saved = localStorage.getItem('iora_logged_in');
    return saved === 'true';
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('iora_products');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const mockSkus = [
            'WTR-600-12',
            'WTR-1500-6',
            'WTR-189L',
            'MNR-500-12',
            'PUMP-USB-01',
            'DSP-HOTCOLD',
            'CPN-189L-20',
            'ICE-BAG-10K',
          ];
          const nonMock = parsed.filter(
            (p: Product) =>
              !mockSkus.includes(p.sku) &&
              !['prod-1', 'prod-2', 'prod-3', 'prod-4', 'prod-5', 'prod-6', 'prod-7', 'prod-8'].includes(p.id)
          );
          return nonMock;
        }
      } catch (e) {}
    }
    return INITIAL_PRODUCTS;
  });

  const [routes, setRoutes] = useState<Route[]>(() => {
    try {
      const purgeKey = 'iora_route_cache_purged_v2';
      if (!localStorage.getItem(purgeKey)) {
        localStorage.removeItem('iora_routes');
        localStorage.removeItem('iora_call_plan_daily_schedule');
        localStorage.removeItem('iora_route_schedule_history');
        localStorage.setItem(purgeKey, new Date().toISOString());
        return [];
      }
      const saved = localStorage.getItem('iora_routes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const mockRouteIds = new Set(['R-S01', 'R-S02', 'R-S03', 'R-S04', 'R-S05']);
          return parsed.filter((r: Route) => !mockRouteIds.has(r?.id));
        }
      }
    } catch (e) {}
    return INITIAL_ROUTES;
  });

  const [dailySchedules, setDailySchedules] = useState<Record<string, DailyRouteSchedule>>(() => {
    const saved = localStorage.getItem('iora_call_plan_daily_schedule');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch (e) {}
    }
    return {};
  });
  const [routeScheduleHistory, setRouteScheduleHistory] = useState<RouteScheduleHistoryEntry[]>(() => {
    const saved = localStorage.getItem('iora_route_schedule_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });
  const [checkIns, setCheckIns] = useState<import('./types').StoreCheckIn[]>(() => {
    const saved = localStorage.getItem('iora_checkins');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });
  const [expenses, setExpenses] = useState<import('./types').Expense[]>(() => {
    const saved = localStorage.getItem('iora_expenses');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((e: import('./types').Expense) => ({
            ...e,
            amount: typeof e.amount === 'number' ? e.amount : parseFloat(String(e.amount || 0)) || 0,
            distance: e.distance !== undefined ? (typeof e.distance === 'number' ? e.distance : parseFloat(String(e.distance || 0)) || 0) : undefined,
          }));
        }
      } catch (e) {}
    }
    return [];
  });
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('iora_customers');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const mockIds = new Set([
            'CUST-001',
            'CUST-002',
            'CUST-003',
            'CUST-004',
            'CUST-005',
            'CUST-006',
            'CUST-007',
            'CUST-008',
          ]);
          const mockNames = [
            'คอฟฟี่คอร์เนอร์',
            'สยามซอฟต์',
            'สหปัญญา',
            'สมศักดิ์ ภักดี',
            'ชาบูหม้อไฟทอง',
            'ปรีชา ลัดดาวัลย์',
            'สไมล์พลัส',
            'ร้านเจ๊พร มินิมาร์ท',
            'บิ๊กเกอร์ มาร์เก็ต',
            'ร้านโกรเซอรี่ 24',
            'ร้านกาแฟชาวดอย แยกลำสาลี',
            'สหฟู้ดส์ ตลาดไท',
            'ร้านป้าแมว ของชำ',
            'มหาชัยซีฟู้ดแอนด์มาร์ท',
            'ร้านค้าชุมชนศาลายา',
          ];
          const nonMock = parsed.filter(
            (c: Customer) =>
              !mockIds.has(String(c?.id || '')) &&
              !mockNames.some((m) => c.name?.includes(m))
          );
          return sanitizeCustomerData(nonMock);
        }
      } catch (e) {}
    }
    return sanitizeCustomerData(INITIAL_CUSTOMERS);
  });

  const [deposits, setDeposits] = useState<DepositRecord[]>(() => {
    const saved = localStorage.getItem('iora_deposits');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });

  const [partnerDepositDeductions, setPartnerDepositDeductions] = useState<PartnerDepositDeduction[]>(() => {
    const saved = localStorage.getItem('iora_partner_deposit_deductions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });

  const [partnerDepositWithdrawals, setPartnerDepositWithdrawals] = useState<PartnerDepositWithdrawal[]>(() => {
    const saved = localStorage.getItem('iora_partner_deposit_withdrawals');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });

  const [hiredVehicles, setHiredVehicles] = useState<HiredVehicleTripRecord[]>(() => {
    const saved = localStorage.getItem('iora_hired_vehicles');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (t: HiredVehicleTripRecord) => !String(t?.id || '').startsWith('trip-demo-')
          );
        }
      } catch (e) {}
    }
    return INITIAL_HIRED_VEHICLES;
  });

  const [maintenanceRecords, setMaintenanceRecords] = useState<VehicleMaintenanceRecord[]>(() => {
    const saved = localStorage.getItem('iora_vehicle_maintenance');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const mockMaintenanceIds = new Set([
            'mnt-2026-001',
            'mnt-2026-002',
            'mnt-2026-003',
            'mnt-2026-004',
            'mnt-2026-005',
            'mnt-2026-006',
            'mnt-2026-007',
            'mnt-2026-008',
            'mnt-2026-009',
            'mnt-2026-010',
            'mnt-2026-011',
            'mnt-2026-012',
          ]);
          return parsed.filter(
            (m: VehicleMaintenanceRecord) => !mockMaintenanceIds.has(String(m?.id || ''))
          );
        }
      } catch (e) {}
    }
    return INITIAL_MAINTENANCE_RECORDS;
  });

  const [fleetVehicles, setFleetVehicles] = useState<FleetVehicle[]>(() => {
    const saved = localStorage.getItem('iora_fleet_vehicles');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const mockFleetIds = new Set(['veh-001', 'veh-002', 'veh-003', 'veh-004', 'veh-005']);
          return parsed.filter((v: FleetVehicle) => !mockFleetIds.has(String(v?.id || '')));
        }
      } catch (e) {}
    }
    return INITIAL_FLEET_VEHICLES;
  });

  const [activeTab, setActiveTab] = useState<AppTab>(() =>
    currentUser.role === 'delivery' ? 'logistics_dashboard' : 'dashboard'
  );
  const [checkInEntryCount, setCheckInEntryCount] = useState<number>(0);

  const handleSelectTab = useCallback((tab: AppTab) => {
    if (currentUser.role === 'sales' && !SALES_ALLOWED_TABS.includes(tab)) {
      return;
    }
    if (currentUser.role === 'delivery' && !DELIVERY_ALLOWED_TABS.includes(tab)) {
      return;
    }
    if (tab === 'checkin') {
      setCheckInEntryCount((prev) => prev + 1);
    }
    setActiveTab(tab);
  }, [currentUser.role]);

  useEffect(() => {
    if (currentUser.role === 'sales' && !SALES_ALLOWED_TABS.includes(activeTab)) {
      setActiveTab('dashboard');
    } else if (currentUser.role === 'delivery' && !DELIVERY_ALLOWED_TABS.includes(activeTab)) {
      setActiveTab('logistics_dashboard');
    }
  }, [currentUser.role, activeTab]);

  // 2. Integration Configs
  const [sheetsConfig, setSheetsConfig] = useState<SheetsConfig>(() => {
    const saved = localStorage.getItem('iora_sheets_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          const parsedGasUrl = typeof parsed.gasUrl === 'string' ? parsed.gasUrl.trim() : '';
          const resolvedGasUrl =
            !parsedGasUrl || parsedGasUrl === LEGACY_DEFAULT_GAS_URL
              ? DEFAULT_SHEETS_CONFIG.gasUrl
              : parsedGasUrl;
          return { 
            ...DEFAULT_SHEETS_CONFIG, 
            ...parsed,
            spreadsheetId: parsed.spreadsheetId || DEFAULT_SHEETS_CONFIG.spreadsheetId,
            spreadsheetUrl: parsed.spreadsheetUrl || DEFAULT_SHEETS_CONFIG.spreadsheetUrl,
            gasUrl: resolvedGasUrl,
            storePhotoFolderId:
              parsed.storePhotoFolderId || DEFAULT_SHEETS_CONFIG.storePhotoFolderId,
            checkInPhotoFolderId:
              parsed.checkInPhotoFolderId || DEFAULT_SHEETS_CONFIG.checkInPhotoFolderId,
          };
        }
      } catch (e) {}
    }
    return DEFAULT_SHEETS_CONFIG;
  });

  const [lineSettings, setLineSettings] = useState<LineSettings>(() => {
    const saved = localStorage.getItem('iora_line_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return { ...DEFAULT_LINE_SETTINGS, ...parsed };
        }
      } catch (e) {}
    }
    return DEFAULT_LINE_SETTINGS;
  });

  // 3. Google Authentication
  
  

  // 4. Modals State
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isNewCustomerOpen, setIsNewCustomerOpen] = useState(false);
  const [preselectedCustomerForOrder, setPreselectedCustomerForOrder] = useState<Customer | null>(null);
  const [preselectedCustomerForCheckIn, setPreselectedCustomerForCheckIn] = useState<Customer | null>(null);
  const [isRoleSwitcherOpen, setIsRoleSwitcherOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<Order | null>(null);
  const [savedCustomerSuccessPopup, setSavedCustomerSuccessPopup] = useState<{
    customer: Customer;
    isEdit: boolean;
  } | null>(null);

  // Confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Toast Notification
  const [toast, setToast] = useState<{
    id: string;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  } | null>(null);

  const showToast = useCallback((type: 'success' | 'error' | 'info', title: string, message: string) => {
    const id = Date.now().toString();
    setToast({ id, type, title, message });
    setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, 5000);
  }, []);

  // Skip initial mount re-serialization; flush pending debounced writes before page unload
  const hasMountedRef = useRef(false);
  useEffect(() => {
    hasMountedRef.current = true;
    const handleBeforeUnload = () => flushAllPendingStorageWrites();
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      flushAllPendingStorageWrites();
    };
  }, []);

  // Debounced / idle-scheduled LocalStorage persistence for large data collections
  useEffect(() => {
    if (!hasMountedRef.current) return;
    scheduleStorageSave('iora_orders', orders);
  }, [orders]);

  useEffect(() => {
    if (!hasMountedRef.current) return;
    scheduleStorageSave('iora_staff_list', staffList);
  }, [staffList]);

  useEffect(() => {
    if (!hasMountedRef.current) return;
    scheduleStorageSave('iora_products', products);
  }, [products]);

  useEffect(() => {
    if (!hasMountedRef.current) return;
    scheduleStorageSave('iora_customers', customers);
  }, [customers]);

  useEffect(() => {
    if (!hasMountedRef.current) return;
    scheduleStorageSave('iora_checkins', checkIns);
  }, [checkIns]);

  useEffect(() => {
    if (!hasMountedRef.current) return;
    scheduleStorageSave('iora_expenses', expenses);
  }, [expenses]);

  useEffect(() => {
    if (!hasMountedRef.current) return;
    scheduleStorageSave('iora_deposits', deposits);
  }, [deposits]);

  useEffect(() => {
    if (!hasMountedRef.current) return;
    scheduleStorageSave('iora_partner_deposit_deductions', partnerDepositDeductions);
  }, [partnerDepositDeductions]);

  useEffect(() => {
    if (!hasMountedRef.current) return;
    scheduleStorageSave('iora_partner_deposit_withdrawals', partnerDepositWithdrawals);
  }, [partnerDepositWithdrawals]);

  useEffect(() => {
    if (!hasMountedRef.current) return;
    scheduleStorageSave('iora_hired_vehicles', hiredVehicles);
  }, [hiredVehicles]);

  useEffect(() => {
    if (!hasMountedRef.current) return;
    scheduleStorageSave('iora_vehicle_maintenance', maintenanceRecords);
  }, [maintenanceRecords]);

  useEffect(() => {
    if (!hasMountedRef.current) return;
    scheduleStorageSave('iora_fleet_vehicles', fleetVehicles);
  }, [fleetVehicles]);

  useEffect(() => {
    if (!hasMountedRef.current) return;
    scheduleStorageSave('iora_routes', routes);
  }, [routes]);

  useEffect(() => {
    if (!hasMountedRef.current) return;
    scheduleStorageSave('iora_call_plan_daily_schedule', dailySchedules);
  }, [dailySchedules]);

  useEffect(() => {
    if (!hasMountedRef.current) return;
    scheduleStorageSave('iora_route_schedule_history', routeScheduleHistory);
  }, [routeScheduleHistory]);

  // Immediate persistence for tiny critical auth/config keys
  useEffect(() => {
    if (!hasMountedRef.current) return;
    safeSave('iora_current_user', currentUser);
  }, [currentUser]);

  useEffect(() => {
    if (!hasMountedRef.current) return;
    safeSave('iora_logged_in', isLoggedIn ? 'true' : 'false');
  }, [isLoggedIn]);

  useEffect(() => {
    if (!hasMountedRef.current) return;
    safeSave('iora_sheets_config', sheetsConfig);
  }, [sheetsConfig]);

  useEffect(() => {
    if (!hasMountedRef.current) return;
    safeSave('iora_line_settings', lineSettings);
  }, [lineSettings]);

  const syncedConfigSpreadsheetRef = useRef<string>('');

  const syncSharedConfigFromCloud = useCallback(async (config: SheetsConfig) => {
    if (!config?.spreadsheetId) return;
    try {
      const cloud = await fetchSharedSystemConfig(config.spreadsheetId, config.gasUrl);
      if (cloud && (cloud.gasUrl || cloud.storePhotoFolderId || cloud.checkInPhotoFolderId)) {
        setSheetsConfig((prev) => {
          const nextGasUrl = cloud.gasUrl || prev.gasUrl || DEFAULT_GAS_URL;
          const nextStoreFolder =
            cloud.storePhotoFolderId !== undefined && cloud.storePhotoFolderId !== ''
              ? cloud.storePhotoFolderId
              : prev.storePhotoFolderId || '';
          const nextCheckInFolder =
            cloud.checkInPhotoFolderId !== undefined && cloud.checkInPhotoFolderId !== ''
              ? cloud.checkInPhotoFolderId
              : prev.checkInPhotoFolderId || '';

          if (
            nextGasUrl === (prev.gasUrl || '') &&
            nextStoreFolder === (prev.storePhotoFolderId || '') &&
            nextCheckInFolder === (prev.checkInPhotoFolderId || '')
          ) {
            return prev;
          }

          const merged: SheetsConfig = {
            ...prev,
            gasUrl: nextGasUrl,
            storePhotoFolderId: nextStoreFolder,
            checkInPhotoFolderId: nextCheckInFolder,
          };
          return merged;
        });
      } else {
        // Cloud SystemConfig does not exist yet: if THIS device already has a custom v4 GAS URL
        // or Drive folder IDs configured locally, automatically publish them to Google Sheets
        // so all other devices receive them without manual setup.
        const hasCustomGasUrl = Boolean(config.gasUrl && config.gasUrl.trim() !== DEFAULT_GAS_URL);
        const hasCustomFolders = Boolean(
          (config.storePhotoFolderId && config.storePhotoFolderId.trim()) ||
            (config.checkInPhotoFolderId && config.checkInPhotoFolderId.trim())
        );
        if (hasCustomGasUrl || hasCustomFolders) {
          await saveSharedSystemConfig(
            config.spreadsheetId,
            {
              gasUrl: config.gasUrl,
              storePhotoFolderId: config.storePhotoFolderId,
              checkInPhotoFolderId: config.checkInPhotoFolderId,
            },
            config.gasUrl
          );
        }
      }
    } catch (err) {
      console.warn('[SystemConfig Sync] Notice:', err);
    }
  }, []);

  // Auto-sync shared GAS URL & Drive folders with Google Sheets on startup
  useEffect(() => {
    const sid = sheetsConfig?.spreadsheetId;
    if (!sid) return;
    if (syncedConfigSpreadsheetRef.current === sid) return;
    syncedConfigSpreadsheetRef.current = sid;
    syncSharedConfigFromCloud(sheetsConfig);
  }, [sheetsConfig, syncSharedConfigFromCloud]);

  // Listen for self-healed config updates dispatched by googleDrive service
  useEffect(() => {
    const handleSyncedEvent = (event: Event) => {
      const detail = (event as CustomEvent)?.detail;
      if (!detail || typeof detail !== 'object') return;
      setSheetsConfig((prev) => {
        const nextGasUrl = detail.gasUrl || prev.gasUrl;
        const nextStoreFolder =
          detail.storePhotoFolderId !== undefined
            ? detail.storePhotoFolderId
            : prev.storePhotoFolderId;
        const nextCheckInFolder =
          detail.checkInPhotoFolderId !== undefined
            ? detail.checkInPhotoFolderId
            : prev.checkInPhotoFolderId;
        if (
          nextGasUrl === prev.gasUrl &&
          nextStoreFolder === prev.storePhotoFolderId &&
          nextCheckInFolder === prev.checkInPhotoFolderId
        ) {
          return prev;
        }
        return {
          ...prev,
          gasUrl: nextGasUrl,
          storePhotoFolderId: nextStoreFolder,
          checkInPhotoFolderId: nextCheckInFolder,
        };
      });
    };
    window.addEventListener('iora_sheets_config_synced', handleSyncedEvent);
    return () => window.removeEventListener('iora_sheets_config_synced', handleSyncedEvent);
  }, []);

  const handleUpdateSheetsConfig = useCallback((updated: SheetsConfig) => {
    setSheetsConfig(updated);
    if (updated?.spreadsheetId) {
      saveSharedSystemConfig(
        updated.spreadsheetId,
        {
          gasUrl: updated.gasUrl,
          storePhotoFolderId: updated.storePhotoFolderId,
          checkInPhotoFolderId: updated.checkInPhotoFolderId,
        },
        updated.gasUrl
      )
        .then((ok) => {
          if (ok) {
            showToast(
              'success',
              'ซิงค์การตั้งค่าไปทุกเครื่องแล้ว',
              'บันทึกลิงก์ Apps Script และโฟลเดอร์ Google Drive ลง Google Sheets เรียบร้อย เครื่องอื่นจะได้รับค่าล่าสุดอัตโนมัติ'
            );
          }
        })
        .catch((err) => console.warn('[handleUpdateSheetsConfig] Cloud sync error:', err));
    }
  }, []);

  

  // Master function: Load all data from database (Google Sheets)
  const loadAllDataFromDatabase = useCallback(async (options?: {
    isLogin?: boolean;
    onProgress?: (message: string, progressPercent?: number) => void;
  }): Promise<{ success: boolean; message: string }> => {
    if (!sheetsConfig?.spreadsheetId) {
      options?.onProgress?.('พร้อมใช้งาน (โหมดออฟไลน์)', 100);
      return { success: true, message: 'Offline mode active' };
    }

    setIsLoadingData(true);
    options?.onProgress?.('กำลังเชื่อมต่อฐานข้อมูล Google Sheets...', 15);

    try {
      // 1. Auto-repair tabs and headers in background
      ensureAllSheetsTabs(sheetsConfig.spreadsheetId, sheetsConfig.sheetName)
        .catch(e => console.warn('ensureAllSheetsTabs error:', e));

      options?.onProgress?.('กำลังดึงข้อมูลทั้งหมดจากฐานข้อมูล...', 35);

      // 2. Try bulk fetch first (fastest, single roundtrip)
      let sheetOrders: Order[] | null = null;
      let sheetUsers: StaffUser[] | null = null;
      let sheetProducts: Product[] | null = null;
      let sheetCustomers: Customer[] | null = null;
      let sheetRoutes: Route[] | null = null;
      let sheetCheckIns: StoreCheckIn[] | null = null;
      let sheetExpenses: Expense[] | null = null;
      let sheetDeposits: DepositRecord[] | null = null;
      let sheetHiredVehicles: HiredVehicleTripRecord[] | null = null;
      let sheetMaintenance: VehicleMaintenanceRecord[] | null = null;
      let sheetFleetVehicles: FleetVehicle[] | null = null;
      let sheetDailySchedules: Record<string, DailyRouteSchedule> | null = null;
      let sheetRouteHistory: RouteScheduleHistoryEntry[] | null = null;
      let sheetPartnerDepositDeductions: PartnerDepositDeduction[] | null = null;
      let sheetPartnerDepositWithdrawals: PartnerDepositWithdrawal[] | null = null;

      try {
        const bulkData = await fetchAllDataBulk(sheetsConfig.spreadsheetId, sheetsConfig.sheetName);
        if (bulkData) {
          sheetOrders = bulkData.orders;
          sheetUsers = bulkData.users;
          sheetProducts = bulkData.products;
          sheetCustomers = bulkData.customers;
          sheetRoutes = bulkData.routes;
          if (Array.isArray(bulkData.checkIns)) sheetCheckIns = bulkData.checkIns;
          if (Array.isArray(bulkData.expenses)) sheetExpenses = bulkData.expenses;
          if (Array.isArray((bulkData as any).deposits)) sheetDeposits = (bulkData as any).deposits;
          if (Array.isArray((bulkData as any).hiredVehicles)) sheetHiredVehicles = (bulkData as any).hiredVehicles;
          if (Array.isArray((bulkData as any).maintenanceRecords)) sheetMaintenance = (bulkData as any).maintenanceRecords;
          if (Array.isArray((bulkData as any).fleetVehicles)) sheetFleetVehicles = (bulkData as any).fleetVehicles;
          if ((bulkData as any).dailySchedules && typeof (bulkData as any).dailySchedules === 'object') {
            sheetDailySchedules = (bulkData as any).dailySchedules;
          }
          if (Array.isArray((bulkData as any).routeScheduleHistory)) {
            sheetRouteHistory = (bulkData as any).routeScheduleHistory;
          }
          if (Array.isArray((bulkData as any).partnerDepositDeductions)) {
            sheetPartnerDepositDeductions = (bulkData as any).partnerDepositDeductions;
          }
          if (Array.isArray((bulkData as any).partnerDepositWithdrawals)) {
            sheetPartnerDepositWithdrawals = (bulkData as any).partnerDepositWithdrawals;
          }
        }
      } catch (bulkErr: any) {
        console.warn('Bulk fetch not supported or failed, falling back to parallel fetch:', bulkErr?.message || bulkErr);
      }

      options?.onProgress?.('กำลังตรวจสอบและอัปเดตข้อมูลแยกแท็บ...', 60);

      // 3. If any tables are missing from bulk, fetch in parallel (skip logistics-only tables for sales role)
      const isSalesOnly = currentUser?.role === 'sales';
      const needsOrders = !sheetOrders;
      const needsUsers = !sheetUsers;
      const needsProducts = !sheetProducts;
      const needsCustomers = !sheetCustomers;
      const needsRoutes = !sheetRoutes;
      const needsCheckIns = !sheetCheckIns;
      const needsExpenses = !sheetExpenses;
      const needsDeposits = !isSalesOnly && !sheetDeposits;
      const needsHiredVehicles = !isSalesOnly && !sheetHiredVehicles;
      const needsMaintenance = !isSalesOnly && !sheetMaintenance;
      const needsFleetVehicles = !isSalesOnly && !sheetFleetVehicles;
      const needsDailySchedules = !sheetDailySchedules;
      const needsRouteHistory = !sheetRouteHistory;
      const needsPartnerDeposits =
        !isSalesOnly &&
        (!sheetPartnerDepositDeductions || !sheetPartnerDepositWithdrawals);

      const [
        ordersRes,
        usersRes,
        productsRes,
        customersRes,
        routesRes,
        checkInsRes,
        expensesRes,
        depositsRes,
        hiredRes,
        mntRes,
        fleetRes,
        dailySchedulesRes,
        routeHistoryRes,
        partnerDepositsRes,
      ] = await Promise.allSettled([
        needsOrders ? fetchOrdersFromSheet(sheetsConfig) : Promise.resolve(sheetOrders),
        needsUsers ? fetchUsersFromSheets(sheetsConfig.spreadsheetId) : Promise.resolve(sheetUsers),
        needsProducts ? fetchProductsFromSheet(sheetsConfig.spreadsheetId) : Promise.resolve(sheetProducts),
        needsCustomers ? fetchCustomersFromSheet(sheetsConfig.spreadsheetId) : Promise.resolve(sheetCustomers),
        needsRoutes ? fetchRoutesFromSheet(sheetsConfig.spreadsheetId) : Promise.resolve(sheetRoutes),
        needsCheckIns ? fetchCheckInsFromSheet(sheetsConfig.spreadsheetId) : Promise.resolve(sheetCheckIns),
        needsExpenses ? fetchExpensesFromSheet(sheetsConfig.spreadsheetId) : Promise.resolve(sheetExpenses),
        needsDeposits ? fetchDepositsFromSheet(sheetsConfig.spreadsheetId) : Promise.resolve(sheetDeposits),
        needsHiredVehicles ? fetchHiredVehicleTripsFromSheet(sheetsConfig.spreadsheetId) : Promise.resolve(sheetHiredVehicles),
        needsMaintenance ? fetchMaintenanceFromSheet(sheetsConfig.spreadsheetId) : Promise.resolve(sheetMaintenance),
        needsFleetVehicles ? fetchFleetVehiclesFromSheet(sheetsConfig.spreadsheetId) : Promise.resolve(sheetFleetVehicles),
        needsDailySchedules ? fetchDailyRouteSchedulesFromSheet(sheetsConfig.spreadsheetId) : Promise.resolve(sheetDailySchedules),
        needsRouteHistory ? fetchRouteScheduleHistoryFromSheet(sheetsConfig.spreadsheetId) : Promise.resolve(sheetRouteHistory),
        needsPartnerDeposits
          ? fetchPartnerDepositDataFromSheet(sheetsConfig.spreadsheetId)
          : Promise.resolve({
              vehicles: [],
              deductions: sheetPartnerDepositDeductions || [],
              withdrawals: sheetPartnerDepositWithdrawals || [],
            }),
      ]);

      options?.onProgress?.('กำลังประมวลผลข้อมูลและเตรียมระบบ...', 85);

      if (ordersRes.status === 'fulfilled' && Array.isArray(ordersRes.value)) {
        setOrders(sanitizeOrderData(ordersRes.value));
      }
      if (usersRes.status === 'fulfilled' && Array.isArray(usersRes.value) && usersRes.value.length > 0) {
        setStaffList(usersRes.value);
        const matched = usersRes.value.find(
          (u: StaffUser) => u?.email?.toLowerCase() === currentUser?.email?.toLowerCase()
        );
        if (matched && currentUser && (matched.role !== currentUser.role || matched.name !== currentUser.name)) {
          setCurrentUser(prev => ({
            ...prev,
            role: matched.role,
            name: matched.name,
          }));
        }
      }
      if (productsRes.status === 'fulfilled' && Array.isArray(productsRes.value)) {
        setProducts(productsRes.value);
      }
      if (customersRes.status === 'fulfilled' && Array.isArray(customersRes.value)) {
        setCustomers(sanitizeCustomerData(customersRes.value));
      }
      if (routesRes.status === 'fulfilled' && Array.isArray(routesRes.value)) {
        setRoutes(routesRes.value);
      }
      if (checkInsRes.status === 'fulfilled' && Array.isArray(checkInsRes.value)) {
        setCheckIns(checkInsRes.value);
      }
      if (expensesRes.status === 'fulfilled' && Array.isArray(expensesRes.value)) {
        setExpenses(expensesRes.value);
      }
      if (depositsRes.status === 'fulfilled' && Array.isArray(depositsRes.value)) {
        setDeposits(depositsRes.value);
      }
      if (hiredRes.status === 'fulfilled' && Array.isArray(hiredRes.value)) {
        setHiredVehicles(hiredRes.value);
      }
      if (mntRes.status === 'fulfilled' && Array.isArray(mntRes.value)) {
        setMaintenanceRecords(mntRes.value);
      }
      if (fleetRes.status === 'fulfilled' && Array.isArray(fleetRes.value)) {
        setFleetVehicles(fleetRes.value);
      }
      if (dailySchedulesRes.status === 'fulfilled' && dailySchedulesRes.value && typeof dailySchedulesRes.value === 'object') {
        setDailySchedules(dailySchedulesRes.value);
      }
      if (routeHistoryRes.status === 'fulfilled' && Array.isArray(routeHistoryRes.value)) {
        setRouteScheduleHistory(routeHistoryRes.value);
      }
      if (partnerDepositsRes.status === 'fulfilled' && partnerDepositsRes.value) {
        if (Array.isArray(partnerDepositsRes.value.deductions)) {
          setPartnerDepositDeductions(partnerDepositsRes.value.deductions);
        }
        if (Array.isArray(partnerDepositsRes.value.withdrawals)) {
          setPartnerDepositWithdrawals(partnerDepositsRes.value.withdrawals);
        }
      }

      options?.onProgress?.('ข้อมูลทั้งหมดพร้อมใช้งานเรียบร้อยแล้ว!', 100);
      return { success: true, message: 'Sync completed' };
    } catch (err: any) {
      if (err.message === 'GAS_HTML_LOGIN_REQUIRED' || err.message === 'HTML_RESPONSE') {
        console.warn('[Auto-sync] GAS returned HTML login page. Set "Who has access" to "Anyone" in Apps Script.');
      } else if (err.message === 'UNAUTHENTICATED') {
        console.warn('Session expired. Logging out.');
        logoutGoogle().then(() => {
          setCurrentUser(null);
        });
      } else {
        console.warn('[Auto-sync notice]', err?.message || err);
      }
      options?.onProgress?.('ใช้ข้อมูลที่บันทึกล่าสุดในเครื่อง', 100);
      return { success: false, message: err?.message || 'Sync failed' };
    } finally {
      setIsLoadingData(false);
    }
  }, [sheetsConfig, currentUser]);

  // Initial mount sync: If user is already logged in or spreadsheet is configured
  useEffect(() => {
    if (sheetsConfig?.spreadsheetId) {
      loadAllDataFromDatabase();
    }
  }, [sheetsConfig?.spreadsheetId, loadAllDataFromDatabase]);

  // Set / Update user password
  const handleUpdateUserPassword = async (email: string, newPass: string): Promise<boolean> => {
    const cleanEmail = email.trim().toLowerCase();
    setStaffList((prev) =>
      prev.map((u) => (u.email.toLowerCase() === cleanEmail ? { ...u, password: newPass } : u))
    );
    if (currentUser.email.toLowerCase() === cleanEmail) {
      setCurrentUser((prev) => ({ ...prev, password: newPass }));
    }

    if (sheetsConfig?.spreadsheetId) {
      try {
        const success = await setUserPasswordInSheet(sheetsConfig.spreadsheetId, cleanEmail, newPass);
        if (success) {
          showToast('success', 'บันทึกรหัสผ่านแล้ว', `อัปเดตรหัสผ่านของ ${cleanEmail} ลง Google Sheets เรียบร้อย`);
        }
        return success;
      } catch (err) {
        console.warn('Failed to set user password in sheet:', err);
        return false;
      }
    }
    return true;
  };

  // Login Handler
  const handleLoginAttempt = async (email: string, pass: string): Promise<{success: boolean, message?: string}> => {
    try {
      let currentStaffList = staffList;
      const cleanEmail = email.trim().toLowerCase();
      let matchedUser = currentStaffList.find(u => String(u?.email || '').trim().toLowerCase() === cleanEmail);

      // Pre-check with database if user not found in local cache
      if (!matchedUser && sheetsConfig?.spreadsheetId) {
        try {
          const freshUsers = await fetchUsersFromSheets(sheetsConfig.spreadsheetId);
          if (Array.isArray(freshUsers) && freshUsers.length > 0) {
            setStaffList(freshUsers);
            currentStaffList = freshUsers;
            matchedUser = freshUsers.find(u => String(u?.email || '').trim().toLowerCase() === cleanEmail);
          }
        } catch (e) {
          console.warn('Pre-login staff check failed, using local cache:', e);
        }
      }

      if (!matchedUser) {
        return { success: false, message: `ไม่พบอีเมล "${email}" ในระบบ` };
      }
      if (!matchedUser.password) {
        return { success: false, message: 'บัญชีนี้ยังไม่ได้ตั้งรหัสผ่าน กรุณาไปที่แท็บ "ตั้งรหัสผ่านใหม่"' };
      }
      if (String(matchedUser.password).trim() !== String(pass).trim()) {
        return { success: false, message: 'รหัสผ่านไม่ถูกต้อง' };
      }
      if (matchedUser.status === 'inactive') {
        return { success: false, message: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ' };
      }

      const finalUser = { ...matchedUser, lastLogin: new Date().toISOString() };
      setCurrentUser(finalUser);

      // Record login in background
      if (sheetsConfig?.spreadsheetId) {
        recordUserLoginInSheet(sheetsConfig.spreadsheetId, finalUser.email).catch(() => {});
      }

      return { success: true };
    } catch(err: any) {
      return { success: false, message: err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ' };
    }
  };

  const handleLogout = useCallback(() => {
    setIsLoggedIn(false);
    showToast('info', 'ออกจากระบบเรียบร้อย', 'ท่านสามารถเข้าสู่ระบบด้วยบัญชีอื่นได้');
  }, [showToast]);

  // Handle Switch User / Role
  const handleSwitchUser = (user: StaffUser) => {
    setCurrentUser(user);
    showToast('info', 'เปลี่ยนผู้ใช้งานแล้ว', `เข้าใช้งานในฐานะ: ${user.name} (${user.role})`);
  };

  // Create New Order Handler
  const handleCreateOrder = async (
    orderData: Omit<Order, 'id' | 'orderNumber' | 'syncedToSheets'>
  ) => {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const orderNumber = `ORD-${dateStr}-${randomSuffix}`;
    const newId = `ord-${Date.now()}`;

    const newOrder: Order = {
      ...orderData,
      id: newId,
      orderNumber,
      syncedToSheets: false,
    };

    // Optimistically add to list first
    setOrders((prev) => [newOrder, ...prev]);

    playNotificationChime('success');

    showToast(
      'success',
      'บันทึกออเดอร์สำเร็จ!',
      `สร้างออเดอร์ ${orderNumber} ยอดเงิน ฿${(newOrder.netAmount ?? 0).toLocaleString()}`
    );

    // Asynchronously sync to Google Sheets if configured
    if (sheetsConfig?.spreadsheetId) {
      appendOrderToSheet(sheetsConfig, newOrder)
        .then(() => {
          setOrders((current) =>
            current.map((o) => (o.id === newId ? { ...o, syncedToSheets: true } : o))
          );
        })
        .catch((err) => {
          console.warn('Sync to sheets failed:', err);
        });
    }

    // Asynchronously send LINE Notification
    if (lineSettings?.enabled && (lineSettings?.token || lineSettings?.webhookUrl)) {
      sendLineNotification(newOrder, lineSettings.token, lineSettings.webhookUrl)
        .then((res) => {
          if (res.success) {
            console.log('LINE notification sent successfully');
          }
        })
        .catch((err) => {
          console.warn('LINE notify failed:', err);
        });
    }
  };

  // Open edit order form modal directly from details popup
  const handleStartEditOrder = (order: Order) => {
    if (order.status === 'delivering' || order.status === 'completed') {
      showToast(
        'error',
        'ไม่สามารถแก้ไขออเดอร์ได้',
        `ออเดอร์ ${order.orderNumber} อยู่ในสถานะ "${order.status === 'delivering' ? 'กำลังจัดส่ง' : 'ส่งมอบสำเร็จ'}" จึงไม่อนุญาตให้แก้ไขข้อมูล`
      );
      return;
    }
    setSelectedOrderForDetail(null);
    setEditingOrder(order);
    setActiveTab('new_order');
  };

  // Update existing order handler (syncs local state and Google Sheets)
  const handleUpdateOrder = async (updatedOrder: Order) => {
    // 1. Optimistically update local state
    setOrders((prev) =>
      prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
    );

    setIsNewOrderOpen(false);
    setEditingOrder(null);
    setSelectedOrderForDetail(updatedOrder);

    playNotificationChime('success');
    showToast(
      'success',
      'บันทึกการแก้ไขสำเร็จ!',
      `อัปเดตออเดอร์ ${updatedOrder.orderNumber} ยอดเงิน ฿${(updatedOrder.netAmount ?? 0).toLocaleString()} เรียบร้อยแล้ว`
    );

    // 2. Asynchronously sync updated order to Google Sheets if connected
    if (sheetsConfig?.spreadsheetId) {
      try {
        const success = await updateOrderInSheet(sheetsConfig, updatedOrder);
        if (success) {
          showToast(
            'success',
            'ซิงค์กับ Sheets เรียบร้อย',
            `อัปเดตแถวข้อมูลของ ${updatedOrder.orderNumber} บน Google Sheets แล้ว`
          );
        }
      } catch (err) {
        console.warn('Update order in sheet failed:', err);
        showToast(
          'error',
          'ซิงค์กับ Sheets ไม่สำเร็จ',
          'ข้อมูลในระบบถูกอัปเดตแล้ว แต่ไม่สามารถอัปเดตใน Google Sheets ได้ กรุณาตรวจสอบการเชื่อมต่อ'
        );
      }
    }
  };

  // Handle Save Expense
  const handleSaveExpense = async (expense: import('./types').Expense) => {
    try {
      if (sheetsConfig?.spreadsheetId) {
        await syncExpenseToSheets(sheetsConfig.spreadsheetId, expense);
      }
      setExpenses((prev) => [expense, ...prev]);
      playNotificationChime('success');
      showToast('success', 'บันทึกค่าใช้จ่ายสำเร็จ', `บันทึก${expense.expenseType} ${expense.amount} บาท เรียบร้อยแล้ว`);
      return true;
    } catch (err: any) {
      console.error('Error saving expense:', err);
      showToast('error', 'บันทึกค่าใช้จ่ายไม่สำเร็จ', err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      return false;
    }
  };

  // Background Sync Queue for instant optimistic Customer & Check-In saves
  const [pendingSyncJobs, setPendingSyncJobs] = useState<PendingSyncJob[]>(() => {
    try {
      const raw = localStorage.getItem(PENDING_SYNC_QUEUE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((job: PendingSyncJob) =>
            job.status === 'syncing' ? { ...job, status: 'pending' } : job
          );
        }
      }
    } catch {
      // ignore corrupted queue storage
    }
    return [];
  });
  const pendingSyncJobsRef = useRef<PendingSyncJob[]>(pendingSyncJobs);
  const syncWorkerRunningRef = useRef(false);

  const updatePendingSyncJobs = useCallback(
    (updater: (prev: PendingSyncJob[]) => PendingSyncJob[]) => {
      setPendingSyncJobs((prev) => {
        const next = updater(prev);
        pendingSyncJobsRef.current = next;
        return next;
      });
    },
    []
  );

  useEffect(() => {
    pendingSyncJobsRef.current = pendingSyncJobs;
    try {
      if (pendingSyncJobs.length === 0) {
        localStorage.removeItem(PENDING_SYNC_QUEUE_KEY);
      } else {
        localStorage.setItem(PENDING_SYNC_QUEUE_KEY, JSON.stringify(pendingSyncJobs));
      }
    } catch {
      // localStorage quota exceeded (e.g., pending base64 photo) — keep safely in memory queue
    }
  }, [pendingSyncJobs]);

  const enqueueSyncJob = useCallback((job: PendingSyncJob) => {
    updatePendingSyncJobs((prev) => {
      // Coalesce if same customer ID is edited again while still pending
      if (job.kind === 'customer' && job.payload.id) {
        const filtered = prev.filter(
          (item) =>
            !(
              item.kind === 'customer' &&
              item.payload.id === job.payload.id &&
              item.status !== 'syncing'
            )
        );
        return [...filtered, job];
      }
      return [...prev, job];
    });
  }, [updatePendingSyncJobs]);

  const handleRetryFailedSyncJobs = useCallback(() => {
    updatePendingSyncJobs((prev) =>
      prev.map((j) =>
        j.status === 'failed' ? { ...j, status: 'pending', error: undefined } : j
      )
    );
  }, [updatePendingSyncJobs]);

  // Auto-retry failed jobs as soon as network connectivity returns
  useEffect(() => {
    const handleOnline = () => {
      updatePendingSyncJobs((prev) => {
        if (!prev.some((j) => j.status === 'failed')) return prev;
        return prev.map((j) =>
          j.status === 'failed' ? { ...j, status: 'pending', error: undefined } : j
        );
      });
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [updatePendingSyncJobs]);

  // Background queue processor: resolves photos in parallel (reusing pre-uploads) & syncs to Sheets
  useEffect(() => {
    const spreadsheetId = sheetsConfig?.spreadsheetId;
    if (!spreadsheetId) return;
    if (syncWorkerRunningRef.current) return;
    const nextPending = pendingSyncJobs.find((j) => j.status === 'pending');
    if (!nextPending) return;

    syncWorkerRunningRef.current = true;
    const attemptedInRun = new Set<string>();

    const runQueue = async () => {
      try {
        while (true) {
          const targetJob = pendingSyncJobsRef.current.find(
            (j) => j.status === 'pending' && !attemptedInRun.has(j.jobId)
          );
          if (!targetJob) break;
          attemptedInRun.add(targetJob.jobId);

          updatePendingSyncJobs((prev) =>
            prev.map((j) =>
              j.jobId === targetJob.jobId ? { ...j, status: 'syncing', error: undefined } : j
            )
          );

          try {
            if (targetJob.kind === 'customer') {
              const rawPhotos = Array.isArray(targetJob.payload.photoUrls)
                ? targetJob.payload.photoUrls.slice(0, 3)
                : [];
              // Resolve/upload all pending storefront photos in PARALLEL (reuses in-flight pre-uploads!)
              const resolvedPhotos = await Promise.all(
                rawPhotos.map((url, idx) =>
                  url && url.startsWith('data:')
                    ? resolveStorePhotoUrl(url, targetJob.payload.name, idx + 1)
                    : Promise.resolve(url)
                )
              );

              const finalCustomer: Customer = {
                ...targetJob.payload,
                photoUrls: resolvedPhotos,
                syncedToSheets: true,
              };

              await saveCustomerToSheet(spreadsheetId, finalCustomer, {
                isNew: targetJob.isNew,
              });

              // Replace temporary local base64 previews with final Google Drive links in state
              setCustomers((prev) =>
                prev.map((c) => (c.id === finalCustomer.id ? { ...c, ...finalCustomer } : c))
              );
              setSavedCustomerSuccessPopup((prev) =>
                prev && prev.customer.id === finalCustomer.id
                  ? { ...prev, customer: finalCustomer }
                  : prev
              );
            } else if (targetJob.kind === 'checkin') {
              const rawPhoto = targetJob.payload.photoUrl || '';
              const resolvedPhotoUrl =
                rawPhoto && rawPhoto.startsWith('data:')
                  ? await resolveCheckInPhotoUrl(rawPhoto, {
                      storeName: targetJob.payload.storeName,
                      salespersonName: targetJob.payload.salespersonName,
                      date: new Date(targetJob.payload.createdAt || Date.now()),
                    })
                  : rawPhoto;

              const finalCheckIn: StoreCheckIn = {
                ...targetJob.payload,
                photoUrl: resolvedPhotoUrl,
                syncedToSheets: true,
              };

              await syncCheckInToSheets(spreadsheetId, finalCheckIn);

              // Update check-in in state with Drive URL + synced flag
              setCheckIns((prev) =>
                prev.map((ci) => (ci.id === finalCheckIn.id ? finalCheckIn : ci))
              );
            }

            // Job completed -> remove from pending queue
            updatePendingSyncJobs((prev) => prev.filter((j) => j.jobId !== targetJob.jobId));
          } catch (err: any) {
            console.warn(`Background sync failed [${targetJob.kind}]:`, err);
            updatePendingSyncJobs((prev) =>
              prev.map((j) =>
                j.jobId === targetJob.jobId
                  ? {
                      ...j,
                      status: 'failed',
                      error: err?.message || 'การเชื่อมต่อขัดข้อง',
                    }
                  : j
              )
            );
          }
        }
      } finally {
        syncWorkerRunningRef.current = false;
      }
    };

    runQueue();
  }, [pendingSyncJobs, sheetsConfig?.spreadsheetId, updatePendingSyncJobs]);

  // Handle Save Check-in (Optimistic instant save + background Drive upload & Sheets sync)
  const handleSaveCheckIn = async (checkIn: StoreCheckIn) => {
    const optimisticCheckIn: StoreCheckIn = {
      ...checkIn,
      syncedToSheets: !sheetsConfig?.spreadsheetId,
    };

    setCheckIns((prev) => [optimisticCheckIn, ...prev]);
    playNotificationChime('success');
    showToast(
      'success',
      'บันทึกการเช็คอินสำเร็จ',
      `เช็คอินร้าน "${checkIn.storeName || checkIn.customerName || 'ร้านค้า'}" เรียบร้อยแล้ว`
    );

    if (sheetsConfig?.spreadsheetId) {
      enqueueSyncJob({
        jobId: `sync-chk-${checkIn.id}-${Date.now()}`,
        kind: 'checkin',
        label: `เช็คอิน: ${checkIn.storeName || 'ร้านค้า'}`,
        payload: optimisticCheckIn,
        status: 'pending',
        createdAt: Date.now(),
      });
    }

    return true;
  };

  // Status Change Handler
  const handleUpdateStatus = (orderId: string, newStatus: OrderStatus) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;

    if (newStatus === 'cancelled') {
      setConfirmDialog({
        isOpen: true,
        title: 'ยืนยันการยกเลิกออเดอร์',
        message: `คุณต้องการยกเลิกออเดอร์ ${targetOrder.orderNumber} ของลูกค้า ${targetOrder.customerName} หรือไม่?`,
        confirmText: 'ยกเลิกออเดอร์',
        isDestructive: true,
        onConfirm: () => {
          executeStatusUpdate(orderId, 'cancelled');
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        },
      });
      return;
    }

    executeStatusUpdate(orderId, newStatus);
  };

  const executeStatusUpdate = (orderId: string, newStatus: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );

    if (selectedOrderForDetail && selectedOrderForDetail.id === orderId) {
      setSelectedOrderForDetail((prev) => (prev ? { ...prev, status: newStatus } : null));
    }

    playNotificationChime('success');
    showToast('info', 'อัปเดตสถานะสำเร็จ', `เปลี่ยนสถานะเป็น: ${newStatus}`);

    // Update in Google Sheets if connected
    const ord = orders.find((o) => o.id === orderId);
    if (ord && sheetsConfig?.spreadsheetId) {
      updateOrderStatusInSheet(sheetsConfig, ord.orderNumber, newStatus).catch((e) =>
        console.warn('Update status in sheet failed:', e)
      );
    }
  };

  // Pull orders, catalog products, staff, and customers from Google Sheets
  const handleRefreshFromSheets = useCallback(async () => {
    if (!sheetsConfig?.spreadsheetId) {
      throw new Error('ยังไม่ได้กำหนด Google Spreadsheet ID');
    }
    
    setIsLoadingData(true);
    try {
      // Pull latest shared Apps Script URL & Drive folder IDs from Google Sheets
      await syncSharedConfigFromCloud(sheetsConfig);
      let fetchedOrders, fetchedProducts, fetchedUsers, fetchedCustomers, fetchedRoutes;
      try {
        const bulkData = await fetchAllDataBulk(sheetsConfig.spreadsheetId, sheetsConfig.sheetName);
        if (bulkData) {
          fetchedOrders = bulkData.orders;
          fetchedUsers = bulkData.users;
          fetchedProducts = bulkData.products;
          fetchedCustomers = bulkData.customers;
          fetchedRoutes = bulkData.routes;
        } else {
          throw new Error('Bulk fetch failed or unsupported');
        }
      } catch (bulkErr: any) {
        if (bulkErr.message && (bulkErr.message.includes('Failed to fetch') || bulkErr.message === 'HTML_RESPONSE' || bulkErr.message === 'GAS_HTML_LOGIN_REQUIRED' || bulkErr.message === 'GAS_FAILED_TO_FETCH')) {
          throw bulkErr; // Skip fallback if it's a network/CORS/HTML error
        }
        [fetchedOrders, fetchedProducts, fetchedUsers, fetchedCustomers, fetchedRoutes] = await Promise.all([
          fetchOrdersFromSheet(sheetsConfig),
          fetchProductsFromSheet(sheetsConfig.spreadsheetId).catch(() => []),
          fetchUsersFromSheets(sheetsConfig.spreadsheetId).catch(() => []),
          fetchCustomersFromSheet(sheetsConfig.spreadsheetId).catch(() => []),
          fetchRoutesFromSheet(sheetsConfig.spreadsheetId).catch(() => []),
        ]);
        const fetchedCheckIns = await fetchCheckInsFromSheet(sheetsConfig.spreadsheetId).catch(() => []);
        if (Array.isArray(fetchedCheckIns)) {
          setCheckIns(fetchedCheckIns);
        }
        const fetchedExpenses = await fetchExpensesFromSheet(sheetsConfig.spreadsheetId).catch(() => []);
        if (Array.isArray(fetchedExpenses)) {
          setExpenses(fetchedExpenses);
        }
      }

      if (Array.isArray(fetchedOrders)) {
        setOrders(sanitizeOrderData(fetchedOrders));
      }
      if (Array.isArray(fetchedProducts)) {
        setProducts(fetchedProducts);
      }
      if (Array.isArray(fetchedUsers) && fetchedUsers.length > 0) {
        setStaffList(fetchedUsers);
      }
      if (Array.isArray(fetchedCustomers)) {
        setCustomers(sanitizeCustomerData(fetchedCustomers));
      }
      if (Array.isArray(fetchedRoutes)) {
        setRoutes(fetchedRoutes);
      }
      
      try {
        const fetchedCheckIns = await fetchCheckInsFromSheet(sheetsConfig.spreadsheetId);
        if (Array.isArray(fetchedCheckIns)) {
          setCheckIns(fetchedCheckIns);
        }
      } catch (e) {
        console.warn('Sync checkins failed', e);
      }
      try {
        const fetchedExpenses = await fetchExpensesFromSheet(sheetsConfig.spreadsheetId);
        if (Array.isArray(fetchedExpenses)) {
          setExpenses(fetchedExpenses);
        }
      } catch (e) {
        console.warn('Sync expenses failed', e);
      }
      try {
        const [fetchedDeposits, fetchedPartnerDeposits, fetchedHired, fetchedMaintenance, fetchedFleet] =
          await Promise.allSettled([
            fetchDepositsFromSheet(sheetsConfig.spreadsheetId),
            fetchPartnerDepositDataFromSheet(sheetsConfig.spreadsheetId),
            fetchHiredVehicleTripsFromSheet(sheetsConfig.spreadsheetId),
            fetchMaintenanceFromSheet(sheetsConfig.spreadsheetId),
            fetchFleetVehiclesFromSheet(sheetsConfig.spreadsheetId),
          ]);
        if (fetchedDeposits.status === 'fulfilled' && Array.isArray(fetchedDeposits.value)) {
          setDeposits(fetchedDeposits.value);
        }
        if (fetchedPartnerDeposits.status === 'fulfilled' && fetchedPartnerDeposits.value) {
          setPartnerDepositDeductions(fetchedPartnerDeposits.value.deductions || []);
          setPartnerDepositWithdrawals(fetchedPartnerDeposits.value.withdrawals || []);
        }
        if (fetchedHired.status === 'fulfilled' && Array.isArray(fetchedHired.value)) {
          setHiredVehicles(fetchedHired.value);
        }
        if (fetchedMaintenance.status === 'fulfilled' && Array.isArray(fetchedMaintenance.value)) {
          setMaintenanceRecords(fetchedMaintenance.value);
        }
        if (fetchedFleet.status === 'fulfilled' && Array.isArray(fetchedFleet.value)) {
          setFleetVehicles(fetchedFleet.value);
        }
      } catch (e) {
        console.warn('Sync logistics tables failed', e);
      }
      try {
        const [fetchedDaily, fetchedHist] = await Promise.all([
          fetchDailyRouteSchedulesFromSheet(sheetsConfig.spreadsheetId),
          fetchRouteScheduleHistoryFromSheet(sheetsConfig.spreadsheetId),
        ]);
        if (fetchedDaily && typeof fetchedDaily === 'object') {
          setDailySchedules(fetchedDaily);
        }
        if (Array.isArray(fetchedHist)) {
          setRouteScheduleHistory(fetchedHist);
        }
      } catch (e) {
        console.warn('Sync daily route schedules failed', e);
      }

      showToast(
        'success',
        'ซิงค์ข้อมูลสำเร็จ',
        `ออเดอร์ ${fetchedOrders?.length || 0} รายการ, สินค้า ${fetchedProducts?.length || 0} รายการ, ลูกค้า ${fetchedCustomers?.length || 0} ราย`
      );
    } catch (err: any) {
      if (err.message === 'HTML_RESPONSE' || err.message === 'GAS_HTML_LOGIN_REQUIRED') {
        showToast('error', 'ตั้งค่าสิทธิ์ GAS ผิดพลาด (ได้หน้าล็อกอินกลับมา)', 'โปรดกลับไปตั้งค่า \'Who has access\' ใน Apps Script ให้เป็น \'Anyone\' (ทุกคน) แล้ว Deploy ใหม่');
      } else if (err.message === 'GAS_FAILED_TO_FETCH') {
        showToast('error', 'ไม่สามารถเชื่อมต่อ GAS ได้', 'โปรดตรวจสอบ Google Apps Script URL ในเมนูตั้งค่า');
      } else {
        showToast('error', 'ข้อผิดพลาด', err.message || 'ไม่สามารถดึงข้อมูลจาก Google Sheets ได้');
      }
      if (err.message === 'UNAUTHENTICATED') {
        logoutGoogle().then(() => setCurrentUser(null));
      }
    } finally {
      setIsLoadingData(false);
    }
  }, [sheetsConfig, syncSharedConfigFromCloud]);

  const handleSaveCustomer = async (custData: {
    id?: string;
    name: string;
    phone: string;
    address: string;
    mapsUrl: string;
    routeName?: string;
    visitDays?: string[];
    photoUrls?: string[];
  }): Promise<boolean> => {
    const nowUtcPlus7 = formatNowUtcPlus7Iso();
    const rawRoute = String(custData.routeName || '').trim();
    const matchedRoute = routes.find(
      (r) =>
        String(r.id || '').trim().toLowerCase() === rawRoute.toLowerCase() ||
        String(r.name || '').trim().toLowerCase() === rawRoute.toLowerCase()
    );
    const resolvedRouteId = matchedRoute?.id || rawRoute;
    const isEditMode = Boolean(custData.id);
    const existingCustomer = isEditMode
      ? customers.find((c) => c.id === custData.id)
      : undefined;
    const parsedCoords = extractCustomerCoords({
      id: custData.id || '',
      name: custData.name,
      phone: custData.phone,
      address: custData.address,
      mapsUrl: custData.mapsUrl,
    });
    const newCustomer: Customer = {
      id: custData.id || `CUST-${Date.now()}`,
      ...custData,
      phone: normalizeThaiPhone(custData.phone),
      routeName: resolvedRouteId,
      routeId: resolvedRouteId || undefined,
      latitude: parsedCoords?.lat,
      longitude: parsedCoords?.lng,
      photoUrls: Array.isArray(custData.photoUrls) ? custData.photoUrls.slice(0, 3) : [],
      updatedAt: nowUtcPlus7,
      sheetsRowIndex: existingCustomer?.sheetsRowIndex,
      syncedToSheets: !sheetsConfig?.spreadsheetId,
    };

    // Optimistic state update (< 0.1s perceived save)
    setCustomers((prev) => {
      const exists = prev.findIndex((c) => c.id === newCustomer.id);
      if (exists > -1) {
        const copy = [...prev];
        copy[exists] = newCustomer;
        return copy;
      }
      return [...prev, newCustomer];
    });

    playNotificationChime('success');
    setSavedCustomerSuccessPopup({ customer: newCustomer, isEdit: isEditMode });

    if (sheetsConfig?.spreadsheetId) {
      enqueueSyncJob({
        jobId: `sync-cust-${newCustomer.id}-${Date.now()}`,
        kind: 'customer',
        label: `${isEditMode ? 'อัปเดตลูกค้า' : 'ลูกค้าใหม่'}: ${newCustomer.name}`,
        isNew: !isEditMode,
        payload: newCustomer,
        status: 'pending',
        createdAt: Date.now(),
      });
    }

    return true;
  };

  const handleDeleteCustomer = async (customer: Customer): Promise<boolean> => {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'manager')) {
      showToast(
        'error',
        'ไม่มีสิทธิ์ดำเนินการ',
        'เฉพาะผู้ดูแลระบบและผู้จัดการฝ่ายขายเท่านั้นที่สามารถลบข้อมูลลูกค้าได้'
      );
      return false;
    }

    setIsLoadingData(true);
    try {
      if (sheetsConfig?.spreadsheetId) {
        await deleteCustomerFromSheet(sheetsConfig.spreadsheetId, customer);
        const fetched = await fetchCustomersFromSheet(sheetsConfig.spreadsheetId);
        const cleanCustomers = sanitizeCustomerData(fetched);
        setCustomers(cleanCustomers);
        showToast(
          'success',
          'ลบข้อมูลลูกค้าสำเร็จ',
          `ลบ "${customer.name}" ออกจากระบบและ Google Sheets เรียบร้อยแล้ว`
        );
        return true;
      }

      setCustomers((prev) =>
        prev.filter((c) => {
          if (customer.id && c.id) return c.id !== customer.id;
          return !(c.name === customer.name && c.phone === customer.phone);
        })
      );
      showToast('success', 'ลบข้อมูลลูกค้าสำเร็จ', `ลบ "${customer.name}" ออกจากระบบเรียบร้อยแล้ว`);
      return true;
    } catch (e: any) {
      console.warn('deleteCustomerFromSheet error:', e);
      showToast(
        'error',
        'ลบข้อมูลลูกค้าไม่สำเร็จ',
        e?.message || 'ไม่สามารถลบข้อมูลลูกค้าจาก Google Sheets ได้'
      );
      return false;
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleSaveRoute = async (routeData: import('./types').Route): Promise<boolean> => {
    setIsLoadingData(true);
    try {
      if (sheetsConfig?.spreadsheetId) {
        await saveRouteToSheet(sheetsConfig.spreadsheetId, routeData);
        const fetched = await fetchRoutesFromSheet(sheetsConfig.spreadsheetId);
        setRoutes(fetched);
        showToast('success', 'บันทึกสำเร็จ', 'อัปเดตข้อมูลสายการเข้าเยี่ยมแล้ว');
        return true;
      }
      setRoutes((prev) => {
        const idx = prev.findIndex((r) => r.id === routeData.id);
        return idx >= 0 ? prev.map((r, i) => (i === idx ? routeData : r)) : [...prev, routeData];
      });
      showToast('success', 'บันทึกสำเร็จ', 'บันทึกข้อมูลสายการเข้าเยี่ยมในระบบแล้ว');
      return true;
    } catch (e: any) {
      showToast('error', 'ข้อผิดพลาด', e.message);
      return false;
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleDeleteRoute = async (routeId: string): Promise<boolean> => {
    setIsLoadingData(true);
    try {
      if (sheetsConfig?.spreadsheetId) {
        await deleteRouteFromSheet(sheetsConfig.spreadsheetId, routeId);
        const fetched = await fetchRoutesFromSheet(sheetsConfig.spreadsheetId);
        setRoutes(fetched);
        showToast('success', 'ลบสำเร็จ', 'ลบข้อมูลสายการเข้าเยี่ยมแล้ว');
        return true;
      }
      setRoutes((prev) => prev.filter((r) => r.id !== routeId));
      showToast('success', 'ลบสำเร็จ', 'ลบข้อมูลสายการเข้าเยี่ยมแล้ว');
      return true;
    } catch (e: any) {
      showToast('error', 'ข้อผิดพลาด', e.message);
      return false;
    } finally {
      setIsLoadingData(false);
    }
  };

  const formatRouteNamesFromIds = useCallback(
    (routeIds: string[]): string => {
      if (!routeIds || routeIds.length === 0) return 'ไม่มีสายที่กำหนด';
      const nameMap = new Map<string, string>();
      routes.forEach((r) => nameMap.set(r.id, r.name || r.id));
      return routeIds.map((id) => nameMap.get(id) || id).join(', ');
    },
    [routes]
  );

  const getDefaultRouteIdsForDate = useCallback(
    (dateStr: string): string[] => {
      const thaiDay = getThaiDayFromDate(dateStr);
      return routes.filter((r) => doesRouteRunOnDay(r, thaiDay)).map((r) => r.id);
    },
    [routes]
  );

  const recordRouteScheduleHistory = useCallback(
    (entryData: Omit<RouteScheduleHistoryEntry, 'id' | 'timestamp' | 'changedBy' | 'changedByRole'>) => {
      const entry: RouteScheduleHistoryEntry = {
        id: `RSH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: formatNowUtcPlus7Iso(),
        changedBy: currentUser?.name || 'ผู้ใช้งาน',
        changedByRole: currentUser?.role || '',
        ...entryData,
      };
      setRouteScheduleHistory((prev) => [entry, ...prev].slice(0, 500));
      if (sheetsConfig?.spreadsheetId) {
        appendRouteScheduleHistoryToSheet(sheetsConfig.spreadsheetId, entry).catch((err) => {
          console.warn('[RouteScheduleHistory] Sync error:', err);
        });
      }
    },
    [currentUser, sheetsConfig?.spreadsheetId]
  );

  const handleRefreshRouteSchedules = useCallback(async () => {
    if (!sheetsConfig?.spreadsheetId) return;
    try {
      const [fetchedSchedules, fetchedHistory] = await Promise.all([
        fetchDailyRouteSchedulesFromSheet(sheetsConfig.spreadsheetId),
        fetchRouteScheduleHistoryFromSheet(sheetsConfig.spreadsheetId),
      ]);
      if (fetchedSchedules && typeof fetchedSchedules === 'object') {
        setDailySchedules(fetchedSchedules);
      }
      if (Array.isArray(fetchedHistory)) {
        setRouteScheduleHistory(fetchedHistory);
      }
      showToast('success', 'อัปเดตแผนวิ่งสายและประวัติแล้ว', `พบประวัติทั้งหมด ${fetchedHistory.length} รายการ`);
    } catch (e: any) {
      showToast('error', 'ไม่สามารถโหลดประวัติจาก Google Sheets ได้', e?.message || '');
    }
  }, [sheetsConfig?.spreadsheetId, showToast]);

  const handleClearRouteCache = useCallback(async () => {
    try {
      localStorage.removeItem('iora_routes');
      localStorage.removeItem('iora_call_plan_daily_schedule');
      localStorage.removeItem('iora_route_schedule_history');
    } catch (e) {}

    setDailySchedules({});
    setRouteScheduleHistory([]);

    if (sheetsConfig?.spreadsheetId) {
      setIsLoadingData(true);
      try {
        const [fetchedRoutes, fetchedSchedules, fetchedHistory] = await Promise.all([
          fetchRoutesFromSheet(sheetsConfig.spreadsheetId),
          fetchDailyRouteSchedulesFromSheet(sheetsConfig.spreadsheetId),
          fetchRouteScheduleHistoryFromSheet(sheetsConfig.spreadsheetId),
        ]);
        const cleanRoutes = Array.isArray(fetchedRoutes) ? fetchedRoutes : [];
        const cleanSchedules =
          fetchedSchedules && typeof fetchedSchedules === 'object' ? fetchedSchedules : {};
        const cleanHistory = Array.isArray(fetchedHistory) ? fetchedHistory : [];

        setRoutes(cleanRoutes);
        setDailySchedules(cleanSchedules);
        setRouteScheduleHistory(cleanHistory);

        showToast(
          'success',
          'ล้างแคชสายวิ่งและโหลดข้อมูลใหม่แล้ว',
          `สายส่ง ${cleanRoutes.length} สาย | แผนรายวัน ${Object.keys(cleanSchedules).length} วัน | ประวัติ ${cleanHistory.length} รายการ`
        );
      } catch (e: any) {
        setRoutes([]);
        showToast('error', 'ล้างแคชแล้ว แต่โหลดข้อมูลจาก Sheet ไม่สำเร็จ', e?.message || '');
      } finally {
        setIsLoadingData(false);
      }
    } else {
      setRoutes([]);
      showToast('success', 'ล้างแคชข้อมูลสายวิ่งแล้ว', 'ล้างแคชข้อมูลสายวิ่ง แผนรายวัน และประวัติที่เก็บในเครื่องเรียบร้อยแล้ว');
    }
  }, [sheetsConfig?.spreadsheetId]);

  const handleSaveDailySchedule = (
    dateStr: string,
    schedule: DailyRouteSchedule,
    meta?: { actionType?: RouteScheduleActionType; notes?: string }
  ) => {
    const existing = dailySchedules[dateStr];
    const prevRouteIds = existing ? existing.routeIds : getDefaultRouteIdsForDate(dateStr);
    const enrichedSchedule: DailyRouteSchedule = {
      ...schedule,
      updatedBy: schedule.updatedBy || currentUser?.name || 'ผู้ใช้งาน',
      updatedAt: schedule.updatedAt || formatNowUtcPlus7Iso(),
    };

    setDailySchedules((prev) => ({ ...prev, [dateStr]: enrichedSchedule }));

    const actionType: RouteScheduleActionType =
      meta?.actionType || (existing ? 'update_daily' : 'set_daily');
    recordRouteScheduleHistory({
      targetDate: dateStr,
      actionType,
      previousRouteIds: prevRouteIds,
      previousRouteNames: existing
        ? formatRouteNamesFromIds(prevRouteIds)
        : `รอบปกติ (${formatRouteNamesFromIds(prevRouteIds)})`,
      newRouteIds: enrichedSchedule.routeIds,
      newRouteNames: formatRouteNamesFromIds(enrichedSchedule.routeIds),
      notes: meta?.notes || enrichedSchedule.notes,
    });

    if (sheetsConfig?.spreadsheetId) {
      upsertDailyRouteScheduleToSheet(sheetsConfig.spreadsheetId, enrichedSchedule, routes).catch((err) => {
        console.warn('[DailyRouteSchedules] Sync error:', err);
      });
    }
  };

  const handleBatchSaveDailySchedules = (
    schedules: Record<string, DailyRouteSchedule>,
    meta?: { actionType?: RouteScheduleActionType; notes?: string; targetDateLabel?: string }
  ) => {
    const nowIso = formatNowUtcPlus7Iso();
    const prevSchedules = dailySchedules;
    const enrichedAll: Record<string, DailyRouteSchedule> = {};
    const changedOnly: Record<string, DailyRouteSchedule> = {};

    for (const [d, s] of Object.entries(schedules)) {
      if (!s) continue;
      const enriched: DailyRouteSchedule = {
        ...s,
        updatedBy: s.updatedBy || currentUser?.name || 'ผู้ใช้งาน',
        updatedAt: s.updatedAt || nowIso,
      };
      enrichedAll[d] = enriched;

      const prev = prevSchedules[d];
      const changed =
        !prev ||
        prev.routeIds.join(',') !== enriched.routeIds.join(',') ||
        (prev.notes || '') !== (enriched.notes || '') ||
        (prev.selfSwitchedRouteIds || []).join(',') !== (enriched.selfSwitchedRouteIds || []).join(',');
      if (changed) {
        changedOnly[d] = enriched;
      }
    }

    const deletedDateStrings = Object.keys(prevSchedules).filter((d) => !enrichedAll[d]);

    setDailySchedules(enrichedAll);

    const changedCount = Object.keys(changedOnly).length;
    const deletedCount = deletedDateStrings.length;
    const actionType: RouteScheduleActionType =
      meta?.actionType || (deletedCount > 0 && changedCount === 0 ? 'clear_monthly' : 'batch_monthly');
    const sampleDate =
      meta?.targetDateLabel ||
      Object.keys(changedOnly)[0]?.slice(0, 7) ||
      deletedDateStrings[0]?.slice(0, 7) ||
      nowIso.slice(0, 7);

    recordRouteScheduleHistory({
      targetDate: sampleDate,
      actionType,
      previousRouteIds: [],
      previousRouteNames:
        deletedCount > 0
          ? `แผนปรับแต่งเดิม ${deletedCount} วัน`
          : `แผนเดิม ${Object.keys(prevSchedules).length} วัน`,
      newRouteIds: [],
      newRouteNames:
        actionType === 'clear_monthly'
          ? `ล้างแผนปรับแต่ง ${deletedCount} วัน (ใช้รอบสัปดาห์ปกติ)`
          : `สร้าง/อัปเดตแผนวิ่งสาย ${changedCount} วัน`,
      notes: meta?.notes,
    });

    if (sheetsConfig?.spreadsheetId && (changedCount > 0 || deletedCount > 0)) {
      upsertBatchDailyRouteSchedulesToSheet(
        sheetsConfig.spreadsheetId,
        changedOnly,
        routes,
        deletedDateStrings
      ).catch((err) => {
        console.warn('[DailyRouteSchedules] Batch sync error:', err);
      });
    }
  };

  const handleDeleteDailySchedule = (
    dateStr: string,
    meta?: { actionType?: RouteScheduleActionType; notes?: string }
  ) => {
    const existing = dailySchedules[dateStr];
    const defaultIds = getDefaultRouteIdsForDate(dateStr);

    setDailySchedules((prev) => {
      const updated = { ...prev };
      delete updated[dateStr];
      return updated;
    });

    recordRouteScheduleHistory({
      targetDate: dateStr,
      actionType: meta?.actionType || 'reset_default',
      previousRouteIds: existing?.routeIds || [],
      previousRouteNames: existing ? formatRouteNamesFromIds(existing.routeIds) : '-',
      newRouteIds: defaultIds,
      newRouteNames: `รอบปกติ (${formatRouteNamesFromIds(defaultIds)})`,
      notes: meta?.notes || 'ลบการตั้งค่าพิเศษและกลับไปใช้รอบประจำสัปดาห์',
    });

    if (sheetsConfig?.spreadsheetId) {
      deleteDailyRouteScheduleFromSheet(sheetsConfig.spreadsheetId, dateStr).catch((err) => {
        console.warn('[DailyRouteSchedules] Delete sync error:', err);
      });
    }
  };

  const handleRefreshCustomers = async () => {
    if (!sheetsConfig?.spreadsheetId) return;
    setIsLoadingData(true);
    try {
      const fetched = await fetchCustomersFromSheet(sheetsConfig.spreadsheetId);
      if (Array.isArray(fetched)) {
        setCustomers(sanitizeCustomerData(fetched));
        showToast('success', 'สำเร็จ', 'อัปเดตข้อมูลลูกค้าล่าสุดแล้ว');
      }
    } catch (e: any) {
      showToast('error', 'ข้อผิดพลาด', e.message || 'ไม่สามารถดึงข้อมูลลูกค้าได้');
    } finally {
      setIsLoadingData(false);
    }
  };


  // Today sales amount for Navbar badge
  const todaySalesAmount = useMemo(() => {
    const today = new Date();
    return orders
      .filter((o) => {
        if (o.status === 'cancelled') return false;
        const d = parseDateRobust(o.createdAt);
        return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
      })
      .reduce((sum, o) => sum + (o.netAmount || 0), 0);
  }, [orders]);

  // Pending deliveries count for Navbar badge
  const pendingDeliveriesCount = useMemo(() => {
    return orders.filter(
      (o) => o.status === 'pending' || o.status === 'confirmed' || o.status === 'delivering'
    ).length;
  }, [orders]);

  // Derive Partner Deposit Vehicles directly from FleetVehicles (Single Source of Truth)
  const partnerDepositVehicles = useMemo<PartnerDepositVehicle[]>(() => {
    return fleetVehicles
      .filter((fv) => fv.depositEnabled || Boolean(fv.depositCode))
      .map((fv) => ({
        vehicleId: fv.depositCode || fv.id,
        licensePlate: fv.province ? `${fv.plateNumber} ${fv.province}`.trim() : fv.plateNumber,
        driverName: fv.driverName || '',
        phone: fv.driverPhone || '',
        startDate: fv.depositStartDate || '',
        monthlyDeduction: fv.depositMonthlyDeduction ?? 2500,
        targetAmount: fv.depositTargetAmount ?? 30000,
        status: fv.depositStatus || 'กำลังหักเงิน',
        notes: fv.depositNotes || undefined,
        fleetVehicleId: fv.id,
        syncedToSheets: fv.syncedToSheets,
        sheetsRowIndex: fv.sheetsRowIndex,
      }))
      .sort((a, b) => a.vehicleId.localeCompare(b.vehicleId, 'en', { numeric: true }));
  }, [fleetVehicles]);

  // Active partner deposit vehicles count for Navbar badge
  const activeDepositsCount = useMemo(() => {
    return partnerDepositVehicles.filter((v) => v.status === 'กำลังหักเงิน').length;
  }, [partnerDepositVehicles]);

  // Partner Vehicle Security Deposit Handlers (Unified onto FleetVehicles + 2 Ledger Tabs)
  const handleSavePartnerDepositConfig = async (
    fleetVehicleId: string,
    config: {
      depositEnabled: boolean;
      depositCode: string;
      depositStartDate: string;
      depositMonthlyDeduction: number;
      depositTargetAmount: number;
      depositStatus: PartnerDepositStatus;
      depositNotes?: string;
    },
    isNewEnrollment: boolean
  ) => {
    const existing = fleetVehicles.find((fv) => fv.id === fleetVehicleId);
    if (!existing) return;

    const updatedFleetVehicle: FleetVehicle = {
      ...existing,
      depositEnabled: config.depositEnabled,
      depositCode: config.depositCode,
      depositStartDate: config.depositStartDate,
      depositMonthlyDeduction: config.depositMonthlyDeduction,
      depositTargetAmount: config.depositTargetAmount,
      depositStatus: config.depositStatus,
      depositNotes: config.depositNotes,
      updatedAt: new Date().toISOString(),
    };

    setFleetVehicles((prev) =>
      prev.map((fv) => (fv.id === fleetVehicleId ? updatedFleetVehicle : fv))
    );
    showToast(
      'success',
      isNewEnrollment ? 'เปิดบัญชีเงินประกันสำเร็จ' : 'บันทึกเงื่อนไขเงินประกันแล้ว',
      isNewEnrollment
        ? `เปิดบัญชีเงินประกัน ${config.depositCode} ให้รถ ${existing.plateNumber} บนฐานข้อมูล FleetVehicles แล้ว`
        : `อัปเดตเงื่อนไขเงินประกันของรถ ${existing.plateNumber} เรียบร้อยแล้ว`
    );

    if (sheetsConfig?.spreadsheetId) {
      updateFleetVehicleInSheet(sheetsConfig.spreadsheetId, updatedFleetVehicle).catch((e) => {
        console.warn('Update fleet deposit config error:', e);
        showToast('error', 'ซิงก์ชีตไม่สำเร็จ', 'บันทึกในเครื่องแล้ว แต่ไม่สามารถอัปเดตแท็บ FleetVehicles ได้');
      });
    }
  };

  const handleUnenrollPartnerDepositVehicle = async (
    fleetVehicleId: string,
    depositCode: string
  ) => {
    const existing = fleetVehicles.find((fv) => fv.id === fleetVehicleId);
    if (existing) {
      const clearedVehicle: FleetVehicle = {
        ...existing,
        depositEnabled: false,
        depositCode: undefined,
        depositStartDate: undefined,
        depositMonthlyDeduction: undefined,
        depositTargetAmount: undefined,
        depositStatus: undefined,
        depositNotes: undefined,
        updatedAt: new Date().toISOString(),
      };
      setFleetVehicles((prev) =>
        prev.map((fv) => (fv.id === fleetVehicleId ? clearedVehicle : fv))
      );
      if (sheetsConfig?.spreadsheetId) {
        updateFleetVehicleInSheet(sheetsConfig.spreadsheetId, clearedVehicle).catch((e) => {
          console.warn('Clear fleet deposit fields error:', e);
        });
      }
    }

    setPartnerDepositDeductions((prev) => prev.filter((d) => d.vehicleId !== depositCode));
    setPartnerDepositWithdrawals((prev) => prev.filter((w) => w.vehicleId !== depositCode));
    showToast(
      'success',
      'ถอดออกจากกองทุนแล้ว',
      `ปิดบัญชีเงินประกัน ${depositCode} แล้ว (ข้อมูลรถยังคงอยู่ในเมนูจัดการรถตามเดิม)`
    );

    if (sheetsConfig?.spreadsheetId) {
      deletePartnerDepositHistoryForVehicleFromSheet(sheetsConfig.spreadsheetId, depositCode).catch((e) => {
        console.warn('Delete partner deposit history error:', e);
      });
    }
  };

  const handleAddPartnerDepositDeduction = async (
    newDeduction: PartnerDepositDeduction,
    autoStatusUpdate?: { fleetVehicleId: string; status: PartnerDepositStatus }
  ) => {
    setPartnerDepositDeductions((prev) => [newDeduction, ...prev]);
    let updatedFleetForSheet: FleetVehicle | null = null;

    if (autoStatusUpdate) {
      const existing = fleetVehicles.find((fv) => fv.id === autoStatusUpdate.fleetVehicleId);
      if (existing) {
        updatedFleetForSheet = {
          ...existing,
          depositStatus: autoStatusUpdate.status,
          updatedAt: new Date().toISOString(),
        };
        setFleetVehicles((prev) =>
          prev.map((fv) => (fv.id === autoStatusUpdate.fleetVehicleId ? updatedFleetForSheet! : fv))
        );
        showToast(
          'success',
          'สะสมเงินประกันครบเป้าหมายแล้ว!',
          `บันทึกหักสะสม ${newDeduction.deductionId} (฿${newDeduction.amount.toLocaleString()}) และปรับสถานะ ${existing.plateNumber} เป็น "${autoStatusUpdate.status}" อัตโนมัติ`
        );
      }
    } else {
      showToast(
        'success',
        'บันทึกยอดหักสะสมสำเร็จ',
        `บันทึกรายการ ${newDeduction.deductionId} จำนวน ฿${newDeduction.amount.toLocaleString()} เรียบร้อยแล้ว`
      );
    }

    if (sheetsConfig?.spreadsheetId) {
      appendPartnerDepositDeductionToSheet(sheetsConfig.spreadsheetId, newDeduction).catch((e) => {
        console.warn('Append partner deposit deduction error:', e);
      });
      if (updatedFleetForSheet) {
        updateFleetVehicleInSheet(sheetsConfig.spreadsheetId, updatedFleetForSheet).catch((e) => {
          console.warn('Auto-update fleet deposit status error:', e);
        });
      }
    }
  };

  const handleDeletePartnerDepositDeduction = async (deductionId: string) => {
    setPartnerDepositDeductions((prev) => prev.filter((d) => d.deductionId !== deductionId));
    showToast('success', 'ลบรายการสำเร็จ', `ลบรายการหักสะสม ${deductionId} เรียบร้อยแล้ว`);

    if (sheetsConfig?.spreadsheetId) {
      deletePartnerDepositDeductionFromSheet(sheetsConfig.spreadsheetId, deductionId).catch((e) => {
        console.warn('Delete partner deposit deduction error:', e);
      });
    }
  };

  const handleAddPartnerDepositWithdrawal = async (
    newWithdrawal: PartnerDepositWithdrawal,
    autoStatusUpdate?: { fleetVehicleId: string; status: PartnerDepositStatus }
  ) => {
    setPartnerDepositWithdrawals((prev) => [newWithdrawal, ...prev]);
    let updatedFleetForSheet: FleetVehicle | null = null;

    if (autoStatusUpdate) {
      const existing = fleetVehicles.find((fv) => fv.id === autoStatusUpdate.fleetVehicleId);
      if (existing) {
        updatedFleetForSheet = {
          ...existing,
          depositStatus: autoStatusUpdate.status,
          updatedAt: new Date().toISOString(),
        };
        setFleetVehicles((prev) =>
          prev.map((fv) => (fv.id === autoStatusUpdate.fleetVehicleId ? updatedFleetForSheet! : fv))
        );
        showToast(
          'info',
          'บันทึกการเบิกจ่ายและปรับสถานะแล้ว',
          `เบิกเงินประกัน ${newWithdrawal.withdrawalId} จำนวน ฿${newWithdrawal.amount.toLocaleString()} และปรับสถานะ ${existing.plateNumber} กลับเป็น "${autoStatusUpdate.status}" อัตโนมัติ`
        );
      }
    } else {
      showToast(
        'success',
        'บันทึกการเบิกจ่ายสำเร็จ',
        `บันทึกรายการเบิก ${newWithdrawal.withdrawalId} จำนวน ฿${newWithdrawal.amount.toLocaleString()} เรียบร้อยแล้ว`
      );
    }

    if (sheetsConfig?.spreadsheetId) {
      appendPartnerDepositWithdrawalToSheet(sheetsConfig.spreadsheetId, newWithdrawal).catch((e) => {
        console.warn('Append partner deposit withdrawal error:', e);
      });
      if (updatedFleetForSheet) {
        updateFleetVehicleInSheet(sheetsConfig.spreadsheetId, updatedFleetForSheet).catch((e) => {
          console.warn('Auto-resume fleet deposit status error:', e);
        });
      }
    }
  };

  const handleDeletePartnerDepositWithdrawal = async (withdrawalId: string) => {
    setPartnerDepositWithdrawals((prev) => prev.filter((w) => w.withdrawalId !== withdrawalId));
    showToast('success', 'ลบรายการสำเร็จ', `ลบรายการเบิกจ่าย ${withdrawalId} เรียบร้อยแล้ว`);

    if (sheetsConfig?.spreadsheetId) {
      deletePartnerDepositWithdrawalFromSheet(sheetsConfig.spreadsheetId, withdrawalId).catch((e) => {
        console.warn('Delete partner deposit withdrawal error:', e);
      });
    }
  };

  // Pending hired payouts count for Navbar badge
  const pendingHiredPayoutsCount = useMemo(() => {
    return hiredVehicles.filter((h) => h.payoutStatus === 'pending').length;
  }, [hiredVehicles]);

  // Hired Vehicle Handlers
  const handleSaveHiredTrip = async (newTrip: HiredVehicleTripRecord) => {
    setHiredVehicles((prev) => [newTrip, ...prev]);
    showToast('success', 'บันทึกสำเร็จ', `บันทึกรอบวิ่งของ ${newTrip.vehiclePlate} เรียบร้อยแล้ว`);

    if (sheetsConfig?.spreadsheetId) {
      syncHiredVehicleTripToSheets(sheetsConfig.spreadsheetId, newTrip).catch((e) => {
        console.warn('Sync hired vehicle trip error:', e);
      });
    }
  };

  const handleUpdateHiredTrip = async (updatedTrip: HiredVehicleTripRecord) => {
    setHiredVehicles((prev) => prev.map((t) => (t.id === updatedTrip.id ? updatedTrip : t)));
    showToast('success', 'อัปเดตสำเร็จ', `บันทึกข้อมูลรถ ${updatedTrip.vehiclePlate} เรียบร้อยแล้ว`);

    if (sheetsConfig?.spreadsheetId) {
      updateHiredVehicleTripInSheet(sheetsConfig.spreadsheetId, updatedTrip).catch((e) => {
        console.warn('Update hired vehicle trip error:', e);
      });
    }
  };

  const handleDeleteHiredTrip = async (tripId: string) => {
    setHiredVehicles((prev) => prev.filter((t) => t.id !== tripId));
    showToast('success', 'ลบสำเร็จ', 'ลบรายการรอบวิ่งงานเรียบร้อยแล้ว');
  };

  // Active / in-progress maintenance count for Navbar badge
  const activeMaintenanceCount = useMemo(() => {
    return maintenanceRecords.filter((m) => m.status !== 'completed').length;
  }, [maintenanceRecords]);

  // Fleet compliance alerts count (<= 30 days + expired) for Navbar badge
  const fleetAlertCount = useMemo(() => {
    return getVehicleComplianceAlerts(fleetVehicles, EXPIRY_WARNING_DAYS).alerts.length;
  }, [fleetVehicles]);

  // Fleet Management Handlers
  const handleSaveFleetVehicle = async (newVehicle: FleetVehicle) => {
    setFleetVehicles((prev) => [newVehicle, ...prev]);
    showToast('success', 'บันทึกข้อมูลรถสำเร็จ', `เพิ่มทะเบียน ${newVehicle.plateNumber} เข้าสู่กองรถเรียบร้อยแล้ว`);

    if (sheetsConfig?.spreadsheetId) {
      syncFleetVehicleToSheets(sheetsConfig.spreadsheetId, newVehicle).catch((e) => {
        console.warn('Sync fleet vehicle error:', e);
      });
    }
  };

  const handleUpdateFleetVehicle = async (updatedVehicle: FleetVehicle) => {
    setFleetVehicles((prev) => prev.map((v) => (v.id === updatedVehicle.id ? updatedVehicle : v)));
    showToast('success', 'อัปเดตข้อมูลรถสำเร็จ', `บันทึกข้อมูลรถ ${updatedVehicle.plateNumber} เรียบร้อยแล้ว`);

    if (sheetsConfig?.spreadsheetId) {
      updateFleetVehicleInSheet(sheetsConfig.spreadsheetId, updatedVehicle).catch((e) => {
        console.warn('Update fleet vehicle error:', e);
      });
    }
  };

  const handleDeleteFleetVehicle = async (vehicleId: string) => {
    setFleetVehicles((prev) => prev.filter((v) => v.id !== vehicleId));
    showToast('success', 'ลบข้อมูลรถสำเร็จ', 'ลบทะเบียนรถออกจากกองรถเรียบร้อยแล้ว');

    if (sheetsConfig?.spreadsheetId) {
      deleteFleetVehicleFromSheet(sheetsConfig.spreadsheetId, vehicleId).catch((e) => {
        console.warn('Delete fleet vehicle error:', e);
      });
    }
  };

  // Vehicle Maintenance Handlers (also keep fleet currentMileage synced if newer)
  const syncFleetMileageFromMaintenance = (plate: string, mileage?: number) => {
    if (!plate || !mileage || mileage <= 0) return;
    const target = fleetVehicles.find(
      (v) => v.plateNumber.trim().toLowerCase() === plate.trim().toLowerCase()
    );
    if (target && mileage > (target.currentMileage || 0)) {
      const updated: FleetVehicle = {
        ...target,
        currentMileage: mileage,
        updatedAt: new Date().toISOString(),
      };
      setFleetVehicles((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
      if (sheetsConfig?.spreadsheetId) {
        updateFleetVehicleInSheet(sheetsConfig.spreadsheetId, updated).catch(() => {});
      }
    }
  };

  const handleSaveMaintenance = async (newRecord: VehicleMaintenanceRecord) => {
    setMaintenanceRecords((prev) => [newRecord, ...prev]);
    syncFleetMileageFromMaintenance(newRecord.vehiclePlate, newRecord.currentMileage);
    showToast('success', 'บันทึกสำเร็จ', `บันทึกงานบำรุงรักษาของ ${newRecord.vehiclePlate} เรียบร้อยแล้ว`);

    if (sheetsConfig?.spreadsheetId) {
      syncMaintenanceToSheets(sheetsConfig.spreadsheetId, newRecord).catch((e) => {
        console.warn('Sync maintenance error:', e);
      });
    }
  };

  const handleUpdateMaintenance = async (updatedRecord: VehicleMaintenanceRecord) => {
    setMaintenanceRecords((prev) => prev.map((m) => (m.id === updatedRecord.id ? updatedRecord : m)));
    syncFleetMileageFromMaintenance(updatedRecord.vehiclePlate, updatedRecord.currentMileage);
    showToast('success', 'อัปเดตสำเร็จ', `บันทึกข้อมูลงานซ่อม ${updatedRecord.vehiclePlate} เรียบร้อยแล้ว`);

    if (sheetsConfig?.spreadsheetId) {
      updateMaintenanceInSheet(sheetsConfig.spreadsheetId, updatedRecord).catch((e) => {
        console.warn('Update maintenance error:', e);
      });
    }
  };

  const handleDeleteMaintenance = async (recordId: string) => {
    setMaintenanceRecords((prev) => prev.filter((m) => m.id !== recordId));
    showToast('success', 'ลบสำเร็จ', 'ลบรายการบำรุงรักษาเรียบร้อยแล้ว');

    if (sheetsConfig?.spreadsheetId) {
      deleteMaintenanceFromSheet(sheetsConfig.spreadsheetId, recordId).catch((e) => {
        console.warn('Delete maintenance error:', e);
      });
    }
  };

  // Stable callbacks for memoized Navbar
  const handleOpenNewOrderTab = useCallback(() => {
    if (currentUser.role === 'delivery' || currentUser.role === 'viewer') return;
    setEditingOrder(null);
    setActiveTab('new_order');
  }, [currentUser.role]);

  const handleOpenNewCustomerModal = useCallback(() => {
    setIsNewCustomerOpen(true);
  }, []);

  const handleOpenRoleSwitcherModal = useCallback(() => {
    setIsRoleSwitcherOpen(true);
  }, []);

  const handleOpenSettingsModal = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const handleRefreshDatabaseFromNav = useCallback(async () => {
    showToast('info', 'กำลังซิงค์ฐานข้อมูล', 'กำลังดึงข้อมูลอัปเดตล่าสุดทั้งหมดจาก Google Sheets...');
    const res = await loadAllDataFromDatabase();
    if (res.success) {
      showToast('success', 'ซิงค์สำเร็จ', 'ข้อมูลระบบทั้งหมดเป็นปัจจุบันพร้อมใช้งานแล้ว');
    }
  }, [loadAllDataFromDatabase, showToast]);

  // If user is not logged in, render the login screen
  if (!isLoggedIn) {
    return (
      <div className="relative min-h-screen bg-[#F1F5F9] text-[#0F172A]">
        {toast && (
          <div
            id="app-toast-banner-login"
            className="fixed top-4 right-4 z-50 max-w-sm w-full bg-white rounded-2xl shadow-xl border border-slate-200/80 p-4 animate-in slide-in-from-top-3 flex items-start gap-3"
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                toast.type === 'success'
                  ? 'bg-emerald-100 text-emerald-700'
                  : toast.type === 'error'
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : toast.type === 'error' ? (
                <AlertCircle className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div className="flex-1">
              <h4 className="text-xs font-bold text-slate-900">{toast.title}</h4>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{toast.message}</p>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <LoginScreen
          staffList={staffList}
          onLoginAttempt={handleLoginAttempt}
          onPerformFullSync={loadAllDataFromDatabase}
          onUpdatePassword={handleUpdateUserPassword}
          sheetsConnected={!!sheetsConfig?.spreadsheetId}
          isLoadingData={isLoadingData}
          onLoginComplete={() => {
            setIsLoggedIn(true);
            setActiveTab('dashboard');
            showToast('success', 'เข้าสู่ระบบสำเร็จ', 'โหลดข้อมูลระบบทั้งหมดพร้อมใช้งานเรียบร้อยแล้ว');
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-[#0F172A] font-sans flex flex-col lg:flex-row selection:bg-[#1D4ED8] selection:text-white pb-20 lg:pb-0">
      {/* Toast Notification Alert */}
      {toast && (
        <div
          id="app-toast-banner"
          className="fixed top-4 right-4 z-50 max-w-sm w-full bg-white rounded-2xl shadow-xl border border-slate-200/80 p-4 animate-in slide-in-from-top-3 flex items-start gap-3"
        >
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              toast.type === 'success'
                ? 'bg-blue-100 text-blue-700'
                : toast.type === 'error'
                ? 'bg-rose-100 text-rose-700'
                : 'bg-blue-100 text-blue-700'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-bold text-slate-900">{toast.title}</h4>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{toast.message}</p>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Left Sidebar Navigation (Desktop) & Top/Bottom Bar (Mobile) */}
      <Navbar
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={handleSelectTab}
        onOpenNewOrder={handleOpenNewOrderTab}
        onOpenNewCustomer={handleOpenNewCustomerModal}
        onOpenRoleSwitcher={handleOpenRoleSwitcherModal}
        onOpenSettings={handleOpenSettingsModal}
        onLogout={handleLogout}
        sheetsConfig={sheetsConfig}
        lineSettings={lineSettings}
        orderCount={orders.length}
        customerCount={customers.length}
        todaySalesAmount={todaySalesAmount}
        deliveryCount={pendingDeliveriesCount}
        depositCount={activeDepositsCount}
        hiredVehicleCount={pendingHiredPayoutsCount}
        fleetVehicleCount={fleetVehicles.length}
        fleetAlertCount={fleetAlertCount}
        maintenanceCount={activeMaintenanceCount}
        isLoadingData={isLoadingData}
        onRefreshDatabase={handleRefreshDatabaseFromNav}
      />

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Top Header Bar (Application Name & Logged-in Employee Name) */}
        <header className="flex sticky top-0 z-20 bg-[#FFFFFF] gpu-layer border-b border-slate-200 px-2.5 sm:px-6 lg:px-8 py-2 sm:py-3 items-center justify-between gap-2 w-full max-w-full overflow-hidden">
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Mobile Logo & App Name (visible only on mobile where Navbar is hidden) */}
            <div className="flex lg:hidden items-center gap-1.5 sm:gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#FFFFFF] flex items-center justify-center shadow-2xs border border-slate-200 p-0.5 shrink-0">
                <TotalEmblem className="w-5 h-5 sm:w-6 sm:h-6 drop-shadow-xs" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  <h1 className="font-extrabold text-[12px] sm:text-[13px] tracking-tight text-[#0F172A] leading-none truncate">
                    TOTAL
                  </h1>
                </div>
                <span className="text-[9px] text-slate-500 font-medium leading-none mt-0.5">
                  Solution
                </span>
              </div>
            </div>

            <span className="font-extrabold text-sm sm:text-base text-[#0F172A] tracking-tight hidden sm:block">ระบบจัดการงานภายในองค์กร</span>
          </div>

          <div className="flex items-center justify-end gap-1.5 sm:gap-3 min-w-0 flex-1 sm:flex-none">
            {/* Logged in employee name display button (constrained on mobile so it never overflows) */}
            <button
              id="desktop-header-user-badge"
              onClick={handleOpenRoleSwitcherModal}
              className="flex items-center gap-1.5 sm:gap-2.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-slate-200 bg-[#F1F5F9] hover:bg-blue-50 hover:border-blue-200 active:bg-blue-100/70 transition-all text-left group cursor-pointer min-w-0 max-w-full"
              title={`เข้าสู่ระบบโดย: ${currentUser.name} - คลิกเพื่อสลับสิทธิ์ผู้ใช้งาน`}
            >
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#1D4ED8] text-white font-bold text-[11px] sm:text-xs flex items-center justify-center shrink-0 shadow-2xs">
                {currentUser.name.charAt(0)}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                  <span className="text-[10px] sm:text-xs text-slate-500 font-medium hidden sm:inline shrink-0">เข้าสู่ระบบโดย:</span>
                  <span className="text-[11px] sm:text-sm font-bold text-[#0F172A] truncate">
                    {currentUser.name}
                  </span>
                  <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#1D4ED8] shrink-0" />
                </div>
                <div className="flex items-center gap-1 text-[9.5px] sm:text-[10px] text-[#1D4ED8] font-semibold min-w-0 leading-tight">
                  <span className="truncate">{getRoleShortLabel(currentUser.role)}</span>
                </div>
              </div>
            </button>
          </div>
        </header>

        <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          <Suspense fallback={<ViewLoadingFallback />}>
          {activeTab === 'orders' ? (
            <OrderList
              orders={orders}
              currentUser={currentUser}
              onSelectOrder={(ord) => setSelectedOrderForDetail(ord)}
              onUpdateStatus={handleUpdateStatus}
              onOpenNewOrder={() => { setEditingOrder(null); setActiveTab('new_order'); }}
            />
          ) : activeTab === 'customers' ? (
            <CustomerManagementView
              customers={customers}
              currentUser={currentUser}
              routes={routes}
              staffList={staffList}
              onManageRoutes={() => setActiveTab('routes')}
              onSaveCustomer={handleSaveCustomer}
              onDeleteCustomer={handleDeleteCustomer}
              onRefreshCustomers={handleRefreshCustomers}
              onOpenOrderForCustomer={(cust) => {
                setPreselectedCustomerForOrder(cust);
                setActiveTab('new_order');
              }}
              onNavigateToCheckIn={(cust) => {
                setPreselectedCustomerForCheckIn(cust);
                handleSelectTab('checkin');
              }}
              sheetsConnected={!!sheetsConfig?.spreadsheetId}
            />
          ) : activeTab === 'checkin' ? (
            <StoreCheckInView
              customers={customers}
              checkIns={checkIns}
              currentUser={currentUser}
              routes={routes}
              staffList={staffList}
              onSaveCheckIn={handleSaveCheckIn}
              onOpenOrderForCustomer={(cust) => {
                setPreselectedCustomerForOrder(cust);
                setActiveTab('new_order');
              }}
              onManageRoutes={() => setActiveTab('routes')}
              preselectedCustomerForCheckIn={preselectedCustomerForCheckIn}
              onClearPreselectedCustomer={() => setPreselectedCustomerForCheckIn(null)}
              sheetsConnected={!!sheetsConfig?.spreadsheetId}
              gpsRefreshTrigger={checkInEntryCount}
              dailySchedules={dailySchedules}
              onSaveDailySchedule={handleSaveDailySchedule}
              onBatchSaveDailySchedules={handleBatchSaveDailySchedules}
              onDeleteDailySchedule={handleDeleteDailySchedule}
            />
          ) : activeTab === 'expenses' ? (
            <ExpenseManagementView
              currentUser={currentUser}
              expenses={expenses}
              onSaveExpense={handleSaveExpense}
              onShowToast={showToast}
            />
          ) : activeTab === 'users' ? (
            <UserManagementView
              staffList={staffList}
              onUpdateStaffList={setStaffList}
              currentUser={currentUser}
              sheetsConfig={sheetsConfig}
              onShowToast={showToast}
            />
          ) : activeTab === 'routes' ? (
            <RouteManagementView
              routes={routes}
              customers={customers}
              checkIns={checkIns}
              staffList={staffList}
              currentUser={currentUser}
              dailySchedules={dailySchedules}
              routeScheduleHistory={routeScheduleHistory}
              onRefreshRouteSchedules={handleRefreshRouteSchedules}
              onClearRouteCache={handleClearRouteCache}
              sheetsConnected={!!sheetsConfig?.spreadsheetId}
              onSaveDailySchedule={handleSaveDailySchedule}
              onBatchSaveDailySchedules={handleBatchSaveDailySchedules}
              onDeleteDailySchedule={handleDeleteDailySchedule}
              onSaveRoute={handleSaveRoute}
              onDeleteRoute={handleDeleteRoute}
              isProcessing={isLoadingData}
            />
          ) : activeTab === 'export' ? (
            <ExportReportView
              orders={orders}
              staffList={staffList}
              checkIns={checkIns}
              customers={customers}
            />
          ) : activeTab === 'logistics_dashboard' ? (
            <LogisticsDashboardView
              orders={orders}
              maintenanceRecords={maintenanceRecords}
              hiredVehicles={hiredVehicles}
              deposits={deposits}
              partnerDepositVehicles={partnerDepositVehicles}
              partnerDepositDeductions={partnerDepositDeductions}
              partnerDepositWithdrawals={partnerDepositWithdrawals}
              fleetVehicles={fleetVehicles}
              onNavigateToLogistics={() => setActiveTab('logistics')}
              onNavigateToMaintenance={() => setActiveTab('maintenance')}
              onNavigateToHiredVehicles={() => setActiveTab('hired_vehicles')}
              onNavigateToDeposits={() => setActiveTab('deposits')}
              onNavigateToFleet={() => setActiveTab('fleet_vehicles')}
            />
          ) : activeTab === 'logistics' ? (
            <LogisticsManagementView
              orders={orders}
              currentUser={currentUser}
              staffList={staffList}
              routes={routes}
              fleetVehicles={fleetVehicles}
              onUpdateStatus={handleUpdateStatus}
              onUpdateOrder={handleUpdateOrder}
              onSelectOrder={(ord) => setSelectedOrderForDetail(ord)}
              onRefreshOrders={handleRefreshFromSheets}
              sheetsConnected={!!sheetsConfig?.spreadsheetId}
              spreadsheetId={sheetsConfig?.spreadsheetId}
              onShowToast={showToast}
            />
          ) : activeTab === 'deposits' ? (
            <DepositManagementView
              vehicles={partnerDepositVehicles}
              deductions={partnerDepositDeductions}
              withdrawals={partnerDepositWithdrawals}
              fleetVehicles={fleetVehicles}
              currentUser={currentUser}
              sheetsConnected={!!sheetsConfig?.spreadsheetId}
              isSyncing={isLoadingData}
              onRefresh={handleRefreshFromSheets}
              onNavigateToFleet={() => setActiveTab('fleet_vehicles')}
              onSaveDepositConfig={handleSavePartnerDepositConfig}
              onUnenrollVehicleDeposit={handleUnenrollPartnerDepositVehicle}
              onAddDeduction={handleAddPartnerDepositDeduction}
              onDeleteDeduction={handleDeletePartnerDepositDeduction}
              onAddWithdrawal={handleAddPartnerDepositWithdrawal}
              onDeleteWithdrawal={handleDeletePartnerDepositWithdrawal}
              onShowToast={showToast}
            />
          ) : activeTab === 'hired_vehicles' ? (
            <HiredVehicleExpensesView
              trips={hiredVehicles}
              orders={orders}
              currentUser={currentUser}
              staffList={staffList}
              routes={routes}
              onSaveTrip={handleSaveHiredTrip}
              onUpdateTrip={handleUpdateHiredTrip}
              onDeleteTrip={handleDeleteHiredTrip}
              sheetsConnected={!!sheetsConfig?.spreadsheetId}
            />
          ) : activeTab === 'fleet_vehicles' ? (
            <FleetManagementView
              vehicles={fleetVehicles}
              maintenanceRecords={maintenanceRecords}
              currentUser={currentUser}
              staffList={staffList}
              onSaveVehicle={handleSaveFleetVehicle}
              onUpdateVehicle={handleUpdateFleetVehicle}
              onDeleteVehicle={handleDeleteFleetVehicle}
              sheetsConnected={!!sheetsConfig?.spreadsheetId}
              onNavigateToMaintenance={() => setActiveTab('maintenance')}
              onShowToast={showToast}
            />
          ) : activeTab === 'maintenance' ? (
            <VehicleMaintenanceView
              records={maintenanceRecords}
              fleetVehicles={fleetVehicles}
              currentUser={currentUser}
              staffList={staffList}
              routes={routes}
              onSaveRecord={handleSaveMaintenance}
              onUpdateRecord={handleUpdateMaintenance}
              onDeleteRecord={handleDeleteMaintenance}
              sheetsConnected={!!sheetsConfig?.spreadsheetId}
            />
          ) : activeTab === 'new_order' ? (
            <OrderFormModal
              isOpen={true}
              currentUser={currentUser}
              products={products}
              customers={customers}
              initialCustomer={preselectedCustomerForOrder}
              editingOrder={editingOrder}
              onClose={() => {
                setActiveTab('orders');
                setEditingOrder(null);
                setPreselectedCustomerForOrder(null);
              }}
              onSubmitOrder={async (orderData) => {
                await handleCreateOrder(orderData);
                setActiveTab('orders');
              }}
              onUpdateOrder={async (order) => {
                await handleUpdateOrder(order);
                setActiveTab('orders');
              }}
              onRefreshProducts={async () => {
                if (sheetsConfig?.spreadsheetId) {
                  const freshProducts = await fetchProductsFromSheet(sheetsConfig.spreadsheetId);
                  if (freshProducts && freshProducts.length > 0) {
                    setProducts(freshProducts);
                    showToast(
                      'success',
                      'อัปเดตแคตตาล็อกสำเร็จ',
                      'ดึงข้อมูลสินค้าล่าสุดจาก Google Sheets เรียบร้อยแล้ว'
                    );
                  }
                }
              }}
            />
          ) : (
            <DashboardView
              orders={orders}
              customers={customers}
              routes={routes}
              currentUser={currentUser}
              onOpenNewOrder={() => { setEditingOrder(null); setActiveTab('new_order'); }}
              onNavigateToLogistics={() => setActiveTab('logistics')}
              onNavigateToCustomers={() => setActiveTab('customers')}
            />
          )}
          </Suspense>
        </main>
      </div>

      {/* Modals */}
      <Suspense fallback={null}>
      {isNewCustomerOpen && (
        <NewCustomerModal
          isOpen={isNewCustomerOpen}
          onClose={() => setIsNewCustomerOpen(false)}
          currentUser={currentUser}
          routes={routes}
          onSaveCustomer={handleSaveCustomer}
          sheetsConnected={!!sheetsConfig?.spreadsheetId}
        />
      )}

      {isNewOrderOpen && (
        <OrderFormModal
          isOpen={isNewOrderOpen}
          currentUser={currentUser}
          products={products}
          customers={customers}
          initialCustomer={preselectedCustomerForOrder}
          editingOrder={editingOrder}
          onClose={() => {
            setIsNewOrderOpen(false);
            setEditingOrder(null);
            setPreselectedCustomerForOrder(null);
          }}
          onSubmitOrder={handleCreateOrder}
          onUpdateOrder={handleUpdateOrder}
          onRefreshProducts={async () => {
            if (sheetsConfig?.spreadsheetId) {
              const freshProducts = await fetchProductsFromSheet(sheetsConfig.spreadsheetId);
              if (freshProducts && freshProducts.length > 0) {
                setProducts(freshProducts);
                showToast(
                  'success',
                  'อัปเดตแคตตาล็อกสำเร็จ',
                  `ดึงข้อมูลสินค้าจริงจาก Google Sheets แล้ว ${freshProducts.length} รายการ`
                );
              }
            }
          }}
          onRefreshCustomers={async () => {
            if (sheetsConfig?.spreadsheetId) {
              const freshCustomers = await fetchCustomersFromSheet(sheetsConfig.spreadsheetId);
              if (freshCustomers && freshCustomers.length > 0) {
                setCustomers(sanitizeCustomerData(freshCustomers));
                showToast(
                  'success',
                  'อัปเดตข้อมูลลูกค้าสำเร็จ',
                  `ดึงข้อมูลลูกค้าจริงจาก Google Sheets แล้ว ${freshCustomers.length} รายการ`
                );
              }
            }
          }}
          sheetsConnected={!!sheetsConfig?.spreadsheetId}
          
        />
      )}

      {selectedOrderForDetail && (
        <OrderDetailModal
          order={selectedOrderForDetail}
          currentUser={currentUser}
          products={products}
          customers={customers}
          routes={routes}
          onClose={() => setSelectedOrderForDetail(null)}
          onUpdateStatus={handleUpdateStatus}
          onEditOrder={handleStartEditOrder}
        />
      )}



      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          sheetsConfig={sheetsConfig}
          lineSettings={lineSettings}
          onUpdateSheetsConfig={handleUpdateSheetsConfig}
          onUpdateLineSettings={setLineSettings}
          onClose={() => setIsSettingsOpen(false)}
          
          
          onRefreshFromSheets={handleRefreshFromSheets}
        />
      )}

      {isRoleSwitcherOpen && (
        <RoleSwitcherModal
          isOpen={isRoleSwitcherOpen}
          currentUser={currentUser}
          staffList={staffList}
          onSelectUser={handleSwitchUser}
          onClose={() => setIsRoleSwitcherOpen(false)}
          onLogout={handleLogout}
          onOpenUserManagement={() => {
            setIsRoleSwitcherOpen(false);
            setActiveTab('users');
          }}
        />
      )}
      </Suspense>

      {confirmDialog.isOpen && (
        <ConfirmModal
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          isDestructive={confirmDialog.isDestructive}
          onConfirm={confirmDialog.onConfirm}
          onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        />
      )}

      {/* Popup ยืนยันการบันทึกข้อมูลลูกค้าสำเร็จ + ชวนเช็คอินร้านนี้ทันที */}
      {savedCustomerSuccessPopup && (
        <div
          className="fixed inset-0 z-[70] bg-slate-900/65 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={() => setSavedCustomerSuccessPopup(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="relative p-5 sm:p-6 text-center">
              <button
                type="button"
                onClick={() => setSavedCustomerSuccessPopup(null)}
                aria-label="ปิดหน้าต่าง"
                className="absolute top-3.5 right-3.5 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-14 h-14 mx-auto mb-3.5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center ring-8 ring-emerald-50">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <h3 className="text-lg font-extrabold text-slate-900">
                {savedCustomerSuccessPopup.isEdit ? 'อัปเดตข้อมูลสำเร็จ!' : 'บันทึกข้อมูลสำเร็จ!'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                บันทึกข้อมูลร้านค้าลงฐานข้อมูลเรียบร้อยแล้ว
              </p>

              {/* Saved Store Summary */}
              <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-3 text-left">
                {savedCustomerSuccessPopup.customer.photoUrls?.[0] &&
                getDriveImageDisplayUrl(savedCustomerSuccessPopup.customer.photoUrls[0], 200) ? (
                  <img
                    src={getDriveImageDisplayUrl(savedCustomerSuccessPopup.customer.photoUrls[0], 200)}
                    alt={savedCustomerSuccessPopup.customer.name}
                    className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0 bg-white"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                    <Store className="w-5 h-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {savedCustomerSuccessPopup.customer.name}
                  </p>
                  {savedCustomerSuccessPopup.customer.phone && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                      <Phone className="w-3 h-3 shrink-0 text-slate-400" />
                      <span>{savedCustomerSuccessPopup.customer.phone}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Prompt Question */}
              <div className="mt-4 p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80">
                <p className="text-sm font-bold text-emerald-900">
                  ต้องการเช็คอินร้านนี้เลยไหม?
                </p>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  กดปุ่มด้านล่างเพื่อเข้าหน้าเช็คอินร้านนี้ได้ทันที
                </p>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const targetCustomer = savedCustomerSuccessPopup.customer;
                    setSavedCustomerSuccessPopup(null);
                    setPreselectedCustomerForCheckIn(targetCustomer);
                    handleSelectTab('checkin');
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-sm font-bold shadow-sm transition-all cursor-pointer"
                >
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span>เช็คอินร้านนี้เลย</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSavedCustomerSuccessPopup(null)}
                  className="sm:w-28 inline-flex items-center justify-center px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 text-sm font-semibold transition-all cursor-pointer"
                >
                  ไว้ทีหลัง
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Background Sync Floating Indicator (shown ONLY while actively syncing or when retry is needed) */}
      {pendingSyncJobs.length > 0 && (() => {
        const activeJobs = pendingSyncJobs.filter(
          (j) => j.status === 'syncing' || j.status === 'pending'
        );
        const failedJobs = pendingSyncJobs.filter((j) => j.status === 'failed');
        const currentJob = activeJobs[0] || failedJobs[0];
        const isSyncingNow = activeJobs.length > 0;
        return (
          <div className="fixed bottom-20 lg:bottom-5 right-3 sm:right-5 z-40 max-w-xs sm:max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl shadow-lg border text-xs ${
                isSyncingNow
                  ? 'bg-white border-blue-200 text-slate-800'
                  : 'bg-amber-50 border-amber-300 text-amber-900'
              }`}
            >
              {isSyncingNow ? (
                <Loader2 className="w-4 h-4 text-[#1D4ED8] animate-spin shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold leading-tight truncate">
                  {isSyncingNow
                    ? `กำลังซิงค์ข้อมูลขึ้นระบบ (${activeJobs.length} รายการ)`
                    : `ค้างซิงค์ ${failedJobs.length} รายการ`}
                </p>
                {currentJob && (
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {currentJob.label}
                  </p>
                )}
              </div>
              {!isSyncingNow && failedJobs.length > 0 && (
                <button
                  type="button"
                  onClick={handleRetryFailedSyncJobs}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1D4ED8] hover:bg-blue-700 text-white font-bold text-[11px] shrink-0 cursor-pointer transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>ลองส่งใหม่</span>
                </button>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
