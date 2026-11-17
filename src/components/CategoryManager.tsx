import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { addCat, childrenOf, type Cat } from '../lib/categories';
import { card } from '../ui';

// إدارة شجرة الفئات (للمالك والإداري): إضافة فرع، تغيير اسم، حذف (لو فاضية)
export default function CategoryManager({ cats, reload }: { cats: Cat[]; reload: () => void | Promise<void> }) {
  const [msg, setMsg] = useState('');

  const add = async (parent: string | null) => {
    const n = window.prompt('اسم الفئة الجديدة:');
    if (!n?.trim()) return;
    const r = await addCat(parent, n);
    setMsg(r.error ?? '');
    reload();
  };
  const rename = async (c: Cat) => {
    const n = window.prompt('الاسم الجديد:', c.name);
    if (!n?.trim() || n.trim() === c.name) return;
    const { error } = await supabase.from('categories').update({ name: n.trim() }).eq('id', c.id);
    setMsg(error ? (error.code === '23505' ? 'الاسم ده موجود في نفس المكان' : error.message) : '');
    reload();
  };
  const del = async (c: Cat) => {
    if (!window.confirm(`حذف الفئة "${c.name}"؟`)) return;
    const { error } = await supabase.from('categories').delete().eq('id', c.id);
    setMsg(error ? (error.code === '23503' ? `"${c.name}" فيها منتجات أو فئات فرعية، انقلها أو احذفها الأول.` : error.message) : '');
    reload();
  };

  const Node = ({ c, depth }: { c: Cat; depth: number }) => (
    <div>
      <div className="flex items-center justify-between gap-2 py-1" style={{ paddingInlineStart: depth * 16 }}>
        <span className={depth === 0 ? 'font-bold' : ''}>{c.name}</span>
        <span className="flex gap-1">
          <button aria-label="فرع جديد" onClick={() => add(c.id)} className="rounded-lg border border-navy-600 p-1"><Plus size={14} /></button>
          <button aria-label="تعديل الاسم" onClick={() => rename(c)} className="rounded-lg border border-navy-600 p-1"><Pencil size={14} /></button>
          <button aria-label="حذف" onClick={() => del(c)} className="rounded-lg border border-red-300/50 p-1 text-red-200"><Trash2 size={14} /></button>
        </span>
      </div>
      {childrenOf(cats, c.id).map((k) => (<Node key={k.id} c={k} depth={depth + 1} />))}
    </div>
  );

  return (
    <div className={card + ' mb-4 space-y-1 text-sm'}>
      <div className="mb-1 flex items-center justify-between">
        <b>شجرة الفئات</b>
        <button onClick={() => add(null)} className="flex items-center gap-1 text-brand"><Plus size={14} /> فئة رئيسية</button>
      </div>
      {msg && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-red-200">{msg}</p>}
      {childrenOf(cats, null).map((c) => (<Node key={c.id} c={c} depth={0} />))}
      {!cats.length && <p className="text-fg/50">لسه مفيش فئات.</p>}
    </div>
  );
}
