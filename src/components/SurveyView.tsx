import { useEffect, useState } from 'react';
import { FileDown, Pencil } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { exportPdf } from '../lib/export';
import { t } from '../i18n';
import { fmt } from '../ui';
import SurveyForm from './SurveyForm';
import {
  SECTIONS, normSurvey, nm, roomDetail, roomWord, secLabel, surveyHtml, totals, unitLabel, type SurveyData,
} from '../lib/survey';

interface O { id: string; order_no: number; client_name: string; location_text: string; scheduled_at: string }

// Admin view of a survey order: read the technician's survey, edit it, export a PDF.
export default function SurveyView({ order }: { order: O }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const [cust, setCust] = useState('');
  const [d, setD] = useState<SurveyData | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || edit) return;
    supabase.from('site_surveys').select('customer_name,data').eq('work_order_id', order.id).maybeSingle().then(({ data }) => {
      setCust(data?.customer_name ?? '');
      setD(data ? normSurvey(data.data as Partial<SurveyData>) : null);
    });
  }, [open, edit, order.id]);

  const pdf = async () => {
    if (!d) return;
    setBusy(true);
    try { await exportPdf(`survey-${order.order_no}`, surveyHtml({ ...order, when: fmt(order.scheduled_at) }, cust, d)); } finally { setBusy(false); }
  };

  return (
    <div className="mt-3">
      <button onClick={() => setOpen(!open)} className="text-sm text-brand">{open ? t('إخفاء المعاينة ▲', 'Hide survey ▲') : t('عرض المعاينة ▼', 'View survey ▼')}</button>
      {open && (
        <div className="mt-2 space-y-2 rounded-xl bg-navy-800 p-3 text-sm">
          {edit ? (
            <>
              <SurveyForm orderId={order.id} defaultCustomer={order.client_name} />
              <button onClick={() => setEdit(false)} className="w-full rounded-xl border border-navy-600 py-2">{t('رجوع للعرض', 'Back to view')}</button>
            </>
          ) : !d ? (
            <p className="text-fg/60">{t('الفني لسه ماسجلش معاينة.', 'No survey recorded yet.')}</p>
          ) : (
            <>
              <p><b>{t('العميل', 'Customer')}:</b> {cust || order.client_name}</p>
              {SECTIONS.filter((s) => d[s].length).map((s) => (
                <div key={s} className="space-y-1">
                  <b className="text-brand">{secLabel(s)}</b>
                  {d[s].map((r) => (
                    <div key={r.id} className="rounded-lg bg-navy-900 p-2">
                      <div className="font-bold">{r.name || roomWord(s)}{r.floor ? ` · ${r.floor}` : ''}</div>
                      {roomDetail(s, r) && <div className="text-xs text-amber-200">{roomDetail(s, r)}</div>}
                      <div className="text-fg/80">{r.items.map((i) => `${nm(i)} × ${i.qty}${unitLabel(i.unit) ? ' ' + unitLabel(i.unit) : ''}`).join(' · ') || '—'}</div>
                    </div>
                  ))}
                  <div className="text-xs text-fg/70">
                    {t('الإجمالي', 'Total')}: {totals(d[s]).map((x) => `${x.name} ${x.qty}${unitLabel(x.unit) ? ' ' + unitLabel(x.unit) : ''}`).join(' · ')}
                  </div>
                </div>
              ))}
              {d.notes && <p className="whitespace-pre-wrap"><b>{t('ملاحظات', 'Notes')}:</b> {d.notes}</p>}
            </>
          )}
          {!edit && (
            <div className="flex gap-2">
              {d && (
                <button disabled={busy} onClick={pdf} className="flex items-center gap-1 rounded-xl border border-brand px-3 py-2 text-brand">
                  <FileDown size={14} /> {busy ? t('جاري التجهيز...', 'Preparing...') : t('تصدير PDF', 'Export PDF')}
                </button>
              )}
              <button onClick={() => setEdit(true)} className="flex items-center gap-1 rounded-xl border border-navy-600 px-3 py-2"><Pencil size={14} /> {t('تعديل المعاينة', 'Edit survey')}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
