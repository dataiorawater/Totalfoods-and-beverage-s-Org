import React, { useState } from 'react';
import { TotalEmblem } from './TotalLogo';
import {
  Package,
  PlusCircle,
  Download,
  Settings,
  ChevronDown,
  Shield,
  Briefcase,
  Truck,
  Eye,
  BarChart3,
  ListOrdered,
  Users,
  UserPlus,
  LogOut,
  RefreshCw,
  ExternalLink,
  MapPin,
  Navigation,
  Wallet,
  Menu,
  X,
  ShieldCheck,
  CircleDollarSign,
  Wrench,
} from 'lucide-react';
import { StaffUser, StaffRole, SheetsConfig, LineSettings } from '../types';

interface NavbarProps {
  activeTab: 'orders' | 'dashboard' | 'customers' | 'checkin' | 'expenses' | 'users' | 'routes' | 'export' | 'new_order' | 'logistics' | 'deposits' | 'hired_vehicles' | 'maintenance';
  setActiveTab: (tab: 'orders' | 'dashboard' | 'customers' | 'checkin' | 'expenses' | 'users' | 'routes' | 'export' | 'new_order' | 'logistics' | 'deposits' | 'hired_vehicles' | 'maintenance') => void;
  currentUser: StaffUser;
  onOpenNewOrder: () => void;
  onOpenNewCustomer?: () => void;
  onOpenRoleSwitcher: () => void;
  onOpenSettings: () => void;
  onOpenUserManagement?: () => void;
  onOpenRouteManagement?: () => void;
  onLogout?: () => void;
  sheetsConfig?: SheetsConfig;
  lineSettings?: LineSettings;
  orderCount?: number;
  customerCount?: number;
  todaySalesAmount?: number;
  deliveryCount?: number;
  depositCount?: number;
  hiredVehicleCount?: number;
  maintenanceCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  onOpenNewOrder,
  onOpenNewCustomer,
  onOpenRoleSwitcher,
  onOpenSettings,
  onOpenUserManagement,
  onOpenRouteManagement,
  onLogout,
  sheetsConfig = {
    spreadsheetId: '',
    spreadsheetName: '',
    sheetName: 'รายการออเดอร์ (Orders)',
    spreadsheetUrl: '',
    autoSync: true,
  },
  lineSettings = {
    enabled: false,
    token: '',
    webhookUrl: '',
    notifyOnNewOrder: true,
    notifyOnStatusChange: true,
  },
  orderCount = 0,
  customerCount = 0,
  todaySalesAmount = 0,
  deliveryCount = 0,
  depositCount = 0,
  hiredVehicleCount = 0,
  maintenanceCount = 0,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const getRoleIcon = (role: StaffRole) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-3.5 h-3.5 text-purple-600" />;
      case 'manager':
        return <Briefcase className="w-3.5 h-3.5 text-indigo-600" />;
      case 'sales':
        return <Briefcase className="w-3.5 h-3.5 text-blue-600" />;
      case 'delivery':
        return <Truck className="w-3.5 h-3.5 text-amber-600" />;
      case 'viewer':
        return <Eye className="w-3.5 h-3.5 text-slate-600" />;
      default:
        return null;
    }
  };

  const getRoleName = (role: StaffRole) => {
    switch (role) {
      case 'admin':
        return 'Admin สูงสุด';
      case 'manager':
        return 'ผู้จัดการฝ่าย';
      case 'sales':
        return 'พนักงานขาย';
      case 'delivery':
        return 'ทีมจัดส่ง';
      case 'viewer':
        return 'ผู้ตรวจสอบ';
      default:
        return role;
    }
  };

  const isViewer = currentUser.role === 'viewer';
  const isAdmin = currentUser.role === 'admin';

  return (
    <>
      {/* =========================================================================
          1. DESKTOP LEFT SIDEBAR (Visible on lg: and wider)
         ========================================================================= */}
      <aside className="hidden lg:flex w-64 xl:w-72 h-screen sticky top-0 bg-white border-r border-slate-200/90 flex-col shrink-0 z-30 select-none shadow-xs">
        {/* Brand & Connection Status */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center shadow-sm border border-slate-200/70 shrink-0 p-0.5">
              <TotalEmblem className="w-9 h-9 shrink-0 drop-shadow-xs" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-base tracking-tight text-slate-900 leading-none truncate">
                  TOTAL
                </h1>
                <span className="inline-flex items-center px-1.5 py-0.2 rounded-md text-[9px] font-extrabold bg-blue-100 text-blue-900 uppercase">
                  Solution
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 truncate font-medium">
                Foods &amp; Beverage
              </p>
            </div>
          </div>

          {/* Connection Status Pill */}
          <div className="mt-3.5 p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">สถานะระบบ:</span>
            {sheetsConfig?.spreadsheetId ? (
              <span className="text-blue-700 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                <span>เชื่อมต่อ Sheets แล้ว</span>
              </span>
            ) : (
              <span className="text-amber-700 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>โหมดออฟไลน์</span>
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons Section */}
        <div className="p-4 border-b border-slate-100">
          {!isViewer && (
            <button
              id="sidebar-btn-new-order"
              onClick={onOpenNewOrder}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>ลงออเดอร์ใหม่</span>
            </button>
          )}
        </div>

        {/* Scrollable Navigation Menu Groups */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-5">
          {/* Group 1: Sales Menu */}
          <div>
            <div className="px-3 mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                เมนูพนักงานขาย
              </span>
              <span className="text-[10px] font-semibold text-slate-400">
                Sales
              </span>
            </div>
            <nav className="space-y-1">
              {/* 1. Customers */}
              <button
                id="sidebar-tab-customers"
                onClick={() => setActiveTab('customers')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                  activeTab === 'customers'
                    ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200/80 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      activeTab === 'customers'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200/70 group-hover:text-slate-800'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col text-left min-w-0">
                    <span className="leading-tight truncate">ข้อมูลลูกค้า</span>
                    <span className="text-[10px] text-slate-400 font-normal truncate">
                      รายชื่อลูกค้า & พิกัดร้าน
                    </span>
                  </div>
                </div>
                {customerCount > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                      activeTab === 'customers'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                    }`}
                  >
                    {customerCount}
                  </span>
                )}
              </button>

              {/* 2. Store Check-in */}
              <button
                id="sidebar-tab-checkin"
                onClick={() => setActiveTab('checkin')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                  activeTab === 'checkin'
                    ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200/80 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      activeTab === 'checkin'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200/70 group-hover:text-slate-800'
                    }`}
                  >
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col text-left min-w-0">
                    <span className="leading-tight truncate">เช็คอินร้านค้า</span>
                    <span className="text-[10px] text-slate-400 font-normal truncate">
                      บันทึกการเข้าพบหน้าร้าน
                    </span>
                  </div>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                    activeTab === 'checkin'
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-50 text-blue-700'
                  }`}
                >
                  GPS
                </span>
              </button>

              {/* 3. Orders */}
              <button
                id="sidebar-tab-orders"
                onClick={() => setActiveTab('orders')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                  activeTab === 'orders'
                    ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200/80 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      activeTab === 'orders'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200/70 group-hover:text-slate-800'
                    }`}
                  >
                    <ListOrdered className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col text-left min-w-0">
                    <span className="leading-tight truncate">รายการออเดอร์</span>
                    <span className="text-[10px] text-slate-400 font-normal truncate">
                      คำสั่งซื้อ & ออกบิล
                    </span>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                    activeTab === 'orders'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                  }`}
                >
                  {orderCount}
                </span>
              </button>

              {/* 4. Expenses */}
              <button
                id="sidebar-tab-expenses"
                onClick={() => setActiveTab('expenses')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                  activeTab === 'expenses'
                    ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200/80 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      activeTab === 'expenses'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200/70 group-hover:text-slate-800'
                    }`}
                  >
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col text-left min-w-0">
                    <span className="leading-tight truncate">บันทึกค่าใช้จ่าย</span>
                    <span className="text-[10px] text-slate-400 font-normal truncate">
                      ค่าน้ำมัน & เบิกจ่าย
                    </span>
                  </div>
                </div>
              </button>

              {/* 5. Dashboard */}
              <button
                id="sidebar-tab-dashboard"
                onClick={() => setActiveTab('dashboard')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                  activeTab === 'dashboard'
                    ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200/80 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      activeTab === 'dashboard'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200/70 group-hover:text-slate-800'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col text-left min-w-0">
                    <span className="leading-tight truncate">ยอดขายวันนี้</span>
                    <span className="text-[10px] text-slate-400 font-normal truncate">
                      สรุปภาพรวมแดชบอร์ด
                    </span>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                    activeTab === 'dashboard'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  ฿{(todaySalesAmount ?? 0).toLocaleString()}
                </span>
              </button>
            </nav>
          </div>

          {/* Group 2: Logistics Menu (แยกออกจากเมนูพนักงานขายอย่างชัดเจน) */}
          <div>
            <div className="px-3 mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                เมนูโลจิสติกส์
              </span>
              <span className="text-[10px] font-semibold text-slate-400">
                Logistics
              </span>
            </div>
            <nav className="space-y-1">
              <button
                id="sidebar-tab-logistics"
                onClick={() => setActiveTab('logistics')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                  activeTab === 'logistics'
                    ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200/80 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      activeTab === 'logistics'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200/70 group-hover:text-slate-800'
                    }`}
                  >
                    <Truck className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col text-left min-w-0">
                    <span className="leading-tight truncate">จัดการแผนงานจัดส่ง</span>
                    <span className="text-[10px] text-slate-400 font-normal truncate">
                      จัดลำดับจุดส่ง & แผนเที่ยวรถ
                    </span>
                  </div>
                </div>
                {deliveryCount > 0 ? (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                      activeTab === 'logistics'
                        ? 'bg-blue-600 text-white'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {deliveryCount}
                  </span>
                ) : (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                      activeTab === 'logistics'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    แผนส่ง
                  </span>
                )}
              </button>

              {/* 2. Security Deposits Management (จัดการเงินประกัน) */}
              <button
                id="sidebar-tab-deposits"
                onClick={() => setActiveTab('deposits')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                  activeTab === 'deposits'
                    ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200/80 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      activeTab === 'deposits'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200/70 group-hover:text-slate-800'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col text-left min-w-0">
                    <span className="leading-tight truncate">จัดการเงินประกัน</span>
                    <span className="text-[10px] text-slate-400 font-normal truncate">
                      เงินมัดจำถัง & ค้ำประกัน
                    </span>
                  </div>
                </div>
                {depositCount > 0 ? (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                      activeTab === 'deposits'
                        ? 'bg-blue-600 text-white'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {depositCount}
                  </span>
                ) : (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                      activeTab === 'deposits'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    มัดจำ
                  </span>
                )}
              </button>

              {/* 3. Hired Vehicle Expenses & Payouts (ค่าใช้จ่ายรถจ้าง) */}
              <button
                id="sidebar-tab-hired-vehicles"
                onClick={() => setActiveTab('hired_vehicles')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                  activeTab === 'hired_vehicles'
                    ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200/80 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      activeTab === 'hired_vehicles'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200/70 group-hover:text-slate-800'
                    }`}
                  >
                    <CircleDollarSign className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col text-left min-w-0">
                    <span className="leading-tight truncate">ค่าใช้จ่ายรถจ้าง</span>
                    <span className="text-[10px] text-slate-400 font-normal truncate">
                      สรุปค่าเที่ยว & ทำจ่ายรถร่วม
                    </span>
                  </div>
                </div>
                {hiredVehicleCount > 0 ? (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                      activeTab === 'hired_vehicles'
                        ? 'bg-blue-600 text-white'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {hiredVehicleCount}
                  </span>
                ) : (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                      activeTab === 'hired_vehicles'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    รถจ้าง
                  </span>
                )}
              </button>

              {/* 4. Vehicle Maintenance Log (บันทึกบำรุงรักษารถ) */}
              <button
                id="sidebar-tab-maintenance"
                onClick={() => setActiveTab('maintenance')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                  activeTab === 'maintenance'
                    ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200/80 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      activeTab === 'maintenance'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200/70 group-hover:text-slate-800'
                    }`}
                  >
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col text-left min-w-0">
                    <span className="leading-tight truncate">บันทึกบำรุงรักษารถ</span>
                    <span className="text-[10px] text-slate-400 font-normal truncate">
                      ประวัติซ่อม & เตือนเช็คระยะ
                    </span>
                  </div>
                </div>
                {maintenanceCount > 0 ? (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                      activeTab === 'maintenance'
                        ? 'bg-blue-600 text-white'
                        : 'bg-indigo-100 text-indigo-800'
                    }`}
                  >
                    {maintenanceCount}
                  </span>
                ) : (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                      activeTab === 'maintenance'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    ซ่อมบำรุง
                  </span>
                )}
              </button>
            </nav>
          </div>

          {/* Group 3: Tools & Administration */}
          <div>
            <div className="px-3 mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                เครื่องมือ & การจัดการ
              </span>
              <span className="text-[10px] font-semibold text-slate-400">
                Tools
              </span>
            </div>
            <nav className="space-y-1">
              {/* Admin User Management */}
              {(isAdmin || currentUser.role === 'manager') && (
                <button
                  id="sidebar-btn-users"
                  onClick={() => setActiveTab('users')}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                    activeTab === 'users'
                      ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200/80 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        activeTab === 'users'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200/70 group-hover:text-slate-800'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col text-left min-w-0">
                      <span className="leading-tight truncate">จัดการสิทธิ์ผู้ใช้งาน</span>
                      <span className="text-[10px] text-slate-400 font-normal truncate">
                        กำหนดบทบาทและทีม
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      activeTab === 'users'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Admin
                  </span>
                </button>
              )}

              {/* Admin Route Management */}
              {(isAdmin || currentUser.role === 'manager') && (
                <button
                  id="sidebar-btn-routes"
                  onClick={() => setActiveTab('routes')}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                    activeTab === 'routes'
                      ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200/80 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        activeTab === 'routes'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200/70 group-hover:text-slate-800'
                      }`}
                    >
                      <Navigation className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col text-left min-w-0">
                      <span className="leading-tight truncate">จัดการสายการเข้าเยี่ยม</span>
                      <span className="text-[10px] text-slate-400 font-normal truncate">
                        สายส่ง & โซนพื้นที่
                      </span>
                    </div>
                  </div>
                </button>
              )}

              {/* Export Button */}
              <button
                id="sidebar-btn-export"
                onClick={() => setActiveTab('export')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                  activeTab === 'export'
                    ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200/80 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      activeTab === 'export'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200/70 group-hover:text-slate-800'
                    }`}
                  >
                    <Download className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col text-left min-w-0">
                    <span className="leading-tight truncate">ส่งออกรายงาน (Excel)</span>
                    <span className="text-[10px] text-slate-400 font-normal truncate">
                      ดาวน์โหลดไฟล์ข้อมูล
                    </span>
                  </div>
                </div>
              </button>

              {/* System Settings (Sheets & LINE) */}
              {(isAdmin || currentUser.role === 'manager') && (
                <button
                  id="sidebar-btn-settings"
                  onClick={onOpenSettings}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-slate-200/70 group-hover:text-slate-800 flex items-center justify-center shrink-0 transition-colors">
                      <Settings className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col text-left min-w-0">
                      <span className="leading-tight truncate">ตั้งค่าระบบ & เชื่อมต่อ</span>
                      <span className="text-[10px] text-slate-400 font-normal truncate">
                        Google Sheets & LINE
                      </span>
                    </div>
                  </div>
                  {lineSettings?.enabled && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" title="LINE แจ้งเตือนเปิดใช้งาน"></span>
                  )}
                </button>
              )}
            </nav>
          </div>

          <div className="mt-auto pt-6 border-t border-slate-200/60">
            {/* User Info Bar at bottom of sidebar */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  เข้าสู่ระบบ
                </span>
                <button
                  id="btn-logout-sidebar"
                  onClick={onLogout}
                  title="ออกจากระบบ"
                  className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
              <button
                id="sidebar-user-switcher"
                onClick={onOpenRoleSwitcher}
                className="flex items-center gap-2.5 text-left group cursor-pointer hover:bg-slate-200/50 p-1.5 -mx-1.5 rounded-lg transition-colors"
                title={`เข้าสู่ระบบโดย: ${currentUser.name} - คลิกเพื่อสลับสิทธิ์`}
              >
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="min-w-0 flex flex-col justify-center">
                  <div className="flex items-center gap-1">
                    <span className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                      {currentUser.name}
                    </span>
                    <ChevronDown className="w-3 h-3 text-blue-700 group-hover:text-blue-900 shrink-0" />
                  </div>
                  <span className="text-[10px] text-blue-700 font-medium leading-none">
                    {getRoleName(currentUser.role)}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* =========================================================================
          3. MOBILE BOTTOM NAVIGATION BAR (Visible only on screens below lg:)
         ========================================================================= */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white gpu-layer border-t border-slate-200 px-2 py-1.5 shadow-lg">
        <div className="flex items-center justify-around">
          <button
            id="mobile-tab-orders"
            onClick={() => setActiveTab('orders')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
              activeTab === 'orders' ? 'text-blue-700 font-bold' : 'text-slate-500'
            }`}
          >
            <ListOrdered className="w-4.5 h-4.5" />
            <span>ออเดอร์</span>
          </button>

          <button
            id="mobile-tab-customers"
            onClick={() => setActiveTab('customers')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
              activeTab === 'customers' ? 'text-blue-700 font-bold' : 'text-slate-500'
            }`}
          >
            <Users className="w-4.5 h-4.5" />
            <span>ข้อมูลลูกค้า</span>
          </button>

          {/* Big Center Floating-like Add Button */}
          {!isViewer ? (
            <button
              id="mobile-btn-add-order"
              onClick={onOpenNewOrder}
              className="flex flex-col items-center -mt-5"
            >
              <div className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/40 border-2 border-white active:scale-95 transition-transform">
                <PlusCircle className="w-5 h-5" />
              </div>
              <span className="text-[9px] font-semibold text-blue-800 mt-0.5">ลงออเดอร์</span>
            </button>
          ) : (
            <div className="w-11 h-11"></div>
          )}

          <button
            id="mobile-tab-checkin"
            onClick={() => setActiveTab('checkin')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
              activeTab === 'checkin' ? 'text-blue-700 font-bold' : 'text-slate-500'
            }`}
          >
            <MapPin className="w-4.5 h-4.5" />
            <span>เช็คอินร้าน</span>
          </button>

          <button
            id="mobile-tab-more"
            onClick={() => setIsMobileMenuOpen(true)}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
              isMobileMenuOpen || !['orders', 'customers', 'checkin'].includes(activeTab) ? 'text-blue-700 font-bold' : 'text-slate-500'
            }`}
          >
            <Menu className="w-4.5 h-4.5" />
            <span>เพิ่มเติม</span>
          </button>
        </div>
      </div>

      {/* MOBILE MORE MENU OVERLAY */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-full duration-300">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-3xl z-10">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Menu className="w-5 h-5 text-blue-600" />
                เมนูเพิ่มเติม
              </h2>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Scrollable Content */}
            <div className="p-4 overflow-y-auto space-y-5 pb-8">
              {/* Menu Group: Sales */}
              <div>
                <div className="px-3 mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    เมนูพนักงานขาย
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    Sales
                  </span>
                </div>
                <div className="space-y-1">
                  <button
                    onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                      activeTab === 'dashboard'
                        ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200/80 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          activeTab === 'dashboard'
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200/70 group-hover:text-slate-800'
                        }`}
                      >
                        <BarChart3 className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col text-left min-w-0">
                        <span className="leading-tight truncate">ยอดขายวันนี้</span>
                        <span className="text-[10px] text-slate-400 font-normal truncate">
                          สรุปภาพรวมแดชบอร์ด
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                        activeTab === 'dashboard'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      ฿{(todaySalesAmount ?? 0).toLocaleString()}
                    </span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('expenses'); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                      activeTab === 'expenses'
                        ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200/80 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          activeTab === 'expenses'
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200/70 group-hover:text-slate-800'
                        }`}
                      >
                        <Wallet className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col text-left min-w-0">
                        <span className="leading-tight truncate">บันทึกค่าใช้จ่าย</span>
                        <span className="text-[10px] text-slate-400 font-normal truncate">
                          ค่าน้ำมัน & เบิกจ่าย
                        </span>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Menu Group: Logistics (แยกออกจากเมนูพนักงานขาย) */}
              <div>
                <div className="px-3 mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    เมนูโลจิสติกส์
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    Logistics
                  </span>
                </div>
                <div className="space-y-1">
                  <button
                    onClick={() => { setActiveTab('logistics'); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                      activeTab === 'logistics'
                        ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200/80 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          activeTab === 'logistics'
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200/70 group-hover:text-slate-800'
                        }`}
                      >
                        <Truck className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col text-left min-w-0">
                        <span className="leading-tight truncate">จัดการแผนงานจัดส่ง</span>
                        <span className="text-[10px] text-slate-400 font-normal truncate">
                          จัดลำดับจุดส่ง & แผนเที่ยวรถ
                        </span>
                      </div>
                    </div>
                    {deliveryCount > 0 ? (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                          activeTab === 'logistics'
                            ? 'bg-blue-600 text-white'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {deliveryCount}
                      </span>
                    ) : (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                          activeTab === 'logistics'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        แผนส่ง
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => { setActiveTab('deposits'); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                      activeTab === 'deposits'
                        ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200/80 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          activeTab === 'deposits'
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200/70 group-hover:text-slate-800'
                        }`}
                      >
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col text-left min-w-0">
                        <span className="leading-tight truncate">จัดการเงินประกัน</span>
                        <span className="text-[10px] text-slate-400 font-normal truncate">
                          เงินมัดจำถัง & ค้ำประกัน
                        </span>
                      </div>
                    </div>
                    {depositCount > 0 ? (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                          activeTab === 'deposits'
                            ? 'bg-blue-600 text-white'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {depositCount}
                      </span>
                    ) : (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                          activeTab === 'deposits'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        มัดจำ
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => { setActiveTab('hired_vehicles'); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                      activeTab === 'hired_vehicles'
                        ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200/80 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          activeTab === 'hired_vehicles'
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200/70 group-hover:text-slate-800'
                        }`}
                      >
                        <CircleDollarSign className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col text-left min-w-0">
                        <span className="leading-tight truncate">ค่าใช้จ่ายรถจ้าง</span>
                        <span className="text-[10px] text-slate-400 font-normal truncate">
                          สรุปค่าเที่ยว & ทำจ่ายรถร่วม
                        </span>
                      </div>
                    </div>
                    {hiredVehicleCount > 0 ? (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                          activeTab === 'hired_vehicles'
                            ? 'bg-blue-600 text-white'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {hiredVehicleCount}
                      </span>
                    ) : (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                          activeTab === 'hired_vehicles'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        รถจ้าง
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => { setActiveTab('maintenance'); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                      activeTab === 'maintenance'
                        ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200/80 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          activeTab === 'maintenance'
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200/70 group-hover:text-slate-800'
                        }`}
                      >
                        <Wrench className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col text-left min-w-0">
                        <span className="leading-tight truncate">บันทึกบำรุงรักษารถ</span>
                        <span className="text-[10px] text-slate-400 font-normal truncate">
                          ประวัติซ่อม & เตือนเช็คระยะ
                        </span>
                      </div>
                    </div>
                    {maintenanceCount > 0 ? (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                          activeTab === 'maintenance'
                            ? 'bg-blue-600 text-white'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}
                      >
                        {maintenanceCount}
                      </span>
                    ) : (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                          activeTab === 'maintenance'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        ซ่อมบำรุง
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Menu Group: Admin */}
              <div>
                <div className="px-3 mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    เครื่องมือ & การจัดการ
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    Tools
                  </span>
                </div>
                <div className="space-y-1">
                  {(isAdmin || currentUser.role === 'manager') && (
                    <button
                      onClick={() => { setActiveTab('users'); setIsMobileMenuOpen(false); }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                        activeTab === 'users'
                          ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200/80 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                            activeTab === 'users'
                              ? 'bg-blue-600 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200/70 group-hover:text-slate-800'
                          }`}
                        >
                          <Users className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col text-left min-w-0">
                          <span className="leading-tight truncate">จัดการสิทธิ์ผู้ใช้งาน</span>
                          <span className="text-[10px] text-slate-400 font-normal truncate">
                            กำหนดบทบาทและทีม
                          </span>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          activeTab === 'users'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        Admin
                      </span>
                    </button>
                  )}
                  {(isAdmin || currentUser.role === 'manager') && (
                    <button
                      onClick={() => { setActiveTab('routes'); setIsMobileMenuOpen(false); }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                        activeTab === 'routes'
                          ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200/80 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                            activeTab === 'routes'
                              ? 'bg-blue-600 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200/70 group-hover:text-slate-800'
                          }`}
                        >
                          <Navigation className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col text-left min-w-0">
                          <span className="leading-tight truncate">จัดการสายการเข้าเยี่ยม</span>
                          <span className="text-[10px] text-slate-400 font-normal truncate">
                            สายส่ง & โซนพื้นที่
                          </span>
                        </div>
                      </div>
                    </button>
                  )}
                  <button
                    onClick={() => { setActiveTab('export'); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                      activeTab === 'export'
                        ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200/80 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          activeTab === 'export'
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200/70 group-hover:text-slate-800'
                        }`}
                      >
                        <Download className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col text-left min-w-0">
                        <span className="leading-tight truncate">ส่งออกรายงาน (Excel)</span>
                        <span className="text-[10px] text-slate-400 font-normal truncate">
                          ดาวน์โหลดไฟล์ข้อมูล
                        </span>
                      </div>
                    </div>
                  </button>
                  {(isAdmin || currentUser.role === 'manager') && (
                    <button
                      onClick={() => { onOpenSettings(); setIsMobileMenuOpen(false); }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-slate-200/70 group-hover:text-slate-800 flex items-center justify-center shrink-0 transition-colors">
                          <Settings className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col text-left min-w-0">
                          <span className="leading-tight truncate">ตั้งค่าระบบ & เชื่อมต่อ</span>
                          <span className="text-[10px] text-slate-400 font-normal truncate">
                            Google Sheets & LINE
                          </span>
                        </div>
                      </div>
                      {lineSettings?.enabled && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Menu Group: Account */}
              <div className="pt-2 border-t border-slate-100">
                <div className="bg-slate-50 rounded-2xl p-4 flex flex-col gap-3 border border-slate-200/60">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 shadow-sm">
                      {currentUser.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">{currentUser.name}</div>
                      <div className="text-[11px] font-medium text-blue-700">{getRoleName(currentUser.role)}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { onOpenRoleSwitcher(); setIsMobileMenuOpen(false); }}
                      className="flex-1 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm text-center"
                    >
                      สลับสิทธิ์ผู้ใช้งาน
                    </button>
                    <button
                      onClick={() => { onLogout && onLogout(); setIsMobileMenuOpen(false); }}
                      className="flex-1 py-2 bg-rose-50 border border-rose-100 rounded-xl text-xs font-bold text-rose-700 hover:bg-rose-100 shadow-sm text-center flex items-center justify-center gap-1"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      ออกจากระบบ
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

