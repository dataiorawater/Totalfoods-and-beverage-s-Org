import { Customer } from '../types';

/**
 * Calculates great-circle distance between two points in meters using Haversine formula
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Formats distance in meters or kilometers nicely for Thai UI
 */
export function formatDistance(meters?: number): string {
  if (meters === undefined || meters === null || isNaN(meters)) return '-';
  if (meters < 1000) {
    return `${meters} ม.`;
  }
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} กม.`;
}

/**
 * Extracts latitude and longitude from a customer object or their Google Maps URL
 */
export function extractCustomerCoords(customer: Customer): { lat: number; lng: number } | null {
  if (
    customer.latitude !== undefined &&
    customer.longitude !== undefined &&
    !isNaN(customer.latitude) &&
    !isNaN(customer.longitude) &&
    customer.latitude !== 0 &&
    customer.longitude !== 0
  ) {
    return { lat: customer.latitude, lng: customer.longitude };
  }

  if (!customer.mapsUrl) return null;

  // Try matching ?q=lat,lng or @lat,lng or ll=lat,lng
  const qMatch = customer.mapsUrl.match(/[?&](?:q|ll)=([+-]?\d+(?:\.\d+)?),([+-]?\d+(?:\.\d+)?)/i);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  const atMatch = customer.mapsUrl.match(/@([+-]?\d+(?:\.\d+)?),([+-]?\d+(?:\.\d+)?)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  // Try matching raw coordinates in string like 13.7153,100.5925
  const rawMatch = customer.mapsUrl.match(/([+-]?\d{1,2}\.\d+),\s*([+-]?\d{1,3}\.\d+)/);
  if (rawMatch) {
    const lat = parseFloat(rawMatch[1]);
    const lng = parseFloat(rawMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  return null;
}

/**
 * Compresses an image file (e.g. storefront photo, odometer, receipt)
 * Optimized for low-spec mobile phone browsers to prevent high memory usage and browser crashes.
 */
export function compressImageFile(
  fileOrBlobOrUrl: File | Blob | string,
  maxWidth = 960,
  maxHeight = 960,
  quality = 0.72
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof fileOrBlobOrUrl === 'string') {
      // If it's already a short dataUrl or http url, no need to recompress unless large base64
      if (!fileOrBlobOrUrl.startsWith('data:image')) {
        return resolve(fileOrBlobOrUrl);
      }
      if (fileOrBlobOrUrl.length < 50000) {
        return resolve(fileOrBlobOrUrl);
      }
    }

    let objectUrl: string | null = null;
    const img = new Image();

    const cleanup = () => {
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {
          // ignore
        }
        objectUrl = null;
      }
    };

    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: false }); // alpha: false improves rendering speed

        if (!ctx) {
          cleanup();
          resolve(typeof fileOrBlobOrUrl === 'string' ? fileOrBlobOrUrl : '');
          return;
        }

        // Draw background white for transparent png/jpeg fallback
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);

        // Immediate memory release for low-spec mobile devices
        canvas.width = 0;
        canvas.height = 0;
        cleanup();
        resolve(dataUrl);
      } catch (err) {
        cleanup();
        reject(err || new Error('การบีบอัดรูปภาพล้มเหลว'));
      }
    };

    img.onerror = () => {
      cleanup();
      reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
    };

    if (typeof fileOrBlobOrUrl === 'string') {
      img.src = fileOrBlobOrUrl;
    } else {
      try {
        objectUrl = URL.createObjectURL(fileOrBlobOrUrl);
        img.src = objectUrl;
      } catch {
        // Fallback to FileReader if createObjectURL fails
        const reader = new FileReader();
        reader.onload = (e) => {
          img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error('เกิดข้อผิดพลาดในการโหลดรูปภาพ'));
        reader.readAsDataURL(fileOrBlobOrUrl);
      }
    }
  });
}
