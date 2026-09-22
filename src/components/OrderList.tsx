import React, { useState, useMemo, useEffect } from 'react';
import { Order, OrderStatus, StaffUser } from '../types';
import { getLineShareUrl } from '../services/lineNotify';
import {
  Search,
  Phone,
  Navigation,
  Share2,
  Eye,
  CheckCircle2,
  Clock,
  Truck,
  XCircle,
  Calendar,
  User,
  Package,
  FileSpreadsheet,
  MapPin,
  CreditCard,
  Banknote,
  Smartphone,
  Plus,
  X,
  Store,
  ChevronRight,
} from 'lucide-react';

interface OrderListProps {
  orders: Order[];
  currentUser: StaffUser;
  onSelectOrder: (order: Order) => void;
  onUpdateStatus: (orderId: string, newStatus: OrderStatus) => void;
  onOpenNewOrder: () => void;
}


// Helper to parse dates that might be in Thai format (DD/MM/YYYY)
function parseDateRobust(dateStr: string): Date {
  if (!dateStr) return new Date();
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime()) && dateStr.includes('-')) {
    return parsed;
  }
  const parts = dateStr.split(' ');
  const datePart = parts[0];
  const timePart = parts[1] || '00:00:00';

  if (datePart.includes('/')) {
    const [day, month, year] = datePart.split('/');
    let y = parseInt(year);
    if (y > 2500) y -= 543;
    const [hour, min, sec] = timePart.split(':');
    return new Date(y, parseInt(month) - 1, parseInt(day), parseInt(hour || '0'), parseInt(min || '0'), parseInt(sec || '0'));
  }
  return parsed;
}

