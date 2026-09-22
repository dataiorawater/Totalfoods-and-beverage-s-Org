const fs = require('fs');
let code = fs.readFileSync('src/components/SettingsModal.tsx', 'utf8');

const replacement = `              )}
              
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

                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={handleSaveSheetsConfig}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm cursor-pointer"
                  >
                    บันทึกการเชื่อมต่อฐานข้อมูล
                  </button>
                  
                  {cleanId && (
                    <a
                      href={\`https://docs.google.com/spreadsheets/d/\${cleanId}/edit\`}
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
          {/* TAB 2: LINE NOTIFICATION */}`;

code = code.replace(/\s+\)\}\n\s+\)\}\n\s+\{\/\* TAB 2: LINE NOTIFICATION \*\/\}/m, replacement);
fs.writeFileSync('src/components/SettingsModal.tsx', code);
