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
} from 'lucide-react';
import { Customer, StaffUser, Route } from '../types';

interface CustomerManagementViewProps {
  customers: Customer[];
  currentUser: StaffUser;
  routes: Route[];
  onManageRoutes: () => void;
  onSaveCustomer: (customer: {
    name: string;
    phone: string;
    address: string;
    mapsUrl: string;
    routeName?: string;
  }) => Promise<boolean>;
  onRefreshCustomers: () => Promise<void>;
  onOpenOrderForCustomer: (customer: Customer) => void;
  sheetsConnected: boolean;
}

export const CustomerManagementView: React.FC<CustomerManagementViewProps> = ({
  customers,
  currentUser,
  routes,
  onManageRoutes,
  onSaveCustomer,
  onRefreshCustomers,
  onOpenOrderForCustomer,
  sheetsConnected,
}) => {
  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [routeName, setRouteName] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');

  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [visibleCustomerCount, setVisibleCustomerCount] = useState<number>(25);

  useEffect(() => {
    setVisibleCustomerCount(25);
  }, [searchQuery]);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    if (!customers || customers.length === 0) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        String(c?.name || '').toLowerCase().includes(q) ||
        String(c?.phone || '').replace(/[^0-9]/g, '').includes(q.replace(/[^0-9]/g, '')) ||
        String(c?.address || '').toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

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

  // Submit New Customer
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
        setSuccessMsg(`บันทึกลูกค้า "${cleanName}" ลง Google Sheets สำเร็จแล้ว!`);
        // Reset form
        setName('');
        setPhone('');
        setAddress('');
        setRouteName('');
        setMapsUrl('');
      } else {
        setErrorMsg('ไม่สามารถบันทึกลง Google Sheets ได้ กรุณาตรวจสอบการเชื่อมต่อ');
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

  // Fill form with existing customer to edit or reuse
  const handleEditClick = (c: Customer) => {
    setName(String(c.name || ''));
    setPhone(String(c.phone || ''));
    setAddress(String(c.address || ''));
    setRouteName(String(c.routeName || ''));
    setMapsUrl(String(c.mapsUrl || ''));
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
                <h3 className="font-bold text-sm sm:text-base">ฟอร์มเพิ่มลูกค้าใหม่</h3>
              </div>
              <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-medium">
                4 ข้อมูลหลัก
              </span>
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
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  สายการเข้าเยี่ยม
                </label>
                <div className="relative">
                  <select
                    value={routeName}
                    onChange={(e) => setRouteName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-2xs appearance-none"
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
                    rows={3}
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
                <p className="text-[11px] text-slate-500 mt-1">
                  เมื่อกรอกลิ้งก์ พนักงานส่งน้ำสามารถกดเปิดนำทางด้วย Google Maps ได้ทันที
                </p>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-sm shadow-md shadow-blue-600/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>กำลังบันทึกลง Google Sheets...</span>
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

        {/* Right Column: Customer Database Directory */}
        <div className="lg:col-span-7 space-y-4">
          {/* Search and Counts Header */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center justify-between gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800 text-sm">
                  รายชื่อลูกค้าทั้งหมด ({filteredCustomers.length} ราย)
                </h3>
              </div>
              <button
                  type="button"
                  onClick={onManageRoutes}
                  className="sm:hidden inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors cursor-pointer"
                >
                  <Navigation className="w-3 h-3" />
                  <span>สายการเข้าเยี่ยม</span>
                </button>
                <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                title="รีเฟรชข้อมูลลูกค้าจาก Google Sheets"
                className="sm:hidden inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>รีเฟรช</span>
              </button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto flex-1 sm:justify-end">
              <div className="relative flex-1 sm:max-w-xs">
                <input
                  type="text"
                  placeholder="ค้นหาชื่อ, เบอร์โทร, หรือที่อยู่..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              </div>

              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                title="รีเฟรชข้อมูลลูกค้าจาก Google Sheets"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'กำลังดึง...' : 'รีเฟรช Sheets'}</span>
              </button>
            </div>
          </div>

          {/* Customer Cards List */}
          {filteredCustomers.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-200/80 shadow-xs text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-3">
                <Users className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-700">ไม่พบรายชื่อลูกค้า</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? 'ไม่พบข้อมูลที่ตรงกับคำค้นหา ลองเปลี่ยนคำค้นหาใหม่อีกครั้ง'
                  : 'ยังไม่มีข้อมูลลูกค้าในระบบ สามารถกรอกฟอร์มด้านซ้ายเพื่อบันทึกลูกค้าคนแรกลง Google Sheets'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCustomers.slice(0, visibleCustomerCount).map((cust, idx) => (
                <div
                  key={cust.id || cust?.name + cust.phone + idx}
                  className="content-auto bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:border-blue-300 transition-all group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    {/* Left: Customer Info */}
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">
                          {cust?.name}
                        </span>
                        {cust.routeName && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
                            {cust.routeName}
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
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>เปิด Google Maps โลเคชั่น</span>
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
                    <div className="flex items-center gap-2 sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEditClick(cust)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-blue-700 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-xl transition-colors cursor-pointer"
                        title="นำข้อมูลไปแก้ไขในฟอร์ม"
                      >
                        แก้ไข
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenOrderForCustomer(cust)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                        title="เปิดฟอร์มลงออเดอร์ให้ลูกค้ารายนี้ทันที"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>เปิดออเดอร์</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}

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
