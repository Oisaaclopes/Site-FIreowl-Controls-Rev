-- FECHAMENTO DOCUMENTAL — assinatura do responsável no ATENDIMENTO.
--
-- A assinatura pertence ao service_attendance (uma por atendimento; uma OS com N
-- atendimentos terá N assinaturas, cada uma vinculada ao seu atendimento e
-- técnico — §34/§37). Persistimos os campos na própria linha do atendimento; o
-- PNG vai para o bucket privado report-media (reaproveitado), o caminho fica em
-- client_signature_path.
--
-- Status distingue assinatura real de exceções sem falsificar (§32/§33):
--   SIGNED       — responsável assinou (path + nome).
--   UNAVAILABLE  — responsável indisponível (exige motivo em signature_note).
--   REFUSED      — cliente recusou assinar (motivo em signature_note).
--
-- Aditiva, idempotente, não-destrutiva. Independe da 0086. NÃO edita 0083-0090.
-- Requer 0083 (service_attendances).

alter table public.service_attendances
  add column if not exists client_signature_name   text,
  add column if not exists client_signature_role   text,
  add column if not exists client_signature_path   text,
  add column if not exists client_signature_status text
    check (client_signature_status is null or client_signature_status in ('SIGNED','UNAVAILABLE','REFUSED')),
  add column if not exists client_signature_note   text,
  add column if not exists client_signed_at        timestamptz;

comment on column public.service_attendances.client_signature_status is
  'SIGNED (assinou) / UNAVAILABLE (responsável indisponível) / REFUSED (recusou). '
  'UNAVAILABLE e REFUSED exigem client_signature_note. Evita assinatura fictícia.';
comment on column public.service_attendances.client_signature_path is
  'storage_path do PNG da assinatura no bucket privado report-media. NULL quando '
  'status <> SIGNED. A assinatura pertence ao atendimento, não só ao PDF.';
