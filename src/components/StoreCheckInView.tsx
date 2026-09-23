import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  MapPin,
  Camera,
  Navigation,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  Phone,
  Building2,
  AlertCircle,
  FileSpreadsheet,
  X,
  Upload,
  Calendar,
  Sparkles,
  ShoppingBag,
  Eye,
  Check,
  Filter,
  User,
} from 'lucide-react';
import { Customer, StaffUser, StoreCheckIn, Route } from '../types';
import { calculateDistanceMeters, formatDistance, extractCustomerCoords, compressImageFile } from '../utils/geoUtils';
import {
  THAI_DAYS,
  ThaiDay,
  THAI_DAY_COLORS,
  getTodayThaiDay,
  isCustomerInDailyPlan,
  isCustomerInRoute,
  doesRouteRunOnDay,
  doesRouteBelongToSales,
  getSalesDailyRoutes,
} from '../utils/callPlanUtils';

interface StoreCheckInViewProps {
  customers: Customer[];
  checkIns: StoreCheckIn[];
  currentUser: StaffUser;
  routes?: Route[];
  staffList?: StaffUser[];
  onSaveCheckIn: (checkIn: StoreCheckIn) => Promise<boolean>;
  onOpenOrderForCustomer?: (customer: Customer) => void;
  onManageRoutes?: () => void;
  preselectedCustomerForCheckIn?: Customer | null;
  onClearPreselectedCustomer?: () => void;
  sheetsConnected: boolean;
  onRefreshSheets?: () => Promise<void>;
}

