const fs = require('fs');
let code = fs.readFileSync('src/components/Navbar.tsx', 'utf8');

const navStart = `<nav className="space-y-1">`;
const navEnd = `</nav>
          </div>

          {/* Group 2: Tools & Administration */}`;

const startIndex = code.indexOf(navStart);
const endIndex = code.indexOf(navEnd);

if (startIndex !== -1 && endIndex !== -1) {
  const newNavContent = `<nav className="space-y-1">
              {/* Tab 1: Orders */}
              <button
                id="sidebar-tab-orders"
                onClick={() => setActiveTab('orders')}
                className={\`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer \${
                  activeTab === 'orders'
                    ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200/80 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }\`}
              >
                <div className="flex items-center gap-2.5">
                  <ListOrdered
                    className={\`w-4 h-4 \${
                      activeTab === 'orders' ? 'text-blue-700' : 'text-slate-400'
                    }\`}
                  />
                  <span>รายการออเดอร์</span>
                </div>
                <span
                  className={\`px-2 py-0.5 rounded-full text-[11px] font-semibold \${
                    activeTab === 'orders'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }\`}
                >
                  {orderCount}
                </span>
              </button>

              {/* Tab 2: Customers */}
              <button
                id="sidebar-tab-customers"
                onClick={() => setActiveTab('customers')}
                className={\`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer \${
                  activeTab === 'customers'
                    ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200/80 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }\`}
              >
                <div className="flex items-center gap-2.5">
                  <UserPlus
                    className={\`w-4 h-4 \${
                      activeTab === 'customers' ? 'text-blue-700' : 'text-slate-400'
                    }\`}
                  />
                  <span>เพิ่มลูกค้าใหม่</span>
                </div>
                {customerCount > 0 && (
                  <span
                    className={\`px-2 py-0.5 rounded-full text-[11px] font-semibold \${
                      activeTab === 'customers'
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-100 text-blue-800'
                    }\`}
                  >
                    {customerCount}
                  </span>
                )}
              </button>

              {/* Tab 3: Store Check-in (เช็คอินร้านค้า) */}
              <button
                id="sidebar-tab-checkin"
                onClick={() => setActiveTab('checkin')}
                className={\`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer \${
                  activeTab === 'checkin'
                    ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200/80 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }\`}
              >
                <div className="flex items-center gap-2.5">
                  <MapPin
                    className={\`w-4 h-4 \${
                      activeTab === 'checkin' ? 'text-blue-700' : 'text-slate-400'
                    }\`}
                  />
                  <span>เช็คอินร้านค้า</span>
                </div>
                <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                  GPS
                </span>
              </button>

              {/* Tab 4: Expenses (บันทึกค่าใช้จ่าย) */}
              <button
                id="sidebar-tab-expenses"
                onClick={() => setActiveTab('expenses')}
                className={\`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer \${
                  activeTab === 'expenses'
                    ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200/80 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }\`}
              >
                <div className="flex items-center gap-2.5">
                  <Wallet
                    className={\`w-4 h-4 \${
                      activeTab === 'expenses' ? 'text-blue-700' : 'text-slate-400'
                    }\`}
                  />
                  <span>บันทึกค่าใช้จ่าย</span>
                </div>
              </button>

              {/* Tab 5: Dashboard */}
              <button
                id="sidebar-tab-dashboard"
                onClick={() => setActiveTab('dashboard')}
                className={\`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer \${
                  activeTab === 'dashboard'
                    ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200/80 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }\`}
              >
                <div className="flex items-center gap-2.5">
                  <BarChart3
                    className={\`w-4 h-4 \${
                      activeTab === 'dashboard' ? 'text-blue-700' : 'text-slate-400'
                    }\`}
                  />
                  <span>ยอดขายวันนี้</span>
                </div>
                <span className="text-[10px] font-bold text-slate-500">
                  ฿{todaySalesAmount.toLocaleString()}
                </span>
              </button>
            `;
  
  code = code.substring(0, startIndex) + newNavContent + code.substring(endIndex);
  fs.writeFileSync('src/components/Navbar.tsx', code);
}
