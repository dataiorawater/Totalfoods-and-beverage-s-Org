import {
  Product,
  StaffUser,
  Order,
  SheetsConfig,
  LineSettings,
  Customer,
  HiredVehicleTripRecord,
  VehicleMaintenanceRecord,
  Route,
  FleetVehicle,
} from '../types';

export const DEFAULT_SHEETS_CONFIG: SheetsConfig = {
  spreadsheetId: '1a4fKQhjvqwg486PXTO7VRPU65IPaUW_gEARl9Ky7USA',
  spreadsheetName: '',
  sheetName: 'รายการออเดอร์ (Orders)',
  spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1a4fKQhjvqwg486PXTO7VRPU65IPaUW_gEARl9Ky7USA/edit',
  gasUrl: 'https://script.google.com/macros/s/AKfycbzlUqmp9Qf4MT4t_m74j26IEU_wOMv3t41mVIJp3ZL8-4e4KqZgjOPE1rucgi6Feg/exec',
  storePhotoFolderId: '1OMgGdY7DM78UviFNLJ-Wi_t_ayjsH5V4',
  checkInPhotoFolderId: '1pxTvmm0S2VJru-yP7yomVNUom7g9MX2m',
  autoSync: true,
};

export const DEFAULT_LINE_SETTINGS: LineSettings = {
  enabled: false,
  token: '',
  webhookUrl: '',
  notifyOnNewOrder: true,
  notifyOnStatusChange: true,
};

export const INITIAL_STAFF_USERS: StaffUser[] = [
  {
    id: 'staff-owner',
    name: 'ผู้ดูแลระบบ (Admin)',
    email: 'data.iorawater@gmail.com',
    role: 'admin',
    phone: '',
    status: 'active',
  },
];

// All domain collections start empty and load strictly from the live Google Sheets database
export const INITIAL_PRODUCTS: Product[] = [];
export const INITIAL_ORDERS: Order[] = [];
export const INITIAL_ROUTES: Route[] = [];
export const INITIAL_CUSTOMERS: Customer[] = [];
export const INITIAL_HIRED_VEHICLES: HiredVehicleTripRecord[] = [];
export const INITIAL_MAINTENANCE_RECORDS: VehicleMaintenanceRecord[] = [];
export const INITIAL_FLEET_VEHICLES: FleetVehicle[] = [];
