import { compressImageFile } from '../utils/geoUtils';

export const PARENT_DRIVE_FOLDER_ID = '1OMgGdY7DM78UviFNLJ-Wi_t_ayjsH5V4';
export const PARENT_DRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${PARENT_DRIVE_FOLDER_ID}`;

export interface DriveUploadResult {
  fileId: string;
  fileName: string;
  folderId?: string;
  folderName?: string;
  webViewLink: string;
  thumbnailUrl: string;
}

const DEFAULT_SPREADSHEET_ID = '1a4fKQhjvqwg486PXTO7VRPU65IPaUW_gEARl9Ky7USA';

function getConfiguredSheetsSettings(): { gasUrl?: string; spreadsheetId: string } {
  try {
    const savedConfig = localStorage.getItem('iora_sheets_config');
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      return {
        gasUrl:
          parsed?.gasUrl && typeof parsed.gasUrl === 'string' && parsed.gasUrl.trim()
            ? parsed.gasUrl.trim()
            : undefined,
        spreadsheetId:
          parsed?.spreadsheetId && typeof parsed.spreadsheetId === 'string' && parsed.spreadsheetId.trim()
            ? parsed.spreadsheetId.trim()
            : DEFAULT_SPREADSHEET_ID,
      };
    }
  } catch {
    // ignore storage errors
  }
  return { spreadsheetId: DEFAULT_SPREADSHEET_ID };
}

export async function uploadStorePhotoToDrive(
  fileOrDataUrl: File | Blob | string,
  storeName: string,
  slotNumber: number
): Promise<DriveUploadResult> {
  const compressedDataUrl = await compressImageFile(fileOrDataUrl, 1200, 1200, 0.8);
  const { gasUrl, spreadsheetId } = getConfiguredSheetsSettings();

  const res = await fetch('/api/drive/upload-store-photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storeName: String(storeName || '').trim() || 'ร้านค้าใหม่',
      slotNumber,
      imageDataUrl: compressedDataUrl,
      gasUrl,
      spreadsheetId,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `บันทึกรูปถ่ายร้านค้าไม่สำเร็จ (${res.status})`);
  }

  const fileId = String(data.fileId || '');
  const webViewLink =
    data.webViewLink || (fileId ? `https://drive.google.com/file/d/${fileId}/view` : '');

  return {
    fileId,
    fileName: String(data.fileName || `${storeName} รูปที่ ${slotNumber}.jpg`),
    folderId: data.folderId ? String(data.folderId) : undefined,
    folderName: data.folderName ? String(data.folderName) : undefined,
    webViewLink,
    thumbnailUrl: getDriveImageDisplayUrl(fileId || webViewLink),
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
  const fileId = extractDriveFileId(urlOrId);
  if (fileId) {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;
  }
  return urlOrId;
}

export function getDriveViewUrl(urlOrId: string): string {
  const fileId = extractDriveFileId(urlOrId);
  if (fileId) {
    return `https://drive.google.com/file/d/${fileId}/view`;
  }
  return urlOrId;
}
