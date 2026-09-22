import React, { useState } from 'react';
import { Order, StaffUser } from '../types';
import {
  TrendingUp,
  DollarSign,
  Package,
  Truck,
  CheckCircle2,
  Calendar,
  Users,
  Award,
  ChevronRight,
  ArrowUpRight,
} from 'lucide-react';

interface DashboardViewProps {
  orders: Order[];
  currentUser: StaffUser;
  onOpenExportExcel?: () => void;
  onOpenNewOrder: () => void;
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

export const DashboardView: React.FC<DashboardViewProps> = ({
  orders,
  currentUser,
  onOpenNewOrder,
}) => {
  const [period, setPeriod] = useState<'today' | '7days' | 'month' | 'all'>('7days');

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

  return (
    <div className="space-y-6">
      {/* Range Switcher Box (เหลือแต่กล่องเลือกการแสดงผลข้อมูล) */}
      <div className="bg-white p-2 sm:p-2.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-start">
        {/* Period selector */}
        <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs w-full sm:w-auto">
          <button
            onClick={() => setPeriod('today')}
            className={`flex-1 sm:flex-none text-center px-3.5 sm:px-4 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
              period === 'today'
                ? 'bg-white text-blue-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            วันนี้
          </button>
          <button
            onClick={() => setPeriod('7days')}
            className={`flex-1 sm:flex-none text-center px-3.5 sm:px-4 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
              period === '7days'
                ? 'bg-white text-blue-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            7 วันล่าสุด
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`flex-1 sm:flex-none text-center px-3.5 sm:px-4 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
              period === 'month'
                ? 'bg-white text-blue-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            เดือนนี้
          </button>
          <button
            onClick={() => setPeriod('all')}
            className={`flex-1 sm:flex-none text-center px-3.5 sm:px-4 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
              period === 'all'
                ? 'bg-white text-blue-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ทั้งหมด
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Today Sales */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-4 sm:p-5 rounded-2xl shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-blue-100 font-medium">ยอดขายวันนี้ (Today)</span>
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
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
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">สถานะการจัดส่ง</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {pendingDeliveries} <span className="text-xs font-normal text-amber-600 font-medium">รอจัดส่ง</span>
            </div>
            <span className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              ส่งมอบสำเร็จแล้ว {completedOrders} รายการ
            </span>
          </div>
        </div>
      </div>

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
                            ? 'bg-gradient-to-t from-blue-600 to-indigo-500 shadow-sm shadow-blue-500/20'
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
