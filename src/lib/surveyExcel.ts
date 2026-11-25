import { saveFile } from './export';
import { SECTIONS, cfgDetail, nm, roomWord, secLabel, totals, unitLabel, type SurveyData } from './survey';
import { t } from '../i18n';

/**
 * PROSMART_SURVEY v1 — the exchange format read by smart-home-automation ("رفع معاينة").
 *
 * Sheet "INFO"  : 2 columns (key | value)
 *   format = PROSMART_SURVEY, version = 1, order_no, customer, location, date, notes,
 *   smart_style (wifi|zigbee|panel), zigbee_hubs, panels_count
 * Sheet "ITEMS" : one row per item per room
 *   section (smart_home|cctv|network) | floor | room | item_ar | item_en | qty | unit (pcs|m) | catalog_id
 *
 * The importer only looks at sheets named INFO and ITEMS, so the file can also carry readable sheets.
 */
export const SURVEY_FORMAT = 'PROSMART_SURVEY';
export const SURVEY_VERSION = 1;

export interface SurveyMeta { order_no: number; client_name: string; location_text: string; when: string }

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const HEAD_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF003A5F' } };
const HEAD_FONT = { bold: true, color: { argb: 'FFFFFFFF' } };

async function newBook() {
  const ExcelJS = (await import('exceljs')).default;
  return new ExcelJS.Workbook();
}

function head(row: import('exceljs').Row) {
  row.font = HEAD_FONT;
  row.fill = HEAD_FILL;
}

/** Readable sheet: client header, then per section → rooms → items, then totals. */
function addReadableSheet(wb: import('exceljs').Workbook, m: SurveyMeta, customer: string, d: SurveyData) {
  const ws = wb.addWorksheet(t('المعاينة', 'Survey'), { views: [{ rightToLeft: true }] });
  ws.columns = [{ width: 28 }, { width: 38 }, { width: 12 }, { width: 10 }];
  const title = ws.addRow([`PROSMART — ${t('تقرير معاينة', 'Site survey')} #${m.order_no}`]);
  title.font = { bold: true, size: 14, color: { argb: 'FF003A5F' } };
  ws.mergeCells(title.number, 1, title.number, 4);
  ws.addRow([t('العميل', 'Customer'), customer || m.client_name]);
  ws.addRow([t('العنوان', 'Location'), m.location_text]);
  ws.addRow([t('التاريخ', 'Date'), m.when]);
  ws.addRow([]);

  for (const s of SECTIONS) {
    const rooms = d[s];
    if (!rooms.length) continue;
    const sec = ws.addRow([secLabel(s)]);
    sec.font = HEAD_FONT;
    sec.fill = HEAD_FILL;
    ws.mergeCells(sec.number, 1, sec.number, 4);
    if (s === 'smart_home') ws.addRow([t('نظام السمارت هوم', 'Smart-home setup'), cfgDetail(d.smart_cfg)]);
    for (const r of rooms) {
      const rh = ws.addRow([`${r.name || roomWord(s)}${r.floor ? ' · ' + r.floor : ''}`, t('الصنف', 'Item'), t('الكمية', 'Qty'), t('الوحدة', 'Unit')]);
      rh.font = { bold: true };
      rh.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2F7' } };
      if (!r.items.length) ws.addRow(['', '—']);
      for (const i of r.items) ws.addRow(['', nm(i), Number(i.qty), unitLabel(i.unit) || t('قطعة', 'pcs')]);
    }
    const th = ws.addRow([t('الإجمالي', 'Total'), t('الصنف', 'Item'), t('الكمية', 'Qty'), t('الوحدة', 'Unit')]);
    th.font = { bold: true };
    for (const x of totals(rooms)) ws.addRow(['', x.name, x.qty, unitLabel(x.unit) || t('قطعة', 'pcs')]);
    ws.addRow([]);
  }
  if (d.notes) {
    ws.addRow([t('ملاحظات', 'Notes'), d.notes]);
  }
}

/** Machine-readable sheets (INFO + ITEMS) — keep header names and values exactly as documented above. */
function addDataSheets(wb: import('exceljs').Workbook, m: SurveyMeta, customer: string, d: SurveyData) {
  const info = wb.addWorksheet('INFO');
  head(info.addRow(['key', 'value']));
  const c = d.smart_cfg;
  const kv: [string, string | number][] = [
    ['format', SURVEY_FORMAT],
    ['version', SURVEY_VERSION],
    ['order_no', m.order_no],
    ['customer', customer || m.client_name],
    ['location', m.location_text],
    ['date', m.when],
    ['notes', d.notes ?? ''],
    ['smart_style', c.style],
    ['zigbee_hubs', c.style === 'zigbee' ? Number(c.hubs) || 0 : 0],
    ['panels_count', c.style === 'panel' ? c.panels.length : 0],
  ];
  kv.forEach((r) => info.addRow(r));
  info.columns = [{ width: 18 }, { width: 50 }];

  const items = wb.addWorksheet('ITEMS');
  head(items.addRow(['section', 'floor', 'room', 'item_ar', 'item_en', 'qty', 'unit', 'catalog_id']));
  for (const s of SECTIONS)
    for (const r of d[s])
      for (const i of r.items)
        items.addRow([s, r.floor ?? '', r.name ?? '', i.name_ar, i.name_en ?? '', Number(i.qty), i.unit, i.cid ?? '']);
  items.columns = [{ width: 12 }, { width: 12 }, { width: 22 }, { width: 32 }, { width: 32 }, { width: 8 }, { width: 8 }, { width: 38 }];
}

async function write(wb: import('exceljs').Workbook, filename: string) {
  const buf = await wb.xlsx.writeBuffer();
  await saveFile(filename, new Blob([buf], { type: XLSX_MIME }));
}

/** Button 1 — organized Excel to save / share (WhatsApp, Drive…). */
export async function shareSurveyExcel(m: SurveyMeta, customer: string, d: SurveyData) {
  const wb = await newBook();
  addReadableSheet(wb, m, customer, d);
  await write(wb, `survey-${m.order_no}.xlsx`);
}

/** Button 2 — file in the PROSMART_SURVEY format (readable sheet + INFO + ITEMS) for the quotation app. */
export async function exportSurveyForQuotation(m: SurveyMeta, customer: string, d: SurveyData) {
  const wb = await newBook();
  addReadableSheet(wb, m, customer, d);
  addDataSheets(wb, m, customer, d);
  await write(wb, `survey-${m.order_no}-prosmart.xlsx`);
}
