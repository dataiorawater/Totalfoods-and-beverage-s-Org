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
  Calendar,
  Sparkles,
  ShoppingBag,
  Eye,
  Check,
  Filter,
  User,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Plus,
  Edit3,
  RotateCcw,
} from 'lucide-react';
import { Customer, StaffUser, StoreCheckIn, Route, DailyRouteSchedule } from '../types';
import { toTelHref } from '../utils/phoneUtils';
import { calculateDistanceMeters, formatDistance, extractCustomerCoords, compressImageFile } from '../utils/geoUtils';
import {
  uploadCheckInPhotoToDrive,
  getDriveImageDisplayUrl,
} from '../services/googleDrive';
import {
  getTodayDateIso,
  formatDateIso,
  formatThaiDate,
  getThaiDayFromDate,
  isCustomerInDatePlan,
  isCustomerInRoute,
  doesRouteRunOnDay,
  doesRouteBelongToSales,
  doesRouteBelongToUser,
  isCustomerBelongingToUser,
  doesCheckInBelongToUser,
  getRouteColor,
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
  gpsRefreshTrigger?: number;
  dailySchedules?: Record<string, DailyRouteSchedule>;
  onSaveDailySchedule?: (dateStr: string, schedule: DailyRouteSchedule) => void;
  onBatchSaveDailySchedules?: (schedules: Record<string, DailyRouteSchedule>) => void;
  onDeleteDailySchedule?: (dateStr: string) => void;
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
  gpsRefreshTrigger = 0,
  dailySchedules: propsDailySchedules,
  onSaveDailySchedule: propsOnSaveDailySchedule,
  onBatchSaveDailySchedules: propsOnBatchSaveDailySchedules,
  onDeleteDailySchedule: propsOnDeleteDailySchedule,
}) => {
  // 1. Geolocation State
  const [currentLat, setCurrentLat] = useState<number | null>(null);
  const [currentLng, setCurrentLng] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [lastLocationUpdateTime, setLastLocationUpdateTime] = useState<string>('');

  // 2. Call Plan Daily Schedules State (Persisted in localStorage)
  const [localDailySchedules, setLocalDailySchedules] = useState<Record<string, DailyRouteSchedule>>(() => {
    if (propsDailySchedules && Object.keys(propsDailySchedules).length > 0) return propsDailySchedules;
    const saved = localStorage.getItem('iora_call_plan_daily_schedule');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch (e) {}
    }
    return {};
  });

  const activeDailySchedules = (propsDailySchedules && Object.keys(propsDailySchedules).length > 0)
    ? propsDailySchedules
    : localDailySchedules;

  const handleSaveDailySchedule = (dateStr: string, schedule: DailyRouteSchedule) => {
    setLocalDailySchedules((prev) => {
      const updated = { ...prev, [dateStr]: schedule };
      localStorage.setItem('iora_call_plan_daily_schedule', JSON.stringify(updated));
      return updated;
    });
    if (propsOnSaveDailySchedule) {
      propsOnSaveDailySchedule(dateStr, schedule);
    }
  };

  const handleBatchSaveDailySchedules = (schedules: Record<string, DailyRouteSchedule>) => {
    setLocalDailySchedules(schedules);
    localStorage.setItem('iora_call_plan_daily_schedule', JSON.stringify(schedules));
    if (propsOnBatchSaveDailySchedules) {
      propsOnBatchSaveDailySchedules(schedules);
    }
  };

  const handleDeleteDailySchedule = (dateStr: string) => {
    setLocalDailySchedules((prev) => {
      const updated = { ...prev };
      delete updated[dateStr];
      localStorage.setItem('iora_call_plan_daily_schedule', JSON.stringify(updated));
      return updated;
    });
    if (propsOnDeleteDailySchedule) {
      propsOnDeleteDailySchedule(dateStr);
    }
  };

  // 3. Date Selection & Route Change Modal State
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayDateIso());
  const [isRouteChangeModalOpen, setIsRouteChangeModalOpen] = useState<boolean>(false);
  const [editingRouteIds, setEditingRouteIds] = useState<string[]>([]);

  // 4. Role Access & Call Plan Mode Filters
  const canViewAllRoutes = currentUser.role === 'admin' || currentUser.role === 'manager';

  type CallPlanFilterMode = 'date' | 'all';
  const [callPlanMode, setCallPlanMode] = useState<CallPlanFilterMode>('date');
  const [selectedSales, setSelectedSales] = useState<string>(
    canViewAllRoutes ? 'all' : currentUser.name
  );
  const [visitStatusFilter, setVisitStatusFilter] = useState<'all' | 'unvisited' | 'visited'>('unvisited');

  // Keep selectedSales strictly synchronized when switching user/role
  useEffect(() => {
    if (!canViewAllRoutes) {
      setSelectedSales(currentUser.name);
    }
  }, [canViewAllRoutes, currentUser.id, currentUser.name]);

  const effectiveSelectedSales = canViewAllRoutes ? selectedSales : currentUser.name;

  // Routes scoped to current user role:
  // - Admin & Manager see all routes
  // - Sales (and other non-admin/manager roles) see ONLY their own assigned routes
  const scopedRoutes = useMemo(() => {
    if (canViewAllRoutes) return routes;
    return routes.filter((r) => doesRouteBelongToUser(r, currentUser));
  }, [canViewAllRoutes, routes, currentUser]);

  const scopedRouteIdSet = useMemo(() => new Set(scopedRoutes.map((r) => r.id)), [scopedRoutes]);

  // Routes visible inside the "ปรับเปลี่ยน" modal:
  // - Sales role strictly sees ONLY their own routes
  // - Admin/Manager sees the selected salesperson's routes (or all if 'all' is selected)
  const editableRoutesForModal = useMemo(() => {
    if (!canViewAllRoutes) return scopedRoutes;
    if (effectiveSelectedSales !== 'all') {
      return scopedRoutes.filter((r) => doesRouteBelongToSales(r, effectiveSelectedSales));
    }
    return scopedRoutes;
  }, [canViewAllRoutes, scopedRoutes, effectiveSelectedSales]);

  const editableRouteIdSet = useMemo(
    () => new Set(editableRoutesForModal.map((r) => r.id)),
    [editableRoutesForModal]
  );

  // Customers scoped to current user role
  const scopedCustomers = useMemo(() => {
    if (canViewAllRoutes) return customers;
    return customers.filter((c) => isCustomerBelongingToUser(c, currentUser, scopedRoutes, routes));
  }, [canViewAllRoutes, customers, currentUser, scopedRoutes, routes]);

  // Check-ins scoped to current user role
  const scopedCheckIns = useMemo(() => {
    if (canViewAllRoutes) return checkIns;
    return checkIns.filter((ci) => doesCheckInBelongToUser(ci, currentUser));
  }, [canViewAllRoutes, checkIns, currentUser]);

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

  // 5. Full-size photo viewer & History Date Filter
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState<string | null>(null);
  const [visibleHistoryCount, setVisibleHistoryCount] = useState<number>(20);
  const [historyDateFilter, setHistoryDateFilter] = useState<'today' | 'month' | 'date' | 'all'>('today');
  const [historySelectedDate, setHistorySelectedDate] = useState<string>(() => getTodayDateIso());

  useEffect(() => {
    setVisibleHistoryCount(20);
  }, [historyDateFilter, historySelectedDate]);

  // 6. Check-ins History (Provided from props)

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
        maximumAge: 0,
      }
    );
  };

  // Refresh GPS every time the user enters or clicks the Store Check-in menu
  useEffect(() => {
    requestCurrentLocation();
  }, [gpsRefreshTrigger]);

  // Save check-ins to localStorage whenever updated
  useEffect(() => {
    localStorage.setItem('iora_checkins', JSON.stringify(checkIns));
  }, [checkIns]);

  // Compute stores sorted by distance from current GPS (scoped to user role)
  const storesWithDistance = useMemo(() => {
    return scopedCustomers.map((c) => {
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
  }, [scopedCustomers, currentLat, currentLng]);

  // Call Plan & Daily Route Calculations
  const selectedDateThaiDay = useMemo(() => getThaiDayFromDate(selectedDate), [selectedDate]);
  const isSelectedDateToday = useMemo(() => selectedDate === getTodayDateIso(), [selectedDate]);

  // Date Navigation handlers
  const handlePrevDay = () => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() - 1);
    setSelectedDate(formatDateIso(dateObj));
  };

  const handleNextDay = () => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + 1);
    setSelectedDate(formatDateIso(dateObj));
  };

  // Self-service route change modal handlers (scoped strictly to salesperson's own routes)
  const handleOpenRouteChangeModal = () => {
    const existingSchedule = activeDailySchedules[selectedDate];
    if (existingSchedule) {
      setEditingRouteIds(existingSchedule.routeIds.filter((id) => editableRouteIdSet.has(id)));
    } else {
      const thaiDay = getThaiDayFromDate(selectedDate);
      const defaultIds = editableRoutesForModal
        .filter((r) => doesRouteRunOnDay(r, thaiDay))
        .map((r) => r.id);
      setEditingRouteIds(defaultIds);
    }
    setIsRouteChangeModalOpen(true);
  };

  const handleToggleEditingRoute = (routeId: string) => {
    setEditingRouteIds((prev) =>
      prev.includes(routeId) ? prev.filter((id) => id !== routeId) : [...prev, routeId]
    );
  };

  const handleSaveRouteChange = () => {
    const existingSchedule = activeDailySchedules[selectedDate];
    const thaiDay = getThaiDayFromDate(selectedDate);
    // Preserve route assignments belonging to other salespeople so saving never overwrites theirs
    const otherRouteIds = existingSchedule
      ? existingSchedule.routeIds.filter((id) => !editableRouteIdSet.has(id))
      : routes
          .filter((r) => !editableRouteIdSet.has(r.id) && doesRouteRunOnDay(r, thaiDay))
          .map((r) => r.id);

    const finalRouteIds = Array.from(new Set([...otherRouteIds, ...editingRouteIds]));
    handleSaveDailySchedule(selectedDate, {
      date: selectedDate,
      routeIds: finalRouteIds,
      notes: existingSchedule?.notes,
      updatedAt: new Date().toISOString(),
    });
    setIsRouteChangeModalOpen(false);
  };

  const handleRevertRouteChangeToDefault = () => {
    const existingSchedule = activeDailySchedules[selectedDate];
    if (existingSchedule) {
      const otherRouteIds = existingSchedule.routeIds.filter((id) => !editableRouteIdSet.has(id));
      if (otherRouteIds.length === 0) {
        handleDeleteDailySchedule(selectedDate);
      } else {
        const thaiDay = getThaiDayFromDate(selectedDate);
        const ownDefaultIds = editableRoutesForModal
          .filter((r) => doesRouteRunOnDay(r, thaiDay))
          .map((r) => r.id);
        handleSaveDailySchedule(selectedDate, {
          ...existingSchedule,
          routeIds: Array.from(new Set([...otherRouteIds, ...ownDefaultIds])),
          updatedAt: new Date().toISOString(),
        });
      }
    }
    setIsRouteChangeModalOpen(false);
  };

  // Sales rep filter options (for Admin & Manager)
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

  // Track check-ins performed on the SELECTED DATE (scoped to user role)
  const selectedDateCheckInStatus = useMemo(() => {
    const checkedCustomerIds = new Set<string>();
    const checkedStoreNames = new Set<string>();
    const targetDayNum = selectedDate.split('-')[2];

    scopedCheckIns.forEach((ci) => {
      let isMatch = false;
      if (ci.createdAt) {
        if (ci.createdAt.slice(0, 10) === selectedDate) {
          isMatch = true;
        }
      }
      if (!isMatch && ci.timestampStr && ci.timestampStr.includes(targetDayNum)) {
        isMatch = true;
      }
      if (isMatch) {
        if (ci.customerId) checkedCustomerIds.add(ci.customerId);
        if (ci.storeName) checkedStoreNames.add(ci.storeName.trim().toLowerCase());
      }
    });

    return { checkedCustomerIds, checkedStoreNames };
  }, [scopedCheckIns, selectedDate]);

  const isCustomerCheckedInOnSelectedDate = (cust: Customer) => {
    if (cust.id && selectedDateCheckInStatus.checkedCustomerIds.has(cust.id)) return true;
    if (cust.name && selectedDateCheckInStatus.checkedStoreNames.has(cust.name.trim().toLowerCase())) return true;
    return false;
  };

  // Stats: Planned for selected date & Completed on selected date
  const { datePlanCount, dateCompletedCount } = useMemo(() => {
    let plan = 0;
    let completed = 0;
    scopedCustomers.forEach((c) => {
      if (
        isCustomerInDatePlan({
          customer: c,
          dateStr: selectedDate,
          dailySchedules: activeDailySchedules,
          routes: scopedRoutes,
          selectedSales: canViewAllRoutes ? effectiveSelectedSales : undefined,
        })
      ) {
        plan++;
        if (isCustomerCheckedInOnSelectedDate(c)) {
          completed++;
        }
      }
    });
    return { datePlanCount: plan, dateCompletedCount: completed };
  }, [
    scopedCustomers,
    selectedDate,
    activeDailySchedules,
    scopedRoutes,
    canViewAllRoutes,
    effectiveSelectedSales,
    selectedDateCheckInStatus,
  ]);

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
      if (callPlanMode === 'date') {
        const inPlan = isCustomerInDatePlan({
          customer,
          dateStr: selectedDate,
          dailySchedules: activeDailySchedules,
          routes: scopedRoutes,
          selectedSales: canViewAllRoutes ? effectiveSelectedSales : undefined,
        });
        if (!inPlan) return false;
      } else if (callPlanMode === 'all') {
        if (canViewAllRoutes && effectiveSelectedSales !== 'all') {
          const matchedRoute = scopedRoutes.find(
            (r) => r.id === customer.routeId || r.name === customer.routeName || isCustomerInRoute(customer, r)
          );
          const belongs =
            customer.salespersonName === effectiveSelectedSales ||
            (matchedRoute && doesRouteBelongToSales(matchedRoute, effectiveSelectedSales));
          if (!belongs) return false;
        }
      }

      // 3. Visit status filter
      const hasCheckedIn = isCustomerCheckedInOnSelectedDate(customer);
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
    selectedDate,
    activeDailySchedules,
    canViewAllRoutes,
    effectiveSelectedSales,
    scopedRoutes,
    visitStatusFilter,
    distanceFilter,
    selectedDateCheckInStatus,
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
      setFormError('กรุณาถ่ายรูปหน้าร้านจากกล้องก่อนการกดบันทึกเช็คอิน');
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

      // Upload check-in photo to Google Drive (stores only Drive link in Google Sheets)
      let finalPhotoUrl = photoDataUrl;
      if (photoDataUrl.startsWith('data:')) {
        const uploaded = await uploadCheckInPhotoToDrive(photoDataUrl, {
          storeName,
          salespersonName: currentUser.name,
          date: now,
        });
        finalPhotoUrl = uploaded.webViewLink;
      }

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
        photoUrl: finalPhotoUrl,
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

  const getCheckInDateIso = (ci: StoreCheckIn): string | null => {
    const raw = String(ci.createdAt || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw;
    }
    if (raw) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        return formatDateIso(d);
      }
    }
    return null;
  };

  const todayCheckIns = useMemo(() => {
    const todayIso = getTodayDateIso();
    return scopedCheckIns.filter((c) => getCheckInDateIso(c) === todayIso);
  }, [scopedCheckIns]);

  const thisMonthCheckIns = useMemo(() => {
    const currentMonthPrefix = getTodayDateIso().slice(0, 7);
    return scopedCheckIns.filter((c) => {
      const dateIso = getCheckInDateIso(c);
      return dateIso ? dateIso.startsWith(currentMonthPrefix) : false;
    });
  }, [scopedCheckIns]);

  const filteredHistoryCheckIns = useMemo(() => {
    if (historyDateFilter === 'today') {
      return todayCheckIns;
    }
    if (historyDateFilter === 'month') {
      return thisMonthCheckIns;
    }
    if (historyDateFilter === 'date') {
      return scopedCheckIns.filter((c) => getCheckInDateIso(c) === historySelectedDate);
    }
    return scopedCheckIns;
  }, [scopedCheckIns, todayCheckIns, thisMonthCheckIns, historyDateFilter, historySelectedDate]);

  const handleHistoryPrevDay = () => {
    const [y, m, d] = historySelectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() - 1);
    setHistorySelectedDate(formatDateIso(dateObj));
    setHistoryDateFilter('date');
  };

  const handleHistoryNextDay = () => {
    const [y, m, d] = historySelectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + 1);
    setHistorySelectedDate(formatDateIso(dateObj));
    setHistoryDateFilter('date');
  };

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

      {/* Header & GPS Status Banner (Compact Mobile-First Layout) */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/80 shadow-xs space-y-2.5 sm:space-y-3">
        {/* Top Row: Title on Left + GPS Status & Refresh on Top-Right */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shadow-2xs shrink-0">
              <MapPin className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
            </div>
            <h1 className="text-sm sm:text-lg font-bold text-slate-900 leading-tight truncate">
              เช็คอินร้านค้า
              <span className="hidden sm:inline text-slate-500 font-semibold text-sm ml-1.5">
                (Store Check-in)
              </span>
            </h1>
          </div>

          {/* Top-Right Compact GPS Status + Refresh */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold ${
                currentLat
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}
              title={
                currentLat && currentLng
                  ? `พิกัด: ${currentLat.toFixed(5)}, ${currentLng.toFixed(5)}${accuracy ? ` (ความแม่นยำ ±${accuracy} ม.)` : ''}${lastLocationUpdateTime ? ` • อัปเดต ${lastLocationUpdateTime}` : ''}`
                  : 'กำลังค้นหาสัญญาณ GPS...'
              }
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  currentLat ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span className="whitespace-nowrap">
                <span className="sm:hidden">{currentLat ? 'GPS พร้อม' : 'ค้นหา GPS...'}</span>
                <span className="hidden sm:inline">
                  {currentLat ? 'เชื่อมต่อ GPS แล้ว' : 'กำลังค้นหา GPS...'}
                  {currentLat && accuracy ? ` (±${accuracy} ม.)` : ''}
                </span>
              </span>
            </div>

            <button
              id="btn-refresh-gps"
              type="button"
              onClick={requestCurrentLocation}
              disabled={isLocating}
              aria-label="รีเฟรชพิกัด GPS"
              title="กดเพื่อตรวจจับตำแหน่งปัจจุบันใหม่อีกครั้ง"
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 active:scale-95 border border-slate-200 text-slate-700 font-semibold text-[11px] inline-flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isLocating ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">{isLocating ? 'กำลังค้นหา...' : 'รีเฟรช GPS'}</span>
            </button>
          </div>
        </div>

        {/* Bottom Row: Sub-tab Navigation (ค้นหาร้านเช็คอิน / ประวัติเช็คอิน) */}
        <div className="grid grid-cols-2 sm:inline-flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200/60 w-full sm:w-auto">
          <button
            id="subtab-checkin-search"
            type="button"
            onClick={() => setActiveSubTab('checkin')}
            className={`px-3 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeSubTab === 'checkin'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Navigation className="w-3.5 h-3.5 shrink-0" />
            <span>ค้นหาร้านเช็คอิน</span>
          </button>
          <button
            id="subtab-checkin-history"
            type="button"
            onClick={() => setActiveSubTab('history')}
            className={`px-3 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeSubTab === 'history'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>ประวัติเช็คอิน</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-800 font-bold">
              {scopedCheckIns.length}
            </span>
          </button>
        </div>

        {locationError && (
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
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
            {/* Row 1 (Top): Salesperson Filter & Self-service Route Change Button */}
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
              {canViewAllRoutes ? (
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl flex-1 sm:flex-initial max-w-full min-w-0">
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap shrink-0">เซลล์:</span>
                  <select
                    value={selectedSales}
                    onChange={(e) => setSelectedSales(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer w-full sm:w-auto min-w-0 truncate"
                  >
                    <option value="all">ทุกคน (All Sales)</option>
                    {salesOptions.map((sales) => (
                      <option key={sales} value={sales}>
                        {sales}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-blue-50/80 border border-blue-200 px-2.5 py-1.5 rounded-xl max-w-full min-w-0">
                  <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="text-[11px] font-medium text-blue-600 whitespace-nowrap shrink-0">เซลล์:</span>
                  <span className="text-xs font-bold text-blue-900 truncate">{currentUser.name}</span>
                  <span className="hidden sm:inline-block text-[10px] font-semibold text-blue-700 bg-white/80 px-1.5 py-0.5 rounded-md border border-blue-200/80 whitespace-nowrap shrink-0">
                    เฉพาะสายของฉัน
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={handleOpenRouteChangeModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 active:bg-blue-200 border border-blue-200 text-blue-700 font-bold text-xs transition-colors cursor-pointer shrink-0 shadow-2xs"
              >
                <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                <span>เปลี่ยนสาย</span>
              </button>
            </div>

            {/* Row 2: Visit Date Picker & Visit Status Filter */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-blue-600" />
                  <span>วันเข้าเยี่ยม (Visit Date):</span>
                </span>

                {/* Date Stepper & Picker */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
                  <button
                    type="button"
                    onClick={handlePrevDay}
                    className="p-1 rounded-lg hover:bg-white hover:text-blue-600 text-slate-600 transition-colors cursor-pointer"
                    title="ย้อนหลัง 1 วัน"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {/* Date Input Overlay */}
                  <label className="relative cursor-pointer px-2.5 py-0.5 rounded-lg bg-white border border-slate-200 shadow-2xs flex items-center gap-1.5 hover:border-blue-300">
                    <span className="text-xs font-bold text-slate-900 whitespace-nowrap">
                      {formatThaiDate(selectedDate, { withDayOfWeek: true, shortMonth: true })}
                    </span>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        if (e.target.value) {
                          setSelectedDate(e.target.value);
                          setCallPlanMode('date');
                        }
                      }}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleNextDay}
                    className="p-1 rounded-lg hover:bg-white hover:text-blue-600 text-slate-600 transition-colors cursor-pointer"
                    title="ถัดไป 1 วัน"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Visit Status Filter (Not visited / Visited / All) */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60 self-start md:self-auto">
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
              </div>
            </div>

            {/* Daily Call Plan Progress & Summary Banner (Date-Based) */}
            {callPlanMode === 'date' && (() => {
              const DAILY_CHECKIN_TARGET = 20;
              const progressPct = Math.round((dateCompletedCount / DAILY_CHECKIN_TARGET) * 100);
              return (
                <div className="mt-2 p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-blue-50/90 via-indigo-50/80 to-slate-50 border border-blue-200/80 flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-xs shadow-2xs">
                  {/* Stats line */}
                  <div className="text-xs text-slate-700 flex items-center flex-wrap gap-x-2 gap-y-1">
                    <span>
                      เป้า <strong className="text-blue-700 font-bold">{DAILY_CHECKIN_TARGET}</strong> ร้าน
                    </span>
                    <span className="text-slate-300">|</span>
                    <span>
                      ทั้งหมด <strong className="text-slate-900 font-bold">{datePlanCount}</strong> ร้าน
                    </span>
                    <span className="text-slate-300">|</span>
                    <span>
                      เช็คอินแล้ว <strong className="text-emerald-700 font-bold">{dateCompletedCount}</strong> ร้าน
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full md:w-44 flex flex-col gap-1 shrink-0">
                    <div className="flex justify-between text-[10px] font-bold text-slate-600">
                      <span>ความคืบหน้า</span>
                      <span className="text-emerald-700 font-black">
                        {progressPct}%
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, progressPct)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}
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
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  ไม่มีร้านค้าในสายส่งที่กำหนดวิ่งสำหรับวันที่ {formatThaiDate(selectedDate, { withDayOfWeek: true, shortMonth: true })} หรือเข้าเยี่ยมครบแล้ว
                </p>
              </div>
            ) : (
              filteredStores.map(({ customer, coords, distanceMeters }, idx) => {
                const isVeryClose = distanceMeters !== undefined && distanceMeters <= 100;
                const isClose = distanceMeters !== undefined && distanceMeters <= 1000;
                const hasCheckedInDate = isCustomerCheckedInOnSelectedDate(customer);
                const isScheduledForDate = isCustomerInDatePlan({
                  customer,
                  dateStr: selectedDate,
                  dailySchedules: activeDailySchedules,
                  routes: scopedRoutes,
                  selectedSales: canViewAllRoutes ? effectiveSelectedSales : undefined,
                });

                return (
                  <div
                    key={`${customer.id || customer.name || 'cust'}-${customer.phone || ''}-${idx}`}
                    className={`bg-white p-3.5 sm:p-4 rounded-2xl border transition-all shadow-2xs flex flex-col justify-between gap-3 ${
                      hasCheckedInDate
                        ? 'border-emerald-200 bg-emerald-50/15'
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

                            {/* Scheduled for this date badge */}
                            {isScheduledForDate && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                                <span>สายประจำวัน</span>
                              </span>
                            )}

                            {/* Checked-in status badge */}
                            {hasCheckedInDate ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                <span>เช็คอินแล้ว</span>
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

                        {customer.phone && toTelHref(customer.phone) && (
                          <a
                            href={toTelHref(customer.phone)}
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
                          hasCheckedInDate
                            ? 'bg-slate-100 hover:bg-slate-200 text-emerald-800 border border-emerald-300'
                            : isVeryClose
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-500/30'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>{hasCheckedInDate ? 'เช็คอินอีกครั้ง' : 'เช็คอินหน้าร้าน'}</span>
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs text-slate-500">เช็คอินวันนี้</span>
              <div className="text-xl font-black text-blue-700 mt-0.5">
                {todayCheckIns.length} ครั้ง
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs text-slate-500">เช็คอินเดือนนี้</span>
              <div className="text-xl font-black text-indigo-700 mt-0.5">
                {thisMonthCheckIns.length} ครั้ง
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs text-slate-500">แสดงผลตามตัวกรอง</span>
              <div className="text-xl font-black text-slate-800 mt-0.5">
                {filteredHistoryCheckIns.length} ครั้ง
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs text-slate-500">
                {canViewAllRoutes ? 'มุมมองข้อมูล (ผู้ดูแล/หัวหน้าแผนก)' : 'พนักงานขาย (สายของฉัน)'}
              </span>
              <div className="text-xs font-bold text-slate-800 mt-1 truncate">
                {canViewAllRoutes ? `${currentUser.name} — ดูได้ทุกคน` : currentUser.name}
              </div>
            </div>
          </div>

          {/* History Date Filter Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mr-1">
                <Filter className="w-3.5 h-3.5 text-blue-600" />
                <span>ช่วงเวลาแสดงผล:</span>
              </span>

              <button
                id="history-filter-today"
                type="button"
                onClick={() => setHistoryDateFilter('today')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  historyDateFilter === 'today'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>วันนี้</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    historyDateFilter === 'today' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {todayCheckIns.length}
                </span>
              </button>

              <button
                id="history-filter-month"
                type="button"
                onClick={() => setHistoryDateFilter('month')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  historyDateFilter === 'month'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>เดือนนี้</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    historyDateFilter === 'month' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {thisMonthCheckIns.length}
                </span>
              </button>

              <button
                id="history-filter-date"
                type="button"
                onClick={() => setHistoryDateFilter('date')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  historyDateFilter === 'date'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>ตามวันที่ระบุ</span>
              </button>

              <button
                id="history-filter-all"
                type="button"
                onClick={() => setHistoryDateFilter('all')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  historyDateFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>ทั้งหมด</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    historyDateFilter === 'all' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {scopedCheckIns.length}
                </span>
              </button>
            </div>

            {/* Specific Date Picker */}
            <div className="flex items-center gap-2 self-start lg:self-auto">
              <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">เลือกวันที่:</span>
              <div
                className={`flex items-center gap-1 p-1 rounded-xl border transition-all ${
                  historyDateFilter === 'date'
                    ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-500/15'
                    : 'bg-slate-100 border-slate-200/80'
                }`}
              >
                <button
                  type="button"
                  onClick={handleHistoryPrevDay}
                  className="p-1 rounded-lg hover:bg-white hover:text-blue-600 text-slate-600 transition-colors cursor-pointer"
                  title="วันก่อนหน้า"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <label className="relative cursor-pointer px-2.5 py-0.5 rounded-lg bg-white border border-slate-200 shadow-2xs flex items-center gap-1.5 hover:border-blue-300">
                  <CalendarDays className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-900 whitespace-nowrap">
                    {formatThaiDate(historySelectedDate, { withDayOfWeek: false, shortMonth: true })}
                  </span>
                  <input
                    id="history-date-picker"
                    type="date"
                    value={historySelectedDate}
                    onChange={(e) => {
                      if (e.target.value) {
                        setHistorySelectedDate(e.target.value);
                        setHistoryDateFilter('date');
                      }
                    }}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleHistoryNextDay}
                  className="p-1 rounded-lg hover:bg-white hover:text-blue-600 text-slate-600 transition-colors cursor-pointer"
                  title="วันถัดไป"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* History List */}
          {filteredHistoryCheckIns.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-2xl border border-slate-200/80 space-y-2">
              <Clock className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">
                {scopedCheckIns.length === 0
                  ? 'ยังไม่มีประวัติการเช็คอิน'
                  : historyDateFilter === 'today'
                  ? 'ยังไม่มีประวัติการเช็คอินในวันนี้'
                  : historyDateFilter === 'month'
                  ? 'ยังไม่มีประวัติการเช็คอินในเดือนนี้'
                  : historyDateFilter === 'date'
                  ? `ไม่พบประวัติการเช็คอินในวันที่ ${formatThaiDate(historySelectedDate, { withDayOfWeek: true, shortMonth: true })}`
                  : 'ยังไม่มีประวัติการเช็คอิน'}
              </p>
              <p className="text-xs text-slate-500">
                {scopedCheckIns.length === 0
                  ? 'เริ่มเช็คอินร้านค้าแรกเพื่อบันทึกพิกัด GPS และรูปถ่ายหน้าร้าน'
                  : 'สามารถเปลี่ยนช่วงเวลาด้านบน หรือเลือกวันที่อื่นเพื่อดูข้อมูลย้อนหลังได้'}
              </p>
              <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
                {scopedCheckIns.length > 0 && historyDateFilter !== 'month' && thisMonthCheckIns.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setHistoryDateFilter('month')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold hover:bg-blue-100 cursor-pointer"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>ดูประวัติเดือนนี้ ({thisMonthCheckIns.length})</span>
                  </button>
                )}
                {scopedCheckIns.length > 0 && historyDateFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setHistoryDateFilter('all')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                  >
                    <span>ดูประวัติทั้งหมด ({scopedCheckIns.length})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveSubTab('checkin')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 cursor-pointer"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>ไปที่หน้าร้านค้าใกล้เคียง</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredHistoryCheckIns.slice(0, visibleHistoryCount).map((item, idx) => (
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
                          src={getDriveImageDisplayUrl(item.photoUrl, 400)}
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
                  {onOpenOrderForCustomer && (
                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
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
                    </div>
                  )}
                </div>
              ))}

              {filteredHistoryCheckIns.length > visibleHistoryCount && (
                <button
                  type="button"
                  onClick={() => setVisibleHistoryCount((prev) => prev + 20)}
                  className="w-full py-3 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs sm:text-sm transition-colors shadow-2xs flex items-center justify-center gap-2 cursor-pointer mt-3"
                >
                  <span>แสดงประวัติเพิ่มเติม (+20 จากทั้งหมด {filteredHistoryCheckIns.length} รายการ)</span>
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

                {/* Hidden Camera Input (Camera Capture Only) */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoFileChange}
                  className="hidden"
                />

                {/* Photo Preview or Capture Button */}
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
                        className="w-full py-2 px-3 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5 text-blue-600" />
                        <span>ถ่ายภาพใหม่</span>
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
                        ระบบกำหนดให้ต้องถ่ายรูปหน้าร้านจากกล้องเพื่อยืนยันการเข้าพบลูกค้าจริง
                      </p>
                    </div>

                    <div className="flex items-center justify-center pt-1">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={isCompressingPhoto}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        <Camera className="w-4 h-4" />
                        <span>ถ่ายรูปทันที (เปิดกล้อง)</span>
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
                  <span>{isSubmitting ? 'กำลังอัปโหลดรูปและบันทึก...' : 'บันทึกการเช็คอิน'}</span>
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
            className="relative max-w-2xl w-full max-h-[85vh] bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/20 flex flex-col"
          >
            <img
              src={getDriveImageDisplayUrl(viewingPhotoUrl, 1400)}
              alt="Storefront Zoom"
              className="w-full h-full object-contain max-h-[78vh]"
            />
            <button
              type="button"
              onClick={() => setViewingPhotoUrl(null)}
              aria-label="ปิดภาพขยาย"
              className="absolute top-3 right-3 p-2 bg-black/60 text-white rounded-full hover:bg-black/90 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Self-Service Route Change Modal (Shows only current salesperson's own routes) */}
      {isRouteChangeModalOpen && (
        <div
          onClick={() => setIsRouteChangeModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh]"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                  <CalendarDays className="w-5 h-5 text-amber-300" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm sm:text-base leading-tight truncate">
                    ปรับเปลี่ยนสายการเข้าเยี่ยม
                  </h3>
                  <p className="text-xs text-blue-100 font-medium truncate">
                    {formatThaiDate(selectedDate, { withDayOfWeek: true, shortMonth: false })}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRouteChangeModalOpen(false)}
                aria-label="ปิดหน้าต่างปรับเปลี่ยนสายการเข้าเยี่ยม"
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <span className="font-bold text-slate-800">
                  สายเข้าเยี่ยมของฉัน ({editingRouteIds.length}/{editableRoutesForModal.length} สาย)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditingRouteIds([])}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    ล้าง
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      const thaiDay = getThaiDayFromDate(selectedDate);
                      const defaultIds = editableRoutesForModal
                        .filter((r) => doesRouteRunOnDay(r, thaiDay))
                        .map((r) => r.id);
                      setEditingRouteIds(defaultIds);
                    }}
                    className="text-[11px] font-bold text-emerald-600 hover:underline cursor-pointer"
                  >
                    ตามรอบปกติ
                  </button>
                </div>
              </div>

              {/* Routes Checklist */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
                {editableRoutesForModal.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-slate-50 text-slate-500 text-center">
                    ยังไม่มีสายการเข้าเยี่ยมที่กำหนดให้{' '}
                    {!canViewAllRoutes || effectiveSelectedSales === 'all'
                      ? currentUser.name
                      : effectiveSelectedSales}
                  </div>
                ) : (
                  editableRoutesForModal.map((route, idx) => {
                    const isChecked = editingRouteIds.includes(route.id);
                    const palette = getRouteColor(route.id || idx);
                    const storeCount = scopedCustomers.filter((c) => isCustomerInRoute(c, route)).length;

                    return (
                      <div
                        key={route.id}
                        onClick={() => handleToggleEditingRoute(route.id)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                          isChecked
                            ? 'bg-blue-50/70 border-blue-300 shadow-2xs ring-1 ring-blue-500/20'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                              isChecked
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isChecked && <Check className="w-3.5 h-3.5" />}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-800 text-xs truncate">
                                {route.name}
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${palette.bg} ${palette.text} border ${palette.border}`}
                              >
                                {route.id}
                              </span>
                            </div>
                            {route.visitDays && route.visitDays.length > 0 && (
                              <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                รอบปกติ: {route.visitDays.join(', ')}
                              </div>
                            )}
                          </div>
                        </div>

                        <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-xl whitespace-nowrap shrink-0">
                          {storeCount} ร้าน
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Selected Summary & Reset */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                <div>
                  <span className="text-slate-500">ร้านค้าทั้งหมดในสายที่เลือก: </span>
                  <strong className="text-slate-900 font-bold text-sm">
                    {scopedCustomers.filter((c) =>
                      editableRoutesForModal
                        .filter((r) => editingRouteIds.includes(r.id))
                        .some((r) => isCustomerInRoute(c, r))
                    ).length}{' '}
                    ร้าน
                  </strong>
                </div>

                {activeDailySchedules[selectedDate] && (
                  <button
                    type="button"
                    onClick={handleRevertRouteChangeToDefault}
                    className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700 font-bold text-[11px] cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>ใช้รอบปกติ</span>
                  </button>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsRouteChangeModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer"
              >
                ยกเลิก
              </button>

              <button
                type="button"
                onClick={handleSaveRouteChange}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs cursor-pointer shadow-2xs"
              >
                <Check className="w-4 h-4" />
                <span>บันทึกสายเข้าเยี่ยม</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

