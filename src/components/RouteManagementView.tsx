import React, { useState } from 'react';
import { Route } from '../types';
import { Navigation, Plus, Save, Trash2, X, RefreshCw } from 'lucide-react';

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
                <span>จัดการสายการเข้าเยี่ยม (Routes)</span>
              </h3>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 bg-slate-50">
          
          {/* Add/Edit Form */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 mb-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-3">
              {editingRoute?.id && routes.some(r => r.id === editingRoute.id) ? 'แก้ไขสายการเข้าเยี่ยม' : 'เพิ่มสายการเข้าเยี่ยมใหม่'}
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">รหัสสาย *</label>
                <input 
                  type="text" 
                  value={editingRoute?.id || ''} 
                  onChange={e => setEditingRoute({ ...editingRoute, id: e.target.value })}
                  placeholder="เช่น R01, สายเหนือ"
                  disabled={routes.some(r => r.id === editingRoute?.id)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">ชื่อสาย *</label>
                <input 
                  type="text" 
                  value={editingRoute?.name || ''} 
                  onChange={e => setEditingRoute({ ...editingRoute, name: e.target.value })}
                  placeholder="เช่น สายเหนือ (โซน 1)"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">พนักงานขาย</label>
                <input 
                  type="text" 
                  value={editingRoute?.salesrepName || ''} 
                  onChange={e => setEditingRoute({ ...editingRoute, salesrepName: e.target.value })}
                  placeholder="ชื่อพนักงาน"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">หมายเหตุ</label>
                <input 
                  type="text" 
                  value={editingRoute?.notes || ''} 
                  onChange={e => setEditingRoute({ ...editingRoute, notes: e.target.value })}
                  placeholder="เพิ่มเติม..."
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setEditingRoute(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                เคลียร์
              </button>
              <button 
                onClick={handleSave}
                disabled={!editingRoute?.id || !editingRoute?.name || isProcessing}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                บันทึก
              </button>
            </div>
          </div>

          {/* List */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">รหัสสาย</th>
                  <th className="px-4 py-3 font-medium">ชื่อสาย</th>
                  <th className="px-4 py-3 font-medium">คนขับ</th>
                  <th className="px-4 py-3 font-medium text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {routes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500 text-sm">
                      ยังไม่มีข้อมูลสายการเข้าเยี่ยม
                    </td>
                  </tr>
                ) : (
                  routes.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-700">{r.id}</td>
                      <td className="px-4 py-3">{r.name}</td>
                      <td className="px-4 py-3 text-slate-500">{r.salesrepName || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <button 
                          onClick={() => setEditingRoute(r)}
                          className="text-blue-600 hover:text-blue-800 font-medium text-xs px-2"
                        >
                          แก้ไข
                        </button>
                        <button 
                          onClick={() => {
                            if(window.confirm('ยืนยันการลบสายการเข้าเยี่ยมนี้?')) onDeleteRoute(r.id);
                          }}
                          className="text-rose-600 hover:text-rose-800 font-medium text-xs px-2"
                        >
                          ลบ
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
