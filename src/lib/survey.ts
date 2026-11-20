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
export interface Panel { l: number; w: number; d: number } // KNX-style panel size (cm)
export interface Room {
  id: string;
  name: string;
  floor: string;
  items: SItem[];
  // legacy (old surveys stored these per room) — migrated into SurveyData.smart_cfg by normSurvey
  style?: Style;
  hubs?: number;
  panel?: Panel;
}
// Smart-home setup is decided once for the whole survey (not per room)
export interface SmartCfg {
  style: Style;
  hubs: number; // zigbee: hubs needed in total
  panels: Panel[]; // KNX-style: one entry per panel, each with its own size
}
export interface SurveyData {
  notes: string;
  smart_cfg: SmartCfg;
  smart_home: Room[];
  cctv: Room[];
  network: Room[];
}
export const emptyCfg = (): SmartCfg => ({ style: 'wifi', hubs: 1, panels: [{ l: 0, w: 0, d: 0 }] });
export const emptySurvey = (): SurveyData => ({ notes: '', smart_cfg: emptyCfg(), smart_home: [], cctv: [], network: [] });
export const normSurvey = (d: Partial<SurveyData> | null | undefined): SurveyData => {
  const rooms = d?.smart_home ?? [];
  let cfg: SmartCfg | undefined = d?.smart_cfg;
  if (!cfg) {
    // old survey: lift the per-room choices up to the survey level
    cfg = emptyCfg();
    const styled = rooms.filter((r) => r.style);
    if (styled.some((r) => r.style === 'panel')) cfg.style = 'panel';
    else if (styled.some((r) => r.style === 'zigbee')) cfg.style = 'zigbee';
    else if (styled.length) cfg.style = styled[0].style as Style;
    const hubs = styled.filter((r) => r.style === 'zigbee').reduce((a, r) => a + (Number(r.hubs) || 0), 0);
    if (hubs) cfg.hubs = hubs;
    const panels = styled.filter((r) => r.style === 'panel' && r.panel).map((r) => ({ l: r.panel!.l, w: r.panel!.w, d: r.panel!.d }));
    if (panels.length) cfg.panels = panels;
  }
  return {
    notes: d?.notes ?? '',
    smart_cfg: { style: cfg.style ?? 'wifi', hubs: cfg.hubs ?? 1, panels: cfg.panels?.length ? cfg.panels : [{ l: 0, w: 0, d: 0 }] },
    smart_home: rooms.map(({ style: _s, hubs: _h, panel: _p, ...r }) => r as Room),
    cctv: d?.cctv ?? [],
    network: d?.network ?? [],
  };
};

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
      ? t('أجهزة زيجبي — حدد إجمالي عدد الهابات', 'Zigbee devices — set the total number of hubs')
      : t('أجهزة متجمعة في لوحات — حدد عدد اللوحات ومقاس كل لوحة', 'Devices gathered in panels — set the number of panels and each panel size');

export async function loadCatalog(): Promise<CatItem[]> {
  const { data } = await supabase.from('survey_catalog').select('*').order('sort').order('name_ar');
  return (data ?? []) as CatItem[];
}

const panelSize = (p: Panel) => `${p.l}×${p.w}×${p.d} ${t('سم', 'cm')}`;
// one-line summary of the smart-home setup (shown in the admin view and the PDF)
export const cfgDetail = (c: SmartCfg): string => {
  const base = styleLabel(c.style);
  if (c.style === 'zigbee') return `${base} · ${t('هابات', 'hubs')}: ${c.hubs}`;
  if (c.style === 'panel')
    return `${base} · ${t('عدد اللوحات', 'panels')}: ${c.panels.length}` + c.panels.map((p, i) => ` · ${t('لوحة', 'Panel')} ${i + 1}: ${panelSize(p)}`).join('');
  return base;
};

export function validate(d: SurveyData): string | null {
  if (!d.smart_home.length) return null; // no smart-home rooms => the setup is irrelevant
  const c = d.smart_cfg;
  if (c.style === 'zigbee' && !(Number(c.hubs) >= 1)) return t('سمارت هوم: حدد عدد الهابات المطلوبة', 'Smart home: set the number of hubs needed');
  if (c.style === 'panel') {
    if (!c.panels.length) return t('سمارت هوم: حدد عدد اللوحات', 'Smart home: set the number of panels');
    const k = c.panels.findIndex((p) => !(Number(p.l) > 0 && Number(p.w) > 0 && Number(p.d) > 0));
    if (k >= 0) return `${t('سمارت هوم', 'Smart home')} — ${t('لوحة', 'Panel')} ${k + 1}: ${t('اكتب الطول والعرض والعمق', 'enter length, width and depth')}`;
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
      ${s === 'smart_home' ? `<p style="margin:2px 0 6px;color:#7a5a00"><i>${esc(cfgDetail(d.smart_cfg))}</i></p>` : ''}
      ${rooms.map((r) => `<p style="margin:8px 0 2px"><b>${esc(r.name || '—')}</b>${r.floor ? ` · ${esc(r.floor)}` : ''}</p>
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
