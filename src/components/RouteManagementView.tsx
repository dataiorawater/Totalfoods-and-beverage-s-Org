import React, { useState } from 'react';
import { Route } from '../types';
import { Navigation, Plus, Save, Trash2, X, RefreshCw, Calendar } from 'lucide-react';
import { THAI_DAYS, ThaiDay, THAI_DAY_COLORS } from '../utils/callPlanUtils';

interface RouteManagementViewProps {
  routes: Route[];
  onSaveRoute: (route: Route) => Promise<boolean>;
  onDeleteRoute: (routeId: string) => Promise<boolean>;
  isProcessing: boolean;
}

export const RouteManagementView: React.FC<RouteManagementViewProps> = ({
  routes,
  onSaveRoute,
  onDeleteRoute,
  isProcessing
}) => {
  const [editingRoute, setEditingRoute] = useState<Partial<Route> | null>(null);

  const handleToggleDay = (day: ThaiDay) => {
    const currentDays = (editingRoute?.visitDays || []) as ThaiDay[];
    let updatedDays: ThaiDay[];
    if (currentDays.includes(day)) {
      updatedDays = currentDays.filter(d => d !== day);
    } else {
      updatedDays = [...currentDays, day];
    }
    setEditingRoute({ ...editingRoute, visitDays: updatedDays });
  };

  const handleSave = async () => {
    if (!editingRoute?.id || !editingRoute?.name) return;
    const success = await onSaveRoute(editingRoute as Route);
    if (success) {
      setEditingRoute(null);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                <span>จัดการสายการเข้าเยี่ยมและ Call Plan (Routes)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                กำหนดรหัสสาย พนักงานขายประจำสาย และระบุวันในสัปดาห์ที่ต้องเข้าพบลูกค้า
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 bg-slate-50">
          
          {/* Add/Edit Form */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 mb-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>{editingRoute?.id && routes.some(r => r.id === editingRoute.id) ? 'แก้ไขสายการเข้าเยี่ยม' : 'เพิ่มสายการเข้าเยี่ยมใหม่'}</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">รหัสสาย (Route ID) *</label>
                <input 
                  type="text" 
                  value={editingRoute?.id || ''} 
                  onChange={e => setEditingRoute({ ...editingRoute, id: e.target.value })}
                  placeholder="เช่น S01-R01, R01"
                  disabled={routes.some(r => r.id === editingRoute?.id)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ชื่อสาย / โซน *</label>
                <input 
                  type="text" 
                  value={editingRoute?.name || ''} 
                  onChange={e => setEditingRoute({ ...editingRoute, name: e.target.value })}
                  placeholder="เช่น บางนา - กิ่งแก้ว, โซนเทพารักษ์"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">พนักงานขาย / ผู้รับผิดชอบ</label>
                <input 
                  type="text" 
                  value={editingRoute?.salesrepName || ''} 
                  onChange={e => setEditingRoute({ ...editingRoute, salesrepName: e.target.value })}
                  placeholder="เช่น เซลล์สมชาย (S01)"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">หมายเหตุ</label>
                <input 
                  type="text" 
                  value={editingRoute?.notes || ''} 
                  onChange={e => setEditingRoute({ ...editingRoute, notes: e.target.value })}
                  placeholder="เช่น ลูกค้าโรงงาน, ส่งเช้า"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
            </div>

            {/* Visit Days Selector */}
            <div className="mb-4 pt-2 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>วันเข้าเยี่ยมตามรอบ (Call Plan Days):</span>
                <span className="text-[11px] text-slate-400 font-normal">เลือกวันที่สายนี้ต้องเข้าพบลูกค้า</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {THAI_DAYS.map((day) => {
                  const isSelected = (editingRoute?.visitDays || []).includes(day);
                  const colors = THAI_DAY_COLORS[day];
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleToggleDay(day)}
                      className={`px-3 py-1 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? `${colors.bg} ${colors.text} ${colors.border} ring-2 ${colors.ring} shadow-xs font-bold`
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {isSelected ? '✓ ' : ''}{day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setEditingRoute(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                เคลียร์
              </button>
              <button 
                onClick={handleSave}
                disabled={!editingRoute?.id || !editingRoute?.name || isProcessing}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                บันทึกสาย
              </button>
            </div>
          </div>

          {/* List */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">รหัสสาย</th>
                  <th className="px-4 py-3 font-semibold">ชื่อสาย</th>
                  <th className="px-4 py-3 font-semibold">วันเข้าเยี่ยม (Call Plan)</th>
                  <th className="px-4 py-3 font-semibold">เซลล์ผู้ดูแล</th>
                  <th className="px-4 py-3 font-semibold text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {routes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">
                      ยังไม่มีข้อมูลสายการเข้าเยี่ยม
                    </td>
                  </tr>
                ) : (
                  routes.map(r => {
                    const days = r.visitDays || [];
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-800">{r.id}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{r.name}</div>
                          {r.notes && <div className="text-xs text-slate-400 mt-0.5">{r.notes}</div>}
                        </td>
                        <td className="px-4 py-3">
                          {days.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {days.map(d => (
                                <span key={d} className="inline-block px-1.5 py-0.5 text-[10px] font-semibold rounded bg-blue-50 text-blue-700 border border-blue-200">
                                  {d}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">- ไม่ได้ระบุวัน -</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs font-medium">{r.salesrepName || '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <button 
                            onClick={() => setEditingRoute(r)}
                            className="text-blue-600 hover:text-blue-800 font-semibold text-xs px-2 py-1 rounded hover:bg-blue-50 cursor-pointer"
                          >
                            แก้ไข
                          </button>
                          <button 
                            onClick={() => {
                              if(window.confirm(`ยืนยันการลบสาย "${r.name}" (${r.id})?`)) onDeleteRoute(r.id);
                            }}
                            className="text-rose-600 hover:text-rose-800 font-semibold text-xs px-2 py-1 rounded hover:bg-rose-50 cursor-pointer ml-1"
                          >
                            ลบ
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
