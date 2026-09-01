# Edge Function `create-user`

Cria funcionários exclusivamente pelo fluxo administrativo. A função valida o JWT, consulta o profile real do solicitante e exige `ADMINISTRATIVO` + `ATIVO` antes de usar `auth.admin.createUser` com e-mail confirmado e senha temporária forte.

A senha é recebida somente no corpo HTTPS, usada na criação do Auth e nunca gravada em `profiles`, `audit_logs` ou na resposta. O profile nasce com `first_access_completed=false`; a migration `0068_employee_first_access.sql` permanece inalterada.

Auditoria segura: `USER_CREATED`, contendo apenas o UUID e o papel do usuário criado.

Deploy:

```powershell
npx.cmd supabase functions deploy create-user --project-ref kalfwikvgxogzbsemgbk --no-verify-jwt
```