export const OrderList: React.FC<OrderListProps> = ({
  orders,
  currentUser,
  onSelectOrder,
  onOpenNewOrder,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [salespersonFilter, setSalespersonFilter] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState<number>(25);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(25);
  }, [searchTerm, statusFilter, dateFilter, salespersonFilter]);

  // 1. Filter orders strictly for current salesperson if role is 'sales'
  const isSalesRole = currentUser.role === 'sales';

  const baseOrders = useMemo(() => {
    if (isSalesRole) {
      return orders.filter(
        (ord) =>
          ord.salespersonId === currentUser.id ||
          (ord.salespersonEmail && ord.salespersonEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
          ord.salespersonName.toLowerCase().includes(currentUser.name.toLowerCase()) ||
          currentUser.name.toLowerCase().includes(ord.salespersonName.toLowerCase())
      );
    }
    return orders;
  }, [orders, currentUser, isSalesRole]);

  // Extract all distinct salespersons for Admin filter
  const distinctSalespersons = useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach((o) => {
      if (o.salespersonId && o.salespersonName) {
        map.set(o.salespersonId, o.salespersonName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [orders]);

  // 2. Filter by search, status, and date
  const filteredOrders = useMemo(() => {
    return baseOrders.filter((ord) => {
      // Status filter
      if (statusFilter !== 'all' && ord.status !== statusFilter) return false;

      // Salesperson filter (for Admin / Manager view)
      if (!isSalesRole && salespersonFilter !== 'all' && ord.salespersonId !== salespersonFilter) {
        return false;
      }

      // Date filter
      if (dateFilter !== 'all') {
        const ordDate = parseDateRobust(ord.createdAt);
        const today = new Date();
        if (dateFilter === 'today') {
          const isToday =
            ordDate.getDate() === today.getDate() &&
            ordDate.getMonth() === today.getMonth() &&
            ordDate.getFullYear() === today.getFullYear();
          if (!isToday) return false;
        } else if (dateFilter === 'yesterday') {
          const yesterday = new Date(today);
          yesterday.setDate(today.getDate() - 1);
          const isYesterday =
            ordDate.getDate() === yesterday.getDate() &&
            ordDate.getMonth() === yesterday.getMonth() &&
            ordDate.getFullYear() === yesterday.getFullYear();
          if (!isYesterday) return false;
        } else if (dateFilter === 'this_month') {
          const isThisMonth =
            ordDate.getMonth() === today.getMonth() &&
            ordDate.getFullYear() === today.getFullYear();
          if (!isThisMonth) return false;
        }
      }

      // Search query (order number, customer name, phone, items)
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchNumber = String(ord.orderNumber || '').toLowerCase().includes(q);
        const matchCust = String(ord.customerName || '').toLowerCase().includes(q);
        const matchPhone = String(ord.customerPhone || '').includes(q);
        const matchSales = String(ord.salespersonName || '').toLowerCase().includes(q);
        const matchItem = (ord.items || []).some((it) => String(it.name || '').toLowerCase().includes(q));
        if (!matchNumber && !matchCust && !matchPhone && !matchSales && !matchItem) return false;
      }

      return true;
    });
  }, [baseOrders, statusFilter, isSalesRole, salespersonFilter, dateFilter, searchTerm]);

  // Status Badge Component
  const getStatusBadge = (status: OrderStatus, size: 'sm' | 'base' = 'sm') => {
    const sizeClasses =
      size === 'base'
        ? 'px-3 py-1 text-xs sm:text-sm gap-1.5'
        : 'px-2.5 py-0.5 text-xs gap-1';

    switch (status) {
      case 'pending':
        return (
          <span
            className={`inline-flex items-center font-bold rounded-full bg-amber-500 text-white shadow-sm shrink-0 whitespace-nowrap ${sizeClasses}`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-50 shrink-0" />
            <span>รอจัดส่ง</span>
          </span>
        );
      case 'confirmed':
        return (
          <span
            className={`inline-flex items-center font-bold rounded-full bg-blue-600 text-white shadow-sm shrink-0 whitespace-nowrap ${sizeClasses}`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-100 shrink-0" />
            <span>ยืนยันแล้ว</span>
          </span>
        );
      case 'delivering':
        return (
          <span
            className={`inline-flex items-center font-bold rounded-full bg-blue-500 text-white shadow-sm shrink-0 whitespace-nowrap ${sizeClasses}`}
          >
            <Truck className="w-3.5 h-3.5 text-blue-50 shrink-0 animate-pulse" />
            <span>กำลังจัดส่ง</span>
          </span>
        );
      case 'completed':
        return (
          <span
            className={`inline-flex items-center font-bold rounded-full bg-emerald-500 text-white shadow-sm shrink-0 whitespace-nowrap ${sizeClasses}`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-50 shrink-0" />
            <span>ส่งมอบสำเร็จ</span>
          </span>
        );
      case 'cancelled':
        return (
          <span
            className={`inline-flex items-center font-bold rounded-full bg-rose-500 text-white shadow-sm shrink-0 whitespace-nowrap ${sizeClasses}`}
          >
            <XCircle className="w-3.5 h-3.5 text-rose-50 shrink-0" />
            <span>ยกเลิก</span>
          </span>
        );
    }
  };

  // Status counts (based on baseOrders for current user's scope)
  const pendingCount = baseOrders.filter((o) => o.status === 'pending').length;
  const deliveringCount = baseOrders.filter((o) => o.status === 'delivering').length;
  const completedCount = baseOrders.filter((o) => o.status === 'completed').length;
  const cancelledCount = baseOrders.filter((o) => o.status === 'cancelled').length;

  return (
    <div className="space-y-4 max-w-full overflow-hidden">
      {/* Top Filter & Search Controls */}
      <div className="bg-white p-2.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-2.5">
        {/* Search Bar & Dropdowns Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-0">
            <input
              id="search-orders-input"
              type="text"
              placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร, เลขออเดอร์..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 sm:pl-9 pr-8 py-1.5 sm:py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-2xs placeholder:text-slate-400"
            />
            <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 absolute left-2.5 sm:left-3 top-2.5 sm:top-2.5 pointer-events-none" />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-2 sm:top-2 p-0.5 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer transition-colors"
                title="ล้างคำค้นหา"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns (Date & Salesperson) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Date Filter */}
            <div className="flex-1 sm:w-36">
              <select
                id="filter-date-select"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 sm:py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium cursor-pointer focus:ring-2 focus:ring-blue-500 focus:bg-white shadow-2xs"
              >
                <option value="all">📅 ทุกช่วงเวลา</option>
                <option value="today">วันนี้</option>
                <option value="yesterday">เมื่อวาน</option>
                <option value="this_month">เดือนนี้</option>
              </select>
            </div>

            {/* Admin / Manager Salesperson Filter */}
            {!isSalesRole && (
              <div className="flex-1 sm:w-44">
                <select
                  id="filter-sales-select"
                  value={salespersonFilter}
                  onChange={(e) => setSalespersonFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 sm:py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium cursor-pointer focus:ring-2 focus:ring-blue-500 focus:bg-white shadow-2xs truncate"
                >
                  <option value="all">👤 เซลล์ทุกคน ({orders.length})</option>
                  {distinctSalespersons.map((s) => (
                    <option key={s.id} value={s.id}>
                      👤 {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Status Filter: Compact, horizontally scrollable on mobile (no wrapping/truncation), flex on desktop */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar p-1 bg-slate-100/90 rounded-xl sm:bg-transparent sm:p-0 sm:gap-2 sm:flex-wrap text-xs">
          {/* All Orders */}
          <button
            id="status-filter-all"
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg sm:rounded-xl font-bold transition-all cursor-pointer select-none text-xs shrink-0 whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white sm:bg-slate-100 text-slate-600 hover:bg-slate-200/80 border border-slate-200/80 sm:border-transparent'
            }`}
          >
            <span>ทั้งหมด</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                statusFilter === 'all'
                  ? 'bg-blue-700 text-blue-100'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {baseOrders.length}
            </span>
          </button>

          {/* Pending */}
          <button
            id="status-filter-pending"
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg sm:rounded-xl font-bold transition-all cursor-pointer select-none text-xs shrink-0 whitespace-nowrap ${
              statusFilter === 'pending'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-white sm:bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/90 sm:border-amber-200/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>รอจัดส่ง</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                statusFilter === 'pending'
                  ? 'bg-amber-700 text-amber-100'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {pendingCount}
            </span>
          </button>

          {/* Delivering */}
          <button
            id="status-filter-delivering"
            type="button"
            onClick={() => setStatusFilter('delivering')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg sm:rounded-xl font-bold transition-all cursor-pointer select-none text-xs shrink-0 whitespace-nowrap ${
              statusFilter === 'delivering'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white sm:bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200/90 sm:border-blue-200/60'
            }`}
          >
            <Truck className="w-3.5 h-3.5 shrink-0" />
            <span>กำลังจัดส่ง</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                statusFilter === 'delivering'
                  ? 'bg-blue-700 text-blue-100'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              {deliveringCount}
            </span>
          </button>

          {/* Completed */}
          <button
            id="status-filter-completed"
            type="button"
            onClick={() => setStatusFilter('completed')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg sm:rounded-xl font-bold transition-all cursor-pointer select-none text-xs shrink-0 whitespace-nowrap ${
              statusFilter === 'completed'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-white sm:bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/90 sm:border-emerald-200/60'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>ส่งมอบสำเร็จ</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                statusFilter === 'completed'
                  ? 'bg-emerald-700 text-emerald-100'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {completedCount}
            </span>
          </button>

          {/* Cancelled */}
          <button
            id="status-filter-cancelled"
            type="button"
            onClick={() => setStatusFilter('cancelled')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg sm:rounded-xl font-bold transition-all cursor-pointer select-none text-xs shrink-0 whitespace-nowrap ${
              statusFilter === 'cancelled'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'bg-white sm:bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200/90 sm:border-rose-200/60'
            }`}
          >
            <XCircle className="w-3.5 h-3.5 shrink-0" />
            <span>ยกเลิก</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                statusFilter === 'cancelled'
                  ? 'bg-rose-700 text-rose-100'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {cancelledCount}
            </span>
          </button>
        </div>
      </div>

      {/* Orders List Content */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 sm:p-12 text-center border border-slate-200/80 shadow-xs">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Package className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {isSalesRole ? 'ไม่พบออเดอร์ของคุณ' : 'ไม่พบรายการออเดอร์ที่ค้นหา'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
            {isSalesRole
              ? 'คุณยังไม่มีออเดอร์ในเงื่อนไขการค้นหานี้ กดปุ่มลงออเดอร์ใหม่เพื่อสร้างรายการได้ทันที'
              : 'ลองปรับเปลี่ยนตัวกรองค้นหา หรือกดปุ่มลงออเดอร์ใหม่'}
          </p>
          <button
            onClick={onOpenNewOrder}
            className="mt-4 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs sm:text-sm transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>ลงออเดอร์ใหม่ตอนนี้</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredOrders.slice(0, visibleCount).map((order, idx) => {
            const totalItemQty = (order.items || []).reduce((sum, it) => sum + (it.quantity || 1), 0);
            const itemsText = (order.items || []).map((it) => `${it.name} (x${it.quantity})`).join(', ');
            const freebiesText = (order.freebies || []).map((fb) => `${fb.name} (x${fb.quantity})`).join(', ');

            return (
              <div
                key={order.id + '-' + idx}
                id={`order-item-${order.orderNumber}`}
                onClick={() => onSelectOrder(order)}
                className="content-auto group bg-white rounded-2xl border border-slate-200/90 hover:border-blue-400 hover:shadow-md hover:bg-blue-50/20 active:scale-[0.995] p-3.5 sm:p-4.5 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4"
              >
                {/* Left: Store Icon & Store Name (Primary) + Subtle Order Meta */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-50 group-hover:bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/80 transition-colors">
                    <Store className="w-5 h-5 text-blue-600" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                        {order.customerName}
                      </h3>
                      {order.syncedToSheets && (
                        <span
                          title="บันทึกลง Google Sheets แล้ว"
                          className="inline-flex items-center text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 shrink-0"
                        >
                          <FileSpreadsheet className="w-3 h-3 mr-0.5" /> Sheets
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                      <span className="font-semibold text-slate-700">
                        {order.orderNumber}
                      </span>
                      <span>•</span>
                      <span>
                        {parseDateRobust(order.createdAt).toLocaleDateString('th-TH', {
                          day: 'numeric',
                          month: 'short',
                          year: '2-digit',
                        })}
                      </span>
                      <span>•</span>
                      <span className="text-slate-600 font-medium">
                        {order.items?.length || 0} รายการ ({totalItemQty} ชิ้น)
                      </span>
                      {order.freebies && order.freebies.length > 0 && (
                        <span className="inline-flex items-center text-[10px] font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded border border-emerald-200">
                          + แถม {order.freebies.length}
                        </span>
                      )}
                    </div>

                    {/* Accurate items preview */}
                    {itemsText && (
                      <p className="text-xs text-slate-600 mt-1.5 truncate max-w-xs sm:max-w-md">
                        <span className="font-semibold text-slate-700">สินค้า: </span>
                        <span>{itemsText}</span>
                        {freebiesText && (
                          <span className="text-emerald-600 font-medium ml-1.5">
                            [แถม: {freebiesText}]
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Status badge, Net amount & Chevron */}
                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pt-2 sm:pt-0 border-t border-slate-100 sm:border-t-0">
                  <div className="shrink-0">
                    {getStatusBadge(order.status, 'sm')}
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-400 block leading-tight">ยอดสุทธิ</span>
                    <span className="text-base sm:text-lg font-extrabold text-blue-700 tracking-tight">
                      ฿{(order.netAmount ?? 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="p-1 rounded-lg text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors shrink-0">
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}

          {filteredOrders.length > visibleCount && (
            <button
              type="button"
              onClick={() => setVisibleCount((prev) => prev + 25)}
              className="w-full py-3 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs sm:text-sm transition-colors shadow-2xs flex items-center justify-center gap-2 cursor-pointer mt-3"
            >
              <span>แสดงรายการเพิ่มเติม (+25 จากทั้งหมด {filteredOrders.length} รายการ)</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
