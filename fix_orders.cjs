const fs = require('fs');
let code = fs.readFileSync('src/services/googleSheets.ts', 'utf8');

const fetchReplacement = `export const fetchOrdersFromSheet = async (config: any): Promise<Order[]> => {
  const res = await gasRequest(config.spreadsheetId, 'getData', ORDERS_TAB_NAME);
  if (!res || !res.values || res.values.length <= 1) return [];
  return res.values.slice(1).map((row: any, idx: number) => {
    // 0: รหัส, 1: วันที่, 2: เวลา, 3: อีเมลเซลล์, 4: ชื่อเซลล์, 5: ชื่อลูกค้า, 6: เบอร์ติดต่อ, 7: วันที่ต้องการ, 8: ชื่อสินค้า, 9: จำนวน, 10: รวม, 11: ส่วนลด, 12: สุทธิ, 13: จ่าย, 14: หมายเหตุ, 15: แมป, 16: สถานะ, 17: อัปเดต
    
    // Parse items
    const itemNames = String(row[8] || '').split(',').map(s => s.trim()).filter(Boolean);
    const itemQuantities = String(row[9] || '').split(',').map(s => s.trim()).filter(Boolean);
    const items = itemNames.map((name, i) => {
      const q = parseInt(itemQuantities[i]) || 1;
      return { productId: 'p' + i, name, quantity: q, price: 0, subtotal: 0 };
    });

    let paymentMethod = 'cash';
    if (String(row[13]).includes('โอน')) paymentMethod = 'transfer';
    if (String(row[13]).includes('เครดิต')) paymentMethod = 'credit';

    let status = 'pending';
    const st = String(row[16]);
    if (st === 'รอดำเนินการ' || st === 'รอจัดส่ง') status = 'pending';
    else if (st === 'ยืนยันแล้ว') status = 'confirmed';
    else if (st === 'กำลังจัดส่ง') status = 'delivering';
    else if (st === 'จัดส่งสำเร็จ') status = 'completed';
    else if (st === 'ยกเลิก') status = 'cancelled';
    else status = 'pending';

    // Combine date and time if possible
    let createdAt = row[1] || '';
    if (row[2]) createdAt += 'T' + row[2]; // Simplified, we will just use as string or the original ISO if it's there. Actually, if row[1] is ISO, it's fine.

    return {
      sheetsRowIndex: idx + 2,
      id: row[0] || '',
      orderNumber: row[0] || '',
      createdAt: row[1] ? String(row[1]) : '',
      salespersonId: row[3] || '',
      salespersonName: row[4] || '',
      customerName: row[5] || '',
      customerPhone: row[6] || '',
      items,
      freebies: [],
      totalAmount: parseFloat(row[10]) || 0,
      discount: parseFloat(row[11]) || 0,
      netAmount: parseFloat(row[12]) || 0,
      paymentMethod,
      note: row[14] || '',
      location: { mapsUrl: row[15] || '' },
      status: status as any,
      requestedDeliveryDate: row[7] || '',
      updatedAt: row[17] || ''
    };
  });
};`;

const appendReplacement = `
const buildOrderRowData = (o: Order) => {
  const itemNames = o.items.map(i => i.name).join(', ');
  const itemQuantities = o.items.map(i => i.quantity).join(', ');
  
  const dateObj = new Date(o.createdAt);
  const dateStr = dateObj.toISOString().split('T')[0];
  const timeStr = dateObj.toISOString().split('T')[1].substring(0, 5);

  let pay = 'เงินสด';
  if (o.paymentMethod === 'transfer') pay = 'โอนเงิน';
  if (o.paymentMethod === 'credit') pay = 'เครดิต';

  let st = 'รอดำเนินการ';
  if (o.status === 'pending') st = 'รอจัดส่ง';
  if (o.status === 'confirmed') st = 'ยืนยันแล้ว';
  if (o.status === 'delivering') st = 'กำลังจัดส่ง';
  if (o.status === 'completed') st = 'จัดส่งสำเร็จ';
  if (o.status === 'cancelled') st = 'ยกเลิก';

  return [
    o.orderNumber, // 0
    dateStr,       // 1
    timeStr,       // 2
    o.salespersonId, // 3
    o.salespersonName, // 4
    o.customerName, // 5
    o.customerPhone || '', // 6
    o.requestedDeliveryDate || '', // 7
    itemNames, // 8
    itemQuantities, // 9
    o.totalAmount, // 10
    o.discount || 0, // 11
    o.netAmount, // 12
    pay, // 13
    o.note || '', // 14
    o.location?.mapsUrl || '', // 15
    st, // 16
    o.updatedAt || new Date().toISOString() // 17
  ];
};

export const appendOrderToSheet = async (config: any, o: Order) => {
  const rowData = buildOrderRowData(o);
  await gasRequest(config.spreadsheetId, 'appendRow', ORDERS_TAB_NAME, undefined, rowData);
};

export const updateOrderInSheet = async (config: any, o: Order): Promise<boolean> => {
  o.updatedAt = new Date().toISOString();
  const rowData = buildOrderRowData(o);
  if (o.sheetsRowIndex) {
    await gasRequest(config.spreadsheetId, 'updateRow', ORDERS_TAB_NAME, o.sheetsRowIndex, rowData);
    return true;
  }
  return false;
};`;

code = code.replace(/export const fetchOrdersFromSheet = async [\s\S]*?\}\);\n\};/m, fetchReplacement);
code = code.replace(/export const appendOrderToSheet = async [\s\S]*?return false;\n\};/m, appendReplacement);

fs.writeFileSync('src/services/googleSheets.ts', code);
