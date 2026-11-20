import { supabase } from './supabase';
import { esc } from './export';
import { isEn, t } from '../i18n';

export type Section = 'smart_home' | 'cctv' | 'network';
export const SECTIONS: Section[] = ['smart_home', 'cctv', 'network'];
export const secLabel = (s: Section) =>
  s === 'smart_home' ? t('سمارت هوم', 'Smart Home') : s === 'cctv' ? t('كاميرات CCTV', 'CCTV') : t('شبكات', 'Network');
export const roomWord = (s: Section) => (s === 'smart_home' ? t('غرفة', 'Room') : t('منطقة', 'Area'));

export interface CatItem {
  id: string;
  section: Section;
  grp_ar: string;
  grp_en: string;
  name_ar: string;
  name_en: string;
  unit: 'pcs' | 'm';
  sort: number;
}
export interface SItem {
  cid: string | null;
  name_ar: string;
  name_en: string;
  unit: 'pcs' | 'm';
  qty: number;
}
export type Style = 'wifi' | 'zigbee' | 'panel';
export interface Room {
  id: string;
  name: string;
  floor: string;
  style?: Style;
  hubs?: number; // zigbee: how many hubs this room needs
  panel?: { l: number; w: number; d: number }; // KNX-style panel size (cm)
  items: SItem[];
}
export interface SurveyData {
  notes: string;
  smart_home: Room[];
  cctv: Room[];
  network: Room[];
}
export const emptySurvey = (): SurveyData => ({ notes: '', smart_home: [], cctv: [], network: [] });
export const normSurvey = (d: Partial<SurveyData> | null | undefined): SurveyData => ({
  notes: d?.notes ?? '',
  smart_home: d?.smart_home ?? [],
  cctv: d?.cctv ?? [],
  network: d?.network ?? [],
});

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
export const nm = (i: { name_ar: string; name_en: string }) => (isEn && i.name_en ? i.name_en : i.name_ar);
export const grp = (i: { grp_ar: string; grp_en: string }) => (isEn && i.grp_en ? i.grp_en : i.grp_ar);
export const unitLabel = (u: 'pcs' | 'm') => (u === 'm' ? t('م', 'm') : '');

export const styleLabel = (s: Style) =>
  s === 'wifi' ? t('واي فاي 2.4', 'Wi-Fi 2.4 GHz') : s === 'zigbee' ? t('زيجبي', 'Zigbee') : t('لوحة KNX Style', 'KNX-style panel');
export const styleHint = (s: Style) =>
  s === 'wifi'
    ? t('أجهزة بتشتغل ببروتوكول واي فاي 2.4', 'Devices that run on Wi-Fi 2.4 GHz')
    : s === 'zigbee'
      ? t('أجهزة زيجبي — لازم تحدد عدد الهابات', 'Zigbee devices — set how many hubs are needed')
      : t('أجهزة واي فاي أو زيجبي متجمعة في لوحة — لازم تكتب أبعاد اللوحة', 'Wi-Fi or Zigbee devices gathered in one panel — enter the panel size');

export async function loadCatalog(): Promise<CatItem[]> {
  const { data } = await supabase.from('survey_catalog').select('*').order('sort').order('name_ar');
  return (data ?? []) as CatItem[];
}

export const roomDetail = (s: Section, r: Room): string => {
  if (s !== 'smart_home' || !r.style) return '';
  const base = styleLabel(r.style);
  if (r.style === 'zigbee') return `${base} · ${t('هابات', 'hubs')}: ${r.hubs ?? 0}`;
  if (r.style === 'panel') return `${base} · ${r.panel?.l ?? 0}×${r.panel?.w ?? 0}×${r.panel?.d ?? 0} ${t('سم', 'cm')}`;
  return base;
};

export function validate(d: SurveyData): string | null {
  for (const r of d.smart_home) {
    const label = r.name || t('غرفة بدون اسم', 'Unnamed room');
    if (r.style === 'zigbee' && !(Number(r.hubs) >= 1)) return `${label}: ${t('حدد عدد الهابات المطلوبة', 'set the number of hubs needed')}`;
    if (r.style === 'panel' && !(Number(r.panel?.l) > 0 && Number(r.panel?.w) > 0 && Number(r.panel?.d) > 0))
      return `${label}: ${t('اكتب أبعاد اللوحة (طول وعرض وعمق)', 'enter the panel size (length, width, depth)')}`;
  }
  return null;
}

export interface Total { key: string; name: string; unit: 'pcs' | 'm'; qty: number }
export function totals(rooms: Room[]): Total[] {
  const m = new Map<string, Total>();
  for (const r of rooms)
    for (const i of r.items) {
      const key = i.cid ?? i.name_ar;
      const cur = m.get(key);
      if (cur) cur.qty += Number(i.qty);
      else m.set(key, { key, name: nm(i), unit: i.unit, qty: Number(i.qty) });
    }
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function surveyHtml(o: { order_no: number; client_name: string; location_text: string; when: string }, customer: string, d: SurveyData): string {
  const th = 'style="border:1px solid #ccc;padding:4px 8px;background:#eef2f7;text-align:start"';
  const td = 'style="border:1px solid #ccc;padding:4px 8px"';
  const body = SECTIONS.map((s) => {
    const rooms = d[s];
    if (!rooms.length) return '';
    const tot = totals(rooms);
    return `<h3 style="color:#003a5f;margin:16px 0 4px">${esc(secLabel(s))}</h3>
      ${rooms.map((r) => `<p style="margin:8px 0 2px"><b>${esc(r.name || '—')}</b>${r.floor ? ` · ${esc(r.floor)}` : ''}${roomDetail(s, r) ? ` · <i>${esc(roomDetail(s, r))}</i>` : ''}</p>
        <ul style="margin:0 0 4px">${r.items.map((i) => `<li>${esc(nm(i))} × ${Number(i.qty)}${unitLabel(i.unit) ? ' ' + unitLabel(i.unit) : ''}</li>`).join('') || '<li>—</li>'}</ul>`).join('')}
      <table style="width:100%;border-collapse:collapse;margin-top:6px"><tr><th ${th}>${esc(t('إجمالي ' + secLabel(s), 'Total — ' + secLabel(s)))}</th><th ${th}>${esc(t('الكمية', 'Qty'))}</th></tr>
      ${tot.map((x) => `<tr><td ${td}>${esc(x.name)}</td><td ${td}>${x.qty}${unitLabel(x.unit) ? ' ' + unitLabel(x.unit) : ''}</td></tr>`).join('')}</table>`;
  }).join('');
  return `<div dir="${isEn ? 'ltr' : 'rtl'}" style="direction:${isEn ? 'ltr' : 'rtl'};text-align:start">
    <h2 style="margin:0;color:#003a5f">PROSMART — ${esc(t('تقرير معاينة', 'Site survey'))} #${o.order_no}</h2>
    <p style="color:#555;margin:2px 0 12px">${esc(customer || o.client_name)} · ${esc(o.location_text)} · ${esc(o.when)}</p>
    ${body || `<p>${esc(t('لا توجد بيانات معاينة بعد.', 'No survey data yet.'))}</p>`}
    ${d.notes ? `<p><b>${esc(t('ملاحظات', 'Notes'))}:</b> ${esc(d.notes)}</p>` : ''}</div>`;
}
