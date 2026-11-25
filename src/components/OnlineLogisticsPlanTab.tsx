import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Search,
  MapPin,
  Phone,
  Download,
  Printer,
  Package,
  Truck,
  AlertTriangle,
  EyeOff,
  Eye,
  X,
  RotateCcw,
  ExternalLink,
  Layers,
  Table as TableIcon,
  Check,
  Calendar,
  CloudUpload,
  RefreshCw,
  CheckCircle2,
  BookmarkCheck,
  Plus,
  Loader2,
  Database,
} from 'lucide-react';
import { Route, StaffUser } from '../types';
import { toTelHref } from '../utils/phoneUtils';
import {
  OnlineDeliveryStatus,
  OnlineOrderRawRow,
  OnlinePostalRouteMapping,
  PostalCodeRouteGroup,
  SAMPLE_ONLINE_CSV_PATH,
  buildOnlineRowDedupKey,
  parseOnlineOrdersFromFileBuffer,
  groupOnlineOrdersByPostalCode,
  buildExportOnlinePlanCsv,
  getOnlineStatusLabelThai,
} from '../utils/onlineOrderCsv';
import {
  fetchOnlineDeliveryPlanFromSheet,
  fetchOnlinePostalRoutesFromSheet,
  saveOnlineDeliveryPlanBatchToSheet,
  saveOnlinePostalRoutesBatchToSheet,
  updateOnlinePlanRowsInSheet,
} from '../services/googleSheets';

interface OnlineLogisticsPlanTabProps {
  routes: Route[];
  staffList: StaffUser[];
  spreadsheetId?: string;
  sheetsConnected: boolean;
  onShowToast?: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

const DEFAULT_TRUCK_ROUTES = [
  'สายออนไลน์ A (โซนตะวันออก / บางกะปิ-สวนหลวง)',
  'สายออนไลน์ B (โซนเหนือ / สายไหม-บางเขน-จตุจักร)',
  'สายออนไลน์ C (โซนกลาง / วังทองหลาง-ราชเทวี-ปทุมวัน)',
  'สายออนไลน์ D (โซนใต้-ฝั่งธน / ภาษีเจริญ-ราษฎร์บูรณะ)',
  'สายออนไลน์ E (สมุทรปราการ / บางพลี-เมือง-พระประแดง)',
];

function getTodayIsoLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatThaiShortDate(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || '-';
  const [yStr, mStr, dStr] = isoDate.split('-');
  const thaiMonths = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
  ];
  const mIdx = Math.max(0, Math.min(11, parseInt(mStr, 10) - 1));
  return `${parseInt(dStr, 10)} ${thaiMonths[mIdx]} ${parseInt(yStr, 10) + 543}`;
}

function getDefaultTruckAssignment(postalCode: string): string {
  if (postalCode === 'MASKED') return 'รอตรวจสอบรหัสไปรษณีย์';
  if (['10240', '10250', '10520', '10260'].includes(postalCode)) {
    return DEFAULT_TRUCK_ROUTES[0];
  }
  if (['10210', '10220', '10230', '10510', '10530', '10900'].includes(postalCode)) {
    return DEFAULT_TRUCK_ROUTES[1];
  }
  if (
    ['10100', '10110', '10200', '10300', '10310', '10320', '10330', '10400', '10500', '10800'].includes(
      postalCode
    )
  ) {
    return DEFAULT_TRUCK_ROUTES[2];
  }
  if (['10120', '10140', '10150', '10160', '10170', '10600', '10700'].includes(postalCode)) {
    return DEFAULT_TRUCK_ROUTES[3];
  }
  if (['10130', '10270', '10280', '10290', '10540', '10560'].includes(postalCode)) {
    return DEFAULT_TRUCK_ROUTES[4];
  }
  return `สายรหัส ${postalCode}`;
}

function getStatusBadgeClasses(status: OnlineDeliveryStatus): string {
  switch (status) {
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'delivering':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'cancelled':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'pending':
    default:
      return 'bg-amber-50 text-amber-700 border-amber-200';
  }
}

