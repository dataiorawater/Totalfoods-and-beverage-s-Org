import { Route, Customer, StaffUser } from '../types';

export const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'] as const;
export type ThaiDay = typeof THAI_DAYS[number];

export const THAI_DAY_COLORS: Record<ThaiDay, { bg: string; text: string; border: string; ring: string }> = {
  'อาทิตย์': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', ring: 'ring-rose-500' },
  'จันทร์': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', ring: 'ring-amber-500' },
  'อังคาร': { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', ring: 'ring-pink-500' },
  'พุธ': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', ring: 'ring-emerald-500' },
  'พฤหัสบดี': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', ring: 'ring-orange-500' },
  'ศุกร์': { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', ring: 'ring-sky-500' },
  'เสาร์': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', ring: 'ring-purple-500' },
};

/**
 * Returns current day of week in Thai (e.g. 'จันทร์', 'อังคาร')
 */
export function getTodayThaiDay(): ThaiDay {
  const dayIdx = new Date().getDay();
  return THAI_DAYS[dayIdx];
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
  // Try inferring from name or notes (e.g. "S01-R01 (จันทร์)", "สายบางนา-จันทร์/พฤหัส")
  const fromName = extractDaysFromText(route.name || '');
  if (fromName.length > 0) return fromName;

  const fromNotes = extractDaysFromText(route.notes || '');
  if (fromNotes.length > 0) return fromNotes;

  return [];
}

/**
 * Checks if a route runs on a specific day
 */
export function doesRouteRunOnDay(route: Route, targetDay: ThaiDay): boolean {
  const days = getRouteVisitDays(route);
  if (days.includes(targetDay)) return true;

  // Fallback: check if route ID or name contains the day text directly
  const combined = `${route.id || ''} ${route.name || ''} ${route.notes || ''}`.toLowerCase();
  return combined.includes(targetDay.toLowerCase());
}

/**
 * Checks if a route belongs to a salesperson
 */
export function doesRouteBelongToSales(route: Route, salesIdentifier?: string): boolean {
  if (!salesIdentifier || salesIdentifier === 'all') return true;
  const cleanTarget = salesIdentifier.trim().toLowerCase();

  const rSales = (route.salesrepName || '').trim().toLowerCase();
  const rId = (route.id || '').trim().toLowerCase();
  const rName = (route.name || '').trim().toLowerCase();

  // Exact or partial match on salesrepName or salespersonId
  if (rSales && (rSales.includes(cleanTarget) || cleanTarget.includes(rSales))) return true;
  if ((route as any).salespersonId && String((route as any).salespersonId).toLowerCase().includes(cleanTarget)) return true;

  // Prefix pattern e.g. "S01-R01" or "S01"
  if (rId.startsWith(cleanTarget) || rName.includes(cleanTarget)) return true;

  return false;
}

/**
 * Get all routes that belong to a salesperson and run on a given day
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
  if (!custRoute) return false;

  const rId = String(route.id || '').trim().toLowerCase();
  const rName = String(route.name || '').trim().toLowerCase();

  return (
    custRoute === rId ||
    custRoute === rName ||
    custRoute.includes(rId) ||
    rName.includes(custRoute) ||
    custRoute.includes(rName)
  );
}

/**
 * Checks if customer matches the daily call plan filter
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
  selectedSales?: string; // 'all' or salesperson name/id
  selectedRouteId?: string; // 'all' or specific route.id
  routes: Route[];
}): boolean {
  // 1. If explicit route selected
  if (selectedRouteId && selectedRouteId !== 'all') {
    const targetRoute = routes.find((r) => r.id === selectedRouteId);
    if (targetRoute) {
      return isCustomerInRoute(customer, targetRoute);
    }
    const custRoute = String(customer.routeName || '').toLowerCase();
    return custRoute.includes(selectedRouteId.toLowerCase());
  }

  // 2. Check if customer itself has visitDays matching targetDay
  if (Array.isArray(customer.visitDays) && customer.visitDays.length > 0) {
    if (customer.visitDays.includes(targetDay)) {
      if (!selectedSales || selectedSales === 'all') return true;
      return doesRouteBelongToSales({ id: '', name: customer.routeName || '', salesrepName: customer.salespersonName } as Route, selectedSales);
    }
  }

  // 3. Match against routes running on targetDay
  const matchingDailyRoutes = routes.filter((r) => {
    if (!doesRouteRunOnDay(r, targetDay)) return false;
    if (selectedSales && selectedSales !== 'all' && !doesRouteBelongToSales(r, selectedSales)) {
      return false;
    }
    return true;
  });

  // If daily routes found for this day & sales, check if customer is on any of them
  if (matchingDailyRoutes.length > 0) {
    return matchingDailyRoutes.some((r) => isCustomerInRoute(customer, r));
  }

  // Fallback: check if customer.routeName contains the target day name directly (e.g. "สายวันจันทร์")
  const custRoute = String(customer.routeName || '').toLowerCase();
  if (custRoute.includes(targetDay.toLowerCase())) {
    if (!selectedSales || selectedSales === 'all') return true;
    return custRoute.includes(selectedSales.toLowerCase());
  }

  return false;
}
