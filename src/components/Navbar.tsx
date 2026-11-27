import React, { useState, useMemo } from 'react';
import { TotalEmblem } from './TotalLogo';
import {
  PlusCircle,
  Download,
  Settings,
  Truck,
  BarChart3,
  ListOrdered,
  Users,
  RefreshCw,
  MapPin,
  Navigation,
  Wallet,
  Menu,
  X,
  ShieldCheck,
  CircleDollarSign,
  Wrench,
  Car,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { StaffUser, SheetsConfig, LineSettings } from '../types';

export type NavTabId =
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

interface NavbarProps {
  activeTab: NavTabId;
  setActiveTab: (tab: NavTabId) => void;
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
  fleetVehicleCount?: number;
  fleetAlertCount?: number;
  maintenanceCount?: number;
  isLoadingData?: boolean;
  onRefreshDatabase?: () => void;
}

interface NavItemConfig {
  key: string;
  sidebarId: string;
  tab?: NavTabId;
  onClick?: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  label: string;
  subtitle: React.ReactNode;
  badgeCount?: number;
  collapsedBadgeColor?: string;
  desktopBadge?: (isActive: boolean) => React.ReactNode;
  mobileBadge?: (isActive: boolean) => React.ReactNode;
  showDot?: boolean;
  showInMobileDrawer?: boolean;
}

interface NavGroupConfig {
  key: string;
  label: string;
  englishLabel: string;
  showDividerWhenCollapsed?: boolean;
  items: NavItemConfig[];
}

export const Navbar: React.FC<NavbarProps> = React.memo(({
  activeTab,
  setActiveTab,
  currentUser,
  onOpenNewOrder,
  onOpenSettings,
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
  fleetVehicleCount = 0,
  fleetAlertCount = 0,
  maintenanceCount = 0,
  isLoadingData = false,
  onRefreshDatabase,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('iora_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebarCollapsed = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('iora_sidebar_collapsed', String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const isViewer = currentUser.role === 'viewer';
  const isAdminOrManager = currentUser.role === 'admin' || currentUser.role === 'manager';
  const isSales = currentUser.role === 'sales';
  const isDelivery = currentUser.role === 'delivery';

  const navGroups = useMemo<NavGroupConfig[]>(() => {
    const salesItems: NavItemConfig[] = [
      {
        key: 'customers',
        sidebarId: 'sidebar-tab-customers',
        tab: 'customers',
        icon: Users,
        title: customerCount > 0 ? `ข้อมูลลูกค้า (${customerCount})` : 'ข้อมูลลูกค้า',
        label: 'ข้อมูลลูกค้า',
        subtitle: 'รายชื่อลูกค้า & พิกัดร้าน',
        badgeCount: customerCount,
        collapsedBadgeColor: 'bg-blue-600',
        showInMobileDrawer: false,
        desktopBadge: (isActive) =>
          customerCount > 0 ? (
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#FFFFFF] text-slate-600 border border-slate-200/80 group-hover:border-blue-200'
              }`}
            >
              {customerCount}
            </span>
          ) : null,
      },
      {
        key: 'checkin',
        sidebarId: 'sidebar-tab-checkin',
        tab: 'checkin',
        icon: MapPin,
        title: 'เช็คอินร้านค้า (GPS)',
        label: 'เช็คอินร้านค้า',
        subtitle: 'บันทึกการเข้าพบหน้าร้าน',
        showInMobileDrawer: false,
        desktopBadge: (isActive) => (
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
              isActive ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700'
            }`}
          >
            GPS
          </span>
        ),
      },
      {
        key: 'orders',
        sidebarId: 'sidebar-tab-orders',
        tab: 'orders',
        icon: ListOrdered,
        title: `รายการออเดอร์ (${orderCount})`,
        label: 'รายการออเดอร์',
        subtitle: 'คำสั่งซื้อ & ออกบิล',
        badgeCount: orderCount,
        collapsedBadgeColor: 'bg-blue-600',
        showInMobileDrawer: false,
        desktopBadge: (isActive) => (
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
              isActive
                ? 'bg-blue-600 text-white'
                : 'bg-[#FFFFFF] text-slate-600 border border-slate-200/80 group-hover:border-blue-200'
            }`}
          >
            {orderCount}
          </span>
        ),
      },
      {
        key: 'expenses',
        sidebarId: 'sidebar-tab-expenses',
        tab: 'expenses',
        icon: Wallet,
        title: 'บันทึกค่าใช้จ่าย',
        label: 'บันทึกค่าใช้จ่าย',
        subtitle: 'ค่าน้ำมัน & เบิกจ่าย',
        showInMobileDrawer: true,
      },
      {
        key: 'dashboard',
        sidebarId: 'sidebar-tab-dashboard',
        tab: 'dashboard',
        icon: BarChart3,
        title: `ยอดขายวันนี้ (฿${(todaySalesAmount ?? 0).toLocaleString()})`,
        label: 'ยอดขายวันนี้',
        subtitle: 'สรุปภาพรวมแดชบอร์ด',
        showInMobileDrawer: true,
        desktopBadge: (isActive) => (
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
              isActive
                ? 'bg-blue-600 text-white'
                : 'bg-[#FFFFFF] text-[#0F172A] border border-slate-200/80'
            }`}
          >
            ฿{(todaySalesAmount ?? 0).toLocaleString()}
          </span>
        ),
        mobileBadge: (isActive) => (
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
              isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            ฿{(todaySalesAmount ?? 0).toLocaleString()}
          </span>
        ),
      },
    ];

    const groups: NavGroupConfig[] = [];

    if (!isDelivery) {
      groups.push({
        key: 'sales',
        label: 'เมนูพนักงานขาย',
        englishLabel: 'Sales',
        showDividerWhenCollapsed: false,
        items: salesItems,
      });
    }

    if (!isSales) {
      groups.push({
        key: 'logistics',
        label: 'เมนูโลจิสติกส์',
        englishLabel: 'Logistics',
        showDividerWhenCollapsed: !isDelivery,
        items: [
          {
            key: 'logistics_dashboard',
            sidebarId: 'sidebar-tab-logistics-dashboard',
            tab: 'logistics_dashboard',
            icon: BarChart3,
            title: 'แดชบอร์ดสรุปงานจัดส่ง',
            label: 'แดชบอร์ดสรุปงานจัดส่ง',
            subtitle: 'ภาพรวมจัดส่ง & งบประมาณรถ',
            showInMobileDrawer: true,
            desktopBadge: (isActive) => (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#FFFFFF] text-slate-600 border border-slate-200/80'
                }`}
              >
                ภาพรวม
              </span>
            ),
            mobileBadge: (isActive) => (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                  isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                ภาพรวม
              </span>
            ),
          },
          {
            key: 'logistics',
            sidebarId: 'sidebar-tab-logistics',
            tab: 'logistics',
            icon: Truck,
            title: deliveryCount > 0 ? `จัดการแผนงานจัดส่ง (${deliveryCount})` : 'จัดการแผนงานจัดส่ง',
            label: 'จัดการแผนงานจัดส่ง',
            subtitle: 'จัดลำดับจุดส่ง & แผนเที่ยวรถ',
            badgeCount: deliveryCount,
            collapsedBadgeColor: 'bg-amber-500',
            showInMobileDrawer: true,
            desktopBadge: (isActive) =>
              deliveryCount > 0 ? (
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {deliveryCount}
                </span>
              ) : (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#FFFFFF] text-slate-600 border border-slate-200/80'
                  }`}
                >
                  แผนส่ง
                </span>
              ),
            mobileBadge: (isActive) =>
              deliveryCount > 0 ? (
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {deliveryCount}
                </span>
              ) : (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  แผนส่ง
                </span>
              ),
          },
          {
            key: 'deposits',
            sidebarId: 'sidebar-tab-deposits',
            tab: 'deposits',
            icon: ShieldCheck,
            title: depositCount > 0 ? `จัดการเงินประกัน (${depositCount})` : 'จัดการเงินประกัน',
            label: 'จัดการเงินประกัน',
            subtitle: 'เงินมัดจำถัง & ค้ำประกัน',
            badgeCount: depositCount,
            collapsedBadgeColor: 'bg-emerald-600',
            showInMobileDrawer: true,
            desktopBadge: (isActive) =>
              depositCount > 0 ? (
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {depositCount}
                </span>
              ) : (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#FFFFFF] text-slate-600 border border-slate-200/80'
                  }`}
                >
                  มัดจำ
                </span>
              ),
            mobileBadge: (isActive) =>
              depositCount > 0 ? (
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {depositCount}
                </span>
              ) : (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  มัดจำ
                </span>
              ),
          },
          {
            key: 'hired_vehicles',
            sidebarId: 'sidebar-tab-hired-vehicles',
            tab: 'hired_vehicles',
            icon: CircleDollarSign,
            title: hiredVehicleCount > 0 ? `ค่าใช้จ่ายรถจ้าง (${hiredVehicleCount})` : 'ค่าใช้จ่ายรถจ้าง',
            label: 'ค่าใช้จ่ายรถจ้าง',
            subtitle: 'สรุปค่าเที่ยว & ทำจ่ายรถร่วม',
            badgeCount: hiredVehicleCount,
            collapsedBadgeColor: 'bg-amber-500',
            showInMobileDrawer: true,
            desktopBadge: (isActive) =>
              hiredVehicleCount > 0 ? (
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {hiredVehicleCount}
                </span>
              ) : (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#FFFFFF] text-slate-600 border border-slate-200/80'
                  }`}
                >
                  รถจ้าง
                </span>
              ),
            mobileBadge: (isActive) =>
              hiredVehicleCount > 0 ? (
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {hiredVehicleCount}
                </span>
              ) : (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  รถจ้าง
                </span>
              ),
          },
          {
            key: 'fleet_vehicles',
            sidebarId: 'sidebar-tab-fleet-vehicles',
            tab: 'fleet_vehicles',
            icon: Car,
            title:
              fleetAlertCount > 0
                ? `จัดการรถ (แจ้งเตือนภาษี/ประกัน ${fleetAlertCount} รายการ)`
                : fleetVehicleCount > 0
                ? `จัดการรถ (${fleetVehicleCount} คัน)`
                : 'จัดการรถ',
            label: 'จัดการรถ',
            subtitle: 'ทะเบียน รุ่น ภาษี & ประกันภัย',
            badgeCount: fleetAlertCount > 0 ? fleetAlertCount : fleetVehicleCount,
            collapsedBadgeColor: fleetAlertCount > 0 ? 'bg-rose-600' : 'bg-blue-600',
            showInMobileDrawer: true,
            desktopBadge: (isActive) =>
              fleetAlertCount > 0 ? (
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  เตือน {fleetAlertCount}
                </span>
              ) : fleetVehicleCount > 0 ? (
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#FFFFFF] text-slate-600 border border-slate-200/80'
                  }`}
                >
                  {fleetVehicleCount}
                </span>
              ) : (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#FFFFFF] text-slate-600 border border-slate-200/80'
                  }`}
                >
                  กองรถ
                </span>
              ),
            mobileBadge: (isActive) =>
              fleetAlertCount > 0 ? (
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  เตือน {fleetAlertCount}
                </span>
              ) : fleetVehicleCount > 0 ? (
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {fleetVehicleCount}
                </span>
              ) : (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  กองรถ
                </span>
              ),
          },
          {
            key: 'maintenance',
            sidebarId: 'sidebar-tab-maintenance',
            tab: 'maintenance',
            icon: Wrench,
            title: maintenanceCount > 0 ? `บันทึกบำรุงรักษารถ (${maintenanceCount})` : 'บันทึกบำรุงรักษารถ',
            label: 'บันทึกบำรุงรักษารถ',
            subtitle: 'ประวัติซ่อม & เตือนเช็คระยะ',
            badgeCount: maintenanceCount,
            collapsedBadgeColor: 'bg-indigo-600',
            showInMobileDrawer: true,
            desktopBadge: (isActive) =>
              maintenanceCount > 0 ? (
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-indigo-100 text-indigo-800'
                  }`}
                >
                  {maintenanceCount}
                </span>
              ) : (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#FFFFFF] text-slate-600 border border-slate-200/80'
                  }`}
                >
                  ซ่อมบำรุง
                </span>
              ),
            mobileBadge: (isActive) =>
              maintenanceCount > 0 ? (
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-indigo-100 text-indigo-800'
                  }`}
                >
                  {maintenanceCount}
                </span>
              ) : (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  ซ่อมบำรุง
                </span>
              ),
          },
        ],
      });

      if (!isDelivery) {
        const toolItems: NavItemConfig[] = [];
        if (isAdminOrManager) {
        toolItems.push(
          {
            key: 'users',
            sidebarId: 'sidebar-btn-users',
            tab: 'users',
            icon: Users,
            title: 'จัดการสิทธิ์ผู้ใช้งาน',
            label: 'จัดการสิทธิ์ผู้ใช้งาน',
            subtitle: 'กำหนดบทบาทและทีม',
            showInMobileDrawer: true,
            desktopBadge: (isActive) => (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  isActive
                    ? 'bg-[#1D4ED8] text-white'
                    : 'bg-[#FFFFFF] text-slate-600 border border-slate-200/80'
                }`}
              >
                Admin
              </span>
            ),
            mobileBadge: (isActive) => (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Admin
              </span>
            ),
          },
          {
            key: 'routes',
            sidebarId: 'sidebar-btn-routes',
            tab: 'routes',
            icon: Navigation,
            title: 'จัดการสายการเข้าเยี่ยม',
            label: 'จัดการสายการเข้าเยี่ยม',
            subtitle: 'สายส่ง & โซนพื้นที่',
            showInMobileDrawer: true,
          }
        );
      }

      toolItems.push({
        key: 'export',
        sidebarId: 'sidebar-btn-export',
        tab: 'export',
        icon: Download,
        title: 'ส่งออกรายงาน (Excel)',
        label: 'ส่งออกรายงาน (Excel)',
        subtitle: 'ดาวน์โหลดไฟล์ข้อมูล',
        showInMobileDrawer: true,
      });

      if (isAdminOrManager) {
        toolItems.push({
          key: 'settings',
          sidebarId: 'sidebar-btn-settings',
          onClick: onOpenSettings,
          icon: Settings,
          title: 'ตั้งค่าระบบ & เชื่อมต่อ (Google Sheets & LINE)',
          label: 'ตั้งค่าระบบ & เชื่อมต่อ',
          subtitle: (
            <span className="inline-flex items-center gap-1">
              <BrandLogo brand="google-sheets" className="w-2.5 h-2.5 text-[#34A853] shrink-0" />
              <span>Google Sheets &amp;</span>
              <BrandLogo brand="line" className="w-2.5 h-2.5 text-[#00C300] shrink-0" />
              <span>LINE</span>
            </span>
          ),
          showDot: Boolean(lineSettings?.enabled),
          showInMobileDrawer: true,
        });
      }

        groups.push({
          key: 'tools',
          label: 'เครื่องมือ & การจัดการ',
          englishLabel: 'Tools',
          showDividerWhenCollapsed: true,
          items: toolItems,
        });
      }
    }

    return groups;
  }, [
    customerCount,
    orderCount,
    todaySalesAmount,
    deliveryCount,
    depositCount,
    hiredVehicleCount,
    fleetVehicleCount,
    fleetAlertCount,
    maintenanceCount,
    isSales,
    isDelivery,
    isAdminOrManager,
    lineSettings?.enabled,
    onOpenSettings,
  ]);

  const renderDesktopItem = (item: NavItemConfig) => {
    const Icon = item.icon;
    const isActive = item.tab ? activeTab === item.tab : false;
    const handleClick = item.onClick || (item.tab ? () => setActiveTab(item.tab!) : undefined);

    return (
      <button
        key={item.key}
        id={item.sidebarId}
        onClick={handleClick}
        title={item.title}
        className={`w-full flex items-center ${
          isSidebarCollapsed ? 'justify-center px-0 py-2' : 'justify-between px-3 py-2.5'
        } rounded-xl text-xs font-semibold transition-all cursor-pointer group relative ${
          isActive
            ? 'bg-[#FFFFFF] text-[#1D4ED8] font-bold border border-blue-200/90 shadow-xs'
            : 'text-[#0F172A]/80 hover:text-[#0F172A] hover:bg-[#FFFFFF]/80 border border-transparent'
        }`}
      >
        <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-2.5 min-w-0'}`}>
          <div
            className={`${
              isSidebarCollapsed ? 'w-9 h-9 rounded-xl' : 'w-7 h-7 rounded-lg'
            } flex items-center justify-center shrink-0 transition-colors relative ${
              isActive
                ? 'bg-[#1D4ED8] text-white shadow-2xs'
                : 'bg-[#FFFFFF] text-slate-600 border border-slate-200/80 group-hover:border-blue-200 group-hover:text-[#1D4ED8]'
            }`}
          >
            <Icon className="w-4 h-4" />
            {isSidebarCollapsed && item.badgeCount !== undefined && item.badgeCount > 0 && (
              <span
                className={`absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full ${
                  item.collapsedBadgeColor || 'bg-blue-600'
                } text-white text-[9px] font-bold flex items-center justify-center leading-none ring-2 ring-white`}
              >
                {item.badgeCount > 99 ? '99+' : item.badgeCount}
              </span>
            )}
            {isSidebarCollapsed && item.showDot && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-white"></span>
            )}
          </div>
          {!isSidebarCollapsed && (
            <div className="flex flex-col text-left min-w-0">
              <span className="leading-tight truncate">{item.label}</span>
              <span className="text-[10px] text-slate-400 font-normal truncate">
                {item.subtitle}
              </span>
            </div>
          )}
        </div>
        {!isSidebarCollapsed && item.desktopBadge && item.desktopBadge(isActive)}
        {!isSidebarCollapsed && item.showDot && (
          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" title="LINE แจ้งเตือนเปิดใช้งาน"></span>
        )}
      </button>
    );
  };

  const renderMobileDrawerItem = (item: NavItemConfig) => {
    const Icon = item.icon;
    const isActive = item.tab ? activeTab === item.tab : false;
    const handleClick = () => {
      if (item.onClick) {
        item.onClick();
      } else if (item.tab) {
        setActiveTab(item.tab);
      }
      setIsMobileMenuOpen(false);
    };

    return (
      <button
        key={item.key}
        onClick={handleClick}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
          isActive
            ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200/80 shadow-2xs'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
              isActive
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200/70 group-hover:text-slate-800'
            }`}
          >
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex flex-col text-left min-w-0">
            <span className="leading-tight truncate">{item.label}</span>
            <span className="text-[10px] text-slate-400 font-normal truncate">
              {item.subtitle}
            </span>
          </div>
        </div>
        {item.mobileBadge && item.mobileBadge(isActive)}
        {item.showDot && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>}
      </button>
    );
  };

  return (
    <>
      {/* =========================================================================
          1. DESKTOP LEFT SIDEBAR (Visible on lg: and wider)
         ========================================================================= */}
      <aside
        className={`hidden lg:flex ${
          isSidebarCollapsed ? 'w-20' : 'w-64 xl:w-72'
        } h-screen sticky top-0 bg-[#F1F5F9] border-r border-slate-200 flex-col shrink-0 z-30 select-none transition-[width] duration-200 ease-in-out`}
      >
        {/* Collapse / Expand Toggle Button on Sidebar Edge */}
        <button
          id="sidebar-btn-toggle-collapse"
          type="button"
          onClick={toggleSidebarCollapsed}
          title={isSidebarCollapsed ? 'แสดงแถบเมนูเต็ม' : 'ซ่อนแถบเมนู (แสดงเฉพาะไอคอน)'}
          aria-label={isSidebarCollapsed ? 'แสดงแถบเมนูเต็ม' : 'ซ่อนแถบเมนู (แสดงเฉพาะไอคอน)'}
          aria-expanded={!isSidebarCollapsed}
          className="absolute -right-3.5 top-6 z-40 w-7 h-7 rounded-full bg-[#FFFFFF] border border-slate-200 shadow-sm text-slate-600 hover:text-[#1D4ED8] hover:border-blue-300 hover:bg-blue-50 active:scale-95 flex items-center justify-center transition-all cursor-pointer"
        >
          {isSidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>

        {/* Brand & Connection Status */}
        <div className={`${isSidebarCollapsed ? 'p-3.5 flex flex-col items-center' : 'p-5'} border-b border-slate-200/80`}>
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
            <div
              className={`${
                isSidebarCollapsed ? 'w-10 h-10 rounded-xl' : 'w-11 h-11 rounded-2xl'
              } bg-[#FFFFFF] flex items-center justify-center shadow-xs border border-slate-200 shrink-0 p-0.5`}
              title="TOTAL Solution - Foods & Beverage"
            >
              <TotalEmblem className={`${isSidebarCollapsed ? 'w-8 h-8' : 'w-9 h-9'} shrink-0 drop-shadow-xs`} />
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h1 className="font-extrabold text-base tracking-tight text-[#0F172A] leading-none truncate">
                    TOTAL
                  </h1>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-[#FFFFFF] text-[#1D4ED8] border border-blue-200/80 uppercase">
                    Solution
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 truncate font-medium">
                  Foods &amp; Beverage
                </p>
              </div>
            )}
          </div>

          {/* Connection Status & Database Refresh */}
          {isSidebarCollapsed ? (
            <div className="mt-2.5 flex flex-col items-center gap-2">
              <div
                className="flex items-center justify-center"
                title={sheetsConfig?.spreadsheetId ? 'สถานะระบบ: เชื่อมต่อ Sheets แล้ว' : 'สถานะระบบ: โหมดออฟไลน์'}
              >
                {sheetsConfig?.spreadsheetId ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-[#1D4ED8] animate-pulse ring-4 ring-white"></span>
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-4 ring-white"></span>
                )}
              </div>
              {sheetsConfig?.spreadsheetId && onRefreshDatabase && (
                <button
                  id="sidebar-btn-refresh-db-collapsed"
                  type="button"
                  onClick={onRefreshDatabase}
                  disabled={isLoadingData}
                  title={isLoadingData ? 'กำลังซิงค์ฐานข้อมูล...' : 'รีเฟรชฐานข้อมูล'}
                  className="w-9 h-9 rounded-xl bg-[#FFFFFF] border border-slate-200/90 hover:border-blue-300 hover:bg-blue-50 text-slate-600 hover:text-[#1D4ED8] flex items-center justify-center shadow-2xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingData ? 'animate-spin text-[#1D4ED8]' : ''}`} />
                </button>
              )}
            </div>
          ) : (
            <div className="mt-3.5 p-2.5 rounded-xl bg-[#FFFFFF] border border-slate-200/90 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium">สถานะระบบ:</span>
                {sheetsConfig?.spreadsheetId ? (
                  <span className="text-[#1D4ED8] font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#1D4ED8] animate-pulse"></span>
                    <span>เชื่อมต่อ Sheets แล้ว</span>
                  </span>
                ) : (
                  <span className="text-amber-700 font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span>โหมดออฟไลน์</span>
                  </span>
                )}
              </div>

              {sheetsConfig?.spreadsheetId && onRefreshDatabase && (
                <button
                  id="sidebar-btn-refresh-db"
                  type="button"
                  onClick={onRefreshDatabase}
                  disabled={isLoadingData}
                  title="คลิกเพื่อดึงข้อมูลทั้งหมดจากฐานข้อมูลใหม่"
                  className="w-full py-1.5 px-2.5 rounded-lg bg-[#F1F5F9] hover:bg-blue-50 hover:text-[#1D4ED8] hover:border-blue-200 border border-slate-200/80 text-[#0F172A] text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98 disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isLoadingData ? 'animate-spin text-[#1D4ED8]' : 'text-[#1D4ED8]'}`} />
                  <span>{isLoadingData ? 'กำลังซิงค์ฐานข้อมูล...' : 'รีเฟรชฐานข้อมูล'}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Scrollable Navigation Menu Groups */}
        <div
          className={`flex-1 overflow-y-auto overflow-x-hidden ${
            isSidebarCollapsed ? 'px-2.5 py-3 space-y-3' : 'p-3.5 space-y-5'
          } flex flex-col`}
        >
          {navGroups.map((group) => (
            <div key={group.key}>
              {isSidebarCollapsed ? (
                group.showDividerWhenCollapsed && <div className="border-t border-slate-200/80 mx-2 mb-3" />
              ) : (
                <div className="px-3 mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                    {group.label}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    {group.englishLabel}
                  </span>
                </div>
              )}

              <nav className="space-y-1">
                {/* Primary Action inside Sales Menu: New Order */}
                {group.key === 'sales' && !isViewer && (
                  <div className={isSidebarCollapsed ? 'flex justify-center pb-1' : 'pb-1.5'}>
                    <button
                      id="sidebar-btn-new-order"
                      onClick={onOpenNewOrder}
                      title="ลงออเดอร์ใหม่"
                      className={`${
                        isSidebarCollapsed
                          ? 'w-10 h-10 p-0 rounded-xl'
                          : 'w-full py-2.5 px-3 rounded-xl gap-2'
                      } flex items-center justify-center bg-[#1D4ED8] hover:bg-[#1E40AF] active:scale-98 text-white font-bold text-xs shadow-sm shadow-blue-700/20 transition-all cursor-pointer ${
                        activeTab === 'new_order' ? 'ring-2 ring-[#1D4ED8]/30 ring-offset-1 ring-offset-[#F1F5F9]' : ''
                      }`}
                    >
                      <PlusCircle className={`${isSidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4'} shrink-0`} />
                      {!isSidebarCollapsed && <span>ลงออเดอร์ใหม่</span>}
                    </button>
                  </div>
                )}

                {group.items.map(renderDesktopItem)}
              </nav>
            </div>
          ))}
        </div>
      </aside>

      {/* =========================================================================
          2. MOBILE BOTTOM NAVIGATION BAR (Visible only on screens below lg:)
         ========================================================================= */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white gpu-layer border-t border-slate-200 px-2 py-1.5 shadow-lg">
        {isDelivery ? (
          <div className="flex items-center justify-around">
            <button
              id="mobile-tab-logistics-dashboard"
              onClick={() => setActiveTab('logistics_dashboard')}
              className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
                activeTab === 'logistics_dashboard' ? 'text-blue-700 font-bold' : 'text-slate-500'
              }`}
            >
              <BarChart3 className="w-4.5 h-4.5" />
              <span>สรุปจัดส่ง</span>
            </button>

            <button
              id="mobile-tab-logistics"
              onClick={() => setActiveTab('logistics')}
              className={`relative flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
                activeTab === 'logistics' ? 'text-blue-700 font-bold' : 'text-slate-500'
              }`}
            >
              <Truck className="w-4.5 h-4.5" />
              <span>แผนจัดส่ง</span>
              {deliveryCount > 0 && (
                <span className="absolute top-0 right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                  {deliveryCount > 99 ? '99+' : deliveryCount}
                </span>
              )}
            </button>

            <button
              id="mobile-tab-fleet"
              onClick={() => setActiveTab('fleet_vehicles')}
              className={`relative flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
                activeTab === 'fleet_vehicles' ? 'text-blue-700 font-bold' : 'text-slate-500'
              }`}
            >
              <Car className="w-4.5 h-4.5" />
              <span>จัดการรถ</span>
              {fleetAlertCount > 0 && (
                <span className="absolute top-0 right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                  {fleetAlertCount > 99 ? '99+' : fleetAlertCount}
                </span>
              )}
            </button>

            <button
              id="mobile-tab-maintenance"
              onClick={() => setActiveTab('maintenance')}
              className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
                activeTab === 'maintenance' ? 'text-blue-700 font-bold' : 'text-slate-500'
              }`}
            >
              <Wrench className="w-4.5 h-4.5" />
              <span>ซ่อมบำรุง</span>
            </button>

            <button
              id="mobile-tab-more"
              onClick={() => setIsMobileMenuOpen(true)}
              className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
                isMobileMenuOpen ||
                !['logistics_dashboard', 'logistics', 'fleet_vehicles', 'maintenance'].includes(activeTab)
                  ? 'text-blue-700 font-bold'
                  : 'text-slate-500'
              }`}
            >
              <Menu className="w-4.5 h-4.5" />
              <span>เพิ่มเติม</span>
            </button>
          </div>
        ) : (
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
        )}
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
              {navGroups.map((group) => {
                // On mobile drawer, show dashboard before expenses in sales group (matching original order)
                const mobileItems = group.items.filter((i) => i.showInMobileDrawer !== false);
                if (group.key === 'sales') {
                  mobileItems.sort((a, b) => (a.key === 'dashboard' ? -1 : b.key === 'dashboard' ? 1 : 0));
                }
                if (mobileItems.length === 0) return null;

                return (
                  <div key={group.key}>
                    <div className="px-3 mb-2 flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        {group.label}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400">
                        {group.englishLabel}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {mobileItems.map(renderMobileDrawerItem)}
                    </div>
                  </div>
                );
              })}

              {/* Database Refresh Action on Mobile */}
              {sheetsConfig?.spreadsheetId && onRefreshDatabase && (
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      onRefreshDatabase();
                      setIsMobileMenuOpen(false);
                    }}
                    disabled={isLoadingData}
                    className="w-full py-2.5 bg-[#F1F5F9] border border-slate-200 hover:border-blue-200 hover:bg-blue-50 rounded-xl text-xs font-bold text-[#0F172A] hover:text-[#1D4ED8] shadow-2xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-[#1D4ED8] ${isLoadingData ? 'animate-spin' : ''}`} />
                    <span>{isLoadingData ? 'กำลังซิงค์ฐานข้อมูล...' : 'รีเฟรชฐานข้อมูล'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
});
