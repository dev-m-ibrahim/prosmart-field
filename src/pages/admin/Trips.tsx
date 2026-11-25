import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import TripCard, { type Trip } from '../../components/TripCard';
import { L, btn, card, inp } from '../../ui';

interface Person { id: string; full_name: string }
interface Ord { id: string; order_no: number; client_name: string }

// Admin: create a ride (driver + technicians + destination) and follow its status.
export default function Trips() {
  const [rows, setRows] = useState<Trip[] | null>(null);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('trips_list');
    setRows((data ?? []) as Trip[]);
  }, []);
  useEffect(() => {
    load();
    window.addEventListener('prosmart:push', load);
    return () => window.removeEventListener('prosmart:push', load);
  }, [load]);

  const cancel = async (id: string) => {
    if (!window.confirm('إلغاء المشوار؟')) return;
    const { error } = await supabase.rpc('trip_set_status', { p_id: id, p_status: 'cancelled' });
    setMsg(error?.message ?? '');
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">المشاوير</h1>
        <button className={btn + ' flex items-center gap-1'} onClick={() => setOpen(!open)}>
          <Plus size={16} /> مشوار جديد
        </button>
      </div>
      {open && <NewTrip onDone={() => { setOpen(false); load(); }} />}
      {msg && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">{msg}</p>}
      {rows === null && <p className="text-fg/60">جاري التحميل...</p>}
      {rows?.map((t) => (
        <TripCard key={t.id} trip={t} view="admin">
          {['new', 'accepted', 'on_way'].includes(t.status) && (
            <button onClick={() => cancel(t.id)} className="rounded-xl border border-red-300/50 px-3 py-1.5 text-sm text-red-200">إلغاء المشوار</button>
          )}
        </TripCard>
      ))}
      {rows && !rows.length && <p className="text-fg/50">مفيش مشاوير لسه.</p>}
    </div>
  );
}

function NewTrip({ onDone }: { onDone: () => void }) {
  const [drivers, setDrivers] = useState<Person[]>([]);
  const [techs, setTechs] = useState<Person[]>([]);
  const [orders, setOrders] = useState<Ord[]>([]);
  const [f, setF] = useState({ driver: '', wo: '', pickup: '', dest: '', dest_url: '', at: '', note: '' });
  const [sel, setSel] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from('profiles').select('id,full_name,role').eq('is_active', true).in('role', ['driver', 'technician']).order('full_name').then(({ data }) => {
      const all = (data ?? []) as (Person & { role: string })[];
      setDrivers(all.filter((p) => p.role === 'driver'));
      setTechs(all.filter((p) => p.role === 'technician'));
    });
    supabase.rpc('orders_for_issue').then(({ data }) => setOrders((data ?? []) as Ord[]));
  }, []);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.driver) return setErr('اختار السائق');
    if (!sel.length) return setErr('اختار فني واحد على الأقل يركب مع السائق');
    if (!f.dest.trim() && !f.wo) return setErr('اكتب وجهة المشوار أو اختار أمر شغل');
    setBusy(true);
    setErr('');
    const { error } = await supabase.rpc('create_trip', {
      p_driver: f.driver,
      p_wo: f.wo || null,
      p_pickup: f.pickup,
      p_dest: f.dest,
      p_dest_url: f.dest_url,
      p_at: new Date(f.at).toISOString(),
      p_note: f.note,
      p_techs: sel,
    });
    setBusy(false);
    if (error) return setErr(error.message);
    onDone();
  };

  return (
    <form onSubmit={submit} className={card + ' space-y-3'}>
      <L t="السائق">
        <select required className={inp} value={f.driver} onChange={set('driver')}>
          <option value="">اختار السائق...</option>
          {drivers.map((d) => (<option key={d.id} value={d.id}>{d.full_name}</option>))}
        </select>
      </L>
      {!drivers.length && <p className="text-xs text-amber-200">مفيش سائقين لسه — ضيف مستخدم بدور «سائق» من الإعدادات.</p>}
      <L t="الفنيين اللي هيركبوا">
        <div className="flex flex-wrap gap-2">
          {techs.map((p) => (
            <button type="button" key={p.id} onClick={() => toggle(p.id)} className={`rounded-full border px-3 py-1 text-sm ${sel.includes(p.id) ? 'border-brand bg-brand text-on-brand' : 'border-navy-600'}`}>
              {p.full_name}
            </button>
          ))}
        </div>
      </L>
      <L t="مرتبط بأمر شغل (اختياري — الوجهة بتتملي منه)">
        <select className={inp} value={f.wo} onChange={set('wo')}>
          <option value="">من غير أمر</option>
          {orders.map((o) => (<option key={o.id} value={o.id}>#{o.order_no} · {o.client_name}</option>))}
        </select>
      </L>
      <L t="من (نقطة التجمّع)"><input className={inp} value={f.pickup} onChange={set('pickup')} /></L>
      <L t="إلى (الوجهة)"><input className={inp} placeholder={f.wo ? 'سيبها فاضية عشان تاخد عنوان الأمر' : ''} value={f.dest} onChange={set('dest')} /></L>
      <L t="لينك الموقع (اختياري)"><input dir="ltr" className={inp} value={f.dest_url} onChange={set('dest_url')} /></L>
      <L t="الميعاد"><input required type="datetime-local" className={inp} value={f.at} onChange={set('at')} /></L>
      <L t="ملاحظات للسائق"><textarea rows={2} className={inp} value={f.note} onChange={set('note')} /></L>
      {err && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">{err}</p>}
      <button disabled={busy} className={btn + ' w-full'}>{busy ? 'جاري الحفظ...' : 'إنشاء المشوار وإرسال إشعار'}</button>
    </form>
  );
}
