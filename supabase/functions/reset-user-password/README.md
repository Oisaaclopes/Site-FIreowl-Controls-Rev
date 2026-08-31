# Edge Function `reset-user-password` — runbook

Redefinição da senha de **outro** usuário, **server-side** e **exclusiva para
ADMINISTRATIVO ativo**. O frontend é static export → a `service_role` NUNCA vai ao
browser: fica só no runtime da função (`SUPABASE_SERVICE_ROLE_KEY`).

Garantias:
- Solicitante validado pelo **JWT real** (`getUser`) + `role = ADMINISTRATIVO` e
  `status = ATIVO` lidos de `public.profiles` (nunca do corpo).
- Troca **apenas a senha** (`auth.admin.updateUserById`). NÃO altera
  email/role/status/cargo — **reset não reativa** o usuário.
- **Self-reset bloqueado** (`self_reset_blocked`): o admin usa uma futura ação
  "Alterar minha senha".
- A senha **nunca** é registrada (audit_logs guarda só `target_user_id` e
  `target_email`; a ação é `USER_PASSWORD_RESET`).

## Deploy (não é publicado pelo deploy Hostinger)
O deploy do site (GitHub Actions → Hostinger) **não** publica Edge Functions.
Publicar manualmente com a Supabase CLI:

```bash
supabase login                      # Access Token do dashboard (Account → Access Tokens)
supabase link --project-ref kalfwikvgxogzbsemgbk
supabase functions deploy reset-user-password --no-verify-jwt
```

> `--no-verify-jwt`: a própria função valida o JWT + role (e responde ao preflight
> OPTIONS). Nenhum segredo extra é necessário — `SUPABASE_URL`, `SUPABASE_ANON_KEY`
> e `SUPABASE_SERVICE_ROLE_KEY` já existem no runtime da função.

## Uso (na app, logado como ADMINISTRATIVO)
Conta → Usuários → ação **Redefinir senha** na linha do usuário → definir/gerar a
nova senha → **Redefinir senha**. A senha aparece uma única vez (com "Copiar").

## Testes de segurança (matriz — §B20)
| Caso | Esperado |
|---|---|
| ADMINISTRATIVO redefine outro | 200 ok |
| GESTOR chama a função | 403 forbidden |
| TECNICO chama a função | 403 forbidden |
| FINANCEIRO chama a função | 403 forbidden |
| token inválido/ausente | 401 unauthorized |
| admin tenta a própria conta | 403 self_reset_blocked |
| alvo inexistente | 404 target_not_found |
| senha fraca | 422 weak_password |
| Após reset | login com a senha antiga falha; com a nova funciona |

> Base de produção: remova quaisquer usuários/senhas de teste após validar.
