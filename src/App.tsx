import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  DailyRouteSchedule,
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
  INITIAL_ROUTES,
} from './data/mockData';
import { formatNowUtcPlus7Iso } from './utils/callPlanUtils';
import { normalizeThaiPhone } from './utils/phoneUtils';

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
  setUserPasswordInSheet,
  syncCheckInToSheets,
  fetchCheckInsFromSheet,
  syncExpenseToSheets,
  fetchExpensesFromSheet,
  syncDepositToSheets,
  updateDepositInSheet,
  fetchDepositsFromSheet,
  syncHiredVehicleTripToSheets,
  updateHiredVehicleTripInSheet,
  fetchHiredVehicleTripsFromSheet,
  syncMaintenanceToSheets,
  updateMaintenanceInSheet,
  deleteMaintenanceFromSheet,
  fetchMaintenanceFromSheet,
  DEFAULT_GAS_URL,
  LEGACY_DEFAULT_GAS_URL,
  fetchSharedSystemConfig,
  saveSharedSystemConfig,
} from './services/googleSheets';
import { logoutGoogle } from './services/auth';
import { sendLineNotification } from './services/lineNotify';
import { playNotificationChime } from './utils/audio';
import { extractCustomerCoords } from './utils/geoUtils';
import { getDriveImageDisplayUrl } from './services/googleDrive';

// Components
import { Navbar } from './components/Navbar';
import { TotalEmblem } from './components/TotalLogo';
import { OrderList } from './components/OrderList';
import { DashboardView } from './components/DashboardView';
import { CustomerManagementView } from './components/CustomerManagementView';
import { StoreCheckInView } from './components/StoreCheckInView';
import { ExpenseManagementView } from './components/ExpenseManagementView';
import { NewCustomerModal } from './components/NewCustomerModal';
import { RouteManagementView } from './components/RouteManagementView';
import { OrderFormModal } from './components/OrderFormModal';
import { OrderDetailModal } from './components/OrderDetailModal';
import { ExportReportView } from './components/ExportReportView';
import { SettingsModal } from './components/SettingsModal';
import { RoleSwitcherModal } from './components/RoleSwitcherModal';
import { UserManagementView } from './components/UserManagementView';
import { LogisticsManagementView } from './components/LogisticsManagementView';
import { DepositManagementView } from './components/DepositManagementView';
import { HiredVehicleExpensesView } from './components/HiredVehicleExpensesView';
import { VehicleMaintenanceView } from './components/VehicleMaintenanceView';
import { LoginScreen } from './components/LoginScreen';
import { ConfirmModal } from './components/ConfirmModal';

import {
  CheckCircle2,
  AlertCircle,
  X,
  ChevronDown,
  RefreshCw,
  MapPin,
  Phone,
  Store,
} from 'lucide-react';

