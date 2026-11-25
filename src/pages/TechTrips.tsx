import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import TripCard, { type Trip } from '../components/TripCard';

// Technician: rides he is a passenger in (who is driving him, when, where to).
export default function TechTrips() {
  const [rows, setRows] = useState<Trip[] | null>(null);
  useEffect(() => {
    supabase.rpc('trips_list').then(({ data }) => setRows((data ?? []) as Trip[]));
  }, []);
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">مشاويري (السواق)</h1>
      {rows === null && <p className="text-fg/60">جاري التحميل...</p>}
      {rows?.map((t) => (<TripCard key={t.id} trip={t} view="tech" />))}
      {rows && !rows.length && <p className="text-fg/50">مفيش مشاوير متسجلة ليك.</p>}
    </div>
  );
}
