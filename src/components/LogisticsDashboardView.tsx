import React, { useState, useMemo } from 'react';
import {
  Order,
  VehicleMaintenanceRecord,
  HiredVehicleTripRecord,
  DepositRecord,
  FleetVehicle,
} from '../types';
import {
  Truck,
  Car,
  CheckCircle2,
  Clock,
  Wrench,
  CircleDollarSign,
  ShieldCheck,
  ArrowRight,
  BarChart3,
  Calendar,
  Package,
  AlertTriangle,
} from 'lucide-react';
import { parseDateRobust, formatThaiDateShort, THAI_SHORT_MONTHS } from '../utils/dateUtils';
import { getVehicleComplianceAlerts, EXPIRY_WARNING_DAYS } from '../utils/fleetUtils';

interface LogisticsDashboardViewProps {
  orders: Order[];
  maintenanceRecords: VehicleMaintenanceRecord[];
  hiredVehicles: HiredVehicleTripRecord[];
  deposits: DepositRecord[];
  fleetVehicles: FleetVehicle[];
  onNavigateToLogistics: () => void;
  onNavigateToMaintenance: () => void;
  onNavigateToHiredVehicles: () => void;
  onNavigateToDeposits: () => void;
  onNavigateToFleet: () => void;
}

export const LogisticsDashboardView: React.FC<LogisticsDashboardViewProps> = React.memo(({
  orders,
  maintenanceRecords,
  hiredVehicles,
  deposits,
  fleetVehicles,
  onNavigateToLogistics,
  onNavigateToMaintenance,
  onNavigateToHiredVehicles,
  onNavigateToDeposits,
  onNavigateToFleet,
}) => {
  const [period, setPeriod] = useState<'today' | '7days' | 'month' | 'all'>('month');

  // Helper to check if a date matches the selected period
  const matchesPeriod = (dateStr?: string) => {
    if (period === 'all') return true;
    if (!dateStr) return false;
    const d = parseDateRobust(dateStr);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    if (period === 'today') {
      return (
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    }
    if (period === '7days') {
      const past7 = new Date(now);
      past7.setDate(now.getDate() - 7);
      past7.setHours(0, 0, 0, 0);
      return d >= past7;
    }
    // month
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };

  // 1. Delivery & Orders Metrics
  const deliveryStats = useMemo(() => {
    const validOrders = orders.filter((o) => o.status !== 'cancelled');
    const scoped = validOrders.filter((o) => matchesPeriod(o.requestedDeliveryDate || o.createdAt));

    const pendingCount = scoped.filter((o) => o.status === 'pending').length;
    const confirmedCount = scoped.filter((o) => o.status === 'confirmed').length;
    const deliveringCount = scoped.filter((o) => o.status === 'delivering').length;
    const completedOrders = scoped.filter((o) => o.status === 'completed');
    const completedCount = completedOrders.length;
    const totalActiveQueue = pendingCount + confirmedCount + deliveringCount;
    const totalScoped = scoped.length;
    const completionRate = totalScoped > 0 ? Math.round((completedCount / totalScoped) * 100) : 0;
    const completedValue = completedOrders.reduce((sum, o) => sum + (o.netAmount || 0), 0);

    // Last 7 days delivery count trend
    const dailyMap: Record<string, { label: string; total: number; completed: number; amount: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const label = d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' });
      dailyMap[key] = { label, total: 0, completed: 0, amount: 0 };
    }

    validOrders.forEach((o) => {
      const d = parseDateRobust(o.requestedDeliveryDate || o.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (dailyMap[key]) {
        dailyMap[key].total += 1;
        dailyMap[key].amount += o.netAmount || 0;
        if (o.status === 'completed') dailyMap[key].completed += 1;
      }
    });

    const dailyTrend = Object.values(dailyMap);
    const maxDailyCount = Math.max(...dailyTrend.map((d) => d.total), 1);

    return {
      totalScoped,
      totalActiveQueue,
      pendingCount,
      confirmedCount,
      deliveringCount,
      completedCount,
      completionRate,
      completedValue,
      dailyTrend,
      maxDailyCount,
    };
  }, [orders, period]);

  // 2. Hired Vehicles & Deposits Metrics
  const logisticsFinanceStats = useMemo(() => {
    const scopedTrips = hiredVehicles.filter((t) => matchesPeriod(t.date));
    const hiredTotalNet = scopedTrips.reduce((sum, t) => sum + (t.netPayout || 0), 0);
    const hiredPendingCount = hiredVehicles.filter((t) => t.payoutStatus === 'pending').length;

    const activeDeposits = deposits.filter(
      (d) => d.status === 'active' || d.status === 'partial_refunded'
    );
    const heldDepositAmount = activeDeposits.reduce(
      (sum, d) => sum + Math.max(0, (d.totalAmount || 0) - (d.refundedAmount || 0) - (d.deductedAmount || 0)),
      0
    );

    return {
      hiredTripCount: scopedTrips.length,
      hiredTotalNet,
      hiredPendingCount,
      activeDepositCount: activeDeposits.length,
      heldDepositAmount,
    };
  }, [hiredVehicles, deposits, period]);

  // 3. Vehicle Maintenance Budget Analytics (Moved & Expanded from Sales Dashboard)
  const maintenanceStats = useMemo(() => {
    const scoped = maintenanceRecords.filter((r) => matchesPeriod(r.date));
    const totalBudget = scoped.reduce((sum, r) => sum + (r.totalCost || 0), 0);
    const totalParts = scoped.reduce((sum, r) => sum + (r.costParts || 0), 0);
    const totalLaborAndOther = scoped.reduce(
      (sum, r) => sum + (r.costLabor || 0) + (r.costOther || 0),
      0
    );
    const avgCost = scoped.length > 0 ? Math.round(totalBudget / scoped.length) : 0;
    const partsPercent = totalBudget > 0 ? Math.round((totalParts / totalBudget) * 100) : 0;
    const laborPercent = totalBudget > 0 ? Math.max(0, 100 - partsPercent) : 0;

    const inProgressCount = maintenanceRecords.filter((r) => r.status === 'in_progress').length;
    const scheduledCount = maintenanceRecords.filter((r) => r.status === 'scheduled').length;

    // 6-Month Maintenance Budget Trend (always last 6 months from all records)
    const now = new Date();
    const monthsList: Array<{
      key: string;
      shortLabel: string;
      fullLabel: string;
      parts: number;
      labor: number;
      total: number;
      count: number;
      isCurrentMonth: boolean;
    }> = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      monthsList.push({
        key,
        shortLabel: `${THAI_SHORT_MONTHS[m]} ${String((y + 543) % 100).padStart(2, '0')}`,
        fullLabel: `${THAI_SHORT_MONTHS[m]} ${y + 543}`,
        parts: 0,
        labor: 0,
        total: 0,
        count: 0,
        isCurrentMonth: i === 0,
      });
    }

    const monthByKey = new Map(monthsList.map((m) => [m.key, m]));
    maintenanceRecords.forEach((rec) => {
      if (!rec.date) return;
      const d = parseDateRobust(rec.date);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bucket = monthByKey.get(key);
      if (bucket) {
        bucket.parts += rec.costParts || 0;
        bucket.labor += (rec.costLabor || 0) + (rec.costOther || 0);
        bucket.total += rec.totalCost || 0;
        bucket.count += 1;
      }
    });

    const maxMonthBudget = Math.max(...monthsList.map((m) => m.total), 1);
    const totalSixMonthBudget = monthsList.reduce((sum, m) => sum + m.total, 0);

    // Budget per vehicle plate (in selected period, fallback to all if period empty)
    const vehicleMap = new Map<
      string,
      { plate: string; vehicleType: string; totalCost: number; count: number }
    >();
    scoped.forEach((rec) => {
      const plate = rec.vehiclePlate || 'ไม่ระบุทะเบียน';
      const existing = vehicleMap.get(plate);
      if (existing) {
        existing.totalCost += rec.totalCost || 0;
        existing.count += 1;
      } else {
        vehicleMap.set(plate, {
          plate,
          vehicleType: rec.vehicleType || 'รถขนส่ง',
          totalCost: rec.totalCost || 0,
          count: 1,
        });
      }
    });

    const byVehicle = Array.from(vehicleMap.values())
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 6);
    const maxVehicleCost = Math.max(...byVehicle.map((v) => v.totalCost), 1);

    return {
      scopedCount: scoped.length,
      totalBudget,
      totalParts,
      totalLaborAndOther,
      avgCost,
      partsPercent,
      laborPercent,
      inProgressCount,
      scheduledCount,
      monthsList,
      maxMonthBudget,
      totalSixMonthBudget,
      byVehicle,
      maxVehicleCost,
    };
  }, [maintenanceRecords, period]);

  // 4. Fleet Compliance Alerts (Tax / PRB / Insurance <= 30 days)
  const fleetStats = useMemo(() => {
    const summary = getVehicleComplianceAlerts(fleetVehicles, EXPIRY_WARNING_DAYS);
    const companyCount = fleetVehicles.filter((v) => v.ownershipType === 'company').length;
    const hiredCount = fleetVehicles.filter((v) => v.ownershipType === 'hired').length;
    return {
      total: fleetVehicles.length,
      companyCount,
      hiredCount,
      ...summary,
    };
  }, [fleetVehicles]);

  const periodLabel =
    period === 'today'
      ? 'วันนี้'
      : period === '7days'
      ? '7 วันล่าสุด'
      : period === 'month'
      ? 'เดือนนี้'
      : 'ทั้งหมด';

  return (
    <div className="space-y-6">
      {/* Header & Period Switcher */}
      <div className="bg-[#FFFFFF] p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#1D4ED8] text-white flex items-center justify-center shadow-sm shadow-blue-700/20 shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-[#0F172A] tracking-tight">
              แดชบอร์ดสรุปงานจัดส่ง
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ภาพรวมสถานะการจัดส่ง รถร่วมบริการ เงินประกัน และงบประมาณบำรุงรักษารถยนต์
            </p>
          </div>
        </div>

        {/* Period Selector */}
        <div className="inline-flex bg-[#F1F5F9] p-1 rounded-xl border border-slate-200/80 text-xs w-full md:w-auto">
          {(
            [
              { id: 'today', label: 'วันนี้' },
              { id: '7days', label: '7 วันล่าสุด' },
              { id: 'month', label: 'เดือนนี้' },
              { id: 'all', label: 'ทั้งหมด' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPeriod(item.id)}
              className={`flex-1 md:flex-none text-center px-3.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                period === item.id
                  ? 'bg-[#1D4ED8] text-white shadow-xs'
                  : 'text-[#0F172A]/75 hover:text-[#0F172A]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Logistics KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Pending / Active Deliveries */}
        <div
          onClick={onNavigateToLogistics}
          className="bg-[#1D4ED8] text-white p-4 sm:p-5 rounded-2xl shadow-md shadow-blue-700/15 flex flex-col justify-between cursor-pointer hover:bg-[#1E40AF] transition-colors group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-blue-100 font-medium">รอจัดส่ง / กำลังจัดส่ง</span>
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
              <Truck className="w-4 h-4 text-white" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-black tracking-tight">
              {deliveryStats.totalActiveQueue.toLocaleString()}{' '}
              <span className="text-xs font-medium text-blue-100">รายการ</span>
            </div>
            <span className="text-[11px] text-blue-100 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              กำลังวิ่งส่ง {deliveryStats.deliveringCount} • รอยืนยัน/จัดคิว {deliveryStats.pendingCount + deliveryStats.confirmedCount}
            </span>
          </div>
        </div>

        {/* Card 2: Completed Deliveries */}
        <div
          onClick={onNavigateToLogistics}
          className="bg-[#FFFFFF] p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between cursor-pointer hover:border-blue-300 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">จัดส่งสำเร็จ ({periodLabel})</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
              {deliveryStats.completedCount.toLocaleString()}{' '}
              <span className="text-xs font-semibold text-emerald-600">
                ({deliveryStats.completionRate}%)
              </span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              มูลค่าส่งมอบ ฿{deliveryStats.completedValue.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Card 3: Hired Vehicles */}
        <div
          onClick={onNavigateToHiredVehicles}
          className="bg-[#FFFFFF] p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between cursor-pointer hover:border-blue-300 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">ค่าใช้จ่ายรถจ้าง ({periodLabel})</span>
            <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] text-[#1D4ED8] flex items-center justify-center">
              <CircleDollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
              ฿{logisticsFinanceStats.hiredTotalNet.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              {logisticsFinanceStats.hiredTripCount} เที่ยว • รอทำจ่ายทั้งหมด {logisticsFinanceStats.hiredPendingCount} รายการ
            </span>
          </div>
        </div>

        {/* Card 4: Active Deposits */}
        <div
          onClick={onNavigateToDeposits}
          className="bg-[#FFFFFF] p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between cursor-pointer hover:border-blue-300 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">เงินประกันที่ดูแลอยู่</span>
            <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] text-[#1D4ED8] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
              ฿{logisticsFinanceStats.heldDepositAmount.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              กำลังดูแล {logisticsFinanceStats.activeDepositCount} สัญญา
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          FLEET TAX / PRB / INSURANCE EXPIRY ALERTS (<= 30 DAYS)
         ========================================================================= */}
      <section className="bg-[#FFFFFF] rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-[#F1F5F9]/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                fleetStats.expiredCount > 0
                  ? 'bg-[#DC2626] text-white'
                  : fleetStats.warningCount > 0
                  ? 'bg-[#D97706] text-white'
                  : 'bg-[#1D4ED8] text-white'
              }`}
            >
              <Car className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#0F172A] tracking-tight">
                แจ้งเตือนภาษี / พ.ร.บ. / ประกันภัยกองรถ (ล่วงหน้า {EXPIRY_WARNING_DAYS} วัน)
              </h3>
              <p className="text-xs text-slate-600 mt-0.5 tabular-nums">
                กองรถทั้งหมด {fleetStats.total} คัน (รถบริษัท {fleetStats.companyCount} · รถร่วม {fleetStats.hiredCount}) ·
                เลยกำหนด <span className="font-bold text-[#DC2626]">{fleetStats.expiredCount}</span> · ใกล้ครบกำหนด{' '}
                <span className="font-bold text-[#D97706]">{fleetStats.warningCount}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onNavigateToFleet}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
          >
            <span>จัดการรถทั้งหมด</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-4 sm:p-5">
          {fleetStats.alerts.length === 0 ? (
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs">
              <div className="flex items-center gap-2 text-[#16A34A] font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>ภาษี พ.ร.บ. และประกันภัยของรถทุกคันอยู่ในเกณฑ์ปกติ (ไม่มีรายการครบกำหนดภายใน 30 วัน)</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 tabular-nums">
              {fleetStats.alerts.slice(0, 6).map((alert) => {
                const isExpired = alert.severity === 'expired';
                return (
                  <div
                    key={alert.id}
                    onClick={onNavigateToFleet}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                      isExpired
                        ? 'bg-rose-50/60 border-rose-200 hover:border-rose-300'
                        : 'bg-amber-50/50 border-amber-200 hover:border-amber-300'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#0F172A]">
                        <span className="truncate">{alert.plateNumber}</span>
                        <span className="text-slate-400 font-normal">·</span>
                        <span className="text-[11px] font-semibold text-slate-600">
                          {alert.ownershipType === 'company' ? 'รถบริษัท' : 'รถร่วม'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5 truncate">
                        {alert.docLabel} · ครบกำหนด {formatThaiDateShort(alert.expiryDate)}
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-extrabold shrink-0 ${
                        isExpired ? 'text-[#DC2626]' : 'text-[#D97706]'
                      }`}
                    >
                      {alert.statusLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* =========================================================================
          VEHICLE MAINTENANCE BUDGET DASHBOARD (Moved from Sales Dashboard)
         ========================================================================= */}
      <section className="bg-[#FFFFFF] rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Banner Header */}
        <div
          onClick={onNavigateToMaintenance}
          className="bg-[#F1F5F9] text-[#0F172A] p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-blue-50/70 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1D4ED8] group-hover:bg-[#1E40AF] flex items-center justify-center text-white shrink-0 shadow-xs transition-colors">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-[#0F172A] tracking-tight">
                  แดชบอร์ดงบประมาณบำรุงรักษารถยนต์ (Vehicle Maintenance Budget)
                </h3>
                <span className="text-[10px] font-bold bg-[#FFFFFF] text-[#1D4ED8] border border-blue-200 px-2 py-0.5 rounded-full">
                  Fleet Analytics
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                ดูกราฟเปรียบเทียบค่าใช้จ่ายรายเดือนและรายคันรถ สัดส่วนค่าอะไหล่ vs ค่าแรง และการวิเคราะห์ต้นทุนซ่อมบำรุง
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1D4ED8] group-hover:bg-[#1E40AF] text-white text-xs font-bold shadow-2xs transition-colors">
              <span>เปิดแดชบอร์ดงบประมาณเต็ม</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* Maintenance Budget Summary Body */}
        <div className="p-4 sm:p-5 space-y-5">
          {/* 4 Budget Summary Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-[#F1F5F9] border border-blue-200/80">
              <div className="text-[11px] font-medium text-[#1D4ED8]">
                งบประมาณบำรุงรักษารวม ({periodLabel})
              </div>
              <div className="mt-1 text-lg sm:text-xl font-black text-[#0F172A]">
                ฿{maintenanceStats.totalBudget.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {maintenanceStats.scopedCount} รายการ • เฉลี่ย ฿{maintenanceStats.avgCost.toLocaleString()}/ครั้ง
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F1F5F9] border border-slate-200/80">
              <div className="text-[11px] font-medium text-slate-500">ค่าอะไหล่ (Parts)</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-lg sm:text-xl font-black text-[#0F172A]">
                  ฿{maintenanceStats.totalParts.toLocaleString()}
                </span>
                <span className="text-[11px] font-bold text-[#1D4ED8]">
                  {maintenanceStats.partsPercent}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
                <div
                  style={{ width: `${maintenanceStats.partsPercent}%` }}
                  className="h-full bg-[#1D4ED8] rounded-full"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F1F5F9] border border-slate-200/80">
              <div className="text-[11px] font-medium text-slate-500">ค่าแรง & อื่นๆ (Labor)</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-lg sm:text-xl font-black text-[#0F172A]">
                  ฿{maintenanceStats.totalLaborAndOther.toLocaleString()}
                </span>
                <span className="text-[11px] font-bold text-slate-600">
                  {maintenanceStats.laborPercent}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
                <div
                  style={{ width: `${maintenanceStats.laborPercent}%` }}
                  className="h-full bg-blue-400 rounded-full"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F1F5F9] border border-slate-200/80">
              <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                <span>งานซ่อมที่กำลังติดตาม</span>
              </div>
              <div className="mt-1 text-lg sm:text-xl font-black text-[#0F172A]">
                {maintenanceStats.inProgressCount + maintenanceStats.scheduledCount}{' '}
                <span className="text-xs font-medium text-slate-500">รายการ</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                กำลังซ่อม {maintenanceStats.inProgressCount} • นัดล่วงหน้า {maintenanceStats.scheduledCount}
              </div>
            </div>
          </div>

          {/* 2-Column Maintenance Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left 2 Cols: 6-Month Maintenance Budget Bar Chart */}
            <div className="lg:col-span-2 p-4 rounded-xl bg-[#F1F5F9]/60 border border-slate-200/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-[#0F172A]">
                    แนวโน้มงบประมาณบำรุงรักษารายเดือน (6 เดือนล่าสุด)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    เปรียบเทียบค่าอะไหล่และค่าแรงในแต่ละเดือน
                  </p>
                </div>
                <span className="self-start sm:self-auto text-[11px] font-bold text-[#1D4ED8] bg-[#FFFFFF] px-2.5 py-1 rounded-full border border-blue-200">
                  รวม 6 เดือน: ฿{maintenanceStats.totalSixMonthBudget.toLocaleString()}
                </span>
              </div>

              <div className="pt-4">
                <div className="h-44 flex items-end gap-2 sm:gap-3 justify-between border-b border-slate-200 pb-2">
                  {maintenanceStats.monthsList.map((m) => {
                    const totalH =
                      m.total > 0
                        ? Math.max(12, Math.round((m.total / maintenanceStats.maxMonthBudget) * 100))
                        : 4;
                    const partsRatio = m.total > 0 ? Math.round((m.parts / m.total) * 100) : 0;

                    return (
                      <div
                        key={m.key}
                        className="flex-1 min-w-0 flex flex-col items-center gap-1.5 group h-full justify-end relative"
                      >
                        {/* Tooltip */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-[#0F172A] text-white text-[10px] px-2.5 py-1.5 rounded-lg shadow pointer-events-none whitespace-nowrap absolute -top-10 left-1/2 -translate-x-1/2 z-20">
                          {m.fullLabel}: ฿{m.total.toLocaleString()} ({m.count} ครั้ง)
                        </div>

                        <div className="w-full flex justify-center items-end h-full">
                          <div
                            style={{ height: `${totalH}%` }}
                            className={`w-full max-w-[44px] rounded-t-lg overflow-hidden flex flex-col justify-end relative transition-all ${
                              m.total === 0 ? 'bg-slate-200/80' : 'bg-blue-300 shadow-2xs'
                            }`}
                          >
                            {m.total > 0 && (
                              <div
                                style={{ height: `${partsRatio}%` }}
                                className="w-full bg-[#1D4ED8]"
                              />
                            )}
                          </div>
                        </div>

                        <div className="text-center w-full">
                          {m.total > 0 && (
                            <span className="text-[9px] font-bold text-[#0F172A] block leading-tight">
                              ฿{m.total >= 1000 ? `${(m.total / 1000).toFixed(1)}k` : m.total}
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-semibold truncate block ${
                              m.isCurrentMonth ? 'text-[#1D4ED8] font-bold' : 'text-slate-600'
                            }`}
                          >
                            {m.shortLabel}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-2.5 flex items-center gap-4 text-[11px] text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#1D4ED8] inline-block" />
                    <span>ค่าอะไหล่</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-blue-300 inline-block" />
                    <span>ค่าแรง & อื่นๆ</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Right 1 Col: Maintenance Cost by Vehicle */}
            <div className="p-4 rounded-xl bg-[#F1F5F9]/60 border border-slate-200/80 flex flex-col justify-between space-y-3">
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-[#0F172A] mb-3">
                  งบประมาณแยกตามทะเบียนรถ ({periodLabel})
                </h4>

                {maintenanceStats.byVehicle.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">
                    ยังไม่มีรายการซ่อมบำรุงในช่วงเวลาที่เลือก
                  </p>
                ) : (
                  <div className="space-y-3">
                    {maintenanceStats.byVehicle.map((v, idx) => {
                      const pct = Math.round((v.totalCost / maintenanceStats.maxVehicleCost) * 100);
                      return (
                        <div key={v.plate} className="space-y-1">
                          <div className="flex items-center justify-between text-xs gap-2">
                            <span className="font-bold text-[#0F172A] truncate">
                              {idx + 1}. {v.plate}
                            </span>
                            <span className="font-bold text-[#1D4ED8] shrink-0">
                              ฿{v.totalCost.toLocaleString()}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${pct}%` }}
                              className="h-full bg-[#1D4ED8] rounded-full"
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span className="truncate">{v.vehicleType}</span>
                            <span>{v.count} รายการ</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={onNavigateToMaintenance}
                className="w-full py-2 px-3 rounded-xl bg-[#FFFFFF] hover:bg-blue-50 text-[#1D4ED8] border border-slate-200 hover:border-blue-300 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>จัดการบันทึกบำรุงรักษารถ</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          DELIVERY TREND & STATUS BREAKDOWN
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7-Day Delivery Volume Trend */}
        <div className="lg:col-span-2 bg-[#FFFFFF] p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-[#0F172A]">
                ปริมาณงานจัดส่งรายวัน (7 วันล่าสุด)
              </h3>
              <p className="text-xs text-slate-500">จำนวนออเดอร์ทั้งหมดเทียบกับที่จัดส่งสำเร็จ</p>
            </div>
            <span className="self-start sm:self-auto text-xs font-bold text-[#1D4ED8] bg-[#F1F5F9] px-2.5 py-1 rounded-full border border-slate-200 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                รวม {deliveryStats.dailyTrend.reduce((s, d) => s + d.total, 0)} ออเดอร์
              </span>
            </span>
          </div>

          <div className="h-48 flex items-end gap-1.5 sm:gap-3 justify-between border-b border-slate-100 pb-2 pt-6">
            {deliveryStats.dailyTrend.map((d, idx) => {
              const heightPercent =
                d.total > 0 ? Math.max(12, Math.round((d.total / deliveryStats.maxDailyCount) * 100)) : 4;
              const isToday = idx === deliveryStats.dailyTrend.length - 1;
              return (
                <div
                  key={idx}
                  className="flex-1 min-w-0 flex flex-col items-center gap-1.5 group h-full justify-end relative"
                >
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-[#0F172A] text-white text-[10px] px-2 py-1 rounded shadow pointer-events-none whitespace-nowrap absolute -top-8 left-1/2 -translate-x-1/2 z-20">
                    {d.total} ออเดอร์ (ส่งแล้ว {d.completed}) • ฿{d.amount.toLocaleString()}
                  </div>
                  <div className="w-full flex justify-center items-end h-full">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full max-w-[38px] sm:max-w-[46px] rounded-t-lg transition-all relative ${
                        d.total === 0
                          ? 'bg-[#F1F5F9] border border-slate-200'
                          : isToday
                          ? 'bg-[#1D4ED8] shadow-sm shadow-blue-700/20'
                          : 'bg-blue-200 group-hover:bg-blue-400'
                      }`}
                    >
                      {d.total > 0 && (
                        <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-bold text-[#0F172A]">
                          {d.total}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-600 text-center truncate w-full">
                    {d.label.split(' ')[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Delivery Status Breakdown */}
        <div className="bg-[#FFFFFF] p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2 mb-4">
              <Package className="w-4 h-4 text-[#1D4ED8]" />
              <span>สัดส่วนสถานะงานจัดส่ง ({periodLabel})</span>
            </h3>

            <div className="space-y-3.5">
              {[
                { label: 'รอดำเนินการ (Pending)', count: deliveryStats.pendingCount, barClass: 'bg-amber-500' },
                { label: 'ยืนยันเตรียมส่ง (Confirmed)', count: deliveryStats.confirmedCount, barClass: 'bg-blue-500' },
                { label: 'กำลังจัดส่ง (Delivering)', count: deliveryStats.deliveringCount, barClass: 'bg-[#1D4ED8]' },
                { label: 'จัดส่งสำเร็จ (Completed)', count: deliveryStats.completedCount, barClass: 'bg-emerald-500' },
              ].map((row) => {
                const pct =
                  deliveryStats.totalScoped > 0
                    ? Math.round((row.count / deliveryStats.totalScoped) * 100)
                    : 0;
                return (
                  <div key={row.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{row.label}</span>
                      <span className="font-bold text-[#0F172A]">
                        {row.count} <span className="text-slate-400 font-normal">({pct}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div style={{ width: `${pct}%` }} className={`h-full rounded-full ${row.barClass}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={onNavigateToLogistics}
            className="w-full py-2.5 px-3 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-xs shadow-sm shadow-blue-700/20 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Truck className="w-4 h-4" />
            <span>เปิดจัดการแผนงานจัดส่ง</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
});
