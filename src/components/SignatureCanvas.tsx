import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { t } from '../i18n';

/** Draw-a-signature pad. Calls onChange with a PNG data URL (or null when empty / cleared). Nothing is uploaded here. */
export default function SignatureCanvas({ onChange }: { onChange: (png: string | null) => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [dirty, setDirty] = useState(false);

  const clear = () => {
    const c = cv.current!.getContext('2d')!;
    c.fillStyle = '#fff';
    c.fillRect(0, 0, cv.current!.width, cv.current!.height);
    setDirty(false);
    onChange(null);
  };
  useEffect(() => {
    const c = cv.current!.getContext('2d')!;
    c.fillStyle = '#fff';
    c.fillRect(0, 0, cv.current!.width, cv.current!.height);
  }, []);

  const pos = (e: PointerEvent) => {
    const el = cv.current!;
    const r = el.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * el.width) / r.width, y: ((e.clientY - r.top) * el.height) / r.height };
  };
  const down = (e: PointerEvent) => {
    drawing.current = true;
    const c = cv.current!.getContext('2d')!;
    const p = pos(e);
    c.beginPath();
    c.moveTo(p.x, p.y);
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = '#000';
    cv.current!.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (!drawing.current) return;
    const c = cv.current!.getContext('2d')!;
    const p = pos(e);
    c.lineTo(p.x, p.y);
    c.stroke();
    if (!dirty) setDirty(true);
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(cv.current!.toDataURL('image/png'));
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={cv}
        width={600}
        height={240}
        style={{ touchAction: 'none', background: '#fff' }}
        className="w-full rounded-xl border border-navy-600"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
      <button type="button" onClick={clear} disabled={!dirty} className="w-full rounded-xl border border-navy-600 py-2 text-sm disabled:opacity-40">
        {t('مسح التوقيع', 'Clear signature')}
      </button>
    </div>
  );
}
