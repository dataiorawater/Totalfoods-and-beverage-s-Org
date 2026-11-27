import React, { useState, useMemo, useRef } from 'react';
import {
  FleetVehicle,
  VehicleOwnershipType,
  FleetVehicleStatus,
  VehicleMaintenanceRecord,
  StaffUser,
} from '../types';
import {
  evaluateExpiryStatus,
  getVehicleComplianceAlerts,
  getVehicleWorstSeverity,
  suggestNextYearExpiryDate,
  EXPIRY_WARNING_DAYS,
  ComplianceDocType,
  ExpirySeverity,
} from '../utils/fleetUtils';
import { formatThaiDateShort } from '../utils/dateUtils';
import {
  uploadFleetPhotoToDrive,
  getDriveImageDisplayUrl,
  getDriveViewUrl,
} from '../services/googleDrive';
import {
  Car,
  Truck,
  Plus,
  Search,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  FileText,
  Edit2,
  Trash2,
  Eye,
  X,
  RefreshCw,
  Upload,
  ExternalLink,
  Wrench,
  Gauge,
  User,
  Phone,
  LayoutGrid,
  List,
  Loader2,
  Calendar,
  Building2,
  Handshake,
  Image as ImageIcon,
} from 'lucide-react';

interface FleetManagementViewProps {
  vehicles: FleetVehicle[];
  maintenanceRecords: VehicleMaintenanceRecord[];
  currentUser: StaffUser;
  staffList: StaffUser[];
  onSaveVehicle: (vehicle: FleetVehicle) => Promise<void> | void;
  onUpdateVehicle: (vehicle: FleetVehicle) => Promise<void> | void;
  onDeleteVehicle: (vehicleId: string) => Promise<void> | void;
  sheetsConnected: boolean;
  onNavigateToMaintenance?: () => void;
  onShowToast?: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

const VEHICLE_TYPE_OPTIONS = [
  'กระบะตอนเดียวตู้ทึบ',
  'กระบะคอก',
  '4 ล้อใหญ่',
  '6 ล้อตู้ทึบ',
  'รถตู้ทึบส่งด่วน',
  'รถตู้โดยสาร/ขนส่ง',
  'รถเก๋ง/รถประจำตำแหน่ง',
  'อื่นๆ',
];

const FUEL_TYPE_OPTIONS = ['ดีเซล', 'เบนซิน', 'แก๊สโซฮอล์', 'NGV/LPG', 'ไฮบริด', 'ไฟฟ้า (EV)'];

const INSURANCE_TYPE_OPTIONS = ['ชั้น 1', 'ชั้น 2+', 'ชั้น 2', 'ชั้น 3+', 'ชั้น 3', 'ไม่มีประกันภาคสมัครใจ'];

const STATUS_META: Record<
  FleetVehicleStatus,
  { label: string; dotClass: string; textClass: string; bgClass: string }
> = {
  active: {
    label: 'พร้อมใช้งาน',
    dotClass: 'bg-[#16A34A]',
    textClass: 'text-[#16A34A]',
    bgClass: 'bg-emerald-50 border-emerald-200',
  },
  maintenance: {
    label: 'กำลังซ่อม',
    dotClass: 'bg-[#D97706]',
    textClass: 'text-[#D97706]',
    bgClass: 'bg-amber-50 border-amber-200',
  },
  inactive: {
    label: 'พักใช้งาน',
    dotClass: 'bg-slate-400',
    textClass: 'text-slate-600',
    bgClass: 'bg-slate-100 border-slate-200',
  },
};

function getExpiryStyle(severity: ExpirySeverity): {
  textClass: string;
  subTextClass: string;
  dotClass: string;
} {
  if (severity === 'expired') {
    return {
      textClass: 'text-[#DC2626] font-bold',
      subTextClass: 'text-[#DC2626]',
      dotClass: 'bg-[#DC2626]',
    };
  }
  if (severity === 'warning') {
    return {
      textClass: 'text-[#D97706] font-bold',
      subTextClass: 'text-[#D97706]',
      dotClass: 'bg-[#D97706]',
    };
  }
  if (severity === 'ok') {
    return {
      textClass: 'text-[#0F172A] font-semibold',
      subTextClass: 'text-[#16A34A]',
      dotClass: 'bg-[#16A34A]',
    };
  }
  return {
    textClass: 'text-slate-400',
    subTextClass: 'text-slate-400',
    dotClass: 'bg-slate-300',
  };
}

function createEmptyVehicleForm(): Partial<FleetVehicle> {
  return {
    plateNumber: '',
    province: 'กรุงเทพมหานคร',
    ownershipType: 'company',
    vehicleType: 'กระบะตอนเดียวตู้ทึบ',
    brand: '',
    model: '',
    modelYear: String(new Date().getFullYear()),
    color: 'ขาว',
    fuelType: 'ดีเซล',
    status: 'active',
    driverName: '',
    driverPhone: '',
    currentMileage: 0,
    taxExpiryDate: '',
    taxCost: 0,
    prbCompany: '',
    prbPolicyNumber: '',
    prbExpiryDate: '',
    prbCost: 0,
    insuranceCompany: '',
    insuranceType: 'ชั้น 1',
    insurancePolicyNumber: '',
    insuranceExpiryDate: '',
    insuranceCost: 0,
    photoUrls: [],
    notes: '',
  };
}

export const FleetManagementView: React.FC<FleetManagementViewProps> = React.memo(({
  vehicles,
  maintenanceRecords,
  currentUser,
  staffList,
  onSaveVehicle,
  onUpdateVehicle,
  onDeleteVehicle,
  sheetsConnected,
  onNavigateToMaintenance,
  onShowToast,
}) => {
  const isViewer = currentUser.role === 'viewer';
  const canDelete = currentUser.role === 'admin' || currentUser.role === 'manager';

  // Filters & view state
  const [searchTerm, setSearchTerm] = useState('');
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | VehicleOwnershipType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | FleetVehicleStatus>('all');
  const [complianceFilter, setComplianceFilter] = useState<'all' | 'warning' | 'expired'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<FleetVehicle | null>(null);
  const [formData, setFormData] = useState<Partial<FleetVehicle>>(createEmptyVehicleForm());
  const [formError, setFormError] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // Detail modal
  const [detailVehicle, setDetailVehicle] = useState<FleetVehicle | null>(null);

  // Quick Renew modal
  const [renewVehicle, setRenewVehicle] = useState<FleetVehicle | null>(null);
  const [renewDocType, setRenewDocType] = useState<ComplianceDocType>('tax');
  const [renewExpiryDate, setRenewExpiryDate] = useState('');
  const [renewCompany, setRenewCompany] = useState('');
  const [renewPolicyNumber, setRenewPolicyNumber] = useState('');
  const [renewInsuranceType, setRenewInsuranceType] = useState('ชั้น 1');
  const [renewCost, setRenewCost] = useState<number>(0);
  const [renewNote, setRenewNote] = useState('');
  const [renewError, setRenewError] = useState('');
  const [isUploadingRenewPhoto, setIsUploadingRenewPhoto] = useState(false);
  const [renewUploadedUrl, setRenewUploadedUrl] = useState('');
  const renewPhotoInputRef = useRef<HTMLInputElement | null>(null);

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<FleetVehicle | null>(null);

  // Map max mileage from maintenance records per plate
  const latestMaintenanceMileageByPlate = useMemo(() => {
    const map = new Map<string, number>();
    maintenanceRecords.forEach((rec) => {
      if (!rec.vehiclePlate) return;
      const key = rec.vehiclePlate.trim().toLowerCase();
      const prev = map.get(key) || 0;
      if ((rec.currentMileage || 0) > prev) {
        map.set(key, rec.currentMileage);
      }
    });
    return map;
  }, [maintenanceRecords]);

  const getEffectiveMileage = (v: FleetVehicle): number => {
    const mntMax = latestMaintenanceMileageByPlate.get(v.plateNumber.trim().toLowerCase()) || 0;
    return Math.max(v.currentMileage || 0, mntMax);
  };

  // Compliance alerts summary (30 days ahead + expired)
  const complianceSummary = useMemo(
    () => getVehicleComplianceAlerts(vehicles, EXPIRY_WARNING_DAYS),
    [vehicles]
  );

  // KPI metrics
  const kpiStats = useMemo(() => {
    const total = vehicles.length;
    const companyCount = vehicles.filter((v) => v.ownershipType === 'company').length;
    const hiredCount = vehicles.filter((v) => v.ownershipType === 'hired').length;
    const activeCount = vehicles.filter((v) => v.status === 'active').length;
    const maintenanceCount = vehicles.filter((v) => v.status === 'maintenance').length;
    const inactiveCount = vehicles.filter((v) => v.status === 'inactive').length;

    let expiringVehicles = 0;
    let expiredVehicles = 0;
    vehicles.forEach((v) => {
      const worst = getVehicleWorstSeverity(v, EXPIRY_WARNING_DAYS);
      if (worst === 'expired') expiredVehicles += 1;
      else if (worst === 'warning') expiringVehicles += 1;
    });

    return {
      total,
      companyCount,
      hiredCount,
      activeCount,
      maintenanceCount,
      inactiveCount,
      expiringVehicles,
      expiredVehicles,
    };
  }, [vehicles]);

  // Filtered vehicles list
  const filteredVehicles = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (ownershipFilter !== 'all' && v.ownershipType !== ownershipFilter) return false;
      if (statusFilter !== 'all' && v.status !== statusFilter) return false;
      if (complianceFilter !== 'all') {
        const worst = getVehicleWorstSeverity(v, EXPIRY_WARNING_DAYS);
        if (complianceFilter === 'expired' && worst !== 'expired') return false;
        if (complianceFilter === 'warning' && worst !== 'warning' && worst !== 'expired') {
          return false;
        }
      }
      if (q) {
        const haystack = [
          v.plateNumber,
          v.province,
          v.brand,
          v.model,
          v.vehicleType,
          v.driverName,
          v.driverPhone,
          v.insuranceCompany,
          v.prbCompany,
          v.insurancePolicyNumber,
          v.prbPolicyNumber,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [vehicles, searchTerm, ownershipFilter, statusFilter, complianceFilter]);

  // Driver suggestions from staffList
  const driverSuggestions = useMemo(() => {
    return staffList
      .filter((s) => s.status !== 'inactive')
      .map((s) => ({ name: s.name, phone: s.phone || '' }));
  }, [staffList]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingVehicle(null);
    setFormData(createEmptyVehicleForm());
    setFormError('');
    setIsFormOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (vehicle: FleetVehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      ...vehicle,
      photoUrls: Array.isArray(vehicle.photoUrls) ? [...vehicle.photoUrls] : [],
    });
    setFormError('');
    setIsFormOpen(true);
  };

  // Open Quick Renew Modal
  const handleOpenQuickRenew = (vehicle: FleetVehicle, preferredDoc?: ComplianceDocType) => {
    let doc: ComplianceDocType = preferredDoc || 'tax';
    if (!preferredDoc) {
      // Pick the most urgent doc automatically
      const evals: Array<{ type: ComplianceDocType; days: number }> = [
        { type: 'tax', days: evaluateExpiryStatus(vehicle.taxExpiryDate).daysRemaining ?? 9999 },
        { type: 'prb', days: evaluateExpiryStatus(vehicle.prbExpiryDate).daysRemaining ?? 9999 },
        { type: 'insurance', days: evaluateExpiryStatus(vehicle.insuranceExpiryDate).daysRemaining ?? 9999 },
      ];
      evals.sort((a, b) => a.days - b.days);
      doc = evals[0].type;
    }

    setRenewVehicle(vehicle);
    setRenewDocType(doc);
    applyRenewDefaultsForDoc(vehicle, doc);
    setRenewNote('');
    setRenewError('');
    setRenewUploadedUrl('');
  };

  const applyRenewDefaultsForDoc = (vehicle: FleetVehicle, doc: ComplianceDocType) => {
    if (doc === 'tax') {
      setRenewExpiryDate(suggestNextYearExpiryDate(vehicle.taxExpiryDate));
      setRenewCompany('');
      setRenewPolicyNumber('');
      setRenewCost(vehicle.taxCost || 0);
    } else if (doc === 'prb') {
      setRenewExpiryDate(suggestNextYearExpiryDate(vehicle.prbExpiryDate));
      setRenewCompany(vehicle.prbCompany || '');
      setRenewPolicyNumber(vehicle.prbPolicyNumber || '');
      setRenewCost(vehicle.prbCost || 0);
    } else {
      setRenewExpiryDate(suggestNextYearExpiryDate(vehicle.insuranceExpiryDate));
      setRenewCompany(vehicle.insuranceCompany || '');
      setRenewPolicyNumber(vehicle.insurancePolicyNumber || '');
      setRenewInsuranceType(vehicle.insuranceType || 'ชั้น 1');
      setRenewCost(vehicle.insuranceCost || 0);
    }
  };

  const handleRenewDocTypeChange = (doc: ComplianceDocType) => {
    setRenewDocType(doc);
    if (renewVehicle) {
      applyRenewDefaultsForDoc(renewVehicle, doc);
    }
  };

  // Upload vehicle / document photo to Google Drive inside Add/Edit Modal
  const handleUploadFormPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const currentPhotos = Array.isArray(formData.photoUrls) ? formData.photoUrls : [];
    if (currentPhotos.length >= 4) {
      setFormError('แนบรูปภาพได้สูงสุด 4 รูปต่อคัน');
      return;
    }

    const plateLabel = (formData.plateNumber || 'NEW_VEHICLE').trim();
    setIsUploadingPhoto(true);
    setFormError('');
    try {
      const uploadedUrl = await uploadFleetPhotoToDrive(file, plateLabel, currentPhotos.length + 1);
      setFormData((prev) => ({
        ...prev,
        photoUrls: [...(Array.isArray(prev.photoUrls) ? prev.photoUrls : []), uploadedUrl].slice(0, 4),
      }));
      onShowToast?.('success', 'อัปโหลดรูปภาพสำเร็จ', 'บันทึกรูปภาพขึ้น Google Drive เรียบร้อยแล้ว');
    } catch (err: any) {
      setFormError(err?.message || 'อัปโหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Upload receipt/policy photo inside Quick Renew modal
  const handleUploadRenewPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !renewVehicle) return;
    e.target.value = '';

    setIsUploadingRenewPhoto(true);
    setRenewError('');
    try {
      const slot = (renewVehicle.photoUrls?.length || 0) + 1;
      const url = await uploadFleetPhotoToDrive(file, renewVehicle.plateNumber, slot);
      setRenewUploadedUrl(url);
      onShowToast?.('success', 'แนบภาพเอกสารสำเร็จ', 'อัปโหลดเอกสารต่ออายุขึ้น Google Drive แล้ว');
    } catch (err: any) {
      setRenewError(err?.message || 'อัปโหลดเอกสารไม่สำเร็จ');
    } finally {
      setIsUploadingRenewPhoto(false);
    }
  };

  // Submit Add/Edit Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const plateClean = String(formData.plateNumber || '').trim();
    if (!plateClean) {
      setFormError('กรุณาระบุเลขทะเบียนรถ');
      return;
    }

    const brandClean = String(formData.brand || '').trim();
    const modelClean = String(formData.model || '').trim();
    if (!brandClean && !modelClean) {
      setFormError('กรุณาระบุยี่ห้อหรือรุ่นรถ');
      return;
    }

    // Check duplicate plate number
    const duplicate = vehicles.find(
      (v) =>
        v.plateNumber.trim().toLowerCase() === plateClean.toLowerCase() &&
        (!editingVehicle || v.id !== editingVehicle.id)
    );
    if (duplicate) {
      setFormError(`ทะเบียนรถ "${plateClean}" มีอยู่ในระบบแล้ว`);
      return;
    }

    setIsSaving(true);
    try {
      const payload: FleetVehicle = {
        id: editingVehicle?.id || `VEH-${Date.now().toString().slice(-6)}`,
        plateNumber: plateClean,
        province: String(formData.province || '').trim(),
        ownershipType: (formData.ownershipType || 'company') as VehicleOwnershipType,
        vehicleType: String(formData.vehicleType || 'กระบะตอนเดียวตู้ทึบ').trim(),
        brand: brandClean,
        model: modelClean,
        modelYear: String(formData.modelYear || '').trim(),
        color: String(formData.color || '').trim(),
        fuelType: String(formData.fuelType || 'ดีเซล').trim(),
        status: (formData.status || 'active') as FleetVehicleStatus,
        driverName: String(formData.driverName || '').trim(),
        driverPhone: String(formData.driverPhone || '').trim(),
        currentMileage: Number(formData.currentMileage) || 0,
        taxExpiryDate: String(formData.taxExpiryDate || '').trim(),
        taxCost: Number(formData.taxCost) || 0,
        prbCompany: String(formData.prbCompany || '').trim(),
        prbPolicyNumber: String(formData.prbPolicyNumber || '').trim(),
        prbExpiryDate: String(formData.prbExpiryDate || '').trim(),
        prbCost: Number(formData.prbCost) || 0,
        insuranceCompany: String(formData.insuranceCompany || '').trim(),
        insuranceType: String(formData.insuranceType || '').trim(),
        insurancePolicyNumber: String(formData.insurancePolicyNumber || '').trim(),
        insuranceExpiryDate: String(formData.insuranceExpiryDate || '').trim(),
        insuranceCost: Number(formData.insuranceCost) || 0,
        photoUrls: Array.isArray(formData.photoUrls) ? formData.photoUrls.slice(0, 4) : [],
        notes: String(formData.notes || '').trim(),
        updatedAt: new Date().toISOString(),
        syncedToSheets: editingVehicle?.syncedToSheets,
        sheetsRowIndex: editingVehicle?.sheetsRowIndex,
      };

      if (editingVehicle) {
        await onUpdateVehicle(payload);
      } else {
        await onSaveVehicle(payload);
      }
      setIsFormOpen(false);
      setEditingVehicle(null);
    } finally {
      setIsSaving(false);
    }
  };

  // Submit Quick Renew
  const handleSubmitQuickRenew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewVehicle) return;
    setRenewError('');

