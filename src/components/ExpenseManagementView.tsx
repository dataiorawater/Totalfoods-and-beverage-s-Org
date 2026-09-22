import React, { useState, useMemo, useRef, useEffect } from 'react';
import { StaffUser, Expense } from '../types';
import {
  Wallet,
  Plus,
  Calendar,
  FileSpreadsheet,
  Filter,
  CheckCircle2,
  X,
  Download,
  Camera,
  Gauge,
  Sparkles,
  Loader2,
  Eye,
  AlertCircle,
  ArrowRight,
  Car,
  Upload,
  RotateCcw,
  Image as ImageIcon,
} from 'lucide-react';
import { exportExpensesToExcel } from '../services/excelExport';
import { compressImageFile } from '../utils/geoUtils';
import { readOdometerFromImage } from '../services/geminiOcr';

interface ExpenseManagementViewProps {
  currentUser: StaffUser;
  expenses: Expense[];
  onSaveExpense: (expense: Expense) => Promise<boolean>;
  onShowToast: (type: 'success' | 'error', title: string, msg: string) => void;
}

const EXPENSE_TYPES = [
  'ค่าน้ำมัน',
  'ค่าทางด่วน',
  'ค่าอาหาร',
  'ค่าที่พัก',
  'ค่าใช้จ่ายอื่นๆ',
];

