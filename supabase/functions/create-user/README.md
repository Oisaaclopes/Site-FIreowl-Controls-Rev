# Edge Function `create-user` — runbook

Criação de usuários **server-side** e **exclusiva para ADMINISTRATIVO**. Substitui
o antigo `supabase.auth.signUp` no browser (que dependia de signup público).

A `service_role` NUNCA vai ao cliente: fica só no runtime da função (env embutida
`SUPABASE_SERVICE_ROLE_KEY`). O solicitante é validado pelo JWT real + role
`ADMINISTRATIVO` em `public.profiles`. O role escolhido vai nos metadados, então o
trigger `handle_new_user` já cria o profile com o role correto (sem janela TECNICO);
se a gravação dos dados cadastrais falhar, o auth user é revertido (sem conta órfã).

## Pré-requisitos (uma vez)
- Supabase CLI: `npm i -g supabase` (ou `npx supabase`).
- Login e link do projeto:
  ```bash
  supabase login                      # cola o Access Token (dashboard → Account → Access Tokens)
  supabase link --project-ref kalfwikvgxogzbsemgbk
  ```

## 0) Pré-requisito de schema
Aplique **`lib/db/migrations/0061_profile_status_cargo.sql`** ANTES de implantar esta
função (ela grava `status`/`cargo` no profile) e antes do deploy do frontend desta
passada (a edição de usuário passa a gravar essas colunas).

## 1) Implantar a função (ANTES de fechar o signup)
```bash
supabase functions deploy create-user --no-verify-jwt
```
> `--no-verify-jwt`: a própria função valida o JWT + role (e precisa responder ao
> preflight OPTIONS). Nenhum segredo extra precisa ser definido — `SUPABASE_URL`,
> `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já existem no runtime.

## 2) Testar a criação controlada (na app, logado como ADMINISTRATIVO)
Conta → Usuários → Novo usuário. Esperado: "OK: usuário criado. Já pode fazer login".

## ⚠️ P0 CRÍTICO — trigger confia em metadata.role
O `handle_new_user` (migration 0006) faz `coalesce(raw_user_meta_data->>'role','TECNICO')`.
Com o signup público **ABERTO**, qualquer pessoa (a anon key é pública no site
estático) pode `auth.signUp({ options:{ data:{ role:'ADMINISTRATIVO' } } })` e nascer
**ADMINISTRATIVO** já confirmado (autoconfirm) → **takeover total**. Severidade: crítica.

Correções (fazer AMBAS):
- **Primária:** fechar o signup (passo 3 abaixo).
- **Defesa em profundidade:** aplicar `lib/db/migrations/0060_harden_new_user_role.sql`
  no SQL Editor (trigger passa a criar sempre `TECNICO`; o role autorizado é
  definido só server-side por esta função). Não quebra o fluxo admin.

## 3) Fechar o signup público (FAZER JÁ — não esperar o deploy da função)
No Dashboard: **Authentication → Sign In / Providers → Email → desmarcar
"Allow new users to sign up"** (fica `disable_signup: true`).

Ou via Management API (precisa de Personal Access Token `sbp_...`):
```bash
curl -X PATCH "https://api.supabase.com/v1/projects/kalfwikvgxogzbsemgbk/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"disable_signup": true}'
```

## 4) Revalidar
```bash
curl -s "https://kalfwikvgxogzbsemgbk.supabase.co/auth/v1/settings" -H "apikey: <ANON>"
# esperado: "disable_signup": true
```
E confirmar que a criação in-app (admin) continua funcionando.

## Testes de segurança (matriz)
| Caso | Esperado |
|---|---|
| A) anon tenta signup público | negado (após passo 3) |
| B) TECNICO chama a função | 403 forbidden |
| C) GESTOR chama a função | 403 forbidden |
| D) FINANCEIRO chama a função | 403 forbidden |
| E) ADMIN cria TECNICO | 200 ok |
| F) ADMIN cria FINANCEIRO | 200 ok |
| G) role inválida | 422 invalid_role |
| H) email duplicado | 409 email_exists |
| I) dados inválidos (email/senha) | 422 invalid_email / weak_password |

> Remova quaisquer usuários de teste criados (Dashboard → Authentication → Users),
> pois esta base é a de produção.
