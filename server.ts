import express from 'express';
import path from 'path';
import 'dotenv/config';
import { GoogleGenAI, Type } from '@google/genai';


async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // LINE Notification Proxy endpoint (supports LINE Messaging API, Webhooks, and legacy Notify handling)
  app.post('/api/line-notify', async (req, res) => {
    try {
      const { token, message, webhookUrl } = req.body;

      if (!message) {
        return res.status(400).json({ success: false, error: 'Message is required' });
      }

      // 1. If webhookUrl is provided directly or in token field
      const candidateWebhook = (webhookUrl && typeof webhookUrl === 'string' && webhookUrl.trim().startsWith('http'))
        ? webhookUrl.trim()
        : (token && typeof token === 'string' && (token.trim().startsWith('http://') || token.trim().startsWith('https://')))
          ? token.trim()
          : null;

      if (candidateWebhook) {
        try {
          const whRes = await fetch(candidateWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, event: 'order_notification' }),
            signal: AbortSignal.timeout(8000),
          });

          if (whRes.ok) {
            return res.json({ success: true, message: 'ส่งข้อความผ่าน Webhook สำเร็จ' });
          } else {
            let errorMsg = `Webhook ตอบกลับสถานะ HTTP ${whRes.status}`;
            if (whRes.status === 404) {
              errorMsg = 'Webhook ตอบกลับ 404 (Not Found) - โปรดตรวจสอบว่า URL ถูกต้อง, หากเป็น Google Apps Script ต้องมี doPost(e) และ Deploy ใหม่, หากใช้ Make.com ต้องกดเปิด ON';
            } else if (whRes.status === 405) {
              errorMsg = 'Webhook ตอบกลับ 405 (Method Not Allowed) - URL นี้ไม่รองรับการส่ง POST';
            }
            return res.json({
              success: false,
              error: errorMsg,
            });
          }
        } catch (whErr: any) {
          console.warn('Webhook delivery notice:', whErr?.message);
          return res.json({
            success: false,
            error: `ไม่สามารถเชื่อมต่อ Webhook URL ได้ (${whErr?.message || 'timeout'})`,
          });
        }
      }

      if (!token || typeof token !== 'string' || !token.trim()) {
        return res.status(400).json({
          success: false,
          error: 'กรุณาระบุ LINE Channel Access Token หรือ Webhook URL',
        });
      }

      const trimmedToken = token.trim();

      // 2. Try LINE Messaging API Broadcast endpoint (standard official LINE replacement)
      try {
        const lineApiRes = await fetch('https://api.line.me/v2/bot/message/broadcast', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${trimmedToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              {
                type: 'text',
                text: message,
              },
            ],
          }),
          signal: AbortSignal.timeout(8000),
        });

        const lineApiData = (await lineApiRes.json().catch(() => ({}))) as Record<string, any>;
        if (lineApiRes.ok) {
          return res.json({ success: true, data: lineApiData });
        }

        // If rejected due to authentication, provide a clear explanation
        if (lineApiRes.status === 401) {
          if (trimmedToken.length < 60) {
            return res.json({
              success: false,
              error:
                'บริการ LINE Notify ได้ยุติให้บริการอย่างเป็นทางการแล้ว (ตั้งแต่ 31 มี.ค. 2025) กรุณาเปลี่ยนมาใช้ LINE Messaging API Channel Access Token หรือ Webhook URL แทน',
            });
          }
          return res.json({
            success: false,
            error: 'LINE Token ไม่ถูกต้อง (ยืนยันว่าใช้ Channel Access Token ที่ยังไม่หมดอายุ)',
          });
        }

        return res.json({
          success: false,
          error: lineApiData?.message || `LINE API ตอบกลับสถานะ ${lineApiRes.status}`,
        });
      } catch (messagingErr: any) {
        console.warn('LINE Messaging API notice:', messagingErr?.message);
        return res.json({
          success: false,
          error:
            'ไม่สามารถเชื่อมต่อบริการแจ้งเตือน LINE ได้ในขณะนี้ กรุณาใช้ Webhook หรือกดปุ่ม "แชร์เข้า LINE" โดยตรง',
        });
      }
    } catch (err: any) {
      console.warn('Line Notify handler notice:', err?.message || err);
      return res.status(200).json({
        success: false,
        error: 'ระบบไม่สามารถส่งการแจ้งเตือนได้ (แนะนำให้ใช้ Webhook หรือ LINE Messaging API)',
      });
    }
  });

  // Gemini Odometer / Mileage reader endpoint
  app.post('/api/gemini/read-odometer', async (req, res) => {
    try {
      const { image, mileageType } = req.body;

      if (!image || typeof image !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'กรุณาส่งรูปภาพหน้าปัดไมล์รถ (Base64)',
        });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          success: false,
          error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์ กรุณาระบุตัวเลขไมล์ด้วยตนเอง',
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const mimeMatch = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const base64Data = image.replace(/^data:[a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+;base64,/, '');

      const typeHint = mileageType === 'end' ? 'ไมล์กลับ (ไมล์สิ้นสุดการเดินทาง)' : 'ไมล์ไป (ไมล์เริ่มต้นการเดินทาง)';

      const prompt = `คุณคือระบบ AI OCR อัจฉริยะสำหรับอ่านตัวเลขบนหน้าปัดไมล์รถยนต์ รถกระบะ หรือรถจักรยานยนต์ (Vehicle Dashboard & Odometer OCR).
ภาพนี้คือรูปถ่าย${typeHint}
หน้าที่ของคุณ:
1. วิเคราะห์หน้าปัดและค้นหาตัวเลข "ระยะทางสะสมรวม" (Total Mileage / Odometer / ODO) หรือตัวเลขระยะทางสะสมของรถ
2. คำแนะนำในการแยกแยะ:
   - เลข ODO หรือระยะทางสะสม มักมีป้ายกำกับคำว่า ODO, ODOMETER, TOTAL หรือหน่วย km กำกับอยู่ และมักมี 4-7 หลัก เช่น 045210, 45210, 125890, 45210.5
   - หากไม่พบ ODO ชัดเจน แต่มีเลข TRIP A หรือ TRIP B ให้ใช้ตัวเลขนั้นแทน
   - ห้ามสับสนกับ: ความเร็วขณะขับขี่ (speed km/h), นาฬิกาบอกเวลา (เช่น 08:30, 12:45), อุณหภูมิภายนอก (เช่น 32°C), เกียร์ (P, R, N, D), หรือรอบเครื่องยนต์ (x1000 RPM)
3. ส่งคืนค่า:
   - mileage: ตัวเลขระยะทาง (number) เช่น 45210 หรือ 45210.5
   - mileageStr: สตริงตัวเลขล้วน (เช่น "45210" หรือ "045210")
   - confidence: ระดับความมั่นใจ (high, medium, low, none)
   - rawText: ข้อความและตัวเลขที่อ่านพบบนหน้าปัด
   - note: คำอธิบายสั้นๆ ภาษาไทย เช่น "ตรวจพบเลข ODO 45,210 กม."`;

      // Candidate models with fallback for high resilience
      const candidateModels = [
        'gemini-3.6-flash',
        'gemini-3.8-flash',
        'gemini-flash-latest',
        'gemini-3.1-flash-lite',
      ];

      let lastError: any = null;
      let response: any = null;

      for (const model of candidateModels) {
        try {
          response = await ai.models.generateContent({
            model,
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: base64Data,
                  },
                },
                {
                  text: prompt,
                },
              ],
            },
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  mileage: {
                    type: Type.NUMBER,
                    description: 'Detected odometer number in kilometers. If not readable, return 0.',
                  },
                  mileageStr: {
                    type: Type.STRING,
                    description: 'Digits string of the detected odometer number without formatting, e.g. "45210" or "045210"',
                  },
                  confidence: {
                    type: Type.STRING,
                    description: 'high, medium, low, or none',
                  },
                  rawText: {
                    type: Type.STRING,
                    description: 'The raw text or digits detected on the odometer (e.g. "045210 km")',
                  },
                  note: {
                    type: Type.STRING,
                    description: 'Brief explanation in Thai of what was detected',
                  },
                },
                required: ['mileage', 'confidence', 'rawText', 'note'],
              },
            },
          });
          if (response && response.text) {
            break; // Success
          }
        } catch (modelErr: any) {
          lastError = modelErr;
          console.warn(`Model ${model} OCR failed, trying fallback:`, modelErr?.message || modelErr);
        }
      }

      if (!response || !response.text) {
        throw lastError || new Error('ไม่สามารถเชื่อมต่อโมเดล AI ได้');
      }

      const responseText = response.text?.trim() || '{}';
      let parsedData: any = {};
      try {
        parsedData = JSON.parse(responseText);
      } catch (parseErr) {
        console.warn('Gemini JSON parse fallback:', responseText);
        const numMatch = responseText.match(/"mileage"\s*:\s*([0-9.]+)/);
        const strMatch = responseText.match(/"mileageStr"\s*:\s*"([0-9.]+)"/);
        parsedData = {
          mileage: numMatch ? parseFloat(numMatch[1]) : 0,
          mileageStr: strMatch ? strMatch[1] : (numMatch ? numMatch[1] : ''),
          confidence: 'medium',
          rawText: responseText.slice(0, 100),
          note: 'อ่านตัวเลขสำเร็จ',
        };
      }

      // Extract & clean mileage numbers
      let mileageNum: number | undefined = undefined;
      let mileageStr: string = '';

      if (typeof parsedData.mileage === 'number' && !isNaN(parsedData.mileage) && parsedData.mileage > 0) {
        mileageNum = parsedData.mileage;
        mileageStr = String(parsedData.mileage);
      } else if (typeof parsedData.mileage === 'string' && parsedData.mileage.trim()) {
        const cleanStr = parsedData.mileage.replace(/,/g, '').trim();
        const n = parseFloat(cleanStr);
        if (!isNaN(n) && n > 0) {
          mileageNum = n;
          mileageStr = cleanStr;
        }
      }

      if (parsedData.mileageStr && typeof parsedData.mileageStr === 'string') {
        const cleanStr = parsedData.mileageStr.replace(/[^0-9.]/g, '');
        if (cleanStr) {
          mileageStr = cleanStr;
          if (!mileageNum) {
            const n = parseFloat(cleanStr);
            if (!isNaN(n) && n > 0) mileageNum = n;
          }
        }
      }

      // Fallback regex detection from text if mileage was missing or 0
      if (!mileageNum || mileageNum <= 0) {
        const combinedText = `${parsedData.rawText || ''} ${parsedData.note || ''} ${responseText}`;
        const odoMatch = combinedText.match(/(?:ODO|ODOMETER|TOTAL|ไมล์|ระยะทาง)\s*[:=]?\s*([0-9,.]+)/i);
        if (odoMatch && odoMatch[1]) {
          const num = parseFloat(odoMatch[1].replace(/,/g, ''));
          if (!isNaN(num) && num > 0) {
            mileageNum = num;
            mileageStr = String(num);
          }
        }
        if (!mileageNum || mileageNum <= 0) {
          const anyDigits = combinedText.match(/\b\d{3,7}(?:\.\d+)?\b/g);
          if (anyDigits && anyDigits.length > 0) {
            const filtered = anyDigits.filter(d => !['2024', '2025', '2026', '2027'].includes(d));
            const pick = filtered.length > 0 ? filtered[0] : anyDigits[0];
            const num = parseFloat(pick);
            if (!isNaN(num) && num > 0) {
              mileageNum = num;
              mileageStr = pick;
            }
          }
        }
      }

      if (!mileageNum || mileageNum <= 0) {
        return res.json({
          success: false,
          error: 'ไม่สามารถระบุตัวเลขไมล์จากภาพนี้ได้ชัดเจน กรุณาถ่ายภาพหน้าปัดให้ชัดขึ้น หรือระบุตัวเลขด้วยตนเอง',
          rawText: parsedData.rawText || '',
          note: parsedData.note || '',
        });
      }

      return res.json({
        success: true,
        mileage: mileageNum,
        mileageStr: mileageStr || String(mileageNum),
        confidence: parsedData.confidence || 'medium',
        rawText: parsedData.rawText || '',
        note: parsedData.note || `ตรวจพบเลขไมล์ ${mileageNum.toLocaleString()} กม.`,
      });
    } catch (err: any) {
      console.error('Gemini Odometer OCR error:', err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'เกิดข้อผิดพลาดในการประมวลผลรูปภาพด้วย AI',
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
