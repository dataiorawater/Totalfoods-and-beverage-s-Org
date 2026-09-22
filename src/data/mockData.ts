import { Product, StaffUser, Order, SheetsConfig, LineSettings, Customer } from '../types';

export const INITIAL_PRODUCTS: Product[] = [];

export const DEFAULT_SHEETS_CONFIG: SheetsConfig = {
  spreadsheetId: '1a4fKQhjvqwg486PXTO7VRPU65IPaUW_gEARl9Ky7USA',
  spreadsheetName: '',
  sheetName: 'รายการออเดอร์ (Orders)',
  spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1a4fKQhjvqwg486PXTO7VRPU65IPaUW_gEARl9Ky7USA/edit',
  gasUrl: 'https://script.google.com/macros/s/AKfycbzfqWujgz3EhJJ4fJ6DEf6J6RibJvyp_b8QA2OwVAhN1WG4gVEr2OnrOXtqvJnJqMU9/exec',
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

export const INITIAL_ORDERS: Order[] = [];

export const INITIAL_CUSTOMERS: Customer[] = [];