    if (!renewExpiryDate.trim()) {
      setRenewError('กรุณาระบุวันหมดอายุรอบใหม่');
      return;
    }

    const updatedPhotos = Array.isArray(renewVehicle.photoUrls) ? [...renewVehicle.photoUrls] : [];
    if (renewUploadedUrl && !updatedPhotos.includes(renewUploadedUrl)) {
      if (updatedPhotos.length >= 4) {
        updatedPhotos[updatedPhotos.length - 1] = renewUploadedUrl;
      } else {
        updatedPhotos.push(renewUploadedUrl);
      }
    }

    const docLabel =
      renewDocType === 'tax' ? 'ภาษีรถยนต์' : renewDocType === 'prb' ? 'พ.ร.บ.' : 'ประกันภัย';
    const noteAppend = renewNote.trim()
      ? `[ต่อ${docLabel} ${new Date().toISOString().slice(0, 10)}] ${renewNote.trim()}`
      : '';
    const mergedNotes = [renewVehicle.notes, noteAppend].filter(Boolean).join(' | ');

    const updated: FleetVehicle = {
      ...renewVehicle,
      ...(renewDocType === 'tax'
        ? {
            taxExpiryDate: renewExpiryDate,
            taxCost: Number(renewCost) || 0,
          }
        : renewDocType === 'prb'
        ? {
            prbExpiryDate: renewExpiryDate,
            prbCompany: renewCompany.trim() || renewVehicle.prbCompany,
            prbPolicyNumber: renewPolicyNumber.trim() || renewVehicle.prbPolicyNumber,
            prbCost: Number(renewCost) || 0,
          }
        : {
            insuranceExpiryDate: renewExpiryDate,
            insuranceCompany: renewCompany.trim() || renewVehicle.insuranceCompany,
            insuranceType: renewInsuranceType || renewVehicle.insuranceType,
            insurancePolicyNumber: renewPolicyNumber.trim() || renewVehicle.insurancePolicyNumber,
            insuranceCost: Number(renewCost) || 0,
          }),
      photoUrls: updatedPhotos,
      notes: mergedNotes,
      updatedAt: new Date().toISOString(),
    };

