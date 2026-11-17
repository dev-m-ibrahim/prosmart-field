import { useCallback, useEffect, useState } from 'react';
import { PackageCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { btn, card, inp } from '../ui';

export interface MatLine {
  product_id: string;
  name: string;
  model: string | null;
  track_serial: boolean;
  issued: number;
  returned: number;
  installed: number;
  serials: { id: string; sn: string; state: 'pending' | 'installed' | 'returned'; pending_return?: boolean }[];
}
type Pick = '' | 'installed' | 'returned';

/** Technician: what was issued to this order → how much I installed / how much I return to the warehouse. */
export default function Materials({ orderId }: { orderId: string }) {
  const [lines, setLines] = useState<MatLine[] | null>(null);
  const [inst, setInst] = useState<Record<string, number>>({});
  const [ret, setRet] = useState<Record<string, number>>({});
  const [pick, setPick] = useState<Record<string, Pick>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('order_stock_lines', { wo: orderId });
    const ls = ((data ?? []) as MatLine[]).map((l) => ({ ...l, issued: Number(l.issued), returned: Number(l.returned), installed: Number(l.installed) }));
    setLines(ls);
    setInst(Object.fromEntries(ls.map((l) => [l.product_id, l.installed])));
    setRet(Object.fromEntries(ls.map((l) => [l.product_id, l.returned])));
    setPick(Object.fromEntries(ls.flatMap((l) => l.serials.map((s) => [s.id, s.state === 'pending' ? '' : s.state] as [string, Pick]))));
  }, [orderId]);
  useEffect(() => {
    load();
  }, [load]);

  if (!lines || !lines.length) return null;

  const left = (l: MatLine) => l.issued - (inst[l.product_id] ?? 0) - (ret[l.product_id] ?? 0);

  const save = async () => {
    setMsg('');
    for (const l of lines) {
      if (l.track_serial) continue;
      if ((ret[l.product_id] ?? 0) < l.returned) return setMsg(`${l.name}: المرتجع اتسجل قبل كده (${l.returned}) ومينفعش يتقلل`);
      if (left(l) < 0) return setMsg(`${l.name}: المركّب + المرتجع أكبر من المصروف (${l.issued})`);
    }
    const payload = lines.map((l) =>
      l.track_serial
        ? {
            product_id: l.product_id,
            installed_items: l.serials.filter((s) => pick[s.id] === 'installed').map((s) => s.id),
            returned_items: l.serials.filter((s) => pick[s.id] === 'returned').map((s) => s.id),
          }
        : { product_id: l.product_id, installed: inst[l.product_id] ?? 0, returned: ret[l.product_id] ?? 0 },
    );
    setBusy(true);
    const { error } = await supabase.rpc('report_stock_usage', { wo: orderId, lines: payload });
    setBusy(false);
    setMsg(error ? error.message : navigator.onLine ? 'تم الحفظ ✓ — المرتجع مستني موافقة أمين المخزن' : 'تم الحفظ على الموبايل ✓ — هيترفع أول ما النت يرجع');
  };

  return (
    <div className={card + ' space-y-3'}>
      <h2 className="flex items-center gap-2 font-bold"><PackageCheck size={18} /> الخامات المصروفة للأمر</h2>
      <p className="text-xs text-fg/60">اكتب اللي ركّبته واللي هترجّعه للمخزن. اللي مش مسجّل لسه بيفضل على ذمتك.</p>
      {lines.map((l) => (
        <div key={l.product_id} className="space-y-2 rounded-xl bg-navy-800 p-3 text-sm">
          <div className="flex justify-between gap-2">
            <b>{l.name}</b>
            <span className="text-fg/70">اتصرف: <b className="text-brand">{l.issued}</b></span>
          </div>
          {!l.track_serial ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-fg/70">ركّبت
                  <input type="number" min={0} step="any" className={inp} value={inst[l.product_id] ?? 0}
                    onChange={(e) => setInst({ ...inst, [l.product_id]: Number(e.target.value) })} />
                </label>
                <label className="text-xs text-fg/70">مرتجع للمخزن
                  <input type="number" min={l.returned} step="any" className={inp} value={ret[l.product_id] ?? 0}
                    onChange={(e) => setRet({ ...ret, [l.product_id]: Number(e.target.value) })} />
                </label>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className={left(l) === 0 ? 'text-brand' : left(l) < 0 ? 'text-red-200' : 'text-amber-200'}>
                  {left(l) === 0 ? '✓ مفيش حاجة على ذمتك' : left(l) < 0 ? 'الكمية أكتر من المصروف' : `متبقي على ذمتك: ${left(l)}`}
                </span>
                {left(l) > 0 && (
                  <button type="button" className="rounded-lg border border-brand px-2 py-1 text-brand"
                    onClick={() => setRet({ ...ret, [l.product_id]: (ret[l.product_id] ?? 0) + left(l) })}>
                    الباقي مرتجع
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              {l.serials.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-navy-900 px-2.5 py-1.5">
                  <span dir="ltr" className="text-xs">{s.sn}</span>
                  {s.state === 'returned' ? (
                    <span className="text-xs text-brand">{s.pending_return ? 'مرتجع — مستني موافقة الأمين' : 'مرتجع ✓'}</span>
                  ) : (
                    <select className="rounded-lg border border-navy-600 bg-navy-900 px-2 py-1 text-xs" value={pick[s.id] ?? ''}
                      onChange={(e) => setPick({ ...pick, [s.id]: e.target.value as Pick })}>
                      <option value="">على ذمتي</option>
                      <option value="installed">ركّبته</option>
                      <option value="returned">رجّعته للمخزن</option>
                    </select>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <button disabled={busy} onClick={save} className={btn + ' w-full'}>{busy ? 'جاري الحفظ...' : 'حفظ الخامات'}</button>
      {msg && <p className="text-sm text-brand">{msg}</p>}
    </div>
  );
}
