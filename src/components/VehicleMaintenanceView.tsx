import React, { useState, useMemo } from 'react';
import {
  VehicleMaintenanceRecord,
  MaintenanceCategory,
  MaintenanceStatus,
  MaintenancePartItem,
  StaffUser,
  Route,
} from '../types';
import { TotalEmblem } from './TotalLogo';
import {
  Wrench,
  Truck,
  Plus,
  Search,
  Filter,
  Printer,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Check,
  Edit2,
  Trash2,
  X,
  FileText,
  User,
  Phone,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Gauge,
  Layers,
  ChevronRight,
  Eye,
  Camera,
  DollarSign,
  TrendingUp,
  MapPin,
  ShieldAlert,
  ArrowUpRight,
  BarChart3,
  PieChart,
  Activity,
  ArrowUpDown,
  SlidersHorizontal,
  FileSpreadsheet,
  Percent,
} from 'lucide-react';

interface VehicleMaintenanceViewProps {
  records: VehicleMaintenanceRecord[];
  currentUser: StaffUser;
  staffList: StaffUser[];
  routes: Route[];
  onSaveRecord: (record: VehicleMaintenanceRecord) => Promise<void> | void;
  onUpdateRecord: (record: VehicleMaintenanceRecord) => Promise<void> | void;
  onDeleteRecord: (recordId: string) => Promise<void> | void;
  sheetsConnected: boolean;
}

// Preset logistics vehicles known in the system
const FLEET_VEHICLES = [
  { plate: '1ฒศ-8899', type: 'กระบะตอนเดียวตู้ทึบ', driver: 'สมชาย วงศ์สวัสดิ์', phone: '081-456-7890' },
  { plate: '2ฒข-4512', type: 'กระบะคอก', driver: 'วิชัย มั่นคง', phone: '089-234-5678' },
  { plate: '3ฒภ-9103', type: '4 ล้อใหญ่', driver: 'ประเสริฐ มีชัย', phone: '086-778-9900' },
  { plate: '4ฒจ-6641', type: 'กระบะตอนเดียวตู้ทึบ', driver: 'ธนกฤต ชัยชนะ', phone: '082-334-1122' },
  { plate: '5ฒส-1122', type: 'รถตู้ทึบส่งด่วน', driver: 'กิตติศักดิ์ เจริญดี', phone: '085-998-3344' },
];

const CATEGORY_MAP: Record<
  MaintenanceCategory,
  { label: string; icon: string; badgeClass: string; colorHex: string; desc: string }
> = {
  oil_change: {
    label: 'เปลี่ยนถ่ายน้ำมันเครื่อง & ไส้กรอง',
    icon: '🛢️',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    colorHex: '#f59e0b',
    desc: 'น้ำมันเครื่อง ไส้กรอง อากาศ เช็คของเหลว',
  },
  periodic_service: {
    label: 'เช็คระยะตามรอบ (กม.)',
    icon: '🔧',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
    colorHex: '#3b82f6',
    desc: 'ตรวจเช็คตามระยะ 10k-50k กม.',
  },
  tires_brakes: {
    label: 'ยางรถยนต์ & ระบบเบรก',
    icon: '🛑',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
    colorHex: '#f43f5e',
    desc: 'ผ้าเบรก จานเบรก ยางรถ สลับยาง ถ่วงล้อ',
  },
  battery_electrical: {
    label: 'แบตเตอรี่ & ระบบไฟ',
    icon: '⚡',
    badgeClass: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    colorHex: '#eab308',
    desc: 'แบตเตอรี่ ไดชาร์จ ไดสตาร์ท ไฟส่องสว่าง',
  },
  suspension_chassis: {
    label: 'ช่วงล่าง & แหนบรับน้ำหนัก',
    icon: '🏗️',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    colorHex: '#10b981',
    desc: 'เสริมแหนบ โช้คอัพ ลูกหมาก บูชยาง',
  },
  cooling_aircon: {
    label: 'หม้อน้ำ & ระบบแอร์',
    icon: '❄️',
    badgeClass: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    colorHex: '#06b6d4',
    desc: 'หม้อน้ำ พัดลม คอยล์เย็น คอมเพรสเซอร์',
  },
  emergency_repair: {
    label: 'ซ่อมแซมฉุกเฉิน / ยกเข้าอู่',
    icon: '🚨',
    badgeClass: 'bg-red-50 text-red-800 border-red-200',
    colorHex: '#ef4444',
    desc: 'เหตุเสียระหว่างทาง เครื่องยนต์ดับ',
  },
  inspection_tax: {
    label: 'ตรวจ ตรอ. & ต่อภาษี/พ.ร.บ.',
    icon: '📋',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
    colorHex: '#a855f7',
    desc: 'ต่อภาษีประจำปี ตรวจสภาพรถขนส่ง พ.ร.บ.',
  },
  other: {
    label: 'อื่นๆ / อุปกรณ์ส่วนควบ',
    icon: '📦',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
    colorHex: '#64748b',
    desc: 'ประตูล็อคตู้ทึบ เบาะนั่ง ติดฟิล์ม ฯลฯ',
  },
};

const STATUS_MAP: Record<
  MaintenanceStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  completed: {
    label: 'เสร็จสิ้น',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500',
  },
  in_progress: {
    label: 'กำลังดำเนินการ',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClass: 'bg-amber-500 animate-pulse',
  },
  scheduled: {
    label: 'นัดหมายล่วงหน้า',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClass: 'bg-blue-500',
  },
};

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

function formatThaiMonthYear(yearMonthStr: string): string {
  const parts = yearMonthStr.split('-');
  if (parts.length !== 2) return yearMonthStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const thaiMonths = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];
  const mName = thaiMonths[month - 1] || '';
  const thaiYear = year > 2400 ? year % 100 : (year + 543) % 100;
  return `${mName} ${thaiYear}`;
}

