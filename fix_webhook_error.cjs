const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `          if (whRes.ok) {
            return res.json({ success: true, message: 'ส่งข้อความผ่าน Webhook สำเร็จ' });
          } else {
            return res.json({
              success: false,
              error: \`Webhook ตอบกลับสถานะ HTTP \${whRes.status}\`,
            });
          }`;

const replacement = `          if (whRes.ok) {
            return res.json({ success: true, message: 'ส่งข้อความผ่าน Webhook สำเร็จ' });
          } else {
            let errorMsg = \`Webhook ตอบกลับสถานะ HTTP \${whRes.status}\`;
            if (whRes.status === 404) {
              errorMsg = 'Webhook ตอบกลับ 404 (Not Found) - โปรดตรวจสอบว่า URL ถูกต้อง, หากเป็น Google Apps Script ต้องมี doPost(e) และ Deploy ใหม่, หากใช้ Make.com ต้องกดเปิด ON';
            } else if (whRes.status === 405) {
              errorMsg = 'Webhook ตอบกลับ 405 (Method Not Allowed) - URL นี้ไม่รองรับการส่ง POST';
            }
            return res.json({
              success: false,
              error: errorMsg,
            });
          }`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('server.ts', code);
    console.log("Replaced successfully!");
} else {
    console.log("Target not found!");
}
