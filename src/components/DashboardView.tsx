import React, { useState, useMemo } from 'react';
import { Order, StaffUser, Customer, Route } from '../types';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Package,
  Truck,
  CheckCircle2,
  Calendar,
  Users,
  UserPlus,
  Award,
  ChevronRight,
  ArrowUpRight,
  ArrowRight,
  Wrench,
} from 'lucide-react';
import { doesRouteBelongToUser, isCustomerBelongingToUser } from '../utils/callPlanUtils';

interface DashboardViewProps {
  orders: Order[];
  customers?: Customer[];
  routes?: Route[];
  currentUser: StaffUser;
  onOpenExportExcel?: () => void;
  onOpenNewOrder: () => void;
  onNavigateToLogistics?: () => void;
  onNavigateToMaintenance?: () => void;
  onNavigateToCustomers?: () => void;
}


// Helper to parse dates that might be in Thai format (DD/MM/YYYY)
function parseDateRobust(dateStr: string): Date {
  if (!dateStr) return new Date();
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime()) && dateStr.includes('-')) {
    return parsed;
  }
  const parts = dateStr.split(' ');
  const datePart = parts[0];
  const timePart = parts[1] || '00:00:00';

  if (datePart.includes('/')) {
    const [day, month, year] = datePart.split('/');
    let y = parseInt(year);
    if (y > 2500) y -= 543;
    const [hour, min, sec] = timePart.split(':');
    return new Date(y, parseInt(month) - 1, parseInt(day), parseInt(hour || '0'), parseInt(min || '0'), parseInt(sec || '0'));
  }
  return parsed;
}

const THAI_SHORT_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

