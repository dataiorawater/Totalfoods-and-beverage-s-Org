import React, { useMemo } from 'react';
import { StaffUser, Order, OrderItem, FreebieItem, Product, Customer, Route } from '../types';
import {
  X,
  Phone,
  Navigation,
  ExternalLink,
  Printer,
  Share2,
  Calendar,
  User,
  MapPin,
  CheckCircle2,
  Clock,
  Truck,
  XCircle,
  FileSpreadsheet,
  Pencil,
  Lock,
  Gift,
  RotateCcw,
  Compass,
} from 'lucide-react';
import { getLineShareUrl } from '../services/lineNotify';

interface OrderDetailModalProps {
  order: Order | null;
  onClose: () => void;
  onUpdateStatus: (orderId: string, newStatus: Order['status']) => void;
  onEditOrder?: (order: Order) => void;
  currentUser?: StaffUser;
  products?: Product[];
  customers?: Customer[];
  routes?: Route[];
}

// Robust Date Parser supporting ISO and Thai Buddhist Era formats
function parseDateRobust(dateStr: string): Date {
  if (!dateStr) return new Date();
  const trimmed = String(dateStr).trim();

  // Try standard ISO parsing
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime()) && trimmed.includes('-') && !trimmed.includes('/')) {
    if (parsed.getFullYear() > 2400) {
      parsed.setFullYear(parsed.getFullYear() - 543);
    }
    return parsed;
  }

  // Handle DD/MM/YYYY or DD-MM-YYYY
  const normalized = trimmed.replace('T', ' ');
  const parts = normalized.split(' ');
  const datePart = parts[0] || '';
  const timePart = parts[1] || '00:00:00';

  if (datePart.includes('/') || datePart.includes('-')) {
    const separator = datePart.includes('/') ? '/' : '-';
    const dParts = datePart.split(separator);
    let day = 1;
    let month = 1;
    let year = new Date().getFullYear();

    if (dParts.length === 3) {
      if (dParts[0].length === 4) {
        // YYYY-MM-DD
        year = parseInt(dParts[0], 10) || year;
        month = parseInt(dParts[1], 10) || 1;
        day = parseInt(dParts[2], 10) || 1;
      } else {
        // DD/MM/YYYY
        day = parseInt(dParts[0], 10) || 1;
        month = parseInt(dParts[1], 10) || 1;
        year = parseInt(dParts[2], 10) || year;
      }
    }

    if (year > 2400) year -= 543;

    const tParts = timePart.split(':');
    const hour = parseInt(tParts[0] || '0', 10);
    const min = parseInt(tParts[1] || '0', 10);
    const sec = parseInt(tParts[2] || '0', 10);

    const result = new Date(year, month - 1, day, hour, min, sec);
    if (!isNaN(result.getTime())) {
      return result;
    }
  }

  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

// Format Thai Date & Time cleanly
function formatThaiDateTimeFull(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const d = parseDateRobust(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);

    const day = d.getDate();
    const thaiMonths = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
    ];
    const month = thaiMonths[d.getMonth()];
    const year = d.getFullYear() + 543;
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    const hasTime = dateStr.includes(':') || dateStr.includes('T');
    if (hasTime && (d.getHours() > 0 || d.getMinutes() > 0)) {
      return `${day} ${month} ${year} เวลา ${hours}:${minutes} น.`;
    }
    return `${day} ${month} ${year}`;
  } catch {
    return String(dateStr);
  }
}

// Format Delivery Date
function formatDeliveryDate(dateStr: string): string {
  if (!dateStr || dateStr === '-') return 'จัดส่งตามรอบปกติ';
  try {
    const d = parseDateRobust(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const thaiShortMonths = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
    ];
    return `${d.getDate()} ${thaiShortMonths[d.getMonth()]} ${d.getFullYear() + 543}`;
  } catch {
    return dateStr;
  }
}

// Clean phone format
function formatPhoneNumber(phone: string): string {
  if (!phone || phone === '-' || phone === 'null') return '';
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 9) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
  }
  return phone;
}

// Payment method label
function getPaymentMethodLabel(method: string): string {
  const m = String(method || '').toLowerCase();
  if (m === 'transfer' || m.includes('โอน')) return 'โอนเงินเข้าบัญชีธนาคาร';
  if (m === 'credit' || m.includes('เครดิต')) return 'เครดิตเทอม 30 วัน';
  return 'เงินสด';
}

