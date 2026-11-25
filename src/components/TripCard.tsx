import type { ReactNode } from 'react';
import { MapPin, MessageCircle, Phone, Route, Users } from 'lucide-react';
import { waLink } from '../lib/phone';
import { card, fmt } from '../ui';

export interface Trip {
  id: string;
  trip_no: number;
  status: 'new' | 'accepted' | 'on_way' | 'done' | 'cancelled';
  scheduled_at: string;
  pickup: string | null;
  dest: string;
  dest_url: string | null;
  note: string | null;
  order_no: number | null;
  client: string | null;
  driver_id: string;
  driver: string | null;
  driver_phone: string | null;
  passengers: { id: string; name: string; phone: string | null }[];
}

export const tripStatus: Record<Trip['status'], { label: string; cls: string }> = {
  new: { label: 'جديد', cls: 'bg-amber-400/15 text-amber-200' },
  accepted: { label: 'السائق قبل', cls: 'bg-sky-400/15 text-sky-200' },
  on_way: { label: 'في الطريق', cls: 'bg-brand/15 text-brand' },
  done: { label: 'تم', cls: 'bg-navy-700 text-fg/70' },
  cancelled: { label: 'ملغي', cls: 'bg-red-500/15 text-red-200' },
};

// One ride: who drives, who is on board, where to, when. `view` decides which contact details are shown.
export default function TripCard({ trip, view, children }: { trip: Trip; view: 'admin' | 'driver' | 'tech'; children?: ReactNode }) {
  const st = tripStatus[trip.status];
  return (
    <div className={card + ' space-y-2'}>
      <div className="flex items-start justify-between gap-2">
        <b>
          مشوار #{trip.trip_no}
          {trip.order_no != null && <span className="font-normal text-fg/70"> · أمر #{trip.order_no} {trip.client}</span>}
        </b>
        <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs ${st.cls}`}>{st.label}</span>
      </div>
      <div className="text-sm text-fg/70">{fmt(trip.scheduled_at)}</div>
      {trip.pickup && (
        <div className="flex items-start gap-1 text-sm"><Route size={16} className="mt-0.5 shrink-0 text-brand" /> من: {trip.pickup}</div>
      )}
      <div className="flex items-start gap-1 text-sm"><MapPin size={16} className="mt-0.5 shrink-0 text-brand" /> إلى: {trip.dest}</div>
      {trip.note && <p className="whitespace-pre-wrap text-sm text-fg/80">{trip.note}</p>}

      {view !== 'tech' && (
        <div className="space-y-1 rounded-xl bg-navy-800 p-2 text-sm">
          <div className="flex items-center gap-1 text-fg/70"><Users size={16} /> الركاب ({trip.passengers.length})</div>
          {trip.passengers.map((p) => (
            <div key={p.id} className="flex items-center justify-between">
              <span>{p.name}</span>
              {view === 'driver' && p.phone && (
                <span className="flex gap-2">
                  <a aria-label="اتصال" href={`tel:${p.phone}`} className="rounded-lg border border-navy-600 p-1.5"><Phone size={14} /></a>
                  <a aria-label="واتساب" href={waLink(p.phone, `أهلاً ${p.name}، أنا ${trip.driver ?? 'السائق'} هوصّلك لمشوار #${trip.trip_no}.`)} target="_blank" rel="noreferrer" className="rounded-lg border border-green-500/50 p-1.5 text-green-300"><MessageCircle size={14} /></a>
                </span>
              )}
            </div>
          ))}
          {!trip.passengers.length && <div className="text-fg/50">مفيش ركاب متسجلين</div>}
        </div>
      )}
      {view !== 'driver' && trip.driver && (
        <div className="flex items-center justify-between rounded-xl bg-navy-800 p-2 text-sm">
          <span>السائق: <b>{trip.driver}</b></span>
          {trip.driver_phone && <a href={`tel:${trip.driver_phone}`} className="flex items-center gap-1 rounded-lg border border-navy-600 px-2 py-1"><Phone size={14} /> اتصال</a>}
        </div>
      )}
      {trip.dest_url && (
        <a href={trip.dest_url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 rounded-xl border border-navy-600 py-2 text-sm">
          <MapPin size={16} /> افتح الموقع على الخريطة
        </a>
      )}
      {children}
    </div>
  );
}