export const ExpenseManagementView: React.FC<ExpenseManagementViewProps> = ({
  currentUser,
  expenses,
  onSaveExpense,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'export'>('list');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [expenseType, setExpenseType] = useState(EXPENSE_TYPES[0]);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mileage States (ไมล์ไป & ไมล์กลับ)
  const [startMileage, setStartMileage] = useState('');
  const [endMileage, setEndMileage] = useState('');
  const [startMileagePhoto, setStartMileagePhoto] = useState('');
  const [endMileagePhoto, setEndMileagePhoto] = useState('');
  const [isReadingStartMileage, setIsReadingStartMileage] = useState(false);
  const [isReadingEndMileage, setIsReadingEndMileage] = useState(false);
  const [startAiNote, setStartAiNote] = useState('');
  const [endAiNote, setEndAiNote] = useState('');
  const [startAiDetectedVal, setStartAiDetectedVal] = useState('');
  const [endAiDetectedVal, setEndAiDetectedVal] = useState('');
  const [isAutoFilledStart, setIsAutoFilledStart] = useState(false);
  const [isAutoFilledEnd, setIsAutoFilledEnd] = useState(false);

  // Image zoom modal
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // File input refs
  const receiptCameraRef = useRef<HTMLInputElement>(null);
  const startMileageCameraRef = useRef<HTMLInputElement>(null);
  const startMileageGalleryRef = useRef<HTMLInputElement>(null);
  const endMileageCameraRef = useRef<HTMLInputElement>(null);
  const endMileageGalleryRef = useRef<HTMLInputElement>(null);

  // List Filter State
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const [filterType, setFilterType] = useState('all');
  const [visibleExpenseCount, setVisibleExpenseCount] = useState(24);

  useEffect(() => {
    setVisibleExpenseCount(24);
  }, [filterMonth, filterType]);

  const uniqueMonths = Array.from(new Set(expenses.map((e) => e.date.slice(0, 7))))
    .sort()
    .reverse();
  const currentMonth = new Date().toISOString().slice(0, 7);
  if (!uniqueMonths.includes(currentMonth)) uniqueMonths.unshift(currentMonth);

  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((e) => {
        if (currentUser.role === 'sales' || currentUser.role === 'delivery') {
          if (e.salespersonId !== currentUser.id) return false;
        }
        if (filterMonth !== 'all' && !e.date.startsWith(filterMonth)) return false;
        if (filterType !== 'all' && e.expenseType !== filterType) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, filterMonth, filterType, currentUser]);

  const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalDistance = filteredExpenses.reduce((sum, e) => sum + (e.distance || 0), 0);

  // Calculated distance for active form
  const startNum = startMileage !== '' ? parseFloat(startMileage.replace(/,/g, '')) : null;
  const endNum = endMileage !== '' ? parseFloat(endMileage.replace(/,/g, '')) : null;
  const calculatedDistance = useMemo(() => {
    if (startNum !== null && endNum !== null && !isNaN(startNum) && !isNaN(endNum)) {
      const diff = endNum - startNum;
      return Math.round(diff * 100) / 100;
    }
    return null;
  }, [startNum, endNum]);

  // Handle Receipt photo
  const handleReceiptPhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 1024, 1024, 0.75);
      setPhotoDataUrl(compressed);
    } catch (err: any) {
      onShowToast('error', 'ประมวลผลรูปไม่สำเร็จ', err?.message || 'ไม่สามารถบีบอัดรูปภาพได้');
    } finally {
      e.target.value = '';
    }
  };

  // Helper to process Start Mileage from file or existing dataUrl
  const processStartMileage = async (fileOrDataUrl: File | string) => {
    try {
      setIsReadingStartMileage(true);
      setStartAiNote('');

      let compressed = '';
      if (typeof fileOrDataUrl === 'string') {
        compressed = fileOrDataUrl;
      } else {
        compressed = await compressImageFile(fileOrDataUrl, 1280, 1280, 0.8);
      }
      setStartMileagePhoto(compressed);

      const ocrRes = await readOdometerFromImage(compressed, 'start');
      const detectedVal = ocrRes.mileageStr || (ocrRes.mileage !== undefined && ocrRes.mileage > 0 ? String(ocrRes.mileage) : '');
      const cleanDigits = detectedVal.replace(/[^0-9.]/g, '');

      if (ocrRes.success && cleanDigits && parseFloat(cleanDigits) > 0) {
        setStartMileage(cleanDigits);
        setStartAiDetectedVal(cleanDigits);
        setIsAutoFilledStart(true);
        setTimeout(() => setIsAutoFilledStart(false), 3500);

        const numDisplay = parseFloat(cleanDigits).toLocaleString();
        setStartAiNote(ocrRes.note || `AI ตรวจพบเลขไมล์ ${numDisplay} กม. (กรอกในช่องแล้ว)`);
        onShowToast(
          'success',
          'อ่านเลขไมล์สำเร็จ!',
          `ตรวจพบเลขไมล์ ${numDisplay} กม. และนำมากรอกในช่องให้เรียบร้อยแล้ว`
        );
      } else {
        onShowToast(
          'error',
          'อ่านไมล์อัตโนมัติไม่ชัดเจน',
          ocrRes.error || 'กรุณาตรวจสอบรูปถ่ายให้ชัดเจนขึ้น หรือพิมพ์ตัวเลขไมล์ด้วยตนเอง'
        );
      }
    } catch (err: any) {
      onShowToast('error', 'ข้อผิดพลาด', err?.message || 'ไม่สามารถวิเคราะห์รูปภาพได้');
    } finally {
      setIsReadingStartMileage(false);
    }
  };

  // Helper to process End Mileage from file or existing dataUrl
  const processEndMileage = async (fileOrDataUrl: File | string) => {
    try {
      setIsReadingEndMileage(true);
      setEndAiNote('');

      let compressed = '';
      if (typeof fileOrDataUrl === 'string') {
        compressed = fileOrDataUrl;
      } else {
        compressed = await compressImageFile(fileOrDataUrl, 1280, 1280, 0.8);
      }
      setEndMileagePhoto(compressed);

      const ocrRes = await readOdometerFromImage(compressed, 'end');
      const detectedVal = ocrRes.mileageStr || (ocrRes.mileage !== undefined && ocrRes.mileage > 0 ? String(ocrRes.mileage) : '');
      const cleanDigits = detectedVal.replace(/[^0-9.]/g, '');

      if (ocrRes.success && cleanDigits && parseFloat(cleanDigits) > 0) {
        setEndMileage(cleanDigits);
        setEndAiDetectedVal(cleanDigits);
        setIsAutoFilledEnd(true);
        setTimeout(() => setIsAutoFilledEnd(false), 3500);

        const numDisplay = parseFloat(cleanDigits).toLocaleString();
        setEndAiNote(ocrRes.note || `AI ตรวจพบเลขไมล์ ${numDisplay} กม. (กรอกในช่องแล้ว)`);
        onShowToast(
          'success',
          'อ่านเลขไมล์สำเร็จ!',
          `ตรวจพบเลขไมล์ ${numDisplay} กม. และนำมากรอกในช่องให้เรียบร้อยแล้ว`
        );
      } else {
        onShowToast(
          'error',
          'อ่านไมล์อัตโนมัติไม่ชัดเจน',
          ocrRes.error || 'กรุณาตรวจสอบรูปถ่ายให้ชัดเจนขึ้น หรือพิมพ์ตัวเลขไมล์ด้วยตนเอง'
        );
      }
    } catch (err: any) {
      onShowToast('error', 'ข้อผิดพลาด', err?.message || 'ไม่สามารถวิเคราะห์รูปภาพได้');
    } finally {
      setIsReadingEndMileage(false);
    }
  };

  const handleStartMileageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processStartMileage(file);
    }
    e.target.value = '';
  };

  const handleEndMileageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processEndMileage(file);
    }
    e.target.value = '';
  };

  const handleResetForm = () => {
    setDate(new Date().toISOString().slice(0, 10));
    setExpenseType(EXPENSE_TYPES[0]);
    setAmount('');
    setNote('');
    setPhotoDataUrl('');
    setStartMileage('');
    setEndMileage('');
    setStartMileagePhoto('');
    setEndMileagePhoto('');
    setStartAiNote('');
    setEndAiNote('');
    setStartAiDetectedVal('');
    setEndAiDetectedVal('');
    setIsAutoFilledStart(false);
    setIsAutoFilledEnd(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = amount.replace(/,/g, '').trim();
    if (!cleanAmount || isNaN(Number(cleanAmount))) {
      onShowToast('error', 'ข้อมูลไม่ถูกต้อง', 'กรุณาระบุจำนวนเงินที่ถูกต้อง');
      return;
    }

    const cleanStart = startMileage.replace(/,/g, '').trim();
    const cleanEnd = endMileage.replace(/,/g, '').trim();
    const s = cleanStart !== '' && !isNaN(Number(cleanStart)) ? Number(cleanStart) : undefined;
    const end = cleanEnd !== '' && !isNaN(Number(cleanEnd)) ? Number(cleanEnd) : undefined;
    const dist = (s !== undefined && end !== undefined && end >= s) ? Math.round((end - s) * 100) / 100 : undefined;

    setIsSubmitting(true);
    const newExpense: Expense = {
      id: `EXP-${Date.now()}`,
      createdAt: new Date().toISOString(),
      date,
      salespersonId: currentUser.id,
      salespersonName: currentUser.name,
      expenseType,
      amount: Number(cleanAmount),
      note,
      receiptUrl: photoDataUrl || undefined,
      startMileage: s,
      endMileage: end,
      distance: dist,
      startMileagePhoto: startMileagePhoto || undefined,
      endMileagePhoto: endMileagePhoto || undefined,
      status: 'pending',
    };

    const success = await onSaveExpense(newExpense);
    setIsSubmitting(false);
    if (success) {
      setIsAddModalOpen(false);
      handleResetForm();
    }
  };

  const handleExport = () => {
    exportExpensesToExcel(filteredExpenses, { month: filterMonth });
  };

  return (
    <div id="expense-management-root" className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2.5">
            <Wallet className="w-6 h-6 text-blue-600" />
            <span>บันทึกค่าใช้จ่าย</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            บันทึกค่าน้ำมันพร้อมสแกนไมล์รถยนต์ (ไมล์ไป-กลับ คำนวณระยะทางอัตโนมัติ) และค่าใช้จ่ายต่างๆ
          </p>
        </div>
        <button
          id="btn-open-add-expense"
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มค่าใช้จ่าย</span>
        </button>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-100 px-4 pt-2 bg-slate-50/50">
          <button
            id="tab-expense-list"
            onClick={() => setActiveTab('list')}
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'list'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>รายการค่าใช้จ่าย</span>
          </button>
          <button
            id="tab-expense-export"
            onClick={() => setActiveTab('export')}
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'export'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>ส่งออกรายงาน</span>
          </button>
        </div>

        {activeTab === 'list' && (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500">เดือน:</span>
                <select
                  id="select-filter-month"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="bg-transparent text-sm font-medium text-slate-700 focus:outline-none w-full"
                >
                  <option value="all">ทุกเดือน</option>
                  {uniqueMonths.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500">ประเภท:</span>
                <select
                  id="select-filter-type"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="bg-transparent text-sm font-medium text-slate-700 focus:outline-none w-full"
                >
                  <option value="all">ทุกประเภท</option>
                  {EXPENSE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Summary Stat Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-blue-50/80 p-4 rounded-xl border border-blue-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-blue-700 block">รวมค่าใช้จ่ายทั้งหมด</span>
                  <span className="text-xs text-blue-600/80">({filteredExpenses.length} รายการ)</span>
                </div>
                <span className="text-xl font-black text-blue-800">฿{(totalAmount ?? 0).toLocaleString()}</span>
              </div>
              <div className="bg-emerald-50/80 p-4 rounded-xl border border-emerald-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-700 block flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5 text-emerald-600" /> รวมระยะทางเดินทางสะสม
                  </span>
                  <span className="text-xs text-emerald-600/80">จากรายการบันทึกเลขไมล์</span>
                </div>
                <span className="text-xl font-black text-emerald-800">{(totalDistance ?? 0).toLocaleString()} กม.</span>
              </div>
            </div>

            {/* Expense Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredExpenses.slice(0, visibleExpenseCount).map((exp) => {
                const hasMileage =
                  exp.distance !== undefined ||
                  exp.startMileage !== undefined ||
                  exp.endMileage !== undefined;

                return (
                  <div
                    key={exp.id}
                    id={`expense-card-${exp.id}`}
                    className="content-auto-card bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative hover:border-blue-300 transition-colors flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold">
                          {exp.expenseType}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          {new Date(exp.date).toLocaleDateString('th-TH')}
                        </span>
                      </div>

                      <div className="text-2xl font-black text-slate-800 mb-1">
                        ฿{(exp.amount ?? 0).toLocaleString()}
                      </div>

                      <div className="text-xs text-slate-600 font-medium mb-3 line-clamp-2">
                        {exp.note || 'ไม่มีหมายเหตุ'}
                      </div>

                      {/* Mileage Info Box */}
                      {hasMileage && (
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 mb-3 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-700 flex items-center gap-1.5">
                              <Gauge className="w-3.5 h-3.5 text-blue-600" />
                              <span>ระยะทางเดินทาง</span>
                            </span>
                            {exp.distance !== undefined && (
                              <span className="font-black text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                                {(exp.distance ?? 0).toLocaleString()} กม.
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1 border-t border-slate-200/50">
                            <div>
                              <span className="text-slate-400 block text-[10px]">ไมล์ไป:</span>
                              <span className="font-semibold text-slate-700">
                                {exp.startMileage !== undefined ? `${exp.startMileage.toLocaleString()} กม.` : '-'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">ไมล์กลับ:</span>
                              <span className="font-semibold text-slate-700">
                                {exp.endMileage !== undefined ? `${exp.endMileage.toLocaleString()} กม.` : '-'}
                              </span>
                            </div>
                          </div>

                          {/* Mileage Photos Preview Buttons */}
                          {(exp.startMileagePhoto || exp.endMileagePhoto) && (
                            <div className="flex gap-2 pt-1">
                              {exp.startMileagePhoto && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewImage({
                                      url: exp.startMileagePhoto!,
                                      title: `รูปไมล์ไป (${exp.startMileage?.toLocaleString() || ''} กม.)`,
                                    })
                                  }
                                  className="flex-1 flex items-center justify-center gap-1 py-1 px-1.5 bg-white border border-slate-200 hover:border-blue-400 rounded-lg text-[10px] font-semibold text-slate-700 transition-colors"
                                >
                                  <Eye className="w-3 h-3 text-blue-600" />
                                  <span>รูปไมล์ไป</span>
                                </button>
                              )}
                              {exp.endMileagePhoto && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewImage({
                                      url: exp.endMileagePhoto!,
                                      title: `รูปไมล์กลับ (${exp.endMileage?.toLocaleString() || ''} กม.)`,
                                    })
                                  }
                                  className="flex-1 flex items-center justify-center gap-1 py-1 px-1.5 bg-white border border-slate-200 hover:border-blue-400 rounded-lg text-[10px] font-semibold text-slate-700 transition-colors"
                                >
                                  <Eye className="w-3 h-3 text-blue-600" />
                                  <span>รูปไมล์กลับ</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Receipt Image */}
                      {exp.receiptUrl && (
                        <div className="mt-2 relative group">
                          <img
                            src={exp.receiptUrl}
                            alt="Receipt"
                            className="w-full h-28 object-cover rounded-xl border border-slate-200 cursor-pointer"
                            onClick={() =>
                              setPreviewImage({
                                url: exp.receiptUrl!,
                                title: `ใบเสร็จ - ${exp.expenseType} ฿${(exp.amount ?? 0).toLocaleString()}`,
                              })
                            }
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage({
                                url: exp.receiptUrl!,
                                title: `ใบเสร็จ - ${exp.expenseType} ฿${(exp.amount ?? 0).toLocaleString()}`,
                              })
                            }
                            className="absolute bottom-2 right-2 bg-slate-900/70 text-white text-[10px] px-2 py-1 rounded-md flex items-center gap-1 backdrop-blur-sm opacity-90 group-hover:opacity-100"
                          >
                            <Eye className="w-3 h-3" /> ดูใบเสร็จ
                          </button>
                        </div>
                      )}
                    </div>

                    {(currentUser.role === 'admin' || currentUser.role === 'manager') && (
                      <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-2 mt-3 flex justify-between">
                        <span>พนักงาน:</span>
                        <span className="font-semibold text-slate-600">{exp.salespersonName}</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredExpenses.length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-500 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="font-bold text-sm text-slate-700">ไม่พบรายการค่าใช้จ่าย</p>
                  <p className="text-xs text-slate-400 mt-1">กดปุ่ม "เพิ่มค่าใช้จ่าย" เพื่อเริ่มบันทึกรายการ</p>
                </div>
              )}
            </div>

            {filteredExpenses.length > visibleExpenseCount && (
              <button
                type="button"
                onClick={() => setVisibleExpenseCount((prev) => prev + 24)}
                className="w-full py-3 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs sm:text-sm transition-colors shadow-2xs flex items-center justify-center gap-2 cursor-pointer mt-3"
              >
                <span>แสดงรายการเพิ่มเติม (+24 จากทั้งหมด {filteredExpenses.length} รายการ)</span>
              </button>
            )}
          </div>
        )}

        {/* Export Tab */}
        {activeTab === 'export' && (
          <div className="p-8 text-center space-y-4 max-w-lg mx-auto">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-emerald-100 shadow-sm">
              <FileSpreadsheet className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">ส่งออกรายงานค่าใช้จ่าย</h3>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              สรุปรายการค่าใช้จ่ายทั้งหมด พร้อมรายละเอียดเลขไมล์ไป-กลับ ระยะทางคำนวณอัตโนมัติ และยอดรวมเงิน
              ตามเงื่อนไขเดือนที่เลือก (เดือน:{' '}
              <span className="font-bold text-slate-700">
                {filterMonth === 'all' ? 'ทั้งหมด' : filterMonth}
              </span>
              )
            </p>
            <div className="pt-2">
              <button
                id="btn-download-expense-excel"
                onClick={handleExport}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm transition-all cursor-pointer w-full sm:w-auto"
              >
                <Download className="w-5 h-5" />
                <span>ดาวน์โหลดไฟล์ Excel (.xlsx)</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      {isAddModalOpen && (
        <div
          id="add-expense-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 gpu-layer animate-in fade-in duration-200"
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white gpu-layer z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-800">บันทึกค่าใช้จ่ายใหม่</h2>
                  <p className="text-[11px] text-slate-400 font-medium">ค่าน้ำมันพร้อมอ่านไมล์รถ หรือค่าใช้จ่ายทั่วไป</p>
                </div>
              </div>
              <button
                id="btn-close-expense-modal"
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Date & Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">วันที่ทำรายการ</label>
                    <input
                      id="input-expense-date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">ประเภทค่าใช้จ่าย</label>
                    <select
                      id="select-expense-type"
                      value={expenseType}
                      onChange={(e) => setExpenseType(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    >
                      {EXPENSE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">จำนวนเงิน (บาท)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-blue-600 text-base">฿</span>
                    <input
                      id="input-expense-amount"
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      placeholder="0.00"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-lg font-black text-blue-700 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>
                </div>

                {/* ======================================================== */}
                {/* MILEAGE SECTION (ไมล์ไป - ไมล์กลับ - คำนวณระยะทางอัตโนมัติ) */}
                {/* ======================================================== */}
                <div className="bg-gradient-to-br from-slate-50 to-blue-50/40 border border-blue-100/80 rounded-2xl p-4 sm:p-4.5 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                        <Gauge className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-800">
                          บันทึกเลขไมล์เดินทาง (คำนวณระยะทาง)
                        </h4>
                        <p className="text-[10px] text-slate-500 font-medium">
                          ถ่ายรูปหน้าปัดให้ AI ช่วยอ่าน หรือพิมพ์ตัวเลขไมล์ด้วยตนเอง
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* 1. START MILEAGE (ไมล์ไป) */}
                    <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                          ไมล์ไป (เริ่มต้น)
                        </span>
                        {isReadingStartMileage ? (
                          <span className="text-[10px] font-bold text-blue-600 flex items-center gap-1 animate-pulse">
                            <Loader2 className="w-3 h-3 animate-spin" /> AI กำลังอ่านตัวเลข...
                          </span>
                        ) : isAutoFilledStart ? (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 border border-emerald-200 animate-pulse">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> กรอกลงช่องแล้ว
                          </span>
                        ) : null}
                      </div>

                      {/* Photo preview or Dual Capture buttons */}
                      {!startMileagePhoto ? (
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            id="btn-scan-start-mileage-camera"
                            disabled={isReadingStartMileage}
                            onClick={() => startMileageCameraRef.current?.click()}
                            className="py-2 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 border-dashed rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            title="เปิดกล้องถ่ายภาพหน้าปัดไมล์ไป"
                          >
                            <Camera className="w-3.5 h-3.5 shrink-0" />
                            <span>ถ่ายรูป (กล้อง)</span>
                          </button>
                          <button
                            type="button"
                            id="btn-scan-start-mileage-gallery"
                            disabled={isReadingStartMileage}
                            onClick={() => startMileageGalleryRef.current?.click()}
                            className="py-2 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 border-dashed rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            title="เลือกรูปภาพหน้าปัดจากอัลบั้มหรือในเครื่อง"
                          >
                            <ImageIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>เลือกจากอัลบั้ม</span>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                            <img
                              src={startMileagePhoto}
                              alt="Start mileage dashboard"
                              className="w-full h-24 object-cover"
                            />
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-between px-2 opacity-0 hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewImage({ url: startMileagePhoto, title: 'รูปหน้าปัดไมล์ไป' })
                                }
                                className="p-1 bg-white/90 hover:bg-white text-slate-800 rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3 h-3" /> ดูรูป
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setStartMileagePhoto('');
                                  setStartAiNote('');
                                  setStartAiDetectedVal('');
                                }}
                                className="p-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-[10px] font-bold cursor-pointer"
                              >
                                <X className="w-3 h-3" /> ลบรูป
                              </button>
                            </div>
                            {isReadingStartMileage && (
                              <div className="absolute inset-0 bg-blue-900/70 flex flex-col items-center justify-center text-white text-[11px] font-bold gap-1">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>AI กำลังอ่านตัวเลขบนหน้าปัด...</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[10px]">
                            <button
                              type="button"
                              disabled={isReadingStartMileage}
                              onClick={() => processStartMileage(startMileagePhoto)}
                              className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer hover:underline"
                            >
                              <Sparkles className="w-3 h-3 text-amber-500" />
                              <span>ให้ AI อ่านรูปนี้ซ้ำ</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => startMileageGalleryRef.current?.click()}
                              className="text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
                            >
                              เปลี่ยนรูป
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Camera input (forces camera on mobile) */}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        ref={startMileageCameraRef}
                        onChange={handleStartMileageFileSelect}
                        className="hidden"
                      />
                      {/* Gallery input (standard file picker) */}
                      <input
                        type="file"
                        accept="image/*"
                        ref={startMileageGalleryRef}
                        onChange={handleStartMileageFileSelect}
                        className="hidden"
                      />

                      {/* Number Input with Autofill Glow */}
                      <div className="relative">
                        <input
                          id="input-start-mileage"
                          type="text"
                          inputMode="decimal"
                          pattern="[0-9.]*"
                          value={startMileage}
                          onChange={(e) => setStartMileage(e.target.value.replace(/[^0-9.]/g, ''))}
                          placeholder="เช่น 45210"
                          className={`w-full border rounded-lg px-3 py-2 text-sm font-bold text-slate-800 pr-10 transition-all ${
                            isAutoFilledStart
                              ? 'ring-2 ring-emerald-500 bg-emerald-50/80 border-emerald-400'
                              : 'bg-slate-50 border-slate-200 focus:ring-2 focus:ring-blue-500 focus:bg-white'
                          }`}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                          กม.
                        </span>
                      </div>

                      {/* Quick Apply Detected Value Bar if different */}
                      {startAiDetectedVal && (
                        <div className="flex items-center justify-between text-[11px] bg-blue-50/80 border border-blue-200/70 rounded-md px-2 py-1 text-blue-700">
                          <span className="flex items-center gap-1 font-medium">
                            <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                            AI อ่านได้: <strong className="font-bold">{parseFloat(startAiDetectedVal).toLocaleString()}</strong> กม.
                          </span>
                          {startMileage !== startAiDetectedVal && (
                            <button
                              type="button"
                              onClick={() => {
                                setStartMileage(startAiDetectedVal);
                                setIsAutoFilledStart(true);
                                setTimeout(() => setIsAutoFilledStart(false), 2000);
                              }}
                              className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-bold px-1.5 py-0.5 rounded cursor-pointer transition-colors shadow-2xs"
                            >
                              นำค่านี้มากรอก
                            </button>
                          )}
                        </div>
                      )}

                      {startAiNote && !startAiDetectedVal && (
                        <p className="text-[10px] text-blue-600 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-blue-500 shrink-0" />
                          <span>{startAiNote}</span>
                        </p>
                      )}
                    </div>

                    {/* 2. END MILEAGE (ไมล์กลับ) */}
                    <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          ไมล์กลับ (สิ้นสุด)
                        </span>
                        {isReadingEndMileage ? (
                          <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 animate-pulse">
                            <Loader2 className="w-3 h-3 animate-spin" /> AI กำลังอ่านตัวเลข...
                          </span>
                        ) : isAutoFilledEnd ? (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 border border-emerald-200 animate-pulse">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> กรอกลงช่องแล้ว
                          </span>
                        ) : null}
                      </div>

                      {/* Photo preview or Dual Capture buttons */}
                      {!endMileagePhoto ? (
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            id="btn-scan-end-mileage-camera"
                            disabled={isReadingEndMileage}
                            onClick={() => endMileageCameraRef.current?.click()}
                            className="py-2 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 border-dashed rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            title="เปิดกล้องถ่ายภาพหน้าปัดไมล์กลับ"
                          >
                            <Camera className="w-3.5 h-3.5 shrink-0" />
                            <span>ถ่ายรูป (กล้อง)</span>
                          </button>
                          <button
                            type="button"
                            id="btn-scan-end-mileage-gallery"
                            disabled={isReadingEndMileage}
                            onClick={() => endMileageGalleryRef.current?.click()}
                            className="py-2 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 border-dashed rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            title="เลือกรูปภาพหน้าปัดจากอัลบั้มหรือในเครื่อง"
                          >
                            <ImageIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>เลือกจากอัลบั้ม</span>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                            <img
                              src={endMileagePhoto}
                              alt="End mileage dashboard"
                              className="w-full h-24 object-cover"
                            />
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-between px-2 opacity-0 hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewImage({ url: endMileagePhoto, title: 'รูปหน้าปัดไมล์กลับ' })
                                }
                                className="p-1 bg-white/90 hover:bg-white text-slate-800 rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3 h-3" /> ดูรูป
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEndMileagePhoto('');
                                  setEndAiNote('');
                                  setEndAiDetectedVal('');
                                }}
                                className="p-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-[10px] font-bold cursor-pointer"
                              >
                                <X className="w-3 h-3" /> ลบรูป
                              </button>
                            </div>
                            {isReadingEndMileage && (
                              <div className="absolute inset-0 bg-emerald-900/70 flex flex-col items-center justify-center text-white text-[11px] font-bold gap-1">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>AI กำลังอ่านตัวเลขบนหน้าปัด...</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[10px]">
                            <button
                              type="button"
                              disabled={isReadingEndMileage}
                              onClick={() => processEndMileage(endMileagePhoto)}
                              className="text-emerald-600 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer hover:underline"
                            >
                              <Sparkles className="w-3 h-3 text-amber-500" />
                              <span>ให้ AI อ่านรูปนี้ซ้ำ</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => endMileageGalleryRef.current?.click()}
                              className="text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
                            >
                              เปลี่ยนรูป
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Camera input (forces camera on mobile) */}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        ref={endMileageCameraRef}
                        onChange={handleEndMileageFileSelect}
                        className="hidden"
                      />
                      {/* Gallery input (standard file picker) */}
                      <input
                        type="file"
                        accept="image/*"
                        ref={endMileageGalleryRef}
                        onChange={handleEndMileageFileSelect}
                        className="hidden"
                      />

                      {/* Number Input with Autofill Glow */}
                      <div className="relative">
                        <input
                          id="input-end-mileage"
                          type="text"
                          inputMode="decimal"
                          pattern="[0-9.]*"
                          value={endMileage}
                          onChange={(e) => setEndMileage(e.target.value.replace(/[^0-9.]/g, ''))}
                          placeholder="เช่น 45350"
                          className={`w-full border rounded-lg px-3 py-2 text-sm font-bold text-slate-800 pr-10 transition-all ${
                            isAutoFilledEnd
                              ? 'ring-2 ring-emerald-500 bg-emerald-50/80 border-emerald-400'
                              : 'bg-slate-50 border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:bg-white'
                          }`}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                          กม.
                        </span>
                      </div>

                      {/* Quick Apply Detected Value Bar if different */}
                      {endAiDetectedVal && (
                        <div className="flex items-center justify-between text-[11px] bg-emerald-50/80 border border-emerald-200/70 rounded-md px-2 py-1 text-emerald-800">
                          <span className="flex items-center gap-1 font-medium">
                            <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                            AI อ่านได้: <strong className="font-bold">{parseFloat(endAiDetectedVal).toLocaleString()}</strong> กม.
                          </span>
                          {endMileage !== endAiDetectedVal && (
                            <button
                              type="button"
                              onClick={() => {
                                setEndMileage(endAiDetectedVal);
                                setIsAutoFilledEnd(true);
                                setTimeout(() => setIsAutoFilledEnd(false), 2000);
                              }}
                              className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-1.5 py-0.5 rounded cursor-pointer transition-colors shadow-2xs"
                            >
                              นำค่านี้มากรอก
                            </button>
                          )}
                        </div>
                      )}

                      {endAiNote && !endAiDetectedVal && (
                        <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span>{endAiNote}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Distance Auto Calculation Banner */}
                  {startNum !== null && endNum !== null && !isNaN(startNum) && !isNaN(endNum) && (
                    <div className="pt-1">
                      {endNum >= startNum ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                              <Car className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-emerald-800 block">
                                รวมระยะทางที่เดินทางอัตโนมัติ
                              </span>
                              <span className="text-[11px] text-emerald-600 font-medium">
                                ไมล์กลับ ({(endNum ?? 0).toLocaleString()}) - ไมล์ไป ({(startNum ?? 0).toLocaleString()})
                              </span>
                            </div>
                          </div>
                          <span className="text-lg font-black text-emerald-700">
                            {(calculatedDistance ?? 0).toLocaleString()} กม.
                          </span>
                        </div>
                      ) : (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-amber-800 text-xs">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>
                            คำเตือน: ไมล์กลับ ({(endNum ?? 0).toLocaleString()}) น้อยกว่าไมล์ไป ({(startNum ?? 0).toLocaleString()})
                            โปรดตรวจสอบตัวเลข
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Receipt Upload */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    รูปใบเสร็จ / สลิป (ถ้ามี)
                  </label>
                  {!photoDataUrl ? (
                    <button
                      type="button"
                      id="btn-upload-receipt"
                      onClick={() => receiptCameraRef.current?.click()}
                      className="w-full py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Camera className="w-4 h-4 text-slate-500" />
                      <span>ถ่ายรูป / แนบไฟล์ใบเสร็จ</span>
                    </button>
                  ) : (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                      <img src={photoDataUrl} alt="Receipt" className="w-full h-36 object-cover" />
                      <div className="absolute top-2 right-2 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPreviewImage({ url: photoDataUrl, title: 'รูปใบเสร็จ / สลิป' })}
                          className="bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full shadow cursor-pointer transition-colors"
                          title="ดูรูปขนาดใหญ่"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPhotoDataUrl('')}
                          className="bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-full shadow cursor-pointer transition-colors"
                          title="ลบรูป"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      {expenseType === 'ค่าน้ำมัน' && !startMileagePhoto && (
                        <div className="absolute bottom-2 left-2">
                          <button
                            type="button"
                            onClick={() => processStartMileage(photoDataUrl)}
                            className="bg-blue-600/90 hover:bg-blue-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Sparkles className="w-3 h-3 text-amber-300" />
                            <span>ใช้รูปนี้เป็นไมล์ไป</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={receiptCameraRef}
                    onChange={handleReceiptPhotoCapture}
                    className="hidden"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">หมายเหตุ</label>
                  <textarea
                    id="textarea-expense-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="เช่น เติมน้ำมัน ปตท. สาขาบางนา หรือรายละเอียดการเดินทาง..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>

                {/* Submit button */}
                <div className="pt-2">
                  <button
                    id="btn-submit-expense"
                    type="submit"
                    disabled={isSubmitting || isReadingStartMileage || isReadingEndMileage}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer text-sm"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>กำลังบันทึกข้อมูล...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>บันทึกค่าใช้จ่าย</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 gpu-layer animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 flex items-center justify-between border-b border-slate-800 text-white">
              <span className="text-sm font-bold">{previewImage.title}</span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1 text-slate-400 hover:text-white rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex justify-center bg-black/50 max-h-[75vh] overflow-auto">
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="max-h-[65vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