    await onUpdateVehicle(updated);
    setRenewVehicle(null);
  };

  // Export Excel dynamically
  const handleExportExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const rows = filteredVehicles.map((v, idx) => {
        const taxEval = evaluateExpiryStatus(v.taxExpiryDate);
        const prbEval = evaluateExpiryStatus(v.prbExpiryDate);
        const insEval = evaluateExpiryStatus(v.insuranceExpiryDate);
        return {
          'ลำดับ': idx + 1,
          'ทะเบียนรถ': v.plateNumber,
          'จังหวัด': v.province || '',
          'ประเภทกรรมสิทธิ์': v.ownershipType === 'company' ? 'รถบริษัท' : 'รถร่วม/รถจ้าง',
          'ลักษณะตัวถัง': v.vehicleType || '',
          'ยี่ห้อ': v.brand || '',
          'รุ่นรถ': v.model || '',
          'ปีรถ': v.modelYear || '',
          'สีรถ': v.color || '',
          'เชื้อเพลิง': v.fuelType || '',
          'สถานะรถ': STATUS_META[v.status]?.label || v.status,
          'คนขับประจำ': v.driverName || '',
          'เบอร์โทรคนขับ': v.driverPhone || '',
          'เลขไมล์ล่าสุด (กม.)': getEffectiveMileage(v),
          'วันหมดอายุภาษี': v.taxExpiryDate || '',
          'สถานะภาษี': taxEval.label,
          'ค่าต่อภาษี (บาท)': v.taxCost || 0,
          'บริษัท พ.ร.บ.': v.prbCompany || '',
          'เลขกรมธรรม์ พ.ร.บ.': v.prbPolicyNumber || '',
          'วันหมดอายุ พ.ร.บ.': v.prbExpiryDate || '',
          'สถานะ พ.ร.บ.': prbEval.label,
          'เบี้ย พ.ร.บ. (บาท)': v.prbCost || 0,
          'บริษัทประกันภัย': v.insuranceCompany || '',
          'ประเภทประกัน': v.insuranceType || '',
          'เลขกรมธรรม์ประกัน': v.insurancePolicyNumber || '',
          'วันหมดอายุประกัน': v.insuranceExpiryDate || '',
          'สถานะประกัน': insEval.label,
          'เบี้ยประกัน (บาท)': v.insuranceCost || 0,
          'หมายเหตุ': v.notes || '',
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'FleetVehicles');
      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `ทะเบียนกองรถ_FleetVehicles_${today}.xlsx`);
      onShowToast?.('success', 'ส่งออก Excel สำเร็จ', `ส่งออกข้อมูลรถจำนวน ${rows.length} คันเรียบร้อยแล้ว`);
    } catch (err) {
      console.error('Export fleet excel failed:', err);
      onShowToast?.('error', 'ส่งออกไม่สำเร็จ', 'ไม่สามารถสร้างไฟล์ Excel ได้');
    }
  };

  // Linked maintenance records for Detail Modal
  const detailMaintenanceHistory = useMemo(() => {
    if (!detailVehicle) return [];
    const targetPlate = detailVehicle.plateNumber.trim().toLowerCase();
    return maintenanceRecords
      .filter((r) => r.vehiclePlate.trim().toLowerCase() === targetPlate)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 5);
  }, [detailVehicle, maintenanceRecords]);

  const renderExpiryCell = (dateStr?: string, subInfo?: string) => {
    const ev = evaluateExpiryStatus(dateStr, EXPIRY_WARNING_DAYS);
    const style = getExpiryStyle(ev.severity);

    if (ev.severity === 'unset') {
      return <span className="text-xs text-slate-400">ยังไม่ระบุ</span>;
    }

    return (
      <div className="space-y-0.5 tabular-nums">
        <div className={`text-xs ${style.textClass}`}>{formatThaiDateShort(dateStr)}</div>
        <div className="flex items-center gap-1 text-[11px]">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dotClass}`} />
          <span className={`${style.subTextClass} font-semibold`}>{ev.shortLabel}</span>
          {subInfo && <span className="text-slate-400 truncate max-w-[110px]">· {subInfo}</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* 1. Header Bar */}
      <div className="bg-[#FFFFFF] p-4 sm:p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#1D4ED8] text-white flex items-center justify-center shrink-0">
            <Car className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-extrabold text-[#0F172A] tracking-tight">
                จัดการรถ (Fleet Management)
              </h2>
              <span className="text-[11px] font-semibold text-slate-500">
                {sheetsConnected ? 'ซิงค์ Google Sheets: FleetVehicles' : 'โหมดออฟไลน์'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              ทะเบียนกองรถบริษัทและรถร่วม รุ่นรถ คนขับประจำ เลขไมล์ วันหมดอายุภาษี พ.ร.บ. และประกันภัย
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={filteredVehicles.length === 0}
            className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-[#F1F5F9] hover:bg-slate-200/80 border border-slate-200 text-[#0F172A] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>ส่งออก Excel</span>
          </button>

          {!isViewer && (
            <button
              id="btn-add-fleet-vehicle"
              type="button"
              onClick={handleOpenCreate}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มรถใหม่</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. 4-Card KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 tabular-nums">
        <div
          onClick={() => {
            setOwnershipFilter('all');
            setStatusFilter('all');
            setComplianceFilter('all');
          }}
          className="bg-[#FFFFFF] p-4 rounded-2xl border border-slate-200 hover:border-blue-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">รถทั้งหมดในระบบ</span>
            <Truck className="w-4 h-4 text-[#1D4ED8]" />
          </div>
          <div className="mt-2.5 text-2xl font-black text-[#0F172A]">
            {kpiStats.total} <span className="text-xs font-semibold text-slate-500">คัน</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            รถบริษัท {kpiStats.companyCount} · รถร่วม {kpiStats.hiredCount}
          </div>
        </div>

        <div
          onClick={() => {
            setStatusFilter(statusFilter === 'active' ? 'all' : 'active');
            setComplianceFilter('all');
          }}
          className="bg-[#FFFFFF] p-4 rounded-2xl border border-slate-200 hover:border-blue-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">รถพร้อมใช้งาน</span>
            <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
          </div>
          <div className="mt-2.5 text-2xl font-black text-[#0F172A]">
            {kpiStats.activeCount} <span className="text-xs font-semibold text-[#16A34A]">คัน</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            กำลังซ่อม {kpiStats.maintenanceCount} · พักใช้งาน {kpiStats.inactiveCount}
          </div>
        </div>

        <div
          onClick={() => setComplianceFilter(complianceFilter === 'warning' ? 'all' : 'warning')}
          className={`bg-[#FFFFFF] p-4 rounded-2xl border transition-colors cursor-pointer ${
            complianceFilter === 'warning'
              ? 'border-[#D97706] bg-amber-50/30'
              : 'border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">ใกล้หมดอายุ (≤30 วัน)</span>
            <Clock className="w-4 h-4 text-[#D97706]" />
          </div>
          <div className="mt-2.5 text-2xl font-black text-[#D97706]">
            {complianceSummary.warningCount}{' '}
            <span className="text-xs font-semibold text-slate-500">รายการ</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            ครอบคลุมภาษี · พ.ร.บ. · ประกันภัย
          </div>
        </div>

        <div
          onClick={() => setComplianceFilter(complianceFilter === 'expired' ? 'all' : 'expired')}
          className={`bg-[#FFFFFF] p-4 rounded-2xl border transition-colors cursor-pointer ${
            complianceFilter === 'expired'
              ? 'border-[#DC2626] bg-rose-50/30'
              : 'border-slate-200 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">หมดอายุ / เกินกำหนด</span>
            <XCircle className="w-4 h-4 text-[#DC2626]" />
          </div>
          <div className="mt-2.5 text-2xl font-black text-[#DC2626]">
            {complianceSummary.expiredCount}{' '}
            <span className="text-xs font-semibold text-slate-500">รายการ</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {complianceSummary.expiredCount > 0 ? 'ต้องดำเนินการต่ออายุทันที' : 'ไม่มีเอกสารค้างต่ออายุ'}
          </div>
        </div>
      </div>

      {/* 3. Urgent Compliance Alert Strip */}
      {complianceSummary.alerts.length > 0 && (
        <div className="bg-[#FFFFFF] rounded-2xl border border-amber-200 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0" />
              <h3 className="text-xs sm:text-sm font-bold text-[#0F172A]">
                รายการแจ้งเตือนต่ออายุล่วงหน้า 30 วัน ({complianceSummary.alerts.length} รายการ)
              </h3>
            </div>
            <div className="text-[11px] text-slate-500">
              เลยกำหนด <span className="font-bold text-[#DC2626]">{complianceSummary.expiredCount}</span> · ใกล้ครบกำหนด{' '}
              <span className="font-bold text-[#D97706]">{complianceSummary.warningCount}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {complianceSummary.alerts.slice(0, 6).map((alert) => {
              const targetVehicle = vehicles.find((v) => v.id === alert.vehicleId);
              const isExpired = alert.severity === 'expired';
              return (
                <div
                  key={alert.id}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                    isExpired
                      ? 'bg-rose-50/50 border-rose-200'
                      : 'bg-amber-50/40 border-amber-200'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A]">
                      <span className="truncate">{alert.plateNumber}</span>
                      <span className="text-slate-400 font-normal">·</span>
                      <span className={isExpired ? 'text-[#DC2626]' : 'text-[#D97706]'}>
                        {alert.docLabel}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5 tabular-nums truncate">
                      ครบกำหนด {formatThaiDateShort(alert.expiryDate)} ·{' '}
                      <span className={isExpired ? 'text-[#DC2626] font-bold' : 'text-[#D97706] font-bold'}>
                        {alert.statusLabel}
                      </span>
                    </div>
                  </div>
                  {!isViewer && targetVehicle && (
                    <button
                      type="button"
                      onClick={() => handleOpenQuickRenew(targetVehicle, alert.docType)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#FFFFFF] hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-[#1D4ED8] text-[11px] font-bold shrink-0 cursor-pointer transition-colors"
                    >
                      ต่ออายุ
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Filter & Search Toolbar */}
      <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-slate-200 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาทะเบียนรถ, รุ่น, คนขับ, บริษัทประกัน..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9]/60 focus:bg-[#FFFFFF] focus:border-[#1D4ED8] focus:outline-none text-xs text-[#0F172A]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Ownership Segmented Control */}
            <div className="inline-flex bg-[#F1F5F9] p-1 rounded-xl border border-slate-200 text-xs">
              {(
                [
                  { id: 'all', label: 'ทั้งหมด' },
                  { id: 'company', label: 'รถบริษัท' },
                  { id: 'hired', label: 'รถร่วม' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setOwnershipFilter(item.id)}
                  className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                    ownershipFilter === item.id
                      ? 'bg-[#1D4ED8] text-white'
                      : 'text-slate-600 hover:text-[#0F172A]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | FleetVehicleStatus)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-[#FFFFFF] text-xs font-semibold text-[#0F172A] focus:border-[#1D4ED8] focus:outline-none cursor-pointer"
            >
              <option value="all">สถานะ: ทั้งหมด</option>
              <option value="active">พร้อมใช้งาน</option>
              <option value="maintenance">กำลังซ่อม</option>
              <option value="inactive">พักใช้งาน</option>
            </select>

            {/* Compliance Filter */}
            <select
              value={complianceFilter}
              onChange={(e) => setComplianceFilter(e.target.value as 'all' | 'warning' | 'expired')}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-[#FFFFFF] text-xs font-semibold text-[#0F172A] focus:border-[#1D4ED8] focus:outline-none cursor-pointer"
            >
              <option value="all">เอกสาร: ทั้งหมด</option>
              <option value="warning">ใกล้หมดอายุ / หมดอายุ (≤30 วัน)</option>
              <option value="expired">หมดอายุแล้วเท่านั้น</option>
            </select>

            {/* View Toggle */}
            <div className="inline-flex bg-[#F1F5F9] p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                title="มุมมองตาราง"
                className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                  viewMode === 'table' ? 'bg-[#FFFFFF] text-[#1D4ED8] shadow-2xs' : 'text-slate-500'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                title="มุมมองการ์ด"
                className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                  viewMode === 'cards' ? 'bg-[#FFFFFF] text-[#1D4ED8] shadow-2xs' : 'text-slate-500'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Fleet List (Table or Cards or Empty State) */}
      {filteredVehicles.length === 0 ? (
        <div className="bg-[#FFFFFF] rounded-2xl border border-slate-200 p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#F1F5F9] text-slate-400 flex items-center justify-center mx-auto">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0F172A]">
              {vehicles.length === 0 ? 'ยังไม่มีข้อมูลรถในกองรถ' : 'ไม่พบรถที่ตรงกับเงื่อนไขที่เลือก'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {vehicles.length === 0
                ? 'เริ่มต้นเพิ่มทะเบียนรถบริษัทหรือรถร่วมเพื่อติดตามภาษี พ.ร.บ. ประกันภัย และเชื่อมต่อไปยังหน้าซ่อมบำรุง'
                : 'ลองล้างตัวกรองหรือเปลี่ยนคำค้นหา'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            {vehicles.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setOwnershipFilter('all');
                  setStatusFilter('all');
                  setComplianceFilter('all');
                }}
                className="px-4 py-2 rounded-xl bg-[#F1F5F9] hover:bg-slate-200 text-xs font-bold text-[#0F172A] cursor-pointer"
              >
                ล้างตัวกรองทั้งหมด
              </button>
            )}
            {!isViewer && (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="px-4 py-2 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มรถคันแรก</span>
              </button>
            )}
          </div>
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-[#FFFFFF] rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F1F5F9] border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                  <th className="py-3 px-4">ทะเบียน / ประเภท</th>
                  <th className="py-3 px-4">ยี่ห้อ &amp; รุ่น</th>
                  <th className="py-3 px-4">คนขับ / ไมล์ล่าสุด</th>
                  <th className="py-3 px-4">ภาษีรถยนต์</th>
                  <th className="py-3 px-4">พ.ร.บ.</th>
                  <th className="py-3 px-4">ประกันภัย</th>
                  <th className="py-3 px-4">สถานะ</th>
                  <th className="py-3 px-4 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredVehicles.map((v) => {
                  const statusMeta = STATUS_META[v.status] || STATUS_META.active;
                  const effMileage = getEffectiveMileage(v);
                  const photoCount = v.photoUrls?.length || 0;

                  return (
                    <tr key={v.id} className="hover:bg-[#F1F5F9]/50 transition-colors">
                      <td className="py-3 px-4 align-top">
                        <div className="font-extrabold text-[#0F172A] text-sm tracking-tight">
                          {v.plateNumber}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                          <span
                            className={
                              v.ownershipType === 'company'
                                ? 'text-[#1D4ED8] font-bold'
                                : 'text-slate-700 font-bold'
                            }
                          >
                            {v.ownershipType === 'company' ? 'รถบริษัท' : 'รถร่วม'}
                          </span>
                          {v.province && (
                            <>
                              <span>·</span>
                              <span className="truncate max-w-[110px]">{v.province}</span>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 align-top">
                        <div className="font-bold text-[#0F172A]">
                          {[v.brand, v.model].filter(Boolean).join(' ') || '-'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {[v.vehicleType, v.modelYear ? `ปี ${v.modelYear}` : '', v.fuelType]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </td>

                      <td className="py-3 px-4 align-top tabular-nums">
                        <div className="font-semibold text-[#0F172A]">
                          {v.driverName || <span className="text-slate-400">ไม่ระบุคนขับ</span>}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {effMileage > 0 ? `${effMileage.toLocaleString()} กม.` : 'ยังไม่บันทึกไมล์'}
                          {photoCount > 0 && ` · รูป ${photoCount}`}
                        </div>
                      </td>

                      <td className="py-3 px-4 align-top">{renderExpiryCell(v.taxExpiryDate)}</td>
                      <td className="py-3 px-4 align-top">
                        {renderExpiryCell(v.prbExpiryDate, v.prbCompany)}
                      </td>
                      <td className="py-3 px-4 align-top">
                        {renderExpiryCell(
                          v.insuranceExpiryDate,
                          [v.insuranceType, v.insuranceCompany].filter(Boolean).join(' ')
                        )}
                      </td>

                      <td className="py-3 px-4 align-top">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold">
                          <span className={`w-2 h-2 rounded-full ${statusMeta.dotClass}`} />
                          <span className={statusMeta.textClass}>{statusMeta.label}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 align-top text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setDetailVehicle(v)}
                            title="ดูรายละเอียดและประวัติซ่อม"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-[#1D4ED8] hover:bg-blue-50 transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {!isViewer && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenQuickRenew(v)}
                                title="ต่ออายุ ภาษี / พ.ร.บ. / ประกันภัย"
                                className="px-2 py-1 rounded-lg text-[11px] font-bold text-[#1D4ED8] bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
                              >
                                ต่ออายุ
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(v)}
                                title="แก้ไขข้อมูลรถ"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-[#0F172A] hover:bg-slate-100 transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(v)}
                              title="ลบข้อมูลรถ"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-[#DC2626] hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredVehicles.map((v) => {
            const statusMeta = STATUS_META[v.status] || STATUS_META.active;
            const effMileage = getEffectiveMileage(v);
            return (
              <div
                key={v.id}
                className="bg-[#FFFFFF] rounded-2xl border border-slate-200 p-4 flex flex-col justify-between gap-4 hover:border-blue-300 transition-colors"
              >
                <div className="space-y-3">
                  {/* Card Top */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-extrabold text-[#0F172A]">
                          {v.plateNumber}
                        </span>
                        <span
                          className={`text-[11px] font-bold ${
                            v.ownershipType === 'company' ? 'text-[#1D4ED8]' : 'text-slate-600'
                          }`}
                        >
                          {v.ownershipType === 'company' ? 'รถบริษัท' : 'รถร่วม'}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-700 mt-0.5 truncate">
                        {[v.brand, v.model].filter(Boolean).join(' ') || '-'}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {[v.vehicleType, v.province, v.modelYear ? `ปี ${v.modelYear}` : '']
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold shrink-0">
                      <span className={`w-2 h-2 rounded-full ${statusMeta.dotClass}`} />
                      <span className={statusMeta.textClass}>{statusMeta.label}</span>
                    </span>
                  </div>

                  {/* Driver & Mileage */}
                  <div className="flex items-center justify-between text-xs py-2 border-y border-slate-100 tabular-nums">
                    <div className="flex items-center gap-1.5 text-slate-700 min-w-0">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate font-medium">{v.driverName || 'ไม่ระบุคนขับ'}</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-600 shrink-0">
                      <Gauge className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-semibold">{effMileage.toLocaleString()} กม.</span>
                    </div>
                  </div>

                  {/* 3 Compliance Dates */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2 rounded-xl bg-[#F1F5F9]/70 border border-slate-200/70">
                      <div className="text-[10px] font-bold text-slate-500 mb-0.5">ภาษีรถยนต์</div>
                      {renderExpiryCell(v.taxExpiryDate)}
                    </div>
                    <div className="p-2 rounded-xl bg-[#F1F5F9]/70 border border-slate-200/70">
                      <div className="text-[10px] font-bold text-slate-500 mb-0.5">พ.ร.บ.</div>
                      {renderExpiryCell(v.prbExpiryDate)}
                    </div>
                    <div className="p-2 rounded-xl bg-[#F1F5F9]/70 border border-slate-200/70">
                      <div className="text-[10px] font-bold text-slate-500 mb-0.5">
                        ประกัน {v.insuranceType ? `(${v.insuranceType})` : ''}
                      </div>
                      {renderExpiryCell(v.insuranceExpiryDate)}
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setDetailVehicle(v)}
                    className="text-xs font-bold text-slate-600 hover:text-[#1D4ED8] flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>รายละเอียด</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {!isViewer && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenQuickRenew(v)}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#1D4ED8] text-xs font-bold cursor-pointer"
                        >
                          ต่ออายุ
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(v)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(v)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-[#DC2626] hover:border-rose-200 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          MODAL 1: ADD / EDIT VEHICLE
         ========================================================================= */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4"
          onClick={() => !isSaving && setIsFormOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#FFFFFF] w-full max-w-3xl rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          >
            <div className="px-5 py-4 bg-[#0F172A] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#1D4ED8] flex items-center justify-center">
                  <Car className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold">
                    {editingVehicle ? `แก้ไขข้อมูลรถ ${editingVehicle.plateNumber}` : 'เพิ่มรถใหม่เข้าสู่กองรถ'}
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    ข้อมูลจะถูกบันทึกใน Google Sheet (FleetVehicles) และเชื่อมไปหน้าซ่อมบำรุง/แผนจัดส่งอัตโนมัติ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-5 overflow-y-auto space-y-5 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[#DC2626] font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Section 1: Basic Info & Ownership */}
              <div className="space-y-3">
                <div className="text-xs font-extrabold text-[#0F172A] border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-[#1D4ED8]" />
                  <span>1. ข้อมูลพื้นฐานและประเภทกรรมสิทธิ์</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      ทะเบียนรถ <span className="text-[#DC2626]">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.plateNumber || ''}
                      onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value })}
                      placeholder="เช่น 1ฒศ-8899"
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9]/50 focus:bg-[#FFFFFF] focus:border-[#1D4ED8] focus:outline-none font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">จังหวัดทะเบียน</label>
                    <input
                      type="text"
                      value={formData.province || ''}
                      onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                      placeholder="เช่น กรุงเทพมหานคร"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9]/50 focus:bg-[#FFFFFF] focus:border-[#1D4ED8] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">ประเภทกรรมสิทธิ์</label>
                    <div className="grid grid-cols-2 gap-1.5 bg-[#F1F5F9] p-1 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, ownershipType: 'company' })}
                        className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                          formData.ownershipType === 'company'
                            ? 'bg-[#1D4ED8] text-white'
                            : 'text-slate-600'
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>รถบริษัท</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, ownershipType: 'hired' })}
                        className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                          formData.ownershipType === 'hired'
                            ? 'bg-[#1D4ED8] text-white'
                            : 'text-slate-600'
                        }`}
                      >
                        <Handshake className="w-3.5 h-3.5" />
                        <span>รถร่วม</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      ยี่ห้อรถ <span className="text-[#DC2626]">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.brand || ''}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      placeholder="เช่น Toyota, Isuzu, Hino"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9]/50 focus:bg-[#FFFFFF] focus:border-[#1D4ED8] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      รุ่นรถ <span className="text-[#DC2626]">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.model || ''}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      placeholder="เช่น Hilux Revo 2.4"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9]/50 focus:bg-[#FFFFFF] focus:border-[#1D4ED8] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">ลักษณะตัวถัง</label>
                    <select
                      value={formData.vehicleType || 'กระบะตอนเดียวตู้ทึบ'}
                      onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9]/50 focus:bg-[#FFFFFF] focus:border-[#1D4ED8] focus:outline-none"
                    >
                      {VEHICLE_TYPE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">ปีรถ (ค.ศ./พ.ศ.)</label>
                    <input
                      type="text"
                      value={formData.modelYear || ''}
                      onChange={(e) => setFormData({ ...formData, modelYear: e.target.value })}
                      placeholder="2023"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9]/50 focus:bg-[#FFFFFF] focus:border-[#1D4ED8] focus:outline-none tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">สีรถ</label>
                    <input
                      type="text"
                      value={formData.color || ''}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      placeholder="ขาว"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9]/50 focus:bg-[#FFFFFF] focus:border-[#1D4ED8] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">เชื้อเพลิง</label>
                    <select
                      value={formData.fuelType || 'ดีเซล'}
                      onChange={(e) => setFormData({ ...formData, fuelType: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9]/50 focus:bg-[#FFFFFF] focus:border-[#1D4ED8] focus:outline-none"
                    >
                      {FUEL_TYPE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">สถานะรถ</label>
                    <select
                      value={formData.status || 'active'}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value as FleetVehicleStatus })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9]/50 focus:bg-[#FFFFFF] focus:border-[#1D4ED8] focus:outline-none"
                    >
                      <option value="active">พร้อมใช้งาน</option>
                      <option value="maintenance">กำลังซ่อม</option>
                      <option value="inactive">พักใช้งาน</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Driver & Mileage */}
              <div className="space-y-3">
                <div className="text-xs font-extrabold text-[#0F172A] border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-[#1D4ED8]" />
                  <span>2. พนักงานขับรถประจำคัน &amp; เลขไมล์ล่าสุด</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">คนขับประจำคัน</label>
                    <input
                      type="text"
                      list="fleet-driver-suggestions"
                      value={formData.driverName || ''}
                      onChange={(e) => {
                        const name = e.target.value;
                        const matched = driverSuggestions.find((d) => d.name === name);
                        setFormData((prev) => ({
                          ...prev,
                          driverName: name,
                          driverPhone: matched?.phone ? matched.phone : prev.driverPhone,
                        }));
                      }}
                      placeholder="ชื่อ-นามสกุลพนักงานขับรถ"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9]/50 focus:bg-[#FFFFFF] focus:border-[#1D4ED8] focus:outline-none"
                    />
                    <datalist id="fleet-driver-suggestions">
                      {driverSuggestions.map((d) => (
                        <option key={d.name} value={d.name} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">เบอร์โทรคนขับ</label>
                    <input
                      type="text"
                      value={formData.driverPhone || ''}
                      onChange={(e) => setFormData({ ...formData, driverPhone: e.target.value })}
                      placeholder="08x-xxx-xxxx"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9]/50 focus:bg-[#FFFFFF] focus:border-[#1D4ED8] focus:outline-none tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">เลขไมล์ล่าสุด (กม.)</label>
                    <input
                      type="number"
                      min={0}
                      value={formData.currentMileage ?? 0}
                      onChange={(e) =>
                        setFormData({ ...formData, currentMileage: Number(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9]/50 focus:bg-[#FFFFFF] focus:border-[#1D4ED8] focus:outline-none tabular-nums"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Tax & PRB */}
              <div className="space-y-3">
                <div className="text-xs font-extrabold text-[#0F172A] border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#1D4ED8]" />
                  <span>3. ข้อมูลภาษีรถยนต์ประจำปี &amp; พ.ร.บ.</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">วันหมดอายุภาษีรถยนต์</label>
                    <input
                      type="date"
                      value={formData.taxExpiryDate || ''}
                      onChange={(e) => setFormData({ ...formData, taxExpiryDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9]/50 focus:bg-[#FFFFFF] focus:border-[#1D4ED8] focus:outline-none tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">ค่าต่อภาษีล่าสุด (บาท)</label>
                    <input
                      type="number"
                      min={0}
                      value={formData.taxCost ?? 0}
                      onChange={(e) =>
                        setFormData({ ...formData, taxCost: Number(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9]/50 focus:bg-[#FFFFFF] focus:border-[#1D4ED8] focus:outline-none tabular-nums"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">บริษัท พ.ร.บ.</label>
                    <input
                      type="text"
                      value={formData.prbCompany || ''}
                      onChange={(e) => setFormData({ ...formData, prbCompany: e.target.value })}
                      placeholder="เช่น วิริยะประกันภัย"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9]/50 focus:bg-[#FFFFFF] focus:border-[#1D4ED8] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">เลขที่กรมธรรม์ พ.ร.บ.</label>
                    <input
                      type="text"
                      value={formData.prbPolicyNumber || ''}
                      onChange={(e) => setFormData({ ...formData, prbPolicyNumber: e.target.value })}
                      placeholder="PRB-xxxx"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9]/50 focus:bg-[#FFFFFF] focus:border-[#1D4ED8] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">วันหมดอายุ พ.ร.บ.</label>
                    <input
                      type="date"
                      value={formData.prbExpiryDate || ''}
                      onChange={(e) => setFormData({ ...formData, prbExpiryDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9]/50 focus:bg-[#FFFFFF] focus:border-[#1D4ED8] focus:outline-none tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">ค่าเบี้ย พ.ร.บ. (บาท)</label>
                    <input
                      type="number"
                      min={0}
                      value={formData.prbCost ?? 0}
                      onChange={(e) =>
                        setFormData({ ...formData, prbCost: Number(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9]/50 focus:bg-[#FFFFFF] focus:border-[#1D4ED8] focus:outline-none tabular-nums"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Voluntary Insurance & Photos */}
              <div className="space-y-3">
                <div className="text-xs font-extrabold text-[#0F172A] border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#1D4ED8]" />
                  <span>4. ประกันภัยภาคสมัครใจ &amp; ภาพถ่ายเอกสาร (Google Drive)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="lg:col-span-1">
                    <label className="block font-bold text-slate-700 mb-1">บริษัทประกันภัย</label>
                    <input
                      type="text"
                      value={formData.insuranceCompany || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, insuranceCompany: e.target.value })
                      }
                      placeholder="เช่น วิริยะฯ"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9]/50 focus:bg-[#FFFFFF] focus:border-[#1D4ED8] focus:outline-none"
                    />
                  </div>
                  <div className="lg:col-span-1">
                    <label className="block font-bold text-slate-700 mb-1">ประเภทประกัน</label>
                    <select
                      value={formData.insuranceType || 'ชั้น 1'}
                      onChange={(e) => setFormData({ ...formData, insuranceType: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9]/50 focus:bg-[#FFFFFF] focus:border-[#1D4ED8] focus:outline-none"
                    >
                      {INSURANCE_TYPE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="lg:col-span-1">
                    <label className="block font-bold text-slate-700 mb-1">เลขกรมธรรม์</label>
                    <input
                      type="text"
                      value={formData.insurancePolicyNumber || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, insurancePolicyNumber: e.target.value })
                      }
                      placeholder="เลขกรมธรรม์"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9]/50 focus:bg-[#FFFFFF] focus:border-[#1D4ED8] focus:outline-none"
                    />
                  </div>
                  <div className="lg:col-span-1">
                    <label className="block font-bold text-slate-700 mb-1">วันหมดอายุประกัน</label>
                    <input
                      type="date"
                      value={formData.insuranceExpiryDate || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, insuranceExpiryDate: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9]/50 focus:bg-[#FFFFFF] focus:border-[#1D4ED8] focus:outline-none tabular-nums"
                    />
                  </div>
                  <div className="lg:col-span-1">
                    <label className="block font-bold text-slate-700 mb-1">เบี้ยประกัน (บาท)</label>
                    <input
                      type="number"
                      min={0}
                      value={formData.insuranceCost ?? 0}
                      onChange={(e) =>
                        setFormData({ ...formData, insuranceCost: Number(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9]/50 focus:bg-[#FFFFFF] focus:border-[#1D4ED8] focus:outline-none tabular-nums"
                    />
                  </div>
                </div>

                {/* Google Drive Photo Uploader */}
                <div className="p-3.5 rounded-xl bg-[#F1F5F9]/60 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-[#0F172A] flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-[#1D4ED8]" />
                        <span>แนบรูปรถ / เล่มทะเบียน / ป้ายภาษี / กรมธรรม์ (สูงสุด 4 รูป)</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        อัปโหลดและเก็บลิงก์ตรงไปยัง Google Drive อัตโนมัติ
                      </div>
                    </div>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleUploadFormPhoto}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isUploadingPhoto || (formData.photoUrls?.length || 0) >= 4}
                      onClick={() => photoInputRef.current?.click()}
                      className="px-3 py-2 rounded-xl bg-[#FFFFFF] hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-[#1D4ED8] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {isUploadingPhoto ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span>{isUploadingPhoto ? 'กำลังอัปโหลด...' : 'อัปโหลดรูป'}</span>
                    </button>
                  </div>

                  {formData.photoUrls && formData.photoUrls.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                      {formData.photoUrls.map((url, idx) => (
                        <div
                          key={`${url}-${idx}`}
                          className="relative group rounded-xl overflow-hidden border border-slate-200 bg-[#FFFFFF] aspect-[4/3]"
                        >
                          <img
                            src={getDriveImageDisplayUrl(url, 320)}
                            alt={`เอกสารรถ ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                photoUrls: (prev.photoUrls || []).filter((_, i) => i !== idx),
                              }))
                            }
                            title="ลบรูปนี้"
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-[#0F172A]/80 text-white flex items-center justify-center hover:bg-[#DC2626] cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">หมายเหตุเพิ่มเติม</label>
                  <textarea
                    rows={2}
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="เช่น โซนวิ่งงานประจำ เงื่อนไขรถร่วม หรือรายละเอียดอุปกรณ์เสริม"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9]/50 focus:bg-[#FFFFFF] focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSaving || isUploadingPhoto}
                  className="px-5 py-2.5 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingVehicle ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูลรถ'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: QUICK RENEW (TAX / PRB / INSURANCE)
         ========================================================================= */}
      {renewVehicle && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4"
          onClick={() => setRenewVehicle(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#FFFFFF] w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
          >
            <div className="px-5 py-4 bg-[#1D4ED8] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                <div>
                  <h3 className="text-sm font-bold">ต่ออายุเอกสารรถ {renewVehicle.plateNumber}</h3>
                  <p className="text-[11px] text-blue-100">
                    อัปเดตวันหมดอายุรอบถัดไปอย่างรวดเร็ว (แนะนำ +1 ปีอัตโนมัติ)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRenewVehicle(null)}
                className="p-1 rounded-lg text-blue-100 hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitQuickRenew} className="p-5 space-y-4 text-xs">
              {renewError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[#DC2626] font-semibold">
                  {renewError}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">เลือกรายการที่ต่ออายุ</label>
                <div className="grid grid-cols-3 gap-1.5 bg-[#F1F5F9] p-1 rounded-xl border border-slate-200">
                  {(
                    [
                      { id: 'tax', label: 'ภาษีรถยนต์' },
                      { id: 'prb', label: 'พ.ร.บ.' },
                      { id: 'insurance', label: 'ประกันภัย' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleRenewDocTypeChange(tab.id)}
                      className={`py-2 rounded-lg font-bold transition-colors cursor-pointer ${
                        renewDocType === tab.id
                          ? 'bg-[#1D4ED8] text-white'
                          : 'text-slate-600 hover:text-[#0F172A]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    วันหมดอายุรอบใหม่ <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={renewExpiryDate}
                    onChange={(e) => setRenewExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9]/50 focus:bg-[#FFFFFF] focus:border-[#1D4ED8] focus:outline-none tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ค่าใช้จ่าย / เบี้ย (บาท)</label>
                  <input
                    type="number"
                    min={0}
                    value={renewCost}
                    onChange={(e) => setRenewCost(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9]/50 focus:bg-[#FFFFFF] focus:border-[#1D4ED8] focus:outline-none tabular-nums"
                  />
                </div>
              </div>

              {renewDocType !== 'tax' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">บริษัทประกัน / พ.ร.บ.</label>
                      <input
                        type="text"
                        value={renewCompany}
                        onChange={(e) => setRenewCompany(e.target.value)}
                        placeholder="ชื่อบริษัท"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9]/50 focus:bg-[#FFFFFF] focus:border-[#1D4ED8] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">เลขกรมธรรม์ใหม่</label>
                      <input
                        type="text"
                        value={renewPolicyNumber}
                        onChange={(e) => setRenewPolicyNumber(e.target.value)}
                        placeholder="เลขที่กรมธรรม์"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9]/50 focus:bg-[#FFFFFF] focus:border-[#1D4ED8] focus:outline-none"
                      />
                    </div>
                  </div>
                  {renewDocType === 'insurance' && (
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">ประเภทประกันภัย</label>
                      <select
                        value={renewInsuranceType}
                        onChange={(e) => setRenewInsuranceType(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9]/50 focus:bg-[#FFFFFF] focus:border-[#1D4ED8] focus:outline-none"
                      >
                        {INSURANCE_TYPE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Optional receipt upload */}
              <div className="p-3 rounded-xl bg-[#F1F5F9]/70 border border-slate-200 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-[#0F172A]">แนบภาพใบเสร็จ / กรมธรรม์ใหม่</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {renewUploadedUrl ? 'อัปโหลดเข้า Google Drive เรียบร้อยแล้ว' : 'ไม่บังคับ (บันทึกเข้า Google Drive)'}
                  </div>
                </div>
                <input
                  ref={renewPhotoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUploadRenewPhoto}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isUploadingRenewPhoto}
                  onClick={() => renewPhotoInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-[#FFFFFF] border border-slate-200 hover:border-blue-300 text-[#1D4ED8] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  {isUploadingRenewPhoto ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>แนบรูป</span>
                </button>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">บันทึกเพิ่มเติม</label>
                <input
                  type="text"
                  value={renewNote}
                  onChange={(e) => setRenewNote(e.target.value)}
                  placeholder="เช่น ต่อที่ขนส่งเขต 4 / ตัวแทนประกัน"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9]/50 focus:bg-[#FFFFFF] focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRenewVehicle(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isUploadingRenewPhoto}
                  className="px-4 py-2 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold cursor-pointer disabled:opacity-60"
                >
                  บันทึกการต่ออายุ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: VEHICLE DETAIL + MAINTENANCE HISTORY
         ========================================================================= */}
      {detailVehicle && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4"
          onClick={() => setDetailVehicle(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#FFFFFF] w-full max-w-2xl rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="px-5 py-4 bg-[#0F172A] text-white flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold">{detailVehicle.plateNumber}</h3>
                  <span className="text-[11px] font-semibold text-blue-200">
                    · {detailVehicle.ownershipType === 'company' ? 'รถบริษัท' : 'รถร่วม/รถจ้าง'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  {[detailVehicle.brand, detailVehicle.model, detailVehicle.vehicleType]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailVehicle(null)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 text-xs">
              {/* Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-[#F1F5F9] border border-slate-200/80">
                  <div className="text-[10px] font-semibold text-slate-500">คนขับประจำ</div>
                  <div className="font-bold text-[#0F172A] mt-0.5 truncate">
                    {detailVehicle.driverName || '-'}
                  </div>
                  {detailVehicle.driverPhone && (
                    <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" />
                      <span>{detailVehicle.driverPhone}</span>
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-[#F1F5F9] border border-slate-200/80 tabular-nums">
                  <div className="text-[10px] font-semibold text-slate-500">เลขไมล์ล่าสุด</div>
                  <div className="font-bold text-[#0F172A] mt-0.5">
                    {getEffectiveMileage(detailVehicle).toLocaleString()} กม.
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {detailVehicle.fuelType || 'ดีเซล'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#F1F5F9] border border-slate-200/80">
                  <div className="text-[10px] font-semibold text-slate-500">จังหวัด / ปีรถ</div>
                  <div className="font-bold text-[#0F172A] mt-0.5 truncate">
                    {detailVehicle.province || '-'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {detailVehicle.modelYear ? `ปี ${detailVehicle.modelYear}` : '-'} ·{' '}
                    {detailVehicle.color || '-'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#F1F5F9] border border-slate-200/80">
                  <div className="text-[10px] font-semibold text-slate-500">สถานะปัจจุบัน</div>
                  <div className="mt-1 inline-flex items-center gap-1.5 font-bold">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        (STATUS_META[detailVehicle.status] || STATUS_META.active).dotClass
                      }`}
                    />
                    <span
                      className={(STATUS_META[detailVehicle.status] || STATUS_META.active).textClass}
                    >
                      {(STATUS_META[detailVehicle.status] || STATUS_META.active).label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tax / PRB / Insurance cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 tabular-nums">
                <div className="p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="font-bold text-[#0F172A] flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#1D4ED8]" />
                    <span>ภาษีรถยนต์ประจำปี</span>
                  </div>
                  {renderExpiryCell(detailVehicle.taxExpiryDate)}
                  <div className="text-[11px] text-slate-500">
                    ค่าต่อภาษีล่าสุด: ฿{(detailVehicle.taxCost || 0).toLocaleString()}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="font-bold text-[#0F172A] flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#1D4ED8]" />
                    <span>พ.ร.บ.</span>
                  </div>
                  {renderExpiryCell(detailVehicle.prbExpiryDate)}
                  <div className="text-[11px] text-slate-500 truncate">
                    {detailVehicle.prbCompany || '-'} · {detailVehicle.prbPolicyNumber || '-'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    เบี้ย: ฿{(detailVehicle.prbCost || 0).toLocaleString()}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="font-bold text-[#0F172A] flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#1D4ED8]" />
                    <span>ประกันภัย ({detailVehicle.insuranceType || '-'})</span>
                  </div>
                  {renderExpiryCell(detailVehicle.insuranceExpiryDate)}
                  <div className="text-[11px] text-slate-500 truncate">
                    {detailVehicle.insuranceCompany || '-'} ·{' '}
                    {detailVehicle.insurancePolicyNumber || '-'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    เบี้ย: ฿{(detailVehicle.insuranceCost || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Photos */}
              {detailVehicle.photoUrls && detailVehicle.photoUrls.length > 0 && (
                <div className="space-y-2">
                  <div className="font-bold text-[#0F172A]">รูปภาพรถ &amp; เอกสารแนบ (Google Drive)</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {detailVehicle.photoUrls.map((url, idx) => (
                      <a
                        key={`${url}-${idx}`}
                        href={getDriveViewUrl(url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative rounded-xl overflow-hidden border border-slate-200 aspect-[4/3] block bg-[#F1F5F9]"
                      >
                        <img
                          src={getDriveImageDisplayUrl(url, 360)}
                          alt={`เอกสาร ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-[#0F172A]/80 text-white text-[10px] inline-flex items-center gap-1">
                          <ExternalLink className="w-2.5 h-2.5" />
                          เปิดดู
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Linked Maintenance History */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-[#0F172A] flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-[#1D4ED8]" />
                    <span>ประวัติบำรุงรักษาล่าสุดของรถคันนี้</span>
                  </div>
                  {onNavigateToMaintenance && (
                    <button
                      type="button"
                      onClick={() => {
                        setDetailVehicle(null);
                        onNavigateToMaintenance();
                      }}
                      className="text-[11px] font-bold text-[#1D4ED8] hover:underline cursor-pointer"
                    >
                      เปิดหน้าบันทึกบำรุงรักษา →
                    </button>
                  )}
                </div>

                {detailMaintenanceHistory.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#F1F5F9]/70 border border-slate-200 text-center text-slate-500">
                    ยังไม่มีประวัติการซ่อมบำรุงสำหรับทะเบียน {detailVehicle.plateNumber}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {detailMaintenanceHistory.map((rec) => (
                      <div
                        key={rec.id}
                        className="p-3 flex items-center justify-between gap-3 bg-[#FFFFFF] tabular-nums"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-[#0F172A] truncate">{rec.title}</div>
                          <div className="text-[11px] text-slate-500">
                            {formatThaiDateShort(rec.date)} · {rec.serviceCenter || '-'} · ไมล์{' '}
                            {(rec.currentMileage || 0).toLocaleString()} กม.
                          </div>
                        </div>
                        <div className="font-extrabold text-[#1D4ED8] shrink-0">
                          ฿{(rec.totalCost || 0).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {detailVehicle.notes && (
                <div className="p-3 rounded-xl bg-[#F1F5F9] border border-slate-200 text-slate-700">
                  <span className="font-bold text-[#0F172A]">หมายเหตุ: </span>
                  {detailVehicle.notes}
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 bg-[#F1F5F9] border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
              {!isViewer && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const v = detailVehicle;
                      setDetailVehicle(null);
                      handleOpenQuickRenew(v);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#FFFFFF] border border-slate-200 hover:border-blue-300 text-[#1D4ED8] text-xs font-bold cursor-pointer"
                  >
                    ต่ออายุภาษี/ประกัน
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const v = detailVehicle;
                      setDetailVehicle(null);
                      handleOpenEdit(v);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold cursor-pointer"
                  >
                    แก้ไขข้อมูลรถ
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setDetailVehicle(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-[#0F172A] text-xs font-bold cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: DELETE CONFIRMATION (In-App, No window.confirm)
         ========================================================================= */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#FFFFFF] w-full max-w-sm rounded-2xl border border-slate-200 shadow-2xl p-5 space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-[#DC2626] flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#0F172A]">ยืนยันการลบข้อมูลรถ</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  ต้องการลบทะเบียนรถ{' '}
                  <span className="font-bold text-[#0F172A]">{deleteTarget.plateNumber}</span> ออกจากระบบและ
                  Google Sheets หรือไม่? ประวัติซ่อมบำรุงเดิมจะยังคงอยู่
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = deleteTarget.id;
                  setDeleteTarget(null);
                  await onDeleteVehicle(id);
                }}
                className="px-4 py-2 rounded-xl bg-[#DC2626] hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
