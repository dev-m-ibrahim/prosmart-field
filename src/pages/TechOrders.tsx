import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Badge, KindChip, card, fmt } from '../ui';

interface Order {
  id: string;
  order_no: number;
  client_name: string;
  location_text: string;
  scheduled_at: string;
  status: string;
  kind?: string;
}

export default function TechOrders() {
  const [rows, setRows] = useState<Order[]>([]);
  useEffect(() => {
    supabase
      .from('work_orders')
      .select('id,order_no,client_name,location_text,scheduled_at,status,kind')
      .order('scheduled_at', { ascending: false })
      .then(({ data }) => setRows((data ?? []) as Order[]));
  }, []);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">أوامر الشغل بتاعتي</h1>
      <div className="space-y-3">
        {rows.map((r) => (
          <Link key={r.id} to={`/tech/${r.id}`} className={card + ' block active:bg-navy-700'}>
            <div className="flex justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <b>
                  #{r.order_no} · {r.client_name}
                </b>
                <KindChip k={r.kind} />
              </div>
              <Badge s={r.status} />
            </div>
            <div className="mt-1 text-sm text-fg/60">{r.location_text}</div>
            <div className="text-sm text-fg/60">{fmt(r.scheduled_at)}</div>
          </Link>
        ))}
        {!rows.length && <p className="text-fg/50">مفيش أوامر شغل ليك دلوقتي.</p>}
      </div>
    </div>
  );
}
