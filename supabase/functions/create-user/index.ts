// Supabase Edge Function: create-user
//
// Criação de usuários EXCLUSIVA para ADMINISTRATIVO, server-side. Substitui o
// antigo fluxo browser → supabase.auth.signUp (que dependia de signup público).
//
// Segurança:
// - A service_role NUNCA vai ao browser: fica só no runtime da função (env
//   embutida do Supabase: SUPABASE_SERVICE_ROLE_KEY).
// - O solicitante é validado pelo JWT real (getUser) + role ADMINISTRATIVO lida
//   de public.profiles. Não confia em nada vindo do corpo da requisição.
// - O role escolhido vai nos metadados → o trigger handle_new_user já cria o
//   profile com o role correto (sem janela TECNICO). Em seguida completamos os
//   dados cadastrais; se isso falhar, revertemos o auth user (sem conta órfã).
//
// Deno runtime. Não é checado pelo tsc/eslint do Next (ver tsconfig/eslint).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VALID_ROLES = ['ADMINISTRATIVO', 'TECNICO', 'GESTOR', 'FINANCEIRO'];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// CORS NÃO é autenticação (a segurança é o JWT). Por padrão reflete "*"; para
// endurecer, defina o segredo ALLOWED_ORIGINS (lista separada por vírgula) na
// função — aí só as origens listadas recebem o header, sem quebrar o restante.
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
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
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

  // 3) Autorização real: o solicitante precisa ser ADMINISTRATIVO.
  const { data: prof } = await admin
    .from('profiles')
    .select('role, name')
    .eq('id', caller.id)
    .single();
  if (!prof || prof.role !== 'ADMINISTRATIVO') return json(403, { error: 'forbidden' }, cors);

  // 4) Entrada validada server-side.
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid_json' }, cors);
  }
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const role = String(body.role ?? '');
  const name = String(body.name ?? '').trim();

  if (!EMAIL_RE.test(email)) return json(422, { error: 'invalid_email' }, cors);
  if (password.length < 6) return json(422, { error: 'weak_password' }, cors);
  if (!VALID_ROLES.includes(role)) return json(422, { error: 'invalid_role' }, cors);
  if (!name) return json(422, { error: 'invalid_name' }, cors);

  // 5) Cria o auth user já confirmado (senha definida pelo admin é usável de
  //    imediato). O role vai nos metadados → trigger cria o profile já correto.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role },
  });
  if (createErr || !created?.user) {
    const m = (createErr?.message ?? '').toLowerCase();
    if (m.includes('already') || m.includes('registered') || m.includes('exists')) {
      return json(409, { error: 'email_exists' }, cors);
    }
    if (m.includes('password')) return json(422, { error: 'weak_password' }, cors);
    return json(400, { error: 'create_failed' }, cors);
  }
  const newId = created.user.id;

  // 6) Completa os dados cadastrais. Falha aqui → reverte o auth user (sem órfão).
  const { error: updErr } = await admin
    .from('profiles')
    .update({
      name,
      role,
      email,
      full_name: (body.fullName as string) ?? null,
      cpf: (body.cpf as string) ?? null,
      birth_date: (body.birthDate as string) ?? null,
      phone: (body.phone as string) ?? null,
      schedule: body.schedule ?? null,
      courses: body.courses ?? null,
    })
    .eq('id', newId);
  if (updErr) {
    await admin.auth.admin.deleteUser(newId).catch(() => {});
    return json(500, { error: 'profile_update_failed' }, cors);
  }

  // 7) Trilha de auditoria (best-effort; nunca bloqueia; sem senha).
  await admin
    .from('audit_logs')
    .insert({
      user_id: caller.id,
      user_name: prof.name ?? null,
      user_role: 'ADMINISTRATIVO',
      action: 'USER_CREATED',
      module: 'usuarios',
      details: `target_user_id=${newId} target_role=${role}`,
    })
    .catch(() => {});

  return json(200, { ok: true, id: newId }, cors);
});
