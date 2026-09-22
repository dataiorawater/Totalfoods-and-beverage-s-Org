import React, { useState, useEffect } from 'react';
import { Order, StaffUser, StoreCheckIn } from '../types';
import { exportOrdersToExcel, exportCheckInsToExcel } from '../services/excelExport';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  User,
  CheckCircle2,
  Table,
  MapPin,
  Filter
} from 'lucide-react';

interface ExportReportViewProps {
  orders: Order[];
  staffList: StaffUser[];
  checkIns: StoreCheckIn[];
}

export const ExportReportView: React.FC<ExportReportViewProps> = ({
  orders,
  staffList,
  checkIns,
}) => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'sales' | 'checkin'>('sales');

  const uniqueMonths = Array.from(new Set(orders.map((o) => o.createdAt.slice(0, 7)))).sort().reverse();
  if (!uniqueMonths.includes(currentMonth)) uniqueMonths.unshift(currentMonth);

  const handleExportSales = () => {
    exportOrdersToExcel(orders, {
      month: selectedMonth,
      salespersonId: selectedSalesperson,
      status: 'all',
    });
  };

  const handleExportCheckIns = () => {
    exportCheckInsToExcel(checkIns, {
      month: selectedMonth,
      salespersonId: selectedSalesperson,
      status: 'all',
    });
  };

  let salesCount = 0;
  let checkinCount = 0;

  if (activeTab === 'sales') {
    let filteredOrders = orders;
    if (selectedMonth !== 'all') {
      filteredOrders = filteredOrders.filter(o => o.createdAt.startsWith(selectedMonth));
    }
    if (selectedSalesperson !== 'all') {
      filteredOrders = filteredOrders.filter(o => o.salespersonId === selectedSalesperson);
    }
    salesCount = filteredOrders.length;
  } else {
    let filteredCheckIns = checkIns;
    if (selectedMonth !== 'all') {
      filteredCheckIns = filteredCheckIns.filter(c => c.createdAt.startsWith(selectedMonth));
    }
    if (selectedSalesperson !== 'all') {
      const spName = staffList.find(s => s.id === selectedSalesperson)?.name;
      if (spName) {
        filteredCheckIns = filteredCheckIns.filter(c => c.salespersonName === spName);
      }
    }
    checkinCount = filteredCheckIns.length;
  }

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
            onClick={() => setActiveTab('sales')}
            className={`pb-3 px-1 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 \${
              activeTab === 'sales'
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Table className="w-4 h-4" />
            <span>สรุปยอดขาย</span>
          </button>
          <button
            onClick={() => setActiveTab('checkin')}
            className={`pb-3 px-1 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 \${
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
            </p>
            
            <button
              onClick={activeTab === 'sales' ? handleExportSales : handleExportCheckIns}
              disabled={(activeTab === 'sales' ? salesCount : checkinCount) === 0}
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-sm"
            >
              <Download className="w-5 h-5" />
              <span>
                {activeTab === 'sales' ? 'ดาวน์โหลดไฟล์ Excel (.xlsx)' : 'ดาวน์โหลดรายงานเช็คอิน (.xlsx)'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
