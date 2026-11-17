import { useEffect, useState, type FormEvent } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../auth';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from '../lib/supabase';
import { roleLabel, type Profile, type Role } from '../types';
import { L, btn, card, inp } from '../ui';
import { BUILD, canSelfUpdate, checkForUpdate } from '../lib/update';

export default function Settings() {
  const { profile, session } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const saveProfile = async () => {
    const { error } = await supabase.from('profiles').update({ full_name: name, phone: phone || null }).eq('id', session!.user.id);
    setMsg(error ? error.message : 'تم حفظ البيانات ✓ (الاسم هيتحدث بعد إعادة فتح التطبيق)');
  };
  const savePw = async () => {
    setMsg('');
    if (!navigator.onLine) return setMsg('تغيير الباسورد محتاج نت.');
    if (!cur) return setMsg('اكتب الباسورد الحالي');
    if (pw.length < 8) return setMsg('الباسورد الجديد لازم 8 حروف أو أرقام على الأقل');
    if (pw !== pw2) return setMsg('تأكيد الباسورد مش متطابق');
    if (pw === cur) return setMsg('الباسورد الجديد لازم يكون مختلف عن الحالي');
    setPwBusy(true);
    // verify the current password first
    const { error: e1 } = await supabase.auth.signInWithPassword({ email: session!.user.email!, password: cur });
    if (e1) {
      setPwBusy(false);
      return setMsg('الباسورد الحالي غلط');
    }
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwBusy(false);
    setMsg(error ? error.message : 'تم تغيير الباسورد ✓');
    if (!error) {
      setCur('');
      setPw('');
      setPw2('');
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">الإعدادات</h1>
      <div className={card + ' space-y-3'}>
        <h2 className="font-bold">بياناتي</h2>
        <L t="الاسم"><input className={inp} value={name} onChange={(e) => setName(e.target.value)} /></L>
        <L t="رقم التليفون"><input dir="ltr" className={inp} value={phone} onChange={(e) => setPhone(e.target.value)} /></L>
        <button onClick={saveProfile} className={btn + ' w-full'}>حفظ</button>
      </div>
      <div className={card + ' space-y-3'}>
        <h2 className="font-bold">تغيير الباسورد</h2>
        <input type="password" dir="ltr" autoComplete="current-password" placeholder="الباسورد الحالي" className={inp} value={cur} onChange={(e) => setCur(e.target.value)} />
        <input type="password" dir="ltr" autoComplete="new-password" placeholder="الباسورد الجديد (8 على الأقل)" className={inp} value={pw} onChange={(e) => setPw(e.target.value)} />
        <input type="password" dir="ltr" autoComplete="new-password" placeholder="أكّد الباسورد الجديد" className={inp} value={pw2} onChange={(e) => setPw2(e.target.value)} />
        <button disabled={pwBusy} onClick={savePw} className={btn + ' w-full'}>{pwBusy ? 'جاري التغيير...' : 'تغيير'}</button>
      </div>
      {msg && <p className="text-sm text-brand">{msg}</p>}
      <AppVersion />
      {profile?.is_owner && <Users />}
      {profile?.is_owner && <AuditLog />}
    </div>
  );
}

function Users() {
  const { profile: me } = useAuth();
  const [rows, setRows] = useState<Profile[]>([]);
  const [note, setNote] = useState('');
  const load = () => supabase.from('profiles').select('*').order('full_name').then(({ data }) => setRows((data ?? []) as Profile[]));
  useEffect(() => {
    load();
  }, []);
  const upd = async (id: string, patch: Partial<Profile>) => {
    const { error } = await supabase.from('profiles').update(patch).eq('id', id);
    setNote(error ? error.message : '');
    load();
  };
  const resetPw = async (u: Profile) => {
    const pw = window.prompt(`باسورد جديد لـ ${u.full_name || 'المستخدم'} (8 على الأقل):`);
    if (!pw) return;
    if (pw.length < 8) return setNote('الباسورد لازم 8 حروف على الأقل');
    const { data, error } = await supabase.functions.invoke('admin-reset-password', { body: { user_id: u.id, password: pw } });
    setNote(error || data?.error ? (data?.error ?? error?.message ?? 'حصل خطأ') : `تم تغيير باسورد ${u.full_name} ✓ — اديهوله بنفسك`);
  };
  return (
    <div className={card + ' space-y-2'}>
      <h2 className="font-bold">المستخدمين والصلاحيات</h2>
      <AddUser onDone={load} />
      {note && <p className="text-sm text-brand">{note}</p>}
      {rows.map((u) => (
        <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-navy-800 p-2 text-sm">
          <input key={u.id + u.full_name} defaultValue={u.full_name} placeholder="الاسم" onBlur={(e) => e.target.value !== u.full_name && upd(u.id, { full_name: e.target.value })} className="w-28 rounded-lg border border-navy-600 bg-navy-900 px-2 py-1" />
          <div className="flex items-center gap-2">
            <select className="rounded-lg border border-navy-600 bg-navy-900 px-2 py-1" value={u.role} onChange={(e) => upd(u.id, { role: e.target.value as Role })}>
              {(Object.keys(roleLabel) as Role[]).map((r) => (<option key={r} value={r}>{roleLabel[r]}</option>))}
            </select>
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={u.is_active} onChange={(e) => upd(u.id, { is_active: e.target.checked })} />نشط</label>
            <button onClick={() => resetPw(u)} className="rounded-lg border border-navy-600 px-2 py-1 text-xs">باسورد</button>
          </div>
          {u.role === 'admin' && (
            <label className="flex w-full items-center gap-2 text-xs">
              اللقب:
              <select className="rounded-lg border border-navy-600 bg-navy-900 px-2 py-1" value={u.job_title ?? ''} onChange={(e) => upd(u.id, { job_title: e.target.value || null })}>
                <option value="">إداري</option>
                <option value="مهندس">مهندس</option>
              </select>
            </label>
          )}
          {me?.is_owner && u.role === 'admin' && !u.is_owner && (
            <label className="flex w-full items-center gap-1 text-xs text-amber-200">
              <input type="checkbox" checked={!!u.can_manage_orders} onChange={(e) => upd(u.id, { can_manage_orders: e.target.checked })} />
              تعديل/حذف أوامر الشغل
            </label>
          )}
          {me?.is_owner && !u.is_owner && (
            <label className="flex w-full items-center gap-1 text-xs text-amber-200">
              <input type="checkbox" checked={u.can_whatsapp !== false} onChange={(e) => upd(u.id, { can_whatsapp: e.target.checked })} />
              زر واتساب تأكيد الميعاد
            </label>
          )}
        </div>
      ))}
    </div>
  );
}

function AddUser({ onDone }: { onDone: () => void }) {
  const blank = { name: '', phone: '', username: '', password: '', role: 'technician' as Role | 'engineer' };
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(blank);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    const email = f.username.includes('@') ? f.username.trim() : f.username.trim().toLowerCase() + '@prosmart.app';
    // separate client so the admin's own session is untouched
    const tmp = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'tmp-signup' },
    });
    const { data, error } = await tmp.auth.signUp({ email, password: f.password, options: { data: { full_name: f.name, phone: f.phone } } });
    if (error || !data.user) {
      setMsg(error?.message ?? 'حصل خطأ');
      setBusy(false);
      return;
    }
    const { error: e2 } = await supabase.from('profiles').update({ role: f.role === 'engineer' ? 'admin' : f.role, job_title: f.role === 'engineer' ? 'مهندس' : null, is_active: true, full_name: f.name, phone: f.phone || null }).eq('id', data.user.id);
    setBusy(false);
    if (e2) return setMsg(e2.message);
    setMsg('تم إنشاء الحساب ✓ — اليوزر: ' + f.username);
    setF(blank);
    onDone();
  };

  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setOpen(!open)} className="text-sm text-brand">+ إضافة مستخدم جديد</button>
      {open && (
        <form onSubmit={submit} className="space-y-2 rounded-xl bg-navy-800 p-3">
          <input required placeholder="اسم الفني" className={inp} value={f.name} onChange={set('name')} />
          <input placeholder="رقم التليفون" dir="ltr" className={inp} value={f.phone} onChange={set('phone')} />
          <input required placeholder="اليوزر (مثلًا ahmed)" dir="ltr" autoCapitalize="none" className={inp} value={f.username} onChange={set('username')} />
          <input required minLength={8} placeholder="الباسورد (8 على الأقل)" dir="ltr" className={inp} value={f.password} onChange={set('password')} />
          <select className={inp} value={f.role} onChange={set('role')}>
            {(Object.keys(roleLabel) as Role[]).map((r) => (<option key={r} value={r}>{roleLabel[r]}</option>))}
            <option value="engineer">مهندس (بصلاحيات الإداري)</option>
          </select>
          {msg && <p className="text-sm text-brand">{msg}</p>}
          <button disabled={busy} className={btn + ' w-full'}>{busy ? 'جاري الإنشاء...' : 'إنشاء الحساب'}</button>
        </form>
      )}
    </div>
  );
}

