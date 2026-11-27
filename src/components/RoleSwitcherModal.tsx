import React from 'react';
import { StaffUser, StaffRole } from '../types';
import {
  Shield,
  Briefcase,
  Truck,
  Eye,
  X,
  User as UserIcon,
  LogOut,
} from 'lucide-react';

interface RoleSwitcherModalProps {
  isOpen: boolean;
  currentUser: StaffUser;
  staffList: StaffUser[];
  onSelectUser: (user: StaffUser) => void;
  onClose: () => void;
  onLogout?: () => void;
}

export const RoleSwitcherModal: React.FC<RoleSwitcherModalProps> = ({
  isOpen,
  currentUser,
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#1D4ED8] border border-blue-200">
            <Briefcase className="w-3.5 h-3.5 text-[#1D4ED8]" />
            ผู้จัดการฝ่ายขาย (Manager)
          </span>
        );
      case 'sales':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#1D4ED8] border border-blue-200">
            <Briefcase className="w-3.5 h-3.5 text-[#1D4ED8]" />
            พนักงานขาย (Sales)
          </span>
        );
      case 'delivery':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Truck className="w-3.5 h-3.5 text-amber-600" />
            ทีมจัดส่ง (Logistics)
          </span>
        );
      case 'viewer':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F1F5F9] text-[#0F172A] border border-slate-200">
            <Eye className="w-3.5 h-3.5 text-slate-600" />
            ผู้ตรวจสอบ / บัญชี (Viewer)
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div
      id="role-switcher-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 gpu-layer animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="role-switcher-card"
        className="w-full max-w-md bg-[#FFFFFF] rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-5 border-b border-slate-200/80 flex items-center justify-between bg-[#F1F5F9]">
          <h3 className="text-base sm:text-lg font-bold text-[#0F172A] flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-[#1D4ED8]" />
            <span>บัญชีผู้ใช้งาน / ระดับสิทธิ์</span>
          </h3>
          <button
            id="close-role-switcher-btn"
            onClick={onClose}
            className="text-slate-500 hover:text-[#0F172A] p-1.5 rounded-lg hover:bg-[#FFFFFF] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Logged-in User Info */}
        <div className="p-5 bg-[#FFFFFF]">
          <div className="p-4 rounded-2xl bg-[#F1F5F9] border border-slate-200/90 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-[#1D4ED8] text-white font-bold text-lg flex items-center justify-center shrink-0 shadow-xs">
              {currentUser.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div>
                <div className="text-[11px] font-medium text-slate-500">ชื่อผู้ใช้งาน</div>
                <div className="text-base font-bold text-[#0F172A] truncate leading-snug">
                  {currentUser.name}
                </div>
                {currentUser.email && (
                  <div className="text-xs text-slate-500 truncate">{currentUser.email}</div>
                )}
              </div>
              <div className="pt-0.5">
                {getRoleBadge(currentUser.role)}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer with Logout Option */}
        <div className="p-3 sm:p-4 bg-[#F1F5F9] border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
          {onLogout ? (
            <button
              id="btn-logout-from-switcher"
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-rose-600 hover:text-rose-700 bg-[#FFFFFF] hover:bg-rose-50 border border-rose-200 rounded-xl font-semibold transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>ออกจากระบบ</span>
            </button>
          ) : (
            <div />
          )}

          <button
            id="close-role-btn-footer"
            onClick={onClose}
            className="px-4 py-2 bg-[#FFFFFF] border border-slate-200 rounded-xl text-[#0F172A] font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
