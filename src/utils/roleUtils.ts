import { StaffRole } from '../types';

export const ROLE_SHORT_LABELS: Record<StaffRole, string> = {
  admin: 'Admin สูงสุด',
  manager: 'ผู้จัดการฝ่าย',
  sales: 'พนักงานขาย',
  delivery: 'ทีมจัดส่ง',
  viewer: 'ผู้ตรวจสอบ',
};

export const ROLE_FULL_LABELS: Record<StaffRole, string> = {
  admin: 'ผู้ดูแลระบบสูงสุด (Admin)',
  manager: 'ผู้จัดการฝ่ายขาย (Manager)',
  sales: 'พนักงานขาย (Sales)',
  delivery: 'ทีมจัดส่ง (Logistics)',
  viewer: 'ผู้ตรวจสอบ / บัญชี (Viewer)',
};

export function getRoleShortLabel(role: StaffRole): string {
  return ROLE_SHORT_LABELS[role] || role;
}

export function getRoleFullLabel(role: StaffRole): string {
  return ROLE_FULL_LABELS[role] || role;
}
