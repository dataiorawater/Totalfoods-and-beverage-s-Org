import { Route, Customer, StaffUser, DailyRouteSchedule, StoreCheckIn } from '../types';

export const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'] as const;
export type ThaiDay = typeof THAI_DAYS[number];

export const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
] as const;

export const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
] as const;

export const THAI_DAY_COLORS: Record<ThaiDay, { bg: string; text: string; border: string; ring: string; badge: string }> = {
  'อาทิตย์': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', ring: 'ring-rose-500', badge: 'bg-rose-500 text-white' },
  'จันทร์': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', ring: 'ring-amber-500', badge: 'bg-amber-500 text-white' },
  'อังคาร': { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', ring: 'ring-pink-500', badge: 'bg-pink-500 text-white' },
  'พุธ': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', ring: 'ring-emerald-500', badge: 'bg-emerald-500 text-white' },
  'พฤหัสบดี': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', ring: 'ring-orange-500', badge: 'bg-orange-500 text-white' },
  'ศุกร์': { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', ring: 'ring-sky-500', badge: 'bg-sky-500 text-white' },
  'เสาร์': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', ring: 'ring-purple-500', badge: 'bg-purple-500 text-white' },
};

export const ROUTE_COLOR_PALETTES = [
  { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500', hex: '#3B82F6' },
  { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500', hex: '#8B5CF6' },
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', hex: '#10B981' },
  { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500', hex: '#F59E0B' },
  { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', dot: 'bg-pink-500', hex: '#EC4899' },
  { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500', hex: '#06B6D4' },
  { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500', hex: '#6366F1' },
  { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500', hex: '#14B8A6' },
  { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500', hex: '#F97316' },
];

export function getRouteColor(identifier: string | number) {
  let hash = 0;
  const str = String(identifier || '');
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % ROUTE_COLOR_PALETTES.length;
  return ROUTE_COLOR_PALETTES[idx];
}

/**
 * Returns current date in 'YYYY-MM-DD'
 */
export function getTodayDateIso(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a Date object to 'YYYY-MM-DD'
 */
export function formatDateIso(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses 'YYYY-MM-DD' into local Date at 00:00:00
 */
export function parseIsoDate(iso: string): Date {
  if (!iso) return new Date();
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

/**
 * Returns day of week in Thai ('อาทิตย์', 'จันทร์', etc.) from Date or ISO date
 */
export function getThaiDayFromDate(dateInput: Date | string): ThaiDay {
  const date = typeof dateInput === 'string' ? parseIsoDate(dateInput) : dateInput;
  const dayIdx = date.getDay();
  return THAI_DAYS[dayIdx];
}

/**
 * Returns current day of week in Thai (e.g. 'จันทร์', 'อังคาร')
 */
export function getTodayThaiDay(): ThaiDay {
  const dayIdx = new Date().getDay();
  return THAI_DAYS[dayIdx];
}

/**
 * Formats date into Thai readable string (e.g. "วันอังคารที่ 20 ต.ค. 2569")
 */
export function formatThaiDate(
  dateInput: Date | string,
  options: { withDayOfWeek?: boolean; shortMonth?: boolean; yearBuddhist?: boolean } = {}
): string {
  const { withDayOfWeek = true, shortMonth = true, yearBuddhist = true } = options;
  const d = typeof dateInput === 'string' ? parseIsoDate(dateInput) : dateInput;
  if (isNaN(d.getTime())) return String(dateInput);

  const thaiDay = THAI_DAYS[d.getDay()];
  const dateNum = d.getDate();
  const monthName = shortMonth ? THAI_MONTHS_SHORT[d.getMonth()] : THAI_MONTHS[d.getMonth()];
  const yearNum = yearBuddhist ? d.getFullYear() + 543 : d.getFullYear();

  if (withDayOfWeek) {
    return `วัน${thaiDay}ที่ ${dateNum} ${monthName} ${yearNum}`;
  }
  return `${dateNum} ${monthName} ${yearNum}`;
}

/**
 * Normalizes day string or attempts to extract day from route name / text
 */
export function extractDaysFromText(text: string): ThaiDay[] {
  if (!text) return [];
  const clean = text.toLowerCase();
  const found: ThaiDay[] = [];

  for (const day of THAI_DAYS) {
    if (clean.includes(day.toLowerCase())) {
      found.push(day);
    }
  }

  // Also support short English days or abbreviations if any
  if (clean.includes('mon') && !found.includes('จันทร์')) found.push('จันทร์');
  if (clean.includes('tue') && !found.includes('อังคาร')) found.push('อังคาร');
  if (clean.includes('wed') && !found.includes('พุธ')) found.push('พุธ');
  if (clean.includes('thu') && !found.includes('พฤหัสบดี')) found.push('พฤหัสบดี');
  if (clean.includes('fri') && !found.includes('ศุกร์')) found.push('ศุกร์');
  if (clean.includes('sat') && !found.includes('เสาร์')) found.push('เสาร์');
  if (clean.includes('sun') && !found.includes('อาทิตย์')) found.push('อาทิตย์');

  return found;
}

/**
 * Resolves effective visit days for a route (from explicit visitDays or inferred from name/notes)
 */
export function getRouteVisitDays(route: Route): ThaiDay[] {
  if (Array.isArray(route.visitDays) && route.visitDays.length > 0) {
    return route.visitDays.filter((d): d is ThaiDay => THAI_DAYS.includes(d as ThaiDay));
  }
  const fromName = extractDaysFromText(route.name || '');
  if (fromName.length > 0) return fromName;

  const fromNotes = extractDaysFromText(route.notes || '');
  if (fromNotes.length > 0) return fromNotes;

  return [];
}

/**
 * Checks if a route runs on a specific day of week
 */
export function doesRouteRunOnDay(route: Route, targetDay: ThaiDay): boolean {
  const days = getRouteVisitDays(route);
  if (days.includes(targetDay)) return true;

  const combined = `${route.id || ''} ${route.name || ''} ${route.notes || ''}`.toLowerCase();
  return combined.includes(targetDay.toLowerCase());
}

/**
 * Checks if a route belongs to a salesperson
 */
export function doesRouteBelongToSales(route: Route, salesIdentifier?: string): boolean {
  if (salesIdentifier === undefined || salesIdentifier === 'all') return true;
  const cleanTarget = salesIdentifier.trim().toLowerCase();
  if (!cleanTarget) return false;

  const rSales = (route.salesrepName || '').trim().toLowerCase();
  const rSalesId = String((route as any).salespersonId || '').trim().toLowerCase();
  const rId = (route.id || '').trim().toLowerCase();
  const rName = (route.name || '').trim().toLowerCase();

  if (rSales && (rSales.includes(cleanTarget) || cleanTarget.includes(rSales))) return true;
  if (rSalesId && (rSalesId === cleanTarget || rSalesId.includes(cleanTarget))) return true;

  if (rId.startsWith(cleanTarget) || rName.includes(cleanTarget)) return true;

  return false;
}

/**
 * Strictly checks if a route belongs to a specific StaffUser (matching salespersonId, email, or name).
 * Returns false if user is missing or has no matching identifier.
 */
export function doesRouteBelongToUser(route: Route, user?: StaffUser | null): boolean {
  if (!user) return false;

  const userName = (user.name || '').trim().toLowerCase();
  const userId = (user.id || '').trim().toLowerCase();
  const userEmail = (user.email || '').trim().toLowerCase();

  const rSales = (route.salesrepName || '').trim().toLowerCase();
  const rSalesId = String(route.salespersonId || '').trim().toLowerCase();
  const rId = (route.id || '').trim().toLowerCase();
  const rName = (route.name || '').trim().toLowerCase();

  if (rSalesId) {
    if (userId && rSalesId === userId) return true;
    if (userEmail && rSalesId === userEmail) return true;
    if (userName && rSalesId === userName) return true;
  }

  if (userName) {
    if (rSales && (rSales === userName || rSales.includes(userName) || userName.includes(rSales))) {
      return true;
    }
    if (rId.startsWith(userName) || rName.includes(userName)) {
      return true;
    }
  }

  if (userId && rSales && rSales.includes(userId)) {
    return true;
  }

  return false;
}

/**
 * Checks if a customer belongs to a specific StaffUser via their assigned routes or direct salesperson assignment.
 */
export function isCustomerBelongingToUser(
  customer: Customer,
  user: StaffUser,
  userRoutes: Route[],
  allRoutes?: Route[]
): boolean {
  // 1. Direct match against any route owned by this user
  if (userRoutes.some((r) => isCustomerInRoute(customer, r))) {
    return true;
  }

  // 2. If allRoutes provided and customer belongs to a route owned by someone else, do not leak
  if (allRoutes && allRoutes.length > 0) {
    const matchedRoute = allRoutes.find((r) => isCustomerInRoute(customer, r));
    if (matchedRoute && (matchedRoute.salesrepName || matchedRoute.salespersonId)) {
      return false;
    }
  }

  // 3. Fallback to customer's own salespersonName when not attached to another rep's route
  const userName = (user.name || '').trim().toLowerCase();
  const custSales = (customer.salespersonName || '').trim().toLowerCase();
  if (userName && custSales) {
    return custSales === userName || custSales.includes(userName) || userName.includes(custSales);
  }

  return false;
}

/**
 * Checks if a store check-in record belongs to a specific StaffUser.
 */
export function doesCheckInBelongToUser(checkIn: StoreCheckIn, user?: StaffUser | null): boolean {
  if (!user) return false;
  const userId = (user.id || '').trim().toLowerCase();
  const userName = (user.name || '').trim().toLowerCase();

  const ciSalesId = String(checkIn.salespersonId || '').trim().toLowerCase();
  const ciSalesName = String(checkIn.salespersonName || '').trim().toLowerCase();

  if (userId && ciSalesId && ciSalesId === userId) return true;
  if (userName && ciSalesName) {
    return ciSalesName === userName || ciSalesName.includes(userName) || userName.includes(ciSalesName);
  }
  return false;
}

/**
 * Get all routes that belong to a salesperson and run on a given day of the week
 */
export function getSalesDailyRoutes(
  salesNameOrId: string | undefined,
  day: ThaiDay,
  routes: Route[]
): Route[] {
  return routes.filter((r) => {
    const matchesSales = doesRouteBelongToSales(r, salesNameOrId);
    const matchesDay = doesRouteRunOnDay(r, day);
    return matchesSales && matchesDay;
  });
}

/**
 * Matches a customer to a route
 */
export function isCustomerInRoute(customer: Customer, route: Route): boolean {
  const custRoute = String(customer.routeName || '').trim().toLowerCase();
  const custRouteId = String(customer.routeId || '').trim().toLowerCase();
  const rId = String(route.id || '').trim().toLowerCase();
  const rName = String(route.name || '').trim().toLowerCase();

  if (custRouteId && rId && custRouteId === rId) return true;
  if (!custRoute) return false;

  return (
    custRoute === rId ||
    custRoute === rName ||
    custRoute.includes(rId) ||
    rName.includes(custRoute) ||
    custRoute.includes(rName)
  );
}

/**
 * Resolves the effective list of routes running on a specific DATE.
 * - If user customized this specific date in dailySchedules (Simulated Calendar), uses that schedule.
 * - Otherwise, automatically falls back to default recurring weekly routes for that day of week!
 */
export function getEffectiveRoutesForDate({
  dateStr,
  dailySchedules,
  routes,
  selectedSales,
}: {
  dateStr: string;
  dailySchedules: Record<string, DailyRouteSchedule>;
  routes: Route[];
  selectedSales?: string;
}): Route[] {
  const schedule = dailySchedules[dateStr];
  let effectiveRoutes: Route[] = [];

  if (schedule && Array.isArray(schedule.routeIds)) {
    // Explicit user assignment for this date
    effectiveRoutes = routes.filter((r) => schedule.routeIds.includes(r.id) || schedule.routeIds.includes(r.name));
  } else {
    // Default fallback from recurring day of week
    const thaiDay = getThaiDayFromDate(dateStr);
    effectiveRoutes = routes.filter((r) => doesRouteRunOnDay(r, thaiDay));
  }

  // Filter by salesrep if specified
  if (selectedSales && selectedSales !== 'all') {
    effectiveRoutes = effectiveRoutes.filter((r) => doesRouteBelongToSales(r, selectedSales));
  }

  return effectiveRoutes;
}

/**
 * Checks if a customer is scheduled in the Call Plan for a specific calendar DATE
 */
export function isCustomerInDatePlan({
  customer,
  dateStr,
  dailySchedules,
  routes,
  selectedSales,
  selectedRouteId,
}: {
  customer: Customer;
  dateStr: string;
  dailySchedules: Record<string, DailyRouteSchedule>;
  routes: Route[];
  selectedSales?: string;
  selectedRouteId?: string;
}): boolean {
  const schedule = dailySchedules[dateStr];

  // 1. If explicit route filter selected
  if (selectedRouteId && selectedRouteId !== 'all') {
    const targetRoute = routes.find((r) => r.id === selectedRouteId);
    if (targetRoute) {
      return isCustomerInRoute(customer, targetRoute);
    }
    const custRoute = String(customer.routeName || '').toLowerCase();
    return custRoute.includes(selectedRouteId.toLowerCase());
  }

  // 2. If customer is explicitly marked as additional for this date
  if (customer.id && schedule?.additionalCustomerIds?.includes(customer.id)) {
    if (!selectedSales || selectedSales === 'all') return true;
    return customer.salespersonName === selectedSales;
  }

  // 3. Match against effective routes for this date
  const effectiveRoutes = getEffectiveRoutesForDate({
    dateStr,
    dailySchedules,
    routes,
    selectedSales,
  });

  if (effectiveRoutes.length > 0) {
    if (effectiveRoutes.some((r) => isCustomerInRoute(customer, r))) {
      return true;
    }
  }

  // 4. Fallback: check if customer itself has visitDays matching this day of week (if no explicit schedule override)
  if (!schedule) {
    const targetDay = getThaiDayFromDate(dateStr);
    if (Array.isArray(customer.visitDays) && customer.visitDays.includes(targetDay)) {
      if (!selectedSales || selectedSales === 'all') return true;
      return doesRouteBelongToSales({ id: '', name: customer.routeName || '', salesrepName: customer.salespersonName } as Route, selectedSales);
    }
  }

  return false;
}

/**
 * Legacy support for day of week filter
 */
export function isCustomerInDailyPlan({
  customer,
  targetDay,
  selectedSales,
  selectedRouteId,
  routes,
}: {
  customer: Customer;
  targetDay: ThaiDay;
  selectedSales?: string;
  selectedRouteId?: string;
  routes: Route[];
}): boolean {
  if (selectedRouteId && selectedRouteId !== 'all') {
    const targetRoute = routes.find((r) => r.id === selectedRouteId);
    if (targetRoute) {
      return isCustomerInRoute(customer, targetRoute);
    }
    const custRoute = String(customer.routeName || '').toLowerCase();
    return custRoute.includes(selectedRouteId.toLowerCase());
  }

  if (Array.isArray(customer.visitDays) && customer.visitDays.length > 0) {
    if (customer.visitDays.includes(targetDay)) {
      if (!selectedSales || selectedSales === 'all') return true;
      return doesRouteBelongToSales({ id: '', name: customer.routeName || '', salesrepName: customer.salespersonName } as Route, selectedSales);
    }
  }

  const matchingDailyRoutes = routes.filter((r) => {
    if (!doesRouteRunOnDay(r, targetDay)) return false;
    if (selectedSales && selectedSales !== 'all' && !doesRouteBelongToSales(r, selectedSales)) {
      return false;
    }
    return true;
  });

  if (matchingDailyRoutes.length > 0) {
    return matchingDailyRoutes.some((r) => isCustomerInRoute(customer, r));
  }

  const custRoute = String(customer.routeName || '').toLowerCase();
  if (custRoute.includes(targetDay.toLowerCase())) {
    if (!selectedSales || selectedSales === 'all') return true;
    return custRoute.includes(selectedSales.toLowerCase());
  }

  return false;
}

/**
 * Calendar Grid Generator for a given year & month (0-indexed)
 * Returns array of calendar weeks, each with 7 day cells
 */
export interface CalendarCellData {
  dateStr: string; // 'YYYY-MM-DD'
  date: Date;
  dayNumber: number;
  thaiDay: ThaiDay;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
}

export function generateCalendarGrid(year: number, monthIndex: number): CalendarCellData[][] {
  const firstDayOfMonth = new Date(year, monthIndex, 1);
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0);
  const totalDaysInMonth = lastDayOfMonth.getDate();

  // Day of week of 1st day (0 = Sunday, 1 = Monday ...)
  const startDayOfWeek = firstDayOfMonth.getDay();

  const todayStr = getTodayDateIso();
  const weeks: CalendarCellData[][] = [];
  let currentWeek: CalendarCellData[] = [];

  // Previous month trailing days
  const prevMonthLastDay = new Date(year, monthIndex, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = new Date(year, monthIndex - 1, prevMonthLastDay - i);
    const dateStr = formatDateIso(d);
    currentWeek.push({
      dateStr,
      date: d,
      dayNumber: d.getDate(),
      thaiDay: THAI_DAYS[d.getDay()],
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      isPast: dateStr < todayStr,
    });
  }

  // Current month days
  for (let day = 1; day <= totalDaysInMonth; day++) {
    const d = new Date(year, monthIndex, day);
    const dateStr = formatDateIso(d);
    currentWeek.push({
      dateStr,
      date: d,
      dayNumber: day,
      thaiDay: THAI_DAYS[d.getDay()],
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      isPast: dateStr < todayStr,
    });

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // Next month leading days to complete the 7-day row
  if (currentWeek.length > 0) {
    let nextMonthDay = 1;
    while (currentWeek.length < 7) {
      const d = new Date(year, monthIndex + 1, nextMonthDay++);
      const dateStr = formatDateIso(d);
      currentWeek.push({
        dateStr,
        date: d,
        dayNumber: d.getDate(),
        thaiDay: THAI_DAYS[d.getDay()],
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isPast: dateStr < todayStr,
      });
    }
    weeks.push(currentWeek);
  }

  return weeks;
}

/**
 * Automatically generates a month's daily route schedule based on recurring weekly route definitions
 */
export function generateMonthlyScheduleFromWeeklyTemplate(
  year: number,
  monthIndex: number,
  routes: Route[]
): Record<string, DailyRouteSchedule> {
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
  const generated: Record<string, DailyRouteSchedule> = {};

  for (let day = 1; day <= lastDayOfMonth; day++) {
    const d = new Date(year, monthIndex, day);
    const dateStr = formatDateIso(d);
    const thaiDay = THAI_DAYS[d.getDay()];

    const matchingRoutes = routes.filter((r) => doesRouteRunOnDay(r, thaiDay));
    if (matchingRoutes.length > 0) {
      generated[dateStr] = {
        date: dateStr,
        routeIds: matchingRoutes.map((r) => r.id),
        notes: `รอบวิ่งประจำวัน${thaiDay}`,
        updatedAt: new Date().toISOString(),
      };
    }
  }

  return generated;
}
