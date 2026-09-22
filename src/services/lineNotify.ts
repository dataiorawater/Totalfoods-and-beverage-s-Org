import { Order } from '../types';
import { getStatusLabelThai } from './googleSheets';

export interface LineNotifyPayload {
  message: string;
  order: Order;
  token?: string;
  webhookUrl?: string;
}

export const formatLineOrderMessage = (order: Order): string => {
  let dateFormatted = '-';
  if (order.createdAt) {
    try {
      const trimmed = String(order.createdAt).trim();
      let d = new Date(trimmed);
      if (isNaN(d.getTime())) {
        const parts = trimmed.replace('T', ' ').split(' ');
        if (parts[0].includes('/')) {
          const [day, month, year] = parts[0].split('/');
          let y = parseInt(year, 10);
          if (y > 2400) y -= 543;
          const [h, m] = (parts[1] || '00:00').split(':');
          d = new Date(y, parseInt(month, 10) - 1, parseInt(day, 10), parseInt(h || '0', 10), parseInt(m || '0', 10));
        }
      }
      if (!isNaN(d.getTime())) {
        dateFormatted = d.toLocaleString('th-TH', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } else {
        dateFormatted = trimmed;
      }
    } catch {
      dateFormatted = String(order.createdAt);
    }
  }

  const paymentText =
    order.paymentMethod === 'transfer' ? 'โอนเงินเข้าบัญชี' : order.paymentMethod === 'credit' ? 'เครดิต' : 'เงินสด';

  const itemsText = (order.items || [])
    .map((item, idx) => {
      const pricePart = item.subtotal && item.subtotal > 0 ? ` = ${item.subtotal.toLocaleString()} ฿` : '';
      return `  ${idx + 1}. ${item.name} x${item.quantity} ${item.unit || 'ชิ้น'}${pricePart}`;
    })
    .join('\n');

  const freebiesText = order.freebies && order.freebies.length > 0
    ? `\n🎁 รายการสินค้าแถม (${order.freebies.length} รายการ):\n` +
      order.freebies.map((fb, idx) => `  ${idx + 1}. [แถมฟรี] ${fb.name} x${fb.quantity} ${fb.unit || 'ชิ้น'}${fb.note ? ` (${fb.note})` : ''}`).join('\n')
    : '';

  return `
🔔 [ออเดอร์ใหม่] ${order.orderNumber}
━━━━━━━━━━━━━━━━━━
📅 วันที่ลงออเดอร์: ${dateFormatted}
🚚 วันที่ต้องการสินค้า: ${order.requestedDeliveryDate || 'จัดส่งตามรอบปกติ'}
👤 เซลล์: ${order.salespersonName}
🏢 ลูกค้า: ${order.customerName}
📞 โทร: ${order.customerPhone}
📦 รายการสินค้า (${order.items?.length || 0} รายการ):
${itemsText}${freebiesText}
💰 ยอดรวม: ${(order.totalAmount ?? 0).toLocaleString()} ฿
🏷️ ส่วนลด: ${order.discount ? `${(order.discount ?? 0).toLocaleString()} ฿` : '0 ฿'}
💵 ยอดสุทธิ: ${(order.netAmount ?? 0).toLocaleString()} ฿
💳 ชำระโดย: ${paymentText}
📝 หมายเหตุ: ${order.note || '-'}
📍 พิกัดนำทาง: ${order.location?.mapsUrl || 'ไม่ได้ระบุ'}
📌 สถานะ: ${getStatusLabelThai(order.status)}
━━━━━━━━━━━━━━━━━━`.trim();
};

/**
 * Sends notification through backend proxy or webhook
 */
export const sendLineNotification = async (
  order: Order,
  token?: string,
  webhookUrl?: string
): Promise<{ success: boolean; message: string }> => {
  const formattedText = formatLineOrderMessage(order);

  // 1. If custom Webhook URL is provided (Make/Zapier/Discord/Slack/LINE Bot)
  if (webhookUrl && webhookUrl.trim()) {
    try {
      const res = await fetch(webhookUrl.trim(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: 'new_order',
          orderNumber: order.orderNumber,
          salesperson: order.salespersonName,
          customer: order.customerName,
          phone: order.customerPhone,
          netAmount: order.netAmount,
          items: order.items,
          locationUrl: order.location.mapsUrl,
          message: formattedText,
        }),
      });

      if (res.ok) {
        return { success: true, message: 'ส่งการแจ้งเตือนผ่าน Webhook สำเร็จ' };
      }
    } catch (err: any) {
      console.warn('Webhook notification error:', err);
    }
  }

  // 2. Send via server endpoint /api/line-notify to avoid CORS
  if ((token && token.trim()) || (webhookUrl && webhookUrl.trim())) {
    try {
      const res = await fetch('/api/line-notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token?.trim() || '',
          webhookUrl: webhookUrl?.trim() || '',
          message: formattedText,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        return { success: true, message: 'ส่งการแจ้งเตือนเข้า LINE เรียบร้อยแล้ว' };
      } else {
        return {
          success: false,
          message:
            data.error ||
            'ไม่สามารถส่งข้อความแจ้งเตือนได้ (แนะนำให้ใช้ Webhook หรือกดส่งเข้า LINE โดยตรง)',
        };
      }
    } catch (err: any) {
      console.warn('Backend proxy line notify notice:', err?.message || err);
      return {
        success: false,
        message: 'เชื่อมต่อเซิร์ฟเวอร์ส่ง LINE ไม่สำเร็จ (สามารถกดแชร์ข้อความเข้า LINE ได้โดยตรง)',
      };
    }
  }

  return { success: false, message: 'ยังไม่ได้ตั้งค่า LINE Token หรือ Webhook URL' };
};

/**
 * Generates direct LINE App Share URL (works on all mobile/desktop devices without any token!)
 */
export const getLineShareUrl = (order: Order): string => {
  const text = formatLineOrderMessage(order);
  return `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
};
