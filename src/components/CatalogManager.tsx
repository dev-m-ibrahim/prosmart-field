import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { t } from '../i18n';
import { btn, card, inp } from '../ui';
import { SECTIONS, grp, loadCatalog, nm, secLabel, type CatItem, type Section } from '../lib/survey';

type Draft = Pick<CatItem, 'grp_ar' | 'grp_en' | 'name_ar' | 'name_en' | 'unit'>;
const blank: Draft = { grp_ar: '', grp_en: '', name_ar: '', name_en: '', unit: 'pcs' };

// Owner (or anyone the owner authorised): add / edit / delete the devices offered in site surveys.
export default function CatalogManager() {
  const [items, setItems] = useState<CatItem[]>([]);
  const [sec, setSec] = useState<Section>('smart_home');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [f, setF] = useState<Draft>(blank);
  const [msg, setMsg] = useState('');
  const load = useCallback(async () => setItems(await loadCatalog()), []);
  useEffect(() => { load(); }, [load]);

  const list = items.filter((i) => i.section === sec);
  const groups = [...new Map<string, string>(list.map((i) => [i.grp_ar, i.grp_en] as [string, string])).entries()];

  const open = (it?: CatItem) => {
    setMsg('');
    setEditing(it ? it.id : 'new');
    setF(it ? { grp_ar: it.grp_ar, grp_en: it.grp_en, name_ar: it.name_ar, name_en: it.name_en, unit: it.unit } : { ...blank });
  };
  const save = async () => {
    if (!f.name_ar.trim()) return setMsg(t('اكتب اسم الجهاز بالعربي', 'Enter the Arabic name'));
    const row = {
      grp_ar: f.grp_ar.trim() || 'أخرى', grp_en: f.grp_en.trim() || f.grp_ar.trim() || 'Other',
      name_ar: f.name_ar.trim(), name_en: f.name_en.trim() || f.name_ar.trim(), unit: f.unit,
    };
    const { error } = editing === 'new'
      ? await supabase.from('survey_catalog').insert({ ...row, section: sec, sort: (items.reduce((m, i) => Math.max(m, i.sort), 0) || 0) + 1 })
      : await supabase.from('survey_catalog').update(row).eq('id', editing!);
    if (error) return setMsg(error.message);
    setEditing(null);
    load();
  };
  const del = async (it: CatItem) => {
    if (!window.confirm(t(`حذف "${it.name_ar}" من الكتالوج؟ (المعاينات القديمة مش هتتأثر)`, `Delete "${it.name_en || it.name_ar}" from the catalog? (Past surveys are not affected)`))) return;
    const { error } = await supabase.from('survey_catalog').delete().eq('id', it.id);
    setMsg(error ? error.message : '');
    load();
  };
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value } as Draft);

  const form = (
    <div className="space-y-2 rounded-xl bg-navy-800 p-3">
      <div className="grid grid-cols-2 gap-2">
        <input className={inp} placeholder={t('الاسم بالعربي', 'Arabic name')} value={f.name_ar} onChange={set('name_ar')} />
        <input className={inp} dir="ltr" placeholder="English name" value={f.name_en} onChange={set('name_en')} />
        <input className={inp} list="cat-groups" placeholder={t('المجموعة (عربي)', 'Group (Arabic)')} value={f.grp_ar}
          onChange={(e) => { const g = groups.find(([a]) => a === e.target.value); setF({ ...f, grp_ar: e.target.value, grp_en: g ? g[1] : f.grp_en }); }} />
        <input className={inp} dir="ltr" placeholder="Group (English)" value={f.grp_en} onChange={set('grp_en')} />
      </div>
      <datalist id="cat-groups">{groups.map(([a]) => (<option key={a} value={a} />))}</datalist>
      <select className={inp} value={f.unit} onChange={set('unit')}>
        <option value="pcs">{t('بالقطعة', 'Per piece')}</option>
        <option value="m">{t('بالمتر', 'Per metre')}</option>
      </select>
      <div className="flex gap-2">
        <button onClick={save} className={btn + ' flex-1'}>{t('حفظ', 'Save')}</button>
        <button onClick={() => setEditing(null)} className="flex-1 rounded-xl border border-navy-600">{t('إلغاء', 'Cancel')}</button>
      </div>
    </div>
  );

  return (
    <div className={card + ' space-y-3'}>
      <h2 className="font-bold">{t('كتالوج أجهزة المعاينة', 'Survey device catalog')}</h2>
      <div className="grid grid-cols-3 gap-2">
        {SECTIONS.map((s) => (
          <button key={s} onClick={() => { setSec(s); setEditing(null); }}
            className={`rounded-xl border py-2 text-xs ${sec === s ? 'border-brand bg-brand/15 text-brand' : 'border-navy-600'}`}>{secLabel(s)}</button>
        ))}
      </div>
      {msg && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">{msg}</p>}
      {groups.map(([ga, ge]) => (
        <div key={ga}>
          <div className="mb-1 text-xs text-fg/60">{grp({ grp_ar: ga, grp_en: ge })}</div>
          {list.filter((i) => i.grp_ar === ga).map((it) => (
            <div key={it.id}>
              <div className="flex items-center justify-between py-1 text-sm">
                <span>{nm(it)}{it.unit === 'm' ? ` (${t('متر', 'm')})` : ''}</span>
                <span className="flex gap-1">
                  <button aria-label={t('تعديل', 'Edit')} onClick={() => (editing === it.id ? setEditing(null) : open(it))} className="rounded-lg border border-navy-600 p-1"><Pencil size={14} /></button>
                  <button aria-label={t('حذف', 'Delete')} onClick={() => del(it)} className="rounded-lg border border-red-300/50 p-1 text-red-200"><Trash2 size={14} /></button>
                </span>
              </div>
              {editing === it.id && form}
            </div>
          ))}
        </div>
      ))}
      {!list.length && <p className="text-sm text-fg/50">{t('القسم فاضي.', 'This section is empty.')}</p>}
      {editing === 'new' ? form : (
        <button onClick={() => open()} className="flex items-center gap-1 text-sm text-brand"><Plus size={16} /> {t('جهاز جديد في', 'New device in')} {secLabel(sec)}</button>
      )}
    </div>
  );
}