export const StoreCheckInView: React.FC<StoreCheckInViewProps> = ({
  customers,
  checkIns,
  currentUser,
  routes = [],
  staffList = [],
  onSaveCheckIn,
  onOpenOrderForCustomer,
  onManageRoutes,
  preselectedCustomerForCheckIn,
  onClearPreselectedCustomer,
  sheetsConnected,
  onRefreshSheets,
}) => {
  // 1. Geolocation State
  const [currentLat, setCurrentLat] = useState<number | null>(null);
  const [currentLng, setCurrentLng] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [lastLocationUpdateTime, setLastLocationUpdateTime] = useState<string>('');

  // 2. Call Plan & Daily Route Filter State
  type CallPlanFilterMode = 'today' | 'all' | 'by_route' | 'by_day';
  const [callPlanMode, setCallPlanMode] = useState<CallPlanFilterMode>('today');
  const [selectedDay, setSelectedDay] = useState<ThaiDay>(getTodayThaiDay());
  const [selectedRouteId, setSelectedRouteId] = useState<string>('all');
  const [selectedSales, setSelectedSales] = useState<string>(
    currentUser.role === 'sales' ? currentUser.name : 'all'
  );
  const [visitStatusFilter, setVisitStatusFilter] = useState<'all' | 'unvisited' | 'visited'>('all');

  // Search & Range Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [distanceFilter, setDistanceFilter] = useState<'all' | 'near500m' | 'near2km' | 'near5km'>('all');
  const [activeSubTab, setActiveSubTab] = useState<'checkin' | 'history'>('checkin');

  // 3. Active Check-in Modal / Form State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customStoreName, setCustomStoreName] = useState('');
  const [customStorePhone, setCustomStorePhone] = useState('');
  const [customStoreAddress, setCustomStoreAddress] = useState('');
  const [isCustomStore, setIsCustomStore] = useState(false);
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);

  // 4. Check-in Form Inputs
  const [photoDataUrl, setPhotoDataUrl] = useState<string>('');
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [visitPurpose, setVisitPurpose] = useState<string>('เยี่ยมเยียนประจำรอบ');
  const [visitNote, setVisitNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [checkInSuccessToast, setCheckInSuccessToast] = useState<string | null>(null);

  // 5. Full-size photo viewer
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState<string | null>(null);
  const [visibleHistoryCount, setVisibleHistoryCount] = useState<number>(20);

  // 6. Check-ins History (Provided from props)

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Request GPS Location
  const requestCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('เบราว์เซอร์นี้ไม่รองรับระบบตรวจจับตำแหน่ง GPS');
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const acc = Math.round(position.coords.accuracy);

        setCurrentLat(lat);
        setCurrentLng(lng);
        setAccuracy(acc);
        setIsLocating(false);
        setLastLocationUpdateTime(
          new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );
      },
      (error) => {
        setIsLocating(false);
        let errorMsg = 'ไม่สามารถดึงตำแหน่ง GPS ได้';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'กรุณากด "อนุญาต" สิทธิ์การเข้าถึงตำแหน่ง (GPS) บนเบราว์เซอร์หรืออุปกรณ์ของคุณ';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = 'สัญญาณดาวเทียมหรือเครือข่ายตำแหน่งไม่พร้อมใช้งานในขณะนี้';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = 'หมดเวลาในการค้นหาสัญญาณ GPS กรุณากดลองใหม่อีกครั้ง';
        }
        setLocationError(errorMsg);

        // Fallback default coordinates if never detected (Bangkok default coordinates for preview)
        if (currentLat === null) {
          setCurrentLat(13.7563);
          setCurrentLng(100.5018);
          setAccuracy(15);
          setLastLocationUpdateTime('ค่าจำลองพิกัด');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 10000,
      }
    );
  };

  // Initial GPS fetch on mount
  useEffect(() => {
    requestCurrentLocation();
  }, []);

  // Save check-ins to localStorage whenever updated
  useEffect(() => {
    localStorage.setItem('iora_checkins', JSON.stringify(checkIns));
  }, [checkIns]);

  // Compute stores sorted by distance from current GPS
  const storesWithDistance = useMemo(() => {
    return customers.map((c) => {
      const coords = extractCustomerCoords(c);
      let distanceMeters: number | undefined = undefined;

      if (currentLat !== null && currentLng !== null && coords) {
        distanceMeters = calculateDistanceMeters(currentLat, currentLng, coords.lat, coords.lng);
      }

      return {
        customer: c,
        coords,
        distanceMeters,
      };
    }).sort((a, b) => {
      if (a.distanceMeters !== undefined && b.distanceMeters !== undefined) {
        return a.distanceMeters - b.distanceMeters;
      }
      if (a.distanceMeters !== undefined) return -1;
      if (b.distanceMeters !== undefined) return 1;
      return a.customer.name.localeCompare(b.customer.name, 'th');
    });
  }, [customers, currentLat, currentLng]);

  // Call Plan & Daily Route Calculations
  const todayThai = useMemo(() => getTodayThaiDay(), []);
  const currentViewDay = callPlanMode === 'today' ? todayThai : selectedDay;

  // Sales rep filter options
  const salesOptions = useMemo(() => {
    if (staffList && staffList.length > 0) {
      return staffList.filter((s) => s.role === 'sales' || s.role === 'manager').map((s) => s.name);
    }
    const salesSet = new Set<string>();
    routes.forEach((r) => {
      if (r.salesrepName) salesSet.add(r.salesrepName);
    });
    customers.forEach((c) => {
      if (c.salespersonName) salesSet.add(c.salespersonName);
    });
    return Array.from(salesSet);
  }, [staffList, routes, customers]);

  // Routes active on the currently selected/viewed day
  const dailyRoutesForView = useMemo(() => {
    return getSalesDailyRoutes(selectedSales, currentViewDay, routes);
  }, [routes, currentViewDay, selectedSales]);

  // Track check-ins performed TODAY
  const todayCheckInStatus = useMemo(() => {
    const checkedCustomerIds = new Set<string>();
    const checkedStoreNames = new Set<string>();
    const now = new Date();
    const todayDateString = now.toDateString();

    checkIns.forEach((ci) => {
      let isToday = false;
      if (ci.createdAt) {
        const d = new Date(ci.createdAt);
        if (!isNaN(d.getTime()) && d.toDateString() === todayDateString) {
          isToday = true;
        }
      }
      if (!isToday && ci.timestampStr) {
        const todayDayNum = now.getDate().toString();
        if (ci.timestampStr.includes(todayDayNum)) {
          isToday = true;
        }
      }
      if (isToday) {
        if (ci.customerId) checkedCustomerIds.add(ci.customerId);
        if (ci.storeName) checkedStoreNames.add(ci.storeName.trim().toLowerCase());
      }
    });

    return { checkedCustomerIds, checkedStoreNames };
  }, [checkIns]);

  const isCustomerCheckedInToday = (cust: Customer) => {
    if (cust.id && todayCheckInStatus.checkedCustomerIds.has(cust.id)) return true;
    if (cust.name && todayCheckInStatus.checkedStoreNames.has(cust.name.trim().toLowerCase())) return true;
    return false;
  };

  // Stats: Planned for today & Completed today
  const { todayPlanCount, todayCompletedCount } = useMemo(() => {
    let plan = 0;
    let completed = 0;
    customers.forEach((c) => {
      if (isCustomerInDailyPlan({ customer: c, targetDay: todayThai, selectedSales, routes })) {
        plan++;
        if (isCustomerCheckedInToday(c)) {
          completed++;
        }
      }
    });
    return { todayPlanCount: plan, todayCompletedCount: completed };
  }, [customers, todayThai, selectedSales, routes, todayCheckInStatus]);

  // Handle preselected customer from Customer Management view
  useEffect(() => {
    if (preselectedCustomerForCheckIn) {
      const match = storesWithDistance.find(
        (s) => s.customer.id === preselectedCustomerForCheckIn.id || s.customer.name === preselectedCustomerForCheckIn.name
      );
      if (match) {
        handleOpenCheckInForCustomer(match);
      } else {
        handleOpenCheckInForCustomer({ customer: preselectedCustomerForCheckIn });
      }
      if (onClearPreselectedCustomer) {
        onClearPreselectedCustomer();
      }
    }
  }, [preselectedCustomerForCheckIn, storesWithDistance]);

  // Filtered stores
  const filteredStores = useMemo(() => {
    return storesWithDistance.filter(({ customer, distanceMeters }) => {
      // 1. Text search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = customer.name ? String(customer.name).toLowerCase().includes(query) : false;
        const matchesPhone = customer.phone ? String(customer.phone).toLowerCase().includes(query) : false;
        const matchesAddr = customer.address ? String(customer.address).toLowerCase().includes(query) : false;
        const matchesRoute = customer.routeName ? String(customer.routeName).toLowerCase().includes(query) : false;
        if (!matchesName && !matchesPhone && !matchesAddr && !matchesRoute) return false;
      }

      // 2. Call Plan Filter
      if (callPlanMode === 'today') {
        const inPlan = isCustomerInDailyPlan({
          customer,
          targetDay: todayThai,
          selectedSales,
          routes,
        });
        if (!inPlan) return false;
      } else if (callPlanMode === 'by_day') {
        const inPlan = isCustomerInDailyPlan({
          customer,
          targetDay: selectedDay,
          selectedSales,
          routes,
        });
        if (!inPlan) return false;
      } else if (callPlanMode === 'by_route') {
        if (selectedRouteId !== 'all') {
          const targetRoute = routes.find((r) => r.id === selectedRouteId);
          if (!targetRoute || !isCustomerInRoute(customer, targetRoute)) return false;
        }
        if (selectedSales !== 'all') {
          const matchedRoute = routes.find(
            (r) => r.id === customer.routeId || r.name === customer.routeName || isCustomerInRoute(customer, r)
          );
          const belongs =
            (matchedRoute && doesRouteBelongToSales(matchedRoute, selectedSales)) ||
            customer.salespersonName === selectedSales;
          if (!belongs) return false;
        }
      } else if (callPlanMode === 'all') {
        if (selectedSales !== 'all') {
          const matchedRoute = routes.find(
            (r) => r.id === customer.routeId || r.name === customer.routeName || isCustomerInRoute(customer, r)
          );
          const belongs =
            customer.salespersonName === selectedSales ||
            (matchedRoute && doesRouteBelongToSales(matchedRoute, selectedSales));
          if (!belongs) return false;
        }
      }

      // 3. Visit status filter
      const hasCheckedIn = isCustomerCheckedInToday(customer);
      if (visitStatusFilter === 'unvisited' && hasCheckedIn) {
        return false;
      }
      if (visitStatusFilter === 'visited' && !hasCheckedIn) {
        return false;
      }

      // 4. Distance filter
      if (distanceFilter === 'near500m') {
        return distanceMeters !== undefined && distanceMeters <= 500;
      }
      if (distanceFilter === 'near2km') {
        return distanceMeters !== undefined && distanceMeters <= 2000;
      }
      if (distanceFilter === 'near5km') {
        return distanceMeters !== undefined && distanceMeters <= 5000;
      }
      return true;
    });
  }, [
    storesWithDistance,
    searchQuery,
    callPlanMode,
    todayThai,
    selectedDay,
    selectedRouteId,
    selectedSales,
    routes,
    visitStatusFilter,
    distanceFilter,
    todayCheckInStatus,
  ]);

  // Start Check-in for an existing customer
  const handleOpenCheckInForCustomer = (item: { customer: Customer; distanceMeters?: number }) => {
    setSelectedCustomer(item.customer);
    setIsCustomStore(false);
    setPhotoDataUrl('');
    setVisitPurpose('เยี่ยมเยียนประจำรอบ');
    setVisitNote('');
    setFormError(null);
    setIsCheckInModalOpen(true);
  };

  // Start Check-in for a custom / new store
  const handleOpenCustomCheckIn = () => {
    setSelectedCustomer(null);
    setIsCustomStore(true);
    setCustomStoreName('');
    setCustomStorePhone('');
    setCustomStoreAddress('');
    setPhotoDataUrl('');
    setVisitPurpose('เปิดร้านค้าใหม่');
    setVisitNote('');
    setFormError(null);
    setIsCheckInModalOpen(true);
  };

  // Handle Image Selection / Photo Capture
  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingPhoto(true);
    setFormError(null);
    try {
      const compressedDataUrl = await compressImageFile(file, 1000, 1000, 0.75);
      setPhotoDataUrl(compressedDataUrl);
    } catch (err: any) {
      setFormError(err?.message || 'ไม่สามารถประมวลผลไฟล์รูปภาพได้');
    } finally {
      setIsCompressingPhoto(false);
      // Reset input value so same file can be chosen again if needed
      e.target.value = '';
    }
  };

  // Submit Check-in
  const handleSubmitCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Mandatory Photo Check
    if (!photoDataUrl) {
      setFormError('กรุณาถ่ายรูปหรือแนบภาพหน้าร้านก่อนการกดบันทึกเช็คอิน');
      return;
    }

    // 2. Mandatory Store Name Check
    const storeName = isCustomStore ? customStoreName.trim() : String(selectedCustomer?.name || '').trim();
    if (!storeName) {
      setFormError('กรุณาระบุชื่อร้านค้า');
      return;
    }

    // 3. GPS Coordinates Check
    const lat = currentLat || 13.7563;
    const lng = currentLng || 100.5018;

    setIsSubmitting(true);
    setFormError(null);

    try {
      const now = new Date();
      const timestampStr = now.toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      // Calculate distance if known customer
      let distanceMeters: number | undefined = undefined;
      if (selectedCustomer) {
        const coords = extractCustomerCoords(selectedCustomer);
        if (coords) {
          distanceMeters = calculateDistanceMeters(lat, lng, coords.lat, coords.lng);
        }
      }

      const newCheckIn: StoreCheckIn = {
        id: `CHK-${Date.now().toString().slice(-6)}`,
        createdAt: now.toISOString(),
        timestampStr,
        customerId: selectedCustomer?.id,
        storeName,
        customerPhone: isCustomStore ? customStorePhone.trim() : String(selectedCustomer?.phone || ''),
        address: isCustomStore ? customStoreAddress.trim() : String(selectedCustomer?.address || ''),
        salespersonId: currentUser.id,
        salespersonName: currentUser.name,
        latitude: lat,
        longitude: lng,
        accuracy: accuracy || undefined,
        mapsUrl: `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`,
        photoUrl: photoDataUrl,
        notes: visitNote.trim() ? `${visitPurpose} - ${visitNote.trim()}` : visitPurpose,
        distanceMeters,
        syncedToSheets: false,
      };

      // Save locally & to Sheets
      const synced = await onSaveCheckIn(newCheckIn);
      if (synced) {
        newCheckIn.syncedToSheets = true;
      }

      setIsCheckInModalOpen(false);
      setCheckInSuccessToast(`บันทึกเช็คอินร้าน "${storeName}" สำเร็จเรียบร้อย!`);
      setTimeout(() => setCheckInSuccessToast(null), 4000);
    } catch (err: any) {
      setFormError(err?.message || 'เกิดข้อผิดพลาดในการบันทึกเช็คอิน');
    } finally {
      setIsSubmitting(false);
    }
  };

  const todayCheckIns = useMemo(() => {
    const today = new Date();
    return checkIns.filter((c) => {
      const d = new Date(c.createdAt);
      if (isNaN(d.getTime())) return false;
      return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    });
  }, [checkIns]);

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {checkInSuccessToast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-700 text-white px-4 py-3 rounded-2xl shadow-xl border border-emerald-500 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-200 max-w-md">
          <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
          <div className="text-xs font-semibold">{checkInSuccessToast}</div>
          <button
            type="button"
            onClick={() => setCheckInSuccessToast(null)}
            className="text-emerald-200 hover:text-white ml-auto"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & GPS Status Banner */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shadow-2xs">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                เช็คอินร้านค้า (Store Check-in)
              </h1>
              <p className="text-xs text-slate-500">
                ค้นหาร้านค้าใกล้เคียงตามระยะทาง GPS บันทึกเวลา พิกัด และถ่ายภาพหน้าร้าน
              </p>
            </div>
          </div>

          {/* Sub-tab Navigation */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl self-start sm:self-auto border border-slate-200/60">
            <button
              id="subtab-checkin-search"
              type="button"
              onClick={() => setActiveSubTab('checkin')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'checkin'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>ค้นหาร้านเช็คอิน</span>
            </button>
            <button
              id="subtab-checkin-history"
              type="button"
              onClick={() => setActiveSubTab('history')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'history'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>ประวัติเช็คอิน</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-800 font-bold">
                {checkIns.length}
              </span>
            </button>
          </div>
        </div>

        {/* GPS Live Bar */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  currentLat ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span className="font-bold text-slate-800">
                {currentLat ? 'เชื่อมต่อสัญญาณ GPS แล้ว' : 'กำลังค้นหาสัญญาณ GPS...'}
              </span>
            </div>

            {currentLat && currentLng && (
              <span className="font-mono text-[11px] text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                📍 {currentLat.toFixed(5)}, {currentLng.toFixed(5)}
                {accuracy ? ` (ความแม่นยำ ±${accuracy} ม.)` : ''}
              </span>
            )}

            {lastLocationUpdateTime && (
              <span className="text-slate-400 text-[11px]">
                อัปเดตล่าสุด: {lastLocationUpdateTime}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto flex-wrap">
            <button
              id="btn-refresh-gps"
              type="button"
              onClick={requestCurrentLocation}
              disabled={isLocating}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
              title="กดเพื่อตรวจจับตำแหน่งปัจจุบันใหม่อีกครั้ง"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isLocating ? 'animate-spin' : ''}`} />
              <span>{isLocating ? 'กำลังค้นหาพิกัด...' : 'รีเฟรชพิกัด GPS'}</span>
            </button>

            <button
              id="btn-custom-store-checkin"
              type="button"
              onClick={handleOpenCustomCheckIn}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs transition-colors cursor-pointer shadow-2xs"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>+ เช็คอินร้านใหม่</span>
            </button>
          </div>
        </div>

        {locationError && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">{locationError}</span>
              <button
                type="button"
                onClick={requestCurrentLocation}
                className="ml-2 underline font-bold text-amber-900 cursor-pointer"
              >
                ลองใหม่อีกครั้ง
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          TAB 1: CHECK IN SEARCH & NEARBY STORES LIST
         ========================================================================= */}
      {activeSubTab === 'checkin' && (
        <div className="space-y-3">
          {/* =========================================================================
              DAILY ROUTE & CALL PLAN FILTER TOOLBAR
             ========================================================================= */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            {/* Row 1: Mode Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-xs font-bold text-slate-800">
                  สายเข้าเยี่ยมของเซลล์ (Call Plan / Route):
                </span>
              </div>

              {/* Mode Buttons */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
                <button
                  type="button"
                  onClick={() => setCallPlanMode('today')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs whitespace-nowrap ${
                    callPlanMode === 'today'
                      ? 'bg-blue-600 text-white shadow-blue-500/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>สายเข้าเยี่ยมวันนี้ (วัน{todayThai})</span>
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      callPlanMode === 'today' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {todayPlanCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCallPlanMode('all')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs whitespace-nowrap ${
                    callPlanMode === 'all'
                      ? 'bg-blue-600 text-white shadow-blue-500/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>ร้านค้าทั้งหมด</span>
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      callPlanMode === 'all' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {customers.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCallPlanMode('by_route')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs whitespace-nowrap ${
                    callPlanMode === 'by_route'
                      ? 'bg-blue-600 text-white shadow-blue-500/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>ตามสายส่ง</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCallPlanMode('by_day')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs whitespace-nowrap ${
                    callPlanMode === 'by_day'
                      ? 'bg-blue-600 text-white shadow-blue-500/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>ตามวันประจำรอบ</span>
                </button>
              </div>
            </div>

            {/* Row 2: Secondary Selectors (Salesperson, Route, Day, Visit Status) */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                {/* Sales rep selector */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl">
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap">เซลล์:</span>
                  <select
                    value={selectedSales}
                    onChange={(e) => setSelectedSales(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                  >
                    <option value="all">ทุกคน (All Sales)</option>
                    {salesOptions.map((sales) => (
                      <option key={sales} value={sales}>
                        {sales}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Route Selector (when in by_route mode) */}
                {callPlanMode === 'by_route' && (
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl">
                    <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap">สายส่ง:</span>
                    <select
                      value={selectedRouteId}
                      onChange={(e) => setSelectedRouteId(e.target.value)}
                      className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer max-w-[180px] truncate"
                    >
                      <option value="all">ทุกสายส่ง</option>
                      {routes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} {r.salesrepName ? `(${r.salesrepName})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Day selector (when in by_day mode) */}
                {callPlanMode === 'by_day' && (
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                    {THAI_DAYS.map((day) => {
                      const isDaySelected = selectedDay === day;
                      const dayColor = THAI_DAY_COLORS[day];
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setSelectedDay(day)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                            isDaySelected
                              ? `${dayColor.bg} ${dayColor.text} ${dayColor.border} border ring-2 ring-blue-500/20`
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {day}
                          {day === todayThai && <span className="ml-1 text-[10px] text-blue-600 font-extrabold">(วันนี้)</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Visit Status Filter (All / Not visited / Visited) */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setVisitStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    visitStatusFilter === 'all'
                      ? 'bg-white text-slate-800 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  ทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={() => setVisitStatusFilter('unvisited')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    visitStatusFilter === 'unvisited'
                      ? 'bg-white text-amber-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  ⏳ ยังไม่เช็คอิน
                </button>
                <button
                  type="button"
                  onClick={() => setVisitStatusFilter('visited')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    visitStatusFilter === 'visited'
                      ? 'bg-white text-emerald-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  ✓ เช็คอินแล้ว
                </button>
              </div>
            </div>

            {/* Daily Call Plan Progress & Summary Banner */}
            {(callPlanMode === 'today' || callPlanMode === 'by_day') && (
              <div className="mt-2 p-3 rounded-xl bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-blue-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      สายเข้าเยี่ยม{callPlanMode === 'today' ? 'ประจำวันนี้' : `ประจำวัน${selectedDay}`}:
                    </span>

                    {dailyRoutesForView.length > 0 ? (
                      dailyRoutesForView.map((r) => (
                        <span
                          key={r.id}
                          className="px-2 py-0.5 bg-white border border-blue-200 text-blue-800 rounded-lg text-[11px] font-bold shadow-2xs"
                        >
                          🚩 {r.name} {r.salesrepName ? `(${r.salesrepName})` : ''}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-500 italic">
                        ยังไม่มีสายส่งที่กำหนดวิ่งในวัน{currentViewDay}
                      </span>
                    )}
                  </div>

                  {callPlanMode === 'today' && (
                    <div className="text-[11px] text-slate-600 flex items-center gap-2">
                      <span>
                        เป้าหมายวันนี้: <strong className="text-blue-700">{todayPlanCount}</strong> ร้าน | เช็คอินแล้ว:{' '}
                        <strong className="text-emerald-700">{todayCompletedCount}</strong> ร้าน
                      </span>
                    </div>
                  )}
                </div>

                {/* Progress bar or Route settings button */}
                <div className="flex items-center gap-3">
                  {callPlanMode === 'today' && todayPlanCount > 0 && (
                    <div className="w-full sm:w-32 flex flex-col gap-1">
                      <div className="flex justify-between text-[10px] font-bold text-slate-600">
                        <span>ความคืบหน้า</span>
                        <span>{Math.round((todayCompletedCount / todayPlanCount) * 100)}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, Math.round((todayCompletedCount / todayPlanCount) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {onManageRoutes && (
                    <button
                      type="button"
                      onClick={onManageRoutes}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border border-blue-200 text-blue-700 text-xs font-semibold cursor-pointer whitespace-nowrap shadow-2xs"
                    >
                      จัดการสายส่ง/เข้าเยี่ยม
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Search Bar & Distance Filter */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                id="search-nearby-stores"
                type="text"
                placeholder="ค้นหาร้านค้า, สายส่ง, เบอร์โทร..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Range Filters */}
            <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto no-scrollbar pb-0.5">
              <button
                type="button"
                onClick={() => setDistanceFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  distanceFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ทุกระยะทาง
              </button>
              <button
                type="button"
                onClick={() => setDistanceFilter('near500m')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  distanceFilter === 'near500m'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ใกล้มาก (&lt; 500 ม.)
              </button>
              <button
                type="button"
                onClick={() => setDistanceFilter('near2km')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  distanceFilter === 'near2km'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ใกล้เคียง (&lt; 2 กม.)
              </button>
              <button
                type="button"
                onClick={() => setDistanceFilter('near5km')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  distanceFilter === 'near5km'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                รัศมี 5 กม.
              </button>
            </div>
          </div>

          {/* Store List Sorted by Distance & Filtered by Daily Route */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredStores.length === 0 ? (
              <div className="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200/80 space-y-2">
                <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">ไม่พบร้านค้าตามเงื่อนไขที่เลือก</p>
                <p className="text-xs text-slate-500">
                  {callPlanMode === 'today'
                    ? `ไม่มีร้านค้าที่กำหนดรอบเข้าเยี่ยมสำหรับวัน${todayThai} หรือเข้าเยี่ยมครบแล้ว`
                    : 'คุณสามารถปรับตัวกรอง หรือกดปุ่ม "+ เช็คอินร้านใหม่" ด้านบนเพื่อเช็คอินร้านค้าทันที'}
                </p>
                {callPlanMode === 'today' && (
                  <button
                    type="button"
                    onClick={() => setCallPlanMode('all')}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                  >
                    <span>ดูร้านค้าทั้งหมด</span>
                  </button>
                )}
              </div>
            ) : (
              filteredStores.map(({ customer, coords, distanceMeters }) => {
                const isVeryClose = distanceMeters !== undefined && distanceMeters <= 100;
                const isClose = distanceMeters !== undefined && distanceMeters <= 1000;
                const hasCheckedInToday = isCustomerCheckedInToday(customer);
                const isScheduledToday = isCustomerInDailyPlan({
                  customer,
                  targetDay: todayThai,
                  selectedSales: 'all',
                  routes,
                });

                return (
                  <div
                    key={customer.id || customer.name + customer.phone}
                    className={`bg-white p-3.5 sm:p-4 rounded-2xl border transition-all shadow-2xs flex flex-col justify-between gap-3 ${
                      hasCheckedInToday
                        ? 'border-emerald-200 bg-emerald-50/10'
                        : isVeryClose
                        ? 'border-emerald-300 ring-2 ring-emerald-500/20 bg-emerald-50/20'
                        : isClose
                        ? 'border-blue-200/90 hover:border-blue-300'
                        : 'border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      {/* Top row: Name, Route Badge, Visit Status & Distance */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-bold text-slate-900 leading-snug">
                              {customer.name}
                            </span>

                            {/* Today visit scheduled badge */}
                            {isScheduledToday && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                                <span>สายวันนี้</span>
                              </span>
                            )}

                            {/* Today Checked-in status badge */}
                            {hasCheckedInToday ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                <span>เช็คอินแล้ววันนี้</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                <Clock className="w-2.5 h-2.5 text-slate-400" />
                                <span>รอเข้าเยี่ยม</span>
                              </span>
                            )}
                          </div>

                          {/* Route & Salesperson */}
                          <div className="flex items-center gap-2 text-xs text-slate-600 mt-1 flex-wrap">
                            {customer.routeName && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                <MapPin className="w-2.5 h-2.5" />
                                {customer.routeName}
                              </span>
                            )}
                            {customer.salespersonName && (
                              <span className="text-[11px] text-slate-500">
                                เซลล์: {customer.salespersonName}
                              </span>
                            )}
                          </div>

                          {customer.phone && (
                            <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{customer.phone}</span>
                            </div>
                          )}

                          {customer.address && (
                            <div className="flex items-start gap-1 text-xs text-slate-500 mt-1">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                              <span className="line-clamp-2 leading-relaxed">{customer.address}</span>
                            </div>
                          )}
                        </div>

                        {/* Distance Badge */}
                        <div className="shrink-0 text-right">
                          {distanceMeters !== undefined ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold shadow-2xs ${
                                isVeryClose
                                  ? 'bg-emerald-600 text-white ring-2 ring-emerald-300/50'
                                  : isClose
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              <Navigation className="w-3 h-3" />
                              <span>{formatDistance(distanceMeters)}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                              ไม่มีพิกัด
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        {customer.mapsUrl && (
                          <a
                            href={customer.mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-blue-700 hover:bg-blue-50 transition-colors"
                          >
                            <Navigation className="w-3 h-3" />
                            <span>นำทาง</span>
                          </a>
                        )}

                        {customer.phone && (
                          <a
                            href={`tel:${customer.phone}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                          >
                            <Phone className="w-3 h-3" />
                            <span>โทร</span>
                          </a>
                        )}

                        {onOpenOrderForCustomer && (
                          <button
                            type="button"
                            onClick={() => onOpenOrderForCustomer(customer)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <ShoppingBag className="w-3 h-3" />
                            <span>ลงออเดอร์</span>
                          </button>
                        )}
                      </div>

                      {/* Check-in Action Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenCheckInForCustomer({ customer, distanceMeters })}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer active:scale-95 ${
                          hasCheckedInToday
                            ? 'bg-slate-100 hover:bg-slate-200 text-emerald-800 border border-emerald-300'
                            : isVeryClose
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-500/30'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>{hasCheckedInToday ? 'เช็คอินอีกครั้ง' : 'เช็คอินหน้าร้าน'}</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: CHECK IN HISTORY
         ========================================================================= */}
      {activeSubTab === 'history' && (
        <div className="space-y-3">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs text-slate-500">เช็คอินวันนี้</span>
              <div className="text-xl font-black text-blue-700 mt-0.5">
                {todayCheckIns.length} ครั้ง
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs text-slate-500">เช็คอินทั้งหมด</span>
              <div className="text-xl font-black text-slate-800 mt-0.5">
                {checkIns.length} ครั้ง
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs col-span-2 sm:col-span-1">
              <span className="text-xs text-slate-500">พนักงานขาย</span>
              <div className="text-xs font-bold text-slate-800 mt-1 truncate">
                {currentUser.name}
              </div>
            </div>
          </div>

          {/* History List */}
          {checkIns.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-2xl border border-slate-200/80 space-y-2">
              <Clock className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">ยังไม่มีประวัติการเช็คอิน</p>
              <p className="text-xs text-slate-500">
                เริ่มเช็คอินร้านค้าแรกเพื่อบันทึกพิกัด GPS และรูปถ่ายหน้าร้าน
              </p>
              <button
                type="button"
                onClick={() => setActiveSubTab('checkin')}
                className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>ไปที่หน้าร้านค้าใกล้เคียง</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {checkIns.slice(0, visibleHistoryCount).map((item, idx) => (
                <div
                  key={item.id + '-' + idx}
                  className="content-auto-card bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  {/* Photo thumbnail */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {item.photoUrl ? (
                      <div
                        onClick={() => setViewingPhotoUrl(item.photoUrl)}
                        className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200 cursor-pointer group shadow-2xs"
                        title="คลิกเพื่อดูภาพขยาย"
                      >
                        <img
                          src={item.photoUrl}
                          alt={item.storeName}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                          <Eye className="w-4 h-4" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                        <Camera className="w-6 h-6" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 leading-snug">
                          {item.storeName}
                        </span>
                        <span className="text-[11px] font-mono text-blue-700 bg-blue-50 px-2 py-0.2 rounded-md font-semibold border border-blue-200/60">
                          {item.timestampStr}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                        <span>👤 {item.salespersonName}</span>
                        {item.distanceMeters !== undefined && (
                          <span>📍 ห่าง {formatDistance(item.distanceMeters)}</span>
                        )}
                        {item.notes && (
                          <span className="text-slate-700 font-medium">📝 {item.notes}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <a
                      href={item.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>ดูพิกัด GPS</span>
                    </a>

                    {onOpenOrderForCustomer && (
                      <button
                        type="button"
                        onClick={() => {
                          const matched = customers.find((c) => c.name === item.storeName);
                          if (matched) {
                            onOpenOrderForCustomer(matched);
                          } else {
                            onOpenOrderForCustomer({
                              name: item.storeName,
                              phone: item.customerPhone || '',
                              address: item.address || '',
                              mapsUrl: item.mapsUrl,
                            });
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>เปิดออเดอร์</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {checkIns.length > visibleHistoryCount && (
                <button
                  type="button"
                  onClick={() => setVisibleHistoryCount((prev) => prev + 20)}
                  className="w-full py-3 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs sm:text-sm transition-colors shadow-2xs flex items-center justify-center gap-2 cursor-pointer mt-3"
                >
                  <span>แสดงประวัติเพิ่มเติม (+20 จากทั้งหมด {checkIns.length} รายการ)</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          CHECK-IN ACTION MODAL WITH PHOTO ATTACHMENT REQUIREMENT
         ========================================================================= */}
      {isCheckInModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 my-8">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold leading-tight">
                    บันทึกเช็คอินร้านค้า
                  </h2>
                  <p className="text-[11px] text-blue-100 mt-0.5">
                    บันทึกเวลา พิกัดดาวเทียม และภาพถ่ายหน้าร้าน
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCheckInModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitCheckIn} className="p-4 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Store Information */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-700" />
                    <span>ข้อมูลร้านค้าที่เข้าพบ</span>
                  </span>
                  {selectedCustomer && (
                    <span className="text-[10px] text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full font-semibold">
                      ลูกค้าในระบบ
                    </span>
                  )}
                </div>

                {!isCustomStore && selectedCustomer ? (
                  <div>
                    <div className="text-sm font-bold text-slate-900">{selectedCustomer.name}</div>
                    {selectedCustomer.phone && (
                      <div className="text-xs text-slate-500 mt-0.5">โทร: {selectedCustomer.phone}</div>
                    )}
                    {selectedCustomer.address && (
                      <div className="text-xs text-slate-500 mt-0.5">{selectedCustomer.address}</div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        ชื่อร้านค้า / ลูกค้าใหม่ <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="เช่น ร้านกาแฟ มารวย คาเฟ่"
                        value={customStoreName}
                        onChange={(e) => setCustomStoreName(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                          เบอร์โทรติดต่อ
                        </label>
                        <input
                          type="tel"
                          placeholder="เช่น 081-xxx-xxxx"
                          value={customStorePhone}
                          onChange={(e) => setCustomStorePhone(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                          ที่อยู่สังเขป
                        </label>
                        <input
                          type="text"
                          placeholder="เช่น ถ.สุขุมวิท 71"
                          value={customStoreAddress}
                          onChange={(e) => setCustomStoreAddress(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Recorded Time & GPS Details */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 space-y-1">
                  <span className="text-slate-500 text-[11px] block">เวลาเช็คอิน (อัตโนมัติ)</span>
                  <span className="font-bold text-blue-900 font-mono text-xs">
                    {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} น.
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 space-y-1">
                  <span className="text-slate-500 text-[11px] block">พิกัด GPS ปัจจุบัน</span>
                  <span className="font-bold text-blue-900 font-mono text-[11px] truncate block">
                    {currentLat ? `${currentLat.toFixed(5)}, ${currentLng?.toFixed(5)}` : '13.7563, 100.5018'}
                  </span>
                </div>
              </div>

              {/* Requirement 3: ถ่ายรูปหน้าร้านแนบก่อนการกดบันทึก */}
              <div className="p-4 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-blue-700" />
                    <span>รูปถ่ายหน้าร้าน (จำเป็นต้องแนบก่อนบันทึก)</span>
                    <span className="text-rose-500 font-bold">*</span>
                  </label>
                  {photoDataUrl && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      <Check className="w-3 h-3" /> แนบภาพแล้ว
                    </span>
                  )}
                </div>

                {/* Hidden File Inputs */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoFileChange}
                  className="hidden"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoFileChange}
                  className="hidden"
                />

                {/* Photo Preview or Capture Buttons */}
                {photoDataUrl ? (
                  <div className="space-y-2">
                    <div className="relative rounded-xl overflow-hidden border border-slate-300 bg-black aspect-video max-h-48 group">
                      <img
                        src={photoDataUrl}
                        alt="Storefront Preview"
                        className="w-full h-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => setPhotoDataUrl('')}
                        className="absolute top-2 right-2 p-1.5 bg-rose-600 text-white rounded-full hover:bg-rose-700 transition-colors shadow-md cursor-pointer"
                        title="ลบรูปและถ่ายใหม่"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5 text-blue-600" />
                        <span>ถ่ายภาพใหม่</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-slate-600" />
                        <span>เลือกรูปจากแกลเลอรี</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center space-y-3 bg-white rounded-xl border border-slate-200">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-2xs">
                      <Camera className="w-6 h-6" />
                    </div>

                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        {isCompressingPhoto ? 'กำลังประมวลผลรูปภาพ...' : 'ถ่ายภาพป้ายหรือบรรยากาศหน้าร้าน'}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        ระบบกำหนดให้ต้องมีรูปถ่ายหน้าร้านเพื่อยืนยันการเข้าพบลูกค้าจริง
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={isCompressingPhoto}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        <Camera className="w-4 h-4" />
                        <span>ถ่ายรูปทันที (เปิดกล้อง)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isCompressingPhoto}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Upload className="w-4 h-4 text-slate-500" />
                        <span>เลือกจากอุปกรณ์</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Purpose & Visit Notes */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  วัตถุประสงค์การเข้าพบ
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    'เยี่ยมเยียนประจำรอบ',
                    'ส่งสินค้า/วางบิล',
                    'เสนอสินค้าใหม่',
                    'ติดตามเก็บเงิน',
                    'เปิดจุดขายใหม่',
                  ].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setVisitPurpose(p)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        visitPurpose === p
                          ? 'bg-blue-600 text-white font-bold shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <div>
                  <textarea
                    rows={2}
                    value={visitNote}
                    onChange={(e) => setVisitNote(e.target.value)}
                    placeholder="บันทึกรายละเอียดเพิ่มเติม เช่น ลูกค้าต้องการสั่งเพิ่มสัปดาห์หน้า, ติดต่อผู้จัดการร้าน..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCheckInModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                >
                  ยกเลิก
                </button>

                <button
                  id="btn-confirm-submit-checkin"
                  type="submit"
                  disabled={!photoDataUrl || isSubmitting || isCompressingPhoto}
                  className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-xl font-bold text-xs transition-all shadow-md ${
                    !photoDataUrl
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white cursor-pointer active:scale-95'
                  }`}
                  title={!photoDataUrl ? 'กรุณาถ่ายรูปหน้าร้านก่อนการบันทึก' : 'กดบันทึกเช็คอิน'}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการเช็คอิน'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full-size Photo Viewer Modal */}
      {viewingPhotoUrl && (
        <div
          onClick={() => setViewingPhotoUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-2xl w-full max-h-[85vh] bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/20"
          >
            <img
              src={viewingPhotoUrl}
              alt="Storefront Zoom"
              className="w-full h-full object-contain max-h-[80vh]"
            />
            <button
              type="button"
              onClick={() => setViewingPhotoUrl(null)}
              className="absolute top-3 right-3 p-2 bg-black/60 text-white rounded-full hover:bg-black/90 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
