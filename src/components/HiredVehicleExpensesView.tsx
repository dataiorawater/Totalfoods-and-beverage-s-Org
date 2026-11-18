import React, { useState, useMemo } from 'react';
import {
  HiredVehicleTripRecord,
  PayoutStatus,
  StaffUser,
  Order,
  Route,
  VehicleRateConfig,
} from '../types';
import { TotalEmblem } from './TotalLogo';
import {
  CircleDollarSign,
  Truck,
  Plus,
  Search,
  Filter,
  Printer,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  Check,
  Edit2,
  Trash2,
  X,
  CreditCard,
  Banknote,
  DollarSign,
  Package,
  Layers,
  ArrowRight,
  TrendingUp,
  FileText,
  User,
  Phone,
  Settings2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface HiredVehicleExpensesViewProps {
  trips: HiredVehicleTripRecord[];
  orders: Order[];
  currentUser: StaffUser;
  staffList: StaffUser[];
  routes: Route[];
  onSaveTrip: (trip: HiredVehicleTripRecord) => Promise<void> | void;
  onUpdateTrip: (trip: HiredVehicleTripRecord) => Promise<void> | void;
  onDeleteTrip: (tripId: string) => Promise<void> | void;
  sheetsConnected: boolean;
}

// Convert numbers to Thai Baht text
function bahtText(num: number): string {
  if (num === 0) return 'ศูนย์บาทถ้วน';
  const numbers = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const units = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

  const absNum = Math.abs(num);
  const integerPart = Math.floor(absNum);
  const decimalPart = Math.round((absNum - integerPart) * 100);

  let output = '';

  function convertGroup(n: number): string {
    const s = String(n);
    const len = s.length;
    let res = '';
    for (let i = 0; i < len; i++) {
      const digit = parseInt(s[i], 10);
      const pos = len - i - 1;
      if (digit === 0) continue;
      if (pos === 1 && digit === 1) {
        res += 'สิบ';
      } else if (pos === 1 && digit === 2) {
        res += 'ยี่สิบ';
      } else if (pos === 0 && digit === 1 && len > 1) {
        res += 'เอ็ด';
      } else {
        res += numbers[digit] + units[pos];
      }
    }
    return res;
  }

  if (integerPart > 0) {
    if (integerPart >= 1000000) {
      const millions = Math.floor(integerPart / 1000000);
      const remain = integerPart % 1000000;
      output += convertGroup(millions) + 'ล้าน';
      if (remain > 0) output += convertGroup(remain);
    } else {
      output += convertGroup(integerPart);
    }
    output += 'บาท';
  } else {
    output = 'ศูนย์บาท';
  }

  if (decimalPart === 0) {
    output += 'ถ้วน';
  } else {
    output += convertGroup(decimalPart) + 'สตางค์';
  }

  return (num < 0 ? 'ลบ' : '') + output;
}

// Format Thai Date
function formatThaiDate(dateStr?: string, showYear = true): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  const thaiMonths = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];
  const mName = thaiMonths[month - 1] || '';
  const thaiYear = year > 2400 ? year : year + 543;
  return showYear ? `${day} ${mName} ${thaiYear}` : `${day} ${mName}`;
}

