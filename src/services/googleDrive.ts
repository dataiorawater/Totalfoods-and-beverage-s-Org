import { compressImageFile } from '../utils/geoUtils';

export const PARENT_DRIVE_FOLDER_ID = '1OMgGdY7DM78UviFNLJ-Wi_t_ayjsH5V4';
export const DEFAULT_STORE_PHOTO_FOLDER_ID = PARENT_DRIVE_FOLDER_ID;
export const PARENT_DRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${PARENT_DRIVE_FOLDER_ID}`;

export interface DriveUploadResult {
  fileId: string;
  fileName: string;
  folderId?: string;
  folderName?: string;
  webViewLink: string;
  thumbnailUrl: string;
}

export interface DriveFolderTestResult {
  success: boolean;
  folderId?: string;
  folderName?: string;
  folderUrl?: string;
  message: string;
}

const DEFAULT_SPREADSHEET_ID = '1a4fKQhjvqwg486PXTO7VRPU65IPaUW_gEARl9Ky7USA';

export function extractDriveFolderId(input?: string | null): string {
  if (!input) return '';
  const str = String(input).trim();
  if (!str) return '';

  const folderMatch = str.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (folderMatch) return folderMatch[1];

  const idMatch = str.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (idMatch) return idMatch[1];

  if (/^[a-zA-Z0-9_-]{10,120}$/.test(str) && !str.includes('http')) {
    return str;
  }
  return '';
}

export function getDriveFolderUrl(folderIdOrUrl?: string | null): string {
  const id = extractDriveFolderId(folderIdOrUrl);
  return id ? `https://drive.google.com/drive/folders/${id}` : '';
}

function getConfiguredSheetsSettings(): {
  gasUrl?: string;
  spreadsheetId: string;
  storePhotoFolderId: string;
  checkInPhotoFolderId: string;
} {
  try {
    const savedConfig = localStorage.getItem('iora_sheets_config');
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      const storeFolder = extractDriveFolderId(parsed?.storePhotoFolderId);
      const checkInFolder = extractDriveFolderId(parsed?.checkInPhotoFolderId);
      return {
        gasUrl:
          parsed?.gasUrl && typeof parsed.gasUrl === 'string' && parsed.gasUrl.trim()
            ? parsed.gasUrl.trim()
            : undefined,
        spreadsheetId:
          parsed?.spreadsheetId && typeof parsed.spreadsheetId === 'string' && parsed.spreadsheetId.trim()
            ? parsed.spreadsheetId.trim()
            : DEFAULT_SPREADSHEET_ID,
        storePhotoFolderId: storeFolder || DEFAULT_STORE_PHOTO_FOLDER_ID,
        checkInPhotoFolderId: checkInFolder,
      };
    }
  } catch {
    // ignore storage errors
  }
  return {
    spreadsheetId: DEFAULT_SPREADSHEET_ID,
    storePhotoFolderId: DEFAULT_STORE_PHOTO_FOLDER_ID,
    checkInPhotoFolderId: '',
  };
}

function getBangkokDateParts(date: Date): { year: string; month: string; day: string; hour: string; minute: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const pick = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: pick('hour'),
    minute: pick('minute'),
  };
}

function sanitizeFilenamePart(val: string, fallback: string): string {
  const clean = String(val || '')
    .trim()
    .replace(/[\\/:*?"<>|\r\n]+/g, ' ')
    .replace(/\s+/g, '_')
    .slice(0, 60);
  return clean || fallback;
}

const DEFAULT_GAS_URL =
  'https://script.google.com/macros/s/AKfycbzfqWujgz3EhJJ4fJ6DEf6J6RibJvyp_b8QA2OwVAhN1WG4gVEr2OnrOXtqvJnJqMU9/exec';

function isValidGasUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url.trim());
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'script.google.com' || parsed.hostname === 'script.googleusercontent.com')
    );
  } catch {
    return false;
  }
}

function formatGasDriveError(rawError: string, gasUrl?: string): string {
  if (rawError === 'Invalid action') {
    return 'กรุณาอัปเดตโค้ด Apps Script (Code.gs v4) ที่เมนูตั้งค่า > Google Drive รูปภาพ และ Deploy เวอร์ชันใหม่';
  }
  if (rawError.includes('DriveApp') && (rawError.includes('permission') || rawError.includes('auth/drive'))) {
    const shortUrl = (gasUrl || DEFAULT_GAS_URL).slice(-22);
    return `Apps Script (...${shortUrl}) ยังไม่มีสิทธิ์ Google Drive — จุดสำคัญ: ในหน้าขอสิทธิ์ของ Google ต้อง "ติ๊กถูกช่องสี่เหลี่ยม Google Drive (หรือ เลือกทั้งหมด)" ก่อนกด "ดำเนินการต่อ" แล้วรัน authorizeDrive ให้ผ่าน จากนั้นสร้าง New deployment (ดำเนินการในฐานะ: ฉัน / ทุกคน)\n[รายละเอียดจาก Google: ${rawError}]`;
  }
  return rawError;
}

