import React, { useState, useMemo } from 'react';
import { Order, OrderStatus, StaffUser, Route } from '../types';
import { normalizeThaiPhone, toTelHref } from '../utils/phoneUtils';
import { parseDateRobust, formatThaiDateShort } from '../utils/dateUtils';
import {
  Truck,
  Calendar,
  MapPin,
  Phone,
  CheckCircle2,
  Clock,
  Navigation,
  Printer,
  Search,
  Filter,
  User,
  Package,
  DollarSign,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  ExternalLink,
  Store,
  CreditCard,
  Banknote,
  Smartphone,
  Eye,
  RefreshCw,
  AlertCircle,
  X,
  FileText,
  Check,
  Edit2,
  CalendarDays,
  Globe,
  Gift,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { TotalEmblem } from './TotalLogo';
import { OnlineLogisticsPlanTab } from './OnlineLogisticsPlanTab';

interface LogisticsManagementViewProps {
  orders: Order[];
  currentUser: StaffUser;
  staffList: StaffUser[];
  routes: Route[];
  onUpdateStatus: (orderId: string, newStatus: OrderStatus) => void;
  onUpdateOrder: (order: Order) => Promise<void> | void;
  onSelectOrder: (order: Order) => void;
  onRefreshOrders?: () => Promise<void> | void;
  sheetsConnected: boolean;
  spreadsheetId?: string;
  onShowToast?: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

const formatDateThai = (dateStr?: string): string => formatThaiDateShort(dateStr);

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export const LogisticsManagementView: React.FC<LogisticsManagementViewProps> = ({
  orders,
  currentUser,
  staffList,
  routes,
  onUpdateStatus,
  onUpdateOrder,
  onSelectOrder,
  onRefreshOrders,
  sheetsConnected,
  spreadsheetId,
  onShowToast,
}) => {
  // Active Sub-Tab: 1. แผนงานจัดส่ง (ปัจจุบัน) | 2. แผนงานจัดส่งออนไลน์ (CSV)
  const [activeLogisticsTab, setActiveLogisticsTab] = useState<'standard' | 'online'>('standard');

  // Filters
  const [dateFilter, setDateFilter] = useState<'today' | 'tomorrow' | 'this_week' | 'all' | 'custom'>('today');
  const [customDate, setCustomDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [driverFilter, setDriverFilter] = useState<string>('all');
  const [routeFilter, setRouteFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals state
  const [isManifestOpen, setIsManifestOpen] = useState(false);
  const [podOrder, setPodOrder] = useState<Order | null>(null);
  const [podReceiver, setPodReceiver] = useState('');
  const [podNote, setPodNote] = useState('');
  const [podAmountCollected, setPodAmountCollected] = useState<number>(0);

  // Reschedule date modal
  const [rescheduleOrder, setRescheduleOrder] = useState<Order | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');

  // Assign driver modal
  const [assignOrder, setAssignOrder] = useState<Order | null>(null);
  const [assignedDriverId, setAssignedDriverId] = useState<string>('');
  const [assignedVehicle, setAssignedVehicle] = useState<string>('');

  // Local ordering overrides for stops
  const [sequenceMap, setSequenceMap] = useState<Record<string, number>>({});

  // List of delivery drivers and sales staff
  const deliveryStaff = useMemo(() => {
    return staffList.filter((u) => u.status !== 'inactive');
  }, [staffList]);

  // Determine active target date object for filtering
  const targetDateRange = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1)); // Monday
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6); // Sunday

    return { today, tomorrow, weekStart, weekEnd };
  }, []);

  // Filter orders according to date criteria
  const dateFilteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // If order has requestedDeliveryDate, use that; otherwise fallback to createdAt
      const dStr = order.requestedDeliveryDate || order.createdAt;
      const orderDate = parseDateRobust(dStr);
      orderDate.setHours(0, 0, 0, 0);

      if (dateFilter === 'today') {
        return isSameDay(orderDate, targetDateRange.today);
      }
      if (dateFilter === 'tomorrow') {
        return isSameDay(orderDate, targetDateRange.tomorrow);
      }
      if (dateFilter === 'this_week') {
        return orderDate >= targetDateRange.weekStart && orderDate <= targetDateRange.weekEnd;
      }
      if (dateFilter === 'custom' && customDate) {
        const cDate = parseDateRobust(customDate);
        cDate.setHours(0, 0, 0, 0);
        return isSameDay(orderDate, cDate);
      }
      return true; // 'all'
    });
  }, [orders, dateFilter, customDate, targetDateRange]);

  // Overall filtered orders with search, driver, status, route
  const filteredOrders = useMemo(() => {
    let result = dateFilteredOrders.filter((order) => {
      // Status filter
      if (statusFilter === 'pending_or_confirmed') {
        if (order.status !== 'pending' && order.status !== 'confirmed') return false;
      } else if (statusFilter !== 'all' && order.status !== statusFilter) {
        return false;
      }

      // Driver filter
      if (driverFilter !== 'all') {
        if (order.deliveryDriverId !== driverFilter && order.salespersonId !== driverFilter) {
          return false;
        }
      }

      // Route / Zone filter
      if (routeFilter !== 'all') {
        const matchesAddress = order.location?.address?.toLowerCase().includes(routeFilter.toLowerCase());
        const matchesNote = order.note?.toLowerCase().includes(routeFilter.toLowerCase());
        if (!matchesAddress && !matchesNote) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesOrder = order.orderNumber.toLowerCase().includes(term);
        const matchesCustomer = order.customerName.toLowerCase().includes(term);
        const matchesPhone = order.customerPhone.toLowerCase().includes(term);
        const matchesAddress = (order.location?.address || '').toLowerCase().includes(term);
        const matchesDriver = (order.deliveryDriverName || '').toLowerCase().includes(term);
        if (!matchesOrder && !matchesCustomer && !matchesPhone && !matchesAddress && !matchesDriver) {
          return false;
        }
      }

      return true;
    });

    // Sort by sequence or requested delivery date / time
    result.sort((a, b) => {
      const seqA = sequenceMap[a.id] ?? a.deliverySequence ?? 999;
      const seqB = sequenceMap[b.id] ?? b.deliverySequence ?? 999;
      if (seqA !== seqB) return seqA - seqB;
      // Secondary sort: created time
      return a.orderNumber.localeCompare(b.orderNumber);
    });

    return result;
  }, [dateFilteredOrders, statusFilter, driverFilter, routeFilter, searchTerm, sequenceMap]);

  // Key metrics calculation
  const stats = useMemo(() => {
    const totalOrders = dateFilteredOrders.length;
    const completed = dateFilteredOrders.filter((o) => o.status === 'completed').length;
    const delivering = dateFilteredOrders.filter((o) => o.status === 'delivering').length;
    const pending = dateFilteredOrders.filter((o) => o.status === 'pending' || o.status === 'confirmed').length;
    const cancelled = dateFilteredOrders.filter((o) => o.status === 'cancelled').length;

    // Total products & units to load on truck
    let totalItemsCount = 0;
    let codAmount = 0;

    dateFilteredOrders.forEach((order) => {
      if (order.status !== 'cancelled') {
        (order.items || []).forEach((item) => {
          totalItemsCount += item.quantity || 1;
        });
        (order.freebies || []).forEach((item) => {
          totalItemsCount += item.quantity || 1;
        });

        // Cash on delivery to collect
        if (order.paymentMethod === 'cash') {
          codAmount += order.netAmount || 0;
        }
      }
    });

    const completionRate = totalOrders > 0 ? Math.round((completed / (totalOrders - cancelled || 1)) * 100) : 0;

    return {
      totalOrders,
      completed,
      delivering,
      pending,
      cancelled,
      totalItemsCount,
      codAmount,
      completionRate: Math.min(100, Math.max(0, completionRate)),
    };
  }, [dateFilteredOrders]);

  // Move order up in sequence
  const handleMoveSequence = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === filteredOrders.length - 1)
    ) {
      return;
    }
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const currentOrder = filteredOrders[index];
    const targetOrder = filteredOrders[targetIndex];

    const currentSeq = sequenceMap[currentOrder.id] ?? currentOrder.deliverySequence ?? index + 1;
    const targetSeq = sequenceMap[targetOrder.id] ?? targetOrder.deliverySequence ?? targetIndex + 1;

    setSequenceMap((prev) => ({
      ...prev,
      [currentOrder.id]: targetSeq,
      [targetOrder.id]: currentSeq,
    }));
  };

  // Multi-stop route URL generation for Google Maps
  const handleOpenMultiStopRoute = () => {
    const validStops = filteredOrders.filter(
      (o) =>
        o.status !== 'completed' &&
        o.status !== 'cancelled' &&
        (o.location?.latitude || o.location?.address)
    );

    if (validStops.length === 0) {
      alert('ไม่พบจุดส่งสินค้าที่ต้องเดินทางในตัวกรองนี้');
      return;
    }

    if (validStops.length === 1) {
      const stop = validStops[0];
      const dest = stop.location.latitude && stop.location.longitude
        ? `${stop.location.latitude},${stop.location.longitude}`
        : encodeURIComponent(stop.location.address || stop.customerName);
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}`, '_blank');
      return;
    }

    // Build multi-stop URL
    const destinationStop = validStops[validStops.length - 1];
    const waypointsStops = validStops.slice(0, validStops.length - 1);

    const destQuery = destinationStop.location.latitude && destinationStop.location.longitude
      ? `${destinationStop.location.latitude},${destinationStop.location.longitude}`
      : encodeURIComponent(destinationStop.location.address || destinationStop.customerName);

    const waypointsQuery = waypointsStops
      .map((s) => {
        if (s.location.latitude && s.location.longitude) {
          return `${s.location.latitude},${s.location.longitude}`;
        }
        return encodeURIComponent(s.location.address || s.customerName);
      })
      .join('|');

    const multiStopUrl = `https://www.google.com/maps/dir/?api=1&destination=${destQuery}&waypoints=${waypointsQuery}`;
    window.open(multiStopUrl, '_blank');
  };

  // Open single stop navigation
  const handleNavigateToStop = (order: Order) => {
    if (order.location?.latitude && order.location?.longitude) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${order.location.latitude},${order.location.longitude}`,
        '_blank'
      );
    } else if (order.location?.mapsUrl) {
      window.open(order.location.mapsUrl, '_blank');
    } else if (order.location?.address) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.location.address)}`,
        '_blank'
      );
    } else {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customerName)}`,
        '_blank'
      );
    }
  };

  // Trigger Refresh
  const handleRefresh = async () => {
    if (onRefreshOrders && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefreshOrders();
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  // Save Reschedule Date
  const handleSaveReschedule = async () => {
    if (!rescheduleOrder || !rescheduleDate) return;
    const updated: Order = {
      ...rescheduleOrder,
      requestedDeliveryDate: rescheduleDate,
      updatedAt: new Date().toLocaleString('th-TH'),
    };
    await onUpdateOrder(updated);
    setRescheduleOrder(null);
  };

  // Save Driver & Vehicle assignment
  const handleSaveDriverAssignment = async () => {
    if (!assignOrder) return;
    const selectedStaff = staffList.find((s) => s.id === assignedDriverId);
    const updated: Order = {
      ...assignOrder,
      deliveryDriverId: assignedDriverId || undefined,
      deliveryDriverName: selectedStaff ? selectedStaff.name : undefined,
      deliveryVehicle: assignedVehicle.trim() || undefined,
      updatedAt: new Date().toLocaleString('th-TH'),
    };
    await onUpdateOrder(updated);
    setAssignOrder(null);
  };

  // Complete delivery with Proof of Delivery (POD)
  const handleConfirmPod = async () => {
    if (!podOrder) return;
    const notesSummary = [
      podOrder.note,
      podReceiver ? `ผู้รับมอบ: ${podReceiver}` : '',
      podNote ? `บันทึกจัดส่ง: ${podNote}` : '',
      podOrder.paymentMethod === 'cash' ? `รับเงินสด: ฿${podAmountCollected.toLocaleString()}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    const updated: Order = {
      ...podOrder,
      status: 'completed',
      deliveryProofNote: notesSummary,
      deliveredAt: new Date().toLocaleString('th-TH'),
      updatedAt: new Date().toLocaleString('th-TH'),
    };

    onUpdateStatus(podOrder.id, 'completed');
    await onUpdateOrder(updated);
    setPodOrder(null);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top 2-Tab Navigation Bar */}
      <div className="bg-white rounded-2xl p-2 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="grid grid-cols-2 sm:inline-flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-full sm:w-auto">
          <button
            id="logistics-tab-standard"
            type="button"
            onClick={() => setActiveLogisticsTab('standard')}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeLogisticsTab === 'standard'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>แผนงานจัดส่งปกติ</span>
          </button>
          <button
            id="logistics-tab-online"
            type="button"
            onClick={() => setActiveLogisticsTab('online')}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeLogisticsTab === 'online'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>แผนงานจัดส่งออนไลน์ (Excel/CSV)</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-2 text-xs text-slate-500">
          <span>
            {activeLogisticsTab === 'standard'
              ? 'จัดการคิวจัดส่งจากออเดอร์ในระบบ'
              : 'นำเข้าไฟล์ Excel / CSV และแยกสายส่งตามรหัสไปรษณีย์'}
          </span>
        </div>
      </div>

      {activeLogisticsTab === 'online' ? (
        <OnlineLogisticsPlanTab
          routes={routes}
          staffList={staffList}
          spreadsheetId={spreadsheetId}
          sheetsConnected={sheetsConnected}
          onShowToast={onShowToast}
        />
      ) : (
        <div className="space-y-5">
      {/* 1. Header Banner & Title */}
      <div className="bg-[#1D4ED8] rounded-3xl p-5 sm:p-7 text-white shadow-md shadow-blue-700/15 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 flex items-center pr-6 pointer-events-none">
          <Truck className="w-56 h-56 -mr-10 text-white" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-blue-200 text-xs font-semibold mb-2.5 border border-white/20">
              <Truck className="w-3.5 h-3.5 text-blue-300" />
              <span>ระบบบริหารงานโลจิสติกส์ & แผนจัดส่งสินค้า</span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight">
              จัดการแผนงานจัดส่งสินค้า
            </h1>
            <p className="text-xs sm:text-sm text-blue-200/90 mt-1.5 leading-relaxed font-medium">
              จัดลำดับจุดส่ง นำทางเที่ยวรถ ตรวจสอบยอดเก็บเงินสดปลายทาง (COD) และอัปเดตสถานะการส่งมอบสินค้าแบบเรียลไทม์
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            {/* Multi-stop Route Button */}
            <button
              id="btn-multi-stop-route"
              onClick={handleOpenMultiStopRoute}
              className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
              title="เปิด Google Maps นำทางเส้นทางหลายจุดส่งต่อเนื่อง"
            >
              <BrandLogo brand="google-maps" className="w-4 h-4 shrink-0" />
              <span>เปิดเส้นทางรวม (Maps)</span>
            </button>

            {/* Print Manifest Button */}
            <button
              id="btn-print-manifest"
              onClick={() => setIsManifestOpen(true)}
              className="px-3.5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 active:bg-white/30 text-white border border-white/30 font-bold text-xs sm:text-sm backdrop-blur-sm transition-all flex items-center gap-2 cursor-pointer"
              title="พิมพ์ใบสรุปรายการส่งสินค้าประจำเที่ยว (Delivery Manifest)"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">พิมพ์ใบนำส่ง</span>
              <span className="sm:hidden">พิมพ์ใบส่ง</span>
            </button>

            {/* Refresh from Sheets */}
            {onRefreshOrders && (
              <button
                id="btn-refresh-logistics"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all cursor-pointer disabled:opacity-50"
                title="รีเฟรชออเดอร์ล่าสุด"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar in Header */}
        <div className="mt-6 pt-5 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-blue-200">ความคืบหน้าการจัดส่งในรอบนี้:</span>
            <span className="font-extrabold text-white text-sm">
              {stats.completed} / {stats.totalOrders} ออเดอร์ ({stats.completionRate}%)
            </span>
          </div>
          <div className="w-full sm:w-64 bg-black/30 rounded-full h-2.5 overflow-hidden border border-white/10">
            <div
              className="bg-emerald-400 h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${stats.completionRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Overview Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Metric 1: Total Plan */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">แผนจัดส่งทั้งหมด</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-slate-900">
            {stats.totalOrders}
            <span className="text-xs font-semibold text-slate-400 ml-1">จุด</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            รวมสินค้า <strong className="text-slate-800">{stats.totalItemsCount.toLocaleString()}</strong> ชิ้น
          </div>
        </div>

        {/* Metric 2: Pending / Ready */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">รอเตรียม / รอจัดส่ง</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-amber-600">
            {stats.pending}
            <span className="text-xs font-semibold text-slate-400 ml-1">จุด</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">รอคนขับเริ่มออกเดินทาง</div>
        </div>

        {/* Metric 3: Delivering */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">กำลังเดินทาง</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Truck className="w-4 h-4 animate-bounce" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-blue-600">
            {stats.delivering}
            <span className="text-xs font-semibold text-slate-400 ml-1">จุด</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">อยู่ระหว่างการนำจ่าย</div>
        </div>

        {/* Metric 4: Completed */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">ส่งสำเร็จแล้ว</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-emerald-600">
            {stats.completed}
            <span className="text-xs font-semibold text-slate-400 ml-1">จุด</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">ลูกค้าเซ็นรับมอบแล้ว</div>
        </div>

        {/* Metric 5: Cash on Delivery (COD) */}
        <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-amber-50 to-orange-50/70 p-3.5 sm:p-4 rounded-2xl border border-amber-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-900">เงินสดรอเก็บ (COD)</span>
            <div className="w-7 h-7 rounded-lg bg-amber-200 text-amber-900 flex items-center justify-center">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-amber-950">
            ฿{stats.codAmount.toLocaleString()}
          </div>
          <div className="text-[10px] text-amber-800/80 mt-0.5">ยอดรวมเงินสดที่ต้องเก็บคืน</div>
        </div>
      </div>

      {/* 3. Date Selectors & Filter Controls Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3.5">
        {/* Row 1: Date quick tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <span className="text-xs font-bold text-slate-500 mr-1.5 flex items-center gap-1 shrink-0">
              <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
              <span>รอบจัดส่ง:</span>
            </span>

            <button
              onClick={() => setDateFilter('today')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                dateFilter === 'today'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              วันนี้
            </button>

            <button
              onClick={() => setDateFilter('tomorrow')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                dateFilter === 'tomorrow'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              พรุ่งนี้
            </button>

            <button
              onClick={() => setDateFilter('this_week')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                dateFilter === 'this_week'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              สัปดาห์นี้
            </button>

            <button
              onClick={() => setDateFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                dateFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ทุกวัน
            </button>

            <button
              onClick={() => setDateFilter('custom')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                dateFilter === 'custom'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              เลือกวันที่ระบุ
            </button>
          </div>

          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">วันที่:</span>
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg focus:outline-blue-600"
              />
            </div>
          )}
        </div>

        {/* Row 2: Search, Status Tabs & Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
          {/* Search box */}
          <div className="sm:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาร้านค้า, เลขที่ออเดอร์, เบอร์โทร หรือที่อยู่..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status filter dropdown */}
          <div className="sm:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="all">ทุกสถานะจัดส่ง</option>
              <option value="pending_or_confirmed">รอเตรียม / รอส่ง (Pending)</option>
              <option value="delivering">กำลังเดินทาง (Delivering)</option>
              <option value="completed">จัดส่งสำเร็จ (Completed)</option>
              <option value="cancelled">ยกเลิก (Cancelled)</option>
            </select>
          </div>

          {/* Driver filter dropdown */}
          <div className="sm:col-span-2">
            <select
              value={driverFilter}
              onChange={(e) => setDriverFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="all">ทุกคนขับ / พนักงาน</option>
              {deliveryStaff.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name} ({staff.role})
                </option>
              ))}
            </select>
          </div>

          {/* Route filter dropdown */}
          <div className="sm:col-span-2">
            <select
              value={routeFilter}
              onChange={(e) => setRouteFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="all">ทุกสายส่ง / โซน</option>
              {routes.map((rt) => (
                <option key={rt.id} value={rt.name}>
                  {rt.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4. Delivery Stops List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm sm:text-base text-slate-900">
              ลำดับจุดส่งสินค้าประจำเที่ยว ({filteredOrders.length} จุด)
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">
              (สามารถกดปุ่มลูกศรเพื่อปรับลำดับการเดินทางได้)
            </span>
          </div>

          <div className="text-xs text-slate-500 font-semibold">
            {dateFilter === 'today' && 'รอบจัดส่ง: วันนี้'}
            {dateFilter === 'tomorrow' && 'รอบจัดส่ง: พรุ่งนี้'}
            {dateFilter === 'this_week' && 'รอบจัดส่ง: สัปดาห์นี้'}
            {dateFilter === 'all' && 'รอบจัดส่ง: ทั้งหมด'}
            {dateFilter === 'custom' && `รอบจัดส่ง: ${formatDateThai(customDate)}`}
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 sm:p-14 text-center border border-slate-200/80 shadow-xs">
            <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-500 flex items-center justify-center mx-auto mb-3">
              <Truck className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800">ไม่พบรายการจัดส่งตามเงื่อนไขที่เลือก</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              ลองเปลี่ยนรอบวันที่จัดส่งด้านบนเป็น "ทุกวัน" หรือตรวจสอบสถานะออเดอร์ในเมนูรายการออเดอร์
            </p>
            <button
              onClick={() => {
                setDateFilter('all');
                setStatusFilter('all');
                setSearchTerm('');
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition-colors cursor-pointer"
            >
              แสดงออเดอร์ทั้งหมด
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order, index) => {
              const stopNumber = index + 1;
              const isDelivered = order.status === 'completed';
              const isDelivering = order.status === 'delivering';
              const isCancelled = order.status === 'cancelled';
              const totalItemsCount = (order.items || []).reduce((sum, it) => sum + (it.quantity || 1), 0);

              return (
                <div
                  key={order.id}
                  id={`delivery-stop-${order.orderNumber}`}
                  className={`bg-white rounded-2xl border transition-all shadow-2xs hover:shadow-md p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isDelivered
                      ? 'border-emerald-200/90 bg-emerald-50/20'
                      : isDelivering
                      ? 'border-blue-400 ring-2 ring-blue-500/10'
                      : 'border-slate-200/90'
                  }`}
                >
                  {/* Left: Sequence badge, Store name, address, contact */}
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {/* Sequence Badge with Up/Down buttons */}
                    <div className="flex flex-col items-center shrink-0">
                      <div
                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center font-black text-sm sm:text-base shadow-xs ${
                          isDelivered
                            ? 'bg-emerald-600 text-white'
                            : isDelivering
                            ? 'bg-blue-600 text-white ring-2 ring-blue-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                        title={`จุดส่งที่ ${stopNumber}`}
                      >
                        {isDelivered ? <Check className="w-5 h-5 stroke-[3]" /> : stopNumber}
                      </div>

                      {/* Reorder arrows */}
                      <div className="flex items-center gap-0.5 mt-1.5">
                        <button
                          type="button"
                          onClick={() => handleMoveSequence(index, 'up')}
                          disabled={index === 0}
                          className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100 disabled:opacity-20 cursor-pointer"
                          title="เลื่อนขึ้น"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveSequence(index, 'down')}
                          disabled={index === filteredOrders.length - 1}
                          className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100 disabled:opacity-20 cursor-pointer"
                          title="เลื่อนลง"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Customer & Delivery Information */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4
                          onClick={() => onSelectOrder(order)}
                          className="font-bold text-base sm:text-lg text-slate-900 hover:text-blue-600 cursor-pointer truncate transition-colors"
                        >
                          {order.customerName}
                        </h4>

                        <span className="font-mono text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {order.orderNumber}
                        </span>

                        {/* Status badge */}
                        {isDelivered ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>ส่งมอบสำเร็จ</span>
                          </span>
                        ) : isDelivering ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-800 animate-pulse">
                            <Truck className="w-3 h-3" />
                            <span>กำลังเดินทาง</span>
                          </span>
                        ) : isCancelled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-100 text-rose-800">
                            <span>ยกเลิก</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800">
                            <Clock className="w-3 h-3" />
                            <span>รอจัดส่ง</span>
                          </span>
                        )}
                      </div>

                      {/* Delivery Address */}
                      <div className="flex items-start gap-1.5 mt-1.5 text-xs text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="leading-snug line-clamp-2">
                          {order.location?.address || 'ไม่มีข้อมูลที่อยู่ระบุในระบบ'}
                        </span>
                      </div>

                      {/* Phone & Requested Date & Driver Info */}
                      <div className="flex items-center gap-3 mt-2 flex-wrap text-xs">
                        {order.customerPhone && toTelHref(order.customerPhone) && (
                          <a
                            href={toTelHref(order.customerPhone)}
                            className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{normalizeThaiPhone(order.customerPhone)}</span>
                          </a>
                        )}

                        {/* Delivery Target Date */}
                        <div className="inline-flex items-center gap-1 text-slate-500">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>กำหนดส่ง:</span>
                          <strong className="text-slate-700">
                            {formatDateThai(order.requestedDeliveryDate || order.createdAt)}
                          </strong>
                          <button
                            type="button"
                            onClick={() => {
                              setRescheduleOrder(order);
                              setRescheduleDate(
                                order.requestedDeliveryDate ||
                                  new Date().toISOString().slice(0, 10)
                              );
                            }}
                            className="ml-1 text-[11px] text-blue-600 hover:underline cursor-pointer"
                          >
                            (เปลี่ยน)
                          </button>
                        </div>

                        {/* Driver & Vehicle assignment */}
                        <div className="inline-flex items-center gap-1 text-slate-500">
                          <Truck className="w-3 h-3 text-slate-400" />
                          <span>คนขับ:</span>
                          <span className="font-semibold text-slate-700">
                            {order.deliveryDriverName || order.salespersonName || 'ยังไม่ระบุ'}
                          </span>
                          {order.deliveryVehicle && (
                            <span className="bg-slate-100 px-1.5 py-0.2 rounded text-[10px] font-mono text-slate-600">
                              {order.deliveryVehicle}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setAssignOrder(order);
                              setAssignedDriverId(order.deliveryDriverId || order.salespersonId || '');
                              setAssignedVehicle(order.deliveryVehicle || '');
                            }}
                            className="ml-1 text-[11px] text-blue-600 hover:underline cursor-pointer"
                          >
                            (มอบหมาย)
                          </button>
                        </div>
                      </div>

                      {/* Items Pill Summary */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold text-slate-500">
                          รายการส่ง ({totalItemsCount} ชิ้น):
                        </span>
                        {(order.items || []).slice(0, 3).map((it, i) => (
                          <span
                            key={i}
                            className="text-[11px] bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded-md"
                          >
                            {it.name} <strong className="text-blue-700">x{it.quantity}</strong>
                          </span>
                        ))}
                        {(order.items || []).length > 3 && (
                          <span className="text-[10px] text-slate-400 font-bold">
                            +อีก {(order.items || []).length - 3} รายการ
                          </span>
                        )}
                        {(order.freebies || []).length > 0 && (
                          <span className="text-[10px] bg-amber-50 text-amber-800 font-bold px-1.5 py-0.5 rounded-md border border-amber-200">
                            ของแถม {(order.freebies || []).length} รายการ
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Payment badge, Amount, and One-click Action Buttons */}
                  <div className="flex md:flex-col items-center md:items-end justify-between border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 gap-2 shrink-0">
                    <div className="text-left md:text-right">
                      <div className="flex items-center md:justify-end gap-1.5">
                        <span className="text-xs font-semibold text-slate-400">ยอดเก็บ:</span>
                        <span className="text-base sm:text-lg font-black text-slate-900">
                          ฿{(order.netAmount ?? 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center md:justify-end gap-1 mt-0.5">
                        {order.paymentMethod === 'cash' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md">
                            <Banknote className="w-3 h-3 shrink-0" />
                            <span>เก็บเงินสด (COD)</span>
                          </span>
                        ) : order.paymentMethod === 'transfer' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-100 text-blue-900 px-2 py-0.5 rounded-md">
                            <Smartphone className="w-3 h-3 shrink-0" />
                            <span>โอนเงินผ่านบัญชี</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-purple-100 text-purple-900 px-2 py-0.5 rounded-md">
                            <CreditCard className="w-3 h-3 shrink-0" />
                            <span>เครดิตเทอม</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Operational Action Buttons */}
                    <div className="flex items-center gap-2 mt-2">
                      {/* Navigate Button */}
                      <button
                        type="button"
                        onClick={() => handleNavigateToStop(order)}
                        className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                        title="เปิดแผนที่นำทางไปยังร้านค้านี้"
                      >
                        <BrandLogo brand="google-maps" className="w-3.5 h-3.5 text-[#4285F4] shrink-0" />
                        <span className="hidden sm:inline">นำทาง</span>
                      </button>

                      {/* Status Transition buttons */}
                      {!isDelivered && !isCancelled && (
                        <>
                          {!isDelivering ? (
                            <button
                              type="button"
                              onClick={() => onUpdateStatus(order.id, 'delivering')}
                              className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer transition-all"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>เริ่มออกส่ง</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setPodOrder(order);
                                setPodReceiver('');
                                setPodNote('');
                                setPodAmountCollected(
                                  order.paymentMethod === 'cash' ? order.netAmount : 0
                                );
                              }}
                              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer transition-all"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>บันทึกส่งสำเร็จ</span>
                            </button>
                          )}
                        </>
                      )}

                      {/* View details */}
                      <button
                        type="button"
                        onClick={() => onSelectOrder(order)}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="ดูรายละเอียดออเดอร์"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Proof of Delivery (POD) Modal */}
      {podOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
            <div className="px-5 py-4 bg-emerald-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-200" />
                <h3 className="font-bold text-base">บันทึกส่งมอบสินค้าสำเร็จ (POD)</h3>
              </div>
              <button
                onClick={() => setPodOrder(null)}
                className="p-1 rounded-full text-emerald-100 hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-100 text-xs">
                <div className="font-bold text-emerald-900 text-sm">{podOrder.customerName}</div>
                <div className="text-emerald-700 mt-0.5">เลขที่ออเดอร์: {podOrder.orderNumber}</div>
                <div className="text-emerald-700 mt-0.5">
                  ยอดเงินสุทธิ: ฿{(podOrder.netAmount ?? 0).toLocaleString()} (
                  {podOrder.paymentMethod === 'cash' ? 'เงินสด' : podOrder.paymentMethod === 'transfer' ? 'โอนเงิน' : 'เครดิต'})
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ชื่อผู้รับสินค้า / ตำแหน่ง *
                </label>
                <input
                  type="text"
                  placeholder="เช่น คุณนิดา (เจ้าของร้าน), ผู้จัดการร้าน"
                  value={podReceiver}
                  onChange={(e) => setPodReceiver(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {podOrder.paymentMethod === 'cash' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ยอดเงินสดที่เก็บได้จริง (บาท) *
                  </label>
                  <input
                    type="number"
                    value={podAmountCollected}
                    onChange={(e) => setPodAmountCollected(parseFloat(e.target.value) || 0)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:border-emerald-500 focus:outline-none font-bold text-emerald-800"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  หมายเหตุการส่งมอบ / สภาพสินค้า
                </label>
                <textarea
                  rows={2}
                  placeholder="เช่น สินค้าครบถ้วน ไม่มีชำรุด วางไว้ในสต็อกหลังร้าน"
                  value={podNote}
                  onChange={(e) => setPodNote(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPodOrder(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmPod}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Check className="w-4 h-4" />
                <span>ยืนยันส่งสำเร็จ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Reschedule Delivery Date Modal */}
      {rescheduleOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
            <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                <h3 className="font-bold text-base">เปลี่ยนกำหนดวันจัดส่งสินค้า</h3>
              </div>
              <button
                onClick={() => setRescheduleOrder(null)}
                className="p-1 rounded-full text-blue-100 hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-blue-50 rounded-2xl p-3 border border-blue-100 text-xs">
                <div className="font-bold text-blue-900">{rescheduleOrder.customerName}</div>
                <div className="text-blue-700 mt-0.5">เลขที่: {rescheduleOrder.orderNumber}</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  เลือกกำหนดวันที่ต้องการส่งมอบใหม่
                </label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRescheduleOrder(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveReschedule}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
              >
                บันทึกวันส่งใหม่
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Assign Driver & Vehicle Modal */}
      {assignOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
            <div className="px-5 py-4 bg-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5" />
                <h3 className="font-bold text-base">มอบหมายคนขับและรถส่งสินค้า</h3>
              </div>
              <button
                onClick={() => setAssignOrder(null)}
                className="p-1 rounded-full text-indigo-100 hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-indigo-50 rounded-2xl p-3 border border-indigo-100 text-xs">
                <div className="font-bold text-indigo-900">{assignOrder.customerName}</div>
                <div className="text-indigo-700 mt-0.5">เลขที่: {assignOrder.orderNumber}</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  พนักงานขับรถ / ผู้รับผิดชอบจัดส่ง
                </label>
                <select
                  value={assignedDriverId}
                  onChange={(e) => setAssignedDriverId(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">-- ไม่ระบุคนขับ --</option>
                  {deliveryStaff.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name} ({staff.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ทะเบียนรถ / ข้อมูลยานพาหนะ
                </label>
                <input
                  type="text"
                  placeholder="เช่น 1ฒศ-8899 (กระบะตู้ทึบ 1)"
                  value={assignedVehicle}
                  onChange={(e) => setAssignedVehicle(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setAssignOrder(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveDriverAssignment}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
              >
                บันทึกการมอบหมาย
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Delivery Manifest Printable Modal */}
      {isManifestOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-blue-600" />
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900">
                  ใบสรุปแผนงานจัดส่งสินค้าประจำเที่ยว (Daily Delivery Manifest)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  <span>พิมพ์เอกสาร</span>
                </button>
                <button
                  onClick={() => setIsManifestOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Manifest Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5 print:p-0 print:overflow-visible">
              {/* Document Header */}
              <div className="border-b-2 border-slate-900 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center border border-slate-200 p-1">
                      <TotalEmblem className="w-10 h-10" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900 leading-tight">
                        TOTAL SOLUTION FOODS &amp; BEVERAGE
                      </h2>
                      <p className="text-xs text-slate-600">
                        ใบส่งของประจำเที่ยวรถ / ใบนำส่งสินค้า (Delivery Manifest)
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <div>วันที่พิมพ์: <strong>{new Date().toLocaleDateString('th-TH')}</strong></div>
                    <div>รอบวันที่จัดส่ง: <strong>{dateFilter === 'custom' ? formatDateThai(customDate) : 'ปัจจุบัน'}</strong></div>
                  </div>
                </div>

                {/* Manifest Metadata */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-500">จำนวนจุดส่งทั้งหมด:</span>{' '}
                    <strong>{filteredOrders.length} จุด</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">จำนวนสินค้ารวม:</span>{' '}
                    <strong>{stats.totalItemsCount.toLocaleString()} ชิ้น</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">ยอดเงินสดต้องเก็บ (COD):</span>{' '}
                    <strong className="text-amber-700">฿{stats.codAmount.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">สถานะ:</span>{' '}
                    <strong>พร้อมส่งมอบ</strong>
                  </div>
                </div>
              </div>

              {/* Stops Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-300">
                      <th className="py-2.5 px-2 text-center w-12 font-bold">ลำดับ</th>
                      <th className="py-2.5 px-3 font-bold">เลขที่ / ร้านค้า</th>
                      <th className="py-2.5 px-3 font-bold">เบอร์โทร &amp; ที่อยู่จัดส่ง</th>
                      <th className="py-2.5 px-3 font-bold">รายการสินค้า</th>
                      <th className="py-2.5 px-3 text-right font-bold">ยอดเงิน &amp; ชำระ</th>
                      <th className="py-2.5 px-3 text-center w-32 font-bold">ลายมือชื่อผู้รับ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredOrders.map((ord, idx) => (
                      <tr key={ord.id} className="hover:bg-slate-50">
                        <td className="py-3 px-2 text-center font-bold text-slate-800">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{ord.customerName}</div>
                          <div className="font-mono text-[10px] text-slate-500">{ord.orderNumber}</div>
                        </td>
                        <td className="py-3 px-3 max-w-xs">
                          <div className="font-semibold text-slate-800">{ord.customerPhone || '-'}</div>
                          <div className="text-[11px] text-slate-600 line-clamp-2">
                            {ord.location?.address || '-'}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="space-y-0.5">
                            {(ord.items || []).map((it, i) => (
                              <div key={i} className="text-[11px] text-slate-800">
                                • {it.name} <strong>x{it.quantity}</strong>
                              </div>
                            ))}
                            {(ord.freebies || []).map((fb, i) => (
                              <div key={i} className="inline-flex items-center gap-1 text-[10px] text-amber-700 font-medium">
                                <Gift className="w-3 h-3 shrink-0" />
                                <span>แถม: {fb.name} x{fb.quantity}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="font-bold text-slate-900">
                            ฿{(ord.netAmount ?? 0).toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {ord.paymentMethod === 'cash'
                              ? 'เงินสด'
                              : ord.paymentMethod === 'transfer'
                              ? 'โอนเงิน'
                              : 'เครดิต'}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="h-10 border-b border-dashed border-slate-300 flex items-end justify-center text-[10px] text-slate-400">
                            (...........................)
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Signatures at bottom */}
              <div className="pt-8 grid grid-cols-3 gap-6 text-center text-xs">
                <div className="border-t border-slate-300 pt-2">
                  <div className="font-semibold text-slate-700">พนักงานขับรถ / ผู้ส่งสินค้า</div>
                  <div className="text-[11px] text-slate-400 mt-6">(..................................................)</div>
                </div>
                <div className="border-t border-slate-300 pt-2">
                  <div className="font-semibold text-slate-700">ผู้ตรวจสอบสินค้าขึ้นรถ</div>
                  <div className="text-[11px] text-slate-400 mt-6">(..................................................)</div>
                </div>
                <div className="border-t border-slate-300 pt-2">
                  <div className="font-semibold text-slate-700">ผู้จัดการฝ่ายโลจิสติกส์</div>
                  <div className="text-[11px] text-slate-400 mt-6">(..................................................)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
        </div>
      )}
    </div>
  );
};