// Intelligent product matching helper that prevents mismatching different bottle sizes or dummy IDs
function findBestProductMatch(itName: string, itProductId?: string, catalog: Product[] = []): Product | null {
  if (!catalog || catalog.length === 0) return null;
  const cleanName = itName.trim().toLowerCase();

  // 1. Check genuine productId match (ignore dummy IDs like 'p0', 'p1', 'item-0')
  if (itProductId && !itProductId.match(/^p\d+$/i) && !itProductId.match(/^item-\d+$/i)) {
    const byId = catalog.find((p) => p.id === itProductId);
    if (byId) return byId;
  }

  // 2. Exact name match
  const exact = catalog.find((p) => p.name.trim().toLowerCase() === cleanName);
  if (exact) return exact;

  // 3. Normalized name match (ignore spaces, dots, dashes, brackets)
  const norm = (s: string) => s.toLowerCase().replace(/[\s\-_().\[\]]/g, '');
  const cleanNorm = norm(cleanName);
  const normMatch = catalog.find((p) => norm(p.name) === cleanNorm);
  if (normMatch) return normMatch;

  // 4. Match SKU if provided
  const bySku = catalog.find((p) => p.sku && p.sku.trim().toLowerCase() === cleanName);
  if (bySku) return bySku;

  // 5. Volume/number numbers matching (e.g. 600, 1500, 350, 18.9)
  const numbersInItem = cleanName.match(/\b\d+(\.\d+)?\b/g) || [];
  if (numbersInItem.length > 0) {
    const candidates = catalog.filter((p) => {
      const pNorm = p.name.toLowerCase();
      return numbersInItem.every((num) => pNorm.includes(num));
    });
    if (candidates.length === 1) return candidates[0];
  }

  // 6. Substring match ONLY if one contains the other AND numbers don't conflict
  const subMatch = catalog.find((p) => {
    const pNorm = norm(p.name);
    const itemNumbers = cleanName.match(/\d+/g) || [];
    const prodNumbers = p.name.match(/\d+/g) || [];
    // If both have numbers and numbers differ, do NOT match!
    if (itemNumbers.length > 0 && prodNumbers.length > 0) {
      if (itemNumbers.join('') !== prodNumbers.join('')) return false;
    }
    return pNorm.includes(cleanNorm) || cleanNorm.includes(pNorm);
  });
  if (subMatch) return subMatch;

  return null;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  onClose,
  onUpdateStatus,
  onEditOrder,
  currentUser,
  products = [],
  customers = [],
}) => {
  if (!order) return null;

  // 1. Resolve Customer Data
  const matchedCustomer = useMemo(() => {
    if (!customers || customers.length === 0) return null;
    const cleanOrderName = String(order.customerName || '').trim().toLowerCase();
    const cleanOrderPhone = String(order.customerPhone || '').replace(/[^0-9]/g, '');

    return (
      customers.find((c) => {
        const cName = String(c.name || '').trim().toLowerCase();
        if (cleanOrderName && cName === cleanOrderName) return true;
        const cPhone = String(c.phone || '').replace(/[^0-9]/g, '');
        if (cleanOrderPhone && cPhone && cPhone === cleanOrderPhone) return true;
        return false;
      }) || null
    );
  }, [customers, order.customerName, order.customerPhone]);

  // Phone resolution
  const resolvedPhone = order.customerPhone?.trim() || matchedCustomer?.phone?.trim() || '';
  const displayPhone = formatPhoneNumber(resolvedPhone);

  // Address resolution (Fixing raw URL being shown as address)
  const resolvedAddress = useMemo(() => {
    const rawOrderAddr = order.location?.address?.trim() || '';
    // If order address is present and NOT a URL
    if (rawOrderAddr && !rawOrderAddr.startsWith('http://') && !rawOrderAddr.startsWith('https://') && !rawOrderAddr.startsWith('maps.')) {
      return rawOrderAddr;
    }
    // Check matched customer address
    if (matchedCustomer?.address?.trim()) {
      return matchedCustomer.address.trim();
    }
    // If only mapsUrl exists
    const hasMapsUrl = order.location?.mapsUrl || matchedCustomer?.mapsUrl;
    if (hasMapsUrl) {
      return 'มีพิกัดแผนที่หมุดส่งของ (กดปุ่มนำทางด้านขวาเพื่อเปิดแผนที่)';
    }
    return 'ไม่ได้ระบุที่อยู่จัดส่ง';
  }, [order.location, matchedCustomer]);

  // Google Maps URL resolution
  const resolvedMapsUrl = useMemo(() => {
    const orderMaps = order.location?.mapsUrl?.trim();
    if (orderMaps && (orderMaps.startsWith('http://') || orderMaps.startsWith('https://') || orderMaps.startsWith('maps.'))) {
      return orderMaps;
    }
    const custMaps = matchedCustomer?.mapsUrl?.trim();
    if (custMaps && (custMaps.startsWith('http://') || custMaps.startsWith('https://') || custMaps.startsWith('maps.'))) {
      return custMaps;
    }
    if (matchedCustomer?.latitude && matchedCustomer?.longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${matchedCustomer.latitude},${matchedCustomer.longitude}`;
    }
    if (order.location?.address && !order.location.address.startsWith('http')) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.location.address)}`;
    }
    return '';
  }, [order.location, matchedCustomer]);

  // Route Name
  const resolvedRouteName = matchedCustomer?.routeName || '';

  // 2. Resolve Items, Freebies & Pricing (Handling ฿0, multi-items, and product catalog reconciliation)
  const { resolvedItems, resolvedFreebies } = useMemo(() => {
    const rawItems = order.items || [];
    const rawFreebies = order.freebies || [];

    const parsedRegularItems: OrderItem[] = [];
    const parsedFreebieItems: FreebieItem[] = [...rawFreebies];

    rawItems.forEach((it, idx) => {
      const itName = String(it.name || '').trim();
      if (!itName || itName === '-') return;

      const isFreebie =
        itName.startsWith('[แถมฟรี]') ||
        itName.startsWith('(แถมฟรี)') ||
        itName.startsWith('[แถม]') ||
        itName.startsWith('(แถม)') ||
        itName.startsWith('แถมฟรี:') ||
        itName.startsWith('ของแถม:') ||
        itName.endsWith('(แถมฟรี)') ||
        itName.endsWith('[แถมฟรี]') ||
        itName.endsWith('(แถม)') ||
        itName.toLowerCase().includes('แถมฟรี');

      let cleanName = itName
        .replace(/^(\[แถมฟรี\]|\(แถมฟรี\)|\[แถม\]|\(แถม\)|แถมฟรี:\s*|ของแถม:\s*)/i, '')
        .replace(/(\(แถมฟรี\)|\[แถมฟรี\]|\(แถม\))$/i, '')
        .replace(/^[\d]+[\.\)]\s*/, '')
        .replace(/^[-•*]\s*/, '')
        .trim();

      // Extract unit or quantity if embedded in name
      let parsedUnit = it.unit;
      const bracketMatch = cleanName.match(/\((\d+)\s*(แพ็ค|ขวด|ถัง|ลัง|กล่อง|ชิ้น|โหล)?\)$/);
      if (bracketMatch) {
        if (bracketMatch[2] && (!parsedUnit || parsedUnit === 'ชิ้น')) {
          parsedUnit = bracketMatch[2];
        }
        cleanName = cleanName.replace(/\((\d+)\s*(แพ็ค|ขวด|ถัง|ลัง|กล่อง|ชิ้น|โหล)?\)$/, '').trim();
      }

      if (isFreebie) {
        parsedFreebieItems.push({
          id: it.id || `freebie-auto-${idx}`,
          name: cleanName || 'ของแถม',
          quantity: it.quantity || 1,
          unit: parsedUnit || 'ชิ้น',
        });
      } else {
        parsedRegularItems.push({
          ...it,
          id: it.id || `item-${idx}`,
          name: cleanName,
          unit: parsedUnit || 'ชิ้น',
        });
      }
    });

    // Match each regular item against products catalog
    const resolved = parsedRegularItems.map((it, idx) => {
      const pMatch = findBestProductMatch(it.name, it.productId, products);
      const resolvedUnit = it.unit && it.unit !== 'ชิ้น' ? it.unit : (pMatch?.unit || 'ชิ้น');
      let unitPrice = typeof it.unitPrice === 'number' && it.unitPrice > 0 ? it.unitPrice : (pMatch?.price || 0);
      let subtotal = typeof it.subtotal === 'number' && it.subtotal > 0 ? it.subtotal : 0;

      if (subtotal === 0 && unitPrice > 0) {
        subtotal = unitPrice * (it.quantity || 1);
      }

      return {
        ...it,
        id: it.id || `item-${idx}`,
        productId: pMatch?.id || it.productId,
        name: it.name || 'สินค้า',
        quantity: it.quantity || 1,
        unit: resolvedUnit,
        unitPrice,
        subtotal,
      };
    });

    // Reconcile amounts if order.totalAmount is present
    if (resolved.length === 1 && resolved[0].subtotal === 0 && order.totalAmount > 0) {
      resolved[0].subtotal = order.totalAmount;
      resolved[0].unitPrice =
        resolved[0].quantity > 0
          ? Math.round((order.totalAmount / resolved[0].quantity) * 100) / 100
          : order.totalAmount;
    } else if (resolved.length > 1 && order.totalAmount > 0) {
      const knownSum = resolved.reduce((sum, item) => sum + (item.subtotal || 0), 0);
      const zeroItems = resolved.filter((item) => !item.subtotal || item.subtotal === 0);
      if (zeroItems.length === 1 && knownSum < order.totalAmount) {
        const remaining = order.totalAmount - knownSum;
        zeroItems[0].subtotal = remaining;
        zeroItems[0].unitPrice =
          zeroItems[0].quantity > 0
            ? Math.round((remaining / zeroItems[0].quantity) * 100) / 100
            : remaining;
      }
    }

    return {
      resolvedItems: resolved,
      resolvedFreebies: parsedFreebieItems,
    };
  }, [order.items, order.freebies, order.totalAmount, products]);

  // Recalculated total if totalAmount was 0 but items have subtotal
  const resolvedTotalAmount = useMemo(() => {
    if (order.totalAmount && order.totalAmount > 0) return order.totalAmount;
    const sum = resolvedItems.reduce((acc, it) => acc + (it.subtotal || 0), 0);
    return sum > 0 ? sum : 0;
  }, [order.totalAmount, resolvedItems]);

  const resolvedNetAmount = useMemo(() => {
    if (order.netAmount && order.netAmount > 0) return order.netAmount;
    const net = resolvedTotalAmount - (order.discount || 0);
    return net > 0 ? net : 0;
  }, [order.netAmount, resolvedTotalAmount, order.discount]);

  // 3. Status Badge Component with all 5 statuses
  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-white shadow-xs border border-amber-600">
            <Clock className="w-3.5 h-3.5 text-amber-50" />
            <span>รอจัดส่ง</span>
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-600 text-white shadow-xs border border-blue-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-100" />
            <span>ยืนยันแล้ว</span>
          </span>
        );
      case 'delivering':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-600 text-white shadow-xs border border-indigo-700">
            <Truck className="w-3.5 h-3.5 text-indigo-100 animate-pulse" />
            <span>กำลังจัดส่ง</span>
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-xs border border-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-100" />
            <span>ส่งมอบสำเร็จ</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-600 text-white shadow-xs border border-rose-700">
            <XCircle className="w-3.5 h-3.5 text-rose-100" />
            <span>ยกเลิก</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-500 text-white shadow-xs">
            <span>{status}</span>
          </span>
        );
    }
  };

  const lineShareUrl = getLineShareUrl({
    ...order,
    items: resolvedItems,
    freebies: resolvedFreebies,
    totalAmount: resolvedTotalAmount,
    netAmount: resolvedNetAmount,
    customerPhone: resolvedPhone,
  });

  const isEditable = order.status !== 'completed' && order.status !== 'cancelled';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      id="order-detail-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 gpu-layer overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="order-detail-card"
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                  {order.orderNumber}
                </h2>
                {getStatusBadge(order.status)}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                ลงออเดอร์เมื่อ: {formatThaiDateTimeFull(order.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {onEditOrder && isEditable && (
              <button
                id="btn-edit-order-detail-header"
                type="button"
                onClick={() => onEditOrder(order)}
                title="แก้ไขออเดอร์"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>แก้ไขออเดอร์</span>
              </button>
            )}
            <button
              onClick={handlePrint}
              title="พิมพ์ใบสั่งสินค้า"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5">
          {/* Notice if order is completed or cancelled */}
          {!isEditable && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium">
              <Lock className="w-4 h-4 text-slate-500 shrink-0" />
              <span>
                ออเดอร์นี้อยู่ในสถานะ <strong>{order.status === 'completed' ? 'ส่งมอบสำเร็จ' : 'ยกเลิก'}</strong> แล้ว ข้อมูลถูกบันทึกสมบูรณ์
              </span>
            </div>
          )}

          {/* Status Sync & Quick Control Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-slate-600">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>สถานะฐานข้อมูล:</span>
              <strong className={order.syncedToSheets ? 'text-emerald-700' : 'text-amber-700'}>
                {order.syncedToSheets ? 'ซิงค์ลง Google Sheets เรียบร้อย' : 'บันทึกในเครื่อง (รอซิงค์ลง Sheets)'}
              </strong>
            </span>

            {/* Quick Status Control Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {order.status === 'pending' && (
                <>
                  <button
                    type="button"
                    onClick={() => onUpdateStatus(order.id, 'confirmed')}
                    className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] border border-blue-200 transition-colors cursor-pointer"
                  >
                    ✓ ยืนยัน
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateStatus(order.id, 'delivering')}
                    className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] border border-indigo-200 transition-colors cursor-pointer"
                  >
                    🚚 เริ่มจัดส่ง
                  </button>
                </>
              )}

              {order.status === 'confirmed' && (
                <button
                  type="button"
                  onClick={() => onUpdateStatus(order.id, 'delivering')}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] transition-colors cursor-pointer"
                >
                  🚚 เริ่มจัดส่งสินค้า
                </button>
              )}

              {order.status === 'delivering' && (
                <>
                  <button
                    type="button"
                    onClick={() => onUpdateStatus(order.id, 'completed')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors cursor-pointer"
                  >
                    ✓ ส่งมอบสำเร็จ
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateStatus(order.id, 'pending')}
                    title="ย้อนกลับไปรอจัดส่ง"
                    className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium text-[11px] transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </>
              )}

              {order.status !== 'cancelled' && order.status !== 'completed' && (
                <button
                  type="button"
                  onClick={() => onUpdateStatus(order.id, 'cancelled')}
                  className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium text-[11px] border border-rose-200 transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
              )}
            </div>
          </div>

          {/* Customer & Location Info Card */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3.5 shadow-2xs">
            <div className="flex items-start justify-between flex-wrap gap-2.5">
              <div className="space-y-1">
                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
                  ลูกค้า / ร้านค้า
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    {order.customerName || 'ไม่ระบุชื่อลูกค้า'}
                  </h3>
                  {resolvedRouteName && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      <Compass className="w-3 h-3 text-blue-600" />
                      <span>{resolvedRouteName}</span>
                    </span>
                  )}
                </div>

                {displayPhone ? (
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-xs font-semibold text-slate-700">{displayPhone}</span>
                    <a
                      href={`tel:${resolvedPhone.replace(/[^0-9+]/g, '')}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs transition-colors"
                    >
                      <Phone className="w-3 h-3" />
                      <span>โทรหาลูกค้า</span>
                    </a>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 italic">ไม่ได้ระบุเบอร์ติดต่อ</span>
                )}
              </div>

              <div className="text-left sm:text-right">
                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
                  พนักงานขาย (เซลล์)
                </span>
                <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5 sm:justify-end mt-0.5">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  <span>{order.salespersonName || order.salespersonId || 'ไม่ระบุพนักงานขาย'}</span>
                </div>
                {order.salespersonId && order.salespersonName && order.salespersonId !== order.salespersonName && (
                  <span className="text-[11px] text-slate-500 block">
                    รหัส: {order.salespersonId}
                  </span>
                )}
              </div>
            </div>

            {/* Delivery Address & Navigation */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700 leading-relaxed break-words">
                  <span className="font-semibold text-slate-800">สถานที่ส่งของ: </span>
                  <span>{resolvedAddress}</span>
                </div>
              </div>

              {resolvedMapsUrl ? (
                <a
                  href={resolvedMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs shrink-0 transition-all cursor-pointer hover:shadow-sm"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>กดนำทาง Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span className="text-[11px] text-slate-400 italic shrink-0">
                  ไม่มีลิงก์พิกัดแผนที่
                </span>
              )}
            </div>
          </div>

          {/* Items & Freebies List */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                รายการสินค้า ({resolvedItems.length} รายการ)
              </h4>
            </div>

            <div className="divide-y divide-slate-100">
              {resolvedItems.length === 0 ? (
                <div className="py-3 text-center text-xs text-slate-400">
                  ไม่มีรายการสินค้า
                </div>
              ) : (
                resolvedItems.map((it, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between text-sm gap-2.5">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 font-bold text-[11px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-800 truncate">{it.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>
                            จำนวน <strong className="text-slate-800">{it.quantity}</strong> {it.unit || 'ชิ้น'}
                          </span>
                          {it.unitPrice > 0 && (
                            <span className="text-slate-400 text-[11px]">
                              (@ ฿{it.unitPrice.toLocaleString()})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="font-extrabold text-slate-900 text-right shrink-0">
                      {it.subtotal > 0 ? (
                        <span>฿{it.subtotal.toLocaleString()}</span>
                      ) : (
                        <span className="text-slate-400 font-normal">-</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Freebies Section */}
            {resolvedFreebies && resolvedFreebies.length > 0 && (
              <div className="mt-3 pt-3 border-t border-emerald-100 bg-emerald-50/50 -mx-4 -mb-4 p-4 rounded-b-xl">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 mb-2">
                  <Gift className="w-3.5 h-3.5 text-emerald-600" />
                  <span>ของแถมพิเศษ ({resolvedFreebies.length} รายการ)</span>
                </div>
                <div className="space-y-1.5 divide-y divide-emerald-100">
                  {resolvedFreebies.map((fb, idx) => (
                    <div key={idx} className="pt-1.5 first:pt-0 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800">{fb.name}</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">
                          แถมฟรี
                        </span>
                        {fb.note && (
                          <span className="text-[11px] text-emerald-700 italic">
                            ({fb.note})
                          </span>
                        )}
                      </div>
                      <div className="font-extrabold text-emerald-800">
                        {fb.quantity} {fb.unit || 'ชิ้น'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Financial Summary */}
            <div className="pt-3.5 border-t border-slate-200 space-y-1.5 text-xs mt-3">
              <div className="flex justify-between text-slate-600">
                <span>ยอดรวมสินค้า:</span>
                <span className="font-semibold">฿{resolvedTotalAmount.toLocaleString()}</span>
              </div>
              {order.discount ? (
                <div className="flex justify-between text-rose-600 font-medium">
                  <span>ส่วนลดพิเศษ:</span>
                  <span>-฿{order.discount.toLocaleString()}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-slate-900 font-extrabold text-base pt-2 border-t border-slate-200">
                <span>ยอดสุทธิที่ต้องชำระ:</span>
                <span className="text-blue-700 text-lg">฿{resolvedNetAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Delivery Date, Payment Method & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200">
              <span className="text-blue-700 font-semibold block mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-600" /> วันที่ต้องการให้ส่ง:
              </span>
              <span className="font-extrabold text-slate-900 text-sm block">
                {formatDeliveryDate(order.requestedDeliveryDate)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-400 font-medium block mb-1">วิธีชำระเงิน:</span>
              <span className="font-bold text-slate-800 text-sm block">
                {getPaymentMethodLabel(order.paymentMethod)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-400 font-medium block mb-1">หมายเหตุเพิ่มเติม:</span>
              <span className="font-medium text-slate-800 block line-clamp-2">
                {order.note && order.note !== '-' ? order.note : 'ไม่มีหมายเหตุ'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {onEditOrder && (
              isEditable ? (
                <button
                  id="btn-edit-order-detail-footer"
                  type="button"
                  onClick={() => onEditOrder(order)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>แก้ไขออเดอร์</span>
                </button>
              ) : (
                <div
                  title="ไม่สามารถแก้ไขออเดอร์ที่จัดส่งสำเร็จหรือยกเลิกแล้วได้"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-400 text-xs sm:text-sm font-medium border border-slate-200 cursor-not-allowed select-none"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>ล็อกการแก้ไข ({order.status === 'completed' ? 'ส่งมอบสำเร็จ' : 'ยกเลิก'})</span>
                </div>
              )
            )}

            <a
              href={lineShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#06C755] hover:bg-[#05b04c] text-white text-xs font-bold transition-colors shadow-xs"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>แชร์ LINE</span>
            </a>

            {/* Role-based Delivery Controls */}
            {order.status === 'pending' && (
              <button
                id="btn-update-delivering-footer"
                onClick={() => onUpdateStatus(order.id, 'delivering')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>เริ่มจัดส่ง</span>
              </button>
            )}

            {order.status === 'delivering' && (
              <button
                id="btn-update-completed-footer"
                onClick={() => onUpdateStatus(order.id, 'completed')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>ส่งมอบสำเร็จ</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
