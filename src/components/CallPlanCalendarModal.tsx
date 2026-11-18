import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  RotateCcw,
  Plus,
  Check,
  CheckCircle2,
  Clock,
  X,
  Users,
  MapPin,
  Trash2,
  Info,
  CalendarDays,
  FileText,
  User,
  ArrowRight,
} from 'lucide-react';
import { Route, Customer, StoreCheckIn, StaffUser, DailyRouteSchedule } from '../types';
import {
  THAI_DAYS,
  THAI_MONTHS,
  THAI_DAY_COLORS,
  generateCalendarGrid,
  getEffectiveRoutesForDate,
  formatThaiDate,
  getTodayDateIso,
  getThaiDayFromDate,
  generateMonthlyScheduleFromWeeklyTemplate,
  getRouteColor,
  isCustomerInRoute,
} from '../utils/callPlanUtils';

interface CallPlanCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  routes: Route[];
  customers: Customer[];
  checkIns: StoreCheckIn[];
  dailySchedules: Record<string, DailyRouteSchedule>;
  onSaveDailySchedule: (dateStr: string, schedule: DailyRouteSchedule) => void;
  onBatchSaveDailySchedules: (schedules: Record<string, DailyRouteSchedule>) => void;
  onDeleteDailySchedule: (dateStr: string) => void;
  selectedDate: string; // 'YYYY-MM-DD'
  onSelectDate: (dateStr: string) => void;
  staffList?: StaffUser[];
  currentUser?: StaffUser;
}

