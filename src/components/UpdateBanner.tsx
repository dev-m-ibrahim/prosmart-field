import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { canSelfUpdate, checkForUpdate, installUpdate, type UpdateInfo } from '../lib/update';

// شريط "تحديث متوفر": بيفحص آخر Release على GitHub عند الفتح وكل ما التطبيق يرجع للواجهة
export default function UpdateBanner() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  const check = useCallback(async () => {
    const u = await checkForUpdate();
    if (u) setInfo(u);
  }, []);

  useEffect(() => {
    if (!canSelfUpdate) return;
    check();
    let last = Date.now();
    const onVis = () => {
      if (document.visibilityState === 'visible' && Date.now() - last > 10 * 60 * 1000) {
        last = Date.now();
        check();
      }
    };
    const onManual = (e: Event) => setInfo((e as CustomEvent<UpdateInfo>).detail);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('prosmart:update', onManual);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('prosmart:update', onManual);
    };
  }, [check]);

  if (!info) return null;

  const go = async () => {
    setMsg('');
    setPct(0);
    try {
      const r = await installUpdate(info.url, setPct);
      if (r === 'need_permission') setMsg('فعّل "السماح بالتثبيت من هذا المصدر" للتطبيق، وارجع واضغط تحديث تاني.');
      else setMsg('اضغط "تثبيت" في الشاشة اللي ظهرت.');
    } catch (e) {
      setMsg('فشل التنزيل: ' + (e instanceof Error ? e.message : String(e)));
    }
    setPct(null);
  };

  return (
    <div className="border-b border-brand/40 bg-brand/15 px-4 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span>🔄 تحديث جديد متوفر (نسخة {info.build})</span>
        <button disabled={pct !== null} onClick={go} className="flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 font-bold text-on-brand disabled:opacity-60">
          <Download size={14} />
          {pct === null ? 'حدّث الآن' : `${pct}%`}
        </button>
      </div>
      {pct !== null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-navy-700">
          <div className="h-full bg-brand transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
      {msg && <p className="mt-1 text-xs text-fg/80">{msg}</p>}
    </div>
  );
}
