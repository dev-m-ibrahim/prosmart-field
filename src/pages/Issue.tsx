import { useCallback, useEffect, useState } from 'react';
import { Check, ScanBarcode, X } from 'lucide-react';
import { useAuth } from '../auth';
import { supabase } from '../lib/supabase';
import Scanner from '../components/Scanner';
import { btn, card, fmt, inp } from '../ui';

interface Bal { product_id: string; name: string; model: string | null; barcode: string | null; balance: number }
interface Ord { id: string; order_no: number; client_name: string; status: string }
interface Line { pid: string; name: string; qty: number; items: { id: string; sn: string }[] }
interface Out { name: string; issued: number; installed: number; returned: number }

interface Req {
  id: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  note: string | null;
  reject_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  order_no: number;
  client: string;
  by: string | null;
  mine: boolean;
  lines: { product: string; model: string | null; serial: string | null; qty: number }[];
}

const reqStatus: Record<Req['status'], { label: string; cls: string }> = {
  pending: { label: 'مستني موافقة مدير المخزن', cls: 'bg-amber-400/15 text-amber-200' },
  approved: { label: 'تمت الموافقة ✓', cls: 'bg-brand/15 text-brand' },
  rejected: { label: 'مرفوض', cls: 'bg-red-500/15 text-red-200' },
  cancelled: { label: 'ملغي', cls: 'bg-navy-700 text-fg/70' },
};

// Issue stock to a work order. Anyone (admin / storekeeper) can ask; only the stock manager approves.
export default function Issue() {
  const { isStockManager } = useAuth();
  const [tab, setTab] = useState<'new' | 'requests'>(isStockManager ? 'requests' : 'new');
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const go = () =>
      supabase.rpc('issue_requests').then(({ data }) => setPending(((data ?? []) as Req[]).filter((r) => r.status === 'pending').length));
    go();
    window.addEventListener('prosmart:push', go);
    return () => window.removeEventListener('prosmart:push', go);
  }, [tab]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {([['new', 'طلب صرف'], ['requests', isStockManager ? 'طلبات الموافقة' : 'طلباتي']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-xl border px-3 py-2 text-sm font-bold ${tab === k ? 'border-brand bg-brand text-on-brand' : 'border-navy-600'}`}>
            {label}
            {k === 'requests' && pending > 0 && <span className="ms-1 rounded-full bg-red-500 px-1.5 text-[11px] text-white">{pending}</span>}
          </button>
        ))}
      </div>
      {tab === 'new' ? <IssueForm onSent={() => setTab('requests')} /> : <Requests manager={isStockManager} />}
    </div>
  );
}

function Requests({ manager }: { manager: boolean }) {
  const [rows, setRows] = useState<Req[] | null>(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('issue_requests');
    setRows((data ?? []) as Req[]);
  }, []);
  useEffect(() => {
    load();
    window.addEventListener('prosmart:push', load);
    return () => window.removeEventListener('prosmart:push', load);
  }, [load]);

  const act = async (id: string, kind: 'approve' | 'reject' | 'cancel') => {
    let args: Record<string, unknown> = { p_id: id };
    if (kind === 'reject') {
      const reason = window.prompt('سبب الرفض (اختياري):');
      if (reason === null) return;
      args = { p_id: id, p_reason: reason };
    }
    setBusy(id);
    setMsg('');
    const fn = kind === 'approve' ? 'approve_issue' : kind === 'reject' ? 'reject_issue' : 'cancel_issue_request';
    const { error } = await supabase.rpc(fn, args);
    setBusy('');
    if (error) setMsg(error.message);
    else setMsg(kind === 'approve' ? 'تمت الموافقة وتم الصرف من المخزن ✓' : kind === 'reject' ? 'تم رفض الطلب' : 'تم إلغاء الطلب');
    load();
  };

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">{manager ? 'طلبات الصرف' : 'طلبات الصرف بتاعتي'}</h1>
      {msg && <p className="rounded-lg bg-brand/15 px-3 py-2 text-sm text-brand">{msg}</p>}
      {rows === null && <p className="text-fg/60">جاري التحميل...</p>}
      {rows?.map((r) => (
        <div key={r.id} className={card + ' space-y-2 ' + (r.status === 'pending' ? 'border-amber-300/50' : '')}>
          <div className="flex items-start justify-between gap-2">
            <b>#{r.order_no} · {r.client}</b>
            <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs ${reqStatus[r.status].cls}`}>{reqStatus[r.status].label}</span>
          </div>
          <div className="text-xs text-fg/60">
            {manager && r.by ? `من ${r.by} · ` : ''}{fmt(r.created_at)}
          </div>
          <ul className="space-y-1 text-sm">
            {r.lines.map((l, i) => (
              <li key={i} className="rounded-lg bg-navy-800 px-3 py-1.5">
                {l.product}{l.model ? ` · ${l.model}` : ''} × {Number(l.qty)}
                {l.serial && <span className="text-xs text-fg/50" dir="ltr"> ({l.serial})</span>}
              </li>
            ))}
          </ul>
          {r.note && <p className="text-sm text-fg/80">ملاحظة: {r.note}</p>}
          {r.reject_reason && <p className="text-sm text-red-200">سبب الرفض: {r.reject_reason}</p>}
          {r.status === 'pending' && manager && (
            <div className="flex gap-2">
              <button disabled={busy === r.id} onClick={() => act(r.id, 'approve')} className={btn + ' flex flex-1 items-center justify-center gap-1'}>
                <Check size={16} /> موافقة وصرف
              </button>
              <button disabled={busy === r.id} onClick={() => act(r.id, 'reject')} className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-red-300/50 py-2.5 text-red-200 disabled:opacity-50">
                <X size={16} /> رفض
              </button>
            </div>
          )}
          {r.status === 'pending' && !manager && r.mine && (
            <button disabled={busy === r.id} onClick={() => act(r.id, 'cancel')} className="rounded-xl border border-navy-600 px-3 py-1.5 text-sm">إلغاء الطلب</button>
          )}
        </div>
      ))}
      {rows?.length === 0 && <p className="text-fg/50">{manager ? 'مفيش طلبات.' : 'لسه مبعتّش طلبات صرف.'}</p>}
    </div>
  );
}

