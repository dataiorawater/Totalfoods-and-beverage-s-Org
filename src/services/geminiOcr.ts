export interface OdometerOcrResult {
  success: boolean;
  mileage?: number;
  mileageStr?: string;
  rawText?: string;
  note?: string;
  confidence?: 'high' | 'medium' | 'low' | 'none';
  error?: string;
}

/**
 * Call server-side Gemini API endpoint to read vehicle odometer numbers from photo.
 */
export async function readOdometerFromImage(
  imageBase64: string,
  mileageType: 'start' | 'end' = 'start'
): Promise<OdometerOcrResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const res = await fetch('/api/gemini/read-odometer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: imageBase64,
        mileageType,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        success: false,
        error: data?.error || `เซิร์ฟเวอร์ตอบกลับสถานะ ${res.status}`,
      };
    }

    return data as OdometerOcrResult;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        success: false,
        error: 'หมดเวลาการเชื่อมต่อ AI (Timeout) กรุณาลองใหม่อีกครั้ง หรือระบุตัวเลขด้วยตนเอง',
      };
    }
    return {
      success: false,
      error: err?.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อประมวลผลรูปภาพได้',
    };
  }
}