export const HiredVehicleExpensesView: React.FC<HiredVehicleExpensesViewProps> = ({
  trips,
  orders,
  currentUser,
  staffList,
  routes,
  onSaveTrip,
  onUpdateTrip,
  onDeleteTrip,
  sheetsConnected,
}) => {
  // Period Mode: 'daily' | 'weekly' | 'monthly'
  const [periodMode, setPeriodMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // Daily Filter
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  // Weekly / Period Filter Presets
  const [weekPreset, setWeekPreset] = useState<'this_week' | 'last_week' | 'half_1' | 'half_2' | 'custom'>('this_week');
  const [weekStartDate, setWeekStartDate] = useState<string>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().slice(0, 10);
  });
  const [weekEndDate, setWeekEndDate] = useState<string>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? 0 : 7); // Sunday
    const sunday = new Date(d.setDate(diff));
    return sunday.toISOString().slice(0, 10);
  });

  // Monthly Filter
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return new Date().toISOString().slice(0, 7); // YYYY-MM
  });

  // Filters
  const [filterVehicle, setFilterVehicle] = useState<string>('all');
  const [filterDriver, setFilterDriver] = useState<string>('all');
  const [filterPayoutStatus, setFilterPayoutStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modals
  const [isAddTripModalOpen, setIsAddTripModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<HiredVehicleTripRecord | null>(null);
  const [payoutModalTrip, setPayoutModalTrip] = useState<HiredVehicleTripRecord | null>(null);
  const [printVoucherTrip, setPrintVoucherTrip] = useState<HiredVehicleTripRecord | null>(null);
  const [printSummaryPeriod, setPrintSummaryPeriod] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Form State for Add / Edit
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [formVehiclePlate, setFormVehiclePlate] = useState<string>('');
  const [formVehicleType, setFormVehicleType] = useState<string>('กระบะตู้ทึบ');
  const [formDriverName, setFormDriverName] = useState<string>('');
  const [formDriverPhone, setFormDriverPhone] = useState<string>('');
  const [formRouteName, setFormRouteName] = useState<string>('');
  const [formTripNumber, setFormTripNumber] = useState<number>(1);
  const [formDropCount, setFormDropCount] = useState<number>(10);
  const [formTotalUnits, setFormTotalUnits] = useState<number>(120);
  const [formBaseTripRate, setFormBaseTripRate] = useState<number>(800);
  const [formDropRate, setFormDropRate] = useState<number>(25);
  const [formUnitRate, setFormUnitRate] = useState<number>(3);
  const [formFuelAllowance, setFormFuelAllowance] = useState<number>(200);
  const [formOvertime, setFormOvertime] = useState<number>(0);
  const [formDeductions, setFormDeductions] = useState<number>(0);
  const [formDeductionReason, setFormDeductionReason] = useState<string>('');
  const [formTaxPercent, setFormTaxPercent] = useState<number>(1);
  const [formPayoutStatus, setFormPayoutStatus] = useState<PayoutStatus>('pending');
  const [formNotes, setFormNotes] = useState<string>('');

  // Payout Form
  const [payoutDate, setPayoutDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [payoutMethod, setPayoutMethod] = useState<'transfer' | 'cash'>('transfer');
  const [payoutRef, setPayoutRef] = useState<string>('');
  const [payoutPayer, setPayoutPayer] = useState<string>(currentUser.name || 'เจ้าหน้าที่การเงิน');
  const [payoutNotes, setPayoutNotes] = useState<string>('');

  // Default Rate Configs
  const [defaultBaseRate, setDefaultBaseRate] = useState<number>(() => {
    const saved = localStorage.getItem('hired_default_base_rate');
    return saved ? Number(saved) : 800;
  });
  const [defaultDropRate, setDefaultDropRate] = useState<number>(() => {
    const saved = localStorage.getItem('hired_default_drop_rate');
    return saved ? Number(saved) : 25;
  });
  const [defaultUnitRate, setDefaultUnitRate] = useState<number>(() => {
    const saved = localStorage.getItem('hired_default_unit_rate');
    return saved ? Number(saved) : 3;
  });
  const [defaultFuelAllowance, setDefaultFuelAllowance] = useState<number>(() => {
    const saved = localStorage.getItem('hired_default_fuel');
    return saved ? Number(saved) : 200;
  });

  // Extract distinct vehicles and drivers from both trips and orders
  const knownVehicles = useMemo(() => {
    const set = new Set<string>();
    trips.forEach((t) => {
      if (t.vehiclePlate) set.add(t.vehiclePlate.trim());
    });
    orders.forEach((o) => {
      if (o.deliveryVehicle) set.add(o.deliveryVehicle.trim());
    });
    return Array.from(set).filter(Boolean);
  }, [trips, orders]);

  const knownDrivers = useMemo(() => {
    const set = new Set<string>();
    trips.forEach((t) => {
      if (t.driverName) set.add(t.driverName.trim());
    });
    orders.forEach((o) => {
      if (o.deliveryDriverName) set.add(o.deliveryDriverName.trim());
    });
    staffList
      .filter((s) => s.role === 'delivery')
      .forEach((s) => set.add(s.name.trim()));
    return Array.from(set).filter(Boolean);
  }, [trips, orders, staffList]);

  // Detected unrecorded delivery runs from Orders
  const unrecordedRunsFromOrders = useMemo(() => {
    // Group orders with deliveryVehicle by date and vehicle
    const grouped = new Map<string, { date: string; vehiclePlate: string; orders: Order[] }>();

    orders.forEach((o) => {
      if (!o.deliveryVehicle) return;
      // Get order date from requestedDeliveryDate or createdAt
      const dStr = o.requestedDeliveryDate
        ? o.requestedDeliveryDate.slice(0, 10)
        : o.createdAt.slice(0, 10);
      const key = `${dStr}__${o.deliveryVehicle.trim()}`;
      if (!grouped.has(key)) {
        grouped.set(key, { date: dStr, vehiclePlate: o.deliveryVehicle.trim(), orders: [] });
      }
      grouped.get(key)!.orders.push(o);
    });

    const unrecorded: Array<{
      date: string;
      vehiclePlate: string;
      driverName: string;
      orders: Order[];
      dropCount: number;
      totalUnits: number;
      suggestedRoute: string;
    }> = [];

    grouped.forEach((val) => {
      // Check if already in trips
      const alreadyLogged = trips.some(
        (t) => t.date === val.date && t.vehiclePlate.trim() === val.vehiclePlate
      );
      if (!alreadyLogged) {
        const dropCount = val.orders.length;
        const totalUnits = val.orders.reduce((sum, ord) => {
          return (
            sum +
            ord.items.reduce((iSum, it) => iSum + (Number(it.quantity) || 0), 0)
          );
        }, 0);
        const driver = val.orders.find((o) => o.deliveryDriverName)?.deliveryDriverName || '';
        const route = val.orders.find((o) => o.customerName)?.customerName ? 'สายส่งทั่วไป' : '';
        unrecorded.push({
          date: val.date,
          vehiclePlate: val.vehiclePlate,
          driverName: driver,
          orders: val.orders,
          dropCount,
          totalUnits,
          suggestedRoute: route,
        });
      }
    });

    return unrecorded;
  }, [orders, trips]);

  // Handle Quick Import from Order Run
  const handleImportOrderRun = async (run: typeof unrecordedRunsFromOrders[0]) => {
    const dropFee = run.dropCount * defaultDropRate;
    const unitFee = run.totalUnits * defaultUnitRate;
    const gross = defaultBaseRate + dropFee + unitFee + defaultFuelAllowance;
    const taxAmt = Math.round(gross * 0.01);
    const net = gross - taxAmt;

    const newTrip: HiredVehicleTripRecord = {
      id: `trip-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      date: run.date,
      vehiclePlate: run.vehiclePlate,
      vehicleType: 'รถร่วมบริการ',
      driverName: run.driverName || 'พนักงานขับรถ',
      routeName: run.suggestedRoute || 'สายส่งประจำ',
      tripNumber: 1,
      orderIds: run.orders.map((o) => o.id),
      orderNumbers: run.orders.map((o) => o.orderNumber),
      customerNames: run.orders.map((o) => o.customerName),
      dropCount: run.dropCount,
      totalUnitsDelivered: run.totalUnits,
      baseTripRate: defaultBaseRate,
      dropRate: defaultDropRate,
      totalDropFee: dropFee,
      unitRate: defaultUnitRate,
      totalUnitFee: unitFee,
      fuelAllowance: defaultFuelAllowance,
      overtimeOrSpecialFee: 0,
      deductions: 0,
      grossAmount: gross,
      taxWithholdingPercent: 1,
      taxWithholdingAmount: taxAmt,
      netPayout: net,
      payoutStatus: 'pending',
      notes: `ดึงข้อมูลอัตโนมัติจากแผนจัดส่ง ${run.orders.length} จุดส่ง`,
      isCustomManual: false,
    };

    await onSaveTrip(newTrip);
  };

  // Change Week Presets
  const applyWeekPreset = (preset: 'this_week' | 'last_week' | 'half_1' | 'half_2') => {
    setWeekPreset(preset);
    const now = new Date();
    if (preset === 'this_week') {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const sunday = new Date(d.setDate(diff + 6));
      setWeekStartDate(monday.toISOString().slice(0, 10));
      setWeekEndDate(sunday.toISOString().slice(0, 10));
    } else if (preset === 'last_week') {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1) - 7;
      const monday = new Date(d.setDate(diff));
      const sunday = new Date(d.setDate(diff + 6));
      setWeekStartDate(monday.toISOString().slice(0, 10));
      setWeekEndDate(sunday.toISOString().slice(0, 10));
    } else if (preset === 'half_1') {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      setWeekStartDate(`${year}-${month}-01`);
      setWeekEndDate(`${year}-${month}-15`);
    } else if (preset === 'half_2') {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      setWeekStartDate(`${year}-${month}-16`);
      setWeekEndDate(`${year}-${month}-${lastDay}`);
    }
  };

  // Filtered Trips based on Period Mode and Controls
  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      // 1. Period Filter
      if (periodMode === 'daily') {
        if (trip.date !== selectedDate) return false;
      } else if (periodMode === 'weekly') {
        if (trip.date < weekStartDate || trip.date > weekEndDate) return false;
      } else if (periodMode === 'monthly') {
        if (!trip.date.startsWith(selectedMonth)) return false;
      }

      // 2. Vehicle Filter
      if (filterVehicle !== 'all' && trip.vehiclePlate !== filterVehicle) {
        return false;
      }

      // 3. Driver Filter
      if (filterDriver !== 'all' && trip.driverName !== filterDriver) {
        return false;
      }

      // 4. Payout Status Filter
      if (filterPayoutStatus !== 'all' && trip.payoutStatus !== filterPayoutStatus) {
        return false;
      }

      // 5. Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchPlate = trip.vehiclePlate.toLowerCase().includes(q);
        const matchDriver = trip.driverName.toLowerCase().includes(q);
        const matchRoute = (trip.routeName || '').toLowerCase().includes(q);
        const matchNote = (trip.notes || '').toLowerCase().includes(q);
        if (!matchPlate && !matchDriver && !matchRoute && !matchNote) {
          return false;
        }
      }

      return true;
    });
  }, [
    trips,
    periodMode,
    selectedDate,
    weekStartDate,
    weekEndDate,
    selectedMonth,
    filterVehicle,
    filterDriver,
    filterPayoutStatus,
    searchTerm,
  ]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalTrips = 0;
    let totalDrops = 0;
    let totalUnits = 0;
    let totalBasePay = 0;
    let totalDropFee = 0;
    let totalUnitFee = 0;
    let totalFuel = 0;
    let totalOt = 0;
    let totalDeductions = 0;
    let totalTaxWithheld = 0;
    let totalGross = 0;
    let totalNet = 0;
    let pendingCount = 0;
    let pendingAmount = 0;
    let paidCount = 0;
    let paidAmount = 0;

    const vehiclesSet = new Set<string>();

    filteredTrips.forEach((t) => {
      totalTrips += 1;
      totalDrops += t.dropCount || 0;
      totalUnits += t.totalUnitsDelivered || 0;
      totalBasePay += t.baseTripRate || 0;
      totalDropFee += t.totalDropFee || 0;
      totalUnitFee += t.totalUnitFee || 0;
      totalFuel += t.fuelAllowance || 0;
      totalOt += t.overtimeOrSpecialFee || 0;
      totalDeductions += t.deductions || 0;
      totalTaxWithheld += t.taxWithholdingAmount || 0;
      totalGross += t.grossAmount || 0;
      totalNet += t.netPayout || 0;

      if (t.vehiclePlate) vehiclesSet.add(t.vehiclePlate);

      if (t.payoutStatus === 'pending') {
        pendingCount += 1;
        pendingAmount += t.netPayout || 0;
      } else {
        paidCount += 1;
        paidAmount += t.netPayout || 0;
      }
    });

    return {
      totalTrips,
      totalDrops,
      totalUnits,
      totalBasePay,
      totalDropFee,
      totalUnitFee,
      totalFuel,
      totalOt,
      totalDeductions,
      totalTaxWithheld,
      totalGross,
      totalNet,
      pendingCount,
      pendingAmount,
      paidCount,
      paidAmount,
      vehicleCount: vehiclesSet.size,
    };
  }, [filteredTrips]);

  // Open Add Modal
  const handleOpenAddModal = (initialPlate?: string) => {
    setEditingTrip(null);
    setFormDate(
      periodMode === 'daily'
        ? selectedDate
        : new Date().toISOString().slice(0, 10)
    );
    setFormVehiclePlate(initialPlate || (knownVehicles[0] || ''));
    setFormVehicleType('กระบะตู้ทึบ');
    setFormDriverName(knownDrivers[0] || '');
    setFormDriverPhone('');
    setFormRouteName(routes[0]?.name || 'สายส่งประจำ');
    setFormTripNumber(1);
    setFormDropCount(12);
    setFormTotalUnits(150);
    setFormBaseTripRate(defaultBaseRate);
    setFormDropRate(defaultDropRate);
    setFormUnitRate(defaultUnitRate);
    setFormFuelAllowance(defaultFuelAllowance);
    setFormOvertime(0);
    setFormDeductions(0);
    setFormDeductionReason('');
    setFormTaxPercent(1);
    setFormPayoutStatus('pending');
    setFormNotes('');
    setIsAddTripModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (t: HiredVehicleTripRecord) => {
    setEditingTrip(t);
    setFormDate(t.date);
    setFormVehiclePlate(t.vehiclePlate);
    setFormVehicleType(t.vehicleType || 'กระบะตู้ทึบ');
    setFormDriverName(t.driverName);
    setFormDriverPhone(t.driverPhone || '');
    setFormRouteName(t.routeName || '');
    setFormTripNumber(t.tripNumber || 1);
    setFormDropCount(t.dropCount);
    setFormTotalUnits(t.totalUnitsDelivered);
    setFormBaseTripRate(t.baseTripRate);
    setFormDropRate(t.dropRate);
    setFormUnitRate(t.unitRate);
    setFormFuelAllowance(t.fuelAllowance);
    setFormOvertime(t.overtimeOrSpecialFee);
    setFormDeductions(t.deductions);
    setFormDeductionReason(t.deductionReason || '');
    setFormTaxPercent(t.taxWithholdingPercent || 0);
    setFormPayoutStatus(t.payoutStatus);
    setFormNotes(t.notes || '');
    setIsAddTripModalOpen(true);
  };

  // Submit Trip Form (Create or Update)
  const handleSubmitTripForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formVehiclePlate.trim()) {
      alert('กรุณาระบุทะเบียนรถ');
      return;
    }

    const dropFee = formDropCount * formDropRate;
    const unitFee = formTotalUnits * formUnitRate;
    const gross = formBaseTripRate + dropFee + unitFee + formFuelAllowance + formOvertime;
    const taxAmt = Math.round(gross * (formTaxPercent / 100));
    const net = gross - formDeductions - taxAmt;

    if (editingTrip) {
      const updated: HiredVehicleTripRecord = {
        ...editingTrip,
        date: formDate,
        vehiclePlate: formVehiclePlate.trim(),
        vehicleType: formVehicleType,
        driverName: formDriverName.trim(),
        driverPhone: formDriverPhone.trim(),
        routeName: formRouteName.trim(),
        tripNumber: Number(formTripNumber) || 1,
        dropCount: Number(formDropCount) || 0,
        totalUnitsDelivered: Number(formTotalUnits) || 0,
        baseTripRate: Number(formBaseTripRate) || 0,
        dropRate: Number(formDropRate) || 0,
        totalDropFee: dropFee,
        unitRate: Number(formUnitRate) || 0,
        totalUnitFee: unitFee,
        fuelAllowance: Number(formFuelAllowance) || 0,
        overtimeOrSpecialFee: Number(formOvertime) || 0,
        deductions: Number(formDeductions) || 0,
        deductionReason: formDeductionReason.trim(),
        grossAmount: gross,
        taxWithholdingPercent: formTaxPercent,
        taxWithholdingAmount: taxAmt,
        netPayout: net,
        payoutStatus: formPayoutStatus,
        notes: formNotes.trim(),
      };
      await onUpdateTrip(updated);
    } else {
      const newTrip: HiredVehicleTripRecord = {
        id: `trip-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        date: formDate,
        vehiclePlate: formVehiclePlate.trim(),
        vehicleType: formVehicleType,
        driverName: formDriverName.trim(),
        driverPhone: formDriverPhone.trim(),
        routeName: formRouteName.trim(),
        tripNumber: Number(formTripNumber) || 1,
        dropCount: Number(formDropCount) || 0,
        totalUnitsDelivered: Number(formTotalUnits) || 0,
        baseTripRate: Number(formBaseTripRate) || 0,
        dropRate: Number(formDropRate) || 0,
        totalDropFee: dropFee,
        unitRate: Number(formUnitRate) || 0,
        totalUnitFee: unitFee,
        fuelAllowance: Number(formFuelAllowance) || 0,
        overtimeOrSpecialFee: Number(formOvertime) || 0,
        deductions: Number(formDeductions) || 0,
        deductionReason: formDeductionReason.trim(),
        grossAmount: gross,
        taxWithholdingPercent: formTaxPercent,
        taxWithholdingAmount: taxAmt,
        netPayout: net,
        payoutStatus: formPayoutStatus,
        notes: formNotes.trim(),
        isCustomManual: true,
      };
      await onSaveTrip(newTrip);
    }

    setIsAddTripModalOpen(false);
    setEditingTrip(null);
  };

  // Open Payout Modal
  const handleOpenPayoutModal = (t: HiredVehicleTripRecord) => {
    setPayoutModalTrip(t);
    setPayoutDate(new Date().toISOString().slice(0, 10));
    setPayoutMethod('transfer');
    setPayoutRef('');
    setPayoutPayer(currentUser.name || 'เจ้าหน้าที่การเงิน');
    setPayoutNotes('');
  };

  // Confirm Payout
  const handleConfirmPayout = async () => {
    if (!payoutModalTrip) return;
    const updated: HiredVehicleTripRecord = {
      ...payoutModalTrip,
      payoutStatus: 'paid',
      paidAt: `${payoutDate} ${new Date().toLocaleTimeString('th-TH')}`,
      paidBy: payoutPayer,
      paymentMethod: payoutMethod,
      paymentRef: payoutRef.trim(),
      notes: payoutNotes.trim()
        ? `${payoutModalTrip.notes || ''} [จ่ายเมื่อ ${payoutDate}: ${payoutNotes.trim()}]`
        : payoutModalTrip.notes,
    };
    await onUpdateTrip(updated);
    setPayoutModalTrip(null);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'วันที่',
      'ทะเบียนรถ',
      'ประเภทรถ',
      'พนักงานขับรถ',
      'เบอร์โทร',
      'สายส่ง',
      'เที่ยวที่',
      'จุดส่ง (จุด)',
      'ยอดส่ง (หน่วย)',
      'ค่าเที่ยว (บาท)',
      'ค่าจุดส่ง (บาท)',
      'ค่าคอมถัง (บาท)',
      'ค่าน้ำมัน (บาท)',
      'ค่าล่วงเวลา (บาท)',
      'หักค่าใช้จ่าย (บาท)',
      'เหตุผลที่หัก',
      'ยอดรวมก่อนภาษี (บาท)',
      'หักภาษี WHT (%)',
      'ภาษีหัก (บาท)',
      'ยอดสุทธิทำจ่าย (บาท)',
      'สถานะการจ่าย',
      'วันที่จ่าย',
      'ผู้จ่ายเงิน',
      'วิธีจ่าย',
      'เลขอ้างอิง',
      'หมายเหตุ',
    ];

    const rows = filteredTrips.map((t) => [
      t.date,
      `"${t.vehiclePlate}"`,
      `"${t.vehicleType || ''}"`,
      `"${t.driverName}"`,
      `"${t.driverPhone || ''}"`,
      `"${t.routeName || ''}"`,
      t.tripNumber || 1,
      t.dropCount,
      t.totalUnitsDelivered,
      t.baseTripRate,
      t.totalDropFee,
      t.totalUnitFee,
      t.fuelAllowance,
      t.overtimeOrSpecialFee,
      t.deductions,
      `"${t.deductionReason || ''}"`,
      t.grossAmount,
      t.taxWithholdingPercent,
      t.taxWithholdingAmount,
      t.netPayout,
      t.payoutStatus === 'paid' ? 'จ่ายแล้ว' : 'รอทำจ่าย',
      `"${t.paidAt || ''}"`,
      `"${t.paidBy || ''}"`,
      t.paymentMethod === 'cash' ? 'เงินสด' : 'โอนเงิน',
      `"${t.paymentRef || ''}"`,
      `"${t.notes || ''}"`,
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `hired_vehicle_expenses_${periodMode}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Grouped by Vehicle (for Period Mode cards)
  const vehicleSummaries = useMemo(() => {
    const map = new Map<
      string,
      {
        vehiclePlate: string;
        driverName: string;
        driverPhone?: string;
        vehicleType?: string;
        trips: HiredVehicleTripRecord[];
        totalDrops: number;
        totalUnits: number;
        totalGross: number;
        totalDeductions: number;
        totalTax: number;
        totalNet: number;
        pendingNet: number;
        paidNet: number;
      }
    >();

    filteredTrips.forEach((t) => {
      const plate = t.vehiclePlate || 'ไม่ระบุทะเบียน';
      if (!map.has(plate)) {
        map.set(plate, {
          vehiclePlate: plate,
          driverName: t.driverName,
          driverPhone: t.driverPhone,
          vehicleType: t.vehicleType,
          trips: [],
          totalDrops: 0,
          totalUnits: 0,
          totalGross: 0,
          totalDeductions: 0,
          totalTax: 0,
          totalNet: 0,
          pendingNet: 0,
          paidNet: 0,
        });
      }
      const entry = map.get(plate)!;
      entry.trips.push(t);
      entry.totalDrops += t.dropCount || 0;
      entry.totalUnits += t.totalUnitsDelivered || 0;
      entry.totalGross += t.grossAmount || 0;
      entry.totalDeductions += t.deductions || 0;
      entry.totalTax += t.taxWithholdingAmount || 0;
      entry.totalNet += t.netPayout || 0;
      if (t.payoutStatus === 'pending') {
        entry.pendingNet += t.netPayout || 0;
      } else {
        entry.paidNet += t.netPayout || 0;
      }
    });

    return Array.from(map.values());
  }, [filteredTrips]);

  return (
    <div className="space-y-6 pb-20">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 lg:p-6 transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
              <CircleDollarSign className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight">
                  ค่าใช้จ่ายรถจ้าง (Logistics Contractor Wages)
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200/80">
                  ขนส่ง & รถร่วมบริการ
                </span>
                {sheetsConnected && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    เชื่อมต่อคลาวด์ชีต
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                รวบรวมข้อมูลรอบวิ่งงานรถแต่ละคัน คำนวณค่าเที่ยว ค่าจุดส่ง ค่าคอมถัง และทำจ่ายค่าจ้างรายวัน รายวิค และรายเดือน
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Settings2 className="w-4 h-4 text-slate-500" />
              <span>อัตราค่าจ้าง</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>ส่งออก CSV</span>
            </button>
            <button
              onClick={() => setPrintSummaryPeriod(true)}
              className="px-3.5 py-2.5 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Printer className="w-4 h-4 text-blue-600" />
              <span>พิมพ์สรุปงวดนี้</span>
            </button>
            <button
              onClick={() => handleOpenAddModal()}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-blue-600/30 active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>+ บันทึกรอบวิ่งรถจ้าง</span>
            </button>
          </div>
        </div>

        {/* Unrecorded Runs Alert from Orders */}
        {unrecordedRunsFromOrders.length > 0 && (
          <div className="mt-4 p-3.5 bg-amber-50/90 border border-amber-200/90 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-amber-900">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-200/80 text-amber-800 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold">
                  ตรวจพบการวิ่งงานจากแผนจัดส่ง {unrecordedRunsFromOrders.length} รอบที่ยังไม่ได้บันทึกค่าใช้จ่าย
                </span>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  ระบบตรวจสอบพบออเดอร์ที่มีการจ่ายรถและกำหนดสายส่งแล้ว สามารถนำเข้าคำนวณค่าเที่ยวได้ทันที
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={async () => {
                  for (const run of unrecordedRunsFromOrders) {
                    await handleImportOrderRun(run);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-2xs"
              >
                นำเข้าทั้งหมด ({unrecordedRunsFromOrders.length} คัน)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Period Switcher: รายวัน / รายวิค / รายเดือน */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 lg:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          {/* Mode Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setPeriodMode('daily')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                periodMode === 'daily'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>สรุปรายวัน (Daily)</span>
            </button>
            <button
              onClick={() => {
                setPeriodMode('weekly');
                applyWeekPreset('this_week');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                periodMode === 'weekly'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>สรุปรายวิค / รายงวด (Period)</span>
            </button>
            <button
              onClick={() => setPeriodMode('monthly')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                periodMode === 'monthly'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>สรุปรายเดือน (Monthly)</span>
            </button>
          </div>

          {/* Controls per Period Mode */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {periodMode === 'daily' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const today = new Date().toISOString().slice(0, 10);
                    setSelectedDate(today);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    selectedDate === new Date().toISOString().slice(0, 10)
                      ? 'bg-blue-50 text-blue-700 border-blue-300'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  วันนี้
                </button>
                <button
                  onClick={() => {
                    const y = new Date();
                    y.setDate(y.getDate() - 1);
                    setSelectedDate(y.toISOString().slice(0, 10));
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  เมื่อวาน
                </button>
                <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {periodMode === 'weekly' && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg text-[11px] font-bold">
                  <button
                    onClick={() => applyWeekPreset('this_week')}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      weekPreset === 'this_week'
                        ? 'bg-white text-blue-700 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    สัปดาห์นี้
                  </button>
                  <button
                    onClick={() => applyWeekPreset('last_week')}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      weekPreset === 'last_week'
                        ? 'bg-white text-blue-700 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    สัปดาห์ที่แล้ว
                  </button>
                  <button
                    onClick={() => applyWeekPreset('half_1')}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      weekPreset === 'half_1'
                        ? 'bg-white text-blue-700 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    วิค 1 (1-15)
                  </button>
                  <button
                    onClick={() => applyWeekPreset('half_2')}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      weekPreset === 'half_2'
                        ? 'bg-white text-blue-700 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    วิค 2 (16-สิ้นเดือน)
                  </button>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                  <input
                    type="date"
                    value={weekStartDate}
                    onChange={(e) => {
                      setWeekStartDate(e.target.value);
                      setWeekPreset('custom');
                    }}
                    className="bg-transparent text-xs font-semibold focus:outline-none"
                  />
                  <span>ถึง</span>
                  <input
                    type="date"
                    value={weekEndDate}
                    onChange={(e) => {
                      setWeekEndDate(e.target.value);
                      setWeekPreset('custom');
                    }}
                    className="bg-transparent text-xs font-semibold focus:outline-none"
                  />
                </div>
              </div>
            )}

            {periodMode === 'monthly' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-semibold">เลือกเดือน:</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* 3. Filter Bar: Vehicle, Driver, Payout Status, Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
          {/* Vehicle Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              เลือกรถ / ทะเบียนรถ:
            </label>
            <select
              value={filterVehicle}
              onChange={(e) => setFilterVehicle(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="all">-- รถทุกคัน ({knownVehicles.length} คัน) --</option>
              {knownVehicles.map((plate) => (
                <option key={plate} value={plate}>
                  {plate}
                </option>
              ))}
            </select>
          </div>

          {/* Driver Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              พนักงานขับรถ:
            </label>
            <select
              value={filterDriver}
              onChange={(e) => setFilterDriver(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="all">-- คนขับทุกคน --</option>
              {knownDrivers.map((driver) => (
                <option key={driver} value={driver}>
                  {driver}
                </option>
              ))}
            </select>
          </div>

          {/* Payout Status */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              สถานะการจ่ายเงิน:
            </label>
            <select
              value={filterPayoutStatus}
              onChange={(e) => setFilterPayoutStatus(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="all">-- ทุกสถานะ --</option>
              <option value="pending">รอทำจ่าย (Pending)</option>
              <option value="paid">จ่ายเรียบร้อย (Paid)</option>
            </select>
          </div>

          {/* Search Term */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              ค้นหา:
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ทะเบียน, คนขับ, สายส่ง..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-8.5 pr-3 py-2 text-slate-700 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Trips */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">จำนวนรอบวิ่ง</span>
            <Truck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-black text-slate-900">
            {metrics.totalTrips.toLocaleString()}
            <span className="text-xs font-normal text-slate-500 ml-1">เที่ยว</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {metrics.vehicleCount} คันที่วิ่งงาน
          </div>
        </div>

        {/* Drops & Units */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">จุดส่ง / ยอดถัง</span>
            <Package className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-xl font-black text-slate-900">
            {metrics.totalDrops.toLocaleString()}
            <span className="text-xs font-normal text-slate-500 ml-1">จุด</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            รวม {metrics.totalUnits.toLocaleString()} ถัง/หน่วย
          </div>
        </div>

        {/* Total Gross */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">ยอดรวมก่อนหัก</span>
            <DollarSign className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-xl font-black text-slate-900">
            ฿{metrics.totalGross.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            ค่าเที่ยว+จุด+ถัง+น้ำมัน
          </div>
        </div>

        {/* Deductions & WHT */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">หักค่าปรับ & WHT</span>
            <span className="text-[10px] text-rose-500 font-bold">-หัก</span>
          </div>
          <div className="text-xl font-black text-rose-600">
            ฿{(metrics.totalDeductions + metrics.totalTaxWithheld).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            หัก ฿{metrics.totalDeductions.toLocaleString()} | ภาษี ฿{metrics.totalTaxWithheld.toLocaleString()}
          </div>
        </div>

        {/* Net Payout Total */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl p-4 shadow-md shadow-blue-500/20">
          <div className="flex items-center justify-between text-blue-100 mb-1">
            <span className="text-[11px] font-bold">ยอดสุทธิทำจ่าย</span>
            <CircleDollarSign className="w-4 h-4 text-white" />
          </div>
          <div className="text-xl font-black">
            ฿{metrics.totalNet.toLocaleString()}
          </div>
          <div className="text-[10px] text-blue-100 mt-0.5">
            ยอดจ่ายจริงงวดนี้
          </div>
        </div>

        {/* Pending vs Paid */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">สถานะจ่ายเงิน</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-base font-black text-amber-600">
            รอ: ฿{metrics.pendingAmount.toLocaleString()}
          </div>
          <div className="text-[11px] font-bold text-emerald-600 mt-0.5">
            จ่ายแล้ว: ฿{metrics.paidAmount.toLocaleString()}
          </div>
        </div>
      </div>

      {/* 5. Main Content: Table / Card Views */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Table Title and Actions */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black text-slate-800">
              {periodMode === 'daily' && `รายการวิ่งงานประจำวัน (${formatThaiDate(selectedDate)})`}
              {periodMode === 'weekly' && `สรุปการวิ่งงานตามงวด (${formatThaiDate(weekStartDate)} - ${formatThaiDate(weekEndDate)})`}
              {periodMode === 'monthly' && `สรุปการวิ่งงานประจำเดือน (${selectedMonth})`}
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
              {filteredTrips.length} รายการ
            </span>
          </div>

          <div className="text-xs text-slate-500 font-semibold">
            ยอดสุทธิรวม:{' '}
            <span className="font-black text-blue-700 text-sm">
              ฿{metrics.totalNet.toLocaleString()}
            </span>
          </div>
        </div>

        {filteredTrips.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Truck className="w-12 h-12 mx-auto text-slate-300 mb-3 stroke-[1.5]" />
            <p className="text-sm font-bold text-slate-600">ไม่พบข้อมูลการวิ่งงานของรถจ้างในงวดนี้</p>
            <p className="text-xs text-slate-400 mt-1">
              คลิกปุ่ม "+ บันทึกรอบวิ่งรถจ้าง" หรือตรวจดูรอบวิ่งจากแผนจัดส่งด้านบนเพื่อนำเข้า
            </p>
            <button
              onClick={() => handleOpenAddModal()}
              className="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>บันทึกรอบวิ่งใหม่</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 text-slate-500 border-b border-slate-200/80 font-bold">
                  <th className="py-3 px-3.5">วันที่ / เที่ยว</th>
                  <th className="py-3 px-3.5">ทะเบียนรถ / รถ</th>
                  <th className="py-3 px-3.5">คนขับ / สายส่ง</th>
                  <th className="py-3 px-3 text-center">จุดส่ง</th>
                  <th className="py-3 px-3 text-center">ถัง/หน่วย</th>
                  <th className="py-3 px-3 text-right">ค่าเที่ยว</th>
                  <th className="py-3 px-3 text-right">ค่าจุด+ถัง</th>
                  <th className="py-3 px-3 text-right">น้ำมัน/OT</th>
                  <th className="py-3 px-3 text-right text-rose-600">หักค่าปรับ/ภาษี</th>
                  <th className="py-3 px-3.5 text-right font-black text-slate-900">
                    ยอดสุทธิ
                  </th>
                  <th className="py-3 px-3 text-center">สถานะ</th>
                  <th className="py-3 px-3.5 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTrips.map((trip) => {
                  const dropPlusUnitFee = (trip.totalDropFee || 0) + (trip.totalUnitFee || 0);
                  const allowances = (trip.fuelAllowance || 0) + (trip.overtimeOrSpecialFee || 0);
                  const totalDeduct = (trip.deductions || 0) + (trip.taxWithholdingAmount || 0);

                  return (
                    <tr
                      key={trip.id}
                      className="hover:bg-blue-50/30 transition-colors group"
                    >
                      {/* Date & Trip Number */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="font-bold text-slate-900">
                          {formatThaiDate(trip.date, false)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          เที่ยวที่ {trip.tripNumber || 1}
                        </div>
                      </td>

                      {/* Vehicle Plate & Type */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="font-bold text-blue-900 flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>{trip.vehiclePlate}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {trip.vehicleType || 'รถร่วมบริการ'}
                        </div>
                      </td>

                      {/* Driver & Route */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">
                          {trip.driverName}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {trip.routeName || 'สายส่งประจำ'}
                          {trip.driverPhone && ` (${trip.driverPhone})`}
                        </div>
                      </td>

                      {/* Drops */}
                      <td className="py-3 px-3 text-center whitespace-nowrap font-bold text-slate-700">
                        {trip.dropCount}
                      </td>

                      {/* Units Delivered */}
                      <td className="py-3 px-3 text-center whitespace-nowrap font-bold text-slate-700">
                        {trip.totalUnitsDelivered}
                      </td>

                      {/* Base Trip Rate */}
                      <td className="py-3 px-3 text-right whitespace-nowrap text-slate-700">
                        ฿{trip.baseTripRate.toLocaleString()}
                      </td>

                      {/* Drops + Units Fee */}
                      <td className="py-3 px-3 text-right whitespace-nowrap text-slate-700">
                        <div>฿{dropPlusUnitFee.toLocaleString()}</div>
                        <div className="text-[10px] text-slate-400">
                          จุด ฿{trip.totalDropFee} | ถัง ฿{trip.totalUnitFee}
                        </div>
                      </td>

                      {/* Fuel & OT */}
                      <td className="py-3 px-3 text-right whitespace-nowrap text-slate-700">
                        ฿{allowances.toLocaleString()}
                      </td>

                      {/* Deductions & Tax */}
                      <td className="py-3 px-3 text-right whitespace-nowrap text-rose-600 font-semibold">
                        {totalDeduct > 0 ? `-฿${totalDeduct.toLocaleString()}` : '-'}
                        {trip.deductionReason && (
                          <div className="text-[10px] text-rose-500 truncate max-w-[120px]" title={trip.deductionReason}>
                            {trip.deductionReason}
                          </div>
                        )}
                      </td>

                      {/* Net Payout */}
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <span className="font-black text-slate-900 text-sm">
                          ฿{trip.netPayout.toLocaleString()}
                        </span>
                      </td>

                      {/* Payout Status */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {trip.payoutStatus === 'paid' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            จ่ายแล้ว
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            รอจ่าย
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {trip.payoutStatus === 'pending' ? (
                            <button
                              onClick={() => handleOpenPayoutModal(trip)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                              title="ทำจ่ายเงิน"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>ทำจ่าย</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => setPrintVoucherTrip(trip)}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                              title="พิมพ์ใบสำคัญจ่าย"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenEditModal(trip)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                            title="แก้ไข"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={async () => {
                              if (confirm(`ต้องการลบรายการวิ่งงานของ ${trip.vehiclePlate} หรือไม่?`)) {
                                await onDeleteTrip(trip.id);
                              }
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="ลบ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. Vehicle Summary Breakdown Cards (Visible when multiple vehicles present) */}
      {vehicleSummaries.length > 1 && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5">
          <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
            <Truck className="w-4 h-4 text-blue-600" />
            <span>สรุปแยกตามรถแต่ละคัน (Vehicle Rollup)</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {vehicleSummaries.map((v) => (
              <div
                key={v.vehiclePlate}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-blue-200 transition-all shadow-2xs"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-blue-600" />
                      <span>{v.vehiclePlate}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      คนขับ: <span className="font-semibold text-slate-700">{v.driverName}</span>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
                    {v.trips.length} เที่ยว
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-200/80 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400">จุดส่งรวม:</span>
                    <p className="font-bold text-slate-700">{v.totalDrops} จุด ({v.totalUnits} ถัง)</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">ยอดก่อนหัก:</span>
                    <p className="font-bold text-slate-700">฿{v.totalGross.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">หักปรับ/ภาษี:</span>
                    <p className="font-bold text-rose-600">
                      -฿{(v.totalDeductions + v.totalTax).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">ยอดสุทธิทำจ่าย:</span>
                    <p className="font-black text-blue-700">฿{v.totalNet.toLocaleString()}</p>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                  <span className={v.pendingNet > 0 ? 'text-amber-600 font-bold' : 'text-slate-400'}>
                    ค้างจ่าย: ฿{v.pendingNet.toLocaleString()}
                  </span>
                  <button
                    onClick={() => setFilterVehicle(v.vehiclePlate)}
                    className="text-blue-600 hover:text-blue-800 font-bold cursor-pointer inline-flex items-center gap-0.5"
                  >
                    <span>กรองดูคันนี้</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: บันทึก / แก้ไขรอบวิ่งงานรถจ้าง (Add / Edit Trip Modal)
         ========================================================================= */}
      {isAddTripModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="px-5 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CircleDollarSign className="w-5 h-5" />
                <h3 className="font-black text-base">
                  {editingTrip ? 'แก้ไขข้อมูลรอบวิ่งรถจ้าง' : 'บันทึกรอบวิ่งงานรถจ้าง & คำนวณค่าเที่ยว'}
                </h3>
              </div>
              <button
                onClick={() => setIsAddTripModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitTripForm} className="p-5 space-y-4">
              {/* Row 1: Date & Trip # */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    วันที่วิ่งงาน *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    เที่ยวที่ (Trip Number)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formTripNumber}
                    onChange={(e) => setFormTripNumber(Number(e.target.value))}
                    className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    สายส่ง / รูทจัดส่ง
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น สาย A (สุขุมวิท)"
                    value={formRouteName}
                    onChange={(e) => setFormRouteName(e.target.value)}
                    className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Row 2: Vehicle Plate, Type, Driver Name */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ทะเบียนรถ *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น 1ฒศ-8899"
                    value={formVehiclePlate}
                    onChange={(e) => setFormVehiclePlate(e.target.value)}
                    className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ประเภทรถ
                  </label>
                  <select
                    value={formVehicleType}
                    onChange={(e) => setFormVehicleType(e.target.value)}
                    className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="กระบะตู้ทึบ">กระบะตอนเดียวตู้ทึบ</option>
                    <option value="กระบะคอก">กระบะคอก</option>
                    <option value="4 ล้อใหญ่">4 ล้อใหญ่ (Jumbo)</option>
                    <option value="รถร่วมบริการ">รถร่วมบริการทั่วไป</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ชื่อพนักงานขับรถ *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น สมชาย ใจดี"
                    value={formDriverName}
                    onChange={(e) => setFormDriverName(e.target.value)}
                    className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Delivery Volume: Drop Count & Total Units */}
              <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-blue-900 mb-1">
                    จำนวนจุดส่ง (Drops)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={formDropCount}
                      onChange={(e) => setFormDropCount(Number(e.target.value))}
                      className="w-full text-xs font-bold border border-blue-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-xs text-blue-700 shrink-0 font-semibold">จุด</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-blue-900 mb-1">
                    จำนวนถัง/หน่วยจัดส่ง (Bottles)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={formTotalUnits}
                      onChange={(e) => setFormTotalUnits(Number(e.target.value))}
                      className="w-full text-xs font-bold border border-blue-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-xs text-blue-700 shrink-0 font-semibold">ถัง/ลัง</span>
                  </div>
                </div>
              </div>

              {/* Rate Breakdown Section */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-700 block">
                  กำหนดอัตราคำนวณค่าจ้าง (Rate Settings):
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      ค่าเที่ยวพื้นฐาน (บาท)
                    </label>
                    <input
                      type="number"
                      value={formBaseTripRate}
                      onChange={(e) => setFormBaseTripRate(Number(e.target.value))}
                      className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      ค่าจุด (บาท/จุด)
                    </label>
                    <input
                      type="number"
                      value={formDropRate}
                      onChange={(e) => setFormDropRate(Number(e.target.value))}
                      className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      ค่าคอมถัง (บาท/ถัง)
                    </label>
                    <input
                      type="number"
                      value={formUnitRate}
                      onChange={(e) => setFormUnitRate(Number(e.target.value))}
                      className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      ค่าน้ำมัน/เบี้ยเลี้ยง (บาท)
                    </label>
                    <input
                      type="number"
                      value={formFuelAllowance}
                      onChange={(e) => setFormFuelAllowance(Number(e.target.value))}
                      className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white font-bold text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      ค่าล่วงเวลา / เที่ยวพิเศษ (บาท)
                    </label>
                    <input
                      type="number"
                      value={formOvertime}
                      onChange={(e) => setFormOvertime(Number(e.target.value))}
                      className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-rose-600 mb-0.5">
                      หักค่าปรับ / สินค้าชำรุด (บาท)
                    </label>
                    <input
                      type="number"
                      value={formDeductions}
                      onChange={(e) => setFormDeductions(Number(e.target.value))}
                      className="w-full text-xs border border-rose-200 rounded-lg px-2.5 py-1.5 bg-white font-bold text-rose-700"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      ภาษี ณ ที่จ่าย WHT (%)
                    </label>
                    <select
                      value={formTaxPercent}
                      onChange={(e) => setFormTaxPercent(Number(e.target.value))}
                      className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white font-bold text-slate-800"
                    >
                      <option value={0}>0% (ไม่หักภาษี)</option>
                      <option value={1}>1% (ค่าขนส่งทั่วไป)</option>
                      <option value={3}>3% (ค่าบริการ)</option>
                    </select>
                  </div>
                </div>

                {formDeductions > 0 && (
                  <div>
                    <label className="block text-[11px] font-semibold text-rose-600 mb-0.5">
                      เหตุผลที่หักเงิน
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น ถังแตกชำรุด 1 ใบ, ส่งล่าช้า..."
                      value={formDeductionReason}
                      onChange={(e) => setFormDeductionReason(e.target.value)}
                      className="w-full text-xs border border-rose-200 rounded-lg px-3 py-1.5 bg-white"
                    />
                  </div>
                )}
              </div>

              {/* Live Preview Calculation */}
              {(() => {
                const dropFee = formDropCount * formDropRate;
                const unitFee = formTotalUnits * formUnitRate;
                const gross = formBaseTripRate + dropFee + unitFee + formFuelAllowance + formOvertime;
                const taxAmt = Math.round(gross * (formTaxPercent / 100));
                const net = gross - formDeductions - taxAmt;

                return (
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-blue-700 font-bold">
                        ยอดรวมก่อนหัก: ฿{gross.toLocaleString()} | หัก ฿{formDeductions.toLocaleString()} | ภาษี ฿{taxAmt.toLocaleString()}
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        คำนวณตาม: ค่าเที่ยว (฿{formBaseTripRate}) + จุด (฿{dropFee}) + ถัง (฿{unitFee}) + น้ำมัน (฿{formFuelAllowance})
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-slate-500 block">ยอดสุทธิทำจ่าย</span>
                      <span className="text-xl font-black text-blue-700">
                        ฿{net.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Status & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    สถานะการจ่ายเงิน
                  </label>
                  <select
                    value={formPayoutStatus}
                    onChange={(e) => setFormPayoutStatus(e.target.value as PayoutStatus)}
                    className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50"
                  >
                    <option value="pending">รอทำจ่าย (Pending)</option>
                    <option value="paid">จ่ายเงินแล้ว (Paid)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    หมายเหตุเพิ่มเติม
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น ขนส่งเสริมรอบพิเศษ..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddTripModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm shadow-blue-600/30 cursor-pointer"
                >
                  {editingTrip ? 'บันทึกการแก้ไข' : 'บันทึกรอบวิ่งงาน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: บันทึกการทำจ่ายเงิน (Process Payout Modal)
         ========================================================================= */}
      {payoutModalTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-emerald-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                <h3 className="font-black text-base">ทำจ่ายค่าจ้างรถจ้าง</h3>
              </div>
              <button
                onClick={() => setPayoutModalTrip(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
                <div>
                  <div className="font-bold text-emerald-900 text-sm">
                    {payoutModalTrip.vehiclePlate} ({payoutModalTrip.driverName})
                  </div>
                  <div className="text-xs text-emerald-700 mt-0.5">
                    วันที่วิ่ง: {formatThaiDate(payoutModalTrip.date)} (เที่ยวที่ {payoutModalTrip.tripNumber || 1})
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-emerald-700 block">ยอดสุทธิที่ต้องจ่าย</span>
                  <span className="text-xl font-black text-emerald-800">
                    ฿{payoutModalTrip.netPayout.toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  วันที่ทำจ่าย *
                </label>
                <input
                  type="date"
                  value={payoutDate}
                  onChange={(e) => setPayoutDate(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ช่องทางการจ่ายเงิน *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPayoutMethod('transfer')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                      payoutMethod === 'transfer'
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>โอนเงินเข้าบัญชี</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayoutMethod('cash')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                      payoutMethod === 'cash'
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>เงินสด (Cash)</span>
                  </button>
                </div>
              </div>

              {payoutMethod === 'transfer' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    เลขอ้างอิงสลิปโอนเงิน / รหัสธุรกรรม
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น TRF-20261012-998"
                    value={payoutRef}
                    onChange={(e) => setPayoutRef(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ผู้ทำรายการจ่ายเงิน *
                </label>
                <input
                  type="text"
                  value={payoutPayer}
                  onChange={(e) => setPayoutPayer(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  หมายเหตุการจ่าย
                </label>
                <input
                  type="text"
                  placeholder="เช่น จ่ายครบเรียบร้อย..."
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPayoutModalTrip(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPayout}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm shadow-emerald-600/30 cursor-pointer"
                >
                  ยืนยันทำจ่ายเรียบร้อย
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: พิมพ์ใบสำคัญจ่ายค่าจ้างรถจ้าง (Print Payment Voucher)
         ========================================================================= */}
      {(printVoucherTrip || printSummaryPeriod) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            {/* Header with Print button */}
            <div className="px-6 py-4 bg-slate-800 text-white flex items-center justify-between no-print">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-blue-400" />
                <span className="font-bold text-sm">
                  {printVoucherTrip ? 'พิมพ์ใบสำคัญจ่ายค่าจ้างรถจ้าง' : 'พิมพ์ใบสรุปค่าใช้จ่ายรถจ้างตามงวด'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>สั่งพิมพ์เอกสาร</span>
                </button>
                <button
                  onClick={() => {
                    setPrintVoucherTrip(null);
                    setPrintSummaryPeriod(false);
                  }}
                  className="p-1 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Paper Canvas */}
            <div className="p-8 text-slate-800 print-content bg-white">
              {/* Document Header */}
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                <div className="flex items-center gap-3">
                  <TotalEmblem className="w-12 h-12" />
                  <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none">
                      TOTAL WATER & LOGISTICS
                    </h2>
                    <p className="text-xs text-slate-600 mt-1">
                      บริษัท โทเทิ่ล วอเตอร์ ซัพพลาย แอนด์ โลจิสติกส์ จำกัด
                    </p>
                    <p className="text-[10px] text-slate-500">
                      ระบบบริหารจัดการค่าขนส่งและค่าจ้างรถร่วมบริการ (Delivery Freight Voucher)
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-blue-800 border border-blue-800 px-2 py-0.5 rounded">
                    เอกสารทางการเงิน
                  </span>
                  <p className="text-xs font-mono font-bold text-slate-700 mt-1">
                    {printVoucherTrip ? `DOC-${printVoucherTrip.id.slice(-8).toUpperCase()}` : `SUM-${new Date().toISOString().slice(0, 10)}`}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    พิมพ์เมื่อ: {new Date().toLocaleString('th-TH')}
                  </p>
                </div>
              </div>

              {/* Document Title */}
              <div className="my-5 text-center">
                <h1 className="text-lg font-black text-slate-900 tracking-wide uppercase">
                  {printVoucherTrip ? 'ใบสำคัญจ่ายค่าจ้างขนส่ง (Payment Voucher)' : 'ใบสรุปรายงานค่าจ้างรถจ้าง (Delivery Contractor Statement)'}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {printVoucherTrip
                    ? `รอบวิ่งประจำวันที่: ${formatThaiDate(printVoucherTrip.date)} (เที่ยวที่ ${printVoucherTrip.tripNumber || 1})`
                    : periodMode === 'daily'
                    ? `งวดประจำวันที่: ${formatThaiDate(selectedDate)}`
                    : periodMode === 'weekly'
                    ? `งวดประจำสัปดาห์/วิค: ${formatThaiDate(weekStartDate)} ถึง ${formatThaiDate(weekEndDate)}`
                    : `งวดประจำเดือน: ${selectedMonth}`}
                </p>
              </div>

              {/* Vehicle & Payee Details */}
              {printVoucherTrip ? (
                <div className="grid grid-cols-2 gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs mb-5">
                  <div>
                    <span className="text-slate-500">ทะเบียนรถ:</span>{' '}
                    <span className="font-bold text-slate-900">{printVoucherTrip.vehiclePlate}</span>
                    <span className="text-slate-400 ml-1">({printVoucherTrip.vehicleType || 'รถร่วม'})</span>
                  </div>
                  <div>
                    <span className="text-slate-500">พนักงานขับรถ/ผู้รับเงิน:</span>{' '}
                    <span className="font-bold text-slate-900">{printVoucherTrip.driverName}</span>
                    {printVoucherTrip.driverPhone && (
                      <span className="text-slate-500 ml-1">({printVoucherTrip.driverPhone})</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500">สายส่งที่วิ่ง:</span>{' '}
                    <span className="font-bold text-slate-900">{printVoucherTrip.routeName || 'สายส่งประจำ'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">สถานะการจ่ายเงิน:</span>{' '}
                    <span className="font-bold text-slate-900">
                      {printVoucherTrip.payoutStatus === 'paid'
                        ? `จ่ายแล้ว (${printVoucherTrip.paymentMethod === 'cash' ? 'เงินสด' : 'โอนเงิน'})`
                        : 'รอทำจ่าย'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs mb-5 flex items-center justify-between">
                  <div>
                    <span className="text-slate-500">รถที่วิ่งงาน:</span>{' '}
                    <span className="font-bold text-slate-900">
                      {filterVehicle === 'all' ? `รถทุกคัน (${metrics.vehicleCount} คัน)` : filterVehicle}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">จำนวนรอบวิ่งรวม:</span>{' '}
                    <span className="font-bold text-slate-900">{metrics.totalTrips} เที่ยว</span>
                  </div>
                  <div>
                    <span className="text-slate-500">ยอดส่งรวม:</span>{' '}
                    <span className="font-bold text-slate-900">{metrics.totalUnits} ถัง/หน่วย</span>
                  </div>
                </div>
              )}

              {/* Itemized Table */}
              <table className="w-full text-xs border border-slate-300 border-collapse mb-5">
                <thead>
                  <tr className="bg-slate-100 font-bold text-slate-700 border-b border-slate-300">
                    <th className="p-2 border-r border-slate-300 text-left">รายการค่าใช้จ่าย / การคำนวณ</th>
                    <th className="p-2 border-r border-slate-300 text-center w-24">จำนวน</th>
                    <th className="p-2 border-r border-slate-300 text-right w-24">อัตรา</th>
                    <th className="p-2 text-right w-28">จำนวนเงิน (บาท)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {printVoucherTrip ? (
                    <>
                      <tr>
                        <td className="p-2 border-r border-slate-200">ค่าเที่ยวพื้นฐาน (Base Trip Rate)</td>
                        <td className="p-2 border-r border-slate-200 text-center">1 เที่ยว</td>
                        <td className="p-2 border-r border-slate-200 text-right">
                          ฿{printVoucherTrip.baseTripRate.toLocaleString()}
                        </td>
                        <td className="p-2 text-right font-semibold">
                          ฿{printVoucherTrip.baseTripRate.toLocaleString()}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 border-r border-slate-200">ค่าจุดส่ง (Drop Fee)</td>
                        <td className="p-2 border-r border-slate-200 text-center">
                          {printVoucherTrip.dropCount} จุด
                        </td>
                        <td className="p-2 border-r border-slate-200 text-right">
                          ฿{printVoucherTrip.dropRate}
                        </td>
                        <td className="p-2 text-right font-semibold">
                          ฿{(printVoucherTrip.totalDropFee || 0).toLocaleString()}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 border-r border-slate-200">ค่าคอมมิชชั่นตามยอดถัง (Unit Fee)</td>
                        <td className="p-2 border-r border-slate-200 text-center">
                          {printVoucherTrip.totalUnitsDelivered} ถัง
                        </td>
                        <td className="p-2 border-r border-slate-200 text-right">
                          ฿{printVoucherTrip.unitRate}
                        </td>
                        <td className="p-2 text-right font-semibold">
                          ฿{(printVoucherTrip.totalUnitFee || 0).toLocaleString()}
                        </td>
                      </tr>
                      {printVoucherTrip.fuelAllowance > 0 && (
                        <tr>
                          <td className="p-2 border-r border-slate-200">ค่าน้ำมัน / เบี้ยเลี้ยง (Fuel Allowance)</td>
                          <td className="p-2 border-r border-slate-200 text-center">-</td>
                          <td className="p-2 border-r border-slate-200 text-right">-</td>
                          <td className="p-2 text-right font-semibold">
                            ฿{printVoucherTrip.fuelAllowance.toLocaleString()}
                          </td>
                        </tr>
                      )}
                      {printVoucherTrip.overtimeOrSpecialFee > 0 && (
                        <tr>
                          <td className="p-2 border-r border-slate-200">ค่าล่วงเวลา / เที่ยวพิเศษ (Overtime/Special)</td>
                          <td className="p-2 border-r border-slate-200 text-center">-</td>
                          <td className="p-2 border-r border-slate-200 text-right">-</td>
                          <td className="p-2 text-right font-semibold">
                            ฿{printVoucherTrip.overtimeOrSpecialFee.toLocaleString()}
                          </td>
                        </tr>
                      )}
                      <tr className="bg-slate-50 font-bold">
                        <td colSpan={3} className="p-2 border-r border-slate-200 text-right">
                          รวมยอดก่อนหัก (Gross Total):
                        </td>
                        <td className="p-2 text-right">
                          ฿{printVoucherTrip.grossAmount.toLocaleString()}
                        </td>
                      </tr>
                      {printVoucherTrip.deductions > 0 && (
                        <tr className="text-rose-600">
                          <td className="p-2 border-r border-slate-200">
                            หัก: ค่าปรับ / สินค้าชำรุดเสียหาย ({printVoucherTrip.deductionReason || 'ชำรุด'})
                          </td>
                          <td className="p-2 border-r border-slate-200 text-center">-</td>
                          <td className="p-2 border-r border-slate-200 text-right">-</td>
                          <td className="p-2 text-right font-semibold">
                            -฿{printVoucherTrip.deductions.toLocaleString()}
                          </td>
                        </tr>
                      )}
                      {printVoucherTrip.taxWithholdingAmount > 0 && (
                        <tr className="text-rose-600">
                          <td className="p-2 border-r border-slate-200">
                            หัก: ภาษี ณ ที่จ่าย (Withholding Tax {printVoucherTrip.taxWithholdingPercent}%)
                          </td>
                          <td className="p-2 border-r border-slate-200 text-center">
                            {printVoucherTrip.taxWithholdingPercent}%
                          </td>
                          <td className="p-2 border-r border-slate-200 text-right">-</td>
                          <td className="p-2 text-right font-semibold">
                            -฿{printVoucherTrip.taxWithholdingAmount.toLocaleString()}
                          </td>
                        </tr>
                      )}
                    </>
                  ) : (
                    <>
                      <tr>
                        <td className="p-2 border-r border-slate-200">รวมค่าเที่ยวพื้นฐาน ({metrics.totalTrips} เที่ยว)</td>
                        <td className="p-2 border-r border-slate-200 text-center">{metrics.totalTrips}</td>
                        <td className="p-2 border-r border-slate-200 text-right">-</td>
                        <td className="p-2 text-right font-semibold">฿{metrics.totalBasePay.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td className="p-2 border-r border-slate-200">รวมค่าจุดส่ง ({metrics.totalDrops} จุด)</td>
                        <td className="p-2 border-r border-slate-200 text-center">{metrics.totalDrops}</td>
                        <td className="p-2 border-r border-slate-200 text-right">-</td>
                        <td className="p-2 text-right font-semibold">฿{metrics.totalDropFee.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td className="p-2 border-r border-slate-200">รวมค่าส่งตามยอดถัง ({metrics.totalUnits} ถัง)</td>
                        <td className="p-2 border-r border-slate-200 text-center">{metrics.totalUnits}</td>
                        <td className="p-2 border-r border-slate-200 text-right">-</td>
                        <td className="p-2 text-right font-semibold">฿{metrics.totalUnitFee.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td className="p-2 border-r border-slate-200">รวมค่าน้ำมัน เบี้ยเลี้ยง และ OT</td>
                        <td className="p-2 border-r border-slate-200 text-center">-</td>
                        <td className="p-2 border-r border-slate-200 text-right">-</td>
                        <td className="p-2 text-right font-semibold">
                          ฿{(metrics.totalFuel + metrics.totalOt).toLocaleString()}
                        </td>
                      </tr>
                      <tr className="bg-slate-50 font-bold">
                        <td colSpan={3} className="p-2 border-r border-slate-200 text-right">
                          รวมยอดก่อนหัก (Gross Total):
                        </td>
                        <td className="p-2 text-right">฿{metrics.totalGross.toLocaleString()}</td>
                      </tr>
                      <tr className="text-rose-600">
                        <td colSpan={3} className="p-2 border-r border-slate-200 text-right">
                          รวมรายการหัก & ภาษี ณ ที่จ่าย:
                        </td>
                        <td className="p-2 text-right font-semibold">
                          -฿{(metrics.totalDeductions + metrics.totalTaxWithheld).toLocaleString()}
                        </td>
                      </tr>
                    </>
                  )}
                  {/* Final Net Amount */}
                  <tr className="bg-blue-50/80 font-black text-slate-900 border-t-2 border-slate-400">
                    <td colSpan={3} className="p-3 text-right text-xs">
                      ยอดจ่ายสุทธิทั้งสิ้น (Net Amount Payable):
                    </td>
                    <td className="p-3 text-right text-base text-blue-900">
                      ฿{printVoucherTrip ? printVoucherTrip.netPayout.toLocaleString() : metrics.totalNet.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Thai Baht Text */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs mb-8">
                <span className="text-slate-500 font-semibold">จำนวนเงินตัวอักษร:</span>{' '}
                <span className="font-bold text-slate-900 ml-1">
                  ({bahtText(printVoucherTrip ? printVoucherTrip.netPayout : metrics.totalNet)})
                </span>
              </div>

              {/* Signatures 4-box layout */}
              <div className="grid grid-cols-4 gap-3 text-center text-xs mt-10 pt-4 border-t border-slate-200">
                <div className="space-y-8">
                  <div className="h-10 border-b border-dashed border-slate-400"></div>
                  <div>
                    <p className="font-bold text-slate-800">ผู้จัดทำเอกสาร</p>
                    <p className="text-[10px] text-slate-500">(เจ้าหน้าที่โลจิสติกส์)</p>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="h-10 border-b border-dashed border-slate-400"></div>
                  <div>
                    <p className="font-bold text-slate-800">ผู้ตรวจสอบ</p>
                    <p className="text-[10px] text-slate-500">(หัวหน้าฝ่ายขนส่ง)</p>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="h-10 border-b border-dashed border-slate-400"></div>
                  <div>
                    <p className="font-bold text-slate-800">ผู้มีอำนาจอนุมัติจ่าย</p>
                    <p className="text-[10px] text-slate-500">(ผู้จัดการ/ฝ่ายบัญชี)</p>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="h-10 border-b border-dashed border-slate-400"></div>
                  <div>
                    <p className="font-bold text-slate-800">
                      {printVoucherTrip ? printVoucherTrip.driverName : 'ผู้รับเงิน / คนขับรถ'}
                    </p>
                    <p className="text-[10px] text-slate-500">(พนักงานขับรถรับจ้าง)</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: ตั้งค่าอัตราค่าจ้างเริ่มต้น (Default Rate Settings Modal)
         ========================================================================= */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-blue-400" />
                <h3 className="font-black text-base">ตั้งค่าอัตราค่าจ้างรถจ้างเริ่มต้น</h3>
              </div>
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <p className="text-slate-500 text-[11px]">
                ค่าเริ่มต้นเหล่านี้จะถูกนำไปใช้โดยอัตโนมัติเมื่อมีการดึงข้อมูลการวิ่งงานจากแผนจัดส่ง หรือสร้างรอบวิ่งงานใหม่
              </p>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  ค่าเที่ยวพื้นฐานเริ่มต้น (บาท/เที่ยว)
                </label>
                <input
                  type="number"
                  value={defaultBaseRate}
                  onChange={(e) => setDefaultBaseRate(Number(e.target.value))}
                  className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  ค่าจุดส่ง (บาท/จุด)
                </label>
                <input
                  type="number"
                  value={defaultDropRate}
                  onChange={(e) => setDefaultDropRate(Number(e.target.value))}
                  className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  ค่าคอมมิชชั่นตามยอดส่ง (บาท/ถัง)
                </label>
                <input
                  type="number"
                  value={defaultUnitRate}
                  onChange={(e) => setDefaultUnitRate(Number(e.target.value))}
                  className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  ค่าน้ำมัน / เบี้ยเลี้ยงคงที่ (บาท/วัน)
                </label>
                <input
                  type="number"
                  value={defaultFuelAllowance}
                  onChange={(e) => setDefaultFuelAllowance(Number(e.target.value))}
                  className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('hired_default_base_rate', String(defaultBaseRate));
                    localStorage.setItem('hired_default_drop_rate', String(defaultDropRate));
                    localStorage.setItem('hired_default_unit_rate', String(defaultUnitRate));
                    localStorage.setItem('hired_default_fuel', String(defaultFuelAllowance));
                    setIsSettingsModalOpen(false);
                  }}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
                >
                  บันทึกการตั้งค่า
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
