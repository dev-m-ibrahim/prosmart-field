// Supabase Edge Function: admin-reset-password
// Lets the OWNER set a new password for a user who forgot theirs (logged in audit_log).
// Uses the built-in secrets SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (nothing to add).
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const out = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return out({ error: 'غير مصرّح' }, 401);

    const { data: me } = await admin.from('profiles').select('role,is_active,is_owner,full_name').eq('id', u.user.id).single();
    if (!me || !me.is_owner || !me.is_active) return out({ error: 'للمالك بس' }, 403);

    const { user_id, password } = await req.json();
    if (!user_id || typeof password !== 'string' || password.length < 8) return out({ error: 'الباسورد لازم 8 حروف على الأقل' }, 400);

    const { error } = await admin.auth.admin.updateUserById(user_id, { password });
    if (error) return out({ error: error.message }, 400);
    const { data: target } = await admin.from('profiles').select('full_name').eq('id', user_id).single();
    await admin.from('audit_log').insert({
      user_id: u.user.id, user_name: me.full_name, action: 'password_reset', record_id: user_id,
      summary: 'تغيير باسورد: ' + (target?.full_name ?? user_id),
    });
    return out({ ok: true });
  } catch (e) {
    return out({ error: String(e) }, 500);
  }
});
