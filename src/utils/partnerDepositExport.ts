import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  PartnerDepositVehicle,
  PartnerDepositDeduction,
  PartnerDepositWithdrawal,
  PartnerDepositVehicleSummary,
} from '../types';

export const formatCurrencyTHB = (amount: number): string => {
  const num = Number.isFinite(amount) ? amount : 0;
  return `฿${num.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

export const formatThaiDateBE = (dateStr?: string): string => {
  if (!dateStr) return '-';
  const clean = String(dateStr).trim();
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const yearBE = Number(match[1]) + 543;
    return `${match[3]}/${match[2]}/${yearBE}`;
  }
  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const yearBE = d.getFullYear() + 543;
    return `${day}/${month}/${yearBE}`;
  }
  return clean;
};

export const getTodayISODate = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getCurrentMonthYear = (): string => {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  return `${m}/${y}`;
};

export const getNextSequentialId = (
  prefix: string,
  existingIds: string[],
  padLength: number
): string => {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped}(\\d+)$`, 'i');
  let maxNum = 0;
  for (const id of existingIds) {
    const m = String(id || '').trim().match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  }
  return `${prefix}${String(maxNum + 1).padStart(padLength, '0')}`;
};

export const computePartnerDepositSummaries = (
  vehicles: PartnerDepositVehicle[],
  deductions: PartnerDepositDeduction[],
  withdrawals: PartnerDepositWithdrawal[]
): PartnerDepositVehicleSummary[] => {
  const dedByVehicle = new Map<string, number>();
  for (const d of deductions) {
    const key = d.vehicleId;
    dedByVehicle.set(key, (dedByVehicle.get(key) || 0) + (Number(d.amount) || 0));
  }

  const wdByVehicle = new Map<string, number>();
  for (const w of withdrawals) {
    const key = w.vehicleId;
    wdByVehicle.set(key, (wdByVehicle.get(key) || 0) + (Number(w.amount) || 0));
  }

  return vehicles.map((v) => {
    const totalDeductions = dedByVehicle.get(v.vehicleId) || 0;
    const totalWithdrawals = wdByVehicle.get(v.vehicleId) || 0;
    const currentBalance = totalDeductions - totalWithdrawals;
    const target = Number(v.targetAmount) || 0;
    const remainingAmount = Math.max(0, target - currentBalance);
    const deductionPercentage =
      target > 0
        ? Math.max(0, Math.min(100, Math.round((currentBalance / target) * 100)))
        : 100;

    return {
      ...v,
      totalDeductions,
      totalWithdrawals,
      currentBalance,
      remainingAmount,
      deductionPercentage,
    };
  });
};

// Safe DOM builder helper (no innerHTML injection)
const createEl = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  styles: Partial<CSSStyleDeclaration>,
  textOrChildren?: string | (HTMLElement | Text | null | undefined)[]
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  Object.assign(node.style, styles);
  if (typeof textOrChildren === 'string') {
    node.textContent = textOrChildren;
  } else if (Array.isArray(textOrChildren)) {
    for (const child of textOrChildren) {
      if (child) node.appendChild(child);
    }
  }
  return node;
};

export interface PartnerDepositExportParams {
  vehicles: PartnerDepositVehicleSummary[];
  deductions: PartnerDepositDeduction[];
  withdrawals: PartnerDepositWithdrawal[];
  selectedVehicleId?: string; // 'ALL' or specific vehicleId
  organizationName?: string;
  preparedBy?: string;
}

