import { useCallback, useEffect, useState } from 'react';
import { Car, CheckCheck, Flag } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import TripCard, { type Trip } from '../../components/TripCard';
import { btn } from '../../ui';

// Driver home: the rides he has to do (take technicians to the sites).
export default function MyTrips() {
  const [rows, setRows] = useState<Trip[] | null>(null);
  const [busy, setBusy] = useState('');
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

  const set = async (id: string, status: 'accepted' | 'on_way' | 'done') => {
    setBusy(id);
    setMsg('');
    const { error } = await supabase.rpc('trip_set_status', { p_id: id, p_status: status });
    setBusy('');
    if (error) setMsg(error.message.includes('Failed to fetch') ? 'مفيش إنترنت، جرّب تاني.' : error.message);
    load();
  };

  const active = (rows ?? []).filter((r) => ['new', 'accepted', 'on_way'].includes(r.status)).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const past = (rows ?? []).filter((r) => !['new', 'accepted', 'on_way'].includes(r.status));

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">مشاويري</h1>
      {msg && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">{msg}</p>}
      {rows === null && <p className="text-fg/60">جاري التحميل...</p>}
      {active.map((t) => (
        <TripCard key={t.id} trip={t} view="driver">
          {t.status === 'new' && (
            <button disabled={busy === t.id} onClick={() => set(t.id, 'accepted')} className={btn + ' flex w-full items-center justify-center gap-2'}>
              <CheckCheck size={18} /> قبلت المشوار
            </button>
          )}
          {(t.status === 'new' || t.status === 'accepted') && (
            <button disabled={busy === t.id} onClick={() => set(t.id, 'on_way')} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-brand py-2.5 font-bold text-brand disabled:opacity-50">
              <Car size={18} /> أنا في الطريق (بيوصل إشعار للركاب)
            </button>
          )}
          {t.status === 'on_way' && (
            <button disabled={busy === t.id} onClick={() => set(t.id, 'done')} className={btn + ' flex w-full items-center justify-center gap-2'}>
              <Flag size={18} /> وصّلتهم — خلّصت المشوار
            </button>
          )}
        </TripCard>
      ))}
      {rows && !active.length && <p className="text-fg/50">مفيش مشاوير دلوقتي.</p>}
      {past.length > 0 && (
        <>
          <h2 className="pt-2 font-bold text-fg/70">آخر المشاوير</h2>
          {past.map((t) => (<TripCard key={t.id} trip={t} view="driver" />))}
        </>
      )}
    </div>
  );
}