// Helper to parse dates that might be in Thai format (DD/MM/YYYY) or ISO
export function parseDateRobust(dateStr: string): Date {
  if (!dateStr) return new Date();
  const trimmed = String(dateStr).trim();
  
  // Try standard ISO parsing if it has a clean format
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime()) && trimmed.includes('-') && !trimmed.includes('/')) {
    // If Buddhist year was parsed e.g. 2567-2569
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
        // YYYY-MM-DD
        year = parseInt(dParts[0], 10) || year;
        month = parseInt(dParts[1], 10) || 1;
        day = parseInt(dParts[2], 10) || 1;
      } else {
        // DD/MM/YYYY
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

export function formatThaiDateTime(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const d = parseDateRobust(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    
    const day = d.getDate();
    const thaiMonths = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    const month = thaiMonths[d.getMonth()];
    const year = d.getFullYear() + 543;
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    // If time was 00:00 and string didn't have time
    const hasTime = dateStr.includes(':') || dateStr.includes('T');
    if (hasTime && (d.getHours() > 0 || d.getMinutes() > 0)) {
      return `${day} ${month} ${year} เวลา ${hours}:${minutes} น.`;
    }
    return `${day} ${month} ${year}`;
  } catch {
    return String(dateStr);
  }
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
    const saved = localStorage.getItem('iora_routes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
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
          const mockNames = [
            'คอฟฟี่คอร์เนอร์',
            'สยามซอฟต์',
            'สหปัญญา',
            'สมศักดิ์ ภักดี',
            'ชาบูหม้อไฟทอง',
            'ปรีชา ลัดดาวัลย์',
            'สไมล์พลัส',
          ];
          const nonMock = parsed.filter(
            (c: Customer) => !mockNames.some((m) => c.name?.includes(m))
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

  const [hiredVehicles, setHiredVehicles] = useState<HiredVehicleTripRecord[]>(() => {
    const saved = localStorage.getItem('iora_hired_vehicles');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return INITIAL_HIRED_VEHICLES;
  });

  const [maintenanceRecords, setMaintenanceRecords] = useState<VehicleMaintenanceRecord[]>(() => {
    const saved = localStorage.getItem('iora_vehicle_maintenance');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return INITIAL_MAINTENANCE_RECORDS;
  });

  const [activeTab, setActiveTab] = useState<'orders' | 'dashboard' | 'customers' | 'checkin' | 'expenses' | 'users' | 'routes' | 'export' | 'new_order' | 'logistics' | 'deposits' | 'hired_vehicles' | 'maintenance'>('dashboard');
  const [checkInEntryCount, setCheckInEntryCount] = useState<number>(0);

  const handleSelectTab = (tab: typeof activeTab) => {
    if (tab === 'checkin') {
      setCheckInEntryCount((prev) => prev + 1);
    }
    setActiveTab(tab);
  };

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

  const showToast = (type: 'success' | 'error' | 'info', title: string, message: string) => {
    const id = Date.now().toString();
    setToast({ id, type, title, message });
    setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, 5000);
  };

  // Sync to LocalStorage safely (prevent crash on storage quota limit on low-spec phones)
  const safeSave = (key: string, value: any) => {
    try {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    } catch (e) {
      console.warn(`[Storage] Safe save skipped for ${key}:`, e);
    }
  };

  useEffect(() => {
    safeSave('iora_orders', orders);
  }, [orders]);

  useEffect(() => {
    safeSave('iora_staff_list', staffList);
  }, [staffList]);

  useEffect(() => {
    safeSave('iora_products', products);
  }, [products]);

  useEffect(() => {
    safeSave('iora_customers', customers);
  }, [customers]);

  useEffect(() => {
    safeSave('iora_checkins', checkIns);
  }, [checkIns]);

  useEffect(() => {
    safeSave('iora_expenses', expenses);
  }, [expenses]);

  useEffect(() => {
    safeSave('iora_deposits', deposits);
  }, [deposits]);

  useEffect(() => {
    safeSave('iora_hired_vehicles', hiredVehicles);
  }, [hiredVehicles]);

  useEffect(() => {
    safeSave('iora_vehicle_maintenance', maintenanceRecords);
  }, [maintenanceRecords]);

  useEffect(() => {
    safeSave('iora_routes', routes);
  }, [routes]);

  useEffect(() => {
    safeSave('iora_call_plan_daily_schedule', dailySchedules);
  }, [dailySchedules]);

  useEffect(() => {
    safeSave('iora_current_user', currentUser);
  }, [currentUser]);

  useEffect(() => {
    safeSave('iora_logged_in', isLoggedIn ? 'true' : 'false');
  }, [isLoggedIn]);

  useEffect(() => {
    safeSave('iora_sheets_config', sheetsConfig);
  }, [sheetsConfig]);

  useEffect(() => {
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
          safeSave('iora_sheets_config', merged);
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
    safeSave('iora_sheets_config', updated);
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
        }
      } catch (bulkErr: any) {
        console.warn('Bulk fetch not supported or failed, falling back to parallel fetch:', bulkErr?.message || bulkErr);
      }

      options?.onProgress?.('กำลังตรวจสอบและอัปเดตข้อมูลแยกแท็บ...', 60);

      // 3. If any tables are missing from bulk, fetch in parallel
      const needsOrders = !sheetOrders;
      const needsUsers = !sheetUsers;
      const needsProducts = !sheetProducts;
      const needsCustomers = !sheetCustomers;
      const needsRoutes = !sheetRoutes;
      const needsCheckIns = !sheetCheckIns;
      const needsExpenses = !sheetExpenses;
      const needsDeposits = !sheetDeposits;
      const needsHiredVehicles = !sheetHiredVehicles;
      const needsMaintenance = !sheetMaintenance;

      const [ordersRes, usersRes, productsRes, customersRes, routesRes, checkInsRes, expensesRes, depositsRes, hiredRes, mntRes] = await Promise.allSettled([
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
      ]);

      options?.onProgress?.('กำลังประมวลผลข้อมูลและเตรียมระบบ...', 85);

      if (ordersRes.status === 'fulfilled' && Array.isArray(ordersRes.value)) {
        const cleanOrders = sanitizeOrderData(ordersRes.value);
        setOrders(cleanOrders);
        safeSave('iora_orders', cleanOrders);
      }
      if (usersRes.status === 'fulfilled' && Array.isArray(usersRes.value) && usersRes.value.length > 0) {
        setStaffList(usersRes.value);
        safeSave('iora_staff_list', usersRes.value);
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
        safeSave('iora_products', productsRes.value);
      }
      if (customersRes.status === 'fulfilled' && Array.isArray(customersRes.value)) {
        const cleanCustomers = sanitizeCustomerData(customersRes.value);
        setCustomers(cleanCustomers);
        safeSave('iora_customers', cleanCustomers);
      }
      if (routesRes.status === 'fulfilled' && Array.isArray(routesRes.value)) {
        setRoutes(routesRes.value);
        safeSave('iora_routes', routesRes.value);
      }
      if (checkInsRes.status === 'fulfilled' && Array.isArray(checkInsRes.value)) {
        setCheckIns(checkInsRes.value);
        safeSave('iora_checkins', checkInsRes.value);
      }
      if (expensesRes.status === 'fulfilled' && Array.isArray(expensesRes.value)) {
        setExpenses(expensesRes.value);
        safeSave('iora_expenses', expensesRes.value);
      }
      if (depositsRes.status === 'fulfilled' && Array.isArray(depositsRes.value)) {
        setDeposits(depositsRes.value);
        safeSave('iora_deposits', depositsRes.value);
      }
      if (hiredRes.status === 'fulfilled' && Array.isArray(hiredRes.value) && hiredRes.value.length > 0) {
        setHiredVehicles(hiredRes.value);
        safeSave('iora_hired_vehicles', hiredRes.value);
      }
      if (mntRes.status === 'fulfilled' && Array.isArray(mntRes.value) && mntRes.value.length > 0) {
        setMaintenanceRecords(mntRes.value);
        safeSave('iora_vehicle_maintenance', mntRes.value);
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
            safeSave('iora_staff_list', freshUsers);
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
      safeSave('iora_current_user', finalUser);

      // Record login in background
      if (sheetsConfig?.spreadsheetId) {
        recordUserLoginInSheet(sheetsConfig.spreadsheetId, finalUser.email).catch(() => {});
      }

      return { success: true };
    } catch(err: any) {
      return { success: false, message: err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ' };
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    showToast('info', 'ออกจากระบบเรียบร้อย', 'ท่านสามารถเข้าสู่ระบบด้วยบัญชีอื่นได้');
  };

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

  // Handle Save Check-in (บันทึกการเช็คอินร้านค้า)
  const handleSaveCheckIn = async (checkIn: StoreCheckIn) => {
    try {
      if (sheetsConfig?.spreadsheetId) {
        await syncCheckInToSheets(sheetsConfig.spreadsheetId, checkIn);
      }
      setCheckIns((prev) => [checkIn, ...prev]);
      playNotificationChime('success');
      showToast('success', 'บันทึกการเช็คอินสำเร็จ', `เช็คอินร้าน "${checkIn.storeName || checkIn.customerName || 'ร้านค้า'}" เรียบร้อยแล้ว`);
      return true;
    } catch (err: any) {
      console.error('Error saving check-in:', err);
      showToast('error', 'บันทึกเช็คอินไม่สำเร็จ', err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      return false;
    }
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
      updatedAt: nowUtcPlus7
    };
    
    setCustomers(prev => {
      const exists = prev.findIndex(c => c.id === newCustomer.id);
      if (exists > -1) {
        const copy = [...prev];
        copy[exists] = newCustomer;
        return copy;
      }
      return [...prev, newCustomer];
    });

    if (sheetsConfig?.spreadsheetId) {
      try {
        await saveCustomerToSheet(sheetsConfig.spreadsheetId, newCustomer);
        playNotificationChime('success');
        setSavedCustomerSuccessPopup({ customer: newCustomer, isEdit: isEditMode });
        return true;
      } catch (err) {
        console.warn('saveCustomerToSheet error:', err);
        return false;
      }
    }
    playNotificationChime('success');
    setSavedCustomerSuccessPopup({ customer: newCustomer, isEdit: isEditMode });
    return true;
  };

  const handleSaveRoute = async (routeData: import('./types').Route): Promise<boolean> => {
    setIsLoadingData(true);
    try {
      if (sheetsConfig?.spreadsheetId) {
        await saveRouteToSheet(sheetsConfig.spreadsheetId, routeData);
        const fetched = await fetchRoutesFromSheet(sheetsConfig.spreadsheetId);
        setRoutes(fetched);
        safeSave('iora_routes', fetched);
        showToast('success', 'บันทึกสำเร็จ', 'อัปเดตข้อมูลสายการเข้าเยี่ยมแล้ว');
        return true;
      }
      setRoutes((prev) => {
        const idx = prev.findIndex((r) => r.id === routeData.id);
        const updated = idx >= 0 ? prev.map((r, i) => (i === idx ? routeData : r)) : [...prev, routeData];
        safeSave('iora_routes', updated);
        return updated;
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
        safeSave('iora_routes', fetched);
        showToast('success', 'ลบสำเร็จ', 'ลบข้อมูลสายการเข้าเยี่ยมแล้ว');
        return true;
      }
      setRoutes((prev) => {
        const updated = prev.filter((r) => r.id !== routeId);
        safeSave('iora_routes', updated);
        return updated;
      });
      showToast('success', 'ลบสำเร็จ', 'ลบข้อมูลสายการเข้าเยี่ยมแล้ว');
      return true;
    } catch (e: any) {
      showToast('error', 'ข้อผิดพลาด', e.message);
      return false;
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleSaveDailySchedule = (dateStr: string, schedule: DailyRouteSchedule) => {
    setDailySchedules((prev) => {
      const updated = { ...prev, [dateStr]: schedule };
      safeSave('iora_call_plan_daily_schedule', updated);
      return updated;
    });
  };

  const handleBatchSaveDailySchedules = (schedules: Record<string, DailyRouteSchedule>) => {
    setDailySchedules(schedules);
    safeSave('iora_call_plan_daily_schedule', schedules);
  };

  const handleDeleteDailySchedule = (dateStr: string) => {
    setDailySchedules((prev) => {
      const updated = { ...prev };
      delete updated[dateStr];
      safeSave('iora_call_plan_daily_schedule', updated);
      return updated;
    });
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

  // Active deposits count for Navbar badge
  const activeDepositsCount = useMemo(() => {
    return deposits.filter(
      (d) => d.status === 'active' || d.status === 'partial_refunded'
    ).length;
  }, [deposits]);

  // Deposit Management Handlers
  const handleSaveDeposit = async (newDeposit: DepositRecord) => {
    setDeposits((prev) => [newDeposit, ...prev]);
    safeSave('iora_deposits', [newDeposit, ...deposits]);
    showToast('success', 'บันทึกสำเร็จ', `บันทึกรับเงินประกัน ${newDeposit.depositNumber} เรียบร้อยแล้ว`);

    if (sheetsConfig?.spreadsheetId) {
      syncDepositToSheets(sheetsConfig.spreadsheetId, newDeposit).catch((e) => {
        console.warn('Sync deposit error:', e);
      });
    }
  };

  const handleUpdateDeposit = async (updatedDeposit: DepositRecord) => {
    setDeposits((prev) => prev.map((d) => (d.id === updatedDeposit.id ? updatedDeposit : d)));
    const updatedList = deposits.map((d) => (d.id === updatedDeposit.id ? updatedDeposit : d));
    safeSave('iora_deposits', updatedList);
    showToast('success', 'อัปเดตสำเร็จ', `บันทึกรายการคืนเงินประกัน ${updatedDeposit.depositNumber} เรียบร้อยแล้ว`);

    if (sheetsConfig?.spreadsheetId) {
      updateDepositInSheet(sheetsConfig.spreadsheetId, updatedDeposit).catch((e) => {
        console.warn('Update deposit error:', e);
      });
    }
  };

  const handleDeleteDeposit = async (depositId: string) => {
    setDeposits((prev) => prev.filter((d) => d.id !== depositId));
    const filtered = deposits.filter((d) => d.id !== depositId);
    safeSave('iora_deposits', filtered);
    showToast('success', 'ลบสำเร็จ', 'ลบรายการเงินประกันเรียบร้อยแล้ว');
  };

  // Pending hired payouts count for Navbar badge
  const pendingHiredPayoutsCount = useMemo(() => {
    return hiredVehicles.filter((h) => h.payoutStatus === 'pending').length;
  }, [hiredVehicles]);

  // Hired Vehicle Handlers
  const handleSaveHiredTrip = async (newTrip: HiredVehicleTripRecord) => {
    setHiredVehicles((prev) => [newTrip, ...prev]);
    const updatedList = [newTrip, ...hiredVehicles];
    safeSave('iora_hired_vehicles', updatedList);
    showToast('success', 'บันทึกสำเร็จ', `บันทึกรอบวิ่งของ ${newTrip.vehiclePlate} เรียบร้อยแล้ว`);

    if (sheetsConfig?.spreadsheetId) {
      syncHiredVehicleTripToSheets(sheetsConfig.spreadsheetId, newTrip).catch((e) => {
        console.warn('Sync hired vehicle trip error:', e);
      });
    }
  };

  const handleUpdateHiredTrip = async (updatedTrip: HiredVehicleTripRecord) => {
    setHiredVehicles((prev) => prev.map((t) => (t.id === updatedTrip.id ? updatedTrip : t)));
    const updatedList = hiredVehicles.map((t) => (t.id === updatedTrip.id ? updatedTrip : t));
    safeSave('iora_hired_vehicles', updatedList);
    showToast('success', 'อัปเดตสำเร็จ', `บันทึกข้อมูลรถ ${updatedTrip.vehiclePlate} เรียบร้อยแล้ว`);

    if (sheetsConfig?.spreadsheetId) {
      updateHiredVehicleTripInSheet(sheetsConfig.spreadsheetId, updatedTrip).catch((e) => {
        console.warn('Update hired vehicle trip error:', e);
      });
    }
  };

  const handleDeleteHiredTrip = async (tripId: string) => {
    setHiredVehicles((prev) => prev.filter((t) => t.id !== tripId));
    const filtered = hiredVehicles.filter((t) => t.id !== tripId);
    safeSave('iora_hired_vehicles', filtered);
    showToast('success', 'ลบสำเร็จ', 'ลบรายการรอบวิ่งงานเรียบร้อยแล้ว');
  };

  // Active / in-progress maintenance count for Navbar badge
  const activeMaintenanceCount = useMemo(() => {
    return maintenanceRecords.filter((m) => m.status !== 'completed').length;
  }, [maintenanceRecords]);

  // Vehicle Maintenance Handlers
  const handleSaveMaintenance = async (newRecord: VehicleMaintenanceRecord) => {
    setMaintenanceRecords((prev) => [newRecord, ...prev]);
    const updatedList = [newRecord, ...maintenanceRecords];
    safeSave('iora_vehicle_maintenance', updatedList);
    showToast('success', 'บันทึกสำเร็จ', `บันทึกงานบำรุงรักษาของ ${newRecord.vehiclePlate} เรียบร้อยแล้ว`);

    if (sheetsConfig?.spreadsheetId) {
      syncMaintenanceToSheets(sheetsConfig.spreadsheetId, newRecord).catch((e) => {
        console.warn('Sync maintenance error:', e);
      });
    }
  };

  const handleUpdateMaintenance = async (updatedRecord: VehicleMaintenanceRecord) => {
    setMaintenanceRecords((prev) => prev.map((m) => (m.id === updatedRecord.id ? updatedRecord : m)));
    const updatedList = maintenanceRecords.map((m) => (m.id === updatedRecord.id ? updatedRecord : m));
    safeSave('iora_vehicle_maintenance', updatedList);
    showToast('success', 'อัปเดตสำเร็จ', `บันทึกข้อมูลงานซ่อม ${updatedRecord.vehiclePlate} เรียบร้อยแล้ว`);

    if (sheetsConfig?.spreadsheetId) {
      updateMaintenanceInSheet(sheetsConfig.spreadsheetId, updatedRecord).catch((e) => {
        console.warn('Update maintenance error:', e);
      });
    }
  };

  const handleDeleteMaintenance = async (recordId: string) => {
    setMaintenanceRecords((prev) => prev.filter((m) => m.id !== recordId));
    const filtered = maintenanceRecords.filter((m) => m.id !== recordId);
    safeSave('iora_vehicle_maintenance', filtered);
    showToast('success', 'ลบสำเร็จ', 'ลบรายการบำรุงรักษาเรียบร้อยแล้ว');

    if (sheetsConfig?.spreadsheetId) {
      deleteMaintenanceFromSheet(sheetsConfig.spreadsheetId, recordId).catch((e) => {
        console.warn('Delete maintenance error:', e);
      });
    }
  };

  // If user is not logged in, render the login screen
  if (!isLoggedIn) {
    return (
      <div className="relative min-h-screen bg-slate-900">
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
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans flex flex-col lg:flex-row selection:bg-blue-600 selection:text-white pb-20 lg:pb-0">
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
        onOpenNewOrder={() => { setEditingOrder(null); setActiveTab('new_order'); }}
        onOpenNewCustomer={() => setIsNewCustomerOpen(true)}
        onOpenRoleSwitcher={() => setIsRoleSwitcherOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLogout={handleLogout}
        sheetsConfig={sheetsConfig}
        lineSettings={lineSettings}
        orderCount={orders.length}
        customerCount={customers.length}
        todaySalesAmount={todaySalesAmount}
        deliveryCount={pendingDeliveriesCount}
        depositCount={activeDepositsCount}
        hiredVehicleCount={pendingHiredPayoutsCount}
        maintenanceCount={activeMaintenanceCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Top Header Bar (Application Name & Logged-in Employee Name) */}
        <header className="flex sticky top-0 z-20 bg-white gpu-layer border-b border-slate-200/80 px-2.5 sm:px-6 lg:px-8 py-2 sm:py-3 items-center justify-between gap-2 w-full max-w-full overflow-hidden shadow-2xs">
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Mobile Logo & App Name (visible only on mobile where Navbar is hidden) */}
            <div className="flex lg:hidden items-center gap-1.5 sm:gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white flex items-center justify-center shadow-sm border border-slate-200/70 p-0.5 shrink-0">
                <TotalEmblem className="w-5 h-5 sm:w-6 sm:h-6 drop-shadow-xs" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  <h1 className="font-extrabold text-[12px] sm:text-[13px] tracking-tight text-slate-900 leading-none truncate">
                    TOTAL
                  </h1>
                </div>
                <span className="text-[9px] text-slate-500 font-medium leading-none mt-0.5">
                  Solution
                </span>
              </div>
            </div>

            <span className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight hidden sm:block">ระบบจัดการงาน</span>
            {sheetsConfig?.spreadsheetId ? (
              <div className="flex items-center gap-1 sm:gap-1.5">
                <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0"></span>
                  <span className="hidden sm:inline">Google Sheets Online</span><span className="sm:hidden">Online</span>
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    showToast('info', 'กำลังซิงค์ฐานข้อมูล', 'กำลังดึงข้อมูลอัปเดตล่าสุดทั้งหมดจาก Google Sheets...');
                    const res = await loadAllDataFromDatabase();
                    if (res.success) {
                      showToast('success', 'ซิงค์สำเร็จ', 'ข้อมูลระบบทั้งหมดเป็นปัจจุบันพร้อมใช้งานแล้ว');
                    }
                  }}
                  disabled={isLoadingData}
                  className="p-1 sm:px-2 sm:py-0.5 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 transition-colors inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
                  title="คลิกเพื่อดึงข้อมูลทั้งหมดจากฐานข้อมูลใหม่"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
                  <span className="hidden md:inline">{isLoadingData ? 'กำลังซิงค์...' : 'รีเฟรชฐานข้อมูล'}</span>
                </button>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                <span className="hidden sm:inline">โหมดออฟไลน์</span><span className="sm:hidden">Offline</span>
              </span>
            )}
          </div>

          <div className="flex items-center justify-end gap-1.5 sm:gap-3 min-w-0 flex-1 sm:flex-none">
            {/* Logged in employee name display button (constrained on mobile so it never overflows) */}
            <button
              id="desktop-header-user-badge"
              onClick={() => setIsRoleSwitcherOpen(true)}
              className="flex items-center gap-1.5 sm:gap-2.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-blue-200/90 bg-blue-50/70 hover:bg-blue-100/70 active:bg-blue-100 transition-all text-left shadow-2xs group cursor-pointer min-w-0 max-w-full"
              title={`เข้าสู่ระบบโดย: ${currentUser.name} - คลิกเพื่อสลับสิทธิ์ผู้ใช้งาน`}
            >
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-blue-600 text-white font-bold text-[11px] sm:text-xs flex items-center justify-center shrink-0 shadow-2xs">
                {currentUser.name.charAt(0)}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                  <span className="text-[10px] sm:text-xs text-slate-500 font-medium hidden sm:inline shrink-0">เข้าสู่ระบบโดย:</span>
                  <span className="text-[11px] sm:text-sm font-bold text-slate-900 truncate">
                    {currentUser.name}
                  </span>
                  <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-700 group-hover:text-blue-900 shrink-0" />
                </div>
                <div className="flex items-center gap-1 text-[9.5px] sm:text-[10px] text-blue-700 font-medium min-w-0 leading-tight">
                  <span className="truncate">
                    {currentUser.role === 'admin'
                      ? 'Admin สูงสุด'
                      : currentUser.role === 'manager'
                      ? 'ผู้จัดการฝ่าย'
                      : currentUser.role === 'sales'
                      ? 'พนักงานขาย'
                      : currentUser.role === 'delivery'
                      ? 'ทีมจัดส่ง'
                      : 'ผู้ตรวจสอบ'}
                  </span>
                </div>
              </div>
            </button>
          </div>
        </header>

        <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
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
          ) : activeTab === 'logistics' ? (
            <LogisticsManagementView
              orders={orders}
              currentUser={currentUser}
              staffList={staffList}
              routes={routes}
              onUpdateStatus={handleUpdateStatus}
              onUpdateOrder={handleUpdateOrder}
              onSelectOrder={(ord) => setSelectedOrderForDetail(ord)}
              onRefreshOrders={handleRefreshFromSheets}
              sheetsConnected={!!sheetsConfig?.spreadsheetId}
            />
          ) : activeTab === 'deposits' ? (
            <DepositManagementView
              deposits={deposits}
              currentUser={currentUser}
              customers={customers}
              routes={routes}
              onSaveDeposit={handleSaveDeposit}
              onUpdateDeposit={handleUpdateDeposit}
              onDeleteDeposit={handleDeleteDeposit}
              sheetsConnected={!!sheetsConfig?.spreadsheetId}
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
          ) : activeTab === 'maintenance' ? (
            <VehicleMaintenanceView
              records={maintenanceRecords}
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
              currentUser={currentUser}
              onOpenNewOrder={() => { setEditingOrder(null); setActiveTab('new_order'); }}
              onNavigateToLogistics={() => setActiveTab('logistics')}
              onNavigateToMaintenance={() => setActiveTab('maintenance')}
            />
          )}
        </main>
      </div>

      {/* Modals */}
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
                {savedCustomerSuccessPopup.customer.photoUrls?.[0] ? (
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
    </div>
  );
}
