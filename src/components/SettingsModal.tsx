import React, { useState, useEffect } from 'react';
import { SheetsConfig, LineSettings, StaffUser } from '../types';
import { sendLineNotification } from '../services/lineNotify';
import { googleSignIn } from '../services/auth';
import { testGasConnection, fixAndAlignOrderHeaders, ORDER_HEADERS_CANONICAL } from '../services/googleSheets';
import { GOOGLE_APPS_SCRIPT_CODE } from '../data/gasScriptCode';
import {
  X,
  FileSpreadsheet,
  Bell,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Plus,
  Send,
  Loader2,
  Key,
  Shield,
  HelpCircle,
  LogOut,
  Database,
  User,
  Copy,
  Check,
  Activity,
  Code,
  ChevronDown,
  ChevronUp,
  Table,
  Sparkles,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  sheetsConfig: SheetsConfig;
  lineSettings: LineSettings;
  onUpdateSheetsConfig: (cfg: SheetsConfig) => void;
  onUpdateLineSettings: (settings: LineSettings) => void;
  onClose: () => void;
  
  
  onRefreshFromSheets: () => Promise<void>;
}

const ORDER_SCHEMA_COLS = [
  { col: 'A', id: 'orderNumber', thai: 'เลขที่ออเดอร์', desc: 'รหัสคำสั่งซื้อ เช่น ORD-202609-001' },
  { col: 'B', id: 'date', thai: 'วันที่', desc: 'วันที่สร้างออเดอร์ (YYYY-MM-DD)' },
  { col: 'C', id: 'time', thai: 'เวลา', desc: 'เวลาที่สร้าง (HH:mm)' },
  { col: 'D', id: 'salespersonId', thai: 'รหัสพนักงานขาย', desc: 'รหัสประจำตัวหรืออีเมลของเซลล์' },
  { col: 'E', id: 'salespersonName', thai: 'ชื่อพนักงานขาย', desc: 'ชื่อเซลล์ผู้เปิดออเดอร์' },
  { col: 'F', id: 'customerName', thai: 'ชื่อลูกค้า', desc: 'ชื่อร้านค้าหรือลูกค้า' },
  { col: 'G', id: 'customerPhone', thai: 'เบอร์ติดต่อ', desc: 'เบอร์โทรศัพท์ลูกค้า' },
  { col: 'H', id: 'requestedDeliveryDate', thai: 'วันที่ต้องการให้ส่ง', desc: 'วันที่นัดส่งสินค้า' },
  { col: 'I', id: 'itemName', thai: 'รายการสินค้า', desc: 'ชื่อสินค้า หรือ [แถมฟรี] ชื่อของแถม' },
  { col: 'J', id: 'quantity', thai: 'จำนวน', desc: 'จำนวนชิ้นหรือแพ็ค' },
  { col: 'K', id: 'totalAmount', thai: 'ยอดรวมก่อนลด', desc: 'ยอดรวมราคาสินค้า' },
  { col: 'L', id: 'discount', thai: 'ส่วนลด', desc: 'ส่วนลด (บาท)' },
  { col: 'M', id: 'netAmount', thai: 'ยอดเงินสุทธิ', desc: 'ยอดเงินที่ต้องชำระสุทธิ (บาท)' },
  { col: 'N', id: 'paymentMethod', thai: 'วิธีชำระเงิน', desc: 'เงินสด, โอนเงิน, หรือ เครดิต' },
  { col: 'O', id: 'note', thai: 'หมายเหตุ', desc: 'ข้อความบันทึกเพิ่มเติม' },
  { col: 'P', id: 'mapsUrl', thai: 'พิกัดแผนที่', desc: 'ลิงก์ Google Maps พิกัดส่งของ' },
  { col: 'Q', id: 'status', thai: 'สถานะ', desc: 'รอจัดส่ง, ยืนยันแล้ว, จัดส่งสำเร็จ, ยกเลิก' },
  { col: 'R', id: 'updatedAt', thai: 'อัปเดตล่าสุด', desc: 'วันเวลาบันทึก/แก้ไขล่าสุด' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  sheetsConfig,
  lineSettings,
  onUpdateSheetsConfig,
  onUpdateLineSettings,
  onClose,
  
  
  onRefreshFromSheets,
}) => {
  const [activeTab, setActiveTab] = useState<'sheets' | 'line'>('sheets');

  // Google Sheets state
  const [spreadsheetId, setSpreadsheetId] = useState(sheetsConfig?.spreadsheetId || '');
  const [gasUrl, setGasUrl] = useState(sheetsConfig?.gasUrl || '');
  const [sheetName, setSheetName] = useState(sheetsConfig?.sheetName || 'รายการออเดอร์ (Orders)');
  const [isLoggingInGoogle, setIsLoggingInGoogle] = useState(false);
  const [sheetsMessage, setSheetsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [driveSheets, setDriveSheets] = useState<Array<{ id: string; name: string }>>([]);

  // GAS Test & Code state
  const [isTestingGas, setIsTestingGas] = useState(false);
  const [gasTestResult, setGasTestResult] = useState<{ success: boolean; message: string; isHtml?: boolean } | null>(null);
  const [isCopiedGasCode, setIsCopiedGasCode] = useState(false);
  const [showCodePreview, setShowCodePreview] = useState(false);

  // Line Settings state
  const [lineEnabled, setLineEnabled] = useState(lineSettings?.enabled || false);
  const [lineToken, setLineToken] = useState(lineSettings?.token || '');
  const [lineWebhookUrl, setLineWebhookUrl] = useState(lineSettings?.webhookUrl || '');
  const [isTestingLine, setIsTestingLine] = useState(false);
  const [lineTestResult, setLineTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Column Alignment & Database Repair state
  const [isFixingHeaders, setIsFixingHeaders] = useState(false);
  const [fixHeadersResult, setFixHeadersResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showHeadersSchema, setShowHeadersSchema] = useState(false);

  // Sync state when modal is opened or configs change
  useEffect(() => {
    if (isOpen) {
      setSpreadsheetId(sheetsConfig?.spreadsheetId || '');
      setSheetName(sheetsConfig?.sheetName || 'รายการออเดอร์ (Orders)');
      setGasUrl(sheetsConfig?.gasUrl || '');
      setLineEnabled(lineSettings?.enabled || false);
      setLineToken(lineSettings?.token || '');
      setLineWebhookUrl(lineSettings?.webhookUrl || '');
      setSheetsMessage(null);
      setLineTestResult(null);
      setGasTestResult(null);
    }
  }, [isOpen, sheetsConfig, lineSettings]);

  // Test GAS URL Connection
  const handleTestGas = async () => {
    setIsTestingGas(true);
    setGasTestResult(null);
    try {
      const res = await testGasConnection(gasUrl);
      setGasTestResult(res);
    } catch (err: any) {
      setGasTestResult({
        success: false,
        message: err.message || 'เกิดข้อผิดพลาดในการทดสอบ',
      });
    } finally {
      setIsTestingGas(false);
    }
  };

  // Copy GAS Code
  const handleCopyGasCode = async () => {
    try {
      await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
      setIsCopiedGasCode(true);
      setTimeout(() => setIsCopiedGasCode(false), 2500);
    } catch (e) {
      const textArea = document.createElement('textarea');
      textArea.value = GOOGLE_APPS_SCRIPT_CODE;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setIsCopiedGasCode(true);
      setTimeout(() => setIsCopiedGasCode(false), 2500);
    }
  };

  // Handle Google Sign In
  const handleGoogleLogin = async () => {
    setIsLoggingInGoogle(true);
    setSheetsMessage(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setSheetsMessage({ type: 'success', text: `เข้าสู่ระบบ Google สำเร็จ (${res.user.email})` });
      }
    } catch (err: any) {
      setSheetsMessage({ type: 'error', text: err.message || 'เข้าสู่ระบบ Google ไม่สำเร็จ' });
    } finally {
      setIsLoggingInGoogle(false);
    }
  };



  // Save manual Sheets configuration
  // Derived cleanId for display
  let currentCleanId = spreadsheetId.trim();
  if (currentCleanId.includes('/d/')) {
    const match = currentCleanId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      currentCleanId = match[1];
    }
  }

  const handleSaveSheetsConfig = () => {
    let cleanId = spreadsheetId.trim();
    if (cleanId.includes('/d/')) {
      const match = cleanId.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        cleanId = match[1];
      }
    }
    
    const updated: SheetsConfig = {
      ...sheetsConfig,
      spreadsheetId: cleanId,
      sheetName: sheetName.trim() || 'รายการออเดอร์ (Orders)',
      spreadsheetUrl: cleanId
        ? `https://docs.google.com/spreadsheets/d/${cleanId}/edit`
        : '',
      gasUrl: gasUrl.trim(),
    };
    onUpdateSheetsConfig(updated);
    setSheetsMessage({ type: 'success', text: 'บันทึกการตั้งค่า Google Sheets เรียบร้อย' });
  };

  // Adjust and Align Order Headers on Google Sheets
  const handleFixOrderHeaders = async () => {
    let cleanId = spreadsheetId.trim();
    if (cleanId.includes('/d/')) {
      const match = cleanId.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        cleanId = match[1];
      }
    }
    if (!cleanId) {
      setFixHeadersResult({ success: false, message: 'กรุณากรอก Google Spreadsheet ID ก่อนดำเนินการ' });
      return;
    }

    setIsFixingHeaders(true);
    setFixHeadersResult(null);
    try {
      const targetSheet = sheetName.trim() || 'Orders';
      const res = await fixAndAlignOrderHeaders(cleanId, targetSheet);
      setFixHeadersResult(res);
      // Automatically refresh app data to load properly
      await onRefreshFromSheets().catch(() => {});
    } catch (err: any) {
      setFixHeadersResult({
        success: false,
        message: err.message || 'เกิดข้อผิดพลาดในการปรับปรุงหัวคอลัมภ์',
      });
    } finally {
      setIsFixingHeaders(false);
    }
  };

  // Save Line Settings
  const handleSaveLineSettings = () => {
    const updated: LineSettings = {
      enabled: lineEnabled,
      token: lineToken.trim(),
      webhookUrl: lineWebhookUrl.trim(),
      notifyOnNewOrder: true,
      notifyOnStatusChange: true,
    };
    onUpdateLineSettings(updated);
    setLineTestResult({ success: true, message: 'บันทึกการตั้งค่า LINE เรียบร้อย' });
  };

  // Send Test LINE Notification
  const handleTestLine = async () => {
    setIsTestingLine(true);
    setLineTestResult(null);
    try {
      const sampleOrder: any = {
        orderNumber: 'TEST-' + Math.floor(1000 + Math.random() * 9000),
        createdAt: new Date().toISOString(),
        salespersonName: 'สมชาย ใจดี (ทดสอบระบบ)',
        customerName: 'คุณทดสอบ ระบบไลน์',
        customerPhone: '081-234-5678',
        items: [
          { name: 'น้ำดื่มบรรจุขวด 600 ml (แพ็ค 12)', quantity: 5, unitPrice: 65, subtotal: 325 },
        ],
        totalAmount: 325,
        discount: 0,
        netAmount: 325,
        paymentMethod: 'transfer',
        note: 'ข้อความทดสอบการเชื่อมต่อระบบแจ้งเตือน LINE Notify',
        location: {
          address: 'กรุงเทพมหานคร',
          mapsUrl: 'https://maps.google.com/?q=13.7563,100.5018',
        },
        status: 'pending',
      };

      const res = await sendLineNotification(sampleOrder, lineToken, lineWebhookUrl);
      setLineTestResult(res);
    } catch (err: any) {
      setLineTestResult({ success: false, message: err.message || 'ทดสอบล้มเหลว' });
    } finally {
      setIsTestingLine(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="settings-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 gpu-layer animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="settings-modal-card"
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              การเชื่อมต่อ & ตั้งค่าระบบ
            </h3>
            <p className="text-xs text-slate-500">
              Google Sheets Database และ LINE Notification
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50/50 px-4 pt-2">
          <button
            onClick={() => setActiveTab('sheets')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'sheets'
                ? 'border-blue-600 text-blue-800 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            <span>ฐานข้อมูล Google Sheets</span>
            {sheetsConfig?.spreadsheetId ? (
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            ) : null}
          </button>

          <button
            onClick={() => setActiveTab('line')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'line'
                ? 'border-blue-600 text-blue-800 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Bell className="w-4 h-4 text-[#06C755]" />
            <span>แจ้งเตือนผ่าน LINE</span>
            {lineSettings?.enabled && (
              <span className="w-2 h-2 rounded-full bg-[#06C755]"></span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* TAB 1: GOOGLE SHEETS */}
          {activeTab === 'sheets' && (
            <div className="space-y-4">
              {sheetsMessage && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                    sheetsMessage.type === 'success'
                      ? 'bg-blue-50 text-blue-800 border border-blue-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {sheetsMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{sheetsMessage.text}</span>
                </div>              )}
              
              <div className="space-y-4 pt-2">
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
                  <Database className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-blue-900 mb-1">ดึงข้อมูลอัตโนมัติ (Auto-Sync)</h4>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      ระบบจะทำการดึงข้อมูลออเดอร์ ลูกค้า สินค้า และพนักงาน <strong>โดยอัตโนมัติทุกครั้งที่คุณเปิดแอปพลิเคชัน</strong> ไม่จำเป็นต้องกดปุ่มซิงค์ข้อมูลเอง
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Google Spreadsheet ID
                  </label>
                  <input
                    type="text"
                    value={spreadsheetId}
                    onChange={(e) => setSpreadsheetId(e.target.value)}
                    placeholder="เช่น 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    (คัดลอกจาก URL ของ Google Sheets ระหว่าง /d/ และ /edit)
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อแท็บออเดอร์หลัก (Sheet Name)
                  </label>
                  <input
                    type="text"
                    value={sheetName}
                    onChange={(e) => setSheetName(e.target.value)}
                    placeholder="รายการออเดอร์ (Orders)"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Google Apps Script URL (GAS URL)
                    </label>
                    <button
                      type="button"
                      onClick={handleTestGas}
                      disabled={isTestingGas || !gasUrl.trim()}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {isTestingGas ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>กำลังทดสอบ...</span>
                        </>
                      ) : (
                        <>
                          <Activity className="w-3.5 h-3.5 text-blue-600" />
                          <span>ทดสอบการเชื่อมต่อ</span>
                        </>
                      )}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={gasUrl}
                    onChange={(e) => {
                      setGasUrl(e.target.value);
                      setGasTestResult(null);
                    }}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    (เป็น Web App URL ที่ได้จากการ Deploy Apps Script ของคุณ ลงท้ายด้วย /exec)
                  </span>

                  {/* GAS Test Result Alert */}
                  {gasTestResult && (
                    <div
                      className={`mt-2.5 p-3 rounded-xl text-xs flex items-start gap-2.5 transition-all ${
                        gasTestResult.success
                          ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                          : gasTestResult.isHtml
                          ? 'bg-amber-50 text-amber-950 border border-amber-200'
                          : 'bg-rose-50 text-rose-900 border border-rose-200'
                      }`}
                    >
                      {gasTestResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : gasTestResult.isHtml ? (
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-1">
                        <div className="font-bold">
                          {gasTestResult.success
                            ? 'เชื่อมต่อกับ Google Apps Script สำเร็จ!'
                            : gasTestResult.isHtml
                            ? 'ตรวจพบข้อผิดพลาดสิทธิ์การเข้าถึง (ได้รับหน้าล็อกอิน HTML)'
                            : 'เชื่อมต่อไม่สำเร็จ'}
                        </div>
                        <div className="text-[11px] leading-relaxed opacity-90 whitespace-pre-line">
                          {gasTestResult.message}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Apps Script Guide & Copy Box */}
                  <div className="mt-3 bg-slate-50 rounded-xl border border-slate-200 p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Code className="w-4 h-4 text-slate-600" />
                        <span className="text-xs font-bold text-slate-800">
                          คู่มือการสร้าง & Deploy Apps Script
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyGasCode}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all shadow-2xs cursor-pointer ${
                          isCopiedGasCode
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 hover:bg-slate-900 text-white'
                        }`}
                      >
                        {isCopiedGasCode ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>คัดลอกโค้ดแล้ว!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>คัดลอกโค้ด Apps Script (Code.gs)</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-600 space-y-1.5 bg-white p-3 rounded-lg border border-slate-100">
                      <div className="font-semibold text-slate-800 mb-1">
                        ขั้นตอนการตั้งค่าให้ระบบอ่าน/เขียนข้อมูลได้อัตโนมัติ:
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="font-bold text-blue-600 shrink-0">1.</span>
                        <span>เปิด Google Sheet ของคุณ ไปที่เมนู <strong>ส่วนขยาย (Extensions) &gt; Apps Script</strong></span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="font-bold text-blue-600 shrink-0">2.</span>
                        <span>ลบโค้ดเดิมใน <code>Code.gs</code> ออกทั้งหมด แล้วนำโค้ดที่คัดลอกจากปุ่มด้านบนไปวางแทนที่</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="font-bold text-blue-600 shrink-0">3.</span>
                        <span>กดปุ่มสีน้ำเงิน <strong>ทำให้ใช้งานได้ (Deploy) &gt; การทำให้ใช้งานได้ใหม่ (New deployment)</strong></span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="font-bold text-blue-600 shrink-0">4.</span>
                        <span>
                          เลือกประเภท <strong>เว็บแอป (Web app)</strong> โดยตั้งค่า:
                          <br />
                          • ดำเนินการในฐานะ (Execute as): <strong>ฉัน (Me)</strong>
                          <br />
                          • ผู้มีสิทธิ์เข้าถึง (Who has access): <strong className="text-amber-700 bg-amber-50 px-1 rounded">ทุกคน (Anyone)</strong> <em>*(สำคัญมาก เพื่อไม่ให้เกิดหน้า HTML ล็อกอิน)*</em>
                        </span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="font-bold text-blue-600 shrink-0">5.</span>
                        <span>กด <strong>ทำให้ใช้งานได้ (Deploy)</strong> แล้วคัดลอก URL ของเว็บแอป (ลงท้ายด้วย /exec) มาวางในช่องด้านบนนี้</span>
                      </div>
                    </div>

                    {/* Collapsible Code Preview */}
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowCodePreview(!showCodePreview)}
                        className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        {showCodePreview ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" />
                            <span>ซ่อนโค้ด Code.gs</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" />
                            <span>ดูตัวอย่างโค้ด Apps Script (Code.gs)</span>
                          </>
                        )}
                      </button>

                      {showCodePreview && (
                        <pre className="mt-2 p-3 bg-slate-900 text-slate-100 text-[10px] font-mono rounded-lg overflow-x-auto max-h-48 border border-slate-800 select-all">
                          {GOOGLE_APPS_SCRIPT_CODE}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>

                {/* Database Schema & Column Alignment Card */}
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-3.5 sm:p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 bg-blue-100 rounded-lg text-blue-700 shrink-0 mt-0.5">
                        <Table className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">
                          ตรวจสอบ & ปรับแก้หัวคอลัมภ์ฐานข้อมูล (Schema Alignment)
                        </h4>
                        <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                          ระบบออเดอร์มี 18 คอลัมน์มาตรฐาน (A - R) หากหัวคอลัมภ์ในชีตเดิมไม่ตรง ข้อมูลไม่ตรงช่อง หรือเป็นชื่อคอลัมน์เก่า กดปุ่มนี้เพื่อปรับปรุงแถวที่ 1 ให้ตรงกับระบบทันที
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleFixOrderHeaders}
                      disabled={isFixingHeaders || !spreadsheetId.trim()}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-2xs disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      {isFixingHeaders ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>กำลังปรับปรุง...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>ปรับแก้หัวคอลัมภ์ให้ตรงกับข้อมูลทันที</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Result Message */}
                  {fixHeadersResult && (
                    <div
                      className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                        fixHeadersResult.success
                          ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                          : 'bg-rose-50 text-rose-900 border border-rose-200'
                      }`}
                    >
                      {fixHeadersResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <span className="font-bold">
                          {fixHeadersResult.success ? 'ปรับแก้สำเร็จ: ' : 'เกิดข้อผิดพลาด: '}
                        </span>
                        <span className="text-[11px]">{fixHeadersResult.message}</span>
                      </div>
                    </div>
                  )}

                  {/* Collapsible Schema Table */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowHeadersSchema(!showHeadersSchema)}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      {showHeadersSchema ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          <span>ซ่อนโครงสร้างหัวคอลัมภ์ทั้ง 18 คอลัมน์</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          <span>ดูโครงสร้างหัวคอลัมภ์มาตรฐานทั้ง 18 คอลัมน์ (A - R)</span>
                        </>
                      )}
                    </button>

                    {showHeadersSchema && (
                      <div className="mt-2.5 overflow-x-auto border border-slate-200 rounded-lg max-h-56 bg-white">
                        <table className="w-full text-left border-collapse text-[11px]">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold sticky top-0">
                              <th className="py-1.5 px-2.5 w-14">คอลัมน์</th>
                              <th className="py-1.5 px-2.5 w-36">ชื่อหัวคอลัมภ์ (ภาษาไทย)</th>
                              <th className="py-1.5 px-2.5">คำอธิบายข้อมูลในช่อง</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {ORDER_SCHEMA_COLS.map((colItem) => (
                              <tr key={colItem.col} className="hover:bg-blue-50/40 transition-colors">
                                <td className="py-1.5 px-2.5 font-mono font-bold text-blue-700">
                                  {colItem.col}
                                </td>
                                <td className="py-1.5 px-2.5 font-bold text-slate-800">
                                  {colItem.thai}
                                </td>
                                <td className="py-1.5 px-2.5 text-slate-600">
                                  {colItem.desc}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={handleSaveSheetsConfig}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm cursor-pointer"
                  >
                    บันทึกการเชื่อมต่อฐานข้อมูล
                  </button>
                  
                  {currentCleanId && (
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${currentCleanId}/edit`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>เปิดดูฐานข้อมูล Google Sheets</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
          {/* TAB 2: LINE NOTIFICATION */}
          {activeTab === 'line' && (
            <div className="space-y-4">
              {lineTestResult && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                    lineTestResult.success
                      ? 'bg-blue-50 text-blue-800 border border-blue-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {lineTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  )}
                  <span>{lineTestResult.message}</span>
                </div>
              )}

              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50">
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    เปิดระบบแจ้งเตือนผ่าน LINE อัตโนมัติ
                  </div>
                  <p className="text-xs text-slate-500">
                    เมื่อมีออเดอร์ใหม่เข้ามา ระบบจะส่งข้อความแจ้งเตือนรายละเอียดเข้าห้องแชท LINE ทันที
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lineEnabled}
                    onChange={(e) => setLineEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#06C755]"></div>
                </label>
              </div>

              {/* Notice regarding LINE Notify vs Messaging API */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed">
                <strong>คำแนะนำการแจ้งเตือน LINE:</strong> LINE ได้ยุติบริการ LINE Notify เดิมแล้ว แนะนำให้ใช้ <strong>LINE Messaging API (Channel Access Token)</strong> หรือใช้ <strong>Webhook URL</strong> (เชื่อมต่อผ่าน Make.com, Zapier, n8n หรือ Google Apps Script) เพื่อรับแจ้งเตือนเข้ากลุ่มแชทได้ตลอดเวลา
              </div>

              {/* Line Notify / Messaging API Token */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>LINE Channel Access Token (Messaging API)</span>
                  <a
                    href="https://developers.line.biz/console/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-blue-600 hover:text-blue-700 flex items-center gap-1 font-semibold"
                  >
                    <span>LINE Developers Console</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={lineToken}
                    onChange={(e) => setLineToken(e.target.value)}
                    placeholder="วาง Channel Access Token จาก LINE Developers Console"
                    className="w-full pl-8 pr-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                  <Key className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  * ส่งผ่านเซิร์ฟเวอร์ระบบเพื่อความปลอดภัยและป้องกันปัญหา CORS
                </span>
              </div>

              {/* Webhook URL Option */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Webhook URL (Make.com / Zapier / n8n / LINE Bot Webhook)
                </label>
                <input
                  type="url"
                  value={lineWebhookUrl}
                  onChange={(e) => setLineWebhookUrl(e.target.value)}
                  placeholder="https://hook.make.com/xxxx หรือ https://hooks.zapier.com/..."
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  (แนะนำ) สามารถรับข้อมูล JSON ของออเดอร์ใหม่ไปประมวลผลหรือส่งเข้า LINE Notify Bot ได้อิสระ
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-3 border-t border-slate-100 flex-wrap">
                <button
                  onClick={handleSaveLineSettings}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  บันทึกการตั้งค่า LINE
                </button>

                <button
                  onClick={handleTestLine}
                  disabled={isTestingLine}
                  className="px-4 py-2.5 bg-[#06C755] hover:bg-[#05b04c] text-white text-xs font-bold rounded-xl inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  {isTestingLine ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>ส่งข้อความทดสอบเข้า LINE</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
