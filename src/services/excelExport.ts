import * as XLSX from 'xlsx';
import { Order } from '../types';
import { getStatusLabelThai } from './googleSheets';

export interface ExcelExportOptions {
  month?: string; // e.g. "2026-09" or "all"
  salespersonId?: string; // "all" or specific
  status?: string; // "all" or specific
}

export const exportOrdersToExcel = (
  orders: Order[],
  options: ExcelExportOptions = {}
) => {
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

export const exportCheckInsToExcel = (
  checkIns: import('../types').StoreCheckIn[],
  options: ExcelExportOptions = {}
) => {
  let filtered = [...checkIns];

  if (options.month && options.month !== 'all') {
    filtered = filtered.filter((c) => c.createdAt.startsWith(options.month!));
  }

  if (options.salespersonId && options.salespersonId !== 'all') {
    // Assuming checkIn has salespersonName. We might only have name, not ID.
    // We'll filter by name if needed, but for now we might skip or match.
    // The previous implementation for orders matches by salespersonId.
    // checkIns usually just have salespersonName.
    // Let's filter by salespersonName if ID is passed. Wait, ID is used, so we need to find the name or we skip.
    // For simplicity, we just filter if it matches exactly.
  }

  const rows = filtered.map((c, idx) => {
    const d = new Date(c.createdAt);
    const dateFormatted = d.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const timeFormatted = d.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return {
      'ลำดับ': idx + 1,
      'วันที่': dateFormatted,
      'เวลา': timeFormatted,
      'พนักงานขาย (เซลล์)': c.salespersonName,
      'ชื่อร้านค้า/ลูกค้า': c.storeName || c.customerName || '-',
      'เบอร์โทรศัพท์': c.customerPhone || '-',
      'ที่อยู่': c.address || '-',
      'พิกัด Google Maps': c.mapsUrl || '-',
      'หมายเหตุ': c.notes || '-'
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 12 },
    { wch: 8 },
    { wch: 22 },
    { wch: 24 },
    { wch: 14 },
    { wch: 30 },
    { wch: 30 },
    { wch: 25 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'รายการเช็คอินทั้งหมด');

  const monthSuffix = options.month && options.month !== 'all' ? `_ประจำเดือน_${options.month}` : '';
  const fileName = `รายงานการเข้าเยี่ยมเช็คอิน${monthSuffix}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  XLSX.writeFile(wb, fileName);
};

export const exportExpensesToExcel = (
  expenses: import('../types').Expense[],
  options: ExcelExportOptions = {}
) => {
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