async function postDirectToGas(
  gasUrl: string | undefined,
  gasPayload: Record<string, any>
): Promise<Record<string, any>> {
  const targetUrl = isValidGasUrl(gasUrl) ? gasUrl!.trim() : DEFAULT_GAS_URL;
  const res = await fetch(targetUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(gasPayload),
  });
  const text = await res.text();
  if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
    return {
      success: false,
      error:
        'ระบบหลังบ้าน Google Apps Script ยังไม่ได้เปิดสิทธิ์ Anyone หรือยังไม่ได้อนุญาตสิทธิ์ DriveApp กรุณาตั้งค่า Who has access = Anyone แล้ว Deploy ใหม่',
    };
  }
  let json: Record<string, any> = {};
  try {
    json = JSON.parse(text);
  } catch {
    return {
      success: false,
      error: `การตอบกลับจาก Apps Script ไม่ถูกต้อง (${res.status})`,
    };
  }
  if (json.error) {
    return { success: false, error: formatGasDriveError(String(json.error), targetUrl) };
  }
  return { success: true, ...json };
}

async function callDriveApiWithFallback(
  apiPath: string,
  apiPayload: Record<string, any>,
  gasFallbackPayload: Record<string, any>,
  gasUrl?: string
): Promise<Record<string, any>> {
  try {
    const res = await fetch(apiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiPayload),
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = (await res.json().catch(() => null)) as Record<string, any> | null;
      if (data && typeof data === 'object' && ('success' in data || 'error' in data)) {
        if (!data.success && data.error) {
          return { ...data, error: formatGasDriveError(String(data.error), gasUrl) };
        }
        return data;
      }
    }
    // Non-JSON response (e.g. reverse proxy 403/404/502 page) -> fall back directly to Apps Script
    return await postDirectToGas(gasUrl, gasFallbackPayload);
  } catch {
    // Network/proxy failure on local API route -> fall back directly to Apps Script
    return await postDirectToGas(gasUrl, gasFallbackPayload);
  }
}

