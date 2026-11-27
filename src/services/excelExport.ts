import { Customer, Order, StoreCheckIn } from '../types';
import { getStatusLabelThai } from './googleSheets';
import { calculateDistanceMeters, extractCustomerCoords, formatDistance } from '../utils/geoUtils';

export interface ExcelExportOptions {
  month?: string; // e.g. "2026-09" or "all"
  salespersonId?: string; // "all" or specific
  salespersonName?: string; // optional name fallback for matching check-ins
  status?: string; // "all" or specific
}

export const exportOrdersToExcel = async (
  orders: Order[],
  options: ExcelExportOptions = {}
) => {
  const XLSX = await import('xlsx');
  let filtered = [...orders];

  if (options.month && options.month !== 'all') {
    filtered = filtered.filter((ord) => ord.createdAt.startsWith(options.month!));
  }

  if (options.salespersonId && options.salespersonId !== 'all') {
    filtered = filtered.filter((ord) => ord.salespersonId === options.salespersonId);
  }

  if (options.status && options.status !== 'all') {
    filtered = filtered.filter((ord) => ord.status === options.status);
  }

  // 1. Detailed Orders Sheet
  const orderRows = filtered.map((ord, idx) => {
    const d = new Date(ord.createdAt);
    const dateFormatted = d.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const timeFormatted = d.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const itemsSummary = ord.items
      .map((it) => `${it.name} (x${it.quantity})`)
      .join('; ');

    const totalQty = ord.items.reduce((sum, it) => sum + it.quantity, 0);

    return {
      'ลำดับ': idx + 1,
      'เลขที่ออเดอร์': ord.orderNumber,
      'วันที่': dateFormatted,
      'เวลา': timeFormatted,
      'พนักงานขาย (เซลล์)': ord.salespersonName,
      'ชื่อลูกค้า': ord.customerName,
      'เบอร์โทรศัพท์': ord.customerPhone,
      'รายการสินค้า': itemsSummary,
      'จำนวนรวม (ชิ้น)': totalQty,
      'ยอดรวมก่อนลด (บาท)': ord.totalAmount,
      'ส่วนลด (บาท)': ord.discount || 0,
      'ยอดเงินสุทธิ (บาท)': ord.netAmount,
      'วิธีชำระเงิน': ord.paymentMethod === 'transfer' ? 'โอนเงิน' : ord.paymentMethod === 'credit' ? 'เครดิต' : 'เงินสด',
      'ใบกำกับภาษี': ord.requireTaxInvoice ? `ต้องการ (${ord.taxInvoiceDetails?.companyName || ord.customerName}${ord.taxInvoiceDetails?.taxId ? ` เลขผู้เสียภาษี: ${ord.taxInvoiceDetails.taxId}` : ''}${ord.taxInvoiceDetails?.branchType === 'branch' ? ` สาขา: ${ord.taxInvoiceDetails.branchNumber || '-'}` : ' (สนง.ใหญ่)'})` : 'ไม่ต้องการ',
      'สถานะการจัดส่ง': getStatusLabelThai(ord.status),
      'หมายเหตุ': ord.note || '-',
      'ที่อยู่ / พิกัด Google Maps': ord.location.mapsUrl || ord.location.address || '-',
    };
  });

  // 2. Monthly / Salesperson Summary Sheet
  const salesSummaryMap: Record<string, { name: string; count: number; totalRevenue: number; completedCount: number }> = {};
  filtered.forEach((ord) => {
    const key = ord.salespersonName;
    if (!salesSummaryMap[key]) {
      salesSummaryMap[key] = { name: key, count: 0, totalRevenue: 0, completedCount: 0 };
    }
    salesSummaryMap[key].count += 1;
    salesSummaryMap[key].totalRevenue += ord.netAmount;
    if (ord.status === 'completed') {
      salesSummaryMap[key].completedCount += 1;
    }
  });

  const summaryRows = Object.values(salesSummaryMap).map((item, idx) => ({
    'ลำดับ': idx + 1,
    'พนักงานขาย': item.name,
    'จำนวนออเดอร์ทั้งหมด': item.count,
    'ส่งมอบสำเร็จแล้ว': item.completedCount,
    'ยอดขายรวม (บาท)': item.totalRevenue,
    'ยอดเฉลี่ยต่อออเดอร์ (บาท)': item.count > 0 ? Math.round(item.totalRevenue / item.count) : 0,
  }));

  // Overall totals
  const totalRevenue = filtered.reduce((sum, ord) => sum + ord.netAmount, 0);
  const totalCompletedRevenue = filtered
    .filter((ord) => ord.status === 'completed')
    .reduce((sum, ord) => sum + ord.netAmount, 0);

  const kpiRow = [
    { 'หัวข้อสรุป': 'จำนวนออเดอร์รวมทั้งหมด', 'ค่า': filtered.length },
    { 'หัวข้อสรุป': 'ยอดขายรวมทั้งหมด (บาท)', 'ค่า': totalRevenue },
    { 'หัวข้อสรุป': 'ยอดส่งมอบสำเร็จ (บาท)', 'ค่า': totalCompletedRevenue },
    { 'หัวข้อสรุป': 'ยอดเฉลี่ยต่อออเดอร์ (บาท)', 'ค่า': filtered.length ? Math.round(totalRevenue / filtered.length) : 0 },
    { 'หัวข้อสรุป': 'วันที่ออกรายงาน', 'ค่า': new Date().toLocaleString('th-TH') },
  ];

  // Create Workbook
  const wb = XLSX.utils.book_new();

  // Sheet 1: รายการออเดอร์
  const wsOrders = XLSX.utils.json_to_sheet(orderRows);
  // Set column widths
  wsOrders['!cols'] = [
    { wch: 6 },  // ลำดับ
    { wch: 18 }, // เลขที่ออเดอร์
    { wch: 12 }, // วันที่
    { wch: 8 },  // เวลา
    { wch: 22 }, // พนักงานขาย
    { wch: 24 }, // ชื่อลูกค้า
    { wch: 14 }, // เบอร์โทร
    { wch: 35 }, // รายการ
    { wch: 16 }, // จำนวน
    { wch: 18 }, // ยอดรวม
    { wch: 14 }, // ส่วนลด
    { wch: 18 }, // ยอดสุทธิ
    { wch: 12 }, // วิธีชำระ
    { wch: 16 }, // สถานะ
    { wch: 25 }, // หมายเหตุ
    { wch: 30 }, // แผนที่
  ];
  XLSX.utils.book_append_sheet(wb, wsOrders, 'รายการออเดอร์ทั้งหมด');

  // Sheet 2: สรุปยอดขายตามพนักงาน
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [
    { wch: 6 },
    { wch: 24 },
    { wch: 20 },
    { wch: 18 },
    { wch: 20 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'สรุปยอดขายแยกตามเซลล์');

  // Sheet 3: ภาพรวม KPI
  const wsKPI = XLSX.utils.json_to_sheet(kpiRow);
  wsKPI['!cols'] = [{ wch: 30 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsKPI, 'ภาพรวมสรุปผล');

  // File naming
  const monthSuffix = options.month && options.month !== 'all' ? `_ประจำเดือน_${options.month}` : '';
  const fileName = `รายงานยอดขายและออเดอร์${monthSuffix}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  XLSX.writeFile(wb, fileName);
};

export const exportCheckInsToExcel = async (
  checkIns: StoreCheckIn[],
  options: ExcelExportOptions = {},
  customers: Customer[] = []
) => {
  const XLSX = await import('xlsx');
  let filtered = [...checkIns];

  if (options.month && options.month !== 'all') {
    filtered = filtered.filter((c) => String(c.createdAt || '').startsWith(options.month!));
  }

  if (options.salespersonId && options.salespersonId !== 'all') {
    const targetId = options.salespersonId;
    const targetName = options.salespersonName?.trim().toLowerCase();
    filtered = filtered.filter((c) => {
      if (c.salespersonId && c.salespersonId === targetId) return true;
      if (targetName && String(c.salespersonName || '').trim().toLowerCase() === targetName) return true;
      return false;
    });
  }

  const resolveDistanceMeters = (c: StoreCheckIn): number | undefined => {
    if (c.distanceMeters !== undefined && c.distanceMeters !== null && !isNaN(Number(c.distanceMeters))) {
      return Math.round(Number(c.distanceMeters));
    }
    if (c.latitude && c.longitude && customers.length > 0) {
      const storeKey = String(c.storeName || c.customerName || '').trim().toLowerCase();
      const matchedCust = customers.find(
        (cust) =>
          (c.customerId && cust.id === c.customerId) ||
          (storeKey && String(cust.name || '').trim().toLowerCase() === storeKey)
      );
      if (matchedCust) {
        const coords = extractCustomerCoords(matchedCust);
        if (coords) {
          return calculateDistanceMeters(c.latitude, c.longitude, coords.lat, coords.lng);
        }
      }
    }
    return undefined;
  };

  const rows = filtered.map((c, idx) => {
    const d = new Date(c.createdAt);
    const dateFormatted = !isNaN(d.getTime())
      ? d.toLocaleDateString('th-TH', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
      : c.timestampStr || '-';
    const timeFormatted = !isNaN(d.getTime())
      ? d.toLocaleTimeString('th-TH', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '-';

    const distMeters = resolveDistanceMeters(c);

    return {
      'ลำดับ': idx + 1,
      'วันที่': dateFormatted,
      'เวลา': timeFormatted,
      'พนักงานขาย (เซลล์)': c.salespersonName || '-',
      'ชื่อร้านค้า/ลูกค้า': c.storeName || c.customerName || '-',
      'ระยะห่างจากจุดร้านค้า': distMeters !== undefined ? formatDistance(distMeters) : '-',
      'ระยะห่าง (เมตร)': distMeters !== undefined ? distMeters : '-',
      'เบอร์โทรศัพท์': c.customerPhone || '-',
      'ที่อยู่': c.address || '-',
      'พิกัด Google Maps': c.mapsUrl || '-',
      'หมายเหตุ': c.notes || '-'
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 },  // ลำดับ
    { wch: 12 }, // วันที่
    { wch: 8 },  // เวลา
    { wch: 22 }, // พนักงานขาย
    { wch: 26 }, // ชื่อร้านค้า
    { wch: 20 }, // ระยะห่างจากจุดร้านค้า
    { wch: 16 }, // ระยะห่าง (เมตร)
    { wch: 14 }, // เบอร์โทร
    { wch: 30 }, // ที่อยู่
    { wch: 30 }, // พิกัด Google Maps
    { wch: 25 }, // หมายเหตุ
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'รายการเช็คอินทั้งหมด');

  const monthSuffix = options.month && options.month !== 'all' ? `_ประจำเดือน_${options.month}` : '';
  const fileName = `รายงานการเข้าเยี่ยมเช็คอิน${monthSuffix}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  XLSX.writeFile(wb, fileName);
};

export const exportExpensesToExcel = async (
  expenses: import('../types').Expense[],
  options: ExcelExportOptions = {}
) => {
  const XLSX = await import('xlsx');
  let filtered = [...expenses];

  if (options.month && options.month !== 'all') {
    filtered = filtered.filter((e) => e.date.startsWith(options.month!));
  }

  const rows = filtered.map((e, idx) => {
    const d = new Date(e.createdAt);
    return {
      'ลำดับ': idx + 1,
      'วันที่ใช้จ่าย': e.date,
      'พนักงานขาย (เซลล์)': e.salespersonName,
      'ประเภทค่าใช้จ่าย': e.expenseType,
      'จำนวนเงิน (บาท)': e.amount,
      'ไมล์ไป (กม.)': e.startMileage !== undefined ? e.startMileage : '-',
      'ไมล์กลับ (กม.)': e.endMileage !== undefined ? e.endMileage : '-',
      'ระยะทาง (กม.)': e.distance !== undefined ? e.distance : '-',
      'หมายเหตุ': e.note || '-',
      'วันเวลาที่บันทึก': d.toLocaleString('th-TH')
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 15 },
    { wch: 22 },
    { wch: 18 },
    { wch: 15 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 25 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'รายการค่าใช้จ่าย');

  const monthSuffix = options.month && options.month !== 'all' ? `_ประจำเดือน_${options.month}` : '';
  const fileName = `รายงานสรุปค่าใช้จ่าย${monthSuffix}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  XLSX.writeFile(wb, fileName);
};
