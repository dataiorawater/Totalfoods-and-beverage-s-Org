import React, { useState, useEffect } from 'react';
import { StaffUser } from '../types';
import { Mail, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { TotalEmblem } from './TotalLogo';

interface LoginScreenProps {
  staffList: StaffUser[];
  onLoginAttempt: (email: string, pass: string) => Promise<{success: boolean, message?: string}>;
  onUpdatePassword?: (email: string, newPassword: string) => Promise<boolean>;
  sheetsConnected: boolean;
  isLoadingData: boolean;
  onLoginComplete: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  staffList,
  onLoginAttempt,
  onUpdatePassword,
  sheetsConnected,
  isLoadingData,
  onLoginComplete,
}) => {
    const [activeMode, setActiveMode] = useState<'signin' | 'forgot_password'>('signin');
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  useEffect(() => {
    if (showSuccessPopup && !isLoadingData) {
      // Complete instantly
      onLoginComplete();
    }
  }, [showSuccessPopup, isLoadingData, onLoginComplete]);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('กรุณากรอกอีเมล');
      return;
    }
    
    setIsSaving(true);
    const res = await onLoginAttempt(cleanEmail, passwordInput);
    setIsSaving(false);
    
    if (res.success) {
      setShowSuccessPopup(true);
    } else {
      setErrorMessage(res.message || 'รหัสผ่านไม่ถูกต้อง');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('กรุณากรอกอีเมล');
      return;
    }
    if (passwordInput.length < 4) {
      setErrorMessage('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร');
      return;
    }

    setIsSaving(true);
    try {
      // Find user to ensure they exist
      const userExists = staffList.find(u => String(u?.email || '').trim().toLowerCase() === cleanEmail);
      if (!userExists) {
        setErrorMessage('ไม่พบอีเมลนี้ในระบบ');
        setIsSaving(false);
        return;
      }

      if (onUpdatePassword) {
        const success = await onUpdatePassword(cleanEmail, passwordInput);
        if (success) {
          setSuccessMessage('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่');
          setPasswordInput('');
          setTimeout(() => setActiveMode('signin'), 2000);
        } else {
          setErrorMessage('ไม่สามารถบันทึกรหัสผ่านใหม่ได้');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col my-auto relative">
        {/* Success Popup */}
        {showSuccessPopup && (
          <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6 shadow-inner relative">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 absolute animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite]" />
              <CheckCircle2 className="w-10 h-10 text-emerald-600 relative z-10" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">เข้าสู่ระบบสำเร็จ</h2>
            <div className="flex flex-col items-center gap-2 mt-4 text-slate-500">
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium">กำลังโหลดข้อมูลระบบ...</span>
            </div>
          </div>
        )}
        
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 p-5 sm:p-6 text-white text-center relative">
          <div className="w-16 h-16 sm:w-18 sm:h-18 mx-auto rounded-3xl bg-white flex items-center justify-center p-1.5 mb-3 shadow-lg shadow-blue-950/30 border border-white/40">
            <TotalEmblem className="w-full h-full drop-shadow-xs" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">TOTAL</h1>
          <p className="text-blue-100 text-xs font-semibold tracking-wider mt-0.5 uppercase">
            Foods & Beverage
          </p>
          <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-900/60 border border-blue-400/30 text-[10px] sm:text-[11px] text-blue-200">
            <Lock className="w-3 h-3" />
            <span>เข้าสู่ระบบตามระดับสิทธิ์</span>
          </div>
        </div>
        <div className="p-5 sm:p-6 bg-white">
          {errorMessage && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}
          {successMessage && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{successMessage}</div>
            </div>
          )}

          {activeMode === 'forgot_password' ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
               <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">อีเมลผู้ใช้งาน</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                    placeholder="อีเมลที่ลงทะเบียนไว้"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ตั้งรหัสผ่านใหม่</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                    placeholder="รหัสผ่านใหม่อย่างน้อย 4 ตัว"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold text-sm transition-colors shadow-sm"
              >
                {isSaving ? 'กำลังดำเนินการ...' : 'ยืนยันเปลี่ยนรหัสผ่าน'}
              </button>
              <div className="text-center mt-3">
                <button
                  type="button"
                  onClick={() => { setActiveMode('signin'); setErrorMessage(null); setSuccessMessage(null); setPasswordInput(''); }}
                  className="text-xs text-slate-500 hover:text-slate-700 font-medium transition-colors"
                >
                  กลับไปหน้าเข้าสู่ระบบ
                </button>
              </div>
            </form>
          ) : activeMode === 'signin' ? (
            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">อีเมลผู้ใช้งาน</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                    placeholder="อีเมลพนักงาน"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">รหัสผ่าน</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                    placeholder="รหัสผ่าน"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors shadow-sm"
              >
                เข้าสู่ระบบ
              </button>
              <div className="flex justify-center mt-3">
                <button
                  type="button"
                  onClick={() => { setActiveMode('forgot_password'); setErrorMessage(null); setSuccessMessage(null); setPasswordInput(''); }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  ลืมรหัสผ่าน? (ขอเปลี่ยนรหัสผ่านใหม่)
                </button>
              </div>
            </form>
          ) : null}

          {!sheetsConnected && (
            <div className="mt-4 text-center">
              <span className="text-xs text-rose-500 font-medium">⚠️ ไม่สามารถเชื่อมต่อฐานข้อมูลได้</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
