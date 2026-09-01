# Convite de funcionário — runbook

`create-user` envia convite oficial do Supabase e não recebe senha. O reenvio usa
o recovery oficial do Auth para preservar UUID/profile. As duas ações validam JWT
e o profile real: somente `ADMINISTRATIVO` com `status = ATIVO`.

## Implantação

1. Aplicar `lib/db/migrations/0068_employee_first_access.sql`.
2. Definir a URL pública HTTPS, sem barra final:
   `npx.cmd supabase secrets set APP_URL=https://SEU-DOMINIO --project-ref kalfwikvgxogzbsemgbk`
3. Implantar:
   `npx.cmd supabase functions deploy create-user --project-ref kalfwikvgxogzbsemgbk --no-verify-jwt`
4. Em Authentication → URL Configuration, definir a Site URL e incluir
   `https://SEU-DOMINIO/funcionarios/primeiro-acesso/` nas Redirect URLs.
5. Manter **Allow new users to sign up = OFF**. O frontend não chama `signUp`.

O export gera `funcionarios/primeiro-acesso/index.html` (`output: 'export'` e
`trailingSlash: true`), compatível com refresh direto na Hostinger.

## Template de convite

No Dashboard: Authentication → Email Templates → Invite user.

- Assunto: `Seu acesso ao Fireowl Guardian`
- Texto: `Olá. Seu acesso ao Fireowl Guardian foi criado. Clique abaixo para concluir seu cadastro e criar sua senha.`
- Botão: `CRIAR MINHA SENHA`, apontando para `{{ .ConfirmationURL }}`.
- Rodapé: `Fireowl Controls. Este link é pessoal; não compartilhe.`

Não informar prazo sem ele estar realmente configurado. Não incluir role, status,
senha ou tokens fora de `ConfirmationURL`.

Eventos seguros: `USER_INVITED`, `USER_INVITE_RESENT` e
`USER_FIRST_ACCESS_COMPLETED`. Nenhum deles registra senha ou token.
