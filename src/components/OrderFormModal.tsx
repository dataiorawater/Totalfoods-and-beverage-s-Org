import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TotalEmblem } from './TotalLogo';
import { Order, OrderItem, Product, StaffUser, Customer, FreebieItem } from '../types';
import {
  X,
  Plus,
  Minus,
  Trash2,
  MapPin,
  Phone,
  User,
  Users,
  Calendar,
  Package,
  FileText,
  Banknote,
  Send,
  Loader2,
  ExternalLink,
  CheckCircle2,
  Search,
  Clock,
  CalendarDays,
  RefreshCw,
  Check,
  Tag,
  ShoppingCart,
  Layers,
  Building,
  Lock,
  Gift,
} from 'lucide-react';

interface OrderFormModalProps {
  isOpen: boolean;
  currentUser: StaffUser;
  products: Product[];
  customers?: Customer[];
  initialCustomer?: Customer | null;
  editingOrder?: Order | null;
  onClose: () => void;
  onSubmitOrder: (orderData: Omit<Order, 'id' | 'orderNumber' | 'syncedToSheets'>) => Promise<void>;
  onUpdateOrder?: (orderId: string, orderData: Partial<Order>) => Promise<void>;
  onRefreshProducts?: () => Promise<void>;
  onRefreshCustomers?: () => Promise<void>;
  sheetsConnected?: boolean;
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

export const OrderFormModal: React.FC<OrderFormModalProps> = ({
  isOpen,
  currentUser,
  products,
  customers = [],
  initialCustomer,
  editingOrder,
  onClose,
  onSubmitOrder,
  onUpdateOrder,
  onRefreshProducts,
  onRefreshCustomers,
  sheetsConnected = true,
}) => {
  // 1. Salesperson: Auto loaded from login
  const [salespersonName, setSalespersonName] = useState(currentUser.name);
  const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false);

