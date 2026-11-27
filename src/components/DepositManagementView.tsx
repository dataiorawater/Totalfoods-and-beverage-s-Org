import React, { useState, useMemo } from 'react';
import { DepositRecord, DepositStatus, StaffUser, Customer, Route } from '../types';
import { TotalEmblem } from './TotalLogo';
import {
  ShieldCheck,
  Plus,
  Search,
  Filter,
  Printer,
  RotateCcw,
  Trash2,
  Eye,
  CheckCircle2,
  AlertCircle,
  X,
  Calendar,
  User,
  Phone,
  MapPin,
  Package,
  Wallet,
  Clock,
  ArrowUpDown,
  Download,
  Camera,
  Upload,
  Receipt,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import * as XLSX from 'xlsx';

interface DepositManagementViewProps {
  deposits: DepositRecord[];
  currentUser: StaffUser;
  customers: Customer[];
  routes: Route[];
  onSaveDeposit: (deposit: DepositRecord) => Promise<void> | void;
  onUpdateDeposit: (deposit: DepositRecord) => Promise<void> | void;
  onDeleteDeposit: (depositId: string) => Promise<void> | void;
  sheetsConnected: boolean;
}

const CONTAINER_PRESETS = [
  { name: 'ถังน้ำดื่ม PC 18.9 ลิตร (มัดจำ 200 บ.)', unitPrice: 200, unit: 'ใบ' },
  { name: 'ถังน้ำดื่ม PET 20 ลิตร (มัดจำ 150 บ.)', unitPrice: 150, unit: 'ใบ' },
  { name: 'ถังน้ำ PC ฝาเกลียว 18.9L (มัดจำ 250 บ.)', unitPrice: 250, unit: 'ใบ' },
  { name: 'ตู้กดน้ำดื่ม ร้อน-เย็น (มัดจำ 1,500 บ.)', unitPrice: 1500, unit: 'ตู้' },
  { name: 'ปั๊มน้ำดื่มอัตโนมัติ (มัดจำ 350 บ.)', unitPrice: 350, unit: 'เครื่อง' },
  { name: 'ลังบรรจุขวดน้ำดื่ม (มัดจำ 100 บ.)', unitPrice: 100, unit: 'ลัง' },
  { name: 'กำหนดเอง', unitPrice: 0, unit: 'หน่วย' },
];

function formatDateThai(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const thaiMonths = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    return `${d.getDate()} ${thaiMonths[d.getMonth()]} ${d.getFullYear() + 543}`;
  } catch {
    return String(dateStr);
  }
}

// Convert numbers to Thai Baht text e.g. 1,000 -> หนึ่งพันบาทถ้วน
function bahtText(num: number): string {
  if (!num || isNaN(num) || num === 0) return 'ศูนย์บาทถ้วน';
  const thaiNums = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const units = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
  
  const intPart = Math.floor(Math.abs(num));
  const s = String(intPart);
  let res = '';
  const len = s.length;
  for (let i = 0; i < len; i++) {
    const n = parseInt(s[i], 10);
    const pos = len - i - 1;
    if (n !== 0) {
      if (pos === 1 && n === 1) {
        res += 'สิบ';
      } else if (pos === 1 && n === 2) {
        res += 'ยี่สิบ';
      } else if (pos === 0 && n === 1 && len > 1 && parseInt(s[len - 2], 10) !== 0) {
        res += 'เอ็ด';
      } else {
        res += thaiNums[n] + units[pos];
      }
    }
  }
  return res + 'บาทถ้วน';
}

