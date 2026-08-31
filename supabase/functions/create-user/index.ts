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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const VALID_ROLES = ['ADMINISTRATIVO', 'TECNICO', 'GESTOR', 'FINANCEIRO'];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // 1) Identidade do solicitante a partir do JWT (nunca do corpo).
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json(401, { error: 'unauthorized' });

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  const caller = userData?.user;
  if (userErr || !caller) return json(401, { error: 'unauthorized' });

  // 2) Cliente admin (service_role) — só no servidor.
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // 3) Autorização real: o solicitante precisa ser ADMINISTRATIVO.
  const { data: prof } = await admin
    .from('profiles')
    .select('role, name')
    .eq('id', caller.id)
    .single();
  if (!prof || prof.role !== 'ADMINISTRATIVO') return json(403, { error: 'forbidden' });

  // 4) Entrada validada server-side.
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid_json' });
  }
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const role = String(body.role ?? '');
  const name = String(body.name ?? '').trim();

  if (!EMAIL_RE.test(email)) return json(422, { error: 'invalid_email' });
  if (password.length < 6) return json(422, { error: 'weak_password' });
  if (!VALID_ROLES.includes(role)) return json(422, { error: 'invalid_role' });
  if (!name) return json(422, { error: 'invalid_name' });

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
      return json(409, { error: 'email_exists' });
    }
    if (m.includes('password')) return json(422, { error: 'weak_password' });
    return json(400, { error: 'create_failed' });
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
    return json(500, { error: 'profile_update_failed' });
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

  return json(200, { ok: true, id: newId });
});
