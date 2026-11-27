import React, { useState, useMemo, useEffect } from 'react';
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
  History,
  RefreshCw,
  Search,
  AlertTriangle,
  Cloud,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import {
  Route,
  Customer,
  StoreCheckIn,
  StaffUser,
  DailyRouteSchedule,
  RouteScheduleHistoryEntry,
  RouteScheduleActionType,
} from '../types';
import { getRouteScheduleActionLabelThai } from '../services/googleSheets';
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
  doesRouteRunOnDay,
  doesRouteBelongToSales,
  doesRouteBelongToUser,
  isCustomerBelongingToUser,
  doesCheckInBelongToUser,
  formatDateIso,
} from '../utils/callPlanUtils';

interface CallPlanCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  routes: Route[];
  customers: Customer[];
  checkIns: StoreCheckIn[];
  dailySchedules: Record<string, DailyRouteSchedule>;
  routeScheduleHistory?: RouteScheduleHistoryEntry[];
  onRefreshRouteSchedules?: () => Promise<void>;
  sheetsConnected?: boolean;
  initialViewMode?: 'calendar' | 'history';
  onSaveDailySchedule: (
    dateStr: string,
    schedule: DailyRouteSchedule,
    meta?: { actionType?: RouteScheduleActionType; notes?: string }
  ) => void;
  onBatchSaveDailySchedules: (
    schedules: Record<string, DailyRouteSchedule>,
    meta?: { actionType?: RouteScheduleActionType; notes?: string; targetDateLabel?: string }
  ) => void;
  onDeleteDailySchedule: (
    dateStr: string,
    meta?: { actionType?: RouteScheduleActionType; notes?: string }
  ) => void;
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
  routeScheduleHistory = [],
  onRefreshRouteSchedules,
  sheetsConnected = false,
  initialViewMode = 'calendar',
  onSaveDailySchedule,
  onBatchSaveDailySchedules,
  onDeleteDailySchedule,
  selectedDate,
  onSelectDate,
  staffList = [],
  currentUser,
}) => {
  const todayIso = useMemo(() => getTodayDateIso(), []);
  const canViewAllRoutes = !currentUser || currentUser.role === 'admin' || currentUser.role === 'manager';

  const [viewMode, setViewMode] = useState<'calendar' | 'history'>(initialViewMode);
  const [historySearch, setHistorySearch] = useState('');
  const [historyActionFilter, setHistoryActionFilter] = useState<
    'all' | 'sales_self_switch' | 'daily' | 'monthly' | 'reset'
  >('all');
  const [isRefreshingHistory, setIsRefreshingHistory] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setViewMode(initialViewMode);
    }
  }, [isOpen, initialViewMode]);

  // Calendar Year & Month state
  const initialYearMonth = useMemo(() => {
    const baseDate = selectedDate ? new Date(selectedDate) : new Date();
    if (isNaN(baseDate.getTime())) return { year: new Date().getFullYear(), month: new Date().getMonth() };
    return { year: baseDate.getFullYear(), month: baseDate.getMonth() };
  }, [selectedDate]);

  const [currentYear, setCurrentYear] = useState<number>(initialYearMonth.year);
  const [currentMonth, setCurrentMonth] = useState<number>(initialYearMonth.month); // 0-indexed
  const [selectedSales, setSelectedSales] = useState<string>(
    canViewAllRoutes ? 'all' : (currentUser?.name || '')
  );

  // Sync selectedSales when currentUser changes
  useEffect(() => {
    if (!canViewAllRoutes && currentUser) {
      setSelectedSales(currentUser.name);
    }
  }, [canViewAllRoutes, currentUser]);

  const effectiveSelectedSales = canViewAllRoutes ? selectedSales : (currentUser?.name || '');

  // Day editor state
  const [editingDateStr, setEditingDateStr] = useState<string | null>(null);
  const [editingRouteIds, setEditingRouteIds] = useState<string[]>([]);
  const [editingNotes, setEditingNotes] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleRefreshFromSheet = async () => {
    if (!onRefreshRouteSchedules || isRefreshingHistory) return;
    setIsRefreshingHistory(true);
    try {
      await onRefreshRouteSchedules();
    } finally {
      setIsRefreshingHistory(false);
    }
  };

  const filteredHistoryEntries = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return routeScheduleHistory.filter((entry) => {
      if (!canViewAllRoutes && currentUser) {
        const byLower = String(entry.changedBy || '').toLowerCase();
        const meLower = String(currentUser.name || '').toLowerCase();
        if (byLower && meLower && !byLower.includes(meLower) && !meLower.includes(byLower)) {
          return false;
        }
      }
      if (historyActionFilter === 'sales_self_switch' && entry.actionType !== 'sales_self_switch') {
        return false;
      }
      if (
        historyActionFilter === 'daily' &&
        entry.actionType !== 'set_daily' &&
        entry.actionType !== 'update_daily'
      ) {
        return false;
      }
      if (
        historyActionFilter === 'monthly' &&
        entry.actionType !== 'batch_monthly' &&
        entry.actionType !== 'clear_monthly'
      ) {
        return false;
      }
      if (historyActionFilter === 'reset' && entry.actionType !== 'reset_default') {
        return false;
      }
      if (!q) return true;
      const haystack = [
        entry.targetDate,
        entry.changedBy,
        entry.changedByRole,
        entry.previousRouteNames,
        entry.newRouteNames,
        entry.notes,
        getRouteScheduleActionLabelThai(entry.actionType),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [routeScheduleHistory, historySearch, historyActionFilter, canViewAllRoutes, currentUser]);

  const formatHistoryTimestamp = (ts: string): string => {
    if (!ts) return '-';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatHistoryTargetDate = (target: string): string => {
    if (!target) return '-';
    if (/^\d{4}-\d{2}-\d{2}$/.test(target)) {
      return formatThaiDate(target, { withDayOfWeek: true, shortMonth: true });
    }
    if (/^\d{4}-\d{2}$/.test(target)) {
      const [y, m] = target.split('-').map(Number);
      if (m >= 1 && m <= 12) {
        return `เดือน ${THAI_MONTHS[m - 1]} ${y + 543}`;
      }
    }
    return target;
  };

  // Routes, customers, and check-ins scoped to current user role
  const scopedRoutes = useMemo(() => {
    if (canViewAllRoutes) return routes;
    return routes.filter((r) => doesRouteBelongToUser(r, currentUser));
  }, [canViewAllRoutes, routes, currentUser]);

  const scopedRouteIdSet = useMemo(() => new Set(scopedRoutes.map((r) => r.id)), [scopedRoutes]);

  // Routes visible inside the Day Route Assignment Modal:
  // - Sales user sees ONLY their own routes
  // - Admin/Manager with a specific salesperson selected sees ONLY that salesperson's routes
  // - Admin/Manager with 'all' sees all routes
  const isSingleSalesView = !canViewAllRoutes || effectiveSelectedSales !== 'all';

  const editorRoutes = useMemo(() => {
    if (!canViewAllRoutes) return scopedRoutes;
    if (effectiveSelectedSales !== 'all') {
      return scopedRoutes.filter((r) => doesRouteBelongToSales(r, effectiveSelectedSales));
    }
    return scopedRoutes;
  }, [canViewAllRoutes, scopedRoutes, effectiveSelectedSales]);

  const editorRouteIdSet = useMemo(() => new Set(editorRoutes.map((r) => r.id)), [editorRoutes]);

  const scopedCustomers = useMemo(() => {
    if (canViewAllRoutes || !currentUser) return customers;
    return customers.filter((c) => isCustomerBelongingToUser(c, currentUser, scopedRoutes, routes));
  }, [canViewAllRoutes, customers, currentUser, scopedRoutes, routes]);

  const scopedCheckIns = useMemo(() => {
    if (canViewAllRoutes || !currentUser) return checkIns;
    return checkIns.filter((ci) => doesCheckInBelongToUser(ci, currentUser));
  }, [canViewAllRoutes, checkIns, currentUser]);

  // Sales rep filter options (Admin & Manager)
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
    const map = new Map<
      string,
      {
        plannedCount: number;
        completedCount: number;
        routes: Route[];
        isCustomOverride: boolean;
        hasSelfSwitch: boolean;
        note?: string;
      }
    >();

    // Scan all dates in visible calendar weeks
    calendarWeeks.flat().forEach((cell) => {
      const dateStr = cell.dateStr;
      const effectiveRoutes = getEffectiveRoutesForDate({
        dateStr,
        dailySchedules,
        routes: scopedRoutes,
        selectedSales: canViewAllRoutes ? effectiveSelectedSales : undefined,
      });

      const schedule = dailySchedules[dateStr];
      const isCustomOverride = !!schedule;
      const hasSelfSwitch = Boolean(
        schedule?.selfSwitchedRouteIds && schedule.selfSwitchedRouteIds.length > 0
      );

      // Count matching customers
      let planned = 0;
      scopedCustomers.forEach((cust) => {
        if (effectiveRoutes.some((r) => isCustomerInRoute(cust, r))) {
          planned++;
        } else if (schedule?.additionalCustomerIds?.includes(cust.id || '')) {
          if (!canViewAllRoutes || effectiveSelectedSales === 'all' || cust.salespersonName === effectiveSelectedSales) {
            planned++;
          }
        }
      });

      // Count completed check-ins on this date
      let completed = 0;
      scopedCheckIns.forEach((ci) => {
        if (canViewAllRoutes && effectiveSelectedSales !== 'all') {
          const ciSales = String(ci.salespersonName || '').trim().toLowerCase();
          const targetSales = effectiveSelectedSales.trim().toLowerCase();
          if (ciSales && targetSales && !ciSales.includes(targetSales) && !targetSales.includes(ciSales)) {
            return;
          }
        }
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
        hasSelfSwitch,
        note: schedule?.notes,
      });
    });

    return map;
  }, [calendarWeeks, dailySchedules, scopedRoutes, canViewAllRoutes, effectiveSelectedSales, scopedCustomers, scopedCheckIns]);

  // Open day assignment editor
  const handleOpenDayEditor = (dateStr: string) => {
    setEditingDateStr(dateStr);
    const existing = dailySchedules[dateStr];
    if (existing) {
      const visibleIds = isSingleSalesView
        ? existing.routeIds.filter((id) => editorRouteIdSet.has(id))
        : [...existing.routeIds];
      setEditingRouteIds(visibleIds);
      setEditingNotes(existing.notes || '');
    } else {
      // Pre-fill with effective weekly routes for that day (scoped to selected salesperson)
      const thaiDay = getThaiDayFromDate(dateStr);
      const defaultRoutes = editorRoutes
        .filter((r) => doesRouteRunOnDay(r, thaiDay))
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

  // Save day schedule (preserving other reps' routes when filtered to a single salesperson)
  const handleSaveDayEditor = () => {
    if (!editingDateStr) return;
    const existing = dailySchedules[editingDateStr];
    let finalRouteIds = [...editingRouteIds];
    let selfSwitchedIds: string[] | undefined = undefined;
    let baselineBeforeSwitch: string[] | undefined = undefined;

    if (isSingleSalesView) {
      const thaiDay = getThaiDayFromDate(editingDateStr);
      const otherRouteIds = existing
        ? existing.routeIds.filter((id) => !editorRouteIdSet.has(id))
        : routes
            .filter((r) => !editorRouteIdSet.has(r.id) && doesRouteRunOnDay(r, thaiDay))
            .map((r) => r.id);
      finalRouteIds = Array.from(new Set([...otherRouteIds, ...editingRouteIds]));

      const otherSwitched = (existing?.selfSwitchedRouteIds || []).filter(
        (id) => !editorRouteIdSet.has(id)
      );

      if (!canViewAllRoutes) {
        const baselineAll =
          existing?.plannedRouteIdsBeforeSwitch && existing.plannedRouteIdsBeforeSwitch.length > 0
            ? existing.plannedRouteIdsBeforeSwitch
            : existing
            ? existing.routeIds
            : routes.filter((r) => doesRouteRunOnDay(r, thaiDay)).map((r) => r.id);
        const ownSwitched = editingRouteIds.filter((id) => !baselineAll.includes(id));
        const mergedSwitched = Array.from(new Set([...otherSwitched, ...ownSwitched]));
        if (mergedSwitched.length > 0) {
          selfSwitchedIds = mergedSwitched;
          baselineBeforeSwitch = baselineAll;
        }
      } else if (otherSwitched.length > 0) {
        selfSwitchedIds = otherSwitched;
        baselineBeforeSwitch = existing?.plannedRouteIdsBeforeSwitch;
      }
    }

    const newSchedule: DailyRouteSchedule = {
      date: editingDateStr,
      routeIds: finalRouteIds,
      notes: editingNotes.trim() || undefined,
      updatedBy: currentUser?.name,
      updatedAt: new Date().toISOString(),
      selfSwitchedRouteIds: selfSwitchedIds,
      plannedRouteIdsBeforeSwitch: baselineBeforeSwitch,
    };
    onSaveDailySchedule(editingDateStr, newSchedule, {
      actionType: !canViewAllRoutes
        ? 'sales_self_switch'
        : existing
        ? 'update_daily'
        : 'set_daily',
      notes:
        editingNotes.trim() ||
        (canViewAllRoutes && effectiveSelectedSales !== 'all'
          ? `ตั้งค่าสายสำหรับเซลล์: ${effectiveSelectedSales}`
          : undefined),
    });
    showToast(`บันทึกแผนวิ่งสายวันที่ ${formatThaiDate(editingDateStr, { shortMonth: true })} เรียบร้อย!`);
    setEditingDateStr(null);
  };

  // Revert day to default weekly recurring
  const handleRevertDayToDefault = () => {
    if (!editingDateStr) return;
    if (!isSingleSalesView) {
      onDeleteDailySchedule(editingDateStr, {
        actionType: 'reset_default',
        notes: 'รีเซ็ตกลับรอบสัปดาห์ปกติจากปฏิทินจำลอง',
      });
    } else {
      const existing = dailySchedules[editingDateStr];
      if (existing) {
        const otherRouteIds = existing.routeIds.filter((id) => !editorRouteIdSet.has(id));
        if (otherRouteIds.length === 0) {
          onDeleteDailySchedule(editingDateStr, {
            actionType: 'reset_default',
            notes:
              canViewAllRoutes && effectiveSelectedSales !== 'all'
                ? `รีเซ็ตกลับรอบสัปดาห์ปกติ (เซลล์: ${effectiveSelectedSales})`
                : 'รีเซ็ตกลับรอบสัปดาห์ปกติจากปฏิทินจำลอง',
          });
        } else {
          const thaiDay = getThaiDayFromDate(editingDateStr);
          const ownDefaultIds = editorRoutes
            .filter((r) => doesRouteRunOnDay(r, thaiDay))
            .map((r) => r.id);
          const remainingSwitched = (existing.selfSwitchedRouteIds || []).filter(
            (id) => !editorRouteIdSet.has(id)
          );
          onSaveDailySchedule(
            editingDateStr,
            {
              ...existing,
              routeIds: Array.from(new Set([...otherRouteIds, ...ownDefaultIds])),
              selfSwitchedRouteIds:
                remainingSwitched.length > 0 ? remainingSwitched : undefined,
              plannedRouteIdsBeforeSwitch:
                remainingSwitched.length > 0 ? existing.plannedRouteIdsBeforeSwitch : undefined,
              updatedBy: currentUser?.name,
              updatedAt: new Date().toISOString(),
            },
            {
              actionType: 'reset_default',
              notes:
                canViewAllRoutes && effectiveSelectedSales !== 'all'
                  ? `รีเซ็ตกลับรอบสัปดาห์ปกติ (เซลล์: ${effectiveSelectedSales})`
                  : 'รีเซ็ตกลับรอบสัปดาห์ปกติจากปฏิทินจำลอง',
            }
          );
        }
      }
    }
    showToast(`รีเซ็ตวันที่ ${formatThaiDate(editingDateStr, { shortMonth: true })} กลับเป็นรอบสัปดาห์ปกติแล้ว`);
    setEditingDateStr(null);
  };

  // Batch action: Auto-fill entire month from weekly template
  const handleAutoFillMonth = () => {
    const monthLabel = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const monthThaiLabel = `${THAI_MONTHS[currentMonth]} ${currentYear + 543}`;
    if (canViewAllRoutes) {
      const generated = generateMonthlyScheduleFromWeeklyTemplate(currentYear, currentMonth, routes);
      const merged = { ...dailySchedules, ...generated };
      onBatchSaveDailySchedules(merged, {
        actionType: 'batch_monthly',
        targetDateLabel: monthLabel,
        notes: `สร้างแผนอัตโนมัติตามรอบสัปดาห์ เดือน ${monthThaiLabel}`,
      });
    } else {
      const generatedOwn = generateMonthlyScheduleFromWeeklyTemplate(currentYear, currentMonth, scopedRoutes);
      const merged: Record<string, DailyRouteSchedule> = { ...dailySchedules };
      const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
      for (let day = 1; day <= lastDay; day++) {
        const d = new Date(currentYear, currentMonth, day);
        const dateStr = formatDateIso(d);
        const thaiDay = getThaiDayFromDate(dateStr);
        const ownIds = generatedOwn[dateStr]?.routeIds || [];
        const existing = merged[dateStr];
        const otherIds = existing
          ? existing.routeIds.filter((id) => !scopedRouteIdSet.has(id))
          : routes
              .filter((r) => !scopedRouteIdSet.has(r.id) && doesRouteRunOnDay(r, thaiDay))
              .map((r) => r.id);
        const combinedIds = Array.from(new Set([...otherIds, ...ownIds]));
        if (combinedIds.length > 0 || existing) {
          merged[dateStr] = {
            ...(existing || {}),
            date: dateStr,
            routeIds: combinedIds,
            notes: existing?.notes || generatedOwn[dateStr]?.notes,
            updatedBy: currentUser?.name,
            updatedAt: new Date().toISOString(),
          };
        }
      }
      onBatchSaveDailySchedules(merged, {
        actionType: 'batch_monthly',
        targetDateLabel: monthLabel,
        notes: `สร้างแผนอัตโนมัติตามรอบสัปดาห์ เดือน ${monthThaiLabel}`,
      });
    }
    showToast(`สร้างแผนวิ่งสายสำหรับเดือน ${monthThaiLabel} ตามรอบปกติสำเร็จ!`);
  };

  // Batch action: Clear month overrides
  const handleClearMonthOverrides = () => {
    const monthThaiLabel = `${THAI_MONTHS[currentMonth]} ${currentYear + 543}`;
    if (!window.confirm(`ต้องการล้างแผนปรับแต่งของเดือน ${monthThaiLabel} และใช้รอบประจำสัปดาห์ปกติหรือไม่?`)) {
      return;
    }
    const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const cleaned: Record<string, DailyRouteSchedule> = {};
    for (const [date, sched] of Object.entries(dailySchedules)) {
      if (!sched) continue;
      if (!date.startsWith(prefix)) {
        cleaned[date] = sched as DailyRouteSchedule;
      } else if (!canViewAllRoutes) {
        const typedSched = sched as DailyRouteSchedule;
        const thaiDay = getThaiDayFromDate(date);
        const otherCustomIds = typedSched.routeIds.filter((id) => !scopedRouteIdSet.has(id));
        const otherDefaultIds = routes
          .filter((r) => !scopedRouteIdSet.has(r.id) && doesRouteRunOnDay(r, thaiDay))
          .map((r) => r.id);
        const sameOtherSet =
          otherCustomIds.length === otherDefaultIds.length &&
          otherCustomIds.every((id) => otherDefaultIds.includes(id));
        if (!sameOtherSet) {
          const ownDefaultIds = scopedRoutes
            .filter((r) => doesRouteRunOnDay(r, thaiDay))
            .map((r) => r.id);
          cleaned[date] = {
            ...typedSched,
            routeIds: Array.from(new Set([...otherCustomIds, ...ownDefaultIds])),
            updatedBy: currentUser?.name,
            updatedAt: new Date().toISOString(),
          };
        }
      }
    }
    onBatchSaveDailySchedules(cleaned, {
      actionType: 'clear_monthly',
      targetDateLabel: prefix,
      notes: `ล้างแผนปรับแต่งเดือน ${monthThaiLabel}`,
    });
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

  if (!isOpen) return null;

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

          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            {/* Mode Switcher: Calendar vs History */}
            <div className="inline-flex items-center bg-white/10 p-1 rounded-xl border border-white/15">
              <button
                type="button"
                onClick={() => setViewMode('calendar')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'calendar'
                    ? 'bg-white text-blue-800 shadow-xs'
                    : 'text-white/90 hover:bg-white/10'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>ปฏิทินแผนวิ่ง</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('history')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'history'
                    ? 'bg-white text-blue-800 shadow-xs'
                    : 'text-white/90 hover:bg-white/10'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>ประวัติการตั้งค่า</span>
                {routeScheduleHistory.length > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                      viewMode === 'history'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-400 text-slate-900'
                    }`}
                  >
                    {routeScheduleHistory.length}
                  </span>
                )}
              </button>
            </div>

            {sheetsConnected && onRefreshRouteSchedules && (
              <button
                type="button"
                onClick={handleRefreshFromSheet}
                disabled={isRefreshingHistory}
                className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors cursor-pointer border border-white/15 disabled:opacity-60"
                title="ซิงค์แผนและประวัติล่าสุดจาก Google Sheets"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingHistory ? 'animate-spin' : ''}`} />
                <span className="hidden md:inline">ซิงค์ Sheet</span>
              </button>
            )}

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

        {viewMode === 'history' ? (
          /* =========================================================================
              ROUTE SCHEDULE HISTORY VIEW (Google Sheets Audit Log)
             ========================================================================= */
          <>
            <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs shrink-0">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="ค้นหาวันที่, ชื่อสาย, ชื่อผู้แก้ไข หรือหมายเหตุ..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                />
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: 'all' as const, label: 'ทั้งหมด' },
                  { id: 'sales_self_switch' as const, label: 'พนักงานเปลี่ยนสายเอง' },
                  { id: 'daily' as const, label: 'ตั้งค่า/แก้ไขรายวัน' },
                  { id: 'monthly' as const, label: 'สร้าง/ล้างรายเดือน' },
                  { id: 'reset' as const, label: 'รีเซ็ตรอบปกติ' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setHistoryActionFilter(f.id)}
                    className={`px-2.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer border ${
                      historyActionFilter === f.id
                        ? f.id === 'sales_self_switch'
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-4 py-2 bg-indigo-50/60 border-b border-indigo-100/80 flex items-center justify-between flex-wrap gap-2 text-xs text-indigo-900 shrink-0">
              <span className="font-semibold flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-indigo-600" />
                <span>
                  แสดงประวัติ <strong className="font-bold">{filteredHistoryEntries.length}</strong> จากทั้งหมด{' '}
                  <strong className="font-bold">{routeScheduleHistory.length}</strong> รายการ
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                {sheetsConnected ? (
                  <BrandLogo brand="google-sheets" className="w-3.5 h-3.5 text-[#34A853] shrink-0" />
                ) : (
                  <Cloud className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <span>
                  {sheetsConnected
                    ? 'บันทึกอัตโนมัติลง Google Sheets (แท็บ DailyRouteSchedules & RouteScheduleHistory)'
                    : 'โหมดออฟไลน์ (เก็บในเครื่อง)'}
                </span>
              </span>
            </div>

            <div className="p-3 sm:p-4 overflow-y-auto flex-1 bg-slate-100/70 space-y-2.5">
              {filteredHistoryEntries.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2">
                  <History className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">ยังไม่มีประวัติการตั้งค่าเส้นทาง</p>
                  <p className="text-xs text-slate-500">
                    เมื่อมีการกำหนดสายรายวัน สร้างแผนรายเดือน หรือพนักงานกดเปลี่ยนสายเอง ระบบจะบันทึกประวัติไว้ที่นี่และซิงค์ลง Google Sheets อัตโนมัติ
                  </p>
                </div>
              ) : (
                filteredHistoryEntries.map((entry, idx) => {
                  const isSelfSwitch = entry.actionType === 'sales_self_switch';
                  const isResetOrClear =
                    entry.actionType === 'reset_default' || entry.actionType === 'clear_monthly';
                  const isMonthly = entry.actionType === 'batch_monthly';

                  return (
                    <div
                      key={`${entry.id}-${idx}`}
                      className={`bg-white p-3.5 rounded-2xl border shadow-2xs space-y-2 ${
                        isSelfSwitch ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                              isSelfSwitch
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : isResetOrClear
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : isMonthly
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            {isSelfSwitch && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                            <span>{getRouteScheduleActionLabelThai(entry.actionType)}</span>
                          </span>

                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                            <CalendarIcon className="w-3 h-3 text-slate-500" />
                            <span>{formatHistoryTargetDate(entry.targetDate)}</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                            <User className="w-3 h-3 text-slate-400" />
                            <span>{entry.changedBy}</span>
                            {entry.changedByRole && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 uppercase">
                                {entry.changedByRole}
                              </span>
                            )}
                          </span>
                          <span className="font-mono text-slate-400">
                            {formatHistoryTimestamp(entry.timestamp)}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-2 bg-slate-50 rounded-xl p-2.5 border border-slate-200/70 text-xs">
                        <div className="min-w-0">
                          <div className="text-[10px] font-semibold text-slate-400 mb-0.5">สายเดิม</div>
                          <div className="text-slate-600 font-medium break-words">
                            {entry.previousRouteNames || '-'}
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 hidden sm:block shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[10px] font-semibold text-blue-600 mb-0.5">สายใหม่</div>
                          <div className="text-slate-900 font-bold break-words">
                            {entry.newRouteNames || '-'}
                          </div>
                        </div>
                      </div>

                      {entry.notes && (
                        <div className="text-[11px] text-slate-600 flex items-start gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span>{entry.notes}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
        <>
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

          {/* Sales rep selector (Admin & Manager can switch; Sales locked to own routes) */}
          {canViewAllRoutes ? (
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
          ) : (
            <div className="flex items-center gap-1.5 bg-blue-50/90 px-3 py-1.5 rounded-2xl border border-blue-200 shadow-2xs">
              <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="text-blue-600 font-semibold whitespace-nowrap">เซลล์:</span>
              <span className="font-bold text-blue-900 whitespace-nowrap">{currentUser?.name}</span>
              <span className="text-[10px] font-semibold text-blue-700 bg-white/80 px-1.5 py-0.5 rounded-md border border-blue-200">
                เฉพาะสายของฉัน
              </span>
            </div>
          )}

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
                            {metrics?.hasSelfSwitch ? (
                              <span
                                className="inline-flex items-center text-amber-600"
                                title="พนักงานกดเปลี่ยนสายเอง (เช็คอินจะขึ้นสถานะไม่ตรงสาย)"
                              >
                                <AlertTriangle className="w-3 h-3" />
                              </span>
                            ) : isCustom ? (
                              <span
                                className="w-2 h-2 rounded-full bg-amber-500"
                                title="กำหนดสายด้วยตัวเองสำหรับวันนี้"
                              />
                            ) : null}
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
                            <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                              <Users className="w-3 h-3 shrink-0" />
                              <span>{metrics?.plannedCount || 0}</span>
                            </span>

                            {(metrics?.completedCount || 0) > 0 && (
                              <span className="inline-flex items-center gap-0.5 font-bold text-emerald-700 bg-emerald-50 px-1 rounded text-[9px]">
                                <Check className="w-2.5 h-2.5 shrink-0" />
                                <span>{metrics?.completedCount}</span>
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
        </>
        )}

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
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <p className="text-xs text-blue-100 font-medium">
                      {formatThaiDate(editingDateStr, { withDayOfWeek: true, shortMonth: false })}
                    </p>
                    {isSingleSalesView && effectiveSelectedSales && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/15 border border-white/25 text-[11px] font-bold text-amber-200">
                        <User className="w-3 h-3" />
                        <span>เซลล์: {effectiveSelectedSales}</span>
                      </span>
                    )}
                  </div>
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
                  {isSingleSalesView && effectiveSelectedSales
                    ? `เลือกสายของ ${effectiveSelectedSales} (${editingRouteIds.length}/${editorRoutes.length} สาย):`
                    : `เลือกสายส่งที่ต้องการวิ่งในวันนี้ (${editingRouteIds.length} สาย):`}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditingRouteIds(editorRoutes.map((r) => r.id))}
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
                      const defIds = editorRoutes
                        .filter((r) => doesRouteRunOnDay(r, thaiDay))
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
                {editorRoutes.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 text-slate-500 text-center">
                    {isSingleSalesView && effectiveSelectedSales
                      ? `ยังไม่มีสายการเข้าเยี่ยมที่กำหนดให้ ${effectiveSelectedSales}`
                      : 'ยังไม่มีข้อมูลสายส่งในระบบ สามารถเพิ่มสายส่งได้ที่เมนู "จัดการสายส่ง (Routes)"'}
                  </div>
                ) : (
                  editorRoutes.map((route, idx) => {
                    const isChecked = editingRouteIds.includes(route.id);
                    const palette = getRouteColor(route.id || idx);
                    const customerCountInRoute = scopedCustomers.filter((c) => isCustomerInRoute(c, route)).length;

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

                        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-xl shrink-0">
                          <Users className="w-3 h-3 shrink-0" />
                          <span>{customerCountInRoute} ร้าน</span>
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
                    {scopedCustomers.filter((c) =>
                      editorRoutes
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