// Extract the earliest reliable acquisition/registration date of a customer
function resolveCustomerAcquiredDate(
  customer: Customer,
  earliestOrderByCustomerName: Map<string, Date>
): Date | null {
  const minValidMs = new Date(2020, 0, 1).getTime();
  const maxValidMs = Date.now() + 24 * 60 * 60 * 1000;

  // 1. Check creation timestamp embedded in customer ID (e.g., "CUST-1731234567890" or "1731234567890")
  const idStr = String(customer.id || '').trim();
  const tsMatch = idStr.match(/(?:^|-)(\d{13})$/);
  if (tsMatch) {
    const ms = Number(tsMatch[1]);
    if (Number.isFinite(ms) && ms >= minValidMs && ms <= maxValidMs) {
      return new Date(ms);
    }
  }

  // 2. Check customer.updatedAt if valid
  if (customer.updatedAt && String(customer.updatedAt).trim()) {
    const parsed = parseDateRobust(String(customer.updatedAt).trim());
    const ms = parsed.getTime();
    if (!isNaN(ms) && ms >= minValidMs && ms <= maxValidMs) {
      return parsed;
    }
  }

  // 3. Fallback: earliest order placed by this customer
  const cleanName = String(customer.name || '').trim().toLowerCase();
  if (cleanName && earliestOrderByCustomerName.has(cleanName)) {
    return earliestOrderByCustomerName.get(cleanName) || null;
  }

  return null;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  orders,
  customers = [],
  routes = [],
  currentUser,
  onOpenNewOrder,
  onNavigateToLogistics,
  onNavigateToMaintenance,
  onNavigateToCustomers,
}) => {
  const [period, setPeriod] = useState<'today' | '7days' | 'month' | 'all'>('7days');
  const [customerChartMonths, setCustomerChartMonths] = useState<6 | 12>(6);
  const [activeCustomerMonthKey, setActiveCustomerMonthKey] = useState<string | null>(null);

  // If currentUser is sales, scope orders to that salesperson
  const isSalesRole = currentUser.role === 'sales';
  const scopedOrders = isSalesRole
    ? orders.filter(
        (ord) =>
          ord.salespersonId === currentUser.id ||
          (ord.salespersonEmail && ord.salespersonEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
          ord.salespersonName.toLowerCase().includes(currentUser.name.toLowerCase()) ||
          currentUser.name.toLowerCase().includes(ord.salespersonName.toLowerCase())
      )
    : orders;

  // Filter orders by selected period
  const filteredOrders = scopedOrders.filter((ord) => {
    const ordDate = parseDateRobust(ord.createdAt);
    const now = new Date();

    if (period === 'today') {
      return (
        ordDate.getDate() === now.getDate() &&
        ordDate.getMonth() === now.getMonth() &&
        ordDate.getFullYear() === now.getFullYear()
      );
    }
    if (period === '7days') {
      const past7 = new Date(now);
      past7.setDate(now.getDate() - 7);
      return ordDate >= past7;
    }
    if (period === 'month') {
      return (
        ordDate.getMonth() === now.getMonth() &&
        ordDate.getFullYear() === now.getFullYear()
      );
    }
    return true;
  });

  // Calculate Today's specific metrics
  const today = new Date();
  const todayOrders = scopedOrders.filter((ord) => {
    const d = parseDateRobust(ord.createdAt);
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  });
  const todaySales = todayOrders.reduce((sum, ord) => sum + (ord.netAmount || 0), 0);

  // Period Metrics
  const totalSales = filteredOrders.reduce((sum, ord) => sum + (ord.netAmount || 0), 0);
  const totalOrdersCount = filteredOrders.length;
  const avgOrderValue = totalOrdersCount > 0 ? Math.round(totalSales / totalOrdersCount) : 0;
  const totalUnitsSold = filteredOrders.reduce(
    (sum, ord) => sum + (ord.items || []).reduce((iSum, it) => iSum + (it.quantity || 0), 0),
    0
  );
  const pendingDeliveries = filteredOrders.filter((ord) => ord.status === 'pending' || ord.status === 'delivering').length;
  const completedOrders = filteredOrders.filter((ord) => ord.status === 'completed').length;

  // 1. Group sales by day (for bar chart)
  const salesByDayMap: Record<string, { label: string; amount: number; count: number }> = {};
  // Prepare last 7 days keys
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const key = `${year}-${month}-${day}`;
    const label = d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' });
    salesByDayMap[key] = { label, amount: 0, count: 0 };
  }

  scopedOrders.forEach((ord) => {
    const d = parseDateRobust(ord.createdAt);
    // Format to YYYY-MM-DD (local time)
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const key = `${year}-${month}-${day}`;
    
    if (salesByDayMap[key]) {
      salesByDayMap[key].amount += (ord.netAmount || 0);
      salesByDayMap[key].count += 1;
    }
  });

  const dailyChartData = Object.values(salesByDayMap);
  const maxDayAmount = Math.max(...dailyChartData.map((d) => d.amount), 1);

  // 2. Sales by Salesperson
  const salesByPersonMap: Record<string, { name: string; revenue: number; ordersCount: number }> = {};
  filteredOrders.forEach((ord) => {
    const name = ord.salespersonName;
    if (!salesByPersonMap[name]) {
      salesByPersonMap[name] = { name, revenue: 0, ordersCount: 0 };
    }
    salesByPersonMap[name].revenue += (ord.netAmount || 0);
    salesByPersonMap[name].ordersCount += 1;
  });

  const salespersonData = Object.values(salesByPersonMap).sort((a, b) => b.revenue - a.revenue);
  const maxSalespersonRevenue = Math.max(...salespersonData.map((s) => s.revenue), 1);

  // 3. Top Products
  const productSalesMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
  filteredOrders.forEach((ord) => {
    (ord.items || []).forEach((it) => {
      if (!productSalesMap[it.name]) {
        productSalesMap[it.name] = { name: it.name, quantity: 0, revenue: 0 };
      }
      productSalesMap[it.name].quantity += (it.quantity || 0);
      productSalesMap[it.name].revenue += (it.subtotal || 0);
    });
  });

  const topProducts = Object.values(productSalesMap)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);
  const maxProductQty = Math.max(...topProducts.map((p) => p.quantity), 1);

  // 4. Monthly New Customers Growth Analytics (Role-scoped)
  const customerGrowthStats = useMemo(() => {
    const userOwnedRoutes = isSalesRole
      ? routes.filter((r) => doesRouteBelongToUser(r, currentUser))
      : routes;

    const scopedCustomers = isSalesRole
      ? customers.filter((c) => isCustomerBelongingToUser(c, currentUser, userOwnedRoutes, routes))
      : customers;

    // Earliest order date per customer name as fallback for legacy rows without timestamp
    const earliestOrderByCustomerName = new Map<string, Date>();
    scopedOrders.forEach((ord) => {
      const key = String(ord.customerName || '').trim().toLowerCase();
      if (!key || !ord.createdAt) return;
      const d = parseDateRobust(ord.createdAt);
      if (isNaN(d.getTime())) return;
      const prev = earliestOrderByCustomerName.get(key);
      if (!prev || d.getTime() < prev.getTime()) {
        earliestOrderByCustomerName.set(key, d);
      }
    });

    const now = new Date();
    const monthsList: Array<{
      key: string;
      shortLabel: string;
      fullLabel: string;
      year: number;
      monthIndex: number;
      newCount: number;
      cumulativeCount: number;
      isCurrentMonth: boolean;
    }> = [];

    for (let i = customerChartMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const thaiYearShort = String((y + 543) % 100).padStart(2, '0');
      const thaiYearFull = y + 543;
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      monthsList.push({
        key,
        shortLabel: `${THAI_SHORT_MONTHS[m]} ${thaiYearShort}`,
        fullLabel: `${THAI_SHORT_MONTHS[m]} ${thaiYearFull}`,
        year: y,
        monthIndex: m,
        newCount: 0,
        cumulativeCount: 0,
        isCurrentMonth: i === 0,
      });
    }

    const monthBucketByKey = new Map(monthsList.map((m) => [m.key, m]));
    const firstWindowDate = new Date(monthsList[0].year, monthsList[0].monthIndex, 1);

    let baselineBeforeWindow = 0;
    let undatedCount = 0;

    scopedCustomers.forEach((cust) => {
      const acquiredDate = resolveCustomerAcquiredDate(cust, earliestOrderByCustomerName);
      if (!acquiredDate) {
        undatedCount += 1;
        return;
      }
      if (acquiredDate < firstWindowDate) {
        baselineBeforeWindow += 1;
        return;
      }
      const key = `${acquiredDate.getFullYear()}-${String(acquiredDate.getMonth() + 1).padStart(2, '0')}`;
      const bucket = monthBucketByKey.get(key);
      if (bucket) {
        bucket.newCount += 1;
      }
    });

    // Build running cumulative customer base across months
    let runningTotal = baselineBeforeWindow + undatedCount;
    monthsList.forEach((m) => {
      runningTotal += m.newCount;
      m.cumulativeCount = runningTotal;
    });

    const totalNewInWindow = monthsList.reduce((sum, m) => sum + m.newCount, 0);
    const currentMonthCount = monthsList[monthsList.length - 1]?.newCount || 0;
    const prevMonthCount = monthsList.length >= 2 ? monthsList[monthsList.length - 2].newCount : 0;
    const momDiff = currentMonthCount - prevMonthCount;
    const momPercent =
      prevMonthCount > 0
        ? Math.round((momDiff / prevMonthCount) * 100)
        : currentMonthCount > 0
        ? 100
        : 0;
    const avgPerMonth =
      monthsList.length > 0 ? Math.round((totalNewInWindow / monthsList.length) * 10) / 10 : 0;
    const maxMonthNewCount = Math.max(...monthsList.map((m) => m.newCount), 1);
    const peakMonth = monthsList.reduce(
      (best, cur) => (cur.newCount > best.newCount ? cur : best),
      monthsList[0]
    );

    return {
      monthsList,
      totalCustomers: scopedCustomers.length,
      totalNewInWindow,
      currentMonthCount,
      prevMonthCount,
      momDiff,
      momPercent,
      avgPerMonth,
      maxMonthNewCount,
      peakMonth,
    };
  }, [customers, routes, currentUser, isSalesRole, scopedOrders, customerChartMonths]);

  return (
    <div className="space-y-6">
      {/* Range Switcher Box (เหลือแต่กล่องเลือกการแสดงผลข้อมูล) */}
      <div className="bg-[#FFFFFF] p-2 sm:p-2.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-start">
        {/* Period selector */}
        <div className="inline-flex bg-[#F1F5F9] p-1 rounded-xl border border-slate-200/80 text-xs w-full sm:w-auto">
          <button
            onClick={() => setPeriod('today')}
            className={`flex-1 sm:flex-none text-center px-3.5 sm:px-4 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
              period === 'today'
                ? 'bg-[#1D4ED8] text-white shadow-xs'
                : 'text-[#0F172A]/75 hover:text-[#0F172A]'
            }`}
          >
            วันนี้
          </button>
          <button
            onClick={() => setPeriod('7days')}
            className={`flex-1 sm:flex-none text-center px-3.5 sm:px-4 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
              period === '7days'
                ? 'bg-[#1D4ED8] text-white shadow-xs'
                : 'text-[#0F172A]/75 hover:text-[#0F172A]'
            }`}
          >
            7 วันล่าสุด
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`flex-1 sm:flex-none text-center px-3.5 sm:px-4 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
              period === 'month'
                ? 'bg-[#1D4ED8] text-white shadow-xs'
                : 'text-[#0F172A]/75 hover:text-[#0F172A]'
            }`}
          >
            เดือนนี้
          </button>
          <button
            onClick={() => setPeriod('all')}
            className={`flex-1 sm:flex-none text-center px-3.5 sm:px-4 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
              period === 'all'
                ? 'bg-[#1D4ED8] text-white shadow-xs'
                : 'text-[#0F172A]/75 hover:text-[#0F172A]'
            }`}
          >
            ทั้งหมด
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Today Sales */}
        <div className="bg-[#1D4ED8] text-white p-4 sm:p-5 rounded-2xl shadow-md shadow-blue-700/15 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-blue-100 font-medium">ยอดขายวันนี้ (Today)</span>
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-white" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-black tracking-tight">
              ฿{(todaySales ?? 0).toLocaleString()}
            </div>
            <span className="text-[11px] text-blue-100 mt-1 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              ออเดอร์วันนี้ {todayOrders.length} รายการ
            </span>
          </div>
        </div>

        {/* Card 2: Total Revenue in Period */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">
              ยอดขายรวม ({period === '7days' ? '7 วัน' : period === 'month' ? 'เดือนนี้' : 'ตามที่เลือก'})
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              ฿{(totalSales ?? 0).toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              เฉลี่ย ฿{(avgOrderValue ?? 0).toLocaleString()} / ออเดอร์
            </span>
          </div>
        </div>

        {/* Card 3: Total Orders & Units */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">จำนวนออเดอร์ & สินค้า</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {totalOrdersCount} <span className="text-xs font-normal text-slate-500">ออเดอร์</span>
            </div>
            <span className="text-[11px] text-purple-700 font-medium mt-1 block">
              ขายได้ทั้งหมด {(totalUnitsSold ?? 0).toLocaleString()} ชิ้น
            </span>
          </div>
        </div>

        {/* Card 4: Delivery Dispatch Status */}
        <div
          onClick={onNavigateToLogistics}
          className={`bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between ${
            onNavigateToLogistics ? 'cursor-pointer hover:border-amber-400 hover:shadow-md transition-all group' : ''
          }`}
          title={onNavigateToLogistics ? 'คลิกเพื่อไปที่เมนูโลจิสติกส์ จัดการแผนงานจัดส่ง' : undefined}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium group-hover:text-amber-800 transition-colors">
              สถานะการจัดส่ง (โลจิสติกส์)
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 group-hover:bg-amber-100 text-amber-600 flex items-center justify-center transition-colors">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center justify-between">
              <span>
                {pendingDeliveries} <span className="text-xs font-normal text-amber-600 font-medium">รอจัดส่ง</span>
              </span>
              {onNavigateToLogistics && (
                <span className="text-[10px] font-bold text-amber-800 bg-amber-50 group-hover:bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-200 transition-colors">
                  แผนจัดส่ง &rarr;
                </span>
              )}
            </div>
            <span className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              ส่งมอบสำเร็จแล้ว {completedOrders} รายการ
            </span>
          </div>
        </div>
      </div>

      {/* Fleet Maintenance Budget Overview Shortcut Banner (Manager Focus) */}
      {onNavigateToMaintenance && (
        <div
          onClick={onNavigateToMaintenance}
          className="bg-[#F1F5F9] text-[#0F172A] rounded-2xl p-4 sm:p-5 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:border-[#1D4ED8]/50 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1D4ED8] group-hover:bg-[#1E40AF] flex items-center justify-center text-white shrink-0 shadow-xs transition-colors">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-[#0F172A] tracking-tight">
                  แดชบอร์ดงบประมาณบำรุงรักษารถยนต์ (Vehicle Maintenance Budget)
                </h4>
                <span className="text-[10px] font-bold bg-[#FFFFFF] text-[#1D4ED8] border border-blue-200 px-2 py-0.5 rounded-full">
                  Fleet Analytics
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                ดูกราฟเปรียบเทียบค่าใช้จ่ายรายเดือนและรายคันรถ สัดส่วนค่าอะไหล่ vs ค่าแรง และการวิเคราะห์ต้นทุน/กม.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <span className="text-xs font-bold text-[#1D4ED8] group-hover:text-[#1E40AF] flex items-center gap-1 transition-colors">
              เปิดแดชบอร์ดงบประมาณ &rarr;
            </span>
          </div>
        </div>
      )}

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: 7-Day Sales Trend Bar Chart */}
        <div className="lg:col-span-2 bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 w-full overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">แนวโน้มยอดขายรายวัน (7 วันล่าสุด)</h3>
              <p className="text-xs text-slate-500">ยอดเงินรวมในแต่ละวัน (บาท)</p>
            </div>
            <span className="self-start sm:self-auto text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
              ยอดรวม 7 วัน: ฿{dailyChartData.reduce((s, d) => s + (d.amount || 0), 0).toLocaleString()}
            </span>
          </div>

          {/* SVG/CSS Interactive Bar Chart */}
          <div className="pt-2 w-full">
            <div className="h-52 sm:h-56 flex items-end gap-1 sm:gap-3 justify-between border-b border-slate-100 pb-2 w-full">
              {dailyChartData.map((d, idx) => {
                const heightPercent = Math.max(8, Math.round((d.amount / maxDayAmount) * 100));
                const isToday = idx === dailyChartData.length - 1;

                return (
                  <div key={idx} className="flex-1 min-w-0 flex flex-col items-center gap-1.5 group h-full justify-end relative">
                    {/* Tooltip on hover/touch */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow pointer-events-none whitespace-nowrap absolute -top-8 left-1/2 -translate-x-1/2 z-20">
                      ฿{(d.amount ?? 0).toLocaleString()} ({d.count} ออเดอร์)
                    </div>

                    {/* Bar */}
                    <div className="w-full flex justify-center items-end h-full">
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full max-w-[34px] sm:max-w-[48px] rounded-t-lg sm:rounded-t-xl transition-all duration-300 relative ${
                          isToday
                            ? 'bg-[#1D4ED8] shadow-sm shadow-blue-700/20'
                            : 'bg-blue-100 hover:bg-blue-200'
                        }`}
                      >
                        {d.amount > 0 && (
                          <span className="absolute -top-4 sm:-top-5 left-1/2 -translate-x-1/2 text-[9px] sm:text-[10px] font-bold text-slate-700 block">
                            ฿{d.amount >= 1000 ? `${Math.round(d.amount / 1000)}k` : d.amount}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Day label */}
                    <span className="text-[10px] sm:text-xs font-semibold text-slate-600 text-center truncate w-full block px-0.5">
                      {d.label.split(' ')[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Sales by Salesperson */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 flex flex-col justify-between w-full overflow-hidden">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-500" />
                <span>ยอดขายแยกตามเซลล์</span>
              </h3>
              <span className="text-xs text-slate-400">เปรียบเทียบผลงาน</span>
            </div>

            <div className="space-y-4">
              {salespersonData.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">ยังไม่มีข้อมูลยอดขาย</p>
              ) : (
                salespersonData.map((staff, idx) => {
                  const percent = Math.round((staff.revenue / maxSalespersonRevenue) * 100);
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                            {idx + 1}
                          </span>
                          {staff.name}
                        </span>
                        <span className="font-bold text-blue-700">
                          ฿{(staff.revenue ?? 0).toLocaleString()}
                        </span>
                      </div>

                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${percent}%` }}
                          className={`h-full rounded-full ${
                            idx === 0 ? 'bg-blue-600' : 'bg-indigo-500'
                          }`}
                        ></div>
                      </div>

                      <div className="text-[10px] text-slate-400 text-right">
                        {staff.ordersCount} ออเดอร์สำเร็จ
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <button
              onClick={onOpenNewOrder}
              className="w-full py-2 bg-slate-50 hover:bg-blue-50 text-blue-800 font-semibold text-xs rounded-xl border border-slate-200 hover:border-blue-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>+ ลงออเดอร์ใหม่เพิ่มยอดขาย</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Monthly New Customers Growth Chart */}
      <div className="bg-[#FFFFFF] p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 w-full overflow-hidden">
        {/* Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F1F5F9] text-[#1D4ED8] border border-slate-200 flex items-center justify-center shrink-0">
              <UserPlus className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#0F172A] leading-tight">
                แนวโน้มลูกค้าใหม่รายเดือน (Monthly New Customers)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isSalesRole
                  ? 'จำนวนร้านค้าใหม่ในสายงานของคุณแยกตามเดือน เพื่อติดตามการขยายฐานลูกค้า'
                  : 'จำนวนร้านค้าใหม่ที่เพิ่มเข้าระบบแยกตามเดือน เพื่อติดตามการขยายฐานลูกค้าของฝ่ายขาย'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {/* 6M / 12M Toggle */}
            <div className="inline-flex bg-[#F1F5F9] p-0.5 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => {
                  setCustomerChartMonths(6);
                  setActiveCustomerMonthKey(null);
                }}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  customerChartMonths === 6
                    ? 'bg-[#1D4ED8] text-white shadow-2xs'
                    : 'text-[#0F172A]/75 hover:text-[#0F172A]'
                }`}
              >
                6 เดือน
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomerChartMonths(12);
                  setActiveCustomerMonthKey(null);
                }}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  customerChartMonths === 12
                    ? 'bg-[#1D4ED8] text-white shadow-2xs'
                    : 'text-[#0F172A]/75 hover:text-[#0F172A]'
                }`}
              >
                12 เดือน
              </button>
            </div>

            {onNavigateToCustomers && (
              <button
                type="button"
                onClick={onNavigateToCustomers}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#F1F5F9] hover:bg-blue-50 text-[#0F172A] hover:text-[#1D4ED8] border border-slate-200 hover:border-blue-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                <span>ดูข้อมูลลูกค้า</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <div className="p-3 rounded-xl bg-[#F1F5F9] border border-blue-200/80">
            <div className="text-[11px] font-medium text-[#1D4ED8]">ลูกค้าใหม่เดือนนี้</div>
            <div className="mt-1 flex items-baseline gap-2 flex-wrap">
              <span className="text-lg sm:text-xl font-black text-[#0F172A]">
                {customerGrowthStats.currentMonthCount.toLocaleString()}
              </span>
              <span className="text-[11px] font-medium text-slate-600">ราย</span>
              <span
                className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                  customerGrowthStats.momDiff > 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : customerGrowthStats.momDiff < 0
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-[#FFFFFF] text-slate-600 border border-slate-200'
                }`}
              >
                {customerGrowthStats.momDiff > 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : customerGrowthStats.momDiff < 0 ? (
                  <TrendingDown className="w-3 h-3" />
                ) : (
                  <Minus className="w-3 h-3" />
                )}
                <span>
                  {customerGrowthStats.momDiff > 0 ? '+' : ''}
                  {customerGrowthStats.momPercent}%
                </span>
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#F1F5F9] border border-slate-200/80">
            <div className="text-[11px] font-medium text-slate-500">เดือนก่อนหน้า</div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-lg sm:text-xl font-black text-[#0F172A]">
                {customerGrowthStats.prevMonthCount.toLocaleString()}
              </span>
              <span className="text-[11px] font-medium text-slate-500">ราย</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#F1F5F9] border border-slate-200/80">
            <div className="text-[11px] font-medium text-slate-500">
              เฉลี่ย ({customerChartMonths} เดือน)
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-lg sm:text-xl font-black text-[#0F172A]">
                {customerGrowthStats.avgPerMonth.toLocaleString()}
              </span>
              <span className="text-[11px] font-medium text-slate-500">ราย/เดือน</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#F1F5F9] border border-slate-200/80">
            <div className="text-[11px] font-medium text-[#1D4ED8] flex items-center gap-1">
              <Users className="w-3 h-3" />
              <span>ฐานลูกค้าทั้งหมด</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-lg sm:text-xl font-black text-[#0F172A]">
                {customerGrowthStats.totalCustomers.toLocaleString()}
              </span>
              <span className="text-[11px] font-medium text-slate-600">ราย</span>
            </div>
          </div>
        </div>

        {/* Monthly Bar Chart */}
        <div className="pt-2 overflow-x-auto">
          <div
            className={`relative pt-7 pb-2 ${
              customerChartMonths === 12 ? 'min-w-[540px]' : 'w-full'
            }`}
          >
            {/* Subtle horizontal reference gridlines */}
            <div className="absolute inset-x-0 top-7 bottom-9 pointer-events-none flex flex-col justify-between">
              <div className="border-t border-dashed border-slate-200 w-full" />
              <div className="border-t border-dashed border-slate-200 w-full" />
              <div className="border-t border-slate-200 w-full" />
            </div>

            <div className="h-48 sm:h-52 flex items-end gap-1.5 sm:gap-3 justify-between relative z-10">
              {customerGrowthStats.monthsList.map((m) => {
                const heightPercent =
                  m.newCount > 0
                    ? Math.max(12, Math.round((m.newCount / customerGrowthStats.maxMonthNewCount) * 100))
                    : 4;
                const isSelected = activeCustomerMonthKey === m.key;
                const isPeak =
                  customerGrowthStats.peakMonth &&
                  customerGrowthStats.peakMonth.newCount > 0 &&
                  m.key === customerGrowthStats.peakMonth.key;

                return (
                  <button
                    key={m.key}
                    type="button"
                    onMouseEnter={() => setActiveCustomerMonthKey(m.key)}
                    onMouseLeave={() => setActiveCustomerMonthKey(null)}
                    onClick={() =>
                      setActiveCustomerMonthKey((prev) => (prev === m.key ? null : m.key))
                    }
                    className="flex-1 min-w-0 flex flex-col items-center gap-1.5 group h-full justify-end relative cursor-pointer focus:outline-none"
                  >
                    {/* Floating Tooltip */}
                    <div
                      className={`transition-opacity bg-[#0F172A] text-white text-[10px] px-2.5 py-1.5 rounded-lg shadow-md pointer-events-none whitespace-nowrap absolute -top-9 left-1/2 -translate-x-1/2 z-20 ${
                        isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <span className="font-bold">{m.fullLabel}:</span> +{m.newCount} ราย (สะสม {m.cumulativeCount.toLocaleString()})
                    </div>

                    {/* Bar Container */}
                    <div className="w-full flex justify-center items-end h-full">
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full ${
                          customerChartMonths === 12
                            ? 'max-w-[30px] sm:max-w-[38px]'
                            : 'max-w-[40px] sm:max-w-[54px]'
                        } rounded-t-lg sm:rounded-t-xl transition-all duration-300 relative ${
                          m.newCount === 0
                            ? 'bg-[#F1F5F9] border border-slate-200'
                            : m.isCurrentMonth
                            ? 'bg-[#1D4ED8] shadow-sm shadow-blue-700/20 ring-2 ring-[#1D4ED8]/20'
                            : isPeak
                            ? 'bg-blue-500 shadow-xs'
                            : isSelected
                            ? 'bg-[#1D4ED8]/85'
                            : 'bg-blue-200 group-hover:bg-blue-400'
                        }`}
                      >
                        <span
                          className={`absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] sm:text-xs font-bold block ${
                            m.newCount > 0
                              ? m.isCurrentMonth
                                ? 'text-[#1D4ED8]'
                                : 'text-[#0F172A]'
                              : 'text-slate-400'
                          }`}
                        >
                          {m.newCount}
                        </span>
                      </div>
                    </div>

                    {/* Month Label */}
                    <span
                      className={`text-[10px] sm:text-xs font-semibold text-center truncate w-full block px-0.5 ${
                        m.isCurrentMonth ? 'text-[#1D4ED8] font-bold' : 'text-slate-600'
                      }`}
                    >
                      {m.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Insight Bar */}
        <div className="pt-2.5 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-600">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#1D4ED8] inline-block" />
              <span>เดือนปัจจุบัน</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-blue-200 inline-block" />
              <span>เดือนที่ผ่านมา</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-600 font-medium">
            <Calendar className="w-3.5 h-3.5 text-[#1D4ED8] shrink-0" />
            {customerGrowthStats.totalNewInWindow > 0 && customerGrowthStats.peakMonth ? (
              <span>
                ช่วง {customerChartMonths} เดือน เพิ่มใหม่รวม{' '}
                <strong className="text-[#0F172A]">{customerGrowthStats.totalNewInWindow.toLocaleString()} ราย</strong>{' '}
                (สูงสุดเดือน {customerGrowthStats.peakMonth.fullLabel}:{' '}
                <strong className="text-[#1D4ED8]">{customerGrowthStats.peakMonth.newCount} ราย</strong>)
              </span>
            ) : (
              <span>
                ยังไม่มีลูกค้าใหม่ที่ลงทะเบียนในช่วง {customerChartMonths} เดือนล่าสุด
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Top 5 Products Table */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3 w-full overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            <h3 className="text-sm font-bold text-slate-900">สินค้าขายดี 5 อันดับแรก (Top 5 Best Sellers)</h3>
            <p className="text-xs text-slate-500">เรียงตามจำนวนชิ้นที่จำหน่ายได้</p>
          </div>
          <span className="text-xs text-slate-500 font-medium self-start sm:self-auto">
            รวม {topProducts.length} รายการ
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {topProducts.map((prod, idx) => {
            const barWidth = Math.round((prod.quantity / maxProductQty) * 100);
            return (
              <div key={idx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span
                    className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                      idx === 0
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : idx === 1
                        ? 'bg-slate-200 text-slate-700'
                        : idx === 2
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 text-xs sm:text-sm truncate">{prod.name}</div>
                    <div className="w-full max-w-[144px] h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                      <div
                        style={{ width: `${barWidth}%` }}
                        className="h-full bg-blue-600 rounded-full"
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 shrink-0 pl-8 sm:pl-0">
                  <div className="text-left sm:text-right">
                    <span className="text-slate-400 block text-[10px]">จำนวนที่ขายได้</span>
                    <span className="font-bold text-slate-800">{(prod.quantity ?? 0).toLocaleString()} ชิ้น</span>
                  </div>

                  <div className="text-right min-w-[80px] sm:min-w-[100px]">
                    <span className="text-slate-400 block text-[10px]">ยอดขายรวม</span>
                    <span className="font-black text-blue-700 text-xs sm:text-sm">
                      ฿{(prod.revenue ?? 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