export const CallPlanCalendarModal: React.FC<CallPlanCalendarModalProps> = ({
  isOpen,
  onClose,
  routes,
  customers,
  checkIns,
  dailySchedules,
  onSaveDailySchedule,
  onBatchSaveDailySchedules,
  onDeleteDailySchedule,
  selectedDate,
  onSelectDate,
  staffList = [],
  currentUser,
}) => {
  if (!isOpen) return null;

  const todayIso = useMemo(() => getTodayDateIso(), []);

  // Calendar Year & Month state
  const initialYearMonth = useMemo(() => {
    const baseDate = selectedDate ? new Date(selectedDate) : new Date();
    if (isNaN(baseDate.getTime())) return { year: new Date().getFullYear(), month: new Date().getMonth() };
    return { year: baseDate.getFullYear(), month: baseDate.getMonth() };
  }, [selectedDate]);

  const [currentYear, setCurrentYear] = useState<number>(initialYearMonth.year);
  const [currentMonth, setCurrentMonth] = useState<number>(initialYearMonth.month); // 0-indexed
  const [selectedSales, setSelectedSales] = useState<string>(
    currentUser?.role === 'sales' ? currentUser.name : 'all'
  );

  // Day editor state
  const [editingDateStr, setEditingDateStr] = useState<string | null>(null);
  const [editingRouteIds, setEditingRouteIds] = useState<string[]>([]);
  const [editingNotes, setEditingNotes] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Sales rep filter options
  const salesOptions = useMemo(() => {
    if (staffList && staffList.length > 0) {
      return staffList.filter((s) => s.role === 'sales' || s.role === 'manager').map((s) => s.name);
    }
    const set = new Set<string>();
    routes.forEach((r) => {
      if (r.salesrepName) set.add(r.salesrepName);
    });
    customers.forEach((c) => {
      if (c.salespersonName) set.add(c.salespersonName);
    });
    return Array.from(set);
  }, [staffList, routes, customers]);

  // Calendar Grid
  const calendarWeeks = useMemo(() => {
    return generateCalendarGrid(currentYear, currentMonth);
  }, [currentYear, currentMonth]);

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleJumpToToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
  };

  // Count planned customers and completed check-ins for each date
  const dateMetrics = useMemo(() => {
    const map = new Map<string, { plannedCount: number; completedCount: number; routes: Route[]; isCustomOverride: boolean; note?: string }>();

    // Scan all dates in visible calendar weeks
    calendarWeeks.flat().forEach((cell) => {
      const dateStr = cell.dateStr;
      const effectiveRoutes = getEffectiveRoutesForDate({
        dateStr,
        dailySchedules,
        routes,
        selectedSales,
      });

      const schedule = dailySchedules[dateStr];
      const isCustomOverride = !!schedule;

      // Count matching customers
      let planned = 0;
      customers.forEach((cust) => {
        if (effectiveRoutes.some((r) => isCustomerInRoute(cust, r))) {
          planned++;
        } else if (schedule?.additionalCustomerIds?.includes(cust.id || '')) {
          planned++;
        }
      });

      // Count completed check-ins on this date
      let completed = 0;
      checkIns.forEach((ci) => {
        let matchDate = false;
        if (ci.createdAt) {
          const dIso = ci.createdAt.slice(0, 10);
          if (dIso === dateStr) matchDate = true;
        }
        if (!matchDate && ci.timestampStr) {
          const cellDayNum = String(cell.dayNumber).padStart(2, '0');
          if (ci.timestampStr.includes(cellDayNum)) matchDate = true;
        }
        if (matchDate) {
          completed++;
        }
      });

      map.set(dateStr, {
        plannedCount: planned,
        completedCount: completed,
        routes: effectiveRoutes,
        isCustomOverride,
        note: schedule?.notes,
      });
    });

    return map;
  }, [calendarWeeks, dailySchedules, routes, selectedSales, customers, checkIns]);

  // Open day assignment editor
  const handleOpenDayEditor = (dateStr: string) => {
    setEditingDateStr(dateStr);
    const existing = dailySchedules[dateStr];
    if (existing) {
      setEditingRouteIds([...existing.routeIds]);
      setEditingNotes(existing.notes || '');
    } else {
      // Pre-fill with effective weekly routes for that day
      const thaiDay = getThaiDayFromDate(dateStr);
      const defaultRoutes = routes
        .filter((r) => Array.isArray(r.visitDays) && r.visitDays.includes(thaiDay))
        .map((r) => r.id);
      setEditingRouteIds(defaultRoutes);
      setEditingNotes('');
    }
  };

  // Toggle route in editor
  const handleToggleRouteInEditor = (routeId: string) => {
    setEditingRouteIds((prev) => {
      if (prev.includes(routeId)) {
        return prev.filter((id) => id !== routeId);
      } else {
        return [...prev, routeId];
      }
    });
  };

  // Save day schedule
  const handleSaveDayEditor = () => {
    if (!editingDateStr) return;
    const newSchedule: DailyRouteSchedule = {
      date: editingDateStr,
      routeIds: editingRouteIds,
      notes: editingNotes.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };
    onSaveDailySchedule(editingDateStr, newSchedule);
    showToast(`บันทึกแผนวิ่งสายวันที่ ${formatThaiDate(editingDateStr, { shortMonth: true })} เรียบร้อย!`);
    setEditingDateStr(null);
  };

  // Revert day to default weekly recurring
  const handleRevertDayToDefault = () => {
    if (!editingDateStr) return;
    onDeleteDailySchedule(editingDateStr);
    showToast(`รีเซ็ตวันที่ ${formatThaiDate(editingDateStr, { shortMonth: true })} กลับเป็นรอบสัปดาห์ปกติแล้ว`);
    setEditingDateStr(null);
  };

  // Batch action: Auto-fill entire month from weekly template
  const handleAutoFillMonth = () => {
    const generated = generateMonthlyScheduleFromWeeklyTemplate(currentYear, currentMonth, routes);
    const merged = { ...dailySchedules, ...generated };
    onBatchSaveDailySchedules(merged);
    showToast(`สร้างแผนวิ่งสายสำหรับเดือน ${THAI_MONTHS[currentMonth]} ${currentYear + 543} ตามรอบปกติสำเร็จ!`);
  };

  // Batch action: Clear month overrides
  const handleClearMonthOverrides = () => {
    if (!window.confirm(`ต้องการล้างแผนปรับแต่งของเดือน ${THAI_MONTHS[currentMonth]} ${currentYear + 543} และใช้รอบประจำสัปดาห์ปกติหรือไม่?`)) {
      return;
    }
    const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const cleaned: Record<string, DailyRouteSchedule> = {};
    for (const [date, sched] of Object.entries(dailySchedules)) {
      if (!date.startsWith(prefix) && sched) {
        cleaned[date] = sched as DailyRouteSchedule;
      }
    }
    onBatchSaveDailySchedules(cleaned);
    showToast(`ล้างแผนปรับแต่งของเดือน ${THAI_MONTHS[currentMonth]} เรียบร้อยแล้ว`);
  };

  // Calculate monthly stats
  const monthlyStats = useMemo(() => {
    let daysWithRoutes = 0;
    let totalPlannedVisits = 0;
    let totalCompletedVisits = 0;

    calendarWeeks.flat().forEach((cell) => {
      if (cell.isCurrentMonth) {
        const metrics = dateMetrics.get(cell.dateStr);
        if (metrics && metrics.routes.length > 0) {
          daysWithRoutes++;
          totalPlannedVisits += metrics.plannedCount;
          totalCompletedVisits += metrics.completedCount;
        }
      }
    });

    return { daysWithRoutes, totalPlannedVisits, totalCompletedVisits };
  }, [calendarWeeks, dateMetrics]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-60 bg-emerald-700 text-white px-4 py-2.5 rounded-xl shadow-xl border border-emerald-500 flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col my-auto max-h-[94vh]">
        {/* =========================================================================
            HEADER BAR
           ========================================================================= */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shrink-0 shadow-inner">
              <CalendarDays className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold leading-tight flex items-center gap-2">
                  <span>ปฏิทินจำลองแผนวิ่งสายและเข้าเยี่ยม (Call Plan Calendar)</span>
                </h2>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-900 shadow-xs">
                  กำหนดรายวันได้อิสระ
                </span>
              </div>
              <p className="text-xs text-blue-100/90 mt-0.5">
                คลิกที่วันที่เพื่อเลือกสายส่งที่ต้องการวิ่ง หรือสร้างตารางจำลองล่วงหน้ารายเดือน
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer border border-white/10"
              title="ปิดหน้าต่าง"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            TOOLBAR & CONTROLS
           ========================================================================= */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          {/* Month / Year Navigator */}
          <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-2xl border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
              title="เดือนก่อนหน้า"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-3 py-1 font-bold text-slate-800 text-sm whitespace-nowrap min-w-[170px] text-center">
              {THAI_MONTHS[currentMonth]} {currentYear + 543}
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
              title="เดือนถัดไป"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleJumpToToday}
              className="ml-1 px-2.5 py-1 rounded-xl text-blue-700 bg-blue-50 hover:bg-blue-100 font-bold text-xs transition-colors cursor-pointer"
            >
              วันนี้
            </button>
          </div>

          {/* Sales rep selector */}
          <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-2xl border border-slate-200 shadow-2xs">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-500 font-semibold whitespace-nowrap">เซลล์:</span>
            <select
              value={selectedSales}
              onChange={(e) => setSelectedSales(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">ทุกคน (ทุกสายส่ง)</option>
              {salesOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Batch Actions */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleAutoFillMonth}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold transition-all cursor-pointer shadow-2xs"
              title="คัดลอกสายส่งตามรอบสัปดาห์ปกติมาใส่ในทุกวันของเดือนนี้โดยอัตโนมัติ"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>สร้างแผนตามรอบสัปดาห์</span>
            </button>
            <button
              type="button"
              onClick={handleClearMonthOverrides}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 text-rose-600 hover:border-rose-200 font-semibold transition-all cursor-pointer"
              title="ล้างแผนปรับแต่งของเดือนนี้"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
              <span>ล้างแผนเดือนนี้</span>
            </button>
          </div>
        </div>

        {/* =========================================================================
            MONTH SUMMARY STATS BANNER
           ========================================================================= */}
        <div className="px-4 py-2 bg-indigo-50/60 border-b border-indigo-100/80 flex items-center justify-between flex-wrap gap-2 text-xs text-indigo-900 shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-semibold flex items-center gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5 text-indigo-600" />
              <span>วันที่มีแผนวิ่งสาย: <strong className="font-bold text-indigo-800">{monthlyStats.daysWithRoutes} วัน</strong></span>
            </span>
            <span className="font-semibold flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>เป้าหมายเข้าเยี่ยมรวม: <strong className="font-bold text-indigo-800">{monthlyStats.totalPlannedVisits} ครั้ง</strong></span>
            </span>
            <span className="font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>เช็คอินแล้ว: <strong className="font-bold text-emerald-700">{monthlyStats.totalCompletedVisits} ครั้ง</strong></span>
            </span>
          </div>

          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>รอบปกติ</span>
            <span className="w-2 h-2 rounded-full bg-amber-500 ml-2" />
            <span>ปรับแต่งเอง (Override)</span>
          </div>
        </div>

        {/* =========================================================================
            CALENDAR GRID (Scrollable)
           ========================================================================= */}
        <div className="p-2 sm:p-4 overflow-y-auto flex-1 bg-slate-100/70">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Days of Week Headers */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-bold divide-x divide-slate-100">
              {THAI_DAYS.map((day) => {
                const color = THAI_DAY_COLORS[day];
                return (
                  <div key={day} className="py-2.5 px-1 flex flex-col items-center justify-center">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] ${color.bg} ${color.text} font-extrabold`}>
                      {day}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Weeks and Days Grid */}
            <div className="divide-y divide-slate-200">
              {calendarWeeks.map((week, wIdx) => (
                <div key={wIdx} className="grid grid-cols-7 divide-x divide-slate-100 min-h-[96px] sm:min-h-[110px]">
                  {week.map((cell) => {
                    const metrics = dateMetrics.get(cell.dateStr);
                    const isSelected = selectedDate === cell.dateStr;
                    const isToday = cell.isToday;
                    const routesForDay = metrics?.routes || [];
                    const hasRoutes = routesForDay.length > 0;
                    const isCustom = metrics?.isCustomOverride;

                    return (
                      <div
                        key={cell.dateStr}
                        onClick={() => handleOpenDayEditor(cell.dateStr)}
                        className={`p-1.5 sm:p-2 flex flex-col justify-between transition-all cursor-pointer relative group ${
                          !cell.isCurrentMonth
                            ? 'bg-slate-50/60 text-slate-400 opacity-60'
                            : isSelected
                            ? 'bg-blue-50/70 ring-2 ring-blue-500/80 inset-0 z-10'
                            : isToday
                            ? 'bg-amber-50/40 ring-1 ring-amber-400'
                            : 'bg-white hover:bg-slate-50'
                        }`}
                      >
                        {/* Day number & indicators header */}
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <div className="flex items-center gap-1">
                            <span
                              className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center ${
                                isToday
                                  ? 'bg-blue-600 text-white shadow-2xs font-extrabold'
                                  : isSelected
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'text-slate-700'
                              }`}
                            >
                              {cell.dayNumber}
                            </span>
                            {isToday && (
                              <span className="hidden sm:inline-block text-[9px] font-extrabold text-blue-600 bg-blue-50 px-1 py-0.2 rounded border border-blue-200">
                                วันนี้
                              </span>
                            )}
                          </div>

                          {/* Override badge or note */}
                          <div className="flex items-center gap-1">
                            {isCustom && (
                              <span
                                className="w-2 h-2 rounded-full bg-amber-500"
                                title="กำหนดสายด้วยตัวเองสำหรับวันนี้"
                              />
                            )}
                            {metrics?.note && (
                              <FileText className="w-3 h-3 text-slate-400" title={metrics.note} />
                            )}
                          </div>
                        </div>

                        {/* Assigned Routes Pills */}
                        <div className="space-y-1 flex-1 overflow-hidden my-0.5">
                          {routesForDay.slice(0, 3).map((r, rIdx) => {
                            const palette = getRouteColor(r.id || rIdx);
                            return (
                              <div
                                key={r.id}
                                className={`text-[10px] leading-tight px-1.5 py-0.5 rounded-md font-semibold truncate border flex items-center gap-1 ${palette.bg} ${palette.text} ${palette.border}`}
                                title={`${r.id}: ${r.name} (${r.salesrepName || 'ไม่ระบุ'})`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${palette.dot} shrink-0`} />
                                <span className="truncate">{r.name || r.id}</span>
                              </div>
                            );
                          })}

                          {routesForDay.length > 3 && (
                            <div className="text-[9px] text-slate-500 font-bold px-1">
                              +{routesForDay.length - 3} สายเพิ่มเติม
                            </div>
                          )}

                          {!hasRoutes && cell.isCurrentMonth && (
                            <div className="text-[10px] text-slate-300 italic group-hover:text-slate-400 flex items-center gap-0.5 py-0.5">
                              <Plus className="w-2.5 h-2.5" />
                              <span className="hidden sm:inline">กำหนดสาย</span>
                            </div>
                          )}
                        </div>

                        {/* Bottom metrics bar: Store Count & Check-in Progress */}
                        {hasRoutes && (
                          <div className="mt-1 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px]">
                            <span className="text-slate-500 font-medium">
                              👥 {metrics?.plannedCount || 0}
                            </span>

                            {(metrics?.completedCount || 0) > 0 && (
                              <span className="font-bold text-emerald-700 bg-emerald-50 px-1 rounded text-[9px]">
                                ✓ {metrics?.completedCount}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* =========================================================================
            FOOTER BAR
           ========================================================================= */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 text-slate-600">
            <Info className="w-4 h-4 text-blue-500 shrink-0" />
            <span>
              คลิกที่ช่องวันที่เพื่อกำหนดหรือสลับสายวิ่งได้ด้วยตัวเอง | แผนจะถูกบันทึกเพื่อใช้ในการคัดกรองร้านค้าหน้าเช็คอิน
            </span>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold transition-colors cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
            <button
              type="button"
              onClick={() => {
                onSelectDate(selectedDate);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold transition-colors cursor-pointer shadow-2xs"
            >
              <span>ไปยังรายการเช็คอิน ({formatThaiDate(selectedDate, { shortMonth: true })})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          DAY ROUTE ASSIGNMENT MODAL (Drawer / Popover)
         ========================================================================= */}
      {editingDateStr && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
                  <CalendarDays className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">
                    กำหนดสายวิ่งประจำวัน (Daily Route Plan)
                  </h3>
                  <p className="text-xs text-blue-100 font-medium">
                    {formatThaiDate(editingDateStr, { withDayOfWeek: true, shortMonth: false })}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingDateStr(null)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
              {/* Quick actions for route selection */}
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <span className="font-bold text-slate-800">
                  เลือกสายส่งที่ต้องการวิ่งในวันนี้ ({editingRouteIds.length} สาย):
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditingRouteIds(routes.map((r) => r.id))}
                    className="text-[11px] font-bold text-blue-600 hover:underline"
                  >
                    เลือกทั้งหมด
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setEditingRouteIds([])}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-800"
                  >
                    ล้างการเลือก
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      const thaiDay = getThaiDayFromDate(editingDateStr);
                      const defIds = routes
                        .filter((r) => Array.isArray(r.visitDays) && r.visitDays.includes(thaiDay))
                        .map((r) => r.id);
                      setEditingRouteIds(defIds);
                    }}
                    className="text-[11px] font-bold text-emerald-600 hover:underline"
                  >
                    ตามรอบสัปดาห์
                  </button>
                </div>
              </div>

              {/* Routes Checklist */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {routes.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 text-slate-500 text-center">
                    ยังไม่มีข้อมูลสายส่งในระบบ สามารถเพิ่มสายส่งได้ที่เมนู "จัดการสายส่ง (Routes)"
                  </div>
                ) : (
                  routes.map((route, idx) => {
                    const isChecked = editingRouteIds.includes(route.id);
                    const palette = getRouteColor(route.id || idx);
                    const customerCountInRoute = customers.filter((c) => isCustomerInRoute(c, route)).length;

                    return (
                      <div
                        key={route.id}
                        onClick={() => handleToggleRouteInEditor(route.id)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isChecked
                            ? 'bg-blue-50/70 border-blue-300 shadow-2xs ring-1 ring-blue-500/20'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                              isChecked
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isChecked && <Check className="w-3.5 h-3.5" />}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800 text-xs">
                                {route.name}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${palette.bg} ${palette.text} border ${palette.border}`}>
                                {route.id}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                              {route.salesrepName && (
                                <span>ผู้รับผิดชอบ: {route.salesrepName}</span>
                              )}
                              {route.visitDays && route.visitDays.length > 0 && (
                                <span>(รอบปกติ: {route.visitDays.join(', ')})</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-xl">
                          👥 {customerCountInRoute} ร้าน
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Special Day Notes */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  หมายเหตุ / บันทึกพิเศษสำหรับวันนี้ (ถ้ามี):
                </label>
                <input
                  type="text"
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  placeholder="เช่น ส่งรอบพิเศษเช้า, สลับสายกับวันจันทร์, ขยายรอบส่งถึง 18.00 น."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                />
              </div>

              {/* Quick Summary */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-slate-500">เป้าหมายร้านค้ารวมสำหรับวันนี้: </span>
                  <strong className="text-slate-900 font-bold text-sm">
                    {customers.filter((c) =>
                      routes
                        .filter((r) => editingRouteIds.includes(r.id))
                        .some((r) => isCustomerInRoute(c, r))
                    ).length}{' '}
                    ร้านค้า
                  </strong>
                </div>
                {dailySchedules[editingDateStr] && (
                  <button
                    type="button"
                    onClick={handleRevertDayToDefault}
                    className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700 font-bold text-xs"
                    title="ลบการกำหนดพิเศษแล้วกลับไปใช้รอบประจำสัปดาห์"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>กลับไปใช้รอบปกติ</span>
                  </button>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setEditingDateStr(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer"
              >
                ยกเลิก
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleSaveDayEditor();
                    onSelectDate(editingDateStr);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-2xs"
                  title="บันทึกและเริ่มไปเช็คอินร้านค้าของวันนี้ทันที"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>บันทึก & เช็คอินวันที่นี้</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveDayEditor}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs cursor-pointer shadow-2xs"
                >
                  <Check className="w-4 h-4" />
                  <span>บันทึกแผนสายวิ่ง</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
