import { FleetVehicle } from '../types';
import { parseDateRobust } from './dateUtils';

export const EXPIRY_WARNING_DAYS = 30;

export type ExpirySeverity = 'expired' | 'warning' | 'ok' | 'unset';

export type ComplianceDocType = 'tax' | 'prb' | 'insurance';

export interface ExpiryEvaluation {
  severity: ExpirySeverity;
  daysRemaining: number | null;
  label: string;
  shortLabel: string;
}

export interface FleetComplianceAlert {
  id: string;
  vehicleId: string;
  plateNumber: string;
  ownershipType: FleetVehicle['ownershipType'];
  brandModel: string;
  docType: ComplianceDocType;
  docLabel: string;
  expiryDate: string;
  daysRemaining: number;
  severity: 'expired' | 'warning';
  statusLabel: string;
}

/**
 * Computes day difference between a target date string (YYYY-MM-DD or DD/MM/YYYY) and local today.
 */
export function evaluateExpiryStatus(
  dateStr?: string,
  warningDays: number = EXPIRY_WARNING_DAYS
): ExpiryEvaluation {
  if (!dateStr || !String(dateStr).trim()) {
    return {
      severity: 'unset',
      daysRemaining: null,
      label: 'ยังไม่ระบุ',
      shortLabel: 'ไม่ระบุ',
    };
  }

  const parsed = parseDateRobust(dateStr);
  if (isNaN(parsed.getTime())) {
    return {
      severity: 'unset',
      daysRemaining: null,
      label: 'รูปแบบวันที่ไม่ถูกต้อง',
      shortLabel: 'ไม่ระบุ',
    };
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetStart = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
  const daysRemaining = Math.round((targetStart - todayStart) / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    const overdueDays = Math.abs(daysRemaining);
    return {
      severity: 'expired',
      daysRemaining,
      label: `เกินกำหนด ${overdueDays} วัน`,
      shortLabel: `เลย ${overdueDays} วัน`,
    };
  }

  if (daysRemaining === 0) {
    return {
      severity: 'expired',
      daysRemaining: 0,
      label: 'หมดอายุวันนี้',
      shortLabel: 'หมดวันนี้',
    };
  }

  if (daysRemaining <= warningDays) {
    return {
      severity: 'warning',
      daysRemaining,
      label: `เหลือ ${daysRemaining} วัน`,
      shortLabel: `เหลือ ${daysRemaining} วัน`,
    };
  }

  return {
    severity: 'ok',
    daysRemaining,
    label: `ปกติ (เหลือ ${daysRemaining} วัน)`,
    shortLabel: `เหลือ ${daysRemaining} วัน`,
  };
}

/**
 * Returns the most urgent compliance status across tax, PRB, and insurance for a single vehicle.
 */
export function getVehicleWorstSeverity(
  vehicle: FleetVehicle,
  warningDays: number = EXPIRY_WARNING_DAYS
): ExpirySeverity {
  if (vehicle.status === 'inactive') return 'ok';

  const evals = [
    evaluateExpiryStatus(vehicle.taxExpiryDate, warningDays),
    evaluateExpiryStatus(vehicle.prbExpiryDate, warningDays),
    evaluateExpiryStatus(vehicle.insuranceExpiryDate, warningDays),
  ];

  if (evals.some((e) => e.severity === 'expired')) return 'expired';
  if (evals.some((e) => e.severity === 'warning')) return 'warning';
  if (evals.some((e) => e.severity === 'ok')) return 'ok';
  return 'unset';
}

/**
 * Collects and sorts all expired or upcoming (<= warningDays) compliance alerts across active/maintenance fleet vehicles.
 */
export function getVehicleComplianceAlerts(
  vehicles: FleetVehicle[],
  warningDays: number = EXPIRY_WARNING_DAYS
): {
  alerts: FleetComplianceAlert[];
  expiredCount: number;
  warningCount: number;
  urgentVehicleIds: Set<string>;
} {
  const alerts: FleetComplianceAlert[] = [];
  const urgentVehicleIds = new Set<string>();
  let expiredCount = 0;
  let warningCount = 0;

  const docs: Array<{ type: ComplianceDocType; label: string; field: 'taxExpiryDate' | 'prbExpiryDate' | 'insuranceExpiryDate' }> = [
    { type: 'tax', label: 'ภาษีรถยนต์', field: 'taxExpiryDate' },
    { type: 'prb', label: 'พ.ร.บ.', field: 'prbExpiryDate' },
    { type: 'insurance', label: 'ประกันภัย', field: 'insuranceExpiryDate' },
  ];

  vehicles.forEach((v) => {
    if (v.status === 'inactive') return;
    const brandModel = [v.brand, v.model].filter(Boolean).join(' ') || v.vehicleType || 'ไม่ระบุรุ่น';

    docs.forEach((doc) => {
      const dateStr = v[doc.field];
      if (!dateStr) return;
      const evaluation = evaluateExpiryStatus(dateStr, warningDays);
      if (evaluation.severity === 'expired' || evaluation.severity === 'warning') {
        if (evaluation.severity === 'expired') expiredCount += 1;
        else warningCount += 1;
        urgentVehicleIds.add(v.id);
        alerts.push({
          id: `${v.id}-${doc.type}`,
          vehicleId: v.id,
          plateNumber: v.plateNumber,
          ownershipType: v.ownershipType,
          brandModel,
          docType: doc.type,
          docLabel: doc.label,
          expiryDate: dateStr,
          daysRemaining: evaluation.daysRemaining ?? 0,
          severity: evaluation.severity,
          statusLabel: evaluation.label,
        });
      }
    });
  });

  alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);

  return {
    alerts,
    expiredCount,
    warningCount,
    urgentVehicleIds,
  };
}

/**
 * Adds 1 calendar year to an existing YYYY-MM-DD date (or today if unset/expired) for Quick Renew.
 */
export function suggestNextYearExpiryDate(currentDateStr?: string): string {
  const now = new Date();
  let base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (currentDateStr) {
    const parsed = parseDateRobust(currentDateStr);
    if (!isNaN(parsed.getTime())) {
      base = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }
  }
  base.setFullYear(base.getFullYear() + 1);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
