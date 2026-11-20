import React, { useState, useMemo, useEffect } from 'react';
import {
  UserPlus,
  Users,
  Search,
  Phone,
  User,
  MapPin,
  Navigation,
  ExternalLink,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  PlusCircle,
  Clock,
  Sparkles,
  ShoppingBag,
  Building,
  Copy,
  Check,
  Calendar,
  Camera,
  Filter,
  CheckCircle,
} from 'lucide-react';
import { Customer, StaffUser, Route } from '../types';
import {
  THAI_DAYS,
  ThaiDay,
  THAI_DAY_COLORS,
  getTodayThaiDay,
  isCustomerInDailyPlan,
  isCustomerInRoute,
  doesRouteRunOnDay,
  doesRouteBelongToSales,
  doesRouteBelongToUser,
  getSalesDailyRoutes,
} from '../utils/callPlanUtils';

interface CustomerManagementViewProps {
  customers: Customer[];
  currentUser: StaffUser;
  routes: Route[];
  staffList?: StaffUser[];
  onManageRoutes: () => void;
  onSaveCustomer: (customer: {
    id?: string;
    name: string;
    phone: string;
    address: string;
    mapsUrl: string;
    routeName?: string;
    visitDays?: string[];
  }) => Promise<boolean>;
  onRefreshCustomers: () => Promise<void>;
  onOpenOrderForCustomer: (customer: Customer) => void;
  onNavigateToCheckIn?: (customer: Customer) => void;
  sheetsConnected: boolean;
}