export const VehicleMaintenanceView: React.FC<VehicleMaintenanceViewProps> = ({
  records,
  currentUser,
  staffList,
  routes,
  onSaveRecord,
  onUpdateRecord,
  onDeleteRecord,
  sheetsConnected,
}) => {
  // Navigation / Main Tab View: 'dashboard' (Analytics & Comparison Charts) | 'records' (Log & Tables)
  const [activeMainTab, setActiveMainTab] = useState<'dashboard' | 'records'>('dashboard');

  // Search & Filter States for Records Tab
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlate, setSelectedPlate] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'this_week' | 'this_month'>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Dashboard Specific Controls
  const [dashboardVehicleFilter, setDashboardVehicleFilter] = useState<string>('all');
  const [dashboardYearFilter, setDashboardYearFilter] = useState<string>('all');
  const [vehicleSortKey, setVehicleSortKey] = useState<'cost_desc' | 'cost_asc' | 'count_desc' | 'cost_per_km'>('cost_desc');
  const [hoveredMonthKey, setHoveredMonthKey] = useState<string | null>(null);
  const [selectedBarPlate, setSelectedBarPlate] = useState<string | null>(null);

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<VehicleMaintenanceRecord | null>(null);
  const [detailRecord, setDetailRecord] = useState<VehicleMaintenanceRecord | null>(null);
  const [printableRecord, setPrintableRecord] = useState<VehicleMaintenanceRecord | null>(null);
  const [isPrintAllOpen, setIsPrintAllOpen] = useState(false);
  const [isPrintExecutiveBriefOpen, setIsPrintExecutiveBriefOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<VehicleMaintenanceRecord>>({
    date: new Date().toISOString().slice(0, 10),
    vehiclePlate: FLEET_VEHICLES[0].plate,
    vehicleType: FLEET_VEHICLES[0].type,
    driverName: FLEET_VEHICLES[0].driver,
    currentMileage: 100000,
    serviceCategory: 'oil_change',
    title: '',
    description: '',
    serviceCenter: '',
    invoiceNumber: '',
    costParts: 0,
    costLabor: 0,
    costOther: 0,
    totalCost: 0,
    status: 'completed',
    nextServiceMileage: 110000,
    nextServiceDate: '',
    partsList: [],
    notes: '',
    receiptPhotoUrl: '',
    recordedBy: currentUser.name,
  });

  const [formParts, setFormParts] = useState<MaintenancePartItem[]>([]);
  const [newPartName, setNewPartName] = useState('');
  const [newPartQty, setNewPartQty] = useState(1);
  const [newPartUnitPrice, setNewPartUnitPrice] = useState(0);

  // Vehicle list options (union of FLEET_VEHICLES + unique from records)
  const availableVehicles = useMemo(() => {
    const plates = new Set<string>();
    FLEET_VEHICLES.forEach((v) => plates.add(v.plate));
    records.forEach((r) => {
      if (r.vehiclePlate) plates.add(r.vehiclePlate);
    });
    return Array.from(plates);
  }, [records]);

  // Available Years in Records
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    records.forEach((r) => {
      if (r.date) {
        const y = r.date.slice(0, 4);
        if (y) years.add(y);
      }
    });
    return Array.from(years).sort().reverse();
  }, [records]);

  // Filtered Records for Records Tab
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Plate filter
      if (selectedPlate !== 'all' && r.vehiclePlate !== selectedPlate) return false;

      // Category filter
      if (selectedCategory !== 'all' && r.serviceCategory !== selectedCategory) return false;

      // Status filter
      if (selectedStatus !== 'all' && r.status !== selectedStatus) return false;

      // Date filter
      if (dateFilter !== 'all') {
        const todayStr = new Date().toISOString().slice(0, 10);
        if (dateFilter === 'today' && r.date !== todayStr) return false;
        if (dateFilter === 'this_month') {
          const currentMonthPrefix = todayStr.slice(0, 7);
          if (!r.date.startsWith(currentMonthPrefix)) return false;
        }
        if (dateFilter === 'this_week') {
          const now = new Date();
          const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          const rDate = new Date(r.date);
          if (rDate < oneWeekAgo || rDate > now) return false;
        }
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchPlate = r.vehiclePlate.toLowerCase().includes(q);
        const matchTitle = r.title.toLowerCase().includes(q);
        const matchCenter = r.serviceCenter.toLowerCase().includes(q);
        const matchDriver = (r.driverName || '').toLowerCase().includes(q);
        const matchInvoice = (r.invoiceNumber || '').toLowerCase().includes(q);
        const matchNotes = (r.notes || '').toLowerCase().includes(q);
        if (!matchPlate && !matchTitle && !matchCenter && !matchDriver && !matchInvoice && !matchNotes) {
          return false;
        }
      }

      return true;
    });
  }, [records, selectedPlate, selectedCategory, selectedStatus, dateFilter, searchTerm]);

  // Sort: descending by date
  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredRecords]);

  // Overall Statistics for Records Tab & Preventive Alerts
  const stats = useMemo(() => {
    const totalCost = filteredRecords.reduce((sum, r) => sum + (r.totalCost || 0), 0);
    const completedCount = filteredRecords.filter((r) => r.status === 'completed').length;
    const inProgressCount = filteredRecords.filter((r) => r.status === 'in_progress').length;
    const scheduledCount = filteredRecords.filter((r) => r.status === 'scheduled').length;

    // Upcoming service alerts: records that have nextServiceMileage or nextServiceDate
    const today = new Date().toISOString().slice(0, 10);
    const alerts: { record: VehicleMaintenanceRecord; reason: string; urgent: boolean }[] = [];

    // Find highest mileage recorded per vehicle
    const vehicleMaxMileage: Record<string, number> = {};
    records.forEach((r) => {
      if (r.currentMileage > (vehicleMaxMileage[r.vehiclePlate] || 0)) {
        vehicleMaxMileage[r.vehiclePlate] = r.currentMileage;
      }
    });

    records.forEach((r) => {
      const maxMileage = vehicleMaxMileage[r.vehiclePlate] || r.currentMileage;
      if (r.nextServiceMileage && r.nextServiceMileage > 0) {
        const remainingKm = r.nextServiceMileage - maxMileage;
        if (remainingKm <= 1500 && remainingKm >= 0) {
          alerts.push({
            record: r,
            reason: `ใกล้ถึงเลขไมล์กำหนด (${r.nextServiceMileage.toLocaleString()} กม. เหลืออีก ${remainingKm.toLocaleString()} กม.)`,
            urgent: remainingKm <= 500,
          });
        } else if (remainingKm < 0) {
          alerts.push({
            record: r,
            reason: `เกินกำหนดเลขไมล์แล้ว ${Math.abs(remainingKm).toLocaleString()} กม.! (กำหนด ${r.nextServiceMileage.toLocaleString()} กม.)`,
            urgent: true,
          });
        }
      }
      if (r.nextServiceDate) {
        if (r.nextServiceDate <= today && r.status !== 'completed') {
          alerts.push({
            record: r,
            reason: `ถึงกำหนดนัดหมายแล้ว (${formatThaiDate(r.nextServiceDate)})`,
            urgent: true,
          });
        }
      }
    });

    return {
      totalCost,
      totalCount: filteredRecords.length,
      completedCount,
      inProgressCount,
      scheduledCount,
      alerts,
    };
  }, [filteredRecords, records]);

  // =========================================================================
  // DASHBOARD ANALYTICS COMPUTATIONS (MONTHLY TREND & VEHICLE COMPARISON)
  // =========================================================================

  // Scope records for Dashboard based on year & vehicle filters
  const dashboardScopedRecords = useMemo(() => {
    return records.filter((r) => {
      if (dashboardVehicleFilter !== 'all' && r.vehiclePlate !== dashboardVehicleFilter) {
        return false;
      }
      if (dashboardYearFilter !== 'all' && !r.date.startsWith(dashboardYearFilter)) {
        return false;
      }
      return true;
    });
  }, [records, dashboardVehicleFilter, dashboardYearFilter]);

  // Executive Budget KPI Metrics
  const budgetKpi = useMemo(() => {
    const totalSpend = dashboardScopedRecords.reduce((sum, r) => sum + (r.totalCost || 0), 0);
    const totalParts = dashboardScopedRecords.reduce((sum, r) => sum + (r.costParts || 0), 0);
    const totalLabor = dashboardScopedRecords.reduce((sum, r) => sum + (r.costLabor || 0), 0);
    const totalOther = dashboardScopedRecords.reduce((sum, r) => sum + (r.costOther || 0), 0);
    const totalJobs = dashboardScopedRecords.length;

    // Distinct vehicles in scoped records
    const distinctPlates = new Set(dashboardScopedRecords.map((r) => r.vehiclePlate));
    const vehicleCount = Math.max(1, distinctPlates.size);
    const avgSpendPerVehicle = Math.round(totalSpend / vehicleCount);

    // Distinct months in scoped records
    const distinctMonths = new Set(dashboardScopedRecords.map((r) => r.date.slice(0, 7)));
    const monthCount = Math.max(1, distinctMonths.size);
    const avgSpendPerMonth = Math.round(totalSpend / monthCount);

    // Sum of max mileage across fleet to calculate average cost per km
    const vehicleMaxMileage: Record<string, number> = {};
    records.forEach((r) => {
      if (r.currentMileage > (vehicleMaxMileage[r.vehiclePlate] || 0)) {
        vehicleMaxMileage[r.vehiclePlate] = r.currentMileage;
      }
    });
    const totalFleetMileage = Object.values(vehicleMaxMileage).reduce((s, m) => s + m, 0);
    const costPerKm = totalFleetMileage > 0 ? (totalSpend / totalFleetMileage).toFixed(2) : '0.00';

    // Parts vs Labor ratios
    const partsPercent = totalSpend > 0 ? Math.round((totalParts / totalSpend) * 100) : 0;
    const laborPercent = totalSpend > 0 ? Math.round((totalLabor / totalSpend) * 100) : 0;
    const otherPercent = totalSpend > 0 ? Math.max(0, 100 - partsPercent - laborPercent) : 0;

    // Top Expense Vehicle
    const spendByPlate: Record<string, number> = {};
    dashboardScopedRecords.forEach((r) => {
      spendByPlate[r.vehiclePlate] = (spendByPlate[r.vehiclePlate] || 0) + (r.totalCost || 0);
    });
    let topVehiclePlate = '-';
    let topVehicleSpend = 0;
    Object.entries(spendByPlate).forEach(([plate, spend]) => {
      if (spend > topVehicleSpend) {
        topVehicleSpend = spend;
        topVehiclePlate = plate;
      }
    });

    return {
      totalSpend,
      totalParts,
      totalLabor,
      totalOther,
      totalJobs,
      vehicleCount,
      avgSpendPerVehicle,
      avgSpendPerMonth,
      costPerKm,
      partsPercent,
      laborPercent,
      otherPercent,
      topVehiclePlate,
      topVehicleSpend,
    };
  }, [dashboardScopedRecords, records]);

  // 1. Monthly Expenses Comparison Data (Chronological)
  const monthlyChartData = useMemo(() => {
    const monthMap: Record<
      string,
      {
        monthKey: string;
        label: string;
        total: number;
        parts: number;
        labor: number;
        other: number;
        count: number;
      }
    > = {};

    dashboardScopedRecords.forEach((r) => {
      if (!r.date) return;
      const mKey = r.date.slice(0, 7); // e.g. 2026-03
      if (!monthMap[mKey]) {
        monthMap[mKey] = {
          monthKey: mKey,
          label: formatThaiMonthYear(mKey),
          total: 0,
          parts: 0,
          labor: 0,
          other: 0,
          count: 0,
        };
      }
      monthMap[mKey].total += r.totalCost || 0;
      monthMap[mKey].parts += r.costParts || 0;
      monthMap[mKey].labor += r.costLabor || 0;
      monthMap[mKey].other += r.costOther || 0;
      monthMap[mKey].count += 1;
    });

    // Sort chronologically ascending
    const sorted = Object.values(monthMap).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    const maxMonthTotal = Math.max(...sorted.map((m) => m.total), 1);
    const avgMonthTotal = sorted.length > 0 ? sorted.reduce((s, m) => s + m.total, 0) / sorted.length : 0;

    // Peak month
    let peakMonth = sorted[0];
    sorted.forEach((m) => {
      if (!peakMonth || m.total > peakMonth.total) peakMonth = m;
    });

    return {
      months: sorted,
      maxMonthTotal,
      avgMonthTotal,
      peakMonth,
    };
  }, [dashboardScopedRecords]);

  // 2. Vehicle Expenses Comparison Data
  const vehicleChartData = useMemo(() => {
    const vehicleMap: Record<
      string,
      {
        plate: string;
        type: string;
        driver: string;
        total: number;
        parts: number;
        labor: number;
        other: number;
        count: number;
        maxMileage: number;
        costPerKm: number;
        budgetShare: number;
      }
    > = {};

    // Seed preset fleet vehicles so even vehicles with 0 repairs appear in the budget comparison!
    availableVehicles.forEach((plate) => {
      const matchFleet = FLEET_VEHICLES.find((v) => v.plate === plate);
      vehicleMap[plate] = {
        plate,
        type: matchFleet?.type || 'ยานพาหนะขนส่ง',
        driver: matchFleet?.driver || '-',
        total: 0,
        parts: 0,
        labor: 0,
        other: 0,
        count: 0,
        maxMileage: 0,
        costPerKm: 0,
        budgetShare: 0,
      };
    });

    // Populate data from scoped records
    dashboardScopedRecords.forEach((r) => {
      const plate = r.vehiclePlate;
      if (!vehicleMap[plate]) {
        vehicleMap[plate] = {
          plate,
          type: r.vehicleType || 'ยานพาหนะขนส่ง',
          driver: r.driverName || '-',
          total: 0,
          parts: 0,
          labor: 0,
          other: 0,
          count: 0,
          maxMileage: 0,
          costPerKm: 0,
          budgetShare: 0,
        };
      }
      vehicleMap[plate].total += r.totalCost || 0;
      vehicleMap[plate].parts += r.costParts || 0;
      vehicleMap[plate].labor += r.costLabor || 0;
      vehicleMap[plate].other += r.costOther || 0;
      vehicleMap[plate].count += 1;
      if (r.currentMileage > vehicleMap[plate].maxMileage) {
        vehicleMap[plate].maxMileage = r.currentMileage;
      }
    });

    const grandTotal = Math.max(
      1,
      Object.values(vehicleMap).reduce((s, v) => s + v.total, 0)
    );

    // Calculate costPerKm & budgetShare
    Object.values(vehicleMap).forEach((v) => {
      v.budgetShare = Math.round((v.total / grandTotal) * 100);
      v.costPerKm = v.maxMileage > 0 ? parseFloat((v.total / v.maxMileage).toFixed(2)) : 0;
    });

    let list = Object.values(vehicleMap);

    // Sort according to user preference
    if (vehicleSortKey === 'cost_desc') {
      list.sort((a, b) => b.total - a.total);
    } else if (vehicleSortKey === 'cost_asc') {
      list.sort((a, b) => a.total - b.total);
    } else if (vehicleSortKey === 'count_desc') {
      list.sort((a, b) => b.count - a.count);
    } else if (vehicleSortKey === 'cost_per_km') {
      list.sort((a, b) => b.costPerKm - a.costPerKm);
    }

    const maxVehicleSpend = Math.max(...list.map((v) => v.total), 1);

    return {
      vehicles: list,
      maxVehicleSpend,
      grandTotal,
    };
  }, [dashboardScopedRecords, availableVehicles, vehicleSortKey]);

  // 3. Maintenance Category Distribution
  const categoryChartData = useMemo(() => {
    const catMap: Record<
      string,
      {
        category: MaintenanceCategory;
        label: string;
        icon: string;
        color: string;
        total: number;
        count: number;
        share: number;
      }
    > = {};

    dashboardScopedRecords.forEach((r) => {
      const c = r.serviceCategory || 'other';
      if (!catMap[c]) {
        const meta = CATEGORY_MAP[c] || CATEGORY_MAP.other;
        catMap[c] = {
          category: c,
          label: meta.label,
          icon: meta.icon,
          color: meta.colorHex,
          total: 0,
          count: 0,
          share: 0,
        };
      }
      catMap[c].total += r.totalCost || 0;
      catMap[c].count += 1;
    });

    const totalSpend = Math.max(
      1,
      Object.values(catMap).reduce((s, c) => s + c.total, 0)
    );
    const list = Object.values(catMap).map((c) => ({
      ...c,
      share: Math.round((c.total / totalSpend) * 100),
    }));

    list.sort((a, b) => b.total - a.total);
    return list;
  }, [dashboardScopedRecords]);

  // Open Form Modal for Create
  const handleOpenCreateModal = (presetPlate?: string) => {
    const targetPlate = presetPlate || FLEET_VEHICLES[0].plate;
    const fleetMatch = FLEET_VEHICLES.find((v) => v.plate === targetPlate);
    const existingForPlate = records.filter((r) => r.vehiclePlate === targetPlate);
    const maxMileage = existingForPlate.reduce((max, r) => Math.max(max, r.currentMileage), 0);
    const currentMileage = maxMileage > 0 ? maxMileage + 100 : 100000;

    setEditingRecord(null);
    setFormParts([]);
    setNewPartName('');
    setNewPartQty(1);
    setNewPartUnitPrice(0);

    setFormData({
      id: `mnt-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().slice(0, 10),
      vehiclePlate: targetPlate,
      vehicleType: fleetMatch?.type || 'กระบะตอนเดียวตู้ทึบ',
      driverName: fleetMatch?.driver || '',
      currentMileage: currentMileage,
      serviceCategory: 'oil_change',
      title: '',
      description: '',
      serviceCenter: '',
      invoiceNumber: '',
      costParts: 0,
      costLabor: 0,
      costOther: 0,
      totalCost: 0,
      status: 'completed',
      nextServiceMileage: currentMileage + 10000,
      nextServiceDate: '',
      notes: '',
      receiptPhotoUrl: '',
      recordedBy: currentUser.name,
    });
    setIsFormModalOpen(true);
  };

  // Open Form Modal for Edit
  const handleOpenEditModal = (rec: VehicleMaintenanceRecord) => {
    setEditingRecord(rec);
    setFormParts(rec.partsList || []);
    setNewPartName('');
    setNewPartQty(1);
    setNewPartUnitPrice(0);

    setFormData({ ...rec });
    setIsFormModalOpen(true);
  };

  // Add Part Row in Form
  const handleAddPartItem = () => {
    if (!newPartName.trim()) return;
    const qty = Math.max(1, newPartQty);
    const unitPrice = Math.max(0, newPartUnitPrice);
    const totalPrice = qty * unitPrice;
    const updated = [
      ...formParts,
      {
        name: newPartName.trim(),
        quantity: qty,
        unitPrice,
        totalPrice,
      },
    ];
    setFormParts(updated);

    // Auto-update parts cost
    const sumParts = updated.reduce((s, p) => s + p.totalPrice, 0);
    const labor = Number(formData.costLabor) || 0;
    const other = Number(formData.costOther) || 0;
    setFormData((prev) => ({
      ...prev,
      costParts: sumParts,
      totalCost: sumParts + labor + other,
    }));

    setNewPartName('');
    setNewPartQty(1);
    setNewPartUnitPrice(0);
  };

  // Remove Part Row
  const handleRemovePartItem = (index: number) => {
    const updated = formParts.filter((_, idx) => idx !== index);
    setFormParts(updated);
    const sumParts = updated.reduce((s, p) => s + p.totalPrice, 0);
    const labor = Number(formData.costLabor) || 0;
    const other = Number(formData.costOther) || 0;
    setFormData((prev) => ({
      ...prev,
      costParts: sumParts,
      totalCost: sumParts + labor + other,
    }));
  };

  // Auto calculate total cost when parts, labor, or other changes
  const handleCostChange = (field: 'costParts' | 'costLabor' | 'costOther', value: number) => {
    setFormData((prev) => {
      const parts = field === 'costParts' ? value : Number(prev.costParts) || 0;
      const labor = field === 'costLabor' ? value : Number(prev.costLabor) || 0;
      const other = field === 'costOther' ? value : Number(prev.costOther) || 0;
      return {
        ...prev,
        [field]: value,
        totalCost: parts + labor + other,
      };
    });
  };

  // Form Submit (Save / Update)
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehiclePlate || !formData.title || !formData.date) {
      alert('กรุณากรอกข้อมูลทะเบียนรถ วันที่ และชื่องานบำรุงรักษาให้ครบถ้วน');
      return;
    }

    const recToSave: VehicleMaintenanceRecord = {
      id: editingRecord?.id || formData.id || `mnt-${Date.now().toString().slice(-6)}`,
      date: formData.date || new Date().toISOString().slice(0, 10),
      vehiclePlate: formData.vehiclePlate,
      vehicleType: formData.vehicleType,
      driverName: formData.driverName,
      currentMileage: Number(formData.currentMileage) || 0,
      serviceCategory: formData.serviceCategory || 'periodic_service',
      title: formData.title.trim(),
      description: formData.description?.trim(),
      serviceCenter: formData.serviceCenter?.trim() || 'อู่ทั่วไป',
      invoiceNumber: formData.invoiceNumber?.trim(),
      costParts: Number(formData.costParts) || 0,
      costLabor: Number(formData.costLabor) || 0,
      costOther: Number(formData.costOther) || 0,
      totalCost: Number(formData.totalCost) || 0,
      status: formData.status || 'completed',
      nextServiceMileage: formData.nextServiceMileage ? Number(formData.nextServiceMileage) : undefined,
      nextServiceDate: formData.nextServiceDate || undefined,
      partsList: formParts.length > 0 ? formParts : undefined,
      receiptPhotoUrl: formData.receiptPhotoUrl,
      recordedBy: formData.recordedBy || currentUser.name,
      notes: formData.notes?.trim(),
    };

    if (editingRecord) {
      await onUpdateRecord(recToSave);
    } else {
      await onSaveRecord(recToSave);
    }

    setIsFormModalOpen(false);
    setEditingRecord(null);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'รหัสงาน',
      'วันที่',
      'ทะเบียนรถ',
      'ประเภทรถ',
      'ผู้ขับขี่',
      'เลขไมล์ (กม.)',
      'หมวดหมู่',
      'ชื่องานซ่อมบำรุง',
      'ศูนย์บริการ/อู่',
      'เลขที่ใบเสร็จ',
      'ค่าอะไหล่',
      'ค่าแรง',
      'ค่าใช้จ่ายอื่นๆ',
      'รวมสุทธิ',
      'สถานะ',
      'เลขไมล์รอบถัดไป',
      'วันที่นัดถัดไป',
      'ผู้บันทึก',
      'หมายเหตุ',
    ];

    const rows = sortedRecords.map((r) => [
      `"${r.id}"`,
      `"${r.date}"`,
      `"${r.vehiclePlate}"`,
      `"${r.vehicleType || ''}"`,
      `"${r.driverName || ''}"`,
      r.currentMileage,
      `"${CATEGORY_MAP[r.serviceCategory]?.label || r.serviceCategory}"`,
      `"${r.title.replace(/"/g, '""')}"`,
      `"${r.serviceCenter.replace(/"/g, '""')}"`,
      `"${r.invoiceNumber || ''}"`,
      r.costParts,
      r.costLabor,
      r.costOther || 0,
      r.totalCost,
      `"${STATUS_MAP[r.status]?.label || r.status}"`,
      r.nextServiceMileage || '',
      `"${r.nextServiceDate || ''}"`,
      `"${r.recordedBy}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `บันทึกบำรุงรักษารถ_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* 1. Header & Navigation Modes */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-black text-slate-800 tracking-tight">
                บันทึกบำรุงรักษารถ & แดชบอร์ดงบประมาณ
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Logistics Fleet Maintenance & Budget
              </span>
              {sheetsConnected && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Check className="w-3 h-3" />
                  Google Sheets ซิงค์แล้ว
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              แดชบอร์ดวิเคราะห์งบประมาณ เปรียบเทียบค่าใช้จ่ายรายเดือนและรายคันรถสำหรับผู้จัดการฝ่ายโลจิสติกส์
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleOpenCreateModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            บันทึกงานซ่อม/บำรุงรักษา
          </button>

          {activeMainTab === 'dashboard' ? (
            <button
              onClick={() => setIsPrintExecutiveBriefOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-xl border border-indigo-200 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              พิมพ์สรุปงบประมาณผู้บริหาร
            </button>
          ) : (
            <button
              onClick={() => setIsPrintAllOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              พิมพ์รายงานสรุป
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            ส่งออก CSV
          </button>
        </div>
      </div>

      {/* 2. Top-Level Tab Switcher: Dashboard vs Records Log */}
      <div className="bg-slate-100/90 p-1.5 rounded-2xl flex items-center justify-between border border-slate-200/80">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveMainTab('dashboard')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeMainTab === 'dashboard'
                ? 'bg-white text-blue-700 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-blue-600" />
            <span>แดชบอร์ดงบประมาณ & กราฟเปรียบเทียบ</span>
            <span className="px-1.5 py-0.2 rounded-md bg-blue-100 text-blue-700 text-[10px]">
              Manager Overview
            </span>
          </button>

          <button
            onClick={() => setActiveMainTab('records')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeMainTab === 'records'
                ? 'bg-white text-blue-700 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>รายการบันทึกประวัติซ่อม ({records.length})</span>
          </button>
        </div>

        {/* Quick info tag on right side of tab switcher */}
        <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 pr-3">
          <Activity className="w-3.5 h-3.5 text-emerald-500" />
          <span>กองยานพาหนะทั้งหมด {availableVehicles.length} คัน</span>
        </div>
      </div>

      {/* 3. Preventive Maintenance Alert Banner (Always Visible if Any Alerts) */}
      {stats.alerts.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-amber-500/10 border border-amber-300 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  แจ้งเตือนการบำรุงรักษา & เช็คระยะ ({stats.alerts.length} รายการ)
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  Preventive Alert
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                ยานพาหนะต่อไปนี้ใกล้ถึงหรือเกินกำหนดรอบบำรุงรักษา กรุณาวางแผนนำรถเข้าตรวจเช็คเพื่อป้องกันรถเสียระหว่างการจัดส่งน้ำดื่ม
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 mt-3">
                {stats.alerts.slice(0, 3).map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-white/90 backdrop-blur-xs p-3 rounded-xl border border-amber-200 flex items-center justify-between gap-2 shadow-2xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {item.record.vehiclePlate}
                        </span>
                        <span className="text-[10px] text-slate-500 truncate">
                          ({item.record.driverName || 'ผู้ขับ'})
                        </span>
                      </div>
                      <p className={`text-[11px] mt-1 font-medium ${item.urgent ? 'text-rose-600 font-bold' : 'text-amber-700'}`}>
                        {item.reason}
                      </p>
                    </div>
                    <button
                      onClick={() => handleOpenCreateModal(item.record.vehiclePlate)}
                      className="px-2.5 py-1.5 text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors shrink-0 shadow-2xs cursor-pointer"
                    >
                      เปิดงานซ่อม
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW A: MANAGER EXECUTIVE BUDGET DASHBOARD & COMPARISON CHARTS            */}
      {/* ========================================================================= */}
      {activeMainTab === 'dashboard' ? (
        <div className="space-y-6">
          {/* Dashboard Scope Filters */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                ขอบเขตการวิเคราะห์งบประมาณ:
              </span>

              {/* Vehicle Filter for Dashboard */}
              <select
                value={dashboardVehicleFilter}
                onChange={(e) => setDashboardVehicleFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">รถทุกคันในกองยานพาหนะ ({availableVehicles.length} คัน)</option>
                {availableVehicles.map((plate) => (
                  <option key={plate} value={plate}>
                    {plate}
                  </option>
                ))}
              </select>

              {/* Year Filter */}
              <select
                value={dashboardYearFilter}
                onChange={(e) => setDashboardYearFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">ข้อมูลทุกปีงบประมาณ</option>
                {availableYears.map((yr) => {
                  const thaiYr = parseInt(yr, 10) > 2400 ? yr : parseInt(yr, 10) + 543;
                  return (
                    <option key={yr} value={yr}>
                      ปี {yr} (พ.ศ. {thaiYr})
                    </option>
                  );
                })}
              </select>

              {(dashboardVehicleFilter !== 'all' || dashboardYearFilter !== 'all') && (
                <button
                  onClick={() => {
                    setDashboardVehicleFilter('all');
                    setDashboardYearFilter('all');
                  }}
                  className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  ล้างตัวกรอง
                </button>
              )}
            </div>

            <div className="text-[11px] text-slate-500 font-medium flex items-center gap-2">
              <span>แสดงข้อมูล {dashboardScopedRecords.length} รายการ</span>
            </div>
          </div>

          {/* Executive KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Total Budget Spent */}
            <div className="bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">งบประมาณค่าซ่อมบำรุงรวม</span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2.5">
                <div className="text-2xl font-black text-slate-900 tracking-tight">
                  ฿{budgetKpi.totalSpend.toLocaleString()}
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>อะไหล่: ฿{budgetKpi.totalParts.toLocaleString()}</span>
                  <span>ค่าแรง: ฿{budgetKpi.totalLabor.toLocaleString()}</span>
                </div>
                <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex">
                  <div
                    className="bg-blue-600 h-full"
                    style={{ width: `${budgetKpi.partsPercent}%` }}
                    title={`ค่าอะไหล่ ${budgetKpi.partsPercent}%`}
                  />
                  <div
                    className="bg-emerald-500 h-full"
                    style={{ width: `${budgetKpi.laborPercent}%` }}
                    title={`ค่าแรง ${budgetKpi.laborPercent}%`}
                  />
                  <div
                    className="bg-amber-400 h-full"
                    style={{ width: `${budgetKpi.otherPercent}%` }}
                    title={`อื่นๆ ${budgetKpi.otherPercent}%`}
                  />
                </div>
              </div>
            </div>

            {/* KPI 2: Average Monthly Run-Rate */}
            <div className="bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">ค่าใช้จ่ายเฉลี่ยต่อเดือน</span>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2.5">
                <div className="text-2xl font-black text-indigo-700 tracking-tight">
                  ฿{budgetKpi.avgSpendPerMonth.toLocaleString()}
                  <span className="text-xs font-normal text-slate-500"> /เดือน</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-indigo-600" />
                  <span>
                    เดือนที่จ่ายสูงสุด: {monthlyChartData.peakMonth ? monthlyChartData.peakMonth.label : '-'} (฿
                    {monthlyChartData.peakMonth ? monthlyChartData.peakMonth.total.toLocaleString() : '0'})
                  </span>
                </div>
              </div>
            </div>

            {/* KPI 3: Average Spend Per Vehicle */}
            <div className="bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">ค่าใช้จ่ายเฉลี่ยต่อคัน</span>
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2.5">
                <div className="text-2xl font-black text-purple-700 tracking-tight">
                  ฿{budgetKpi.avgSpendPerVehicle.toLocaleString()}
                  <span className="text-xs font-normal text-slate-500"> /คัน</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500 truncate">
                  <span>คันที่ใช้งบสูงสุด: </span>
                  <span className="font-bold text-slate-800">
                    {budgetKpi.topVehiclePlate}
                  </span>{' '}
                  (฿{budgetKpi.topVehicleSpend.toLocaleString()})
                </div>
              </div>
            </div>

            {/* KPI 4: Fleet Cost Efficiency (Cost / Km) */}
            <div className="bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">อัตราค่าซ่อมเฉลี่ยต่อ กม.</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Gauge className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2.5">
                <div className="text-2xl font-black text-emerald-700 tracking-tight">
                  ฿{budgetKpi.costPerKm}
                  <span className="text-xs font-normal text-slate-500"> /กิโลเมตร</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  <span>ความคุ้มค่าการเดินรถจัดส่งน้ำดื่ม</span>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CHART 1: MONTHLY EXPENSES COMPARISON CHART (STACKED / TREND BAR CHART)     */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    กราฟเปรียบเทียบค่าใช้จ่ายรายเดือน (Monthly Maintenance Expenses Comparison)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  วิเคราะห์แนวโน้มงบประมาณค่าซ่อมบำรุงรายเดือน พร้อมแยกสัดส่วนค่าอะไหล่ (น้ำเงิน) และค่าแรงช่าง (เขียว)
                </p>
              </div>

              {/* Legend & Stats */}
              <div className="flex items-center gap-3 text-xs flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-blue-600 inline-block" />
                  <span className="text-slate-600 text-[11px]">ค่าอะไหล่</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />
                  <span className="text-slate-600 text-[11px]">ค่าแรงช่าง</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" />
                  <span className="text-slate-600 text-[11px]">อื่นๆ</span>
                </div>
                <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                  <span className="text-[11px] font-bold text-slate-700">
                    เฉลี่ยต่อเดือน: ฿{Math.round(monthlyChartData.avgMonthTotal).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Interactive Bar Chart Canvas */}
            {monthlyChartData.months.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                ไม่มีข้อมูลงานบำรุงรักษาในเงื่อนไขที่เลือก
              </div>
            ) : (
              <div className="pt-4">
                <div className="h-64 sm:h-72 flex items-end gap-2 sm:gap-4 justify-between border-b border-slate-200 pb-2 relative">
                  {/* Monthly Average Benchmark Line */}
                  {monthlyChartData.avgMonthTotal > 0 && (
                    <div
                      className="absolute left-0 right-0 border-t-2 border-dashed border-slate-300 pointer-events-none z-0"
                      style={{
                        bottom: `${Math.round((monthlyChartData.avgMonthTotal / monthlyChartData.maxMonthTotal) * 100)}%`,
                      }}
                    >
                      <span className="absolute right-0 -top-4 text-[10px] font-bold text-slate-400 bg-white/90 px-1 rounded-sm">
                        เส้นเฉลี่ย ฿{Math.round(monthlyChartData.avgMonthTotal).toLocaleString()}
                      </span>
                    </div>
                  )}

                  {monthlyChartData.months.map((m, idx) => {
                    const totalHeightPercent = Math.max(
                      8,
                      Math.round((m.total / monthlyChartData.maxMonthTotal) * 100)
                    );
                    const partsRatio = m.total > 0 ? (m.parts / m.total) * 100 : 0;
                    const laborRatio = m.total > 0 ? (m.labor / m.total) * 100 : 0;
                    const isHovered = hoveredMonthKey === m.monthKey;
                    const isPeak = monthlyChartData.peakMonth?.monthKey === m.monthKey;

                    return (
                      <div
                        key={m.monthKey}
                        onMouseEnter={() => setHoveredMonthKey(m.monthKey)}
                        onMouseLeave={() => setHoveredMonthKey(null)}
                        className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer z-10"
                      >
                        {/* Interactive Tooltip Card on Hover */}
                        {isHovered && (
                          <div className="absolute -top-24 sm:-top-28 z-30 bg-slate-900 text-white p-2.5 rounded-xl text-left shadow-xl border border-slate-700 min-w-[170px] pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                            <div className="text-[11px] font-bold text-amber-400 flex items-center justify-between">
                              <span>{m.label}</span>
                              <span className="text-[10px] text-slate-300">{m.count} งาน</span>
                            </div>
                            <div className="text-xs font-black text-white mt-0.5">
                              รวม ฿{m.total.toLocaleString()}
                            </div>
                            <div className="text-[10px] text-slate-300 space-y-0.5 mt-1 border-t border-slate-800 pt-1">
                              <div className="flex justify-between">
                                <span>ค่าอะไหล่:</span>
                                <span className="text-blue-300 font-semibold">฿{m.parts.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>ค่าแรง:</span>
                                <span className="text-emerald-300 font-semibold">฿{m.labor.toLocaleString()}</span>
                              </div>
                              {m.other > 0 && (
                                <div className="flex justify-between">
                                  <span>อื่นๆ:</span>
                                  <span className="text-amber-300 font-semibold">฿{m.other.toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Top Value Label */}
                        <div className="text-[10px] font-bold text-slate-700 mb-1 group-hover:text-blue-600 transition-colors whitespace-nowrap">
                          {isPeak && (
                            <span className="block text-[9px] font-extrabold text-amber-600">
                              สูงสุด!
                            </span>
                          )}
                          ฿{(m.total / 1000).toFixed(1)}k
                        </div>

                        {/* Stacked Bar Container */}
                        <div
                          className={`w-full max-w-[48px] rounded-t-xl overflow-hidden flex flex-col justify-end transition-all ${
                            isHovered
                              ? 'ring-2 ring-blue-500 shadow-md scale-y-[1.02]'
                              : 'hover:brightness-105'
                          }`}
                          style={{ height: `${totalHeightPercent}%` }}
                        >
                          {/* Segment: Other */}
                          {m.other > 0 && (
                            <div
                              className="bg-amber-400 w-full transition-all"
                              style={{ height: `${(m.other / m.total) * 100}%` }}
                              title={`อื่นๆ: ฿${m.other.toLocaleString()}`}
                            />
                          )}
                          {/* Segment: Labor */}
                          {m.labor > 0 && (
                            <div
                              className="bg-emerald-500 w-full transition-all"
                              style={{ height: `${laborRatio}%` }}
                              title={`ค่าแรง: ฿${m.labor.toLocaleString()}`}
                            />
                          )}
                          {/* Segment: Parts */}
                          <div
                            className="bg-blue-600 w-full flex-1 transition-all"
                            style={{ height: `${partsRatio}%` }}
                            title={`ค่าอะไหล่: ฿${m.parts.toLocaleString()}`}
                          />
                        </div>

                        {/* Month Axis Label */}
                        <div className="text-[10px] sm:text-xs font-semibold text-slate-600 mt-2 truncate w-full text-center">
                          {m.label}
                        </div>
                        <div className="text-[9px] text-slate-400">
                          {m.count} งาน
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* CHART 2: VEHICLE EXPENSES COMPARISON CHART (BY VEHICLE FLEET)              */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    กราฟเปรียบเทียบค่าใช้จ่ายรายคันรถ (Vehicle Maintenance Cost Comparison)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  เปรียบเทียบงบประมาณที่ใช้ไปของยานพาหนะแต่ละคัน สัดส่วน % และอัตราต้นทุนซ่อมบำรุงต่อกิโลเมตร
                </p>
              </div>

              {/* Sorting Options */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 text-[11px] font-semibold flex items-center gap-1">
                  <ArrowUpDown className="w-3.5 h-3.5" /> เรียงตาม:
                </span>
                <select
                  value={vehicleSortKey}
                  onChange={(e) => setVehicleSortKey(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="cost_desc">ค่าใช้จ่ายสูงสุด &rarr; น้อยสุด</option>
                  <option value="cost_asc">ค่าใช้จ่ายน้อยสุด &rarr; สูงสุด</option>
                  <option value="count_desc">จำนวนครั้งที่เข้าซ่อมมากสุด</option>
                  <option value="cost_per_km">อัตราค่าซ่อมต่อ กม. สูงสุด</option>
                </select>
              </div>
            </div>

            {/* Horizontal Comparison Bars */}
            <div className="space-y-3.5 pt-2">
              {vehicleChartData.vehicles.map((v) => {
                const widthPercent = Math.max(5, Math.round((v.total / vehicleChartData.maxVehicleSpend) * 100));
                const isSelected = selectedBarPlate === v.plate;

                return (
                  <div
                    key={v.plate}
                    onClick={() => {
                      setSelectedBarPlate(selectedBarPlate === v.plate ? null : v.plate);
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-300 shadow-sm'
                        : 'bg-slate-50/60 border-slate-200/80 hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                          <Truck className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-slate-900">{v.plate}</span>
                            <span className="text-[11px] font-semibold text-slate-500">
                              ({v.type})
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-medium">
                              ผู้ขับ: {v.driver}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-baseline gap-3 text-right">
                        <div>
                          <span className="text-[10px] text-slate-400">สัดส่วนงบ</span>
                          <span className="text-xs font-bold text-indigo-700 ml-1">
                            {v.budgetShare}%
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400">เข้าซ่อม</span>
                          <span className="text-xs font-bold text-slate-700 ml-1">
                            {v.count} ครั้ง
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400">ยอดรวม</span>
                          <span className="text-base font-black text-slate-900 ml-1.5">
                            ฿{v.total.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Comparison Bar */}
                    <div className="w-full bg-slate-200/80 rounded-full h-3.5 overflow-hidden flex shadow-inner">
                      {/* Segment: Parts */}
                      {v.total > 0 && (
                        <div
                          className="bg-blue-600 h-full transition-all flex items-center justify-center text-[9px] text-white font-bold"
                          style={{ width: `${(v.parts / vehicleChartData.maxVehicleSpend) * 100}%` }}
                          title={`ค่าอะไหล่ ฿${v.parts.toLocaleString()}`}
                        />
                      )}
                      {/* Segment: Labor */}
                      {v.total > 0 && (
                        <div
                          className="bg-emerald-500 h-full transition-all"
                          style={{ width: `${(v.labor / vehicleChartData.maxVehicleSpend) * 100}%` }}
                          title={`ค่าแรง ฿${v.labor.toLocaleString()}`}
                        />
                      )}
                      {/* Segment: Other */}
                      {v.total > 0 && (
                        <div
                          className="bg-amber-400 h-full transition-all"
                          style={{ width: `${(v.other / vehicleChartData.maxVehicleSpend) * 100}%` }}
                          title={`อื่นๆ ฿${v.other.toLocaleString()}`}
                        />
                      )}
                    </div>

                    {/* Meta info below bar */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                      <div className="flex items-center gap-3">
                        <span>
                          อะไหล่: <strong className="text-slate-700">฿{v.parts.toLocaleString()}</strong>
                        </span>
                        <span>
                          ค่าแรง: <strong className="text-slate-700">฿{v.labor.toLocaleString()}</strong>
                        </span>
                        {v.other > 0 && (
                          <span>
                            อื่นๆ: <strong className="text-slate-700">฿{v.other.toLocaleString()}</strong>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 font-medium">
                        {v.maxMileage > 0 && (
                          <span>
                            เลขไมล์: <strong className="text-slate-800">{v.maxMileage.toLocaleString()} กม.</strong>
                          </span>
                        )}
                        {v.costPerKm > 0 && (
                          <span className="text-emerald-700 font-bold">
                            (฿{v.costPerKm}/กม.)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 3: CATEGORY BUDGET SHARE & FLEET PERFORMANCE MATRIX                */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 1 Col: Category Distribution */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-purple-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    สัดส่วนงบตามหมวดหมู่งานซ่อม
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400">
                  {categoryChartData.length} หมวด
                </span>
              </div>

              <div className="space-y-3">
                {categoryChartData.map((cat) => (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <span>{cat.icon}</span>
                        <span className="truncate max-w-[150px]">{cat.label}</span>
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="font-black text-slate-900">
                          ฿{cat.total.toLocaleString()}
                        </span>
                        <span className="text-[11px] font-bold text-purple-700">
                          {cat.share}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${cat.share}%`,
                          backgroundColor: cat.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right 2 Cols: Fleet Budget Performance Table */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4 overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    ตารางวิเคราะห์งบประมาณและสมรรถนะรายคัน (Fleet Budget Matrix)
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400">
                  สำหรับผู้จัดการฝ่ายโลจิสติกส์
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <th className="py-2.5 px-3">ทะเบียนรถ</th>
                      <th className="py-2.5 px-3">ผู้ดูแล/ประเภท</th>
                      <th className="py-2.5 px-3 text-center">จำนวนงาน</th>
                      <th className="py-2.5 px-3 text-right">ค่าอะไหล่</th>
                      <th className="py-2.5 px-3 text-right">ค่าแรง</th>
                      <th className="py-2.5 px-3 text-right">รวมสุทธิ (฿)</th>
                      <th className="py-2.5 px-3 text-right">สัดส่วน</th>
                      <th className="py-2.5 px-3 text-right">ต้นทุน/กม.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {vehicleChartData.vehicles.map((v) => (
                      <tr key={v.plate} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                          {v.plate}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                          <div>{v.driver}</div>
                          <div className="text-[10px] text-slate-400">{v.type}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap font-semibold">
                          {v.count} ครั้ง
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono text-slate-600">
                          ฿{v.parts.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono text-slate-600">
                          ฿{v.labor.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap font-black text-slate-900">
                          ฿{v.total.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap font-bold text-indigo-700">
                          {v.budgetShare}%
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap font-bold text-emerald-700">
                          {v.costPerKm > 0 ? `฿${v.costPerKm}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* VIEW B: RECORDS LOG & DETAILS TABLE                                      */
        /* ========================================================================= */
        <div className="space-y-6">
          {/* Filter & Search Controls */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ค้นหาทะเบียนรถ, ชื่องานซ่อม, อู่/ศูนย์บริการ, คนขับ, เลขที่ใบเสร็จ..."
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0 self-end md:self-auto">
                <button
                  onClick={() => setViewMode('cards')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    viewMode === 'cards'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  การ์ดบันทึก
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ตารางละเอียด
                </button>
              </div>
            </div>

            {/* Filter Dropdowns Bar */}
            <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 shrink-0">
                <Filter className="w-3.5 h-3.5" />
                <span>กรองข้อมูล:</span>
              </div>

              {/* Filter: Vehicle */}
              <select
                value={selectedPlate}
                onChange={(e) => setSelectedPlate(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">รถทุกคันในระบบ</option>
                {availableVehicles.map((plate) => (
                  <option key={plate} value={plate}>
                    {plate}
                  </option>
                ))}
              </select>

              {/* Filter: Category */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">หมวดหมู่ทั้งหมด</option>
                {Object.entries(CATEGORY_MAP).map(([key, item]) => (
                  <option key={key} value={key}>
                    {item.icon} {item.label}
                  </option>
                ))}
              </select>

              {/* Filter: Status */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">สถานะทั้งหมด</option>
                <option value="completed">เสร็จสิ้น</option>
                <option value="in_progress">กำลังดำเนินการ</option>
                <option value="scheduled">นัดหมายล่วงหน้า</option>
              </select>

              {/* Filter: Date */}
              <div className="flex items-center gap-1 ml-auto">
                {(['all', 'this_month', 'this_week', 'today'] as const).map((period) => {
                  const labels = {
                    all: 'ทั้งหมด',
                    this_month: 'เดือนนี้',
                    this_week: 'สัปดาห์นี้',
                    today: 'วันนี้',
                  };
                  return (
                    <button
                      key={period}
                      onClick={() => setDateFilter(period)}
                      className={`px-2.5 py-1 text-[11px] rounded-lg font-semibold transition-all cursor-pointer ${
                        dateFilter === period
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {labels[period]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Cards View or Table View */}
          {sortedRecords.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Wrench className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                ไม่พบรายการบันทึกบำรุงรักษารถ
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                ยังไม่มีข้อมูลที่ตรงตามเงื่อนไขการค้นหา คุณสามารถกดปุ่ม "บันทึกงานซ่อม/บำรุงรักษา" ด้านบนเพื่อเพิ่มรายการใหม่
              </p>
              <button
                onClick={() => handleOpenCreateModal()}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                เพิ่มบันทึกงานบำรุงรักษา
              </button>
            </div>
          ) : viewMode === 'cards' ? (
            /* Cards / Timeline View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedRecords.map((r) => {
                const cat = CATEGORY_MAP[r.serviceCategory] || CATEGORY_MAP.other;
                const st = STATUS_MAP[r.status] || STATUS_MAP.completed;

                return (
                  <div
                    key={r.id}
                    className="bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Top Bar: Plate + Status */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-black text-sm">
                            <Truck className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-sm font-black text-slate-900 leading-tight">
                              {r.vehiclePlate}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {r.vehicleType || 'ยานพาหนะขนส่ง'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${st.badgeClass}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dotClass}`} />
                            {st.label}
                          </span>
                        </div>
                      </div>

                      {/* Category & Title */}
                      <div className="mt-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">{cat.icon}</span>
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                            {cat.label}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 mt-1 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
                          {r.title}
                        </h4>
                        {r.description && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {r.description}
                          </p>
                        )}
                      </div>

                      {/* Garage & Service Info */}
                      <div className="mt-3.5 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> วันที่เข้าซ่อม:
                          </span>
                          <span className="font-semibold text-slate-700">
                            {formatThaiDate(r.date)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Gauge className="w-3 h-3" /> เลขไมล์:
                          </span>
                          <span className="font-bold text-slate-800">
                            {r.currentMileage.toLocaleString()} กม.
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> ศูนย์บริการ/อู่:
                          </span>
                          <span className="font-semibold text-slate-700 truncate max-w-[150px]">
                            {r.serviceCenter}
                          </span>
                        </div>

                        {r.driverName && (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400 flex items-center gap-1">
                              <User className="w-3 h-3" /> ผู้ขับขี่:
                            </span>
                            <span className="text-slate-600">{r.driverName}</span>
                          </div>
                        )}
                      </div>

                      {/* Next Service Milestone (if set) */}
                      {(r.nextServiceMileage || r.nextServiceDate) && (
                        <div className="mt-2.5 p-2 rounded-xl bg-slate-50 border border-slate-200/60 text-[11px] flex items-center justify-between">
                          <span className="text-slate-500 font-medium">รอบเช็คถัดไป:</span>
                          <span className="font-bold text-blue-700">
                            {r.nextServiceMileage ? `${r.nextServiceMileage.toLocaleString()} กม.` : ''}
                            {r.nextServiceMileage && r.nextServiceDate ? ' / ' : ''}
                            {r.nextServiceDate ? formatThaiDate(r.nextServiceDate, false) : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Footer: Total Cost & Action Buttons */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block">รวมค่าใช้จ่าย</span>
                        <span className="text-base font-black text-slate-900">
                          ฿{r.totalCost.toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setDetailRecord(r)}
                          title="ดูรายละเอียด"
                          className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setPrintableRecord(r)}
                          title="พิมพ์ใบประวัติซ่อมบำรุง"
                          className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(r)}
                          title="แก้ไขข้อมูล"
                          className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-blue-600 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`ต้องการลบรายการบำรุงรักษานี้ใช่หรือไม่?\n(${r.title})`)) {
                              onDeleteRecord(r.id);
                            }
                          }}
                          title="ลบรายการ"
                          className="p-2 rounded-lg bg-slate-100 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Table View */
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <th className="py-3 px-3.5">วันที่</th>
                      <th className="py-3 px-3.5">ทะเบียนรถ</th>
                      <th className="py-3 px-3.5">หมวดหมู่ & ชื่องาน</th>
                      <th className="py-3 px-3.5">ศูนย์บริการ/อู่</th>
                      <th className="py-3 px-3.5 text-right">เลขไมล์ (กม.)</th>
                      <th className="py-3 px-3.5 text-right">ค่าอะไหล่</th>
                      <th className="py-3 px-3.5 text-right">ค่าแรง</th>
                      <th className="py-3 px-3.5 text-right">รวมสุทธิ</th>
                      <th className="py-3 px-3.5 text-center">สถานะ</th>
                      <th className="py-3 px-3.5 text-center">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {sortedRecords.map((r) => {
                      const cat = CATEGORY_MAP[r.serviceCategory] || CATEGORY_MAP.other;
                      const st = STATUS_MAP[r.status] || STATUS_MAP.completed;

                      return (
                        <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3.5 whitespace-nowrap font-medium text-slate-900">
                            {formatThaiDate(r.date)}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <div className="font-bold text-slate-900">{r.vehiclePlate}</div>
                            <div className="text-[10px] text-slate-400">{r.driverName || '-'}</div>
                          </td>
                          <td className="py-3 px-3.5 max-w-xs">
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                              <span>{cat.icon}</span>
                              <span>{cat.label}</span>
                            </div>
                            <div className="font-bold text-slate-900 truncate mt-0.5" title={r.title}>
                              {r.title}
                            </div>
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap text-slate-600">
                            {r.serviceCenter}
                            {r.invoiceNumber && (
                              <div className="text-[10px] text-slate-400">เลขที่: {r.invoiceNumber}</div>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-right whitespace-nowrap font-bold text-slate-800">
                            {r.currentMileage.toLocaleString()}
                          </td>
                          <td className="py-3 px-3.5 text-right whitespace-nowrap text-slate-600">
                            ฿{r.costParts.toLocaleString()}
                          </td>
                          <td className="py-3 px-3.5 text-right whitespace-nowrap text-slate-600">
                            ฿{r.costLabor.toLocaleString()}
                          </td>
                          <td className="py-3 px-3.5 text-right whitespace-nowrap font-black text-blue-700">
                            ฿{r.totalCost.toLocaleString()}
                          </td>
                          <td className="py-3 px-3.5 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${st.badgeClass}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${st.dotClass}`} />
                              {st.label}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setDetailRecord(r)}
                                title="ดูรายละเอียด"
                                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setPrintableRecord(r)}
                                title="พิมพ์ใบประวัติ"
                                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenEditModal(r)}
                                title="แก้ไข"
                                className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`ต้องการลบรายการบำรุงรักษานี้ใช่หรือไม่?\n(${r.title})`)) {
                                    onDeleteRecord(r.id);
                                  }
                                }}
                                title="ลบ"
                                className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
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
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. Modal: Create / Edit Maintenance Record                   */}
      {/* ============================================================ */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="px-5 py-4 bg-gradient-to-r from-slate-900 to-blue-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-600/80 flex items-center justify-center">
                  <Wrench className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    {editingRecord ? 'แก้ไขบันทึกงานบำรุงรักษา' : 'เพิ่มบันทึกงานบำรุงรักษารถใหม่'}
                  </h3>
                  <p className="text-xs text-blue-200">
                    กรอกข้อมูลการซ่อมบำรุง เลขไมล์ อะไหล่ และค่าใช้จ่าย
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              {/* Row 1: Vehicle & Driver */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    ทะเบียนรถ <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.vehiclePlate}
                    onChange={(e) => {
                      const pl = e.target.value;
                      const fleetMatch = FLEET_VEHICLES.find((v) => v.plate === pl);
                      setFormData((prev) => ({
                        ...prev,
                        vehiclePlate: pl,
                        vehicleType: fleetMatch?.type || prev.vehicleType,
                        driverName: fleetMatch?.driver || prev.driverName,
                      }));
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    required
                  >
                    {FLEET_VEHICLES.map((v) => (
                      <option key={v.plate} value={v.plate}>
                        {v.plate} ({v.type})
                      </option>
                    ))}
                    {availableVehicles
                      .filter((p) => !FLEET_VEHICLES.some((fv) => fv.plate === p))
                      .map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    ประเภทรถ
                  </label>
                  <input
                    type="text"
                    value={formData.vehicleType || ''}
                    onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                    placeholder="เช่น กระบะตอนเดียวตู้ทึบ"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    ผู้รับผิดชอบรถ / คนขับ
                  </label>
                  <input
                    type="text"
                    value={formData.driverName || ''}
                    onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                    placeholder="เช่น สมชาย วงศ์สวัสดิ์"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {/* Row 2: Date, Mileage, Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    วันที่เข้าซ่อม <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.date || ''}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    เลขไมล์ปัจจุบัน (กม.) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.currentMileage || ''}
                      onChange={(e) => {
                        const m = Number(e.target.value) || 0;
                        setFormData((prev) => ({
                          ...prev,
                          currentMileage: m,
                          nextServiceMileage: prev.nextServiceMileage || m + 10000,
                        }));
                      }}
                      placeholder="เช่น 118500"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      required
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 font-semibold">
                      กม.
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    สถานะงานซ่อม
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value as MaintenanceStatus })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="completed">เสร็จสิ้น (Completed)</option>
                    <option value="in_progress">กำลังดำเนินการ (In Progress)</option>
                    <option value="scheduled">นัดหมายล่วงหน้า (Scheduled)</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Category & Title */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    หมวดหมู่งานซ่อมบำรุง <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.serviceCategory}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        serviceCategory: e.target.value as MaintenanceCategory,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {Object.entries(CATEGORY_MAP).map(([key, item]) => (
                      <option key={key} value={key}>
                        {item.icon} {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    ชื่องานซ่อมบำรุง <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title || ''}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="เช่น เปลี่ยนถ่ายน้ำมันเครื่องสังเคราะห์ 10W-30 + ไส้กรอง และสลับยาง"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    required
                  />
                </div>
              </div>

              {/* Row 4: Garage & Invoice */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    ศูนย์บริการ / อู่ซ่อมรถ
                  </label>
                  <input
                    type="text"
                    value={formData.serviceCenter || ''}
                    onChange={(e) => setFormData({ ...formData, serviceCenter: e.target.value })}
                    placeholder="เช่น ศูนย์บริการ ISUZU อุดรธานี / อู่ช่างวิทย์"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    เลขที่ใบเสร็จ / ใบกำกับภาษี
                  </label>
                  <input
                    type="text"
                    value={formData.invoiceNumber || ''}
                    onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                    placeholder="เช่น INV-2026-88192"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {/* Row 5: Parts Itemized Breakdown */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                    รายการอะไหล่ & วัสดุที่เปลี่ยน (Optional)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {formParts.length} รายการ (รวม ฿
                    {formParts.reduce((s, p) => s + p.totalPrice, 0).toLocaleString()})
                  </span>
                </div>

                {/* List existing parts */}
                {formParts.length > 0 && (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {formParts.map((part, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="font-bold text-slate-800">{part.name}</span>
                          <span className="text-slate-400 text-[11px] ml-2">
                            ({part.quantity} x ฿{part.unitPrice.toLocaleString()})
                          </span>
                        </div>
                        <span className="font-bold text-slate-900 shrink-0">
                          ฿{part.totalPrice.toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemovePartItem(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new part row */}
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <input
                    type="text"
                    value={newPartName}
                    onChange={(e) => setNewPartName(e.target.value)}
                    placeholder="ชื่ออะไหล่ เช่น ไส้กรองน้ำมันเครื่อง"
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={newPartQty}
                      onChange={(e) => setNewPartQty(parseInt(e.target.value, 10) || 1)}
                      placeholder="จำนวน"
                      className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      min="0"
                      value={newPartUnitPrice || ''}
                      onChange={(e) => setNewPartUnitPrice(parseFloat(e.target.value) || 0)}
                      placeholder="ราคา/หน่วย"
                      className="w-24 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddPartItem}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shrink-0 cursor-pointer"
                    >
                      + เพิ่ม
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 6: Costs (Parts, Labor, Other -> Total) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-blue-50/50 p-3.5 rounded-xl border border-blue-100">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    ค่าอะไหล่ (บาท)
                  </label>
                  <input
                    type="number"
                    value={formData.costParts || ''}
                    onChange={(e) => handleCostChange('costParts', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-right font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    ค่าแรงช่าง (บาท)
                  </label>
                  <input
                    type="number"
                    value={formData.costLabor || ''}
                    onChange={(e) => handleCostChange('costLabor', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-right font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    ค่าใช้จ่ายอื่นๆ (บาท)
                  </label>
                  <input
                    type="number"
                    value={formData.costOther || ''}
                    onChange={(e) => handleCostChange('costOther', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-right font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block font-bold text-blue-900 mb-1">
                    ยอดรวมสุทธิ (บาท)
                  </label>
                  <div className="w-full px-3 py-2 rounded-xl bg-blue-600 text-white font-black text-right text-sm shadow-xs">
                    ฿{(formData.totalCost || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Row 7: Next Milestone Planning */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  กำหนดรอบบำรุงรักษาครั้งถัดไป (Preventive Schedule)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">
                      เลขไมล์ครั้งถัดไป (กม.)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={formData.nextServiceMileage || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            nextServiceMileage: parseFloat(e.target.value) || undefined,
                          })
                        }
                        placeholder="เช่น 128500"
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const cur = Number(formData.currentMileage) || 0;
                          setFormData({ ...formData, nextServiceMileage: cur + 10000 });
                        }}
                        className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg text-[11px] cursor-pointer"
                      >
                        +10,000 กม.
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1">
                      วันที่นัดหมายรอบถัดไป
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={formData.nextServiceDate || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, nextServiceDate: e.target.value })
                        }
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setMonth(d.getMonth() + 3);
                          setFormData({
                            ...formData,
                            nextServiceDate: d.toISOString().slice(0, 10),
                          });
                        }}
                        className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg text-[11px] cursor-pointer"
                      >
                        +3 เดือน
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 8: Notes */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  หมายเหตุ / อาการก่อนและหลังซ่อม
                </label>
                <textarea
                  rows={2}
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="เช่น ทดสอบวิ่งรอบสั้นแล้วอาการสั่นหายไป เสียงเครื่องเงียบขึ้น"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  {editingRecord ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูล'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 5. Modal: Record Detail Card                                 */}
      {/* ============================================================ */}
      {detailRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">รายละเอียดงานซ่อมบำรุง</h3>
                  <p className="text-[11px] text-slate-400">
                    รหัสเอกสาร: {detailRecord.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailRecord(null)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400">ทะเบียนรถ</span>
                  <div className="text-base font-black text-slate-900">
                    {detailRecord.vehiclePlate}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {detailRecord.vehicleType || 'ยานพาหนะ'} • {detailRecord.driverName || 'ผู้ขับ'}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400">สถานะ</span>
                  <div>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        STATUS_MAP[detailRecord.status]?.badgeClass
                      }`}
                    >
                      {STATUS_MAP[detailRecord.status]?.label}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">วันที่เข้าซ่อม:</span>
                  <span className="font-bold text-slate-800">
                    {formatThaiDate(detailRecord.date)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">เลขไมล์:</span>
                  <span className="font-bold text-slate-800">
                    {detailRecord.currentMileage.toLocaleString()} กม.
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">ศูนย์บริการ/อู่:</span>
                  <span className="font-bold text-slate-800">
                    {detailRecord.serviceCenter}
                  </span>
                </div>
                {detailRecord.invoiceNumber && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">เลขที่ใบเสร็จ:</span>
                    <span className="font-bold text-slate-800">
                      {detailRecord.invoiceNumber}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <span className="font-bold text-slate-700 block mb-1">
                  ชื่องานซ่อม / รายการที่ทำ:
                </span>
                <p className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-100 text-slate-800 font-medium">
                  {detailRecord.title}
                </p>
                {detailRecord.description && (
                  <p className="text-slate-500 text-[11px] mt-1 px-1">
                    {detailRecord.description}
                  </p>
                )}
              </div>

              {detailRecord.partsList && detailRecord.partsList.length > 0 && (
                <div>
                  <span className="font-bold text-slate-700 block mb-1">
                    อะไหล่ที่เปลี่ยน ({detailRecord.partsList.length} รายการ):
                  </span>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {detailRecord.partsList.map((p, idx) => (
                      <div
                        key={idx}
                        className="p-2 bg-white flex items-center justify-between text-[11px]"
                      >
                        <span className="font-medium text-slate-800">
                          {p.name} ({p.quantity} หน่วย)
                        </span>
                        <span className="font-bold text-slate-900">
                          ฿{p.totalPrice.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cost Summary Box */}
              <div className="bg-slate-900 text-white p-3.5 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-400">
                    ค่าอะไหล่: ฿{detailRecord.costParts.toLocaleString()} | ค่าแรง: ฿
                    {detailRecord.costLabor.toLocaleString()}
                  </div>
                  <div className="text-xs font-semibold text-slate-300">
                    ยอดรวมค่าใช้จ่ายทั้งสิ้น
                  </div>
                </div>
                <div className="text-xl font-black text-amber-400">
                  ฿{detailRecord.totalCost.toLocaleString()}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setPrintableRecord(detailRecord);
                    setDetailRecord(null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  พิมพ์ใบประวัติ
                </button>
                <button
                  onClick={() => {
                    handleOpenEditModal(detailRecord);
                    setDetailRecord(null);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  แก้ไข
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 6. Modal: Printable Vehicle Maintenance Sheet / Voucher      */}
      {/* ============================================================ */}
      {printableRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold">พิมพ์ใบประวัติการซ่อมบำรุงรักษารถ</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  สั่งพิมพ์
                </button>
                <button
                  onClick={() => setPrintableRecord(null)}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Content Body */}
            <div className="p-8 space-y-6 text-slate-900 bg-white" id="printable-maintenance-sheet">
              {/* Header */}
              <div className="flex items-start justify-between border-b pb-4 border-slate-300">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xl">
                    IORA
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900">
                      บริษัท น้ำดื่มไอโอร่า จำกัด (IORA Water Logistics)
                    </h2>
                    <p className="text-xs text-slate-600">
                      ระบบบันทึกประวัติการบำรุงรักษาและตรวจสภาพยานพาหนะขนส่ง
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-black text-slate-900 uppercase">
                    ใบประวัติซ่อมบำรุง
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    NO: {printableRecord.id}
                  </div>
                  <div className="text-xs text-slate-500">
                    วันที่: {formatThaiDate(printableRecord.date)}
                  </div>
                </div>
              </div>

              {/* Vehicle & Service Info Table */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                  <div className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-1">
                    ข้อมูลยานพาหนะ (Vehicle Details)
                  </div>
                  <div>
                    <span className="text-slate-500">ทะเบียนรถ:</span>{' '}
                    <span className="font-black text-slate-900">{printableRecord.vehiclePlate}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">ประเภทรถ:</span>{' '}
                    <span>{printableRecord.vehicleType || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">ผู้ขับขี่/ผู้รับผิดชอบ:</span>{' '}
                    <span>{printableRecord.driverName || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">เลขไมล์ขณะเข้าซ่อม:</span>{' '}
                    <span className="font-bold text-slate-900">
                      {printableRecord.currentMileage.toLocaleString()} กม.
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                  <div className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-1">
                    ข้อมูลศูนย์บริการ & เอกสาร
                  </div>
                  <div>
                    <span className="text-slate-500">ศูนย์บริการ/อู่:</span>{' '}
                    <span className="font-bold text-slate-900">{printableRecord.serviceCenter}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">เลขที่ใบเสร็จ/แจ้งหนี้:</span>{' '}
                    <span>{printableRecord.invoiceNumber || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">หมวดหมู่:</span>{' '}
                    <span>{CATEGORY_MAP[printableRecord.serviceCategory]?.label}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">ผู้บันทึก:</span>{' '}
                    <span>{printableRecord.recordedBy}</span>
                  </div>
                </div>
              </div>

              {/* Job Details */}
              <div className="text-xs">
                <div className="font-bold text-slate-800 mb-1">
                  รายการงานซ่อมบำรุง / อาการ:
                </div>
                <div className="p-3 rounded-xl border border-slate-200 font-semibold bg-white text-slate-900">
                  {printableRecord.title}
                  {printableRecord.description && (
                    <div className="text-slate-600 font-normal mt-1 text-[11px]">
                      {printableRecord.description}
                    </div>
                  )}
                </div>
              </div>

              {/* Itemized Parts Table (If any) */}
              {printableRecord.partsList && printableRecord.partsList.length > 0 && (
                <div className="text-xs">
                  <div className="font-bold text-slate-800 mb-1.5">
                    รายการอะไหล่ & อุปกรณ์ที่เปลี่ยน:
                  </div>
                  <table className="w-full border-collapse border border-slate-300 text-left">
                    <thead>
                      <tr className="bg-slate-100 font-bold border-b border-slate-300">
                        <th className="p-2 border-r border-slate-300">ลำดับ</th>
                        <th className="p-2 border-r border-slate-300">รายการ</th>
                        <th className="p-2 text-center border-r border-slate-300">จำนวน</th>
                        <th className="p-2 text-right border-r border-slate-300">ราคา/หน่วย</th>
                        <th className="p-2 text-right">จำนวนเงิน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {printableRecord.partsList.map((p, idx) => (
                        <tr key={idx} className="border-b border-slate-200">
                          <td className="p-2 text-center border-r border-slate-200">{idx + 1}</td>
                          <td className="p-2 border-r border-slate-200 font-medium">{p.name}</td>
                          <td className="p-2 text-center border-r border-slate-200">{p.quantity}</td>
                          <td className="p-2 text-right border-r border-slate-200">
                            ฿{p.unitPrice.toLocaleString()}
                          </td>
                          <td className="p-2 text-right font-bold">
                            ฿{p.totalPrice.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Cost Summary */}
              <div className="p-3.5 rounded-xl border border-slate-300 bg-slate-50 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">ค่าอะไหล่และอุปกรณ์:</span>
                  <span className="font-semibold">฿{printableRecord.costParts.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">ค่าแรงช่าง / บริการ:</span>
                  <span className="font-semibold">฿{printableRecord.costLabor.toLocaleString()}</span>
                </div>
                {Boolean(printableRecord.costOther) && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">ค่าใช้จ่ายอื่นๆ:</span>
                    <span className="font-semibold">฿{printableRecord.costOther?.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-slate-300 font-black text-sm text-slate-900">
                  <span>ยอดเงินรวมสุทธิ:</span>
                  <span className="text-blue-700">฿{printableRecord.totalCost.toLocaleString()}</span>
                </div>
              </div>

              {/* Preventive Schedule */}
              {(printableRecord.nextServiceMileage || printableRecord.nextServiceDate) && (
                <div className="text-xs p-3 rounded-xl border border-blue-200 bg-blue-50/50 flex items-center justify-between">
                  <span className="font-bold text-blue-900">กำหนดตรวจเช็คครั้งต่อไป:</span>
                  <span className="font-black text-blue-800">
                    {printableRecord.nextServiceMileage
                      ? `เลขไมล์ ${printableRecord.nextServiceMileage.toLocaleString()} กม.`
                      : ''}
                    {printableRecord.nextServiceMileage && printableRecord.nextServiceDate ? ' / ' : ''}
                    {printableRecord.nextServiceDate
                      ? `วันที่ ${formatThaiDate(printableRecord.nextServiceDate)}`
                      : ''}
                  </span>
                </div>
              )}

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-8 text-xs text-center">
                <div className="space-y-10">
                  <div className="border-b border-slate-400 w-3/4 mx-auto pb-1"></div>
                  <div>
                    <div className="font-bold">({printableRecord.driverName || 'ผู้รับผิดชอบรถ'})</div>
                    <div className="text-slate-500 text-[11px]">ผู้ส่งมอบรถ / คนขับ</div>
                  </div>
                </div>

                <div className="space-y-10">
                  <div className="border-b border-slate-400 w-3/4 mx-auto pb-1"></div>
                  <div>
                    <div className="font-bold">({printableRecord.recordedBy || 'ผู้จัดการฝ่ายโลจิสติกส์'})</div>
                    <div className="text-slate-500 text-[11px]">ผู้ตรวจสอบ / ฝ่ายยานพาหนะและขนส่ง</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 7. Modal: Print Executive Budget Briefing Summary            */}
      {/* ============================================================ */}
      {isPrintExecutiveBriefOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold">พิมพ์รายงานสรุปงบประมาณการซ่อมบำรุงสำหรับผู้บริหาร</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  สั่งพิมพ์รายงาน
                </button>
                <button
                  onClick={() => setIsPrintExecutiveBriefOpen(false)}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-8 space-y-6 text-slate-900 bg-white" id="printable-executive-budget-sheet">
              {/* Header */}
              <div className="border-b pb-4 border-slate-300 flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    รายงานสรุปงบประมาณและเปรียบเทียบค่าใช้จ่ายบำรุงรักษายานพาหนะ
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    บริษัท น้ำดื่มไอโอร่า จำกัด • ฝ่ายโลจิสติกส์และการจัดส่งน้ำดื่ม
                  </p>
                  <p className="text-[11px] text-slate-400">
                    พิมพ์รายงาน ณ วันที่ {formatThaiDate(new Date().toISOString().slice(0, 10))}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">งบประมาณรวมทั้งสิ้น</span>
                  <span className="text-2xl font-black text-blue-700">
                    ฿{budgetKpi.totalSpend.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* KPI Summary Grid */}
              <div className="grid grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="text-slate-500 text-[10px]">ค่าอะไหล่รวม</div>
                  <div className="text-base font-black text-slate-900">฿{budgetKpi.totalParts.toLocaleString()}</div>
                  <div className="text-[10px] text-blue-600 font-bold">{budgetKpi.partsPercent}% ของงบ</div>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="text-slate-500 text-[10px]">ค่าแรงช่างรวม</div>
                  <div className="text-base font-black text-slate-900">฿{budgetKpi.totalLabor.toLocaleString()}</div>
                  <div className="text-[10px] text-emerald-600 font-bold">{budgetKpi.laborPercent}% ของงบ</div>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="text-slate-500 text-[10px]">เฉลี่ยต่อเดือน</div>
                  <div className="text-base font-black text-indigo-700">฿{budgetKpi.avgSpendPerMonth.toLocaleString()}</div>
                  <div className="text-[10px] text-slate-500">Run-rate ต่อเดือน</div>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="text-slate-500 text-[10px]">ต้นทุนเฉลี่ย/กม.</div>
                  <div className="text-base font-black text-emerald-700">฿{budgetKpi.costPerKm}</div>
                  <div className="text-[10px] text-slate-500">บาทต่อกิโลเมตร</div>
                </div>
              </div>

              {/* Vehicle Comparison Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-1.5">
                  1. ตารางเปรียบเทียบค่าใช้จ่ายบำรุงรักษาแยกตามคันรถ (Vehicle Breakdown)
                </h4>
                <table className="w-full text-xs border-collapse border border-slate-300 text-left">
                  <thead>
                    <tr className="bg-slate-100 font-bold border-b border-slate-300">
                      <th className="p-2 border-r border-slate-300">ทะเบียนรถ</th>
                      <th className="p-2 border-r border-slate-300">ประเภทรถ</th>
                      <th className="p-2 border-r border-slate-300">ผู้รับผิดชอบ</th>
                      <th className="p-2 text-center border-r border-slate-300">จำนวนงาน</th>
                      <th className="p-2 text-right border-r border-slate-300">ค่าอะไหล่ (฿)</th>
                      <th className="p-2 text-right border-r border-slate-300">ค่าแรง (฿)</th>
                      <th className="p-2 text-right border-r border-slate-300">รวมสุทธิ (฿)</th>
                      <th className="p-2 text-right">สัดส่วน (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicleChartData.vehicles.map((v, idx) => (
                      <tr key={idx} className="border-b border-slate-200">
                        <td className="p-2 border-r border-slate-200 font-bold">{v.plate}</td>
                        <td className="p-2 border-r border-slate-200">{v.type}</td>
                        <td className="p-2 border-r border-slate-200">{v.driver}</td>
                        <td className="p-2 text-center border-r border-slate-200 font-semibold">{v.count}</td>
                        <td className="p-2 text-right border-r border-slate-200 font-mono">฿{v.parts.toLocaleString()}</td>
                        <td className="p-2 text-right border-r border-slate-200 font-mono">฿{v.labor.toLocaleString()}</td>
                        <td className="p-2 text-right border-r border-slate-200 font-black">฿{v.total.toLocaleString()}</td>
                        <td className="p-2 text-right font-bold text-indigo-700">{v.budgetShare}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Monthly Breakdown Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-1.5">
                  2. ตารางสรุปค่าใช้จ่ายแยกตามรายเดือน (Monthly Comparison Trend)
                </h4>
                <table className="w-full text-xs border-collapse border border-slate-300 text-left">
                  <thead>
                    <tr className="bg-slate-100 font-bold border-b border-slate-300">
                      <th className="p-2 border-r border-slate-300">เดือน/ปี</th>
                      <th className="p-2 text-center border-r border-slate-300">จำนวนงาน</th>
                      <th className="p-2 text-right border-r border-slate-300">ค่าอะไหล่ (฿)</th>
                      <th className="p-2 text-right border-r border-slate-300">ค่าแรง (฿)</th>
                      <th className="p-2 text-right border-r border-slate-300">อื่นๆ (฿)</th>
                      <th className="p-2 text-right">ยอดรวมรายเดือน (฿)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyChartData.months.map((m, idx) => (
                      <tr key={idx} className="border-b border-slate-200">
                        <td className="p-2 border-r border-slate-200 font-bold">{m.label}</td>
                        <td className="p-2 text-center border-r border-slate-200 font-semibold">{m.count}</td>
                        <td className="p-2 text-right border-r border-slate-200 font-mono">฿{m.parts.toLocaleString()}</td>
                        <td className="p-2 text-right border-r border-slate-200 font-mono">฿{m.labor.toLocaleString()}</td>
                        <td className="p-2 text-right border-r border-slate-200 font-mono">฿{m.other.toLocaleString()}</td>
                        <td className="p-2 text-right font-black text-blue-700">฿{m.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-6 text-xs text-center border-t border-slate-300">
                <div className="space-y-8">
                  <div className="border-b border-slate-400 w-3/4 mx-auto pb-1"></div>
                  <div>
                    <div className="font-bold">({currentUser.name || 'ผู้จัดการฝ่ายโลจิสติกส์'})</div>
                    <div className="text-slate-500 text-[11px]">ผู้จัดทำรายงาน / ผู้จัดการฝ่ายโลจิสติกส์</div>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="border-b border-slate-400 w-3/4 mx-auto pb-1"></div>
                  <div>
                    <div className="font-bold">(...................................................)</div>
                    <div className="text-slate-500 text-[11px]">ผู้อนุมัติ / ฝ่ายการเงินและบัญชี</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 8. Modal: Print All Records Report                           */}
      {/* ============================================================ */}
      {isPrintAllOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold">รายงานสรุปงานซ่อมบำรุงรักษายานพาหนะ</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  สั่งพิมพ์รายงาน
                </button>
                <button
                  onClick={() => setIsPrintAllOpen(false)}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-8 space-y-5 text-slate-900 bg-white" id="printable-all-maintenance-report">
              <div className="border-b pb-4 border-slate-300 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    รายงานสรุปการบำรุงรักษารถขนส่งน้ำดื่ม (IORA Water)
                  </h2>
                  <p className="text-xs text-slate-500">
                    ข้อมูล ณ วันที่ {formatThaiDate(new Date().toISOString().slice(0, 10))} • รวมทั้งสิ้น {sortedRecords.length} รายการ
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">ยอดรวมค่าซ่อมบำรุง</div>
                  <div className="text-xl font-black text-blue-700">
                    ฿{stats.totalCost.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Table of Records */}
              <table className="w-full text-xs border-collapse border border-slate-300 text-left">
                <thead>
                  <tr className="bg-slate-100 font-bold border-b border-slate-300">
                    <th className="p-2 border-r border-slate-300">วันที่</th>
                    <th className="p-2 border-r border-slate-300">ทะเบียนรถ</th>
                    <th className="p-2 border-r border-slate-300">ผู้ขับขี่</th>
                    <th className="p-2 border-r border-slate-300">ชื่องานซ่อม</th>
                    <th className="p-2 border-r border-slate-300">ศูนย์/อู่</th>
                    <th className="p-2 text-right border-r border-slate-300">เลขไมล์</th>
                    <th className="p-2 text-right">ยอดเงินรวม</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRecords.map((r, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="p-2 border-r border-slate-200 whitespace-nowrap">
                        {formatThaiDate(r.date, false)}
                      </td>
                      <td className="p-2 border-r border-slate-200 font-bold whitespace-nowrap">
                        {r.vehiclePlate}
                      </td>
                      <td className="p-2 border-r border-slate-200 whitespace-nowrap text-slate-600">
                        {r.driverName || '-'}
                      </td>
                      <td className="p-2 border-r border-slate-200 font-medium">
                        {r.title}
                      </td>
                      <td className="p-2 border-r border-slate-200 whitespace-nowrap text-slate-600">
                        {r.serviceCenter}
                      </td>
                      <td className="p-2 text-right border-r border-slate-200 whitespace-nowrap font-mono">
                        {r.currentMileage.toLocaleString()}
                      </td>
                      <td className="p-2 text-right font-black text-slate-900 whitespace-nowrap">
                        ฿{r.totalCost.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-center pt-4 border-t border-slate-200 text-xs">
                <span className="text-slate-500">ฝ่ายยานพาหนะและจัดส่งน้ำดื่มไอโอร่า</span>
                <span className="font-bold text-slate-800">
                  รวมค่าใช้จ่ายทั้งสิ้น: ฿{stats.totalCost.toLocaleString()} บาทถ้วน
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
