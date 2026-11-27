import React, { useState, useMemo, useRef } from 'react';
import {
  FleetVehicle,
  PartnerDepositDeduction,
  PartnerDepositStatus,
  PartnerDepositVehicle,
  PartnerDepositVehicleSummary,
  PartnerDepositWithdrawal,
  StaffUser,
} from '../types';
import {
  ShieldCheck,
  Plus,
  Search,
  Truck,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  CheckCircle2,
  Clock,
  Ban,
  Phone,
  Calendar,
  FileText,
  FileSpreadsheet,
  SlidersHorizontal,
  Trash2,
  History,
  X,
  AlertTriangle,
  Link2,
  Info,
  ExternalLink,
} from 'lucide-react';
import {
  computePartnerDepositSummaries,
  exportPartnerDepositExcel,
  exportPartnerDepositPdf,
  formatCurrencyTHB,
  formatThaiDateBE,
  getCurrentMonthYear,
  getNextSequentialId,
  getTodayISODate,
} from '../utils/partnerDepositExport';

export interface DepositConfigPayload {
  depositEnabled: boolean;
  depositCode: string;
  depositStartDate: string;
  depositMonthlyDeduction: number;
  depositTargetAmount: number;
  depositStatus: PartnerDepositStatus;
  depositNotes?: string;
}

interface DepositManagementViewProps {
  vehicles: PartnerDepositVehicle[];
  deductions: PartnerDepositDeduction[];
  withdrawals: PartnerDepositWithdrawal[];
  fleetVehicles: FleetVehicle[];
  currentUser: StaffUser;
  sheetsConnected?: boolean;
  isSyncing?: boolean;
  onRefresh?: () => Promise<void> | void;
  onNavigateToFleet?: () => void;
  onSaveDepositConfig: (
    fleetVehicleId: string,
    config: DepositConfigPayload,
    isNewEnrollment: boolean
  ) => Promise<void> | void;
  onUnenrollVehicleDeposit: (
    fleetVehicleId: string,
    depositCode: string
  ) => Promise<void> | void;
  onAddDeduction: (
    deduction: PartnerDepositDeduction,
    autoStatusUpdate?: { fleetVehicleId: string; status: PartnerDepositStatus }
  ) => Promise<void> | void;
  onDeleteDeduction: (deductionId: string) => Promise<void> | void;
  onAddWithdrawal: (
    withdrawal: PartnerDepositWithdrawal,
    autoStatusUpdate?: { fleetVehicleId: string; status: PartnerDepositStatus }
  ) => Promise<void> | void;
  onDeleteWithdrawal: (withdrawalId: string) => Promise<void> | void;
  onShowToast?: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

const WITHDRAWAL_REASON_PRESETS = [
  'ค่าซ่อมบำรุงรถ',
  'เปลี่ยนยาง / ยางแตก',
  'สมทบเบี้ยประกัน / พ.ร.บ.',
  'เบิกฉุกเฉินระหว่างวิ่งงาน',
  'เบิกคืนเงินประกัน (หยุดวิ่งงาน)',
];

const STATUS_BADGE_STYLES: Record<PartnerDepositStatus, string> = {
  กำลังหักเงิน: 'bg-blue-50 text-[#1D4ED8] border-blue-200',
  ครบกำหนดหักแล้ว: 'bg-emerald-50 text-[#16A34A] border-emerald-200',
  หยุดวิ่งงาน: 'bg-red-50 text-[#DC2626] border-red-200',
};

export const DepositManagementView: React.FC<DepositManagementViewProps> = ({
  vehicles,
  deductions,
  withdrawals,
  fleetVehicles,
  currentUser,
  sheetsConnected = false,
  isSyncing = false,
  onRefresh,
  onNavigateToFleet,
  onSaveDepositConfig,
  onUnenrollVehicleDeposit,
  onAddDeduction,
  onDeleteDeduction,
  onAddWithdrawal,
  onDeleteWithdrawal,
  onShowToast,
}) => {
  const isReadOnly = currentUser.role === 'viewer';
  const historySectionRef = useRef<HTMLDivElement | null>(null);

  // Filters & view state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PartnerDepositStatus>('ALL');
  const [historyVehicleId, setHistoryVehicleId] = useState<string>('ALL');
  const [historyTab, setHistoryTab] = useState<'deductions' | 'withdrawals'>('deductions');
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Enroll / Configure Deposit Modal state (strictly binds to FleetVehicles)
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<PartnerDepositVehicleSummary | null>(null);
  const [includeCompanyFleet, setIncludeCompanyFleet] = useState(false);
  const [selectedFleetId, setSelectedFleetId] = useState<string>('');
  const [vCode, setVCode] = useState('');
  const [vStartDate, setVStartDate] = useState(getTodayISODate());
  const [vMonthly, setVMonthly] = useState('2500');
  const [vTarget, setVTarget] = useState('30000');
  const [vStatus, setVStatus] = useState<PartnerDepositStatus>('กำลังหักเงิน');
  const [vNotes, setVNotes] = useState('');
  const [vFormError, setVFormError] = useState('');

  // Deduction Modal state
  const [deductionTarget, setDeductionTarget] = useState<PartnerDepositVehicleSummary | null>(null);
  const [dId, setDId] = useState('');
  const [dMonthYear, setDMonthYear] = useState(getCurrentMonthYear());
  const [dDate, setDDate] = useState(getTodayISODate());
  const [dAmount, setDAmount] = useState('');
  const [dNotes, setDNotes] = useState('');
  const [dFormError, setDFormError] = useState('');

  // Withdrawal Modal state
  const [withdrawalTarget, setWithdrawalTarget] = useState<PartnerDepositVehicleSummary | null>(null);
  const [wId, setWId] = useState('');
  const [wDate, setWDate] = useState(getTodayISODate());
  const [wAmount, setWAmount] = useState('');
  const [wReason, setWReason] = useState('');
  const [wNotes, setWNotes] = useState('');
  const [wFormError, setWFormError] = useState('');

  // Confirm Delete Modal state
  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'vehicle' | 'deduction' | 'withdrawal';
    id: string;
    fleetVehicleId?: string;
    title: string;
    description: string;
  } | null>(null);

  // Derived vehicle summaries (live from FleetVehicles)
  const summaries = useMemo(
    () => computePartnerDepositSummaries(vehicles, deductions, withdrawals),
    [vehicles, deductions, withdrawals]
  );

  const summaryMap = useMemo(() => {
    const map = new Map<string, PartnerDepositVehicleSummary>();
    summaries.forEach((s) => map.set(s.vehicleId, s));
    return map;
  }, [summaries]);

  // Overall KPI metrics (7 metrics)
  const kpis = useMemo(() => {
    const totalVehicles = summaries.length;
    const totalDeductions = summaries.reduce((s, v) => s + v.totalDeductions, 0);
    const totalWithdrawals = summaries.reduce((s, v) => s + v.totalWithdrawals, 0);
    const netBalance = totalDeductions - totalWithdrawals;
    const activeCount = summaries.filter((v) => v.status === 'กำลังหักเงิน').length;
    const completedCount = summaries.filter((v) => v.status === 'ครบกำหนดหักแล้ว').length;
    const stoppedCount = summaries.filter((v) => v.status === 'หยุดวิ่งงาน').length;
    return {
      totalVehicles,
      totalDeductions,
      totalWithdrawals,
      netBalance,
      activeCount,
      completedCount,
      stoppedCount,
    };
  }, [summaries]);

