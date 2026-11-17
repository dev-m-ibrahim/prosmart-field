import { useCallback, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { useAuth } from '../auth';
import { supabase } from '../lib/supabase';
import { btn, card, fmt } from '../ui';

interface R {
  id: string;
  qty: number;
  product: string;
  model: string | null;
  serial: string | null;
  order_no: number;
  client: string;
  tech: string | null;
  at: string;
}

export default function Returns() {
  const { profile } = useAuth();
  const canAct = profile?.role === 'storekeeper' || !!profile?.is_owner;
  const [rows, setRows] = useState<R[]>([]);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('pending_returns');
    setRows((data ?? []) as R[]);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (id: string, fn: 'approve_return' | 'reject_return') => {
    setBusy(id);
    const { error } = await supabase.rpc(fn, { rid: id });
    setBusy('');
    if (error) return setMsg(error.message);
    setMsg(fn === 'approve_return' ? 'تم الاعتماد، والرصيد زاد ✓' : 'تم الرفض، القطعة فضلت على ذمة الفني');
    load();
  };

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">مرتجعات مستنية موافقتك</h1>
      {msg && <p className="rounded-lg bg-brand/15 px-3 py-2 text-sm text-brand">{msg}</p>}
      {rows.map((r) => (
        <div key={r.id} className={card + ' space-y-2'}>
          <div className="flex justify-between gap-2">
            <b>
              {r.product}
              {r.model ? ` · ${r.model}` : ''}
            </b>
            <span className="rounded-lg bg-brand/15 px-2.5 py-0.5 text-sm font-bold text-brand">{r.serial ? 'سيريال' : Number(r.qty)}</span>
          </div>
          {r.serial && (
            <div dir="ltr" className="text-xs">
              {r.serial}
            </div>
          )}
          <div className="text-xs text-white/60">
            من الفني {r.tech || '—'} · أمر #{r.order_no} ({r.client}) · {fmt(r.at)}
          </div>
          {canAct && (
            <div className="flex gap-2">
              <button disabled={busy === r.id} onClick={() => act(r.id, 'approve_return')} className={btn + ' flex flex-1 items-center justify-center gap-1'}>
                <Check size={16} /> اعتماد وإضافة للمخزن
              </button>
              <button disabled={busy === r.id} onClick={() => act(r.id, 'reject_return')} className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-red-300/50 py-2.5 text-red-200 disabled:opacity-50">
                <X size={16} /> رفض
              </button>
            </div>
          )}
        </div>
      ))}
      {!rows.length && <p className="text-white/50">مفيش مرتجعات مستنية.</p>}
    </div>
  );
}
