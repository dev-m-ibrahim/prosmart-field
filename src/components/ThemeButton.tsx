import { useEffect, useState } from 'react';
import { Moon, Palette, Sun } from 'lucide-react';

// One button cycles: blue (default) -> dark -> light -> blue
type Theme = 'blue' | 'dark' | 'light';
const order: Theme[] = ['blue', 'dark', 'light'];
const bar: Record<Theme, string> = { blue: '#003a5f', dark: '#0b0f14', light: '#eef2f7' };
const names: Record<Theme, string> = { blue: 'أزرق', dark: 'داكن', light: 'فاتح' };

export const readTheme = (): Theme => {
  try {
    const t = localStorage.getItem('prosmart_theme');
    return t === 'dark' || t === 'light' ? t : 'blue';
  } catch {
    return 'blue';
  }
};

function apply(t: Theme) {
  if (t === 'blue') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bar[t]);
  try {
    localStorage.setItem('prosmart_theme', t);
  } catch { /* ignore */ }
}

export default function ThemeButton() {
  const [t, setT] = useState<Theme>(readTheme());
  useEffect(() => apply(t), [t]);
  const Icon = t === 'blue' ? Palette : t === 'dark' ? Moon : Sun;
  return (
    <button
      type="button"
      aria-label="تغيير المظهر"
      onClick={() => setT(order[(order.indexOf(t) + 1) % 3])}
      className="flex items-center gap-1 rounded-lg border border-navy-600 px-2.5 py-1.5 text-sm"
    >
      <Icon size={16} />
      <span className="text-xs">{names[t]}</span>
    </button>
  );
}