export const OnlineLogisticsPlanTab: React.FC<OnlineLogisticsPlanTabProps> = ({
  routes,
  staffList,
  spreadsheetId,
  sheetsConnected,
  onShowToast,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Selected delivery plan date (YYYY-MM-DD)
  const [selectedPlanDate, setSelectedPlanDate] = useState<string>(getTodayIsoLocal);

  // Data stored in Google Sheets (all dates) + Postal-code mapping rules
  const [sheetAllRows, setSheetAllRows] = useState<OnlineOrderRawRow[]>([]);
  const [postalMappings, setPostalMappings] = useState<OnlinePostalRouteMapping[]>([]);
  const [isLoadingSheets, setIsLoadingSheets] = useState<boolean>(false);
  const [isSavingToSheets, setIsSavingToSheets] = useState<boolean>(false);
  const [isSyncingInline, setIsSyncingInline] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('');

  // Pending uploaded CSV rows (not yet saved to Google Sheets)
  const [pendingRows, setPendingRows] = useState<OnlineOrderRawRow[]>([]);
  const [pendingFileName, setPendingFileName] = useState<string>('');
  const [detectedEncoding, setDetectedEncoding] = useState<string>('');
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Save options for pending CSV upload
  const [skipMaskedOnSave, setSkipMaskedOnSave] = useState<boolean>(true);
  const [rememberRoutesOnSave, setRememberRoutesOnSave] = useState<boolean>(true);

  // View & filter state
  const [viewMode, setViewMode] = useState<'by_postal' | 'by_truck' | 'all_rows'>('by_postal');
  const [selectedPostalCode, setSelectedPostalCode] = useState<string>('ALL');
  const [selectedTruckRoute, setSelectedTruckRoute] = useState<string>('ALL');
  const [platformFilter, setPlatformFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [hideMasked, setHideMasked] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Active route & driver assignment maps (keyed by postalCode)
  const [routeAssignments, setRouteAssignments] = useState<Record<string, string>>({});
  const [driverAssignments, setDriverAssignments] = useState<Record<string, string>>({});

  // Print preview modal
  const [printGroup, setPrintGroup] = useState<PostalCodeRouteGroup | null>(null);

  // Postal Route Mapping Manager modal
  const [isMappingModalOpen, setIsMappingModalOpen] = useState<boolean>(false);
  const [mappingSearch, setMappingSearch] = useState<string>('');
  const [newMapZip, setNewMapZip] = useState<string>('');
  const [newMapRoute, setNewMapRoute] = useState<string>(DEFAULT_TRUCK_ROUTES[0]);
  const [newMapDriver, setNewMapDriver] = useState<string>('');
  const [newMapNotes, setNewMapNotes] = useState<string>('');
  const [isSavingMappingModal, setIsSavingMappingModal] = useState<boolean>(false);

  const canUseSheets = Boolean(sheetsConnected && spreadsheetId);

  // Lookup map from saved OnlinePostalRoutes sheet
  const postalMappingMap = useMemo(() => {
    const map = new Map<string, OnlinePostalRouteMapping>();
    for (const m of postalMappings) {
      map.set(m.postalCode, m);
    }
    return map;
  }, [postalMappings]);

  // Route options combining default online truck routes + system routes + any custom routes saved in Sheets
  const availableRouteOptions = useMemo(() => {
    const systemNames = routes
      .map((r) => r.name?.trim())
      .filter((name): name is string => Boolean(name));
    const savedNames = postalMappings
      .map((m) => m.routeName?.trim())
      .filter((name): name is string => Boolean(name));
    return Array.from(new Set([...DEFAULT_TRUCK_ROUTES, ...systemNames, ...savedNames]));
  }, [routes, postalMappings]);

  const activeDrivers = useMemo(
    () => staffList.filter((u) => u.status !== 'inactive'),
    [staffList]
  );

  // Available dates stored in Google Sheets (sorted newest first)
  const savedDatesSummary = useMemo(() => {
    const map = new Map<string, { date: string; orderSet: Set<string>; rowCount: number }>();
    for (const r of sheetAllRows) {
      const d = r.planDate || 'ไม่ระบุวันที่';
      const entry = map.get(d) || { date: d, orderSet: new Set<string>(), rowCount: 0 };
      entry.orderSet.add(r.orderNumber);
      entry.rowCount += 1;
      map.set(d, entry);
    }
    return Array.from(map.values())
      .map((e) => ({ date: e.date, orderCount: e.orderSet.size, rowCount: e.rowCount }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [sheetAllRows]);

  // Rows saved in Google Sheets for the currently selected delivery date
  const savedRowsForSelectedDate = useMemo(() => {
    return sheetAllRows.filter((r) => r.planDate === selectedPlanDate);
  }, [sheetAllRows, selectedPlanDate]);

  // Deduplication summary when there is a pending CSV upload
  const pendingUploadStats = useMemo(() => {
    if (pendingRows.length === 0) {
      return { total: 0, newValid: 0, newMasked: 0, duplicateCount: 0, willSaveCount: 0 };
    }
    const existingKeys = new Set<string>();
    for (const r of savedRowsForSelectedDate) {
      existingKeys.add(
        buildOnlineRowDedupKey(selectedPlanDate, r.orderNumber, r.sku, r.productName)
      );
    }
    const seenUploadKeys = new Set<string>();
    let newValid = 0;
    let newMasked = 0;
    let duplicateCount = 0;

    for (const r of pendingRows) {
      const key = buildOnlineRowDedupKey(selectedPlanDate, r.orderNumber, r.sku, r.productName);
      if (existingKeys.has(key) || seenUploadKeys.has(key)) {
        duplicateCount++;
        continue;
      }
      seenUploadKeys.add(key);
      if (r.isMasked) newMasked++;
      else newValid++;
    }

    const willSaveCount = skipMaskedOnSave ? newValid : newValid + newMasked;
    return {
      total: pendingRows.length,
      newValid,
      newMasked,
      duplicateCount,
      willSaveCount,
    };
  }, [pendingRows, savedRowsForSelectedDate, selectedPlanDate, skipMaskedOnSave]);

  // Active rows displayed on screen:
  // If the user has an unsaved CSV upload staged, show it (merged preview with saved rows for the date, or staged rows directly).
  // Actually showing staged rows clearly when pendingRows.length > 0, or savedRowsForSelectedDate when no pending upload, is clearest!
  const isPreviewingUpload = pendingRows.length > 0;
  const activeRows = isPreviewingUpload ? pendingRows : savedRowsForSelectedDate;

  // Fetch OnlineDeliveryPlan & OnlinePostalRoutes from Google Sheets
  const loadFromGoogleSheets = useCallback(
    async (silent = false) => {
      if (!spreadsheetId) return;
      setIsLoadingSheets(true);
      setUploadError(null);
      try {
        const [planRows, mappings] = await Promise.all([
          fetchOnlineDeliveryPlanFromSheet(spreadsheetId),
          fetchOnlinePostalRoutesFromSheet(spreadsheetId),
        ]);
        setSheetAllRows(planRows);
        setPostalMappings(mappings);
        setLastSyncedAt(
          new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
        );
      } catch (err: any) {
        const msg = err?.details || err?.message || 'ไม่สามารถดึงข้อมูลแผนจัดส่งออนไลน์จาก Google Sheets ได้';
        setUploadError(msg);
        if (!silent) {
          onShowToast?.('error', 'ดึงข้อมูลไม่สำเร็จ', msg);
        }
      } finally {
        setIsLoadingSheets(false);
      }
    },
    [spreadsheetId, onShowToast]
  );

  // Initial load from Google Sheets
  useEffect(() => {
    if (canUseSheets) {
      loadFromGoogleSheets(true);
    }
  }, [canUseSheets, loadFromGoogleSheets]);

  // Sync routeAssignments & driverAssignments whenever activeRows or postalMappings change
  useEffect(() => {
    const nextRoutes: Record<string, string> = {};
    const nextDrivers: Record<string, string> = {};

    for (const r of activeRows) {
      const zip = r.postalCode;
      if (!nextRoutes[zip]) {
        const savedMapping = postalMappingMap.get(zip);
        if (r.source === 'sheets' && r.assignedRoute) {
          nextRoutes[zip] = r.assignedRoute;
        } else if (savedMapping?.routeName) {
          nextRoutes[zip] = savedMapping.routeName;
        } else {
          nextRoutes[zip] = getDefaultTruckAssignment(zip);
        }
      }
      if (nextDrivers[zip] === undefined) {
        const savedMapping = postalMappingMap.get(zip);
        if (r.source === 'sheets' && r.assignedDriver) {
          nextDrivers[zip] = r.assignedDriver;
        } else if (savedMapping?.driverName) {
          nextDrivers[zip] = savedMapping.driverName;
        } else {
          nextDrivers[zip] = '';
        }
      }
    }

    setRouteAssignments(nextRoutes);
    setDriverAssignments(nextDrivers);
  }, [activeRows, postalMappingMap]);

  // Process uploaded CSV / Excel ArrayBuffer
  const processArrayBuffer = (
    buffer: ArrayBuffer,
    sourceFileName: string,
    sourceType: 'upload' | 'sample' = 'upload'
  ) => {
    setUploadError(null);
    const { rows, formatLabel } = parseOnlineOrdersFromFileBuffer(buffer, sourceFileName);

    if (rows.length === 0) {
      setUploadError('ไม่พบข้อมูลออเดอร์ในไฟล์ กรุณาตรวจสอบรูปแบบไฟล์ CSV หรือ Excel อีกครั้ง');
      return;
    }

    const enriched: OnlineOrderRawRow[] = rows.map((r) => {
      const savedMapping = postalMappingMap.get(r.postalCode);
      return {
        ...r,
        planDate: selectedPlanDate,
        assignedRoute: savedMapping?.routeName || getDefaultTruckAssignment(r.postalCode),
        assignedDriver: savedMapping?.driverName || '',
        deliveryStatus: 'pending',
        source: sourceType,
      };
    });

    setPendingRows(enriched);
    setPendingFileName(sourceFileName);
    setDetectedEncoding(formatLabel);
    setSelectedPostalCode('ALL');
    setSelectedTruckRoute('ALL');
  };

  const handleFileChange = async (file?: File | null) => {
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    if (
      !lowerName.endsWith('.csv') &&
      !lowerName.endsWith('.xlsx') &&
      !lowerName.endsWith('.xls')
    ) {
      setUploadError('รองรับเฉพาะไฟล์นามสกุล .csv, .xlsx และ .xls เท่านั้น');
      return;
    }
    setIsLoadingFile(true);
    try {
      const buffer = await file.arrayBuffer();
      processArrayBuffer(buffer, file.name, 'upload');
    } catch (err: any) {
      setUploadError(err?.message || 'เกิดข้อผิดพลาดระหว่างอ่านไฟล์ CSV / Excel');
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handleLoadSampleCsv = async () => {
    setIsLoadingFile(true);
    setUploadError(null);
    try {
      const response = await fetch(SAMPLE_ONLINE_CSV_PATH);
      if (!response.ok) throw new Error('ไม่สามารถโหลดไฟล์ตัวอย่างได้');
      const buffer = await response.arrayBuffer();
      processArrayBuffer(buffer, 'Order-SKU-inprocess20260715090107415.csv (ไฟล์ตัวอย่าง)', 'sample');
    } catch (err: any) {
      setUploadError(err?.message || 'ไม่สามารถโหลดไฟล์ตัวอย่างได้');
    } finally {
      setIsLoadingFile(false);
    }
  };

  // Save pending uploaded CSV to Google Sheets (OnlineDeliveryPlan + OnlinePostalRoutes)
  const handleSavePendingToSheets = async () => {
    if (!canUseSheets || !spreadsheetId) {
      onShowToast?.(
        'error',
        'ยังไม่ได้เชื่อมต่อ Google Sheets',
        'กรุณาเชื่อมต่อ Google Sheets ในเมนู "ตั้งค่าระบบ & เชื่อมต่อ" ก่อนบันทึกข้อมูล'
      );
      return;
    }
    if (pendingRows.length === 0) return;

    setIsSavingToSheets(true);
    setUploadError(null);
    try {
      const result = await saveOnlineDeliveryPlanBatchToSheet(
        spreadsheetId,
        selectedPlanDate,
        pendingRows,
        routeAssignments,
        driverAssignments,
        { skipMasked: skipMaskedOnSave }
      );

      // Save postal-code -> route & driver mappings so tomorrow auto-routes!
      let savedMappingCount = 0;
      if (rememberRoutesOnSave) {
        const uniqueZips: string[] = Array.from(
          new Set<string>(pendingRows.filter((r) => !r.isMasked).map((r) => r.postalCode))
        );
        const mappingPayload = uniqueZips.map((zip) => ({
          postalCode: zip,
          routeName: routeAssignments[zip] || getDefaultTruckAssignment(zip),
          driverName: driverAssignments[zip] || '',
        }));
        savedMappingCount = await saveOnlinePostalRoutesBatchToSheet(
          spreadsheetId,
          mappingPayload
        );
      }

      // Clear staged upload & reload fresh saved records from Google Sheets
      setPendingRows([]);
      setPendingFileName('');
      await loadFromGoogleSheets(true);

      const parts = [`เพิ่มใหม่ ${result.addedCount} แถว`];
      if (result.skippedDuplicateCount > 0) {
        parts.push(`ข้ามรายการซ้ำ ${result.skippedDuplicateCount} แถว`);
      }
      if (result.skippedMaskedCount > 0) {
        parts.push(`ข้ามรายการปกปิด (****) ${result.skippedMaskedCount} แถว`);
      }
      if (savedMappingCount > 0) {
        parts.push(`อัปเดตสายรหัสไปรษณีย์ ${savedMappingCount} รหัส`);
      }

      onShowToast?.(
        'success',
        `บันทึกลง Google Sheets สำเร็จ (${formatThaiShortDate(selectedPlanDate)})`,
        parts.join(' · ')
      );
    } catch (err: any) {
      const msg = err?.details || err?.message || 'เกิดข้อผิดพลาดขณะบันทึกลง Google Sheets';
      setUploadError(msg);
      onShowToast?.('error', 'บันทึกไม่สำเร็จ', msg);
    } finally {
      setIsSavingToSheets(false);
    }
  };

  // Update route assignment for a postal code (live-syncs to Google Sheets if viewing saved rows)
  const handleChangePostalRoute = async (postalCode: string, newRoute: string) => {
    setRouteAssignments((prev) => ({ ...prev, [postalCode]: newRoute }));

    if (isPreviewingUpload) {
      setPendingRows((prev) =>
        prev.map((r) => (r.postalCode === postalCode ? { ...r, assignedRoute: newRoute } : r))
      );
      return;
    }

    // Live-sync saved rows & postal route mapping to Google Sheets
    if (!canUseSheets || !spreadsheetId) return;

    const affectedRows = savedRowsForSelectedDate
      .filter((r) => r.postalCode === postalCode)
      .map((r) => ({ ...r, assignedRoute: newRoute }));

    // Optimistic update
    setSheetAllRows((prev) =>
      prev.map((r) =>
        r.planDate === selectedPlanDate && r.postalCode === postalCode
          ? { ...r, assignedRoute: newRoute }
          : r
      )
    );

    setIsSyncingInline(true);
    try {
      await Promise.all([
        updateOnlinePlanRowsInSheet(spreadsheetId, affectedRows),
        postalCode !== 'MASKED'
          ? saveOnlinePostalRoutesBatchToSheet(spreadsheetId, [
              {
                postalCode,
                routeName: newRoute,
                driverName: driverAssignments[postalCode] || '',
              },
            ])
          : Promise.resolve(0),
      ]);
      // Refresh postal mappings cache
      if (postalCode !== 'MASKED') {
        const freshMappings = await fetchOnlinePostalRoutesFromSheet(spreadsheetId);
        setPostalMappings(freshMappings);
      }
      onShowToast?.(
        'success',
        'อัปเดตสายจัดส่งแล้ว',
        `รหัส ${postalCode} → ${newRoute} (จำค่าสายนี้ไว้สำหรับวันถัดไปแล้ว)`
      );
    } catch (err: any) {
      onShowToast?.('error', 'ซิงค์สายจัดส่งไม่สำเร็จ', err?.message || 'กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSyncingInline(false);
    }
  };

  // Update driver assignment for a postal code (live-syncs to Google Sheets if viewing saved rows)
  const handleChangePostalDriver = async (postalCode: string, newDriver: string) => {
    setDriverAssignments((prev) => ({ ...prev, [postalCode]: newDriver }));

    if (isPreviewingUpload) {
      setPendingRows((prev) =>
        prev.map((r) => (r.postalCode === postalCode ? { ...r, assignedDriver: newDriver } : r))
      );
      return;
    }

    if (!canUseSheets || !spreadsheetId) return;

    const affectedRows = savedRowsForSelectedDate
      .filter((r) => r.postalCode === postalCode)
      .map((r) => ({ ...r, assignedDriver: newDriver }));

    setSheetAllRows((prev) =>
      prev.map((r) =>
        r.planDate === selectedPlanDate && r.postalCode === postalCode
          ? { ...r, assignedDriver: newDriver }
          : r
      )
    );

    setIsSyncingInline(true);
    try {
      await Promise.all([
        updateOnlinePlanRowsInSheet(spreadsheetId, affectedRows),
        postalCode !== 'MASKED'
          ? saveOnlinePostalRoutesBatchToSheet(spreadsheetId, [
              {
                postalCode,
                routeName: routeAssignments[postalCode] || getDefaultTruckAssignment(postalCode),
                driverName: newDriver,
              },
            ])
          : Promise.resolve(0),
      ]);
      if (postalCode !== 'MASKED') {
        const freshMappings = await fetchOnlinePostalRoutesFromSheet(spreadsheetId);
        setPostalMappings(freshMappings);
      }
      onShowToast?.(
        'success',
        'อัปเดตคนขับประจำรหัสแล้ว',
        `รหัส ${postalCode}: ${newDriver || 'ไม่ระบุคนขับ'}`
      );
    } catch (err: any) {
      onShowToast?.('error', 'ซิงค์ชื่อคนขับไม่สำเร็จ', err?.message || 'กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSyncingInline(false);
    }
  };

  // Update delivery status for an order (all SKU rows sharing orderNumber on selectedPlanDate)
  const handleUpdateOrderDeliveryStatus = async (
    orderNumber: string,
    newStatus: OnlineDeliveryStatus
  ) => {
    if (isPreviewingUpload) {
      setPendingRows((prev) =>
        prev.map((r) => (r.orderNumber === orderNumber ? { ...r, deliveryStatus: newStatus } : r))
      );
      return;
    }

    if (!canUseSheets || !spreadsheetId) return;

    const affectedRows = savedRowsForSelectedDate
      .filter((r) => r.orderNumber === orderNumber)
      .map((r) => ({ ...r, deliveryStatus: newStatus }));

    // Optimistic update
    setSheetAllRows((prev) =>
      prev.map((r) =>
        r.planDate === selectedPlanDate && r.orderNumber === orderNumber
          ? { ...r, deliveryStatus: newStatus }
          : r
      )
    );

    setIsSyncingInline(true);
    try {
      await updateOnlinePlanRowsInSheet(spreadsheetId, affectedRows);
      onShowToast?.(
        'success',
        'อัปเดตสถานะจัดส่งแล้ว',
        `ออเดอร์ ${orderNumber} → ${getOnlineStatusLabelThai(newStatus)}`
      );
    } catch (err: any) {
      onShowToast?.('error', 'อัปเดตสถานะไม่สำเร็จ', err?.message || 'กรุณาลองใหม่อีกครั้ง');
      await loadFromGoogleSheets(true);
    } finally {
      setIsSyncingInline(false);
    }
  };

  // Add or update a rule in the Postal Route Mapping Modal
  const handleAddOrUpdateMappingRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanZip = newMapZip.replace(/\D/g, '').slice(0, 5);
    if (cleanZip.length !== 5) {
      onShowToast?.('error', 'รหัสไปรษณีย์ไม่ถูกต้อง', 'กรุณาระบุรหัสไปรษณีย์ตัวเลข 5 หลัก');
      return;
    }
    if (!newMapRoute.trim()) {
      onShowToast?.('error', 'กรุณาระบุสายรถจัดส่ง', 'โปรดเลือกหรือพิมพ์ชื่อสายรถจัดส่ง');
      return;
    }
    if (!canUseSheets || !spreadsheetId) {
      onShowToast?.('error', 'ยังไม่ได้เชื่อมต่อ Google Sheets', 'กรุณาเชื่อมต่อ Google Sheets ก่อน');
      return;
    }

    setIsSavingMappingModal(true);
    try {
      await saveOnlinePostalRoutesBatchToSheet(spreadsheetId, [
        {
          postalCode: cleanZip,
          routeName: newMapRoute.trim(),
          driverName: newMapDriver.trim(),
          notes: newMapNotes.trim(),
        },
      ]);
      const fresh = await fetchOnlinePostalRoutesFromSheet(spreadsheetId);
      setPostalMappings(fresh);
      setNewMapZip('');
      setNewMapNotes('');
      onShowToast?.(
        'success',
        'บันทึกสายรหัสไปรษณีย์แล้ว',
        `รหัส ${cleanZip} → ${newMapRoute.trim()}`
      );
    } catch (err: any) {
      onShowToast?.('error', 'บันทึกไม่สำเร็จ', err?.message || 'กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSavingMappingModal(false);
    }
  };

  // Apply platform, status, masked, and search filters before grouping
  const baseFilteredRows = useMemo(() => {
    return activeRows.filter((row) => {
      if (hideMasked && row.isMasked) return false;
      if (platformFilter !== 'ALL' && row.platform !== platformFilter) return false;
      if (statusFilter !== 'ALL' && (row.deliveryStatus || 'pending') !== statusFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const hit =
          row.orderNumber.toLowerCase().includes(q) ||
          row.recipientName.toLowerCase().includes(q) ||
          row.phone.toLowerCase().includes(q) ||
          row.address.toLowerCase().includes(q) ||
          row.city.toLowerCase().includes(q) ||
          row.postalCode.toLowerCase().includes(q) ||
          row.sku.toLowerCase().includes(q) ||
          row.productName.toLowerCase().includes(q) ||
          row.buyerNote.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [activeRows, hideMasked, platformFilter, statusFilter, searchTerm]);

  const { groupedOrders, postalGroups } = useMemo(
    () => groupOnlineOrdersByPostalCode(baseFilteredRows),
    [baseFilteredRows]
  );

  // Dataset KPIs for currently displayed rows
  const datasetSummary = useMemo(() => {
    const { groupedOrders: allOrders, postalGroups: allGroups } =
      groupOnlineOrdersByPostalCode(activeRows);
    const validPostalGroups = allGroups.filter((g) => !g.isMasked);
    const maskedGroup = allGroups.find((g) => g.isMasked);
    const totalUnits = activeRows.reduce((sum, r) => sum + r.quantity, 0);
    const platformCounts: Record<string, number> = {};
    let completedCount = 0;
    allOrders.forEach((o) => {
      platformCounts[o.platform] = (platformCounts[o.platform] || 0) + 1;
      if (o.deliveryStatus === 'completed') completedCount++;
    });
    return {
      totalRows: activeRows.length,
      totalOrders: allOrders.length,
      totalUnits,
      completedCount,
      validPostalCount: validPostalGroups.length,
      validOrderCount: allOrders.length - (maskedGroup?.orders.length || 0),
      maskedOrderCount: maskedGroup?.orders.length || 0,
      platformCounts,
    };
  }, [activeRows]);

  // Truck-route grouped summary
  const truckRouteGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        routeName: string;
        postalCodes: string[];
        districts: string[];
        orders: typeof groupedOrders;
        totalQuantity: number;
        skuMap: Map<string, { sku: string; productName: string; quantity: number }>;
        isMaskedOnly: boolean;
      }
    >();

    for (const pg of postalGroups) {
      const assigned =
        routeAssignments[pg.postalCode] || getDefaultTruckAssignment(pg.postalCode);
      const entry = map.get(assigned) || {
        routeName: assigned,
        postalCodes: [],
        districts: [],
        orders: [],
        totalQuantity: 0,
        skuMap: new Map(),
        isMaskedOnly: pg.isMasked,
      };

      if (!pg.isMasked) entry.isMaskedOnly = false;
      if (!entry.postalCodes.includes(pg.postalCode)) entry.postalCodes.push(pg.postalCode);
      pg.districts.forEach((d) => {
        if (!entry.districts.includes(d)) entry.districts.push(d);
      });
      entry.orders.push(...pg.orders);
      entry.totalQuantity += pg.totalQuantity;
      pg.skuSummary.forEach((s) => {
        const key = s.sku || s.productName;
        const prev = entry.skuMap.get(key);
        if (prev) prev.quantity += s.quantity;
        else entry.skuMap.set(key, { ...s });
      });

      map.set(assigned, entry);
    }

    return Array.from(map.values())
      .map((e) => ({
        ...e,
        skuSummary: Array.from(e.skuMap.values()).sort((a, b) => b.quantity - a.quantity),
      }))
      .sort((a, b) => {
        if (a.isMaskedOnly !== b.isMaskedOnly) return a.isMaskedOnly ? 1 : -1;
        return b.orders.length - a.orders.length;
      });
  }, [postalGroups, routeAssignments]);

  const platformsList = useMemo(() => {
    const set = new Set<string>();
    activeRows.forEach((r) => set.add(r.platform));
    return Array.from(set).sort();
  }, [activeRows]);

  const visiblePostalGroups = useMemo(() => {
    if (selectedPostalCode === 'ALL') return postalGroups;
    return postalGroups.filter((g) => g.postalCode === selectedPostalCode);
  }, [postalGroups, selectedPostalCode]);

  const visibleTruckGroups = useMemo(() => {
    if (selectedTruckRoute === 'ALL') return truckRouteGroups;
    return truckRouteGroups.filter((g) => g.routeName === selectedTruckRoute);
  }, [truckRouteGroups, selectedTruckRoute]);

  const visibleRawRows = useMemo(() => {
    if (selectedPostalCode === 'ALL') return baseFilteredRows;
    return baseFilteredRows.filter((r) => r.postalCode === selectedPostalCode);
  }, [baseFilteredRows, selectedPostalCode]);

  const filteredMappingsModal = useMemo(() => {
    const q = mappingSearch.trim().toLowerCase();
    return postalMappings
      .filter(
        (m) =>
          !q ||
          m.postalCode.includes(q) ||
          m.routeName.toLowerCase().includes(q) ||
          m.driverName.toLowerCase().includes(q) ||
          m.notes.toLowerCase().includes(q)
      )
      .sort((a, b) => a.postalCode.localeCompare(b.postalCode));
  }, [postalMappings, mappingSearch]);

  const handleExportCsv = () => {
    if (activeRows.length === 0) return;
    const csvContent = buildExportOnlinePlanCsv(
      activeRows,
      routeAssignments,
      driverAssignments
    );
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `online-delivery-plan-${selectedPlanDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* 1. Production Control Bar: Date Picker + Google Sheets Sync + Upload CSV */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const dropped = e.dataTransfer.files?.[0];
          if (dropped) handleFileChange(dropped);
        }}
        className={`bg-white rounded-2xl border transition-colors p-4 sm:p-5 space-y-4 ${
          isDragging ? 'border-blue-500 bg-blue-50/40' : 'border-slate-200'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="hidden"
          onChange={(e) => {
            handleFileChange(e.target.files?.[0]);
            e.target.value = '';
          }}
        />

        {/* Top Row: Title + Date Selector + Primary Actions */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  แผนงานจัดส่งออนไลน์ (Google Sheets)
                </h2>
                {canUseSheets ? (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                    <Database className="w-3 h-3" />
                    <span>เชื่อมชีต OnlineDeliveryPlan</span>
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                    ยังไม่เชื่อมต่อ Google Sheets
                  </span>
                )}
                {isSyncingInline && (
                  <span className="text-[11px] font-medium text-blue-600 inline-flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>กำลังซิงค์...</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                อัปโหลดไฟล์ Excel (.xlsx, .xls) หรือ CSV ประจำวัน แยกสายส่งอัตโนมัติตามรหัสไปรษณีย์ และบันทึกลง Google Sheets
                {lastSyncedAt && (
                  <span className="ml-2 text-slate-400">· ซิงค์ล่าสุด {lastSyncedAt} น.</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Delivery Plan Date Picker */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
              <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">
                รอบวันส่ง:
              </span>
              <input
                type="date"
                value={selectedPlanDate}
                onChange={(e) => {
                  const nextDate = e.target.value || getTodayIsoLocal();
                  setSelectedPlanDate(nextDate);
                  setPendingRows((prev) => prev.map((r) => ({ ...r, planDate: nextDate })));
                  setSelectedPostalCode('ALL');
                  setSelectedTruckRoute('ALL');
                }}
                className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoadingFile || isSavingToSheets}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>อัปโหลด Excel / CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMappingModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <BookmarkCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>ตารางสายรหัสไปรษณีย์ ({postalMappings.length})</span>
            </button>

            {canUseSheets && (
              <button
                type="button"
                onClick={() => loadFromGoogleSheets(false)}
                disabled={isLoadingSheets}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                title="ดึงข้อมูลล่าสุดจาก Google Sheets"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSheets ? 'animate-spin text-blue-600' : ''}`} />
                <span className="hidden sm:inline">รีเฟรช</span>
              </button>
            )}

            {activeRows.length > 0 && (
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">ส่งออก CSV</span>
              </button>
            )}
          </div>
        </div>

        {/* Saved Dates Quick Switcher Strip (dates already stored in Google Sheets) */}
        {savedDatesSummary.length > 0 && (
          <div className="pt-3 border-t border-slate-100 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap shrink-0">
              รอบวันที่บันทึกแล้วใน Sheets:
            </span>
            {savedDatesSummary.slice(0, 10).map((d) => {
              const isSelected = d.date === selectedPlanDate;
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => {
                    setSelectedPlanDate(d.date);
                    setSelectedPostalCode('ALL');
                    setSelectedTruckRoute('ALL');
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
                  }`}
                >
                  <span>{formatThaiShortDate(d.date)}</span>
                  <span
                    className={`font-mono tabular-nums text-[10px] px-1 rounded ${
                      isSelected ? 'bg-blue-500 text-white' : 'bg-white text-slate-600'
                    }`}
                  >
                    {d.orderCount}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Pending Upload Review & Save to Google Sheets Bar */}
        {isPreviewingUpload && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 sm:p-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-900">
                    <CloudUpload className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>เตรียมบันทึกลง Google Sheets รอบวันที่ {formatThaiShortDate(selectedPlanDate)}</span>
                  </span>
                  <span className="text-[11px] font-mono text-slate-600 truncate max-w-xs">
                    ({pendingFileName} · {detectedEncoding})
                  </span>
                </div>
                <div className="text-xs text-slate-700 flex items-center gap-x-3 gap-y-1 flex-wrap">
                  <span>
                    พร้อมเพิ่มใหม่:{' '}
                    <strong className="font-mono text-blue-800">{pendingUploadStats.willSaveCount}</strong> แถว
                  </span>
                  {pendingUploadStats.duplicateCount > 0 && (
                    <span className="text-slate-600">
                      · ข้ามรายการซ้ำอัตโนมัติ:{' '}
                      <strong className="font-mono">{pendingUploadStats.duplicateCount}</strong> แถว
                    </span>
                  )}
                  {pendingUploadStats.newMasked > 0 && (
                    <span className="text-amber-700">
                      · รายการปกปิด (****):{' '}
                      <strong className="font-mono">{pendingUploadStats.newMasked}</strong> แถว
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <button
                  type="button"
                  onClick={handleSavePendingToSheets}
                  disabled={isSavingToSheets || !canUseSheets || pendingUploadStats.willSaveCount === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSavingToSheets ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>กำลังบันทึกลง Sheets...</span>
                    </>
                  ) : (
                    <>
                      <CloudUpload className="w-4 h-4" />
                      <span>บันทึกลง Google Sheets ({pendingUploadStats.willSaveCount} แถว)</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPendingRows([]);
                    setPendingFileName('');
                    setSelectedPostalCode('ALL');
                    setSelectedTruckRoute('ALL');
                  }}
                  disabled={isSavingToSheets}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>ยกเลิกไฟล์นี้</span>
                </button>
              </div>
            </div>

            {/* Save Checkboxes */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 border-t border-blue-200/70 text-xs text-slate-700">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={skipMaskedOnSave}
                  onChange={(e) => setSkipMaskedOnSave(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>ข้ามรายการที่ปกปิดข้อมูลผู้รับ/รหัสไปรษณีย์ (****)</span>
              </label>

              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberRoutesOnSave}
                  onChange={(e) => setRememberRoutesOnSave(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>จำการจับคู่รหัสไปรษณีย์ → สายรถ ลงชีต OnlinePostalRoutes เพื่อใช้อัตโนมัติวันถัดไป</span>
              </label>
            </div>
          </div>
        )}

        {uploadError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}
      </div>

      {/* Empty State or Loading State */}
      {isLoadingSheets && activeRows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <Loader2 className="w-7 h-7 animate-spin text-blue-600 mx-auto" />
          <div className="text-sm font-semibold text-slate-700">
            กำลังดึงข้อมูลแผนงานจัดส่งออนไลน์จาก Google Sheets...
          </div>
        </div>
      ) : activeRows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
            <Upload className="w-6 h-6" />
          </div>
          <div className="text-sm font-bold text-slate-900">
            ยังไม่มีข้อมูลแผนจัดส่งออนไลน์สำหรับวันที่ {formatThaiShortDate(selectedPlanDate)}
          </div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            ลากไฟล์ Excel (.xlsx, .xls) หรือ CSV มาวางบนหน้านี้ หรือกดปุ่มด้านล่างเพื่อนำเข้าออเดอร์ประจำวัน
            ระบบจะแยกสายตามรหัสไปรษณีย์และพร้อมบันทึกลง Google Sheets ทันที
          </p>
          <div className="pt-2 flex items-center justify-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>เลือกไฟล์ Excel / CSV เพื่ออัปโหลด</span>
            </button>
            <button
              type="button"
              onClick={handleLoadSampleCsv}
              disabled={isLoadingFile}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>ทดสอบด้วยไฟล์ตัวอย่าง</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 2. KPI Summary Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 bg-white rounded-2xl border border-slate-200 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 overflow-hidden">
            <div className="p-4">
              <div className="text-xs font-medium text-slate-500">
                {isPreviewingUpload ? 'คำสั่งซื้อในไฟล์ที่อัปโหลด' : 'คำสั่งซื้อที่บันทึกแล้ว'}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                  {datasetSummary.totalOrders}
                </span>
                <span className="text-xs text-slate-500">ออเดอร์</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500 font-mono tabular-nums">
                {datasetSummary.totalRows} แถวรายการ · {datasetSummary.totalUnits} ชิ้น
                {!isPreviewingUpload && datasetSummary.completedCount > 0 && (
                  <span className="text-emerald-700 font-semibold">
                    {' '}
                    · ส่งแล้ว {datasetSummary.completedCount}
                  </span>
                )}
              </div>
            </div>

            <div className="p-4">
              <div className="text-xs font-medium text-slate-500">สายส่งตามรหัสไปรษณีย์</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-blue-700 font-mono tabular-nums">
                  {datasetSummary.validPostalCount}
                </span>
                <span className="text-xs text-slate-500">รหัสไปรษณีย์</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500 font-mono tabular-nums">
                ครอบคลุม {datasetSummary.validOrderCount} ออเดอร์ที่มีที่อยู่ครบ
              </div>
            </div>

            <div className="p-4">
              <div className="text-xs font-medium text-slate-500">รอข้อมูลรหัสไปรษณีย์ (****)</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-amber-600 font-mono tabular-nums">
                  {datasetSummary.maskedOrderCount}
                </span>
                <span className="text-xs text-slate-500">ออเดอร์</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {datasetSummary.maskedOrderCount > 0
                  ? 'แพลตฟอร์มปกปิดข้อมูลผู้รับ'
                  : 'ข้อมูลรหัสไปรษณีย์ครบทุกรายการ'}
              </div>
            </div>

            <div className="p-4">
              <div className="text-xs font-medium text-slate-500">แยกตามแพลตฟอร์ม</div>
              <div className="mt-1.5 flex items-center flex-wrap gap-x-2.5 gap-y-1 text-xs">
                {(Object.entries(datasetSummary.platformCounts) as [string, number][])
                  .sort((a, b) => b[1] - a[1])
                  .map(([pf, count], idx) => (
                    <span key={pf} className="inline-flex items-baseline gap-1">
                      {idx > 0 && <span className="text-slate-300 mr-1.5">·</span>}
                      <span className="font-semibold text-slate-700">{pf}</span>
                      <span className="font-mono tabular-nums font-bold text-slate-900">
                        {count}
                      </span>
                    </span>
                  ))}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                จัดรวมเป็น {truckRouteGroups.filter((t) => !t.isMaskedOnly).length} สายรถจัดส่ง
              </div>
            </div>
          </div>

          {/* 3. Workspace Toolbar: View Switcher + Search + Filters */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Segmented View Switcher */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setViewMode('by_postal')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    viewMode === 'by_postal'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>แยกสายตามรหัสไปรษณีย์ ({postalGroups.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('by_truck')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    viewMode === 'by_truck'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>รวมตามสายรถจัดส่ง ({truckRouteGroups.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('all_rows')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    viewMode === 'all_rows'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>ตารางข้อมูลทั้งหมด ({baseFilteredRows.length})</span>
                </button>
              </div>

              {/* Search + Platform + Status + Masked Toggle */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1 sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="ค้นหาเลขคำสั่งซื้อ, รหัส ปณ., SKU..."
                    className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <select
                  value={platformFilter}
                  onChange={(e) => setPlatformFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="ALL">ทุกแพลตฟอร์ม</option>
                  {platformsList.map((pf) => (
                    <option key={pf} value={pf}>
                      {pf}
                    </option>
                  ))}
                </select>

                {!isPreviewingUpload && (
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="ALL">ทุกสถานะ</option>
                    <option value="pending">รอจัดส่ง</option>
                    <option value="delivering">กำลังจัดส่ง</option>
                    <option value="completed">จัดส่งสำเร็จ</option>
                    <option value="cancelled">ยกเลิก</option>
                  </select>
                )}

                {datasetSummary.maskedOrderCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setHideMasked((prev) => !prev)}
                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                      hideMasked
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {hideMasked ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{hideMasked ? 'แสดง (****)' : 'ซ่อน (****)'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 4A. VIEW MODE 1: BY POSTAL CODE */}
          {viewMode === 'by_postal' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Left Directory: Postal Codes */}
              <div className="lg:col-span-4 xl:col-span-3 bg-white rounded-2xl border border-slate-200 overflow-hidden lg:sticky lg:top-20">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">รายการรหัสไปรษณีย์</span>
                  <span className="text-[11px] font-mono tabular-nums text-slate-500">
                    {postalGroups.length} กลุ่ม
                  </span>
                </div>

                <div className="max-h-[540px] overflow-y-auto divide-y divide-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedPostalCode('ALL')}
                    className={`w-full px-4 py-2.5 text-left flex items-center justify-between transition-colors cursor-pointer ${
                      selectedPostalCode === 'ALL'
                        ? 'bg-blue-50/90 text-blue-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="text-xs">แสดงทุกรหัสไปรษณีย์</span>
                    <span className="text-xs font-mono tabular-nums font-bold">
                      {groupedOrders.length}
                    </span>
                  </button>

                  {postalGroups.map((group) => {
                    const isSelected = selectedPostalCode === group.postalCode;
                    const assignedRoute =
                      routeAssignments[group.postalCode] ||
                      getDefaultTruckAssignment(group.postalCode);
                    const hasSavedRule = postalMappingMap.has(group.postalCode);

                    return (
                      <button
                        key={group.postalCode}
                        type="button"
                        onClick={() => setSelectedPostalCode(group.postalCode)}
                        className={`w-full px-4 py-2.5 text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/90 border-l-3 border-l-blue-600'
                            : 'hover:bg-slate-50 border-l-3 border-l-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`text-sm font-bold font-mono tabular-nums ${
                                group.isMasked
                                  ? 'text-amber-600'
                                  : isSelected
                                  ? 'text-blue-700'
                                  : 'text-slate-900'
                              }`}
                            >
                              {group.isMasked ? '****' : group.postalCode}
                            </span>
                            {hasSavedRule && !group.isMasked && (
                              <span
                                className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"
                                title="จำสายรถใน Google Sheets แล้ว"
                              />
                            )}
                            {group.districts.length > 0 && (
                              <span className="text-[11px] text-slate-500 truncate">
                                {group.districts.slice(0, 2).join(', ')}
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-bold font-mono tabular-nums text-slate-800 shrink-0">
                            {group.orders.length}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                          <span className="truncate">{assignedRoute}</span>
                          <span className="font-mono tabular-nums shrink-0">
                            {group.totalQuantity} ชิ้น
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Content: Postal Code Route Cards */}
              <div className="lg:col-span-8 xl:col-span-9 space-y-4">
                {visiblePostalGroups.map((group) => {
                  const assignedRoute =
                    routeAssignments[group.postalCode] ||
                    getDefaultTruckAssignment(group.postalCode);
                  const assignedDriver = driverAssignments[group.postalCode] || '';
                  const completedInGroup = group.orders.filter(
                    (o) => o.deliveryStatus === 'completed'
                  ).length;

                  return (
                    <div
                      key={group.postalCode}
                      className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
                    >
                      {/* Group Header */}
                      <div className="px-4 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`px-2.5 py-1.5 rounded-xl font-mono font-extrabold text-sm tabular-nums shrink-0 ${
                              group.isMasked
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-600 text-white'
                            }`}
                          >
                            {group.isMasked ? '****' : group.postalCode}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm font-bold text-slate-900">
                                {group.isMasked
                                  ? 'รายการที่แพลตฟอร์มปกปิดรหัสไปรษณีย์'
                                  : group.districts.length > 0
                                  ? group.districts.join(' · ')
                                  : group.suggestedZone}
                              </h3>
                              <span className="text-xs font-mono tabular-nums font-semibold text-blue-700">
                                {group.orders.length} ออเดอร์ · {group.totalQuantity} ชิ้น
                              </span>
                              {!isPreviewingUpload && completedInGroup > 0 && (
                                <span className="text-[11px] font-semibold text-emerald-700">
                                  · ส่งแล้ว {completedInGroup}/{group.orders.length}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                              <span>{group.suggestedZone}</span>
                              <span>·</span>
                              <span>
                                {(Object.entries(group.platforms) as [string, number][])
                                  .map(([pf, c]) => `${pf} ${c}`)
                                  .join(', ')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Route & Driver Selectors + Print Button */}
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={assignedRoute}
                            onChange={(e) =>
                              handleChangePostalRoute(group.postalCode, e.target.value)
                            }
                            aria-label="เลือกสายรถจัดส่ง"
                            className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500 max-w-[230px] cursor-pointer"
                          >
                            {!availableRouteOptions.includes(assignedRoute) && (
                              <option value={assignedRoute}>{assignedRoute}</option>
                            )}
                            {availableRouteOptions.map((rt) => (
                              <option key={rt} value={rt}>
                                {rt}
                              </option>
                            ))}
                            <option value={`สายรหัส ${group.postalCode}`}>
                              แยกเดี่ยว: สายรหัส {group.postalCode}
                            </option>
                          </select>

                          <select
                            value={assignedDriver}
                            onChange={(e) =>
                              handleChangePostalDriver(group.postalCode, e.target.value)
                            }
                            aria-label="เลือกพนักงานขับรถ"
                            className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
                          >
                            <option value="">ระบุคนขับ...</option>
                            {activeDrivers.map((d) => (
                              <option key={d.id} value={d.name}>
                                {d.name}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => setPrintGroup(group)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>ใบจัดส่งสายนี้</span>
                          </button>
                        </div>
                      </div>

                      {/* SKU Picking Summary */}
                      <div className="px-4 py-2.5 bg-white border-b border-slate-100 flex items-start gap-2 text-xs">
                        <Package className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-600">
                          <span className="font-semibold text-slate-700">สรุปสินค้าขึ้นรถ:</span>
                          {group.skuSummary.map((item) => (
                            <span
                              key={`${item.sku}-${item.productName}`}
                              className="inline-flex items-center gap-1"
                            >
                              <span className="font-mono text-[11px] text-slate-500">
                                {item.sku}
                              </span>
                              <span className="font-bold text-slate-900 font-mono tabular-nums">
                                ×{item.quantity}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Orders Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-slate-50/40">
                              <th className="py-2 pl-4 pr-2 w-10">#</th>
                              <th className="py-2 px-2">คำสั่งซื้อ / แพลตฟอร์ม</th>
                              <th className="py-2 px-2">ผู้รับ & เบอร์โทร</th>
                              <th className="py-2 px-2">ที่อยู่จัดส่ง</th>
                              <th className="py-2 px-2">รายการสินค้า (SKU)</th>
                              <th className="py-2 px-2 text-right">จำนวน</th>
                              <th className="py-2 pl-2 pr-4 text-right">สถานะ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {group.orders.map((ord, idx) => {
                              const telHref = toTelHref(ord.phone);
                              const mapsQuery =
                                !ord.isMasked && ord.address
                                  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                      `${ord.address} ${ord.postalCode}`
                                    )}`
                                  : '';
                              return (
                                <tr
                                  key={ord.orderNumber}
                                  className="hover:bg-slate-50/70 align-top"
                                >
                                  <td className="py-2.5 pl-4 pr-2 font-mono tabular-nums text-slate-400">
                                    {idx + 1}
                                  </td>
                                  <td className="py-2.5 px-2 whitespace-nowrap">
                                    <div className="font-mono font-bold text-slate-900 text-[11px]">
                                      {ord.orderNumber}
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                      {ord.platform} · {ord.orderTime || '-'}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-2 min-w-[140px]">
                                    <div className="font-semibold text-slate-800">
                                      {ord.recipientName || '-'}
                                    </div>
                                    {ord.phone && !/^\*+$/.test(ord.phone) ? (
                                      <a
                                        href={telHref}
                                        className="inline-flex items-center gap-1 text-[11px] font-mono text-blue-700 hover:underline mt-0.5"
                                      >
                                        <Phone className="w-3 h-3" />
                                        <span>{ord.phone}</span>
                                      </a>
                                    ) : (
                                      <span className="text-[11px] font-mono text-slate-400">
                                        {ord.phone || '-'}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-2 max-w-xs">
                                    <div className="text-slate-700 leading-snug line-clamp-2">
                                      {ord.address || '-'}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      {ord.city && !/^\*+$/.test(ord.city) && (
                                        <span className="text-[11px] text-slate-500">
                                          {ord.city.split('/')[0].trim()}
                                        </span>
                                      )}
                                      {mapsQuery && (
                                        <a
                                          href={mapsQuery}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-blue-600 hover:underline"
                                        >
                                          <span>แผนที่</span>
                                          <ExternalLink className="w-2.5 h-2.5" />
                                        </a>
                                      )}
                                    </div>
                                    {(ord.buyerNote || ord.sellerNote) && (
                                      <div className="mt-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md inline-block">
                                        หมายเหตุ: {[ord.buyerNote, ord.sellerNote].filter(Boolean).join(' / ')}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-2 min-w-[200px]">
                                    <div className="space-y-1">
                                      {ord.items.map((it, i) => (
                                        <div key={i} className="leading-snug">
                                          <span className="font-mono text-[11px] font-semibold text-slate-600 mr-1.5">
                                            [{it.sku || '-'}]
                                          </span>
                                          <span className="text-slate-800">{it.productName}</span>
                                          {ord.items.length > 1 && (
                                            <span className="ml-1 font-mono font-bold text-blue-700">
                                              ×{it.quantity}
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-2 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                                    {ord.totalQuantity}
                                  </td>
                                  <td className="py-2.5 pl-2 pr-4 text-right whitespace-nowrap">
                                    <select
                                      value={ord.deliveryStatus}
                                      onChange={(e) =>
                                        handleUpdateOrderDeliveryStatus(
                                          ord.orderNumber,
                                          e.target.value as OnlineDeliveryStatus
                                        )
                                      }
                                      aria-label={`สถานะจัดส่ง ${ord.orderNumber}`}
                                      className={`px-2 py-1 rounded-lg text-[11px] font-bold border cursor-pointer focus:outline-none ${getStatusBadgeClasses(
                                        ord.deliveryStatus
                                      )}`}
                                    >
                                      <option value="pending">รอจัดส่ง</option>
                                      <option value="delivering">กำลังจัดส่ง</option>
                                      <option value="completed">จัดส่งสำเร็จ</option>
                                      <option value="cancelled">ยกเลิก</option>
                                    </select>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4B. VIEW MODE 2: GROUPED BY TRUCK ROUTE */}
          {viewMode === 'by_truck' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedTruckRoute('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedTruckRoute === 'ALL'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  ทุกสายรถ ({truckRouteGroups.length})
                </button>
                {truckRouteGroups.map((tg) => (
                  <button
                    key={tg.routeName}
                    type="button"
                    onClick={() => setSelectedTruckRoute(tg.routeName)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      selectedTruckRoute === tg.routeName
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {tg.routeName} ({tg.orders.length})
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4">
                {visibleTruckGroups.map((tg) => {
                  const completedCount = tg.orders.filter(
                    (o) => o.deliveryStatus === 'completed'
                  ).length;
                  return (
                    <div
                      key={tg.routeName}
                      className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
                    >
                      <div className="px-4 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              tg.isMaskedOnly
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-600 text-white'
                            }`}
                          >
                            <Truck className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">{tg.routeName}</h3>
                            <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span>
                                รหัสไปรษณีย์:{' '}
                                <strong className="font-mono text-slate-700">
                                  {tg.postalCodes.map((z) => (z === 'MASKED' ? '****' : z)).join(', ')}
                                </strong>
                              </span>
                              {tg.districts.length > 0 && (
                                <span>· {tg.districts.slice(0, 5).join(', ')}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-right shrink-0">
                          <div>
                            <div className="text-lg font-bold font-mono tabular-nums text-blue-700 leading-none">
                              {tg.orders.length} ออเดอร์
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-1">
                              รวม {tg.totalQuantity} ชิ้น
                              {!isPreviewingUpload && completedCount > 0 && (
                                <span className="text-emerald-700 font-semibold">
                                  {' '}
                                  · ส่งแล้ว {completedCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Truck SKU Pick List */}
                      <div className="px-4 py-2.5 border-b border-slate-100 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="font-semibold text-slate-700">ยอดเบิกสินค้าขึ้นคันนี้:</span>
                        {tg.skuSummary.map((s) => (
                          <span key={`${s.sku}-${s.productName}`} className="text-slate-600">
                            <span className="font-mono text-[11px]">{s.sku}</span>{' '}
                            <strong className="font-mono text-slate-900">×{s.quantity}</strong>
                          </span>
                        ))}
                      </div>

                      {/* Truck Orders Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-slate-50/40">
                              <th className="py-2 pl-4 pr-2 w-10">#</th>
                              <th className="py-2 px-2">รหัส ปณ.</th>
                              <th className="py-2 px-2">หมายเลขคำสั่งซื้อ</th>
                              <th className="py-2 px-2">ผู้รับ / เบอร์โทร</th>
                              <th className="py-2 px-2">ที่อยู่จัดส่ง</th>
                              <th className="py-2 px-2">สินค้า (SKU)</th>
                              <th className="py-2 px-2 text-right">จำนวน</th>
                              <th className="py-2 pl-2 pr-4 text-right">สถานะ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {tg.orders.map((ord, idx) => (
                              <tr key={ord.orderNumber} className="hover:bg-slate-50/70 align-top">
                                <td className="py-2 pl-4 pr-2 font-mono tabular-nums text-slate-400">
                                  {idx + 1}
                                </td>
                                <td className="py-2 px-2 font-mono font-bold text-blue-700 whitespace-nowrap">
                                  {ord.isMasked ? '****' : ord.postalCode}
                                </td>
                                <td className="py-2 px-2 whitespace-nowrap">
                                  <div className="font-mono font-semibold text-slate-900 text-[11px]">
                                    {ord.orderNumber}
                                  </div>
                                  <div className="text-[11px] text-slate-500">{ord.platform}</div>
                                </td>
                                <td className="py-2 px-2 whitespace-nowrap">
                                  <div className="font-semibold text-slate-800">
                                    {ord.recipientName || '-'}
                                  </div>
                                  {ord.phone && !/^\*+$/.test(ord.phone) ? (
                                    <a
                                      href={toTelHref(ord.phone)}
                                      className="text-[11px] font-mono text-blue-700 hover:underline"
                                    >
                                      {ord.phone}
                                    </a>
                                  ) : (
                                    <span className="text-[11px] font-mono text-slate-400">
                                      {ord.phone || '-'}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-2 max-w-xs text-slate-700 leading-snug">
                                  {ord.address || '-'}
                                </td>
                                <td className="py-2 px-2 min-w-[180px]">
                                  {ord.items.map((it, i) => (
                                    <div key={i} className="leading-snug">
                                      <span className="font-mono text-[11px] text-slate-500 mr-1">
                                        {it.sku}
                                      </span>
                                      <span className="text-slate-800">{it.productName}</span>
                                    </div>
                                  ))}
                                </td>
                                <td className="py-2 px-2 text-right font-mono tabular-nums font-bold text-slate-900">
                                  {ord.totalQuantity}
                                </td>
                                <td className="py-2 pl-2 pr-4 text-right whitespace-nowrap">
                                  <select
                                    value={ord.deliveryStatus}
                                    onChange={(e) =>
                                      handleUpdateOrderDeliveryStatus(
                                        ord.orderNumber,
                                        e.target.value as OnlineDeliveryStatus
                                      )
                                    }
                                    className={`px-2 py-1 rounded-lg text-[11px] font-bold border cursor-pointer focus:outline-none ${getStatusBadgeClasses(
                                      ord.deliveryStatus
                                    )}`}
                                  >
                                    <option value="pending">รอจัดส่ง</option>
                                    <option value="delivering">กำลังจัดส่ง</option>
                                    <option value="completed">จัดส่งสำเร็จ</option>
                                    <option value="cancelled">ยกเลิก</option>
                                  </select>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4C. VIEW MODE 3: ALL RAW ROWS TABLE */}
          {viewMode === 'all_rows' && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-xs font-bold text-slate-800">
                  ข้อมูลทั้งหมด ({visibleRawRows.length} แถว)
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedPostalCode}
                    onChange={(e) => setSelectedPostalCode(e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 cursor-pointer"
                  >
                    <option value="ALL">ทุกรหัสไปรษณีย์</option>
                    {postalGroups.map((g) => (
                      <option key={g.postalCode} value={g.postalCode}>
                        {g.isMasked ? '**** (ปกปิด)' : `${g.postalCode} (${g.rawRowCount} แถว)`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                    <tr>
                      <th className="py-2.5 pl-4 pr-2">#</th>
                      <th className="py-2.5 px-2 whitespace-nowrap">รหัสไปรษณีย์</th>
                      <th className="py-2.5 px-2 whitespace-nowrap">สายจัดส่ง</th>
                      <th className="py-2.5 px-2 whitespace-nowrap">คนขับ</th>
                      <th className="py-2.5 px-2 whitespace-nowrap">สถานะ</th>
                      <th className="py-2.5 px-2 whitespace-nowrap">หมายเลขคำสั่งซื้อ</th>
                      <th className="py-2.5 px-2 whitespace-nowrap">แพลตฟอร์ม</th>
                      <th className="py-2.5 px-2 whitespace-nowrap">ชื่อผู้รับ</th>
                      <th className="py-2.5 px-2 whitespace-nowrap">เบอร์โทรศัพท์</th>
                      <th className="py-2.5 px-2 min-w-[220px]">ที่อยู่รับสินค้า</th>
                      <th className="py-2.5 px-2 whitespace-nowrap">เมือง/เขต</th>
                      <th className="py-2.5 px-2 min-w-[200px]">ชื่อสินค้า</th>
                      <th className="py-2.5 px-2 whitespace-nowrap">SKU</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap">จำนวน</th>
                      <th className="py-2.5 px-2 whitespace-nowrap">เวลาสั่งซื้อ</th>
                      <th className="py-2.5 px-2 whitespace-nowrap">หมายเหตุผู้ซื้อ</th>
                      <th className="py-2.5 pl-2 pr-4 whitespace-nowrap">หมายเหตุผู้ขาย</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {visibleRawRows.map((row, idx) => {
                      const assigned =
                        routeAssignments[row.postalCode] ||
                        row.assignedRoute ||
                        getDefaultTruckAssignment(row.postalCode);
                      const driver = driverAssignments[row.postalCode] || row.assignedDriver || '-';
                      return (
                        <tr
                          key={`${row.orderNumber}-${row.sku}-${row.rowIndex}-${idx}`}
                          className="hover:bg-slate-50/80 align-top"
                        >
                          <td className="py-2 pl-4 pr-2 font-mono tabular-nums text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-2 font-mono font-bold whitespace-nowrap">
                            <span className={row.isMasked ? 'text-amber-600' : 'text-blue-700'}>
                              {row.isMasked ? '****' : row.postalCode}
                            </span>
                          </td>
                          <td className="py-2 px-2 whitespace-nowrap text-slate-700 font-medium">
                            {assigned}
                          </td>
                          <td className="py-2 px-2 whitespace-nowrap text-slate-600">{driver}</td>
                          <td className="py-2 px-2 whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusBadgeClasses(
                                row.deliveryStatus || 'pending'
                              )}`}
                            >
                              {getOnlineStatusLabelThai(row.deliveryStatus)}
                            </span>
                          </td>
                          <td className="py-2 px-2 font-mono text-[11px] font-semibold text-slate-900 whitespace-nowrap">
                            {row.orderNumber}
                          </td>
                          <td className="py-2 px-2 whitespace-nowrap text-slate-700">
                            {row.platform}
                          </td>
                          <td className="py-2 px-2 whitespace-nowrap text-slate-800 font-medium">
                            {row.recipientName || '-'}
                          </td>
                          <td className="py-2 px-2 font-mono text-[11px] whitespace-nowrap">
                            {row.phone && !/^\*+$/.test(row.phone) ? (
                              <a
                                href={toTelHref(row.phone)}
                                className="text-blue-700 hover:underline"
                              >
                                {row.phone}
                              </a>
                            ) : (
                              <span className="text-slate-400">{row.phone || '-'}</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-slate-700 leading-snug">
                            {row.address || '-'}
                          </td>
                          <td className="py-2 px-2 whitespace-nowrap text-slate-600">
                            {row.city || '-'}
                          </td>
                          <td className="py-2 px-2 text-slate-800 leading-snug">
                            {row.productName || '-'}
                          </td>
                          <td className="py-2 px-2 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                            {row.sku || '-'}
                          </td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums font-bold text-slate-900">
                            {row.quantity}
                          </td>
                          <td className="py-2 px-2 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {row.orderTime || '-'}
                          </td>
                          <td className="py-2 px-2 text-slate-600 max-w-[180px]">
                            {row.buyerNote || '-'}
                          </td>
                          <td className="py-2 pl-2 pr-4 text-slate-600 max-w-[180px]">
                            {row.sellerNote || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* 5. Postal Code -> Truck Route Mapping Manager Modal (OnlinePostalRoutes) */}
      {isMappingModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BookmarkCheck className="w-4.5 h-4.5 text-blue-600" />
                  <span>ตารางจับคู่ รหัสไปรษณีย์ → สายรถจัดส่ง</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  จัดเก็บถาวรในแท็บ <span className="font-mono font-semibold">OnlinePostalRoutes</span>{' '}
                  เมื่ออัปโหลด CSV วันถัดไป ระบบจะแยกสายและระบุคนขับให้อัตโนมัติ
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMappingModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Add / Update Form */}
            <form
              onSubmit={handleAddOrUpdateMappingRule}
              className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
            >
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  รหัสไปรษณีย์
                </label>
                <input
                  type="text"
                  maxLength={5}
                  value={newMapZip}
                  onChange={(e) => setNewMapZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  placeholder="เช่น 10240"
                  className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  สายรถจัดส่ง
                </label>
                <select
                  value={newMapRoute}
                  onChange={(e) => setNewMapRoute(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  {availableRouteOptions.map((rt) => (
                    <option key={rt} value={rt}>
                      {rt}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  คนขับประจำสาย
                </label>
                <select
                  value={newMapDriver}
                  onChange={(e) => setNewMapDriver(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="">ไม่ระบุ</option>
                  {activeDrivers.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-3">
                <button
                  type="submit"
                  disabled={isSavingMappingModal || !canUseSheets}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {isSavingMappingModal ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>เพิ่ม / อัปเดตสาย</span>
                </button>
              </div>
            </form>

            {/* Saved Rules Search & List */}
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={mappingSearch}
                  onChange={(e) => setMappingSearch(e.target.value)}
                  placeholder="ค้นหารหัสไปรษณีย์หรือชื่อสาย..."
                  className="w-full pl-8 pr-3 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                ทั้งหมด {filteredMappingsModal.length} รหัส
              </span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredMappingsModal.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-500">
                  ยังไม่มีรายการจับคู่รหัสไปรษณีย์ในชีต OnlinePostalRoutes —
                  สามารถเพิ่มด้านบน หรืออัปโหลดไฟล์ CSV แล้วกดบันทึกลง Google Sheets
                  เพื่อให้ระบบสร้างรายการอัตโนมัติ
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                    <tr>
                      <th className="py-2 pl-4 pr-2">รหัสไปรษณีย์</th>
                      <th className="py-2 px-2">สายรถจัดส่ง</th>
                      <th className="py-2 px-2">คนขับประจำสาย</th>
                      <th className="py-2 pl-2 pr-4 text-right">อัปเดตล่าสุด</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMappingsModal.map((m) => (
                      <tr key={m.postalCode} className="hover:bg-slate-50/70">
                        <td className="py-2.5 pl-4 pr-2 font-mono font-bold text-blue-700">
                          {m.postalCode}
                        </td>
                        <td className="py-2.5 px-2 font-medium text-slate-800">{m.routeName}</td>
                        <td className="py-2.5 px-2 text-slate-600">{m.driverName || '-'}</td>
                        <td className="py-2.5 pl-2 pr-4 text-right text-[11px] text-slate-400">
                          {m.updatedAt || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. Printable Dispatch Sheet Modal for a Postal Code Route */}
      {printGroup && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between print:hidden">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  ใบจัดส่งออนไลน์ — รหัสไปรษณีย์{' '}
                  {printGroup.isMasked ? '****' : printGroup.postalCode}
                </h3>
                <p className="text-xs text-slate-500">
                  รอบวันที่ {formatThaiShortDate(selectedPlanDate)} ·{' '}
                  {routeAssignments[printGroup.postalCode] ||
                    getDefaultTruckAssignment(printGroup.postalCode)}
                  {driverAssignments[printGroup.postalCode]
                    ? ` · คนขับ: ${driverAssignments[printGroup.postalCode]}`
                    : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>พิมพ์ใบจัดส่ง</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintGroup(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="flex items-start justify-between border-b border-slate-200 pb-3">
                <div>
                  <div className="text-base font-extrabold text-slate-900">
                    ใบสรุปจัดส่งสินค้าออนไลน์ — สายรหัส{' '}
                    {printGroup.isMasked ? '****' : printGroup.postalCode}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    รอบวันที่: {formatThaiShortDate(selectedPlanDate)} · สายรถ:{' '}
                    {routeAssignments[printGroup.postalCode] ||
                      getDefaultTruckAssignment(printGroup.postalCode)}
                    {printGroup.districts.length > 0
                      ? ` (${printGroup.districts.join(', ')})`
                      : ''}
                  </div>
                </div>
                <div className="text-right text-xs text-slate-600 font-mono">
                  <div>
                    จำนวนออเดอร์: <strong>{printGroup.orders.length}</strong>
                  </div>
                  <div>
                    รวมสินค้า: <strong>{printGroup.totalQuantity}</strong> ชิ้น
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div className="font-bold text-slate-800 mb-1.5">สรุปยอดเบิกสินค้าขึ้นรถ (SKU)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {printGroup.skuSummary.map((s) => (
                    <div
                      key={`${s.sku}-${s.productName}`}
                      className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200"
                    >
                      <span className="truncate text-slate-700">
                        <strong className="font-mono text-slate-900 mr-1.5">{s.sku}</strong>
                        {s.productName}
                      </span>
                      <span className="font-mono font-bold text-blue-700 shrink-0">
                        ×{s.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <table className="w-full text-left border-collapse text-xs border border-slate-200">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-700">
                    <th className="py-2 px-2 border-r border-slate-200 w-8 text-center">#</th>
                    <th className="py-2 px-2 border-r border-slate-200">เลขคำสั่งซื้อ</th>
                    <th className="py-2 px-2 border-r border-slate-200">ผู้รับ / เบอร์โทร</th>
                    <th className="py-2 px-2 border-r border-slate-200">ที่อยู่จัดส่ง</th>
                    <th className="py-2 px-2 border-r border-slate-200">สินค้า</th>
                    <th className="py-2 px-2 border-r border-slate-200 text-right w-14">จำนวน</th>
                    <th className="py-2 px-2 text-center w-16">ส่งแล้ว</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {printGroup.orders.map((ord, idx) => (
                    <tr key={ord.orderNumber} className="align-top">
                      <td className="py-2 px-2 border-r border-slate-200 text-center font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200 font-mono text-[11px] whitespace-nowrap">
                        <div className="font-bold text-slate-900">{ord.orderNumber}</div>
                        <div className="text-slate-500">{ord.platform}</div>
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">
                          {ord.recipientName || '-'}
                        </div>
                        <div className="font-mono text-[11px] text-slate-700">
                          {ord.phone || '-'}
                        </div>
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200 text-slate-700 leading-snug">
                        {ord.address || '-'}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200">
                        {ord.items.map((it, i) => (
                          <div key={i} className="leading-snug">
                            <span className="font-mono text-[11px] font-semibold">{it.sku}</span>{' '}
                            {it.productName}
                          </div>
                        ))}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200 text-right font-mono font-bold">
                        {ord.totalQuantity}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded border border-slate-400">
                          {ord.deliveryStatus === 'completed' ? (
                            <Check className="w-3 h-3 text-emerald-700" />
                          ) : null}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