export const exportPartnerDepositPdf = async ({
  vehicles,
  deductions,
  withdrawals,
  selectedVehicleId = 'ALL',
  organizationName = 'ระบบจัดการกองทุนเงินประกันรถร่วมขนส่ง',
  preparedBy,
}: PartnerDepositExportParams): Promise<void> => {
  const isSingle = selectedVehicleId !== 'ALL';
  const targetVehicle = isSingle
    ? vehicles.find((v) => v.vehicleId === selectedVehicleId) || null
    : null;

  const scopedVehicles = targetVehicle ? [targetVehicle] : vehicles;
  const vehicleMap = new Map<string, PartnerDepositVehicleSummary>();
  vehicles.forEach((v) => vehicleMap.set(v.vehicleId, v));

  const scopedDeductions = (
    targetVehicle
      ? deductions.filter((d) => d.vehicleId === targetVehicle.vehicleId)
      : deductions
  )
    .slice()
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.deductionId.localeCompare(a.deductionId));

  const scopedWithdrawals = (
    targetVehicle
      ? withdrawals.filter((w) => w.vehicleId === targetVehicle.vehicleId)
      : withdrawals
  )
    .slice()
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.withdrawalId.localeCompare(a.withdrawalId));

  const totalDeductions = scopedDeductions.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const totalWithdrawals = scopedWithdrawals.reduce((s, w) => s + (Number(w.amount) || 0), 0);
  const netBalance = totalDeductions - totalWithdrawals;

  const now = new Date();
  const printDateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear() + 543} เวลา ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} น.`;

  // Build offscreen A4 container (794px = 210mm at 96dpi)
  const container = createEl('div', {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: '794px',
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    padding: '36px 40px 44px 40px',
    boxSizing: 'border-box',
    fontFamily: "'Noto Sans Thai', 'Sarabun', 'Plus Jakarta Sans', sans-serif",
    fontSize: '12px',
    lineHeight: '1.5',
    zIndex: '-1',
  });

  // 1. Official Header
  const header = createEl(
    'div',
    {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      borderBottom: '2px solid #0F172A',
      paddingBottom: '14px',
      marginBottom: '18px',
    },
    [
      createEl('div', {}, [
        createEl(
          'div',
          { fontSize: '19px', fontWeight: '800', color: '#0F172A', letterSpacing: '-0.2px' },
          'รายงานสรุปกองทุนเงินประกันรถร่วมขนส่ง'
        ),
        createEl(
          'div',
          { fontSize: '12px', color: '#475569', marginTop: '3px', fontWeight: '600' },
          organizationName
        ),
      ]),
      createEl('div', { textAlign: 'right', fontSize: '11px', color: '#475569' }, [
        createEl('div', { fontWeight: '700', color: '#0F172A' }, 'เอกสารรายงานทางการ'),
        createEl('div', { marginTop: '2px' }, `วันที่พิมพ์: ${printDateStr}`),
        preparedBy
          ? createEl('div', { marginTop: '2px' }, `ผู้จัดทำ: ${preparedBy}`)
          : null,
      ]),
    ]
  );
  container.appendChild(header);

  // 2. Scope Info Box
  const scopeBox = createEl(
    'div',
    {
      backgroundColor: '#F8FAFC',
      border: '1px solid #CBD5E1',
      borderRadius: '8px',
      padding: '12px 16px',
      marginBottom: '18px',
    },
    targetVehicle
      ? [
          createEl(
            'div',
            { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' },
            [
              createEl(
                'div',
                { fontSize: '14px', fontWeight: '800', color: '#0F172A' },
                `ทะเบียนรถร่วม: ${targetVehicle.licensePlate} (${targetVehicle.vehicleId})`
              ),
              createEl(
                'div',
                {
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '2px 10px',
                  borderRadius: '4px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color:
                    targetVehicle.status === 'ครบกำหนดหักแล้ว'
                      ? '#15803D'
                      : targetVehicle.status === 'หยุดวิ่งงาน'
                      ? '#B91C1C'
                      : '#1D4ED8',
                },
                `สถานะ: ${targetVehicle.status}`
              ),
            ]
          ),
          createEl(
            'div',
            {
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '8px',
              fontSize: '11.5px',
              color: '#334155',
            },
            [
              createEl('div', {}, `พนักงานขับรถ: ${targetVehicle.driverName || '-'}`),
              createEl('div', {}, `เบอร์โทรศัพท์: ${targetVehicle.phone || '-'}`),
              createEl('div', {}, `วันที่เริ่มสะสม: ${formatThaiDateBE(targetVehicle.startDate)}`),
              createEl('div', {}, `อัตราหัก/เดือน: ${formatCurrencyTHB(targetVehicle.monthlyDeduction)}`),
              createEl('div', {}, `วงเงินเป้าหมาย: ${formatCurrencyTHB(targetVehicle.targetAmount)}`),
              createEl('div', {}, `ความคืบหน้า: ${targetVehicle.deductionPercentage}% (คงเหลือต้องหัก ${formatCurrencyTHB(targetVehicle.remainingAmount)})`),
            ]
          ),
        ]
      : [
          createEl(
            'div',
            { fontSize: '13.5px', fontWeight: '800', color: '#0F172A' },
            `ขอบเขตรายงาน: ภาพรวมรถร่วมทุกคัน (${scopedVehicles.length} คัน)`
          ),
          createEl(
            'div',
            { fontSize: '11.5px', color: '#475569', marginTop: '4px' },
            `กำลังหักเงิน ${scopedVehicles.filter((v) => v.status === 'กำลังหักเงิน').length} คัน  •  ครบกำหนดหักแล้ว ${scopedVehicles.filter((v) => v.status === 'ครบกำหนดหักแล้ว').length} คัน  •  หยุดวิ่งงาน ${scopedVehicles.filter((v) => v.status === 'หยุดวิ่งงาน').length} คัน`
          ),
        ]
  );
  container.appendChild(scopeBox);

  // 3. Three Financial Summary Boxes
  const summaryGrid = createEl(
    'div',
    {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: '12px',
      marginBottom: '20px',
    },
    [
      createEl(
        'div',
        {
          border: '1px solid #BBF7D0',
          backgroundColor: '#F0FDF4',
          borderRadius: '8px',
          padding: '12px 14px',
        },
        [
          createEl('div', { fontSize: '11px', color: '#166534', fontWeight: '700' }, 'ยอดหักสมทบสะสมรวม'),
          createEl(
            'div',
            { fontSize: '18px', fontWeight: '800', color: '#15803D', marginTop: '4px', fontVariantNumeric: 'tabular-nums' },
            formatCurrencyTHB(totalDeductions)
          ),
          createEl('div', { fontSize: '10.5px', color: '#166534', marginTop: '2px' }, `จำนวน ${scopedDeductions.length} รายการ`),
        ]
      ),
      createEl(
        'div',
        {
          border: '1px solid #FECACA',
          backgroundColor: '#FEF2F2',
          borderRadius: '8px',
          padding: '12px 14px',
        },
        [
          createEl('div', { fontSize: '11px', color: '#991B1B', fontWeight: '700' }, 'ยอดเบิกจ่ายออกรวม'),
          createEl(
            'div',
            { fontSize: '18px', fontWeight: '800', color: '#DC2626', marginTop: '4px', fontVariantNumeric: 'tabular-nums' },
            formatCurrencyTHB(totalWithdrawals)
          ),
          createEl('div', { fontSize: '10.5px', color: '#991B1B', marginTop: '2px' }, `จำนวน ${scopedWithdrawals.length} รายการ`),
        ]
      ),
      createEl(
        'div',
        {
          border: '1px solid #BFDBFE',
          backgroundColor: '#EFF6FF',
          borderRadius: '8px',
          padding: '12px 14px',
        },
        [
          createEl('div', { fontSize: '11px', color: '#1E40AF', fontWeight: '700' }, 'กองทุนคงเหลือสุทธิ'),
          createEl(
            'div',
            { fontSize: '18px', fontWeight: '800', color: '#1D4ED8', marginTop: '4px', fontVariantNumeric: 'tabular-nums' },
            formatCurrencyTHB(netBalance)
          ),
          createEl('div', { fontSize: '10.5px', color: '#1E40AF', marginTop: '2px' }, 'ยอดหักสะสม − ยอดเบิกจ่าย'),
        ]
      ),
    ]
  );
  container.appendChild(summaryGrid);

  // Table builder helper
  const buildTable = (
    title: string,
    headers: { label: string; align?: 'left' | 'right' | 'center'; width?: string }[],
    rows: { cells: string[]; isTotal?: boolean }[],
    emptyText: string
  ) => {
    const section = createEl('div', { marginBottom: '20px' });
    section.appendChild(
      createEl(
        'div',
        {
          fontSize: '13px',
          fontWeight: '800',
          color: '#0F172A',
          marginBottom: '8px',
          borderLeft: '3px solid #1D4ED8',
          paddingLeft: '8px',
        },
        title
      )
    );

    const table = createEl('table', {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: '11px',
      fontVariantNumeric: 'tabular-nums',
    });

    const thead = createEl('thead', {});
    const headTr = createEl('tr', { backgroundColor: '#F1F5F9' });
    headers.forEach((h) => {
      headTr.appendChild(
        createEl(
          'th',
          {
            border: '1px solid #CBD5E1',
            padding: '6px 8px',
            textAlign: h.align || 'left',
            fontWeight: '700',
            color: '#0F172A',
            width: h.width || 'auto',
          },
          h.label
        )
      );
    });
    thead.appendChild(headTr);
    table.appendChild(thead);

    const tbody = createEl('tbody', {});
    if (rows.length === 0) {
      const emptyTr = createEl('tr', {});
      const td = createEl(
        'td',
        {
          border: '1px solid #CBD5E1',
          padding: '12px',
          textAlign: 'center',
          color: '#64748B',
        },
        emptyText
      );
      td.colSpan = headers.length;
      emptyTr.appendChild(td);
      tbody.appendChild(emptyTr);
    } else {
      rows.forEach((r) => {
        const tr = createEl('tr', {
          backgroundColor: r.isTotal ? '#F8FAFC' : '#FFFFFF',
          fontWeight: r.isTotal ? '700' : '400',
        });
        r.cells.forEach((cellText, idx) => {
          const align = headers[idx]?.align || 'left';
          tr.appendChild(
            createEl(
              'td',
              {
                border: '1px solid #CBD5E1',
                padding: '6px 8px',
                textAlign: align,
                color: '#0F172A',
                wordBreak: 'break-word',
              },
              cellText
            )
          );
        });
        tbody.appendChild(tr);
      });
    }

    table.appendChild(tbody);
    section.appendChild(table);
    return section;
  };

  // 4. Overall Vehicle Summary Table (only when ALL vehicles selected)
  if (!targetVehicle && scopedVehicles.length > 0) {
    const vehicleRows = scopedVehicles.map((v) => ({
      cells: [
        v.vehicleId,
        v.licensePlate,
        v.driverName,
        formatCurrencyTHB(v.targetAmount),
        formatCurrencyTHB(v.totalDeductions),
        formatCurrencyTHB(v.totalWithdrawals),
        formatCurrencyTHB(v.currentBalance),
        v.status,
      ],
    }));
    container.appendChild(
      buildTable(
        `สรุปสถานะกองทุนรายคัน (${scopedVehicles.length} คัน)`,
        [
          { label: 'รหัส', width: '56px' },
          { label: 'ทะเบียนรถ', width: '92px' },
          { label: 'พนักงานขับรถ' },
          { label: 'เป้าหมาย', align: 'right', width: '80px' },
          { label: 'หักสะสม', align: 'right', width: '80px' },
          { label: 'เบิกออก', align: 'right', width: '76px' },
          { label: 'คงเหลือ', align: 'right', width: '82px' },
          { label: 'สถานะ', align: 'center', width: '94px' },
        ],
        vehicleRows,
        'ยังไม่มีข้อมูลรถร่วม'
      )
    );
  }

  // 5. Deductions Table
  const dedRows: { cells: string[]; isTotal?: boolean }[] = scopedDeductions.map((d) => {
    const v = vehicleMap.get(d.vehicleId);
    return {
      cells: [
        d.deductionId,
        formatThaiDateBE(d.date),
        d.monthYear || '-',
        v ? `${v.licensePlate} (${v.driverName})` : d.vehicleId,
        formatCurrencyTHB(d.amount),
        d.notes || '-',
      ],
    };
  });
  if (dedRows.length > 0) {
    dedRows.push({
      isTotal: true,
      cells: ['', '', '', `รวมยอดหักสมทบ (${scopedDeductions.length} รายการ)`, formatCurrencyTHB(totalDeductions), ''],
    });
  }
  container.appendChild(
    buildTable(
      `1. ประวัติการหักสมทบสะสม (${scopedDeductions.length} รายการ)`,
      [
        { label: 'รหัส', width: '64px' },
        { label: 'วันที่บันทึก', width: '84px' },
        { label: 'งวดเดือน/ปี', align: 'center', width: '78px' },
        { label: 'รถร่วม / พนักงานขับรถ' },
        { label: 'ยอดหัก (บาท)', align: 'right', width: '90px' },
        { label: 'หมายเหตุ', width: '130px' },
      ],
      dedRows,
      'ไม่มีประวัติการหักสมทบสะสม'
    )
  );

  // 6. Withdrawals Table
  const wdRows: { cells: string[]; isTotal?: boolean }[] = scopedWithdrawals.map((w) => {
    const v = vehicleMap.get(w.vehicleId);
    return {
      cells: [
        w.withdrawalId,
        formatThaiDateBE(w.date),
        v ? `${v.licensePlate} (${v.driverName})` : w.vehicleId,
        w.reason || '-',
        formatCurrencyTHB(w.amount),
        w.notes || '-',
      ],
    };
  });
  if (wdRows.length > 0) {
    wdRows.push({
      isTotal: true,
      cells: ['', '', '', `รวมยอดเบิกจ่าย (${scopedWithdrawals.length} รายการ)`, formatCurrencyTHB(totalWithdrawals), ''],
    });
  }
  container.appendChild(
    buildTable(
      `2. ประวัติการเบิกถอนออก (${scopedWithdrawals.length} รายการ)`,
      [
        { label: 'รหัส', width: '64px' },
        { label: 'วันที่เบิก', width: '84px' },
        { label: 'รถร่วม / พนักงานขับรถ' },
        { label: 'สาเหตุที่เบิก', width: '140px' },
        { label: 'ยอดเบิก (บาท)', align: 'right', width: '90px' },
        { label: 'หมายเหตุ', width: '110px' },
      ],
      wdRows,
      'ไม่มีประวัติการเบิกถอนเงินประกัน'
    )
  );

  // 7. Official Dual Signature Block
  const signatureSection = createEl(
    'div',
    {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '40px',
      marginTop: '36px',
      paddingTop: '16px',
      borderTop: '1px dashed #CBD5E1',
      textAlign: 'center',
      fontSize: '11.5px',
      color: '#334155',
    },
    [
      createEl('div', {}, [
        createEl('div', { marginTop: '24px' }, 'ลงชื่อ ....................................................................'),
        createEl(
          'div',
          { marginTop: '6px' },
          `( ${preparedBy || '....................................................................'} )`
        ),
        createEl('div', { fontWeight: '700', color: '#0F172A', marginTop: '4px' }, 'ผู้จัดทำรายงาน / เจ้าหน้าที่บัญชี'),
        createEl('div', { marginTop: '4px', fontSize: '11px', color: '#64748B' }, 'วันที่ .......... / .......... / ..............'),
      ]),
      createEl('div', {}, [
        createEl('div', { marginTop: '24px' }, 'ลงชื่อ ....................................................................'),
        createEl(
          'div',
          { marginTop: '6px' },
          `( ${targetVehicle?.driverName || '....................................................................'} )`
        ),
        createEl('div', { fontWeight: '700', color: '#0F172A', marginTop: '4px' }, 'พนักงานขับรถ / ผู้รับทราบ'),
        createEl('div', { marginTop: '4px', fontSize: '11px', color: '#64748B' }, 'วันที่ .......... / .......... / ..............'),
      ]),
    ]
  );
  container.appendChild(signatureSection);

  document.body.appendChild(container);
  try {
    // Wait a tick for web fonts to settle
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: '#FFFFFF',
      useCORS: true,
      logging: false,
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidthMm = pdf.internal.pageSize.getWidth();
    const pageHeightMm = pdf.internal.pageSize.getHeight();

    const imgWidthMm = pageWidthMm;
    const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;
    const imgData = canvas.toDataURL('image/png');

    let heightLeft = imgHeightMm;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidthMm, imgHeightMm);
    heightLeft -= pageHeightMm;

    while (heightLeft > 0) {
      position -= pageHeightMm;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidthMm, imgHeightMm);
      heightLeft -= pageHeightMm;
    }

    const safeScope = targetVehicle
      ? `${targetVehicle.vehicleId}_${targetVehicle.licensePlate.replace(/[^\wก-๙-]/g, '')}`
      : 'ALL';
    const fileDate = getTodayISODate();
    pdf.save(`รายงานเงินประกันรถร่วม_${safeScope}_${fileDate}.pdf`);
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
};

export const exportPartnerDepositExcel = ({
  vehicles,
  deductions,
  withdrawals,
  selectedVehicleId = 'ALL',
}: PartnerDepositExportParams): void => {
  const isSingle = selectedVehicleId !== 'ALL';
  const targetVehicle = isSingle
    ? vehicles.find((v) => v.vehicleId === selectedVehicleId) || null
    : null;

  const scopedVehicles = targetVehicle ? [targetVehicle] : vehicles;
  const vehicleMap = new Map<string, PartnerDepositVehicleSummary>();
  vehicles.forEach((v) => vehicleMap.set(v.vehicleId, v));

  const scopedDeductions = (
    targetVehicle
      ? deductions.filter((d) => d.vehicleId === targetVehicle.vehicleId)
      : deductions
  )
    .slice()
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.deductionId.localeCompare(a.deductionId));

  const scopedWithdrawals = (
    targetVehicle
      ? withdrawals.filter((w) => w.vehicleId === targetVehicle.vehicleId)
      : withdrawals
  )
    .slice()
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.withdrawalId.localeCompare(a.withdrawalId));

  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary
  const summaryRows = scopedVehicles.map((v) => ({
    'รหัสรถ': v.vehicleId,
    'ทะเบียนรถร่วม': v.licensePlate,
    'ชื่อ-นามสกุล คนขับ': v.driverName,
    'เบอร์โทรศัพท์': v.phone || '',
    'วันที่เริ่มสะสม': v.startDate || '',
    'หักสะสม/เดือน (บาท)': v.monthlyDeduction,
    'เป้าหมายสะสม (บาท)': v.targetAmount,
    'หักสมทบรวม (บาท)': v.totalDeductions,
    'เบิกถอนรวม (บาท)': v.totalWithdrawals,
    'คงเหลือสุทธิ (บาท)': v.currentBalance,
    'คงเหลือต้องหักเพิ่ม (บาท)': v.remainingAmount,
    'ความคืบหน้า (%)': v.deductionPercentage,
    'สถานะ': v.status,
    'หมายเหตุ': v.notes || '',
  }));
  const wsSummary = XLSX.utils.json_to_sheet(
    summaryRows.length > 0
      ? summaryRows
      : [{ 'รหัสรถ': '', 'ทะเบียนรถร่วม': 'ยังไม่มีข้อมูล' }]
  );
  wsSummary['!cols'] = [
    { wch: 10 },
    { wch: 16 },
    { wch: 24 },
    { wch: 15 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 22 },
    { wch: 14 },
    { wch: 18 },
    { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'สรุปเงินประกันรถร่วม');

  // Sheet 2: Deductions
  const deductionRows = scopedDeductions.map((d) => {
    const v = vehicleMap.get(d.vehicleId);
    return {
      'รหัสรายการ': d.deductionId,
      'รหัสรถ': d.vehicleId,
      'ทะเบียนรถ': v?.licensePlate || '',
      'ชื่อคนขับ': v?.driverName || '',
      'งวดเดือน/ปี': d.monthYear || '',
      'วันที่บันทึก': d.date || '',
      'จำนวนเงินหัก (บาท)': d.amount,
      'หมายเหตุ': d.notes || '',
    };
  });
  const wsDeductions = XLSX.utils.json_to_sheet(
    deductionRows.length > 0
      ? deductionRows
      : [{ 'รหัสรายการ': '', 'หมายเหตุ': 'ไม่มีประวัติการหักสมทบสะสม' }]
  );
  wsDeductions['!cols'] = [
    { wch: 12 },
    { wch: 10 },
    { wch: 16 },
    { wch: 24 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDeductions, 'ประวัติหักสมทบสะสม');

  // Sheet 3: Withdrawals
  const withdrawalRows = scopedWithdrawals.map((w) => {
    const v = vehicleMap.get(w.vehicleId);
    return {
      'รหัสรายการ': w.withdrawalId,
      'รหัสรถ': w.vehicleId,
      'ทะเบียนรถ': v?.licensePlate || '',
      'ชื่อคนขับ': v?.driverName || '',
      'วันที่เบิก': w.date || '',
      'จำนวนเงินเบิก (บาท)': w.amount,
      'สาเหตุที่เบิก': w.reason || '',
      'หมายเหตุ': w.notes || '',
    };
  });
  const wsWithdrawals = XLSX.utils.json_to_sheet(
    withdrawalRows.length > 0
      ? withdrawalRows
      : [{ 'รหัสรายการ': '', 'หมายเหตุ': 'ไม่มีประวัติการเบิกถอนออก' }]
  );
  wsWithdrawals['!cols'] = [
    { wch: 12 },
    { wch: 10 },
    { wch: 16 },
    { wch: 24 },
    { wch: 14 },
    { wch: 18 },
    { wch: 26 },
    { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, wsWithdrawals, 'ประวัติเบิกถอนออก');

  const safeScope = targetVehicle
    ? `${targetVehicle.vehicleId}_${targetVehicle.licensePlate.replace(/[^\wก-๙-]/g, '')}`
    : 'ALL';
  const fileDate = getTodayISODate();
  XLSX.writeFile(wb, `เงินประกันรถร่วม_${safeScope}_${fileDate}.xlsx`);
};
