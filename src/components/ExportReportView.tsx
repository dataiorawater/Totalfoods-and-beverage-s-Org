import React, { useState, useMemo } from 'react';
import { Customer, Order, StaffUser, StoreCheckIn } from '../types';
import { exportOrdersToExcel, exportCheckInsToExcel } from '../services/excelExport';
import { calculateDistanceMeters, extractCustomerCoords, formatDistance } from '../utils/geoUtils';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  User,
  Table,
  MapPin,
  Filter,
  Navigation
} from 'lucide-react';

interface ExportReportViewProps {
  orders: Order[];
  staffList: StaffUser[];
  checkIns: StoreCheckIn[];
  customers?: Customer[];
}

export const ExportReportView: React.FC<ExportReportViewProps> = ({
  orders,
  staffList,
  checkIns,
  customers = [],
}) => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'sales' | 'checkin'>('sales');

  const uniqueMonths = useMemo(() => {
    const monthSet = new Set<string>([currentMonth]);
    orders.forEach((o) => {
      if (o.createdAt) monthSet.add(o.createdAt.slice(0, 7));
    });
    checkIns.forEach((c) => {
      if (c.createdAt) monthSet.add(c.createdAt.slice(0, 7));
    });
    return Array.from(monthSet).sort().reverse();
  }, [orders, checkIns, currentMonth]);

  const selectedSalespersonName = useMemo(() => {
    if (selectedSalesperson === 'all') return undefined;
    return staffList.find((s) => s.id === selectedSalesperson)?.name;
  }, [staffList, selectedSalesperson]);

  const filteredOrders = useMemo(() => {
    let list = orders;
    if (selectedMonth !== 'all') {
      list = list.filter((o) => String(o.createdAt || '').startsWith(selectedMonth));
    }
    if (selectedSalesperson !== 'all') {
      list = list.filter((o) => o.salespersonId === selectedSalesperson);
    }
    return list;
  }, [orders, selectedMonth, selectedSalesperson]);

  const filteredCheckIns = useMemo(() => {
    let list = checkIns;
    if (selectedMonth !== 'all') {
      list = list.filter((c) => String(c.createdAt || '').startsWith(selectedMonth));
    }
    if (selectedSalesperson !== 'all') {
      const targetName = selectedSalespersonName?.trim().toLowerCase();
      list = list.filter((c) => {
        if (c.salespersonId && c.salespersonId === selectedSalesperson) return true;
        if (targetName && String(c.salespersonName || '').trim().toLowerCase() === targetName) return true;
        return false;
      });
    }
    return list;
  }, [checkIns, selectedMonth, selectedSalesperson, selectedSalespersonName]);

  const resolveDistanceMeters = (c: StoreCheckIn): number | undefined => {
    if (c.distanceMeters !== undefined && c.distanceMeters !== null && !isNaN(Number(c.distanceMeters))) {
      return Math.round(Number(c.distanceMeters));
    }
    if (c.latitude && c.longitude && customers.length > 0) {
      const storeKey = String(c.storeName || c.customerName || '').trim().toLowerCase();
      const matchedCust = customers.find(
        (cust) =>
          (c.customerId && cust.id === c.customerId) ||
          (storeKey && String(cust.name || '').trim().toLowerCase() === storeKey)
      );
      if (matchedCust) {
        const coords = extractCustomerCoords(matchedCust);
        if (coords) {
          return calculateDistanceMeters(c.latitude, c.longitude, coords.lat, coords.lng);
        }
      }
    }
    return undefined;
  };

  const handleExportSales = () => {
    exportOrdersToExcel(orders, {
      month: selectedMonth,
      salespersonId: selectedSalesperson,
      status: 'all',
    });
  };

  const handleExportCheckIns = () => {
    exportCheckInsToExcel(
      checkIns,
      {
        month: selectedMonth,
        salespersonId: selectedSalesperson,
        salespersonName: selectedSalespersonName,
        status: 'all',
      },
      customers
    );
  };

  const salesCount = filteredOrders.length;
  const checkinCount = filteredCheckIns.length;

  return (
    <div className="w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 text-green-700 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800">
                ส่งออกรายงาน (Export)
              </h3>
              <p className="text-xs text-slate-500">
                ส่งออกข้อมูลสรุปยอดขายและการเช็คอินเป็นไฟล์ Excel
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-4 sm:px-6 pt-4 border-b border-slate-100 gap-4 bg-slate-50/50">
          <button
            type="button"
            onClick={() => setActiveTab('sales')}
            className={`pb-3 px-1 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'sales'
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Table className="w-4 h-4" />
            <span>สรุปยอดขาย</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('checkin')}
            className={`pb-3 px-1 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'checkin'
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>สรุปรายการเช็คอิน</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-6">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Filter className="w-4 h-4 text-blue-500" />
              ตัวกรองข้อมูล
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  ประจำเดือน
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-green-500"
                >
                  <option value="all">ทุกเดือนทั้งหมด</option>
                  {uniqueMonths.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  พนักงานขาย (เซลล์)
                </label>
                <select
                  value={selectedSalesperson}
                  onChange={(e) => setSelectedSalesperson(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-green-500"
                >
                  <option value="all">ดูผลงานรวมเซลล์ทุกคน</option>
                  {staffList
                    .filter((s) => s.role === 'sales')
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-green-50 p-5 rounded-xl border border-green-100 text-center space-y-2">
            <h4 className="text-lg font-bold text-green-800">
              {activeTab === 'sales' ? 'พร้อมส่งออกรายงานยอดขาย' : 'พร้อมส่งออกรายงานเช็คอิน'}
            </h4>
            <p className="text-sm text-green-700 pb-3">
              พบข้อมูลที่ตรงกับเงื่อนไขจำนวน <strong className="text-green-900">{activeTab === 'sales' ? salesCount : checkinCount}</strong> รายการ
              {activeTab === 'checkin' && (
                <span className="block text-xs text-green-600 mt-1">
                  รวมข้อมูลวันที่ เวลา ชื่อร้านค้า พนักงานขาย พิกัด และระยะห่างจากจุดร้านค้า (เมตร / กม.)
                </span>
              )}
            </p>
            
            <button
              type="button"
              onClick={activeTab === 'sales' ? handleExportSales : handleExportCheckIns}
              disabled={(activeTab === 'sales' ? salesCount : checkinCount) === 0}
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-sm cursor-pointer"
            >
              <Download className="w-5 h-5" />
              <span>
                {activeTab === 'sales' ? 'ดาวน์โหลดไฟล์ Excel (.xlsx)' : 'ดาวน์โหลดรายงานเช็คอิน (.xlsx)'}
              </span>
            </button>
          </div>

          {/* Check-in Preview Table with Distance */}
          {activeTab === 'checkin' && filteredCheckIns.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-blue-600" />
                  <span>ตัวอย่างข้อมูลรายการเช็คอิน ({Math.min(filteredCheckIns.length, 15)} จาก {filteredCheckIns.length} รายการ)</span>
                </span>
                <span className="text-[11px] font-normal text-slate-500">แสดงระยะห่างจากจุดร้านค้า</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/70 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 font-semibold">#</th>
                      <th className="px-3 py-2 font-semibold">วัน-เวลา</th>
                      <th className="px-3 py-2 font-semibold">พนักงานขาย</th>
                      <th className="px-3 py-2 font-semibold">ร้านค้า</th>
                      <th className="px-3 py-2 font-semibold text-right">ระยะห่างจุดเช็คอิน</th>
                      <th className="px-3 py-2 font-semibold">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCheckIns.slice(0, 15).map((item, idx) => {
                      const d = new Date(item.createdAt);
                      const dateTimeLabel = !isNaN(d.getTime())
                        ? `${d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })} ${d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`
                        : item.timestampStr || '-';
                      const distMeters = resolveDistanceMeters(item);

                      return (
                        <tr key={item.id + '-' + idx} className="hover:bg-slate-50/70">
                          <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-2 whitespace-nowrap font-mono text-[11px] text-slate-600">{dateTimeLabel}</td>
                          <td className="px-3 py-2 font-medium text-slate-700">{item.salespersonName || '-'}</td>
                          <td className="px-3 py-2 font-semibold text-slate-900">{item.storeName || item.customerName || '-'}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {distMeters !== undefined ? (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                  distMeters <= 150
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : distMeters <= 1000
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {formatDistance(distMeters)} ({distMeters} ม.)
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-500 max-w-[180px] truncate">{item.notes || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
