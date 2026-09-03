-- ETAPA OPERACIONAL 3B — vínculo formal FOTO ↔ ATENDIMENTO.
--
-- A 0083 criou service_attendances (execução real de UMA OS, 0..N por OS) e a
-- field_photos (0044+) já relaciona a foto à OS (os_id), ao relatório e à
-- pendência — mas NÃO ao atendimento específico. Como uma OS pode ter vários
-- atendimentos, precisamos saber em QUAL visita a evidência foi capturada.
--
-- Não há forma segura de derivar isso do schema atual (§14), então adicionamos
-- um vínculo formal, NULLABLE e não-destrutivo. Fotos existentes continuam
-- válidas com service_attendance_id = NULL. NÃO altera/reaplica a 0083.
--
-- Requer: 0044+ (field_photos), 0083 (service_attendances). Idempotente.

alter table public.field_photos
  add column if not exists service_attendance_id uuid
    references public.service_attendances(id) on delete set null;

comment on column public.field_photos.service_attendance_id is
  'Atendimento (service_attendances) em que a evidência foi capturada. NULL = foto '
  'avulsa/legada ou classificada apenas por OS. NÃO altera a foto original nem o '
  'Before×After; é um vínculo de contexto adicional.';

create index if not exists field_photos_service_attendance_idx
  on public.field_photos (service_attendance_id)
  where service_attendance_id is not null;
