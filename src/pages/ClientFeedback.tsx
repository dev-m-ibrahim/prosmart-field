import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import SignatureCanvas from '../components/SignatureCanvas';
import { t } from '../i18n';
import { btn, card, fmt, inp } from '../ui';

interface Info {
  order_no: number;
  client_name: string;
  kind: string | null;
  scheduled_at: string;
  done: boolean;
}

// Public page (no login): the customer scans the QR on the technician's phone and fills this in on his OWN phone.
export default function ClientFeedback() {
  const { token } = useParams();
  const [info, setInfo] = useState<Info | null | undefined>(undefined); // undefined = loading, null = invalid link
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [signer, setSigner] = useState('');
  const [sig, setSig] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.rpc('feedback_info', { p_token: token ?? '' }).then(({ data, error }) => {
      if (error) {
        setErr(t('مفيش اتصال بالإنترنت، جرّب تاني.', 'No internet connection, please try again.'));
        setInfo(null);
        return;
      }
      const i = (data ?? null) as Info | null;
      setInfo(i);
      if (i) setSigner(i.client_name);
    });
  }, [token]);

  const submit = async () => {
    setErr('');
    if (!rating) return setErr(t('من فضلك اختار تقييمك بالنجوم', 'Please choose a star rating'));
    if (!sig) return setErr(t('من فضلك وقّع في المربع', 'Please sign in the box'));
    setBusy(true);
    const { error } = await supabase.rpc('feedback_submit', {
      p_token: token ?? '',
      p_rating: rating,
      p_comment: comment,
      p_signature: sig,
      p_signer: signer,
      p_ua: navigator.userAgent,
    });
    setBusy(false);
    if (error) return setErr(error.message.includes('Failed to fetch') ? t('مفيش اتصال بالإنترنت، جرّب تاني.', 'No internet connection, please try again.') : error.message);
    setSent(true);
  };

  return (
    <div className="mx-auto min-h-screen max-w-md space-y-4 px-4 py-6">
      <div className="text-center">
        <div className="text-2xl font-bold tracking-widest text-brand">PROSMART</div>
        <div className="text-sm text-fg/60">Smart Living, Simplified</div>
      </div>

      {info === undefined && <p className="text-center text-fg/60">{t('جاري التحميل...', 'Loading...')}</p>}

      {info === null && (
        <div className={card + ' text-center'}>
          <p className="font-bold">{err || t('الرابط ده مش صالح أو الأمر اتلغى.', 'This link is not valid or the order was cancelled.')}</p>
        </div>
      )}

      {info && (info.done || sent) && (
        <div className={card + ' space-y-2 text-center'}>
          <CheckCircle2 className="mx-auto text-brand" size={48} />
          <h1 className="text-lg font-bold">{sent ? t('شكرًا لحضرتك!', 'Thank you!') : t('تم تسجيل رأيك قبل كده', 'Your feedback was already recorded')}</h1>
          <p className="text-sm text-fg/70">{t('رأيك وتوقيعك اتسجلوا على أمر الشغل', 'Your feedback and signature were saved on work order')} #{info.order_no}.</p>
        </div>
      )}

      {info && !info.done && !sent && (
        <>
          <div className={card + ' space-y-1'}>
            <div className="text-sm text-fg/60">{t('العميل', 'Customer')}</div>
            <b className="text-lg">{info.client_name}</b>
            <div className="text-sm text-fg/70">
              {t('أمر شغل رقم', 'Work order no.')} <b>#{info.order_no}</b> · {fmt(info.scheduled_at)}
            </div>
          </div>

          <div className={card + ' space-y-2'}>
            <h2 className="font-bold">{t('تقييمك للخدمة', 'How was our service?')}</h2>
            <div className="flex justify-center gap-2" dir="ltr">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" aria-label={`${n}`} onClick={() => setRating(n)}>
                  <Star size={38} className={n <= rating ? 'fill-amber-300 text-amber-300' : 'text-fg/30'} />
                </button>
              ))}
            </div>
          </div>

          <div className={card + ' space-y-2'}>
            <h2 className="font-bold">{t('رأيك (اختياري)', 'Your comments (optional)')}</h2>
            <textarea rows={4} className={inp} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('اكتب رأيك أو ملاحظاتك هنا...', 'Write your feedback here...')} />
          </div>

          <div className={card + ' space-y-2'}>
            <h2 className="font-bold">{t('الاسم والتوقيع', 'Name & signature')}</h2>
            <input className={inp} value={signer} onChange={(e) => setSigner(e.target.value)} placeholder={t('الاسم', 'Name')} />
            <SignatureCanvas onChange={setSig} />
          </div>

          {err && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">{err}</p>}
          <button disabled={busy} onClick={submit} className={btn + ' w-full py-3 text-lg'}>
            {busy ? t('جاري الإرسال...', 'Sending...') : t('إرسال', 'Submit')}
          </button>
        </>
      )}
    </div>
  );
}
