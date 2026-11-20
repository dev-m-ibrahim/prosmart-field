import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { History, PackagePlus, Pencil, Plus, ScanBarcode, Trash2 } from 'lucide-react';
import { t } from '../i18n';
import { useAuth } from '../auth';
import { supabase } from '../lib/supabase';
import Scanner from '../components/Scanner';
import CategoryPicker from '../components/CategoryPicker';
import CategoryManager from '../components/CategoryManager';
import { childrenOf, loadCats, pathOf, withDescendants, type Cat } from '../lib/categories';
import { L, btn, card, fmt, inp } from '../ui';

interface Bal {
  product_id: string;
  name: string;
  model: string | null;
  barcode: string | null;
  brand?: string | null;
  category?: string | null;
  category_id?: string | null;
  category_path?: string | null;
  min_stock: number;
  balance: number;
  track_serial?: boolean;
}

export default function Stock() {
  const [rows, setRows] = useState<Bal[]>([]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [catId, setCatId] = useState<string | null>(null);
  const [cats, setCats] = useState<Cat[]>([]);
  const [manage, setManage] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [hist, setHist] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const { profile } = useAuth();
  const canEdit = profile?.role === 'admin' || !!profile?.is_owner; // owner + admin only
  const [msg, setMsg] = useState('');
  const remove = async (r: Bal) => {
    if (!confirm(`حذف "${r.name}" نهائيًا من المخزن؟`)) return;
    const { error } = await supabase.from('products').delete().eq('id', r.product_id);
    if (error) setMsg(error.code === '23503' ? 'المنتج عليه حركات مخزون، مينفعش يتحذف.' : error.message);
    else {
      setMsg('');
      load();
    }
  };

  const load = useCallback(async () => {
    const { data } = await supabase.from('stock_balance').select('*').order('name');
    setRows((data ?? []) as Bal[]);
    setCats(await loadCats());
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const ids = catId ? withDescendants(cats, catId) : null;
  const shown = rows.filter(
    (r) => (!ids || (!!r.category_id && ids.has(r.category_id))) && (r.name + (r.model ?? '') + (r.barcode ?? '') + (r.category_path ?? r.category ?? '')).toLowerCase().includes(q.toLowerCase()),
  );
  const chain = pathOf(cats, catId);
  const chipRows: { parent: string | null; items: Cat[]; active: string | null }[] = [];
  for (let i = 0; i <= chain.length; i++) {
    const parent = i === 0 ? null : chain[i - 1].id;
    const items = childrenOf(cats, parent);
    if (!items.length) break;
    chipRows.push({ parent, items, active: chain[i]?.id ?? null });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">المخزن</h1>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button className="rounded-xl border border-navy-600 px-3 py-2.5 text-sm" onClick={() => setManage(!manage)}>الفئات</button>
          )}
          <button aria-label={t('سجل التوريد', 'Receipts log')} className="rounded-xl border border-navy-600 px-3 py-2.5" onClick={() => setHist(!hist)}>
            <History size={16} />
          </button>
          <button className={btn + ' flex items-center gap-1'} onClick={() => setOpen(!open)}>
            <Plus size={16} />
            استلام بضاعة
          </button>
        </div>
      </div>
      {manage && canEdit && <CategoryManager cats={cats} reload={load} />}
      {hist && <Receipts />}
      {open && (
        <Receive
          cats={cats}
          reloadCats={async () => setCats(await loadCats())}
          onDone={() => {
            setOpen(false);
            load();
          }}
        />
      )}
      <input className={inp + ' mb-3'} placeholder="بحث بالاسم أو الموديل أو الباركود" value={q} onChange={(e) => setQ(e.target.value)} />
      {chipRows.map((row, i) => (
        <div key={i} className="mb-2 flex gap-2 overflow-x-auto pb-1">
          {[{ id: row.parent, name: 'الكل' }, ...row.items].map((c) => {
            const isAll = c.id === row.parent;
            const on = isAll ? row.active === null : row.active === c.id;
            return (
              <button key={c.id ?? 'all'} onClick={() => setCatId(c.id)}
                className={`whitespace-nowrap rounded-full border px-3 py-1 text-sm ${on ? 'border-brand bg-brand text-on-brand' : 'border-navy-600'}`}>
                {c.name}
              </button>
            );
          })}
        </div>
      ))}
      {msg && <p className="mb-2 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">{msg}</p>}
      <div className="space-y-2">
        {shown.map((r) => (
          <div key={r.product_id} className={card + ' space-y-2'}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <b>{r.name}</b>
                {(r.category_path || r.category) && <span className="ms-2 rounded-full bg-navy-700 px-2 py-0.5 text-xs">{r.category_path || r.category}</span>}
                <div className="text-xs text-fg/60" dir="ltr">
                  {[r.model, r.barcode].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setAdding(adding === r.product_id ? null : r.product_id)} className="flex items-center gap-1 rounded-lg border border-brand px-2 py-1.5 text-xs text-brand">
                  <PackagePlus size={14} /> {t('زوّد', 'Add')}
                </button>
                {canEdit && (
                  <>
                    <button aria-label="تعديل" onClick={() => setEditing(editing === r.product_id ? null : r.product_id)} className="rounded-lg border border-navy-600 p-1.5">
                      <Pencil size={14} />
                    </button>
                    <button aria-label="حذف" onClick={() => remove(r)} className="rounded-lg border border-red-300/50 p-1.5 text-red-200">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
                <span className={`rounded-lg px-3 py-1 font-bold ${Number(r.balance) <= Number(r.min_stock) ? 'bg-red-500/20 text-red-200' : 'bg-brand/15 text-brand'}`}>
                  {Number(r.balance)}
                </span>
              </div>
            </div>
            {adding === r.product_id && <AddQty row={r} onDone={() => { setAdding(null); load(); }} />}
            {editing === r.product_id && (
              <EditProduct row={r} cats={cats} reloadCats={async () => setCats(await loadCats())} onDone={() => { setEditing(null); load(); }} />
            )}
          </div>
        ))}
        {!shown.length && <p className="text-fg/50">مفيش منتجات.</p>}
      </div>
    </div>
  );
}

const blank = { barcode: '', name: '', brand: '', model: '', category_id: null as string | null, track_serial: false, qty: 1, serials: '', ref: '' };

function Receive({ onDone, cats, reloadCats }: { onDone: () => void; cats: Cat[]; reloadCats: () => void | Promise<void> }) {
  const [f, setF] = useState(blank);
  const [scan, setScan] = useState<'barcode' | 'serial' | null>(null);
  const [known, setKnown] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const lookup = async (code: string) => {
    if (!code) return;
    const { data } = await supabase.from('products').select('*').eq('barcode', code).maybeSingle();
    if (data) {
      setKnown(data.id);
      setF((x) => ({ ...x, barcode: code, name: data.name, brand: data.brand ?? '', model: data.model ?? '', category_id: data.category_id ?? null, track_serial: data.track_serial }));
    } else {
      setKnown(null);
      setF((x) => ({ ...x, barcode: code }));
    }
  };

  const onScan = (v: string) => {
    if (scan === 'barcode') lookup(v);
    else setF((x) => ({ ...x, serials: (x.serials ? x.serials + '\n' : '') + v }));
    setScan(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    let pid = known;
    if (!pid) {
      const { data, error } = await supabase
        .from('products')
        .insert({ name: f.name, brand: f.brand || null, model: f.model || null, category_id: f.category_id, barcode: f.barcode || null, track_serial: f.track_serial })
        .select('id')
        .single();
      if (error || !data) {
        setErr(error?.message ?? 'حصل خطأ');
        setBusy(false);
        return;
      }
      pid = data.id;
    }
    // receipt header: where this delivery came from (invoice / supplier / job) — optional, kept for the log
    const { data: rc } = await supabase.from('stock_receipts').insert({ ref: f.ref.trim() || null }).select('id').single();
    const rx = rc?.id ? { receipt_id: rc.id } : {};
    if (f.track_serial) {
      const list = [...new Set(f.serials.split('\n').map((s) => s.trim()).filter(Boolean))];
      if (!list.length) {
        setErr('اكتب أو امسح سيريال واحد على الأقل');
        setBusy(false);
        return;
      }
      for (const sn of list) {
        const { data: it, error: e1 } = await supabase.from('stock_items').insert({ product_id: pid, serial_number: sn }).select('id').single();
        if (e1 || !it) {
          setErr(`السيريال ${sn}: ${e1?.message}`);
          setBusy(false);
          return;
        }
        await supabase.from('stock_movements').insert({ product_id: pid, stock_item_id: it.id, type: 'in', quantity: 1, ...rx });
      }
    } else {
      await supabase.from('stock_movements').insert({ product_id: pid, type: 'in', quantity: f.qty, ...rx });
    }
    setBusy(false);
    onDone();
  };

  return (
    <form onSubmit={submit} className={card + ' mb-4 space-y-3'}>
      {scan && <Scanner onResult={onScan} onClose={() => setScan(null)} />}
      <L t="الباركود">
        <div className="flex gap-2">
          <input dir="ltr" className={inp} value={f.barcode} onChange={set('barcode')} onBlur={() => lookup(f.barcode)} />
          <button type="button" onClick={() => setScan('barcode')} className="rounded-xl border border-brand px-3 text-brand">
            <ScanBarcode />
          </button>
        </div>
      </L>
      {known && <p className="text-sm text-brand">منتج موجود، هتزود على رصيده.</p>}
      <L t="اسم المنتج">
        <input required readOnly={!!known} className={inp} value={f.name} onChange={set('name')} />
      </L>
      <div className="grid grid-cols-2 gap-3">
        <L t="الماركة">
          <input readOnly={!!known} className={inp} value={f.brand} onChange={set('brand')} />
        </L>
        <L t="الموديل">
          <input readOnly={!!known} dir="ltr" className={inp} value={f.model} onChange={set('model')} />
        </L>
      </div>
      <L t="الفئة">
        <CategoryPicker cats={cats} value={f.category_id} disabled={!!known} onChange={(id) => setF((x) => ({ ...x, category_id: id }))} onAdded={reloadCats} />
      </L>
      {!known && (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={f.track_serial} onChange={(e) => setF({ ...f, track_serial: e.target.checked })} />
          له سيريال نمبر (كل قطعة بسيريال)
        </label>
      )}
      {f.track_serial ? (
        <L t="السيريالات (واحد في كل سطر)">
          <textarea rows={4} dir="ltr" className={inp} value={f.serials} onChange={set('serials')} />
          <button type="button" onClick={() => setScan('serial')} className="mt-1 flex items-center gap-1 text-sm text-brand">
            <ScanBarcode size={16} /> مسح سيريال
          </button>
        </L>
      ) : (
        <L t="الكمية">
          <input type="number" min={1} step="any" className={inp} value={f.qty} onChange={(e) => setF({ ...f, qty: Number(e.target.value) })} />
        </L>
      )}
      <L t={t('المصدر (فاتورة / مورد / اسم الشغل) — اختياري', 'Source (invoice / supplier / job) — optional')}>
        <input className={inp} value={f.ref} onChange={set('ref')} />
      </L>
      {err && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">{err}</p>}
      <button disabled={busy} className={btn + ' w-full'}>
        {busy ? 'جاري الحفظ...' : 'حفظ في المخزن'}
      </button>
    </form>
  );
}

function EditProduct({ row, cats, reloadCats, onDone }: { row: Bal; cats: Cat[]; reloadCats: () => void | Promise<void>; onDone: () => void }) {
  const [f, setF] = useState({ name: row.name, brand: row.brand ?? '', model: row.model ?? '', category_id: (row.category_id ?? null) as string | null, barcode: row.barcode ?? '', min_stock: Number(row.min_stock ?? 0) });
  const [err, setErr] = useState('');
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('products').update({
      name: f.name, brand: f.brand || null, model: f.model || null, category_id: f.category_id, barcode: f.barcode || null, min_stock: f.min_stock,
    }).eq('id', row.product_id);
    if (error) return setErr(error.message);
    onDone();
  };
  return (
    <form onSubmit={save} className="space-y-2 rounded-xl bg-navy-800 p-3">
      <L t="الاسم"><input required className={inp} value={f.name} onChange={set('name')} /></L>
      <div className="grid grid-cols-2 gap-2">
        <L t="الماركة"><input className={inp} value={f.brand} onChange={set('brand')} /></L>
        <L t="الموديل"><input dir="ltr" className={inp} value={f.model} onChange={set('model')} /></L>
      </div>
      <L t="الفئة">
        <CategoryPicker cats={cats} value={f.category_id} onChange={(id) => setF((x) => ({ ...x, category_id: id }))} onAdded={reloadCats} />
      </L>
      <div className="grid grid-cols-2 gap-2">
        <L t="الباركود / QR"><input dir="ltr" className={inp} value={f.barcode} onChange={set('barcode')} /></L>
        <L t="حد التنبيه (أقل كمية)"><input type="number" min={0} className={inp} value={f.min_stock} onChange={(e) => setF({ ...f, min_stock: Number(e.target.value) })} /></L>
      </div>
      {err && <p className="text-sm text-red-200">{err}</p>}
      <button className={btn + ' w-full'}>حفظ التعديل</button>
    </form>
  );
}

// Add quantity to an existing product. The balance is never typed in directly: every increase is a stock movement
// (with an optional source), so the history stays traceable.
function AddQty({ row, onDone }: { row: Bal; onDone: () => void }) {
  const [qty, setQty] = useState(1);
  const [ref, setRef] = useState('');
  const [serials, setSerials] = useState('');
  const [scan, setScan] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const tracked = !!row.track_serial;
  const list = [...new Set(serials.split('\n').map((s) => s.trim()).filter(Boolean))];
  const n = tracked ? list.length : qty;

  const submit = async () => {
    if (!(n >= 1) || (!tracked && !Number.isInteger(qty))) return setErr(tracked ? t('اكتب أو امسح سيريال واحد على الأقل', 'Type or scan at least one serial') : t('الكمية غلط', 'Invalid quantity'));
    if (n >= 100 && !window.confirm(t(`هتزود ${n} قطعة على "${row.name}". متأكد؟`, `Add ${n} units to "${row.name}". Are you sure?`))) return;
    setBusy(true);
    setErr('');
    const { data: rc } = await supabase.from('stock_receipts').insert({ ref: ref.trim() || null }).select('id').single();
    const rx = rc?.id ? { receipt_id: rc.id } : {};
    if (tracked) {
      for (const sn of list) {
        const { data: it, error: e1 } = await supabase.from('stock_items').insert({ product_id: row.product_id, serial_number: sn }).select('id').single();
        if (e1 || !it) { setErr(`${sn}: ${e1?.message}`); setBusy(false); return; }
        const { error: e2 } = await supabase.from('stock_movements').insert({ product_id: row.product_id, stock_item_id: it.id, type: 'in', quantity: 1, ...rx });
        if (e2) { setErr(e2.message); setBusy(false); return; }
      }
    } else {
      const { error } = await supabase.from('stock_movements').insert({ product_id: row.product_id, type: 'in', quantity: qty, ...rx });
      if (error) { setErr(error.message); setBusy(false); return; }
    }
    setBusy(false);
    onDone();
  };

  return (
    <div className="space-y-2 rounded-xl bg-navy-800 p-3">
      {scan && <Scanner onResult={(v) => { setSerials((s) => (s ? s + '\n' : '') + v); setScan(false); }} onClose={() => setScan(false)} />}
      {tracked ? (
        <L t="السيريالات (واحد في كل سطر)">
          <textarea rows={3} dir="ltr" className={inp} value={serials} onChange={(e) => setSerials(e.target.value)} />
          <button type="button" onClick={() => setScan(true)} className="mt-1 flex items-center gap-1 text-sm text-brand"><ScanBarcode size={16} /> مسح سيريال</button>
        </L>
      ) : (
        <L t={t('الكمية اللي دخلت', 'Quantity received')}>
          <input type="number" min={1} step={1} className={inp} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
        </L>
      )}
      <L t={t('المصدر (فاتورة / مورد / اسم الشغل) — اختياري', 'Source (invoice / supplier / job) — optional')}>
        <input className={inp} value={ref} onChange={(e) => setRef(e.target.value)} />
      </L>
      <p className="text-sm text-fg/70">
        {t('الرصيد بعد الإضافة', 'Balance after adding')}: {Number(row.balance)} → <b className="text-brand">{Number(row.balance) + (n > 0 ? n : 0)}</b>
      </p>
      {err && <p className="text-sm text-red-200">{err}</p>}
      <button disabled={busy} onClick={submit} className={btn + ' w-full'}>{busy ? 'جاري الحفظ...' : t('تأكيد الإضافة', 'Confirm addition')}</button>
    </div>
  );
}

interface Rcpt {
  id: string;
  ref: string | null;
  created_at: string;
  profiles: { full_name: string } | null;
  stock_movements: { quantity: number; products: { name: string } | null }[];
}

// Who added what, when, and from which source.
function Receipts() {
  const [rows, setRows] = useState<Rcpt[] | null>(null);
  useEffect(() => {
    supabase
      .from('stock_receipts')
      .select('id,ref,created_at,profiles(full_name),stock_movements(quantity,products(name))')
      .order('created_at', { ascending: false })
      .limit(40)
      .then(({ data }) => setRows((data ?? []) as unknown as Rcpt[]));
  }, []);
  return (
    <div className={card + ' mb-4 space-y-2 text-sm'}>
      <b>{t('سجل التوريد (آخر 40)', 'Receipts log (last 40)')}</b>
      {rows === null && <p className="text-fg/60">جاري التحميل...</p>}
      {rows?.map((r) => {
        const sum = new Map<string, number>();
        r.stock_movements.forEach((m) => sum.set(m.products?.name ?? '—', (sum.get(m.products?.name ?? '—') ?? 0) + Number(m.quantity)));
        return (
          <div key={r.id} className="rounded-xl bg-navy-800 p-2">
            <div className="flex justify-between text-xs text-fg/60">
              <span>{fmt(r.created_at)}</span>
              <span>{r.profiles?.full_name ?? ''}</span>
            </div>
            {r.ref && <div className="text-amber-200">{r.ref}</div>}
            <div>{[...sum.entries()].map(([n, q]) => `${n} × ${q}`).join(' · ') || '—'}</div>
          </div>
        );
      })}
      {rows?.length === 0 && <p className="text-fg/50">{t('مفيش عمليات توريد مسجلة لسه.', 'No receipts recorded yet.')}</p>}
    </div>
  );
}
