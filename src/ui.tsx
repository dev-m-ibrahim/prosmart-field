import type { ReactNode } from 'react';
import { locale, t } from './i18n';

export const inp =
  'w-full rounded-xl border border-navy-600 bg-navy-900 px-3 py-2.5 outline-none focus:border-brand';
export const btn =
  'rounded-xl bg-brand px-4 py-2.5 font-bold text-on-brand active:bg-brand-dark disabled:opacity-50';
export const card = 'rounded-2xl border border-navy-700 bg-navy-900 p-4';

export const statusLabel: Record<string, string> = {
  new: 'جديد',
  in_progress: 'جاري',
  completed: 'مكتمل',
  followup_needed: 'متابعة مطلوبة',
  cancelled: 'ملغي',
};

export function Badge({ s }: { s: string }) {
  return (
    <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-xs text-brand">
      {statusLabel[s] ?? s}
    </span>
  );
}

export function L({ t, children }: { t: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-fg/70">{t}</span>
      {children}
    </label>
  );
}

export const fmt = (d: string) =>
  new Date(d).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });

export const taskLabel: Record<string, string> = {
  pending: 'لسه',
  done: 'مستني موافقة',
  approved: 'تمت الموافقة',
  rejected: 'مرفوضة',
};

export const kindLabel = (k?: string | null) =>
  k === 'survey' ? t('معاينة', 'Survey') : k === 'maintenance' ? t('صيانة', 'Maintenance') : t('تركيب', 'Installation');

export function KindChip({ k }: { k?: string | null }) {
  const cls = k === 'survey' ? 'bg-amber-400/15 text-amber-200' : k === 'maintenance' ? 'bg-rose-400/15 text-rose-200' : 'bg-navy-700 text-fg/80';
  return <span className={`rounded-full px-2 py-0.5 text-[11px] ${cls}`}>{kindLabel(k)}</span>;
}
