import { useState } from 'react';
import { Plus } from 'lucide-react';
import { addCat, childrenOf, pathOf, type Cat } from '../lib/categories';
import { inp } from '../ui';

// اختيار متدرج: كل ما تختار مستوى بيظهر اللي بعده (لو ليه فروع). تقدر توقف في أي مستوى.
export default function CategoryPicker({
  cats, value, onChange, onAdded, disabled,
}: {
  cats: Cat[];
  value: string | null;
  onChange: (id: string | null) => void;
  onAdded: () => void | Promise<void>;
  disabled?: boolean;
}) {
  const path = pathOf(cats, value);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [err, setErr] = useState('');

  const levels: { options: Cat[]; selected: string }[] = [];
  for (let i = 0; i <= path.length; i++) {
    const options = childrenOf(cats, i === 0 ? null : path[i - 1].id);
    if (!options.length) break;
    levels.push({ options, selected: path[i]?.id ?? '' });
  }

  const add = async () => {
    if (!name.trim()) return;
    const r = await addCat(value, name);
    if (r.error) return setErr(r.error);
    setErr('');
    setName('');
    setAdding(false);
    await onAdded();
    if (r.id) onChange(r.id);
  };

  return (
    <div className="space-y-2">
      {levels.map((lv, i) => (
        <select key={i} disabled={disabled} className={inp} value={lv.selected}
          onChange={(e) => onChange(e.target.value || (i === 0 ? null : path[i - 1].id))}>
          <option value="">{i === 0 ? '— اختار الفئة —' : '— (من غير تحديد أدق) —'}</option>
          {lv.options.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
        </select>
      ))}
      {!disabled && !adding && (
        <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1 text-sm text-brand">
          <Plus size={14} /> فئة جديدة{path.length ? ` تحت "${path[path.length - 1].name}"` : ''}
        </button>
      )}
      {adding && (
        <div className="flex gap-2">
          <input autoFocus className={inp} placeholder="اسم الفئة" value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
          <button type="button" onClick={add} className="rounded-xl bg-brand px-3 font-bold text-on-brand">إضافة</button>
          <button type="button" onClick={() => { setAdding(false); setErr(''); }} className="rounded-xl border border-navy-600 px-3">إلغاء</button>
        </div>
      )}
      {err && <p className="text-sm text-red-200">{err}</p>}
    </div>
  );
}