export const DepositManagementView: React.FC<DepositManagementViewProps> = ({
  deposits,
  currentUser,
  customers,
  routes,
  onSaveDeposit,
  onUpdateDeposit,
  onDeleteDeposit,
  sheetsConnected,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DepositStatus>('all');
  const [routeFilter, setRouteFilter] = useState<string>('all');
  
  // Modals
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedDepositForView, setSelectedDepositForView] = useState<DepositRecord | null>(null);
  const [depositForRefund, setDepositForRefund] = useState<DepositRecord | null>(null);
  const [depositForPrint, setDepositForPrint] = useState<DepositRecord | null>(null);
  const [depositToDelete, setDepositToDelete] = useState<DepositRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Deposit Form State
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newRouteName, setNewRouteName] = useState('');
  const [selectedPresetIdx, setSelectedPresetIdx] = useState(0);
  const [newCustomItem, setNewCustomItem] = useState('');
  const [newQty, setNewQty] = useState<number>(1);
  const [newUnitPrice, setNewUnitPrice] = useState<number>(200);
  const [newPaymentMethod, setNewPaymentMethod] = useState<'cash' | 'transfer' | 'credit'>('cash');
  const [newNotes, setNewNotes] = useState('');
  const [newSlipPhoto, setNewSlipPhoto] = useState<string>('');

  // Refund Form State
  const [refundQty, setRefundQty] = useState<number>(1);
  const [deductAmount, setDeductAmount] = useState<number>(0);
  const [refundReason, setRefundReason] = useState<string>('');
  const [refundPaymentMethod, setRefundPaymentMethod] = useState<'cash' | 'transfer'>('cash');

  // Customer Autocomplete suggestions
  const [custSuggestions, setCustSuggestions] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Reset new form
  const resetNewForm = () => {
    setNewCustName('');
    setNewCustPhone('');
    setNewCustAddress('');
    setNewRouteName('');
    setSelectedPresetIdx(0);
    setNewCustomItem('');
    setNewQty(1);
    setNewUnitPrice(200);
    setNewPaymentMethod('cash');
    setNewNotes('');
    setNewSlipPhoto('');
    setShowSuggestions(false);
  };

  const openNewModal = () => {
    resetNewForm();
    setIsNewModalOpen(true);
  };

  // Filtered deposits
  const filteredDeposits = useMemo(() => {
    return deposits.filter((dep) => {
      if (statusFilter !== 'all' && dep.status !== statusFilter) return false;
      if (routeFilter !== 'all' && dep.routeName !== routeFilter) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchNumber = dep.depositNumber?.toLowerCase().includes(q);
        const matchCustomer = dep.customerName?.toLowerCase().includes(q);
        const matchPhone = dep.customerPhone?.toLowerCase().includes(q);
        const matchItem = dep.itemType?.toLowerCase().includes(q);
        const matchRoute = dep.routeName?.toLowerCase().includes(q);
        const matchStaff = dep.receivedBy?.toLowerCase().includes(q);
        if (!matchNumber && !matchCustomer && !matchPhone && !matchItem && !matchRoute && !matchStaff) {
          return false;
        }
      }
      return true;
    });
  }, [deposits, statusFilter, routeFilter, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    let totalActiveAmount = 0;
    let activeCount = 0;
    let activeUnits = 0;
    let totalRefundedAmount = 0;
    let refundedCount = 0;

    deposits.forEach((d) => {
      if (d.status === 'active' || d.status === 'partial_refunded') {
        const remaining = (d.totalAmount || 0) - (d.refundedAmount || 0) - (d.deductedAmount || 0);
        totalActiveAmount += remaining > 0 ? remaining : 0;
        activeCount++;
        activeUnits += d.quantity || 0;
      }
      if (d.status === 'refunded' || d.status === 'partial_refunded') {
        totalRefundedAmount += d.refundedAmount || 0;
        if (d.status === 'refunded') refundedCount++;
      }
    });

    return {
      totalActiveAmount,
      activeCount,
      activeUnits,
      totalRefundedAmount,
      refundedCount,
      totalCount: deposits.length,
    };
  }, [deposits]);

  // Handle Preset selection
  const handleSelectPreset = (idx: number) => {
    setSelectedPresetIdx(idx);
    const p = CONTAINER_PRESETS[idx];
    if (p.name !== 'กำหนดเอง') {
      setNewUnitPrice(p.unitPrice);
    }
  };

  // Handle Customer input & suggestions
  const handleCustNameChange = (val: string) => {
    setNewCustName(val);
    if (!val.trim()) {
      setCustSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const q = val.toLowerCase();
    const matches = customers.filter(
      (c) => c.name?.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q)
    );
    setCustSuggestions(matches.slice(0, 5));
    setShowSuggestions(matches.length > 0);
  };

  const handleSelectCustomer = (c: Customer) => {
    setNewCustName(c.name);
    setNewCustPhone(c.phone || '');
    setNewCustAddress(c.address || '');
    if (c.routeName) setNewRouteName(c.routeName);
    setShowSuggestions(false);
  };

  // Handle Photo upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        alert('รูปภาพมีขนาดใหญ่เกิน 4MB โปรดเลือกรูปที่มีขนาดเล็กกว่า');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setNewSlipPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit New Deposit
  const handleCreateDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) {
      alert('กรุณากรอกชื่อลูกค้า');
      return;
    }
    if (newQty <= 0) {
      alert('จำนวนต้องมากกว่า 0');
      return;
    }
    if (newUnitPrice < 0) {
      alert('จำนวนเงินต่อหน่วยไม่ถูกต้อง');
      return;
    }

    const itemLabel =
      selectedPresetIdx === CONTAINER_PRESETS.length - 1
        ? newCustomItem.trim() || 'อุปกรณ์/ทรัพย์สินมัดจำ'
        : CONTAINER_PRESETS[selectedPresetIdx].name;

    const total = newQty * newUnitPrice;
    const now = new Date();
    const depositNumber = `DEP-${now.getFullYear() + 543}-${String(deposits.length + 1).padStart(4, '0')}`;

    const newDep: DepositRecord = {
      id: `dep-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      depositNumber,
      createdAt: now.toISOString(),
      customerName: newCustName.trim(),
      customerPhone: newCustPhone.trim(),
      customerAddress: newCustAddress.trim(),
      routeName: newRouteName.trim() || undefined,
      itemType: itemLabel,
      quantity: newQty,
      unitPrice: newUnitPrice,
      totalAmount: total,
      status: 'active',
      paymentMethod: newPaymentMethod,
      receivedBy: currentUser.name || 'พนักงานจัดส่ง',
      receivedById: currentUser.id,
      notes: newNotes.trim() || undefined,
      slipPhotoUrl: newSlipPhoto || undefined,
      syncedToSheets: false,
    };

    setIsSubmitting(true);
    try {
      await onSaveDeposit(newDep);
      setIsNewModalOpen(false);
      resetNewForm();
    } catch (err) {
      console.error('Error saving deposit:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Refund Modal
  const openRefundModal = (dep: DepositRecord) => {
    setDepositForRefund(dep);
    setRefundQty(dep.quantity || 1);
    setDeductAmount(0);
    setRefundReason('');
    setRefundPaymentMethod('cash');
  };

  // Submit Refund
  const handleConfirmRefund = async () => {
    if (!depositForRefund) return;

    const totalDeposit = depositForRefund.totalAmount || 0;
    const maxRefund = totalDeposit - (deductAmount || 0);
    const actualRefund = maxRefund > 0 ? maxRefund : 0;

    const updated: DepositRecord = {
      ...depositForRefund,
      refundedAmount: actualRefund,
      deductedAmount: deductAmount || 0,
      refundedAt: new Date().toISOString(),
      refundedBy: currentUser.name || 'พนักงาน',
      refundReason: refundReason.trim() || undefined,
      status: deductAmount >= totalDeposit ? 'forfeited' : 'refunded',
    };

    setIsSubmitting(true);
    try {
      await onUpdateDeposit(updated);
      setDepositForRefund(null);
    } catch (err) {
      console.error('Error updating refund:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm delete
  const handleConfirmDelete = async () => {
    if (!depositToDelete) return;
    setIsSubmitting(true);
    try {
      await onDeleteDeposit(depositToDelete.id);
      setDepositToDelete(null);
    } catch (err) {
      console.error('Error deleting deposit:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (deposits.length === 0) {
      alert('ไม่มีข้อมูลเงินประกันสำหรับส่งออก');
      return;
    }

    const data = filteredDeposits.map((d, idx) => ({
      'ลำดับ': idx + 1,
      'เลขที่ใบประกัน': d.depositNumber,
      'วันที่บันทึก': formatDateThai(d.createdAt),
      'ชื่อลูกค้า': d.customerName,
      'เบอร์โทร': d.customerPhone || '-',
      'ที่อยู่': d.customerAddress || '-',
      'สายส่ง': d.routeName || '-',
      'รายการถัง/อุปกรณ์': d.itemType,
      'จำนวน': d.quantity,
      'เงินประกัน/หน่วย (บ.)': d.unitPrice,
      'ยอดมัดจำรวม (บ.)': d.totalAmount,
      'ยอดคืนแล้ว (บ.)': d.refundedAmount || 0,
      'ยอดหักชำรุด (บ.)': d.deductedAmount || 0,
      'สถานะ':
        d.status === 'active'
          ? 'ถือครองเงินประกัน'
          : d.status === 'refunded'
          ? 'คืนเงินประกันแล้ว'
          : d.status === 'forfeited'
          ? 'ยึด/หักชำรุด'
          : 'คืนบางส่วน',
      'วิธีชำระเงิน': d.paymentMethod === 'transfer' ? 'โอนเงิน' : d.paymentMethod === 'credit' ? 'เครดิต' : 'เงินสด',
      'ผู้รับเงินประกัน': d.receivedBy,
      'วันที่คืนเงิน': formatDateThai(d.refundedAt),
      'ผู้คืนเงิน': d.refundedBy || '-',
      'หมายเหตุ': d.notes || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'รายการเงินประกัน');
    XLSX.writeFile(wb, `รายงานเงินประกันมัดจำถัง_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Section */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-700 shadow-2xs">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                จัดการเงินประกัน & มัดจำถัง
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800">
                Logistics
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              ระบบบันทึกเงินมัดจำถังน้ำดื่ม อุปกรณ์ค้ำประกัน ใบสำคัญรับเงิน และประวัติการคืนมัดจำ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>ส่งออก Excel</span>
          </button>

          <button
            id="btn-new-deposit"
            onClick={openNewModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow transition cursor-pointer active:scale-98"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>รับเงินประกันใหม่</span>
          </button>
        </div>
      </div>

      {/* 2. Key Metrics Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Active Deposit Amount */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              เงินประกันถือครองคงค้าง
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              ฿{stats.totalActiveAmount.toLocaleString()}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">
            จากทั้งหมด {stats.activeCount} สัญญา/รายการ
          </p>
        </div>

        {/* Card 2: Units On Deposit */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              จำนวนถัง/อุปกรณ์ที่มัดจำ
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {stats.activeUnits.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 font-bold">ใบ/หน่วย</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">
            อยู่ในความดูแลของลูกค้า
          </p>
        </div>

        {/* Card 3: Refunded Deposits */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              ยอดคืนเงินประกันแล้ว
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              ฿{stats.totalRefundedAmount.toLocaleString()}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">
            คืนแล้ว {stats.refundedCount} รายการ
          </p>
        </div>

        {/* Card 4: Total Slips */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              ประวัติรายการทั้งหมด
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {stats.totalCount}
            </span>
            <span className="text-xs text-slate-500 font-bold">รายการ</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-medium inline-flex items-center gap-1">
            {sheetsConnected && <BrandLogo brand="google-sheets" className="w-3 h-3 text-[#34A853] shrink-0" />}
            <span>{sheetsConnected ? 'เชื่อมต่อ Google Sheets' : 'บันทึกในระบบออฟไลน์'}</span>
          </p>
        </div>
      </div>

      {/* 3. Search and Filter Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร, เลขใบมัดจำ (DEP-xxxx), หรือสายส่ง..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {/* Status Filter */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold shrink-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทั้งหมด
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'active'
                  ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ถือครองอยู่
            </button>
            <button
              onClick={() => setStatusFilter('refunded')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'refunded'
                  ? 'bg-white text-blue-800 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              คืนแล้ว
            </button>
            <button
              onClick={() => setStatusFilter('forfeited')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'forfeited'
                  ? 'bg-white text-rose-800 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ยึด/หักชำรุด
            </button>
          </div>

          {/* Route Filter Dropdown */}
          {routes.length > 0 && (
            <select
              value={routeFilter}
              onChange={(e) => setRouteFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shrink-0"
            >
              <option value="all">ทุกสายส่ง</option>
              {routes.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* 4. Deposits List / Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        {filteredDeposits.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center mx-auto mb-3.5">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              {deposits.length === 0 ? 'ยังไม่มีข้อมูลเงินประกัน' : 'ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {deposits.length === 0
                ? 'กดปุ่ม "รับเงินประกันใหม่" เพื่อเริ่มต้นบันทึกเงินมัดจำถังน้ำดื่มหรืออุปกรณ์'
                : 'ลองปรับเปลี่ยนคำค้นหา หรือตัวกรองสถานะด้านบน'}
            </p>
            {deposits.length === 0 && (
              <button
                onClick={openNewModal}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                <Plus className="w-4 h-4" />
                รับเงินประกันรายการแรก
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">เลขที่ / วันที่</th>
                    <th className="py-3 px-4">ลูกค้า & สายส่ง</th>
                    <th className="py-3 px-4">รายการถัง / อุปกรณ์</th>
                    <th className="py-3 px-4 text-center">จำนวน</th>
                    <th className="py-3 px-4 text-right">ยอดเงินประกัน</th>
                    <th className="py-3 px-4 text-center">วิธีชำระ</th>
                    <th className="py-3 px-4 text-center">สถานะ</th>
                    <th className="py-3 px-4 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                  {filteredDeposits.map((dep) => (
                    <tr key={dep.id} className="hover:bg-blue-50/40 transition">
                      {/* 1. Deposit No & Date */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{dep.depositNumber}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDateThai(dep.createdAt)}
                        </div>
                      </td>

                      {/* 2. Customer & Route */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{dep.customerName}</div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                          {dep.customerPhone && (
                            <span className="flex items-center gap-0.5">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {dep.customerPhone}
                            </span>
                          )}
                          {dep.routeName && (
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold">
                              {dep.routeName}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 3. Item type */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{dep.itemType}</div>
                        <div className="text-[11px] text-slate-400">
                          @ ฿{dep.unitPrice?.toLocaleString()} / หน่วย
                        </div>
                      </td>

                      {/* 4. Quantity */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-bold text-slate-900 text-sm px-2.5 py-1 rounded-lg bg-slate-100">
                          {dep.quantity}
                        </span>
                      </td>

                      {/* 5. Total Amount */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-bold text-slate-900 text-sm">
                          ฿{dep.totalAmount?.toLocaleString()}
                        </div>
                        {dep.refundedAmount ? (
                          <div className="text-[11px] text-blue-600 font-medium">
                            คืนแล้ว ฿{dep.refundedAmount.toLocaleString()}
                          </div>
                        ) : null}
                        {dep.deductedAmount ? (
                          <div className="text-[11px] text-rose-500 font-medium">
                            หักชำรุด ฿{dep.deductedAmount.toLocaleString()}
                          </div>
                        ) : null}
                      </td>

                      {/* 6. Payment method */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700">
                          {dep.paymentMethod === 'transfer'
                            ? 'โอนเงิน'
                            : dep.paymentMethod === 'credit'
                            ? 'เครดิต'
                            : 'เงินสด'}
                        </span>
                      </td>

                      {/* 7. Status */}
                      <td className="py-3.5 px-4 text-center">
                        {dep.status === 'active' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                            ถือครองอยู่
                          </span>
                        ) : dep.status === 'refunded' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            <Check className="w-3 h-3 text-blue-700" />
                            คืนเงินแล้ว
                          </span>
                        ) : dep.status === 'forfeited' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            หักชำรุด
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            คืนบางส่วน
                          </span>
                        )}
                      </td>

                      {/* 8. Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Print Slip */}
                          <button
                            title="พิมพ์ใบรับเงินประกัน"
                            onClick={() => setDepositForPrint(dep)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* View details */}
                          <button
                            title="ดูรายละเอียด"
                            onClick={() => setSelectedDepositForView(dep)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Refund action */}
                          {(dep.status === 'active' || dep.status === 'partial_refunded') && (
                            <button
                              title="บันทึกคืนเงินประกัน"
                              onClick={() => openRefundModal(dep)}
                              className="px-2 py-1 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              คืนเงิน
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            title="ลบรายการ"
                            onClick={() => setDepositToDelete(dep)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="block lg:hidden divide-y divide-slate-100">
              {filteredDeposits.map((dep) => (
                <div key={dep.id} className="p-4 space-y-2.5 hover:bg-slate-50/60 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-extrabold text-sm text-slate-900">{dep.depositNumber}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {formatDateThai(dep.createdAt)}
                      </div>
                    </div>
                    {dep.status === 'active' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        ถือครองอยู่
                      </span>
                    ) : dep.status === 'refunded' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                        คืนแล้ว
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                        หักชำรุด
                      </span>
                    )}
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1">
                    <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                      <span>{dep.customerName}</span>
                      {dep.routeName && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200/70 text-slate-700">
                          {dep.routeName}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center justify-between">
                      <span>{dep.itemType}</span>
                      <span className="font-bold text-slate-800">จำนวน {dep.quantity} ใบ</span>
                    </div>
                    <div className="text-xs font-extrabold text-blue-700 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                      <span>ยอดเงินประกัน:</span>
                      <span>฿{dep.totalAmount?.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => setDepositForPrint(dep)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center gap-1"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      ใบรับเงิน
                    </button>
                    {(dep.status === 'active' || dep.status === 'partial_refunded') && (
                      <button
                        onClick={() => openRefundModal(dep)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1 shadow-2xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        คืนเงินประกัน
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedDepositForView(dep)}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDepositToDelete(dep)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 5. MODAL: บันทึกรับเงินประกันใหม่ (New Deposit) */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200/80 my-8 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">บันทึกรับเงินประกันใหม่</h3>
                  <p className="text-[11px] text-slate-400">เงินมัดจำถังน้ำดื่ม / อุปกรณ์ค้ำประกัน</p>
                </div>
              </div>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDeposit} className="space-y-4">
              {/* Customer Selection */}
              <div className="relative">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ชื่อลูกค้า / ร้านค้า <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={newCustName}
                    onChange={(e) => handleCustNameChange(e.target.value)}
                    placeholder="พิมพ์ชื่อลูกค้า หรือเลือกลูกค้าในระบบ..."
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                  {newCustName && (
                    <button
                      type="button"
                      onClick={() => { setNewCustName(''); setShowSuggestions(false); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Autocomplete dropdown */}
                {showSuggestions && custSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {custSuggestions.map((c, i) => (
                      <div
                        key={i}
                        onClick={() => handleSelectCustomer(c)}
                        className="p-2.5 text-xs hover:bg-blue-50 cursor-pointer transition flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{c.name}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                            {c.phone && <span>{c.phone}</span>}
                            {c.routeName && <span className="text-blue-600 font-semibold">{c.routeName}</span>}
                          </div>
                        </div>
                        <span className="text-[10px] text-blue-600 font-semibold">เลือกลูกค้านี้</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Phone & Route */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">เบอร์ติดต่อ</label>
                  <input
                    type="tel"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    placeholder="08X-XXX-XXXX"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">สายส่ง (Route)</label>
                  <select
                    value={newRouteName}
                    onChange={(e) => setNewRouteName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white"
                  >
                    <option value="">-- ไม่ระบุสายส่ง --</option>
                    {routes.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ที่อยู่ส่งมอบทรัพย์สิน</label>
                <input
                  type="text"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  placeholder="สถานที่วางถังน้ำดื่ม / ที่อยู่ลูกค้า..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>

              {/* Item Presets */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ประเภทถัง / ทรัพย์สินที่ค้ำประกัน <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedPresetIdx}
                  onChange={(e) => handleSelectPreset(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white font-semibold"
                >
                  {CONTAINER_PRESETS.map((p, idx) => (
                    <option key={idx} value={idx}>
                      {p.name}
                    </option>
                  ))}
                </select>

                {/* Custom Item name if selected "กำหนดเอง" */}
                {selectedPresetIdx === CONTAINER_PRESETS.length - 1 && (
                  <input
                    type="text"
                    required
                    value={newCustomItem}
                    onChange={(e) => setNewCustomItem(e.target.value)}
                    placeholder="ระบุชื่อทรัพย์สินหรือประเภทถัง..."
                    className="w-full mt-2 px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                )}
              </div>

              {/* Quantity & Unit Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    จำนวน (หน่วย) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newQty}
                    onChange={(e) => setNewQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    เงินประกัน / หน่วย (บ.) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    required
                    value={newUnitPrice}
                    onChange={(e) => setNewUnitPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-bold"
                  />
                </div>
              </div>

              {/* Calculated Total Box */}
              <div className="bg-blue-50/80 rounded-2xl p-3.5 border border-blue-200/60 flex items-center justify-between">
                <div>
                  <span className="text-xs text-blue-900 font-semibold block">ยอดเงินประกันรวมทั้งสิ้น</span>
                  <span className="text-[11px] text-blue-600">
                    {newQty} x ฿{newUnitPrice.toLocaleString()}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-blue-900">
                    ฿{(newQty * newUnitPrice).toLocaleString()}
                  </span>
                  <div className="text-[10px] text-blue-700 font-bold">
                    ({bahtText(newQty * newUnitPrice)})
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ช่องทางรับเงิน</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewPaymentMethod('cash')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      newPaymentMethod === 'cash'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    เงินสด
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPaymentMethod('transfer')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      newPaymentMethod === 'transfer'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    โอนเงิน
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPaymentMethod('credit')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      newPaymentMethod === 'credit'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    เครดิต
                  </button>
                </div>
              </div>

              {/* Photo Slip / Attachment */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  รูปถ่ายหลักฐาน / สลิปโอนเงิน (ถ้ามี)
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl p-3 text-center cursor-pointer transition bg-slate-50/50 hover:bg-blue-50/30">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <div className="flex items-center justify-center gap-2 text-xs text-slate-600 font-semibold">
                      <Camera className="w-4 h-4 text-blue-600" />
                      <span>{newSlipPhoto ? 'เปลี่ยนรูปภาพ' : 'อัปโหลดสลิป / ถ่ายรูป'}</span>
                    </div>
                  </label>
                  {newSlipPhoto && (
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-slate-200 shrink-0">
                      <img src={newSlipPhoto} alt="Slip" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setNewSlipPhoto('')}
                        className="absolute inset-0 bg-slate-900/40 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">หมายเหตุเพิ่มเติม</label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="เช่น มัดจำถังใหม่ 5 ใบ, วางไว้ที่ร้านอาหารด้านหน้า..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกรับเงินประกัน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: คืนเงินประกัน (Refund Deposit) */}
      {depositForRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200/80 my-8 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">บันทึกคืนเงินประกัน</h3>
                  <p className="text-[11px] text-slate-400">เลขที่ {depositForRefund.depositNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setDepositForRefund(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Deposit Info Card */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">ลูกค้า:</span>
                <span className="font-bold text-slate-900">{depositForRefund.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">รายการ:</span>
                <span className="font-semibold text-slate-800">{depositForRefund.itemType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">จำนวนที่มัดจำไว้:</span>
                <span className="font-bold text-slate-900">{depositForRefund.quantity} หน่วย</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200/60">
                <span className="text-slate-600 font-bold">ยอดเงินประกันเดิม:</span>
                <span className="font-extrabold text-blue-700">
                  ฿{depositForRefund.totalAmount?.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {/* Return Quantity */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  จำนวนถัง/อุปกรณ์ที่นำมาคืน (หน่วย)
                </label>
                <input
                  type="number"
                  min="0"
                  max={depositForRefund.quantity}
                  value={refundQty}
                  onChange={(e) => setRefundQty(Math.min(depositForRefund.quantity, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                />
              </div>

              {/* Damaged or Deducted Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  หักค่าถังแตก / ชำรุด / สูญหาย (บาท)
                </label>
                <input
                  type="number"
                  min="0"
                  max={depositForRefund.totalAmount}
                  value={deductAmount}
                  onChange={(e) => setDeductAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold text-rose-600 focus:ring-2 focus:ring-rose-500/20 outline-none"
                />
              </div>

              {/* Deduction Reason */}
              {deductAmount > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    สาเหตุการหักเงินประกัน
                  </label>
                  <input
                    type="text"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="เช่น ถังแตก 1 ใบ, หัวก๊อกหัก..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                  />
                </div>
              )}

              {/* Net Refund Calculation */}
              <div className="bg-emerald-50 rounded-2xl p-3.5 border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-xs text-emerald-900 font-bold block">ยอดเงินคืนลูกค้าสุทธิ</span>
                  <span className="text-[10px] text-emerald-700">
                    ฿{depositForRefund.totalAmount} - ฿{deductAmount}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-emerald-900">
                    ฿{Math.max(0, (depositForRefund.totalAmount || 0) - deductAmount).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Refund Method */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">วิธีการคืนเงิน</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRefundPaymentMethod('cash')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      refundPaymentMethod === 'cash'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    เงินสด
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefundPaymentMethod('transfer')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      refundPaymentMethod === 'transfer'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    โอนคืนเข้าบัญชี
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDepositForRefund(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmRefund}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันการคืนเงิน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: ดูรายละเอียดเงินประกัน (View Detail) */}
      {selectedDepositForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200/80 my-8 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    รายละเอียดเงินประกัน {selectedDepositForView.depositNumber}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    บันทึกเมื่อ {formatDateThai(selectedDepositForView.createdAt)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDepositForView(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[11px]">ชื่อลูกค้า</span>
                  <span className="font-bold text-slate-900">{selectedDepositForView.customerName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">เบอร์ติดต่อ</span>
                  <span className="font-semibold text-slate-800">{selectedDepositForView.customerPhone || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">สายส่ง (Route)</span>
                  <span className="font-semibold text-slate-800">{selectedDepositForView.routeName || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">ผู้รับเงินมัดจำ</span>
                  <span className="font-semibold text-slate-800">{selectedDepositForView.receivedBy || '-'}</span>
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">ประเภททรัพย์สิน:</span>
                  <span className="font-bold text-slate-900">{selectedDepositForView.itemType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">จำนวน:</span>
                  <span className="font-bold text-slate-900">{selectedDepositForView.quantity} หน่วย</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">มัดจำต่อหน่วย:</span>
                  <span className="font-semibold text-slate-800">฿{selectedDepositForView.unitPrice?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-700 font-bold">ยอดเงินประกันรวม:</span>
                  <span className="font-black text-blue-700 text-sm">
                    ฿{selectedDepositForView.totalAmount?.toLocaleString()}
                  </span>
                </div>
                {selectedDepositForView.refundedAmount ? (
                  <div className="flex justify-between text-blue-600">
                    <span>ยอดคืนแล้ว:</span>
                    <span className="font-bold">฿{selectedDepositForView.refundedAmount.toLocaleString()}</span>
                  </div>
                ) : null}
                {selectedDepositForView.deductedAmount ? (
                  <div className="flex justify-between text-rose-600">
                    <span>หักชำรุด:</span>
                    <span className="font-bold">฿{selectedDepositForView.deductedAmount.toLocaleString()}</span>
                  </div>
                ) : null}
              </div>

              {selectedDepositForView.notes && (
                <div className="p-3 bg-amber-50 rounded-xl text-amber-900 text-xs">
                  <span className="font-bold block mb-0.5">หมายเหตุ:</span>
                  {selectedDepositForView.notes}
                </div>
              )}

              {selectedDepositForView.slipPhotoUrl && (
                <div>
                  <span className="font-bold text-slate-700 block mb-1">รูปถ่ายหลักฐาน / สลิป</span>
                  <div className="rounded-xl overflow-hidden border border-slate-200 max-h-56 bg-slate-100 flex items-center justify-center">
                    <img
                      src={selectedDepositForView.slipPhotoUrl}
                      alt="Slip"
                      className="max-h-56 w-auto object-contain"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => {
                  setDepositForPrint(selectedDepositForView);
                  setSelectedDepositForView(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                พิมพ์ใบรับเงิน
              </button>
              <button
                onClick={() => setSelectedDepositForView(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL: พิมพ์ใบรับเงินประกันมัดจำถัง (Printable Receipt Voucher) */}
      {depositForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8 space-y-6 print:m-0 print:p-0 print:shadow-none print:border-none">
            {/* Header / Actions toolbar (hidden on print) */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-extrabold text-slate-900">
                  พิมพ์ใบสำคัญรับเงินประกันมัดจำถัง
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  สั่งพิมพ์ (Print)
                </button>
                <button
                  onClick={() => setDepositForPrint(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* PRINTABLE RECEIPT CONTENT */}
            <div id="printable-deposit-voucher" className="space-y-5 text-slate-800 font-sans p-2">
              {/* Document Header */}
              <div className="flex items-start justify-between pb-4 border-b-2 border-slate-900">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-xs border border-slate-200 p-1">
                    <TotalEmblem className="w-10 h-10" />
                  </div>
                  <div>
                    <h1 className="font-black text-lg text-slate-900 tracking-tight leading-none">
                      TOTAL SOLUTION
                    </h1>
                    <p className="text-[11px] text-slate-500 font-medium mt-1">
                      ระบบจัดส่งน้ำดื่มและบริการโลจิสติกส์
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <h2 className="text-base font-black text-blue-800 tracking-tight leading-none uppercase">
                    ใบสำคัญรับเงินประกัน
                  </h2>
                  <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                    SECURITY DEPOSIT RECEIPT
                  </span>
                  <div className="text-xs font-extrabold text-slate-900 mt-2">
                    เลขที่: {depositForPrint.depositNumber}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    วันที่: {formatDateThai(depositForPrint.createdAt)}
                  </div>
                </div>
              </div>

              {/* Customer Info Box */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    ข้อมูลผู้ฝาก / ลูกค้า (Customer)
                  </span>
                  <div className="font-extrabold text-sm text-slate-900 mt-1">
                    {depositForPrint.customerName}
                  </div>
                  {depositForPrint.customerPhone && (
                    <div className="text-slate-600 mt-0.5">โทร: {depositForPrint.customerPhone}</div>
                  )}
                  {depositForPrint.customerAddress && (
                    <div className="text-slate-600 mt-0.5">ที่อยู่: {depositForPrint.customerAddress}</div>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    สายการจัดส่ง & ผู้รับเงิน
                  </span>
                  <div className="text-slate-800 font-semibold mt-1">
                    สายส่ง: {depositForPrint.routeName || 'สายส่งทั่วไป'}
                  </div>
                  <div className="text-slate-800 font-semibold mt-0.5">
                    เจ้าหน้าที่รับเงิน: {depositForPrint.receivedBy || 'เจ้าหน้าที่'}
                  </div>
                  <div className="text-slate-600 mt-0.5">
                    ชำระโดย: {depositForPrint.paymentMethod === 'transfer' ? 'โอนเงิน' : 'เงินสด'}
                  </div>
                </div>
              </div>

              {/* Deposit Items Table */}
              <table className="w-full text-xs text-left border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                    <th className="py-2.5 px-3">ลำดับ</th>
                    <th className="py-2.5 px-3">รายการทรัพย์สิน / ถังน้ำดื่มที่ค้ำประกัน</th>
                    <th className="py-2.5 px-3 text-center">จำนวน (หน่วย)</th>
                    <th className="py-2.5 px-3 text-right">เงินประกัน/หน่วย</th>
                    <th className="py-2.5 px-3 text-right">จำนวนเงิน (บาท)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="py-3 px-3 text-center font-bold">1</td>
                    <td className="py-3 px-3 font-bold text-slate-900">
                      {depositForPrint.itemType}
                      {depositForPrint.notes && (
                        <div className="text-[11px] font-normal text-slate-500 mt-0.5">
                          * {depositForPrint.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-900">
                      {depositForPrint.quantity}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-800">
                      ฿{depositForPrint.unitPrice?.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-extrabold text-slate-900">
                      ฿{depositForPrint.totalAmount?.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-bold border-t-2 border-slate-400">
                    <td colSpan={3} className="py-3 px-3 text-slate-700">
                      จำนวนเงินตัวอักษร: <span className="text-slate-900 font-extrabold">{bahtText(depositForPrint.totalAmount)}</span>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-700">ยอดรวมทั้งสิ้น</td>
                    <td className="py-3 px-3 text-right font-black text-sm text-blue-900">
                      ฿{depositForPrint.totalAmount?.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Terms and Conditions */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <span className="font-bold text-slate-800 block">เงื่อนไขการรับคืนเงินประกันมัดจำ:</span>
                <p>1. โปรดเก็บใบรับเงินประกันฉบับนี้ไว้เป็นหลักฐานเพื่อใช้แสดงสิทธิขอรับเงินประกันคืน</p>
                <p>2. การขอรับเงินคืน จะต้องส่งคืนถังน้ำดื่มหรืออุปกรณ์ในสภาพสมบูรณ์ ไม่แตก ชำรุด ลอย หรือดัดแปลง</p>
                <p>3. หากถังหรืออุปกรณ์ชำรุดเสียหาย บริษัทฯ ขอสงวนสิทธิ์ในการหักค่าเสียหายตามมูลค่าทรัพย์สิน</p>
              </div>

              {/* Signature Lines */}
              <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs">
                <div>
                  <div className="border-b border-slate-400 w-48 mx-auto pb-8"></div>
                  <span className="font-bold text-slate-800 block mt-2">
                    ( {depositForPrint.customerName} )
                  </span>
                  <span className="text-slate-500 text-[11px]">ผู้วางเงินประกัน / ลูกค้า</span>
                </div>
                <div>
                  <div className="border-b border-slate-400 w-48 mx-auto pb-8"></div>
                  <span className="font-bold text-slate-800 block mt-2">
                    ( {depositForPrint.receivedBy || 'เจ้าหน้าที่'} )
                  </span>
                  <span className="text-slate-500 text-[11px]">ผู้รับเงินประกัน / เจ้าหน้าที่</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. MODAL: ยืนยันการลบรายการ (Delete Confirmation) */}
      {depositToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">ยืนยันการลบรายการ</h3>
              <p className="text-xs text-slate-500 mt-1">
                คุณแน่ใจหรือไม่ว่าต้องการลบใบรับเงินประกันเลขที่{' '}
                <strong className="text-slate-800">{depositToDelete.depositNumber}</strong>{' '}
                ของลูกค้า {depositToDelete.customerName}?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDepositToDelete(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? 'กำลังลบ...' : 'ยืนยันลบ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
