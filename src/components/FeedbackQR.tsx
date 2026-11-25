import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, MessageCircle, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from '../lib/supabase';
import { feedbackUrl } from '../lib/feedback';
import { waLink } from '../lib/phone';
import { btn, card, fmt } from '../ui';

interface Status {
  submitted: boolean;
  rating?: number;
  at?: string;
}

/**
 * Technician side: shows a QR code. The customer scans it with his own phone and writes his opinion + signature there,
 * so nothing is typed or signed on the technician's phone. Shows a tick as soon as the customer has submitted.
 */
export default function FeedbackQR({ orderId, clientName, clientPhone, orderNo, onStatus }: {
  orderId: string;
  clientName: string;
  clientPhone: string;
  orderNo: number;
  onStatus?: (submitted: boolean) => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [qr, setQr] = useState('');
  const [open, setOpen] = useState(false);
  const [st, setSt] = useState<Status>({ submitted: false });
  const [err, setErr] = useState('');

  const loadStatus = useCallback(async () => {
    const { data } = await supabase.rpc('order_feedback_status', { p_wo: orderId });
    const s = (data ?? { submitted: false }) as Status;
    setSt(s);
    onStatus?.(!!s.submitted);
    return !!s.submitted;
  }, [orderId, onStatus]);

  // token + status are fetched when the order opens (so they are cached for poor-signal sites)
  useEffect(() => {
    supabase.rpc('get_feedback_token', { p_wo: orderId }).then(({ data, error }) => {
      if (error) setErr(error.message);
      else if (typeof data === 'string') setToken(data);
    });
    loadStatus();
  }, [orderId, loadStatus]);

  const url = token ? feedbackUrl(token) : '';
  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { width: 320, margin: 2, errorCorrectionLevel: 'M' }).then(setQr).catch(() => setErr('تعذّر توليد الـ QR'));
  }, [url]);

  // while the QR is on screen, check every few seconds whether the customer has finished
  useEffect(() => {
    if (!open || st.submitted) return;
    const i = setInterval(loadStatus, 5000);
    return () => clearInterval(i);
  }, [open, st.submitted, loadStatus]);

  const shareWa = () => {
    const text = `أهلاً أستاذ/ة ${clientName} 👋\nمن فضلك سجّل رأيك ووقّع على أمر الشغل #${orderNo} من الرابط ده:\n${url}\nشكراً لحضرتك 🙏 — PROSMART`;
    window.open(waLink(clientPhone, text), '_blank');
  };

  return (
    <div className={card + ' space-y-3'}>
      <h2 className="font-bold">رأي وتوقيع العميل</h2>
      {st.submitted ? (
        <div className="flex items-center gap-2 rounded-xl bg-brand/15 px-3 py-3 text-brand">
          <CheckCircle2 />
          <div className="text-sm">
            العميل سجّل رأيه ووقّع ✓ — التقييم {st.rating}/5
            {st.at && <div className="text-xs opacity-80">{fmt(st.at)}</div>}
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-fg/70">
            خلّي العميل يعمل سكان للـ QR بموبايله ويكتب رأيه ويوقّع هناك. مش هتكتب ولا هتوقّع حاجة من موبايلك.
          </p>
          <div className="flex gap-2">
            <button disabled={!token} onClick={() => setOpen(!open)} className={btn + ' flex flex-1 items-center justify-center gap-2'}>
              <QrCode size={18} /> {open ? 'إخفاء الـ QR' : 'عرض QR للعميل'}
            </button>
            <button disabled={!token} onClick={shareWa} className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-green-500/50 py-2 text-sm text-green-200 disabled:opacity-50">
              <MessageCircle size={16} /> إرسال الرابط واتساب
            </button>
          </div>
          {open && qr && (
            <div className="space-y-2 text-center">
              <img src={qr} alt="QR" className="mx-auto w-72 max-w-full rounded-xl bg-white p-2" />
              <p className="text-sm text-fg/70">في انتظار العميل... (بيتحدّث تلقائيًا)</p>
            </div>
          )}
        </>
      )}
      {err && !token && <p className="text-sm text-red-200">{err}</p>}
    </div>
  );
}