interface Audit { id: number; at: string; user_name: string | null; action: string; summary: string | null; details: Record<string, unknown> | null }
const actLabel: Record<string, string> = { order_edit: '✏️ تعديل أمر', order_delete: '🗑 حذف أمر', user_change: '👤 تعديل مستخدم', password_reset: '🔑 تغيير باسورد' };

// Owner only: who edited / deleted what and when
function AuditLog() {
  const [rows, setRows] = useState<Audit[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!show) return;
    supabase.from('audit_log').select('id,at,user_name,action,summary,details').order('at', { ascending: false }).limit(200)
      .then(({ data }) => setRows((data ?? []) as Audit[]));
  }, [show]);
  const fmtv = (v: unknown) => (v == null || v === '' ? '—' : typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) ? new Date(v).toLocaleString('ar-EG') : String(v));
  return (
    <div className={card + ' space-y-2'}>
      <button className="font-bold text-start" onClick={() => setShow(!show)}>سجل العمليات {show ? '▲' : '▼'}</button>
      {show && rows.map((r) => (
        <div key={r.id} className="rounded-xl bg-navy-800 p-2 text-sm">
          <button className="w-full text-start" onClick={() => setOpen(open === r.id ? null : r.id)}>
            <div className="flex justify-between gap-2">
              <b>{actLabel[r.action] ?? r.action}</b>
              <span className="whitespace-nowrap text-xs text-fg/50">{new Date(r.at).toLocaleString('ar-EG')}</span>
            </div>
            <div className="text-fg/80">{r.summary}</div>
            <div className="text-xs text-fg/50">بواسطة: {r.user_name ?? 'النظام'}</div>
          </button>
          {open === r.id && r.details && (
            <div className="mt-2 space-y-1 border-t border-navy-700 pt-2 text-xs">
              {r.action === 'order_delete'
                ? <p className="text-fg/70">بيانات الأمر قبل الحذف: {String((r.details as Record<string, unknown>).client_name ?? '')} · {String((r.details as Record<string, unknown>).location_text ?? '')}</p>
                : Object.entries(r.details).map(([k, v]) => (
                    <p key={k}><b>{k}:</b> <span className="text-fg/60 line-through">{fmtv((v as unknown[])[0])}</span> ← {fmtv((v as unknown[])[1])}</p>
                  ))}
            </div>
          )}
        </div>
      ))}
      {show && !rows.length && <p className="text-sm text-fg/50">مفيش عمليات مسجلة لسه.</p>}
    </div>
  );
}

function AppVersion() {
  const [note, setNote] = useState('');
  if (!canSelfUpdate) return null;
  const check = async () => {
    setNote('بنفحص...');
    const u = await checkForUpdate();
    if (u) {
      window.dispatchEvent(new CustomEvent('prosmart:update', { detail: u }));
      setNote(`في نسخة أحدث (${u.build}) — اضغط "حدّث الآن" فوق.`);
    } else setNote('أنت على آخر نسخة ✓');
  };
  return (
    <div className={card + ' space-y-2'}>
      <h2 className="font-bold">نسخة التطبيق</h2>
      <p className="text-sm text-fg/70">النسخة الحالية: {BUILD}</p>
      <button onClick={check} className={btn + ' w-full'}>شوف في تحديث</button>
      {note && <p className="text-sm text-brand">{note}</p>}
    </div>
  );
}
