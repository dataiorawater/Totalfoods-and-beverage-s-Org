import React, { useState } from 'react';
import { StaffUser, StaffRole, SheetsConfig } from '../types';
import {
  Users,
  UserPlus,
  Shield,
  Briefcase,
  Truck,
  Eye,
  CheckCircle2,
  X,
  Edit2,
  RefreshCw,
  Phone,
  Mail,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { saveUserToSheet, fetchUsersFromSheets, USERS_TAB_NAME } from '../services/googleSheets';

interface UserManagementViewProps {
  staffList: StaffUser[];
  onUpdateStaffList: (users: StaffUser[]) => void;
  currentUser: StaffUser;
  sheetsConfig: SheetsConfig;
  onShowToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  staffList,
  onUpdateStaffList,
  currentUser,
  sheetsConfig,
  onShowToast,
}) => {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Form states
  const [formEmail, setFormEmail] = useState('');
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState<StaffRole>('sales');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');


  const roleDescriptions: Record<StaffRole, { title: string; desc: string; icon: any; color: string }> = {
    admin: {
      title: 'ผู้ดูแลระบบสูงสุด (Admin)',
      desc: 'สิทธิ์เต็มทุกฟังก์ชัน: จัดการผู้ใช้งาน, จัดการสินค้า, เชื่อมต่อ Sheets & LINE, ดูและแก้ไขออเดอร์ทั้งหมด',
      icon: Shield,
      color: 'bg-purple-100 text-purple-800 border-purple-200',
    },
    manager: {
      title: 'ผู้จัดการฝ่ายขาย (Manager)',
      desc: 'ดูออเดอร์ของเซลล์ทุกคน, ดูแดชบอร์ดภาพรวมบริษัท, อัปเดตสถานะออเดอร์, ส่งออกรายงาน Excel ได้',
      icon: Briefcase,
      color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    },
    sales: {
      title: 'พนักงานขาย (Sales)',
      desc: 'ลงออเดอร์ใหม่รวดเร็ว, ดูเฉพาะออเดอร์และยอดขายของตนเอง, ส่งออก Excel เฉพาะส่วนของตนเอง',
      icon: Briefcase,
      color: 'bg-blue-100 text-blue-800 border-blue-200',
    },
    delivery: {
      title: 'ทีมจัดส่ง / พนักงานขาย (Delivery)',
      desc: 'ดูเฉพาะรายการที่ต้องจัดส่ง, ดูเบอร์โทรลูกค้าและกดโทรออก, กดปุ่ม Google Maps นำทาง, อัปเดตสถานะจัดส่ง',
      icon: Truck,
      color: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    viewer: {
      title: 'ผู้ตรวจสอบ / บัญชี (Viewer)',
      desc: 'ดูรายการออเดอร์และสรุปยอดขายทั้งหมด (อ่านอย่างเดียว ไม่สามารถแก้ไขหรือลงออเดอร์ได้)',
      icon: Eye,
      color: 'bg-slate-100 text-slate-700 border-slate-200',
    },
  };

  const handleStartAdd = () => {
    setEditingUser(null);
    setFormEmail('');
    setFormName('');
    setFormRole('sales');
    setFormPhone('');
    setFormPassword('');
    setFormStatus('active');
    setIsAddingNew(true);
  };

  const handleStartEdit = (user: StaffUser) => {
    setEditingUser(user);
    setFormEmail(user.email);
    setFormName(user.name);
    setFormRole(user.role);
    setFormPhone(user.phone || '');
    setFormPassword(user.password || '');
    setFormStatus(user.status || 'active');
    setIsAddingNew(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = formEmail.trim().toLowerCase();
    if (!cleanEmail) {
      onShowToast('error', 'ข้อมูลไม่ถูกต้อง', 'กรุณาระบุอีเมล');
      return;
    }
    if (!formName.trim()) {
      onShowToast('error', 'ข้อมูลไม่ถูกต้อง', 'กรุณาระบุชื่อ-นามสกุล');
      return;
    }

    const isEdit = !!editingUser;
    const userToSave: StaffUser = {
      id: isEdit ? editingUser.id : `staff-${Date.now()}`,
      email: cleanEmail,
      name: formName.trim(),
      role: formRole,
      phone: formPhone.trim(),
      password: formPassword.trim() || (isEdit ? editingUser.password : undefined),
      status: formStatus,
      avatar: isEdit ? editingUser.avatar : undefined,
      createdAt: isEdit ? editingUser.createdAt : new Date().toISOString(),
      lastLogin: isEdit ? editingUser.lastLogin : undefined,
    };

    let updatedList: StaffUser[];
    if (isEdit) {
      updatedList = staffList.map((u) => (u.id === userToSave.id ? userToSave : u));
    } else {
      // Check duplicate email
      if (staffList.some((u) => u.email.toLowerCase() === cleanEmail)) {
        onShowToast('error', 'อีเมลซ้ำ', `อีเมล ${cleanEmail} มีอยู่ในระบบแล้ว`);
        return;
      }
      updatedList = [...staffList, userToSave];
    }

    onUpdateStaffList(updatedList);
    setIsAddingNew(false);
    setEditingUser(null);

    onShowToast(
      'success',
      isEdit ? 'แก้ไขผู้ใช้งานสำเร็จ' : 'เพิ่มผู้ใช้งานสำเร็จ',
      `${userToSave.name} (${userToSave.role})`
    );

    // Sync to Google Sheet if connected
    if (sheetsConfig?.spreadsheetId) {
      setIsSyncing(true);
      try {
        await saveUserToSheet(sheetsConfig.spreadsheetId, userToSave);
        onShowToast(
          'success',
          'บันทึกลง Google Sheet แล้ว',
          `อัปเดตลงแท็บ "${USERS_TAB_NAME}" บน Google Sheet เรียบร้อย`
        );
      } catch (err: any) {
        console.warn('Sync user to sheet failed:', err);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  // Sync / Refresh users from Google Sheet
  const handleRefreshFromSheet = async () => {
    if (!sheetsConfig?.spreadsheetId) {
      onShowToast('info', 'ยังไม่ได้เชื่อมต่อ Sheets', 'กรุณาเชื่อมต่อ Google Sheets ในหน้าตั้งค่า');
      return;
    }

    setIsSyncing(true);
    try {
      const fetched = await fetchUsersFromSheets(sheetsConfig.spreadsheetId);
      if (fetched && fetched.length > 0) {
        onUpdateStaffList(fetched);
        onShowToast(
          'success',
          'ซิงค์ผู้ใช้งานสำเร็จ',
          `ดึงข้อมูลผู้ใช้จาก Google Sheet มาได้ ${fetched.length} รายการ`
        );
      } else {
        onShowToast('info', 'ไม่พบข้อมูลใหม่', 'ข้อมูลบน Google Sheet ตรงกับระบบแล้ว');
      }
    } catch (e: any) {
      onShowToast('error', 'เกิดข้อผิดพลาด', e.message || 'ไม่สามารถดึงข้อมูลจาก Sheets ได้');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div
        id="user-mgmt-card"
        className="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                <span>จัดการผู้ใช้งานและระดับสิทธิ์</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800">
                  {staffList.length} ผู้ใช้
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                กำหนดสิทธิ์ตาม Email และบันทึกข้อมูลบน Google Sheets แท็บเดียวกัน
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {sheetsConfig?.spreadsheetId && (
              <button
                id="btn-sync-users-from-sheet"
                onClick={handleRefreshFromSheet}
                disabled={isSyncing}
                title="ดึงข้อมูลผู้ใช้ล่าสุดจาก Google Sheets"
                className="p-2 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 text-blue-600 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">ซิงค์จาก Sheets</span>
              </button>
            )}

            <button
              id="btn-open-add-user"
              onClick={handleStartAdd}
              className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>เพิ่มผู้ใช้ใหม่</span>
            </button>


          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Add / Edit Form Drawer */}
          {isAddingNew && (
            <form
              onSubmit={handleSaveUser}
              className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 animate-in fade-in"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-blue-600" />
                  <span>{editingUser ? 'แก้ไขข้อมูลผู้ใช้งาน' : 'เพิ่มผู้ใช้งานใหม่เข้าสู่ระบบ'}</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    อีเมล (สำหรับใช้ Login Google / Email) *
                  </label>
                  <input
                    id="input-user-email"
                    type="email"
                    required
                    placeholder="เช่น somchai@iorawater.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อ-นามสกุล (แสดงในระบบและบิลออเดอร์) *
                  </label>
                  <input
                    id="input-user-name"
                    type="text"
                    required
                    placeholder="เช่น สมชาย ใจดี"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ระดับสิทธิ์การใช้งาน (Role) *
                  </label>
                  <select
                    id="select-user-role"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as StaffRole)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 bg-white font-medium"
                  >
                    <option value="admin">ผู้ดูแลระบบสูงสุด (Admin)</option>
                    <option value="manager">ผู้จัดการฝ่ายขาย (Manager)</option>
                    <option value="sales">พนักงานขาย / เซลล์ (Sales)</option>
                    <option value="delivery">ทีมจัดส่ง / พนักงานขาย (Delivery)</option>
                    <option value="viewer">ผู้ตรวจสอบ / บัญชี (Viewer - อ่านอย่างเดียว)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    เบอร์โทรศัพท์ติดต่อ
                  </label>
                  <input
                    id="input-user-phone"
                    type="tel"
                    placeholder="เช่น 081-234-5678"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>รหัสผ่านเข้าใช้งาน (Password)</span>
                    <span className="text-[10px] text-slate-400 font-normal">เว้นว่างได้ถ้าไม่ต้องการ</span>
                  </label>
                  <input
                    id="input-user-password"
                    type="text"
                    placeholder="เช่น 1234 หรือรหัสเฉพาะบุคคล"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 bg-white font-mono"
                  />
                </div>
              </div>

              {/* Role detail badge helper */}
              <div className="p-3 rounded-xl bg-white border border-slate-200/80 text-xs">
                <div className="font-semibold text-slate-800 flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span>คำอธิบายสิทธิ์: {roleDescriptions[formRole].title}</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  {roleDescriptions[formRole].desc}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-100 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  id="btn-save-user-submit"
                  type="submit"
                  disabled={isSyncing}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingUser ? 'บันทึกการแก้ไข' : 'บันทึกและซิงค์ลง Google Sheet'}</span>
                </button>
              </div>
            </form>
          )}

          {/* User Table / Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>รายชื่อผู้ใช้งานทั้งหมดในระบบ ({staffList.length})</span>
              <span className="text-[11px] text-slate-400">
                แท็บใน Google Sheets: "{USERS_TAB_NAME}"
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {staffList.map((user) => {
                const isCurrent = user.id === currentUser.id;
                const roleInfo = roleDescriptions[user.role] || roleDescriptions.sales;
                const RoleIcon = roleInfo.icon;

                return (
                  <div
                    key={user.id}
                    id={`user-item-${user.id}`}
                    className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isCurrent
                        ? 'border-blue-500 bg-blue-50/30 ring-1 ring-blue-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.name}
                          loading="lazy"
                          decoding="async"
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center shrink-0">
                          {user.name.charAt(0)}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900 truncate">
                            {user.name}
                          </span>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                              (คุณกำลังใช้งาน)
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${roleInfo.color}`}
                          >
                            <RoleIcon className="w-3 h-3" />
                            {roleInfo.title.split(' ')[0]}
                          </span>
                          {user.password ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              🔒 รหัสผ่าน: ••••
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] text-slate-400 bg-slate-50 border border-slate-200/60">
                              ยังไม่ตั้งรหัส
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                          <span className="flex items-center gap-1 text-slate-600 font-medium">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            {user.email}
                          </span>
                          {user.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              {user.phone}
                            </span>
                          )}
                          {user.lastLogin && (
                            <span className="flex items-center gap-1 text-[11px] text-slate-400">
                              <Calendar className="w-3 h-3" />
                              เข้าล่าสุด: {new Date(user.lastLogin).toLocaleDateString('th-TH')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        id={`btn-edit-user-${user.id}`}
                        onClick={() => handleStartEdit(user)}
                        className="p-2 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                        title="แก้ไขข้อมูลผู้ใช้และสิทธิ์"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>แก้ไข</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            <span>
              {sheetsConfig?.spreadsheetId
                ? `บันทึกแบบรวมศูนย์ใน Google Sheets เดียวกัน (${sheetsConfig.spreadsheetId.slice(0, 8)}...)`
                : 'ยังไม่ได้เชื่อมต่อ Google Sheets'}
            </span>
          </div>


        </div>
      </div>
    </div>
  );
};
