// Supabase Edge Function: reset-user-password
//
// Redefinição de senha de OUTRO usuário, EXCLUSIVA para ADMINISTRATIVO ATIVO,
// 100% server-side. O frontend é static export → a service_role NUNCA vai ao
// browser; fica só no runtime da função (SUPABASE_SERVICE_ROLE_KEY).
//
// Segurança:
// - Solicitante validado pelo JWT real (getUser) + role/status lidos de
//   public.profiles com a service_role. NÃO confia em nada do corpo (nem role).
// - Só troca a senha via auth.admin.updateUserById. NÃO altera email/role/
//   status/cargo (reset NÃO reativa usuário).
// - Nunca registra a senha (nem em audit_logs, nem em logs).
//
// Deno runtime. Não é checado pelo tsc/eslint do Next.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PASSWORD_MIN = 10;

function corsFor(req: Request): Record<string, string> {
  const allow = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get('Origin') || '';
  const allowOrigin = allow.length === 0 ? '*' : (allow.includes(origin) ? origin : allow[0]);
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

function strongEnough(pw: string): boolean {
  return pw.length >= PASSWORD_MIN && /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw);
}

Deno.serve(async (req: Request) => {
  const cors = corsFor(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' }, cors);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // 1) Identidade do solicitante a partir do JWT (nunca do corpo).
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json(401, { error: 'unauthorized' }, cors);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  const caller = userData?.user;
  if (userErr || !caller) return json(401, { error: 'unauthorized' }, cors);

  // 2) Cliente admin (service_role) — só no servidor.
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // 3) Autorização real: ADMINISTRATIVO E ATIVO.
  const { data: prof } = await admin.from('profiles').select('role, status, name').eq('id', caller.id).single();
  if (!prof || prof.role !== 'ADMINISTRATIVO' || (prof.status && prof.status !== 'ATIVO')) {
    return json(403, { error: 'forbidden' }, cors);
  }

  // 4) Entrada validada server-side.
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: 'invalid_json' }, cors); }
  const targetUserId = String(body.targetUserId ?? '').trim();
  const password = String(body.password ?? '');
  if (!targetUserId) return json(422, { error: 'invalid_target' }, cors);
  if (targetUserId === caller.id) return json(403, { error: 'self_reset_blocked' }, cors); // §B6
  if (!strongEnough(password)) return json(422, { error: 'weak_password' }, cors);

  // 5) Alvo precisa existir (e pega o e-mail só para a auditoria).
  const { data: target } = await admin.from('profiles').select('email').eq('id', targetUserId).single();
  if (!target) return json(404, { error: 'target_not_found' }, cors);

  // 6) Troca SOMENTE a senha. Não mexe em email/role/status/cargo.
  const { error: updErr } = await admin.auth.admin.updateUserById(targetUserId, { password });
  if (updErr) {
    const m = (updErr.message ?? '').toLowerCase();
    if (m.includes('password')) return json(422, { error: 'weak_password' }, cors);
    if (m.includes('not found') || m.includes('user')) return json(404, { error: 'target_not_found' }, cors);
    return json(400, { error: 'reset_failed' }, cors);
  }

  // 7) Trilha de auditoria (best-effort; NUNCA a senha). O builder do supabase-js
  //    é "thenable" mas não tem .catch — usar await + erro explícito. A falha da
  //    auditoria NÃO pode derrubar o reset (que já teve sucesso acima).
  try {
    const { error: auditErr } = await admin.from('audit_logs').insert({
      user_id: caller.id,
      user_name: prof.name ?? null,
      user_role: 'ADMINISTRATIVO',
      action: 'USER_PASSWORD_RESET',
      module: 'usuarios',
      details: `target_user_id=${targetUserId} target_email=${target.email ?? ''}`,
    });
    if (auditErr) console.error('audit_log USER_PASSWORD_RESET falhou:', auditErr.message);
  } catch (e) {
    console.error('audit_log USER_PASSWORD_RESET erro:', e instanceof Error ? e.message : String(e));
  }

  return json(200, { ok: true }, cors);
});
