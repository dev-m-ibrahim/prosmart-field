import { useEffect, useRef, useState } from 'react';

// Reads QR codes AND 1D barcodes (EAN/UPC/Code128/Code39/ITF...) with the camera.
// Uses ZXing in JavaScript so it behaves the same inside the APK's WebView on every phone.
export default function Scanner({ onResult, onClose }: { onResult: (v: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState('');
  const [manual, setManual] = useState('');
  const done = useRef(false);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ]);
        const hints = new Map<number, unknown>([
          [
            DecodeHintType.POSSIBLE_FORMATS,
            [
              BarcodeFormat.QR_CODE,
              BarcodeFormat.DATA_MATRIX,
              BarcodeFormat.EAN_13,
              BarcodeFormat.EAN_8,
              BarcodeFormat.UPC_A,
              BarcodeFormat.UPC_E,
              BarcodeFormat.CODE_128,
              BarcodeFormat.CODE_39,
              BarcodeFormat.ITF,
            ],
          ],
          [DecodeHintType.TRY_HARDER, true],
        ]);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } },
          ref.current!,
          (result) => {
            if (result && !done.current) {
              done.current = true;
              onResult(result.getText().trim());
            }
          },
        );
        if (cancelled) controls.stop();
        else stop = () => controls.stop();
      } catch {
        setErr('مقدرتش أفتح الكاميرا، تأكد من صلاحية الكاميرا (أو اكتب الكود يدوي).');
      }
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="relative min-h-0 flex-1">
        <video ref={ref} playsInline muted className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-56 w-56 rounded-2xl border-2 border-cyan-300/80" />
        </div>
        <p className="absolute inset-x-0 top-3 text-center text-sm text-white/80">وجّه الكاميرا على QR أو باركود</p>
      </div>
      {err && <p className="bg-red-500/30 p-3 text-center text-sm">{err}</p>}
      <form
        className="flex gap-2 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim() && !done.current) {
            done.current = true;
            onResult(manual.trim());
          }
        }}
      >
        <input dir="ltr" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="أو اكتب الكود هنا" className="min-w-0 flex-1 rounded-xl bg-white/15 px-3 py-2 text-white outline-none placeholder:text-white/50" />
        <button className="rounded-xl bg-cyan-400 px-4 font-bold text-black">تأكيد</button>
        <button type="button" onClick={onClose} className="rounded-xl bg-white/15 px-4">إغلاق</button>
      </form>
    </div>
  );
}
