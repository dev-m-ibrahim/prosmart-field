import { useEffect, useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { card, fmt, inp, KindChip } from '../../ui';

interface Row {
  id: string;
  work_order_id: string;
  order_no: number;
  client_name: string;
  signer_name: string | null;
  rating: number;
  comment: string | null;
  at: string;
  kind: string | null;
  techs: string[];
}

const Stars = ({ n }: { n: number }) => (
  <span className="inline-flex" dir="ltr">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} size={16} className={i <= n ? 'fill-amber-300 text-amber-300' : 'text-fg/25'} />
    ))}
  </span>
);

// Admin: everything customers wrote from their own phones (QR), by customer name + work order number.
export default function Feedback() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState('');
  const [min, setMin] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [sigs, setSigs] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.rpc('list_client_feedback').then(({ data }) => setRows((data ?? []) as Row[]));
  }, []);

  const toggle = async (r: Row) => {
    const next = open === r.id ? null : r.id;
    setOpen(next);
    if (next && !sigs[r.id]) {
      const { data } = await supabase.from('client_feedback').select('signature_png').eq('id', r.id).maybeSingle();
      if (data?.signature_png) setSigs((x) => ({ ...x, [r.id]: data.signature_png as string }));
    }
  };

  const shown = useMemo(
    () =>
      (rows ?? []).filter(
        (r) =>
          (!min || r.rating <= min) &&
          (r.client_name + ' ' + (r.signer_name ?? '') + ' ' + r.order_no + ' ' + (r.comment ?? '') + ' ' + r.techs.join(' ')).toLowerCase().includes(q.toLowerCase()),
      ),
    [rows, q, min],
  );
  const avg = rows?.length ? rows.reduce((a, r) => a + r.rating, 0) / rows.length : 0;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">آراء العملاء</h1>
      {rows && rows.length > 0 && (
        <div className={card + ' flex items-center justify-between'}>
          <div>
            <div className="text-sm text-fg/60">متوسط التقييم</div>
            <b className="text-2xl text-brand">{avg.toFixed(1)}</b> <span className="text-fg/60">/ 5</span>
          </div>
          <div className="text-sm text-fg/70">{rows.length} رأي</div>
        </div>
      )}
      <div className="flex gap-2">
        <input className={inp} placeholder="بحث باسم العميل أو رقم الأمر أو الفني" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={inp.replace('w-full', 'w-auto')} value={min} onChange={(e) => setMin(Number(e.target.value))}>
          <option value={0}>كل التقييمات</option>
          <option value={2}>★2 فأقل</option>
          <option value={3}>★3 فأقل</option>
        </select>
      </div>
      {rows === null && <p className="text-fg/60">جاري التحميل...</p>}
      {shown.map((r) => (
        <div key={r.id} className={card + ' space-y-2'}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <b>{r.client_name}</b>
              {r.signer_name && r.signer_name !== r.client_name && <span className="text-xs text-fg/60"> (وقّع: {r.signer_name})</span>}
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-fg/70">
                <span>أمر #{r.order_no}</span>
                <KindChip k={r.kind} />
              </div>
            </div>
            <Stars n={r.rating} />
          </div>
          {r.comment ? <p className="whitespace-pre-wrap text-sm">{r.comment}</p> : <p className="text-sm text-fg/40">من غير تعليق</p>}
          <div className="flex items-center justify-between text-xs text-fg/60">
            <span>{fmt(r.at)}{r.techs.length ? ` · الفنيين: ${r.techs.join('، ')}` : ''}</span>
            <button onClick={() => toggle(r)} className="text-brand">{open === r.id ? 'إخفاء التوقيع ▲' : 'عرض التوقيع ▼'}</button>
          </div>
          {open === r.id && (sigs[r.id] ? <img src={sigs[r.id]} style={{ background: '#fff' }} className="w-60 rounded-lg" /> : <p className="text-sm text-fg/60">جاري التحميل...</p>)}
        </div>
      ))}
      {rows && !shown.length && <p className="text-fg/50">مفيش آراء لسه.</p>}
    </div>
  );
}