export async function uploadStorePhotoToDrive(
  fileOrDataUrl: File | Blob | string,
  storeName: string,
  slotNumber: number
): Promise<DriveUploadResult> {
  const compressedDataUrl = await compressImageFile(fileOrDataUrl, 1200, 1200, 0.8);
  const { gasUrl, spreadsheetId, storePhotoFolderId } = getConfiguredSheetsSettings();
  const cleanStoreName = String(storeName || '').trim() || 'ร้านค้าใหม่';
  const mimeMatch = compressedDataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const base64Data = compressedDataUrl.replace(/^data:[a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+;base64,/, '');

  const data = await callDriveApiWithFallback(
    '/api/drive/upload-store-photo',
    {
      category: 'storefront',
      parentFolderId: storePhotoFolderId,
      storeName: cleanStoreName,
      slotNumber,
      imageDataUrl: compressedDataUrl,
      gasUrl,
      spreadsheetId,
    },
    {
      action: 'uploadDrivePhoto',
      spreadsheetId,
      parentFolderId: storePhotoFolderId,
      category: 'storefront',
      storeName: cleanStoreName,
      slotNumber,
      base64Data,
      mimeType,
    },
    gasUrl
  );

  if (!data?.success) {
    throw new Error(data?.error || 'บันทึกรูปถ่ายร้านค้าลง Google Drive ไม่สำเร็จ');
  }

  const fileId = String(data.fileId || '');
  const webViewLink =
    data.webViewLink || (fileId ? `https://drive.google.com/file/d/${fileId}/view` : '');

  return {
    fileId,
    fileName: String(data.fileName || `${cleanStoreName} รูปที่ ${slotNumber}.jpg`),
    folderId: data.folderId ? String(data.folderId) : undefined,
    folderName: data.folderName ? String(data.folderName) : undefined,
    webViewLink,
    thumbnailUrl: getDriveImageDisplayUrl(fileId || webViewLink),
  };
}

export async function uploadCheckInPhotoToDrive(
  fileOrDataUrl: File | Blob | string,
  options: {
    storeName: string;
    salespersonName?: string;
    date?: Date;
  }
): Promise<DriveUploadResult> {
  const compressedDataUrl = await compressImageFile(fileOrDataUrl, 1200, 1200, 0.8);
  const { gasUrl, spreadsheetId, storePhotoFolderId, checkInPhotoFolderId } =
    getConfiguredSheetsSettings();

  const targetDate = options.date || new Date();
  const { year, month, day, hour, minute } = getBangkokDateParts(targetDate);
  const subFolderName = `${year}-${month}`;
  const safeStore = sanitizeFilenamePart(options.storeName, 'ร้านค้า');
  const safeSales = sanitizeFilenamePart(options.salespersonName || '', 'พนักงาน');
  const customFileName = `${year}-${month}-${day}_${hour}${minute}_${safeStore}_${safeSales}.jpg`;

  const hasDedicatedCheckInFolder = Boolean(checkInPhotoFolderId);
  const targetParentFolderId = checkInPhotoFolderId || storePhotoFolderId;
  const cleanStoreName = String(options.storeName || '').trim() || 'ร้านค้า';
  const mimeMatch = compressedDataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const base64Data = compressedDataUrl.replace(/^data:[a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+;base64,/, '');

  const data = await callDriveApiWithFallback(
    '/api/drive/upload-store-photo',
    {
      category: 'checkin',
      parentFolderId: targetParentFolderId,
      useCheckInRootSubfolder: !hasDedicatedCheckInFolder,
      subFolderName,
      customFileName,
      storeName: cleanStoreName,
      imageDataUrl: compressedDataUrl,
      gasUrl,
      spreadsheetId,
    },
    {
      action: 'uploadDrivePhoto',
      spreadsheetId,
      parentFolderId: targetParentFolderId,
      category: 'checkin',
      useCheckInRootSubfolder: !hasDedicatedCheckInFolder,
      subFolderName,
      customFileName,
      storeName: cleanStoreName,
      base64Data,
      mimeType,
    },
    gasUrl
  );

  if (!data?.success) {
    throw new Error(data?.error || 'บันทึกรูปเช็คอินลง Google Drive ไม่สำเร็จ');
  }

  const fileId = String(data.fileId || '');
  const webViewLink =
    data.webViewLink || (fileId ? `https://drive.google.com/file/d/${fileId}/view` : '');

  return {
    fileId,
    fileName: String(data.fileName || customFileName),
    folderId: data.folderId ? String(data.folderId) : undefined,
    folderName: data.folderName ? String(data.folderName) : subFolderName,
    webViewLink,
    thumbnailUrl: getDriveImageDisplayUrl(fileId || webViewLink),
  };
}

export async function testDriveFolderConnection(
  folderIdOrUrl: string,
  overrideGasUrl?: string,
  overrideSpreadsheetId?: string
): Promise<DriveFolderTestResult> {
  const folderId = extractDriveFolderId(folderIdOrUrl);
  if (!folderId) {
    return {
      success: false,
      message: 'กรุณาระบุ Google Drive Folder ID หรือ URL โฟลเดอร์ที่ถูกต้อง',
    };
  }

  const configured = getConfiguredSheetsSettings();
  const effectiveGasUrl = overrideGasUrl?.trim() || configured.gasUrl;
  const effectiveSpreadsheetId = overrideSpreadsheetId?.trim() || configured.spreadsheetId;

  const data = await callDriveApiWithFallback(
    '/api/drive/test-folder',
    {
      folderId,
      gasUrl: effectiveGasUrl,
      spreadsheetId: effectiveSpreadsheetId,
    },
    {
      action: 'testDriveFolder',
      spreadsheetId: effectiveSpreadsheetId,
      folderId,
    },
    effectiveGasUrl
  );

  if (!data?.success) {
    return {
      success: false,
      message: data?.error || 'ไม่สามารถเชื่อมต่อโฟลเดอร์ได้',
    };
  }

  return {
    success: true,
    folderId: String(data.folderId || folderId),
    folderName: String(data.folderName || 'Google Drive Folder'),
    folderUrl: String(data.folderUrl || `https://drive.google.com/drive/folders/${folderId}`),
    message: `เชื่อมต่อโฟลเดอร์ "${data.folderName || folderId}" สำเร็จ!`,
  };
}

export async function deleteStorePhotoFromDrive(urlOrId: string): Promise<void> {
  const fileId = extractDriveFileId(urlOrId);
  if (!fileId) return;

  const { gasUrl, spreadsheetId } = getConfiguredSheetsSettings();
  const res = await fetch('/api/drive/delete-store-photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileId,
      gasUrl,
      spreadsheetId,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok || data?.success === false) {
    throw new Error(data?.error || 'ไม่สามารถลบไฟล์รูปภาพได้');
  }
}

export function extractDriveFileId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const str = String(urlOrId).trim();
  if (str.startsWith('data:')) return null;

  const dMatch = str.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (dMatch) return dMatch[1];

  const idMatch = str.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (idMatch) return idMatch[1];

  if (/^[a-zA-Z0-9_-]{15,}$/.test(str) && !str.includes('http')) {
    return str;
  }
  return null;
}

export function isGoogleDriveUrl(url: string): boolean {
  return Boolean(extractDriveFileId(url)) || /drive\.google\.com/i.test(String(url || ''));
}

export function getDriveImageDisplayUrl(urlOrId: string, width = 800): string {
  const str = String(urlOrId || '').trim();
  if (!str) return '';
  const fileId = extractDriveFileId(str);
  if (fileId) {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;
  }
  if (/^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(str) || /^https?:\/\//i.test(str)) {
    return str;
  }
  return '';
}

export function getDriveViewUrl(urlOrId: string): string {
  const str = String(urlOrId || '').trim();
  if (!str) return '';
  const fileId = extractDriveFileId(str);
  if (fileId) {
    return `https://drive.google.com/file/d/${fileId}/view`;
  }
  if (/^https?:\/\//i.test(str)) {
    return str;
  }
  return '';
}