  // Filtered vehicles list
  const filteredVehicles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return summaries.filter((v) => {
      if (statusFilter !== 'ALL' && v.status !== statusFilter) return false;
      if (!q) return true;
      return (
        v.vehicleId.toLowerCase().includes(q) ||
        v.licensePlate.toLowerCase().includes(q) ||
        v.driverName.toLowerCase().includes(q) ||
        (v.phone || '').toLowerCase().includes(q)
      );
    });
  }, [summaries, searchQuery, statusFilter]);

  // Filtered transaction history (newest first)
  const filteredDeductions = useMemo(() => {
    const list =
      historyVehicleId === 'ALL'
        ? deductions
        : deductions.filter((d) => d.vehicleId === historyVehicleId);
    return list
      .slice()
      .sort(
        (a, b) =>
          (b.date || '').localeCompare(a.date || '') ||
          (b.sheetsRowIndex || 0) - (a.sheetsRowIndex || 0) ||
          b.deductionId.localeCompare(a.deductionId)
      );
  }, [deductions, historyVehicleId]);

  const filteredWithdrawals = useMemo(() => {
    const list =
      historyVehicleId === 'ALL'
        ? withdrawals
        : withdrawals.filter((w) => w.vehicleId === historyVehicleId);
    return list
      .slice()
      .sort(
        (a, b) =>
          (b.date || '').localeCompare(a.date || '') ||
          (b.sheetsRowIndex || 0) - (a.sheetsRowIndex || 0) ||
          b.withdrawalId.localeCompare(a.withdrawalId)
      );
  }, [withdrawals, historyVehicleId]);

  // Fleet vehicles not yet enrolled in the deposit fund
  const unenrolledFleetVehicles = useMemo(() => {
    return fleetVehicles
      .filter((fv) => !fv.depositEnabled && !fv.depositCode)
      .filter((fv) => includeCompanyFleet || fv.ownershipType === 'hired')
      .slice()
      .sort((a, b) => {
        if (a.ownershipType !== b.ownershipType) {
          return a.ownershipType === 'hired' ? -1 : 1;
        }
        return (a.plateNumber || '').localeCompare(b.plateNumber || '', 'th');
      });
  }, [fleetVehicles, includeCompanyFleet]);

  const selectedFleetVehicle = useMemo(() => {
    const idToFind = editingVehicle?.fleetVehicleId || selectedFleetId;
    if (!idToFind) return null;
    return fleetVehicles.find((fv) => fv.id === idToFind) || null;
  }, [fleetVehicles, editingVehicle, selectedFleetId]);

  // Open Modal: Enroll a FleetVehicle into Deposit Fund
  const openEnrollModal = () => {
    setEditingVehicle(null);
    setIncludeCompanyFleet(false);
    const firstAvailable = fleetVehicles.find(
      (fv) => !fv.depositEnabled && !fv.depositCode && fv.ownershipType === 'hired'
    );
    setSelectedFleetId(firstAvailable?.id || '');
    setVCode(getNextSequentialId('V', vehicles.map((v) => v.vehicleId), 3));
    setVStartDate(getTodayISODate());
    setVMonthly('2500');
    setVTarget('30000');
    setVStatus('กำลังหักเงิน');
    setVNotes('');
    setVFormError('');
    setShowConfigModal(true);
  };

  // Open Modal: Edit Deposit Settings Only (vehicle master fields are read-only)
  const openEditConfigModal = (v: PartnerDepositVehicleSummary) => {
    setEditingVehicle(v);
    setSelectedFleetId(v.fleetVehicleId || '');
    setVCode(v.vehicleId);
    setVStartDate(v.startDate || getTodayISODate());
    setVMonthly(String(v.monthlyDeduction ?? 2500));
    setVTarget(String(v.targetAmount ?? 30000));
    setVStatus(v.status);
    setVNotes(v.notes || '');
    setVFormError('');
    setShowConfigModal(true);
  };

  // Save Deposit Config onto FleetVehicles
  const handleSubmitConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const targetFleetId = editingVehicle?.fleetVehicleId || selectedFleetId;
    const cleanCode = vCode.trim();
    const monthlyNum = Number(vMonthly);
    const targetNum = Number(vTarget);

    if (!targetFleetId) {
      setVFormError('กรุณาเลือกรถจากทะเบียนกองรถ (หากยังไม่มีรถให้เพิ่มที่เมนูจัดการรถก่อน)');
      return;
    }
    if (!cleanCode) {
      setVFormError('กรุณาระบุรหัสกองทุน (เช่น V018)');
      return;
    }
    if (
      !editingVehicle &&
      vehicles.some((v) => v.vehicleId.toLowerCase() === cleanCode.toLowerCase())
    ) {
      setVFormError(`รหัสกองทุน "${cleanCode}" ถูกใช้งานแล้ว กรุณาใช้รหัสอื่น`);
      return;
    }
    if (isNaN(monthlyNum) || monthlyNum < 0) {
      setVFormError('อัตราหักสะสมต่อเดือนต้องเป็นตัวเลขที่มากกว่าหรือเท่ากับ 0');
      return;
    }
    if (isNaN(targetNum) || targetNum <= 0) {
      setVFormError('วงเงินสะสมเป้าหมายต้องมากกว่า 0 บาท');
      return;
    }

    onSaveDepositConfig(
      targetFleetId,
      {
        depositEnabled: true,
        depositCode: cleanCode,
        depositStartDate: vStartDate || getTodayISODate(),
        depositMonthlyDeduction: monthlyNum,
        depositTargetAmount: targetNum,
        depositStatus: vStatus,
        depositNotes: vNotes.trim() || undefined,
      },
      !editingVehicle
    );
    setShowConfigModal(false);
  };

  // Open Deduction Modal
  const openDeductionModal = (v: PartnerDepositVehicleSummary) => {
    setDeductionTarget(v);
    setDId(getNextSequentialId('D', deductions.map((d) => d.deductionId), 4));
    setDMonthYear(getCurrentMonthYear());
    setDDate(getTodayISODate());
    setDAmount(String(v.monthlyDeduction || 2500));
    setDNotes('');
    setDFormError('');
  };

  // Save Deduction (auto-updates depositStatus on FleetVehicles when reaching target)
  const handleSubmitDeduction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deductionTarget) return;

    const cleanId = dId.trim();
    const amountNum = Number(dAmount);
    if (!cleanId) {
      setDFormError('กรุณาระบุรหัสรายการหัก');
      return;
    }
    if (deductions.some((d) => d.deductionId.toLowerCase() === cleanId.toLowerCase())) {
      setDFormError(`รหัสรายการ "${cleanId}" ซ้ำกับรายการที่มีอยู่`);
      return;
    }
    if (isNaN(amountNum) || amountNum <= 0) {
      setDFormError('จำนวนเงินที่หักต้องมากกว่า 0 บาท');
      return;
    }

    const newDeduction: PartnerDepositDeduction = {
      deductionId: cleanId,
      vehicleId: deductionTarget.vehicleId,
      monthYear: dMonthYear.trim() || getCurrentMonthYear(),
      date: dDate || getTodayISODate(),
      amount: amountNum,
      notes: dNotes.trim() || undefined,
    };

    const projectedBalance = deductionTarget.currentBalance + amountNum;
    const autoStatusUpdate =
      deductionTarget.fleetVehicleId &&
      deductionTarget.status === 'กำลังหักเงิน' &&
      deductionTarget.targetAmount > 0 &&
      projectedBalance >= deductionTarget.targetAmount
        ? {
            fleetVehicleId: deductionTarget.fleetVehicleId,
            status: 'ครบกำหนดหักแล้ว' as PartnerDepositStatus,
          }
        : undefined;

    onAddDeduction(newDeduction, autoStatusUpdate);
    setDeductionTarget(null);
  };

  // Open Withdrawal Modal
  const openWithdrawalModal = (v: PartnerDepositVehicleSummary) => {
    setWithdrawalTarget(v);
    setWId(getNextSequentialId('W', withdrawals.map((w) => w.withdrawalId), 4));
    setWDate(getTodayISODate());
    setWAmount('');
    setWReason('');
    setWNotes('');
    setWFormError('');
  };

  // Save Withdrawal (auto-resumes กำลังหักเงิน on FleetVehicles if balance drops below target)
  const handleSubmitWithdrawal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawalTarget) return;

    const cleanId = wId.trim();
    const amountNum = Number(wAmount);
    const cleanReason = wReason.trim();

    if (!cleanId) {
      setWFormError('กรุณาระบุรหัสรายการเบิก');
      return;
    }
    if (withdrawals.some((w) => w.withdrawalId.toLowerCase() === cleanId.toLowerCase())) {
      setWFormError(`รหัสรายการ "${cleanId}" ซ้ำกับรายการที่มีอยู่`);
      return;
    }
    if (isNaN(amountNum) || amountNum <= 0) {
      setWFormError('จำนวนเงินที่เบิกต้องมากกว่า 0 บาท');
      return;
    }
    if (amountNum > withdrawalTarget.currentBalance) {
      setWFormError(
        `ไม่สามารถเบิกเกินยอดคงเหลือปัจจุบัน (${formatCurrencyTHB(withdrawalTarget.currentBalance)}) ได้`
      );
      return;
    }
    if (!cleanReason) {
      setWFormError('กรุณาระบุสาเหตุการเบิกเงินประกัน');
      return;
    }

    const newWithdrawal: PartnerDepositWithdrawal = {
      withdrawalId: cleanId,
      vehicleId: withdrawalTarget.vehicleId,
      date: wDate || getTodayISODate(),
      amount: amountNum,
      reason: cleanReason,
      notes: wNotes.trim() || undefined,
    };

    const projectedBalance = withdrawalTarget.currentBalance - amountNum;
    const autoStatusUpdate =
      withdrawalTarget.fleetVehicleId &&
      withdrawalTarget.status === 'ครบกำหนดหักแล้ว' &&
      projectedBalance < withdrawalTarget.targetAmount
        ? {
            fleetVehicleId: withdrawalTarget.fleetVehicleId,
            status: 'กำลังหักเงิน' as PartnerDepositStatus,
          }
        : undefined;

    onAddWithdrawal(newWithdrawal, autoStatusUpdate);
    setWithdrawalTarget(null);
  };

  // Scroll to history for specific vehicle
  const handleInspectVehicleHistory = (vehicleId: string) => {
    setHistoryVehicleId(vehicleId);
    historySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Confirm delete handler
  const handleConfirmDeleteAction = () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === 'vehicle' && confirmDelete.fleetVehicleId) {
      onUnenrollVehicleDeposit(confirmDelete.fleetVehicleId, confirmDelete.id);
      if (historyVehicleId === confirmDelete.id) {
        setHistoryVehicleId('ALL');
      }
    } else if (confirmDelete.type === 'deduction') {
      onDeleteDeduction(confirmDelete.id);
    } else if (confirmDelete.type === 'withdrawal') {
      onDeleteWithdrawal(confirmDelete.id);
    }
    setConfirmDelete(null);
  };

  // PDF Export
  const handleExportPdf = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      await exportPartnerDepositPdf({
        vehicles: summaries,
        deductions,
        withdrawals,
        selectedVehicleId: historyVehicleId,
        preparedBy: currentUser.name,
      });
      onShowToast?.(
        'success',
        'สร้างรายงาน PDF สำเร็จ',
        'ดาวน์โหลดไฟล์รายงานเงินประกันรถร่วม (A4) เรียบร้อยแล้ว'
      );
    } catch (err) {
      console.error('PDF export error:', err);
      onShowToast?.(
        'error',
        'สร้าง PDF ไม่สำเร็จ',
        'เกิดข้อผิดพลาดระหว่างสร้างไฟล์ PDF กรุณาลองใหม่อีกครั้ง'
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Excel Export
  const handleExportExcel = () => {
    try {
      exportPartnerDepositExcel({
        vehicles: summaries,
        deductions,
        withdrawals,
        selectedVehicleId: historyVehicleId,
      });
      onShowToast?.(
        'success',
        'ส่งออก Excel สำเร็จ',
        'ดาวน์โหลดไฟล์สรุปและประวัติเงินประกัน 3 ชีต (.xlsx) เรียบร้อยแล้ว'
      );
    } catch (err) {
      console.error('Excel export error:', err);
      onShowToast?.('error', 'ส่งออก Excel ไม่สำเร็จ', 'เกิดข้อผิดพลาดระหว่างสร้างไฟล์ Excel');
    }
  };

  // Computed live previews for Deduction & Withdrawal Modals
  const deductionAmountNum = Number(dAmount) || 0;
  const deductionNewBalance = deductionTarget
    ? deductionTarget.currentBalance + deductionAmountNum
    : 0;
  const deductionWillComplete =
    !!deductionTarget &&
    deductionTarget.status === 'กำลังหักเงิน' &&
    deductionTarget.targetAmount > 0 &&
    deductionAmountNum > 0 &&
    deductionNewBalance >= deductionTarget.targetAmount;

  const withdrawalAmountNum = Number(wAmount) || 0;
  const withdrawalRemainingBalance = withdrawalTarget
    ? withdrawalTarget.currentBalance - withdrawalAmountNum
    : 0;
  const withdrawalNewShortfall = withdrawalTarget
    ? Math.max(0, withdrawalTarget.targetAmount - withdrawalRemainingBalance)
    : 0;
  const withdrawalWillResumeDeduction =
    !!withdrawalTarget &&
    withdrawalTarget.status === 'ครบกำหนดหักแล้ว' &&
    withdrawalAmountNum > 0 &&
    withdrawalAmountNum <= withdrawalTarget.currentBalance &&
    withdrawalRemainingBalance < withdrawalTarget.targetAmount;

  return (
    <div className="space-y-5 pb-12">
      {/* =================================================================
          HEADER BAR
         ================================================================= */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#1D4ED8] text-white flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h1 className="text-lg sm:text-xl font-extrabold text-[#0F172A] tracking-tight">
            จัดการเงินประกันรถร่วมขนส่ง
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!isReadOnly && (
            <button
              type="button"
              onClick={openEnrollModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-bold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>เปิดบัญชีเงินประกันรถร่วม</span>
            </button>
          )}
        </div>
      </div>

      {/* =================================================================
          KPI SUMMARY ROW 1: 4 FINANCIAL METRICS
         ================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>รถร่วมในกองทุน</span>
            <Truck className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#0F172A] tabular-nums">
            {kpis.totalVehicles.toLocaleString()}
            <span className="text-xs font-semibold text-slate-500 ml-1.5">คัน</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
            หัก {deductions.length} ครั้ง • เบิก {withdrawals.length} ครั้ง
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>ยอดหักสมทบสะสมรวม</span>
            <ArrowDownLeft className="w-4 h-4 text-[#16A34A]" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#16A34A] tabular-nums">
            {formatCurrencyTHB(kpis.totalDeductions)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">รวมรายการหักสะสมทั้งหมด</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>ยอดเบิกจ่ายระหว่างสะสม</span>
            <ArrowUpRight className="w-4 h-4 text-[#DC2626]" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#DC2626] tabular-nums">
            {formatCurrencyTHB(kpis.totalWithdrawals)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">ซ่อมบำรุง / เบิกฉุกเฉิน / คืนเงิน</div>
        </div>

        <div className="bg-[#1D4ED8] text-white border border-[#1D4ED8] rounded-xl p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-blue-100">
            <span>กองทุนคงเหลือสุทธิ</span>
            <Wallet className="w-4 h-4 text-blue-200" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-white tabular-nums">
            {formatCurrencyTHB(kpis.netBalance)}
          </div>
          <div className="mt-1 text-[11px] text-blue-100">ยอดหักสะสมรวม − ยอดเบิกจ่ายรวม</div>
        </div>
      </div>

      {/* =================================================================
          KPI SUMMARY ROW 2: 3 STATUS METRICS (CLICKABLE QUICK FILTERS)
         ================================================================= */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() =>
            setStatusFilter((prev) => (prev === 'กำลังหักเงิน' ? 'ALL' : 'กำลังหักเงิน'))
          }
          className={`text-left rounded-xl p-3.5 sm:p-4 border transition-colors cursor-pointer ${
            statusFilter === 'กำลังหักเงิน'
              ? 'bg-blue-50/70 border-[#1D4ED8]'
              : 'bg-white border-slate-200 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">กำลังหักเงิน</span>
            <Clock className="w-4 h-4 text-[#1D4ED8]" />
          </div>
          <div className="mt-1.5 text-xl font-extrabold text-[#1D4ED8] tabular-nums">
            {kpis.activeCount}
            <span className="text-xs font-semibold text-slate-500 ml-1">คัน</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            setStatusFilter((prev) =>
              prev === 'ครบกำหนดหักแล้ว' ? 'ALL' : 'ครบกำหนดหักแล้ว'
            )
          }
          className={`text-left rounded-xl p-3.5 sm:p-4 border transition-colors cursor-pointer ${
            statusFilter === 'ครบกำหนดหักแล้ว'
              ? 'bg-emerald-50/70 border-[#16A34A]'
              : 'bg-white border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">ครบกำหนดหักแล้ว</span>
            <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
          </div>
          <div className="mt-1.5 text-xl font-extrabold text-[#16A34A] tabular-nums">
            {kpis.completedCount}
            <span className="text-xs font-semibold text-slate-500 ml-1">คัน</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            setStatusFilter((prev) => (prev === 'หยุดวิ่งงาน' ? 'ALL' : 'หยุดวิ่งงาน'))
          }
          className={`text-left rounded-xl p-3.5 sm:p-4 border transition-colors cursor-pointer ${
            statusFilter === 'หยุดวิ่งงาน'
              ? 'bg-red-50/70 border-[#DC2626]'
              : 'bg-white border-slate-200 hover:border-red-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">หยุดวิ่งงาน</span>
            <Ban className="w-4 h-4 text-[#DC2626]" />
          </div>
          <div className="mt-1.5 text-xl font-extrabold text-[#DC2626] tabular-nums">
            {kpis.stoppedCount}
            <span className="text-xs font-semibold text-slate-500 ml-1">คัน</span>
          </div>
        </button>
      </div>

      {/* =================================================================
          SEARCH & STATUS FILTER BAR
         ================================================================= */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาทะเบียนรถ, ชื่อคนขับ, รหัสกองทุน หรือเบอร์โทร..."
            className="w-full pl-9 pr-8 py-2 text-sm bg-[#F8FAFC] border border-slate-200 rounded-lg text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-[#1D4ED8] focus:bg-white transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              aria-label="ล้างคำค้นหา"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="inline-flex bg-[#F1F5F9] p-1 rounded-lg border border-slate-200/80 text-xs overflow-x-auto">
          {(
            [
              { id: 'ALL', label: `ทั้งหมด (${kpis.totalVehicles})` },
              { id: 'กำลังหักเงิน', label: `กำลังหักเงิน (${kpis.activeCount})` },
              { id: 'ครบกำหนดหักแล้ว', label: `ครบกำหนด (${kpis.completedCount})` },
              { id: 'หยุดวิ่งงาน', label: `หยุดวิ่งงาน (${kpis.stoppedCount})` },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStatusFilter(item.id)}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors whitespace-nowrap cursor-pointer tabular-nums ${
                statusFilter === item.id
                  ? 'bg-[#1D4ED8] text-white'
                  : 'text-slate-600 hover:text-[#0F172A]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* =================================================================
          VEHICLE CARDS GRID (POPULATED / LOADING / EMPTY STATES)
         ================================================================= */}
      {isSyncing && vehicles.length === 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse space-y-4"
            >
              <div className="flex justify-between">
                <div className="h-5 bg-slate-200 rounded w-40" />
                <div className="h-5 bg-slate-200 rounded w-24" />
              </div>
              <div className="h-3 bg-slate-100 rounded w-full" />
              <div className="h-10 bg-slate-100 rounded w-full" />
            </div>
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#F1F5F9] text-slate-400 flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#0F172A]">
            ยังไม่มีรถร่วมที่เปิดบัญชีเงินประกัน
          </h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            เลือกรถร่วมจากฐานข้อมูลกลางในเมนู "จัดการรถ" เพื่อเปิดบัญชีเงินประกันและกำหนดอัตราหักสะสมรายเดือน
          </p>
          {!isReadOnly && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={openEnrollModal}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>เปิดบัญชีเงินประกันรถร่วม</span>
              </button>
              {onNavigateToFleet && (
                <button
                  type="button"
                  onClick={onNavigateToFleet}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Truck className="w-4 h-4" />
                  <span>ไปเมนูจัดการรถ</span>
                </button>
              )}
            </div>
          )}
        </div>
      ) : filteredVehicles.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-sm font-semibold text-slate-600">
            ไม่พบข้อมูลรถร่วมที่ตรงกับเงื่อนไขการค้นหา
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('ALL');
            }}
            className="mt-3 text-xs font-bold text-[#1D4ED8] hover:underline cursor-pointer"
          >
            ล้างตัวกรองทั้งหมด
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filteredVehicles.map((v) => {
            const isTargetReached = v.remainingAmount <= 0 && v.targetAmount > 0;
            const estMonthsLeft =
              v.remainingAmount > 0 && v.monthlyDeduction > 0
                ? Math.ceil(v.remainingAmount / v.monthlyDeduction)
                : 0;
            const isDeductionDisabled =
              v.status === 'ครบกำหนดหักแล้ว' && isTargetReached;
            const isWithdrawalDisabled = v.currentBalance <= 0;

            return (
              <div
                key={v.fleetVehicleId || v.vehicleId}
                className="bg-white border border-slate-200 rounded-xl flex flex-col justify-between overflow-hidden hover:border-slate-300 transition-colors"
              >
                <div className="p-4 sm:p-5 space-y-4">
                  {/* Top row: Plate, ID, Driver, Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#F1F5F9] text-slate-700 border border-slate-200 tabular-nums">
                          {v.vehicleId}
                        </span>
                        <h3 className="text-base sm:text-lg font-extrabold text-[#0F172A] truncate">
                          {v.licensePlate}
                        </h3>
                        <span
                          title="เชื่อมตรงกับฐานข้อมูล FleetVehicles"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500"
                        >
                          <Link2 className="w-3 h-3 text-[#1D4ED8]" />
                          กองรถหลัก
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                        <span className="font-semibold text-[#0F172A]">
                          {v.driverName || 'ยังไม่ระบุคนขับ'}
                        </span>
                        {v.phone && (
                          <a
                            href={`tel:${v.phone}`}
                            className="inline-flex items-center gap-1 text-slate-500 hover:text-[#1D4ED8] tabular-nums"
                          >
                            <Phone className="w-3 h-3" />
                            {v.phone}
                          </a>
                        )}
                        <span className="inline-flex items-center gap-1 text-slate-500 tabular-nums">
                          <Calendar className="w-3 h-3" />
                          เริ่ม {formatThaiDateBE(v.startDate)}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-md border ${STATUS_BADGE_STYLES[v.status]}`}
                    >
                      {v.status}
                    </span>
                  </div>

                  {/* Balance & Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-semibold text-slate-500 block">
                          ยอดเงินประกันคงเหลือสุทธิ
                        </span>
                        <span className="text-xl sm:text-2xl font-extrabold text-[#0F172A] tabular-nums">
                          {formatCurrencyTHB(v.currentBalance)}
                        </span>
                      </div>
                      <div className="text-right tabular-nums">
                        <span className="text-[11px] text-slate-500 block">
                          เป้าหมาย {formatCurrencyTHB(v.targetAmount)}
                        </span>
                        <span
                          className={`text-sm font-extrabold ${
                            isTargetReached ? 'text-[#16A34A]' : 'text-[#1D4ED8]'
                          }`}
                        >
                          {v.deductionPercentage}%
                        </span>
                      </div>
                    </div>

                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isTargetReached ? 'bg-[#16A34A]' : 'bg-[#1D4ED8]'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, v.deductionPercentage))}%` }}
                      />
                    </div>

                    {/* Deductions vs Withdrawals compact strip */}
                    <div className="grid grid-cols-3 gap-2 pt-1 text-xs border-t border-slate-100 tabular-nums">
                      <div>
                        <span className="text-slate-500 block text-[11px]">หักสะสมรวม</span>
                        <span className="font-bold text-[#16A34A]">
                          +{formatCurrencyTHB(v.totalDeductions)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">เบิกจ่ายรวม</span>
                        <span className="font-bold text-[#DC2626]">
                          -{formatCurrencyTHB(v.totalWithdrawals)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 block text-[11px]">อัตราหัก/เดือน</span>
                        <span className="font-bold text-[#0F172A]">
                          {formatCurrencyTHB(v.monthlyDeduction)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Smart Status Callout */}
                  {v.status === 'หยุดวิ่งงาน' ? (
                    <div className="flex items-start gap-2 text-xs px-3 py-2 rounded-lg bg-red-50/70 border border-red-200/80 text-red-800">
                      <Ban className="w-4 h-4 shrink-0 mt-0.5 text-[#DC2626]" />
                      <span className="tabular-nums">
                        หยุดวิ่งงานแล้ว • ยอดคงเหลือสุทธิรอตรวจสอบ/เคลียร์คืน{' '}
                        <strong>{formatCurrencyTHB(v.currentBalance)}</strong>
                      </span>
                    </div>
                  ) : isTargetReached ? (
                    <div className="flex items-start gap-2 text-xs px-3 py-2 rounded-lg bg-emerald-50/80 border border-emerald-200/80 text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#16A34A]" />
                      <span>
                        สะสมครบตามเป้าหมาย {formatCurrencyTHB(v.targetAmount)} แล้ว ควรระงับการหักรายเดือนชั่วคราว
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 text-xs px-3 py-2 rounded-lg bg-amber-50/80 border border-amber-200/80 text-amber-900">
                      <TrendingUp className="w-4 h-4 shrink-0 mt-0.5 text-[#D97706]" />
                      <span className="tabular-nums">
                        ขาดอีก <strong>{formatCurrencyTHB(v.remainingAmount)}</strong> จะครบเป้าหมาย
                        {estMonthsLeft > 0 ? ` (ประมาณ ${estMonthsLeft} งวด)` : ''}
                      </span>
                    </div>
                  )}

                  {v.notes && (
                    <p className="text-xs text-slate-500 border-l-2 border-slate-200 pl-2.5">
                      หมายเหตุ: {v.notes}
                    </p>
                  )}
                </div>

                {/* Action Footer */}
                <div className="px-4 sm:px-5 py-3 bg-[#F8FAFC] border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleInspectVehicleHistory(v.vehicleId)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>ดูประวัติ</span>
                    </button>
                    {!isReadOnly && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditConfigModal(v)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                          title="ตั้งค่าเงื่อนไขเงินประกัน"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          <span>ตั้งค่าหัก</span>
                        </button>
                        {v.fleetVehicleId && (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDelete({
                                type: 'vehicle',
                                id: v.vehicleId,
                                fleetVehicleId: v.fleetVehicleId,
                                title: `ถอดรถร่วม ${v.licensePlate} (${v.vehicleId}) ออกจากกองทุน`,
                                description:
                                  'ระบบจะปิดบัญชีเงินประกันและลบประวัติการหัก/เบิกของรถคันนี้ออก แต่ข้อมูลรถยังคงอยู่ในเมนู "จัดการรถ" ตามเดิม ยืนยันหรือไม่?',
                              })
                            }
                            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-[#DC2626] bg-white border border-slate-200 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer"
                            title="ถอดออกจากกองทุนเงินประกัน"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {!isReadOnly && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openWithdrawalModal(v)}
                        disabled={isWithdrawalDisabled}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#DC2626] bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>เบิกเงินประกัน</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openDeductionModal(v)}
                        disabled={isDeductionDisabled}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap tabular-nums"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>หักสะสม (+{formatCurrencyTHB(v.monthlyDeduction)})</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =================================================================
          TRANSACTION LEDGER & REPORTS SECTION
         ================================================================= */}
      <section
        id="partner-deposit-history"
        ref={historySectionRef}
        className="bg-white border border-slate-200 rounded-xl overflow-hidden"
      >
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-[#0F172A]">
              ประวัติรายการหักสะสมและเบิกจ่ายเงินประกัน
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ตรวจสอบรายการเดินบัญชีกองทุนย้อนหลัง และส่งออกรายงานทางการ PDF หรือไฟล์ Excel
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={historyVehicleId}
              onChange={(e) => setHistoryVehicleId(e.target.value)}
              aria-label="กรองประวัติตามรถร่วม"
              className="px-3 py-2 text-xs sm:text-sm font-semibold text-[#0F172A] bg-[#F8FAFC] border border-slate-200 rounded-lg focus:outline-none focus:border-[#1D4ED8]"
            >
              <option value="ALL">รถร่วมทุกคัน ({vehicles.length} คัน)</option>
              {summaries.map((v) => (
                <option key={v.vehicleId} value={v.vehicleId}>
                  {v.vehicleId} - {v.licensePlate} ({v.driverName || 'ไม่ระบุคนขับ'})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf || vehicles.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <FileText className="w-4 h-4" />
              <span>{isExportingPdf ? 'กำลังสร้าง PDF...' : 'ดาวน์โหลดรายงาน PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={vehicles.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-bold text-[#15803D] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>ส่งออก Excel</span>
            </button>
          </div>
        </div>

        {/* Ledger Sub-tabs */}
        <div className="px-4 sm:px-5 pt-3 border-b border-slate-200 bg-[#F8FAFC] flex items-center gap-4">
          <button
            type="button"
            onClick={() => setHistoryTab('deductions')}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer tabular-nums ${
              historyTab === 'deductions'
                ? 'border-[#1D4ED8] text-[#1D4ED8]'
                : 'border-transparent text-slate-500 hover:text-[#0F172A]'
            }`}
          >
            ประวัติการหักสมทบสะสม ({filteredDeductions.length})
          </button>
          <button
            type="button"
            onClick={() => setHistoryTab('withdrawals')}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer tabular-nums ${
              historyTab === 'withdrawals'
                ? 'border-[#DC2626] text-[#DC2626]'
                : 'border-transparent text-slate-500 hover:text-[#0F172A]'
            }`}
          >
            ประวัติการเบิกถอนออก ({filteredWithdrawals.length})
          </button>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          {historyTab === 'deductions' ? (
            filteredDeductions.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                ยังไม่มีประวัติการหักสมทบสะสม
                {historyVehicleId !== 'ALL' ? 'สำหรับรถร่วมคันนี้' : ''}
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-slate-200 text-slate-600 font-bold">
                    <th className="py-2.5 px-4 whitespace-nowrap">รหัส</th>
                    <th className="py-2.5 px-4 whitespace-nowrap">วันที่บันทึก</th>
                    <th className="py-2.5 px-4 whitespace-nowrap">งวดเดือน/ปี</th>
                    <th className="py-2.5 px-4 whitespace-nowrap">ทะเบียนรถ / คนขับ</th>
                    <th className="py-2.5 px-4 text-right whitespace-nowrap">จำนวนเงินหัก</th>
                    <th className="py-2.5 px-4">หมายเหตุ</th>
                    {!isReadOnly && (
                      <th className="py-2.5 px-4 text-right whitespace-nowrap">จัดการ</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {filteredDeductions.map((d) => {
                    const v = summaryMap.get(d.vehicleId);
                    return (
                      <tr key={d.deductionId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-4 font-mono text-xs font-bold text-slate-700 whitespace-nowrap">
                          {d.deductionId}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">
                          {formatThaiDateBE(d.date)}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-[#0F172A] whitespace-nowrap">
                          {d.monthYear || '-'}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="font-bold text-[#0F172A]">
                            {v ? v.licensePlate : d.vehicleId}
                          </div>
                          {v && <div className="text-xs text-slate-500">{v.driverName}</div>}
                        </td>
                        <td className="py-2.5 px-4 text-right font-extrabold text-[#16A34A] whitespace-nowrap">
                          +{formatCurrencyTHB(d.amount)}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 max-w-xs truncate">
                          {d.notes || '-'}
                        </td>
                        {!isReadOnly && (
                          <td className="py-2.5 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmDelete({
                                  type: 'deduction',
                                  id: d.deductionId,
                                  title: `ลบรายการหักสะสม ${d.deductionId}`,
                                  description: `ยืนยันการลบรายการหักเงินประกัน ${formatCurrencyTHB(d.amount)} (งวด ${d.monthYear}) ออกจากระบบ? ยอดคงเหลือของรถร่วมจะถูกคำนวณใหม่อัตโนมัติ`,
                                })
                              }
                              className="inline-flex items-center justify-center p-1.5 text-slate-400 hover:text-[#DC2626] hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                              title="ลบรายการ"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : filteredWithdrawals.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              ยังไม่มีประวัติการเบิกถอนเงินประกัน
              {historyVehicleId !== 'ALL' ? 'สำหรับรถร่วมคันนี้' : ''}
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-2.5 px-4 whitespace-nowrap">รหัส</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">วันที่เบิก</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">ทะเบียนรถ / คนขับ</th>
                  <th className="py-2.5 px-4">สาเหตุที่เบิก</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">จำนวนเงินเบิก</th>
                  <th className="py-2.5 px-4">หมายเหตุ</th>
                  {!isReadOnly && (
                    <th className="py-2.5 px-4 text-right whitespace-nowrap">จัดการ</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {filteredWithdrawals.map((w) => {
                  const v = summaryMap.get(w.vehicleId);
                  return (
                    <tr key={w.withdrawalId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-xs font-bold text-slate-700 whitespace-nowrap">
                        {w.withdrawalId}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">
                        {formatThaiDateBE(w.date)}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-bold text-[#0F172A]">
                          {v ? v.licensePlate : w.vehicleId}
                        </div>
                        {v && <div className="text-xs text-slate-500">{v.driverName}</div>}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-[#0F172A]">
                        {w.reason || '-'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-extrabold text-[#DC2626] whitespace-nowrap">
                        -{formatCurrencyTHB(w.amount)}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 max-w-xs truncate">
                        {w.notes || '-'}
                      </td>
                      {!isReadOnly && (
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDelete({
                                type: 'withdrawal',
                                id: w.withdrawalId,
                                title: `ลบรายการเบิกถอน ${w.withdrawalId}`,
                                description: `ยืนยันการลบรายการเบิกเงินประกัน ${formatCurrencyTHB(w.amount)} (${w.reason}) ออกจากระบบ? ยอดคงเหลือของรถร่วมจะถูกคำนวณใหม่อัตโนมัติ`,
                              })
                            }
                            className="inline-flex items-center justify-center p-1.5 text-slate-400 hover:text-[#DC2626] hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                            title="ลบรายการ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* =================================================================
          MODAL 1: ENROLL / CONFIGURE DEPOSIT TERMS (MASTER DATA READ-ONLY)
         ================================================================= */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden shadow-xl my-auto">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-[#1D4ED8]" />
                <h3 className="text-base font-extrabold text-[#0F172A]">
                  {editingVehicle
                    ? 'ตั้งค่าเงื่อนไขเงินประกันรถร่วม'
                    : 'เปิดบัญชีเงินประกันให้รถร่วม'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmitConfig}
              className="p-5 space-y-4 max-h-[82vh] overflow-y-auto"
            >
              {/* Select Vehicle from FleetVehicles when enrolling new */}
              {!editingVehicle && (
                <div className="p-3.5 rounded-lg bg-[#EFF6FF] border border-blue-200 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-[#1E40AF] flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5" />
                      เลือกรถจากฐานข้อมูลกลาง (เมนูจัดการรถ) *
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeCompanyFleet}
                        onChange={(e) => {
                          setIncludeCompanyFleet(e.target.checked);
                          setSelectedFleetId('');
                        }}
                        className="rounded border-slate-300"
                      />
                      แสดงรถบริษัทด้วย
                    </label>
                  </div>

                  {unenrolledFleetVehicles.length > 0 ? (
                    <select
                      value={selectedFleetId}
                      onChange={(e) => {
                        setSelectedFleetId(e.target.value);
                        setVFormError('');
                      }}
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-blue-200 rounded-lg text-[#0F172A] focus:outline-none focus:border-[#1D4ED8]"
                      required
                    >
                      <option value="">
                        -- เลือกรถที่ยังไม่เปิดบัญชีเงินประกัน ({unenrolledFleetVehicles.length} คัน) --
                      </option>
                      {unenrolledFleetVehicles.map((fv) => (
                        <option key={fv.id} value={fv.id}>
                          {fv.plateNumber}
                          {fv.province ? ` ${fv.province}` : ''} —{' '}
                          {fv.driverName || 'ยังไม่ระบุคนขับ'}
                          {fv.ownershipType === 'hired' ? ' [รถร่วม]' : ' [รถบริษัท]'}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 rounded-lg bg-white border border-blue-100 text-xs text-slate-600 space-y-2">
                      <p>
                        รถร่วมทั้งหมดในเมนู "จัดการรถ" เปิดบัญชีเงินประกันครบแล้ว หรือยังไม่ได้เพิ่มรถร่วมใหม่ในระบบ
                      </p>
                      {onNavigateToFleet && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowConfigModal(false);
                            onNavigateToFleet();
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1D4ED8] text-white font-bold text-xs hover:bg-[#1E40AF] cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>ไปเพิ่มรถใหม่ที่เมนูจัดการรถ</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Read-Only Master Vehicle Info Card */}
              {selectedFleetVehicle && (
                <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                      ข้อมูลรถจากฐานข้อมูลกลาง (อ่านอย่างเดียว)
                    </span>
                    {onNavigateToFleet && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowConfigModal(false);
                          onNavigateToFleet();
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1D4ED8] hover:underline cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>แก้ไขข้อมูลรถที่เมนูจัดการรถ</span>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div>
                      <span className="text-slate-500">ทะเบียนรถ: </span>
                      <strong className="text-[#0F172A]">
                        {selectedFleetVehicle.plateNumber}
                        {selectedFleetVehicle.province ? ` ${selectedFleetVehicle.province}` : ''}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">ประเภท: </span>
                      <strong className="text-[#0F172A]">
                        {selectedFleetVehicle.ownershipType === 'hired' ? 'รถร่วม' : 'รถบริษัท'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">พนักงานขับรถ: </span>
                      <strong className="text-[#0F172A]">
                        {selectedFleetVehicle.driverName || 'ยังไม่ระบุ'}
                      </strong>
                    </div>
                    <div className="tabular-nums">
                      <span className="text-slate-500">เบอร์โทร: </span>
                      <strong className="text-[#0F172A]">
                        {selectedFleetVehicle.driverPhone || '-'}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {vFormError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-[#DC2626] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{vFormError}</span>
                </div>
              )}

              {/* Deposit Configuration Fields Only */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    รหัสกองทุนเงินประกัน *
                  </label>
                  <input
                    type="text"
                    value={vCode}
                    onChange={(e) => setVCode(e.target.value)}
                    disabled={!!editingVehicle}
                    placeholder="V018"
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#1D4ED8] disabled:bg-slate-100 disabled:text-slate-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    วันที่เริ่มสะสมเงินประกัน
                  </label>
                  <input
                    type="date"
                    value={vStartDate}
                    onChange={(e) => setVStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#1D4ED8] tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    อัตราหักสะสมต่อเดือน (บาท) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={vMonthly}
                    onChange={(e) => setVMonthly(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#1D4ED8] tabular-nums"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    วงเงินสะสมเป้าหมาย (บาท) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="500"
                    value={vTarget}
                    onChange={(e) => setVTarget(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#1D4ED8] tabular-nums"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  สถานะกองทุน
                </label>
                <select
                  value={vStatus}
                  onChange={(e) => setVStatus(e.target.value as PartnerDepositStatus)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                >
                  <option value="กำลังหักเงิน">กำลังหักเงิน</option>
                  <option value="ครบกำหนดหักแล้ว">ครบกำหนดหักแล้ว</option>
                  <option value="หยุดวิ่งงาน">หยุดวิ่งงาน</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  หมายเหตุเงินประกัน
                </label>
                <textarea
                  rows={2}
                  value={vNotes}
                  onChange={(e) => setVNotes(e.target.value)}
                  placeholder="เงื่อนไขเพิ่มเติมเฉพาะเรื่องเงินประกัน..."
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={!editingVehicle && !selectedFleetId}
                  className="px-4 py-2 text-sm font-bold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg cursor-pointer disabled:opacity-40"
                >
                  {editingVehicle ? 'บันทึกเงื่อนไขเงินประกัน' : 'เปิดบัญชีเงินประกัน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================
          MODAL 2: RECORD MONTHLY DEDUCTION
         ================================================================= */}
      {deductionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md overflow-hidden shadow-xl my-auto">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-[#16A34A]" />
                <h3 className="text-base font-extrabold text-[#0F172A]">
                  บันทึกการหักเงินประกันสะสม
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeductionTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitDeduction} className="p-5 space-y-4">
              <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-slate-200 text-xs space-y-1 tabular-nums">
                <div className="font-extrabold text-sm text-[#0F172A]">
                  {deductionTarget.licensePlate} ({deductionTarget.vehicleId})
                </div>
                <div className="text-slate-600">คนขับ: {deductionTarget.driverName || '-'}</div>
                <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 mt-1.5">
                  <span className="text-slate-500">ยอดคงเหลือปัจจุบัน:</span>
                  <span className="font-bold text-[#0F172A]">
                    {formatCurrencyTHB(deductionTarget.currentBalance)} /{' '}
                    {formatCurrencyTHB(deductionTarget.targetAmount)}
                  </span>
                </div>
                {deductionTarget.remainingAmount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">คงเหลือต้องหักเพิ่ม:</span>
                    <span className="font-bold text-[#D97706]">
                      {formatCurrencyTHB(deductionTarget.remainingAmount)}
                    </span>
                  </div>
                )}
              </div>

              {dFormError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-[#DC2626] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{dFormError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    รหัสรายการ *
                  </label>
                  <input
                    type="text"
                    value={dId}
                    onChange={(e) => setDId(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    งวดเดือน/ปี *
                  </label>
                  <input
                    type="text"
                    value={dMonthYear}
                    onChange={(e) => setDMonthYear(e.target.value)}
                    placeholder="11/2026"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#1D4ED8] tabular-nums"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    วันที่บันทึก *
                  </label>
                  <input
                    type="date"
                    value={dDate}
                    onChange={(e) => setDDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#1D4ED8] tabular-nums"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    จำนวนเงินหัก (บาท) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={dAmount}
                    onChange={(e) => setDAmount(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#1D4ED8] tabular-nums"
                    required
                  />
                </div>
              </div>

              {deductionTarget.remainingAmount > 0 &&
                deductionTarget.remainingAmount < deductionTarget.monthlyDeduction && (
                  <button
                    type="button"
                    onClick={() => setDAmount(String(deductionTarget.remainingAmount))}
                    className="text-xs font-semibold text-[#1D4ED8] hover:underline cursor-pointer tabular-nums"
                  >
                    ใช้ยอดคงเหลือสุดท้ายเพื่อให้ครบเป้าพอดี (
                    {formatCurrencyTHB(deductionTarget.remainingAmount)})
                  </button>
                )}

              {deductionWillComplete && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                  <span className="tabular-nums">
                    หลังบันทึกยอดนี้ เงินประกันสะสมสุทธิจะเป็น{' '}
                    <strong>{formatCurrencyTHB(deductionNewBalance)}</strong> ซึ่งครบตามเป้าหมายแล้ว
                    ระบบจะปรับสถานะเป็น <strong>"ครบกำหนดหักแล้ว"</strong> อัตโนมัติ
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">หมายเหตุ</label>
                <input
                  type="text"
                  value={dNotes}
                  onChange={(e) => setDNotes(e.target.value)}
                  placeholder="เช่น หักจากค่ารอบวิ่งงวดปลายเดือน"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeductionTarget(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-bold text-white bg-[#16A34A] hover:bg-emerald-700 rounded-lg cursor-pointer"
                >
                  บันทึกยอดหักสะสม
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================
          MODAL 3: RECORD EMERGENCY WITHDRAWAL
         ================================================================= */}
      {withdrawalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md overflow-hidden shadow-xl my-auto">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-[#DC2626]" />
                <h3 className="text-base font-extrabold text-[#0F172A]">
                  บันทึกการเบิกจ่ายเงินประกัน
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setWithdrawalTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitWithdrawal} className="p-5 space-y-4">
              <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-slate-200 text-xs space-y-1 tabular-nums">
                <div className="font-extrabold text-sm text-[#0F172A]">
                  {withdrawalTarget.licensePlate} ({withdrawalTarget.vehicleId})
                </div>
                <div className="text-slate-600">คนขับ: {withdrawalTarget.driverName || '-'}</div>
                <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 mt-1.5">
                  <span className="text-slate-500">ยอดเงินประกันที่เบิกได้สูงสุด:</span>
                  <span className="font-extrabold text-[#1D4ED8] text-sm">
                    {formatCurrencyTHB(withdrawalTarget.currentBalance)}
                  </span>
                </div>
              </div>

              {wFormError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-[#DC2626] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{wFormError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    รหัสรายการเบิก *
                  </label>
                  <input
                    type="text"
                    value={wId}
                    onChange={(e) => setWId(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    วันที่เบิก *
                  </label>
                  <input
                    type="date"
                    value={wDate}
                    onChange={(e) => setWDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#1D4ED8] tabular-nums"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    จำนวนเงินที่เบิก (บาท) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setWAmount(String(withdrawalTarget.currentBalance))}
                    className="text-[11px] font-semibold text-[#1D4ED8] hover:underline cursor-pointer tabular-nums"
                  >
                    เบิกเต็มจำนวน ({formatCurrencyTHB(withdrawalTarget.currentBalance)})
                  </button>
                </div>
                <input
                  type="number"
                  min="1"
                  max={withdrawalTarget.currentBalance}
                  step="any"
                  value={wAmount}
                  onChange={(e) => setWAmount(e.target.value)}
                  placeholder="ระบุจำนวนเงินที่ต้องการเบิก"
                  className="w-full px-3 py-2 text-sm font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#1D4ED8] tabular-nums"
                  required
                />
              </div>

              {withdrawalAmountNum > 0 && (
                <div
                  className={`p-3 rounded-lg border text-xs space-y-1 tabular-nums ${
                    withdrawalAmountNum > withdrawalTarget.currentBalance
                      ? 'bg-red-50 border-red-200 text-[#DC2626]'
                      : 'bg-amber-50/70 border-amber-200 text-amber-900'
                  }`}
                >
                  {withdrawalAmountNum > withdrawalTarget.currentBalance ? (
                    <div className="font-bold">
                      ยอดเบิกเกินเงินประกันคงเหลืออยู่{' '}
                      {formatCurrencyTHB(withdrawalAmountNum - withdrawalTarget.currentBalance)}
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span>ยอดเงินประกันคงเหลือหลังเบิก:</span>
                        <strong>{formatCurrencyTHB(withdrawalRemainingBalance)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>ยอดที่ต้องหักเพิ่มเพื่อให้ครบเป้าหมายใหม่:</span>
                        <strong>{formatCurrencyTHB(withdrawalNewShortfall)}</strong>
                      </div>
                      {withdrawalWillResumeDeduction && (
                        <div className="pt-1 border-t border-amber-200/80 flex items-start gap-1.5 text-amber-950 font-semibold">
                          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#D97706]" />
                          <span>
                            ยอดคงเหลือจะต่ำกว่าเป้าหมาย ระบบจะปรับสถานะกลับเป็น "กำลังหักเงิน" อัตโนมัติ
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  สาเหตุที่เบิก *
                </label>
                <input
                  type="text"
                  value={wReason}
                  onChange={(e) => setWReason(e.target.value)}
                  placeholder="ระบุสาเหตุการเบิก เช่น ค่าซ่อมบำรุง / ยางแตก"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                  required
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {WITHDRAWAL_REASON_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setWReason(preset)}
                      className="text-[11px] font-medium px-2 py-1 rounded border border-slate-200 bg-[#F8FAFC] text-slate-600 hover:border-blue-300 hover:text-[#1D4ED8] cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  หมายเหตุเพิ่มเติม
                </label>
                <input
                  type="text"
                  value={wNotes}
                  onChange={(e) => setWNotes(e.target.value)}
                  placeholder="เลขที่บิลอู่ซ่อม หรือรายละเอียดการโอน..."
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setWithdrawalTarget(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={withdrawalAmountNum > withdrawalTarget.currentBalance}
                  className="px-4 py-2 text-sm font-bold text-white bg-[#DC2626] hover:bg-red-700 rounded-lg cursor-pointer disabled:opacity-40"
                >
                  ยืนยันการเบิกจ่าย
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================
          MODAL 4: CONFIRM DELETE MODAL
         ================================================================= */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-sm overflow-hidden shadow-xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-200 text-[#DC2626] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#0F172A]">{confirmDelete.title}</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {confirmDelete.description}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAction}
                className="px-3.5 py-2 text-xs sm:text-sm font-bold text-white bg-[#DC2626] hover:bg-red-700 rounded-lg cursor-pointer"
              >
                ยืนยันดำเนินการ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