function IssueForm({ onSent }: { onSent: () => void }) {
  const { isStockManager } = useAuth();
  const [note, setNote] = useState('');
  const [orders, setOrders] = useState<Ord[]>([]);
  const [stock, setStock] = useState<Bal[]>([]);
  const [orderId, setOrderId] = useState('');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Bal | null>(null);
  const [tracked, setTracked] = useState(false);
  const [free, setFree] = useState<{ id: string; sn: string }[]>([]);
  const [selSn, setSelSn] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [cart, setCart] = useState<Line[]>([]);
  const [issued, setIssued] = useState<Out[]>([]);
  const [scan, setScan] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const loadStock = useCallback(async () => {
    const { data } = await supabase.from('stock_balance').select('product_id,name,model,barcode,balance').order('name');
    setStock((data ?? []) as Bal[]);
  }, []);
  useEffect(() => {
    supabase.rpc('orders_for_issue').then(({ data }) => setOrders((data ?? []) as Ord[]));
    loadStock();
  }, [loadStock]);

  const loadIssued = useCallback(async () => {
    if (!orderId) return setIssued([]);
    const { data } = await supabase.rpc('order_stock_lines', { wo: orderId });
    setIssued((data ?? []) as Out[]);
  }, [orderId]);
  useEffect(() => {
    loadIssued();
  }, [loadIssued]);

  const pick = async (b: Bal) => {
    setPicked(b); setQty(1); setSelSn([]); setErr('');
    const { data: p } = await supabase.from('products').select('track_serial').eq('id', b.product_id).single();
    const ts = !!p?.track_serial;
    setTracked(ts);
    if (ts) {
      const [{ data: items }, { data: mv }] = await Promise.all([
        supabase.from('stock_items').select('id,serial_number').eq('product_id', b.product_id),
        supabase.from('stock_movements').select('stock_item_id,type').eq('product_id', b.product_id).not('stock_item_id', 'is', null),
      ]);
      const net = new Map<string, number>();
      (mv ?? []).forEach((m) => net.set(m.stock_item_id, (net.get(m.stock_item_id) ?? 0) + (String(m.type) === 'out' ? -1 : 1)));
      setFree((items ?? []).filter((i) => (net.get(i.id) ?? 0) > 0).map((i) => ({ id: i.id, sn: i.serial_number })));
    }
  };

  const onScan = (v: string) => {
    setScan(false);
    const hit = stock.find((s) => s.barcode === v);
    if (hit) pick(hit);
    else setErr('الباركود ده مش موجود في المخزن');
  };

  const addLine = () => {
    if (!picked) return;
    setErr('');
    if (tracked) {
      if (!selSn.length) return setErr('اختار سيريال واحد على الأقل');
      const items = free.filter((f) => selSn.includes(f.id));
      setCart([...cart.filter((c) => c.pid !== picked.product_id), { pid: picked.product_id, name: picked.name, qty: items.length, items }]);
    } else {
      const already = cart.find((c) => c.pid === picked.product_id)?.qty ?? 0;
      if (qty <= 0) return setErr('الكمية غلط');
      if (qty + already > Number(picked.balance)) return setErr(`الرصيد المتاح ${Number(picked.balance)} بس`);
      setCart([...cart.filter((c) => c.pid !== picked.product_id), { pid: picked.product_id, name: picked.name, qty: qty + already, items: [] }]);
    }
    setPicked(null); setQ('');
  };

  const submit = async () => {
    if (!orderId) return setErr('اختار أمر الشغل الأول');
    if (!cart.length) return setErr('مفيش أصناف في القائمة');
    setBusy(true); setErr(''); setMsg('');
    const lines = cart.flatMap((l) =>
      l.items.length
        ? l.items.map((i) => ({ product_id: l.pid, stock_item_id: i.id, quantity: 1 }))
        : [{ product_id: l.pid, quantity: l.qty }],
    );
    const { data, error } = await supabase.rpc('request_issue', { p_wo: orderId, p_lines: lines, p_note: note });
    setBusy(false);
    if (error) return setErr(error.message);
    setCart([]);
    setNote('');
    loadStock();
    loadIssued();
    if ((data as { status?: string } | null)?.status === 'approved') setMsg('تم الصرف على الأمر ✓');
    else onSent();
  };

  const shown = q.trim() ? stock.filter((r) => (r.name + (r.model ?? '') + (r.barcode ?? '')).toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];

  return (
    <div className="space-y-4">
      {scan && <Scanner onResult={onScan} onClose={() => setScan(false)} />}
      <h1 className="text-xl font-bold">صرف من المخزن لأمر شغل</h1>
      {!isStockManager && (
        <p className="rounded-lg bg-navy-800 px-3 py-2 text-xs text-fg/70">الصرف مش بيتم على طول: الطلب بيروح لمدير المخزن وبعد موافقته الكمية بتتخصم من الرصيد.</p>
      )}
      <select className={inp} value={orderId} onChange={(e) => { setOrderId(e.target.value); setMsg(''); }}>
        <option value="">اختار أمر الشغل...</option>
        {orders.map((o) => (<option key={o.id} value={o.id}>#{o.order_no} · {o.client_name}</option>))}
      </select>

      <div className={card + ' space-y-2'}>
        <div className="flex gap-2">
          <input className={inp} placeholder="ابحث بالاسم أو الموديل أو الباركود" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="button" onClick={() => setScan(true)} className="rounded-xl border border-brand px-3 text-brand"><ScanBarcode /></button>
        </div>
        {shown.map((r) => (
          <button key={r.product_id} onClick={() => pick(r)} className="flex w-full items-center justify-between rounded-xl bg-navy-800 px-3 py-2 text-start">
            <span>{r.name} <span className="text-xs text-fg/50" dir="ltr">{r.model}</span></span>
            <b className="text-brand">{Number(r.balance)}</b>
          </button>
        ))}
        {picked && (
          <div className="space-y-2 rounded-xl border border-brand/50 p-3">
            <div className="flex justify-between"><b>{picked.name}</b><span className="text-sm text-fg/60">الرصيد: {Number(picked.balance)}</span></div>
            {tracked ? (
              <div className="max-h-40 space-y-1 overflow-auto">
                {free.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 rounded-lg bg-navy-800 px-3 py-1.5 text-sm" dir="ltr">
                    <input type="checkbox" checked={selSn.includes(f.id)} onChange={() => setSelSn(selSn.includes(f.id) ? selSn.filter((x) => x !== f.id) : [...selSn, f.id])} />
                    {f.sn}
                  </label>
                ))}
                {!free.length && <p className="text-sm text-fg/50">مفيش سيريالات متاحة.</p>}
              </div>
            ) : (
              <input type="number" min={1} step="any" className={inp} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
            )}
            <button onClick={addLine} className={btn + ' w-full'}>إضافة للقائمة</button>
          </div>
        )}
      </div>

      {cart.length > 0 && (
        <div className={card + ' space-y-2'}>
          <h2 className="font-bold">{isStockManager ? 'هيتصرف دلوقتي' : 'هيتطلب صرفه'}</h2>
          {cart.map((l) => (
            <div key={l.pid} className="flex items-center justify-between rounded-xl bg-navy-800 px-3 py-2 text-sm">
              <span>{l.name} × {l.qty}{l.items.length ? <span className="text-xs text-fg/50" dir="ltr"> ({l.items.map((i) => i.sn).join(', ')})</span> : null}</span>
              <button onClick={() => setCart(cart.filter((c) => c.pid !== l.pid))} className="text-red-300"><X size={16} /></button>
            </div>
          ))}
          <textarea rows={2} className={inp} placeholder="ملاحظة للموافقة (اختياري)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button disabled={busy} onClick={submit} className={btn + ' w-full'}>
            {busy ? 'جاري الإرسال...' : isStockManager ? 'تأكيد الصرف' : 'إرسال الطلب لمدير المخزن'}
          </button>
        </div>
      )}
      {err && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">{err}</p>}
      {msg && <p className="text-sm text-brand">{msg}</p>}

      {orderId && issued.length > 0 && (
        <div className={card + ' space-y-1'}>
          <h2 className="font-bold">خامات الأمر (مصروف / مركّب / مرتجع)</h2>
          {issued.map((o, i) => {
            const rest = Number(o.issued) - Number(o.installed) - Number(o.returned);
            return (
              <div key={i} className="text-sm text-fg/80">
                {o.name}: {Number(o.issued)} / {Number(o.installed)} / {Number(o.returned)}
                {rest > 0 && <span className="text-amber-200"> · على ذمة الفني {rest}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
