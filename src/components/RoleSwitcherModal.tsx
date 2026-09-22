import React from 'react';
import { StaffUser, StaffRole } from '../types';
import {
  Shield,
  Briefcase,
  Truck,
  Eye,
  Check,
  X,
  User as UserIcon,
  LogOut,
  UserPlus,
  Users,
} from 'lucide-react';

interface RoleSwitcherModalProps {
  isOpen: boolean;
  currentUser: StaffUser;
  staffList: StaffUser[];
  onSelectUser: (user: StaffUser) => void;
  onClose: () => void;
  onLogout?: () => void;
  
}

// Helper to format lastLogin date
const formatLastLogin = (dateStr?: string) => {
  if (!dateStr) return 'ยังไม่เคยเข้าสู่ระบบ';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('th-TH', { 
    day: '2-digit', month: 'short', year: 'numeric', 
    hour: '2-digit', minute: '2-digit' 
  }) + ' น.';
};

export const RoleSwitcherModal: React.FC<RoleSwitcherModalProps> = ({
  isOpen,
  currentUser,
  staffList,
  onSelectUser,
  onClose,
  onLogout,
  }) => {
  if (!isOpen) return null;

  const getRoleBadge = (role: StaffRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            <Shield className="w-3.5 h-3.5 text-purple-600" />
            ผู้ดูแลระบบสูงสุด (Admin)
          </span>
        );
      case 'manager':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
            <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
            ผู้จัดการฝ่ายขาย (Manager)
          </span>
        );
      case 'sales':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <Briefcase className="w-3.5 h-3.5 text-blue-600" />
            พนักงานขาย (Sales)
          </span>
        );
      case 'delivery':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Truck className="w-3.5 h-3.5 text-amber-600" />
            ทีมจัดส่ง / พนักงานขาย
          </span>
        );
      case 'viewer':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <Eye className="w-3.5 h-3.5 text-slate-600" />
            ผู้ตรวจสอบ / บัญชี (Viewer)
          </span>
        );
      default:
        return null;
    }
  };

  const getRoleDescription = (role: StaffRole) => {
    switch (role) {
      case 'admin':
        return 'สิทธิ์สูงสุด: จัดการผู้ใช้, จัดการสินค้า, ตั้งค่า Sheets & LINE, ดูออเดอร์ของทุกคน และดูสรุปยอดขายทั้งหมด';
      case 'manager':
        return 'ดูออเดอร์ของเซลล์ทุกคน, ติดตามสถานะ, อัปเดตสถานะ, ดูแดชบอร์ดสรุปยอดขายภาพรวม, ส่งออก Excel';
      case 'sales':
        return 'ลงออเดอร์ใหม่รวดเร็ว, ดึงชื่อเซลล์อัตโนมัติ, ติดตามเฉพาะออเดอร์และยอดขายของตนเอง';
      case 'delivery':
        return 'ดูรายการรอจัดส่ง/กำลังจัดส่ง, กดโทรหาลูกค้า, กดเปิด GPS นำทาง Google Maps, อัปเดตสถานะส่งสำเร็จ';
      case 'viewer':
        return 'ดูรายการออเดอร์และรายงานสรุปยอดขายทั้งหมด (อ่านอย่างเดียว ไม่สามารถแก้ไขหรือลงออเดอร์ได้)';
      default:
        return '';
    }
  };

  return (
    <div
      id="role-switcher-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 gpu-layer animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="role-switcher-card"
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-blue-600" />
              <span>บัญชีผู้ใช้งาน / ระดับสิทธิ์</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              เลือกพนักงานตามอีเมล หรือจัดการสิทธิ์ผู้ใช้งานบน Google Sheets
            </p>
          </div>
          <button
            id="close-role-switcher-btn"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>



        {/* Modal Footer with Logout Option */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          {onLogout ? (
            <button
              id="btn-logout-from-switcher"
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl font-semibold transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>ออกจากระบบ (สลับ Email/Google)</span>
            </button>
          ) : (
            <span>* ชื่อเซลล์จะถูกดึงอัตโนมัติตามอีเมลผู้ใช้</span>
          )}

          <button
            id="close-role-btn-footer"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-100 transition-colors cursor-pointer"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
