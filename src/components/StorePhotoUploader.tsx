import React, { useRef, useState, useEffect } from 'react';
import {
  Camera,
  ImagePlus,
  Trash2,
  ExternalLink,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import {
  deleteStorePhotoFromDrive,
  getDriveImageDisplayUrl,
  getDriveViewUrl,
  isGoogleDriveUrl,
  preUploadStorePhoto,
} from '../services/googleDrive';
import { compressImageFile } from '../utils/geoUtils';

interface StorePhotoUploaderProps {
  photos: string[];
  onChange: (photos: string[]) => void;
  storeName: string;
  maxPhotos?: number;
  minPhotos?: number;
  disabled?: boolean;
  sheetsConnected?: boolean;
}

export const StorePhotoUploader: React.FC<StorePhotoUploaderProps> = ({
  photos,
  onChange,
  storeName,
  maxPhotos = 3,
  minPhotos = 1,
  disabled = false,
  sheetsConnected = true,
}) => {
  const [processingSlots, setProcessingSlots] = useState<Record<number, boolean>>({});
  const [preUploadingDataUrls, setPreUploadingDataUrls] = useState<Record<string, boolean>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [confirmRemoveIdx, setConfirmRemoveIdx] = useState<number | null>(null);
  const [isDeletingRemote, setIsDeletingRemote] = useState(false);

  const cameraInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const fileInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const photosRef = useRef<string[]>(photos);
  const onChangeRef = useRef(onChange);
  const isMountedRef = useRef(true);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const cleanStoreName = storeName.trim();

  const handleSelectFile = async (slotIdx: number, file: File | undefined) => {
    if (!file) return;
    setUploadError(null);

    if (!file.type.startsWith('image/')) {
      setUploadError('กรุณาเลือกไฟล์รูปภาพเท่านั้น (.jpg, .png, .webp)');
      return;
    }

    setProcessingSlots((prev) => ({ ...prev, [slotIdx]: true }));
    try {
      // Single-pass mobile-optimized compression (~60-110 KB)
      const compressedDataUrl = await compressImageFile(file, 960, 960, 0.7);
      const updated = [...photosRef.current];
      const targetIndex = slotIdx < updated.length ? slotIdx : updated.length;
      if (slotIdx < updated.length) {
        updated[slotIdx] = compressedDataUrl;
      } else {
        updated.push(compressedDataUrl);
      }
      const nextPhotos = updated.slice(0, maxPhotos);
      photosRef.current = nextPhotos;
      onChangeRef.current(nextPhotos);

      // Start background pre-upload immediately while user finishes filling out the form
      if (sheetsConnected && compressedDataUrl.startsWith('data:')) {
        const uploadKey = compressedDataUrl.slice(0, 64) + ':' + compressedDataUrl.length;
        setPreUploadingDataUrls((prev) => ({ ...prev, [uploadKey]: true }));
        preUploadStorePhoto(compressedDataUrl, cleanStoreName || 'ร้านค้าใหม่', targetIndex + 1)
          .then((uploaded) => {
            if (!isMountedRef.current || !uploaded?.webViewLink) return;
            const currentList = photosRef.current;
            const idxInList = currentList.indexOf(compressedDataUrl);
            if (idxInList !== -1) {
              const replaced = [...currentList];
              replaced[idxInList] = uploaded.webViewLink;
              photosRef.current = replaced;
              onChangeRef.current(replaced);
            }
          })
          .catch(() => {
            // Silently ignore here — background sync queue will upload/retry on submit
          })
          .finally(() => {
            if (isMountedRef.current) {
              setPreUploadingDataUrls((prev) => {
                const next = { ...prev };
                delete next[uploadKey];
                return next;
              });
            }
          });
      }
    } catch (err: any) {
      setUploadError(err?.message || 'เกิดข้อผิดพลาดในการอ่านรูปภาพ');
    } finally {
      if (isMountedRef.current) {
        setProcessingSlots((prev) => ({ ...prev, [slotIdx]: false }));
      }
    }
  };

  const handleRequestRemove = (idx: number) => {
    const target = photos[idx];
    if (!target) return;

    if (!isGoogleDriveUrl(target)) {
      onChange(photos.filter((_, i) => i !== idx));
      return;
    }

    setConfirmRemoveIdx(idx);
  };

  const handleConfirmUnlinkOnly = () => {
    if (confirmRemoveIdx === null) return;
    onChange(photos.filter((_, i) => i !== confirmRemoveIdx));
    setConfirmRemoveIdx(null);
  };

  const handleConfirmDeleteRemote = async () => {
    if (confirmRemoveIdx === null) return;
    const targetUrl = photos[confirmRemoveIdx];
    setIsDeletingRemote(true);
    setUploadError(null);
    try {
      await deleteStorePhotoFromDrive(targetUrl);
      onChange(photos.filter((_, i) => i !== confirmRemoveIdx));
      setConfirmRemoveIdx(null);
    } catch (err: any) {
      setUploadError(err?.message || 'ไม่สามารถลบไฟล์รูปภาพได้');
    } finally {
      setIsDeletingRemote(false);
    }
  };

  return (
    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Camera className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-bold text-slate-800">
            รูปถ่ายร้านค้า ({photos.length}/{maxPhotos} รูป) <span className="text-rose-500">*</span>
          </span>
        </div>
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
            photos.length >= minPhotos
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}
        >
          บังคับอย่างน้อย {minPhotos} รูป
        </span>
      </div>

      {/* Error Message */}
      {uploadError && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-700 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500 mt-0.5" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Confirmation Banner when removing an existing saved photo */}
      {confirmRemoveIdx !== null && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs space-y-2">
          <p className="font-bold text-amber-900">
            ยืนยันการลบรูปถ่ายร้านค้าที่ {confirmRemoveIdx + 1}
          </p>
          <p className="text-[11px] text-amber-800">
            ต้องการนำรูปนี้ออกจากข้อมูลลูกค้าเท่านั้น หรือต้องการลบไฟล์รูปที่จัดเก็บไว้ออกด้วย?
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleConfirmUnlinkOnly}
              disabled={isDeletingRemote}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-[11px] font-semibold cursor-pointer"
            >
              นำออกจากฟอร์มเท่านั้น
            </button>
            <button
              type="button"
              onClick={handleConfirmDeleteRemote}
              disabled={isDeletingRemote}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50"
            >
              {isDeletingRemote && <Loader2 className="w-3 h-3 animate-spin" />}
              <span>ลบไฟล์ถาวร</span>
            </button>
            <button
              type="button"
              onClick={() => setConfirmRemoveIdx(null)}
              disabled={isDeletingRemote}
              className="px-2 py-1 text-slate-500 hover:text-slate-700 text-[11px] font-medium cursor-pointer"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {/* 3 Photo Slots Grid */}
      <div className="grid grid-cols-3 gap-2.5">
        {Array.from({ length: maxPhotos }).map((_, slotIdx) => {
          const photoUrl = photos[slotIdx];
          const isRequiredSlot = slotIdx < minPhotos;
          const isProcessing = Boolean(processingSlots[slotIdx]);
          const isSaved = photoUrl ? isGoogleDriveUrl(photoUrl) : false;
          const uploadKey =
            photoUrl && photoUrl.startsWith('data:')
              ? photoUrl.slice(0, 64) + ':' + photoUrl.length
              : '';
          const isPreUploading = Boolean(uploadKey && preUploadingDataUrls[uploadKey]);
          const canAddHere = slotIdx <= photos.length;

          return (
            <div
              key={slotIdx}
              className={`relative rounded-xl border overflow-hidden bg-white flex flex-col justify-between min-h-[126px] ${
                photoUrl
                  ? 'border-emerald-300 shadow-2xs'
                  : isRequiredSlot
                    ? 'border-dashed border-rose-300 bg-rose-50/30'
                    : 'border-dashed border-slate-300 bg-slate-50/50'
              }`}
            >
              {/* Hidden inputs for Camera & File Picker */}
              <input
                ref={(el) => {
                  cameraInputRefs.current[slotIdx] = el;
                }}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={disabled || isProcessing}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  handleSelectFile(slotIdx, f);
                }}
              />
              <input
                ref={(el) => {
                  fileInputRefs.current[slotIdx] = el;
                }}
                type="file"
                accept="image/*"
                className="hidden"
                disabled={disabled || isProcessing}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  handleSelectFile(slotIdx, f);
                }}
              />

              {photoUrl && getDriveImageDisplayUrl(photoUrl, 400) ? (
                <>
                  <div className="relative w-full h-24 bg-slate-100">
                    <img
                      src={getDriveImageDisplayUrl(photoUrl, 400)}
                      alt={`รูปถ่ายร้านค้าที่ ${slotIdx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {isProcessing && (
                      <div className="absolute inset-0 bg-slate-900/60 flex flex-col items-center justify-center text-white text-[10px] font-semibold gap-1">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>กำลังเตรียมรูป...</span>
                      </div>
                    )}
                    {!isProcessing && !disabled && (
                      <button
                        type="button"
                        onClick={() => handleRequestRemove(slotIdx)}
                        title="ลบรูปนี้"
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-slate-900/70 hover:bg-rose-600 text-white flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="px-1.5 py-1 flex items-center justify-between gap-1 bg-white border-t border-slate-100 text-[10px]">
                    <span className="font-semibold text-emerald-700 truncate flex items-center gap-1">
                      {isPreUploading ? (
                        <>
                          <Loader2 className="w-2.5 h-2.5 animate-spin text-blue-600 shrink-0" />
                          <span className="text-blue-700 truncate">กำลังอัปโหลด...</span>
                        </>
                      ) : isSaved ? (
                        <>
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                          <span className="truncate">
                            {cleanStoreName ? `${cleanStoreName} รูปที่ ${slotIdx + 1}` : `รูปที่ ${slotIdx + 1}`}
                          </span>
                        </>
                      ) : (
                        <span className="truncate">
                          {cleanStoreName ? `${cleanStoreName} รูปที่ ${slotIdx + 1}` : `รูปที่ ${slotIdx + 1}`}
                        </span>
                      )}
                    </span>
                    {isSaved && (
                      <a
                        href={getDriveViewUrl(photoUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 shrink-0"
                        title="เปิดดูรูปภาพ"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-2 text-center gap-1.5">
                  {isProcessing ? (
                    <div className="flex flex-col items-center gap-1 text-blue-600">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-[10px] font-semibold">กำลังเตรียมรูป...</span>
                    </div>
                  ) : (
                    <>
                      <span
                        className={`text-[10px] font-bold ${
                          isRequiredSlot ? 'text-rose-600' : 'text-slate-500'
                        }`}
                      >
                        รูปที่ {slotIdx + 1} {isRequiredSlot ? '(บังคับ *)' : '(เพิ่มเติม)'}
                      </span>

                      <div className="flex flex-col gap-1 w-full">
                        <button
                          type="button"
                          disabled={disabled || !canAddHere}
                          onClick={() => cameraInputRefs.current[slotIdx]?.click()}
                          className="w-full inline-flex items-center justify-center gap-1 px-1.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[10px] font-semibold cursor-pointer disabled:opacity-40"
                        >
                          <Camera className="w-3 h-3" />
                          <span>ถ่ายรูป</span>
                        </button>
                        <button
                          type="button"
                          disabled={disabled || !canAddHere}
                          onClick={() => fileInputRefs.current[slotIdx]?.click()}
                          className="w-full inline-flex items-center justify-center gap-1 px-1.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-medium cursor-pointer disabled:opacity-40"
                        >
                          <ImagePlus className="w-3 h-3" />
                          <span>เลือกไฟล์</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