  // 2. Order Date & Time: Auto-filled with current date/time
  const getNowFormatted = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    const localISOTime = new Date(d.getTime() - offset).toISOString().slice(0, 16);
    return localISOTime;
  };
  const [orderDateTime, setOrderDateTime] = useState(getNowFormatted());

  // 3. Customer Info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isRefreshingCustomers, setIsRefreshingCustomers] = useState(false);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [lastSelectedCustomer, setLastSelectedCustomer] = useState<Customer | null>(null);
  const customerInputContainerRef = useRef<HTMLDivElement>(null);

  // Click outside to close customer name suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        customerInputContainerRef.current &&
        !customerInputContainerRef.current.contains(event.target as Node)
      ) {
        setShowNameSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Real-time matching customers as user types in customerName
  const matchingCustomers = useMemo(() => {
    if (!customers || customers.length === 0) return [];
    const q = customerName.trim().toLowerCase();
    if (!q) return [];
    const cleanQ = q.replace(/[^0-9]/g, '');
    return customers
      .filter((c) => {
        const nameMatch = c?.name ? String(c.name).toLowerCase().includes(q) : false;
        const addrMatch = c.address ? String(c.address).toLowerCase().includes(q) : false;
        const phoneMatch = c.phone ? String(c.phone).toLowerCase().includes(q) : false;
        const cleanPhone = c.phone ? String(c.phone).replace(/[^0-9]/g, '') : '';
        const numMatch = cleanQ.length >= 2 && cleanPhone.includes(cleanQ);
        return nameMatch || addrMatch || phoneMatch || numMatch;
      })
      .slice(0, 8); // Top 8 matching customers
  }, [customers, customerName]);

  const handleSelectCustomer = (c: Customer) => {
    setCustomerName(c.name ? String(c.name) : '');
    setCustomerPhone(c.phone !== undefined && c.phone !== null ? String(c.phone) : '');
    if (c.address) {
      setAddress(String(c.address));
    }
    if (c.mapsUrl) {
      setMapsUrl(String(c.mapsUrl));
      try {
        const urlObj = new URL(c.mapsUrl);
        const qParam = urlObj.searchParams.get('q');
        if (qParam && qParam.includes(',')) {
          const [lat, lng] = qParam.split(',');
          const pLat = parseFloat(lat);
          const pLng = parseFloat(lng);
          if (!isNaN(pLat) && !isNaN(pLng)) {
            setLatitude(pLat);
            setLongitude(pLng);
          }
        }
      } catch {
        // ignore
      }
    }
    setLastSelectedCustomer(c);
    setShowNameSuggestions(false);
  };

  useEffect(() => {
    if (initialCustomer && isOpen) {
      handleSelectCustomer(initialCustomer);
    }
  }, [initialCustomer, isOpen]);

  const handleRefreshCustomerList = async () => {
    if (!onRefreshCustomers) return;
    setIsRefreshingCustomers(true);
    try {
      await onRefreshCustomers();
    } finally {
      setIsRefreshingCustomers(false);
    }
  };

  // 4. Products & Items
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
  const [freebieItems, setFreebieItems] = useState<FreebieItem[]>([]);

  // Product selector modal/dropdown helpers
  const [searchProduct, setSearchProduct] = useState('');
  const [productCategory, setProductCategory] = useState('all');

  // 5. Requested Delivery Date (วันที่ต้องการสินค้า)
  const getTomorrowDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  };
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState(getTomorrowDate());
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState<'anytime' | 'morning' | 'afternoon' | 'custom'>('anytime');
  const [customDeliveryTime, setCustomDeliveryTime] = useState('');

  const getFormattedDeliveryDate = () => {
    if (!requestedDeliveryDate) return 'ตามรอบปกติ';
    let slotText = '';
    if (deliveryTimeSlot === 'morning') slotText = ' (ช่วงเช้า 08:30 - 12:00)';
    else if (deliveryTimeSlot === 'afternoon') slotText = ' (ช่วงบ่าย 13:00 - 17:00)';
    else if (deliveryTimeSlot === 'custom' && customDeliveryTime) slotText = ` (เวลา ${customDeliveryTime} น.)`;
    return `${requestedDeliveryDate}${slotText}`;
  };

  // 6. Notes & Payment
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'transfer' | 'cash'>('transfer');

  // 7. Discount
  const [discount, setDiscount] = useState<number>(0);

  // Customer Location (Auto filled from selected customer)
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [mapsUrl, setMapsUrl] = useState('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setSalespersonName(currentUser.name);
  }, [currentUser]);

  // Pre-fill form when editing an existing order or reset when opening fresh
  useEffect(() => {
    if (!isOpen) return;

    if (editingOrder) {
      setSalespersonName(editingOrder.salespersonName || currentUser.name);
      if (editingOrder.createdAt) {
        try {
          const d = parseDateRobust(editingOrder.createdAt);
          const offset = d.getTimezoneOffset() * 60000;
          const localISOTime = new Date(d.getTime() - offset).toISOString().slice(0, 16);
          setOrderDateTime(localISOTime);
        } catch {
          // ignore
        }
      }
      setCustomerName(editingOrder.customerName ? String(editingOrder.customerName) : '');
      setCustomerPhone(editingOrder.customerPhone !== undefined && editingOrder.customerPhone !== null ? String(editingOrder.customerPhone) : '');
      setSelectedItems(editingOrder.items ? [...editingOrder.items] : []);
      setFreebieItems(editingOrder.freebies ? [...editingOrder.freebies] : []);

      if (editingOrder.requestedDeliveryDate) {
        const match = editingOrder.requestedDeliveryDate.match(/^\d{4}-\d{2}-\d{2}/);
        if (match) {
          setRequestedDeliveryDate(match[0]);
        }
        if (editingOrder.requestedDeliveryDate.includes('ช่วงเช้า')) {
          setDeliveryTimeSlot('morning');
        } else if (editingOrder.requestedDeliveryDate.includes('ช่วงบ่าย')) {
          setDeliveryTimeSlot('afternoon');
        } else if (editingOrder.requestedDeliveryDate.includes('เวลา')) {
          setDeliveryTimeSlot('custom');
          const timeMatch = editingOrder.requestedDeliveryDate.match(/เวลา\s*([\d:]+)/);
          if (timeMatch) setCustomDeliveryTime(timeMatch[1]);
        } else {
          setDeliveryTimeSlot('anytime');
        }
      }

      setNote(editingOrder.note || '');
      setPaymentMethod(editingOrder.paymentMethod === 'cash' ? 'cash' : 'transfer');
      setDiscount(editingOrder.discount || 0);
      setAddress(editingOrder.location?.address || '');
      setLatitude(editingOrder.location?.latitude);
      setLongitude(editingOrder.location?.longitude);
      setMapsUrl(editingOrder.location?.mapsUrl || '');
    } else if (!initialCustomer) {
      // Clean slate for new order
      setCustomerName('');
      setCustomerPhone('');
      setAddress('');
      setLatitude(undefined);
      setLongitude(undefined);
      setMapsUrl('');
      setSelectedItems([]);
      setFreebieItems([]);
      setNote('');
      setDiscount(0);
      setPaymentMethod('transfer');
      setOrderDateTime(getNowFormatted());
      setRequestedDeliveryDate(getTomorrowDate());
      setDeliveryTimeSlot('anytime');
      setCustomDeliveryTime('');
    }
  }, [editingOrder, isOpen, initialCustomer]);

  // Toggle selection of product from catalog (Select only - quantity entered in cart)
  const handleToggleProductSelection = (prod: Product) => {
    const existingIndex = selectedItems.findIndex((it) => it.productId === prod.id);
    if (existingIndex > -1) {
      handleRemoveItem(existingIndex);
    } else {
      setSelectedItems([
        ...selectedItems,
        {
          id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          productId: prod.id,
          name: prod.name,
          quantity: 1,
          unitPrice: prod.price,
          subtotal: prod.price,
          unit: prod.unit,
        },
      ]);
    }
  };

  // Check if product is in selected items
  const isProductSelected = (productId?: string) => {
    if (!productId) return false;
    return selectedItems.some((it) => it.productId === productId);
  };

  // Check if product is in selected items and get quantity
  const getItemQuantity = (productId?: string) => {
    if (!productId) return 0;
    const found = selectedItems.find((it) => it.productId === productId);
    return found ? found.quantity : 0;
  };

  // Refresh Catalog from Google Sheets
  const handleRefreshCatalog = async () => {
    if (!onRefreshProducts) return;
    setIsRefreshingCatalog(true);
    try {
      await onRefreshProducts();
    } catch (e) {
      console.warn('Refresh products error:', e);
    } finally {
      setIsRefreshingCatalog(false);
    }
  };

  // Custom Item
  const handleAddCustomItem = () => {
    setSelectedItems([
      ...selectedItems,
      {
        id: `custom-${Date.now()}`,
        name: 'สินค้าสั่งพิเศษ',
        quantity: 1,
        unitPrice: 100,
        subtotal: 100,
        unit: 'ชิ้น',
      },
    ]);
  };

  // Update item quantity
  const handleUpdateQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }
    const updated = [...selectedItems];
    updated[index].quantity = newQty;
    updated[index].subtotal = newQty * updated[index].unitPrice;
    setSelectedItems(updated);
  };

  // Update item price
  const handleUpdatePrice = (index: number, newPrice: number) => {
    const updated = [...selectedItems];
    updated[index].unitPrice = Math.max(0, newPrice);
    updated[index].subtotal = updated[index].quantity * updated[index].unitPrice;
    setSelectedItems(updated);
  };

  // Update item name
  const handleUpdateName = (index: number, newName: string) => {
    const updated = [...selectedItems];
    updated[index].name = newName;
    setSelectedItems(updated);
  };

  // Remove item
  const handleRemoveItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  // --- Complimentary Items (รายการสินค้าแถมฟรี) Helpers ---
  const handleAddFreebieFromProduct = (prod: Product) => {
    const existingIndex = freebieItems.findIndex((it) => it.productId === prod.id);
    if (existingIndex > -1) {
      const updated = [...freebieItems];
      updated[existingIndex].quantity += 1;
      setFreebieItems(updated);
    } else {
      setFreebieItems([
        ...freebieItems,
        {
          id: `fb-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          productId: prod.id,
          name: prod.name,
          quantity: 1,
          unit: prod.unit || 'ชิ้น',
          note: 'แถมฟรี',
        },
      ]);
    }
  };

  const handleUpdateFreebieQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveFreebie(index);
      return;
    }
    const updated = [...freebieItems];
    updated[index].quantity = newQty;
    setFreebieItems(updated);
  };

  const handleUpdateFreebieNote = (index: number, newNote: string) => {
    const updated = [...freebieItems];
    updated[index].note = newNote;
    setFreebieItems(updated);
  };

  const handleRemoveFreebie = (index: number) => {
    setFreebieItems(freebieItems.filter((_, i) => i !== index));
  };

  // Auto-calculated totals
  const totalQuantity = selectedItems.reduce((acc, item) => acc + item.quantity, 0);
  const totalFreebieQuantity = freebieItems.reduce((acc, item) => acc + item.quantity, 0);
  const overallTotalQuantity = totalQuantity + totalFreebieQuantity;
  const totalAmount = selectedItems.reduce((acc, item) => acc + item.subtotal, 0);
  const netAmount = Math.max(0, totalAmount - (discount || 0));

  // Form Submission
  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanCustName = String(customerName || '').trim();
    const cleanCustPhone = String(customerPhone || '').trim();

    if (!cleanCustName) {
      setErrorMessage('กรุณาระบุชื่อลูกค้า');
      return;
    }
    if (!cleanCustPhone) {
      setErrorMessage('กรุณาระบุเบอร์ติดต่อลูกค้า');
      return;
    }
    if (selectedItems.length === 0) {
      setErrorMessage('กรุณาเลือกรายการสินค้าอย่างน้อย 1 รายการ');
      return;
    }
    
    if (editingOrder && onUpdateOrder) {
      if (editingOrder.status === 'delivering' || editingOrder.status === 'completed') {
        setErrorMessage('ไม่สามารถบันทึกการแก้ไขได้ เนื่องจากออเดอร์นี้อยู่ในสถานะกำลังจัดส่งหรือส่งมอบสำเร็จแล้ว');
        return;
      }
    }
    
    setShowConfirmModal(true);
  };

  const executeSubmit = async () => {
    setIsSubmitting(true);
    try {
      const cleanCustName = String(customerName || '').trim();
      const cleanCustPhone = String(customerPhone || '').trim();
      const cleanSalesperson = String(salespersonName || '').trim() || currentUser.name;
      const cleanAddress = String(address || '').trim();
      const cleanNote = String(note || '').trim();

      // Ensure mapsUrl is constructed if not set
      let finalMapsUrl = String(mapsUrl || '').trim();
      if (!finalMapsUrl && latitude && longitude) {
        finalMapsUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
      } else if (!finalMapsUrl && cleanAddress) {
        finalMapsUrl = `https://maps.google.com/?q=${encodeURIComponent(cleanAddress)}`;
      }

      if (editingOrder && onUpdateOrder) {
        await onUpdateOrder(editingOrder.id, {
          customerName: cleanCustName,
          customerPhone: cleanCustPhone,
          salespersonName: cleanSalesperson,
          requestedDeliveryDate: getFormattedDeliveryDate(),
          items: selectedItems,
          freebies: freebieItems,
          totalAmount,
          discount: Number(discount) || 0,
          netAmount,
          note: cleanNote,
          paymentMethod,
          location: {
            address: cleanAddress,
            latitude,
            longitude,
            mapsUrl: finalMapsUrl,
          },
        });
        onClose();
        return;
      }

      await onSubmitOrder({
        createdAt: new Date(orderDateTime).toISOString(),
        requestedDeliveryDate: getFormattedDeliveryDate(),
        salespersonId: currentUser.id,
        salespersonEmail: currentUser.email,
        salespersonName: cleanSalesperson,
        customerName: cleanCustName,
        customerPhone: cleanCustPhone,
        items: selectedItems,
        freebies: freebieItems,
        totalAmount,
        discount: Number(discount) || 0,
        netAmount,
        note: cleanNote,
        paymentMethod,
        location: {
          address: cleanAddress,
          latitude,
          longitude,
          mapsUrl: finalMapsUrl,
        },
        status: 'pending',
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการบันทึกออเดอร์');
      setShowConfirmModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter products for quick add catalog from Google Sheets
  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
    return ['all', ...cats];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = productCategory === 'all' || p.category === productCategory;
      const q = searchProduct.toLowerCase().trim();
      if (!q) return matchCat;
      const matchSearch =
        p?.name?.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        String(p.price).includes(q);
      return matchCat && matchSearch;
    });
  }, [products, productCategory, searchProduct]);

  if (!isOpen) return null;

  return (
    <div className="w-full max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div
        id="new-order-page-card"
        className="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col mb-10"
      >
        {/* Modal Header */}
        <div className="p-3 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-700 to-indigo-800 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center p-0.5 shadow-sm border border-white/20">
              <TotalEmblem className="w-8 h-8 drop-shadow-xs" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                {editingOrder ? `แก้ไขรายการออเดอร์ (${editingOrder.orderNumber})` : 'ลงออเดอร์'}
              </h2>
            </div>
          </div>
          <button
            id="btn-close-order-modal"
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1.5 font-medium text-xs sm:text-sm"
          >
            <X className="w-4 h-4" />
            <span>ยกเลิก</span>
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handlePreSubmit} className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              {errorMessage}
            </div>
          )}

          {/* Section 1 & 2: Salesperson and Date Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            {/* 1. Salesperson Name (Auto filled from logged-in staff) */}
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3.5">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-xs font-bold">
                  1
                </span>
                ชื่อเซลล์ (ดึงตามการล็อกอิน)
                <span className="text-blue-600 text-[10px] bg-blue-100 px-1.5 py-0.2 rounded font-normal">
                  อัตโนมัติ
                </span>
              </h3>
              <div className="relative">
                <input
                  id="order-salesperson-name"
                  type="text"
                  value={salespersonName}
                  onChange={(e) => setSalespersonName(e.target.value)}
                  required
                  placeholder="ชื่อ-นามสกุล เซลล์ผู้รับออเดอร์"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-slate-800"
                />
              </div>
              <span className="text-[11px] text-slate-500 block">
                ล็อกอินในนาม: <strong className="text-slate-700">{currentUser.name}</strong> ({currentUser.role})
              </span>
            </div>

            {/* 2. Order Date & Time (Locked to current time, non-editable) */}
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3.5">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-xs font-bold">
                  2
                </span>
                วันที่ลงออเดอร์
              </h3>
              <div className="relative">
                <input
                  id="order-datetime"
                  type="datetime-local"
                  value={orderDateTime}
                  readOnly
                  disabled
                  tabIndex={-1}
                  className="w-full px-3 py-2 text-sm bg-slate-100/90 border border-slate-200 rounded-lg text-slate-600 font-semibold cursor-not-allowed select-none opacity-90 shadow-2xs"
                  title="วันที่ลงออเดอร์จะถูกบันทึกอัตโนมัติตามเวลาปัจจุบัน และไม่สามารถแก้ไขได้"
                />
              </div>
              <span className="text-[11px] text-slate-500 block">
                บันทึกเวลา: <strong className="text-slate-700 font-semibold">{orderDateTime ? new Date(orderDateTime).toLocaleString('th-TH') : '-'}</strong>
              </span>
            </div>
          </div>

          {/* Section 3: Customer Information */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-xs font-bold">
                    3
                  </span>
                  ข้อมูลลูกค้าและเบอร์ติดต่อ
                </h3>
                <span className="text-[11px] text-blue-800 bg-blue-100/80 border border-blue-200 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                  มีข้อมูลลูกค้า {customers.length} ราย
                </span>
              </div>

              
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div ref={customerInputContainerRef} className="relative">
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between flex-wrap gap-1">
                  <span className="flex items-center gap-1.5">
                    <span>ชื่อลูกค้า / บริษัท / ร้านค้า</span>
                    <span className="text-rose-500">*</span>
                  </span>
                  {lastSelectedCustomer && lastSelectedCustomer.name === customerName ? (
                    <span className="text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-blue-600" /> ลูกค้าเดิมจาก Sheets
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-normal">
                      (พิมพ์เพื่อค้นหาลูกค้าเดิมอัตโนมัติ)
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    id="order-customer-name"
                    type="text"
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      setShowNameSuggestions(true);
                    }}
                    onFocus={() => {
                      if (String(customerName || '').trim().length > 0) {
                        setShowNameSuggestions(true);
                      }
                    }}
                    required
                    autoComplete="off"
                    placeholder="พิมพ์ชื่อลูกค้า หรือเบอร์โทร..."
                    className="w-full pl-9 pr-8 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  {customerName && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerName('');
                        setShowNameSuggestions(false);
                        setLastSelectedCustomer(null);
                      }}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full cursor-pointer"
                      title="ล้างข้อความ"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Auto-suggest dropdown when typing */}
                {showNameSuggestions && String(customerName || '').trim().length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white rounded-xl shadow-2xl border border-blue-200/90 overflow-hidden divide-y divide-slate-100 max-h-64 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                    <div className="p-2.5 bg-blue-50/80 border-b border-blue-100 flex items-center justify-between text-[11px]">
                      <span className="font-bold text-blue-900 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-blue-700" />
                        ลูกค้าเดิมที่ตรงกับการค้นหา ({matchingCustomers.length})
                      </span>
                      <span className="text-slate-500 text-[10px]">
                        คลิกเพื่อเลือกลงฟอร์มทันที
                      </span>
                    </div>

                    {matchingCustomers.length === 0 ? (
                      <div className="p-3.5 text-center text-xs text-slate-500">
                        <p className="font-semibold text-slate-700">ไม่พบลูกค้าเดิมที่ตรงกับ "{customerName}"</p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          คุณสามารถพิมพ์ต่อเพื่อบันทึกเป็นลูกค้าใหม่ได้ทันที
                        </p>
                      </div>
                    ) : (
                      matchingCustomers.map((c) => (
                        <div
                          key={c.id || c.name + c.phone}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectCustomer(c);
                          }}
                          className="p-3 hover:bg-blue-50/90 transition-colors cursor-pointer flex items-center justify-between gap-2.5 group"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-900 group-hover:text-blue-800">
                                {c.name}
                              </span>
                              {c.phone && (
                                <span className="text-[11px] font-semibold text-blue-700 bg-blue-100/80 px-1.5 py-0.2 rounded border border-blue-200/60 flex items-center gap-0.5">
                                  <Phone className="w-2.5 h-2.5" />
                                  {c.phone}
                                </span>
                              )}
                            </div>
                            {c.address && (
                              <p className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{c.address}</span>
                              </p>
                            )}
                          </div>

                          <div className="shrink-0 flex items-center gap-1.5">
                            {c.mapsUrl && (
                              <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200/60 flex items-center gap-0.5">
                                มี GPS
                              </span>
                            )}
                            <span className="text-[11px] font-bold text-blue-700 bg-blue-100 group-hover:bg-blue-600 group-hover:text-white px-2.5 py-1 rounded-lg transition-colors">
                              เลือกลูกค้าคนนี้
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>เบอร์โทรติดต่อลูกค้า <span className="text-rose-500">*</span></span>
                  {customerPhone && (
                    <a
                      href={`tel:${customerPhone}`}
                      className="text-[11px] text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3" /> โทรออก
                    </a>
                  )}
                </label>
                <div className="relative">
                  <input
                    id="order-customer-phone"
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    required
                    placeholder="เช่น 081-234-5678"
                    className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                </div>
              </div>
            </div>


          </div>

          {/* Section 4: Product Items Catalog & Selection - Compact & Mobile-First */}
          <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-xs font-bold">
                  4
                </span>
                <span>รายการสินค้าและจำนวน</span>
                
              </h3>

              
            </div>

            {/* Quick Catalog Box to Add Products from Google Sheets - Extra Compact & Mobile Optimized */}
            <div className="bg-slate-50/90 p-2 sm:p-3 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                <div className="flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="font-bold text-xs text-slate-800">แคตตาล็อกสินค้า</span>
                  <span className="text-[10px] text-blue-800 bg-blue-100 border border-blue-200 px-1.5 py-0.2 rounded-full font-semibold">
                    {products.length} รายการ
                  </span>
                </div>

                {/* Search input with clear button */}
                <div className="relative flex-1 sm:w-56 sm:flex-initial min-w-[140px]">
                  <input
                    type="text"
                    placeholder="ค้นหาสินค้า, SKU..."
                    value={searchProduct}
                    onChange={(e) => setSearchProduct(e.target.value)}
                    className="w-full pl-7 pr-6 py-1 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-2xs"
                  />
                  <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2 pointer-events-none" />
                  {searchProduct && (
                    <button
                      type="button"
                      onClick={() => setSearchProduct('')}
                      className="absolute right-1.5 top-1.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Category Filter Pills - Compact */}
              {categories.length > 2 && (
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar text-xs">
                  {categories.map((cat) => {
                    const isAll = cat === 'all';
                    const count = isAll
                      ? products.length
                      : products.filter((p) => p.category === cat).length;
                    const isActive = productCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setProductCategory(cat)}
                        className={`px-2 py-0.5 rounded-full whitespace-nowrap transition-all font-medium cursor-pointer text-[11px] flex items-center gap-1 ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-2xs font-semibold'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                        }`}
                      >
                        <span>{isAll ? 'ทั้งหมด' : cat}</span>
                        <span
                          className={`text-[9px] px-1 rounded-full ${
                            isActive ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Product Cards Grid - Ultra compact for mobile */}
              {!searchProduct.trim() ? (
                <div className="p-6 text-center bg-white rounded-lg border border-dashed border-slate-300 text-xs text-slate-500 space-y-2">
                  <Search className="w-6 h-6 text-slate-400 mx-auto" />
                  <p className="font-semibold text-slate-700 text-sm">ค้นหาสินค้าเพื่อแสดงแคตตาล็อก</p>
                  <p className="text-[11px] text-slate-400">
                    พิมพ์ชื่อสินค้า หรือ รหัสสินค้า ในช่องค้นหาด้านบนเพื่อแสดงการ์ดสินค้า
                  </p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="p-4 text-center bg-white rounded-lg border border-dashed border-slate-300 text-xs text-slate-500 space-y-2">
                  {products.length === 0 ? (
                    <>
                      <p className="font-semibold text-slate-700">ยังไม่พบรายการสินค้าจาก Google Sheets</p>
                      <p className="text-[11px] text-slate-400">
                        ระบบจะดึงข้อมูลอัตโนมัติจากแท็บ &quot;รายการสินค้า (Products)&quot; ใน Google Sheets
                      </p>
                      {onRefreshProducts && (
                        <button
                          type="button"
                          onClick={handleRefreshCatalog}
                          disabled={isRefreshingCatalog}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-xs transition-colors cursor-pointer"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingCatalog ? 'animate-spin' : ''}`} />
                          <span>ซิงค์สินค้าจาก Google Sheets</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <p>ไม่พบสินค้าที่ตรงกับ &ldquo;{searchProduct}&rdquo;</p>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchProduct('');
                          setProductCategory('all');
                        }}
                        className="text-blue-700 font-semibold hover:underline cursor-pointer text-[11px]"
                      >
                        ล้างการค้นหา
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-64 sm:max-h-72 overflow-y-auto p-1">
                  {filteredProducts.map((prod, idx) => {
                    const isInOrder = isProductSelected(prod.id);
                    const isIora = prod?.name?.toLowerCase().includes('iora');
                    const isHawaii = prod.name.includes('ฮาวาย');

                    let baseClasses = '';
                    if (isInOrder) {
                      baseClasses = 'border-blue-500 bg-blue-50/80 ring-1 ring-blue-500/40';
                    } else if (isIora) {
                      baseClasses = 'border-blue-200 bg-blue-50 hover:border-blue-400 hover:bg-blue-100/50';
                    } else if (isHawaii) {
                      baseClasses = 'border-emerald-200 bg-emerald-50 hover:border-emerald-400 hover:bg-emerald-100/50';
                    } else {
                      baseClasses = 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/20';
                    }

                    return (
                      <div
                        key={prod.id + '-' + idx}
                        id={`catalog-card-${prod.id}`}
                        onClick={() => handleToggleProductSelection(prod)}
                        className={`p-2 sm:p-2.5 rounded-xl border transition-all text-xs flex flex-col justify-between gap-2 shadow-2xs relative cursor-pointer select-none active:scale-[0.99] ${baseClasses}`}
                      >
                        {/* Top Info: Full product name & details */}
                        <div className="space-y-1">
                          <div className="font-bold text-slate-900 text-xs sm:text-sm leading-snug break-words">
                            {prod.name}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 flex-wrap">
                            <span className="text-blue-700 font-extrabold text-xs sm:text-sm">
                              ฿{(prod.price ?? 0).toLocaleString()}
                            </span>
                            <span className="text-slate-500 font-medium">/{prod.unit}</span>
                            {prod.sku && (
                              <span className="hidden sm:inline-block bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-medium">
                                {prod.sku}
                              </span>
                            )}
                            {prod.category && !prod.sku && (
                              <span className="hidden sm:inline-block bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-medium">
                                {prod.category}
                              </span>
                            )}
                            {prod.stock !== undefined && prod.stock > 0 && (
                              <span className="hidden sm:inline-block text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                                สต็อก {prod.stock}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Bottom Actions: แถมฟรี & เลือก (จัดวางอยู่ด้านล่างของกรอบสินค้า) */}
                        <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100 mt-auto">
                          {/* Freebie item add button */}
                          {(() => {
                            const freebie = freebieItems.find((f) => f.productId === prod.id);
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddFreebieFromProduct(prod);
                                }}
                                className={`w-full py-1.5 px-2 text-[11px] font-bold rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                  freebie
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs hover:bg-emerald-700'
                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border-emerald-200'
                                }`}
                                title="กดเพื่อเพิ่มสินค้านี้ลงในรายการของแถม"
                              >
                                <Gift className="w-3 h-3" />
                                <span>{freebie ? `แถม x${freebie.quantity}` : 'แถมฟรี'}</span>
                              </button>
                            );
                          })()}

                          {/* Order item selection button */}
                          {isInOrder ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleProductSelection(prod);
                              }}
                              className="w-full py-1.5 px-2 text-[11px] font-bold text-white bg-blue-600 hover:bg-rose-600 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1 shadow-2xs group/btn"
                              title="คลิกเพื่อยกเลิกการเลือก"
                            >
                              <Check className="w-3 h-3 group-hover/btn:hidden" />
                              <X className="w-3 h-3 hidden group-hover/btn:inline" />
                              <span className="group-hover/btn:hidden">เลือกแล้ว</span>
                              <span className="hidden group-hover/btn:inline">ยกเลิก</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleProductSelection(prod);
                              }}
                              className="w-full py-1.5 px-2 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-600 hover:text-white rounded-lg border border-blue-200 transition-all cursor-pointer flex items-center justify-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              <span>เลือก</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected Items Table / Cart */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
                <span className="flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5 text-blue-600" />
                  <span>รายการสินค้าที่เลือก — ระบุจำนวนที่ต้องการ</span>
                  <span className="text-slate-500 font-normal">({selectedItems.length} รายการ)</span>
                </span>
                <span className="text-blue-700 font-extrabold text-xs sm:text-sm">
                  รวม: ฿{(totalAmount ?? 0).toLocaleString()}
                </span>
              </div>

              {selectedItems.length === 0 ? (
                <div className="p-3.5 rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 text-center text-xs text-slate-500 space-y-1">
                  <Package className="w-5 h-5 text-slate-300 mx-auto" />
                  <p className="font-bold text-slate-700">ยังไม่ได้เลือกสินค้า</p>
                  <p className="text-[11px] text-slate-500">
                    กรุณาคลิกปุ่ม &ldquo;เลือก&rdquo; จากแคตตาล็อกด้านบน จากนั้นจึงใส่จำนวนในช่องด้านล่างนี้
                  </p>
                </div>
              ) : (
                selectedItems.map((item, index) => (
                  <div
                    key={item.id + '-' + index}
                    id={`order-item-row-${index}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleUpdateName(index, e.target.value)}
                        className="text-xs sm:text-sm font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white px-1 py-0.5 rounded w-full"
                      />
                      <div className="text-[11px] text-slate-500 px-1 mt-0.5 flex items-center gap-2">
                        <span>หน่วย: <strong className="text-slate-700">{item.unit || 'ชิ้น'}</strong></span>
                        <span className="text-slate-300">|</span>
                        <span>ราคา @ ฿{(item.unitPrice ?? 0).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 flex-wrap">
                      {/* Quantity input - prominent */}
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-blue-800 hidden xs:inline">จำนวน:</span>
                        <div className="flex items-center border border-blue-300 rounded-lg bg-blue-50/30 overflow-hidden shadow-2xs focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-500/20">
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(index, item.quantity - 1)}
                            className="p-2 sm:p-1.5 hover:bg-blue-100 text-blue-800 transition-colors cursor-pointer"
                            title="ลดจำนวน"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateQty(index, parseInt(e.target.value) || 1)}
                            className="w-12 sm:w-13 text-center text-xs sm:text-sm font-extrabold text-blue-950 py-0.5 sm:py-1 bg-white focus:outline-hidden"
                            title="ใส่จำนวนสินค้า"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(index, item.quantity + 1)}
                            className="p-2 sm:p-1.5 hover:bg-blue-100 text-blue-800 transition-colors cursor-pointer"
                            title="เพิ่มจำนวน"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="text-xs font-semibold text-slate-600">{item.unit || 'ชิ้น'}</span>
                      </div>

                      {/* Unit Price */}
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-slate-400">@</span>
                        <input
                          type="number"
                          min="0"
                          value={item.unitPrice}
                          onChange={(e) => handleUpdatePrice(index, parseFloat(e.target.value) || 0)}
                          className="w-16 sm:w-20 px-1.5 py-0.5 sm:py-1 text-right text-xs bg-white border border-slate-300 rounded font-medium text-slate-800 focus:border-blue-500"
                        />
                        <span className="text-slate-500">฿</span>
                      </div>

                      {/* Subtotal */}
                      <div className="text-xs sm:text-sm font-extrabold text-blue-700 min-w-[65px] sm:min-w-[75px] text-right">
                        ฿{(item.subtotal ?? 0).toLocaleString()}
                      </div>

                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="text-slate-400 hover:text-rose-600 p-2 sm:p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                        title="ลบรายการสินค้า"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section: Complimentary / Free Items (รายการสินค้าแถม) */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-emerald-200/90 shadow-xs space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold">
                  🎁
                </span>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <span>รายการสินค้าแถม (แถมฟรี)</span>
                  {freebieItems.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {freebieItems.length} รายการ
                    </span>
                  )}
                </h3>
              </div>
              <span className="text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                <Gift className="w-3.5 h-3.5 text-emerald-600" />
                <span>กดปุ่ม &ldquo;+ แถมฟรี&rdquo; จากแคตตาล็อกสินค้าด้านบน</span>
              </span>
            </div>

            {freebieItems.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-slate-50 border-2 border-dashed border-emerald-200/80 text-center text-xs text-slate-500 space-y-1">
                <Gift className="w-5 h-5 text-emerald-400 mx-auto" />
                <p className="font-bold text-slate-700">ยังไม่มีรายการแถม</p>
                <p className="text-[11px] text-slate-500">
                  หากมีรายการแถม สามารถกดปุ่ม{' '}
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded font-semibold text-[10px]">
                    <Gift className="w-2.5 h-2.5" /> + แถมฟรี
                  </span>{' '}
                  ที่การ์ดสินค้าในแคตตาล็อกด้านบนเพื่อเพิ่มของแถมได้ทันที
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {freebieItems.map((fb, idx) => (
                  <div
                    key={fb.id || idx}
                    id={`freebie-item-row-${idx}`}
                    className="p-2.5 rounded-xl bg-emerald-50/40 border border-emerald-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Gift className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                          {fb.name}
                        </span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-semibold shrink-0">
                          แถมฟรี (฿0)
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="ระบุเหตุผล เช่น แถมโปรโมชั่น 10 แถม 1, แถมชิม, ของขวัญเปิดบิล"
                          value={fb.note || ''}
                          onChange={(e) => handleUpdateFreebieNote(idx, e.target.value)}
                          className="text-[11px] text-slate-700 bg-white border border-emerald-200 rounded px-2 py-1 w-full max-w-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-slate-400"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-emerald-900">จำนวน:</span>
                        <div className="flex items-center border border-emerald-300 rounded-lg bg-white overflow-hidden shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleUpdateFreebieQty(idx, fb.quantity - 1)}
                            className="p-1 sm:p-1.5 hover:bg-emerald-50 text-emerald-800 transition-colors cursor-pointer"
                            title="ลดจำนวนของแถม"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={fb.quantity}
                            onChange={(e) => handleUpdateFreebieQty(idx, parseInt(e.target.value) || 1)}
                            className="w-12 sm:w-13 text-center text-xs sm:text-sm font-extrabold text-emerald-950 py-0.5 sm:py-1 bg-transparent focus:outline-hidden"
                            title="จำนวนของแถม"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateFreebieQty(idx, fb.quantity + 1)}
                            className="p-1 sm:p-1.5 hover:bg-emerald-50 text-emerald-800 transition-colors cursor-pointer"
                            title="เพิ่มจำนวนของแถม"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="text-xs font-semibold text-slate-600 min-w-[28px]">
                          {fb.unit || 'ชิ้น'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveFreebie(idx)}
                        className="text-slate-400 hover:text-rose-600 p-2 sm:p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                        title="ลบรายการของแถมนี้"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

                    {/* Section 5: Price Summary (Auto Calculated) */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50/50 p-4 sm:p-5 rounded-2xl border border-blue-200/80 shadow-xs">
            <h3 className="text-sm font-bold text-blue-950 flex items-center justify-between mb-3">
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                  5
                </span>
                ราคารวมและสรุปยอดทั้งหมด (คำนวณอัตโนมัติ)
              </span>
            </h3>
            
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white/80 p-2.5 rounded-lg border border-blue-100 text-center">
                <span className="text-[11px] text-slate-500 block mb-0.5">สินค้าที่ขาย</span>
                <span className="text-sm font-bold text-blue-700">{totalQuantity} ชิ้น</span>
              </div>
              <div className="bg-emerald-50/80 p-2.5 rounded-lg border border-emerald-100 text-center">
                <span className="text-[11px] text-slate-500 block mb-0.5">สินค้าของแถม</span>
                <span className="text-sm font-bold text-emerald-700">{totalFreebieQuantity} ชิ้น</span>
              </div>
              <div className="bg-blue-100/50 p-2.5 rounded-lg border border-blue-200 text-center">
                <span className="text-[11px] text-blue-800 font-semibold block mb-0.5">รวมทั้งหมด</span>
                <span className="text-sm font-black text-blue-900">{overallTotalQuantity} ชิ้น</span>
              </div>
            </div>

            <div className="mt-4">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4 rounded-xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-sm text-blue-100 font-medium">ยอดเงินสุทธิที่ต้องชำระ</span>
                <span className="text-3xl font-black tracking-tight">
                  ฿{(netAmount ?? 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="mt-4 pt-4 border-t border-blue-100">
              <label className="block text-xs font-semibold text-blue-900 mb-2">
                วิธีชำระเงิน
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all text-xs font-medium ${
                    paymentMethod === 'transfer'
                      ? 'bg-blue-50 border-blue-500 text-blue-900 ring-1 ring-blue-500/30 font-semibold'
                      : 'border-blue-100 hover:bg-white text-slate-600 bg-white/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="transfer"
                    checked={paymentMethod === 'transfer'}
                    onChange={() => setPaymentMethod('transfer')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <Banknote className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>โอนเงินเข้าบัญชี</span>
                </label>
                <label
                  className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all text-xs font-medium ${
                    paymentMethod === 'cash'
                      ? 'bg-blue-50 border-blue-500 text-blue-900 ring-1 ring-blue-500/30 font-semibold'
                      : 'border-blue-100 hover:bg-white text-slate-600 bg-white/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cash"
                    checked={paymentMethod === 'cash'}
                    onChange={() => setPaymentMethod('cash')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <Banknote className="w-4 h-4 text-slate-600 shrink-0" />
                  <span>เงินสด (ชำระปลายทาง)</span>
                </label>
              </div>
            </div>
          </div>
          {/* Section 6: Requested Delivery Date (วันที่ต้องการสินค้า) */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-xs font-bold">
                  6
                </span>
                วันที่ต้องการสินค้า (กำหนดวันจัดส่ง)
              </h3>
              <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5" />
                กำหนดวันรับสินค้า
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เลือกวันที่ต้องการสินค้า <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-blue-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="order-requested-delivery-date"
                    type="date"
                    required
                    value={requestedDeliveryDate}
                    onChange={(e) => setRequestedDeliveryDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium text-slate-800 cursor-pointer"
                  />
                </div>

                {/* Quick Date Presets */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap text-xs">
                  <button
                    type="button"
                    onClick={() => setRequestedDeliveryDate(new Date().toISOString().slice(0, 10))}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 text-slate-600 font-medium transition-colors cursor-pointer"
                  >
                    วันนี้
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 1);
                      setRequestedDeliveryDate(d.toISOString().slice(0, 10));
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 text-slate-600 font-medium transition-colors cursor-pointer"
                  >
                    พรุ่งนี้
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 2);
                      setRequestedDeliveryDate(d.toISOString().slice(0, 10));
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 text-slate-600 font-medium transition-colors cursor-pointer"
                  >
                    อีก 2 วัน
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 7);
                      setRequestedDeliveryDate(d.toISOString().slice(0, 10));
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 text-slate-600 font-medium transition-colors cursor-pointer"
                  >
                    อีก 1 สัปดาห์
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ช่วงเวลาจัดส่งที่สะดวก
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <label className={`p-2 rounded-lg border text-xs font-medium cursor-pointer flex items-center gap-1.5 transition-all ${deliveryTimeSlot === 'anytime' ? 'bg-blue-50 border-blue-300 text-blue-800 font-semibold' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
                    <input
                      type="radio"
                      name="deliveryTimeSlot"
                      value="anytime"
                      checked={deliveryTimeSlot === 'anytime'}
                      onChange={() => setDeliveryTimeSlot('anytime')}
                      className="text-blue-600"
                    />
                    <span className="truncate">ตามรอบปกติ</span>
                  </label>
                  <label className={`p-2 rounded-lg border text-xs font-medium cursor-pointer flex items-center gap-1.5 transition-all ${deliveryTimeSlot === 'morning' ? 'bg-blue-50 border-blue-300 text-blue-800 font-semibold' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
                    <input
                      type="radio"
                      name="deliveryTimeSlot"
                      value="morning"
                      checked={deliveryTimeSlot === 'morning'}
                      onChange={() => setDeliveryTimeSlot('morning')}
                      className="text-blue-600"
                    />
                    <span className="truncate">ช่วงเช้า (ก่อนเที่ยง)</span>
                  </label>
                  <label className={`p-2 rounded-lg border text-xs font-medium cursor-pointer flex items-center gap-1.5 transition-all ${deliveryTimeSlot === 'afternoon' ? 'bg-blue-50 border-blue-300 text-blue-800 font-semibold' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
                    <input
                      type="radio"
                      name="deliveryTimeSlot"
                      value="afternoon"
                      checked={deliveryTimeSlot === 'afternoon'}
                      onChange={() => setDeliveryTimeSlot('afternoon')}
                      className="text-blue-600"
                    />
                    <span className="truncate">ช่วงบ่าย (13-17 น.)</span>
                  </label>
                  <label className={`p-2 rounded-lg border text-xs font-medium cursor-pointer flex items-center gap-1.5 transition-all ${deliveryTimeSlot === 'custom' ? 'bg-blue-50 border-blue-300 text-blue-800 font-semibold' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
                    <input
                      type="radio"
                      name="deliveryTimeSlot"
                      value="custom"
                      checked={deliveryTimeSlot === 'custom'}
                      onChange={() => setDeliveryTimeSlot('custom')}
                      className="text-blue-600"
                    />
                    <span className="truncate">ระบุเวลาเฉพาะ</span>
                  </label>
                </div>

                {deliveryTimeSlot === 'custom' && (
                  <div className="mt-2 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="time"
                      value={customDeliveryTime}
                      onChange={(e) => setCustomDeliveryTime(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
                      placeholder="เช่น 10:30"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Additional Notes */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                หมายเหตุ / เงื่อนไขจัดส่ง / รายละเอียดพิเศษ
              </label>
              <textarea
                id="order-note-input"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="เช่น ส่งก่อนเที่ยง, วางสินค้าที่ป้อมรปภ., ขอใบกำกับภาษีเต็มรูป..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 mt-2 sm:mt-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-end gap-2 sm:gap-3 shrink-0">
            <button
              id="btn-cancel-new-order"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-sm transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>

            <button
              id="btn-submit-new-order"
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md hover:shadow-blue-600/30 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังบันทึกข้อมูล...</span>
                </>
              ) : editingOrder ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>บันทึกออเดอร์</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>บันทึกออเดอร์</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 gpu-layer animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 bg-blue-600 text-white flex justify-between items-center shrink-0">
              <h3 className="font-bold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                ยืนยันการบันทึกออเดอร์
              </h3>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto space-y-4">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500">ชื่อลูกค้า</span>
                <p className="text-sm font-bold text-slate-800">{String(customerName || '').trim()}</p>
              </div>
              
              <div>
                <span className="text-xs font-semibold text-slate-500 mb-1 block">รายการสินค้า ({overallTotalQuantity} ชิ้น)</span>
                <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200 text-sm space-y-2">
                  {selectedItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start gap-2">
                      <span className="text-slate-700 leading-tight">
                        {item.name} <span className="text-xs text-blue-600">x{item.quantity} {item.unit || 'ชิ้น'}</span>
                      </span>
                      <span className="font-semibold text-slate-800 shrink-0">฿{(item.subtotal ?? 0).toLocaleString()}</span>
                    </div>
                  ))}
                  {freebieItems.map((item, idx) => (
                    <div key={`free-${idx}`} className="flex justify-between items-start gap-2">
                      <span className="text-emerald-700 leading-tight flex items-center gap-1">
                        <Gift className="w-3 h-3" /> {item.name} <span className="text-xs font-bold bg-emerald-100 px-1 rounded-sm">x{item.quantity}</span>
                      </span>
                      <span className="font-semibold text-emerald-700 shrink-0">ฟรี</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-between items-center p-3 rounded-lg bg-blue-50 border border-blue-100">
                <span className="text-sm font-bold text-blue-900">ยอดเงินรวมสุทธิ</span>
                <span className="text-xl font-black text-blue-700">฿{(netAmount ?? 0).toLocaleString()}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-500">วันที่จัดส่ง</span>
                  <p className="text-sm font-semibold text-slate-800 flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                    {requestedDeliveryDate ? new Date(requestedDeliveryDate).toLocaleDateString('th-TH') : '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-500">รอบการจัดส่ง / หมายเหตุ</span>
                  <p className="text-sm text-slate-800 line-clamp-2">{note.trim() || '-'}</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors cursor-pointer"
              >
                แก้ไข
              </button>
              <button
                type="button"
                onClick={executeSubmit}
                disabled={isSubmitting}
                className="flex-[2] px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold flex justify-center items-center gap-2 transition-colors shadow-sm cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    ยืนยันบันทึกออเดอร์
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