export const CustomerManagementView: React.FC<CustomerManagementViewProps> = ({
  customers,
  currentUser,
  routes,
  staffList = [],
  onManageRoutes,
  onSaveCustomer,
  onRefreshCustomers,
  onOpenOrderForCustomer,
  onNavigateToCheckIn,
  sheetsConnected,
}) => {
  const todayThai = useMemo(() => getTodayThaiDay(), []);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [routeName, setRouteName] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [visitDays, setVisitDays] = useState<ThaiDay[]>([]);

  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Call Plan & Daily Route Filters (default to 'all' so customer directory & search work immediately across all customers)
  const [filterMode, setFilterMode] = useState<'today' | 'all' | 'by_route' | 'by_day'>('all');
  const [selectedDay, setSelectedDay] = useState<ThaiDay>(todayThai);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('all');
  const [selectedSales, setSelectedSales] = useState<string>(
    currentUser?.role === 'sales' ? currentUser.name : 'all'
  );

  // Search & Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [visibleCustomerCount, setVisibleCustomerCount] = useState<number>(25);

  useEffect(() => {
    setVisibleCustomerCount(25);
  }, [searchQuery, filterMode, selectedDay, selectedRouteId, selectedSales]);

  // Role-based route scoping: admin & manager see all routes; other roles see only their own routes
  const canViewAllRoutes = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const scopedRoutes = useMemo(() => {
    const filtered = canViewAllRoutes
      ? routes
      : routes.filter((r) => doesRouteBelongToUser(r, currentUser));
    return [...filtered].sort((a, b) => {
      const idCmp = String(a.id || '').localeCompare(String(b.id || ''), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      if (idCmp !== 0) return idCmp;
      return String(a.name || '').localeCompare(String(b.name || ''), 'th');
    });
  }, [canViewAllRoutes, routes, currentUser]);

  useEffect(() => {
    if (!canViewAllRoutes && !editingId && routeName && !scopedRoutes.some((r) => r.name === routeName)) {
      setRouteName('');
    }
  }, [canViewAllRoutes, editingId, routeName, scopedRoutes]);

  useEffect(() => {
    if (!canViewAllRoutes && selectedRouteId !== 'all' && !scopedRoutes.some((r) => r.id === selectedRouteId)) {
      setSelectedRouteId('all');
    }
  }, [canViewAllRoutes, selectedRouteId, scopedRoutes]);

  // Unique sales reps list for filter dropdown
  const salesOptions = useMemo(() => {
    const names = new Set<string>();
    routes.forEach((r) => {
      if (r.salesrepName) names.add(r.salesrepName);
    });
    staffList.forEach((s) => {
      if (s.name && (s.role === 'sales' || s.role === 'staff')) names.add(s.name);
    });
    if (currentUser?.name) names.add(currentUser.name);
    return Array.from(names);
  }, [routes, staffList, currentUser]);

  // Target day being viewed
  const currentViewDay = filterMode === 'today' ? todayThai : selectedDay;

  // Active routes running on target day
  const dailyRoutesForView = useMemo(() => {
    return routes.filter((r) => {
      const runsToday = doesRouteRunOnDay(r, currentViewDay);
      const matchesSales = doesRouteBelongToSales(r, selectedSales);
      return runsToday && matchesSales;
    });
  }, [routes, currentViewDay, selectedSales]);

  // Customer count for today's plan
  const todayPlanCount = useMemo(() => {
    return customers.filter((c) =>
      isCustomerInDailyPlan({
        customer: c,
        targetDay: todayThai,
        selectedSales: currentUser?.role === 'sales' ? currentUser.name : selectedSales,
        routes,
      })
    ).length;
  }, [customers, todayThai, selectedSales, currentUser, routes]);

  // Robust search matcher across customer fields (prevents empty digit string from matching all customers)
  const matchesCustomerSearch = (c: Customer, query: string): boolean => {
    const q = query.trim().toLowerCase();
    if (!q) return true;

    const tokens = q.split(/\s+/).filter(Boolean);
    const nameStr = String(c?.name || '').toLowerCase();
    const addrStr = String(c?.address || '').toLowerCase();
    const routeStr = String(c?.routeName || '').toLowerCase();
    const routeIdStr = String(c?.routeId || '').toLowerCase();
    const salesStr = String(c?.salespersonName || '').toLowerCase();
    const notesStr = String(c?.notes || '').toLowerCase();
    const phoneRaw = String(c?.phone || '').toLowerCase();
    const phoneDigits = phoneRaw.replace(/[^0-9]/g, '');

    return tokens.every((token) => {
      const tokenDigits = token.replace(/[^0-9]/g, '');
      const matchesText =
        nameStr.includes(token) ||
        addrStr.includes(token) ||
        routeStr.includes(token) ||
        routeIdStr.includes(token) ||
        salesStr.includes(token) ||
        notesStr.includes(token) ||
        phoneRaw.includes(token);
      const matchesDigits = tokenDigits.length > 0 && phoneDigits.includes(tokenDigits);
      return matchesText || matchesDigits;
    });
  };

  // Count matches across all customers when searching
  const allSearchMatchedCount = useMemo(() => {
    if (!customers || customers.length === 0) return 0;
    if (!searchQuery.trim()) return customers.length;
    return customers.filter((c) => matchesCustomerSearch(c, searchQuery)).length;
  }, [customers, searchQuery]);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    if (!customers || customers.length === 0) return [];

    let list = customers;

    // Apply Call Plan / Route Filter
    if (filterMode === 'today') {
      list = list.filter((c) =>
        isCustomerInDailyPlan({
          customer: c,
          targetDay: todayThai,
          selectedSales,
          routes,
        })
      );
    } else if (filterMode === 'by_day') {
      list = list.filter((c) =>
        isCustomerInDailyPlan({
          customer: c,
          targetDay: selectedDay,
          selectedSales,
          routes,
        })
      );
    } else if (filterMode === 'by_route') {
      if (selectedRouteId && selectedRouteId !== 'all') {
        const targetRoute = routes.find((r) => r.id === selectedRouteId);
        list = list.filter((c) => (targetRoute ? isCustomerInRoute(c, targetRoute) : false));
      }
    }

    // Text search
    if (searchQuery.trim()) {
      list = list.filter((c) => matchesCustomerSearch(c, searchQuery));
    }

    return list;
  }, [customers, filterMode, todayThai, selectedDay, selectedSales, selectedRouteId, routes, searchQuery]);

  // GPS Capture
  const handleCaptureGPS = () => {
    if (!navigator.geolocation) {
      setErrorMsg('เบราว์เซอร์ไม่รองรับการจับพิกัด GPS');
      return;
    }

    setIsLocating(true);
    setErrorMsg(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const generatedUrl = `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
        setMapsUrl(generatedUrl);
        setIsLocating(false);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setIsLocating(false);
        setErrorMsg('ไม่สามารถจับพิกัด GPS ได้ กรุณาเปิดสิทธิ์ Location หรือวางลิ้งก์จาก Google Maps');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Update selected route in form
  const handleRouteChange = (newRouteName: string) => {
    setRouteName(newRouteName);
  };

  // Submit New / Edited Customer
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanName = String(name || '').trim();
    const cleanPhone = String(phone || '').trim();
    const cleanRouteName = String(routeName || '').trim();
    const cleanAddress = String(address || '').trim();
    const cleanMapsUrl = String(mapsUrl || '').trim();

    if (!cleanName) {
      setErrorMsg('กรุณากรอกชื่อลูกค้า');
      return;
    }

    if (!cleanPhone) {
      setErrorMsg('กรุณากรอกเบอร์โทรศัพท์ลูกค้า');
      return;
    }
    if (!cleanRouteName) {
      setErrorMsg('กรุณาระบุสายการเข้าเยี่ยม');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onSaveCustomer({
        id: editingId || undefined,
        name: cleanName,
        phone: cleanPhone,
        address: cleanAddress,
        mapsUrl: cleanMapsUrl,
        routeName: cleanRouteName,
        visitDays,
      });

      if (success) {
        setSuccessMsg(
          editingId
            ? `อัปเดตข้อมูลลูกค้า "${cleanName}" สำเร็จแล้ว!`
            : `บันทึกลูกค้า "${cleanName}" ลงระบบเรียบร้อยแล้ว!`
        );
        // Reset form
        setEditingId(null);
        setName('');
        setPhone('');
        setAddress('');
        setRouteName('');
        setMapsUrl('');
        setVisitDays([]);
      } else {
        setErrorMsg('ไม่สามารถบันทึกข้อมูลลูกค้าได้ กรุณาตรวจสอบการเชื่อมต่อ');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูลลูกค้า');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Refresh Customer List
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshCustomers();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Fill form with existing customer to edit
  const handleEditClick = (c: Customer) => {
    setEditingId(c.id || null);
    setName(String(c.name || ''));
    setPhone(String(c.phone || ''));
    setAddress(String(c.address || ''));
    setRouteName(String(c.routeName || ''));
    setMapsUrl(String(c.mapsUrl || ''));
    setVisitDays((c.visitDays || []) as ThaiDay[]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName('');
    setPhone('');
    setAddress('');
    setRouteName('');
    setMapsUrl('');
    setVisitDays([]);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  return (
    <div className="space-y-6">
      {/* Main Grid: Form on Left/Top + List on Right/Bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form to Add New Customer */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden sticky top-20">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                <h3 className="font-bold text-sm sm:text-base">
                  {editingId ? 'แก้ไขข้อมูลลูกค้า' : 'ฟอร์มเพิ่มลูกค้าใหม่'}
                </h3>
              </div>
              {editingId ? (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-xs bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  ยกเลิกการแก้ไข
                </button>
              ) : (
                <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-medium">
                  Call Plan & โลเคชั่น
                </span>
              )}
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Messages */}
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-600" />
                  <span className="font-medium">{successMsg}</span>
                </div>
              )}

              {/* 1. Customer Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ชื่อลูกค้า / ชื่อร้านค้า <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="เช่น คุณสมศักดิ์ หรือ ร้านกาแฟสุขใจ"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-2xs"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* 2. Customer Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  เบอร์โทรศัพท์ <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    placeholder="เช่น 081-234-5678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-2xs"
                  />
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Route */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    สายการเข้าเยี่ยม (Route) <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={onManageRoutes}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                  >
                    + ตั้งค่าสาย
                  </button>
                </div>
                <div className="relative">
                  <select
                    value={routeName}
                    onChange={(e) => handleRouteChange(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-2xs appearance-none"
                  >
                    <option value="" disabled>
                      {scopedRoutes.length === 0
                        ? '-- ยังไม่มีสายการเข้าเยี่ยมที่กำหนดให้คุณ --'
                        : '-- โปรดระบุสายการเข้าเยี่ยม --'}
                    </option>
                    {editingId && routeName && !scopedRoutes.some((r) => r.name === routeName) && (
                      <option value={routeName}>{routeName}</option>
                    )}
                    {scopedRoutes.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.id ? `${r.id} - ` : ''}{r.name}{r.salesrepName ? ` • ${r.salesrepName}` : ''}
                      </option>
                    ))}
                  </select>
                  <Navigation className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>
                {!canViewAllRoutes && scopedRoutes.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    ยังไม่มีสายการเข้าเยี่ยมที่ผูกกับบัญชีของคุณ กรุณาติดต่อผู้ดูแลระบบหรือผู้จัดการฝ่ายขาย
                  </p>
                )}
              </div>

              {/* 3. Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ที่อยู่จัดส่ง
                </label>
                <div className="relative">
                  <textarea
                    rows={2}
                    placeholder="เลขที่ อาคาร ซอย ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-2xs resize-none"
                  />
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* 4. Location Link */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    ลิ้งก์โลเคชั่น (Google Maps Link)
                  </label>
                  <button
                    type="button"
                    onClick={handleCaptureGPS}
                    disabled={isLocating}
                    className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-0.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Navigation className={`w-3 h-3 ${isLocating ? 'animate-spin' : ''}`} />
                    <span>{isLocating ? 'กำลังจับพิกัด...' : 'จับพิกัด GPS'}</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="url"
                    placeholder="เช่น https://maps.app.goo.gl/... หรือ https://maps.google.com/?q=..."
                    value={mapsUrl}
                    onChange={(e) => setMapsUrl(e.target.value)}
                    className="w-full pl-9 pr-16 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-2xs"
                  />
                  <MapPin className="w-4 h-4 text-blue-600 absolute left-3 top-2.5 pointer-events-none" />

                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute right-2 top-1.5 px-2 py-1 text-[10px] font-medium text-blue-700 bg-blue-100/80 hover:bg-blue-200 rounded-md flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>เปิดดู</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex items-center gap-2">
                {editingId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="flex-1 py-2.5 px-3 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer ${
                    editingId
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                  } disabled:opacity-50`}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>{editingId ? 'บันทึกการแก้ไข' : 'บันทึกลงระบบ'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Customer Database Directory */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Call Plan Filter Toolbar Card */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
            
            {/* Top row: Mode Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setFilterMode('today')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                    filterMode === 'today'
                      ? 'bg-blue-600 text-white ring-2 ring-blue-600/30'
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                  }`}
                >
                  <span>⭐ สายเข้าเยี่ยมวันนี้ (วัน{todayThai})</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    filterMode === 'today' ? 'bg-white text-blue-700' : 'bg-blue-200 text-blue-900'
                  }`}>
                    {todayPlanCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    filterMode === 'all'
                      ? 'bg-slate-800 text-white ring-2 ring-slate-800/30 shadow-2xs font-bold'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>ลูกค้าทั้งหมด</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    filterMode === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {customers.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterMode('by_route')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    filterMode === 'by_route'
                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-600/30 shadow-2xs font-bold'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>ตามสายส่ง</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterMode('by_day')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    filterMode === 'by_day'
                      ? 'bg-indigo-600 text-white ring-2 ring-indigo-600/30 shadow-2xs font-bold'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>ตามวันในสัปดาห์</span>
                </button>
              </div>

              {/* Action buttons (Manage Routes, Refresh) */}
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={onManageRoutes}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer"
                  title="ตั้งค่าสายการเข้าเยี่ยมและวันในสัปดาห์"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>ตั้งค่าสาย</span>
                </button>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  title="รีเฟรชข้อมูลลูกค้าจากฐานข้อมูล"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{isRefreshing ? 'กำลังดึง...' : 'รีเฟรช'}</span>
                </button>
              </div>
            </div>

            {/* Sub-Filters: Salesperson & Specific Route / Day selectors (shown when filtering by plan/route/day) */}
            {filterMode !== 'all' && (
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2.5">
                
                {/* Sales Rep Selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">เซลล์ผู้ดูแล:</span>
                  <select
                    value={selectedSales}
                    onChange={(e) => setSelectedSales(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 font-medium text-slate-700 focus:bg-white"
                  >
                    <option value="all">ทั้งหมด (ทุกเซลล์)</option>
                    {salesOptions.map((s) => (
                      <option key={s} value={s}>
                        {s} {currentUser?.name === s ? '(คุณ)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* By Route Dropdown */}
                {filterMode === 'by_route' && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">เลือกสาย:</span>
                    <select
                      value={selectedRouteId}
                      onChange={(e) => setSelectedRouteId(e.target.value)}
                      className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-2.5 py-1 font-semibold focus:bg-white"
                    >
                      <option value="all">
                        {canViewAllRoutes ? 'ทุกสายการเข้าเยี่ยม' : 'ทุกสายการเข้าเยี่ยมของฉัน'}
                      </option>
                      {scopedRoutes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.id ? `${r.id} - ` : ''}{r.name}{r.salesrepName ? ` • ${r.salesrepName}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* By Day Pills Selector */}
                {filterMode === 'by_day' && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap mr-0.5">เลือกวัน:</span>
                    {THAI_DAYS.map((day) => {
                      const isCurrent = selectedDay === day;
                      const colors = THAI_DAY_COLORS[day];
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setSelectedDay(day)}
                          className={`px-2 py-0.5 text-xs rounded-md border font-semibold transition-all cursor-pointer ${
                            isCurrent
                              ? `${colors.bg} ${colors.text} ${colors.border} ring-2 ${colors.ring}`
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Daily Call Plan Banner Status */}
            {(filterMode === 'today' || filterMode === 'by_day') && (
              <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                dailyRoutesForView.length > 0
                  ? 'bg-blue-50/70 border-blue-200 text-blue-900'
                  : 'bg-amber-50/70 border-amber-200 text-amber-900'
              }`}>
                <div className="space-y-0.5 text-xs">
                  <div className="font-bold flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5 text-blue-600" />
                    <span>
                      แผนเข้าเยี่ยมประจำวัน{currentViewDay} {filterMode === 'today' ? '(วันนี้)' : ''}:
                    </span>
                    {dailyRoutesForView.length > 0 ? (
                      <span className="font-semibold text-blue-700">
                        {dailyRoutesForView.map(r => `${r.name} (${r.id})`).join(', ')}
                      </span>
                    ) : (
                      <span className="font-normal text-amber-700">ยังไม่มีสายที่ผูกกับวันนี้</span>
                    )}
                  </div>
                  <div className="text-[11px] opacity-80">
                    เป้าหมายเข้าเยี่ยม: <span className="font-bold">{filteredCustomers.length}</span> ร้านค้า
                    {selectedSales !== 'all' && ` • เฉพาะเซลล์: ${selectedSales}`}
                  </div>
                </div>

                {dailyRoutesForView.length === 0 && (
                  <button
                    type="button"
                    onClick={onManageRoutes}
                    className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 rounded-lg font-bold cursor-pointer shrink-0"
                  >
                    ตั้งค่าสาย
                  </button>
                )}
              </div>
            )}

            {/* Search Input */}
            <div className="space-y-1.5">
              <div className="relative">
                <input
                  id="customer-search-input"
                  type="text"
                  aria-label="ค้นหาลูกค้า"
                  placeholder="ค้นหาชื่อร้านค้า, เบอร์โทร, สาย หรือที่อยู่..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-9 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-800 placeholder:text-slate-400"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="ล้างคำค้นหา"
                    className="w-6 h-6 flex items-center justify-center rounded-full text-xs text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer font-bold transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>

              {searchQuery.trim() && filterMode !== 'all' && allSearchMatchedCount > filteredCustomers.length && (
                <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
                  <span>
                    พบทั้งหมด <strong>{allSearchMatchedCount}</strong> รายในฐานข้อมูลลูกค้า (แสดงเฉพาะในตัวกรองนี้ {filteredCustomers.length} ราย)
                  </span>
                  <button
                    type="button"
                    onClick={() => setFilterMode('all')}
                    className="font-bold text-blue-700 hover:text-blue-900 underline shrink-0 cursor-pointer"
                  >
                    ค้นหาจากลูกค้าทั้งหมด
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Customer Cards List */}
          {filteredCustomers.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-200/80 shadow-xs text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">
                  {searchQuery.trim()
                    ? `ไม่พบรายชื่อลูกค้าที่ตรงกับ "${searchQuery.trim()}"`
                    : filterMode === 'today'
                    ? `ไม่มีรายชื่อลูกค้าในสายเข้าเยี่ยมวัน${todayThai}`
                    : 'ไม่พบรายชื่อลูกค้าตามเงื่อนไขที่เลือก'}
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  {searchQuery.trim()
                    ? filterMode !== 'all' && allSearchMatchedCount > 0
                      ? `พบ ${allSearchMatchedCount} รายในฐานข้อมูลลูกค้าทั้งหมด กดปุ่มด้านล่างเพื่อแสดงผลการค้นหาจากลูกค้าทั้งหมด`
                      : 'ลองปรับคำค้นหาใหม่อีกครั้ง หรือล้างคำค้นหา'
                    : filterMode === 'today'
                    ? `ยังไม่มีลูกค้าที่ผูกกับสายที่เข้าเยี่ยมในวัน${todayThai} คุณสามารถกดดู "ลูกค้าทั้งหมด" หรือกด "ตั้งค่าสาย" เพื่อกำหนดวันเข้าเยี่ยม`
                    : 'สามารถกรอกฟอร์มด้านซ้ายเพื่อเพิ่มลูกค้าใหม่ หรือเลือกดูตัวกรองอื่น'}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                {searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    ล้างคำค้นหา
                  </button>
                )}
                {filterMode !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setFilterMode('all')}
                    className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    {searchQuery.trim() && allSearchMatchedCount > 0
                      ? `ดูผลค้นหาในลูกค้าทั้งหมด (${allSearchMatchedCount} ราย)`
                      : `ดูรายชื่อลูกค้าทั้งหมด (${customers.length} ร้าน)`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onManageRoutes}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  จัดการสายการเข้าเยี่ยม
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 px-1 font-medium">
                <span>
                  แสดง {Math.min(visibleCustomerCount, filteredCustomers.length)} จาก {filteredCustomers.length} รายการ
                </span>
                {filterMode === 'today' && (
                  <span className="text-blue-600 font-semibold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    สายเข้าเยี่ยมวัน{todayThai}
                  </span>
                )}
              </div>

              {filteredCustomers.slice(0, visibleCustomerCount).map((cust, idx) => {
                const isTodayPlan = isCustomerInDailyPlan({
                  customer: cust,
                  targetDay: todayThai,
                  routes,
                });

                return (
                  <div
                    key={cust.id || cust?.name + cust.phone + idx}
                    className={`content-auto bg-white rounded-2xl p-4 border transition-all group ${
                      isTodayPlan && filterMode !== 'today'
                        ? 'border-blue-300 ring-1 ring-blue-500/10 shadow-xs'
                        : 'border-slate-200/80 shadow-xs hover:border-blue-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      {/* Left: Customer Info */}
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">
                            {cust?.name}
                          </span>
                          
                          {cust.routeName && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                              <Navigation className="w-2.5 h-2.5" />
                              <span>{cust.routeName}</span>
                            </span>
                          )}

                          {isTodayPlan && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <span>⭐ นัดเยี่ยมวันนี้</span>
                            </span>
                          )}

                          <a
                            href={`tel:${cust.phone}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{cust.phone}</span>
                          </a>
                        </div>

                        {/* Customer visit days badges */}
                        {cust.visitDays && cust.visitDays.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-[10px] text-slate-400">วันเข้าเยี่ยม:</span>
                            {cust.visitDays.map((d) => (
                              <span
                                key={d}
                                className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                                  d === todayThai
                                    ? 'bg-blue-600 text-white font-bold'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {d}
                              </span>
                            ))}
                          </div>
                        )}

                        {cust.address && (
                          <div className="flex items-start gap-1.5 text-xs text-slate-600">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{cust.address}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(cust.address, `addr-${idx}`)}
                              title="คัดลอกที่อยู่"
                              className="text-slate-400 hover:text-slate-600 shrink-0 ml-1 cursor-pointer"
                            >
                              {copiedId === `addr-${idx}` ? (
                                <Check className="w-3 h-3 text-blue-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        )}

                        <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                          {cust.mapsUrl && (
                            <a
                              href={cust.mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>เปิดแผนที่ Google Maps</span>
                            </a>
                          )}

                          {cust.updatedAt && (
                            <span className="flex items-center gap-1 text-slate-400">
                              <Clock className="w-3 h-3" />
                              <span>อัปเดต: {cust.updatedAt}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1.5 sm:self-center shrink-0 flex-wrap">
                        
                        {/* Check-In Action Button */}
                        {onNavigateToCheckIn && (
                          <button
                            type="button"
                            onClick={() => onNavigateToCheckIn(cust)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
                            title="ไปที่หน้าเช็คอินร้านค้านี้ทันที"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>เช็คอิน</span>
                          </button>
                        )}

                        {/* Open Order Button */}
                        <button
                          type="button"
                          onClick={() => onOpenOrderForCustomer(cust)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                          title="เปิดฟอร์มลงออเดอร์ให้ลูกค้ารายนี้ทันที"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>เปิดออเดอร์</span>
                        </button>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => handleEditClick(cust)}
                          className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-blue-700 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-xl transition-colors cursor-pointer"
                          title="นำข้อมูลไปแก้ไขในฟอร์ม"
                        >
                          แก้ไข
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredCustomers.length > visibleCustomerCount && (
                <button
                  type="button"
                  onClick={() => setVisibleCustomerCount((prev) => prev + 25)}
                  className="w-full py-3 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs sm:text-sm transition-colors shadow-2xs flex items-center justify-center gap-2 cursor-pointer mt-3"
                >
                  <span>แสดงรายชื่อเพิ่มเติม (+25 จากทั้งหมด {filteredCustomers.length} ราย)</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
