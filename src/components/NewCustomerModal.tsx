import React, { useState } from 'react';
import {
  X,
  UserPlus,
  Phone,
  User,
  MapPin,
  Navigation,
  ExternalLink,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Customer } from '../types';

interface NewCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  routes?: import('../types').Route[];
  onSaveCustomer: (customer: {
    name: string;
    phone: string;
    address: string;
    mapsUrl: string;
    routeName?: string;
  }) => Promise<boolean>;
  sheetsConnected: boolean;
}

export const NewCustomerModal: React.FC<NewCustomerModalProps> = ({
  isOpen,
  onClose,
  routes = [],
  onSaveCustomer,
  sheetsConnected,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [routeName, setRouteName] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');

  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Function to capture GPS location and build Google Maps URL
  const handleCaptureGPS = () => {
    if (!navigator.geolocation) {
      setErrorMsg('เบราว์เซอร์ของคุณไม่รองรับการจับพิกัด GPS');
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
        setErrorMsg('ไม่สามารถจับพิกัด GPS ได้ กรุณาเปิด Location หรือใส่ลิ้งก์ด้วยตนเอง');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

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
        name: cleanName,
        phone: cleanPhone,
        address: cleanAddress,
        mapsUrl: cleanMapsUrl,
        routeName: cleanRouteName,
      });

      if (success) {
        setSuccessMsg('บันทึกข้อมูลลูกค้าลง Google Sheets เรียบร้อยแล้ว');
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setErrorMsg('ไม่สามารถบันทึกลง Google Sheets ได้ กรุณาตรวจสอบการเชื่อมต่อ');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูลลูกค้า');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 gpu-layer flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">เพิ่มลูกค้าใหม่</h3>
              <p className="text-xs text-blue-100 mt-0.5">
                บันทึกประวัติลูกค้าลง Google Sheets (แท็บข้อมูลลูกค้า)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Status Messages */}
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
                placeholder="เช่น ร้านกาแฟคอฟฟี่คอร์เนอร์ หรือ คุณสมศักดิ์"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* 2. Phone Number */}
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
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Route */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              สายการเข้าเยี่ยม
            </label>
            <div className="relative">
              <select
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              >
                <option value="" disabled>-- โปรดระบุสาย --</option>
                {routes.map(r => (
                  <option key={r.id} value={r.name}>{r.name} {r.id ? `(${r.id})` : ''}</option>
                ))}
              </select>
              <Navigation className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* 3. Address */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ที่อยู่จัดส่ง
            </label>
            <div className="relative">
              <textarea
                rows={2}
                placeholder="เลขที่ อาคาร ถนน ซอย ตำบล/แขวง อำเภอ/เขต จังหวัด และจุดสังเกต..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* 4. Maps / Location Link */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">
                ลิ้งก์โลเคชั่น (Google Maps Link)
              </label>
              <button
                type="button"
                onClick={handleCaptureGPS}
                disabled={isLocating}
                className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Navigation className={`w-3 h-3 ${isLocating ? 'animate-spin' : ''}`} />
                <span>{isLocating ? 'กำลังค้นหาพิกัด...' : 'จับพิกัดปัจจุบัน (GPS)'}</span>
              </button>
            </div>
            <div className="relative">
              <input
                type="url"
                placeholder="เช่น https://maps.app.goo.gl/... หรือ https://maps.google.com/?q=..."
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                className="w-full pl-9 pr-16 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
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
                  <span>ทดสอบ</span>
                </a>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              สามารถวางลิ้งก์จาก Google Maps หรือกดปุ่ม &quot;จับพิกัดปัจจุบัน&quot; เพื่อสร้างลิ้งก์อัตโนมัติ
            </p>
          </div>

          {/* Sheets Integration Notice */}
          <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold">บันทึกลง Google Sheets ทันที</p>
              <p className="text-[11px] text-blue-800">
                ข้อมูลทั้งหมด (ชื่อ, เบอร์โทร, ที่อยู่, สายการเข้าเยี่ยม, ลิ้งโลเคชั่น) จะถูกบันทึกหรืออัปเดตลงในแท็บ <strong>ข้อมูลลูกค้า (Customers)</strong>
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>กำลังบันทึกลง Sheets...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>บันทึกลง Google Sheets</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
