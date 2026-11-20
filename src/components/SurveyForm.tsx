import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Home, Minus, Network, Plus, Trash2, Video } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { t } from '../i18n';
import { L, btn, card, inp } from '../ui';
import {
  SECTIONS, emptySurvey, grp, loadCatalog, nm, normSurvey, roomDetail, roomWord, secLabel, styleHint, styleLabel,
  totals, uid, unitLabel, validate, type CatItem, type Room, type Section, type Style, type SurveyData,
} from '../lib/survey';

const secIcon = { smart_home: Home, cctv: Video, network: Network } as const;
const STYLES: Style[] = ['wifi', 'zigbee', 'panel'];

// Site survey (معاينة): rooms/areas per section, devices picked from the owner-managed catalog.
export default function SurveyForm({
  orderId, defaultCustomer, onRegisterSave,
}: {
  orderId: string;
  defaultCustomer: string;
  onRegisterSave?: (save: () => Promise<boolean>) => void;
}) {
  const [catalog, setCatalog] = useState<CatItem[]>([]);
  const [customer, setCustomer] = useState(defaultCustomer);
  const [data, setData] = useState<SurveyData>(emptySurvey());
  const [sec, setSec] = useState<Section>('smart_home');
  const [pick, setPick] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const draftKey = `survey-draft-${orderId}`;

  useEffect(() => {
    loadCatalog().then(setCatalog);
    (async () => {
      const { data: row } = await supabase.from('site_surveys').select('customer_name,data').eq('work_order_id', orderId).maybeSingle();
      let c = row?.customer_name ?? defaultCustomer;
      let d = normSurvey(row?.data as Partial<SurveyData> | undefined);
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) {
          const dr = JSON.parse(raw);
          c = dr.customer ?? c;
          d = normSurvey(dr.data);
          setDirty(true);
          setMsg(t('في مسودة لسه ماتحفظتش — اضغط حفظ', 'There is an unsaved draft — tap Save'));
        }
      } catch { /* ignore */ }
      setCustomer(c);
      setData(d);
    })();
  }, [orderId, defaultCustomer, draftKey]);

  const draft = (c: string, d: SurveyData) => {
    try { localStorage.setItem(draftKey, JSON.stringify({ customer: c, data: d })); } catch { /* ignore */ }
  };
  const edit = (fn: (d: SurveyData) => SurveyData) => {
    const nx = fn(data);
    setData(nx);
    setDirty(true);
    draft(customer, nx);
  };

  const save = useCallback(async (): Promise<boolean> => {
    const bad = validate(data);
    if (bad) { setMsg(bad); return false; }
    setBusy(true);
    setMsg('');
    const { error } = await supabase
      .from('site_surveys')
      .upsert({ work_order_id: orderId, customer_name: customer || null, data }, { onConflict: 'work_order_id' });
    setBusy(false);
    if (error) { setMsg(error.message); return false; }
    try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
    setDirty(false);
    setMsg(t('تم الحفظ ✓', 'Saved ✓'));
    return true;
  }, [data, customer, orderId, draftKey]);

  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => { onRegisterSave?.(() => saveRef.current()); }, [onRegisterSave]);

  const rooms = data[sec];
  const setRooms = (rs: Room[]) => edit((d) => ({ ...d, [sec]: rs }));
  const upd = (id: string, patch: Partial<Room>) => setRooms(rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addRoom = () =>
    setRooms([...rooms, { id: uid(), name: '', floor: rooms.length ? rooms[rooms.length - 1].floor : '', items: [], ...(sec === 'smart_home' ? { style: 'wifi' as Style } : {}) }]);
  const addItem = (rid: string, c: CatItem) =>
    setRooms(rooms.map((r) => {
      if (r.id !== rid) return r;
      const has = r.items.some((i) => i.cid === c.id);
      return {
        ...r,
        items: has
          ? r.items.map((i) => (i.cid === c.id ? { ...i, qty: Number(i.qty) + 1 } : i))
          : [...r.items, { cid: c.id, name_ar: c.name_ar, name_en: c.name_en, unit: c.unit, qty: 1 }],
      };
    }));
  const setQty = (rid: string, idx: number, qty: number) =>
    setRooms(rooms.map((r) => (r.id === rid ? { ...r, items: r.items.map((i, j) => (j === idx ? { ...i, qty: Math.max(0, qty) } : i)) } : r)));
  const delItem = (rid: string, idx: number) =>
    setRooms(rooms.map((r) => (r.id === rid ? { ...r, items: r.items.filter((_, j) => j !== idx) } : r)));
  const delRoom = (r: Room) => {
    if (r.items.length && !window.confirm(t(`حذف "${r.name || roomWord(sec)}" وكل أجهزتها؟`, `Delete "${r.name || roomWord(sec)}" and all its devices?`))) return;
    setRooms(rooms.filter((x) => x.id !== r.id));
  };

  const floors = useMemo(() => [...new Set(SECTIONS.flatMap((s) => data[s].map((r) => r.floor)).filter(Boolean))], [data]);
  const secCat = catalog.filter((c) => c.section === sec);
  const tot = totals(rooms);
  const grouped = (list: CatItem[]) => {
    const m = new Map<string, CatItem[]>();
    list.forEach((c) => m.set(grp(c), [...(m.get(grp(c)) ?? []), c]));
    return [...m.entries()];
  };

  return (
    <div className="space-y-3">
      <div className={card + ' space-y-3'}>
        <h2 className="font-bold">{t('المعاينة', 'Site survey')}</h2>
        <L t={t('اسم العميل', 'Customer name')}>
          <input className={inp} value={customer} onChange={(e) => { setCustomer(e.target.value); setDirty(true); draft(e.target.value, data); }} />
        </L>
        <div className="grid grid-cols-3 gap-2">
          {SECTIONS.map((s) => {
            const Icon = secIcon[s];
            return (
              <button key={s} type="button" onClick={() => { setSec(s); setPick(null); }}
                className={`flex flex-col items-center gap-1 rounded-xl border py-2 text-xs ${sec === s ? 'border-brand bg-brand/15 text-brand' : 'border-navy-600'}`}>
                <Icon size={20} />
                {secLabel(s)}
                <span className="text-[10px] text-fg/60">{data[s].length}</span>
              </button>
            );
          })}
        </div>
      </div>

      <datalist id="floors">
        {[t('الدور الأرضي', 'Ground floor'), t('الدور الأول', 'First floor'), t('الدور الثاني', 'Second floor'), t('الدور الثالث', 'Third floor'), t('البدروم', 'Basement'), t('السطح', 'Roof'), ...floors].map((f) => (<option key={f} value={f} />))}
      </datalist>

      {rooms.map((r) => (
        <div key={r.id} className={card + ' space-y-3'}>
          <div className="flex gap-2">
            <input className={inp} placeholder={`${roomWord(sec)} — ${t('الاسم', 'name')}`} value={r.name} onChange={(e) => upd(r.id, { name: e.target.value })} />
            <input list="floors" className={inp} placeholder={t('الدور', 'Floor')} value={r.floor} onChange={(e) => upd(r.id, { floor: e.target.value })} />
            <button type="button" aria-label={t('حذف', 'Delete')} onClick={() => delRoom(r)} className="rounded-xl border border-red-300/50 px-3 text-red-200"><Trash2 size={16} /></button>
          </div>

          {sec === 'smart_home' && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                {STYLES.map((s) => (
                  <button key={s} type="button" onClick={() => upd(r.id, { style: s, ...(s === 'zigbee' && !r.hubs ? { hubs: 1 } : {}), ...(s === 'panel' && !r.panel ? { panel: { l: 0, w: 0, d: 0 } } : {}) })}
                    className={`rounded-xl border px-1 py-2 text-xs ${r.style === s ? 'border-brand bg-brand/15 text-brand' : 'border-navy-600'}`}>
                    {styleLabel(s)}
                  </button>
                ))}
              </div>
              {r.style && <p className="text-xs text-fg/60">{styleHint(r.style)}</p>}
              {r.style === 'zigbee' && (
                <L t={t('عدد الهابات المطلوبة', 'Hubs needed')}>
                  <input type="number" min={1} className={inp} value={r.hubs ?? 1} onChange={(e) => upd(r.id, { hubs: Number(e.target.value) })} />
                </L>
              )}
              {r.style === 'panel' && (
                <div className="grid grid-cols-3 gap-2">
                  {([['l', t('الطول (سم)', 'Length (cm)')], ['w', t('العرض (سم)', 'Width (cm)')], ['d', t('العمق (سم)', 'Depth (cm)')]] as const).map(([k, lab]) => (
                    <L key={k} t={lab}>
                      <input type="number" min={0} step="any" className={inp} value={r.panel?.[k] ?? 0}
                        onChange={(e) => upd(r.id, { panel: { l: 0, w: 0, d: 0, ...r.panel, [k]: Number(e.target.value) } })} />
                    </L>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            {r.items.map((i, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 rounded-xl bg-navy-800 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1">{nm(i)}</span>
                <span className="flex items-center gap-1">
                  <button type="button" onClick={() => setQty(r.id, idx, Number(i.qty) - 1)} className="rounded-lg border border-navy-600 p-1"><Minus size={14} /></button>
                  <input type="number" min={0} step="any" className="w-16 rounded-lg border border-navy-600 bg-navy-900 px-1 py-1 text-center" value={i.qty}
                    onChange={(e) => setQty(r.id, idx, Number(e.target.value))} />
                  <button type="button" onClick={() => setQty(r.id, idx, Number(i.qty) + 1)} className="rounded-lg border border-navy-600 p-1"><Plus size={14} /></button>
                  <span className="w-5 text-xs text-fg/60">{unitLabel(i.unit)}</span>
                  <button type="button" aria-label={t('حذف', 'Delete')} onClick={() => delItem(r.id, idx)} className="p-1 text-red-300"><Trash2 size={14} /></button>
                </span>
              </div>
            ))}
          </div>

          {pick === r.id ? (
            <div className="space-y-2 rounded-xl border border-brand/40 p-2">
              <input autoFocus className={inp} placeholder={t('ابحث عن جهاز...', 'Search devices...')} value={q} onChange={(e) => setQ(e.target.value)} />
              {!secCat.length && <p className="text-sm text-fg/60">{t('الكتالوج فاضي — المالك بيضيف الأجهزة من الإعدادات.', 'The catalog is empty — the owner adds devices in Settings.')}</p>}
              {grouped(secCat.filter((c) => (nm(c) + c.name_ar + c.name_en).toLowerCase().includes(q.toLowerCase()))).map(([g, list]) => (
                <div key={g}>
                  <div className="mb-1 text-xs text-fg/60">{g}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {list.map((c) => {
                      const n = r.items.find((i) => i.cid === c.id)?.qty;
                      return (
                        <button key={c.id} type="button" onClick={() => addItem(r.id, c)}
                          className={`rounded-full border px-3 py-1 text-xs ${n ? 'border-brand bg-brand/15 text-brand' : 'border-navy-600'}`}>
                          + {nm(c)}{n ? ` (${n})` : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => { setPick(null); setQ(''); }} className="w-full rounded-xl border border-navy-600 py-2 text-sm">{t('تم', 'Done')}</button>
            </div>
          ) : (
            <button type="button" onClick={() => { setPick(r.id); setQ(''); }} className="flex items-center gap-1 text-sm text-brand"><Plus size={16} /> {t('إضافة جهاز', 'Add device')}</button>
          )}
          {roomDetail(sec, r) && <p className="text-xs text-fg/60">{roomDetail(sec, r)}</p>}
        </div>
      ))}

      <button type="button" onClick={addRoom} className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-brand py-3 text-brand">
        <Plus size={16} /> {t('إضافة', 'Add')} {roomWord(sec)}
      </button>

      {tot.length > 0 && (
        <div className={card + ' space-y-1 text-sm'}>
          <b>{t('إجمالي', 'Total —')} {secLabel(sec)}</b>
          {tot.map((x) => (
            <div key={x.key} className="flex justify-between"><span>{x.name}</span><span className="font-bold text-brand">{x.qty} {unitLabel(x.unit)}</span></div>
          ))}
        </div>
      )}

      <div className={card + ' space-y-2'}>
        <L t={t('ملاحظات المعاينة', 'Survey notes')}>
          <textarea rows={3} className={inp} value={data.notes} onChange={(e) => edit((d) => ({ ...d, notes: e.target.value }))} />
        </L>
        {msg && <p className="text-sm text-brand">{msg}</p>}
        <button type="button" disabled={busy} onClick={save} className={btn + ' w-full'}>
          {busy ? t('جاري الحفظ...', 'Saving...') : dirty ? t('حفظ المعاينة', 'Save survey') + ' •' : t('حفظ المعاينة', 'Save survey')}
        </button>
      </div>
    </div>
  );
}
